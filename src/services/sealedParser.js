// Cockatrice: "1 Card Name [SET:number] [foil]?"
const COCKATRICE_RE = /^(\d+)\s+(.+?)\s+\[([A-Za-z0-9]+):([^\]]+)\]\s*(?:\[([^\]]+)\])?\s*$/;
// MTGA / our exporter: "1 Card Name (SET) number [*F*]?"
const MTGA_RE = /^(\d+)\s+(.+?)\s+\(([A-Za-z0-9]+)\)\s+(\S+)(\s+\*?[Ff]\*?)?\s*$/;
// Bare "count name" — used for basic lands that have no set/number
const BARE_RE = /^(\d+)\s+(.+)$/;

const BASIC_LAND_TO_COLOR = {
    plains: "W",
    island: "U",
    swamp: "B",
    mountain: "R",
    forest: "G",
    wastes: "C",
};

export function parseSealedPool(text) {
    const entries = [];
    const errors = [];
    const basicLands = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    // Signals that the paste came from a deck export (vs. a raw sealed pool).
    let hasSideboard = false;
    let hasComment = false;
    let hasBareBasicLand = false;

    const lines = text.split(/\r?\n/);
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith("//") || line.startsWith("#")) {
            hasComment = true;
            continue;
        }

        const sb = /^SB:\s*/i.exec(line);
        const section = sb ? "sideboard" : "main";
        if (sb) hasSideboard = true;
        const body = sb ? line.slice(sb[0].length) : line;

        let m = body.match(COCKATRICE_RE);
        if (m) {
            const [, count, name, setCode, number, tag] = m;
            entries.push({
                count: parseInt(count, 10),
                name: name.trim(),
                setCode: setCode.toUpperCase(),
                number: number.trim(),
                foil: tag ? tag.trim().toLowerCase() === "foil" : false,
                section,
            });
            continue;
        }

        m = body.match(MTGA_RE);
        if (m) {
            const [, count, name, setCode, number, foilTag] = m;
            entries.push({
                count: parseInt(count, 10),
                name: name.trim(),
                setCode: setCode.toUpperCase(),
                number: number.trim(),
                foil: !!foilTag,
                section,
            });
            continue;
        }

        m = body.match(BARE_RE);
        if (m && !/[\[\(]/.test(body)) {
            const [, count, name] = m;
            const color = BASIC_LAND_TO_COLOR[name.trim().toLowerCase()];
            if (color) {
                hasBareBasicLand = true;
                if (section === "main") basicLands[color] += parseInt(count, 10);
                continue;
            }
        }

        errors.push(line);
    }

    const looksLikeDeck = hasSideboard || hasComment || hasBareBasicLand;
    return { entries, basicLands, errors, looksLikeDeck };
}
