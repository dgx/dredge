// MTGJSON booster data fetcher. Uses electronAPI when available, falling back
// to /api/mtgjson/* paths served by the Vite dev middleware in browser mode.
// Disk-cached in Electron under {userData}/boosterCache/.

import { hasDraftableBooster, listDraftableBoosterTypes } from "./boosterSimulator.js";

const memSetCache = new Map();
let memSetList = null;
let memSetListMeta = null;
let inFlightSetList = null;
const inFlightSet = new Map();

// Set types that we'll surface as "draftable" — match what a player would
// reasonably want to draft from. Excludes promo, memorabilia, etc.
const DRAFTABLE_SET_TYPES = new Set([
    "expansion",
    "core",
    "masters",
    "draft_innovation",
    "starter",
    "funny",
    "commander",
]);

export async function fetchSetList() {
    if (memSetList) return memSetList;
    if (inFlightSetList) return inFlightSetList;

    inFlightSetList = (async () => {
        const json = await window.electronAPI.fetchMtgjsonSetList();
        const sets = (json?.data || []).map(normalizeSetListEntry);
        memSetList = sets;
        memSetListMeta = json?.meta || null;
        return sets;
    })();

    try {
        return await inFlightSetList;
    } finally {
        inFlightSetList = null;
    }
}

function normalizeSetListEntry(s) {
    return {
        code: s.code,
        name: s.name,
        type: s.type,
        releaseDate: s.releaseDate || "",
        block: s.block || "",
        baseSetSize: s.baseSetSize || 0,
        totalSetSize: s.totalSetSize || 0,
        isOnlineOnly: !!s.isOnlineOnly,
        parentCode: s.parentCode || "",
    };
}

// Set types that commonly host bonus-sheet cards referenced by an expansion's
// boosters but not present in the expansion's own `cards` array.
const SUPPLEMENTAL_TYPES = new Set([
    "masterpiece",  // e.g. MAR (Marvel Universe) hosts SPM's sourceMaterial.
    "eternal",      // e.g. TLE (Avatar Eternal) hosts TLA's sourceMaterial.
    "art_series",
    "memorabilia",
]);

// How wide a release-date window to consider when matching supplemental sets
// that don't declare a parentCode pointing at the expansion. Bonus-sheet sets
// almost always release within a couple weeks of their parent expansion.
const SUPPLEMENTAL_WINDOW_DAYS = 21;

// Find supplemental sets that may host cards referenced by `parentCode`'s
// booster sheets. Two passes:
//   1. Sets that explicitly declare `parentCode` — covers TLA → TLE etc.
//   2. Same-release-window sets of bonus-host types (masterpiece, eternal…)
//      — covers SPM → MAR, where the bonus-sheet host has no parentCode.
// Direct children are returned first so they're tried first by the resolver.
export async function findSupplementalSets(parentCode) {
    if (!parentCode) return [];
    const all = await fetchSetList();
    const upper = String(parentCode).toUpperCase();
    const parent = all.find((s) => s.code.toUpperCase() === upper);
    if (!parent) return [];
    const parentDate = parent.releaseDate ? Date.parse(parent.releaseDate) : NaN;

    const out = [];
    const seen = new Set([upper]);

    for (const s of all) {
        const code = s.code.toUpperCase();
        if (seen.has(code)) continue;
        if ((s.parentCode || "").toUpperCase() === upper) {
            out.push(s);
            seen.add(code);
        }
    }

    if (!Number.isNaN(parentDate)) {
        for (const s of all) {
            const code = s.code.toUpperCase();
            if (seen.has(code)) continue;
            if (!SUPPLEMENTAL_TYPES.has(s.type)) continue;
            if (!s.releaseDate) continue;
            const dt = Date.parse(s.releaseDate);
            if (Number.isNaN(dt)) continue;
            const days = Math.abs(dt - parentDate) / 86400000;
            if (days <= SUPPLEMENTAL_WINDOW_DAYS) {
                out.push(s);
                seen.add(code);
            }
        }
    }

    return out;
}

// Returns the set list filtered to "interesting for drafting": draftable type
// and not online-only-test-set garbage. Sorted newest first.
//
// Note: the SetList file does NOT include a per-set boosters list. We can only
// confirm a set has booster data after we fetch its full JSON. So this list is
// a best-effort filter; the UI should still gracefully handle a chosen set
// turning out to lack booster data after fetch.
export async function listDraftableSets() {
    const all = await fetchSetList();
    return all
        .filter((s) => DRAFTABLE_SET_TYPES.has(s.type))
        .filter((s) => !s.isOnlineOnly)
        .filter((s) => (s.baseSetSize || 0) > 0)
        .sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));
}

// Fetch full MTGJSON data for a single set. Memoized + disk-cached.
export async function fetchSetData(setCode) {
    const code = String(setCode || "").toUpperCase();
    if (!code) throw new Error("setCode required");

    if (memSetCache.has(code)) return memSetCache.get(code);
    if (inFlightSet.has(code)) return inFlightSet.get(code);

    const promise = (async () => {
        const json = await window.electronAPI.fetchMtgjsonSet(code);
        // MTGJSON wraps actual payload in `data`. Normalize.
        const data = json?.data || json;
        memSetCache.set(code, data);
        return data;
    })();

    inFlightSet.set(code, promise);
    try {
        return await promise;
    } finally {
        inFlightSet.delete(code);
    }
}

// Returns the SetList meta block (date, version) — the cache invalidation key
// for any data derived from the SetList. Caller must have already awaited
// fetchSetList at least once.
export function getSetListMeta() {
    return memSetListMeta;
}

// Re-export so callers can avoid importing from two modules.
export { hasDraftableBooster, listDraftableBoosterTypes };

// For tests
export const _resetCache = () => {
    memSetCache.clear();
    memSetList = null;
    memSetListMeta = null;
    inFlightSetList = null;
    inFlightSet.clear();
};
