#!/usr/bin/env node
/**
 * LE CONTRAT TARIFAIRE — contre-épreuves (10/09/2026, annexes 44, 45 et 46).
 *
 *   npx tsx test-contrat-tarifaire.mjs
 *
 * Cinq témoins ont été exigés par Philippe sur l'arbitrage initial de Codex (§1 à §5). La première
 * contre-revue en a imposé six de plus (§6 à §9). La SECONDE contre-revue, celle de `7188990`, en
 * impose quatre autres — et ceux-là reproduisent EXACTEMENT les sabotages que Codex a fait passer,
 * un par un, plutôt que de vérifier la mécanique alentour :
 *   §10 — cinq sources inadmissibles acceptées par mon contrôle maison (P0-1, second tour) ;
 *   §11 — un faux conflit qui éteint un vrai tarif (P0-2, second tour) ;
 *   §12 — une ligne applicable perdue par priorité interne (P1, second tour) ;
 *   §16 — la frontière entre validation et résolution, éprouvée à la compilation ET à
 *         l'exécution (P1, quatrième tour) ;
 *   §15 — quatre ingestions sabotées : tarif rangé sous le mauvais canal, identifiants de tarifs
 *         en double, conflit rangé sous le mauvais canal, identifiants de conflits en double
 *         (P0-3, second tour ; la quatrième ajoutée au troisième tour, la garde existant sans que
 *         rien ne la morde — une garde que rien ne mord est une garde qu'on croit avoir).
 *
 * TOUTES les fixtures positives sont des faits RÉELS de l'audit indépendant du 10/09/2026 : SAS
 * soute Chine, le conflit Finnair soute, Air China cabine (seule fenêtre d'achat publiée en jours
 * de tout l'audit) et KLM soute (fourchette la mieux citée). Les rares fixtures de FORME sont
 * nommées comme telles à l'endroit où elles servent.
 *
 * Les sections 1 à 13 éprouvent le contrat indépendamment des données. Les sections 14 et 17
 * exigent désormais que l'import audité traverse réellement la base puis le contrat HTTP :
 * revenir à zéro tarif ou perdre l'inventaire entre moteur et Finder fait rougir ce même témoin.
 */
import { readFileSync } from "node:fs";
import worker from "./packages/workers/src/index.ts";
import {
  Fare, FareConflict, FarePrice, FareObservation, PurchaseWindow, lireTarif, lireConflit,
  evaluerPortee, evaluerFenetre, porteeTarif, porteeSaine, resoudreTarif, resolutionVide,
  projectPlacementPolicy, PlacementPolicyAuthored,
} from "./packages/knowledge/src/index.ts";
import { presentNumericFares } from "./packages/ui/src/lib/farePresentation.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};
const refuse = (schema, obj) => {
  const r = schema.safeParse(obj);
  return { refuse: !r.success, motif: r.success ? "" : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | ") };
};

/* ── Les provenances réelles. Elles satisfont `T0bAuditSource` : page officielle, http(s), aucun
   domaine à nous, citation d'au moins dix caractères, langue BCP-47, localisateur, et surtout la
   cadence `airline` au jour près — 2026-09-10 + 90 jours = 2026-12-09. ─────────────────────── */
const SRC_SAS = {
  url: "https://www.flysas.com/en/travel-info/travel-with-pets/in-hold",
  source_type: "official_website", verified_date: "2026-09-10", review_due: "2026-12-09",
  confidence: 4, reviewer: "Codex — direct reading of official airline material", history: [],
  quote: "China: 5400 DKK, 7600 NOK, 7600 SEK, 725 EUR, 775 USD",
  quote_language: "en", locator: "Fees → Pet in cargo hold → China",
};
const SRC_FIN_A = {
  url: "https://www.finnair.com/fr-fr/les-animaux-de-compagnie-%C3%A0-bord-des-vols-finnair",
  source_type: "official_website", verified_date: "2026-09-10", review_due: "2026-12-09",
  confidence: 4, reviewer: "Codex — lecture directe", history: [],
  /* *Erreur nommée* : mon premier jet écrivait « 140 EUR », sous le minimum de dix caractères. */
  quote: "140 EUR / 650 EUR", quote_language: "fr", locator: "Pet transportation fees",
};
const SRC_FIN_B = {
  url: "https://www.finnair.com/fr-fr/bagages-sur-les-vols-finnair/frais-de-bagage-suppl%C3%A9mentaire",
  source_type: "official_website", verified_date: "2026-09-10", review_due: "2026-12-09",
  confidence: 4, reviewer: "Codex — lecture directe", history: [],
  quote: "120 EUR / 600 EUR", quote_language: "fr", locator: "Pets",
};
/* Air China cabine — la SEULE fenêtre d'achat exprimée en JOURS de tout l'audit des 102 compagnies. */
const SRC_AIRCHINA = {
  url: "https://m.airchina.com.cn/ac/c/invoke/specialService/petCabinAgreement%40pg",
  source_type: "official_website", verified_date: "2026-09-10", review_due: "2026-12-09",
  confidence: 4, reviewer: "Codex — audit indépendant des 102 compagnies", history: [],
  quote: "RMB1,399 per pet per flight segment.", quote_language: "en",
  locator: "II. Carrier's Pet Transportation Charges",
};
/* KLM soute — une phrase entière porte les deux bornes de la fourchette. */
const SRC_KLM = {
  url: "https://www.klm.com/information/pets/reservation",
  source_type: "official_website", verified_date: "2026-09-10", review_due: "2026-12-09",
  confidence: 4, reviewer: "Codex — audit indépendant des 102 compagnies", history: [],
  quote: "The cost of traveling with your pet on KLM ranges from EUR 70 to EUR 500 per one-way flight.",
  quote_language: "en", locator: "Costs and restrictions → Costs",
};

/** Un conflit complet, réutilisé par plusieurs sections. Axes obligatoires depuis la porte P0-2. */
const CONFLIT_FINNAIR = {
  id: "fare_conflict_finnair_hold_2026_09_10", placement: "hold", status: "unresolved",
  effect: "suppress_exact_fare", scope_label: "Europe",
  billing_subject: "pet", journey_basis: "per_one_way",
  observations: [
    { price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }] }, source: SRC_FIN_A },
    { price: { kind: "exact", amounts: [{ amount: 120, currency: "EUR" }] }, source: SRC_FIN_B },
  ],
  note: "Deux pages officielles vivantes publient des montants différents.",
};

console.log("=== 1. SAS : facturé par contenant ET par segment — deux axes, jamais un seul ===");
{
  const sasChine = {
    id: "fare_sas_hold_china", placement: "hold",
    price: { kind: "exact", amounts: [{ amount: 725, currency: "EUR" }, { amount: 775, currency: "USD" }, { amount: 5400, currency: "DKK" }] },
    billing_subject: "container", journey_basis: "per_segment",
    applies_when: { all: [{ fact: "route.dest_country_id", op: "eq", value: "country_cn" }] },
    scope_label: "Chine", source: SRC_SAS,
  };
  const r = Fare.safeParse(sasChine);
  check("le tarif SAS Chine est accepté par le contrat", r.success, r.success ? "" : JSON.stringify(r.error.issues).slice(0, 240));
  check("les DEUX axes sont portés séparément : `container` et `per_segment`",
    r.success && r.data.billing_subject === "container" && r.data.journey_basis === "per_segment");
  check("les trois devises publiées cohabitent sur la même ligne — montants parallèles, jamais un conflit",
    r.success && r.data.price.amounts.length === 3 && new Set(r.data.price.amounts.map((m) => m.currency)).size === 3);
  check("aucune conversion : les montants sont ceux de la page, à l'unité près",
    r.success && r.data.price.amounts.find((m) => m.currency === "EUR").amount === 725 && r.data.price.amounts.find((m) => m.currency === "USD").amount === 775);
  for (const manquant of ["billing_subject", "journey_basis"]) {
    const sans = { ...sasChine }; delete sans[manquant];
    check(`sans \`${manquant}\`, le tarif est REFUSÉ`, refuse(Fare, sans).refuse, refuse(Fare, sans).motif);
  }
  const res = resoudreTarif([sasChine], [], "hold", { "route.dest_country_id": "country_cn" });
  check("Paris → Chine : le tarif s'applique, et c'est bien celui de la Chine",
    res.montants.length === 1 && res.montants[0].id === "fare_sas_hold_china", JSON.stringify(res).slice(0, 200));
  const ailleurs = resoudreTarif([sasChine], [], "hold", { "route.dest_country_id": "country_us" });
  check("Paris → États-Unis : ce tarif-là ne s'applique pas, et aucun autre n'est inventé",
    resolutionVide(ailleurs), JSON.stringify(ailleurs).slice(0, 200));
}

console.log("\n=== 2. Le conflit Finnair soute masque le prix ===");
{
  const c = FareConflict.safeParse(CONFLIT_FINNAIR);
  check("le conflit Finnair est accepté par le contrat, avec ses DEUX observations complètes",
    c.success && c.data.observations.length === 2, c.success ? "" : JSON.stringify(c.error.issues).slice(0, 240));
  check("chaque observation porte sa source et sa date — un conflit ne se dit pas avec deux URL nues",
    c.success && c.data.observations.every((o) => !!o.source.url && !!o.source.quote && o.source.verified_date === "2026-09-10"));
  const seule = { ...CONFLIT_FINNAIR, observations: [CONFLIT_FINNAIR.observations[0]] };
  check("un conflit à UNE seule voix est refusé — ce n'en est pas un", refuse(FareConflict, seule).refuse, refuse(FareConflict, seule).motif);

  const tarifFin = {
    id: "fare_finnair_hold_europe", placement: "hold",
    price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }] },
    billing_subject: "pet", journey_basis: "per_one_way", scope_label: "Europe",
    /* La portée est DÉCIDABLE ici, et c'est le point : sans elle le tarif serait simplement
       indécidable, et le témoin croirait constater une suppression là où il n'y a rien à
       supprimer — un témoin vacant de plus. */
    applies_when: { all: [{ fact: "route.dest_country_id", op: "eq", value: "country_fi" }] },
    source: SRC_FIN_A,
  };
  const res = resoudreTarif([tarifFin], [CONFLIT_FINNAIR], "hold", { "route.dest_country_id": "country_fi" });
  check("un conflit ouvert éteint le montant : aucun montant ne sort, ni 140 € ni 120 €",
    res.montants.length === 0 && res.conflits.length === 1 && res.conflits[0].id === CONFLIT_FINNAIR.id, JSON.stringify(res).slice(0, 240));
  check("…et le conflit nomme ses deux sources, pour que la fiche puisse le dire",
    res.conflits[0].observations.map((o) => o.source.url).join(" ").includes("frais-de-bagage"));
  check("…et le montant éteint est NOMMÉ dans `supprimes` : rien ne disparaît en silence",
    res.supprimes.length === 1 && res.supprimes[0].id === "fare_finnair_hold_europe", JSON.stringify(res.supprimes).slice(0, 160));
}

