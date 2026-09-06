#!/usr/bin/env node
/**
 * LA FRONTIÈRE DE CONFIANCE — MESURE D'IMPACT, AVANT TOUTE MODIFICATION DU MOTEUR.
 *
 * Applique aux 401 règles la classification arbitrée — `verified_official`, `corroborated`,
 * `legacy_unverified`, `unknown` — et mesure ce que leur rétrogradation coûterait. Rien n'est
 * modifié : c'est le rapport demandé AVANT le correctif.
 *
 * LA DÉFINITION EST PRISE AU MOT, ET C'EST TOUT L'INTÉRÊT DE LA MESURE. `verified_official` exige
 * une page officielle, une CITATION VERBATIM, sa langue, son locator, l'URL et une date de
 * vérification. Une URL officielle seule ne suffit pas ; une date d'import n'est pas une date de
 * vérification. Appliquée telle quelle à l'état actuel, cette définition ne peut RIEN classer en
 * `verified_official` — le champ `quote` n'existe pas dans `rules.json`. Ce n'est pas un défaut de
 * la définition : c'est la mesure de l'écart, et c'est précisément ce qu'il fallait chiffrer avant
 * de brancher quoi que ce soit sur le moteur.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

const AUTO = /(^|\/\/)([a-z0-9-]+\.)?mydogcanfly\.com/i;
/* ---- L'HISTORIQUE DIT CE QUE LA DONNÉE NE DIT PAS, ET IL FAUT LE LIRE ------------------------
 *
 * Une première classification n'a regardé que les champs : pas de `quote`, donc rien de prouvé,
 * donc 401 règles en `legacy_unverified` et 100 % des verdicts rétrogradés. C'était vrai au sens
 * des CHAMPS, et faux au sens du TRAVAIL RÉELLEMENT FAIT. Le champ `history` enregistre des
 * vérifications substantielles : « Vérifié ligne à ligne contre la table APHA », « Vérifiée sur la
 * page DG SANTÉ », « verified from the airline's official pet policy ». Il enregistre aussi, à
 * l'inverse, des aveux : « pending official verification », « Initial import ».
 *
 * ON LIT DONC CES NOTES — EN SACHANT CE QUE CETTE LECTURE VAUT. Reconnaître une vérification à la
 * forme d'une phrase est un raccourci, et ce dépôt s'en méfie à juste titre. Mais la note est
 * DÉCLARATIVE : quelqu'un l'a écrite pour dire ce qu'il avait fait. La traiter comme un signal
 * faible et NOMMÉ vaut mieux que l'ignorer et prétendre que rien n'a jamais été vérifié — ce qui
 * serait, cette fois, une fausse mesure dans l'autre sens. */
const VERIFICATION_REELLE = /vérifiée? (ligne à ligne|sur (la |le )?|contre )|verified from the airline's official|vérifié.{0,40}(APHA|DG SANT|gov\.uk|officielle)|Règle créée pour|Portée restreinte|Certificat conditionné/i;
const AVEU_NON_VERIFIE = /pending (official )?(live )?(re-)?verification|Initial import|Baseline entry/i;
const IMPORT_DE_SOI = /Imported from (the )?MyDogCanFly/i;
const SECONDAIRE = /pettravel\.com|petrelocation\.com|bringfido|seatguru|airpets\.in|travelzylo|ticketterrier/i;
/** Une date d'import n'est pas une vérification : l'historique le dit lui-même. */
const IMPORT_SEUL = (r) => (r.source?.history ?? []).every((h) => /initial import/i.test(h.note ?? ""));

