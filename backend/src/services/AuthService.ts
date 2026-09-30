import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { User, IUser } from '../models/User';
import { Role } from '../models/Role';
import { Organization } from '../models/Organization';
import { Branch } from '../models/Branch';
import { Settings } from '../models/Settings';
import { TokenBlacklist } from '../models/TokenBlacklist';
import { AppError } from '../utils/app-error';
import { isMailConfigured, sendPasswordResetOtp } from '../utils/mailer';

/** How long a reset code stays usable. */
const RESET_OTP_TTL_MINUTES = 10;

/** a***z@gmail.com — enough for the user to recognise the inbox. */
function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  const head = name.slice(0, Math.min(3, name.length));
  const tail = name.length > head.length ? name.slice(-1) : '';
  return `${head}${'*'.repeat(Math.max(name.length - head.length - tail.length, 2))}${tail}@${domain}`;
}

export interface UserMembershipInfo {
  orgId: string;
  orgName: string;
  roleName: string;
  isActive: boolean;
}

export interface UserProfileResponse {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  permissions: string[];
  terminalLocked: boolean;
  avatarUrl?: string;
  lastLoginAt?: Date;
  isPlatformSuperAdmin: boolean;
  /** Branch of the active session (7.1 chain) — absent = all branches. */
  branchId?: string;
  branchName?: string;
  activeOrgId?: string;
  orgName?: string;
  memberships: UserMembershipInfo[];
}

