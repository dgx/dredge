import { describe, it, expect } from "vitest";
import {
    pickBoosterType,
    listOpenableBoosterTypes,
    isSkippedBoosterType,
    isBonusSheetSlot,
    hasOpenableBooster,
    buildCardIndex,
    mergeCardsIntoIndex,
    collectMissingSheetUuids,
    rollPack,
    rollPacks,
    summarizePackCards,
    makeSeededRng,
    _internals,
} from "../../src/services/boosterSimulator.js";

// Minimal MTGJSON-shaped fixture. 5 commons (one per color so balanceColors has
// material to work with), 3 uncommons, 2 rares, 1 mythic, 1 bonus-sheet card.
function makeFixtureSet() {
    const cards = [
        { uuid: "c-w", name: "White Common", colors: ["W"], rarity: "common", identifiers: { scryfallId: "sc-w" } },
        { uuid: "c-u", name: "Blue Common", colors: ["U"], rarity: "common", identifiers: { scryfallId: "sc-u" } },
        { uuid: "c-b", name: "Black Common", colors: ["B"], rarity: "common", identifiers: { scryfallId: "sc-b" } },
        { uuid: "c-r", name: "Red Common", colors: ["R"], rarity: "common", identifiers: { scryfallId: "sc-r" } },
        { uuid: "c-g", name: "Green Common", colors: ["G"], rarity: "common", identifiers: { scryfallId: "sc-g" } },
        { uuid: "u-1", name: "Uncommon One", colors: ["W"], rarity: "uncommon", identifiers: { scryfallId: "su1" } },
        { uuid: "u-2", name: "Uncommon Two", colors: ["U"], rarity: "uncommon", identifiers: { scryfallId: "su2" } },
        { uuid: "u-3", name: "Uncommon Three", colors: ["B"], rarity: "uncommon", identifiers: { scryfallId: "su3" } },
        { uuid: "r-1", name: "Rare One", colors: ["R"], rarity: "rare", identifiers: { scryfallId: "sr1" } },
        { uuid: "r-2", name: "Rare Two", colors: ["G"], rarity: "rare", identifiers: { scryfallId: "sr2" } },
        { uuid: "m-1", name: "Mythic One", colors: ["W", "U"], rarity: "mythic", identifiers: { scryfallId: "sm1" } },
        { uuid: "sg-1", name: "Special Guest", colors: ["U"], rarity: "rare", identifiers: { scryfallId: "ssg1" } },
    ];

    const booster = {
        draft: {
            boostersTotalWeight: 1,
            boosters: [
                {
                    weight: 1,
                    contents: {
                        common: 5,
                        uncommon: 3,
                        rareMythic: 1,
                        specialGuest: 1,
                    },
                },
            ],
            sheets: {
                common: {
                    totalWeight: 5,
                    balanceColors: true,
                    cards: { "c-w": 1, "c-u": 1, "c-b": 1, "c-r": 1, "c-g": 1 },
                },
                uncommon: {
                    totalWeight: 3,
                    cards: { "u-1": 1, "u-2": 1, "u-3": 1 },
                },
                rareMythic: {
                    // Real ratio in MTGJSON — rares twice as common as mythics.
                    totalWeight: 5,
                    cards: { "r-1": 2, "r-2": 2, "m-1": 1 },
                },
                specialGuest: {
                    totalWeight: 1,
                    foil: true,
                    cards: { "sg-1": 1 },
                },
            },
        },
        collector: {
            boosters: [{ weight: 1, contents: { common: 1 } }],
            sheets: { common: { totalWeight: 1, cards: { "c-w": 1 } } },
        },
    };

    return { cards, booster };
}

describe("isSkippedBoosterType", () => {
    it("flags prerelease / bundle / promo variants", () => {
        expect(isSkippedBoosterType("prerelease")).toBe(true);
        expect(isSkippedBoosterType("bundle-promo")).toBe(true);
        expect(isSkippedBoosterType("chocobo-bundle")).toBe(true);
    });

    it("does not flag draft/play/default/collector", () => {
        expect(isSkippedBoosterType("draft")).toBe(false);
        expect(isSkippedBoosterType("play")).toBe(false);
        expect(isSkippedBoosterType("default")).toBe(false);
        expect(isSkippedBoosterType("collector")).toBe(false);
    });
});

describe("isBonusSheetSlot", () => {
    it("recognizes bonus-sheet slot names", () => {
        expect(isBonusSheetSlot("specialGuest")).toBe(true);
        expect(isBonusSheetSlot("throughTheAges")).toBe(true);
        expect(isBonusSheetSlot("theList")).toBe(true);
    });

    it("rejects regular slot names", () => {
        expect(isBonusSheetSlot("common")).toBe(false);
        expect(isBonusSheetSlot("uncommon")).toBe(false);
        expect(isBonusSheetSlot("foil")).toBe(false);
        expect(isBonusSheetSlot("rareMythic")).toBe(false);
    });
});

