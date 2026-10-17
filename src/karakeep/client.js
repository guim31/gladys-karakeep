// -----------------------------------------------------------------------------
// The REST API of Karakeep (`<base>/api/v1/...`), the few calls the
// integration needs, authenticated by an API key (`Authorization: Bearer`).
//
// Facts checked on a real server, Karakeep 0.33.2
// (ghcr.io/karakeep-app/karakeep), see test/fixtures/karakeep/:
// - errors are often plain text, not JSON: 401 "Unauthorized", 404 "List not
//   found", 400 "Smart lists cannot be added to"; a bad bookmark body is a 400
//   with a JSON `{ success: false, error: { name: "ZodError", message } }`;
// - `POST /bookmarks` answers 201 for a new bookmark, and 200 with the
//   EXISTING bookmark when the link was already saved;
// - adding a bookmark to a list is `PUT /lists/{id}/bookmarks/{bookmarkId}`
//   (204, also when it is already there);
// - `POST /bookmarks/{id}/tags` with `{ tags: [{ tagName }] }` creates the
//   missing tags;
// - `GET /bookmarks` is sorted by creation date, newest first, paged by
//   `cursor` / `nextCursor`; `includeContent=false` still carries the URL.
// -----------------------------------------------------------------------------

export const DEFAULT_TIMEOUT = 15_000;

export class KarakeepError extends Error {
  /**
   * @param {'unreachable' | 'unauthorized' | 'not_found' | 'timeout' | 'http' | 'invalid' | 'rejected'} kind
   * @param {string} message never carries a credential
   * @param {number} [status]
   */
  constructor(kind, message, status) {
    super(message);
    this.name = 'KarakeepError';
    this.kind = kind;
    this.status = status;
  }
}

export class KarakeepClient {
  /**
   * @param {object} options
   * @param {string} options.url normalized base URL (see normalizeUrl)
   * @param {string} options.apiKey
   * @param {typeof fetch} [options.fetch]
   * @param {number} [options.timeout]
   */
  constructor({ url, apiKey, fetch: fetchImpl, timeout }) {
    this.url = url;
    this.apiKey = apiKey;
    this.fetch = fetchImpl ?? globalThis.fetch;
    this.timeout = timeout ?? DEFAULT_TIMEOUT;
  }

  get apiUrl() {
    return `${this.url}/api/v1`;
  }

