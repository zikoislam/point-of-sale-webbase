import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/api-response';

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    sendError(
      res,
      429,
      'RATE_LIMIT_EXCEEDED',
      'Too many login attempts. Please try again after 1 minute.'
    );
  },
});
