import { Request, Response, NextFunction } from 'express';

export interface SlowRequest {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  user?: string;
  orgId?: string;
  at: string;
}

interface Bucket {
  requests: number;
  totalMs: number;
  maxMs: number;
  slow: number;
}

/**
 * Request timing with a rolling in-process profile.
 *
 * Everything above `slowMs` is logged (so a slow report is easy to spot) and
 * the per-path averages are exposed through /api/v1/system/performance.
 */
const SLOW_MS = Number(process.env.SLOW_REQUEST_MS || 1000);
const MAX_SLOW_SAMPLES = 50;

const stats = new Map<string, Bucket>();
const slowRequests: SlowRequest[] = [];
let startedAt = new Date().toISOString();

function bucketKey(req: Request): string {
  // Collapse ids so /sales/abc and /sales/def share one bucket
  const path = (req.baseUrl || '') + (req.route?.path || req.path || '');
  return `${req.method} ${path}`.replace(/\/[0-9a-f]{24}/gi, '/:id');
}

export function recordRequest(
  method: string,
  path: string,
  status: number,
  durationMs: number,
  extra: { user?: string; orgId?: string } = {}
): void {
  const key = `${method} ${path}`.replace(/\/[0-9a-f]{24}/gi, '/:id');
  const b = stats.get(key) || { requests: 0, totalMs: 0, maxMs: 0, slow: 0 };
  b.requests += 1;
  b.totalMs += durationMs;
  b.maxMs = Math.max(b.maxMs, durationMs);
  if (durationMs >= SLOW_MS) b.slow += 1;
  stats.set(key, b);

  if (durationMs >= SLOW_MS) {
    slowRequests.unshift({
      method,
      path,
      status,
      durationMs: Math.round(durationMs),
      user: extra.user,
      orgId: extra.orgId,
      at: new Date().toISOString(),
    });
    if (slowRequests.length > MAX_SLOW_SAMPLES) slowRequests.pop();
    console.warn(`🐢 slow request ${method} ${path} → ${Math.round(durationMs)}ms (status ${status})`);
  }
}

export function performanceMiddleware() {
  return function performance(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();
    // Capture the real path now — inside the finish handler req.route / baseUrl
    // have already been re-set by Express and give unstable names.
    const path = (req.originalUrl || req.url || '').split('?')[0];
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      recordRequest(req.method, path, res.statusCode, durationMs, {
        user: req.user?.username,
        orgId: req.user?.orgId,
      });
    });
    next();
  };
}

/** Snapshot for the admin performance endpoint. */
export function getPerformanceStats(limit = 25) {
  const rows = Array.from(stats.entries())
    .map(([endpoint, b]) => ({
      endpoint,
      requests: b.requests,
      avgMs: Math.round((b.totalMs / b.requests) * 10) / 10,
      maxMs: Math.round(b.maxMs),
      slowRequests: b.slow,
      slowSharePercent: Math.round((b.slow / b.requests) * 1000) / 10,
    }))
    .sort((a, b) => b.avgMs - a.avgMs);

  const totals = rows.reduce(
    (acc, r) => ({
      requests: acc.requests + r.requests,
      slow: acc.slow + r.slowRequests,
    }),
    { requests: 0, slow: 0 }
  );

  return {
    startedAt,
    slowThresholdMs: SLOW_MS,
    totals: {
      ...totals,
      endpoints: rows.length,
      slowSharePercent: totals.requests ? Math.round((totals.slow / totals.requests) * 1000) / 10 : 0,
    },
    /** Slowest endpoints by average duration. */
    endpoints: rows.slice(0, limit),
    recentSlowRequests: slowRequests.slice(0, 20),
  };
}

/** Test hook — keeps the endpoint list honest between runs. */
export function resetPerformanceStats(): void {
  stats.clear();
  slowRequests.length = 0;
  startedAt = new Date().toISOString();
}
