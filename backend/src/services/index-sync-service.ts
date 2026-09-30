import mongoose from 'mongoose';

/**
 * Rebuilds every model's indexes to match its schema. Needed once after the
 * multi-org migration: single-field unique indexes (phone, invoiceNo, sku…)
 * are replaced by per-org compound uniques, and stale indexes must be dropped.
 */
export async function syncAllIndexes(): Promise<void> {
  const names = mongoose.modelNames();
  for (const name of names) {
    const model = mongoose.model(name);
    try {
      await model.syncIndexes();
    } catch (err) {
      // Index rebuilds are best-effort: a conflict (e.g. duplicate values that
      // cannot satisfy a new unique index) must not block server startup.
      console.warn(`   ⚠️ Index sync skipped for ${name}:`, (err as Error).message);
    }
  }
}
