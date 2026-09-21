/**
 * Cash Drawer Hardware Utility
 * ────────────────────────────
 * - Desktop (Electron): ESC/POS kick command over IPC to the spooler
 * - Web on the till computer: the API sends the same bytes via WritePrinter
 *
 * In both cases the drawer is wired to the receipt printer, so the pulse is
 * delivered as a raw print job rather than through any browser API.
 */

import { electronBridge, isElectron } from './electron-bridge';
import { api } from './api-client';

export const CASH_DRAWER_COMMANDS = {
  /** ESC p 0 25 250 - Kick pin 2 (standard 24V drawer) */
  KICK_PIN_2: new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]),
  /** ESC p 1 25 250 - Kick pin 5 */
  KICK_PIN_5: new Uint8Array([0x1b, 0x70, 0x01, 0x19, 0xfa]),
};

/**
 * Triggers cash drawer kick.
 *
 * @param printerName  Optional printer name the drawer is attached to.
 *                     Leave undefined to use the configured or default printer.
 */
export const openCashDrawer = async (printerName?: string): Promise<boolean> => {
  if (isElectron()) {
    const result = await electronBridge.openCashDrawer({ printerName });
    if (!result.success) console.warn('Cash drawer did not open:', result.error);
    return result.success;
  }

  try {
    await api.post('/hardware/cash-drawer', { printerName }, { keepalive: true });
    return true;
  } catch (error: any) {
    console.warn('Cash drawer did not open:', error?.message || error);
    return false;
  }
};
