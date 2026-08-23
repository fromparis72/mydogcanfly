#!/usr/bin/env node
/**
 * preuve-migration-categories.mjs — la migration `categories:` → `category:` n'a touché QUE ce
 * champ, dans TOUS les fichiers, et rien d'autre nulle part.
 *
 * Une migration de 288 fichiers ne se relit pas à l'œil. Elle ne se juge pas non plus sur son
 * résumé : un script qui compte lui-même ce qu'il a fait témoigne de sa propre intention, pas
 * de son effet. Ce contrôle-ci relit l'ÉTAT ANTÉRIEUR dans git et le confronte à l'état présent,
 * fichier par fichier.
 *
 * Cinq propriétés, chacune avec son diagnostic propre :
 *
 *   1. IDENTITÉ DE L'ENSEMBLE — mêmes 288 chemins avant et après, aucun ajout, aucune perte.
 *   2. CORRESPONDANCE — pour chaque fichier, l'ancienne PREMIÈRE catégorie donne bien la clé
 *      canonique inscrite. C'est la propriété que le script de migration ne peut pas prouver
 *      lui-même : elle est recalculée ici depuis la donnée antérieure.
 *   3. HORS-CHAMP INCHANGÉ — le fichier privé de sa ligne de catégorie est IDENTIQUE AU BIT PRÈS
 *      avant et après. C'est le contrôle qui attrape une réécriture accidentelle du corps, d'une
 *      date, d'un `alt` — tout ce qu'un compte de fichiers ne verrait jamais.
 *   4. AUCUN OUBLI — plus une seule ligne `categories:` dans l'arbre ; exactement une ligne
 *      `category:` par fichier, et sa valeur est l'une des quatre clés.
 *   5. IDEMPOTENCE — rejouer la migration sur l'état migré n'écrit rien. Vérifié en la rejouant
 *      RÉELLEMENT à blanc et en exigeant « 0 fichier migré ».
 *
 * La base de comparaison est FIGÉE dans le fichier, comme un dossier de mesure : un contrôle
 * dont la référence bouge avec la branche finit par se comparer à lui-même.
 *
 * CE CONTRÔLE N'ENTRE PAS EN CI, DÉLIBÉRÉMENT. C'est une preuve DATÉE, pas une garantie
 * permanente : sa propriété 1 exige les 288 mêmes chemins qu'au commit de base, si bien que le
 * premier guide légitimement ajouté la ferait échouer. Un harnais qui rougira un jour pour une
 * bonne raison est un harnais qu'on finit par désarmer, et c'est ainsi qu'on perd les autres.
 * La garantie permanente, elle, est ailleurs et en deux endroits : `z.enum` dans le schéma, qui
 * empêche le site de se construire sur une rubrique inventée, et `test-index-travel-hub.mjs`,
 * qui lit les quatre index construits à chaque pull request.
 *
 *   node preuve-migration-categories.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

/** L'état AVANT migration : sommet de `main` au moment où ce lot commence. */
const BASE = "7ac07e572712cf51c17ed6bd759c0f2c34131504";

const RACINE = "packages/ui/src/content/guides";
const LANGUES = ["en", "fr", "es", "pt"];
const CLES = ["gear", "travel", "health", "destinations"];

const CANONIQUE = new Map([
  ["Gear", "gear"], ["Équipement", "gear"],
  ["Travel", "travel"], ["Voyager", "travel"],
  ["Health", "health"], ["Santé", "health"],
  ["Destinations", "destinations"],
]);

/* git DOIT échouer FERMÉ. Un `catch` qui rendrait la chaîne vide transformerait « je n'ai pas pu
 * lire l'état antérieur » en « l'état antérieur était vide », et la preuve conclurait au vert
 * sur du néant. C'est la faute que la contre-revue a fait fermer deux fois dans ce dépôt. */
function auCommit(chemin) {
  const r = spawnSync("git", ["show", `${BASE}:${chemin}`], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    process.stderr.write(
      `[preuve] ÉCHEC : impossible de lire « ${chemin} » au commit ${BASE.slice(0, 12)}.\n` +
      `[preuve] ${(r.stderr || "").trim()}\n` +
      `[preuve] Si le clone est superficiel, approfondissez-le : git fetch --unshallow\n`);
    process.exit(1);
  }
  return r.stdout;
}

/** Le fichier privé de sa ligne de catégorie, quelle que soit sa forme. */
const horsChamp = (t) => t.replace(/^categor(?:y|ies):.*$\n?/m, "");

