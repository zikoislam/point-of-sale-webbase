# REST API Specification Document
## Enterprise Cloud-Based Point of Sale (POS) & Shop Management System

**API Version:** `v1`  
**Base URL:** `https://api.pos-system.com/api/v1`  
**Protocol:** HTTPS / TLS 1.3  
**Data Format:** `application/json`  
**Reference Documents:** [`PRD.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/PRD.md), [`database-schema.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/database-schema.md), and [`database.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/database.md)  
**Author:** Lead Backend Architect & API Designer  
**Date:** September 8, 2026  

---

## 1. Global API Standards & Protocols

- [1.1 Headers](#11-headers)
- [1.2 Standardized JSON Response Schema](#12-standardized-json-response-schema)
- [1.3 Standard HTTP Status Codes](#13-standard-http-status-codes)
- [1.4 API Version Control Strategy](#14-api-version-control-strategy)
- [1.5 Global Error Handling Architecture & Error Code Dictionary](#15-global-error-handling-architecture--error-code-dictionary)

---

### 1.1 Headers
All API requests must include standard HTTP headers:

| Header Name | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `Content-Type` | String | Yes | Must be `application/json` for requests with body payloads. |
| `Authorization` | String | Conditional | `Bearer <JWT_TOKEN>` (Required for all authenticated endpoints). |
| `Idempotency-Key` | UUID String | Conditional | Mandatory for `POST /api/v1/sales/checkout` to prevent duplicate billing on network retries. |
| `X-Shift-ID` | ObjectId | Conditional | Optional active cashier shift context identifier for POS operations. |

---

### 1.2 Standardized JSON Response Schema

#### Success Response Format (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Operation completed successfully",
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 150,
    "totalPages": 8
  },
  "timestamp": "2026-09-08T18:07:00.000Z"
}
```

#### Error Response Format (`400`, `401`, `403`, `404`, `409`, `422`, `500`)
```json
{
  "success": false,
  "statusCode": 400,
  "error": {
    "code": "INSUFFICIENT_INVENTORY",
    "message": "Insufficient stock for variant SKU: PRAN-MILK-1L. Available: 2, Requested: 5",
    "details": [
      {
        "field": "items[0].quantity",
        "issue": "Requested quantity exceeds available stock"
      }
    ]
  },
  "timestamp": "2026-09-08T18:07:00.000Z"
}
```

---

### 1.3 Standard HTTP Status Codes

| Code | Status | Description |
| :---: | :--- | :--- |
| `200` | OK | Standard success response for `GET`, `PUT`, `PATCH`, and execution calls. |
| `201` | Created | Resource successfully created (`POST`). |
| `400` | Bad Request | Malformed request body, missing mandatory fields, or invalid syntax. |
| `401` | Unauthorized | Missing, expired, or invalid JWT token in `Authorization` header. |
| `403` | Forbidden | User lacks necessary RBAC permission for the operation. |
| `404` | Not Found | Target document or path does not exist. |
| `409` | Conflict | Uniqueness constraint failure (e.g. duplicate username, SKU, barcode, or invoice sequence). |
| `422` | Unprocessable Entity | Business logic validation failed (e.g. credit limit exceeded, insufficient balance). |
| `429` | Too Many Requests | Rate limit exceeded (e.g. > 5 failed login attempts per minute). |
| `500` | Internal Error | Server crash or unhandled MongoDB multi-document transaction abort. |

---

### 1.4 API Version Control Strategy

The API enforces strict versioning standards to maintain backward compatibility, support multi-device client deployments (Web POS, Mobile Apps, Thermal Hardware Print Bridges), and allow progressive API evolution.

#### 1. URL Path Versioning (Primary)
All API endpoints prefix their paths with an explicit major version indicator (`/api/v1/`, `/api/v2/`). Major version bumps signify breaking API contract changes.

```http
GET /api/v1/products/barcode/8941100123456 HTTP/1.1
Host: api.pos-system.com
```

#### 2. Semantic Versioning Scheme (`MAJOR.MINOR.PATCH`)
- **MAJOR Version (`v1`, `v2`):** Incremented when introducing breaking changes (e.g., removing fields, changing data types, modifying mandatory payload parameters, changing authentication mechanisms).
- **MINOR Version (`1.1`, `1.2`):** Incremented for additive, backward-compatible enhancements (e.g., new optional fields, new endpoints, extra response metadata).
- **PATCH Version (`1.1.1`):** Applied for internal bug fixes, security patches, and performance optimizations under existing API contracts.

#### 3. Minor Version Header Negotiation (Optional)
Clients may optionally supply the `X-API-Version` header to lock or request minor version behavior:
```http
X-API-Version: 1.2.0
```

#### 4. Deprecation & Sunset Policy
When an API endpoint or version is marked for deprecation:
1. **Response Headers:** The API attaches HTTP standard deprecation headers to every request:
   ```http
   Deprecation: true
   Sunset: Sun, 01 Mar 2027 00:00:00 GMT
   Link: <https://docs.pos-system.com/api/v2-migration>; rel="successor-version"
   ```
2. **Grace Period:** Deprecated endpoints are guaranteed to remain functional for a minimum of **6 months** before removal.
3. **Telemetry:** Deprecation warnings are logged in client audit logs to alert developers of legacy client usages.

---

### 1.5 Global Error Handling Architecture & Error Code Dictionary

#### 1.5.1 Error Processing Pipeline
All API requests flow through a unified error boundary middleware stack:

```
[ Incoming Request ]
        │
        ▼
┌───────────────────────────────┐
│ Request Validation (Zod Schema)│ ──(Fails)──► Return 400 Bad Request (INVALID_PAYLOAD)
└───────────────┬───────────────┘
                │(Passes)
                ▼
┌───────────────────────────────┐
│ Business & RBAC Validation    │ ──(Fails)──► Return 401/403/422 (Domain Error)
└───────────────┬───────────────┘
                │(Passes)
                ▼
┌───────────────────────────────┐
│ MongoDB ACID Transaction Session│ ──(Aborts)─► Return 409/500 (TRANSACTION_ABORTED)
└───────────────┬───────────────┘
                │(Success)
                ▼
[ Response 200/201 Success Payload ]
```

#### 1.5.2 Complete Error Code Dictionary

The API returns domain-specific, standardized machine-readable error codes in the `error.code` string field:

| Domain | Error Code String | HTTP Status | Description / Trigger Condition |
| :--- | :--- | :---: | :--- |
| **Auth & Security** | `AUTH_CREDENTIALS_INVALID` | `401` | Username or password verification failed during login. |
| | `TOKEN_EXPIRED` | `401` | Provided JWT access token has passed `exp` timestamp. |
| | `TOKEN_INVALID_OR_BLACKLISTED` | `401` | Token format is corrupt or token hash exists in `token_blacklist`. |
| | `PERMISSION_DENIED` | `403` | User role vector lacks required permission string (e.g. `reports:pnl`). |
| | `TERMINAL_LOCKED` | `403` | POS terminal is locked (`Ctrl + L`); PIN unlock required before checkout. |
| | `PIN_INVALID` | `401` | 4-digit Cashier PIN verification failed during screen unlock or refund override. |
| | `RATE_LIMIT_EXCEEDED` | `429` | IP address exceeded maximum allowed requests (e.g. > 5 login attempts/min). |
| **Inventory & Catalog** | `PRODUCT_NOT_FOUND` | `404` | Target `productId` document does not exist. |
| | `VARIANT_NOT_FOUND` | `404` | Target `variantId` subdocument does not exist. |
| | `DUPLICATE_SKU` | `409` | Variant SKU code already exists in catalog. |
| | `DUPLICATE_BARCODE` | `409` | EAN/Code-128 barcode already assigned to another variant. |
| | `INSUFFICIENT_INVENTORY` | `422` | Requested sales quantity exceeds `variants.currentStock` (and not offline sync). |
| | `CATEGORY_HAS_DEPENDENTS` | `409` | Category deletion blocked due to existing active linked products. |
| **Procurement** | `PO_STATUS_INVALID` | `422` | Attempted action invalid for current PO state (e.g., modifying `RECEIVED` PO). |
| | `PARTIAL_RECEIVING_OVERFLOW` | `422` | Received quantity exceeds remaining ordered quantity for line item. |
| | `SUPPLIER_NOT_FOUND` | `404` | Target supplier vendor profile does not exist. |
| **Sales & POS Checkout**| `IDEMPOTENCY_KEY_REPLAY` | `409` | Idempotency Key was previously used with a different request payload. |
| | `SHIFT_NOT_ACTIVE` | `422` | Cashier has no open active shift session for current terminal. |
| | `CREDIT_LIMIT_EXCEEDED` | `422` | Customer credit sale would exceed customer's `creditLimit`. |
| | `VOUCHER_EXHAUSTED_OR_EXPIRED` | `422` | Store credit voucher code balance is zero or past `expiresAt`. |
| | `DISCOUNT_REQUIRES_MANAGER_PIN` | `403` | Manual discount $> 10\%$ requires Manager PIN authorization. |
| | `PROPORTIONAL_REFUND_ERROR` | `400` | Refund item quantity exceeds original invoice quantity. |
| **Shift & Drawer** | `SHIFT_ALREADY_OPEN` | `409` | Cashier already has an active open shift session on terminal. |
| | `SHIFT_CLOSED_CANNOT_CHECKOUT` | `422` | POS checkout attempt rejected because shift is in `CLOSED` state. |
| | `DISCREPANCY_REQUIRES_APPROVAL` | `403` | Shift closing cash shortage/overage $> \$10$ requires Manager PIN approval. |
| **CRM & Ledgers** | `CUSTOMER_NOT_FOUND` | `404` | Target customer profile does not exist. |
| | `CUSTOMER_PHONE_DUPLICATE` | `409` | Customer phone number already registered in directory. |
| **Financial Accounts** | `ACCOUNT_INSUFFICIENT_FUNDS` | `422` | Account balance is insufficient to process expense or fund transfer. |
| | `ACCOUNT_NOT_ACTIVE` | `422` | Financial account is disabled or deactivated. |
| **Database & System** | `TRANSACTION_ABORTED_CONCURRENCY` | `500` | MongoDB ACID transaction aborted due to concurrent write conflict; client should retry. |
| | `DATABASE_TIMEOUT` | `500` | Database query execution exceeded server timeout threshold. |
| | `INTERNAL_SERVER_ERROR` | `500` | Unhandled exception intercepted by top-level error boundary. |

---

#### 1.5.3 Detailed Error Payload Examples

##### Example 1: Payload Validation Error (`400 Bad Request`)
```json
{
  "success": false,
  "statusCode": 400,
  "error": {
    "code": "INVALID_PAYLOAD",
    "message": "Request body validation failed",
    "details": [
      {
        "field": "items[0].quantity",
        "issue": "Expected number, received string"
      },
      {
        "field": "payments[0].amount",
        "issue": "Number must be greater than zero"
      }
    ]
  },
  "timestamp": "2026-09-08T18:09:00.000Z"
}
```

##### Example 2: Domain Business Rule Violation (`422 Unprocessable Entity`)
```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "CREDIT_LIMIT_EXCEEDED",
    "message": "Customer due balance limit exceeded. Current Due: ৳14,500.00, Proposed Sale Due: ৳2,000.00, Credit Limit: ৳15,000.00",
    "details": [
      {
        "field": "dueAmount",
        "issue": "Exceeds remaining credit allowance of ৳500.00"
      }
    ]
  },
  "timestamp": "2026-09-08T18:09:00.000Z"
}
```

##### Example 3: Rate Limit Exceeded (`429 Too Many Requests`)
```json
{
  "success": false,
  "statusCode": 429,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many failed login attempts. Please wait 60 seconds before trying again.",
    "details": [
      {
        "field": "username",
        "issue": "Rate limit threshold of 5 attempts/min exceeded for IP: 192.168.1.50"
      }
    ]
  },
  "timestamp": "2026-09-08T18:09:00.000Z"
}
```

---

## 2. API Endpoint Directory Overview

The system exposes **68 RESTful endpoints** categorized across **9 functional domains**:

1. [Authentication & System Security (`/api/v1/auth`, `/api/v1/users`, `/api/v1/roles`)](#3-domain-1-authentication--system-security)
2. [Catalog & Inventory Management (`/api/v1/categories`, `/api/v1/brands`, `/api/v1/products`, `/api/v1/stock-movements`)](#4-domain-2-catalog--inventory-management)
3. [Procurement & Vendor Management (`/api/v1/suppliers`, `/api/v1/purchase-orders`)](#5-domain-3-procurement--vendor-management)
4. [Sales, POS Checkout & Returns (`/api/v1/sales`, `/api/v1/hold-carts`, `/api/v1/vouchers`, `/api/v1/returns`)](#6-domain-4-sales-pos-checkout--returns)
5. [Shift & Cash Register Auditing (`/api/v1/shifts`)](#7-domain-5-shift--cash-register-auditing)
6. [CRM & Customer Credit Ledger (`/api/v1/customers`)](#8-domain-6-crm--customer-credit-ledger)
7. [Financial Accounts & Shop Expenses (`/api/v1/accounts`, `/api/v1/expenses`)](#9-domain-7-financial-accounts--shop-expenses)
8. [Analytics & Materialized Reports (`/api/v1/reports`)](#10-domain-8-analytics--materialized-reports)
9. [System Audit & Shop Settings (`/api/v1/audit-logs`, `/api/v1/settings`)](#11-domain-9-system-audit--shop-settings)

---

## 3. Domain 1: Authentication & System Security

### 3.1 `POST /api/v1/auth/login`
Authenticates a staff member, validates credentials, and returns a JWT access token alongside user role permissions.

- **Authentication:** Public (Unauthenticated)
- **Rate Limit:** 5 requests / minute / IP
- **Request Body:**
```json
{
  "username": "cashier1",
  "password": "SecurePassword123!"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Authentication successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 28800,
    "user": {
      "_id": "66dc81f2a1b2c3d4e5f60003",
      "username": "cashier1",
      "fullName": "Rahim Uddin",
      "email": "rahim@shop.com",
      "role": {
        "name": "CASHIER",
        "displayName": "POS Cashier",
        "permissions": ["pos:checkout", "inv:view", "shifts:operate", "customers:create"]
      },
      "terminalLocked": false
    }
  }
}
```
- **Error Response `401` (Invalid Credentials):**
```json
{
  "success": false,
  "statusCode": 401,
  "error": {
    "code": "AUTH_CREDENTIALS_INVALID",
    "message": "Invalid username or password. Please try again."
  },
  "timestamp": "2026-09-08T18:07:00.000Z"
}
```
- **Error Response `429` (Rate Limited):**
```json
{
  "success": false,
  "statusCode": 429,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many failed login attempts. Please wait 60 seconds."
  },
  "timestamp": "2026-09-08T18:07:00.000Z"
}
```

---

### 3.2 `POST /api/v1/auth/logout`
Revokes active JWT token by writing token SHA-256 hash to `token_blacklist` collection with automated TTL expiry.

- **Authentication:** Bearer JWT
- **Permission:** Any active session
- **Request Body:** None
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User logged out successfully and session revoked"
}
```

---

### 3.3 `GET /api/v1/auth/me`
Fetches current authenticated user's session state, permission vector, and active terminal lock status.

- **Authentication:** Bearer JWT
- **Permission:** Any active user
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "userId": "66dc81f2a1b2c3d4e5f60003",
    "username": "cashier1",
    "fullName": "Rahim Uddin",
    "role": "CASHIER",
    "permissions": ["pos:checkout", "inv:view", "shifts:operate", "customers:create"],
    "terminalLocked": false
  }
}
```

---

### 3.4 `POST /api/v1/auth/lock-terminal`
Quickly locks cashier terminal screen (`Ctrl + L`). Preserves open shift and active cart session but blocks all checkout actions.

- **Authentication:** Bearer JWT
- **Permission:** All Roles (`pos:checkout` or active shift)
- **Request Body:** None
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "POS terminal locked. PIN required to unlock.",
  "data": {
    "terminalLocked": true
  }
}
```

---

### 3.5 `POST /api/v1/auth/unlock-terminal`
Unlocks POS terminal screen using Cashier's 4-digit bcrypt-hashed PIN or Admin credentials.

- **Authentication:** Bearer JWT
- **Permission:** All Roles
- **Request Body:**
```json
{
  "pin": "1234"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "POS terminal unlocked successfully",
  "data": {
    "terminalLocked": false
  }
}
```

---

### 3.6 User Management Endpoints (`/api/v1/users`)

| Method | Path | Required Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/users` | `users:manage` (Admin) | List all staff user accounts with pagination & role filtering. |
| `POST` | `/api/v1/users` | `users:manage` (Admin) | Create new user account with initial 4-digit cashier PIN & password. |
| `GET` | `/api/v1/users/:id` | `users:manage` (Admin) | Retrieve single user account details. |
| `PUT` | `/api/v1/users/:id` | `users:manage` (Admin) | Update user profile, status (`isActive`), PIN, or assigned role. |
| `POST` | `/api/v1/users/:id/reset-password` | `users:manage` (Admin) | Force reset user password. |

#### `POST /api/v1/users` Payload Example:
```json
{
  "username": "manager_karim",
  "fullName": "Karim Hossain",
  "email": "karim@shop.com",
  "phone": "+8801700000099",
  "password": "ManagerPassword2026!",
  "pin": "5678",
  "roleId": "66dc81f2a1b2c3d4e5f60002"
}
```

---

### 3.7 Role Management Endpoints (`/api/v1/roles`)

| Method | Path | Required Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/roles` | `roles:view` (Admin, Manager) | List all system and custom RBAC roles. |
| `POST` | `/api/v1/roles` | `roles:manage` (Admin) | Create custom role with granular permissions array. |
| `PUT` | `/api/v1/roles/:id` | `roles:manage` (Admin) | Update permission string vector for role. |

---

### 3.8 `DELETE /api/v1/users/:id`
Deactivates (soft-deletes) a staff user account.

- **Authentication:** Bearer JWT
- **Permission:** `users:manage` (Admin)
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User account deactivated successfully"
}
```

---

## 4. Domain 2: Catalog & Inventory Management

### 4.1 Category & Brand Endpoints

| Method | Path | Auth | Permission | Description |
| :--- | :--- | :---: | :--- | :--- |
| `GET` | `/api/v1/categories` | Bearer | `inv:view` | List product taxonomy (supports parent/child tree hierarchy). |
| `POST` | `/api/v1/categories` | Bearer | `inv:manage` | Create product category with default VAT tax rate. |
| `PUT` | `/api/v1/categories/:id` | Bearer | `inv:manage` | Update category details and tax inheritance profile. |
| `DELETE` | `/api/v1/categories/:id` | Bearer | `inv:manage` | Delete category (blocked if active products exist). |
| `GET` | `/api/v1/brands` | Bearer | `inv:view` | List catalog brands. |
| `POST` | `/api/v1/brands` | Bearer | `inv:manage` | Create brand entry. |

---

### 4.2 `GET /api/v1/products`
Retrieves product master catalog with variants.

- **Authentication:** Bearer JWT
- **Permission:** `inv:view` (All Roles)
- **Role Scoping Rule:** If requesting user's role is `CASHIER`, backend **omits** `costPrice` and `batches` cost attributes from response payload.
- **Query Parameters:**
  - `search` (string): Text search across product name & variant attribute name.
  - `categoryId` (ObjectId): Filter by category.
  - `barcode` (string): Exact match query for fast scanner lookup.
  - `isLowStock` (boolean): Filter items where `currentStock <= alertQty`.
  - `page` (number), `limit` (number).
- **Response `200 OK` (Admin / Manager View):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "66dc81f2a1b2c3d4e5f60001",
      "name": "Pran Pasteurized Full Cream Milk",
      "category": { "_id": "66dc81f2a1b2c3d4e5f61001", "name": "Dairy & Beverage" },
      "unit": "Ltr",
      "taxType": "INCLUSIVE",
      "taxRate": 15,
      "variants": [
        {
          "_id": "66dc81f2a1b2c3d4e5f6001a",
          "sku": "PRAN-MILK-1L",
          "barcode": "8941100123456",
          "attributeName": "1 Liter",
          "costPrice": 65.00,
          "retailSellingPrice": 80.00,
          "wholesaleSellingPrice": 74.00,
          "currentStock": 45,
          "alertQty": 10,
          "isAvailable": true
        }
      ]
    }
  ]
}
```

---

### 4.3 `POST /api/v1/products`
Creates a master product with embedded variant array and tax rules.

- **Authentication:** Bearer JWT
- **Permission:** `inv:manage` (Admin, Manager)
- **Request Body:**
```json
{
  "name": "Aarong Dairy Butter",
  "categoryId": "66dc81f2a1b2c3d4e5f61001",
  "brandId": "66dc81f2a1b2c3d4e5f62001",
  "supplierId": "66dc81f2a1b2c3d4e5f63001",
  "unit": "Box",
  "taxType": "INCLUSIVE",
  "taxRate": 15,
  "description": "200g Creamery Butter",
  "variants": [
    {
      "sku": "AARONG-BUTTER-200G",
      "barcode": "8941100987654",
      "attributeName": "200g Pack",
      "costPrice": 180.00,
      "retailSellingPrice": 220.00,
      "wholesaleSellingPrice": 200.00,
      "currentStock": 50,
      "alertQty": 15,
      "rackLocation": "Refr-Aisle 1"
    }
  ]
}
```

---

### 4.3a `GET /api/v1/products/:id`
Fetch a single product document with all variants.

- **Authentication:** Bearer JWT
- **Permission:** `inv:view`
- **Response `200 OK`:** Returns the full product document including all variants (Cashier role: `costPrice` omitted).

---

### 4.3b `PUT /api/v1/products/:id`
Update product master data or modify embedded variant pricing / stock alert thresholds.

- **Authentication:** Bearer JWT
- **Permission:** `inv:manage` (Admin, Manager)
- **Request Body:** Partial or full product object with updated fields.

---

### 4.3c `DELETE /api/v1/products/:id`
Soft-deletes a product by setting `isActive: false`. Blocked if product has open active sale/PO references.

- **Authentication:** Bearer JWT
- **Permission:** `inv:manage` (Admin, Manager)
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Product deactivated successfully"
}
```

---

### 4.4 `GET /api/v1/products/barcode/:barcode`
Fast barcode resolution endpoint designed for POS hardware scanners (< 100ms SLA).

- **Authentication:** Bearer JWT
- **Permission:** `pos:checkout` / `inv:view`
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "productId": "66dc81f2a1b2c3d4e5f60001",
    "variantId": "66dc81f2a1b2c3d4e5f6001a",
    "productName": "Pran Pasteurized Full Cream Milk",
    "attributeName": "1 Liter",
    "sku": "PRAN-MILK-1L",
    "barcode": "8941100123456",
    "unit": "Ltr",
    "taxType": "INCLUSIVE",
    "taxRate": 15,
    "retailSellingPrice": 80.00,
    "wholesaleSellingPrice": 74.00,
    "currentStock": 45
  }
}
```

---

### 4.5 `POST /api/v1/products/labels/print`
Generates binary ESC/POS or ZPL sticker commands for barcode printer rolls (e.g. 38mm x 25mm 2-up).

- **Authentication:** Bearer JWT
- **Permission:** `inv:labels` (Admin, Manager)
- **Request Body:**
```json
{
  "variantId": "66dc81f2a1b2c3d4e5f6001a",
  "labelQuantity": 100,
  "format": "38mm_x_25mm_2up",
  "includePrice": true,
  "includeShopName": true
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Label print job queued successfully",
  "data": {
    "jobId": "LBL-JOB-20260908-001",
    "variantId": "66dc81f2a1b2c3d4e5f6001a",
    "sku": "PRAN-MILK-1L",
    "labelQuantity": 100,
    "format": "38mm_x_25mm_2up",
    "status": "QUEUED"
  }
}
```

---

### 4.6 `POST /api/v1/stock-movements/adjust`
Logs stock adjustments & inventory wastage write-offs. Automatically creates direct expense entries for shrinkage.

- **Authentication:** Bearer JWT
- **Permission:** `inv:adjust` (Admin, Manager)
- **Business Logic:** Marking items as `WASTAGE` deducts variant stock, logs `stock_movements`, creates an `expense` linked to `Inventory Shrinkage & Loss`, and posts a DEBIT transaction to the financial ledger (PRD 6.2).
- **Request Body:**
```json
{
  "productId": "66dc81f2a1b2c3d4e5f60001",
  "variantId": "66dc81f2a1b2c3d4e5f6001a",
  "type": "WASTAGE",
  "quantity": 3,
  "reason": "Expired milk cartons - seal damaged",
  "accountId": "66dc81f2a1b2c3d4e5f67001"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Stock adjustment recorded and P&L expense logged",
  "data": {
    "movementId": "66dc81f2a1b2c3d4e5f69001",
    "type": "WASTAGE",
    "quantity": 3,
    "stockBefore": 45,
    "stockAfter": 42,
    "expenseId": "66dc81f2a1b2c3d4e5f69100"
  }
}
```

---

### 4.7 `GET /api/v1/stock-movements`
Fetches paginated stock movement history. Useful for inventory audit trails.

- **Authentication:** Bearer JWT
- **Permission:** `inv:view` (Admin, Manager)
- **Query Parameters:** `variantId`, `type` (`IN|OUT|WASTAGE|ADJUSTMENT|RETURN`), `startDate`, `endDate`, `page`, `limit`.
- **Response `200 OK`:** Paginated list of `stock_movements` documents with product name, SKU, quantity delta, and reference details.

---

## 5. Domain 3: Procurement & Vendor Management

### 5.1 Supplier Management Endpoints (`/api/v1/suppliers`)

| Method | Path | Auth | Permission | Description |
| :--- | :--- | :---: | :--- | :--- |
| `GET` | `/api/v1/suppliers` | Bearer | `procurement:view` | List vendor profiles and current payable balances. |
| `POST` | `/api/v1/suppliers` | Bearer | `procurement:manage` | Create new vendor record. |
| `GET` | `/api/v1/suppliers/:id` | Bearer | `procurement:view` | Fetch single supplier profile details. |
| `PUT` | `/api/v1/suppliers/:id` | Bearer | `procurement:manage` | Update supplier contact info and payment terms. |
| `GET` | `/api/v1/suppliers/:id/ledger` | Bearer | `procurement:view` | Fetch supplier payable ledger history. |
| `POST` | `/api/v1/suppliers/:id/payments` | Bearer | `procurement:pay` | Disburse supplier payment (Debits selected bank/cash account & updates ledger balance). |

---

### 5.2 Purchase Order CRUD Endpoints

| Method | Path | Auth | Permission | Description |
| :--- | :--- | :---: | :--- | :--- |
| `GET` | `/api/v1/purchase-orders` | Bearer | `procurement:view` | List all POs with status filter (`DRAFT`, `ORDERED`, `PARTIAL`, `RECEIVED`, `CANCELLED`). |
| `POST` | `/api/v1/purchase-orders` | Bearer | `procurement:manage` | Create new Purchase Order. |
| `GET` | `/api/v1/purchase-orders/:id` | Bearer | `procurement:view` | Fetch single PO with all line items and status. |
| `PUT` | `/api/v1/purchase-orders/:id` | Bearer | `procurement:manage` | Update PO details (only valid for `DRAFT` status). |

---

### 5.3 `POST /api/v1/purchase-orders`
Creates a Purchase Order (PO) in `DRAFT` or `ORDERED` status.

- **Authentication:** Bearer JWT
- **Permission:** `procurement:manage` (Admin, Manager)
- **Request Body:**
```json
{
  "supplierId": "66dc81f2a1b2c3d4e5f63001",
  "expectedDeliveryDate": "2026-09-15T00:00:00.000Z",
  "items": [
    {
      "variantId": "66dc81f2a1b2c3d4e5f6001a",
      "productName": "Pran Pasteurized Full Cream Milk",
      "sku": "PRAN-MILK-1L",
      "orderedQty": 200,
      "unitCost": 62.50
    }
  ],
  "shippingCost": 250.00,
  "notes": "Deliver before noon"
}
```

---

### 5.3 `POST /api/v1/purchase-orders/:id/receive`
Processes Goods Received Note (GRN). Supports partial receiving, automatically increases variant stock, updates Weighted Average Cost (WAC), and posts to supplier payable ledger.

- **Authentication:** Bearer JWT
- **Permission:** `procurement:receive` (Admin, Manager)
- **Request Body:**
```json
{
  "vendorInvoiceNo": "INV-PRAN-2026-8891",
  "actualReceivedDate": "2026-09-08T12:00:00.000Z",
  "receivedItems": [
    {
      "variantId": "66dc81f2a1b2c3d4e5f6001a",
      "receivedQty": 200,
      "unitCost": 62.50,
      "batchNo": "BATCH-2026-09-001",
      "expiryDate": "2026-09-25T00:00:00.000Z"
    }
  ],
  "paidAmountNow": 5000.00,
  "paymentAccountId": "66dc81f2a1b2c3d4e5f67001"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "GRN recorded. Stock updated and supplier payable created.",
  "data": {
    "poId": "66dc81f2a1b2c3d4e5f70001",
    "poNumber": "PO-20260907-0001",
    "status": "RECEIVED",
    "receivedItems": [
      {
        "variantId": "66dc81f2a1b2c3d4e5f6001a",
        "receivedQty": 200,
        "newStockLevel": 245,
        "updatedWAC": 62.80
      }
    ],
    "supplierDueBalance": 7500.00
  }
}
```

---

## 6. Domain 4: Sales, POS Checkout & Returns

### 6.0 Sales List & Detail Endpoints

| Method | Path | Auth | Permission | Description |
| :--- | :--- | :---: | :--- | :--- |
| `GET` | `/api/v1/sales` | Bearer | `sales:view` | List paginated invoices with date range, cashier, customer, and shift filters. |
| `GET` | `/api/v1/sales/:id` | Bearer | `sales:view` | Fetch single invoice document with all line items, payments, and customer info. |
| `GET` | `/api/v1/vouchers/:code` | Bearer | `pos:checkout` | Validate store credit voucher code and return current balance and status. |

---

### 6.1 `POST /api/v1/sales/checkout`
Executes an atomic POS checkout transaction under MongoDB ACID session.

- **Authentication:** Bearer JWT
- **Mandatory Header:** `Idempotency-Key: <UUID>`
- **Permission:** `pos:checkout` (All Roles)
- **Business Validation Rules:**
  - Multi-pricing: Automatically evaluates `WHOLESALE` vs `RETAIL` price tier based on customer classification.
  - Decrements variant stock atomically. Blocks if stock is insufficient (unless `isOfflineSynced=true`).
  - Updates shift cash sales inflow using net cash tendered minus change returned.
  - Updates customer due balance if debt is incurred (validates `dueAmount + currentDue <= creditLimit`).
  - Redeems store credit voucher atomically (exhausts voucher if balance reaches zero).
  - Posts credit transactions to financial accounts (`accounts` & `account_transactions`).
- **Request Body:**
```json
{
  "shiftId": "66dc81f2a1b2c3d4e5f64001",
  "customerId": "66dc81f2a1b2c3d4e5f65001",
  "pricingTier": "RETAIL",
  "items": [
    {
      "productId": "66dc81f2a1b2c3d4e5f60001",
      "variantId": "66dc81f2a1b2c3d4e5f6001a",
      "productName": "Pran Pasteurized Full Cream Milk",
      "variantName": "1 Liter",
      "sku": "PRAN-MILK-1L",
      "barcode": "8941100123456",
      "quantity": 2,
      "unitCostPrice": 65.00,
      "unitSellingPrice": 80.00,
      "taxRate": 15,
      "taxAmount": 20.87,
      "discount": 0.00,
      "lineTotal": 160.00
    }
  ],
  "subtotal": 139.13,
  "totalTax": 20.87,
  "discountAmount": 10.00,
  "totalAmount": 150.00,
  "paidAmount": 200.00,
  "changeReturned": 50.00,
  "dueAmount": 0.00,
  "payments": [
    {
      "method": "CASH",
      "amount": 200.00,
      "accountId": "66dc81f2a1b2c3d4e5f67001"
    }
  ]
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Sale completed successfully",
  "data": {
    "_id": "66dc81f2a1b2c3d4e5f68001",
    "invoiceNo": "INV-20260908-00042",
    "totalAmount": 150.00,
    "paidAmount": 200.00,
    "changeReturned": 50.00,
    "createdAt": "2026-09-08T18:07:00.000Z"
  }
}
```
- **Error Response `422` (Insufficient Stock):**
```json
{
  "success": false,
  "statusCode": 422,
  "error": {
    "code": "INSUFFICIENT_INVENTORY",
    "message": "Insufficient stock for SKU: PRAN-MILK-1L. Available: 1, Requested: 2",
    "details": [
      { "field": "items[0].quantity", "issue": "Exceeds available stock by 1 unit" }
    ]
  },
  "timestamp": "2026-09-08T18:07:00.000Z"
}
```
- **Error Response `409` (Duplicate Idempotency Key):**
```json
{
  "success": false,
  "statusCode": 409,
  "error": {
    "code": "IDEMPOTENCY_KEY_REPLAY",
    "message": "This Idempotency-Key has already been used. Duplicate checkout request rejected."
  },
  "timestamp": "2026-09-08T18:07:00.000Z"
}
```

---

### 6.2 `POST /api/v1/sales/offline-sync`
Processes batch array of offline buffered sales when internet connectivity is restored.

- **Authentication:** Bearer JWT
- **Permission:** `pos:checkout`
- **Negative Stock Policy (PRD 6.5):** If offline queued sales exceed online inventory, the transaction commits, `variants.currentStock` goes negative, and an `OFFLINE_OVERSELL_WARNING` entry is logged in `audit_logs`.
- **Request Body:**
```json
{
  "sales": [
    {
      "shiftId": "66dc81f2a1b2c3d4e5f64001",
      "customerId": null,
      "pricingTier": "RETAIL",
      "items": [
        {
          "productId": "66dc81f2a1b2c3d4e5f60001",
          "variantId": "66dc81f2a1b2c3d4e5f6001a",
          "productName": "Pran Pasteurized Full Cream Milk",
          "variantName": "1 Liter",
          "sku": "PRAN-MILK-1L",
          "barcode": "8941100123456",
          "quantity": 1,
          "unitCostPrice": 65.00,
          "unitSellingPrice": 80.00,
          "taxRate": 15,
          "taxAmount": 10.43,
          "discount": 0.00,
          "lineTotal": 80.00
        }
      ],
      "subtotal": 69.57,
      "totalTax": 10.43,
      "discountAmount": 0.00,
      "totalAmount": 80.00,
      "paidAmount": 80.00,
      "changeReturned": 0.00,
      "dueAmount": 0.00,
      "payments": [ { "method": "CASH", "amount": 80.00, "accountId": "66dc81f2a1b2c3d4e5f67001" } ],
      "isOfflineSynced": true,
      "idempotencyKey": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    }
  ]
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Offline batch sync completed",
  "data": {
    "totalReceived": 1,
    "processedSuccessfully": 1,
    "failedCount": 0,
    "oversellWarnings": [],
    "invoices": [ "INV-20260908-00043" ]
  }
}
```

---

### 6.3 `GET /api/v1/sales/:id/receipt`
Generates binary ESC/POS thermal command stream (58mm / 80mm) or HTML receipt render.

- **Authentication:** Bearer JWT
- **Query Params:** `format=raw|html`, `paperWidth=58mm|80mm`
- **Response `200 OK`:** ESC/POS Binary Buffer or Receipt HTML.

---

### 6.4 Hold Cart Endpoints (`/api/v1/hold-carts`)

| Method | Path | Auth | Permission | Description |
| :--- | :--- | :---: | :--- | :--- |
| `POST` | `/api/v1/hold-carts` | Bearer | `pos:checkout` | Park active cart session (24h auto-expiry). |
| `GET` | `/api/v1/hold-carts` | Bearer | `pos:checkout` | List held carts for cashier/shift. |
| `GET` | `/api/v1/hold-carts/:id` | Bearer | `pos:checkout` | Fetch held cart details to resume checkout. |
| `DELETE` | `/api/v1/hold-carts/:id` | Bearer | `pos:checkout` | Delete/discard parked cart. |

---

### 6.5 `POST /api/v1/returns`
Processes customer item sales returns and issues refunds or store credit vouchers.

- **Authentication:** Bearer JWT
- **Permission:** Requires Manager Approval (`returns:authorize`)
- **Proportional Refund Rule:** Net refund per line item is computed based on actual net price paid post-invoice discount.
- **Request Body:**
```json
{
  "saleId": "66dc81f2a1b2c3d4e5f68001",
  "originalInvoiceNo": "INV-20260908-00042",
  "customerId": "66dc81f2a1b2c3d4e5f65001",
  "items": [
    {
      "variantId": "66dc81f2a1b2c3d4e5f6001a",
      "quantity": 1,
      "unitRefundPrice": 75.00,
      "isResaleable": true
    }
  ],
  "totalRefundAmount": 75.00,
  "refundType": "STORE_CREDIT",
  "managerPin": "5678",
  "reason": "Customer purchased wrong size carton"
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "statusCode": 201,
  "data": {
    "returnNo": "RET-20260908-00012",
    "totalRefundAmount": 75.00,
    "refundType": "STORE_CREDIT",
    "voucherCode": "CR-9821-X47A",
    "voucherBalance": 75.00
  }
}
```

---

## 7. Domain 5: Shift & Cash Register Auditing

### 7.1 `POST /api/v1/shifts/open`
Opens daily cashier terminal shift with opening float.

- **Authentication:** Bearer JWT
- **Permission:** `shifts:operate`
- **Request Body:**
```json
{
  "terminalId": "COUNTER-01",
  "openingFloat": 5000.00
}
```

---

### 7.2 `POST /api/v1/shifts/petty-cash`
Logs mid-day cash float modifications (Petty Cash In / Cash Drop Out).

- **Authentication:** Bearer JWT
- **Permission:** `shifts:operate`
- **Request Body:**
```json
{
  "shiftId": "66dc81f2a1b2c3d4e5f64001",
  "type": "PETTY_CASH_OUT",
  "amount": 500.00,
  "reason": "Purchased cleaning supplies for shop"
}
```

---

### 7.3 `POST /api/v1/shifts/close`
Closes shift, performs blind cash audit, calculates discrepancy, and enforces Manager signoff if discrepancy $> \$10$.

- **Authentication:** Bearer JWT
- **Permission:** `shifts:operate`
- **Request Body:**
```json
{
  "shiftId": "66dc81f2a1b2c3d4e5f64001",
  "actualCashCounted": 14350.00,
  "managerPin": "5678",
  "notes": "Shortage of $15 due to wrong change handed"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "shiftId": "66dc81f2a1b2c3d4e5f64001",
    "expectedCash": 14365.00,
    "actualCash": 14350.00,
    "discrepancy": -15.00,
    "managerApproved": true,
    "status": "CLOSED"
  }
}
```

---

### 7.4 `GET /api/v1/shifts`
Fetches paginated history of cashier shift sessions.

- **Authentication:** Bearer JWT
- **Permission:** `shifts:view` (Admin, Manager)
- **Query Parameters:** `userId`, `status` (`OPEN|CLOSED`), `terminalId`, `startDate`, `endDate`, `page`, `limit`.

---

### 7.5 `GET /api/v1/shifts/current`
Returns the currently active open shift for the authenticated cashier.

- **Authentication:** Bearer JWT
- **Permission:** `shifts:operate`
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "66dc81f2a1b2c3d4e5f64001",
    "terminalId": "COUNTER-01",
    "openedAt": "2026-09-08T09:00:00.000Z",
    "openingFloat": 5000.00,
    "cashSalesTotal": 14365.00,
    "status": "OPEN"
  }
}
```

---

### 7.6 `GET /api/v1/shifts/:id/z-report`
Generates end-of-day Z-Report summary payload.

- **Authentication:** Bearer JWT
- **Permission:** `shifts:view` / `reports:view`
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "shiftId": "66dc81f2a1b2c3d4e5f64001",
    "terminalId": "COUNTER-01",
    "cashier": "Rahim Uddin",
    "openedAt": "2026-09-08T09:00:00.000Z",
    "closedAt": "2026-09-08T18:00:00.000Z",
    "openingFloat": 5000.00,
    "cashSalesTotal": 9850.00,
    "cardSalesTotal": 3200.00,
    "mfsSalesTotal": 1315.00,
    "pettyCashIn": 0.00,
    "pettyCashOut": 500.00,
    "cashExpensesTotal": 0.00,
    "expectedCash": 14365.00,
    "actualCash": 14350.00,
    "discrepancy": -15.00,
    "totalInvoices": 42,
    "totalItemsSold": 137
  }
}
```

---

## 8. Domain 6: CRM & Customer Credit Ledger

### 8.1 Customer Management Endpoints (`/api/v1/customers`)

| Method | Path | Auth | Permission | Description |
| :--- | :--- | :---: | :--- | :--- |
| `GET` | `/api/v1/customers` | Bearer | `customers:view` | Search customer directory by phone/name; view credit limit and due balance. |
| `POST` | `/api/v1/customers` | Bearer | `customers:create` | Register new retail or wholesale customer. |
| `PUT` | `/api/v1/customers/:id` | Bearer | `customers:manage` | Update customer credit limit or tier status. |
| `GET` | `/api/v1/customers/:id/ledger` | Bearer | `customers:view` | Fetch complete Bakir Khata transaction history. |

---

### 8.2 `POST /api/v1/customers/:id/pay-due`
Processes customer due payment collection. Credits financial account and updates customer ledger debt balance.

- **Authentication:** Bearer JWT
- **Permission:** `customers:pay_due` (Admin, Manager, Staff)
- **Request Body:**
```json
{
  "amountPaid": 2500.00,
  "paymentAccountId": "66dc81f2a1b2c3d4e5f67001",
  "paymentMethod": "CASH",
  "narration": "Partial due payment for August invoice"
}
```

---

## 9. Domain 7: Financial Accounts & Shop Expenses

### 9.1 Financial Accounts Endpoints (`/api/v1/accounts`)

| Method | Path | Auth | Permission | Description |
| :--- | :--- | :---: | :--- | :--- |
| `GET` | `/api/v1/accounts` | Bearer | `accounts:view` (Admin) | List chart of financial accounts (Cash, Bank, MFS wallets). |
| `POST` | `/api/v1/accounts` | Bearer | `accounts:manage` (Admin) | Create financial account. |
| `POST` | `/api/v1/accounts/transfer` | Bearer | `accounts:transfer` (Admin) | Transfer funds between accounts (Single transaction double-entry transfer). |
| `GET` | `/api/v1/accounts/:id/transactions` | Bearer | `accounts:view` (Admin) | View double-entry debit/credit ledger history. |
| `PUT` | `/api/v1/accounts/:id` | Bearer | `accounts:manage` (Admin) | Update account name or status. |

---

### 9.2 `POST /api/v1/expenses`
Logs operational shop expense and debits selected cash/bank account.

- **Authentication:** Bearer JWT
- **Permission:** `expenses:create` (Staff log, Admin/Manager approve)
- **Request Body:**
```json
{
  "categoryId": "66dc81f2a1b2c3d4e5f67501",
  "amount": 1200.00,
  "accountId": "66dc81f2a1b2c3d4e5f67001",
  "description": "Monthly shop electricity bill payment",
  "receiptVoucherUrl": "https://cdn.shop.com/receipts/voucher-991.jpg"
}
```

---

### 9.3 Expense Category Endpoints

| Method | Path | Auth | Permission | Description |
| :--- | :--- | :---: | :--- | :--- |
| `GET` | `/api/v1/expenses/categories` | Bearer | `expenses:view` | List all expense categories. |
| `POST` | `/api/v1/expenses/categories` | Bearer | `expenses:manage` (Admin, Manager) | Create new expense category (e.g. "Shop Rent", "Electricity"). |

---

### 9.4 `GET /api/v1/expenses`
Fetches paginated list of all shop operational expenses.

- **Authentication:** Bearer JWT
- **Permission:** `expenses:view` (Admin, Manager)
- **Query Parameters:** `categoryId`, `accountId`, `startDate`, `endDate`, `page`, `limit`.

---

## 10. Domain 8: Analytics & Materialized Reports

### 10.1 `GET /api/v1/reports/dashboard`
Executive dashboard KPI summary payload (< 100ms SLA).

- **Authentication:** Bearer JWT
- **Permission:** `reports:dashboard` (Admin, Manager)
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "todaySales": 84500.00,
    "todayExpenses": 3200.00,
    "todayNetProfit": 14200.00,
    "activeShiftCashFloat": 15000.00,
    "lowStockItemsCount": 4,
    "pendingCustomerDues": 28400.00,
    "pendingSupplierPayables": 112000.00
  }
}
```

