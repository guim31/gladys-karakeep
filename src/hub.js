// -----------------------------------------------------------------------------
// The hub: the link to one Karakeep account and everything Gladys sees of it —
// the device, its states, the connection status, the scene events, and the
// bookmarks saved from scenes and from the widget.
//
// Karakeep pushes nothing: the container reads it every `refresh_minutes`
// (5 by default) on its own timer (should_poll: false). A read is two
// requests — the statistics and the 20 newest bookmarks — plus the list of
// favourites when their number changed.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { buildKarakeepDevice, buildKarakeepStates, karakeepIds, parseUserId } from './devices.js';
import { KarakeepClient, KarakeepError } from './karakeep/client.js';
import {
  asLink,
  findList,
  parseTags,
  summarizeBookmark,
  summarizeStats,
} from './karakeep/model.js';
import { MemoryStore } from './store.js';
import { STATUS_TEXT, TEST_TEXT, TYPES, commandMessage, pick } from './texts.js';

const logger = createLogger({ name: 'karakeep-hub' });

export const WIDGET_KEY = 'bookmarks';
export const TRIGGERS = { added: 'bookmark_added', favourited: 'bookmark_favourited' };

export const DEFAULT_TIMINGS = {
  // requestWidgetRefresh is dropped by the core beyond one call per 10 s.
  widgetGap: 10_500,
  // An unchanged value is sent again before Gladys calls it stale (48 h).
  heartbeat: 6 * 3_600_000,
  requestTimeout: 15_000,
  // How long a filtered list of the widget is reused.
  widgetCache: 60_000,
};

export const LATEST_COUNT = 20;
export const MAX_FAVOURITES = 1000;
// An RSS feed or a burst of saves can bring many bookmarks at once: past that
// many events in one read, the rest is recorded as seen without firing.
export const MAX_EVENTS_PER_READ = 10;
// The bookmarks saved by the integration itself are never announced (a scene
// bound to "New bookmark" that saves one would loop).
const MAX_OWN = 200;

/** An Error carrying a coded, multi-language message. */
export class CommandError extends Error {
  constructor(code, language, values) {
    const messages = commandMessage(code, values);
    super(messages[language] ?? messages.en);
    this.code = code;
    this.messages = messages;
  }
}

const linkOf = (config) => JSON.stringify([config.url, config.apiKey]);

export class Hub {
  constructor({ gladys, fetch, timings, now = Date.now, store }) {
    this.gladys = gladys;
    this.fetch = fetch;
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.now = now;
    this.store = store ?? new MemoryStore();
    this.config = { url: null, urlInvalid: false, apiKey: '', refreshMinutes: 5, language: 'fr' };
    this.client = null;
    /** the owner of the API key: { id, name } */
    this.user = null;
    this.counters = null;
    /** the newest bookmarks, summarized */
    this.latest = [];
    /** null (fine), or the kind of the last failure */
    this.failure = null;
    this.announced = false;
    this.lastStatus = '';
    /** what the triggers already saw: { userId, since, bookmarks, favourites, favouriteCount } */
    this.seen = null;
    this.own = new Set();
    /** the bookmarks the integration starred itself */
    this.ownFavourites = new Set();
    this.widgetLists = new Map();
    this.configuring = Promise.resolve();
    this.refreshTimer = null;
    this.refreshing = null;
    this.refreshAgain = false;
    this.widgetRefreshAt = 0;
    this.widgetTimer = null;
    this.publishFailing = false;
    this.stopped = false;
  }

  get language() {
    return this.config.language;
  }

  get loaded() {
    return this.counters !== null;
  }

  async start(config) {
    const saved = await this.store.load();
    const valid =
      typeof saved.userId === 'string' &&
      typeof saved.since === 'string' &&
      Array.isArray(saved.bookmarks) &&
      Array.isArray(saved.favourites);
    // A damaged file is a new baseline, not a crash on every read.
    this.seen = valid ? saved : null;
    await this.reconfigure(config);
  }

