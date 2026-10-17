// -----------------------------------------------------------------------------
// The hub end to end, against the SDK's fake Gladys and a fake Karakeep
// answering the bodies of a real Karakeep 0.33.2: device and states, scene
// triggers, scene actions, widget, connection status, persistence.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { MemoryStore } from '../src/store.js';
import { API_KEY, HOST, createKarakeep, settle } from './helpers/fakeKarakeep.js';
import { createAll, createWorld, karakeepDevice, karakeepFeature } from './helpers/world.js';

const LIST = 'uts4e5jcwr9ppn2oewtic3n5'; // "À lire", manual
const events = (fake, key) => fake.sceneEvents.filter((event) => event.key === key);

test('one device per Karakeep user, states once added, republished on creation', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const [device] = world.fake.discoveredDevices;
  assert.equal(device.external_id, karakeepDevice());
  assert.equal(device.should_poll, false);
  assert.deepEqual(
    device.features.map((f) => f.name),
    [
      'Marque-pages',
      'Non archivés',
      'Favoris',
      'Archivés',
      'Listes',
      'Tags',
      'Surlignages',
      'Dernier marque-page',
    ],
  );
  // Not added yet: nothing published.
  assert.equal(world.fake.states.length, 0);
  await createAll(world.fake);
  assert.equal(world.fake.lastState(karakeepFeature('bookmarks')), 2);
  assert.equal(world.fake.lastState(karakeepFeature('unarchived')), 2);
  assert.equal(world.fake.lastState(karakeepFeature('favourites')), 1);
  assert.equal(world.fake.lastState(karakeepFeature('lists')), 2);
  assert.equal(world.fake.lastState(karakeepFeature('tags')), 2);
  assert.equal(world.fake.lastState(karakeepFeature('highlights')), 0);
  assert.equal(world.fake.lastState(karakeepFeature('latest')), 'Note');
  assert.ok(world.fake.widgetRefreshes.length > 0);
  assert.equal(world.fake.connectionStatus.connected, true);
});

test('the container reads Karakeep on its own timer, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const world = await createWorld({
    config: { url: HOST, api_key: API_KEY, refresh_minutes: '1' },
  });
  t.after(() => world.app.stop());
  await createAll(world.fake);
  world.server.addBookmark({ title: 'Read me' });
  t.mock.timers.tick(60_000);
  await settle(20);
  assert.equal(world.fake.lastState(karakeepFeature('bookmarks')), 3);
  assert.equal(world.fake.lastState(karakeepFeature('latest')), 'Read me');
  assert.ok(!world.fake.requests.some((r) => r.path?.includes('poll')));
});

test('new bookmark: silent baseline, then one event per bookmark, never twice', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  assert.equal(world.fake.sceneEvents.length, 0, 'the first read announces nothing');
  world.server.addBookmark({ url: 'https://example.org/a', title: 'Article A' });
  world.server.addBookmark({ type: 'text', text: 'Buy AA batteries' });
  world.server.addBookmark({ url: 'https://example.org/old', source: 'import' });
  await world.hub.refresh();
  await world.hub.refresh();
  const added = events(world.fake, 'bookmark_added');
  assert.equal(added.length, 2);
  assert.deepEqual(added[0].data, {
    title: 'Article A',
    url: 'https://example.org/a',
    text: '',
    type: 'link',
    type_name: 'Lien',
    tags: '',
  });
  assert.equal(added[1].data.type, 'text');
  assert.equal(added[1].data.text, 'Buy AA batteries');
  assert.equal(added[1].data.title, 'Buy AA batteries');
});

test('a deleted bookmark does not make an older one look new', async (t) => {
  const server = createKarakeep();
  for (let i = 0; i < 25; i += 1) {
    server.addBookmark({ url: `https://example.org/${i}` });
  }
  const world = await createWorld({ server });
  t.after(() => world.app.stop());
  const newest = server.state.bookmarks.at(-1).id;
  server.remove(newest);
  await world.hub.refresh();
  assert.equal(world.fake.sceneEvents.length, 0);
});

test('starring a bookmark fires once; an unchanged count reads no favourite list', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const note = world.server.state.bookmarks.find((b) => b.content.type === 'text');
  world.server.favourite(note.id);
  await world.hub.refresh();
  const starred = events(world.fake, 'bookmark_favourited');
  assert.equal(starred.length, 1);
  assert.equal(starred[0].data.title, 'Note');
  assert.equal(starred[0].data.tags, 'maison, courses');
  world.server.state.requests.length = 0;
  await world.hub.refresh();
  assert.equal(events(world.fake, 'bookmark_favourited').length, 1);
  assert.ok(!world.server.state.requests.some((r) => r.includes('favourited=true')));
});

