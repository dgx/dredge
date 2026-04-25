<template>
    <v-app>
        <header class="app-titlebar">
            <span class="titlebar-text">Dredge</span>

            <template v-if="cards.loaded && !cards.showImport">
                <v-btn-toggle
                    v-if="cards.sealedPool.length > 0"
                    :model-value="cards.sealedMode ? 'sealed' : 'all'"
                    @update:model-value="(v) => cards.setSealedMode(v === 'sealed')"
                    color="primary"
                    density="compact"
                    mandatory
                    class="no-drag"
                >
                    <v-btn value="sealed" size="small">Sealed Pool</v-btn>
                    <v-btn value="all" size="small">All Cards</v-btn>
                </v-btn-toggle>

                <span v-if="!cards.sealedMode" class="card-count">
                    {{ cards.filteredCards.length.toLocaleString() }} cards
                </span>
                <span v-else class="card-count">
                    Deck <strong>{{ cards.deckTotal }}/40</strong>
                    · Pool {{ poolRemaining }}
                </span>

                <v-spacer />

                <v-btn size="small" class="no-drag" @click="cards.openImport()">
                    {{ cards.sealedPool.length > 0 ? "Re-import" : "Build Sealed Deck" }}
                </v-btn>
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
    </v-app>
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
