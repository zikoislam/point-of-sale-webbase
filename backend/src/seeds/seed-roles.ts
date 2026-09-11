import { Role } from '../models/Role';

export const ALL_PERMISSIONS = [
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
  'accounts:view',
  'accounts:manage',
  'accounts:transfer',
  'expenses:view',
  'expenses:create',
  'expenses:manage',
  'reports:dashboard',
  'reports:sales',
  'reports:inventory',
  'reports:purchases',
  'reports:dues',
  'reports:payables',
  'reports:pnl',
  'reports:export',
  'audit:view',
  'settings:manage',
  'users:manage',
  'roles:view',
  'roles:manage',
];

export const MANAGER_PERMISSIONS = [
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
  'accounts:view',
  'accounts:manage',
  'accounts:transfer',
  'expenses:view',
  'expenses:create',
  'expenses:manage',
  'reports:dashboard',
  'reports:sales',
  'reports:inventory',
  'reports:purchases',
  'reports:dues',
  'reports:payables',
  'reports:pnl',
  'reports:export',
  'roles:view',
];

export const CASHIER_PERMISSIONS = [
  'pos:checkout',
  'sales:view',
  'shifts:operate',
  'customers:view',
  'customers:create',
  'customers:pay_due',
  'inv:view',
];

export const seedRoles = async (): Promise<void> => {
  const roles = [
    {
      name: 'SUPER_ADMIN',
      displayName: 'Super Administrator',
      permissions: ALL_PERMISSIONS,
      isSystemRole: true,
    },
    {
      name: 'BRANCH_MANAGER',
      displayName: 'Branch / Shop Manager',
      permissions: MANAGER_PERMISSIONS,
      isSystemRole: true,
    },
    {
      name: 'CASHIER',
      displayName: 'Cashier / POS Operator',
      permissions: CASHIER_PERMISSIONS,
      isSystemRole: true,
    },
  ];

  for (const roleData of roles) {
    await Role.findOneAndUpdate(
      { name: roleData.name },
      { $set: roleData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log('✅ Default roles seeded successfully (SUPER_ADMIN, BRANCH_MANAGER, CASHIER)');
};
