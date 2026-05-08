import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/services/imageLoader.js", () => ({
    getCachedSync: () => null,
    loadCardImage: vi.fn().mockResolvedValue(null),
}));

const exportDeckMock = vi.fn().mockReturnValue("// fake deck export\n1 Lightning Bolt");
vi.mock("../../src/services/deckExporter.js", () => ({
    exportDeck: (...a) => exportDeckMock(...a),
}));

import DeckSummary from "../../src/components/DeckSummary.vue";
import { useCardStore } from "../../src/stores/cards.js";
import { mountWithVuetify } from "../helpers/mount.js";

beforeEach(() => {
    if (!globalThis.navigator) globalThis.navigator = {};
    Object.defineProperty(globalThis.navigator, "clipboard", {
        configurable: true,
        value: { writeText: vi.fn().mockResolvedValue() },
    });
    // happy-dom doesn't implement modal dialogs; stub them so vi.spyOn works (vitest 4 is strict)
    window.confirm = () => true;
    window.alert = () => {};
    exportDeckMock.mockClear();
});

describe("DeckSummary", () => {
    it("renders the deck-count target ratio", () => {
        const w = mountWithVuetify(DeckSummary);
        const cards = useCardStore();
        expect(w.text()).toContain(`/ ${cards.deckSize}`);
    });

    it("disables Clear when deckTotal is 0", () => {
        const w = mountWithVuetify(DeckSummary);
        const clear = w.findAll("button").find((b) => b.text().includes("Clear"));
        expect(clear.attributes("disabled")).toBeDefined();
    });

    it("renders one row per basic land color", () => {
        const w = mountWithVuetify(DeckSummary);
        const cards = useCardStore();
        expect(w.findAll(".land-row")).toHaveLength(cards.BASIC_COLORS.length);
    });

    it("clicking + adjusts the matching basic land", async () => {
        const w = mountWithVuetify(DeckSummary);
        const cards = useCardStore();
        const spy = vi.spyOn(cards, "adjustBasicLand");
        const firstRow = w.findAll(".land-row")[0];
        const buttons = firstRow.findAll("button");
        // Two buttons: minus then plus
        await buttons[1].trigger("click");
        expect(spy).toHaveBeenCalledWith(cards.BASIC_COLORS[0], 1);
    });

    it("disables the minus button when basic land count is 0", () => {
        const w = mountWithVuetify(DeckSummary);
        const firstRow = w.findAll(".land-row")[0];
        const minusBtn = firstRow.findAll("button")[0];
        expect(minusBtn.attributes("disabled")).toBeDefined();
    });

    it("disables Copy Deck when deck is empty", () => {
        const w = mountWithVuetify(DeckSummary);
        const copyBtn = w.findAll("button").find((b) => b.text().includes("Copy Deck"));
        expect(copyBtn.attributes("disabled")).toBeDefined();
    });

    it("Copy Deck calls exportDeck and writes to clipboard", async () => {
        const w = mountWithVuetify(DeckSummary);
        const cards = useCardStore();
        cards.adjustBasicLand("R", 1);
        await w.vm.$nextTick();
        const copyBtn = w.findAll("button").find((b) => b.text().includes("Copy Deck"));
        await copyBtn.trigger("click");
        await new Promise((r) => setTimeout(r, 0));
        expect(exportDeckMock).toHaveBeenCalled();
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith("// fake deck export\n1 Lightning Bolt");
    });

    it("toggles the sidebar collapse via the toggle button", async () => {
        const w = mountWithVuetify(DeckSummary);
        const cards = useCardStore();
        expect(cards.showSidebar).toBe(true);
        await w.find(".deck-summary-toggle").trigger("click");
        expect(cards.showSidebar).toBe(false);
    });

    it("Clear with confirm=true calls store.clearDeck", async () => {
        const w = mountWithVuetify(DeckSummary);
        const cards = useCardStore();
        cards.adjustBasicLand("R", 5);
        await w.vm.$nextTick();
        const spy = vi.spyOn(cards, "clearDeck");
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
        const clear = w.findAll("button").find((b) => b.text().includes("Clear"));
        await clear.trigger("click");
        expect(confirmSpy).toHaveBeenCalled();
        expect(spy).toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    it("Clear with confirm=false does not clear the deck", async () => {
        const w = mountWithVuetify(DeckSummary);
        const cards = useCardStore();
        cards.adjustBasicLand("R", 5);
        await w.vm.$nextTick();
        const spy = vi.spyOn(cards, "clearDeck");
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
        const clear = w.findAll("button").find((b) => b.text().includes("Clear"));
        await clear.trigger("click");
        expect(spy).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    it("Copy Deck surfaces an alert when clipboard write fails", async () => {
        navigator.clipboard.writeText = vi.fn().mockRejectedValue(new Error("blocked"));
        const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const w = mountWithVuetify(DeckSummary);
        const cards = useCardStore();
        cards.adjustBasicLand("R", 1);
        await w.vm.$nextTick();
        const copyBtn = w.findAll("button").find((b) => b.text().includes("Copy Deck"));
        await copyBtn.trigger("click");
        await new Promise((r) => setTimeout(r, 0));

        expect(alertSpy).toHaveBeenCalled();
        alertSpy.mockRestore();
        errorSpy.mockRestore();
    });
});
