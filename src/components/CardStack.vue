<template>
    <div
        class="card-stack"
        :class="[
            count >= 2 && 'has-stack-1',
            count >= 3 && 'has-stack-2',
            count >= 4 && 'has-stack-3',
            fullyInDeck && 'stack-fully-in-deck',
            partiallyInDeck && 'stack-partially-in-deck',
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
            @mousedown.left="onPrimaryAction"
            @contextmenu.prevent="onRightClick"
        >
            <CardItem :card="stack.card" />
            <v-avatar
                v-if="badgeText"
                class="stack-count-badge"
                :color="showDeckBadge ? 'success' : 'surface'"
                size="32"
                rounded="0"
            >
                <span class="stack-count-badge-text">{{ badgeText }}</span>
            </v-avatar>
            <v-btn
                class="stack-info-btn"
                icon="mdi-information-outline"
                size="small"
                color="surface-variant"
                variant="elevated"
                :title="'View details for ' + stack.card.name"
                @mousedown.stop
                @click.stop="openDetail"
            />
            <v-avatar
                class="stack-action-hint"
                color="primary"
                size="72"
            >
                <v-icon :icon="actionIconName" size="56" color="on-primary" />
            </v-avatar>
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
const isAllView = computed(() => props.clickAction === "add");
const fullyInDeck = computed(() => isAllView.value && props.stack.inDeck === props.stack.total);
const partiallyInDeck = computed(
    () => isAllView.value && props.stack.inDeck > 0 && props.stack.inDeck < props.stack.total
);
const showDeckBadge = computed(() => isAllView.value && props.stack.inDeck > 0);
const badgeText = computed(() => {
    if (showDeckBadge.value) return `${props.stack.inDeck}/${props.stack.total}`;
    return count.value > 1 ? `×${count.value}` : null;
});
const actionIconName = computed(() => (isAllView.value ? "mdi-plus" : "mdi-minus"));
const actionHint = computed(() =>
    isAllView.value
        ? `Click to add to deck (${props.stack.inDeck}/${props.stack.total} in deck) — right-click to remove`
        : `Click to remove from deck (${props.stack.inDeck}/${props.stack.total} in deck) — right-click to add back`
);

function onPrimaryAction() {
    if (isAllView.value) {
        cards.addCardToDeck(props.stack.poolIds);
    } else {
        cards.removeCardFromDeck(props.stack.poolIds);
    }
}

function onRightClick() {
    if (isAllView.value) {
        cards.removeCardFromDeck(props.stack.poolIds);
    } else {
        cards.addCardToDeck(props.stack.poolIds);
    }
}

function openDetail() {
    cards.selectCard(props.stack.card);
}
</script>
