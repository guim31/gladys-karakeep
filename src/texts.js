// -----------------------------------------------------------------------------
// Every text the container produces, in the four languages of the Gladys
// interface, with the words of the Karakeep interface (fr "marque-page",
// de "Lesezeichen", es "marcador"). German says "du", Spanish "usted"
// (test/i18n.test.js).
// -----------------------------------------------------------------------------

// Feature names (frozen by Gladys at creation).
export const NAMES = {
  en: {
    bookmarks: 'Bookmarks',
    unarchived: 'Not archived',
    favourites: 'Favourites',
    archived: 'Archived',
    lists: 'Lists',
    tags: 'Tags',
    highlights: 'Highlights',
    latest: 'Latest bookmark',
  },
  fr: {
    bookmarks: 'Marque-pages',
    unarchived: 'Non archivés',
    favourites: 'Favoris',
    archived: 'Archivés',
    lists: 'Listes',
    tags: 'Tags',
    highlights: 'Surlignages',
    latest: 'Dernier marque-page',
  },
  de: {
    bookmarks: 'Lesezeichen',
    unarchived: 'Nicht archiviert',
    favourites: 'Favoriten',
    archived: 'Archiviert',
    lists: 'Listen',
    tags: 'Tags',
    highlights: 'Textmarkierungen',
    latest: 'Neuestes Lesezeichen',
  },
  es: {
    bookmarks: 'Marcadores',
    unarchived: 'No archivados',
    favourites: 'Favoritos',
    archived: 'Archivados',
    lists: 'Listas',
    tags: 'Etiquetas',
    highlights: 'Destacados',
    latest: 'Último marcador',
  },
};

/** The "Latest bookmark" text of an empty Karakeep. */
export const NONE = { en: 'None', fr: 'Aucun', de: 'Keines', es: 'Ninguno' };

/** The type of a bookmark, for the trigger variable and the widget. */
export const TYPES = {
  en: { link: 'Link', text: 'Note', asset: 'File' },
  fr: { link: 'Lien', text: 'Note', asset: 'Fichier' },
  de: { link: 'Link', text: 'Notiz', asset: 'Datei' },
  es: { link: 'Enlace', text: 'Nota', asset: 'Archivo' },
};

export const STATUS_TEXT = {
  en: {
    none: 'Enter the address of Karakeep and an API key in the configuration.',
    invalid: 'The Karakeep address is not valid: enter an address like 192.168.1.50:3000.',
    api_key: 'Enter an API key (Karakeep → Settings → API keys).',
    unauthorized: 'Karakeep refused the API key: create a new one in Settings → API keys.',
    unreachable: 'Karakeep does not answer: check its address and that it is running.',
    invalid_answer: 'This address does not answer like Karakeep: check the address and the port.',
  },
  fr: {
    none: "Saisissez l'adresse de Karakeep et une clé d'API dans la configuration.",
    invalid:
      "L'adresse de Karakeep n'est pas valide : saisissez une adresse comme 192.168.1.50:3000.",
    api_key: "Saisissez une clé d'API (Karakeep → Paramètres → Clés API).",
    unauthorized:
      "Karakeep a refusé la clé d'API : créez-en une nouvelle dans Paramètres → Clés API.",
    unreachable: "Karakeep ne répond pas : vérifiez son adresse et qu'il est démarré.",
    invalid_answer: "Cette adresse ne répond pas comme Karakeep : vérifiez l'adresse et le port.",
  },
  de: {
    none: 'Gib in der Konfiguration die Adresse von Karakeep und einen API-Schlüssel ein.',
    invalid: 'Die Karakeep-Adresse ist ungültig: Gib eine Adresse wie 192.168.1.50:3000 ein.',
    api_key: 'Gib einen API-Schlüssel ein (Karakeep → Einstellungen → API-Schlüssel).',
    unauthorized:
      'Karakeep hat den API-Schlüssel abgelehnt: Erstelle einen neuen unter Einstellungen → API-Schlüssel.',
    unreachable: 'Karakeep antwortet nicht: Prüfe die Adresse und ob es läuft.',
    invalid_answer: 'Diese Adresse antwortet nicht wie Karakeep: Prüfe Adresse und Port.',
  },
  es: {
    none: 'Introduzca la dirección de Karakeep y una clave de API en la configuración.',
    invalid:
      'La dirección de Karakeep no es válida: introduzca una dirección como 192.168.1.50:3000.',
    api_key: 'Introduzca una clave de API (Karakeep → Ajustes → Claves API).',
    unauthorized: 'Karakeep rechazó la clave de API: cree una nueva en Ajustes → Claves API.',
    unreachable: 'Karakeep no responde: compruebe su dirección y que esté en marcha.',
    invalid_answer: 'Esta dirección no responde como Karakeep: compruebe la dirección y el puerto.',
  },
};

/** "Test the connection" once Karakeep answered. */
export const TEST_TEXT = {
  en: (user, bookmarks, lists) =>
    `Connected to Karakeep as ${user}: ${bookmarks} bookmark(s), ${lists} list(s).`,
  fr: (user, bookmarks, lists) =>
    `Connecté à Karakeep en tant que ${user} : ${bookmarks} marque-page(s), ${lists} liste(s).`,
  de: (user, bookmarks, lists) =>
    `Mit Karakeep verbunden als ${user}: ${bookmarks} Lesezeichen, ${lists} Liste(n).`,
  es: (user, bookmarks, lists) =>
    `Conectado a Karakeep como ${user}: ${bookmarks} marcador(es), ${lists} lista(s).`,
};

