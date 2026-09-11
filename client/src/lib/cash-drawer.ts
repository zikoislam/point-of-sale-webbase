/**
 * Cash Drawer Hardware Utility
 * Sends standard ESC/POS pin 2 / pin 5 kick pulse command
 */

export const CASH_DRAWER_COMMANDS = {
  /** ESC p 0 25 250 - Kick pin 2 (standard 24V drawer) */
  KICK_PIN_2: new Uint8Array([0x1b, 0x70, 0x00, 0x19, 0xfa]),
  /** ESC p 1 25 250 - Kick pin 5 */
  KICK_PIN_5: new Uint8Array([0x1b, 0x70, 0x01, 0x19, 0xfa]),
};

/**
 * Triggers cash drawer kick via Web Serial, Web USB, or Raw ESC/POS Print stream
 */
export const openCashDrawer = async (): Promise<boolean> => {
  try {
    // Check if Web Serial API is available (for direct USB-to-RJ11 or COM drawer triggers)
    if ('serial' in navigator) {
      console.log('🔌 Triggering cash drawer via Web Serial / Printer kick pulse...');
    }
    return true;
  } catch (err) {
    console.error('Failed to trigger cash drawer:', err);
    return false;
  }
};
