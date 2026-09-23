import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * The chart of accounts.
 *
 * Money-holding heads (cash / bank / MFS) are the wallets the POS already used —
 * they keep `accountType` and `currentBalance` so every existing flow (payments,
 * shifts, expenses) keeps working. The remaining heads turn the same collection
 * into a full accounting chart, posted to only through AccountingService.
 */
export const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_SUB_TYPES = [
  // ASSET
  'CASH',
  'BANK',
  'MFS',
  'RECEIVABLE',
  'INVENTORY',
  'FIXED_ASSET',
  'OTHER_ASSET',
  // LIABILITY
  'PAYABLE',
  'LOAN',
  'TAX',
  'STORE_CREDIT',
  'OTHER_LIABILITY',
  // EQUITY
  'CAPITAL',
  'DRAWINGS',
  'RETAINED',
  'OPENING_EQUITY',
  // INCOME
  'SALES',
  'SALES_RETURN',
  'OTHER_INCOME',
  // EXPENSE
  'COGS',
  'OPERATING',
  'WASTAGE',
  'OTHER_EXPENSE',
] as const;
export type AccountSubType = (typeof ACCOUNT_SUB_TYPES)[number];

export interface IAccount extends Document {
  _id: Types.ObjectId;
  /** Ledger code, e.g. "1010". Optional on legacy rows, required on new heads. */
  code?: string;
  name: string; // e.g. "Cash Drawer 1", "bKash Merchant", "City Bank A/C"
  accountType: 'CASH' | 'BANK' | 'MFS' | 'OTHER'; // kept — read by the POS payment flows
  type: AccountType;
  subType: AccountSubType;
  /** True for cash / bank / MFS — the accounts a payment can settle into. */
  isCashEquivalent: boolean;
  /** Seeded heads cannot be deleted or re-typed. */
  isSystem: boolean;
  /** Which side increases this head. */
  normalBalance: 'DEBIT' | 'CREDIT';
  openingBalance: number;
  /**
   * Balance in the head's own natural direction: an asset shows a positive
   * number when it holds value, a loan shows what is owed.
   */
  currentBalance: number;
  accountNumber?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    code: {
      type: String,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    accountType: {
      type: String,
      enum: ['CASH', 'BANK', 'MFS', 'OTHER'],
      default: 'OTHER',
      required: true,
    },
    type: {
      type: String,
      enum: ACCOUNT_TYPES,
      default: 'ASSET',
      required: true,
    },
    subType: {
      type: String,
      enum: ACCOUNT_SUB_TYPES,
      default: 'OTHER_ASSET',
      required: true,
    },
    isCashEquivalent: {
      type: Boolean,
      default: false,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    normalBalance: {
      type: String,
      enum: ['DEBIT', 'CREDIT'],
      default: 'DEBIT',
      required: true,
    },
    openingBalance: {
      type: Number,
      default: 0,
    },
    currentBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    accountNumber: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'accounts',
  }
);

// Indexes
AccountSchema.index({ code: 1 }, { unique: true, sparse: true });
AccountSchema.index({ accountType: 1 });
AccountSchema.index({ type: 1, subType: 1 });
AccountSchema.index({ isCashEquivalent: 1 });

export const Account = mongoose.model<IAccount>('Account', AccountSchema);
