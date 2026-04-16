<template>
    <div class="card-item" @click="$emit('click')">
        <div class="card-image-wrapper">
            <img v-if="imageSrc" :src="imageSrc" :alt="card.name" class="card-image" loading="lazy" />
            <div v-else class="card-placeholder">
                <div class="placeholder-header">
                    <span class="placeholder-name">{{ card.name }}</span>
                    <span class="placeholder-cost">{{ card.manaCost }}</span>
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

const props = defineProps({
    card: { type: Object, required: true },
});

defineEmits(["click"]);

const imageSrc = ref(getCachedSync(props.card));
const loading = ref(!imageSrc.value);

let abortController = null;
let debounceTimer = null;

onMounted(() => {
    if (imageSrc.value) return;

    debounceTimer = setTimeout(async () => {
        abortController = new AbortController();
        const result = await loadCardImage(props.card, abortController.signal);
        if (result) imageSrc.value = result;
        loading.value = false;
    }, 200);
});

onUnmounted(() => {
    clearTimeout(debounceTimer);
    abortController?.abort();
});
</script>
