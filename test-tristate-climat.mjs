#!/usr/bin/env node
/**
 * Harnais du P0 CLIMAT — tri-state, provenance, et interaction avec les règles brachycéphales.
 *
 *   npx tsx test-tristate-climat.mjs
 *
 * Principe vérifié : AUCUNE température estimée ne produit seule un refus dur. Elle produit
 * `confirmation_required` (`allowed=false`) — jamais un canal ouvert, jamais un embargo affirmé.
 *
 * MÉTHODE. Trois niveaux, chacun par son chemin public :
 *   - le CONTRAT (`FinderRequest.safeParse`) : un client ne peut pas déclarer une provenance ;
 *   - le MOTEUR (`evaluate` + `explain`) : statuts, drapeaux, verdicts, dominances ;
 *   - le WORKER (`worker.fetch`) : le refus du contrat est un vrai 400 de bout en bout.
 * Les cas qui n'existent pas dans les données réelles (verdict `conditional` par confirmations
 * seules, domination d'`entry_allowed` sur des confirmations) sont construits par RESTRICTION
 * EN MÉMOIRE de la base réelle (sous-ensemble de compagnies, règle pays ajoutée) — jamais en
 * réimplémentant le moteur, et sans toucher un fichier.
 */
import worker from "./packages/workers/src/index.ts";
import { loadKB, rawKB, normalize } from "./packages/knowledge/src/index.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { explain } from "./packages/engine/src/explain.ts";
import { rankDestinations } from "./packages/engine/src/destinations.ts";
import { FinderRequest, DestinationsRequest } from "./packages/engine/src/contracts.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

const kb = loadKB();

/* ── UNE PREUVE CITÉE, POUR QUE LES TÉMOINS RESTENT DES TÉMOINS ────────────────────────────────
 *
 * Depuis la frontière de confiance (04/09/2026), une politique ne produit `allowed` que si sa
 * provenance porte une phrase citée, sa langue et son emplacement. Aucune des 302 politiques
 * réelles n'en porte : sur la KB telle quelle plus AUCUN canal n'est `allowed`, et six contrôles
 * de ce harnais — tri, verdict, dominance — perdaient leur témoin. Un témoin qui ne peut plus se
 * déclencher ne prouve plus rien : il fallait le rétablir, pas l'abaisser.
 *
 * ON CITE DONC LA SOURCE, ET ON LAISSE LA PROJECTION DÉCIDER. La première version de ce bloc
 * forçait `status: "allowed"` sur la politique déjà projetée : elle contournait exactement le
 * mécanisme qu'elle prétendait exercer, et rouvrait même des canaux refusés. On repart donc de
 * la donnée d'AUTEUR — `rawKB` — à laquelle on ajoute une citation, et c'est
 * `projectPlacementPolicy` qui en tire le statut, comme en production.
 *
 * La citation est fictive et le dit. Ce qui est vrai ici, et vérifié, c'est le MÉCANISME : une
 * politique pourvue d'une preuve complète décide encore ; sans elle, elle ne décide plus. `kb`
 * (non citée) reste la KB réelle et sert à tous les contrôles sur données réelles.
 */
const kbCitee = (() => {
  const brut = JSON.parse(JSON.stringify(rawKB));
  for (const a of brut.airlines ?? []) {
    const pol = a?.premium?.policy;
    if (!pol) continue;
    for (const d of Object.values(pol)) {
      /* TOUTES les provenances sont citées ici, y compris les dérivées, et `source_derived` est
         retiré avec elles : cette KB est SYNTHÉTIQUE et n'existe que pour rendre aux contrôles de
         tri et de verdict une population `allowed` à ordonner. Se limiter aux 35 provenances non
         fabriquées ne produisait aucune soute autorisée sur CDG→IST — le témoin restait mort.
         Ce n'est pas une preuve fabriquée : rien ici n'est publié, et la démonstration que seule
         une preuve citée décide vit dans `test-frontiere-confiance.mjs`, sur la KB réelle. */
      if (!d?.source) continue;
      delete d.source_derived;
      d.source.quote = "Pets are accepted on this route, subject to the conditions below.";
      d.source.quote_language = "en";
      d.source.locator = "section « Travelling with pets », paragraphe 1";
    }
  }
  return normalize(brut);
})();
/* ── CITER UNE RÈGLE, AU SCALPEL (05/09/2026) ──────────────────────────────────────────────────
 *
 * La frontière de confiance s'applique désormais AUX RÈGLES : une règle non citée ne refuse plus
 * rien, même munie d'une URL officielle — y compris les six règles `summer_embargo`, qui portent
 * toutes une URL et aucune phrase. Neuf contrôles de ce harnais reposaient sur le refus produit
 * par une de ces règles : leur TÉMOIN est mort, pas leur propriété. Les abaisser aurait effacé la
 * démonstration ; on rend donc à chacun la règle citée dont sa propre affirmation a besoin.
 *
 * AU SCALPEL, et non « toutes les règles » : chaque contrôle nomme les identifiants qu'il cite,
 * pour qu'aucun ne devienne vert par une preuve qu'il n'a pas demandée. La citation est fictive et
 * le dit ; ce qui est vérifié ici est le MÉCANISME. La démonstration inverse — sans citation, rien
 * ne refuse — se fait sur `kb`, la base réelle, juste à côté de chaque témoin.
 */
const citerRegles = (...ids) => {
  const brut = JSON.parse(JSON.stringify(rawKB));
  const vus = new Set();
  for (const r of brut.rules ?? []) {
    if (!ids.includes(r.id) || !r.source) continue;
    vus.add(r.id);
    r.source.quote = "Fictitious quotation, harness only — exercises the citation mechanism.";
    r.source.quote_language = "en";
    r.source.locator = "section « harnais », paragraphe 1";
  }
  const manquants = ids.filter((i) => !vus.has(i));
  if (manquants.length) throw new Error(`citerRegles : règle(s) introuvable(s) — ${manquants.join(", ")}`);
  return normalize(brut);
};

