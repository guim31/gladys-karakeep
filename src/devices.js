// -----------------------------------------------------------------------------
// Karakeep -> one Gladys device per Karakeep user (`karakeep:<user id>`, the
// owner of the API key): its counters and the title of the latest bookmark.
// Everything is read only: bookmarks are saved through the scene actions and
// the widget form, never through a device feature.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as CAT,
  DEVICE_FEATURE_TYPES as TYPE,
} from '@gladysassistant/integration-sdk';
import { NAMES, NONE, pick } from './texts.js';

export const KARAKEEP_TYPE = 'karakeep';

export const COUNTERS = [
  'bookmarks',
  'unarchived',
  'favourites',
  'archived',
  'lists',
  'tags',
  'highlights',
];

const MAX_COUNT = 10_000_000;

export const karakeepIds = (gladys, userId) => gladys.externalIds(KARAKEEP_TYPE, userId);

/**
 * @param {object} gladys
 * @param {{ id: string, name?: string | null }} user
 * @param {string} language
 * @param {string} url Karakeep base URL (a device param, shown in Gladys)
 */
export function buildKarakeepDevice(gladys, user, language, url) {
  const names = pick(NAMES, language);
  const ids = karakeepIds(gladys, user.id);
  const feature = (key, fields) => ({
    name: names[key],
    external_id: ids.feature(key),
    read_only: true,
    has_feedback: false,
    ...fields,
  });
  return {
    name: 'Karakeep',
    external_id: ids.device,
    model: 'Karakeep',
    should_poll: false,
    features: [
      ...COUNTERS.map((key) =>
        feature(key, {
          category: CAT.COUNTER_SENSOR,
          type: TYPE.SENSOR.INTEGER,
          min: 0,
          max: MAX_COUNT,
          keep_history: true,
        }),
      ),
      feature('latest', {
        category: CAT.TEXT,
        type: TYPE.TEXT.TEXT,
        min: 0,
        max: 0,
        keep_history: false,
      }),
    ],
    params: [
      { name: 'KARAKEEP_URL', value: url },
      { name: 'KARAKEEP_USER', value: String(user.name || user.id).slice(0, 100) },
    ],
  };
}

/**
 * @param {object} gladys
 * @param {string} userId
 * @param {ReturnType<import('./karakeep/model.js').summarizeStats>} counters
 * @param {{ title: string } | undefined} latest the newest bookmark
 * @param {string} language
 */
export function buildKarakeepStates(gladys, userId, counters, latest, language) {
  const ids = karakeepIds(gladys, userId);
  return [
    ...COUNTERS.map((key) => ({
      device_feature_external_id: ids.feature(key),
      state: counters[key],
    })),
    {
      device_feature_external_id: ids.feature('latest'),
      text: (latest?.title || pick(NONE, language)).slice(0, 200),
    },
  ];
}

/** `ext:...:karakeep:abc` -> 'abc', or null when not ours. */
export function parseUserId(gladys, externalId) {
  if (typeof externalId !== 'string') {
    return null;
  }
  const prefix = gladys.externalId(`${KARAKEEP_TYPE}:`);
  if (!externalId.startsWith(prefix)) {
    return null;
  }
  const id = externalId.slice(prefix.length).split(':')[0];
  return id === '' ? null : id;
}
