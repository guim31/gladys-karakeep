# Karakeep

Verbinde Gladys mit [Karakeep](https://karakeep.app) (früher Hoarder), der
selbst gehosteten App für Lesezeichen, Notizen und Bilder: Behalte deine Zähler
im Blick, reagiere, wenn ein Lesezeichen hinzugefügt oder als Favorit markiert
wird, und speichere Links oder Notizen aus deinen Szenen oder vom Dashboard.
Alles bleibt in deinem lokalen Netzwerk: Gladys spricht direkt mit deinem
Karakeep-Server.

Getestet mit einem echten Karakeep-Server 0.33.2 (dem offiziellen
Docker-Image). Rückmeldungen sind im Gladys-Forum willkommen.

## Voraussetzungen

- Gladys Assistant 5.2 oder neuer.
- Ein Karakeep-Server, der vom Gladys-Rechner aus erreichbar ist, standardmäßig
  auf Port 3000 oder hinter einem Reverse-Proxy.
- Ein API-Schlüssel: Öffne in Karakeep **Einstellungen → API-Schlüssel** und
  erstelle einen. Die Integration sieht die Lesezeichen des Benutzers, dem der
  Schlüssel gehört.

## Konfiguration

1. Öffne den Reiter **Konfiguration** der Integration.
2. Gib unter **Karakeep-Adresse** die IP-Adresse des Servers ein, zum Beispiel
   `192.168.1.50`: Die Integration nutzt dann Port 3000. Füge den Port hinzu,
   wenn er abweicht (`192.168.1.50:3100`). Hinter einem Reverse-Proxy gibst du
   die vollständige Adresse ein (`https://keep.example.org`).
3. Füge den **API-Schlüssel** ein.
4. **Karakeep lesen alle**: 1, 5 (Standard), 15, 30 oder 60 Minuten. Neue
   Lesezeichen und Favoriten werden beim nächsten Lesen gemeldet.
5. **Sprache der Namen und Meldungen** legt die Namen der Funktionen (beim
   Hinzufügen des Geräts festgelegt) und die Texte der Integration fest.
   Standardmäßig Französisch.
6. Speichere und nutze dann **Verbindung testen**: Der Test zeigt den
   Karakeep-Benutzer und die Anzahl der Lesezeichen und Listen.
7. Füge im Reiter **Entdecken** das Gerät **Karakeep** hinzu.

## Gerät

**Karakeep** (ein Gerät für den Benutzer des API-Schlüssels):

| Funktion             | Wert                                                |
| -------------------- | --------------------------------------------------- |
| Lesezeichen          | Anzahl der Lesezeichen (Links, Notizen und Dateien) |
| Nicht archiviert     | noch nicht archivierte Lesezeichen: deine Leseliste |
| Favoriten            | als Favorit markierte Lesezeichen                   |
| Archiviert           | archivierte Lesezeichen                             |
| Listen               | Anzahl der Listen                                   |
| Tags                 | Anzahl der Tags                                     |
| Textmarkierungen     | Anzahl der Textmarkierungen                         |
| Neuestes Lesezeichen | Titel des neuesten Lesezeichens, oder „Keines“      |

Die Zähler behalten ihren Verlauf: Ein Diagramm zeigt, wie deine Leseliste
wächst.

## Dashboard-Widget

**Karakeep**: drei Kacheln (Lesezeichen, nicht archiviert, Favoriten), die
sechs neuesten Lesezeichen und eine Taste **Speichern**. In den
Widget-Einstellungen wählt **Angezeigte Lesezeichen** die neuesten Lesezeichen,
die neuesten Favoriten oder die neuesten nicht archivierten. Tippe auf ein
Lesezeichen, um seine Beschreibung oder Notiz zu lesen und den Link zu öffnen
(nur https-Links; **In Karakeep öffnen** erscheint, wenn Karakeep über https
erreicht wird). **Speichern** öffnet ein Formular: Gib einen Link (`https://…`
oder `www.…`) oder den Text einer Notiz ein, hake bei Bedarf **Favorit** an, und
die Integration speichert ihn.

## Szenen-Auslöser

- **Neues Lesezeichen**: Ein Link, eine Notiz oder eine Datei wird in Karakeep
  gespeichert, aus der Web-App, der Browser-Erweiterung, der mobilen App oder
  einem RSS-Feed. Der Filter **Typ** behält nur Links, Notizen oder Dateien.
  Importe und die von dieser Integration gespeicherten Lesezeichen werden nicht
  gemeldet.
- **Lesezeichen als Favorit markiert**: Ein Lesezeichen wird in Karakeep als
  Favorit markiert.

Variablen beider Auslöser: **Titel**, **Link** (leer bei einer Notiz), **Text
der Notiz** (leer bei einem Link), **Typ** (`link`, `text` oder `asset`), **Typ,
ausgeschrieben** und **Tags** (durch Kommas getrennt).

Das erste Lesen nach der Installation ist still: Bereits vorhandene Lesezeichen
werden nicht gemeldet. Höchstens zehn Ereignisse werden pro Lesen ausgelöst; der
Rest gilt als gesehen.

## Szenen-Aktionen

- **Link in Karakeep speichern**: **Link** (Pflicht) und optional **Titel**,
  **Liste** (der Name einer vorhandenen Liste, Groß- und Kleinschreibung egal),
  **Tags** (durch Kommas getrennt; fehlende Tags werden angelegt) und **Als
  Favorit markieren**. Gibt **Lesezeichen-ID**, **Titel** und **Schon
  gespeichert** zurück (der Link war schon in Karakeep: Karakeep behält ein
  einziges Lesezeichen pro Link).
- **Notiz in Karakeep speichern**: dasselbe, mit dem **Text der Notiz** statt
  des Links. Gibt **Lesezeichen-ID** und **Titel** zurück.

Eine intelligente Liste kann kein Lesezeichen aufnehmen: Karakeep füllt sie
anhand ihrer Abfrage.

## Szenen-Beispiele

- **Einkaufstaste**: Eine Zigbee-Taste in der Küche wird gedrückt → **Notiz in
  Karakeep speichern** mit dem Text `Kaffee kaufen`, Liste `Einkauf`, Tag
  `Haus`.
- **Leseerinnerung**: jeden Freitag um 18:00 → nur fortfahren, wenn die Funktion
  **Nicht archiviert** über 20 liegt → eine Nachricht senden „Deine
  Karakeep-Leseliste hat mehr als 20 Lesezeichen“.
- **Notizen aufs Handy**: Auslöser **Neues Lesezeichen**, Typ **Notiz** → eine
  Nachricht senden „Notiz: {{triggerEvent.data.text}}“.
- **Favorit zum Teilen**: Auslöser **Lesezeichen als Favorit markiert** → eine
  Nachricht senden „Neuer Favorit: {{triggerEvent.data.title}}
  {{triggerEvent.data.url}}“.

## Fehlerbehebung

- **„Karakeep hat den API-Schlüssel abgelehnt“**: Der Schlüssel wurde gelöscht
  oder falsch abgeschrieben. Erstelle einen neuen in Karakeep → Einstellungen →
  API-Schlüssel.
- **„Karakeep antwortet nicht“**: Prüfe Adresse und Port vom Gladys-Rechner aus.
  Der Container nutzt ein Bridge-Netzwerk: `localhost` ist der Container selbst,
  gib stattdessen die IP-Adresse des Servers ein.
- **„Diese Adresse antwortet nicht wie Karakeep“**: Eine Anmeldeseite eines
  Proxys antwortet anstelle von Karakeep. Gib die Adresse von Karakeep selbst
  ein oder lass den Gladys-Rechner durch den Proxy.
- **„Keine Liste … in Karakeep“**: Der Listenname der Szenen-Aktion muss einer
  vorhandenen Liste entsprechen. Lege sie zuerst in Karakeep an.
- Für mehr Details in den Logs der Integration setze `LOG_LEVEL=debug`.

## Grenzen

- Ein einziger Karakeep-Benutzer: der Besitzer des API-Schlüssels.
- Die Auslöser feuern beim nächsten Lesen (standardmäßig 5 Minuten), nicht
  sofort: Karakeep sendet nichts von sich aus.
- Ein Favorit, der zwischen zwei Lesevorgängen gesetzt und wieder entfernt wird,
  bleibt unbemerkt; ein Favorit, der gesetzt wird, während ein anderer entfernt
  wird, wird innerhalb einer Stunde erkannt.
- Die Integration löscht und archiviert in Karakeep nie etwas.
- Nicht mit dem Karakeep-Projekt verbunden.
