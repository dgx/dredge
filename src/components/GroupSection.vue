<template>
    <section class="grouped-section" :class="`grouped-depth-${group.depth}`">
        <header class="grouped-header" :class="`grouped-header-${group.depth}`">
            <ManaPip
                v-if="pipKind"
                :kind="pipKind"
                :value="group.key"
                :size="pipSize"
            />
            <span class="grouped-label">{{ group.label }}</span>
            <v-chip size="x-small" variant="tonal">
                {{ totalCount }} card{{ totalCount === 1 ? "" : "s" }}
            </v-chip>
            <div class="grouped-actions">
                <v-btn
                    icon="mdi-plus"
                    size="x-small"
                    variant="tonal"
                    color="success"
                    density="comfortable"
                    :disabled="addableCount === 0"
                    :title="addTitle"
                    @click="addAll"
                />
                <v-btn
                    icon="mdi-minus"
                    size="x-small"
                    variant="tonal"
                    color="error"
                    density="comfortable"
                    :disabled="inDeckCount === 0"
                    :title="removeTitle"
                    @click="removeAll"
                />
            </div>
        </header>

        <div v-if="group.stacks" class="grouped-row">
            <CardStack
                v-for="s in group.stacks"
                :key="s.card.name"
                :stack="s"
                :click-action="cards.deckView === 'deck' ? 'remove' : 'add'"
            />
        </div>
        <div v-else-if="group.children" class="grouped-children">
            <GroupSection
                v-for="child in group.children"
                :key="child.key"
                :group="child"
            />
        </div>
    </section>
</template>

<script>
export default { name: "GroupSection" };
</script>

<script setup>
import { computed } from "vue";
import { useCardStore } from "../stores/cards";
import CardStack from "./CardStack.vue";
import ManaPip from "./ManaPip.vue";

const props = defineProps({
    group: { type: Object, required: true },
});

const cards = useCardStore();

const pipKind = computed(() => {
    if (!props.group.groupBy) return null;
    if (props.group.groupBy === "cmc" || props.group.groupBy === "color" || props.group.groupBy === "type") {
        return props.group.groupBy;
    }
    return null;
});

const pipSize = computed(() => {
    if (props.group.depth === 0) return 30;
    if (props.group.depth === 1) return 24;
    return 20;
});

function collectStacks(g, out) {
    if (g.stacks) {
        for (const s of g.stacks) out.push(s);
    }
    if (g.children) {
        for (const child of g.children) collectStacks(child, out);
    }
    return out;
}

const allStacks = computed(() => collectStacks(props.group, []));

const totalCount = computed(() =>
    allStacks.value.reduce((sum, s) => sum + s.count, 0)
);

const addableCount = computed(() =>
    allStacks.value.reduce((sum, s) => sum + (s.total - s.inDeck), 0)
);

const inDeckCount = computed(() =>
    allStacks.value.reduce((sum, s) => sum + s.inDeck, 0)
);

const addTitle = computed(() =>
    addableCount.value === 0
        ? "All cards in this group are already in the deck"
        : `Add ${addableCount.value} card${addableCount.value === 1 ? "" : "s"} to deck`
);

const removeTitle = computed(() =>
    inDeckCount.value === 0
        ? "No cards in this group are in the deck"
        : `Remove ${inDeckCount.value} card${inDeckCount.value === 1 ? "" : "s"} from deck`
);

function addAll() {
    const ids = [];
    for (const s of allStacks.value) {
        for (const id of s.poolIds) ids.push(id);
    }
    cards.addPoolIdsToDeck(ids);
}

function removeAll() {
    const ids = [];
    for (const s of allStacks.value) {
        for (const id of s.poolIds) ids.push(id);
    }
    cards.removePoolIdsFromDeck(ids);
}
</script>
