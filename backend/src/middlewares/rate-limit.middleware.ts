import rateLimit from 'express-rate-limit';

/**
 * Rate limits sized to how each surface is actually used:
 *  - POS: a till hammers the API during a rush, so it gets a generous window.
 *  - Reports: expensive aggregations, deliberately tight.
 *  - Exports: PDF/Excel generation is the heaviest call in the system.
 *
 * Keyed by user when available (a shop behind one NAT IP still works), falling
 * back to the IP for anonymous traffic.
 */
const keyGenerator = (req: any): string => req.user?.userId || req.ip;

const handler = (scope: string) => (req: any, res: any) => {
  res.status(429).json({
    success: false,
    statusCode: 429,
    message: `Too many ${scope} requests. Please slow down and try again shortly.`,
    error: {
      code: 'RATE_LIMITED',
      message: `Too many ${scope} requests. Please slow down and try again shortly.`,
      details: [],
    },
    timestamp: new Date().toISOString(),
  });
};

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  // Tests / probes can disable limiting entirely
  skip: () => process.env.DISABLE_RATE_LIMIT === '1',
} as const;

/** POS checkout & sync — 200 requests per minute per till. */
export const posLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_POS || 200),
  handler: handler('POS'),
});

/** Report reads — 30 per minute: reporting is a heavy aggregation. */
export const reportLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_REPORTS || 30),
  handler: handler('report'),
});

/** File exports — 10 per minute: each one renders a document. */
export const exportLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_EXPORTS || 10),
  handler: handler('export'),
});
