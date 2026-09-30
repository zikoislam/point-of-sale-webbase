import { Request, Response, NextFunction } from 'express';
import { approvalService, WorkflowDto } from '../services/ApprovalService';
import { sendSuccess } from '../utils/api-response';

export class ApprovalController {
  /* ── workflows ─────────────────────────────────────────────────────────── */

  async listWorkflows(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await approvalService.listWorkflows({
        entityType: req.query.entityType as string,
        includeInactive: req.query.includeInactive === 'true',
      });
      sendSuccess(res, 200, 'Approval workflows retrieved', data);
    } catch (error) { next(error); }
  }

  async getWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Approval workflow retrieved', await approvalService.getWorkflow(req.params.id));
    } catch (error) { next(error); }
  }

  async createWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const wf = await approvalService.createWorkflow(req.body as WorkflowDto, req.user!.userId);
      sendSuccess(res, 201, 'Approval workflow created', wf);
    } catch (error) { next(error); }
  }

  async updateWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Approval workflow updated', await approvalService.updateWorkflow(req.params.id, req.body));
    } catch (error) { next(error); }
  }

  async removeWorkflow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Approval workflow deleted', await approvalService.removeWorkflow(req.params.id));
    } catch (error) { next(error); }
  }

  /* ── requests ──────────────────────────────────────────────────────────── */

  async listRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await approvalService.listRequests({
        status: req.query.status as string,
        entityType: req.query.entityType as string,
        mine: req.query.mine === 'true',
        userId: req.user!.userId,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 25,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
      });
      res.status(200).json({
        success: true, statusCode: 200, message: 'Approval requests retrieved',
        data: result.data,
        meta: { page: result.page, totalPages: result.totalPages, totalItems: result.total },
      });
    } catch (error) { next(error); }
  }

  async getRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Approval request retrieved', await approvalService.getRequest(req.params.id));
    } catch (error) { next(error); }
  }

  async inbox(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await approvalService.getInbox({
        userId: req.user!.userId,
        role: req.user!.role,
        isPlatformSuperAdmin: req.user!.isPlatformSuperAdmin,
      });
      sendSuccess(res, 200, 'Approval inbox retrieved', data);
    } catch (error) { next(error); }
  }

  /** Manual submission (e.g. re-submitting a rejected document). */
  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const request = await approvalService.submit(req.body, req.user!.userId);
      if (!request) {
        sendSuccess(res, 200, 'No approval workflow is configured for this amount', null);
        return;
      }
      sendSuccess(res, 201, 'Sent for approval', request);
    } catch (error) { next(error); }
  }

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await approvalService.approve(req.params.id, req.user!.userId, req.body?.comment);
      sendSuccess(res, 200, `Request ${data?.status === 'APPROVED' ? 'approved' : 'moved to the next level'}`, data);
    } catch (error) { next(error); }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await approvalService.reject(req.params.id, req.user!.userId, req.body?.comment);
      sendSuccess(res, 200, 'Request rejected', data);
    } catch (error) { next(error); }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await approvalService.cancel(req.params.id, req.user!.userId, req.body?.comment);
      sendSuccess(res, 200, 'Request cancelled', data);
    } catch (error) { next(error); }
  }

  /* ── report ────────────────────────────────────────────────────────────── */

  async pendingReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Pending approvals report generated', await approvalService.getPendingReport());
    } catch (error) { next(error); }
  }
}

export const approvalController = new ApprovalController();
