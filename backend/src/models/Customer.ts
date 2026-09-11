import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICustomer extends Document {
  _id: Types.ObjectId;
  name: string;
  phone: string; // Unique Index
  email?: string;
  address?: string;
  creditLimit: number; // Maximum allowed due balance
  currentDueBalance: number; // Outstanding debt
  loyaltyPoints: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
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
    creditLimit: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    currentDueBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    loyaltyPoints: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'customers',
  }
);

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);
