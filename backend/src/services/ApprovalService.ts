import { Types } from 'mongoose';
import { ApprovalWorkflow, ApprovalEntity, IWorkflowLevel } from '../models/ApprovalWorkflow';
import { ApprovalRequest, IRequestLevel } from '../models/ApprovalRequest';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { AppError } from '../utils/app-error';
import { roundMoney } from '../utils/helpers';
import { notificationService } from './NotificationService';

export interface WorkflowLevelDto {
  level?: number;
  name: string;
  approverRole?: string;
  approverUserIds?: string[];
  requiredApprovals?: number;
  skipBelowAmount?: number | null;
}

export interface WorkflowDto {
  name: string;
  entityType: ApprovalEntity;
  isActive?: boolean;
  minAmount?: number;
  maxAmount?: number | null;
  levels: WorkflowLevelDto[];
  description?: string;
}

export interface SubmitApprovalDto {
  entityType: ApprovalEntity;
  entityId: string;
  entityRef: string;
  title: string;
  amount: number;
  requestedBy?: string;
  notes?: string;
}

/**
 * Multi-tier approval workflow.
 *
 * A document is submitted once (a second submit returns the existing request),
 * then walks the configured levels. The last level's final approval triggers
 * `applyApprovalEffect` which hands control back to the owning module
 * (PO → approve, expense → post the journal, LC → open).
 */
class ApprovalService {
  /* ─────────────────────────────── workflows ─────────────────────────────── */

  async listWorkflows(options: { entityType?: string; includeInactive?: boolean } = {}) {
    const filter: Record<string, any> = {};
    if (options.entityType) filter.entityType = options.entityType;
    if (!options.includeInactive) filter.isActive = true;
    return ApprovalWorkflow.find(filter).sort({ entityType: 1, minAmount: 1 }).lean();
  }

  async getWorkflow(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid workflow ID');
    const wf = await ApprovalWorkflow.findById(id).lean();
    if (!wf) throw new AppError(404, 'WORKFLOW_NOT_FOUND', 'Approval workflow not found');
    return wf;
  }

  private normaliseLevels(levels: WorkflowLevelDto[]): IWorkflowLevel[] {
    if (!levels?.length) throw new AppError(400, 'NO_LEVELS', 'A workflow needs at least one approval level');
    return levels.map((l, i) => {
      if (!l.name?.trim()) throw new AppError(400, 'LEVEL_NAME_REQUIRED', `Level ${i + 1} needs a name`);
      if (!l.approverRole && !(l.approverUserIds || []).length) {
        throw new AppError(400, 'NO_APPROVER', `Level "${l.name}" needs a role or at least one approver`);
      }
      return {
        level: l.level || i + 1,
        name: l.name.trim(),
        approverRole: l.approverRole ? l.approverRole.toUpperCase() : undefined,
        approverUserIds: (l.approverUserIds || [])
          .filter((u) => Types.ObjectId.isValid(u))
          .map((u) => new Types.ObjectId(u)),
        requiredApprovals: Math.max(1, Number(l.requiredApprovals) || 1),
        skipBelowAmount: l.skipBelowAmount ?? null,
      } as IWorkflowLevel;
    });
  }

  async createWorkflow(dto: WorkflowDto, userId: string) {
    const levels = this.normaliseLevels(dto.levels);
    const wf = await ApprovalWorkflow.create({
      name: dto.name.trim(),
      entityType: dto.entityType,
      isActive: dto.isActive !== false,
      minAmount: Number(dto.minAmount) || 0,
      maxAmount: dto.maxAmount ?? null,
      levels,
      description: dto.description,
      createdBy: new Types.ObjectId(userId),
    });
    return wf.toObject();
  }

  async updateWorkflow(id: string, dto: Partial<WorkflowDto>) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid workflow ID');
    const wf = await ApprovalWorkflow.findById(id);
    if (!wf) throw new AppError(404, 'WORKFLOW_NOT_FOUND', 'Approval workflow not found');

