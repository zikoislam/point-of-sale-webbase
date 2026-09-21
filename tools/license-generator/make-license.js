#!/usr/bin/env node
'use strict';

/**
 * Issues a license key for one shop.
 *
 *   npm run license:new                                   → asks you questions
 *   npm run license:new -- --shop "Rahim Store" --months 3
 *
 * Flags (all optional — anything left out is asked for interactively):
 *   --shop "Name"        shop / customer name printed on the license
 *   --months 3           how long the key stays valid (default 3)
 *   --expires 2027-03-01 fixed expiry date instead of --months
 *   --machine XXXX-XXXX-XXXX  lock the key to one PC (blank = any PC)
 *   --grace 7            extra days allowed after expiry (default 0)
 *   --serial 0007        override the auto serial number
 *
 * Every key is signed with keys/private.pem, so the app can prove it is genuine
 * without being able to create one. Each issued key is also appended to
 * issued.csv so you keep a record of who has what.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');

const VERSION_TAG = 'POS1';
const KEYS_DIR = path.join(__dirname, 'keys');
const PRIVATE_KEY = path.join(KEYS_DIR, 'private.pem');
const LEDGER = path.join(__dirname, 'issued.csv');

// ── helpers ──────────────────────────────────────────────────────────────────

const b64url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Local calendar date as YYYY-MM-DD — the shop counts in local days. */
const fmtDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function addMonths(date, months) {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  // 31 Jan + 1 month must land on 28/29 Feb, not 2/3 March.
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

/** "abcd-ef01-2345" and "ABCDEF012345" both become ABCDEF012345. */
const normaliseMachine = (value) => {
  const raw = String(value || '').trim();
  // Anything meaning "no binding" — the key then works on any PC.
  if (!raw || /^(any|-|none|\*)$/i.test(raw)) return '';
  return raw.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
};

function flag(name) {
  // Last occurrence wins, the way command-line tools normally behave.
  const i = process.argv.lastIndexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function nextSerial() {
  if (!fs.existsSync(LEDGER)) return '0001';
  const rows = fs
    .readFileSync(LEDGER, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('serial,'));
  return String(rows.length + 1).padStart(4, '0');
}

function recordLicense(row) {
  if (!fs.existsSync(LEDGER)) {
    fs.writeFileSync(LEDGER, 'serial,issued,expires,months,shop,machine,grace,key\n', 'utf8');
  }
  fs.appendFileSync(LEDGER, row.join(',') + '\n', 'utf8');
}

const csv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(PRIVATE_KEY)) {
    console.error('\n✗ No signing key found.');
    console.error('  Run this first:  npm run license:init\n');
    process.exitCode = 1;
    return;
  }

  const privateKey = crypto.createPrivateKey(fs.readFileSync(PRIVATE_KEY, 'utf8'));
  const publicKey = crypto.createPublicKey(privateKey);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // When this runs from a script or CI there is nobody to answer, so missing
  // flags fall back to their defaults instead of hanging on a prompt.
  const interactive = Boolean(process.stdin.isTTY);
  const ask = async (question, fallback) => {
    if (!interactive) return fallback;
    const answer = (await rl.question(question)).trim();
    return answer || fallback;
  };

  try {
    console.log('\n─── Unique POS — license key generator ───\n');

    const shop = flag('shop') || (await ask('Shop / customer name: ', ''));
    if (!shop) {
      console.log('\n✗ A shop name is required.\n');
      process.exitCode = 1;
      return;
    }

    const monthsRaw = flag('months') || (await ask('Valid for how many months? [3]: ', '3'));
    const months = Number(monthsRaw);
    if (!Number.isFinite(months) || months <= 0) {
      console.log(`\n✗ "${monthsRaw}" is not a valid number of months.\n`);
      process.exitCode = 1;
      return;
    }

    const machineInput =
      flag('machine') !== undefined
        ? flag('machine')
        : await ask('Lock to one PC? paste its Machine ID, or Enter for any PC: ', '');
    const machine = normaliseMachine(machineInput);

    if (machine && machine.length !== 12) {
      console.log(
        `\n✗ A Machine ID is 12 hex characters (like A1B2C3D4E5F6) — got "${machineInput}".\n`
      );
      process.exitCode = 1;
      return;
    }

    const graceRaw = flag('grace') || (await ask('Grace days after expiry? [0]: ', '0'));
    const grace = Number(graceRaw) || 0;

    const issued = new Date();
    const expiryDate = flag('expires')
      ? new Date(`${flag('expires')}T00:00:00`)
      : addMonths(issued, months);

    if (Number.isNaN(expiryDate.getTime())) {
      console.log(`\n✗ "${flag('expires')}" is not a valid date (use YYYY-MM-DD).\n`);
      process.exitCode = 1;
      return;
    }

    const serial = flag('serial') || nextSerial();

    const body = {
      c: shop,
      i: fmtDate(issued),
      e: fmtDate(expiryDate),
      m: machine,
      n: serial,
      g: grace,
    };

    const signed = `${VERSION_TAG}.${b64url(Buffer.from(JSON.stringify(body), 'utf8'))}`;
    const signature = crypto.sign(null, Buffer.from(signed, 'utf8'), privateKey);
    const key = `${signed}.${b64url(signature)}`;

    // Prove the key verifies before handing it over.
    const ok = crypto.verify(
      null,
      Buffer.from(signed, 'utf8'),
      publicKey,
      Buffer.from(key.split('.')[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    );

    if (!ok) {
      console.log('\n✗ Self-check failed — the key did not verify. Nothing was written.\n');
      process.exitCode = 1;
      return;
    }

    recordLicense([
      csv(serial),
      csv(body.i),
      csv(body.e),
      csv(months),
      csv(shop),
      csv(machine || 'ANYP'),
      csv(grace),
      csv(key),
    ]);

    console.log('\n════════════════════════════════════════════════════════════');
    console.log(`  Shop      : ${shop}`);
    console.log(`  Serial    : ${serial}`);
    console.log(`  Issued    : ${body.i}`);
    console.log(`  Expires   : ${body.e}${grace ? `  (+${grace} day grace)` : ''}`);
    console.log(`  Machine   : ${machine ? machine.match(/.{4}/g).join('-') : 'any PC'}`);
    console.log('════════════════════════════════════════════════════════════\n');

    console.log('License key (send this to the shop):\n');
    console.log(key);
    console.log('\nSaved to issued.csv\n');
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exitCode = 1;
});
