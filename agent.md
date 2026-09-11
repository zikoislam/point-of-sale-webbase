# AGENT MASTER INSTRUCTION FILE
## Enterprise Cloud-Based POS & Shop Management System
### For AI Coding Agents — Read Completely Before Writing Any Code

---

> **CRITICAL FIRST INSTRUCTION:**
> You are an AI coding agent assigned to build an **Enterprise-grade, Cloud-based Point of Sale (POS) and Shop Management System**.
> Before writing a single line of code, read this entire file. Every decision you make — architecture, naming, API design, database schema, business logic — must strictly follow the specifications defined here and in the referenced documents listed below.
> If you are unsure about anything, reference the spec documents. Do NOT invent or assume behaviour. The specs are the source of truth.

---

## SECTION 0 — HOW TO USE THIS FILE

This file is structured in the following order:

1. **Project Overview** — What we're building and why
2. **Reference Documents** — The authoritative spec files you must read
3. **Technology Stack** — Every tool, library, and framework used
4. **Project Directory Structure** — Exact folder layout for both client and server
5. **Database Design** — All 25 MongoDB collections, schemas, indexes
6. **User Roles & RBAC** — Roles, permissions, access rules
7. **Complete API Reference** — All 68 endpoints with method, path, and permission
8. **Core Business Logic** — Critical rules that must never be broken
9. **Error Code Dictionary** — All machine-readable error codes
10. **Coding Standards** — TypeScript, Express, MongoDB, React conventions
11. **Frontend UI Standards** — Design system, components, routing
12. **Hardware Integration** — ESC/POS printers, barcode scanners, cash drawer
13. **Background Jobs** — Cron schedules and Socket.io events
14. **Performance Requirements** — SLAs that must be met
15. **Build Phases** — Step-by-step sequential build order
16. **Quick Reference Tables** — Formats, enums, constants

---

## SECTION 1 — PROJECT OVERVIEW

**Product Name:** Enterprise Cloud-Based POS & Shop Management System
**Type:** Full-stack web application (PWA-capable)
**Target User:** Retail shop owners, managers, and cashiers in Bangladesh
**Scale:** Single-store solution with multi-branch database architecture readiness

### What This System Does

This system replaces a manual cash register and paper ledger with a fully automated, cloud-connected, hardware-integrated shop management platform. It handles:

- **POS Checkout** — Barcode scanner driven checkout with multi-payment split (Cash + bKash + Card + Store Credit + Customer Due)
- **Inventory Management** — Real-time stock tracking, FEFO expiry management, wastage write-offs
- **Product Catalog** — Multi-tier pricing (Retail MRP vs Wholesale), VAT/Tax management (Inclusive/Exclusive/Exempt), product variants
- **Procurement** — Supplier management, Purchase Orders (PO), Goods Received Notes (GRN), Weighted Average Cost (WAC) tracking
- **Customer CRM** — Customer credit ledger ("Bakir Khata"), due payments, loyalty points, Wholesale vs Retail classification
- **Shift & Cash Drawer** — Shift open/close with opening float, mid-day petty cash, Z-Report reconciliation, discrepancy approval
- **Financial Accounting** — Double-entry ledger for Cash/Bank/MFS accounts, expense tracking, fund transfers
- **Sales Returns** — Line-item returns with restock or wastage routing, Cash or Store Credit Voucher refunds
- **Reporting & Analytics** — Sales report, P&L, inventory valuation, customer due aging, supplier payables, Z-Reports with PDF/Excel export
- **Hardware** — ESC/POS thermal receipt printers (58mm/80mm), barcode label printers, cash drawer auto-kick, USB barcode scanner input
- **Offline Resilience** — IndexedDB cart buffering when internet is down, auto-sync with conflict resolution on reconnect
- **Real-time Alerts** — Socket.io WebSocket for low stock, offline oversell, and shift discrepancy notifications

---

## SECTION 2 — REFERENCE DOCUMENTS

> **MANDATORY:** Read each document below before implementing features in its domain. These files are the **sole source of truth** for this project.

| Document | Read Before | Content |
|:---|:---|:---|
| [`PRD.md`](./PRD.md) | Starting any feature | Complete product requirements, all 19 UI pages, business rules, user role matrix, development phases |
| [`architecture.md`](./architecture.md) | Setting up the project | System architecture diagram, exact directory structure, data model schemas, indexing, streaming export code, deployment topology, complete API route matrix |
| [`database.md`](./database.md) | Creating any model | All 25 collections with full field specs, indexing strategy, ACID transaction code, aggregation pipelines, sample documents, production Mongoose schemas |
| [`database-schema.md`](./database-schema.md) | Creating any Mongoose model | Every TypeScript interface for all 25 collections — exact field names, types, enums, optional/required flags |
| [`api-spec.md`](./api-spec.md) | Implementing any API endpoint | All 68 REST endpoints with exact request/response JSON, error payloads, business validation rules, rate limits |
| [`prompt.md`](./prompt.md) | Starting a new build phase | 12-phase step-by-step build guide — what to build, what files to create, acceptance criteria per phase |

---

## SECTION 3 — TECHNOLOGY STACK

### Backend
| Layer | Technology | Notes |
|:---|:---|:---|
| Runtime | Node.js (v20+) | LTS version |
| Framework | Express.js | REST API server |
| Language | TypeScript | Strict mode |
| Database ORM | Mongoose (ODM) | For MongoDB Atlas |
| Database | MongoDB Atlas | Multi-Node Replica Set, v6.0+ |
| Authentication | JWT (jsonwebtoken) | HTTP-only cookie sessions |
| Password Hashing | bcryptjs | Salt factor 12 for passwords |
| PIN Hashing | bcryptjs | Hashed 4-digit cashier PIN |
| Input Validation | Zod | Schema-first validation |
| Rate Limiting | express-rate-limit | 5 login attempts/min/IP |
| Real-time | Socket.io | WebSocket server |
| Background Jobs | node-cron | Nightly summary, cleanup |
| File Uploads | Multer | Memory storage + Cloudinary |
| Cloud Storage | Cloudinary / AWS S3 | Product images, receipt scans |
| Excel Export | ExcelJS | Streaming workbook writer |
| PDF Generation | pdfmake / puppeteer | Report PDFs |
| Process Manager | PM2 | Cluster mode in production |
| Reverse Proxy | Nginx | SSL termination, routing |

### Frontend
| Layer | Technology | Notes |
|:---|:---|:---|
| Framework | Next.js 14+ (App Router) | SSR + PWA |
| Language | TypeScript | Strict mode |
| Styling | Tailwind CSS | Only CSS framework used |
| Icons | Lucide React | No other icon libraries |
| Server State | TanStack Query (React Query) | All API data fetching |
| Forms | React Hook Form + Zod | All form validation |
| Real-time | Socket.io Client | WebSocket listener |
| Offline Storage | IndexedDB (via idb library) | Cart queue buffering |
| Fonts | Google Fonts — Inter | Primary font |

### npm Packages — Backend (`server/`)
```bash
# Core
npm install express mongoose dotenv cors helmet morgan cookie-parser

# Auth & Security
npm install jsonwebtoken bcryptjs express-rate-limit crypto

# Validation & Types
npm install zod
npm install -D typescript ts-node-dev @types/express @types/node @types/cors @types/cookie-parser @types/morgan @types/jsonwebtoken @types/bcryptjs

# Real-time & Jobs
npm install socket.io node-cron
npm install -D @types/node-cron

# Uploads & Storage
npm install multer cloudinary
npm install -D @types/multer

# Reports & Export
npm install exceljs pdfmake

# Dev Tools
npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

### npm Packages — Frontend (`client/`)
```bash
npx -y create-next-app@latest . --typescript --tailwind --app --src-dir --eslint

