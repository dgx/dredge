<template>
    <div class="draft-opener" :data-tier="tier">
        <div class="draft-opener-header">
            <div class="header-left">
                <span class="pack-progress">
                    Pack {{ packNumber }} / {{ totalPacks }}
                </span>
                <span class="pack-source">
                    <img
                        v-if="!symbolFailed"
                        :src="symbolUrl"
                        :alt="setCode"
                        class="set-symbol"
                        @error="symbolFailed = true"
                    />
                    {{ setName || setCode }}
                </span>
            </div>
            <div class="header-right">
                <v-btn
                    size="small"
                    variant="text"
                    @click="toggleMute"
                    :prepend-icon="draft.muted ? 'mdi-volume-off' : 'mdi-volume-high'"
                >
                    {{ draft.muted ? "Sound off" : "Sound on" }}
                </v-btn>
                <v-btn
                    size="small"
                    variant="text"
                    @click="onCancel"
                    prepend-icon="mdi-close"
                >
                    Cancel
                </v-btn>
            </div>
        </div>

        <div class="opener-stage" :class="{ 'has-climaxed': climaxed }">
            <transition name="pack-fade" mode="out-in">
                <div v-if="stage !== 'revealed'" key="closed" class="pack-area">
                    <PackArt
                        :set-code="setCode"
                        :set-name="setName"
                        :booster-type="boosterType"
                        :ripping="stage === 'ripping'"
                        :snapping="stage === 'snapping'"
                        :opened="false"
                        @click="onPackClick"
                    />
                    <div v-if="stage === 'closed'" class="pack-instruction">
                        Click the pack to open
                    </div>
                </div>

                <div v-else key="revealed" class="reveal-area">
                    <div class="reveal-particles" v-if="showParticles" :data-tier="tier">
                        <span v-for="n in particleCount" :key="n" class="particle" :style="particleStyle(n)" />
                    </div>

                    <div class="reveal-row">
                        <DraftRevealCard
                            v-for="(card, i) in resolvedCards"
                            :key="card.poolId"
                            :card="card"
                            :delay="i * 60"
                            :flipped="flippedStates[i]"
                            :climax="hasClimax && i === resolvedCards.length - 1"
                            @click="onCardClick(card)"
                        />
                    </div>

                    <div class="reveal-actions">
                        <v-btn
                            color="primary"
                            variant="flat"
                            size="large"
                            @click="onAdvance"
                            :prepend-icon="isLastPack ? 'mdi-check' : 'mdi-arrow-right'"
                        >
                            {{ isLastPack ? "Finish" : "Open Next Pack" }}
                        </v-btn>
                    </div>
                </div>
            </transition>
            <div v-if="flashing" class="screen-flash" />
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useDraftStore } from "../stores/draft";
import { useCardStore } from "../stores/cards";
import PackArt from "./PackArt.vue";
import DraftRevealCard from "./DraftRevealCard.vue";
import { playRip, playTear, playCardReveal, playFlourish, setMuted, unlockAudio } from "../services/packAudio";

const draft = useDraftStore();
const cards = useCardStore();

// Stage progression for a single pack:
//   "closed" → user clicks → "ripping" → "snapping" → "revealed" (cards visible) → user advances → next pack ("closed").
const stage = ref("closed");
// Separate from `stage` because the screen-flash animation (~550ms) outlasts
// the snapping stage (~200ms tear duration) — we don't want the flash element
// torn down mid-animation when cards reveal.
const flashing = ref(false);
const symbolFailed = ref(false);
// Per-card flip state, parent-driven so audio + flourish + tier visuals stay
// locked to actual flip moments instead of independent self-timers.
const flippedStates = ref([]);
// Flips to true at the moment the climax card flips. Gates the tier-colored
// ambient backdrop, the particle burst, and (via flourishTier) the audio
// flourish — so rarity is only revealed at the climax beat.
const climaxed = ref(false);
let revealTimer = null;
let flipTimers = [];
let flashTimer = null;

const currentPack = computed(() => draft.currentPack);

