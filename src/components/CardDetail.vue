<template>
    <v-dialog
        :model-value="!!cards.selectedCard"
        @update:model-value="(v) => !v && cards.clearSelection()"
        max-width="720"
    >
        <v-card v-if="card">
            <v-btn
                icon="mdi-close"
                variant="text"
                class="detail-close"
                @click="cards.clearSelection()"
            />
            <v-card-text>
                <div class="detail-layout">
                    <div class="detail-image-wrapper">
                        <v-img
                            v-if="imageSrc"
                            :src="imageSrc"
                            :alt="card.name"
                            width="250"
                            class="detail-image"
                        />
                        <div v-else class="detail-placeholder">
                            <v-progress-circular indeterminate color="primary" />
                        </div>
                    </div>

                    <div class="detail-info">
                        <h2 class="detail-name">{{ card.name }}</h2>
                        <v-list density="compact" bg-color="transparent" class="detail-list">
                            <v-list-item v-if="card.manaCost">
                                <template #title><span class="detail-label">Mana Cost</span></template>
                                <template #subtitle><ManaCost :cost="card.manaCost" /></template>
                            </v-list-item>
                            <v-list-item v-if="card.cmc">
                                <template #title><span class="detail-label">Mana Value</span></template>
                                <template #subtitle>{{ card.cmc }}</template>
                            </v-list-item>
                            <v-list-item>
                                <template #title><span class="detail-label">Type</span></template>
                                <template #subtitle>{{ card.type }}</template>
                            </v-list-item>
                            <v-list-item v-if="card.colors">
                                <template #title><span class="detail-label">Colors</span></template>
                                <template #subtitle>{{ formatColors(card.colors) }}</template>
                            </v-list-item>
                            <v-list-item v-if="card.pt">
                                <template #title><span class="detail-label">P/T</span></template>
                                <template #subtitle>{{ card.pt }}</template>
                            </v-list-item>
                            <v-list-item v-if="card.loyalty">
                                <template #title><span class="detail-label">Loyalty</span></template>
                                <template #subtitle>{{ card.loyalty }}</template>
                            </v-list-item>
                            <v-list-item v-if="card.rarity">
                                <template #title><span class="detail-label">Rarity</span></template>
                                <template #subtitle>{{ card.rarity }}</template>
                            </v-list-item>
                            <v-list-item v-if="card.sets.length">
                                <template #title><span class="detail-label">Sets</span></template>
                                <template #subtitle>{{ card.sets.map(s => s.code).join(", ") }}</template>
                            </v-list-item>
                        </v-list>
                        <div v-if="card.text" class="detail-text">
                            <span class="detail-label">Text</span>
                            <p v-html="oracleHtml" />
                        </div>
                    </div>
                </div>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { useCardStore } from "../stores/cards";
import { loadCardImage } from "../services/imageLoader";
import { renderOracleHtml } from "../services/manaSymbols";
import ManaCost from "./ManaCost.vue";

const cards = useCardStore();
const card = computed(() => cards.selectedCard);
const imageSrc = ref(null);
const oracleHtml = computed(() => renderOracleHtml(card.value?.text || ""));

const colorNames = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };

function formatColors(colors) {
    return colors
        .split("")
        .map((c) => colorNames[c] || c)
        .join(", ");
}

onMounted(async () => {
    if (card.value) {
        imageSrc.value = await loadCardImage(card.value);
    }
});
</script>
