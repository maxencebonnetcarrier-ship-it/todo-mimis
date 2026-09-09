# To-do des Mimis

Petite app perso (Maxence + Marine) : une page web qui parle à un Google Sheet.
Pas de framework, pas de build : trois fichiers à la main.

## Avant toute chose

Lis `NOTES.md` : c'est la mémoire du projet entre les sessions (comment l'API
du Sheet marche, ce qui est fait, ce qui reste). Chaque session repart de zéro,
seul le dépôt traverse.

## Règle de fin de session

Avant de terminer, mets `NOTES.md` à jour (ce qui a été fait, ce qui reste, ce
qui attend une action de Maxence) et commite-le avec le reste. Ce qui n'est pas
commité est perdu.

## Fichiers

- `index.html` — la page complète : voix, ajout, liste, gestes, fiche d'édition.
- `list.html` — page figée pour la tuile widget. **Générée**, ne pas éditer à la main.
- `build-widget.mjs` — génère `list.html` (workflow toutes les ~15 min).
- `notify.mjs` — rappel ntfy quotidien (workflow ~8h Paris).

## Règles

- Le dépôt est **public** : aucun jeton, sujet ntfy ou secret dans le code.
  Le jeton du Sheet arrive par le `#` de l'URL, les secrets par GitHub Actions.
- L'Apps Script ne sait pas modifier une ligne : pour changer une tâche, la
  recréer puis supprimer l'ancienne (`replaceTask` dans `index.html`).
- Tout en français côté interface, y compris les messages d'état.
- JavaScript simple (`var`, `function`, pas de dépendance) : la page doit
  marcher telle quelle dans un widget iOS.