const setCode = computed(() => currentPack.value?.setCode || "");
const setName = computed(() => {
    const code = setCode.value;
    const opt = draft.setOptions.find((s) => s.code === code);
    return opt?.name || "";
});
const boosterType = computed(() => currentPack.value?.simResult?.boosterType || "draft");
const tier = computed(() => currentPack.value?.simResult?.rarestTier || "common");

// End-of-reveal flourish tier. Picks the rarest thing in the pack:
//   bonus-sheet hit (Special Guest / sourceMaterial) → masterpiece
//   any mythic                                       → mythic
//   otherwise                                        → silent (no flourish)
const flourishTier = computed(() => {
    const sim = currentPack.value?.simResult;
    if (!sim) return null;
    if (sim.hasBonusSheet) return "masterpiece";
    for (const c of sim.cards || []) {
        if (c.isBonusSheet) continue;
        if (c.rarity === "mythic") return "mythic";
    }
    return null;
});

const symbolUrl = computed(() =>
    setCode.value
        ? `https://svgs.scryfall.io/sets/${setCode.value.toLowerCase()}.svg`
        : ""
);

const packNumber = computed(() => draft.currentPackIndex + 1);
const totalPacks = computed(() => draft.packQueue.length);
const isLastPack = computed(() => draft.currentPackIndex >= draft.packQueue.length - 1);

const resolvedCards = ref([]);

watch(
    () => draft.currentPack,
    (pack) => {
        // New pack just slid in — reset to closed.
        if (!pack) return;
        stage.value = "closed";
        symbolFailed.value = false;
        resolvedCards.value = [];
        flippedStates.value = [];
        climaxed.value = false;
    }
);

watch(
    () => draft.muted,
    (m) => setMuted(m)
);

// Whether this pack earns a climax beat (colored backdrop, particles, slower
// final flip, possibly a flourish). Common-only / uncommon-only packs flip
// uniformly with no climax treatment.
const hasClimax = computed(
    () => tier.value === "rare" || tier.value === "mythic" || tier.value === "bonus"
);

const showParticles = computed(() => climaxed.value && hasClimax.value);

const particleCount = computed(() => {
    switch (tier.value) {
        case "mythic": return 36;
        case "bonus": return 32;
        case "rare": return 18;
        default: return 0;
    }
});

function particleStyle(n) {
    // Deterministic-ish scattering using the index.
    const angle = (n * 47) % 360;
    const dist = 30 + ((n * 13) % 60);
    const dx = Math.cos((angle * Math.PI) / 180) * dist;
    const dy = Math.sin((angle * Math.PI) / 180) * dist;
    const delay = (n * 23) % 600;
    const dur = 1400 + ((n * 7) % 800);
    return {
        "--dx": `${dx}vw`,
        "--dy": `${dy}vh`,
        "animationDelay": `${delay}ms`,
        "animationDuration": `${dur}ms`,
    };
}

async function onPackClick() {
    if (stage.value !== "closed") return;
    await unlockAudio();
    stage.value = "ripping";
    // Chain: crinkle (rip) → snap (tear) → reveal cards. Fall back to a
    // visual-only delay if audio is unavailable.
    const ripMs = playRip();
    // Small gap between crinkle and snap so the tear reads as a separate
    // decisive moment instead of running continuously off the rip's tail.
    const TEAR_GAP_MS = 50;
    const tearStart = (ripMs > 0 ? ripMs : 460) + TEAR_GAP_MS;
    revealTimer = setTimeout(() => {
        stage.value = "snapping";
        flashing.value = true;
        flashTimer = setTimeout(() => { flashing.value = false; }, 600);
        const tearMs = playTear();
        const revealAfter = tearMs > 0 ? tearMs : 200;
        revealTimer = setTimeout(() => {
            // Build resolved cards now (right when the pack visually pops open).
            resolvedCards.value = draft.resolveCurrentPack();
            flippedStates.value = resolvedCards.value.map(() => false);
            stage.value = "revealed";

            // Per-card flip timeline. Each card flips on schedule, plays a
            // soft click, and (if it's the climax card) triggers the climax
            // beat: tier-colored backdrop, particles, audio flourish — all
            // locked to this single moment so audio and visual peaks coincide.
            const FLIP_GAP = 90;        // gap between non-climax flips
            const CLIMAX_LEAD_IN = 220; // delay before the first flip
            const CLIMAX_HOLD = 450;    // extra pause before the headline card
            const lastIdx = resolvedCards.value.length - 1;
            const climaxOnLast = hasClimax.value;

            flipTimers = resolvedCards.value.map((_, i) => {
                const isClimaxCard = climaxOnLast && i === lastIdx;
                const baseDelay = CLIMAX_LEAD_IN + i * FLIP_GAP;
                const delay = isClimaxCard ? baseDelay + CLIMAX_HOLD : baseDelay;
                return setTimeout(() => {
                    flippedStates.value[i] = true;
                    playCardReveal();
                    if (isClimaxCard) onClimax();
                }, delay);
            });
        }, revealAfter);
    }, tearStart);
}

