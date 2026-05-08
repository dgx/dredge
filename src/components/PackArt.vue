<template>
    <div
        class="pack-art"
        :class="{
            ripping: ripping,
            snapping: snapping,
            opened: opened,
            'has-photo': !!packImageUrl,
            'photo-loading': photoLoading,
        }"
    >
        <div class="pack-foil" />
        <img
            v-if="packImageUrl"
            :src="packImageUrl"
            :alt="`${setName || setCode} booster pack`"
            class="pack-photo"
            draggable="false"
        />
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
import { ref, computed, watch, onUnmounted } from "vue";
import { loadPackImage, getCachedPackImageSync } from "../services/packImage.js";

// Deliberately tier-blind. The pack art is the same regardless of what's
// inside — anything else spoils the contents before the user opens.
const props = defineProps({
    setCode: { type: String, required: true },
    setName: { type: String, default: "" },
    boosterType: { type: String, default: "draft" },
    ripping: { type: Boolean, default: false },
    snapping: { type: Boolean, default: false },
    opened: { type: Boolean, default: false },
});

const symbolFailed = ref(false);
const packImageUrl = ref(null);
// True between "we don't have a synchronous photo" and "the async load
// resolved". While loading, we suppress the symbol/banner CSS overlays so
// they don't flash for a frame before the photo paints over them.
const photoLoading = ref(false);

let activeAbort = null;

function loadFor(setCode, boosterType) {
    if (activeAbort) activeAbort.abort();
    if (!setCode) {
        packImageUrl.value = null;
        photoLoading.value = false;
        return;
    }
    const cached = getCachedPackImageSync(setCode, boosterType);
    packImageUrl.value = cached;
    // If we already had it in memory, skip the loading state entirely.
    photoLoading.value = !cached;
    const ac = new AbortController();
    activeAbort = ac;
    loadPackImage(setCode, boosterType, ac.signal)
        .then((url) => {
            // Drop the result if the props changed mid-flight.
            if (ac.signal.aborted) return;
            packImageUrl.value = url || null;
            photoLoading.value = false;
        })
        .catch(() => {
            if (ac.signal.aborted) return;
            packImageUrl.value = null;
            photoLoading.value = false;
        });
}

watch(
    () => [props.setCode, props.boosterType],
    ([code, type]) => loadFor(code, type),
    { immediate: true }
);

onUnmounted(() => {
    if (activeAbort) activeAbort.abort();
});

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

/* Real pack box-art layered over the gold gradient. When loaded, its z-index
 * sits above the foil but below the shimmer + flash, so the rip animation
 * still flashes white over it.
 *
 * The photo is self-labeling (set name + booster type are baked into the
 * artwork), so we hide the symbol/banner overlays when it's present — see
 * `.pack-art.has-photo` rules below. */
.pack-photo {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 1;
    opacity: 0;
    animation: pack-photo-in 0.35s ease-out forwards;
    pointer-events: none;
    user-select: none;
}

@keyframes pack-photo-in {
    from { opacity: 0; }
    to { opacity: 1; }
}

.pack-art.has-photo .pack-symbol-wrap,
.pack-art.has-photo .pack-banner-top,
.pack-art.has-photo .pack-banner-bottom,
.pack-art.has-photo .pack-rip-line {
    display: none;
}

.pack-art.has-photo .pack-foil {
    opacity: 0.35;
    mix-blend-mode: overlay;
}

/* While the photo is loading we don't yet know whether it will resolve to a
 * real image or null, so suppress the symbol/banner overlays. If it resolves,
 * the photo paints in their place; if it doesn't, they fade in (see below).
 *
 * The result is no flash of "wrong" art: either the photo or the CSS art
 * appears, never both in sequence. */
.pack-art.photo-loading .pack-symbol-wrap,
.pack-art.photo-loading .pack-banner-top,
.pack-art.photo-loading .pack-banner-bottom,
.pack-art.photo-loading .pack-rip-line {
    opacity: 0;
}

/* Fade the CSS overlays in once we know there's no photo. */
.pack-art:not(.photo-loading):not(.has-photo) .pack-symbol-wrap,
.pack-art:not(.photo-loading):not(.has-photo) .pack-banner-top,
.pack-art:not(.photo-loading):not(.has-photo) .pack-banner-bottom,
.pack-art:not(.photo-loading):not(.has-photo) .pack-rip-line {
    animation: pack-art-fade-in 0.25s ease-out;
}

@keyframes pack-art-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
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
    z-index: 2;
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

/* Ripping: continuous rumble synced to the crinkle audio. Loops as long as
   the .ripping class is applied (i.e. through the entire rip sample). */
.pack-art.ripping {
    animation: rumble 0.18s linear infinite;
}

@keyframes rumble {
    0%, 100% { transform: translate(0, 0) rotate(0); }
    25% { transform: translate(-2px, 0.5px) rotate(-0.4deg); }
    50% { transform: translate(2.5px, -0.7px) rotate(0.5deg); }
    75% { transform: translate(-1.5px, 0.3px) rotate(-0.3deg); }
}

/* Snapping: sharp punch + flash + crack timed to the tear-snap audio. One
   shot, ~250ms — the moment of impact. */
.pack-art.snapping {
    animation: snap-punch 0.28s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
}

.pack-art.snapping .pack-flash {
    animation: flash 0.28s ease-out forwards;
}

.pack-art.snapping .pack-rip-line {
    animation: rip-line 0.28s ease-out forwards;
}

@keyframes snap-punch {
    0%   { transform: scale(1) rotate(0); filter: brightness(1); }
    20%  { transform: scale(1.08) rotate(-1.5deg); filter: brightness(1.6); }
    60%  { transform: scale(0.98) rotate(0.5deg); filter: brightness(1.1); }
    100% { transform: scale(1) rotate(0); filter: brightness(1); }
}

@keyframes flash {
    0% { opacity: 0; }
    20% { opacity: 1; }
    100% { opacity: 0; }
}

@keyframes rip-line {
    0% { transform: scaleY(1); opacity: 0.5; }
    50% { transform: scaleY(10); opacity: 1; }
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