npm install @tanstack/react-query axios socket.io-client idb react-hook-form zod @hookform/resolvers lucide-react
npm install recharts    # Charts for dashboard
npm install date-fns    # Date formatting
```

---

## SECTION 4 — PROJECT DIRECTORY STRUCTURE

> The agent MUST follow this exact directory structure. Do not deviate from it.

```
pos-system/
│
├── client/                              ← Next.js 14 Frontend
│   ├── public/
│   ├── src/
│   │   ├── app/                         ← App Router pages
│   │   │   ├── layout.tsx               ← Root layout (fonts, providers)
│   │   │   ├── page.tsx                 ← Redirect to /login or /dashboard
│   │   │   ├── login/
│   │   │   │   └── page.tsx             ← Login page (public)
│   │   │   ├── (dashboard)/             ← Route group with sidebar layout
│   │   │   │   ├── layout.tsx           ← Dashboard layout (sidebar + header)
│   │   │   │   ├── dashboard/page.tsx
│   │   │   │   ├── products/page.tsx
│   │   │   │   ├── products/[id]/page.tsx
│   │   │   │   ├── categories/page.tsx
│   │   │   │   ├── brands/page.tsx
│   │   │   │   ├── inventory/page.tsx
│   │   │   │   ├── purchase-orders/page.tsx
│   │   │   │   ├── purchase-orders/[id]/page.tsx
│   │   │   │   ├── purchase-orders/new/page.tsx
│   │   │   │   ├── sales/page.tsx
│   │   │   │   ├── sales/[id]/page.tsx
│   │   │   │   ├── customers/page.tsx
│   │   │   │   ├── customers/[id]/ledger/page.tsx
│   │   │   │   ├── suppliers/page.tsx
│   │   │   │   ├── suppliers/[id]/ledger/page.tsx
│   │   │   │   ├── shifts/page.tsx
│   │   │   │   ├── shifts/[id]/z-report/page.tsx
│   │   │   │   ├── expenses/page.tsx
│   │   │   │   ├── accounts/page.tsx
│   │   │   │   ├── accounts/[id]/transactions/page.tsx
│   │   │   │   ├── reports/page.tsx
│   │   │   │   ├── reports/sales/page.tsx
│   │   │   │   ├── reports/inventory/page.tsx
│   │   │   │   ├── reports/pnl/page.tsx
│   │   │   │   ├── barcode-labels/page.tsx
│   │   │   │   ├── users/page.tsx
│   │   │   │   ├── roles/page.tsx
│   │   │   │   ├── audit-logs/page.tsx
│   │   │   │   └── settings/page.tsx
│   │   │   └── (pos)/                   ← Full-screen POS (no sidebar)
│   │   │       ├── layout.tsx           ← POS layout (full viewport)
│   │   │       └── pos/page.tsx         ← Main POS Terminal
│   │   │
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── NotificationBell.tsx
│   │   │   ├── pos/
│   │   │   │   ├── BarcodeSearchInput.tsx
│   │   │   │   ├── ProductGrid.tsx
│   │   │   │   ├── CartPanel.tsx
│   │   │   │   ├── CustomerSelector.tsx
│   │   │   │   ├── DiscountField.tsx
│   │   │   │   ├── HoldCartBar.tsx
│   │   │   │   ├── TerminalLockScreen.tsx
│   │   │   │   └── ReceiptPreview.tsx
│   │   │   ├── modals/
│   │   │   │   ├── PaymentModal.tsx
│   │   │   │   ├── ProductFormModal.tsx
│   │   │   │   ├── BarcodeLabelModal.tsx
│   │   │   │   ├── StockAdjustmentModal.tsx
│   │   │   │   ├── GRNModal.tsx
│   │   │   │   ├── OpenShiftModal.tsx
│   │   │   │   ├── CloseShiftModal.tsx
│   │   │   │   ├── PettyCashModal.tsx
│   │   │   │   ├── CustomerFormModal.tsx
│   │   │   │   ├── PayDueModal.tsx
│   │   │   │   ├── ReturnModal.tsx
│   │   │   │   ├── SupplierFormModal.tsx
│   │   │   │   ├── SupplierPaymentModal.tsx
│   │   │   │   ├── ExpenseFormModal.tsx
│   │   │   │   ├── AccountFormModal.tsx
│   │   │   │   ├── FundTransferModal.tsx
│   │   │   │   ├── CreateUserModal.tsx
│   │   │   │   └── ManagerOverrideModal.tsx
│   │   │   ├── reports/
│   │   │   │   ├── ReportToolbar.tsx
│   │   │   │   └── PrintableReport.tsx
│   │   │   └── ui/                      ← Shared primitives (Button, Input, Badge, Table, etc.)
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── usePOSHotkeys.ts
│   │   │   ├── useRealTimeNotifications.ts
│   │   │   └── useOfflineSync.ts
│   │   │
│   │   └── lib/
│   │       ├── api-client.ts            ← Axios instance with JWT interceptor
│   │       ├── auth-context.tsx         ← React context for auth state
│   │       ├── query-client.ts          ← TanStack Query configuration
│   │       ├── offline-queue.ts         ← IndexedDB cart buffer & sync logic
│   │       ├── escpos-builder.ts        ← ESC/POS receipt command builder
│   │       ├── cash-drawer.ts           ← Cash drawer trigger command
│   │       ├── socket-client.ts         ← Socket.io client setup
│   │       └── constants.ts             ← API URL, currency, enums
│   │
│   ├── .env.local
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
└── server/                              ← Express.js Backend
    ├── src/
    │   ├── index.ts                     ← Entry point (app setup, listen)
    │   ├── app.ts                       ← Express app factory (middleware mount)
    │   │
    │   ├── config/
    │   │   ├── db.ts                    ← Mongoose Atlas connection
    │   │   ├── env.ts                   ← dotenv loader + validation
    │   │   └── cloudinary.ts            ← Cloudinary SDK config
    │   │
    │   ├── models/                      ← All 25 Mongoose schemas (one file each)
    │   │   ├── Counter.ts
    │   │   ├── Role.ts
    │   │   ├── User.ts
    │   │   ├── TokenBlacklist.ts
    │   │   ├── Category.ts
    │   │   ├── Brand.ts
    │   │   ├── Product.ts               ← Includes embedded Variant subdocument
    │   │   ├── StockMovement.ts
    │   │   ├── PurchaseOrder.ts         ← Includes embedded POItem subdocument
    │   │   ├── Sale.ts                  ← Includes embedded SaleItem + Payment subdocuments
    │   │   ├── StoreCreditVoucher.ts
    │   │   ├── DailySalesSummary.ts
    │   │   ├── SalesReturn.ts           ← Includes embedded ReturnItem subdocument
    │   │   ├── Shift.ts
    │   │   ├── Customer.ts
    │   │   ├── CustomerLedger.ts
    │   │   ├── Supplier.ts
    │   │   ├── SupplierLedger.ts
    │   │   ├── ExpenseCategory.ts
    │   │   ├── Account.ts
    │   │   ├── AccountTransaction.ts
    │   │   ├── Expense.ts
    │   │   ├── AuditLog.ts
    │   │   ├── HoldCart.ts              ← Includes embedded HoldCartItem + TTL index
    │   │   └── Settings.ts              ← Singleton document
    │   │
    │   ├── middlewares/
    │   │   ├── auth.middleware.ts       ← JWT verify + blacklist check → req.user
    │   │   ├── rbac.middleware.ts       ← Permission string guard → 403 on fail
    │   │   ├── rate-limiter.middleware.ts
    │   │   ├── idempotency.middleware.ts ← Blocks duplicate checkout keys
    │   │   ├── validation.middleware.ts  ← Zod schema validator factory
    │   │   ├── upload.middleware.ts      ← Multer config
    │   │   └── error-handler.middleware.ts ← Global error boundary
    │   │
    │   ├── validators/                  ← Zod schemas (one per domain)
    │   │   ├── auth.validators.ts
    │   │   ├── product.validators.ts
    │   │   ├── sale.validators.ts
    │   │   ├── shift.validators.ts
    │   │   ├── customer.validators.ts
    │   │   ├── supplier.validators.ts
    │   │   ├── purchase-order.validators.ts
    │   │   ├── expense.validators.ts
    │   │   ├── account.validators.ts
    │   │   ├── return.validators.ts
    │   │   └── user.validators.ts
    │   │
    │   ├── controllers/                 ← Thin HTTP handlers (no business logic)
    │   │   ├── AuthController.ts
    │   │   ├── UserController.ts
    │   │   ├── RoleController.ts
    │   │   ├── CategoryController.ts
    │   │   ├── BrandController.ts
    │   │   ├── ProductController.ts
    │   │   ├── StockMovementController.ts
    │   │   ├── PurchaseOrderController.ts
    │   │   ├── SupplierController.ts
    │   │   ├── SaleController.ts
    │   │   ├── HoldCartController.ts
    │   │   ├── ReturnController.ts
    │   │   ├── VoucherController.ts
    │   │   ├── ShiftController.ts
    │   │   ├── CustomerController.ts
    │   │   ├── AccountController.ts
    │   │   ├── ExpenseController.ts
    │   │   ├── ReportController.ts
    │   │   ├── AuditLogController.ts
    │   │   ├── SettingsController.ts
    │   │   └── UploadController.ts
    │   │
    │   ├── services/                    ← All business logic lives here
    │   │   ├── AuthService.ts
    │   │   ├── UserService.ts
    │   │   ├── CategoryService.ts
    │   │   ├── BrandService.ts
    │   │   ├── ProductService.ts
    │   │   ├── InventoryService.ts
    │   │   ├── PurchaseOrderService.ts
    │   │   ├── SupplierService.ts
    │   │   ├── PosService.ts            ← Core POS checkout + atomic transaction
    │   │   ├── SequenceService.ts       ← Atomic invoice/PO number generator
    │   │   ├── ReturnService.ts
    │   │   ├── VoucherService.ts
    │   │   ├── ShiftService.ts
    │   │   ├── CustomerService.ts
    │   │   ├── AccountService.ts
    │   │   ├── ExpenseService.ts
    │   │   ├── DashboardService.ts
    │   │   ├── ReportService.ts
    │   │   ├── AuditLogService.ts
    │   │   └── SettingsService.ts
    │   │
    │   ├── routes/                      ← Express router definitions
    │   │   ├── index.ts                 ← Mount all routers on /api/v1
    │   │   ├── auth.routes.ts
    │   │   ├── user.routes.ts
    │   │   ├── role.routes.ts
    │   │   ├── category.routes.ts
    │   │   ├── brand.routes.ts
    │   │   ├── product.routes.ts
    │   │   ├── stock-movement.routes.ts
    │   │   ├── purchase-order.routes.ts
    │   │   ├── supplier.routes.ts
    │   │   ├── sale.routes.ts
    │   │   ├── hold-cart.routes.ts
    │   │   ├── return.routes.ts
    │   │   ├── voucher.routes.ts
    │   │   ├── shift.routes.ts
    │   │   ├── customer.routes.ts
    │   │   ├── account.routes.ts
    │   │   ├── expense.routes.ts
    │   │   ├── report.routes.ts
    │   │   ├── audit-log.routes.ts
    │   │   ├── settings.routes.ts
    │   │   └── upload.routes.ts
    │   │
    │   ├── jobs/                        ← node-cron background schedulers
    │   │   ├── scheduler.ts             ← Initializes all cron jobs on startup
    │   │   ├── nightly-summary.ts       ← Nightly materialized daily summary
    │   │   ├── expired-cart-cleanup.ts  ← Hourly TTL cart cleanup
    │   │   └── fefo-expiry-scan.ts      ← Morning expiry scan + Socket alert
    │   │
    │   ├── sockets/
    │   │   ├── socket-server.ts         ← Socket.io server init + JWT auth
    │   │   └── events.ts                ← Event emitter helpers
    │   │
    │   ├── seeds/                       ← Database seed scripts
    │   │   ├── seed-roles.ts
    │   │   ├── seed-admin.ts
    │   │   └── seed-settings.ts
    │   │
    │   └── utils/
    │       ├── api-response.ts          ← sendSuccess() / sendError() helpers
    │       ├── app-error.ts             ← Custom AppError class
    │       ├── audit-helper.ts          ← Before/after diff snapshot util
    │       ├── logger.ts                ← Winston or Pino logger
    │       ├── escpos-formatter.ts      ← ESC/POS receipt command builder
    │       └── streaming-excel.ts       ← ExcelJS streaming export service
    │
    ├── .env
    ├── tsconfig.json
    └── package.json
