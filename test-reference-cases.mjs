#!/usr/bin/env node
/**
 * Cas de référence — couche moteur + contrat HTTP.
 *
 * Les sept scénarios obligatoires fixés par Codex le 11/08/2026 ne vivent pas tous à la même
 * couche (voir docs/matrice-tests.md). Ce harnais couvre ceux qui se démontrent au niveau du
 * moteur interrogé À TRAVERS le Worker — c'est-à-dire à travers le contrat HTTP réel, pas via
 * l'API interne du moteur, pour qu'une régression de sérialisation ou de routage soit visible.
 *
 *   cas 1 — La Compagnie, chien de 32 kg : cabine impossible, soute et fret non proposés
 *   cas 7 — paramètres invalides ou inconnus : aucune conclusion positive inventée
 *
 * Les cas 2, 3, 4, 6 relèvent du DOM construit (harnais fiche et Finder) et le cas 5 des
 * affirmations de vol direct (test-direct-claims.mjs).
 *
 *   npm run test:reference        (équivaut à `tsx test-reference-cases.mjs`)
 */
import worker from "./packages/workers/src/index.ts";

let pass = 0;
let fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         reçu : ${detail}`));
  cond ? pass++ : fail++;
};

const call = async (query) => {
  const res = await worker.fetch(new Request(`https://x/v1/finder?${query}`), {});
  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
};

/* ── Cas 1 — La Compagnie, 32 kg ────────────────────────────────────────────────────────────
 * Le cas fondateur du tour 6 : La Compagnie avait été rejetée à tort de la liste blanche, puis
 * son verdict a servi de référence. Elle n'accepte les chiens ni en soute ni en fret, et son
 * plafond cabine est très inférieur à 32 kg — les trois refus doivent donc apparaître ENSEMBLE.
 * Route réelle de la compagnie : EWR ↔ ORY (ses aéroports, pas une paire arbitraire). */
console.log("— Cas 1 : La Compagnie, chien de 32 kg (EWR → ORY) —");
{
  const { status, body } = await call(
    "origin=airport_ewr&destination=airport_ory&weight_kg=32&breed=breed_golden_retriever&placement=any&locale=en",
  );
  check("la requête aboutit", status === 200, `HTTP ${status}`);
  const lc = (body?.airlines ?? []).find((a) => a.airline_id === "airline_la_compagnie");
  check("La Compagnie figure dans les résultats", !!lc, (body?.airlines ?? []).length + " compagnie(s)");
  if (lc) {
    check("aucun placement accepté (ni cabine, ni soute, ni fret)", !lc.cabin && !lc.hold && !lc.cargo,
      `cabin=${lc.cabin} hold=${lc.hold} cargo=${lc.cargo}`);
    const r = lc.deny_reasons ?? [];
    check("motif « poids au-dessus de la limite publiée »", r.includes("weight_limit"), JSON.stringify(r));
    check("motif « soute non proposée »", r.includes("hold_unavailable"), JSON.stringify(r));
    check("motif « fret non proposé »", r.includes("cargo_unavailable"), JSON.stringify(r));
    check("les trois motifs sont présents ensemble", r.length >= 3, JSON.stringify(r));
  }
}

/* ── Cas 7 — entrées invalides : jamais de conclusion positive inventée ──────────────────────
 * L'endpoint a déjà servi un rapport « CDG → Tokyo » à des requêtes que personne n'avait faites
 * (30/07/2026). La règle qui en découle : une requête qu'on ne comprend pas doit produire une
 * ERREUR, jamais un rapport plausible. On vérifie donc l'absence de `verdict` autant que le code
 * HTTP — c'est `verdict` qui fait qu'un corps est traité comme un rapport par le client. */
console.log("\n— Cas 7 : entrées invalides ou inconnues —");
{
  const cas = [
    ["requête vide", ""],
    ["aéroport de départ inconnu", "origin=airport_zzzzz&destination=airport_cdg&weight_kg=8&breed=breed_golden_retriever"],
    ["aéroport d'arrivée inconnu", "origin=airport_cdg&destination=airport_zzzzz&weight_kg=8&breed=breed_golden_retriever"],
    ["race inconnue", "origin=airport_cdg&destination=airport_jfk&weight_kg=8&breed=breed_chien_imaginaire"],
    ["destination manquante", "origin=airport_cdg&weight_kg=8&breed=breed_golden_retriever"],
  ];
  for (const [label, q] of cas) {
    const { status, body } = await call(q);
    const inventeUnRapport = status === 200 && typeof body?.verdict === "string";
    check(
      `${label} → aucun rapport inventé`,
      !inventeUnRapport,
      `HTTP ${status}, verdict=${JSON.stringify(body?.verdict)}`,
    );
    if (status !== 200) {
      check(`${label} → l'erreur est nommée`, typeof body?.error === "string" && body.error.length > 0, JSON.stringify(body).slice(0, 160));
    }
  }
}

