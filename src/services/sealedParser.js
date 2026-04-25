const LINE_RE = /^(\d+)\s+(.+?)\s+\[([A-Za-z0-9]+):([^\]]+)\]\s*(?:\[([^\]]+)\])?\s*$/;

export function parseSealedPool(text) {
    const entries = [];
    const errors = [];

    const lines = text.split(/\r?\n/);
    for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        if (line.startsWith("//") || line.startsWith("#")) continue;

        const match = line.match(LINE_RE);
        if (!match) {
            errors.push(line);
            continue;
        }

        const [, count, name, setCode, number, tag] = match;
        entries.push({
            count: parseInt(count, 10),
            name: name.trim(),
            setCode: setCode.toUpperCase(),
            number: number.trim(),
            foil: tag ? tag.trim().toLowerCase() === "foil" : false,
        });
    }

    return { entries, errors };
}
