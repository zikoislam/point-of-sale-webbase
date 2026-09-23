import { Request, Response, NextFunction } from 'express';
import { accountingService } from '../services/AccountingService';
import { Account } from '../models/Account';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../utils/app-error';
import { Types } from 'mongoose';

class AccountingController {
  // ───────────────────────────────────────────────────────── chart ──

  async chart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accounts = await accountingService.listChart();
      sendSuccess(res, 200, 'Chart of accounts retrieved', accounts);
    } catch (error) {
      next(error);
    }
  }

  async createHead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { openingBalance, ...head } = req.body;
      const exists = await Account.findOne({ code: String(head.code).toUpperCase() }).lean();
      if (exists) throw new AppError(409, 'DUPLICATE_CODE', 'An account with this code already exists');

      const account = await Account.create({
        ...head,
        code: String(head.code).toUpperCase(),
        openingBalance: Number(openingBalance) || 0,
        isSystem: false,
      });

      if (Number(openingBalance) > 0) {
        await accountingService.postOpeningVoucher(String(account._id), Number(openingBalance), req.user!.userId);
      }

      sendSuccess(res, 201, 'Account head created', account.toObject());
    } catch (error) {
      next(error);
    }
  }

  async updateHead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const account = await Account.findById(req.params.id).lean();
      if (!account) throw new AppError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');

      const patch: Record<string, any> = {};
      for (const key of ['name', 'accountNumber', 'isActive']) {
        if (req.body[key] !== undefined) patch[key] = req.body[key];
      }
      // A seeded head keeps its identity — only its label may change.
      if (Object.keys(patch).length === 0) throw new AppError(400, 'NOTHING_TO_UPDATE', 'No change supplied');

      const updated = await Account.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true, runValidators: true }).lean();
      sendSuccess(res, 200, 'Account updated', updated);
    } catch (error) {
      next(error);
    }
  }

  async seedChart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await accountingService.seedChart();
      sendSuccess(res, 200, `Chart of accounts ready (${result.created} created, ${result.adopted} adopted)`, result);
    } catch (error) {
      next(error);
    }
  }

  // ─────────────────────────────────────────────────────── journal ──

  async dayBook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = req.query as any;
      const result = await accountingService.getDayBook({
        from: q.from,
        to: q.to,
        source: q.source,
        accountId: q.accountId,
        referenceId: q.referenceId,
        page: Number(q.page) || 1,
        limit: Number(q.limit) || 50,
      });
      sendSuccess(res, 200, 'Journal retrieved', result.data, {
        page: result.page,
        limit: Number(q.limit) || 50,
        totalItems: result.total,
        totalPages: result.totalPages,
      });
    } catch (error) {
      next(error);
    }
  }

  async createJournal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entry = await accountingService.postJournal({
        ...req.body,
        createdById: req.user!.userId,
      });
      sendSuccess(res, 201, `Voucher ${entry.entryNo} posted`, entry);
    } catch (error) {
      next(error);
    }
  }

  async reverseJournal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entry = await accountingService.reverseEntry(req.params.id, req.user!.userId);
      sendSuccess(res, 200, `Reversal ${entry.entryNo} posted`, entry);
    } catch (error) {
      next(error);
    }
  }

  // ──────────────────────────────────────────────────────── ledger ──

  async ledger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = req.query as any;
      const result = await accountingService.getLedger(req.params.id, { from: q.from, to: q.to });
      sendSuccess(res, 200, 'Account ledger retrieved', result);
    } catch (error) {
      next(error);
    }
  }

  // ───────────────────────────────────────────────────── statements ──

  async trialBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = req.query as any;
      sendSuccess(res, 200, 'Trial balance retrieved', await accountingService.getTrialBalance(q.from, q.to));
    } catch (error) {
      next(error);
    }
  }

  async profitLoss(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = req.query as any;
      sendSuccess(res, 200, 'Profit & Loss retrieved', await accountingService.getProfitAndLoss(q.from, q.to));
    } catch (error) {
      next(error);
    }
  }

  async balanceSheet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = req.query as any;
      sendSuccess(res, 200, 'Balance sheet retrieved', await accountingService.getBalanceSheet(q.asOf));
    } catch (error) {
      next(error);
    }
  }

  async cashFlow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = req.query as any;
      sendSuccess(res, 200, 'Cash flow retrieved', await accountingService.getCashFlow(q.from, q.to));
    } catch (error) {
      next(error);
    }
  }

  // ─────────────────────────────────────────────────────── openings ──

  async postOpening(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { accountId, amount, date } = req.body;
      const entry = await accountingService.postOpeningVoucher(accountId, amount, req.user!.userId, date);
      await Account.updateOne({ _id: new Types.ObjectId(accountId) }, { $set: { openingBalance: Number(amount) } });
      sendSuccess(res, 201, `Opening balance posted (${entry.entryNo})`, entry);
    } catch (error) {
      next(error);
    }
  }

  // ─────────────────────────────────────────────────── year closing ──

  /** Which day the books are locked up to, so the UI can show the state. */
  async periodStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { Settings } = await import('../models/Settings');
      const settings = await Settings.findOne().select('booksClosedUpTo').lean();
      sendSuccess(res, 200, 'Period status retrieved', {
        booksClosedUpTo: settings?.booksClosedUpTo || null,
      });
    } catch (error) {
      next(error);
    }
  }

  async yearClose(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await accountingService.closeYear(req.body.asOf, req.user!.userId);
      sendSuccess(res, 201, `Year closed — voucher ${result.entryNo}`, result);
    } catch (error) {
      next(error);
    }
  }

  async reopenBooks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await accountingService.reopenBooks();
      sendSuccess(res, 200, `Books reopened up to ${result.reopenedUpTo}`, result);
    } catch (error) {
      next(error);
    }
  }
}

export const accountingController = new AccountingController();
