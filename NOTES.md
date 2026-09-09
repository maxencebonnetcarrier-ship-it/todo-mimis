# To-do des Mimis — notes de suivi

Bloc-notes entre sessions : où on en est, comment ça marche, ce qui reste.

## Comment c'est branché

- **Google Sheet** = la base. Un Apps Script publié en `/exec` sert d'API.
  - `GET ?json=1` : lecture seule, sans jeton (utilisé par le robot GitHub).
  - `POST {token, tache, proprietaire, priorite, etat, dateLimite}` : ajoute une ligne.
  - `POST {token, action:"delete", row, expect}` : supprime une ligne.
  - `POST {token, action:"search", match}` : cherche des tâches.
  - Il n'y a **pas** d'action de modification : pour changer une tâche, on la
    recrée avec les nouvelles valeurs puis on supprime l'ancienne ligne
    (fonction `replaceTask` dans `index.html`).
- **Jeton** : jamais dans le dépôt (public). Il arrive par le `#` de l'URL
  (raccourci « Parler »), puis est mémorisé en `localStorage`.
- `index.html` : la page complète (voix, ajout, liste, gestes, fiche d'édition).
- `list.html` : page figée pour la tuile widget, régénérée par `build-widget.mjs`
  via le workflow `build-widget.yml` (toutes les ~15 min).
- `notify.mjs` + `notify.yml` : rappel ntfy quotidien (~8h Paris).

## Fait

- Ajout vocal et écrit, priorité et propriétaire.
- Suppression vocale (« supprime X », « terminé X ») avec écran de confirmation.
- Liste triée par priorité, date butoir affichée.
- Gestes sur une ligne : glisser à droite = **Reporter à demain**,
  glisser à gauche = **Terminé** (état « Terminé », la tâche reste classée dans le Sheet).
- **Clic sur une tâche** : fiche d'édition (priorité, qui, date butoir),
  plus les boutons Terminé et Supprimer définitivement.
- Tuile widget + robot de régénération.
- Notification ntfy quotidienne des tâches en retard ou dues aujourd'hui.

## À faire côté Maxence (une seule fois, pour ntfy)

1. Installer l'appli **ntfy** (iOS / Android).
2. S'abonner à un sujet privé, par exemple `mimis-todo-<quelque-chose-au-hasard>`.
   Le sujet est le seul secret : n'importe qui qui le connaît reçoit les messages.
3. Dans GitHub : *Settings → Secrets and variables → Actions → New repository secret*,
   nom `NTFY_TOPIC`, valeur = le sujet choisi.
   (Optionnel `NTFY_SERVER` si serveur ntfy auto-hébergé.)
4. Tester : onglet *Actions → Notification ntfy → Run workflow*.
   Sans tâche en retard ni due aujourd'hui, rien n'est envoyé (c'est voulu).

## Idées pas encore faites

- Afficher en rouge les tâches en retard dans la liste et le widget.
- Notification aussi quand quelqu'un ajoute une tâche pour l'autre.
- Récurrence (tâches qui reviennent chaque semaine).
