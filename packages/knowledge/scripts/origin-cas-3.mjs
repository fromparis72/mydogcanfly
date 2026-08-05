#!/usr/bin/env node
/* Les grilles d'origine relevées chez l'autorité du pays d'arrivée.
 *
 * Douze fiches n'affichaient aucun paragraphe de tête parce que leur pays classe le monde selon
 * une liste qu'il publie lui-même. Contrairement aux cinq fiches traitées par `origin-cas-2.mjs`,
 * celles-ci n'énoncent pas la liste dans leur propre texte : il faut aller la chercher.
 *
 * Chaque liste inscrite ici a donc été RELEVÉE SUR LA SOURCE OFFICIELLE, à la date indiquée, et
 * jamais reconstituée. C'est la même discipline que pour Hong Kong (AFCD) et les États-Unis (CDC)
 * ce matin : une liste qu'on ne peut pas citer est une liste qu'on n'écrit pas.
 *
 *   node packages/knowledge/scripts/origin-cas-3.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", "content", "countries");
const dry = process.argv.includes("--dry");

/* FIDJI — Biosecurity Authority of Fiji, « Biosecurity notice on bringing in cats and dogs into
 * Fiji », avis du 25 septembre 2024, relevé le 03/08/2026 :
 * https://baf.com.fj/wp-content/uploads/2024/10/BAF-Notice-for-BRINGING-CATS-AND-DOGS-INTO-FIJI-Sep-2024.pdf
 *
 * Groupe A — pays indemnes de rage, quarantaine de 7 jours, ni vaccination ni titrage exigés.
 * L'avis les nomme un par un, sans « etc. » : la liste est close. */
const FJ_A = ["au", "as", "cx", "ck", "fm", "pf", "to", "ki", "mh", "nr", "nc", "nz", "nu",
  "pw", "pg", "ws", "sb", "tv", "vu", "wf"];

/* Groupe B — pays approuvés où la rage est présente mais maîtrisée : quarantaine de 30 jours,
 * vaccination antirabique et titrage RNATT/FAVN. Liste close également.
 * « United States of America (including Guam and Hawaii) » est rendu par `us`, notre grain
 * d'analyse étant le pays : ici, contrairement au Japon ou à Taïwan, les territoires sont dans
 * le MÊME groupe que le continent, donc le raccourci ne fausse rien. */
const FJ_B = ["ag", "aw", "ar", "at", "bs", "bh", "bb", "be", "bm", "bn", "bg", "ca", "ky", "cl",
  "hr", "cy", "cz", "dk", "ee", "fk", "fi", "fr", "de", "gi", "gr", "gl", "gg", "hk", "hu", "is",
  "ie", "im", "il", "it", "jm", "jp", "je", "kw", "lv", "li", "lt", "lu", "mo", "mt", "mc", "me",
  "nl", "mp", "no", "pl", "pt", "pr", "qa", "re", "kn", "lc", "vc", "rs", "sc", "sg", "sk", "si",
  "za", "kr", "es", "se", "ch", "tw", "tt", "ae", "gb", "us", "uy", "vg", "vi"];

/* ISLANDE — MAST, « Import of live animals », page mise à jour le 19/05/2026, relevée le
 * 03/08/2026 : https://www.mast.is/en/import-export/import-of-live-animals
 *
 * Catégorie 1 — pays indemnes de rage. La fiche disait « e.g. most EU/EEA states, UK, Japan… » ;
 * ce « e.g. » m'avait fait la classer non exploitable, à tort : MAST publie bien la liste entière.
 * « Norway (excluding Svalbard) » est rendu par `no`, notre grain d'analyse étant le pays. */
const IS_CAT1 = ["au", "at", "be", "bg", "hr", "cy", "cz", "dk", "ee", "fo", "fi", "fr", "de",
  "gr", "ie", "it", "jp", "lv", "li", "lt", "lu", "mt", "nl", "no", "pt", "sg", "si", "es",
  "se", "ch", "ae", "gb"];
/* Catégorie 2 — rage présente mais maîtrisée : mêmes étapes, plus 90 jours d'attente après le
 * titrage. Onze pays, liste close. */
const IS_CAT2 = ["ba", "ca", "gl", "hu", "pl", "ro", "rs", "sk", "tw", "tr", "us"];

