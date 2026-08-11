#!/usr/bin/env node
/**
 * build-preview.mjs — construit `packages/ui/dist` pour un déploiement Cloudflare Pages
 * PREVIEW, avec `PUBLIC_API_BASE` toujours pointé sur le Worker de preview, et refuse de
 * déclarer le build utilisable si l'une des vérifications d'après-build échoue.
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
 *   node packages/knowledge/scripts/build-preview.mjs           # build réel + vérifications
 *   node packages/knowledge/scripts/build-preview.mjs --dry     # affiche le plan, ne build pas
 *
 * Idempotent : peut être relancé autant de fois que nécessaire, reproduit le même résultat.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { validateApiBase } from "./lib/preview-select.mjs";
import { requireNode } from "./lib/require-node.mjs";

requireNode("le build de preview");

/* Un argument non reconnu est une ERREUR, jamais un silence. Avant ce garde-fou (signalé par
 * Codex le 11/08/2026), `--dry --typo` réussissait sans rien dire : une faute de frappe sur
 * `--dry` lançait donc un build complet de 11 minutes au lieu de l'aperçu demandé, et — plus
 * grave dans l'autre sens — un futur drapeau mal orthographié serait ignoré sans avertir. */
const KNOWN_FLAGS = new Set(["--dry"]);
const KNOWN_VALUED = new Set(["--api-base"]);
const rawArgs = process.argv.slice(2);
const valued = new Map();
const unknownArgs = [];
for (const a of rawArgs) {
  const eq = a.indexOf("=");
  const key = eq === -1 ? a : a.slice(0, eq);
  if (KNOWN_FLAGS.has(a)) continue;
  if (KNOWN_VALUED.has(key) && eq !== -1 && a.slice(eq + 1)) valued.set(key, a.slice(eq + 1));
  else unknownArgs.push(a);
}
if (unknownArgs.length > 0) {
  console.error(`[build-preview] Argument(s) non reconnu(s) : ${unknownArgs.join(", ")}`);
  console.error(`[build-preview] Arguments acceptés : ${[...KNOWN_FLAGS].join(", ")}, --api-base=<url>`);
  process.exit(2);
}

const DRY = rawArgs.includes("--dry");

/* Adresse du Worker que le Finder appellera, inlinée dans le bundle au build.
 *
 * L'alias partagé ci-dessous n'est PAS immuable : il désigne le déploiement Worker actif du
 * moment. Un `dist/` construit contre lui voit donc son backend changer sous ses pieds à chaque
 * promotion ultérieure — les anciennes previews Pages ne sont alors immuables qu'en apparence
 * (leurs fichiers statiques le sont, pas le moteur qu'ils interrogent). Point soulevé par Codex
 * le 11/08/2026.
 *
 * Le workflow officiel (`npm run deploy:preview`) passe donc TOUJOURS `--api-base=<url versionnée>`,
 * propre à une version Worker précise. L'alias ne sert qu'aux builds manuels de dépannage, et ce
 * script le dit bruyamment plutôt que d'y retomber en silence. */
const WORKER_NAME = "mydogcanfly-api-preview";
const WORKERS_SUBDOMAIN = "fromparis.workers.dev";
const PREVIEW_ALIAS_API_BASE = `https://${WORKER_NAME}.${WORKERS_SUBDOMAIN}`;

/* `--api-base` n'accepte QU'UNE URL Worker versionnée conforme (durcissement du lot F, contre-revue
 * Codex du 11/08/2026). Accepter une URL arbitraire rouvrirait par la porte de derrière ce que le
 * drapeau existe précisément pour fermer : il suffirait de passer l'alias partagé — ou n'importe
 * quelle autre adresse — pour obtenir un build qui se croit épinglé sans l'être. */
if (valued.has("--api-base")) {
  const v = validateApiBase(valued.get("--api-base"), WORKER_NAME, WORKERS_SUBDOMAIN);
  if (!v.ok) {
    console.error(`[build-preview] ${v.message}`);
    process.exit(2);
  }
}
const PREVIEW_API_BASE = valued.get("--api-base") ?? PREVIEW_ALIAS_API_BASE;
const USING_ALIAS = !valued.has("--api-base");

