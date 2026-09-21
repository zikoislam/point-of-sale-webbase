'use strict';

/**
 * License checking for the desktop app.
 *
 * The shop's PC is often offline, so a key cannot be validated by asking a
 * server. Instead every key is signed by the vendor's private key and verified
 * here with the public key below — which works with no internet at all, and
 * means this file being readable does not let anyone *create* a key.
 *
 * A key looks like:   POS1.<payload>.<signature>
 *   payload    base64url JSON: { c: shop, i: issued, e: expires, m: machine, n: serial, g: grace }
 *   signature  Ed25519 signature over "POS1.<payload>"
 *
 * Where the key is kept: %APPDATA%\<app>\license.key
 *
 * Known limit: app.asar is a zip, so a determined person could edit the public
 * key below and sign their own licenses. Stopping that needs code signing or
 * obfuscation; this is a deterrent, not an unbreakable lock.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

/** Printed by `npm run license:init` — replace if you ever make a new keypair. */
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAgBIDQq9hEYxNNMLZlKOReutzCtmdRdx7trfhq/Cuhv4=
-----END PUBLIC KEY-----`;

const VERSION_TAG = 'POS1';
const LICENSE_FILE = 'license.key';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Grace period default when a key does not state one. */
const DEFAULT_GRACE_DAYS = 0;

/** Show a renewal reminder from this many days before expiry. */
const REMIND_DAYS = 15;

const PLACEHOLDER = 'PASTE_YOUR_PUBLIC_KEY';

let cachedMachineId = null;

// ── machine id ───────────────────────────────────────────────────────────────

const hash12 = (value) =>
  crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12).toUpperCase();

/**
 * A stable fingerprint of this PC. Windows' MachineGuid survives reboots,
 * Windows updates and hardware changes far better than a MAC address, and it
 * can be read without administrator rights.
 */
function getMachineId() {
  if (cachedMachineId) return cachedMachineId;

  try {
    if (process.platform === 'win32') {
      const out = execFileSync(
        'reg',
        ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
        { windowsHide: true, encoding: 'utf8', timeout: 5000 }
      );
      const match = /MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]+)/.exec(out);
      if (match) {
        cachedMachineId = hash12(match[1]);
        return cachedMachineId;
      }
    }
  } catch {
    /* fall through to the weaker fingerprint */
  }

  cachedMachineId = hash12(`${os.hostname()}|${os.platform()}|${os.arch()}`);
  return cachedMachineId;
}

/** ABCDEF012345 → ABCD-EF01-2345, for reading over the phone. */
function formatMachineId(id) {
  const clean = String(id || '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  return clean.replace(/(.{4})(?=.)/g, '$1-');
}

// ── key parsing / verification ───────────────────────────────────────────────

const fromB64Url = (value) =>
  Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const toLocalDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const today = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

/**
 * Checks a key against the embedded public key, this machine and the clock.
 *
 * @returns {{ valid: boolean, reason: string, message: string, info: object|null,
 *             daysRemaining: number|null }}
 *   reason is one of: missing, malformed, bad-signature, wrong-machine, expired, ok
 */
function evaluate(rawKey, machineId = getMachineId(), at = new Date()) {
  const missing = { valid: false, reason: 'missing', message: 'No license key is installed.', info: null, daysRemaining: null };

  if (PUBLIC_KEY_PEM.includes(PLACEHOLDER)) {
    return {
      valid: false,
      reason: 'not-configured',
      message: 'This build has no license public key — run `npm run license:init` and paste it into electron/license.js.',
      info: null,
      daysRemaining: null,
    };
  }

  const key = String(rawKey || '').trim();
  if (!key) return missing;

  const parts = key.split('.');
  if (parts.length !== 3 || parts[0] !== VERSION_TAG) {
    return {
      valid: false,
      reason: 'malformed',
      message: 'This is not a valid Unique POS license key.',
      info: null,
      daysRemaining: null,
    };
  }

  const [, bodyB64, sigB64] = parts;
  const signed = `${VERSION_TAG}.${bodyB64}`;

  let signatureOk = false;
  try {
    signatureOk = crypto.verify(
      null,
      Buffer.from(signed, 'utf8'),
      crypto.createPublicKey(PUBLIC_KEY_PEM),
      fromB64Url(sigB64)
    );
  } catch {
    signatureOk = false;
  }

  if (!signatureOk) {
    return {
      valid: false,
      reason: 'bad-signature',
      message: 'This license key was not issued by Bdbbc.com.',
      info: null,
      daysRemaining: null,
    };
  }

  let info;
  try {
    info = JSON.parse(fromB64Url(bodyB64).toString('utf8'));
  } catch {
    return {
      valid: false,
      reason: 'malformed',
      message: 'The license key is damaged.',
      info: null,
      daysRemaining: null,
    };
  }

  const expiryDate = toLocalDate(info?.e);
  if (!info || !expiryDate) {
    return {
      valid: false,
      reason: 'malformed',
      message: 'The license key has no valid expiry date.',
      info: null,
      daysRemaining: null,
    };
  }

  // Machine binding is optional: a key issued without one runs anywhere.
  const boundTo = String(info.m || '').toUpperCase();
  if (boundTo && boundTo !== String(machineId).toUpperCase()) {
    return {
      valid: false,
      reason: 'wrong-machine',
      message: 'This license key belongs to a different computer.',
      info,
      daysRemaining: null,
    };
  }

  const grace = Number.isFinite(Number(info.g)) ? Number(info.g) : DEFAULT_GRACE_DAYS;
  const graceEnd = new Date(expiryDate.getTime() + grace * DAY_MS);
  const daysRemaining = Math.ceil((expiryDate.getTime() - at.getTime()) / DAY_MS);

  if (at.getTime() > graceEnd.getTime()) {
    return {
      valid: false,
      reason: 'expired',
      message: `This license expired on ${info.e}. A new key is needed to keep using the app.`,
      info,
      daysRemaining,
    };
  }

  return { valid: true, reason: 'ok', message: 'License is valid.', info, daysRemaining };
}

// ── storage ──────────────────────────────────────────────────────────────────

const licensePath = (app) => path.join(app.getPath('userData'), LICENSE_FILE);

function readStoredKey(app) {
  try {
    return fs.readFileSync(licensePath(app), 'utf8').trim();
  } catch {
    return '';
  }
}

function writeStoredKey(app, key) {
  fs.mkdirSync(path.dirname(licensePath(app)), { recursive: true });
  fs.writeFileSync(licensePath(app), String(key).trim(), 'utf8');
}

/** Reads whatever key is installed and checks it. */
function checkStored(app) {
  return evaluate(readStoredKey(app));
}

module.exports = {
  PUBLIC_KEY_PEM,
  LICENSE_FILE,
  REMIND_DAYS,
  licensePath,
  getMachineId,
  formatMachineId,
  evaluate,
  readStoredKey,
  writeStoredKey,
  checkStored,
  today,
};
