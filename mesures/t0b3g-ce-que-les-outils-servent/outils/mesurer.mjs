#!/usr/bin/env node
/**
 * T0-B3-g — CE QUE LES OUTILS SERVENT, ET DANS QUELLE LANGUE.
 *
 * Ce dossier ne corrige rien : aucun outil modifié, aucune phrase traduite, aucun fichier de
 * `packages/` écrit. Chaque fichier du périmètre est relu au commit de base et comparé au bit près.
 *
 * LA QUESTION. Le site annonce huit outils. Quatre d'entre eux ne sont lus par aucun harnais, et
 * personne n'avait vérifié DEUX choses : lesquels sont des outils qui calculent, et dans quelle
 * langue chacun s'adresse réellement au visiteur.
 *
 * POURQUOI LA LANGUE SE MESURE SANS INTERPRÉTATION. `inlineT` a un contrat explicite :
 *
 *     locale === "fr" ? fr : locale === "es" ? (es ?? en) : table ? table[en] || en : en
 *
 * Deux replis y sont ÉCRITS, pas devinés. Un appel à deux arguments sert l'anglais en espagnol.
 * Une clé anglaise absente de la table portugaise sert l'anglais en portugais. Ce dossier ne juge
 * donc rien : il compte deux conséquences mécaniques du code tel qu'il est.
 *
 * CE QUE JE NE MESURE PAS, ET POURQUOI JE L'ÉCRIS PLUTÔT QUE DE LE MAQUILLER. « D'où vient ce
 * chiffre ? » n'est pas automatisable sans accuser à tort : classer un littéral numérique en
 * « affirmation » confondrait un seuil IATA avec un index de tableau. T0-B3-f a rejeté trois
 * versions d'un contrôle pour exactement cette raison. La provenance est donc INVENTORIÉE — les
 * imports du référentiel scellé, fichier par fichier — et non jugée.
 *
 * EXHAUSTIVITÉ PAR RÉSIDU, APPLIQUÉE AU LECTEUR LUI-MÊME. Chaque site d'appel tombe dans
 * exactement un état, et le total des états doit égaler le nombre d'occurrences repérées dans le
 * texte. Un site que l'analyseur ne saurait pas lire ferait ÉCHOUER la mesure au lieu d'être
 * silencieusement absent : c'est la seule protection contre un dossier qui se croit exhaustif.
 *
 * LES CONTRE-ÉPREUVES (chacune doit sortir en 1 avec SON diagnostic) :
 *   `service`   une page d'attente devient un outil servi   → le compte des pages d'attente tombe
 *   `es`        un appel à deux arguments en reçoit un 3e   → « servent l'anglais en espagnol » tombe
 *   `pt`        une clé manquante est ajoutée à la table    → « servent l'anglais en portugais » tombe
 *   `residu`    un site d'appel est retiré de l'analyse     → l'égalité des totaux tombe
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { posix } from "node:path";
import { createHash } from "node:crypto";

/** Base de mesure FIGÉE, jamais `HEAD` : régénérer ne doit pas déplacer le sceau. */
/* BASE DÉPLACÉE le 20/08/2026, de `50188bd` à `6c81edf` : la contre-revue a arbitré
   l'ajout de deux clés portugaises — « updated » et « In short » — dans la table scellée par ce
   dossier. Mesurer autre chose exige de déclarer une nouvelle base. Les chiffres sont
   RECALCULÉS sur la nouvelle base, jamais recopiés. */
export const MESURE_BASE_SHA = "6c81edf9f356619694e63694ccf5b5ac4ff9b021";

const DOSSIER = "mesures/t0b3g-ce-que-les-outils-servent";
const ROUTES = "packages/ui/src/pages/[...loc]/tools";
const COMPOSANTS = "packages/ui/src/components";
const TABLE_PT = "packages/knowledge/translations/pt/inline.json";

const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const auCommit = (c) => execFileSync("git", ["show", `${MESURE_BASE_SHA}:${c}`],
  { maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });

