#!/usr/bin/env node
/**
 * LE CONTRAT TARIFAIRE — contre-épreuves (10/09/2026, annexes 44 et 45).
 *
 *   npx tsx test-contrat-tarifaire.mjs
 *
 * Cinq témoins ont été EXIGÉS par Philippe, sur l'arbitrage de Codex :
 *   1. SAS facturé par contenant ET par segment — les deux axes, jamais confondus ;
 *   2. le conflit Finnair soute masque le prix ;
 *   3. une portée inconnue interdit un montant exact ;
 *   4. le chevauchement de deux tarifs devient un conflit ;
 *   5. un prix sans citation est refusé.
 *
 * La contre-revue de Codex sur la PR #56 en a exigé six de plus, un par porte ouverte. Ils sont
 * ici sous les numéros 6 à 9, chacun nommant la porte qu'il ferme (P0-1 à P0-4, P1, P1).
 *
 * TOUTES les fixtures sont des faits RÉELS de l'audit indépendant du 10/09/2026 : SAS soute Chine,
 * le conflit Finnair soute, Air China cabine (la seule fenêtre d'achat publiée en JOURS de tout
 * l'audit), KLM soute (la fourchette la mieux citée). Le schéma est éprouvé sur les cas qu'il devra
 * porter, pas sur des inventions. Les rares fixtures de FORME — celles qui n'existent sur aucune
 * page et n'éprouvent qu'une mécanique — sont nommées comme telles à l'endroit où elles servent.
 *
 * AUCUN de ces tarifs n'est importé dans la donnée par ce lot : le contrat d'abord, les imports
 * ensuite, l'affichage après la fusion du lot Finder.
 */
import { readFileSync } from "node:fs";
import {
  Fare, FareConflict, FarePrice, PurchaseWindow,
  evaluerPortee, evaluerFenetre, porteeTarif, porteeSaine, resoudreTarif,
  projectPlacementPolicy, PlacementPolicyAuthored,
} from "./packages/knowledge/src/index.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};
/** Un schéma REFUSE-t-il cet objet ? On veut l'échec, et on veut savoir sur quel champ. */
const refuse = (schema, obj) => {
  const r = schema.safeParse(obj);
  return { refuse: !r.success, motif: r.success ? "" : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | ") };
};

/* La citation d'un TARIF, distincte de celle qui prouve le canal. */
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
  /* L'extrait RÉEL de l'audit de Codex, repris tel quel — pas une phrase inventée pour le harnais.
     *Erreur nommée* : mon premier jet écrivait « 140 EUR », sous le minimum de dix caractères
     qu'impose `SourceCitable`. Le contrat partagé a refusé : il avait raison, une citation de sept
     signes ne prouve rien. */
  quote: "140 EUR / 650 EUR", quote_language: "fr", locator: "Pet transportation fees",
};
const SRC_FIN_B = {
  url: "https://www.finnair.com/fr-fr/bagages-sur-les-vols-finnair/frais-de-bagage-suppl%C3%A9mentaire",
  source_type: "official_website", verified_date: "2026-09-10", review_due: "2026-12-09",
  confidence: 4, reviewer: "Codex — lecture directe", history: [],
  quote: "120 EUR / 600 EUR", quote_language: "fr", locator: "Pets",
};
/* Air China cabine — la SEULE fenêtre d'achat exprimée en JOURS de tout l'audit des 102 compagnies
   (colonne `booking_deadline` : « booking from 7 days to 24 hours before departure »). Codex a validé
   cette lecture le 10/09 : la page officielle prouve la cabine ET son montant exact. */
const SRC_AIRCHINA = {
  url: "https://m.airchina.com.cn/ac/c/invoke/specialService/petCabinAgreement%40pg",
  source_type: "official_website", verified_date: "2026-09-10", review_due: "2026-12-09",
  confidence: 4, reviewer: "Codex — audit indépendant des 102 compagnies", history: [],
  quote: "RMB1,399 per pet per flight segment.", quote_language: "en",
  locator: "II. Carrier's Pet Transportation Charges",
};
/* KLM soute — la fourchette la mieux citée de l'audit : une phrase entière porte les deux bornes. */
const SRC_KLM = {
  url: "https://www.klm.com/information/pets/reservation",
  source_type: "official_website", verified_date: "2026-09-10", review_due: "2026-12-09",
  confidence: 4, reviewer: "Codex — audit indépendant des 102 compagnies", history: [],
  quote: "The cost of traveling with your pet on KLM ranges from EUR 70 to EUR 500 per one-way flight.",
  quote_language: "en", locator: "Costs and restrictions → Costs",
};

