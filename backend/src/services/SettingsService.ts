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
  /** Purchase orders above this amount need a manager's approval (0 = never). */
  poApprovalThreshold?: number;
}

export class SettingsService {
  async getSettings(): Promise<ShopSettings> {
    const existing = await Settings.findOne().lean();
    if (existing) return existing as unknown as ShopSettings;

    // Auto-create per-org settings (orgId comes from the request scope plugin)
    const created = await Settings.create({
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
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    if (!settings) throw new AppError(500, 'SETTINGS_ERROR', 'Failed to update settings');
    return settings as unknown as ShopSettings;
  }

  /**
   * Public branding for the login screen. Unauthenticated, so it resolves the
   * organization explicitly — by slug when one is given, otherwise the first.
   */
  async getPublicBranding(orgSlug?: string) {
    let settings: any;
    if (orgSlug) {
      const { Organization } = await import('../models/Organization');
      const org = await Organization.findOne({ slug: orgSlug.toLowerCase() }).lean();
      settings = org ? await Settings.findOne({ orgId: org._id }).lean() : undefined;
    } else {
      settings = await Settings.findOne().lean();
    }
    if (!settings) {
      settings = await Settings.findOne({}).lean();
    }
    return {
      shopName: settings?.shopName || 'Smart Retail POS',
      logoUrl: settings?.logoUrl || '',
      currencySymbol: settings?.currencySymbol || '৳',
      shopAddress: settings?.shopAddress || '',
      shopPhone: settings?.shopPhone || '',
      // Paper settings ride along with the branding so the POS can size a memo
      // on any client — a cashier cannot read the full settings document.
      thermalPrinterType: settings?.thermalPrinterType || '80mm',
      memoPrintMode: settings?.memoPrintMode || 'thermal',
      memoWidthMm: settings?.memoWidthMm || 210,
      memoHeightMm: settings?.memoHeightMm || 297,
    };
  }
}

export const settingsService = new SettingsService();