```

---

## SECTION 5 — DATABASE DESIGN (25 COLLECTIONS)

> The full TypeScript interfaces are in `database-schema.md`. Below are the key rules per collection.

### 5.1 Collection Summary

| # | Collection | Embedding | Referenced By | TTL | Unique Indexes |
|:---:|:---|:---|:---|:---:|:---|
| 1 | `counters` | — | sales, purchase_orders | — | `_id` |
| 2 | `roles` | — | users | — | `name` |
| 3 | `users` | — | sales, shifts, audit_logs | — | `username`, `phone` |
| 4 | `token_blacklist` | — | — | ✅ 24h | `tokenHash` |
| 5 | `categories` | — | products | — | `code` |
| 6 | `brands` | — | products | — | — |
| 7 | `products` | `variants[]` (1-to-few) | stock_movements, sales | — | `variants.sku`, `variants.barcode` |
| 8 | `stock_movements` | — | products | — | — |
| 9 | `purchase_orders` | `items[]` (1-to-few) | supplier_ledgers | — | `poNumber` |
| 10 | `sales` | `items[]` + `payments[]` | stock_movements, customer_ledgers | — | `invoiceNo`, `idempotencyKey` |
| 11 | `store_credit_vouchers` | — | sales_returns | — | `voucherCode` |
| 12 | `daily_sales_summaries` | — | — | — | `date` |
| 13 | `sales_returns` | `items[]` (1-to-few) | store_credit_vouchers | — | `returnNo` |
| 14 | `shifts` | — | sales, hold_carts | — | — |
| 15 | `customers` | — | sales, customer_ledgers | — | `phone` |
| 16 | `customer_ledgers` | — | — | — | — |
| 17 | `suppliers` | — | purchase_orders, supplier_ledgers | — | — |
| 18 | `supplier_ledgers` | — | — | — | — |
| 19 | `expense_categories` | — | expenses | — | `code` |
| 20 | `accounts` | — | account_transactions, expenses | — | — |
| 21 | `account_transactions` | — | — | — | — |
| 22 | `expenses` | — | — | — | — |
| 23 | `audit_logs` | — | — | — | — |
| 24 | `hold_carts` | `items[]` (1-to-few) | — | ✅ 24h | — |
| 25 | `settings` | — | — | — | `isDefault` (singleton) |

### 5.2 Schema Design Patterns

**EMBEDDING (1-to-few)** — Used for data always fetched together with parent:
- `products.variants[]` — Variants always fetched with product
- `sales.items[]` — Line items always fetched with invoice
- `sales.payments[]` — Payment breakdown always with invoice
- `purchase_orders.items[]` — PO line items always with PO
- `sales_returns.items[]` — Return lines always with return doc
- `hold_carts.items[]` — Cart items always with cart

**REFERENCING (1-to-many)** — Used for unbounded growth collections:
- `stock_movements` — Grows with every sale/adjustment; separate collection
- `customer_ledgers` — Each due/payment creates new doc; unbounded
- `supplier_ledgers` — Each PO/payment creates new doc
- `account_transactions` — Every financial event; very high volume
- `audit_logs` — Every action; extreme growth

**SNAPSHOT PATTERN** — Sale items MUST copy values at sale time:
- `unitCostPrice` — Cost at sale time (COGS accuracy)
- `unitSellingPrice` — Price at sale time (even if product price later changes)
- `taxRate` — Tax % at sale time
- `productName`, `variantName`, `sku`, `barcode` — All snapshots

### 5.3 Critical MongoDB Index Definitions

```typescript
// COUNTERS
db.counters.createIndex({ _id: 1 }, { unique: true });

// ROLES
db.roles.createIndex({ name: 1 }, { unique: true });

// USERS
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ phone: 1 }, { unique: true, sparse: true });
db.users.createIndex({ roleId: 1 });

// TOKEN BLACKLIST — TTL: auto-purge after JWT expiry
db.token_blacklist.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
db.token_blacklist.createIndex({ tokenHash: 1 }, { unique: true });

// CATEGORIES
db.categories.createIndex({ code: 1 }, { unique: true });
db.categories.createIndex({ parentId: 1 });

// BRANDS
db.brands.createIndex({ name: 1 });

// PRODUCTS — Critical for < 100ms POS barcode lookup
db.products.createIndex({ 'variants.sku': 1 }, { unique: true });
db.products.createIndex({ 'variants.barcode': 1 }, { unique: true, sparse: true });
db.products.createIndex(
  { name: 'text', 'variants.attributeName': 'text' },
  { weights: { name: 10, 'variants.attributeName': 5 }, name: 'product_text_search' }
);
db.products.createIndex({ categoryId: 1, isActive: 1 });
db.products.createIndex({ 'variants.currentStock': 1 });
db.products.createIndex({ 'variants.expiryDate': 1 }); // FEFO

// STOCK MOVEMENTS
db.stock_movements.createIndex({ variantId: 1, createdAt: -1 });
db.stock_movements.createIndex({ referenceType: 1, referenceId: 1 });

// PURCHASE ORDERS
db.purchase_orders.createIndex({ poNumber: 1 }, { unique: true });
db.purchase_orders.createIndex({ supplierId: 1, createdAt: -1 });
db.purchase_orders.createIndex({ status: 1 });

// SALES — Idempotency prevents duplicate billing
db.sales.createIndex({ invoiceNo: 1 }, { unique: true });
db.sales.createIndex({ idempotencyKey: 1 }, { unique: true });
db.sales.createIndex({ shiftId: 1, createdAt: -1 });
db.sales.createIndex({ customerId: 1, createdAt: -1 });
db.sales.createIndex({ createdAt: -1 });

// STORE CREDIT VOUCHERS
db.store_credit_vouchers.createIndex({ voucherCode: 1 }, { unique: true });
db.store_credit_vouchers.createIndex({ customerId: 1, status: 1 });

// SALES RETURNS
db.sales_returns.createIndex({ returnNo: 1 }, { unique: true });
db.sales_returns.createIndex({ saleId: 1, createdAt: -1 });

// SHIFTS
db.shifts.createIndex({ userId: 1, status: 1, openedAt: -1 });

// CUSTOMERS
db.customers.createIndex({ phone: 1 }, { unique: true });
db.customer_ledgers.createIndex({ customerId: 1, createdAt: -1 });

// SUPPLIERS
db.suppliers.createIndex({ companyName: 1 });
db.supplier_ledgers.createIndex({ supplierId: 1, createdAt: -1 });

