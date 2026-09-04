#!/usr/bin/env node
/**
 * Cas de référence — couche moteur + contrat HTTP.
 *
 * Les sept scénarios obligatoires fixés par Codex le 11/08/2026 ne vivent pas tous à la même
 * couche (voir docs/matrice-tests.md). Ce harnais couvre ceux qui se démontrent au niveau du
 * moteur interrogé À TRAVERS le Worker — c'est-à-dire à travers le contrat HTTP réel, pas via
 * l'API interne du moteur, pour qu'une régression de sérialisation ou de routage soit visible.
 *
 *   cas 1 — La Compagnie, chien de 32 kg : aucun canal accepté ; cabine et fret refusés par
 *           RÈGLE, soute « à confirmer » depuis que la politique non prouvée ne décide plus
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

/* Même contrat, chemin POST : le corps JSON passe par le schéma Zod sans le parseur de query
 * string. Tester les deux chemins versionne la garantie que leurs contrats CONCORDENT — c'était
 * vérifié à la main lors des lots K et L, donc non durable (remarque Codex, L-bis). */
const postCall = async (payload) => {
  const res = await worker.fetch(
    new Request("https://x/v1/finder", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
    {},
  );
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
    /* CE QUE CE CAS AFFIRMAIT, ET QUI N'EST PLUS VRAI (frontière de confiance, 04/09/2026).
     *
     * Les trois motifs attendus ici — `weight_limit`, `hold_unavailable`, `cargo_unavailable` —
     * supposaient que « soute non proposée » et « fret non proposé » étaient des faits ÉTABLIS.
     * Ils venaient du bloc `policies:` de la fiche, qui ne porte aucune phrase citée : le site
     * affirmait donc une fermeture qu'aucune source ne fonde. C'est exactement ce que le lot
     * ferme, et la disparition de ces motifs est le SIGNE que la fermeture a eu lieu, pas une
     * régression. Le cas fondateur est donc réécrit, pas supprimé — et il vérifie plus qu'avant.
     *
     * Ce qui reste vrai, et qui est le cœur du cas : un chien de 32 kg n'est accepté NULLE PART
     * chez La Compagnie. Ce qui change : la RAISON. La cabine et le fret restent des refus
     * fermes parce qu'ils viennent de RÈGLES (plafond de poids publié), couche que ce lot ne
     * touche pas ; la soute passe « à confirmer » avec sa cause, parce qu'elle ne venait que
     * d'une politique non prouvée.
     *
     * `deny_reasons` est ABSENT dès qu'un canal est à confirmer — comportement d'origine
     * (`explain.ts:363`), antérieur à ce lot : le champ n'est servi que sur un refus total. */
    const st = Object.fromEntries((lc.placement_decisions ?? []).map((d) => [d.placement, d]));
    check("aucun canal n'est « allowed »", ["cabin","hold","cargo"].every((k) => st[k]?.status !== "allowed"),
      JSON.stringify(Object.fromEntries(["cabin","hold","cargo"].map((k) => [k, st[k]?.status]))));
    check("la soute passe « à confirmer » — sa fermeture n'était pas prouvée",
      st.hold?.status === "confirmation_required", JSON.stringify(st.hold));
    check("et elle dit SA cause, sans l'attribuer à la compagnie",
      (st.hold?.confirmation_causes ?? []).some((c) => c.code === "legacy_unreviewed"
        && c.policy_ref === "airline_la_compagnie#hold"), JSON.stringify(st.hold?.confirmation_causes));
    check("cabine et fret restent des refus fermes — ils viennent de RÈGLES, hors périmètre du lot",
      st.cabin?.status === "denied" && st.cargo?.status === "denied",
      `cabin=${st.cabin?.status} cargo=${st.cargo?.status}`);
  }
}

/* ── Cas 7 — entrées invalides : jamais de conclusion positive inventée ──────────────────────
 * L'endpoint a déjà servi un rapport « CDG → Tokyo » à des requêtes que personne n'avait faites
 * (30/07/2026). La règle qui en découle : une requête qu'on ne comprend pas doit produire une
 * ERREUR, jamais un rapport plausible. On vérifie donc l'absence de `verdict` autant que le code
 * HTTP — c'est `verdict` qui fait qu'un corps est traité comme un rapport par le client. */
