#!/usr/bin/env node
/**
 * T0-B3-f — CE QUE LES RÈGLES AFFIRMENT, FACE À LEUR PROPRE PHRASE.
 *
 * Ce dossier ne corrige rien : aucune règle modifiée, aucun texte réécrit, aucun fichier de
 * `packages/` écrit. L'empreinte du référentiel est relue à la fin.
 *
 * LA QUESTION. Chaque règle porte DEUX affirmations sur le même objet : un `params` que le moteur
 * applique, et une `rationale` que le lecteur lit. Personne n'avait vérifié qu'elles disent la même
 * chose. Ce dossier les confronte.
 *
 * TROIS VERSIONS DE CE CONTRÔLE ONT ÉTÉ REJETÉES AVANT CELLE-CI, et il faut le dire, parce que
 * chacune aurait produit une accusation fausse :
 *
 *   1. « le nombre appliqué doit figurer dans la phrase » — 65 règles auraient été dénoncées.
 *      FAUX : `lead_time_days: 60` face à « 1 to 2 months » n'est pas un mensonge, c'est une autre
 *      unité. Un audit qui salit une règle correcte ne vaut rien.
 *
 *   2. « comparons après conversion des unités » — 54 règles auraient été dénoncées. FAUX AUSSI :
 *      ces phrases portent PLUSIEURS durées qui ne parlent pas du même objet — âge minimal de
 *      vaccination (12 semaines), attente après titrage (90 jours), validité d'un certificat.
 *      Confronter un délai de planification à toutes est une erreur de catégorie.
 *
 *   3. La version retenue ne compare que ce qui est comparable : les phrases dont l'OUVERTURE est
 *      un délai de planification (« 6 to 7 months. Requirements: … »), seule forme qui parle du
 *      même objet que `lead_time_days`. Les 130 autres ne sont pas « conformes » : elles sont
 *      MUETTES sur ce point, et le dossier les compte comme telles plutôt que de les blanchir.
 *
 * EXHAUSTIVITÉ PAR RÉSIDU. Aucune règle n'est écartée : chaque couple (règle, paramètre numérique)
 * tombe dans exactement un état, et l'absence de quatrième état est exigée.
 *
 * LES CONTRE-ÉPREUVES (chacune doit sortir en 1 avec SON diagnostic) :
 *   `delai`       un délai concordant est décalé      → « 14 divergences » tombe
 *   `permissif`   une divergence stricte est inversée → « 3 plus permissives » tombe
 *   `traduction`  une phrase espagnole est ajoutée    → « 48 en espagnol » tombe
 *   `source`      une URL est vidée                   → « toutes portent une source » tombe
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

/** Base de mesure FIGÉE, jamais `HEAD` : régénérer ne doit pas déplacer le sceau. */
export const MESURE_BASE_SHA = "5888c45c56d92288faf7d4ec589f1b9c3ca98674";

const DOSSIER = "mesures/t0b3f-ce-que-les-regles-affirment";
const RAW = { regles: "packages/knowledge/raw/rules.json" };

const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const auCommit = (c) => execFileSync("git", ["show", `${MESURE_BASE_SHA}:${c}`],
  { maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });

const CONTRE = (process.argv.find((a) => a.startsWith("--contre-epreuve=")) ?? "").split("=")[1] ?? "";
let echecs = 0;
const exiger = (label, cond, detail = "") => {
  if (!cond) { echecs++; process.stdout.write(`    ✗ ${label}${detail ? ` — ${detail}` : ""}\n`); }
};

/* ---- Le référentiel, scellé ------------------------------------------------------------------- */
for (const chemin of Object.values(RAW)) {
  if (sha256(readFileSync(chemin)) !== sha256(auCommit(chemin))) {
    process.stderr.write(`[t0b3f] ÉCHEC — ${chemin} diffère de la base ${MESURE_BASE_SHA.slice(0, 7)}.\n`);
    process.exit(1);
  }
}
const REGLES = JSON.parse(readFileSync(RAW.regles, "utf8"));

/* Les mutations de contre-épreuve n'agissent qu'en mémoire, après le contrôle du sceau. */
if (CONTRE === "delai") {
  const r = REGLES.find((x) => x.id === "rule_jp_import") ?? REGLES.find((x) => typeof x.params?.lead_time_days === "number");
  r.rationale = `999 days. ${r.rationale}`;
}
if (CONTRE === "permissif") {
  const r = REGLES.find((x) => x.id === "rule_cn_import");
  r.rationale = r.rationale.replace(/^2 to 4 months/, "12 to 14 months");
}
if (CONTRE === "traduction") {
  for (const r of REGLES) r.rationale_i18n = { ...r.rationale_i18n, es: "Frase en español." };
}
if (CONTRE === "source") REGLES.find((x) => x.id === "rule_aa_cabin_weight").source.url = "";