console.log("=== 1. SAS : facturé par contenant ET par segment — deux axes, jamais un seul ===");
{
  /* Le fait de Codex : « per container; per flight; one-way ». Un `unit` unique ne pouvait pas le dire ;
     c'est la raison P0 pour laquelle mon premier schéma a été refusé. */
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

  /* Les deux axes sont OBLIGATOIRES : un montant dont on ignore l'un des deux ne veut rien dire. */
  for (const manquant of ["billing_subject", "journey_basis"]) {
    const sans = { ...sasChine }; delete sans[manquant];
    check(`sans \`${manquant}\`, le tarif est REFUSÉ`, refuse(Fare, sans).refuse, refuse(Fare, sans).motif);
  }
  /* Et il s'applique au trajet quand la portée est décidable. */
  const res = resoudreTarif([sasChine], [], "hold", { "route.dest_country_id": "country_cn" });
  check("Paris → Chine : le tarif s'applique, et c'est bien celui de la Chine",
    res.etat === "applicable" && res.tarifs.length === 1 && res.tarifs[0].id === "fare_sas_hold_china", JSON.stringify(res).slice(0, 200));
  const ailleurs = resoudreTarif([sasChine], [], "hold", { "route.dest_country_id": "country_us" });
  check("Paris → États-Unis : ce tarif-là ne s'applique pas, et aucun autre n'est inventé",
    ailleurs.etat === "aucun", JSON.stringify(ailleurs).slice(0, 200));
}

console.log("\n=== 2. Le conflit Finnair soute masque le prix ===");
{
  /* Deux pages officielles vivantes, relues le même jour, deux montants. Aucun n'est tranché. */
  const conflit = {
    id: "fare_conflict_finnair_hold_2026_09_10", placement: "hold", status: "unresolved",
    effect: "suppress_exact_fare", scope_label: "Europe",
    observations: [
      { price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }] }, source: SRC_FIN_A },
      { price: { kind: "exact", amounts: [{ amount: 120, currency: "EUR" }] }, source: SRC_FIN_B },
    ],
    note: "Deux pages officielles vivantes publient des montants différents.",
  };
  const c = FareConflict.safeParse(conflit);
  check("le conflit Finnair est accepté par le contrat, avec ses DEUX observations complètes",
    c.success && c.data.observations.length === 2, c.success ? "" : JSON.stringify(c.error.issues).slice(0, 200));
  check("chaque observation porte sa source et sa date — un conflit ne se dit pas avec deux URL nues",
    c.success && c.data.observations.every((o) => !!o.source.url && !!o.source.quote && o.source.verified_date === "2026-09-10"));
  const seule = { ...conflit, observations: [conflit.observations[0]] };
  check("un conflit à UNE seule voix est refusé — ce n'en est pas un", refuse(FareConflict, seule).refuse, refuse(FareConflict, seule).motif);

  /* P0-1, second volet : une observation dont la source ne cite rien est refusée. */
  const nue = {
    ...conflit,
    observations: [
      conflit.observations[0],
      { price: { kind: "exact", amounts: [{ amount: 120, currency: "EUR" }] },
        source: { url: SRC_FIN_B.url, source_type: "official_website", verified_date: "2026-09-10", review_due: "2026-12-09", confidence: 4, reviewer: "x", history: [] } },
    ],
  };
  const rn = refuse(FareConflict, nue);
  check("une observation SANS citation est refusée : deux URL nues ne prouvent pas un conflit (P0-1)", rn.refuse, rn.motif);
  const sansLoc = {
    ...conflit,
    observations: [conflit.observations[0], { ...conflit.observations[1], source: { ...SRC_FIN_B, locator: undefined } }],
  };
  check("…et une observation citée sans localisateur ne suffit pas non plus", refuse(FareConflict, sansLoc).refuse);

  const tarifFin = {
    id: "fare_finnair_hold_europe", placement: "hold",
    price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }] },
    billing_subject: "pet", journey_basis: "per_one_way", scope_label: "Europe", source: SRC_FIN_A,
  };
  const res = resoudreTarif([tarifFin], [conflit], "hold", { "route.dest_country_id": "country_fi" });
  check("un conflit ouvert éteint le montant : la résolution rend le CONFLIT, jamais 140 € ni 120 €",
    res.etat === "conflit" && res.conflit.id === conflit.id, JSON.stringify(res).slice(0, 200));
  check("…et le conflit nomme ses deux sources, pour que la fiche puisse le dire",
    res.etat === "conflit" && res.conflit.observations.map((o) => o.source.url).join(" ").includes("frais-de-bagage"));
}

