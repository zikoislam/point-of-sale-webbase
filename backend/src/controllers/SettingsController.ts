import { Request, Response, NextFunction } from 'express';
import { settingsService } from '../services/SettingsService';
import { sendSuccess } from '../utils/api-response';

export class SettingsController {
  async getPublicSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const branding = await settingsService.getPublicBranding(req.query.org as string | undefined);
      sendSuccess(res, 200, 'Branding retrieved', branding);
    } catch (error) { next(error); }
  }

  async getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await settingsService.getSettings();
      sendSuccess(res, 200, 'Settings retrieved', settings);
    } catch (error) { next(error); }
  }

  /** Branding for the ACTIVE organization (request scope resolves the org). */
  async getBranding(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await settingsService.getSettings();
      sendSuccess(res, 200, 'Branding retrieved', {
        shopName: settings.shopName,
        logoUrl: settings.logoUrl || '',
        currencySymbol: settings.currencySymbol,
        shopAddress: settings.shopAddress,
        shopPhone: settings.shopPhone,
        // Receipt header/footer ride with the branding so the POS can print the
        // shop's own text without a cashier needing the full settings document.
        receiptHeader: settings.receiptHeader || '',
        receiptFooter: settings.receiptFooter || '',
      });
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
