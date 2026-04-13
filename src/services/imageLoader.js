const imageCache = new Map();
const MAX_RETRIES = 2;
const CONCURRENCY = 6;
const RATE_LIMIT_MS = 120;

let activeCount = 0;
let lastRequestTime = 0;
const queue = [];

function enqueueDownload(fn, signal) {
    return new Promise((resolve, reject) => {
        // Push to front - newest requests (current viewport) get priority
        queue.unshift({ fn, resolve, reject, signal });
        drain();
    });
}

async function drain() {
    while (activeCount < CONCURRENCY && queue.length > 0) {
        const entry = queue.shift();
        if (entry.signal?.aborted) {
            entry.reject(new DOMException("Aborted", "AbortError"));
            continue;
        }
        activeCount++;
        runEntry(entry);
    }
}

async function runEntry({ fn, resolve, reject, signal }) {
    try {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

        const now = Date.now();
        const wait = RATE_LIMIT_MS - (now - lastRequestTime);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        lastRequestTime = Date.now();

        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

        resolve(await fn());
    } catch (err) {
        reject(err);
    } finally {
        activeCount--;
        drain();
    }
}

function sanitizeFileName(name) {
    return name.replace(/[<>:"/\\|?*]/g, "_");
}

function buildScryfallUrl(card, printing) {
    if (printing.uuid) {
        let url = `https://api.scryfall.com/cards/${printing.uuid}?format=image`;
        if (card.side === "back") url += "&face=back";
        return url;
    }
    if (printing.muid) {
        return `https://api.scryfall.com/cards/multiverse/${printing.muid}?format=image`;
    }
    return null;
}

function getPreferredPrinting(card) {
    for (const s of card.sets) {
        if (s.code === card.bestSet && (s.uuid || s.muid)) return s;
    }
    for (const s of card.sets) {
        if (s.uuid || s.muid) return s;
    }
    return card.sets[0] || null;
}

function getCacheKey(card) {
    const printing = getPreferredPrinting(card);
    if (!printing) return null;
    const setCode = printing.code || "UNKNOWN";
    const fileName = sanitizeFileName(`${card.name}_${printing.num || printing.uuid || printing.muid}.jpg`);
    return `${setCode}/${fileName}`;
}

async function downloadWithRetry(url, setCode, fileName) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await window.electronAPI.downloadImage(url, setCode, fileName);
        } catch (err) {
            const is429 = err.message && err.message.includes("429");
            if (is429 && attempt < MAX_RETRIES) {
                await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
                continue;
            }
            throw err;
        }
    }
}

// Check if image is already in memory cache (synchronous)
export function getCachedSync(card) {
    const key = getCacheKey(card);
    return key ? imageCache.get(key) || null : null;
}

export async function loadCardImage(card, signal) {
    const printing = getPreferredPrinting(card);
    if (!printing) return null;

    const setCode = printing.code || "UNKNOWN";
    const fileName = sanitizeFileName(`${card.name}_${printing.num || printing.uuid || printing.muid}.jpg`);
    const cacheKey = `${setCode}/${fileName}`;

    // Memory cache hit
    if (imageCache.has(cacheKey)) {
        return imageCache.get(cacheKey);
    }

    // Disk cache hit
    const cached = await window.electronAPI.getCachedImage(setCode, fileName);
    if (cached) {
        imageCache.set(cacheKey, cached);
        return cached;
    }

    if (signal?.aborted) return null;

    const url = printing.picUrl || buildScryfallUrl(card, printing);
    if (!url) return null;

    try {
        const result = await enqueueDownload(() => downloadWithRetry(url, setCode, fileName), signal);
        if (result) imageCache.set(cacheKey, result);
        return result;
    } catch (err) {
        if (err.name === "AbortError") return null;
        console.warn(`Failed to download image for ${card.name}:`, err.message);
        return null;
    }
}
