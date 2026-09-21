import mongoose, { Connection, Model } from 'mongoose';
import { env } from '../config/env';
import { getDbMode } from '../config/db';
import { SyncState } from '../models/SyncState';
import { SYNC_TARGETS, SyncTarget } from './sync-targets';

/**
 * Keeps the on-device database and the cloud database in step.
 *
 * Direction per record is decided by timestamps rather than by an outbox: every
 * model carries `updatedAt` (or `createdAt` when rows are immutable), so a run
 * asks each side for "everything changed since the cursor I stored last time".
 * Records are matched on `_id`, which is generated on the device that created
 * the row, so the same document never turns into two.
 *
 * Pushes happen before pulls, which is what makes the merge last-write-wins
 * with the shop's local copy winning a tie.
 */

const BATCH_SIZE = 300;

interface CollectionStatus {
  model: string;
  mode: 'both' | 'push';
  cursorField: string;
  lastPushedAt: Date | null;
  lastPulledAt: Date | null;
  pushed: number;
  pulled: number;
  lastError?: string;
}

export interface SyncSummary {
  startedAt: Date;
  finishedAt: Date;
  pushed: number;
  pulled: number;
  errors: { model: string; message: string }[];
}

type CursorField = 'updatedAt' | 'createdAt';

class SyncService {
  private cloud: Connection | null = null;
  private cloudReady = false;
  private timer: NodeJS.Timeout | null = null;
  private inFlight = false;
  private lastRunAt: Date | null = null;
  private lastSummary: SyncSummary | null = null;
  private lastError: string | null = null;

  get enabled(): boolean {
    return env.SYNC_ENABLED && Boolean(env.CLOUD_MONGODB_URI) && getDbMode() === 'local';
  }

  get isRunning(): boolean {
    return this.inFlight;
  }

  /** Connects to the cloud database and starts the periodic run. */
  async start(): Promise<void> {
    if (!env.SYNC_ENABLED) return;

    if (getDbMode() !== 'local') {
      console.log('ℹ️  Sync skipped: this instance is already running on the cloud database.');
      return;
    }

    if (!env.CLOUD_MONGODB_URI) {
      console.log('ℹ️  Sync skipped: no cloud database is configured.');
      return;
    }

    try {
      await this.connectCloud();
    } catch (error: any) {
      // Not fatal: the shop keeps selling and the next run retries.
      this.lastError = error?.message || String(error);
      console.warn(`⚠️  Cloud database unreachable, sync is paused: ${this.lastError}`);
    }

    const intervalMs = Math.max(15, env.SYNC_INTERVAL_SECONDS) * 1000;

    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);
    this.timer.unref?.();

    console.log(`🔄 Database sync enabled (every ${Math.round(intervalMs / 1000)}s).`);

    void this.runOnce();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async connectCloud(): Promise<void> {
    if (this.cloudReady && this.cloud) return;

    const connection = mongoose.createConnection(env.CLOUD_MONGODB_URI as string, {
      serverSelectionTimeoutMS: 10000,
    });

    connection.on('disconnected', () => {
      this.cloudReady = false;
      console.warn('Cloud database disconnected — sync will retry.');
    });

    await connection.asPromise();

    this.cloud = connection;
    this.cloudReady = true;
    console.log('☁️  Sync worker connected to the cloud database.');
  }

  private cursorFieldFor(model: Model<any>): CursorField {
    return model.schema.path('updatedAt') ? 'updatedAt' : 'createdAt';
  }

  private cloudModel(target: SyncTarget, localModel: Model<any>): Model<any> {
    if (this.cloud!.models[target.model]) return this.cloud!.models[target.model];
    return this.cloud!.model(target.model, localModel.schema);
  }

  private static documentForWrite(doc: Record<string, any>): Record<string, any> {
    const { _id, ...rest } = doc;
    return rest;
  }

  /**
   * Copies every locally-changed document of one collection up to the cloud,
   * and (for two-way collections) everything cloud-changed back down.
   */
  private async syncTarget(target: SyncTarget): Promise<{ pushed: number; pulled: number }> {
    const localModel = mongoose.model(target.model) as Model<any>;
    const cloudModel = this.cloudModel(target, localModel);
    const cursorField = this.cursorFieldFor(localModel);

    const state =
      (await SyncState.findById(target.model)) ??
      (await SyncState.create({ _id: target.model }));

    let pushed = 0;
    let pulled = 0;

    // ── Push: local → cloud ──────────────────────────────────────────────────
    let pushCursor = state.lastPushedAt ?? new Date(0);

    for (;;) {
      const docs = await localModel
        .find({ [cursorField]: { $gte: pushCursor } })
        .sort({ [cursorField]: 1 })
        .limit(BATCH_SIZE)
        .lean();

      if (docs.length === 0) break;

      const operations = docs.map((doc: any) => ({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: SyncService.documentForWrite(doc) },
          upsert: true,
        },
      }));

      await cloudModel.bulkWrite(operations, { ordered: false });

      const newest = docs[docs.length - 1][cursorField] as Date;
      pushed += docs.length;

      const advanced = newest.getTime() > pushCursor.getTime();
      pushCursor = newest;

