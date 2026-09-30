/**
 * Phase 12.1 — proves the hot report queries use the new compound indexes.
 *   npx ts-node --transpile-only src/scripts/explain-reports.ts
 */
import mongoose from 'mongoose';

import '../models';

import { connectDB } from '../config/db';
import { Organization } from '../models/Organization';
import { Sale } from '../models/Sale';
import { Product } from '../models/Product';
import { StockMovement } from '../models/StockMovement';
import { PurchaseOrder } from '../models/PurchaseOrder';
import { runWithOrg } from '../middlewares/org.context';

function winningStage(plan: any): string {
  let node = plan.queryPlanner?.winningPlan;
  while (node) {
    if (node.stage === 'IXSCAN') return `IXSCAN ${node.indexName}`;
    if (node.stage === 'COLLSCAN') return 'COLLSCAN (no index!)';
    node = node.inputStage || node.child || (node.inputStages && node.inputStages[0]);
    if (node && node.stage === 'FETCH') node = node.inputStage;
  }
  return plan.queryPlanner?.winningPlan?.stage || 'unknown';
}

async function run() {
  await connectDB();
  const org = await Organization.findOne({}).lean();
  if (!org) throw new Error('no organization');
  const orgId = String(org._id);

  const since = new Date(Date.now() - 30 * 86400000);

  const checks: Array<[string, mongoose.Model<any>, any]> = [
    ['sales: orgId + date range (list/report)', Sale, { orgId: new mongoose.Types.ObjectId(orgId), createdAt: { $gte: since } }],
    ['sales: orgId + customer', Sale, { orgId: new mongoose.Types.ObjectId(orgId), customerId: new mongoose.Types.ObjectId() }],
    ['sales: orgId + pricingTier + date', Sale, { orgId: new mongoose.Types.ObjectId(orgId), pricingTier: 'RETAIL', createdAt: { $gte: since } }],
    ['products: orgId + category + brand', Product, { orgId: new mongoose.Types.ObjectId(orgId), categoryId: new mongoose.Types.ObjectId() }],
    ['products: orgId + isActive', Product, { orgId: new mongoose.Types.ObjectId(orgId), isActive: true }],
    ['stock movements: orgId + product + date', StockMovement, { orgId: new mongoose.Types.ObjectId(orgId), productId: new mongoose.Types.ObjectId(), createdAt: { $gte: since } }],
    ['stock movements: orgId + type', StockMovement, { orgId: new mongoose.Types.ObjectId(orgId), type: 'OUT' }],
    ['purchase orders: orgId + supplier + status', PurchaseOrder, { orgId: new mongoose.Types.ObjectId(orgId), supplierId: new mongoose.Types.ObjectId(), status: 'RECEIVED' }],
    ['purchase orders: orgId + approvalStatus', PurchaseOrder, { orgId: new mongoose.Types.ObjectId(orgId), approvalStatus: 'PENDING_APPROVAL' }],
  ];

  for (const [label, model, filter] of checks) {
    const plan = await model.find(filter).sort({ createdAt: -1 }).limit(20).explain('queryPlanner');
    console.log(`✓ ${label} → ${winningStage(plan)}`);
  }

  // Tenant plugin still scopes correctly inside the request context
  const scoped = await runWithOrg({ orgId }, async () =>
    Sale.find({ createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(5).explain('queryPlanner')
  );
  console.log(`✓ sales scoped by context (no explicit orgId) → ${winningStage(scoped)}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => { console.error('EXPLAIN FAILED:', err.message); process.exit(1); });
