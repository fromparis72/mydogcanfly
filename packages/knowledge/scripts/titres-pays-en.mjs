#!/usr/bin/env node
/* Le titre anglais des 140 fiches pays : dire ce qu'on cherche, avec les mots qu'on tape.
 *
 * CE QUI N'ALLAIT PAS. « Traveling to Angola With Your Dog: Entry Requirements (2026) » a deux
 * défauts, et le second est le pire.
 *
 * Le mot « pet » n'y figure pas. En anglais ce n'est pas un synonyme de « dog » mais un second
 * terme de recherche, celui des autorités : l'USDA classe toute sa section sous « Pet Travel ».
 * Un titre qui porte les deux capte deux familles de requêtes au lieu d'une.
 *
 * Et « Entry » consomme 18 caractères avec « Requirements » pour un mot que personne ne tape.
 * Les requêtes réelles sont des ACTIONS — « taking my dog to Japan », « traveling to Italy with
 * a dog » — jamais des formalités. Le mot payait cher une place qu'il ne méritait pas.
 *
 * LA PLACE, JUSTEMENT. Les 140 titres étaient plafonnés à 65 caractères et 80 dépassaient 60.
 * Google coupe vers 55-60 : pour plus de la moitié des fiches, la fin du titre n'était tout
 * simplement pas affichée. Raccourcir n'est donc pas une coquetterie, c'est rendre visible ce
 * qui était écrit pour rien.
 *
 * LA NOUVELLE FORME, et sa cascade. On vise 58 caractères. Quand le nom du pays fait déborder,
 * on retire dans l'ordre ce qui coûte le plus et rapporte le moins :
 *
 *   1. Taking Your Dog to {X}: Pet Travel Requirements 2026
 *   2. …sans l'année — c'est la première chose qui saute, comme convenu avec Philippe
 *   3. …« Rules » au lieu de « Requirements », sept caractères de moins, même promesse
 *   4. {X}: Dog & Pet Travel Rules — le pays passe en tête, le verbe disparaît. Deux fiches.
 *
 * L'ARTICLE. Douze pays ne se disent pas sans « the » : on va « to the Netherlands », « to the
 * United States », « to the Bahamas ». Sans cette règle, le titre le plus visible du site serait
 * agrammatical sur douze fiches — exactement la faute du « à aéroport de Manchester » d'hier.
 * Les noms qui portent déjà l'article en capitale (« The Bahamas ») le voient passer en bas de
 * casse : il est au milieu de la phrase, plus en tête.
 *
 * SEUL L'ANGLAIS EST TOUCHÉ. Le français, l'espagnol et le portugais gardent leurs titres : la
 * dualité dog/pet est un fait de la langue anglaise, et « animal de compagnie » n'apporte rien
 * face à « chien ».
 *
 * Rejouable : un titre déjà à la nouvelle forme est laissé intact.
 *
 *   node packages/knowledge/scripts/titres-pays-en.mjs [--dry]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", "content", "countries");
const dry = process.argv.includes("--dry");

/* Deux seuils, et non un seul.
 *
 * CONFORT (58) est la cible : Google mesure des pixels et non des caractères, une majuscule ou
 * un « W » comptant plus large qu'un « i ». Deux caractères de marge sur les 60 usuels absorbent
 * l'écart sans rien coûter.
 *
 * LIMITE (60) est la tolérance accordée AVANT de renoncer à la forme de phrase. Sans elle,
 * « Dominican Republic » et « Bosnia and Herzegovina » basculaient sur le gabarit-étiquette pour
 * UN caractère de trop — et perdaient le verbe d'action, qui est tout l'objet de la refonte.
 * Deux caractères valent moins qu'une phrase : on les concède. */
const CONFORT = 58;
const LIMITE = 60;

/* Les noms qui réclament « the ». Établie en listant les 140 noms anglais du corpus, pas au
 * jugé : douze pays, et aucun autre. Les motifs valent mieux qu'une liste en dur — le jour où
 * une fiche « Marshall Islands » entrera, elle sera traitée sans qu'on y pense. */
const ARTICLE = /^The\s|^United\s|^(UK|USA|UAE)$|Republic|Netherlands|Philippines|Maldives|Seychelles|Comoros|Bahamas|Gambia|Islands?$|Emirates$/;

