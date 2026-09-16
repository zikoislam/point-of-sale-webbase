import { Request, Response, NextFunction } from 'express';
import { customerService } from '../services/CustomerService';
import { sendSuccess } from '../utils/api-response';

class CustomerController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string | undefined;
      const result = await customerService.list(page, limit, search);
      sendSuccess(res, 200, 'Customers fetched', result);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const customer = await customerService.getById(req.params.id);
      sendSuccess(res, 200, 'Customer fetched', customer);
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const customer = await customerService.create(req.body);
      sendSuccess(res, 201, 'Customer created', customer);
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const customer = await customerService.update(req.params.id, req.body);
      sendSuccess(res, 200, 'Customer updated', customer);
    } catch (err) { next(err); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await customerService.delete(req.params.id);
      sendSuccess(res, 200, 'Customer deleted');
    } catch (err) { next(err); }
  }

  async getLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 30;
      const result = await customerService.getLedger(req.params.id, page, limit);
      sendSuccess(res, 200, 'Customer ledger fetched', result);
    } catch (err) { next(err); }
  }

  async collectPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user._id.toString();
      const result = await customerService.collectDuePayment(req.params.id, req.body, userId);
      sendSuccess(res, 200, 'Payment collected successfully', result);
    } catch (err) { next(err); }
  }

  async editLedger(req: Request, res: Response, next: NextFunction) {
    try {
      // Additional safety check, although route should be protected by middleware
      if ((req as any).user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ success: false, message: 'Only super admin can edit ledger entries' });
      }
      const result = await customerService.editLedgerEntry(req.params.id, req.params.ledgerId, req.body);
      sendSuccess(res, 200, 'Ledger entry updated successfully', result);
    } catch (err) { next(err); }
  }
}

export const customerController = new CustomerController();
