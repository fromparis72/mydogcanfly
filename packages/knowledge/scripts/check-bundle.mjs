#!/usr/bin/env node
/**
 * check-bundle.mjs — contrôle ce que le bundle construit appelle réellement.
 *
 * Deux régressions distinctes à empêcher, toutes deux survenues :
 *
 *  1. `PUBLIC_API_BASE` absente au build (10 et 11/08/2026, deux fois) : le Finder retombe en
 *     same-origin, où le POST échoue. Le déploiement réussit, le Finder est mort.
 *  2. Bundle construit contre l'alias Worker MUTABLE au lieu d'une URL versionnée : la preview
 *     paraît immuable alors que son moteur change sous elle à chaque promotion.
 *
 * S'y ajoute une interdiction qui n'a jamais été violée mais qui serait grave : aucune URL de
 * PRODUCTION ne doit se retrouver dans un bundle de preview ou de CI. Un `/v1/*` de production
 * dans un bundle non-production ferait interroger le moteur live par des pages de test.
 *
 *   node packages/knowledge/scripts/check-bundle.mjs --expect=<url attendue>
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { MUTABLE_ALIAS, PRODUCTION_PATTERNS } from "./lib/preview-select.mjs";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const ASTRO_DIR = join(REPO_ROOT, "packages/ui/dist/_astro");
const FINDER_PATH = "/v1/finder";
/* MUTABLE_ALIAS et PRODUCTION_PATTERNS vivent dans lib/preview-select.mjs depuis le L-bis :
 * la matrice des dix cas qui les valide est versionnée dans test-preview-select.mjs et tourne à
 * chaque CI, au lieu d'avoir été exécutée une fois à la main. */

const log = (m) => process.stderr.write(`[check-bundle] ${m}\n`);
const die = (m) => { log(`ÉCHEC : ${m}`); process.exit(1); };

const arg = process.argv.slice(2).find((a) => a.startsWith("--expect="));
if (!arg) die("usage : check-bundle.mjs --expect=<url Worker attendue dans le bundle>");
const EXPECTED = arg.slice("--expect=".length);
if (!EXPECTED) die("--expect= est vide.");

if (!existsSync(ASTRO_DIR)) die(`${relative(REPO_ROOT, ASTRO_DIR)} absent — le build a-t-il tourné ?`);

const chunks = readdirSync(ASTRO_DIR).filter((f) => f.endsWith(".js"));
if (chunks.length === 0) die(`aucun chunk .js dans ${relative(REPO_ROOT, ASTRO_DIR)}.`);

let finderChunk = null;
let sawExpected = false;
const offenders = [];

for (const f of chunks) {
  const src = readFileSync(join(ASTRO_DIR, f), "utf8");
  const hasExpected = src.includes(EXPECTED);
  if (hasExpected) sawExpected = true;
  if (hasExpected && src.includes(FINDER_PATH)) finderChunk = f;

  /* L'alias mutable est cherché comme sous-chaîne, mais une URL VERSIONNÉE le contient
   * (`https://<8hex>-mydogcanfly-api-preview…` ≠ `https://mydogcanfly-api-preview…` : le préfixe
   * change le début de la chaîne, donc pas de faux positif). On compte quand même explicitement. */
  const bare = src.split(MUTABLE_ALIAS).length - 1;
  /* Plus AUCUNE exception pour l'alias mutable (K-bis, 11/08/2026) : la clause
   * `EXPECTED !== MUTABLE_ALIAS` permettait de déclarer l'alias comme attendu — c'est ce que
   * faisait la CI de main. Un bundle vérifié par ce script ne doit jamais le contenir, point. */
  if (bare > 0) offenders.push(`${f} : ${bare} occurrence(s) de l'alias mutable`);

  for (const re of PRODUCTION_PATTERNS) {
    const m = src.match(re);
    if (m) offenders.push(`${f} : URL de production « ${m[0]} »`);
  }
}

if (!sawExpected) {
  die(
    `aucun chunk ne contient « ${EXPECTED} ».\n` +
      "Le Finder de ce build n'appellera pas le Worker attendu — PUBLIC_API_BASE a-t-elle bien été fixée AU BUILD ?",
  );
}
if (!finderChunk) {
  die(
    `« ${EXPECTED} » est présente, mais aucun chunk ne la contient EN MÊME TEMPS que « ${FINDER_PATH} ».\n` +
      "Rien ne démontre alors que c'est l'îlot du Finder qui est câblé dessus.",
  );
}
if (offenders.length > 0) {
  log("adresses interdites trouvées dans le bundle :");
  for (const o of offenders) log(`    ${o}`);
  die("un bundle de preview ou de CI ne doit contenir ni l'alias Worker mutable ni une URL de production.");
}

log(`OK — ${chunks.length} chunk(s) inspecté(s).`);
log(`OK — « ${EXPECTED} » et « ${FINDER_PATH} » dans le même chunk (${finderChunk}).`);
log("OK — aucune URL d'alias mutable ni de production.");
