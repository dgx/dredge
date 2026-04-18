// Parse Cockatrice / Scryfall-style mana cost strings into tokens.
// Handles raw form "2WW", bracketed hybrids "{U/B}", and split cards "G // 2W".

export function parseCost(str) {
    const tokens = [];
    let i = 0;
    while (i < str.length) {
        const ch = str[i];
        if (ch === "{") {
            const end = str.indexOf("}", i);
            if (end === -1) { i++; continue; }
            tokens.push(str.slice(i + 1, end));
            i = end + 1;
        } else if (/\d/.test(ch)) {
            let j = i;
            while (j < str.length && /\d/.test(str[j])) j++;
            tokens.push(str.slice(i, j));
            i = j;
        } else if (/[A-Za-z]/.test(ch)) {
            tokens.push(ch);
            i++;
        } else {
            i++;
        }
    }
    return tokens;
}

export function splitSides(cost) {
    if (!cost) return [];
    return cost.split(" // ").map(parseCost);
}

// Map a mana token (e.g. "W", "2", "U/B", "G/W/P", "T") to mana-font classes.
export function tokenClass(token) {
    const t = String(token).toLowerCase();
    if (t === "t") return ["ms-tap"];
    if (t === "q") return ["ms-untap"];
    if (t === "chaos") return ["ms-chaos"];
    if (t.includes("/")) return [`ms-${t.replace(/\//g, "")}`, "ms-split"];
    return [`ms-${t}`];
}

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

// Replace {X} tokens in oracle text with <i class="ms ms-..."></i> icons.
// Returns HTML; caller is responsible for using v-html on trusted input.
export function renderOracleHtml(text) {
    if (!text) return "";
    return escapeHtml(text).replace(/\{([^}]+)\}/g, (_, tok) => {
        const classes = ["ms", ...tokenClass(tok)].join(" ");
        return `<i class="${classes}"></i>`;
    });
}
