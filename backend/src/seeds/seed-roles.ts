import { Role } from '../models/Role';
import { ALL_PERMISSIONS, ADMIN_PERMISSIONS, MANAGER_PERMISSIONS, CASHIER_PERMISSIONS } from '../config/permissions';

// Re-exported for backwards compatibility — the canonical catalog now lives in
// src/config/permissions.ts and is shared with the platform org service.
export { ALL_PERMISSIONS, ADMIN_PERMISSIONS, MANAGER_PERMISSIONS, CASHIER_PERMISSIONS };

export const seedRoles = async (): Promise<void> => {
  const roles = [
    {
      name: 'SUPER_ADMIN',
      displayName: 'Super Administrator',
      permissions: ALL_PERMISSIONS,
      isSystemRole: true,
    },
    {
      name: 'ADMIN',
      displayName: 'Administrator',
      permissions: ADMIN_PERMISSIONS,
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
      { orgId: null, name: roleData.name },
      { $set: roleData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log('✅ Platform role templates seeded successfully (SUPER_ADMIN, ADMIN, BRANCH_MANAGER, CASHIER)');
};
