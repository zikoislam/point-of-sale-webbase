# Enterprise POS & ERP Master Prompt Guide
## Version: 2027 Edition

> **How to use:** This master file groups all modules of the Enterprise POS & ERP system. Give AI the prompts module-by-module so that both the operational features and the reports for a specific module are built together in the right context.

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

# MODULE 1: SMART POS, SALES, WHOLESALE & RETAIL

```text
PROMPT TO AI:
Build the Smart POS, Sales, and Wholesale/Retail Management module.

1. Features & Operations:
   - Smart POS UI: Fast checkout, barcode scanning, hold/suspend cart, multi-payment (Cash, Card, MFS).
   - Sales Management: Sales history, Sales Return, Due/Credit Sales, Invoice Generation.
   - Wholesale & Retail: Differentiate pricing based on customer type. Volume/Trade discounts for wholesale. Wholesale specific A4 invoice template.
   
2. Backend Models: Sale (items, priceType, totals, payment details), Customer (type: RETAIL/WHOLESALE), VolumePricing.
3. Routes: /api/v1/sales, /api/v1/pos

4. Reports (Add to ReportService):
   - Daily Sales Register, Wholesale vs Retail Comparison Report.
   - Top Selling Products, Category-wise Sales.
```

---

# MODULE 2: PURCHASE & INVENTORY MANAGEMENT

```text
PROMPT TO AI:
Build the Purchase & Inventory Management module.

1. Features & Operations:
   - Purchase Management: Purchase Orders (PO), Goods Receipt Note (GRN), Supplier Ledger, Purchase Returns (Debit Note).
   - Inventory Management: Stock tracking, Barcode-wise stock, Low stock alerts, Stock adjustments, Multi-branch stock transfer.
   - Smart Features: Auto-reorder suggestion based on sales velocity.

2. Backend Models: PurchaseOrder, StockMovement, Product (stock levels), PurchaseReturn.
3. Routes: /api/v1/purchases, /api/v1/inventory

4. Reports (Add to ReportService):
   - Inventory Valuation (FIFO/Average Cost).
   - Low Stock & Dead Stock Report.
   - Supplier Price Comparison, Purchase vs Sales Turnover.
```

---

# MODULE 3: ACCOUNTS MANAGEMENT

```text
PROMPT TO AI:
Build the Accounts Management module (Double-Entry System).

1. Features & Operations:
   - Chart of Accounts (Assets, Liabilities, Equity, Revenue, Expenses).
   - Journal Entries (Auto-posting from POS/Purchases & Manual entry).
   - Expense Management: Category-wise expense logging.
   - Cash & Bank Management: Bank accounts, cash in hand, fund transfers.

2. Backend Models: Account, JournalEntry, Expense.
3. Routes: /api/v1/accounts, /api/v1/expenses

4. Reports (Add to ReportService):
   - Trial Balance, Income Statement (P&L), Balance Sheet.
   - Ledger Statement, Day Book, Cash Flow Statement.
```

---

# MODULE 4: DISTRIBUTION, DEALER & SR MANAGEMENT (SUPPLY CHAIN)

```text
PROMPT TO AI:
Build the Distribution, Dealer, and SR (Sales Representative) Management module.

1. Features & Operations:
   - Supply-chain setup: Territory, Routes, Distribution Hierarchy (RSM, ASM, SR).
   - Dealer Management: Dealer profiling, Credit limits, Outstanding tracking.
   - SR Management: Mobile App (PWA) for SRs to take Field Orders, log GPS check-ins, collect payments.
   - Targets & Commission: Set SR targets, auto-calculate commissions.

2. Backend Models: Territory, Route, FieldOrder, SRProfile, CommissionRule.
3. Routes: /api/v1/distribution, /api/v1/field-orders

4. Reports (Add to ReportService):
   - SR Target vs Achievement Report.
   - Route Profitability, Dealer Outstanding/Aging Report, Daily Collection Report.
```

---

# MODULE 5: PRODUCTION MANAGEMENT

```text
PROMPT TO AI:
Build the Production & Manufacturing Management module.

1. Features & Operations:
   - Bill of Materials (BOM): Recipe/Formula for finished goods.
   - Work Orders: Production planning.
   - Production Batches: Raw material consumption (reduces stock) and finished goods output (increases stock). Track wastage.

2. Backend Models: BOM, WorkOrder, ProductionBatch.
3. Routes: /api/v1/production

4. Reports (Add to ReportService):
   - Production Output vs Planned.
   - Wastage and Costing Report.
```

