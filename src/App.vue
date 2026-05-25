<template>
    <v-app>
        <header class="app-titlebar">
            <button
                type="button"
                class="titlebar-text no-drag"
                @click="aboutOpen = true"
                title="About Dredge"
            >
                Dredge
            </button>

            <template v-if="cards.loaded && !cards.showPacks">
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

                <v-btn size="small" class="no-drag" @click="cards.openPacks()" prepend-icon="mdi-package-variant-closed">
                    Open Packs
                </v-btn>
            </template>
        </header>

        <WelcomeOverlay
            v-if="!cards.loaded"
            :phase="overlayPhase"
            :received="loadReceived"
            :total="loadTotal"
            :update-percent="updatePercent"
            :update-version="updateVersion"
            :error="error"
            @retry="loadCardDb"
        />

        <template v-if="cards.loaded && !cards.loading">
            <PackOpener v-if="cards.showPacks && packs.phase === 'opening'" />
            <PackSetup v-else-if="cards.showPacks" />
            <template v-else>
                <SearchBar />
                <DeckBuilder v-if="cards.sealedMode" />
                <CardGrid v-else />
            </template>
        </template>

        <CardDetail v-if="cards.selectedCard" />

        <AboutDialog v-model="aboutOpen" />
    </v-app>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useCardStore } from "./stores/cards";
import { usePackStore } from "./stores/packs";
import SearchBar from "./components/SearchBar.vue";
import CardGrid from "./components/CardGrid.vue";
import CardDetail from "./components/CardDetail.vue";
import DeckBuilder from "./components/DeckBuilder.vue";
import PackSetup from "./components/PackSetup.vue";
import PackOpener from "./components/PackOpener.vue";
import WelcomeOverlay from "./components/WelcomeOverlay.vue";
import AboutDialog from "./components/AboutDialog.vue";

const cards = useCardStore();
const packs = usePackStore();
const error = ref(null);
const aboutOpen = ref(false);

const loadPhase = ref("checking");
const loadReceived = ref(0);
const loadTotal = ref(0);
let unsubscribeProgress = null;

// Update gate: block card-DB load until the update check resolves so that an
// available update can be downloaded + installed before the user starts using
// the app. Times out (UPDATE_GATE_TIMEOUT_MS) so a hung check can't lock startup.
const UPDATE_GATE_TIMEOUT_MS = 8000;
const updateGateOpen = ref(true);
const updatePhase = ref("update-checking");
const updatePercent = ref(0);
const updateVersion = ref("");
let unsubscribeUpdate = null;
let updateGateTimeout = null;

const overlayPhase = computed(() =>
    updateGateOpen.value ? updatePhase.value : loadPhase.value
);

function closeUpdateGate() {
    if (!updateGateOpen.value) return;
    updateGateOpen.value = false;
    if (updateGateTimeout) {
        clearTimeout(updateGateTimeout);
        updateGateTimeout = null;
    }
    loadCardDb();
}

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

    if (window.electronAPI?.onUpdateEvent) {
        unsubscribeUpdate = window.electronAPI.onUpdateEvent((p) => {
            const phase = p?.phase;
            if (phase === "checking") {
                updatePhase.value = "update-checking";
            } else if (phase === "available") {
                updatePhase.value = "update-downloading";
                updateVersion.value = p.version || "";
            } else if (phase === "downloading") {
                updatePhase.value = "update-downloading";
                updatePercent.value = p.percent || 0;
            } else if (phase === "downloaded") {
                updateVersion.value = p.version || updateVersion.value;
                if (updateGateOpen.value) {
                    updatePhase.value = "update-installing";
                    window.electronAPI.quitAndInstallUpdate?.();
                }
                // If gate already closed (rare race after the checking-phase
                // timeout), electron-updater's autoInstallOnAppQuit will apply
                // the update on next quit.
            } else if (phase === "none" || phase === "error") {
                closeUpdateGate();
            }
        });
        // Only time out while still checking. Once a download has started we
        // wait for it; otherwise a slow network would dump the user into the
        // app and defeat the point of installing-at-startup.
        updateGateTimeout = setTimeout(() => {
            if (updatePhase.value === "update-checking") closeUpdateGate();
        }, UPDATE_GATE_TIMEOUT_MS);
    } else {
        // Dev / browser mode — no auto-update channel, skip the gate.
        closeUpdateGate();
    }
});

onBeforeUnmount(() => {
    if (unsubscribeProgress) unsubscribeProgress();
    if (unsubscribeUpdate) unsubscribeUpdate();
    if (updateGateTimeout) clearTimeout(updateGateTimeout);
});
</script>
