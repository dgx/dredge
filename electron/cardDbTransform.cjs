// Transforms MTGJSON's AllPrintings.json into the slim {sets, cards} shape the
// renderer consumes. MTGJSON groups cards by set; we collapse them by oracle
// name into one entry per card with a `sets[]` array of printings.
//
// CommonJS so the Electron main process can require() it directly. Vite
// middleware and tests import it via interop.
//
// Two consumption modes:
//  - buildSlimDatabase(allPrintings): one-shot in-memory transform (tests).
//  - createSlimBuilder(): incremental, fed one {setKey, set} at a time —
//    used by the streaming JSON parser so we never hold the full
//    AllPrintings object in memory (~400+ MB exceeds V8's max string length
//    on disk-read).

const SKIP_LAYOUTS = new Set([
    "token",
    "double_faced_token",
    "emblem",
    "art_series",
    "scheme",
    "vanguard",
    "planar",
]);

function shouldSkipCard(card) {
    if (!card?.name) return true;
    if (SKIP_LAYOUTS.has(card.layout)) return true;
    if (Array.isArray(card.types) && card.types.includes("Token")) return true;
    return false;
}

function joinChars(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return "";
    return arr.join("");
}

function makePt(card) {
    const p = card.power;
    const t = card.toughness;
    if (p == null && t == null) return "";
    if (p === "" && t === "") return "";
    return `${p ?? ""}/${t ?? ""}`;
}

function canonicalFields(c) {
    return {
        text: c.text || "",
        manaCost: c.manaCost || "",
        cmc: c.manaValue ?? c.convertedManaCost ?? 0,
        type: c.type || "",
        mainType: (Array.isArray(c.types) && c.types[0]) || "",
        colors: joinChars(c.colors),
        colorIdentity: joinChars(c.colorIdentity),
        pt: makePt(c),
        loyalty: c.loyalty || "",
        layout: c.layout || "",
        side: c.side || "",
    };
}

function createSlimBuilder() {
    const sets = {};
    const byName = new Map();

    function addSet(setKey, set) {
        if (!set) return;
        const code = set.code || setKey;
        sets[code] = {
            code,
            longName: set.name || "",
            type: set.type || "",
            releaseDate: set.releaseDate || "",
            priority: 0,
        };

        const cards = Array.isArray(set.cards) ? set.cards : [];
        const release = set.releaseDate || "";

        for (const c of cards) {
            if (shouldSkipCard(c)) continue;

            const printing = {
                code,
                uuid: c.uuid || "",
                num: c.number || "",
                rarity: c.rarity || "",
                picUrl: "",
            };

            const existing = byName.get(c.name);
            if (existing) {
                existing.sets.push(printing);
                if (release > existing._canonicalRelease) {
                    existing._canonicalRelease = release;
                    Object.assign(existing, canonicalFields(c));
                }
            } else {
                byName.set(c.name, {
                    name: c.name,
                    ...canonicalFields(c),
                    sets: [printing],
                    _canonicalRelease: release,
                });
            }
        }
    }

    function finalize() {
        const cards = [];
        for (const card of byName.values()) {
            let best = card.sets[0];
            let bestDate = sets[best.code]?.releaseDate || "";
            for (const p of card.sets) {
                const d = sets[p.code]?.releaseDate || "";
                if (d > bestDate || (d === bestDate && p.code < best.code)) {
                    best = p;
                    bestDate = d;
                }
            }
            delete card._canonicalRelease;
            card.bestSet = best.code;
            card.uuid = best.uuid;
            card.rarity = best.rarity;
            cards.push(card);
        }
        return { sets, cards };
    }

    return { addSet, finalize };
}

function buildSlimDatabase(allPrintings) {
    const builder = createSlimBuilder();
    const data = allPrintings?.data || {};
    for (const k of Object.keys(data)) builder.addSet(k, data[k]);
    return builder.finalize();
}

module.exports = { buildSlimDatabase, createSlimBuilder };
