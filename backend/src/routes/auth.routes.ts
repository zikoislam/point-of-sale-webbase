import { Router } from 'express';
import { authController } from '../controllers/AuthController';
import { authenticate } from '../middlewares/auth.middleware';
import { authRateLimiter, pinRateLimiter } from '../middlewares/rate-limiter.middleware';
import { validate } from '../middlewares/validation.middleware';
import { loginSchema, unlockTerminalSchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/auth.validators';

const router = Router();

// Public routes
router.post('/login', authRateLimiter, validate(loginSchema), (req, res, next) => authController.login(req, res, next));

// Forgot password: request a 6-digit code by email, then exchange it for a new
// password. Rate limited like login so it cannot be used to spam an inbox.
router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), (req, res, next) => authController.forgotPassword(req, res, next));
router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), (req, res, next) => authController.resetPassword(req, res, next));

// Protected routes
router.post('/logout', authenticate, (req, res, next) => authController.logout(req, res, next));
router.get('/me', authenticate, (req, res, next) => authController.getMe(req, res, next));
router.post('/lock-terminal', authenticate, (req, res, next) => authController.lockTerminal(req, res, next));
router.post('/unlock-terminal', authenticate, pinRateLimiter, validate(unlockTerminalSchema), (req, res, next) => authController.unlockTerminal(req, res, next));

export default router;
