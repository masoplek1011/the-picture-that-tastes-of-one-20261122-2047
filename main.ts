// The picture that tastes of one ingredient — one steaming bowl of ramen.
// Procedural 1024x1024 PNG, Node 22 stdlib only. Fully deterministic.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);

// ---- deterministic PRNG (mulberry32, fixed seed) ----
let s = 0x9e3779b9;
function rnd(): number {
  s |= 0; s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---- pixel helpers ----
function setPx(x: number, y: number, r: number, g: number, b: number): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
}
function blendPx(x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || x >= W || y < 0 || y >= H || a <= 0) return;
  if (a >= 1) { setPx(x, y, r, g, b); return; }
  const i = (y * W + x) * 3;
  buf[i] = Math.round(buf[i] * (1 - a) + r * a);
  buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + g * a);
  buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + b * a);
}
type RGB = [number, number, number];

function fillRect(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  for (let y = Math.max(0, y0); y < Math.min(H, y1); y++)
    for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) setPx(x, y, c[0], c[1], c[2]);
}
function fillCircle(cx: number, cy: number, r: number, c: RGB, a = 1): void {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r2) blendPx(x, y, c[0], c[1], c[2], a);
    }
}
function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB, a = 1): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) blendPx(x, y, c[0], c[1], c[2], a);
    }
}
// thick line via sampled circles
function thickLine(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB, a = 1): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(len * 1.5));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillCircle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w / 2, c, a);
  }
}
// wavy polyline, thick
function wavyLine(pts: Array<[number, number]>, w: number, c: RGB, a = 1): void {
  for (let i = 0; i < pts.length - 1; i++)
    thickLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, c, a);
}
// ellipse arc stroke (noodle ring), with waviness
function noodleRing(cx: number, cy: number, rx: number, ry: number, c: RGB, w: number, phase: number, a = 1): void {
  const steps = 220;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const wob = 1 + 0.06 * Math.sin(t * 3 + phase) + 0.04 * Math.sin(t * 5 + phase * 2);
    const x = cx + rx * wob * Math.cos(t);
    const y = cy + ry * wob * Math.sin(t);
    fillCircle(x, y, w / 2, c, a);
  }
}

// ======================= SCENE =======================
// 1. Warm dark background, vertical gradient + soft warm glow behind bowl
for (let y = 0; y < H; y++) {
  const t = y / H;
  const r = Math.round(38 + 26 * t);
  const g = Math.round(20 + 16 * t);
  const b = Math.round(12 + 10 * t);
  for (let x = 0; x < W; x++) setPx(x, y, r, g, b);
}
// warm glow
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const dx = (x - 512) / 520, dy = (y - 480) / 460;
  const d = dx * dx + dy * dy;
  if (d < 1) {
    const a = (1 - d) * 0.35;
    blendPx(x, y, 122, 66, 28, a);
  }
}
// table band at bottom
for (let y = 880; y < H; y++) {
  const t = (y - 880) / 144;
  for (let x = 0; x < W; x++) {
    blendPx(x, y, 74 + Math.round(20 * t), 44 + Math.round(12 * t), 26 + Math.round(8 * t), 0.55);
  }
}

// 2. Bowl body — big deep-red bowl, bottom of frame
fillEllipse(512, 700, 398, 300, [122, 30, 26]);
fillEllipse(512, 700, 398, 300, [146, 40, 30], 0.0); // noop guard
// bowl shading: darker lower half, lighter upper-left rim light
for (let y = 430; y < H; y++) for (let x = 0; x < W; x++) {
  const dx = (x - 512) / 398, dy = (y - 700) / 300;
  if (dx * dx + dy * dy <= 1) {
    const shade = Math.max(0, (y - 640) / 360) * 0.28;
    blendPx(x, y, 60, 14, 10, shade);
    const hi = Math.max(0, 1 - Math.hypot((x - 330) / 260, (y - 560) / 200)) * 0.22;
    if (hi > 0) blendPx(x, y, 214, 92, 58, hi);
  }
}
// bowl foot shadow on table
fillEllipse(512, 1000, 240, 26, [20, 8, 5], 0.5);

