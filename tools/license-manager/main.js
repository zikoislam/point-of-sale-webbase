'use strict';

/**
 * BDBBC License Manager — Electron main process.
 *
 * Issues the offline (Ed25519) shop license keys from a small window instead of
 * the command line. Signing is shared with the CLI tools via
 * ../license-generator/sign.js.
 *
 * The private key is NEVER bundled in this app: on first run you point it at your
 * own tools/license-generator/keys/private.pem. The issued ledger (issued.csv)
 * and the per-shop folders are written next to that key file.
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { signKey, nextSerial, appendIssued } = require(path.join(__dirname, '..', 'license-generator', 'sign'));

const configFile = () => path.join(app.getPath('userData'), 'config.json');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configFile(), 'utf8'));
  } catch {
    return {};
  }
}
function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(cfg, null, 2));
}

/** tools/license-generator — the folder that holds issued.csv and shops/. */
const workspaceOf = (keyPath) => path.dirname(path.dirname(keyPath));

function currentKeyPath() {
  const cfg = readConfig();
  if (cfg.privateKeyPath && fs.existsSync(cfg.privateKeyPath)) return cfg.privateKeyPath;
  // Dev default: the repository's own key, when present.
  const dev = path.join(__dirname, '..', 'license-generator', 'keys', 'private.pem');
  if (fs.existsSync(dev)) return dev;
  return null;
}

function status() {
  const p = currentKeyPath();
  if (!p) return { configured: false };
  try {
    crypto.createPrivateKey(fs.readFileSync(p, 'utf8')); // throws if invalid
    return { configured: true, keyPath: p, workspace: workspaceOf(p) };
  } catch (e) {
    return { configured: false, error: e.message };
  }
}

const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const slug = (s) =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9\u0980-\u09FF]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'shop';

ipcMain.handle('key:status', () => status());

ipcMain.handle('key:choose', async () => {
  const res = await dialog.showOpenDialog({
    title: 'Select your private.pem (tools/license-generator/keys/private.pem)',
    properties: ['openFile'],
    filters: [{ name: 'PEM key', extensions: ['pem'] }],
  });
  if (res.canceled || !res.filePaths[0]) return status();
  const p = res.filePaths[0];
  try {
    crypto.createPrivateKey(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return { configured: false, error: 'Not a valid private key: ' + e.message };
  }
  const cfg = readConfig();
  cfg.privateKeyPath = p;
  writeConfig(cfg);
  return status();
});

ipcMain.handle('license:list', () => {
  const p = currentKeyPath();
  if (!p) return [];
  const ledger = path.join(workspaceOf(p), 'issued.csv');
  if (!fs.existsSync(ledger)) return [];
  const lines = fs.readFileSync(ledger, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  const parseCsv = (line) =>
    (line.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || [])
      .map((s) => s.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'))
      .filter((_, i, a) => i < a.length - 1 || true);
  const rows = [];
  for (const line of lines.slice(1)) {
    const c = parseCsv(line);
    rows.push({
      serial: c[0], issued: c[1], expires: c[2], months: c[3],
      shop: c[4], machine: c[5], grace: c[6], key: c[7],
    });
  }
  return rows.reverse();
});

ipcMain.handle('license:issue', (_e, input) => {
  const p = currentKeyPath();
  if (!p) return { ok: false, error: 'No private key configured. Click "Select private.pem".' };
  try {
    const ws = workspaceOf(p);
    const ledger = path.join(ws, 'issued.csv');
    const serial = (input.serial && String(input.serial)) || nextSerial(ledger);
    const result = signKey(
      {
        shop: input.shop,
        months: input.months,
        expires: input.expires || undefined,
        machine: input.machine,
        grace: input.grace,
        serial,
      },
      fs.readFileSync(p, 'utf8')
    );

    appendIssued(ledger, [
      csv(result.serial), csv(result.body.i), csv(result.body.e), csv(result.months),
      csv(input.shop), csv(result.machine || 'ANYP'), csv(result.grace), csv(result.key),
    ]);

    const dir = path.join(ws, 'shops', slug(input.shop));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'license.key'), result.key + '\n', 'utf8');

    return {
      ok: true, key: result.key, serial: result.serial, shop: input.shop,
      expires: result.body.e, machine: result.machine, savedTo: path.join(dir, 'license.key'),
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('license:save', async (_e, key) => {
  const res = await dialog.showSaveDialog({
    title: 'Save license key',
    defaultPath: 'license.key',
    filters: [{ name: 'License key', extensions: ['key', 'txt'] }],
  });
  if (res.canceled || !res.filePath) return { ok: false };
  fs.writeFileSync(res.filePath, String(key) + '\n', 'utf8');
  return { ok: true, path: res.filePath };
});

function createWindow() {
  const win = new BrowserWindow({
    width: 920,
    height: 740,
    minWidth: 720,
    minHeight: 560,
    title: 'BDBBC License Manager',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
