import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
    plugins: [vue()],
    test: {
        environment: "happy-dom",
        globals: false,
        include: ["tests/**/*.test.js"],
        setupFiles: ["tests/setup.js"],
        server: {
            deps: {
                inline: ["vuetify"],
            },
        },
        coverage: {
            provider: "v8",
            include: ["src/services/**", "src/stores/**", "src/components/**"],
            exclude: ["**/__tests__/**"],
        },
    },
});
