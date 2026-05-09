import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useCardStore } from "../../src/stores/cards.js";
import { buildSlimDatabase } from "../../electron/cardDbTransform.cjs";
import { SAMPLE_ALL_PRINTINGS } from "../fixtures/sampleDatabase.js";

function makeCard(overrides = {}) {
    return {
        name: "Lightning Bolt",
        text: "Deals 3 damage.",
        manaCost: "R",
        cmc: 1,
        type: "Instant",
        mainType: "Instant",
        colors: "R",
        colorIdentity: "R",
        pt: "",
        loyalty: "",
        layout: "normal",
        side: "",
        sets: [{ code: "LEA", uuid: "lea-uuid", num: "161", rarity: "common" }],
        bestSet: "LEA",
        uuid: "lea-uuid",
        rarity: "common",
        ...overrides,
    };
}

beforeEach(() => {
    setActivePinia(createPinia());
});

describe("useCardStore - loadDatabase", () => {
    it("loads sets and cards from a slim database object", () => {
        const store = useCardStore();
        store.loadDatabase(buildSlimDatabase(SAMPLE_ALL_PRINTINGS));
        expect(store.loaded).toBe(true);
        expect(store.allCards.length).toBeGreaterThan(0);
        expect(Object.keys(store.sets).length).toBeGreaterThan(0);
    });

    it("tolerates undefined / partial input", () => {
        const store = useCardStore();
        store.loadDatabase(undefined);
        expect(store.allCards).toEqual([]);
        expect(store.sets).toEqual({});
        expect(store.loaded).toBe(true);
    });
});

describe("useCardStore - filtering", () => {
    let store;
    beforeEach(() => {
        store = useCardStore();
        store.allCards = [
            makeCard({ name: "Lightning Bolt", text: "deals 3 damage", colors: "R", type: "Instant", rarity: "common" }),
            makeCard({ name: "Counterspell", text: "Counter target spell.", colors: "U", type: "Instant", rarity: "common" }),
            makeCard({ name: "Wrath of God", text: "Destroy all creatures.", colors: "W", type: "Sorcery", rarity: "rare" }),
            makeCard({ name: "Sol Ring", text: "Add {C}{C}.", colors: "", type: "Artifact", rarity: "uncommon" }),
            makeCard({ name: "Goblin Guide", text: "Haste", colors: "R", type: "Creature — Goblin", rarity: "rare" }),
        ];
    });

    it("returns all cards by default", () => {
        expect(store.filteredCards.length).toBe(5);
    });

    it("searches by name (case-insensitive)", () => {
        store.searchQuery = "bolt";
        const names = store.filteredCards.map((c) => c.name);
        expect(names).toEqual(["Lightning Bolt"]);
    });

    it("searches by oracle text", () => {
        store.searchQuery = "destroy";
        expect(store.filteredCards.map((c) => c.name)).toEqual(["Wrath of God"]);
    });

    it("filters by single color", () => {
        store.setColorFilter(["R"]);
        const names = store.filteredCards.map((c) => c.name);
        expect(names).toContain("Lightning Bolt");
        expect(names).toContain("Goblin Guide");
        expect(names).not.toContain("Counterspell");
    });

    it("includes colorless cards when C is in the filter", () => {
        store.setColorFilter(["C"]);
        expect(store.filteredCards.map((c) => c.name)).toEqual(["Sol Ring"]);
    });

    it("treats empty color filter as 'all'", () => {
        store.setColorFilter([]);
        expect(store.filteredCards.length).toBe(5);
    });

    it("filters by type substring", () => {
        store.typeFilter = "creature";
        expect(store.filteredCards.map((c) => c.name)).toEqual(["Goblin Guide"]);
    });

    it("filters by rarity (exact, case-insensitive)", () => {
        store.rarityFilter = "Rare";
        const names = store.filteredCards.map((c) => c.name).sort();
        expect(names).toEqual(["Goblin Guide", "Wrath of God"]);
    });

    it("composes filters", () => {
        store.setColorFilter(["R"]);
        store.rarityFilter = "rare";
        expect(store.filteredCards.map((c) => c.name)).toEqual(["Goblin Guide"]);
    });
});

