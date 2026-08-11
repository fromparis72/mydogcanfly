#!/usr/bin/env node
/**
 * deploy-preview.mjs — déploiement PREVIEW coordonné et vérifié entre les deux services.
 *
 * Ce n'est PAS une transaction atomique : il n'y a pas de rollback global. C'est une séquence
 * ordonnée qui vérifie chaque étape avant d'engager la suivante, et qui échoue franchement
 * plutôt que de laisser passer un état douteux.
 *
 *   1. Préflight     — arbre Git propre ET HEAD == origin/main (aucune dérogation)
 *   2. Worker        — `wrangler versions upload` : crée une VERSION sans toucher au trafic
 *   3. Sélection     — retrouve la version par son tag `git-<sha>`, correspondance unique exigée
 *   4. Santé Worker  — relit /v1/health sur l'URL VERSIONNÉE jusqu'à double concordance
 *   5. Pages         — build épinglé sur cette URL versionnée, puis `wrangler pages deploy`
 *   6. Smoke Pages   — la preview répond 200, reste noindex, et son bundle porte l'URL versionnée
 *   7. Manifeste     — trace complète dans .artifacts/previews/<sha>/manifest.json
 *
 * L'alias Worker partagé n'est JAMAIS promu ici : il doit signifier « dernière preview
 * approuvée », pas « dernier code téléversé ». Sa promotion est une commande distincte, à lancer
 * après le contre-test navigateur :
 *   npm run promote:preview-alias -- .artifacts/previews/<sha>/manifest.json
 *
 * Sorties : messages humains sur stderr, manifeste JSON pur sur stdout avec --json.
 * En cas d'échec, un manifeste PARTIEL (`status: "failed"`, étape fautive) est écrit quand même.
 *
 * Usage :
 *   node packages/knowledge/scripts/deploy-preview.mjs [--json] [--dry]
 *
 * Via npm, `--silent` est OBLIGATOIRE si on exploite le JSON : sans lui, npm écrit son propre
 * préambule (« > deploy:preview », « > node … ») sur stdout et le mélange au manifeste, ce qui
 * casse tout `jq` en aval. Vérifié le 11/08/2026.
 *   npm run --silent deploy:preview -- --json | jq .worker_version_id
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  selectVersionByTag,
  versionPreviewUrl,
  healthMatches,
  extractPagesDeploymentId,
  extractHoistedChunks,
  retryUntil,
} from "./lib/preview-select.mjs";

const SCHEMA_VERSION = 1;
const WORKER_NAME = "mydogcanfly-api-preview";
const WORKERS_SUBDOMAIN = "fromparis.workers.dev";
const PAGES_PROJECT = "mydogcanfly-v2-preview";
const WRANGLER_CONFIG = "packages/workers/wrangler.toml";

// Fenêtre de retente sur /v1/health (décidée avec Codex le 11/08/2026, après avoir observé en
// conditions réelles un ancien Worker répondant transitoirement juste après un déploiement).
const HEALTH_TOTAL_MS = 90_000;
const HEALTH_INTERVAL_MS = 5_000;
const HEALTH_TIMEOUT_MS = 5_000;

const KNOWN_FLAGS = new Set(["--json", "--dry"]);
const args = process.argv.slice(2);
const unknown = args.filter((a) => !KNOWN_FLAGS.has(a));
if (unknown.length > 0) {
  process.stderr.write(`[deploy-preview] Argument(s) non reconnu(s) : ${unknown.join(", ")}\n`);
  process.stderr.write(`[deploy-preview] Arguments acceptés : ${[...KNOWN_FLAGS].join(", ")}\n`);
  process.exit(2);
}
const JSON_OUT = args.includes("--json");
const DRY = args.includes("--dry");

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const DIST_DIR = join(REPO_ROOT, "packages/ui/dist");

/* Tout ce qui est destiné à l'humain part sur stderr, sans exception : stdout est réservé au
 * manifeste, pour qu'un contre-test puisse faire `deploy-preview --json | jq` sans filtrer. */
const log = (m) => process.stderr.write(`[deploy-preview] ${m}\n`);