/* Date DYNAMIQUE (contre-revue v3, corrigée en v7 sur la contre-revue v6) : le PROCHAIN 15
   juillet, comparé sur la date complète — la version par mois seul choisissait le 15 juillet de
   l'année SUIVANTE quand on était entre le 1er et le 14 juillet, cinq jours avant le bon. */
const _now = new Date();
const _y = _now.getUTCFullYear();
const _today = Date.UTC(_y, _now.getUTCMonth(), _now.getUTCDate());
const _july15 = Date.UTC(_y, 6, 15);
const JUILLET = `${_today <= _july15 ? _y : _y + 1}-07-15`;
const GOLDEN = { breed_id: "breed_golden_retriever", weight_kg: 25 };
const CARLIN = { breed_id: "breed_pug", weight_kg: 8 };
const stOf = (dec, airlineId, pl) =>
  dec.airlines.find((a) => a.airline_id === airlineId)?.placements.find((p) => p.placement === pl);

console.log("=== 1. Le contrat refuse toute provenance venue du client ===");
{
  const base = { origin: "airport_cdg", destination: "airport_ist", dog: GOLDEN };
  check("weather.temperature_c seul accepté",
    FinderRequest.safeParse({ ...base, weather: { temperature_c: 35 } }).success);
  check("weather.provenance REFUSÉ (strict)",
    !FinderRequest.safeParse({ ...base, weather: { temperature_c: 35, provenance: "sourced" } }).success);
  check("toute clé inconnue dans weather refusée",
    !FinderRequest.safeParse({ ...base, weather: { temperature_c: 35, sourced: true } }).success);
}

console.log("\n=== 2. Le Worker refuse en 400, de bout en bout ===");
{
  const post = async (body) => {
    const vrai = console.error; console.error = () => {};
    try {
      const res = await worker.fetch(new Request("https://api.mydogcanfly.com/v1/finder", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      }), {});
      return { status: res.status, payload: await res.json() };
    } finally { console.error = vrai; }
  };
  const base = { origin: "airport_cdg", destination: "airport_ist", dog: GOLDEN };
  const ok = await post({ ...base, weather: { temperature_c: 35 } });
  check("POST weather valide → 200", ok.status === 200, `statut ${ok.status}`);
  const ko = await post({ ...base, weather: { temperature_c: 35, provenance: "sourced" } });
  check("POST weather.provenance → 400", ko.status === 400, `statut ${ko.status} · ${JSON.stringify(ko.payload).slice(0, 120)}`);
}

