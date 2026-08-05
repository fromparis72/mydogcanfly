#!/usr/bin/env node
/* Qualifier les cas d'origine des 58 fiches qui ont leur propre grille.
 *
 * Le Mexique a montré le mécanisme : dès qu'une case porte `from` ou `from_except`, la fiche de
 * voyage désigne la bonne au lieu de se taire. Restaient 58 fiches muettes. Ce script les prend
 * une par une — pas au motif, pas au jugé : chaque ligne du tableau ci-dessous est une décision
 * prise en lisant les trois titres et les trois corps de la fiche.
 *
 * TROIS FAMILLES, et une règle par famille.
 *
 * 1. SIX FICHES CLASSÉES `own` À TORT. La Suisse, la Géorgie, le Liechtenstein, le Monténégro,
 *    la Macédoine du Nord et la Serbie suivent la grille européenne à la lettre — « A dog coming
 *    from an EU member state… », puis « certificat, sans prise de sang », puis « titrage + 3
 *    mois ». Le détecteur les avait manquées parce que leur titre dit « Simplified — pet
 *    passport » sans écrire « EU ». Elles repassent en `scheme: eu` : c'est une correction, pas
 *    une qualification, et elle rend à ces six fiches le paragraphe qu'elles savaient déjà choisir.
 *
 * 2. LE CAS GÉNÉRAL + DES REMARQUES. La majorité des pays n'ont pas de grille d'origine : leur
 *    première case est le cas courant, les deux autres parlent des chiots, du fret ou des papiers
 *    manquants. Cette case reçoit `from: any` — le cas qui s'applique à défaut d'un autre — et
 *    les remarques passent au repli, où elles étaient de toute façon à leur place.
 *
 * 3. UNE VRAIE GRILLE D'ORIGINE. Là il faut une liste, et une liste ne s'invente pas :
 *
 *    · l'UEEA (Arménie, Biélorussie, Kazakhstan, Kirghizistan, Russie) est un traité, pas une
 *      appréciation — chaque fiche membre nomme les quatre autres ;
 *    · « Arriving from the United States », « Category 1 — Australia » : la fiche NOMME le pays
 *      dans son propre titre, il n'y a rien à aller chercher ;
 *    · Hong Kong et les États-Unis reprennent les listes officielles relevées ce matin, AFCD et
 *      CDC, avec leur date.
 *
 *    Les autres — groupes australiens, régions désignées japonaises, annexes singapouriennes,
 *    listes émirienne, qatarie, sud-africaine, taïwanaise, malaisienne — demandent d'aller
 *    chercher la liste officielle chez l'autorité du pays. Elles restent muettes plutôt que
 *    devinées : une fiche sans paragraphe de tête n'apprend rien au lecteur, une fiche avec le
 *    mauvais paragraphe le trompe. Ses puces, elles, sont déjà triées.
 *
 * Rejouable : une case déjà qualifiée n'est pas réécrite.
 *
 *   node packages/knowledge/scripts/origin-cas.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", "content", "countries");
const dry = process.argv.includes("--dry");

/** Les six fiches à remettre en grille européenne. */
const SCHEME_EU = ["ch", "ge", "li", "me", "mk", "rs"];

/* Union économique eurasiatique : cinq États, par traité. Chaque fiche membre vise les autres. */
const UEEA = ["am", "by", "kz", "kg", "ru"];
const autresUEEA = (soi) => UEEA.filter((x) => x !== soi);

/* AFCD, groupes I et II réunis — relevé du 03/08/2026, même source que les puces de la fiche HK. */
const HK_I_II = ["au", "fj", "ie", "jp", "nz", "gb", "je", "at", "bh", "bm", "ca", "cy", "cz",
  "fi", "de", "gu", "it", "lu", "mt", "no", "pg", "sc", "sb", "es", "ch", "tw", "vu", "bs", "be",
  "bn", "ky", "dk", "fr", "gi", "is", "jm", "mv", "mu", "nc", "pt", "kr", "sg", "se", "nl", "us", "vg", "vi"];
