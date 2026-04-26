import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/services/imageLoader.js", () => ({
    getCachedSync: () => null,
    loadCardImage: vi.fn().mockResolvedValue(null),
}));

import CardStack from "../../src/components/CardStack.vue";
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

function makeStack({ inDeck = 0, total = 1, count = total } = {}) {
    const card = makeCard();
    return {
        card,
        poolIds: Array.from({ length: total }, (_, i) => `p-${i}`),
        total,
        inDeck,
        available: total - inDeck,
        count,
    };
}

beforeEach(() => {});

describe("CardStack", () => {
    it("renders no badge when count is 1 and nothing in deck", () => {
        const w = mountWithVuetify(CardStack, {
            props: { stack: makeStack({ total: 1, inDeck: 0 }), clickAction: "add" },
        });
        expect(w.find(".stack-count-badge").exists()).toBe(false);
    });

    it("renders an x-count badge when count > 1 and none in deck", () => {
        const w = mountWithVuetify(CardStack, {
            props: { stack: makeStack({ total: 3, inDeck: 0 }), clickAction: "add" },
        });
        expect(w.find(".stack-count-badge-text").text()).toBe("×3");
    });

    it("renders an in-deck/total badge in 'all' mode when some are in the deck", () => {
        const w = mountWithVuetify(CardStack, {
            props: { stack: makeStack({ total: 4, inDeck: 2 }), clickAction: "add" },
        });
        expect(w.find(".stack-count-badge-text").text()).toBe("2/4");
    });

    it("applies fully-in-deck class when all copies are in the deck", () => {
        const w = mountWithVuetify(CardStack, {
            props: { stack: makeStack({ total: 2, inDeck: 2 }), clickAction: "add" },
        });
        expect(w.find(".stack-fully-in-deck").exists()).toBe(true);
    });

    it("applies partially-in-deck class when some are in the deck", () => {
        const w = mountWithVuetify(CardStack, {
            props: { stack: makeStack({ total: 4, inDeck: 1 }), clickAction: "add" },
        });
        expect(w.find(".stack-partially-in-deck").exists()).toBe(true);
    });

    it("renders shadows for stacks of 2+", () => {
        const w = mountWithVuetify(CardStack, {
            props: { stack: makeStack({ total: 4, inDeck: 0 }), clickAction: "add" },
        });
        expect(w.findAll(".stack-shadow")).toHaveLength(3);
    });

    it("primary click adds to deck in 'add' mode", async () => {
        const stack = makeStack({ total: 3, inDeck: 0 });
        const w = mountWithVuetify(CardStack, {
            props: { stack, clickAction: "add" },
        });
        const cards = useCardStore();
        const spy = vi.spyOn(cards, "addCardToDeck");
        await w.find(".card-stack-main").trigger("mousedown.left");
        expect(spy).toHaveBeenCalledWith(stack.poolIds);
    });

    it("right-click removes from deck in 'add' mode", async () => {
        const stack = makeStack({ total: 3, inDeck: 1 });
        const w = mountWithVuetify(CardStack, {
            props: { stack, clickAction: "add" },
        });
        const cards = useCardStore();
        const spy = vi.spyOn(cards, "removeCardFromDeck");
        await w.find(".card-stack-main").trigger("contextmenu");
        expect(spy).toHaveBeenCalledWith(stack.poolIds);
    });

    it("primary click removes from deck in 'remove' mode", async () => {
        const stack = makeStack({ total: 3, inDeck: 2 });
        const w = mountWithVuetify(CardStack, {
            props: { stack, clickAction: "remove" },
        });
        const cards = useCardStore();
        const spy = vi.spyOn(cards, "removeCardFromDeck");
        await w.find(".card-stack-main").trigger("mousedown.left");
        expect(spy).toHaveBeenCalledWith(stack.poolIds);
    });

    it("info button opens card detail without bubbling to primary action", async () => {
        const stack = makeStack({ total: 1, inDeck: 0 });
        const w = mountWithVuetify(CardStack, {
            props: { stack, clickAction: "add" },
        });
        const cards = useCardStore();
        const addSpy = vi.spyOn(cards, "addCardToDeck");
        const selectSpy = vi.spyOn(cards, "selectCard");
        await w.find(".stack-info-btn").trigger("click");
        expect(selectSpy).toHaveBeenCalledWith(stack.card);
        expect(addSpy).not.toHaveBeenCalled();
    });
});
