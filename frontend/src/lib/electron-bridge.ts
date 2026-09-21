/**
 * Electron Bridge — Safe wrapper for the window.electronAPI IPC interface.
 *
 * Usage:
 *   import { electronBridge, isElectron } from '@/lib/electron-bridge';
 *
 *   if (isElectron()) {
 *     await electronBridge.openCashDrawer();
 *   }
 *
 * When running inside a regular browser (web version), all calls are no-ops
 * that return a safe default, so the same code works in both environments.
 */

/** True when the app is running inside the Electron shell. */
export const isElectron = (): boolean =>
  typeof window !== 'undefined' && typeof (window as any).electronAPI !== 'undefined';

export interface HardwareResult {
  success: boolean;
  printerName?: string;
  bytes?: number;
  error?: string;
}

export interface PrinterInfo {
  name: string;
  isDefault: boolean;
  portName?: string;
}

export interface AppConfig {
  cloudMongoUri?: string;
  localMongoUri?: string;
  localMongoPort?: number;
  backendPort?: number;
  frontendPort?: number;
  clientUrl?: string;
  syncEnabled?: boolean;
  syncIntervalSeconds?: number;
  hardware?: {
    paperWidth?: '58mm' | '80mm';
    printerName?: string;
    cashDrawerOnReceipt?: boolean;
    /** 'thermal' = raw ESC/POS, 'document' = ordinary printer such as A4. */
    printMode?: 'thermal' | 'document';
    documentPrinterName?: string;
    paperSize?: 'A4' | 'Letter';
    showPrintDialog?: boolean;
  };
}

export interface RuntimeInfo {
  backendPort: number;
  frontendPort: number;
  mongoMode: 'local' | 'reused' | 'cloud-only' | 'none';
}

export interface LicenseInfo {
  /** True when a valid, unexpired key is installed. */
  licensed: boolean;
  /** Why it is not valid: missing | malformed | bad-signature | wrong-machine | expired | ok */
  reason: string;
  /** English explanation, for logs and dialogs. */
  message: string;
  machineId: string;
  machineIdFormatted: string;
  appVersion: string;
  customer: string | null;
  serial: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  supportCompany: string;
  supportPhone: string;
}

export interface ActivateLicenseResult {
  success: boolean;
  reason?: string;
  message?: string;
}

/** Typed reference to the API exposed by electron/preload.js */
interface ElectronAPI {
  getVersion: () => Promise<string>;
  isPackaged: () => Promise<boolean>;
  getRuntime: () => Promise<RuntimeInfo>;
  getConfig: () => Promise<AppConfig>;
  setConfig: (patch: Partial<AppConfig>) => Promise<{ success: boolean }>;
  quit: () => Promise<void>;
  license: {
    status: () => Promise<LicenseInfo>;
    activate: (key: string) => Promise<ActivateLicenseResult>;
  };
  openCashDrawer: (options?: { printerName?: string }) => Promise<HardwareResult>;
  printReceipt: (payload: { printerName?: string; bytes: number[]; docName?: string }) => Promise<HardwareResult>;
  printDocument: (payload: {
    html: string;
    printerName?: string;
    paperSize?: string;
    silent?: boolean;
  }) => Promise<HardwareResult>;
  listPrinters: () => Promise<{ success: boolean; printers: PrinterInfo[]; error?: string }>;
  openExternal: (url: string) => Promise<void>;
  showError: (opts: { title: string; content: string }) => Promise<void>;
}

const api = (): ElectronAPI | null =>
  isElectron() ? (window as any).electronAPI as ElectronAPI : null;

/**
 * Electron bridge — each method is a no-op when running in a browser.
 */
export const electronBridge = {
  /** Get the app version string (e.g. "1.0.0"). Returns null in browser. */
  getVersion: async (): Promise<string | null> => api()?.getVersion() ?? null,

  /** Returns true only when running as a packaged .exe. */
  isPackaged: async (): Promise<boolean> => (await api()?.isPackaged()) ?? false,

  /** Which ports and database mode the desktop shell started with. */
  getRuntime: async (): Promise<RuntimeInfo | null> => api()?.getRuntime() ?? null,

  /** Runtime configuration (never includes the JWT signing key). */
  getConfig: async (): Promise<AppConfig | null> => api()?.getConfig() ?? null,

  /** Persist a partial configuration change (printer, paper width, …). */
  setConfig: async (patch: Partial<AppConfig>): Promise<boolean> => {
    const result = await api()?.setConfig(patch);
    return Boolean(result?.success);
  },

  /**
   * Licence state for this computer: shop, expiry, serial and Machine ID.
   * Returns null when running in a normal browser.
   */
  licenseStatus: async (): Promise<LicenseInfo | null> => api()?.license.status() ?? null,

  /**
   * Submits a licence key entered in the app. The browser build has no licence,
   * so it reports a failure there rather than pretending it worked.
   */
  activateLicense: async (key: string): Promise<ActivateLicenseResult> => {
    const result = await api()?.license.activate(key);
    return result ?? { success: false, reason: 'web', message: 'Licensing applies to the desktop app only.' };
  },

  /**
   * Open the cash drawer via ESC/POS kick command.
   * Falls back gracefully in web mode (no-op, returns success=false).
   */
  openCashDrawer: async (options?: { printerName?: string }): Promise<HardwareResult> => {
    const result = await api()?.openCashDrawer(options);
    return result ?? { success: false, error: 'Not running in Electron' };
  },

  /**
   * Print raw ESC/POS bytes to a printer.
   * Falls back gracefully in web mode.
   */
  printReceipt: async (payload: {
    printerName?: string;
    bytes: number[];
    docName?: string;
  }): Promise<HardwareResult> => {
    const result = await api()?.printReceipt(payload);
    return result ?? { success: false, error: 'Not running in Electron' };
  },

  /**
   * Print an HTML page on an ordinary printer (A4, Letter, …) through its own
   * driver. Reports failure in web mode so the caller can fall back.
   */
  printDocument: async (payload: {
    html: string;
    printerName?: string;
    paperSize?: string;
    silent?: boolean;
  }): Promise<HardwareResult> => {
    const result = await api()?.printDocument(payload);
    return result ?? { success: false, error: 'Not running in Electron' };
  },

  /**
   * List system printers available in Electron.
   * Returns an empty array in web mode.
   */
  listPrinters: async (): Promise<PrinterInfo[]> => {
    const result = await api()?.listPrinters();
    return result?.printers ?? [];
  },

  /** Open a URL in the system browser (Electron) or a new tab (web). */
  openExternal: (url: string): void => {
    if (isElectron()) {
      api()?.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  },

  /** Show a native error dialog (Electron) or log it (web). */
  showError: (opts: { title: string; content: string }): void => {
    if (isElectron()) {
      api()?.showError(opts);
    } else {
      console.error(`[${opts.title}]`, opts.content);
    }
  },
};
