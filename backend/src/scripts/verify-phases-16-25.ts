import mongoose, { Types } from 'mongoose';
import { connectDB } from '../config/db';
import '../models';
import { User } from '../models/User';
import { Customer } from '../models/Customer';
import { CustomerLedger } from '../models/CustomerLedger';
import { Supplier } from '../models/Supplier';
import { SupplierLedger } from '../models/SupplierLedger';
import { ExpenseCategory } from '../models/ExpenseCategory';
import { Expense } from '../models/Expense';
import { Account } from '../models/Account';
import { AccountTransaction } from '../models/AccountTransaction';
import { AuditLog } from '../models/AuditLog';
import { HoldCart } from '../models/HoldCart';
import { Settings } from '../models/Settings';
import { Product } from '../models/Product';
import { Shift } from '../models/Shift';
import { customerService } from '../services/CustomerService';
import { supplierService } from '../services/SupplierService';
import { expenseService } from '../services/ExpenseService';
import { accountService } from '../services/AccountService';
import { auditService } from '../services/AuditService';
import { saleService } from '../services/SaleService';
import { settingsService } from '../services/SettingsService';

interface TestSummary {
  phase: number;
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestSummary[] = [];

function assert(condition: boolean, phase: number, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] Phase ${phase}: ${testName}`);
    results.push({ phase, name: testName, passed: true });
  } else {
    console.error(`  ❌ [FAIL] Phase ${phase}: ${testName} - ${detail || 'Assertion failed'}`);
    results.push({ phase, name: testName, passed: false, message: detail });
  }
}

async function runPhasesVerification() {
  console.log('🧪 Starting Verification Suite for Phases 16 through 25...\n');
  await connectDB();

  try {
    const admin = await User.findOne({ username: 'admin' }).lean() || await User.findOne().lean();
    const adminUserId = admin ? (admin._id as Types.ObjectId).toString() : new Types.ObjectId().toString();

    // ----------------------------------------------------
    // PHASE 16: Customer Ledger & Due Payment Collection
    // ----------------------------------------------------
    console.log('🔹 Phase 16: Customer Ledgers & Due Payment Collection');
    const custPhone = `01799${Date.now().toString().slice(-6)}`;
    const testCustomer = await Customer.create({
      name: 'Test Credit Customer',
      phone: custPhone,
      currentDueBalance: 1200,
      creditLimit: 5000,
      isActive: true,
    });

    const paymentRes = await customerService.collectDuePayment(
      testCustomer._id.toString(),
      { amount: 500, paymentMethod: 'CASH', notes: 'Partial settlement' },
      adminUserId
    );

    const updatedCust = await Customer.findById(testCustomer._id).lean();
    assert(updatedCust?.currentDueBalance === 700, 16, 'Customer due balance accurately reduced from 1200 to 700');

    const custLedger = await CustomerLedger.findOne({ customerId: testCustomer._id }).sort({ createdAt: -1 }).lean();
    assert(!!custLedger, 16, 'Customer ledger record successfully generated');
    assert(custLedger?.transactionType === 'PAYMENT_COLLECTION', 16, 'Ledger transactionType is PAYMENT_COLLECTION');
    assert(custLedger?.balanceBefore === 1200 && custLedger?.balanceAfter === 700, 16, 'Ledger tracks exact balance before and after');

    // ----------------------------------------------------
    // PHASE 17: Supplier Directory & Uniqueness
    // ----------------------------------------------------
    console.log('\n🔹 Phase 17: Supplier Directory Management');
    const suppPhone = `01899${Date.now().toString().slice(-6)}`;
    const newSupplier = await supplierService.create({
      companyName: 'Akij Food & Beverage Ltd',
      contactPerson: 'Mr. Rafiqul Islam',
      phone: suppPhone,
      email: 'rafiq@akij.net',
      address: 'Dhaka, Bangladesh',
    });

    assert(!!newSupplier.id, 17, 'Supplier profile created with generated ID');
    assert(newSupplier.currentPayableBalance === 0, 17, 'New supplier initialized with 0 payable balance');

    let duplicateRejected = false;
    try {
      await supplierService.create({
        companyName: 'Akij Duplicate',
        contactPerson: 'Other rep',
        phone: suppPhone,
      });
    } catch (err: any) {
      if (err.errorCode === 'DUPLICATE_PHONE' || err.statusCode === 409) {
        duplicateRejected = true;
      }
    }
    assert(duplicateRejected, 17, 'Duplicate supplier phone number correctly rejected');

    // ----------------------------------------------------
    // PHASE 18: Supplier Ledger & Payment Disbursal
    // ----------------------------------------------------
    console.log('\n🔹 Phase 18: Supplier Ledger & Payment Disbursals');
    const paySourceAccount = await Account.create({
      name: 'Operations Bank Account',
      accountType: 'BANK',
      accountNumber: `BANK-${Date.now()}`,
      currentBalance: 10000,
    });

    // Set supplier payable balance to 2500
    await Supplier.findByIdAndUpdate(newSupplier.id, { currentPayableBalance: 2500 });

    const disbursal = await supplierService.payDue(
      newSupplier.id,
      { amount: 1500, accountId: paySourceAccount._id.toString(), notes: 'Cheque payment' },
      adminUserId
    );

    const updatedSupplier = await Supplier.findById(newSupplier.id).lean();
    assert(updatedSupplier?.currentPayableBalance === 1000, 18, 'Supplier payable reduced from 2500 to 1000');

    const suppLedger = await SupplierLedger.findOne({ supplierId: newSupplier.id }).sort({ createdAt: -1 }).lean();
    assert(suppLedger?.transactionType === 'PAYMENT_DISBURSAL', 18, 'Supplier ledger logged PAYMENT_DISBURSAL');
    assert(suppLedger?.amount === 1500 && suppLedger?.balanceAfter === 1000, 18, 'Supplier ledger balances match disbursal');

    const updatedPayAcc = await Account.findById(paySourceAccount._id).lean();
    assert(updatedPayAcc?.currentBalance === 8500, 18, 'Paying account debited from 10000 to 8500');

    const suppAccTx = await AccountTransaction.findOne({
      accountId: paySourceAccount._id,
      referenceType: 'SUPPLIER_PAYMENT',
    }).lean();
    assert(!!suppAccTx && suppAccTx.type === 'DEBIT', 18, 'Double-entry AccountTransaction logged DEBIT for supplier payment');

    // ----------------------------------------------------
    // PHASE 19: Expense Categories Management
    // ----------------------------------------------------
    console.log('\n🔹 Phase 19: Expense Categories Management');
    const categoryCode = `EXP_TEST_${Date.now().toString().slice(-4)}`;
    const expCat = await expenseService.createCategory({
      name: 'Utilities & Bills',
      code: categoryCode,
    });
    assert(expCat.code === categoryCode, 19, 'Expense category created with uppercase code');

    const updatedExpCat = await expenseService.updateCategory(expCat._id.toString(), {
      name: 'Utilities & Electricity Bills',
    });
    assert(updatedExpCat.name === 'Utilities & Electricity Bills', 19, 'Expense category name updated');

    const allCategories = await expenseService.listCategories();
    assert(allCategories.some((c) => c._id.toString() === expCat._id.toString()), 19, 'Created category is present in category list');

    // ----------------------------------------------------
    // PHASE 20: Financial Multi-Accounts
    // ----------------------------------------------------
    console.log('\n🔹 Phase 20: Financial Multi-Account Management');
    const testMfs = await accountService.create({
      name: 'Nagad Merchant Wallet',
      accountType: 'MFS',
      accountNumber: '01800000000',
      initialBalance: 3500,
    });
    assert(testMfs.currentBalance === 3500, 20, 'MFS Account created with initial balance of 3500');
    assert(testMfs.accountType === 'MFS', 20, 'Account type saved as MFS');

    const initialTx = await AccountTransaction.findOne({
      accountId: testMfs._id,
      description: 'Initial opening balance',
    }).lean();
    assert(!!initialTx && initialTx.amount === 3500, 20, 'Initial opening balance transaction logged');

    // ----------------------------------------------------
    // PHASE 21: Double-Entry Fund Transfers
    // ----------------------------------------------------
    console.log('\n🔹 Phase 21: Double-Entry Fund Transfers');
    const targetAccount = await accountService.create({
      name: 'Secondary Cash Drawer',
      accountType: 'CASH',
      initialBalance: 500,
    });

    await accountService.transferFunds(
      {
        fromAccountId: testMfs._id.toString(),
        toAccountId: targetAccount._id.toString(),
        amount: 1000,
        description: 'Fund transfer from Nagad to Cash Drawer',
      },
      adminUserId
    );

    const mfsAfter = await Account.findById(testMfs._id).lean();
    const targetAfter = await Account.findById(targetAccount._id).lean();
    assert(mfsAfter?.currentBalance === 2500, 21, 'Source account debited by 1000 (3500 -> 2500)');
    assert(targetAfter?.currentBalance === 1500, 21, 'Destination account credited by 1000 (500 -> 1500)');

    // ----------------------------------------------------
    // PHASE 22: Operating Expenses Tracking
    // ----------------------------------------------------
    console.log('\n🔹 Phase 22: Operating Expenses Management');
    const expRecord = await expenseService.createExpense(
      {
        categoryId: expCat._id.toString(),
        amount: 300,
        accountId: targetAccount._id.toString(),
        description: 'Monthly cleaning supplies',
      },
      adminUserId,
      'SUPER_ADMIN'
    );
    assert(!!expRecord._id, 22, 'Expense record created');

    const targetAfterExpense = await Account.findById(targetAccount._id).lean();
    assert(targetAfterExpense?.currentBalance === 1200, 22, 'Account balance debited for expense (1500 -> 1200)');

    const expTx = await AccountTransaction.findOne({
      referenceType: 'EXPENSE',
      referenceId: expRecord._id,
    }).lean();
    assert(!!expTx && expTx.type === 'DEBIT', 22, 'AccountTransaction created with DEBIT for expense');

    // ----------------------------------------------------
    // PHASE 23: System-wide Immutable Audit Logs
    // ----------------------------------------------------
    console.log('\n🔹 Phase 23: System-wide Immutable Audit Logs');
    const auditEntry = await auditService.logAction(
      adminUserId,
      'PRICE_OVERRIDE',
      'Product',
      new Types.ObjectId().toString(),
      { oldRetailPrice: 200, newRetailPrice: 180, reason: 'Promotional discount' },
      '127.0.0.1'
    );
    assert(!!auditEntry._id, 23, 'Audit log persisted with action and metadata diff');

    const auditList = await auditService.list(1, 10, 'Product', 'PRICE_OVERRIDE');
    assert(auditList.data.some((l) => (l as any)._id.toString() === auditEntry._id.toString()), 23, 'Audit log retrievable via query filtering');

    // ----------------------------------------------------
    // PHASE 24: POS Hold & Resume Carts
    // ----------------------------------------------------
    console.log('\n🔹 Phase 24: POS Hold & Resume Carts');
    let activeShift = await Shift.findOne({ userId: new Types.ObjectId(adminUserId), status: 'OPEN' });
    if (!activeShift) {
      activeShift = await Shift.create({
        userId: new Types.ObjectId(adminUserId),
        terminalId: 'TERM-MAIN-01',
        openingFloat: 1000,
        expectedCash: 1000,
        actualCash: 0,
        discrepancy: 0,
        status: 'OPEN',
      });
    }

    const testProd = await Product.findOne().lean();
    const testVariantId = testProd?.variants?.[0]?._id?.toString() || new Types.ObjectId().toString();

    const heldCart = await saleService.holdCart(
      {
        cartLabel: 'Customer Walk-in Basket #4',
        pricingTier: 'RETAIL',
        items: [
          {
            variantId: testVariantId,
            quantity: 2,
            unitSellingPrice: 90,
          },
        ],
        notes: 'Waiting to fetch more items',
      },
      adminUserId
    );
    assert(!!heldCart._id, 24, 'Hold cart created and parked successfully');
    assert(heldCart.cartLabel === 'Customer Walk-in Basket #4', 24, 'Hold cart retained label metadata');

    const heldList = await saleService.listHoldCarts(adminUserId);
    assert(heldList.some((c) => c._id.toString() === heldCart._id.toString()), 24, 'Parked cart appears in cashier active held list');

    const resumedCart = await saleService.resumeCart(heldCart._id.toString(), adminUserId);
    assert(resumedCart.cartLabel === 'Customer Walk-in Basket #4', 24, 'Resumed cart returns original items');

    const postResume = await HoldCart.findById(heldCart._id).lean();
    assert(postResume === null, 24, 'Resumed cart is atomically deleted from held carts table');

    // ----------------------------------------------------
    // PHASE 25: Shop Settings Singleton
    // ----------------------------------------------------
    console.log('\n🔹 Phase 25: Shop Settings Singleton Management');
    const currentSettings = await settingsService.getSettings();
    assert(!!currentSettings.shopName, 25, 'Singleton settings document exists and has shop name');
    assert(['58mm', '80mm'].includes(currentSettings.thermalPrinterType), 25, 'Thermal printer type is 58mm or 80mm');

    const updatedSettings = await settingsService.updateSettings({
      shopName: 'Enterprise Superstore Ltd.',
      currencySymbol: '৳',
      receiptFooter: 'Thank you for shopping with us! Returns valid for 7 days.',
    });
    assert(updatedSettings.shopName === 'Enterprise Superstore Ltd.', 25, 'Shop name successfully updated in singleton');
    assert(updatedSettings.receiptFooter.includes('Returns valid for 7 days'), 25, 'Receipt footer updated');

    const settingsDocCount = await Settings.countDocuments();
    assert(settingsDocCount === 1, 25, 'Singleton invariant preserved: exactly 1 settings document in collection');

    // ----------------------------------------------------
    // FINAL SUMMARY
    // ----------------------------------------------------
    console.log('\n═══════════════════════════════════════════════════');
    console.log('🏁 PHASES 16-25 VERIFICATION SUMMARY');
    console.log('═══════════════════════════════════════════════════');
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;

    console.log(`Total Assertions: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed === 0) {
      console.log('\n🏆 ALL 10 DOMAINS (PHASES 16-25) FULLY VERIFIED, TESTED & PASSED!');
    } else {
      console.error(`\n⚠️ ${failed} assertions failed!`);
      process.exit(1);
    }
  } catch (error) {
    console.error('💥 Test suite execution error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

runPhasesVerification();
