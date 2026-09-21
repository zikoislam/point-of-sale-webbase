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
import categoryRoutes from './routes/category.routes';
import brandRoutes from './routes/brand.routes';
import productRoutes from './routes/product.routes';
import supplierRoutes from './routes/supplier.routes';
import purchaseOrderRoutes from './routes/purchase-order.routes';
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
import './models';

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/brands', brandRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/suppliers', supplierRoutes);
app.use('/api/v1/purchase-orders', purchaseOrderRoutes);
app.use('/api/v1/shifts', shiftRoutes);
app.use('/api/v1/sales', saleRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/returns', salesReturnRoutes);
app.use('/api/v1/accounts', accountRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/stock-movements', stockMovementRoutes);
app.use('/api/v1/vouchers', voucherRoutes);
app.use('/api/v1/uploads', uploadRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/hardware', hardwareRoutes);
app.use('/api/v1/sync', syncRoutes);
app.use('/api/v1/backups', backupRoutes);

// Global Error Boundary Middleware
app.use(errorHandler);

// Start server function
const startServer = async (): Promise<void> => {
  await connectDB();

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
