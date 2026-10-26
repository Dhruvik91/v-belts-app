const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Determine data directory (stores data on USB drive right beside the executable / folder)
function getDataDirectory() {
    let baseDir;
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
        // Electron-builder portable executable path (e.g., E:\ or USB folder)
        baseDir = process.env.PORTABLE_EXECUTABLE_DIR;
    } else if (app.isPackaged) {
        // Packaged standalone executable
        baseDir = path.dirname(process.execPath);
    } else {
        // Development mode
        baseDir = __dirname;
    }

    const dataDir = path.join(baseDir, 'vbelt_data');
    if (!fs.existsSync(dataDir)) {
        try {
            fs.mkdirSync(dataDir, { recursive: true });
        } catch (err) {
            console.error('Failed to create data directory:', err);
        }
    }
    return dataDir;
}

const dataDir = getDataDirectory();

function getStoreFilePath(storeName) {
    return path.join(dataDir, `${storeName}.json`);
}

// IPC Handlers for database operations
ipcMain.handle('db:getDataInfo', async () => {
    return {
        dataDir: dataDir,
        isPortable: !!process.env.PORTABLE_EXECUTABLE_DIR,
        isPackaged: app.isPackaged
    };
});

ipcMain.handle('db:openDataFolder', async () => {
    return await shell.openPath(dataDir);
});

ipcMain.handle('db:getAll', async (event, storeName) => {
    const filePath = getStoreFilePath(storeName);
    if (!fs.existsSync(filePath)) {
        return [];
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        console.error(`Error reading ${storeName}:`, err);
        return [];
    }
});

ipcMain.handle('db:saveAll', async (event, storeName, items) => {
    const filePath = getStoreFilePath(storeName);
    try {
        const json = JSON.stringify(items, null, 2);
        fs.writeFileSync(filePath, json, 'utf-8');
        return true;
    } catch (err) {
        console.error(`Error saving ${storeName}:`, err);
        throw err;
    }
});

ipcMain.handle('db:getConfig', async (event, key, defaultValue = null) => {
    const filePath = getStoreFilePath('config');
    if (!fs.existsSync(filePath)) {
        return defaultValue;
    }
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const config = JSON.parse(raw);
        return (key in config) ? config[key] : defaultValue;
    } catch (err) {
        console.error('Error reading config:', err);
        return defaultValue;
    }
});

ipcMain.handle('db:saveConfig', async (event, key, value) => {
    const filePath = getStoreFilePath('config');
    let config = {};
    if (fs.existsSync(filePath)) {
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            config = JSON.parse(raw);
        } catch (err) {
            console.error('Error reading existing config:', err);
            config = {};
        }
    }
    config[key] = value;
    try {
        fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
        return true;
    } catch (err) {
        console.error('Error writing config:', err);
        throw err;
    }
});

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 850,
        minWidth: 1000,
        minHeight: 700,
        title: 'V-Belt & Timing Belt Inventory',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false
        }
    });

    win.loadFile(path.join(__dirname, 'vbelt', 'index.html'));

    // Optional: win.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
