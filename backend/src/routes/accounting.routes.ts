import { Router } from 'express';
import { accountingController } from '../controllers/AccountingController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import {
  createAccountHeadSchema,
  updateAccountHeadSchema,
  createJournalSchema,
  openingBalanceSchema,
  dayBookQuerySchema,
  ledgerQuerySchema,
  statementQuerySchema,
} from '../validators/accounting.validators';

const router = Router();

// Double-entry books are an administrator concern, like the wallets they sit on.
router.use(authenticate);

// ── chart of accounts ────────────────────────────────────────────────────
router.get('/accounts', requirePermissions('accounts:view'), (req, res, next) => accountingController.chart(req, res, next));
router.post('/accounts', requirePermissions('accounts:manage'), validate(createAccountHeadSchema), (req, res, next) => accountingController.createHead(req, res, next));
router.put('/accounts/:id', requirePermissions('accounts:manage'), validate(updateAccountHeadSchema), (req, res, next) => accountingController.updateHead(req, res, next));
router.get('/accounts/:id/ledger', requirePermissions('accounts:view'), validate(ledgerQuerySchema, 'query'), (req, res, next) => accountingController.ledger(req, res, next));
router.post('/seed-chart', requirePermissions('accounts:manage'), (req, res, next) => accountingController.seedChart(req, res, next));

// ── journal / day book ───────────────────────────────────────────────────
router.get('/journal', requirePermissions('accounts:view'), validate(dayBookQuerySchema, 'query'), (req, res, next) => accountingController.dayBook(req, res, next));
router.post('/journal', requirePermissions('accounts:manage'), validate(createJournalSchema), (req, res, next) => accountingController.createJournal(req, res, next));
router.post('/journal/:id/reverse', requirePermissions('accounts:manage'), (req, res, next) => accountingController.reverseJournal(req, res, next));

// ── statements ───────────────────────────────────────────────────────────
router.get('/trial-balance', requirePermissions('accounts:view'), validate(statementQuerySchema, 'query'), (req, res, next) => accountingController.trialBalance(req, res, next));
router.get('/profit-loss', requirePermissions('reports:pnl'), validate(statementQuerySchema, 'query'), (req, res, next) => accountingController.profitLoss(req, res, next));
router.get('/balance-sheet', requirePermissions('accounts:view'), validate(statementQuerySchema, 'query'), (req, res, next) => accountingController.balanceSheet(req, res, next));
router.get('/cash-flow', requirePermissions('accounts:view'), validate(statementQuerySchema, 'query'), (req, res, next) => accountingController.cashFlow(req, res, next));

// ── opening balances ─────────────────────────────────────────────────────
router.post('/opening-balances', requirePermissions('accounts:manage'), validate(openingBalanceSchema), (req, res, next) => accountingController.postOpening(req, res, next));

export default router;