function onAdvance() {
    clearAllTimers();
    draft.commitCurrentPack();
    if (draft.phase === "finished") {
        draft.exitToDeckBuilder();
    }
    // Otherwise the watcher above will reset to "closed" on the new pack.
}

function onCancel() {
    clearAllTimers();
    // Commit the cards already revealed (fair to keep what the user saw).
    if (stage.value === "revealed") {
        draft.commitCurrentPack();
    }
    draft.finishDraft();
    draft.exitToDeckBuilder();
}

function onCardClick(card) {
    cards.selectCard(card);
}

function toggleMute() {
    draft.muted = !draft.muted;
}

// Fires the moment the climax card flips. Audio flourish, particles, and the
// tier-colored ambient backdrop all key off this single beat.
function onClimax() {
    climaxed.value = true;
    const fTier = flourishTier.value;
    if (fTier) playFlourish(fTier);
}

function clearAllTimers() {
    clearTimeout(revealTimer);
    clearTimeout(flashTimer);
    for (const t of flipTimers) clearTimeout(t);
    flipTimers = [];
    revealTimer = null;
    flashTimer = null;
    flashing.value = false;
}

onMounted(() => {
    setMuted(draft.muted);
});

onUnmounted(() => {
    clearAllTimers();
});
</script>

<style scoped>
.draft-opener {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding: 16px 24px 24px;
    gap: 12px;
    position: relative;
    overflow: hidden;
}

.draft-opener-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-shrink: 0;
}

.header-left,
.header-right {
    display: flex;
    align-items: center;
    gap: 12px;
}

.pack-progress {
    font-family: var(--font-display, serif);
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: rgba(255, 215, 120, 0.85);
}

.pack-source {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: rgba(255, 255, 255, 0.92);
    font-size: 16px;
    font-weight: 500;
    letter-spacing: 0.02em;
}

.set-symbol {
    width: 22px;
    height: 22px;
    object-fit: contain;
    /* Scryfall ships set symbols as black SVGs. On the dark theme they vanish,
       so invert to white and add a faint glow for legibility. */
    filter: invert(1) brightness(1.1) drop-shadow(0 0 2px rgba(0, 0, 0, 0.7));
}

.opener-stage {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}

.pack-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
}

/* Snap-moment screen blast. Two stacked layers via ::before/::after:
     ::before — full-viewport white wash that punches in hard and fades
     ::after  — expanding ring/burst radiating from the pack
   Fixed-position so it covers the entire window, not just the stage. */
.screen-flash {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1000;
}

.screen-flash::before {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center,
        rgba(255, 255, 255, 1) 0%,
        rgba(255, 245, 220, 0.9) 25%,
        rgba(255, 230, 180, 0.4) 55%,
        rgba(255, 200, 120, 0) 100%);
    animation: screen-flash-wash 0.45s ease-out forwards;
}

