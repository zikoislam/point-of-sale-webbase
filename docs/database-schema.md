# Database Schema Definitions
## Enterprise Cloud-Based Point of Sale (POS) & Shop Management System

**Database Engine:** MongoDB Atlas (Multi-Node Replica Set, Mongoose ODM, MongoDB Server v6.0+)  
**Consistency Model:** Strong Consistency with Multi-Document ACID Transactions (`readConcern: 'majority'`, `writeConcern: 'majority'`)  
**Reference Documents:** [`database.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/database.md), [`dfd.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/dfd.md), [`architecture.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/architecture.md), and [`PRD.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/PRD.md)  
**Author:** Lead Database Architect & Senior Backend Engineer  
**Date:** September 7, 2026  

---

## 2. Detailed Schema Definitions

Each schema is designed with strict data types, relational references, nested embedded documents, and validation constraints.

### 2.1 System & Auth Domain

#### `counters`
```typescript
interface ICounter {
  _id: string;          // e.g. "invoice_seq_20260907", "po_seq_2026"
  seq: number;          // Current incremental integer
  updatedAt: Date;
}
```

#### `roles`
```typescript
interface IRole {
  _id: Types.ObjectId;
  name: string;         // "SUPER_ADMIN" | "BRANCH_MANAGER" | "CASHIER"
  displayName: string;  // Human-readable title
  permissions: string[];// ["pos:checkout", "inv:view", "inv:adjust", "reports:pnl"]
  isSystemRole: boolean;// Prevents deletion of default roles
  createdAt: Date;
  updatedAt: Date;
}
```

