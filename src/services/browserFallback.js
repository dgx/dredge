// Browser fallback when Electron IPC is not available (dev mode in browser).
// Reads the slim card database via the Vite dev server proxy, which fetches
// and transforms MTGJSON's AllPrintings.json on the server side.
// Images load directly from Scryfall URLs.

const CARD_DB_PATH = "/api/carddb.json";
const imageCache = new Map();

export function installBrowserFallback() {
    if (window.electronAPI) return;

    const progressListeners = new Set();
    function emit(payload) {
        for (const l of progressListeners) {
            try { l(payload); } catch { /* ignore listener error */ }
        }
    }

    window.electronAPI = {
        async loadCardDatabase() {
            emit({ phase: "checking" });
            emit({ phase: "downloading", bytesReceived: 0, totalBytes: 0 });
            const res = await fetch(CARD_DB_PATH);
            if (!res.ok) throw new Error(`Failed to fetch card database: ${res.status}`);
            const slim = await res.json();
            emit({ phase: "done" });
            return slim;
        },

        onCardDbProgress(cb) {
            progressListeners.add(cb);
            return () => progressListeners.delete(cb);
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
