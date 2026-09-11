import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISupplier extends Document {
  _id: Types.ObjectId;
  companyName: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  currentPayableBalance: number; // Money shop owes to vendor
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    contactPerson: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    currentPayableBalance: {
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
    collection: 'suppliers',
  }
);

// Indexes
SupplierSchema.index({ companyName: 1 });

export const Supplier = mongoose.model<ISupplier>('Supplier', SupplierSchema);
