# 🏗️ Step-by-Step Project Build Guide
## Enterprise Cloud-Based POS & Shop Management System

**Reference Documents:** [`PRD.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/PRD.md) · [`architecture.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/architecture.md) · [`database.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/database.md) · [`database-schema.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/database-schema.md) · [`api-spec.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/api-spec.md)

---

## 📌 Technology Stack Summary

| Layer | Technology |
|:---|:---|
| **Frontend** | Next.js (App Router), React, TypeScript, Tailwind CSS, TanStack Query |
| **Backend** | Express.js (Node.js), Layered Architecture (Controllers → Services → Repositories) |
| **Database** | MongoDB Atlas (Replica Set), Mongoose ODM, ACID Multi-Document Transactions |
| **Auth** | HTTP-only JWT Sessions, bcrypt/Argon2 password hashing, 4-digit Cashier PIN |
| **Real-time** | Socket.io (WebSocket) for live alerts |
| **Offline** | IndexedDB queue for offline cart buffering & auto-sync |
| **Reports** | ExcelJS streaming exports, PDF generation, Print previews |

---

## 📁 Project Directory Structure

```
pos-system/
├── client/                          # Next.js Frontend Application
│   ├── src/
│   │   ├── app/                     # Pages & App Router Layouts
│   │   ├── components/              # UI Components (POS, Inventory, Reports, Modals)
│   │   ├── lib/                     # IndexedDB queue, ESC/POS printer helper, API Client
│   │   └── hooks/                   # Custom Hooks (POS Hotkeys, Real-time Listeners, Auth)
│   ├── public/
│   ├── package.json
│   └── tsconfig.json
│
└── server/                          # Express.js Backend Application
    ├── src/
    │   ├── config/                  # MongoDB Connection & Environment Variables
    │   ├── middlewares/             # Auth, CashierPIN, RBAC, RateLimit, Idempotency, Validation
    │   ├── controllers/             # HTTP Request Handling & Response Formatting
    │   ├── services/                # Pure Business Logic & Transaction Workflows
    │   ├── repositories/            # Mongoose Data Access Layer
    │   ├── models/                  # Mongoose Schemas & TypeScript Interfaces
    │   ├── jobs/                    # Node-Cron Schedulers (Nightly Summary, Expired Cart Cleanup)
    │   ├── sockets/                 # Socket.io Real-time Event Handlers
    │   ├── validators/              # Zod Input Validation Schemas
    │   └── utils/                  # Logger, ESC/POS Formatter, Streaming Excel/PDF Builders
    ├── package.json
    └── tsconfig.json
```

---

# ═══════════════════════════════════════════════════
# PHASE 1: Project Initialization & Scaffolding Infrastructure
# ═══════════════════════════════════════════════════

> **Goal:** Set up both client and server projects from scratch, initialize directory structure, configure TypeScript & environment tooling, and establish MongoDB Atlas connection.

---

## Step 1.1 — Initialize Backend (Express.js + TypeScript)

**What to build:**
- Create the `server/` directory and sub-directory architecture
- Initialize Node.js project with TypeScript
- Install production & development dependencies

**Commands:**
```bash
# Initialize project
mkdir server && cd server
npm init -y

# Core Dependencies
npm install express mongoose dotenv cors helmet morgan cookie-parser jsonwebtoken bcryptjs express-rate-limit zod socket.io node-cron multer exceljs pdfmake

# Dev Dependencies & Types
npm install -D typescript ts-node-dev @types/express @types/node @types/cors @types/cookie-parser @types/morgan @types/jsonwebtoken @types/bcryptjs @types/node-cron @types/multer
```

**Files to create:**

1. `server/tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "CommonJS",
       "moduleResolution": "node",
       "outDir": "./dist",
       "rootDir": "./src",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true
     },
     "include": ["src/**/*"]
   }
   ```

2. `server/.env`:
   ```env
   PORT=5000
   MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/pos_db
   JWT_SECRET=super-secret-random-256bit-key-change-in-production
   JWT_EXPIRES_IN=8h
   NODE_ENV=development
   ```

3. `server/src/config/env.ts`:
   - Strongly-typed environment variables loaded via `dotenv`
   - Validates existence of required keys (`MONGODB_URI`, `JWT_SECRET`, `PORT`)

4. `server/src/config/db.ts`:
   - Mongoose connection helper connecting to `process.env.MONGODB_URI`
   - Logs `"Connected to MongoDB Atlas"` on success or exits process on failure

5. `server/src/index.ts`:
   - Express server entry point
   - Mounts middleware: CORS, Helmet, Morgan, Cookie-Parser, express.json
   - Mounts Health Check Endpoint: `GET /api/v1/health` returning `{ success: true, statusCode: 200, message: "Server is running smoothly" }`
   - Mounts global error handler middleware

**Acceptance Criteria:**
- [ ] `npm run dev` starts Express server on port 5000 without TypeScript compilation errors
- [ ] Server connects to MongoDB Atlas and logs "Connected to MongoDB Atlas"
- [ ] CORS, Helmet, Morgan, Cookie-Parser middleware are mounted
- [ ] Basic health check route `GET /api/v1/health` returns HTTP 200 JSON

---

## Step 1.2 — Initialize Frontend (Next.js + TypeScript + Tailwind CSS)

**What to build:**
- Create `client/` directory using Next.js App Router template
- Configure Tailwind CSS & Base Layout
- Setup API Client & Constants

**Commands:**
```bash
npx -y create-next-app@latest ./client --typescript --tailwind --app --src-dir --eslint --no-import-alias
```

**Files to create:**
1. `client/src/lib/constants.ts`:
   ```typescript
   export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
   export const CURRENCY_SYMBOL = "৳";
   export const DEFAULT_TAX_RATE = 5;
   ```

2. `client/src/lib/api-client.ts`:
   - Axios or Fetch wrapper with base URL set to `API_BASE_URL`
   - Automatically attaches JWT cookie/header to outgoing requests
   - Handles global HTTP error responses

3. `client/src/app/layout.tsx`:
   - Root layout with Inter Google font and dark mode support

4. `client/src/app/page.tsx`:
   - Temporary dashboard landing page showing system status and navigation link to POS

**Acceptance Criteria:**
- [ ] `npm run dev` starts Next.js on port 3000
- [ ] Tailwind CSS functions properly with custom design tokens
- [ ] API client can make authenticated requests to backend

---

## Step 1.3 — Standardized API Response Helper & Error Boundary

**What to build:**
Create unified API response helpers used by all backend controllers.

**Files to create:**

1. `server/src/utils/api-response.ts`:
   - `sendSuccess(res, statusCode, message, data, meta)`
   - `sendError(res, statusCode, errorCode, message, details)`
   - **Response Format (Success):**
     ```json
     {
       "success": true,
       "statusCode": 200,
       "message": "Operation completed successfully",
       "data": { ... },
       "meta": { "page": 1, "limit": 20, "totalItems": 150, "totalPages": 8 },
       "timestamp": "2026-09-08T18:07:00.000Z"
     }
     ```
   - **Response Format (Error):**
     ```json
     {
       "success": false,
       "statusCode": 400,
       "error": { "code": "ERROR_CODE", "message": "Human readable message", "details": [] },
       "timestamp": "2026-09-08T18:07:00.000Z"
     }
     ```

2. `server/src/utils/app-error.ts`:
   - Custom `AppError` class extending `Error`
   - Properties: `statusCode`, `errorCode`, `details[]`

3. `server/src/middlewares/error-handler.ts`:
   - Global Express error boundary middleware
   - Catches all thrown `AppError` instances and unhandled exceptions, returning standardized JSON (never HTML)

**Acceptance Criteria:**
- [ ] All controllers use `sendSuccess()` and `sendError()` helpers
- [ ] Global error handler catches unhandled errors and returns standardized JSON
- [ ] Error codes match dictionary in [`api-spec.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/api-spec.md) Section 1.5.2

---

# ═══════════════════════════════════════════════════
# PHASE 2: Database Schema & Models (All 25 Collections)
# ═══════════════════════════════════════════════════