export const INIT_FAILED = {
  en: 'The integration could not start: see its logs.',
  fr: "L'intégration n'a pas pu démarrer : consultez ses journaux.",
  de: 'Die Integration konnte nicht starten: Sieh dir ihre Logs an.',
  es: 'La integración no pudo iniciarse: consulte sus registros.',
};

// Errors of the scene actions and of the widget form. `{name}` is the list
// name, `{detail}` the reason Karakeep gave.
export const COMMAND_ERRORS = {
  en: {
    timeout: 'Karakeep answered too late: the bookmark may have been saved anyway.',
    http: 'Karakeep could not save the bookmark: {detail}',
    url: 'Enter a link starting with http:// or https://.',
    text: 'Enter the text of the note.',
    content: 'Enter a link or the text of a note.',
    unreachable: 'Karakeep does not answer: the bookmark was not saved.',
    unauthorized: 'Karakeep refused the API key: the bookmark was not saved.',
    list: 'No list "{name}" in Karakeep.',
    smart_list: '"{name}" is a smart list: Karakeep fills it by itself.',
    rejected: 'Karakeep refused the bookmark: {detail}',
    after: 'Bookmark saved, but {detail}',
    form: 'Update Gladys to 5.2 or later to use this form.',
  },
  fr: {
    timeout: 'Karakeep a répondu trop tard : le marque-page a peut-être été enregistré quand même.',
    http: "Karakeep n'a pas pu enregistrer le marque-page : {detail}",
    url: 'Saisissez un lien commençant par http:// ou https://.',
    text: 'Saisissez le texte de la note.',
    content: "Saisissez un lien ou le texte d'une note.",
    unreachable: "Karakeep ne répond pas : le marque-page n'a pas été enregistré.",
    unauthorized: "Karakeep a refusé la clé d'API : le marque-page n'a pas été enregistré.",
    list: 'Aucune liste « {name} » dans Karakeep.',
    smart_list: '« {name} » est une liste intelligente : Karakeep la remplit lui-même.',
    rejected: 'Karakeep a refusé le marque-page : {detail}',
    after: 'Marque-page enregistré, mais {detail}',
    form: 'Mettez Gladys à jour (5.2 ou plus) pour utiliser ce formulaire.',
  },
  de: {
    timeout:
      'Karakeep hat zu spät geantwortet: Das Lesezeichen wurde vielleicht trotzdem gespeichert.',
    http: 'Karakeep konnte das Lesezeichen nicht speichern: {detail}',
    url: 'Gib einen Link ein, der mit http:// oder https:// beginnt.',
    text: 'Gib den Text der Notiz ein.',
    content: 'Gib einen Link oder den Text einer Notiz ein.',
    unreachable: 'Karakeep antwortet nicht: Das Lesezeichen wurde nicht gespeichert.',
    unauthorized:
      'Karakeep hat den API-Schlüssel abgelehnt: Das Lesezeichen wurde nicht gespeichert.',
    list: 'Keine Liste „{name}“ in Karakeep.',
    smart_list: '„{name}“ ist eine intelligente Liste: Karakeep füllt sie selbst.',
    rejected: 'Karakeep hat das Lesezeichen abgelehnt: {detail}',
    after: 'Lesezeichen gespeichert, aber {detail}',
    form: 'Aktualisiere Gladys auf 5.2 oder neuer, um dieses Formular zu nutzen.',
  },
  es: {
    timeout:
      'Karakeep respondió demasiado tarde: puede que el marcador se haya guardado de todos modos.',
    http: 'Karakeep no pudo guardar el marcador: {detail}',
    url: 'Introduzca un enlace que empiece por http:// o https://.',
    text: 'Introduzca el texto de la nota.',
    content: 'Introduzca un enlace o el texto de una nota.',
    unreachable: 'Karakeep no responde: el marcador no se ha guardado.',
    unauthorized: 'Karakeep rechazó la clave de API: el marcador no se ha guardado.',
    list: 'No hay ninguna lista «{name}» en Karakeep.',
    smart_list: '«{name}» es una lista inteligente: Karakeep la llena por sí mismo.',
    rejected: 'Karakeep rechazó el marcador: {detail}',
    after: 'Marcador guardado, pero {detail}',
    form: 'Actualice Gladys a la versión 5.2 o posterior para usar este formulario.',
  },
};

/** The toast of the widget form. */
export const SAVED_TEXT = {
  en: {
    link: 'Link saved in Karakeep.',
    text: 'Note saved in Karakeep.',
    existed: 'Link already in Karakeep.',
  },
  fr: {
    link: 'Lien enregistré dans Karakeep.',
    text: 'Note enregistrée dans Karakeep.',
    existed: 'Lien déjà présent dans Karakeep.',
  },
  de: {
    link: 'Link in Karakeep gespeichert.',
    text: 'Notiz in Karakeep gespeichert.',
    existed: 'Link ist schon in Karakeep.',
  },
  es: {
    link: 'Enlace guardado en Karakeep.',
    text: 'Nota guardada en Karakeep.',
    existed: 'El enlace ya está en Karakeep.',
  },
};

/** A coded message in every language, details filled in. */
export function commandMessage(code, values = {}) {
  return Object.fromEntries(
    Object.entries(COMMAND_ERRORS).map(([language, table]) => [
      language,
      (table[code] ?? table.unreachable)
        .replace('{name}', values.name ?? '')
        .replace('{detail}', values.detail ?? '')
        .slice(0, 200),
    ]),
  );
}

export const pick = (table, language) => table[language] ?? table.en;
