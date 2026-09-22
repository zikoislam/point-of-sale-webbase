import { API_BASE_URL } from './constants';

/**
 * How sale memos are printed, as configured in Settings:
 *  - `thermal` → a narrow receipt on a 58mm / 80mm roll
 *  - `a4`      → a full page on an ordinary printer
 *  - `custom`  → an ordinary printer loaded with a non-standard sheet
 */
export type MemoPrintMode = 'thermal' | 'a4' | 'custom';

export interface MemoPaper {
  mode: MemoPrintMode;
  /** Roll width when mode is `thermal`. */
  thermalWidthMm: number;
  /** Sheet width/height when mode is `custom`. */
  widthMm: number;
  heightMm: number;
}

const DEFAULTS: MemoPaper = { mode: 'thermal', thermalWidthMm: 80, widthMm: 210, heightMm: 297 };

let cached: MemoPaper | null = null;
let inflight: Promise<MemoPaper> | null = null;

/** Paper settings travel with the public branding payload, so this needs no extra permission. */
export async function loadMemoPaper(): Promise<MemoPaper> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/settings/public`, { credentials: 'include' });
      const json = await res.json();
      const d = json?.data || {};
      const mode: MemoPrintMode =
        d.memoPrintMode === 'a4' || d.memoPrintMode === 'custom' ? d.memoPrintMode : 'thermal';
      cached = {
        mode,
        thermalWidthMm: d.thermalPrinterType === '58mm' ? 58 : 80,
        widthMm: Number(d.memoWidthMm) || DEFAULTS.widthMm,
        heightMm: Number(d.memoHeightMm) || DEFAULTS.heightMm,
      };
    } catch {
      cached = { ...DEFAULTS };
    }
    return cached;
  })();

  return inflight;
}

/** Drop the cache — call after Settings is saved so the next print picks up the change. */
export function invalidateMemoPaper(): void {
  cached = null;
  inflight = null;
}

/** CSS `size` value plus a sensible margin for each paper mode. */
export function memoPageGeometry(paper: MemoPaper): { size: string; margin: string; maxWidth: string } {
  if (paper.mode === 'a4') {
    return { size: 'A4 portrait', margin: '12mm', maxWidth: '190mm' };
  }
  if (paper.mode === 'custom') {
    const w = Math.max(20, Math.min(1000, paper.widthMm));
    const h = Math.max(20, Math.min(1000, paper.heightMm));
    return { size: `${w}mm ${h}mm`, margin: '5mm', maxWidth: `${Math.max(20, w - 10)}mm` };
  }
  const w = paper.thermalWidthMm === 58 ? 58 : 80;
  return { size: `${w}mm 200mm`, margin: '2mm', maxWidth: `${w}mm` };
}

/**
 * Points the browser's page setup at the configured paper.
 *
 * The memo markup uses the named `sale-memo-page` from print.css, so redefining
 * that named page here (a later stylesheet of equal specificity) is what makes
 * the setting take effect.
 */
export function applyMemoPageSize(paper: MemoPaper): void {
  const { size, margin, maxWidth } = memoPageGeometry(paper);

  let style = document.getElementById('memo-page-size') as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = 'memo-page-size';
    document.head.appendChild(style);
  }

  style.textContent = `@media print {
  @page sale-memo-page { size: ${size}; margin: ${margin}; }
  .print-sale-memo { max-width: ${maxWidth} !important; }
}`;
}

/** Loads the paper setting, applies it, and resolves — ready for window.print(). */
export async function prepareMemoPrint(): Promise<MemoPaper> {
  const paper = await loadMemoPaper();
  applyMemoPageSize(paper);
  return paper;
}