---

### 10.2 BI Report Endpoints Table

| Endpoint Path | Method | Permission | Export Formats | Function |
| :--- | :---: | :--- | :---: | :--- |
| `/api/v1/reports/sales` | `GET` | `reports:sales` | PDF, Excel, JSON | Detailed sales report (by item, cashier, category, tier). |
| `/api/v1/reports/inventory-valuation` | `GET` | `reports:inventory` | PDF, Excel, JSON | Stock valuation report (Cost Price vs Retail Value). |
| `/api/v1/reports/inventory-wastage` | `GET` | `reports:inventory` | PDF, Excel, JSON | Stock wastage & shrinkage report. |
| `/api/v1/reports/purchases` | `GET` | `reports:purchases` | PDF, Excel, JSON | Supplier procurement summary. |
| `/api/v1/reports/customer-aging` | `GET` | `reports:dues` | PDF, Excel, JSON | Customer Bakir Khata due aging breakdown. |
| `/api/v1/reports/supplier-payable` | `GET` | `reports:payables` | PDF, Excel, JSON | Vendor payable aging breakdown. |
| `/api/v1/reports/pnl` | `GET` | `reports:pnl` (Admin) | PDF, Excel, JSON | Double-entry Profit & Loss (P&L) statement. |
| `/api/v1/reports/export` | `GET` | `reports:export` | `.xlsx` / `.pdf` | Generic tabular export trigger. |

