// Synthesized pack-opening sound effects via Web Audio.
//
// We synthesize everything to avoid shipping binary assets (and to make the
// sounds easy to tweak). Browser autoplay policy requires AudioContext to be
// created/resumed inside a user gesture, so we lazily init on first play().

let ctx = null;
let masterGain = null;
let fxBus = null; // Tonal voices route here. Splits to dry + reverb send.
let muted = false;

function getCtx() {
    if (typeof window === "undefined") return null;
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 0.5;
    masterGain.connect(ctx.destination);

    // FX architecture for the tonal flourishes. fxBus splits into:
    //   - dry leg → masterGain
    //   - wet leg → convolver → wetGain → masterGain
    // The reverb is what kills the "8-bit" feel — without spatial decay every
    // voice lands flat in your face like a chiptune blip.
    fxBus = ctx.createGain();
    fxBus.gain.value = 1.0;
    fxBus.connect(masterGain);

    const convolver = ctx.createConvolver();
    convolver.buffer = makeReverbIR(ctx, 2.4, 2.6);
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.45;
    fxBus.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(masterGain);

    return ctx;
}

// Synthesize a stereo impulse response: decaying decorrelated noise. Cheap to
// generate, sounds like a small hall.
function makeReverbIR(c, seconds, decayPower) {
    const len = Math.floor(c.sampleRate * seconds);
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const data = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) {
            const t = i / len;
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decayPower);
        }
    }
    return ir;
}

export function setMuted(value) {
    muted = !!value;
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
}

export function isMuted() {
    return muted;
}

// Best-effort resume after a user gesture. Browsers will sometimes leave the
// context suspended even after construction.
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
}

// --- Primitives -----------------------------------------------------------

function envelope(node, c, start, attack, decay, sustain, release, peak = 1) {
    const g = node.gain;
    g.cancelScheduledValues(start);
    g.setValueAtTime(0, start);
    g.linearRampToValueAtTime(peak, start + attack);
    g.linearRampToValueAtTime(peak * sustain, start + attack + decay);
    g.linearRampToValueAtTime(0, start + attack + decay + release);
}

function tone(c, dest, freq, start, dur, type = "sine", peak = 0.4) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    osc.connect(g);
    g.connect(dest);
    envelope(g, c, start, 0.005, dur * 0.2, 0.7, dur * 0.8, peak);
    osc.start(start);
    osc.stop(start + dur + 0.05);
}

// White noise buffer cache.
let noiseBuf = null;
function getNoiseBuffer(c) {
    if (noiseBuf) return noiseBuf;
    const len = c.sampleRate * 2;
    noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuf;
}

function noise(c, dest, start, dur, filterType, filterFreq, q, peak = 0.6) {
    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer(c);
    const filter = c.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, start);
    filter.Q.value = q;
    const g = c.createGain();
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    envelope(g, c, start, 0.005, dur * 0.2, 0.6, dur * 0.8, peak);
    src.start(start);
    src.stop(start + dur + 0.05);
    return { filter };
}

// --- Sound recipes --------------------------------------------------------

// Tearing foil. Real pack tears are granular — a stream of tiny crackles, not a
// smooth whoosh — so we layer:
//   1. A highpass-filtered "shhhh" bed for the continuous papery hiss
//   2. ~14 random micro-crackle bursts over ~450ms for the irregular texture
//   3. A final clean snap as the foil parts
// All voiced in the upper-mid band where thin plastic/foil actually lives.
export function playRip() {
    const c = getCtx();
    if (!c || muted) return;
    const t = c.currentTime;

    // Bed: papery hiss. Highpass at ~1.8kHz to strip out anything bass-heavy
    // that would make it sound like a "power" effect. Slight downward sweep
    // mimics the tear opening up and slowing down.
    const { filter } = noise(c, masterGain, t, 0.46, "highpass", 2200, 0.4, 0.32);
    filter.frequency.exponentialRampToValueAtTime(1400, t + 0.46);

    // Crackle layer: a salvo of very short bandpass-filtered bursts at random
    // offsets and pitches. This is what gives the ear the impression of foil
    // fibers separating one after another rather than a single smooth gesture.
    const bursts = 14;
    for (let i = 0; i < bursts; i++) {
        // Cluster the crackles toward the middle/end of the rip — that's where
        // the tear is most active. Slight ease-in.
        const progress = (i / bursts) ** 0.85;
        const offset = progress * 0.42 + Math.random() * 0.025;
        const len = 0.012 + Math.random() * 0.022;
        const freq = 2800 + Math.random() * 2400; // 2.8–5.2 kHz
        const peak = 0.18 + Math.random() * 0.18;
        noise(c, masterGain, t + offset, len, "bandpass", freq, 7, peak);
    }

    // Final snap — the fully-parted foil. A bit lower in the band so it reads
    // as a definitive "open" instead of just another crackle.
    noise(c, masterGain, t + 0.44, 0.06, "bandpass", 1900, 4, 0.5);
}

