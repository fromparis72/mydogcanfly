#!/usr/bin/env node
/**
 * L'INVENTAIRE DU VOCABULAIRE IATA — UN SEUL RELEVÉ, QUI FAIT FOI. Version 2.
 *
 *   node inventaire-iata.mjs              le tableau de synthèse
 *   node inventaire-iata.mjs --json       le relevé complet, une ligne par occurrence
 *   node inventaire-iata.mjs --cat=<c>    les occurrences d'une seule catégorie
 *
 * POURQUOI CE FICHIER EXISTE. J'ai annoncé « 270 occurrences dans 41 fichiers », puis « environ
 * 340 dans 71 ». Les deux relevés étaient bricolés à la main, avec des motifs et des périmètres
 * différents, et aucun n'était rejouable. Un chiffre qu'on ne peut pas rejouer n'est pas une
 * mesure.
 *
 * CE QUE LA V1 FAISAIT ENCORE MAL, et qui est fermé ici (contre-revue du 30/08/2026) :
 *
 *   1. Elle classait `content/hub/drafts/airline_guide` — 349 occurrences dans 132 fichiers —
 *      comme héritage inerte, alors que `gen-wave1-guides.mjs` le LIT. Une régénération les
 *      ramènerait dans le site. L'inertie n'est plus déclarée : elle est PROUVÉE, répertoire par
 *      répertoire, contre les entrées réellement citées par les scripts du dépôt.
 *   2. Elle décidait PAR LIGNE. Sur « IATA LAR ; IATA-approved crate », les deux occurrences
 *      recevaient la même catégorie — mesuré : « interdit » pour les deux, donc la référence
 *      légitime disparaissait. Même défaut sur `citation_attribuee` : un `"quote":` n'importe où
 *      sur la ligne absorbait une occurrence extérieure à la citation. La décision porte
 *      désormais sur L'OCCURRENCE et sa position ; la ligne n'est plus que du contexte.
 *   3. Son contrôle « aucune occurrence non classée » était tautologique : `classer()` se
 *      terminait par `return "reference_reglementaire_legitime"`, si bien qu'une forme inconnue
 *      était automatiquement bénie légitime. Le repli est supprimé ; une occurrence que nulle
 *      règle ne reconnaît rend `null` et FAIT ÉCHOUER le relevé, en nommant fichier, ligne,
 *      colonne et texte.
 *   4. `readdirSync()` n'est pas trié par contrat. L'énumération et le relevé final le sont
 *      maintenant, et une contre-épreuve rejoue tout avec un ordre d'énumération inversé.
 *
 * L'ORDRE DES CATÉGORIES EST LE CONTRAT — le changer change les agrégats, et doit donc être un
 * mouvement nommé. Il a changé en v2, et voici pourquoi : les trois premières disent « il n'y a
 * RIEN à corriger » (un identifiant d'URL, une citation reproduite, une référence licite) ; les
 * suivantes ne contiennent QUE des affirmations interdites et disent QUI les corrige. En v1
 * l'ordre était inverse, si bien qu'une référence licite vivant dans un artefact généré était
 * comptée « artefact généré » — donc rangée parmi les choses à traiter alors qu'elle est juste.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";

const RACINE = process.cwd();

/* ---- LE MOTIF, UNIQUE ---------------------------------------------------------------------
   Il attrape tout le champ lexical, licite comme illicite : c'est la CLASSIFICATION qui
   tranche ensuite, jamais le motif. Un motif qui trierait déjà rendrait la catégorie
   « référence légitime » invisible, donc incomptable. */
/* LES TERMINAISONS ACCENTUÉES. Faute trouvée par la contre-épreuve 4 : `\\w*` ne contient PAS les
   lettres accentuées en JavaScript, si bien que « certifiée IATA » et « approuvée par l'IATA »
   n'étaient jamais vues — deux formes françaises entières manquaient au relevé. */
