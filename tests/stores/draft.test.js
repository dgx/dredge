import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDraftStore } from "../../src/stores/draft.js";
import { useCardStore } from "../../src/stores/cards.js";
import { _resetCache } from "../../src/services/boosterData.js";
import { _resetPoolCounter } from "../../src/services/draftResolver.js";

// Minimal MTGJSON-shaped fixture for set MOCK with one common card.
function makeSetData(code) {
    return {
        code,
        cards: [
            {
                uuid: `mtg-${code}-1`,
                name: `${code} Bolt`,
                rarity: "common",
                colors: ["R"],
                identifiers: { scryfallId: `scry-${code}-1` },
            },
            {
                uuid: `mtg-${code}-2`,
                name: `${code} Counterspell`,
                rarity: "common",
                colors: ["U"],
                identifiers: { scryfallId: `scry-${code}-2` },
            },
        ],
        booster: {
            draft: {
                boosters: [{ weight: 1, contents: { common: 2 } }],
                sheets: {
                    common: {
                        totalWeight: 2,
                        cards: { [`mtg-${code}-1`]: 1, [`mtg-${code}-2`]: 1 },
                    },
                },
            },
        },
    };
}

function makeNoBoosterSet(code) {
    return {
        code,
        cards: [],
        booster: {},
    };
}

function installFakeElectron(setListEntries, setDataMap) {
    if (typeof globalThis.window === "undefined") globalThis.window = {};
    globalThis.window.electronAPI = {
        async fetchMtgjsonSetList() {
            return { data: setListEntries };
        },
        async fetchMtgjsonSet(code) {
            const data = setDataMap[code];
            if (!data) throw new Error(`No mock data for ${code}`);
            return { data };
        },
    };
}

beforeEach(() => {
    setActivePinia(createPinia());
    _resetCache();
    _resetPoolCounter();
    if (typeof globalThis.window === "undefined") globalThis.window = {};
    delete globalThis.window.electronAPI;
});

describe("useDraftStore - selections", () => {
    it("starts with one empty selection", () => {
        const store = useDraftStore();
        expect(store.selections).toHaveLength(1);
        expect(store.selections[0].setCode).toBe("");
    });

    it("can add as many selections as the user wants (no upper cap)", () => {
        const store = useDraftStore();
        for (let i = 0; i < 6; i++) store.addSelection();
        expect(store.selections).toHaveLength(7);
        expect(store.canAddSelection).toBe(true);
    });

    it("can remove selections but never to zero", () => {
        const store = useDraftStore();
        store.addSelection();
        const id = store.selections[0].id;
        store.removeSelection(id);
        expect(store.selections).toHaveLength(1);
        store.removeSelection(store.selections[0].id);
        expect(store.selections).toHaveLength(1);
    });

    it("updates selection fields immutably", () => {
        const store = useDraftStore();
        const id = store.selections[0].id;
        store.updateSelection(id, { setCode: "ABC", count: 9 });
        expect(store.selections[0].setCode).toBe("ABC");
        expect(store.selections[0].count).toBe(9);
    });

    it("totalPacks sums selection counts", () => {
        const store = useDraftStore();
        store.updateSelection(store.selections[0].id, { setCode: "A", count: 6 });
        store.addSelection();
        store.updateSelection(store.selections[1].id, { setCode: "B", count: 3 });
        expect(store.totalPacks).toBe(9);
    });

    it("canStart only when at least one selection has setCode + count > 0", () => {
        const store = useDraftStore();
        expect(store.canStart).toBe(false);
        store.updateSelection(store.selections[0].id, { setCode: "A", count: 0 });
        expect(store.canStart).toBe(false);
        store.updateSelection(store.selections[0].id, { count: 4 });
        expect(store.canStart).toBe(true);
    });
});

