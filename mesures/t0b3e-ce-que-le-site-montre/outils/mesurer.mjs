#!/usr/bin/env node
/**
 * T0-B3-e — CE QUE LE SITE MONTRE, ET DANS QUELLE LANGUE.
 *
 * Ce dossier ne corrige rien : aucune règle retirée, aucun texte réécrit, aucun fichier de
 * `packages/` écrit. L'empreinte des fichiers bruts est relue à la fin.
 *
 * D'OÙ IL VIENT. T0-B3-d a établi, en lisant les 2 957 pages construites, que les 95 phrases
 * contradictoires sur le poids ne sont publiées nulle part. Il l'a constaté sans l'expliquer, et un
 * constat inexpliqué est une hypothèse déguisée. Ce dossier répond à la question qui restait :
 * **quelles phrases du référentiel atteignent réellement un lecteur, par quel chemin, et dans
 * quelle langue ?**
 *
 * LA PARTITION N'EST PAS DÉDUITE DE LA CATÉGORIE. Il serait facile d'écrire « seules les
 * `import_rules` sont publiées » en lisant `explain.ts`. Ce dossier ne le lit pas : il fait tourner
 * le moteur sur **la grille exhaustive des couples de pays que le référentiel sait relier** — 108
 * origines × 108 destinations, aucune sélection, aucun échantillon — et récolte tout identifiant de
 * règle qui atteint `report.conditions`. Ce qui n'y apparaît jamais n'y apparaît jamais.
 *
 * LES CONTRE-ÉPREUVES (chacune doit sortir en 1 avec SON diagnostic) :
 *   `chemin`      les règles d'importation sont retirées du moteur → « atteignent le rapport » tombe
 *   `traduction`  un texte portugais est injecté partout           → « servi en anglais » tombe
 *   `repli`       une compagnie perd sa fiche                      → « personne ne prend le repli » tombe
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { normalize } from "../../../packages/knowledge/src/normalize.ts";
import { evaluate } from "../../../packages/engine/src/evaluate.ts";
import { explain } from "../../../packages/engine/src/explain.ts";

/** Base de mesure FIGÉE, jamais `HEAD`. */
export const MESURE_BASE_SHA = "34b04cd8fe9ec9c60d41a34e28f48908699127c5";

const DOSSIER = "mesures/t0b3e-ce-que-le-site-montre";
const RAW = {
  objets: "packages/knowledge/raw/objects.json",
  regles: "packages/knowledge/raw/rules.json",
  race: "packages/knowledge/raw/breed-restrictions.json",
};
const SOURCES_MOTEUR = ["packages/engine/src/evaluate.ts", "packages/engine/src/explain.ts",
  "packages/engine/src/contracts.ts", "packages/knowledge/src/normalize.ts"];
/* Le chemin de publication tient à ces quatre fichiers : le composant de repli, celui qui l'appelle,
   et les deux jeux de données dont la présence décide qu'on ne le prend pas. */
const SOURCES_PAGE = ["packages/ui/src/components/EntityPage.astro",
  "packages/ui/src/components/EntityDetail.astro",
  "packages/ui/src/pages/[...loc]/airlines/[slug].astro",
  "packages/ui/src/pages/[...loc]/countries/[slug].astro"];
const FICHES = "packages/ui/src/data/airlines.generated.json";
const GUIDES = "packages/ui/src/data/countries.generated.json";
const SITE = "packages/ui/dist";
/* Le marqueur du composant de repli. Deux exigences, et la seconde m'a repris.
 *   · il doit être émis SANS CONDITION : `ep__rationale` ne sort que si l'entité porte au moins une
 *     règle, et son absence confondrait « le repli n'est pas pris » avec « pris, sans règle » ;
 *   · il doit être une CONJONCTION, pas un jeton. `ep__title` seul comptait une page — le prototype
 *     caché `/lab/roundtrip/`, qui ne rend pas ce composant mais embarque une feuille de style où
 *     ce nom de classe figure. Un nom de classe se recopie ; deux qui coexistent, beaucoup moins. */
const MARQUEURS_REPLI = ["ep__head", "ep__title"];

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
    process.stderr.write(`[t0b3e] ÉCHEC — ${chemin} diffère de la base ${MESURE_BASE_SHA.slice(0, 7)}.\n`);
    process.exit(1);
  }
}
const brut = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, JSON.parse(readFileSync(v, "utf8"))]));

