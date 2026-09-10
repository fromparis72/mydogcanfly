#!/usr/bin/env node
/**
 * LE CONTRAT TARIFAIRE — contre-épreuves (10/09/2026, annexe 44).
 *
 *   npx tsx test-contrat-tarifaire.mjs
 *
 * Cinq témoins sont EXIGÉS par Philippe, sur l'arbitrage de Codex :
 *   1. SAS facturé par contenant ET par segment — les deux axes, jamais confondus ;
 *   2. le conflit Finnair soute masque le prix ;
 *   3. une portée inconnue interdit un montant exact ;
 *   4. le chevauchement de deux tarifs devient un conflit ;
 *   5. un prix sans citation est refusé.
 * Les fixtures reprennent les faits que Codex a lus le 10/09/2026 (SAS et Finnair) : le schéma est
 * éprouvé sur les cas réels qu'il devra porter, pas sur des inventions. AUCUN de ces tarifs n'est
 * importé dans la donnée par ce lot — le contrat d'abord, les imports ensuite, l'affichage après la
 * fusion du lot Finder.
 */
import { readFileSync } from "node:fs";
import { Fare, FareConflict, FarePrice, evaluerPortee, resoudreTarif, projectPlacementPolicy, PlacementPolicyAuthored } from "./packages/knowledge/src/index.ts";

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
    res.etat === "applicable" && res.tarif.id === "fare_sas_hold_china", JSON.stringify(res).slice(0, 200));
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
  const resolu = { ...conflit, status: "resolved" };
  const apres = resoudreTarif([tarifFin], [resolu], "hold", { "route.dest_country_id": "country_fi" });
  check("un conflit RÉSOLU ne masque plus rien — le témoin ne confond pas « ouvert » et « existant »",
    apres.etat !== "conflit", JSON.stringify(apres).slice(0, 160));
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
    connu.etat === "applicable" && connu.tarif.id === "fare_sas_hold_europe", JSON.stringify(connu).slice(0, 160));
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
    rq.etat === "mecanisme" && rq.tarif.price.kind === "quote", JSON.stringify(rq).slice(0, 160));
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
  const bAutreDevise = { ...b, price: { kind: "exact", amounts: [{ amount: 5400, currency: "DKK" }] } };
  const parallele = resoudreTarif([a, bAutreDevise], [], "hold", { "route.dest_country_id": "country_cn" });
  check("deux devises différentes ne se contredisent pas : ce sont des montants parallèles, aucune conversion",
    parallele.etat === "applicable", JSON.stringify(parallele).slice(0, 160));
  const bAutreAxe = { ...b, price: { kind: "exact", amounts: [{ amount: 725, currency: "EUR" }] }, journey_basis: "per_journey" };
  const axes = resoudreTarif([a, bAutreAxe], [], "hold", { "route.dest_country_id": "country_cn" });
  check("même montant, axes différents (par segment contre par trajet) → chevauchement : 725 € n'y veut pas dire la même chose",
    axes.etat === "chevauchement", JSON.stringify(axes).slice(0, 160));
}

console.log("\n=== 5. Un prix sans citation est refusé ===");
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
}

console.log("\n=== 6. La projection ne perd pas les tarifs — la faute du 08/09, deux fois apprise ===");
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
  /* Et l'inverse : aucune donnée réelle ne porte encore de tarif — ce lot est un contrat, pas un import. */
}

console.log("\n=== 7. Aucun tarif n'est importé par ce lot — le contrat d'abord ===");
{
  const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
  let avecTarifs = 0;
  for (const a of objets.airlines) for (const p of Object.values(a.premium?.policy ?? {})) if (Array.isArray(p.fares) && p.fares.length) avecTarifs++;
  check("les 302 politiques réelles ne portent AUCUN tarif : le schéma est prêt, la donnée n'a pas bougé",
    avecTarifs === 0, `${avecTarifs} politique(s) portent déjà un tarif`);
}

console.log("\n=== 8. L'INGESTION porte les tarifs de la fiche jusqu'à l'artefact — sur un bac à sable, jamais sur le dépôt ===");
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
  const bloc = `  hold:\n    availability: offered\n    fares:\n      - id: fare_sas_hold_china\n        placement: hold\n        price:\n          kind: exact\n          amounts:\n            - { amount: 725, currency: EUR }\n        billing_subject: container\n        journey_basis: per_segment\n        applies_when: { all: [{ fact: route.dest_country_id, op: eq, value: country_cn }] }\n        scope_label: Chine\n        source:\n          url: "https://www.flysas.com/en/travel-info/travel-with-pets/in-hold"\n          source_type: official_website\n          verified_date: "2026-09-10"\n          review_due: "2026-12-09"\n          confidence: 4\n          reviewer: "harnais du contrat tarifaire"\n          history: []\n          quote: "China: 5400 DKK, 7600 NOK, 7600 SEK, 725 EUR, 775 USD"\n          quote_language: en\n          locator: "Fees → Pet in cargo hold → China"\n`;
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
  check("…et le tarif se résout sur le trajet, depuis l'artefact et non depuis la fixture",
    resoudreTarif(pol?.fares ?? [], [], "hold", { "route.dest_country_id": "country_cn" }).etat === "applicable");
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail === 0 ? 0 : 1);
