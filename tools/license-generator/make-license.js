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
 * Signing lives in sign.js (shared with the License Manager app). Each issued
 * key is appended to issued.csv so you keep a record of who has what.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline/promises');
const { signKey, nextSerial, appendIssued } = require('./sign');

const KEYS_DIR = path.join(__dirname, 'keys');
const PRIVATE_KEY = path.join(KEYS_DIR, 'private.pem');
const LEDGER = path.join(__dirname, 'issued.csv');

const csv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

function flag(name) {
  // Last occurrence wins, the way command-line tools normally behave.
  const i = process.argv.lastIndexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  if (!fs.existsSync(PRIVATE_KEY)) {
    console.error('\n✗ No signing key found.');
    console.error('  Run this first:  npm run license:init\n');
    process.exitCode = 1;
    return;
  }

  const privateKeyPem = fs.readFileSync(PRIVATE_KEY, 'utf8');
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
    console.log('\n─── BDBBC POS — license key generator ───\n');

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

    const graceRaw = flag('grace') || (await ask('Grace days after expiry? [0]: ', '0'));
    const grace = Number(graceRaw) || 0;
    const serial = flag('serial') || nextSerial(LEDGER);

    let result;
    try {
      result = signKey(
        { shop, months, expires: flag('expires'), machine: machineInput, grace, serial },
        privateKeyPem
      );
    } catch (err) {
      console.log(`\n✗ ${err.message}\n`);
      process.exitCode = 1;
      return;
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

    console.log('\n════════════════════════════════════════════════════════════');
    console.log(`  Shop      : ${shop}`);
    console.log(`  Serial    : ${result.serial}`);
    console.log(`  Issued    : ${result.body.i}`);
    console.log(`  Expires   : ${result.body.e}${grace ? `  (+${grace} day grace)` : ''}`);
    console.log(`  Machine   : ${result.machine ? result.machine.match(/.{4}/g).join('-') : 'any PC'}`);
    console.log('════════════════════════════════════════════════════════════\n');

    console.log('License key (send this to the shop):\n');
    console.log(result.key);
    console.log('\nSaved to issued.csv\n');
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exitCode = 1;
});