// 3. Rim + broth
fillEllipse(512, 618, 392, 148, [88, 20, 16]);            // rim ring outer
fillEllipse(512, 618, 366, 130, [196, 118, 40]);          // broth base
// broth gradient: deeper amber centre, golden edge
for (let y = 488; y < 748; y++) for (let x = 146; x < 878; x++) {
  const dx = (x - 512) / 366, dy = (y - 618) / 130;
  const d2 = dx * dx + dy * dy;
  if (d2 <= 1) {
    const t = Math.sqrt(d2);
    const r = Math.round(214 - 52 * t);
    const g = Math.round(138 - 46 * t);
    const b = Math.round(52 - 22 * t);
    setPx(x, y, r, g, b);
  }
}
// broth gloss highlight (upper-left sheen)
fillEllipse(400, 566, 150, 34, [255, 214, 130], 0.34);
fillEllipse(430, 580, 90, 20, [255, 232, 170], 0.28);

// 4. Noodle rings in the broth — bold, chunky
const noodleCols: RGB[] = [[242, 193, 78], [232, 169, 60], [248, 210, 110], [224, 156, 48]];
noodleRing(512, 618, 300, 96, noodleCols[0], 17, 0.0);
noodleRing(512, 618, 252, 78, noodleCols[1], 16, 1.3);
noodleRing(512, 618, 204, 62, noodleCols[2], 15, 2.6);
noodleRing(512, 618, 156, 46, noodleCols[0], 14, 0.7);
noodleRing(512, 618, 108, 32, noodleCols[3], 13, 1.9);
noodleRing(512, 618, 64, 20, noodleCols[2], 12, 3.4);
// loose noodle strands crossing the bowl
wavyLine([[220, 600], [330, 640], [470, 600], [600, 648], [760, 606]], 13, noodleCols[1], 0.95);
wavyLine([[260, 660], [400, 690], [560, 652], [720, 682]], 12, noodleCols[0], 0.95);

// 5. Toppings — big and bold
// chashu slices (two, front)
fillEllipse(500, 700, 92, 58, [216, 138, 112]);
fillEllipse(500, 700, 74, 44, [232, 164, 138]);
fillEllipse(500, 700, 46, 26, [196, 116, 92]);
fillEllipse(636, 716, 78, 50, [216, 138, 112]);
fillEllipse(636, 716, 62, 38, [232, 164, 138]);
// half egg (left)
fillEllipse(356, 612, 78, 62, [250, 244, 228]);
fillEllipse(356, 612, 64, 50, [244, 236, 218]);
fillCircle(356, 612, 34, [240, 138, 24]);
fillCircle(348, 604, 14, [255, 176, 80], 0.9);
// narutomaki (right)
fillCircle(700, 566, 46, [250, 246, 238]);
fillCircle(700, 566, 30, [238, 120, 140]);
fillCircle(700, 566, 20, [250, 246, 238]);
fillCircle(700, 566, 10, [238, 120, 140]);
// green onion rings scattered on broth
const onions: Array<[number, number, number]> = [
  [300, 560, 11], [430, 540, 10], [590, 540, 11], [760, 600, 10],
  [250, 640, 10], [820, 650, 11], [470, 742, 10], [600, 748, 10],
  [330, 700, 9], [760, 700, 9], [540, 560, 9], [660, 640, 9],
];
for (const [ox, oy, orr] of onions) {
  fillCircle(ox, oy, orr, [46, 128, 52]);
  fillCircle(ox, oy, orr * 0.55, [120, 190, 80]);
}
// sesame seeds
for (let i = 0; i < 26; i++) {
  const a = rnd() * Math.PI * 2, rr = 40 + rnd() * 280;
  const x = 512 + Math.cos(a) * rr * 1.15;
  const y = 618 + Math.sin(a) * rr * 0.4;
  fillCircle(x, y, 3.5, [250, 232, 190], 0.9);
}

