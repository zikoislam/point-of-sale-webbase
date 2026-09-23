import { Router } from 'express';
import { accountingController } from '../controllers/AccountingController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions, requireSuperAdmin } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import {
  createAccountHeadSchema,
  updateAccountHeadSchema,
  createJournalSchema,
  openingBalanceSchema,
  dayBookQuerySchema,
  ledgerQuerySchema,
  statementQuerySchema,
  yearCloseSchema,
} from '../validators/accounting.validators';

const router = Router();

router.use(authenticate);

// ── reading the books (admin) ───────────────────────────────────────────
router.get('/accounts', requirePermissions('accounts:view'), (req, res, next) => accountingController.chart(req, res, next));
router.get('/accounts/:id/ledger', requirePermissions('accounts:view'), validate(ledgerQuerySchema, 'query'), (req, res, next) => accountingController.ledger(req, res, next));
router.get('/journal', requirePermissions('accounts:view'), validate(dayBookQuerySchema, 'query'), (req, res, next) => accountingController.dayBook(req, res, next));
router.get('/trial-balance', requirePermissions('accounts:view'), validate(statementQuerySchema, 'query'), (req, res, next) => accountingController.trialBalance(req, res, next));
router.get('/profit-loss', requirePermissions('reports:pnl'), validate(statementQuerySchema, 'query'), (req, res, next) => accountingController.profitLoss(req, res, next));
router.get('/balance-sheet', requirePermissions('accounts:view'), validate(statementQuerySchema, 'query'), (req, res, next) => accountingController.balanceSheet(req, res, next));
router.get('/cash-flow', requirePermissions('accounts:view'), validate(statementQuerySchema, 'query'), (req, res, next) => accountingController.cashFlow(req, res, next));
router.get('/period-status', requirePermissions('accounts:view'), (req, res, next) => accountingController.periodStatus(req, res, next));

// ── writing the books (Super Admin only) ────────────────────────────────
// These move the numbers the whole business reports on, so they are gated on
// the role itself rather than on a permission a custom role could be granted.
router.post('/accounts', requireSuperAdmin, validate(createAccountHeadSchema), (req, res, next) => accountingController.createHead(req, res, next));
router.put('/accounts/:id', requireSuperAdmin, validate(updateAccountHeadSchema), (req, res, next) => accountingController.updateHead(req, res, next));
router.post('/seed-chart', requireSuperAdmin, (req, res, next) => accountingController.seedChart(req, res, next));

router.post('/journal', requireSuperAdmin, validate(createJournalSchema), (req, res, next) => accountingController.createJournal(req, res, next));
router.post('/journal/:id/reverse', requireSuperAdmin, (req, res, next) => accountingController.reverseJournal(req, res, next));

router.post('/opening-balances', requireSuperAdmin, validate(openingBalanceSchema), (req, res, next) => accountingController.postOpening(req, res, next));

router.post('/year-close', requireSuperAdmin, validate(yearCloseSchema), (req, res, next) => accountingController.yearClose(req, res, next));
router.post('/reopen-books', requireSuperAdmin, (req, res, next) => accountingController.reopenBooks(req, res, next));

export default router;