describe("useDraftStore - loading set options", () => {
    it("filters online-only and empty sets and sorts newest first", async () => {
        installFakeElectron(
            [
                { code: "OLD", name: "Old Set", type: "expansion", releaseDate: "2010-01-01", baseSetSize: 200 },
                { code: "NEW", name: "New Set", type: "expansion", releaseDate: "2025-09-27", baseSetSize: 250 },
                { code: "WEB", name: "Online Only", type: "expansion", releaseDate: "2020-01-01", baseSetSize: 100, isOnlineOnly: true },
                { code: "PROMO", name: "Promos", type: "promo", releaseDate: "2024-01-01", baseSetSize: 30 },
                { code: "EMPTY", name: "Empty Set", type: "expansion", releaseDate: "2024-01-01", baseSetSize: 0 },
            ],
            {}
        );
        const store = useDraftStore();
        await store.loadSetOptions();
        expect(store.setOptionsLoaded).toBe(true);
        const codes = store.setOptions.map((s) => s.code);
        expect(codes).toEqual(["NEW", "OLD"]);
    });

    it("captures errors", async () => {
        if (typeof globalThis.window === "undefined") globalThis.window = {};
        globalThis.window.electronAPI = {
            async fetchMtgjsonSetList() {
                throw new Error("offline");
            },
        };
        const store = useDraftStore();
        await store.loadSetOptions();
        expect(store.setOptionsError).toBe("offline");
    });
});

describe("useDraftStore - startDraft", () => {
    it("rolls all packs and transitions phase to opening", async () => {
        installFakeElectron(
            [{ code: "MOCK", name: "Mock Set", type: "expansion", releaseDate: "2024-01-01", baseSetSize: 2 }],
            { MOCK: makeSetData("MOCK") }
        );

        const cards = useCardStore();
        cards.allCards = []; // Empty local DB → resolver will synthesize.

        const store = useDraftStore();
        store.updateSelection(store.selections[0].id, { setCode: "MOCK", count: 4 });
        await store.startDraft();

        expect(store.phase).toBe("opening");
        expect(store.packQueue).toHaveLength(4);
        expect(store.currentPackIndex).toBe(0);
        // Each pack rolled 2 commons.
        for (const p of store.packQueue) {
            expect(p.simResult.cards).toHaveLength(2);
        }
    });

    it("pulls in a child set when sheets reference UUIDs not in the parent", async () => {
        // Mirrors the TLA → TLE scenario: parent's bonus sheet references UUIDs
        // that live in a sibling set. Without resolving the child set, those
        // cards would surface as "Unknown Card".
        const parent = {
            code: "PAR",
            cards: [
                { uuid: "p-1", name: "Parent Common", rarity: "common", colors: ["W"], identifiers: { scryfallId: "sp1" } },
            ],
            booster: {
                draft: {
                    boosters: [{ weight: 1, contents: { common: 1, bonusSheet: 1 } }],
                    sheets: {
                        common: { totalWeight: 1, cards: { "p-1": 1 } },
                        // bonusSheet's UUID lives in CHILD, not PAR.
                        bonusSheet: { totalWeight: 1, cards: { "child-uuid-1": 1 } },
                    },
                },
            },
        };
        const child = {
            code: "CHILD",
            cards: [
                { uuid: "child-uuid-1", name: "From Child Set", rarity: "rare", colors: ["B"], identifiers: { scryfallId: "schild1" } },
            ],
            booster: {},
        };
        installFakeElectron(
            [
                { code: "PAR", name: "Parent", type: "expansion", releaseDate: "2025-01-01", baseSetSize: 1 },
                { code: "CHILD", name: "Child", type: "eternal", releaseDate: "2025-01-01", baseSetSize: 1, parentCode: "PAR" },
            ],
            { PAR: parent, CHILD: child }
        );

        const cards = useCardStore();
        cards.allCards = [];
        const store = useDraftStore();
        store.updateSelection(store.selections[0].id, { setCode: "PAR", count: 1 });
        await store.startDraft();

        expect(store.phase).toBe("opening");
        const pack = store.packQueue[0];
        const bonus = pack.simResult.cards.find((c) => c.slot === "bonusSheet");
        expect(bonus).toBeDefined();
        expect(bonus.name).toBe("From Child Set");
        expect(bonus.rarity).toBe("rare");
    });

    it("falls back to same-release-window masterpiece sets when no parentCode link exists", async () => {
        // Mirrors the SPM → MAR case: SPM's sourceMaterial sheet references
        // cards in MAR (Marvel Universe), but MAR has no parentCode pointing
        // at SPM. The supplemental search has to widen to release-window peers
        // of the right type (masterpiece) to find them.
        const parent = {
            code: "EXP",
            cards: [
                { uuid: "exp-1", name: "Expansion Common", rarity: "common", colors: ["W"], identifiers: { scryfallId: "se1" } },
            ],
            booster: {
                draft: {
                    boosters: [{ weight: 1, contents: { common: 1, bonusSheet: 1 } }],
                    sheets: {
                        common: { totalWeight: 1, cards: { "exp-1": 1 } },
                        bonusSheet: { totalWeight: 1, cards: { "mp-1": 1 } },
                    },
                },
            },
        };
        const masterpiece = {
            code: "MP",
            cards: [
                { uuid: "mp-1", name: "Masterpiece Card", rarity: "mythic", colors: ["U"], identifiers: { scryfallId: "smp1" } },
            ],
            booster: {},
        };
        installFakeElectron(
            [
                { code: "EXP", name: "Expansion", type: "expansion", releaseDate: "2025-09-26", baseSetSize: 1 },
                // No parentCode! Same release week, masterpiece type — should be picked up.
                { code: "MP", name: "Masterpiece Set", type: "masterpiece", releaseDate: "2025-09-23", baseSetSize: 1 },
            ],
            { EXP: parent, MP: masterpiece }
        );

        const cards = useCardStore();
        cards.allCards = [];
        const store = useDraftStore();
        store.updateSelection(store.selections[0].id, { setCode: "EXP", count: 1 });
        await store.startDraft();

        expect(store.phase).toBe("opening");
        const bonus = store.packQueue[0].simResult.cards.find((c) => c.slot === "bonusSheet");
        expect(bonus).toBeDefined();
        expect(bonus.name).toBe("Masterpiece Card");
        expect(bonus.rarity).toBe("mythic");
    });

    it("surfaces an error and stays in setup if a set lacks draftable booster data", async () => {
        installFakeElectron(
            [{ code: "BAD", name: "Bad", type: "expansion", releaseDate: "2024-01-01", baseSetSize: 1 }],
            { BAD: makeNoBoosterSet("BAD") }
        );
        const store = useDraftStore();
        store.updateSelection(store.selections[0].id, { setCode: "BAD", count: 1 });
        await store.startDraft();
        expect(store.phase).toBe("setup");
        expect(store.error).toMatch(/draftable booster data/);
    });
});

