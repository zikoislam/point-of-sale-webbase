'use strict';

/**
 * Generates electron/assets/icon.ico (plus a 512px PNG for the app splash/UI).
 *
 * Why a generator instead of a checked-in binary: no image library and no native
 * build step is needed here — PNG is encoded with Node's zlib and the multi-size
 * ICO container is assembled by hand.
 *
 * Run: npm run make:icon
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'assets');
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
const PNG_SIZE = 512;

// ── Brand palette ────────────────────────────────────────────────────────────
const BG_TOP = [0xf7, 0xb2, 0x67];
const BG_BOTTOM = [0xd9, 0x7a, 0x2b];
const GLYPH = [0xff, 0xff, 0xff];

// ── Drawing ──────────────────────────────────────────────────────────────────

/** Signed-distance test for a rounded rectangle. */
function insideRoundedRect(x, y, size) {
  const pad = size * 0.02;
  const radius = size * 0.22;
  const min = pad;
  const max = size - pad;

  const cx = Math.min(Math.max(x, min + radius), max - radius);
  const cy = Math.min(Math.max(y, min + radius), max - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

/** True when the point lands on the white "U" glyph. */
function insideGlyph(x, y, size) {
  const halfW = size * 0.23;
  const thickness = size * 0.125;
  const cx = size / 2;
  const top = size * 0.27;
  const bottom = size * 0.73;
  const arcCenterY = bottom - halfW;
  const outerR = halfW;
  const innerR = halfW - thickness;

  const withinVerticalSpan = y >= top && y <= bottom;

  if (withinVerticalSpan) {
    const leftBar = x >= cx - halfW && x <= cx - halfW + thickness;
    const rightBar = x >= cx + halfW - thickness && x <= cx + halfW;
    if (leftBar || rightBar) return true;
  }

  if (y >= arcCenterY) {
    const dx = x - cx;
    const dy = y - arcCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist <= outerR && dist >= innerR;
  }

  return false;
}

/**
 * Rasterizes the icon at one size as RGBA pixels.
 * Uses 4x4 supersampling so the rounded corners and the glyph stay smooth.
 */
function rasterize(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const sub = 4;
  const step = 1 / sub;
  const samples = sub * sub;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bgHits = 0;
      let glyphHits = 0;

      for (let sy = 0; sy < sub; sy++) {
        for (let sx = 0; sx < sub; sx++) {
          const x = px + (sx + 0.5) * step;
          const y = py + (sy + 0.5) * step;
          if (!insideRoundedRect(x, y, size)) continue;
          bgHits++;
          if (insideGlyph(x, y, size)) glyphHits++;
        }
      }

      const offset = (py * size + px) * 4;
      if (bgHits === 0) continue;

      const t = py / (size - 1 || 1);
      const bg = [
        Math.round(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t),
        Math.round(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t),
        Math.round(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t),
      ];

      const glyphRatio = glyphHits / samples;
      pixels[offset] = Math.round(bg[0] + (GLYPH[0] - bg[0]) * glyphRatio);
      pixels[offset + 1] = Math.round(bg[1] + (GLYPH[1] - bg[1]) * glyphRatio);
      pixels[offset + 2] = Math.round(bg[2] + (GLYPH[2] - bg[2]) * glyphRatio);
      pixels[offset + 3] = Math.round((bgHits / samples) * 255);
    }
  }

  return pixels;
}

// ── PNG encoding ─────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(size, pixels) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── ICO container ────────────────────────────────────────────────────────────

function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const directory = Buffer.alloc(16 * entries.length);
  let offset = header.length + directory.length;

  entries.forEach((entry, index) => {
    const base = index * 16;
    directory[base] = entry.size >= 256 ? 0 : entry.size;
    directory[base + 1] = entry.size >= 256 ? 0 : entry.size;
    directory[base + 2] = 0; // palette size
    directory[base + 3] = 0; // reserved
    directory.writeUInt16LE(1, base + 4); // colour planes
    directory.writeUInt16LE(32, base + 6); // bits per pixel
    directory.writeUInt32LE(entry.png.length, base + 8);
    directory.writeUInt32LE(offset, base + 12);
    offset += entry.png.length;
  });

  return Buffer.concat([header, directory, ...entries.map((entry) => entry.png)]);
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const entries = ICO_SIZES.map((size) => ({
    size,
    png: encodePng(size, rasterize(size)),
  }));

  const icoPath = path.join(OUT_DIR, 'icon.ico');
  fs.writeFileSync(icoPath, buildIco(entries));

  const pngPath = path.join(OUT_DIR, 'icon.png');
  fs.writeFileSync(pngPath, encodePng(PNG_SIZE, rasterize(PNG_SIZE)));

  console.log(`✔ icon.ico written (${ICO_SIZES.join('/')} px) → ${icoPath}`);
  console.log(`✔ icon.png written (${PNG_SIZE}px) → ${pngPath}`);
}

main();
