#!/usr/bin/env node
/**
 * IMPORT STRICT V3 — les preuves de politiques compagnies lues par Codex le 08/09/2026.
 *
 *   npx tsx packages/knowledge/scripts/importer-preuves-v3.mjs [--lot=v3|lot2] [--airline=airline_klm] [--check]
 *
 * LOTS (08/09/2026). `--lot=v3` (défaut) : les 26 faits du premier paquet. `--lot=lot2` : les 12
 * faits du second paquet (`mesures/preuves/import-strict-lot-2-2026-09-08/`), tous autorisés par
 * son LISEZ_MOI. Même contrat, même table de seuils, même rapport.
 *
 * Ce script est REJOUABLE et NOMINATIF : il n'importe que les 26 faits que le LISEZ_MOI du dossier
 * autorise explicitement (cohorte A `facts[0..19]`, B `facts[0]` et `facts[3]`, C `facts[0..2]`,
 * F `facts[1]`). Tout le reste du dossier (cohortes B partielle, D, E, F cabine, G à K) reste une
 * piste de recherche : conservé dans `mesures/preuves/import-strict-v3-2026-09-08/`, jamais lu ici.
 *
 * CE QU'IL ÉCRIT, et rien d'autre, dans le bloc `policies:` de la fiche `content/airlines/<id>.yml` :
 *   - la SOURCE citée, sous le contrat existant (`T0bAuditSource`) : URL officielle, citation
 *     verbatim, langue, localisateur, `verified_date` (date de LECTURE), `review_due` CALCULÉ par
 *     `reviewDueFrom` — jamais recopié —, confiance 4, relecteur ;
 *   - le SEUIL publié quand la citation le porte : `max_weight_kg` + `weight_includes_carrier: true`.
 *     Le tableau `SEUILS` ci-dessous est explicite : un seuil qui n'est que dans `condition_scope`
 *     (Iberia soute 45 kg, KLM soute 75 kg, Finnair soute 75/50 kg selon l'opérateur) n'est PAS
 *     écrit — la phrase citée doit porter le fait décisif.
 *
 * CE QU'IL NE FAIT JAMAIS :
 *   - changer une disponibilité : la recommandation du fait doit correspondre à ce que la fiche dit
 *     déjà (`offered` / `not_offered`) ; sinon le fait est REFUSÉ et nommé, pas appliqué ;
 *   - convertir « sous conditions » en accord : `offered` + citation projette
 *     `accepted_with_conditions`, jamais `allowed` (objects.ts) ;
 *   - remplacer une preuve déjà citée (British Airways cabine, 05/09/2026) : conservée, nommée ;
 *   - toucher tarifs, races, règles sanitaires ou météo, ni les blocs `channels:` éditoriaux.
 *
 * Après lui : `npm run ingest` (les fiches → objects.json), puis `npm run ingest:check`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { reviewDueFrom } from "../src/common.ts";

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split("=").slice(1).join("=");
const CHECK = process.argv.includes("--check");
const SEUL = arg("airline", "");
const LOT = arg("lot", "v3");
const LOTS = {
  /** Les 26 faits autorisés du premier paquet — le LISEZ_MOI prévaut sur le reste du dossier. */
  v3: { dossier: "mesures/preuves/import-strict-v3-2026-09-08", total: 26,
    fichiers: { A: [...Array(20).keys()], B: [0, 3], C: [0, 1, 2], F: [1] },
    nom: (coh) => `PREUVES_POLITIQUES_COMPAGNIES_COHORTE_${coh}_2026-09-08.json` },
  /** Le second paquet : un seul fichier, ses 12 faits tous autorisés. */
  lot2: { dossier: "mesures/preuves/import-strict-lot-2-2026-09-08", total: 12,
    fichiers: { LOT2: "tous" },
    nom: () => "PREUVES_POLITIQUES_COMPAGNIES_LOT_2_STRICT_2026-09-08.json" },
  /** Le troisième paquet : un seul fichier, ses 12 faits tous autorisés. */
  lot3: { dossier: "mesures/preuves/import-strict-lot-3-2026-09-08", total: 12,
    fichiers: { LOT3: "tous" },
    nom: () => "PREUVES_POLITIQUES_COMPAGNIES_LOT_3_STRICT_2026-09-08.json" },
  /** Le quatrième paquet (09/09) : un seul fichier, ses 23 faits tous autorisés, 7 non-décisions. */
  lot4: { dossier: "mesures/preuves/import-strict-lot-4-2026-09-09", total: 23,
    fichiers: { LOT4: "tous" },
    nom: () => "PREUVES_POLITIQUES_COMPAGNIES_LOT_4_STRICT_2026-09-09.json" },
  /** Le cinquième paquet (09/09) : un seul fichier, ses 19 faits tous autorisés, 11 non-décisions. */
  lot5: { dossier: "mesures/preuves/import-strict-lot-5-2026-09-09", total: 19,
    fichiers: { LOT5: "tous" },
    nom: () => "PREUVES_POLITIQUES_COMPAGNIES_LOT_5_STRICT_2026-09-09.json" },
  /** Le sixième paquet (09/09) : un seul fichier, ses 22 faits tous autorisés, 8 non-décisions. */
  lot6: { dossier: "mesures/preuves/import-strict-lot-6-2026-09-09", total: 22,
    fichiers: { LOT6: "tous" },
    nom: () => "PREUVES_POLITIQUES_COMPAGNIES_LOT_6_STRICT_2026-09-09.json" },
};
if (!LOTS[LOT]) throw new Error(`lot inconnu : ${LOT}`);
const DOSSIER = resolve(arg("dossier", LOTS[LOT].dossier));
const FICHES = resolve("content/airlines");
const AUTORISES = LOTS[LOT].fichiers;

