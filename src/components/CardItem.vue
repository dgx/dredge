<template>
    <div class="card-item" ref="root" @click="$emit('click')">
        <div class="card-image-wrapper">
            <img v-if="imageSrc" :src="imageSrc" :alt="card.name" class="card-image" />
            <div v-else class="card-placeholder">
                <div class="placeholder-header">
                    <span class="placeholder-name">{{ card.name }}</span>
                    <ManaCost :cost="card.manaCost" class="placeholder-cost" />
                </div>
                <div class="placeholder-art">
                    <v-progress-circular
                        v-if="loading"
                        indeterminate
                        size="20"
                        width="2"
                        color="on-surface-variant"
                    />
                </div>
                <div class="placeholder-typeline">{{ card.type }}</div>
                <div class="placeholder-textbox">
                    <span class="placeholder-text">{{ card.text }}</span>
                </div>
                <div v-if="card.pt" class="placeholder-pt">{{ card.pt }}</div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { loadCardImage, getCachedSync } from "../services/imageLoader";
import ManaCost from "./ManaCost.vue";

const props = defineProps({
    card: { type: Object, required: true },
});

defineEmits(["click"]);

const root = ref(null);
const imageSrc = ref(getCachedSync(props.card));
const loading = ref(!imageSrc.value);

let observer = null;
let abortController = null;
let debounceTimer = null;
let inFlight = false;

async function tryLoad() {
    if (imageSrc.value || inFlight) return;
    inFlight = true;
    abortController = new AbortController();
    try {
        const result = await loadCardImage(props.card, abortController.signal);
        if (result) {
            imageSrc.value = result;
            observer?.disconnect();
        }
    } finally {
        inFlight = false;
        loading.value = false;
    }
}

function cancelPending() {
    clearTimeout(debounceTimer);
    debounceTimer = null;
    abortController?.abort();
}

onMounted(() => {
    if (imageSrc.value) return;

    observer = new IntersectionObserver(
        (entries) => {
            const entry = entries[0];
            if (entry.isIntersecting) {
                if (imageSrc.value || debounceTimer) return;
                debounceTimer = setTimeout(() => {
                    debounceTimer = null;
                    tryLoad();
                }, 200);
            } else {
                cancelPending();
            }
        },
        { rootMargin: "200px" }
    );

    observer.observe(root.value);
});

onUnmounted(() => {
    observer?.disconnect();
    cancelPending();
});
</script>
