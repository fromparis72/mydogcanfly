#!/usr/bin/env node
/* Rendre lisible par la machine la condition d'origine déjà écrite dans les puces d'arrivée.
 *
 * LE DÉFAUT. La fiche de voyage (tools/fiche.astro) connaît parfaitement le pays de départ :
 * l'étape 1 dit « au départ des États-Unis », l'étape 4 « au retour aux États-Unis ». Mais les
 * puces de `arrival.points` sont du texte plat, et la condition d'origine n'y vit que dans la
 * phrase : « From another EU country: … » est une chaîne comme une autre. Le moteur les affiche
 * donc toutes, et un voyageur parti de Chicago lit à l'étape 2 la règle intra-UE qui ne le
 * concerne pas. Ce n'est pas une erreur de contenu, c'est une information non justifiée — et
 * une information non justifiée, sur une page qui doit rassurer, se lit comme de la confusion.
 *
 * LA RÉPARATION. On n'écrit rien de neuf : on qualifie l'existant. Une clé `from` est posée à
 * côté des quatre langues, et elle seule. Le texte n'est pas touché, aucune traduction n'est à
 * refaire, et une puce sans `from` continue de s'afficher partout — la migration est donc
 * incrémentale et ne peut rien casser.
 *
 *   from: eu       la puce ne vaut qu'au départ de l'UE / EEE / Suisse
 *   from: non_eu   la puce ne vaut qu'au départ d'ailleurs
 *
 * CE QUE CE SCRIPT TAGUE, ET RIEN D'AUTRE. Les deux motifs réguliers, ceux qui font plus de la
 * moitié du bruit : « From another EU country » / « From the EU » d'un côté, « From outside the
 * EU » / « From a third country » de l'autre. Les cas isolés — « From the US or Canada » au
 * Mexique, les groupes de Hong Kong, les catégories néo-zélandaises — sont VOLONTAIREMENT
 * laissés de côté : chacun a sa propre grille, et une grille par pays ne se devine pas au
 * gabarit. Ils feront une seconde passe, à la main.
 *
 * LA DÉTECTION SE FAIT SUR L'ANGLAIS, qui est la langue de référence des fiches, et le tag vaut
 * pour les quatre langues d'un coup puisqu'il porte sur la puce et non sur une traduction. Un
 * contrôle de concordance vérifie tout de même que le français dit bien la même condition : si
 * l'anglais annonce l'UE et que le français n'en parle pas, la puce est signalée et NON taguée.
 *
 * ÉCRITURE EN TEXTE, PAS EN YAML REPARSÉ : réécrire les 141 fichiers via un sérialiseur
 * reformaterait guillemets, retours à la ligne et ordre des clés sur des milliers de lignes que
 * personne n'a demandé de changer. On insère une ligne, à l'indentation de la puce, et c'est tout.
 *
 * Rejouable : une puce qui porte déjà un `from` est laissée intacte.
 *
 *   node packages/knowledge/scripts/tag-arrival-origin.mjs [--dry]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", "content", "countries");
const dry = process.argv.includes("--dry");

/* « From another EU country », « From an EU/EFTA country », « From the EU », « From the EU/EEA
 * or Switzerland ». Ancré au début de la puce : une mention de l'UE au milieu d'une phrase est
 * une précision, pas une condition d'entrée. */
const EU = /^\s*(From|Coming from)\s+(another\s+EU|an?\s+EU|the\s+EU|the\s+European\s+Union)/i;
/* « From outside the EU », « From a third country », « From a non-EU country ». */
const NON_EU = /^\s*From\s+(outside|a\s+third\s+country|a\s+non-EU)/i;

/* Concordance : le français doit porter la même condition que l'anglais. Sans ce garde-fou, une
 * traduction qui aurait dérivé ferait replier au voyageur francophone une puce qui le concerne. */
const FR_EU = /^\s*(depuis|de)\s+(un autre pays de l'UE|l'UE|un pays UE)/i;
const FR_NON_EU = /^\s*depuis\s+(hors\s+UE|un pays\s+(hors\s+UE|tiers)|l'extérieur)/i;

const fichiers = readdirSync(SRC).filter((f) => f.endsWith(".yml") && !/^[_.]/.test(f));
let poses = 0, deja = 0, ecartes = 0, fichiersTouches = 0;

for (const nom of fichiers) {
  const chemin = join(SRC, nom);
  let texte = readFileSync(chemin, "utf-8");
  const guide = YAML.parse(texte);
  const points = guide?.arrival?.points ?? [];
  let modifie = false;

  for (const p of points) {
    const en = p.en ?? "";
    const tag = EU.test(en) ? "eu" : NON_EU.test(en) ? "non_eu" : null;
    if (!tag) continue;
    if (p.from) { deja++; continue; }

    const fr = p.fr ?? "";
    const concorde = tag === "eu" ? FR_EU.test(fr) : FR_NON_EU.test(fr);
    if (!concorde) {
      console.warn(`⚠ ${nom} — l'anglais annonce « ${tag} », le français ne le confirme pas :`);
      console.warn(`   en: ${en.slice(0, 90)}`);
      console.warn(`   fr: ${fr.slice(0, 90)}`);
      ecartes++;
      continue;
    }

    /* La puce est repérée dans le texte par sa ligne `- en: "…"`. Le YAML est régulier ici :
     * une puce commence toujours par sa clé `en`, sur une seule ligne, entre guillemets. */
    const ligne = texte.split("\n").find((l) => /^\s*- en: /.test(l) && l.includes(en.slice(0, 60)));
    if (!ligne) {
      console.error(`✗ ${nom} — puce introuvable dans le texte source, rien n'est écrit : ${en.slice(0, 60)}`);
      process.exitCode = 1;
      continue;
    }
    const indent = ligne.match(/^(\s*)- /)[1];
    const remplacement = `${indent}- from: ${tag}\n${indent}  ` + ligne.trim().replace(/^- /, "");
    texte = texte.replace(ligne, remplacement);
    modifie = true;
    poses++;
  }

  if (modifie) {
    fichiersTouches++;
    if (!dry) writeFileSync(chemin, texte);
  }
}

console.log(`\n${poses} puce(s) taguée(s) dans ${fichiersTouches} fiche(s)` +
  `${deja ? `, ${deja} déjà taguée(s)` : ""}${ecartes ? `, ${ecartes} écartée(s) pour discordance` : ""}` +
  `${dry ? " — essai à blanc" : ""}`);
