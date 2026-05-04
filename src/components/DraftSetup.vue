<template>
    <div class="draft-setup">
        <v-card class="draft-setup-box" variant="flat" color="transparent">
            <h2>Open Packs</h2>
            <p class="draft-setup-hint">
                Pick sets and how many packs to crack.
            </p>

            <v-alert
                v-if="draft.setOptionsError"
                type="error"
                variant="tonal"
                density="compact"
                class="mb-3"
            >
                Couldn't load set list: {{ draft.setOptionsError }}
            </v-alert>

            <div v-if="draft.setOptionsLoading" class="loading-row">
                <v-progress-circular indeterminate size="20" width="2" />
                <span>Loading set list…</span>
            </div>

            <div class="selection-rows">
                <div
                    v-for="(sel, idx) in draft.selections"
                    :key="sel.id"
                    class="selection-row"
                >
                    <div class="row-label">Slot {{ idx + 1 }}</div>

                    <div class="row-symbol">
                        <img
                            v-if="sel.setCode"
                            :src="setSymbolUrl(sel.setCode)"
                            :alt="sel.setCode"
                            class="set-symbol-large"
                            @error="onSymbolError"
                        />
                        <span v-else class="set-symbol-placeholder">?</span>
                    </div>

                    <v-autocomplete
                        :model-value="sel.setCode"
                        @update:model-value="(v) => onSetChange(sel.id, v)"
                        :items="setItems"
                        item-title="label"
                        item-value="code"
                        label="Set"
                        density="compact"
                        variant="outlined"
                        hide-details
                        :loading="draft.loadingSets.has(sel.setCode)"
                        class="set-picker"
                    />

                    <v-text-field
                        :model-value="sel.count"
                        @update:model-value="(v) => draft.updateSelection(sel.id, { count: clampCount(v) })"
                        type="number"
                        label="Packs"
                        min="1"
                        max="24"
                        density="compact"
                        variant="outlined"
                        hide-details
                        class="count-field"
                    />

                    <v-select
                        v-if="boosterTypeChoices(sel).length > 1"
                        :model-value="sel.boosterType"
                        @update:model-value="(v) => draft.updateSelection(sel.id, { boosterType: v })"
                        :items="boosterTypeChoices(sel)"
                        label="Pack type"
                        density="compact"
                        variant="outlined"
                        hide-details
                        class="type-field"
                    />

                    <v-btn
                        icon="mdi-close"
                        variant="text"
                        size="small"
                        :disabled="draft.selections.length <= 1"
                        @click="draft.removeSelection(sel.id)"
                    />

                    <div v-if="rowError(sel)" class="row-error">{{ rowError(sel) }}</div>
                </div>
            </div>

            <div class="draft-setup-actions">
                <v-btn
                    v-if="draft.canAddSelection"
                    @click="draft.addSelection"
                    prepend-icon="mdi-plus"
                    variant="text"
                >
                    Add another set
                </v-btn>

                <v-spacer />

                <v-btn
                    @click="toggleMute"
                    :prepend-icon="draft.muted ? 'mdi-volume-off' : 'mdi-volume-high'"
                    variant="text"
                    size="small"
                >
                    Sound: {{ draft.muted ? "Off" : "On" }}
                </v-btn>

                <v-btn
                    color="primary"
                    variant="flat"
                    @click="onStart"
                    :disabled="!draft.canStart"
                    :loading="draft.phase === 'loading'"
                    prepend-icon="mdi-package-variant-closed"
                >
                    Open {{ draft.totalPacks }} pack<span v-if="draft.totalPacks !== 1">s</span>
                </v-btn>
            </div>

            <v-alert
                v-if="draft.error"
                type="error"
                variant="tonal"
                class="mt-3"
            >
                {{ draft.error }}
            </v-alert>

            <v-divider class="my-4" />

            <div class="draft-setup-secondary">
                <v-btn
                    size="small"
                    prepend-icon="mdi-clipboard-text-outline"
                    @click="importFromClipboard"
                >
                    Import from Clipboard
                </v-btn>
                <v-btn size="small" @click="goImport">
                    Import sealed pool instead
                </v-btn>
                <v-btn
                    v-if="cards.sealedPool.length > 0"
                    size="small"
                    @click="backToPool"
                >
                    Back to current pool ({{ cards.sealedPool.length }})
                </v-btn>
                <v-btn size="small" @click="browseAll">
                    Browse all cards
                </v-btn>
            </div>

            <v-alert
                v-if="clipboardError"
                type="error"
                variant="tonal"
                density="compact"
                class="mt-3"
            >
                {{ clipboardError }}
            </v-alert>
        </v-card>
    </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useDraftStore } from "../stores/draft";
