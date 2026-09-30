# POS & Shop Management System — AI Update Prompt Guide
## Version: 2027 Edition

> **How to use:** Copy each STEP prompt and give it to AI. Work through steps one at a time.

---

## PROJECT CONTEXT — Add this before every AI prompt:

```
Project Stack:
- Backend: Node.js + Express.js + TypeScript
- Frontend: Next.js 14 App Router + TypeScript + Tailwind CSS
- Database: MongoDB + Mongoose ODM
- Auth: HTTP-only JWT Cookie (use credentials: include for all API calls)
- Backend files: /backend/src/{models,controllers,services,routes}
- Frontend files: /frontend/src/app/(dashboard)/
- All data has orgId field (organization-scoped multi-tenancy)
- Auth middleware: authenticate, requirePermissions
- API Base URL: process.env.NEXT_PUBLIC_API_URL + /api/v1
- Design: Dark theme, Tailwind CSS, Lucide React icons
```

---

## GAP ANALYSIS — What's Done vs Missing

### DONE (already exists):
- POS Terminal: checkout, hold cart, multi-payment, barcode scan
- Product Management: variants, SKU, barcode labels
- Category and Brand Management: basic CRUD
- Purchase Orders: create, GRN receive, status tracking
- Sales History and Returns
- Customer and Supplier Ledger
- Shift Management: open/close, Z-Report
- Reports: Sales, Inventory valuation, P&L, Dues, Payables, Purchases, Wastage
- Expense Management, Double-entry Accounts/Ledger
- HR, Distribution, CRM modules (basic)
- CSV / PDF / Excel Export (basic)
- Audit Logs, RBAC, Offline Sync (basic)

### MISSING (target of this guide):

**REPORTS GAP:**
- [ ] Category-wise Sales Report
- [ ] Brand-wise Sales and Stock Report
- [ ] Product Group concept + Group-wise Reports
- [ ] Barcode-wise Stock and Movement Tracker
- [ ] Wholesale vs Retail Comparison Report
- [ ] Category/Brand-wise Inventory Valuation
- [ ] Dead Stock / Slow Moving Report
- [ ] Stock Reorder Point Report
- [ ] Supplier-wise Purchase Analysis
- [ ] Purchase vs Sales Turnover Analysis

**CHAIN SHOP GAP:**
- [ ] Multi-Branch / Chain Shop management
- [ ] Branch-to-Branch Stock Transfer
- [ ] Centralized Chain Dashboard
- [ ] Per-Branch P&L Report

**PURCHASE MANAGEMENT GAP:**
- [ ] Purchase Return / Debit Note
- [ ] Supplier Price Comparison
- [ ] PO Approval Workflow
- [ ] Smart Auto-Reorder Suggestion

**WHOLESALE & RETAIL GAP:**
- [ ] Wholesale-specific Invoice Template
- [ ] Wholesale Price List PDF Export
- [ ] Volume / Trade Discount Tier System
- [ ] Retail vs Wholesale Revenue Breakdown

**2027 MODERN FEATURES:**
- [ ] Sales Forecasting (statistical, no external AI)
- [ ] WhatsApp Invoice Sending
- [ ] Customer Loyalty Points (full UI + POS integration)
- [ ] PWA Mobile-Optimized POS
- [ ] Real-time Notifications
- [ ] Scheduled Auto-Reports

---

# PHASE 1: PRODUCT GROUP SYSTEM

## STEP 1.1 — Product Group Backend

```
PROMPT TO AI:
Add Product Group feature to my Node.js/Express + MongoDB project.

1. Create /backend/src/models/ProductGroup.ts:
   Fields: name (required, unique per org), description,
   orgId (ref Organization), parentGroupId (self-ref for sub-groups),
   isActive (default true), timestamps

2. Add to Product.ts: groups field as Array of ObjectId ref ProductGroup

3. Create /backend/src/services/ProductGroupService.ts:
   - list(orgId): all groups for the org
   - create(data), update(id, data), delete(id)
   - getProductsByGroup(groupId, orgId)

4. Create /backend/src/controllers/ProductGroupController.ts: standard CRUD

5. Create /backend/src/routes/product-group.routes.ts:
   GET /api/v1/product-groups
   POST /api/v1/product-groups
   PUT /api/v1/product-groups/:id
   DELETE /api/v1/product-groups/:id
   GET /api/v1/product-groups/:id/products

6. Register in /backend/src/index.ts
Use existing auth middleware: authenticate, requirePermissions
```

