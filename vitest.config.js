import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
    plugins: [vue()],
    define: {
        __APP_VERSION__: JSON.stringify("0.0.0-test"),
    },
    // Pre-bundle Vuetify so vite doesn't re-transform every component file in every worker.
    optimizeDeps: {
        include: ["vuetify", "vuetify/components", "vuetify/directives"],
    },
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
        // Service/store tests don't touch the DOM and run far faster in node.
        environmentMatchGlobs: [
            ["tests/services/**", "node"],
            ["tests/stores/**", "node"],
            ["tests/components/**", "happy-dom"],
        ],
        coverage: {
            provider: "v8",
            include: ["src/services/**", "src/stores/**", "src/components/**"],
            exclude: ["**/__tests__/**"],
            reporter: ["text", "html"],
        },
    },
});
