import mongoose, { Types } from 'mongoose';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { AppError } from '../utils/app-error';

export interface ProductVariantInput {
  attributeName: string;
  sku: string;
  barcode?: string;
  costPrice: number;
  retailSellingPrice: number;
  wholesaleSellingPrice: number;
  currentStock: number;
  alertQty: number;
  unit: string;
}

export interface ProductInput {
  name: string;
  description?: string;
  categoryId: string;
  brandId?: string;
  supplierId?: string;
  unit: string;
  taxType: 'INCLUSIVE' | 'EXCLUSIVE' | 'EXEMPT';
  taxRate: number;
  variants: ProductVariantInput[];
}

export interface ProductListItem {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  brandId?: string;
  brandName?: string;
  unit: string;
  taxType: string;
  taxRate: number;
  isActive: boolean;
  variantCount: number;
  totalStock: number;
  lowestRetailPrice: number;
  lowestCostPrice?: number; // hidden for cashier
  createdAt: Date;
}

const CASHIER_ROLE = 'CASHIER';

export class ProductService {
  async listProducts(options: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    brandId?: string;
    lowStock?: boolean;
    userRole?: string;
  }): Promise<{ products: ProductListItem[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { isActive: true };
    if (options.search) filter.$text = { $search: options.search };
    if (options.categoryId) filter.categoryId = new Types.ObjectId(options.categoryId);
    if (options.brandId) filter.brandId = new Types.ObjectId(options.brandId);
    if (options.lowStock) filter['variants.currentStock'] = { $lte: filter['variants.alertQty'] || 10 };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate<{ categoryId: any }>('categoryId', 'name')
        .populate<{ brandId: any }>('brandId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    const isCashier = options.userRole === CASHIER_ROLE;

    const formatted: ProductListItem[] = products.map((p) => {
      const totalStock = (p.variants || []).reduce((sum: number, v: any) => sum + (v.currentStock || 0), 0);
      const lowestRetail = Math.min(...(p.variants || []).map((v: any) => v.retailSellingPrice || 0));
      const lowestCost = Math.min(...(p.variants || []).map((v: any) => v.costPrice || 0));

      const item: ProductListItem = {
        id: p._id.toString(),
        name: p.name,
        categoryId: p.categoryId?._id?.toString() || '',
        categoryName: p.categoryId?.name,
        brandId: p.brandId?._id?.toString(),
        brandName: p.brandId?.name,
        unit: p.unit,
        taxType: p.taxType,
        taxRate: p.taxRate,
        isActive: p.isActive,
        variantCount: (p.variants || []).length,
        totalStock,
        lowestRetailPrice: lowestRetail,
        createdAt: p.createdAt,
      };

      if (!isCashier) item.lowestCostPrice = lowestCost;
      return item;
    });

    return { products: formatted, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getProductById(id: string, userRole?: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid product ID');

    const product = await Product.findById(id)
      .populate('categoryId', 'name defaultTaxRate')
      .populate('brandId', 'name')
      .populate('supplierId', 'name')
      .lean();

    if (!product || !product.isActive) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');

    const isCashier = userRole === CASHIER_ROLE;
    if (isCashier && product.variants) {
      product.variants = product.variants.map((v: any) => {
        const { costPrice, ...rest } = v;
        return rest;
      });
    }

    return product;
  }

  async getProductByBarcode(barcode: string, userRole?: string): Promise<any> {
    const product = await Product.findOne({
      'variants.barcode': barcode,
      isActive: true,
    })
      .populate('categoryId', 'name defaultTaxRate')
      .populate('brandId', 'name')
      .lean();

    if (!product) throw new AppError(404, 'PRODUCT_NOT_FOUND', `No product with barcode: ${barcode}`);

    const isCashier = userRole === CASHIER_ROLE;
    if (isCashier && product.variants) {
      product.variants = product.variants.map((v: any) => {
        const { costPrice, ...rest } = v;
        return rest;
      });
    }

    return product;
  }

  async createProduct(data: ProductInput): Promise<any> {
    // Validate category
    if (!Types.ObjectId.isValid(data.categoryId)) throw new AppError(400, 'INVALID_ID', 'Invalid category ID');
    const category = await Category.findById(data.categoryId);
    if (!category) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');

    // Check SKU uniqueness
    for (const variant of data.variants) {
      const existing = await Product.findOne({ 'variants.sku': variant.sku, isActive: true });
      if (existing) throw new AppError(409, 'SKU_DUPLICATE', `SKU "${variant.sku}" already exists`);
    }

    // Inherit tax rate from category if not specified
    const taxRate = data.taxRate ?? category.defaultTaxRate ?? 0;

    const product = await Product.create({
      name: data.name.trim(),
      description: data.description,
      categoryId: data.categoryId,
      brandId: data.brandId || null,
      supplierId: data.supplierId || null,
      unit: data.unit,
      taxType: data.taxType,
      taxRate,
      variants: data.variants,
      isActive: true,
    });

    return product;
  }

  async updateProduct(id: string, data: Partial<ProductInput>): Promise<any> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid product ID');

    const product = await Product.findById(id);
    if (!product || !product.isActive) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');

    Object.assign(product, data);
    await product.save();
    return product;
  }

  async deleteProduct(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid product ID');
    const result = await Product.findByIdAndUpdate(id, { isActive: false });
    if (!result) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
  }
}

export const productService = new ProductService();