## STEP 1.2 — Product Group Frontend

```
PROMPT TO AI:
Create /frontend/src/app/(dashboard)/product-groups/page.tsx

Features:
1. DataTable: Name | Description | Product Count | Actions (Edit/Delete)
2. Create/Edit Modal: Name, Description, Parent Group dropdown (hierarchy)
3. Delete confirmation dialog
4. Tree view showing parent/child group structure
5. Search and filter by name
6. Add Product Groups link to sidebar in dashboard layout.tsx

API: GET/POST/PUT/DELETE /api/v1/product-groups
Auth: credentials: include
Design: follow existing dashboard dark theme
```

---

# PHASE 2: CATEGORY / BRAND / GROUP-WISE SALES REPORTS

## STEP 2.1 — Category/Brand/Group Sales API [HIGH PRIORITY]

```
PROMPT TO AI:
Add these 3 report methods to /backend/src/services/ReportService.ts
and handlers to ReportController.ts:

Method 1: getCategoryWiseSalesReport(startDate?, endDate?, orgId?)
MongoDB Aggregation:
- $match: orgId + date range
- $unwind: items array
- $lookup: Product then Category
- $group: by categoryId
- Compute per category: totalQty, totalRevenue, totalCost, grossProfit, profitMarginPercent
- $sort: totalRevenue DESC
Return: { summary: {totalRevenue, topCategory, totalProfit}, data: [...] }

Method 2: getBrandWiseSalesReport(startDate?, endDate?, orgId?)
- Same pattern grouped by brand
- null brand products -> group as "No Brand"

Method 3: getGroupWiseSalesReport(startDate?, endDate?, orgId?)
- Grouped by ProductGroup via products.groups field

Add to ReportController.ts:
- getCategoryWiseSales(req, res, next)
- getBrandWiseSales(req, res, next)
- getGroupWiseSales(req, res, next)

Add to report.routes.ts:
GET /reports/category-wise-sales?startDate=&endDate=
GET /reports/brand-wise-sales?startDate=&endDate=
GET /reports/group-wise-sales?startDate=&endDate=

Add to ExportService.ts: CSV, Excel, PDF for all 3 new report types
```

## STEP 2.2 — Category/Brand/Group Analysis Page [HIGH PRIORITY]

```
PROMPT TO AI:
Create /frontend/src/app/(dashboard)/reports/category-analysis/page.tsx

Features:
1. Three tabs: Category Wise | Brand Wise | Group Wise
2. Date Range Picker (startDate, endDate)
3. Summary Cards: Total Revenue | Total Gross Profit | Top Performer | Avg Margin %
4. Recharts BarChart comparing revenue per category/brand/group
5. DataTable (all columns sortable):
   Name | Total Qty | Revenue (Tk) | Total Cost | Gross Profit | Margin % | Products
6. Export: PDF | Excel | CSV | Print
7. Add navigation link in /reports/page.tsx

API endpoints (use credentials: include):
GET /api/v1/reports/category-wise-sales?startDate=&endDate=
GET /api/v1/reports/brand-wise-sales?startDate=&endDate=
GET /api/v1/reports/group-wise-sales?startDate=&endDate=

Follow dark theme style from existing reports/page.tsx
```

---

# PHASE 3: BARCODE-WISE REPORTS

## STEP 3.1 — Barcode Stock and Movement API [HIGH PRIORITY]

