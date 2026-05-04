import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import fs from "fs";
import os from "os";
import path from "path";

const cardDbPath = process.platform === "darwin"
    ? path.join(os.homedir(), "Library", "Application Support", "Cockatrice", "Cockatrice", "cards.xml")
    : path.join(process.env.LOCALAPPDATA || "", "Cockatrice", "Cockatrice", "cards.xml");

export default defineConfig({
    plugins: [
        vue(),
        vuetify({ autoImport: true }),
        {
            name: "serve-card-database",
            configureServer(server) {
                server.middlewares.use("/api/cards.xml", (req, res) => {
                    if (!fs.existsSync(cardDbPath)) {
                        res.statusCode = 404;
                        res.end("Card database not found at " + cardDbPath);
                        return;
                    }
                    res.setHeader("Content-Type", "application/xml");
                    fs.createReadStream(cardDbPath).pipe(res);
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