test('a burst is capped at ten events per read', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  for (let i = 0; i < 15; i += 1) {
    world.server.addBookmark({ url: `https://example.org/rss/${i}`, source: 'rss' });
  }
  await world.hub.refresh();
  await world.hub.refresh();
  assert.equal(events(world.fake, 'bookmark_added').length, 10);
});

test('what was seen survives a restart; what came meanwhile is announced', async (t) => {
  const store = new MemoryStore();
  const server = createKarakeep();
  const first = await createWorld({ server, store });
  await first.app.stop();
  server.addBookmark({ url: 'https://example.org/while-down', title: 'While down' });
  const second = await createWorld({ server, store });
  t.after(() => second.app.stop());
  const added = events(second.fake, 'bookmark_added');
  assert.deepEqual(
    added.map((e) => e.data.title),
    ['While down'],
  );
});

test('an event Gladys refused is fired again at the next read', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  world.server.addBookmark({ url: 'https://example.org/retry', title: 'Retry' });
  const publish = world.gladys.publishSceneEvent.bind(world.gladys);
  let refuse = true;
  world.gladys.publishSceneEvent = async (...args) => {
    if (refuse) {
      throw new Error('Gladys restarting');
    }
    return publish(...args);
  };
  await world.hub.refresh();
  assert.equal(events(world.fake, 'bookmark_added').length, 0);
  refuse = false;
  await world.hub.refresh();
  assert.deepEqual(
    events(world.fake, 'bookmark_added').map((e) => e.data.title),
    ['Retry'],
  );
});

test('save a link: in a list, tagged, favourite; never announced; saved again', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const ack = await world.fake.sceneAction('save_link', {
    url: 'https://example.org/recipe',
    title: 'Recipe',
    list: '  à LIRE ',
    tags: 'cuisine, #maison; cuisine',
    favourite: true,
  });
  assert.equal(ack.success, true, ack.error);
  assert.equal(ack.data.outputs.already_saved, false);
  assert.equal(ack.data.outputs.title, 'Recipe');
  const saved = world.server.state.bookmarks.find((b) => b.id === ack.data.outputs.bookmark_id);
  assert.equal(saved.content.url, 'https://example.org/recipe');
  assert.equal(saved.favourited, true);
  assert.deepEqual(
    saved.tags.map((tag) => tag.name),
    ['cuisine', 'maison'],
  );
  assert.deepEqual(world.server.state.lists.find((l) => l.id === LIST).bookmarkIds, [saved.id]);
  await settle(20);
  await world.hub.refresh();
  assert.equal(world.fake.sceneEvents.length, 0, 'no loop through the triggers');

  // Saved by a scene, starred later by hand: that one is announced.
  const note = await world.fake.sceneAction('save_note', { text: 'Starred later' });
  world.server.favourite(note.data.outputs.bookmark_id);
  await world.hub.refresh();
  assert.deepEqual(
    world.fake.sceneEvents.map((e) => [e.key, e.data.title]),
    [['bookmark_favourited', 'Starred later']],
  );

  const again = await world.fake.sceneAction('save_link', { url: 'https://example.org/recipe' });
  assert.equal(again.data.outputs.already_saved, true);
  assert.equal(again.data.outputs.bookmark_id, saved.id);
});