console.log("\n=== 3. Une portée inconnue interdit un montant exact ===");
{
  /* La ZONE commerciale (« Scandinavie, Europe, Moyen-Orient ») n'existe dans aucun fait du moteur.
     Un prédicat qui l'interroge est INDÉCIDABLE — jamais faux, jamais vrai. */
  const zone = {
    id: "fare_sas_hold_europe", placement: "hold",
    price: { kind: "exact", amounts: [{ amount: 169, currency: "EUR" }] },
    billing_subject: "container", journey_basis: "per_segment",
    /* `route.dest_country_id` est un fait réel ; il est simplement ABSENT du contexte de ce trajet. */
    applies_when: { all: [{ fact: "route.dest_country_id", op: "in", value: ["country_se", "country_no", "country_dk"] }] },
    scope_label: "Scandinavie, Europe, Moyen-Orient", source: { ...SRC_SAS, quote: "Scandinavia, Europe, Middle East: 169 EUR" },
  };
  check("portée évaluée sans le fait nécessaire → INDÉCIDABLE, jamais « faux »",
    evaluerPortee(zone.applies_when, {}) === "indecidable", evaluerPortee(zone.applies_when, {}));
  const res = resoudreTarif([zone], [], "hold", {});
  check("un trajet dont on ignore la destination ne reçoit AUCUN montant — la grille peut se montrer, pas le prix",
    res.etat === "indecidable" && res.tarifs.length === 1, JSON.stringify(res).slice(0, 200));
  const connu = resoudreTarif([zone], [], "hold", { "route.dest_country_id": "country_se" });
  check("le même tarif, sur un trajet dont la destination EST connue, s'applique — le témoin n'est pas vacant",
    connu.etat === "applicable" && connu.tarifs[0].id === "fare_sas_hold_europe", JSON.stringify(connu).slice(0, 160));
  const hors = resoudreTarif([zone], [], "hold", { "route.dest_country_id": "country_jp" });
  check("et sur une destination hors de la portée, il ne s'applique pas", hors.etat === "aucun");

  /* Un tarif SANS portée du tout : il se montre, il ne décide pas. */
  const sansPortee = { ...zone, id: "fare_sans_portee", applies_when: undefined };
  const rs = resoudreTarif([sansPortee], [], "hold", { "route.dest_country_id": "country_se" });
  check("un tarif sans portée exécutable n'est JAMAIS appliqué à un trajet, même connu",
    rs.etat === "indecidable", JSON.stringify(rs).slice(0, 160));
  check("le libellé de portée est du texte pour l'œil, il ne décide rien : la portée décidante est le prédicat",
    typeof zone.scope_label === "string" && evaluerPortee(undefined, { "route.dest_country_id": "country_se" }) === "indecidable");

  /* Les natures non chiffrées prouvent un mécanisme, jamais une valeur. */
  const devis = {
    id: "fare_sas_cargo_quote", placement: "cargo", price: { kind: "quote", amounts: [] },
    billing_subject: "shipment", journey_basis: "per_journey",
    applies_when: { all: [{ fact: "placement", op: "eq", value: "cargo" }] },
    source: { ...SRC_SAS, url: "https://www.flysas.com/en/travel-info/baggage/cargo", quote: "book it as cargo using a freight forwarder", locator: "Pet as cargo → opening paragraph" },
  };
  const rq = resoudreTarif([devis], [], "cargo", { placement: "cargo" });
  check("« sur devis » est un MÉCANISME prouvé, pas un montant — la résolution le dit ainsi",
    rq.etat === "mecanisme" && rq.tarifs[0].price.kind === "quote", JSON.stringify(rq).slice(0, 160));
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
    res.etat === "chevauchement" && res.tarifs.length === 2, JSON.stringify(res).slice(0, 200));
  check("…et le premier n'est PAS servi en silence — c'est la faute que ce témoin existe pour empêcher",
    res.etat !== "applicable");
  const bMemeMontant = { ...b, price: { kind: "exact", amounts: [{ amount: 725, currency: "EUR" }] } };
  const identique = resoudreTarif([a, bMemeMontant], [], "hold", { "route.dest_country_id": "country_cn" });
  check("deux lignes qui disent le MÊME montant sur les mêmes axes ne sont pas un conflit — c'est une redite",
    identique.etat === "applicable", JSON.stringify(identique).slice(0, 160));
  const bAutreAxe = { ...b, price: { kind: "exact", amounts: [{ amount: 725, currency: "EUR" }] }, journey_basis: "per_journey" };
  const axes = resoudreTarif([a, bAutreAxe], [], "hold", { "route.dest_country_id": "country_cn" });
  check("même montant, axes différents (par segment contre par trajet) → chevauchement : 725 € n'y veut pas dire la même chose",
    axes.etat === "chevauchement", JSON.stringify(axes).slice(0, 160));

  /* P1, seconde porte : deux devises DISJOINTES ne se contredisent pas — mais elles ne se
     réduisent pas non plus à la première. La version précédente rendait `chiffres[0]` et laissait
     l'autre disparaître sans un mot. */
  const bAutreDevise = { ...b, price: { kind: "exact", amounts: [{ amount: 5400, currency: "DKK" }] } };
  const parallele = resoudreTarif([a, bAutreDevise], [], "hold", { "route.dest_country_id": "country_cn" });
  check("deux devises différentes ne se contredisent pas : ce sont des montants parallèles, aucune conversion",
    parallele.etat === "applicable", JSON.stringify(parallele).slice(0, 160));
  check("…et les DEUX variantes sortent : aucune n'est jetée en silence (P1)",
    parallele.etat === "applicable" && parallele.tarifs.length === 2
      && new Set(parallele.tarifs.flatMap((f) => f.price.amounts.map((m) => m.currency))).size === 2,
    JSON.stringify(parallele.tarifs?.map((f) => f.id)));
  const troisMecanismes = resoudreTarif(
    [{ ...base, id: "m1", price: { kind: "quote", amounts: [] } }, { ...base, id: "m2", price: { kind: "calculator", amounts: [] } }],
    [], "hold", { "route.dest_country_id": "country_cn" });
  check("deux MÉCANISMES applicables sortent eux aussi ensemble — même règle, même raison",
    troisMecanismes.etat === "mecanisme" && troisMecanismes.tarifs.length === 2, JSON.stringify(troisMecanismes).slice(0, 160));
}