console.log("\n=== 3. Une portée inconnue interdit un montant exact ===");
{
  const zone = {
    id: "fare_sas_hold_europe", placement: "hold",
    price: { kind: "exact", amounts: [{ amount: 169, currency: "EUR" }] },
    billing_subject: "container", journey_basis: "per_segment",
    applies_when: { all: [{ fact: "route.dest_country_id", op: "in", value: ["country_se", "country_no", "country_dk"] }] },
    scope_label: "Scandinavie, Europe, Moyen-Orient", source: { ...SRC_SAS, quote: "Scandinavia, Europe, Middle East: 169 EUR" },
  };
  check("portée évaluée sans le fait nécessaire → INDÉCIDABLE, jamais « faux »",
    evaluerPortee(zone.applies_when, {}) === "indecidable", evaluerPortee(zone.applies_when, {}));
  const res = resoudreTarif([zone], [], "hold", {});
  check("un trajet dont on ignore la destination ne reçoit AUCUN montant — la grille peut se montrer, pas le prix",
    res.montants.length === 0 && res.indecidables.length === 1, JSON.stringify(res).slice(0, 200));
  const connu = resoudreTarif([zone], [], "hold", { "route.dest_country_id": "country_se" });
  check("le même tarif, sur un trajet dont la destination EST connue, s'applique — le témoin n'est pas vacant",
    connu.montants.length === 1 && connu.montants[0].id === "fare_sas_hold_europe", JSON.stringify(connu).slice(0, 160));
  const hors = resoudreTarif([zone], [], "hold", { "route.dest_country_id": "country_jp" });
  check("et sur une destination hors de la portée, il ne s'applique pas", resolutionVide(hors));

  const sansPortee = { ...zone, id: "fare_sans_portee", applies_when: undefined };
  const rs = resoudreTarif([sansPortee], [], "hold", { "route.dest_country_id": "country_se" });
  check("un tarif sans portée exécutable n'est JAMAIS appliqué à un trajet, même connu",
    rs.montants.length === 0 && rs.indecidables.length === 1, JSON.stringify(rs).slice(0, 160));
  check("le libellé de portée est du texte pour l'œil, il ne décide rien : la portée décidante est le prédicat",
    typeof zone.scope_label === "string" && evaluerPortee(undefined, { "route.dest_country_id": "country_se" }) === "indecidable");

  const devis = {
    id: "fare_sas_cargo_quote", placement: "cargo", price: { kind: "quote", amounts: [] },
    billing_subject: "shipment", journey_basis: "per_journey",
    applies_when: { all: [{ fact: "placement", op: "eq", value: "cargo" }] },
    source: { ...SRC_SAS, url: "https://www.flysas.com/en/travel-info/baggage/cargo", quote: "book it as cargo using a freight forwarder", locator: "Pet as cargo → opening paragraph" },
  };
  const rq = resoudreTarif([devis], [], "cargo", { placement: "cargo" });
  check("« sur devis » est un MÉCANISME prouvé, pas un montant — l'inventaire le range ainsi",
    rq.mecanismes.length === 1 && rq.montants.length === 0 && rq.mecanismes[0].price.kind === "quote", JSON.stringify(rq).slice(0, 200));
  const avecMontant = { ...devis, price: { kind: "quote", amounts: [{ amount: 100, currency: "EUR" }] } };
  check("un « sur devis » qui porte un montant est REFUSÉ", refuse(Fare, avecMontant).refuse, refuse(Fare, avecMontant).motif);
  const chiffreSansMontant = { ...zone, price: { kind: "exact", amounts: [] } };
  check("un « exact » sans montant est REFUSÉ", refuse(Fare, chiffreSansMontant).refuse, refuse(Fare, chiffreSansMontant).motif);
}

console.log("\n=== 4. Le chevauchement de deux tarifs devient un conflit ===");
{
  const base = {
    placement: "hold", billing_subject: "container", journey_basis: "per_segment",
    applies_when: { all: [{ fact: "route.dest_country_id", op: "eq", value: "country_cn" }] },
    source: SRC_SAS,
  };
  const a = { ...base, id: "fare_a", price: { kind: "exact", amounts: [{ amount: 725, currency: "EUR" }] } };
  const b = { ...base, id: "fare_b", price: { kind: "exact", amounts: [{ amount: 680, currency: "EUR" }] } };
  const res = resoudreTarif([a, b], [], "hold", { "route.dest_country_id": "country_cn" });
  check("deux montants différents applicables au même trajet, dans la même devise → CHEVAUCHEMENT, jamais un choix",
    res.chevauchements.length === 2 && res.montants.length === 0, JSON.stringify(res).slice(0, 220));
  const bMemeMontant = { ...b, price: { kind: "exact", amounts: [{ amount: 725, currency: "EUR" }] } };
  const identique = resoudreTarif([a, bMemeMontant], [], "hold", { "route.dest_country_id": "country_cn" });
  check("deux lignes qui disent le MÊME montant sur les mêmes axes ne sont pas un conflit — c'est une redite",
    identique.chevauchements.length === 0 && identique.montants.length === 2, JSON.stringify(identique).slice(0, 160));
  const bAutreAxe = { ...b, price: { kind: "exact", amounts: [{ amount: 725, currency: "EUR" }] }, journey_basis: "per_journey" };
  const axes = resoudreTarif([a, bAutreAxe], [], "hold", { "route.dest_country_id": "country_cn" });
  check("même montant, axes différents (par segment contre par trajet) → chevauchement : 725 € n'y veut pas dire la même chose",
    axes.chevauchements.length === 2 && axes.montants.length === 0, JSON.stringify(axes).slice(0, 160));

  const bAutreDevise = { ...b, price: { kind: "exact", amounts: [{ amount: 5400, currency: "DKK" }] } };
  const parallele = resoudreTarif([a, bAutreDevise], [], "hold", { "route.dest_country_id": "country_cn" });
  check("deux devises différentes ne se contredisent pas : ce sont des montants parallèles, aucune conversion",
    parallele.chevauchements.length === 0 && parallele.montants.length === 2, JSON.stringify(parallele).slice(0, 160));
  check("…et les DEUX variantes sortent : aucune n'est jetée en silence (P1, premier tour)",
    new Set(parallele.montants.flatMap((f) => f.price.amounts.map((m) => m.currency))).size === 2);
}

console.log("\n=== 5. Un prix sans citation est refusé — et un MÉCANISME aussi (P0-1, premier tour) ===");
{
  const nu = {
    id: "fare_sans_preuve", placement: "cabin",
    price: { kind: "exact", amounts: [{ amount: 75, currency: "EUR" }] },
    billing_subject: "container", journey_basis: "per_segment",
    source: { url: "https://www.flysas.com/en/travel-info/travel-with-pets/in-hold", source_type: "official_website", verified_date: "2026-09-10", review_due: "2026-12-09", confidence: 4, reviewer: "x", history: [] },
  };
  check("un montant dont la source ne porte AUCUNE phrase est refusé", refuse(Fare, nu).refuse, refuse(Fare, nu).motif);
  const sansLocator = { ...nu, source: { ...nu.source, quote: "China: 725 EUR", quote_language: "en" } };
  check("une phrase sans localisateur ne suffit pas : on doit savoir OÙ elle a été lue", refuse(Fare, sansLocator).refuse);
  const sansLangue = { ...nu, source: { ...nu.source, quote: "China: 725 EUR", locator: "Fees" } };
  check("une phrase sans langue est refusée", refuse(Fare, sansLangue).refuse);
  const courte = { ...nu, source: { ...nu.source, quote: "725 EUR", quote_language: "en", locator: "Fees" } };
  check("une phrase de moins de dix caractères ne prouve rien — refusée", refuse(Fare, courte).refuse);
  const complet = { ...nu, source: SRC_SAS };
  check("avec sa phrase, sa langue et son localisateur, le même tarif passe — le témoin n'est pas vacant",
    Fare.safeParse(complet).success, JSON.stringify(Fare.safeParse(complet).error?.issues ?? "").slice(0, 200));
  check("le tarif porte SA source, séparée de celle de la politique du canal",
    Fare.safeParse(complet).success && Fare.safeParse(complet).data.source.locator === "Fees → Pet in cargo hold → China");
  const minuscule = { ...complet, price: { kind: "exact", amounts: [{ amount: 725, currency: "eur" }] } };
  check("une devise en minuscules est refusée (ISO 4217)", refuse(FarePrice, minuscule.price).refuse);

  const sourceNue = { url: "https://example.com/tarifs", source_type: "official_website", verified_date: "2026-09-10", review_due: "2026-12-09", confidence: 4, reviewer: "x", history: [] };
  for (const kind of ["formula", "calculator", "booking_only", "quote"]) {
    const mecanismeNu = {
      id: `fare_mecanisme_${kind}`, placement: "cargo", price: { kind, amounts: [] },
      billing_subject: "shipment", journey_basis: "per_journey", source: sourceNue,
    };
    check(`un mécanisme « ${kind} » SANS citation est refusé`, refuse(Fare, mecanismeNu).refuse, refuse(Fare, mecanismeNu).motif);
    const mecanismeCite = { ...mecanismeNu, source: { ...SRC_SAS, url: "https://www.flysas.com/en/travel-info/baggage/cargo", quote: "book it as cargo using a freight forwarder", locator: "Pet as cargo" } };
    check(`…et le même « ${kind} », cité, est accepté — le témoin n'est pas vacant`, Fare.safeParse(mecanismeCite).success);
  }
}

