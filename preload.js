const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getAll: (storeName) => ipcRenderer.invoke('db:getAll', storeName),
    saveAll: (storeName, items) => ipcRenderer.invoke('db:saveAll', storeName, items),
    getConfig: (key, defaultValue) => ipcRenderer.invoke('db:getConfig', key, defaultValue),
    saveConfig: (key, value) => ipcRenderer.invoke('db:saveConfig', key, value),
    getDataInfo: () => ipcRenderer.invoke('db:getDataInfo'),
    openDataFolder: () => ipcRenderer.invoke('db:openDataFolder')
});