const manifest = {
  schema_version: SCHEMA_VERSION,
  status: "failed",
  failed_step: "preflight",
  environment: "preview",
  created_at: new Date().toISOString(),
  git_sha: null,
  origin_main_sha: null,
  git_clean: null,
  worker_version_id: null,
  worker_version_url: null,
  worker_health_sha: null,
  worker_health_version_id: null,
  pages_project: PAGES_PROJECT,
  pages_branch: null,
  pages_deployment_id: null,
  pages_deployment_id_prefix: null,
  pages_immutable_url: null,
  pages_alias_url: null,
  public_api_base: null,
  wrangler_version: null,
  checks: {},
  notes: [],
};

function writeManifest() {
  if (!manifest.git_sha) return null;
  const dir = join(REPO_ROOT, ".artifacts/previews", manifest.git_sha);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "manifest.json");
  writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
  return file;
}

function fail(step, msg) {
  manifest.status = "failed";
  manifest.failed_step = step;
  manifest.notes.push(msg);
  const file = writeManifest();
  log(`ÉCHEC à l'étape « ${step} » : ${msg}`);
  if (file) log(`Manifeste partiel écrit : ${relative(REPO_ROOT, file)}`);
  if (JSON_OUT) process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
  process.exit(1);
}

/** Exécute une commande, capture sa sortie, et la retransmet sur stderr au fil de l'eau. */
function run(cmd, cmdArgs, { capture = true } = {}) {
  const r = spawnSync(cmd, cmdArgs, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", 2, 2],
  });
  if (capture) {
    if (r.stdout) process.stderr.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
  }
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

const git = (a) => spawnSync("git", a, { cwd: REPO_ROOT, encoding: "utf8" }).stdout?.trim() ?? "";

/* ── 1. Préflight ─────────────────────────────────────────────────────────────────────────
 * Refus ferme, sans échappatoire : pas de `--allow-dirty`. Étiqueter un déploiement d'un
 * `--commit-hash` propre alors que le build vient d'un arbre modifié est un mensonge de
 * traçabilité — et c'est justement la traçabilité qu'on est en train de construire. Un besoin
 * ponctuel de déployer du code non commité relève d'une commande séparée, explicitement
 * non validable. */
log("1/7 Préflight (arbre propre, HEAD == origin/main)…");
const dirty = git(["status", "--porcelain"]);
manifest.git_clean = dirty === "";
manifest.git_sha = git(["rev-parse", "HEAD"]);
if (!manifest.git_sha) fail("preflight", "impossible de lire HEAD — sommes-nous dans un dépôt Git ?");
if (!manifest.git_clean) {
  fail(
    "preflight",
    `l'arbre de travail contient des modifications non commitées :\n${dirty}\n` +
      "Une preview de validation doit correspondre exactement à un commit poussé.",
  );
}
/* Le code de sortie de `git fetch` DOIT être vérifié (signalé par Codex, 11/08/2026) : en cas
 * d'échec réseau, `origin/main` resterait la référence locale périmée, et la comparaison
 * ci-dessous validerait un HEAD aligné sur un état d'il y a plusieurs commits. Un préflight qui
 * passe sur des données périmées est pire que pas de préflight : il rassure à tort. */
const fetched = run("git", ["fetch", "origin", "--quiet"]);
if (fetched.status !== 0) {
  fail("preflight", "`git fetch origin` a échoué : impossible de comparer HEAD à un origin/main à jour.");
}
manifest.origin_main_sha = git(["rev-parse", "origin/main"]);
if (manifest.git_sha !== manifest.origin_main_sha) {
  fail(
    "preflight",
    `HEAD (${manifest.git_sha.slice(0, 7)}) ≠ origin/main (${(manifest.origin_main_sha || "?").slice(0, 7)}). ` +
      "Pousse d'abord, pour que la preview atteste d'un commit que d'autres peuvent relire.",
  );
}
manifest.checks.preflight = true;
log(`     OK — ${manifest.git_sha.slice(0, 7)}, arbre propre, aligné sur origin/main.`);

/* 12 caractères et non 7 : marge contre les collisions de préfixe, et les alias de branche Pages
 * restent lisibles. Recommandé par Codex le 11/08/2026. */
const shortSha = manifest.git_sha.slice(0, 12);
const tag = `git-${manifest.git_sha}`;
manifest.pages_branch = `review-${shortSha}`;

const wranglerVersion = run("npx", ["wrangler", "--version"]).stdout.match(/\d+\.\d+\.\d+/)?.[0] ?? null;
manifest.wrangler_version = wranglerVersion;

