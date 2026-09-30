import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRole extends Document {
  _id: Types.ObjectId;
  name: string; // "SUPER_ADMIN" | "ADMIN" | "BRANCH_MANAGER" | "CASHIER"
  displayName: string;
  permissions: string[]; // e.g. ["pos:checkout", "inv:view", "inv:adjust", "reports:pnl"]
  /**
   * null → platform-level template (SUPER_ADMIN, or org role templates used
   * when provisioning new organizations). Set → the role belongs to one org.
   */
  orgId: Types.ObjectId | null;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: true,
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
    orgId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
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

RoleSchema.index({ orgId: 1, name: 1 }, { unique: true });

export const Role = mongoose.model<IRole>('Role', RoleSchema);
