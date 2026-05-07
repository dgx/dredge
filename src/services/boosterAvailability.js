// Tracks which sets have no booster data and should therefore be hidden from
// the set picker. MTGJSON's SetList doesn't include booster info, so the only
// way to know is to fetch each per-set file. We do that as a one-time
// background scan, persist the result to localStorage keyed by SetList version,
// and use it to filter the dropdown live.

import { ref } from "vue";
import { fetchSetList, fetchSetData, getSetListMeta } from "./boosterData.js";

const STORAGE_KEY = "dredge.noBoosterSets.v1";
const SCAN_CONCURRENCY = 8;

// Reactive set of set codes (uppercased) known to have no booster data.
export const noBoosterSets = ref(new Set());

// True while a scan is in flight. Bound to Vuetify's loading/disabled props on
// the set picker so the dropdown can't be operated on while membership is
// shifting underneath the user.
export const scanning = ref(false);

// Last completed scan's SetList version — null means we've never finished a
// fresh scan against the current SetList. Used to decide if a rescan is needed.
const scannedVersion = ref(null);

let scanPromise = null;

hydrateFromStorage();

function hydrateFromStorage() {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.codes)) {
            noBoosterSets.value = new Set(parsed.codes.map((c) => String(c).toUpperCase()));
        }
        scannedVersion.value = parsed?.version || null;
    } catch {
        // Ignore corrupt storage; we'll rescan and rewrite.
    }
}

function persist() {
    try {
        globalThis.localStorage?.setItem(
            STORAGE_KEY,
            JSON.stringify({
                version: scannedVersion.value,
                codes: [...noBoosterSets.value],
            })
        );
    } catch {
        // Best-effort: full quota / privacy mode shouldn't crash the app.
    }
}

export function isFilteredOut(setCode) {
    return noBoosterSets.value.has(String(setCode || "").toUpperCase());
}

// Mark a single set as having no booster data — used when the user picks a
// brand-new set the scan hasn't seen yet and we discover on load that it has
// no boosters. Avoids ever showing it again in this or future sessions.
export function markNoBooster(setCode) {
    const code = String(setCode || "").toUpperCase();
    if (!code || noBoosterSets.value.has(code)) return;
    const next = new Set(noBoosterSets.value);
    next.add(code);
    noBoosterSets.value = next;
    persist();
}

async function pMapLimit(items, limit, fn) {
    let i = 0;
    const workers = Array.from({ length: limit }, async () => {
        while (i < items.length) {
            const idx = i++;
            try {
                await fn(items[idx], idx);
            } catch {
                // A failed fetch is logged elsewhere; skip and keep going.
            }
        }
    });
    await Promise.all(workers);
}

// Walk the entire SetList and tag any set whose MTGJSON data has no booster
// types. Cheap on warm runs (every fetchSetData call is disk-cached); expensive
// on the very first run (~257 fetches) but useful work since it primes the
// cache for any future drafts of those sets.
//
// Idempotent: if a scan against the current SetList version has already
// completed, returns immediately. Concurrent callers share the same promise.
export function scanAvailability() {
    if (scanPromise) return scanPromise;

    // Set synchronously so any subscriber that reads `scanning` in the same
    // tick as the call (e.g. a component mounting) sees the loading state
    // before the first paint.
    scanning.value = true;

    scanPromise = (async () => {
        let sets;
        try {
            sets = await fetchSetList();
        } catch {
            // Offline / set list fetch failed — there's nothing to scan against.
            // Leave any previously-persisted noBoosterSets in place.
            return;
        }
        const meta = getSetListMeta();
        const currentVersion = meta?.date || meta?.version || "";

        if (scannedVersion.value && scannedVersion.value === currentVersion) {
            return;
        }

        // SetList moved (or first run) — refresh against the current version.
        // We don't publish partial results: the dropdown stays gated on
        // `scanning` until the full set is known, so the user never sees
        // entries disappear mid-interaction.
        const found = new Set();

        await pMapLimit(sets, SCAN_CONCURRENCY, async (s) => {
            try {
                const data = await fetchSetData(s.code);
                const types = data?.booster ? Object.keys(data.booster) : [];
                if (types.length === 0) {
                    found.add(String(s.code).toUpperCase());
                }
            } catch {
                // Treat fetch failures as "unknown" — leave the set visible.
            }
        });

        noBoosterSets.value = found;
        scannedVersion.value = currentVersion;
        persist();
    })().finally(() => {
        scanPromise = null;
        scanning.value = false;
    });

    return scanPromise;
}

// For tests
export const _resetAvailability = () => {
    noBoosterSets.value = new Set();
    scannedVersion.value = null;
    scanning.value = false;
    scanPromise = null;
    try {
        globalThis.localStorage?.removeItem(STORAGE_KEY);
    } catch {
        // Ignore.
    }
};