/* Groupe IIIA, la liste courte publiée par l'AFCD (quarantaine de 30 jours). */
const HK_IIIA = ["cn", "hu", "lt", "mo", "my", "th"];

/* CDC, pays à haut risque de rage canine — relevé du 03/08/2026, même source que la fiche US. */
const CDC = ["af", "dz", "ao", "am", "az", "bd", "by", "bz", "bj", "bo", "bw", "br", "bn", "bf",
  "bi", "kh", "cm", "cf", "td", "cn", "co", "km", "ci", "cu", "cd", "dj", "do", "ec", "eg", "sv",
  "gq", "er", "sz", "et", "ga", "gm", "ge", "gh", "gt", "gn", "gw", "gy", "ht", "hn", "in", "id",
  "ir", "iq", "il", "jo", "kz", "ke", "kw", "kg", "la", "lb", "ls", "lr", "ly", "mg", "mw", "my",
  "ml", "mr", "md", "mn", "ma", "mz", "mm", "na", "np", "ne", "ng", "kp", "om", "pk", "pe", "ph",
  "qa", "cg", "ru", "rw", "st", "sn", "sl", "so", "za", "ss", "lk", "sd", "sr", "sy", "tj", "tz",
  "th", "tl", "tg", "tn", "tr", "tm", "ug", "ua", "ae", "uz", "ve", "vn", "ye", "zm", "zw"];

/* Le tableau. Une entrée par fiche, une clé par case : `eu`, `listed`, `nonListed` — les noms
 * historiques des trois emplacements, qui ne veulent plus rien dire ici que « première »,
 * « deuxième », « troisième ». Une case absente du tableau reste sans condition : elle devient
 * une remarque et part au repli. */
const TABLE = {
  // ── Cas général + remarques ────────────────────────────────────────────────────────────────
  ar: { eu: "any" }, bd: { eu: "any" }, br: { eu: "any" }, bs: { eu: "any" },
  co: { eu: "any" }, cr: { eu: "any" }, cu: { eu: "any" }, do: { eu: "any" },
  ec: { eu: "any" }, id: { eu: "any" }, il: { eu: "any" }, in: { eu: "any" },
  mu: { eu: "any" }, pa: { eu: "any" }, pe: { eu: "any" }, ph: { eu: "any" },
  py: { eu: "any" }, th: { eu: "any" }, tr: { eu: "any" }, uy: { eu: "any" },
  // Le cas courant n'est pas toujours le premier : au Canada, au Sri Lanka, au Pakistan et au
  // Koweït, la première case décrit une origine privilégiée et c'est la DEUXIÈME qui est
  // le régime ordinaire.
  ca: { listed: "any" }, kw: { listed: "any" }, lk: { listed: "any" }, pk: { listed: "any" },

  // ── Le pays est nommé par la fiche elle-même ───────────────────────────────────────────────
  // « Arriving from the United States » : quatre fiches d'Amérique centrale ont un protocole
  // bilatéral avec les États-Unis, et le disent dans leur titre.
  gt: { eu: "any", listed: ["us"] },
  hn: { eu: "any", listed: ["us"] },
  ni: { eu: "any", listed: ["us"] },
  sv: { eu: "any", listed: ["us"] },
  // « Category 1 — Australia (simplest) ». Les catégories 2 et 3 demandent la liste du MPI :
  // elles restent des remarques, et un voyageur venu d'Australie a désormais sa réponse.
  nz: { eu: ["au"] },

  // ── Traité : l'Union économique eurasiatique ───────────────────────────────────────────────
  am: { eu: autresUEEA("am"), listed: { sauf: autresUEEA("am") } },
  by: { eu: autresUEEA("by"), listed: { sauf: autresUEEA("by") } },
  kz: { eu: autresUEEA("kz"), listed: { sauf: autresUEEA("kz") } },
  ru: { eu: autresUEEA("ru"), listed: { sauf: autresUEEA("ru") } },

  // ── Listes officielles relevées ce matin ───────────────────────────────────────────────────
  hk: { eu: HK_I_II, listed: HK_IIIA, nonListed: { sauf: [...HK_I_II, ...HK_IIIA] } },
  // Aux États-Unis, seul le cas « pays indemne ou à faible risque » est décidable depuis le seul
  // pays de départ : les deux autres se distinguent par le LIEU DE VACCINATION du chien, que le
  // Finder ne connaît pas. Ils restent donc des remarques, et le repli les garde à un clic.
  us: { eu: { sauf: CDC } },
};

