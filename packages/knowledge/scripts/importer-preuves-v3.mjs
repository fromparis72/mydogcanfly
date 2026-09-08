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
      bloc[legacy] = `    availability: ${attendue}   # RÉACTIVÉE sur citation (import strict, lot 2, ${f.verified_date}) — était review_state: legacy_unreviewed`;
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
      `    # PREUVE IMPORTÉE — import strict V3 (Codex, lecture directe du ${f.verified_date}, cohorte ${f.cohorte} fait ${f.index}).`,
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
