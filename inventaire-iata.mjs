#!/usr/bin/env node
/**
 * L'INVENTAIRE DU VOCABULAIRE IATA — UN SEUL RELEVÉ, QUI FAIT FOI. Version 3.
 *
 *   node inventaire-iata.mjs              le tableau de synthèse
 *   node inventaire-iata.mjs --json       le relevé complet, une ligne par occurrence
 *   node inventaire-iata.mjs --cat=<c>    les occurrences d'une seule catégorie
 *
 * POURQUOI CE FICHIER EXISTE. J'ai annoncé « 270 occurrences dans 41 fichiers », puis « environ
 * 340 dans 71 ». Les deux relevés étaient bricolés à la main, avec des motifs et des périmètres
 * différents, et aucun n'était rejouable. Un chiffre qu'on ne peut pas rejouer n'est pas une
 * mesure. Cet instrument sert de CONTRAT à deux lots : il dit combien d'affirmations sont à
 * corriger, et qui les corrige.
 *
 * SON HISTOIRE, PARCE QU'ELLE EXPLIQUE SA FORME. Trois versions, chacune corrigeant une faute
 * que la précédente ne voyait pas.
 *
 *   V1 — classait par LIGNE, avec un repli complaisant, et déclarait l'héritage inerte sans rien
 *        vérifier.
 *
 *   V2 — a fermé trois de ces défauts.
 *        · La décision porte désormais sur L'OCCURRENCE et sa position ; la ligne n'est plus que
 *          du contexte, et la colonne est enregistrée. Sur « IATA LAR ; IATA-approved crate »,
 *          la v1 donnait « interdit » aux DEUX occurrences — la référence licite disparaissait
 *          du compte. Même défaut sur les citations : un `"quote":` n'importe où sur la ligne
 *          absorbait une occurrence extérieure à la citation.
 *        · Le repli final `return "reference_reglementaire_legitime"` est supprimé : il bénissait
 *          toute forme inconnue, si bien que le contrôle « aucune occurrence non classée » ne
 *          pouvait pas rougir. Une occurrence que nulle règle ne reconnaît rend `null` et FAIT
 *          ÉCHOUER le relevé, en nommant fichier, ligne, colonne et texte.
 *        · `readdirSync()` n'est pas trié par contrat : l'énumération et le relevé final le sont,
 *          et une contre-épreuve rejoue tout avec un ordre d'énumération inversé.
 *        Mais la v2 a cru pouvoir PROUVER l'inertie de l'héritage v1, en cherchant le chemin
 *        littéral `"static/…"` dans les scripts du dépôt. Cette preuve n'en était pas une : un
 *        générateur écrivant `join(ROOT, "static", f)` y échappait, et ajouter des motifs n'aurait
 *        fait que déplacer le trou. Aucune analyse textuelle ne démontre qu'aucun code ne
 *        construit un chemin dynamiquement.
 *
 *   V3 — RETIRE cette prétention plutôt que de la rafistoler. `heritage_v1_non_publie` devient
 *        `heritage_a_corriger_ou_supprimer` : ces 18 occurrences ne sont plus protégées par une
 *        preuve impossible, elles entrent au micro-lot éditorial, et leur suppression éventuelle
 *        sera une décision séparée et explicite. Ce qui cite ces répertoires reste rapporté, mais
 *        comme un CONSTAT indicatif qui ne conclut rien.
 *        La v3 ajoute aussi `reference_reglementaire_a_reformuler`, sans quoi deux modifications
 *        approuvées manquaient au contrat : « IATA standard » et « norme IATA » sont licites
 *        prises seules, « norma IATA » ne l'est pas, et les trois appartiennent au MÊME titre,
 *        remplacé en entier. L'ancre est un fragment de TEXTE, jamais un numéro de ligne — une
 *        ligne se déplace, un texte non — et une ancre qui ne trouve rien fait refuser le relevé.
 *
 * L'ORDRE DES CATÉGORIES EST LE CONTRAT — le changer change les agrégats, et doit donc être un
 * mouvement nommé. Il se lit en deux temps :
 *
 *   1. `slug_conserve` — l'occurrence EST un identifiant d'URL conservé par arbitrage. Rien à
 *      corriger : ce n'est pas une phrase, c'est une adresse.
 *   2. `citation_attribuee` — l'occurrence est À L'INTÉRIEUR d'une citation qui reproduit une
 *      source identifiée. On ne réécrit pas une source : on la garde ou on la retire.
 *   3. `reference_reglementaire_a_reformuler` — l'occurrence peut être licite prise seule, mais
 *      la PHRASE qui la porte est arbitrée à remplacer. Le contexte prime ici sur le mot, parce
 *      que c'est le titre entier qui change. À CORRIGER, dans l'étape 3.
 *   4. `reference_reglementaire_legitime` — le règlement, la méthode de mesure, les exigences de
 *      contenant réellement publiées. Rien à corriger, où que l'occurrence vive.
 *
 * À partir de là, l'occurrence EST une affirmation interdite, et sa catégorie ne dit plus quoi
 * mais QUI : un harnais qui décrit le défaut, un artefact à régénérer, une source qui alimente
 * un générateur, l'héritage v1, une surface applicative, ou un guide éditorial.
 *
 * En v1 cet ordre était inverse, si bien qu'une référence licite vivant dans un artefact généré
 * était comptée « artefact généré » — donc rangée parmi les choses à traiter alors qu'elle est
 * juste.
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

/* L'HÉRITAGE V1. La v2 prétendait PROUVER qu'il est inerte, en cherchant `"static/…"` dans les
   scripts. Cette preuve est impossible : un générateur écrivant `join(ROOT, "static", f)` ou
   `resolve(ROOT, "static", f)` y échapperait, et ajouter des motifs ne ferait que déplacer le
   trou — aucune analyse textuelle ne démontre qu'aucun code ne construit un chemin dynamiquement.
   La prétention est donc RETIRÉE. Ces répertoires ne sont plus « non publiés » : ils sont
   « à corriger ou à supprimer », et leurs 18 occurrences rejoignent le micro-lot éditorial. Leur
   suppression éventuelle sera une décision séparée et explicite, pas un effet de bord d'un
   classement. */
