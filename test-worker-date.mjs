#!/usr/bin/env node
/**
 * Harnais « le contrat de date tient AUSSI côté serveur, sur les deux verbes et les deux
 * endpoints ».
 *
 * Pourquoi ce fichier existe. La borne des 18 mois est désormais posée à trois endroits : le
 * champ `<input type="date">` du Finder, celui du Finder de destinations, et le schéma
 * `TravelDate` de `@mydogcanfly/knowledge`. Les deux premiers sont du confort d'interface — un
 * `curl`, une page en cache, un lien partagé avec `?date=…` les contournent tous les deux. Seul
 * le troisième fait autorité, et rien ne le vérifiait : le harnais UI prouve que l'interface
 * n'envoie pas de date hors contrat, jamais que le Worker la refuserait si elle arrivait.
 *
 * TROIS PIÈGES DE MÉTHODE, évités par construction :
 *
 * 1. Tester `TravelDate.parse()` directement ne prouverait rien sur le Worker : GET lit la query
 *    string et POST le corps JSON, par deux chemins de code distincts (`finderInputFromQuery()`
 *    d'un côté, `validateJsonIds()` de l'autre). Un `date` oublié dans l'un des deux passerait
 *    inaperçu. Tout scénario passe donc ici par `worker.fetch(new Request(...))`.
 *
 * 2. Un 400 ne prouve pas que c'est la DATE qui a été refusée : origine inconnue, poids absent,
 *    locale invalide produisent le même code. Chaque refus attendu vérifie donc que la réponse
 *    nomme la date, et chaque scénario est bâti sur une requête dont on a préalablement contrôlé
 *    qu'elle passe en 200 SANS date. Sans ce témoin, le fichier virerait au vert le jour où la
 *    requête de base cesserait d'être valide pour une tout autre raison.
 *
 * 3. Les bornes ne sont pas écrites en dur : elles viennent de `travelDateBounds()`, la même
 *    fonction que le schéma. Une date figée (« 2028-02-13 ») deviendrait fausse demain, et le
 *    harnais serait réparé en déplaçant la date plutôt qu'en regardant la règle.
 *
 *   npx tsx test-worker-date.mjs
 */
import worker from "./packages/workers/src/index.ts";
import { travelDateBounds, TRAVEL_DATE_HORIZON_MONTHS } from "./packages/knowledge/src/common.ts";

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log("  OK   " + label); }
  else { fail++; console.log("  FAIL " + label); if (detail) console.log("         reçu : " + detail); }
}

const BASE_GET = "origin=CDG&destination=HND&weight_kg=11&breed=golden_retriever";
const BASE_POST = {
  origin: "airport_cdg",
  destination: "airport_hnd",
  dog: { breed_id: "breed_golden_retriever", weight_kg: 11, brachycephalic: false },
};

/* Le Worker journalise chaque refus (`console.error("/v1/finder error:", e)`, observabilité
   ajoutée à l'audit du 09/08/2026). Ce harnais provoque 19 refus attendus : laisser filer les
   traces noierait les lignes OK/FAIL sous des ZodError. On les capture donc au lieu de les
   supprimer — et on vérifie plus bas qu'elles ont bien été émises, car un refus muet côté
   serveur est un défaut d'exploitation à part entière. */
let logged = [];
async function call(path, { method = "GET", query = "", body } = {}) {
  const vrai = console.error;
  console.error = (...a) => { logged.push(a.map(String).join(" ")); };
  try {
    const res = await worker.fetch(
      new Request(`https://api.mydogcanfly.com${path}${query}`, {
        method,
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      }),
      {},
    );
    return { status: res.status, payload: await res.json(), logs: logged.length };
  } finally {
    console.error = vrai;
  }
}

