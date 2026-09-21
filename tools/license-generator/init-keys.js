#!/usr/bin/env node
'use strict';

/**
 * Creates the Ed25519 keypair that signs every license key.
 *
 *   node tools/license-generator/init-keys.js
 *
 * Run this ONCE on your own machine. It writes:
 *   tools/license-generator/keys/private.pem   ← sign keys with this. NEVER share it.
 *   tools/license-generator/keys/public.pem    ← a copy of what goes into the app.
 *
 * The public key printed at the end is pasted into electron/license.js. The app
 * can then check a key is genuine without ever being able to create one: making
 * a key needs the private key, and that file never leaves this folder (and is
 * git-ignored, so it can never be committed or packed into the installer).
 *
 * ⚠  Back up keys/private.pem somewhere safe (password manager, USB drive).
 *    Lose it and you cannot issue licenses for already-installed apps —
 *    every shop would need a reinstall with a new public key.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEYS_DIR = path.join(__dirname, 'keys');
const PRIVATE_KEY = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY = path.join(KEYS_DIR, 'public.pem');

function main() {
  const force = process.argv.includes('--force');

  if (fs.existsSync(PRIVATE_KEY) && !force) {
    console.log('\nA keypair already exists:');
    console.log(`  ${path.relative(process.cwd(), PRIVATE_KEY)}`);
    console.log('\nNothing was changed. Re-run with --force to replace it');
    console.log('(the old one would stop working for any key already issued).\n');
    return;
  }

  fs.mkdirSync(KEYS_DIR, { recursive: true });

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

  const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const publicPem = publicKey.export({ type: 'spki', format: 'pem' });

  fs.writeFileSync(PRIVATE_KEY, privatePem, { encoding: 'utf8', mode: 0o600 });
  fs.writeFileSync(PUBLIC_KEY, publicPem, 'utf8');

  console.log('\n✓ keypair created');
  console.log(`  private : ${path.relative(process.cwd(), PRIVATE_KEY)}`);
  console.log(`  public  : ${path.relative(process.cwd(), PUBLIC_KEY)}`);

  console.log('\n─── paste this into electron/license.js ───\n');
  console.log(`const PUBLIC_KEY_PEM = \`${publicPem.trim()}\`;`);
  console.log('\n───────────────────────────────────────────');
  console.log('\n⚠  keys/private.pem is the master secret. Back it up and never share it.\n');
}

main();
