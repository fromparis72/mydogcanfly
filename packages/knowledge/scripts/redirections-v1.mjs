#!/usr/bin/env node
/* Les URLs de la v1 encore réclamées par Google, et où elles doivent aboutir.
 *
 * LE CONSTAT. La Search Console signale une série de 404 qui sont toutes des adresses de
 * l'ancien site : outils renommés, catégories disparues, fiches « chaleur par race » fondues
 * dans les fiches de race, guides déplacés sous le Travel Hub. Chacune a été indexée, chacune
 * a reçu des liens, et chacune renvoie aujourd'hui une page d'erreur.
 *
 * POURQUOI ÇA COMPTE. Une 404 sur une URL indexée, c'est trois pertes d'un coup : le visiteur
 * qui repart, le lien entrant qui ne transmet plus rien, et le budget d'exploration que Google
 * dépense à revenir vérifier. Une redirection 301 récupère les trois — elle dit « ça a déménagé
 * là », transmet l'historique de l'ancienne adresse à la nouvelle, et Google cesse de repasser.
 *
 * LE FICHIER `_redirects` PLUTÔT QUE LE WORKER. Les chemins `/tools/*` sont exclus du Worker :
 * une redirection écrite là ne s'appliquerait pas. `_redirects` est lu par Cloudflare Pages en
 * amont de tout, et il est versionné avec le site.
 *
 * L'ORDRE EST SIGNIFIANT : la première règle qui correspond gagne. Les exceptions passent donc
 * AVANT les jokers — c'est ce qui permet de rattraper le Cavalier King Charles, dont le slug a
 * perdu son « spaniel » au passage à la v2, avant que le joker ne l'envoie sur une page
 * inexistante.
 *
 * LES GUIDES SONT ÉNUMÉRÉS, PAS JOKERISÉS. En v1 ils vivaient à la racine — « /traveling-by-
 * car-with-a-dog/ ». Un joker `/*` les rattraperait, mais il rattraperait AUSSI tout le reste :
 * la moindre faute de frappe deviendrait une redirection au lieu d'une 404 honnête, et Google
 * finirait par trouver le site infini. On écrit donc une règle par guide réellement publié,
 * générée depuis le dossier `travel-hub` pour ne pas dériver.
 *
 * `/api/weather` N'EST PAS REDIRIGÉ. C'est un point d'entrée technique de la v1 qui n'a pas
 * d'équivalent et n'aurait jamais dû être exploré. Une 404 est ici la réponse juste : rediriger
 * une API vers une page de contenu tromperait autant le robot que le visiteur.
 *
 *   node packages/knowledge/scripts/redirections-v1.mjs [--dry]
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RACINE = join(HERE, "..", "..", "ui");
const PUBLIC = join(RACINE, "public", "_redirects");
const HUB = join(RACINE, "dist", "travel-hub");
const dry = process.argv.includes("--dry");

const MARQUE = "# — v1 → v2, relevé Search Console 05/08/2026 —";

/* Les guides du Travel Hub, lus sur le site construit : un dossier = un guide publié. */
const guides = existsSync(HUB)
  ? readdirSync(HUB, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
  : [];
if (!guides.length) { console.error("✗ dossier travel-hub introuvable — construis le site d'abord."); process.exit(1); }

const regles = [
  "",
  MARQUE,
  "",
  "# Outils renommés.",
  "/tools/can-my-dog-fly/                     /#flight-finder        301",
  "/tools/can-my-dog-fly                      /#flight-finder        301",
  "/tools/dog-entry-requirements-by-country/  /countries/            301",
  "/tools/dog-entry-requirements-by-country   /countries/            301",
  "",
  "# Fiches « chaleur par race » : la v2 les a fondues dans la fiche de race, qui dit la même",
  "# chose sur le climat et bien davantage. L'exception vient d'un slug raccourci en v2.",
  "/dog-heat-safety/cavalier-king-charles-spaniel/  /breeds/cavalier-king-charles/  301",
  "/dog-heat-safety/*                         /breeds/:splat         301",
  "",
  "# Catégories de la v1.",
  "/categories/destinations/                  /tools/destinations/   301",
  "/categories/gear/                          /tools/best-crates/    301",
  "/categories/*                              /travel-hub/           301",
  "",
  `# Guides déplacés à la racine → Travel Hub (${guides.length} règles, une par guide publié).`,
  /* Alignement par `padEnd` PUIS espace explicite. Sans ce dernier, un slug long remplit la
   * colonne et colle la cible au code : « /travel-hub/airline-approved-dog-crate/301 », une
   * règle que Cloudflare rejette en silence. La lisibilité ne doit jamais primer sur la syntaxe. */
  ...guides.map((g) => `/${g}/`.padEnd(43) + `/travel-hub/${g}/`.padEnd(46) + " 301"),
  "",
];

let texte = readFileSync(PUBLIC, "utf-8");
if (texte.includes(MARQUE)) {
  /* Rejouable : on remplace le bloc précédent au lieu de l'empiler. */
  texte = texte.slice(0, texte.indexOf(MARQUE)).replace(/\n+$/, "\n");
}
texte = texte.replace(/\n+$/, "\n") + regles.join("\n");

if (!dry) writeFileSync(PUBLIC, texte);

const n = texte.split("\n").filter((l) => /^\/\S+\s+\S+\s+301$/.test(l)).length;
console.log(`${n} règle(s) de redirection au total, dont ${guides.length} guides` +
  `${dry ? " — essai à blanc" : ""}`);
console.log(`fichier : packages/ui/public/_redirects`);
