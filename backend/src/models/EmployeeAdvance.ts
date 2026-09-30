import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAdvanceRecovery {
  payrollRunId?: Types.ObjectId;
  amount: number;
  date: Date;
}

/** Money given to an employee ahead of salary, recovered from payroll. */
export interface IEmployeeAdvance extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  employeeId: Types.ObjectId; // Ref: employees
  amount: number;
  reason?: string;
  date: Date;
  recoveries: IAdvanceRecovery[];
  accountId?: Types.ObjectId | null; // wallet the advance was paid from
  createdById: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AdvanceRecoverySchema = new Schema<IAdvanceRecovery>(
  {
    payrollRunId: { type: Schema.Types.ObjectId, ref: 'PayrollRun' },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const EmployeeAdvanceSchema = new Schema<IEmployeeAdvance>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    reason: { type: String, trim: true },
    date: { type: Date, required: true, default: Date.now },
    recoveries: { type: [AdvanceRecoverySchema], default: [] },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', default: null },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'employee_advances' }
);

export const EmployeeAdvance = mongoose.model<IEmployeeAdvance>('EmployeeAdvance', EmployeeAdvanceSchema);