#### `users`
```typescript
interface IUser {
  _id: Types.ObjectId;
  username: string;       // Unique lowercase handle
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;   // bcrypt salt factor 12
  pinHash: string;        // bcrypt hashed 4-digit PIN for Terminal Lock
  roleId: Types.ObjectId; // Ref: roles
  isActive: boolean;
  terminalLocked: boolean;// Quick screen lock state
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

#### `token_blacklist`
```typescript
interface ITokenBlacklist {
  _id: Types.ObjectId;
  tokenHash: string;      // SHA-256 hash of revoked JWT
  userId: Types.ObjectId; // Ref: users
  expiresAt: Date;        // Exact expiration timestamp of original JWT
  createdAt: Date;        // TTL Index triggers cleanup
}
```

---

### 2.2 Inventory & Catalog Domain

#### `categories` & `brands`
```typescript
interface ICategory {
  _id: Types.ObjectId;
  name: string;
  code: string;           // Short uppercase slug, e.g. "BEV-COLD"
  parentId?: Types.ObjectId; // Ref: categories (For nested subcategories)
  defaultTaxRate?: number;  // Default VAT % inherited by products without explicit taxRate
  description?: string;     // Category description visible in catalog
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface IBrand {
  _id: Types.ObjectId;
  name: string;
  originCountry?: string;
  logoUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### `products` & Embedded `variants`
```typescript
interface IBatchLot {
  batchNo: string;              // e.g. "BATCH-2026-09-001"
  costPrice: number;            // Purchase cost for this specific lot
  expiryDate?: Date;            // FEFO expiry date for this lot
  quantity: number;             // Remaining stock in this lot
  receivedAt: Date;             // When this lot was received (GRN date)
}

interface IVariant {
  _id: Types.ObjectId;
  sku: string;                  // Unique, e.g. "SKU-MILK-1000ML"
  barcode: string;              // Unique EAN-13 / Code-128
  attributeName: string;        // "1 Liter" | "500g" | "Blue / XL"
  costPrice: number;            // Weighted average cost price (WAC), recalculated on each GRN
  retailSellingPrice: number;   // Standard retail consumer price (MRP)
  wholesaleSellingPrice: number;// Bulk/trade tier selling price
  currentStock: number;         // Real-time total on-hand inventory count (sum of all lots)
  alertQty: number;             // Reorder alert trigger threshold
  batches?: IBatchLot[];        // FEFO lot tracking for perishable products (optional)
  rackLocation?: string;        // e.g. "Aisle 3 - Shelf B"
  isAvailable: boolean;
}

interface IProduct {
  _id: Types.ObjectId;
  name: string;
  categoryId: Types.ObjectId;   // Ref: categories
  brandId?: Types.ObjectId;     // Ref: brands
  supplierId?: Types.ObjectId;  // Ref: suppliers (Default/primary supplier for reordering)
  unit: 'Pcs' | 'Kg' | 'Gram' | 'Ltr' | 'Ml' | 'Box' | 'Meter' | 'Goj';
  imageUrl?: string;
  taxType: 'INCLUSIVE' | 'EXCLUSIVE' | 'EXEMPT';
  taxRate: number;              // Percentage VAT (e.g., 15 for 15% VAT; 0 = use category defaultTaxRate)
  variants: IVariant[];         // Embedded array of variants (1-to-few pattern)
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### `stock_movements`
```typescript
interface IStockMovement {
  _id: Types.ObjectId;
  productId: Types.ObjectId;    // Ref: products
  variantId: Types.ObjectId;    // Subdoc _id in products.variants
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN' | 'WASTAGE';
  quantity: number;             // Decimal support for fractional units (e.g. 2.5 Goj, 1.75 Meter)
  stockBefore: number;          // Snapshot of stock prior to movement
  stockAfter: number;           // Snapshot of stock post movement
  unitCost: number;             // Valuation cost at movement time
  referenceType: 'SALE' | 'PO' | 'MANUAL' | 'RETURN' | 'WASTAGE_EXPENSE';
  referenceId: Types.ObjectId;  // Ref: sales._id, purchase_orders._id, etc.
  reason?: string;              // Detailed note for audit
  userId: Types.ObjectId;       // Ref: users (Staff member responsible)
  createdAt: Date;
}
```

---

### 2.3 Procurement Domain

#### `purchase_orders` & Embedded `po_items`
```typescript
interface IPOItem {
  variantId: Types.ObjectId;
  productName: string;          // Snapshot
  sku: string;                  // Snapshot
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  lineTotal: number;
}

interface IPurchaseOrder {
  _id: Types.ObjectId;
  poNumber: string;             // Unique, e.g. "PO-20260907-0001"
  supplierId: Types.ObjectId;   // Ref: suppliers
  status: 'DRAFT' | 'ORDERED' | 'PARTIAL' | 'RECEIVED' | 'CANCELLED';
  items: IPOItem[];
  subtotal: number;
  taxAmount: number;
  shippingCost: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  expectedDeliveryDate?: Date;
  actualReceivedDate?: Date;
  vendorInvoiceNo?: string;
  createdById: Types.ObjectId;  // Ref: users
  receivedById?: Types.ObjectId;// Ref: users
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 2.4 Sales, Checkout & Returns Domain

#### `sales` & Embedded `sale_items` & `payments`
```typescript
interface ISaleItem {
  variantId: Types.ObjectId;
  productName: string;          // Snapshot
  variantName: string;          // Snapshot
  sku: string;                  // Snapshot
  barcode: string;              // Snapshot
  quantity: number;
  unitCostPrice: number;        // Snapshot for accurate COGS
  unitSellingPrice: number;     // Snapshot of applied price
  taxRate: number;              // Snapshot VAT %
  taxAmount: number;            // Line VAT sum
  discount: number;             // Line discount
  lineTotal: number;            // Net payable for this line
}

interface IPaymentRecord {
  method: 'CASH' | 'CARD' | 'MFS_BKASH' | 'MFS_NAGAD' | 'STORE_CREDIT' | 'CUSTOMER_DUE';
  amount: number;
  accountId?: Types.ObjectId;   // Ref: accounts (Debited/Credited)
  transactionRef?: string;      // Card auth code, bKash TxID, or Voucher code
}

interface ISale {
  _id: Types.ObjectId;
  invoiceNo: string;            // Unique, e.g. "INV-20260907-00001"
  shiftId: Types.ObjectId;      // Ref: shifts
  cashierId: Types.ObjectId;    // Ref: users
  customerId?: Types.ObjectId;  // Ref: customers (Walk-in if null)
  pricingTier: 'RETAIL' | 'WHOLESALE';
  items: ISaleItem[];
  subtotal: number;             // Pre-tax, pre-discount total
  totalTax: number;             // Accumulated VAT
  discountAmount: number;       // Bill-level discount sum
  totalAmount: number;          // Net bill total
  paidAmount: number;           // Total tendered
  changeReturned: number;       // Cash change handed back
  dueAmount: number;            // Outstanding debt for customer credit
  payments: IPaymentRecord[];   // Split payment breakdown
  isOfflineSynced: boolean;     // Set to true if queued via IndexedDB
  idempotencyKey: string;       // Unique UUID to stop duplicate billing
  createdAt: Date;
  updatedAt: Date;
}
```

#### `store_credit_vouchers`
```typescript
interface IStoreCreditVoucher {
  _id: Types.ObjectId;
  voucherCode: string;          // Unique indexed, e.g. "CR-89F2-47A1"
  customerId: Types.ObjectId;   // Ref: customers
  saleReturnId: Types.ObjectId; // Ref: sales_returns
  initialBalance: number;
  currentBalance: number;
  status: 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED';
  expiresAt: Date;              // Typically 1 year from issue
  issuedById: Types.ObjectId;   // Ref: users
  createdAt: Date;
  updatedAt: Date;
}
```

#### `sales_returns` & Embedded `return_items`
```typescript
interface IReturnItem {
  variantId: Types.ObjectId;
  quantity: number;
  unitRefundPrice: number;      // Proportional net refund after discounts
  isResaleable: boolean;        // If true -> Stock Restocked; If false -> Wastage
  restocked: boolean;
}

interface ISalesReturn {
  _id: Types.ObjectId;
  returnNo: string;             // Unique, e.g. "RET-20260907-0001"
  saleId: Types.ObjectId;       // Ref: sales
  originalInvoiceNo: string;    // Snapshot
  customerId?: Types.ObjectId;  // Ref: customers
  items: IReturnItem[];
  totalRefundAmount: number;
  refundType: 'CASH' | 'STORE_CREDIT' | 'CARD_REVERSAL';
  voucherId?: Types.ObjectId;   // Ref: store_credit_vouchers
  authorizedById: Types.ObjectId;// Ref: users (Manager PIN)
  reason: string;
  createdAt: Date;
}
```

---

### 2.5 Shift & Drawer Domain

#### `shifts`
```typescript
interface IShift {
  _id: Types.ObjectId;
  userId: Types.ObjectId;       // Ref: users (Cashier)
  terminalId: string;           // Counter identifier (e.g. "COUNTER-01")
  openedAt: Date;
  closedAt?: Date;
  openingFloat: number;         // Initial cash drawer float
  cashSalesTotal: number;       // Accumulated cash collected
  cashExpensesTotal: number;    // Cash paid out from drawer
  pettyCashIn: number;          // Added mid-shift cash
  pettyCashOut: number;         // Drop/draw mid-shift cash
  expectedCash: number;         // Opening + Sales + In - Expenses - Out
  actualCash?: number;          // Blind physical count by cashier
  discrepancy?: number;         // actualCash - expectedCash
  managerApprovalId?: Types.ObjectId; // Ref: users (If discrepancy > $10)
  status: 'OPEN' | 'CLOSED';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 2.6 CRM & Dual Ledgers Domain

#### `customers` & `customer_ledgers`
```typescript
interface ICustomer {
  _id: Types.ObjectId;
  name: string;
  phone: string;                // Unique Index
  email?: string;
  address?: string;
  creditLimit: number;          // Maximum allowed due balance
  currentDueBalance: number;    // Outstanding debt
  loyaltyPoints: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ICustomerLedger {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;   // Ref: customers
  transactionType: 'SALE_DUE' | 'PAYMENT_COLLECTION' | 'RETURN_CREDIT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: 'SALE' | 'RECEIPT' | 'RETURN';
  referenceId: Types.ObjectId;
  narration: string;
  recordedById: Types.ObjectId; // Ref: users
  createdAt: Date;
}
```

#### `suppliers` & `supplier_ledgers`
```typescript
interface ISupplier {
  _id: Types.ObjectId;
  companyName: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  currentPayableBalance: number;// Money shop owes to vendor
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ISupplierLedger {
  _id: Types.ObjectId;
  supplierId: Types.ObjectId;   // Ref: suppliers
  transactionType: 'PO_GRN_BILL' | 'PAYMENT_DISBURSAL' | 'PURCHASE_RETURN';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: 'PO' | 'DISBURSEMENT';
  referenceId: Types.ObjectId;
  narration: string;
  recordedById: Types.ObjectId; // Ref: users
  createdAt: Date;
}
```

---

### 2.7 Financial Accounts & Expenses Domain

#### `accounts`, `account_transactions` & `expenses`
```typescript
interface IAccount {
  _id: Types.ObjectId;
  name: string;                 // "Cash Drawer 1", "bKash Merchant", "City Bank A/C"
  accountType: 'CASH' | 'BANK' | 'MFS';
  accountNumber?: string;
  currentBalance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface IAccountTransaction {
  _id: Types.ObjectId;
  accountId: Types.ObjectId;    // Ref: accounts
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: 'SALE' | 'EXPENSE' | 'TRANSFER' | 'DUE_COLLECTION' | 'SUPPLIER_PAYMENT' | 'WASTAGE_LOSS';
  referenceId: Types.ObjectId;
  description: string;
  createdAt: Date;
}

interface IExpenseCategory {
  _id: Types.ObjectId;
  name: string;                 // "Shop Rent", "Electricity", "Staff Lunch", "Wastage Loss"
  code: string;
}

interface IExpense {
  _id: Types.ObjectId;
  categoryId: Types.ObjectId;   // Ref: expense_categories
  amount: number;
  accountId: Types.ObjectId;    // Ref: accounts (Debited account)
  receiptVoucherUrl?: string;   // Cloudinary / AWS S3 image URL
  description: string;
  createdById: Types.ObjectId;  // Ref: users
  createdAt: Date;
}
```

---

### 2.8 Analytics & Audit Trail Domain

#### `daily_sales_summaries`
```typescript
interface IDailySalesSummary {
  _id: Types.ObjectId;
  date: string;                 // "YYYY-MM-DD" (Unique Index)
  totalSalesRevenue: number;    // Gross sales turnover
  totalCOGS: number;            // Cost of goods sold based on sale-time cost snapshots
  totalTaxCollected: number;
  totalDiscounts: number;
  totalExpenses: number;        // Direct shop operating costs
  totalWastageLoss: number;     // Cost of written-off damaged goods
  netProfit: number;            // Revenue - COGS - Expenses - Wastage
  totalInvoices: number;
  totalItemsSold: number;
  updatedAt: Date;
}
```

#### `audit_logs`
```typescript
interface IAuditLog {
  _id: Types.ObjectId;
  userId: Types.ObjectId;       // Ref: users (Actor)
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PRICE_OVERRIDE' | 'OFFLINE_OVERSELL' | 'SHIFT_DISCREPANCY';
  entity: string;               // "sales", "products", "shifts", "accounts"
  entityId: string;             // Primary key string of target document
  metadata: Record<string, any>;// JSON diff payload: before/after snapshots
  ipAddress?: string;
  createdAt: Date;              // Immutable timestamp
}
```

---

### 2.9 Hold Carts & System Settings Domain

#### `hold_carts`
```typescript
interface IHoldCartItem {
  variantId: Types.ObjectId;
  productName: string;          // Snapshot
  variantName: string;          // Snapshot
  sku: string;                  // Snapshot
  barcode?: string;             // Snapshot
  quantity: number;             // Supports decimal (e.g. 2.5 Goj)
  unitSellingPrice: number;     // Applied price at hold time
  taxRate: number;
  taxAmount: number;
  discount: number;
  lineTotal: number;
}

interface IHoldCart {
  _id: Types.ObjectId;
  cartLabel?: string;           // Optional user label, e.g. "Customer: Rahim"
  userId: Types.ObjectId;       // Ref: users (Cashier who parked cart)
  shiftId: Types.ObjectId;      // Ref: shifts (Active shift at hold time)
  customerId?: Types.ObjectId;  // Ref: customers (If customer was selected)
  pricingTier: 'RETAIL' | 'WHOLESALE';
  items: IHoldCartItem[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  notes?: string;
  expiresAt: Date;              // TTL: auto-deleted after 24h (shift end also triggers cleanup)
  createdAt: Date;
}
```

#### `settings`
```typescript
interface ISettings {
  _id: Types.ObjectId;
  isDefault: boolean;           // Unique Index: only one active settings document
  shopName: string;             // e.g. "Al-Amin Traders"
  shopAddress: string;
  shopPhone: string;
  shopEmail?: string;
  currencySymbol: string;       // e.g. "৳" or "BDT"
  defaultTaxRate: number;       // System-wide fallback VAT % (overridden by category/product)
  allowNegativeStock: boolean;  // Toggle: allow POS sales when stock = 0
  thermalPrinterType: '58mm' | '80mm';
  barcodeLabelFormat: string;   // e.g. "38mm_x_25mm_2up"
  cashDrawerTriggerCode: string;// ESC/POS hex, e.g. "\\x1B\\x70\\x00\\x19\\xFA"
  receiptHeader: string;        // Custom text printed at top of receipts
  receiptFooter: string;        // e.g. "Thank you! Return policy: 7 days"
  logoUrl?: string;             // Cloudinary / S3 URL for receipt logo
  updatedAt: Date;
}
```
