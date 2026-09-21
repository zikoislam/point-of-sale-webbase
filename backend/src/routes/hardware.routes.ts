import { Router, Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/api-response';
import { printRaw, kickCashDrawer, listPrinters } from '../utils/raw-print';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { validate } from '../middlewares/validation.middleware';
import { cashDrawerSchema, printReceiptSchema } from '../validators/hardware.validators';

/**
 * Hardware endpoints for when the API runs on the same computer as the printer
 * (the desktop install). The Electron shell normally talks to the spooler
 * directly through IPC; this is the fallback path, and requires the caller to be
 * a signed-in cashier rather than anyone on the network.
 */
const router = Router();

router.use(authenticate);
router.use(requirePermissions('pos:checkout'));

// GET /api/v1/hardware/printers
router.get('/printers', async (_req: Request, res: Response) => {
  const printers = await listPrinters();
  sendSuccess(res, 200, 'Printers fetched', { printers });
});

// POST /api/v1/hardware/cash-drawer
router.post('/cash-drawer', validate(cashDrawerSchema), async (req: Request, res: Response) => {
  const { printerName } = req.body as { printerName?: string };
  const result = await kickCashDrawer(printerName);

  if (!result.success) {
    sendError(res, 502, 'HARDWARE_ERROR', result.error || 'Failed to trigger the cash drawer');
    return;
  }

  sendSuccess(res, 200, 'Cash drawer triggered successfully', result);
});

// POST /api/v1/hardware/print
router.post('/print', validate(printReceiptSchema), async (req: Request, res: Response) => {
  const { printerName, bytes, docName } = req.body as {
    printerName?: string;
    bytes: number[];
    docName?: string;
  };

  const result = await printRaw(printerName, bytes, docName);

  if (!result.success) {
    sendError(res, 502, 'HARDWARE_ERROR', result.error || 'Failed to print the receipt');
    return;
  }

  sendSuccess(res, 200, 'Receipt printed successfully', result);
});

export default router;