if (CONTRE === "chemin") brut.regles = brut.regles.filter((r) => r.category !== "import_rules");
if (CONTRE === "traduction") {
  for (const r of brut.regles) {
    if (r.category === "import_rules") r.rationale_i18n = { ...r.rationale_i18n, pt: "Texto em português." };
  }
}
const kb = normalize({ ...brut.objets, rules: brut.regles, breed_restrictions: brut.race });

const LANGUES = ["en", "fr", "es", "pt"];
const estAutoCitee = (url) => { try { return /(^|\.)mydogcanfly\.com$/i.test(new URL(url).hostname); } catch { return false; } };
const parCategorie = brut.regles.reduce((a, r) => (a[r.category] = (a[r.category] ?? 0) + 1, a), {});

/* ---- LA GRILLE EXHAUSTIVE ------------------------------------------------------------------------
 * Tous les couples (pays d'origine, pays de destination) que le référentiel sait relier — un
 * aéroport par pays, le premier par ordre d'identifiant, pour que la grille soit déterministe. On
 * ne cherche pas une règle en particulier : on récolte TOUT ce qui atteint `report.conditions`, et
 * la partition tombe d'elle-même. */
const aeroportDe = new Map();
for (const a of [...kb.airports.values()].sort((x, y) => x.id.localeCompare(y.id))) {
  if (!aeroportDe.has(a.country_id)) aeroportDe.set(a.country_id, a.id);
}
const PAYS_RELIABLES = [...aeroportDe.keys()].sort();
const requete = (o, d, locale) => ({
  origin: aeroportDe.get(o), destination: aeroportDe.get(d),
  dog: { breed_id: "breed_labrador_retriever", weight_kg: 20 },
  travel_type: "pet", placement: "hold", date: DATE_VOYAGE, locale,
});
const DATE_BASE = execFileSync("git", ["show", "-s", "--format=%cI", MESURE_BASE_SHA], { encoding: "utf8" }).trim();
const DATE_VOYAGE = `${Number(DATE_BASE.slice(0, 4)) + 1}-01-15`;

const atteintes = new Map(); // rule_id -> { origine, destination }
let passes = 0;
for (const o of PAYS_RELIABLES) {
  for (const d of PAYS_RELIABLES) {
    if (o === d) continue; // un vol intérieur n'a pas d'exigence d'entrée : le moteur le dit, on ne le contredit pas
    passes++;
    const rep = explain(evaluate(kb, requete(o, d, "en")), "en");
    for (const c of rep.conditions ?? []) if (!atteintes.has(c.rule_id)) atteintes.set(c.rule_id, { origine: o, destination: d });
  }
}
const PUBLIABLES = brut.regles.filter((r) => atteintes.has(r.id));
const JAMAIS = brut.regles.filter((r) => !atteintes.has(r.id));

exiger("148 des 407 règles atteignent un lecteur — les 259 autres ne montrent jamais leur texte",
  PUBLIABLES.length === 148 && JAMAIS.length === 259, `${PUBLIABLES.length} / ${JAMAIS.length}`);
exiger("la grille est exhaustive : tous les couples de pays reliables, sans échantillon",
  passes === PAYS_RELIABLES.length * (PAYS_RELIABLES.length - 1),
  `${passes} passes pour ${PAYS_RELIABLES.length} pays`);
/* LA PARTITION, MESURÉE ET NON DÉDUITE — et c'est précisément là que la déduction aurait menti.
 * « Seules les `import_rules` sont publiées » est faux : `rule_jp_import` atteint le lecteur en
 * étant classée `vaccination`. C'est une règle d'entrée du Japon, son identifiant le dit, sa
 * catégorie non. Déduire la partition de la catégorie l'aurait manquée ; la grille la trouve.
 * L'inverse est vrai aussi : 35 `import_rules` n'atteignent jamais personne. */
const HORS_IMPORT_ATTENDUES = { rule_jp_import: "règle d'entrée du Japon (MAFF) classée `vaccination` "
  + "et non `import_rules` : son identifiant dit ce qu'elle est, sa catégorie le contredit." };
const horsImport = PUBLIABLES.filter((r) => r.category !== "import_rules");
exiger("toute règle publiée hors `import_rules` est NOMMÉE — la catégorie ne décide de rien ici",
  horsImport.every((r) => r.id in HORS_IMPORT_ATTENDUES),
  horsImport.filter((r) => !(r.id in HORS_IMPORT_ATTENDUES)).map((r) => `${r.id} (${r.category})`).join(", "));
