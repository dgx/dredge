<template>
    <div class="deck-builder">
        <div class="deck-builder-main">
            <GroupedCardGrid />
        </div>
        <DeckSummary />
    </div>
</template>

<script setup>
import GroupedCardGrid from "./GroupedCardGrid.vue";
import DeckSummary from "./DeckSummary.vue";
</script>
