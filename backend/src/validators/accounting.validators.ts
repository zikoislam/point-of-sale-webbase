import { z } from 'zod';
import { ACCOUNT_SUB_TYPES, ACCOUNT_TYPES } from '../models/Account';
import { JOURNAL_SOURCES } from '../models/JournalEntry';

const objectId = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const createAccountHeadSchema = z.object({
  code: z.string().trim().min(3).max(12),
  name: z.string().trim().min(1).max(120),
  type: z.enum(ACCOUNT_TYPES),
  subType: z.enum(ACCOUNT_SUB_TYPES),
  normalBalance: z.enum(['DEBIT', 'CREDIT']).optional(),
  accountNumber: z.string().trim().max(60).optional(),
  openingBalance: z.coerce.number().min(0).optional(),
  isCashEquivalent: z.boolean().optional(),
});

export const updateAccountHeadSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  accountNumber: z.string().trim().max(60).optional(),
  isActive: z.boolean().optional(),
  openingBalance: z.coerce.number().min(0).optional(),
});

export const journalLineSchema = z
  .object({
    accountId: objectId.optional(),
    accountCode: z.string().trim().optional(),
    debit: z.coerce.number().min(0).optional(),
    credit: z.coerce.number().min(0).optional(),
    memo: z.string().trim().max(200).optional(),
  })
  .refine((l) => !!l.accountId || !!l.accountCode, { message: 'Each line needs an account' })
  .refine((l) => (l.debit || 0) > 0 || (l.credit || 0) > 0, { message: 'Each line needs a debit or a credit' })
  .refine((l) => !((l.debit || 0) > 0 && (l.credit || 0) > 0), { message: 'A line cannot be both debit and credit' });

export const createJournalSchema = z.object({
  date: z.string().trim().optional(),
  narration: z.string().trim().min(3).max(250),
  source: z.enum(JOURNAL_SOURCES).optional().default('MANUAL'),
  referenceType: z.string().trim().max(60).optional(),
  referenceId: objectId.optional(),
  lines: z.array(journalLineSchema).min(2, 'A voucher needs at least two lines'),
});

export const openingBalanceSchema = z.object({
  accountId: objectId,
  amount: z.coerce.number().min(0.01, 'Opening balance must be greater than zero'),
  date: z.string().trim().optional(),
});

export const dayBookQuerySchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  source: z.enum(JOURNAL_SOURCES).optional(),
  accountId: objectId.optional(),
  referenceId: objectId.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export const ledgerQuerySchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export const statementQuerySchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  asOf: z.string().trim().optional(),
});
