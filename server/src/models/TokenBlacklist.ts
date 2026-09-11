import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITokenBlacklist extends Document {
  _id: Types.ObjectId;
  tokenHash: string; // SHA-256 hash of revoked JWT
  userId: Types.ObjectId; // Ref: users
  expiresAt: Date; // Exact expiration timestamp of original JWT
  createdAt: Date;
}

const TokenBlacklistSchema = new Schema<ITokenBlacklist>(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: 'token_blacklist',
  }
);

// TTL Index to automatically delete expired tokens
TokenBlacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TokenBlacklist = mongoose.model<ITokenBlacklist>('TokenBlacklist', TokenBlacklistSchema);
