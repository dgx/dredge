import { isLand } from "./cardGrouping";

const TYPE_ORDER = [
    "Artifact",
    "Battle",
    "Creature",
    "Enchantment",
    "Instant",
    "Land",
    "Planeswalker",
    "Sorcery",
    "Other",
];

function typeCategory(card) {
    const typeStr = card.type || "";
    const main = (card.mainType || typeStr.split(/[\s—-]/)[0] || "").trim();
    for (const t of TYPE_ORDER) {
        if (main === t) return t;
    }
    for (const t of TYPE_ORDER) {
        if (t !== "Other" && new RegExp(`\\b${t}\\b`, "i").test(typeStr)) {
            return t;
        }
    }
    return "Other";
}

function formatLine(prefix, count, card) {
    const set = (card.poolSetCode || card.bestSet || "").toUpperCase();
    const num = card.poolNumber || "";
    let line = `${prefix}${count} ${card.name}`;
    if (set) line += ` (${set})`;
    if (num) line += ` ${num}`;
    return line;
}

function sortTypeKeys(keys) {
    return [...keys].sort((a, b) => {
        if (a === "Other") return 1;
        if (b === "Other") return -1;
        return a.localeCompare(b);
    });
}

function emitSection(lines, entries, prefix) {
    const buckets = new Map();
    for (const e of entries) {
        const key = typeCategory(e.card);
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(e);
    }

    const keys = sortTypeKeys(buckets.keys());
    keys.forEach((key, i) => {
        const bucket = buckets.get(key);
        const total = bucket.reduce((s, e) => s + e.count, 0);
        if (i > 0) lines.push("");
        lines.push(`// ${total} ${key}`);
        bucket.sort((a, b) => a.card.name.localeCompare(b.card.name));
        for (const e of bucket) {
            lines.push(formatLine(prefix, e.count, e.card));
        }
    });
}

function todayStamp() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}.${m}.${day}`;
}

export function exportDeck({ poolStacks, basicLands, basicLandNames, title }) {
    const maindeck = [];
    const sideboard = [];

    for (const stack of poolStacks) {
        if (stack.inDeck > 0) {
            maindeck.push({ card: stack.card, count: stack.inDeck });
        }
        if (stack.available > 0) {
            sideboard.push({ card: stack.card, count: stack.available });
        }
    }

    for (const color of Object.keys(basicLands)) {
        const n = basicLands[color] || 0;
        if (n <= 0) continue;
        const name = basicLandNames[color];
        maindeck.push({
            card: { name, type: "Basic Land", mainType: "Land" },
            count: n,
        });
    }

    const lines = [];
    const header = title || `Sealed ${todayStamp()}`;
    lines.push(`// ${header}`);
    lines.push("");

    if (sideboard.length > 0) {
        const total = sideboard.reduce((s, e) => s + e.count, 0);
        lines.push(`// ${total} Sideboard`);
        emitSection(lines, sideboard, "SB: ");
        lines.push("");
        lines.push("");
    }

    if (maindeck.length > 0) {
        const total = maindeck.reduce((s, e) => s + e.count, 0);
        lines.push(`// ${total} Maindeck`);
        emitSection(lines, maindeck, "");
    }

    return lines.join("\n");
}
