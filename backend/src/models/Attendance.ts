import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAttendance extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  employeeId: Types.ObjectId; // Ref: employees
  date: string; // "YYYY-MM-DD"
  status: 'PRESENT' | 'ABSENT' | 'LEAVE' | 'HALF_DAY' | 'LATE';
  checkIn?: Date;
  checkOut?: Date;
  notes?: string;
  markedById: Types.ObjectId; // Ref: users
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema = new Schema<IAttendance>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    date: { type: String, required: true, match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'] },
    status: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'LEAVE', 'HALF_DAY', 'LATE'],
      required: true,
    },
    checkIn: { type: Date },
    checkOut: { type: Date },
    notes: { type: String, trim: true },
    markedById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false, collection: 'attendance' }
);

// One attendance record per employee per day
AttendanceSchema.index({ orgId: 1, employeeId: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model<IAttendance>('Attendance', AttendanceSchema);
