import { Request, Response, NextFunction } from 'express';
import { accountService } from '../services/AccountService';
import { sendSuccess } from '../utils/api-response';

class AccountController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const accounts = await accountService.list();
      sendSuccess(res, 200, 'Accounts fetched', accounts);
    } catch (err) { next(err); }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await accountService.getById(req.params.id);
      sendSuccess(res, 200, 'Account fetched', account);
    } catch (err) { next(err); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await accountService.create(req.body);
      sendSuccess(res, 201, 'Account created', account);
    } catch (err) { next(err); }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const account = await accountService.update(req.params.id, req.body);
      sendSuccess(res, 200, 'Account updated', account);
    } catch (err) { next(err); }
  }

  async transfer(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user._id.toString();
      const result = await accountService.transferFunds(req.body, userId);
      sendSuccess(res, 200, 'Funds transferred successfully', result);
    } catch (err) { next(err); }
  }

  async getLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 30;
      const ledger = await accountService.getLedger(req.params.id, page, limit);
      sendSuccess(res, 200, 'Account ledger fetched', ledger);
    } catch (err) { next(err); }
  }
}

export const accountController = new AccountController();
