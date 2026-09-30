import { Request, Response, NextFunction } from 'express';
import { branchService, BranchDto } from '../services/BranchService';
import { sendSuccess } from '../utils/api-response';

export class BranchController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branches = await branchService.list({ includeInactive: req.query.includeInactive === 'true' });
      sendSuccess(res, 200, 'Branches retrieved', branches);
    } catch (error) { next(error); }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await branchService.getById(req.params.id);
      sendSuccess(res, 200, 'Branch retrieved', branch);
    } catch (error) { next(error); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await branchService.create(req.body as BranchDto);
      sendSuccess(res, 201, 'Branch created', branch);
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branch = await branchService.update(req.params.id, req.body);
      sendSuccess(res, 200, 'Branch updated', branch);
    } catch (error) { next(error); }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await branchService.remove(req.params.id);
      sendSuccess(res, 200, 'Branch deleted', result);
    } catch (error) { next(error); }
  }

  async stats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await branchService.getStats(req.params.id);
      sendSuccess(res, 200, 'Branch stats retrieved', stats);
    } catch (error) { next(error); }
  }

  async chainDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const months = req.query.months ? parseInt(req.query.months as string) : 6;
      const data = await branchService.getChainDashboard({ months });
      sendSuccess(res, 200, 'Chain dashboard retrieved', data);
    } catch (error) { next(error); }
  }

  /** PUT /branches/:id/assign-user — body: { userId, branchId? } */
  async assignUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = String(req.body?.userId || '');
      if (!userId) {
        res.status(400).json({
          success: false,
          statusCode: 400,
          message: 'A userId is required',
          error: { code: 'MISSING_USER_ID', message: 'A userId is required', details: [] },
          timestamp: new Date().toISOString(),
        });
        return;
      }
      // branchId may be null to detach the user from any branch
      const rawBranch = req.body?.branchId !== undefined ? req.body.branchId : req.params.id;
      const branchId = rawBranch ? String(rawBranch) : null;
      const user = await branchService.assignUser(userId, branchId);
      sendSuccess(res, 200, 'User branch updated', user);
    } catch (error) { next(error); }
  }

  async productAvailability(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await branchService.getProductAvailability(req.params.productId);
      sendSuccess(res, 200, 'Product availability retrieved', data);
    } catch (error) { next(error); }
  }
}

export const branchController = new BranchController();