// Quick card-flip click. Used as cards reveal one by one.
export function playCardReveal() {
    const c = getCtx();
    if (!c || muted) return;
    const t = c.currentTime;
    noise(c, masterGain, t, 0.04, "bandpass", 2200, 8, 0.35);
}

// Rarity-tier flourish that plays as the cards finish revealing.
//
// Everything routes through fxBus (which adds a reverb tail) so the voices
// breathe in space rather than sitting flat against your ear like chiptune.
// All pad voices use detuned twin oscillators + lowpass filtering, which is
// what separates "a synth pad" from "a beep."
export function playFlourish(tier) {
    const c = getCtx();
    if (!c || muted) return;
    const t = c.currentTime;
    // NOTE on tier frequency: standard packs always roll a rare/mythic in the
    // rare slot, so `rarestTier` is almost always "rare", "mythic", or "bonus".
    // Common/uncommon flourishes only fire on sets that lack a rare slot — we
    // keep them simple but clearly audible for those edge cases.
    switch (tier) {
        case "common":
            // Single glassy bell tap. Quick, not flashy, but you hear it.
            playGlassyBell(c, fxBus, t, 1318.5, 0.55, 0.26); // E6
            noise(c, fxBus, t, 0.1, "bandpass", 4500, 6, 0.16);
            break;
        case "uncommon":
            // Two-note ascending chime — a small spark of "something there."
            playSwoosh(c, fxBus, t, 0.22, 2200, 5500, 0.22);
            playGlassyBell(c, fxBus, t + 0.05, 1318.5, 0.7, 0.3);  // E6
            playGlassyBell(c, fxBus, t + 0.18, 1975.5, 0.65, 0.28); // B6
            playSparkle(c, fxBus, t + 0.28, 4, [2349, 2637, 3136, 3520], 0.05, 0.16);
            break;
        case "rare":
            // The "every pack" reward — punchy, bell-forward, ~1s. Deliberately
            // bell-only (no pad, no vox) so mythic's pad+vox feel like a true
            // step up rather than just "same thing, but more."
            playSwoosh(c, fxBus, t, 0.3, 1600, 5200, 0.26);
            // Ascending broken A-major triad. Top note hits hardest.
            playGlassyBell(c, fxBus, t + 0.08, 880, 0.95, 0.32);    // A5
            playGlassyBell(c, fxBus, t + 0.16, 1108.74, 0.9, 0.28); // C#6
            playGlassyBell(c, fxBus, t + 0.24, 1318.51, 0.85, 0.26); // E6
            playGlassyBell(c, fxBus, t + 0.34, 1760, 0.95, 0.32);   // A6 (resolution)
            playSparkle(c, fxBus, t + 0.42, 6, [2093, 2349, 2637, 3136, 3520, 4186], 0.05, 0.16);
            break;
        case "mythic":
            // Mythic. Has to feel CATEGORICALLY more than rare — not just bigger.
            // The differentiators rare doesn't have:
            //   • Long swoosh (0.7s) — anticipation
            //   • Vox formant sustain ("ah" vowel) — unique timbre
            //   • Slow-bloom pad chord under everything
            //   • Two-wave bell choir (6 bells, low + high)
            //   • Sparkle storm (12 vs rare's 6)
            //   • ~2.5s total runtime vs rare's ~1s
            playSwoosh(c, fxBus, t, 0.7, 800, 6500, 0.3);
            // Vox: the unique mythic timbre. Two voices a fifth apart.
            playVox(c, fxBus, t + 0.3, 392, 1.7, 0.18);     // G4
            playVox(c, fxBus, t + 0.35, 587.33, 1.6, 0.14); // D5
            // Slow-blooming wide G-major-9 pad (G/B/D/F#/A).
            playPadChord(
                c,
                fxBus,
                t + 0.45,
                [196, 246.94, 293.66, 369.99, 440],
                2.2,
                0.11
            );
            // Wave 1 — low/mid cathedral bells.
            playGlassyBell(c, fxBus, t + 0.6, 392, 1.8, 0.3);     // G4
            playGlassyBell(c, fxBus, t + 0.7, 587.33, 1.7, 0.26); // D5
            playGlassyBell(c, fxBus, t + 0.8, 783.99, 1.6, 0.24); // G5
            // Wave 2 — high celestial answer.
            playGlassyBell(c, fxBus, t + 1.05, 1174.66, 1.5, 0.26); // D6
            playGlassyBell(c, fxBus, t + 1.18, 1567.98, 1.4, 0.24); // G6
            playGlassyBell(c, fxBus, t + 1.32, 2349.32, 1.3, 0.22); // D7
            // Sparkle storm — bigger and longer.
            playSparkle(
                c,
                fxBus,
                t + 1.4,
                12,
                [2349, 2637, 3136, 3520, 4186, 4699, 5274, 6272, 7040, 7902, 8369, 9397],
                0.06,
                0.13
            );
            break;
        case "bonus":
            // Bonus-sheet: ethereal, otherworldly. Soft pad underbed + FM bell
            // triad + long sparkle tail. Reverb does most of the heavy lifting.
            playPadChord(c, fxBus, t, [261.63, 329.63, 392], 2.2, 0.1); // C major pad
            playBell(c, fxBus, t, 1046.5, 1.5); // C6
            playBell(c, fxBus, t + 0.22, 1568, 1.4); // G6
            playBell(c, fxBus, t + 0.44, 2093, 1.3); // C7
            playSparkle(c, fxBus, t + 0.6, 7, [3136, 3520, 4186, 4699, 5274, 6272, 7040], 0.06, 0.12);
            break;
    }
}

