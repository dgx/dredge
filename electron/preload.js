const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
    readCardDatabase: () => ipcRenderer.invoke("db:readCardDatabase"),
    getCachedImage: (setCode, fileName) => ipcRenderer.invoke("image:getCached", setCode, fileName),
    downloadImage: (url, setCode, fileName) => ipcRenderer.invoke("image:download", url, setCode, fileName),
    getCachePath: () => ipcRenderer.invoke("cache:getPath"),
    fetchMtgjsonSetList: () => ipcRenderer.invoke("mtgjson:fetchSetList"),
    fetchMtgjsonSet: (setCode) => ipcRenderer.invoke("mtgjson:fetchSet", setCode),
});
