const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    loadCardDatabase: () => ipcRenderer.invoke("cardDb:load"),
    onCardDbProgress: (cb) => {
        const listener = (_event, payload) => cb(payload);
        ipcRenderer.on("cardDb:progress", listener);
        return () => ipcRenderer.removeListener("cardDb:progress", listener);
    },
    getCachedImage: (setCode, fileName) => ipcRenderer.invoke("image:getCached", setCode, fileName),
    downloadImage: (url, setCode, fileName) => ipcRenderer.invoke("image:download", url, setCode, fileName),
    getCachePath: () => ipcRenderer.invoke("cache:getPath"),
    fetchMtgjsonSetList: () => ipcRenderer.invoke("mtgjson:fetchSetList"),
    fetchMtgjsonSet: (setCode) => ipcRenderer.invoke("mtgjson:fetchSet", setCode),
    onUpdateEvent: (cb) => {
        const listener = (_event, payload) => cb(payload);
        ipcRenderer.on("update:event", listener);
        return () => ipcRenderer.removeListener("update:event", listener);
    },
    quitAndInstallUpdate: () => ipcRenderer.invoke("update:quitAndInstall"),
});
