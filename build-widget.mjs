// Génère list.html (page "toute faite" pour la tuile widget) à partir du hub.
// Aucune donnée sensible : lecture seule via ?json=1 (pas de token).
import { writeFileSync } from "node:fs";

const EXEC = "https://script.google.com/macros/s/AKfycbxU535e3IPWFkmDDj-jHNspuVNjdbrbtYhOHA162v7xYri66DM5ytRdwMU2IXxfV2ct7A/exec";
const ORDER = { "Haute": 0, "Moyenne": 1, "Basse": 2 };
const COLOR = { "Haute": "#e5484d", "Moyenne": "#f5a623", "Basse": "#3fa45b" };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const res = await fetch(EXEC + "?json=1");
const data = await res.json();
const rows = (data && data.taches) || [];

const items = [];
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  const tache = String(r[0] || "").trim();
  if (!tache) continue;
  const etat = String(r[1] || "").toLowerCase();
  if (etat.includes("termin") || etat.includes("fait")) continue;
  items.push({ tache, prop: String(r[2] || ""), prio: String(r[4] || "") });
}
items.sort((a, b) => (ORDER[a.prio] ?? 9) - (ORDER[b.prio] ?? 9));

const li = items.map((it) =>
  `<div class="item"><span class="dot" style="background:${COLOR[it.prio] || "#888"}"></span>`
  + `<span class="tx">${esc(it.tache)}</span><span class="meta">${esc(it.prop)}</span></div>`
).join("") || `<div class="empty">Rien à faire 🎉</div>`;

const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

const html = `<!doctype html>
<html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="600">
<title>To-do des Mimis</title>
<style>
  html,body{margin:0;height:100%}
  body{font-family:-apple-system,Roboto,Arial,sans-serif;background:#14161a;color:#f2f3f5}
  .card{padding:10px 14px}
  h1{font-size:15px;margin:0 0 8px;display:flex;justify-content:space-between;align-items:center}
  h1 .c{font-size:12px;color:#9aa0aa;font-weight:500}
  .item{display:flex;align-items:center;gap:9px;padding:5px 0;border-bottom:1px solid #2a2e37;font-size:13px}
  .dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto}
  .tx{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .meta{font-size:11px;color:#9aa0aa;flex:0 0 auto}
  .empty{color:#9aa0aa;font-size:13px;padding:10px 0}
</style></head><body>
<div class="card"><h1><span>To-do des Mimis</span><span class="c">${items.length} · ${now}</span></h1>
${li}
</div></body></html>`;

writeFileSync("list.html", html);
console.log(`list.html généré : ${items.length} tâches à ${now}`);
