#!/usr/bin/env node
'use strict';

/**
 * Shows the license installed on THIS computer.
 *
 *   npm run license:check
 *   npm run license:check -- --key "POS1.…"     ← যেকোনো কী আগে থেকে যাচাই করে দেখো
 *
 * এটি অ্যাপের নিজের ভেরিফায়ার ব্যবহার করে (electron/license.js), তাই যা দেখাবে
 * ঠিক সেটাই অ্যাপও দেখে — পাঠানোর আগে কী ঠিক আছে কি না নিশ্চিত হওয়ার সহজ উপায়।
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const APP_DIR_NAME = 'Unique POS';
const LICENSE_FILE = 'license.key';

const license = require(path.join(__dirname, '..', '..', 'electron', 'license.js'));

function licensePath() {
  const base =
    process.platform === 'win32'
      ? process.env.APPDATA
      : path.join(os.homedir(), '.config');

  return path.join(base || os.homedir(), APP_DIR_NAME, LICENSE_FILE);
}

const line = (label, value) => console.log(`  ${label.padEnd(14)}: ${value}`);

const keyFlagIndex = process.argv.indexOf('--key');
const suppliedKey = keyFlagIndex !== -1 ? process.argv[keyFlagIndex + 1] : null;

const file = licensePath();
const machineId = license.getMachineId();

console.log('\n── Unique POS license check ──\n');
line('This computer', license.formatMachineId(machineId));

let key = suppliedKey;
let source = 'given on the command line';

if (!key) {
  source = file;
  try {
    key = fs.readFileSync(file, 'utf8').trim();
    line('License file', `${file}  (found)`);
  } catch {
    line('License file', `${file}  (not found)`);
  }
} else {
  line('License file', '(ignored — checking the key you supplied)');
}

console.log('');

if (!key) {
  console.log('  Status        : NO LICENSE INSTALLED');
  console.log('\n  এই কম্পিউটারে কোনো লাইসেন্স নেই — অ্যাপ খুললে অ্যাক্টিভেশন পর্দা আসবে।');
  console.log('  কী বানাও:  npm run license:new\n');
  process.exitCode = 1;
  return;
}

const result = license.evaluate(key, machineId);
const info = result.info || {};

line('Status', result.valid ? 'VALID' : `NOT VALID  (${result.reason})`);

if (info.c) line('Shop', info.c);
if (info.n) line('Serial', info.n);
if (info.i) line('Issued', info.i);
if (info.e) line('Expires', info.e);
if (result.daysRemaining !== null && result.daysRemaining !== undefined) {
  line('Days left', result.daysRemaining);
}

line(
  'Bound to',
  info.m ? `${license.formatMachineId(info.m)}${info.m === machineId ? '  (this computer)' : '  (a different computer)'}` : 'any computer'
);
if (info.g) line('Grace', `${info.g} day(s) after expiry`);
line('Checked from', source);

console.log('');

if (result.valid) {
  const soon = result.daysRemaining <= license.REMIND_DAYS;
  console.log(
    soon
      ? `  ⚠ লাইসেন্স আর ${result.daysRemaining} দিন চলবে (${info.e}) — নতুন কী বানানোর সময় হয়ে এসেছে।\n`
      : `  ✓ লাইসেন্স ঠিক আছে — ${info.e} পর্যন্ত চলবে।\n`
  );
} else {
  console.log(`  ✗ ${result.message}\n`);
  console.log('  নতুন কী বানাও:  npm run license:new\n');
  process.exitCode = 1;
}
