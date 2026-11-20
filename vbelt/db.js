const DB = {
    dbName: "InventoryDB",
    dbVersion: 1,
    db: null,
    isElectron: typeof window !== "undefined" && Boolean(window.electronAPI),

    async init() {
        if (this.isElectron) {
            // Check if we should migrate from IndexedDB to Electron/USB storage on first launch
            try {
                await this.migrateIndexedDBToElectron();
            } catch (err) {
                console.warn("Migration to Electron storage skipped or failed:", err);
            }
            return true;
        }

        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
                return;
            }

            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("products")) {
                    db.createObjectStore("products", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("parties")) {
                    db.createObjectStore("parties", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("timingBelts")) {
                    db.createObjectStore("timingBelts", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("config")) {
                    db.createObjectStore("config", { keyPath: "key" });
                }
            };

            request.onsuccess = async (e) => {
                this.db = e.target.result;
                try {
                    await this.migrateFromLocalStorage();
                } catch (err) {
                    console.error("Migration from localStorage failed:", err);
                }
                resolve(this.db);
            };

            request.onerror = (e) => {
                reject(e.target.error);
            };
        });
    },

    async migrateIndexedDBToElectron() {
        // If Electron already has data, no migration needed
        const existingProducts = await window.electronAPI.getAll("products");
        if (existingProducts && existingProducts.length > 0) {
            return;
        }

        // Open indexedDB to check if there is data to copy over
        const hasIndexedDB = await new Promise((resolve) => {
            const req = indexedDB.open(this.dbName, this.dbVersion);
            req.onsuccess = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains("products")) {
                    db.close();
                    resolve(null);
                    return;
                }
                resolve(db);
            };
            req.onerror = () => resolve(null);
        });

        if (!hasIndexedDB) return;

        const db = hasIndexedDB;
        const readStore = (storeName) => new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(storeName)) return resolve([]);
                const tx = db.transaction(storeName, "readonly");
                const store = tx.objectStore(storeName);
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => resolve([]);
            } catch (e) {
                resolve([]);
            }
        });

        const products = await readStore("products");
        const parties = await readStore("parties");
        const timingBelts = await readStore("timingBelts");

        if (products.length > 0) await window.electronAPI.saveAll("products", products);
        if (parties.length > 0) await window.electronAPI.saveAll("parties", parties);
        if (timingBelts.length > 0) await window.electronAPI.saveAll("timingBelts", timingBelts);

        db.close();
        console.log("Successfully imported existing IndexedDB data into USB/Electron storage.");
    },

    async migrateFromLocalStorage() {
        const migratedKey = "db_migrated_v1";
        if (localStorage.getItem(migratedKey)) {
            return; // already migrated
        }

        // Migrate products
        const localProducts = localStorage.getItem("products");
        if (localProducts) {
            try {
                const parsed = JSON.parse(localProducts);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    await this.saveAll("products", parsed);
                }
            } catch (e) {
                console.error("Failed to migrate products:", e);
            }
        }

        // Migrate parties
        const localParties = localStorage.getItem("parties");
        if (localParties) {
            try {
                const parsed = JSON.parse(localParties);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    await this.saveAll("parties", parsed);
                }
            } catch (e) {
                console.error("Failed to migrate parties:", e);
            }
        }

        // Migrate timingBelts
        const localBelts = localStorage.getItem("timingBelts");
        if (localBelts) {
            try {
                const parsed = JSON.parse(localBelts);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    await this.saveAll("timingBelts", parsed);
                }
            } catch (e) {
                console.error("Failed to migrate timingBelts:", e);
            }
        }

        // Migrate lastPO
        const localLastPO = localStorage.getItem("lastPO");
        if (localLastPO !== null) {
            await this.saveConfig("lastPO", parseInt(localLastPO) || 0);
        }

        localStorage.setItem(migratedKey, "true");
        console.log("Migration from localStorage completed successfully.");
    },

    getAll(storeName) {
        if (this.isElectron) {
            return window.electronAPI.getAll(storeName);
        }

        return new Promise(async (resolve, reject) => {
            try {
                const db = await this.init();
                const transaction = db.transaction(storeName, "readonly");
                const store = transaction.objectStore(storeName);
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (err) {
                reject(err);
            }
        });
    },

    saveAll(storeName, items) {
        if (this.isElectron) {
            return window.electronAPI.saveAll(storeName, items);
        }

        return new Promise(async (resolve, reject) => {
            try {
                const db = await this.init();
                const transaction = db.transaction(storeName, "readwrite");
                const store = transaction.objectStore(storeName);
                
                const clearReq = store.clear();
                clearReq.onsuccess = () => {
                    if (items.length === 0) {
                        resolve();
                        return;
                    }
                    let count = items.length;
                    for (const item of items) {
                        const putReq = store.put(item);
                        putReq.onsuccess = () => {
                            count--;
                            if (count === 0) resolve();
                        };
                        putReq.onerror = () => reject(putReq.error);
                    }
                };
                clearReq.onerror = () => reject(clearReq.error);
            } catch (err) {
                reject(err);
            }
        });
    },

    getConfig(key, defaultValue = null) {
        if (this.isElectron) {
            return window.electronAPI.getConfig(key, defaultValue);
        }

        return new Promise(async (resolve, reject) => {
            try {
                const db = await this.init();
                const transaction = db.transaction("config", "readonly");
                const store = transaction.objectStore("config");
                const request = store.get(key);
                request.onsuccess = () => {
                    if (request.result) resolve(request.result.value);
                    else resolve(defaultValue);
                };
                request.onerror = () => reject(request.error);
            } catch (err) {
                reject(err);
            }
        });
    },

    saveConfig(key, value) {
        if (this.isElectron) {
            return window.electronAPI.saveConfig(key, value);
        }

        return new Promise(async (resolve, reject) => {
            try {
                const db = await this.init();
                const transaction = db.transaction("config", "readwrite");
                const store = transaction.objectStore("config");
                const request = store.put({ key, value });
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            } catch (err) {
                reject(err);
            }
        });
    },

    // Electron specific helpers
    async getDataInfo() {
        if (this.isElectron) {
            return await window.electronAPI.getDataInfo();
        }
        return null;
    },

    async openDataFolder() {
        if (this.isElectron) {
            return await window.electronAPI.openDataFolder();
        }
    }
};

