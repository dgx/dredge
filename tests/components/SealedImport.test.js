import { describe, it, expect, vi, beforeEach } from "vitest";
import SealedImport from "../../src/components/SealedImport.vue";
import { useCardStore } from "../../src/stores/cards.js";
import { mountWithVuetify } from "../helpers/mount.js";

beforeEach(() => {
    if (!globalThis.navigator) globalThis.navigator = {};
    if (!globalThis.navigator.clipboard) {
        Object.defineProperty(globalThis.navigator, "clipboard", {
            configurable: true,
            value: { readText: vi.fn() },
        });
    }
});

describe("SealedImport", () => {
    it("disables Import while textarea is empty", () => {
        const w = mountWithVuetify(SealedImport);
        const importBtn = w.findAll("button").find((b) => b.text().includes("Import Pool"));
        expect(importBtn.attributes("disabled")).toBeDefined();
    });

    it("enables Import once text is present and calls store.importSealedPool", async () => {
        const w = mountWithVuetify(SealedImport);
        const cards = useCardStore();
        const spy = vi.spyOn(cards, "importSealedPool");
        const textarea = w.find("textarea");
        await textarea.setValue("1 Lightning Bolt [LEA:161]");
        const importBtn = w.findAll("button").find((b) => b.text().includes("Import Pool"));
        expect(importBtn.attributes("disabled")).toBeUndefined();
        await importBtn.trigger("click");
        expect(spy).toHaveBeenCalledWith("1 Lightning Bolt [LEA:161]");
    });

    it("Clear button empties the textarea", async () => {
        const w = mountWithVuetify(SealedImport);
        const textarea = w.find("textarea");
        await textarea.setValue("garbage");
        const clearBtn = w.findAll("button").find((b) => b.text().trim() === "Clear");
        await clearBtn.trigger("click");
        expect(w.find("textarea").element.value).toBe("");
    });

    it("paste-from-clipboard pulls text into the textarea", async () => {
        navigator.clipboard.readText = vi.fn().mockResolvedValue("1 Forest");
        const w = mountWithVuetify(SealedImport);
        const pasteBtn = w.findAll("button").find((b) => b.text().includes("Paste"));
        await pasteBtn.trigger("click");
        await new Promise((r) => setTimeout(r, 0));
        expect(w.find("textarea").element.value).toBe("1 Forest");
    });

    it("shows a clipboard error when readText rejects", async () => {
        navigator.clipboard.readText = vi.fn().mockRejectedValue(new Error("denied"));
        const w = mountWithVuetify(SealedImport);
        const pasteBtn = w.findAll("button").find((b) => b.text().includes("Paste"));
        await pasteBtn.trigger("click");
        await new Promise((r) => setTimeout(r, 0));
        expect(w.text()).toContain("Could not read clipboard");
    });

    it("shows an empty-clipboard message when readText returns empty string", async () => {
        navigator.clipboard.readText = vi.fn().mockResolvedValue("");
        const w = mountWithVuetify(SealedImport);
        const pasteBtn = w.findAll("button").find((b) => b.text().includes("Paste"));
        await pasteBtn.trigger("click");
        await new Promise((r) => setTimeout(r, 0));
        expect(w.text()).toContain("Clipboard is empty");
    });

    it("renders import errors from the store", async () => {
        const w = mountWithVuetify(SealedImport);
        const cards = useCardStore();
        cards.importErrors = [{ line: "garbage", reason: "parse" }];
        await w.vm.$nextTick();
        expect(w.text()).toContain("garbage");
        expect(w.text()).toContain("parse");
    });

    it("Browse-all triggers store.setSealedMode(false) and closes import", async () => {
        const w = mountWithVuetify(SealedImport);
        const cards = useCardStore();
        const setSealed = vi.spyOn(cards, "setSealedMode");
        const close = vi.spyOn(cards, "closeImport");
        const btn = w.findAll("button").find((b) => b.text().includes("Browse all"));
        await btn.trigger("click");
        expect(setSealed).toHaveBeenCalledWith(false);
        expect(close).toHaveBeenCalled();
    });

    it("Back-to-pool button only shows when a pool already exists", async () => {
        const w = mountWithVuetify(SealedImport);
        const cards = useCardStore();
        expect(w.findAll("button").find((b) => b.text().includes("Back to current pool"))).toBeUndefined();
        cards.sealedPool = [{ poolId: "x", name: "x", text: "" }];
        await w.vm.$nextTick();
        expect(w.findAll("button").find((b) => b.text().includes("Back to current pool"))).toBeDefined();
    });
});