// EXPENSES
db.expense_categories.createIndex({ code: 1 }, { unique: true });
db.expenses.createIndex({ categoryId: 1, createdAt: -1 });
db.expenses.createIndex({ accountId: 1, createdAt: -1 });

// ACCOUNTS
db.accounts.createIndex({ accountType: 1 });
db.account_transactions.createIndex({ accountId: 1, createdAt: -1 });
db.account_transactions.createIndex({ referenceType: 1, referenceId: 1 });

// ANALYTICS
db.daily_sales_summaries.createIndex({ date: 1 }, { unique: true });

// AUDIT LOGS
db.audit_logs.createIndex({ entity: 1, entityId: 1, createdAt: -1 });
db.audit_logs.createIndex({ userId: 1, createdAt: -1 });

// HOLD CARTS — TTL: auto-delete after 24h
db.hold_carts.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
db.hold_carts.createIndex({ userId: 1, shiftId: 1, createdAt: -1 });

// SETTINGS — Singleton enforcement
db.settings.createIndex({ isDefault: 1 }, { unique: true });
```

---

## SECTION 6 — USER ROLES & RBAC

### 6.1 Three Default System Roles

#### SUPER_ADMIN (all permissions)
```
pos:checkout, inv:view, inv:manage, inv:adjust, inv:labels,
procurement:view, procurement:manage, procurement:receive, procurement:pay,
sales:view, returns:authorize,
shifts:operate, shifts:view,
customers:view, customers:create, customers:manage, customers:pay_due,
accounts:view, accounts:manage, accounts:transfer,
expenses:view, expenses:create, expenses:manage,
reports:dashboard, reports:sales, reports:inventory, reports:purchases,
reports:dues, reports:payables, reports:pnl, reports:export,
audit:view, settings:manage, users:manage, roles:view, roles:manage
```

#### BRANCH_MANAGER
```
pos:checkout, inv:view, inv:manage, inv:adjust, inv:labels,
procurement:view, procurement:manage, procurement:receive, procurement:pay,
sales:view, returns:authorize,
shifts:operate, shifts:view,
customers:view, customers:create, customers:manage, customers:pay_due,
expenses:view, expenses:create, expenses:manage,
reports:dashboard, reports:sales, reports:inventory, reports:purchases,
reports:dues, reports:payables, reports:export,
roles:view
```

#### CASHIER
```
pos:checkout, inv:view,
shifts:operate,
customers:view, customers:create, customers:pay_due,
expenses:create,
sales:view
```

### 6.2 Access Control Matrix (From PRD)

| Feature | Admin | Manager | Cashier |
|:---|:---:|:---:|:---:|
| POS Checkout & Receipts | ✅ | ✅ | ✅ |
| Hold & Resume Cart | ✅ | ✅ | ✅ |
| Terminal Quick Lock / Unlock | ✅ | ✅ | ✅ (Own PIN) |
| Customer Credit / Due Sales | ✅ | ✅ | ✅ (up to limit) |
| Redeem Store Credit Voucher | ✅ | ✅ | ✅ |
| Sales Returns & Refunds | ✅ | ✅ | ❌ (Manager Override) |
| Shift Open / Close (Z-Report) | ✅ | ✅ | ✅ (Own shift only) |
| Product Catalog & Multi-Pricing | ✅ | ✅ | ❌ (View only) |
| Stock Adjustments & Wastage | ✅ | ✅ | ❌ |
| Purchase Orders & Stock Receiving | ✅ | ✅ | ❌ |
| Expense Logging & Approval | ✅ | ✅ (Log & Approve) | ❌ (Log only) |
| View Cost Price & Profit | ✅ | ✅ | ❌ **HIDDEN** |
| Apply Manual Discount > 10% | ✅ | ✅ (PIN required) | ❌ |
| Accounts & Bank Ledgers | ✅ | ❌ | ❌ |
| Barcode Label Printing | ✅ | ✅ | ❌ |
| Reports & Analytics | ✅ | ✅ (Operational) | ❌ |
| User & Role Management | ✅ | ❌ | ❌ |
| Audit Logs & Settings | ✅ | ❌ | ❌ |

### 6.3 Non-Negotiable Security Rules

1. **Cashier data isolation:** API responses for CASHIER role must **never** include: `costPrice`, `batches`, `baseCostPrice`, `unitCostPrice` (in product catalog — it IS included in sale item snapshots as needed for COGS but not in product listing). Strip these fields server-side before sending.
2. **Returns always Manager+:** `POST /api/v1/returns` requires `returns:authorize` permission AND Manager PIN in request body.
3. **Discount override:** 11–50% discount → Manager PIN. >50% → Admin password. Both logged to `audit_logs`.
4. **Shift discrepancy approval:** If `|actualCash - expectedCash| > 10`, shift close is blocked until Manager PIN provided.
5. **JWT blacklist check:** Every authenticated request MUST check `token_blacklist` collection. A logged-out token must be rejected even if its expiry hasn't passed.
6. **Rate limiting:** Login endpoint: 5 attempts per minute per IP. Return `429 RATE_LIMIT_EXCEEDED`.
7. **System roles:** Roles with `isSystemRole: true` cannot be deleted.
8. **Audit log immutability:** `audit_logs` collection has no update or delete operations. Append-only.

---

## SECTION 7 — COMPLETE API REFERENCE (68 ENDPOINTS)

### Global Standards

**Base URL:** `http://localhost:5000/api/v1` (dev) | `https://api.pos-system.com/api/v1` (prod)

