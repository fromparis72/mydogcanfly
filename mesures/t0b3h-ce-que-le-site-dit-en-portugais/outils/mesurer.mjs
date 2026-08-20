#!/usr/bin/env node
/**
 * T0-B3-h — CE QUE LE SITE DIT EN PORTUGAIS (ET EN ESPAGNOL), PAGE PAR PAGE.
 *
 * Ce dossier ne corrige rien : aucune phrase traduite, aucun fichier de `packages/` écrit. Chaque
 * fichier lu est comparé au bit près à sa version du commit de base.
 *
 * LA QUESTION, ET POURQUOI ELLE EST LA SUITE DE T0-B3-g. T0-B3-g a mesuré les huit outils : 355
 * sites d'appel, 33 servis en anglais aux lecteurs portugais. Le site en compte 843. « 33 dans les
 * outils » appelle immédiatement « et ailleurs ? » — tant qu'on ne répond pas, l'arbitrage porte
 * sur une image partielle. Ce dossier mesure LE SITE ENTIER, par la même méthode.
 *
 * TROIS MÉCANISMES, TROIS CONTRATS ÉCRITS DANS LE CODE — aucune interprétation :
 *   `inlineT(en, fr, es?)`      locale es → `es ?? en`   · locale pt → `table[en] || en`
 *   `inlineF(en, fr, es, …)`    même chose, avec des trous `{0}` remplis ensuite
 *   `t(locale, clé)`            `TABLES[locale]?.[key] ?? TABLES.en[key]`
 * Un appel à moins de trois arguments sert donc l'anglais en espagnol ; une clé anglaise absente de
 * la table portugaise sert l'anglais en portugais. Ce sont des faits de code, pas des jugements.
 *
 * CE QUE J'AJOUTE PAR RAPPORT À T0-B3-g : la FAMILLE de pages que chaque fichier sert. Trente
 * chaînes dans un pied de page et trente chaînes dans une fiche pays n'ont pas le même poids, et un
 * total unique le cacherait. Les composants partagés sont marqués comme tels, jamais rattachés
 * d'autorité à une famille.
 *
 * EXHAUSTIVITÉ PAR RÉSIDU, APPLIQUÉE AU LECTEUR LUI-MÊME. Chaque occurrence repérée dans le texte
 * doit tomber dans exactement un état ; un site que l'analyseur ne saurait pas lire fait ÉCHOUER la
 * mesure au lieu d'en disparaître. Les alias sont DÉCOUVERTS fichier par fichier, jamais supposés.
 *
 * LES CONTRE-ÉPREUVES (chacune doit sortir en 1 avec SON diagnostic) :
 *   `es`      un site bascule sur l'anglais en espagnol → l'inventaire espagnol tombe
 *   `pt`      une clé manquante est ajoutée à la table  → l'inventaire portugais tombe
 *   `clef`    une clé est retirée de la table espagnole → « aucune clé incomplète » tombe
 *   `residu`  un site d'appel est retiré de l'analyse   → l'égalité des totaux tombe
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { posix } from "node:path";

import { createHash } from "node:crypto";

/** Base de mesure FIGÉE, jamais `HEAD` : régénérer ne doit pas déplacer le sceau. */
/* BASE DÉPLACÉE LE 20/08/2026, de `2948ee9` à `aff1fb8`, et le motif est écrit ici plutôt que
   supposé : la contre-revue a demandé de corriger le formateur de date, qui vit dans deux fichiers
   `.astro` du périmètre. Mesurer autre chose exige de déclarer une nouvelle base — c'est la règle,
   et c'est pourquoi je n'avais PAS rebasé de mon propre chef pour traduire les 49 chaînes. Ici la
   modification est arbitrée, donc la base bouge avec elle. Les chiffres ci-dessous sont recalculés
   sur la nouvelle base, pas recopiés. */
/* BASE DÉPLACÉE le 20/08/2026, de `aff1fb8` à `6c81edf` : la contre-revue a arbitré
   l'ajout de deux clés portugaises — « updated » et « In short » — dans la table scellée par ce
   dossier. Mesurer autre chose exige de déclarer une nouvelle base. Les chiffres sont
   RECALCULÉS sur la nouvelle base, jamais recopiés. */
