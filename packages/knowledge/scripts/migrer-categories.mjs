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
 * même thème, et rien qui puisse vérifier qu'elles se correspondent.
 *
 * CE QUE FAIT CE SCRIPT, et rien d'autre : il remplace la ligne `categories:` par une ligne
 * `category:` portant la clé canonique. Il ne touche à aucune autre ligne, jamais.
 *
 * IL EST ATOMIQUE — TOUT OU RIEN, et il ne l'était pas.
 *
 *   Première écriture : la validation et l'écriture se faisaient dans la MÊME boucle. Codex a
 *   placé une rubrique inconnue dans le dernier fichier portugais et lancé le script : sortie 1,
 *   comme prévu — mais 288 fichiers modifiés. Les 287 précédents avaient déjà été écrits, et
 *   seul le fautif ne l'était pas. Un dépôt à moitié migré, avec un code de sortie qui dit
 *   « échec » : l'état le plus difficile à rattraper, parce qu'on ne sait plus ce qui est fait.
 *
 *   Une migration qui refuse de deviner doit aussi refuser de commencer. Les 288 transformations
 *   sont donc TOUTES calculées et validées d'abord ; l'écriture n'a lieu que si le plan est
 *   entier. Un seul fichier douteux, et rien n'est écrit du tout.
 *
 * IDEMPOTENT. Un fichier portant déjà `category:` est compté et laissé tel quel. Relancer le
 * script sur un dépôt migré n'écrit rien — vérifié pour de vrai, sans `--dry`, dans un worktree
 * jetable, par `preuve-migration-categories.mjs`.
 *
 * LA SECONDE CATÉGORIE EST ABANDONNÉE, DÉLIBÉRÉMENT. Un seul article — `flying-with-a-dog-
 * cabin-hold-cargo`, présent dans les quatre langues — portait `["Travel", "Airlines"]`. Cette
 * seconde valeur n'a JAMAIS été rendue : le hub ne lit que la première. Elle n'est donc pas une
 * cinquième rubrique qu'on supprimerait, c'est une donnée morte. Son contenu reste dans les
 * `tags` du même article (`avion`, `cabine`, `soute`, `fret`) — DANS LES DONNÉES, et nulle part
 * à l'écran : aucun gabarit ne rend les `tags` aujourd'hui. Rien de VISIBLE n'est donc perdu,
 * mais il serait faux de dire que l'information « reste affichée ailleurs ». Le script la NOMME
 * au lieu de la faire disparaître en silence.
 *
 *   node packages/knowledge/scripts/migrer-categories.mjs --dry            inspection
 *   node packages/knowledge/scripts/migrer-categories.mjs                  migration
 *   node packages/knowledge/scripts/migrer-categories.mjs --racine=<dir>   sur un jeu d'essai
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/* La table canonique n'est PAS recopiée ici : elle vit dans `lib/categories-guides.mjs`, lue
 * aussi par le script d'import. Une correspondance écrite à deux endroits finit par diverger —
 * et celle-là a déjà divergé une fois, entre les guides importés et les guides traduits. */
import { CLES, CANONIQUE, ABANDONNEES } from "./lib/categories-guides.mjs";

const DEFAUT = "packages/ui/src/content/guides";
const LANGUES = ["en", "fr", "es", "pt"];

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
/* `--racine` sert au harnais de comportement : éprouver la migration sur un jeu d'essai jetable
 * plutôt que sur les 288 fichiers réels, qu'on ne peut pas casser pour voir ce qui se passe. */
const RACINE = (args.find((a) => a.startsWith("--racine=")) || `--racine=${DEFAUT}`).slice(9);
const inconnus = args.filter((a) => a !== "--dry" && !a.startsWith("--racine="));
if (inconnus.length > 0) {
  process.stderr.write(`[migrer-categories] Argument(s) non reconnu(s) : ${inconnus.join(", ")}\n`);
  process.stderr.write("[migrer-categories] Arguments acceptés : --dry, --racine=<dossier>\n");
  process.exit(2);
}

const log = (m) => process.stdout.write(`${m}\n`);

/** Les chaînes d'un tableau inline `["a", "b"]`. */
const valeurs = (ligne) => [...ligne.matchAll(/"([^"]*)"/g)].map((m) => m[1]);

/* ---- PHASE 1 : tout valider, ne rien écrire ------------------------------------------------ */
const plan = [];        // { chemin, texte, ligne, cle }
const deja = [];        // fichiers déjà au format cible
const abandons = [];
const erreurs = [];
const parLangue = new Map();

for (const langue of LANGUES) {
  const dossier = join(RACINE, langue);
  const compte = new Map(CLES.map((k) => [k, 0]));
  parLangue.set(langue, compte);
  if (!existsSync(dossier)) { erreurs.push(`${dossier} : dossier de langue absent`); continue; }

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
      deja.push(chemin);
      continue;
    }

    const ligne = /^categories:.*$/m.exec(texte);
    if (!ligne) { erreurs.push(`${chemin} : ni « categories: » ni « category: » — fichier non reconnu`); continue; }

    const vals = valeurs(ligne[0]);
    if (vals.length === 0) { erreurs.push(`${chemin} : « categories: » sans aucune valeur`); continue; }

    const cle = CANONIQUE.get(vals[0]);
    if (!cle) { erreurs.push(`${chemin} : première catégorie « ${vals[0]} » absente de la table canonique`); continue; }

    let secondeDouteuse = false;
    for (const reste of vals.slice(1)) {
      if (!ABANDONNEES.has(reste)) {
        erreurs.push(`${chemin} : seconde catégorie « ${reste} » ni canonique ni déclarée abandonnée`);
        secondeDouteuse = true;
      } else {
        abandons.push(`${langue}/${nom} : « ${reste} » (jamais rendue ; contenu conservé dans les tags du fichier)`);
      }
    }
    if (secondeDouteuse) continue;

    plan.push({ chemin, texte, ligne: ligne[0], cle });
    compte.set(cle, compte.get(cle) + 1);
  }
}

/* ---- ARRÊT AVANT TOUTE ÉCRITURE ------------------------------------------------------------ */
if (erreurs.length > 0) {
  process.stderr.write(
    `\n[migrer-categories] ARRÊT — ${erreurs.length} fichier(s) non traitable(s). ` +
    `AUCUN fichier n'a été écrit, pas même les ${plan.length} valides :\n`);
  for (const e of erreurs) process.stderr.write(`  ${e}\n`);
  process.stderr.write("\n[migrer-categories] Corrigez ces fichiers, puis relancez : la migration est tout ou rien.\n");
  process.exit(1);
}

/* ---- PHASE 2 : écrire le plan entier -------------------------------------------------------- */
if (!DRY) for (const { chemin, texte, ligne, cle } of plan) {
  writeFileSync(chemin, texte.replace(ligne, `category: "${cle}"`));
}

log(`${DRY ? "[à blanc] " : ""}${plan.length} fichier(s) migré(s) · ${deja.length} déjà au format « category: »`);
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
