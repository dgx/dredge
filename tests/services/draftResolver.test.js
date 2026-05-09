import { describe, it, expect, beforeEach } from "vitest";
import {
    buildScryfallIndex,
    resolveDraftCard,
    resolvePack,
    _resetPoolCounter,
} from "../../src/services/draftResolver.js";

function makeLocalCards() {
    return [
        {
            name: "Lightning Bolt",
            text: "Lightning Bolt deals 3 damage.",
            manaCost: "R",
            cmc: 1,
            type: "Instant",
            colors: "R",
            sets: [
                { code: "LEA", uuid: "scry-lea-bolt", num: "161", rarity: "common", picUrl: "" },
                { code: "M11", uuid: "scry-m11-bolt", num: "146", rarity: "common", picUrl: "" },
            ],
            bestSet: "LEA",
            uuid: "scry-lea-bolt",
            rarity: "common",
        },
    ];
}

beforeEach(() => _resetPoolCounter());

describe("buildScryfallIndex", () => {
    it("indexes every printing", () => {
        const idx = buildScryfallIndex(makeLocalCards());
        expect(idx.size).toBe(2);
        expect(idx.has("scry-lea-bolt")).toBe(true);
        expect(idx.has("scry-m11-bolt")).toBe(true);
    });
});

describe("resolveDraftCard", () => {
    it("resolves to local printing by scryfallId, restricting sets[] to that printing", () => {
        const idx = buildScryfallIndex(makeLocalCards());
        const packCard = {
            mtgjsonUuid: "mtg-1",
            scryfallId: "scry-m11-bolt",
            name: "Lightning Bolt",
            number: "146",
            rarity: "common",
            colors: ["R"],
            isFoil: false,
            isBonusSheet: false,
            slot: "common",
        };
        const entry = resolveDraftCard(packCard, "M11", idx);
        expect(entry.uuid).toBe("scry-m11-bolt"); // image lookup uses M11 printing
        expect(entry.bestSet).toBe("M11");
        expect(entry.sets).toHaveLength(1);
        expect(entry.sets[0].code).toBe("M11");
        expect(entry.poolSetCode).toBe("M11");
        expect(entry.poolNumber).toBe("146");
        expect(entry.poolFoil).toBe(false);
        expect(entry.draftMeta.slot).toBe("common");
        expect(entry.draftMeta.fromSet).toBe("M11");
        expect(entry.poolId).toMatch(/^draft-\d+$/);
    });

    it("synthesizes a placeholder when card is missing from local DB", () => {
        const idx = buildScryfallIndex([]);
        const packCard = {
            mtgjsonUuid: "mtg-x",
            scryfallId: "scry-mystery",
            name: "Card from new set",
            number: "5",
            rarity: "rare",
            colors: ["U", "B"],
            isFoil: true,
            isBonusSheet: false,
            slot: "rareMythic",
        };
        const entry = resolveDraftCard(packCard, "ZZZ", idx);
        expect(entry.name).toBe("Card from new set");
        expect(entry.uuid).toBe("scry-mystery"); // image loader can still try Scryfall
        expect(entry.colors).toBe("UB");
        expect(entry.bestSet).toBe("ZZZ");
        expect(entry.poolFoil).toBe(true);
        expect(entry.rarity).toBe("rare");
        expect(entry.sets[0].code).toBe("ZZZ");
        expect(entry.sets[0].num).toBe("5");
    });

    it("propagates foil and bonus-sheet flags into draftMeta", () => {
        const idx = buildScryfallIndex(makeLocalCards());
        const packCard = {
            scryfallId: "scry-lea-bolt",
            name: "Lightning Bolt",
            number: "161",
            rarity: "common",
            colors: ["R"],
            isFoil: true,
            isBonusSheet: true,
            slot: "specialGuest",
        };
        const entry = resolveDraftCard(packCard, "LEA", idx);
        expect(entry.poolFoil).toBe(true);
        expect(entry.draftMeta.isFoil).toBe(true);
        expect(entry.draftMeta.isBonusSheet).toBe(true);
    });

    it("assigns a unique poolId per call", () => {
        const idx = buildScryfallIndex(makeLocalCards());
        const a = resolveDraftCard(
            { scryfallId: "scry-lea-bolt", name: "Lightning Bolt", number: "161", rarity: "common", slot: "common", colors: [] },
            "LEA",
            idx
        );
        const b = resolveDraftCard(
            { scryfallId: "scry-lea-bolt", name: "Lightning Bolt", number: "161", rarity: "common", slot: "common", colors: [] },
            "LEA",
            idx
        );
        expect(a.poolId).not.toBe(b.poolId);
    });
});

