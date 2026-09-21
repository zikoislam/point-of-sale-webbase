import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { AppError } from '../utils/app-error';

export type BackupTrigger = 'manual' | 'auto';

export interface BackupMeta {
  name: string;
  trigger: BackupTrigger;
  takenAt: string;
  database: string;
  collections: number;
  documents: number;
  size: number;
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

  /** Keep only the newest `keep` automatic backups; manual ones are never pruned. */
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
