<template>
    <div class="welcome-overlay">
        <div class="welcome-card">
            <h1 class="welcome-title">Dredge</h1>
            <p class="welcome-tagline">
                Magic: The Gathering pack opener &amp; sealed-deck workshop
            </p>

            <div class="welcome-body">
                <template v-if="error">
                    <p class="welcome-status welcome-error">{{ error }}</p>
                    <p class="welcome-explain">
                        Couldn't reach mtgjson.com to download the card data.
                        Check your connection and try again.
                    </p>
                    <v-btn color="primary" size="large" @click="$emit('retry')">
                        Retry
                    </v-btn>
                </template>
                <template v-else>
                    <p class="welcome-status">{{ statusLine }}</p>
                    <p v-if="phase !== 'checking'" class="welcome-explain">
                        First launch downloads the card database from MTGJSON.
                        This only happens once. Future launches read from a
                        local cache.
                    </p>

                    <template v-if="phase === 'downloading' && total > 0">
                        <div class="welcome-bar">
                            <div
                                class="welcome-bar-fill"
                                :style="{ width: percent + '%' }"
                            />
                        </div>
                        <p class="welcome-bytes">
                            {{ formatBytes(received) }} / {{ formatBytes(total) }}
                        </p>
                    </template>

                    <template v-else-if="phase === 'downloading'">
                        <div class="welcome-spinner-row">
                            <v-progress-circular
                                indeterminate
                                color="primary"
                                size="28"
                                width="3"
                            />
                        </div>
                        <p class="welcome-bytes">
                            {{ formatBytes(received) }} downloaded
                        </p>
                    </template>

                    <div v-else class="welcome-spinner-row">
                        <v-progress-circular
                            indeterminate
                            color="primary"
                            size="28"
                            width="3"
                        />
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
    phase: { type: String, default: "checking" },
    received: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    error: { type: String, default: null },
});

defineEmits(["retry"]);

const statusLine = computed(() => {
    switch (props.phase) {
        case "checking": return "Checking for card data updates…";
        case "downloading": return "Downloading card data from MTGJSON…";
        case "parsing": return "Indexing cards…";
        case "writing": return "Saving local cache…";
        case "done": return "Ready.";
        default: return "Loading…";
    }
});

const percent = computed(() => {
    if (!props.total) return 0;
    return Math.min(99.5, Math.max(0, (props.received / props.total) * 100));
});

function formatBytes(n) {
    if (!n) return "0 MB";
    const mb = n / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = n / 1024;
    return `${kb.toFixed(0)} KB`;
}
</script>

<style scoped>
.welcome-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: radial-gradient(
            ellipse at center,
            rgba(40, 28, 14, 0.96) 0%,
            rgba(15, 11, 7, 1) 70%
        ),
        rgb(var(--v-theme-background));
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    -webkit-app-region: drag;
    user-select: none;
}

.welcome-card {
    width: 100%;
    max-width: 520px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 14px;
    padding: 40px 36px;
    background:
        linear-gradient(180deg, rgba(255, 215, 120, 0.04) 0%, rgba(0, 0, 0, 0) 80%),
        rgb(var(--v-theme-surface));
    border: 1px solid rgba(197, 157, 74, 0.28);
    border-radius: 12px;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55),
        0 0 0 1px rgba(197, 157, 74, 0.08) inset;
}

.welcome-title {
    margin: 0;
    font-family: var(--font-display);
    font-size: 36px;
    font-weight: 900;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    line-height: 1;
    background: linear-gradient(180deg, #fbe6a0 0%, #e8c668 35%, #b38a3a 75%, #7a5a1f 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.55));
}

.welcome-tagline {
    margin: 0 0 18px;
    color: rgb(var(--v-theme-on-surface-variant));
    font-size: 13px;
    letter-spacing: 0.04em;
}

.welcome-body {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
    -webkit-app-region: no-drag;
}

.welcome-status {
    margin: 0;
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #e8c668;
}

.welcome-error {
    color: rgb(var(--v-theme-error));
}

.welcome-explain {
    margin: 0;
    font-size: 13px;
    line-height: 1.55;
    color: rgb(var(--v-theme-on-surface));
    opacity: 0.78;
}

.welcome-bytes {
    margin: 0;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: rgb(var(--v-theme-on-surface-variant));
}

.welcome-bar {
    width: 100%;
    height: 10px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(197, 157, 74, 0.18);
    overflow: hidden;
    position: relative;
}

.welcome-bar-fill {
    height: 100%;
    background: linear-gradient(
        90deg,
        #b38a3a 0%,
        #e8c668 50%,
        #fbe6a0 100%
    );
    box-shadow: 0 0 12px rgba(232, 198, 104, 0.45);
    transition: width 0.18s ease-out;
    position: relative;
    overflow: hidden;
}

.welcome-bar-fill::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.35) 50%,
        transparent 100%
    );
    animation: welcome-bar-shimmer 1.4s linear infinite;
}

@keyframes welcome-bar-shimmer {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
}

.welcome-spinner-row {
    display: flex;
    justify-content: center;
    padding: 6px 0 2px;
}
</style>
