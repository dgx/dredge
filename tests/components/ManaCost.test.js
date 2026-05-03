import { describe, it, expect } from "vitest";
import ManaCost from "../../src/components/ManaCost.vue";
import { mount } from "@vue/test-utils";

describe("ManaCost", () => {
    it("renders nothing for an empty cost", () => {
        const w = mount(ManaCost, { props: { cost: "" } });
        expect(w.find(".mana-cost").exists()).toBe(false);
    });

    it("renders one icon per token", () => {
        const w = mount(ManaCost, { props: { cost: "2WW" } });
        const icons = w.findAll("i.ms");
        expect(icons).toHaveLength(3);
        expect(icons[0].classes()).toContain("ms-2");
        expect(icons[1].classes()).toContain("ms-w");
        expect(icons[2].classes()).toContain("ms-w");
    });

    it("renders the pill ms-cost class by default", () => {
        const w = mount(ManaCost, { props: { cost: "R" } });
        expect(w.find("i.ms.ms-r").classes()).toContain("ms-cost");
    });

    it("omits ms-cost in inline mode", () => {
        const w = mount(ManaCost, { props: { cost: "R", pill: false } });
        expect(w.find(".mana-cost--inline").exists()).toBe(true);
        expect(w.find("i.ms.ms-r").classes()).not.toContain("ms-cost");
    });

    it("renders the slash separator for split costs", () => {
        const w = mount(ManaCost, { props: { cost: "G // 2W" } });
        expect(w.findAll(".mana-cost-slash")).toHaveLength(1);
        const icons = w.findAll("i.ms");
        // Side 1: G (1 icon). Side 2: 2, W (2 icons).
        expect(icons).toHaveLength(3);
    });

    it("renders hybrid tokens with split class", () => {
        const w = mount(ManaCost, { props: { cost: "{U/B}" } });
        const icon = w.find("i.ms");
        expect(icon.classes()).toContain("ms-ub");
        expect(icon.classes()).toContain("ms-split");
    });
});
