// Booster pack simulator. Consumes MTGJSON set data (data.booster + data.cards)
// and produces drafted pack contents.
//
// MTGJSON booster shape (per data.booster[type]):
//   {
//     boosters: [{ contents: { slotName: count, ... }, weight }],
//     boostersTotalWeight: number,
//     sheets: {
//       slotName: {
//         cards: { [mtgjsonUuid]: weight, ... },
//         totalWeight: number,
//         foil: boolean,
//         balanceColors?: boolean,
//         fixed?: boolean,
//       }
//     }
//   }
//
// We sample weighted-without-replacement within each slot, honor balanceColors
// when present, and tag any card drawn from a recognized bonus-sheet slot.

// Booster types we want to expose for drafting. Drafting is supposed to be fun,
// not collector-grade or scripted prerelease promos.
const PREFERRED_TYPES = ["draft", "play", "default", "set", "arena"];
const SKIP_PATTERNS = [
    "collector",
    "prerelease",
    "bundle",
    "promo",
    "sample",
    "gift",
    "starter",
    "challenger",
    "welcome",
    "tournament",
    "deckbuilder",
    "intropack",
    "fatpack",
    "boxtopper",
    "topper",
    "vip",
];

// Slot names that indicate a bonus / non-main-set sheet. Drives the rainbow tier
// in the animation system regardless of the underlying card's printed rarity.
const BONUS_SHEET_PATTERNS = [
    "specialguest",
    "throughtheages",
    "thelist",
    "list",
    "bonussheet",
    "bonus",
    "retro",
    "timeshifted",
    "timeshift",
    "showcasecommander",
];

const RARITY_RANK = {
    common: 1,
    uncommon: 2,
    rare: 3,
    mythic: 4,
};

const ANIM_TIER_RANK = {
    common: 1,
    uncommon: 2,
    rare: 3,
    mythic: 4,
    bonus: 5,
};

export function isSkippedBoosterType(name) {
    const lc = String(name || "").toLowerCase();
    return SKIP_PATTERNS.some((p) => lc.includes(p));
}

export function isBonusSheetSlot(slotName) {
    const lc = String(slotName || "").toLowerCase();
    return BONUS_SHEET_PATTERNS.some((p) => lc.includes(p));
}

// Pick the booster type to use from `data.booster`. Caller can pass a hint to
// override (e.g. user explicitly chose "play"); otherwise we follow the
// drafting-first preference order.
export function pickBoosterType(boosterRoot, hint) {
    if (!boosterRoot || typeof boosterRoot !== "object") return null;
    const types = Object.keys(boosterRoot);
    if (types.length === 0) return null;

    if (hint && types.includes(hint)) return hint;

    for (const pref of PREFERRED_TYPES) {
        if (types.includes(pref)) return pref;
    }
    const usable = types.find((t) => !isSkippedBoosterType(t));
    return usable || types[0];
}

// List the booster types that are appropriate to expose to the user (drafting-
// suitable). Returns them in preference order.
export function listDraftableBoosterTypes(boosterRoot) {
    if (!boosterRoot) return [];
    const types = Object.keys(boosterRoot).filter((t) => !isSkippedBoosterType(t));
    types.sort((a, b) => {
        const ai = PREFERRED_TYPES.indexOf(a);
        const bi = PREFERRED_TYPES.indexOf(b);
        if (ai === -1 && bi === -1) return a.localeCompare(b);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
    });
    return types;
}

// Whether a set's MTGJSON data has any drafting-suitable booster type.
export function hasDraftableBooster(setData) {
    const booster = setData?.booster || setData?.data?.booster;
    if (!booster) return false;
    return listDraftableBoosterTypes(booster).length > 0;
}

// Build an index from MTGJSON uuid → card record for O(1) lookups during sampling.
export function buildCardIndex(cards) {
    const idx = new Map();
    if (!Array.isArray(cards)) return idx;
    for (const c of cards) {
        if (c?.uuid) idx.set(c.uuid, c);
    }
    return idx;
}

// Merge additional cards into an existing card index. First-write-wins so the
// primary set's printings stay authoritative if a supplemental set happens to
// share UUIDs (it shouldn't, but guard anyway).
export function mergeCardsIntoIndex(idx, cards) {
    if (!Array.isArray(cards)) return idx;
    for (const c of cards) {
        if (c?.uuid && !idx.has(c.uuid)) idx.set(c.uuid, c);
    }
    return idx;
}

// Walk every sheet across every draftable booster type and return the set of
// UUIDs that aren't resolvable in the current cardIndex. Used to decide whether
// we need to pull supplemental sets (e.g. TLA's `sourceMaterial` sheet lives in
// TLE).
export function collectMissingSheetUuids(boosterRoot, cardIndex) {
    const missing = new Set();
    if (!boosterRoot) return missing;
    for (const type of listDraftableBoosterTypes(boosterRoot)) {
        const sheets = boosterRoot[type]?.sheets || {};
        for (const sheet of Object.values(sheets)) {
            for (const uuid of Object.keys(sheet?.cards || {})) {
                if (!cardIndex.has(uuid)) missing.add(uuid);
            }
        }
    }
    return missing;
}

// Pick one item by weight. items: [{ value, weight }]. Returns the chosen value.
function pickWeighted(items, rng) {
    if (items.length === 0) return null;
    let total = 0;
    for (const it of items) total += it.weight;
    if (total <= 0) {
        return items[Math.floor(rng() * items.length)].value;
    }
    let r = rng() * total;
    for (const it of items) {
        r -= it.weight;
        if (r <= 0) return it.value;
    }
    return items[items.length - 1].value;
}

