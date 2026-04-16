const CMC_ORDER = ["0", "1", "2", "3", "4", "5", "6", "7+", "land"];
const CMC_LABELS = {
    0: "CMC 0",
    1: "CMC 1",
    2: "CMC 2",
    3: "CMC 3",
    4: "CMC 4",
    5: "CMC 5",
    6: "CMC 6",
    "7+": "CMC 7+",
    land: "Land",
};

const COLOR_ORDER = ["W", "U", "B", "R", "G", "multi", "colorless", "land"];
const COLOR_LABELS = {
    W: "White",
    U: "Blue",
    B: "Black",
    R: "Red",
    G: "Green",
    multi: "Multicolor",
    colorless: "Colorless",
    land: "Land",
};

const TYPE_ORDER = [
    "Creature",
    "Planeswalker",
    "Instant",
    "Sorcery",
    "Enchantment",
    "Artifact",
    "Battle",
    "Land",
    "Other",
];

export function isLand(card) {
    if (card.mainType && /land/i.test(card.mainType)) return true;
    if (card.type && /\bland\b/i.test(card.type)) return true;
    return false;
}

function cmcKey(card) {
    if (isLand(card)) return "land";
    const floor = Math.max(0, Math.floor(card.cmc || 0));
    return floor >= 7 ? "7+" : String(floor);
}

function colorKey(card) {
    if (isLand(card)) return "land";
    const colors = (card.colors || "").toUpperCase();
    if (!colors) return "colorless";
    if (colors.length > 1) return "multi";
    return colors;
}

function typeKey(card) {
    const main = card.mainType || (card.type || "").split(/[\s—-]/)[0] || "";
    const normalized = main.trim();
    for (const t of TYPE_ORDER) {
        if (normalized === t) return t;
    }
    // Some type strings may include trailing labels like "Legendary Creature"
    for (const t of TYPE_ORDER) {
        if (t !== "Other" && new RegExp(`\\b${t}\\b`, "i").test(card.type || "")) {
            return t;
        }
    }
    return "Other";
}

export function groupCards(stacks, groupBy) {
    if (groupBy === "none") {
        return stacks.length ? [{ key: "all", label: "All", stacks: [...stacks] }] : [];
    }

    const buckets = new Map();
    const keyFn =
        groupBy === "cmc" ? cmcKey : groupBy === "color" ? colorKey : typeKey;

    for (const stack of stacks) {
        const key = keyFn(stack.card);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(stack);
    }

    let order, labels;
    if (groupBy === "cmc") {
        order = CMC_ORDER;
        labels = CMC_LABELS;
    } else if (groupBy === "color") {
        order = COLOR_ORDER;
        labels = COLOR_LABELS;
    } else {
        order = TYPE_ORDER;
        labels = Object.fromEntries(TYPE_ORDER.map((t) => [t, t]));
    }

    const result = [];
    for (const key of order) {
        if (!buckets.has(key)) continue;
        const groupStacks = buckets.get(key);
        groupStacks.sort((a, b) => {
            const cmcDiff = (a.card.cmc || 0) - (b.card.cmc || 0);
            if (cmcDiff !== 0) return cmcDiff;
            return a.card.name.localeCompare(b.card.name);
        });
        result.push({ key, label: labels[key] || key, stacks: groupStacks });
    }
    return result;
}
