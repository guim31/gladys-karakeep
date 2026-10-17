// -----------------------------------------------------------------------------
// The "Karakeep" dashboard widget: three tiles (bookmarks, not archived,
// favourites), the newest bookmarks — all, favourites or not archived, as set
// in the widget — and a "Save" button opening a form (a link or a note,
// Gladys 5.2.0 or later).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { CommandError, WIDGET_KEY } from './hub.js';
import { asLink } from './karakeep/model.js';
import { SAVED_TEXT, TYPES, commandMessage, pick } from './texts.js';

export const MAX_ITEMS = 6;
export const FILTERS = ['all', 'favourites', 'unarchived'];
export const SAVE_ACTION = 'save';

export const TEXT = {
  bookmarks: { en: 'Bookmarks', fr: 'Marque-pages', de: 'Lesezeichen', es: 'Marcadores' },
  unarchived: {
    en: 'Not archived',
    fr: 'Non archivés',
    de: 'Nicht archiviert',
    es: 'No archivados',
  },
  favourites: { en: 'Favourites', fr: 'Favoris', de: 'Favoriten', es: 'Favoritos' },
  favourite: { en: 'Favourite', fr: 'Favori', de: 'Favorit', es: 'Favorito' },
  save: { en: 'Save', fr: 'Enregistrer', de: 'Speichern', es: 'Guardar' },
  content: {
    en: 'Link or note',
    fr: 'Lien ou note',
    de: 'Link oder Notiz',
    es: 'Enlace o nota',
  },
  open: { en: 'Open the link', fr: 'Ouvrir le lien', de: 'Link öffnen', es: 'Abrir el enlace' },
  open_karakeep: {
    en: 'Open in Karakeep',
    fr: 'Ouvrir dans Karakeep',
    de: 'In Karakeep öffnen',
    es: 'Abrir en Karakeep',
  },
  empty: {
    en: 'No bookmark to show yet.',
    fr: 'Aucun marque-page à afficher pour le moment.',
    de: 'Noch kein Lesezeichen anzuzeigen.',
    es: 'Todavía no hay ningún marcador que mostrar.',
  },
  unavailable: {
    en: 'Karakeep does not answer right now.',
    fr: 'Karakeep ne répond pas pour le moment.',
    de: 'Karakeep antwortet gerade nicht.',
    es: 'Karakeep no responde en este momento.',
  },
  waiting: {
    en: 'Waiting for Karakeep: check the configuration of the integration.',
    fr: "En attente de Karakeep : vérifiez la configuration de l'intégration.",
    de: 'Warte auf Karakeep: Prüfe die Konfiguration der Integration.',
    es: 'Esperando a Karakeep: compruebe la configuración de la integración.',
  },
};

const cut = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);
const https = (url) => typeof url === 'string' && /^https:\/\//i.test(url);

function shortDate(iso, language) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString(
    { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' }[language] ?? 'en-GB',
    {
      day: 'numeric',
      month: 'short',
    },
  );
}

/** One row of the list. */
export function bookmarkItem(bookmark, language, baseUrl) {
  const where =
    bookmark.type === 'link'
      ? (() => {
          try {
            return new URL(bookmark.url).hostname.replace(/^www\./, '');
          } catch {
            return pick(TYPES, language).link;
          }
        })()
      : pick(TYPES, language)[bookmark.type];
  const date = shortDate(bookmark.created, language);
  const item = {
    title: cut(bookmark.title || where || '…', 60),
    subtitle: cut(date ? `${where} · ${date}` : where, 60),
  };
  if (bookmark.favourited) {
    item.badge = { text: pick(TEXT.favourite, language), color: WIDGET_COLORS.WARNING };
  }
  const description = bookmark.type === 'text' ? bookmark.text : bookmark.description;
  if (description) {
    item.description = cut(description, 2000);
  }
  const links = [];
  if (https(bookmark.url)) {
    links.push({ url: bookmark.url.slice(0, 2000), label: pick(TEXT.open, language) });
  }
  // The links of a card must be https: a Karakeep on plain http is left out.
  if (https(baseUrl) && bookmark.id) {
    links.push({
      url: `${baseUrl}/dashboard/preview/${encodeURIComponent(bookmark.id)}`,
      label: pick(TEXT.open_karakeep, language),
    });
  }
  if (links.length > 0) {
    item.links = links;
  }
  return item;
}

// The core wants the labels of form fields as multi-language objects.
function saveButton(language) {
  return {
    type: 'button',
    label: pick(TEXT.save, language),
    icon: 'plus',
    style: 'secondary',
    action: {
      key: SAVE_ACTION,
      fields: [
        { key: 'content', type: 'string', required: true, label: TEXT.content },
        {
          key: 'favourite',
          type: 'boolean',
          required: false,
          default: false,
          label: TEXT.favourite,
        },
      ],
    },
  };
}

export async function buildContent(hub, { language = 'en', settings = {} } = {}) {
  if (!hub.loaded) {
    return {
      ttl_seconds: 60,
      components: [{ type: 'text', variant: 'body', text: pick(TEXT.waiting, language) }],
    };
  }
  const filter = FILTERS.includes(settings?.filter) ? settings.filter : 'all';
  const counters = hub.counters;
  const bookmarks = await hub.widgetBookmarks(filter, MAX_ITEMS);
  const components = [
    {
      type: 'value',
      label: pick(TEXT.bookmarks, language),
      value: counters.bookmarks,
      icon: 'bookmark',
    },
    {
      type: 'value',
      label: pick(TEXT.unarchived, language),
      value: counters.unarchived,
      icon: 'inbox',
    },
    {
      type: 'value',
      label: pick(TEXT.favourites, language),
      value: counters.favourites,
      icon: 'star',
    },
  ];
  if (bookmarks === null) {
    components.push({ type: 'text', variant: 'caption', text: pick(TEXT.unavailable, language) });
  } else if (bookmarks.length === 0) {
    components.push({ type: 'text', variant: 'caption', text: pick(TEXT.empty, language) });
  } else {
    components.push({
      type: 'card-list',
      display: 'list',
      items: bookmarks.map((b) => bookmarkItem(b, language, hub.config.url ?? '')),
    });
  }
  components.push(saveButton(language));
  // The hub nudges the widget after every read and every save.
  return { ttl_seconds: 300, components };
}

async function action(hub, { actionKey, values }) {
  const language = hub.language;
  if (actionKey !== SAVE_ACTION) {
    throw new Error(`Unknown action ${actionKey}`);
  }
  if (!values || typeof values.content !== 'string') {
    // A Gladys older than 5.2.0 relays the tap without the form.
    throw new Error(pick(commandMessage('form'), language));
  }
  const content = values.content.trim();
  if (content === '') {
    throw new Error(pick(commandMessage('content'), language));
  }
  const type = asLink(content) ? 'link' : 'text';
  try {
    const saved = await hub.save({ type, content, favourite: values.favourite === true });
    const key = saved.existed ? 'existed' : type;
    return {
      message: Object.fromEntries(
        Object.entries(SAVED_TEXT).map(([lang, table]) => [lang, table[key]]),
      ),
    };
  } catch (err) {
    if (err instanceof CommandError) {
      throw new Error(pick(err.messages, language), { cause: err });
    }
    throw err;
  }
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    get: (hub, request) => buildContent(hub, request),
    action,
  },
};
