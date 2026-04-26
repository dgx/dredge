<template>
    <div class="search-bar">
        <!-- Row 1: search + view + reset -->
        <div class="bar-row bar-row--top">
            <v-text-field
                v-model="cards.searchQuery"
                placeholder="Search cards by name or text…"
                prepend-inner-icon="mdi-magnify"
                clearable
                class="search-input"
            />
            <v-btn-toggle
                v-if="cards.sealedMode"
                v-model="cards.deckView"
                color="primary"
                density="comfortable"
                variant="outlined"
                divided
                mandatory
            >
                <v-btn value="all">All Cards</v-btn>
                <v-btn value="deck">In Deck</v-btn>
            </v-btn-toggle>
            <v-btn
                variant="text"
                density="comfortable"
                prepend-icon="mdi-filter-remove-outline"
                @click="cards.resetFilters()"
            >
                Reset
            </v-btn>
        </div>

        <!-- Row 2: filter cluster | group/sort cluster -->
        <div class="bar-row bar-row--controls">
            <section class="control-cluster">
                <span class="control-label">Filter</span>
                <div class="color-filters">
                    <v-btn
                        v-for="color in colors"
                        :key="color.code"
                        :title="color.label"
                        :class="['color-btn', { 'color-btn--off': !isColorEnabled(color.code) }]"
                        variant="text"
                        density="comfortable"
                        icon
                        @click="toggleColor(color.code)"
                    >
                        <ManaPip kind="color" :value="color.code" :size="28" />
                    </v-btn>
                </div>
                <v-select
                    v-model="cards.typeFilter"
                    :items="typeItems"
                    label="Type"
                    class="control-select"
                />
                <v-select
                    v-model="cards.rarityFilter"
                    :items="rarityItems"
                    label="Rarity"
                    class="control-select"
                />
            </section>

            <v-divider vertical class="cluster-divider" />

            <section v-if="cards.sealedMode" class="control-cluster">
                <span class="control-label">Group</span>
                <div class="group-chips">
                    <v-btn
                        v-for="g in GROUP_TYPES"
                        :key="g.value"
                        :variant="isGrouped(g.value) ? 'flat' : 'outlined'"
                        :color="isGrouped(g.value) ? 'primary' : undefined"
                        density="comfortable"
                        class="group-chip"
                        @click="toggleGroup(g.value)"
                    >
                        <span
                            v-if="isGrouped(g.value)"
                            class="group-order-badge"
                        >{{ orderOf(g.value) }}</span>
                        <span>{{ g.label }}</span>
                    </v-btn>
                </div>
            </section>

            <section v-else class="control-cluster">
                <span class="control-label">Sort</span>
                <v-select
                    v-model="cards.sortBy"
                    :items="sortItems"
                    class="control-select"
                />
            </section>
        </div>
    </div>
</template>

<script setup>
import { useCardStore } from "../stores/cards";
import ManaPip from "./ManaPip.vue";

const cards = useCardStore();

const colors = [
    { code: "W", label: "White" },
    { code: "U", label: "Blue" },
    { code: "B", label: "Black" },
    { code: "R", label: "Red" },
    { code: "G", label: "Green" },
    { code: "C", label: "Colorless" },
];

function isColorEnabled(code) {
    return cards.colorFilter.includes(code);
}

function toggleColor(code) {
    const current = cards.colorFilter;
    const next = current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code];
    cards.setColorFilter(next);
}

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

const sortItems = [
    { title: "Name", value: "name" },
    { title: "Mana Cost", value: "cmc" },
    { title: "Color", value: "color" },
    { title: "Type", value: "type" },
];

const GROUP_TYPES = [
    { value: "type", label: "Type" },
    { value: "color", label: "Color" },
    { value: "cmc", label: "Mana Cost" },
    { value: "rarity", label: "Rarity" },
];

function isGrouped(g) {
    return cards.groupBy.includes(g);
}

function orderOf(g) {
    const idx = cards.groupBy.indexOf(g);
    return idx >= 0 ? idx + 1 : null;
}

function toggleGroup(g) {
    const existing = cards.groupBy.indexOf(g);
    if (existing >= 0) {
        cards.setGroupLevel(existing, null);
        return;
    }
    const slot = cards.groupBy.findIndex((v) => !v);
    if (slot >= 0) cards.setGroupLevel(slot, g);
}
</script>
