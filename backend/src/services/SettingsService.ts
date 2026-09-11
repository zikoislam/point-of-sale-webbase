import { Settings } from '../models/Settings';
import { AppError } from '../utils/app-error';

export interface ShopSettings {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopEmail?: string;
  currencySymbol: string;
  defaultTaxRate: number;
  allowNegativeStock: boolean;
  thermalPrinterType: '58mm' | '80mm';
  barcodeLabelFormat: string;
  receiptHeader: string;
  receiptFooter: string;
  logoUrl?: string;
}

export class SettingsService {
  async getSettings(): Promise<ShopSettings> {
    const existing = await Settings.findOne().lean();
    if (existing) return existing as unknown as ShopSettings;

    // Auto-create default singleton settings
    const created = await Settings.create({
      isDefault: true,
      shopName: 'Smart Retail POS',
      shopAddress: '',
      shopPhone: '',
      shopEmail: '',
      currencySymbol: '৳',
      defaultTaxRate: 0,
      allowNegativeStock: false,
      thermalPrinterType: '80mm',
      barcodeLabelFormat: '38mm_x_25mm_2up',
      cashDrawerTriggerCode: '\\x1B\\x70\\x00\\x19\\xFA',
      receiptHeader: 'Welcome to our store!',
      receiptFooter: 'Thank you! Return policy: 7 days',
    });
    return created.toObject() as unknown as ShopSettings;
  }

  async updateSettings(data: Partial<ShopSettings>): Promise<ShopSettings> {
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: data },
      { new: true, upsert: true, runValidators: true }
    ).lean();
    if (!settings) throw new AppError(500, 'SETTINGS_ERROR', 'Failed to update settings');
    return settings as unknown as ShopSettings;
  }
}

export const settingsService = new SettingsService();
