# Postman Import Guide — POS System API

## Files Created

| File | Purpose |
|---|---|
| [`POS_System_API.postman_collection.json`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/postman/POS_System_API.postman_collection.json) | All API endpoints (18 folders, 60+ requests) |
| [`POS_Local.postman_environment.json`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/postman/POS_Local.postman_environment.json) | Environment variables for local testing |

---

## Step 1 — Postman এ Import করো

### Collection Import:
1. Postman খোলো
2. **"Import"** button এ click করো (top-left)
3. **"Upload Files"** select করো
4. এই file select করো:
   ```
   c:\Users\lenovo\Documents\point of sale webbase\postman\POS_System_API.postman_collection.json
   ```
5. **Import** press করো

### Environment Import:
1. আবার **"Import"** click করো
2. এই file select করো:
   ```
   c:\Users\lenovo\Documents\point of sale webbase\postman\POS_Local.postman_environment.json
   ```
3. Import এর পরে top-right এ **"POS Local Environment"** select করো ✅

---

## Step 2 — Server চালু করো

```powershell
cd "c:\Users\lenovo\Documents\point of sale webbase\server"
npm run dev
```

Server port: **5000**
Base URL: `http://localhost:5000/api/v1`

---

## Step 3 — Seed করো (প্রথমবার)

যদি database empty থাকে:
```powershell
npm run seed
```

এটা create করবে:
- Admin user: **username:** `admin`, **password:** `Admin@123`, **PIN:** `0000`
- Demo staff, categories, brands, suppliers, customers, products

---

## Step 4 — API Test করার Workflow

### Recommended Order (এই order এ test করো):

```
1. System & Health → Health Check
   ↓
2. Authentication → Admin Login (Auto Token Save)
   [⚡ JWT token auto-save হবে "token" variable এ]
   ↓
3. Roles → List Roles → role_id copy করে environment এ paste করো
   ↓
4. Users → List All Users → user_id copy করো
   ↓
5. Categories → List Categories → category_id copy করো
   ↓
6. Brands → List Brands → brand_id copy করো
   ↓
7. Suppliers → List Suppliers → supplier_id copy করো
   ↓
8. Products → List Products → product_id এবং variant_id copy করো
   ↓
9. Shifts → Open Shift (cashier login দিয়ে) → shift_id copy করো
   ↓
10. POS → Checkout Sale → invoice_no copy করো
```

---

## Collection Folders Overview

| # | Folder | Endpoints |
|---|---|---|
| 01 | System & Health | Health Check |
| 02 | Authentication | Login, Logout, Me, Lock/Unlock Terminal |
| 03 | Users & Staff | CRUD + PIN update |
| 04 | Roles & Permissions | Create/Manage RBAC Roles |
| 05 | Categories & Brands | Product catalog organization |
| 06 | Products & Catalog | CRUD + Barcode scan |
| 07 | Customers & CRM | Profile, Ledger, Due Collection |
| 08 | Suppliers & Vendors | Profile, Ledger, Payment disbursal |
| 09 | Procurement (PO & GRN) | PO creation, GRN receiving |
| 10 | Cashier Shifts & Till | Open/Close, Petty Cash, Z-Report |
| 11 | POS & Billing | Checkout, Hold Cart, Receipt print |
| 12 | Sales Returns & Vouchers | Return processing, Voucher validation |
| 13 | Accounts & Banking | Cash/Bank/MFS accounts, Transfers |
| 14 | Expense Management | Expense categories & logging |
| 15 | Inventory Adjustments | Wastage / spoilage write-offs |
| 16 | Reports & Analytics | Dashboard, P&L, CSV/PDF/Excel export |
| 17 | Audit Logs | Activity trails & security inspection |
| 18 | Store Settings | Business profile & receipt config |

---

## Key Demo Credentials

| Role | Username | Password | PIN |
|---|---|---|---|
| Super Admin | `admin` | `Admin@123` | `0000` |
| Branch Manager | `manager_dhaka` | `Password@123` | `1234` |
| Cashier 1 | `cashier_karim` | `Password@123` | `1234` |
| Cashier 2 | `cashier_rahim` | `Password@123` | `1234` |

---

## Demo Barcodes (Scanner Test)

| Barcode | Product |
|---|---|
| `8941100100012` | Aarong Milk 1L Pouch |
| `8941100100029` | Aarong Milk 500ml Pouch |
| `8941100200033` | Pran Mango Drink 250ml |
| `8941100300040` | Olympic Energy Biscuit 200g |

---

## Auto Token Feature

**Login request** এ একটি **Test Script** লাগানো আছে। Login করলেই automatically JWT token **`token`** environment variable এ save হয়ে যাবে। বাকি সব request automatically এই token use করবে।

> **Note:** Authorization: Bearer token collection-level এ configured আছে — প্রতিটা request এ আলাদা করে দিতে হবে না।