export function classer(r) {
  const s = r.source ?? {};
  if (!s.url) return "unknown";
  if (AUTO.test(s.url)) return "legacy_unverified";        // auto-citation : jamais une preuve
  const officielle = s.source_type === "official_website" || s.source_type === "government";
  const citation = typeof s.quote === "string" && s.quote.length >= 10;
  const locator = typeof s.locator === "string" && s.locator.length > 0;
  const langue = typeof s.quote_language === "string" && s.quote_language.length > 0;
  if (officielle && citation && locator && langue && !IMPORT_SEUL(r)) return "verified_official";
  if (SECONDAIRE.test(s.url)) return "legacy_unverified";  // agrégateur : une piste, pas une preuve
  const notes = (s.history ?? []).map((h) => h.note ?? "").join(" · ");
  /* CORROBORÉ : une source officielle ET une vérification substantielle ENREGISTRÉE, mais sans la
     citation verbatim qui ferait la preuve complète. Un aveu de non-vérification, ou un import de
     notre propre base, disqualifie même en présence d'une URL officielle. */
  if (officielle && VERIFICATION_REELLE.test(notes)
      && !AVEU_NON_VERIFIE.test(notes) && !IMPORT_DE_SOI.test(notes)) return "corroborated";
  return "legacy_unverified";
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const regles = JSON.parse(readFileSync("packages/knowledge/raw/rules.json", "utf8"));
  const classes = new Map();
  const parCompagnie = new Map();
  for (const r of regles) {
    const c = classer(r);
    classes.set(c, (classes.get(c) ?? 0) + 1);
    if (r.scope?.type === "airline") {
      if (!parCompagnie.has(r.scope.id)) parCompagnie.set(r.scope.id, []);
      parCompagnie.get(r.scope.id).push({ r, c });
    }
  }
  console.log("LES 401 RÈGLES, CLASSÉES SELON LA DÉFINITION PRISE AU MOT\n");
  for (const c of ["verified_official", "corroborated", "legacy_unverified", "unknown"]) {
    console.log(`  ${String(classes.get(c) ?? 0).padStart(4)}  ${c}`);
  }
  const q = regles.filter((r) => typeof r.source?.quote === "string").length;
  const loc = regles.filter((r) => typeof r.source?.locator === "string").length;
  console.log(`\n  ${String(q).padStart(4)}  règles portant une citation verbatim`);
  console.log(`  ${String(loc).padStart(4)}  règles portant un locator`);
  console.log(`  ${String(regles.filter(IMPORT_SEUL).length).padStart(4)}  règles dont l'historique ne dit QUE « Initial import — pending live re-verification »`);

  /* ---- L'IMPACT SUR CE QUE LE VISITEUR LIT ---------------------------------------------------
   *
   * PREMIÈRE MESURE FAUSSE, ET ELLE RESTE ÉCRITE ICI. Cette section comptait les verdicts sur
   * `channels[].cls` — la pastille éditoriale de la fiche. Or depuis T0-B2 l'écran ne lit plus
   * `cls` : `decisionCanal.ts` prend la décision dans `premium.policy[canal]`, projetée du bloc
   * `policies:`. Mesurer `cls`, c'était mesurer un champ que plus personne n'affiche — et rendre
   * un rapport d'impact sur la mauvaise surface. La faute est la même que d'habitude : DEUX
   * définitions de la même chose, et j'ai mesuré celle qui ne publie pas.
   *
   * ON MESURE DONC `policies:`, la surface qui décide. Et la surface qui décide dit ceci : sur
   * 302 blocs, 216 sont décidés (`offered` / `not_offered`), 84 sont DÉJÀ `legacy_unreviewed`,
   * et ZÉRO décision ne porte de source auditée. Les deux seules sources auditées du dépôt
   * (Thai Airways, Virgin Australia) sont posées sur des blocs NON décidés. */
  const regs = new Map();
  for (const r of regles) if (r.scope?.type === "airline") {
    if (!regs.has(r.scope.id)) regs.set(r.scope.id, []);
    regs.get(r.scope.id).push({ r, c: classer(r) });
  }
  let blocs = 0, decides = 0, nonRevus = 0, autres = 0;
  let prouves = 0, corrobores = 0, muets = 0, cartesA = 0, cartesB = 0;
  const sansCanalA = [], sansCanalB = [];
  for (const f of readdirSync("content/airlines").filter((x) => x.endsWith(".yml") && x !== "_template.yml").sort()) {
    const d = YAML.parse(readFileSync(join("content/airlines", f), "utf8"));
    const rs = regs.get(d.id) ?? [];
    let ici = 0, decA = 0, decB = 0, toucheeA = false, toucheeB = false;
    for (const [canal, p] of Object.entries(d.policies ?? {})) {
      blocs++;
      if (p.review_state === "legacy_unreviewed") { nonRevus++; continue; }
      if (p.availability !== "offered" && p.availability !== "not_offered") { autres++; continue; }
      decides++; ici++;
      const sur = rs.filter(({ r }) => (r.effect?.placement ?? []).includes(canal));
      if (p.source) { prouves++; decA++; decB++; continue; }
      toucheeA = true;
      if (sur.some(({ c }) => c === "corroborated")) { corrobores++; decB++; }
      else { muets++; toucheeB = true; }
    }
    if (toucheeA) cartesA++;
    if (toucheeB) cartesB++;
    if (ici > 0 && decA === 0) sansCanalA.push(d.name ?? f);
    if (ici > 0 && decB === 0) sansCanalB.push(d.name ?? f);
  }
  console.log(`\nLA SURFACE QUI DÉCIDE VRAIMENT — le bloc \`policies:\` des 102 fiches\n`);
  console.log(`  ${String(blocs).padStart(4)}  blocs de politique`);
  console.log(`  ${String(decides).padStart(4)}  décidés (offered | not_offered) — verdict catégorique publié`);
  console.log(`  ${String(nonRevus).padStart(4)}  déjà « legacy_unreviewed » — déjà « à confirmer », rien à rétrograder`);
  console.log(`  ${String(autres).padStart(4)}  case_by_case | undocumented`);
  console.log(`  ${String(prouves).padStart(4)}  décidés portant une source AUDITÉE (T0bAuditSource)`);
  console.log(`\nSCÉNARIO A — seule une preuve citée maintient un verdict\n`);
  console.log(`  ${String(decides - prouves).padStart(4)}  rétrogradés   ${((100 * (decides - prouves)) / decides).toFixed(1)} %`);
  console.log(`  ${String(cartesA).padStart(4)}  cartes compagnie portant au moins un « à confirmer »`);
  console.log(`  ${String(sansCanalA.length).padStart(4)}  compagnies sans AUCUN canal décidé  → l'outil ne dit plus rien`);
  console.log(`\nSCÉNARIO B — RÉFUTÉ PAR LA CONTRE-REVUE DU 04/09/2026, conservé pour mémoire\n`);
  console.log(`  Les « 60 corroborés » ci-dessous N'EXISTENT PAS. L'appariement qui les produit ne`);
  console.log(`  regarde ni l'ACTION de la règle ni sa PORTÉE : 32 de ces 60 sont des politiques`);
  console.log(`  « offered » adossées à des règles « deny », et le reste inclut des refus mondiaux`);
  console.log(`  appuyés sur une interdiction limitée au Royaume-Uni. Le fait qui tranche : les 208`);
  console.log(`  règles de portée compagnie sont TOUTES des « deny » — aucune ne peut soutenir une`);
  console.log(`  acceptation. L'appariement correct vit dans qualifier.mjs, et la classe retenue`);
  console.log(`  s'appelle « official_source_unquoted » : une page officielle, aucune phrase citée.\n`);
  console.log(`  ${String(corrobores).padStart(4)}  décidés adossés à une règle officielle vérifiée`);
  console.log(`  ${String(muets).padStart(4)}  rétrogradés sans rien à dire   ${((100 * muets) / decides).toFixed(1)} %`);
  console.log(`  ${String(cartesB).padStart(4)}  cartes compagnie portant au moins un « à confirmer »`);
  console.log(`  ${String(sansCanalB.length).padStart(4)}  compagnies sans AUCUN canal décidé`);
  console.log(`\nLES ${sansCanalB.length} COMPAGNIES SANS AUCUN CANAL DÉCIDÉ EN SCÉNARIO B :\n  ${sansCanalB.join(" · ")}`);
}