exiger("les 224 règles de poids, de placement, de race et d'embargo ne montrent JAMAIS leur texte",
  JAMAIS.filter((r) => !["import_rules", "vaccination"].includes(r.category)).length === 224,
  String(JAMAIS.filter((r) => !["import_rules", "vaccination"].includes(r.category)).length));

/* Les règles d'importation qui n'atteignent AUCUN couple sont nommées, avec le motif lisible. */
const importNonAtteintes = JAMAIS.filter((r) => r.category === "import_rules").map((r) => ({
  id: r.id, pays: r.scope.id,
  motif: !aeroportDe.has(r.scope.id)
    ? "aucun aéroport dans ce pays : le référentiel ne sait pas y router"
    : "conditions non satisfaites par un couple de pays de la grille",
}));
exiger("toute règle d'importation non atteinte porte un motif lisible, jamais « inexpliqué »",
  importNonAtteintes.every((x) => x.motif), "");

/* ---- LA LANGUE DE CE QUI EST PUBLIÉ ---------------------------------------------------------------
 * Pour chaque règle atteinte, son couple témoin est rejoué dans les quatre langues. On ne compare
 * pas la donnée : on compare LE TEXTE QUE LE RAPPORT RENVOIE à celui qu'il renvoie en anglais. Une
 * traduction présente mais non servie, ou absente mais compensée ailleurs, se verrait ici. */
const parLangue = Object.fromEntries(LANGUES.map((l) => [l, { servies: 0, identiques_a_l_anglais: 0 }]));
const detailLangue = [];
for (const r of PUBLIABLES) {
  const { origine, destination } = atteintes.get(r.id);
  const textes = {};
  for (const l of LANGUES) {
    const rep = explain(evaluate(kb, requete(origine, destination, l)), l);
    textes[l] = (rep.conditions ?? []).find((c) => c.rule_id === r.id)?.text ?? null;
  }
  const ligne = { id: r.id, pays: r.scope.id, temoin: `${origine} → ${destination}`, en_anglais: [] };
  for (const l of LANGUES) {
    if (textes[l] == null) continue;
    parLangue[l].servies++;
    if (l !== "en" && textes[l] === textes.en) { parLangue[l].identiques_a_l_anglais++; ligne.en_anglais.push(l); }
  }
  detailLangue.push(ligne);
}
exiger("chaque règle atteinte est servie dans les quatre langues — aucune ne disparaît",
  LANGUES.every((l) => parLangue[l].servies === PUBLIABLES.length),
  JSON.stringify(parLangue));
exiger("le français n'est JAMAIS servi en anglais",
  parLangue.fr.identiques_a_l_anglais === 0, String(parLangue.fr.identiques_a_l_anglais));
exiger("le portugais est servi EN ANGLAIS pour la totalité des règles atteintes",
  parLangue.pt.identiques_a_l_anglais === PUBLIABLES.length,
  `${parLangue.pt.identiques_a_l_anglais} / ${PUBLIABLES.length}`);
exiger("l'espagnol l'est pour une majorité, mais pas pour toutes",
  parLangue.es.identiques_a_l_anglais > 0 && parLangue.es.identiques_a_l_anglais < PUBLIABLES.length,
  `${parLangue.es.identiques_a_l_anglais} / ${PUBLIABLES.length}`);

/* ---- LE REPLI : MORT, MAIS ARMÉ --------------------------------------------------------------------
 * `EntityPage.astro` contient le seul bloc du site qui publierait une rationale de règle. Il n'est
 * importé que par `EntityDetail.astro`, lui-même appelé en REPLI : une compagnie sans fiche, un pays
 * sans guide. Aucune entité ne prend ce repli — donc 500 lignes qui ne rendent rien, qu'aucun harnais
 * n'exerce, et qu'une seule ligne de données suffirait à mettre en production. */
const fiches = JSON.parse(readFileSync(FICHES, "utf8"));
const guides = JSON.parse(readFileSync(GUIDES, "utf8"));
if (CONTRE === "repli") delete fiches[[...kb.airlines.keys()].sort()[0]];
const cieSansFiche = [...kb.airlines.keys()].filter((id) => !(id in fiches)).sort();
const paysSansGuide = [...kb.countries.keys()].filter((id) => !(id in guides)).sort();
exiger("aucune compagnie ne prend le repli : toutes ont une fiche",
  cieSansFiche.length === 0, cieSansFiche.join(", "));
