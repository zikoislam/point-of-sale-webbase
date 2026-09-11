import { Types } from 'mongoose';
import { Role } from '../models/Role';
import { AppError } from '../utils/app-error';
import { ALL_PERMISSIONS } from '../seeds/seed-roles';
import { CreateRoleInput, UpdateRoleInput } from '../validators/role.validators';

export interface RoleItem {
  id: string;
  name: string;
  displayName: string;
  permissions: string[];
  isSystemRole: boolean;
  createdAt: Date;
}

export class RoleService {
  async listRoles(): Promise<RoleItem[]> {
    const roles = await Role.find().sort({ isSystemRole: -1, name: 1 }).lean();
    return roles.map((r) => ({
      id: r._id.toString(),
      name: r.name,
      displayName: r.displayName,
      permissions: r.permissions,
      isSystemRole: r.isSystemRole,
      createdAt: r.createdAt,
    }));
  }

  async createRole(data: CreateRoleInput): Promise<RoleItem> {
    const existing = await Role.findOne({ name: data.name.toUpperCase() });
    if (existing) throw new AppError(409, 'ROLE_EXISTS', `Role "${data.name}" already exists`);

    // Validate permission strings
    const invalid = data.permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
    if (invalid.length > 0) {
      throw new AppError(400, 'INVALID_PERMISSIONS', `Unknown permissions: ${invalid.join(', ')}`);
    }

    const role = await Role.create({
      name: data.name.toUpperCase(),
      displayName: data.displayName,
      permissions: data.permissions,
      isSystemRole: false,
    });

    return {
      id: role._id.toString(),
      name: role.name,
      displayName: role.displayName,
      permissions: role.permissions,
      isSystemRole: role.isSystemRole,
      createdAt: role.createdAt,
    };
  }

  async updateRole(id: string, data: UpdateRoleInput): Promise<RoleItem> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid role ID');

    const role = await Role.findById(id);
    if (!role) throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found');

    if (data.permissions) {
      const invalid = data.permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
      if (invalid.length > 0) {
        throw new AppError(400, 'INVALID_PERMISSIONS', `Unknown permissions: ${invalid.join(', ')}`);
      }
      role.permissions = data.permissions;
    }

    if (data.displayName) role.displayName = data.displayName;

    await role.save();

    return {
      id: role._id.toString(),
      name: role.name,
      displayName: role.displayName,
      permissions: role.permissions,
      isSystemRole: role.isSystemRole,
      createdAt: role.createdAt,
    };
  }

  getAllPermissions(): string[] {
    return ALL_PERMISSIONS;
  }
}

export const roleService = new RoleService();