describe("useCardStore - sorting", () => {
    let store;
    beforeEach(() => {
        store = useCardStore();
        store.allCards = [
            makeCard({ name: "Charlie", cmc: 3, colors: "R", type: "Creature" }),
            makeCard({ name: "Alpha", cmc: 5, colors: "U", type: "Sorcery" }),
            makeCard({ name: "Bravo", cmc: 1, colors: "W", type: "Instant" }),
        ];
    });

    it("sorts by name", () => {
        store.sortBy = "name";
        expect(store.filteredCards.map((c) => c.name)).toEqual(["Alpha", "Bravo", "Charlie"]);
    });

    it("sorts by cmc with name tiebreaker", () => {
        store.sortBy = "cmc";
        expect(store.filteredCards.map((c) => c.name)).toEqual(["Bravo", "Charlie", "Alpha"]);
    });

    it("sorts by color", () => {
        store.sortBy = "color";
        expect(store.filteredCards.map((c) => c.colors)).toEqual(["R", "U", "W"]);
    });

    it("sorts by type", () => {
        store.sortBy = "type";
        expect(store.filteredCards.map((c) => c.type)).toEqual(["Creature", "Instant", "Sorcery"]);
    });
});

describe("useCardStore - selection", () => {
    it("selects and clears a card", () => {
        const store = useCardStore();
        const c = makeCard();
        store.selectCard(c);
        // Pinia wraps the value reactively, so compare structurally.
        expect(store.selectedCard).toEqual(c);
        store.clearSelection();
        expect(store.selectedCard).toBeNull();
    });
});

describe("useCardStore - resetFilters", () => {
    it("resets all filters to defaults", () => {
        const store = useCardStore();
        store.searchQuery = "x";
        store.setColorFilter(["R"]);
        store.typeFilter = "creature";
        store.rarityFilter = "rare";
        store.sortBy = "cmc";
        store.resetFilters();
        expect(store.searchQuery).toBe("");
        expect(store.colorFilter).toEqual(["W", "U", "B", "R", "G", "C"]);
        expect(store.typeFilter).toBe("");
        expect(store.rarityFilter).toBe("");
        expect(store.sortBy).toBe("name");
    });
});

describe("useCardStore - setGroupLevel", () => {
    it("sets a slot to a valid group type", () => {
        const store = useCardStore();
        store.setGroupLevel(0, "type");
        expect(store.groupBy[0]).toBe("type");
    });

    it("removes the value from another slot to enforce uniqueness", () => {
        const store = useCardStore();
        store.setGroupLevel(0, "type");
        store.setGroupLevel(1, "type");
        expect(store.groupBy[0]).toBeNull();
        expect(store.groupBy[1]).toBe("type");
    });

    it("treats 'none' or falsy values as null", () => {
        const store = useCardStore();
        store.setGroupLevel(0, "type");
        store.setGroupLevel(0, "none");
        expect(store.groupBy[0]).toBeNull();
    });

    it("ignores invalid group types", () => {
        const store = useCardStore();
        const before = [...store.groupBy];
        store.setGroupLevel(0, "bogus");
        expect(store.groupBy).toEqual(before);
    });

    it("ignores out-of-range slot indices", () => {
        const store = useCardStore();
        const before = [...store.groupBy];
        store.setGroupLevel(99, "color");
        store.setGroupLevel(-1, "color");
        expect(store.groupBy).toEqual(before);
    });
});

describe("useCardStore - basic lands", () => {
    it("adjusts basic land counts", () => {
        const store = useCardStore();
        store.adjustBasicLand("G", 5);
        expect(store.basicLands.G).toBe(5);
        expect(store.basicLandTotal).toBe(5);
        store.adjustBasicLand("G", -2);
        expect(store.basicLands.G).toBe(3);
    });

    it("clamps basic land counts to zero", () => {
        const store = useCardStore();
        store.adjustBasicLand("G", -5);
        expect(store.basicLands.G).toBe(0);
    });

    it("ignores invalid colors", () => {
        const store = useCardStore();
        store.adjustBasicLand("X", 5);
        store.setBasicLand("X", 9);
        expect(store.basicLands.G).toBe(0);
    });

    it("setBasicLand sets exact value, clamped at zero and floored", () => {
        const store = useCardStore();
        store.setBasicLand("R", 7);
        expect(store.basicLands.R).toBe(7);
        store.setBasicLand("R", -1);
        expect(store.basicLands.R).toBe(0);
        store.setBasicLand("R", 3.9);
        expect(store.basicLands.R).toBe(3);
    });
});