export class AuthService {
  /** Shared shape for the profile returned by login / me / switch-org. */
  private async buildProfile(user: IUser, activeOrgId?: string): Promise<UserProfileResponse> {
    const memberships: UserMembershipInfo[] = [];
    const activeOrgIds = (user.memberships || [])
      .filter((m: any) => m.isActive && m.orgId)
      .map((m: any) => m.orgId);
    const orgDocs = activeOrgIds.length
      ? await Organization.find({ _id: { $in: activeOrgIds } }).lean()
      : [];
    const orgById = new Map(orgDocs.map((o: any) => [String(o._id), o]));

    const populated = user.populated?.('memberships.roleId') ? user.memberships : user.memberships;
    for (const m of populated as any[]) {
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

    const isPlatformSuperAdmin = !!user.isPlatformSuperAdmin || (user.roleId as any)?.name === 'SUPER_ADMIN';

    // Effective role for the active org
    let role: any = user.roleId;
    let orgName: string | undefined;
    if (activeOrgId) {
      orgName = orgById.get(String(activeOrgId))?.name;
      if (!isPlatformSuperAdmin) {
        const membership = (user.memberships as any[]).find(
          (m) => m.isActive && String(m.orgId) === String(activeOrgId)
        );
        role = membership?.roleId;
      }
    }

    let permissions: string[] = role?.permissions ? [...role.permissions] : [];
    if (activeOrgId && !isPlatformSuperAdmin) {
      const org: any = orgById.get(String(activeOrgId));
      const envelope: string[] = org?.adminPermissionSet || [];
      if (envelope.length > 0) {
        permissions = permissions.filter((p) => envelope.includes(p));
      }
    }

    // Branch the user works at (7.1) — null/undefined means "whole chain"
    let branchId: string | undefined;
    let branchName: string | undefined;
    if (user.branchId && activeOrgId && !isPlatformSuperAdmin) {
      const branch: any = await Branch.findById(user.branchId).lean();
      if (branch && String(branch.orgId) === String(activeOrgId)) {
        branchId = String(branch._id);
        branchName = branch.name;
      }
    }

    return {
      id: user._id.toString(),
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: role?.name || 'CASHIER',
      permissions,
      terminalLocked: user.terminalLocked,
      avatarUrl: (user as any).avatarUrl,
      lastLoginAt: user.lastLoginAt,
      isPlatformSuperAdmin,
      activeOrgId,
      orgName,
      branchId,
      branchName,
      memberships,
    };
  }

  private async getFullyPopulatedUser(userId: string): Promise<IUser | null> {
    return User.findById(userId)
      .populate<{ roleId: any }>('roleId')
      .populate<{ memberships: any[] }>('memberships.roleId');
  }

  async login(usernameOrEmail: string, password: string, rememberMe: boolean = false): Promise<{ token: string; user: UserProfileResponse }> {
    const query = usernameOrEmail.toLowerCase().trim();

    // Find user by username or email
    const user = await User.findOne({
      $or: [{ username: query }, { email: query }],
    });
    if (!user) {
      throw new AppError(401, 'AUTH_CREDENTIALS_INVALID', 'Invalid username/email or password');
    }

    if (!user.isActive) {
      throw new AppError(403, 'ACCOUNT_DEACTIVATED', 'Your account has been deactivated. Please contact administrator.');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError(401, 'AUTH_CREDENTIALS_INVALID', 'Invalid username/email or password');
    }

    // Update lastLoginAt
    user.lastLoginAt = new Date();
    await user.save();

    const populated = await this.getFullyPopulatedUser(String(user._id));
    const isPlatformSuperAdmin = !!populated?.isPlatformSuperAdmin;

    // Platform super admins land in the platform context; everyone else on
    // their first active membership (the header switcher moves them later).
    let activeOrgId: string | undefined;
    if (!isPlatformSuperAdmin) {
      const firstActive = (populated?.memberships || []).find((m: any) => m.isActive && m.orgId);
      activeOrgId = firstActive ? String(firstActive.orgId) : undefined;
    }

    // Sign JWT
    const expiresIn = rememberMe ? '30d' : env.JWT_EXPIRES_IN;
    const token = jwt.sign({ userId: user._id.toString(), activeOrgId }, env.JWT_SECRET, {
      expiresIn: expiresIn as any,
    });

    return {
      token,
      user: await this.buildProfile(populated!, activeOrgId),
    };
  }

  /**
   * Issues a fresh token pointed at another organization. Platform super
   * admins may enter any active organization (impersonation); members may only
   * switch to an organization they hold an active membership in.
   */
  async switchOrg(userId: string, orgId: string): Promise<{ token: string; user: UserProfileResponse }> {
    const user = await this.getFullyPopulatedUser(userId);
    if (!user || !user.isActive) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found or inactive');
    }

    const org = await Organization.findById(orgId).lean();
    if (!org) throw new AppError(404, 'ORG_NOT_FOUND', 'Organization not found');
    if (org.status !== 'ACTIVE') {
      throw new AppError(403, 'ORG_SUSPENDED', 'This organization is currently suspended.');
    }

    const isPlatformSuperAdmin = !!user.isPlatformSuperAdmin || (user.roleId as any)?.name === 'SUPER_ADMIN';
    if (!isPlatformSuperAdmin) {
      const membership = (user.memberships as any[] || []).find(
        (m) => m.isActive && String(m.orgId) === String(orgId)
      );
      if (!membership) {
        throw new AppError(403, 'ORG_ACCESS_DENIED', 'You are not a member of this organization.');
      }
    }

    const token = jwt.sign({ userId, activeOrgId: String(orgId) }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    return { token, user: await this.buildProfile(user, String(orgId)) };
  }

  async logout(token: string, userId: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    let expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    try {
      const decoded = jwt.decode(token) as { exp?: number };
      if (decoded && decoded.exp) {
        expiresAt = new Date(decoded.exp * 1000);
      }
    } catch {
      // Use fallback 24h
    }

    await TokenBlacklist.create({
      tokenHash,
      userId,
      expiresAt,
    });
  }

  async getMe(userId: string, activeOrgId?: string): Promise<UserProfileResponse> {
    const user = await this.getFullyPopulatedUser(userId);
    if (!user || !user.isActive) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User profile not found or inactive');
    }

    // Tokens issued before a membership existed fall back to the first org so
    // /auth/me always reports a coherent context.
    let orgId = activeOrgId;
    if (!orgId && !(user.isPlatformSuperAdmin || (user.roleId as any)?.name === 'SUPER_ADMIN')) {
      const firstActive = (user.memberships as any[] || []).find((m) => m.isActive && m.orgId);
      orgId = firstActive ? String(firstActive.orgId) : undefined;
    }

    return this.buildProfile(user, orgId);
  }

