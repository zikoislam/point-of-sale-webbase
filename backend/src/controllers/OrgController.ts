import { Request, Response, NextFunction } from 'express';
import { orgService } from '../services/OrgService';
import { sendSuccess } from '../utils/api-response';

export class OrgController {
  async listOrgs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgs = await orgService.listOrgs(req.query.search as string | undefined);
      sendSuccess(res, 200, 'Organizations retrieved successfully', orgs);
    } catch (error) {
      next(error);
    }
  }

  async createOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const org = await orgService.createOrg(req.body);
      sendSuccess(res, 201, 'Organization created successfully', org);
    } catch (error) {
      next(error);
    }
  }

  async updateOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const org = await orgService.updateOrg(req.params.id, req.body);
      sendSuccess(res, 200, 'Organization updated successfully', org);
    } catch (error) {
      next(error);
    }
  }

  async setPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const org = await orgService.setPermissions(req.params.id, req.body.adminPermissionSet);
      sendSuccess(res, 200, 'Organization permissions updated successfully', org);
    } catch (error) {
      next(error);
    }
  }

  async addMember(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await orgService.addMember(req.params.id, req.body, req.user!.userId);
      sendSuccess(res, 200, 'Member added successfully');
    } catch (error) {
      next(error);
    }
  }

  async setMemberActive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await orgService.setMemberActive(req.params.id, req.params.userId, req.body.isActive);
      sendSuccess(res, 200, 'Membership updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async enterOrg(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await orgService.enterOrg(req.params.id, req.user!.userId);
      sendSuccess(res, 200, 'Entered organization', result);
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await orgService.getSummary(req.params.id);
      sendSuccess(res, 200, 'Organization summary retrieved successfully', summary);
    } catch (error) {
      next(error);
    }
  }
}

export const orgController = new OrgController();
