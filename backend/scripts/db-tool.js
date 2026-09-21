#!/usr/bin/env node
/**
 * db-tool.js — MongoDB maintenance CLI for the POS system.
 *
 * Every update/delete/insert/restore takes an automatic backup of the affected
 * collection FIRST, so a mistake is always reversible.
 *
 * Run from the backend folder:   node scripts/db-tool.js <command> [args]
 * or via npm:                    npm run db -- <command> [args]
 *
 * IMPORTANT: editing documents directly bypasses the app's business logic.
 * Changing stock, account balances or customer dues here will NOT create the
 * matching stock movement / ledger entry, so reports will drift. Prefer the UI
 * for those, and use this tool for fixing names, contacts, typos and one-off
 * repairs.
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const MAX_LIST = 50;

// Collections that must not be edited by hand — they are security sensitive.
const PROTECTED = {
  token_blacklist:
    'Editing the token blacklist can re-enable sessions that were already logged out.',
  roles:
    'Role permissions drive all access control. Change them through the Roles page.',
};

// ─────────────────────────────────────────────────────────── arg helpers ──

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

/**
 * Accepts three shapes so quoting never gets in the way on Windows shells:
 *   '{"code":"DAIRY"}'   full JSON
 *   @filter.json         JSON from a file
 *   code=DAIRY           simple key=value pairs (comma separated)
 */
function parseScalar(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  return raw;
}

function parsePairs(arg) {
  const out = {};
  for (const chunk of arg.split(',')) {
    if (!chunk.trim()) continue;
    const i = chunk.indexOf('=');
    if (i === -1) fail(`Expected key=value, got "${chunk.trim()}"`);
    out[chunk.slice(0, i).trim()] = parseScalar(chunk.slice(i + 1).trim());
  }
  return out;
}

function parseInput(arg, label) {
  if (arg === undefined) return undefined;
  const trimmed = arg.trim();

  if (trimmed.startsWith('@')) {
    try {
      return JSON.parse(fs.readFileSync(trimmed.slice(1), 'utf8'));
    } catch (e) {
      fail(`${label} file could not be read as JSON: ${e.message}`);
    }
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      fail(
        `${label} is not valid JSON: ${e.message}\n  received: ${arg}\n` +
          `  tip: on PowerShell double quotes get stripped — use key=value syntax or @file.json`
      );
    }
  }

  return parsePairs(trimmed);
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

// ────────────────────────────────────────── type-safe backup serialisation ──

/**
 * JSON.stringify would turn ObjectId into a 24-char string and Date into an ISO
 * string, which cannot be restored faithfully. Tag them instead.
 */
function encode(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof mongoose.Types.ObjectId) return { $oid: value.toHexString() };
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map(encode);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = encode(v);
    return out;
  }
  return value;
}

function decode(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(decode);
  if (typeof value === 'object') {
    if (typeof value.$oid === 'string') return new mongoose.Types.ObjectId(value.$oid);
    if (typeof value.$date === 'string') return new Date(value.$date);
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = decode(v);
    return out;
  }
  return value;
}

