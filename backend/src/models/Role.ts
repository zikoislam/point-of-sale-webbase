import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRole extends Document {
  _id: Types.ObjectId;
  name: string; // "SUPER_ADMIN" | "BRANCH_MANAGER" | "CASHIER"
  displayName: string;
  permissions: string[]; // e.g. ["pos:checkout", "inv:view", "inv:adjust", "reports:pnl"]
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'roles',
  }
);

export const Role = mongoose.model<IRole>('Role', RoleSchema);
