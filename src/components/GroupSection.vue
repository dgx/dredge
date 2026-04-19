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

function countStacks(g) {
    if (g.stacks) return g.stacks.reduce((sum, s) => sum + s.count, 0);
    if (g.children) return g.children.reduce((sum, c) => sum + countStacks(c), 0);
    return 0;
}

const totalCount = computed(() => countStacks(props.group));
</script>
