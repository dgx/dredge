const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const zlib = require("zlib");
const { Readable, Transform, Writable } = require("stream");
const { pipeline } = require("stream/promises");
const chain = require("stream-chain");
const { parser } = require("stream-json/parser.js");
const { pick } = require("stream-json/filters/pick.js");
const { streamObject } = require("stream-json/streamers/stream-object.js");
const { createSlimBuilder } = require("./cardDbTransform.cjs");

const isDev = process.env.NODE_ENV === "development";

// Remove default menu
Menu.setApplicationMenu(null);

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        frame: false,
        icon: path.join(__dirname, "..", "build", "icon.png"),
        titleBarStyle: "hidden",
        titleBarOverlay: {
            color: "#221a15",
            symbolColor: "#c9a14a",
            height: 39,
        },
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (isDev) {
        mainWindow.loadURL("http://localhost:5173");
    } else {
        mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
    }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// --- IPC Handlers ---

// Image cache directory
function getCacheDir() {
    return path.join(app.getPath("userData"), "imageCache");
}

function ensureCacheDir(setCode) {
    const dir = path.join(getCacheDir(), setCode);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

ipcMain.handle("image:getCached", async (event, setCode, fileName) => {
    const filePath = path.join(getCacheDir(), setCode, fileName);
    if (fs.existsSync(filePath)) {
        const data = await fs.promises.readFile(filePath);
        return `data:image/jpeg;base64,${data.toString("base64")}`;
    }
    return null;
});

ipcMain.handle("image:download", async (event, url, setCode, fileName) => {
    const dir = ensureCacheDir(setCode);
    const filePath = path.join(dir, fileName);

    // Already cached
    if (fs.existsSync(filePath)) {
        const data = await fs.promises.readFile(filePath);
        return `data:image/jpeg;base64,${data.toString("base64")}`;
    }

    const res = await fetch(url, {
        headers: {
            "User-Agent": "Dredge/0.1",
            "Accept": "image/*",
        },
    });

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.promises.writeFile(filePath, buffer);
    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
});

ipcMain.handle("cache:getPath", () => getCacheDir());

// --- MTGJSON booster data ---

const MTGJSON_BASE = "https://mtgjson.com/api/v5";
const SETLIST_TTL_MS = 24 * 60 * 60 * 1000; // 24h — new sets release on a slow cadence

function getBoosterCacheDir() {
    const dir = path.join(app.getPath("userData"), "boosterCache");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

async function fetchJson(url) {
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Dredge/0.1",
            "Accept": "application/json",
        },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return res.json();
}

ipcMain.handle("mtgjson:fetchSetList", async () => {
    const filePath = path.join(getBoosterCacheDir(), "SetList.json");
    if (fs.existsSync(filePath)) {
        const stat = await fs.promises.stat(filePath);
        if (Date.now() - stat.mtimeMs < SETLIST_TTL_MS) {
            const text = await fs.promises.readFile(filePath, "utf-8");
            return JSON.parse(text);
        }
    }
    const json = await fetchJson(`${MTGJSON_BASE}/SetList.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(json));
    return json;
});

ipcMain.handle("mtgjson:fetchSet", async (event, setCode) => {
    const code = String(setCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code) throw new Error("setCode required");
    const filePath = path.join(getBoosterCacheDir(), `${code}.json`);
    if (fs.existsSync(filePath)) {
        const text = await fs.promises.readFile(filePath, "utf-8");
        return JSON.parse(text);
    }
    const json = await fetchJson(`${MTGJSON_BASE}/${code}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(json));
    return json;
});

// --- Card database (MTGJSON AllPrintings) ---

function getCardDbCacheDir() {
    const dir = path.join(app.getPath("userData"), "cardCache");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function reportProgress(sender, payload) {
    if (sender && !sender.isDestroyed()) {
        sender.send("cardDb:progress", payload);
    }
}

async function streamBuildSlim(url, sender) {
    const res = await fetch(url, {
        headers: { "User-Agent": "Dredge/0.1" },
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const totalBytes = Number(res.headers.get("content-length")) || 0;

    let bytesReceived = 0;
    let lastReport = 0;

    const meter = new Transform({
        transform(chunk, _enc, cb) {
            bytesReceived += chunk.length;
            const now = Date.now();
            if (now - lastReport > 100) {
                lastReport = now;
                reportProgress(sender, { phase: "downloading", bytesReceived, totalBytes });
            }
            cb(null, chunk);
        },
    });

    const builder = createSlimBuilder();
    const sink = new Writable({
        objectMode: true,
        write({ key, value }, _enc, cb) {
            try {
                builder.addSet(key, value);
                cb();
            } catch (err) {
                cb(err);
            }
        },
    });

    const tokenizer = chain([
        parser(),
        pick({ filter: "data" }),
        streamObject(),
    ]);

    await pipeline(
        Readable.fromWeb(res.body),
        meter,
        zlib.createGunzip(),
        tokenizer,
        sink
    );
    reportProgress(sender, { phase: "downloading", bytesReceived, totalBytes });

    reportProgress(sender, { phase: "parsing" });
    return builder.finalize();
}

ipcMain.handle("cardDb:load", async (event) => {
    const sender = event.sender;
    const cacheDir = getCardDbCacheDir();
    const slimPath = path.join(cacheDir, "cards-db.json");
    const metaPath = path.join(cacheDir, "meta.json");

    reportProgress(sender, { phase: "checking" });

    let upstreamMeta = null;
    try {
        upstreamMeta = await fetchJson(`${MTGJSON_BASE}/Meta.json`);
    } catch (err) {
        if (fs.existsSync(slimPath)) {
            const text = await fs.promises.readFile(slimPath, "utf-8");
            const slim = JSON.parse(text);
            reportProgress(sender, { phase: "done" });
            return slim;
        }
        throw err;
    }

    const upstreamVersion = upstreamMeta?.data?.version || "";
    let cachedVersion = "";
    if (fs.existsSync(metaPath) && fs.existsSync(slimPath)) {
        try {
            const cached = JSON.parse(await fs.promises.readFile(metaPath, "utf-8"));
            cachedVersion = cached.version || "";
        } catch {
            cachedVersion = "";
        }
    }

    if (cachedVersion && cachedVersion === upstreamVersion) {
        const text = await fs.promises.readFile(slimPath, "utf-8");
        const slim = JSON.parse(text);
        reportProgress(sender, { phase: "done" });
        return slim;
    }

    reportProgress(sender, { phase: "downloading", bytesReceived: 0, totalBytes: 0 });
    const slim = await streamBuildSlim(`${MTGJSON_BASE}/AllPrintings.json.gz`, sender);

    reportProgress(sender, { phase: "writing" });
    await fs.promises.writeFile(slimPath, JSON.stringify(slim));
    await fs.promises.writeFile(metaPath, JSON.stringify({ version: upstreamVersion }));

    reportProgress(sender, { phase: "done" });
    return slim;
});
