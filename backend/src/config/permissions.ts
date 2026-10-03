/**
 * Central permission catalog.
 *
 * Shared by the role seeder, the platform organization service and the RBAC
 * middleware so every module registers its permission strings in one place.
 */
export const ALL_PERMISSIONS: string[] = [
  // POS & sales
  'pos:checkout',
  'sales:view',
  'returns:authorize',
  'shifts:operate',
  'shifts:view',
  // Inventory
  'inv:view',
  'inv:manage',
  'inv:adjust',
  'inv:labels',
  // Procurement
  'procurement:view',
  'procurement:manage',
  'procurement:receive',
  'procurement:pay',
  // Customers / CRM
  'customers:view',
  'customers:create',
  'customers:manage',
  'customers:pay_due',
  'customers:edit_ledger',
  'crm:view',
  'crm:manage',
  'crm:loyalty',
  // Accounts & expenses
  'accounts:view',
  'accounts:manage',
  'accounts:transfer',
  'expenses:view',
  'expenses:create',
  'expenses:manage',
  // Pricing
  'pricing:manage',
  // Sales field team
  'sr:view',
  'sr:manage',
  'sr:operate',
  'dealer:manage',
  'distribution:manage',
  // HR
  'hr:view',
  'hr:manage',
  'hr:attendance',
  'hr:payroll',
  // Production
  'production:view',
  'production:manage',
  'production:execute',
  // eCommerce
  'ecom:view',
  'ecom:manage',
  // Reports
  'reports:dashboard',
  'reports:sales',
  'reports:inventory',
  'reports:purchases',
  'reports:dues',
  'reports:payables',
  'reports:pnl',
  'reports:export',
  // Administration
  'audit:view',
  'settings:manage',
  'users:view',
  'users:manage',
  'roles:view',
  'roles:manage',
  'approvals:manage',
  // Subscription / licensing (org admins redeem license keys)
  'subscription:manage',
];

/** Everything an organization admin may hold at most — the envelope ceiling. */
export const ADMIN_PERMISSIONS: string[] = [...ALL_PERMISSIONS];

export const MANAGER_PERMISSIONS: string[] = [
  'pos:checkout',
  'inv:view',
  'inv:manage',
  'inv:adjust',
  'inv:labels',
  'procurement:view',
  'procurement:manage',
  'procurement:receive',
  'procurement:pay',
  'sales:view',
  'returns:authorize',
  'shifts:operate',
  'shifts:view',
  'customers:view',
  'customers:create',
  'customers:manage',
  'customers:pay_due',
  'expenses:view',
  'expenses:create',
  'expenses:manage',
  'reports:dashboard',
  'reports:sales',
  'reports:inventory',
  'reports:purchases',
  'reports:dues',
  'reports:payables',
  'reports:export',
  'roles:view',
  'sr:view',
  'hr:view',
  'production:view',
  'production:execute',
  'crm:view',
  'ecom:view',
];

export const CASHIER_PERMISSIONS: string[] = [
  'pos:checkout',
  'sales:view',
  'shifts:operate',
  'customers:view',
  'customers:create',
  'customers:pay_due',
  'expenses:create',
  'inv:view',
];

/** Validates that every entry is a known permission string. */
export function isValidPermissionSet(permissions: string[]): boolean {
  return permissions.every((p) => ALL_PERMISSIONS.includes(p));
}