describe("pickBoosterType", () => {
    it("prefers draft over play / collector", () => {
        const root = { collector: {}, play: {}, draft: {} };
        expect(pickBoosterType(root)).toBe("draft");
    });

    it("falls back to play if no draft", () => {
        const root = { collector: {}, play: {} };
        expect(pickBoosterType(root)).toBe("play");
    });

    it("never picks a skipped type if a usable one exists", () => {
        const root = { collector: {}, prerelease: {}, default: {} };
        expect(pickBoosterType(root)).toBe("default");
    });

    it("returns null for empty input", () => {
        expect(pickBoosterType({})).toBe(null);
        expect(pickBoosterType(null)).toBe(null);
    });

    it("honors a hint when valid", () => {
        const root = { draft: {}, play: {} };
        expect(pickBoosterType(root, "play")).toBe("play");
    });

    it("ignores an invalid hint and falls back", () => {
        const root = { draft: {}, play: {} };
        expect(pickBoosterType(root, "collector")).toBe("draft");
    });
});

describe("listOpenableBoosterTypes", () => {
    it("orders by preference; collector now passes through, prerelease still skipped", () => {
        const root = { collector: {}, play: {}, draft: {}, prerelease: {} };
        expect(listOpenableBoosterTypes(root)).toEqual(["draft", "play", "collector"]);
    });
});

describe("hasOpenableBooster", () => {
    it("true when set has a usable booster type", () => {
        const { booster, cards } = makeFixtureSet();
        expect(hasOpenableBooster({ booster, cards })).toBe(true);
    });

    it("true when only collector is present (collector is allowed)", () => {
        expect(hasOpenableBooster({ booster: { collector: {} } })).toBe(true);
    });

    it("false when only prerelease is present", () => {
        expect(hasOpenableBooster({ booster: { prerelease: {} } })).toBe(false);
    });

    it("false when booster object is empty or missing", () => {
        expect(hasOpenableBooster({ booster: {} })).toBe(false);
        expect(hasOpenableBooster({})).toBe(false);
    });
});

describe("rollPack", () => {
    it("produces the slot counts described in the config", () => {
        const { booster, cards } = makeFixtureSet();
        const idx = buildCardIndex(cards);
        const pack = rollPack(booster, "draft", idx, makeSeededRng(1));
        // Config: 5 common + 3 uncommon + 1 rareMythic + 1 specialGuest = 10
        expect(pack.cards).toHaveLength(10);
        const bySlot = pack.cards.reduce((acc, c) => {
            acc[c.slot] = (acc[c.slot] || 0) + 1;
            return acc;
        }, {});
        expect(bySlot).toEqual({ common: 5, uncommon: 3, rareMythic: 1, specialGuest: 1 });
    });

    it("balanceColors picks one of each WUBRG when sheet has 5 mono-colored commons", () => {
        const { booster, cards } = makeFixtureSet();
        const idx = buildCardIndex(cards);
        // Run several seeds — every common slot should always have exactly one of each color.
        for (let seed = 1; seed <= 20; seed++) {
            const pack = rollPack(booster, "draft", idx, makeSeededRng(seed));
            const commonColors = pack.cards
                .filter((c) => c.slot === "common")
                .map((c) => c.colors[0]);
            expect(commonColors.sort().join("")).toBe("BGRUW");
        }
    });

    it("marks specialGuest cards as bonus sheet", () => {
        const { booster, cards } = makeFixtureSet();
        const idx = buildCardIndex(cards);
        const pack = rollPack(booster, "draft", idx, makeSeededRng(42));
        const guest = pack.cards.find((c) => c.slot === "specialGuest");
        expect(guest).toBeDefined();
        expect(guest.isBonusSheet).toBe(true);
        expect(guest.isFoil).toBe(true);
        expect(pack.hasBonusSheet).toBe(true);
        expect(pack.rarestTier).toBe("bonus");
    });

    it("attaches scryfallId pulled from card.identifiers", () => {
        const { booster, cards } = makeFixtureSet();
        const idx = buildCardIndex(cards);
        const pack = rollPack(booster, "draft", idx, makeSeededRng(7));
        for (const c of pack.cards) {
            expect(c.scryfallId).toMatch(/^s/);
        }
    });

    it("is deterministic with a seeded RNG", () => {
        const { booster, cards } = makeFixtureSet();
        const idx = buildCardIndex(cards);
        const a = rollPack(booster, "draft", idx, makeSeededRng(123));
        const b = rollPack(booster, "draft", idx, makeSeededRng(123));
        expect(a.cards.map((c) => c.mtgjsonUuid)).toEqual(b.cards.map((c) => c.mtgjsonUuid));
    });

    it("throws when booster type is unknown", () => {
        const { booster, cards } = makeFixtureSet();
        const idx = buildCardIndex(cards);
        expect(() => rollPack(booster, "nonsense", idx, makeSeededRng(1))).toThrow();
    });

    it("rareMythic slot eventually rolls a mythic across many seeds", () => {
        // Sanity: with rare:rare:mythic = 2:2:1 weights, a mythic should appear in
        // some packs across 200 seeds. This validates the weighted picker.
        const { booster, cards } = makeFixtureSet();
        const idx = buildCardIndex(cards);
        let mythicSeen = false;
        let rareSeen = false;
        for (let seed = 1; seed <= 200 && !(mythicSeen && rareSeen); seed++) {
            const pack = rollPack(booster, "draft", idx, makeSeededRng(seed));
            const slot = pack.cards.find((c) => c.slot === "rareMythic");
            if (slot.rarity === "mythic") mythicSeen = true;
            if (slot.rarity === "rare") rareSeen = true;
        }
        expect(mythicSeen).toBe(true);
        expect(rareSeen).toBe(true);
    });
});

