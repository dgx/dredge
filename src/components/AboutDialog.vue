<template>
    <v-dialog
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
        max-width="420"
    >
        <v-card class="about-card" color="surface">
            <v-card-text class="about-body">
                <h2 class="about-title">Dredge</h2>
                <p class="about-version">Version {{ appVersion }}</p>
                <p class="about-tagline">
                    Magic: The Gathering pack opener &amp; sealed-deck workshop
                </p>

                <v-divider class="about-divider" />

                <p class="about-credits">
                    Card data from
                    <a href="https://mtgjson.com" target="_blank" rel="noopener">MTGJSON</a>.
                    Card images from
                    <a href="https://scryfall.com" target="_blank" rel="noopener">Scryfall</a>.
                    Pack art from
                    <a href="https://www.tcgplayer.com" target="_blank" rel="noopener">TCGplayer</a>.
                </p>
                <p class="about-disclaimer">
                    Unofficial fan project. Not affiliated with or endorsed by
                    Wizards of the Coast.
                </p>
            </v-card-text>

            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" @click="$emit('update:modelValue', false)">
                    Close
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup>
defineProps({
    modelValue: { type: Boolean, default: false },
});
defineEmits(["update:modelValue"]);

const appVersion = __APP_VERSION__;
</script>

<style scoped>
.about-body {
    text-align: center;
    padding-top: 28px;
}

.about-title {
    font-family: var(--font-display);
    font-size: 30px;
    font-weight: 900;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    line-height: 1;
    background: linear-gradient(180deg, #fbe6a0 0%, #e8c668 35%, #b38a3a 75%, #7a5a1f 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
}

.about-version {
    margin-top: 8px;
    font-size: 13px;
    opacity: 0.7;
}

.about-tagline {
    margin-top: 12px;
    font-size: 14px;
    opacity: 0.85;
}

.about-divider {
    margin: 20px 0;
}

.about-credits {
    font-size: 12px;
    opacity: 0.7;
    line-height: 1.6;
}

.about-credits a {
    color: rgb(var(--v-theme-primary));
    text-decoration: none;
}

.about-credits a:hover {
    text-decoration: underline;
}

.about-disclaimer {
    margin-top: 14px;
    font-size: 11px;
    opacity: 0.5;
    line-height: 1.5;
}
</style>