const CONTRE = (process.argv.find((a) => a.startsWith("--contre-epreuve=")) ?? "").split("=")[1] ?? "";
let echecs = 0;
const exiger = (label, cond, detail = "") => {
  if (!cond) { echecs++; process.stdout.write(`    ✗ ${label}${detail ? ` — ${detail}` : ""}\n`); }
};

/* ---- LE PÉRIMÈTRE, CONSTATÉ PUIS SCELLÉ -------------------------------------------------------
 * Les routes sont LISTÉES au commit de base, pas sur le disque : une route ajoutée depuis le sceau
 * doit faire échouer la mesure, jamais s'y glisser. */
const listeAuCommit = (dir) => execFileSync("git", ["ls-tree", "--name-only", `${MESURE_BASE_SHA}:${dir}`],
  { encoding: "utf8" }).trim().split("\n").filter(Boolean);

const routes = listeAuCommit(ROUTES).filter((f) => f.endsWith(".astro")).sort();
const surDisque = readdirSync(ROUTES).filter((f) => f.endsWith(".astro")).sort();
if (routes.join("|") !== surDisque.join("|")) {
  process.stderr.write(`[t0b3g] ÉCHEC — les routes d'outils du disque diffèrent de la base `
    + `${MESURE_BASE_SHA.slice(0, 7)} :\n  base   : ${routes.join(", ")}\n  disque : ${surDisque.join(", ")}\n`);
  process.exit(1);
}

/** Les imports bruts d'un fichier, dans l'ordre où ils sont écrits. */
const importsDe = (texte) => [...texte.matchAll(/^import\s+(?:[\w{},*\s]+\s+from\s+)?["']([^"']+)["']/gm)]
  .map((m) => m[1]);

/* LE GABARIT DE PAGE EST EXCLU, ET L'EXCLUSION EST DÉCLARÉE — jamais silencieuse. `layouts/` porte
 * l'en-tête, la navigation et le pied de page de TOUTES les pages du site. Ses phrases ne sont pas
 * celles des outils : les compter ici attribuerait aux outils la langue du site entier. Les fichiers
 * écartés sont listés dans l'artefact, avec ce motif. */
const EXCLU = /(^|\/)layouts\//;
const exclus = new Set();

/** Les composants `.astro` importés par un fichier, chemin résolu depuis le dépôt. */
const composantsDe = (chemin, texte) => importsDe(texte)
  .filter((s) => s.endsWith(".astro") && s.startsWith("."))
  .map((s) => posix.normalize(posix.join(posix.dirname(chemin), s)));

const fichiers = new Map(); // chemin relatif au dépôt → texte
const ajouter = (chemin) => {
  if (fichiers.has(chemin)) return;
  const octets = readFileSync(chemin);
  if (sha256(octets) !== sha256(auCommit(chemin))) {
    process.stderr.write(`[t0b3g] ÉCHEC — ${chemin} diffère de la base ${MESURE_BASE_SHA.slice(0, 7)}.\n`);
    process.exit(1);
  }
  const texte = octets.toString("utf8");
  fichiers.set(chemin, texte);
  for (const c of composantsDe(chemin, texte)) {
    if (EXCLU.test(c)) { exclus.add(c); continue; }
    ajouter(c);
  }
};
for (const r of routes) ajouter(`${ROUTES}/${r}`);

/* La table portugaise, scellée elle aussi. */
const octetsTable = readFileSync(TABLE_PT);
if (sha256(octetsTable) !== sha256(auCommit(TABLE_PT))) {
  process.stderr.write(`[t0b3g] ÉCHEC — ${TABLE_PT} diffère de la base.\n`); process.exit(1);
}
const TABLE = JSON.parse(octetsTable.toString("utf8"));

/* ---- L'ANALYSEUR DE SITES D'APPEL --------------------------------------------------------------
 * Un scanner à parenthèses équilibrées, conscient des trois formes de littéral (', ", `) et de
 * leurs échappements. Une expression régulière ne suffirait pas : les phrases contiennent des
 * parenthèses, des apostrophes et des virgules. */
