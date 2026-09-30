import { Request, Response, NextFunction } from 'express';
import { stockTransferService, CreateStockTransferDto } from '../services/StockTransferService';
import { sendSuccess } from '../utils/api-response';

export class StockTransferController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await stockTransferService.list({
        status: req.query.status as string,
        approvalStatus: req.query.approvalStatus as string,
        branchId: req.query.branchId as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
      });
      res.status(200).json({
        success: true,
        statusCode: 200,
        message: 'Stock transfers retrieved',
        data: result.data,
        meta: { page: result.page, totalPages: result.totalPages, totalItems: result.total },
      });
    } catch (error) { next(error); }
  }

  /** Destination branch board: approved issues on their way here. */
  async incoming(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await stockTransferService.listIncoming({
        branchId: (req.query.branchId as string) || req.user!.branchId,
        includeReceived: req.query.includeReceived === 'true',
      });
      sendSuccess(res, 200, 'Incoming stock retrieved', data);
    } catch (error) { next(error); }
  }

  /** Manager approval queue. */
  async pendingApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Pending issue requests retrieved', await stockTransferService.listPendingApproval());
    } catch (error) { next(error); }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transfer = await stockTransferService.getById(req.params.id);
      sendSuccess(res, 200, 'Stock transfer retrieved', transfer);
    } catch (error) { next(error); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transfer = await stockTransferService.create(
        req.body as CreateStockTransferDto,
        req.user!.userId,
        req.user!.role
      );
      const isApproved = (transfer as any)?.approvalStatus === 'APPROVED';
      sendSuccess(
        res,
        201,
        isApproved
          ? 'Stock issued — the destination branch now sees it as incoming'
          : 'Issue request sent for manager approval',
        transfer
      );
    } catch (error) { next(error); }
  }

  /** Manager approves the issue request — the goods leave the source branch. */
  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transfer = await stockTransferService.approve(
        req.params.id,
        req.user!.userId,
        req.body?.note,
        req.user!.role
      );
      sendSuccess(res, 200, 'Issue request approved and dispatched', transfer);
    } catch (error) { next(error); }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transfer = await stockTransferService.reject(
        req.params.id,
        req.user!.userId,
        req.body?.reason,
        req.user!.role
      );
      sendSuccess(res, 200, 'Issue request rejected', transfer);
    } catch (error) { next(error); }
  }

  async send(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transfer = await stockTransferService.send(req.params.id, req.user!.userId);
      sendSuccess(res, 200, 'Stock transfer dispatched', transfer);
    } catch (error) { next(error); }
  }

  async receive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transfer = await stockTransferService.receive(req.params.id, req.body?.items || [], req.user!.userId);
      sendSuccess(res, 200, 'Stock transfer received', transfer);
    } catch (error) { next(error); }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const transfer = await stockTransferService.cancel(req.params.id, req.user!.userId, req.body?.reason);
      sendSuccess(res, 200, 'Stock transfer cancelled', transfer);
    } catch (error) { next(error); }
  }
}

export const stockTransferController = new StockTransferController();
