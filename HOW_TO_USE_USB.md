# How to Run & Store Data on a USB Drive

Your V-Belt software is now configured as a **portable desktop application** that stores all data directly onto a USB drive.

---

## 📁 How It Works

When the app runs from a USB drive, it creates a folder called `vbelt_data` right next to the executable on the USB drive:

```text
USB Drive (e.g. E:\ or /media/usb/)
├── VBelt-Inventory 1.1.3.exe
└── vbelt_data/
    ├── products.json        <-- All your products & stock
    ├── parties.json         <-- Party / customer list
    ├── timingBelts.json     <-- Timing belt inventory
    └── config.json          <-- System settings & PO counter
```

Because all files are saved in `vbelt_data/` on the USB drive:
1. **You can take the USB drive to any computer** (PC 1, PC 2, etc.).
2. Launch the app from the USB drive.
3. All changes and entries are saved straight onto the USB drive.
4. Your data is always with you in standard, human-readable JSON files (which doubles as an automatic backup).

---

## 🚀 How to Put it on Your USB Drive

### For Windows:
1. Copy `dist/VBelt-Inventory 1.1.3.exe` onto your USB drive.
2. Double-click `VBelt-Inventory 1.1.3.exe` to run.
3. Done! The app will automatically create and use `vbelt_data/` on the USB drive.

*(Alternatively, you can copy the entire `dist/win-unpacked` folder onto your USB drive and run `VBelt-Inventory.exe`).*

### For Linux:
1. Copy `dist/VBelt-Inventory-1.1.3.AppImage` onto your USB drive.
2. Right-click -> Properties -> Permissions -> **Allow executing file as program** (or `chmod +x`).
3. Run the AppImage.

---

## ⬆️ How to Update to a New Version

Your data lives in `vbelt_data/`, separate from the app, so updating never touches it.

1. Close the app if it is running.
2. Delete the old file on the USB drive (e.g. `VBelt-Inventory 1.0.0.exe` or `VBelt-Inventory-1.0.0.AppImage`). **Do not delete `vbelt_data/`.**
3. Copy the new file from `dist/` (e.g. `VBelt-Inventory 1.1.3.exe`) into the same folder on the USB drive, next to `vbelt_data/`.
4. Run the new file. All your products, parties and timing belts will be there.

> Tip: copy the `vbelt_data/` folder somewhere safe before updating, as a backup.

When releasing a new build, bump `"version"` in `package.json` first so the file name changes.

---

## 🛠️ Development & Building

If you make code changes in `vbelt/`:

- **Run in development mode:**
  ```bash
  npm start
  ```
- **Rebuild Windows portable `.exe`:**
  ```bash
  npm run dist:win
  ```
- **Rebuild Linux portable `AppImage`:**
  ```bash
  npm run dist:linux
  ```

---

## 🔄 Automatic Data Migration

If you previously entered products or parties in your browser, the app will **automatically import** any existing data from your browser's IndexedDB into `vbelt_data/` the very first time you launch the portable desktop app.