describe("useDraftStore - opening packs", () => {
    it("commits pack to pool and advances; finishes after last pack", async () => {
        installFakeElectron(
            [{ code: "MOCK", name: "Mock", type: "expansion", releaseDate: "2024-01-01", baseSetSize: 2 }],
            { MOCK: makeSetData("MOCK") }
        );
        const cards = useCardStore();
        cards.allCards = [];

        const store = useDraftStore();
        store.updateSelection(store.selections[0].id, { setCode: "MOCK", count: 2 });
        await store.startDraft();

        expect(cards.sealedPool).toHaveLength(0);

        // Open pack 1.
        store.commitCurrentPack();
        expect(cards.sealedPool).toHaveLength(2);
        expect(cards.sealedMode).toBe(true);
        expect(store.currentPackIndex).toBe(1);
        expect(store.phase).toBe("opening");

        // Open pack 2 — finishes the draft.
        store.commitCurrentPack();
        expect(cards.sealedPool).toHaveLength(4);
        expect(store.phase).toBe("finished");
    });

    it("resolveCurrentPack returns pool entries with image-ready uuids", async () => {
        installFakeElectron(
            [{ code: "MOCK", name: "Mock", type: "expansion", releaseDate: "2024-01-01", baseSetSize: 2 }],
            { MOCK: makeSetData("MOCK") }
        );
        const cards = useCardStore();
        cards.allCards = [];
        const store = useDraftStore();
        store.updateSelection(store.selections[0].id, { setCode: "MOCK", count: 1 });
        await store.startDraft();
        const resolved = store.resolveCurrentPack();
        expect(resolved).toHaveLength(2);
        for (const entry of resolved) {
            expect(entry.uuid).toMatch(/^scry-MOCK-\d$/);
            expect(entry.poolId).toBeDefined();
            expect(entry.draftMeta.fromSet).toBe("MOCK");
        }
    });
});