console.log("\n— Cas 7 : entrées invalides ou inconnues —");
{
  /* Chaque cas exige les TROIS conditions à la fois : HTTP 400, le code d'erreur EXACT, et
   * l'absence de `verdict` (durcissement K-bis, 11/08/2026). La version précédente se
   * contentait de « pas de rapport inventé » : une réponse `200 {}` — ni erreur ni rapport —
   * serait passée, et le contrôle du code d'erreur ne s'appliquait que si le statut n'était
   * pas 200, c'est-à-dire précisément quand il devenait facultatif. */
  const cas = [
    ["requête vide", "", "missing_parameters"],
    ["aéroport de départ inconnu", "origin=airport_zzzzz&destination=airport_cdg&weight_kg=8&breed=breed_golden_retriever", "unknown_airport"],
    ["aéroport d'arrivée inconnu", "origin=airport_cdg&destination=airport_zzzzz&weight_kg=8&breed=breed_golden_retriever", "unknown_airport"],
    ["race inconnue", "origin=airport_cdg&destination=airport_jfk&weight_kg=8&breed=breed_chien_imaginaire", "unknown_breed"],
    ["destination manquante", "origin=airport_cdg&weight_kg=8&breed=breed_golden_retriever", "missing_parameters"],
  ];
  for (const [label, q, expectedError] of cas) {
    const { status, body } = await call(q);
    check(
      `${label} → 400 ${expectedError}, aucun verdict`,
      status === 400 && body?.error === expectedError && body?.verdict === undefined,
      `HTTP ${status}, error=${JSON.stringify(body?.error)}, verdict=${JSON.stringify(body?.verdict)}`,
    );
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
  /* Pour les formats ILLISIBLES, la doc affirme que le paramètre fautif est nommé dans
   * `body.invalid` — on le vérifie donc au contenu exact, pas seulement à l'existence
   * (durcissement K-bis). Les bornes (-5, 0, 121) passent par Zod et n'ont pas ce champ :
   * troisième élément `null` = pas d'exigence sur `invalid`. */
  const invalides = [
    ["vide", "weight_kg=", ["weight_kg="]],
    ["non numérique", "weight_kg=beaucoup", ["weight_kg=beaucoup"]],
    ["NaN", "weight_kg=NaN", ["weight_kg=NaN"]],
    ["infini", "weight_kg=Infinity", ["weight_kg=Infinity"]],
    ["négatif", "weight_kg=-5", null],
    ["nul", "weight_kg=0", null],
    ["au-dessus de 120", "weight_kg=121", null],
  ];
  for (const [label, param, expectedInvalid] of invalides) {
    const { status, body } = await call(`${B}&${param}`);
    const invalidOk = expectedInvalid === null || JSON.stringify(body?.invalid) === JSON.stringify(expectedInvalid);
    check(`poids ${label} → 400 invalid_request, aucun verdict${expectedInvalid ? `, invalid=${JSON.stringify(expectedInvalid)}` : ""}`,
      status === 400 && body?.error === "invalid_request" && body?.verdict === undefined && invalidOk,
      `HTTP ${status}, error=${JSON.stringify(body?.error)}, verdict=${JSON.stringify(body?.verdict)}, invalid=${JSON.stringify(body?.invalid)}`);
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
    check(`température ${label} → 400 invalid_request, aucun verdict, invalid=["${param}"]`,
      status === 400 && body?.error === "invalid_request" && body?.verdict === undefined &&
        JSON.stringify(body?.invalid) === JSON.stringify([param]),
      `HTTP ${status}, error=${JSON.stringify(body?.error)}, verdict=${JSON.stringify(body?.verdict)}, invalid=${JSON.stringify(body?.invalid)}`);
  }
  /* Bornes physiques (lot L, arbitrage Codex du 11/08/2026) : −60 °C à +60 °C, bornes incluses.
   * Une température hors de ce que la Terre inflige à un aéroport commercial est une erreur de
   * saisie ou d'unité — et ce champ déclenche des embargos de chaleur, pas un simple affichage. */
  for (const [label, t] of [["−999 (absurde)", "-999"], ["999 (absurde)", "999"], ["−61 (sous la borne)", "-61"], ["61 (au-dessus)", "61"]]) {
    const { status, body } = await call(`${B}&temperature_c=${t}`);
    check(`température ${label} → 400 invalid_request, aucun verdict`,
      status === 400 && body?.error === "invalid_request" && body?.verdict === undefined,
      `HTTP ${status}, error=${JSON.stringify(body?.error)}`);
  }
  for (const t of ["-60", "60", "30"]) {
    const ok = await call(`${B}&temperature_c=${t}`);
    check(`température ${t} (dans les bornes) → acceptée`, ok.status === 200 && typeof ok.body?.verdict === "string", `HTTP ${ok.status}`);
  }
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

console.log("\n— Le même contrat numérique, chemin POST —");
{
  const base = { origin: "airport_cdg", destination: "airport_jfk", dog: { breed_id: "breed_golden_retriever" } };
  for (const [label, w] of [["négatif (−5)", -5], ["nul (0)", 0], ["au-dessus de 120 (121)", 121]]) {
    const { status, body } = await postCall({ ...base, dog: { ...base.dog, weight_kg: w } });
    check(`POST poids ${label} → 400 invalid_request, aucun verdict`,
      status === 400 && body?.error === "invalid_request" && body?.verdict === undefined,
      `HTTP ${status}, error=${JSON.stringify(body?.error)}`);
  }
  const abs = await postCall(base);
  check("POST poids ABSENT → accepté", abs.status === 200 && typeof abs.body?.verdict === "string", `HTTP ${abs.status}`);

  for (const [label, t, exp] of [["−999 (hors plage)", -999, 400], ["61 (au-dessus)", 61, 400], ["45 (valide)", 45, 200], ["−60 (borne)", -60, 200]]) {
    const { status, body } = await postCall({ ...base, dog: { ...base.dog, weight_kg: 8 }, weather: { temperature_c: t } });
    const ok = exp === 400
      ? status === 400 && body?.error === "invalid_request" && body?.verdict === undefined
      : status === 200 && typeof body?.verdict === "string";
    check(`POST température ${label} → ${exp}`, ok, `HTTP ${status}, error=${JSON.stringify(body?.error)}`);
  }
}

console.log("\n=== SUMMARY ===");
console.log(fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
