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

// Automatically render active USB storage status badge in the sidebar on any page
window.addEventListener('DOMContentLoaded', async () => {
    if (DB.isElectron) {
        try {
            const info = await DB.getDataInfo();
            const sidebar = document.querySelector('.sidebar');
            if (sidebar && info && !document.getElementById('storageInfoBadge')) {
                const badge = document.createElement('div');
                badge.id = 'storageInfoBadge';
                badge.style.cssText = 'margin-top: 24px; padding: 12px; background: #1e293b; border-radius: 8px; font-size: 11px; color: #94a3b8; border: 1px solid #334155;';
                badge.innerHTML = `
                    <div style="font-weight: 600; color: #38bdf8; margin-bottom: 4px; display: flex; align-items: center; gap: 6px;">
                        <span>💾 USB Storage</span>
                    </div>
                    <div style="word-break: break-all; margin-bottom: 8px; color: #cbd5e1; font-family: monospace; font-size: 10px;" title="${info.dataDir}">${info.dataDir}</div>
                    <button id="btnOpenDataFolder" style="padding: 6px 10px; font-size: 11px; background: #38bdf8; color: #0f172a; font-weight: 600; border: none; border-radius: 4px; width: 100%; cursor: pointer;">📂 Open Data Folder</button>
                `;
                sidebar.appendChild(badge);
                badge.querySelector('#btnOpenDataFolder').addEventListener('click', () => {
                    DB.openDataFolder();
                });
            }
        } catch (e) {
            console.error("Storage badge initialization error:", e);
        }
    }
});

/* ==========================================================================
   GLOBAL UI SYSTEM: TOAST NOTIFICATIONS & CONFIRMATION MODALS
   ========================================================================== */

(function () {
    function injectUIStyles() {
        if (document.getElementById("ui-system-styles")) return;
        const style = document.createElement("style");
        style.id = "ui-system-styles";
        style.textContent = `
            #uiToastContainer {
                position: fixed;
                top: 24px;
                right: 24px;
                z-index: 100000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            }
            .ui-toast {
                pointer-events: auto;
                min-width: 280px;
                max-width: 440px;
                background: #ffffff;
                color: #0f172a;
                border-radius: 12px;
                padding: 12px 16px;
                box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                border: 1px solid #e2e8f0;
                display: flex;
                align-items: center;
                gap: 12px;
                font-size: 14px;
                font-family: 'Inter', system-ui, sans-serif;
                animation: uiSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                transition: opacity 0.2s ease, transform 0.2s ease;
            }
            .ui-toast.ui-hiding {
                opacity: 0;
                transform: translateY(-10px);
            }
            .ui-toast-icon {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                font-size: 14px;
                font-weight: 700;
            }
            .ui-toast-msg {
                flex: 1;
                line-height: 1.4;
                word-break: break-word;
            }
            .ui-toast-close {
                background: transparent;
                border: none;
                cursor: pointer;
                color: #94a3b8;
                font-size: 18px;
                line-height: 1;
                padding: 2px 6px;
                border-radius: 4px;
            }
            .ui-toast-close:hover {
                color: #334155;
                background: #f1f5f9;
            }
            .ui-toast-success { border-left: 5px solid #10b981; }
            .ui-toast-success .ui-toast-icon { background: #dcfce7; color: #15803d; }
            .ui-toast-error { border-left: 5px solid #ef4444; }
            .ui-toast-error .ui-toast-icon { background: #fee2e2; color: #b91c1c; }
            .ui-toast-warning { border-left: 5px solid #f59e0b; }
            .ui-toast-warning .ui-toast-icon { background: #fef3c7; color: #b45309; }
            .ui-toast-info { border-left: 5px solid #2563eb; }
            .ui-toast-info .ui-toast-icon { background: #dbeafe; color: #1d4ed8; }

            @keyframes uiSlideIn {
                from { opacity: 0; transform: translateX(20px); }
                to { opacity: 1; transform: translateX(0); }
            }

            #uiConfirmModal {
                position: fixed;
                inset: 0;
                background: rgba(15, 23, 42, 0.6);
                backdrop-filter: blur(3px);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease;
                font-family: 'Inter', system-ui, sans-serif;
            }
            #uiConfirmModal.open {
                opacity: 1;
                pointer-events: auto;
            }
            .ui-confirm-box {
                background: white;
                border-radius: 14px;
                width: 90%;
                max-width: 440px;
                padding: 24px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                transform: scale(0.95);
                transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            }
            #uiConfirmModal.open .ui-confirm-box {
                transform: scale(1);
            }
            .ui-confirm-head {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
            }
            .ui-confirm-badge {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                flex-shrink: 0;
            }
            .ui-confirm-badge.danger { background: #fee2e2; color: #dc2626; }
            .ui-confirm-badge.primary { background: #dbeafe; color: #2563eb; }
            .ui-confirm-title {
                margin: 0;
                font-size: 18px;
                font-weight: 700;
                color: #0f172a;
            }
            .ui-confirm-msg {
                font-size: 14px;
                color: #475569;
                line-height: 1.5;
                margin-bottom: 22px;
                padding-left: 52px;
            }
            .ui-confirm-btns {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
            .ui-btn {
                padding: 10px 18px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                border: none;
                transition: all 0.15s ease;
            }
            .ui-btn-cancel {
                background: #f1f5f9;
                color: #334155;
            }
            .ui-btn-cancel:hover { background: #e2e8f0; }
            .ui-btn-confirm {
                background: #2563eb;
                color: white;
            }
            .ui-btn-confirm:hover { background: #1d4ed8; }
            .ui-btn-danger {
                background: #ef4444;
                color: white;
            }
            .ui-btn-danger:hover { background: #dc2626; }
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
            success: "✓",
            error: "✕",
            warning: "⚠️",
            info: "ℹ️"
        };

        toast.innerHTML = `
            <div class="ui-toast-icon">${icons[type] || "ℹ️"}</div>
            <div class="ui-toast-msg">${message}</div>
            <button class="ui-toast-close" title="Close">&times;</button>
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
                            <div class="ui-confirm-badge" id="uiConfirmBadge">⚠️</div>
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
                badgeEl.textContent = "🗑️";
                okBtn.className = "ui-btn ui-btn-danger";
            } else {
                badgeEl.className = "ui-confirm-badge primary";
                badgeEl.textContent = "ℹ️";
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