console.log("\n=== 5. Un prix sans citation est refusé — et un MÉCANISME aussi (P0-1) ===");
{
  const nu = {
    id: "fare_sans_preuve", placement: "cabin",
    price: { kind: "exact", amounts: [{ amount: 75, currency: "EUR" }] },
    billing_subject: "container", journey_basis: "per_segment",
    source: { url: "https://www.flysas.com/en/travel-info/travel-with-pets/in-hold", source_type: "official_website", verified_date: "2026-09-10", review_due: "2026-12-09", confidence: 4, reviewer: "x", history: [] },
  };
  const r = refuse(Fare, nu);
  check("un montant dont la source ne porte AUCUNE phrase est refusé", r.refuse, r.motif);
  check("…et le motif nomme la citation, pas autre chose", r.motif.includes("citation"), r.motif);
  const sansLocator = { ...nu, source: { ...nu.source, quote: "China: 725 EUR", quote_language: "en" } };
  check("une phrase sans localisateur ne suffit pas : on doit savoir OÙ elle a été lue", refuse(Fare, sansLocator).refuse);
  const sansLangue = { ...nu, source: { ...nu.source, quote: "China: 725 EUR", locator: "Fees" } };
  check("une phrase sans langue est refusée par le contrat de source lui-même", refuse(Fare, sansLangue).refuse);
  const complet = { ...nu, source: SRC_SAS };
  check("avec sa phrase, sa langue et son localisateur, le même tarif passe — le témoin n'est pas vacant",
    Fare.safeParse(complet).success);
  /* La preuve du CANAL ne vaut pas preuve du PRIX : deux citations distinctes, deux champs distincts. */
  check("le tarif porte SA source, séparée de celle de la politique du canal",
    Fare.safeParse(complet).success && Fare.safeParse(complet).data.source.locator === "Fees → Pet in cargo hold → China");
  /* Devise : trois lettres majuscules, jamais convertie. */
  const minuscule = { ...complet, price: { kind: "exact", amounts: [{ amount: 725, currency: "eur" }] } };
  check("une devise en minuscules est refusée (ISO 4217)", refuse(FarePrice, minuscule.price).refuse);

  /* PORTE P0-1 : les quatre natures NON CHIFFRÉES échappaient à l'exigence de citation. « Sur devis »,
     « calculateur officiel », « prix à la réservation » et « formule » sont pourtant des affirmations
     tarifaires : les publier sans preuve est exactement ce que ce contrat interdit ailleurs. */
  const sourceNue = { url: "https://example.invalid/tarifs", source_type: "official_website", verified_date: "2026-09-10", review_due: "2026-12-09", confidence: 4, reviewer: "x", history: [] };
  for (const kind of ["formula", "calculator", "booking_only", "quote"]) {
    const mecanismeNu = {
      id: `fare_mecanisme_${kind}`, placement: "cargo", price: { kind, amounts: [] },
      billing_subject: "shipment", journey_basis: "per_journey", source: sourceNue,
    };
    const rm = refuse(Fare, mecanismeNu);
    check(`un mécanisme « ${kind} » SANS citation est refusé (P0-1)`, rm.refuse, rm.motif);
    const mecanismeCite = { ...mecanismeNu, source: { ...SRC_SAS, url: "https://www.flysas.com/en/travel-info/baggage/cargo", quote: "book it as cargo using a freight forwarder", locator: "Pet as cargo" } };
    check(`…et le même « ${kind} », cité, est accepté — le témoin n'est pas vacant`, Fare.safeParse(mecanismeCite).success);
  }
}