const SUITE = "[\\wÀ-ÿ]*";
export const ALTERNATIVES = [
  "IATA[- ]?(?:approved|compliant|certified|accredited)",
  "IATA[- ]?(?:LAR|formula|method|requirements?|standards?|guidelines?)",
  "Live Animals Regulations",
  `homologu${SUITE}`, `homologad${SUITE}`, `homologa${SUITE}`,
  "conforme[s]?\\s+(?:à\\s+la\\s+norme\\s+)?IATA",
  "conforme[s]?\\s+(?:a|à)\\s+la\\s+IATA",
  "conforme[s]?\\s+(?:à|a)\\s+(?:la\\s+)?norma\\s+IATA",
  "norma\\s+IATA", "normes?\\s+IATA", "exigences\\s+IATA",
  `certifi${SUITE}\\s+IATA`,
  `approuv${SUITE}\\s+par\\s+(?:l')?IATA`,
  `aprobad${SUITE}\\s+por\\s+la\\s+IATA`,
  `aprovad${SUITE}\\s+pela\\s+IATA`,
];
export const MOTIF = new RegExp(ALTERNATIVES.join("|"), "gi");

/* ---- LES DEUX JUGEMENTS, PORTÉS SUR LE TEXTE TROUVÉ SEUL -----------------------------------
   Pas sur la ligne : c'est toute la correction du P0-2. Chacun ne voit que l'occurrence. */
