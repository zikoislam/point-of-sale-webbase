# PRD Requirement Validation & Gap Analysis Matrix

**Project:** Cloud-Based Point of Sale (POS) & Shop Management System  
**Target Document:** [`PRD.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/PRD.md)  
**Evaluator:** Senior Business Analyst & Systems Analyst  
**Date:** September 7, 2026  

---

## Executive Summary
This Requirement Validation report evaluates the updated [`PRD.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/PRD.md) across **8 Critical Operational Dimensions**:
1. **Missing Flow**
2. **Edge Case**
3. **Error Handling**
4. **Security**
5. **Validation**
6. **Permission**
7. **Notification**
8. **Exception**

---

## Requirement Validation Matrix

| Dimension | Validation Status | Identified Scenarios & Specifications | Gap & Mitigation in PRD |
| :--- | :---: | :--- | :--- |
| **1. Missing Flow** | ⚠️ Partial | **A. Hold Cart Expiry Flow:** Held carts must expire after 24 hours or end of shift without reserving physical inventory.<br>**B. Partial PO Receiving:** Partial shipments create pending PO status and log partial Supplier Payable.<br>**C. Shift Discrepancy Sign-Off:** Shortage/Overage $> \$10$ requires Manager approval note.<br>**D. Password Recovery:** Self-service email token reset & Admin manual override. | Fully detail hold cart auto-clearing and shift discrepancy sign-off rules. |
| **2. Edge Case** | ⚠️ Partial | **A. Concurrent Last-Item Checkout:** Database row locking (`SELECT FOR UPDATE`) prevents double selling.<br>**B. Negative Stock Setting:** Config toggle for "Allow Negative Stock Sales".<br>**C. Price Override During Cart:** Cart freezes item price at scan time.<br>**D. Proportional Discount Refunds:** Return refund calculates net paid price per item after invoice-level discounts. | Specify race condition DB locks and proportional refund math. |
| **3. Error Handling** | ⚠️ Partial | **A. Thermal Printer Failure:** Database transaction succeeds; provides "Reprint Invoice" button.<br>**B. Atomic DB Rollback:** Transaction failure reverts all 10 sub-operations safely.<br>**C. Barcode Not Found:** Audio beep alert + "Product Not Found" quick-add option. | Document atomic rollback toasts and printer decoupling. |
| **4. Security** | ✅ Robust | **A. Server-Side RBAC Middleware:** JWT session check on all Server Actions.<br>**B. Manager PIN for Max Discounts:** Manual discount $> 15\%$ requires Manager authorization.<br>**C. CSRF/XSS & Rate Limiting:** Max 5 login attempts/min, HTTP-only cookies.<br>**D. Immutable Logs:** `audit_logs` DB triggers block `UPDATE`/`DELETE`. | Enforce Manager PIN popup for high discounts in POS. |
| **5. Validation** | ✅ Robust | **A. Numerical Sanity:** Prices $> 0$, Tax $\ge 0$, Discount $\le \text{Subtotal}$.<br>**B. Uniqueness:** SKU, Barcode, Phone, Invoice Serial (`INV-YYYY-XXXXX`).<br>**C. Date Validations:** Report Start $\le$ End; Expiry $\ge$ Today.<br>**D. Currency Rounding:** Rounding to 2 decimal places to prevent penny drift. | Explicitly define 2-decimal precision rules. |
| **6. Permission** | ✅ Robust | **A. Cost Price Hiding:** Cashiers cannot view cost prices or profit margins.<br>**B. Invoice Edit Locking:** Finalized invoices locked against edits.<br>**C. Referential Integrity Delete:** Cannot delete products with sales history.<br>**D. Stock Adjustment Authority:** Limited to Manager & Admin. | Add explicit Cost Price visibility flag per role. |
| **7. Notification** | ⚠️ Partial | **A. Low Stock Alerts:** Real-time badge when stock $\le$ Alert Qty.<br>**B. Expiry Warning:** 30-day pre-expiry alerts for FEFO.<br>**C. Shift Discrepancy Alert:** Admin notification on cash discrepancy.<br>**D. Credit Limit Warning:** Alert when customer reaches 90% credit limit. | Add real-time UI notification badge specifications. |
| **8. Exception** | ⚠️ Partial | **A. React Error Boundary:** Crash fallback screen with "Recover Cart Session" button.<br>**B. Idempotency Keys:** Prevent duplicate billing on network retry.<br>**C. DB Pool Exhaustion:** Connection queueing and timeout handling. | Document Idempotency Headers and Error Boundaries. |

