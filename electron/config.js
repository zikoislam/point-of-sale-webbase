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
