<template>
    <aside class="deck-summary" :class="{ collapsed: !cards.showSidebar }">
        <button
            class="deck-summary-toggle"
            @click="cards.showSidebar = !cards.showSidebar"
            :title="cards.showSidebar ? 'Hide summary' : 'Show summary'"
        >
            {{ cards.showSidebar ? "▶" : "◀" }}
        </button>

        <div v-if="cards.showSidebar" class="deck-summary-body">
            <div class="deck-count-block">
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
                        <span class="curve-label">{{ key }}</span>
                        <div class="curve-bar-track">
                            <div
                                class="curve-bar"
                                :style="{ width: barWidth(count) + '%' }"
                            ></div>
                        </div>
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
                        <span
                            class="land-pip"
                            :class="`color-${code.toLowerCase()}`"
                        >{{ code }}</span>
                        <span class="land-name">{{ cards.BASIC_LAND_NAMES[code] }}</span>
                        <button
                            class="land-btn"
                            :disabled="!cards.basicLands[code]"
                            @click="cards.adjustBasicLand(code, -1)"
                        >−</button>
                        <span class="land-count">{{ cards.basicLands[code] }}</span>
                        <button
                            class="land-btn"
                            @click="cards.adjustBasicLand(code, 1)"
                        >+</button>
                    </div>
                </div>
                <div class="land-total">
                    Basics: <strong>{{ cards.basicLandTotal }}</strong>
                </div>
            </div>

            <div class="summary-section">
                <button class="btn btn-small btn-danger" @click="confirmClear">
                    Clear Deck
                </button>
            </div>
        </div>
    </aside>
</template>

<script setup>
import { computed } from "vue";
import { useCardStore } from "../stores/cards";

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

function barWidth(count) {
    if (curveMax.value === 0) return 0;
    return (count / curveMax.value) * 100;
}

function confirmClear() {
    if (cards.deckTotal === 0) return;
    if (confirm("Clear the current deck and reset basic lands?")) {
        cards.clearDeck();
    }
}
</script>
