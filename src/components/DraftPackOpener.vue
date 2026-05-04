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

        <div class="opener-stage" :class="{ 'has-revealed': stage !== 'closed' }">
            <transition name="pack-fade" mode="out-in">
                <div v-if="stage !== 'revealed'" key="closed" class="pack-area">
                    <PackArt
                        :set-code="setCode"
                        :set-name="setName"
                        :booster-type="boosterType"
                        :ripping="stage === 'ripping'"
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
                            :delay="i * 90"
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
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useDraftStore } from "../stores/draft";
import { useCardStore } from "../stores/cards";
import PackArt from "./PackArt.vue";
import DraftRevealCard from "./DraftRevealCard.vue";
import { playRip, playCardReveal, playFlourish, setMuted, unlockAudio } from "../services/packAudio";

const draft = useDraftStore();
const cards = useCardStore();

// Stage progression for a single pack:
//   "closed" → user clicks → "ripping" → "revealed" (cards visible) → user advances → next pack ("closed").
const stage = ref("closed");
const symbolFailed = ref(false);
let revealTimer = null;
let cardTickTimers = [];
let flourishTimer = null;

const currentPack = computed(() => draft.currentPack);

const setCode = computed(() => currentPack.value?.setCode || "");
const setName = computed(() => {
    const code = setCode.value;
    const opt = draft.setOptions.find((s) => s.code === code);
    return opt?.name || "";
});
const boosterType = computed(() => currentPack.value?.simResult?.boosterType || "draft");
const tier = computed(() => currentPack.value?.simResult?.rarestTier || "common");

// Which (if any) flourish tier to play. The pack-rip + per-card clicks fire on
// every reveal; this only governs the end-of-reveal payoff sound.
//
// The rationale: Modern Play Boosters always roll a card in the rare-or-mythic
// slot (e.g. SPM's rareMythicBoosterfun), so 1 rare is the floor and nothing
// special. The actually exciting outcomes are:
//   • bonus-sheet hit (Special Guest / sourceMaterial)
//   • any mythic
//   • TWO rares (the wildcard/foil slot rolled a second rare on top of the
//     guaranteed rare slot — happens ~35% of the time on SPM)
// Anything below that — single rare, all commons/uncommons — ends silently.
const flourishTier = computed(() => {
    const sim = currentPack.value?.simResult;
    if (!sim) return null;
    if (sim.hasBonusSheet) return "bonus";

    let mythics = 0;
    let rares = 0;
    for (const c of sim.cards || []) {
        if (c.isBonusSheet) continue;
        if (c.rarity === "mythic") mythics++;
        else if (c.rarity === "rare") rares++;
    }
    if (mythics > 0) return "mythic";
    if (rares >= 2) return "rare";
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
    }
);

watch(
    () => draft.muted,
    (m) => setMuted(m)
);

const showParticles = computed(
    () => stage.value === "revealed" && (tier.value === "rare" || tier.value === "mythic" || tier.value === "bonus")
);

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
    playRip();
    revealTimer = setTimeout(() => {
        // Build resolved cards now (right when the pack visually pops open).
        resolvedCards.value = draft.resolveCurrentPack();
        stage.value = "revealed";

        // Stagger the card-flip click sounds to match the visual flips.
        cardTickTimers = resolvedCards.value.map((_, i) =>
            setTimeout(() => playCardReveal(), 220 + i * 90)
        );

        // Final flourish keyed to flourishTier (see computed above for the
        // policy). null = silent; rare/mythic/bonus map to the matching
        // playFlourish branch.
        const fTier = flourishTier.value;
        if (fTier) {
            const flourishDelay = 220 + resolvedCards.value.length * 90 + 120;
            flourishTimer = setTimeout(() => playFlourish(fTier), flourishDelay);
        }
    }, 460);
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

function clearAllTimers() {
    clearTimeout(revealTimer);
    clearTimeout(flourishTimer);
    for (const t of cardTickTimers) clearTimeout(t);
    cardTickTimers = [];
    revealTimer = null;
    flourishTimer = null;
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
    gap: 8px;
    color: var(--text-muted, rgba(255, 255, 255, 0.7));
    font-size: 13px;
}

.set-symbol {
    width: 18px;
    height: 18px;
    object-fit: contain;
    filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.6));
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

.opener-stage.has-revealed::before {
    opacity: 1;
}

.draft-opener[data-tier="rare"] .opener-stage.has-revealed::before {
    background: radial-gradient(circle at center, rgba(255, 215, 120, 0.18), transparent 60%);
}

.draft-opener[data-tier="mythic"] .opener-stage.has-revealed::before {
    background: radial-gradient(circle at center, rgba(255, 120, 40, 0.28), transparent 60%);
    animation: pulse-mythic 2.4s ease-in-out infinite;
}

.draft-opener[data-tier="bonus"] .opener-stage.has-revealed::before {
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
