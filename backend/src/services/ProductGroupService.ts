import { Types } from 'mongoose';
import { ProductGroup, IProductGroup } from '../models/ProductGroup';
import { Product } from '../models/Product';
import { AppError } from '../utils/app-error';
import { currentOrgId } from '../middlewares/org.context';
import { CreateProductGroupInput, UpdateProductGroupInput } from '../validators/product-group.validators';

function resolveOrgId(explicit?: string): string {
  const orgId = explicit && Types.ObjectId.isValid(explicit) ? explicit : currentOrgId();
  if (!orgId) {
    throw new AppError(403, 'ORG_CONTEXT_REQUIRED', 'No active organization selected.');
  }
  return orgId;
}

export class ProductGroupService {
  /** All groups of the organization, each with how many products it holds. */
  async list(orgId?: string): Promise<Array<IProductGroup & { productCount: number }>> {
    const filter: Record<string, any> = {};
    const org = orgId && Types.ObjectId.isValid(orgId) ? orgId : currentOrgId();
    if (org) filter.orgId = new Types.ObjectId(org);

    const groups = await ProductGroup.find(filter).sort({ name: 1 }).lean();

    // One aggregate gives the product count for every group at once
    const productFilter: Record<string, any> = {};
    if (org) productFilter.orgId = new Types.ObjectId(org);
    const counts = await Product.aggregate([
      { $match: productFilter },
      { $unwind: '$groups' },
      { $group: { _id: '$groups', count: { $sum: 1 } } },
    ]);
    const countByGroup = new Map(counts.map((c: any) => [String(c._id), c.count]));

    return groups.map((g: any) => ({
      ...g,
      productCount: countByGroup.get(String(g._id)) || 0,
    })) as unknown as Array<IProductGroup & { productCount: number }>;
  }

  async create(data: CreateProductGroupInput, orgId?: string): Promise<IProductGroup> {
    const org = resolveOrgId(orgId);

    const clash = await ProductGroup.findOne({ orgId: new Types.ObjectId(org), name: data.name }).lean();
    if (clash) throw new AppError(409, 'GROUP_EXISTS', `Product group "${data.name}" already exists`);

    if (data.parentGroupId && !Types.ObjectId.isValid(data.parentGroupId)) {
      throw new AppError(400, 'INVALID_ID', 'Invalid parent group ID');
    }

    const group = await ProductGroup.create({
      orgId: new Types.ObjectId(org),
      name: data.name,
      description: data.description,
      parentGroupId: data.parentGroupId ? new Types.ObjectId(data.parentGroupId) : null,
      isActive: data.isActive ?? true,
    });
    return group.toObject() as unknown as IProductGroup;
  }

  async update(id: string, data: UpdateProductGroupInput): Promise<IProductGroup> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid group ID');
    const group = await ProductGroup.findById(id);
    if (!group) throw new AppError(404, 'GROUP_NOT_FOUND', 'Product group not found');

    if (data.name !== undefined && data.name !== group.name) {
      const clash = await ProductGroup.findOne({ name: data.name, _id: { $ne: group._id } }).lean();
      if (clash) throw new AppError(409, 'GROUP_EXISTS', `Product group "${data.name}" already exists`);
      group.name = data.name;
    }
    if (data.description !== undefined) group.description = data.description;
    if (data.isActive !== undefined) group.isActive = data.isActive;
    if (data.parentGroupId !== undefined) {
      if (data.parentGroupId && !Types.ObjectId.isValid(data.parentGroupId)) {
        throw new AppError(400, 'INVALID_ID', 'Invalid parent group ID');
      }
      const parentId = data.parentGroupId ? new Types.ObjectId(data.parentGroupId) : null;
      if (parentId && String(parentId) === String(group._id)) {
        throw new AppError(400, 'INVALID_PARENT', 'A group cannot be its own parent');
      }
      group.parentGroupId = parentId;
    }

    await group.save();
    return group.toObject() as unknown as IProductGroup;
  }

  /** Deletes the group, detaches sub-groups and pulls it off every product. */
  async delete(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) throw new AppError(400, 'INVALID_ID', 'Invalid group ID');
    const group = await ProductGroup.findById(id);
    if (!group) throw new AppError(404, 'GROUP_NOT_FOUND', 'Product group not found');

    await ProductGroup.updateMany({ parentGroupId: group._id }, { $set: { parentGroupId: null } });
    await Product.updateMany({ groups: group._id }, { $pull: { groups: group._id } });
    await group.deleteOne();
  }

  /** Products that belong to a group. */
  async getProductsByGroup(groupId: string, orgId?: string): Promise<any[]> {
    if (!Types.ObjectId.isValid(groupId)) throw new AppError(400, 'INVALID_ID', 'Invalid group ID');
    const filter: Record<string, any> = { groups: new Types.ObjectId(groupId) };
    const org = orgId && Types.ObjectId.isValid(orgId) ? orgId : currentOrgId();
    if (org) filter.orgId = new Types.ObjectId(org);
    return Product.find(filter).sort({ name: 1 }).lean();
  }
}

export const productGroupService = new ProductGroupService();
