<template>
    <div
        class="card-stack all-cards-tile"
        :class="[
            inDeck > 0 && 'stack-fully-in-deck',
        ]"
    >
        <div
            class="card-stack-main"
            :title="actionHint"
            @mousedown.left="onAdd"
            @contextmenu.prevent="onRemove"
        >
            <CardItem :card="card" />
            <v-avatar
                v-if="inDeck > 0"
                class="stack-count-badge"
                color="success"
                size="32"
                rounded="0"
            >
                <span class="stack-count-badge-text">×{{ inDeck }}</span>
            </v-avatar>
            <v-btn
                class="stack-info-btn"
                icon="mdi-information-outline"
                size="small"
                color="surface-variant"
                variant="elevated"
                :title="'View details for ' + card.name"
                @mousedown.stop
                @click.stop="openDetail"
            />
            <v-avatar
                class="stack-action-hint"
                color="primary"
                size="72"
            >
                <v-icon icon="mdi-plus" size="56" color="on-primary" />
            </v-avatar>
        </div>
    </div>
</template>

<script setup>
import { computed } from "vue";
import CardItem from "./CardItem.vue";
import { useCardStore } from "../stores/cards";

const props = defineProps({
    card: { type: Object, required: true },
});

const cards = useCardStore();

const inDeck = computed(() => cards.deckCountByName.get(props.card.name) || 0);

const actionHint = computed(() =>
    `Click to add to deck (${inDeck.value} in deck) — right-click to remove`
);

function onAdd() {
    cards.addCardFromDatabase(props.card);
}

function onRemove() {
    cards.removeOneByCard(props.card);
}

function openDetail() {
    cards.selectCard(props.card);
}
</script>
