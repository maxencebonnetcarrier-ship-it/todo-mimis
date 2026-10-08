/**
 * Test de index.html — exécute le VRAI <script> de la page sous Node, avec une page
 * et un hub simulés (aucun réseau, aucun accès au vrai Sheet).
 *
 * Ce qu'il prouve : « Reporter à demain », « Terminé » et l'édition (⚙️) recréent la
 * tâche SANS perdre les colonnes Liens et Notes.
 *
 * Lancer : node test-index.js       Code de sortie : 0 = tout vert, 1 = au moins un échec.
 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
var SCRIPT = (HTML.match(/<script>([\s\S]*?)<\/script>/) || [])[1];
if (!SCRIPT) { console.log('❌ <script> introuvable dans index.html'); process.exit(1); }

var EXEC = 'https://script.google.com/macros/s/AKfycbxU535e3IPWFkmDDj-jHNspuVNjdbrbtYhOHA162v7xYri66DM5ytRdwMU2IXxfV2ct7A/exec';
var ENTETE = ['Tâche', 'État', 'Propriétaire', 'Date limite', 'Priorité', 'Liens', 'Notes'];
var LIGNES = [
  ENTETE,
  ['Appeler la banque', 'Pas commencé', 'Marine', '2026-10-08T22:00:00.000Z', 'Haute',
    'https://banque.example/rdv', 'Demander le conseiller Dupont'],
  ['Ranger la cave', 'En cours', 'Maxence + Marine', '', 'Basse', '', ''],
  // Écriture historique du couple, encore présente dans le vrai Sheet (lignes 3 et 4).
  ['Trier le balcon', 'Pas commencé', 'Maxence Bonnet-Carrier Marine', '', 'Moyenne', '', 'note balcon'],
  // Propriétaire tapé à la main dans le Sheet, absent du menu de la fiche.
  ['Rendre la perceuse', 'Pas commencé', 'Paul', '', 'Basse', '', '']
];

// Les <select> de la page, lus dans index.html, pour imiter un vrai navigateur :
// donner à un menu une valeur qui n'est pas dans ses choix le laisse VIDE.
var MENUS = {};
(HTML.match(/<select id="[^"]+">[\s\S]*?<\/select>/g) || []).forEach(function (bloc) {
  var choix = [], re = /<option( value="([^"]*)")?[^>]*>([^<]*)<\/option>/g, m;
  while ((m = re.exec(bloc))) choix.push(m[1] ? m[2] : m[3]);
  MENUS[bloc.match(/<select id="([^"]+)"/)[1]] = choix;
});

/* ------------------------------------------------------------------ Page simulée */

