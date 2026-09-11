import { Types } from 'mongoose';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { AppError } from '../utils/app-error';

export interface CategoryItem {
  id: string;
  name: string;
  code: string;
  description?: string;
  defaultTaxRate: number;
  parentId?: string;
  parentName?: string;
  isActive: boolean;
  children?: CategoryItem[];
  createdAt: Date;
}

// Generates a short uppercase code like "BEV-COLD" from a name
const makeCode = (name: string) =>
  name.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '').slice(0, 20);

export class CategoryService {
  async listCategories(flat = false): Promise<CategoryItem[]> {
    const cats = await Category.find({ isActive: true })
      .populate<{ parentId: any }>('parentId', 'name')
      .sort({ name: 1 })
      .lean();

    const formatted: CategoryItem[] = cats.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      code: c.code,
      description: c.description,
      defaultTaxRate: c.defaultTaxRate ?? 0,
      parentId: c.parentId?._id?.toString(),
      parentName: c.parentId?.name,
      isActive: c.isActive,
      createdAt: c.createdAt,
    }));

    if (flat) return formatted;

    // Build tree
    const map = new Map<string, CategoryItem & { children: CategoryItem[] }>();
    const roots: (CategoryItem & { children: CategoryItem[] })[] = [];

    formatted.forEach((c) => map.set(c.id, { ...c, children: [] }));
    map.forEach((c) => {
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.children.push(c);
      } else {
        roots.push(c);
      }
    });

    return roots;
  }

  async createCategory(data: {
    name: string;
    code?: string;
    description?: string;
    defaultTaxRate?: number;
    parentId?: string;
  }): Promise<CategoryItem> {
    if (data.parentId) {
      const parent = await Category.findById(data.parentId);
      if (!parent) throw new AppError(404, 'PARENT_NOT_FOUND', 'Parent category not found');
    }

    const code = data.code?.toUpperCase().replace(/\s+/g, '-') || makeCode(data.name);

    // Ensure code uniqueness
    const existingCode = await Category.findOne({ code });
    if (existingCode) throw new AppError(409, 'CODE_DUPLICATE', `Category code "${code}" already exists`);

    const category = await Category.create({
      name: data.name.trim(),
      code,
      description: data.description,
      defaultTaxRate: data.defaultTaxRate ?? 0,
      parentId: data.parentId ? new Types.ObjectId(data.parentId) : undefined,
      isActive: true,
    });

    return {
      id: category._id.toString(),
      name: category.name,
      code: category.code,
      description: category.description,
      defaultTaxRate: category.defaultTaxRate ?? 0,
      parentId: category.parentId?.toString(),
      isActive: category.isActive,
      createdAt: category.createdAt,
    };
  }

  async updateCategory(
    id: string,
    data: { name?: string; description?: string; defaultTaxRate?: number; parentId?: string | null }
  ): Promise<CategoryItem> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid category ID');

    const category = await Category.findById(id);
    if (!category) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');

    if (data.name) category.name = data.name.trim();
    if (data.description !== undefined) category.description = data.description;
    if (data.defaultTaxRate !== undefined) category.defaultTaxRate = data.defaultTaxRate;
    if (data.parentId !== undefined) {
      category.parentId = data.parentId ? new Types.ObjectId(data.parentId) : undefined;
    }

    await category.save();
    return this.getCategoryById(id);
  }

  async getCategoryById(id: string): Promise<CategoryItem> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid category ID');
    const c = await Category.findById(id).populate<{ parentId: any }>('parentId', 'name').lean();
    if (!c) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
    return {
      id: c._id.toString(),
      name: c.name,
      code: c.code,
      description: c.description,
      defaultTaxRate: c.defaultTaxRate ?? 0,
      parentId: c.parentId?._id?.toString(),
      parentName: c.parentId?.name,
      isActive: c.isActive,
      createdAt: c.createdAt,
    };
  }

  async deleteCategory(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid category ID');

    const productCount = await Product.countDocuments({ categoryId: id, isActive: true });
    if (productCount > 0) {
      throw new AppError(409, 'CATEGORY_HAS_DEPENDENTS', `Cannot delete — ${productCount} active product(s) in this category`);
    }

    const subCount = await Category.countDocuments({ parentId: id, isActive: true });
    if (subCount > 0) {
      throw new AppError(409, 'CATEGORY_HAS_DEPENDENTS', `Cannot delete — ${subCount} sub-categorie(s) exist`);
    }

    const result = await Category.findByIdAndUpdate(id, { isActive: false });
    if (!result) throw new AppError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
  }
}

export const categoryService = new CategoryService();