```
PROMPT TO AI:
Add these 4 methods to /backend/src/services/ReportService.ts:

1. getBarcodeWiseReport(barcode?, startDate?, endDate?)
   - Find Product/Variant by barcode
   - Fetch all StockMovements for that variant
   Return: {
     product: { name, sku, barcode, category, brand, unit,
                currentStock, costPrice, retailPrice, wholesalePrice },
     movements: [{ date, type, qtyIn, qtyOut, reference, balanceAfter }],
     summary: { totalPurchased, totalSold, totalAdjusted, openingStock, closingStock }
   }

2. getLowStockReport(threshold?)
   - Products where currentStock <= alertQuantity
   Return: [{ barcode, productName, category, brand, currentStock, alertQty, lastSupplier }]

3. getDeadStockReport(daysSinceLastSale = 90)
   - Products with no SALE movement in last X days
   - Include total dead stock cost value

4. getStockReorderReport()
   - Low stock products + supplier info + last purchase price + suggested reorder qty
   - Suggested qty = avg monthly sales x 2 months

Add to report.routes.ts:
GET /reports/barcode-wise?barcode=&startDate=&endDate=
GET /reports/low-stock?threshold=
GET /reports/dead-stock?days=
GET /reports/stock-reorder
```

## STEP 3.2 — Barcode Tracker and Alert Pages [HIGH PRIORITY]

```
PROMPT TO AI:
Create these 4 frontend pages:

1. /frontend/src/app/(dashboard)/reports/barcode-tracker/page.tsx
   - Auto-focus barcode search input (USB scanner compatible)
   - After scan: product info card (name, SKU, stock, prices, category, brand)
   - Stock Movement table:
     Date | Type | Qty In | Qty Out | Reference | Balance After
     Colors: PURCHASE=green, SALE=red, ADJUSTMENT=blue, RETURN=orange
   - Date range filter, Export PDF/Excel

2. /frontend/src/app/(dashboard)/reports/low-stock/page.tsx
   - Products below alert qty table
   - Create PO button per row (links to purchase orders)
   - Filter by category or supplier

3. /frontend/src/app/(dashboard)/reports/dead-stock/page.tsx
   - Slow-moving / dead stock list
   - Days filter (30/60/90/180/365)
   - Total dead stock value in header

4. /frontend/src/app/(dashboard)/reports/reorder-point/page.tsx
   - Columns: Product | Stock | Avg Daily Sales | Days Left | Suggested Qty | Supplier | Est Cost
   - Create PO button per row
```

---

# PHASE 4: INVENTORY CATEGORY/BRAND-WISE VALUATION

## STEP 4.1 — Inventory by Category/Brand/Group [HIGH PRIORITY]

```
PROMPT TO AI:
Add these methods to /backend/src/services/ReportService.ts
(existing getInventoryValuation() has no category/brand filter):

1. getInventoryByCategory(categoryId?)
   - With categoryId: detailed products for that category
   - Without: summary per category (product count, total qty, total asset value)

2. getInventoryByBrand(brandId?)
   - Same pattern filtered by brand

3. getInventorySummaryByGroup()
   - Grouped by ProductGroup

4. getInventoryAging()
   - Based on StockMovement dates (purchase-in date)
   - Buckets: 0-30 | 31-60 | 61-90 | 90+ days
   - Asset value per bucket

Routes:
GET /reports/inventory-by-category?categoryId=
GET /reports/inventory-by-brand?brandId=
GET /reports/inventory-by-group
GET /reports/inventory-aging

Update /frontend/src/app/(dashboard)/reports/inventory/page.tsx:
- Add tabs: All | By Category | By Brand | By Group | Aging
- Category/Brand/Group filter dropdowns
- Pie chart: category-wise asset value
- Recharts Treemap: visual inventory breakdown
- Export per tab
```

---

# PHASE 5: WHOLESALE vs RETAIL MANAGEMENT

## STEP 5.1 — Wholesale vs Retail Report [HIGH PRIORITY]

```
PROMPT TO AI:
Add to /backend/src/services/ReportService.ts:

Method: getWholesaleVsRetailReport(startDate?, endDate?)
- Use Sale.priceType or Customer.customerType field
Return: {
  retail: { totalInvoices, totalRevenue, avgOrderValue, topProducts: [] },
  wholesale: { totalInvoices, totalRevenue, avgOrderValue, topCustomers: [] },
  comparison: { revenueRatio, invoiceRatio },
  dailyBreakdown: [{ date, retailRevenue, wholesaleRevenue }],
  categoryBreakdown: [{ category, retailRevenue, wholesaleRevenue }]
}

Method: getWholesaleCustomerReport()
- Wholesale customer ranking: total purchase, dues, loyalty tier

Routes:
GET /reports/wholesale-vs-retail?startDate=&endDate=
GET /reports/wholesale-customers

Create /frontend/src/app/(dashboard)/reports/wholesale-retail/page.tsx:
1. Side-by-side KPI cards (Retail vs Wholesale)
2. Recharts grouped BarChart: daily revenue comparison
3. Recharts Donut: revenue % split
4. Category breakdown table (retail vs wholesale columns)
5. Top 10 Wholesale Customers table
6. Date range filter + PDF/Excel export
```