---

## 11. Domain 9: System Audit & Shop Settings

### 11.1 `GET /api/v1/audit-logs`
Queries append-only immutable security audit log.

- **Authentication:** Bearer JWT
- **Permission:** `audit:view` (Admin only)
- **Query Params:** `userId`, `entity`, `action`, `startDate`, `endDate`, `page`, `limit`.
- **Response `200 OK`:**
```json
{
  "success": true,
  "statusCode": 200,
  "data": [
    {
      "_id": "66dc81f2a1b2c3d4e5f72001",
      "userId": "66dc81f2a1b2c3d4e5f60003",
      "action": "PRICE_OVERRIDE",
      "entity": "products",
      "entityId": "66dc81f2a1b2c3d4e5f60001",
      "metadata": {
        "before": { "retailSellingPrice": 80.00 },
        "after": { "retailSellingPrice": 75.00 }
      },
      "ipAddress": "192.168.1.50",
      "createdAt": "2026-09-08T15:32:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "totalItems": 1 }
}
```

---

### 11.2 `GET /api/v1/settings` & `PUT /api/v1/settings`
Fetches and updates global shop profile, tax configuration, printer commands, and negative stock controls.

- **Authentication:** Bearer JWT
- **Permission:** `settings:manage` (Admin only)
- **Response `200 OK` (GET):**
```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "shopName": "Al-Amin Mega Retail",
    "shopAddress": "Plot 12, Main Avenue, Dhaka",
    "shopPhone": "+8801700000000",
    "shopEmail": "info@alamintrade.com",
    "currencySymbol": "৳",
    "defaultTaxRate": 15.0,
    "allowNegativeStock": false,
    "thermalPrinterType": "80mm",
    "barcodeLabelFormat": "38mm_x_25mm_2up",
    "cashDrawerTriggerCode": "\\x1B\\x70\\x00\\x19\\xFA",
    "receiptHeader": "Welcome to Al-Amin Mega Retail!",
    "receiptFooter": "Thank you for shopping with us! Standard return policy: 7 days.",
    "updatedAt": "2026-09-08T10:00:00.000Z"
  }
}
```
- **PUT Request Body:**
```json
{
  "shopName": "Al-Amin Mega Retail",
  "shopAddress": "Plot 12, Main Avenue, Dhaka",
  "shopPhone": "+8801700000000",
  "currencySymbol": "৳",
  "defaultTaxRate": 15.0,
  "allowNegativeStock": false,
  "thermalPrinterType": "80mm",
  "barcodeLabelFormat": "38mm_x_25mm_2up",
  "cashDrawerTriggerCode": "\\x1B\\x70\\x00\\x19\\xFA",
  "receiptHeader": "Welcome to Al-Amin Mega Retail!",
  "receiptFooter": "Thank you for shopping with us! Standard return policy: 7 days."
}
```

---
*Note: This document completes the exhaustive REST API Specification for the Cloud-Based POS & Shop Management System.*
