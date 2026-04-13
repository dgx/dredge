<template>
    <div class="app">
        <header class="app-titlebar">
            <span class="titlebar-text">Dredge</span>
            <span v-if="cards.loaded" class="card-count">
                {{ cards.filteredCards.length.toLocaleString() }} cards
            </span>
        </header>

        <div v-if="cards.loading" class="empty-state">
            <p>Loading database...</p>
        </div>

        <div v-if="error" class="empty-state">
            <p class="error-text">{{ error }}</p>
        </div>

        <template v-if="cards.loaded && !cards.loading">
            <SearchBar />
            <CardGrid />
        </template>

        <CardDetail v-if="cards.selectedCard" />
    </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useCardStore } from "./stores/cards";
import SearchBar from "./components/SearchBar.vue";
import CardGrid from "./components/CardGrid.vue";
import CardDetail from "./components/CardDetail.vue";

const cards = useCardStore();
const error = ref(null);

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
