/**
 * Which collections take part in cloud synchronisation, and how.
 *
 * 'both'  — master data and financial records written on either side. Records
 *           are matched on `_id` and merged last-write-wins, with the local
 *           (shop) copy winning ties because pushes run before pulls.
 *
 * 'push'  — append-only records that exist only to be reported on. They are
 *           never overwritten from the cloud.
 *
 * Device-local collections are deliberately absent: held carts belong to one
 * terminal, and the token blacklist is per-deployment.
 */
export interface SyncTarget {
  model: string;
  mode: 'both' | 'push';
}

export const SYNC_TARGETS: SyncTarget[] = [
  // Master data
  { model: 'Role', mode: 'both' },
  { model: 'User', mode: 'both' },
  { model: 'Settings', mode: 'both' },
  { model: 'Category', mode: 'both' },
  { model: 'Brand', mode: 'both' },
  { model: 'Product', mode: 'both' },
  { model: 'Customer', mode: 'both' },
  { model: 'Supplier', mode: 'both' },
  { model: 'Account', mode: 'both' },
  { model: 'ExpenseCategory', mode: 'both' },

  // Operational records
  { model: 'Shift', mode: 'both' },
  { model: 'PurchaseOrder', mode: 'both' },
  { model: 'Sale', mode: 'both' },
  { model: 'SalesReturn', mode: 'both' },
  { model: 'StoreCreditVoucher', mode: 'both' },
  { model: 'StockMovement', mode: 'push' },
  { model: 'StockAdjustment', mode: 'push' },
  { model: 'CustomerLedger', mode: 'push' },
  { model: 'SupplierLedger', mode: 'push' },
  { model: 'AccountTransaction', mode: 'push' },
  { model: 'Expense', mode: 'push' },
  { model: 'DailySalesSummary', mode: 'both' },
  { model: 'AuditLog', mode: 'push' },
];

/** Collections that only ever move from the cloud down to the shop. */
export const SKIPPED_COLLECTIONS = ['HoldCart', 'TokenBlacklist', 'SyncState', 'Counter'];
