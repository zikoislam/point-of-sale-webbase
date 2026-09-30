/**
 * Permission catalog grouped for the admin UI (role editor, organization
 * permission envelopes). Mirrors backend/src/config/permissions.ts.
 */
export const PERMISSION_GROUPS: Record<string, string[]> = {
  'POS & Sales': ['pos:checkout', 'sales:view', 'returns:authorize', 'shifts:operate', 'shifts:view'],
  Inventory: ['inv:view', 'inv:manage', 'inv:adjust', 'inv:labels'],
  Procurement: ['procurement:view', 'procurement:manage', 'procurement:receive', 'procurement:pay'],
  'Customers & CRM': [
    'customers:view',
    'customers:create',
    'customers:manage',
    'customers:pay_due',
    'customers:edit_ledger',
    'crm:view',
    'crm:manage',
    'crm:loyalty',
  ],
  'Pricing & Field Sales': [
    'pricing:manage',
    'sr:view',
    'sr:manage',
    'sr:operate',
    'dealer:manage',
    'distribution:manage',
  ],
  'HR & Payroll': ['hr:view', 'hr:manage', 'hr:attendance', 'hr:payroll'],
  Production: ['production:view', 'production:manage', 'production:execute'],
  eCommerce: ['ecom:view', 'ecom:manage'],
  'Accounts & Expenses': [
    'accounts:view',
    'accounts:manage',
    'accounts:transfer',
    'expenses:view',
    'expenses:create',
    'expenses:manage',
  ],
  Reports: [
    'reports:dashboard',
    'reports:sales',
    'reports:inventory',
    'reports:purchases',
    'reports:dues',
    'reports:payables',
    'reports:pnl',
    'reports:export',
  ],
  Administration: [
    'audit:view',
    'settings:manage',
    'users:view',
    'users:manage',
    'roles:view',
    'roles:manage',
    'approvals:manage',
  ],
};

export const ALL_KNOWN_PERMISSIONS: string[] = Object.values(PERMISSION_GROUPS).flat();
