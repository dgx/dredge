<template>
    <div class="card-grid-container" ref="container" @scroll="onScroll">
        <div class="card-grid" :style="{ height: totalHeight + 'px', position: 'relative' }">
            <div
                v-for="row in visibleRows"
                :key="row.index"
                class="card-row"
                :style="{ position: 'absolute', top: row.top + 'px', left: 0, right: 0 }"
            >
                <AllCardsTile
                    v-for="card in row.cards"
                    :key="card.poolId || card.name"
                    :card="card"
                />
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from "vue";
import { useCardStore } from "../stores/cards";
import AllCardsTile from "./AllCardsTile.vue";

const cards = useCardStore();
const container = ref(null);
const scrollTop = ref(0);
const containerHeight = ref(800);
const columnsPerRow = ref(6);

const ROW_HEIGHT = 340;
const CARD_WIDTH = 210;

const rows = computed(() => {
    const result = [];
    const list = cards.filteredCards;
    const cols = columnsPerRow.value;
    for (let i = 0; i < list.length; i += cols) {
        result.push(list.slice(i, i + cols));
    }
    return result;
});

const totalHeight = computed(() => rows.value.length * ROW_HEIGHT);

const visibleRows = computed(() => {
    const buffer = 2;
    const startRow = Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - buffer);
    const visibleCount = Math.ceil(containerHeight.value / ROW_HEIGHT) + buffer * 2;
    const endRow = Math.min(rows.value.length, startRow + visibleCount);

    const result = [];
    for (let i = startRow; i < endRow; i++) {
        result.push({
            index: i,
            top: i * ROW_HEIGHT,
            cards: rows.value[i],
        });
    }
    return result;
});

function onScroll() {
    if (container.value) {
        scrollTop.value = container.value.scrollTop;
    }
}

function updateDimensions() {
    if (container.value) {
        containerHeight.value = container.value.clientHeight;
        columnsPerRow.value = Math.max(1, Math.floor(container.value.clientWidth / CARD_WIDTH));
    }
}

let resizeObserver;

onMounted(() => {
    updateDimensions();
    resizeObserver = new ResizeObserver(updateDimensions);
    if (container.value) {
        resizeObserver.observe(container.value);
    }
});

onUnmounted(() => {
    resizeObserver?.disconnect();
});

watch(() => cards.filteredCards, () => {
    nextTick(() => {
        if (container.value) container.value.scrollTop = 0;
        scrollTop.value = 0;
    });
});
</script>
