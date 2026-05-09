// Resolves real booster-pack box-art images from MTGJSON's sealedProduct data,
// served from TCGPlayer's public product image CDN. Falls back to null when no
// matching product exists, in which case PackArt.vue keeps its CSS fake-pack art.
//
// MTGJSON sealedProduct entries we care about look like:
//   {
//     category: "booster_pack",        // also: "booster_box", "case", "deck", ...
//     subtype:  "draft" | "play" | "set" | "collector" | "default",
//     identifiers: { tcgplayerProductId: "12345", ... },
//     ...
//   }
//
// The TCGPlayer product image URL is publicly hot-linkable:
//   https://product-images.tcgplayer.com/fit-in/437x437/{productId}.jpg

import { fetchSetData } from "./boosterData.js";

const TCG_IMAGE_BASE = "https://product-images.tcgplayer.com/fit-in/437x437";

const urlMemo = new Map();        // key -> resolved URL
const urlNegative = new Set();    // keys we already determined have no image
const inFlightUrl = new Map();    // key -> Promise<string|null>

const dataMemo = new Map();       // key -> data URL (base64) once downloaded
const dataNegative = new Set();   // download attempts that failed
const inFlightLoad = new Map();   // key -> Promise<string|null>

function key(setCode, boosterType) {
    return `${String(setCode || "").toUpperCase()}|${boosterType || "draft"}`;
}

function fileNameFor(boosterType) {
    const t = String(boosterType || "draft").replace(/[^a-z0-9_-]+/gi, "_");
    return `pack_${t}.jpg`;
}

// Pick the sealedProduct entry that best represents a single booster pack of
// the requested type. Boxes, cases, decks, etc. are filtered out — the photo
// of a 36-pack box is not what the user wants on top of a single-pack render.
function pickProduct(sealedProduct, boosterType) {
    if (!Array.isArray(sealedProduct) || sealedProduct.length === 0) return null;

    const packs = sealedProduct.filter((p) => p?.category === "booster_pack");
    if (packs.length === 0) return null;

    const wanted = String(boosterType || "draft").toLowerCase();

    const exact = packs.find((p) => String(p.subtype || "").toLowerCase() === wanted);
    if (exact) return exact;

    // Older / smaller sets often label their lone pack product "default"
    // even when the booster table calls it "draft" or "play".
    if (wanted === "draft" || wanted === "play") {
        const dflt = packs.find((p) => String(p.subtype || "").toLowerCase() === "default");
        if (dflt) return dflt;
    }

    // Last resort: if there's only one booster_pack product, use it. With
    // multiple packs and no subtype match we'd be guessing, so bail out.
    if (packs.length === 1) return packs[0];

    return null;
}

function buildUrl(product) {
    const id = product?.identifiers?.tcgplayerProductId;
    if (!id) return null;
    return `${TCG_IMAGE_BASE}/${id}.jpg`;
}

// Returns a TCGPlayer image URL or null. Memoized; safe to call repeatedly.
export async function resolvePackImageUrl(setCode, boosterType) {
    const k = key(setCode, boosterType);
    if (urlMemo.has(k)) return urlMemo.get(k);
    if (urlNegative.has(k)) return null;
    if (inFlightUrl.has(k)) return inFlightUrl.get(k);

    const promise = (async () => {
        try {
            const data = await fetchSetData(setCode);
            const product = pickProduct(data?.sealedProduct, boosterType);
            const url = buildUrl(product);
            if (url) {
                urlMemo.set(k, url);
                return url;
            }
            urlNegative.add(k);
            return null;
        } catch {
            // fetchSetData failure is already surfaced elsewhere; just skip
            // the photo and let the CSS fallback render.
            urlNegative.add(k);
            return null;
        }
    })();

    inFlightUrl.set(k, promise);
    try {
        return await promise;
    } finally {
        inFlightUrl.delete(k);
    }
}

// Synchronous peek at the in-memory data-URL cache. PackArt uses this to render
// instantly when the user re-opens a set without a loading flicker.
export function getCachedPackImageSync(setCode, boosterType) {
    const k = key(setCode, boosterType);
    return dataMemo.get(k) || null;
}

// Resolves to a usable <img src> value (data URL in Electron, raw URL in
// browser dev). Returns null when no real pack image is available.
export async function loadPackImage(setCode, boosterType, signal) {
    const k = key(setCode, boosterType);

    if (dataMemo.has(k)) return dataMemo.get(k);
    if (dataNegative.has(k)) return null;
    if (inFlightLoad.has(k)) return inFlightLoad.get(k);

    const code = String(setCode || "").toUpperCase();
    if (!code) return null;
    const fileName = fileNameFor(boosterType);

    const promise = (async () => {
        // Disk cache hit — works for Electron; browser fallback returns null.
        try {
            const cached = await window.electronAPI.getCachedImage(code, fileName);
            if (cached) {
                dataMemo.set(k, cached);
                return cached;
            }
        } catch {
            // Ignore — proceed to URL resolution.
        }

        if (signal?.aborted) return null;

        const url = await resolvePackImageUrl(code, boosterType);
        if (!url) {
            dataNegative.add(k);
            return null;
        }

        if (signal?.aborted) return null;

        try {
            const result = await window.electronAPI.downloadImage(url, code, fileName);
            if (result) {
                dataMemo.set(k, result);
                return result;
            }
            dataNegative.add(k);
            return null;
        } catch (err) {
            if (err?.name === "AbortError") return null;
            console.warn(`Pack image download failed for ${code}/${boosterType}:`, err.message);
            dataNegative.add(k);
            return null;
        }
    })();

    inFlightLoad.set(k, promise);
    try {
        return await promise;
    } finally {
        inFlightLoad.delete(k);
    }
}

// Fire-and-forget prewarm. Used by the packs store right after a pack queue
// is rolled, so by the time the user clicks the first pack the image is
// already on disk + in memory and PackArt can render it synchronously.
export function prewarmPackImages(pairs) {
    if (!pairs) return;
    for (const { setCode, boosterType } of pairs) {
        // Don't await — failures are already swallowed inside loadPackImage.
        loadPackImage(setCode, boosterType).catch(() => {});
    }
}

// For tests.
export const _resetPackImageCache = () => {
    urlMemo.clear();
    urlNegative.clear();
    inFlightUrl.clear();
    dataMemo.clear();
    dataNegative.clear();
    inFlightLoad.clear();
};

// Exported for tests — pure logic, no side effects.
export const _internals = { pickProduct, buildUrl, fileNameFor };