const HERITAGE_V1 = ["static/", "layouts/", "deploy/", "themes/", "SLUG-MAP.md"];

/* LES RÉFÉRENCES CONTEXTUELLEMENT À REFORMULER. Une occurrence peut être licite prise seule et
   devoir pourtant changer, parce que la PHRASE qui la porte présente l'IATA trop vaguement comme
   une « norme ». Le titre de section ci-dessous en est le cas arbitré : « IATA standard » et
   « norme IATA » sont licites à l'occurrence, « norma IATA » ne l'est pas, et les trois
   appartiennent au même titre — qui est remplacé en entier. Sans cette catégorie, deux des trois
   modifications approuvées manqueraient au contrat de l'étape 3.
   L'ancre est un fragment de texte, jamais un numéro de ligne : une ligne se déplace, un texte
   non. Une ancre qui ne trouve rien FAIT REFUSER le relevé — une déclaration qui ne s'applique
   pas est un mensonge, pas une exception. */
const A_REFORMULER = [
  { fichier: "packages/ui/src/components/AirlinePremiumPage.astro", ancre: "The hold crate (IATA standard)" },
];

/* UNE EXCEPTION DE COMMENTAIRE A EXISTÉ ICI, ET ELLE EST SUPPRIMÉE. Elle classait à part une
   occurrence vivant dans un commentaire de code — non publiée, donc ni une affirmation ni un
   travail à faire. Deux attaques de la contre-revue du 30/08/2026 l'ont mise à terre, toutes
   deux reproduites avant correction :

       const rendu = "/* <fragment> *\/";
       const rendu = `<p>/* <fragment> *\/</p>`;

   Les deux rendaient « zone valide, zéro problème » : une chaîne potentiellement RENDUE était
   classée « commentaire non publié ». Une regex ne distingue pas un commentaire d'une chaîne qui
   en contient les marqueurs ; seul un analyseur lexical le ferait.

   La preuve DOM censée rattraper cela ne s'exécutait JAMAIS : ce harnais tourne dans `test:unit`,
   avant tout build, si bien que `dist` était toujours absent et le contrôle toujours sauté. Ma
   phrase « en CI, il en existe toujours un » était fausse — vérifié : `test-inventaire-iata.mjs`
   n'apparaît nulle part dans `.github/workflows/ci.yml`.

   Plutôt que d'écrire un analyseur lexical pour UNE occurrence non publiée, la ligne interne de
   `FlightFinder.astro` a été reformulée : elle dit la même chose sans employer la forme suivie
   qui déclenchait le motif. L'instrument redevient simple, et le contrat vaut 24 + 3 = 27. */

