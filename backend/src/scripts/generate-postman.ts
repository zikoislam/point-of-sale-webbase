import fs from 'fs';
import path from 'path';

interface PostmanHeader {
  key: string;
  value: string;
  type?: string;
  disabled?: boolean;
}

interface PostmanUrl {
  raw: string;
  host: string[];
  path: string[];
  query?: { key: string; value: string; description?: string }[];
}

interface PostmanItem {
  name: string;
  event?: any[];
  request: {
    auth?: any;
    method: string;
    header: PostmanHeader[];
    body?: {
      mode: 'raw';
      raw: string;
      options?: { raw: { language: 'json' } };
    };
    url: PostmanUrl;
    description?: string;
  };
  response?: any[];
}

interface PostmanFolder {
  name: string;
  description?: string;
  item: (PostmanItem | PostmanFolder)[];
}

const buildUrl = (rawPath: string, queryParams: { key: string; value: string; description?: string }[] = []): PostmanUrl => {
  const cleanPath = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
  const pathSegments = cleanPath.split('/').filter(Boolean);
  
  let fullRaw = `{{baseUrl}}/${cleanPath}`;
  if (queryParams.length > 0) {
    const qStr = queryParams.map(q => `${q.key}=${encodeURIComponent(q.value)}`).join('&');
    fullRaw += `?${qStr}`;
  }

  return {
    raw: fullRaw,
    host: ['{{baseUrl}}'],
    path: pathSegments,
    query: queryParams.length > 0 ? queryParams : undefined,
  };
};

const jsonBody = (data: any) => ({
  mode: 'raw' as const,
  raw: JSON.stringify(data, null, 2),
  options: { raw: { language: 'json' as const } },
});

const defaultHeaders: PostmanHeader[] = [
  { key: 'Content-Type', value: 'application/json', type: 'text' },
];

const loginTestScript = [
  {
    listen: 'test',
    script: {
      exec: [
        'if (pm.response.code === 200) {',
        '    var res = pm.response.json();',
        '    if (res && res.data && res.data.token) {',
        '        pm.environment.set("token", res.data.token);',
        '        console.log("✅ Token successfully saved to environment: " + res.data.token.substring(0, 20) + "...");',
        '    }',
        '}',
      ],
      type: 'text/javascript',
    },
  },
];

