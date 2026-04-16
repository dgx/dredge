<template>
    <div class="sealed-import">
        <div class="sealed-import-box">
            <h2>Import Sealed Pool</h2>
            <p class="sealed-import-hint">
                Paste a Cockatrice-format card list below. Each line:
                <code>count Card Name [SET:number]</code>
            </p>

            <textarea
                class="sealed-import-textarea"
                v-model="importText"
                rows="14"
                placeholder="1 Ninja's Blades [FIN:108]&#10;2 Fate of the Sun-Cryst [FIN:19]"
                spellcheck="false"
            />

            <div class="sealed-import-actions">
                <button class="btn" @click="pasteFromClipboard">Paste from Clipboard</button>
                <button class="btn" @click="importText = ''" :disabled="!importText">Clear</button>
                <button
                    class="btn btn-primary"
                    @click="doImport"
                    :disabled="!importText.trim()"
                >
                    Import Pool
                </button>
            </div>

            <div v-if="clipboardError" class="sealed-import-notice error-text">
                {{ clipboardError }}
            </div>

            <div v-if="cards.importErrors.length > 0" class="sealed-import-errors">
                <p>
                    <strong>{{ cards.importErrors.length }}</strong> line(s) could not be matched:
                </p>
                <ul>
                    <li v-for="(err, i) in cards.importErrors" :key="i">
                        <span class="err-reason">[{{ err.reason }}]</span>
                        {{ err.line }}
                    </li>
                </ul>
            </div>

            <div class="sealed-import-secondary">
                <button
                    v-if="cards.sealedPool.length > 0"
                    class="btn btn-small"
                    @click="backToPool"
                >
                    Back to current pool ({{ cards.sealedPool.length }})
                </button>
                <button class="btn btn-small" @click="browseAll">
                    Browse all cards instead
                </button>
            </div>
        </div>
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
</script>