/* ÉMIRATS ARABES UNIS — MOCCAE, « Import of pets (cats / dogs) », rubrique « List of low-risk
 * countries », relevée le 03/08/2026 :
 * https://www.moccae.gov.ae/en/services/import-permit-pets
 *
 * ATTENTION À LA SOURCE. La fiche citait jusqu'ici la page « List of approved countries for
 * importing live animals » — qui, vérification faite dans le navigateur, ne couvre QUE les
 * moutons, chèvres, bovins, chameaux, volailles et œufs à couver. Les chiens et les chats n'y
 * figurent pas. La liste qui les concerne est ailleurs, sur la page du permis d'importation
 * d'animaux de compagnie, et c'est celle-ci. La source de la fiche est donc à corriger.
 *
 * Cinquante et un pays et territoires. « Spain (excluding Melilla and Ceuta) » est rendu par `es`,
 * notre grain d'analyse étant le pays, et les deux enclaves n'ayant pas de code propre. */
const AE_FAIBLE_RISQUE = ["au", "at", "ad", "bh", "bb", "be", "cz", "dk", "ee", "fj", "fi", "pf",
  "fk", "hk", "is", "ie", "jm", "jp", "kw", "li", "mu", "mt", "nc", "nz", "pt", "sg", "sm", "se",
  "ch", "gb", "vu", "nl", "bg", "si", "pw", "lv", "al", "hr", "mv", "es", "cy", "kr", "me", "sc",
  "sr", "fm", "gr", "mh", "bs", "lt", "mk"];

const TABLE = {
  /* Le troisième cas fidjien — « ni groupe A ni groupe B : pas d'import direct possible » — est
   * exactement le complément des deux listes. C'est le seul des trois qui annonce une mauvaise
   * nouvelle, et c'est donc celui qu'il faut surtout ne pas afficher à tort. */
  fj: { eu: FJ_A, listed: FJ_B, nonListed: { sauf: [...FJ_A, ...FJ_B] } },
  /* Le troisième cas islandais — « pays non approuvé : entrée réservée aux résidents qui
   * déménagent » — est le complément des deux catégories. C'est un refus assorti d'une
   * exception étroite : raison de plus pour ne l'afficher qu'à qui il s'adresse. */
  is: { eu: IS_CAT1, listed: IS_CAT2, nonListed: { sauf: [...IS_CAT1, ...IS_CAT2] } },
  /* ÉMIRATS — DÉLIBÉRÉMENT LAISSÉS DE CÔTÉ, malgré la liste relevée ci-dessus.
   *
   * Telle que lue, elle ne contient ni la France, ni l'Allemagne, ni l'Italie, ni la Pologne,
   * alors qu'elle contient l'Autriche, la Belgique, l'Espagne, le Portugal et les pays nordiques.
   * Ce n'est pas impossible — ces listes nationales sont idiosyncrasiques — mais l'extraction
   * portait aussi une scorie (« Caledonia. New Zealand » au lieu de « New Caledonia, New
   * Zealand »), signe que le rendu du texte n'est pas fidèle. Je ne peux donc pas jurer que la
   * liste est complète.
   *
   * Et l'enjeu n'est pas neutre : classer la France en « haut risque » ferait annoncer un titrage
   * antirabique à un voyageur parisien — plusieurs mois de délai et plusieurs centaines d'euros.
   * Une exigence inventée coûte ici bien plus cher qu'une case laissée vide. La fiche reste donc
   * muette jusqu'à une seconde lecture de la page.
   *
   * ae: { eu: AE_FAIBLE_RISQUE, listed: { sauf: AE_FAIBLE_RISQUE } },
   */
};

let poses = 0, deja = 0;

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

    const lignes = texte.split("\n");
    const debut = lignes.findIndex((l) => /^origin:\s*$/.test(l));
    if (debut < 0) { console.error(`✗ ${c}.yml — bloc « origin: » introuvable`); process.exitCode = 1; continue; }
    const rel = lignes.slice(debut + 1).findIndex((l) => new RegExp(`^\\s{2}${cle}:\\s*$`).test(l));
    if (rel < 0) { console.error(`✗ ${c}.yml — case « ${cle} » introuvable`); process.exitCode = 1; continue; }
    const i = debut + 1 + rel;
    const indent = (lignes[i + 1].match(/^(\s+)/) ?? [, "    "])[1];
    lignes.splice(i + 1, 0, `${indent}${nom}: [${liste.join(", ")}]`);
    texte = lignes.join("\n");
    poses++;
  }
  if (!dry) writeFileSync(chemin, texte);
}

console.log(`${poses} cas qualifié(s) dans ${Object.keys(TABLE).length} fiche(s)` +
  `${deja ? `, ${deja} déjà fait(s)` : ""}${dry ? " — essai à blanc" : ""}`);
