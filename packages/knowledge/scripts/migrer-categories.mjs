#!/usr/bin/env node
/**
 * migrer-categories.mjs — `categories: [libellé, …]` devient `category: "<clé>"`.
 *
 * POURQUOI. La pastille du Travel Hub affichait `g.data.categories[0]`, c'est-à-dire la donnée
 * brute du guide. Or cette donnée était traduite dans les 62 guides français importés
 * (« Voyager ») et pas dans les 10 nés du lot 2 (« Travel ») : l'index français montrait CINQ
 * rubriques pour quatre thèmes, 10 + 10 au lieu de 20. En espagnol et en portugais, aucun
 * libellé n'avait jamais été traduit — les pastilles disaient « Gear », « Health »,
 * « Destinations » sur des pages hispanophones et lusophones.
 *
 * La faute n'est pas la traduction manquante, c'est la CONFUSION DES RÔLES : un libellé
 * d'affichage servait d'identifiant de regroupement. Quatre langues, quatre identités pour un
 * même thème, et rien qui puisse vérifier qu'elles se correspondent. Traduire les valeurs
 * aurait aggravé le mal ; il faut les dé-traduire et déplacer le libellé dans les traductions.
 *
 * CE QUE FAIT CE SCRIPT, et rien d'autre : il remplace la ligne `categories:` par une ligne
 * `category:` portant la clé canonique. Il ne touche à aucune autre ligne, jamais.
 *
 * IL ÉCHOUE FERMÉ. Une valeur absente de `CANONIQUE` arrête tout, sans rien écrire : mieux vaut
 * une migration qui refuse de deviner qu'une migration qui range au hasard. Même chose pour un
 * fichier sans ligne `categories:` ni ligne `category:`.
 *
 * IDEMPOTENT. Un fichier portant déjà `category:` est compté et laissé tel quel. Relancer le
 * script sur un dépôt migré ne produit aucune écriture.
 *
 * LA SECONDE CATÉGORIE EST ABANDONNÉE, DÉLIBÉRÉMENT. Un seul article — `flying-with-a-dog-
 * cabin-hold-cargo`, présent dans les quatre langues — portait `["Travel", "Airlines"]`. Cette
 * seconde valeur n'a JAMAIS été affichée : le hub ne lisait que la première. Elle n'est donc
 * pas une cinquième rubrique qu'on supprimerait, c'est une donnée morte. Son information
 * survit dans les `tags` du même article (`avion`, `cabine`, `soute`, `fret`), qui eux sont
 * rendus. Le script la NOMME au lieu de la faire disparaître en silence.
 *
 *   node packages/knowledge/scripts/migrer-categories.mjs --dry   inspection, aucune écriture
 *   node packages/knowledge/scripts/migrer-categories.mjs         migration
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RACINE = "packages/ui/src/content/guides";
const LANGUES = ["en", "fr", "es", "pt"];

/* La table canonique n'est PAS recopiée ici : elle vit dans `lib/categories-guides.mjs`, lue
 * aussi par le script d'import. Une correspondance écrite à deux endroits finit par diverger —
 * et celle-là a déjà divergé une fois, entre les guides importés et les guides traduits. */
import { CLES, CANONIQUE, ABANDONNEES } from "./lib/categories-guides.mjs";

const DRY = process.argv.includes("--dry");
const inconnus = process.argv.slice(2).filter((a) => a !== "--dry");
if (inconnus.length > 0) {
  process.stderr.write(`[migrer-categories] Argument(s) non reconnu(s) : ${inconnus.join(", ")}\n`);
  process.exit(2);
}

const log = (m) => process.stdout.write(`${m}\n`);

/** Les chaînes d'un tableau inline `["a", "b"]`. */
const valeurs = (ligne) => [...ligne.matchAll(/"([^"]*)"/g)].map((m) => m[1]);

let migres = 0, deja = 0;
const parLangue = new Map();
const abandons = [];
const erreurs = [];

