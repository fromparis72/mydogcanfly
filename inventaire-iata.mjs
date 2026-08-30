#!/usr/bin/env node
/**
 * L'INVENTAIRE DU VOCABULAIRE IATA — UN SEUL RELEVÉ, QUI FAIT FOI.
 *
 *   node inventaire-iata.mjs              le tableau de synthèse
 *   node inventaire-iata.mjs --json       le relevé complet, une ligne par occurrence
 *   node inventaire-iata.mjs --cat=<c>    les occurrences d'une seule catégorie
 *
 * POURQUOI CE FICHIER EXISTE. J'ai annoncé « 270 occurrences dans 41 fichiers », puis
 * « environ 340 dans 71 fichiers ». Les deux relevés étaient bricolés à la main, avec des motifs
 * et des périmètres différents, et aucun n'était rejouable. Un chiffre qu'on ne peut pas rejouer
 * n'est pas une mesure. Ici : UN motif, UN périmètre, UNE classification, et chaque occurrence
 * porte son fichier, sa ligne et sa catégorie.
 *
 * LES CATÉGORIES SONT MUTUELLEMENT EXCLUSIVES, appliquées dans l'ordre de la liste ci-dessous :
 * la première qui reconnaît l'occurrence la prend. Cet ordre est le contrat ; le changer change
 * les chiffres, et doit donc être un mouvement nommé.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const RACINE = process.cwd();
const ARGS = process.argv.slice(2);
const JSON_SEUL = ARGS.includes("--json");
const FILTRE = ARGS.find((a) => a.startsWith("--cat="))?.slice(6);

/* LE MOTIF, UNIQUE. Il attrape tout le champ lexical, licite comme illicite : c'est la
   CLASSIFICATION qui tranche ensuite, jamais le motif. Un motif qui trierait déjà rendrait la
   catégorie « référence légitime » invisible, donc incomptable. */
