import { Request, Response, NextFunction } from 'express';
import { importExportService } from '../services/ImportExportService';
import { sendSuccess } from '../utils/api-response';

export class ImportExportController {
  /* ── Letters of credit ──────────────────────────────────────────────────── */

  async listLcs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await importExportService.listLcs({
        status: req.query.status as string,
        search: req.query.search as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
      });
      res.status(200).json({
        success: true, statusCode: 200, message: 'Letters of credit retrieved',
        data: result.data,
        meta: { page: result.page, totalPages: result.totalPages, totalItems: result.total },
      });
    } catch (error) { next(error); }
  }

  async getLc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Letter of credit retrieved', await importExportService.getLc(req.params.id));
    } catch (error) { next(error); }
  }

  async createLc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 201, 'Letter of credit created', await importExportService.createLc(req.body, req.user!.userId));
    } catch (error) { next(error); }
  }

  async updateLc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Letter of credit updated', await importExportService.updateLc(req.params.id, req.body, req.user!.userId));
    } catch (error) { next(error); }
  }

  async updateLcStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lc = await importExportService.updateLcStatus(req.params.id, req.body?.status, req.user!.userId, req.body?.note);
      sendSuccess(res, 200, 'LC status updated', lc);
    } catch (error) { next(error); }
  }

  async addLcDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lc = await importExportService.addLcDocument(req.params.id, req.body?.document, req.user!.userId);
      sendSuccess(res, 200, 'Document recorded', lc);
    } catch (error) { next(error); }
  }

  async removeLc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Letter of credit deleted', await importExportService.removeLc(req.params.id));
    } catch (error) { next(error); }
  }

  /* ── Proforma invoices ─────────────────────────────────────────────────── */

  async listPis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await importExportService.listPis({
        status: req.query.status as string,
        lcId: req.query.lcId as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
      });
      res.status(200).json({
        success: true, statusCode: 200, message: 'Proforma invoices retrieved',
        data: result.data,
        meta: { page: result.page, totalPages: result.totalPages, totalItems: result.total },
      });
    } catch (error) { next(error); }
  }

  async getPi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Proforma invoice retrieved', await importExportService.getPi(req.params.id));
    } catch (error) { next(error); }
  }

  async createPi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 201, 'Proforma invoice created', await importExportService.createPi(req.body, req.user!.userId));
    } catch (error) { next(error); }
  }

  async updatePiStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pi = await importExportService.updatePiStatus(req.params.id, req.body?.status, req.user!.userId);
      sendSuccess(res, 200, 'Proforma invoice updated', pi);
    } catch (error) { next(error); }
  }

  async linkPiToLc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const pi = await importExportService.linkPiToLc(req.params.id, req.body?.lcId, req.user!.userId);
      sendSuccess(res, 200, 'Proforma invoice linked to the LC', pi);
    } catch (error) { next(error); }
  }

  /* ── Commercial invoices ───────────────────────────────────────────────── */

  async listCis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await importExportService.listCis({
        status: req.query.status as string,
        lcId: req.query.lcId as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
      });
      res.status(200).json({
        success: true, statusCode: 200, message: 'Commercial invoices retrieved',
        data: result.data,
        meta: { page: result.page, totalPages: result.totalPages, totalItems: result.total },
      });
    } catch (error) { next(error); }
  }

  async getCi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Commercial invoice retrieved', await importExportService.getCi(req.params.id));
    } catch (error) { next(error); }
  }

  async createCi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 201, 'Commercial invoice created', await importExportService.createCi(req.body, req.user!.userId));
    } catch (error) { next(error); }
  }

  async updateCiStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ci = await importExportService.updateCiStatus(req.params.id, req.body?.status, req.user!.userId, req.body?.note);
      sendSuccess(res, 200, 'Commercial invoice status updated', ci);
    } catch (error) { next(error); }
  }

  /** Clears the shipment: allocates the landed cost and (optionally) stocks in. */
  async clearCi(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await importExportService.clearCommercialInvoice(
        req.params.id,
        {
          postStock: req.body?.postStock,
          agentId: req.body?.agentId,
          allocationBasis: req.body?.allocationBasis,
        },
        req.user!.userId
      );
      sendSuccess(res, 200, 'Landed cost applied', result);
    } catch (error) { next(error); }
  }

  /* ── Reports ───────────────────────────────────────────────────────────── */

  async landedCostAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await importExportService.getLandedCostAnalysis(req.query.ciId as string);
      sendSuccess(res, 200, 'Landed cost analysis generated', data);
    } catch (error) { next(error); }
  }

  async lcStatusReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await importExportService.getLcStatusReport();
      sendSuccess(res, 200, 'LC status report generated', data);
    } catch (error) { next(error); }
  }

  /* ── C&F / freight agents ──────────────────────────────────────────────── */

  async listAgents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const agents = await importExportService.listAgents({ includeInactive: req.query.includeInactive === 'true' });
      sendSuccess(res, 200, 'Agents retrieved', agents);
    } catch (error) { next(error); }
  }

  async createAgent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 201, 'Agent created', await importExportService.createAgent(req.body, req.user!.userId));
    } catch (error) { next(error); }
  }

  async updateAgent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Agent updated', await importExportService.updateAgent(req.params.id, req.body));
    } catch (error) { next(error); }
  }

  async agentLedger(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Agent ledger retrieved', await importExportService.getAgentLedger(req.params.id));
    } catch (error) { next(error); }
  }

  async agentTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const entry = await importExportService.recordAgentTransaction(req.params.id, req.body, req.user!.userId);
      sendSuccess(res, 201, 'Agent transaction recorded', entry);
    } catch (error) { next(error); }
  }

  async agentPayables(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, 200, 'Agent payables retrieved', await importExportService.getAgentPayables());
    } catch (error) { next(error); }
  }
}

export const importExportController = new ImportExportController();
