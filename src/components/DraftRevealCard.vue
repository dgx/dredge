<template>
    <div
        class="reveal-card"
        :class="{ flipped, foil: card.poolFoil, bonus: card.draftMeta?.isBonusSheet }"
        :data-rarity="card.rarity"
        :style="{ animationDelay: delay + 'ms' }"
        @click="$emit('click')"
    >
        <div class="reveal-card-inner">
            <div class="reveal-card-back">
                <div class="card-back-art" />
            </div>
            <div class="reveal-card-front">
                <img v-if="imageSrc" :src="imageSrc" :alt="card.name" class="card-image" />
                <div v-else class="card-image-fallback">
                    <div class="fallback-name">{{ card.name }}</div>
                    <div class="fallback-rarity">{{ card.rarity }}</div>
                </div>
                <div class="card-overlay-foil" v-if="card.poolFoil" />
                <div class="card-overlay-rainbow" v-if="card.draftMeta?.isBonusSheet" />
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { loadCardImage, getCachedSync } from "../services/imageLoader";

const props = defineProps({
    card: { type: Object, required: true },
    delay: { type: Number, default: 0 },
});

defineEmits(["click"]);

const flipped = ref(false);
const imageSrc = ref(getCachedSync(props.card));

let abortController = null;
let flipTimer = null;

onMounted(async () => {
    // Schedule the flip on the same staggered timeline as the CSS slide-in.
    // Total reveal duration = base 250ms entrance + per-card delay.
    flipTimer = setTimeout(() => {
        flipped.value = true;
    }, props.delay + 220);

    if (!imageSrc.value) {
        abortController = new AbortController();
        const result = await loadCardImage(props.card, abortController.signal);
        if (result) imageSrc.value = result;
    }
});

onUnmounted(() => {
    clearTimeout(flipTimer);
    abortController?.abort();
});
</script>

<style scoped>
.reveal-card {
    width: 160px;
    height: 224px;
    perspective: 1200px;
    cursor: pointer;
    opacity: 0;
    transform: translateY(20px);
    animation: card-enter 0.35s ease-out forwards;
    transition: transform 0.2s ease;
}

.reveal-card:hover {
    transform: translateY(-6px) scale(1.04);
    z-index: 5;
}

@keyframes card-enter {
    to { opacity: 1; transform: translateY(0); }
}

.reveal-card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform 0.55s cubic-bezier(0.34, 1.4, 0.64, 1);
}

.reveal-card.flipped .reveal-card-inner {
    transform: rotateY(180deg);
}

.reveal-card-back,
.reveal-card-front {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    border-radius: 9px;
    overflow: hidden;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);
}

