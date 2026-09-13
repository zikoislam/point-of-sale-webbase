import { Request, Response, NextFunction } from 'express';
import { Sale } from '../models/Sale';
import { sendError } from '../utils/api-response';

export const requireIdempotencyKey = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    if (!idempotencyKey || !idempotencyKey.trim()) {
      sendError(res, 400, 'MISSING_IDEMPOTENCY_KEY', 'Idempotency-Key header is required for this transaction.');
      return;
    }

    const existingSale = await Sale.findOne({ idempotencyKey: idempotencyKey.trim() });
    if (existingSale) {
      sendError(
        res,
        409,
        'IDEMPOTENCY_KEY_REPLAY',
        `A transaction with this idempotency key has already been processed (Invoice: ${existingSale.invoiceNo}).`
      );
      return;
    }

    // Pass the key through to the service so it is persisted with the sale
    req.body = req.body || {};
    req.body.idempotencyKey = idempotencyKey.trim();

    next();
  } catch (error) {
    next(error);
  }
};