console.log("\n=== 6. La fenêtre d'achat est ÉVALUÉE, pas seulement enregistrée (P0-2) ===");
{
  /* Air China cabine : la seule fenêtre publiée en JOURS de tout l'audit des 102 compagnies —
     « booking from 7 days to 24 hours before departure », soit de J-7 à J-1 inclus.
     NOTE HONNÊTE SUR LA PORTÉE : la page restreint le tarif aux vols OPÉRÉS par Air China, et le
     transporteur opérant n'est pas un fait du moteur (nommé dans l'en-tête de `tarifs.ts`). La
     portée écrite ici interroge donc le canal, qui EST un fait ; la portée réelle attendra sa
     modélisation, et c'est l'une des raisons pour lesquelles ce lot n'importe aucun tarif. */
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
  /* LES TROIS CAS EXIGÉS PAR CODEX. */
  check("délai DANS la fenêtre (J-3) → la fenêtre est vraie, et le tarif s'applique",
    porteeTarif(airChina, { ...contexte, days_before_departure: 3 }) === "vrai");
  check("délai HORS de la fenêtre (J-30, trop tôt) → la fenêtre est fausse",
    porteeTarif(airChina, { ...contexte, days_before_departure: 30 }) === "faux");
  check("délai ABSENT du contexte → INDÉCIDABLE, jamais « vrai » et jamais « faux »",
    porteeTarif(airChina, contexte) === "indecidable");

  check("…et la résolution suit : à J-3, le montant sort",
    resoudreTarif([airChina], [], "cabin", { ...contexte, days_before_departure: 3 }).etat === "applicable");
  check("…à J-30, aucun montant n'est publié",
    resoudreTarif([airChina], [], "cabin", { ...contexte, days_before_departure: 30 }).etat === "aucun");
  check("…et sans délai connu, la grille est indécidable — à moitié su, pas dit",
    resoudreTarif([airChina], [], "cabin", contexte).etat === "indecidable");
  check("le bord de la fenêtre est inclusif des deux côtés (J-1 et J-7 valent)",
    porteeTarif(airChina, { ...contexte, days_before_departure: 1 }) === "vrai"
      && porteeTarif(airChina, { ...contexte, days_before_departure: 7 }) === "vrai");
  check("et J-0 (le jour même) tombe sous le plancher publié",
    porteeTarif(airChina, { ...contexte, days_before_departure: 0 }) === "faux");

  /* Un tarif SANS fenêtre ne pose aucune condition d'achat : il ne restreint rien. C'est différent
     d'une fenêtre écrite qu'on ne saurait pas évaluer. */
  check("un tarif sans fenêtre d'achat n'est jamais bloqué par elle", evaluerFenetre(undefined, {}) === "vrai");
  check("une fenêtre écrite sans délai connu est indécidable, pas fausse",
    evaluerFenetre({ min_days_before_departure: 1, max_days_before_departure: 7 }, {}) === "indecidable");

  /* LA PORTE ELLE-MÊME : deux paliers dont les FENÊTRES sont disjointes ne sont pas un
     chevauchement. FIXTURE DE FORME — aucune page de l'audit ne publie deux paliers Air China ;
     ce témoin n'éprouve que la mécanique que la version précédente cassait, en déclarant en
     chevauchement deux prix qu'une page distingue parfaitement par la date d'achat. */
  const tot = { ...airChina, id: "fare_palier_tot", purchase_window: { min_days_before_departure: 7 } };
  const tard = { ...airChina, id: "fare_palier_tard", price: { kind: "exact", amounts: [{ amount: 1599, currency: "CNY" }] }, purchase_window: { max_days_before_departure: 6 } };
  const aJ10 = resoudreTarif([tot, tard], [], "cabin", { ...contexte, days_before_departure: 10 });
  check("deux paliers à fenêtres disjointes, achat à J-10 → un seul s'applique, AUCUN chevauchement",
    aJ10.etat === "applicable" && aJ10.tarifs.length === 1 && aJ10.tarifs[0].id === "fare_palier_tot", JSON.stringify(aJ10).slice(0, 200));
  const aJ2 = resoudreTarif([tot, tard], [], "cabin", { ...contexte, days_before_departure: 2 });
  check("…et à J-2, c'est l'autre palier, toujours sans chevauchement",
    aJ2.etat === "applicable" && aJ2.tarifs.length === 1 && aJ2.tarifs[0].id === "fare_palier_tard", JSON.stringify(aJ2).slice(0, 200));
  const sansDelai = resoudreTarif([tot, tard], [], "cabin", contexte);
  check("sans délai connu, les DEUX paliers sont indécidables — et surtout, aucun prix ne sort",
    sansDelai.etat === "indecidable" && sansDelai.tarifs.length === 2, JSON.stringify(sansDelai).slice(0, 200));

  /* Le schéma de la fenêtre lui-même. */
  check("une fenêtre vide n'est pas une condition — refusée", refuse(PurchaseWindow, {}).refuse);
  check("une fenêtre dont le plancher dépasse le plafond ne s'ouvre jamais — refusée",
    refuse(PurchaseWindow, { min_days_before_departure: 9, max_days_before_departure: 2 }).refuse);
  check("une fenêtre à une seule borne est légitime (« au moins sept jours avant »)",
    PurchaseWindow.safeParse({ min_days_before_departure: 7 }).success);
}

