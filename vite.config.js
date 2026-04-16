import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import fs from "fs";
import path from "path";
import os from "os";

const cardDbPath = path.join(os.homedir(), ".local", "share", "Cockatrice", "cards.xml");

export default defineConfig({
    plugins: [
        vue(),
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
    ],
    base: "./",
});
