/**
 * Generates build/icon.png — a stylized "D" matching the app's titlebar.
 * No external deps; rasterizes directly and encodes a PNG via zlib.
 *
 * Run: `node scripts/generate-icon.cjs`
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SIZE = 512;
const OUTPUTS = [
    path.join(__dirname, "..", "build", "icon.png"),  // electron-builder source
    path.join(__dirname, "..", "public", "icon.png"), // browser favicon (Vite serves /public at /)
];

// Gold gradient from .titlebar-text (main.css):
//   #fbe6a0 0% → #e8c668 35% → #b38a3a 75% → #7a5a1f 100%
const GOLD = [
    { t: 0.0, c: [251, 230, 160] },
    { t: 0.35, c: [232, 198, 104] },
    { t: 0.75, c: [179, 138, 58] },
    { t: 1.0, c: [122, 90, 31] },
];

// Background tint that matches titlebar (#221a15) with a soft top highlight.
const BG = [
    { t: 0.0, c: [50, 38, 26] },
    { t: 1.0, c: [22, 17, 13] },
];

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function sampleGradient(stops, t) {
    if (t <= stops[0].t) return stops[0].c;
    if (t >= stops[stops.length - 1].t) return stops[stops.length - 1].c;
    for (let i = 0; i < stops.length - 1; i++) {
        const a = stops[i];
        const b = stops[i + 1];
        if (t >= a.t && t <= b.t) {
            const local = (t - a.t) / (b.t - a.t);
            return [
                lerp(a.c[0], b.c[0], local),
                lerp(a.c[1], b.c[1], local),
                lerp(a.c[2], b.c[2], local),
            ];
        }
    }
    return stops[stops.length - 1].c;
}

// "D" geometry — tuned visually, with subtle Cinzel-ish serif feet.
const TOP = 92;
const BOT = 420;
const HEIGHT = BOT - TOP;
const STEM_LEFT = 108;
const STEM_RIGHT = 184;
const BOWL_RIGHT = 432;
const SERIF_OVERHANG = 14; // serif sticks out left of stem
const SERIF_THICK = 18;    // height of the serif foot
const ARM_THICKNESS = 56;  // top/bottom horizontal arms (between outer and counter)
const WALL_THICKNESS = 64; // inner wall thickness (between stem inner edge and counter)

const COUNTER_LEFT = STEM_LEFT + WALL_THICKNESS;       // 172
const COUNTER_TOP = TOP + ARM_THICKNESS;               // 148
const COUNTER_BOT = BOT - ARM_THICKNESS;               // 364
const COUNTER_CY = (COUNTER_TOP + COUNTER_BOT) / 2;    // 256
const COUNTER_RY = (COUNTER_BOT - COUNTER_TOP) / 2;    // 108

const CY = (TOP + BOT) / 2;                            // 256
const OUTER_RX = BOWL_RIGHT - STEM_RIGHT;              // 248
const OUTER_RY = (BOT - TOP) / 2;                      // 164

// Inner bowl curve: anchored at COUNTER_LEFT, extends to BOWL_RIGHT - 36 (right wall thickness).
const INNER_RIGHT = BOWL_RIGHT - 40;
const INNER_RX = INNER_RIGHT - COUNTER_LEFT;           // 220

function insideD(x, y) {
    if (y < TOP || y > BOT) {
        // Allow serifs at top and bottom of the stem.
        if (y >= TOP - SERIF_THICK && y <= TOP) {
            return x >= STEM_LEFT - SERIF_OVERHANG && x <= STEM_RIGHT + 4;
        }
        if (y >= BOT && y <= BOT + SERIF_THICK) {
            return x >= STEM_LEFT - SERIF_OVERHANG && x <= STEM_RIGHT + 4;
        }
        return false;
    }
    if (x < STEM_LEFT) return false;
    if (x <= STEM_RIGHT) return true; // stem
    // Bowl region: must be inside outer half-ellipse.
    const ox = (x - STEM_RIGHT) / OUTER_RX;
    const oy = (y - CY) / OUTER_RY;
    if (ox * ox + oy * oy > 1) return false;
    // Subtract the counter (inner cavity).
    if (y >= COUNTER_TOP && y <= COUNTER_BOT && x >= COUNTER_LEFT) {
        const ix = (x - COUNTER_LEFT) / INNER_RX;
        const iy = (y - COUNTER_CY) / COUNTER_RY;
        if (ix * ix + iy * iy < 1) return false;
    }
    return true;
}

// 4x4 supersampled coverage for anti-aliasing.
function coverageD(x, y) {
    let hits = 0;
    for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
            if (insideD(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4)) hits++;
        }
    }
    return hits / 16;
}

// Drop-shadow contribution: a soft offset shadow under the letter (pre-blurred via small box).
function shadowAt(x, y) {
    // Offset shadow by (3, 5), evaluate D coverage at that offset, then blur.
    let sum = 0;
    const radius = 4;
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const sx = x - 3 + dx;
            const sy = y - 5 + dy;
            // Quick reject far from D bounds.
            if (sy < TOP - SERIF_THICK - radius || sy > BOT + SERIF_THICK + radius) continue;
            if (sx < STEM_LEFT - SERIF_OVERHANG - radius || sx > BOWL_RIGHT + radius) continue;
            sum += insideD(sx, sy) ? 1 : 0;
        }
    }
    const area = (radius * 2 + 1) * (radius * 2 + 1);
    return sum / area;
}

// === Render ===
const buf = Buffer.alloc(SIZE * SIZE * 4);
const cornerRadius = 96;

function inRoundedRect(x, y, w, h, r) {
    if (x < 0 || x > w || y < 0 || y > h) return false;
    if (x >= r && x <= w - r) return true;
    if (y >= r && y <= h - r) return true;
    const cx = x < r ? r : w - r;
    const cy = y < r ? r : h - r;
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r;
}

function roundedRectCoverage(x, y) {
    let hits = 0;
    for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
            if (inRoundedRect(x + (sx + 0.5) / 4, y + (sy + 0.5) / 4, SIZE, SIZE, cornerRadius)) {
                hits++;
            }
        }
    }
    return hits / 16;
}

for (let y = 0; y < SIZE; y++) {
    const bgColor = sampleGradient(BG, y / (SIZE - 1));
    for (let x = 0; x < SIZE; x++) {
        // Background with rounded-rect alpha.
        const bgAlpha = roundedRectCoverage(x, y);

        // Subtle gold border ring (~3px inset 6px from edge).
        const borderInset = 8;
        const borderWidth = 3;
        const borderOuter = roundedRectCoverage(x, y) > 0;
        let borderHit = 0;
        if (borderOuter) {
            // Compute distance to the rounded-rect inner edge.
            // Approximate: pixel must be within borderInset..borderInset+borderWidth of edge.
            const distLeft = x;
            const distRight = SIZE - 1 - x;
            const distTop = y;
            const distBot = SIZE - 1 - y;
            const minEdge = Math.min(distLeft, distRight, distTop, distBot);
            // Corner correction
            let edgeDist = minEdge;
            if (x < cornerRadius && y < cornerRadius) {
                edgeDist = cornerRadius - Math.hypot(cornerRadius - x, cornerRadius - y);
            } else if (x > SIZE - cornerRadius && y < cornerRadius) {
                edgeDist = cornerRadius - Math.hypot(x - (SIZE - cornerRadius), cornerRadius - y);
            } else if (x < cornerRadius && y > SIZE - cornerRadius) {
                edgeDist = cornerRadius - Math.hypot(cornerRadius - x, y - (SIZE - cornerRadius));
            } else if (x > SIZE - cornerRadius && y > SIZE - cornerRadius) {
                edgeDist = cornerRadius - Math.hypot(x - (SIZE - cornerRadius), y - (SIZE - cornerRadius));
            }
            if (edgeDist >= borderInset && edgeDist <= borderInset + borderWidth) {
                borderHit = 1;
            } else if (edgeDist >= borderInset - 1 && edgeDist <= borderInset + borderWidth + 1) {
                borderHit = 0.5; // soften
            }
        }

        // Letter coverage.
        const dCov = coverageD(x, y);
        const goldT = Math.max(0, Math.min(1, (y - TOP) / HEIGHT));
        const gold = sampleGradient(GOLD, goldT);

        // Drop shadow.
        const shadow = dCov < 1 ? shadowAt(x, y) * (1 - dCov) : 0;

        // Compose.
        let r = bgColor[0];
        let g = bgColor[1];
        let b = bgColor[2];

        // Apply shadow (darken).
        if (shadow > 0.02) {
            const k = shadow * 0.55;
            r = r * (1 - k);
            g = g * (1 - k);
            b = b * (1 - k);
        }

        // Apply border (subtle gold line).
        if (borderHit > 0) {
            const borderColor = [197, 157, 74];
            const k = borderHit * 0.5;
            r = lerp(r, borderColor[0], k);
            g = lerp(g, borderColor[1], k);
            b = lerp(b, borderColor[2], k);
        }

        // Apply letter on top.
        if (dCov > 0) {
            r = lerp(r, gold[0], dCov);
            g = lerp(g, gold[1], dCov);
            b = lerp(b, gold[2], dCov);
        }

        const i = (y * SIZE + x) * 4;
        buf[i] = Math.round(r);
        buf[i + 1] = Math.round(g);
        buf[i + 2] = Math.round(b);
        buf[i + 3] = Math.round(bgAlpha * 255);
    }
}

// === PNG encode ===
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return t;
})();

function crc32(data) {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
        c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // color type RGBA
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const rowBytes = width * 4;
    const filtered = Buffer.alloc(height * (1 + rowBytes));
    for (let y = 0; y < height; y++) {
        filtered[y * (1 + rowBytes)] = 0; // filter: none
        rgba.copy(filtered, y * (1 + rowBytes) + 1, y * rowBytes, (y + 1) * rowBytes);
    }
    const idat = zlib.deflateSync(filtered, { level: 9 });

    return Buffer.concat([
        sig,
        chunk("IHDR", ihdr),
        chunk("IDAT", idat),
        chunk("IEND", Buffer.alloc(0)),
    ]);
}

const png = encodePNG(SIZE, SIZE, buf);
for (const out of OUTPUTS) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, png);
    console.log(`Wrote ${out} (${SIZE}x${SIZE})`);
}