> **Goal:** Create all 25 Mongoose models with TypeScript interfaces, validation rules, indexes, and TTL policies exactly as defined in [`database-schema.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/database-schema.md).

---

## Step 2.1 — System & Auth Domain Models

**Files to create:**

### 1. `server/src/models/Counter.ts`
```typescript
interface ICounter {
  _id: string;          // e.g. "invoice_seq_20260907", "po_seq_2026"
  seq: number;
  updatedAt: Date;
}
```

### 2. `server/src/models/Role.ts`
```typescript
interface IRole {
  _id: Types.ObjectId;
  name: string;         // "SUPER_ADMIN" | "BRANCH_MANAGER" | "CASHIER"
  displayName: string;
  permissions: string[];// ["pos:checkout", "inv:view", "inv:adjust", "reports:pnl"]
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```
- **Index:** `{ name: 1 }` unique

### 3. `server/src/models/User.ts`
```typescript
interface IUser {
  _id: Types.ObjectId;
  username: string;       // Unique lowercase
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;   // bcrypt salt factor 12
  pinHash: string;        // bcrypt hashed 4-digit PIN
  roleId: Types.ObjectId; // Ref: roles
  isActive: boolean;
  terminalLocked: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```
- **Indexes:** `{ username: 1 }` unique, `{ phone: 1 }` unique sparse, `{ roleId: 1 }`

### 4. `server/src/models/TokenBlacklist.ts`
```typescript
interface ITokenBlacklist {
  _id: Types.ObjectId;
  tokenHash: string;      // SHA-256 hash of revoked JWT
  userId: Types.ObjectId;
  expiresAt: Date;        // TTL Index triggers cleanup
  createdAt: Date;
}
```
- **TTL Index:** `{ expiresAt: 1 }, { expireAfterSeconds: 0 }`
- **Unique Index:** `{ tokenHash: 1 }`

**Acceptance Criteria:**
- [ ] All 4 models created with full Mongoose schemas
- [ ] Indexes defined directly in schema files
- [ ] Password and PIN fields use bcrypt pre-save hooks

---

## Step 2.2 — Inventory & Catalog Domain Models

**Files to create:**

### 5. `server/src/models/Category.ts`
- Fields: `name`, `code` (unique uppercase slug), `parentId` (self-ref for subcategories), `defaultTaxRate`, `description`, `isActive`
- **Indexes:** `{ code: 1 }` unique, `{ parentId: 1 }`

### 6. `server/src/models/Brand.ts`
- Fields: `name`, `originCountry`, `logoUrl`, `isActive`
- **Index:** `{ name: 1 }`

### 7. `server/src/models/Product.ts` (with embedded `Variants`)
- **Product fields:** `name`, `categoryId`, `brandId`, `supplierId`, `unit` (enum: Pcs/Kg/Gram/Ltr/Ml/Box/Meter/Goj), `imageUrl`, `taxType` (INCLUSIVE/EXCLUSIVE/EXEMPT), `taxRate`, `variants[]`, `description`, `isActive`
- **Variant subdocument fields:** `sku` (unique), `barcode` (unique sparse), `attributeName`, `costPrice` (WAC), `retailSellingPrice`, `wholesaleSellingPrice`, `currentStock`, `alertQty`, `batches[]` (optional FEFO), `rackLocation`, `isAvailable`
- **Batch subdocument fields:** `batchNo`, `costPrice`, `expiryDate`, `quantity`, `receivedAt`
- **Indexes:** `{ "variants.sku": 1 }` unique, `{ "variants.barcode": 1 }` unique sparse, full-text `{ name: "text", "variants.attributeName": "text" }`, `{ categoryId: 1, isActive: 1 }`, `{ "variants.currentStock": 1 }`, `{ "variants.expiryDate": 1 }`

### 8. `server/src/models/StockMovement.ts`
- Fields: `productId`, `variantId`, `type` (IN/OUT/ADJUSTMENT/RETURN/WASTAGE), `quantity` (decimal support), `stockBefore`, `stockAfter`, `unitCost`, `referenceType` (SALE/PO/MANUAL/RETURN/WASTAGE_EXPENSE), `referenceId`, `reason`, `userId`
- **Indexes:** `{ variantId: 1, createdAt: -1 }`, `{ referenceType: 1, referenceId: 1 }`

**Acceptance Criteria:**
- [ ] Product model supports embedded variant array (1-to-few pattern)
- [ ] Decimal quantities supported (2.5 Goj, 1.75 Meter)
- [ ] Full-text search index created for POS product search

---

## Step 2.3 — Procurement Domain Models

### 9. `server/src/models/PurchaseOrder.ts` (with embedded `POItems`)
- **PO fields:** `poNumber` (unique, e.g. "PO-20260907-0001"), `supplierId`, `status` (DRAFT/ORDERED/PARTIAL/RECEIVED/CANCELLED), `items[]`, `subtotal`, `taxAmount`, `shippingCost`, `totalAmount`, `paidAmount`, `dueAmount`, `expectedDeliveryDate`, `actualReceivedDate`, `vendorInvoiceNo`, `createdById`, `receivedById`, `notes`
- **POItem subdoc:** `variantId`, `productName` (snapshot), `sku`, `orderedQty`, `receivedQty`, `unitCost`, `lineTotal`
- **Indexes:** `{ poNumber: 1 }` unique, `{ supplierId: 1, createdAt: -1 }`, `{ status: 1 }`

**Acceptance Criteria:**
- [ ] Supports partial receiving (receivedQty tracking per line item)
- [ ] PO status transitions enforced

---

## Step 2.4 — Sales, Checkout & Returns Domain Models

### 10. `server/src/models/Sale.ts` (with embedded `SaleItems` & `Payments`)
- **Sale fields:** `invoiceNo` (unique, e.g. "INV-20260907-00001"), `shiftId`, `cashierId`, `customerId`, `pricingTier` (RETAIL/WHOLESALE), `items[]`, `subtotal`, `totalTax`, `discountAmount`, `totalAmount`, `paidAmount`, `changeReturned`, `dueAmount`, `payments[]`, `isOfflineSynced`, `idempotencyKey` (unique)
- **SaleItem subdoc:** `variantId`, `productName`, `variantName`, `sku`, `barcode`, `quantity`, `unitCostPrice`, `unitSellingPrice`, `taxRate`, `taxAmount`, `discount`, `lineTotal`
- **Payment subdoc:** `method` (CASH/CARD/MFS_BKASH/MFS_NAGAD/STORE_CREDIT/CUSTOMER_DUE), `amount`, `accountId`, `transactionRef`
- **Indexes:** `{ invoiceNo: 1 }` unique, `{ idempotencyKey: 1 }` unique, `{ shiftId: 1, createdAt: -1 }`, `{ customerId: 1, createdAt: -1 }`, `{ createdAt: -1 }`

### 11. `server/src/models/StoreCreditVoucher.ts`
- Fields: `voucherCode` (unique, e.g. "CR-89F2-47A1"), `customerId`, `saleReturnId`, `initialBalance`, `currentBalance`, `status` (ACTIVE/EXHAUSTED/EXPIRED), `expiresAt`, `issuedById`
- **Indexes:** `{ voucherCode: 1 }` unique, `{ customerId: 1, status: 1 }`

### 12. `server/src/models/SalesReturn.ts` (with embedded `ReturnItems`)
- **SalesReturn fields:** `returnNo` (unique), `saleId`, `originalInvoiceNo`, `customerId`, `items[]`, `totalRefundAmount`, `refundType` (CASH/STORE_CREDIT/CARD_REVERSAL), `voucherId`, `authorizedById`, `reason`
- **ReturnItem subdoc:** `variantId`, `quantity`, `unitRefundPrice`, `isResaleable`, `restocked`
- **Indexes:** `{ returnNo: 1 }` unique, `{ saleId: 1, createdAt: -1 }`

**Acceptance Criteria:**
- [ ] Sale items use historical snapshot pattern (prices frozen at sale time)
- [ ] Idempotency key prevents duplicate billing
- [ ] Store credit voucher balance management ready

---

## Step 2.5 — Shift & Cash Register Model

### 13. `server/src/models/Shift.ts`
- Fields: `userId`, `terminalId`, `openedAt`, `closedAt`, `openingFloat`, `cashSalesTotal`, `cashExpensesTotal`, `pettyCashIn`, `pettyCashOut`, `expectedCash`, `actualCash`, `discrepancy`, `managerApprovalId`, `status` (OPEN/CLOSED), `notes`
- **Index:** `{ userId: 1, status: 1, openedAt: -1 }`

---

## Step 2.6 — CRM & Dual Ledgers Domain Models

### 14. `server/src/models/Customer.ts`
- Fields: `name`, `phone` (unique), `email`, `address`, `creditLimit`, `currentDueBalance`, `loyaltyPoints`, `isActive`
- **Index:** `{ phone: 1 }` unique

### 15. `server/src/models/CustomerLedger.ts`
- Fields: `customerId`, `transactionType` (SALE_DUE/PAYMENT_COLLECTION/RETURN_CREDIT), `amount`, `balanceBefore`, `balanceAfter`, `referenceType`, `referenceId`, `narration`, `recordedById`
- **Index:** `{ customerId: 1, createdAt: -1 }`

### 16. `server/src/models/Supplier.ts`
- Fields: `companyName`, `contactPerson`, `phone`, `email`, `address`, `currentPayableBalance`, `isActive`
- **Index:** `{ companyName: 1 }`

### 17. `server/src/models/SupplierLedger.ts`
- Fields: `supplierId`, `transactionType` (PO_GRN_BILL/PAYMENT_DISBURSAL/PURCHASE_RETURN), `amount`, `balanceBefore`, `balanceAfter`, `referenceType`, `referenceId`, `narration`, `recordedById`
- **Index:** `{ supplierId: 1, createdAt: -1 }`

---

## Step 2.7 — Financial Accounts & Expenses Domain Models

### 18. `server/src/models/Account.ts`
- Fields: `name`, `accountType` (CASH/BANK/MFS), `accountNumber`, `currentBalance`, `isActive`
- **Index:** `{ accountType: 1 }`

### 19. `server/src/models/AccountTransaction.ts`
- Fields: `accountId`, `type` (CREDIT/DEBIT), `amount`, `balanceBefore`, `balanceAfter`, `referenceType` (SALE/EXPENSE/TRANSFER/DUE_COLLECTION/SUPPLIER_PAYMENT/WASTAGE_LOSS), `referenceId`, `description`
- **Indexes:** `{ accountId: 1, createdAt: -1 }`, `{ referenceType: 1, referenceId: 1 }`

### 20. `server/src/models/ExpenseCategory.ts`
- Fields: `name`, `code` (unique)
- **Index:** `{ code: 1 }` unique

### 21. `server/src/models/Expense.ts`
- Fields: `categoryId`, `amount`, `accountId`, `receiptVoucherUrl`, `description`, `createdById`
- **Indexes:** `{ categoryId: 1, createdAt: -1 }`, `{ accountId: 1, createdAt: -1 }`

---

## Step 2.8 — Analytics, Audit & System Domain Models

### 22. `server/src/models/DailySalesSummary.ts`
- Fields: `date` (unique "YYYY-MM-DD"), `totalSalesRevenue`, `totalCOGS`, `totalTaxCollected`, `totalDiscounts`, `totalExpenses`, `totalWastageLoss`, `netProfit`, `totalInvoices`, `totalItemsSold`
- **Index:** `{ date: 1 }` unique

### 23. `server/src/models/AuditLog.ts`
- Fields: `userId`, `action` (CREATE/UPDATE/DELETE/PRICE_OVERRIDE/OFFLINE_OVERSELL/SHIFT_DISCREPANCY), `entity`, `entityId`, `metadata` (JSON diff), `ipAddress`
- **Immutable:** No update/delete operations allowed
- **Indexes:** `{ entity: 1, entityId: 1, createdAt: -1 }`, `{ userId: 1, createdAt: -1 }`

### 24. `server/src/models/HoldCart.ts` (with embedded `HoldCartItems`)
- **HoldCart fields:** `cartLabel`, `userId`, `shiftId`, `customerId`, `pricingTier`, `items[]`, `subtotal`, `discountAmount`, `totalAmount`, `notes`, `expiresAt`
- **HoldCartItem subdoc:** `variantId`, `productName`, `variantName`, `sku`, `barcode`, `quantity`, `unitSellingPrice`, `taxRate`, `taxAmount`, `discount`, `lineTotal`
- **TTL Index:** `{ expiresAt: 1 }, { expireAfterSeconds: 0 }`
- **Index:** `{ userId: 1, shiftId: 1, createdAt: -1 }`

### 25. `server/src/models/Settings.ts`
- **Singleton document** (only one active settings doc)
- Fields: `isDefault` (unique true), `shopName`, `shopAddress`, `shopPhone`, `shopEmail`, `currencySymbol`, `defaultTaxRate`, `allowNegativeStock`, `thermalPrinterType` (58mm/80mm), `barcodeLabelFormat`, `cashDrawerTriggerCode`, `receiptHeader`, `receiptFooter`, `logoUrl`
- **Index:** `{ isDefault: 1 }` unique

**Acceptance Criteria (Phase 2 Complete):**
- [ ] All 25 Mongoose models created with correct TypeScript interfaces
- [ ] All indexes defined (compound, unique, sparse, TTL, text)
- [ ] Models compile without TypeScript errors
- [ ] Can seed test data into MongoDB Atlas

---

# ═══════════════════════════════════════════════════
# PHASE 3: Authentication, RBAC & Security Middleware
# ═══════════════════════════════════════════════════

> **Goal:** Implement full authentication system with JWT sessions, bcrypt password hashing, 4-digit PIN lock/unlock, RBAC permission middleware, rate limiting, and idempotency key middleware.

---

## Step 3.1 — Auth Service & Login/Logout

**Files to create:**
1. `server/src/services/AuthService.ts`
   - `login(username, password)` → Validate credentials → Issue JWT (HTTP-only cookie, 8h expiry)
   - `logout(token)` → Blacklist JWT hash in `token_blacklist`
   - `getMe(userId)` → Return user profile + role permissions
   - `lockTerminal(userId)` → Set `terminalLocked: true`
   - `unlockTerminal(userId, pin)` → Verify bcrypt PIN → Set `terminalLocked: false`

2. `server/src/controllers/AuthController.ts`
   - `POST /api/v1/auth/login`
   - `POST /api/v1/auth/logout`
   - `GET /api/v1/auth/me`
   - `POST /api/v1/auth/lock-terminal`
   - `POST /api/v1/auth/unlock-terminal`

3. `server/src/routes/auth.routes.ts`
   - Wire all auth endpoints

**Business Rules:**
- Rate limit: 5 failed login attempts per minute per IP
- JWT stored in HTTP-only cookie (not localStorage)
- Password hashed with bcrypt salt factor 12
- PIN hashed with bcrypt

**Acceptance Criteria:**
- [ ] Login returns JWT token in HTTP-only cookie
- [ ] Failed login after 5 attempts returns `429 RATE_LIMIT_EXCEEDED`
- [ ] Logout blacklists token; subsequent requests with that token return `401`
- [ ] Lock/Unlock terminal works with 4-digit PIN

---

## Step 3.2 — JWT Verification & Token Blacklist Middleware

**File:** `server/src/middlewares/auth.middleware.ts`
- Extract JWT from cookie or Authorization header
- Verify JWT signature and expiry
- Check token hash against `token_blacklist` collection
- Attach `req.user = { userId, username, role, permissions }` to request

**File:** `server/src/middlewares/rate-limiter.middleware.ts`
- Rate limit login endpoint: 5 requests/min/IP
- Return `429` with `RATE_LIMIT_EXCEEDED` error code

**Acceptance Criteria:**
- [ ] All protected routes reject requests without valid JWT
- [ ] Blacklisted tokens are rejected
- [ ] `req.user` contains role and permissions array

---

## Step 3.3 — RBAC Permission Middleware

**File:** `server/src/middlewares/rbac.middleware.ts`
- Accept required permission string(s) (e.g. `"pos:checkout"`, `"inv:manage"`)
- Compare against `req.user.permissions[]`
- Return `403 PERMISSION_DENIED` if user lacks required permission

**Permission strings used throughout the system:**
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

**Acceptance Criteria:**
- [ ] Admin has all permissions
- [ ] Manager has operational permissions (no user/audit management)
- [ ] Cashier has only POS, shift, and limited customer permissions
- [ ] Unauthorized attempts return `403` with correct error code

---

## Step 3.4 — Idempotency Key Middleware

**File:** `server/src/middlewares/idempotency.middleware.ts`
- Extract `Idempotency-Key` header from POS checkout requests
- Check if key already exists in `sales.idempotencyKey`
- If duplicate: return `409 IDEMPOTENCY_KEY_REPLAY`
- If new: allow request to proceed

**Acceptance Criteria:**
- [ ] Duplicate checkout requests with same idempotency key are rejected
- [ ] Different idempotency keys allow separate transactions

---

## Step 3.5 — Zod Validation Middleware

**File:** `server/src/middlewares/validation.middleware.ts`
- Generic middleware factory that accepts a Zod schema
- Validates `req.body`, `req.query`, or `req.params`
- Returns `400 INVALID_PAYLOAD` with `details[]` array on failure

**File:** `server/src/validators/` (one file per domain)
- `auth.validators.ts` — Login, PIN unlock schemas
- `product.validators.ts` — Create/Update product schemas
- `sale.validators.ts` — Checkout payload schema
- `shift.validators.ts` — Open/Close shift schemas
- etc.

**Acceptance Criteria:**
- [ ] All API endpoints validate input before reaching controllers
- [ ] Validation errors return structured `details[]` with field names and issues

---

## Step 3.6 — Seed Default Roles & Admin User

**File:** `server/src/seeds/seed-roles.ts`
- Seed 3 default roles: `SUPER_ADMIN`, `BRANCH_MANAGER`, `CASHIER`
- Each with correct permissions array
- Mark as `isSystemRole: true`

**File:** `server/src/seeds/seed-admin.ts`
- Create default Admin user: `username: "admin"`, `password: "Admin@123"`, `pin: "0000"`

**File:** `server/src/seeds/seed-settings.ts`
- Create default Settings singleton with shop defaults

**Acceptance Criteria:**
- [ ] Running seed scripts populates roles, admin user, and settings
- [ ] Admin can login with default credentials
- [ ] Default settings document exists in `settings` collection

---

## Step 3.7 — Frontend: Login Page

**Files to create:**
1. `client/src/app/login/page.tsx` — Login form UI
   - Username/Email input
   - Password input with show/hide toggle
   - "Remember Me" checkbox
   - Auth spinner during submission
   - Error alert for invalid credentials / rate limit
2. `client/src/lib/auth-context.tsx` — React context for auth state
3. `client/src/hooks/useAuth.ts` — Custom hook for login/logout/getMe
4. `client/src/components/ProtectedRoute.tsx` — Route guard component

**Acceptance Criteria:**
- [ ] Beautiful, modern login page with dark mode
- [ ] Successful login redirects to Dashboard (Admin/Manager) or POS (Cashier)
- [ ] Invalid credentials show error message
- [ ] Auth state persists across page refreshes

---

# ═══════════════════════════════════════════════════
# PHASE 4: User & Role Management + App Shell Layout
# ═══════════════════════════════════════════════════

> **Goal:** Build the admin user management CRUD, role management, and the main application shell layout with sidebar navigation.

---

## Step 4.1 — User Management (Backend)

**Files to create:**
1. `server/src/services/UserService.ts`
   - `listUsers(filters, pagination)`
   - `createUser(data)` — Hash password & PIN
   - `getUserById(id)`
   - `updateUser(id, data)` — Update profile, role, or reset password
   - `deactivateUser(id)` — Soft-delete (set `isActive: false`)
   - `updatePin(id, newPin)` — Hash new PIN

2. `server/src/controllers/UserController.ts`
3. `server/src/routes/user.routes.ts`

**API Endpoints:**
- `GET /api/v1/users` — List all staff accounts (Admin only)
- `POST /api/v1/users` — Create user with role assignment
- `GET /api/v1/users/:id` — Get single user details
- `PUT /api/v1/users/:id` — Update user profile/role/password
- `DELETE /api/v1/users/:id` — Deactivate user
- `PATCH /api/v1/users/:id/pin` — Update cashier PIN

**Acceptance Criteria:**
- [ ] Only Admin role can access user management endpoints
- [ ] Passwords and PINs are always stored hashed
- [ ] Deleted users are soft-deleted (isActive: false), not removed

---

## Step 4.2 — Role Management (Backend)

**Files to create:**
1. `server/src/services/RoleService.ts`
2. `server/src/controllers/RoleController.ts`
3. `server/src/routes/role.routes.ts`

**API Endpoints:**
- `GET /api/v1/roles` — List all roles (Admin, Manager)
- `POST /api/v1/roles` — Create custom role (Admin only)
- `PUT /api/v1/roles/:id` — Update permissions (Admin only)

**Acceptance Criteria:**
- [ ] System roles (`isSystemRole: true`) cannot be deleted
- [ ] Permission strings are validated against known permission list

---

## Step 4.3 — Application Shell Layout (Frontend)

**Files to create:**
1. `client/src/app/(dashboard)/layout.tsx` — Dashboard layout with:
   - **Collapsible Sidebar** — Navigation links based on user role permissions
   - **Top Header Bar** — Shop name, user avatar, active shift status, notification bell, logout button
   - **Main Content Area** — Renders child pages
2. `client/src/components/Sidebar.tsx` — Role-aware navigation
3. `client/src/components/Header.tsx` — User info, shift status, notifications

**Sidebar Navigation Items (role-filtered):**
| Menu Item | Icon | Route | Required Permission |
|:---|:---|:---|:---|
| Dashboard | LayoutDashboard | `/dashboard` | `reports:dashboard` |
| POS Terminal | ShoppingCart | `/pos` | `pos:checkout` |
| Products | Package | `/products` | `inv:view` |
| Categories | Tags | `/categories` | `inv:view` |
| Inventory | Warehouse | `/inventory` | `inv:view` |
| Purchase Orders | Truck | `/purchase-orders` | `procurement:view` |
| Sales History | Receipt | `/sales` | `sales:view` |
| Customers | Users | `/customers` | `customers:view` |
| Suppliers | Building2 | `/suppliers` | `procurement:view` |
| Shifts | Clock | `/shifts` | `shifts:operate` |
| Expenses | CreditCard | `/expenses` | `expenses:view` |
| Accounts | Landmark | `/accounts` | `accounts:view` |
| Reports | BarChart3 | `/reports` | `reports:dashboard` |
| Users | UserCog | `/users` | `users:manage` |
| Audit Logs | Shield | `/audit-logs` | `audit:view` |
| Settings | Settings | `/settings` | `settings:manage` |

**Acceptance Criteria:**
- [ ] Sidebar shows only menu items the user has permission to access
- [ ] Sidebar is collapsible (icon-only mode)
- [ ] Active route is highlighted in sidebar
- [ ] Responsive on tablet/mobile (drawer mode)

---

## Step 4.4 — User & Role Management Pages (Frontend)

**Files to create:**
1. `client/src/app/(dashboard)/users/page.tsx` — User list with data table, search, role filter
2. `client/src/app/(dashboard)/users/[id]/page.tsx` — Edit user form
3. `client/src/components/modals/CreateUserModal.tsx` — Create user modal
4. `client/src/app/(dashboard)/roles/page.tsx` — Role list with permissions matrix

**Acceptance Criteria:**
- [ ] User list shows all staff with role badges, status indicators
- [ ] Create user modal validates all fields
- [ ] Can assign role and set initial PIN
- [ ] Can deactivate/reactivate user accounts

---

# ═══════════════════════════════════════════════════
# PHASE 5: Settings, Categories, Brands & Product Catalog
# ═══════════════════════════════════════════════════

> **Goal:** Build the complete product catalog system with multi-tier pricing, tax configuration, variant management, and barcode label generation.

---

## Step 5.1 — Settings Management (Backend + Frontend)

**Backend:**
- `server/src/services/SettingsService.ts`
- `server/src/controllers/SettingsController.ts`
- `GET /api/v1/settings` — Get shop settings
- `PUT /api/v1/settings` — Update shop settings (Admin only)

**Frontend:**
- `client/src/app/(dashboard)/settings/page.tsx`
- Form with all settings fields: shop name, address, phone, currency symbol, default tax rate, negative stock toggle, printer type, barcode format, receipt header/footer

**Acceptance Criteria:**
- [ ] Settings are singleton (only one document)
- [ ] All hardware configuration options functional

---

## Step 5.2 — Categories & Brands CRUD (Backend + Frontend)

**Backend:**
- `server/src/services/CategoryService.ts` + `BrandService.ts`
- `server/src/controllers/CategoryController.ts` + `BrandController.ts`
- Category endpoints: `GET`, `POST`, `PUT`, `DELETE` on `/api/v1/categories`
- Brand endpoints: `GET`, `POST`, `PUT`, `DELETE` on `/api/v1/brands`

**Business Rules:**
- Categories support parent/child hierarchy (nested subcategories)
- Deleting a category with active products is blocked (`409 CATEGORY_HAS_DEPENDENTS`)
- Categories can set a `defaultTaxRate` inherited by products

**Frontend:**
- `client/src/app/(dashboard)/categories/page.tsx` — Category tree view + CRUD modals
- `client/src/app/(dashboard)/brands/page.tsx` — Brand list + CRUD modals

**Acceptance Criteria:**
- [ ] Category hierarchy displays as tree
- [ ] Cannot delete category with linked products
- [ ] Brand CRUD fully functional

---

## Step 5.3 — Product Catalog CRUD (Backend)

**Files to create:**
1. `server/src/services/ProductService.ts`
   - `listProducts(filters, pagination, userRole)` — Omit `costPrice` for Cashier role
   - `getProductById(id, userRole)`
   - `getProductByBarcode(barcode)` — Fast lookup < 100ms
   - `createProduct(data)` — With embedded variants
   - `updateProduct(id, data)`
   - `deleteProduct(id)` — Soft-delete

2. `server/src/controllers/ProductController.ts`
3. `server/src/routes/product.routes.ts`

**API Endpoints:**
- `GET /api/v1/products` — List with search, category filter, low stock filter, pagination
- `GET /api/v1/products/:id` — Single product
- `GET /api/v1/products/barcode/:barcode` — Fast barcode lookup (< 100ms SLA)
- `POST /api/v1/products` — Create product with variants
- `PUT /api/v1/products/:id` — Update product
- `DELETE /api/v1/products/:id` — Soft-delete

**Key Business Rules:**
- Cashier API responses must **never** include `costPrice`, `batches`, or profit data
- Full-text search on product name and variant attribute names
- Multi-tier pricing: each variant has `retailSellingPrice` and `wholesaleSellingPrice`
- Tax types: INCLUSIVE (tax included in price), EXCLUSIVE (tax added on top), EXEMPT (no tax)

**Acceptance Criteria:**
- [ ] Product CRUD fully working with variant management
- [ ] Barcode lookup returns in < 100ms
- [ ] Cost price hidden from Cashier role API responses
- [ ] Text search works for product names

---

## Step 5.4 — Product Catalog Pages (Frontend)

**Files to create:**
1. `client/src/app/(dashboard)/products/page.tsx`
   - Data table with: Product name, SKU, Category, Stock, Retail Price, Wholesale Price
   - Filters: Category dropdown, Low stock toggle, Search box
   - Action buttons: Edit, View, Delete, Print Barcode Label
2. `client/src/components/modals/ProductFormModal.tsx`
   - Create/Edit product form
   - Dynamic variant generator (add/remove variants)
   - Fields: name, category, brand, supplier, unit, tax type, tax rate
   - Per variant: SKU, barcode, attribute name, cost price, retail price, wholesale price, stock, alert qty
3. `client/src/components/modals/BarcodeLabelModal.tsx`
   - Select variant, label quantity, sticker format
   - Print barcode sticker labels

**Acceptance Criteria:**
- [ ] Product list shows paginated data with all filters working
- [ ] Can add product with multiple variants
- [ ] Variant generator allows adding Size/Color/Weight combinations
- [ ] Cost price column hidden for Cashier role users
- [ ] Barcode label print modal works

---

## Step 5.5 — Barcode Label Generator (Backend + Frontend)

**Backend:**
- `POST /api/v1/products/labels/print` — Generate barcode sticker payload
- Input: `variantId`, `labelQuantity`, `format` (`38x25mm`, `50x30mm`, `A4_24_sheet`), `includePrice`, `includeShopName`, `includeSKU`

**Frontend:**
- `client/src/app/(dashboard)/barcode-labels/page.tsx`
  - Product variant selector with live text filter
  - Label quantity input field
  - Sticker format dropdown: `38x25mm Single Label`, `50x30mm Thermal`, `A4 Grid (24 Labels/sheet)`
  - Render barcodes using `JsBarcode` (SVG / Canvas)
  - Interactive print preview panel (Shop Name, Product Name, SKU, Barcode image, MRP price tag)
  - Direct print action with `@media print` CSS page breaking

**Acceptance Criteria:**
- [ ] Generates crisp barcode sticker preview using `JsBarcode`
- [ ] Supports 38x25mm, 50x30mm thermal rolls and A4 24-label grid layouts
- [ ] Toggle options for Shop Name, SKU, and MRP Price display correctly
- [ ] Prints directly without layout distortion

---

# ═══════════════════════════════════════════════════
# PHASE 6: Suppliers & Purchase Order Procurement
# ═══════════════════════════════════════════════════

> **Goal:** Build the complete procurement workflow — supplier management, purchase order creation, goods received notes (GRN) with partial receiving, and supplier payable ledger.

---

## Step 6.1 — Supplier CRUD (Backend + Frontend)

**Backend:**
- `server/src/services/SupplierService.ts`
- CRUD endpoints: `GET`, `POST`, `PUT` on `/api/v1/suppliers`
- `GET /api/v1/suppliers/:id/ledger` — Supplier payable ledger history
- `POST /api/v1/suppliers/:id/payments` — Disburse supplier payment

**Frontend:**
- `client/src/app/(dashboard)/suppliers/page.tsx` — Supplier directory with payable balances
- `client/src/components/modals/SupplierFormModal.tsx` — Create/Edit supplier
- `client/src/components/modals/SupplierPaymentModal.tsx` — Record payment to supplier
- Supplier ledger view showing debit/credit transaction history

**Acceptance Criteria:**
- [ ] Supplier CRUD fully working
- [ ] Can view supplier payable ledger history
- [ ] Can record supplier payment (debits bank/cash account, credits supplier balance)

---

## Step 6.2 — Purchase Order Workflow (Backend)

**Files to create:**
1. `server/src/services/PurchaseOrderService.ts`
   - `createPO(data)` — Generate sequential PO number, create in DRAFT status
   - `updatePO(id, data)` — Only if DRAFT status
   - `receivePO(id, grnData)` — Process GRN (within Mongoose transaction session):
     1. Calculate new Weighted Average Cost (WAC) **before** updating current stock
     2. Update product variant `costPrice` with new WAC and increment `variants.currentStock`
     3. Log `stock_movements` (type: IN, referenceType: PO)
     4. Update PO status (PARTIAL or RECEIVED based on line item receiving totals)
     5. Create `supplier_ledgers` payable entry
     6. If payment disbursed on GRN: create `account_transactions` (DEBIT cash/bank)

2. `server/src/controllers/PurchaseOrderController.ts`
3. `server/src/routes/purchase-order.routes.ts`

**API Endpoints:**
- `GET /api/v1/purchase-orders` — List with status filter
- `POST /api/v1/purchase-orders` — Create PO
- `GET /api/v1/purchase-orders/:id` — PO details
- `PUT /api/v1/purchase-orders/:id` — Update (DRAFT only)
- `POST /api/v1/purchase-orders/:id/receive` — GRN receiving

**Business Rules & WAC Calculation Protocol:**
- Partial receiving: `receivedQty` tracked per line item
- Status auto-transitions: DRAFT → ORDERED → PARTIAL → RECEIVED
- **WAC Formula:** `newWAC = ((existingStock × currentWAC) + (receivedQty × newUnitCost)) / (existingStock + receivedQty)`
- WAC cost recalculation MUST occur *prior* to incrementing `variants.currentStock` to prevent inventory valuation corruption
- Supplier payable ledger entry created automatically upon GRN confirmation

**Acceptance Criteria:**
- [ ] PO number auto-generated (e.g. "PO-20260907-0001")
- [ ] Partial receiving works (accepts subset of ordered items)
- [ ] Stock increases on receiving
- [ ] WAC recalculated accurately using the exact formula before stock increment
- [ ] Supplier ledger updated

---

## Step 6.3 — Purchase Order Pages (Frontend)

**Files to create:**
1. `client/src/app/(dashboard)/purchase-orders/page.tsx` — PO list with status tabs (Draft/Ordered/Partial/Received/Cancelled)
2. `client/src/app/(dashboard)/purchase-orders/new/page.tsx` — Create PO form (supplier select, add line items)
3. `client/src/app/(dashboard)/purchase-orders/[id]/page.tsx` — PO detail view
4. `client/src/components/modals/GRNModal.tsx` — Goods Received Note modal (enter received quantities, batch/expiry info)

**Acceptance Criteria:**
- [ ] Can create PO and add line items with variant selector
- [ ] Can receive goods (full or partial) via GRN modal
- [ ] Status badges show current PO state
- [ ] PO detail page shows all line items with received vs ordered quantities

---

# ═══════════════════════════════════════════════════
# PHASE 7: Shift & Cash Register Management
# ═══════════════════════════════════════════════════

> **Goal:** Build the shift management system — opening cash float, mid-day petty cash, and end-of-day Z-Report reconciliation.

---

## Step 7.1 — Shift Management (Backend)

**Files to create:**
1. `server/src/services/ShiftService.ts`
   - `openShift(userId, terminalId, openingFloat)` — Check no active shift exists
   - `getCurrentShift(userId)` — Get active OPEN shift
   - `addPettyCash(shiftId, type, amount, reason)` — Mid-day cash in/out
   - `closeShift(shiftId, actualCash, managerPin?, notes?)` — Calculate expected cash, discrepancy, require manager approval if |discrepancy| > $10
   - `getZReport(shiftId)` — Generate Z-Report summary

2. `server/src/controllers/ShiftController.ts`
3. `server/src/routes/shift.routes.ts`

**API Endpoints:**
- `POST /api/v1/shifts/open` — Open shift with opening float
- `GET /api/v1/shifts/current` — Get active shift
- `POST /api/v1/shifts/petty-cash` — Log petty cash in/out
- `POST /api/v1/shifts/close` — Close shift with blind count
- `GET /api/v1/shifts` — List shift history
- `GET /api/v1/shifts/:id/z-report` — Z-Report

**Business Rules:**
- Expected Cash = Opening Float + Cash Sales - Cash Expenses + Petty Cash In - Petty Cash Out
- Discrepancy = Actual Cash Counted - Expected Cash
- If |discrepancy| > $10: Manager PIN required for approval
- One active shift per cashier at a time

**Acceptance Criteria:**
- [ ] Cannot open shift if one is already open
- [ ] Petty cash operations update shift totals
- [ ] Shift closing calculates correct expected/actual/discrepancy
- [ ] Manager approval required for large discrepancies

---

## Step 7.2 — Shift Management Pages (Frontend)

**Files to create:**
1. `client/src/components/modals/OpenShiftModal.tsx` — Terminal ID, opening float input
2. `client/src/components/modals/CloseShiftModal.tsx` — Actual cash input, discrepancy display, manager PIN field
3. `client/src/components/modals/PettyCashModal.tsx` — Cash in/out with reason
4. `client/src/app/(dashboard)/shifts/page.tsx` — Shift history list
5. `client/src/app/(dashboard)/shifts/[id]/z-report/page.tsx` — Z-Report view (printable)

**Acceptance Criteria:**
- [ ] Open Shift modal prompts for opening float before POS usage
- [ ] Close Shift modal shows expected vs actual with discrepancy highlighted
- [ ] Z-Report is printable (A4 and thermal receipt format)

---

# ═══════════════════════════════════════════════════
# PHASE 8: POS Terminal (The Core Checkout System)
# ═══════════════════════════════════════════════════

> **Goal:** Build the full POS checkout terminal — barcode scanning, product search, cart management, multi-pricing, tax calculation, split payments, hold/resume cart, terminal PIN lock, thermal receipt printing, and cash drawer trigger.

---

## Step 8.1 — POS Checkout Service (Backend)

**Files to create:**
1. `server/src/services/PosService.ts`
   - `searchProducts(query, pricingTier)` — Fast text/barcode search (< 100ms)
   - `executeAtomicCheckout(salePayload, userId, isOfflineSynced)` — **THE CORE TRANSACTION:**
     1. Generate sequential invoice number via `counters` collection
     2. Validate & decrement variant inventory atomically
     3. Create Sale document with all line items and payment records
     4. Update shift cash sales inflow (net cash = tendered - change)
     5. Update customer due balance if credit sale
     6. Deduct store credit voucher balance if used
     7. Credit financial accounts for each payment method
     8. All operations within MongoDB ACID transaction session
   - `holdCart(cartData, userId, shiftId)` — Park cart with 24h TTL
   - `getHeldCarts(userId, shiftId)` — List held carts
   - `resumeCart(cartId)` — Restore held cart to POS
   - `deleteHeldCart(cartId)` — Discard held cart
   - `verifyVoucher(code)` — Check store credit voucher balance
   - `syncOfflineQueue(sales[], userId)` — Process offline buffered sales

2. `server/src/services/SequenceService.ts`
   - `generateSequentialInvoiceNo(session)` — Atomic counter using `findOneAndUpdate` with `$inc`
   - Format: `INV-YYYYMMDD-XXXXX` (e.g. "INV-20260907-00001")

3. `server/src/controllers/PosController.ts`
4. `server/src/routes/pos.routes.ts`

**API Endpoints:**
- `GET /api/v1/products/barcode/:barcode` — Fast barcode scan lookup
- `POST /api/v1/sales/checkout` — Atomic checkout (requires `Idempotency-Key` header)
- `POST /api/v1/hold-carts` — Park cart
- `GET /api/v1/hold-carts` — List held carts
- `GET /api/v1/hold-carts/:id` — Get held cart
- `DELETE /api/v1/hold-carts/:id` — Delete held cart
- `GET /api/v1/vouchers/:code` — Verify voucher balance
- `POST /api/v1/sales/offline-sync` — Batch offline sync

**Tax Calculation Logic:**
- **TAX_INCLUSIVE:** `taxAmount = sellingPrice - (sellingPrice / (1 + taxRate%))`
- **TAX_EXCLUSIVE:** `taxAmount = sellingPrice × taxRate%`
- **TAX_EXEMPT:** `taxAmount = 0`

**Multi-Pricing Logic:**
- If customer is `WHOLESALE` type → use `wholesaleSellingPrice`
- Default → use `retailSellingPrice` (MRP)

**Acceptance Criteria:**
- [ ] Atomic checkout commits or rolls back entirely (no partial states)
- [ ] Invoice numbers are sequential and never duplicate
- [ ] Stock decrements atomically
- [ ] Split payments work (Cash + bKash + Card + Store Credit + Customer Due)
- [ ] Tax calculated correctly for all types
- [ ] Offline sync handles oversell per PRD Section 6.5

---

## Step 8.2 — POS Terminal UI (Frontend — The Main Event!)

**Files to create:**

### Core POS Layout
1. `client/src/app/(pos)/pos/page.tsx` — Full-screen POS terminal layout:
   - **Left Panel (70%):** Product grid with category tabs OR barcode search results
   - **Right Panel (30%):** Cart items, totals, payment actions

### POS Components
2. `client/src/components/pos/BarcodeSearchInput.tsx`
   - Auto-focus barcode input field
   - Supports USB barcode scanner input (auto-submit on Enter)
   - Also supports manual text search with debounced API call

3. `client/src/components/pos/ProductGrid.tsx`
   - Product cards with image, name, price, stock indicator
   - Category filter tabs
   - Click to add to cart

4. `client/src/components/pos/CartPanel.tsx`
   - Cart items list with quantity +/- controls
   - Line totals, subtotal, tax, discount, grand total
   - Price tier indicator (Retail / Wholesale)

5. `client/src/components/pos/CustomerSelector.tsx`
   - Quick search customer by phone/name
   - Create new customer inline
   - Shows credit limit and current due balance

6. `client/src/components/pos/PaymentModal.tsx`
   - Split payment interface:
     - Cash amount input (auto-calculate change)
     - bKash/Nagad payment with TxID input
     - Card payment with auth code
     - Store Credit Voucher code input + verify balance
     - Customer Due (credit sale) with limit check
   - Grand total, paid total, remaining display

7. `client/src/components/pos/HoldCartBar.tsx`
   - Hold current cart button (F4)
   - Resume held cart list (Shift+F4)
   - Held cart count badge

8. `client/src/components/pos/TerminalLockScreen.tsx`
   - Full-screen PIN entry overlay (Ctrl+L)
   - 4-digit PIN pad (keyboard and on-screen)
   - Shop name and clock display

9. `client/src/components/pos/ReceiptPreview.tsx`
   - Thermal receipt preview modal
   - Shows: shop name, invoice#, date, items, totals, payment breakdown, footer
   - Print button (58mm / 80mm format)

### POS Keyboard Hotkeys
10. `client/src/hooks/usePOSHotkeys.ts`
    - `F2` → Focus barcode/product search
    - `F4` → Hold/Park current cart
    - `Shift+F4` → Resume parked cart list
    - `F8` → Focus customer selector
    - `F9` → Open payment modal
    - `Ctrl+L` → Quick lock terminal
    - `Enter` → Confirm payment & print
    - `ESC` → Close modal / clear cart focus

**Acceptance Criteria:**
- [ ] Barcode scanner adds item to cart instantly (< 100ms)
- [ ] Cart updates in real-time with correct tax and totals
- [ ] Split payment works with multiple payment methods
- [ ] Hold/Resume cart preserves all cart data
- [ ] Terminal lock screen blocks all actions until PIN verified
- [ ] Receipt preview shows correct data
- [ ] All keyboard hotkeys work
- [ ] POS works smoothly on touchscreen devices

---

## Step 8.3 — Discount Handling & Manager Override

**Business Rules:**
- Manual line-item or bill-level discount allowed up to 10% for Cashier
- Discount 11-50%: Requires Manager PIN override
- Discount > 50%: Requires Admin password
- All discount overrides logged in `audit_logs`

**Files to create:**
1. `client/src/components/pos/DiscountField.tsx` — Discount input with % or fixed amount toggle
2. `client/src/components/modals/ManagerOverrideModal.tsx` — PIN/Password entry for discount approval

**Acceptance Criteria:**
- [ ] Cashier can apply discounts up to 10% without approval
- [ ] Discounts > 10% prompt for Manager PIN
- [ ] Discount overrides are logged

---

## Step 8.4 — Offline Cart Buffering & Oversell Sync Protocol (IndexedDB)

**Files to create:**
1. `client/src/lib/offline-queue.ts`
   - IndexedDB store for buffering cart data when offline
   - Queue sales with timestamp and idempotency key
   - Auto-detect network online/offline status
   - Auto-sync queued sales in background when connection is restored
   - **Oversell Conflict Resolution Protocol:**
     - If `allowNegativeStock = true`: Sync transaction, decrement stock to negative, complete sale.
     - If `allowNegativeStock = false` and stock is insufficient during sync: Process sale to preserve customer transaction, set `isOfflineOversell: true`, emit real-time `OFFLINE_OVERSELL_ALERT` via Socket.io to Manager/Admin, and append an immutable entry in `audit_logs` for managerial reconciliation.

**Acceptance Criteria:**
- [ ] Sales are buffered in IndexedDB when offline
- [ ] Queue auto-syncs automatically when connectivity is restored
- [ ] Synced sales appear in sales history with correct timestamp
- [ ] Oversell conflicts trigger `OFFLINE_OVERSELL_ALERT` and audit log entry

---

## Step 8.5 — ESC/POS Thermal Receipt Printer & Hardware Integration

**Files to create:**
1. `client/src/lib/escpos-builder.ts` — Build ESC/POS binary command buffer for thermal receipts
   - Support 58mm (32 chars/line) and 80mm (48 chars/line) paper widths
   - ESC/POS Commands: text alignment, bold, font size scaling, line feed, paper cut, cash drawer pulse
   - Receipt layout: Shop Header, Invoice#, Cashier Name, Date, Itemized Table, Subtotal/Tax/Discount, Payment Breakdown, QR/Barcode, Footer
2. `client/src/lib/printer-connector.ts` — Hardware communication strategy:
   - **Primary:** WebUSB / WebSerial direct raw binary stream to thermal printer (Chromium browsers)
   - **Secondary / Fallback:** Silent HTML thermal print preview with CSS `@media print` rules formatted for 58mm/80mm continuous roll paper
3. `client/src/lib/cash-drawer.ts` — Send ESC/POS cash drawer pulse command (`ESC p 0 25 250`) on cash checkout completion

**Acceptance Criteria:**
- [ ] Receipt prints on thermal printers via WebUSB/WebSerial or browser print fallback (58mm and 80mm)
- [ ] Cash drawer kick pulse opens drawer automatically on cash payment
- [ ] Receipt includes all required invoice metadata formatted cleanly

---

# ═══════════════════════════════════════════════════
# PHASE 9: Customers, Sales History, Returns & Vouchers
# ═══════════════════════════════════════════════════

> **Goal:** Build customer CRM with credit ledger (Bakir Khata), sales history browsing, returns/refunds processing, and store credit voucher system.

---

## Step 9.1 — Customer Management (Backend + Frontend)

**Backend:**
- `server/src/services/CustomerService.ts`
  - CRUD operations
  - `payDue(customerId, amount, paymentAccountId)` — Record due collection, credit account, update ledger
  - `getCustomerLedger(customerId)` — Bakir Khata transaction history

**API Endpoints:**
- `GET /api/v1/customers` — Directory with due balances
- `POST /api/v1/customers` — Create customer (with type: Retail/Wholesale)
- `PUT /api/v1/customers/:id` — Update profile/credit limit
- `GET /api/v1/customers/:id/ledger` — Transaction history
- `POST /api/v1/customers/:id/pay-due` — Record payment collection

**Frontend:**
- `client/src/app/(dashboard)/customers/page.tsx` — Customer directory with due balance highlights
- `client/src/components/modals/CustomerFormModal.tsx` — Create/Edit customer
- `client/src/components/modals/PayDueModal.tsx` — Collect customer payment
- `client/src/app/(dashboard)/customers/[id]/ledger/page.tsx` — Bakir Khata ledger view

**Business Rules:**
- Enforce max credit limit per customer
- Alert when due reaches 90% of credit limit
- Customer type determines pricing tier at POS

**Acceptance Criteria:**
- [ ] Customer CRUD with credit limit management
- [ ] Due payment collection updates balance and creates ledger entry
- [ ] Customer ledger shows full transaction history
- [ ] 90% credit limit warning displayed

---

## Step 9.2 — Sales History (Backend + Frontend)

**Backend:**
- `server/src/services/SaleService.ts`
  - `listSales(filters, pagination)` — Date range, cashier, customer, shift filters
  - `getSaleById(id)` — Full invoice details
  - `generateReceipt(id, format)` — ESC/POS or HTML receipt

**Frontend:**
- `client/src/app/(dashboard)/sales/page.tsx` — Invoice list with date filter, search, status
- `client/src/app/(dashboard)/sales/[id]/page.tsx` — Invoice detail view with:
  - Line items table
  - Payment breakdown
  - Customer info
  - Print receipt button
  - Return/Refund button

**Acceptance Criteria:**
- [ ] Sales list is filterable by date, cashier, customer
- [ ] Invoice detail shows all data
- [ ] Can reprint receipt from sales history

---

## Step 9.3 — Sales Returns & Store Credit Vouchers (Backend + Frontend)

**Backend:**
- `server/src/services/ReturnService.ts`
  - `processReturn(saleId, returnItems, refundType, managerPin, reason)` (in MongoDB session):
    1. Verify Manager PIN authorization
    2. Validate return item quantities do not exceed original sold quantities
    3. Calculate Proportional Net Refund Amount per item:
       `Item Refund Price = Item Selling Price - (Item Selling Price × (Total Bill Discount / Subtotal))`
    4. **Customer Due Priority Refund Protocol:**
       If original sale was credit/partial credit (`CUSTOMER_DUE`) or customer has an active due balance, the calculated refund MUST first reduce `currentDueBalance` in `CustomerLedger`. Any remaining refund beyond outstanding due is then issued via `STORE_CREDIT` voucher or `CASH`.
    5. If `isResaleable: true` → Restock `variants.currentStock` + log `stock_movements` (type: RETURN, ref: RETURN)
    6. If `isResaleable: false` → Mark as damaged → Create expense ("Inventory Shrinkage") + log `stock_movements` (type: WASTAGE)
    7. If `refundType: STORE_CREDIT` → Generate unique voucher code (`CR-XXXX-XXXX`) in `store_credit_vouchers`
    8. If `refundType: CASH` → Create `account_transactions` (DEBIT cash drawer account)
    9. Append immutable entry in `audit_logs`

**API Endpoints:**
- `POST /api/v1/returns` — Process return (requires Manager PIN)

**Frontend:**
- `client/src/components/modals/ReturnModal.tsx`
  - Select line items & quantities to return
  - Toggle per item: Restock (Resaleable) vs Mark Damaged (Wastage)
  - Refund type selector: Cash, Store Credit Voucher, or Due Adjustment
  - Manager PIN authorization modal trigger
  - Mandatory return reason input text

**Business Rules & Refund Calculation:**
- All sales returns strictly require Manager role PIN authorization
- **Proportional Net Refund Formula:** `Item Refund Price = Item Selling Price - (Item Selling Price × (Total Bill Discount / Subtotal))`
- **Customer Due Refund Priority:** Due balances are cleared first before cash or store credit payout
- Voucher code format: `CR-XXXX-XXXX` (12-character unique uppercase code)
- Store credit vouchers expire after 365 days (1 year)

**Acceptance Criteria:**
- [ ] Returns process accurately with proper inventory restock or wastage write-off
- [ ] Proportional net refund calculated correctly for discounted sales
- [ ] Customer due balance credited first on returns before cash/voucher refund
- [ ] Store credit voucher generated with unique 12-char code and redeemable at POS checkout
- [ ] Manager PIN required for all return transactions

---

# ═══════════════════════════════════════════════════
# PHASE 10: Inventory, Expenses & Financial Accounts
# ═══════════════════════════════════════════════════

> **Goal:** Build inventory stock management with wastage write-offs, expense tracking, and double-entry financial account ledger.

---

## Step 10.1 — Inventory & Stock Adjustments (Backend + Frontend)

**Backend:**
- `server/src/services/InventoryService.ts`
  - `getStockAlerts()` — Low stock (currentStock ≤ alertQty) and FEFO expiry (30 days)
  - `adjustStock(productId, variantId, type, quantity, reason, userId)`
    - If type = WASTAGE:
      1. Deduct variant quantity
      2. Log stock_movement (type: WASTAGE)
      3. Create expense entry → "Inventory Shrinkage & Loss" category
      4. Create account_transaction (DEBIT)
  - `getStockMovements(variantId, filters)` — Movement history

**API Endpoints:**
- `POST /api/v1/stock-movements/adjust` — Stock adjustment & wastage write-off
- `GET /api/v1/stock-movements` — Movement history
- `GET /api/v1/products?isLowStock=true` — Low stock items

**Frontend:**
- `client/src/app/(dashboard)/inventory/page.tsx`
  - Stock list by variant: product, SKU, current stock, alert qty, expiry date
  - Low stock alert badges (red)
  - Expiry soon alert badges (orange)
- `client/src/components/modals/StockAdjustmentModal.tsx`
  - Type: Manual Adjustment / Wastage Write-Off
  - Quantity, reason, account selection

**Acceptance Criteria:**
- [ ] Low stock and expiry alerts display correctly
- [ ] Wastage write-off creates expense + account debit automatically
- [ ] Stock movement history trackable per variant

---

## Step 10.2 — Expense Management (Backend + Frontend)

**Backend:**
- `server/src/services/ExpenseService.ts`
  - `createExpense(data)` — Validates account balance, creates expense, debits account
  - `listExpenses(filters)`
  - Expense Category CRUD

**API Endpoints:**
- `POST /api/v1/expenses` — Create expense
- `GET /api/v1/expenses` — List expenses
- `GET /api/v1/expenses/categories` — List categories
- `POST /api/v1/expenses/categories` — Create category

**Frontend:**
- `client/src/app/(dashboard)/expenses/page.tsx` — Expense list with filters
- `client/src/components/modals/ExpenseFormModal.tsx` — Create expense (category, amount, account, receipt upload)

**Business Rules:**
- Expense debits selected cash/bank account
- Warn if account balance insufficient
- Staff can submit expense logs; Admin/Manager approve

**Acceptance Criteria:**
- [ ] Expense creation debits the correct account
- [ ] Account balance warning shown when insufficient
- [ ] Receipt voucher upload supported

---

## Step 10.3 — Financial Accounts & Ledger (Backend + Frontend)

**Backend:**
- `server/src/services/AccountService.ts`
  - CRUD for financial accounts (Cash Drawer, Bank, MFS)
  - `transferFunds(fromAccountId, toAccountId, amount)` — Double-entry transfer (Debit source, Credit target in single transaction)
  - `getAccountLedger(accountId)` — Transaction history

**API Endpoints:**
- `GET /api/v1/accounts` — List accounts with balances
- `POST /api/v1/accounts` — Create account
- `PUT /api/v1/accounts/:id` — Update account
- `POST /api/v1/accounts/transfer` — Inter-account fund transfer
- `GET /api/v1/accounts/:id/transactions` — Ledger history

**Frontend:**
- `client/src/app/(dashboard)/accounts/page.tsx` — Account list with balances
- `client/src/components/modals/AccountFormModal.tsx` — Create/Edit account
- `client/src/components/modals/FundTransferModal.tsx` — Transfer funds between accounts
- `client/src/app/(dashboard)/accounts/[id]/ledger/page.tsx` — Full debit/credit transaction log

**Acceptance Criteria:**
- [ ] Fund transfer creates paired debit+credit entries atomically
- [ ] Account balances always reflect current state
- [ ] Ledger shows complete immutable transaction history

---

# ═══════════════════════════════════════════════════
# PHASE 11: Dashboard, Reports & Analytics Engine
# ═══════════════════════════════════════════════════

> **Goal:** Build the executive dashboard with KPI cards, reporting engine with multiple report types, and export capabilities (PDF, Excel, Thermal Print).

---

## Step 11.1 — Dashboard (Backend + Frontend)

**Backend:**
- `server/src/services/DashboardService.ts`
  - `getDashboardKPIs()` — Today's sales, expenses, net profit, active shift cash, low stock count, pending dues

**API Endpoint:**
- `GET /api/v1/reports/dashboard` — Dashboard KPI payload (< 100ms SLA)

**Frontend:**
- `client/src/app/(dashboard)/dashboard/page.tsx`
  - **KPI Metric Cards:** Today's Sales, Today's Expenses, Net Profit, Active Shift Cash Float, Low Stock Count, Pending Customer Dues
  - **Sales Trend Chart** — Last 7/30 days line chart
  - **Top Selling Products** — Table with quantity and revenue
  - **Low Stock Alerts** — Badge list of items needing reorder
  - **Expiry Alerts** — Items expiring within 30 days

**Acceptance Criteria:**
- [ ] Dashboard loads fast (using materialized summaries)
- [ ] KPI cards show accurate real-time data
- [ ] Charts are interactive and visually appealing

---

## Step 11.2 — Nightly Materialized Summary Job

**File:** `server/src/jobs/nightly-summary.ts`
- Runs daily at 00:05 AM via node-cron
- Aggregates sales, COGS, tax, expenses, wastage for the previous day
- Upserts into `daily_sales_summaries` collection

**File:** `server/src/jobs/expired-cart-cleanup.ts`
- Runs every hour
- Deletes expired hold carts (24h TTL backup)

**File:** `server/src/jobs/fefo-expiry-scan.ts`
- Runs daily at 7:00 AM
- Scans products expiring within 30 days
- Emits Socket.io alert to Admin/Manager

**File:** `server/src/jobs/scheduler.ts`
- Initializes all cron jobs on server startup

**Acceptance Criteria:**
- [ ] Nightly summary runs automatically
- [ ] Dashboard reads from materialized summaries for fast load
- [ ] Expired carts cleaned up automatically

---

## Step 11.3 — Reports Engine (Backend)

**File:** `server/src/services/ReportService.ts`

**Report Types:**
| Report | API Endpoint | Description |
|:---|:---|:---|
| Z-Report | `GET /api/v1/shifts/:id/z-report` | Shift closing summary |
| Sales Report | `GET /api/v1/reports/sales` | By item, cashier, category, tier |
| Inventory Valuation | `GET /api/v1/reports/inventory-valuation` | Cost vs retail value |
| Inventory Wastage | `GET /api/v1/reports/inventory-wastage` | Shrinkage & loss report |
| Purchase Summary | `GET /api/v1/reports/purchases` | Procurement summary |
| Customer Due Aging | `GET /api/v1/reports/customer-aging` | Bakir Khata aging |
| Supplier Payable | `GET /api/v1/reports/supplier-payable` | Vendor payable aging |
| Profit & Loss (P&L) | `GET /api/v1/reports/pnl` | Double-entry P&L statement |

**Export Formats:**
- `format=json` — JSON data for on-screen preview
- `format=excel` — Streaming Excel export (ExcelJS WorkbookWriter)
- `format=pdf` — PDF generation
- `format=thermal` — ESC/POS binary for thermal print

**File:** `server/src/utils/streaming-excel.ts`
- Uses ExcelJS streaming writer to avoid memory issues with large datasets
- Cursor-based MongoDB streaming for 50,000+ records

**Acceptance Criteria:**
- [ ] All 8 report types return correct data
- [ ] Excel export works for large datasets (streaming)
- [ ] PDF generation works
- [ ] Reports filterable by date range

---

## Step 11.4 — Reports Pages (Frontend)

**Files to create:**
1. `client/src/app/(dashboard)/reports/page.tsx` — Report selector hub
2. `client/src/app/(dashboard)/reports/sales/page.tsx` — Sales report with filters and data table
3. `client/src/app/(dashboard)/reports/inventory/page.tsx` — Inventory valuation report
4. `client/src/app/(dashboard)/reports/pnl/page.tsx` — P&L statement view
5. `client/src/components/reports/ReportToolbar.tsx` — Date range picker, export buttons (PDF, Excel, Print)
6. `client/src/components/reports/PrintableReport.tsx` — A4 print-optimized layout

**Acceptance Criteria:**
- [ ] Each report type has its own page with appropriate filters
- [ ] Can export any report to PDF or Excel
- [ ] Can print reports (A4 layout)
- [ ] Data tables are sortable and searchable

---

# ═══════════════════════════════════════════════════
# PHASE 12: Real-time Notifications, Audit Logs & Production Hardening
# ═══════════════════════════════════════════════════

> **Goal:** Add Socket.io real-time alerts, complete the audit log system, performance optimization, and prepare for production deployment.

---

## Step 12.1 — Socket.io Real-time Notifications

**Backend:**
- `server/src/sockets/socket-server.ts` — Socket.io server with JWT authentication
- `server/src/sockets/events.ts` — Event types:
  - `LOW_STOCK_ALERT` — When stock falls below alertQty after sale
  - `SHIFT_DISCREPANCY_ALERT` — When shift closes with large discrepancy
  - `OFFLINE_OVERSELL_ALERT` — When offline sync causes negative stock

**Frontend:**
- `client/src/hooks/useRealTimeNotifications.ts` — Socket.io client hook
- `client/src/components/NotificationBell.tsx` — Header notification bell with unread count and dropdown

**Acceptance Criteria:**
- [ ] Alerts appear in real-time without page refresh
- [ ] Notifications targeted to Admin/Manager roles
- [ ] Notification bell shows unread count

---

## Step 12.2 — Audit Log System

**Backend:**
- `server/src/services/AuditLogService.ts`
  - `logAction(userId, action, entity, entityId, metadata, ipAddress)`
  - Append-only (no update/delete allowed)

- `server/src/utils/audit-helper.ts`
  - Utility to capture before/after snapshots for UPDATE operations
  - Automatically called by services on CREATE, UPDATE, DELETE actions

**API Endpoint:**
- `GET /api/v1/audit-logs` — Paginated with filters (entity, action, userId, date range)

**Frontend:**
- `client/src/app/(dashboard)/audit-logs/page.tsx` — Audit log viewer with filters and JSON diff display

**Acceptance Criteria:**
- [ ] All state-changing operations are logged
- [ ] Audit logs are immutable
- [ ] JSON diff shows before/after changes
- [ ] Filterable by entity, action, user, date

---

## Step 12.3 — Performance Optimization

**Checklist:**
- [ ] Barcode scan to cart: < 100ms
- [ ] POS checkout commit: < 1.5 seconds
- [ ] Report generation (10K records): < 3 seconds
- [ ] Page FCP: < 1.2 seconds, LCP: < 2.0 seconds
- [ ] MongoDB queries use indexes (no collection scans)
- [ ] Streaming exports for large datasets
- [ ] TanStack Query caching for frequent reads
- [ ] Next.js SSR/SSG where appropriate

---

## Step 12.4 — Production Deployment Prep

**Infrastructure:**
```
Nginx Reverse Proxy (SSL Termination)
├── /* → Next.js PWA (Port 3000)
├── /api/* → Express API (Port 5000)
└── /socket.io/* → Socket.io (Port 5000)
```

**Checklist:**
- [ ] Environment variable management (.env.production)
- [ ] MongoDB Atlas production cluster with replica set
- [ ] PM2 cluster mode for Express API
- [ ] Nginx reverse proxy configuration
- [ ] SSL certificate setup
- [ ] Database backup schedule
- [ ] Error monitoring (Sentry or equivalent)
- [ ] Rate limiting configured for production
- [ ] CORS configured for production domain

---

# ═══════════════════════════════════════════════════
# 📋 BUILD ORDER SUMMARY
# ═══════════════════════════════════════════════════

| Phase | Name | Key Deliverables |
|:---:|:---|:---|
| **1** | Project Initialization | Express + Next.js setup, MongoDB connection, API response helpers |
| **2** | Database Models | All 25 Mongoose models with indexes, TTL, validation |
| **3** | Auth & Security | JWT login, PIN lock, RBAC, rate limiting, idempotency, Zod validation |
| **4** | Users & App Shell | User/Role CRUD, sidebar layout, role-based navigation |
| **5** | Catalog & Products | Settings, categories, brands, products with variants & multi-pricing |
| **6** | Procurement | Suppliers, purchase orders, GRN receiving, WAC calculation |
| **7** | Shifts | Open/close shift, petty cash, Z-Report, cash reconciliation |
| **8** | POS Terminal | Barcode scan, cart, split payments, hold/resume, PIN lock, receipt print |
| **9** | CRM & Returns | Customers, credit ledger, sales history, returns, store credit vouchers |
| **10** | Finance | Inventory wastage, expenses, financial accounts, double-entry ledger |
| **11** | Reports & Dashboard | Dashboard KPIs, 8 report types, PDF/Excel export, cron jobs |
| **12** | Production | Socket.io alerts, audit logs, performance tuning, deployment |

---

> **📝 NOTE:** Each phase should be fully tested before moving to the next. After completing each phase, run all existing tests to ensure no regressions. Each backend feature should have corresponding API tests, and each frontend feature should be manually verified in the browser.

---

*This document is the complete, step-by-step build guide for the Enterprise Cloud-Based POS & Shop Management System. Follow the phases sequentially for the best development experience.*
