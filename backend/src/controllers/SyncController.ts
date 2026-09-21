import { Request, Response, NextFunction } from 'express';
import { syncService } from '../sync/SyncService';
import { sendSuccess } from '../utils/api-response';

class SyncController {
  async status(_req: Request, res: Response, next: NextFunction) {
    try {
      const status = await syncService.status();
      sendSuccess(res, 200, 'Sync status fetched', status);
    } catch (err) {
      next(err);
    }
  }

  async runNow(_req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await syncService.runOnce();
      sendSuccess(res, 200, 'Sync run completed', summary);
    } catch (err) {
      next(err);
    }
  }
}

export const syncController = new SyncController();