export const MESURE_BASE_SHA = "6c81edf9f356619694e63694ccf5b5ac4ff9b021";

const DOSSIER = "mesures/t0b3h-ce-que-le-site-dit-en-portugais";
const SRC = "packages/ui/src";
const TABLE_PT = "packages/knowledge/translations/pt/inline.json";
const LANGUES = ["fr", "es", "pt"];

const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const auCommit = (c) => execFileSync("git", ["show", `${MESURE_BASE_SHA}:${c}`],
  { maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });

const CONTRE = (process.argv.find((a) => a.startsWith("--contre-epreuve=")) ?? "").split("=")[1] ?? "";
let echecs = 0;
const exiger = (label, cond, detail = "") => {
  if (!cond) { echecs++; process.stdout.write(`    ✗ ${label}${detail ? ` — ${detail}` : ""}\n`); }
};

/* ---- LE PÉRIMÈTRE : TOUS les `.astro` de `src`, listés AU COMMIT DE BASE ----------------------
 * Listés au commit, pas sur le disque : un fichier ajouté depuis le sceau doit faire échouer la
 * mesure, jamais s'y glisser. */
const listerAuCommit = (dir) => {
  const out = [];
  for (const ligne of execFileSync("git", ["ls-tree", "-r", "--name-only", `${MESURE_BASE_SHA}:${dir}`],
    { encoding: "utf8" }).trim().split("\n")) if (ligne.endsWith(".astro")) out.push(`${dir}/${ligne}`);
  return out.sort();
};
const marcher = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) marcher(`${dir}/${e.name}`, out);
    else if (e.name.endsWith(".astro")) out.push(`${dir}/${e.name}`);
  }
  return out.sort();
};
const perimetre = listerAuCommit(SRC);
const surDisque = marcher(SRC);
if (perimetre.join("|") !== surDisque.join("|")) {
  process.stderr.write(`[t0b3h] ÉCHEC — l'arborescence de ${SRC} diffère de la base `
    + `${MESURE_BASE_SHA.slice(0, 7)} : ${perimetre.length} fichiers scellés, ${surDisque.length} sur le disque.\n`);
  process.exit(1);
}

const fichiers = new Map();
for (const chemin of perimetre) {
  const octets = readFileSync(chemin);
  if (sha256(octets) !== sha256(auCommit(chemin))) {
    process.stderr.write(`[t0b3h] ÉCHEC — ${chemin} diffère de la base.\n`); process.exit(1);
  }
  fichiers.set(chemin, octets.toString("utf8"));
}

/* Les tables, scellées elles aussi. */
const lireScelle = (chemin) => {
  const octets = readFileSync(chemin);
  if (sha256(octets) !== sha256(auCommit(chemin))) {
    process.stderr.write(`[t0b3h] ÉCHEC — ${chemin} diffère de la base.\n`); process.exit(1);
  }
  return JSON.parse(octets.toString("utf8"));
};
const TABLE = lireScelle(TABLE_PT);
const TABLES = Object.fromEntries(["en", ...LANGUES]
  .map((l) => [l, lireScelle(`packages/knowledge/translations/${l}/strings.json`)]));

/* ---- LA FAMILLE DE PAGES SERVIE PAR CHAQUE FICHIER --------------------------------------------
 * Une route porte la famille de son chemin. Un COMPOSANT n'a pas de famille propre : il hérite de
 * celles des routes qui l'atteignent, transitivement. S'il n'en sert qu'une, il compte pour elle —
 * sinon il est « partagé ». Rattacher d'autorité un composant à une famille fausserait le poids
 * relatif des familles, qui est justement ce que ce dossier cherche à établir. */
