/**
 * Phase 12.1 — rebuilds and reports the compound indexes of the hot models.
 *   npx ts-node --transpile-only src/scripts/verify-indexes.ts
 */
import mongoose from 'mongoose';

// Models must load AFTER the tenant-scoping plugin is registered
import '../models';

import { connectDB } from '../config/db';
import { syncAllIndexes } from '../services/index-sync-service';
import { Sale } from '../models/Sale';
import { Product } from '../models/Product';
import { StockMovement } from '../models/StockMovement';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { Customer } from '../models/Customer';

const WATCHED = ['Sale', 'Product', 'StockMovement', 'PurchaseOrder', 'Customer'];

async function run() {
  await connectDB();

  console.log('⟳ Rebuilding indexes (drops stale ones, creates the new compounds)…');
  await syncAllIndexes();

  for (const name of WATCHED) {
    const model = mongoose.model(name);
    const indexes: any[] = await model.collection.indexes();
    console.log(`\n${name} — ${indexes.length} index(es)`);
    for (const idx of indexes) {
      const keys = Object.entries(idx.key)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ');
      console.log(`   ${idx.name}  [${keys}]${idx.unique ? ' UNIQUE' : ''}`);
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => { console.error('INDEX VERIFY FAILED:', err.message); process.exit(1); });