## STEP 5.2 — Wholesale Invoice Template

```
PROMPT TO AI:
Create wholesale A4 invoice.

Frontend: /frontend/src/app/(dashboard)/sales/[id]/wholesale-invoice/page.tsx
- A4 print layout using existing print.css
- Company letterhead: logo, name, address, phone, email
- Invoice No, date, challan number
- Buyer: company name, address, BIN/TIN
- Item table: Product | Qty | Unit | Unit Price | VAT | Line Total
- Subtotal, VAT total, Grand Total
- Terms & Conditions
- Signature boxes (Authorized / Receiver)
- Bank/MFS payment details
- Print and PDF Download buttons

Backend: Add generateWholesaleInvoice(saleId) to SaleService.ts

Also create: /products/wholesale-price-list/page.tsx
- Printable catalog for wholesale customers
- Category-wise: Product | SKU | Unit | Wholesale Price | MOQ
- Print and PDF export
```

## STEP 5.3 — Volume Discount System

```
PROMPT TO AI:
Create Volume/Trade Discount system (quantity-based pricing).

1. /backend/src/models/VolumePricing.ts:
   - productId: ObjectId (ref Product)
   - variantId: ObjectId (optional)
   - customerType: RETAIL | WHOLESALE | ALL
   - tiers: [{ minQty, maxQty, discountPercent, fixedPrice }]
   - validFrom, validTo: Date
   - isActive: boolean, orgId: ObjectId

2. /backend/src/services/VolumePricingService.ts:
   - getApplicableDiscount(productId, qty, customerType)
   - list(orgId, productId?), create(data), update(id, data), delete(id)

3. POS integration: on qty change -> call getApplicableDiscount
   Show discount badge on cart item, auto-apply price

4. /frontend/src/app/(dashboard)/price-tiers/volume-pricing/page.tsx:
   - Product search, tier table editor
   - Pricing preview calculator

Routes: GET/POST/PUT/DELETE /api/v1/volume-pricing
```

---

# PHASE 6: PURCHASE MANAGEMENT UPGRADES

## STEP 6.1 — Purchase Return / Debit Note [HIGH PRIORITY]

```
PROMPT TO AI:
Create Purchase Return (Debit Note) — SalesReturn exists, now create PurchaseReturn.

1. /backend/src/models/PurchaseReturn.ts:
   - returnNumber: string (auto: PR-YYYY-XXXX)
   - purchaseOrderId: ObjectId ref PurchaseOrder
   - supplierId: ObjectId ref Supplier
   - items: [{ productId, variantId, quantity, unitCost, totalCost, reason }]
   - totalAmount: number
   - status: DRAFT | CONFIRMED | REFUNDED
   - refundMethod: CASH | BANK_TRANSFER | CREDIT_NOTE | ADJUSTED_AGAINST_PAYABLE
   - orgId, createdBy (ref User), timestamps

2. /backend/src/services/PurchaseReturnService.ts:
   create(data):
   - Reduce product stock
   - Credit Supplier Ledger (reduce payable)
   - Journal Entry: Debit Supplier Payable, Credit Stock Account
   list(filters), getById(id), updateStatus(id, status)

3. Routes:
   POST /api/v1/purchase-returns
   GET /api/v1/purchase-returns?supplierId=&status=&startDate=&endDate=
   GET /api/v1/purchase-returns/:id
   PUT /api/v1/purchase-returns/:id/status

4. Frontend: /purchase-orders/returns/page.tsx
   Step 1: Select PO | Step 2: Select items/qty to return + reason
   Step 3: Select refund method | Submit -> Debit Note number
   Print Debit Note button

5. Add Purchase Returns tab to /reports/purchases/ page
```

