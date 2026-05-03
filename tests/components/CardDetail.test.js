import { describe, it, expect, vi } from "vitest";

const loadCardImage = vi.fn().mockResolvedValue(null);
vi.mock("../../src/services/imageLoader.js", () => ({
    getCachedSync: () => null,
    loadCardImage: (...a) => loadCardImage(...a),
}));

import CardDetail from "../../src/components/CardDetail.vue";
import { useCardStore } from "../../src/stores/cards.js";
import { mountWithVuetify } from "../helpers/mount.js";

function makeCard(overrides = {}) {
    return {
        name: "Lightning Bolt",
        text: "Deals 3 damage to any target.",
        manaCost: "R",
        cmc: 1,
        type: "Instant",
        mainType: "Instant",
        colors: "R",
        pt: "",
        loyalty: "",
        rarity: "common",
        sets: [{ code: "LEA" }, { code: "MMQ" }],
        ...overrides,
    };
}

describe("CardDetail", () => {
    it("renders nothing visible when no card is selected", () => {
        const w = mountWithVuetify(CardDetail);
        // Dialog is closed -> the v-card body doesn't appear in the dom
        expect(document.body.textContent).not.toContain("Lightning Bolt");
        w.unmount();
    });

    it("renders card information when a card is selected", async () => {
        const w = mountWithVuetify(CardDetail);
        const cards = useCardStore();
        cards.selectCard(makeCard());
        await w.vm.$nextTick();
        await w.vm.$nextTick();
        expect(document.body.textContent).toContain("Lightning Bolt");
        expect(document.body.textContent).toContain("Instant");
        expect(document.body.textContent).toContain("LEA, MMQ");
        w.unmount();
    });

    it("formats the colors string into named colors", async () => {
        const w = mountWithVuetify(CardDetail);
        const cards = useCardStore();
        cards.selectCard(makeCard({ colors: "WB" }));
        await w.vm.$nextTick();
        await w.vm.$nextTick();
        expect(document.body.textContent).toContain("White, Black");
        w.unmount();
    });

    it("renders oracle text with mana symbols rendered as icons", async () => {
        const w = mountWithVuetify(CardDetail);
        const cards = useCardStore();
        cards.selectCard(makeCard({ text: "Add {R}." }));
        await w.vm.$nextTick();
        await w.vm.$nextTick();
        expect(document.body.innerHTML).toContain('class="ms ms-r"');
        w.unmount();
    });
});
