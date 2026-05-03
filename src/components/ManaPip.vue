<template>
    <v-avatar
        class="mana-pip"
        :class="variantClass"
        :size="size"
        :color="bg"
        :style="{ fontSize: `${sizeNum}px` }"
    >
        <span v-if="text">{{ text }}</span>
        <i v-else class="ms" :class="iconClass" />
    </v-avatar>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
    // "color" | "cmc" | "type"
    kind: { type: String, required: true },
    // For color: W/U/B/R/G/C/colorless/multi/land
    // For cmc: "0".."6", "7+", "land"
    // For type: Creature/Instant/etc.
    value: { type: [String, Number], required: true },
    size: { type: [Number, String], default: 26 },
});

const COLOR_BG = {
    W: "#f0f2c0",
    U: "#b5cde3",
    B: "#aca29a",
    R: "#db8664",
    G: "#93b483",
    C: "#beb9b2",
    colorless: "#beb9b2",
    multi: "#d8b75a",
    land: "#7d6a4f",
};

const COLOR_ICON = {
    W: "ms-w",
    U: "ms-u",
    B: "ms-b",
    R: "ms-r",
    G: "ms-g",
    C: "ms-c",
    colorless: "ms-c",
    multi: "ms-multicolor",
    land: "ms-land",
};

const TYPE_ICON = {
    Creature: "ms-creature",
    Planeswalker: "ms-planeswalker",
    Instant: "ms-instant",
    Sorcery: "ms-sorcery",
    Enchantment: "ms-enchantment",
    Artifact: "ms-artifact",
    Battle: "ms-battle",
    Land: "ms-land",
};

const v = computed(() => String(props.value));

const text = computed(() => (props.kind === "cmc" && v.value !== "land" ? v.value : null));

const iconClass = computed(() => {
    if (props.kind === "color") return COLOR_ICON[v.value] || null;
    if (props.kind === "type") return TYPE_ICON[v.value] || null;
    if (props.kind === "cmc" && v.value === "land") return "ms-land";
    return null;
});

const bg = computed(() => {
    if (props.kind === "color") return COLOR_BG[v.value] || "#beb9b2";
    if (props.kind === "cmc") return v.value === "land" ? COLOR_BG.land : "#beb9b2";
    if (props.kind === "type") return "#3a3530";
    return "#beb9b2";
});

const variantClass = computed(() => `mana-pip--${props.kind}`);

const sizeNum = computed(() => Number(props.size) || 26);
</script>