function page(opts) {
  opts = opts || {};
  var p = { posts: [], ntfy: [], elements: {} };
  function element(id) {
    var ecouteurs = {};
    var classes = {};
    return {
      id: id, value: '', textContent: '', innerHTML: '', hidden: true, style: {}, dataset: {},
      classList: {
        add: function (c) { classes[c] = true; }, remove: function (c) { delete classes[c]; },
        contains: function (c) { return !!classes[c]; },
        toggle: function (c, f) { if (f === undefined ? !classes[c] : f) classes[c] = true; else delete classes[c]; }
      },
      addEventListener: function (type, fn) { (ecouteurs[type] = ecouteurs[type] || []).push(fn); },
      declencher: function (type) { (ecouteurs[type] || []).forEach(function (fn) { fn({ target: this, stopPropagation: function () {} }); }, this); },
      appendChild: function () {}
    };
  }
  function menu(id, choix) {
    var e = element(id), courant = choix[0];
    e.options = choix.map(function (v) { return { value: v, textContent: v }; });
    Object.defineProperty(e, 'value', {
      get: function () { return courant; },
      set: function (v) {
        v = String(v);
        courant = e.options.some(function (o) { return o.value === v; }) ? v : '';
      }
    });
    e.appendChild = function (o) { e.options.push(o); };
    e.removeChild = function (o) { e.options = e.options.filter(function (x) { return x !== o; }); };
    return e;
  }
  function parId(id) { return p.elements[id] || (p.elements[id] = MENUS[id] ? menu(id, MENUS[id]) : element(id)); }

  function reponse(objet) { return Promise.resolve({ json: function () { return Promise.resolve(objet); } }); }
  function fauxFetch(url, init) {
    if (url === 'https://ntfy.sh/') {
      var envoi = JSON.parse(init.body);
      p.ntfy.push(envoi);
      var code = opts.ntfyCode || 200;
      return Promise.resolve({ ok: code >= 200 && code < 300, status: code, json: function () { return Promise.resolve({}); } });
    }
    if (!init || init.method !== 'POST') {
      if (url !== EXEC + '?json=1') throw new Error('lecture inattendue : ' + url);
      return reponse({ ok: true, taches: LIGNES });
    }
    var corps = JSON.parse(init.body);
    p.posts.push(corps);
    if (corps.action === 'delete') return reponse({ ok: true });
    return reponse(opts.ajoutRefuse ? { ok: false, error: 'refus simulé' } : { ok: true });
  }

  var stockage = Object.assign({}, opts.stockage || {});
  p.stockage = stockage;
  p.contexte = vm.createContext({
    document: {
      getElementById: parId,
      body: element('body'),
      querySelectorAll: function () { return []; },
      createElement: function () { return element(''); }
    },
    window: { matchMedia: function () { return { matches: false }; } },
    location: { hash: opts.hash != null ? opts.hash : '#jeton-de-test', search: '' },
    localStorage: { getItem: function (k) { return stockage[k] || null; }, setItem: function (k, v) { stockage[k] = String(v); } },
    URLSearchParams: URLSearchParams,
    fetch: fauxFetch,
    setInterval: function () {},
    console: console
  });
  vm.runInContext(SCRIPT, p.contexte, { filename: 'index.html <script>' });
  p.tache = function (libelle) {
    var t = p.contexte.CURRENT.filter(function (x) { return x.tache === libelle; })[0];
    if (!t) throw new Error('tâche absente de la liste : ' + libelle);
    return t;
  };
  p.ajouts = function () { return p.posts.filter(function (b) { return !b.action; }); };
  p.suppressions = function () { return p.posts.filter(function (b) { return b.action === 'delete'; }); };
  return p;
}

function attendre() { return new Promise(function (r) { setTimeout(r, 0); }); }
async function stable() { for (var i = 0; i < 10; i++) await attendre(); }

/* ------------------------------------------------------------------ Mini-runner */

var echecs = 0, total = 0, liste = [];
function cas(nom, fn) { liste.push([nom, fn]); }
function egal(a, b, msg) { if (a !== b) throw new Error(msg + ' — attendu ' + JSON.stringify(b) + ', obtenu ' + JSON.stringify(a)); }
function ok(cond, msg) { if (!cond) throw new Error(msg); }

function verifierConserve(ajout, msg) {
  egal(ajout.liens, 'https://banque.example/rdv', msg + ' : colonne Liens');
  egal(ajout.notes, 'Demander le conseiller Dupont', msg + ' : colonne Notes');
}

cas('Reporter à demain : Liens et Notes recopiés dans la nouvelle ligne', async function () {
  var p = page(); await stable();
  p.contexte.doSnooze(p.tache('Appeler la banque'), p.contexte.document.getElementById('status'));
  await stable();
  egal(p.ajouts().length, 1, 'une ligne recréée');
  verifierConserve(p.ajouts()[0], 'report');
  egal(p.suppressions().length, 1, 'l\'ancienne ligne supprimée ensuite');
  egal(p.suppressions()[0].expect, 'Appeler la banque', 'suppression gardée par le libellé');
});

cas('Terminé (glisser à gauche) : Liens et Notes conservés', async function () {
  var p = page(); await stable();
  p.contexte.doDone(p.tache('Appeler la banque'), p.contexte.document.getElementById('status'));
  await stable();
  egal(p.ajouts()[0].etat, 'Terminé', 'état');
  verifierConserve(p.ajouts()[0], 'terminé');
});

cas('Édition par la fiche ⚙️ : Liens et Notes conservés, la modification appliquée', async function () {
  var p = page(); await stable();
  var idx = p.contexte.CURRENT.indexOf(p.tache('Appeler la banque'));
  p.contexte.openEditor(idx);
  p.contexte.document.getElementById('mPrio').value = 'Basse';
  p.contexte.document.getElementById('mSave').declencher('click');
  await stable();
  egal(p.ajouts()[0].priorite, 'Basse', 'priorité modifiée');
  verifierConserve(p.ajouts()[0], 'édition');
});

