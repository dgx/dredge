<template>
    <div
        class="card-stack"
        :class="[
            count >= 2 && 'has-stack-1',
            count >= 3 && 'has-stack-2',
            count >= 4 && 'has-stack-3',
        ]"
    >
        <div class="card-stack-shadows" aria-hidden="true">
            <div class="stack-shadow stack-shadow-3" v-if="count >= 4"></div>
            <div class="stack-shadow stack-shadow-2" v-if="count >= 3"></div>
            <div class="stack-shadow stack-shadow-1" v-if="count >= 2"></div>
        </div>
        <div
            class="card-stack-main"
            :title="actionHint"
            @click="onClick"
            @contextmenu.prevent="onRightClick"
        >
            <CardItem :card="stack.card" />
            <span v-if="count > 1" class="stack-count-badge">×{{ count }}</span>
            <button
                class="stack-info-btn"
                :title="'View details for ' + stack.card.name"
                @click.stop="openDetail"
            >
                ⓘ
            </button>
            <div class="stack-action-hint">{{ actionIcon }}</div>
        </div>
    </div>
</template>

<script setup>
import { computed } from "vue";
import CardItem from "./CardItem.vue";
import { useCardStore } from "../stores/cards";

const props = defineProps({
    stack: { type: Object, required: true },
    clickAction: { type: String, default: "add" },
});

const cards = useCardStore();

const count = computed(() => props.stack.count);
const actionIcon = computed(() => (props.clickAction === "add" ? "+" : "−"));
const actionHint = computed(() =>
    props.clickAction === "add"
        ? `Click to add to deck (${props.stack.inDeck}/${props.stack.total} in deck) — right-click to remove`
        : `Click to remove from deck (${props.stack.inDeck}/${props.stack.total} in deck) — right-click to add back`
);

function onClick() {
    if (props.clickAction === "add") {
        cards.addCardToDeck(props.stack.poolIds);
    } else {
        cards.removeCardFromDeck(props.stack.poolIds);
    }
}

function onRightClick() {
    if (props.clickAction === "add") {
        cards.removeCardFromDeck(props.stack.poolIds);
    } else {
        cards.addCardToDeck(props.stack.poolIds);
    }
}

function openDetail() {
    cards.selectCard(props.stack.card);
}
</script>
