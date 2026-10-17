// What reaches `docker logs` at the default level (info): the lifecycle only.
// A normal cycle (reads, published states, events, polls) writes nothing at
// info, an outage logs one line, and its recovery one more.
//
// The SDK logger writes through console.log (debug, info) and console.error
// (warn, error), re-reading LOG_LEVEL on every call: the tests capture both.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOST, createKarakeep } from './helpers/fakeKarakeep.js';
import { createAll, createWorld } from './helpers/world.js';

function captureLogs(t) {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = 'debug';
  const captured = [];
  const record = (...args) => captured.push(args.map(String).join(' '));
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    if (previous === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = previous;
    }
  });
  return {
    all: () => [...captured],
    lines: () =>
      captured.filter((line) => !line.includes('[DEBUG]') && line.includes('[karakeep-')),
    reset: () => captured.splice(0),
  };
}

test('a normal cycle writes nothing at info: reads, states, events, polls', async (t) => {
  const logs = captureLogs(t);
  const world = await createWorld();
  t.after(() => world.app.stop());
  await createAll(world.fake);
  const start = logs.lines();
  assert.deepEqual(start.length, 1, start.join('\n'));
  assert.match(start[0], /Connected to Karakeep \(2 bookmarks\)/);
  logs.reset();
  for (let i = 0; i < 5; i += 1) {
    const bookmark = world.server.addBookmark({ url: `https://example.org/${i}` });
    world.server.favourite(bookmark.id);
    await world.hub.refresh();
  }
  await world.fake.poll(world.fake.discoveredDevices[0]);
  await world.fake.widgetGet('bookmarks', { settings: { filter: 'favourites' } });
  assert.ok(world.fake.sceneEvents.length >= 10, 'events were fired');
  assert.deepEqual(logs.lines(), [], 'nothing at info or above');
});

test('one line per save asked by the user', async (t) => {
  const logs = captureLogs(t);
  const world = await createWorld();
  t.after(() => world.app.stop());
  logs.reset();
  await world.fake.sceneAction('save_note', { text: 'Secret plans', tags: 'a, b' });
  const lines = logs.lines();
  assert.equal(lines.length, 1, lines.join('\n'));
  assert.match(lines[0], /\[INFO\].*Note saved, 2 tag\(s\)/);
  assert.ok(!lines[0].includes('Secret plans'), 'the content of a note is not logged');
});

test('Karakeep down: one warning, nothing per attempt, one line when it is back', async (t) => {
  const logs = captureLogs(t);
  const world = await createWorld();
  t.after(() => world.app.stop());
  logs.reset();
  world.server.goDown();
  for (let i = 0; i < 4; i += 1) {
    await world.hub.refresh();
  }
  const down = logs.lines();
  assert.equal(down.length, 1, down.join('\n'));
  assert.match(down[0], /\[WARN\].*Karakeep unreachable \(ECONNREFUSED\)/);
  logs.reset();
  world.server.goUp();
  await world.hub.refresh();
  const back = logs.lines();
  assert.equal(back.length, 1, back.join('\n'));
  assert.match(back[0], /\[INFO\].*Karakeep answers again \(2 bookmarks\)/);
});

test('the API key never reaches the logs', async (t) => {
  const logs = captureLogs(t);
  for (const apiKey of ['ak2_s3cr3t_wrong', 'ak2_test_key']) {
    const world = await createWorld({
      server: createKarakeep(),
      config: { url: HOST, api_key: apiKey },
    });
    await world.hub.refresh();
    await world.app.stop();
  }
  const all = logs.all().join('\n');
  for (const secret of ['ak2_s3cr3t_wrong', 'ak2_test_key']) {
    assert.ok(!all.includes(secret), secret);
  }
});
