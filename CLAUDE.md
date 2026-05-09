# CLAUDE.md

## Project Overview

Dredge is a Magic: The Gathering pack-opening, sealed-deck and card-browsing
app built with Electron + Vue 3 + Vuetify. It downloads MTGJSON's
`AllPrintings.json` on first launch (cached locally) for the card pool, and
uses the same MTGJSON booster data to simulate opening packs. Card images
come from Scryfall; pack box art comes from TCGPlayer's product image CDN.

## Tech Stack

- **Electron** — desktop shell (Windows + macOS targets)
- **Vue 3** — Composition API, `<script setup>`
- **Vuetify 4** — UI components (lean on Vuetify props/slots first)
- **Pinia** — state management (`cards`, `packs` stores)
- **Vue Router** — installed but currently unused
- **Vite** — build tooling, with dev-server middleware that fetches and
  transforms MTGJSON data so browser dev mode works without Electron
- **mana-font** + `@mdi/font` — mana symbols and Material Design icons
- **Vitest** + `@vue/test-utils` + `happy-dom` — unit / component tests

## Architecture

```
electron/
  main.js          # Window, IPC: card DB load (AllPrintings.json + version-checked
                   # cache + progress events), image cache, MTGJSON fetch+cache
  preload.js       # contextBridge → window.electronAPI
  cardDbTransform.cjs  # Pure transform: AllPrintings → slim {sets, cards}.
                   # Shared by main.js, vite middleware, and tests.

src/
  main.js          # Entry: installs browserFallback, registers Pinia + Vuetify
  App.vue          # Titlebar + mode toggle (Sealed Pool / All Cards); routes to
                   # PackSetup / PackOpener / DeckBuilder / CardGrid based on
                   # store flags
  plugins/
    vuetify.js     # "dredgeDark" theme + global VBtn/VTextField defaults
  stores/
    cards.js       # All-cards data, filters, sealed pool, deck (deckIds +
                   # basicLands), grouping config, deck size 40/60, view flags
    packs.js       # Pack-opening flow: setup → loading → opening → finished;
                   # set selections, packQueue, currentPackIndex, audio mute
  services/
    cardGrouping.js     # type/color/cmc/rarity grouping primitives
    sealedParser.js     # Parses bracketed [SET:num] / MTGA / bare deck-list lines
                        # (used by PackSetup's Import-from-Clipboard affordance)
    deckExporter.js     # Exports the current deck back to a list format
    imageLoader.js      # Scryfall image fetch w/ rate limiting, queue, abort,
                        # 3-tier cache (memory → disk → network)
    boosterData.js      # MTGJSON SetList + per-set fetcher (mem + disk cached);
                        # filters to "openable" set types
    boosterSimulator.js # Rolls packs from MTGJSON booster sheets/weights
    packResolver.js     # Maps simulator output (mtgjson uuids) → Scryfall cards
    packImage.js        # Resolves real booster box art from MTGJSON sealedProduct
                        # → TCGPlayer product-image CDN; PackArt falls back to CSS
    packAudio.js        # Web-Audio sample playback for rip/tear/flip/mythic
                        # (autoplay-unlock on first user gesture)
    manaSymbols.js      # Cost-string → mana-font icon parsing
    browserFallback.js  # Shims electronAPI in browser dev mode (Vite middleware
                        # serves /api/carddb.json and /api/mtgjson/*.json)
  components/
    SearchBar.vue       # Text search, color/type/rarity filters, sort, grouping
    CardGrid.vue        # Virtual-scrolled flat grid (handles 30k+ cards)
    GroupedCardGrid.vue # Section-grouped grid (used in deck-builder views)
    GroupSection.vue    # One group's header + body inside GroupedCardGrid
    CardItem.vue        # Card thumbnail with debounced lazy image loading
    CardStack.vue       # Stacked-quantity card representation
    AllCardsTile.vue    # Tile for the "all cards in this group" affordance
    CardDetail.vue      # Modal overlay with full card info
    ManaCost.vue        # Renders a cost string as mana-font pips
    ManaPip.vue         # Single mana symbol
    DeckBuilder.vue     # Sealed/deck mode workspace
    DeckSummary.vue     # Mana curve + type-bar graph + counts
    PackSetup.vue       # Pick sets + pack counts + booster types — entry view
                        # for the sealed-deck workflow (with Import-from-Clipboard)
    PackOpener.vue      # Pack-by-pack reveal UI
    PackRevealCard.vue  # Single-card reveal animation inside the pack opener
    PackArt.vue         # Real TCGPlayer art if resolved, else CSS fake-pack
    WelcomeOverlay.vue  # Full-screen first-launch overlay shown while the
                        # card database downloads (logo + progress + retry)
  styles/
    main.css            # Dark-theme tokens, frameless titlebar styling
  assets/
    audio/              # rip / tear / flip / mythic / masterpiece samples (.wav)

scripts/
  audit-boosters.cjs    # Sanity-check booster data across MTGJSON sets
  generate-icon.cjs     # Build app icon (build/icon.png) from assets/logo.svg
  release.cjs           # Version bump + tag + push helper

tests/
  components/           # Vuetify-aware @vue/test-utils mounts
  services/             # Pure-logic service tests
  stores/               # Pinia store tests
  fixtures/sampleDatabase.js, helpers/mount.js
```

Two Pinia stores — `cards` (browser, filters, deck, sealed pool) and `packs`
(pack-opening flow) — communicate through `cards.openPacks()` /
`cards.closePacks()` flags consumed by `App.vue`.