for (const langue of LANGUES) {
  const dossier = join(RACINE, langue);
  const compte = new Map(CLES.map((k) => [k, 0]));
  for (const nom of readdirSync(dossier).filter((f) => f.endsWith(".md")).sort()) {
    const chemin = join(dossier, nom);
    const texte = readFileSync(chemin, "utf-8");

    const dejaMigre = /^category:\s*"([^"]*)"\s*$/m.exec(texte);
    if (dejaMigre) {
      if (!CLES.includes(dejaMigre[1])) {
        erreurs.push(`${chemin} : déjà migré mais clé inconnue « ${dejaMigre[1]} »`);
        continue;
      }
      compte.set(dejaMigre[1], compte.get(dejaMigre[1]) + 1);
      deja++;
      continue;
    }

    const ligne = /^categories:.*$/m.exec(texte);
    if (!ligne) {
      erreurs.push(`${chemin} : ni « categories: » ni « category: » — fichier non reconnu`);
      continue;
    }

    const vals = valeurs(ligne[0]);
    if (vals.length === 0) {
      erreurs.push(`${chemin} : « categories: » sans aucune valeur`);
      continue;
    }

    const cle = CANONIQUE.get(vals[0]);
    if (!cle) {
      erreurs.push(`${chemin} : première catégorie « ${vals[0] }» absente de la table canonique`);
      continue;
    }

    for (const reste of vals.slice(1)) {
      if (!ABANDONNEES.has(reste)) {
        erreurs.push(`${chemin} : seconde catégorie « ${reste} » ni canonique ni déclarée abandonnée`);
        continue;
      }
      abandons.push(`${langue}/${nom} : « ${reste} » (jamais affichée ; information portée par les tags)`);
    }

    if (!DRY) writeFileSync(chemin, texte.replace(ligne[0], `category: "${cle}"`));
    compte.set(cle, compte.get(cle) + 1);
    migres++;
  }
  parLangue.set(langue, compte);
}

if (erreurs.length > 0) {
  process.stderr.write(`\n[migrer-categories] ARRÊT — ${erreurs.length} fichier(s) non traitable(s), RIEN n'a été écrit pour eux :\n`);
  for (const e of erreurs) process.stderr.write(`  ${e}\n`);
  process.exit(1);
}

log(`${DRY ? "[à blanc] " : ""}${migres} fichier(s) migré(s) · ${deja} déjà au format « category: »`);
log("");
log("Répartition par langue :");
const entete = ["langue", ...CLES, "total"];
log("  " + entete.map((s) => s.padEnd(14)).join(""));
for (const langue of LANGUES) {
  const c = parLangue.get(langue);
  const total = CLES.reduce((s, k) => s + c.get(k), 0);
  log("  " + [langue, ...CLES.map((k) => String(c.get(k))), String(total)].map((s) => s.padEnd(14)).join(""));
}

/* L'IDENTITÉ ENTRE LANGUES est la propriété qui manquait, et c'est elle qu'on affiche : quatre
 * langues doivent exposer le MÊME ensemble de clés avec les MÊMES effectifs. Un écart ici est
 * exactement le défaut que la contre-revue navigateur a trouvé à l'œil. */
const signature = (langue) => CLES.map((k) => `${k}:${parLangue.get(langue).get(k)}`).join(" ");
const refs = LANGUES.map(signature);
const identiques = refs.every((s) => s === refs[0]);
log("");
log(identiques
  ? `Les quatre langues exposent la même signature — ${refs[0]}`
  : `ÉCART ENTRE LANGUES :\n${LANGUES.map((l, i) => `  ${l} → ${refs[i]}`).join("\n")}`);

if (abandons.length > 0) {
  log("");
  log(`Secondes catégories abandonnées (${abandons.length}), nommées une à une :`);
  for (const a of abandons) log(`  ${a}`);
}

if (!identiques) process.exit(1);