      if (!advanced || docs.length < BATCH_SIZE) break;
    }

    if (pushed > 0) {
      state.lastPushedAt = pushCursor;
      state.pushed += pushed;
    }

    // ── Pull: cloud → local ──────────────────────────────────────────────────
    if (target.mode === 'both') {
      let pullCursor = state.lastPulledAt ?? new Date(0);

      for (;;) {
        const docs = await cloudModel
          .find({ [cursorField]: { $gte: pullCursor } })
          .sort({ [cursorField]: 1 })
          .limit(BATCH_SIZE)
          .lean();

        if (docs.length === 0) break;

        const operations = docs.map((doc: any) => ({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: SyncService.documentForWrite(doc) },
            upsert: true,
          },
        }));

        // Timestamps are stripped from the payload so Mongoose does not treat a
        // pulled row as freshly modified locally.
        await localModel.bulkWrite(operations, { ordered: false, timestamps: false } as any);

        const newest = docs[docs.length - 1][cursorField] as Date;
        pulled += docs.length;

        const advanced = newest.getTime() > pullCursor.getTime();
        pullCursor = newest;

        if (!advanced || docs.length < BATCH_SIZE) break;
      }

      if (pulled > 0) {
        state.lastPulledAt = pullCursor;
        state.pulled += pulled;
      }
    }

    state.lastRunAt = new Date();
    await state.save();

    return { pushed, pulled };
  }

  /**
   * Invoice and PO numbers are generated from a per-day counter. Because both
   * the shop and the web app can generate one, the counter is reconciled to the
   * higher of the two so the same number is never handed out twice.
   */
  private async syncCounters(): Promise<void> {
    if (!this.cloud) return;

    const CounterModel = mongoose.model('Counter') as Model<any>;
    const CloudCounter = this.cloudModel({ model: 'Counter', mode: 'both' }, CounterModel);

    const localCounters = await CounterModel.find().lean();
    const localIds = localCounters.map((counter: any) => counter._id);

    for (const counter of localCounters as any[]) {
      const cloudCounter = await CloudCounter.findById(counter._id).lean();
      const highest = Math.max(counter.seq || 0, (cloudCounter as any)?.seq || 0);

      if (((cloudCounter as any)?.seq || 0) < highest) {
        await CloudCounter.updateOne({ _id: counter._id }, { $set: { seq: highest } }, { upsert: true });
      }
      if ((counter.seq || 0) < highest) {
        await CounterModel.updateOne(
          { _id: counter._id },
          { $set: { seq: highest } },
          { timestamps: false } as any
        );
      }
    }

    const cloudOnly = await CloudCounter.find({ _id: { $nin: localIds } }).lean();

    for (const counter of cloudOnly as any[]) {
      await CounterModel.updateOne(
        { _id: counter._id },
        { $set: { seq: counter.seq || 0 } },
        { upsert: true, timestamps: false } as any
      );
    }
  }

  async runOnce(): Promise<SyncSummary> {
    const startedAt = new Date();
    const errors: { model: string; message: string }[] = [];
    let pushed = 0;
    let pulled = 0;

    if (!this.enabled) {
      return { startedAt, finishedAt: new Date(), pushed, pulled, errors };
    }

    if (this.inFlight) {
      return this.lastSummary ?? { startedAt, finishedAt: new Date(), pushed, pulled, errors };
    }

    this.inFlight = true;

    try {
      await this.connectCloud();
    } catch (error: any) {
      this.inFlight = false;
      this.lastError = error?.message || String(error);
      this.lastRunAt = new Date();
      return {
        startedAt,
        finishedAt: new Date(),
        pushed,
        pulled,
        errors: [{ model: '*', message: this.lastError as string }],
      };
    }

    try {
      for (const target of SYNC_TARGETS) {
        try {
          const result = await this.syncTarget(target);
          pushed += result.pushed;
          pulled += result.pulled;
          if (result.pushed || result.pulled) {
            console.log(`🔄 ${target.model}: ↑${result.pushed} ↓${result.pulled}`);
          }
        } catch (error: any) {
          const message = error?.message || String(error);
          errors.push({ model: target.model, message });
          await SyncState.updateOne(
            { _id: target.model },
            { $set: { lastError: message } },
            { upsert: true }
          ).catch(() => undefined);
        }
      }

      try {
        await this.syncCounters();
      } catch (error: any) {
        errors.push({ model: 'Counter', message: error?.message || String(error) });
      }

      this.lastError = errors.length ? `${errors.length} collection(s) failed` : null;
    } finally {
      this.inFlight = false;
      this.lastRunAt = new Date();
    }

    const summary: SyncSummary = { startedAt, finishedAt: new Date(), pushed, pulled, errors };
    this.lastSummary = summary;

    return summary;
  }

  async status(): Promise<{
    enabled: boolean;
    cloudConfigured: boolean;
    cloudConnected: boolean;
    running: boolean;
    lastRunAt: Date | null;
    lastError: string | null;
    lastSummary: SyncSummary | null;
    collections: CollectionStatus[];
  }> {
    const states = await SyncState.find().lean();
    const byId = new Map(states.map((state: any) => [state._id, state]));

    const collections: CollectionStatus[] = SYNC_TARGETS.map((target) => {
      const state = byId.get(target.model) as any;
      const model = mongoose.model(target.model) as Model<any>;

      return {
        model: target.model,
        mode: target.mode,
        cursorField: this.cursorFieldFor(model),
        lastPushedAt: state?.lastPushedAt ?? null,
        lastPulledAt: state?.lastPulledAt ?? null,
        pushed: state?.pushed ?? 0,
        pulled: state?.pulled ?? 0,
        lastError: state?.lastError,
      };
    });

    return {
      enabled: this.enabled,
      cloudConfigured: Boolean(env.CLOUD_MONGODB_URI),
      cloudConnected: this.cloudReady,
      running: this.inFlight,
      lastRunAt: this.lastRunAt,
      lastError: this.lastError,
      lastSummary: this.lastSummary,
      collections,
    };
  }
}

export const syncService = new SyncService();
