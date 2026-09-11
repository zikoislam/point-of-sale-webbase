import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAccount extends Document {
  _id: Types.ObjectId;
  name: string; // e.g. "Cash Drawer 1", "bKash Merchant", "City Bank A/C"
  accountType: 'CASH' | 'BANK' | 'MFS';
  accountNumber?: string;
  currentBalance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    accountType: {
      type: String,
      enum: ['CASH', 'BANK', 'MFS'],
      required: true,
    },
    accountNumber: {
      type: String,
      trim: true,
    },
    currentBalance: {
      type: Number,
      required: true,
      default: 0,
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
AccountSchema.index({ accountType: 1 });

export const Account = mongoose.model<IAccount>('Account', AccountSchema);