exiger("aucun pays ne prend le repli : tous ont un guide",
  paysSansGuide.length === 0, paysSansGuide.join(", "));
/* Le composant n'est atteignable que par ce repli : le prouver par les imports, pas par l'usage. */
const importeursEntityPage = [];
(function parcourirSrc(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) parcourirSrc(p);
    else if (/\.(astro|ts|tsx|js|mjs)$/.test(e)) {
      const t = readFileSync(p, "utf8");
      if (/from\s+["'][^"']*EntityPage\.astro["']/.test(t)) importeursEntityPage.push(p);
    }
  }
})("packages/ui/src");
exiger("`EntityPage` n'est importé que par `EntityDetail` — un seul chemin, et il est en repli",
  importeursEntityPage.length === 1 && importeursEntityPage[0].endsWith("EntityDetail.astro"),
  importeursEntityPage.join(", "));

/* ---- ET DANS LES OCTETS : le repli n'a rendu aucune page ---------------------------------------- */
const pagesHtml = [];
(function parcourir(d) {
  if (!existsSync(d)) return;
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) parcourir(p);
    else if (e.endsWith(".html")) pagesHtml.push(p);
  }
})(SITE);
if (pagesHtml.length < 2000) {
  process.stderr.write(`[t0b3e] ÉCHEC — site absent ou partiel (${pagesHtml.length} pages HTML, attendu ≥ 2000). `
    + "Ce dossier lit les octets publiés : `npm run build` d'abord.\n");
  process.exit(1);
}
let pagesDuRepli = 0;
for (const p of pagesHtml) {
  const html = readFileSync(p, "utf8");
  if (MARQUEURS_REPLI.every((m) => html.includes(m))) pagesDuRepli++;
}
exiger("aucune des pages construites n'est rendue par le composant de repli",
  pagesDuRepli === 0, `${pagesDuRepli} page(s)`);
/* Et l'on vérifie que la conjonction n'est pas un confort : prise séparément, `ep__title` compte
   bien une page, et c'est pour cela qu'on ne la prend pas séparément. */
const pagesUnSeulMarqueur = pagesHtml.filter((p) => {
  const h = readFileSync(p, "utf8");
  return MARQUEURS_REPLI.some((m) => h.includes(m)) && !MARQUEURS_REPLI.every((m) => h.includes(m));
});
exiger("le marqueur pris SÉPARÉMENT donnerait un faux positif — la conjonction n'est pas décorative",
  pagesUnSeulMarqueur.length === 1, `${pagesUnSeulMarqueur.length} : ${pagesUnSeulMarqueur.join(", ")}`);

/* ---- LES SOURCES DE CE QUI EST PUBLIÉ ------------------------------------------------------------- */
const autoPubliees = PUBLIABLES.filter((r) => estAutoCitee(r.source.url));
const autoJamais = JAMAIS.filter((r) => estAutoCitee(r.source.url));

