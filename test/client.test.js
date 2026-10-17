// -----------------------------------------------------------------------------
// The Karakeep client and the plain-value helpers, on answers recorded on a
// real Karakeep 0.33.2 (errors in plain text, a Zod 400, a link saved twice).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, normalizeUrl } from '../src/config.js';
import { KarakeepClient, KarakeepError } from '../src/karakeep/client.js';
import {
  asLink,
  findList,
  parseTags,
  summarizeBookmark,
  summarizeStats,
} from '../src/karakeep/model.js';
import { API_KEY, HOST, createKarakeep, fixture } from './helpers/fakeKarakeep.js';

/** A fetch answering one recorded body. */
const recorded = (name) => async () => {
  const { status, contentType, body } = fixture(name);
  const raw = status === 204 ? null : typeof body === 'string' ? body : JSON.stringify(body);
  return new Response(raw, {
    status,
    headers: { 'content-type': contentType ?? 'application/json' },
  });
};
const client = (fetch) => new KarakeepClient({ url: HOST, apiKey: API_KEY, fetch, timeout: 100 });

async function kindOf(promise) {
  try {
    await promise;
  } catch (err) {
    assert.ok(err instanceof KarakeepError, err.message);
    return [err.kind, err.message];
  }
  return null;
}

test('errors are told apart, with the reason Karakeep gave', async () => {
  assert.deepEqual(await kindOf(client(recorded('unauthorized')).stats()), [
    'unauthorized',
    '/users/me/stats: Unauthorized',
  ]);
  assert.deepEqual(await kindOf(client(recorded('list-add-smart')).addToList('a', 'b')), [
    'rejected',
    '/lists/a/bookmarks/b: Smart lists cannot be added to',
  ]);
  assert.deepEqual(await kindOf(client(recorded('list-add-missing')).addToList('a', 'b')), [
    'not_found',
    '/lists/a/bookmarks/b: List not found',
  ]);
  assert.deepEqual(
    await kindOf(client(recorded('create-bad-url')).createBookmark({ type: 'link', url: 'x' })),
    ['rejected', '/bookmarks: Invalid URL, Only http and https URLs are allowed'],
  );
  const html = async () => new Response('<html>Sign in</html>', { status: 200 });
  assert.equal((await kindOf(client(html).stats()))[0], 'invalid');
  const refused = async () => {
    throw new TypeError('fetch failed', { cause: { code: 'EHOSTUNREACH' } });
  };
  assert.deepEqual(await kindOf(client(refused).me()), [
    'unreachable',
    'Karakeep unreachable (EHOSTUNREACH)',
  ]);
  const slow = (url, { signal }) =>
    new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
  assert.equal((await kindOf(client(slow).me()))[0], 'timeout');
});

test('a link saved twice: 201, then 200 with the existing bookmark', async () => {
  const created = await client(recorded('create-link')).createBookmark({
    type: 'link',
    url: 'https://gladysassistant.com/',
  });
  assert.equal(created.existed, false);
  const again = await client(recorded('create-link-again')).createBookmark({
    type: 'link',
    url: 'https://gladysassistant.com/',
  });
  assert.equal(again.existed, true);
  assert.equal(again.bookmark.id, created.bookmark.id);
});

test('the favourites are read page by page', async () => {
  const server = createKarakeep();
  for (let i = 0; i < 150; i += 1) {
    server.addBookmark({ url: `https://example.org/${i}`, favourited: true });
  }
  const favourites = await client(server.fetch).favourites();
  assert.equal(favourites.length, 151);
  assert.equal(server.state.requests.filter((r) => r.includes('favourited=true')).length, 2);
});

test('bookmarks and counters become plain values', () => {
  const [note, link] = fixture('bookmarks').body.bookmarks.map(summarizeBookmark);
  assert.equal(note.type, 'text');
  assert.equal(note.title, 'Note');
  assert.deepEqual(note.tags, ['maison', 'courses']);
  assert.equal(link.url, 'https://gladysassistant.com/');
  assert.equal(link.favourited, true);
  assert.equal(link.created, '2026-10-17T18:12:00.000Z');
  const untitled = summarizeBookmark({
    id: 'x',
    title: null,
    content: { type: 'link', url: 'https://www.example.org/a', title: null },
  });
  assert.equal(untitled.title, 'example.org');
  const bare = summarizeBookmark({ id: 'y', content: { type: 'text', text: '  Buy\n milk ' } });
  assert.equal(bare.title, 'Buy milk');
  assert.deepEqual(summarizeStats(fixture('stats').body), {
    bookmarks: 2,
    unarchived: 2,
    favourites: 1,
    archived: 0,
    lists: 2,
    tags: 2,
    highlights: 0,
  });
  assert.equal(summarizeStats({}).bookmarks, 0);
});

test('tags, lists and links typed by the user', () => {
  assert.deepEqual(parseTags(' courses, #maison; Courses\nété '), ['courses', 'maison', 'été']);
  assert.deepEqual(parseTags(undefined), []);
  assert.equal(parseTags(Array.from({ length: 30 }, (_, i) => `t${i}`).join(',')).length, 20);
  const lists = fixture('lists').body.lists;
  assert.equal(findList(lists, ' À LIRE ')?.type, 'manual');
  assert.equal(findList(lists, 'nope'), undefined);
  assert.equal(asLink('https://example.org/a?b=1'), 'https://example.org/a?b=1');
  assert.equal(asLink('www.example.org'), 'https://www.example.org');
  assert.equal(asLink('example.org'), null);
  assert.equal(asLink('buy milk'), null);
  assert.equal(asLink('javascript:alert(1)'), null);
});

test('the address and the key typed in the configuration', () => {
  assert.equal(normalizeUrl('192.0.2.10'), 'http://192.0.2.10:3000');
  assert.equal(normalizeUrl('192.0.2.10:3100/'), 'http://192.0.2.10:3100');
  assert.equal(normalizeUrl('https://example.org/keep/api/v1/'), 'https://example.org/keep');
  assert.equal(normalizeUrl('http://user:pass@example.org'), null);
  assert.equal(normalizeUrl('ftp://example.org'), null);
  const config = normalizeConfig({
    url: 'nope nope',
    api_key: ' Bearer ak2_x ',
    refresh_minutes: 7,
  });
  assert.equal(config.urlInvalid, true);
  assert.equal(config.apiKey, 'ak2_x');
  assert.equal(config.refreshMinutes, 5);
  assert.equal(config.language, 'fr');
});
