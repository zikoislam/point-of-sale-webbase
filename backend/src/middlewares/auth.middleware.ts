import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { TokenBlacklist } from '../models/TokenBlacklist';
import { sendError } from '../utils/api-response';

export interface AuthUser {
  _id: any;
  userId: string;
  username: string;
  fullName: string;
  role: string;
  permissions: string[];
  terminalLocked: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      token?: string;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;

    // Check HTTP-only cookie first
    if (req.cookies && req.cookies.pos_token) {
      token = req.cookies.pos_token;
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      sendError(res, 401, 'AUTH_REQUIRED', 'Authentication required. Please login.');
      return;
    }

    // Check if token is blacklisted via SHA-256 hash
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const blacklisted = await TokenBlacklist.findOne({ tokenHash });
    if (blacklisted) {
      sendError(res, 401, 'TOKEN_REVOKED', 'Session has been invalidated. Please login again.');
      return;
    }

    // Verify JWT
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    if (!decoded || !decoded.userId) {
      sendError(res, 401, 'INVALID_TOKEN', 'Invalid authentication token.');
      return;
    }

    // Find User and populate Role
    const user = await User.findById(decoded.userId).populate<{ roleId: any }>('roleId');
    if (!user || !user.isActive) {
      sendError(res, 401, 'USER_DEACTIVATED', 'Account is deactivated or does not exist.');
      return;
    }

    const role = user.roleId;
    const permissions: string[] = role && role.permissions ? role.permissions : [];
    const roleName: string = role && role.name ? role.name : 'CASHIER';

    req.user = {
      _id: user._id,
      userId: user._id.toString(),
      username: user.username,
      fullName: user.fullName,
      role: roleName,
      permissions,
      terminalLocked: user.terminalLocked,
    };
    req.token = token;

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      sendError(res, 401, 'TOKEN_EXPIRED', 'Authentication token has expired. Please login again.');
      return;
    }
    if (error.name === 'JsonWebTokenError') {
      sendError(res, 401, 'INVALID_TOKEN', 'Malformed or invalid authentication token.');
      return;
    }
    next(error);
  }
};