const premiereCategorie = (t) => {
  const l = /^categories:.*$/m.exec(t);
  if (!l) return null;
  const v = [...l[0].matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  return v[0] ?? null;
};

const defauts = [];
const echec = (m) => defauts.push(m);

/* ---- 1. identité de l'ensemble ------------------------------------------------------------ */
const apres = [];
for (const langue of LANGUES) {
  for (const nom of readdirSync(join(RACINE, langue)).filter((f) => f.endsWith(".md")).sort()) {
    apres.push(`${RACINE}/${langue}/${nom}`);
  }
}
const r = spawnSync("git", ["ls-tree", "-r", "--name-only", BASE, "--", RACINE], { encoding: "utf-8" });
if (r.status !== 0) { process.stderr.write("[preuve] ÉCHEC : git ls-tree sur la base.\n"); process.exit(1); }
const avant = r.stdout.split("\n").filter((l) => l.endsWith(".md")).sort();

const perdus = avant.filter((p) => !apres.includes(p));
const ajoutes = apres.filter((p) => !avant.includes(p));
if (perdus.length) echec(`1. ${perdus.length} fichier(s) PERDU(S) : ${perdus.slice(0, 5).join(", ")}`);
if (ajoutes.length) echec(`1. ${ajoutes.length} fichier(s) AJOUTÉ(S) : ${ajoutes.slice(0, 5).join(", ")}`);

/* ---- 2, 3, 4. correspondance, hors-champ, aucun oubli -------------------------------------- */
const compte = new Map(CLES.map((k) => [k, 0]));
let compares = 0;
for (const chemin of apres.filter((p) => avant.includes(p))) {
  const a = auCommit(chemin);
  const b = readFileSync(chemin, "utf-8");
  compares++;

  const attendue = CANONIQUE.get(premiereCategorie(a) ?? "");
  const obtenue = (/^category:\s*"([^"]*)"\s*$/m.exec(b) || [])[1];

  if (!obtenue) echec(`4. ${chemin} : aucune ligne « category: » après migration`);
  else if (!CLES.includes(obtenue)) echec(`4. ${chemin} : clé « ${obtenue} » hors des quatre canoniques`);
  else compte.set(obtenue, compte.get(obtenue) + 1);

  if (/^categories:/m.test(b)) echec(`4. ${chemin} : une ligne « categories: » subsiste`);
  if ((b.match(/^category:/gm) || []).length !== 1) echec(`4. ${chemin} : la ligne « category: » n'apparaît pas exactement une fois`);

  if (attendue && obtenue && attendue !== obtenue) {
    echec(`2. ${chemin} : « ${premiereCategorie(a)} » aurait dû donner « ${attendue} », a donné « ${obtenue} »`);
  }

  if (horsChamp(a) !== horsChamp(b)) {
    echec(`3. ${chemin} : le contenu HORS du champ de catégorie a changé`);
  }
}

/* ---- 5. idempotence ------------------------------------------------------------------------ */
const rejeu = spawnSync("node", ["packages/knowledge/scripts/migrer-categories.mjs", "--dry"], { encoding: "utf-8" });
if (rejeu.status !== 0) echec(`5. le rejeu à blanc de la migration échoue (code ${rejeu.status})`);
else if (!/^\[à blanc\] 0 fichier\(s\) migré\(s\) · 288 déjà au format/m.test(rejeu.stdout)) {
  echec(`5. le rejeu à blanc ne dit pas « 0 migré · 288 déjà » — il dit : ${rejeu.stdout.split("\n")[0]}`);
}

/* ---- verdict ------------------------------------------------------------------------------- */
const log = (m) => process.stdout.write(`${m}\n`);
log(`base de comparaison : ${BASE}`);
log(`fichiers confrontés : ${compares} (avant ${avant.length} · après ${apres.length})`);
log(`répartition finale  : ${CLES.map((k) => `${k}:${compte.get(k)}`).join(" ")}`);
log("");
if (defauts.length === 0) {
  log("1. identité de l'ensemble ......... OK — aucun fichier perdu ni ajouté");
  log("2. correspondance des valeurs ..... OK — chaque clé recalculée depuis la donnée antérieure");
  log("3. contenu hors champ ............. OK — identique AU BIT PRÈS dans les 288 fichiers");
  log("4. aucun oubli .................... OK — plus aucun « categories: », une clé canonique partout");
  log("5. idempotence .................... OK — le rejeu ne migre rien");
  log("");
  log("[preuve-migration] les cinq propriétés sont tenues.");
  process.exit(0);
}
process.stderr.write(`\n[preuve-migration] ÉCHEC — ${defauts.length} défaut(s) :\n`);
for (const d of defauts.slice(0, 40)) process.stderr.write(`  ${d}\n`);
if (defauts.length > 40) process.stderr.write(`  … et ${defauts.length - 40} autre(s)\n`);
process.exit(1);