const collection = {
  info: {
    _postman_id: 'pos-cloud-system-api-v1',
    name: 'POS & Shop Management System API',
    description: 'Complete API collection for Enterprise Cloud-Based POS & Shop Management System.\nIncludes automated Bearer Token handling, comprehensive CRUD operations, Cashier Shifts, POS Checkout, GRN, and Analytics.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: {
    type: 'bearer',
    bearer: [
      {
        key: 'token',
        value: '{{token}}',
        type: 'string',
      },
    ],
  },
  item: [
    // 01. System & Health
    {
      name: '01. System & Health',
      description: 'System health check and diagnostic endpoints',
      item: [
        {
          name: 'Health Check',
          request: {
            auth: { type: 'noauth' },
            method: 'GET',
            header: [],
            url: buildUrl('health'),
            description: 'Check if backend server is online and operational.',
          },
        },
      ],
    },

    // 02. Authentication
    {
      name: '02. Authentication (Auth)',
      description: 'User login, logout, terminal locking and profile inspection.',
      item: [
        {
          name: '1. Admin Login (Auto Token Save)',
          event: loginTestScript,
          request: {
            auth: { type: 'noauth' },
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              username: '{{admin_username}}',
              password: '{{admin_password}}',
              rememberMe: true,
            }),
            url: buildUrl('auth/login'),
            description: 'Logs in as Admin. The Postman test script automatically captures and saves the JWT token into the active environment variable `token`.',
          },
        },
        {
          name: '2. Cashier Login (Auto Token Save)',
          event: loginTestScript,
          request: {
            auth: { type: 'noauth' },
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              username: '{{cashier_username}}',
              password: '{{cashier_password}}',
              rememberMe: false,
            }),
            url: buildUrl('auth/login'),
            description: 'Logs in as Staff Cashier and automatically stores token.',
          },
        },
        {
          name: '3. Get Current User Profile (Me)',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('auth/me'),
            description: 'Returns profile details and permissions for the currently authenticated session.',
          },
        },
        {
          name: '4. Lock Terminal',
          request: {
            method: 'POST',
            header: defaultHeaders,
            url: buildUrl('auth/lock-terminal'),
            description: 'Locks POS screen for security.',
          },
        },
        {
          name: '5. Unlock Terminal',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              pin: '{{admin_pin}}',
            }),
            url: buildUrl('auth/unlock-terminal'),
            description: 'Unlocks POS screen with 4-digit PIN.',
          },
        },
        {
          name: '6. Logout',
          request: {
            method: 'POST',
            header: defaultHeaders,
            url: buildUrl('auth/logout'),
            description: 'Invalidates session token and clears auth cookie.',
          },
        },
      ],
    },

    // 03. Users & Staff
    {
      name: '03. Users & Staff Management',
      description: 'CRUD operations for staff, cashiers, and administrators.',
      item: [
        {
          name: '1. List All Users',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('users'),
            description: 'Retrieve all users with roles.',
          },
        },
        {
          name: '2. Create New User',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              username: 'staff_kamal',
              fullName: 'Kamal Hossain',
              email: 'kamal@superpos.com',
              phone: '+8801700998877',
              password: 'Password@123',
              pin: '5566',
              roleId: '{{role_id}}',
            }),
            url: buildUrl('users'),
            description: 'Create a new staff user with designated role.',
          },
        },
        {
          name: '3. Get User By ID',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('users/{{user_id}}'),
            description: 'Fetch specific user details.',
          },
        },
        {
          name: '4. Update User',
          request: {
            method: 'PUT',
            header: defaultHeaders,
            body: jsonBody({
              fullName: 'Kamal Hossain Updated',
              phone: '+8801700998877',
              isActive: true,
            }),
            url: buildUrl('users/{{user_id}}'),
            description: 'Update user profile details.',
          },
        },
        {
          name: '5. Update User PIN',
          request: {
            method: 'PATCH',
            header: defaultHeaders,
            body: jsonBody({
              pin: '9988',
            }),
            url: buildUrl('users/{{user_id}}/pin'),
            description: 'Update quick terminal unlock 4-digit PIN.',
          },
        },
        {
          name: '6. Deactivate User',
          request: {
            method: 'DELETE',
            header: defaultHeaders,
            url: buildUrl('users/{{user_id}}'),
            description: 'Soft delete / deactivate a staff user.',
          },
        },
      ],
    },

    // 04. Roles & Permissions
    {
      name: '04. Roles & Permissions',
      description: 'Manage RBAC security roles and system permissions.',
      item: [
        {
          name: '1. List Roles',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('roles'),
            description: 'List all existing security roles.',
          },
        },
        {
          name: '2. Get All System Permissions',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('roles/permissions'),
            description: 'List all permission keys available in the system.',
          },
        },
        {
          name: '3. Create Custom Role',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              name: 'INVENTORY_OFFICER',
              description: 'Stock management, purchase receiving & wastage adjustment',
              permissions: ['inv:view', 'inv:manage', 'inv:adjust', 'procurement:view', 'procurement:receive'],
            }),
            url: buildUrl('roles'),
            description: 'Define a new custom role with granular permissions.',
          },
        },
        {
          name: '4. Update Role',
          request: {
            method: 'PUT',
            header: defaultHeaders,
            body: jsonBody({
              description: 'Updated role description',
              permissions: ['inv:view', 'inv:manage', 'inv:adjust'],
            }),
            url: buildUrl('roles/{{role_id}}'),
            description: 'Modify permissions for an existing role.',
          },
        },
      ],
    },

    // 05. Categories & Brands
    {
      name: '05. Categories & Brands',
      description: 'Organize product catalog into hierarchical categories and manufacturer brands.',
      item: [
        {
          name: '1. List Categories',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('categories'),
            description: 'List all product categories.',
          },
        },
        {
          name: '2. Create Category',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              name: 'Frozen Foods',
              code: 'FROZEN',
              defaultTaxRate: 5,
              description: 'Frozen meat, fish, and snacks',
            }),
            url: buildUrl('categories'),
            description: 'Add a new product category.',
          },
        },
        {
          name: '3. Update Category',
          request: {
            method: 'PUT',
            header: defaultHeaders,
            body: jsonBody({
              name: 'Frozen & Chilled Foods',
              defaultTaxRate: 5,
            }),
            url: buildUrl('categories/{{category_id}}'),
            description: 'Update category info.',
          },
        },
        {
          name: '4. Delete Category',
          request: {
            method: 'DELETE',
            header: defaultHeaders,
            url: buildUrl('categories/{{category_id}}'),
            description: 'Remove a category.',
          },
        },
        {
          name: '5. List Brands',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('brands'),
            description: 'List all registered brands.',
          },
        },
        {
          name: '6. Create Brand',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              name: 'Kazi Farms',
              originCountry: 'Bangladesh',
            }),
            url: buildUrl('brands'),
            description: 'Create a brand entry.',
          },
        },
        {
          name: '7. Update Brand',
          request: {
            method: 'PUT',
            header: defaultHeaders,
            body: jsonBody({
              name: 'Kazi Farms Kitchen',
              originCountry: 'Bangladesh',
            }),
            url: buildUrl('brands/{{brand_id}}'),
            description: 'Update brand info.',
          },
        },
        {
          name: '8. Delete Brand',
          request: {
            method: 'DELETE',
            header: defaultHeaders,
            url: buildUrl('brands/{{brand_id}}'),
            description: 'Delete brand.',
          },
        },
      ],
    },

    // 06. Products & Catalog
    {
      name: '06. Products & Catalog',
      description: 'Manage master items, multi-attribute variants, barcodes, pricing, and stock on hand.',
      item: [
        {
          name: '1. List Products (with Search & Pagination)',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('products', [
              { key: 'page', value: '1' },
              { key: 'limit', value: '20' },
              { key: 'search', value: '' },
            ]),
            description: 'Fetch paginated products catalog.',
          },
        },
        {
          name: '2. Lookup Product By Barcode',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('products/barcode/{{barcode}}'),
            description: 'Scan or search product by EAN/Code-128 barcode.',
          },
        },
        {
          name: '3. Get Product By ID',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('products/{{product_id}}'),
            description: 'Fetch full product details and all variants.',
          },
        },
        {
          name: '4. Create Product (with Variants & Batches)',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              name: 'Fresh Dairy Milk',
              categoryId: '{{category_id}}',
              brandId: '{{brand_id}}',
              supplierId: '{{supplier_id}}',
              unit: 'Ltr',
              taxType: 'INCLUSIVE',
              taxRate: 5,
              variants: [
                {
                  sku: 'SKU-FDM-1000ML',
                  barcode: '8941199000011',
                  attributeName: '1 Liter Bottle',
                  costPrice: 80.0,
                  retailSellingPrice: 95.0,
                  wholesaleSellingPrice: 88.0,
                  currentStock: 50,
                  alertQty: 10,
                  batches: [
                    {
                      batchNo: 'BAT-2026-FDM01',
                      costPrice: 80.0,
                      quantity: 50,
                      expiryDate: '2026-10-15T00:00:00.000Z',
                    },
                  ],
                  isAvailable: true,
                },
              ],
              isActive: true,
            }),
            url: buildUrl('products'),
            description: 'Add new product with multi-tier pricing and initial inventory.',
          },
        },
        {
          name: '5. Update Product',
          request: {
            method: 'PUT',
            header: defaultHeaders,
            body: jsonBody({
              name: 'Fresh Dairy Milk Premium',
              taxRate: 5,
              isActive: true,
            }),
            url: buildUrl('products/{{product_id}}'),
            description: 'Update product information.',
          },
        },
        {
          name: '6. Delete Product',
          request: {
            method: 'DELETE',
            header: defaultHeaders,
            url: buildUrl('products/{{product_id}}'),
            description: 'Soft delete or remove product.',
          },
        },
      ],
    },

    // 07. Customers & CRM
    {
      name: '07. Customers & CRM',
      description: 'Customer profiles, credit limits, loyalty points, and receivables ledgers.',
      item: [
        {
          name: '1. List Customers',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('customers', [
              { key: 'page', value: '1' },
              { key: 'limit', value: '20' },
              { key: 'search', value: '' },
            ]),
            description: 'List all customer accounts.',
          },
        },
        {
          name: '2. Create Customer',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              name: 'Hasan Mahmud',
              phone: '+8801811223344',
              email: 'hasan@example.com',
              creditLimit: 15000,
              address: 'Dhanmondi, Dhaka',
            }),
            url: buildUrl('customers'),
            description: 'Register a new retail or trade customer.',
          },
        },
        {
          name: '3. Get Customer By ID',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('customers/{{customer_id}}'),
            description: 'View customer balance and profile.',
          },
        },
        {
          name: '4. Update Customer',
          request: {
            method: 'PUT',
            header: defaultHeaders,
            body: jsonBody({
              name: 'Hasan Mahmud (VIP)',
              creditLimit: 25000,
            }),
            url: buildUrl('customers/{{customer_id}}'),
            description: 'Update credit limit or contact info.',
          },
        },
        {
          name: '5. Get Customer Ledger History',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('customers/{{customer_id}}/ledger', [
              { key: 'page', value: '1' },
              { key: 'limit', value: '30' },
            ]),
            description: 'Audit statement of all sales, payments, and running balance.',
          },
        },
        {
          name: '6. Collect Customer Due Payment',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              amount: 500,
              paymentMethod: 'CASH',
              notes: 'Customer cleared partial due at counter',
            }),
            url: buildUrl('customers/{{customer_id}}/pay-due'),
            description: 'Record customer due collection and automatically update ledger & till.',
          },
        },
        {
          name: '7. Delete Customer',
          request: {
            method: 'DELETE',
            header: defaultHeaders,
            url: buildUrl('customers/{{customer_id}}'),
            description: 'Deactivate customer account.',
          },
        },
      ],
    },

    // 08. Suppliers & Vendors
    {
      name: '08. Suppliers & Vendors',
      description: 'Vendor master data, procurement balance, and payment disbursals.',
      item: [
        {
          name: '1. List Suppliers',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('suppliers'),
            description: 'Retrieve all registered suppliers.',
          },
        },
        {
          name: '2. Create Supplier',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              companyName: 'Akij Food & Beverage Ltd',
              contactPerson: 'Tanvir Ahmed',
              phone: '+8801711223344',
              email: 'tanvir@akij.net',
              address: 'Tejgaon I/A, Dhaka',
            }),
            url: buildUrl('suppliers'),
            description: 'Create new vendor account.',
          },
        },
        {
          name: '3. Get Supplier By ID',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('suppliers/{{supplier_id}}'),
            description: 'Get supplier profile and payable balance.',
          },
        },
        {
          name: '4. Update Supplier',
          request: {
            method: 'PUT',
            header: defaultHeaders,
            body: jsonBody({
              contactPerson: 'Tanvir Ahmed (Key Account Manager)',
              phone: '+8801711223344',
            }),
            url: buildUrl('suppliers/{{supplier_id}}'),
            description: 'Update vendor profile.',
          },
        },
        {
          name: '5. Get Supplier Ledger',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('suppliers/{{supplier_id}}/ledger', [
              { key: 'page', value: '1' },
              { key: 'limit', value: '30' },
            ]),
            description: 'Audit log of GRN receipts, payments, and outstanding balances.',
          },
        },
        {
          name: '6. Disburse Supplier Due Payment',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              amount: 5000,
              accountId: '{{account_id}}',
              notes: 'Partial payment against invoice',
            }),
            url: buildUrl('suppliers/{{supplier_id}}/pay-due'),
            description: 'Pay vendor from bank/cash account.',
          },
        },
        {
          name: '7. Delete Supplier',
          request: {
            method: 'DELETE',
            header: defaultHeaders,
            url: buildUrl('suppliers/{{supplier_id}}'),
            description: 'Delete or deactivate supplier.',
          },
        },
      ],
    },

    // 09. Procurement (PO & GRN)
    {
      name: '09. Procurement (PO & GRN)',
      description: 'Purchase orders, status workflows, and Goods Received Note (GRN) processing.',
      item: [
        {
          name: '1. List Purchase Orders',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('purchase-orders', [
              { key: 'page', value: '1' },
              { key: 'limit', value: '20' },
            ]),
            description: 'List all purchase orders.',
          },
        },
        {
          name: '2. Create Purchase Order',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              supplierId: '{{supplier_id}}',
              items: [
                {
                  variantId: '{{variant_id}}',
                  productName: 'Aarong Milk 1L',
                  sku: 'SKU-AARONG-MILK-1000ML',
                  orderedQty: 50,
                  unitCost: 82.0,
                },
              ],
              shippingCost: 150,
              notes: 'Weekly store replenishment',
            }),
            url: buildUrl('purchase-orders'),
            description: 'Generate a new PO in DRAFT status.',
          },
        },
        {
          name: '3. Get Purchase Order By ID',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('purchase-orders/{{purchase_order_id}}'),
            description: 'Fetch PO details.',
          },
        },
        {
          name: '4. Update PO Status (Approve / Order / Cancel)',
          request: {
            method: 'PATCH',
            header: defaultHeaders,
            body: jsonBody({
              status: 'APPROVED',
            }),
            url: buildUrl('purchase-orders/{{purchase_order_id}}/status'),
            description: 'Change PO workflow status.',
          },
        },
        {
          name: '5. Receive Goods (GRN)',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              vendorInvoiceNo: 'INV-AARONG-8821',
              items: [
                {
                  variantId: '{{variant_id}}',
                  receivedQty: 50,
                  unitCost: 82.0,
                  batchNo: 'BAT-202609-GRN01',
                  expiryDate: '2026-10-30T00:00:00.000Z',
                },
              ],
              paidNow: 2000,
              notes: 'Received in good condition, rest on 15 days credit',
            }),
            url: buildUrl('purchase-orders/{{purchase_order_id}}/grn'),
            description: 'Record physical inventory arrival, update stocks, batches, and supplier balance.',
          },
        },
      ],
    },

    // 10. Cashier Shifts & Cash Drawer
    {
      name: '10. Cashier Shifts & Till',
      description: 'Cash drawer shifts, float tracking, petty cash, and daily Z-Reports.',
      item: [
        {
          name: '1. Get Active Shift',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('shifts/active'),
            description: 'Check if current cashier has an open till session.',
          },
        },
        {
          name: '2. Open Shift (Start Till)',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              openingFloat: 1000,
              terminalId: 'COUNTER-01',
              notes: 'Morning shift opening float',
            }),
            url: buildUrl('shifts/open'),
            description: 'Open a new till with initial opening cash.',
          },
        },
        {
          name: '3. List Shifts',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('shifts'),
            description: 'List shift sessions history.',
          },
        },
        {
          name: '4. Record Petty Cash (In / Out)',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              type: 'OUT',
              amount: 120,
              reason: 'Purchased emergency cleaning supplies',
            }),
            url: buildUrl('shifts/{{shift_id}}/petty-cash'),
            description: 'Record petty cash withdrawal or injection from the drawer.',
          },
        },
        {
          name: '5. Close Shift (Reconciliation)',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              actualCash: 3500,
              notes: 'Drawer counted and reconciled',
            }),
            url: buildUrl('shifts/{{shift_id}}/close'),
            description: 'End shift, record physical cash count and calculate discrepancy.',
          },
        },
        {
          name: '6. Get Shift Z-Report',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('shifts/{{shift_id}}/z-report'),
            description: 'Get comprehensive financial Z-Report for audit and print.',
          },
        },
      ],
    },

    // 11. Point of Sale (POS) & Billing
    {
      name: '11. Point of Sale (POS) & Billing',
      description: 'Checkout, multi-payment tenders, split bills, cart hold/resume, and thermal printing.',
      item: [
        {
          name: '1. Checkout Sale (Complete Bill)',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              customerId: '{{customer_id}}',
              pricingTier: 'RETAIL',
              items: [
                {
                  variantId: '{{variant_id}}',
                  quantity: 2,
                  unitSellingPrice: 95.0,
                  taxRate: 5,
                  discount: 0,
                },
              ],
              discountAmount: 0,
              payments: [
                {
                  method: 'CASH',
                  amount: 200,
                },
              ],
              changeReturned: 10,
            }),
            url: buildUrl('sales/checkout'),
            description: 'Complete sale invoice, deduct inventory stock via FEFO/FIFO, and record payment.',
          },
        },
        {
          name: '2. List Hold Carts',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('sales/hold-carts'),
            description: 'List parked or held customer carts.',
          },
        },
        {
          name: '3. Hold Current Cart',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              cartLabel: 'Customer Hasan (Shopping)',
              pricingTier: 'RETAIL',
              items: [
                {
                  variantId: '{{variant_id}}',
                  quantity: 1,
                  unitSellingPrice: 95.0,
                },
              ],
              notes: 'Customer left to pick up another item',
            }),
            url: buildUrl('sales/hold-cart'),
            description: 'Temporarily park a cart without completing sale.',
          },
        },
        {
          name: '4. Resume Held Cart',
          request: {
            method: 'POST',
            header: defaultHeaders,
            url: buildUrl('sales/hold-cart/{{hold_cart_id}}/resume'),
            description: 'Load parked cart back to terminal.',
          },
        },
        {
          name: '5. Discard Held Cart',
          request: {
            method: 'DELETE',
            header: defaultHeaders,
            url: buildUrl('sales/hold-cart/{{hold_cart_id}}'),
            description: 'Delete an abandoned held cart.',
          },
        },
        {
          name: '6. Get Sale By Invoice Number',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('sales/{{invoice_no}}'),
            description: 'Fetch sale transaction details by invoice number.',
          },
        },
        {
          name: '7. Get Receipt (HTML / Thermal Print)',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('sales/{{invoice_no}}/receipt', [
              { key: 'format', value: 'html' },
              { key: 'paperWidth', value: '80mm' },
            ]),
            description: 'Formatted receipt output for 80mm or 58mm thermal printers.',
          },
        },
      ],
    },

    // 12. Sales Returns & Vouchers
    {
      name: '12. Sales Returns & Vouchers',
      description: 'Item return handling, restocking conditions, and store credit voucher issuance.',
      item: [
        {
          name: '1. List Sales Returns',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('returns', [
              { key: 'page', value: '1' },
              { key: 'limit', value: '20' },
            ]),
            description: 'List all processed return transactions.',
          },
        },
        {
          name: '2. Process Return (Store Credit / Cash Refund)',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              saleId: '{{sale_id}}',
              items: [
                {
                  variantId: '{{variant_id}}',
                  quantity: 1,
                  unitRefundPrice: 95.0,
                  isResaleable: true,
                },
              ],
              refundType: 'STORE_CREDIT',
              reason: 'Customer purchased incorrect pack size',
            }),
            url: buildUrl('returns'),
            description: 'Process return, optionally restock item, and generate credit voucher.',
          },
        },
        {
          name: '3. Get Return Details By ID',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('returns/{{return_id}}'),
            description: 'Fetch return record details.',
          },
        },
        {
          name: '4. Validate Store Credit Voucher',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('returns/voucher/{{voucher_code}}'),
            description: 'Validate voucher code and remaining balance during checkout.',
          },
        },
      ],
    },

    // 13. Accounts & Banking
    {
      name: '13. Accounts & Banking',
      description: 'Cash, Bank, and Mobile Money (bKash/Nagad) accounts & inter-account transfers.',
      item: [
        {
          name: '1. List Accounts',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('accounts'),
            description: 'List all financial cash, bank, and MFS accounts.',
          },
        },
        {
          name: '2. Create Financial Account',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              name: 'bKash Merchant Wallet',
              accountType: 'MFS',
              accountNumber: '01700112233',
              initialBalance: 15000,
            }),
            url: buildUrl('accounts'),
            description: 'Add a new bank or wallet account.',
          },
        },
        {
          name: '3. Get Account By ID',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('accounts/{{account_id}}'),
            description: 'Get account balance and details.',
          },
        },
        {
          name: '4. Get Account Ledger',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('accounts/{{account_id}}/ledger'),
            description: 'View full debit/credit history of this account.',
          },
        },
        {
          name: '5. Transfer Funds Between Accounts',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              fromAccountId: '{{account_id}}',
              toAccountId: '{{to_account_id}}',
              amount: 2500,
              description: 'Transfer counter cash deposit to bank account',
            }),
            url: buildUrl('accounts/transfer'),
            description: 'Transfer money from one account to another.',
          },
        },
      ],
    },

    // 14. Expense Management
    {
      name: '14. Expense Management',
      description: 'Store operating expenses, utility bills, maintenance, and expense categories.',
      item: [
        {
          name: '1. List Expense Categories',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('expenses/categories'),
            description: 'List all expense heads/categories.',
          },
        },
        {
          name: '2. Create Expense Category',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              name: 'Store Utilities & Power',
              code: 'UTIL_POWER',
            }),
            url: buildUrl('expenses/categories'),
            description: 'Create a new expense category.',
          },
        },
        {
          name: '3. List Expenses',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('expenses', [
              { key: 'page', value: '1' },
              { key: 'limit', value: '20' },
            ]),
            description: 'Retrieve logged expenses.',
          },
        },
        {
          name: '4. Record New Expense',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              categoryId: '{{expense_category_id}}',
              amount: 1200,
              accountId: '{{account_id}}',
              description: 'Monthly store internet fiber bill',
            }),
            url: buildUrl('expenses'),
            description: 'Log an operating expense paid from an account.',
          },
        },
      ],
    },

    // 15. Inventory Wastage & Adjustments
    {
      name: '15. Inventory Adjustments & Wastage',
      description: 'Track spoiled, broken, or expired merchandise and record stock write-offs.',
      item: [
        {
          name: '1. List Wastage Records',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('inventory/wastage'),
            description: 'List all recorded inventory loss and write-offs.',
          },
        },
        {
          name: '2. Record Wastage / Spoilage',
          request: {
            method: 'POST',
            header: defaultHeaders,
            body: jsonBody({
              variantId: '{{variant_id}}',
              quantity: 2,
              reason: 'Packaging damaged during shelf restocking',
            }),
            url: buildUrl('inventory/wastage'),
            description: 'Write off damaged stock and record loss accounting entry.',
          },
        },
      ],
    },

    // 16. Reports & Analytics
    {
      name: '16. Reports & Analytics',
      description: 'Executive KPIs, daily sales, P&L, stock valuation, and export utilities.',
      item: [
        {
          name: '1. Executive Dashboard KPIs',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('reports/dashboard'),
            description: 'High-level store performance, today revenue, orders count, low stock warnings.',
          },
        },
        {
          name: '2. Sales Summary Report',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('reports/sales', [
              { key: 'startDate', value: '2026-09-01' },
              { key: 'endDate', value: '2026-09-30' },
            ]),
            description: 'Sales breakdown by date and channel.',
          },
        },
        {
          name: '3. Product Sales Performance',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('reports/products'),
            description: 'Best-selling products, quantities sold, and gross margins.',
          },
        },
        {
          name: '4. Inventory Stock Valuation',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('reports/inventory'),
            description: 'Total stock asset valuation at cost vs retail price, reorder alerts.',
          },
        },
        {
          name: '5. Profit & Loss (P&L) Statement',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('reports/pnl'),
            description: 'Revenue, COGS, Gross Profit, Expenses, and Net Profit.',
          },
        },
        {
          name: '6. Customer Receivables Aging',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('reports/dues'),
            description: 'List of customers with overdue credit balances.',
          },
        },
        {
          name: '7. Supplier Payables Aging',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('reports/payables'),
            description: 'Upcoming supplier liabilities and procurement dues.',
          },
        },
        {
          name: '8. Export Sales CSV',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('reports/export/sales'),
            description: 'Download CSV file of sales records.',
          },
        },
        {
          name: '9. Export Sales PDF',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('reports/export-pdf/sales'),
            description: 'Generate PDF sales report.',
          },
        },
        {
          name: '10. Export Sales Excel',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('reports/export-excel/sales'),
            description: 'Generate formatted XLSX sales workbook.',
          },
        },
      ],
    },

    // 17. Audit Logs
    {
      name: '17. Audit Logs',
      description: 'System audit trails, activity logging, and security inspection.',
      item: [
        {
          name: '1. Query Audit Trails',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('audit-logs', [
              { key: 'page', value: '1' },
              { key: 'limit', value: '30' },
            ]),
            description: 'View chronological audit log of user actions and sensitive events.',
          },
        },
      ],
    },

    // 18. Store Settings
    {
      name: '18. Store Settings',
      description: 'Store business identity, tax rates, receipt headers, and localization.',
      item: [
        {
          name: '1. Get Store Settings',
          request: {
            method: 'GET',
            header: defaultHeaders,
            url: buildUrl('settings'),
            description: 'Retrieve current store profile and config.',
          },
        },
        {
          name: '2. Update Store Settings',
          request: {
            method: 'PUT',
            header: defaultHeaders,
            body: jsonBody({
              storeName: 'Smart Cloud POS Mart',
              address: 'House #12, Road #4, Dhanmondi, Dhaka',
              phone: '+8801700000000',
              currency: 'BDT',
              currencySymbol: '৳',
              taxRate: 5,
              receiptFooter: 'Thank you for shopping with us! Please visit again.',
            }),
            url: buildUrl('settings'),
            description: 'Update business information and receipt layout.',
          },
        },
      ],
    },
  ],
};

const outputDir = path.resolve(__dirname, '../../../postman');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.join(outputDir, 'POS_System_API.postman_collection.json');
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2), 'utf-8');

console.log(`✅ Successfully generated Postman Collection at: ${outputPath}`);
