'use strict';

/**
 * Unique POS desktop shell.
 *
 * The window is an ordinary Chromium window pointed at the Next.js server that
 * this process starts, so the shop needs no browser and no Node.js install:
 * both servers are launched with Electron's own binary in Node mode.
 *
 *   mongod (bundled, replSet)  →  Express API  →  Next.js  →  BrowserWindow
 */

const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');
const { spawn, execFile } = require('child_process');
const crypto = require('crypto');

const configModule = require('./config');
const hardware = require('./hardware');
const license = require('./license');

const isDev = !app.isPackaged;

/** Shown on the activation screen and in the footer of the app. */
const SUPPORT = { company: 'Bdbbc.com', phone: '+8801534000350' };

/** Re-check a running app this often, so an expired key cannot run forever. */
const LICENSE_WATCH_MS = 60 * 60 * 1000;

// Names the %APPDATA% folder and the installer entry "Unique POS" instead of the
// npm package name, so support can point at a path that matches the product.
app.setName('Unique POS');

/** @type {ReturnType<typeof configModule.loadConfig>} */
let config;
let paths;
let mainWindow = null;
let splashWindow = null;
let activationWindow = null;
let mongodProcess = null;
let backendProcess = null;
let frontendProcess = null;
let runtime = { backendPort: 0, frontendPort: 0, mongoMode: 'none' };

/** Resolver for the boot-time licence gate; null once the gate has been passed. */
let licenseResolve = null;
let licenseWatchdog = null;

const LOG_PREFIX = '[UniquePOS]';

let logStream = null;

/**
 * Mirrors the log into %APPDATA%\<app>\logs\main.log. A packaged Windows build
 * has no console at all, so without this file a startup failure leaves no trace
 * on the customer's machine.
 */
function initLogging() {
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    logStream = fs.createWriteStream(path.join(dir, 'main.log'), { flags: 'a' });
  } catch {
    /* logging must never prevent the app from starting */
  }
}

function log(...args) {
  const message = `${new Date().toISOString()} ${LOG_PREFIX} ${args
    .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
    .join(' ')}`;

  console.log(message);

  try {
    logStream?.write(`${message}\n`);
  } catch {
    /* ignore a failed write */
  }
}

process.on('uncaughtException', (error) => {
  log('uncaught exception:', error?.stack || String(error));
  dialog.showErrorBox('Unique POS crashed', String(error?.stack || error));
});

process.on('unhandledRejection', (reason) => {
  log('unhandled rejection:', String(reason));
});

// ── Paths ────────────────────────────────────────────────────────────────────

function resolvePaths() {
  if (app.isPackaged) {
    const resources = process.resourcesPath;
    return {
      resources,
      backendDir: path.join(resources, 'backend'),
      frontendDir: path.join(resources, 'frontend'),
      mongodExe: path.join(resources, 'mongodb', 'bin', 'mongod.exe'),
    };
  }

  return {
    resources: path.join(__dirname, '..'),
    backendDir: path.join(__dirname, '..', 'backend'),
    frontendDir: path.join(__dirname, '..', 'frontend'),
    mongodExe: path.join(__dirname, 'mongodb', 'bin', 'mongod.exe'),
  };
}

// ── Ports ────────────────────────────────────────────────────────────────────

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const finish = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(700, () => finish(false));
  });
}

async function findFreePort(preferred, attempts = 25) {
  for (let port = preferred; port < preferred + attempts; port++) {
    if (!(await isPortOpen(port))) return port;
  }
  throw new Error(`No free port available in the range ${preferred}-${preferred + attempts - 1}.`);
}

function waitForHttp(url, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(true);
      });

      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`${label} did not respond within ${Math.round(timeoutMs / 1000)}s`));
          return;
        }
        setTimeout(attempt, 500);
      });

      req.setTimeout(1500, () => {
        req.destroy();
        if (Date.now() > deadline) {
          reject(new Error(`${label} did not respond within ${Math.round(timeoutMs / 1000)}s`));
          return;
        }
        setTimeout(attempt, 500);
      });
    };

    attempt();
  });
}