## Card Database

The card pool is sourced from MTGJSON's `AllPrintings.json.gz`. On first
launch the Electron main process pipes the response directly through
`zlib.createGunzip()` and `stream-json` (`pick("data") → streamObject()`)
into an incremental builder (`createSlimBuilder` in
`electron/cardDbTransform.cjs`). Streaming is required because the
uncompressed file (~400+ MB) exceeds V8's max string length, so we never
materialize the full JSON; sets are consumed one at a time. The builder
collapses printings into a deduped-by-name `{sets, cards}` shape and the
slim result is written to disk and returned via the `cardDb:load` IPC
channel. Progress is reported through `cardDb:progress` events with phases
`checking → downloading → parsing → writing → done`.

Cache locations:
- **Windows**: `%APPDATA%\Dredge\cardCache\{cards-db.json, meta.json}`
- **macOS**: `~/Library/Application Support/Dredge/cardCache/{cards-db.json, meta.json}`
- **Browser dev**: `os.tmpdir()/dredge-card-cache/`

Cache invalidation: every launch fetches the tiny `Meta.json` from MTGJSON
and compares `data.version` against the cached `meta.json`. If they match,
the slim cache is reused. If `Meta.json` is unreachable but a cache exists,
Dredge falls back to the cache (offline-tolerant after first launch). If
both fail, the welcome overlay shows an error with a retry button.

Browser dev mode hits the same flow through Vite middleware at
`/api/carddb.json`.

## Image Loading (Scryfall)

Three-tier cache: memory → disk → Scryfall fetch.
- URL: `https://api.scryfall.com/cards/{uuid}?format=image`
- Disk cache (Electron): `{userData}/imageCache/{setCode}/{fileName}`
- Concurrency cap (6) + 120ms delay between requests
- Newest-first queue (current viewport prioritized)
- 200ms debounce on cards entering view, abort on scroll-off

## Booster Simulation (MTGJSON)

`boosterData.js` fetches `SetList.json` and per-set `{CODE}.json` from
`https://mtgjson.com/api/v5/`, cached on disk in:
- Electron: `{userData}/boosterCache/`
- Browser dev: `os.tmpdir()/dredge-booster-cache/` (via Vite middleware)

`SetList` has a 24h TTL; per-set data is cached indefinitely.
`boosterSimulator.js` rolls packs from `data.booster[type]` weighted sheets;
`packResolver.js` maps the resulting MTGJSON uuids back to the user's card
collection (or Scryfall, when needed).

## Pack Box Art

`packImage.js` resolves an MTGJSON `sealedProduct` entry of category
`booster_pack` and reads `identifiers.tcgplayerProductId`, then fetches
`https://product-images.tcgplayer.com/fit-in/437x437/{productId}.jpg`. If
nothing matches, `PackArt.vue` falls back to CSS art.

## Pack Audio

`packAudio.js` loads five samples once via Web Audio and routes them through a
master gain node so muting can be toggled mid-playback. The AudioContext is
unlocked inside the user gesture that opens the first pack (browser autoplay
policy), and that same gesture preloads samples.

## Development

```bash
npm install
npm run dev              # browser mode at http://localhost:5173
npm run electron:dev     # electron dev mode
npm test                 # vitest one-shot
npm run test:watch
npm run test:coverage
```

## Building

```bash
npm run electron:build:win     # NSIS installer (Windows x64)
npm run electron:build:mac     # DMG (macOS arm64, unsigned)
npm run electron:build:all     # both
```

Output lands in `dist-electron/`. Windows builds need Developer Mode enabled
(Settings → Privacy & Security → For developers) so electron-builder can
create symlinks. Distributable macOS builds should be produced on macOS (or a
`macos-14` CI runner) for code signing.

`npm run release` (or `release:patch`) bumps the version, tags, and pushes —
GitHub Actions then builds and uploads installers to the release. The
release script extracts the matching `## [<version>]` section from
`CHANGELOG.md` and uses it as the GitHub release body, so make sure the
CHANGELOG entry for the new version exists before running the script.

## Code Style

- Vue 3 Composition API with `<script setup>`
- No TypeScript (plain JS)
- Vuetify components first; reach for custom UI only when Vuetify can't do it
  cleanly. In Vuetify 4, slot scopes pass the raw object as `item` (not
  `item.raw` like v3).
- CSS custom properties for theming; Vuetify theme tokens defined in
  `plugins/vuetify.js`
- Frameless window: Windows uses `titleBarOverlay`, macOS uses
  `titleBarStyle: "hidden"`

## Maintenance

When you make non-trivial changes — new features, removed/renamed services,
shifted architecture, new build steps, new dependencies — update this file
and add an entry under `## [Unreleased]` in `CHANGELOG.md`. Move entries from
`Unreleased` into a new version section at release time.

## Key Design Decisions

- Card data is sourced from MTGJSON; the app is fully standalone.
- Heavy parsing (the multi-hundred-MB AllPrintings JSON) happens in the
  Electron main process so the renderer only ever JSON.parses the slim
  cache.
- Pack opening is the launch view — sealed-deck format is the primary workflow
- Virtual scrolling for browse mode (30k+ cards)
- Browser fallback + Vite middleware lets dev / tests run without Electron
- Default deck-build target is 40 cards (sealed); 60 selectable via toggle
- "Openable" set list is filtered to expansion / core / masters /
  draft_innovation / starter / funny / commander
  (`draft_innovation` is MTGJSON's literal set-type string)
