import { Router } from 'express';
import { reportController } from '../controllers/ReportController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';

const router = Router();

router.use(authenticate);

router.get('/dashboard', requirePermissions('reports:dashboard'), (req, res, next) => reportController.getDashboard(req, res, next));
router.get('/sales', requirePermissions('reports:sales'), (req, res, next) => reportController.getSales(req, res, next));
router.get('/products', requirePermissions('reports:sales'), (req, res, next) => reportController.getProducts(req, res, next));
router.get('/inventory', requirePermissions('reports:inventory'), (req, res, next) => reportController.getInventory(req, res, next));
router.get('/pnl', requirePermissions('reports:pnl'), (req, res, next) => reportController.getPnL(req, res, next));
router.get('/dues', requirePermissions('reports:dues'), (req, res, next) => reportController.getDues(req, res, next));
router.get('/payables', requirePermissions('reports:payables'), (req, res, next) => reportController.getPayables(req, res, next));
router.get('/export/:type', requirePermissions('reports:export'), (req, res, next) => reportController.exportCsv(req, res, next));
router.get('/export-pdf/:type', requirePermissions('reports:export'), (req, res, next) => reportController.exportPdf(req, res, next));
router.get('/export-excel/:type', requirePermissions('reports:export'), (req, res, next) => reportController.exportExcel(req, res, next));

export default router;

