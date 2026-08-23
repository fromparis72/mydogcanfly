#!/usr/bin/env node
/**
 * mesurer-achevement.mjs — l'annexe reproductible du DOSSIER-ACHEVEMENT-PROJET.
 *
 *   node mesurer-achevement.mjs --as-of=2026-08-23
 *   node mesurer-achevement.mjs --as-of=2026-08-23 --json
 *
 * `--as-of` EST OBLIGATOIRE, et c'est le correctif le plus important de cette version.
 *
 *   La première mouture appelait `new Date()`. Les compteurs d'échéance dépendaient donc du JOUR
 *   où on la lançait : rejouer le script une semaine plus tard donnait d'autres nombres, et le
 *   lecteur n'avait aucun moyen de savoir si l'écart venait des données ou du calendrier. Une
 *   annexe dont on ne peut pas reproduire les chiffres n'est pas une annexe.
 *
 * TROIS FAUTES DE MESURE FERMÉES ICI, toutes trouvées en contre-revue :
 *
 *   1. LES PAYS ÉTAIENT LUS AU MAUVAIS NIVEAU. Le script cherchait `pays.verified_date` ; la date
 *      vit sous `pays.source.verified_date`. Il concluait « 0 pays daté sur 140 » là où 122 le
 *      sont, et le dossier en tirait un lot qui aurait FABRIQUÉ des dates sans audit. Une lecture
 *      fausse qui rend zéro est la pire espèce : elle ressemble à une découverte.
 *
 *   2. LA FRAÎCHEUR NE COUVRAIT QUE `rules.json`. Les 407 règles ne sont pas toutes les sources
 *      datées du référentiel : `objects.json` en porte 1 118 de plus. On parcourt donc TOUTE
 *      structure portant un `verified_date`, où qu'elle se trouve, plutôt qu'une liste de chemins
 *      écrite à la main — laquelle oublierait la prochaine famille ajoutée.
 *
 *   3. LES PAYS SANS SOURCE N'ÉTAIENT PAS DISTINGUÉS des pays sans date. Ce sont deux dettes
 *      différentes : 18 pays n'ont AUCUNE source, ce qui appelle un audit, et non un champ.
 *
 * IL NE CORRIGE RIEN. Il lit, il compte, il n'écrit aucun fichier du dépôt.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const args = process.argv.slice(2);
const JSON_OUT = args.includes("--json");
const asOf = (args.find((a) => a.startsWith("--as-of=")) || "").slice(8);
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(`${asOf}T00:00:00Z`))) {
  process.stderr.write(
    "[mesure] ÉCHEC : --as-of=AAAA-MM-JJ est OBLIGATOIRE.\n" +
    "[mesure] Sans date fixée, les compteurs d'échéance dépendent du jour où l'on lance le script,\n" +
    "[mesure] et les chiffres du dossier cessent d'être reproductibles.\n" +
    "[mesure]   node mesurer-achevement.mjs --as-of=2026-08-23\n");
  process.exit(2);
}

const lire = (p) => JSON.parse(readFileSync(p, "utf-8"));
const jours = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
const compter = (xs) => xs.reduce((m, x) => (m[x] = (m[x] ?? 0) + 1, m), {});

/* ---- état du dépôt -------------------------------------------------------------------------- */
const git = (...a) => spawnSync("git", a, { encoding: "utf-8" });
const sha = git("rev-parse", "HEAD").stdout.trim();
const propre = git("status", "--porcelain", "-uall").stdout.trim() === "";
const nvmrc = readFileSync(".nvmrc", "utf-8").trim();

/* ---- guides et traductions ------------------------------------------------------------------ */
const RACINE = "packages/ui/src/content/guides";
const LANGUES = ["en", "fr", "es", "pt"];
const champ = (t, n) => (new RegExp(`^${n}:\\s*"([^"]*)"\\s*$`, "m").exec(t) || [])[1] ?? null;

const parCle = new Map();
for (const l of LANGUES) {
  for (const f of readdirSync(join(RACINE, l)).filter((x) => x.endsWith(".md"))) {
    const t = readFileSync(join(RACINE, l, f), "utf-8");
    const cle = champ(t, "key");
    if (!cle) continue;
    if (!parCle.has(cle)) parCle.set(cle, {});
    parCle.get(cle)[l] = { sourceUrl: champ(t, "sourceUrl") };
  }
}
/* Une TRADUCTION se reconnaît à son ORIGINE, pas à sa langue : un guide non anglais SANS
   `sourceUrl` est né ici, donc traduit. Les 62 français importés sont des originaux écrits dans
   leur langue — les compter gonflerait la dette d'un tiers. */