const artefact = {
  lot: "T0-B3-e — ce que le site montre, et dans quelle langue",
  nature: "mesure seule : aucune règle retirée, aucun texte réécrit, aucun fichier de packages/ écrit",
  sceau: {
    measurement_base_sha: MESURE_BASE_SHA,
    raw_rules_sha256: sha256(readFileSync(RAW.regles)),
    moteur_sha256: sha256(SOURCES_MOTEUR.map((c) => `${c}:${sha256(readFileSync(c))}`).join("\n")),
    chemin_de_publication_sha256: sha256(SOURCES_PAGE.map((c) => `${c}:${sha256(readFileSync(c))}`).join("\n")),
    date_de_voyage: DATE_VOYAGE,
    date_de_voyage_origine: "dérivée du commit de base, jamais de l'horloge",
  },
  methode: {
    principe: "la partition n'est pas déduite de `explain.ts` : elle est récoltée sur la grille "
      + "EXHAUSTIVE des couples de pays que le référentiel sait relier.",
    pays_reliables: PAYS_RELIABLES.length,
    passes_du_moteur: passes,
    aucun_echantillon: true,
  },
  corpus: { total: brut.regles.length, par_categorie: parCategorie },
  ce_qui_atteint_un_lecteur: {
    regles_atteignant_le_rapport: PUBLIABLES.length,
    categories_atteignant_un_lecteur: [...new Set(PUBLIABLES.map((r) => r.category))],
    hors_import_rules: HORS_IMPORT_ATTENDUES,
    regles_n_atteignant_jamais: JAMAIS.length,
    dont_import_rules_non_atteintes: importNonAtteintes.length,
    detail_non_atteintes: importNonAtteintes,
    lecture: "Les seules phrases du référentiel qu'un lecteur puisse voir sont des exigences "
      + "d'entrée de pays, servies comme « conditions » du rapport. Tout le reste — poids, "
      + "placement, races, embargos de chaleur — décide de ce que le site affirme sans jamais "
      + "montrer sur quoi il se fonde. La catégorie ne suffit pas à le dire : `rule_jp_import` "
      + "atteint le lecteur en étant classée `vaccination`, et 35 `import_rules` n'atteignent "
      + "personne.",
  },
  la_langue: {
    par_langue: parLangue,
    lecture: "Mesuré dans le RAPPORT, pas dans la donnée : le texte renvoyé est comparé à celui "
      + "renvoyé en anglais pour le même couple. Le portugais reçoit l'anglais pour la totalité "
      + "des règles atteintes ; l'espagnol pour la plupart. Sur la seule prose que le site montre, "
      + "et qui porte sur les conditions légales d'entrée d'un animal.",
    detail: detailLangue,
  },
  le_repli_mort_mais_arme: {
    importeurs_de_EntityPage: importeursEntityPage,
    compagnies_sans_fiche: cieSansFiche.length,
    pays_sans_guide: paysSansGuide.length,
    pages_construites: pagesHtml.length,
    pages_rendues_par_le_repli: pagesDuRepli,
    lecture: "Le seul bloc du site capable de publier une rationale est dans un composant que rien "
      + "n'atteint : 102 compagnies sur 102 ont une fiche, 140 pays sur 140 ont un guide. Il n'est "
      + "donc ni rendu, ni exercé par un harnais — et une seule entité ajoutée sans sa fiche le "
      + "mettrait en production, publiant d'un coup des textes que personne n'a relus pour "
      + "l'affichage. Ce n'est pas du code mort : c'est du code armé.",
  },
  les_sources: {
    parmi_les_publiees: { total: PUBLIABLES.length, auto_citees: autoPubliees.length,
      citent_un_tiers: PUBLIABLES.length - autoPubliees.length },
    parmi_les_jamais_publiees: { total: JAMAIS.length, auto_citees: autoJamais.length,
      citent_un_tiers: JAMAIS.length - autoJamais.length },
    lecture: "Les règles auto-citées le sont autant sur ce que le site montre que sur ce qu'il "
      + "tait : la dette de sourcing n'est pas cantonnée à l'invisible.",
  },
  exigences_tenues: echecs === 0,
};
if (!CONTRE) writeFileSync(`${DOSSIER}/ce-que-le-site-montre.json`, JSON.stringify(artefact, null, 1) + "\n");

process.stdout.write(`
  corpus       : ${brut.regles.length} règles · ${JSON.stringify(parCategorie)}
  grille       : ${PAYS_RELIABLES.length} pays reliables · ${passes} passes du moteur · aucun échantillon
  atteignent   : ${PUBLIABLES.length} règles, toutes ${[...new Set(PUBLIABLES.map((r) => r.category))].join("/")} · ${JAMAIS.length} n'atteignent jamais un lecteur
  non atteintes: ${importNonAtteintes.length} règles d'importation, motif lisible pour chacune
  langues      : ${JSON.stringify(parLangue)}
  repli        : ${importeursEntityPage.length} importeur · ${cieSansFiche.length} compagnie(s) sans fiche · ${paysSansGuide.length} pays sans guide · ${pagesDuRepli}/${pagesHtml.length} pages rendues par le repli
  sources      : publiées ${autoPubliees.length}/${PUBLIABLES.length} auto-citées · tues ${autoJamais.length}/${JAMAIS.length} auto-citées
`);

for (const chemin of Object.values(RAW)) {
  if (sha256(readFileSync(chemin)) !== sha256(auCommit(chemin))) {
    process.stderr.write(`[t0b3e] ÉCHEC — ${chemin} a été MODIFIÉ pendant la mesure.\n`);
    process.exit(1);
  }
}
process.stdout.write(echecs === 0
  ? "[t0b3e] toutes les exigences sont tenues.\n"
  : `[t0b3e] ÉCHEC — ${echecs} exigence(s) non tenue(s)\n`);
process.exit(echecs === 0 ? 0 : 1);
