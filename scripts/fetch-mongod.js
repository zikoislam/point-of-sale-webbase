'use strict';

/**
 * Downloads the portable MongoDB Community server and keeps just `mongod.exe`
 * in electron/mongodb/bin/. That binary is what the packaged app spawns on
 * 127.0.0.1 so the POS keeps selling with no internet.
 *
 * It is fetched on the build machine only — customers receive it inside the
 * installer, which is why this is a separate script instead of an npm
 * dependency.
 *
 * Run: npm run fetch:mongod            (defaults to 7.0.14)
 *      npm run fetch:mongod -- 7.0.14
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'electron', 'mongodb', 'bin');
const CACHE_DIR = path.join(ROOT, 'electron', 'mongodb', '.cache');

const VERSION = process.argv[2] || '7.0.14';
const ARCHIVE = `mongodb-windows-x86_64-${VERSION}.zip`;
const URL = `https://fastdl.mongodb.org/windows/${ARCHIVE}`;
const MONGOD = path.join(OUT_DIR, 'mongod.exe');

const log = (msg) => console.log(`[mongod] ${msg}`);

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (currentUrl, redirects = 0) => {
      if (redirects > 5) {
        reject(new Error('too many redirects'));
        return;
      }

      require('https')
        .get(currentUrl, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            follow(new URL(res.headers.location, currentUrl).href, redirects + 1);
            return;
          }

          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error(`HTTP ${res.statusCode} for ${currentUrl}`));
            return;
          }

          const total = Number(res.headers['content-length'] || 0);
          let received = 0;
          let nextTick = 0;
          const file = fs.createWriteStream(dest);

          res.on('data', (chunk) => {
            received += chunk.length;
            if (total && Date.now() > nextTick) {
              nextTick = Date.now() + 5000;
              const pct = ((received / total) * 100).toFixed(1);
              log(`downloading ${pct}% (${(received / 1048576).toFixed(0)}MB / ${(total / 1048576).toFixed(0)}MB)`);
            }
          });

          res.pipe(file);
          file.on('finish', () => file.close(() => resolve()));
          file.on('error', reject);
        })
        .on('error', reject);
    };

    follow(url);
  });
}

/**
 * Extracts bin/mongod.exe out of the archive. Windows ships bsdtar as `tar`,
 * which reads zip files, so no unzip dependency is needed.
 */
function extract(archivePath) {
  const extractDir = path.join(CACHE_DIR, 'extracted');
  fs.rmSync(extractDir, { recursive: true, force: true });
  fs.mkdirSync(extractDir, { recursive: true });

  log('extracting archive…');
  execFileSync('tar', ['-xf', archivePath, '-C', extractDir], { stdio: 'inherit' });

  const root = fs
    .readdirSync(extractDir)
    .map((name) => path.join(extractDir, name))
    .find((entry) => fs.statSync(entry).isDirectory());

  if (!root) throw new Error('unexpected archive layout');

  const binDir = path.join(root, 'bin');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // mongod.exe plus any DLLs that sit beside it in the same folder.
  for (const name of fs.readdirSync(binDir)) {
    if (!/\.(exe|dll)$/i.test(name)) continue;
    if (!/^mongod\.exe$/i.test(name) && !/\.dll$/i.test(name)) continue;
    fs.copyFileSync(path.join(binDir, name), path.join(OUT_DIR, name));
  }

  if (!fs.existsSync(MONGOD)) throw new Error('mongod.exe was not found in the archive');
}

async function main() {
  if (process.platform !== 'win32') {
    log('this build ships a Windows mongod.exe — skipping on ' + process.platform);
    return;
  }

  if (fs.existsSync(MONGOD) && !process.argv.includes('--force')) {
    log(`mongod.exe already present (${(fs.statSync(MONGOD).size / 1048576).toFixed(1)}MB) — nothing to do.`);
    return;
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const archivePath = path.join(CACHE_DIR, ARCHIVE);

  if (!fs.existsSync(archivePath)) {
    log(`downloading MongoDB ${VERSION} from ${URL}`);
    await download(URL, archivePath);
  } else {
    log('using the archive already in the cache.');
  }

  extract(archivePath);
  fs.rmSync(archivePath, { force: true });

  log(`done → ${MONGOD} (${(fs.statSync(MONGOD).size / 1048576).toFixed(1)}MB)`);
}

main().catch((err) => {
  console.error(`[mongod] failed: ${err.message}`);
  console.error('[mongod] the app will still build, but it will run in cloud-only mode.');
  process.exitCode = 1;
});