test('save a note, and the errors of the scene actions', async (t) => {
  const world = await createWorld({ config: { url: HOST, api_key: API_KEY, language: 'en' } });
  t.after(() => world.app.stop());
  const ack = await world.fake.sceneAction('save_note', { text: 'Buy AA batteries' });
  assert.equal(ack.success, true, ack.error);
  assert.equal(ack.data.outputs.title, 'Buy AA batteries');
  const note = world.server.state.bookmarks.find((b) => b.id === ack.data.outputs.bookmark_id);
  assert.deepEqual(note.content, { type: 'text', text: 'Buy AA batteries', sourceUrl: null });

  const fail = async (key, fields) => (await world.fake.sceneAction(key, fields)).error;
  assert.match(await fail('save_link', { url: 'not a link' }), /http:\/\/ or https:\/\//);
  assert.match(await fail('save_link', { url: 'ftp://example.org' }), /http:\/\/ or https:\/\//);
  assert.match(await fail('save_note', { text: '   ' }), /text of the note/);
  assert.match(await fail('save_note', { text: 'x', list: 'Nope' }), /No list "Nope"/);
  assert.match(await fail('save_note', { text: 'x', list: 'smart' }), /smart list/);
  world.server.goDown();
  assert.match(await fail('save_note', { text: 'x' }), /does not answer/);
});

test('connection status: missing settings, refused key, unreachable, recovered', async (t) => {
  const none = await createWorld({ config: {} });
  assert.equal(none.fake.connectionStatus.connected, false);
  assert.match(none.fake.connectionStatus.message.en, /Enter the address/);
  await none.app.stop();

  const invalid = await createWorld({ config: { url: 'ftp://nope', api_key: 'x' } });
  assert.match(invalid.fake.connectionStatus.message.en, /not valid/);
  await invalid.app.stop();

  const refused = await createWorld({ config: { url: HOST, api_key: 'wrong' } });
  assert.match(refused.fake.connectionStatus.message.fr, /refusé la clé/);
  assert.equal(refused.fake.discoveredDevices.length, 0);
  await refused.app.stop();

  const world = await createWorld();
  t.after(() => world.app.stop());
  world.server.goDown();
  await world.hub.refresh();
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.en, /does not answer/);
  world.server.goUp();
  await world.hub.refresh();
  assert.equal(world.fake.connectionStatus.connected, true);
  const report = await world.fake.action('test_connection', {});
  assert.match(
    report.data.fr ?? report.data.message?.fr ?? JSON.stringify(report.data),
    /2 marque-page/,
  );
});

test('a key pasted with its scheme, an address with /api/v1 and a proxy page', async (t) => {
  const world = await createWorld({
    config: { url: `${HOST}/api/v1/`, api_key: `Bearer ${API_KEY}` },
  });
  t.after(() => world.app.stop());
  assert.equal(world.fake.connectionStatus.connected, true);
  world.server.state.html = true;
  await world.hub.refresh();
  assert.match(world.fake.connectionStatus.message.en, /does not answer like Karakeep/);
});

test('widget: tiles, the newest bookmarks, filters, and a valid content', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const get = async (settings = {}, language = 'en') =>
    (await world.fake.widgetGet('bookmarks', { settings, language })).data.content;
  const all = await get();
  assert.deepEqual(validateWidgetContent(all), []);
  assert.deepEqual(
    all.components.filter((c) => c.type === 'value').map((c) => c.value),
    [2, 2, 1],
  );
  const list = all.components.find((c) => c.type === 'card-list');
  assert.deepEqual(
    list.items.map((item) => item.title),
    ['Note', 'Gladys Assistant'],
  );
  const link = list.items[1];
  assert.equal(link.badge.text, 'Favourite');
  assert.match(link.subtitle, /^gladysassistant\.com · 17 Oct/);
  assert.deepEqual(
    link.links.map((l) => l.url),
    ['https://gladysassistant.com/'],
  );
  assert.equal(list.items[0].description, 'Racheter des piles AA');

  const favourites = await get({ filter: 'favourites' }, 'fr');
  assert.deepEqual(validateWidgetContent(favourites), []);
  assert.deepEqual(
    favourites.components.find((c) => c.type === 'card-list').items.map((i) => i.title),
    ['Gladys Assistant'],
  );
  const button = favourites.components.find((c) => c.type === 'button');
  assert.equal(button.label, 'Enregistrer');
  assert.deepEqual(
    button.action.fields.map((f) => f.key),
    ['content', 'favourite'],
  );
});

test('widget: a Karakeep on https gets an "Open in Karakeep" link', async (t) => {
  const server = createKarakeep();
  const fetch = (url, init) => server.fetch(url.replace('https://keep.example.org', HOST), init);
  const world = await createWorld({
    server: { ...server, fetch },
    config: { url: 'https://keep.example.org', api_key: API_KEY },
  });
  t.after(() => world.app.stop());
  const content = (await world.fake.widgetGet('bookmarks', { settings: {}, language: 'en' })).data
    .content;
  const note = content.components.find((c) => c.type === 'card-list').items[0];
  assert.deepEqual(note.links, [
    {
      url: `https://keep.example.org/dashboard/preview/${server.state.bookmarks.find((b) => b.content.type === 'text').id}`,
      label: 'Open in Karakeep',
    },
  ]);
});