const GENERATRICES_DECLAREES = ["content/"];

export const CATEGORIES = [
  /* — rien à corriger — */
  "slug_conserve",
  "citation_attribuee",
  "reference_reglementaire_a_reformuler",
  "reference_reglementaire_legitime",
  /* — une affirmation interdite ; la catégorie dit QUI la corrige — */
  "test_commentaire_historique",
  "artefact_genere",
  "source_generatrice_active",
  "heritage_a_corriger_ou_supprimer",
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

  /* 3 — La PHRASE porteuse est arbitrée « à reformuler » : elle prime sur le jugement porté sur
     l'occurrence seule, licite ou non, car c'est le titre entier qui est remplacé. */
  if (A_REFORMULER.some((r) => r.fichier === chemin && ligne.includes(r.ancre))) return "reference_reglementaire_a_reformuler";

  /* 4 — L'occurrence elle-même est une référence licite : le règlement, la méthode de mesure,
     les exigences de contenant. Rien à corriger, où qu'elle vive. */
  if (OCC_LEGITIME.test(trouve)) return "reference_reglementaire_legitime";

  /* À partir d'ici, l'occurrence DOIT être une affirmation interdite. Sinon on ne sait pas ce
     que c'est, et on le dit. */
  if (!OCC_INTERDITE.test(trouve)) return null;

  if (TESTS.some((r) => r.test(chemin))) return "test_commentaire_historique";
  if (GENERES.some((r) => r.test(chemin))) return "artefact_genere";
  if (GENERATRICES_DECLAREES.some((p) => chemin.startsWith(p))) return "source_generatrice_active";
  if (HERITAGE_V1.some((p) => chemin === p || chemin.startsWith(p))) return "heritage_a_corriger_ou_supprimer";
  if (APPLICATIF.some((r) => r.test(chemin))) return "affirmation_publique_interdite";
  return "source_editoriale";
}

/* ---- LES CITATIONS DE L'HÉRITAGE, RAPPORTÉES SANS RIEN PRÉTENDRE ---------------------------
   On ne prouve plus l'inertie : c'est indémontrable statiquement. On se contente de DIRE qui
   cite ces répertoires, pour que la décision de les corriger ou de les supprimer se prenne en
   connaissance de cause. Aucun de ces constats ne fait échouer le relevé. */
export function citationsDeLHeritage() {
  const scripts = [];
  const chercher = (d) => {
    if (!existsSync(d)) return;
    for (const e of [...readdirSync(d)].sort()) {
      const p = join(d, e);
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) { if (!["node_modules", ".git", "dist"].includes(e)) chercher(p); }
      else if ([".mjs", ".ts", ".js", ".cjs", ".json"].includes(extname(e)) && e !== "package-lock.json") scripts.push(p);
    }
  };
  for (const d of ["packages", "worker", "workers", "scripts"]) chercher(join(RACINE, d));
  for (const e of [...readdirSync(RACINE)].sort()) {
    if ([".mjs", ".cjs", ".js"].includes(extname(e))) scripts.push(join(RACINE, e));
  }
  const constats = [];
  for (const prefixe of HERITAGE_V1) {
    const cible = prefixe.replace(/\/$/, "");
    for (const f of scripts) {
      const rel = relative(RACINE, f);
      if (rel.startsWith("inventaire-iata") || rel.startsWith("test-inventaire-iata")) continue;
      let c; try { c = readFileSync(f, "utf8"); } catch { continue; }
      /* Le chemin littéral, ou construit par morceaux : `join(ROOT, "static", …)`. Ce relevé
         SUR-RAPPORTE volontairement — `output: "static"` d'Astro y figure, et c'est une valeur de
         configuration, pas un chemin. Il reste néanmoins incomplet : un chemin calculé lui
         échapperait. C'est précisément pourquoi on n'en tire plus aucune conclusion d'inertie ;
         il informe une décision humaine, il ne conclut rien. */
      if (new RegExp(`["'\`]${cible}/|["'\`]${cible}["'\`]\\s*,`).test(c)) constats.push({ prefixe, cite_par: rel });
    }
  }
  return constats;
}