function familleDeRoute(chemin) {
  const m = /^packages\/ui\/src\/pages\/(.+)$/.exec(chemin);
  if (!m) return null;
  const reste = m[1].replace(/^\[\.\.\.loc\]\//, "");
  const premier = reste.split("/")[0];
  if (reste === "index.astro") return "accueil";
  if (premier.endsWith(".astro")) return "page isolée";
  return premier;
}
const importsAstro = (chemin, texte) =>
  [...texte.matchAll(/^import\s+(?:[\w{},*\s]+\s+from\s+)?["']([^"']+)["']/gm)]
    .map((m) => m[1]).filter((x) => x.endsWith(".astro") && x.startsWith("."))
    .map((x) => posix.normalize(posix.join(posix.dirname(chemin), x)));

const famillesDe = new Map([...fichiers.keys()].map((f) => [f, new Set()]));
for (const chemin of fichiers.keys()) {
  const fam = familleDeRoute(chemin);
  if (!fam) continue;
  const vus = new Set();
  const pile = [chemin];
  while (pile.length) {
    const c = pile.pop();
    if (vus.has(c) || !fichiers.has(c)) continue;
    vus.add(c);
    famillesDe.get(c).add(fam);
    pile.push(...importsAstro(c, fichiers.get(c)));
  }
}
/** La famille imputable à un fichier : la sienne s'il n'en sert qu'une, « partagé » sinon. */
function familleDe(chemin) {
  const f = famillesDe.get(chemin) ?? new Set();
  if (f.size === 1) return [...f][0];
  if (f.size === 0) return "jamais atteint";
  return "partagé";
}

/* ---- L'ANALYSEUR ------------------------------------------------------------------------------
 * Un scanner à parenthèses équilibrées, conscient des trois formes de littéral et de leurs
 * échappements. Une expression régulière ne suffirait pas : les phrases contiennent des
 * parenthèses, des apostrophes et des virgules. */
function argumentsDe(texte, debut) {
  const args = [];
  let profondeur = 0, courant = "", litteral = null;
  for (let i = debut; i < texte.length; i++) {
    const c = texte[i];
    if (litteral) {
      courant += c;
      if (c === "\\") { courant += texte[++i] ?? ""; continue; }
      if (c === litteral) litteral = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { litteral = c; courant += c; continue; }
    if (c === "(" || c === "[" || c === "{") { profondeur++; if (profondeur > 1) courant += c; continue; }
    if (c === ")" || c === "]" || c === "}") {
      profondeur--;
      if (profondeur === 0) { args.push(courant); return args.map((a) => a.trim()); }
      courant += c; continue;
    }
    if (c === "," && profondeur === 1) { args.push(courant); courant = ""; continue; }
    courant += c;
  }
  return null;
}

/** Un argument est-il un littéral de chaîne SIMPLE, et lequel ? Sinon : indécidable, jamais blanchi. */
function litteral(arg) {
  const q = arg[0];
  if (q !== '"' && q !== "'") return null;
  if (arg[arg.length - 1] !== q) return null;
  let out = "";
  for (let i = 1; i < arg.length - 1; i++) {
    const c = arg[i];
    if (c === "\\") { const n = arg[++i]; out += n === "n" ? "\n" : n === "t" ? "\t" : n; continue; }
    if (c === q) return null;
    out += c;
  }
  return out;
}

const ETATS = ["servi", "es-anglais", "pt-anglais", "es-et-pt-anglais", "cle-non-litterale", "illisible"];
const sites = [];
let occurrencesTexte = 0;
const sansAlias = [];

for (const [chemin, texte] of fichiers) {
  /* LES ALIAS SONT DÉCOUVERTS, JAMAIS SUPPOSÉS : un fichier qui nommerait `Tr` sa fonction de
     traduction disparaîtrait d'un scanner câblé sur `T` et `L`. */
  const alias = new Map();
  for (const m of texte.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(inlineT|inlineF)\s*\(/g)) alias.set(m[1], m[2]);
  const appelle = /\binline[TF]\s*\(/.test(texte);
  if (appelle && alias.size === 0) sansAlias.push(chemin);
  if (alias.size === 0) continue;
  const motif = new RegExp(`\\b(${[...alias.keys()].join("|")})\\(`, "g");
  for (const m of texte.matchAll(motif)) {
    occurrencesTexte++;
    if (CONTRE === "residu" && occurrencesTexte === 5) continue;
    const args = argumentsDe(texte, m.index + m[0].length - 1);
    const ligne = texte.slice(0, m.index).split("\n").length;
    const commun = { chemin, famille: familleDe(chemin), ligne, mecanisme: alias.get(m[1]) };
    if (!args) { sites.push({ ...commun, etat: "illisible", cle: null }); continue; }
    const cle = litteral(args[0] ?? "");
    if (cle === null) { sites.push({ ...commun, etat: "cle-non-litterale", cle: null }); continue; }
    const esAnglais = args.length < 3;
    const ptAnglais = !Object.prototype.hasOwnProperty.call(TABLE, cle);
    const etat = esAnglais && ptAnglais ? "es-et-pt-anglais"
      : esAnglais ? "es-anglais" : ptAnglais ? "pt-anglais" : "servi";
    sites.push({ ...commun, args: args.length, etat, cle,
      esIdentique: !esAnglais && litteral(args[2] ?? "") === cle, ptIdentique: !ptAnglais && TABLE[cle] === cle });
  }
}

/* Les contre-épreuves n'agissent qu'APRÈS le scellement, et seulement en mémoire. Chacune est
 * chirurgicale : elle déplace un seul site, pour ne faire tomber que l'exigence visée. */
if (CONTRE === "es" || CONTRE === "pt") {
  const s = sites.find((x) => x.etat === "pt-anglais");
  if (!s) { process.stderr.write(`[t0b3h] contre-épreuve \`${CONTRE}\` MUETTE : aucun site à déplacer.\n`); process.exit(2); }
  s.etat = CONTRE === "es" ? "es-et-pt-anglais" : "servi";
}

/* ---- LES CLÉS `t(locale, …)` ------------------------------------------------------------------ */
const clefs = [];
let occurrencesClefs = 0;
for (const [chemin, texte] of fichiers) {
  for (const m of texte.matchAll(/\bt\(\s*locale\s*,/g)) {
    occurrencesClefs++;
    const args = argumentsDe(texte, m.index + m[0].indexOf("("));
    const ligne = texte.slice(0, m.index).split("\n").length;
    const cle = args ? litteral(args[1] ?? "") : null;
    /* UNE CLÉ CONSTRUITE DYNAMIQUEMENT N'EST PAS UNE CLÉ MANQUANTE. Les confondre produirait une
       accusation fausse : ce dossier ne peut simplement pas se prononcer sur elles, et il les
       NOMME plutôt que de les ranger avec les autres. */
    if (cle === null) { clefs.push({ chemin, famille: familleDe(chemin), ligne, cle: null,
      manquantes: null, etat: "cle-non-litterale" }); continue; }
    let manquantes = LANGUES.filter((l) => !Object.prototype.hasOwnProperty.call(TABLES[l], cle));
    if (CONTRE === "clef" && !clefs.some((c) => c.etat === "incomplete")) manquantes = ["es"];
    clefs.push({ chemin, famille: familleDe(chemin), ligne, cle, manquantes,
      etat: manquantes.length ? "incomplete" : "servie" });
  }
}

/* ---- LES CONSTATS, QUI SONT DES EXIGENCES ----------------------------------------------------- */
const compte = Object.fromEntries(ETATS.map((e) => [e, sites.filter((s) => s.etat === e).length]));
const es = compte["es-anglais"] + compte["es-et-pt-anglais"];
const pt = compte["pt-anglais"] + compte["es-et-pt-anglais"];
const clefsIncompletes = clefs.filter((c) => c.etat === "incomplete");
const clefsDynamiques = clefs.filter((c) => c.etat === "cle-non-litterale");

process.stdout.write(`\n  T0-B3-h — ce que le site dit en portugais (base ${MESURE_BASE_SHA.slice(0, 7)})\n\n`);
process.stdout.write(`  périmètre : ${fichiers.size} fichiers .astro scellés\n`);
process.stdout.write(`  sites d'appel : ${sites.length} analysés, ${occurrencesTexte} repérés\n`);
process.stdout.write(`  ${es} servent l'anglais en espagnol · ${pt} servent l'anglais en portugais · ${compte.servi} servis\n`);
process.stdout.write(`  clés \`t(locale, …)\` : ${clefs.length} sites, `
  + `${new Set(clefs.filter((c) => c.cle).map((c) => c.cle)).size} clés littérales distinctes, `
  + `${clefsIncompletes.length} incomplète(s), ${clefsDynamiques.length} construite(s) dynamiquement\n`);

exiger("chaque occurrence repérée dans le texte est classée dans exactement un état",
  sites.length === occurrencesTexte,
  `${occurrencesTexte} repérées · ${sites.length} classées — ${occurrencesTexte - sites.length} perdue(s)`);
exiger("aucun site d'appel n'est illisible, aucune clé non littérale",
  compte.illisible === 0 && compte["cle-non-litterale"] === 0,
  `${compte.illisible} illisible(s) · ${compte["cle-non-litterale"]} non littérale(s)`);
exiger("tout fichier qui appelle `inlineT`/`inlineF` en déclare l'alias (sinon il échapperait au lecteur)",
  sansAlias.length === 0, sansAlias.join(", "));
exiger("chaque appel `t(locale, clé)` du périmètre est lu et classé",
  clefs.length === occurrencesClefs, `${occurrencesClefs} repérés · ${clefs.length} classés`);
exiger("les trois états des clés couvrent tout : leur somme égale le nombre d'appels",
  clefs.filter((c) => c.etat === "servie").length + clefsIncompletes.length + clefsDynamiques.length === clefs.length);

/* CES CONSTATS SONT DES EXIGENCES : un chiffre seulement imprimé se dégrade sans que rien ne rougisse. */
exiger("aucun site du site entier ne sert l'anglais en espagnol", es === 0, `${es} site(s)`);
/* 49 → 47 le 20/08/2026 : « updated » et « In short » ont été traduites sur arbitrage. Le chiffre
   figé BOUGE avec la base, il n'est jamais recopié — c'est tout l'intérêt de le figer. */
exiger("l'inventaire portugais est celui du sceau : 840 servis, 47 sur l'anglais",
  compte.servi === 840 && pt === 47, `${compte.servi} servis · ${pt} sur l'anglais`);
exiger("aucune clé littérale de `t()` n'est incomplète dans les trois langues",
  clefsIncompletes.length === 0,
  clefsIncompletes.slice(0, 6).map((c) => `${c.cle} (${c.manquantes.join(",")})`).join(" · "));
exiger("les 9 clés construites dynamiquement sont celles du sceau — elles ne sont ni blanchies ni accusées",
  clefsDynamiques.length === 9, `${clefsDynamiques.length} : `
  + clefsDynamiques.map((c) => `${c.chemin.split("/").pop()}:${c.ligne}`).join(", "));

/* ---- L'ARTEFACT -------------------------------------------------------------------------------- */
const familles = {};
for (const s of sites) {
  const f = (familles[s.famille] ??= Object.fromEntries(ETATS.map((e) => [e, 0])));
  f[s.etat]++;
}
const artefact = {
  base: MESURE_BASE_SHA,
  perimetre: { fichiers: [...fichiers.keys()] },
  langue: { total: sites.length, occurrencesTexte, compte, familles, sites },
  identiques: { es: sites.filter((s) => s.esIdentique).length, pt: sites.filter((s) => s.ptIdentique).length },
  clefs: { total: clefs.length, incompletes: clefsIncompletes, dynamiques: clefsDynamiques, sites: clefs },
};
if (!CONTRE) writeFileSync(`${DOSSIER}/ce-que-le-site-dit-en-portugais.json`, JSON.stringify(artefact, null, 2) + "\n");

process.stdout.write("\n  par famille de pages (anglais servi en portugais / total)\n");
for (const [f, c] of Object.entries(familles).sort((a, b) =>
  (b[1]["pt-anglais"] + b[1]["es-et-pt-anglais"]) - (a[1]["pt-anglais"] + a[1]["es-et-pt-anglais"]))) {
  const n = c["pt-anglais"] + c["es-et-pt-anglais"];
  const tot = ETATS.reduce((s, e) => s + c[e], 0);
  process.stdout.write(`    ${f.padEnd(14)} ${String(n).padStart(4)} / ${tot}\n`);
}
process.stdout.write("\n");

if (echecs) { process.stderr.write(`[t0b3h] ÉCHEC — ${echecs} exigence(s) non tenue(s).\n`); process.exit(1); }
process.stdout.write("[t0b3h] toutes les exigences tenues.\n");
