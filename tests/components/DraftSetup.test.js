import { describe, it, expect, beforeEach, vi } from "vitest";
import DraftSetup from "../../src/components/DraftSetup.vue";
import { useDraftStore } from "../../src/stores/draft.js";
import { useCardStore } from "../../src/stores/cards.js";
import { _resetCache } from "../../src/services/boosterData.js";
import { mountWithVuetify } from "../helpers/mount.js";

beforeEach(() => {
    _resetCache();
    if (typeof globalThis.window === "undefined") globalThis.window = {};
    globalThis.window.electronAPI = {
        async fetchMtgjsonSetList() {
            return {
                data: [
                    { code: "AAA", name: "Set Alpha", type: "expansion", releaseDate: "2024-05-01", baseSetSize: 200 },
                    { code: "BBB", name: "Set Beta", type: "expansion", releaseDate: "2024-09-01", baseSetSize: 200 },
                ],
            };
        },
        async fetchMtgjsonSet(code) {
            return {
                data: {
                    code,
                    cards: [],
                    booster: {
                        draft: {
                            boosters: [{ weight: 1, contents: { common: 1 } }],
                            sheets: { common: { totalWeight: 1, cards: { x: 1 } } },
                        },
                    },
                },
            };
        },
    };
});

describe("DraftSetup", () => {
    it("disables the Open button until a selection is valid", async () => {
        const w = mountWithVuetify(DraftSetup);
        await w.vm.$nextTick();
        const openBtn = w.findAll("button").find((b) => /Open\s+\d+\s+pack/i.test(b.text()));
        expect(openBtn).toBeDefined();
        expect(openBtn.attributes("disabled")).toBeDefined();
    });

    it("loads set options on mount", async () => {
        const w = mountWithVuetify(DraftSetup);
        // Wait for the async load to settle.
        await new Promise((r) => setTimeout(r, 10));
        await w.vm.$nextTick();
        const draft = useDraftStore();
        expect(draft.setOptionsLoaded).toBe(true);
        expect(draft.setOptions.length).toBe(2);
    });

    it("Add another set button stays visible regardless of how many slots are added", async () => {
        const w = mountWithVuetify(DraftSetup);
        const draft = useDraftStore();
        draft.addSelection();
        draft.addSelection();
        draft.addSelection();
        draft.addSelection();
        await w.vm.$nextTick();
        const addBtn = w.findAll("button").find((b) => b.text().includes("Add another set"));
        expect(addBtn).toBeDefined();
    });

    it("Browse all cards button calls cards.closeImport + setSealedMode(false)", async () => {
        const w = mountWithVuetify(DraftSetup);
        const cards = useCardStore();
        const setSealed = vi.spyOn(cards, "setSealedMode");
        const close = vi.spyOn(cards, "closeImport");
        const btn = w.findAll("button").find((b) => b.text().includes("Browse all"));
        await btn.trigger("click");
        expect(setSealed).toHaveBeenCalledWith(false);
        expect(close).toHaveBeenCalled();
    });

    it("Sound toggle flips draft.muted", async () => {
        const w = mountWithVuetify(DraftSetup);
        const draft = useDraftStore();
        expect(draft.muted).toBe(false);
        const btn = w.findAll("button").find((b) => /Sound:/.test(b.text()));
        await btn.trigger("click");
        expect(draft.muted).toBe(true);
    });

    it("shows error alert when set options fail to load", async () => {
        globalThis.window.electronAPI = {
            async fetchMtgjsonSetList() {
                throw new Error("offline");
            },
        };
        const w = mountWithVuetify(DraftSetup);
        await new Promise((r) => setTimeout(r, 10));
        await w.vm.$nextTick();
        expect(w.text()).toContain("offline");
    });
});
