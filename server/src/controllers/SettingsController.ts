import { Request, Response, NextFunction } from 'express';
import { settingsService } from '../services/SettingsService';
import { sendSuccess } from '../utils/api-response';

export class SettingsController {
  async getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await settingsService.getSettings();
      sendSuccess(res, 200, 'Settings retrieved', settings);
    } catch (error) { next(error); }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await settingsService.updateSettings(req.body);
      sendSuccess(res, 200, 'Settings updated successfully', settings);
    } catch (error) { next(error); }
  }
}
export const settingsController = new SettingsController();
