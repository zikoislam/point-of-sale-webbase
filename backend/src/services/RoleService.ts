import { Types } from 'mongoose';
import { Role } from '../models/Role';
import { AppError } from '../utils/app-error';
import { ALL_PERMISSIONS } from '../config/permissions';
import { CreateRoleInput, UpdateRoleInput } from '../validators/role.validators';

export interface RoleItem {
  id: string;
  name: string;
  displayName: string;
  permissions: string[];
  isSystemRole: boolean;
  orgId?: string;
  createdAt: Date;
}

interface ActorInfo {
  permissions: string[];
  isPlatformSuperAdmin: boolean;
  orgId?: string;
}

/** The cascading privilege cap: nobody may grant what they do not hold. */
function assertGrantable(permissions: string[], actor: ActorInfo): void {
  if (actor.isPlatformSuperAdmin) return;
  const escalation = permissions.filter((p) => !actor.permissions.includes(p));
  if (escalation.length > 0) {
    throw new AppError(
      403,
      'PRIVILEGE_ESCALATION',
      `You cannot grant permissions you do not hold yourself: ${escalation.join(', ')}`
    );
  }
}

export class RoleService {
  async listRoles(actor?: ActorInfo): Promise<RoleItem[]> {
    const roles = await Role.find().sort({ isSystemRole: -1, name: 1 }).lean();
    return roles
      .filter((r) => {
        // In an org context only that org's roles are visible; platform
        // templates (orgId: null) stay hidden from org staff.
        if (actor && !actor.isPlatformSuperAdmin && actor.orgId) {
          return r.orgId && String(r.orgId) === actor.orgId;
        }
        if (actor && actor.isPlatformSuperAdmin && !actor.orgId) {
          return true;
        }
        return true;
      })
      .map((r) => ({
        id: r._id.toString(),
        name: r.name,
        displayName: r.displayName,
        permissions: r.permissions,
        isSystemRole: r.isSystemRole,
        orgId: r.orgId ? String(r.orgId) : undefined,
        createdAt: r.createdAt,
      }));
  }

  async createRole(data: CreateRoleInput, actor?: ActorInfo): Promise<RoleItem> {
    const existing = await Role.findOne({ name: data.name.toUpperCase() });
    if (existing) throw new AppError(409, 'ROLE_EXISTS', `Role "${data.name}" already exists`);

    // Validate permission strings
    const invalid = data.permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
    if (invalid.length > 0) {
      throw new AppError(400, 'INVALID_PERMISSIONS', `Unknown permissions: ${invalid.join(', ')}`);
    }

    if (actor) assertGrantable(data.permissions, actor);

    // An org-context request auto-stamps orgId through the scope plugin;
    // platform-context requests (super admin) create org-less templates.
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
      orgId: role.orgId ? String(role.orgId) : undefined,
      createdAt: role.createdAt,
    };
  }

  async updateRole(id: string, data: UpdateRoleInput, actor?: ActorInfo): Promise<RoleItem> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid role ID');

    // In org context the plugin scopes the lookup — a foreign org's role is
    // simply not found here.
    const role = await Role.findById(id);
    if (!role) throw new AppError(404, 'ROLE_NOT_FOUND', 'Role not found');

    // Org staff can never touch the platform templates.
    if (actor && !actor.isPlatformSuperAdmin) {
      const roleOrgId = role.orgId ? String(role.orgId) : null;
      if (!roleOrgId || roleOrgId !== actor.orgId) {
        throw new AppError(403, 'PERMISSION_DENIED', 'You cannot modify a platform role template.');
      }
    }

    if (data.permissions) {
      const invalid = data.permissions.filter((p) => !ALL_PERMISSIONS.includes(p));
      if (invalid.length > 0) {
        throw new AppError(400, 'INVALID_PERMISSIONS', `Unknown permissions: ${invalid.join(', ')}`);
      }
      if (actor) assertGrantable(data.permissions, actor);
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
      orgId: role.orgId ? String(role.orgId) : undefined,
      createdAt: role.createdAt,
    };
  }

  getAllPermissions(): string[] {
    return ALL_PERMISSIONS;
  }
}

export const roleService = new RoleService();
