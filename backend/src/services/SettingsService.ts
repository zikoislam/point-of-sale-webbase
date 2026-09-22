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
  memoPrintMode: 'thermal' | 'a4' | 'custom';
  memoWidthMm: number;
  memoHeightMm: number;
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
      memoPrintMode: 'thermal',
      memoWidthMm: 210,
      memoHeightMm: 297,
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

  async getPublicBranding() {
    const settings = await this.getSettings();
    return {
      shopName: settings.shopName,
      logoUrl: settings.logoUrl || '',
      currencySymbol: settings.currencySymbol,
      shopAddress: settings.shopAddress,
      shopPhone: settings.shopPhone,
      // Paper settings ride along with the branding so the POS can size a memo
      // on any client — a cashier cannot read the full settings document.
      thermalPrinterType: settings.thermalPrinterType || '80mm',
      memoPrintMode: settings.memoPrintMode || 'thermal',
      memoWidthMm: settings.memoWidthMm || 210,
      memoHeightMm: settings.memoHeightMm || 297,
    };
  }
}

export const settingsService = new SettingsService();
