# Karakeep

Connect Gladys to [Karakeep](https://karakeep.app) (formerly Hoarder), the
self-hosted app for bookmarks, notes and images: follow your counters, react
when a bookmark is added or starred, and save links or notes from your scenes
or from the dashboard. Everything stays on your local network: Gladys talks
directly to your Karakeep server.

Tested against a real Karakeep 0.33.2 server (the official Docker image).
Feedback welcome on the Gladys forum.

## Prerequisites

- Gladys Assistant 5.2 or later.
- A Karakeep server reachable from the Gladys machine, on port 3000 by
  default, or through a reverse proxy.
- An API key: in Karakeep, open **Settings → API keys** and create one. The
  integration sees the bookmarks of the user who owns the key.

## Configuration

1. Open the **Configuration** tab of the integration.
2. In **Karakeep address**, enter the IP address of the server, for example
   `192.168.1.50`: the integration then uses port 3000. Add a port if yours
   differs (`192.168.1.50:3100`). Behind a reverse proxy, enter the full
   address (`https://keep.example.org`).
3. Paste the **API key**.
4. **Read Karakeep every**: 1, 5 (default), 15, 30 or 60 minutes. New
   bookmarks and favourites are announced at the next read.
5. **Language of names and messages** sets the feature names (fixed when the
   device is added) and the texts of the integration. French by default.
6. Save, then use **Test the connection**: it shows the Karakeep user and the
   number of bookmarks and lists.
7. In the **Discovery** tab, add the **Karakeep** device.

## Device

**Karakeep** (one device for the user of the API key):

| Feature         | Value                                         |
| --------------- | --------------------------------------------- |
| Bookmarks       | number of bookmarks (links, notes and files)  |
| Not archived    | bookmarks not archived yet: your reading list |
| Favourites      | bookmarks marked as favourite                 |
| Archived        | archived bookmarks                            |
| Lists           | number of lists                               |
| Tags            | number of tags                                |
| Highlights      | number of highlights                          |
| Latest bookmark | title of the newest bookmark, or "None"       |

The counters keep their history: a chart shows how your reading list grows.

## Dashboard widget

**Karakeep**: three tiles (bookmarks, not archived, favourites), the six newest
bookmarks and a **Save** button. In the widget settings, **Bookmarks shown**
picks the newest bookmarks, the newest favourites or the newest not archived.
Tap a bookmark to read its description or note, and to open the link (https
links only; **Open in Karakeep** appears when Karakeep is reached over https).
**Save** opens a form: type a link (`https://…` or `www.…`) or the text of a
note, tick **Favourite** if you want, and the integration saves it.

## Scene triggers

- **New bookmark**: a link, a note or a file is saved in Karakeep, from the web
  app, the browser extension, the mobile app or an RSS feed. The **Type** filter
  keeps only links, notes or files. Imports and the bookmarks saved by this
  integration are not announced.
- **Bookmark marked as favourite**: a bookmark is starred in Karakeep.

Variables of both: **Title**, **Link** (empty for a note), **Text of the note**
(empty for a link), **Type** (`link`, `text` or `asset`), **Type, in words**
and **Tags** (separated by commas).

The first read after the installation is silent: the bookmarks already there
are not announced. At most ten events are fired per read; the rest is counted
as seen.

## Scene actions

- **Save a link in Karakeep**: **Link** (required), and optionally **Title**,
  **List** (the name of an existing list, upper or lower case alike), **Tags**
  (separated by commas; missing tags are created) and **Mark as favourite**.
  Returns **Bookmark id**, **Title** and **Already saved** (the link was in
  Karakeep already: Karakeep keeps a single bookmark per link).
- **Save a note in Karakeep**: the same, with the **Text of the note** instead
  of the link. Returns **Bookmark id** and **Title**.

A smart list cannot receive a bookmark: Karakeep fills it from its query.

## Scene examples

- **Shopping button**: a Zigbee button in the kitchen is pressed → **Save a note
  in Karakeep** with the text `Buy coffee`, list `Shopping`, tag `home`.
- **Reading reminder**: every Friday at 18:00 → continue only if the device
  feature **Not archived** is above 20 → send a message "Your Karakeep reading
  list has more than 20 bookmarks".
- **Notes on your phone**: trigger **New bookmark**, type **Note** → send a
  message "Note: {{triggerEvent.data.text}}".
- **Favourite to share**: trigger **Bookmark marked as favourite** → send a
  message "New favourite: {{triggerEvent.data.title}}
  {{triggerEvent.data.url}}".

## Troubleshooting

- **"Karakeep refused the API key"**: the key was deleted or mistyped. Create
  a new one in Karakeep → Settings → API keys.
- **"Karakeep does not answer"**: check the address and the port from the
  Gladys machine. The container uses a bridge network: `localhost` is the
  container itself, enter the IP address of the server instead.
- **"This address does not answer like Karakeep"**: a proxy login page answers
  instead of Karakeep. Enter the address of Karakeep itself, or let the proxy
  through for the Gladys machine.
- **"No list … in Karakeep"**: the list name of the scene action must match an
  existing list. Create it in Karakeep first.
- To see more in the logs of the integration, set `LOG_LEVEL=debug`.

## Limits

- One Karakeep user: the owner of the API key.
- The triggers fire at the next read (5 minutes by default), not instantly:
  Karakeep pushes nothing.
- Starring and un-starring the same bookmark between two reads goes unnoticed;
  a star set while another is removed is seen within the hour.
- The integration never deletes nor archives anything in Karakeep.
- Not affiliated with the Karakeep project.
