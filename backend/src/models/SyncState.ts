import mongoose, { Schema } from 'mongoose';

/**
 * Sync bookkeeping — local only, never synchronised itself.
 * One document per synced collection holds the cursors for both directions.
 */
export interface ISyncState {
  _id: string; // the model name, e.g. "Sale"
  lastPushedAt: Date | null;
  lastPulledAt: Date | null;
  lastRunAt: Date | null;
  pushed: number;
  pulled: number;
  lastError?: string;
}

const SyncStateSchema = new Schema<ISyncState>(
  {
    _id: { type: String, required: true },
    lastPushedAt: { type: Date, default: null },
    lastPulledAt: { type: Date, default: null },
    lastRunAt: { type: Date, default: null },
    pushed: { type: Number, default: 0 },
    pulled: { type: Number, default: 0 },
    lastError: { type: String },
  },
  { versionKey: false, collection: 'sync_state' }
);

export const SyncState = mongoose.model<ISyncState>('SyncState', SyncStateSchema);
