'use strict';

/**
 * Shared Ed25519 license signing — the single source of truth.
 *
 * Used by the CLI tools (make-license.js, new-shop.js) and by the BDBBC License
 * Manager desktop app, so every key is produced exactly the same way.
 *
 * Key format:  POS1.<base64url(payload-json)>.<base64url(signature)>
 * Payload keys (compact):  c=shop  i=issued  e=expires  m=machine  n=serial  g=grace
 */

const crypto = require('crypto');
const fs = require('fs');

const VERSION_TAG = 'POS1';

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

/** "abcd-ef01-2345" and "ABCDEF012345" both become ABCDEF012345; "" = any PC. */
function normaliseMachine(value) {
  const raw = String(value || '').trim();
  if (!raw || /^(any|-|none|\*)$/i.test(raw)) return '';
  return raw.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
}

/** Next serial from an issued.csv ledger ("0001", "0002", …). */
function nextSerial(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) return '0001';
  const rows = fs
    .readFileSync(ledgerPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('serial,'));
  return String(rows.length + 1).padStart(4, '0');
}

/** Append one row to the issued.csv ledger, creating the header if needed. */
function appendIssued(ledgerPath, row) {
  if (!fs.existsSync(ledgerPath)) {
    fs.writeFileSync(ledgerPath, 'serial,issued,expires,months,shop,machine,grace,key\n', 'utf8');
  }
  fs.appendFileSync(ledgerPath, row.join(',') + '\n', 'utf8');
}

/**
 * Signs one license.
 *
 * @param {object} input  { shop, months?, expires?, machine?, grace?, serial }
 * @param {string} privateKeyPem  PEM contents of keys/private.pem
 * @returns {{ key:string, body:object, machine:string, serial:string, months:number, grace:number }}
 */
function signKey(input, privateKeyPem) {
  const shop = String(input.shop || '').trim();
  if (!shop) throw new Error('A shop name is required');
  if (!privateKeyPem) throw new Error('No signing key provided');

  const months = input.months != null ? Number(input.months) : 3;
  const machine = normaliseMachine(input.machine);
  const grace = Number(input.grace) || 0;

  if (machine && machine.length !== 12) {
    throw new Error(`Machine ID must be 12 hex characters (like A1B2C3D4E5F6) — got "${input.machine}"`);
  }

  const issued = new Date();
  const expiryDate = input.expires
    ? new Date(`${input.expires}T00:00:00`)
    : addMonths(issued, Number.isFinite(months) && months > 0 ? months : 3);
  if (Number.isNaN(expiryDate.getTime())) {
    throw new Error(`"${input.expires}" is not a valid date (use YYYY-MM-DD)`);
  }

  const serial = input.serial || '0001';
  const body = {
    c: shop,
    i: fmtDate(issued),
    e: fmtDate(expiryDate),
    m: machine,
    n: serial,
    g: grace,
  };

  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const publicKey = crypto.createPublicKey(privateKey);

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
  if (!ok) throw new Error('Self-check failed — the key did not verify');

  return { key, body, machine, serial, months, grace };
}

module.exports = {
  VERSION_TAG,
  b64url,
  fmtDate,
  addMonths,
  normaliseMachine,
  nextSerial,
  appendIssued,
  signKey,
};