// ── MongoDB ──────────────────────────────────────────────────────────────────

/**
 * Starts the bundled mongod as a single-node replica set.
 *
 * The replica set is not incidental: it is what gives the backend multi
 * document transactions (checkout, returns, wastage) and change streams, which
 * a standalone mongod refuses to provide.
 */
async function startLocalMongo() {
  const port = config.localMongoPort;

  if (!fs.existsSync(paths.mongodExe)) {
    log('no bundled mongod — running against the cloud database only.');
    return { mode: 'cloud-only', port };
  }

  if (await isPortOpen(port)) {
    log(`port ${port} already has MongoDB listening — reusing it.`);
    return { mode: 'reused', port };
  }

  const dbPath = configModule.dataDir(app);
  const logPath = path.join(app.getPath('userData'), 'logs', 'mongod.log');
  log(`starting mongod on port ${port} (dbpath: ${dbPath})`);

  // mongod writes its own log file: its journal output is far too chatty to
  // share the app log, and a support call needs the app log to stay readable.
  mongodProcess = spawn(
    paths.mongodExe,
    [
      '--dbpath', dbPath,
      '--port', String(port),
      '--bind_ip', '127.0.0.1',
      '--replSet', 'rs0',
      '--logpath', logPath,
      '--logappend',
      '--quiet',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
  );

  mongodProcess.stdout?.on('data', (data) => log('[mongod]', data.toString().trim()));
  mongodProcess.stderr?.on('data', (data) => log('[mongod]', data.toString().trim()));

  mongodProcess.on('exit', (code) => {
    log(`mongod exited with code ${code}`);
    mongodProcess = null;
  });

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) {
      log('mongod is accepting connections.');
      return { mode: 'local', port };
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  log('mongod did not come up in time — falling back to the cloud database.');
  return { mode: 'cloud-only', port };
}

// ── Backend ──────────────────────────────────────────────────────────────────

function backendEnv(ports, mongo) {
  const useLocal = mongo.mode === 'local' || mongo.mode === 'reused';
  const localUri = `mongodb://127.0.0.1:${mongo.port}/pos_db`;

  return {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: isDev ? 'development' : 'production',
    PORT: String(ports.backendPort),
    MONGODB_URI: useLocal ? localUri : config.cloudMongoUri,
    CLOUD_MONGODB_URI: config.cloudMongoUri,
    LOCAL_MONGODB_URI: localUri,
    JWT_SECRET: config.jwtSecret,
    JWT_EXPIRES_IN: '8h',
    CLIENT_URL: `http://localhost:${ports.frontendPort},http://127.0.0.1:${ports.frontendPort}`,
    SYNC_ENABLED: String(config.syncEnabled && useLocal && Boolean(config.cloudMongoUri)),
    SYNC_INTERVAL_SECONDS: String(config.syncIntervalSeconds),
  };
}

function startBackend(ports, mongo) {
  const env = backendEnv(ports, mongo);

  if (isDev) {
    log('starting backend (ts-node-dev)…');
    backendProcess = spawn('npm', ['run', 'dev'], {
      cwd: paths.backendDir,
      env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } else {
    log('starting backend (compiled)…');
    backendProcess = spawn(process.execPath, [path.join(paths.backendDir, 'dist', 'index.js')], {
      cwd: paths.backendDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  }

  backendProcess.stdout?.on('data', (d) => log('[api]', d.toString().trim()));
  backendProcess.stderr?.on('data', (d) => log('[api]', d.toString().trim()));

  backendProcess.on('exit', (code) => {
    log(`backend exited with code ${code}`);
    backendProcess = null;
  });
}

// ── Frontend ─────────────────────────────────────────────────────────────────

function startFrontend(ports) {
  const apiOrigin = `http://127.0.0.1:${ports.backendPort}`;

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    NODE_ENV: isDev ? 'development' : 'production',
    PORT: String(ports.frontendPort),
    HOSTNAME: '127.0.0.1',
    // Read by next.config.mjs rewrites at server start, so /api and /socket.io
    // stay same-origin and the auth cookie remains first-party.
    NEXT_PUBLIC_API_URL: `${apiOrigin}/api/v1`,
    NEXT_PUBLIC_SOCKET_URL: apiOrigin,
  };

  if (isDev) {
    log('starting frontend (next dev)…');
    frontendProcess = spawn('npm', ['run', 'dev'], {
      cwd: paths.frontendDir,
      env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } else {
    log('starting frontend (standalone server)…');
    frontendProcess = spawn(process.execPath, ['server.js'], {
      cwd: paths.frontendDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  }

  frontendProcess.stdout?.on('data', (d) => log('[web]', d.toString().trim()));
  frontendProcess.stderr?.on('data', (d) => log('[web]', d.toString().trim()));

  frontendProcess.on('exit', (code) => {
    log(`frontend exited with code ${code}`);
    frontendProcess = null;
  });
}

// ── License ──────────────────────────────────────────────────────────────────

/** Callbacks for the activation window that is currently open, if any. */
let activationCallbacks = null;

/**
 * Shows the activation screen. It is an ordinary window loading a local page,
 * so it works before mongod, the API or Next.js are running.
 *
 * @param {{ onActivated: (state: object) => void, onCancelled: () => void }} callbacks
 */
function openActivationWindow(callbacks) {
  activationCallbacks = callbacks;

  if (activationWindow && !activationWindow.isDestroyed()) {
    activationWindow.focus();
    return;
  }

  activationWindow = new BrowserWindow({
    width: 660,
    height: 700,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#020617',
    title: 'Unique POS — License Activation',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  activationWindow.setMenuBarVisibility(false);
  activationWindow.loadFile(path.join(__dirname, 'license.html'));

  activationWindow.on('closed', () => {
    activationWindow = null;
    const pending = activationCallbacks;
    activationCallbacks = null;
    // Closing the window without activating counts as cancelling.
    pending?.onCancelled?.();
  });
}

/**
 * Closes the activation window and takes its callbacks, so the 'closed' handler
 * does not mistake a successful activation for a cancellation.
 */
function closeActivationWindow() {
  const pending = activationCallbacks;
  activationCallbacks = null;

  if (activationWindow && !activationWindow.isDestroyed()) activationWindow.close();
  activationWindow = null;

  return pending;
}

/** Resolves with the licence state, or null when the shop declines to activate. */
function ensureLicensed() {
  const state = license.checkStored(app);
  if (state.valid) return Promise.resolve(state);

  log(`license check failed at startup: ${state.reason}`);

  return new Promise((resolve) => {
    openActivationWindow({
      onActivated: (next) => resolve(next),
      onCancelled: () => resolve(null),
    });
  });
}

/**
 * Re-checks the licence while the app is running, so a key that expires months
 * into a session cannot keep the app open indefinitely. Renewing is possible
 * without restarting; dismissing the window shuts the app down.
 */
function startLicenseWatchdog() {
  if (licenseWatchdog) return;

  licenseWatchdog = setInterval(() => {
    const state = license.checkStored(app);
    if (state.valid) return;

    log(`license became invalid while running: ${state.reason}`);

    openActivationWindow({
      onActivated: (next) => log(`license renewed: serial ${next.info?.n}, expires ${next.info?.e}`),
      onCancelled: () => {
        log('activation dismissed — quitting.');
        app.quit();
      },
    });
  }, LICENSE_WATCH_MS);

  licenseWatchdog.unref?.();
}

/**
 * Nudges once a day during the final stretch of a licence so renewals are never
 * a surprise. The last warned date lives in config.json, so restarting the app
 * several times in a day does not nag repeatedly.
 */
function warnIfExpiringSoon(state) {
  if (!state?.valid || state.daysRemaining === null) return;
  if (state.daysRemaining > license.REMIND_DAYS) return;

  const today = license.today();
  if (config.licenseWarnedOn === today) return;

  config = { ...config, licenseWarnedOn: today };
  configModule.writeConfig(app, config);

  const options = {
    type: 'warning',
    title: 'License expiring soon',
    message: `This license expires in ${Math.max(0, state.daysRemaining)} day(s), on ${state.info?.e}.`,
    detail:
      `Contact ${SUPPORT.company} at ${SUPPORT.phone} for a new key.\n\n` +
      'Once it expires the app will not open until a new key is entered.',
    buttons: ['OK'],
    noLink: true,
  };

  const box =
    mainWindow && !mainWindow.isDestroyed()
      ? dialog.showMessageBox(mainWindow, options)
      : dialog.showMessageBox(options);

  box.catch(() => undefined);
}

// ── Windows ──────────────────────────────────────────────────────────────────

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    show: false,
    webPreferences: { contextIsolation: true },
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.once('ready-to-show', () => splashWindow?.show());
  splashWindow.center();
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  splashWindow = null;
}

function createMainWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    backgroundColor: '#0f172a',
    title: 'Unique POS',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.once('ready-to-show', () => {
    closeSplash();
    mainWindow?.show();
    mainWindow?.focus();
  });

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

  // Keep the shell on its own app; anything else belongs in the real browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`http://127.0.0.1:${port}`) && !url.startsWith(`http://localhost:${port}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildAppMenu() {
  const template = [
    {
      label: 'POS System',
      submenu: [
        { label: 'Reload', accelerator: 'F5', click: () => mainWindow?.webContents.reload() },
        { type: 'separator' },
        {
          label: 'Toggle Fullscreen',
          accelerator: 'F11',
          click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()),
        },
        { type: 'separator' },
        { label: 'Exit', accelerator: 'Alt+F4', role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    ...(isDev
      ? [
          {
            label: 'Developer',
            submenu: [
              { label: 'DevTools', accelerator: 'F12', role: 'toggleDevTools' },
              { label: 'Reload', role: 'forceReload' },
            ],
          },
        ]
      : []),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── IPC ──────────────────────────────────────────────────────────────────────

function registerIpcHandlers() {
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:is-packaged', () => app.isPackaged);
  ipcMain.handle('app:quit', () => app.quit());
  ipcMain.handle('app:runtime', () => ({ ...runtime, mongoMode: runtime.mongoMode }));

  ipcMain.handle('app:get-config', () => ({ ...config, jwtSecret: undefined }));

  ipcMain.handle('app:set-config', (_event, patch) => {
    const next = {
      ...config,
      ...patch,
      hardware: { ...config.hardware, ...(patch && patch.hardware) },
    };
    configModule.writeConfig(app, next);
    config = next;
    return { success: true };
  });

  // ── License ───────────────────────────────────────────────────────────────
  ipcMain.handle('license:status', () => {
    const state = license.checkStored(app);
    const machineId = license.getMachineId();

    return {
      licensed: state.valid,
      reason: state.reason,
      message: state.message,
      machineId,
      machineIdFormatted: license.formatMachineId(machineId),
      appVersion: app.getVersion(),
      customer: state.info?.c ?? null,
      serial: state.info?.n ?? null,
      expiresAt: state.info?.e ?? null,
      daysRemaining: state.daysRemaining,
      supportCompany: SUPPORT.company,
      supportPhone: SUPPORT.phone,
    };
  });

  ipcMain.handle('license:activate', (_event, rawKey) => {
    const state = license.evaluate(rawKey);

    if (!state.valid) {
      log(`license rejected (${state.reason})`);
      return { success: false, reason: state.reason, message: state.message };
    }

    license.writeStoredKey(app, String(rawKey).trim());
    log(`license accepted — serial ${state.info?.n}, expires ${state.info?.e}`);

    // Hold the window open briefly so the shop sees the confirmation before it
    // disappears and the splash takes over.
    setTimeout(() => {
      const pending = closeActivationWindow();
      pending?.onActivated?.(state);
    }, 700);

    return { success: true, info: state.info };
  });

  // ── Cash drawer ───────────────────────────────────────────────────────────
  ipcMain.handle('hardware:cash-drawer', async (_event, options = {}) => {
    const printerName = options.printerName || config.hardware.printerName || undefined;
    const result = await hardware.kickCashDrawer(printerName);

    if (!result.success) log('cash drawer failed:', result.error);
    return result;
  });

  // ── Receipt printing ──────────────────────────────────────────────────────
  ipcMain.handle('hardware:print-receipt', async (_event, payload = {}) => {
    const printerName = payload.printerName || config.hardware.printerName || undefined;
    const bytes = Uint8Array.from(payload.bytes || []);

    const result = await hardware.printRaw(printerName, bytes, payload.docName || 'Unique POS Receipt');
    if (!result.success) log('print failed:', result.error);
    return result;
  });

  // ── Document printing — A4 and other ordinary printers ────────────────────
  /**
   * A thermal printer takes raw ESC/POS bytes, but an ordinary A4/Letter printer
   * needs a page laid out by its own driver. So the receipt is rendered as HTML
   * in a hidden window and handed to Chromium's print(), which talks to the
   * spooler. Nothing here depends on ESC/POS support.
   */
  ipcMain.handle('hardware:print-document', async (_event, payload = {}) => {
    const html = typeof payload.html === 'string' ? payload.html : '';

    if (!html.trim()) {
      return { success: false, error: 'Nothing to print — the document was empty.' };
    }

    const printerName = payload.printerName || config.hardware.documentPrinterName || '';
    const paperSize = payload.paperSize || config.hardware.paperSize || 'A4';
    const silent =
      payload.silent === undefined ? !config.hardware.showPrintDialog : Boolean(payload.silent);

    const tempFile = path.join(app.getPath('temp'), `unique-pos-${crypto.randomUUID()}.html`);
    let printWindow = null;

    try {
      fs.writeFileSync(tempFile, html, 'utf8');

      printWindow = new BrowserWindow({
        width: 820,
        height: 1000,
        show: false,
        title: 'Unique POS — Print preview',
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
      });
      printWindow.setMenuBarVisibility(false);

      await printWindow.loadFile(tempFile);

      // Let fonts and layout settle before the page is measured.
      await new Promise((resolve) => setTimeout(resolve, 300));

      // When a dialog is being shown, give it a visible parent so it cannot end
      // up behind the POS window.
      if (!silent) printWindow.show();

      const options = {
        silent,
        printBackground: true,
        pageSize: paperSize === 'Letter' ? 'Letter' : 'A4',
      };
      if (printerName) options.deviceName = printerName;

      const result = await new Promise((resolve) => {
        let settled = false;

        const finish = (value) => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          resolve(value);
        };

        // A silent print should finish within seconds. Some drivers never call
        // back at all — "Microsoft Print to PDF" is one, because it has nowhere
        // to write — and without this the POS would sit on "printing" forever.
        // With a dialog on screen the user sets the pace, so no timer there.
        const timer = silent
          ? setTimeout(
              () =>
                finish({
                  success: false,
                  error:
                    'The printer did not respond. Check that it is switched on, has paper, and is not waiting for something.',
                }),
              90000
            )
          : null;

        printWindow.webContents.print(options, (success, failureReason) => {
          finish(
            success
              ? { success: true, printerName: printerName || 'the default printer' }
              : { success: false, error: failureReason || 'The printer did not accept the document.' }
          );
        });
      });

      if (!result.success) log('document print failed:', result.error);
      return result;
    } catch (error) {
      const message = error?.message || String(error);
      log('document print error:', message);
      return { success: false, error: message };
    } finally {
      if (printWindow && !printWindow.isDestroyed()) printWindow.destroy();
      fs.rmSync(tempFile, { force: true });
    }
  });

  ipcMain.handle('hardware:list-printers', async () => {
    const result = await hardware.listPrinters();

    // Chromium's own list is a reasonable second opinion when the spooler
    // cannot be queried.
    if (!result.success && mainWindow) {
      try {
        const printers = await mainWindow.webContents.getPrintersAsync();
        return {
          success: true,
          printers: printers.map((p) => ({ name: p.name, isDefault: p.isDefault, portName: '' })),
        };
      } catch {
        /* fall through to the original error */
      }
    }

    return result;
  });

  ipcMain.handle('shell:open-external', (_event, url) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) shell.openExternal(url);
  });

  ipcMain.handle('dialog:show-error', (_event, { title, content } = {}) => {
    dialog.showErrorBox(title || 'Unique POS', content || 'Something went wrong.');
  });
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

function killProcessTree(child) {
  if (!child || child.exitCode !== null || child.signalCode) return;

  if (process.platform === 'win32' && child.pid) {
    // npm and mongod both spawn grandchildren; killing the shell alone would
    // leave Node holding the ports and the database files locked.
    try {
      execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {});
    } catch {
      child.kill();
    }
    return;
  }

  child.kill('SIGTERM');
}

function shutDownChildren() {
  log('shutting down child processes…');
  killProcessTree(frontendProcess);
  killProcessTree(backendProcess);
  killProcessTree(mongodProcess);
  frontendProcess = backendProcess = mongodProcess = null;
}

async function boot() {
  initLogging();
  log(`starting v${app.getVersion()} (packaged: ${app.isPackaged})`);

  paths = resolvePaths();
  config = configModule.loadConfig(app, paths.resources);

  log(`resources: ${paths.resources}`);

  buildAppMenu();
  registerIpcHandlers();

  // The licence gate comes first: without a valid key nothing starts — no
  // database, no API, no web server, no window.
  const licenceState = await ensureLicensed();

  if (!licenceState) {
    log('no valid license — exiting.');
    app.quit();
    return;
  }

  log(`license ok — serial ${licenceState.info?.n}, expires ${licenceState.info?.e}`);

  createSplashWindow();

  const mongo = await startLocalMongo();

  const frontendPort = isDev
    ? config.frontendPort
    : await findFreePort(config.frontendPort).catch(() => config.frontendPort);

  const backendPort = isDev
    ? config.backendPort
    : await findFreePort(config.backendPort).catch(() => config.backendPort);

  runtime = { backendPort, frontendPort, mongoMode: mongo.mode };
  log(`runtime → api:${backendPort} web:${frontendPort} mongo:${mongo.mode}`);

  startBackend({ backendPort, frontendPort }, mongo);
  startFrontend({ backendPort, frontendPort });

  try {
    await waitForHttp(`http://127.0.0.1:${backendPort}/api/v1/health`, isDev ? 90000 : 60000, 'The POS API');
  } catch (err) {
    closeSplash();
    dialog.showErrorBox(
      'Startup Error',
      `${err.message}.\n\n` +
        (mongo.mode === 'cloud-only' && !config.cloudMongoUri
          ? 'No local database was bundled and no cloud database is configured, so there is nowhere to store data.\n\n'
          : '') +
        `Check that port ${backendPort} is free and that the database is reachable, then restart the app.`
    );
    app.quit();
    return;
  }

  try {
    await waitForHttp(`http://127.0.0.1:${frontendPort}/`, isDev ? 120000 : 60000, 'The POS interface');
  } catch (err) {
    closeSplash();
    dialog.showErrorBox('Startup Error', `${err.message}. Please restart the app.`);
    app.quit();
    return;
  }

  createMainWindow(frontendPort);
  startLicenseWatchdog();
  warnIfExpiringSoon(licenceState);
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(boot);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && runtime.frontendPort) {
      createMainWindow(runtime.frontendPort);
    }
  });

  app.on('before-quit', shutDownChildren);
  process.on('exit', shutDownChildren);
}
