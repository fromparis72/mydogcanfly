#!/usr/bin/env node
/**
 * mesurer-achevement.mjs — l'annexe reproductible du DOSSIER-ACHEVEMENT-PROJET.
 *
 *   node mesurer-achevement.mjs            texte lisible
 *   node mesurer-achevement.mjs --json     le même relevé, exploitable
 *
 * POURQUOI CE SCRIPT PLUTÔT QU'UN TABLEAU RECOPIÉ. Le dossier d'achèvement énonce des dettes
 * chiffrées. Un chiffre écrit à la main dans un document vieillit sans prévenir : il reste juste
 * le jour où on l'écrit et devient faux au commit suivant, sans que rien ne le signale. Chaque
 * nombre du dossier provient donc d'ici, et se recalcule d'une commande.
 *
 * L'ENJEU EST CONCRET, ET IL S'EST DÉJÀ PRODUIT. Le cadrage de cette mission parlait de « 124
 * traductions ES/PT » et de « 171 règles auto-citées ». Les deux étaient vrais à leur date et
 * faux aujourd'hui : les traductions sont 144, et les règles auto-citées 130. Reprendre ces
 * chiffres aurait produit un dossier d'achèvement fondé sur un état disparu.
 *
 * IL NE CORRIGE RIEN. Il lit, il compte, il n'écrit aucun fichier du dépôt.
 *
 * BASE DE LECTURE : l'arbre de travail courant. Le dossier nomme le SHA sur lequel il a été
 * établi ; rejouer ce script sur un autre commit donnera d'autres nombres, et c'est voulu.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const AUJOURDHUI = new Date().toISOString().slice(0, 10);
const JSON_OUT = process.argv.includes("--json");
const lire = (p) => JSON.parse(readFileSync(p, "utf-8"));
const jours = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);

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
    parCle.get(cle)[l] = { fichier: f, sourceUrl: champ(t, "sourceUrl") };
  }
}
/* Une TRADUCTION se reconnaît à son ORIGINE, pas à sa langue : un guide non anglais SANS
   `sourceUrl` est né ici, donc traduit de l'anglais. Les 62 français importés sont des originaux
   écrits dans leur langue — les compter comme traductions gonflerait la dette d'un tiers. */
const traductions = { fr: [], es: [], pt: [] };
for (const [cle, v] of parCle) {
  for (const l of ["fr", "es", "pt"]) {
    if (v[l] && !v[l].sourceUrl) traductions[l].push(cle);
  }
}

/* ---- couvertures ----------------------------------------------------------------------------- */
const couv = existsSync("couvertures-guides.json") ? lire("couvertures-guides.json").images : {};
const provenance = {
  images: Object.keys(couv).length,
  non_verifiees: Object.values(couv).filter((v) => v.verifie !== true).length,
  sans_auteur: Object.values(couv).filter((v) => !v.auteur).length,
  sans_url_origine: Object.values(couv).filter((v) => !v.url_origine).length,
};

/* ---- règles et sources ------------------------------------------------------------------------ */
const regles = lire("packages/knowledge/raw/rules.json");
const source = (r) => (Array.isArray(r.source) ? r.source[0] ?? {} : r.source ?? {});
const compter = (xs) => xs.reduce((m, x) => (m[x] = (m[x] ?? 0) + 1, m), {});

const autocitees = regles.filter((r) => String(source(r).url ?? "").toLowerCase().includes("mydogcanfly"));
const echeances = regles.map((r) => source(r).review_due).filter(Boolean).sort();
const parEcheance = { echue: 0, moins_30j: 0, moins_90j: 0, plus_90j: 0, sans: regles.length - echeances.length };
for (const d of echeances) {
  const j = jours(d, AUJOURDHUI);
  if (j < 0) parEcheance.echue++;
  else if (j < 30) parEcheance.moins_30j++;
  else if (j < 90) parEcheance.moins_90j++;
  else parEcheance.plus_90j++;
}

/* ---- compagnies ------------------------------------------------------------------------------- */
const cies = lire("packages/ui/src/data/airlines.generated.json");
const legacy = { cabin: 0, hold: 0, cargo: 0 };
const ciesTouchees = new Set();
for (const [id, c] of Object.entries(cies)) {
  for (const [canal, p] of Object.entries(c.policies ?? {})) {
    if (p?.review_state === "legacy_unreviewed") { legacy[canal] = (legacy[canal] ?? 0) + 1; ciesTouchees.add(id); }
  }
}
const agesCies = Object.values(cies).filter((c) => c.verified_date)
  .map((c) => jours(AUJOURDHUI, c.verified_date)).sort((a, b) => a - b);

/* ---- pays --------------------------------------------------------------------------------------- */
const objets = lire("packages/knowledge/raw/objects.json");
const pays = Array.isArray(objets.countries) ? objets.countries : Object.values(objets.countries ?? {});
const paysDates = pays.filter((p) => p.verified_date).length;

