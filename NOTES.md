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
- **Notifications** (mode d'emploi : `NOTIFICATIONS.md`, à côté de `Code.gs`) :
  - **les changements faits sur la page** partent du téléphone, vers l'autre personne seulement
    (`notifier()` dans `index.html`, réglages par le bouton 🔔/🔕). Les sujets ntfy sont stockés
    dans le téléphone (`mimi_moi`, `mimi_ntfy_maxence`, `mimi_ntfy_marine`), jamais dans le dépôt ;
  - **le rappel du matin** part de Google (`Notifications.gs`) avec des essais toutes les 15 min.
  L'ancien `notify.mjs` + `notify.yml` a été retiré le 2026-10-07 pour deux raisons. Le cron GitHub
  le lançait vers 14h30 au lieu de 8h. Et il lisait les dates en UTC : une échéance du 09/10 était
  vue comme le 08/10.

## Fait

- Ajout vocal et écrit, priorité et propriétaire.
- Suppression vocale (« supprime X », « terminé X ») avec écran de confirmation.
- Liste triée par priorité, date butoir affichée.
- Gestes sur une ligne : glisser à droite = **Reporter à demain**,
  glisser à gauche = **Terminé** (état « Terminé », la tâche reste classée dans le Sheet).
- **Clic sur une tâche** : fiche d'édition (priorité, qui, date butoir),
  plus les boutons Terminé et Supprimer définitivement.
- Tuile widget + robot de régénération.
- Notifications push ntfy, côté hub (2026-10-07) : rappel du matin (en retard + du jour,
  chacun les siennes). En moins de 5 min, **chaque changement** est signalé aux personnes
  concernées : ajout, report, priorité, état, réattribution, terminé, supprimé.
  Testée hors ligne (`node test-notifications.js`, 25 cas). Le fichier `Notifications.gs` a été
  ajouté au projet Apps Script le 2026-10-07, et le contenu enregistré est identique au fichier
  local. Sujets ntfy (`NTFY_TOPIC_MAXENCE`, `NTFY_TOPIC_MARINE`) saisis le même jour : ils ont été
  tirés au hasard et sont lisibles seulement dans Paramètres du projet → Propriétés du script.
  **Actif depuis le 2026-10-07 à 17:55**. Journal de `notifInstaller` : 2 déclencheurs
  (`notifRappelDuJour` et `notifChangements`), sujets Maxence + Marine, 10 tâches mémorisées.
  Il reste à abonner les deux téléphones dans l'appli ntfy.
  Essai réel du 2026-10-07 à 18:20 : une date d'essai a été mise dans une case vide (D10), puis
  retirée. Elle a été repérée par la vérification de 18:22, et le message **est parti vers
  Maxence**. **Envoi à Marine : 2 échecs sur 2** (17:50 et 18:23), toujours « Address unavailable:
  https://ntfy.sh/ », après environ 50 s d'attente, et toujours en 2e envoi, après Maxence.
  **Cause trouvée (diagnostic de 18:39, Marine envoyée en premier)** : ni le sujet de Marine, ni
  l'ordre des envois. ntfy.sh a répondu 429 « daily message quota reached ». Son quota gratuit
  (250/jour) est compté **par adresse IP**, et Apps Script sort par des adresses partagées avec
  d'autres scripts, déjà à court de quota. Un compte ntfy gratuit ne change rien. Un 2e essai
  automatique n'y changerait rien non plus.
  **Décision de Maxence (2026-10-07, soir)** : les changements partent des **téléphones**, et seul
  l'autre est prévenu. Le rappel de 8h reste chez Google, avec des essais répétés. Codé et testé
  (page 15/15, Google 33/33, mutations détectées). Le format d'envoi depuis un navigateur a été
  vérifié pour de vrai (HTTP 200, accents intacts).
  **Côté Google : installé le 2026-10-07 à 19:54.** Le fichier recollé est identique au local
  (615 lignes). Journal de `notifInstaller` : 2 anciens déclencheurs supprimés, il ne reste que
  `notifRappelDuJour` (toutes les 15 min), `changementsParGoogle:false`, sujets Maxence + Marine.
  **Côté page : publiée le 2026-10-07 à 22:03 (heure de Paris)**. Commits `003d00f` (page) et
  `d9f6ac8` (retrait de l'ancien rappel GitHub), poussés par la clé SSH `github-maxence`. Vérifiée
  en ligne : bouton 🔔 présent, aucun jeton dans la page. Il reste à régler les deux téléphones.
  Limite assumée : une modification tapée directement dans le Sheet ne prévient personne.
- **Jeton collable dans les réglages 🔔** (2026-10-08, choix de Maxence). Cause : une page ouverte
  sans `#jeton` (bouton « Parler / Ajouter » de la tuile widget, autre navigateur, téléphone
  nettoyé) n'avait pas de jeton, d'où « jeton manquant » à l'ajout. Le panneau 🔔 a maintenant un
  champ « Jeton », qui accepte aussi le lien complet de l'icône. Un message clair s'affiche dès
  l'ouverture, et le jeton gardé n'est jamais réaffiché. Preuve : `node test-index.js` 19/19, 3 cas
  rouges avant la correction, 4 versions cassées exprès détectées.
- **Lien de réglage en un toucher** (2026-10-10, choix de Maxence). Constat du 2026-10-09 : les
  messages arrivaient bien sur ntfy.sh (rappels et tests lus en cache), mais **aucun téléphone ne
  les voyait, même en rafraîchissant l'appli ntfy** : les abonnements portaient sur un sujet mal
  recopié, et la page n'avait rien envoyé vers les vrais sujets. Remède : un lien
  `…/todo-mimis/#jeton=J&moi=Marine&max=SUJET&mar=SUJET` règle tout le téléphone (jeton,
  « Je suis », les deux sujets) ; il marche aussi collé dans le champ jeton de 🔔 (page ouverte
  par l'icône ou le widget, qui ont leur propre mémoire). Valeur au mauvais format = ignorée et
  signalée. L'ancien `#jeton` seul marche toujours. Dans 🔔 : bouton « M'abonner dans ntfy
  (Android) » (lien `ntfy://`, documenté pour Android seulement) et « Copier mon sujet ntfy
  (iPhone) ». Les liens ne sont **pas** dans ce dépôt (secrets) : ils ont été donnés dans le chat.
  Preuve : `node test-index.js` 25/25, 5 cas rouges avant, 6 versions cassées exprès détectées,
  lien réel lu par Chrome sans fenêtre (valeurs factices).
- **Fiche ⚙️ : le propriétaire n'est plus effacé** (2026-10-07). « Maxence Bonnet-Carrier Marine »
  s'affiche et s'enregistre comme « Maxence + Marine » (`normOwner`). Un propriétaire tapé à la
  main, absent du menu, est gardé. Preuve : `node test-index.js`, 2 cas rouges avant la
  correction et 8/8 verts après. Publié le 2026-10-07 (`003d00f`).
- **Liens et Notes conservés** (2026-10-07) : « Demain », « Terminé » et l'édition ⚙️ recréent
  la ligne. Avant, ils perdaient ces deux colonnes. `replaceTask` les recopie désormais.
  Preuve : `node test-index.js` (5 cas), rouge avant la correction et vert après.
  Le vrai hub écrit bien `liens` et `notes` : c'est lu dans son code (`appendTask_`, l. 105-106).
  Ce n'est pas encore vérifié en écrivant dans le Sheet. Publié le 2026-10-07 (`003d00f`).

## À faire côté Maxence

1. Régler les deux téléphones avec **leur lien de réglage** (donné dans le chat), puis 🔔 →
   « M'abonner dans ntfy » (Android) ou « Copier mon sujet » + coller dans ntfy (iPhone), puis
   « Envoyer un test à l'autre ». Voir `NOTIFICATIONS.md`.
2. Raccourci Siri de Marine : ajouter l'action qui prévient Maxence (`ios/README-iOS.md`, 3 bis).
3. Le secret GitHub `NTFY_TOPIC` du dépôt ne sert plus : on peut le supprimer.
   (Fait le 2026-10-07 : page publiée, `Notifications.gs` réinstallé, ancien rappel GitHub retiré.)

## Améliorations repérées (revue du 2026-10-07, non faites)

- **Jeton public** : la page servie par `GET /exec` (sans jeton) contient le jeton en clair, et
  l'URL `/exec` est dans ce dépôt public. N'importe qui peut donc ajouter ou supprimer des tâches.
- **Dates de la tuile un jour trop tôt** : `build-widget.mjs` tourne en UTC sur GitHub.
  Il affiche 08/10 pour une échéance du 09/10, alors que la page affiche la bonne date.
- **Tuile rarement à jour** : le cron « toutes les 15 min » tourne en réalité toutes les 3 à 6 h.
- Widget iOS : `prenom()` réduit « Maxence + Marine » à « Maxence ».
- Afficher en rouge les tâches en retard dans la liste et le widget.
- Récurrence (tâches qui reviennent chaque semaine).
