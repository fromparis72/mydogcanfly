#!/usr/bin/env node
/**
 * promote-preview-alias.mjs — fait pointer l'alias Worker partagé
 * (https://mydogcanfly-api-preview.fromparis.workers.dev) sur une version déjà vérifiée.
 *
 * Volontairement SÉPARÉ de `deploy:preview`, et volontairement manuel : l'alias doit signifier
 * « dernière preview APPROUVÉE », pas « dernier code téléversé ». Un téléversement techniquement
 * réussi mais fonctionnellement mauvais ne doit pas devenir la référence mutable que tout le
 * monde interroge.
 *
 * L'argument est un MANIFESTE, pas un UUID nu (correction du lot F, contre-revue Codex du
 * 11/08/2026) : le manifeste porte le SHA, l'ID de version et l'URL versionnée, ce qui permet de
 * vérifier la cohérence de l'ensemble au lieu de faire confiance à un identifiant recopié à la
 * main. La version précédente de ce script prétendait en commentaire vérifier le tag, et ne le
 * faisait pas — c'est corrigé ici, et vraiment.
 *
 * Séquence :
 *   1. Manifeste     — lu, statut « verified » exigé, champs contrôlés
 *   2. Tag           — `versions list --json`, tag `git-<sha>` unique ET pointant sur CETTE version
 *   3. Santé version — double concordance sur l'URL versionnée AVANT de toucher au trafic
 *   4. Promotion     — `wrangler versions deploy <id>@100%`
 *   5. Santé alias   — relecture de l'ALIAS jusqu'à double concordance (retentes)
 *
 * Usage :
 *   npm run promote:preview-alias -- .artifacts/previews/<sha>/manifest.json [--dry]
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { selectVersionByTag, validateManifest, healthMatches, retryUntil } from "./lib/preview-select.mjs";
import { requireNode } from "./lib/require-node.mjs";

requireNode("la promotion d'alias");

const WRANGLER_CONFIG = "packages/workers/wrangler.toml";
const WORKER_NAME = "mydogcanfly-api-preview";
const WORKERS_SUBDOMAIN = "fromparis.workers.dev";
const ALIAS_URL = `https://${WORKER_NAME}.${WORKERS_SUBDOMAIN}`;

// Mêmes paramètres de retente qu'à l'aller : on a observé le 11/08/2026 un ancien Worker
// répondant transitoirement après un déploiement, sans que la couche responsable soit établie.
const HEALTH_TOTAL_MS = 90_000;
const HEALTH_INTERVAL_MS = 5_000;
const HEALTH_TIMEOUT_MS = 5_000;

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const log = (m) => process.stderr.write(`[promote-alias] ${m}\n`);
const die = (m) => {
  log(`ÉCHEC : ${m}`);
  process.exit(1);
};

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const positional = args.filter((a) => !a.startsWith("--"));
const unknown = args.filter((a) => a.startsWith("--") && a !== "--dry");

if (unknown.length > 0) {
  log(`Argument(s) non reconnu(s) : ${unknown.join(", ")}`);
  process.exit(2);
}
if (positional.length !== 1) {
  log("Usage : npm run promote:preview-alias -- <chemin du manifeste> [--dry]");
  log("Exemple : npm run promote:preview-alias -- .artifacts/previews/<sha>/manifest.json");
  log("Le manifeste est produit par `npm run deploy:preview`.");
  process.exit(2);
}

/* ── 1. Manifeste ─────────────────────────────────────────────────────────────────────────── */
const manifestPath = isAbsolute(positional[0]) ? positional[0] : join(REPO_ROOT, positional[0]);
log(`1/5 Lecture du manifeste ${positional[0]}…`);
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (e) {
  die(`manifeste illisible (${e.message}).`);
}
const mv = validateManifest(manifest);
if (!mv.ok) die(mv.message);
const { git_sha: sha, worker_version_id: versionId, worker_version_url: versionUrl } = manifest;
const tag = `git-${sha}`;
log(`     OK — commit ${sha.slice(0, 12)}, version ${versionId}.`);

/* ── 2. Tag — vérifié pour de bon cette fois ──────────────────────────────────────────────
 * On exige que le tag `git-<sha>` existe, soit unique, ET désigne exactement la version que le
 * manifeste prétend avoir déployée. Un manifeste modifié à la main, ou recopié d'un autre
 * déploiement, échoue ici plutôt que d'entraîner la promotion d'une version étrangère. */
