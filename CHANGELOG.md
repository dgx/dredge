# Changelog

All notable changes to Dredge are tracked in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] — 2026-05-08

### Added
- Pack-opening overhaul with real TCGPlayer box-art and sample-based audio
  (rip / tear / flip / mythic / masterpiece) routed through a master gain.
- Sealed-deck import (Cockatrice / MTGA / bare formats) and deck-building
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
- Initial release: Cockatrice `cards.xml` browser with Scryfall image fetching,
  three-tier image cache (memory → disk → network), virtual-scrolled grid,
  text / color / type filters, sorting, and card-detail modal.
