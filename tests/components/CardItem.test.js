import { describe, it, expect, vi, beforeEach } from "vitest";

const getCachedSync = vi.fn();
const loadCardImage = vi.fn();

vi.mock("../../src/services/imageLoader.js", () => ({
    getCachedSync: (...a) => getCachedSync(...a),
    loadCardImage: (...a) => loadCardImage(...a),
}));

import CardItem from "../../src/components/CardItem.vue";
import { mountWithVuetify } from "../helpers/mount.js";

function makeCard(overrides = {}) {
    return {
        name: "Lightning Bolt",
        manaCost: "R",
        type: "Instant",
        text: "Deals 3 damage.",
        pt: "",
        ...overrides,
    };
}

beforeEach(() => {
    getCachedSync.mockReset();
    loadCardImage.mockReset();
});

describe("CardItem", () => {
    it("shows the placeholder when there is no cached image", () => {
        getCachedSync.mockReturnValue(null);
        const w = mountWithVuetify(CardItem, { props: { card: makeCard() } });
        expect(w.find(".card-placeholder").exists()).toBe(true);
        expect(w.find("img.card-image").exists()).toBe(false);
        expect(w.text()).toContain("Lightning Bolt");
        expect(w.text()).toContain("Instant");
        expect(w.text()).toContain("Deals 3 damage.");
    });

    it("shows the image immediately when one is in the synchronous cache", () => {
        getCachedSync.mockReturnValue("data:image/jpeg;base64,AAA");
        const w = mountWithVuetify(CardItem, { props: { card: makeCard() } });
        const img = w.find("img.card-image");
        expect(img.exists()).toBe(true);
        expect(img.attributes("src")).toBe("data:image/jpeg;base64,AAA");
        expect(w.find(".card-placeholder").exists()).toBe(false);
    });

    it("renders P/T when present", () => {
        getCachedSync.mockReturnValue(null);
        const w = mountWithVuetify(CardItem, { props: { card: makeCard({ pt: "2/2" }) } });
        expect(w.find(".placeholder-pt").text()).toBe("2/2");
    });

    it("emits click when the root is clicked", async () => {
        getCachedSync.mockReturnValue(null);
        const w = mountWithVuetify(CardItem, { props: { card: makeCard() } });
        await w.find(".card-item").trigger("click");
        expect(w.emitted("click")).toBeTruthy();
        expect(w.emitted("click")).toHaveLength(1);
    });

    it("observes the root element with an IntersectionObserver when no cache hit", () => {
        getCachedSync.mockReturnValue(null);
        const observed = [];
        const observerCtor = vi.fn(function () {
            this.observe = (el) => observed.push(el);
            this.disconnect = () => {};
            this.unobserve = () => {};
        });
        globalThis.IntersectionObserver = observerCtor;
        const w = mountWithVuetify(CardItem, { props: { card: makeCard() } });
        expect(observed).toContain(w.find(".card-item").element);
    });

    it("does not register an IntersectionObserver when image is already cached", () => {
        getCachedSync.mockReturnValue("data:image/jpeg;base64,AAA");
        const observed = [];
        globalThis.IntersectionObserver = function () {
            this.observe = (el) => observed.push(el);
            this.disconnect = () => {};
            this.unobserve = () => {};
        };
        const w = mountWithVuetify(CardItem, { props: { card: makeCard() } });
        expect(observed).not.toContain(w.find(".card-item").element);
    });
});