/** Décale une date ISO de n jours, en UTC. */
function shift(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** La réponse d'erreur nomme-t-elle la date ? (et non « un 400 quelconque est tombé ») */
function blamesDate(payload) {
  const s = JSON.stringify(payload).toLowerCase();
  return s.includes("date");
}

const { min, max } = travelDateBounds();
console.log(`\n=== contrat de date côté Worker — horizon ${TRAVEL_DATE_HORIZON_MONTHS} mois : ${min} → ${max} ===`);

/* -- Témoins : sans date, les deux verbes répondent 200. Tout le reste s'y adosse. -- */
console.log("\n-- témoins (aucune date) --");
{
  const g = await call("/v1/finder", { query: `?${BASE_GET}` });
  check("GET sans date → 200", g.status === 200, `statut ${g.status} · ${JSON.stringify(g.payload).slice(0, 160)}`);
  const p = await call("/v1/finder", { method: "POST", body: BASE_POST });
  check("POST sans date → 200", p.status === 200, `statut ${p.status} · ${JSON.stringify(p.payload).slice(0, 160)}`);
}

/* -- Les deux bornes sont ACCEPTÉES. Une borne exclue fermerait un jour parfaitement valide,
      et c'est le genre d'erreur qu'un test « une date au milieu » ne voit jamais. -- */
console.log("\n-- bornes acceptées --");
for (const [nom, d] of [["min", min], ["max", max]]) {
  const g = await call("/v1/finder", { query: `?${BASE_GET}&date=${d}` });
  check(`GET date=${d} (${nom}) → 200`, g.status === 200, `statut ${g.status} · ${JSON.stringify(g.payload).slice(0, 160)}`);
  const p = await call("/v1/finder", { method: "POST", body: { ...BASE_POST, date: d } });
  check(`POST date=${d} (${nom}) → 200`, p.status === 200, `statut ${p.status} · ${JSON.stringify(p.payload).slice(0, 160)}`);
}

/* -- Hors bornes, des DEUX côtés, sur les deux verbes. -- */
console.log("\n-- hors contrat : refus explicite, jamais un calcul silencieux --");
const HORS = [
  ["min − 1 jour", shift(min, -1)],
  ["max + 1 jour", shift(max, 1)],
  ["date passée", "2020-01-01"],
  ["date lointaine", "2999-12-31"],
];
for (const [nom, d] of HORS) {
  for (const verbe of ["GET", "POST"]) {
    const r = verbe === "GET"
      ? await call("/v1/finder", { query: `?${BASE_GET}&date=${d}` })
      : await call("/v1/finder", { method: "POST", body: { ...BASE_POST, date: d } });
    check(`${verbe} date=${d} (${nom}) → 400`, r.status === 400, `statut ${r.status} · ${JSON.stringify(r.payload).slice(0, 160)}`);
    check(`${verbe} date=${d} : l'erreur nomme la date`, blamesDate(r.payload), JSON.stringify(r.payload).slice(0, 200));
  }
}

/* -- Formes invalides : ce n'est plus la borne qui refuse, c'est `z.string().date()`. Le
      30 février n'existe pas ; `new Date("2026-02-30")` le décalerait pourtant au 2 mars sans
      broncher — d'où ce cas, qui vise précisément le repli permissif. -- */
console.log("\n-- formes invalides --");
const MALFORMEES = [
  ["jour inexistant", "2026-02-30"],
  ["mois inexistant", "2026-13-01"],
  ["format français", "13/08/2026"],
  ["date partielle", "2026-08"],
  ["horodatage", `${min}T00:00:00Z`],
];
for (const [nom, d] of MALFORMEES) {
  for (const verbe of ["GET", "POST"]) {
    const r = verbe === "GET"
      ? await call("/v1/finder", { query: `?${BASE_GET}&date=${encodeURIComponent(d)}` })
      : await call("/v1/finder", { method: "POST", body: { ...BASE_POST, date: d } });
    check(`${verbe} date=${JSON.stringify(d)} (${nom}) → 400`, r.status === 400,
      `statut ${r.status} · ${JSON.stringify(r.payload).slice(0, 160)}`);
  }
}

/* -- Le second endpoint porte la même date, et donc le même contrat : `DestinationsRequest`
      l'avait déjà, mais rien ne le vérifiait. -- */
console.log("\n-- /v1/destinations : même contrat --");
{
  const base = { origin: "airport_cdg", dog: { breed_id: "breed_golden_retriever", weight_kg: 11 } };
  const ok = await call("/v1/destinations", { method: "POST", body: { ...base, date: max } });
  check(`POST /v1/destinations date=${max} (max) → 200`, ok.status === 200,
    `statut ${ok.status} · ${JSON.stringify(ok.payload).slice(0, 160)}`);
  const ko = await call("/v1/destinations", { method: "POST", body: { ...base, date: shift(max, 1) } });
  check(`POST /v1/destinations date=${shift(max, 1)} (max + 1) → 400`, ko.status === 400,
    `statut ${ko.status} · ${JSON.stringify(ko.payload).slice(0, 160)}`);
  check("POST /v1/destinations : l'erreur nomme la date", blamesDate(ko.payload), JSON.stringify(ko.payload).slice(0, 200));
}

/* -- Chaque refus a laissé une trace côté serveur : 19 scénarios refusés — 4 dates hors bornes
      × 2 verbes = 8, 5 formes invalides × 2 verbes = 10, plus 1 sur /v1/destinations. Un refus
      muet ne se voit pas en production. -- */
console.log("\n-- journalisation --");
check(`les 19 refus ont été journalisés par le Worker (obtenu ${logged.length})`, logged.length === 19,
  logged.length ? `dernière trace : ${logged[logged.length - 1].slice(0, 120)}` : "(aucune trace)");

console.log("\n=== SUMMARY ===");
console.log(fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