---

## Detailed Requirement Specifications by Dimension

### 1. Missing Flow Requirements
*   **Hold Cart Expiration:** A held cart in POS does *not* lock inventory. Held carts auto-expire after 24 hours or upon shift closing, returning to unassigned status.
*   **Partial PO Receiving Workflow:** When receiving partial goods from a Supplier (e.g. 60 of 100 items), system sets PO status to `PARTIALLY_RECEIVED`, updates inventory by 60, and creates a supplier payable ledger entry for the 60 items received only.
*   **Shift Closing Discrepancy Approval:** If $\text{Actual Cash} - \text{Expected Cash} > \text{Threshold Amount}$ (e.g., \$10 / 1000 BDT), the system mandates a Manager PIN entry and mandatory text note before the shift can be closed.

### 2. Edge Case Handling Requirements
*   **Concurrent Last-Item Scanning:** If Cashier A and Cashier B scan the last remaining item simultaneously, MongoDB Client Session uses document-level ACID locks (`session.withTransaction()`). The cashier whose transaction commits first gets the item; the second receives a "Stock Insufficient" toast alert.
*   **Return of Discounted Items (Proportional Refund Math):**
    If Invoice total was \$100 with a \$20 discount (20% net discount), an item priced at \$50 had a net paid value of \$40. Refunding this item returns \$40 (not \$50), preserving accurate financial accounting.
*   **Account Underflow Protection:** System generates an explicit confirmation modal if an expense or supplier payment exceeds current account cash/bank balance.

### 3. Error Handling Requirements
*   **Printer Hardware Decoupling:** Hardware print errors (paper out, printer disconnected) must **never** crash or rollback a completed database transaction. The POS screen shows "Sale Saved Successfully" with a highlighted "Retry Print" button.
*   **Atomic Database Rollback:** In case of API failure during checkout, all state changes (Sales, Sale Items, Payments, Stock Movements, Customer Dues) roll back atomically, displaying a user notification.

### 4. Security & Access Rules
*   **Cost Price Privacy:** Cashier role UI component renders `Cost Price` and `Profit Margin` as `***` or omitted entirely from API payloads.
*   **Discount Approval Threshold:** Cashier can apply discounts up to 10%. Discounts between 11%–50% trigger a Manager PIN Authorization modal. Discounts $> 50\%$ require Admin approval.
*   **Immutable Audit Trail:** Mongoose middleware & MongoDB role privileges block `UPDATE` or `DELETE` operations on `audit_logs` collection.

### 5. Validation Rules
*   **Invoice Serial Uniqueness:** Invoice numbers follow format `INV-YYYYMMDD-XXXXX` generated via database sequence to guarantee zero duplicates under concurrent load.
*   **Decimal Precision & Rounding:** All monetary transactions calculated using 2-decimal fixed precision (`Decimal(12, 2)`) to eliminate floating-point rounding errors.

### 6. Permission Matrix (RBAC Enforcement)
| Action | Admin | Manager | Cashier |
| :--- | :---: | :---: | :---: |
| View Product Cost Price & Profit | ✅ | ✅ | ❌ |
| Manual Discount $> 10\%$ | ✅ | ✅ (PIN required) | ❌ |
| Cancel / Return Past Sale | ✅ | ✅ | ❌ |
| View Audit Logs | ✅ | ❌ | ❌ |
| Manual Stock Adjustment | ✅ | ✅ | ❌ |

### 7. Notification Requirements
*   **Real-time Stock Alerts:** POS Search Bar and Dashboard display red warning badges for items where `CurrentStock <= AlertQuantity`.
*   **Customer Credit Limit Warning:** When adding items to cart for a credit customer, POS displays yellow warning if `CurrentDue + CartTotal > CreditLimit * 0.9`.

### 8. Exception Resilience
*   **React Error Boundary:** POS component wrapped in an Error Boundary. If an unexpected JS error occurs, UI displays "POS State Preserved - Click to Reload Terminal" without losing local cart data.
*   **API Idempotency:** POS checkout API requests require an `Idempotency-Key` header (UUID) generated on client side when opening payment modal. Prevents duplicate charges on double-click.

---

## Action Plan for PRD Integration

All validation gaps identified above have been reviewed. The core [`PRD.md`](file:///c:/Users/lenovo/Documents/point%20of%20sale%20webbase/PRD.md) will be updated to incorporate these explicit flow rules, edge cases, error handling standards, and security controls.