**Standard Success Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Human-readable success message",
  "data": {},
  "meta": { "page": 1, "limit": 20, "totalItems": 150, "totalPages": 8 },
  "timestamp": "2026-09-08T18:07:00.000Z"
}
```

**Standard Error Response:**
```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "MACHINE_READABLE_ERROR_CODE",
    "message": "Human-readable description",
    "details": [{ "field": "fieldName", "issue": "what is wrong" }]
  },
  "timestamp": "2026-09-08T18:07:00.000Z"
}
```

**Required Headers:**
- `Content-Type: application/json` — all requests with body
- `Authorization: Bearer <JWT>` — all protected routes
- `Idempotency-Key: <UUIDv4>` — **MANDATORY** for `POST /api/v1/sales/checkout` only

### Domain 1: Auth & System Security

| Method | Path | Auth | Permission | Description |
|:---|:---|:---:|:---|:---|
| POST | `/auth/login` | Public | — | Login, returns JWT in HTTP-only cookie. Rate limited 5/min/IP |
| POST | `/auth/logout` | Bearer | any | Blacklist JWT token hash in `token_blacklist` |
| GET | `/auth/me` | Bearer | any | Current user profile + permissions + terminal lock status |
| POST | `/auth/lock-terminal` | Bearer | any | Set `users.terminalLocked = true` |
| POST | `/auth/unlock-terminal` | Bearer | any | Verify 4-digit bcrypt PIN → set `terminalLocked = false` |
| GET | `/users` | Bearer | `users:manage` | List all staff with role filter, pagination |
| POST | `/users` | Bearer | `users:manage` | Create user (hash password + PIN) |
| GET | `/users/:id` | Bearer | `users:manage` | Get single user |
| PUT | `/users/:id` | Bearer | `users:manage` | Update profile / role / password reset |
| DELETE | `/users/:id` | Bearer | `users:manage` | Soft-deactivate (`isActive: false`) |
| PATCH | `/users/:id/pin` | Bearer | `users:manage` | Update 4-digit cashier PIN |
| GET | `/roles` | Bearer | `roles:view` | List all RBAC roles |
| POST | `/roles` | Bearer | `roles:manage` | Create custom role with permissions array |
| PUT | `/roles/:id` | Bearer | `roles:manage` | Update role permissions |

### Domain 2: Catalog & Inventory

| Method | Path | Auth | Permission | Description |
|:---|:---|:---:|:---|:---|
| GET | `/categories` | Bearer | `inv:view` | List categories (parent/child tree) |
| POST | `/categories` | Bearer | `inv:manage` | Create category with optional `defaultTaxRate` |
| PUT | `/categories/:id` | Bearer | `inv:manage` | Update category |
| DELETE | `/categories/:id` | Bearer | `inv:manage` | Soft-delete (blocked if active products exist → `CATEGORY_HAS_DEPENDENTS`) |
| GET | `/brands` | Bearer | `inv:view` | List brands |
| POST | `/brands` | Bearer | `inv:manage` | Create brand |
| PUT | `/brands/:id` | Bearer | `inv:manage` | Update brand |
| GET | `/products` | Bearer | `inv:view` | List products+variants. **Cashier: strip `costPrice`** |
| POST | `/products` | Bearer | `inv:manage` | Create product with embedded variants |
| GET | `/products/:id` | Bearer | `inv:view` | Single product. **Cashier: strip `costPrice`** |
| PUT | `/products/:id` | Bearer | `inv:manage` | Update product/variant |
| DELETE | `/products/:id` | Bearer | `inv:manage` | Soft-delete (`isActive: false`) |
| GET | `/products/barcode/:barcode` | Bearer | `pos:checkout` | **< 100ms SLA** — Fast barcode lookup |
| POST | `/products/labels/print` | Bearer | `inv:labels` | Generate ESC/POS or ZPL barcode sticker commands |
| POST | `/stock-movements/adjust` | Bearer | `inv:adjust` | Stock adjustment or wastage write-off |
| GET | `/stock-movements` | Bearer | `inv:view` | Paginated movement history |

### Domain 3: Procurement

| Method | Path | Auth | Permission | Description |
|:---|:---|:---:|:---|:---|
| GET | `/suppliers` | Bearer | `procurement:view` | List vendors + payable balances |
| POST | `/suppliers` | Bearer | `procurement:manage` | Create supplier |
| GET | `/suppliers/:id` | Bearer | `procurement:view` | Supplier details |
| PUT | `/suppliers/:id` | Bearer | `procurement:manage` | Update supplier |
| GET | `/suppliers/:id/ledger` | Bearer | `procurement:view` | Payable ledger history |
| POST | `/suppliers/:id/payments` | Bearer | `procurement:pay` | Disburse supplier payment |
| GET | `/purchase-orders` | Bearer | `procurement:view` | List POs with status filter |
| POST | `/purchase-orders` | Bearer | `procurement:manage` | Create PO (auto-generates `poNumber`) |
| GET | `/purchase-orders/:id` | Bearer | `procurement:view` | PO details + line items |
| PUT | `/purchase-orders/:id` | Bearer | `procurement:manage` | Update PO (DRAFT only) |
| POST | `/purchase-orders/:id/receive` | Bearer | `procurement:receive` | GRN — receive stock, update WAC, update supplier ledger |

### Domain 4: POS Checkout & Sales

| Method | Path | Auth | Permission | Description |
|:---|:---|:---:|:---|:---|
| GET | `/sales` | Bearer | `sales:view` | List invoices (date, cashier, customer, shift filters) |
| GET | `/sales/:id` | Bearer | `sales:view` | Full invoice with items, payments, customer |
| POST | `/sales/checkout` | Bearer | `pos:checkout` | **Atomic ACID checkout** — `Idempotency-Key` header REQUIRED |
| GET | `/sales/:id/receipt` | Bearer | `sales:view` | ESC/POS binary or HTML receipt. Query: `format=raw|html`, `paperWidth=58mm|80mm` |
| POST | `/sales/offline-sync` | Bearer | `pos:checkout` | Batch sync offline buffered sales from IndexedDB |
| POST | `/hold-carts` | Bearer | `pos:checkout` | Park active cart (24h TTL) |
| GET | `/hold-carts` | Bearer | `pos:checkout` | List held carts for current cashier/shift |
| GET | `/hold-carts/:id` | Bearer | `pos:checkout` | Get held cart to resume |
| DELETE | `/hold-carts/:id` | Bearer | `pos:checkout` | Discard held cart |
| GET | `/vouchers/:code` | Bearer | `pos:checkout` | Verify store credit voucher balance + status |
| POST | `/returns` | Bearer | `returns:authorize` | Process return — requires Manager PIN in body |

### Domain 5: Shifts

| Method | Path | Auth | Permission | Description |
|:---|:---|:---:|:---|:---|
| POST | `/shifts/open` | Bearer | `shifts:operate` | Open shift with opening float |
| GET | `/shifts/current` | Bearer | `shifts:operate` | Active shift for authenticated cashier |
| POST | `/shifts/petty-cash` | Bearer | `shifts:operate` | Log mid-day petty cash in/out |
| POST | `/shifts/close` | Bearer | `shifts:operate` | Close shift, blind count, discrepancy check |
| GET | `/shifts` | Bearer | `shifts:view` | Paginated shift history |
| GET | `/shifts/:id/z-report` | Bearer | `shifts:view` | Z-Report summary for a closed/open shift |

### Domain 6: CRM & Customers

| Method | Path | Auth | Permission | Description |
|:---|:---|:---:|:---|:---|
| GET | `/customers` | Bearer | `customers:view` | Customer directory + due balances |
| POST | `/customers` | Bearer | `customers:create` | Register new customer (Retail/Wholesale type) |
| PUT | `/customers/:id` | Bearer | `customers:manage` | Update profile / credit limit / type |
| GET | `/customers/:id/ledger` | Bearer | `customers:view` | Bakir Khata transaction history |
| POST | `/customers/:id/pay-due` | Bearer | `customers:pay_due` | Collect due payment |

### Domain 7: Financial Accounts & Expenses

| Method | Path | Auth | Permission | Description |
|:---|:---|:---:|:---|:---|
| GET | `/accounts` | Bearer | `accounts:view` | List financial accounts + balances |
| POST | `/accounts` | Bearer | `accounts:manage` | Create Cash/Bank/MFS account |
| PUT | `/accounts/:id` | Bearer | `accounts:manage` | Update account name/status |
| POST | `/accounts/transfer` | Bearer | `accounts:transfer` | Inter-account fund transfer (double-entry) |
| GET | `/accounts/:id/transactions` | Bearer | `accounts:view` | Debit/credit ledger history |
| GET | `/expenses` | Bearer | `expenses:view` | List expenses with filters |
| POST | `/expenses` | Bearer | `expenses:create` | Log expense (debits account) |
| GET | `/expenses/categories` | Bearer | `expenses:view` | List expense categories |
| POST | `/expenses/categories` | Bearer | `expenses:manage` | Create expense category |

### Domain 8: Reports & Analytics

| Method | Path | Auth | Permission | Description |
|:---|:---|:---:|:---|:---|
| GET | `/reports/dashboard` | Bearer | `reports:dashboard` | KPI summary (< 100ms from materialized data) |
| GET | `/reports/sales` | Bearer | `reports:sales` | Sales report (item/cashier/category/tier). Supports `format=excel\|pdf` |
| GET | `/reports/inventory-valuation` | Bearer | `reports:inventory` | Stock valuation |
| GET | `/reports/inventory-wastage` | Bearer | `reports:inventory` | Wastage & shrinkage |
| GET | `/reports/purchases` | Bearer | `reports:purchases` | Procurement summary |
| GET | `/reports/customer-aging` | Bearer | `reports:dues` | Customer due aging |
| GET | `/reports/supplier-payable` | Bearer | `reports:payables` | Supplier payable aging |
| GET | `/reports/pnl` | Bearer | `reports:pnl` | Profit & Loss statement |
| GET | `/reports/export` | Bearer | `reports:export` | Generic streaming export trigger |

### Domain 9: System

| Method | Path | Auth | Permission | Description |
|:---|:---|:---:|:---|:---|
| GET | `/audit-logs` | Bearer | `audit:view` | Paginated audit trail with filters |
| GET | `/settings` | Bearer | `settings:manage` | Get shop + hardware settings |
| PUT | `/settings` | Bearer | `settings:manage` | Update settings |
| POST | `/uploads/image` | Bearer | `inv:manage` | Upload product image / shop logo |
| POST | `/uploads/voucher` | Bearer | `expenses:create` | Upload expense receipt scan |

---

## SECTION 8 — CORE BUSINESS LOGIC

> These rules are absolute. Never implement business logic that contradicts these specifications.

### Rule 1: Tax Calculation
```typescript
function calculateTax(sellingPrice: number, taxType: string, taxRate: number): number {
  if (taxType === 'INCLUSIVE') {
    // Tax is already inside the price
    return sellingPrice - (sellingPrice / (1 + taxRate / 100));
  }
  if (taxType === 'EXCLUSIVE') {
    // Tax added on top of price
    return sellingPrice * (taxRate / 100);
  }
  return 0; // EXEMPT
}
```

### Rule 2: Multi-Tier Pricing
```typescript
// When a customer is selected at POS checkout:
const price = customer?.customerType === 'WHOLESALE'
  ? variant.wholesaleSellingPrice
  : variant.retailSellingPrice; // Default MRP for retail or walk-in
```

### Rule 3: Atomic POS Checkout Transaction
All 9 steps below must execute inside a single MongoDB ACID session. If any step fails, the entire transaction aborts.

```
ATOMIC TRANSACTION STEPS — POST /api/v1/sales/checkout

Step 1:  Counter.findOneAndUpdate({ _id: "invoice_seq_YYYYMMDD" }, { $inc: { seq: 1 } }, { upsert: true, session })
         → invoiceNo = "INV-{YYYYMMDD}-{seq padded to 5 digits}"

Step 2:  For each cart item:
         Product.findOneAndUpdate(
           { _id: productId, "variants._id": variantId, "variants.currentStock": { $gte: quantity } },
           { $inc: { "variants.$.currentStock": -quantity } },
           { session }
         )
         → Throws INSUFFICIENT_INVENTORY if no document matched (unless isOfflineSynced = true)

