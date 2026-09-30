import { Types } from 'mongoose';
import { Project, PROJECT_STATUSES, IProject } from '../models/Project';
import { Sale } from '../models/Sale';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { Expense } from '../models/Expense';
import { AppError } from '../utils/app-error';
import { roundMoney } from '../utils/helpers';
import { nextSequence } from './SequenceService';

export interface ProjectDto {
  name: string;
  description?: string;
  customerId?: string | null;
  managerId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number;
  status?: (typeof PROJECT_STATUSES)[number];
  tags?: string[];
}

/**
 * Projects are the job-costing dimension: sales give revenue, purchase orders
 * and expenses give the cost, and the difference is the project's profit.
 */
class ProjectService {
  private async generateCode(): Promise<string> {
    const year = new Date().getFullYear();
    const seq = await nextSequence(`project_seq_${year}`);
    return `PRJ-${year}-${String(seq).padStart(4, '0')}`;
  }

  async list(options: { status?: string; search?: string; includeTotals?: boolean } = {}) {
    const filter: Record<string, any> = {};
    if (options.status) filter.status = options.status;
    if (options.search) {
      const rx = new RegExp(options.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { code: rx }];
    }

    const projects = await Project.find(filter)
      .populate('customerId', 'name phone')
      .populate('managerId', 'fullName username')
      .sort({ createdAt: -1 })
      .lean();

    if (options.includeTotals === false) return projects;

    // One pass per source, then merge onto the projects
    const ids = projects.map((p: any) => p._id);
    const [salesAgg, poAgg, expenseAgg] = await Promise.all([
      Sale.aggregate([
        { $match: { projectId: { $in: ids } } },
        { $group: { _id: '$projectId', revenue: { $sum: '$totalAmount' }, invoices: { $sum: 1 }, due: { $sum: '$dueAmount' } } },
      ]),
      PurchaseOrder.aggregate([
        { $match: { projectId: { $in: ids }, status: { $ne: 'CANCELLED' } } },
        { $group: { _id: '$projectId', cost: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
      ]),
      Expense.aggregate([
        { $match: { projectId: { $in: ids }, status: 'APPROVED' } },
        { $group: { _id: '$projectId', cost: { $sum: '$amount' }, entries: { $sum: 1 } } },
      ]),
    ]);

    const salesMap = new Map(salesAgg.map((s: any) => [String(s._id), s]));
    const poMap = new Map(poAgg.map((p: any) => [String(p._id), p]));
    const expMap = new Map(expenseAgg.map((e: any) => [String(e._id), e]));

    return projects.map((p: any) => {
      const rev: any = salesMap.get(String(p._id)) || {};
      const po: any = poMap.get(String(p._id)) || {};
      const exp: any = expMap.get(String(p._id)) || {};
      const revenue = roundMoney(rev.revenue || 0);
      const purchaseCost = roundMoney(po.cost || 0);
      const expenseCost = roundMoney(exp.cost || 0);
      const totalCost = roundMoney(purchaseCost + expenseCost);
      return {
        ...p,
        revenue,
        invoices: rev.invoices || 0,
        due: roundMoney(rev.due || 0),
        purchaseCost,
        expenseCost,
        totalCost,
        profit: roundMoney(revenue - totalCost),
        marginPercent: revenue > 0 ? Math.round(((revenue - totalCost) / revenue) * 1000) / 10 : 0,
        budgetUsedPercent: p.budget > 0 ? Math.round((totalCost / p.budget) * 1000) / 10 : null,
      };
    });
  }

  async getById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid project ID');
    const project = await Project.findById(id)
      .populate('customerId', 'name phone address')
      .populate('managerId', 'fullName username')
      .lean();
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

    const [sales, pos, expenses] = await Promise.all([
      Sale.find({ projectId: project._id })
        .select('invoiceNo totalAmount dueAmount createdAt pricingTier')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      PurchaseOrder.find({ projectId: project._id })
        .select('poNumber totalAmount status supplierId createdAt')
        .populate('supplierId', 'companyName')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Expense.find({ projectId: project._id })
        .select('amount description status createdAt categoryId')
        .populate('categoryId', 'name')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    return { ...project, sales, purchaseOrders: pos, expenses };
  }

  async create(dto: ProjectDto, userId: string) {
    if (!dto.name?.trim()) throw new AppError(400, 'NAME_REQUIRED', 'Project name is required');
    const code = await this.generateCode();

    const project = await Project.create({
      code,
      name: dto.name.trim(),
      description: dto.description,
      customerId: dto.customerId || null,
      managerId: dto.managerId || null,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      budget: Number(dto.budget) || 0,
      status: dto.status || 'PLANNED',
      tags: (dto.tags || []).map((t) => String(t).trim()).filter(Boolean),
      createdBy: new Types.ObjectId(userId),
    });
    return project.toObject() as unknown as IProject;
  }

  async update(id: string, dto: Partial<ProjectDto>) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid project ID');
    const project = await Project.findById(id);
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

    if (dto.name !== undefined) project.name = dto.name.trim();
    if (dto.description !== undefined) project.description = dto.description;
    if (dto.customerId !== undefined) project.customerId = dto.customerId ? new Types.ObjectId(dto.customerId) : null;
    if (dto.managerId !== undefined) project.managerId = dto.managerId ? new Types.ObjectId(dto.managerId) : null;
    if (dto.startDate !== undefined) project.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.endDate !== undefined) project.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.budget !== undefined) project.budget = Number(dto.budget) || 0;
    if (dto.status !== undefined) project.status = dto.status;
    if (dto.tags !== undefined) project.tags = dto.tags.map((t) => String(t).trim()).filter(Boolean);

    await project.save();
    return project.toObject();
  }

