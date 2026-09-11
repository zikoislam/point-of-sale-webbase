import { Request, Response, NextFunction } from 'express';
import { roleService } from '../services/RoleService';
import { sendSuccess } from '../utils/api-response';

export class RoleController {
  async listRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const roles = await roleService.listRoles();
      sendSuccess(res, 200, 'Roles retrieved successfully', roles);
    } catch (error) {
      next(error);
    }
  }

  async createRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = await roleService.createRole(req.body);
      sendSuccess(res, 201, 'Role created successfully', role);
    } catch (error) {
      next(error);
    }
  }

  async updateRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = await roleService.updateRole(req.params.id, req.body);
      sendSuccess(res, 200, 'Role updated successfully', role);
    } catch (error) {
      next(error);
    }
  }

  async getAllPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const permissions = roleService.getAllPermissions();
      sendSuccess(res, 200, 'All permissions retrieved', permissions);
    } catch (error) {
      next(error);
    }
  }
}

export const roleController = new RoleController();
