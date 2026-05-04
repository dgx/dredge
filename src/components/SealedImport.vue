<template>
    <div class="sealed-import">
        <v-card class="sealed-import-box" variant="flat" color="transparent">
            <h2>Import Sealed Pool</h2>
            <p class="sealed-import-hint">
                Paste a Cockatrice-format card list below. Each line:
                <code>count Card Name [SET:number]</code>
            </p>

            <v-textarea
                v-model="importText"
                rows="14"
                placeholder="1 Ninja's Blades [FIN:108]&#10;2 Fate of the Sun-Cryst [FIN:19]"
                spellcheck="false"
                variant="outlined"
                class="import-textarea"
                no-resize
            />

            <div class="sealed-import-actions">
                <v-btn @click="pasteFromClipboard" prepend-icon="mdi-content-paste">
                    Paste from Clipboard
                </v-btn>
                <v-btn @click="importText = ''" :disabled="!importText">Clear</v-btn>
                <v-btn
                    color="primary"
                    variant="flat"
                    @click="doImport"
                    :disabled="!importText.trim()"
                >
                    Import Pool
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

            <v-alert
                v-if="cards.importErrors.length > 0"
                type="warning"
                variant="tonal"
                class="mt-3"
            >
                <p>
                    <strong>{{ cards.importErrors.length }}</strong> line(s) could not be matched:
                </p>
                <ul class="import-error-list">
                    <li v-for="(err, i) in cards.importErrors" :key="i">
                        <span class="err-reason">[{{ err.reason }}]</span>
                        {{ err.line }}
                    </li>
                </ul>
            </v-alert>

            <v-divider class="my-4" />

            <div class="sealed-import-secondary">
                <v-btn
                    v-if="cards.sealedPool.length > 0"
                    size="small"
                    @click="backToPool"
                >
                    Back to current pool ({{ cards.sealedPool.length }})
                </v-btn>
                <v-btn size="small" @click="startDraft" prepend-icon="mdi-package-variant-closed">
                    Start a Draft instead
                </v-btn>
                <v-btn size="small" @click="browseAll">
                    Browse all cards instead
                </v-btn>
            </div>
        </v-card>
    </div>
</template>

<script setup>
import { ref } from "vue";
import { useCardStore } from "../stores/cards";

const cards = useCardStore();
const importText = ref("");
const clipboardError = ref("");

async function pasteFromClipboard() {
    clipboardError.value = "";
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            importText.value = text;
        } else {
            clipboardError.value = "Clipboard is empty.";
        }
    } catch (err) {
        clipboardError.value = "Could not read clipboard: " + err.message;
    }
}

function doImport() {
    cards.importSealedPool(importText.value);
}

function backToPool() {
    cards.setSealedMode(true);
    cards.closeImport();
}

function browseAll() {
    cards.setSealedMode(false);
    cards.closeImport();
}

function startDraft() {
    cards.openDraft();
}
</script>
