'use strict';

/**
 * Runtime configuration for the desktop app.
 *
 * Shipping `backend/.env` inside the installer meant database credentials sat
 * inside app.asar, readable by anyone who extracts it. Secrets now live in
 * %APPDATA%/UniquePos/config.json, and the JWT signing key is generated per
 * install so two installations never share one.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONFIG_FILE = 'config.json';

const DEFAULTS = {
  cloudMongoUri: '',
  /**
   * How the app gets its database:
   *   'auto'     — reuse a MongoDB already running on localMongoPort, else start
   *                the bundled mongod, else fall back to the cloud database.
   *   'bundled'  — ALWAYS start the bundled mongod on a private port; never
   *                reuse an external MongoDB (keeps the offline edition isolated
   *                from any MongoDB service the PC already has).
   *   'external' — REQUIRE a MongoDB installed on this PC (e.g. from the MongoDB
   *                Community Server MSI); never start a bundled server.
   * The editions ship with: offline → 'bundled', external → 'external',
   * standard → 'auto'.
   */
  mongoMode: 'auto',
  localMongoUri: 'mongodb://127.0.0.1:27017/pos_db',
  localMongoPort: 27017,
  backendPort: 5000,
  frontendPort: 3000,
  clientUrl: '',
  syncEnabled: true,
  syncIntervalSeconds: 60,
  hardware: {
    paperWidth: '80mm',
    printerName: '',
    cashDrawerOnReceipt: true,
    // 'thermal' sends raw ESC/POS bytes; 'document' lays the receipt out as a
    // page and prints it through the printer's own Windows driver (A4 etc).
    printMode: 'thermal',
    documentPrinterName: '',
    paperSize: 'A4',
    // false prints straight through; true shows the Windows print dialog.
    showPrintDialog: false,
  },
};

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function configPath(app) {
  return path.join(app.getPath('userData'), CONFIG_FILE);
}

/**
 * Loads the config, seeding it from the packaged template on first launch and
 * filling in anything a newer version added.
 */
function loadConfig(app, resourcesPath) {
  const file = configPath(app);
  const template = readJson(path.join(resourcesPath, 'config', 'app-config.json')) || {};
  const existing = readJson(file) || {};

  const config = {
    ...DEFAULTS,
    ...template,
    ...existing,
    hardware: {
      ...DEFAULTS.hardware,
      ...(template.hardware || {}),
      ...(existing.hardware || {}),
    },
  };

  // Vendor-controlled fields follow the packaged EDITION. `existing` wins over
  // `template` above, which is right for user settings (printer, ports) but
  // wrong for the cloud/database choice: an old config.json from a cloud build
  // would otherwise keep pulling yesterday's data into a fresh offline install.
  // When the edition changes — including "no edition" (older builds) — reset
  // these from the template.
  const prevEdition = existing.edition;
  const nextEdition = template.edition || prevEdition || 'standard';
  if (prevEdition !== nextEdition) {
    if (template.mongoMode !== undefined) config.mongoMode = template.mongoMode;
    if (template.cloudMongoUri !== undefined) config.cloudMongoUri = template.cloudMongoUri;
    if (template.syncEnabled !== undefined) config.syncEnabled = template.syncEnabled;
  }
  config.edition = nextEdition;

  if (!config.jwtSecret) {
    config.jwtSecret = crypto.randomBytes(48).toString('hex');
  }

  if (!config.clientUrl) {
    config.clientUrl = `http://localhost:${config.frontendPort}`;
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeConfig(app, config);

  return config;
}

function writeConfig(app, config) {
  fs.writeFileSync(configPath(app), JSON.stringify(config, null, 2));
}

/** Where the bundled mongod keeps its data files. */
function dataDir(app) {
  const dir = path.join(app.getPath('userData'), 'db');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = { loadConfig, writeConfig, dataDir, configPath };
