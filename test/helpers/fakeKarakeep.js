// -----------------------------------------------------------------------------
// A fake Karakeep behind a `fetch` function: it starts from the bodies recorded
// on a real Karakeep 0.33.2 (test/fixtures/karakeep/0.33.2/), keeps its
// bookmarks and lists in memory, and answers the errors the real server
// answers (plain-text 401, 404 and 400, a Zod 400 for a bad URL).
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

export const HOST = 'http://192.0.2.40:3000';
export const API_KEY = 'ak2_test_key';
// 2026-10-17, 20:00 UTC: just after the fixtures were recorded.
export const NOW = Date.parse('2026-10-17T20:00:00.000Z');

export const fixture = (name) =>
  JSON.parse(
    readFileSync(new URL(`../fixtures/karakeep/0.33.2/${name}.json`, import.meta.url), 'utf8'),
  );

export const settle = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

let counter = 0;
const newId = () => `fake${String((counter += 1)).padStart(20, '0')}`;

export function createKarakeep() {
  const state = {
    user: fixture('me').body,
    bookmarks: structuredClone(fixture('bookmarks').body.bookmarks),
    lists: structuredClone(fixture('lists').body.lists),
    tags: structuredClone(fixture('tags').body.tags),
    down: false,
    html: false,
    requests: [],
    clock: Date.parse('2026-10-17T18:30:00.000Z'),
  };
  const answer = (status, body, type = 'application/json') =>
    new Response(status === 204 ? null : typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'content-type': type },
    });
  const text = (status, body) => answer(status, body, 'text/plain;charset=UTF-8');

  function stats() {
    const base = fixture('stats').body;
    const count = (predicate) => state.bookmarks.filter(predicate).length;
    return {
      ...base,
      numBookmarks: state.bookmarks.length,
      numFavorites: count((b) => b.favourited),
      numArchived: count((b) => b.archived),
      numLists: state.lists.length,
      numTags: state.tags.length,
    };
  }

  function sorted() {
    return [...state.bookmarks].sort((a, b) =>
      a.createdAt === b.createdAt ? (a.id < b.id ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1,
    );
  }

  /** Add a bookmark as a user would (in the web app, the browser extension...). */
  function addBookmark({
    type = 'link',
    title = null,
    url = 'https://example.org/article',
    text: body = 'A note',
    favourited = false,
    archived = false,
    source = 'web',
    created,
  } = {}) {
    state.clock += 60_000;
    const at = created ?? new Date(state.clock).toISOString();
    const bookmark = {
      id: newId(),
      firstCreatedAt: at,
      createdAt: at,
      modifiedAt: at,
      title,
      archived,
      favourited,
      note: null,
      summary: null,
      source,
      userId: state.user.id,
      tags: [],
      content: type === 'text' ? { type: 'text', text: body, sourceUrl: null } : { type, url },
      assets: [],
    };
    state.bookmarks.push(bookmark);
    return bookmark;
  }

  async function fetch(url, init = {}) {
    const { pathname, searchParams } = new URL(url);
    const path = pathname.replace(/^\/api\/v1/, '');
    const method = init.method ?? 'GET';
    state.requests.push(`${method} ${path}${searchParams.size ? `?${searchParams}` : ''}`);
    if (state.down) {
      throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
    }
    if (state.html) {
      return answer(200, '<html>Login</html>', 'text/html');
    }
    if (init.headers?.Authorization !== `Bearer ${API_KEY}`) {
      return text(401, 'Unauthorized');
    }
    const body = init.body ? JSON.parse(init.body) : undefined;
    const find = (id) => state.bookmarks.find((b) => b.id === decodeURIComponent(id));

    if (method === 'GET' && path === '/users/me') {
      return answer(200, state.user);
    }
    if (method === 'GET' && path === '/users/me/stats') {
      return answer(200, stats());
    }
    if (method === 'GET' && path === '/bookmarks') {
      let list = sorted();
      if (searchParams.has('favourited')) {
        list = list.filter((b) => b.favourited === (searchParams.get('favourited') === 'true'));
      }
      if (searchParams.has('archived')) {
        list = list.filter((b) => b.archived === (searchParams.get('archived') === 'true'));
      }
      const start = Number(searchParams.get('cursor') ?? 0);
      const limit = Number(searchParams.get('limit') ?? 20);
      const page = list.slice(start, start + limit);
      const next = start + limit < list.length ? String(start + limit) : null;
      return answer(200, { bookmarks: page, nextCursor: next });
    }
    if (method === 'POST' && path === '/bookmarks') {
      if (body.type === 'link') {
        if (!/^https?:\/\//.test(body.url ?? '')) {
          return answer(400, fixture('create-bad-url').body);
        }
        const existing = state.bookmarks.find(
          (b) => b.content.type === 'link' && b.content.url === body.url,
        );
        if (existing) {
          return answer(200, existing);
        }
      }
      const bookmark = addBookmark({
        type: body.type,
        url: body.url,
        text: body.text,
        title: body.title ?? null,
        favourited: body.favourited === true,
        source: body.source ?? 'api',
      });
      return answer(201, bookmark);
    }
    let match = path.match(/^\/bookmarks\/([^/]+)$/);
    if (method === 'PATCH' && match) {
      const bookmark = find(match[1]);
      if (!bookmark) {
        return text(404, 'Bookmark not found');
      }
      Object.assign(bookmark, body);
      return answer(200, bookmark);
    }
    match = path.match(/^\/bookmarks\/([^/]+)\/tags$/);
    if (method === 'POST' && match) {
      const bookmark = find(match[1]);
      if (!bookmark) {
        return text(404, 'Bookmark not found');
      }
      const attached = [];
      for (const { tagName } of body.tags) {
        let tag = state.tags.find((t) => t.name === tagName);
        if (!tag) {
          tag = { id: newId(), name: tagName };
          state.tags.push(tag);
        }
        bookmark.tags.push({ id: tag.id, name: tag.name, attachedBy: 'human' });
        attached.push(tag.id);
      }
      return answer(200, { attached });
    }
    if (method === 'GET' && path === '/lists') {
      return answer(200, { lists: state.lists });
    }
    match = path.match(/^\/lists\/([^/]+)\/bookmarks\/([^/]+)$/);
    if (method === 'PUT' && match) {
      const list = state.lists.find((l) => l.id === decodeURIComponent(match[1]));
      if (!list) {
        return text(404, 'List not found');
      }
      if (list.type === 'smart') {
        return text(400, 'Smart lists cannot be added to');
      }
      list.bookmarkIds = [...new Set([...(list.bookmarkIds ?? []), decodeURIComponent(match[2])])];
      return answer(204);
    }
    return text(404, '404 Not Found');
  }

  return {
    state,
    fetch,
    addBookmark,
    favourite(id, value = true) {
      state.bookmarks.find((b) => b.id === id).favourited = value;
    },
    remove(id) {
      state.bookmarks = state.bookmarks.filter((b) => b.id !== id);
    },
    goDown() {
      state.down = true;
    },
    goUp() {
      state.down = false;
    },
  };
}
