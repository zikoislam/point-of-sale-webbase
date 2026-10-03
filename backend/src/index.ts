// MUST be the very first import of the application: every other module here
// (routes, sockets, jobs) imports models transitively, and the tenant-scoping
// plugin only applies to schemas constructed after it is registered.
import './models';

import express, { Request, Response } from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env, clientOrigins } from './config/env';
import { connectDB } from './config/db';
import { sendSuccess } from './utils/api-response';
import { errorHandler } from './middlewares/error-handler';
import { initSocket } from './sockets';
import { initJobs } from './jobs';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import roleRoutes from './routes/role.routes';
import settingsRoutes from './routes/settings.routes';
import { settingsPublicRoutes } from './routes/settings-public.routes';
import categoryRoutes from './routes/category.routes';
import brandRoutes from './routes/brand.routes';
import productRoutes from './routes/product.routes';
import productGroupRoutes from './routes/product-group.routes';
import supplierRoutes from './routes/supplier.routes';
import purchaseOrderRoutes from './routes/purchase-order.routes';
import purchaseReturnRoutes from './routes/purchase-return.routes';
import shiftRoutes from './routes/shift.routes';
import saleRoutes from './routes/sale.routes';
import customerRoutes from './routes/customer.routes';
import salesReturnRoutes from './routes/sales-return.routes';
import accountRoutes from './routes/account.routes';
import expenseRoutes from './routes/expense.routes';
import inventoryRoutes from './routes/inventory.routes';
import stockMovementRoutes from './routes/stock-movement.routes';
import voucherRoutes from './routes/voucher.routes';
import uploadRoutes from './routes/upload.routes';
import reportRoutes from './routes/report.routes';
import auditRoutes from './routes/audit.routes';
import hardwareRoutes from './routes/hardware.routes';
import syncRoutes from './routes/sync.routes';
import { syncService } from './sync/SyncService';
import { getDbMode, isDatabaseReady } from './config/db';
import backupRoutes from './routes/backup.routes';
import accountingRoutes from './routes/accounting.routes';
import priceTierRoutes from './routes/price-tier.routes';
import volumePricingRoutes from './routes/volume-pricing.routes';
import notificationRoutes from './routes/notification.routes';
import branchRoutes from './routes/branch.routes';
import stockTransferRoutes from './routes/stock-transfer.routes';
import importExportRoutes from './routes/import-export.routes';
import approvalRoutes from './routes/approval.routes';
import projectRoutes from './routes/project.routes';
import systemRoutes from './routes/system.routes';
import scheduledReportRoutes from './routes/scheduled-report.routes';
import courierRoutes from './routes/courier.routes';
import courierWebhookRoutes from './routes/courier-webhook.routes';
import supportTicketRoutes from './routes/support-ticket.routes';
import leaveRoutes from './routes/leave.routes';
import leadRoutes from './routes/lead.routes';
import { compressionMiddleware } from './middlewares/compression.middleware';
import { performanceMiddleware } from './middlewares/performance.middleware';
import { reportCacheInvalidation } from './middlewares/report-cache.middleware';
import { posLimiter, reportLimiter, exportLimiter } from './middlewares/rate-limit.middleware';
import distributionRoutes from './routes/distribution.routes';
import hrRoutes from './routes/hr.routes';
import productionRoutes from './routes/production.routes';
import crmRoutes from './routes/crm.routes';
import ecommerceRoutes from './routes/ecommerce.routes';
import storefrontRoutes from './routes/storefront.routes';
import platformRoutes from './routes/platform.routes';
import subscriptionRoutes from './routes/subscription.routes';
import { requireOrg } from './middlewares/org.middleware';
import { requireActiveSubscription } from './middlewares/subscription.middleware';
import { authenticate } from './middlewares/auth.middleware';

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// Behind Nginx / reverse proxy — needed so rate limiting sees the real client IP
app.set('trust proxy', 1);

// Security & Utility Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: clientOrigins,
  credentials: true,
}));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Performance layer (Phase 12.2): gzip large payloads and time every request.
app.use(compressionMiddleware());
app.use(performanceMiddleware());

// Uploaded images (company logo, profile pictures)
const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
// Database snapshots may live under uploads/backups on hosts with a persistent
// volume, but they must never be served as static files — only through the
// authenticated /api/v1/backups endpoints. This guard must run before static.
app.use('/uploads/backups', (req: Request, res: Response) => {
  res.status(404).end();
});
app.use('/uploads', express.static(uploadsDir));

// Health Check Endpoint — also tells the desktop shell which database is live
app.get('/api/v1/health', (req: Request, res: Response) => {
  sendSuccess(res, 200, 'Server is running smoothly', {
    database: getDbMode(),
    databaseReady: isDatabaseReady(),
    syncEnabled: syncService.enabled,
  });
});

// API Routes
// Platform-level (Super Admin) routes — not tenant-scoped.
app.use('/api/v1/platform', platformRoutes);

// Organization-scoped routes: authenticate resolves the JWT, requireOrg opens
// the tenant scope that the Mongoose org-scope plugin enforces on every query,
// and requireActiveSubscription enforces the SaaS subscription (402 when the
// grace window has passed). The report-cache invalidator sits after requireOrg
// so it knows which tenant to clear when a write lands.
const orgRouter = (router: express.Router) =>
  express.Router().use(authenticate, requireOrg, requireActiveSubscription, reportCacheInvalidation(), router);