/* Les ancres de reformulation doivent toutes MORDRE : une déclaration qui ne s'applique à rien
   ne protège rien, et masquerait une modification approuvée qu'on croirait couverte. */
export function ancresOrphelines(releve) {
  return A_REFORMULER.filter((r) => !releve.some((o) => o.fichier === r.fichier && o.categorie === "reference_reglementaire_a_reformuler"));
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
  const inconnues = releve.filter((r) => r.categorie === null || r.categorie === undefined);
  const hors = releve.filter((r) => r.categorie != null && !CATEGORIES.includes(r.categorie));
  const orphelines = ancresOrphelines(releve);
  return { inconnues, hors, orphelines, ok: inconnues.length === 0 && hors.length === 0 && orphelines.length === 0 };
}

/* ---- SORTIE -------------------------------------------------------------------------------- */
if (import.meta.url === `file://${process.argv[1]}`) {
  const ARGS = process.argv.slice(2);
  const releve = relever();

  const constats = citationsDeLHeritage();
  const v = verifier(releve);
  if (!v.ok) {
    console.error("RELEVÉ REFUSÉ.");
    for (const r of v.inconnues.slice(0, 20)) console.error(`  occurrence qu'aucune règle ne reconnaît : ${r.fichier}:${r.ligne}:${r.colonne}  « ${r.trouve} »`);
    for (const r of v.hors.slice(0, 20)) console.error(`  catégorie hors liste : ${r.fichier}:${r.ligne}:${r.colonne}  « ${r.categorie} »`);
    for (const r of v.orphelines) console.error(`  ancre de reformulation qui ne trouve rien : ${r.fichier} « ${r.ancre} »`);
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
    if (c === "reference_reglementaire_a_reformuler") console.log("  — licite à l'occurrence, mais la phrase porteuse est arbitrée à reformuler —");
    if (c === "reference_reglementaire_legitime") console.log("  — rien à corriger (suite) —");
    if (c === "test_commentaire_historique") console.log("  — une affirmation interdite ; la catégorie dit qui la corrige —");
    const sel = releve.filter((r) => r.categorie === c);
    console.log(`${String(sel.length).padStart(5)}  ${c.padEnd(34)} ${String(new Set(sel.map((r) => r.fichier)).size).padStart(3)} fichier(s)`);
  }
  console.log(`${String(releve.length).padStart(5)}  ${"TOTAL".padEnd(34)}`);
  if (constats.length) {
    console.log("\n— l'héritage v1, et qui le cite (constat indicatif : l'inertie n'est PAS prouvable statiquement) —");
    for (const c of constats) console.log(`       ${c.prefixe} cité par ${c.cite_par}`);
  }

  const applic = releve.filter((r) => ["affirmation_publique_interdite", "reference_reglementaire_a_reformuler"].includes(r.categorie)).length;
  const edito = releve.filter((r) => ["source_editoriale", "source_generatrice_active", "heritage_a_corriger_ou_supprimer"].includes(r.categorie)).length;
  console.log(`\nÉTAPE 3 APPLICATIVE : ${applic} modification(s)   ·   MICRO-LOT ÉDITORIAL : ${edito}   ·   À RÉGÉNÉRER : ${releve.filter((r) => r.categorie === "artefact_genere").length}`);

  for (const [titre, cat] of [["ÉTAPE 3 — affirmations interdites", "affirmation_publique_interdite"],
                              ["ÉTAPE 3 — références à reformuler", "reference_reglementaire_a_reformuler"],
                              ["MICRO-LOT ÉDITORIAL — sources", "source_editoriale"],
                              ["MICRO-LOT ÉDITORIAL — sources génératrices", "source_generatrice_active"],
                              ["MICRO-LOT ÉDITORIAL — héritage v1", "heritage_a_corriger_ou_supprimer"]]) {
    const par = releve.filter((r) => r.categorie === cat)
      .reduce((a, r) => ((a[r.fichier] = (a[r.fichier] || 0) + 1), a), {});
    const n = Object.values(par).reduce((a, b) => a + b, 0);
    console.log(`\n— ${titre} : ${n} occurrence(s), ${Object.keys(par).length} fichier(s) —`);
    for (const [f, k] of Object.entries(par).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`${String(k).padStart(5)}  ${f}`);
  }
}