test('widget form: a link or a note, a Gladys without forms refused', async (t) => {
  const world = await createWorld({ config: { url: HOST, api_key: API_KEY, language: 'en' } });
  t.after(() => world.app.stop());
  const tap = (values) =>
    world.fake.widgetAction('bookmarks', 'save', {}, { settings: {}, values });
  const link = await tap({ content: 'www.example.org/page', favourite: true });
  assert.equal(link.success, true, link.error);
  assert.equal(link.data.message.en, 'Link saved in Karakeep.');
  const saved = world.server.state.bookmarks.at(-1);
  assert.equal(saved.content.url, 'https://www.example.org/page');
  assert.equal(saved.favourited, true);
  const note = await tap({ content: 'Call the plumber tomorrow' });
  assert.equal(note.data.message.fr, 'Note enregistrée dans Karakeep.');
  const again = await tap({ content: 'https://gladysassistant.com/' });
  assert.equal(again.data.message.en, 'Link already in Karakeep.');
  assert.match((await tap(undefined)).error, /5\.2 or later/);
  assert.match((await tap({ content: ' ' })).error, /link or the text/);
  await settle(20);
  await world.hub.refresh();
  assert.equal(world.fake.sceneEvents.length, 0);
});

test('a waiting widget before the first answer', async (t) => {
  const world = await createWorld({ config: {} });
  t.after(() => world.app.stop());
  const content = (await world.fake.widgetGet('bookmarks', { settings: {}, language: 'de' })).data
    .content;
  assert.deepEqual(validateWidgetContent(content), []);
  assert.match(content.components[0].text, /Warte auf Karakeep/);
});

test('onPoll republishes the states of our device only', async (t) => {
  const world = await createWorld({
    devices: [{ external_id: karakeepDevice(), features: [] }],
  });
  t.after(() => world.app.stop());
  assert.deepEqual(await world.fake.poll({ external_id: karakeepDevice() }), { success: true });
  assert.equal(world.fake.lastState(karakeepFeature('bookmarks')), 2);
  assert.deepEqual(await world.fake.poll({ external_id: karakeepDevice('other') }), {
    success: true,
  });
});

test('review fixes: own star then hand star, swapped favourites, final refusals', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  // Saved as favourite by a scene, un-starred then starred again by hand.
  const saved = await world.fake.sceneAction('save_link', {
    url: 'https://example.org/star',
    favourite: true,
  });
  await settle(20);
  await world.hub.refresh();
  const id = saved.data.outputs.bookmark_id;
  world.server.favourite(id, false);
  await world.hub.refresh();
  world.server.favourite(id, true);
  await world.hub.refresh();
  assert.deepEqual(
    events(world.fake, 'bookmark_favourited').map((e) => e.data.url),
    ['https://example.org/star'],
  );

  // One star set, one removed: same count, seen at the hourly full read.
  const note = world.server.state.bookmarks.find((b) => b.content.type === 'text');
  world.server.favourite(note.id, true);
  world.server.favourite(id, false);
  await world.hub.refresh();
  assert.equal(events(world.fake, 'bookmark_favourited').length, 1);
  world.clock.now += 3_600_000;
  await world.hub.refresh();
  assert.equal(events(world.fake, 'bookmark_favourited').length, 2);

  // A refusal for good (4xx) is not retried at every read.
  let calls = 0;
  world.gladys.publishSceneEvent = async () => {
    calls += 1;
    throw Object.assign(new Error('not declared'), { status: 404 });
  };
  world.server.addBookmark({ url: 'https://example.org/refused' });
  await world.hub.refresh();
  await world.hub.refresh();
  assert.equal(calls, 1);
});

test('review fixes: title of an already saved link, timeout told apart', async (t) => {
  const world = await createWorld({ config: { url: HOST, api_key: API_KEY, language: 'en' } });
  t.after(() => world.app.stop());
  const ack = await world.fake.sceneAction('save_link', {
    url: 'https://gladysassistant.com/',
    title: 'Gladys home page',
  });
  assert.equal(ack.data.outputs.already_saved, true);
  assert.equal(ack.data.outputs.title, 'Gladys home page');
  const stored = world.server.state.bookmarks.find((b) => b.id === ack.data.outputs.bookmark_id);
  assert.equal(stored.title, 'Gladys home page');

  const fetch = world.server.fetch;
  world.hub.client.fetch = (url, init) =>
    init.method === 'POST'
      ? new Promise((resolve, reject) => {
          const hold = setTimeout(() => {}, 5_000);
          init.signal.addEventListener('abort', () => {
            clearTimeout(hold);
            reject(init.signal.reason);
          });
        })
      : fetch(url, init);
  const late = await world.fake.sceneAction('save_note', { text: 'Late' });
  assert.match(late.error, /may have been saved/);
});
