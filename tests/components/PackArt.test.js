import { describe, it, expect } from "vitest";
import PackArt from "../../src/components/PackArt.vue";
import { mountWithVuetify } from "../helpers/mount.js";

describe("PackArt", () => {
    it("renders set code and booster type label", () => {
        const w = mountWithVuetify(PackArt, {
            props: { setCode: "DSK", setName: "Duskmourn", boosterType: "play" },
        });
        expect(w.text()).toContain("Duskmourn");
        expect(w.text()).toContain("PLAY BOOSTER");
    });

    it("falls back to set code when name is missing", () => {
        const w = mountWithVuetify(PackArt, {
            props: { setCode: "ABC" },
        });
        expect(w.text()).toContain("ABC");
    });

    it("does not expose tier on the closed pack (no spoilers)", () => {
        // Pack art must look identical regardless of contents — any tier hint
        // before opening gives away the rarity.
        const w = mountWithVuetify(PackArt, {
            props: { setCode: "ABC" },
        });
        expect(w.find(".pack-art").attributes("data-tier")).toBeUndefined();
    });

    it("toggles ripping class when prop is set", async () => {
        const w = mountWithVuetify(PackArt, {
            props: { setCode: "ABC", ripping: false },
        });
        expect(w.find(".pack-art").classes()).not.toContain("ripping");
        await w.setProps({ ripping: true });
        expect(w.find(".pack-art").classes()).toContain("ripping");
    });

    it("falls back to a text symbol when the SVG fails to load", async () => {
        const w = mountWithVuetify(PackArt, {
            props: { setCode: "ZZZ" },
        });
        const img = w.find(".pack-symbol");
        await img.trigger("error");
        expect(w.find(".pack-symbol-fallback").exists()).toBe(true);
        expect(w.find(".pack-symbol-fallback").text()).toBe("ZZZ");
    });

    it("uppercases and spaces the booster type label", () => {
        const w = mountWithVuetify(PackArt, {
            props: { setCode: "ABC", boosterType: "set-booster-fun" },
        });
        expect(w.text()).toContain("SET BOOSTER FUN BOOSTER");
    });
});
