const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

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
        titleBarStyle: "hidden",
        titleBarOverlay: {
            color: "#16213e",
            symbolColor: "#e0e0e0",
            height: 40,
        },
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (isDev) {
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.webContents.openDevTools();
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

// --- Card Database Path ---

function getCardDatabasePath() {
    const platform = os.platform();
    if (platform === "win32") {
        return path.join(app.getPath("appData"), "..", "Local", "Cockatrice", "Cockatrice", "cards.xml");
    }
    // Linux / WSL - use symlinked location
    return path.join(os.homedir(), ".local", "share", "Cockatrice", "cards.xml");
}

// --- IPC Handlers ---

ipcMain.handle("db:readCardDatabase", async () => {
    const dbPath = getCardDatabasePath();
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