.screen-flash::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 40vmin;
    height: 40vmin;
    margin-left: -20vmin;
    margin-top: -20vmin;
    border-radius: 50%;
    background: radial-gradient(circle,
        rgba(255, 255, 255, 0.9) 0%,
        rgba(255, 240, 200, 0.5) 40%,
        rgba(255, 200, 100, 0) 70%);
    animation: screen-flash-burst 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes screen-flash-wash {
    0%   { opacity: 0; }
    8%   { opacity: 1; }
    35%  { opacity: 0.7; }
    100% { opacity: 0; }
}

@keyframes screen-flash-burst {
    0%   { transform: scale(0.2); opacity: 0; }
    15%  { transform: scale(0.6); opacity: 1; }
    100% { transform: scale(6); opacity: 0; }
}

.pack-instruction {
    color: var(--text-muted, rgba(255, 255, 255, 0.55));
    font-size: 13px;
    letter-spacing: 0.04em;
}

.reveal-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    width: 100%;
}

.reveal-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px;
    max-width: 1280px;
}

.reveal-actions {
    margin-top: 10px;
}

.pack-fade-enter-active,
.pack-fade-leave-active {
    transition: opacity 0.3s ease, transform 0.3s ease;
}

.pack-fade-enter-from,
.pack-fade-leave-to {
    opacity: 0;
    transform: scale(0.96);
}

/* Tier ambient backdrop. The whole stage gets a colored radial glow that
   fades up only when the cards are revealed and a high tier was rolled. */
.opener-stage::before {
    content: "";
    position: absolute;
    inset: -10%;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.6s ease;
    background: radial-gradient(circle at center, transparent 30%, transparent 60%);
}

.opener-stage.has-climaxed::before {
    opacity: 1;
}

.draft-opener[data-tier="rare"] .opener-stage.has-climaxed::before {
    background: radial-gradient(circle at center, rgba(255, 215, 120, 0.18), transparent 60%);
}

.draft-opener[data-tier="mythic"] .opener-stage.has-climaxed::before {
    background: radial-gradient(circle at center, rgba(255, 120, 40, 0.28), transparent 60%);
    animation: pulse-mythic 2.4s ease-in-out infinite;
}

.draft-opener[data-tier="bonus"] .opener-stage.has-climaxed::before {
    background:
        radial-gradient(circle at 30% 40%, rgba(255, 120, 200, 0.28), transparent 50%),
        radial-gradient(circle at 70% 60%, rgba(120, 220, 255, 0.28), transparent 50%);
    animation: pulse-bonus 3s ease-in-out infinite;
}

@keyframes pulse-mythic {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
}

@keyframes pulse-bonus {
    0%, 100% { opacity: 1; transform: rotate(0); }
    50% { opacity: 0.7; transform: rotate(8deg); }
}

/* Particles fly outward from center on reveal. */
.reveal-particles {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 6;
    overflow: hidden;
}

.particle {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 215, 120, 0.95);
    box-shadow: 0 0 12px 2px rgba(255, 215, 120, 0.6);
    transform: translate(-50%, -50%) scale(0);
    animation-name: particle-fly;
    animation-fill-mode: forwards;
    animation-timing-function: ease-out;
}

.reveal-particles[data-tier="mythic"] .particle {
    background: rgba(255, 130, 50, 0.95);
    box-shadow: 0 0 14px 3px rgba(255, 100, 40, 0.7);
}

.reveal-particles[data-tier="bonus"] .particle:nth-child(3n) {
    background: rgba(255, 120, 200, 0.95);
    box-shadow: 0 0 14px 3px rgba(255, 120, 200, 0.6);
}

.reveal-particles[data-tier="bonus"] .particle:nth-child(3n+1) {
    background: rgba(120, 220, 255, 0.95);
    box-shadow: 0 0 14px 3px rgba(120, 220, 255, 0.6);
}

.reveal-particles[data-tier="bonus"] .particle:nth-child(3n+2) {
    background: rgba(180, 255, 140, 0.95);
    box-shadow: 0 0 14px 3px rgba(180, 255, 140, 0.6);
}

@keyframes particle-fly {
    0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0);
    }
    15% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
    }
    100% {
        opacity: 0;
        transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.4);
    }
}
</style>