Step 3:  StockMovement.create([{ type: "OUT", referenceType: "SALE", referenceId: null, ... }], { session })
         → Save movement IDs for Step 5

Step 4:  Sale.create([{ ...salePayload, invoiceNo, cashierId }], { session })

Step 5:  StockMovement.updateMany({ _id: { $in: movementIds } }, { $set: { referenceId: createdSale._id } }, { session })

Step 6:  netCashReceived = sum(cash payments) - changeReturned
         If netCashReceived > 0:
           Shift.findByIdAndUpdate(shiftId, { $inc: { cashSalesTotal: netCashReceived } }, { session })

Step 7:  If dueAmount > 0 AND customerId exists:
         - Verify: customer.currentDueBalance + dueAmount <= customer.creditLimit → else throw CREDIT_LIMIT_EXCEEDED
         - Customer.findByIdAndUpdate(customerId, { $inc: { currentDueBalance: dueAmount } }, { session })
         - CustomerLedger.create([{ type: "SALE_DUE", ... }], { session })

Step 8:  For each STORE_CREDIT payment:
         StoreCreditVoucher.findOneAndUpdate(
           { voucherCode: transactionRef, status: "ACTIVE", currentBalance: { $gte: amount } },
           { $inc: { currentBalance: -amount } },
           { session }
         )
         → Throws VOUCHER_EXHAUSTED_OR_EXPIRED on fail
         → If voucher.currentBalance becomes 0: set status = "EXHAUSTED"

Step 9:  For each payment with accountId:
         Account.findByIdAndUpdate(accountId, { $inc: { currentBalance: amount } }, { session })
         AccountTransaction.create([{ type: "CREDIT", referenceType: "SALE", ... }], { session })

COMMIT → session.commitTransaction()
CATCH  → session.abortTransaction(); throw error
```

### Rule 4: Inventory Wastage Write-Off (Atomic)
```
When type = "WASTAGE" in POST /stock-movements/adjust:

1. Product.findOneAndUpdate(decrement variant.currentStock by quantity)
2. StockMovement.create({ type: "WASTAGE", ... })
3. Find or create ExpenseCategory where name = "Inventory Shrinkage & Loss"
4. Expense.create({ categoryId, amount: quantity × variant.costPrice, accountId })
5. Account.findByIdAndUpdate(accountId, { $inc: { currentBalance: -expenseAmount } })
6. AccountTransaction.create({ type: "DEBIT", referenceType: "WASTAGE_LOSS", ... })

All within a single MongoDB session.
```

### Rule 5: Sales Return Logic (Atomic)
```
POST /api/v1/returns — Requires Manager PIN

1. Validate managerPin via bcrypt compare against manager user's pinHash
2. Fetch original Sale, verify return quantities do not exceed original quantities
3. Calculate proportional refund per item:
   proportionalRefund = (item.unitSellingPrice / sale.subtotal) × (sale.totalAmount - sale.discountAmount)
4. For each return item:
   - If isResaleable = true:
     → Stock IN (StockMovement type: RETURN)
   - If isResaleable = false:
     → Treat as wastage: create Expense + AccountTransaction DEBIT
5. If refundType = "STORE_CREDIT":
   → Generate voucherCode = "CR-" + 4 random alphanumeric + "-" + 4 random alphanumeric
   → StoreCreditVoucher.create({ voucherCode, initialBalance, currentBalance, expiresAt: +1 year })
6. If refundType = "CASH":
   → Account.update({ $inc: { currentBalance: -totalRefundAmount } })
   → AccountTransaction.create({ type: "DEBIT", referenceType: "RETURN" })
7. SalesReturn.create(returnDocument)
8. AuditLog.create({ action: "CREATE", entity: "sales_returns", ... })
```

### Rule 6: Purchase Order Receiving — WAC Recalculation
```typescript
// On GRN receiving, for each line item:
const newWAC = (
  (variant.currentStock * variant.costPrice) + (receivedQty * newUnitCost)
) / (variant.currentStock + receivedQty);

// Update variant:
Product.findOneAndUpdate(
  { "variants._id": variantId },
  {
    $inc: { "variants.$.currentStock": receivedQty },
    $set: { "variants.$.costPrice": newWAC }  // Update Weighted Average Cost
  }
)

// Also push to batches[] if expiryDate provided (FEFO tracking)
```

### Rule 7: Shift Cash Reconciliation
```
Expected Cash = openingFloat + cashSalesTotal + pettyCashIn - cashExpensesTotal - pettyCashOut
Discrepancy = actualCash (entered by cashier) - expectedCash

If Math.abs(discrepancy) > 10:
  → Require managerPin in request body
  → Verify PIN, record managerApprovalId
  → Log AuditLog { action: "SHIFT_DISCREPANCY", entity: "shifts", ... }

If Math.abs(discrepancy) <= 10:
  → Close shift without manager approval
```

### Rule 8: Offline Sales Sync Conflict Policy (PRD 6.5)
```
POST /api/v1/sales/offline-sync with isOfflineSynced = true:

For each queued sale:
1. Execute atomic checkout without the stock guard
   (skip: "variants.currentStock": { $gte: qty } condition)
2. Allow stock to go negative — do NOT block the sale
3. If variant.currentStock goes negative after decrement:
   → AuditLog.create({ action: "OFFLINE_OVERSELL", entity: "sales", ... })
   → Emit Socket.io event: "OFFLINE_OVERSELL_ALERT" to Admin/Manager room
4. Mark sale with isOfflineSynced: true
```

### Rule 9: Discount Override Rules
```
At POS checkout / cart level:

discountPercent = (discountAmount / subtotal) * 100

If discountPercent > 0 && discountPercent <= 10:
  → Cashier can apply freely — no override needed

If discountPercent > 10 && discountPercent <= 50:
  → Frontend prompts for Manager PIN
  → Backend verifies Manager PIN before checkout
  → AuditLog: action = "PRICE_OVERRIDE", metadata = { discountPercent, authorizedBy }

If discountPercent > 50:
  → Frontend prompts for Admin password
  → Backend verifies Admin password before checkout
  → AuditLog: action = "PRICE_OVERRIDE", metadata = { discountPercent, authorizedBy }
```

### Rule 10: Credit Limit Enforcement
```typescript
// Before creating a credit sale (dueAmount > 0):
if (customer.currentDueBalance + dueAmount > customer.creditLimit) {
  throw new AppError('CREDIT_LIMIT_EXCEEDED', 422,
    `Customer credit limit exceeded. Current: ${customer.currentDueBalance}, Proposed: ${dueAmount}, Limit: ${customer.creditLimit}`
  );
}
// Show warning in POS UI when customer.currentDueBalance >= 0.9 * customer.creditLimit
```

### Rule 11: Sequential Number Generator (Atomic, Race-Condition Safe)
```typescript
// server/src/services/SequenceService.ts
import Counter from '../models/Counter';
import { ClientSession } from 'mongoose';

export async function generateInvoiceNo(session: ClientSession): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const key = `invoice_seq_${today}`;
  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return `INV-${today}-${String(counter.seq).padStart(5, '0')}`;
  // e.g. INV-20260907-00001
}