let poses = 0, deja = 0, schemes = 0;

/* Les six corrections de `scheme`. */
for (const c of SCHEME_EU) {
  const chemin = join(SRC, `${c}.yml`);
  const texte = readFileSync(chemin, "utf-8");
  if (!/^\s{2}scheme:\s*own\s*$/m.test(texte)) { deja++; continue; }
  if (!dry) writeFileSync(chemin, texte.replace(/^(\s{2})scheme:\s*own\s*$/m, "$1scheme: eu"));
  schemes++;
}

/* Les conditions. Insertion d'une ligne juste après la clé de la case, à son indentation. */
for (const [c, cas] of Object.entries(TABLE)) {
  const chemin = join(SRC, `${c}.yml`);
  let texte = readFileSync(chemin, "utf-8");
  const g = YAML.parse(texte);

  for (const [cle, valeur] of Object.entries(cas)) {
    const bloc = g.origin?.[cle];
    if (!bloc) { console.error(`✗ ${c}.yml — pas de origin.${cle}`); process.exitCode = 1; continue; }
    if (bloc.from || bloc.from_except) { deja++; continue; }

    const nom = valeur?.sauf ? "from_except" : "from";
    const liste = valeur?.sauf ?? valeur;
    const rendu = Array.isArray(liste) ? `[${liste.join(", ")}]` : liste;

    /* CHERCHER LA CASE À PARTIR DE `origin:`, ET SEULEMENT À PARTIR DE LÀ.
     *
     * Une première version cherchait la première ligne « eu: » du fichier. Elle tombait sur
     * `prepTime.eu`, qui porte le même nom deux cents lignes plus haut, et y écrivait la
     * condition : 90 lignes posées au mauvais endroit dans 35 fiches, des clés dupliquées, et
     * l'ingestion à terre. Le repère est donc pris APRÈS l'en-tête du bloc, jamais avant. */
    const lignes = texte.split("\n");
    const debut = lignes.findIndex((l) => /^origin:\s*$/.test(l));
    if (debut < 0) { console.error(`✗ ${c}.yml — bloc « origin: » introuvable.`); process.exitCode = 1; continue; }
    const rel = lignes.slice(debut + 1).findIndex((l) => new RegExp(`^\\s{2}${cle}:\\s*$`).test(l));
    const i = rel < 0 ? -1 : debut + 1 + rel;
    if (i < 0) { console.error(`✗ ${c}.yml — case « ${cle} » introuvable, rien n'est écrit.`); process.exitCode = 1; continue; }
    const indent = (lignes[i + 1].match(/^(\s+)/) ?? [, "    "])[1];
    lignes.splice(i + 1, 0, `${indent}${nom}: ${rendu}`);
    texte = lignes.join("\n");
    poses++;
  }
  if (!dry) writeFileSync(chemin, texte);
}

console.log(`${schemes} fiche(s) remise(s) en grille européenne`);
console.log(`${poses} cas qualifié(s) dans ${Object.keys(TABLE).length} fiches` +
  `${deja ? `, ${deja} déjà fait(s)` : ""}${dry ? " — essai à blanc" : ""}`);