## STEP 6.2 — Supplier Price Comparison

```
PROMPT TO AI:
Add to /backend/src/services/ReportService.ts:

1. getSupplierWisePurchaseReport(startDate?, endDate?)
   Per supplier: PO count, total qty, total amount, paid, due, avg delivery days

2. getProductSupplierComparison(productId)
   Per supplier: last purchase price, last date, total qty purchased

3. getPurchaseVsSalesAnalysis(startDate?, endDate?)
   Per product: Purchased | Sold | Remaining | Turnover Rate | Stock Days

Routes:
GET /reports/supplier-wise-purchases
GET /reports/product-supplier-comparison?productId=
GET /reports/purchase-vs-sales

Create /reports/purchase-analysis/page.tsx:
- Tabs: Supplier Analysis | Product Analysis | Purchase vs Sales
- Charts + sortable tables + export
```

## STEP 6.3 — PO Approval Workflow

```
PROMPT TO AI:
Add Purchase Order Approval Workflow.

1. Add to PurchaseOrder model (backward compatible):
   - approvalStatus: PENDING_APPROVAL | APPROVED | REJECTED | AUTO_APPROVED
   - approvedBy: ObjectId ref User, approvedAt: Date
   - rejectionReason: string, requestedBy: ObjectId ref User

2. Update PurchaseOrderService.ts:
   - create(): if totalAmount > settings.poApprovalThreshold -> PENDING_APPROVAL
   - approve(id, userId), reject(id, userId, reason)

3. Routes:
   PUT /api/v1/purchase-orders/:id/approve (Manager/Admin)
   PUT /api/v1/purchase-orders/:id/reject

4. Add poApprovalThreshold to Settings model and Settings page

5. Frontend:
   - Pending Approval filter tab in /purchase-orders/page.tsx
   - Approval status badge per row
   - Approve/Reject buttons (Manager/Admin only)
   - Dashboard alert for pending count
```

---

# PHASE 7: CHAIN SHOP / MULTI-BRANCH

## STEP 7.1 — Branch Model and Backend

```
PROMPT TO AI:
Create Multi-Branch / Chain Shop system.

1. /backend/src/models/Branch.ts:
   - name (required), code (unique per org, e.g. BR-001)
   - orgId, address, city, phone
   - managerId (ref User), isHeadOffice, isActive
   - settings: { allowNegativeStock, defaultPriceType }

2. Add optional branchId to: Sale, PurchaseOrder, StockMovement, Expense, Shift, User

3. /backend/src/services/BranchService.ts:
   - list(orgId), create(data), update(id, data), delete(id)
   - getBranchStats(branchId): today sales, stock value, pending POs

4. /backend/src/models/StockTransfer.ts:
   - transferNumber (auto: ST-YYYY-XXXX)
   - fromBranchId, toBranchId (ref Branch)
   - items: [{ productId, variantId, quantity, unitCost }]
   - status: PENDING | IN_TRANSIT | RECEIVED | CANCELLED
   - sentBy, receivedBy, sentAt, receivedAt, notes, orgId

5. Routes:
   GET/POST /api/v1/branches
   PUT/DELETE /api/v1/branches/:id
   GET /api/v1/branches/:id/stats
   POST/GET /api/v1/stock-transfers
   PUT /api/v1/stock-transfers/:id/receive

6. Auth: users see only their branch data; Admin sees all
```

## STEP 7.2 — Chain Dashboard and Stock Transfer UI

```
PROMPT TO AI:
Create these 2 frontend pages:

1. /chain-management/page.tsx (Admin only)
   - Branch cards: Name, Code, Today Sales, Stock Value, Pending POs, Status
   - Consolidated totals for all branches
   - Recharts grouped BarChart: monthly sales per branch
   - P&L table: Branch | Revenue | Cost | Gross Profit | Expenses | Net

2. /stock-transfers/page.tsx
   - Transfer list: Transfer No | From | To | Date | Status | Actions
   - Filters: Branch, Status, Date Range
   - Create Transfer modal: from/to branch + product search with qty
   - Receive Transfer: confirm quantities, updates destination stock
   - Transfer detail with status timeline
   - Print transfer challan
```

