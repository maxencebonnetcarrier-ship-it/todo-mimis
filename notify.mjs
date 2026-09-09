// Notification quotidienne via ntfy.sh : tâches en retard ou à faire aujourd'hui.
// Le sujet ntfy n'est PAS dans le dépôt : il arrive par le secret GitHub NTFY_TOPIC.
const EXEC = "https://script.google.com/macros/s/AKfycbxU535e3IPWFkmDDj-jHNspuVNjdbrbtYhOHA162v7xYri66DM5ytRdwMU2IXxfV2ct7A/exec";
const TOPIC = (process.env.NTFY_TOPIC || "").trim();
const SERVER = (process.env.NTFY_SERVER || "https://ntfy.sh").replace(/\/+$/, "");

if (!TOPIC) {
  console.log("NTFY_TOPIC absent : rien à envoyer.");
  process.exit(0);
}

// Date du jour à Paris, au format AAAA-MM-JJ (comparable en texte).
const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });

function isoOf(v) {
  if (!v) return "";
  const d = new Date(v);
  if (!isNaN(d.getTime()) && String(v).length > 6) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  const m = String(v).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}

const res = await fetch(EXEC + "?json=1");
const data = await res.json();
const rows = (data && data.taches) || [];

const late = [], due = [];
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  const tache = String(r[0] || "").trim();
  if (!tache) continue;
  const etat = String(r[1] || "").toLowerCase();
  if (etat.includes("termin") || etat.includes("fait")) continue;
  const iso = isoOf(r[3]);
  if (!iso) continue;
  const prop = String(r[2] || "").trim();
  const ligne = tache + (prop ? ` (${prop})` : "");
  if (iso < today) late.push(ligne);
  else if (iso === today) due.push(ligne);
}

if (!late.length && !due.length) {
  console.log("Rien d'urgent aujourd'hui : pas de notification.");
  process.exit(0);
}

const corps = [
  late.length ? "⏰ En retard :\n" + late.map((t) => "• " + t).join("\n") : "",
  due.length ? "📅 Aujourd'hui :\n" + due.map((t) => "• " + t).join("\n") : "",
].filter(Boolean).join("\n\n");

const titre = late.length ? `To-do des Mimis — ${late.length} en retard` : `To-do des Mimis — ${due.length} pour aujourd'hui`;

const r = await fetch(`${SERVER}/${encodeURIComponent(TOPIC)}`, {
  method: "POST",
  headers: {
    "Title": "=?utf-8?B?" + Buffer.from(titre, "utf-8").toString("base64") + "?=",
    "Priority": late.length ? "high" : "default",
    "Tags": late.length ? "rotating_light" : "memo",
  },
  body: corps,
});
if (!r.ok) {
  console.error("ntfy a répondu " + r.status + " : " + (await r.text()));
  process.exit(1);
}
console.log(`Notification envoyée : ${late.length} en retard, ${due.length} aujourd'hui.`);
