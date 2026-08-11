#!/usr/bin/env node
/**
 * build-ci.mjs — build RÉDUIT destiné à l'intégration continue, et à elle seule.
 *
 * Mesuré le 11/08/2026 : 36 s et 97 pages, contre ~12 min et 2949 pages pour le build complet.
 * L'écart vient des pages d'entités (aéroports, races, pays, compagnies, guides), 2728 pages qui
 * n'apportent rien aux contrôles exécutés sur une pull request : les harnais DOM lisent la page
 * d'accueil dans les 4 langues et `/tools/fiche`, toutes présentes ici.
 *
 * CE QU'IL NE PROUVE PAS, et c'est délibéré : le « noindex sur la totalité des pages » et le
 * sitemap complet ne sont pas vérifiés ici. Ces garanties restent assurées par `build-preview.mjs`,
 * que `deploy:preview` exécute AVANT tout déploiement — c'est-à-dire au moment où elles comptent.
 * Ne pas se servir de ce script pour déployer quoi que ce soit : il refuserait de toute façon,
 * `dist/` étant incomplet.
 *
 * `PUBLIC_API_BASE` reçoit une URL Worker versionnée SENTINELLE, syntaxiquement conforme mais
 * inexistante : la CI n'a pas à joindre Cloudflare, et une sentinelle permet de vérifier que le
 * bundle est bien épinglé sur ce qu'on lui a demandé — et sur rien d'autre.
 *
 *   npm run build:ci
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { requireNode } from "./lib/require-node.mjs";

requireNode("le build de CI");

const SENTINEL_API_BASE = "https://00000000-mydogcanfly-api-preview.fromparis.workers.dev";
const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const log = (m) => process.stderr.write(`[build-ci] ${m}\n`);

log(`PUBLIC_API_BASE=${SENTINEL_API_BASE} (sentinelle : aucune requête réseau attendue)`);
log("PUBLIC_SITE_ENV=preview · BUILD_ONLY=__none__ (aucune famille d'entités)");

const r = spawnSync("npm", ["-w", "@mydogcanfly/ui", "run", "build"], {
  cwd: REPO_ROOT,
  env: {
    ...process.env,
    PUBLIC_API_BASE: SENTINEL_API_BASE,
    PUBLIC_SITE_ENV: "preview",
    BUILD_ONLY: "__none__",
  },
  stdio: ["ignore", 2, 2],
});
if (r.status !== 0) {
  log("ÉCHEC : le build réduit a échoué (voir la sortie ci-dessus).");
  process.exit(1);
}
log("Build réduit prêt. Les harnais lisant packages/ui/dist peuvent tourner.");
