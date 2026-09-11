import bcrypt from 'bcryptjs';
import { Role } from '../models/Role';
import { User } from '../models/User';
import { Category } from '../models/Category';
import { Brand } from '../models/Brand';
import { Supplier } from '../models/Supplier';
import { Customer } from '../models/Customer';
import { Product } from '../models/Product';
import { Account } from '../models/Account';

export const seedDemoData = async (): Promise<void> => {
  console.log('📦 [SEED FACTORY] Seeding complete demo dataset for retail store operations...');

  // 1. Fetch Roles
  const adminRole = await Role.findOne({ name: 'SUPER_ADMIN' });
  const managerRole = await Role.findOne({ name: 'BRANCH_MANAGER' });
  const cashierRole = await Role.findOne({ name: 'CASHIER' });

  if (!adminRole || !managerRole || !cashierRole) {
    throw new Error('System roles must be seeded before seeding demo data');
  }

  // 2. Seed Demo Staff Users
  const passwordHash = await bcrypt.hash('Password@123', 12);
  const pinHash = await bcrypt.hash('1234', 10);

  const demoUsers = [
    {
      username: 'manager_dhaka',
      fullName: 'Tariqul Islam (Branch Manager)',
      email: 'manager@superpos.com',
      phone: '+8801711000001',
      passwordHash,
      pinHash,
      roleId: managerRole._id,
      isActive: true,
      terminalLocked: false,
    },
    {
      username: 'cashier_karim',
      fullName: 'Abdul Karim (Cashier 1)',
      email: 'karim@superpos.com',
      phone: '+8801811000002',
      passwordHash,
      pinHash,
      roleId: cashierRole._id,
      isActive: true,
      terminalLocked: false,
    },
    {
      username: 'cashier_rahim',
      fullName: 'Abdur Rahim (Cashier 2)',
      email: 'rahim@superpos.com',
      phone: '+8801911000003',
      passwordHash,
      pinHash,
      roleId: cashierRole._id,
      isActive: true,
      terminalLocked: false,
    },
  ];

  for (const u of demoUsers) {
    await User.findOneAndUpdate({ username: u.username }, { $set: u }, { upsert: true, new: true });
  }

  // 3. Seed Categories
  const categories = [
    { name: 'Dairy & Eggs', code: 'DAIRY', defaultTaxRate: 5, description: 'Milk, cheese, eggs & butter' },
    { name: 'Beverages & Soft Drinks', code: 'BEVERAGE', defaultTaxRate: 15, description: 'Juices, water, sodas & energy drinks' },
    { name: 'Snacks & Bakery', code: 'SNACKS', defaultTaxRate: 5, description: 'Biscuits, chips, bread & confectionery' },
    { name: 'Personal Care & Hygiene', code: 'PERSONAL_CARE', defaultTaxRate: 15, description: 'Soap, shampoo & oral care' },
  ];

  const catMap = new Map<string, any>();
  for (const c of categories) {
    const cat = await Category.findOneAndUpdate({ code: c.code }, { $set: c }, { upsert: true, new: true });
    catMap.set(c.code, cat._id);
  }

  // 4. Seed Brands
  const brands = [
    { name: 'Aarong Dairy', originCountry: 'Bangladesh' },
    { name: 'Pran Beverages', originCountry: 'Bangladesh' },
    { name: 'Unilever Bangladesh', originCountry: 'Bangladesh' },
    { name: 'Olympic Industries', originCountry: 'Bangladesh' },
  ];

  const brandMap = new Map<string, any>();
  for (const b of brands) {
    const brand = await Brand.findOneAndUpdate({ name: b.name }, { $set: b }, { upsert: true, new: true });
    brandMap.set(b.name, brand._id);
  }

  // 5. Seed Suppliers
  const suppliers = [
    {
      companyName: 'Brac Enterprises (Aarong)',
      contactPerson: 'Md. Rafiqul Alam',
      phone: '+8801700112233',
      email: 'supply@aarong.com',
      currentPayableBalance: 0,
      isActive: true,
    },
    {
      companyName: 'Pran-RFL Group Distribution',
      contactPerson: 'Sabbir Hossain',
      phone: '+8801700445566',
      email: 'sales@pranrfl.com',
      currentPayableBalance: 0,
      isActive: true,
    },
  ];

  const suppMap = new Map<string, any>();
  for (const s of suppliers) {
    const supp = await Supplier.findOneAndUpdate({ companyName: s.companyName }, { $set: s }, { upsert: true, new: true });
    suppMap.set(s.companyName, supp._id);
  }

  // 6. Seed Customers
  const customers = [
    {
      name: 'Rahim Traders (Wholesale Trade)',
      phone: '+8801822334455',
      email: 'rahim.traders@gmail.com',
      creditLimit: 50000,
      currentDueBalance: 5200,
      loyaltyPoints: 120,
      isActive: true,
    },
    {
      name: 'Dr. Shahriar Kabir (Retail Regular)',
      phone: '+8801733445566',
      email: 'shahriar.kabir@hotmail.com',
      creditLimit: 10000,
      currentDueBalance: 0,
      loyaltyPoints: 340,
      isActive: true,
    },
  ];

  for (const c of customers) {
    await Customer.findOneAndUpdate({ phone: c.phone }, { $set: c }, { upsert: true, new: true });
  }

  // 7. Seed Products with Variants & Batches
  const demoProducts = [
    {
      name: 'Aarong Pasteurized Liquid Milk',
      categoryId: catMap.get('DAIRY'),
      brandId: brandMap.get('Aarong Dairy'),
      supplierId: suppMap.get('Brac Enterprises (Aarong)'),
      unit: 'Ltr',
      taxType: 'INCLUSIVE',
      taxRate: 5,
      variants: [
        {
          sku: 'SKU-AARONG-MILK-1000ML',
          barcode: '8941100100012',
          attributeName: '1 Liter Pouch',
          costPrice: 82.0,
          retailSellingPrice: 95.0,
          wholesaleSellingPrice: 88.0,
          currentStock: 45,
          alertQty: 10,
          batches: [
            {
              batchNo: 'BAT-202609-01',
              costPrice: 82.0,
              quantity: 45,
              expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
              receivedAt: new Date(),
            },
          ],
          isAvailable: true,
        },
        {
          sku: 'SKU-AARONG-MILK-500ML',
          barcode: '8941100100029',
          attributeName: '500 ml Pouch',
          costPrice: 42.0,
          retailSellingPrice: 50.0,
          wholesaleSellingPrice: 46.0,
          currentStock: 30,
          alertQty: 8,
          batches: [
            {
              batchNo: 'BAT-202609-02',
              costPrice: 42.0,
              quantity: 30,
              expiryDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days
              receivedAt: new Date(),
            },
          ],
          isAvailable: true,
        },
      ],
      isActive: true,
    },
    {
      name: 'Pran Mango Fruit Drink',
      categoryId: catMap.get('BEVERAGE'),
      brandId: brandMap.get('Pran Beverages'),
      supplierId: suppMap.get('Pran-RFL Group Distribution'),
      unit: 'Pcs',
      taxType: 'EXCLUSIVE',
      taxRate: 15,
      variants: [
        {
          sku: 'SKU-PRAN-MANGO-250ML',
          barcode: '8941100200033',
          attributeName: '250ml Tetra Pack',
          costPrice: 22.0,
          retailSellingPrice: 30.0,
          wholesaleSellingPrice: 26.0,
          currentStock: 120,
          alertQty: 25,
          isAvailable: true,
        },
      ],
      isActive: true,
    },
    {
      name: 'Olympic Energy Plus Biscuit',
      categoryId: catMap.get('SNACKS'),
      brandId: brandMap.get('Olympic Industries'),
      unit: 'Pcs',
      taxType: 'INCLUSIVE',
      taxRate: 5,
      variants: [
        {
          sku: 'SKU-OLY-ENERGY-PACK',
          barcode: '8941100300040',
          attributeName: 'Family Pack (200g)',
          costPrice: 38.0,
          retailSellingPrice: 50.0,
          wholesaleSellingPrice: 43.0,
          currentStock: 4, // Intentionally low stock for alert testing
          alertQty: 10,
          isAvailable: true,
        },
      ],
      isActive: true,
    },
  ];

  for (const p of demoProducts) {
    await Product.findOneAndUpdate({ name: p.name }, { $set: p }, { upsert: true, new: true });
  }

  console.log('✅ [SEED FACTORY] Demo staff, catalog, stock batches, and trade accounts seeded successfully!');
};
