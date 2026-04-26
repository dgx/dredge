import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/services/imageLoader.js", () => ({
    getCachedSync: () => null,
    loadCardImage: vi.fn().mockResolvedValue(null),
}));

import SearchBar from "../../src/components/SearchBar.vue";
import { useCardStore } from "../../src/stores/cards.js";
import { mountWithVuetify } from "../helpers/mount.js";

describe("SearchBar", () => {
    it("toggles a color off when its button is clicked", async () => {
        const w = mountWithVuetify(SearchBar);
        const cards = useCardStore();
        // Find the white button by its title attribute
        const whiteBtn = w.findAll(".color-btn").find((b) => b.attributes("title") === "White");
        expect(whiteBtn).toBeDefined();
        await whiteBtn.trigger("click");
        expect(cards.colorFilter).not.toContain("W");
    });

    it("toggles a color back on with a second click", async () => {
        const w = mountWithVuetify(SearchBar);
        const cards = useCardStore();
        const whiteBtn = w.findAll(".color-btn").find((b) => b.attributes("title") === "White");
        await whiteBtn.trigger("click");
        await whiteBtn.trigger("click");
        expect(cards.colorFilter).toContain("W");
    });

    it("clicking Reset calls store.resetFilters", async () => {
        const w = mountWithVuetify(SearchBar);
        const cards = useCardStore();
        cards.searchQuery = "asdf";
        cards.typeFilter = "Creature";
        const reset = w.findAll("button").find((b) => b.text().includes("Reset"));
        await reset.trigger("click");
        expect(cards.searchQuery).toBe("");
        expect(cards.typeFilter).toBe("");
    });

    it("does not show the deck-view toggle outside sealed mode", () => {
        const w = mountWithVuetify(SearchBar);
        const cards = useCardStore();
        expect(cards.sealedMode).toBe(false);
        expect(w.findAll("button").map((b) => b.text())).not.toContain("All Cards");
    });

    it("shows the deck-view toggle in sealed mode", async () => {
        const w = mountWithVuetify(SearchBar);
        const cards = useCardStore();
        cards.sealedMode = true;
        await w.vm.$nextTick();
        const labels = w.findAll("button").map((b) => b.text());
        expect(labels).toContain("All Cards");
        expect(labels).toContain("In Deck");
    });

    it("shows group chips in sealed mode and assigns slot order on toggle", async () => {
        const w = mountWithVuetify(SearchBar);
        const cards = useCardStore();
        cards.sealedMode = true;
        cards.groupBy = [null, null, null];
        await w.vm.$nextTick();
        const typeChip = w.findAll(".group-chip").find((b) => b.text().includes("Type"));
        expect(typeChip).toBeDefined();
        await typeChip.trigger("click");
        expect(cards.groupBy[0]).toBe("type");
        const colorChip = w.findAll(".group-chip").find((b) => b.text().includes("Color"));
        await colorChip.trigger("click");
        expect(cards.groupBy[1]).toBe("color");
    });

    it("clicking an active group chip removes it", async () => {
        const w = mountWithVuetify(SearchBar);
        const cards = useCardStore();
        cards.sealedMode = true;
        cards.groupBy = ["type", null, null];
        await w.vm.$nextTick();
        const typeChip = w.findAll(".group-chip").find((b) => b.text().includes("Type"));
        await typeChip.trigger("click");
        expect(cards.groupBy[0]).toBeNull();
    });

    it("renders a sort selector outside sealed mode", () => {
        const w = mountWithVuetify(SearchBar);
        expect(w.text().toLowerCase()).toContain("sort");
    });
});
