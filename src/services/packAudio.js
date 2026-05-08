// Sample-based pack-opening sound effects.
//
// Five samples loaded once and triggered via Web Audio so we can route through
// a master gain node for muting. Browser autoplay policy requires AudioContext
// creation/resume inside a user gesture — `unlockAudio()` is called on the
// click that opens the first pack and also kicks off sample preload.

import ripUrl from "../assets/audio/rip.wav?url";
import tearUrl from "../assets/audio/tear.wav?url";
import flipUrl from "../assets/audio/flip.wav?url";
import mythicUrl from "../assets/audio/mythic.wav?url";
import masterpieceUrl from "../assets/audio/masterpiece.wav?url";

const FLOURISH = {
    mythic:      { url: mythicUrl,      peak: 1.0 },
    masterpiece: { url: masterpieceUrl, peak: 1.0 },
};

let ctx = null;
let masterGain = null;
let muted = false;
const buffers = new Map();
const pending = new Map();

function getCtx() {
    if (typeof window === "undefined") return null;
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.7;
    masterGain.connect(ctx.destination);
    return ctx;
}

function loadBuffer(url) {
    if (buffers.has(url)) return Promise.resolve(buffers.get(url));
    if (pending.has(url)) return pending.get(url);
    const c = getCtx();
    if (!c) return Promise.resolve(null);
    const p = fetch(url)
        .then((r) => r.arrayBuffer())
        .then((arr) => c.decodeAudioData(arr))
        .then((buf) => {
            buffers.set(url, buf);
            pending.delete(url);
            return buf;
        })
        .catch((err) => {
            pending.delete(url);
            // Silent failure — audio is non-essential.
            console.warn("packAudio: failed to load", url, err);
            return null;
        });
    pending.set(url, p);
    return p;
}

function playSample(url, peak = 1.0) {
    const c = getCtx();
    if (!c || muted) return;
    const buf = buffers.get(url);
    if (!buf) {
        // First-time path: fire-and-forget load. Sample will be ready on next call.
        loadBuffer(url);
        return;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = peak;
    src.connect(g);
    g.connect(masterGain);
    src.start();
}

export function setMuted(value) {
    muted = !!value;
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.7;
}

export function isMuted() {
    return muted;
}

export async function unlockAudio() {
    const c = getCtx();
    if (!c) return;
    if (c.state === "suspended") {
        try {
            await c.resume();
        } catch {
            /* ignore */
        }
    }
    await Promise.all([
        loadBuffer(ripUrl),
        loadBuffer(tearUrl),
        loadBuffer(flipUrl),
        loadBuffer(mythicUrl),
        loadBuffer(masterpieceUrl),
    ]);
}

// Plays a one-off sample by URL synchronously (buffers are preloaded by
// unlockAudio). Returns the duration in ms so callers can chain visual or
// audio events off the playback length.
function playSampleSync(url, peak = 1.0) {
    const c = getCtx();
    if (!c || muted) return 0;
    const buf = buffers.get(url);
    if (!buf) {
        loadBuffer(url);
        return 0;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    g.gain.value = peak;
    src.connect(g);
    g.connect(masterGain);
    src.start();
    return buf.duration * 1000;
}

// Crinkle / packaging-handling sound. Plays during the pack-shake animation.
export function playRip() {
    return playSampleSync(ripUrl);
}

// Final tear / snap that punctuates the open. Plays after the crinkle, just
// before cards begin revealing. Boosted above the crinkle so the snap reads
// as the decisive moment rather than blending into the rip's tail.
export function playTear() {
    return playSampleSync(tearUrl, 2.5);
}

export function playCardReveal() {
    // Quieter — fires once per card revealed (up to ~15 times in a row).
    playSample(flipUrl, 0.55);
}

export function playFlourish(tier) {
    const entry = FLOURISH[tier];
    if (!entry) return;
    playSample(entry.url, entry.peak);
}
