import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import { Readable, Writable } from "stream";
import { pipeline } from "stream/promises";
import { createRequire } from "module";
import chain from "stream-chain";
import { parser } from "stream-json/parser.js";
import { pick } from "stream-json/filters/pick.js";
import { streamObject } from "stream-json/streamers/stream-object.js";

const require = createRequire(import.meta.url);
const { createSlimBuilder, SCHEMA_VERSION } = require("./electron/cardDbTransform.cjs");

export default defineConfig({
    plugins: [
        vue(),
        vuetify({ autoImport: true }),
        {
            name: "serve-card-database",
            configureServer(server) {
                // Cache the transformed slim database next to the booster cache.
                // Browser dev mode is for development; we still version-check on
                // each launch so a stale cache doesn't surprise contributors.
                const cacheDir = path.join(os.tmpdir(), "dredge-card-cache");
                fs.mkdirSync(cacheDir, { recursive: true });
                const slimPath = path.join(cacheDir, "cards-db.json");
                const metaPath = path.join(cacheDir, "meta.json");

                let inFlight = null;

                async function buildSlim() {
                    let upstreamVersion = "";
                    try {
                        const r = await fetch("https://mtgjson.com/api/v5/Meta.json", {
                            headers: { "User-Agent": "Dredge/0.1" },
                        });
                        if (r.ok) {
                            const j = await r.json();
                            upstreamVersion = j?.data?.version || "";
                        }
                    } catch {
                        // offline — fall through to cache check below
                    }

                    if (fs.existsSync(slimPath) && fs.existsSync(metaPath)) {
                        try {
                            const cached = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
                            const versionOk = !upstreamVersion || cached.version === upstreamVersion;
                            const schemaOk = cached.schemaVersion === SCHEMA_VERSION;
                            if (versionOk && schemaOk) {
                                return fs.readFileSync(slimPath, "utf-8");
                            }
                        } catch {
                            // bad cache — fall through to refetch
                        }
                    }

                    if (!upstreamVersion && !fs.existsSync(slimPath)) {
                        throw new Error("Offline and no cached card database");
                    }

                    const res = await fetch("https://mtgjson.com/api/v5/AllPrintings.json.gz", {
                        headers: { "User-Agent": "Dredge/0.1" },
                    });
                    if (!res.ok || !res.body) {
                        throw new Error(`AllPrintings fetch failed: ${res.status}`);
                    }

                    const builder = createSlimBuilder();
                    const sink = new Writable({
                        objectMode: true,
                        write({ key, value }, _enc, cb) {
                            try { builder.addSet(key, value); cb(); }
                            catch (err) { cb(err); }
                        },
                    });

                    const tokenizer = chain([
                        parser(),
                        pick({ filter: "data" }),
                        streamObject(),
                    ]);

                    await pipeline(
                        Readable.fromWeb(res.body),
                        zlib.createGunzip(),
                        tokenizer,
                        sink
                    );

                    const slim = builder.finalize();
                    const text = JSON.stringify(slim);
                    fs.writeFileSync(slimPath, text);
                    fs.writeFileSync(metaPath, JSON.stringify({ version: upstreamVersion, schemaVersion: SCHEMA_VERSION }));
                    return text;
                }

                server.middlewares.use("/api/carddb.json", (_req, res) => {
                    if (!inFlight) inFlight = buildSlim().finally(() => { inFlight = null; });
                    inFlight.then((text) => {
                        res.setHeader("Content-Type", "application/json");
                        res.end(text);
                    }).catch((err) => {
                        res.statusCode = 502;
                        res.end("Card database error: " + err.message);
                    });
                });
            },
        },
        {
            name: "proxy-mtgjson",
            configureServer(server) {
                // Cache fetched JSON in {os.tmpdir()}/dredge-booster-cache so the
                // dev server doesn't hammer mtgjson.com on every reload.
                const cacheDir = path.join(os.tmpdir(), "dredge-booster-cache");
                fs.mkdirSync(cacheDir, { recursive: true });
                const SETLIST_TTL_MS = 24 * 60 * 60 * 1000;

                async function pipeJson(url, cachePath, res, ttlMs) {
                    if (cachePath && fs.existsSync(cachePath)) {
                        if (!ttlMs || Date.now() - fs.statSync(cachePath).mtimeMs < ttlMs) {
                            res.setHeader("Content-Type", "application/json");
                            fs.createReadStream(cachePath).pipe(res);
                            return;
                        }
                    }
                    try {
                        const upstream = await fetch(url, {
                            headers: { "User-Agent": "Dredge/0.1", "Accept": "application/json" },
                        });
                        if (!upstream.ok) {
                            res.statusCode = upstream.status;
                            res.end(`Upstream ${upstream.status}`);
                            return;
                        }
                        const text = await upstream.text();
                        if (cachePath) fs.writeFileSync(cachePath, text);
                        res.setHeader("Content-Type", "application/json");
                        res.end(text);
                    } catch (err) {
                        res.statusCode = 502;
                        res.end("Proxy error: " + err.message);
                    }
                }

                server.middlewares.use("/api/mtgjson/SetList.json", (_req, res) => {
                    pipeJson(
                        "https://mtgjson.com/api/v5/SetList.json",
                        path.join(cacheDir, "SetList.json"),
                        res,
                        SETLIST_TTL_MS
                    );
                });

                server.middlewares.use("/api/mtgjson/", (req, res) => {
                    const m = /^\/([A-Za-z0-9]+)\.json$/.exec(req.url || "");
                    if (!m) {
                        res.statusCode = 404;
                        res.end("Not found");
                        return;
                    }
                    const code = m[1].toUpperCase();
                    pipeJson(
                        `https://mtgjson.com/api/v5/${code}.json`,
                        path.join(cacheDir, `${code}.json`),
                        res,
                        0
                    );
                });
            },
        },
    ],
    base: "./",
});
