#!/usr/bin/env node
/**
 * Pre-flight check for a desktop build. Run it BEFORE shipping an installer.
 *
 * The dangerous mistake is packaging a "standard" build: it folds
 * backend/.env's MONGODB_URI into cloudMongoUri, so every PC installed from it
 * syncs to the same cloud database and shop data mixes. This script refuses
 * that, and confirms the offline edition is wired correctly.
 *
 *   npm run check:build
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'build', 'config', 'app-config.json');

let failed = false;
const fail = (msg) => {
  console.error(`✗ ${msg}`);
  failed = true;
};
const ok = (msg) => console.log(`✓ ${msg}`);

console.log('BDBBC POS — build pre-flight check');
console.log('==================================');

if (!fs.existsSync(configPath)) {
  fail(`build/config/app-config.json not found — run the pack step first.`);
} else {
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  console.log(`edition       : ${cfg.edition}`);
  console.log(`mongoMode     : ${cfg.mongoMode}`);
  console.log(`cloudMongoUri : ${cfg.cloudMongoUri ? '(SET - shared cloud!)' : '(empty)'}`);
  console.log(`syncEnabled   : ${cfg.syncEnabled}`);
  console.log('');

  if (cfg.cloudMongoUri) {
    fail('cloudMongoUri is set — every PC installed from this build will SHARE data.');
    console.error('  For per-shop isolation, build with:  npm run dist:offline');
  } else {
    ok('cloudMongoUri is empty — no shop syncs to a shared cloud database.');
  }

  if (cfg.edition === 'offline' && cfg.mongoMode !== 'bundled') {
    fail(`offline edition must use mongoMode "bundled" (got "${cfg.mongoMode}").`);
  } else if (cfg.edition === 'offline') {
    ok('offline edition uses the bundled local database.');
  }
}

const mongod = path.join(root, 'build', 'mongodb', 'bin', 'mongod.exe');
if (fs.existsSync(mongod)) {
  ok(`bundled mongod.exe present (${(fs.statSync(mongod).size / 1048576).toFixed(1)} MB) — offline will work.`);
} else {
  console.log('ℹ  no bundled mongod.exe (expected for a cloud / external-DB build).');
}

// ── Nothing of our own source may travel to a customer ──────────────────────
console.log('');
let leak = false;

for (const p of ['build/backend/src', 'build/frontend/src']) {
  if (fs.existsSync(path.join(root, p))) {
    fail(`application source is shipped: ${p}`);
    leak = true;
  }
}

function walkFiles(dir, visit, skipNodeModules) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipNodeModules && entry.name === 'node_modules') continue;
      walkFiles(full, visit, skipNodeModules);
    } else {
      visit(full, entry.name);
    }
  }
}

const maps = [];
const tsFiles = [];
for (const p of ['build/backend', 'build/frontend']) {
  walkFiles(
    path.join(root, p),
    (full, name) => {
      if (name.endsWith('.map')) maps.push(path.relative(root, full));
      if (/\.tsx?$/.test(name) && !name.endsWith('.d.ts')) tsFiles.push(path.relative(root, full));
    },
    true // ignore node_modules — those are public packages
  );
}

if (maps.length) {
  fail(`${maps.length} source map(s) shipped (first: ${maps[0]})`);
  leak = true;
}
if (tsFiles.length) {
  fail(`${tsFiles.length} TypeScript source file(s) shipped (first: ${tsFiles[0]})`);
  leak = true;
}
if (!leak) ok('no application source or source maps are shipped — compiled output only.');

const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
console.log('\nInstallers found:');
let any = false;
for (const dir of ['dist-offline-build', 'dist-electron', 'dist-electron-desktop']) {
  const d = path.join(root, dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d)) {
    if (/Setup .*\.exe$/i.test(f)) {
      const size = (fs.statSync(path.join(d, f)).size / 1048576).toFixed(1);
      console.log(`   ${dir}\\${f}  (${size} MB)`);
      any = true;
    }
  }
}
if (!any) console.log('   (none yet)');

// The installer name must carry the package.json version.
if (any) {
  const names = [];
  for (const dir of ['dist-offline-build', 'dist-electron', 'dist-electron-desktop']) {
    const d = path.join(root, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) if (/Setup .*\.exe$/i.test(f)) names.push(f);
  }
  const stale = names.filter((n) => !n.includes(version));
  if (stale.length) {
    console.log(`ℹ  other builds present (not v${version}): ${stale.join(', ')}`);
  }
}

console.log(`\npackage version: ${version}`);
console.log(failed ? '\nRESULT: FAILED — fix the above before shipping.' : '\nRESULT: OK — safe to ship.');

process.exit(failed ? 1 : 0);