/** Seuils ÉCRITS, parce que la phrase citée les porte (chien + contenant). Rien d'autre. */
const SEUILS = {
  "airline_aegean.cabin": 8, "airline_transavia.cabin": 8, "airline_klm.cabin": 8, "airline_lufthansa.cabin": 8,
  "airline_iberia.cabin": 8, "airline_tap.cabin": 8, "airline_turkish.cabin": 8, "airline_finnair.cabin": 8,
  "airline_sas.cabin": 8, "airline_vueling.cabin": 10,
  /* Soute : les deux seules citations qui plafonnent en toutes lettres, contenant compris. */
  "airline_air_france.hold": 75, "airline_turkish.hold": 50,
  /* Lot 2. Air Transat cabine : « carrier and animal must not exceed 8 kilos ». Air Europa
     cabine : « The weight of the pet cannot exceed 8 kg » — le CHIEN SEUL ; la phrase donne aussi
     10 kg sac compris. Le fait décisif de Codex est le seuil du chien seul (8) : il s'écrit avec
     `weight_includes_carrier: false`, EXPLICITE — le moteur refuse au-dessus dans les deux cas,
     et la carte dit lequel des deux plafonds elle applique. */
  "airline_air_transat.cabin": 8, "airline_air_europa.cabin": 8,
  /* Lot 3 — toutes contenant compris, en toutes lettres dans la phrase citée : Air India cabine
     10 (« combined weight of the pet and the carrier must not exceed 10 kg »), Avianca cabine 10
     et soute 70 (« including the weight of their container » / « including the container's
     weight »), Ethiopian cabine 8 et soute 45 (« pet + cage … up to 45 kg »), Etihad cabine 8
     (« up to 8kg, including their carrier »). Air India soute 32 kg n'est PAS écrit : le seuil
     figure dans la phrase du FRET (fait 2), pas dans celle de la soute (fait 1). */
  "airline_air_india.cabin": 10, "airline_avianca.cabin": 10, "airline_avianca.hold": 70,
  "airline_ethiopian.cabin": 8, "airline_ethiopian.hold": 45, "airline_etihad.cabin": 8,
  /* Lot 4 — trois plafonds cabine, tous contenant compris, en toutes lettres : Austrian (« The total
     weight of the animal and the carrying container must not exceed 8 kg »), SWISS (« up to 8 kg
     (weight including travel carrier) »), Brussels (« The total weight of the transport container,
     including the animal, must not exceed 8 kg »). ITA cabine n'est PAS écrit : 12 kg sur certains
     vols intérieurs italiens, 8 ailleurs — Codex refuse un seuil mondial, et nous aussi. */
  "airline_austrian.cabin": 8, "airline_swiss.cabin": 8, "airline_brussels.cabin": 8,
  /* Lot 5 — DÉVIATION ARGUMENTÉE, nommée pour Codex. Sa règle 5 : « les plafonds de 7, 8 et 10 kg
     ne doivent devenir un refus moteur que si le modèle porte toute leur portée géographique et
     leur poids combiné ». Le modèle porte le poids combiné (chien + contenant, lot 1). Portée
     géographique : Korean Air 7 (cabine) et 45 (soute) et Asiana 7 (cabine) sont des conditions
     GÉNÉRALES, sans restriction de route dans la phrase ni dans la portée nommée — écrites, en
     toutes lettres dans la citation (« 반려동물과 운송용기 합한 총 무게가 7kg 이하 »,
     « combined weight of the pet and its cage must not exceed 7kg »). Virgin Australia 8 (essai sur
     certains vols intérieurs) et Philippine 10 (FurPAL, vols intérieurs seulement) ne sont PAS
     écrits par CE lot : leur portée est une route, que le modèle ne porte pas.
     ERREUR NOMMÉE (09/09/2026, après import) : le plafond de Philippine arrivait quand même dans la
     donnée projetée — DÉDUIT de sa ligne tarifaire par l'ingestion, sur un canal devenu cité — et le
     calculateur de caisses le publiait (21 limites au lieu de 20). Fermé dans `ingest-airlines.mjs`
     (plus de dérivation tarifaire sur une cabine citée). Le 8 kg de Virgin Australia, que
     l'arbitrage du 28/08 exige, est écrit dans la fiche depuis la citation de Philippe du 28/08 —
     inerte : `case_by_case` ne refuse jamais au seuil. */
  "airline_korean_air.cabin": 7, "airline_korean_air.hold": 45, "airline_asiana.cabin": 7,
  /* Lot 6 — même lecture que le lot 5 (règle 5 de Codex : « aucun ne peut devenir un seuil global du
     moteur sans modéliser toute sa portée »). Aeromexico 9 (cabine) et 45 (soute) : la ligne citée
     du tableau officiel dit « Hasta 9 kg (Incluyendo transportadora) » / « Hasta 45 kg (Incluyendo
     transportadora) », sans route — écrits, chien + contenant. EgyptAir 8 : « The total weight of
     animal and cage should not exceed 8 KG », sans route — écrit. Royal Jordanian 7 : la phrase
     citée s'arrête à « subject to the following conditions: » et ne porte pas le chiffre ; portée
     Economy + vol ≤ 5 h — NON écrit, par contrat autant que par portée. */
  "airline_aeromexico.cabin": 9, "airline_aeromexico.hold": 45, "airline_egyptair.cabin": 8,
};
/** Seuils du CHIEN SEUL (le contenant s'ajoute) : `weight_includes_carrier: false`, écrit. */
const SEUIL_CHIEN_SEUL = new Set(["airline_air_europa.cabin"]);

