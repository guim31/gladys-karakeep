// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys (a real GladysIntegration on an
// in-memory transport), the integration wired on it by registerHandlers, and
// a fake Karakeep.
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { MemoryStore } from '../../src/store.js';
import { API_KEY, HOST, NOW, createKarakeep, settle } from './fakeKarakeep.js';

export const FAST_TIMINGS = { widgetGap: 0, requestTimeout: 200 };

export async function createWorld({
  server = createKarakeep(),
  config = { url: HOST, api_key: API_KEY },
  devices = [],
  connect = true,
  store = new MemoryStore(),
  clock = { now: NOW },
} = {}) {
  const gladys = createFakeGladys({ config, devices });
  const app = registerHandlers(gladys, {
    fetch: server.fetch,
    timings: FAST_TIMINGS,
    now: () => clock.now,
    store,
  });
  if (connect) {
    await gladys.connect();
    await settle(20);
  }
  return { gladys, app, hub: app.hub, server, store, clock, fake: gladys.fake };
}

// The Karakeep user of the fixtures.
export const USER = 'rs4igra52w4ugtrtkwgrwj31';
export const karakeepDevice = (user = USER) => `ext:test-integration:karakeep:${user}`;
export const karakeepFeature = (key, user = USER) => `${karakeepDevice(user)}:${key}`;

/** Add every discovered device to Gladys, as the user would. */
export async function createAll(fake) {
  for (const device of fake.discoveredDevices) {
    await fake.deviceCreated(device);
  }
  await settle();
}
