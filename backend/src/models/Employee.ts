import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IEmployee extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  employeeCode: string; // e.g. "EMP-001"
  name: string;
  phone: string;
  designation?: string; // "Salesman", "Accountant"…
  department?: string; // "Sales", "Production"…
  joinDate: Date;
  /** Optional login account — lets the employee mark their own attendance later. */
  userId?: Types.ObjectId | null;
  salary: {
    basic: number;
    allowances: Array<{ label: string; amount: number }>;
    deductions: Array<{ label: string; amount: number }>;
  };
  bankOrMfsAccount?: string;
  address?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    employeeCode: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    designation: { type: String, trim: true },
    department: { type: String, trim: true },
    joinDate: { type: Date, required: true, default: Date.now },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    salary: {
      basic: { type: Number, required: true, default: 0, min: 0 },
      allowances: {
        type: [{ label: { type: String, trim: true }, amount: { type: Number, min: 0 } }],
        default: [],
      },
      deductions: {
        type: [{ label: { type: String, trim: true }, amount: { type: Number, min: 0 } }],
        default: [],
      },
    },
    bankOrMfsAccount: { type: String, trim: true },
    address: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false, collection: 'employees' }
);

EmployeeSchema.index({ orgId: 1, employeeCode: 1 }, { unique: true });

export const Employee = mongoose.model<IEmployee>('Employee', EmployeeSchema);
