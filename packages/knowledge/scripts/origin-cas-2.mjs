#!/usr/bin/env node
/* Les grilles d'origine que les fiches énoncent elles-mêmes, en toutes lettres.
 *
 * Dix-sept fiches n'affichaient aucun paragraphe de tête : leur pays classe le monde à sa façon
 * — groupes, catégories, annexes — et le moteur n'avait rien pour désigner le bon cas. Aller
 * chercher la liste officielle de chacune est un travail de dossier, pays par pays.
 *
 * Mais avant d'aller la chercher, il fallait lire ce que les fiches disaient déjà. Cinq d'entre
 * elles ÉNUMÈRENT leur liste au complet dans le corps du cas :
 *
 *   jp  « From Iceland, Australia, New Zealand, Fiji, Hawaii or Guam… »
 *   tw  « (Japan, United Kingdom, Australia, New Zealand, Singapore, Sweden, Iceland, Norway
 *        excluding Svalbard, Estonia, Czech Republic, and Hawaii and Guam) »
 *   my  « (United Kingdom, Eire, Northern Ireland, New Zealand, Japan, Sweden, Brunei,
 *        Singapore and Australia) »
 *   sg  « Schedule I countries (Australia, New Zealand, Ireland, United Kingdom) »
 *   au  « Group 1 covers New Zealand, Norfolk Island and Cocos (Keeling) Islands »
 *
 * Ces listes sont FERMÉES — pas de « such as », pas de « and others » — et sourcées par la fiche
 * qui les porte. Les transcrire en codes pays n'ajoute donc aucune affirmation : c'est le même
 * fait, écrit une seconde fois dans une forme que la machine sait lire.
 *
 * LES LISTES OUVERTES SONT LAISSÉES DE CÔTÉ. Le groupe 2 australien dit « such as Japan,
 * Singapore, Hawaii, Fiji and others », le Schedule II singapourien « most of the EU, USA,
 * Canada… and others », la catégorie 1 islandaise « e.g. most EU/EEA states ». Un « e.g. » n'est
 * pas une liste : le compléter de mémoire reviendrait à inventer la frontière d'un classement
 * étranger. Ces cas restent des remarques jusqu'à ce qu'on relève la liste chez l'autorité.
 *
 * HAWAÏ ET GUAM NE SONT PAS LES ÉTATS-UNIS. Trois de ces cinq listes citent Hawaï et Guam parmi
 * les origines indemnes de rage — pas les États-Unis continentaux. Le moteur ne connaît que le
 * pays de départ : y écrire `us` classerait un départ de Chicago comme indemne de rage, ce qui
 * est faux et coûteux, puisque ces régimes-là dispensent du titrage et de la quarantaine. Les
 * deux territoires sont donc omis, et un voyageur parti de Honolulu lira le régime le plus
 * strict — une exigence de trop plutôt qu'une de moins.
 *
 * Rejouable : un cas déjà qualifié n'est pas réécrit.
 *
 *   node packages/knowledge/scripts/origin-cas-2.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", "content", "countries");
const dry = process.argv.includes("--dry");

/* Japon — régions désignées (indemnes de rage), art. 3 de la loi sur la rage. Liste fermée. */
const JP_DESIGNEES = ["is", "au", "nz", "fj"];
/* Taïwan — pays/zones reconnus indemnes de rage. Liste fermée ; « Norway excluding Svalbard »
 * est rendu par `no`, notre grain d'analyse étant le pays. */
const TW_INDEMNES = ["jp", "gb", "au", "nz", "sg", "se", "is", "no", "ee", "cz"];

const TABLE = {
  // Japon : les désignées, et tout le reste en creux — la fiche dit « from every other country ».
  jp: { eu: JP_DESIGNEES, listed: { sauf: JP_DESIGNEES } },
  // Taïwan : idem, la fiche dit « most of the world is classified as rabies-infected ».
  tw: { eu: TW_INDEMNES, listed: { sauf: TW_INDEMNES } },
  /* Malaisie : la liste « scheduled rabies-free » est fermée. Son complément, lui, se partage
   * entre « autres pays autorisés » et « pays à risque rabique » — deux cas que la fiche ne
   * permet pas de départager. Seul le premier est donc qualifié. */
  my: { eu: ["gb", "ie", "nz", "jp", "se", "bn", "sg", "au"] },
  // Singapour : Schedule I est fermé ; Schedule II dit « and others » et reste une remarque.
  sg: { eu: ["au", "nz", "ie", "gb"] },
  // Australie : le groupe 1 est fermé ; les groupes 2 et 3 disent « and many more ».
  au: { eu: ["nz", "nf", "cc"] },
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

    /* Ancré sur `origin:` — jamais sur la première clé du nom voulu dans le fichier, qui se
     * trouverait dans `prepTime` deux cents lignes plus haut. */
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

console.log(`${poses} cas qualifié(s) dans ${Object.keys(TABLE).length} fiches` +
  `${deja ? `, ${deja} déjà fait(s)` : ""}${dry ? " — essai à blanc" : ""}`);