const DISPONIBILITE = {
  deny_when_dog_weight_kg_gt_8: "offered", deny_when_dog_weight_kg_gt_10: "offered",
  offered_with_conditions: "offered", not_offered_for_pet_dogs: "not_offered",
};

const yamlStr = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const faits = [];
for (const [coh, idx] of Object.entries(AUTORISES)) {
  const f = resolve(DOSSIER, LOTS[LOT].nom(coh));
  const d = JSON.parse(readFileSync(f, "utf8"));
  const def = d.provenance_defaults ?? {};
  for (const i of (idx === "tous" ? d.facts.map((_, k) => k) : idx)) {
    const x = d.facts[i];
    if (!x) throw new Error(`cohorte ${coh} : facts[${i}] absent — le LISEZ_MOI et le JSON ne concordent pas`);
    faits.push({ cohorte: coh, index: i, ...x, source_type: def.source_type ?? "official_website",
      verified_date: def.verified_date ?? d.as_of, confidence: def.confidence ?? 4, reviewer: def.reviewer });
  }
}
if (faits.length !== LOTS[LOT].total) throw new Error(`${LOTS[LOT].total} faits attendus, ${faits.length} lus`);

const rapport = [];
const parFiche = new Map();
for (const f of faits) {
  if (SEUL && f.airline_id !== SEUL) continue;
  (parFiche.get(f.airline_id) ?? parFiche.set(f.airline_id, []).get(f.airline_id)).push(f);
}