cas('Tâche sans Liens ni Notes : champs vides, jamais « undefined »', async function () {
  var p = page(); await stable();
  p.contexte.doSnooze(p.tache('Ranger la cave'), p.contexte.document.getElementById('status'));
  await stable();
  egal(p.ajouts()[0].liens, '', 'Liens vide');
  egal(p.ajouts()[0].notes, '', 'Notes vide');
});

function editer(p, libelle, changements) {
  var d = p.contexte.document;
  p.contexte.openEditor(p.contexte.CURRENT.indexOf(p.tache(libelle)));
  var affiche = d.getElementById('mOwn').value;
  Object.keys(changements || {}).forEach(function (id) { d.getElementById(id).value = changements[id]; });
  d.getElementById('mSave').declencher('click');
  return affiche;
}

cas('Fiche ⚙️ : « Maxence Bonnet-Carrier Marine » affiché « Maxence + Marine » et conservé à l\'enregistrement', async function () {
  var p = page(); await stable();
  var affiche = editer(p, 'Trier le balcon', { mPrio: 'Haute' });
  await stable();
  egal(affiche, 'Maxence + Marine', 'menu « Qui ? » à l\'ouverture de la fiche');
  egal(p.ajouts()[0].proprietaire, 'Maxence + Marine', 'propriétaire envoyé');
  egal(p.ajouts()[0].priorite, 'Haute', 'la modification demandée est appliquée');
  egal(p.ajouts()[0].notes, 'note balcon', 'Notes toujours conservées');
});

cas('Fiche ⚙️ : propriétaire hors menu (tapé dans le Sheet) conservé, sans laisser de choix fantôme', async function () {
  var p = page(); await stable();
  var affiche = editer(p, 'Rendre la perceuse', { mPrio: 'Haute' });
  await stable();
  egal(affiche, 'Paul', 'menu « Qui ? » à l\'ouverture de la fiche');
  egal(p.ajouts()[0].proprietaire, 'Paul', 'propriétaire envoyé');
  p.contexte.openEditor(p.contexte.CURRENT.indexOf(p.tache('Appeler la banque')));
  egal(p.contexte.document.getElementById('mOwn').options.length, 4, 'choix du menu revenus aux 4 d\'origine');
  egal(p.contexte.document.getElementById('mOwn').value, 'Marine', 'propriétaire de la tâche suivante');
});

cas('Fiche ⚙️ : changer ou retirer volontairement le propriétaire marche toujours', async function () {
  var p = page(); await stable();
  editer(p, 'Trier le balcon', { mOwn: 'Marine' });
  await stable();
  egal(p.ajouts()[0].proprietaire, 'Marine', 'changement volontaire');
  var p2 = page(); await stable();
  editer(p2, 'Rendre la perceuse', { mOwn: '' });
  await stable();
  egal(p2.ajouts()[0].proprietaire, '', 'retrait volontaire (choix « — »)');
});

/* ------------------------------------------------------------------ Notifications ntfy (depuis le téléphone) */

var SUJETS = { mimi_ntfy_maxence: 'sujet-de-maxence', mimi_ntfy_marine: 'sujet-de-marine' };
function regle(moi) { return Object.assign({ mimi_moi: moi }, SUJETS); }
function statut(p) { return p.contexte.document.getElementById('status').textContent; }

cas('ntfy : notifications non réglées sur ce téléphone → aucun envoi, cloche 🔕', async function () {
  var p = page(); await stable();
  p.contexte.doSnooze(p.tache('Appeler la banque'), p.contexte.document.getElementById('status'));
  await stable();
  egal(p.ntfy.length, 0, 'envois ntfy');
  egal(p.contexte.document.getElementById('bell').textContent, '🔕', 'cloche');
});

cas('ntfy : ajout par Maxence → seule Marine est prévenue, avec le libellé', async function () {
  var p = page({ stockage: regle('Maxence') }); await stable();
  egal(p.contexte.document.getElementById('bell').textContent, '🔔', 'cloche');
  p.contexte.document.getElementById('t').value = 'Acheter du pain pour marine priorité haute';
  p.contexte.document.getElementById('go').declencher('click');
  await stable();
  egal(p.ntfy.length, 1, 'un seul envoi');
  egal(p.ntfy[0].topic, 'sujet-de-marine', 'destinataire = l\'autre, jamais soi-même');
  egal(p.ntfy[0].title, 'Maxence a ajouté une tâche', 'titre');
  egal(p.ntfy[0].message, '« Acheter du pain » — pour Marine · priorité haute', 'message');
  egal(p.ntfy[0].click, 'https://maxencebonnetcarrier-ship-it.github.io/todo-mimis/', 'lien sans jeton');
  egal(statut(p), 'Ajoutée ✅ · Marine prévenue 🔔', 'retour visible');
});