.reveal-card-back {
    background:
        radial-gradient(circle at 50% 38%, rgba(255, 215, 120, 0.22), transparent 55%),
        linear-gradient(135deg, #1a1209 0%, #2d1d0e 50%, #1a1209 100%);
    border: 1px solid rgba(255, 215, 120, 0.18);
}

.card-back-art {
    position: absolute;
    inset: 14px;
    border-radius: 5px;
    border: 2px solid rgba(255, 215, 120, 0.18);
    background:
        radial-gradient(circle at center, rgba(255, 215, 120, 0.18), transparent 60%);
}

.reveal-card-front {
    transform: rotateY(180deg);
    background: #0a0a0a;
}

.card-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.card-image-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px;
    color: rgba(255, 255, 255, 0.85);
    background: linear-gradient(180deg, #2a2118 0%, #15110b 100%);
    text-align: center;
}

.fallback-name {
    font-weight: 700;
    margin-bottom: 6px;
}

.fallback-rarity {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    opacity: 0.6;
}

/* Foil overlay: animated holographic rainbow sheen. */
.card-overlay-foil {
    position: absolute;
    inset: 0;
    background: linear-gradient(
        110deg,
        transparent 30%,
        rgba(255, 0, 200, 0.18) 40%,
        rgba(0, 200, 255, 0.18) 50%,
        rgba(200, 255, 0, 0.18) 60%,
        transparent 70%
    );
    background-size: 250% 100%;
    animation: foil-sweep 3s infinite linear;
    mix-blend-mode: screen;
    pointer-events: none;
}

@keyframes foil-sweep {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
}

.card-overlay-rainbow {
    position: absolute;
    inset: 0;
    border-radius: 9px;
    box-shadow:
        inset 0 0 0 2px rgba(255, 255, 255, 0.4),
        inset 0 0 30px rgba(255, 120, 200, 0.4);
    pointer-events: none;
}

/* Rarity-driven glow on the front face. Rare and mythic get a tinted inset
   border ON TOP of the outer halo so the distinction is unmistakable even when
   the card art has lots of yellow/orange. */
.reveal-card[data-rarity="uncommon"] .reveal-card-front {
    box-shadow:
        0 6px 20px rgba(0, 0, 0, 0.55),
        0 0 12px rgba(180, 200, 220, 0.3);
}

.reveal-card[data-rarity="rare"] .reveal-card-front {
    box-shadow:
        inset 0 0 0 2px rgba(255, 215, 120, 0.95),
        inset 0 0 14px rgba(255, 215, 120, 0.55),
        0 6px 20px rgba(0, 0, 0, 0.55),
        0 0 22px rgba(255, 200, 90, 0.85),
        0 0 44px rgba(255, 180, 60, 0.5);
    animation: rare-pulse 2.4s ease-in-out infinite;
}

.reveal-card[data-rarity="mythic"] .reveal-card-front {
    box-shadow:
        inset 0 0 0 2px rgba(255, 110, 70, 0.98),
        inset 0 0 18px rgba(255, 80, 50, 0.6),
        0 6px 20px rgba(0, 0, 0, 0.55),
        0 0 26px rgba(255, 90, 50, 0.95),
        0 0 56px rgba(255, 60, 40, 0.6);
    animation: mythic-pulse 1.8s ease-in-out infinite;
}

.reveal-card.bonus .reveal-card-front {
    box-shadow:
        inset 0 0 0 2px rgba(255, 180, 230, 0.9),
        0 6px 20px rgba(0, 0, 0, 0.55),
        0 0 22px rgba(255, 120, 200, 0.7),
        0 0 40px rgba(120, 220, 255, 0.5);
}

@keyframes rare-pulse {
    0%, 100% {
        box-shadow:
            inset 0 0 0 2px rgba(255, 215, 120, 0.95),
            inset 0 0 14px rgba(255, 215, 120, 0.55),
            0 6px 20px rgba(0, 0, 0, 0.55),
            0 0 22px rgba(255, 200, 90, 0.85),
            0 0 44px rgba(255, 180, 60, 0.5);
    }
    50% {
        box-shadow:
            inset 0 0 0 2px rgba(255, 235, 160, 1),
            inset 0 0 18px rgba(255, 215, 120, 0.7),
            0 6px 20px rgba(0, 0, 0, 0.55),
            0 0 30px rgba(255, 215, 120, 1),
            0 0 60px rgba(255, 180, 60, 0.7);
    }
}

@keyframes mythic-pulse {
    0%, 100% {
        box-shadow:
            inset 0 0 0 2px rgba(255, 110, 70, 0.98),
            inset 0 0 18px rgba(255, 80, 50, 0.6),
            0 6px 20px rgba(0, 0, 0, 0.55),
            0 0 26px rgba(255, 90, 50, 0.95),
            0 0 56px rgba(255, 60, 40, 0.6);
    }
    50% {
        box-shadow:
            inset 0 0 0 2px rgba(255, 150, 100, 1),
            inset 0 0 22px rgba(255, 100, 60, 0.75),
            0 6px 20px rgba(0, 0, 0, 0.55),
            0 0 36px rgba(255, 110, 60, 1),
            0 0 76px rgba(255, 60, 30, 0.75);
    }
}
</style>
