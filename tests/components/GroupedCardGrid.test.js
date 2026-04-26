import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/services/imageLoader.js", () => ({
    getCachedSync: () => null,
    loadCardImage: vi.fn().mockResolvedValue(null),
}));

import GroupedCardGrid from "../../src/components/GroupedCardGrid.vue";
import { useCardStore } from "../../src/stores/cards.js";
import { mountWithVuetify } from "../helpers/mount.js";

describe("GroupedCardGrid", () => {
    it("renders an info alert when there are no groups", () => {
        const w = mountWithVuetify(GroupedCardGrid);
        expect(w.text()).toContain("No cards match");
    });

    it("renders a deck-empty hint in deck view when deck is empty", async () => {
        const w = mountWithVuetify(GroupedCardGrid);
        const cards = useCardStore();
        cards.deckView = "deck";
        await w.vm.$nextTick();
        expect(w.text()).toContain("deck is empty");
    });

    it("renders a GroupSection for each group when cards are present", async () => {
        const w = mountWithVuetify(GroupedCardGrid);
        const cards = useCardStore();
        const card = {
            name: "Lightning Bolt",
            text: "deals 3 damage",
            manaCost: "R",
            cmc: 1,
            type: "Instant",
            mainType: "Instant",
            colors: "R",
            rarity: "common",
            sets: [{ code: "LEA" }],
            bestSet: "LEA",
            uuid: "lea-uuid",
        };
        cards.allCards = [card];
        cards.addCardFromDatabase(card);
        await w.vm.$nextTick();
        expect(w.findAll(".grouped-section").length).toBeGreaterThan(0);
        expect(w.text()).toContain("Lightning Bolt");
    });
});
