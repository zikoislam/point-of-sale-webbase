import { Request, Response, NextFunction } from 'express';
import { supplierService } from '../services/SupplierService';
import { sendSuccess } from '../utils/api-response';

class SupplierController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string | undefined;
      const activeOnly = req.query.activeOnly === 'true';
      const result = await supplierService.list(page, limit, search, activeOnly);
      sendSuccess(res, 200, 'Suppliers fetched', result);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const supplier = await supplierService.getById(req.params.id);
      sendSuccess(res, 200, 'Supplier fetched', supplier);
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const supplier = await supplierService.create(req.body);
      sendSuccess(res, 201, 'Supplier created', supplier);
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const supplier = await supplierService.update(req.params.id, req.body);
      sendSuccess(res, 200, 'Supplier updated', supplier);
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await supplierService.delete(req.params.id);
      sendSuccess(res, 200, 'Supplier deleted');
    } catch (err) { next(err); }
  }

  async getLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 30;
      const result = await supplierService.getLedger(req.params.id, page, limit);
      sendSuccess(res, 200, 'Supplier ledger fetched', result);
    } catch (err) { next(err); }
  }

  async payDue(req: Request, res: Response, next: NextFunction) {
    try {
      const recordedById = (req as any).user?._id || (req as any).user?.id;
      const ledgerEntry = await supplierService.payDue(req.params.id, req.body, recordedById);
      sendSuccess(res, 200, 'Supplier due payment recorded successfully', ledgerEntry);
    } catch (err) { next(err); }
  }
}

export const supplierController = new SupplierController();