// Sample `count` distinct cards from a sheet, weighted by sheet weights.
// Falls back to with-replacement if the sheet is too small to satisfy count.
function sampleSheetCards(sheet, count, rng, opts) {
    const cardEntries = Object.entries(sheet?.cards || {});
    if (cardEntries.length === 0 || count <= 0) return [];

    const items = cardEntries.map(([uuid, weight]) => ({ value: uuid, weight }));
    const balance = sheet.balanceColors && opts?.cardIndex ? buildColorBuckets(items, opts.cardIndex) : null;

    const picked = [];
    const seen = new Set();

    if (balance) {
        // First pass: one card per color bucket (W, U, B, R, G) if available and we
        // still need more cards. This is how Play Booster commons enforce one of
        // each color before the remaining commons are random.
        for (const color of ["W", "U", "B", "R", "G"]) {
            if (picked.length >= count) break;
            const pool = balance[color]?.filter((it) => !seen.has(it.value)) || [];
            if (pool.length === 0) continue;
            const choice = pickWeighted(pool, rng);
            if (choice && !seen.has(choice)) {
                picked.push(choice);
                seen.add(choice);
            }
        }
    }

    // Remaining picks: weighted-without-replacement against the full sheet.
    while (picked.length < count) {
        const remaining = items.filter((it) => !seen.has(it.value));
        if (remaining.length === 0) {
            // Sheet exhausted (very small sheet); fall back to with-replacement
            // from the full sheet so we still hit the requested count.
            const choice = pickWeighted(items, rng);
            if (!choice) break;
            picked.push(choice);
            continue;
        }
        const choice = pickWeighted(remaining, rng);
        if (!choice) break;
        picked.push(choice);
        seen.add(choice);
    }

    return picked;
}

function buildColorBuckets(items, cardIndex) {
    const buckets = { W: [], U: [], B: [], R: [], G: [] };
    for (const it of items) {
        const card = cardIndex.get(it.value);
        if (!card) continue;
        const colors = Array.isArray(card.colors) ? card.colors : [];
        if (colors.length === 1 && buckets[colors[0]]) {
            buckets[colors[0]].push(it);
        }
    }
    return buckets;
}

// Pick which pack-config (slot template) to roll, weighted by config weight.
function pickPackConfig(typeRoot, rng) {
    const configs = Array.isArray(typeRoot.boosters) ? typeRoot.boosters : [];
    if (configs.length === 0) return null;
    const items = configs.map((c) => ({ value: c, weight: c.weight || 1 }));
    return pickWeighted(items, rng);
}

// Roll a single pack. Returns the cards in slot order and metadata for the UI.
//
// rng: () => number in [0, 1). Defaults to Math.random.
export function rollPack(boosterRoot, type, cardIndex, rng = Math.random) {
    const typeRoot = boosterRoot?.[type];
    if (!typeRoot) {
        throw new Error(`Booster type "${type}" not found`);
    }

    const config = pickPackConfig(typeRoot, rng);
    if (!config) {
        throw new Error(`No pack configurations for booster type "${type}"`);
    }

    const sheets = typeRoot.sheets || {};
    const cards = [];
    let hasBonus = false;
    let topRank = 0;
    let topRarity = "common";

    // Iterate slots in the order MTGJSON gave us so the "story" of the pack
    // (commons → uncommon → rare → foil) is preserved for the reveal animation.
    for (const [slotName, slotCount] of Object.entries(config.contents || {})) {
        const sheet = sheets[slotName];
        if (!sheet) continue;
        const isFoil = !!sheet.foil;
        const isBonus = isBonusSheetSlot(slotName);
        if (isBonus) hasBonus = true;

        const drawn = sampleSheetCards(sheet, slotCount, rng, { cardIndex });
        for (const uuid of drawn) {
            const card = cardIndex.get(uuid);
            const rarity = card?.rarity || "common";
            cards.push({
                mtgjsonUuid: uuid,
                scryfallId: card?.identifiers?.scryfallId || null,
                name: card?.name || "Unknown Card",
                number: card?.number || "",
                rarity,
                colors: card?.colors || [],
                isFoil,
                isBonusSheet: isBonus,
                slot: slotName,
            });

            // Track the most exciting thing in the pack for the animation tier.
            const tier = isBonus ? "bonus" : rarity;
            const rank = ANIM_TIER_RANK[tier] || 0;
            if (rank > topRank) {
                topRank = rank;
                topRarity = tier;
            }
        }
    }

    return {
        boosterType: type,
        config,
        cards,
        hasBonusSheet: hasBonus,
        rarestTier: topRarity,
    };
}

// Convenience: roll N packs, returning an array.
export function rollPacks(boosterRoot, type, cardIndex, count, rng = Math.random) {
    const out = [];
    for (let i = 0; i < count; i++) out.push(rollPack(boosterRoot, type, cardIndex, rng));
    return out;
}

// Determine the "headline rarity" across an array of packs. Used for badges
// (e.g. "this draft contains a Special Guest").
export function summarizePackCards(cards) {
    let topRank = 0;
    let topRarity = "common";
    for (const c of cards) {
        const tier = c.isBonusSheet ? "bonus" : c.rarity;
        const rank = ANIM_TIER_RANK[tier] || 0;
        if (rank > topRank) {
            topRank = rank;
            topRarity = tier;
        }
    }
    return topRarity;
}

// Mulberry32 — small, fast, deterministic PRNG. Used for tests and "replay"
// in case we ever want shareable draft seeds.
export function makeSeededRng(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export const _internals = {
    pickWeighted,
    sampleSheetCards,
    pickPackConfig,
    buildColorBuckets,
    RARITY_RANK,
    ANIM_TIER_RANK,
};
