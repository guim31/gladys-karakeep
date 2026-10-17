# Karakeep for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) integration for
[Karakeep](https://github.com/karakeep-app/karakeep) (formerly Hoarder), the
self-hosted app for bookmarks, notes and images: follow your counters, react
when a bookmark is added or starred, and save links or notes from scenes or
from the dashboard. Local only.

Tested against a real Karakeep 0.33.2 server (official Docker image).

## Features

- **A Karakeep device**: bookmarks, not archived (the reading list),
  favourites, archived, lists, tags, highlights, and the title of the latest
  bookmark.
- **Dashboard widget** "Karakeep": three tiles, the newest bookmarks (all,
  favourites or not archived) with their links, and a **Save** button opening
  a form (a link or a note).
- **Scene triggers**: "New bookmark" (filter by type: link, note, file) and
  "Bookmark marked as favourite", silent at installation, remembered across
  restarts.
- **Scene actions**: "Save a link in Karakeep" and "Save a note in Karakeep",
  in an existing list, with tags, as favourite.
- Texts in English, French, German and Spanish.

## Requirements

- Gladys Assistant 5.2 or later (the widget form).
- Karakeep reachable from Gladys (port 3000 by default) and an API key
  (Karakeep → Settings → API keys).

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-karakeep` (or find **Karakeep** in the
   catalog).
2. In **Configuration**, enter the address of Karakeep (`192.168.1.50`, port
   3000 by default) and the API key. Save.
3. Add the **Karakeep** device from the **Discover** tab.

The user guide is in [`docs/en.md`](docs/en.md) (also in
[French](docs/fr.md), [German](docs/de.md) and [Spanish](docs/es.md)); Gladys
links it from the Configuration screen.

## How it works

Karakeep pushes nothing: the container reads it every 5 minutes by default (1
to 60) with two requests — `/users/me/stats` and the 20 newest bookmarks —
plus the list of favourites when their number changed. The device is published
with `should_poll: false`; only changed states are sent to Gladys. Saves use
`POST /bookmarks`, `POST /bookmarks/{id}/tags` and
`PUT /lists/{id}/bookmarks/{bookmarkId}` of the REST API v1.

## Limitations

- One Karakeep user, the owner of the API key.
- The triggers fire at the next read, not instantly; at most ten events per
  read; imports are not announced.
- Nothing is ever deleted or archived in Karakeep.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests run against the SDK's fake Gladys and a fake Karakeep answering
with bodies recorded on a real Karakeep 0.33.2 server
(`test/fixtures/karakeep/`).

## Credits

- [Karakeep](https://github.com/karakeep-app/karakeep), by Mohamed Bassem and
  contributors (AGPL-3.0): this integration only talks to its REST API and
  contains none of its code.
- The cover is a generic drawing made for this project.

## Disclaimer

This project is not affiliated with, endorsed or sponsored by the Karakeep
project.

## License

Apache-2.0, see [`LICENSE`](LICENSE).