console.log("\n=== 6. La fenêtre d'achat est ÉVALUÉE, pas seulement enregistrée (P0-2, premier tour) ===");
{
  /* Air China cabine : « booking from 7 days to 24 hours before departure », soit de J-7 à J-1.
     NOTE HONNÊTE : la page réserve son tarif aux vols OPÉRÉS par Air China, et le transporteur
     opérant n'est pas un fait du moteur. La portée écrite ici interroge le canal, qui EST un fait ;
     c'est l'une des raisons pour lesquelles ce lot n'importe aucun tarif. */
  const airChina = {
    id: "fare_air_china_cabin", placement: "cabin",
    price: { kind: "exact", amounts: [{ amount: 1399, currency: "CNY" }] },
    billing_subject: "pet", journey_basis: "per_segment",
    applies_when: { all: [{ fact: "placement", op: "eq", value: "cabin" }] },
    purchase_window: { min_days_before_departure: 1, max_days_before_departure: 7 },
    scope_label: "Vols opérés par Air China", source: SRC_AIRCHINA,
  };
  check("le tarif Air China, avec sa fenêtre d'achat, est accepté", Fare.safeParse(airChina).success,
    JSON.stringify(Fare.safeParse(airChina).error?.issues ?? "").slice(0, 240));

  const contexte = { placement: "cabin" };
  check("délai DANS la fenêtre (J-3) → la fenêtre est vraie, et le tarif s'applique",
    porteeTarif(airChina, { ...contexte, days_before_departure: 3 }) === "vrai");
  check("délai HORS de la fenêtre (J-30, trop tôt) → la fenêtre est fausse",
    porteeTarif(airChina, { ...contexte, days_before_departure: 30 }) === "faux");
  check("délai ABSENT du contexte → INDÉCIDABLE, jamais « vrai » et jamais « faux »",
    porteeTarif(airChina, contexte) === "indecidable");
  check("…et la résolution suit : à J-3, le montant sort",
    resoudreTarif([airChina], [], "cabin", { ...contexte, days_before_departure: 3 }).montants.length === 1);
  check("…à J-30, aucun montant n'est publié",
    resolutionVide(resoudreTarif([airChina], [], "cabin", { ...contexte, days_before_departure: 30 })));
  check("…et sans délai connu, la grille est indécidable — à moitié su, pas dit",
    resoudreTarif([airChina], [], "cabin", contexte).indecidables.length === 1);
  check("le bord de la fenêtre est inclusif des deux côtés (J-1 et J-7 valent)",
    porteeTarif(airChina, { ...contexte, days_before_departure: 1 }) === "vrai"
      && porteeTarif(airChina, { ...contexte, days_before_departure: 7 }) === "vrai");
  check("et J-0 (le jour même) tombe sous le plancher publié",
    porteeTarif(airChina, { ...contexte, days_before_departure: 0 }) === "faux");
  check("un tarif sans fenêtre d'achat n'est jamais bloqué par elle", evaluerFenetre(undefined, {}) === "vrai");
  check("une fenêtre écrite sans délai connu est indécidable, pas fausse",
    evaluerFenetre({ min_days_before_departure: 1, max_days_before_departure: 7 }, {}) === "indecidable");

  /* FIXTURE DE FORME — aucune page ne publie deux paliers Air China ; ce témoin n'éprouve que la
     mécanique que la version précédente cassait. */
  const tot = { ...airChina, id: "fare_palier_tot", purchase_window: { min_days_before_departure: 7 } };
  const tard = { ...airChina, id: "fare_palier_tard", price: { kind: "exact", amounts: [{ amount: 1599, currency: "CNY" }] }, purchase_window: { max_days_before_departure: 6 } };
  const aJ10 = resoudreTarif([tot, tard], [], "cabin", { ...contexte, days_before_departure: 10 });
  check("deux paliers à fenêtres disjointes, achat à J-10 → un seul s'applique, AUCUN chevauchement",
    aJ10.montants.length === 1 && aJ10.montants[0].id === "fare_palier_tot" && aJ10.chevauchements.length === 0, JSON.stringify(aJ10).slice(0, 200));
  const aJ2 = resoudreTarif([tot, tard], [], "cabin", { ...contexte, days_before_departure: 2 });
  check("…et à J-2, c'est l'autre palier, toujours sans chevauchement",
    aJ2.montants.length === 1 && aJ2.montants[0].id === "fare_palier_tard" && aJ2.chevauchements.length === 0);
  const sansDelai = resoudreTarif([tot, tard], [], "cabin", contexte);
  check("sans délai connu, les DEUX paliers sont indécidables — et surtout, aucun prix ne sort",
    sansDelai.indecidables.length === 2 && sansDelai.montants.length === 0);

  check("une fenêtre vide n'est pas une condition — refusée", refuse(PurchaseWindow, {}).refuse);
  check("une fenêtre dont le plancher dépasse le plafond ne s'ouvre jamais — refusée",
    refuse(PurchaseWindow, { min_days_before_departure: 9, max_days_before_departure: 2 }).refuse);
  check("une fenêtre à une seule borne est légitime (« au moins sept jours avant »)",
    PurchaseWindow.safeParse({ min_days_before_departure: 7 }).success);
}

console.log("\n=== 7. `resolved` était une porte arrière : elle est murée (P0-3, premier tour) ===");
{
  check("un conflit ouvert reste accepté", FareConflict.safeParse(CONFLIT_FINNAIR).success);
  const rr = refuse(FareConflict, { ...CONFLIT_FINNAIR, status: "resolved" });
  check("`status: resolved` est REFUSÉ par le schéma — un mot ne rallume pas un prix contredit", rr.refuse, rr.motif);
  check("…et mon propre témoin, qui consacrait ce comportement, est retiré : erreur nommée", rr.refuse);
  for (const faux of ["closed", "arbitrated", "", "UNRESOLVED"]) {
    check(`aucune autre valeur ne passe non plus (\`${faux || "(vide)"}\`)`, refuse(FareConflict, { ...CONFLIT_FINNAIR, status: faux }).refuse);
  }
  check("aucun champ de résolution improvisé n'est toléré (schéma strict)",
    refuse(FareConflict, { ...CONFLIT_FINNAIR, resolved_by: "moi", winner: "fare_a" }).refuse);
  const sansConflit = resoudreTarif(
    [{ id: "fare_finnair_hold_europe", placement: "hold", price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }] },
       billing_subject: "pet", journey_basis: "per_one_way",
       applies_when: { all: [{ fact: "route.dest_country_id", op: "eq", value: "country_fi" }] }, source: SRC_FIN_A }],
    [], "hold", { "route.dest_country_id": "country_fi" });
  check("retirer le conflit du dépôt, lui, rouvre le montant — et se voit dans l'historique",
    sansConflit.montants.length === 1, JSON.stringify(sansConflit).slice(0, 160));
}

console.log("\n=== 8. Une fourchette encadre CHAQUE devise, dans le bon sens (P0-4) ===");
{
  const klm = {
    id: "fare_klm_hold_range", placement: "hold",
    price: { kind: "range", amounts: [{ amount: 70, currency: "EUR" }, { amount: 500, currency: "EUR" }] },
    billing_subject: "pet_or_container", journey_basis: "per_one_way",
    applies_when: { all: [{ fact: "placement", op: "eq", value: "hold" }] },
    scope_label: "aéroport de départ → destination", source: SRC_KLM,
  };
  check("la fourchette KLM 70–500 EUR est acceptée", Fare.safeParse(klm).success,
    JSON.stringify(Fare.safeParse(klm).error?.issues ?? "").slice(0, 240));
  const depareillee = { ...klm.price, amounts: [{ amount: 60, currency: "EUR" }, { amount: 100, currency: "USD" }] };
  const rd = refuse(FarePrice, depareillee);
  check("« 60 EUR et 100 USD » n'est PAS une fourchette : aucune devise n'y a ses deux bornes", rd.refuse, rd.motif);
  check("…et le motif parle bien de la fourchette", rd.motif.toLowerCase().includes("fourchette"), rd.motif);
  check("une fourchette inversée (500 puis 70) est refusée : le minimum s'écrit d'abord",
    refuse(FarePrice, { ...klm.price, amounts: [{ amount: 500, currency: "EUR" }, { amount: 70, currency: "EUR" }] }).refuse);
  check("une borne seule n'encadre rien — refusée", refuse(FarePrice, { ...klm.price, amounts: [{ amount: 70, currency: "EUR" }] }).refuse);
  check("trois montants dans une devise : on ne saurait pas lequel est le maximum — refusé",
    refuse(FarePrice, { ...klm.price, amounts: [{ amount: 70, currency: "EUR" }, { amount: 300, currency: "EUR" }, { amount: 500, currency: "EUR" }] }).refuse);
  check("deux devises, chacune correctement encadrée : accepté — le témoin n'est pas vacant",
    FarePrice.safeParse({ ...klm.price, amounts: [{ amount: 70, currency: "EUR" }, { amount: 500, currency: "EUR" }, { amount: 80, currency: "USD" }, { amount: 560, currency: "USD" }] }).success);
  check("…et il suffit qu'UNE des deux devises soit inversée pour que tout soit refusé",
    refuse(FarePrice, { ...klm.price, amounts: [{ amount: 70, currency: "EUR" }, { amount: 500, currency: "EUR" }, { amount: 560, currency: "USD" }, { amount: 80, currency: "USD" }] }).refuse);
  check("un `exact` avec deux montants dans la même devise reste refusé — c'est un conflit, pas une ligne",
    refuse(FarePrice, { kind: "exact", amounts: [{ amount: 70, currency: "EUR" }, { amount: 500, currency: "EUR" }] }).refuse);
}

console.log("\n=== 9. Une portée vide ne s'applique pas partout (P1, premier tour) ===");
{
  check("`{ all: [] }` ne vaut PAS « vrai » à l'évaluation — il est indécidable",
    evaluerPortee({ all: [] }, { "route.dest_country_id": "country_cn" }) === "indecidable");
  check("`{ any: [] }` ne vaut pas « faux » non plus — il est indécidable",
    evaluerPortee({ any: [] }, { "route.dest_country_id": "country_cn" }) === "indecidable");
  check("`porteeSaine` refuse le combinateur vide", !porteeSaine({ all: [] }) && !porteeSaine({ any: [] }));
  check("…y compris IMBRIQUÉ, à n'importe quelle profondeur",
    !porteeSaine({ all: [{ fact: "placement", op: "eq", value: "hold" }, { any: [] }] }) && !porteeSaine({ not: { all: [] } }));
  check("…et accepte une portée qui dit quelque chose",
    porteeSaine(undefined) && porteeSaine({ all: [{ fact: "placement", op: "eq", value: "hold" }] }));
  const base = {
    id: "fare_portee_vide", placement: "hold",
    price: { kind: "exact", amounts: [{ amount: 725, currency: "EUR" }] },
    billing_subject: "container", journey_basis: "per_segment", source: SRC_SAS,
  };
  const rv = refuse(Fare, { ...base, applies_when: { all: [] } });
  check("un tarif à portée vide est REFUSÉ à l'écriture — c'est là que se joue la garantie", rv.refuse, rv.motif);
  check("…et le motif nomme la portée", rv.motif.includes("applies_when"), rv.motif);
  check("un tarif à portée vide IMBRIQUÉE est refusé aussi", refuse(Fare, { ...base, applies_when: { all: [{ any: [] }] } }).refuse);
  check("un CONFLIT à portée vide est refusé de la même façon — il éteindrait tous les prix du canal",
    refuse(FareConflict, { ...CONFLIT_FINNAIR, applies_when: { any: [] } }).refuse);
  check("et le même tarif, avec une portée qui dit quelque chose, passe — le témoin n'est pas vacant",
    Fare.safeParse({ ...base, applies_when: { all: [{ fact: "placement", op: "eq", value: "hold" }] } }).success);
}

