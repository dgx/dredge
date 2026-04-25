<template>
    <aside class="deck-summary" :class="{ collapsed: !cards.showSidebar }">
        <v-btn
            class="deck-summary-toggle"
            variant="tonal"
            size="x-small"
            :icon="cards.showSidebar ? 'mdi-chevron-right' : 'mdi-chevron-left'"
            :title="cards.showSidebar ? 'Hide summary' : 'Show summary'"
            @click="cards.showSidebar = !cards.showSidebar"
        />

        <div v-if="cards.showSidebar" class="deck-summary-body">
            <div class="deck-count-block">
                <v-btn
                    class="deck-clear-btn"
                    prepend-icon="mdi-trash-can-outline"
                    size="small"
                    variant="text"
                    color="error"
                    :disabled="cards.deckTotal === 0"
                    @click="confirmClear"
                >
                    Clear
                </v-btn>
                <div class="deck-count-value" :class="countClass">
                    {{ cards.deckTotal }} <span class="deck-count-target">/ 40</span>
                </div>
            </div>

            <div v-if="typeKeys.length" class="summary-section">
                <h3>Card Types</h3>
                <div class="curve-bars">
                    <div
                        v-for="key in typeKeys"
                        :key="key"
                        class="curve-row curve-row--type"
                    >
                        <ManaPip kind="type" :value="key" :size="22" />
                        <span class="curve-type-label">{{ key }}</span>
                        <div class="curve-bar">
                            <div
                                v-for="seg in segments(cards.typeCurve[key], typeMax)"
                                :key="seg.key"
                                class="curve-bar-seg"
                                :title="`${seg.label}: ${seg.count}`"
                                :style="{ width: seg.pct + '%', background: seg.color }"
                            />
                        </div>
                        <span class="curve-value">{{ cards.typeCurve[key].count }}</span>
                    </div>
                </div>
            </div>

            <div class="summary-section">
                <h3>Mana Curve</h3>
                <div class="curve-bars">
                    <div
                        v-for="(bucket, key) in cards.manaCurve"
                        :key="key"
                        class="curve-row"
                    >
                        <v-avatar
                            class="curve-pip"
                            size="22"
                            color="#beb9b2"
                        >
                            <span>{{ key }}</span>
                        </v-avatar>
                        <div class="curve-bar">
                            <div
                                v-for="seg in segments(bucket, curveMax)"
                                :key="seg.key"
                                class="curve-bar-seg"
                                :title="`${seg.label}: ${seg.count}`"
                                :style="{ width: seg.pct + '%', background: seg.color }"
                            />
                        </div>
                        <span class="curve-value">{{ bucket.count }}</span>
                    </div>
                </div>
            </div>

            <div class="summary-section">
                <h3>Basic Lands</h3>
                <div class="land-counters">
                    <div
                        v-for="code in cards.BASIC_COLORS"
                        :key="code"
                        class="land-row"
                    >
                        <ManaPip kind="color" :value="code" :size="24" />
                        <span class="land-name">{{ cards.BASIC_LAND_NAMES[code] }}</span>
                        <v-btn
                            icon="mdi-minus"
                            size="x-small"
                            variant="tonal"
                            :disabled="!cards.basicLands[code]"
                            @click="cards.adjustBasicLand(code, -1)"
                        />
                        <span class="land-count">{{ cards.basicLands[code] }}</span>
                        <v-btn
                            icon="mdi-plus"
                            size="x-small"
                            variant="tonal"
                            @click="cards.adjustBasicLand(code, 1)"
                        />
                    </div>
                </div>
            </div>

            <div class="summary-actions">
                <v-btn
                    class="copy-deck-btn"
                    color="primary"
                    variant="flat"
                    size="large"
                    block
                    :prepend-icon="copied ? 'mdi-check' : 'mdi-content-copy'"
                    :disabled="cards.deckTotal === 0"
                    @click="copyDeck"
                >
                    {{ copied ? "Copied!" : "Copy Deck" }}
                </v-btn>
            </div>
        </div>
    </aside>
</template>

<script setup>
import { computed, ref } from "vue";
import { useCardStore } from "../stores/cards";
import { exportDeck } from "../services/deckExporter";
import ManaPip from "./ManaPip.vue";

const cards = useCardStore();

const countClass = computed(() => {
    if (cards.deckTotal === 40) return "count-good";
    if (cards.deckTotal > 40) return "count-over";
    return "count-under";
});

const curveMax = computed(() => {
    let max = 0;
    for (const b of Object.values(cards.manaCurve)) {
        if (b.count > max) max = b.count;
    }
    return max;
});

const typeKeys = computed(() =>
    Object.keys(cards.typeCurve).filter((k) => cards.typeCurve[k].count > 0)
);

const typeMax = computed(() => {
    let max = 0;
    for (const b of Object.values(cards.typeCurve)) {
        if (b.count > max) max = b.count;
    }
    return max;
});

const COLOR_BG = {
    W: "#f0f2c0",
    U: "#b5cde3",
    B: "#4a443d",
    R: "#db8664",
    G: "#93b483",
    C: "#beb9b2",
    multi: "#d8b75a",
};

const COLOR_LABEL = {
    W: "White",
    U: "Blue",
    B: "Black",
    R: "Red",
    G: "Green",
    C: "Colorless",
    multi: "Multicolor",
};

function segments(bucket, max) {
    if (!max || !bucket || bucket.count === 0) return [];
    const entries = Object.entries(bucket.colors)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1]);
    return entries.map(([key, n]) => ({
        key,
        count: n,
        label: COLOR_LABEL[key],
        color: COLOR_BG[key],
        pct: (n / max) * 100,
    }));
}

function confirmClear() {
    if (cards.deckTotal === 0) return;
    if (confirm("Clear the current deck and reset basic lands?")) {
        cards.clearDeck();
    }
}

const copied = ref(false);
let copyResetTimer = null;

async function copyDeck() {
    const text = exportDeck({
        poolStacks: cards.poolStacks,
        basicLands: cards.basicLands,
        basicLandNames: cards.BASIC_LAND_NAMES,
    });
    try {
        await navigator.clipboard.writeText(text);
        copied.value = true;
        clearTimeout(copyResetTimer);
        copyResetTimer = setTimeout(() => {
            copied.value = false;
        }, 1500);
    } catch (err) {
        console.error("Clipboard write failed:", err);
        alert("Could not copy to clipboard.");
    }
}
</script>
