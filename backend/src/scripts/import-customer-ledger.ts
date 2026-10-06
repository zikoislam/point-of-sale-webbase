/**
 * Import customer ledger history from the "Customer ladger final" workbook.
 *
 *   npx ts-node src/scripts/import-customer-ledger.ts            (DRY RUN)
 *   npx ts-node src/scripts/import-customer-ledger.ts --commit   (writes to DB)
 *
 * Each sheet is one customer. Row layout:
 *   row 3-6 : Customer code / CustomerName / Phone / Address
 *   header  : Cust. Name | Date | Narration | Referance | Debit | Credit | Balance | Bal Type
 *   rows    : "By Invoice" (Debit = sale) and "by Receive" (Credit = collection)
 *
 * Dry run prints what WOULD be created (and every row that has an amount but no
 * date, so the operator can fill those dates in first). Nothing is written
 * without --commit.
 */
import path from 'path';
import mongoose, { Types } from 'mongoose';
import { connectDB } from '../config/db';
import { Customer } from '../models/Customer';
import { CustomerLedger } from '../models/CustomerLedger';
import { Organization } from '../models/Organization';
import { User } from '../models/User';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExcelJS = require('exceljs');

const FILE =
  process.argv.find((a) => a.toLowerCase().endsWith('.xlsx')) ||
  path.resolve(__dirname, '../../../Customer ladger  final.xlsx');
const COMMIT = process.argv.includes('--commit');
const DETAIL = process.argv.includes('--detail');

interface LedgerRow {
  rowNo: number;
  date: Date | null;
  narration: string;
  reference: string;
  debit: number;
  credit: number;
  kind: 'SALE_DUE' | 'PAYMENT_COLLECTION';
  /** The sheet's own Balance cell (credit − debit), when it carries a number. */
  sheetBalance: number | null;
}

interface ParsedCustomer {
  sheet: string;
  name: string;
  phone: string;
  address: string;
  rows: LedgerRow[];
}

/** exceljs cell values can be string, number, Date, or a rich/formula object. */
function text(v: any): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t: any) => t.text).join('');
    if (v.result != null) return text(v.result);
    if (v.text != null) return text(v.text);
    return '';
  }
  return String(v).trim();
}

function num(v: any): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') {
    if (typeof v.result === 'number') return v.result;
    return num(v.result);
  }
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Like num() but null when the cell has no numeric value at all. */
function numOrNull(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'object') {
    if (typeof v.result === 'number') return v.result;
    return null;
  }
  const n = Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function toDate(v: any): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'object' && v.result) return toDate(v.result);
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Finds the value to the right of a label like "CustomerName" in the first rows. */
function labelValue(sheet: any, label: string): string {
  for (let r = 1; r <= 8; r++) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= 4; c++) {
      if (text(row.getCell(c).value).toLowerCase() === label.toLowerCase()) {
        return text(row.getCell(c + 1).value);
      }
    }
  }
  return '';
}

async function parse(): Promise<ParsedCustomer[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE);
  const out: ParsedCustomer[] = [];

  wb.eachSheet((sheet: any) => {
    if (sheet.rowCount < 8) return; // empty / non-customer sheet
    // The workbook also carries a combined summary sheet — not a customer.
    if (/^all[_ ]?customer/i.test(sheet.name)) return;

    // header row = the one that has both "Date" and "Balance"
    let headerRow = 0;
    for (let r = 1; r <= 12; r++) {
      const row = sheet.getRow(r);
      const vals: string[] = [];
      row.eachCell((cell: any) => vals.push(text(cell.value).toLowerCase()));
      if (vals.includes('date') && vals.includes('balance')) {
        headerRow = r;
        break;
      }
    }
    if (!headerRow) return; // not a per-customer ledger sheet

    const name = labelValue(sheet, 'CustomerName') || sheet.name;
    const phone = labelValue(sheet, 'Customer Phone') || labelValue(sheet, 'Customer  Phone');
    const address = labelValue(sheet, 'Customer Address');

    const rows: LedgerRow[] = [];
    for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      // Columns: A=Cust.Name, B=Date, C=Narration, D=Referance,
      //          E=Debit Amount, F=Credit Amount, G=Balance, H=Bal Type
      const date = toDate(row.getCell(2).value);
      const narration = text(row.getCell(3).value);
      const reference = text(row.getCell(4).value);
      const debit = num(row.getCell(5).value);
      const credit = num(row.getCell(6).value);
      const sheetBalance = numOrNull(row.getCell(7).value);

      const amount = debit > 0 ? debit : credit > 0 ? credit : 0;
      if (amount <= 0) continue; // opening / blank rows
      if (/opning|opening/i.test(narration)) continue;

      rows.push({
        rowNo: r,
        date,
        narration,
        reference,
        debit,
        credit,
        kind: debit > 0 ? 'SALE_DUE' : 'PAYMENT_COLLECTION',
        sheetBalance,
      });
    }

    if (rows.length === 0) return;
    out.push({ sheet: sheet.name, name, phone, address, rows });
  });

  return out;
}

