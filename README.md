<p align="center">
  <img src="assets/logo.svg" alt="Dredge" width="520" />
</p>

<p align="center"><em>A Magic: The Gathering card browser.</em></p>

---

Dredge reads Cockatrice's card database XML and displays cards with images fetched from Scryfall. Desktop-first (Electron), with a browser dev mode for fast iteration.

## Stack

Electron · Vue 3 (Composition API) · Pinia · Vuetify · Vite · fast-xml-parser

## Card Database

Dredge reads Cockatrice's `cards.xml` (v4) from its standard location:

- **Windows**: `%LOCALAPPDATA%\Cockatrice\Cockatrice\cards.xml`
- **macOS**: `~/Library/Application Support/Cockatrice/Cockatrice/cards.xml`

Card images are fetched from Scryfall and cached locally.

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
