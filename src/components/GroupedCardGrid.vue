<template>
    <div class="grouped-grid">
        <v-alert
            v-if="cards.groupedStacks.length === 0"
            type="info"
            variant="tonal"
            class="grouped-empty"
        >
            <template v-if="cards.deckView === 'deck'">
                No cards in deck yet. Switch to Pool view and click cards to add them.
            </template>
            <template v-else>No cards match your current filters.</template>
        </v-alert>

        <section
            v-for="group in cards.groupedStacks"
            :key="group.key"
            class="grouped-section"
        >
            <header class="grouped-header">
                <i
                    v-if="groupIconClass(group.key)"
                    class="ms ms-cost grouped-icon"
                    :class="groupIconClass(group.key)"
                />
                <span class="grouped-label">{{ group.label }}</span>
                <v-chip size="x-small" variant="tonal">
                    {{ totalInGroup(group) }} card{{ totalInGroup(group) === 1 ? "" : "s" }}
                </v-chip>
            </header>
            <div class="grouped-row">
                <CardStack
                    v-for="s in group.stacks"
                    :key="s.card.name"
                    :stack="s"
                    :click-action="cards.deckView === 'deck' ? 'remove' : 'add'"
                />
            </div>
        </section>
    </div>
</template>

<script setup>
import { useCardStore } from "../stores/cards";
import CardStack from "./CardStack.vue";

const cards = useCardStore();

function totalInGroup(group) {
    return group.stacks.reduce((sum, s) => sum + s.count, 0);
}

const COLOR_ICON = { W: "ms-w", U: "ms-u", B: "ms-b", R: "ms-r", G: "ms-g", colorless: "ms-c", multi: "ms-multicolor" };
const TYPE_ICON = {
    Creature: "ms-creature",
    Planeswalker: "ms-planeswalker",
    Instant: "ms-instant",
    Sorcery: "ms-sorcery",
    Enchantment: "ms-enchantment",
    Artifact: "ms-artifact",
    Battle: "ms-battle",
    Land: "ms-land",
};

function groupIconClass(key) {
    if (/^[0-6]$/.test(key)) return `ms-${key}`;
    if (COLOR_ICON[key]) return COLOR_ICON[key];
    if (TYPE_ICON[key]) return TYPE_ICON[key];
    if (key === "land") return "ms-land";
    return null;
}
</script>