describe("resolvePack", () => {
    it("converts every card in a sim result to a pool entry", () => {
        const idx = buildScryfallIndex(makeLocalCards());
        const pack = {
            cards: [
                { scryfallId: "scry-lea-bolt", name: "Lightning Bolt", number: "161", rarity: "common", colors: ["R"], slot: "common", isFoil: false },
                { scryfallId: "scry-m11-bolt", name: "Lightning Bolt", number: "146", rarity: "common", colors: ["R"], slot: "foil", isFoil: true },
            ],
        };
        const entries = resolvePack(pack, "M11", idx);
        expect(entries).toHaveLength(2);
        // Same priority (both common, neither land/bonus) → stable sort keeps
        // simulator order.
        expect(entries[0].uuid).toBe("scry-lea-bolt");
        expect(entries[1].uuid).toBe("scry-m11-bolt");
        expect(entries[1].poolFoil).toBe(true);
    });

    it("sorts reveal order: lands → common → uncommon → rare → mythic → bonus (climax last)", () => {
        const idx = buildScryfallIndex([]); // synthesize all
        const pack = {
            cards: [
                { scryfallId: "s-common", name: "C", rarity: "common", colors: [], slot: "common" },
                { scryfallId: "s-land", name: "Plains", rarity: "common", colors: [], slot: "nonFoilLand" },
                { scryfallId: "s-mythic", name: "M", rarity: "mythic", colors: [], slot: "rareMythic" },
                { scryfallId: "s-rare", name: "R", rarity: "rare", colors: [], slot: "rareMythic" },
                { scryfallId: "s-uncommon", name: "U", rarity: "uncommon", colors: [], slot: "uncommon" },
                { scryfallId: "s-bonus", name: "B", rarity: "rare", colors: [], slot: "specialGuest", isBonusSheet: true },
            ],
        };
        const entries = resolvePack(pack, "ZZZ", idx);
        expect(entries.map((e) => e.uuid)).toEqual([
            "s-land",
            "s-common",
            "s-uncommon",
            "s-rare",
            "s-mythic",
            "s-bonus",
        ]);
    });

    it("recognizes lands by MTGJSON types even when the card isn't in the local DB", () => {
        // Reproduces the FIN bug: nonbasic lands drawn from `uncommon` /
        // `wildcard` / `rareMythic` slots used to fall through to the rarity
        // bucket because synthesized cards have an empty `type` field. The
        // simulator now propagates MTGJSON `types` and the resolver uses it
        // as the authoritative land signal.
        const idx = buildScryfallIndex([]); // synthesize all
        const pack = {
            cards: [
                { scryfallId: "s-rare-spell", name: "Some Rare Spell", rarity: "rare", colors: [], slot: "rareMythic", types: ["Sorcery"] },
                { scryfallId: "s-capital", name: "Capital City", rarity: "uncommon", colors: [], slot: "uncommon", types: ["Land"] },
                { scryfallId: "s-island", name: "Island", rarity: "common", colors: [], slot: "nonFoilLand", types: ["Land"] },
                { scryfallId: "s-ishgard", name: "Ishgard, the Holy See // Faith & Grief", rarity: "rare", colors: [], slot: "wildcard", types: ["Land", "Sorcery"] },
                { scryfallId: "s-uncommon", name: "Some Uncommon", rarity: "uncommon", colors: [], slot: "uncommon", types: ["Creature"] },
                { scryfallId: "s-common", name: "Some Common", rarity: "common", colors: [], slot: "common", types: ["Instant"] },
            ],
        };
        const entries = resolvePack(pack, "FIN", idx);
        // All three lands flip first (priority 10), then common, uncommon, rare.
        const order = entries.map((e) => e.uuid);
        // Lands grouped at the front (any internal order is fine, simulator order preserved).
        expect(order.slice(0, 3).sort()).toEqual(
            ["s-capital", "s-ishgard", "s-island"].sort()
        );
        expect(order[3]).toBe("s-common");
        expect(order[4]).toBe("s-uncommon");
        expect(order[5]).toBe("s-rare-spell"); // climax (only true non-land rare)
    });

    it("recognizes lands by card.type when slot doesn't tag them", () => {
        // A card whose slot is just "common" but whose type says Land — still
        // flips first as throwaway.
        const localCards = [
            {
                name: "Evolving Wilds",
                type: "Land",
                mainType: "Land",
                manaCost: "",
                cmc: 0,
                colors: "",
                sets: [{ code: "ZZZ", uuid: "s-evolving", num: "1", rarity: "common" }],
                bestSet: "ZZZ",
                uuid: "s-evolving",
                rarity: "common",
            },
        ];
        const idx = buildScryfallIndex(localCards);
        const pack = {
            cards: [
                { scryfallId: "s-other", name: "Spell", rarity: "common", colors: [], slot: "common" },
                { scryfallId: "s-evolving", name: "Evolving Wilds", number: "1", rarity: "common", colors: [], slot: "common" },
            ],
        };
        const entries = resolvePack(pack, "ZZZ", idx);
        expect(entries[0].uuid).toBe("s-evolving");
        expect(entries[1].uuid).toBe("s-other");
    });
});
