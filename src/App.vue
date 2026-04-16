<template>
    <div class="app">
        <header class="app-titlebar">
            <span class="titlebar-text">Dredge</span>

            <template v-if="cards.loaded && !cards.showImport">
                <div class="titlebar-toggle" v-if="cards.sealedPool.length > 0">
                    <button
                        class="toggle-btn"
                        :class="{ active: cards.sealedMode }"
                        @click="cards.setSealedMode(true)"
                    >
                        Sealed Pool
                    </button>
                    <button
                        class="toggle-btn"
                        :class="{ active: !cards.sealedMode }"
                        @click="cards.setSealedMode(false)"
                    >
                        All Cards
                    </button>
                </div>

                <span v-if="!cards.sealedMode" class="card-count">
                    {{ cards.filteredCards.length.toLocaleString() }} cards
                </span>
                <span v-else class="card-count">
                    Deck <strong>{{ cards.deckTotal }}/40</strong>
                    · Pool {{ poolRemaining }}
                </span>

                <div class="titlebar-spacer" />

                <button class="btn btn-small" @click="cards.openImport()">
                    {{ cards.sealedPool.length > 0 ? "Re-import" : "Import Pool" }}
                </button>
            </template>
        </header>

        <div v-if="cards.loading" class="empty-state">
            <p>Loading database...</p>
        </div>

        <div v-if="error" class="empty-state">
            <p class="error-text">{{ error }}</p>
        </div>

        <template v-if="cards.loaded && !cards.loading">
            <SealedImport v-if="cards.showImport" />
            <template v-else>
                <SearchBar />
                <DeckBuilder v-if="cards.sealedMode" />
                <CardGrid v-else />
            </template>
        </template>

        <CardDetail v-if="cards.selectedCard" />
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useCardStore } from "./stores/cards";
import SearchBar from "./components/SearchBar.vue";
import CardGrid from "./components/CardGrid.vue";
import CardDetail from "./components/CardDetail.vue";
import SealedImport from "./components/SealedImport.vue";
import DeckBuilder from "./components/DeckBuilder.vue";

const cards = useCardStore();
const error = ref(null);

const poolRemaining = computed(
    () => cards.sealedPool.length - cards.deckIds.size
);

onMounted(async () => {
    cards.loading = true;
    try {
        const xml = await window.electronAPI.readCardDatabase();
        await cards.parseDatabase(xml);
    } catch (err) {
        console.error("Failed to load database:", err);
        error.value = "Failed to load card database: " + err.message;
    } finally {
        cards.loading = false;
    }
});
</script>