export async function generatePONumber(session: ClientSession): Promise<string> {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const key = `po_seq_${today}`;
  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );
  return `PO-${today}-${String(counter.seq).padStart(4, '0')}`;
  // e.g. PO-20260907-0001
}
```

---

## SECTION 9 — ERROR CODE DICTIONARY

Every API error response must use one of these machine-readable codes in `error.code`:

| Error Code | HTTP Status | Trigger Condition |
|:---|:---:|:---|
| `AUTH_CREDENTIALS_INVALID` | 401 | Wrong username or password |
| `TOKEN_EXPIRED` | 401 | JWT `exp` timestamp passed |
| `TOKEN_INVALID_OR_BLACKLISTED` | 401 | Malformed JWT or exists in `token_blacklist` |
| `PERMISSION_DENIED` | 403 | RBAC permission string not in user's role |
| `TERMINAL_LOCKED` | 403 | `terminalLocked = true` — PIN required |
| `PIN_INVALID` | 401 | bcrypt PIN comparison failed |
| `RATE_LIMIT_EXCEEDED` | 429 | >5 login attempts per minute per IP |
| `INVALID_PAYLOAD` | 400 | Zod validation failed — includes `details[]` |
| `PRODUCT_NOT_FOUND` | 404 | `productId` does not exist |
| `VARIANT_NOT_FOUND` | 404 | `variantId` subdocument does not exist |
| `DUPLICATE_SKU` | 409 | `variants.sku` already exists in products |
| `DUPLICATE_BARCODE` | 409 | `variants.barcode` already exists |
| `INSUFFICIENT_INVENTORY` | 422 | `currentStock < requestedQty` (live sale only) |
| `CATEGORY_HAS_DEPENDENTS` | 409 | Deleting category that has active products |
| `PO_STATUS_INVALID` | 422 | Action invalid for current PO status (e.g. editing RECEIVED PO) |
| `PARTIAL_RECEIVING_OVERFLOW` | 422 | Received qty exceeds ordered qty |
| `SUPPLIER_NOT_FOUND` | 404 | Supplier document not found |
| `IDEMPOTENCY_KEY_REPLAY` | 409 | `Idempotency-Key` already used for a sale |
| `SHIFT_NOT_ACTIVE` | 422 | No OPEN shift for the cashier |
| `SHIFT_ALREADY_OPEN` | 409 | Cashier already has an OPEN shift |
| `SHIFT_CLOSED_CANNOT_CHECKOUT` | 422 | Trying to checkout when shift is CLOSED |
| `CREDIT_LIMIT_EXCEEDED` | 422 | `currentDue + dueAmount > creditLimit` |
| `VOUCHER_EXHAUSTED_OR_EXPIRED` | 422 | Voucher `status ≠ ACTIVE` or `currentBalance < amount` |
| `DISCOUNT_REQUIRES_MANAGER_PIN` | 403 | Discount > 10% attempted without Manager PIN |
| `PROPORTIONAL_REFUND_ERROR` | 400 | Return qty > original sale qty |
| `DISCREPANCY_REQUIRES_APPROVAL` | 403 | Shift close discrepancy > $10, no Manager PIN |
| `CUSTOMER_NOT_FOUND` | 404 | Customer document not found |
| `CUSTOMER_PHONE_DUPLICATE` | 409 | Phone number already registered |
| `ACCOUNT_INSUFFICIENT_FUNDS` | 422 | Account balance too low for debit |
| `ACCOUNT_NOT_ACTIVE` | 422 | Account `isActive = false` |
| `TRANSACTION_ABORTED_CONCURRENCY` | 500 | MongoDB write conflict — client should retry |
| `DATABASE_TIMEOUT` | 500 | Query exceeded timeout threshold |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled exception |

---

## SECTION 10 — CODING STANDARDS & CONVENTIONS

### TypeScript Rules
```typescript
// ✅ CORRECT — typed interface for every model
interface IProduct {
  _id: Types.ObjectId;
  name: string;
  taxType: 'INCLUSIVE' | 'EXCLUSIVE' | 'EXEMPT'; // Use literal unions, not plain string
  variants: IVariant[];
}

// ❌ WRONG — never use any
const data: any = req.body;

// ✅ CORRECT — validate with Zod first, type is inferred
const validated = createProductSchema.parse(req.body); // Type is auto-inferred
```

### Express Service Layer Pattern
```typescript
// ❌ WRONG — business logic in controller
router.post('/products', async (req, res) => {
  const product = await Product.create(req.body); // No validation, no logic
  res.json(product);
});

// ✅ CORRECT — thin controller calls service
// ProductController.ts
export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createProductSchema.parse(req.body); // Zod validation
    const product = await ProductService.createProduct(data, req.user.userId);
    return sendSuccess(res, 201, 'Product created successfully', product);
  } catch (error) {
    next(error); // Passes to global error handler
  }
};

// ProductService.ts — Business logic here
export async function createProduct(data: CreateProductDTO, userId: string) {
  // 1. Check SKU/barcode uniqueness
  // 2. Apply defaultTaxRate from category if taxRate = 0
  // 3. Create product document
  // 4. Log audit entry
}
```

### MongoDB Rules
```typescript
// ✅ Money values: always Number, never string
{ totalAmount: 150.50 }   // ✅
{ totalAmount: "150.50" } // ❌

// ✅ Snapshots: always copy price/name at transaction time
items: [{
  productName: product.name,        // Snapshot — not a reference
  unitSellingPrice: variant.retailSellingPrice, // Snapshot — frozen at sale time
  unitCostPrice: variant.costPrice, // Snapshot — frozen at sale time
  taxRate: product.taxRate,         // Snapshot
}]

// ✅ ACID transactions: wrap all multi-collection writes
const session = await mongoose.startSession();
session.startTransaction({ readConcern: { level: 'majority' }, writeConcern: { w: 'majority' } });
try {
  // ... all operations with { session }
  await session.commitTransaction();
} catch (err) {
  await session.abortTransaction();
  throw err;
} finally {
  session.endSession();
}

// ✅ Soft-delete pattern: never hard-delete products/users
await Product.findByIdAndUpdate(id, { $set: { isActive: false } });
```

### Environment Variables
```bash
# server/.env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/pos_db?retryWrites=true&w=majority
JWT_SECRET=<generate 256-bit random string: openssl rand -hex 32>
JWT_EXPIRES_IN=8h
NODE_ENV=development
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
ALLOWED_ORIGINS=http://localhost:3000

# client/.env.local
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

---

## SECTION 11 — FRONTEND UI STANDARDS

### Routing Rules
- Use **App Router** (`src/app/`) — never the old Pages Router
- `(dashboard)` route group — has sidebar + header layout
- `(pos)` route group — full-screen, no sidebar, maximized for cashier use
- `/login` — public route, no layout wrapper
- Route guards: `client/src/lib/auth-context.tsx` handles redirect if not authenticated

### Component Rules
```typescript
// ✅ All modals: controlled components
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  // ...other props
}

// ✅ All data fetching: TanStack Query (not raw useEffect)
const { data, isLoading, error } = useQuery({
  queryKey: ['products', filters],
  queryFn: () => apiClient.get('/products', { params: filters })
});

// ✅ All forms: React Hook Form + Zod
const schema = z.object({ name: z.string().min(1), price: z.number().positive() });
const form = useForm({ resolver: zodResolver(schema) });

// ✅ Tailwind CSS only — no inline styles
<div className="flex items-center gap-4 p-4 bg-gray-900 rounded-xl"> ... </div>
// ❌ Never:
<div style={{ display: 'flex', padding: '16px' }}> ... </div>

// ✅ Lucide React icons only
import { Package, ShoppingCart, Users } from 'lucide-react';
```

### Sidebar Navigation (Role-Filtered)
Show menu items only if user has the required permission:

| Menu | Route | Icon | Permission Check |
|:---|:---|:---|:---|
| Dashboard | `/dashboard` | LayoutDashboard | `reports:dashboard` |
| POS Terminal | `/pos` | ShoppingCart | `pos:checkout` |
| Products | `/products` | Package | `inv:view` |
| Categories | `/categories` | Tags | `inv:view` |
| Inventory | `/inventory` | Warehouse | `inv:view` |
| Purchase Orders | `/purchase-orders` | Truck | `procurement:view` |
| Sales History | `/sales` | Receipt | `sales:view` |
| Customers | `/customers` | Users | `customers:view` |
| Suppliers | `/suppliers` | Building2 | `procurement:view` |
| Shifts | `/shifts` | Clock | `shifts:operate` |
| Expenses | `/expenses` | CreditCard | `expenses:view` |
| Accounts | `/accounts` | Landmark | `accounts:view` |
| Reports | `/reports` | BarChart3 | `reports:dashboard` |
| Barcode Labels | `/barcode-labels` | Barcode | `inv:labels` |
| Users | `/users` | UserCog | `users:manage` |
| Audit Logs | `/audit-logs` | Shield | `audit:view` |
| Settings | `/settings` | Settings | `settings:manage` |

### POS Keyboard Hotkeys

Implement in `client/src/hooks/usePOSHotkeys.ts`:

```typescript
// All hotkeys must be implemented in the POS terminal page
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'F2') { e.preventDefault(); focusBarcodeInput(); }
    if (e.key === 'F4' && !e.shiftKey) { e.preventDefault(); holdCurrentCart(); }
    if (e.key === 'F4' && e.shiftKey) { e.preventDefault(); openHeldCartsList(); }
    if (e.key === 'F8') { e.preventDefault(); focusCustomerSelector(); }
    if (e.key === 'F9') { e.preventDefault(); openPaymentModal(); }
    if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); lockTerminal(); }
    if (e.key === 'Escape') { e.preventDefault(); closeActiveModal(); }
    if (e.key === 'Enter' && paymentModalOpen) { e.preventDefault(); confirmPayment(); }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [dependencies]);
```

---

## SECTION 12 — HARDWARE INTEGRATION

### Thermal Receipt Printer (ESC/POS)
- Paper widths: **58mm** (32 chars/line) and **80mm** (48 chars/line)
- Cash drawer kick command: `\x1B\x70\x00\x19\xFA`
- Receipt must contain (in order):
  1. Shop logo (if configured)
  2. Shop name, address, phone
  3. Dashed separator line
  4. Invoice number, date, time, cashier name
  5. Customer name (if selected)
  6. Dashed separator line
  7. Item list: `productName variantName | qty × price | lineTotal`
  8. Dashed separator line
  9. Subtotal, Tax, Discount, **Grand Total** (bold, large)
  10. Payment breakdown (Cash/Card/bKash/etc.)
  11. Change returned
  12. Dashed separator line
  13. Footer text (from settings.receiptFooter)
  14. Paper cut command

