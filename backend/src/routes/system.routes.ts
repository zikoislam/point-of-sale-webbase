import { Router } from 'express';
import { Request, Response, NextFunction } from 'express';
import { getPerformanceStats, resetPerformanceStats } from '../middlewares/performance.middleware';
import { getReportCacheStats, clearReportCache } from '../middlewares/report-cache.middleware';
import { sendSuccess } from '../utils/api-response';
import { requirePermissions } from '../middlewares/rbac.middleware';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts.
const router = Router();

/** Slow-endpoint profile for the whole server process. */
router.get('/performance', requirePermissions('settings:manage'), (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, 200, 'Performance profile retrieved', getPerformanceStats());
  } catch (err) { next(err); }
});

router.post('/performance/reset', requirePermissions('settings:manage'), (req: Request, res: Response, next: NextFunction) => {
  try {
    resetPerformanceStats();
    sendSuccess(res, 200, 'Performance profile reset', { ok: true });
  } catch (err) { next(err); }
});

/** Report cache effectiveness — the number that proves it is worth keeping. */
router.get('/cache', requirePermissions('settings:manage'), (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, 200, 'Report cache stats retrieved', getReportCacheStats());
  } catch (err) { next(err); }
});

router.post('/cache/clear', requirePermissions('settings:manage'), (req: Request, res: Response, next: NextFunction) => {
  try {
    clearReportCache();
    sendSuccess(res, 200, 'Report cache cleared', { ok: true });
  } catch (err) { next(err); }
});

export default router;