/* ---- correspondances ------------------------------------------------------------------------------ */
const routes = lire("packages/knowledge/raw/collecte-2026-07/routes_FULL_strict.json");
const champsRoutes = [...new Set(Object.values(routes).flatMap((v) => Object.keys(v)))].sort();
/* Le moteur connaît-il la distinction commercialisateur / opérateur ? On cherche les mots qui la
   porteraient. Leur ABSENCE est le résultat : elle dit que la question n'est pas modélisée. */
const motsOperateur = ["codeshare", "operating_carrier", "marketing_carrier", "operated_by"];
const trouves = motsOperateur.filter((m) =>
  spawnSync("grep", ["-rql", m, "packages/engine/src", "packages/knowledge/src"], { encoding: "utf-8" }).status === 0);

/* ---- workflows ------------------------------------------------------------------------------------- */
const workflows = existsSync(".github/workflows") ? readdirSync(".github/workflows").sort() : [];

/* ---- contre-épreuves --------------------------------------------------------------------------------- */
const catalogue = existsSync("contre-epreuves-attendues.json")
  ? lire("contre-epreuves-attendues.json").identifiants.length : null;

const releve = {
  releve_du: AUJOURDHUI,
  depot: { sha, arbre_propre: propre, nvmrc, node: process.version, workflows },
  guides: {
    cles_logiques: parCle.size,
    par_langue: Object.fromEntries(LANGUES.map((l) => [l, [...parCle.values()].filter((v) => v[l]).length])),
    traductions_a_relire: Object.fromEntries(Object.entries(traductions).map(([l, v]) => [l, v.length])),
    traductions_total: Object.values(traductions).reduce((s, v) => s + v.length, 0),
  },
  couvertures: provenance,
  regles: {
    total: regles.length,
    par_type_de_source: compter(regles.map((r) => source(r).source_type ?? "(absent)")),
    par_confiance: compter(regles.map((r) => String(source(r).confidence ?? "(absente)"))),
    autocitees: autocitees.length,
    echeances: parEcheance,
    premiere_echeance: echeances[0] ?? null,
    derniere_echeance: echeances[echeances.length - 1] ?? null,
    par_mois: compter(echeances.map((d) => d.slice(0, 7))),
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
  pays: { total: pays.length, avec_verified_date: paysDates },
  correspondances: {
    compagnies_avec_routes: Object.keys(routes).length,
    champs_de_route: champsRoutes,
    marqueurs_operateur_trouves: trouves,
  },
  contre_epreuves: catalogue,
};

if (JSON_OUT) { process.stdout.write(JSON.stringify(releve, null, 2) + "\n"); process.exit(0); }

const l = (m) => process.stdout.write(m + "\n");
l(`RELEVÉ DU ${releve.releve_du} — ${sha}`);
l(`arbre ${propre ? "PROPRE" : "MODIFIÉ"} · .nvmrc ${nvmrc} · node ${process.version} · ${workflows.length} workflow(s)`);
l("");
l("GUIDES");
l(`  ${releve.guides.cles_logiques} clés · ${JSON.stringify(releve.guides.par_langue)}`);
l(`  traductions à relire : ${JSON.stringify(releve.guides.traductions_a_relire)} — total ${releve.guides.traductions_total}`);
l("");
l("COUVERTURES");
l(`  ${provenance.images} images · ${provenance.non_verifiees} non vérifiées · ${provenance.sans_auteur} sans auteur · ${provenance.sans_url_origine} sans URL`);
l("");
l("RÈGLES");
l(`  ${releve.regles.total} au total · types ${JSON.stringify(releve.regles.par_type_de_source)}`);
l(`  AUTO-CITÉES : ${releve.regles.autocitees}`);
l(`  échéances : ${JSON.stringify(releve.regles.echeances)}`);
l(`  de ${releve.regles.premiere_echeance} à ${releve.regles.derniere_echeance} · ${JSON.stringify(releve.regles.par_mois)}`);
l("");
l("COMPAGNIES");
l(`  ${releve.compagnies.total} · legacy_unreviewed ${JSON.stringify(legacy)} = ${releve.compagnies.policies_legacy_total} sur ${ciesTouchees.size} compagnies`);
l(`  âge de vérification : ${JSON.stringify(releve.compagnies.age_verification_jours)}`);
l("");
l("PAYS");
l(`  ${releve.pays.total} · avec verified_date : ${releve.pays.avec_verified_date}`);
l("");
l("CORRESPONDANCES");
l(`  ${releve.correspondances.compagnies_avec_routes} compagnies · champs ${JSON.stringify(champsRoutes)}`);
l(`  marqueurs commercialisateur/opérateur trouvés : ${trouves.length ? trouves.join(", ") : "AUCUN"}`);
l("");
l(`CONTRE-ÉPREUVES au catalogue : ${catalogue}`);