const OCC_LEGITIME = /^(?:Live Animals Regulations|IATA[- ]?(?:LAR|formula|method|requirements?|standards?|guidelines?)|normes?\s+IATA|exigences\s+IATA)$/i;
const OCC_INTERDITE = /^(?:IATA[- ]?(?:approved|compliant|certified|accredited)|homologu[\wÀ-ÿ]*|homologad[\wÀ-ÿ]*|homologa[\wÀ-ÿ]*|conforme[s]?\s+(?:à\s+la\s+norme\s+)?IATA|conforme[s]?\s+(?:a|à)\s+la\s+IATA|conforme[s]?\s+(?:à|a)\s+(?:la\s+)?norma\s+IATA|norma\s+IATA|certifi[\wÀ-ÿ]*\s+IATA|approuv[\wÀ-ÿ]*\s+par\s+(?:l')?IATA|aprobad[\wÀ-ÿ]*\s+por\s+la\s+IATA|aprovad[\wÀ-ÿ]*\s+pela\s+IATA)$/i;

/* Les quatre slugs que l'arbitrage conserve : identifiants historiques stables, jamais du
   contenu éditorial à reproduire dans un titre ou un texte. */
const SLUGS_CONSERVES = [
  "airline-approved-dog-crate",
  "caisse-transport-avion-homologuee-chien",
  "transportin-homologado-iata-perro",
  "caixa-de-transporte-homologada-iata",
];

const APPLICATIF = [
  /^packages\/knowledge\/translations\//,
  /^packages\/ui\/src\/components\//,
  /^packages\/ui\/src\/pages\//,
  /^packages\/ui\/src\/lib\//,
  /^packages\/engine\/src\//,
  /^packages\/workers\//,
];
const GENERES = [/^packages\/knowledge\/raw\/guides\.json$/, /\.generated\.json$/, /^packages\/ui\/\.astro\//];
const TESTS = [/^test-/, /^mesures\//, /^test-baselines\//, /^test-lib\//, /^DOSSIER-/, /^docs\//, /^ADR/, /\.test\.[tj]s$/];

/* Les répertoires DÉCLARÉS inertes. La déclaration ne suffit pas : `prouverInertie()` exige que
   plus bas aucun script du dépôt ne les cite. */
const INERTES_DECLARES = ["static/", "layouts/", "deploy/", "themes/", "SLUG-MAP.md"];
/* Les répertoires qui alimentent un générateur — leur contenu peut revenir dans le site. */
const GENERATRICES_DECLAREES = ["content/"];

export const CATEGORIES = [
  /* — rien à corriger — */
  "slug_conserve",
  "citation_attribuee",
  "reference_reglementaire_legitime",
  /* — une affirmation interdite ; la catégorie dit QUI la corrige — */
  "test_commentaire_historique",
  "artefact_genere",
  "source_generatrice_active",
  "heritage_v1_non_publie",
  "affirmation_publique_interdite",
  "source_editoriale",
];

/** Les portées d'une citation attribuée DANS une ligne : `"quote": "…"`, `citation: '…'`. */
function portéesDeCitation(ligne) {
  const out = [];
  const re = /(?:"quote"|"citation"|quote|citation)\s*:\s*(["'`])/g;
  let m;
  while ((m = re.exec(ligne))) {
    const guillemet = m[1];
    let i = m.index + m[0].length;
    while (i < ligne.length) {
      if (ligne[i] === "\\") { i += 2; continue; }
      if (ligne[i] === guillemet) break;
      i++;
    }
    out.push([m.index + m[0].length, i]);
  }
  return out;
}

/**
 * La catégorie d'UNE occurrence. `ligne` n'est que du contexte ; la décision porte sur `trouve`
 * et sur sa position [debut, fin). Rend `null` quand aucune règle ne reconnaît l'occurrence —
 * jamais un repli complaisant.
 */
export function classer(chemin, ligne, trouve, debut, fin) {
  /* 1 — L'occurrence EST à l'intérieur d'un slug conservé : un identifiant, pas une phrase. */
  for (const sl of SLUGS_CONSERVES) {
    let i = ligne.indexOf(sl);
    while (i !== -1) {
      if (debut >= i && fin <= i + sl.length) return "slug_conserve";
      i = ligne.indexOf(sl, i + 1);
    }
  }
  /* 2 — L'occurrence est À L'INTÉRIEUR d'une citation attribuée : on ne réécrit pas une source. */
  for (const [a, b] of portéesDeCitation(ligne)) if (debut >= a && fin <= b) return "citation_attribuee";

  /* 3 — L'occurrence elle-même est une référence licite : le règlement, la méthode de mesure,
     les exigences de contenant. Rien à corriger, où qu'elle vive. */
  if (OCC_LEGITIME.test(trouve)) return "reference_reglementaire_legitime";

  /* À partir d'ici, l'occurrence DOIT être une affirmation interdite. Sinon on ne sait pas ce
     que c'est, et on le dit. */
  if (!OCC_INTERDITE.test(trouve)) return null;

  if (TESTS.some((r) => r.test(chemin))) return "test_commentaire_historique";
  if (GENERES.some((r) => r.test(chemin))) return "artefact_genere";
  if (GENERATRICES_DECLAREES.some((p) => chemin.startsWith(p))) return "source_generatrice_active";
  if (INERTES_DECLARES.some((p) => chemin === p || chemin.startsWith(p))) return "heritage_v1_non_publie";
  if (APPLICATIF.some((r) => r.test(chemin))) return "affirmation_publique_interdite";
  return "source_editoriale";
}

/* ---- LA PREUVE D'INERTIE -------------------------------------------------------------------
   Un répertoire n'est inerte que si AUCUN script du dépôt ne le cite en entrée. Déclarer sans
   prouver est exactement la faute que la contre-revue a trouvée. */
export function prouverInertie() {
  const scripts = [];
  const chercher = (d) => {
    if (!existsSync(d)) return;
    for (const e of [...readdirSync(d)].sort()) {
      const p = join(d, e);
      const st = statSync(p);
      if (st.isDirectory()) { if (!["node_modules", ".git", "dist"].includes(e)) chercher(p); }
      else if ([".mjs", ".ts", ".js", ".cjs", ".json"].includes(extname(e)) && e !== "package-lock.json") scripts.push(p);
    }
  };
  chercher(join(RACINE, "packages"));
  for (const e of [...readdirSync(RACINE)].sort()) {
    if ([".mjs", ".cjs", ".js"].includes(extname(e))) scripts.push(join(RACINE, e));
  }
  /* DEUX FAUTES DE CETTE GARDE, NOMMÉES. La première rédaction acceptait la cible NUE entre
     guillemets : elle rougissait sur `output: "static"` — une valeur de configuration Astro —
     et sur `"deploy"`, un nom de script npm. Ni l'un ni l'autre n'est un chemin. La barre
     oblique est désormais obligatoire. La seconde confondait un GÉNÉRATEUR et un HARNAIS :
     `test-cloture-outil-chaleur.mjs` cite `static/tools/…` précisément pour prouver que cet
     outil v1 n'est PAS publié. Constater n'est pas alimenter ; les harnais sont rapportés à
     part, et ne font pas échouer le relevé. */
  const violations = [], constats = [];
  for (const prefixe of INERTES_DECLARES) {
    const cible = prefixe.replace(/\/$/, "");
    for (const s of scripts) {
      const rel = relative(RACINE, s);
      if (rel.startsWith("inventaire-iata") || rel.startsWith("test-inventaire-iata")) continue;
      let c;
      try { c = readFileSync(s, "utf8"); } catch { continue; }
      if (!new RegExp(`["'\`]${cible}/`).test(c)) continue;
      const estHarnais = /(^|\/)test-|(^|\/)mesures\//.test(rel);
      (estHarnais ? constats : violations).push({ prefixe, lu_par: rel });
    }
  }
  return { violations, constats };
}

/* ---- LE PARCOURS, DÉTERMINISTE ------------------------------------------------------------- */
const IGNORE = new Set(["node_modules", ".git", "dist", ".astro", "coverage", ".wrangler"]);
/* L'outil et son harnais citent tout le champ lexical pour le définir et l'éprouver : les
   compter reviendrait à mesurer sa propre règle. Ils sortent du périmètre, et on le nomme. */
const FICHIERS_IGNORES = new Set(["package-lock.json", "inventaire-iata.mjs", "test-inventaire-iata.mjs"]);
const EXT_TEXTE = new Set([".json", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".astro", ".md", ".mdx", ".yml", ".yaml", ".html", ".txt", ""]);

export function* parcourir(dir, inverse = false) {
  let entrees;
  try { entrees = [...readdirSync(dir)].sort(); } catch { return; }
  if (inverse) entrees.reverse();          // pour la contre-épreuve de déterminisme
  for (const e of entrees) {
    if (IGNORE.has(e)) continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) yield* parcourir(p, inverse);
    else if (!FICHIERS_IGNORES.has(e) && EXT_TEXTE.has(extname(e))) yield p;
  }
}

/** Le relevé complet, TRIÉ — l'ordre ne dépend d'aucun système de fichiers. */
export function relever({ inverse = false, racine = RACINE } = {}) {
  const out = [];
  for (const p of parcourir(racine, inverse)) {
    const chemin = relative(racine, p);
    let contenu;
    try { contenu = readFileSync(p, "utf8"); } catch { continue; }
    if (!/IATA|homolog/i.test(contenu)) continue;
    const lignes = contenu.split("\n");
    for (let i = 0; i < lignes.length; i++) {
      MOTIF.lastIndex = 0;
      for (const m of lignes[i].matchAll(MOTIF)) {
        out.push({
          fichier: chemin, ligne: i + 1, colonne: m.index + 1, trouve: m[0],
          categorie: classer(chemin, lignes[i], m[0], m.index, m.index + m[0].length),
        });
      }
    }
  }
  return out.sort((a, b) =>
    a.fichier.localeCompare(b.fichier) || a.ligne - b.ligne || a.colonne - b.colonne || a.trouve.localeCompare(b.trouve));
}

/**
 * Ce qui fait ÉCHOUER un relevé. Extraite pour être éprouvée : la CLI l'appelle, le harnais
 * aussi, avec un relevé délibérément corrompu.
 */
export function verifier(releve) {
  const { violations } = prouverInertie();
  const inconnues = releve.filter((r) => r.categorie === null || r.categorie === undefined);
  const hors = releve.filter((r) => r.categorie != null && !CATEGORIES.includes(r.categorie));
  return { violations, inconnues, hors, ok: violations.length === 0 && inconnues.length === 0 && hors.length === 0 };
}

/* ---- SORTIE -------------------------------------------------------------------------------- */
if (import.meta.url === `file://${process.argv[1]}`) {
  const ARGS = process.argv.slice(2);
  const releve = relever();

  const { constats } = prouverInertie();
  const v = verifier(releve);
  if (!v.ok) {
    console.error("RELEVÉ REFUSÉ.");
    for (const x of v.violations) console.error(`  répertoire déclaré inerte lu par un générateur actif : ${x.prefixe} ← ${x.lu_par}`);
    for (const r of v.inconnues.slice(0, 20)) console.error(`  occurrence qu'aucune règle ne reconnaît : ${r.fichier}:${r.ligne}:${r.colonne}  « ${r.trouve} »`);
    for (const r of v.hors.slice(0, 20)) console.error(`  catégorie hors liste : ${r.fichier}:${r.ligne}:${r.colonne}  « ${r.categorie} »`);
    process.exit(1);
  }

  if (ARGS.includes("--json")) { process.stdout.write(JSON.stringify(releve, null, 1)); process.exit(0); }
  const filtre = ARGS.find((a) => a.startsWith("--cat="))?.slice(6);
  if (filtre) {
    const sel = releve.filter((r) => r.categorie === filtre);
    for (const r of sel) console.log(`${r.fichier}:${r.ligne}:${r.colonne}  « ${r.trouve} »`);
    console.log(`\n${sel.length} occurrence(s) en « ${filtre} », dans ${new Set(sel.map((r) => r.fichier)).size} fichier(s)`);
    process.exit(0);
  }

  console.log(`INVENTAIRE DU VOCABULAIRE IATA — ${releve.length} occurrences, ${new Set(releve.map((r) => r.fichier)).size} fichiers\n`);
  console.log("  — rien à corriger —");
  for (const c of CATEGORIES) {
    if (c === "test_commentaire_historique") console.log("  — une affirmation interdite ; la catégorie dit qui la corrige —");
    const sel = releve.filter((r) => r.categorie === c);
    console.log(`${String(sel.length).padStart(5)}  ${c.padEnd(34)} ${String(new Set(sel.map((r) => r.fichier)).size).padStart(3)} fichier(s)`);
  }
  console.log(`${String(releve.length).padStart(5)}  ${"TOTAL".padEnd(34)}`);
  if (constats.length) {
    console.log("\n— répertoires inertes cités par un HARNAIS (constat, pas une entrée de générateur) —");
    for (const c of constats) console.log(`       ${c.prefixe} cité par ${c.lu_par}`);
  }

  for (const [titre, cat] of [["ÉTAPE 3 (applicatif)", "affirmation_publique_interdite"],
                              ["MICRO-LOT ÉDITORIAL — sources", "source_editoriale"],
                              ["MICRO-LOT ÉDITORIAL — sources génératrices", "source_generatrice_active"]]) {
    const par = releve.filter((r) => r.categorie === cat)
      .reduce((a, r) => ((a[r.fichier] = (a[r.fichier] || 0) + 1), a), {});
    const n = Object.values(par).reduce((a, b) => a + b, 0);
    console.log(`\n— ${titre} : ${n} occurrence(s), ${Object.keys(par).length} fichier(s) —`);
    for (const [f, k] of Object.entries(par).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`${String(k).padStart(5)}  ${f}`);
  }
}
