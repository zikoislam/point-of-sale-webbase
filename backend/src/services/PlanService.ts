import { Plan, IPlan } from '../models/Plan';
import { AppError } from '../utils/app-error';
import { isValidPermissionSet } from '../config/permissions';

export interface PlanInput {
  name: string;
  code: string;
  durationDays: number;
  price?: number;
  description?: string;
  features?: string[];
  permissionSet?: string[];
  applyPermissions?: boolean;
  sortOrder?: number;
}

function normaliseCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '_');
}

export class PlanService {
  async list(includeInactive = false): Promise<IPlan[]> {
    const query = includeInactive ? {} : { isActive: true };
    return Plan.find(query).sort({ sortOrder: 1, name: 1 }).lean() as unknown as Promise<IPlan[]>;
  }

  async getById(id: string): Promise<IPlan | null> {
    return Plan.findById(id);
  }

  async create(data: PlanInput): Promise<IPlan> {
    const code = normaliseCode(data.code);
    const existing = await Plan.findOne({ code }).lean();
    if (existing) throw new AppError(409, 'PLAN_EXISTS', `A plan with code "${code}" already exists`);

    const permissionSet = data.permissionSet || [];
    if (!isValidPermissionSet(permissionSet)) {
      throw new AppError(400, 'INVALID_PERMISSIONS', 'permissionSet contains unknown permissions');
    }

    return Plan.create({
      name: data.name.trim(),
      code,
      durationDays: data.durationDays,
      price: data.price ?? 0,
      description: data.description,
      features: data.features || [],
      permissionSet,
      applyPermissions: data.applyPermissions ?? true,
      sortOrder: data.sortOrder ?? 0,
      isActive: true,
    });
  }

  async update(id: string, data: Partial<PlanInput> & { isActive?: boolean }): Promise<IPlan> {
    const plan = await Plan.findById(id);
    if (!plan) throw new AppError(404, 'PLAN_NOT_FOUND', 'Plan not found');

    if (data.name !== undefined) plan.name = data.name.trim();
    if (data.code !== undefined) {
      const code = normaliseCode(data.code);
      const clash = await Plan.findOne({ code, _id: { $ne: plan._id } }).lean();
      if (clash) throw new AppError(409, 'PLAN_EXISTS', `A plan with code "${code}" already exists`);
      plan.code = code;
    }
    if (data.durationDays !== undefined) plan.durationDays = data.durationDays;
    if (data.price !== undefined) plan.price = data.price;
    if (data.description !== undefined) plan.description = data.description;
    if (data.features !== undefined) plan.features = data.features;
    if (data.permissionSet !== undefined) {
      if (!isValidPermissionSet(data.permissionSet)) {
        throw new AppError(400, 'INVALID_PERMISSIONS', 'permissionSet contains unknown permissions');
      }
      plan.permissionSet = data.permissionSet;
    }
    if (data.applyPermissions !== undefined) plan.applyPermissions = data.applyPermissions;
    if (data.sortOrder !== undefined) plan.sortOrder = data.sortOrder;
    if (data.isActive !== undefined) plan.isActive = data.isActive;

    await plan.save();
    return plan;
  }

  async toggle(id: string): Promise<IPlan> {
    const plan = await Plan.findById(id);
    if (!plan) throw new AppError(404, 'PLAN_NOT_FOUND', 'Plan not found');
    plan.isActive = !plan.isActive;
    await plan.save();
    return plan;
  }
}

export const planService = new PlanService();
