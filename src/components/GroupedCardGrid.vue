<template>
    <div class="grouped-grid">
        <v-alert
            v-if="cards.groupedStacks.length === 0"
            type="info"
            variant="tonal"
            class="grouped-empty"
        >
            <template v-if="cards.deckView === 'deck'">
                No cards in deck yet. Switch to All Cards and click to add — right-click removes.
            </template>
            <template v-else>No cards match your current filters.</template>
        </v-alert>

        <GroupSection
            v-for="group in cards.groupedStacks"
            :key="group.key"
            :group="group"
        />
    </div>
</template>

<script setup>
import { useCardStore } from "../stores/cards";
import GroupSection from "./GroupSection.vue";

const cards = useCardStore();
</script>
