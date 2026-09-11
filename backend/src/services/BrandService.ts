import { Types } from 'mongoose';
import { Brand } from '../models/Brand';
import { Product } from '../models/Product';
import { AppError } from '../utils/app-error';

export interface BrandItem {
  id: string;
  name: string;
  originCountry?: string;
  logoUrl?: string;
  isActive: boolean;
  createdAt: Date;
}

export class BrandService {
  async listBrands(): Promise<BrandItem[]> {
    const brands = await Brand.find({ isActive: true }).sort({ name: 1 }).lean();
    return brands.map((b) => ({
      id: b._id.toString(),
      name: b.name,
      originCountry: b.originCountry,
      logoUrl: b.logoUrl,
      isActive: b.isActive,
      createdAt: b.createdAt,
    }));
  }

  async createBrand(data: { name: string; originCountry?: string; logoUrl?: string }): Promise<BrandItem> {
    const existing = await Brand.findOne({ name: { $regex: new RegExp(`^${data.name.trim()}$`, 'i') } });
    if (existing) throw new AppError(409, 'BRAND_EXISTS', `Brand "${data.name}" already exists`);

    const brand = await Brand.create({
      name: data.name.trim(),
      originCountry: data.originCountry,
      logoUrl: data.logoUrl,
      isActive: true,
    });

    return {
      id: brand._id.toString(),
      name: brand.name,
      originCountry: brand.originCountry,
      logoUrl: brand.logoUrl,
      isActive: brand.isActive,
      createdAt: brand.createdAt,
    };
  }

  async updateBrand(
    id: string,
    data: { name?: string; originCountry?: string; logoUrl?: string }
  ): Promise<BrandItem> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid brand ID');
    const brand = await Brand.findById(id);
    if (!brand) throw new AppError(404, 'BRAND_NOT_FOUND', 'Brand not found');

    if (data.name) brand.name = data.name.trim();
    if (data.originCountry !== undefined) brand.originCountry = data.originCountry;
    if (data.logoUrl !== undefined) brand.logoUrl = data.logoUrl;

    await brand.save();

    return {
      id: brand._id.toString(),
      name: brand.name,
      originCountry: brand.originCountry,
      logoUrl: brand.logoUrl,
      isActive: brand.isActive,
      createdAt: brand.createdAt,
    };
  }

  async deleteBrand(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid brand ID');

    const productCount = await Product.countDocuments({ brandId: id, isActive: true });
    if (productCount > 0) {
      throw new AppError(409, 'BRAND_HAS_DEPENDENTS', `Cannot delete — ${productCount} active product(s) use this brand`);
    }

    const result = await Brand.findByIdAndUpdate(id, { isActive: false });
    if (!result) throw new AppError(404, 'BRAND_NOT_FOUND', 'Brand not found');
  }
}

export const brandService = new BrandService();