const R = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Opening (carry-forward) due and the resulting total due for one customer. */
function analyze(c: ParsedCustomer) {
  let running = 0;
  let offset: number | null = null;
  let okCount = 0;
  let signCount = 0;
  let compareCount = 0;
  let varyingCount = 0;
  for (const r of c.rows) {
    running += r.debit - r.credit;
    if (r.sheetBalance === null) continue;
    compareCount++;
    const expected = -r.sheetBalance;
    const diff = expected - running;
    if (Math.abs(diff) <= 0.5) okCount++;
    else if (Math.abs(expected + running) <= 0.5) signCount++;
    if (offset === null) offset = diff;
    else if (Math.abs(diff - offset) > 0.5) varyingCount++;
  }
  const signFlipped = compareCount > 0 && signCount === compareCount;
  const opening =
    !signFlipped && compareCount > 0 && varyingCount === 0 && offset ? R(offset) : 0;
  const due = R(opening + c.rows.reduce((n, r) => n + r.debit - r.credit, 0));
  return { opening, due, signFlipped, okCount, compareCount, varyingCount, offset };
}

/** Writes customers + their ledger history into the database. */
async function commit(customers: ParsedCustomer[]): Promise<void> {
  await connectDB();
  const org = await Organization.findOne({}).lean();
  if (!org) throw new Error('No organization found in the database');
  const orgId = org._id;

  const actor =
    (await User.findOne({ isPlatformSuperAdmin: true }).lean()) ||
    (await User.findOne({}).lean());
  if (!actor) throw new Error('No user found to record ledger entries against');

  const usedPhones = new Set<string>();
  let seq = 1;
  let created = 0;
  let skipped = 0;
  let entryCount = 0;
  let placeholders = 0;

  console.log('\n=== IMPORTING ===');

  for (const c of customers) {
    const existing = await Customer.findOne({ orgId, name: c.name }).lean();
    if (existing) {
      skipped++;
      console.log(`   ↷ skipped (already exists): ${c.name}`);
      continue;
    }

    let phone = (c.phone || '').replace(/[^\d]/g, '');
    if (!phone || usedPhones.has(phone)) {
      phone = '19' + String(100000000 + seq++).slice(-9); // unique placeholder
      placeholders++;
    }
    usedPhones.add(phone);

    const { opening, due } = analyze(c);
    const firstDate = c.rows.find((r) => r.date)?.date || new Date();
    let lastDate = firstDate;

    const customer = await Customer.create({
      orgId,
      name: c.name,
      phone,
      address: c.address || undefined,
      customerType: 'RETAIL',
      creditLimit: Math.max(1000000, Math.ceil(Math.abs(due))),
      currentDueBalance: due,
      isActive: true,
    });

    const docs: any[] = [];
    let bal = opening;
    if (opening !== 0) {
      docs.push({
        orgId,
        customerId: customer._id,
        transactionType: 'OPENING',
        amount: opening,
        balanceBefore: 0,
        balanceAfter: opening,
        referenceType: 'OPENING',
        referenceId: customer._id,
        narration: 'Opening balance (carry forward)',
        transactionDate: firstDate,
        recordedById: actor._id,
      });
    }
    for (const r of c.rows) {
      const before = bal;
      bal = R(bal + r.debit - r.credit);
      const d = r.date || lastDate;
      lastDate = d;
      docs.push({
        orgId,
        customerId: customer._id,
        transactionType: r.kind,
        amount: R(r.debit > 0 ? r.debit : r.credit),
        balanceBefore: before,
        balanceAfter: bal,
        referenceType: r.kind === 'SALE_DUE' ? 'SALE' : 'RECEIPT',
        referenceId: new Types.ObjectId(),
        narration:
          `${r.narration} ${r.reference}`.trim() ||
          (r.kind === 'SALE_DUE' ? 'Sale' : 'Payment received'),
        transactionDate: d,
        recordedById: actor._id,
      });
    }

    await CustomerLedger.insertMany(docs);
    created++;
    entryCount += docs.length;
    console.log(
      `   ✓ ${c.name.padEnd(22)} due=${due}  entries=${docs.length}` +
        `${opening ? `  (opening ${opening})` : ''}`
    );
  }

  console.log(
    `\nDone. Customers created: ${created}, ledger entries: ${entryCount}, ` +
      `skipped: ${skipped}, placeholder phones: ${placeholders}.`
  );
  await mongoose.disconnect();
}