// Show the active USB data folder in the sidebar's "More" section on every page
window.addEventListener('DOMContentLoaded', async () => {
    if (!DB.isElectron) return;
    try {
        const info = await DB.getDataInfo();
        const slot = document.getElementById('sbStorage');
        if (!slot || !info || slot.dataset.ready) return;
        slot.dataset.ready = '1';
        const folderIcon = window.icon ? window.icon('folder') : '';
        slot.innerHTML = `
            <button class="sb-link" type="button" id="btnOpenDataFolder" title="Open data folder">${folderIcon}<span>USB data folder</span></button>
            <div class="sb-storage-path"></div>
        `;
        slot.querySelector('.sb-storage-path').textContent = info.dataDir;
        slot.querySelector('.sb-storage-path').title = info.dataDir;
        slot.querySelector('#btnOpenDataFolder').addEventListener('click', () => DB.openDataFolder());
    } catch (e) {
        console.error("Storage info initialization error:", e);
    }
});

/* ==========================================================================
   GLOBAL UI SYSTEM: TOAST NOTIFICATIONS & CONFIRMATION MODALS
   ========================================================================== */

(function () {
    const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const UI_ICON = {
        check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
        x: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
        alert: svg('<path d="M12 4.5 20.5 19h-17z"/><path d="M12 10v4"/><circle cx="12" cy="16.6" r=".6" fill="currentColor"/>'),
        info: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".6" fill="currentColor"/>'),
        trash: svg('<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7"/>')
    };

    function injectUIStyles() {
        if (document.getElementById("ui-system-styles")) return;
        const style = document.createElement("style");
        style.id = "ui-system-styles";
        style.textContent = `
            #uiToastContainer {
                position: fixed;
                top: 16px;
                right: 20px;
                z-index: 100000;
                display: flex;
                flex-direction: column;
                gap: 8px;
                pointer-events: none;
            }
            .ui-toast {
                pointer-events: auto;
                min-width: 280px;
                max-width: 440px;
                background: #FFFFFF;
                color: #0A0A0A;
                border-radius: 12px;
                padding: 10px 10px 10px 12px;
                box-shadow: 0 0 0 1px rgba(10,10,10,0.05), 0 12px 32px rgba(10,10,10,0.12);
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 14px;
                font-family: 'Inter', system-ui, sans-serif;
                animation: uiSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .ui-toast.ui-hiding { opacity: 0; transform: translateY(-6px); }
            .ui-toast-icon {
                width: 26px;
                height: 26px;
                border-radius: 999px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                border: 1px solid transparent;
            }
            .ui-toast-icon svg { width: 15px; height: 15px; }
            .ui-toast-msg { flex: 1; line-height: 1.4; word-break: break-word; }
            .ui-toast-close {
                background: transparent;
                border: none;
                cursor: pointer;
                color: #9CA3AF;
                width: 26px;
                height: 26px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                flex-shrink: 0;
            }
            .ui-toast-close svg { width: 15px; height: 15px; }
            .ui-toast-close:hover { color: #0A0A0A; background: #F3F4F6; }
            .ui-toast-success .ui-toast-icon { background: #DCFCE7; color: #15803D; border-color: #BBF7D0; }
            .ui-toast-error   .ui-toast-icon { background: #FEE2E2; color: #B91C1C; border-color: #FECACA; }
            .ui-toast-warning .ui-toast-icon { background: #FEF3C7; color: #D97706; border-color: #FDE68A; }
            .ui-toast-info    .ui-toast-icon { background: #EFF6FF; color: #1D4ED8; border-color: #BFDBFE; }

            @keyframes uiSlideIn {
                from { opacity: 0; transform: translateY(-8px); }
                to { opacity: 1; transform: translateY(0); }
            }

            #uiConfirmModal {
                position: fixed;
                inset: 0;
                background: rgba(10, 10, 10, 0.32);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                font-family: 'Inter', system-ui, sans-serif;
            }
            #uiConfirmModal.open { opacity: 1; pointer-events: auto; }
            .ui-confirm-box {
                background: #FFFFFF;
                border-radius: 16px;
                width: 90%;
                max-width: 420px;
                padding: 22px 24px;
                box-shadow: 0 0 0 1px rgba(10,10,10,0.05), 0 12px 32px rgba(10,10,10,0.12);
                transform: translateY(8px) scale(0.98);
                transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            }
            #uiConfirmModal.open .ui-confirm-box { transform: translateY(0) scale(1); }
            .ui-confirm-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
            .ui-confirm-badge {
                width: 36px;
                height: 36px;
                border-radius: 999px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                border: 1px solid transparent;
            }
            .ui-confirm-badge svg { width: 18px; height: 18px; }
            .ui-confirm-badge.danger { background: #FEE2E2; color: #B91C1C; border-color: #FECACA; }
            .ui-confirm-badge.primary { background: #F4F4F4; color: #0A0A0A; border-color: #EAEAEA; }
            .ui-confirm-title { margin: 0; font-size: 17px; font-weight: 600; color: #0A0A0A; letter-spacing: -0.01em; }
            .ui-confirm-msg {
                font-size: 14px;
                color: #4B5563;
                line-height: 1.5;
                margin-bottom: 22px;
                padding-left: 48px;
            }
            .ui-confirm-btns { display: flex; justify-content: flex-end; gap: 8px; }
            .ui-btn {
                height: 38px;
                padding: 0 16px;
                border-radius: 10px;
                font: 500 14px/1 'Inter', system-ui, sans-serif;
                cursor: pointer;
                border: 1px solid transparent;
                transition: background 0.15s cubic-bezier(0.16, 1, 0.3, 1);
            }
            .ui-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(10,10,10,0.06); }
            .ui-btn-cancel { background: #FFFFFF; color: #0A0A0A; border-color: #D9D9D9; }
            .ui-btn-cancel:hover { background: #F3F4F6; }
            .ui-btn-confirm { background: #0A0A0A; color: #FFFFFF; }
            .ui-btn-confirm:hover { background: #262626; }
            .ui-btn-danger { background: #B91C1C; color: #FFFFFF; }
            .ui-btn-danger:hover { background: #991B1B; }
        `;
        document.head.appendChild(style);
    }

    function getOrCreateToastContainer() {
        injectUIStyles();
        let container = document.getElementById("uiToastContainer");
        if (!container) {
            container = document.createElement("div");
            container.id = "uiToastContainer";
            document.body.appendChild(container);
        }
        return container;
    }

    window.showToast = function (message, type = "info", duration = 3200) {
        if (!document.body) {
            window.addEventListener("DOMContentLoaded", () => window.showToast(message, type, duration));
            return;
        }

        const container = getOrCreateToastContainer();
        const toast = document.createElement("div");
        toast.className = `ui-toast ui-toast-${type}`;

        const icons = {
            success: UI_ICON.check,
            error: UI_ICON.x,
            warning: UI_ICON.alert,
            info: UI_ICON.info
        };

        toast.innerHTML = `
            <div class="ui-toast-icon">${icons[type] || UI_ICON.info}</div>
            <div class="ui-toast-msg">${message}</div>
            <button class="ui-toast-close" title="Close">${UI_ICON.x}</button>
        `;

        const closeBtn = toast.querySelector(".ui-toast-close");
        const removeToast = () => {
            if (toast.classList.contains("ui-hiding")) return;
            toast.classList.add("ui-hiding");
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 200);
        };

        closeBtn.addEventListener("click", removeToast);
        container.appendChild(toast);

        if (duration > 0) {
            setTimeout(removeToast, duration);
        }
    };

    // Override window.alert to automatically show beautiful toast
    window.alert = function (message) {
        window.showToast(message, "warning", 4000);
    };

    // Global Confirm Modal
    window.showConfirm = function (message, options = {}) {
        return new Promise((resolve) => {
            injectUIStyles();
            let modal = document.getElementById("uiConfirmModal");
            if (!modal) {
                modal = document.createElement("div");
                modal.id = "uiConfirmModal";
                modal.innerHTML = `
                    <div class="ui-confirm-box">
                        <div class="ui-confirm-head">
                            <div class="ui-confirm-badge" id="uiConfirmBadge"></div>
                            <h3 class="ui-confirm-title" id="uiConfirmTitle">Confirm Action</h3>
                        </div>
                        <div class="ui-confirm-msg" id="uiConfirmMsg"></div>
                        <div class="ui-confirm-btns">
                            <button class="ui-btn ui-btn-cancel" id="uiConfirmCancelBtn">Cancel</button>
                            <button class="ui-btn" id="uiConfirmOkBtn">Confirm</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);
            }

            const title = options.title || "Confirmation";
            const confirmText = options.confirmText || "Confirm";
            const cancelText = options.cancelText || "Cancel";
            const isDanger = options.isDanger !== false;

            const titleEl = document.getElementById("uiConfirmTitle");
            const msgEl = document.getElementById("uiConfirmMsg");
            const badgeEl = document.getElementById("uiConfirmBadge");
            const okBtn = document.getElementById("uiConfirmOkBtn");
            const cancelBtn = document.getElementById("uiConfirmCancelBtn");

            titleEl.textContent = title;
            msgEl.textContent = message;
            okBtn.textContent = confirmText;
            cancelBtn.textContent = cancelText;

            if (isDanger) {
                badgeEl.className = "ui-confirm-badge danger";
                badgeEl.innerHTML = UI_ICON.trash;
                okBtn.className = "ui-btn ui-btn-danger";
            } else {
                badgeEl.className = "ui-confirm-badge primary";
                badgeEl.innerHTML = UI_ICON.info;
                okBtn.className = "ui-btn ui-btn-confirm";
            }

            const cleanup = (result) => {
                modal.classList.remove("open");
                okBtn.removeEventListener("click", onOk);
                cancelBtn.removeEventListener("click", onCancel);
                modal.removeEventListener("click", onBackdrop);
                document.removeEventListener("keydown", onKey);
                resolve(result);
            };

            const onOk = () => cleanup(true);
            const onCancel = () => cleanup(false);
            const onBackdrop = (e) => {
                if (e.target === modal) cleanup(false);
            };
            const onKey = (e) => {
                if (e.key === "Escape") cleanup(false);
                else if (e.key === "Enter") cleanup(true);
            };

            okBtn.addEventListener("click", onOk);
            cancelBtn.addEventListener("click", onCancel);
            modal.addEventListener("click", onBackdrop);
            document.addEventListener("keydown", onKey);

            modal.classList.add("open");
            setTimeout(() => cancelBtn.focus(), 50);
        });
    };
})();