if (DRY) {
  log("--dry : rien n'est téléversé ni déployé. Plan :");
  log(`  2. wrangler versions upload --env preview --var BUILD_SHA:${manifest.git_sha} --tag ${tag}`);
  log(`  3. sélection par annotations["workers/tag"] === "${tag}" (correspondance unique, has_preview)`);
  log(`  4. GET https://<prefixe>-${WORKER_NAME}.${WORKERS_SUBDOMAIN}/v1/health jusqu'à double concordance`);
  log(`  5. build épinglé, puis wrangler pages deploy --branch=${manifest.pages_branch} --commit-hash=${manifest.git_sha}`);
  log(`  6. smoke HTTP de ${PAGES_PROJECT} : 200, noindex, bundle épinglé sur l'URL versionnée`);
  log(`  7. manifeste dans .artifacts/previews/${manifest.git_sha}/manifest.json`);
  manifest.status = "dry-run";
  manifest.failed_step = null;
  if (JSON_OUT) process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
  process.exit(0);
}

/* ── 2. Téléversement d'une VERSION (le trafic ne bouge pas) ─────────────────────────────── */
log("2/7 wrangler versions upload (aucun trafic déplacé)…");
const up = run("npx", [
  "wrangler", "versions", "upload",
  "--config", WRANGLER_CONFIG,
  "--env", "preview",
  "--var", `BUILD_SHA:${manifest.git_sha}`,
  "--tag", tag,
  "--message", `preview ${shortSha}`,
]);
if (up.status !== 0) fail("worker_upload", "`wrangler versions upload` a échoué (voir la sortie ci-dessus).");
manifest.checks.worker_upload = true;

/* ── 3. Sélection de la version, par tag uniquement ───────────────────────────────────────
 * Aucun repli heuristique (décision de Codex, 11/08/2026). Un repli sur le `number` maximal
 * paraît raisonnable jusqu'au jour où deux téléversements se croisent : il choisirait alors
 * silencieusement la version de quelqu'un d'autre. On exige une correspondance EXACTE et
 * UNIQUE sur le tag, et rien d'autre.
 *
 * Attention au tri : `versions list --json` renvoie les 100 versions les plus récentes classées
 * par `number` CROISSANT — la plus récente est la dernière. On ne dépend d'aucun ordre ici,
 * précisément pour que ce détail ne puisse pas nous piéger. */
log(`3/7 Recherche de la version taguée ${tag}…`);
const listRaw = run("npx", ["wrangler", "versions", "list", "--config", WRANGLER_CONFIG, "--env", "preview", "--json"], { capture: true });
if (listRaw.status !== 0) fail("worker_select", "`wrangler versions list --json` a échoué.");
let versions;
try {
  versions = JSON.parse(listRaw.stdout.slice(listRaw.stdout.indexOf("[")));
} catch (e) {
  fail("worker_select", `sortie de \`versions list --json\` illisible (${e.message}).`);
}
const selection = selectVersionByTag(versions, tag);
if (!selection.ok) fail("worker_select", selection.message);
const version = selection.version;
manifest.worker_version_id = version.id;
manifest.worker_version_url = versionPreviewUrl(version.id, WORKER_NAME, WORKERS_SUBDOMAIN);
manifest.public_api_base = manifest.worker_version_url;
manifest.checks.worker_select = true;
log(`     OK — version ${version.id} (number ${version.number}) → ${manifest.worker_version_url}`);

/* ── 4. Santé du Worker sur l'URL versionnée ──────────────────────────────────────────────
 * Double concordance exigée : le SHA Git déclaré ET l'ID de version attribué par Cloudflare.
 * Le premier peut mentir (c'est une chaîne qu'on a passée en argument), le second non.
 *
 * Retente jusqu'à 90 s : on a observé le 11/08/2026 un ancien Worker répondre transitoirement
 * juste après un déploiement. La couche responsable n'a pas été établie — d'où une fenêtre
 * plutôt qu'une conclusion. */
log("4/7 Vérification de /v1/health sur l'URL versionnée…");
const healthUrl = `${manifest.worker_version_url}/v1/health`;
const deadline = Date.now() + HEALTH_TOTAL_MS;
let attempt = 0;
let lastDiag = "aucune tentative";
let healthy = false;