  /** A project that already carries transactions must not vanish. */
  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid project ID');
    const project = await Project.findById(id).lean();
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

    const oid = new Types.ObjectId(id);
    const [sales, pos, expenses] = await Promise.all([
      Sale.countDocuments({ projectId: oid }),
      PurchaseOrder.countDocuments({ projectId: oid }),
      Expense.countDocuments({ projectId: oid }),
    ]);
    if (sales + pos + expenses > 0) {
      throw new AppError(
        409,
        'PROJECT_IN_USE',
        `This project has ${sales} sale(s), ${pos} purchase order(s) and ${expenses} expense(s). Mark it completed or cancelled instead.`
      );
    }

    await Project.deleteOne({ _id: oid });
    return { ok: true };
  }

  /** Project-wise profit & loss across every project (or a single one). */
  async getProfitAndLoss(projectId?: string) {
    const projects = await this.list({
      ...(projectId ? {} : {}),
    });
    const rows = projectId
      ? (projects as any[]).filter((p) => String(p._id) === String(projectId))
      : (projects as any[]);

    if (projectId && rows.length === 0) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found');

    const round = (n: number) => Math.round((n || 0) * 100) / 100;
    const summary = rows.reduce(
      (acc: any, p: any) => ({
        projects: acc.projects + 1,
        revenue: round(acc.revenue + (p.revenue || 0)),
        purchases: round(acc.purchases + (p.purchaseCost || 0)),
        expenses: round(acc.expenses + (p.expenseCost || 0)),
        cost: round(acc.cost + (p.totalCost || 0)),
        profit: round(acc.profit + (p.profit || 0)),
        budget: round(acc.budget + (p.budget || 0)),
        due: round(acc.due + (p.due || 0)),
      }),
      { projects: 0, revenue: 0, purchases: 0, expenses: 0, cost: 0, profit: 0, budget: 0, due: 0 }
    );

    return {
      summary: {
        ...summary,
        overallMarginPercent: summary.revenue > 0 ? Math.round((summary.profit / summary.revenue) * 1000) / 10 : 0,
        budgetUtilisationPercent: summary.budget > 0 ? Math.round((summary.cost / summary.budget) * 1000) / 10 : null,
        lossMakingProjects: rows.filter((p: any) => (p.profit || 0) < 0).length,
      },
      data: rows.map((p: any) => ({
        projectId: String(p._id),
        code: p.code,
        name: p.name,
        status: p.status,
        customerName: p.customerId?.name || '—',
        managerName: p.managerId?.fullName || '—',
        budget: p.budget || 0,
        revenue: p.revenue || 0,
        purchases: p.purchaseCost || 0,
        expenses: p.expenseCost || 0,
        totalCost: p.totalCost || 0,
        profit: p.profit || 0,
        marginPercent: p.marginPercent || 0,
        budgetUsedPercent: p.budgetUsedPercent,
        due: p.due || 0,
      })),
    };
  }
}

export const projectService = new ProjectService();
