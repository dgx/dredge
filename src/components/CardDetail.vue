<template>
    <div class="card-detail-overlay" @click.self="cards.clearSelection()">
        <div class="card-detail">
            <button class="detail-close" @click="cards.clearSelection()">&times;</button>

            <div class="detail-layout">
                <div class="detail-image-wrapper">
                    <img v-if="imageSrc" :src="imageSrc" :alt="card.name" class="detail-image" />
                    <div v-else class="detail-placeholder">Loading...</div>
                </div>

                <div class="detail-info">
                    <h2 class="detail-name">{{ card.name }}</h2>
                    <div v-if="card.manaCost" class="detail-row">
                        <span class="detail-label">Mana Cost</span>
                        <span>{{ card.manaCost }}</span>
                    </div>
                    <div v-if="card.cmc" class="detail-row">
                        <span class="detail-label">Mana Value</span>
                        <span>{{ card.cmc }}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Type</span>
                        <span>{{ card.type }}</span>
                    </div>
                    <div v-if="card.colors" class="detail-row">
                        <span class="detail-label">Colors</span>
                        <span>{{ formatColors(card.colors) }}</span>
                    </div>
                    <div v-if="card.pt" class="detail-row">
                        <span class="detail-label">P/T</span>
                        <span>{{ card.pt }}</span>
                    </div>
                    <div v-if="card.loyalty" class="detail-row">
                        <span class="detail-label">Loyalty</span>
                        <span>{{ card.loyalty }}</span>
                    </div>
                    <div v-if="card.rarity" class="detail-row">
                        <span class="detail-label">Rarity</span>
                        <span>{{ card.rarity }}</span>
                    </div>
                    <div v-if="card.text" class="detail-text">
                        <span class="detail-label">Text</span>
                        <p>{{ card.text }}</p>
                    </div>
                    <div v-if="card.sets.length" class="detail-row">
                        <span class="detail-label">Sets</span>
                        <span>{{ card.sets.map(s => s.code).join(", ") }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { useCardStore } from "../stores/cards";
import { loadCardImage } from "../services/imageLoader";

const cards = useCardStore();
const card = computed(() => cards.selectedCard);
const imageSrc = ref(null);

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
