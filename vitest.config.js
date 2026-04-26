import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        globals: false,
        include: ["tests/**/*.test.js"],
        coverage: {
            provider: "v8",
            include: ["src/services/**", "src/stores/**"],
            exclude: ["**/__tests__/**"],
        },
    },
});