const traductions = { fr: 0, es: 0, pt: 0 };
for (const v of parCle.values()) {
  for (const l of ["fr", "es", "pt"]) if (v[l] && !v[l].sourceUrl) traductions[l]++;
}

/* ---- TOUTES les sources datées du référentiel ------------------------------------------------ */
/* Parcours générique plutôt que liste de chemins : une liste écrite à la main oublie la prochaine
   famille ajoutée, et l'oubli est silencieux — le compteur reste vert avec moins de matière. */
function* sourcesDatees(x, famille) {
  if (Array.isArray(x)) { for (const v of x) yield* sourcesDatees(v, famille); return; }
  if (x && typeof x === "object") {
    if (typeof x.verified_date === "string") yield { famille, ...x };
    for (const v of Object.values(x)) yield* sourcesDatees(v, famille);
  }
}

const objets = lire("packages/knowledge/raw/objects.json");
const regles = lire("packages/knowledge/raw/rules.json");

const toutes = [];
const parFamille = {};
for (const [fam, contenu] of Object.entries(objets)) {
  const s = [...sourcesDatees(contenu, fam)];
  const items = Array.isArray(contenu) ? contenu : Object.values(contenu ?? {});
  parFamille[fam] = { objets: items.length, sources_datees: s.length };
  toutes.push(...s);
}
{
  const s = [...sourcesDatees(regles, "rules")];
  parFamille.rules = { objets: regles.length, sources_datees: s.length };
  toutes.push(...s);
}

const fraicheur = { echue: 0, moins_30j: 0, moins_90j: 0, plus_90j: 0, sans_review_due: 0 };
const echeances = [];
for (const s of toutes) {
  if (!s.review_due) { fraicheur.sans_review_due++; continue; }
  echeances.push(s.review_due);
  const j = jours(s.review_due, asOf);
  if (j < 0) fraicheur.echue++;
  else if (j < 30) fraicheur.moins_30j++;
  else if (j < 90) fraicheur.moins_90j++;
  else fraicheur.plus_90j++;
}
echeances.sort();

const autocitees = toutes.filter((s) => String(s.url ?? "").toLowerCase().includes("mydogcanfly"));

/* ---- pays : source ABSENTE et date manquante sont deux dettes distinctes ---------------------- */
const pays = Array.isArray(objets.countries) ? objets.countries : Object.values(objets.countries ?? {});
const paysSansSource = pays.filter((c) => !c.source);
const paysDates = pays.filter((c) => c.source?.verified_date);

/* ---- compagnies ------------------------------------------------------------------------------- */
const cies = lire("packages/ui/src/data/airlines.generated.json");
const legacy = {};
const ciesTouchees = new Set();
for (const [id, c] of Object.entries(cies)) {
  for (const [canal, p] of Object.entries(c.policies ?? {})) {
    if (p?.review_state === "legacy_unreviewed") { legacy[canal] = (legacy[canal] ?? 0) + 1; ciesTouchees.add(id); }
  }
}
const agesCies = Object.values(cies).filter((c) => c.verified_date)
  .map((c) => jours(asOf, c.verified_date)).sort((a, b) => a - b);

/* ---- couvertures, correspondances, workflows -------------------------------------------------- */
const couv = existsSync("couvertures-guides.json") ? lire("couvertures-guides.json").images : {};
const routes = lire("packages/knowledge/raw/collecte-2026-07/routes_FULL_strict.json");
const champsRoutes = [...new Set(Object.values(routes).flatMap((v) => Object.keys(v)))].sort();
const motsOperateur = ["codeshare", "operating_carrier", "marketing_carrier", "operated_by"];
const trouves = motsOperateur.filter((m) =>
  spawnSync("grep", ["-rql", m, "packages/engine/src", "packages/knowledge/src"], { encoding: "utf-8" }).status === 0);
const workflows = existsSync(".github/workflows") ? readdirSync(".github/workflows").sort() : [];
const catalogue = existsSync("contre-epreuves-attendues.json")
  ? lire("contre-epreuves-attendues.json").identifiants.length : null;

