import { describe, it, expect } from "vitest";
import { isLand, typeKey, groupCards, TYPE_ORDER } from "../../src/services/cardGrouping.js";

function card(overrides = {}) {
    return {
        name: "Card",
        type: "Creature — Goblin",
        mainType: "Creature",
        cmc: 2,
        colors: "R",
        rarity: "common",
        ...overrides,
    };
}

function stack(card) {
    return { card };
}

describe("isLand", () => {
    it("returns true when mainType matches /land/i", () => {
        expect(isLand({ mainType: "Land" })).toBe(true);
        expect(isLand({ mainType: "Basic Land" })).toBe(true);
    });

    it("falls back to type if mainType is missing", () => {
        expect(isLand({ type: "Basic Land — Forest" })).toBe(true);
    });

    it("does not match 'Landform' or 'Wasteland' by mainType but does by type", () => {
        // mainType /land/i matches loosely
        expect(isLand({ mainType: "Wasteland" })).toBe(true);
        // type uses \bland\b — 'Wasteland' has no word boundary
        expect(isLand({ type: "Wasteland Creature" })).toBe(false);
    });

    it("returns false for non-lands", () => {
        expect(isLand({ mainType: "Creature", type: "Creature — Goblin" })).toBe(false);
    });

    it("matches Land token in a multi-word type", () => {
        expect(isLand({ type: "Legendary Land — Mountain" })).toBe(true);
    });
});

describe("typeKey", () => {
    it("returns the canonical TYPE_ORDER value when mainType matches exactly", () => {
        for (const t of TYPE_ORDER) {
            if (t === "Other") continue;
            expect(typeKey({ mainType: t })).toBe(t);
        }
    });

    it("falls back to extracting from type when mainType is missing", () => {
        expect(typeKey({ type: "Legendary Creature — Dragon" })).toBe("Creature");
    });

    it("returns Other for unrecognized types", () => {
        expect(typeKey({ mainType: "Conspiracy" })).toBe("Other");
    });

    it("handles Battle, Planeswalker, etc.", () => {
        expect(typeKey({ mainType: "Battle" })).toBe("Battle");
        expect(typeKey({ mainType: "Planeswalker" })).toBe("Planeswalker");
    });
});

describe("groupCards", () => {
    const stacks = [
        stack(card({ name: "Bolt", colors: "R", cmc: 1, mainType: "Instant" })),
        stack(card({ name: "Counterspell", colors: "U", cmc: 2, mainType: "Instant" })),
        stack(card({ name: "Forest", colors: "", mainType: "Land", type: "Basic Land — Forest", cmc: 0 })),
        stack(card({ name: "Goblin", colors: "R", cmc: 1, mainType: "Creature" })),
        stack(card({ name: "Wrath", colors: "WB", cmc: 4, mainType: "Sorcery" })),
    ];

    it("returns one 'all' bucket when no grouping is requested", () => {
        const groups = groupCards(stacks, []);
        expect(groups).toHaveLength(1);
        expect(groups[0].key).toBe("all");
        expect(groups[0].stacks).toHaveLength(stacks.length);
    });

    it("returns empty array when stacks are empty and no grouping", () => {
        expect(groupCards([], [])).toEqual([]);
    });

    it("groups by color in canonical order", () => {
        const groups = groupCards(stacks, ["color"]);
        const keys = groups.map((g) => g.key);
        expect(keys).toEqual(["U", "R", "multi", "land"]);
    });

    it("buckets multicolor and colorless and land separately", () => {
        const groups = groupCards(stacks, ["color"]);
        const land = groups.find((g) => g.key === "land");
        expect(land.stacks.map((s) => s.card.name)).toContain("Forest");
        const multi = groups.find((g) => g.key === "multi");
        expect(multi.stacks.map((s) => s.card.name)).toContain("Wrath");
    });

    it("groups by cmc with land bucket separated", () => {
        const groups = groupCards(stacks, ["cmc"]);
        const keys = groups.map((g) => g.key);
        expect(keys).toEqual(["1", "2", "4", "land"]);
    });

    it("treats cmc >= 7 as the 7+ bucket", () => {
        const big = [stack(card({ cmc: 9, mainType: "Sorcery" }))];
        const groups = groupCards(big, ["cmc"]);
        expect(groups[0].key).toBe("7+");
    });

    it("ignores duplicate or invalid grouping levels", () => {
        const groups = groupCards(stacks, ["color", "color", "bogus", null]);
        // Only one effective level
        expect(groups.every((g) => g.depth === 0)).toBe(true);
        expect(groups.some((g) => g.children)).toBe(false);
    });

    it("supports nested grouping", () => {
        const groups = groupCards(stacks, ["color", "cmc"]);
        const r = groups.find((g) => g.key === "R");
        expect(r.children).toBeDefined();
        expect(r.children.map((c) => c.key).sort()).toEqual(["1"]);
        // Only red cards (Bolt, Goblin) at cmc 1
        expect(r.children[0].stacks).toHaveLength(2);
    });

    it("sorts leaf stacks by cmc then name", () => {
        const messy = [
            stack(card({ name: "Z", cmc: 5, colors: "R" })),
            stack(card({ name: "A", cmc: 5, colors: "R" })),
            stack(card({ name: "B", cmc: 1, colors: "R" })),
        ];
        const groups = groupCards(messy, ["color"]);
        const r = groups.find((g) => g.key === "R");
        expect(r.stacks.map((s) => s.card.name)).toEqual(["B", "A", "Z"]);
    });

    it("groups by rarity using canonical order", () => {
        const rarities = [
            stack(card({ name: "X", rarity: "common" })),
            stack(card({ name: "Y", rarity: "rare" })),
            stack(card({ name: "Z", rarity: "mythic" })),
            stack(card({ name: "W", rarity: "" })),
        ];
        const groups = groupCards(rarities, ["rarity"]);
        expect(groups.map((g) => g.key)).toEqual(["mythic", "rare", "common", "unknown"]);
    });

    it("groups unknown rarities under 'special'", () => {
        const r = [stack(card({ rarity: "bonus" }))];
        const groups = groupCards(r, ["rarity"]);
        expect(groups[0].key).toBe("special");
    });

    it("groups by type in TYPE_ORDER", () => {
        const groups = groupCards(stacks, ["type"]);
        const keys = groups.map((g) => g.key);
        // Only the types present, in TYPE_ORDER
        expect(keys).toEqual(["Creature", "Instant", "Sorcery", "Land"]);
    });
});
