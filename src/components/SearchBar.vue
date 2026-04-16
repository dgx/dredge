<template>
    <div class="search-bar">
        <input
            type="text"
            class="search-input"
            v-model="cards.searchQuery"
            placeholder="Search cards by name or text..."
        />

        <div class="filter-group">
            <div class="color-filters">
                <button
                    v-for="color in colors"
                    :key="color.code"
                    class="color-btn"
                    :class="[`color-${color.code.toLowerCase()}`, { active: cards.colorFilter.includes(color.code) }]"
                    :title="color.label"
                    @click="toggleColor(color.code)"
                >
                    {{ color.symbol }}
                </button>
            </div>

            <select v-model="cards.typeFilter" class="filter-select">
                <option value="">All Types</option>
                <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
            </select>

            <select v-model="cards.rarityFilter" class="filter-select">
                <option value="">All Rarities</option>
                <option value="Common">Common</option>
                <option value="Uncommon">Uncommon</option>
                <option value="Rare">Rare</option>
                <option value="Mythic">Mythic</option>
            </select>

            <template v-if="cards.sealedMode">
                <select v-model="cards.groupBy" class="filter-select">
                    <option value="cmc">Group: CMC</option>
                    <option value="color">Group: Color</option>
                    <option value="type">Group: Type</option>
                    <option value="none">Group: None</option>
                </select>

                <div class="view-toggle">
                    <button
                        class="toggle-btn"
                        :class="{ active: cards.deckView === 'pool' }"
                        @click="cards.deckView = 'pool'"
                    >
                        Pool
                    </button>
                    <button
                        class="toggle-btn"
                        :class="{ active: cards.deckView === 'deck' }"
                        @click="cards.deckView = 'deck'"
                    >
                        Deck
                    </button>
                </div>
            </template>

            <select v-else v-model="cards.sortBy" class="filter-select">
                <option value="name">Sort: Name</option>
                <option value="cmc">Sort: Mana Cost</option>
                <option value="color">Sort: Color</option>
                <option value="type">Sort: Type</option>
            </select>

            <button class="btn btn-small" @click="cards.resetFilters()">Clear</button>
        </div>
    </div>
</template>

<script setup>
import { useCardStore } from "../stores/cards";

const cards = useCardStore();

const colors = [
    { code: "W", symbol: "W", label: "White" },
    { code: "U", symbol: "U", label: "Blue" },
    { code: "B", symbol: "B", label: "Black" },
    { code: "R", symbol: "R", label: "Red" },
    { code: "G", symbol: "G", label: "Green" },
    { code: "C", symbol: "C", label: "Colorless" },
];

const types = [
    "Creature",
    "Instant",
    "Sorcery",
    "Enchantment",
    "Artifact",
    "Planeswalker",
    "Land",
    "Battle",
];

function toggleColor(code) {
    const idx = cards.colorFilter.indexOf(code);
    if (idx >= 0) {
        cards.colorFilter.splice(idx, 1);
    } else {
        cards.colorFilter.push(code);
    }
}
</script>
