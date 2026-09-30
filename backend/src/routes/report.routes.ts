import { Router } from 'express';
import { reportController } from '../controllers/ReportController';
import { authenticate } from '../middlewares/auth.middleware';
import { requirePermissions } from '../middlewares/rbac.middleware';
import { reportCache } from '../middlewares/report-cache.middleware';

// NOTE: authentication + tenant scope come from the org wrapper in index.ts,
// which is why the cache middleware is registered here: it needs req.user and
// the open organization scope, so it must run after authenticate.
const router = Router();

router.use(reportCache(60));



router.get('/dashboard', requirePermissions('reports:dashboard'), (req, res, next) => reportController.getDashboard(req, res, next));
router.get('/sales', requirePermissions('reports:sales'), (req, res, next) => reportController.getSales(req, res, next));
// Self-service: every user may always see their OWN sales/returns numbers
router.get('/my-sales', (req, res, next) => reportController.getMySales(req, res, next));
// Dimension analyses — category / brand / product-group wise sales
router.get('/category-wise-sales', requirePermissions('reports:sales'), (req, res, next) => reportController.getCategoryWiseSales(req, res, next));
router.get('/brand-wise-sales', requirePermissions('reports:sales'), (req, res, next) => reportController.getBrandWiseSales(req, res, next));
router.get('/group-wise-sales', requirePermissions('reports:sales'), (req, res, next) => reportController.getGroupWiseSales(req, res, next));
// Inventory intelligence — barcode trace, low stock, dead stock, reorder points
router.get('/barcode-wise', requirePermissions('reports:inventory'), (req, res, next) => reportController.getBarcodeWise(req, res, next));
router.get('/low-stock', requirePermissions('reports:inventory'), (req, res, next) => reportController.getLowStock(req, res, next));
router.get('/dead-stock', requirePermissions('reports:inventory'), (req, res, next) => reportController.getDeadStock(req, res, next));
router.get('/stock-reorder', requirePermissions('reports:inventory'), (req, res, next) => reportController.getStockReorder(req, res, next));
// Inventory analysis by category / brand / group and by age
router.get('/inventory-by-category', requirePermissions('reports:inventory'), (req, res, next) => reportController.getInventoryByCategory(req, res, next));
router.get('/inventory-by-brand', requirePermissions('reports:inventory'), (req, res, next) => reportController.getInventoryByBrand(req, res, next));
router.get('/inventory-by-group', requirePermissions('reports:inventory'), (req, res, next) => reportController.getInventoryByGroup(req, res, next));
router.get('/inventory-aging', requirePermissions('reports:inventory'), (req, res, next) => reportController.getInventoryAging(req, res, next));

// Inventory Suite (Phase 8)
router.get('/stock-ledger', requirePermissions('reports:inventory'), (req, res, next) => reportController.getStockLedger(req, res, next));
router.get('/stock-movement-summary', requirePermissions('reports:inventory'), (req, res, next) => reportController.getStockMovementSummary(req, res, next));
router.get('/expiry', requirePermissions('reports:inventory'), (req, res, next) => reportController.getExpiryReport(req, res, next));
router.get('/supplier-price-comparison', requirePermissions('reports:purchases'), (req, res, next) => reportController.getSupplierPriceComparison(req, res, next));
router.get('/supplier-wise-purchases', requirePermissions('reports:purchases'), (req, res, next) => reportController.getSupplierWisePurchases(req, res, next));
router.get('/purchase-vs-sales', requirePermissions('reports:purchases'), (req, res, next) => reportController.getPurchaseVsSales(req, res, next));
router.get('/auto-reorder', requirePermissions('reports:inventory'), (req, res, next) => reportController.getAutoReorder(req, res, next));

// Sales register & channel mix (Module 1)
router.get('/daily-register', requirePermissions('reports:sales'), (req, res, next) => reportController.getDailySalesRegister(req, res, next));
router.get('/wholesale-vs-retail', requirePermissions('reports:sales'), (req, res, next) => reportController.getWholesaleVsRetail(req, res, next));
router.get('/top-products', requirePermissions('reports:sales'), (req, res, next) => reportController.getTopSellingProducts(req, res, next));

// Import / Export (LC) — Module 6
router.get('/lc-status', requirePermissions('reports:purchases'), (req, res, next) => reportController.getLcStatus(req, res, next));
router.get('/landed-cost', requirePermissions('reports:purchases'), (req, res, next) => reportController.getLandedCost(req, res, next));
router.get('/agent-payables', requirePermissions('reports:payables'), (req, res, next) => reportController.getAgentPayables(req, res, next));

// Approvals & projects — Module 7
router.get('/pending-approvals', requirePermissions('reports:dashboard'), (req, res, next) => reportController.getPendingApprovals(req, res, next));
router.get('/project-pnl', requirePermissions('reports:pnl'), (req, res, next) => reportController.getProjectPnL(req, res, next));

// eCommerce, CRM & HR — Modules 8-10
router.get('/online-vs-offline', requirePermissions('reports:sales'), (req, res, next) => reportController.getOnlineVsOffline(req, res, next));
router.get('/fulfillment-rate', requirePermissions('ecom:view'), (req, res, next) => reportController.getFulfillmentRate(req, res, next));
router.get('/lead-conversion', requirePermissions('crm:view'), (req, res, next) => reportController.getLeadConversion(req, res, next));
router.get('/ticket-sla', requirePermissions('crm:view'), (req, res, next) => reportController.getTicketSla(req, res, next));
router.get('/leave-summary', requirePermissions('hr:view'), (req, res, next) => reportController.getLeaveSummary(req, res, next));
router.get('/products', requirePermissions('reports:sales'), (req, res, next) => reportController.getProducts(req, res, next));
router.get('/inventory', requirePermissions('reports:inventory'), (req, res, next) => reportController.getInventory(req, res, next));
router.get('/inventory-valuation', requirePermissions('reports:inventory'), (req, res, next) => reportController.getInventory(req, res, next));
router.get('/inventory-wastage', requirePermissions('reports:inventory'), (req, res, next) => reportController.getInventoryWastage(req, res, next));
router.get('/pnl', requirePermissions('reports:pnl'), (req, res, next) => reportController.getPnL(req, res, next));
router.get('/dues', requirePermissions('reports:dues'), (req, res, next) => reportController.getDues(req, res, next));
router.get('/customer-aging', requirePermissions('reports:dues'), (req, res, next) => reportController.getDues(req, res, next));
router.get('/payables', requirePermissions('reports:payables'), (req, res, next) => reportController.getPayables(req, res, next));
router.get('/supplier-payable', requirePermissions('reports:payables'), (req, res, next) => reportController.getPayables(req, res, next));
router.get('/purchases', requirePermissions('reports:purchases'), (req, res, next) => reportController.getPurchases(req, res, next));
router.get('/export/:type', requirePermissions('reports:export'), (req, res, next) => reportController.exportCsv(req, res, next));
router.get('/export-pdf/:type', requirePermissions('reports:export'), (req, res, next) => reportController.exportPdf(req, res, next));
router.get('/export-excel/:type', requirePermissions('reports:export'), (req, res, next) => reportController.exportExcel(req, res, next));

export default router;