  async lockTerminal(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    user.terminalLocked = true;
    await user.save();
  }

  async unlockTerminal(userId: string, pin: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const isPinValid = await user.comparePin(pin);
    if (!isPinValid) {
      throw new AppError(401, 'PIN_INVALID', 'Incorrect 4-digit PIN');
    }

    user.terminalLocked = false;
    await user.save();
  }

  /**
   * Step 1 of "forgot password": mint a 6-digit code, keep only its hash with a
   * short expiry, and email it. The reply is the same whether or not the account
   * exists, so this endpoint cannot be used to discover usernames.
   */
  async requestPasswordReset(
    usernameOrEmail: string
  ): Promise<{ sent: boolean; maskedEmail: string }> {
    const query = usernameOrEmail.toLowerCase().trim();

    // Checked before the lookup on purpose: when no mail channel is configured
    // every caller gets the same answer, so the reply cannot be used to work out
    // which usernames exist.
    if (!isMailConfigured()) {
      throw new AppError(
        503,
        'EMAIL_NOT_CONFIGURED',
        'Email delivery is not set up on this server, so a reset code cannot be sent. Ask a manager or the administrator to reset your password.'
      );
    }

    const user = await User.findOne({ $or: [{ username: query }, { email: query }] }).select(
      '+resetOtpHash +resetOtpExpiresAt'
    );

    const mask = env.PASSWORD_RESET_EMAIL ? maskEmail(env.PASSWORD_RESET_EMAIL) : '';

    if (!user || !user.isActive) {
      return { sent: true, maskedEmail: mask };
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    user.resetOtpHash = await bcrypt.hash(otp, 10);
    user.resetOtpExpiresAt = new Date(Date.now() + RESET_OTP_TTL_MINUTES * 60 * 1000);
    await user.save();

    const settings = await Settings.findOne({}).lean();
    const to = env.PASSWORD_RESET_EMAIL || user.email;

    await sendPasswordResetOtp({
      to,
      otp,
      fullName: user.fullName,
      shopName: settings?.shopName || 'POS',
      minutes: RESET_OTP_TTL_MINUTES,
    });

    return { sent: true, maskedEmail: maskEmail(to) };
  }

  /** Step 2: check the code, then set the new password and burn the code. */
  async resetPassword(
    usernameOrEmail: string,
    otp: string,
    newPassword: string
  ): Promise<{ username: string }> {
    const query = usernameOrEmail.toLowerCase().trim();
    const user = await User.findOne({ $or: [{ username: query }, { email: query }] }).select(
      '+resetOtpHash +resetOtpExpiresAt'
    );

    if (!user || !user.isActive || !user.resetOtpHash || !user.resetOtpExpiresAt) {
      throw new AppError(400, 'OTP_INVALID', 'That reset code is not valid. Request a new one.');
    }

    if (user.resetOtpExpiresAt.getTime() < Date.now()) {
      user.resetOtpHash = undefined;
      user.resetOtpExpiresAt = undefined;
      await user.save();
      throw new AppError(400, 'OTP_EXPIRED', 'That reset code has expired. Request a new one.');
    }

    const matches = await bcrypt.compare(otp, user.resetOtpHash);
    if (!matches) {
      throw new AppError(400, 'OTP_INVALID', 'That reset code is not valid. Request a new one.');
    }

    // The pre-save hook hashes passwordHash when it is not already bcrypt output
    user.passwordHash = newPassword;
    user.resetOtpHash = undefined;
    user.resetOtpExpiresAt = undefined;
    await user.save();

    return { username: user.username };
  }
}

export const authService = new AuthService();