---

# PHASE 8: ADVANCED INVENTORY SUITE

## STEP 8.1 — Stock Ledger and Full Inventory Suite

```
PROMPT TO AI:
Add to /backend/src/services/ReportService.ts:

1. getStockLedger(productId, startDate?, endDate?)
   - Per movement: Date | Type | Qty In | Qty Out | Running Balance | Reference
   - Include opening balance at period start

2. getStockMovementSummary(startDate?, endDate?)
   - Totals: received, sold, adjusted, written off — by type

3. getExpiryReport(daysAhead = 30)
   - Items expiring within X days + total potential loss value

Routes:
GET /reports/stock-ledger?productId=&startDate=&endDate=
GET /reports/stock-movement-summary
GET /reports/expiry-alert?days=

Create /reports/inventory-suite/page.tsx with 7 tabs:
1. Stock Valuation (Category/Brand/Group filter + Pie chart)
2. Stock Ledger (product search -> individual ledger)
3. Movement Summary (bar chart)
4. Low Stock Alert (with Create PO button)
5. Dead Stock
6. Expiry Alert
7. Reorder Suggestions (Create PO action)

All tabs: PDF | Excel | Print export
```

---

# PHASE 9: 2027 MODERN FEATURES

## STEP 9.1 — Loyalty Points Full Implementation

```
PROMPT TO AI:
Fully implement Loyalty Points (LoyaltyConfig model exists but no UI/integration).

1. Verify LoyaltyConfig fields:
   pointsPerTaka, pointValue, minRedeemPoints, maxRedeemPercent,
   expiryDays, isActive, tiers: [{name, minLifetimePoints, bonusMultiplier}]

2. Add to Customer model:
   loyaltyPoints, loyaltyTier (NONE/SILVER/GOLD/PLATINUM), lifetimePoints

3. Create /backend/src/models/LoyaltyTransaction.ts:
   customerId, type (EARN/REDEEM/EXPIRE), points, relatedSaleId, balanceAfter, date

4. SaleService.ts: after sale -> earn points -> update customer

5. POS: customer select shows points + tier badge
   Payment modal: Redeem Points input with taka value preview

6. Pages:
   /settings/loyalty — config UI
   /customers/[id] — Loyalty History tab
   /reports/loyalty — analytics
```

## STEP 9.2 — Smart Sales Forecasting (Statistical)

```
PROMPT TO AI:
Create /backend/src/services/ForecastService.ts (no external AI needed):

1. getSalesForecast(days = 7):
   - Last 90 days from DailySalesSummary
   - 7-day Simple Moving Average
   - Day-of-week seasonality adjustment
   Return: [{ date, forecastedRevenue, forecastedOrders, confidenceLevel }]

2. getProductDemandForecast(productId, days = 14):
   - avgDailySales = last 30 days avg
   - daysRemaining = currentStock / avgDailySales
   Return: { avgDailySales, daysRemaining, forecastedStockoutDate, suggestedReorderDate }

3. getSmartReorderSuggestions():
   - Products where daysRemaining < 7
   Return: [{ product, currentStock, avgDailySales, daysRemaining, suggestedQty, estimatedCost }]

Routes:
GET /api/v1/forecast/sales?days=
GET /api/v1/forecast/product/:id
GET /api/v1/forecast/reorder-suggestions

Create /forecasting/page.tsx:
- AreaChart: actual + forecast overlay
- Reorder table with Create PO button
```

## STEP 9.3 — WhatsApp Invoice Sending

```
PROMPT TO AI:
Add WhatsApp sending (WhatsApp Business API or Twilio).

1. /backend/src/services/WhatsAppService.ts:
   - sendInvoice(phone, saleId): text receipt -> WhatsApp
   - sendMessage(phone, message)
   - sendLowStockAlert(managerPhone, products[])
   - sendDailyReport(adminPhone)

2. Text receipt format:
   Receipt - [Shop Name] | INV-XXXX | DD/MM/YYYY
   [Item list] | Total: Tk.XXX | Paid: Tk.XXX | Due: Tk.XX

3. Settings: whatsappApiKey, whatsappPhoneNumberId, autoSendInvoiceOnSale

4. POS: Send WhatsApp button after checkout

5. /backend/src/jobs/daily-report.job.ts:
   node-cron: 59 23 * * * -> send daily summary to admin

Env: WHATSAPP_API_KEY, WHATSAPP_PHONE_NUMBER_ID
```

