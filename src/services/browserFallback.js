// Browser fallback when Electron IPC is not available (dev mode in browser).
// Reads the card database via the Vite dev server proxy.
// Images load directly from Scryfall URLs.

const DB_PATH = "/api/cards.xml";
const imageCache = new Map();

export function installBrowserFallback() {
    if (window.electronAPI) return;

    window.electronAPI = {
        async readCardDatabase() {
            const res = await fetch(DB_PATH);
            if (!res.ok) throw new Error(`Failed to fetch card database: ${res.status}`);
            return res.text();
        },

        async getCachedImage(setCode, fileName) {
            return imageCache.get(`${setCode}/${fileName}`) || null;
        },

        async downloadImage(url, setCode, fileName) {
            const key = `${setCode}/${fileName}`;
            const cached = imageCache.get(key);
            if (cached) return cached;
            imageCache.set(key, url);
            return url;
        },

        async getCachePath() {
            return "(browser memory)";
        },

        async fetchMtgjsonSetList() {
            const res = await fetch("/api/mtgjson/SetList.json");
            if (!res.ok) throw new Error(`SetList fetch failed: ${res.status}`);
            return res.json();
        },

        async fetchMtgjsonSet(setCode) {
            const code = String(setCode || "").toUpperCase();
            const res = await fetch(`/api/mtgjson/${code}.json`);
            if (!res.ok) throw new Error(`Set ${code} fetch failed: ${res.status}`);
            return res.json();
        },
    };
}
