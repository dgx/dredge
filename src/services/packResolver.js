// Resolves opened-pack cards (MTGJSON shape) into pool entries that the
// existing sealed-pool / deck-builder code can consume unchanged. The image
// loader keys off Scryfall IDs (which MTGJSON exposes per printing), so the
// actual lookup is straightforward when the card is in the local DB; we
// synthesize a minimal stand-in when it isn't (e.g. cached card data is
// older than the set being opened).

// Build an index from Scryfall printing UUID → { card, printing } across all
// printings of every card. Used to recover the right printing for image
// lookups when MTGJSON tells us a specific (setCode, number) combination.
export function buildScryfallIndex(allCards) {
    const idx = new Map();
    for (const card of allCards || []) {
        for (const printing of card.sets || []) {
            if (printing.uuid) idx.set(printing.uuid, { card, printing });
        }
    }
    return idx;
}

let poolCounter = 0;

function nextPoolId() {
    return `pack-${poolCounter++}`;
}

// Build a synthetic card-like object for cards missing from the local DB. The
// image loader can still fetch from Scryfall via the embedded uuid, and the
// rest of the UI just needs name/rarity/colors to render.
function synthesizeCard(packCard, setCode) {
    const colorString = Array.isArray(packCard.colors) ? packCard.colors.join("") : "";
    const setEntry = {
        code: setCode,
        uuid: packCard.scryfallId || "",
        muid: "",
        picUrl: "",
        num: packCard.number || "",
        rarity: packCard.rarity || "",
    };
    return {
        name: packCard.name,
        text: "",
        manaCost: "",
        cmc: 0,
        type: "",
        mainType: "",
        colors: colorString,
        colorIdentity: colorString,
        pt: "",
        loyalty: "",
        layout: "normal",
        side: "",
        sets: [setEntry],
        bestSet: setCode,
        uuid: packCard.scryfallId || "",
        rarity: packCard.rarity || "common",
    };
}

// Convert one pack card into a pool entry.
export function resolvePackCard(packCard, setCode, scryfallIndex) {
    let card;
    let printing;

    if (packCard.scryfallId && scryfallIndex.has(packCard.scryfallId)) {
        const hit = scryfallIndex.get(packCard.scryfallId);
        card = hit.card;
        printing = hit.printing;
    } else {
        card = synthesizeCard(packCard, setCode);
        printing = card.sets[0];
    }

    const packMeta = {
        slot: packCard.slot,
        isFoil: !!packCard.isFoil,
        isBonusSheet: !!packCard.isBonusSheet,
        fromSet: setCode,
        // MTGJSON top-level types (e.g. ["Land"], ["Land", "Sorcery"] for
        // adventure / DFC). Authoritative for reveal-order classification —
        // works whether or not the card is in the local DB.
        types: Array.isArray(packCard.types) ? packCard.types : [],
    };

    return {
        ...card,
        uuid: printing.uuid || card.uuid,
        rarity: printing.rarity || card.rarity || packCard.rarity || "common",
        bestSet: printing.code || setCode,
        // Restrict sets[] to the actual printing so the image loader's
        // "preferred printing" pick lands on the one we just opened.
        sets: [printing],
        poolId: nextPoolId(),
        poolSetCode: setCode,
        poolNumber: printing.num || packCard.number || "",
        poolFoil: !!packCard.isFoil,
        packMeta,
    };
}

// Reveal-order priority. Lower flips first; the final entry is the climax
// card that the pack-opener syncs the flourish + tier glow + particles to.
//   • Tokens and lands flip first — they're the throwaway preamble.
//   • Then commons → uncommons → rares → mythics, each tier raising the
//     stakes as the user goes.
//   • Bonus-sheet cards (Special Guest etc.) close the pack regardless of
//     printed rarity — they're the headline.
// Land/token detection consults MTGJSON's top-level `types` array first
// (authoritative even when the card isn't in the local DB), then the slot
// name, then the local card's type fields. Without the types check
// nonbasic lands drawn from non-land slots (e.g. FIN's Capital City coming
// from `uncommon`, Ishgard from `wildcard`) would fall through to the rarity
// bucket and flip in the wrong place.
function revealPriority(card) {
    if (card.packMeta?.isBonusSheet) return 60;

    const metaTypes = card.packMeta?.types || [];
    const slot = String(card.packMeta?.slot || "").toLowerCase();
    const typeStr = `${card.type || ""} ${card.mainType || ""}`;
    const isToken =
        metaTypes.includes("Token") ||
        /token/.test(slot) ||
        /\bToken\b/.test(typeStr);
    if (isToken) return 0;
    const isLand =
        metaTypes.includes("Land") ||
        /land/.test(slot) ||
        /\bLand\b/.test(typeStr);
    if (isLand) return 10;

    switch (card.rarity) {
        case "mythic": return 50;
        case "rare": return 40;
        case "uncommon": return 30;
        case "common": return 20;
        default: return 25;
    }
}

// Convert a pack (output of rollPack) + its setCode into pool entries, sorted
// for the reveal animation: throwaways first, climax card last. JS sort is
// stable so cards within the same priority bucket keep their simulator order.
export function resolvePack(pack, setCode, scryfallIndex) {
    const entries = pack.cards.map((c) => resolvePackCard(c, setCode, scryfallIndex));
    entries.sort((a, b) => revealPriority(a) - revealPriority(b));
    return entries;
}

// For tests so counters don't bleed between cases.
export function _resetPoolCounter() {
    poolCounter = 0;
}
