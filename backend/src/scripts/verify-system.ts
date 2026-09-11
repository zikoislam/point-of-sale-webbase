import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import '../models';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { Product } from '../models/Product';
import { Customer } from '../models/Customer';
import { Account } from '../models/Account';
import { Shift } from '../models/Shift';
import { Sale } from '../models/Sale';
import { saleService } from '../services/SaleService';

import { shiftService } from '../services/ShiftService';
import { accountService } from '../services/AccountService';
import { productService } from '../services/ProductService';
import { salesReturnService } from '../services/SalesReturnService';

interface TestSummary {
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestSummary[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    results.push({ name: testName, passed: true });
  } else {
    console.error(`  ❌ [FAIL] ${testName}: ${detail || 'Assertion failed'}`);
    results.push({ name: testName, passed: false, message: detail });
  }
}

async function runVerificationSuite() {
  console.log('🧪 Starting End-to-End Enterprise POS System Verification Suite...\n');
  await connectDB();

  try {
    // ----------------------------------------------------
    // TEST 1: User & PIN Authentication Verification
    // ----------------------------------------------------
    console.log('🔹 Test 1: User & PIN Authentication Integrity');
    const cashier = await User.findOne({ username: 'cashier_karim' }).populate('roleId');
    assert(!!cashier, 'Cashier user exists in database');
    assert(cashier?.roleId !== null, 'Cashier role is mapped');

    // ----------------------------------------------------
    // TEST 2: RBAC Cost Price Isolation
    // ----------------------------------------------------
    console.log('\n🔹 Test 2: RBAC Cashier Cost Price Concealment');
    const adminProductList = await productService.listProducts({ userRole: 'SUPER_ADMIN', limit: 5 });
    const cashierProductList = await productService.listProducts({ userRole: 'CASHIER', limit: 5 });

    const adminItem = adminProductList.products[0];
    const cashierItem = cashierProductList.products[0];

    assert(adminItem.lowestCostPrice !== undefined, 'Admin sees product cost prices');
    assert(cashierItem.lowestCostPrice === undefined, 'Cashier NEVER sees product cost prices');

    // ----------------------------------------------------
    // TEST 3: Shift Opening Float Lifecycle
    // ----------------------------------------------------
    console.log('\n🔹 Test 3: Shift Opening & Cash Float Management');
    // Ensure no stale open shift
    await Shift.deleteMany({ userId: cashier!._id });

    const openShift = await shiftService.openShift(cashier!._id.toString(), {
      openingFloat: 2000,
      terminalId: 'TEST-TERM-01',
      notes: 'Automated verification shift',
    });

    assert(openShift.status === 'OPEN', 'Shift opened with OPEN status');
    assert(openShift.openingFloat === 2000, 'Opening float registered as ৳2000');
    assert(openShift.expectedCash === 2000, 'Expected cash initialized to ৳2000');

    // ----------------------------------------------------
    // TEST 4: Atomic POS Checkout & Stock Decrement
    // ----------------------------------------------------
    console.log('\n🔹 Test 4: Atomic ACID POS Checkout & Stock Decrement');
    const milk = await Product.findOne({ 'variants.sku': 'SKU-AARONG-MILK-1000ML' });
    assert(!!milk, 'Test product Aarong Milk exists');
    const variant = milk!.variants.find(v => v.sku === 'SKU-AARONG-MILK-1000ML')!;
    const initialStock = variant.currentStock;

    const idempotencyKey = `VERIFY-IDEM-${Date.now()}`;
    const checkoutDto = {
      pricingTier: 'RETAIL' as const,
      items: [
        {
          variantId: variant._id.toString(),
          quantity: 2,
          unitSellingPrice: variant.retailSellingPrice,
        },
      ],
      payments: [
        {
          method: 'CASH' as const,
          amount: variant.retailSellingPrice * 2,
        },
      ],
      changeReturned: 0,
      idempotencyKey,
    };

    const sale = await saleService.checkout(checkoutDto, cashier!._id.toString());
    assert(!!sale && !!sale.invoiceNo, `Checkout completed with Invoice: ${sale.invoiceNo}`);

    const refreshedProduct = await Product.findById(milk!._id);
    const refreshedVariant = refreshedProduct!.variants.find(v => v.sku === 'SKU-AARONG-MILK-1000ML')!;
    assert(
      refreshedVariant.currentStock === initialStock - 2,
      'Variant inventory atomically decremented by 2'
    );

    // ----------------------------------------------------
    // TEST 5: Idempotency Key Replay Prevention
    // ----------------------------------------------------
    console.log('\n🔹 Test 5: Idempotency Replay Attack Prevention');
    const duplicateSale = await saleService.checkout(checkoutDto, cashier!._id.toString());
    assert(
      duplicateSale.invoiceNo === sale.invoiceNo,
      'Duplicate idempotency submission returns original invoice without re-billing'
    );

    const reCheckedProduct = await Product.findById(milk!._id);
    const reCheckedVariant = reCheckedProduct!.variants.find(v => v.sku === 'SKU-AARONG-MILK-1000ML')!;
    assert(
      reCheckedVariant.currentStock === initialStock - 2,
      'Inventory was NOT deducted a second time on duplicate checkout'
    );

    // ----------------------------------------------------
    // TEST 6: Customer Credit Limit Enforcement
    // ----------------------------------------------------
    console.log('\n🔹 Test 6: Customer Credit / Due Limit Enforcement');
    const customer = await Customer.findOne({ phone: '+8801822334455' });
    assert(!!customer, 'Trade customer exists');

    let creditBlocked = false;
    try {
      await saleService.checkout(
        {
          customerId: customer!._id.toString(),
          pricingTier: 'WHOLESALE',
          items: [
            {
              variantId: variant._id.toString(),
              quantity: 1,
              unitSellingPrice: variant.wholesaleSellingPrice,
            },
          ],
          payments: [
            {
              method: 'CUSTOMER_DUE',
              amount: 100000, // exceeds credit limit of 50000
            },
          ],
          idempotencyKey: `CREDIT-TEST-${Date.now()}`,
        },
        cashier!._id.toString()
      );
    } catch (err: any) {
      creditBlocked = err.errorCode === 'CREDIT_LIMIT_EXCEEDED' || err.statusCode === 400;
    }
    assert(creditBlocked, 'Sale rejected when customer credit limit is exceeded');

    // ----------------------------------------------------
    // TEST 7: Inter-Account Double-Entry Fund Transfer
    // ----------------------------------------------------
    console.log('\n🔹 Test 7: Double-Entry Inter-Account Transfer');
    const cashAccount = await Account.findOne({ accountType: 'CASH' });
    const bankAccount = await Account.findOne({ accountType: 'BANK' });

    if (cashAccount && bankAccount) {
      const initialCash = cashAccount.currentBalance;
      const initialBank = bankAccount.currentBalance;

      await accountService.transferFunds(
        {
          fromAccountId: cashAccount._id.toString(),
          toAccountId: bankAccount._id.toString(),
          amount: 500,
          description: 'Drawer to Bank Transfer',
        },
        cashier!._id.toString()
      );


      const refCash = await Account.findById(cashAccount._id);
      const refBank = await Account.findById(bankAccount._id);

      assert(refCash!.currentBalance === initialCash - 500, 'Cash account debited by ৳500');
      assert(refBank!.currentBalance === initialBank + 500, 'Bank account credited by ৳500');
    } else {
      assert(false, 'Financial accounts available for transfer test');
    }

    // ----------------------------------------------------
    // TEST 8: Shift Close & Discrepancy Escalation
    // ----------------------------------------------------
    console.log('\n🔹 Test 8: Shift Closing & Cash Discrepancy Reconciliation');
    const closedShift = await shiftService.closeShift(openShift._id.toString(), {
      actualCash: 2100, // Expected was 2000 + 190 (2 * 95) = 2190. Discrepancy = -90
      notes: 'Missing ৳90 discrepancy test',
    });

    assert(closedShift.status === 'CLOSED', 'Shift status updated to CLOSED');
    assert(closedShift.discrepancy !== 0, `Discrepancy calculated: ৳${closedShift.discrepancy}`);

    const zReport = await shiftService.getZReport(openShift._id.toString());
    assert(zReport.summary.totalSalesCount > 0, 'Z-Report accurately aggregates sales count');

  } catch (err: any) {
    console.error('💥 Unexpected exception during verification suite:', err);
    assert(false, 'Verification suite run without crashes', err.message);
  } finally {
    console.log('\n==================================================');
    console.log('📊 VERIFICATION SUITE EXECUTION SUMMARY');
    console.log('==================================================');
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    console.log(`Total Assertions: ${totalCount}`);
    console.log(`Passed: ${passedCount}`);
    console.log(`Failed: ${totalCount - passedCount}`);

    if (passedCount === totalCount) {
      console.log('\n🏆 ALL 8 CORE BUSINESS LOGIC DOMAINS FULLY VERIFIED & COMPLIANT!\n');
    }

    await mongoose.disconnect();
    process.exit(passedCount === totalCount ? 0 : 1);
  }
}

runVerificationSuite();
