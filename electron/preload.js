'use strict';

/**
 * Electron Preload Script
 * ──────────────────────
 * Runs in an isolated context inside the renderer (browser window).
 * It safely bridges the frontend (Next.js) to Electron's Main process
 * via contextBridge — no Node.js APIs are exposed directly.
 *
 * Usage in Next.js:
 *   import { electronBridge } from '@/lib/electron-bridge';
 *   await electronBridge.openCashDrawer();
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Safe IPC wrapper — sends a message and waits for a reply.
 * @template T
 * @param {string} channel
 * @param {unknown[]} args
 * @returns {Promise<T>}
 */
const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('electronAPI', {
  // ── App ───────────────────────────────────
  /** Returns the Electron app version (from package.json) */
  getVersion: () => invoke('app:version'),

  /** Returns true when the app is packaged (production .exe) */
  isPackaged: () => invoke('app:is-packaged'),

  /** Ports and database mode the shell actually started with. */
  getRuntime: () => invoke('app:runtime'),

  /** Runtime configuration (never includes the JWT signing key). */
  getConfig: () => invoke('app:get-config'),

  /** Persist a partial configuration change (printer, paper width, …). */
  setConfig: (patch) => invoke('app:set-config', patch),

  /** Quit the application (used by the activation screen). */
  quit: () => invoke('app:quit'),

  // ── License ───────────────────────────────
  license: {
    /**
     * Current licence state: whether one is installed, when it expires, and
     * this computer's Machine ID.
     */
    status: () => invoke('license:status'),

    /**
     * Submits a licence key for verification and saving.
     * @param {string} key
     * @returns {Promise<{ success: boolean; reason?: string; message?: string }>}
     */
    activate: (key) => invoke('license:activate', key),
  },

  // ── Hardware — Cash Drawer ────────────────
  /**
   * Sends the ESC/POS kick-pin-2 pulse to open the cash drawer.
   * @param {{ printerName?: string }} options
   * @returns {Promise<{ success: boolean; printerName?: string; error?: string }>}
   */
  openCashDrawer: (options = {}) => invoke('hardware:cash-drawer', options),

  // ── Hardware — ESC/POS Printer ────────────
  /**
   * Sends raw ESC/POS command bytes to a printer.
   * @param {{ printerName?: string; bytes: number[]; docName?: string }} payload
   * @returns {Promise<{ success: boolean; printerName?: string; bytes?: number; error?: string }>}
   */
  printReceipt: (payload) => invoke('hardware:print-receipt', payload),

  /**
   * Prints an HTML document on an ordinary printer (A4, Letter, …) by handing it
   * to the printer's own driver. Thermal printers use printReceipt instead.
   * @param {{ html: string; printerName?: string; paperSize?: string; silent?: boolean }} payload
   * @returns {Promise<{ success: boolean; printerName?: string; error?: string }>}
   */
  printDocument: (payload) => invoke('hardware:print-document', payload),

  /**
   * Returns a list of system printers available to Electron.
   * @returns {Promise<{ success: boolean; printers: { name: string; isDefault: boolean; portName?: string }[]; error?: string }>}
   */
  listPrinters: () => invoke('hardware:list-printers'),

  // ── Shell ─────────────────────────────────
  /**
   * Opens a URL in the user's default system browser.
   * @param {string} url
   */
  openExternal: (url) => invoke('shell:open-external', url),

  // ── Dialog ────────────────────────────────
  /**
   * Shows a native OS error dialog.
   * @param {{ title: string; content: string }} opts
   */
  showError: (opts) => invoke('dialog:show-error', opts),
});