    if (dto.name !== undefined) wf.name = dto.name.trim();
    if (dto.entityType !== undefined) wf.entityType = dto.entityType;
    if (dto.isActive !== undefined) wf.isActive = !!dto.isActive;
    if (dto.minAmount !== undefined) wf.minAmount = Number(dto.minAmount) || 0;
    if (dto.maxAmount !== undefined) wf.maxAmount = dto.maxAmount;
    if (dto.description !== undefined) wf.description = dto.description;
    if (dto.levels) wf.levels = this.normaliseLevels(dto.levels);

    await wf.save();
    return wf.toObject();
  }

  async removeWorkflow(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid workflow ID');
    const pending = await ApprovalRequest.countDocuments({ workflowId: id, status: 'PENDING' });
    if (pending > 0) {
      throw new AppError(
        409,
        'WORKFLOW_IN_USE',
        `${pending} request(s) are still waiting in this workflow — deactivate it instead`
      );
    }
    await ApprovalWorkflow.deleteOne({ _id: id });
    return { ok: true };
  }

  /** The active workflow covering this amount (the highest floor wins). */
  async resolveWorkflow(entityType: ApprovalEntity, amount: number) {
    const candidates = await ApprovalWorkflow.find({
      entityType,
      isActive: true,
      minAmount: { $lte: amount },
    })
      .sort({ minAmount: -1 })
      .lean();

    return (
      candidates.find((wf: any) => wf.maxAmount === null || wf.maxAmount === undefined || amount <= wf.maxAmount) ||
      null
    );
  }

  /* ─────────────────────────────── requests ──────────────────────────────── */

  /**
   * Puts a document into the approval chain. Returns null when no workflow is
   * configured for that amount — the caller then keeps its normal behaviour.
   */
  async submit(dto: SubmitApprovalDto, userId: string) {
    if (!Types.ObjectId.isValid(dto.entityId)) throw new AppError(400, 'INVALID_ID', 'Invalid entity ID');
    const amount = Number(dto.amount) || 0;

    // Re-use the live request, or an approval that already exists for this
    // document — only a rejected / cancelled chain may be started again.
    const previous = await ApprovalRequest.findOne({
      entityType: dto.entityType,
      entityId: new Types.ObjectId(dto.entityId),
      status: { $in: ['PENDING', 'APPROVED'] },
    }).sort({ createdAt: -1 });
    if (previous) return previous.toObject();

    const workflow: any = await this.resolveWorkflow(dto.entityType, amount);
    if (!workflow) return null;

    const levels: IRequestLevel[] = (workflow.levels || []).map((l: any) => ({
      level: l.level,
      name: l.name,
      approverRole: l.approverRole,
      approverUserIds: l.approverUserIds || [],
      requiredApprovals: l.requiredApprovals || 1,
      approvals: [],
      completed: false,
      skippedByAmount: false,
    }));

    // Levels cheaper than their skipBelowAmount are auto-cleared
    let currentLevel = 1;
    for (const lvl of levels) {
      const wfLevel: any = (workflow.levels || []).find((x: any) => x.level === lvl.level);
      if (wfLevel?.skipBelowAmount != null && amount < wfLevel.skipBelowAmount) {
        lvl.completed = true;
        lvl.skippedByAmount = true;
        currentLevel = lvl.level + 1;
      } else {
        break;
      }
    }

    const request = await ApprovalRequest.create({
      workflowId: workflow._id,
      workflowName: workflow.name,
      entityType: dto.entityType,
      entityId: new Types.ObjectId(dto.entityId),
      entityRef: dto.entityRef,
      title: dto.title,
      amount: roundMoney(amount),
      requestedBy: new Types.ObjectId(dto.requestedBy || userId),
      requestedAt: new Date(),
      status: 'PENDING',
      currentLevel: Math.min(currentLevel, levels.length),
      levels,
      notes: dto.notes,
    });

    // If every level was auto-skipped, finish it right away
    if (levels.every((l) => l.completed)) {
      await this.finalise(request, 'APPROVED', userId, 'Auto-approved: below the configured approval floor');
      return (await ApprovalRequest.findById(request._id).lean()) as any;
    }

    const target: any = levels.find((l) => l.level === request.currentLevel);
    notificationService.notify({
      type: 'SYSTEM',
      title: `Approval needed: ${dto.entityRef}`,
      message: `${dto.title} · ৳${roundMoney(amount).toFixed(2)} is waiting at level ${request.currentLevel} (${target?.name || ''})`,
      entityType: 'approvals',
      entityId: String(request._id),
    });

    return request.toObject();
  }

  async listRequests(options: { status?: string; entityType?: string; mine?: boolean; userId?: string; limit?: number; page?: number } = {}) {
    const filter: Record<string, any> = {};
    if (options.status) filter.status = options.status;
    if (options.entityType) filter.entityType = options.entityType;
    if (options.mine && options.userId) filter.requestedBy = new Types.ObjectId(options.userId);

    const limit = Math.min(100, options.limit || 25);
    const page = Math.max(1, options.page || 1);
    const [data, total] = await Promise.all([
      ApprovalRequest.find(filter)
        .populate('requestedBy', 'fullName username')
        .populate('decidedBy', 'fullName username')
        .sort({ status: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ApprovalRequest.countDocuments(filter),
    ]);

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getRequest(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid request ID');
    const request = await ApprovalRequest.findById(id)
      .populate('requestedBy', 'fullName username')
      .populate('decidedBy', 'fullName username')
      .lean();
    if (!request) throw new AppError(404, 'REQUEST_NOT_FOUND', 'Approval request not found');
    return request;
  }

  /**
   * The manager's inbox: everything still pending, filtered down to the levels
   * this user may act on (by role, by name, or as a platform super admin).
   */
  async getInbox(user: { userId: string; role: string; isPlatformSuperAdmin?: boolean }) {
    const requests = await ApprovalRequest.find({ status: 'PENDING' })
      .populate('requestedBy', 'fullName username')
      .sort({ requestedAt: 1 })
      .lean();

    const mine = requests.filter((r: any) => {
      const level: any = (r.levels || []).find((l: any) => l.level === r.currentLevel);
      if (!level) return false;
      if (user.isPlatformSuperAdmin) return true;
      if (level.approverUserIds?.some((u: any) => String(u) === String(user.userId))) return true;
      if (level.approverRole && level.approverRole === String(user.role).toUpperCase()) return true;
      return false;
    });

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    return {
      summary: {
        totalPending: requests.length,
        awaitingMe: mine.length,
        awaitingMeValue: round(mine.reduce((s: number, r: any) => s + (r.amount || 0), 0)),
        oldestWaitingDays: mine.length
          ? Math.max(
              ...mine.map((r: any) => Math.floor((Date.now() - new Date(r.requestedAt).getTime()) / 86400000))
            )
          : 0,
      },
      data: mine,
    };
  }

  private levelIsComplete(level: IRequestLevel): boolean {
    const approvals = (level.approvals || []).filter((a) => a.decision === 'APPROVED');
    return approvals.length >= (level.requiredApprovals || 1);
  }

  /** Approve at the current level; the final level approves the document. */
  async approve(requestId: string, userId: string, comment?: string) {
    if (!Types.ObjectId.isValid(requestId)) throw new AppError(400, 'INVALID_ID', 'Invalid request ID');
    const request = await ApprovalRequest.findById(requestId);
    if (!request) throw new AppError(404, 'REQUEST_NOT_FOUND', 'Approval request not found');
    if (request.status !== 'PENDING') {
      throw new AppError(409, 'NOT_PENDING', `This request is already ${request.status.toLowerCase()}`);
    }

    const user = await User.findById(userId).populate<{ roleId: any }>('roleId').lean();
    const roleName = (user as any)?.roleId?.name || '';
    const isSuper = !!(user as any)?.isPlatformSuperAdmin || roleName === 'SUPER_ADMIN';

    const level: any = request.levels.find((l) => l.level === request.currentLevel);
    if (!level) throw new AppError(409, 'NO_LEVEL', 'This request has no level to approve');

    const allowedByRole = !!level.approverRole && level.approverRole === String(roleName).toUpperCase();
    const allowedByName = (level.approverUserIds || []).some((u: any) => String(u) === String(userId));
    if (!isSuper && !allowedByRole && !allowedByName) {
      throw new AppError(
        403,
        'NOT_AN_APPROVER',
        `You are not an approver for level ${level.level} (${level.name})`
      );
    }

    // A rejection already decided against this level / user?
    const already = (level.approvals || []).some(
      (a: any) => String(a.by) === String(userId) && a.decision === 'APPROVED'
    );
    if (already) throw new AppError(409, 'ALREADY_APPROVED_BY_YOU', 'You have already approved this level');

    const decision = {
      by: new Types.ObjectId(userId),
      byName: (user as any)?.fullName,
      at: new Date(),
      decision: 'APPROVED' as const,
      comment,
    };
    level.approvals.push(decision);
    request.history.push(decision);

    if (this.levelIsComplete(level)) {
      level.completed = true;
      const nextLevel = request.levels.find((l) => l.level > level.level && !l.completed);
      if (nextLevel) {
        request.currentLevel = nextLevel.level;
        await request.save();
        notificationService.notify({
          type: 'SYSTEM',
          title: `Approval advanced: ${request.entityRef}`,
          message: `Level ${level.level} (${level.name}) approved — now waiting at level ${nextLevel.level} (${nextLevel.name})`,
          entityType: 'approvals',
          entityId: String(request._id),
        });
        return request.toObject();
      }

      await this.finalise(request, 'APPROVED', userId, comment);
      return (await ApprovalRequest.findById(request._id).lean()) as any;
    }

    await request.save();
    return request.toObject();
  }

  async reject(requestId: string, userId: string, comment?: string) {
    if (!Types.ObjectId.isValid(requestId)) throw new AppError(400, 'INVALID_ID', 'Invalid request ID');
    const request = await ApprovalRequest.findById(requestId);
    if (!request) throw new AppError(404, 'REQUEST_NOT_FOUND', 'Approval request not found');
    if (request.status !== 'PENDING') {
      throw new AppError(409, 'NOT_PENDING', `This request is already ${request.status.toLowerCase()}`);
    }

    const level: any = request.levels.find((l) => l.level === request.currentLevel);
    const decision = {
      by: new Types.ObjectId(userId),
      at: new Date(),
      decision: 'REJECTED' as const,
      comment,
    };
    if (level) level.approvals.push(decision);
    request.history.push(decision);

    await this.finalise(request, 'REJECTED', userId, comment);
    return (await ApprovalRequest.findById(request._id).lean()) as any;
  }

  async cancel(requestId: string, userId: string, comment?: string) {
    if (!Types.ObjectId.isValid(requestId)) throw new AppError(400, 'INVALID_ID', 'Invalid request ID');
    const request = await ApprovalRequest.findById(requestId);
    if (!request) throw new AppError(404, 'REQUEST_NOT_FOUND', 'Approval request not found');
    if (request.status !== 'PENDING') {
      throw new AppError(409, 'NOT_PENDING', `This request is already ${request.status.toLowerCase()}`);
    }
    await this.finalise(request, 'CANCELLED', userId, comment);
    return (await ApprovalRequest.findById(request._id).lean()) as any;
  }

  /** Closes the request and tells the owning module what to do. */
  private async finalise(
    request: any,
    status: 'APPROVED' | 'REJECTED' | 'CANCELLED',
    userId: string,
    comment?: string
  ) {
    request.status = status;
    request.decidedAt = new Date();
    request.decidedBy = new Types.ObjectId(userId);
    if (status === 'CANCELLED') {
      request.history.push({ by: new Types.ObjectId(userId), at: new Date(), decision: 'CANCELLED', comment });
    }
    await request.save();

    if (status === 'APPROVED') {
      await this.applyApprovalEffect(String(request.entityType), String(request.entityId), userId);
    } else if (status === 'REJECTED') {
      await this.applyRejectionEffect(String(request.entityType), String(request.entityId), userId, comment);
    }

    notificationService.notify({
      type: 'SYSTEM',
      title: `${request.entityRef} ${status.toLowerCase()}`,
      message: `${request.title} (level ${request.currentLevel}) was ${status.toLowerCase()}${comment ? ` — ${comment}` : ''}`,
      entityType: 'approvals',
      entityId: String(request._id),
      userId: String(request.requestedBy),
    });
  }

  /**
   * Hands the approval back to the module that owns the document. Imported
   * lazily so this service stays free of circular dependencies.
   */
  private async applyApprovalEffect(entityType: string, entityId: string, userId: string) {
    try {
      if (entityType === 'PURCHASE_ORDER') {
        const { purchaseOrderService } = await import('./PurchaseOrderService');
        await purchaseOrderService.approve(entityId, userId);
      } else if (entityType === 'EXPENSE') {
        const { expenseService } = await import('./ExpenseService');
        await expenseService.approveExpense(entityId, userId, true);
      } else if (entityType === 'LETTER_OF_CREDIT') {
        const { LetterOfCredit } = await import('../models/LetterOfCredit');
        const { importExportService } = await import('./ImportExportService');
        const lc: any = await LetterOfCredit.findById(entityId).lean();
        if (lc && lc.status === 'DRAFT') {
          await importExportService.updateLcStatus(entityId, 'OPENED', userId, 'Approved through the workflow');
        }
      }
    } catch (err) {
      // The approval itself is recorded — the caller can retry the action
      console.warn(`approval effect for ${entityType} ${entityId} failed:`, (err as Error).message);
    }
  }

  private async applyRejectionEffect(entityType: string, entityId: string, userId: string, comment?: string) {
    try {
      if (entityType === 'PURCHASE_ORDER') {
        const { purchaseOrderService } = await import('./PurchaseOrderService');
        await purchaseOrderService.reject(entityId, userId, comment || 'Rejected through the approval workflow');
      } else if (entityType === 'EXPENSE') {
        const { expenseService } = await import('./ExpenseService');
        await expenseService.approveExpense(entityId, userId, false, comment || 'Rejected through the approval workflow');
      }
    } catch (err) {
      console.warn(`rejection effect for ${entityType} ${entityId} failed:`, (err as Error).message);
    }
  }

  /** Pending-approvals report: how much money is stuck and for how long. */
  async getPendingReport() {
    const [pending, decided] = await Promise.all([
      ApprovalRequest.find({ status: 'PENDING' })
        .populate('requestedBy', 'fullName username')
        .sort({ requestedAt: 1 })
        .lean(),
      ApprovalRequest.find({ status: { $in: ['APPROVED', 'REJECTED'] } })
        .select('entityType status requestedAt decidedAt')
        .lean(),
    ]);

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const now = Date.now();
    const buckets = { under2Days: 0, twoTo5Days: 0, over5Days: 0 };

    const data = pending.map((r: any) => {
      const level: any = (r.levels || []).find((l: any) => l.level === r.currentLevel);
      const waitingDays = Math.floor((now - new Date(r.requestedAt).getTime()) / 86400000);
      if (waitingDays < 2) buckets.under2Days += 1;
      else if (waitingDays <= 5) buckets.twoTo5Days += 1;
      else buckets.over5Days += 1;

      return {
        id: String(r._id),
        entityType: r.entityType,
        entityRef: r.entityRef,
        title: r.title,
        amount: r.amount,
        status: r.status,
        workflowName: r.workflowName,
        currentLevel: r.currentLevel,
        levelName: level?.name || '',
        totalLevels: r.levels.length,
        requestedBy: r.requestedBy?.fullName || r.requestedBy?.username || '—',
        requestedAt: r.requestedAt,
        waitingDays,
      };
    });

    const byType: Record<string, { count: number; amount: number }> = {};
    for (const r of data) {
      byType[r.entityType] = byType[r.entityType] || { count: 0, amount: 0 };
      byType[r.entityType].count += 1;
      byType[r.entityType].amount = round(byType[r.entityType].amount + r.amount);
    }

    const decidedWithTime = decided.filter((d: any) => d.decidedAt);
    const avgDecisionDays = decidedWithTime.length
      ? round(
          decidedWithTime.reduce(
            (s: number, d: any) => s + (new Date(d.decidedAt).getTime() - new Date(d.requestedAt).getTime()) / 86400000,
            0
          ) / decidedWithTime.length
        )
      : 0;

    return {
      summary: {
        pending: data.length,
        pendingValue: round(data.reduce((s: number, r: any) => s + r.amount, 0)),
        approved: decided.filter((d: any) => d.status === 'APPROVED').length,
        rejected: decided.filter((d: any) => d.status === 'REJECTED').length,
        averageDecisionDays: avgDecisionDays,
        ageing: buckets,
        byType: Object.entries(byType).map(([entityType, v]) => ({ entityType, ...v })),
      },
      data,
    };
  }
}

export const approvalService = new ApprovalService();
