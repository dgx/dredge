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
                            v-if="sel.setCode && !symbolFailed(sel.setCode)"
                            :src="setSymbolUrl(sel.setCode)"
                            :alt="sel.setCode"
                            class="set-symbol-large"
                            @error="onSymbolError(sel.setCode)"
                        />
                        <span v-else-if="sel.setCode" class="set-symbol-fallback">
                            {{ sel.setCode }}
                        </span>
                        <span v-else class="set-symbol-placeholder">?</span>
                    </div>

                    <v-autocomplete
                        :model-value="sel.setCode"
                        @update:model-value="(v) => onSetChange(sel.id, v)"
                        :items="setItems"
                        item-title="label"
                        item-value="code"
                        :label="picksLocked ? 'Loading sets…' : 'Set'"
                        :loading="picksLocked"
                        density="compact"
                        variant="outlined"
                        hide-details
                        class="set-picker"
                        :menu-props="{ width: 360 }"
                    >
                        <template #no-data>
                            <v-list-item v-if="picksLocked" class="set-picker-loading">
                                <template #prepend>
                                    <v-progress-circular
                                        indeterminate
                                        size="18"
                                        width="2"
                                    />
                                </template>
                                <v-list-item-title>Loading sets…</v-list-item-title>
                            </v-list-item>
                            <v-list-item v-else>
                                <v-list-item-title>No sets match</v-list-item-title>
                            </v-list-item>
                        </template>

                        <template #item="{ props, item }">
                            <v-list-item
                                v-bind="props"
                                :title="item.name"
                                :subtitle="itemSubtitle(item)"
                            >
                                <template #prepend>
                                    <div class="set-row-symbol-wrap">
                                        <img
                                            v-if="!symbolFailed(item.code)"
                                            :src="setSymbolUrl(item.code)"
                                            :alt="item.code"
                                            class="set-symbol-row"
                                            @error="onSymbolError(item.code)"
                                        />
                                        <span v-else class="set-symbol-fallback">
                                            {{ item.code }}
                                        </span>
                                    </div>
                                </template>
                            </v-list-item>
                        </template>
                    </v-autocomplete>

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
import {
    noBoosterSets,
    scanAvailability,
    scanning as availabilityScanning,
    markNoBooster,
} from "../services/boosterAvailability";

const draft = useDraftStore();
const cards = useCardStore();
const clipboardError = ref("");

onMounted(() => {
    setMuted(draft.muted);
    // Kick both off in parallel — they share the SetList in-flight promise.
    // The autocomplete is gated on `picksLocked` so the user can't interact
    // with a partially-known list.
    draft.loadSetOptions();
    scanAvailability();
});

// The picker is disabled (and shows Vuetify's loading bar) while the set list
// is loading OR while we're determining which sets have no booster data.
// Either condition could change membership, and we don't want entries to
// appear or disappear while the user is browsing.
const picksLocked = computed(
    () => draft.setOptionsLoading || availabilityScanning.value
);

watch(
    () => draft.muted,
    (m) => setMuted(m)
);

const setItems = computed(() => {
    const hidden = noBoosterSets.value;
    return draft.setOptions
        .filter((s) => !hidden.has(String(s.code).toUpperCase()))
        .map((s) => {
            const year = s.releaseDate ? s.releaseDate.slice(0, 4) : "";
            // label is both what's displayed in the input and what Vuetify's
            // built-in filter searches — include name, code, and year so any
            // of those work as a typeahead query.
            const label = year
                ? `${s.name} — ${s.code} — ${year}`
                : `${s.name} — ${s.code}`;
            return { ...s, label };
        });
});

const failedSymbols = ref(new Set());

function setSymbolUrl(code) {
    if (!code) return "";
    return `https://svgs.scryfall.io/sets/${code.toLowerCase()}.svg`;
}

function symbolFailed(code) {
    return failedSymbols.value.has(String(code || "").toUpperCase());
}

function onSymbolError(code) {
    const upper = String(code || "").toUpperCase();
    if (failedSymbols.value.has(upper)) return;
    const next = new Set(failedSymbols.value);
    next.add(upper);
    failedSymbols.value = next;
}

function itemSubtitle(s) {
    const parts = [s.code];
    if (s.releaseDate) parts.push(s.releaseDate.slice(0, 4));
    if (s.type) parts.push(prettyTypeName(s.type));
    if (s.baseSetSize) parts.push(`${s.baseSetSize} cards`);
    return parts.join(" · ");
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
    return null;
}

async function onSetChange(id, code) {
    draft.updateSelection(id, { setCode: code, boosterType: "" });
    if (!code) return;
    try {
        const data = await draft.ensureSetData(code);
        const rawTypes = data?.booster ? Object.keys(data.booster) : [];
        if (rawTypes.length === 0) {
            // Brand-new set the background scan hasn't reached yet, or
            // MTGJSON simply has no boosters for it. Hide it from the
            // dropdown for good and silently clear the slot.
            markNoBooster(code);
            draft.updateSelection(id, { setCode: "", boosterType: "" });
            return;
        }
        // Pre-pick a default booster type so the dropdown reflects what
        // we'll roll if the user doesn't change it.
        const types = draft.boosterTypesFor(code);
        if (types.length > 0) {
            draft.updateSelection(id, { boosterType: types[0] });
        }
    } catch {
        // Network/load error — leave the selection so rowError can surface it.
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
    /* Scryfall serves black-on-transparent SVGs; invert to white so they
     * read against the dark theme. */
    filter: brightness(0) invert(1) drop-shadow(0 0 2px rgba(0, 0, 0, 0.7));
}

.set-symbol-placeholder {
    color: rgba(255, 215, 120, 0.45);
    font-weight: 700;
    font-family: var(--font-display, serif);
}

.set-symbol-fallback {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: rgba(255, 215, 120, 0.75);
    text-transform: uppercase;
}

/* Fixed-size container so the prepend column is the same width whether it
 * holds the SVG symbol or the text fallback — gives consistent spacing
 * between the symbol slot and the title regardless of Vuetify's internals. */
.set-row-symbol-wrap {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 16px;
    flex-shrink: 0;
}

.set-symbol-row {
    width: 28px;
    height: 28px;
    object-fit: contain;
    filter: brightness(0) invert(1) drop-shadow(0 0 2px rgba(0, 0, 0, 0.7));
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
