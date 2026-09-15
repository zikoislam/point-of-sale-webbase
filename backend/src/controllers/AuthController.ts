import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/AuthService';
import { sendSuccess } from '../utils/api-response';
import { authCookieOptions } from '../utils/cookie';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password, rememberMe } = req.body;
      const result = await authService.login(username, password, rememberMe);

      // Set HTTP-only cookie
      const maxAge = rememberMe
        ? 30 * 24 * 60 * 60 * 1000 // 30 days
        : 8 * 60 * 60 * 1000; // 8 hours

      res.cookie('pos_token', result.token, {
        ...authCookieOptions(),
        maxAge,
      });

      sendSuccess(res, 200, 'Login successful', result);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.token && req.user) {
        await authService.logout(req.token, req.user.userId);
      }

      res.clearCookie('pos_token', authCookieOptions());

      sendSuccess(res, 200, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getMe(req.user!.userId);
      sendSuccess(res, 200, 'User profile retrieved successfully', user);
    } catch (error) {
      next(error);
    }
  }

  async lockTerminal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.lockTerminal(req.user!.userId);
      sendSuccess(res, 200, 'Terminal locked successfully');
    } catch (error) {
      next(error);
    }
  }

  async unlockTerminal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { pin } = req.body;
      await authService.unlockTerminal(req.user!.userId, pin);
      sendSuccess(res, 200, 'Terminal unlocked successfully');
    } catch (error) {
      next(error);
    }
  }

  /** Step 1 of "forgot password" — emails a 6-digit reset code. */
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username } = req.body;
      const result = await authService.requestPasswordReset(username);
      sendSuccess(
        res,
        200,
        'If that account exists, a reset code has been sent to the recovery email.',
        result
      );
    } catch (error) {
      next(error);
    }
  }

  /** Step 2 — verifies the code and sets the new password. */
  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, otp, newPassword } = req.body;
      const result = await authService.resetPassword(username, otp, newPassword);
      sendSuccess(res, 200, 'Password updated. You can sign in now.', result);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