### Barcode Label Printer
- Default sticker format: `38mm × 25mm 2-up`
- Content per label: barcode (EAN-13 or Code-128), product name, variant name, selling price, shop name
- Output format: ESC/POS binary or ZPL (Zebra Printer Language)

### Barcode Scanner
- USB HID keyboard emulation (scanner types barcode + Enter)
- The POS page's barcode search input must always be auto-focused
- On Enter keypress in the barcode input → trigger product lookup API call

---

## SECTION 13 — BACKGROUND JOBS & REAL-TIME

### node-cron Schedules (`server/src/jobs/scheduler.ts`)
```typescript
import cron from 'node-cron';

// 1. Every night at 00:05 AM — materialize daily summary
cron.schedule('5 0 * * *', async () => {
  await processNightlyMaterializedSummary();
});

// 2. Every hour — cleanup expired hold carts (TTL backup)
cron.schedule('0 * * * *', async () => {
  await cleanupExpiredHoldCarts();
});

// 3. Every morning at 07:00 AM — scan FEFO expiry alerts
cron.schedule('0 7 * * *', async () => {
  await scanFefoExpiryAlerts(); // Emits Socket.io LOW_STOCK_ALERT if expiring soon
});
```

### Socket.io Real-time Events
- Server rooms: `role:SUPER_ADMIN` and `role:BRANCH_MANAGER` (Cashiers do not receive alerts)
- JWT auth required to connect to Socket.io namespace

| Event | Server Emits When | Payload Shape |
|:---|:---|:---|
| `LOW_STOCK_ALERT` | Stock falls ≤ alertQty after sale, or FEFO scan | `{ productName, sku, currentStock, alertQty, variantId }` |
| `SHIFT_DISCREPANCY_ALERT` | Shift closes with discrepancy > $10 | `{ shiftId, cashierName, discrepancy, expectedCash, actualCash }` |
| `OFFLINE_OVERSELL_ALERT` | Offline sync causes negative stock | `{ invoiceNo, productName, sku, currentStock }` |

---

## SECTION 14 — PERFORMANCE REQUIREMENTS

All of the following SLAs **must be met** before marking a phase complete:

| Operation | Max Time | How to Achieve |
|:---|:---:|:---|
| Barcode scan → cart add (API call) | **100ms** | Compound index on `variants.barcode`; short-circuit query |
| POS checkout API commit | **1.5 seconds** | Optimized ACID transaction; all indexes in place |
| Report generation (10K records) | **3.0 seconds** | Streaming aggregation cursor; materialized summaries |
| Dashboard KPI load | **100ms** | Read from `daily_sales_summaries` (pre-aggregated) |
| Page FCP | **1.2 seconds** | Next.js SSR; code splitting; font preloading |
| Page LCP | **2.0 seconds** | Image optimization; Tailwind CSS purging |

---

## SECTION 15 — BUILD PHASES

> Follow `prompt.md` for detailed step-by-step instructions per phase. This is the high-level order:

| Phase | Name | Key Output |
|:---:|:---|:---|
| **1** | Project Initialization | Express + Next.js running, MongoDB connected, health endpoint |
| **2** | Database Models | All 25 Mongoose schemas with TypeScript interfaces and indexes |
| **3** | Auth & Security Middleware | JWT login/logout, PIN lock, RBAC, rate limiter, idempotency, Zod |
| **4** | Users, Roles & App Shell | User/Role CRUD, role-filtered sidebar, dashboard layout |
| **5** | Settings, Catalog & Products | Settings singleton, Categories, Brands, Products with variants |
| **6** | Suppliers & Procurement | Supplier CRUD, PO create/receive, WAC recalculation |
| **7** | Shift Management | Open/close shift, petty cash, Z-Report |
| **8** | POS Terminal | Full checkout terminal, barcode scan, split payment, hold/resume, PIN lock, receipt |
| **9** | CRM, Sales History & Returns | Customer ledger, sales list, returns, vouchers |
| **10** | Inventory, Expenses & Finance | Wastage write-off, expense tracking, account ledger |
| **11** | Dashboard, Reports & Export | KPI cards, all 8 report types, PDF/Excel, cron jobs |
| **12** | Real-time, Audit & Production | Socket.io alerts, audit log viewer, performance tuning, deployment |

**Phase acceptance gate (must pass before next phase):**
- [ ] `tsc --noEmit` exits with 0 errors
- [ ] All new API endpoints return correct response structure
- [ ] RBAC tested for Admin, Manager, and Cashier role scenarios
- [ ] No `costPrice` visible in any Cashier-role API response
- [ ] MongoDB indexes created and verified
- [ ] Frontend pages render correctly and pass responsive checks

---

## SECTION 16 — QUICK REFERENCE TABLES

### Document Number Formats
| Document | Pattern | Example |
|:---|:---|:---|
| Invoice | `INV-YYYYMMDD-XXXXX` | `INV-20260907-00001` |
| Purchase Order | `PO-YYYYMMDD-XXXX` | `PO-20260907-0001` |
| Sales Return | `RET-YYYYMMDD-XXXX` | `RET-20260907-0001` |
| Store Credit Voucher | `CR-XXXX-XXXX` (12 chars) | `CR-9821-X47A` |

### Enum Values

**Product Unit:**
`Pcs` · `Kg` · `Gram` · `Ltr` · `Ml` · `Box` · `Meter` · `Goj`

**Tax Type:**
`INCLUSIVE` · `EXCLUSIVE` · `EXEMPT`

**Payment Method:**
`CASH` · `CARD` · `MFS_BKASH` · `MFS_NAGAD` · `STORE_CREDIT` · `CUSTOMER_DUE`

**Pricing Tier:**
`RETAIL` · `WHOLESALE`

**PO Status:**
`DRAFT` · `ORDERED` · `PARTIAL` · `RECEIVED` · `CANCELLED`

**Stock Movement Type:**
`IN` · `OUT` · `ADJUSTMENT` · `RETURN` · `WASTAGE`

**Stock Movement Reference Type:**
`SALE` · `PO` · `MANUAL` · `RETURN` · `WASTAGE_EXPENSE`

**Account Type:**
`CASH` · `BANK` · `MFS`

**Account Transaction Type:**
`CREDIT` · `DEBIT`

**Account Transaction Reference Type:**
`SALE` · `EXPENSE` · `TRANSFER` · `DUE_COLLECTION` · `SUPPLIER_PAYMENT` · `WASTAGE_LOSS`

**Shift Status:**
`OPEN` · `CLOSED`

**Voucher Status:**
`ACTIVE` · `EXHAUSTED` · `EXPIRED`

**Audit Log Action:**
`CREATE` · `UPDATE` · `DELETE` · `PRICE_OVERRIDE` · `OFFLINE_OVERSELL` · `SHIFT_DISCREPANCY`

**Customer Ledger Transaction Type:**
`SALE_DUE` · `PAYMENT_COLLECTION` · `RETURN_CREDIT`

**Supplier Ledger Transaction Type:**
`PO_GRN_BILL` · `PAYMENT_DISBURSAL` · `PURCHASE_RETURN`

**Refund Type:**
`CASH` · `STORE_CREDIT` · `CARD_REVERSAL`

### Locale & Currency
| Property | Value |
|:---|:---|
| Currency Name | Bangladeshi Taka |
| Currency Symbol | `৳` |
| Currency Code | `BDT` |
| Date Format | `YYYY-MM-DD` (ISO 8601) |
| Decimal Separator | `.` (period) |
| Supports Decimal Qty | Yes — `2.5 Goj`, `1.75 Meter`, `0.5 Kg` |

---

## FINAL NOTES FOR THE AI AGENT

1. **Read the full spec before coding.** The documents listed in Section 2 contain exact TypeScript interfaces, request/response examples, and business rules. Always cross-reference before implementing.

2. **Never invent behaviour.** If something is not specified, ask. Do not assume default behaviour for financial calculations, permission checks, or transaction boundaries.

3. **The database schema is final.** The 25 collections, their field names, types, and indexes defined in `database-schema.md` are the authoritative schema. Do not rename fields or add collections without explicit instruction.

4. **ACID transactions are non-negotiable** for: POS checkout, wastage write-off, sales returns, fund transfers, and supplier payments. Single-collection writes do not need a session.

5. **Security is not optional.** The Cashier role must never see cost prices, profit margins, or account balances. Strip these fields server-side on every response. Validate RBAC on every route.

6. **Follow the build phase order.** Do not skip phases. Each phase builds on the previous one. Completing acceptance criteria before moving to the next phase prevents compounding technical debt.

7. **Every number in money context is a JavaScript `number` (float).** Never store money as a string. Round to 2 decimal places before storing.

8. **Audit everything.** Every CREATE, UPDATE, DELETE of significant entities (products, sales, users, accounts, shifts) must produce an `audit_logs` entry with before/after metadata diff.

---

*This file is the master context document for building the Enterprise POS & Shop Management System. Refer to it throughout the entire project lifecycle.*