/* Le nom court, POUR LE TITRE SEUL — la fiche continue d'appeler le pays par son nom complet.
 *
 * Personne ne tape « traveling to the United States with a dog » : on tape « USA », « UK »,
 * « UAE ». Un titre doit parler la langue de la requête, et ces cinq abréviations sont non
 * ambiguës et universellement lues. Elles rendent en prime de la place : les Émirats et la RDC
 * passaient au gabarit-étiquette faute de caractères, le Royaume-Uni et les États-Unis perdaient
 * la date. Avec leur nom court, tous les cinq retrouvent la phrase complète.
 *
 * « Congo-Brazzaville » n'est pas une abréviation mais le nom d'usage qui DISTINGUE les deux
 * Congo — un lecteur qui lit « Republic of the Congo » ne sait pas lequel des deux il a devant
 * lui. Ici, le nom court est aussi le nom clair.
 *
 * Les autres noms longs restent entiers : « Bosnia » pour « Bosnia and Herzegovina » serait
 * inexact, et rien n'abrège « Trinidad and Tobago » ni « Dominican Republic ». */
const COURT = {
  "United States": "USA",
  "United Kingdom": "UK",
  "United Arab Emirates": "UAE",
  "Democratic Republic of the Congo": "DR Congo",
  "Republic of the Congo": "Congo-Brazzaville",
};

/** « The Bahamas » → « the Bahamas » ; « Netherlands » → « the Netherlands ». */
function avecArticle(nom) {
  const n = COURT[nom] ?? nom;
  if (/^The\s/.test(n)) return "the " + n.slice(4);
  /* L'article suit le nom réellement employé : « the UAE » oui, « DR Congo » non — le motif est
   * donc testé sur la forme courte, pas sur le nom d'origine. */
  return ARTICLE.test(n) ? "the " + n : n;
}

const ECHELONS = [
  (x, a) => `Taking Your Dog to ${a}: Pet Travel Requirements 2026`,
  (x, a) => `Taking Your Dog to ${a}: Pet Travel Requirements`,
  (x, a) => `Taking Your Dog to ${a}: Pet Travel Rules`,
  (x, a) => `${(COURT[x] ?? x)}: Dog & Pet Travel Rules`,
];

function titre(nom) {
  const a = avecArticle(nom);
  /* Les trois formes de phrase, essayées à la cible. */
  for (let i = 0; i < 3; i++) {
    const t = ECHELONS[i](nom, a);
    if (t.length <= CONFORT) return { t, echelon: i + 1 };
  }
  /* La plus courte des trois, réessayée à la tolérance : mieux vaut deux caractères de trop
   * qu'un titre qui ne dit plus ce qu'on y fait. */
  const court = ECHELONS[2](nom, a);
  if (court.length <= LIMITE) return { t: court, echelon: 3 };
  return { t: ECHELONS[3](nom, a), echelon: 4 };
}

const compte = [0, 0, 0, 0];
let ecrits = 0, deja = 0;
const journal = [];

for (const f of readdirSync(SRC).filter((x) => x.endsWith(".yml") && !/^[_.]/.test(x))) {
  const chemin = join(SRC, f);
  const texte = readFileSync(chemin, "utf-8");
  const g = YAML.parse(texte);
  const ancien = g?.seo?.metaTitle?.en;
  if (!ancien) { console.error(`✗ ${f} — pas de seo.metaTitle.en`); process.exitCode = 1; continue; }

  const { t, echelon } = titre(g.name.en);
  compte[echelon - 1]++;
  if (ancien === t) { deja++; continue; }

  /* Remplacement dans le texte source, pas via un sérialiseur : le YAML de ces fiches est écrit
   * à la main sur des milliers de lignes, et un `YAML.stringify` réécrirait guillemets, ordre
   * des clés et retours à la ligne partout. On ne touche qu'à la valeur de `metaTitle.en`. */
  const echap = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const motif = new RegExp(`(metaTitle:\\s*\\{\\s*en:\\s*)"${echap(ancien)}"`);
  if (!motif.test(texte)) {
    console.error(`✗ ${f} — le titre anglais n'est pas à l'endroit attendu, rien n'est écrit.`);
    process.exitCode = 1;
    continue;
  }
  if (!dry) writeFileSync(chemin, texte.replace(motif, `$1"${t}"`));
  ecrits++;
  journal.push(`${String(t.length).padStart(2)}  [${echelon}]  ${t}`);
}

console.log(journal.sort().join("\n"));
console.log(`\n${ecrits} titre(s) réécrit(s)${deja ? `, ${deja} déjà à la bonne forme` : ""}${dry ? " — essai à blanc" : ""}`);
console.log(`échelons : ${compte[0]} avec la date · ${compte[1]} sans la date · ${compte[2]} en « Rules » · ${compte[3]} pays en tête`);
console.log(`le plus long : ${Math.max(...journal.map((l) => Number(l.slice(0, 2))))} caractères`);