// Le chemin appelé par le Finder. Sert à prouver que c'est bien l'îlot du Finder qui porte
// l'URL du Worker, et pas un fichier quelconque du bundle (voir vérification n°1).
const FINDER_PATH = "/v1/finder";

/* `fileURLToPath` et non `new URL(...).pathname` : ce dernier laisse les caractères
 * percent-encodés, donc un chemin de dépôt contenant une espace devient « .../mon%20dossier/... »
 * et toutes les lectures de fichiers échouent. Vérifié : pour /tmp/chemin avec espaces/repo/t.mjs,
 * `.pathname` rend « /tmp/chemin%20avec%20espaces/repo/t.mjs », `fileURLToPath` rend le vrai
 * chemin. Signalé par Codex le 11/08/2026 ; latent aujourd'hui (le chemin actuel n'a pas
 * d'espace) mais c'est une panne totale le jour où il en aurait une. */
const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const DIST_DIR = join(REPO_ROOT, "packages/ui/dist");
const ASTRO_DIR = join(DIST_DIR, "_astro");

const rel = (p) => relative(REPO_ROOT, p);
const log = (msg) => console.log(`[build-preview] ${msg}`);

function fail(msg) {
  console.error(`[build-preview] ÉCHEC : ${msg}`);
  console.error("[build-preview] NE PAS DÉPLOYER ce dist/.");
  process.exit(1);
}

/* `PUBLIC_SITE_ENV` est fixé EXPLICITEMENT à "preview", et non simplement retiré de
 * l'environnement hérité. Raison (soulevée par Codex le 11/08/2026, vérifiée dans la source de
 * Vite 5.4.21, fonction `loadEnv`) : Vite lit d'abord les fichiers `.env`/`.env.production`,
 * PUIS écrase avec les variables de `process.env`. Retirer la variable laisserait donc un futur
 * `.env.production` (aucun n'existe aujourd'hui, mais rien ne l'interdit) fournir
 * `PUBLIC_SITE_ENV=production` à Astro — et un build de preview deviendrait indexable.
 * La fixer à "preview" gagne dans tous les cas, puisque `process.env` est appliqué en dernier. */
const childEnv = { ...process.env, PUBLIC_API_BASE: PREVIEW_API_BASE, PUBLIC_SITE_ENV: "preview" };

log(`PUBLIC_API_BASE=${PREVIEW_API_BASE}`);
log('PUBLIC_SITE_ENV=preview (fixé explicitement — le preview doit rester noindex)');

if (USING_ALIAS) {
  console.error("[build-preview] ────────────────────────────────────────────────────────────");
  console.error("[build-preview] AVERTISSEMENT : build construit contre l'ALIAS Worker partagé,");
  console.error("[build-preview] qui n'est pas immuable — le backend de ce dist/ changera à chaque");
  console.error("[build-preview] promotion ultérieure de l'alias.");
  console.error("[build-preview] Convient au dépannage manuel. NE PAS s'en servir pour une preview");
  console.error("[build-preview] soumise à contre-test : utiliser `npm run deploy:preview`, qui");
  console.error("[build-preview] épingle le build sur une URL Worker versionnée.");
  console.error("[build-preview] ────────────────────────────────────────────────────────────");
}

if (DRY) {
  log("--dry : build non exécuté. Commande qui serait lancée :");
  log("  npm -w @mydogcanfly/ui run build");
  log("Vérifications bloquantes qui suivraient :");
  log(`  1. un MÊME fichier .js de ${rel(ASTRO_DIR)} contient "${PREVIEW_API_BASE}" ET "${FINDER_PATH}"`);
  log(`  2. TOUTES les pages HTML de ${rel(DIST_DIR)} portent une balise <meta name="robots" ... noindex>`);
  process.exit(0);
}

