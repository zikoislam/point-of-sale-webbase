import { Types } from 'mongoose';
import { PriceTier, IPriceTier } from '../models/PriceTier';
import { AppError } from '../utils/app-error';
import { CreatePriceTierInput, UpdatePriceTierInput } from '../validators/price-tier.validators';

export interface PriceTierItem {
  id: string;
  name: string;
  discountPercent: number;
  priority: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
}

const RETAIL_SEED = { name: 'Retail', discountPercent: 0, priority: 0, isDefault: true, isActive: true };
const WHOLESALE_SEED = { name: 'Wholesale', discountPercent: 0, priority: 10, isDefault: false, isActive: true };

export class PriceTierService {
  private toItem(t: IPriceTier): PriceTierItem {
    return {
      id: t._id.toString(),
      name: t.name,
      discountPercent: t.discountPercent,
      priority: t.priority,
      isDefault: t.isDefault,
      isActive: t.isActive,
      createdAt: t.createdAt,
    };
  }

  /** Lists tiers, lazily seeding the classic Retail/Wholesale pair for orgs that predate the module. */
  async list(): Promise<PriceTierItem[]> {
    let tiers = await PriceTier.find().sort({ priority: 1, name: 1 }).lean();
    if (tiers.length === 0) {
      await PriceTier.create([RETAIL_SEED, WHOLESALE_SEED]);
      tiers = await PriceTier.find().sort({ priority: 1, name: 1 }).lean();
    }
    return tiers.map((t) => this.toItem(t as unknown as IPriceTier));
  }

  async create(data: CreatePriceTierInput): Promise<PriceTierItem> {
    const existing = await PriceTier.findOne({ name: data.name.trim() }).lean();
    if (existing) throw new AppError(409, 'TIER_EXISTS', `Price tier "${data.name}" already exists`);

    if (data.isDefault) {
      await PriceTier.updateMany({}, { $set: { isDefault: false } });
    }

    const tier = await PriceTier.create({
      name: data.name.trim(),
      discountPercent: data.discountPercent,
      priority: data.priority ?? 0,
      isDefault: !!data.isDefault,
      isActive: data.isActive ?? true,
    });
    return this.toItem(tier);
  }

  async update(id: string, data: UpdatePriceTierInput): Promise<PriceTierItem> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid price tier ID');
    const tier = await PriceTier.findById(id);
    if (!tier) throw new AppError(404, 'TIER_NOT_FOUND', 'Price tier not found');

    if (data.name !== undefined) {
      const clash = await PriceTier.findOne({ name: data.name.trim(), _id: { $ne: tier._id } }).lean();
      if (clash) throw new AppError(409, 'TIER_EXISTS', `Price tier "${data.name}" already exists`);
      tier.name = data.name.trim();
    }
    if (data.discountPercent !== undefined) tier.discountPercent = data.discountPercent;
    if (data.priority !== undefined) tier.priority = data.priority;
    if (data.isActive !== undefined) tier.isActive = data.isActive;
    if (data.isDefault !== undefined) {
      if (data.isDefault) await PriceTier.updateMany({ _id: { $ne: tier._id } }, { $set: { isDefault: false } });
      tier.isDefault = data.isDefault;
    }

    await tier.save();
    return this.toItem(tier);
  }

  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid price tier ID');
    const tier = await PriceTier.findById(id);
    if (!tier) throw new AppError(404, 'TIER_NOT_FOUND', 'Price tier not found');

    const { Customer } = await import('../models/Customer');
    const inUse = await Customer.countDocuments({ priceTierId: tier._id });
    if (inUse > 0) {
      // Soft-deactivate instead — history keeps referring to the tier
      tier.isActive = false;
      await tier.save();
      throw new AppError(
        409,
        'TIER_IN_USE',
        `${inUse} customer(s) still use this tier. It was deactivated instead of deleted.`
      );
    }
    await tier.deleteOne();
  }
}

export const priceTierService = new PriceTierService();