describe("useCardStore - deck size", () => {
    it("accepts 40 and 60 only", () => {
        const store = useCardStore();
        store.setDeckSize(60);
        expect(store.deckSize).toBe(60);
        store.setDeckSize(40);
        expect(store.deckSize).toBe(40);
        store.setDeckSize(75);
        expect(store.deckSize).toBe(40);
    });
});

describe("useCardStore - sealed pool import", () => {
    let store;
    beforeEach(() => {
        store = useCardStore();
        store.allCards = [
            makeCard({ name: "Lightning Bolt" }),
            makeCard({
                name: "Wrath of God",
                colors: "W",
                type: "Sorcery",
                mainType: "Sorcery",
                cmc: 4,
                sets: [{ code: "LEA", uuid: "wrath-lea", num: "1", rarity: "rare" }],
                bestSet: "LEA",
                uuid: "wrath-lea",
                rarity: "rare",
            }),
        ];
    });

    it("populates pool from a bracketed-format import", () => {
        store.importSealedPool("3 Lightning Bolt [LEA:161]\n10 Forest");
        expect(store.sealedMode).toBe(true);
        expect(store.sealedPool.length).toBe(3);
        expect(store.basicLands.G).toBe(10);
        expect(store.hasImportedPool).toBe(true);
    });

    it("starts main-section cards in the deck", () => {
        store.importSealedPool("2 Lightning Bolt [LEA:161]\nSB: 1 Lightning Bolt [LEA:161]");
        expect(store.sealedPool.length).toBe(3);
        expect(store.deckIds.size).toBe(2);
    });

    it("records unmatched names as errors", () => {
        store.importSealedPool("1 Imaginary Card [LEA:1]");
        expect(store.importErrors.length).toBeGreaterThan(0);
        expect(store.importErrors[0].reason).toBe("unmatched");
    });

    it("does nothing when nothing in the import resolves", () => {
        store.importSealedPool("1 Imaginary Card [LEA:1]");
        expect(store.sealedMode).toBe(false);
        expect(store.sealedPool.length).toBe(0);
    });
});

describe("useCardStore - deck building", () => {
    let store;
    beforeEach(() => {
        store = useCardStore();
        store.allCards = [makeCard({ name: "Lightning Bolt" })];
        store.importSealedPool("4 Lightning Bolt [LEA:161]");
        // After importSealedPool, all main-section pool ids are in the deck
        store.clearDeck();
    });

    it("addCardToDeck adds the first available pool id and ignores duplicates", () => {
        const stack = store.poolStacks[0];
        store.addCardToDeck(stack.poolIds);
        expect(store.deckIds.size).toBe(1);
        store.addCardToDeck(stack.poolIds);
        expect(store.deckIds.size).toBe(2);
    });

    it("removeCardFromDeck removes the last-added id (iterating from end)", () => {
        const stack = store.poolStacks[0];
        store.addCardToDeck(stack.poolIds);
        store.addCardToDeck(stack.poolIds);
        const before = new Set(store.deckIds);
        store.removeCardFromDeck(stack.poolIds);
        expect(store.deckIds.size).toBe(1);
        expect(store.deckIds.size).toBeLessThan(before.size);
    });

    it("addPoolIdsToDeck adds many ids in one go", () => {
        const stack = store.poolStacks[0];
        store.addPoolIdsToDeck(stack.poolIds.slice(0, 3));
        expect(store.deckIds.size).toBe(3);
    });

    it("removePoolIdsFromDeck removes many ids in one go", () => {
        const stack = store.poolStacks[0];
        store.addPoolIdsToDeck(stack.poolIds);
        store.removePoolIdsFromDeck(stack.poolIds.slice(0, 2));
        expect(store.deckIds.size).toBe(2);
    });

    it("clearDeck empties deckIds and basics", () => {
        const stack = store.poolStacks[0];
        store.addPoolIdsToDeck(stack.poolIds);
        store.adjustBasicLand("G", 4);
        store.clearDeck();
        expect(store.deckIds.size).toBe(0);
        expect(store.basicLandTotal).toBe(0);
    });
});