const MOTIF = /IATA[- ]?(?:approved|compliant|certified|accredited)|IATA[- ]?(?:LAR|formula|method|requirements?|standards?|guidelines?)|Live Animals Regulations|homologu\w*|homologad\w*|homologa\w*|conforme[s]?\s+(?:à\s+la\s+norme\s+)?IATA|conforme[s]?\s+a\s+la\s+IATA|conforme[s]?\s+(?:à|a)\s+(?:la\s+)?norma\s+IATA|norma\s+IATA|normes?\s+IATA|exigences\s+IATA|certifi\w*\s+IATA|approuv\w*\s+par\s+(?:l')?IATA|aprobad\w*\s+por\s+la\s+IATA|aprovad\w*\s+pela\s+IATA/gi;

/* Ce qu'on ne parcourt pas : rien d'utile, et des millions de lignes. */
const IGNORE = new Set(["node_modules", ".git", "dist", ".astro", "coverage", ".wrangler"]);
const FICHIERS_IGNORES = new Set(["package-lock.json", "inventaire-iata.mjs"]);
const EXT_TEXTE = new Set([".json", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".astro", ".md", ".mdx", ".yml", ".yaml", ".html", ".txt", ""]);

/* LES QUATRE SLUGS QUE L'ARBITRAGE CONSERVE — identifiants historiques stables, jamais du
   contenu éditorial à reproduire dans un titre ou un texte. */
const SLUGS_CONSERVES = [
  "airline-approved-dog-crate",
  "caisse-transport-avion-homologuee-chien",
  "transportin-homologado-iata-perro",
  "caixa-de-transporte-homologada-iata",
];

/* Les surfaces APPLICATIVES : ce que corrige l'étape 3. Tout le reste du contenu éditorial part
   au micro-lot éditorial. */
const APPLICATIF = [
  /^packages\/knowledge\/translations\//,
  /^packages\/ui\/src\/components\//,
  /^packages\/ui\/src\/pages\//,
  /^packages\/ui\/src\/lib\//,
  /^packages\/engine\/src\//,
  /^packages\/workers\//,
];

const GENERES = [
  /^packages\/knowledge\/raw\/guides\.json$/,
  /\.generated\.json$/,
  /^packages\/ui\/\.astro\//,
];

/* L'héritage v1 : le site Hugo d'avant, encore présent dans l'arbre, jamais construit par Astro
   et absent du dist. Il n'est publié nulle part — mais il EXISTE, et le taire fausserait le
   relevé. Catégorie à part, pour qu'on décide en connaissance de cause. */
const HERITAGE_V1 = [/^static\//, /^layouts\//, /^deploy\//, /^content\//, /^SLUG-MAP\.md$/, /^themes\//];

const TESTS = [/^test-/, /^mesures\//, /^test-baselines\//, /^test-lib\//, /^DOSSIER-/, /^docs\//, /^ADR/, /\.test\.[tj]s$/];

/* Ce que l'IATA publie réellement et qu'on a le droit de citer : le règlement, la formule de
   dimensionnement, les exigences de contenant. Jamais l'homologation d'un modèle. */
const LEGITIME = /Live Animals Regulations|IATA[- ]?LAR|IATA[- ]?(?:formula|method)|IATA[- ]?requirements?|exigences\s+IATA|IATA[- ]?(?:standards?|guidelines?)|normes?\s+IATA/i;

/* Le sous-ensemble strictement interdit : le site affirme lui-même une homologation. */
const INTERDIT = /IATA[- ]?(?:approved|compliant|certified|accredited)|homologu|homologad|homologa|conforme[s]?\s+(?:à\s+la\s+norme\s+)?IATA|conforme[s]?\s+a\s+la\s+IATA|conforme[s]?\s+(?:à|a)\s+(?:la\s+)?norma\s+IATA|norma\s+IATA|certifi\w*\s+IATA|approuv\w*\s+par|aprobad\w*\s+por|aprovad\w*\s+pela/i;

const CATEGORIES = [
  "slug_conserve",
  "test_commentaire_historique",
  "heritage_v1_non_publie",
  "artefact_genere",
  "citation_attribuee",
  "reference_reglementaire_legitime",
  "affirmation_publique_interdite",
  "source_editoriale",
];

function classer(chemin, texte, debut, fin) {
  /* 1 — LE SLUG. L'occurrence EST l'identifiant d'URL, conservé par arbitrage : ni une
     affirmation, ni un contenu à corriger.
     PREMIÈRE RÉDACTION FAUTIVE, NOMMÉE : elle classait « slug » toute ligne CONTENANT le slug,
     et avalait ainsi 224 occurrences dans 98 fichiers — dont des textes d'ancre bien visibles
     (« caisse homologuée » libellant un lien vers ce slug), qui sont exactement des
     affirmations à corriger. On exige désormais que le texte trouvé soit À L'INTÉRIEUR du slug,
     par position : le slug lui-même, jamais la phrase qui le pointe. */
  /* Le NOM du fichier ne classe rien : ce qu'il contient est du contenu, jugé comme tel. */
  for (const sl of SLUGS_CONSERVES) {
    let i = texte.indexOf(sl);
    while (i !== -1) {
      if (debut >= i && fin <= i + sl.length) return "slug_conserve";
      i = texte.indexOf(sl, i + 1);
    }
  }

  /* 2 — les harnais, dossiers, mesures et baselines : ils DÉCRIVENT le défaut, ils ne le
     publient pas. Les corriger effacerait la trace de ce qu'on a mesuré. */
  if (TESTS.some((r) => r.test(chemin))) return "test_commentaire_historique";

  /* 3 — l'héritage v1, présent dans l'arbre et construit par personne. */
  if (HERITAGE_V1.some((r) => r.test(chemin))) return "heritage_v1_non_publie";

  /* 4 — les artefacts générés : on ne les corrige JAMAIS directement, on régénère. */
  if (GENERES.some((r) => r.test(chemin))) return "artefact_genere";

  /* 5 — une citation attribuée reproduit la formulation d'une source identifiée : on ne la
     réécrit pas, on la garde ou on la retire. */
  if (/"quote"\s*:|quote:\s*["'`]|citation\s*:/.test(texte)) return "citation_attribuee";

  /* 6 — la référence réglementaire licite prime sur l'interdit : « IATA Live Animals
     Regulations » n'est pas une homologation, même dans une phrase qui en parle. */
  if (LEGITIME.test(texte) && !INTERDIT.test(texte)) return "reference_reglementaire_legitime";

  /* 7 et 8 — il reste une affirmation interdite. Sa catégorie dit QUEL LOT la corrige :
     applicatif (étape 3) ou éditorial (micro-lot distinct). */
  if (INTERDIT.test(texte)) {
    return APPLICATIF.some((r) => r.test(chemin)) ? "affirmation_publique_interdite" : "source_editoriale";
  }
  return "reference_reglementaire_legitime";
}

function* parcourir(dir) {
  for (const e of readdirSync(dir)) {
    if (IGNORE.has(e)) continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) yield* parcourir(p);
    else if (!FICHIERS_IGNORES.has(e) && EXT_TEXTE.has(extname(e))) yield p;
  }
}

const releve = [];
for (const p of parcourir(RACINE)) {
  const chemin = relative(RACINE, p);
  let contenu;
  try { contenu = readFileSync(p, "utf8"); } catch { continue; }
  if (!/IATA|homolog/i.test(contenu)) continue;
  const lignes = contenu.split("\n");
  for (let i = 0; i < lignes.length; i++) {
    MOTIF.lastIndex = 0;
    for (const m of lignes[i].matchAll(MOTIF)) {
      releve.push({
        fichier: chemin, ligne: i + 1, trouve: m[0],
        categorie: classer(chemin, lignes[i], m.index, m.index + m[0].length),
      });
    }
  }
}

if (JSON_SEUL) { process.stdout.write(JSON.stringify(releve, null, 1)); process.exit(0); }
if (FILTRE) {
  const sel = releve.filter((r) => r.categorie === FILTRE);
  for (const r of sel) console.log(`${r.fichier}:${r.ligne}  « ${r.trouve} »`);
  console.log(`\n${sel.length} occurrence(s) en « ${FILTRE} », dans ${new Set(sel.map((r) => r.fichier)).size} fichier(s)`);
  process.exit(0);
}

console.log(`INVENTAIRE DU VOCABULAIRE IATA — ${releve.length} occurrences, ${new Set(releve.map((r) => r.fichier)).size} fichiers\n`);
for (const c of CATEGORIES) {
  const sel = releve.filter((r) => r.categorie === c);
  const fichiers = new Set(sel.map((r) => r.fichier));
  console.log(`${String(sel.length).padStart(5)}  ${c.padEnd(34)} ${String(fichiers.size).padStart(3)} fichier(s)`);
}
const somme = CATEGORIES.reduce((n, c) => n + releve.filter((r) => r.categorie === c).length, 0);
console.log(`${String(somme).padStart(5)}  ${"TOTAL".padEnd(34)}`);
if (somme !== releve.length) { console.error("\nINCOHÉRENCE : des occurrences échappent aux catégories"); process.exit(1); }

console.log("\n— À CORRIGER DANS L'ÉTAPE 3 (applicatif) —");
for (const [f, n] of Object.entries(releve.filter((r) => r.categorie === "affirmation_publique_interdite")
  .reduce((a, r) => ((a[r.fichier] = (a[r.fichier] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1])) {
  console.log(`${String(n).padStart(5)}  ${f}`);
}
console.log("\n— À CORRIGER DANS LE MICRO-LOT ÉDITORIAL (sources) —");
const ed = releve.filter((r) => r.categorie === "source_editoriale")
  .reduce((a, r) => ((a[r.fichier] = (a[r.fichier] || 0) + 1), a), {});
console.log(`${Object.keys(ed).length} fichier(s) source, ${Object.values(ed).reduce((a, b) => a + b, 0)} occurrence(s)`);
for (const [f, n] of Object.entries(ed).sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`${String(n).padStart(5)}  ${f}`);