  /** One configuration change at a time: a second one waits for the first. */
  reconfigure(config) {
    const run = this.configuring.then(() => this.#reconfigure(config));
    this.configuring = run.catch(() => {});
    return run;
  }

  async #reconfigure(config) {
    const previous = this.config;
    this.config = config;
    const linkChanged = linkOf(previous) !== linkOf(config) || !this.client;
    if (linkChanged || previous.refreshMinutes !== config.refreshMinutes) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (linkChanged) {
      this.client = null;
      this.user = null;
      this.counters = null;
      this.latest = [];
      this.failure = null;
      this.announced = false;
      this.widgetLists.clear();
      if (config.url && config.apiKey) {
        this.client = new KarakeepClient({
          url: config.url,
          apiKey: config.apiKey,
          fetch: this.fetch,
          timeout: this.timings.requestTimeout,
        });
      }
    }
    if (this.client && !this.refreshTimer) {
      this.refreshTimer = setInterval(
        () => this.refresh().catch((err) => logger.error('Read failed', err)),
        config.refreshMinutes * 60_000,
      );
      this.refreshTimer.unref?.();
    }
    if (linkChanged) {
      await this.refresh();
    } else {
      // Language or interval only: same data, new names and texts.
      this.gladys.forgetPublishedStates?.();
      await this.#update();
    }
    await this.updateConnectionStatus();
  }

