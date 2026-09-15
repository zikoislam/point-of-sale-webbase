import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { User, IUser } from '../models/User';
import { Role } from '../models/Role';
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
}

export class AuthService {
  async login(usernameOrEmail: string, password: string, rememberMe: boolean = false): Promise<{ token: string; user: UserProfileResponse }> {
    const query = usernameOrEmail.toLowerCase().trim();

    // Find user by username or email
    const user = await User.findOne({
      $or: [{ username: query }, { email: query }],
    }).populate<{ roleId: any }>('roleId');

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

    // Sign JWT
    const expiresIn = rememberMe ? '30d' : env.JWT_EXPIRES_IN;
    const token = jwt.sign({ userId: user._id.toString() }, env.JWT_SECRET, {
      expiresIn: expiresIn as any,
    });

    const role = user.roleId;
    const permissions = role?.permissions || [];
    const roleName = role?.name || 'CASHIER';

    return {
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: roleName,
        permissions,
        terminalLocked: user.terminalLocked,
        avatarUrl: (user as any).avatarUrl,
        lastLoginAt: user.lastLoginAt,
      },
    };
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

  async getMe(userId: string): Promise<UserProfileResponse> {
    const user = await User.findById(userId).populate<{ roleId: any }>('roleId');
    if (!user || !user.isActive) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User profile not found or inactive');
    }

    const role = user.roleId;
    return {
      id: user._id.toString(),
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: role?.name || 'CASHIER',
      permissions: role?.permissions || [],
      terminalLocked: user.terminalLocked,
      avatarUrl: (user as any).avatarUrl,
      lastLoginAt: user.lastLoginAt,
    };
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
    const user = await User.findOne({ $or: [{ username: query }, { email: query }] }).select(
      '+resetOtpHash +resetOtpExpiresAt'
    );

    const mask = env.PASSWORD_RESET_EMAIL ? maskEmail(env.PASSWORD_RESET_EMAIL) : '';

    if (!user || !user.isActive) {
      return { sent: true, maskedEmail: mask };
    }

    if (!isMailConfigured()) {
      throw new AppError(
        503,
        'EMAIL_NOT_CONFIGURED',
        'Email delivery is not set up on this server, so a reset code cannot be sent. Ask a manager or the administrator to reset your password.'
      );
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    user.resetOtpHash = await bcrypt.hash(otp, 10);
    user.resetOtpExpiresAt = new Date(Date.now() + RESET_OTP_TTL_MINUTES * 60 * 1000);
    await user.save();

    const settings = await Settings.findOne({ isDefault: true }).lean();
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