const releve = {
  as_of: asOf,
  depot: { sha, arbre_propre: propre, nvmrc, node: process.version, workflows },
  guides: {
    cles_logiques: parCle.size,
    par_langue: Object.fromEntries(LANGUES.map((l) => [l, [...parCle.values()].filter((v) => v[l]).length])),
    traductions_a_relire: traductions,
    traductions_total: Object.values(traductions).reduce((s, n) => s + n, 0),
  },
  couvertures: {
    images: Object.keys(couv).length,
    non_verifiees: Object.values(couv).filter((v) => v.verifie !== true).length,
    sans_auteur: Object.values(couv).filter((v) => !v.auteur).length,
    sans_url_origine: Object.values(couv).filter((v) => !v.url_origine).length,
  },
  referentiel: {
    sources_datees_total: toutes.length,
    par_famille: parFamille,
    par_type_de_source: compter(toutes.map((s) => s.source_type ?? "(absent)")),
    par_confiance: compter(toutes.map((s) => String(s.confidence ?? "(absente)"))),
    autocitees: autocitees.length,
    autocitees_par_famille: compter(autocitees.map((s) => s.famille)),
    fraicheur,
    premiere_echeance: echeances[0] ?? null,
    derniere_echeance: echeances[echeances.length - 1] ?? null,
    echeances_par_mois: compter(echeances.map((d) => d.slice(0, 7))),
  },
  pays: {
    total: pays.length,
    avec_source_datee: paysDates.length,
    sans_source: paysSansSource.length,
    identites_sans_source: paysSansSource.map((c) => c.id).sort(),
  },
  compagnies: {
    total: Object.keys(cies).length,
    policies_legacy_unreviewed: legacy,
    policies_legacy_total: Object.values(legacy).reduce((s, n) => s + n, 0),
    compagnies_touchees: ciesTouchees.size,
    sans_verified_date: Object.values(cies).filter((c) => !c.verified_date).length,
    age_verification_jours: agesCies.length
      ? { min: agesCies[0], mediane: agesCies[Math.floor(agesCies.length / 2)], max: agesCies[agesCies.length - 1],
          au_dela_90j: agesCies.filter((a) => a > 90).length }
      : null,
  },
  correspondances: {
    compagnies_avec_routes: Object.keys(routes).length,
    champs_de_route: champsRoutes,
    marqueurs_operateur_trouves: trouves,
  },
  contre_epreuves: catalogue,
};

if (JSON_OUT) { process.stdout.write(JSON.stringify(releve, null, 2) + "\n"); process.exit(0); }

const l = (m) => process.stdout.write(m + "\n");
l(`RELEVÉ AU ${asOf} — ${sha}`);
l(`arbre ${propre ? "PROPRE" : "MODIFIÉ"} · .nvmrc ${nvmrc} · node ${process.version} · ${workflows.length} workflow(s)`);
l("");
l("GUIDES");
l(`  ${releve.guides.cles_logiques} clés · ${JSON.stringify(releve.guides.par_langue)}`);
l(`  traductions à relire : ${JSON.stringify(traductions)} — total ${releve.guides.traductions_total}`);
l("");
l("COUVERTURES");
l(`  ${releve.couvertures.images} images · ${releve.couvertures.non_verifiees} non vérifiées · ${releve.couvertures.sans_auteur} sans auteur`);
l("");
l("RÉFÉRENTIEL — TOUTES SOURCES DATÉES");
l(`  ${releve.referentiel.sources_datees_total} sources datées`);
for (const [f, v] of Object.entries(parFamille)) l(`    ${f.padEnd(12)} ${String(v.objets).padStart(4)} objets · ${String(v.sources_datees).padStart(5)} source(s)`);
l(`  types : ${JSON.stringify(releve.referentiel.par_type_de_source)}`);
l(`  AUTO-CITÉES : ${releve.referentiel.autocitees} — ${JSON.stringify(releve.referentiel.autocitees_par_famille)}`);
l(`  fraîcheur : ${JSON.stringify(fraicheur)}`);
l(`  de ${releve.referentiel.premiere_echeance} à ${releve.referentiel.derniere_echeance}`);
l(`  par mois : ${JSON.stringify(releve.referentiel.echeances_par_mois)}`);
l("");
l("PAYS");
l(`  ${releve.pays.total} · ${releve.pays.avec_source_datee} avec source datée · ${releve.pays.sans_source} SANS AUCUNE SOURCE`);
l(`  sans source : ${releve.pays.identites_sans_source.join(", ")}`);
l("");
l("COMPAGNIES");
l(`  ${releve.compagnies.total} · legacy_unreviewed ${JSON.stringify(legacy)} = ${releve.compagnies.policies_legacy_total} sur ${ciesTouchees.size} compagnies`);
l(`  âge de vérification : ${JSON.stringify(releve.compagnies.age_verification_jours)}`);
l("");
l("CORRESPONDANCES");
l(`  ${releve.correspondances.compagnies_avec_routes} compagnies · champs ${JSON.stringify(champsRoutes)}`);
l(`  marqueurs commercialisateur/opérateur : ${trouves.length ? trouves.join(", ") : "AUCUN"}`);
l("");
l(`CONTRE-ÉPREUVES au catalogue : ${catalogue}`);
