import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

async function loadFresh() {
    vi.resetModules();
    return await import("../../src/services/browserFallback.js");
}

beforeEach(() => {
    globalThis.window = {};
});

afterEach(() => {
    delete globalThis.window;
    vi.unstubAllGlobals();
});

describe("installBrowserFallback", () => {
    it("does nothing if window.electronAPI already exists", async () => {
        const existing = { sentinel: true };
        globalThis.window.electronAPI = existing;
        const { installBrowserFallback } = await loadFresh();
        installBrowserFallback();
        expect(globalThis.window.electronAPI).toBe(existing);
    });

    it("installs a shim with the expected methods", async () => {
        const { installBrowserFallback } = await loadFresh();
        installBrowserFallback();
        const api = globalThis.window.electronAPI;
        expect(typeof api.readCardDatabase).toBe("function");
        expect(typeof api.getCachedImage).toBe("function");
        expect(typeof api.downloadImage).toBe("function");
        expect(typeof api.getCachePath).toBe("function");
    });

    it("readCardDatabase fetches /api/cards.xml and returns text", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => "<xml/>",
        });
        vi.stubGlobal("fetch", fetchMock);
        const { installBrowserFallback } = await loadFresh();
        installBrowserFallback();
        const text = await globalThis.window.electronAPI.readCardDatabase();
        expect(fetchMock).toHaveBeenCalledWith("/api/cards.xml");
        expect(text).toBe("<xml/>");
    });

    it("readCardDatabase throws when the response is not ok", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
        const { installBrowserFallback } = await loadFresh();
        installBrowserFallback();
        await expect(globalThis.window.electronAPI.readCardDatabase()).rejects.toThrow(/404/);
    });

    it("getCachedImage returns null on miss and the cached value on hit", async () => {
        const { installBrowserFallback } = await loadFresh();
        installBrowserFallback();
        const api = globalThis.window.electronAPI;
        expect(await api.getCachedImage("LEA", "Bolt.jpg")).toBeNull();
        await api.downloadImage("http://x/img.jpg", "LEA", "Bolt.jpg");
        expect(await api.getCachedImage("LEA", "Bolt.jpg")).toBe("http://x/img.jpg");
    });

    it("downloadImage returns the URL and caches it", async () => {
        const { installBrowserFallback } = await loadFresh();
        installBrowserFallback();
        const api = globalThis.window.electronAPI;
        const r1 = await api.downloadImage("http://x/img.jpg", "LEA", "Bolt.jpg");
        expect(r1).toBe("http://x/img.jpg");
        // A second call returns the original cached URL even if a different one is passed
        const r2 = await api.downloadImage("http://different", "LEA", "Bolt.jpg");
        expect(r2).toBe("http://x/img.jpg");
    });

    it("getCachePath returns a placeholder string", async () => {
        const { installBrowserFallback } = await loadFresh();
        installBrowserFallback();
        const path = await globalThis.window.electronAPI.getCachePath();
        expect(typeof path).toBe("string");
        expect(path).toMatch(/browser/i);
    });
});