## STEP 9.4 — PWA Mobile POS

```
PROMPT TO AI:
Convert to Progressive Web App.

1. Configure next-pwa in next.config.mjs
   (Service Worker, offline cache, background sync)

2. /public/manifest.json:
   name: Shop POS, start_url: /pos, display: standalone,
   theme_color: #1e293b, icons: [192x192, 512x512]

3. /frontend/src/app/(pos)/mobile-pos/page.tsx:
   - Bottom navigation: Home | Products | Cart | History
   - Touch buttons (min 48px), numeric keypad
   - Camera scan: html5-qrcode
   - Swipe gestures on cart

4. Offline: IndexedDB queue (idb), auto-sync on reconnect

5. PWA install prompt banner

Packages: next-pwa, html5-qrcode, idb
```

## STEP 9.5 — Real-time Notifications

```
PROMPT TO AI:
Implement notifications using existing Socket.io.

1. /backend/src/models/Notification.ts:
   orgId, userId (null=all), type, title, message,
   entityType, entityId, isRead (default false), createdAt
   Types: LOW_STOCK | PO_APPROVAL | NEW_SALE | DUE_ALERT | SYSTEM

2. Socket.io emitters:
   - low_stock_alert (stock < alertQty)
   - po_approval_pending (new PO needs approval)
   - new_sale (for chain dashboard)
   - customer_due_warning (due near limit)

3. /frontend/src/components/NotificationBell.tsx:
   - Bell icon with unread badge in header
   - Dropdown notification list
   - Click -> navigate to relevant page
   - Mark all read, live Socket.io updates

4. Update dashboard layout.tsx to include bell in header

Routes:
GET /api/v1/notifications?isRead=false&limit=20
PUT /api/v1/notifications/:id/read
PUT /api/v1/notifications/mark-all-read
```

---

# PHASE 10: EXPORT UPGRADES

## STEP 10.1 — Enhanced PDF Reports

```
PROMPT TO AI:
Upgrade ExportService.ts for better PDFs.

1. Standard header for ALL reports:
   Shop logo + Name + Address + Phone
   Report title + date range
   Generated by [username] on [datetime]

2. Support new report types:
   category-wise-sales, brand-wise-sales, group-wise-sales,
   barcode-wise, low-stock, dead-stock, reorder,
   wholesale-retail, inventory-aging, stock-ledger

3. Category Sales PDF: summary -> detail table -> grand totals
4. Inventory PDF: category sub-sections, low stock rows in red
5. P&L PDF: two-column format + previous period comparison

puppeteer already installed — use it
```

## STEP 10.2 — Scheduled Auto Reports

```
PROMPT TO AI:
Create scheduled report system.

1. Install node-cron

2. /backend/src/jobs/:
   daily-summary.job.ts: 59 23 * * * -> update DailySalesSummary, email admin
   low-stock-checker.job.ts: 0 */4 * * * -> check stock, create notifications
   weekly-report.job.ts: 0 23 * * 0 -> weekly email

3. /backend/src/models/ScheduledReport.ts:
   reportType, cronSchedule, recipients[], format, isActive, lastRunAt

4. Register all jobs in index.ts

5. /settings/scheduled-reports/page.tsx:
   Toggle on/off, recipient emails, schedule picker, Run Now, last run status
```

---

# PHASE 11: UI IMPROVEMENTS

## STEP 11.1 — Dashboard Upgrade 2027