console.log("\n=== 10. LES CINQ SABOTAGES DE PROVENANCE (P0-1, second tour) ===");
{
  /* Mon contrôle maison vérifiait que `quote`, `quote_language` et `locator` EXISTAIENT. Il ne
     regardait ni la page, ni le type de source, ni la cadence de relecture. Ces cinq objets
     passaient tous. Ils sont rejoués ici un par un, sur le tarif ET sur l'observation de conflit. */
  const bon = {
    id: "fare_temoin_provenance", placement: "hold",
    price: { kind: "exact", amounts: [{ amount: 725, currency: "EUR" }] },
    billing_subject: "container", journey_basis: "per_segment",
    applies_when: { all: [{ fact: "placement", op: "eq", value: "hold" }] },
    source: SRC_SAS,
  };
  check("préalable : le tarif témoin, avec sa provenance réelle, est accepté", Fare.safeParse(bon).success,
    JSON.stringify(Fare.safeParse(bon).error?.issues ?? "").slice(0, 240));

  const SABOTAGES = [
    ["auto-citation : une URL mydogcanfly.com", { url: "https://mydogcanfly.com/tools/tarifs" }],
    ["auto-citation : un SOUS-DOMAINE à nous", { url: "https://www.mydogcanfly.com/fr/compagnies/sas" }],
    ["un article de PRESSE ne fonde pas un prix", { source_type: "press" }],
    ["un type de source « other » non plus", { source_type: "other" }],
    ["une URL `ftp://` n'est pas une page consultable", { url: "ftp://flysas.com/tarifs.txt" }],
    ["une échéance de relecture repoussée à 2030 — c'est-à-dire aucune relecture", { review_due: "2030-01-01" }],
    ["une échéance trop COURTE est refusée aussi : la cadence est de 90 jours au jour près, pas « au plus »", { review_due: "2026-10-01" }],
  ];
  for (const [libelle, mutation] of SABOTAGES) {
    const saboteFare = { ...bon, source: { ...SRC_SAS, ...mutation } };
    const rf = refuse(Fare, saboteFare);
    check(`tarif — ${libelle} : REFUSÉ`, rf.refuse, rf.motif);
    const saboteObs = {
      ...CONFLIT_FINNAIR,
      observations: [CONFLIT_FINNAIR.observations[0], { ...CONFLIT_FINNAIR.observations[1], source: { ...SRC_FIN_B, ...mutation } }],
    };
    check(`observation de conflit — ${libelle} : REFUSÉE`, refuse(FareConflict, saboteObs).refuse);
  }
  /* Et la garantie de fond : le contrat n'est pas recopié dans `tarifs.ts`, il est RÉEMPLOYÉ.
     Une observation isolée doit donc être refusée par les mêmes règles qu'un tarif. */
  check("`FareObservation` et `Fare` refusent la même source inadmissible — un seul contrat, pas deux",
    refuse(FareObservation, { price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }] }, source: { ...SRC_FIN_A, source_type: "press" } }).refuse);
  check("…et acceptent la même source admissible",
    FareObservation.safeParse({ price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }] }, source: SRC_FIN_A }).success);
  check("un lien officiel SANS citation ne devient pas une preuve de prix par la bande",
    refuse(FareObservation, { price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }] }, source: { url: SRC_FIN_A.url, source_type: "official_website", verified_date: "2026-09-10", review_due: "2026-12-09", confidence: 4, reviewer: "x", history: [] } }).refuse);
}

console.log("\n=== 11. UN FAUX CONFLIT NE PEUT PLUS ÉTEINDRE UN VRAI TARIF (P0-2, second tour) ===");
{
  /* Le sabotage le plus coûteux : il ne publie pas un prix faux, il EFFACE un prix vrai. */
  const deuxFoisLeMeme = {
    ...CONFLIT_FINNAIR,
    observations: [CONFLIT_FINNAIR.observations[0], { ...CONFLIT_FINNAIR.observations[0] }],
  };
  const r1 = refuse(FareConflict, deuxFoisLeMeme);
  check("deux observations STRICTEMENT identiques ne sont pas un conflit — refusé", r1.refuse, r1.motif);
  check("…et le motif nomme les prix, pas la forme", r1.motif.includes("observations"), r1.motif);
  const memePrixDeuxPages = {
    ...CONFLIT_FINNAIR,
    observations: [
      { price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }] }, source: SRC_FIN_A },
      { price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }] }, source: SRC_FIN_B },
    ],
  };
  check("deux pages DIFFÉRENTES qui publient le MÊME montant ne se contredisent pas — refusé",
    refuse(FareConflict, memePrixDeuxPages).refuse, refuse(FareConflict, memePrixDeuxPages).motif);
  const memeMontantAutreOrdre = {
    ...CONFLIT_FINNAIR,
    observations: [
      { price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }, { amount: 150, currency: "USD" }] }, source: SRC_FIN_A },
      { price: { kind: "exact", amounts: [{ amount: 150, currency: "USD" }, { amount: 140, currency: "EUR" }] }, source: SRC_FIN_B },
    ],
  };
  check("…même écrits dans un autre ordre de devises : le prix canonique les reconnaît identiques",
    refuse(FareConflict, memeMontantAutreOrdre).refuse);

  const deuxMecanismes = {
    ...CONFLIT_FINNAIR,
    observations: [
      { price: { kind: "quote", amounts: [] }, source: SRC_FIN_A },
      { price: { kind: "calculator", amounts: [] }, source: SRC_FIN_B },
    ],
  };
  const r2 = refuse(FareConflict, deuxMecanismes);
  check("« sur devis » contre « calculateur » n'est pas un désaccord sur un MONTANT — refusé", r2.refuse, r2.motif);
  check("un conflit MIXTE (un montant, un mécanisme) est refusé aussi",
    refuse(FareConflict, { ...CONFLIT_FINNAIR, observations: [CONFLIT_FINNAIR.observations[0], { price: { kind: "quote", amounts: [] }, source: SRC_FIN_B }] }).refuse);

  for (const axe of ["billing_subject", "journey_basis"]) {
    const sans = { ...CONFLIT_FINNAIR }; delete sans[axe];
    check(`un conflit sans \`${axe}\` est refusé : deux prix ne se contredisent que sur des axes communs`,
      refuse(FareConflict, sans).refuse, refuse(FareConflict, sans).motif);
  }

  /* P0-1, TROISIÈME TOUR : des devises entièrement disjointes ne se contredisent sur rien. Sans
     conversion — et ce contrat n'en fait aucune — « 100 EUR » et « 120 USD » sont deux montants
     parallèles, exactement ce que le contrat reconnaît comme normal sur un tarif ordinaire depuis
     l'annexe 44. J'avais écrit la règle pour les tarifs et oublié de l'appliquer aux conflits. */
  const devisesDisjointes = {
    ...CONFLIT_FINNAIR,
    observations: [
      { price: { kind: "exact", amounts: [{ amount: 100, currency: "EUR" }] }, source: SRC_FIN_A },
      { price: { kind: "exact", amounts: [{ amount: 120, currency: "USD" }] }, source: SRC_FIN_B },
    ],
  };
  const r3 = refuse(FareConflict, devisesDisjointes);
  check("« 100 EUR » contre « 120 USD » : devises disjointes, aucun désaccord — REFUSÉ", r3.refuse, r3.motif);
  check("…et le motif nomme la devise commune manquante", r3.motif.toLowerCase().includes("devise commune"), r3.motif);
  const communeEtDisjointe = {
    ...CONFLIT_FINNAIR,
    observations: [
      { price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }, { amount: 150, currency: "USD" }] }, source: SRC_FIN_A },
      { price: { kind: "exact", amounts: [{ amount: 120, currency: "EUR" }, { amount: 900, currency: "JPY" }] }, source: SRC_FIN_B },
    ],
  };
  check("il suffit d'UNE devise commune en désaccord pour que le conflit tienne — le témoin n'est pas vacant",
    FareConflict.safeParse(communeEtDisjointe).success,
    JSON.stringify(FareConflict.safeParse(communeEtDisjointe).error?.issues ?? "").slice(0, 240));
  const memeDeviseMemeValeur = {
    ...CONFLIT_FINNAIR,
    observations: [
      { price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }, { amount: 150, currency: "USD" }] }, source: SRC_FIN_A },
      { price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }, { amount: 900, currency: "JPY" }] }, source: SRC_FIN_B },
    ],
  };
  check("…mais une devise commune qui dit la MÊME valeur ne suffit pas : le désaccord doit porter sur elle",
    refuse(FareConflict, memeDeviseMemeValeur).refuse, refuse(FareConflict, memeDeviseMemeValeur).motif);

  /* P1-1 : une seule preuve, citée deux fois, ne fabrique pas un désaccord. */
  const unePreuveDeuxPrix = {
    ...CONFLIT_FINNAIR,
    observations: [
      { price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }] }, source: SRC_FIN_A },
      { price: { kind: "exact", amounts: [{ amount: 120, currency: "EUR" }] }, source: { ...SRC_FIN_A } },
    ],
  };
  const r4 = refuse(FareConflict, unePreuveDeuxPrix);
  check("deux prix différents adossés à la MÊME preuve exacte (URL, localisateur, citation, date) — REFUSÉ", r4.refuse, r4.motif);
  check("…et le motif nomme les preuves, pas les prix", r4.motif.toLowerCase().includes("preuves distinctes"), r4.motif);
  const deuxSectionsMemePage = {
    ...CONFLIT_FINNAIR,
    observations: [
      { price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }] }, source: SRC_FIN_A },
      { price: { kind: "exact", amounts: [{ amount: 120, currency: "EUR" }] }, source: { ...SRC_FIN_A, locator: "Excess baggage fees → Pets", quote: "120 EUR / 600 EUR" } },
    ],
  };
  check("DEUX SECTIONS de la même page restent deux preuves — l'exigence ne réclame ni deux domaines ni deux URL",
    FareConflict.safeParse(deuxSectionsMemePage).success,
    JSON.stringify(FareConflict.safeParse(deuxSectionsMemePage).error?.issues ?? "").slice(0, 240));
  check("…une même page relue à DEUX DATES compte aussi pour deux preuves",
    FareConflict.safeParse({ ...CONFLIT_FINNAIR, observations: [
      CONFLIT_FINNAIR.observations[0],
      { price: { kind: "exact", amounts: [{ amount: 120, currency: "EUR" }] },
        source: { ...SRC_FIN_A, verified_date: "2026-08-15", review_due: "2026-11-13" } },
    ] }).success);
  /* CE QUE CE CONTRÔLE NE PROUVE PAS, et qu'il ne faut pas lui faire dire. */
  check("ce contrôle n'établit PAS que le nombre correspond à la phrase citée — cette relecture reste humaine",
    FareConflict.safeParse({ ...CONFLIT_FINNAIR, observations: [
      { price: { kind: "exact", amounts: [{ amount: 999, currency: "EUR" }] }, source: SRC_FIN_A },
      { price: { kind: "exact", amounts: [{ amount: 888, currency: "EUR" }] }, source: SRC_FIN_B },
    ] }).success);

  /* La fenêtre d'achat du conflit est RÉELLEMENT évaluée : un désaccord daté ne couvre pas un
     achat hors de sa fenêtre, et n'éteint donc pas un tarif qu'il ne concerne pas. */
  const tarif = {
    id: "fare_finnair_hold_europe", placement: "hold",
    price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }] },
    billing_subject: "pet", journey_basis: "per_one_way",
    applies_when: { all: [{ fact: "route.dest_country_id", op: "eq", value: "country_fi" }] }, source: SRC_FIN_A,
  };
  const conflitFenetre = { ...CONFLIT_FINNAIR, purchase_window: { max_days_before_departure: 6 } };
  const faits = { "route.dest_country_id": "country_fi" };
  check("préalable : le conflit à fenêtre est accepté", FareConflict.safeParse(conflitFenetre).success,
    JSON.stringify(FareConflict.safeParse(conflitFenetre).error?.issues ?? "").slice(0, 240));
  const dansLaFenetre = resoudreTarif([tarif], [conflitFenetre], "hold", { ...faits, days_before_departure: 2 });
  check("achat à J-2, dans la fenêtre du conflit → le montant est éteint",
    dansLaFenetre.conflits.length === 1 && dansLaFenetre.montants.length === 0 && dansLaFenetre.supprimes.length === 1);
  const horsFenetre = resoudreTarif([tarif], [conflitFenetre], "hold", { ...faits, days_before_departure: 40 });
  check("achat à J-40, HORS de la fenêtre du conflit → le montant survit : un désaccord daté ne déborde pas",
    horsFenetre.conflits.length === 0 && horsFenetre.montants.length === 1, JSON.stringify(horsFenetre).slice(0, 200));
  const fenetreInconnue = resoudreTarif([tarif], [conflitFenetre], "hold", faits);
  check("délai inconnu → le conflit couvre quand même : ne pas savoir n'autorise pas à publier",
    fenetreInconnue.conflits.length === 1 && fenetreInconnue.montants.length === 0);
}