cas('ntfy : report, terminé, suppression par Marine → Maxence prévenu', async function () {
  var p = page({ stockage: regle('Marine') }); await stable();
  var s = p.contexte.document.getElementById('status');
  p.contexte.doSnooze(p.tache('Appeler la banque'), s); await stable();
  egal(p.ntfy[0].topic, 'sujet-de-maxence', 'destinataire');
  egal(p.ntfy[0].title, 'Marine a reporté une tâche', 'titre report');
  ok(/^« Appeler la banque » → demain \(\d{2}\/\d{2}\)$/.test(p.ntfy[0].message), 'message report : ' + p.ntfy[0].message);
  p.contexte.doDone(p.tache('Ranger la cave'), s); await stable();
  egal(p.ntfy[1].title, 'Marine a terminé une tâche', 'titre terminé');
  egal(p.ntfy[1].message, '✅ « Ranger la cave »', 'message terminé');
  p.contexte.openEditor(p.contexte.CURRENT.indexOf(p.tache('Trier le balcon')));
  p.contexte.document.getElementById('mDel').declencher('click'); await stable();
  egal(p.ntfy[2].title, 'Marine a supprimé une tâche', 'titre suppression');
  egal(p.ntfy[2].message, '🗑️ « Trier le balcon »', 'message suppression');
  egal(statut(p), 'Supprimée ✅ · Maxence prévenu 🔔', 'retour visible');
});

cas('ntfy : édition → le détail de ce qui change ; enregistrer sans rien changer → aucun envoi', async function () {
  var p = page({ stockage: regle('Maxence') }); await stable();
  editer(p, 'Appeler la banque', { mPrio: 'Basse' }); await stable();
  egal(p.ntfy.length, 1, 'un envoi');
  egal(p.ntfy[0].title, 'Maxence a modifié une tâche', 'titre');
  egal(p.ntfy[0].message, '« Appeler la banque » — priorité Haute → Basse', 'message');
  var p2 = page({ stockage: regle('Maxence') }); await stable();
  editer(p2, 'Ranger la cave', {}); await stable();
  egal(p2.ajouts().length, 1, 'la tâche est quand même enregistrée');
  egal(p2.ntfy.length, 0, 'aucune notification sans changement');
});

cas('ntfy : refus de ntfy (429) → la tâche est bien modifiée, l\'échec est affiché', async function () {
  var p = page({ stockage: regle('Maxence'), ntfyCode: 429 }); await stable();
  p.contexte.doDone(p.tache('Appeler la banque'), p.contexte.document.getElementById('status'));
  await stable();
  egal(p.suppressions().length, 1, 'action menée jusqu\'au bout');
  egal(statut(p), 'Terminée et classée ✅ · ⚠️ Marine non prévenue : ntfy a répondu 429', 'échec visible');
});

cas('ntfy : réglages par le bouton 🔔 → enregistrés, cloche allumée, test envoyé à l\'autre', async function () {
  var p = page(); await stable();
  var d = p.contexte.document;
  d.getElementById('bell').declencher('click');
  egal(d.getElementById('nmodal').hidden, false, 'panneau ouvert');
  d.getElementById('nMoi').value = 'Marine';
  d.getElementById('nMax').value = '  sujet-de-maxence ';
  d.getElementById('nMar').value = 'sujet-de-marine';
  d.getElementById('nSave').declencher('click');
  egal(p.stockage.mimi_moi, 'Marine', 'qui'); egal(p.stockage.mimi_ntfy_maxence, 'sujet-de-maxence', 'sujet nettoyé');
  egal(d.getElementById('bell').textContent, '🔔', 'cloche allumée');
  egal(statut(p), 'Notifications : ce téléphone prévient Maxence 🔔', 'confirmation');
  d.getElementById('nTest').declencher('click'); await stable();
  egal(p.ntfy.length, 1, 'test envoyé');
  egal(p.ntfy[0].topic, 'sujet-de-maxence', 'à l\'autre');
  egal(p.ntfy[0].title, 'Marine t\'envoie un test', 'titre du test');
});