describe("rollPacks", () => {
    it("returns the requested count of packs", () => {
        const { booster, cards } = makeFixtureSet();
        const idx = buildCardIndex(cards);
        const packs = rollPacks(booster, "draft", idx, 6, makeSeededRng(1));
        expect(packs).toHaveLength(6);
        for (const p of packs) expect(p.cards.length).toBe(10);
    });
});

describe("summarizePackCards", () => {
    it("returns the highest tier present", () => {
        expect(summarizePackCards([{ rarity: "common", isBonusSheet: false }])).toBe("common");
        expect(
            summarizePackCards([
                { rarity: "common", isBonusSheet: false },
                { rarity: "rare", isBonusSheet: false },
            ])
        ).toBe("rare");
        expect(
            summarizePackCards([
                { rarity: "mythic", isBonusSheet: false },
                { rarity: "common", isBonusSheet: true },
            ])
        ).toBe("bonus");
    });
});

describe("collectMissingSheetUuids", () => {
    it("returns the set of UUIDs in any sheet that aren't in the cardIndex", () => {
        const { booster } = makeFixtureSet();
        // Pretend the parent set is missing the special-guest card — that's
        // exactly the TLA → TLE situation: sheet references a UUID that lives
        // in another set's card list.
        const partialCards = [
            { uuid: "c-w", rarity: "common" },
            { uuid: "u-1", rarity: "uncommon" },
            { uuid: "r-1", rarity: "rare" },
        ];
        const idx = buildCardIndex(partialCards);
        const missing = collectMissingSheetUuids(booster, idx);
        expect(missing.has("sg-1")).toBe(true);
        expect(missing.has("c-u")).toBe(true);
        expect(missing.has("c-w")).toBe(false);
    });

    it("returns an empty set when every sheet UUID is resolvable", () => {
        const { booster, cards } = makeFixtureSet();
        const idx = buildCardIndex(cards);
        expect(collectMissingSheetUuids(booster, idx).size).toBe(0);
    });

    it("ignores non-openable booster types when walking sheets", () => {
        // A prerelease-only booster references absent-uuid, but prerelease is
        // skipped — the walker should not flag the missing uuid.
        const booster = {
            prerelease: {
                boosters: [{ weight: 1, contents: { common: 1 } }],
                sheets: { common: { totalWeight: 1, cards: { "absent-uuid": 1 } } },
            },
        };
        const idx = buildCardIndex([]);
        expect(collectMissingSheetUuids(booster, idx).size).toBe(0);
    });
});

describe("mergeCardsIntoIndex", () => {
    it("adds cards from a supplemental set without overwriting existing entries", () => {
        const idx = buildCardIndex([
            { uuid: "a", name: "Primary A" },
        ]);
        mergeCardsIntoIndex(idx, [
            { uuid: "a", name: "Supplemental A (should not win)" },
            { uuid: "b", name: "Supplemental B" },
        ]);
        expect(idx.get("a").name).toBe("Primary A");
        expect(idx.get("b").name).toBe("Supplemental B");
    });

    it("is a no-op for non-array input", () => {
        const idx = buildCardIndex([{ uuid: "a" }]);
        mergeCardsIntoIndex(idx, null);
        mergeCardsIntoIndex(idx, undefined);
        expect(idx.size).toBe(1);
    });
});

describe("internals", () => {
    it("pickWeighted respects weights statistically", () => {
        const items = [
            { value: "A", weight: 1 },
            { value: "B", weight: 9 },
        ];
        const rng = makeSeededRng(1);
        const counts = { A: 0, B: 0 };
        for (let i = 0; i < 1000; i++) counts[_internals.pickWeighted(items, rng)]++;
        // Expect ~10% A, ~90% B. Allow a generous margin.
        expect(counts.A).toBeGreaterThan(50);
        expect(counts.A).toBeLessThan(200);
    });
});