import { useCardStore } from "../stores/cards";
import { setMuted, unlockAudio } from "../services/packAudio";

const draft = useDraftStore();
const cards = useCardStore();
const clipboardError = ref("");

onMounted(() => {
    draft.loadSetOptions();
    setMuted(draft.muted);
});

watch(
    () => draft.muted,
    (m) => setMuted(m)
);

const setItems = computed(() =>
    draft.setOptions.map((s) => {
        const year = s.releaseDate ? s.releaseDate.slice(0, 4) : "";
        const label = year
            ? `${s.name} — ${s.code} — ${year}`
            : `${s.name} — ${s.code}`;
        return { ...s, label };
    })
);

function setSymbolUrl(code) {
    if (!code) return "";
    return `https://svgs.scryfall.io/sets/${code.toLowerCase()}.svg`;
}

function onSymbolError(e) {
    e.target.style.visibility = "hidden";
}

function clampCount(v) {
    const n = Math.max(1, Math.min(24, parseInt(v, 10) || 0));
    return n;
}

function boosterTypeChoices(sel) {
    if (!sel.setCode) return [];
    const types = draft.boosterTypesFor(sel.setCode);
    return types.map((t) => ({ title: prettyTypeName(t), value: t }));
}

function prettyTypeName(t) {
    return t
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function rowError(sel) {
    if (!sel.setCode) return null;
    const err = draft.setLoadErrors.get(sel.setCode);
    if (err) return `Failed to load: ${err}`;
    const data = draft.loadedSetData.get(sel.setCode);
    if (data && draft.boosterTypesFor(sel.setCode).length === 0) {
        return "This set has no draft-friendly booster data.";
    }
    return null;
}

async function onSetChange(id, code) {
    draft.updateSelection(id, { setCode: code, boosterType: "" });
    if (code) {
        try {
            await draft.ensureSetData(code);
            // Pre-pick a default booster type so the dropdown reflects what
            // we'll roll if the user doesn't change it.
            const types = draft.boosterTypesFor(code);
            if (types.length > 0) {
                draft.updateSelection(id, { boosterType: types[0] });
            }
        } catch {
            // Error surfaces via rowError.
        }
    }
}

async function onStart() {
    // First user gesture — unlock the audio context.
    await unlockAudio();
    await draft.startDraft();
}

function toggleMute() {
    draft.muted = !draft.muted;
}

function backToPool() {
    cards.setSealedMode(true);
    cards.closeImport();
}

function goImport() {
    cards.openImport();
}

function browseAll() {
    cards.setSealedMode(false);
    cards.closeImport();
}

async function importFromClipboard() {
    clipboardError.value = "";
    let text;
    try {
        text = await navigator.clipboard.readText();
    } catch (err) {
        clipboardError.value = "Could not read clipboard: " + (err?.message || "permission denied");
        return;
    }
    if (!text || !text.trim()) {
        clipboardError.value = "Clipboard is empty.";
        return;
    }
    cards.importSealedPool(text);
    if (cards.sealedPool.length === 0) {
        clipboardError.value = "No cards parsed from clipboard.";
        return;
    }
    // Clipboard import succeeded — leave the pack-opener and land on the pool.
    cards.closeDraft();
}
</script>

<style scoped>
.draft-setup {
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-y: auto;
    padding: 32px 24px 48px;
    flex: 1;
    min-height: 0;
}

.draft-setup-box {
    width: 100%;
    max-width: 760px;
}

.draft-setup-hint {
    color: var(--text-muted, rgba(255, 255, 255, 0.7));
    margin: 6px 0 18px;
}

.loading-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 8px 0 16px;
    color: var(--text-muted, rgba(255, 255, 255, 0.7));
}

.selection-rows {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.selection-row {
    display: grid;
    grid-template-columns: auto auto 1fr 110px 160px auto;
    align-items: center;
    gap: 10px;
}

.row-symbol {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(197, 157, 74, 0.18);
}

.set-symbol-large {
    width: 26px;
    height: 26px;
    object-fit: contain;
    filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.6));
}

.set-symbol-placeholder {
    color: rgba(255, 215, 120, 0.45);
    font-weight: 700;
    font-family: var(--font-display, serif);
}

.selection-row .row-error {
    grid-column: 3 / -1;
    color: rgb(var(--v-theme-error));
    font-size: 12px;
    margin-top: -4px;
}

.row-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted, rgba(255, 255, 255, 0.55));
    width: 56px;
}

.set-symbol {
    width: 22px;
    height: 22px;
    object-fit: contain;
    filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.6));
    flex-shrink: 0;
}

.selection-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.draft-setup-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 18px;
}

.draft-setup-secondary {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}
</style>