log(`2/5 Vérification du tag ${tag} auprès de Cloudflare…`);
const listed = spawnSync("npx", ["wrangler", "versions", "list", "--config", WRANGLER_CONFIG, "--env", "preview", "--json"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
});
if (listed.status !== 0) {
  process.stderr.write(listed.stderr ?? "");
  die("`wrangler versions list --json` a échoué.");
}
let versions;
try {
  versions = JSON.parse(listed.stdout.slice(listed.stdout.indexOf("[")));
} catch (e) {
  die(`sortie de \`versions list --json\` illisible (${e.message}).`);
}
const selection = selectVersionByTag(versions, tag);
if (!selection.ok) die(selection.message);
if (selection.version.id !== versionId) {
  die(
    `incohérence : le tag ${tag} désigne la version ${selection.version.id}, ` +
      `alors que le manifeste annonce ${versionId}. Refus de promouvoir.`,
  );
}
log(`     OK — tag unique, pointant bien sur ${versionId}.`);

/* ── 3. Santé de la version, AVANT de toucher au trafic ──────────────────────────────────── */
log("3/5 Relecture de /v1/health sur l'URL versionnée…");
let versionHealth;
try {
  const res = await fetch(`${versionUrl}/v1/health?cb=${Date.now()}`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
  if (res.status !== 200) die(`${versionUrl}/v1/health répond HTTP ${res.status}.`);
  versionHealth = await res.json();
} catch (e) {
  die(`${versionUrl}/v1/health injoignable (${e.name} ${e.message}).`);
}
const vm = healthMatches(versionHealth, sha, versionId);
if (!vm.ok) die(`double concordance absente sur l'URL versionnée · ${vm.detail}`);
log("     OK — double concordance confirmée.");

if (DRY) {
  log("--dry : alias inchangé. Commande qui serait lancée :");
  log(`  npx wrangler versions deploy ${versionId}@100% --config ${WRANGLER_CONFIG} --env preview --yes`);
  log(`Puis relecture de ${ALIAS_URL}/v1/health jusqu'à concordance (${HEALTH_TOTAL_MS / 1000}s max).`);
  process.exit(0);
}

/* ── 4. Promotion ─────────────────────────────────────────────────────────────────────────── */
log(`4/5 Promotion de l'alias sur la version ${versionId} (100 % du trafic)…`);
const promoted = spawnSync(
  "npx",
  ["wrangler", "versions", "deploy", `${versionId}@100%`, "--config", WRANGLER_CONFIG, "--env", "preview", "--yes"],
  { cwd: REPO_ROOT, stdio: ["ignore", 2, 2] },
);
if (promoted.status !== 0) die("`wrangler versions deploy` n'a pas abouti (voir la sortie ci-dessus).");

/* ── 5. Santé de l'ALIAS après promotion ──────────────────────────────────────────────────
 * La version précédente annonçait « l'alias sert désormais le commit X » sans jamais l'avoir
 * relu — une affirmation non vérifiée, exactement ce qu'on s'emploie à éliminer partout ailleurs.
 * On relit donc l'alias lui-même, avec la même fenêtre de retentes qu'à l'aller. */
log(`5/5 Relecture de l'ALIAS ${ALIAS_URL} jusqu'à concordance…`);
const r = await retryUntil(
  async (attempt) => {
    try {
      const res = await fetch(`${ALIAS_URL}/v1/health?cb=${Date.now()}-${attempt}`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
        headers: { "cache-control": "no-cache" },
      });
      const body = await res.text();
      if (res.status !== 200) return { ok: false, detail: `HTTP ${res.status} · corps=${body.slice(0, 160)}` };
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return { ok: false, detail: `JSON invalide · corps=${body.slice(0, 160)}` };
      }
      const m = healthMatches(parsed, sha, versionId);
      return m.ok ? { ok: true } : { ok: false, detail: m.detail };
    } catch (e) {
      return { ok: false, detail: `erreur réseau : ${e.name} ${e.message}` };
    }
  },
  {
    totalMs: HEALTH_TOTAL_MS,
    intervalMs: HEALTH_INTERVAL_MS,
    onRetry: (attempt, detail) => log(`     tentative ${attempt} sans concordance (${detail.slice(0, 110)}…)`),
  },
);
if (!r.ok) {
  log(`ÉCHEC : l'alias n'annonce toujours pas le commit attendu après ${r.attempt} tentative(s).`);
  log(`Dernier état : ${r.lastDetail}`);
  log("La promotion a peut-être abouti côté Cloudflare sans être encore visible : relance cette");
  log("commande pour revérifier, ou inspecte `npx wrangler deployments list --env preview`.");
  process.exit(1);
}
log(`     OK — concordance obtenue à la tentative ${r.attempt}.`);
log("");
log(`${ALIAS_URL} sert désormais le commit ${sha}, version ${versionId} — vérifié, pas supposé.`);
