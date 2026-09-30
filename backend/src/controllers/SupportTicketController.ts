import { Request, Response, NextFunction } from 'express';
import { supportTicketService, CreateTicketDto } from '../services/SupportTicketService';
import { sendSuccess } from '../utils/api-response';

export class SupportTicketController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await supportTicketService.list({
        status: req.query.status as string,
        priority: req.query.priority as string,
        customerId: req.query.customerId as string,
        breachedOnly: req.query.breachedOnly === 'true',
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      });
      sendSuccess(res, 200, 'Support tickets retrieved', data);
    } catch (error) { next(error); }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Support ticket retrieved', await supportTicketService.getById(req.params.id));
    } catch (error) { next(error); }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ticket = await supportTicketService.create(req.body as CreateTicketDto, req.user!.userId);
      sendSuccess(res, 201, 'Support ticket created', ticket);
    } catch (error) { next(error); }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Support ticket updated', await supportTicketService.update(req.params.id, req.body));
    } catch (error) { next(error); }
  }

  async addResponse(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await supportTicketService.addResponse(
        req.params.id,
        { message: req.body?.message, isCustomerVisible: req.body?.isCustomerVisible, byName: req.user!.fullName },
        req.user!.userId
      );
      sendSuccess(
        res,
        201,
        result.slaMet === null
          ? 'Reply added'
          : result.slaMet
          ? 'Reply added — first response within the SLA'
          : 'Reply added — the first-response SLA was already breached',
        result
      );
    } catch (error) { next(error); }
  }

  async resolve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await supportTicketService.resolve(
        req.params.id,
        { resolution: req.body?.resolution, satisfactionRating: req.body?.satisfactionRating ? Number(req.body.satisfactionRating) : undefined },
        req.user!.userId
      );
      sendSuccess(res, 200, 'Ticket resolved', result);
    } catch (error) { next(error); }
  }

  async slaReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await supportTicketService.getSlaReport({ from: req.query.from as string, to: req.query.to as string });
      sendSuccess(res, 200, 'Ticket SLA report generated', data);
    } catch (error) { next(error); }
  }
}

export const supportTicketController = new SupportTicketController();