log("Build en cours (npm -w @mydogcanfly/ui run build)…");
const build = spawnSync("npm", ["-w", "@mydogcanfly/ui", "run", "build"], {
  cwd: REPO_ROOT,
  env: childEnv,
  stdio: "inherit",
});
if (build.status !== 0) fail("le build Astro a échoué (voir la sortie ci-dessus).");

/* ── Vérification 1 : le Finder est réellement câblé sur le Worker ────────────────────────
 * On exige que l'URL du Worker et le chemin `/v1/finder` se trouvent dans le MÊME chunk, sans
 * jamais s'appuyer sur son nom de fichier (haché, il change à chaque build). Chercher les deux
 * chaînes séparément dans tout le dossier ne prouverait rien : elles pourraient vivre dans deux
 * fichiers sans rapport. Le test reste valable que esbuild replie ou non le gabarit
 * `${API_BASE}/v1/finder` en une seule chaîne — dans les deux cas les deux sous-chaînes sont
 * présentes dans le fichier. */
let finderChunk = null;
let sawApiBase = false;
try {
  for (const f of readdirSync(ASTRO_DIR)) {
    if (!f.endsWith(".js")) continue;
    const src = readFileSync(join(ASTRO_DIR, f), "utf8");
    const hasApiBase = src.includes(PREVIEW_API_BASE);
    if (hasApiBase) sawApiBase = true;
    if (hasApiBase && src.includes(FINDER_PATH)) {
      finderChunk = f;
      break;
    }
  }
} catch (e) {
  fail(`impossible de lire ${rel(ASTRO_DIR)} après le build (${e.message}).`);
}
if (!finderChunk) {
  fail(
    sawApiBase
      ? `l'URL du Worker est présente dans le bundle, mais aucun chunk ne contient à la fois "${PREVIEW_API_BASE}" et "${FINDER_PATH}". ` +
          "Le Finder n'est donc pas démontrablement câblé sur le Worker de preview."
      : `aucun chunk de ${rel(ASTRO_DIR)} ne contient "${PREVIEW_API_BASE}". ` +
          "Le Finder de ce build appellera l'endpoint statique inerte de Pages, pas le Worker."
  );
}
log(`OK — Finder câblé sur le Worker : "${PREVIEW_API_BASE}" et "${FINDER_PATH}" dans le même chunk (${finderChunk}).`);

/* ── Vérification 2 : AUCUNE page indexable ───────────────────────────────────────────────
 * On parcourt la totalité des HTML produits et on exige que chacun porte une balise robots
 * `noindex`. Le contrôle précédent ("au moins une page") était un faux garde-fou, signalé par
 * Codex le 11/08/2026 et confirmé dans Base.astro (l. 125-127) : les pages passant
 * `noindex={true}` — les 404, le lab, la Bible — émettent `noindex, follow` MÊME en production.
 * Un build de production entier serait donc passé pour un preview valide. */
const ROBOTS_NOINDEX = /<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i;

function collectHtml(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectHtml(full, out);
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

const htmlFiles = collectHtml(DIST_DIR);
if (htmlFiles.length === 0) fail(`aucune page HTML trouvée dans ${rel(DIST_DIR)} — build incomplet ?`);

const indexable = htmlFiles.filter((f) => !ROBOTS_NOINDEX.test(readFileSync(f, "utf8")));
if (indexable.length > 0) {
  console.error(`[build-preview] ${indexable.length} page(s) sans balise robots noindex, dont :`);
  for (const f of indexable.slice(0, 10)) console.error(`    ${rel(f)}`);
  if (indexable.length > 10) console.error(`    … et ${indexable.length - 10} autre(s)`);
  fail("un preview ne doit exposer aucune page indexable.");
}
log(`OK — les ${htmlFiles.length} pages HTML portent toutes une balise robots noindex.`);

log(`Build preview prêt : ${rel(DIST_DIR)}`);
log("Prochaine étape : npx wrangler pages deploy packages/ui/dist --project-name=mydogcanfly-v2-preview --branch=<nom> [--commit-hash=<sha>]");
