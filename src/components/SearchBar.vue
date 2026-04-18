<template>
    <div class="search-bar">
        <v-text-field
            v-model="cards.searchQuery"
            placeholder="Search cards by name or text..."
            prepend-inner-icon="mdi-magnify"
            clearable
        />

        <div class="filter-group">
            <v-btn-toggle
                v-model="selectedColors"
                color="primary"
                density="compact"
                multiple
                variant="outlined"
                class="color-filters"
            >
                <v-btn
                    v-for="color in colors"
                    :key="color.code"
                    :value="color.code"
                    :title="color.label"
                    class="color-btn"
                    icon
                    size="small"
                >
                    <v-avatar
                        class="mana-pip"
                        size="26"
                        :color="MANA_BG[color.code]"
                    >
                        <i class="ms" :class="`ms-${color.code.toLowerCase()}`" />
                    </v-avatar>
                </v-btn>
            </v-btn-toggle>

            <v-select
                v-model="cards.typeFilter"
                :items="typeItems"
                label="Type"
                style="max-width: 170px"
            />

            <v-select
                v-model="cards.rarityFilter"
                :items="rarityItems"
                label="Rarity"
                style="max-width: 170px"
            />

            <template v-if="cards.sealedMode">
                <v-select
                    v-model="cards.groupBy"
                    :items="groupItems"
                    label="Group by"
                    style="max-width: 170px"
                />

                <v-btn-toggle
                    v-model="cards.deckView"
                    color="primary"
                    density="compact"
                    mandatory
                >
                    <v-btn value="all" size="small">All Cards</v-btn>
                    <v-btn value="deck" size="small">In Deck</v-btn>
                </v-btn-toggle>
            </template>

            <v-select
                v-else
                v-model="cards.sortBy"
                :items="sortItems"
                label="Sort by"
                style="max-width: 180px"
            />

            <v-btn size="small" @click="cards.resetFilters()">Clear</v-btn>
        </div>
    </div>
</template>

<script setup>
import { computed } from "vue";
import { useCardStore } from "../stores/cards";

const cards = useCardStore();

const MANA_BG = {
    W: "#f0f2c0",
    U: "#b5cde3",
    B: "#aca29a",
    R: "#db8664",
    G: "#93b483",
    C: "#beb9b2",
};

const colors = [
    { code: "W", symbol: "W", label: "White" },
    { code: "U", symbol: "U", label: "Blue" },
    { code: "B", symbol: "B", label: "Black" },
    { code: "R", symbol: "R", label: "Red" },
    { code: "G", symbol: "G", label: "Green" },
    { code: "C", symbol: "C", label: "Colorless" },
];

const selectedColors = computed({
    get: () => cards.colorFilter,
    set: (v) => { cards.colorFilter = v; },
});

const typeItems = [
    { title: "All Types", value: "" },
    ...["Creature", "Instant", "Sorcery", "Enchantment", "Artifact", "Planeswalker", "Land", "Battle"].map((t) => ({ title: t, value: t })),
];

const rarityItems = [
    { title: "All Rarities", value: "" },
    { title: "Common", value: "Common" },
    { title: "Uncommon", value: "Uncommon" },
    { title: "Rare", value: "Rare" },
    { title: "Mythic", value: "Mythic" },
];

const groupItems = [
    { title: "Mana", value: "cmc" },
    { title: "Color", value: "color" },
    { title: "Type", value: "type" },
    { title: "None", value: "none" },
];

const sortItems = [
    { title: "Name", value: "name" },
    { title: "Mana Cost", value: "cmc" },
    { title: "Color", value: "color" },
    { title: "Type", value: "type" },
];
</script>
