import { Request, Response, NextFunction } from 'express';
import { saleService } from '../services/SaleService';
import { sendSuccess } from '../utils/api-response';

class SaleController {
  async checkout(req: Request, res: Response, next: NextFunction) {
    try {
      const cashierId = (req as any).user._id.toString();
      const sale = await saleService.checkout(req.body, cashierId);
      sendSuccess(res, 201, 'Sale completed successfully', sale);
    } catch (err) { next(err); }
  }

  async holdCart(req: Request, res: Response, next: NextFunction) {
    try {
      const cashierId = (req as any).user._id.toString();
      const cart = await saleService.holdCart(req.body, cashierId);
      sendSuccess(res, 201, 'Cart held successfully', cart);
    } catch (err) { next(err); }
  }

  async listHoldCarts(req: Request, res: Response, next: NextFunction) {
    try {
      const cashierId = (req as any).user._id.toString();
      const carts = await saleService.listHoldCarts(cashierId);
      sendSuccess(res, 200, 'Hold carts fetched', carts);
    } catch (err) { next(err); }
  }

  async resumeCart(req: Request, res: Response, next: NextFunction) {
    try {
      const cashierId = (req as any).user._id.toString();
      const cart = await saleService.resumeCart(req.params.id, cashierId);
      sendSuccess(res, 200, 'Cart resumed', cart);
    } catch (err) { next(err); }
  }

  async deleteHoldCart(req: Request, res: Response, next: NextFunction) {
    try {
      const cashierId = (req as any).user._id.toString();
      await saleService.deleteHoldCart(req.params.id, cashierId);
      sendSuccess(res, 200, 'Hold cart discarded');
    } catch (err) { next(err); }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await saleService.listSales(page, limit, {
        shiftId: req.query.shiftId as string | undefined,
        customerId: req.query.customerId as string | undefined,
        search: req.query.search as string | undefined,
      });
      sendSuccess(res, 200, 'Sales fetched', result.data, {
        page: result.page,
        limit,
        totalItems: result.total,
        totalPages: result.totalPages,
      });
    } catch (err) { next(err); }
  }

  async getByInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const sale = await saleService.getSaleByInvoice(req.params.invoiceNo);
      sendSuccess(res, 200, 'Sale invoice fetched', sale);
    } catch (err) { next(err); }
  }

  async getReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await saleService.getReceiptData(req.params.invoiceNo);
      const format = (req.query.format as string) || 'html';
      const paperWidth = (req.query.paperWidth as '58mm' | '80mm') || '80mm';

      const { EscposFormatter } = await import('../utils/escpos-formatter');

      if (format === 'raw') {
        const binary = EscposFormatter.toEscposBinary(data, paperWidth);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="receipt-${data.invoiceNo}.bin"`);
        return res.send(binary);
      }

      const html = EscposFormatter.toHtml(data);
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    } catch (err) { next(err); }
  }

  async syncOffline(req: Request, res: Response, next: NextFunction) {
    try {
      const cashierId = (req as any).user._id.toString();
      const batch = req.body.sales || [];
      const result = await saleService.syncOfflineSales(batch, cashierId);
      sendSuccess(res, 200, 'Offline sales sync completed', result);
    } catch (err) { next(err); }
  }
}

export const saleController = new SaleController();