while (!healthy) {
  attempt++;
  const cb = `${Date.now()}-${attempt}`;
  try {
    const res = await fetch(`${healthUrl}?cb=${cb}`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      headers: { "cache-control": "no-cache" },
    });
    const body = await res.text();
    if (res.status !== 200) {
      lastDiag = `HTTP ${res.status} · corps=${body.slice(0, 200)} · en-têtes=${JSON.stringify(Object.fromEntries(res.headers))}`;
    } else {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        lastDiag = `JSON invalide · corps=${body.slice(0, 200)}`;
        parsed = null;
      }
      if (parsed) {
        manifest.worker_health_sha = parsed.sha ?? null;
        manifest.worker_health_version_id = parsed.worker_version_id ?? null;
        const m = healthMatches(parsed, manifest.git_sha, manifest.worker_version_id);
        if (m.ok) healthy = true;
        else lastDiag = `concordance incomplète · ${m.detail}`;
      }
    }
  } catch (e) {
    lastDiag = `erreur réseau : ${e.name} ${e.message}`;
  }
  if (healthy) break;
  if (Date.now() + HEALTH_INTERVAL_MS > deadline) {
    fail(
      "worker_health",
      `pas de double concordance après ${attempt} tentative(s) sur ${HEALTH_TOTAL_MS / 1000}s. Dernier état : ${lastDiag}`,
    );
  }
  log(`     tentative ${attempt} sans concordance (${lastDiag.slice(0, 120)}…), nouvelle tentative dans ${HEALTH_INTERVAL_MS / 1000}s`);
  await new Promise((r) => setTimeout(r, HEALTH_INTERVAL_MS));
}
manifest.checks.worker_health = true;
log(`     OK — double concordance obtenue à la tentative ${attempt}.`);

/* ── 5. Build Pages épinglé, puis déploiement ─────────────────────────────────────────────
 * `--api-base` est passé explicitement : le build ne doit jamais retomber sur l'alias mutable,
 * sinon toute la mécanique de versionnage ci-dessus ne sert à rien. */
log("5/7 Build Pages épinglé sur l'URL versionnée, puis déploiement…");
const build = run("node", ["packages/knowledge/scripts/build-preview.mjs", `--api-base=${manifest.worker_version_url}`], { capture: false });
if (build.status !== 0) fail("pages_build", "le build vérifié a échoué (voir la sortie ci-dessus).");
manifest.checks.pages_build = true;

const dep = run("npx", [
  "wrangler", "pages", "deploy", relative(REPO_ROOT, DIST_DIR),
  "--project-name", PAGES_PROJECT,
  "--branch", manifest.pages_branch,
  "--commit-hash", manifest.git_sha,
]);
if (dep.status !== 0) fail("pages_deploy", "`wrangler pages deploy` a échoué (voir la sortie ci-dessus).");

/* Wrangler 3.114.17 n'offre aucune sortie JSON pour `pages deploy` (vérifié dans `--help`) :
 * il faut lire ses URL dans le texte. Fragilité connue et assumée — d'où l'échec explicite
 * ci-dessous si les URL attendues sont absentes, plutôt qu'un manifeste aux champs vides. */
const out = dep.stdout + dep.stderr;
manifest.pages_immutable_url = out.match(/https:\/\/[0-9a-f]{8}\.[a-z0-9-]+\.pages\.dev/i)?.[0] ?? null;
manifest.pages_alias_url = out.match(new RegExp(`https://${manifest.pages_branch}\\.[a-z0-9-]+\\.pages\\.dev`, "i"))?.[0] ?? null;
if (!manifest.pages_immutable_url) {
  fail("pages_deploy", "déploiement Pages apparemment réussi, mais l'URL immuable n'a pas pu être lue dans la sortie de wrangler.");
}
manifest.pages_deployment_id_prefix = manifest.pages_immutable_url.match(/https:\/\/([0-9a-f]{8})\./i)?.[1] ?? null;
manifest.checks.pages_deploy = true;
log(`     OK — ${manifest.pages_immutable_url}`);

/* L'UUID complet du déploiement Pages n'est pas dans la sortie de `pages deploy`, mais il figure
 * dans celle de `pages deployment list` (signalé par Codex, 11/08/2026). On l'y retrouve par
 * appariement de PRÉFIXE avec l'URL immuable, sans dépendre de la mise en forme des colonnes ni
 * de l'ordre de la liste. Métadonnée de traçabilité, non bloquante : en cas d'échec on note
 * pourquoi et on continue, plutôt que de perdre un déploiement par ailleurs valide. */