---

# MODULE 6: EXPORT & IMPORT MANAGEMENT (LC)

```text
PROMPT TO AI:
Build the Export & Import Management (LC) module.

1. Features & Operations:
   - LC (Letter of Credit) Management: Create LC, track status (Opened, Shipped, Received, Retired).
   - Commercial Invoice & PI (Proforma Invoice) handling.
   - Customs Duty & Landed Cost Calculation: Auto-update product cost price based on freight, duty, and LC charges.
   - Freight Forwarder & C&F Agent ledger.

2. Backend Models: LetterOfCredit, ProformaInvoice, CommercialInvoice.
3. Routes: /api/v1/import-export

4. Reports (Add to ReportService):
   - LC Status Report, Landed Cost Analysis.
```

---

# MODULE 7: PROJECT APPROVAL MANAGEMENT

```text
PROMPT TO AI:
Build the Project Approval Management Workflow module.

1. Features & Operations:
   - Multi-tier Approval Workflow: Configurable approval chains for POs, Expenses, and LC.
   - Project Tracking: Track costs and revenues specific to projects.
   - Approval Dashboard: Inbox for managers to Approve/Reject with comments.

2. Backend Models: ApprovalWorkflow, ApprovalRequest, Project.
3. Routes: /api/v1/approvals, /api/v1/projects

4. Reports (Add to ReportService):
   - Pending Approvals Report.
   - Project-wise Profit & Loss.
```

---

# MODULE 8: CRM MANAGEMENT

```text
PROMPT TO AI:
Build the CRM (Customer Relationship Management) module.

1. Features & Operations:
   - Lead Management: Kanban board for Lead stages. Convert to Customer.
   - Follow-ups & Reminders.
   - Support Tickets: Customer complaints, SLA tracking.
   - Loyalty Points: Earn/Redeem points at POS.

2. Backend Models: Lead, SupportTicket, LoyaltyConfig.
3. Routes: /api/v1/crm

4. Reports (Add to ReportService):
   - Lead Conversion Rate.
   - Ticket Resolution SLA Report.
```

---

# MODULE 9: HR & PAYROLL MANAGEMENT

```text
PROMPT TO AI:
Build the HR & Payroll Management module.

1. Features & Operations:
   - Employee Database: Designation, department, joining date.
   - Attendance: Daily check-in/out, leave management.
   - Payroll Generation: Basic, allowance, deduction (late/absent), payslip generation.

2. Backend Models: Employee, Attendance, Payroll, LeaveRequest.
3. Routes: /api/v1/hr

4. Reports (Add to ReportService):
   - Attendance & Absenteeism Report.
   - Department-wise Payroll Summary.
```

---

# MODULE 10: eCOMMERCE MANAGEMENT

```text
PROMPT TO AI:
Build the eCommerce Management module (Headless CMS/Integration).

1. Features & Operations:
   - Sync online orders to POS.
   - E-commerce Product Management (Web descriptions, SEO tags, multiple images).
   - Order Fulfillment Workflow (Pending -> Packed -> Shipped).
   - Delivery Integration (Pathao/RedX API hooks).

2. Backend Models: EcommerceOrder, WebProductMeta.
3. Routes: /api/v1/ecommerce

4. Reports (Add to ReportService):
   - Online vs Offline Sales Comparison.
   - eCommerce Order Fulfillment Rate.
```

---

# MODULE 11: POWERFUL REPORTING (BI & ANALYTICS)

```text
PROMPT TO AI:
Build the Centralized Powerful Reporting & BI module.

1. Features & Operations:
   - Custom Date Range across all modules.
   - Export Options: PDF (professional layout), Excel, CSV, Print.
   - Graphical Dashboards: Recharts integration (Pie charts, Bar charts, Area charts).
   - Scheduled Auto-Reports: node-cron to email daily/weekly summaries to management.

2. Backend Setup: Use MongoDB Aggregation pipelines extensively for performance. Add Indexes.
3. Routes: /api/v1/reports

4. Reports to include in Central Hub:
   - Dashboard KPI metrics (Revenue, Profit, Dues, Low Stock).
   - All module reports linked in a unified Reporting Center Sidebar.
```
