import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/services/imageLoader.js", () => ({
    getCachedSync: () => null,
    loadCardImage: vi.fn().mockResolvedValue(null),
}));

import GroupSection from "../../src/components/GroupSection.vue";
import { useCardStore } from "../../src/stores/cards.js";
import { mountWithVuetify } from "../helpers/mount.js";

function makeStack({ name = "X", inDeck = 0, total = 1, count = total } = {}) {
    return {
        card: { name, manaCost: "R", type: "Instant", text: "", pt: "" },
        poolIds: Array.from({ length: total }, (_, i) => `${name}-${i}`),
        total,
        inDeck,
        available: total - inDeck,
        count,
    };
}

function makeLeaf(overrides = {}) {
    return {
        key: "R",
        label: "Red",
        groupBy: "color",
        depth: 0,
        stacks: [makeStack({ name: "A", total: 2, inDeck: 1 }), makeStack({ name: "B", total: 1 })],
        ...overrides,
    };
}

describe("GroupSection", () => {
    it("renders the group label and a count chip", () => {
        const w = mountWithVuetify(GroupSection, { props: { group: makeLeaf() } });
        expect(w.text()).toContain("Red");
        expect(w.text()).toContain("3 cards");
    });

    it("renders a CardStack for each leaf stack", () => {
        const w = mountWithVuetify(GroupSection, { props: { group: makeLeaf() } });
        expect(w.findAll(".card-stack").length).toBeGreaterThanOrEqual(2);
    });

    it("recursively renders child groups", () => {
        const child = makeLeaf({ key: "U", label: "Blue", depth: 1 });
        const parent = {
            key: "color",
            label: "Color",
            groupBy: null,
            depth: 0,
            children: [child],
        };
        const w = mountWithVuetify(GroupSection, { props: { group: parent } });
        expect(w.text()).toContain("Color");
        expect(w.text()).toContain("Blue");
    });

    it("disables the add-all button when nothing is addable", async () => {
        // total === inDeck for every stack -> nothing addable
        const group = makeLeaf({
            stacks: [makeStack({ name: "A", total: 1, inDeck: 1 }), makeStack({ name: "B", total: 1, inDeck: 1 })],
        });
        const w = mountWithVuetify(GroupSection, { props: { group } });
        const addBtn = w.find(".grouped-actions").findAll("button")[0];
        expect(addBtn.attributes("disabled")).toBeDefined();
    });

    it("disables the remove-all button when nothing is in the deck", () => {
        const group = makeLeaf({
            stacks: [makeStack({ name: "A", total: 2, inDeck: 0 }), makeStack({ name: "B", total: 1, inDeck: 0 })],
        });
        const w = mountWithVuetify(GroupSection, { props: { group } });
        const removeBtn = w.find(".grouped-actions").findAll("button")[1];
        expect(removeBtn.attributes("disabled")).toBeDefined();
    });

    it("addAll calls store.addPoolIdsToDeck with all collected ids", async () => {
        const group = makeLeaf();
        const w = mountWithVuetify(GroupSection, { props: { group } });
        const cards = useCardStore();
        const spy = vi.spyOn(cards, "addPoolIdsToDeck");
        const addBtn = w.find(".grouped-actions").findAll("button")[0];
        await addBtn.trigger("click");
        const expectedIds = group.stacks.flatMap((s) => s.poolIds);
        expect(spy).toHaveBeenCalledWith(expectedIds);
    });

    it("removeAll calls store.removePoolIdsFromDeck with all collected ids", async () => {
        const group = makeLeaf({
            stacks: [makeStack({ name: "A", total: 2, inDeck: 2 })],
        });
        const w = mountWithVuetify(GroupSection, { props: { group } });
        const cards = useCardStore();
        const spy = vi.spyOn(cards, "removePoolIdsFromDeck");
        const removeBtn = w.find(".grouped-actions").findAll("button")[1];
        await removeBtn.trigger("click");
        expect(spy).toHaveBeenCalledWith(group.stacks[0].poolIds);
    });

    it("collects stacks from nested children", () => {
        const group = {
            key: "all",
            label: "All",
            groupBy: null,
            depth: 0,
            children: [
                {
                    key: "R",
                    label: "Red",
                    groupBy: "color",
                    depth: 1,
                    stacks: [makeStack({ name: "A", total: 1 })],
                },
                {
                    key: "U",
                    label: "Blue",
                    groupBy: "color",
                    depth: 1,
                    stacks: [makeStack({ name: "B", total: 2 })],
                },
            ],
        };
        const w = mountWithVuetify(GroupSection, { props: { group } });
        // Root chip totals stacks across both children: 1 + 2 = 3
        const chips = w.findAll(".grouped-header > .v-chip");
        // Top-level chip should reflect the sum
        expect(w.text()).toContain("3 cards");
    });
});
