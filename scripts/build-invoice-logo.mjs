#!/usr/bin/env node
/**
 * Regenerates convex/invoiceLogo.ts from public/logo-badge.png.
 *
 * The source badge has its octagon sitting on an opaque black rectangle — alpha
 * is 255 across the whole image. That is invisible on the dark site but prints
 * as a black box on a white invoice. This flood-fills the near-black region
 * connected to the image border and makes it transparent, which stops at the
 * badge's white outline and so leaves the badge itself untouched.
 *
 * Run after changing the logo artwork:  node scripts/build-invoice-logo.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

const SOURCE = path.join(root, "public", "logo-badge.png");
const TARGET = path.join(root, "convex", "invoiceLogo.ts");
/** Pixels at or below this in every channel count as the black surround. */
const BLACK_THRESHOLD = 60;
/** Plenty for the 170x64pt box the logo is drawn into. */
const TARGET_WIDTH = 400;

function readChunks(buffer) {
  const chunks = [];
  let pos = 8;
  while (pos < buffer.length) {
    const length = buffer.readUInt32BE(pos);
    const type = buffer.subarray(pos + 4, pos + 8).toString("latin1");
    chunks.push({ type, data: buffer.subarray(pos + 8, pos + 8 + length) });
    pos += 12 + length;
  }
  return chunks;
}

function unfilter(raw, width, height) {
  const stride = width * 4;
  const out = Buffer.alloc(stride * height);
  let prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[p];
    p += 1;
    const line = Buffer.from(raw.subarray(p, p + stride));
    p += stride;
    for (let i = 0; i < stride; i += 1) {
      const a = i >= 4 ? line[i - 4] : 0;
      const b = prev[i];
      const c = i >= 4 ? prev[i - 4] : 0;
      if (filter === 1) line[i] = (line[i] + a) & 255;
      else if (filter === 2) line[i] = (line[i] + b) & 255;
      else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a);
        const pb = Math.abs(pp - b);
        const pc = Math.abs(pp - c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    line.copy(out, y * stride);
    prev = line;
  }
  return out;
}

function encodePng(pixels, width, height) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunk = (type, data) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(body) : crc32(body));
    return Buffer.concat([head, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Minimal CRC32 for Node versions without zlib.crc32.
let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = -1;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** Nearest-neighbour downscale; the badge has no fine detail to preserve. */
function resize(pixels, width, height, targetWidth) {
  const targetHeight = Math.round((height * targetWidth) / width);
  const out = Buffer.alloc(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y += 1) {
    const sy = Math.min(height - 1, Math.floor((y * height) / targetHeight));
    for (let x = 0; x < targetWidth; x += 1) {
      const sx = Math.min(width - 1, Math.floor((x * width) / targetWidth));
      pixels.copy(out, (y * targetWidth + x) * 4, (sy * width + sx) * 4, (sy * width + sx) * 4 + 4);
    }
  }
  return { pixels: out, width: targetWidth, height: targetHeight };
}

const source = readFileSync(SOURCE);
const width = source.readUInt32BE(16);
const height = source.readUInt32BE(20);
const idat = Buffer.concat(
  readChunks(source)
    .filter((c) => c.type === "IDAT")
    .map((c) => c.data),
);
const pixels = unfilter(zlib.inflateSync(idat), width, height);

// Flood fill inward from the border, clearing the black surround only.
const seen = new Uint8Array(width * height);
const queue = [];
for (let x = 0; x < width; x += 1) queue.push([x, 0], [x, height - 1]);
for (let y = 0; y < height; y += 1) queue.push([0, y], [width - 1, y]);

let cleared = 0;
while (queue.length) {
  const [x, y] = queue.pop();
  if (x < 0 || y < 0 || x >= width || y >= height) continue;
  if (seen[y * width + x]) continue;
  const o = (y * width + x) * 4;
  if (pixels[o] > BLACK_THRESHOLD || pixels[o + 1] > BLACK_THRESHOLD || pixels[o + 2] > BLACK_THRESHOLD) {
    continue;
  }
  seen[y * width + x] = 1;
  pixels[o + 3] = 0;
  cleared += 1;
  queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}

const small = resize(pixels, width, height, TARGET_WIDTH);
const png = encodePng(small.pixels, small.width, small.height);
const base64 = png.toString("base64");

writeFileSync(
  TARGET,
  `/**
 * The TSWS badge, embedded for invoice PDFs. GENERATED — do not hand-edit.
 * Regenerate with: node scripts/build-invoice-logo.mjs
 *
 * Base64 rather than a fetch: a Convex action has no filesystem, and reaching
 * back to the site for an asset would make invoice generation depend on the web
 * server being up.
 *
 * public/logo-badge.png has the octagon on an opaque black rectangle (alpha is
 * 255 everywhere), which is invisible on the dark site but prints as a black
 * box on a white invoice. The build script flood-fills that surround to
 * transparent, stopping at the badge's white outline.
 */
export const LOGO_PNG_BASE64 =
  "${base64}";

/** Decode once per module load, not once per invoice. */
export const LOGO_BYTES: Uint8Array = Uint8Array.from(
  atob(LOGO_PNG_BASE64),
  (c) => c.charCodeAt(0),
);
`,
);

console.log(
  `[invoice-logo] ${cleared} px made transparent · ${small.width}x${small.height} · ${(png.length / 1024).toFixed(1)}KB`,
);