for (const [airlineId, lot] of parFiche) {
  const id = airlineId.replace(/^airline_/, "");
  const chemin = resolve(FICHES, `${id}.yml`);
  if (!existsSync(chemin)) { for (const f of lot) rapport.push({ ...f, action: "REFUSÉ", raison: `fiche ${id}.yml introuvable` }); continue; }
  let texte = readFileSync(chemin, "utf8");
  const lignes = texte.split("\n");
  const debut = lignes.findIndex((l) => /^policies:\s*$/.test(l));
  if (debut < 0) { for (const f of lot) rapport.push({ ...f, action: "REFUSÉ", raison: "bloc policies: absent" }); continue; }
  let fin = lignes.findIndex((l, i) => i > debut && /^[a-zA-Z]/.test(l));
  if (fin < 0) fin = lignes.length;

  for (const f of lot) {
    /* Bornes du bloc du placement : de `  <placement>:` à la prochaine clé de même niveau. */
    const pDebut = lignes.findIndex((l, i) => i > debut && i < fin && new RegExp(`^  ${f.placement}:\\s*$`).test(l));
    if (pDebut < 0) { rapport.push({ ...f, action: "REFUSÉ", raison: `policies.${f.placement} absent de la fiche` }); continue; }
    let pFin = lignes.findIndex((l, i) => i > pDebut && i < fin && /^  [a-z_]+:\s*$/.test(l));
    if (pFin < 0) pFin = fin;
    const bloc = lignes.slice(pDebut + 1, pFin);
    const attendue = DISPONIBILITE[f.recommendation];
    if (!attendue) { rapport.push({ ...f, action: "REFUSÉ", raison: `recommandation inconnue ${f.recommendation}` }); continue; }
    let dispoLigne = bloc.findIndex((l) => /^    availability:\s*\S+/.test(l));
    let reactivee = false;
    if (dispoLigne < 0) {
      /* RÉACTIVATION D'UNE LIGNE NON REVÉRIFIÉE (lot 2, Cathay Pacific fret). Une ligne
         `review_state: legacy_unreviewed` n'a pas de disponibilité : c'est la seule situation où
         l'importeur en ÉCRIT une, et seulement parce que la preuve complète l'accompagne — c'est
         exactement ce que la frontière prescrit (« ne jamais réactiver une valeur sans cette
         preuve »). Le rapport le nomme « RÉACTIVÉ », distinct d'« IMPORTÉ ». */
      const legacy = bloc.findIndex((l) => /^    review_state:\s*legacy_unreviewed/.test(l));
      if (legacy < 0) { rapport.push({ ...f, action: "REFUSÉ", raison: "ni `availability:` ni `review_state:` — bloc illisible" }); continue; }
      bloc[legacy] = `    availability: ${attendue}   # RÉACTIVÉE sur citation (import strict, ${LOT}, ${f.verified_date}) — était review_state: legacy_unreviewed`;
      lignes[pDebut + 1 + legacy] = bloc[legacy];
      dispoLigne = legacy; reactivee = true;
    }
    const dispo = bloc[dispoLigne].split(":")[1].trim().split(/\s+#/)[0].trim();
    if (dispo !== attendue) { rapport.push({ ...f, action: "REFUSÉ", raison: `la fiche dit ${dispo}, le fait suppose ${attendue} — aucune disponibilité n'est changée par cet import` }); continue; }
    if (bloc.some((l) => /^      quote:/.test(l))) { rapport.push({ ...f, action: "CONSERVÉ", raison: "une preuve citée existe déjà dans la fiche — non remplacée" }); continue; }
    if (bloc.some((l) => /^    source:/.test(l))) { rapport.push({ ...f, action: "REFUSÉ", raison: "une `source:` non citée existe déjà dans le bloc — à retirer à la main avant import" }); continue; }
    const cle = `${f.airline_id}.${f.placement}`;
    const seuil = SEUILS[cle];
    const chienSeul = SEUIL_CHIEN_SEUL.has(cle);
    const attenduSeuil = /^deny_when_dog_weight_kg_gt_(\d+)$/.exec(f.recommendation);
    if (attenduSeuil && Number(attenduSeuil[1]) !== seuil) { rapport.push({ ...f, action: "REFUSÉ", raison: `la recommandation porte un seuil ${attenduSeuil[1]} que la table SEUILS ne confirme pas` }); continue; }
    if ((f.quote ?? "").length < 10 || !f.quote_language || !f.locator || !/^https?:\/\//.test(f.url ?? "")) {
      rapport.push({ ...f, action: "REFUSÉ", raison: "citation, langue, localisateur ou URL manquants" }); continue;
    }
    if (/…|\.\.\./.test(f.quote)) { rapport.push({ ...f, action: "REFUSÉ", raison: "citation non continue (ellipse)" }); continue; }
    const reviewDue = reviewDueFrom(f.verified_date, "airline");
    const insertion = [
      `    # PREUVE IMPORTÉE — import strict ${LOT} (Codex, lecture directe du ${f.verified_date}, cohorte ${f.cohorte} fait ${f.index}).`,
      `    # Effet attendu : ${f.finder_effect}`,
      `    # Portée nommée : ${f.condition_scope}`,
      ...(seuil ? [
        chienSeul
          ? `    # Le plafond cité est celui du CHIEN SEUL (le contenant s'ajoute) : refus sûr au-dessus, jamais un oui en dessous.`
          : `    # Le plafond cité inclut le CONTENANT : refus sûr si le chien seul le dépasse, jamais un oui en dessous.`,
        `    max_weight_kg: ${seuil}`,
        `    weight_includes_carrier: ${chienSeul ? "false" : "true"}`,
      ] : []),
      `    source:`,
      `      url: ${yamlStr(f.url)}`,
      `      source_type: ${f.source_type}`,
      `      verified_date: ${yamlStr(f.verified_date)}`,
      `      review_due: ${yamlStr(reviewDue)}   # reviewDueFrom(verified_date, "airline") — calculé par l'importeur`,
      `      confidence: ${f.confidence}`,
      `      reviewer: ${yamlStr(f.reviewer)}`,
      `      history: []`,
      `      quote: ${yamlStr(f.quote)}`,
      `      quote_language: ${f.quote_language}`,
      `      locator: ${yamlStr(f.locator)}`,
    ];
    lignes.splice(pDebut + 1 + dispoLigne + 1, 0, ...insertion);
    fin += insertion.length;
    rapport.push({ ...f, action: reactivee ? "RÉACTIVÉ" : "IMPORTÉ",
      raison: (seuil ? `seuil ${seuil} kg ${chienSeul ? "chien seul" : "chien + contenant"}` : "citation seule") + (reactivee ? " — ligne non revérifiée réactivée sur citation" : "") });
  }
  const nouveau = lignes.join("\n");
  if (nouveau !== texte && !CHECK) writeFileSync(chemin, nouveau);
}

let importes = 0, conserves = 0, refuses = 0;
for (const r of rapport) {
  if (r.action === "IMPORTÉ" || r.action === "RÉACTIVÉ") importes++; else if (r.action === "CONSERVÉ") conserves++; else refuses++;
  console.log(`${r.action.padEnd(8)} ${r.airline_id}.${r.placement.padEnd(5)} (${r.cohorte}[${r.index}]) — ${r.raison}`);
}
console.log(`\n${CHECK ? "[check] " : ""}${importes} importé(s), ${conserves} conservé(s), ${refuses} refusé(s) sur ${rapport.length} fait(s) autorisé(s)`);
if (refuses > 0) process.exit(1);
