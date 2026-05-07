import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The packImage module holds module-level memoization, so each test starts
// from a fresh import + a fresh fetchSetData mock.
async function loadFreshModule(setData) {
    vi.resetModules();
    vi.doMock("../../src/services/boosterData.js", () => ({
        fetchSetData: vi.fn().mockResolvedValue(setData),
    }));
    return await import("../../src/services/packImage.js");
}

let api;

beforeEach(() => {
    api = {
        getCachedImage: vi.fn().mockResolvedValue(null),
        downloadImage: vi.fn().mockResolvedValue("data:image/jpeg;base64,IMG"),
    };
    globalThis.window = { electronAPI: api };
});

afterEach(() => {
    delete globalThis.window;
    vi.doUnmock("../../src/services/boosterData.js");
    vi.resetModules();
});

function pack(category, subtype, productId) {
    return {
        category,
        subtype,
        name: `${category}/${subtype}`,
        identifiers: productId != null ? { tcgplayerProductId: String(productId) } : {},
    };
}

describe("pickProduct (selection logic)", () => {
    it("prefers an exact subtype match", async () => {
        const { _internals } = await loadFreshModule({});
        const products = [
            pack("booster_pack", "draft", 100),
            pack("booster_pack", "play", 200),
            pack("booster_pack", "collector", 300),
        ];
        expect(_internals.pickProduct(products, "play").identifiers.tcgplayerProductId).toBe("200");
        expect(_internals.pickProduct(products, "collector").identifiers.tcgplayerProductId).toBe("300");
    });

    it("falls back to subtype 'default' when boosterType is draft/play and no exact match", async () => {
        const { _internals } = await loadFreshModule({});
        const products = [pack("booster_pack", "default", 42)];
        expect(_internals.pickProduct(products, "draft").identifiers.tcgplayerProductId).toBe("42");
        expect(_internals.pickProduct(products, "play").identifiers.tcgplayerProductId).toBe("42");
    });

    it("uses the lone booster_pack as a last resort", async () => {
        const { _internals } = await loadFreshModule({});
        const products = [pack("booster_pack", "weird-subtype", 7)];
        expect(_internals.pickProduct(products, "set").identifiers.tcgplayerProductId).toBe("7");
    });

    it("ignores boxes, cases, decks, and non-pack products", async () => {
        const { _internals } = await loadFreshModule({});
        const products = [
            pack("booster_box", "draft", 999),
            pack("case", "draft", 998),
            pack("deck", "commander", 997),
        ];
        expect(_internals.pickProduct(products, "draft")).toBeNull();
    });

    it("returns null when there are multiple packs and no subtype matches", async () => {
        const { _internals } = await loadFreshModule({});
        const products = [
            pack("booster_pack", "draft", 1),
            pack("booster_pack", "collector", 2),
        ];
        // We don't want to silently return a draft pack when the user asked
        // for a "set" booster.
        expect(_internals.pickProduct(products, "set")).toBeNull();
    });

    it("returns null on empty / missing input", async () => {
        const { _internals } = await loadFreshModule({});
        expect(_internals.pickProduct(null, "draft")).toBeNull();
        expect(_internals.pickProduct([], "draft")).toBeNull();
    });
});

describe("buildUrl", () => {
    it("builds the TCGPlayer URL pattern from a product id", async () => {
        const { _internals } = await loadFreshModule({});
        const url = _internals.buildUrl(pack("booster_pack", "draft", 123456));
        expect(url).toBe("https://product-images.tcgplayer.com/fit-in/437x437/123456.jpg");
    });

    it("returns null when no tcgplayerProductId is present", async () => {
        const { _internals } = await loadFreshModule({});
        expect(_internals.buildUrl(pack("booster_pack", "draft", null))).toBeNull();
        expect(_internals.buildUrl(null)).toBeNull();
    });
});

describe("resolvePackImageUrl", () => {
    it("resolves the URL via fetchSetData → sealedProduct → tcgplayerProductId", async () => {
        const { resolvePackImageUrl } = await loadFreshModule({
            sealedProduct: [pack("booster_pack", "play", 555)],
        });
        const url = await resolvePackImageUrl("DSK", "play");
        expect(url).toBe("https://product-images.tcgplayer.com/fit-in/437x437/555.jpg");
    });

    it("returns null when set has no sealedProduct", async () => {
        const { resolvePackImageUrl } = await loadFreshModule({});
        expect(await resolvePackImageUrl("OLD", "draft")).toBeNull();
    });

    it("returns null when the matching pack has no tcgplayerProductId", async () => {
        const { resolvePackImageUrl } = await loadFreshModule({
            sealedProduct: [pack("booster_pack", "draft", null)],
        });
        expect(await resolvePackImageUrl("ABC", "draft")).toBeNull();
    });

    it("memoizes negative results so a second call doesn't re-fetch", async () => {
        const setData = { sealedProduct: [] };
        vi.resetModules();
        const fetchSetData = vi.fn().mockResolvedValue(setData);
        vi.doMock("../../src/services/boosterData.js", () => ({ fetchSetData }));
        const { resolvePackImageUrl } = await import("../../src/services/packImage.js");

        await resolvePackImageUrl("NOX", "draft");
        await resolvePackImageUrl("NOX", "draft");
        expect(fetchSetData).toHaveBeenCalledTimes(1);
    });
});

describe("loadPackImage", () => {
    it("returns the disk-cached data URL without hitting the network", async () => {
        api.getCachedImage.mockResolvedValueOnce("data:image/jpeg;base64,DISK");
        const { loadPackImage } = await loadFreshModule({
            sealedProduct: [pack("booster_pack", "draft", 1)],
        });
        const result = await loadPackImage("DSK", "draft");
        expect(result).toBe("data:image/jpeg;base64,DISK");
        expect(api.downloadImage).not.toHaveBeenCalled();
    });

    it("downloads via the resolved TCGPlayer URL and caches in memory", async () => {
        const { loadPackImage, getCachedPackImageSync } = await loadFreshModule({
            sealedProduct: [pack("booster_pack", "draft", 9)],
        });
        const result = await loadPackImage("DSK", "draft");
        expect(result).toBe("data:image/jpeg;base64,IMG");
        expect(api.downloadImage).toHaveBeenCalledWith(
            "https://product-images.tcgplayer.com/fit-in/437x437/9.jpg",
            "DSK",
            "pack_draft.jpg"
        );
        expect(getCachedPackImageSync("DSK", "draft")).toBe("data:image/jpeg;base64,IMG");
    });

    it("returns null and short-circuits on subsequent calls when no image is available", async () => {
        const { loadPackImage } = await loadFreshModule({ sealedProduct: [] });
        expect(await loadPackImage("OLD", "draft")).toBeNull();
        expect(await loadPackImage("OLD", "draft")).toBeNull();
        expect(api.downloadImage).not.toHaveBeenCalled();
    });

    it("returns null and remembers the failure when the download throws", async () => {
        api.downloadImage.mockRejectedValueOnce(new Error("HTTP 404"));
        const { loadPackImage } = await loadFreshModule({
            sealedProduct: [pack("booster_pack", "draft", 11)],
        });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        expect(await loadPackImage("DSK", "draft")).toBeNull();
        expect(await loadPackImage("DSK", "draft")).toBeNull();
        expect(api.downloadImage).toHaveBeenCalledTimes(1);
        warn.mockRestore();
    });
});
