<p align="center">
  <img src="assets/logo.svg" alt="Dredge" width="520" />
</p>

<p align="center"><em>A Magic: The Gathering pack opener and sealed-deck workshop.</em></p>

---

Dredge opens packs, builds sealed decks, and browses every printable Magic card. Card data comes from MTGJSON; card images come from Scryfall. Desktop-first (Electron), with a browser dev mode for fast iteration.

## Stack

Electron · Vue 3 (Composition API) · Pinia · Vuetify · Vite

## Card Database

On first launch Dredge downloads MTGJSON's `AllPrintings.json.gz` (~80 MB compressed) and transforms it into a slim local cache:

- **Windows**: `%APPDATA%\Dredge\cardCache\cards-db.json`
- **macOS**: `~/Library/Application Support/Dredge/cardCache/cards-db.json`

Subsequent launches re-use the cache; Dredge only re-downloads when MTGJSON publishes a new version (checked via `Meta.json` on each launch). Card images are fetched from Scryfall and cached locally.

## Development

```bash
npm install
npm run dev              # browser mode at http://localhost:5173
npm run electron:dev     # electron dev mode
```

## Building

```bash
npm run electron:build:win     # Windows (NSIS installer)
npm run electron:build:mac     # macOS Apple Silicon (DMG, unsigned)
npm run electron:build:all     # both
```

Output lands in `dist-electron/`. Windows builds require Developer Mode enabled (Settings → Privacy & Security → For developers) so electron-builder can create symlinks. Distributable macOS builds should be produced on macOS (or a `macos-14` CI runner) for code signing.