// FM bell — bright inharmonic strike used for the bonus-sheet flourish.
function playBell(c, dest, start, freq, dur) {
    const carrier = c.createOscillator();
    const mod = c.createOscillator();
    const modGain = c.createGain();
    const g = c.createGain();
    carrier.type = "sine";
    mod.type = "sine";
    carrier.frequency.value = freq;
    mod.frequency.value = freq * 1.4;
    modGain.gain.value = freq * 2;
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(g);
    g.connect(dest);
    envelope(g, c, start, 0.005, dur * 0.15, 0.4, dur * 0.85, 0.28);
    carrier.start(start);
    mod.start(start);
    carrier.stop(start + dur + 0.05);
    mod.stop(start + dur + 0.05);
}

// Glassy/celesta bell — additive synthesis with mildly inharmonic partials so
// it sounds like struck crystal rather than a pure sine.
function playGlassyBell(c, dest, start, freq, dur, peak = 0.25) {
    // Inharmonic partial ratios approximating a glass/metal bar.
    const partials = [
        { ratio: 1.0, gain: 1.0 },
        { ratio: 2.01, gain: 0.55 },
        { ratio: 3.02, gain: 0.32 },
        { ratio: 4.05, gain: 0.18 },
        { ratio: 5.4, gain: 0.1 },
    ];
    for (const p of partials) {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = "sine";
        osc.frequency.value = freq * p.ratio;
        osc.connect(g);
        g.connect(dest);
        // Higher partials decay faster — that's what gives bells their bloom.
        const release = dur * (1 - 0.12 * (p.ratio - 1));
        envelope(g, c, start, 0.002, dur * 0.05, 0.5, Math.max(0.1, release), peak * p.gain);
        osc.start(start);
        osc.stop(start + dur + 0.08);
    }
}

// Magical swoosh — bandpass-filtered noise swept upward (or downward). Used as
// the "spell incoming" pickup before the chord lands.
function playSwoosh(c, dest, start, dur, fromFreq, toFreq, peak = 0.25) {
    const { filter } = noise(c, dest, start, dur, "bandpass", fromFreq, 4, peak);
    filter.frequency.exponentialRampToValueAtTime(toFreq, start + dur);
}