(async () => {
  const customers = await parse();
  let totalEntries = 0;
  const missing: string[] = [];
  const balanceIssues: string[] = [];

  console.log(`\nFile : ${FILE}`);
  console.log(`Mode : ${COMMIT ? 'COMMIT (writes to DB)' : 'DRY RUN (no writes)'}\n`);

  for (const c of customers) {
    totalEntries += c.rows.length;
    const debit = c.rows.reduce((n, r) => n + r.debit, 0);
    const credit = c.rows.reduce((n, r) => n + r.credit, 0);
    const due = debit - credit;
    const dates = c.rows.map((r) => r.date).filter(Boolean) as Date[];
    const first = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString().slice(0, 10) : '—';
    const last = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString().slice(0, 10) : '—';
    console.log(
      `• ${c.name.padEnd(22)} [${c.sheet}]  entries=${String(c.rows.length).padStart(3)}  ` +
        `sales=${debit}  collections=${credit}  due=${due}  ${first}→${last}  phone=${c.phone || '(none)'}`
    );

    // Compare our running balance with the sheet's own Balance column and
    // classify the difference: OK / sign-flipped / a constant opening balance /
    // genuinely varying (row-level mismatch worth fixing).
    let running = 0;
    let offset: number | null = null;
    let okCount = 0;
    let signCount = 0;
    let compareCount = 0;
    let varyingCount = 0;
    for (const r of c.rows) {
      running += r.debit - r.credit;
      if (r.sheetBalance === null) continue;
      compareCount++;
      const expected = -r.sheetBalance; // the sheet stores credit − debit
      const diff = expected - running;
      if (Math.abs(diff) <= 0.5) okCount++;
      else if (Math.abs(expected + running) <= 0.5) signCount++;
      if (offset === null) offset = diff;
      else if (Math.abs(diff - offset) > 0.5) varyingCount++;
    }
    if (compareCount > 0 && okCount !== compareCount) {
      let verdict: string;
      if (signCount === compareCount) verdict = 'SIGN-FLIPPED (magnitude ok)';
      else if (varyingCount === 0 && Math.abs(offset || 0) > 0.5) verdict = `OPENING balance ${offset}`;
      else verdict = `MIXED — ${varyingCount} row(s) differ`;
      balanceIssues.push(`   - ${c.name} [${c.sheet}]: ${verdict}  (rows checked ${compareCount})`);

      if (DETAIL) {
        // Replay the rows for this customer so the mismatch is easy to eyeball.
        let run2 = 0;
        for (const r of c.rows) {
          run2 += r.debit - r.credit;
          const sheet = r.sheetBalance === null ? '—' : String(-r.sheetBalance);
          const diff = r.sheetBalance === null ? '' : `  diff=${run2 + r.sheetBalance}`;
          console.log(
            `        row ${String(r.rowNo).padStart(3)}  ${r.date ? r.date.toISOString().slice(0, 10) : '(no date)  '}  ` +
              `debit=${String(r.debit).padStart(8)} credit=${String(r.credit).padStart(8)}  ` +
              `computed=${String(run2).padStart(9)} sheet=${sheet.padStart(9)}${diff}  "${r.narration}" ${r.reference}`
          );
        }
      }
    }

    for (const r of c.rows) {
      if (!r.date) {
        missing.push(
          `   - ${c.name} [${c.sheet}] row ${r.rowNo}: ${r.kind} ${r.debit || r.credit} ` +
            `ref="${r.reference}" narration="${r.narration}"`
        );
      }
    }
  }

  console.log(`\nCustomers parsed : ${customers.length}`);
  console.log(`Ledger entries   : ${totalEntries}`);
  console.log(`\n=== BALANCE CHECK — computed vs sheet (${balanceIssues.length} mismatch) ===`);
  console.log(balanceIssues.length ? balanceIssues.join('\n') : '   ✅ every row matches the sheet');
  console.log(`\n=== ROWS WITH NO DATE (${missing.length}) ===`);
  console.log(missing.length ? missing.join('\n') : '   (none)');

  if (COMMIT) {
    await commit(customers);
  } else {
    console.log('\n(dry run — nothing written. Add --commit to import.)');
  }
  console.log('');
})().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