console.log("\n=== 12. AUCUNE LIGNE NE DISPARAÎT PAR PRIORITÉ INTERNE (P1, second tour) ===");
{
  const base = {
    placement: "hold", billing_subject: "container", journey_basis: "per_segment",
    applies_when: { all: [{ fact: "route.dest_country_id", op: "eq", value: "country_cn" }] },
  };
  const montant = { ...base, id: "fare_num", price: { kind: "exact", amounts: [{ amount: 725, currency: "EUR" }] }, source: SRC_SAS };
  const mecanisme = { ...base, id: "fare_booking", price: { kind: "booking_only", amounts: [] }, source: { ...SRC_SAS, quote: "the exact price is shown during booking", locator: "Fees → booking flow" } };
  const faits = { "route.dest_country_id": "country_cn" };
  const r = resoudreTarif([montant, mecanisme], [], "hold", faits);
  check("un montant ET un `booking_only` applicables ensemble : LES DEUX sortent",
    r.montants.length === 1 && r.montants[0].id === "fare_num" && r.mecanismes.length === 1 && r.mecanismes[0].id === "fare_booking",
    JSON.stringify({ montants: r.montants.map((f) => f.id), mecanismes: r.mecanismes.map((f) => f.id) }));
  check("…c'est exactement le sabotage de Codex : le mécanisme ne disparaît plus derrière le montant",
    r.mecanismes.length === 1);

  /* Plusieurs conflits couvrants : `find()` n'en gardait qu'un. */
  /* Les deux conflits portent les AXES du tarif qu'ils contestent — sans quoi ils ne l'éteindraient
     pas, et le témoin croirait constater une suppression qui n'a pas lieu (porte P0-2, 3e tour). */
  const axesDuTarif = { billing_subject: "container", journey_basis: "per_segment" };
  const c1 = { ...CONFLIT_FINNAIR, ...axesDuTarif, id: "conflit_un", applies_when: { all: [{ fact: "route.dest_country_id", op: "eq", value: "country_cn" }] } };
  const c2 = { ...CONFLIT_FINNAIR, ...axesDuTarif, id: "conflit_deux", applies_when: undefined, scope_label: "toutes destinations" };
  const rc = resoudreTarif([montant], [c1, c2], "hold", faits);
  check("DEUX conflits couvrent le trajet → les deux sont rendus, jamais le premier seul",
    rc.conflits.length === 2 && rc.conflits.map((c) => c.id).join(",") === "conflit_un,conflit_deux", JSON.stringify(rc.conflits.map((c) => c.id)));
  check("…et le montant qu'ils éteignent est nommé une fois dans `supprimes`",
    rc.montants.length === 0 && rc.supprimes.length === 1 && rc.supprimes[0].id === "fare_num");
  check("…tandis que le MÉCANISME survit au conflit : l'effet publié est `suppress_exact_fare`, pas « tout effacer »",
    resoudreTarif([montant, mecanisme], [c1], "hold", faits).mecanismes.length === 1);

  /* P0-2, TROISIÈME TOUR — LE TÉMOIN INDISPENSABLE. Ma « prudence » effaçait une information
     officielle sans rapport avec le désaccord. Un conflit sur le prix par contenant supprime CE
     prix ; le supplément par kilogramme, sur lequel aucune page ne se contredit, reste publié. */
  const parContenant = {
    ...base, id: "fare_transport", billing_subject: "container", journey_basis: "per_segment",
    price: { kind: "exact", amounts: [{ amount: 100, currency: "EUR" }] }, source: SRC_SAS,
  };
  const parKilo = {
    ...base, id: "fare_surcharge", billing_subject: "kilogram", journey_basis: "per_segment",
    price: { kind: "exact", amounts: [{ amount: 5, currency: "EUR" }] },
    source: { ...SRC_SAS, quote: "an additional 5 EUR per kilogram applies", locator: "Fees → Excess weight" },
  };
  const conflitContenant = {
    ...CONFLIT_FINNAIR, id: "conflit_par_contenant", placement: "hold",
    billing_subject: "container", journey_basis: "per_segment",
    applies_when: { all: [{ fact: "route.dest_country_id", op: "eq", value: "country_cn" }] },
    observations: [
      { price: { kind: "exact", amounts: [{ amount: 100, currency: "EUR" }] }, source: SRC_FIN_A },
      { price: { kind: "exact", amounts: [{ amount: 120, currency: "EUR" }] }, source: SRC_FIN_B },
    ],
  };
  check("préalable : le conflit par contenant est accepté", FareConflict.safeParse(conflitContenant).success,
    JSON.stringify(FareConflict.safeParse(conflitContenant).error?.issues ?? "").slice(0, 240));
  const cible = resoudreTarif([parContenant, parKilo], [conflitContenant], "hold", faits);
  check("le conflit éteint le prix PAR CONTENANT, qu'il conteste",
    cible.supprimes.length === 1 && cible.supprimes[0].id === "fare_transport", JSON.stringify(cible.supprimes.map((f) => f.id)));
  check("…et le supplément PAR KILOGRAMME reste dans `montants` : aucune page ne se contredit à son sujet",
    cible.montants.length === 1 && cible.montants[0].id === "fare_surcharge", JSON.stringify(cible.montants.map((f) => f.id)));
  check("…et le conflit reste NOMMÉ dans l'inventaire, pour que la fiche puisse dire ce qu'elle tait",
    cible.conflits.length === 1 && cible.conflits[0].id === "conflit_par_contenant");
  const memeAxeAutreBase = { ...parContenant, id: "fare_par_trajet", journey_basis: "per_journey" };
  const cible2 = resoudreTarif([memeAxeAutreBase], [conflitContenant], "hold", faits);
  check("un tarif au MÊME sujet facturé mais sur une autre base de trajet survit aussi — les deux axes comptent",
    cible2.montants.length === 1 && cible2.supprimes.length === 0, JSON.stringify(cible2).slice(0, 200));
  const cible3 = resoudreTarif([parContenant], [conflitContenant], "hold", faits);
  check("…et le témoin n'est pas vacant : seul, le prix contesté est bien éteint",
    cible3.montants.length === 0 && cible3.supprimes.length === 1);

  /* Un chevauchement ne masque plus le reste de l'inventaire non plus. */
  const a = { ...montant, id: "fare_x", price: { kind: "exact", amounts: [{ amount: 725, currency: "EUR" }] } };
  const b = { ...montant, id: "fare_y", price: { kind: "exact", amounts: [{ amount: 680, currency: "EUR" }] } };
  const indecidable = { ...montant, id: "fare_zone", applies_when: { all: [{ fact: "route.origin_airport_id", op: "eq", value: "airport_cdg" }] } };
  const tout = resoudreTarif([a, b, mecanisme, indecidable], [], "hold", faits);
  check("un supplément d'un AUTRE sujet facturé n'est pas un chevauchement : il s'ajoute, il ne conteste pas",
    resoudreTarif([a, { ...parKilo, id: "fare_kg_bis" }], [], "hold", faits).montants.length === 2);
  check("chevauchement, mécanisme et indécidable coexistent dans le MÊME inventaire",
    tout.chevauchements.length === 2 && tout.mecanismes.length === 1 && tout.indecidables.length === 1 && tout.montants.length === 0,
    JSON.stringify({ ch: tout.chevauchements.length, me: tout.mecanismes.length, ind: tout.indecidables.length, mo: tout.montants.length }));
  check("une résolution qui ne dit rien se reconnaît à ses six listes vides",
    resolutionVide(resoudreTarif([], [], "hold", faits)) && !resolutionVide(tout));
}

console.log("\n=== 13. La projection ne perd pas les tarifs — la faute du 08/09, deux fois apprise ===");
{
  const politique = {
    availability: "offered",
    source: { ...SRC_SAS, quote: "it will need to travel in the cargo hold", locator: "Pets traveling in hold → opening paragraph" },
    fares: [{
      id: "fare_sas_hold_china", placement: "hold",
      price: { kind: "exact", amounts: [{ amount: 725, currency: "EUR" }] },
      billing_subject: "container", journey_basis: "per_segment",
      applies_when: { all: [{ fact: "route.dest_country_id", op: "eq", value: "country_cn" }] },
      source: SRC_SAS,
    }],
    fare_conflicts: [],
  };
  const parsed = PlacementPolicyAuthored.safeParse(politique);
  check("une politique d'auteur peut porter ses tarifs", parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues).slice(0, 240));
  if (parsed.success) {
    const proj = projectPlacementPolicy(parsed.data);
    check("et la PROJECTION les transporte jusqu'au moteur — un champ absent de la liste de projection serait perdu en silence",
      Array.isArray(proj.fares) && proj.fares.length === 1 && proj.fares[0].id === "fare_sas_hold_china", JSON.stringify(proj.fares ?? null).slice(0, 200));
    check("le statut du canal, lui, ne bouge pas d'un iota : un tarif ne décide jamais d'un canal",
      proj.status === "accepted_with_conditions", proj.status);
  }
}