// Sparkle cascade — quick run of very short glassy pings on the given pitches.
// Adds the "stardust" shimmer over the top of rare/mythic chords.
function playSparkle(c, dest, start, count, pitches, spacing, peak = 0.18) {
    for (let i = 0; i < count; i++) {
        const freq = pitches[i % pitches.length];
        playGlassyBell(c, dest, start + i * spacing, freq, 0.35, peak * (0.6 + Math.random() * 0.4));
    }
}

// Soft chord pad. The anti-8-bit ingredients:
//   - every voice is doubled with a ~6¢-detuned twin (chorus / ensemble feel)
//   - lowpass filter that opens slowly during the attack (warmth, then bloom)
//   - long attack (~120ms) and a long release tail
//   - mix of triangle + sine waves — never a saw, which is the chiptune signature
// Combined with the reverb send on fxBus, a chord built this way sounds like a
// pad patch on a real synth instead of an arcade jingle.
function playPadChord(c, dest, start, freqs, dur, peak = 0.14) {
    for (const freq of freqs) {
        // Triangle voice + detuned sine twin per chord tone. Two oscillators
        // beating against each other is what creates the "alive" texture.
        spawnPadVoice(c, dest, start, freq, dur, peak * 0.7, "triangle", 0);
        spawnPadVoice(c, dest, start, freq, dur, peak * 0.5, "sine", 6);
    }
}

// Vox-like sustained vowel — the unique mythic timbre. Built by running a
// detuned saw pair through three parallel bandpass filters tuned to the formant
// frequencies of an "ah" vowel (~730/1090/2440 Hz). Subtle vibrato via LFO on
// detune. With reverb, this evokes a distant choir without sounding sampled.
function playVox(c, dest, start, freq, dur, peak = 0.18) {
    const oscA = c.createOscillator();
    const oscB = c.createOscillator();
    oscA.type = "sawtooth";
    oscB.type = "sawtooth";
    oscA.frequency.value = freq;
    oscB.frequency.value = freq;
    oscA.detune.value = -7;
    oscB.detune.value = 7;

    // Vibrato — slow, narrow pitch wobble.
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 5.2;
    lfoGain.gain.value = 8; // ~8 cents depth
    lfo.connect(lfoGain);
    lfoGain.connect(oscA.detune);
    lfoGain.connect(oscB.detune);

    // Mix saws together, then split into three formant bandpass branches and
    // sum back at `out`. The Q values are high enough to ring like vocal cavity
    // resonances without becoming whistly.
    const preFormant = c.createGain();
    preFormant.gain.value = 0.45;
    oscA.connect(preFormant);
    oscB.connect(preFormant);

    const formants = [
        { freq: 730, gain: 1.0, q: 7 },
        { freq: 1090, gain: 0.7, q: 8 },
        { freq: 2440, gain: 0.4, q: 9 },
    ];
    const out = c.createGain();
    for (const f of formants) {
        const filter = c.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = f.freq;
        filter.Q.value = f.q;
        const bandGain = c.createGain();
        bandGain.gain.value = f.gain;
        preFormant.connect(filter);
        filter.connect(bandGain);
        bandGain.connect(out);
    }
    out.connect(dest);

    // Slow vowel swell + long tail. Vowels don't snap on, they bloom.
    envelope(out, c, start, 0.18, dur * 0.2, 0.7, dur * 0.7, peak);

    oscA.start(start);
    oscB.start(start);
    lfo.start(start);
    const stopAt = start + dur + 0.2;
    oscA.stop(stopAt);
    oscB.stop(stopAt);
    lfo.stop(stopAt);
}

function spawnPadVoice(c, dest, start, freq, dur, peak, type, detuneCents) {
    const osc = c.createOscillator();
    const filter = c.createBiquadFilter();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detuneCents;
    // Filter starts dark and opens through the attack — gives the chord a
    // slow "blooming" feel instead of arriving fully-formed.
    filter.type = "lowpass";
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(freq * 2.2, start);
    filter.frequency.exponentialRampToValueAtTime(freq * 5.5, start + 0.6);
    osc.connect(filter);
    filter.connect(g);
    g.connect(dest);
    // Slow attack + long release. Linear ramps are fine here because the
    // filter sweep is doing the timbral shaping.
    envelope(g, c, start, 0.12, dur * 0.25, 0.55, dur * 0.85, peak);
    osc.start(start);
    osc.stop(start + dur + 0.15);
}
