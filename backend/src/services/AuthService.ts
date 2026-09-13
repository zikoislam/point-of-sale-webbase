import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { User, IUser } from '../models/User';
import { Role } from '../models/Role';
import { TokenBlacklist } from '../models/TokenBlacklist';
import { AppError } from '../utils/app-error';

export interface UserProfileResponse {
  id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  permissions: string[];
  terminalLocked: boolean;
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
}

export const authService = new AuthService();
