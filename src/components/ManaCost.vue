<template>
    <span v-if="cost" class="mana-cost" :class="{ 'mana-cost--inline': !pill }">
        <template v-for="(side, sideIdx) in sides" :key="sideIdx">
            <span v-if="sideIdx > 0" class="mana-cost-slash">//</span>
            <i
                v-for="(token, idx) in side"
                :key="`${sideIdx}-${idx}`"
                class="ms"
                :class="[pill ? 'ms-cost' : null, ...tokenClass(token)]"
            />
        </template>
    </span>
</template>

<script setup>
import { computed } from "vue";
import { splitSides, tokenClass } from "../services/manaSymbols";

const props = defineProps({
    cost: { type: String, default: "" },
    pill: { type: Boolean, default: true },
});

const sides = computed(() => splitSides(props.cost));
</script>