const depList = run("npx", ["wrangler", "pages", "deployment", "list", "--project-name", PAGES_PROJECT], { capture: true });
if (depList.status === 0) {
  manifest.pages_deployment_id = extractPagesDeploymentId(depList.stdout + depList.stderr, manifest.pages_deployment_id_prefix);
}
if (!manifest.pages_deployment_id) {
  manifest.notes.push(
    `pages_deployment_id introuvable : aucun UUID unique commençant par « ${manifest.pages_deployment_id_prefix} » dans la sortie de \`pages deployment list\`. Seul le préfixe est conservé.`,
  );
}

/* ── 6. Smoke HTTP de la preview Pages ────────────────────────────────────────────────────
 * Passer le manifeste à `verified` dès que `pages deploy` renvoie 0 revient à certifier un
 * déploiement qu'on n'a jamais interrogé (relevé par Codex, 11/08/2026). On vérifie donc, sur
 * l'URL réellement publiée : réponse 200, `noindex` toujours en place, et — le point qui donne
 * son sens à toute la chaîne — le bundle servi porte bien l'URL Worker VERSIONNÉE et aucune
 * occurrence de l'alias mutable. */
log("6/7 Smoke HTTP de la preview publiée…");
const aliasBare = `https://${WORKER_NAME}.${WORKERS_SUBDOMAIN}`;
const smoke = await retryUntil(
  async (attempt) => {
    try {
      const res = await fetch(`${manifest.pages_immutable_url}/?cb=${Date.now()}-${attempt}`, {
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status !== 200) return { ok: false, detail: `page d'accueil HTTP ${res.status}` };
      const html = await res.text();
      if (!/<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)) {
        return { ok: false, detail: "la page d'accueil publiée ne porte pas de balise robots noindex" };
      }
      const chunks = extractHoistedChunks(html);
      if (chunks.length === 0) return { ok: false, detail: "aucun chunk hoisted référencé par la page d'accueil" };
      for (const c of chunks) {
        const jsRes = await fetch(`${manifest.pages_immutable_url}${c}`, { signal: AbortSignal.timeout(20_000) });
        if (jsRes.status !== 200) return { ok: false, detail: `${c} → HTTP ${jsRes.status}` };
        const js = await jsRes.text();
        if (!js.includes(manifest.worker_version_url)) continue;
        // Ce chunk porte l'URL versionnée : il ne doit contenir AUCUNE occurrence de l'alias nu.
        if (js.split(aliasBare).length - 1 > 0) {
          const versioned = js.split(manifest.worker_version_url).length - 1;
          const bare = js.split(aliasBare).length - 1;
          if (bare > versioned) return { ok: false, detail: `${c} contient l'alias mutable ${aliasBare}` };
        }
        return { ok: true, chunk: c };
      }
      return { ok: false, detail: `aucun chunk ne contient ${manifest.worker_version_url}` };
    } catch (e) {
      return { ok: false, detail: `erreur réseau : ${e.name} ${e.message}` };
    }
  },
  {
    totalMs: HEALTH_TOTAL_MS,
    intervalMs: HEALTH_INTERVAL_MS,
    onRetry: (attempt, detail) => log(`     tentative ${attempt} sans succès (${detail.slice(0, 110)}…)`),
  },
);
if (!smoke.ok) {
  fail("pages_smoke", `la preview publiée ne passe pas le smoke après ${smoke.attempt} tentative(s). Dernier état : ${smoke.lastDetail}`);
}
manifest.checks.pages_smoke = true;
log(`     OK — 200, noindex présent, bundle épinglé sur ${manifest.worker_version_url}.`);

/* ── 7. Manifeste ─────────────────────────────────────────────────────────────────────────── */
manifest.status = "verified";
manifest.failed_step = null;
const file = writeManifest();
log(`7/7 Manifeste écrit : ${relative(REPO_ROOT, file)}`);
log("");
log(`Preview vérifiée   : ${manifest.pages_immutable_url}`);
log(`Alias de branche   : ${manifest.pages_alias_url ?? "(non lu)"}`);
log(`Worker épinglé     : ${manifest.worker_version_url}`);
log("");
log("L'alias Worker partagé n'a PAS été modifié. Après contre-test navigateur concluant :");
log(`  npm run promote:preview-alias -- ${relative(REPO_ROOT, file)}`);

if (JSON_OUT) process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");