console.log("\n=== 7. `resolved` était une porte arrière : elle est murée (P0-3) ===");
{
  const conflit = {
    id: "fare_conflict_finnair_hold_2026_09_10", placement: "hold", status: "unresolved",
    effect: "suppress_exact_fare", scope_label: "Europe",
    observations: [
      { price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }] }, source: SRC_FIN_A },
      { price: { kind: "exact", amounts: [{ amount: 120, currency: "EUR" }] }, source: SRC_FIN_B },
    ],
  };
  check("un conflit ouvert reste accepté", FareConflict.safeParse(conflit).success);
  const resolu = { ...conflit, status: "resolved" };
  const rr = refuse(FareConflict, resolu);
  check("`status: resolved` est REFUSÉ par le schéma — un mot ne rallume pas un prix contredit", rr.refuse, rr.motif);
  check("…et mon propre témoin, qui consacrait ce comportement, est retiré : c'est l'erreur nommée de ce lot",
    rr.refuse);
  for (const faux of ["closed", "arbitrated", "", "UNRESOLVED"]) {
    check(`aucune autre valeur ne passe non plus (\`${faux || "(vide)"}\`)`, refuse(FareConflict, { ...conflit, status: faux }).refuse);
  }
  /* Et aucun champ latéral n'ouvre de contournement : le schéma est strict. */
  check("aucun champ de résolution improvisé n'est toléré (schéma strict)",
    refuse(FareConflict, { ...conflit, resolved_by: "moi", winner: "fare_a" }).refuse);
  /* Le seul moyen de rouvrir un montant est de RETIRER le conflit, ce qui laisse une trace au dépôt. */
  const sansConflit = resoudreTarif(
    [{ id: "fare_finnair_hold_europe", placement: "hold", price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }] },
       billing_subject: "pet", journey_basis: "per_one_way",
       applies_when: { all: [{ fact: "route.dest_country_id", op: "eq", value: "country_fi" }] }, source: SRC_FIN_A }],
    [], "hold", { "route.dest_country_id": "country_fi" });
  check("retirer le conflit du dépôt, lui, rouvre le montant — et se voit dans l'historique",
    sansConflit.etat === "applicable", JSON.stringify(sansConflit).slice(0, 160));
}

console.log("\n=== 8. Une fourchette encadre CHAQUE devise, dans le bon sens (P0-4) ===");
{
  /* KLM soute : « ranges from EUR 70 to EUR 500 per one-way flight » — la fourchette la mieux citée
     de l'audit, une phrase entière portant ses deux bornes. */
  const klm = {
    id: "fare_klm_hold_range", placement: "hold",
    price: { kind: "range", amounts: [{ amount: 70, currency: "EUR" }, { amount: 500, currency: "EUR" }] },
    billing_subject: "pet_or_container", journey_basis: "per_one_way",
    applies_when: { all: [{ fact: "placement", op: "eq", value: "hold" }] },
    scope_label: "aéroport de départ → destination", source: SRC_KLM,
  };
  check("la fourchette KLM 70–500 EUR est acceptée", Fare.safeParse(klm).success,
    JSON.stringify(Fare.safeParse(klm).error?.issues ?? "").slice(0, 240));

  /* L'EXEMPLE EXACT DE CODEX : nombre pair de montants, aucune devise encadrée. */
  const depareillee = { ...klm.price, amounts: [{ amount: 60, currency: "EUR" }, { amount: 100, currency: "USD" }] };
  const rd = refuse(FarePrice, depareillee);
  check("« 60 EUR et 100 USD » n'est PAS une fourchette : aucune devise n'y a ses deux bornes", rd.refuse, rd.motif);
  check("…et le motif parle bien de la fourchette, pas d'autre chose", rd.motif.toLowerCase().includes("fourchette"), rd.motif);

  const inversee = { ...klm.price, amounts: [{ amount: 500, currency: "EUR" }, { amount: 70, currency: "EUR" }] };
  check("une fourchette inversée (500 puis 70) est refusée : le minimum s'écrit d'abord",
    refuse(FarePrice, inversee).refuse, refuse(FarePrice, inversee).motif);

  const uneSeule = { ...klm.price, amounts: [{ amount: 70, currency: "EUR" }] };
  check("une borne seule n'encadre rien — refusée", refuse(FarePrice, uneSeule).refuse, refuse(FarePrice, uneSeule).motif);
  const trois = { ...klm.price, amounts: [{ amount: 70, currency: "EUR" }, { amount: 300, currency: "EUR" }, { amount: 500, currency: "EUR" }] };
  check("trois montants dans une devise : on ne saurait pas lequel est le maximum — refusé", refuse(FarePrice, trois).refuse);

  const deuxDevises = { ...klm.price, amounts: [{ amount: 70, currency: "EUR" }, { amount: 500, currency: "EUR" }, { amount: 80, currency: "USD" }, { amount: 560, currency: "USD" }] };
  check("deux devises, chacune correctement encadrée : accepté — le témoin n'est pas vacant",
    FarePrice.safeParse(deuxDevises).success, JSON.stringify(FarePrice.safeParse(deuxDevises).error?.issues ?? "").slice(0, 200));
  const deuxDevisesUneInversee = { ...klm.price, amounts: [{ amount: 70, currency: "EUR" }, { amount: 500, currency: "EUR" }, { amount: 560, currency: "USD" }, { amount: 80, currency: "USD" }] };
  check("…et il suffit qu'UNE des deux devises soit inversée pour que tout soit refusé",
    refuse(FarePrice, deuxDevisesUneInversee).refuse);
  /* Les natures non-fourchettes gardent leur règle : une devise, un montant. */
  check("un `exact` avec deux montants dans la même devise reste refusé — c'est un conflit, pas une ligne",
    refuse(FarePrice, { kind: "exact", amounts: [{ amount: 70, currency: "EUR" }, { amount: 500, currency: "EUR" }] }).refuse);
}

