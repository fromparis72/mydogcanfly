#!/usr/bin/env node
/**
 * Harnais du QUATRIÈME ÉTAT — `accepted_with_conditions` — et du seuil « chien + contenant ».
 *
 *   npx tsx test-quatrieme-etat.mjs
 *
 * Deux arbitrages de Philippe (08/09/2026), sur le dossier de preuves de Codex :
 *   1. SEUIL DE POIDS : « Refus sûr au-dessus, jamais d'accord absolu en dessous. » Les pages
 *      officielles plafonnent chien + contenant ; le formulaire ne connaît que le chien. Un chien
 *      qui dépasse SEUL le seuil est refusé sûrement ; en dessous, on ne conclut jamais un oui.
 *      Le champ `weight_includes_carrier` qualifie le seuil ; sans lui, le moteur ne refuse pas.
 *   2. ACCEPTATION CONDITIONNELLE : « Quatrième état dans le contrat moteur. » Une politique
 *      `offered` prouvée par citation vaut « la compagnie publie ce mode sous les conditions
 *      citées » — jamais « ce chien est admis ». `allowed` disparaît des réponses publiées.
 *
 * MÉTHODE. Comme `test-tristate-climat.mjs` : la KB réelle (`kb`) pour ce qui doit rester vrai
 * sans preuve, et une KB SYNTHÉTIQUE construite depuis la donnée d'auteur (`rawKB`) où UNE
 * politique — Air France cabine — reçoit une citation (fictive, et qui le dit) et le champ
 * `weight_includes_carrier`. C'est `projectPlacementPolicy` qui en tire le statut, comme en
 * production ; rien n'est forcé après projection.
 */
import { loadKB, rawKB, normalize } from "./packages/knowledge/src/index.ts";
import { PlacementPolicyAuthored, projectPlacementPolicy } from "./packages/knowledge/src/objects.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { explain } from "./packages/engine/src/explain.ts";
import { FinderRequest } from "./packages/engine/src/contracts.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

const kb = loadKB();
const PAGE = {
  url: "https://exemple-compagnie.example/animaux", source_type: "official_website",
  verified_date: "2026-09-08", review_due: "2026-12-07", confidence: 4,
  reviewer: "harnais quatrième état", history: [],
};
const CITEE = { ...PAGE, quote: "Fictitious quotation, harness only — exercises the citation mechanism.", quote_language: "en", locator: "section « harnais »" };
const projeter = (p) => projectPlacementPolicy(PlacementPolicyAuthored.parse(p));

/* Date dynamique : le prochain 15 juillet (même règle que le harnais climat). */
const _now = new Date(), _y = _now.getUTCFullYear();
const _today = Date.UTC(_y, _now.getUTCMonth(), _now.getUTCDate()), _july15 = Date.UTC(_y, 6, 15);
const JUILLET = `${_today <= _july15 ? _y : _y + 1}-07-15`;
const GOLDEN_32 = { breed_id: "breed_golden_retriever", weight_kg: 32 };
const CAVALIER_6 = { breed_id: "breed_cavalier_king_charles_spaniel", weight_kg: 6 };
const stOf = (dec, airlineId, pl) =>
  dec.airlines.find((a) => a.airline_id === airlineId)?.placements.find((p) => p.placement === pl);
const decOf = (dec, airlineId, pl) => {
  const a = dec.airlines.find((x) => x.airline_id === airlineId);
  return a?.placement_decisions?.find((d) => d.placement === pl) ?? a?.decisions?.find((d) => d.placement === pl);
};