// 6. Lifted noodle strand (chopsticks drawn later, on top of the steam)
const lift: Array<[number, number]> = [];
for (let i = 0; i <= 26; i++) {
  const t = i / 26;
  const x = 612 - 18 * t + 26 * Math.sin(t * 9.5) * (1 - t * 0.4);
  const y = 430 + 190 * t + 10 * Math.sin(t * 6);
  lift.push([x, y]);
}
wavyLine(lift, 15, noodleCols[0], 1);
const lift2: Array<[number, number]> = [];
for (let i = 0; i <= 22; i++) {
  const t = i / 22;
  const x = 636 - 30 * t + 22 * Math.sin(t * 8 + 1.2) * (1 - t * 0.4);
  const y = 436 + 178 * t + 8 * Math.sin(t * 5 + 2);
  lift2.push([x, y]);
}
wavyLine(lift2, 12, noodleCols[2], 1);

// 7. Steam — thin translucent curls above the bowl
function steamCurl(cx: number, top: number, bottom: number, amp: number, w: number, a: number): void {
  const pts: Array<[number, number]> = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = bottom - (bottom - top) * t;
    const x = cx + amp * Math.sin(t * Math.PI * 2.4) * (0.4 + 0.6 * t);
    pts.push([x, y]);
  }
  wavyLine(pts, w, [245, 238, 228], a);
}
steamCurl(380, 200, 540, 30, 13, 0.07);
steamCurl(512, 170, 540, 34, 15, 0.08);
steamCurl(640, 210, 540, 28, 12, 0.06);
steamCurl(452, 260, 540, 20, 10, 0.05);
steamCurl(576, 250, 540, 22, 10, 0.05);

// 7b. Chopsticks — drawn last so they sit clearly on top of the steam
thickLine(762, 118, 622, 428, 22, [38, 20, 10]);
thickLine(802, 148, 656, 438, 22, [38, 20, 10]);
thickLine(762, 118, 622, 428, 9, [150, 100, 55], 0.9);
thickLine(802, 148, 656, 438, 9, [150, 100, 55], 0.9);

// 8. Subtle grain on broth + bowl (deterministic), then vignette
for (let i = 0; i < 9000; i++) {
  const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
  const idx = (y * W + x) * 3;
  const n = Math.floor((rnd() - 0.5) * 14);
  buf[idx] = Math.max(0, Math.min(255, buf[idx] + n));
  buf[idx + 1] = Math.max(0, Math.min(255, buf[idx + 1] + n));
  buf[idx + 2] = Math.max(0, Math.min(255, buf[idx + 2] + n));
}
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const dx = (x - 512) / 512, dy = (y - 512) / 512;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 0.82) blendPx(x, y, 8, 4, 2, Math.min(0.5, (d - 0.82) * 2.2));
}

// ======================= PNG ENCODER =======================
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c >>> 0;
}
function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}
// build filtered scanlines, pick best filter per row by sum of |signed byte|
const raw = Buffer.alloc(H * (1 + W * 3));
for (let y = 0; y < H; y++) {
  const rowStart = y * W * 3;
  const row = buf.subarray(rowStart, rowStart + W * 3);
  const prev = y > 0 ? buf.subarray((y - 1) * W * 3, y * W * 3) : null;
  let bestFilter = 0, bestScore = Infinity, bestLine: Buffer | null = null;
  for (let f = 0; f <= 4; f++) {
    if (f === 3) continue; // Avg rarely wins on flat art; keep 0/1/2/4
    const line = Buffer.alloc(W * 3);
    let score = 0;
    for (let x = 0; x < W * 3; x++) {
      const v = row[x];
      const left = x >= 3 ? row[x - 3] : 0;
      const up = prev ? prev[x] : 0;
      const upLeft = prev && x >= 3 ? prev[x - 3] : 0;
      let pred = 0;
      if (f === 1) pred = left;
      else if (f === 2) pred = up;
      else if (f === 4) pred = paeth(left, up, upLeft);
      const d = (v - pred) & 0xff;
      line[x] = d;
      score += d < 128 ? d : 256 - d;
    }
    if (score < bestScore) { bestScore = score; bestFilter = f; bestLine = line; }
  }
  const outOff = y * (1 + W * 3);
  raw[outOff] = bestFilter;
  (bestLine as Buffer).copy(raw, outOff + 1);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 2;  // truecolor RGB
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), png);
console.log(`wrote ${join(outDir, 'entry.png')} (${png.length} bytes)`);
