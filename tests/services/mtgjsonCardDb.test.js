import { describe, it, expect } from "vitest";
import { buildSlimDatabase } from "../../electron/cardDbTransform.cjs";
import { SAMPLE_ALL_PRINTINGS } from "../fixtures/sampleDatabase.js";

describe("buildSlimDatabase", () => {
    it("returns empty sets and cards on empty input", () => {
        expect(buildSlimDatabase({})).toEqual({ sets: {}, cards: [] });
        expect(buildSlimDatabase({ data: {} })).toEqual({ sets: {}, cards: [] });
    });

    it("maps every set into the slim sets map", () => {
        const { sets } = buildSlimDatabase(SAMPLE_ALL_PRINTINGS);
        expect(Object.keys(sets).sort()).toEqual(["LEA", "MMQ", "RAV"]);
        expect(sets.LEA).toMatchObject({
            code: "LEA",
            longName: "Limited Edition Alpha",
            type: "core",
            releaseDate: "1993-08-05",
        });
    });

    it("skips token cards", () => {
        const { cards } = buildSlimDatabase(SAMPLE_ALL_PRINTINGS);
        expect(cards.find((c) => c.name === "Pegasus Token")).toBeUndefined();
    });

    it("dedupes cards by name and accumulates printings into sets[]", () => {
        const { cards } = buildSlimDatabase(SAMPLE_ALL_PRINTINGS);
        const bolt = cards.find((c) => c.name === "Lightning Bolt");
        expect(bolt).toBeDefined();
        expect(bolt.sets).toHaveLength(2);
        const codes = bolt.sets.map((s) => s.code).sort();
        expect(codes).toEqual(["LEA", "MMQ"]);
    });

    it("maps each printing's identity fields", () => {
        const { cards } = buildSlimDatabase(SAMPLE_ALL_PRINTINGS);
        const bolt = cards.find((c) => c.name === "Lightning Bolt");
        const lea = bolt.sets.find((s) => s.code === "LEA");
        expect(lea).toMatchObject({
            code: "LEA",
            uuid: "lea-bolt",
            num: "161",
            rarity: "common",
            picUrl: "",
        });
    });

    it("populates the canonical card fields", () => {
        const { cards } = buildSlimDatabase(SAMPLE_ALL_PRINTINGS);
        const bolt = cards.find((c) => c.name === "Lightning Bolt");
        expect(bolt).toMatchObject({
            name: "Lightning Bolt",
            manaCost: "{R}",
            cmc: 1,
            type: "Instant",
            mainType: "Instant",
            colors: "R",
            colorIdentity: "R",
            layout: "normal",
        });
        expect(bolt.text).toContain("3 damage");
    });

    it("picks the most-recent printing as bestSet (and uses its uuid/rarity)", () => {
        const { cards } = buildSlimDatabase(SAMPLE_ALL_PRINTINGS);
        const multi = cards.find((c) => c.name === "Multi Spell");
        // RAV (2005) is newer than MMQ (1999)
        expect(multi.bestSet).toBe("RAV");
        expect(multi.uuid).toBe("rav-multi");
        expect(multi.rarity).toBe("mythic");
    });

    it("normalizes empty mana cost and missing power/toughness", () => {
        const { cards } = buildSlimDatabase(SAMPLE_ALL_PRINTINGS);
        const forest = cards.find((c) => c.name === "Forest");
        expect(forest.manaCost).toBe("");
        expect(forest.cmc).toBe(0);
        expect(forest.mainType).toBe("Land");
        expect(forest.pt).toBe("");
    });

    it("joins multi-color arrays into the legacy concatenated-char shape", () => {
        const { cards } = buildSlimDatabase(SAMPLE_ALL_PRINTINGS);
        const multi = cards.find((c) => c.name === "Multi Spell");
        expect(multi.colors).toBe("UW");
        expect(multi.colorIdentity).toBe("UW");
    });

    it("falls back to convertedManaCost when manaValue is missing", () => {
        const slim = buildSlimDatabase({
            data: {
                X: {
                    code: "X",
                    name: "X Set",
                    releaseDate: "2000-01-01",
                    cards: [
                        {
                            name: "Old Card",
                            convertedManaCost: 3,
                            manaCost: "{1}{R}{R}",
                            type: "Instant",
                            types: ["Instant"],
                            colors: ["R"],
                            colorIdentity: ["R"],
                            layout: "normal",
                            rarity: "common",
                            number: "1",
                            uuid: "x-1",
                        },
                    ],
                },
            },
        });
        expect(slim.cards[0].cmc).toBe(3);
    });

    it("formats power/toughness as 'p/t' when both present", () => {
        const slim = buildSlimDatabase({
            data: {
                X: {
                    code: "X",
                    name: "X",
                    releaseDate: "2000-01-01",
                    cards: [
                        {
                            name: "Goblin Guide",
                            manaCost: "{R}",
                            manaValue: 1,
                            type: "Creature — Goblin",
                            types: ["Creature"],
                            colors: ["R"],
                            colorIdentity: ["R"],
                            layout: "normal",
                            rarity: "rare",
                            number: "1",
                            uuid: "x-gob",
                            power: "2",
                            toughness: "2",
                        },
                    ],
                },
            },
        });
        expect(slim.cards[0].pt).toBe("2/2");
    });

    it("breaks bestSet ties alphabetically by code when releaseDates match", () => {
        const slim = buildSlimDatabase({
            data: {
                BBB: {
                    code: "BBB",
                    name: "B",
                    releaseDate: "2020-01-01",
                    cards: [
                        {
                            name: "Twin",
                            type: "Instant",
                            types: ["Instant"],
                            manaValue: 1,
                            manaCost: "{R}",
                            colors: ["R"],
                            colorIdentity: ["R"],
                            layout: "normal",
                            rarity: "common",
                            number: "1",
                            uuid: "bbb-1",
                            identifiers: { scryfallId: "bbb-1" },
                        },
                    ],
                },
                AAA: {
                    code: "AAA",
                    name: "A",
                    releaseDate: "2020-01-01",
                    cards: [
                        {
                            name: "Twin",
                            type: "Instant",
                            types: ["Instant"],
                            manaValue: 1,
                            manaCost: "{R}",
                            colors: ["R"],
                            colorIdentity: ["R"],
                            layout: "normal",
                            rarity: "common",
                            number: "1",
                            uuid: "aaa-1",
                            identifiers: { scryfallId: "aaa-1" },
                        },
                    ],
                },
            },
        });
        const twin = slim.cards.find((c) => c.name === "Twin");
        expect(twin.bestSet).toBe("AAA");
        expect(twin.uuid).toBe("aaa-1");
    });
});
