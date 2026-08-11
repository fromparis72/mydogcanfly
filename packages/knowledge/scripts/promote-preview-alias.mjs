#!/usr/bin/env node
/**
 * promote-preview-alias.mjs — fait pointer l'alias Worker partagé
 * (https://mydogcanfly-api-preview.fromparis.workers.dev) sur une version précise.
 *
 * Volontairement SÉPARÉ de `deploy:preview`, et volontairement manuel.
 *
 * L'alias partagé doit signifier « dernière preview APPROUVÉE », pas « dernier code téléversé ».
 * Si `deploy:preview` le promouvait automatiquement, un téléversement techniquement réussi mais
 * fonctionnellement mauvais deviendrait instantanément la référence mutable que tout le monde
 * interroge. On ne promeut donc qu'après un contre-test navigateur concluant, à la main, en
 * nommant explicitement la version.
 *
 * Usage :
 *   npm run promote:preview-alias -- <worker_version_id> [--dry]
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const WRANGLER_CONFIG = "packages/workers/wrangler.toml";
const WORKER_NAME = "mydogcanfly-api-preview";
const WORKERS_SUBDOMAIN = "fromparis.workers.dev";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const log = (m) => process.stderr.write(`[promote-alias] ${m}\n`);

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const positional = args.filter((a) => !a.startsWith("--"));
const unknown = args.filter((a) => a.startsWith("--") && a !== "--dry");

if (unknown.length > 0) {
  log(`Argument(s) non reconnu(s) : ${unknown.join(", ")}`);
  process.exit(2);
}
if (positional.length !== 1) {
  log("Usage : npm run promote:preview-alias -- <worker_version_id> [--dry]");
  log("L'identifiant de version figure dans le manifeste produit par `npm run deploy:preview`");
  log("(champ worker_version_id), ou dans `npx wrangler versions list --env preview --json`.");
  process.exit(2);
}
const versionId = positional[0];
if (!UUID_RE.test(versionId)) {
  log(`« ${versionId} » n'a pas la forme d'un identifiant de version Cloudflare (UUID).`);
  log("Attendu par exemple : f515de54-89f5-42bc-a183-3bd693deb1c8");
  process.exit(2);
}

/* Vérification AVANT promotion : la version existe, elle est bien taguée, et son URL versionnée
 * répond ce qu'on croit. Promouvoir à l'aveugle une version qu'on n'a pas relue reviendrait à
 * refaire, côté alias, l'erreur qu'on cherche à éviter côté build. */
log(`Contrôle de la version ${versionId} avant promotion…`);
const versionUrl = `https://${versionId.slice(0, 8)}-${WORKER_NAME}.${WORKERS_SUBDOMAIN}`;
let health;
try {
  const res = await fetch(`${versionUrl}/v1/health?cb=${Date.now()}`, { signal: AbortSignal.timeout(10_000) });
  if (res.status !== 200) {
    log(`ÉCHEC : ${versionUrl}/v1/health répond HTTP ${res.status}.`);
    process.exit(1);
  }
  health = await res.json();
} catch (e) {
  log(`ÉCHEC : ${versionUrl}/v1/health injoignable (${e.name} ${e.message}).`);
  log("Une version sans URL de preview joignable ne devrait pas être promue.");
  process.exit(1);
}
if (health.worker_version_id !== versionId) {
  log(`ÉCHEC : cette URL annonce worker_version_id=${health.worker_version_id}, attendu ${versionId}.`);
  process.exit(1);
}
log(`     OK — version ${versionId}, commit ${health.sha}.`);

if (DRY) {
  log("--dry : alias inchangé. Commande qui serait lancée :");
  log(`  npx wrangler versions deploy ${versionId}@100% --config ${WRANGLER_CONFIG} --env preview --yes`);
  process.exit(0);
}

log(`Promotion de l'alias partagé sur la version ${versionId} (100 % du trafic)…`);
const r = spawnSync(
  "npx",
  ["wrangler", "versions", "deploy", `${versionId}@100%`, "--config", WRANGLER_CONFIG, "--env", "preview", "--yes"],
  { cwd: REPO_ROOT, stdio: ["ignore", 2, 2] },
);
if (r.status !== 0) {
  log("ÉCHEC : `wrangler versions deploy` n'a pas abouti (voir la sortie ci-dessus).");
  process.exit(1);
}
log(`Fait. https://${WORKER_NAME}.${WORKERS_SUBDOMAIN} sert désormais le commit ${health.sha}.`);
