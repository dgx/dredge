const CMC_ORDER = ["0", "1", "2", "3", "4", "5", "6", "7+", "land"];
const CMC_LABELS = {
    0: "Mana",
    1: "Mana",
    2: "Mana",
    3: "Mana",
    4: "Mana",
    5: "Mana",
    6: "Mana",
    "7+": "Mana",
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

export const TYPE_ORDER = [
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

export function typeKey(card) {
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

const GROUP_DEFS = {
    cmc: { keyFn: cmcKey, order: CMC_ORDER, labels: CMC_LABELS },
    color: { keyFn: colorKey, order: COLOR_ORDER, labels: COLOR_LABELS },
    type: {
        keyFn: typeKey,
        order: TYPE_ORDER,
        labels: Object.fromEntries(TYPE_ORDER.map((t) => [t, t])),
    },
};

function normalizeLevels(groupBy) {
    const raw = Array.isArray(groupBy) ? groupBy : [groupBy];
    const seen = new Set();
    const levels = [];
    for (const g of raw) {
        if (!g || g === "none" || !GROUP_DEFS[g] || seen.has(g)) continue;
        seen.add(g);
        levels.push(g);
    }
    return levels;
}

function groupRecursive(stacks, levels, depth) {
    const level = levels[depth];
    const { keyFn, order, labels } = GROUP_DEFS[level];
    const isLeaf = depth === levels.length - 1;

    const buckets = new Map();
    for (const stack of stacks) {
        const key = keyFn(stack.card);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(stack);
    }

    const result = [];
    for (const key of order) {
        if (!buckets.has(key)) continue;
        const groupStacks = buckets.get(key);
        const entry = {
            key,
            label: labels[key] || key,
            groupBy: level,
            depth,
        };
        if (isLeaf) {
            groupStacks.sort((a, b) => {
                const cmcDiff = (a.card.cmc || 0) - (b.card.cmc || 0);
                if (cmcDiff !== 0) return cmcDiff;
                return a.card.name.localeCompare(b.card.name);
            });
            entry.stacks = groupStacks;
        } else {
            entry.children = groupRecursive(groupStacks, levels, depth + 1);
        }
        result.push(entry);
    }
    return result;
}

export function groupCards(stacks, groupBy) {
    const levels = normalizeLevels(groupBy);
    if (levels.length === 0) {
        return stacks.length
            ? [{ key: "all", label: "All", groupBy: null, depth: 0, stacks: [...stacks] }]
            : [];
    }
    return groupRecursive(stacks, levels, 0);
}
