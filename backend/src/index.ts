import express, { Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
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
import reportRoutes from './routes/report.routes';
import auditRoutes from './routes/audit.routes';
import './models';

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// Behind Nginx / reverse proxy — needed so rate limiting sees the real client IP
app.set('trust proxy', 1);

// Security & Utility Middleware
app.use(helmet());
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
}));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/api/v1/health', (req: Request, res: Response) => {
  sendSuccess(res, 200, 'Server is running smoothly');
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
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/audit-logs', auditRoutes);

// Global Error Boundary Middleware
app.use(errorHandler);

// Start server function
const startServer = async (): Promise<void> => {
  await connectDB();

  // Initialize Background Cron Jobs
  initJobs();

  server.listen(env.PORT, () => {
    console.log(`🚀 Server listening on port ${env.PORT} in ${env.NODE_ENV} mode with Socket.IO & Cron enabled`);
  });
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