console.log("\n=== 9. Une portée vide ne s'applique pas partout (P1) ===");
{
  /* `{ all: [] }` est vrai par vacuité, `{ any: [] }` est faux par vacuité : deux pertes muettes,
     qu'une simple erreur d'indentation dans un `.yml` suffit à produire. */
  check("`{ all: [] }` ne vaut PAS « vrai » à l'évaluation — il est indécidable",
    evaluerPortee({ all: [] }, { "route.dest_country_id": "country_cn" }) === "indecidable");
  check("`{ any: [] }` ne vaut pas « faux » non plus — il est indécidable",
    evaluerPortee({ any: [] }, { "route.dest_country_id": "country_cn" }) === "indecidable");

  check("`porteeSaine` refuse le combinateur vide", !porteeSaine({ all: [] }) && !porteeSaine({ any: [] }));
  check("…y compris IMBRIQUÉ, à n'importe quelle profondeur",
    !porteeSaine({ all: [{ fact: "placement", op: "eq", value: "hold" }, { any: [] }] })
      && !porteeSaine({ not: { all: [] } }));
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
  check("un tarif à portée vide IMBRIQUÉE est refusé aussi",
    refuse(Fare, { ...base, applies_when: { all: [{ any: [] }] } }).refuse);
  check("un CONFLIT à portée vide est refusé de la même façon — il éteindrait tous les prix du canal",
    refuse(FareConflict, {
      id: "conflit_portee_vide", placement: "hold", status: "unresolved", effect: "suppress_exact_fare",
      applies_when: { any: [] },
      observations: [
        { price: { kind: "exact", amounts: [{ amount: 140, currency: "EUR" }] }, source: SRC_FIN_A },
        { price: { kind: "exact", amounts: [{ amount: 120, currency: "EUR" }] }, source: SRC_FIN_B },
      ],
    }).refuse);
  check("et le même tarif, avec une portée qui dit quelque chose, passe — le témoin n'est pas vacant",
    Fare.safeParse({ ...base, applies_when: { all: [{ fact: "placement", op: "eq", value: "hold" }] } }).success);
}

console.log("\n=== 10. La projection ne perd pas les tarifs — la faute du 08/09, deux fois apprise ===");
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

console.log("\n=== 11. Aucun tarif n'est importé par ce lot — le contrat d'abord ===");
{
  const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
  let avecTarifs = 0, avecConflits = 0;
  for (const a of objets.airlines) for (const p of Object.values(a.premium?.policy ?? {})) {
    if (Array.isArray(p.fares) && p.fares.length) avecTarifs++;
    if (Array.isArray(p.fare_conflicts) && p.fare_conflicts.length) avecConflits++;
  }
  check("les 302 politiques réelles ne portent AUCUN tarif : le schéma est prêt, la donnée n'a pas bougé",
    avecTarifs === 0, `${avecTarifs} politique(s) portent déjà un tarif`);
  check("…ni aucun conflit tarifaire", avecConflits === 0, `${avecConflits} politique(s) portent déjà un conflit`);
}