cas('ntfy : sujet au mauvais format → rien n\'est enregistré, message clair', async function () {
  var p = page({ stockage: regle('Maxence') }); await stable();
  var d = p.contexte.document;
  d.getElementById('bell').declencher('click');
  d.getElementById('nMar').value = 'mon sujet à moi';
  d.getElementById('nSave').declencher('click');
  egal(p.stockage.mimi_ntfy_marine, 'sujet-de-marine', 'ancien réglage conservé');
  egal(statut(p), 'Sujet ntfy invalide : lettres, chiffres, - et _ seulement (rien n\'est enregistré)', 'message');
});

/* ------------------------------------------------------------------ Jeton (page ouverte depuis le widget, sans #) */

var MSG_JETON = 'Jeton manquant : touche 🔔 (ou 🔕) en haut et colle le jeton de la to-do';
function ajouter(p, texte) {
  p.contexte.document.getElementById('t').value = texte;
  p.contexte.document.getElementById('go').declencher('click');
}
function reglerJeton(p, saisie) {
  var d = p.contexte.document;
  d.getElementById('bell').declencher('click');
  d.getElementById('nTok').value = saisie;
  d.getElementById('nSave').declencher('click');
}

cas('jeton : page ouverte sans jeton → message clair dès l\'ouverture, ajout bloqué sans appel au hub', async function () {
  var p = page({ hash: '' }); await stable();
  egal(statut(p), MSG_JETON, 'message à l\'ouverture');
  ajouter(p, 'Acheter du pain'); await stable();
  egal(statut(p), MSG_JETON, 'message à l\'ajout');
  egal(p.ajouts().length, 0, 'aucun appel au hub');
});

cas('jeton : collé dans les réglages 🔔 → gardé dans le téléphone, l\'ajout marche avec lui', async function () {
  var p = page({ hash: '' }); await stable();
  reglerJeton(p, '  jeton-colle ');
  egal(p.stockage.mimi_token, 'jeton-colle', 'jeton gardé (espaces retirés)');
  ok(/^Jeton enregistré ✅/.test(statut(p)), 'confirmation : ' + statut(p));
  ajouter(p, 'Acheter du pain'); await stable();
  egal(p.ajouts().length, 1, 'ajout envoyé');
  egal(p.ajouts()[0].token, 'jeton-colle', 'avec le jeton collé');
});

cas('jeton : lien complet de l\'icône collé (…/#jeton) → seul le jeton est gardé', async function () {
  var p = page({ hash: '' }); await stable();
  reglerJeton(p, 'https://maxencebonnetcarrier-ship-it.github.io/todo-mimis/#jeton-colle');
  egal(p.stockage.mimi_token, 'jeton-colle', 'partie après le #');
});

cas('jeton : champ laissé vide → le jeton déjà gardé est conservé et jamais réaffiché', async function () {
  var p = page({ hash: '', stockage: { mimi_token: 'ancien-jeton' } }); await stable();
  egal(statut(p), '', 'pas d\'alerte quand le jeton est déjà là');
  p.contexte.document.getElementById('bell').declencher('click');
  egal(p.contexte.document.getElementById('nTok').value, '', 'le jeton n\'est pas réaffiché en clair');
  p.contexte.document.getElementById('nSave').declencher('click');
  egal(p.stockage.mimi_token, 'ancien-jeton', 'jeton conservé');
  ajouter(p, 'Acheter du pain'); await stable();
  egal(p.ajouts()[0].token, 'ancien-jeton', 'ajout avec l\'ancien jeton');
});

cas('Ajout refusé par le hub : l\'ancienne ligne n\'est PAS supprimée', async function () {
  var p = page({ ajoutRefuse: true }); await stable();
  p.contexte.doDone(p.tache('Appeler la banque'), p.contexte.document.getElementById('status'));
  await stable();
  egal(p.suppressions().length, 0, 'aucune suppression');
  egal(p.contexte.document.getElementById('status').textContent, 'Erreur : refus simulé', 'message affiché');
});

(async function () {
  for (var i = 0; i < liste.length; i++) {
    total++;
    try { await liste[i][1](); console.log('✅ ' + liste[i][0]); }
    catch (e) { echecs++; console.log('❌ ' + liste[i][0] + '\n   ' + e.message); }
  }
  console.log('\n' + (echecs === 0 ? 'TOUS VERTS (' + total + '/' + total + ')' : echecs + ' ÉCHEC(S) sur ' + total));
  process.exit(echecs === 0 ? 0 : 1);
})();