/* ---- 1. LA PROVENANCE : ce que chaque règle produit comme pièce ------------------------------- */
const hoteDe = (u) => { try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; } };
const DATE_BASE = execFileSync("git", ["show", "-s", "--format=%cI", MESURE_BASE_SHA], { encoding: "utf8" }).trim().slice(0, 10);

const sansSource = REGLES.filter((r) => !r.source);
const sansUrlResoluble = REGLES.filter((r) => !hoteDe(r.source?.url));
const sansDateRevue = REGLES.filter((r) => !r.source?.review_due);
const revuesEchues = REGLES.filter((r) => r.source?.review_due && r.source.review_due < DATE_BASE);

exiger("les 407 règles portent une source dont l'URL se résout en un hôte",
  REGLES.length === 407 && sansSource.length === 0 && sansUrlResoluble.length === 0,
  `${REGLES.length} règles · ${sansSource.length} sans source · ${sansUrlResoluble.length} sans URL résoluble`);
exiger("aucune revue n'est échue à la date du sceau, et aucune n'est sans échéance",
  revuesEchues.length === 0 && sansDateRevue.length === 0,
  `${revuesEchues.length} échues · ${sansDateRevue.length} sans échéance · sceau ${DATE_BASE}`);

/* L'auto-citation se lit sur l'HÔTE, jamais sur le `source_type` déclaré : le dossier T0-B3 avait
   montré que s'y fier surcomptait. Le chiffre est recompté ici sur le corpus d'aujourd'hui. */
const autoCitees = REGLES.filter((r) => /(^|\.)mydogcanfly\.com$/.test(hoteDe(r.source?.url) ?? ""));
exiger("130 des 407 règles citent le site lui-même comme source",
  autoCitees.length === 130, `${autoCitees.length}`);

/* ---- 2. LES PHRASES PUBLIÉES, PAR LANGUE ------------------------------------------------------ */
const parLangue = {};
for (const r of REGLES) for (const l of Object.keys(r.rationale_i18n ?? {})) parLangue[l] = (parLangue[l] ?? 0) + 1;
exiger("la phrase publiée existe en français pour les 407 règles, en espagnol pour 48, en portugais pour 8",
  parLangue.fr === 407 && parLangue.es === 48 && parLangue.pt === 8,
  `fr=${parLangue.fr} es=${parLangue.es} pt=${parLangue.pt}`);

/* ---- 3. LE NOMBRE APPLIQUÉ EST-IL CELUI QUI EST ÉCRIT ? --------------------------------------- */
const nombresDe = (t) => [...String(t ?? "").matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => parseFloat(m[0].replace(",", ".")));

/* Les paramètres dont la phrase est censée porter la valeur, hors délais — traités à part. */
const DIRECTS = ["max_weight_kg", "threshold_c", "health_certificate_validity_days", "min_age_months"];
const directs = { total: 0, en: 0, fr: 0, manquants: [] };
for (const r of REGLES) {
  for (const k of DIRECTS) {
    const v = r.params?.[k];
    if (typeof v !== "number") continue;
    directs.total++;
    const dansEn = nombresDe(r.rationale).includes(v);
    const fr = r.rationale_i18n?.fr;
    const dansFr = fr ? nombresDe(fr).includes(v) : null;
    if (dansEn) directs.en++;
    if (dansFr) directs.fr++;
    if (!dansEn || dansFr === false) directs.manquants.push({ id: r.id, param: k, valeur: v, en: dansEn, fr: dansFr });
  }
}
exiger("chaque seuil de poids, de température, de validité et d'âge est ÉCRIT dans la phrase, en anglais comme en français",
  directs.manquants.length === 0, `${directs.total} couples · ${directs.manquants.length} manquants`);

/* ---- 4. LES DÉLAIS : la seule comparaison légitime -------------------------------------------- */
const UNITE = { day: 1, days: 1, week: 7, weeks: 7, month: 30, months: 30, year: 365, years: 365 };
/* L'OUVERTURE de la phrase, et elle seule. Voir l'en-tête : une durée citée au milieu du texte
   parle d'autre chose (âge de vaccination, attente après titrage, validité d'un certificat). */
const EN_TETE = /^\s*(?:about\s+|around\s+|approx\.?\s+)?(\d+(?:[.,]\d+)?)\s*(?:(?:to|–|—|-)\s*(\d+(?:[.,]\d+)?)\s*)?(day|days|week|weeks|month|months|year|years)\b/i;

