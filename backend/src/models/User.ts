import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  _id: Types.ObjectId;
  username: string; // Unique lowercase handle
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string; // bcrypt salt factor 12
  pinHash: string; // bcrypt hashed 4-digit PIN for Terminal Lock
  roleId: Types.ObjectId; // Ref: roles
  isActive: boolean;
  terminalLocked: boolean; // Quick screen lock state
  avatarUrl?: string; // Profile picture URL
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  comparePin(candidatePin: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    pinHash: {
      type: String,
      required: true,
    },
    roleId: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    terminalLocked: {
      type: Boolean,
      default: false,
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'users',
  }
);

// Indexes
UserSchema.index({ roleId: 1 });
UserSchema.index({ phone: 1 }, { unique: true });

// Pre-save hook to hash password and PIN if modified
UserSchema.pre<IUser>('save', async function (next) {
  if (this.isModified('passwordHash')) {
    if (!this.passwordHash.startsWith('$2')) {
      const salt = await bcrypt.genSalt(12);
      this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    }
  }

  if (this.isModified('pinHash')) {
    if (!this.pinHash.startsWith('$2')) {
      const salt = await bcrypt.genSalt(10);
      this.pinHash = await bcrypt.hash(this.pinHash, salt);
    }
  }

  next();
});

// Instance methods
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

UserSchema.methods.comparePin = async function (candidatePin: string): Promise<boolean> {
  return bcrypt.compare(candidatePin, this.pinHash);
};

export const User = mongoose.model<IUser>('User', UserSchema);
