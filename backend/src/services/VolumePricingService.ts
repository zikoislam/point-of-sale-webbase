import { Types } from 'mongoose';
import { VolumePricing, IVolumePricing, IVolumeTierRule } from '../models/VolumePricing';
import { Product } from '../models/Product';
import { AppError } from '../utils/app-error';
import { currentOrgId } from '../middlewares/org.context';

export interface ApplicableDiscount {
  volumePricingId: string;
  tier: IVolumeTierRule;
  discountPercent: number;
  fixedPrice: number | null;
}

export interface VolumePricingInput {
  productId: string;
  variantId?: string | null;
  customerType?: 'RETAIL' | 'WHOLESALE' | 'ALL';
  tiers: IVolumeTierRule[];
  validFrom?: string | null;
  validTo?: string | null;
  isActive?: boolean;
  notes?: string;
}

function validateTiers(tiers: IVolumeTierRule[]): void {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new AppError(400, 'NO_TIERS', 'At least one quantity tier is required');
  }
  for (const tier of tiers) {
    if (!Number.isFinite(Number(tier.minQty)) || Number(tier.minQty) < 0) {
      throw new AppError(400, 'INVALID_TIER', 'Every tier needs a minimum quantity of 0 or more');
    }
    if (tier.maxQty !== null && tier.maxQty !== undefined && Number(tier.maxQty) < Number(tier.minQty)) {
      throw new AppError(400, 'INVALID_TIER', 'A tier\'s maximum quantity cannot be below its minimum');
    }
    const discount = Number(tier.discountPercent) || 0;
    if (discount < 0 || discount > 100) {
      throw new AppError(400, 'INVALID_TIER', 'Discount must be between 0 and 100 percent');
    }
    if (tier.fixedPrice !== null && tier.fixedPrice !== undefined && Number(tier.fixedPrice) < 0) {
      throw new AppError(400, 'INVALID_TIER', 'A fixed price cannot be negative');
    }
  }
}

export class VolumePricingService {
  /**
   * The tier that applies to this product + quantity + customer type right now.
   * Variant-specific rules win over product-wide rules; inside one rule the
   * band with the highest matching minQty wins.
   */
  async getApplicableDiscount(
    productId: string,
    qty: number,
    customerType: 'RETAIL' | 'WHOLESALE' | 'ALL' = 'RETAIL',
    variantId?: string
  ): Promise<ApplicableDiscount | null> {
    // POS knows the variant — resolve the product from it when needed
    let pid = productId;
    if (!Types.ObjectId.isValid(pid) && variantId && Types.ObjectId.isValid(variantId)) {
      const product = await Product.findOne({ 'variants._id': new Types.ObjectId(variantId) })
        .select('_id')
        .lean();
      pid = product ? String(product._id) : '';
    }
    if (!Types.ObjectId.isValid(pid)) return null;

    const quantity = Number(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) return null;

    const now = new Date();
    const rules = await VolumePricing.find({
      productId: new Types.ObjectId(pid),
      isActive: true,
      customerType: { $in: [customerType, 'ALL'] },
      $and: [
        { $or: [{ validFrom: null }, { validFrom: { $exists: false } }, { validFrom: { $lte: now } }] },
        { $or: [{ validTo: null }, { validTo: { $exists: false } }, { validTo: { $gte: now } }] },
      ],
    }).lean();

    if (rules.length === 0) return null;

    // Prefer the variant-specific rule, then product-wide
    const ordered = [...(rules as any[])].sort((a, b) => {
      const aVariant = a.variantId && String(a.variantId) === String(variantId) ? 0 : 1;
      const bVariant = b.variantId && String(b.variantId) === String(variantId) ? 0 : 1;
      return aVariant - bVariant;
    });

    for (const rule of ordered) {
      const matching = (rule.tiers || [])
        .filter((t: IVolumeTierRule) => {
          const min = Number(t.minQty) || 0;
          const max = t.maxQty === null || t.maxQty === undefined ? Infinity : Number(t.maxQty);
          return quantity >= min && quantity <= max;
        })
        .sort((a: IVolumeTierRule, b: IVolumeTierRule) => Number(b.minQty) - Number(a.minQty));

      if (matching.length > 0) {
        const tier = matching[0];
        return {
          volumePricingId: String(rule._id),
          tier,
          discountPercent: Number(tier.discountPercent) || 0,
          fixedPrice:
            tier.fixedPrice === null || tier.fixedPrice === undefined ? null : Number(tier.fixedPrice),
        };
      }
    }

    return null;
  }

