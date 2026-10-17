# Karakeep

Reliez Gladys à [Karakeep](https://karakeep.app) (anciennement Hoarder),
l'application auto-hébergée de marque-pages, de notes et d'images : suivez vos
compteurs, réagissez quand un marque-page est ajouté ou mis en favori, et
enregistrez des liens ou des notes depuis vos scènes ou le tableau de bord.
Tout reste sur votre réseau local : Gladys parle directement à votre serveur
Karakeep.

Testée avec un vrai serveur Karakeep 0.33.2 (l'image Docker officielle). Vos
retours sont les bienvenus sur le forum de Gladys.

## Prérequis

- Gladys Assistant 5.2 ou plus récent.
- Un serveur Karakeep joignable depuis la machine de Gladys, sur le port 3000
  par défaut, ou derrière un reverse proxy.
- Une clé d'API : dans Karakeep, ouvrez **Paramètres → Clés API** et créez-en
  une. L'intégration voit les marque-pages de l'utilisateur à qui appartient la
  clé.

## Configuration

1. Ouvrez l'onglet **Configuration** de l'intégration.
2. Dans **Adresse de Karakeep**, saisissez l'adresse IP du serveur, par exemple
   `192.168.1.50` : l'intégration utilise alors le port 3000. Ajoutez le port
   s'il est différent (`192.168.1.50:3100`). Derrière un reverse proxy,
   saisissez l'adresse complète (`https://keep.example.org`).
3. Collez la **Clé d'API**.
4. **Lire Karakeep toutes les** : 1, 5 (par défaut), 15, 30 ou 60 minutes. Les
   nouveaux marque-pages et favoris sont annoncés à la lecture suivante.
5. **Langue des noms et messages** fixe les noms des fonctionnalités (figés à
   l'ajout de l'appareil) et les textes de l'intégration. Français par défaut.
6. Enregistrez, puis utilisez **Tester la connexion** : elle affiche
   l'utilisateur Karakeep et le nombre de marque-pages et de listes.
7. Dans l'onglet **Découverte**, ajoutez l'appareil **Karakeep**.

## Appareil

**Karakeep** (un appareil pour l'utilisateur de la clé d'API) :

| Fonctionnalité      | Valeur                                                |
| ------------------- | ----------------------------------------------------- |
| Marque-pages        | nombre de marque-pages (liens, notes et fichiers)     |
| Non archivés        | marque-pages pas encore archivés : votre liste à lire |
| Favoris             | marque-pages mis en favori                            |
| Archivés            | marque-pages archivés                                 |
| Listes              | nombre de listes                                      |
| Tags                | nombre de tags                                        |
| Surlignages         | nombre de surlignages                                 |
| Dernier marque-page | titre du marque-page le plus récent, ou « Aucun »     |

Les compteurs gardent leur historique : un graphique montre l'évolution de
votre liste à lire.

## Widget du tableau de bord

**Karakeep** : trois tuiles (marque-pages, non archivés, favoris), les six
marque-pages les plus récents et un bouton **Enregistrer**. Dans les réglages
du widget, **Marque-pages affichés** choisit les plus récents, les derniers
favoris ou les derniers non archivés. Touchez un marque-page pour lire sa
description ou sa note, et ouvrir le lien (liens https seulement ; **Ouvrir
dans Karakeep** apparaît quand Karakeep est joint en https). **Enregistrer**
ouvre un formulaire : tapez un lien (`https://…` ou `www.…`) ou le texte d'une
note, cochez **Favori** si vous le souhaitez, et l'intégration l'enregistre.

## Déclencheurs de scène

- **Nouveau marque-page** : un lien, une note ou un fichier est enregistré dans
  Karakeep, depuis l'application web, l'extension du navigateur, l'application
  mobile ou un flux RSS. Le filtre **Type** ne garde que les liens, les notes ou
  les fichiers. Les imports et les marque-pages enregistrés par cette
  intégration ne sont pas annoncés.
- **Marque-page mis en favori** : un marque-page est mis en favori dans
  Karakeep.

Variables des deux : **Titre**, **Lien** (vide pour une note), **Texte de la
note** (vide pour un lien), **Type** (`link`, `text` ou `asset`), **Type, en
toutes lettres** et **Tags** (séparés par des virgules).

La première lecture après l'installation est silencieuse : les marque-pages
déjà présents ne sont pas annoncés. Dix événements au plus partent par lecture ;
le reste est compté comme vu.

## Actions de scène

- **Enregistrer un lien dans Karakeep** : **Lien** (obligatoire) et, si vous le
  souhaitez, **Titre**, **Liste** (le nom d'une liste existante, majuscules ou
  minuscules indifférentes), **Tags** (séparés par des virgules ; les tags
  absents sont créés) et **Mettre en favori**. Renvoie **Identifiant du
  marque-page**, **Titre** et **Déjà enregistré** (le lien était déjà dans
  Karakeep : Karakeep ne garde qu'un marque-page par lien).
- **Enregistrer une note dans Karakeep** : la même chose, avec le **Texte de la
  note** à la place du lien. Renvoie **Identifiant du marque-page** et
  **Titre**.

Une liste intelligente ne peut pas recevoir de marque-page : Karakeep la remplit
d'après sa requête.

## Exemples de scènes

- **Bouton des courses** : un bouton Zigbee de la cuisine est appuyé →
  **Enregistrer une note dans Karakeep** avec le texte `Racheter du café`, liste
  `Courses`, tag `maison`.
- **Rappel de lecture** : chaque vendredi à 18 h → continuer seulement si la
  fonctionnalité **Non archivés** dépasse 20 → envoyer un message « Votre liste
  à lire Karakeep dépasse 20 marque-pages ».
- **Notes sur le téléphone** : déclencheur **Nouveau marque-page**, type
  **Note** → envoyer un message « Note : {{triggerEvent.data.text}} ».
- **Favori à partager** : déclencheur **Marque-page mis en favori** → envoyer
  un message « Nouveau favori : {{triggerEvent.data.title}}
  {{triggerEvent.data.url}} ».

## Dépannage

- **« Karakeep a refusé la clé d'API »** : la clé a été supprimée ou mal
  recopiée. Créez-en une nouvelle dans Karakeep → Paramètres → Clés API.
- **« Karakeep ne répond pas »** : vérifiez l'adresse et le port depuis la
  machine de Gladys. Le conteneur est sur un réseau en pont : `localhost`
  désigne le conteneur lui-même, saisissez plutôt l'adresse IP du serveur.
- **« Cette adresse ne répond pas comme Karakeep »** : une page de connexion
  d'un proxy répond à la place de Karakeep. Saisissez l'adresse de Karakeep
  lui-même, ou laissez passer la machine de Gladys.
- **« Aucune liste … dans Karakeep »** : le nom de liste de l'action de scène
  doit correspondre à une liste existante. Créez-la d'abord dans Karakeep.
- Pour plus de détails dans les journaux de l'intégration, réglez
  `LOG_LEVEL=debug`.

## Limites

- Un seul utilisateur Karakeep : le propriétaire de la clé d'API.
- Les déclencheurs partent à la lecture suivante (5 minutes par défaut), pas
  instantanément : Karakeep ne pousse rien.
- Mettre puis retirer un favori entre deux lectures passe inaperçu.
- L'intégration ne supprime ni n'archive jamais rien dans Karakeep.
- Sans lien avec le projet Karakeep.