app.use('/api/v1/auth', authRoutes);
// Subscription status + license redemption must stay reachable while locked, so
// this is mounted outside the subscription gate (authenticate + requireOrg only).
app.use('/api/v1/subscription', authenticate, requireOrg, subscriptionRoutes);
app.use('/api/v1/users', orgRouter(userRoutes));
app.use('/api/v1/roles', orgRouter(roleRoutes));
// Public branding endpoint — no auth, no org scope (used by the login screen)
app.use('/api/v1/settings', settingsPublicRoutes);
app.use('/api/v1/settings', orgRouter(settingsRoutes));
app.use('/api/v1/categories', orgRouter(categoryRoutes));
app.use('/api/v1/brands', orgRouter(brandRoutes));
app.use('/api/v1/products', orgRouter(productRoutes));
app.use('/api/v1/product-groups', orgRouter(productGroupRoutes));
app.use('/api/v1/suppliers', orgRouter(supplierRoutes));
app.use('/api/v1/purchase-orders', orgRouter(purchaseOrderRoutes));
app.use('/api/v1/purchase-returns', orgRouter(purchaseReturnRoutes));
app.use('/api/v1/shifts', orgRouter(shiftRoutes));
app.use('/api/v1/sales', posLimiter, orgRouter(saleRoutes));
app.use('/api/v1/customers', orgRouter(customerRoutes));
app.use('/api/v1/returns', orgRouter(salesReturnRoutes));
app.use('/api/v1/accounts', orgRouter(accountRoutes));
app.use('/api/v1/expenses', orgRouter(expenseRoutes));
app.use('/api/v1/inventory', orgRouter(inventoryRoutes));
app.use('/api/v1/stock-movements', orgRouter(stockMovementRoutes));
app.use('/api/v1/vouchers', orgRouter(voucherRoutes));
app.use('/api/v1/uploads', orgRouter(uploadRoutes));
// Exports render a document per call — the strictest limit, and it must be
// registered before the general reports mount so it runs first.
app.use('/api/v1/reports/export', exportLimiter);
// Reports: tight rate limit; the caching middleware lives inside the reports
// router so it runs after authenticate (it needs the user + org scope).
app.use('/api/v1/reports', reportLimiter, orgRouter(reportRoutes));
app.use('/api/v1/system', orgRouter(systemRoutes));
app.use('/api/v1/scheduled-reports', orgRouter(scheduledReportRoutes));
// Delivery integration (Module 10) — the webhook is public: couriers call it
// without a session, so it authenticates with a shared secret instead.
app.use('/api/v1/couriers/webhooks', courierWebhookRoutes);
app.use('/api/v1/couriers', orgRouter(courierRoutes));
app.use('/api/v1/support-tickets', orgRouter(supportTicketRoutes));
app.use('/api/v1/leave-requests', orgRouter(leaveRoutes));
app.use('/api/v1/leads', orgRouter(leadRoutes));
app.use('/api/v1/audit-logs', orgRouter(auditRoutes));
app.use('/api/v1/hardware', orgRouter(hardwareRoutes));
app.use('/api/v1/sync', orgRouter(syncRoutes));
app.use('/api/v1/backups', backupRoutes);
app.use('/api/v1/accounting', orgRouter(accountingRoutes));
app.use('/api/v1/price-tiers', orgRouter(priceTierRoutes));
app.use('/api/v1/volume-pricing', orgRouter(volumePricingRoutes));
app.use('/api/v1/notifications', orgRouter(notificationRoutes));
app.use('/api/v1/branches', orgRouter(branchRoutes));
app.use('/api/v1/stock-transfers', orgRouter(stockTransferRoutes));
app.use('/api/v1/import-export', orgRouter(importExportRoutes));
app.use('/api/v1/approvals', orgRouter(approvalRoutes));
app.use('/api/v1/projects', orgRouter(projectRoutes));
app.use('/api/v1/distribution', orgRouter(distributionRoutes));
app.use('/api/v1/hr', orgRouter(hrRoutes));
app.use('/api/v1/production', orgRouter(productionRoutes));
app.use('/api/v1/crm', orgRouter(crmRoutes));
app.use('/api/v1/ecommerce', orgRouter(ecommerceRoutes));
// Public storefront — no auth/org middleware; rate limited like auth endpoints
app.use('/api/v1/storefront', storefrontRoutes);

// Global Error Boundary Middleware
app.use(errorHandler);

// Start server function
const startServer = async (): Promise<void> => {
  await connectDB();

  // Turn a legacy single-shop database into the multi-org layout (idempotent,
  // no-op when the default organization already exists).
  try {
    const { ensureMultiOrgBootstrap } = await import('./services/MultiOrgBootstrapService');
    await ensureMultiOrgBootstrap();
  } catch (e) {
    console.error('❌ Multi-organization bootstrap failed:', e);
  }

  // Make sure the chart of accounts exists for every organization before
  // anything can post to it — every money movement writes a balanced voucher,
  // so a missing head would otherwise fail the first sale.
  try {
    const { accountingService } = await import('./services/AccountingService');
    const { Organization } = await import('./models/Organization');
    const { runWithOrg } = await import('./middlewares/org.context');
    const orgs = await Organization.find({ status: 'ACTIVE' }).lean();
    for (const org of orgs) {
      await runWithOrg({ orgId: String(org._id) }, async () => {
        await accountingService.seedChart();
      });
    }
  } catch (e) {
    console.error('❌ Could not prepare the chart of accounts:', e);
  }

  // Initialize Background Cron Jobs
  initJobs();

  // Mirror the local database to the cloud whenever both are available
  void syncService.start();

  server.listen(env.PORT, () => {
    console.log(`🚀 Server listening on port ${env.PORT} in ${env.NODE_ENV} mode with Socket.IO & Cron enabled`);
  });
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
