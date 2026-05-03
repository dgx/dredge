import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/services/imageLoader.js", () => ({
    getCachedSync: () => null,
    loadCardImage: vi.fn().mockResolvedValue(null),
}));

import DeckBuilder from "../../src/components/DeckBuilder.vue";
import { mountWithVuetify } from "../helpers/mount.js";

describe("DeckBuilder", () => {
    it("composes the grouped grid and the deck summary", () => {
        const w = mountWithVuetify(DeckBuilder);
        expect(w.find(".deck-builder").exists()).toBe(true);
        expect(w.find(".deck-builder-main").exists()).toBe(true);
        expect(w.find(".deck-summary").exists()).toBe(true);
        expect(w.find(".grouped-grid").exists()).toBe(true);
    });
});
