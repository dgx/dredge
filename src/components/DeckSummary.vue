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
                <div class="deck-count-breakdown">
                    <span>{{ cards.deckCreatureCount }} creatures</span>
                    <span>•</span>
                    <span>{{ cards.deckNonCreatureNonLandCount }} other spells</span>
                    <span>•</span>
                    <span>{{ cards.deckLandCount }} lands</span>
                </div>
            </div>

            <div class="summary-section">
                <h3>Mana Curve</h3>
                <div class="curve-bars">
                    <div
                        v-for="(count, key) in cards.manaCurve"
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
                        <v-progress-linear
                            :model-value="barValue(count)"
                            color="primary"
                            bg-color="surface-variant"
                            height="14"
                            rounded
                        />
                        <span class="curve-value">{{ count }}</span>
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
    for (const v of Object.values(cards.manaCurve)) {
        if (v > max) max = v;
    }
    return max;
});

function barValue(count) {
    if (curveMax.value === 0) return 0;
    return (count / curveMax.value) * 100;
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
