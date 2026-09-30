import { Request, Response, NextFunction } from 'express';
import { productionService } from '../services/ProductionService';
import { sendSuccess } from '../utils/api-response';

export class ProductionController {
  async listBoms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const boms = await productionService.listBoms();
      sendSuccess(res, 200, 'BOMs retrieved successfully', boms);
    } catch (error) { next(error); }
  }

  async createBom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bom = await productionService.createBom(req.body);
      sendSuccess(res, 201, 'BOM created successfully', bom);
    } catch (error) { next(error); }
  }

  async updateBom(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bom = await productionService.updateBom(req.params.id, req.body);
      sendSuccess(res, 200, 'BOM updated successfully', bom);
    } catch (error) { next(error); }
  }

  async listRuns(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const runs = await productionService.listRuns();
      sendSuccess(res, 200, 'Production runs retrieved successfully', runs);
    } catch (error) { next(error); }
  }

  async getRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await productionService.getRun(req.params.id);
      sendSuccess(res, 200, 'Production run retrieved successfully', run);
    } catch (error) { next(error); }
  }

  async createRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await productionService.createRun(req.body, req.user!.userId);
      sendSuccess(res, 201, 'Production run planned successfully', run);
    } catch (error) { next(error); }
  }

  async startRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await productionService.startRun(req.params.id, req.user!.userId);
      sendSuccess(res, 200, 'Run started — materials issued', run);
    } catch (error) { next(error); }
  }

  async completeRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await productionService.completeRun(req.params.id, Number(req.body.producedQty), req.user!.userId);
      sendSuccess(res, 200, 'Run completed — finished goods added to stock', run);
    } catch (error) { next(error); }
  }

  async cancelRun(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const run = await productionService.cancelRun(req.params.id);
      sendSuccess(res, 200, 'Run cancelled', run);
    } catch (error) { next(error); }
  }
}

export const productionController = new ProductionController();