/* Un cas voisin, qui n'est PAS une erreur : une requête valide dont aucune compagnie ne ressort.
 * Elle doit répondre normalement, pas prétendre à un problème d'entrée. */
/* ── Contrat des paramètres numériques — figé par l'arbitrage Codex du 11/08/2026 ────────────
 * Un paramètre ABSENT est légitime (poids ou température inconnus). Un paramètre PRÉSENT mais
 * vide, non numérique, non fini, ≤ 0 ou > 120 (pour le poids) doit répondre 400 `invalid_request`.
 * Avant ce contrat, `weight_kg=beaucoup` était silencieusement abandonné et le moteur rendait un
 * verdict assuré pour un chien sans poids connu — un score différent, aucun signal. Le même défaut
 * touchait `temperature_c`, qui pilote les restrictions de chaleur. */
console.log("\n— Contrat numérique : weight_kg —");
{
  const B = "origin=airport_cdg&destination=airport_jfk&breed=breed_golden_retriever";
  const invalides = [["vide", "weight_kg="], ["non numérique", "weight_kg=beaucoup"], ["NaN", "weight_kg=NaN"],
    ["infini", "weight_kg=Infinity"], ["négatif", "weight_kg=-5"], ["nul", "weight_kg=0"], ["au-dessus de 120", "weight_kg=121"]];
  for (const [label, param] of invalides) {
    const { status, body } = await call(`${B}&${param}`);
    check(`poids ${label} → 400 invalid_request, aucun verdict`,
      status === 400 && body?.error === "invalid_request" && body?.verdict === undefined,
      `HTTP ${status}, error=${JSON.stringify(body?.error)}, verdict=${JSON.stringify(body?.verdict)}`);
  }
  const { status, body } = await call(B);
  check("poids ABSENT → accepté (poids inconnu, cas légitime)",
    status === 200 && typeof body?.verdict === "string", `HTTP ${status}`);
}

console.log("\n— Contrat numérique : temperature_c (pilote les restrictions de chaleur) —");
{
  const B = "origin=airport_cdg&destination=airport_jfk&weight_kg=8&breed=breed_golden_retriever";
  for (const [label, param] of [["vide", "temperature_c="], ["non numérique", "temperature_c=beaucoup"],
    ["NaN", "temperature_c=NaN"], ["infinie", "temperature_c=Infinity"]]) {
    const { status, body } = await call(`${B}&${param}`);
    check(`température ${label} → 400 invalid_request`,
      status === 400 && body?.error === "invalid_request",
      `HTTP ${status}, error=${JSON.stringify(body?.error)}`);
  }
  const ok = await call(`${B}&temperature_c=30`);
  check("température valide → acceptée", ok.status === 200 && typeof ok.body?.verdict === "string", `HTTP ${ok.status}`);
  const abs = await call(B);
  check("température ABSENTE → acceptée", abs.status === 200 && typeof abs.body?.verdict === "string", `HTTP ${abs.status}`);
}

/* PAS un défaut, et mon premier jet le comptait à tort comme tel : une locale inconnue rend en
 * anglais. C'est documenté dans le `note` du contrat (« other schema-valid locales silently render
 * in English ») et ça n'invente aucune conclusion — le verdict reste celui du chien demandé, seule
 * la langue d'affichage change. Le cas 7 interdit d'inventer une réponse, pas de se replier sur
 * une langue par défaut. */
console.log("\n— Locale inconnue : repli documenté en anglais, pas une erreur —");
{
  const { status, body } = await call("origin=airport_cdg&destination=airport_jfk&weight_kg=8&breed=breed_golden_retriever&locale=xx");
  check("locale inconnue → rapport normal (repli anglais)", status === 200 && typeof body?.verdict === "string",
    `HTTP ${status}`);
}

console.log("\n— Contrôle inverse : une requête valide reste une requête valide —");
{
  const { status, body } = await call(
    "origin=airport_cdg&destination=airport_jfk&weight_kg=8&breed=breed_golden_retriever&placement=any&locale=en",
  );
  check("une requête bien formée renvoie 200 et un verdict", status === 200 && typeof body?.verdict === "string",
    `HTTP ${status}, verdict=${JSON.stringify(body?.verdict)}`);
}

console.log("\n=== SUMMARY ===");
console.log(fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