  async #send(method, path, body) {
    const headers = { Accept: 'application/json', Authorization: `Bearer ${this.apiKey}` };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await this.fetch(`${this.apiUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeout),
        redirect: 'follow',
      });
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new KarakeepError('timeout', `No answer from Karakeep within ${this.timeout} ms`);
      }
      const cause = err?.cause?.code ?? err?.cause?.message ?? err?.message ?? 'error';
      throw new KarakeepError('unreachable', `Karakeep unreachable (${cause})`);
    }
    let raw;
    try {
      raw = await response.text();
    } catch (err) {
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new KarakeepError('timeout', `No answer from Karakeep within ${this.timeout} ms`);
      }
      throw new KarakeepError('unreachable', `Karakeep unreachable (${err?.message ?? 'error'})`);
    }
    if (!response.ok) {
      throw KarakeepClient.#fail(path, response.status, raw);
    }
    if (raw === '') {
      return { status: response.status, data: null };
    }
    try {
      return { status: response.status, data: JSON.parse(raw) };
    } catch {
      // A proxy login page answering 200 in HTML, for instance.
      throw new KarakeepError('invalid', `${path}: the answer is not JSON (is this Karakeep?)`);
    }
  }

  static #fail(path, status, raw) {
    let detail = raw.trim() || `HTTP ${status}`;
    try {
      const data = JSON.parse(raw);
      if (typeof data === 'string') {
        detail = data;
      } else if (typeof data?.error?.message === 'string') {
        detail = data.error.message;
      } else if (typeof data?.message === 'string') {
        detail = data.message;
      }
    } catch {
      // plain text (Karakeep answers most errors so)
    }
    if (/^\s*</.test(detail)) {
      detail = `HTTP ${status}`;
    }
    // Zod messages are pretty-printed JSON: keep their "message" lines.
    const zod = [...detail.matchAll(/"message":\s*"([^"]+)"/g)].map((m) => m[1]);
    if (zod.length > 0) {
      detail = zod.join(', ');
    }
    const kind =
      status === 401 || status === 403
        ? 'unauthorized'
        : status === 404
          ? 'not_found'
          : status === 400
            ? 'rejected'
            : 'http';
    const path0 = path.split('?')[0];
    return new KarakeepError(
      kind,
      `${path0}: ${detail.replace(/\s+/g, ' ').slice(0, 120)}`,
      status,
    );
  }

  /** `{ id, name, email, localUser }`: the owner of the API key. */
  async me() {
    const { data } = await this.#send('GET', '/users/me');
    if (!data || typeof data.id !== 'string') {
      throw new KarakeepError('invalid', 'This address does not answer like Karakeep');
    }
    return data;
  }

  /** `{ numBookmarks, numFavorites, numArchived, numTags, numLists, numHighlights, ... }` */
  async stats() {
    const { data } = await this.#send('GET', '/users/me/stats');
    if (!data || typeof data.numBookmarks !== 'number') {
      throw new KarakeepError('invalid', 'Karakeep did not answer its statistics');
    }
    return data;
  }

  /**
   * One page of bookmarks, the newest first.
   * @param {{ limit?: number, favourited?: boolean, archived?: boolean, cursor?: string }} [query]
   * @returns {Promise<{ bookmarks: object[], nextCursor: string | null }>}
   */
  async bookmarks({ limit = 20, favourited, archived, cursor } = {}) {
    const params = new URLSearchParams({
      limit: String(limit),
      sortOrder: 'desc',
      includeContent: 'false',
    });
    if (favourited !== undefined) {
      params.set('favourited', String(favourited));
    }
    if (archived !== undefined) {
      params.set('archived', String(archived));
    }
    if (cursor) {
      params.set('cursor', cursor);
    }
    const { data } = await this.#send('GET', `/bookmarks?${params}`);
    if (!data || !Array.isArray(data.bookmarks)) {
      throw new KarakeepError('invalid', 'Karakeep did not answer its bookmarks');
    }
    return { bookmarks: data.bookmarks, nextCursor: data.nextCursor ?? null };
  }

  /** Every favourite bookmark, `max` at most (the list is sorted by creation date). */
  async favourites(max = 1000) {
    const found = [];
    let cursor;
    do {
      const page = await this.bookmarks({ limit: 100, favourited: true, cursor });
      found.push(...page.bookmarks);
      cursor = page.nextCursor;
    } while (cursor && found.length < max);
    return found.slice(0, max);
  }

  /**
   * Save a bookmark. `existed` is true when the link was already saved
   * (Karakeep then answers the existing bookmark, in 200).
   * @param {{ type: 'link', url: string } | { type: 'text', text: string }} content
   * @param {{ title?: string, favourited?: boolean }} [extra]
   */
  async createBookmark(content, { title, favourited } = {}) {
    const body = { ...content, source: 'api' };
    if (title) {
      body.title = title;
    }
    if (favourited) {
      body.favourited = true;
    }
    const { status, data } = await this.#send('POST', '/bookmarks', body);
    if (!data || typeof data.id !== 'string') {
      throw new KarakeepError('invalid', 'Karakeep did not answer the saved bookmark');
    }
    return { bookmark: data, existed: status === 200 };
  }

  /** Change a bookmark (`{ title, favourited, ... }`); resolves the bookmark. */
  async update(bookmarkId, changes) {
    const { data } = await this.#send(
      'PATCH',
      `/bookmarks/${encodeURIComponent(bookmarkId)}`,
      changes,
    );
    return data && typeof data === 'object' ? data : {};
  }

  /** Attach tags by name (Karakeep creates the missing ones). */
  async attachTags(bookmarkId, names) {
    await this.#send('POST', `/bookmarks/${encodeURIComponent(bookmarkId)}/tags`, {
      tags: names.map((tagName) => ({ tagName })),
    });
  }

  /** `[{ id, name, type: 'manual' | 'smart', ... }]` */
  async lists() {
    const { data } = await this.#send('GET', '/lists');
    if (!data || !Array.isArray(data.lists)) {
      throw new KarakeepError('invalid', 'Karakeep did not answer its lists');
    }
    return data.lists;
  }

  async addToList(listId, bookmarkId) {
    await this.#send(
      'PUT',
      `/lists/${encodeURIComponent(listId)}/bookmarks/${encodeURIComponent(bookmarkId)}`,
    );
  }
}
