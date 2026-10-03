# Point of Sale (POS) - SaaS & Licensing Architecture Plan

This document provides a detailed plan for converting the Point of Sale software into a Multi-Company (SaaS) model and integrating a licensing/payment system.

## 1. Multi-Tenancy Architecture
Since you will be selling the software to multiple companies, there must be a core entity named "Organization" or "Company" in the database.

**New Database Tables/Models:**
- `organizations`: (id, name, contact_email, phone, address, subscription_end_date, is_active)
- New fields in `users` table: `organization_id`, `role` (Super Admin, Org Admin, Manager, Cashier)
- An `organization_id` field must be added to all other tables (products, sales, customers, etc.) so that one company cannot see another company's data.

## 2. User Roles
1. **Super Admin (Software Owner):**
   - Will not be under any specific Organization.
   - Can view and manage all Organizations.
   - Can create new Organizations and assign their first Admin.
   - Can generate and manage License Keys.
2. **Organization Admin:**
   - Can only view and manage their own Organization's data.
   - Can create new users (Cashier/Manager) for their own company.
3. **Staff/Cashier:**
   - Can only perform sales and regular tasks.

## 3. Subscription and License Locking Mechanism
- **Checking System:** A Middleware must be created in the backend that will check before every API request if the logged-in user's Organization's `subscription_end_date` has expired.
- **Locking:** When the subscription expires, the Middleware will send a specific error (e.g., 402 Payment Required). Upon receiving this error, the frontend will redirect the user to a "Software Locked" page.
- **License Key Generation:** There will be an option in the Super Admin panel to generate a Unique License Key (e.g., `POS-XYZ123-30DAYS`) for a specific Organization after receiving payment. This key will be associated with the number of days the subscription will be extended.
- **Unlocking:** When the Organization Admin inputs that key on the Locked page, the backend will verify it. If verification is successful, the `subscription_end_date` will be updated, and the software will be operational again.

## 4. Implementation Steps
1. **Step 1:** Update the Database Schema. Create the `organizations` table and add `organization_id` to other tables.
2. **Step 2:** Create a Multi-tenancy Middleware in the backend that will filter data according to the logged-in user's `organization_id`.
3. **Step 3:** Update Role-based Access Control (RBAC) to separate the permissions of Super Admin and Org Admin.
4. **Step 4:** Create the License Management table and Subscription checking Middleware.
5. **Step 5:** Create the Super Admin Dashboard in the frontend (Company Management & License Key Generation).
6. **Step 6:** Create the "Software Locked / Payment Due" page and License Key submission form in the frontend.

---
**Ready to start development?**
If you approve this plan, we can start working from 'Step 1' (Database Update).