  /** Gladys reconnected (it may have restarted): send everything again. */
  async resync(config) {
    this.gladys.forgetPublishedStates?.();
    this.lastStatus = '';
    await this.reconfigure(config);
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.refreshTimer);
    clearTimeout(this.widgetTimer);
    this.refreshTimer = null;
    await this.store.flush();
  }

  // --- Reading Karakeep -----------------------------------------------------

  /** Read Karakeep (one read at a time; a request during it runs once after). */
  refresh() {
    if (this.refreshing) {
      this.refreshAgain = true;
      return this.refreshing;
    }
    this.refreshing = (async () => {
      do {
        this.refreshAgain = false;
        try {
          await this.#refreshOnce();
        } catch (err) {
          // Never ends the loop: a read queued meanwhile (new address) still runs.
          logger.error('Read failed', err);
        }
      } while (this.refreshAgain && !this.stopped);
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  async #refreshOnce() {
    const client = this.client;
    if (this.stopped) {
      return;
    }
    if (!client) {
      await this.publishDevices();
      return;
    }
    let user;
    let stats;
    let page;
    let favourites = null;
    try {
      user = this.user ?? (await client.me());
      [stats, page] = await Promise.all([
        client.stats(),
        client.bookmarks({ limit: LATEST_COUNT }),
      ]);
      const known = this.seen?.userId === user.id ? this.seen : null;
      // A favourite is told by the list of favourites, sorted by creation
      // date, not by the time it was starred: read it whole, but only when
      // the number of favourites changed (or for the first baseline).
      if (!known || known.favouriteCount !== stats.numFavorites) {
        favourites = stats.numFavorites > 0 ? await client.favourites(MAX_FAVOURITES) : [];
      }
    } catch (err) {
      if (client !== this.client) {
        return;
      }
      this.#fail(err);
      await this.updateConnectionStatus();
      return;
    }
    if (client !== this.client || this.stopped) {
      return;
    }
    this.user = { id: user.id, name: user.name || user.email || user.id };
    this.counters = summarizeStats(stats);
    this.latest = page.bookmarks.map(summarizeBookmark);
    this.widgetLists.clear();
    this.#recover();
    await this.#update();
    await this.#announce(
      this.latest,
      favourites && favourites.map(summarizeBookmark),
      stats.numFavorites,
    );
    await this.updateConnectionStatus();
  }

  /** Device, states and widget from the last read. */
  async #update() {
    await this.publishDevices();
    await this.publishStates();
    this.refreshWidget();
  }

  #fail(err) {
    const kind = err instanceof KarakeepError ? err.kind : 'unreachable';
    if (this.failure === null) {
      logger.warn(`Karakeep: ${err.message}`);
    } else {
      logger.debug(`Karakeep still failing: ${err.message}`);
    }
    this.failure = kind;
    if (kind === 'unauthorized' || kind === 'invalid' || kind === 'not_found') {
      // Another key may belong to another user.
      this.user = null;
    }
  }

  #recover() {
    const count = this.counters.bookmarks;
    if (this.failure !== null) {
      logger.info(`Karakeep answers again (${count} bookmarks)`);
    } else if (!this.announced) {
      logger.info(`Connected to Karakeep (${count} bookmarks)`);
    }
    this.announced = true;
    this.failure = null;
  }

  // --- Scene events ---------------------------------------------------------

  /**
   * Fire the bookmarks added and the favourites starred since the last read.
   * The first read of a Karakeep user is a silent baseline: installing the
   * integration announces nothing already there.
   * @param {object[]} latest the newest bookmarks, summarized
   * @param {object[] | null} favourites every favourite, or null when unchanged
   * @param {number} favouriteCount
   */
  async #announce(latest, favourites, favouriteCount) {
    const userId = this.user.id;
    const known = this.seen?.userId === userId ? this.seen : null;
    const events = [];
    if (known) {
      const seenIds = new Set(known.bookmarks);
      // A bookmark deleted lets an older one slide into the newest 20: the
      // date keeps it from being announced as new.
      const added = latest
        .filter(
          (b) =>
            !seenIds.has(b.id) &&
            b.created >= known.since &&
            !this.own.has(b.id) &&
            b.source !== 'import',
        )
        .reverse();
      events.push(...added.map((b) => ({ trigger: TRIGGERS.added, bookmark: b })));
      if (favourites) {
        const starred = new Set(known.favourites);
        events.push(
          ...favourites
            .filter((b) => !starred.has(b.id) && !this.ownFavourites.has(b.id))
            .reverse()
            .map((b) => ({ trigger: TRIGGERS.favourited, bookmark: b })),
        );
      }
    }
    if (events.length > MAX_EVENTS_PER_READ) {
      logger.info(
        `${events.length} new bookmarks or favourites at once: ${MAX_EVENTS_PER_READ} announced`,
      );
    }
    // An event Gladys did not take (disconnected, restarting) is not
    // recorded: the next read fires it again.
    const failed = { [TRIGGERS.added]: new Set(), [TRIGGERS.favourited]: new Set() };
    for (const { trigger, bookmark } of events.slice(0, MAX_EVENTS_PER_READ)) {
      logger.debug(`${trigger}: ${bookmark.id}`);
      try {
        await this.gladys.publishSceneEvent(trigger, this.#eventData(bookmark));
      } catch (err) {
        failed[trigger].add(bookmark.id);
        logger.warn(`Cannot fire ${trigger}: ${err.message}`);
      }
    }
    // The date from which a bookmark counts as new: the newest one seen, or
    // the oldest one Gladys refused, so that it is fired again.
    const dates = (list) =>
      list
        .map((b) => b.created)
        .filter(Boolean)
        .sort();
    const refused = dates(latest.filter((b) => failed[TRIGGERS.added].has(b.id)));
    const newest = [known?.since ?? '', ...dates(latest)].sort().at(-1);
    const next = {
      userId,
      since: refused.length > 0 ? refused[0] : newest,
      bookmarks: latest.map((b) => b.id).filter((id) => !failed[TRIGGERS.added].has(id)),
      favourites: favourites
        ? favourites.map((b) => b.id).filter((id) => !failed[TRIGGERS.favourited].has(id))
        : known.favourites,
      favouriteCount:
        favourites && failed[TRIGGERS.favourited].size === 0
          ? favouriteCount
          : favourites
            ? -1
            : known.favouriteCount,
    };
    if (JSON.stringify(next) !== JSON.stringify(this.seen)) {
      this.seen = next;
      await this.store.save(next);
    }
  }

  #eventData(bookmark) {
    return {
      title: bookmark.title.slice(0, 1000),
      url: bookmark.url.slice(0, 1000),
      text: bookmark.text.slice(0, 1000),
      type: bookmark.type,
      type_name: pick(TYPES, this.language)[bookmark.type],
      tags: bookmark.tags.join(', ').slice(0, 1000),
    };
  }

  // --- Device and states ----------------------------------------------------

  #isCreated(externalId) {
    return (this.gladys.devices ?? []).some((device) => device.external_id === externalId);
  }

  buildDevices() {
    if (!this.user || !this.counters) {
      return [];
    }
    return [buildKarakeepDevice(this.gladys, this.user, this.language, this.config.url ?? '')];
  }

  async publishDevices() {
    if (this.stopped) {
      return;
    }
    try {
      await this.gladys.publishDiscoveredDevices(this.buildDevices());
    } catch (err) {
      logger.error('Cannot publish the devices', err);
    }
  }

  /**
   * The states of the device, once the user added it (Gladys drops the others).
   * @param {boolean} [force] the device was just added
   */
  async publishStates(force = false) {
    if (!this.user || !this.counters || this.stopped) {
      return;
    }
    const deviceId = karakeepIds(this.gladys, this.user.id).device;
    if (!force && !this.#isCreated(deviceId)) {
      return;
    }
    const states = buildKarakeepStates(
      this.gladys,
      this.user.id,
      this.counters,
      this.latest[0],
      this.language,
    );
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeat });
    } catch (err) {
      if (this.publishFailing) {
        logger.debug(`Cannot publish the states: ${err.message}`);
      } else {
        logger.warn(`Cannot publish the states: ${err.message}`);
      }
      this.publishFailing = true;
      return;
    }
    if (this.publishFailing) {
      logger.info('States published again');
    }
    this.publishFailing = false;
  }

  /** The user added the device: states sent before were dropped by Gladys. */
  async onDeviceCreated(device) {
    const userId = parseUserId(this.gladys, device?.external_id);
    if (!userId || userId !== this.user?.id) {
      return;
    }
    this.gladys.forgetPublishedStates?.(device.external_id);
    await this.publishStates(true);
    this.refreshWidget();
  }

  /** onPoll (the device is not polled: the container reads on its timer). */
  async poll(device) {
    const userId = parseUserId(this.gladys, device?.external_id);
    if (userId && userId === this.user?.id) {
      await this.publishStates(true);
    }
  }

  // --- Widget ---------------------------------------------------------------

  /** Nudge the open dashboards, with a trailing call inside the core's 10 s gap. */
  refreshWidget() {
    if (this.stopped) {
      return;
    }
    const wait = this.widgetRefreshAt + this.timings.widgetGap - this.now();
    if (wait <= 0) {
      this.widgetRefreshAt = this.now();
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
      return;
    }
    if (!this.widgetTimer) {
      this.widgetTimer = setTimeout(() => {
        this.widgetTimer = null;
        this.refreshWidget();
      }, wait);
      this.widgetTimer.unref?.();
    }
  }

  /**
   * The bookmarks a widget shows: the newest (from the last read), the
   * newest favourites or the newest not archived (read on demand, reused a
   * minute). Null when Karakeep cannot be read.
   * @param {'all' | 'favourites' | 'unarchived'} filter
   */
  async widgetBookmarks(filter, count) {
    if (!this.loaded || this.failure !== null) {
      return null;
    }
    if (filter !== 'favourites' && filter !== 'unarchived') {
      return this.latest.slice(0, count);
    }
    const cached = this.widgetLists.get(filter);
    if (cached && this.now() - cached.at < this.timings.widgetCache) {
      return cached.bookmarks;
    }
    const client = this.client;
    try {
      const page = await client.bookmarks(
        filter === 'favourites'
          ? { limit: count, favourited: true }
          : { limit: count, archived: false },
      );
      const bookmarks = page.bookmarks.map(summarizeBookmark);
      if (client === this.client) {
        this.widgetLists.set(filter, { at: this.now(), bookmarks });
      }
      return bookmarks;
    } catch (err) {
      logger.debug(`Widget list not read: ${err.message}`);
      return null;
    }
  }

  // --- Connection status ----------------------------------------------------

  statusKey() {
    if (this.config.urlInvalid) {
      return 'invalid';
    }
    if (!this.config.url) {
      return 'none';
    }
    if (!this.config.apiKey) {
      return 'api_key';
    }
    if (this.failure) {
      return (
        { unauthorized: 'unauthorized', invalid: 'invalid_answer', not_found: 'invalid_answer' }[
          this.failure
        ] ?? 'unreachable'
      );
    }
    return null;
  }

  statusMessage() {
    const key = this.statusKey();
    if (!key) {
      return null;
    }
    return Object.fromEntries(
      Object.entries(STATUS_TEXT).map(([language, table]) => [language, table[key]]),
    );
  }

  async updateConnectionStatus() {
    if (this.stopped) {
      return;
    }
    // Nothing to say before the first answer or failure.
    if (this.client && !this.loaded && this.failure === null) {
      return;
    }
    const message = this.statusMessage();
    const connected = Boolean(this.client) && this.loaded && this.failure === null;
    const fingerprint = JSON.stringify({ connected, message });
    if (fingerprint === this.lastStatus) {
      return;
    }
    this.lastStatus = fingerprint;
    try {
      await this.gladys.setConnectionStatus(connected, message ?? undefined);
    } catch (err) {
      logger.warn(`Cannot set the connection status: ${err.message}`);
    }
  }

  // --- Actions --------------------------------------------------------------

  /** "Test the connection": a fresh read, then its outcome. */
  async testReport() {
    if (!this.client) {
      return this.statusMessage();
    }
    await this.refresh();
    const message = this.statusMessage();
    if (message) {
      return message;
    }
    return Object.fromEntries(
      Object.entries(TEST_TEXT).map(([language, render]) => [
        language,
        render(this.user.name, this.counters.bookmarks, this.counters.lists),
      ]),
    );
  }

  /**
   * Save a link or a note, then put it in a list and tag it. Used by the
   * scene actions and the widget form.
   * @param {object} request
   * @param {'link' | 'text'} request.type
   * @param {string} request.content the link or the text of the note
   * @param {string} [request.title]
   * @param {string} [request.list] a list name
   * @param {string} [request.tags] comma-separated tag names
   * @param {boolean} [request.favourite]
   */
  async save({ type, content, title, list, tags, favourite }) {
    const language = this.language;
    let body;
    if (type === 'link') {
      const url = asLink(content);
      if (!url) {
        throw new CommandError('url', language);
      }
      body = { type: 'link', url };
    } else {
      const text = typeof content === 'string' ? content.trim() : '';
      if (text === '') {
        throw new CommandError('text', language);
      }
      body = { type: 'text', text };
    }
    const client = this.client;
    if (!client) {
      throw new CommandError('unreachable', language);
    }
    const listName = typeof list === 'string' ? list.trim() : '';
    const tagNames = parseTags(tags);
    const favoured = favourite === true || favourite === 'true';
    let target;
    try {
      if (listName) {
        target = findList(await client.lists(), listName);
        if (!target) {
          throw new CommandError('list', language, { name: listName });
        }
        if (target.type === 'smart') {
          throw new CommandError('smart_list', language, { name: target.name });
        }
      }
    } catch (err) {
      throw this.#saveError(err);
    }
    let created;
    try {
      created = await client.createBookmark(body, {
        title: typeof title === 'string' ? title.trim().slice(0, 1000) : '',
        favourited: favoured,
      });
    } catch (err) {
      throw this.#saveError(err);
    }
    const { bookmark, existed } = created;
    this.#remember(this.own, bookmark.id);
    if (favoured) {
      this.#remember(this.ownFavourites, bookmark.id);
    }
    try {
      if (existed && favoured && bookmark.favourited !== true) {
        await client.favourite(bookmark.id);
      }
      if (tagNames.length > 0) {
        await client.attachTags(bookmark.id, tagNames);
      }
      if (target) {
        await client.addToList(target.id, bookmark.id);
      }
    } catch (err) {
      throw new CommandError('after', language, { detail: err.message });
    }
    const summary = summarizeBookmark(bookmark);
    logger.info(
      `${type === 'link' ? 'Link' : 'Note'} ${existed ? 'already saved' : 'saved'}` +
        `${target ? ' in a list' : ''}${tagNames.length ? `, ${tagNames.length} tag(s)` : ''}`,
    );
    // The counters and the widget follow without waiting for the timer.
    this.refresh().catch(() => {});
    return { id: bookmark.id, title: summary.title, existed };
  }

  #remember(set, id) {
    set.add(id);
    if (set.size > MAX_OWN) {
      set.delete(set.values().next().value);
    }
  }

  #saveError(err) {
    if (err instanceof CommandError) {
      return err;
    }
    const kind = err instanceof KarakeepError ? err.kind : 'unreachable';
    if (kind === 'unauthorized') {
      return new CommandError('unauthorized', this.language);
    }
    if (kind === 'rejected') {
      return new CommandError('rejected', this.language, {
        detail: err.message.replace(/^[^:]*: /, ''),
      });
    }
    return new CommandError('unreachable', this.language);
  }
}
