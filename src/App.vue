<template>
    <v-app>
        <header class="app-titlebar">
            <span class="titlebar-text">Dredge</span>

            <template v-if="cards.loaded && !cards.showImport && !cards.showDraft">
                <v-btn-toggle
                    v-if="cards.sealedPool.length > 0"
                    :model-value="cards.sealedMode ? 'sealed' : 'all'"
                    @update:model-value="(v) => cards.setSealedMode(v === 'sealed')"
                    color="primary"
                    density="compact"
                    mandatory
                    class="no-drag"
                >
                    <v-btn value="sealed" size="small">
                        {{ cards.hasImportedPool ? "Sealed Pool" : "Deck" }}
                    </v-btn>
                    <v-btn value="all" size="small">All Cards</v-btn>
                </v-btn-toggle>

                <span v-if="!cards.sealedMode" class="card-count">
                    {{ cards.filteredCards.length.toLocaleString() }} cards
                    <template v-if="cards.deckTotal > 0">
                        · Deck <strong>{{ cards.deckTotal }}/{{ cards.deckSize }}</strong>
                    </template>
                </span>
                <span v-else class="card-count">
                    Deck <strong>{{ cards.deckTotal }}/{{ cards.deckSize }}</strong>
                    · Pool {{ poolRemaining }}
                </span>

                <v-btn-toggle
                    :model-value="cards.deckSize"
                    @update:model-value="(v) => cards.setDeckSize(v)"
                    color="primary"
                    density="compact"
                    mandatory
                    class="no-drag deck-size-toggle"
                >
                    <v-btn :value="40" size="small">40</v-btn>
                    <v-btn :value="60" size="small">60</v-btn>
                </v-btn-toggle>

                <v-spacer />

                <v-btn size="small" class="no-drag" @click="cards.openDraft()" prepend-icon="mdi-package-variant-closed">
                    Open Packs
                </v-btn>

                <v-btn size="small" class="no-drag" @click="cards.openImport()">
                    {{ cards.hasImportedPool ? "Re-import" : "Build Sealed Deck" }}
                </v-btn>
            </template>
        </header>

        <WelcomeOverlay
            v-if="!cards.loaded"
            :phase="loadPhase"
            :received="loadReceived"
            :total="loadTotal"
            :error="error"
            @retry="loadCardDb"
        />

        <template v-if="cards.loaded && !cards.loading">
            <DraftPackOpener v-if="cards.showDraft && draft.phase === 'opening'" />
            <DraftSetup v-else-if="cards.showDraft" />
            <SealedImport v-else-if="cards.showImport" />
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
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useCardStore } from "./stores/cards";
import { useDraftStore } from "./stores/draft";
import SearchBar from "./components/SearchBar.vue";
import CardGrid from "./components/CardGrid.vue";
import CardDetail from "./components/CardDetail.vue";
import SealedImport from "./components/SealedImport.vue";
import DeckBuilder from "./components/DeckBuilder.vue";
import DraftSetup from "./components/DraftSetup.vue";
import DraftPackOpener from "./components/DraftPackOpener.vue";
import WelcomeOverlay from "./components/WelcomeOverlay.vue";

const cards = useCardStore();
const draft = useDraftStore();
const error = ref(null);

const loadPhase = ref("checking");
const loadReceived = ref(0);
const loadTotal = ref(0);
let unsubscribeProgress = null;

const poolRemaining = computed(
    () => cards.sealedPool.length - cards.deckIds.size
);

async function loadCardDb() {
    error.value = null;
    cards.loading = true;
    loadPhase.value = "checking";
    loadReceived.value = 0;
    loadTotal.value = 0;
    try {
        const slim = await window.electronAPI.loadCardDatabase();
        cards.loadDatabase(slim);
    } catch (err) {
        console.error("Failed to load database:", err);
        error.value = "Failed to load card database: " + err.message;
    } finally {
        cards.loading = false;
    }
}

onMounted(() => {
    if (window.electronAPI?.onCardDbProgress) {
        unsubscribeProgress = window.electronAPI.onCardDbProgress((p) => {
            if (p.phase) loadPhase.value = p.phase;
            if (typeof p.bytesReceived === "number") loadReceived.value = p.bytesReceived;
            if (typeof p.totalBytes === "number") loadTotal.value = p.totalBytes;
        });
    }
    loadCardDb();
});

onBeforeUnmount(() => {
    if (unsubscribeProgress) unsubscribeProgress();
});
</script>
