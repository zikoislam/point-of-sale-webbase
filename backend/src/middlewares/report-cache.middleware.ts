import { Request, Response, NextFunction } from 'express';
import { currentOrgId } from './org.context';

interface CacheEntry {
  status: number;
  body: any;
  expiresAt: number;
  version: number;
  hits: number;
}

/**
 * Short-lived in-process cache for report responses.
 *
 * Reports are read-only, expensive aggregations that managers refresh often —
 * a 60-second TTL removes most of that load without ever serving stale data
 * across a write: every mutation bumps the organization's version, and any
 * entry older than the current version is ignored.
 *
 * Keys are scoped per organization *and* per user, so one tenant or one user
 * can never be served another's payload. The shape is deliberately the same
 * one a Redis implementation would use — swapping in Redis later is a matter
 * of replacing the two maps.
 */
const store = new Map<string, CacheEntry>();
const versions = new Map<string, number>();
const MAX_ENTRIES = 500;

let hits = 0;
let misses = 0;

function orgVersion(orgId: string): number {
  return versions.get(orgId) || 0;
}

/** Called from the mutation guard below — invalidates a tenant's cache. */
export function invalidateReportCache(orgId?: string): void {
  if (orgId) versions.set(orgId, orgVersion(orgId) + 1);
  else versions.clear();
}

function cacheKey(req: Request, userId: string): string | null {
  const orgId = currentOrgId();
  if (!orgId) return null;
  const query = new URLSearchParams(
    Object.entries(req.query as Record<string, any>)
      .filter(([k]) => k !== 'noCache')
      .map(([k, v]) => [k, String(v)])
      .sort()
  ).toString();
  return `${orgId}|${userId}|${req.path}${query ? `?${query}` : ''}`;
}

export function reportCache(ttlSeconds = 60) {
  const ttlMs = ttlSeconds * 1000;

  return function reportCacheMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (req.method !== 'GET' || req.query.noCache === '1' || !req.user) return next();

    const key = cacheKey(req, req.user.userId);
    if (!key) return next();

    const orgId = currentOrgId()!;
    const entry = store.get(key);
    if (entry && entry.expiresAt > Date.now() && entry.version === orgVersion(orgId)) {
      entry.hits += 1;
      hits += 1;
      res.setHeader('X-Cache', `HIT (${entry.hits})`);
      res.setHeader('X-Cache-TTL', String(Math.round((entry.expiresAt - Date.now()) / 1000)));
      res.status(entry.status).json(entry.body);
      return;
    }

    misses += 1;
    const originalJson = res.json.bind(res);
    res.json = function json(body: any) {
      // Only cache successful payloads
      if (res.statusCode >= 200 && res.statusCode < 300) {
        if (store.size >= MAX_ENTRIES) {
          // Drop the oldest entry (Map preserves insertion order)
          const oldest = store.keys().next().value;
          if (oldest) store.delete(oldest);
        }
        store.set(key, {
          status: res.statusCode,
          body,
          expiresAt: Date.now() + ttlMs,
          version: orgVersion(orgId),
          hits: 0,
        });
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    } as any;

    next();
  };
}

/**
 * Any state-changing request to an organization drops that organization's
 * cached reports, so a refreshed report always reflects the last write.
 */
export function reportCacheInvalidation() {
  return function invalidate(req: Request, _res: Response, next: NextFunction): void {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      const orgId = currentOrgId();
      if (orgId) invalidateReportCache(orgId);
    }
    next();
  };
}

export function getReportCacheStats() {
  const total = hits + misses;
  return {
    entries: store.size,
    maxEntries: MAX_ENTRIES,
    hits,
    misses,
    hitRatePercent: total ? Math.round((hits / total) * 1000) / 10 : 0,
    organizations: versions.size,
  };
}

export function clearReportCache(): void {
  store.clear();
}