/** KB synthétique : Air France cabine citée, seuil qualifié (8 kg chien + contenant). Rien d'autre. */
const kbAF = ((seuilQualifie) => {
  const brut = JSON.parse(JSON.stringify(rawKB));
  const af = brut.airlines.find((a) => a.id === "airline_air_france");
  if (!af?.premium?.policy?.cabin) throw new Error("harnais : politique cabine Air France introuvable");
  const cab = af.premium.policy.cabin;
  delete cab.source_derived;
  cab.source = { ...cab.source, quote: CITEE.quote, quote_language: "en", locator: CITEE.locator };
  /* MOUVEMENT NOMMÉ (10/09/2026, complément Air France cabine — Codex) : la donnée RÉELLE porte désormais la citation, le
     champ `weight_includes_carrier: true` et la borne stricte `lt`. La variante « sans seuil qualifié » les RETIRE
     explicitement (avant, elle se contentait de ne pas les poser — et mesurait la donnée réelle, donc un refus). */
  if (seuilQualifie) cab.weight_includes_carrier = true;
  else { delete cab.weight_includes_carrier; delete cab.weight_limit_bound; }
  return normalize(brut);
});
const kbCitee = kbAF(true);
const kbCiteeSansSeuil = kbAF(false);
const REQ = (dog, kbx) => evaluate(kbx, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ath", dog, date: JUILLET }));

console.log("=== 1. Projection : le oui catégorique n'a plus de source ===");
{
  const p = projeter({ availability: "offered", source: CITEE, max_weight_kg: 8, weight_includes_carrier: true });
  check("offered + citée → accepted_with_conditions, allowed=true", p.status === "accepted_with_conditions" && p.allowed === true, JSON.stringify(p));
  check("le seuil ET sa qualification TRAVERSENT la projection (c'est ce que ma première rédaction perdait)",
    p.max_weight_kg === 8 && p.weight_includes_carrier === true, JSON.stringify(p));
  const tous = ["offered", "not_offered", "case_by_case", "undocumented"];
  check("aucune disponibilité, citée ou non, ne projette `allowed`",
    tous.every((availability) => projeter({ availability, source: CITEE }).status !== "allowed"
      && projeter({ availability, source: PAGE }).status !== "allowed"));
  check("not_offered + citée → denied (le refus prouvé reste prouvé)", projeter({ availability: "not_offered", source: CITEE }).status === "denied");
  check("offered SANS citation → à confirmer, même avec le seuil qualifié (le champ ne prouve rien)",
    projeter({ availability: "offered", source: PAGE, max_weight_kg: 8, weight_includes_carrier: true }).status === "confirmation_required");
}

console.log("\n=== 2. KB réelle : aucune politique n'émet `allowed` ; rien ne bouge sans preuve ===");
{
  let n = 0, allowed = 0, cond = 0;
  for (const a of kb.airlines.values()) for (const d of Object.values(a.premium?.policy ?? {})) {
    n++; if (d.status === "allowed") allowed++; if (d.status === "accepted_with_conditions") cond++;
  }
  check(`sur ${n} politiques réelles, 0 allowed (mesuré : ${allowed})`, n > 0 && allowed === 0);
  /* MESURÉ, PAS DEVINÉ. J'attendais 2 (Thai fret et Virgin Australia cabine sont citées) : c'est
     0. Thai fret est `undocumented` (la phrase citée dit « contactez Cargo » — jamais convertie en
     fret accepté) et Virgin Australia cabine est `case_by_case` (approbation compagnie). Les trois
     politiques citées du dépôt ne produisent donc qu'un refus (BA cabine). SENTINELLE figée à 0 :
     elle avance par mouvement nommé à chaque import de citation `offered`. */
  /* MOUVEMENT NOMMÉ (08/09/2026, import strict V3 — 25 citations importées) : 0 → 18. Dix-huit politiques `offered` citées (Aegean cabine et soute, Air France
     soute, Finnair cabine, Iberia ×2, KLM ×2, Lufthansa ×2, Qatar soute, SAS cabine, TAP ×2,
     Transavia ×2, Turkish ×2) sont au quatrième état. Toujours 0 `allowed`. */
  /* MOUVEMENT NOMMÉ (08/09/2026, import strict lots 2 et 3 — 24 citations de plus, 52 en tout) : 18 → 39. */
  /* MOUVEMENT NOMMÉ (09/09/2026, import strict lot 4 — 22 citations de plus, 74 en tout) : 39 → 58. */
  /* MOUVEMENT NOMMÉ (09/09/2026, import strict lot 5 — 18 citations de plus, 92 en tout) : 58 → 73. */
  /* MOUVEMENT NOMMÉ (09/09/2026, import strict lot 6) : 73 → 88. */
  /* MOUVEMENT NOMMÉ (09/09/2026, import strict lot 7 — 23 citations de plus, 136 en tout) : 88 → 108. */
  /* MOUVEMENT NOMMÉ (09/09/2026, import strict lot 8 — 22 citations de plus, 158 en tout) : 108 → 124. */
  /* MOUVEMENT NOMMÉ (09/09/2026, import strict lot 9 — 18 citations de plus, 176 en tout, lot de clôture) : 124 → 140. */
  /* MOUVEMENT NOMMÉ (09/09/2026, correctif d'arbitrages — Codex, tranché par Philippe ; six preuves remplacées dans les lots 4, 6 et 8) : 140 → 142 (Thai fret, Aer Lingus soute, Air China cabine entrent ; Bangkok fret sort vers `case_by_case`). */
  /* MOUVEMENT NOMMÉ (10/09/2026, Bangkok Airways fret — annexe 37) : 142 → 143 (fret `offered` cité, R1/R2/R3 dans le même lot). */
  /* MOUVEMENT NOMMÉ (10/09/2026, complément Air France cabine — Codex, une citation) : 143 → 144. */
  /* MOUVEMENT NOMMÉ (10/09/2026, Saudia — preuve de test retirée sur contre-lecture de l'audit de Codex, tranchée par Philippe) : 144 → 143 (Saudia soute sort du quatrième état). */
  check(`politiques réelles en accepted_with_conditions : 143 depuis le retrait Saudia — mesuré : ${cond}`, cond === 143);
  /* RE-FONDÉ (10/09/2026) : Air France cabine était LE témoin « plafond écrit, page non citée → à confirmer » ; elle est
     désormais citée (« moins de 8 kg, sac de transport compris »). Le témoin passe à Eurowings cabine, même route, même
     situation mesurée : plafond 8 kg dérivé de la fiche, aucune phrase, `legacy_unreviewed` — et le Golden de 32 kg y
     reste « à confirmer », jamais refusé au seuil sans preuve. Air France, elle, prouve l'inverse du même geste : la
     citation transforme l'incertitude en refus SÛR pour 32 kg. */
  const reel = REQ(GOLDEN_32, kb);
  const ew = stOf(reel, "airline_eurowings", "cabin");
  const ewPol = kb.airlines.get("airline_eurowings")?.premium?.policy?.cabin;
  check("Eurowings cabine, KB réelle (plafond 8 kg dérivé de la fiche, non citée) : reste « à confirmer », pas un refus au seuil sans preuve",
    ewPol?.max_weight_kg === 8 && !ewPol?.source?.quote && ew?.status === "confirmation_required"
      && (ew?.confirmation_causes ?? []).some((c) => c.rule_id === "rule_eurowings_cabin_weight"), JSON.stringify({ ewPol, ew }));
  const cab = stOf(reel, "airline_air_france", "cabin");
  check("Air France cabine, KB réelle désormais CITÉE : Golden 32 kg refusé sûrement, sur la page officielle du 10/09",
    cab?.status === "denied" && /wwws\.airfrance\.fr/.test(cab?.source?.url ?? "") && cab?.source?.verified_date === "2026-09-10", JSON.stringify(cab));
}

console.log("\n=== 3. Golden 32 kg, CDG → ATH, cabine citée à 8 kg chien + contenant : refus sûr ===");
{
  const dec = REQ(GOLDEN_32, kbCitee);
  const cab = stOf(dec, "airline_air_france", "cabin");
  check("cabine = denied (32 kg de chien seul dépassent 8 kg chien + contenant)", cab?.status === "denied" && cab?.allowed === false, JSON.stringify(cab));
  const a = dec.airlines.find((x) => x.airline_id === "airline_air_france");
  const rep = explain(dec, "fr");
  const carte = rep.airlines.find((x) => x.airline_id === "airline_air_france");
  check("la carte nomme le motif `weight_limit` (jamais « race »)",
    carte?.cabin_status === "denied" && (a?.deny_reasons ?? []).includes("weight_limit") === (carte?.deny_reasons ?? a?.deny_reasons ?? []).includes("weight_limit"),
    JSON.stringify({ deny: a?.deny_reasons, carte: carte?.deny_reasons }));
  /* La décision transporte la projection COURTE de la source (url, type, date, confiance) : la
     citation reste sur la politique, par décision antérieure (contracts.ts, `reduireSource`). On
     vérifie donc que l'URL de la décision est celle de la politique citée, et que cette politique
     porte bien la phrase. Faire remonter la phrase jusqu'à la carte est une question ouverte,
     nommée dans l'annexe 22, pas un fait acquis. */
  const polAF = kbCitee.airlines.get("airline_air_france")?.premium?.policy?.cabin;
  check("le refus porte l'URL de la politique CITÉE, et cette politique porte la phrase",
    !!cab?.source?.url && cab.source.url === polAF?.source?.url && (polAF?.source?.quote ?? "").length >= 10 && !!polAF?.source?.locator,
    JSON.stringify({ decision: cab?.source, politique: polAF?.source }));
  /* MOUVEMENT NOMMÉ (08/09/2026, import strict V3 — 25 citations importées) : la soute Air France est désormais CITÉE dans la donnée réelle (« more than 8 kg …
     and up to 75 kg … with its carrier, it must travel in the hold »), plafond 75 kg contenant
     compris : elle est acceptée sous conditions pour 32 kg, et transporte son plafond. Le témoin
     « le seuil cabine ne déteint pas » devient : la soute n'est PAS refusée par le seuil cabine. */
  const soute = stOf(dec, "airline_air_france", "hold");
  check("la soute Air France (citée à 75 kg chien + contenant) est acceptée sous conditions à 32 kg — le seuil cabine ne déteint pas",
    soute?.status === "accepted_with_conditions" && soute?.weight_limit_kg === 75, JSON.stringify(soute));
  /* Le témoin inverse : sans `weight_includes_carrier`, le seuil n'est pas qualifié, et le moteur
     ne refuse PAS au seuil. Mesuré : le canal tombe « à confirmer », parce que deux règles de
     poids NON CITÉES (`rule_af_cabin_weight`, `rule_global_cabin_weight_cap`) pèsent encore sur
     lui — elles ne refusent plus rien depuis la frontière, mais elles demandent confirmation.
     Ce que le témoin garantit : jamais `denied` sans le champ. */
  const sans = stOf(REQ(GOLDEN_32, kbCiteeSansSeuil), "airline_air_france", "cabin");
  check("même politique SANS `weight_includes_carrier` → JAMAIS un refus au seuil (mesuré : à confirmer, par les règles de poids non citées)",
    sans?.status !== "denied" && sans?.status !== "allowed", JSON.stringify(sans));
  /* LOT 2 : `weight_includes_carrier: false` EXPLICITE = plafond du chien seul (Air Europa cabine).
     Le chien seul au-dessus est refusé sûrement, et la décision dit que le contenant s'ajoute. */
  {
    const brut = JSON.parse(JSON.stringify(rawKB));
    const cab = brut.airlines.find((a) => a.id === "airline_air_france").premium.policy.cabin;
    delete cab.source_derived;
    cab.source = { ...cab.source, quote: CITEE.quote, quote_language: "en", locator: CITEE.locator };
    cab.weight_includes_carrier = false;
    const kbChienSeul = normalize(brut);
    const g = stOf(evaluate(kbChienSeul, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ath", dog: GOLDEN_32, date: JUILLET })), "airline_air_france", "cabin");
    const c = stOf(evaluate(kbChienSeul, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_ath", dog: CAVALIER_6, date: JUILLET })), "airline_air_france", "cabin");
    check("plafond du CHIEN SEUL (`weight_includes_carrier: false`) : Golden 32 kg refusé sûrement, motif poids", g?.status === "denied", JSON.stringify(g));
    check("…et Cavalier 6 kg sous conditions, la décision disant que le contenant s'ajoute",
      c?.status === "accepted_with_conditions" && c?.weight_limit_kg === 8 && c?.weight_limit_includes_carrier === false, JSON.stringify(c));
  }
  check("…et la confirmation nomme la règle de poids non citée d'Air France",
    (sans?.confirmation_causes ?? []).some((c) => c.rule_id === "rule_af_cabin_weight"), JSON.stringify(sans?.confirmation_causes));
}

console.log("\n=== 4. Cavalier 6 kg, même route : jamais un oui sec en dessous du seuil ===");
{
  const dec = REQ(CAVALIER_6, kbCitee);
  const cab = stOf(dec, "airline_air_france", "cabin");
  check("cabine = accepted_with_conditions, allowed=true (ouvert, sous conditions)", cab?.status === "accepted_with_conditions" && cab?.allowed === true, JSON.stringify(cab));
  check("jamais `allowed` : le poids du contenant est inconnu", cab?.status !== "allowed");
  check("la décision transporte le plafond chien + contenant (weight_limit_kg = 8) pour que la carte le dise",
    cab?.weight_limit_kg === 8, JSON.stringify(cab));
  const rep = explain(dec, "fr");
  const carte = rep.airlines.find((x) => x.airline_id === "airline_air_france");
  check("la carte est ouverte en cabine, statut accepted_with_conditions", carte?.cabin === true && carte?.cabin_status === "accepted_with_conditions", JSON.stringify(carte && { cabin: carte.cabin, cabin_status: carte.cabin_status }));
  check("le libellé dit « sous conditions » et jamais « OK »", /sous conditions/i.test(carte?.label ?? "") && !/\bOK\b/.test(carte?.label ?? ""), carte?.label);
  check("le verdict est « conditional », jamais « compatible » (le oui sec n'a plus de chemin)", rep.verdict === "conditional", rep.verdict);
  /* Le prouvé d'abord : depuis l'import V3, Air France n'est plus seule documentée sur ce trajet
     (Aegean, Lufthansa, KLM…) ; la propriété est que TOUTE carte documentée précède TOUTE carte
     dont les trois canaux sont « ? ». */
  /* MESURÉ, et ma première rédaction se trompait de couche : le MOTEUR trie par utilité
     (ouvert, puis à confirmer, puis refusé) — un refus documenté (easyJet) vient donc APRÈS des
     pistes « ? ». Le regroupement « documentées d'abord » est le contrat de l'INTERFACE
     (FlightFinder, `deuxNiveaux`, harnais jsdom). Ici, la propriété du moteur : toute carte
     ouverte précède toute carte « ? », et Air France est parmi les ouvertes. */
  const ouverte = (x) => ["cabin", "hold", "cargo"].some((ch) => x[`${ch}_status`] === "accepted_with_conditions");
  const premiereNonOuverte = rep.airlines.findIndex((x) => !ouverte(x));
  const derniereOuverte = rep.airlines.map(ouverte).lastIndexOf(true);
  check("toute compagnie ouverte sous conditions passe DEVANT toute carte non ouverte (le prouvé d'abord), Air France comprise",
    premiereNonOuverte > derniereOuverte && ouverte(rep.airlines.find((x) => x.airline_id === "airline_air_france")),
    rep.airlines.slice(0, 12).map((x) => `${x.airline_id}:${x.cabin_status}`).join(" "));
}

console.log("\n=== 5. Les quatre langues portent les libellés du quatrième état ===");
{
  for (const loc of ["en", "fr", "es", "pt"]) {
    const rep = explain(REQ(CAVALIER_6, kbCitee), loc);
    const carte = rep.airlines.find((x) => x.airline_id === "airline_air_france");
    check(`${loc} : libellé résolu (pas une clé brute)`, !!carte?.label && !/^air\.cond\./.test(carte.label), carte?.label);
  }
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail ? 1 : 0);
