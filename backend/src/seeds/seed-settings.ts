import { Settings } from '../models/Settings';

export const seedSettings = async (): Promise<void> => {
  const existingSettings = await Settings.findOne({ isDefault: true });
  if (!existingSettings) {
    const settings = new Settings({
      isDefault: true,
      shopName: 'Smart Retail POS',
      shopAddress: 'Dhaka, Bangladesh',
      shopPhone: '+8801700000000',
      shopEmail: 'info@possystem.com',
      currencySymbol: '৳',
      defaultTaxRate: 5,
      allowNegativeStock: false,
      thermalPrinterType: '80mm',
      barcodeLabelFormat: '38mm_x_25mm_2up',
      cashDrawerTriggerCode: '\\x1B\\x70\\x00\\x19\\xFA',
      receiptHeader: 'Welcome to Smart Retail POS',
      receiptFooter: 'Thank you for shopping with us! Please come again.',
    });
    await settings.save();
    console.log('✅ Default shop settings created');
  } else {
    console.log('ℹ️ Default shop settings already exist');
  }
};
