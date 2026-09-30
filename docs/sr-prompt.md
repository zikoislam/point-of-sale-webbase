# SR & Distributor Management System - AI Update Prompt Guide
## Version: 2027 Edition

> **How to use:** Copy each STEP prompt below and give it to AI. Work through steps one at a time to build the complete SR (Sales Representative) and Distributor management package.

---

## PROJECT CONTEXT — Add this before every AI prompt:

```text
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

## OVERVIEW & GAP ANALYSIS

### Current State:
The system currently handles standard POS, retail, and basic wholesale operations. It lacks field sales management.

### Missing Features (Target of this Guide):

**1. SR (Sales Representative) Operations:**
- SR Profile, Route/Area planning, and GPS/Location check-ins.
- Field Order taking (Pre-sales) & Van Sales (Ready stock).
- Target setting (Volume/Value) vs Achievement tracking.
- Commission and Incentive calculation.
- Payment Collection by SR.

**2. Distributor Operations:**
- Distributor profiling, categorization (Dealer, Sub-dealer), and Credit Limit management.
- Distributor Ledger and multi-invoice settlement.
- Dispatch/Delivery management for Distributor orders.

**3. Specialized Reports:**
- SR Performance (Target vs Achievement).
- Route Profitability / Area-wise Sales.
- Distributor Aging & Outstanding.
- Daily Collection Report by SR.

---

# PHASE 1: TERRITORY & ROUTE MANAGEMENT

## STEP 1.1 — Territory and Route Backend

```text
PROMPT TO AI:
Add Territory and Route Management for SRs to my Node.js/Express + MongoDB project.

1. Create /backend/src/models/Territory.ts:
   Fields: name, code, region, orgId, isActive (default true), timestamps

2. Create /backend/src/models/Route.ts:
   Fields: name, code, territoryId (ref Territory), daysOfWeek (array of strings, e.g., ['Monday', 'Thursday']), orgId, isActive, timestamps

3. Add routeId to Customer/Distributor model to map shops to specific routes.

4. Create /backend/src/services/RouteService.ts & TerritoryService.ts:
   - standard CRUD operations.
   - getCustomersByRoute(routeId)

5. Create Controllers and Routes:
   - GET/POST/PUT/DELETE /api/v1/territories
   - GET/POST/PUT/DELETE /api/v1/routes
   - GET /api/v1/routes/:id/customers

Use existing auth middleware.
```

## STEP 1.2 — Territory and Route Frontend

```text
PROMPT TO AI:
Create UI for Territory and Route management at /frontend/src/app/(dashboard)/distribution/routes/page.tsx

Features:
1. Tabs: Territories | Routes
2. Territories Tab: DataTable with CRUD modal for Territories.
3. Routes Tab: DataTable showing Route Name, Territory, Service Days, Customer Count.
4. Route Create/Edit Modal: Select Territory, input name/code, multi-select service days.
5. Add "Distribution" section to dashboard sidebar in layout.tsx.
```

---

# PHASE 2: SR PROFILE & DISTRIBUTOR UPGRADES

## STEP 2.1 — SR Profile & Distributor Model Updates

```text
PROMPT TO AI:
Update models for SR and Distributor management.

