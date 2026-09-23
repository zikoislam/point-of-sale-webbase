import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISettings extends Document {
  _id: Types.ObjectId;
  isDefault: boolean; // Unique Index: only one active settings document
  shopName: string; // e.g. "Al-Amin Traders"
  shopAddress: string;
  shopPhone: string;
  shopEmail?: string;
  currencySymbol: string; // e.g. "৳" or "BDT"
  defaultTaxRate: number; // System-wide fallback VAT %
  allowNegativeStock: boolean; // Toggle: allow POS sales when stock = 0
  thermalPrinterType: '58mm' | '80mm';
  /**
   * How sale memos are printed:
   *  - `thermal` → a narrow receipt on a 58mm/80mm roll (thermalPrinterType)
   *  - `a4`      → a full page on an ordinary printer
   *  - `custom`  → an ordinary printer loaded with a non-standard sheet
   */
  memoPrintMode: 'thermal' | 'a4' | 'custom';
  /** Sheet width in millimetres, used when memoPrintMode is `custom`. */
  memoWidthMm: number;
  /** Sheet height in millimetres, used when memoPrintMode is `custom`. */
  memoHeightMm: number;
  barcodeLabelFormat: string; // e.g. "38mm_x_25mm_2up"
  cashDrawerTriggerCode: string; // ESC/POS hex, e.g. "\\x1B\\x70\\x00\\x19\\xFA"
  receiptHeader: string; // Custom text printed at top of receipts
  receiptFooter: string; // e.g. "Thank you! Return policy: 7 days"
  logoUrl?: string;
  /**
   * Books are closed up to and including this day. Posting a voucher dated on or
   * before it is refused, so a closed year cannot be altered by accident.
   */
  booksClosedUpTo?: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    isDefault: {
      type: Boolean,
      default: true,
      unique: true,
      required: true,
    },
    shopName: {
      type: String,
      required: true,
      default: 'Smart Retail POS',
      trim: true,
    },
    shopAddress: {
      type: String,
      required: true,
      default: 'Dhaka, Bangladesh',
      trim: true,
    },
    shopPhone: {
      type: String,
      required: true,
      default: '+8801700000000',
      trim: true,
    },
    shopEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    currencySymbol: {
      type: String,
      required: true,
      default: '৳',
      trim: true,
    },
    defaultTaxRate: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 100,
    },
    allowNegativeStock: {
      type: Boolean,
      default: false,
      required: true,
    },
    thermalPrinterType: {
      type: String,
      enum: ['58mm', '80mm'],
      default: '80mm',
      required: true,
    },
    memoPrintMode: {
      type: String,
      enum: ['thermal', 'a4', 'custom'],
      default: 'thermal',
      required: true,
    },
    memoWidthMm: {
      type: Number,
      default: 210,
      min: 20,
      max: 1000,
    },
    memoHeightMm: {
      type: Number,
      default: 297,
      min: 20,
      max: 1000,
    },
    barcodeLabelFormat: {
      type: String,
      default: '38mm_x_25mm_2up',
      trim: true,
    },
    cashDrawerTriggerCode: {
      type: String,
      default: '\\x1B\\x70\\x00\\x19\\xFA',
      trim: true,
    },
    receiptHeader: {
      type: String,
      default: 'Welcome to our shop!',
      trim: true,
    },
    receiptFooter: {
      type: String,
      default: 'Thank you for shopping with us! Please come again.',
      trim: true,
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    booksClosedUpTo: {
      type: Date,
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    versionKey: false,
    collection: 'settings',
  }
);

export const Settings = mongoose.model<ISettings>('Settings', SettingsSchema);
