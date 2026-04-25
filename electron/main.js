const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const os = require("os");
const path = require("path");
const fs = require("fs");

const isDev = process.env.NODE_ENV === "development";

function getCardDbPath() {
    if (process.platform === "darwin") {
        return path.join(os.homedir(), "Library", "Application Support", "Cockatrice", "Cockatrice", "cards.xml");
    }
    return path.join(process.env.LOCALAPPDATA || "", "Cockatrice", "Cockatrice", "cards.xml");
}

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

ipcMain.handle("db:readCardDatabase", async () => {
    const dbPath = getCardDbPath();
    if (!fs.existsSync(dbPath)) {
        throw new Error(`Card database not found at ${dbPath}`);
    }
    return fs.promises.readFile(dbPath, "utf-8");
});

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