describe("useCardStore - synthetic adds from database", () => {
    let store;
    beforeEach(() => {
        store = useCardStore();
        store.allCards = [makeCard({ name: "Lightning Bolt" })];
    });

    it("addCardFromDatabase appends a synthetic pool entry and adds to deck", () => {
        store.addCardFromDatabase(store.allCards[0]);
        expect(store.sealedPool.length).toBe(1);
        expect(store.sealedPool[0].synthetic).toBe(true);
        expect(store.deckIds.size).toBe(1);
        expect(store.hasImportedPool).toBe(false);
    });

    it("removeOneByCard removes a synthetic copy first and prunes the pool", () => {
        store.addCardFromDatabase(store.allCards[0]);
        store.addCardFromDatabase(store.allCards[0]);
        expect(store.sealedPool.length).toBe(2);
        store.removeOneByCard(store.allCards[0]);
        expect(store.sealedPool.length).toBe(1);
        expect(store.deckIds.size).toBe(1);
    });

    it("removeOneByCard is a no-op for an unknown card", () => {
        store.removeOneByCard({ name: "Nothing" });
        expect(store.deckIds.size).toBe(0);
    });

    it("deckCountByName aggregates copies by name", () => {
        store.addCardFromDatabase(store.allCards[0]);
        store.addCardFromDatabase(store.allCards[0]);
        expect(store.deckCountByName.get("Lightning Bolt")).toBe(2);
    });
});

describe("useCardStore - mana curve", () => {
    let store;
    beforeEach(() => {
        store = useCardStore();
        const c1 = makeCard({ name: "A", cmc: 1, colors: "R" });
        const c2 = makeCard({ name: "B", cmc: 1, colors: "U" });
        const c3 = makeCard({ name: "C", cmc: 4, colors: "WB" });
        const c4 = makeCard({ name: "D", cmc: 8, colors: "" });
        const land = makeCard({ name: "L", cmc: 0, colors: "", mainType: "Land", type: "Basic Land" });
        store.allCards = [c1, c2, c3, c4, land];
        for (const c of store.allCards) store.addCardFromDatabase(c);
    });

    it("buckets non-land cards by cmc", () => {
        expect(store.manaCurve["1"].count).toBe(2);
        expect(store.manaCurve["4"].count).toBe(1);
        expect(store.manaCurve["7+"].count).toBe(1);
    });

    it("ignores lands in the mana curve", () => {
        const total = Object.values(store.manaCurve).reduce((s, b) => s + b.count, 0);
        expect(total).toBe(4);
    });

    it("tags multicolor and colorless buckets correctly", () => {
        expect(store.manaCurve["4"].colors.multi).toBe(1);
        expect(store.manaCurve["7+"].colors.C).toBe(1);
        expect(store.manaCurve["1"].colors.R).toBe(1);
        expect(store.manaCurve["1"].colors.U).toBe(1);
    });
});

describe("useCardStore - type curve", () => {
    let store;
    beforeEach(() => {
        store = useCardStore();
        store.allCards = [
            makeCard({ name: "Bolt", type: "Instant", mainType: "Instant", colors: "R" }),
            makeCard({ name: "Goblin", type: "Creature — Goblin", mainType: "Creature", colors: "R" }),
        ];
        for (const c of store.allCards) store.addCardFromDatabase(c);
        store.adjustBasicLand("G", 5);
    });

    it("buckets cards by type", () => {
        expect(store.typeCurve.Creature.count).toBe(1);
        expect(store.typeCurve.Instant.count).toBe(1);
    });

    it("adds basic lands into the Land bucket", () => {
        expect(store.typeCurve.Land.count).toBe(5);
        expect(store.typeCurve.Land.colors.G).toBe(5);
    });
});

describe("useCardStore - deck totals", () => {
    let store;
    beforeEach(() => {
        store = useCardStore();
        store.allCards = [
            makeCard({ name: "Bolt", colors: "R" }),
            makeCard({ name: "Forest", mainType: "Land", type: "Basic Land — Forest" }),
        ];
        for (const c of store.allCards) store.addCardFromDatabase(c);
        store.adjustBasicLand("R", 3);
    });

    it("counts non-land, pool-land, and basic lands separately", () => {
        expect(store.deckNonLandCount).toBe(1);
        expect(store.deckPoolLandCount).toBe(1);
        expect(store.basicLandTotal).toBe(3);
        expect(store.deckLandCount).toBe(4);
        expect(store.deckTotal).toBe(5);
    });
});
