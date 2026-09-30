import { Request, Response, NextFunction } from 'express';
import { leadService, LeadDto } from '../services/LeadService';
import { sendSuccess } from '../utils/api-response';

export class LeadController {
  /** Kanban board — one column per pipeline stage. */
  async board(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await leadService.getBoard({
        assignedTo: req.query.assignedTo as string,
        includeClosed: req.query.includeClosed === 'true',
      });
      sendSuccess(res, 200, 'Lead pipeline retrieved', data);
    } catch (error) { next(error); }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await leadService.list({
        stage: req.query.stage as string,
        assignedTo: req.query.assignedTo as string,
        search: req.query.search as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      });
      sendSuccess(res, 200, 'Leads retrieved', data);
    } catch (error) { next(error); }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Lead retrieved', await leadService.getById(req.params.id));
    } catch (error) { next(error); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lead = await leadService.create(req.body as LeadDto, req.user!.userId);
      sendSuccess(res, 201, 'Lead created', lead);
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Lead updated', await leadService.update(req.params.id, req.body));
    } catch (error) { next(error); }
  }

  async moveStage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lead = await leadService.moveStage(req.params.id, req.body, req.user!.userId);
      sendSuccess(res, 200, `Lead moved to ${lead?.stage}`, lead);
    } catch (error) { next(error); }
  }

  async followUp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lead = await leadService.logFollowUp(req.params.id, req.body, req.user!.userId);
      sendSuccess(res, 200, 'Follow-up logged', lead);
    } catch (error) { next(error); }
  }

  async convert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await leadService.convertToCustomer(req.params.id, req.body, req.user!.userId);
      sendSuccess(
        res,
        200,
        result.customer.created ? 'Lead converted — a new customer was created' : 'Lead converted — linked to the existing customer',
        result
      );
    } catch (error) { next(error); }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Lead deleted', await leadService.remove(req.params.id));
    } catch (error) { next(error); }
  }

  async conversionReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await leadService.getConversionReport({ from: req.query.from as string, to: req.query.to as string });
      sendSuccess(res, 200, 'Lead conversion report generated', data);
    } catch (error) { next(error); }
  }
}

export const leadController = new LeadController();
