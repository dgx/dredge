import { describe, it, expect } from "vitest";
import ManaPip from "../../src/components/ManaPip.vue";
import { mountWithVuetify } from "../helpers/mount.js";

describe("ManaPip", () => {
    it("renders a color icon for kind=color", () => {
        const w = mountWithVuetify(ManaPip, { props: { kind: "color", value: "W" } });
        expect(w.find("i.ms.ms-w").exists()).toBe(true);
    });

    it("renders the cmc number as text for kind=cmc with a numeric value", () => {
        const w = mountWithVuetify(ManaPip, { props: { kind: "cmc", value: 3 } });
        expect(w.text()).toBe("3");
        expect(w.find("i.ms").exists()).toBe(false);
    });

    it("renders the land icon for kind=cmc value=land", () => {
        const w = mountWithVuetify(ManaPip, { props: { kind: "cmc", value: "land" } });
        expect(w.find("i.ms.ms-land").exists()).toBe(true);
    });

    it("renders the multicolor icon for kind=color value=multi", () => {
        const w = mountWithVuetify(ManaPip, { props: { kind: "color", value: "multi" } });
        expect(w.find("i.ms.ms-multicolor").exists()).toBe(true);
    });

    it("renders type icons for kind=type", () => {
        const w = mountWithVuetify(ManaPip, { props: { kind: "type", value: "Creature" } });
        expect(w.find("i.ms.ms-creature").exists()).toBe(true);
    });

    it("applies a kind-based variant class", () => {
        const w = mountWithVuetify(ManaPip, { props: { kind: "color", value: "U" } });
        expect(w.find(".mana-pip--color").exists()).toBe(true);
    });

    it("renders an icon with no mana-symbol class for an unknown color value", () => {
        const w = mountWithVuetify(ManaPip, { props: { kind: "color", value: "Q" } });
        // Falls through to <i class="ms"> with no specific symbol
        const i = w.find("i.ms");
        expect(i.exists()).toBe(true);
        expect(i.classes().filter((c) => c.startsWith("ms-"))).toEqual([]);
    });
});
