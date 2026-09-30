import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { User } from '../models/User';
import { Organization } from '../models/Organization';
import { Branch } from '../models/Branch';
import { TokenBlacklist } from '../models/TokenBlacklist';
import { sendError } from '../utils/api-response';

export interface AuthMembership {
  orgId: string;
  orgName: string;
  roleName: string;
  isActive: boolean;
}

export interface AuthUser {
  _id: any;
  userId: string;
  username: string;
  fullName: string;
  role: string;
  permissions: string[];
  terminalLocked: boolean;
  /** Active organization — undefined only for platform-level super admin work. */
  orgId?: string;
  orgName?: string;
  /** Branch this user works at; undefined/null = all branches (7.1 Chain). */
  branchId?: string;
  branchName?: string;
  isPlatformSuperAdmin: boolean;
  memberships: AuthMembership[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      token?: string;
      orgId?: string;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;

    // Check Authorization: Bearer header first (tab-isolated session), then fallback to HTTP-only cookie
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    } else if (req.cookies && req.cookies.pos_token) {
      token = req.cookies.pos_token;
    }

    if (!token) {
      sendError(res, 401, 'AUTH_REQUIRED', 'Authentication required. Please login.');
      return;
    }

    req.token = token;

    // Check if token is blacklisted via SHA-256 hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const blacklisted = await TokenBlacklist.findOne({ tokenHash });
    if (blacklisted) {
      sendError(res, 401, 'TOKEN_INVALID_OR_BLACKLISTED', 'Session has been invalidated. Please login again.');
      return;
    }

    // Verify JWT
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string; activeOrgId?: string };
    if (!decoded || !decoded.userId) {
      sendError(res, 401, 'TOKEN_INVALID_OR_BLACKLISTED', 'Invalid authentication token.');
      return;
    }

    // Find User with the global role and per-org membership roles populated
    const user = await User.findById(decoded.userId)
      .populate<{ roleId: any }>('roleId')
      .populate<{ memberships: Array<{ orgId: any; roleId: any; isActive: boolean }> }>('memberships.roleId');
    if (!user || !user.isActive) {
      sendError(res, 401, 'USER_DEACTIVATED', 'Account is deactivated or does not exist.');
      return;
    }

    const isPlatformSuperAdmin = !!user.isPlatformSuperAdmin || user.roleId?.name === 'SUPER_ADMIN';

    // Build the switcher list: every active membership with org + role names
    const memberships: AuthMembership[] = [];
    const activeOrgIds = (user.memberships || [])
      .filter((m: any) => m.isActive && m.orgId)
      .map((m: any) => m.orgId);
    const orgDocs = activeOrgIds.length
      ? await Organization.find({ _id: { $in: activeOrgIds } }).lean()
      : [];
    const orgById = new Map(orgDocs.map((o: any) => [String(o._id), o]));
    for (const m of user.memberships || []) {
      if (!m.isActive || !m.orgId) continue;
      const org: any = orgById.get(String(m.orgId));
      if (!org) continue;
      memberships.push({
        orgId: String(m.orgId),
        orgName: org.name,
        roleName: m.roleId?.name || '',
        isActive: true,
      });
    }

    // Resolve the active organization + effective role
    let orgId: string | undefined;
    let orgName: string | undefined;
    let role: any = user.roleId;

    if (decoded.activeOrgId) {
      const org: any = await Organization.findById(decoded.activeOrgId).lean();
      if (!org) {
        sendError(res, 403, 'ORG_NOT_FOUND', 'The selected organization no longer exists.');
        return;
      }
      if (org.status !== 'ACTIVE') {
        sendError(res, 403, 'ORG_SUSPENDED', 'This organization is currently suspended.');
        return;
      }
      if (!isPlatformSuperAdmin) {
        const membership: any = (user.memberships || []).find(
          (m: any) => m.isActive && String(m.orgId) === String(org._id)
        );
        if (!membership) {
          sendError(res, 403, 'ORG_ACCESS_DENIED', 'You are not a member of this organization.');
          return;
        }
        role = membership.roleId;
      }
      orgId = String(org._id);
      orgName = org.name;
    } else if (!isPlatformSuperAdmin) {
      // No org in token (e.g. a session issued before this login had orgs):
      // transparently continue on the first active membership so existing
      // sessions keep working after the upgrade.
      const fallback = memberships[0];
      if (fallback) {
        const org: any = orgById.get(fallback.orgId);
        if (org.status !== 'ACTIVE') {
          sendError(res, 403, 'ORG_SUSPENDED', 'This organization is currently suspended.');
          return;
        }
        const membership: any = (user.memberships || []).find(
          (m: any) => m.isActive && String(m.orgId) === fallback.orgId
        );
        role = membership.roleId;
        orgId = fallback.orgId;
        orgName = fallback.orgName;
      } else {
        role = user.roleId; // legacy user with a global role only
      }
    }

    let permissions: string[] = role?.permissions ? [...role.permissions] : [];

    // The organization envelope is the ceiling: shrinking it revokes
    // permissions across the org without touching any role document.
    if (orgId && !isPlatformSuperAdmin) {
      const org: any = orgById.get(String(orgId)) || (await Organization.findById(orgId).lean());
      const envelope: string[] = org?.adminPermissionSet || [];
      if (envelope.length > 0) {
        permissions = permissions.filter((p) => envelope.includes(p));
      }
    }

    const roleName: string = role?.name || 'CASHIER';

    // Branch attribution (7.1): the user's home branch stamps every record they
    // create. Super admins / HQ users have none and therefore see the chain.
    let branchId: string | undefined = user.branchId ? String(user.branchId) : undefined;
    let branchName: string | undefined;
    if (branchId) {
      const branch: any = await Branch.findById(branchId).lean();
      if (branch && branch.orgId && orgId && String(branch.orgId) !== String(orgId)) {
        branchId = undefined; // branch belongs to another org — ignore
      } else {
        branchName = branch?.name;
      }
    }

    // Terminal quick-lock enforcement (server-side). Only the unlock / session
    // management endpoints remain reachable while the terminal is locked.
    const unlockedPaths = ['/auth/me', '/auth/logout', '/auth/unlock-terminal', '/auth/lock-terminal', '/auth/switch-org'];
    const isExempt = unlockedPaths.some((p) => req.originalUrl.includes(p));
    if (user.terminalLocked && !isExempt) {
      sendError(res, 403, 'TERMINAL_LOCKED', 'Terminal is locked. Enter your PIN to unlock.');
      return;
    }

    req.user = {
      _id: user._id,
      userId: user._id.toString(),
      username: user.username,
      fullName: user.fullName,
      role: roleName,
      permissions,
      terminalLocked: user.terminalLocked,
      orgId,
      orgName,
      branchId,
      branchName,
      isPlatformSuperAdmin,
      memberships,
    };
    req.orgId = orgId;
    req.token = token;

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      sendError(res, 401, 'AUTH_TOKEN_EXPIRED', 'Authentication token has expired. Please login again.');
      return;
    }
    if (error.name === 'JsonWebTokenError') {
      sendError(res, 401, 'TOKEN_INVALID_OR_BLACKLISTED', 'Malformed or invalid authentication token.');
      return;
    }
    next(error);
  }
};
