import { Request, Response, NextFunction } from 'express';
import { searchService } from '../services/SearchService';
import { sendSuccess } from '../utils/api-response';

class SearchController {
  async search(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await searchService.search(String(req.query.q ?? ''), {
        permissions: req.user?.permissions || [],
        isSuper: !!req.user?.isPlatformSuperAdmin,
      });
      sendSuccess(res, 200, 'Search results', data);
    } catch (err) {
      next(err);
    }
  }
}

export const searchController = new SearchController();
