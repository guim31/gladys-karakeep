# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.0.1] - 2026-10-22

### Security

- Rebuilt on Node.js 24.22.1, the October 2026 security release (remote code
  execution in the Brotli decoder, CVE-2026-111497; TLS hostname and DNS
  fixes).

## [1.0.0] - 2026-10-17

### Added

- A Karakeep device: bookmarks, not archived, favourites, archived, lists,
  tags, highlights, and the title of the latest bookmark.
- The "Karakeep" dashboard widget: three tiles, the newest bookmarks (all,
  favourites or not archived) and a form to save a link or a note.
- Scene triggers "New bookmark" (filter by type) and "Bookmark marked as
  favourite", silent at installation, remembered across restarts.
- Scene actions "Save a link in Karakeep" and "Save a note in Karakeep", in a
  list, with tags, as favourite.
- Texts and documentation in English, French, German and Spanish.

[Unreleased]: https://github.com/guim31/gladys-karakeep/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/guim31/gladys-karakeep/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/guim31/gladys-karakeep/releases/tag/v1.0.0
