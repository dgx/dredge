// Resolves drafted pack cards (MTGJSON shape) into pool entries that the
// existing sealed-pool / deck-builder code can consume unchanged. The image
// loader keys off Scryfall IDs which both Cockatrice and MTGJSON use, so the
// actual lookup is straightforward when the card is in the local DB; we
// synthesize a minimal stand-in when it isn't (e.g. user's Cockatrice DB is
// older than the set being drafted).

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
    return `draft-${poolCounter++}`;
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
export function resolveDraftCard(packCard, setCode, scryfallIndex) {
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

    const draftMeta = {
        slot: packCard.slot,
        isFoil: !!packCard.isFoil,
        isBonusSheet: !!packCard.isBonusSheet,
        fromSet: setCode,
    };

    return {
        ...card,
        uuid: printing.uuid || card.uuid,
        rarity: printing.rarity || card.rarity || packCard.rarity || "common",
        bestSet: printing.code || setCode,
        // Restrict sets[] to the actual printing so the image loader's
        // "preferred printing" pick lands on the one we just drafted.
        sets: [printing],
        poolId: nextPoolId(),
        poolSetCode: setCode,
        poolNumber: printing.num || packCard.number || "",
        poolFoil: !!packCard.isFoil,
        draftMeta,
    };
}

// Reveal-order priority. Lower comes out first.
//   • Bonus-sheet cards (Special Guest etc.) lead — they're the headline
//     regardless of printed rarity.
//   • Then mythic → rare → uncommon → common.
//   • Lands and tokens go last so the rares aren't buried behind basics.
// Slot name is the most reliable land/token signal (e.g. "nonFoilLand",
// "foilLand"); we fall back to the card's type for cards whose slot doesn't
// say so.
function revealPriority(card) {
    if (card.draftMeta?.isBonusSheet) return 0;

    const slot = String(card.draftMeta?.slot || "").toLowerCase();
    const typeStr = `${card.type || ""} ${card.mainType || ""}`;
    const isToken = /token/.test(slot) || /\bToken\b/.test(typeStr);
    if (isToken) return 100;
    const isLand = /land/.test(slot) || /\bLand\b/.test(typeStr);
    if (isLand) return 90;

    switch (card.rarity) {
        case "mythic": return 10;
        case "rare": return 20;
        case "uncommon": return 30;
        case "common": return 40;
        default: return 50;
    }
}

// Convert a pack (output of rollPack) + its setCode into pool entries, sorted
// for the reveal animation: rarest first, lands/tokens last. JS sort is stable
// so cards within the same priority bucket keep their simulator order.
export function resolvePack(pack, setCode, scryfallIndex) {
    const entries = pack.cards.map((c) => resolveDraftCard(c, setCode, scryfallIndex));
    entries.sort((a, b) => revealPriority(a) - revealPriority(b));
    return entries;
}

// For tests so counters don't bleed between cases.
export function _resetPoolCounter() {
    poolCounter = 0;
}