/** Accepts a 24-hex string anywhere an ObjectId is expected. */
function coerceId(value) {
  if (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return value;
}

function normaliseDoc(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const out = { ...doc };
  if (out._id) out._id = coerceId(out._id);
  // Common filter keys that are ObjectIds
  for (const key of ['productId', 'variantId', 'customerId', 'supplierId', 'shiftId', 'roleId', 'accountId', 'categoryId', 'brandId', 'saleId', 'referenceId']) {
    if (typeof out[key] === 'string' && /^[0-9a-fA-F]{24}$/.test(out[key])) out[key] = coerceId(out[key]);
  }
  return out;
}

// ───────────────────────────────────────────────────────────────── backup ──

function backupDir() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  return BACKUP_DIR;
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function backupCollection(db, name, reason) {
  backupDir();
  const docs = await db.collection(name).find({}).toArray();
  const file = path.join(BACKUP_DIR, `${stamp()}--${name}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        collection: name,
        reason,
        takenAt: new Date().toISOString(),
        database: db.databaseName,
        count: docs.length,
        documents: docs.map(encode),
      },
      null,
      2
    ),
    'utf8'
  );
  console.log(`  💾 backup: ${path.relative(process.cwd(), file)}  (${docs.length} docs)`);
  return file;
}

// ──────────────────────────────────────────────────────────────── commands ──

async function cmdCollections(db) {
  const names = (await db.listCollections().toArray()).map((c) => c.name).sort();
  console.log(`\nDatabase: ${db.databaseName}  (${names.length} collections)\n`);
  for (const n of names) {
    const count = await db.collection(n).countDocuments();
    const mark = PROTECTED[n] ? '  ⚠ protected' : '';
    console.log(`  ${n.padEnd(28)} ${String(count).padStart(6)}${mark}`);
  }
  console.log();
}

function printDocs(docs) {
  if (docs.length === 0) {
    console.log('  (no matching documents)\n');
    return;
  }
  for (const d of docs.slice(0, MAX_LIST)) {
    console.log('  ' + JSON.stringify(d, null, 2).split('\n').join('\n  '));
    console.log('  ' + '─'.repeat(60));
  }
  if (docs.length > MAX_LIST) console.log(`  … and ${docs.length - MAX_LIST} more\n`);
}

async function cmdList(db, coll, limit) {
  const docs = await db.collection(coll).find({}).limit(limit).toArray();
  const total = await db.collection(coll).countDocuments();
  console.log(`\n${coll}: showing ${docs.length} of ${total}\n`);
  printDocs(docs);
}

async function cmdFind(db, coll, filter) {
  const docs = await db.collection(coll).find(normaliseDoc(filter)).limit(MAX_LIST).toArray();
  console.log(`\n${coll}: ${docs.length} match(es)\n`);
  printDocs(docs);
}

async function cmdInsert(db, coll, doc) {
  guardProtected(coll);
  const payload = normaliseDoc(doc);
  console.log(`\nInserting into ${coll}…`);
  await backupCollection(db, coll, 'before insert');
  const res = await db.collection(coll).insertOne(payload);
  console.log(`  ✓ inserted _id=${res.insertedId}\n`);
}

async function cmdUpdate(db, coll, filter, update) {
  guardProtected(coll);
  const f = normaliseDoc(filter);
  let u = update || {};

  // A plain { name: "x" } means "set these fields"
  if (!Object.keys(u).some((k) => k.startsWith('$'))) u = { $set: u };

  const setPart = u.$set || u;

  if ('_id' in setPart) fail('Refusing to change _id. Nothing was modified.');
  if ('_id' in u) fail('Refusing to change _id. Nothing was modified.');

  const before = await db.collection(coll).find(f).toArray();
  if (before.length === 0) fail(`No documents match ${JSON.stringify(filter)}. Nothing changed.`);

  console.log(`\nAbout to update ${before.length} document(s) in ${coll}:`);
  for (const d of before.slice(0, 10)) console.log('  •', JSON.stringify(d));

  await backupCollection(db, coll, 'before update');
  const res = await db.collection(coll).updateMany(f, u);

  console.log(`  ✓ matched ${res.matchedCount}, modified ${res.modifiedCount}`);

  const after = await db.collection(coll).find(f).toArray();
  console.log('\nAfter:');
  printDocs(after);
}

async function cmdDelete(db, coll, filter, confirmed) {
  guardProtected(coll);
  const f = normaliseDoc(filter);

  if (Object.keys(f).length === 0 && !hasFlag('--all')) {
    fail('Empty filter would delete EVERY document. Pass --all if that is really what you want.');
  }

  const targets = await db.collection(coll).find(f).toArray();

  if (!confirmed) {
    console.log(`\nDRY RUN — ${targets.length} document(s) in ${coll} would be deleted:`);
    for (const d of targets.slice(0, 10)) console.log('  •', JSON.stringify(d));
    if (targets.length > 10) console.log(`  … and ${targets.length - 10} more`);
    console.log('\nNothing was deleted. Re-run with --yes to confirm.\n');
    return;
  }

  if (targets.length === 0) fail('No documents matched. Nothing deleted.');

  await backupCollection(db, coll, 'before delete');
  const res = await db.collection(coll).deleteMany(f);
  console.log(`  ✓ deleted ${res.deletedCount} document(s) from ${coll}\n`);
}

async function cmdBackup(db, coll) {
  if (coll) {
    await backupCollection(db, coll, 'manual backup');
    console.log();
    return;
  }
  backupDir();
  const names = (await db.listCollections().toArray()).map((c) => c.name).sort();
  const dir = path.join(BACKUP_DIR, `full-${stamp()}`);
  fs.mkdirSync(dir, { recursive: true });

  let total = 0;
  console.log(`\nFull backup → ${path.relative(process.cwd(), dir)}\n`);
  for (const n of names) {
    const docs = await db.collection(n).find({}).toArray();
    fs.writeFileSync(
      path.join(dir, `${n}.json`),
      JSON.stringify({ collection: n, count: docs.length, documents: docs.map(encode) }, null, 2),
      'utf8'
    );
    console.log(`  ${n.padEnd(28)} ${docs.length}`);
    total += docs.length;
  }
  fs.writeFileSync(
    path.join(dir, '_manifest.json'),
    JSON.stringify({ database: db.databaseName, takenAt: new Date().toISOString(), collections: names.length, documents: total }, null, 2),
    'utf8'
  );
  console.log(`\n  ✓ ${names.length} collections, ${total} documents\n`);
}

async function cmdBackups() {
  backupDir();
  const files = fs
    .readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => e.name)
    .sort()
    .reverse();
  const dirs = fs
    .readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse();

  console.log(`\nBackups in ${path.relative(process.cwd(), BACKUP_DIR)}\n`);
  console.log('  single collections:');
  files.slice(0, 25).forEach((f) => console.log(`    ${f}`));
  if (files.length === 0) console.log('    (none yet)');
  console.log('\n  full backups:');
  dirs.slice(0, 10).forEach((d) => console.log(`    ${d}/`));
  if (dirs.length === 0) console.log('    (none yet)');
  console.log();
}

async function cmdRestore(db, file, confirmed) {
  if (!file) fail('Usage: restore <backupFile.json> [--yes]');
  const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) fail(`Backup file not found: ${abs}`);

  const parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));

  // Backups taken from the app (Settings → Backup, or the nightly job) hold
  // every collection in one file, tagged `type: "full"`.
  if (parsed && parsed.type === 'full' && parsed.data && typeof parsed.data === 'object') {
    return restoreFullBackup(db, abs, parsed, confirmed);
  }

  const coll = parsed.collection;
  const docs = parsed.documents;
  if (!coll || !Array.isArray(docs)) fail('Not a db-tool backup file (missing collection/documents).');

  console.log(`\nRestore ${docs.length} document(s) into "${coll}" from ${path.basename(abs)}`);

  if (!confirmed) {
    console.log('Nothing was written. Re-run with --yes to confirm.\n');
    return;
  }

  if (PROTECTED[coll]) console.log(`  ⚠ ${PROTECTED[coll]}`);

  // Snapshot whatever is there now so even a restore is reversible.
  await backupCollection(db, coll, 'before restore');

  let added = 0;
  let replaced = 0;
  for (const raw of docs) {
    const doc = decode(raw);
    const res = await db.collection(coll).replaceOne({ _id: doc._id }, doc, { upsert: true });
    if (res.upsertedCount) added++;
    else if (res.modifiedCount) replaced++;
  }
  console.log(`  ✓ ${added} inserted, ${replaced} updated in ${coll}\n`);
}

/**
 * Restore a full (all-collections) backup produced by the app. Like the single
 * collection restore this is an upsert — documents missing from the backup are
 * left alone — and every affected collection is snapshotted first.
 */
async function restoreFullBackup(db, abs, parsed, confirmed) {
  const names = Object.keys(parsed.data);
  const totalDocs = names.reduce((n, c) => n + (Array.isArray(parsed.data[c]) ? parsed.data[c].length : 0), 0);

  console.log(`\nRestore FULL backup from ${path.basename(abs)}`);
  console.log(`  taken at : ${parsed.takenAt || 'unknown'}  (trigger: ${parsed.trigger || 'n/a'})`);
  console.log(`  database : ${parsed.database || 'unknown'}  (connected to: ${db.databaseName})`);
  console.log(`  contents : ${names.length} collections, ${totalDocs} documents\n`);

  if (!confirmed) {
    console.log('Nothing was written. Re-run with --yes to confirm.\n');
    return;
  }

  let added = 0;
  let replaced = 0;

  for (const coll of names) {
    const docs = Array.isArray(parsed.data[coll]) ? parsed.data[coll] : [];
    if (PROTECTED[coll]) console.log(`  ⚠ ${PROTECTED[coll]}`);

    await backupCollection(db, coll, 'before full restore');

    for (const raw of docs) {
      const doc = decode(raw);
      if (!doc || doc._id === undefined) continue;
      const res = await db.collection(coll).replaceOne({ _id: doc._id }, doc, { upsert: true });
      if (res.upsertedCount) added++;
      else if (res.modifiedCount) replaced++;
    }
    console.log(`  ${coll.padEnd(28)} ${docs.length}`);
  }

  console.log(`\n  ✓ ${added} inserted, ${replaced} updated across ${names.length} collections\n`);
}

function guardProtected(coll) {
  if (!PROTECTED[coll]) return;
  console.log(`\n  ⚠ WARNING: ${PROTECTED[coll]}`);
  if (!hasFlag('--force')) {
    fail(`"${coll}" is protected. Add --force if you really mean it.`);
  }
}

// ──────────────────────────────────────────────────────────────────── main ──

function usage() {
  console.log(`
db-tool — নিরাপদ MongoDB maintenance tool
প্রতিটা update / delete / insert / restore-এর আগে নিজে থেকেই backup নেওয়া হয়।

  node scripts/db-tool.js <command> [args]

  collections                          সব collection + document সংখ্যা
  list <coll> [n]                      প্রথম n টা document দেখাও (default 50)
  find <coll> '<filter>'               filter দিয়ে খোঁজো
  insert <coll> '<document>'           নতুন document (backup সহ)
  update <coll> '<filter>' '<update>'  update (backup সহ) — _id বদলানো নিষেধ
  delete <coll> '<filter>' [--yes]     delete — --yes ছাড়া শুধু dry-run দেখাবে
  backup [coll]                        পুরো DB বা একটা collection-এর backup
  backups                              আগের backup গুলোর তালিকা
  restore <file.json> [--yes]          backup ফাইল থেকে ফিরিয়ে আনো
                                       (single collection অথবা full app backup)

  filter / update তিনভাবে দেওয়া যায়:
    code=DAIRY                  সরল key=value (একাধিক হলে কমা দিয়ে: code=DAIRY,name=Milk)
    '{"code":"DAIRY"}'          পূর্ণ JSON
    @filter.json                ফাইল থেকে JSON

উদাহরণ:
  node scripts/db-tool.js collections
  node scripts/db-tool.js find customers phone=+8801711111111
  node scripts/db-tool.js update categories code=DAIRY name='Dairy & Eggs'
  node scripts/db-tool.js update products _id=6aa27cd5... '{"$set":{"isActive":false}}'
  node scripts/db-tool.js delete customers name=Test --yes
  node scripts/db-tool.js backup
  node scripts/db-tool.js restore backups/2026-09-14T10-00-00-000Z--customers.json --yes

⚠  স্টক / account balance / customer due সোজা এখান থেকে বদলাবে না —
   ledger আর report মিলবে না। ওগুলোর জন্য অ্যাপের UI ব্যবহার করো।
`);
}

(async () => {
  const [, , command, ...rest] = process.argv;

  if (!command || command === 'help' || command === '-h' || command === '--help') {
    usage();
    return;
  }

  if (command === 'backups') {
    await cmdBackups();
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) fail('MONGODB_URI missing in backend/.env');

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  try {
    switch (command) {
      case 'collections':
        await cmdCollections(db);
        break;

      case 'list':
        if (!rest[0]) fail('Usage: list <collection> [limit]');
        await cmdList(db, rest[0], Number(rest[1]) || MAX_LIST);
        break;

      case 'find':
        if (!rest[0]) fail('Usage: find <collection> \'<filter>\'');
        await cmdFind(db, rest[0], parseInput(rest[1], 'filter') || {});
        break;

      case 'insert':
        if (!rest[0]) fail('Usage: insert <collection> \'<document>\'');
        await cmdInsert(db, rest[0], parseInput(rest[1], 'document'));
        break;

      case 'update':
        if (!rest[0]) fail('Usage: update <collection> \'<filter>\' \'<update>\'');
        await cmdUpdate(db, rest[0], parseInput(rest[1], 'filter') || {}, parseInput(rest[2], 'update'));
        break;

      case 'delete':
        if (!rest[0]) fail('Usage: delete <collection> \'<filter>\' [--yes]');
        await cmdDelete(db, rest[0], parseInput(rest[1], 'filter') || {}, hasFlag('--yes'));
        break;

      case 'backup':
        await cmdBackup(db, rest[0]);
        break;

      case 'restore':
        await cmdRestore(db, rest[0], hasFlag('--yes'));
        break;

      default:
        usage();
        fail(`Unknown command: ${command}`);
    }
  } finally {
    await mongoose.disconnect();
  }
})().catch((e) => {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
});
