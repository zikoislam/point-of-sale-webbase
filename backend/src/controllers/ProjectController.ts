import { Request, Response, NextFunction } from 'express';
import { projectService, ProjectDto } from '../services/ProjectService';
import { sendSuccess } from '../utils/api-response';

export class ProjectController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await projectService.list({
        status: req.query.status as string,
        search: req.query.search as string,
      });
      sendSuccess(res, 200, 'Projects retrieved', data);
    } catch (error) { next(error); }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Project retrieved', await projectService.getById(req.params.id));
    } catch (error) { next(error); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const project = await projectService.create(req.body as ProjectDto, req.user!.userId);
      sendSuccess(res, 201, 'Project created', project);
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Project updated', await projectService.update(req.params.id, req.body));
    } catch (error) { next(error); }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Project deleted', await projectService.remove(req.params.id));
    } catch (error) { next(error); }
  }

  async profitAndLoss(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await projectService.getProfitAndLoss(req.query.projectId as string);
      sendSuccess(res, 200, 'Project P&L generated', data);
    } catch (error) { next(error); }
  }
}

export const projectController = new ProjectController();
