# CLAUDE.md

## Project Overview

Dredge is a Magic: The Gathering card browser built with Electron + Vue.js. It reads Cockatrice's card database XML format and displays cards with images fetched from Scryfall.

## Tech Stack

- **Electron** - Desktop app shell (Windows 10/11 target)
- **Vue 3** - UI framework (Composition API, `<script setup>`)
- **Pinia** - State management
- **Vite** - Build tooling
- **fast-xml-parser** - Card database XML parsing

## Architecture

```
electron/
  main.js          # Electron main process - window, IPC handlers, image download + disk cache
  preload.js       # Context bridge exposing IPC to renderer
src/
  main.js          # Vue app entry, installs browser fallback if no Electron
  App.vue          # Root component, auto-loads card database on mount
  stores/
    cards.js       # Pinia store - card data, filters, sorting
  services/
    cardDatabase.js  # Parses Cockatrice v4 XML (cockatrice_carddatabase root tag)
    imageLoader.js   # Scryfall image fetching with rate limiting, queue, abort, disk+memory cache
    browserFallback.js # Shims electronAPI for browser dev (Vite serves cards.xml at /api/cards.xml)
  components/
    SearchBar.vue    # Text search, color/type/rarity filters, sort
    CardGrid.vue     # Virtual-scrolled grid (handles 30k+ cards)
    CardItem.vue     # Card thumbnail with debounced lazy image loading
    CardDetail.vue   # Modal overlay with full card info
  styles/
    main.css         # Dark theme, custom frameless titlebar
```

## Card Database

Reads Cockatrice's `cards.xml` (v4 format). The app finds it automatically:
- **Windows**: `%LOCALAPPDATA%/Cockatrice/Cockatrice/cards.xml`
- **Linux/WSL**: `~/.local/share/Cockatrice/cards.xml` (symlinked from Windows path)

The XML root tag `cockatrice_carddatabase` is part of the file format, not a project dependency.

## Image Loading

Three-tier cache: memory → disk → Scryfall fetch.
- Scryfall URL: `https://api.scryfall.com/cards/{uuid}?format=image`
- Disk cache: `{userData}/imageCache/{setCode}/{fileName}`
- Rate limited with concurrency cap (6 concurrent, 120ms between requests)
- Downloads are queued newest-first (current viewport priority)
- Cards debounce 200ms before loading (skips cards scrolled past quickly)
- Aborts queued downloads when cards scroll off screen

## Development

```bash
# Install dependencies
npm install

# Dev server (browser mode - loads cards.xml via Vite middleware)
npm run dev
# Then open http://localhost:5173

# Electron dev mode
npm run electron:dev
```

## Building for Windows

Development happens in WSL, Windows build is a separate copy:

```bash
# Sync source to Windows (from WSL)
./sync-to-windows.sh

# Then on Windows PowerShell:
cd C:\Users\<username>\dredge
npm install        # first time only
npm run electron:dev    # dev mode
npm run electron:build  # produces installer in dist-electron/
```

Windows needs Developer Mode enabled (Settings > Privacy & Security > For developers) for electron-builder's symlinks.

## Code Style

- Vue 3 Composition API with `<script setup>`
- No TypeScript (plain JS)
- CSS custom properties for theming (see `--bg-primary`, `--accent`, etc. in main.css)
- Frameless window with native Windows title bar overlay

## Key Design Decisions

- Read-only access to Cockatrice's card database (no writes)
- Tokens are filtered out during XML parsing
- Virtual scrolling for performance with 30k+ cards
- Browser fallback allows dev/testing without Electron
- `processEntities` set with high `maxTotalExpansions` (100000) because the 53MB XML exceeds default limits
- `htmlEntities: true` to correctly parse `&quot;` etc. in card names
