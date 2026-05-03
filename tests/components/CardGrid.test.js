import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/services/imageLoader.js", () => ({
    getCachedSync: () => null,
    loadCardImage: vi.fn().mockResolvedValue(null),
}));

import CardGrid from "../../src/components/CardGrid.vue";
import { useCardStore } from "../../src/stores/cards.js";
import { mountWithVuetify } from "../helpers/mount.js";

function makeCard(name) {
    return {
        name,
        text: "",
        manaCost: "",
        cmc: 1,
        type: "Instant",
        mainType: "Instant",
        colors: "R",
        rarity: "common",
        sets: [{ code: "LEA", uuid: `${name}-uuid` }],
        bestSet: "LEA",
        uuid: `${name}-uuid`,
    };
}

describe("CardGrid", () => {
    it("renders nothing when filteredCards is empty", () => {
        const w = mountWithVuetify(CardGrid);
        expect(w.findAll(".card-row")).toHaveLength(0);
    });

    it("renders rows containing the filtered cards", async () => {
        const w = mountWithVuetify(CardGrid);
        const cards = useCardStore();
        cards.allCards = [makeCard("A"), makeCard("B"), makeCard("C")];
        await w.vm.$nextTick();
        // Default columnsPerRow is 6, so 3 cards fit in one row.
        const rows = w.findAll(".card-row");
        expect(rows.length).toBeGreaterThanOrEqual(1);
        expect(w.text()).toContain("A");
        expect(w.text()).toContain("B");
        expect(w.text()).toContain("C");
    });

    it("resets scroll position when filteredCards changes", async () => {
        const w = mountWithVuetify(CardGrid);
        const cards = useCardStore();
        cards.allCards = [makeCard("A")];
        await w.vm.$nextTick();
        const container = w.find(".card-grid-container").element;
        container.scrollTop = 500;
        cards.allCards = [makeCard("B")];
        // wait for watch + nextTick callback
        await w.vm.$nextTick();
        await new Promise((r) => setTimeout(r, 0));
        expect(container.scrollTop).toBe(0);
    });
});