  async list(productId?: string): Promise<any[]> {
    const filter: Record<string, any> = {};
    if (productId && Types.ObjectId.isValid(productId)) filter.productId = new Types.ObjectId(productId);
    return VolumePricing.find(filter)
      .populate('productId', 'name variants unit')
      .sort({ createdAt: -1 })
      .lean();
  }

  async create(data: VolumePricingInput): Promise<IVolumePricing> {
    if (!Types.ObjectId.isValid(data.productId)) throw new AppError(400, 'INVALID_ID', 'Invalid product ID');
    validateTiers(data.tiers);

    const org = currentOrgId();
    if (!org) throw new AppError(403, 'ORG_CONTEXT_REQUIRED', 'No active organization selected.');

    const doc = await VolumePricing.create({
      orgId: new Types.ObjectId(org),
      productId: new Types.ObjectId(data.productId),
      variantId: data.variantId && Types.ObjectId.isValid(data.variantId) ? new Types.ObjectId(data.variantId) : null,
      customerType: data.customerType || 'ALL',
      tiers: data.tiers.map((t) => ({
        minQty: Number(t.minQty) || 0,
        maxQty: t.maxQty === null || t.maxQty === undefined ? null : Number(t.maxQty),
        discountPercent: Number(t.discountPercent) || 0,
        fixedPrice: t.fixedPrice === null || t.fixedPrice === undefined ? null : Number(t.fixedPrice),
      })),
      validFrom: data.validFrom ? new Date(data.validFrom) : null,
      validTo: data.validTo ? new Date(data.validTo) : null,
      isActive: data.isActive ?? true,
      notes: data.notes,
    });
    return doc.toObject() as unknown as IVolumePricing;
  }

  async update(id: string, data: Partial<VolumePricingInput>): Promise<IVolumePricing> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid volume pricing ID');
    const doc = await VolumePricing.findById(id);
    if (!doc) throw new AppError(404, 'VOLUME_PRICING_NOT_FOUND', 'Volume pricing rule not found');

    if (data.tiers !== undefined) {
      validateTiers(data.tiers);
      doc.tiers = data.tiers.map((t) => ({
        minQty: Number(t.minQty) || 0,
        maxQty: t.maxQty === null || t.maxQty === undefined ? null : Number(t.maxQty),
        discountPercent: Number(t.discountPercent) || 0,
        fixedPrice: t.fixedPrice === null || t.fixedPrice === undefined ? null : Number(t.fixedPrice),
      })) as any;
    }
    if (data.variantId !== undefined) {
      doc.variantId = data.variantId && Types.ObjectId.isValid(data.variantId) ? new Types.ObjectId(data.variantId) : null;
    }
    if (data.customerType !== undefined) doc.customerType = data.customerType;
    if (data.validFrom !== undefined) doc.validFrom = data.validFrom ? new Date(data.validFrom) : null;
    if (data.validTo !== undefined) doc.validTo = data.validTo ? new Date(data.validTo) : null;
    if (data.isActive !== undefined) doc.isActive = data.isActive;
    if (data.notes !== undefined) doc.notes = data.notes;

    await doc.save();
    return doc.toObject() as unknown as IVolumePricing;
  }

  async delete(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid volume pricing ID');
    const doc = await VolumePricing.findById(id);
    if (!doc) throw new AppError(404, 'VOLUME_PRICING_NOT_FOUND', 'Volume pricing rule not found');
    await doc.deleteOne();
  }
}

export const volumePricingService = new VolumePricingService();
