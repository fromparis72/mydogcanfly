#!/usr/bin/env node
/**
 * build-preview.mjs — construit `packages/ui/dist` pour un déploiement Cloudflare Pages
 * PREVIEW, avec `PUBLIC_API_BASE` toujours pointé sur le Worker de preview, et vérifie
 * après coup que le build a bien pris en compte cette variable.
 *
 * Pourquoi ce script existe : `PUBLIC_API_BASE` doit être fixé AU BUILD (Vite l'inline dans
 * le bundle du Finder ; voir packages/ui/src/lib/env.ts), pas au déploiement. Un simple
 * `npm run build` sans cette variable produit un `dist/` qui se déploie sans erreur mais dont
 * le Finder appelle le endpoint statique inerte de Pages au lieu du Worker — régression
 * survenue deux fois (10/08 et 11/08/2026) parce que les instructions de build ne la
 * rappelaient pas systématiquement. Ce script la fixe une fois pour toutes et refuse de
 * livrer un `dist/` qui ne l'a pas prise en compte.
 *
 * Usage :
 *   node packages/knowledge/scripts/build-preview.mjs           # build réel + vérification
 *   node packages/knowledge/scripts/build-preview.mjs --dry     # affiche le plan, ne build pas
 *
 * Idempotent : peut être relancé autant de fois que nécessaire, reproduit le même résultat.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DRY = process.argv.includes("--dry");

// Volontairement en dur : c'est la seule adresse valide pour un déploiement PREVIEW.
// (Voir packages/workers/wrangler.toml [env.preview] et docs/V2-DEPLOYMENT.md.)
const PREVIEW_API_BASE = "https://mydogcanfly-api-preview.fromparis.workers.dev";

const REPO_ROOT = join(new URL(import.meta.url).pathname, "..", "..", "..", "..");
const DIST_DIR = join(REPO_ROOT, "packages/ui/dist");
const ASTRO_DIR = join(DIST_DIR, "_astro");

function log(msg) {
  console.log(`[build-preview] ${msg}`);
}

function fail(msg) {
  console.error(`[build-preview] ÉCHEC : ${msg}`);
  process.exit(1);
}

// `PUBLIC_SITE_ENV` ne doit JAMAIS être fixé ici : un preview doit toujours rester
// `noindex` (voir packages/ui/src/lib/env.ts). On le retire explicitement de l'environnement
// hérité, au cas où il traînerait dans le shell de l'appelant.
const childEnv = { ...process.env, PUBLIC_API_BASE: PREVIEW_API_BASE };
delete childEnv.PUBLIC_SITE_ENV;

log(`PUBLIC_API_BASE=${PREVIEW_API_BASE}`);
log("PUBLIC_SITE_ENV=(non défini, volontairement — preview reste noindex)");

if (DRY) {
  log("--dry : build non exécuté. Commande qui serait lancée :");
  log("  npm -w @mydogcanfly/ui run build");
  log("Vérifications qui suivraient :");
  log(`  1. au moins un fichier de ${ASTRO_DIR} contient "${PREVIEW_API_BASE}"`);
  log(`  2. au moins une page HTML de ${DIST_DIR} contient "noindex"`);
  process.exit(0);
}

log("Build en cours (npm -w @mydogcanfly/ui run build)…");
const build = spawnSync("npm", ["-w", "@mydogcanfly/ui", "run", "build"], {
  cwd: REPO_ROOT,
  env: childEnv,
  stdio: "inherit",
});
if (build.status !== 0) fail("le build Astro a échoué (voir la sortie ci-dessus).");

// Vérification 1 : PUBLIC_API_BASE a bien été inliné dans au moins un bundle JS.
let apiBaseFound = false;
try {
  for (const f of readdirSync(ASTRO_DIR)) {
    if (!f.endsWith(".js")) continue;
    if (readFileSync(join(ASTRO_DIR, f), "utf8").includes(PREVIEW_API_BASE)) {
      apiBaseFound = true;
      break;
    }
  }
} catch (e) {
  fail(`impossible de lire ${ASTRO_DIR} après le build (${e.message}).`);
}
if (!apiBaseFound) {
  fail(
    `aucun fichier de ${ASTRO_DIR} ne contient "${PREVIEW_API_BASE}". ` +
      "Le Finder de ce build appellera l'endpoint statique inerte de Pages, pas le Worker. " +
      "NE PAS DÉPLOYER ce dist/."
  );
}
log(`OK — "${PREVIEW_API_BASE}" trouvé dans le bundle.`);

// Vérification 2 : au moins une page reste bien noindex (sécurité anti-indexation du preview).
function findFirstHtmlWithNoindex(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFirstHtmlWithNoindex(full);
      if (found) return found;
    } else if (entry.name.endsWith(".html")) {
      if (readFileSync(full, "utf8").includes("noindex")) return full;
    }
  }
  return null;
}
const noindexFile = findFirstHtmlWithNoindex(DIST_DIR);
if (!noindexFile) fail(`aucune page HTML de ${DIST_DIR} ne contient "noindex". NE PAS DÉPLOYER.`);
log(`OK — noindex confirmé (ex. ${noindexFile.replace(REPO_ROOT + "/", "")}).`);

const distStat = statSync(DIST_DIR);
log(`Build preview prêt : ${DIST_DIR} (${distStat.mtime.toISOString()}).`);
log("Prochaine étape : npx wrangler pages deploy packages/ui/dist --project-name=mydogcanfly-v2-preview --branch=<nom> [--commit-hash=<sha>]");
