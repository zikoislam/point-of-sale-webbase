#!/usr/bin/env node
'use strict';

/**
 * new-shop.js — one command to prepare a brand-new shop (Model C: one install
 * per company).
 *
 *   npm run shop:new -- --shop "Rahim Store" --months 12
 *   npm run shop:new -- --shop "Karim Traders" --months 12 --machine AB12-CD34-EF56
 *
 * Signs with keys/private.pem (via sign.js, shared with the License Manager app)
 * and drops everything for that shop into tools/license-generator/shops/<shop>/ :
 *
 *   license.key    ← the file the shop pastes into the activation screen
 *   shop-info.txt  ← your record + the install/setup checklist for that shop
 *
 * Flags:
 *   --shop "Name"             required
 *   --months 12               subscription length (default 12)
 *   --machine XXXX-XXXX-XXXX  lock to one PC (omit = any PC)
 *   --expires 2027-03-01      fixed expiry instead of --months
 *   --grace 7                 extra days after expiry (default 7)
 *   --contact "phone/email"   kept in shop-info.txt only
 */

const fs = require('fs');
const path = require('path');
const { signKey, nextSerial, appendIssued } = require('./sign');

const HERE = __dirname;
const PRIVATE_KEY = path.join(HERE, 'keys', 'private.pem');
const LEDGER = path.join(HERE, 'issued.csv');
const SHOPS_DIR = path.join(HERE, 'shops');

const csv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function flag(name) {
  const i = process.argv.lastIndexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function slugify(value) {
  return (
    String(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u0980-\u09FF]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'shop'
  );
}

function main() {
  const shop = flag('shop');
  if (!shop) {
    console.error(
      '\nUsage: node tools/license-generator/new-shop.js --shop "Shop Name" [--months 12] [--machine XXXX-XXXX-XXXX] [--grace 7] [--contact "..."]\n'
    );
    process.exit(1);
  }

  if (!fs.existsSync(PRIVATE_KEY)) {
    console.error('\n✗ No signing key found.');
    console.error('  Run this first:  npm run license:init');
    console.error('  (then paste the printed public key into electron/license.js)\n');
    process.exit(1);
  }

  const months = flag('months') || '12';
  const grace = flag('grace') || '7';
  const machine = flag('machine');
  const expires = flag('expires');
  const contact = flag('contact') || '';

  let result;
  try {
    result = signKey(
      {
        shop,
        months: Number(months),
        machine,
        expires,
        grace: Number(grace),
        serial: nextSerial(LEDGER),
      },
      fs.readFileSync(PRIVATE_KEY, 'utf8')
    );
  } catch (err) {
    console.error(`\n✗ ${err.message}\n`);
    process.exit(1);
  }

  appendIssued(LEDGER, [
    csv(result.serial),
    csv(result.body.i),
    csv(result.body.e),
    csv(months),
    csv(shop),
    csv(result.machine || 'ANYP'),
    csv(grace),
    csv(result.key),
  ]);

  const dir = path.join(SHOPS_DIR, slugify(shop));
  fs.mkdirSync(dir, { recursive: true });
  const keyFile = path.join(dir, 'license.key');
  const infoFile = path.join(dir, 'shop-info.txt');
  fs.writeFileSync(keyFile, result.key + '\n', 'utf8');

  const info = [
    `Shop      : ${shop}`,
    contact ? `Contact   : ${contact}` : 'Contact   :',
    `Serial    : ${result.serial}`,
    `Months    : ${months}${expires ? `  (expires ${expires})` : ''}`,
    `Expires   : ${result.body.e}`,
    `Grace     : ${grace} day(s)`,
    `Machine   : ${result.machine || 'any PC'}`,
    `Generated : ${new Date().toISOString()}`,
    '',
    'এই দোকানের ইনস্টল ও সেটআপ ধাপ:',
    '  1. ইনস্টল: BDBBC POS Setup.exe',
    '  2. অ্যাপ খুললে activation পর্দায় এই ফোল্ডারের license.key-এর পুরো লেখাটা পেস্ট করে Activate',
    '  3. প্রথম লগইন: admin / Admin@123  → সাথে সাথে পাসওয়ার্ড বদলান',
    '  4. Settings → দোকানের নাম, ঠিকানা, currency, প্রিন্টার',
    '  5. Users → এই কোম্পানির Manager / Cashier বানান',
    '  6. Products / Categories / Suppliers → ডেটা ঢোকানো',
    '',
    'রিনিউ করতে: এই দোকানের জন্য আবার `npm run shop:new -- --shop "' + shop + '"` চালিয়ে',
    'নতুন license.key কাস্টমারকে দিন (পুরনো ফাইল replace হবে, ডেটা মুছবে না)।',
  ].join('\n');
  fs.writeFileSync(infoFile, info + '\n', 'utf8');

  const rel = (p) => path.relative(process.cwd(), p);
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`  ✅ নতুন দোকান তৈরি: ${shop}`);
  console.log('════════════════════════════════════════════════════════════');
  console.log(`  license.key : ${rel(keyFile)}`);
  console.log(`  shop-info   : ${rel(infoFile)}`);
  console.log(`  Expires     : ${result.body.e}`);
  console.log('\nওই license.key ফাইলটা কাস্টমারকে দিন; shop-info.txt আপনার রেকর্ডে রাখুন।\n');
}

main();