const delais = { total: 0, muettes: [], concordantes: [], divergentes: [] };
for (const r of REGLES) {
  const v = r.params?.lead_time_days;
  if (typeof v !== "number") continue;
  delais.total++;
  const m = EN_TETE.exec(r.rationale ?? "");
  if (!m) { delais.muettes.push(r.id); continue; }
  const u = UNITE[m[3].toLowerCase()];
  const min = parseFloat(m[1].replace(",", ".")) * u;
  const max = (m[2] ? parseFloat(m[2].replace(",", ".")) : parseFloat(m[1].replace(",", "."))) * u;
  const fiche = { id: r.id, applique_jours: v, phrase: m[0].trim(), annonce_min_jours: min, annonce_max_jours: max };
  if (v >= min && v <= max) delais.concordantes.push(fiche);
  else delais.divergentes.push({ ...fiche, sens: v < min ? "moteur_plus_permissif" : "moteur_plus_strict" });
}
/* AUCUN QUATRIÈME ÉTAT. Si la somme ne retombe pas, une règle a été perdue en route. */
exiger("chaque règle à délai est classée : muette, concordante ou divergente — aucun quatrième état",
  delais.muettes.length + delais.concordantes.length + delais.divergentes.length === delais.total,
  `${delais.muettes.length} + ${delais.concordantes.length} + ${delais.divergentes.length} ≠ ${delais.total}`);
exiger("183 règles portent un délai ; 53 phrases l'énoncent, 39 concordent, 14 divergent, 130 sont muettes",
  delais.total === 183 && delais.muettes.length === 130
  && delais.concordantes.length === 39 && delais.divergentes.length === 14,
  `total=${delais.total} muettes=${delais.muettes.length} concordantes=${delais.concordantes.length} divergentes=${delais.divergentes.length}`);

/* LE SENS COMPTE PLUS QUE LE NOMBRE. Une règle plus STRICTE que sa phrase déroute ; une règle plus
   PERMISSIVE que sa phrase fait préparer un voyageur EN DESSOUS de ce que le site lui conseille. */
const permissives = delais.divergentes.filter((d) => d.sens === "moteur_plus_permissif");
exiger("3 des 14 divergences vont dans le sens dangereux : le moteur planifie MOINS que sa propre phrase",
  permissives.length === 3 && permissives.map((d) => d.id).sort().join(",") === "rule_au_import,rule_nz_import,rule_vn_import",
  permissives.map((d) => `${d.id} ${d.applique_jours}j < ${d.annonce_min_jours}j`).join(" · "));

/* ---- Le référentiel n'a pas bougé ------------------------------------------------------------- */
for (const chemin of Object.values(RAW)) {
  if (sha256(readFileSync(chemin)) !== sha256(auCommit(chemin))) {
    process.stderr.write(`[t0b3f] ÉCHEC — ${chemin} a été MODIFIÉ pendant la mesure.\n`);
    process.exit(1);
  }
}

/* ---- L'artefact -------------------------------------------------------------------------------- */
const artefact = {
  base_de_mesure: MESURE_BASE_SHA,
  date_du_sceau: DATE_BASE,
  regles: REGLES.length,
  provenance: {
    sans_source: sansSource.length,
    sans_url_resoluble: sansUrlResoluble.length,
    revues_echues: revuesEchues.length,
    sans_date_de_revue: sansDateRevue.length,
    auto_citees: autoCitees.length,
    hotes_distincts: new Set(REGLES.map((r) => hoteDe(r.source?.url)).filter(Boolean)).size,
  },
  phrases_publiees_par_langue: parLangue,
  seuils_directs: { couples: directs.total, ecrits_en_anglais: directs.en, ecrits_en_francais: directs.fr, manquants: directs.manquants },
  delais: {
    total: delais.total,
    muettes: delais.muettes.length,
    concordantes: delais.concordantes.length,
    divergentes: delais.divergentes.sort((a, b) => a.id.localeCompare(b.id)),
  },
};
if (!CONTRE) writeFileSync(`${DOSSIER}/ce-que-les-regles-affirment.json`, JSON.stringify(artefact, null, 2) + "\n");

process.stdout.write(`\n  [t0b3f] ${REGLES.length} règles · ${delais.divergentes.length} divergences de délai `
  + `dont ${permissives.length} dans le sens permissif · espagnol ${parLangue.es ?? 0}/407 · portugais ${parLangue.pt ?? 0}/407\n`);
if (echecs) { process.stderr.write(`\n[t0b3f] ÉCHEC — ${echecs} exigence(s) non tenue(s)\n`); process.exit(1); }
process.stdout.write("  [t0b3f] toutes les exigences tiennent.\n");
