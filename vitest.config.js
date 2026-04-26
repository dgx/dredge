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