1. Create /backend/src/models/SRProfile.ts:
   Fields: userId (ref User - the SR's login), employeeCode, phone, assignedRoutes (array of Route IDs), baseLocation, isActive, orgId

2. Update Customer model (to handle Distributors):
   Add fields: 
   - isDistributor: boolean
   - creditLimit: number
   - distributorLevel: string (e.g., DEALER, SUB_DEALER)
   - assignedSR: ObjectId ref User (the SR handling this distributor)
   - routeId: ObjectId ref Route

3. Update UserService/CustomerService to handle these new fields.
4. Create /backend/src/services/SRProfileService.ts (CRUD + getRoutesForSR).

Routes:
GET/POST/PUT/DELETE /api/v1/sr-profiles
GET /api/v1/sr-profiles/:id/customers (Get shops under an SR)
```

## STEP 2.2 — SR & Distributor UI

```text
PROMPT TO AI:
Create frontend pages for SR and Distributor management.

1. /frontend/src/app/(dashboard)/distribution/sr-profiles/page.tsx:
   - List of SRs, mapping to system Users.
   - Assign Routes to SRs via modal.
   - View assigned shops/distributors.

2. Update existing Customer UI (/customers):
   - Add toggle/checkbox "Is Distributor".
   - If true, show fields for Credit Limit, Distributor Level, Route, and Assigned SR.
```

---

# PHASE 3: FIELD ORDERS & VAN SALES

## STEP 3.1 — Field Order API (Pre-sales)

```text
PROMPT TO AI:
Implement Field Order (Pre-sales) management. SRs take orders on the field which are dispatched later.

1. Create /backend/src/models/FieldOrder.ts:
   Fields: orderNumber (auto-gen), srId (ref User), customerId (Distributor/Shop),
   items: [{ productId, variantId, quantity, unitPrice, total }],
   subTotal, discount, grandTotal,
   status: PENDING | APPROVED | DISPATCHED | DELIVERED | CANCELLED,
   deliveryDate (expected), location: { lat, lng } (GPS of order taking), orgId, timestamps

2. Create /backend/src/services/FieldOrderService.ts:
   - createOrder(data): checks credit limit before accepting.
   - approveOrder(id)
   - dispatchOrder(id): This should automatically create a 'Sale' invoice and reduce main inventory.
   - listOrders(filters: srId, status, dateRange)

3. Routes:
   POST /api/v1/field-orders (SR app)
   GET /api/v1/field-orders
   PUT /api/v1/field-orders/:id/status
```

## STEP 3.2 — Field Order Management UI

```text
PROMPT TO AI:
Create Field Order dashboard at /frontend/src/app/(dashboard)/distribution/field-orders/page.tsx

Features:
1. Kanban board or Tabs for order status: Pending | Approved | Dispatched | Delivered.
2. Order list showing: Order No, SR Name, Customer, Amount, Expected Delivery.
3. Click to view order details: Items, GPS location link (Google Maps).
4. Actions: Admin can "Approve" or "Dispatch" orders.
5. Dispatch action should show a confirmation that a Sale Invoice will be generated.
```

---

# PHASE 4: COLLECTION & OUTSTANDING MANAGEMENT

## STEP 4.1 — Collection & Ledger API

```text
PROMPT TO AI:
Implement SR Payment Collection and advanced Distributor Ledger.

1. Create /backend/src/models/PaymentCollection.ts:
   Fields: receiptNumber, srId (ref User), customerId, amount, paymentMethod (CASH/CHEQUE/BANK),
   chequeDetails: { bank, number, date, status: PENDING|CLEARED|BOUNCED },
   notes, location: { lat, lng }, isVerified (by admin), orgId, timestamps.

2. Create /backend/src/services/CollectionService.ts:
   - createCollection(data): records payment collected by SR on the field.
   - verifyCollection(id): Admin confirms money received from SR. Credits the Distributor's ledger and creates accounting journal entry.

3. Routes:
   POST /api/v1/collections (SR submits collection)
   GET /api/v1/collections
   PUT /api/v1/collections/:id/verify
```

## STEP 4.2 — Collection Verification UI

```text
PROMPT TO AI:
Create /frontend/src/app/(dashboard)/distribution/collections/page.tsx

Features:
1. Table of collections submitted by SRs.
2. Columns: Date | SR Name | Customer | Amount | Method | Cheque Details | Status (Verified/Unverified).
3. "Verify" button for admins to confirm receipt of cash/cheque from SR.
4. "Bounce" button for cheques to reverse entries.
5. Summary cards: Today's Collection by SR, Pending Verifications.
```

---

# PHASE 5: TARGETS & COMMISSION

## STEP 5.1 — SR Target & Commission API

```text
PROMPT TO AI:
Implement Target Setting and Commission Calculation for SRs.

1. Create /backend/src/models/SRTarget.ts:
   Fields: srId, month, year, targetType (VALUE | VOLUME), targetAmount, achievedAmount, orgId

2. Create /backend/src/models/CommissionRule.ts:
   Fields: name, targetType, minAchievementPercent, commissionPercent, orgId

3. Update ReportService.ts with:
   - getSRTargetAchievement(month, year): calculates achievedAmount based on Delivered FieldOrders or Sales mapped to SR.
   - calculateCommission(srId, month, year): matches achievement % against CommissionRules to calculate payout.

4. Routes:
   POST/GET /api/v1/targets
   POST/GET /api/v1/commission-rules
   GET /api/v1/reports/sr-performance?month=&year=
```

---

# PHASE 6: REPORTS & ANALYTICS

## STEP 6.1 — SR & Distributor Reports API

```text
PROMPT TO AI:
Add distribution-specific reports to /backend/src/services/ReportService.ts:

1. getRouteProfitabilityReport(startDate, endDate)
   - Groups sales by routeId. Shows Revenue, Cost, Profit per route.

2. getDistributorAgingReport()
   - Outstanding balances bucketed by age: 0-30, 31-60, 61-90, 90+ days.
   - Highlights distributors exceeding credit limits.

3. getDailySRActivityReport(date, srId)
   - Combines FieldOrders taken, Collections made, and total visits (if visit logging is implemented) for an SR on a specific day.

Add routes in report.routes.ts for these.
```

## STEP 6.2 — Distribution Reports UI

```text
PROMPT TO AI:
Create /frontend/src/app/(dashboard)/reports/distribution/page.tsx

Features:
1. Tabs: SR Performance | Route Profitability | Distributor Aging | Daily SR Activity.
2. SR Performance: Bar chart (Target vs Achieved) per SR.
3. Route Profitability: Table with Route | Revenue | Profit.
4. Distributor Aging: Table with aging buckets. Red text for limit exceeded.
5. Date range and SR filters.
6. Export to PDF/Excel.
```

---

# PHASE 7: SR MOBILE APP (PWA) EXPERIENCE

## STEP 7.1 — Mobile UI for SRs

```text
PROMPT TO AI:
Create a mobile-optimized PWA view specifically for SRs on the field.
Path: /frontend/src/app/(sr-mobile)/sr-app/page.tsx

Features needed:
1. Bottom Nav: Home | Route | Orders | Collection
2. Home: Today's Target vs Achievement progress bar, Today's Collection total.
3. Route list: Shows customers to visit today. Click customer to open actions.
4. Customer Actions: 
   - "Take Order" (opens simple mobile cart).
   - "Collect Payment" (opens form for Amount, Cash/Cheque, Photo upload of cheque).
5. Must use HTML5 Geolocation API to attach `lat, lng` to orders and collections.
6. Offline Support (Service Worker + IndexedDB): Allow taking orders without internet, auto-sync when online.
```

---

# PHASE 8: SALES HIERARCHY & TEAM MANAGEMENT (RSM, ASM, TSO)

## STEP 8.1 — Sales Hierarchy Backend

```text
PROMPT TO AI:
Implement Sales Team Hierarchy (RSM, ASM, TSO, SR) in the project.

1. Create /backend/src/models/SalesHierarchy.ts:
   Fields: 
   - userId (ref User - the manager/supervisor)
   - role: RSM (Regional Sales Manager) | ASM (Area Sales Manager) | TSO (Territory Sales Officer) | SR (Sales Rep)
   - parentId (ref SalesHierarchy - who they report to. e.g., SR reports to TSO, TSO to ASM)
   - territoryIds (array of refs to Territory - areas they control)
   - orgId, isActive, timestamps

2. Update SRProfile.ts:
   - Add reportsTo: ObjectId ref SalesHierarchy (maps the SR to their TSO/ASM).

3. Create /backend/src/services/HierarchyService.ts:
   - buildHierarchyTree(orgId): Returns nested JSON tree of the sales team.
   - getSubordinates(userId): Returns all staff under a specific manager.

4. Routes:
   GET/POST/PUT/DELETE /api/v1/sales-hierarchy
   GET /api/v1/sales-hierarchy/tree
```

## STEP 8.2 — Sales Hierarchy UI

```text
PROMPT TO AI:
Create /frontend/src/app/(dashboard)/distribution/hierarchy/page.tsx

Features:
1. Interactive Org Chart / Tree View showing RSM -> ASM -> TSO -> SR structure.
2. Form to assign a user to a parent (e.g., Assigning 3 SRs under 1 ASM).
3. Territory mapping: Multi-select to assign Regions to RSMs, Areas to ASMs.
4. Data Scope: Ensure an ASM logging into the dashboard only sees Field Orders, Collections, and Reports for the SRs under their hierarchy.
```

---

# PHASE 9: MARKETING & TRADE PROMOTION OPERATIONS

## STEP 9.1 — Marketing & POSM Backend

```text
PROMPT TO AI:
Implement Marketing Operations: Trade Offers (Free Issues/Discounts) and POSM (Point of Sale Materials).

1. Create /backend/src/models/TradePromotion.ts:
   Fields: name, type (BOGO | PERCENT_DISCOUNT | FLAT_DISCOUNT | FREE_ITEM),
   buyProductId, buyQty, freeProductId, freeQty, discountValue,
   validFrom, validTo, applicableDistributorLevels (array), isActive, orgId

2. Create /backend/src/models/POSM.ts:
   Fields: materialName (e.g., Banner, Poster, Fridge), skuCode, stockQuantity, costPerItem, orgId

3. Create /backend/src/models/POSMDistribution.ts:
   Fields: posmId (ref POSM), customerId (ref Customer), srId (ref User), qtyProvided, date, photos (array of image URLs), orgId

4. Update FieldOrderService.ts:
   - Auto-apply TradePromotions when an SR adds items to cart (e.g., buy 10 get 1 free).

5. Routes:
   CRUD for /api/v1/trade-promotions
   CRUD for /api/v1/posm
   POST /api/v1/posm-distribution (SR logs giving a banner to a shop)
```

## STEP 9.2 — Marketing & Promotions UI

```text
PROMPT TO AI:
Create UI for Marketing & Promotions.

1. /frontend/src/app/(dashboard)/marketing/trade-promotions/page.tsx:
   - DataTable for active campaigns.
   - Modal to create rules: "Buy X get Y free" or "Buy X get Z% discount".

2. /frontend/src/app/(dashboard)/marketing/posm/page.tsx:
   - Inventory of marketing materials.
   - Tab for "Distributions" showing which shop got which banner/fridge, including photo previews.

3. Update SR Mobile App (PWA):
   - Add "Marketing/POSM" menu.
   - Allow SR to log that they gave a Poster to a shop and upload a photo via mobile camera.
```

---

# PHASE 10: ADVANCED SALES & MARKETING REPORTS

## STEP 10.1 — Hierarchy & Campaign Reports API

```text
PROMPT TO AI:
Add advanced reporting to /backend/src/services/ReportService.ts:

1. getHierarchyPerformanceReport(userId, startDate, endDate)
   - If RSM requests: Shows performance of all ASMs under them.
   - If ASM requests: Shows performance of all SRs under them.
   - Data points: Target, Achieved, Collection, Due.

2. getTradePromotionEffectivenessReport(promotionId)
   - How many times the offer was availed.
   - Total sales volume generated during the campaign vs previous month.
   - Total cost of free items given away.

3. getMarketCoverageReport()
   - Active Shops vs Inactive Shops per Route/Area.
   - Number of shops not visited by SR in the last 30 days.

Routes:
GET /reports/hierarchy-performance
GET /reports/trade-promotions
GET /reports/market-coverage
```

## STEP 10.2 — Analytics Dashboard UI

```text
PROMPT TO AI:
Create /frontend/src/app/(dashboard)/reports/marketing-analytics/page.tsx

Features:
1. Hierarchy Performance Tab: Drill-down tables (Click ASM -> shows their SRs).
2. Campaign Analytics Tab: Bar charts comparing sales before/during a trade promotion.
3. Market Coverage Tab: Pie charts showing Active vs Inactive shops in a territory.
4. "Needs Visit" Alert List: Shops that haven't given an order in 30 days, exportable for SR follow-up.
```

---
*Created: September 2027 | Enterprise POS & Distribution Management System*
*Mark completed tasks with [x] as you finish them.*