console.log("\n=== 14. L'import réel ne peut plus retomber silencieusement à zéro ===");
{
  const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
  let avecTarifs = 0, lignesTarifaires = 0, avecConflits = 0;
  const compagnies = new Set();
  for (const a of objets.airlines) for (const p of Object.values(a.premium?.policy ?? {})) {
    if (Array.isArray(p.fares) && p.fares.length) { avecTarifs++; lignesTarifaires += p.fares.length; compagnies.add(a.id); }
    if (Array.isArray(p.fare_conflicts) && p.fare_conflicts.length) avecConflits++;
  }
  check("l'import verrouillé porte exactement 216 lignes sur 121 canaux et 70 compagnies — les dix valeurs SAS sont regroupées en huit lignes de zone, jamais perdues",
    avecTarifs === 121 && lignesTarifaires === 216 && compagnies.size === 70,
    `${lignesTarifaires} ligne(s), ${avecTarifs} canal(aux), ${compagnies.size} compagnie(s)`);
  const airFrance = objets.airlines.find((a) => a.id === "airline_air_france")?.premium?.policy;
  const montantsUniques = (p, currency) => [...new Set((p?.fares ?? []).flatMap((f) =>
    f.price.amounts.filter((m) => m.currency === currency).map((m) => m.amount)
  ))].sort((a, b) => a - b);
  check("Air France : les SEPT lignes officielles traversent l'ingestion en cabine et en soute, chacune avec sa preuve propre",
    airFrance?.cabin?.fares?.length === 7 && airFrance?.hold?.fares?.length === 7
      && [...airFrance.cabin.fares, ...airFrance.hold.fares].every((f) =>
        f.price.kind === "matrix" && f.source?.url === "https://wwws.airfrance.fr/information/passagers/voyager-avec-son-animal-chien-chat"
          && f.source?.verified_date === "2026-09-11" && f.source?.review_due === "2026-12-10"
          && f.source?.quote && f.source?.locator),
    JSON.stringify({ cabin: airFrance?.cabin?.fares?.length, hold: airFrance?.hold?.fares?.length }));
  check("Air France : la grille EUR reste complète — cabine 70/125/200/250, soute 100/200/400/600/750",
    JSON.stringify(montantsUniques(airFrance?.cabin, "EUR")) === JSON.stringify([70, 125, 200, 250])
      && JSON.stringify(montantsUniques(airFrance?.hold, "EUR")) === JSON.stringify([100, 200, 400, 600, 750]),
    JSON.stringify({ cabin: montantsUniques(airFrance?.cabin, "EUR"), hold: montantsUniques(airFrance?.hold, "EUR") }));
  const transavia = objets.airlines.find((a) => a.id === "airline_transavia")?.premium?.policy?.hold?.fares ?? [];
  check("Transavia : 77 EUR reste borné aux vols HV et les vols TO publient leur minimum de 100 EUR",
    transavia.length === 2
      && transavia.some((f) => f.scope_label === "HV" && f.price.kind === "exact" && f.price.amounts?.[0]?.amount === 77)
      && transavia.some((f) => f.scope_label === "TO" && f.price.kind === "minimum" && f.price.amounts?.[0]?.amount === 100)
      && transavia.every((f) => f.source?.verified_date === "2026-09-11" && f.source?.review_due === "2026-12-10"),
    JSON.stringify(transavia.map((f) => ({ scope: f.scope_label, kind: f.price.kind, amount: f.price.amounts?.[0]?.amount }))));
  check("la présentation ne tronque pas la grille Air France et distingue les deux préfixes Transavia",
    presentNumericFares(airFrance.cabin.fares, { locale: "fr", minimumLabel: "à partir de" })?.includes("70")
      && presentNumericFares(airFrance.cabin.fares, { locale: "fr", minimumLabel: "à partir de" })?.includes("250")
      && presentNumericFares(transavia, { locale: "fr", minimumLabel: "à partir de" })?.includes("77")
      && presentNumericFares(transavia, { locale: "fr", minimumLabel: "à partir de" })?.includes("100")
      && presentNumericFares(transavia, { locale: "fr", minimumLabel: "à partir de" })?.includes("(HV)")
      && presentNumericFares(transavia, { locale: "fr", minimumLabel: "à partir de" })?.includes("(TO)"));
  const lufthansa = objets.airlines.find((a) => a.id === "airline_lufthansa")?.premium?.policy?.hold?.fares ?? [];
  check("Lufthansa : le calculateur de base et les DEUX suppléments officiels coexistent sans que 150 EUR devienne un prix total",
    lufthansa.length === 3 && lufthansa.some((f) => f.price.kind === "calculator")
      && lufthansa.some((f) => f.scope_label === "+ BRU/GVA/FRA/VIE/ZRH" && f.price.amounts?.some((m) => m.currency === "EUR" && m.amount === 150))
      && lufthansa.some((f) => f.scope_label === "+ ZRH (>24 h)" && f.price.amounts?.some((m) => m.currency === "CHF" && m.amount === 200))
      && presentNumericFares(lufthansa, { locale: "fr", minimumLabel: "à partir de" })?.includes("(+ BRU/GVA/FRA/VIE/ZRH)")
      && presentNumericFares(lufthansa, { locale: "fr", minimumLabel: "à partir de" })?.includes("(+ ZRH (>24 h))")
      && lufthansa.every((f) => f.source?.verified_date === "2026-09-11" && f.source?.review_due === "2026-12-10"),
    JSON.stringify(lufthansa.map((f) => ({ kind: f.price.kind, scope: f.scope_label }))));
  const airEuropa = objets.airlines.find((a) => a.id === "airline_air_europa")?.premium?.policy;
  check("Air Europa : les quatre zones et quatre devises traversent l'ingestion sur les deux canaux",
    airEuropa?.cabin?.fares?.length === 4 && airEuropa?.hold?.fares?.length === 4
      && [...airEuropa.cabin.fares, ...airEuropa.hold.fares].every((f) => f.price.kind === "matrix" && f.price.amounts?.length === 4
        && f.source?.url === "https://www.aireuropa.com/be/fr/aea/informations-pour-voler/passagers/animaux-de-compagnie.html"
        && f.source?.verified_date === "2026-09-11" && f.source?.review_due === "2026-12-10"));
  check("Air Europa : l'amplitude EUR publiée reste 35–175 en cabine et 90–350 en soute",
    presentNumericFares(airEuropa.cabin.fares, { locale: "fr", minimumLabel: "à partir de" })?.includes("35")
      && presentNumericFares(airEuropa.cabin.fares, { locale: "fr", minimumLabel: "à partir de" })?.includes("175")
      && presentNumericFares(airEuropa.hold.fares, { locale: "fr", minimumLabel: "à partir de" })?.includes("90")
      && presentNumericFares(airEuropa.hold.fares, { locale: "fr", minimumLabel: "à partir de" })?.includes("350"));
  const iberia = objets.airlines.find((a) => a.id === "airline_iberia")?.premium?.policy;
  check("Iberia : les 12 cases cabine et 18 cases soute traversent avec trois devises et leur preuve propre",
    iberia?.cabin?.fares?.length === 12 && iberia?.hold?.fares?.length === 18
      && [...iberia.cabin.fares, ...iberia.hold.fares].every((f) => f.price.kind === "matrix"
        && f.price.amounts?.length === 3 && f.source?.url?.startsWith("https://www.iberia.com/fr/")
        && f.source?.verified_date === "2026-09-11" && f.source?.review_due === "2026-12-10"
        && f.source?.quote?.length >= 10 && f.source?.locator?.length > 0));
  check("Iberia : aucune extrémité de la grille n'est perdue — cabine 40–220 EUR, soute 90–385 EUR",
    presentNumericFares(iberia.cabin.fares, { locale: "fr", minimumLabel: "à partir de" })?.includes("40")
      && presentNumericFares(iberia.cabin.fares, { locale: "fr", minimumLabel: "à partir de" })?.includes("220")
      && presentNumericFares(iberia.hold.fares, { locale: "fr", minimumLabel: "à partir de" })?.includes("90")
      && presentNumericFares(iberia.hold.fares, { locale: "fr", minimumLabel: "à partir de" })?.includes("385"));
  const austrian = objets.airlines.find((a) => a.id === "airline_austrian")?.premium?.policy;
  check("Austrian : les dix cases soute distinguent cinq trajets et deux tailles de caisse",
    austrian?.hold?.fares?.length === 10
      && austrian.hold.fares.every((f) => f.price.kind === "matrix" && f.price.amounts?.length === 1
        && f.billing_subject === "container" && f.journey_basis === "per_segment"
        && f.source?.url?.startsWith("https://www.austrian.com/fr/fr/")
        && f.source?.verified_date === "2026-09-11" && f.source?.review_due === "2026-12-10"));
  check("Austrian : l'amplitude officielle 80–380 EUR est entière, jamais réduite à la première ligne",
    JSON.stringify(montantsUniques(austrian?.hold, "EUR")) === JSON.stringify([80, 100, 130, 160, 170, 190, 200, 260, 340, 380])
      && presentNumericFares(austrian.hold.fares, { locale: "fr", minimumLabel: "à partir de" })?.includes("80")
      && presentNumericFares(austrian.hold.fares, { locale: "fr", minimumLabel: "à partir de" })?.includes("380"));
  const klm = objets.airlines.find((a) => a.id === "airline_klm")?.premium?.policy;
  check("KLM porte bien sa fourchette officielle 70–500 EUR en cabine ET en soute",
    ["cabin", "hold"].every((p) => klm?.[p]?.fares?.some((f) => f.price.kind === "range"
      && f.price.amounts[0]?.amount === 70 && f.price.amounts[1]?.amount === 500 && f.price.amounts[0]?.currency === "EUR")));
  const sas = objets.airlines.find((a) => a.id === "airline_sas")?.premium?.policy;
  check("SAS : les huit zones cabine/soute traversent avec leurs cinq devises et leur preuve suédoise propre",
    sas?.cabin?.fares?.length === 4 && sas?.hold?.fares?.length === 4
      && [...sas.cabin.fares, ...sas.hold.fares].every((f) => f.price.kind === "matrix"
        && f.price.amounts?.length === 5 && f.billing_subject === "container" && f.journey_basis === "per_segment"
        && f.source?.url === "https://www.sas.se/reseinfo/resa-med-djur/kabin"
        && f.source?.quote_language === "sv" && f.source?.verified_date === "2026-09-12"
        && f.source?.review_due === "2026-12-11"));
  check("SAS : les amplitudes officielles restent entières — cabine 55–149 EUR, soute 90–725 EUR",
    presentNumericFares(sas.cabin.fares, { locale: "fr", minimumLabel: "à partir de" })?.includes("55")
      && presentNumericFares(sas.cabin.fares, { locale: "fr", minimumLabel: "à partir de" })?.includes("149")
      && presentNumericFares(sas.hold.fares, { locale: "fr", minimumLabel: "à partir de" })?.includes("90")
      && presentNumericFares(sas.hold.fares, { locale: "fr", minimumLabel: "à partir de" })?.includes("725"));
  const swiss = objets.airlines.find((a) => a.id === "airline_swiss")?.premium?.policy;
  const montants = (p) => (p?.fares ?? []).flatMap((f) => f.price.amounts.map((m) => `${m.currency}:${m.amount}`)).sort();
  check("SWISS multidevise ne croise jamais le montant précédent avec la devise suivante",
    JSON.stringify(montants(swiss?.cabin)) === JSON.stringify(["CHF:75", "EUR:65", "USD:80"])
      && JSON.stringify(montants(swiss?.hold)) === JSON.stringify(["CHF:440", "EUR:380", "USD:445"]),
    JSON.stringify({ cabin: montants(swiss?.cabin), hold: montants(swiss?.hold) }));
  const jal = objets.airlines.find((a) => a.id === "airline_jal")?.premium?.policy?.hold?.fares?.[0];
  check("JAL : une devise écrite une fois encadre bien les deux bornes 5 500–7 700 JPY",
    jal?.price?.kind === "range" && jal.price.amounts?.[0]?.amount === 5500 && jal.price.amounts?.[1]?.amount === 7700);
  const norwegian = objets.airlines.find((a) => a.id === "airline_norwegian")?.premium?.policy;
  check("Norwegian : les fourchettes à devise suffixée gardent leurs deux bornes",
    norwegian?.cabin?.fares?.[0]?.price?.kind === "range" && norwegian.cabin.fares[0].price.amounts?.[0]?.amount === 55
      && norwegian.cabin.fares[0].price.amounts?.[1]?.amount === 75
      && norwegian?.hold?.fares?.[0]?.price?.kind === "range" && norwegian.hold.fares[0].price.amounts?.[0]?.amount === 150
      && norwegian.hold.fares[0].price.amounts?.[1]?.amount === 180);
  const condor = objets.airlines.find((a) => a.id === "airline_condor")?.premium?.policy?.cabin?.fares?.[0];
  check("Condor : « ab 59,99 Euro » devient un minimum en EUR, jamais un prix exact",
    condor?.price?.kind === "minimum" && condor.price.amounts?.[0]?.amount === 59.99 && condor.price.amounts?.[0]?.currency === "EUR");
  const delta = objets.airlines.find((a) => a.id === "airline_delta")?.premium?.policy?.cabin;
  check("Delta : « $150 USD/CAD » conserve les deux devises sur le même montant",
    JSON.stringify(montants(delta)) === JSON.stringify(["CAD:150", "USD:150"]), JSON.stringify(montants(delta)));
  const ibx = objets.airlines.find((a) => a.id === "airline_iberia_express")?.premium?.policy?.cabin;
  check("Iberia Express : le dollar suffixé de « 40€/50$/35£ » reste rattaché à l'USD",
    JSON.stringify(montants(ibx)) === JSON.stringify(["EUR:40", "GBP:35", "USD:50"]), JSON.stringify(montants(ibx)));
  check("…ni aucun conflit tarifaire", avecConflits === 0, `${avecConflits} politique(s) portent déjà un conflit`);
}

