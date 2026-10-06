#!/usr/bin/env node
/**
 * One product version for everything. The ROOT package.json is the source of
 * truth: electron-builder reads it for the installer file names and
 * app.getVersion(), so bumping it here is all it takes.
 *
 *   node scripts/set-version.js --show          # print the current version
 *   node scripts/set-version.js 0.1.1           # set an exact version
 *   node scripts/set-version.js --bump patch|minor|major
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const TARGETS = [
  path.join(root, 'package.json'),
  path.join(root, 'backend', 'package.json'),
  path.join(root, 'frontend', 'package.json'),
];

const readPkg = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writePkg = (p, pkg) => fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');

const args = process.argv.slice(2);
const current = readPkg(TARGETS[0]).version;

if (args.length === 0 || args[0] === '--show') {
  console.log(`BDBBC POS version: ${current}`);
  for (const p of TARGETS) console.log(`  ${path.relative(root, p)}`);
  process.exit(0);
}

let next;
if (args[0] === '--bump') {
  const kind = args[1] || 'patch';
  const [maj, min, pat] = current.split('.').map(Number);
  if (kind === 'major') next = `${maj + 1}.0.0`;
  else if (kind === 'minor') next = `${maj}.${min + 1}.0`;
  else if (kind === 'patch') next = `${maj}.${min}.${pat + 1}`;
  else {
    console.error(`Unknown bump kind "${kind}" — use patch, minor or major.`);
    process.exit(1);
  }
} else {
  next = String(args[0]).replace(/^v/, '');
}

if (!/^\d+\.\d+\.\d+$/.test(next)) {
  console.error(`Invalid version "${next}" — use MAJOR.MINOR.PATCH, e.g. 0.1.1`);
  process.exit(1);
}

for (const target of TARGETS) {
  const pkg = readPkg(target);
  pkg.version = next;
  writePkg(target, pkg);
  console.log(`✓ ${path.relative(root, target)} → ${next}`);
}

console.log(
  '\nInstallers will be named:' +
    `\n  BDBBC POS Setup ${next}.exe` +
    `\n  BDBBC POS Desktop Setup ${next}.exe` +
    `\n  BDBBC License Manager Setup ${next}.exe`
);
