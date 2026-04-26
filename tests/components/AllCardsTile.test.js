import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/services/imageLoader.js", () => ({
    getCachedSync: () => null,
    loadCardImage: vi.fn().mockResolvedValue(null),
}));

import AllCardsTile from "../../src/components/AllCardsTile.vue";
import { useCardStore } from "../../src/stores/cards.js";
import { mountWithVuetify } from "../helpers/mount.js";

function makeCard(overrides = {}) {
    return {
        name: "Lightning Bolt",
        manaCost: "R",
        type: "Instant",
        text: "deals 3 damage",
        pt: "",
        ...overrides,
    };
}

describe("AllCardsTile", () => {
    it("renders no badge when none in deck", () => {
        const w = mountWithVuetify(AllCardsTile, { props: { card: makeCard() } });
        expect(w.find(".stack-count-badge").exists()).toBe(false);
        expect(w.find(".stack-fully-in-deck").exists()).toBe(false);
    });

    it("renders an x-count badge when copies are in the deck", async () => {
        const w = mountWithVuetify(AllCardsTile, { props: { card: makeCard() } });
        const cards = useCardStore();
        cards.addCardFromDatabase(makeCard());
        cards.addCardFromDatabase(makeCard());
        await w.vm.$nextTick();
        expect(w.find(".stack-count-badge-text").text()).toBe("×2");
        expect(w.find(".stack-fully-in-deck").exists()).toBe(true);
    });

    it("primary click calls addCardFromDatabase with the card", async () => {
        const card = makeCard();
        const w = mountWithVuetify(AllCardsTile, { props: { card } });
        const cards = useCardStore();
        const spy = vi.spyOn(cards, "addCardFromDatabase");
        await w.find(".card-stack-main").trigger("mousedown.left");
        expect(spy).toHaveBeenCalledWith(card);
    });

    it("right-click calls removeOneByCard with the card", async () => {
        const card = makeCard();
        const w = mountWithVuetify(AllCardsTile, { props: { card } });
        const cards = useCardStore();
        const spy = vi.spyOn(cards, "removeOneByCard");
        await w.find(".card-stack-main").trigger("contextmenu");
        expect(spy).toHaveBeenCalledWith(card);
    });

    it("info button selects card without triggering add", async () => {
        const card = makeCard();
        const w = mountWithVuetify(AllCardsTile, { props: { card } });
        const cards = useCardStore();
        const addSpy = vi.spyOn(cards, "addCardFromDatabase");
        const selectSpy = vi.spyOn(cards, "selectCard");
        await w.find(".stack-info-btn").trigger("click");
        expect(selectSpy).toHaveBeenCalledWith(card);
        expect(addSpy).not.toHaveBeenCalled();
    });
});
