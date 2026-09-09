// Génère list.html (page "toute faite" pour la tuile widget) à partir du hub.
// Aucune donnée sensible : lecture seule via ?json=1 (pas de token).
import { writeFileSync } from "node:fs";

const EXEC = "https://script.google.com/macros/s/AKfycbxU535e3IPWFkmDDj-jHNspuVNjdbrbtYhOHA162v7xYri66DM5ytRdwMU2IXxfV2ct7A/exec";
const ORDER = { "Haute": 0, "Moyenne": 1, "Basse": 2 };
const COLOR = { "Haute": "#e5484d", "Moyenne": "#f5a623", "Basse": "#3fa45b" };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const normOwner = (p) => p.replace(/\bmaxence\s+bonnet[- ]?carrier\b/gi, "Maxence").replace(/\bbonnet[- ]?carrier\b/gi, "").replace(/\s{2,}/g, " ").trim();

function fmtDate(v) {
  if (!v) return "";
  const d = new Date(v);
  if (!isNaN(d.getTime()) && String(v).length > 6) {
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
  }
  return String(v).trim();
}

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
  items.push({ tache, prop: normOwner(String(r[2] || "")), date: fmtDate(r[3]), prio: String(r[4] || "") });
}
items.sort((a, b) => (ORDER[a.prio] ?? 9) - (ORDER[b.prio] ?? 9));

const li = items.map((it) =>
  `<div class="item"><span class="dot" style="background:${COLOR[it.prio] || "#888"}"></span>`
  + `<span class="tx">${esc(it.tache)}</span><span class="meta">${it.date ? "📅 " + esc(it.date) + " · " : ""}${esc(it.prop)}</span></div>`
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
  .tx{flex:1;white-space:normal;overflow-wrap:anywhere;line-height:1.25}
  .meta{font-size:11px;color:#9aa0aa;flex:0 0 auto}
  .empty{color:#9aa0aa;font-size:13px;padding:10px 0}
  .mic{display:block;text-align:center;text-decoration:none;background:#e5484d;color:#fff;
    font-size:16px;font-weight:600;padding:11px;border-radius:12px;margin:2px 0 10px}
</style></head><body>
<div class="card">
<h1><span>To-do des Mimis</span><span class="c">${items.length} · ${now}</span></h1>
<a class="mic" href="index.html">🎤 Parler / Ajouter</a>
${li}
</div></body></html>`;

writeFileSync("list.html", html);
console.log(`list.html généré : ${items.length} tâches à ${now}`);