const ALIAS = /^\s*const\s+([TL])\s*=\s*inlineT\(/m;

function argumentsDe(texte, debut) {
  /* `debut` est l'index de la parenthèse ouvrante. Renvoie la liste des arguments bruts, ou null
     si la parenthèse ne se referme pas (fichier tronqué — cas qui doit échouer, pas être ignoré). */
  const args = [];
  let profondeur = 0, courant = "", i = debut, litteral = null;
  for (; i < texte.length; i++) {
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
    if (c === q) return null; // guillemet non échappé au milieu : ce n'est pas un littéral simple
    out += c;
  }
  return out;
}

const sites = [];
let occurrencesTexte = 0;
for (const [chemin, texte] of fichiers) {
  const alias = ALIAS.exec(texte)?.[1];
  exiger(`${chemin.split("/").pop()} : un alias de \`inlineT\` est déclaré ou le fichier n'en appelle aucun`,
    alias !== undefined || !/\binlineT\(/.test(texte), "appelle inlineT sans alias `const T|L =`");
  /* `inlineF` a une AUTRE signature (l'espagnol y est obligatoire) : sa présence rendrait les
     comptes ci-dessous faux. Le périmètre doit en être exempt, et c'est exigé, pas supposé. */
  exiger(`${chemin.split("/").pop()} : aucun \`inlineF\` (signature différente, comptes faussés)`,
    !/\binlineF\b/.test(texte));
  if (!alias) continue;
  const motif = new RegExp(`\\b${alias}\\(`, "g");
  for (const m of texte.matchAll(motif)) {
    occurrencesTexte++;
    if (CONTRE === "residu" && occurrencesTexte === 3) continue; // un site retiré de l'analyse
    const args = argumentsDe(texte, m.index + m[0].length - 1);
    const ligne = texte.slice(0, m.index).split("\n").length;
    if (!args) { sites.push({ chemin, ligne, etat: "illisible", cle: null }); continue; }
    const cle = litteral(args[0] ?? "");
    if (cle === null) { sites.push({ chemin, ligne, etat: "cle-non-litterale", cle: null }); continue; }
    /* `es ?? en` : un appel à moins de trois arguments sert l'anglais en espagnol. Ce n'est pas
       une interprétation, c'est la signature de `inlineT`. */
    const esAnglais = args.length < 3;
    const ptAnglais = !Object.prototype.hasOwnProperty.call(TABLE, cle);
    const etat = esAnglais && ptAnglais ? "es-et-pt-anglais"
      : esAnglais ? "es-anglais" : ptAnglais ? "pt-anglais" : "servi";
    /* Une traduction IDENTIQUE à l'anglais n'est pas un repli : « IATA » se dit IATA partout.
       Elle est donc INVENTORIÉE à part, sans verdict — la confondre avec un repli accuserait à tort. */
    const esIdentique = !esAnglais && litteral(args[2] ?? "") === cle;
    const ptIdentique = !ptAnglais && TABLE[cle] === cle;
    sites.push({ chemin, ligne, args: args.length, etat, cle, esIdentique, ptIdentique });
  }
}

/* Les contre-épreuves n'agissent qu'APRÈS le scellement, et seulement en mémoire. Chacune est
 * CHIRURGICALE : elle déplace un seul site, de façon à ne faire tomber QUE l'exigence visée. Une
 * mutation qui en ferait tomber trois ne prouverait pas laquelle porte. */
if (CONTRE === "es") {
  const s = sites.find((x) => x.etat === "pt-anglais");
  if (!s) { process.stderr.write("[t0b3g] contre-épreuve `es` MUETTE : aucun site à déplacer.\n"); process.exit(2); }
  s.etat = "es-et-pt-anglais"; // l'espagnol perd un site, le portugais n'en gagne ni n'en perd
}
if (CONTRE === "pt") {
  const s = sites.find((x) => x.etat === "pt-anglais");
  if (!s) { process.stderr.write("[t0b3g] contre-épreuve `pt` MUETTE : aucun site à déplacer.\n"); process.exit(2); }
  s.etat = "servi"; // comme si la clé venait d'être ajoutée à la table portugaise
}

const ETATS = ["servi", "es-anglais", "pt-anglais", "es-et-pt-anglais", "cle-non-litterale", "illisible"];
const compte = Object.fromEntries(ETATS.map((e) => [e, sites.filter((s) => s.etat === e).length]));

process.stdout.write(`\n  T0-B3-g — ce que les outils servent (base ${MESURE_BASE_SHA.slice(0, 7)})\n\n`);
process.stdout.write(`  périmètre : ${routes.length} routes d'outils · ${fichiers.size} fichiers scellés\n`);

/* ---- 1. L'ANALYSE EST-ELLE EXHAUSTIVE ? ------------------------------------------------------- */
exiger("chaque occurrence repérée dans le texte est classée dans exactement un état",
  sites.length === occurrencesTexte,
  `${occurrencesTexte} occurrences · ${sites.length} classées — ${occurrencesTexte - sites.length} perdue(s)`);
exiger("aucun site d'appel n'est illisible (parenthèse non refermée)", compte.illisible === 0,
  `${compte.illisible} illisible(s)`);
exiger("les états couvrent tout : leur somme égale le nombre de sites",
  ETATS.reduce((n, e) => n + compte[e], 0) === sites.length);
process.stdout.write(`  sites d'appel : ${sites.length} analysés, ${occurrencesTexte} repérés\n`);

/* ---- 2. DANS QUELLE LANGUE LES OUTILS PARLENT-ILS ? ------------------------------------------- */
const es = compte["es-anglais"] + compte["es-et-pt-anglais"];
const pt = compte["pt-anglais"] + compte["es-et-pt-anglais"];
process.stdout.write(`  ${es} sites servent l'anglais en espagnol · ${pt} sites servent l'anglais en portugais\n`);
process.stdout.write(`  ${compte.servi} servis dans les quatre langues · ${compte["cle-non-litterale"]} à clé non littérale\n`);
/* CES CONSTATS SONT DES EXIGENCES, sinon aucune contre-épreuve ne pourrait les mettre en défaut :
   un chiffre seulement imprimé se dégrade sans que rien ne rougisse. */
exiger("aucun site du périmètre ne sert l'anglais en espagnol", es === 0,
  `${es} site(s) sur l'anglais en espagnol`);
const idem = { es: sites.filter((s) => s.esIdentique).length, pt: sites.filter((s) => s.ptIdentique).length };
process.stdout.write(`  identiques à l'anglais, sans jugement : ${idem.es} en espagnol · ${idem.pt} en portugais\n`);
exiger("l'inventaire portugais est celui du sceau : 322 servis, 33 sur l'anglais",
  compte.servi === 322 && pt === 33, `${compte.servi} servis · ${pt} sur l'anglais`);

/* ---- 2bis. L'AUTRE MÉCANISME DE TRADUCTION -----------------------------------------------------
 * `t(locale, clé)` lit une table par langue et retombe lui aussi sur l'anglais en silence :
 *     TABLES[locale]?.[key] ?? TABLES.en[key] ?? fallback ?? key
 * Mesurer `inlineT` sans lui laisserait croire le périmètre couvert alors qu'il ne l'est qu'à
 * moitié. Les clés sont donc relues dans les quatre tables, scellées comme le reste. */
const TABLES = {};
for (const l of ["en", "fr", "es", "pt"]) {
  const chemin = `packages/knowledge/translations/${l}/strings.json`;
  const octets = readFileSync(chemin);
  if (sha256(octets) !== sha256(auCommit(chemin))) {
    process.stderr.write(`[t0b3g] ÉCHEC — ${chemin} diffère de la base.\n`); process.exit(1);
  }
  TABLES[l] = JSON.parse(octets.toString("utf8"));
}
const clefs = [];
let occurrencesClefs = 0;
for (const [chemin, texte] of fichiers) {
  for (const m of texte.matchAll(/\bt\(\s*locale\s*,/g)) {
    occurrencesClefs++;
    const args = argumentsDe(texte, m.index + m[0].indexOf("("));
    const ligne = texte.slice(0, m.index).split("\n").length;
    const cle = args ? litteral(args[1] ?? "") : null;
    if (cle === null) { clefs.push({ chemin, ligne, cle: null, manquantes: null, etat: "cle-non-litterale" }); continue; }
    const manquantes = ["fr", "es", "pt"].filter((l) => !Object.prototype.hasOwnProperty.call(TABLES[l], cle));
    clefs.push({ chemin, ligne, cle, manquantes, etat: manquantes.length ? "incomplete" : "servie" });
  }
}
exiger("chaque appel `t(locale, clé)` du périmètre est lu et classé",
  clefs.length === occurrencesClefs, `${occurrencesClefs} repérés · ${clefs.length} classés`);
const clefsIncompletes = clefs.filter((c) => c.etat !== "servie");
process.stdout.write(`  clés \`t(locale, …)\` : ${clefs.length} sites, `
  + `${new Set(clefs.map((c) => c.cle)).size} clés distinctes, ${clefsIncompletes.length} incomplète(s)\n`);

/* ---- 3. L'ÉTAT DE SERVICE DE CHAQUE OUTIL ------------------------------------------------------
 * Trois états mutuellement exclusifs, et l'absence d'un quatrième est exigée :
 *   servi    — la route importe un composant qui calcule
 *   attente  — la route n'importe aucun composant : elle annonce un classement à venir
 *   retire   — la route se déclare `noindex` (hors index, hors sitemap) */
const outils = routes.map((f) => {
  const nom = f.replace(/\.astro$/, "");
  const texte = fichiers.get(`${ROUTES}/${f}`);
  /* Le CHROME est commun à toutes les pages du site : un outil qui n'importe QUE du chrome
     n'apporte aucun calcul — c'est une page d'attente, quel que soit le soin de sa mise en page. */
  const CHROME = /(Base|Breadcrumb|RelatedTools)\.astro$/;
  const composants = composantsDe(`${ROUTES}/${f}`, texte).filter((c) => !CHROME.test(c));
  const noindex = /noindex=\{true\}/.test(texte);
  let etat = noindex ? "retire" : composants.length ? "servi" : "attente";
  if (CONTRE === "service" && etat === "attente") etat = "servi";
  return { outil: nom, etat, composants, noindex };
});
const parEtat = (e) => outils.filter((o) => o.etat === e);
exiger("chaque route d'outil tombe dans exactement un état de service",
  parEtat("servi").length + parEtat("attente").length + parEtat("retire").length === routes.length);
process.stdout.write(`  outils : ${parEtat("servi").length} servis · ${parEtat("attente").length} pages d'attente · `
  + `${parEtat("retire").length} retirés de l'index\n`);
exiger("sur les 8 routes : 4 outils servis, 2 pages d'attente, 2 retirées de l'index",
  parEtat("servi").length === 4 && parEtat("attente").length === 2 && parEtat("retire").length === 2,
  `${parEtat("servi").length} servis · ${parEtat("attente").length} en attente · ${parEtat("retire").length} retirés`);

/* CE QUI EST ANNONCÉ, LU DANS LES SOURCES ET NON DANS `dist` — corrigé le 20/08/2026.
 *
 * Cette section lisait le site construit, et retombait sur `null` quand `dist` était absent. Le
 * dossier n'était donc PAS reproductible depuis un arbre propre : l'artefact changeait, puis
 * SHA256SUMS échouait. Un dossier de mesure dont le résultat dépend d'un répertoire ignoré par git
 * ne mesure rien de scellable — relevé par la contre-revue du 20/08/2026, et c'est exact.
 *
 * Les deux listes sont pourtant écrites en clair dans les sources : `sitemapEntries.ts` énumère les
 * outils déclarés au sitemap, `tools.astro` énumère ceux qui sont liés depuis `/tools/`. Elles sont
 * lues là, scellées comme le reste, et le dossier redevient reproductible partout — sans build. */
const OUTILS_CITES = (texte) => new Set([...texte.matchAll(/\/tools\/([a-z-]+)\//g)].map((m) => m[1]));
/* `tools.astro` est la PAGE `/tools/`, sœur du répertoire des outils et non l'un d'eux : elle ne
   fait donc pas partie du périmètre mesuré, mais c'est elle qui porte les liens. */
const ANNONCEURS = ["packages/ui/src/lib/sitemapEntries.ts", "packages/ui/src/pages/[...loc]/tools.astro"];
const lus = {};
for (const chemin of ANNONCEURS) {
  const octets = readFileSync(chemin);
  if (sha256(octets) !== sha256(auCommit(chemin))) {
    process.stderr.write(`[t0b3g] ÉCHEC — ${chemin} diffère de la base.\n`); process.exit(1);
  }
  lus[chemin] = octets.toString("utf8");
}
const auSitemap = OUTILS_CITES(lus[ANNONCEURS[0]]);
const liesDepuisTools = OUTILS_CITES(lus[ANNONCEURS[1]]);
exiger("les deux listes d'annonce sont lisibles dans les sources (sinon ce contrôle ne prouve rien)",
  auSitemap.size >= 4 && liesDepuisTools.size >= 4,
  `${auSitemap.size} au sitemap · ${liesDepuisTools.size} liés depuis /tools/`);
const annonce = outils.map((o) => ({
  outil: o.outil,
  auSitemap: auSitemap.has(o.outil),
  lieDepuisTools: liesDepuisTools.has(o.outil),
}));
const attenteAnnoncee = annonce.filter((a) => a.auSitemap
  && outils.find((o) => o.outil === a.outil).etat === "attente");
process.stdout.write(`  annoncés au sitemap : ${annonce.filter((a) => a.auSitemap).length} — dont `
  + `${attenteAnnoncee.length} page(s) d'attente\n`);
exiger("les deux pages d'attente sont bien annoncées au sitemap au rang des outils",
  attenteAnnoncee.length === 2, `${attenteAnnoncee.length} page(s) d'attente annoncée(s)`);

/* ---- 4. LA PROVENANCE, INVENTORIÉE — JAMAIS JUGÉE --------------------------------------------- */
const provenance = [...fichiers].map(([chemin, texte]) => ({
  fichier: chemin,
  referentiel: importsDe(texte).filter((s) => s.startsWith("@mydogcanfly/")),
})).filter((p) => p.referentiel.length);
process.stdout.write(`  ${provenance.length} fichiers du périmètre importent le référentiel scellé\n\n`);

/* ---- L'ARTEFACT -------------------------------------------------------------------------------- */
const parOutil = {};
for (const o of outils) {
  const cheminsDe = new Set([`${ROUTES}/${o.outil}.astro`, ...o.composants]);
  const s = sites.filter((x) => cheminsDe.has(x.chemin));
  parOutil[o.outil] = Object.fromEntries(ETATS.map((e) => [e, s.filter((x) => x.etat === e).length]));
}
const artefact = {
  base: MESURE_BASE_SHA,
  perimetre: {
    routes,
    fichiers: [...fichiers.keys()].sort(),
    exclus: { fichiers: [...exclus].sort(), motif: "gabarit de page commun à tout le site, pas aux outils" },
  },
  service: outils,
  annonce,
  langue: { total: sites.length, occurrencesTexte, compte, parOutil, sites },
  identiques: idem,
  clefs: { total: clefs.length, distinctes: [...new Set(clefs.map((c) => c.cle))].sort(), sites: clefs },
  provenance,
};
if (!CONTRE) writeFileSync(`${DOSSIER}/ce-que-les-outils-servent.json`, JSON.stringify(artefact, null, 2) + "\n");

if (echecs) { process.stderr.write(`[t0b3g] ÉCHEC — ${echecs} exigence(s) non tenue(s).\n`); process.exit(1); }
process.stdout.write("[t0b3g] toutes les exigences tenues.\n");