```
PROMPT TO AI:
Upgrade /frontend/src/app/(dashboard)/dashboard/page.tsx

1. 6 animated KPI cards:
   Today Revenue (vs yesterday %), Today Profit (margin %),
   Active Shift Float, Low Stock Count (clickable),
   Pending PO Approvals, Total Customer Dues (clickable)

2. Recharts AreaChart: last 30 days, Retail vs Wholesale split

3. Top Products widget (Today/Week/Month toggle):
   Rank | Product | Qty | Revenue | Stock | Sparkline

4. Recent Sales feed (auto-refresh 30s):
   Customer | Amount | Time | green=paid / red=due

5. Inventory Health donut: Low/Normal/Overstock (clickable)

6. Quick Actions: New Sale | Receive Stock | Log Expense | Add Customer

7. Admin: Branch Performance mini-cards

8. Forecast snippet: Tomorrow predicted revenue

Design: animated counters, gradient cards, smooth transitions
```

## STEP 11.2 — Bangla Language Support

```
PROMPT TO AI:
Add Bangla/English toggle.

1. /frontend/src/lib/i18n/: bn.json and en.json translation files
2. React Context provider with localStorage persistence
3. LanguageSwitcher component in header (EN | BN)
4. Instant switch without page reload
5. Thermal receipt: Bangla shop name option
6. Currency: Tk. 1,23,456.00 | Date in both languages
```

---

# PHASE 12: PERFORMANCE

## STEP 12.1 — MongoDB Indexes

```
PROMPT TO AI:
Add compound indexes to major models:

Sale.ts:
  { orgId:1, createdAt:-1 }
  { orgId:1, customerId:1 }
  { orgId:1, priceType:1, createdAt:-1 }

Product.ts:
  { orgId:1, category:1, brand:1 }
  { orgId:1, isActive:1 }

StockMovement.ts:
  { orgId:1, productId:1, createdAt:-1 }
  { orgId:1, type:1 }

PurchaseOrder.ts:
  { orgId:1, supplierId:1, status:1 }
  { orgId:1, approvalStatus:1 }

Customer.ts:
  { orgId:1, customerType:1 }

Rule: $match must be FIRST stage in all ReportService aggregations.
```

## STEP 12.2 — API Performance

```
PROMPT TO AI:
Optimize backend:

1. Add compression middleware (npm install compression)
2. Create performance.middleware.ts: log requests over 1000ms
3. Optional Redis cache for reports: 5 min TTL, invalidate on new sale
4. Frontend: dynamic() imports for chart libraries
5. react-window for large product lists
6. Rate limits: POS 200/min | Reports 30/min | Exports 10/min
```

---

# PRIORITY CHECKLIST

## HIGH PRIORITY — Do First:
- [ ] STEP 2.1 Category/Brand/Group Sales Report API
- [ ] STEP 2.2 Category Analysis UI page
- [ ] STEP 3.1 Barcode-wise Stock Report API
- [ ] STEP 3.2 Barcode Tracker + Alert pages
- [ ] STEP 4.1 Inventory by Category/Brand API + UI
- [ ] STEP 5.1 Wholesale vs Retail Report
- [ ] STEP 6.1 Purchase Return / Debit Note

## MEDIUM PRIORITY:
- [ ] STEP 1.1 + 1.2 Product Group System
- [ ] STEP 5.2 Wholesale Invoice Template
- [ ] STEP 5.3 Volume Discount System
- [ ] STEP 6.2 Supplier Price Comparison
- [ ] STEP 6.3 PO Approval Workflow
- [ ] STEP 8.1 Advanced Inventory Suite
- [ ] STEP 9.1 Loyalty Points Full
- [ ] STEP 9.5 Real-time Notifications
- [ ] STEP 10.1 Enhanced PDF Reports
- [ ] STEP 11.1 Dashboard 2027 Upgrade
- [ ] STEP 12.1 Database Indexes

## LOW PRIORITY — 2027 Future:
- [ ] STEP 7.1 + 7.2 Chain Shop Multi-Branch
- [ ] STEP 9.2 Sales Forecasting
- [ ] STEP 9.3 WhatsApp Integration
- [ ] STEP 9.4 PWA Mobile POS
- [ ] STEP 10.2 Scheduled Auto Reports
- [ ] STEP 11.2 Bangla Language Support
- [ ] STEP 12.2 API Performance Optimization

---

*Created: September 2027 | Enterprise POS & Shop Management System*
*Mark completed tasks with [x] as you finish them.*
