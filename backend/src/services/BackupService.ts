import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { AppError } from '../utils/app-error';

export type BackupTrigger = 'manual' | 'auto' | 'pre-restore';

export interface BackupMeta {
  name: string;
  trigger: BackupTrigger;
  takenAt: string;
  database: string;
  collections: number;
  documents: number;
  size: number;
}

export interface RestoreResult {
  restoredFrom: string;
  restoredAt: string;
  /** Snapshot of the *previous* state, taken automatically so the restore can be undone. */
  safetyBackup: string;
  collections: number;
  documents: number;
  inserted: number;
  updated: number;
  skipped: number;
}

const META_SUFFIX = '.meta.json';

/**
 * Where snapshots are written.
 *
 * - `BACKUP_DIR` wins when set (absolute, or relative to the process cwd).
 * - Otherwise production falls back to `<uploads>/backups`, i.e. inside the
 *   host's persistent volume (Railway mounts it at /app/uploads, Render at
 *   .../backend/uploads), so backups survive a redeploy.
 * - Development uses `<backend>/backups`, the same folder db-tool.js writes to.
 *
 * The uploads path is blocked from the public static handler in index.ts, so a
 * snapshot is only reachable through the authenticated /api/v1/backups API.
 */
function backupDir(): string {
  const configured = env.BACKUP_DIR?.trim();
  const dir = configured
    ? path.resolve(configured)
    : env.NODE_ENV === 'production'
    ? path.resolve(__dirname, '../../uploads/backups')
    : path.resolve(__dirname, '../../backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * JSON.stringify would flatten ObjectId to a bare string and Date to an ISO
 * string, neither of which restores faithfully. Tag them so a restore can
 * rebuild the exact types.
 */
function encode(value: any): any {
  if (value === null || value === undefined) return value;
  if (value instanceof mongoose.Types.ObjectId) return { $oid: value.toHexString() };
  if (value instanceof Date) return { $date: value.toISOString() };
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(encode);
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = encode(v);
    return out;
  }
  return value;
}

/** Inverse of encode() — rebuilds ObjectId / Date values tagged in a snapshot. */
function decode(value: any): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(decode);
  if (typeof value === 'object') {
    if (typeof value.$oid === 'string') return new mongoose.Types.ObjectId(value.$oid);
    if (typeof value.$date === 'string') return new Date(value.$date);
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = decode(v);
    return out;
  }
  return value;
}

class BackupService {
  /** Snapshot every collection into a single downloadable JSON file. */
  async createBackup(trigger: BackupTrigger = 'manual'): Promise<BackupMeta> {
    const db = mongoose.connection.db;
    if (!db) {
      throw new AppError(503, 'DATABASE_NOT_CONNECTED', 'Database connection is not ready yet. Try again in a moment.');
    }

    const dir = backupDir();
    const names = (await db.listCollections().toArray()).map((c) => c.name).sort();

    const data: Record<string, any[]> = {};
    let documents = 0;
    for (const name of names) {
      const docs = await db.collection(name).find({}).toArray();
      data[name] = docs.map(encode);
      documents += docs.length;
    }

    const takenAt = new Date().toISOString();
    const base = `${stamp()}--${trigger}`;
    const payload = {
      tool: 'pos-backup',
      version: 1,
      type: 'full',
      trigger,
      takenAt,
      database: db.databaseName,
      collections: names.length,
      documents,
      data,
    };

    const file = path.join(dir, `${base}.json`);
    await fs.promises.writeFile(file, JSON.stringify(payload), 'utf8');

    const meta: BackupMeta = {
      name: `${base}.json`,
      trigger,
      takenAt,
      database: db.databaseName,
      collections: names.length,
      documents,
      size: fs.statSync(file).size,
    };
    // A sidecar keeps listing cheap — reading multi-MB payloads just to render
    // a table would be wasteful.
    await fs.promises.writeFile(path.join(dir, `${base}${META_SUFFIX}`), JSON.stringify(meta, null, 2), 'utf8');

    return meta;
  }

  async listBackups(): Promise<BackupMeta[]> {
    const dir = backupDir();
    const entries = await fs.promises.readdir(dir);
    const metas: BackupMeta[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(META_SUFFIX)) continue;
      try {
        const meta = JSON.parse(await fs.promises.readFile(path.join(dir, entry), 'utf8')) as BackupMeta;
        // Hide orphans whose payload file was removed by hand.
        if (meta?.name && fs.existsSync(path.join(dir, meta.name))) metas.push(meta);
      } catch {
        /* skip a corrupt sidecar rather than fail the whole list */
      }
    }