console.log("\n=== 12. L'INGESTION porte les tarifs de la fiche jusqu'à l'artefact — sur un bac à sable, jamais sur le dépôt ===");
{
  /* Le champ le plus fragile de ce dépôt est celui qu'on ajoute au schéma en oubliant un maillon : le seuil s'est
     perdu le 15/08 dans la préservation, le champ du quatrième état le 08/09 dans la projection. Ce témoin joue
     l'ingestion RÉELLE sur une copie du dépôt, avec un tarif écrit à la main dans une fiche, et exige qu'il arrive
     dans `objects.json`. Il ne touche jamais la donnée versionnée. */
  const { mkdtempSync, cpSync, writeFileSync: ecrire } = await import("node:fs");
  const { execFileSync } = await import("node:child_process");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const bac = mkdtempSync(join(tmpdir(), "mdcf-tarifs-"));
  /* `test-baselines/` fait partie du bac : l'ingestion lit les identités approuvées, et sans elles elle
     s'arrête avant d'écrire — ce que mon premier jet prenait pour une perte du champ (erreur nommée). */
  for (const d of ["content", "packages", "test-baselines"]) cpSync(d, join(bac, d), { recursive: true });
  /* Le bac à sable n'a pas ses dépendances : on lie celles du dépôt plutôt que de les recopier
     (elles pèsent des centaines de mégaoctets, et l'ingestion n'en modifie aucune). */
  const { symlinkSync } = await import("node:fs");
  symlinkSync(join(process.cwd(), "node_modules"), join(bac, "node_modules"), "dir");
  cpSync("package.json", join(bac, "package.json"));
  const fiche = join(bac, "content/airlines/sas.yml");
  const yml = readFileSync(fiche, "utf8");
  const bloc = `  hold:\n    availability: offered\n    fares:\n      - id: fare_sas_hold_china\n        placement: hold\n        price:\n          kind: exact\n          amounts:\n            - { amount: 725, currency: EUR }\n        billing_subject: container\n        journey_basis: per_segment\n        applies_when: { all: [{ fact: route.dest_country_id, op: eq, value: country_cn }] }\n        purchase_window: { min_days_before_departure: 1 }\n        scope_label: Chine\n        source:\n          url: "https://www.flysas.com/en/travel-info/travel-with-pets/in-hold"\n          source_type: official_website\n          verified_date: "2026-09-10"\n          review_due: "2026-12-09"\n          confidence: 4\n          reviewer: "harnais du contrat tarifaire"\n          history: []\n          quote: "China: 5400 DKK, 7600 NOK, 7600 SEK, 725 EUR, 775 USD"\n          quote_language: en\n          locator: "Fees → Pet in cargo hold → China"\n`;
  const avant = yml.indexOf("  hold:\n");
  const apres = yml.indexOf("\n  cargo:", avant);
  check("préalable : la fiche SAS a bien un bloc soute à remplacer", avant > 0 && apres > avant);
  ecrire(fiche, yml.slice(0, avant) + bloc + yml.slice(apres + 1));
  let sortie = "";
  try {
    sortie = execFileSync("npx", ["tsx", "packages/knowledge/scripts/ingest-airlines.mjs"], { cwd: bac, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) { sortie = String(e.stdout ?? "") + String(e.stderr ?? ""); }
  check("l'ingestion accepte une fiche qui porte un tarif", /ingested|derived/.test(sortie), sortie.slice(-300));
  const o = JSON.parse(readFileSync(join(bac, "packages/knowledge/raw/objects.json"), "utf8"));
  const pol = o.airlines.find((a) => a.id === "airline_sas")?.premium?.policy?.hold;
  check("…et le tarif ARRIVE dans l'artefact, avec ses deux axes et sa citation propre",
    Array.isArray(pol?.fares) && pol.fares.length === 1 && pol.fares[0].billing_subject === "container"
      && pol.fares[0].journey_basis === "per_segment" && pol.fares[0].source?.locator === "Fees → Pet in cargo hold → China",
    JSON.stringify(pol?.fares ?? null).slice(0, 260));
  check("…et la portée arrive exécutable, pas aplatie en texte",
    !!pol?.fares?.[0]?.applies_when?.all?.[0]?.fact && pol.fares[0].applies_when.all[0].fact === "route.dest_country_id",
    JSON.stringify(pol?.fares?.[0]?.applies_when ?? null));
  check("…et la FENÊTRE D'ACHAT survit elle aussi au trajet fiche → artefact (P0-2)",
    pol?.fares?.[0]?.purchase_window?.min_days_before_departure === 1,
    JSON.stringify(pol?.fares?.[0]?.purchase_window ?? null));
  check("…et le tarif se résout sur le trajet, depuis l'artefact et non depuis la fixture",
    resoudreTarif(pol?.fares ?? [], [], "hold", { "route.dest_country_id": "country_cn", days_before_departure: 5 }).etat === "applicable");
  check("…et le MÊME tarif, sans délai connu, ne publie aucun montant depuis l'artefact",
    resoudreTarif(pol?.fares ?? [], [], "hold", { "route.dest_country_id": "country_cn" }).etat === "indecidable");
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail === 0 ? 0 : 1);
