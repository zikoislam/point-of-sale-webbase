import { Request, Response, NextFunction } from 'express';
import { distributionService } from '../services/DistributionService';
import { sendSuccess } from '../utils/api-response';

export class DistributionController {
  // zones
  async listZones(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const zones = await distributionService.listZones();
      sendSuccess(res, 200, 'Zones retrieved successfully', zones);
    } catch (error) { next(error); }
  }

  async createZone(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const zone = await distributionService.createZone(req.body);
      sendSuccess(res, 201, 'Zone created successfully', zone);
    } catch (error) { next(error); }
  }

  async updateZone(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const zone = await distributionService.updateZone(req.params.id, req.body);
      sendSuccess(res, 200, 'Zone updated successfully', zone);
    } catch (error) { next(error); }
  }

  async archiveZone(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await distributionService.archiveZone(req.params.id);
      sendSuccess(res, 200, 'Territory archived', result);
    } catch (error) { next(error); }
  }

  // routes
  async listRoutes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const routes = await distributionService.listRoutes();
      sendSuccess(res, 200, 'Routes retrieved successfully', routes);
    } catch (error) { next(error); }
  }

  async createRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const route = await distributionService.createRoute(req.body);
      sendSuccess(res, 201, 'Route created successfully', route);
    } catch (error) { next(error); }
  }

  async updateRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const route = await distributionService.updateRoute(req.params.id, req.body);
      sendSuccess(res, 200, 'Route updated successfully', route);
    } catch (error) { next(error); }
  }

  async archiveRoute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await distributionService.archiveRoute(req.params.id);
      sendSuccess(res, 200, 'Route archived', result);
    } catch (error) { next(error); }
  }

  /** The shops to visit on a route — the SR's call list. */
  async routeCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customers = await distributionService.getRouteCustomers(req.params.id);
      sendSuccess(res, 200, 'Route customers retrieved successfully', customers);
    } catch (error) { next(error); }
  }

  // sales reps
  async listSalesReps(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const reps = await distributionService.listSalesReps();
      sendSuccess(res, 200, 'Sales reps retrieved successfully', reps);
    } catch (error) { next(error); }
  }

  async createSalesRep(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rep = await distributionService.createSalesRep(req.body);
      sendSuccess(res, 201, 'Sales rep created successfully', rep);
    } catch (error) { next(error); }
  }

  async updateSalesRep(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rep = await distributionService.updateSalesRep(req.params.id, req.body);
      sendSuccess(res, 200, 'Sales rep updated successfully', rep);
    } catch (error) { next(error); }
  }

  // dealers
  async listDealers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dealers = await distributionService.listDealers();
      sendSuccess(res, 200, 'Dealers retrieved successfully', dealers);
    } catch (error) { next(error); }
  }

  // SR orders
  async listSrOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orders = await distributionService.listSrOrders(req.query.status as string | undefined);
      sendSuccess(res, 200, 'SR orders retrieved successfully', orders);
    } catch (error) { next(error); }
  }

  async createSrOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const canManage = req.user!.isPlatformSuperAdmin || (req.user!.permissions || []).includes('sr:manage');
      const order = await distributionService.createSrOrder(req.body, req.user!.userId, canManage);
      sendSuccess(res, 201, 'SR order created successfully', order);
    } catch (error) { next(error); }
  }

  async actionSrOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const order = await distributionService.actionSrOrder(req.params.id, req.body.action, req.user!.userId);
      sendSuccess(res, 200, `Order ${req.body.action === 'CONFIRM' ? 'confirmed' : 'cancelled'} successfully`, order);
    } catch (error) { next(error); }
  }

  async convertSrOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sale = await distributionService.convertSrOrder(req.params.id, req.user!.userId);
      sendSuccess(res, 200, 'Order converted to sale successfully', sale);
    } catch (error) { next(error); }
  }

  // report
  async srReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await distributionService.srReport();
      sendSuccess(res, 200, 'SR report retrieved successfully', report);
    } catch (error) { next(error); }
  }
}

export const distributionController = new DistributionController();