console.log("\n=== 15. L'INGESTION, jouée six fois sur un bac à sable : une nominale, quatre sabotées, une non-vacuité (P0-3) ===");
{
  const { mkdtempSync, cpSync, writeFileSync: ecrire, symlinkSync } = await import("node:fs");
  const { execFileSync } = await import("node:child_process");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const bac = mkdtempSync(join(tmpdir(), "mdcf-tarifs-"));
  /* `test-baselines/` fait partie du bac : l'ingestion lit les identités approuvées, et sans elles
     elle s'arrête avant d'écrire — ce que mon premier jet prenait pour une perte du champ. */
  for (const d of ["content", "packages", "test-baselines"]) cpSync(d, join(bac, d), { recursive: true });
  symlinkSync(join(process.cwd(), "node_modules"), join(bac, "node_modules"), "dir");
  cpSync("package.json", join(bac, "package.json"));
  const fiche = join(bac, "content/airlines/sas.yml");
  const original = readFileSync(fiche, "utf8");
  const objetsOriginaux = readFileSync(join(bac, "packages/knowledge/raw/objects.json"), "utf8");
  const politiquesSasOriginales = JSON.parse(objetsOriginaux).airlines.find((a) => a.id === "airline_sas")?.premium?.policy;

  const SRC_YML = (ind, locator = "Fees → Pet in cargo hold → China", quote = "China: 5400 DKK, 7600 NOK, 7600 SEK, 725 EUR, 775 USD") => [
    `${ind}source:`,
    `${ind}  url: "https://www.flysas.com/en/travel-info/travel-with-pets/in-hold"`,
    `${ind}  source_type: official_website`,
    `${ind}  verified_date: "2026-09-10"`,
    `${ind}  review_due: "2026-12-09"`,
    `${ind}  confidence: 4`,
    `${ind}  reviewer: "harnais du contrat tarifaire"`,
    `${ind}  history: []`,
    `${ind}  quote: ${JSON.stringify(quote)}`,
    `${ind}  quote_language: en`,
    `${ind}  locator: ${JSON.stringify(locator)}`,
  ].join("\n");
  const TARIF_YML = (id, placement) => [
    `      - id: ${id}`,
    `        placement: ${placement}`,
    `        price:`,
    `          kind: exact`,
    `          amounts:`,
    `            - { amount: 725, currency: EUR }`,
    `        billing_subject: container`,
    `        journey_basis: per_segment`,
    `        applies_when: { all: [{ fact: route.dest_country_id, op: eq, value: country_cn }] }`,
    `        purchase_window: { min_days_before_departure: 1 }`,
    `        scope_label: Chine`,
    SRC_YML("        "),
  ].join("\n");
  const CONFLIT_YML = (id, placement) => [
    `      - id: ${id}`,
    `        placement: ${placement}`,
    `        status: unresolved`,
    `        effect: suppress_exact_fare`,
    `        billing_subject: container`,
    `        journey_basis: per_segment`,
    `        observations:`,
    /* DEUX PREUVES DISTINCTES, exigées depuis la porte P1-1 : deux sections de la même page
       officielle, avec chacune sa citation et son localisateur. Mon premier bac à sable citait
       deux fois la même — et la garde neuve l'a refusé, ce qui est exactement son travail. */
    `          - price: { kind: exact, amounts: [{ amount: 725, currency: EUR }] }`,
    SRC_YML("            "),
    `          - price: { kind: exact, amounts: [{ amount: 680, currency: EUR }] }`,
    SRC_YML("            ", "Excess baggage → Pets", "Pet in hold: 680 EUR per container"),
  ].join("\n");

  /** Remplace le bloc `hold:` de la fiche SAS, rejoue l'ingestion, rend sa sortie et l'artefact. */
  const jouer = (blocHold) => {
    ecrire(join(bac, "packages/knowledge/raw/objects.json"), objetsOriginaux);
    const avant = original.indexOf("  hold:\n");
    const apres = original.indexOf("\n  cargo:", avant);
    ecrire(fiche, original.slice(0, avant) + blocHold + original.slice(apres + 1));
    let sortie = "", ok = true;
    try {
      sortie = execFileSync("npx", ["tsx", "packages/knowledge/scripts/ingest-airlines.mjs"], { cwd: bac, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) { ok = false; sortie = String(e.stdout ?? "") + String(e.stderr ?? ""); }
    let artefact = null;
    try { artefact = JSON.parse(readFileSync(join(bac, "packages/knowledge/raw/objects.json"), "utf8")); } catch { /* laissé à null */ }
    return { ok, sortie, artefact };
  };
  const holdSas = (corps) => `  hold:\n    availability: offered\n${corps}`;

  console.log("  — (a) nominale : le tarif traverse la fiche, l'ingestion et l'artefact");
  {
    const { ok, sortie, artefact } = jouer(holdSas(`    fares:\n${TARIF_YML("fare_sas_hold_china", "hold")}\n`));
    check("l'ingestion accepte une fiche qui porte un tarif", ok && /ingested|derived/.test(sortie), sortie.slice(-300));
    const pol = artefact?.airlines.find((a) => a.id === "airline_sas")?.premium?.policy?.hold;
    check("…et le tarif ARRIVE dans l'artefact, avec ses deux axes et sa citation propre",
      Array.isArray(pol?.fares) && pol.fares.length === 1 && pol.fares[0].billing_subject === "container"
        && pol.fares[0].journey_basis === "per_segment" && pol.fares[0].source?.locator === "Fees → Pet in cargo hold → China",
      JSON.stringify(pol?.fares ?? null).slice(0, 260));
    check("…et la portée arrive exécutable, pas aplatie en texte",
      pol?.fares?.[0]?.applies_when?.all?.[0]?.fact === "route.dest_country_id");
    check("…et la FENÊTRE D'ACHAT survit elle aussi au trajet fiche → artefact",
      pol?.fares?.[0]?.purchase_window?.min_days_before_departure === 1);
    check("…et le tarif se résout sur le trajet, depuis l'artefact et non depuis la fixture",
      resoudreTarif(pol?.fares ?? [], [], "hold", { "route.dest_country_id": "country_cn", days_before_departure: 5 }).montants.length === 1);
    check("…et le MÊME tarif, sans délai connu, ne publie aucun montant depuis l'artefact",
      resoudreTarif(pol?.fares ?? [], [], "hold", { "route.dest_country_id": "country_cn" }).indecidables.length === 1);
  }

  console.log("  — (b) SABOTAGE 1 : un tarif `placement: cabin` rangé sous la politique SOUTE");
  {
    const { ok, sortie, artefact } = jouer(holdSas(`    fares:\n${TARIF_YML("fare_sas_hold_china", "cabin")}\n`));
    check("l'ingestion REFUSE — sans cette garde, le tarif serait importé puis jamais retrouvé", !ok, sortie.slice(-260));
    check("…et le motif nomme le canal réel et le canal déclaré", /rangé sous policies\.hold.*placement cabin/s.test(sortie), sortie.slice(-260));
    const politiques = artefact?.airlines.find((a) => a.id === "airline_sas")?.premium?.policy;
    check("…et l'artefact n'a pas bougé : rien n'est écrit quand la fiche est refusée",
      JSON.stringify(politiques) === JSON.stringify(politiquesSasOriginales));
  }

  console.log("  — (c) SABOTAGE 2 : deux tarifs portant exactement le même identifiant");
  {
    const { ok, sortie } = jouer(holdSas(`    fares:\n${TARIF_YML("fare_sas_hold_china", "hold")}\n${TARIF_YML("fare_sas_hold_china", "hold")}\n`));
    check("l'ingestion REFUSE — un identifiant stable qui se partage ne promet plus rien", !ok, sortie.slice(-260));
    check("…et le motif nomme l'identifiant en double", /identifiant de tarif fare_sas_hold_china/.test(sortie), sortie.slice(-260));
  }

  console.log("  — (d) SABOTAGE 3 : un conflit `placement: cargo` rangé sous la politique SOUTE");
  {
    const { ok, sortie } = jouer(holdSas(`    fare_conflicts:\n${CONFLIT_YML("conflit_sas_soute", "cargo")}\n`));
    check("l'ingestion REFUSE — un conflit mal rangé n'éteindrait rien, ou éteindrait le mauvais canal", !ok, sortie.slice(-260));
    check("…et le motif nomme le conflit et son canal", /conflit conflit_sas_soute/.test(sortie), sortie.slice(-260));
  }

  console.log("  — (e) SABOTAGE 4 : deux conflits portant exactement le même identifiant");
  {
    /* La garde d'unicité des identifiants de CONFLITS existait depuis l'annexe 46, et aucune
       ingestion sabotée ne l'exerçait — Codex l'a relevé. Une garde que rien ne mord est une
       garde qu'on croit avoir. */
    const { ok, sortie } = jouer(holdSas(`    fare_conflicts:\n${CONFLIT_YML("conflit_sas_soute", "hold")}\n${CONFLIT_YML("conflit_sas_soute", "hold")}\n`));
    check("l'ingestion REFUSE deux conflits au même identifiant", !ok, sortie.slice(-260));
    check("…et le motif nomme l'identifiant de conflit en double", /identifiant de conflit conflit_sas_soute/.test(sortie), sortie.slice(-260));
  }

  console.log("  — (f) non-vacuité : le MÊME conflit, correctement rangé, est accepté");
  {
    const { ok, sortie, artefact } = jouer(holdSas(`    fare_conflicts:\n${CONFLIT_YML("conflit_sas_soute", "hold")}\n`));
    check("le conflit bien rangé traverse l'ingestion — les quatre gardes refusent la faute, pas la fonction", ok, sortie.slice(-300));
    const pol = artefact?.airlines.find((a) => a.id === "airline_sas")?.premium?.policy?.hold;
    check("…et il arrive dans l'artefact avec ses deux observations",
      Array.isArray(pol?.fare_conflicts) && pol.fare_conflicts.length === 1 && pol.fare_conflicts[0].observations.length === 2,
      JSON.stringify(pol?.fare_conflicts ?? null).slice(0, 200));
  }
}

console.log("\n=== 16. LA FRONTIÈRE ENTRE VALIDATION ET RÉSOLUTION (P1, quatrième tour) ===");
{
  /* LE SABOTAGE DE CODEX, MOT POUR MOT : provenance vers mydogcanfly.com, sans localisateur,
     échéance en 2030. Le schéma le refusait déjà ; le résolveur le publiait quand même. */
  const saboteur = {
    id: "fare_sabote", placement: "hold",
    price: { kind: "exact", amounts: [{ amount: 725, currency: "EUR" }] },
    billing_subject: "container", journey_basis: "per_segment",
    applies_when: { all: [{ fact: "placement", op: "eq", value: "hold" }] },
    source: {
      url: "https://mydogcanfly.com/faux", source_type: "official_website",
      verified_date: "2026-09-10", review_due: "2030-01-01", confidence: 4, reviewer: "x",
      history: [], quote: "un prix inventé de toutes pieces", quote_language: "fr",
    },
  };
  check("préalable : le schéma refuse bien ce tarif — cette moitié-là marchait déjà",
    Fare.safeParse(saboteur).success === false);
  check("`lireTarif` rend `null` : on ne fabrique pas un tarif validé à partir d'une donnée refusée",
    lireTarif(saboteur) === null);
  check("`lireTarif` rend un tarif utilisable quand la donnée est conforme — le témoin n'est pas vacant",
    lireTarif({ ...saboteur, source: SRC_SAS })?.id === "fare_sabote");
  check("`lireConflit` suit la même règle dans les deux sens",
    lireConflit({ ...CONFLIT_FINNAIR, status: "resolved" }) === null && lireConflit(CONFLIT_FINNAIR)?.id === CONFLIT_FINNAIR.id);

  /* LA MOITIÉ QUI MANQUAIT : le résolveur LÈVE au lieu de publier. */
  let leve = null;
  try { resoudreTarif([saboteur], [], "hold", { placement: "hold" }); }
  catch (e) { leve = String(e && e.message); }
  check("`resoudreTarif` LÈVE sur ce tarif — il rendait `montants = 1` avant cette porte", leve !== null, "aucune levée");
  check("…et le message NOMME l'identifiant fautif et son motif",
    !!leve && leve.includes("fare_sabote") && leve.includes("auto-citation"), String(leve).slice(0, 260));
  let leveConflit = null;
  try { resoudreTarif([], [{ ...CONFLIT_FINNAIR, status: "resolved" }], "hold", {}); }
  catch (e) { leveConflit = String(e && e.message); }
  check("un CONFLIT non conforme lève de la même façon", leveConflit !== null && leveConflit.includes(CONFLIT_FINNAIR.id), String(leveConflit).slice(0, 200));
  const bon = lireTarif({ ...saboteur, source: SRC_SAS });
  check("…et le même appel, avec un tarif lu par `lireTarif`, se résout normalement",
    resoudreTarif([bon], [], "hold", { placement: "hold" }).montants.length === 1);

  /* LA MARQUE DE TYPE, éprouvée par une VRAIE compilation. Un `.mjs` n'est pas typé : sans ceci,
     la moitié « compilation » de la frontière ne serait vérifiée par personne. */
  const { mkdtempSync, writeFileSync: ecrire, rmSync } = await import("node:fs");
  const { execFileSync } = await import("node:child_process");
  const { join } = await import("node:path");
  /* Le bac est DANS le dépôt : `tsc` résout `zod` en remontant les dossiers depuis le fichier. */
  const bacTs = mkdtempSync(join(process.cwd(), ".tmp-frontiere-"));
  const compiler = (fichier) => {
    try {
      execFileSync("npx", ["tsc", "--noEmit", "--strict", "--target", "es2022", "--module", "esnext",
        "--moduleResolution", "bundler", "--skipLibCheck", fichier], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      return "";
    } catch (e) { return String(e.stdout ?? "") + String(e.stderr ?? ""); }
  };
  const SRC_TS = `{ url: "https://www.flysas.com/en/travel-info/travel-with-pets/in-hold", source_type: "official_website", verified_date: "2026-09-10", review_due: "2026-12-09", confidence: 4, reviewer: "harnais", history: [], quote: "China: 5400 DKK, 7600 NOK, 7600 SEK, 725 EUR, 775 USD", quote_language: "en", locator: "Fees" }`;
  const CORPS = `id: "f", placement: "hold", price: { kind: "exact", amounts: [{ amount: 725, currency: "EUR" }] }, billing_subject: "container", journey_basis: "per_segment", applies_when: { all: [{ fact: "placement", op: "eq", value: "hold" }] }`;
  try {
    const aLaMain = join(bacTs, "a-la-main.ts");
    ecrire(aLaMain, `import { resoudreTarif } from "../packages/knowledge/src/index";\nimport type { Fare } from "../packages/knowledge/src/index";\nconst t: Fare = { ${CORPS}, source: ${SRC_TS} };\nexport const r = resoudreTarif([t], [], "hold", { placement: "hold" });\n`);
    const erreurs = compiler(aLaMain);
    check("un `Fare` écrit À LA MAIN ne compile pas — même avec une provenance irréprochable",
      erreurs.includes("MARQUE_VALIDE"), erreurs.slice(0, 300) || "compilation acceptée");

    const parLecteur = join(bacTs, "par-lecteur.ts");
    ecrire(parLecteur, `import { lireTarif, resoudreTarif } from "../packages/knowledge/src/index";\nconst t = lireTarif({ ${CORPS}, source: ${SRC_TS} });\nexport const r = t ? resoudreTarif([t], [], "hold", { placement: "hold" }) : null;\n`);
    /* Une seule compilation : l'argument de détail est évalué même quand l'assertion passe, et
       appelait donc `tsc` une seconde fois pour rien. Relevé par Codex sur `a676fb8`, jugé trop
       mince pour justifier une tête à lui seul ; replié ici, dans le premier commit qui rouvre ce
       fichier, comme annoncé. */
    const erreursLecteur = compiler(parLecteur);
    check("…et le MÊME tarif, passé par `lireTarif`, compile proprement : la marque refuse la faute, pas la fonction",
      erreursLecteur === "", erreursLecteur.slice(0, 300));

    /* CE QUE LA MARQUE NE FAIT PAS, et pourquoi le reparsage existe. */
    const transtypage = join(bacTs, "transtypage.ts");
    ecrire(transtypage, `import { resoudreTarif } from "../packages/knowledge/src/index";\nimport type { Fare } from "../packages/knowledge/src/index";\nconst t = { ${CORPS}, source: { ...${SRC_TS}, url: "https://mydogcanfly.com/faux" } } as unknown as Fare;\nexport const r = resoudreTarif([t], [], "hold", { placement: "hold" });\n`);
    check("un transtypage EFFACE la marque : la compilation l'accepte — d'où la seconde moitié de la frontière",
      compiler(transtypage) === "");
  } finally { rmSync(bacTs, { recursive: true, force: true }); }
  check("…et c'est exactement ce que le reparsage rattrape : la marque seule ne fermait pas la porte",
    leve !== null && leve.includes("auto-citation"));
}

console.log("\n=== 17. LE TARIF TRAVERSE LE CONTRAT HTTP RÉEL JUSQU'AU FINDER ===");
{
  const response = await worker.fetch(new Request(
    "https://x/v1/finder?origin=CDG&destination=JFK&weight_kg=3&breed=chihuahua&placement=any&locale=fr",
  ), {});
  const body = await response.json();
  const klm = body?.airlines?.find((a) => a.airline_id === "airline_klm");
  check("le Worker répond et KLM figure dans ce trajet témoin", response.status === 200 && !!klm,
    `HTTP ${response.status}, ${body?.airlines?.length ?? 0} compagnie(s)`);
  const parCanal = Object.fromEntries((klm?.fare_resolutions ?? []).map((x) => [x.placement, x.resolution]));
  check("le rapport transporte exactement cabine, soute et fret — aucune résolution perdue",
    Object.keys(parCanal).sort().join(",") === "cabin,cargo,hold", JSON.stringify(Object.keys(parCanal)));
  for (const canal of ["cabin", "hold"]) {
    const tarif = parCanal[canal]?.indecidables?.find((f) => f.id === `fare_klm_${canal}_eur_2026_09_12`);
    check(`KLM ${canal} : 70–500 EUR reste une grille publiée, jamais un prix exact du trajet`,
      tarif?.price?.kind === "range" && tarif.price.amounts?.[0]?.amount === 70
        && tarif.price.amounts?.[1]?.amount === 500 && parCanal[canal]?.montants?.length === 0,
      JSON.stringify(parCanal[canal] ?? null).slice(0, 300));
    check(`KLM ${canal} : la preuve tarifaire propre traverse avec URL, citation, locator et date`,
      tarif?.source?.url === "https://www.klm.nl/information/pets/reservation"
        && tarif.source.verified_date === "2026-09-12" && tarif.source.quote_language === "nl"
        && tarif.source.quote?.length >= 10
        && tarif.source.locator?.length > 0, JSON.stringify(tarif?.source ?? null));
  }
  check("KLM fret : le mécanisme sur devis traverse séparément des montants",
    parCanal.cargo?.indecidables?.some((f) => f.price?.kind === "quote" && f.source?.locator === "Cargo alternative")
      && parCanal.cargo?.montants?.length === 0, JSON.stringify(parCanal.cargo ?? null).slice(0, 300));
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail === 0 ? 0 : 1);
