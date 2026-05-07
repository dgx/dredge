// One-off audit: fetch every draftable set's MTGJSON file, summarize what
// booster types each set defines, and flag what the current SKIP_PATTERNS
// would exclude. Reuses the live app's disk cache at %APPDATA%/dredge/boosterCache.

const fs = require("fs");
const path = require("path");
const os = require("os");

const MTGJSON_BASE = "https://mtgjson.com/api/v5";
const CACHE_DIR = path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
    "dredge",
    "boosterCache"
);

const DRAFTABLE_SET_TYPES = new Set([
    "expansion",
    "core",
    "masters",
    "draft_innovation",
    "starter",
    "funny",
    "commander",
]);

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

function whichSkip(name) {
    const lc = String(name || "").toLowerCase();
    return SKIP_PATTERNS.find((p) => lc.includes(p)) || null;
}

async function fetchJson(url) {
    const res = await fetch(url, {
        headers: { "User-Agent": "Dredge-Audit/0.1", Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    return res.json();
}

async function loadSetList() {
    const filePath = path.join(CACHE_DIR, "SetList.json");
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const json = await fetchJson(`${MTGJSON_BASE}/SetList.json`);
    fs.writeFileSync(filePath, JSON.stringify(json));
    return json;
}

async function loadSet(code) {
    const filePath = path.join(CACHE_DIR, `${code}.json`);
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
    const json = await fetchJson(`${MTGJSON_BASE}/${code}.json`);
    fs.writeFileSync(filePath, JSON.stringify(json));
    return json;
}

async function pMapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let i = 0;
    const workers = Array.from({ length: limit }, async () => {
        while (true) {
            const idx = i++;
            if (idx >= items.length) return;
            try {
                out[idx] = await fn(items[idx], idx);
            } catch (err) {
                out[idx] = { __error: err.message || String(err) };
            }
        }
    });
    await Promise.all(workers);
    return out;
}

(async () => {
    const setList = await loadSetList();
    const all = (setList.data || [])
        .filter((s) => DRAFTABLE_SET_TYPES.has(s.type))
        .filter((s) => !s.isOnlineOnly)
        .filter((s) => (s.baseSetSize || 0) > 0)
        .sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));

    console.error(`[audit] ${all.length} draftable sets to inspect`);

    let done = 0;
    const results = await pMapLimit(all, 8, async (s) => {
        const json = await loadSet(s.code);
        done++;
        if (done % 50 === 0) console.error(`[audit] ${done}/${all.length}`);
        const booster = json?.data?.booster || json?.booster || {};
        const types = Object.keys(booster);
        return {
            code: s.code,
            name: s.name,
            type: s.type,
            releaseDate: s.releaseDate || "",
            boosterTypes: types,
        };
    });

    const noBooster = [];
    const onlySkipped = [];
    const okTypes = [];
    const allBoosterTypeCounts = new Map();

    for (const r of results) {
        if (r.__error) {
            console.error(`[audit] error: ${r.__error}`);
            continue;
        }
        for (const t of r.boosterTypes) {
            allBoosterTypeCounts.set(t, (allBoosterTypeCounts.get(t) || 0) + 1);
        }
        if (r.boosterTypes.length === 0) {
            noBooster.push(r);
            continue;
        }
        const survived = r.boosterTypes.filter((t) => !whichSkip(t));
        if (survived.length === 0) {
            onlySkipped.push(r);
        } else {
            okTypes.push(r);
        }
    }

    const report = {
        summary: {
            totalSets: results.length,
            setsWithNoBoosterAtAll: noBooster.length,
            setsExcludedBySkipPatternsOnly: onlySkipped.length,
            setsWithDraftableTypesUnderCurrentRules: okTypes.length,
        },
        boosterTypeFrequency: Object.fromEntries(
            [...allBoosterTypeCounts.entries()].sort((a, b) => b[1] - a[1])
        ),
        skipPatternImpact: SKIP_PATTERNS.map((p) => ({
            pattern: p,
            matchedTypes: [...allBoosterTypeCounts.keys()]
                .filter((t) => t.toLowerCase().includes(p))
                .sort(),
        })),
        setsWithNoBoosterAtAll: noBooster.map((r) => ({
            code: r.code,
            name: r.name,
            type: r.type,
            releaseDate: r.releaseDate,
        })),
        setsExcludedOnlyBySkipPatterns: onlySkipped.map((r) => ({
            code: r.code,
            name: r.name,
            type: r.type,
            releaseDate: r.releaseDate,
            boosterTypes: r.boosterTypes,
            wouldSurviveIfWeAllowed: r.boosterTypes.map((t) => ({
                type: t,
                killedBy: whichSkip(t),
            })),
        })),
    };

    const outPath = path.join(__dirname, "..", "booster-audit.json");
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.error(`[audit] wrote ${outPath}`);
    console.log(JSON.stringify(report.summary, null, 2));
    console.log("\nBooster type frequency (top 30):");
    for (const [t, n] of Object.entries(report.boosterTypeFrequency).slice(0, 30)) {
        console.log(`  ${n.toString().padStart(4)}  ${t}`);
    }
    console.log("\nSets with NO booster data at all:");
    for (const s of report.setsWithNoBoosterAtAll) {
        console.log(`  ${s.code.padEnd(6)} ${s.releaseDate.padEnd(10)} ${s.type.padEnd(20)} ${s.name}`);
    }
    console.log("\nSets excluded ONLY because of SKIP_PATTERNS:");
    for (const s of report.setsExcludedOnlyBySkipPatterns) {
        console.log(`  ${s.code.padEnd(6)} ${s.releaseDate.padEnd(10)} ${s.type.padEnd(20)} ${s.name}`);
        console.log(`         types: ${s.boosterTypes.join(", ")}`);
    }
})();