console.log("\n=== 3. Provenance posée par le serveur ===");
{
  const est = evaluate(kb, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ist", dog: GOLDEN, date: JUILLET }));
  check("sans météo fournie : provenance estimated_region", est.climate.provenance === "estimated_region", est.climate.provenance);
  const vis = evaluate(kb, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ist", dog: GOLDEN, date: JUILLET, weather: { temperature_c: 35 } }));
  check("météo fournie : provenance visitor_input", vis.climate.provenance === "visitor_input", vis.climate.provenance);
  const opt = evaluate(kb, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ist", dog: GOLDEN, date: JUILLET, weather: { temperature_c: 35 } }), { weatherProvenance: "estimated_latitude" });
  check("option interne : provenance estimated_latitude", opt.climate.provenance === "estimated_latitude", opt.climate.provenance);
}

console.log("\n=== 4. Tri-state : estimation → confirmation_required ; fournie → denied ===");
// CDG → IST en juillet : région Asia, 34 °C estimés — au-dessus du seuil de 30. Turkish porte
// `rule_tk_summer_embargo`. Témoin de non-vacuité : la règle doit s'être déclenchée.
{
  const est = evaluate(kb, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ist", dog: GOLDEN, date: JUILLET }));
  const tk = est.airlines.find((a) => a.airline_id === "airline_turkish");
  check("Turkish est candidate (témoin de non-vacuité)", !!tk);
  check("la règle d'embargo s'est déclenchée (témoin)", tk?.fired.some((f) => f.rule_id === "rule_tk_summer_embargo"),
    tk?.fired.map((f) => f.rule_id).join(", "));
  for (const pl of ["hold", "cargo"]) {
    const p = stOf(est, "airline_turkish", pl);
    check(`estimation : ${pl} = confirmation_required, allowed=false`,
      p?.status === "confirmation_required" && p?.allowed === false, JSON.stringify(p));
  }
  const rep = explain(est, "fr");
  const tkr = rep.airlines.find((a) => a.airline_id === "airline_turkish");
  check("rapport : hold_status/cargo_status = confirmation_required",
    tkr?.hold_status === "confirmation_required" && tkr?.cargo_status === "confirmation_required",
    JSON.stringify({ h: tkr?.hold_status, c: tkr?.cargo_status }));
  check("rapport : booléens hold/cargo = false (jamais rendus disponibles)",
    tkr?.hold === false && tkr?.cargo === false);
  check("rapport : to_confirm liste les canaux", (tkr?.to_confirm ?? []).includes("hold") && (tkr?.to_confirm ?? []).includes("cargo"),
    JSON.stringify(tkr?.to_confirm));
  check("rapport : heat_confirmation_required=true, heat_embargo=false",
    tkr?.heat_confirmation_required === true && tkr?.heat_embargo === false);
  check("rapport : compatible[] ne contient AUCUN canal à confirmer de Turkish",
    !rep.compatible.some((c) => c.airline_id === "airline_turkish" && (c.placement === "hold" || c.placement === "cargo")));
  check("climat du rapport : confirmation_required=true, embargo=false",
    rep.climate?.confirmation_required === true && rep.climate?.embargo === false, JSON.stringify(rep.climate));

  /* MOUVEMENT NOMMÉ (05/09/2026) — la frontière de confiance s'applique aussi au climat.
     Ce bloc affirmait « température fournie ⇒ refus ». La température fournie garde bien son
     effet, mais elle ne suffit pas : encore faut-il que la RÈGLE d'embargo soit prouvée. Les six
     règles `summer_embargo` du dépôt ont une URL officielle et aucune phrase citée — sur la base
     RÉELLE, 35° fournis ne referment donc plus rien. Le contrôle est dédoublé : le mécanisme sur
     une règle citée, la base réelle telle qu'elle est. */
  const visCite = evaluate(citerRegles("rule_tk_summer_embargo"),
    FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ist", dog: GOLDEN, date: JUILLET, weather: { temperature_c: 35 } }));
  for (const pl of ["hold", "cargo"]) {
    const p = stOf(visCite, "airline_turkish", pl);
    check(`règle CITÉE + température FOURNIE (35) : ${pl} = denied — la donnée fournie garde son effet`,
      p?.status === "denied" && p?.allowed === false, JSON.stringify(p));
  }
  const repVCite = explain(visCite, "fr");
  check("règle citée, température fournie : climat.embargo=true, confirmation_required=false",
    repVCite.climate?.embargo === true && repVCite.climate?.confirmation_required === false, JSON.stringify(repVCite.climate));

  const vis = evaluate(kb, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ist", dog: GOLDEN, date: JUILLET, weather: { temperature_c: 35 } }));
  for (const pl of ["hold", "cargo"]) {
    const p = stOf(vis, "airline_turkish", pl);
    check(`règle NON CITÉE + température fournie (35) : ${pl} ne refuse PAS — il demande confirmation`,
      p?.status === "confirmation_required" && p?.allowed === false, JSON.stringify(p));
    check(`…et la cause nomme sa règle (climate_rule_unquoted)`,
      (p?.confirmation_causes ?? []).some((c) => c.code === "climate_rule_unquoted" && c.rule_id === "rule_tk_summer_embargo"),
      JSON.stringify(p?.confirmation_causes));
  }
  const repV = explain(vis, "fr");
  /* Le bandeau suit : il n'AFFIRME plus une suspension qu'aucune règle prouvée n'impose. Il ne
     bascule pas non plus en « chaleur estimée » — la température, elle, est certaine. */
  check("règle non citée, température fournie : climat.embargo=FALSE (rien n'est affirmé)",
    repV.climate?.embargo === false, JSON.stringify(repV.climate));
  check("…et aucune carte ne porte heat_embargo",
    repV.airlines.every((a) => a.heat_embargo === false));
  const froid = evaluate(kbCitee, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ist", dog: GOLDEN, date: JUILLET, weather: { temperature_c: 20 } }));
  const pFroid = stOf(froid, "airline_turkish", "hold");
  check("température fournie SOUS le seuil (20) : hold = allowed (l'embargo ne se déclenche pas)",
    pFroid?.status === "allowed", JSON.stringify(pFroid));
}

console.log("\n=== 5. Dominance : denied > confirmation_required — interaction P0 climat / P0-B brachy ===");
/* Un carlin sur la même route. Turkish garde SA règle brachycéphale — sourcée sur
 * `turkishairlines.com`, elle n'était pas dans les 42 auto-citées retirées en T0-B3-b : soute et
 * fret restent donc fermés en dur, et l'embargo estimé ne les rouvre pas.
 *
 * LA SENTINELLE P0-B A JOUÉ (13/08/2026 → 17/08/2026). Elle annonçait : « quand P0-B requalifiera
 * ces règles, des confirmations climatiques APPARAÎTRONT pour les brachycéphales — ce contrôle
 * échouera alors, et c'est voulu ». Elle a bien échoué, et la re-mesure exigée donne un résultat
 * DIFFÉRENT de celui qu'elle anticipait :
 *
 *   confirmations sur CDG→IST, carlin, juillet   0 / 60  →  24 / 60
 *   dont de cause CLIMATIQUE                     0       →  0
 *
 * Aucune confirmation climatique n'apparaît. Les 24 nouvelles ont pour cause la RACE
 * (`breed_policy_unreviewed`), pas la chaleur — et la chaleur, elle, ne se déclenche pas sur cette
 * route parce que le modèle région donne 28 °C, sous le seuil. La sentinelle comptait TOUTES les
 * confirmations sous l'étiquette « climatique » : tant que la réponse était zéro, la confusion ne
 * se voyait pas. Elle compte désormais ce qu'elle annonce — la cause `estimated_climate`. */
{
  const est = evaluate(kb, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ist", dog: CARLIN, date: JUILLET }));
  /* MOUVEMENT NOMMÉ — LA FRONTIÈRE S'APPLIQUE AUX RÈGLES (05/09/2026).
   *
   * `rule_tk_brachy_hold` fermait la soute et le fret d'un carlin. Elle n'est pas citée : elle ne
   * décide donc plus, et les deux canaux passent « à confirmer » en NOMMANT la règle. Le visiteur
   * n'est pas laissé sans rien — l'avis de sécurité brachycéphale, lui, reste publié, et la cause
   * `breed_policy_unreviewed` dit que notre donnée de race n'a pas été revérifiée. */
  for (const pl of ["hold", "cargo"]) {
    const p = stOf(est, "airline_turkish", pl);
    check(`carlin : ${pl} n'est plus refusé sur une règle non citée`,
      p?.status === "confirmation_required", JSON.stringify(p?.status));
    check(`carlin : ${pl} NOMME la règle de race qui le fermait`,
      (p?.confirmation_causes ?? []).some((c) => c.code === "rule_official_unquoted" && c.rule_id === "rule_tk_brachy_hold"),
      JSON.stringify((p?.confirmation_causes ?? []).map((c) => c.code)));
  }
  const tousLesCanaux = est.airlines.flatMap((a) => a.placements);
  const confirmations = tousLesCanaux.filter((p) => p.status === "confirmation_required");
  const climatiques = confirmations.filter((p) =>
    (p.confirmation_causes ?? []).some((c) => c.code === "estimated_climate")).length;
  const race = confirmations.filter((p) =>
    (p.confirmation_causes ?? []).some((c) => c.code === "breed_policy_unreviewed")).length;
  /* CE CONTRÔLE REPOSAIT SUR UNE PRÉMISSE FAUSSE, ET LE MASQUAGE LA CACHAIT.
   *
   * Il affirmait « 28 °C estimés, sous le seuil » et exigeait zéro confirmation climatique. La
   * température estimée sur cette route en juillet est de 34 °C — AU-DESSUS du seuil de 30 que
   * `rule_tk_summer_embargo` exige. La règle se déclenchait donc depuis toujours ; son effet était
   * simplement ÉTEINT par le refus de race, qui dominait. En cessant de refuser sur une règle non
   * citée, on ne crée pas ces confirmations : on cesse de les cacher.
   *
   * C'est le meilleur argument pour la fermeture demandée : un refus non prouvé ne masquait pas
   * seulement son absence de preuve, il masquait aussi un vrai signal de chaleur. */
  check("carlin : les confirmations climatiques apparaissent — elles étaient MASQUÉES par le refus de race",
    climatiques === 8, `${climatiques} confirmation(s) climatique(s) — 34 °C estimés, seuil 30`);
  /* 28/08/2026 — lecture directe Codex sur IAG Cargo : « Some dangerous dog breeds and snub
   * nosed breeds … MAY not be accepted », au cas par cas via l'agent animalier. Le refus
   * catégorique rule_ba_brachy_hold était donc faux : supprimé, remplacé par un avis warn
   * sourcé (brest_ba_iag_snub_nose_case_by_case). Le cargo BA d'un brachycéphale passe de
   * « denied » à « confirmation_required[breed_policy_unreviewed] » : 24 → 25. Compte figé,
   * mouvement nommé — toute bascule non documentée doit toujours rougir. */
  /* MOUVEMENT NOMMÉ (frontière de confiance, 04/09/2026) : 25 → 44 confirmations, dont 27 de
   * race. Les 25 d'origine étaient TOUTES de cause raciale, parce qu'aucune autre cause ne
   * pouvait exister : les politiques décidaient sans preuve. Depuis, une politique sans phrase
   * citée passe « à confirmer » et apporte sa propre cause — d'où 17 confirmations de PROVENANCE
   * qui n'existaient pas, et 2 canaux de race de plus (leur politique ne les refuse plus en dur).
   * Les causes S'ACCUMULENT — c'est le contrat, et aucune ne masque l'autre : les 44 portent une
   * cause de provenance, et 27 d'entre elles portent EN PLUS la cause raciale. La première
   * rédaction de ce contrôle les croyait exclusives et attendait 17 ; elle décrivait un contrat
   * qui n'a jamais existé.
   * La propriété testée n'a pas bougé d'un pouce : AUCUNE confirmation n'est de cause climatique,
   * et toute confirmation dit laquelle des deux incertitudes la porte. Compte figé, mouvement
   * nommé — toute bascule non documentée doit toujours rougir. */
  const provenance = confirmations.filter((p) =>
    (p.confirmation_causes ?? []).some((c) => c.code === "legacy_unreviewed" || c.code === "official_source_unquoted")).length;
  /* 44 → 59, et 27 → 40 de race : les canaux que la règle de race fermait rejoignent les
     confirmations, en disant pourquoi. Aucune n'est inexpliquée. */
  check("carlin : 59 confirmations — toutes de provenance, 40 aussi de race, aucune inexpliquée",
    confirmations.length === 59 && provenance === 59 && race === 40,
    `${confirmations.length} confirmation(s), dont ${race} de race et ${provenance} de provenance, sur ${tousLesCanaux.length} canaux`);
}

console.log("\n=== 6. Verdict : règle exacte, par restriction en mémoire ===");
/* Sur les données réelles, aucun cas ne produit « conditional par confirmations seules » (mesuré,
 * y compris par Codex sur les quatre préférences). La règle se teste donc sur une base RESTREINTE :
 * mêmes données, seule Turkish reste candidate. */
{
  const kbTK = { ...kbCitee, airlines: new Map([...kbCitee.airlines].filter(([id]) => id === "airline_turkish")) };
  const dec = evaluate(kbTK, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ist", dog: GOLDEN, date: JUILLET, placement: "hold" }));
  const rep = explain(dec, "fr");
  check("placement=hold, seul canal à confirmer → verdict CONDITIONAL", rep.verdict === "conditional", rep.verdict);
  /* Petit chien : la cabine de Turkish est fermée au POIDS pour un golden de 25 kg — le témoin
     « cabin_status=allowed » serait faux pour une raison sans rapport avec le verdict testé. */
  const decC = evaluate(kbTK, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ist", dog: { weight_kg: 5 }, date: JUILLET, placement: "cabin" }));
  const repC = explain(decC, "fr");
  /* Renforcée (contre-revue v3) : l'ancienne forme « pas conditional OU une confirmation existe »
     était satisfiable par presque tout. On épingle la RÈGLE : la cabine est allowed, donc le
     verdict suit la voie « allowed » — conditional UNIQUEMENT par les formalités, jamais par la
     confirmation de la soute, et jamais incompatible. */
  check("placement=cabin : cabin_status=allowed (témoin)", repC.airlines[0]?.cabin_status === "allowed",
    repC.airlines[0]?.cabin_status);
  check("placement=cabin : verdict par la voie « allowed » — exactement (formalités ? conditional : compatible)",
    repC.verdict === (repC.conditions.length > 0 ? "conditional" : "compatible"),
    `verdict ${repC.verdict}, ${repC.conditions.length} formalité(s)`);
  /* entry_allowed=false DOMINE : même base restreinte, une règle pays deny ajoutée en mémoire. */
  const banRule = {
    id: "rule_test_entry_ban", scope: { type: "country", id: "country_tr" }, category: "import_rules",
    criticality: "critical", applies_when: { fact: "dog.weight_kg", op: "gt", value: 0 },
    effect: { action: "deny" }, params: {},
    rationale: "règle de TEST — interdiction d'entrée synthétique", rationale_i18n: {},
    source: { url: "https://example.org/test", source_type: "other", verified_date: "2026-08-13", review_due: "2027-02-13", confidence: 1, reviewer: "test", history: [] },
  };
  const kbBan = { ...kbTK, rules: [...kbTK.rules, banRule] };
  const decBan = evaluate(kbBan, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ist", dog: GOLDEN, date: JUILLET, placement: "hold" }));
  check("entry_allowed=false (témoin)", decBan.destination.entry_allowed === false);
  const repBan = explain(decBan, "fr");
  check("entrée interdite : INCOMPATIBLE, quoi qu'en disent les confirmations", repBan.verdict === "incompatible", repBan.verdict);
  check("entrée interdite : plus aucun statut à confirmer (denied partout)",
    repBan.airlines.every((a) => a.cabin_status === "denied" && a.hold_status === "denied" && a.cargo_status === "denied"));
  check("entrée interdite : score = 0", repBan.score === 0, String(repBan.score));
}

console.log("\n=== 7. Destinations : statuts, fret émis, inclusion en alternative ===");
{
  const dest = rankDestinations(kb, DestinationsRequest.parse({ origin: "airport_cdg", dog: GOLDEN, date: JUILLET, locale: "fr" }));
  check("aucune destination ne porte heat_embargo=true (température toujours estimée ici)",
    dest.matches.every((m) => m.heat_embargo === false));
  const mia = dest.matches.find((m) => m.iata === "MIA");
  check("Miami est INCLUSE en juillet (elle disparaissait avant ce lot)", !!mia);
  check("Miami : aucune compagnie confirmée, ≥1 à confirmer",
    mia?.airlines_total === 0 && (mia?.airlines_to_confirm_total ?? 0) > 0,
    JSON.stringify({ t: mia?.airlines_total, c: mia?.airlines_to_confirm_total }));
  check("Miami : placement_ok=false, placement_to_confirm=true — jamais rendue disponible",
    mia?.placement_ok === false && mia?.placement_to_confirm === true);
  check("Miami : heat_confirmation_required=true", mia?.heat_confirmation_required === true);
  /* Abou Dabi — mis à jour par T0-B2 (bascule APPROUVÉE, tracée au registre de migration).
   *
   * `airline_etihad.cargo` est l'un des 73 couples du manifeste : sa disponibilité n'a jamais été
   * revérifiée sur source officielle. Le fret passe donc d'`allowed` à `confirmation_required`,
   * et la destination cesse d'être présentée comme disponible par un canal dont nous ne savons
   * rien. Ce que ce contrôle protège n'a pas changé — le fret reste ÉMIS, jamais invisible — mais
   * il vérifie en plus, désormais, que la cause est nommée et rattachée à sa politique. */
  const auh = dest.matches.find((m) => m.iata === "AUH");
  check("Abou Dabi : cargo_status ÉMIS — le fret n'est jamais invisible",
    auh?.cargo_status === "confirmation_required",
    JSON.stringify({ st: auh?.cargo_status, ok: auh?.cargo_ok, cab: auh?.cabin_ok, hold: auh?.hold_ok }));
  check("Abou Dabi : aucun canal ouvert, la destination est À CONFIRMER — jamais « disponible »",
    auh?.placement_ok === false && auh?.placement_to_confirm === true
    && auh?.cabin_ok === false && auh?.hold_ok === false && auh?.cargo_ok === false);
  check("Abou Dabi : la cause est NOTRE donnée non revérifiée, avec sa politique nommée",
    auh?.confirmation_signals?.some((s) => s.airline_id === "airline_etihad" && s.placement === "cargo"
      && s.cause?.code === "legacy_unreviewed" && s.cause?.policy_ref === "airline_etihad#cargo"),
    JSON.stringify(auh?.confirmation_signals));
  check("Abou Dabi : AUCUN drapeau chaleur — la cause n'est pas climatique",
    auh?.heat_embargo === false && auh?.heat_confirmation_required === false);
  const statuses = ["allowed", "denied", "confirmation_required"];
  check("tous les statuts émis sont valides",
    dest.matches.every((m) => [m.cabin_status, m.hold_status, m.cargo_status].every((s) => statuses.includes(s))));
  check("booléens *_ok vrais UNIQUEMENT pour allowed",
    dest.matches.every((m) => (m.cabin_ok === (m.cabin_status === "allowed")) && (m.hold_ok === (m.hold_status === "allowed")) && (m.cargo_ok === (m.cargo_status === "allowed"))));
}

console.log("\n=== 7 bis. climate.embargo dérive des RÈGLES, pas du seuil (contre-revue v3) ===");
{
  /* Température FOURNIE de 35° avec, par RESTRICTION EN MÉMOIRE, une seule compagnie candidate
     qui ne porte AUCUNE règle summer_embargo (Emirates) : rien n'a été suspendu, le bandeau ne
     doit pas l'affirmer. Le réseau réel ne fournit pas ce cas proprement — Turkish est candidate
     (en correspondance) sur presque toutes les routes et déclenche sa règle. */
  const kbEK = { ...kb, airlines: new Map([...kb.airlines].filter(([id]) => id === "airline_emirates")) };
  const dec = evaluate(kbEK, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_dxb", dog: GOLDEN, date: JUILLET, weather: { temperature_c: 35 } }));
  check("témoin : aucune règle summer_embargo déclenchée",
    !dec.airlines.some((a) => a.fired.some((f) => f.category === "summer_embargo")));
  const rep = explain(dec, "fr");
  check("35° fournis, aucune règle déclenchée : climate.embargo=FALSE (le seuil seul ne suffit plus)",
    rep.climate?.embargo === false, JSON.stringify(rep.climate));
  check("et aucune carte ne porte heat_embargo", rep.airlines.every((a) => !a.heat_embargo));
}

console.log("\n=== 7 ter. Tri : l'accepté RÉEL passe avant le « à confirmer » (contre-revue v3) ===");
{
  const est = evaluate(kbCitee, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ist", dog: GOLDEN, date: JUILLET }));
  const rep = explain(est, "fr");
  const premierConfirmSeul = rep.airlines.findIndex((a) => !a.cabin && !a.hold && !a.cargo && (a.to_confirm?.length ?? 0) > 0);
  const dernierAccepte = rep.airlines.map((a, i) => (a.cabin || a.hold || a.cargo ? i : -1)).reduce((x, y) => Math.max(x, y), -1);
  if (premierConfirmSeul !== -1 && dernierAccepte !== -1) {
    check("toute compagnie RÉELLEMENT acceptante précède toute compagnie « à confirmer seulement »",
      dernierAccepte < premierConfirmSeul,
      `dernier accepté à l'index ${dernierAccepte}, premier à-confirmer-seul à ${premierConfirmSeul}`);
  } else {
    check("témoin : le cas de tri existe sur cette route", false, `confirmSeul=${premierConfirmSeul} accepte=${dernierAccepte}`);
  }
}

console.log("\n=== 7 quater. Bandeau ⇔ cartes : l'embargo affiché a toujours une carte marquée (contre-revue v4) ===");
{
  /* kbTK + 35° fournis : Turkish a la cabine fermée au POIDS et la soute/le fret par l'embargo.
     La v4 démarquait la carte (garde « seule raison ») pendant que le bandeau affirmait « les
     compagnies concernées sont marquées ». L'invariant est désormais structurel. */
  /* MOUVEMENT NOMMÉ (05/09/2026) : les DEUX règles que ce témoin invoque sont désormais citées.
     Depuis la frontière côté règles, ni `rule_tk_cabin_weight` ni `rule_tk_summer_embargo` — URL
     officielle, aucune phrase — ne referme quoi que ce soit sur la base réelle : le témoin
     n'avait plus ni cabine fermée au poids, ni embargo à marquer. L'invariant qu'il défend, lui,
     est intact : quand le bandeau AFFIRME un embargo, une carte au moins doit le porter. */
  const kbCiteeTK = citerRegles("rule_tk_cabin_weight", "rule_tk_summer_embargo");
  const kbTK = { ...kbCiteeTK, airlines: new Map([...kbCiteeTK.airlines].filter(([id]) => id === "airline_turkish")) };
  const dec = evaluate(kbTK, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ist", dog: GOLDEN, date: JUILLET, weather: { temperature_c: 35 } }));
  const rep = explain(dec, "fr");
  /* v7 (contre-revue v6) : la disjonction « OU cabine fermée » rendait le témoin vert même si le
     motif `weight_limit` disparaissait — le libellé affirme le POIDS, la preuve exige le motif. */
  check(
    "témoin : la cabine est fermée pour une AUTRE cause (poids)",
    (rep.airlines[0]?.deny_reasons ?? []).includes("weight_limit"),
    JSON.stringify(rep.airlines[0]?.deny_reasons),
  );
  check("climate.embargo=true (règle déclenchée sur température fournie)", rep.climate?.embargo === true, JSON.stringify(rep.climate));
  check("…ET la carte est marquée heat_embargo — le bandeau tient sa promesse",
    rep.airlines.some((a) => a.heat_embargo === true), JSON.stringify(rep.airlines.map((a) => ({ id: a.airline_id, he: a.heat_embargo }))));
}

console.log("\n=== 7 quinquies. Tri par PLACEMENT DEMANDÉ — 5 kg, soute ET fret (contre-revues v4 et v6) ===");
{
  /* v7 : le harnais versionné n'exerçait que la soute, avec un golden de 25 kg dont la cabine
     est fermée au poids — la contre-épreuve indépendante de Codex utilisait un chien de 5 kg et
     couvrait aussi le fret. La CI fige désormais ce résultat (aujourd'hui : 12 autorisées puis
     4 à confirmer, sur les deux canaux) au lieu de dépendre d'une mesure ponctuelle. */
  for (const canal of ["hold", "cargo"]) {
    const dec = evaluate(kbCitee, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ist", dog: { weight_kg: 5 }, date: JUILLET, placement: canal }));
    const rep = explain(dec, "fr");
    const ok = rep.airlines.map((a, i) => ((canal === "hold" ? a.hold : a.cargo) ? i : -1)).filter((i) => i >= 0);
    const confirm = rep.airlines.map((a, i) => ((canal === "hold" ? a.hold_status : a.cargo_status) === "confirmation_required" ? i : -1)).filter((i) => i >= 0);
    check(`${canal} : population « autorisée » non vide`, ok.length > 0, `${ok.length}`);
    check(`${canal} : population « à confirmer » non vide`, confirm.length > 0, `${confirm.length}`);
    if (ok.length && confirm.length) {
      check(`${canal} : TOUTE autorisation précède TOUTE confirmation (${ok.length} puis ${confirm.length})`,
        Math.max(...ok) < Math.min(...confirm),
        `dernier autorisé à ${Math.max(...ok)}, premier à confirmer à ${Math.min(...confirm)}`);
    }
  }
}

console.log("\n=== 7 sexies. Entrée interdite : le bandeau ne survit pas aux cartes (contre-revue v5) ===");
{
  /* Le cas exact de la contre-épreuve : American Pit Bull Terrier JFK→CDG, 35° fournis. La France
     interdit l'entrée de la race ; toutes les cartes sont démarquées par `entryAllowed` — le
     bandeau ne peut donc plus affirmer un embargo. Et l'invariant est GLOBAL : bandeau ⇔ cartes,
     par dérivation directe. */
  const dec = evaluate(kb, FinderRequest.parse({
    origin: "airport_jfk", destination: "airport_cdg",
    dog: { breed_id: "breed_american_pit_bull_terrier", weight_kg: 25 },
    date: JUILLET, weather: { temperature_c: 35 },
  }));
  check("témoin : l'entrée est interdite", dec.destination.entry_allowed === false);
  check("témoin : une règle summer_embargo s'est pourtant déclenchée quelque part",
    dec.airlines.some((a) => a.fired.some((f) => f.category === "summer_embargo")));
  const rep = explain(dec, "fr");
  check("verdict incompatible", rep.verdict === "incompatible", rep.verdict);
  check("AUCUNE carte marquée heat_embargo (entryAllowed les démarque toutes)",
    rep.airlines.every((a) => a.heat_embargo !== true));
  check("et le bandeau suit : climate.embargo=FALSE", rep.climate?.embargo === false, JSON.stringify(rep.climate));
  check("INVARIANT GLOBAL : climate.embargo === (≥1 carte heat_embargo)",
    (rep.climate?.embargo ?? false) === rep.airlines.some((a) => a.heat_embargo === true));
}

console.log("\n=== 8. INVARIANT sur données réelles : le drapeau ne ment jamais (contre-épreuve Codex v2) ===");
/* La contre-revue v2 l'a démontré : un drapeau dérivé du seul seuil de température annonçait
 * « à confirmer » sur 53 destinations d'un carlin dont AUCUN canal n'était à confirmer. L'invariant
 * est désormais testé sur le balayage RÉEL, pas sur des fixtures : pour chaque destination,
 * `heat_confirmation_required` ⇔ ≥1 confirmation réelle dans les statuts recalculés par le moteur
 * sous la température de l'outil. Deux chiens — le carlin est le cas qui mentait. */
for (const [dogLabel, dog] of [["golden", GOLDEN], ["carlin", CARLIN]]) {
  const dest = rankDestinations(kb, DestinationsRequest.parse({ origin: "airport_cdg", dog, date: JUILLET, locale: "fr" }));
  let flagged = 0, mensonges = 0, signalSansConfirmation = 0;
  for (const m of dest.matches) {
    const dec = evaluate(kb, FinderRequest.parse({ origin: "airport_cdg", destination: m.airport_id, dog, date: JUILLET, weather: { temperature_c: m.temperature_c } }), { weatherProvenance: "estimated_latitude" });
    const reelle = dec.airlines.some((a) => a.direct && a.placements.some((p) => p.status === "confirmation_required"));
    if (m.heat_confirmation_required) { flagged++; if (!reelle) mensonges++; }
    if (m.estimated_heat_signal && !m.heat_confirmation_required) signalSansConfirmation++;
  }
  check(`${dogLabel} : ZÉRO destination « à confirmer » sans confirmation réelle (${flagged} signalées)`,
    mensonges === 0, `${mensonges} drapeaux mensongers`);
  console.log(`         ${dogLabel} : ${flagged} à confirmer · ${signalSansConfirmation} signal de chaleur seul`);
}
{
  // Le cas nominal de la contre-revue : carlin, Athènes — signal OUI, confirmation NON.
  const dest = rankDestinations(kb, DestinationsRequest.parse({ origin: "airport_cdg", dog: CARLIN, date: JUILLET, locale: "fr" }));
  const ath = dest.matches.find((m) => m.iata === "ATH");
  /* ── MOUVEMENT NOMMÉ (05/09/2026) : ATHÈNES N'EST PLUS UN TÉMOIN DE « DRAPEAU ÉTEINT » ────────
   *
   * Ce contrôle épinglait « signal OUI, confirmation NON » sur Athènes. Il est devenu faux, et la
   * mesure dit pourquoi : à 31° estimés, la règle `rule_af_summer_embargo` se déclenche sur la
   * soute et le fret d'Air France et produit une confirmation CLIMATIQUE bien réelle. Elle se
   * déclenchait déjà — c'est un refus de RACE non prouvé qui l'éteignait. Le même effet exactement
   * que celui relevé sur CDG→IST : un refus non prouvé ne masquait pas seulement son absence de
   * preuve, il masquait aussi un vrai signal de chaleur.
   *
   * Épingler « conf=false » ici reviendrait donc à exiger que le site TAISE une question légitime.
   * Athènes devient ce qu'elle est : le témoin que le drapeau s'allume sur une CAUSE, et qu'il
   * nomme la règle qui l'allume. La propriété « une confirmation de RACE ne l'allume pas » n'est
   * pas perdue pour autant — elle est reprise plus bas, sur les destinations RÉELLES où elle a
   * encore un témoin. */
  check("carlin/Athènes : estimated_heat_signal=true, et le drapeau chaleur est allumé",
    ath?.estimated_heat_signal === true && ath?.heat_confirmation_required === true,
    JSON.stringify({ sig: ath?.estimated_heat_signal, conf: ath?.heat_confirmation_required, h: ath?.hold_status, c: ath?.cargo_status }));
  check("carlin/Athènes : il est allumé par une CAUSE climatique qui nomme sa règle",
    (ath?.confirmation_signals ?? []).some((x) => x.cause.code === "estimated_climate" && !!x.cause.rule_id),
    JSON.stringify((ath?.confirmation_signals ?? []).filter((x) => x.cause.code === "estimated_climate")));
  /* T0-B3-b : Aegean était l'une des 42. Sa soute et son fret ne sont plus refusés — ils sont
     « à confirmer », faute de fait de race audité. Le drapeau CHALEUR reste pourtant faux, et
     c'est le point : il dérive d'une cause climatique ACTIVE, pas du statut. Une confirmation de
     race ne l'allume pas. Le cas d'Athènes prouve donc maintenant quelque chose de plus fort
     qu'avant — il l'a prouvé sur un canal `denied`, il le prouve sur un canal « à confirmer ». */
  check("carlin/Athènes : hold et cargo sont désormais « à confirmer » (les 42 sont retirées)",
    ath?.hold_status === "confirmation_required" && ath?.cargo_status === "confirmation_required",
    JSON.stringify({ h: ath?.hold_status, c: ath?.cargo_status }));
  /* LA PROPRIÉTÉ, SUR SES VRAIS TÉMOINS. Le drapeau ne doit s'allumer que sur une cause de
     chaleur — jamais sur une confirmation de race, de politique ou de règle non vérifiée. Elle se
     démontre désormais là où le cas existe VRAIMENT : les destinations chaudes dont toutes les
     confirmations sont non climatiques. Le compte est imprimé pour que le témoin ne puisse pas
     devenir vide en silence. */
  const chaudesSansCauseClimatique = dest.matches.filter((m) =>
    m.estimated_heat_signal && m.confirmation_signals.length > 0 &&
    !m.confirmation_signals.some((x) => x.cause.code === "estimated_climate" || x.cause.code === "climate_rule_unquoted"));
  check("témoin non vide : des destinations CHAUDES n'ont que des confirmations non climatiques",
    chaudesSansCauseClimatique.length > 0, `${chaudesSansCauseClimatique.length}`);
  console.log(`         ${chaudesSansCauseClimatique.length} destinations chaudes sans cause climatique · ex. ${chaudesSansCauseClimatique.slice(0, 4).map((m) => `${m.iata} ${m.temperature_c}°`).join(", ")}`);
  check("…et sur AUCUNE le drapeau chaleur ne s'allume (une confirmation de RACE ne l'allume pas)",
    chaudesSansCauseClimatique.every((m) => m.heat_confirmation_required === false),
    JSON.stringify(chaudesSansCauseClimatique.filter((m) => m.heat_confirmation_required).map((m) => m.iata)));
  /* Réciproque, sur le balayage entier : tout drapeau allumé s'appuie sur une cause de chaleur.
     Ce n'est PAS la tautologie de l'implémentation : le drapeau est relu ici depuis les signaux
     publics de la destination, et le contrôle exige en plus que la cause nomme sa règle. */
  const allumees = dest.matches.filter((m) => m.heat_confirmation_required);
  check(`tout drapeau chaleur allumé (${allumees.length}) s'appuie sur une cause de chaleur nommant sa règle`,
    allumees.every((m) => m.confirmation_signals.some((x) =>
      (x.cause.code === "estimated_climate" || x.cause.code === "climate_rule_unquoted") && !!x.cause.rule_id)),
    JSON.stringify(allumees.filter((m) => !m.confirmation_signals.some((x) => x.cause.code === "estimated_climate" || x.cause.code === "climate_rule_unquoted")).map((m) => m.iata)));
}
{
  // Rapport Finder : même invariant sur le bandeau global.
  const est = evaluate(kb, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ath", dog: CARLIN, date: JUILLET }));
  const rep = explain(est, "fr");
  /* Renforcée (contre-revue v3) : l'ancien « false OU une confirmation existe » était une
     tautologie de l'implémentation. Valeurs épinglées sur le cas réel — IST et non ATH pour la
     partie signal : le modèle RÉGION du Finder donne 28° à Athènes (Europe), sous le seuil ;
     c'est l'outil Destinations (latitude, 31°) qui portait le signal d'Athènes, testé au §8. */
  check("bandeau Finder (carlin/ATH) : rapport climatique présent", !!rep.climate);
  /* T0-B3-b : des canaux sont maintenant « à confirmer » sur ce trajet — pour la RACE. Le témoin
     ne peut donc plus être « aucune compagnie n'a de canal à confirmer ». Il devient plus
     exigeant : des confirmations existent, ET aucune n'est climatique, ET le bandeau chaleur
     reste éteint. C'est exactement l'invariant que ce paragraphe défend. */
  const aConfirmer = rep.airlines.filter((a) => (a.to_confirm?.length ?? 0) > 0).length;
  check("bandeau Finder (carlin/ATH) : des canaux sont à confirmer — témoin non vide", aConfirmer > 0, String(aConfirmer));
  check("bandeau Finder (carlin/ATH) : AUCUNE de ces confirmations n'est climatique",
    est.airlines.flatMap((a) => a.placements).every((p) =>
      !(p.confirmation_causes ?? []).some((c) => c.code === "estimated_climate")));
  check("bandeau Finder (carlin/ATH) : le drapeau chaleur reste éteint sur toutes les cartes",
    rep.airlines.every((a) => a.heat_confirmation_required === false));
  check("bandeau Finder (carlin/ATH) : confirmation_required=false, embargo=false",
    rep.climate?.confirmation_required === false && rep.climate?.embargo === false, JSON.stringify(rep.climate));
  const estIst = evaluate(kb, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ist", dog: CARLIN, date: JUILLET }));
  const repIst = explain(estIst, "fr");
  /* MOUVEMENT NOMMÉ (05/09/2026), même cause qu'à Athènes : à 34° estimés, quatre embargos d'été
     se déclenchent sur la soute et le fret (Air France, KLM, Lufthansa, Turkish). Ils se
     déclenchaient déjà ; les refus de race non prouvés les éteignaient. Le bandeau DEMANDE donc
     maintenant confirmation — et c'est la bonne réponse. Ce qu'il ne fait toujours pas, et qui
     reste le cœur de ce paragraphe, c'est AFFIRMER : une température estimée ne produit jamais
     d'embargo, quelle que soit sa valeur. */
  check("bandeau Finder (carlin/IST, 34° estimés) : signal=true, confirmation=true, embargo=FALSE",
    repIst.climate?.estimated_heat_signal === true && repIst.climate?.confirmation_required === true && repIst.climate?.embargo === false,
    JSON.stringify(repIst.climate));
  check("…et chaque confirmation climatique nomme sa règle d'embargo",
    estIst.airlines.flatMap((a) => a.placements).flatMap((p) => p.confirmation_causes ?? [])
      .filter((c) => c.code === "estimated_climate").every((c) => !!c.rule_id) &&
    estIst.airlines.flatMap((a) => a.placements).some((p) => (p.confirmation_causes ?? []).some((c) => c.code === "estimated_climate")));
  check("…et AUCUNE carte n'affirme un embargo sur une température estimée",
    repIst.airlines.every((a) => a.heat_embargo === false));
}

console.log("\n=== SUMMARY ===");
console.log(fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
