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
</script>
