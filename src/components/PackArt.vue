<template>
    <div class="pack-art" :class="{ ripping: ripping, opened: opened }">
        <div class="pack-foil" />
        <div class="pack-shimmer" />
        <div class="pack-banner-top">
            <span class="pack-set-name">{{ setName || setCode }}</span>
        </div>
        <div class="pack-symbol-wrap">
            <img
                v-if="!symbolFailed"
                :src="symbolUrl"
                :alt="setCode"
                class="pack-symbol"
                @error="symbolFailed = true"
            />
            <div v-else class="pack-symbol-fallback">{{ setCode }}</div>
        </div>
        <div class="pack-banner-bottom">
            <span class="pack-type-label">{{ typeLabel }}</span>
        </div>
        <div class="pack-rip-line" />
        <div class="pack-flash" />
    </div>
</template>

<script setup>
import { ref, computed } from "vue";

// Deliberately tier-blind. The pack art is the same regardless of what's
// inside — anything else spoils the contents before the user opens.
const props = defineProps({
    setCode: { type: String, required: true },
    setName: { type: String, default: "" },
    boosterType: { type: String, default: "draft" },
    ripping: { type: Boolean, default: false },
    opened: { type: Boolean, default: false },
});

const symbolFailed = ref(false);

const symbolUrl = computed(() =>
    props.setCode
        ? `https://svgs.scryfall.io/sets/${props.setCode.toLowerCase()}.svg`
        : ""
);

const typeLabel = computed(() => {
    const t = props.boosterType || "draft";
    return t.toUpperCase().replace(/[-_]/g, " ") + " BOOSTER";
});
</script>

<style scoped>
.pack-art {
    position: relative;
    width: 220px;
    height: 320px;
    border-radius: 12px;
    overflow: hidden;
    background:
        linear-gradient(135deg, #1c1410 0%, #2a1c12 30%, #3b2615 60%, #1c1410 100%);
    box-shadow:
        0 12px 32px rgba(0, 0, 0, 0.65),
        0 0 0 1px rgba(255, 215, 120, 0.18),
        inset 0 0 30px rgba(0, 0, 0, 0.4);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    user-select: none;
    flex-shrink: 0;
}

.pack-art:hover:not(.ripping):not(.opened) {
    transform: translateY(-4px);
    box-shadow:
        0 16px 40px rgba(0, 0, 0, 0.7),
        0 0 0 1px rgba(255, 215, 120, 0.32),
        inset 0 0 30px rgba(0, 0, 0, 0.4);
}

.pack-foil {
    position: absolute;
    inset: 0;
    background:
        radial-gradient(circle at 30% 25%, rgba(255, 215, 120, 0.22), transparent 45%),
        radial-gradient(circle at 70% 80%, rgba(120, 200, 255, 0.16), transparent 50%),
        linear-gradient(180deg, transparent 0%, rgba(255, 215, 120, 0.08) 50%, transparent 100%);
    pointer-events: none;
}

.pack-shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(
        110deg,
        transparent 35%,
        rgba(255, 255, 255, 0.18) 50%,
        transparent 65%
    );
    background-size: 250% 100%;
    background-position: 100% 0;
    animation: shimmer 4.5s infinite linear;
    pointer-events: none;
    mix-blend-mode: screen;
}

@keyframes shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
}

.pack-banner-top,
.pack-banner-bottom {
    position: absolute;
    left: 12px;
    right: 12px;
    text-align: center;
    z-index: 2;
}

.pack-banner-top {
    top: 14px;
}

.pack-banner-bottom {
    bottom: 14px;
}

.pack-set-name {
    display: inline-block;
    font-family: var(--font-display, serif);
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: linear-gradient(180deg, #fbe6a0 0%, #e8c668 50%, #b38a3a 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    text-shadow: 0 0 8px rgba(255, 215, 120, 0.15);
    line-height: 1.15;
    max-width: 100%;
    word-break: break-word;
}

.pack-type-label {
    display: inline-block;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.18em;
    color: rgba(255, 215, 120, 0.7);
    border-top: 1px solid rgba(255, 215, 120, 0.25);
    padding-top: 6px;
}

.pack-symbol-wrap {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
}

.pack-symbol {
    width: 110px;
    height: 110px;
    object-fit: contain;
    filter:
        drop-shadow(0 0 14px rgba(255, 215, 120, 0.45))
        drop-shadow(0 4px 8px rgba(0, 0, 0, 0.6));
    /* Many Scryfall SVGs are dark; force them light so they show on the pack. */
    opacity: 0.96;
}

.pack-symbol-fallback {
    font-family: var(--font-display, serif);
    font-size: 36px;
    font-weight: 900;
    letter-spacing: 0.05em;
    color: rgba(255, 215, 120, 0.85);
    text-shadow: 0 0 12px rgba(255, 215, 120, 0.5);
}

.pack-rip-line {
    position: absolute;
    top: 32px;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(
        90deg,
        transparent,
        rgba(255, 215, 120, 0.35) 12%,
        rgba(255, 215, 120, 0.35) 88%,
        transparent
    );
    opacity: 0.5;
    pointer-events: none;
}

.pack-flash {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at center, rgba(255, 240, 200, 0.95), rgba(255, 240, 200, 0) 60%);
    opacity: 0;
    pointer-events: none;
    z-index: 3;
}

/* Ripping animation: shake + flash + crack along the rip line. */
.pack-art.ripping {
    animation: shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

.pack-art.ripping .pack-flash {
    animation: flash 0.55s ease-out forwards;
}

.pack-art.ripping .pack-rip-line {
    animation: rip-line 0.45s ease-out forwards;
}

@keyframes shake {
    0%, 100% { transform: translate(0, 0) rotate(0); }
    15% { transform: translate(-4px, 1px) rotate(-1deg); }
    30% { transform: translate(5px, -1px) rotate(1.2deg); }
    45% { transform: translate(-3px, 2px) rotate(-0.8deg); }
    60% { transform: translate(4px, 0) rotate(1deg); }
    75% { transform: translate(-2px, -1px) rotate(-0.4deg); }
}

@keyframes flash {
    0% { opacity: 0; }
    25% { opacity: 1; }
    100% { opacity: 0; }
}

@keyframes rip-line {
    0% { transform: scaleY(1); opacity: 0.5; }
    50% { transform: scaleY(8); opacity: 1; }
    100% { transform: scaleY(1); opacity: 0; }
}

/* Opened: collapse / fade out to clear the stage. */
.pack-art.opened {
    animation: fold 0.5s ease-in forwards;
}

@keyframes fold {
    0% { transform: scale(1); opacity: 1; }
    100% { transform: scale(0.6) translateY(40px); opacity: 0; }
}

</style>
