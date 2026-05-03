import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Each test must reset module state because the loader holds a module-level cache and queue.
async function loadFreshModule() {
    vi.resetModules();
    return await import("../../src/services/imageLoader.js");
}

function makeCard(overrides = {}) {
    return {
        name: "Lightning Bolt",
        side: "front",
        bestSet: "LEA",
        sets: [
            { code: "LEA", uuid: "lea-uuid", muid: "100", num: "161", picUrl: "" },
            { code: "MMQ", uuid: "mmq-uuid", muid: "200", num: "200", picUrl: "" },
        ],
        ...overrides,
    };
}

let api;

beforeEach(() => {
    api = {
        getCachedImage: vi.fn().mockResolvedValue(null),
        downloadImage: vi.fn().mockResolvedValue("data:image/jpeg;base64,AAA"),
    };
    globalThis.window = { electronAPI: api };
});

afterEach(() => {
    delete globalThis.window;
    vi.useRealTimers();
});

describe("getCachedSync", () => {
    it("returns null when card has no usable printing", async () => {
        const { getCachedSync } = await loadFreshModule();
        expect(getCachedSync({ name: "X", sets: [] })).toBeNull();
    });

    it("returns null when image not in memory cache", async () => {
        const { getCachedSync } = await loadFreshModule();
        expect(getCachedSync(makeCard())).toBeNull();
    });

    it("returns cached value after a successful load", async () => {
        const { loadCardImage, getCachedSync } = await loadFreshModule();
        const card = makeCard();
        await loadCardImage(card);
        expect(getCachedSync(card)).toBe("data:image/jpeg;base64,AAA");
    });
});

describe("loadCardImage", () => {
    it("returns null when there is no printing to query", async () => {
        const { loadCardImage } = await loadFreshModule();
        const result = await loadCardImage({ name: "Foo", sets: [] });
        expect(result).toBeNull();
    });

    it("returns disk-cache hit without invoking download", async () => {
        api.getCachedImage.mockResolvedValueOnce("disk-bytes");
        const { loadCardImage } = await loadFreshModule();
        const result = await loadCardImage(makeCard());
        expect(result).toBe("disk-bytes");
        expect(api.downloadImage).not.toHaveBeenCalled();
    });

    it("downloads from Scryfall when no cache hit, using uuid URL", async () => {
        const { loadCardImage } = await loadFreshModule();
        await loadCardImage(makeCard());
        expect(api.downloadImage).toHaveBeenCalledTimes(1);
        const [url, setCode, fileName] = api.downloadImage.mock.calls[0];
        expect(url).toBe("https://api.scryfall.com/cards/lea-uuid?format=image");
        expect(setCode).toBe("LEA");
        expect(fileName).toBe("Lightning Bolt_161.jpg");
    });

    it("appends face=back for the back side of dual-faced cards", async () => {
        const { loadCardImage } = await loadFreshModule();
        await loadCardImage(makeCard({ side: "back" }));
        const [url] = api.downloadImage.mock.calls[0];
        expect(url).toBe("https://api.scryfall.com/cards/lea-uuid?format=image&face=back");
    });

    it("falls back to the multiverse endpoint when uuid is missing", async () => {
        const { loadCardImage } = await loadFreshModule();
        const card = makeCard({
            sets: [{ code: "LEA", uuid: "", muid: "100", num: "161", picUrl: "" }],
        });
        await loadCardImage(card);
        const [url] = api.downloadImage.mock.calls[0];
        expect(url).toBe("https://api.scryfall.com/cards/multiverse/100?format=image");
    });

    it("prefers the printing matching bestSet", async () => {
        const { loadCardImage } = await loadFreshModule();
        await loadCardImage(makeCard({ bestSet: "MMQ" }));
        const [url, setCode] = api.downloadImage.mock.calls[0];
        expect(url).toBe("https://api.scryfall.com/cards/mmq-uuid?format=image");
        expect(setCode).toBe("MMQ");
    });

    it("uses an explicit picUrl override when present", async () => {
        const { loadCardImage } = await loadFreshModule();
        const card = makeCard({
            sets: [{ code: "LEA", uuid: "lea-uuid", muid: "", num: "161", picUrl: "http://override/img.jpg" }],
        });
        await loadCardImage(card);
        const [url] = api.downloadImage.mock.calls[0];
        expect(url).toBe("http://override/img.jpg");
    });

    it("returns null when signal is aborted before queueing", async () => {
        const { loadCardImage } = await loadFreshModule();
        const ctrl = new AbortController();
        ctrl.abort();
        const result = await loadCardImage(makeCard(), ctrl.signal);
        expect(result).toBeNull();
        expect(api.downloadImage).not.toHaveBeenCalled();
    });

    it("returns null and swallows on abort during download", async () => {
        api.downloadImage.mockImplementationOnce(() => {
            throw Object.assign(new Error("Aborted"), { name: "AbortError" });
        });
        const { loadCardImage } = await loadFreshModule();
        const result = await loadCardImage(makeCard());
        expect(result).toBeNull();
    });

    it("returns null and warns on non-abort download failure", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        api.downloadImage.mockRejectedValue(new Error("boom"));
        const { loadCardImage } = await loadFreshModule();
        const result = await loadCardImage(makeCard());
        expect(result).toBeNull();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("retries on 429 errors then succeeds", async () => {
        vi.useFakeTimers();
        api.downloadImage
            .mockRejectedValueOnce(new Error("429 rate limited"))
            .mockResolvedValueOnce("ok");
        const { loadCardImage } = await loadFreshModule();
        const promise = loadCardImage(makeCard());
        // Advance past rate-limit wait and the 2s 429 backoff
        await vi.advanceTimersByTimeAsync(3000);
        const result = await promise;
        expect(result).toBe("ok");
        expect(api.downloadImage).toHaveBeenCalledTimes(2);
    });

    it("memoizes successful downloads in memory", async () => {
        const mod = await loadFreshModule();
        const card = makeCard();
        const r1 = await mod.loadCardImage(card);
        const r2 = await mod.loadCardImage(card);
        expect(r1).toBe(r2);
        // Second call hits memory cache, not download or even the disk getter
        expect(api.downloadImage).toHaveBeenCalledTimes(1);
        expect(api.getCachedImage).toHaveBeenCalledTimes(1);
    });

    it("sanitizes characters that are illegal in Windows filenames", async () => {
        const { loadCardImage } = await loadFreshModule();
        const card = makeCard({
            name: "Who/What\\When?",
            sets: [{ code: "LEA", uuid: "lea-uuid", num: "1*", picUrl: "" }],
        });
        await loadCardImage(card);
        const [, , fileName] = api.downloadImage.mock.calls[0];
        expect(fileName).not.toMatch(/[<>:"/\\|?*]/);
    });
});
