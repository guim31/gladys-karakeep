// -----------------------------------------------------------------------------
// Karakeep answers -> plain values: bookmark summaries, counters, tags typed by
// the user, list lookup. No I/O here.
// -----------------------------------------------------------------------------

const clean = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');

/** `https://www.example.org/a` -> `example.org`; '' when not a URL. */
export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * The few fields Gladys shows of a bookmark. The title falls back on the
 * crawled title, the domain, the first words of a note or the file name.
 * @param {object} bookmark a Karakeep bookmark
 */
export function summarizeBookmark(bookmark) {
  const content = bookmark?.content ?? {};
  const type = ['link', 'text', 'asset'].includes(content.type) ? content.type : 'link';
  const url = type === 'link' && typeof content.url === 'string' ? content.url : '';
  const text = type === 'text' ? clean(content.text) : '';
  const title =
    clean(bookmark?.title) ||
    clean(content.title) ||
    (type === 'link' ? domainOf(url) || url : '') ||
    text.slice(0, 80) ||
    clean(content.fileName);
  const tags = Array.isArray(bookmark?.tags)
    ? bookmark.tags.map((tag) => clean(tag?.name)).filter(Boolean)
    : [];
  return {
    id: String(bookmark?.id ?? ''),
    type,
    title,
    url,
    text,
    description: clean(content.description),
    favourited: bookmark?.favourited === true,
    archived: bookmark?.archived === true,
    tags,
    source: typeof bookmark?.source === 'string' ? bookmark.source : '',
    // A link saved again keeps its first date there.
    created: String(bookmark?.firstCreatedAt ?? bookmark?.createdAt ?? ''),
  };
}

/** The counters of the device, from `/users/me/stats`. */
export function summarizeStats(stats) {
  const count = (value) => (Number.isFinite(value) && value > 0 ? Math.round(value) : 0);
  const bookmarks = count(stats?.numBookmarks);
  const archived = count(stats?.numArchived);
  return {
    bookmarks,
    unarchived: Math.max(0, bookmarks - archived),
    favourites: count(stats?.numFavorites),
    archived,
    lists: count(stats?.numLists),
    tags: count(stats?.numTags),
    highlights: count(stats?.numHighlights),
  };
}

export const MAX_TAGS = 20;

/** `"courses, #maison; courses"` -> `['courses', 'maison']` */
export function parseTags(raw) {
  if (typeof raw !== 'string') {
    return [];
  }
  const seen = new Set();
  const tags = [];
  for (const part of raw.split(/[,;\n]/)) {
    const tag = clean(part).replace(/^#+/, '').slice(0, 100).trim();
    const key = tag.toLocaleLowerCase();
    if (tag !== '' && !seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
  }
  return tags.slice(0, MAX_TAGS);
}

const fold = (value) => clean(value).normalize('NFC').toLocaleLowerCase();

/** The list of that name (case-insensitive), or undefined. */
export function findList(lists, name) {
  const wanted = fold(name);
  return lists.find((list) => fold(list?.name) === wanted);
}

/**
 * A link typed in a form or a scene: `https://...`, `http://...`, or
 * `www.example.org/...` (https assumed). Null when it is not one.
 */
export function asLink(raw) {
  const text = clean(raw);
  if (/\s/.test(text) || text === '') {
    return null;
  }
  const candidate = /^www\./i.test(text) ? `https://${text}` : text;
  try {
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname ? candidate : null;
  } catch {
    return null;
  }
}
