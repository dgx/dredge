# Changelog

All notable changes to Dredge are tracked in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.3] — 2026-05-23

### Fixed
- Opened-pack cards now show their real mana cost, mana value, oracle text,
  and type — the slim card-database transform was storing MTGJSON's internal
  UUID as the printing's Scryfall ID, so pack resolution never matched local
  DB entries and every card fell through to a placeholder with empty
  mana/text and CMC 0 (breaking the deck-builder mana curve too). The
  transform now stores `identifiers.scryfallId`, and the slim-database cache
  is schema-versioned so existing installs re-parse `AllPrintings.json` on
  next launch.

## [0.5.2] — 2026-05-09

### Changed
- Card data now comes from MTGJSON's `AllPrintings.json` instead of a
  previously-required external XML data file. Dredge is now fully
  standalone. First launch streams a gzipped download from mtgjson.com and
  caches a transformed slim database under `{userData}/cardCache/`;
  subsequent launches use the cache and only re-fetch when MTGJSON publishes
  a new version.
- Open Packs is now the sole entry point to the sealed-deck workflow and got
  the same gold display title styling that the import page had. Internal
  modules, store, and CSS have been renamed away from "draft" terminology
  since the format is sealed deck, not draft.

### Added
- Branded full-screen welcome overlay shown during the first-launch card-data
  download, with explanation and live progress indicator.

### Removed
- Legacy XML card-database reader and `fast-xml-parser` dependency.
- Standalone Import Sealed Pool page, the titlebar "Re-import" /
  "Build Sealed Deck" button, and the "Import sealed pool instead" link in
  Open Packs. Import-from-Clipboard remains available on the Open Packs
  screen.

## [0.5.1] — 2026-05-09

### Changed
- Pack-opening reveal restructured around a single climactic beat. Cards
  now flip in build-up order (lands → commons → uncommons → rares → mythic /
  bonus-sheet last) instead of rarest-first. The mythic / masterpiece
  flourish, the tier-colored ambient backdrop, and the particle burst all
  fire together at the moment the headline card flips, so audio and visual
  peaks coincide. The climax card flips slightly slower with a one-shot
  on-card flash for emphasis. Common-only packs flip uniformly with no
  climax treatment.
- Lowered the masterpiece flourish volume so it no longer overshoots the
  mythic flourish.

### Fixed
- Reveal-order classification of nonbasic lands drawn from non-land slots
  (e.g. FIN's Capital City from `uncommon`, Ishgard from `wildcard`). The
  resolver now consults MTGJSON's top-level `types` as the authoritative
  land signal so these flip first instead of slotting into the rarity
  buildup.

## [0.5.0] — 2026-05-08

### Added
- Pack-opening overhaul with real TCGPlayer box-art and sample-based audio
  (rip / tear / flip / mythic / masterpiece) routed through a master gain.
- Sealed-deck import (bracketed `[SET:num]` / MTGA / bare formats) and deck-building
  workspace for both sealed pools and all-cards mode.
- MTGJSON-backed booster simulator: pick sets and pack counts, roll packs
  against MTGJSON sheet weights, resolve uuids back to the local pool.
- Vitest test suite covering services, stores, and Vuetify-aware components.
- macOS build target (`electron:build:mac`) and `electron:build:all`.
- GitHub Actions release workflow (Windows + macOS) on Node 24.

### Changed
- UI rebuilt on Vuetify 4 with a custom `dredgeDark` theme.
- Pack opening is now the launch view; sealed is the primary workflow.
- `npm audit fix` for transitive dependency advisories.

## [0.4.0]

### Changed
- npm dependency refresh.

## [0.3.0]

### Added
- Rarity filter and icon assets.
- Release run configuration.

### Changed
- Updated black-mana color and disambiguated the app title.

## [0.2.0]

### Added
- Mana curve with color breakdown and a parallel card-type bar graph.
- Bulk add/remove buttons per card-type category.
- Redesigned color filters.

### Fixed
- Card click/drag interactions and browser-only highlight artifacts.
- Empty-state messaging for the deck panel.

### Changed
- Larger toolbar; devtools hidden by default.

## [0.1.0]

### Added
- Initial release: card browser sourced from a local XML data file with Scryfall image fetching,
  three-tier image cache (memory → disk → network), virtual-scrolled grid,
  text / color / type filters, sorting, and card-detail modal.