    metas.sort((a, b) => (a.takenAt < b.takenAt ? 1 : -1));
    return metas;
  }

  getBackupFile(name: string): { abs: string; name: string; size: number } {
    const safe = this.sanitise(name);
    const abs = path.join(backupDir(), safe);
    if (!fs.existsSync(abs)) {
      throw new AppError(404, 'BACKUP_NOT_FOUND', `Backup "${safe}" was not found.`);
    }
    return { abs, name: safe, size: fs.statSync(abs).size };
  }

  async deleteBackup(name: string): Promise<void> {
    const safe = this.sanitise(name);
    const dir = backupDir();
    const base = safe.replace(/\.json$/, '');

    let removed = false;
    for (const target of [`${base}.json`, `${base}${META_SUFFIX}`]) {
      const abs = path.join(dir, target);
      if (fs.existsSync(abs)) {
        await fs.promises.unlink(abs);
        removed = true;
      }
    }

    if (!removed) {
      throw new AppError(404, 'BACKUP_NOT_FOUND', `Backup "${safe}" was not found.`);
    }
  }

  /** Restore from a snapshot stored on the server. */
  async restoreBackup(name: string): Promise<RestoreResult> {
    const { abs, name: safe } = this.getBackupFile(name);

    let rawSnapshot: string;
    try {
      rawSnapshot = await fs.promises.readFile(abs, 'utf8');
    } catch {
      throw new AppError(422, 'BACKUP_FILE_INVALID', `Backup "${safe}" could not be read.`);
    }

    return this.applySnapshot(rawSnapshot, safe);
  }

  /** Restore from a snapshot the admin picked from their own machine. */
  async restoreFromUpload(buffer: Buffer, originalName: string): Promise<RestoreResult> {
    const label = path.basename(originalName || 'uploaded-backup.json');
    return this.applySnapshot(buffer.toString('utf8'), label);
  }

  /**
   * Write a full snapshot back into the live database.
   *
   * - Documents are upserted by `_id`, so records that exist only in the live
   *   database (created after the snapshot) are left untouched rather than
   *   silently deleted.
   * - A safety snapshot of the current state is written first, so even a wrong
   *   restore can be rolled back by restoring that snapshot.
   */
  private async applySnapshot(rawSnapshot: string, label: string): Promise<RestoreResult> {
    const db = mongoose.connection.db;
    if (!db) {
      throw new AppError(503, 'DATABASE_NOT_CONNECTED', 'Database connection is not ready yet. Try again in a moment.');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawSnapshot);
    } catch {
      throw new AppError(422, 'BACKUP_FILE_INVALID', `"${label}" could not be read as JSON.`);
    }

    if (!parsed || parsed.type !== 'full' || !parsed.data || typeof parsed.data !== 'object') {
      throw new AppError(422, 'BACKUP_FILE_INVALID', `"${label}" is not a full POS snapshot.`);
    }

    // Snapshot the current state before touching anything.
    const safety = await this.createBackup('pre-restore');

    const collections = Object.keys(parsed.data);
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const coll of collections) {
      const docs = Array.isArray(parsed.data[coll]) ? parsed.data[coll] : [];
      for (const rawDoc of docs) {
        const doc = decode(rawDoc);
        if (!doc || doc._id === undefined) {
          skipped++;
          continue;
        }
        const res = await db.collection(coll).replaceOne({ _id: doc._id }, doc, { upsert: true });
        if (res.upsertedCount) inserted++;
        else if (res.modifiedCount) updated++;
      }
    }

    return {
      restoredFrom: label,
      restoredAt: new Date().toISOString(),
      safetyBackup: safety.name,
      collections: collections.length,
      documents: parsed.documents ?? inserted + updated,
      inserted,
      updated,
      skipped,
    };
  }

  /**
   * Keep only the newest `keep` automatic backups. Manual backups are never
   * pruned, and neither are the `pre-restore` safety snapshots.
   */
  async pruneAutoBackups(keep: number): Promise<number> {
    if (!Number.isFinite(keep) || keep < 0) return 0;
    const autos = (await this.listBackups()).filter((b) => b.trigger === 'auto');
    const stale = autos.slice(keep);
    for (const b of stale) await this.deleteBackup(b.name);
    return stale.length;
  }

  /** Guards against path traversal — only a plain *.json file name is allowed. */
  private sanitise(name: string): string {
    const safe = path.basename(name || '');
    if (!safe || !safe.endsWith('.json') || safe.endsWith(META_SUFFIX)) {
      throw new AppError(400, 'INVALID_BACKUP_NAME', 'Invalid backup file name.');
    }
    return safe;
  }
}

export const backupService = new BackupService();
