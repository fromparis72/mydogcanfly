#!/usr/bin/env node
/**
 * build-production.mjs — le build PRODUCTION scellé, seul artefact que la porte de lancement
 * accepte de juger en `--attendu=production`.
 *
 * Pourquoi un wrapper et pas `npm run build:prod` nu : la porte (porte-lancement.mjs) REFUSE
 * tout `dist` sans carte d'identité — et `build:prod` n'en écrivait pas. Ce wrapper réutilise
 * LE contrat de provenance du dépôt (`lib/provenance.mjs` : environnement épuré, entrées par
 * paquets entiers, propreté à échec fermé, empreinte exacte du dist) — jamais un second
 * contrat : deux copies finissent toujours par diverger, c'est écrit dans l'en-tête du module
 * lui-même, et la v2 de la conception de la porte a fait exactement cette faute avant d'être
 * contre-revue.
 *
 * L'ADRESSE D'API EST UN CHOIX EXPLICITE, jamais un défaut :
 *   --same-origin   PRODUCTION RÉELLE : PUBLIC_API_BASE vide, le bundle appelle /v1/* sur le
 *                   même domaine. C'est la seule forme déployable.
 *   --sentinelle    CI : une URL Worker versionnée syntaxiquement conforme mais inexistante —
 *                   la CI n'a pas à joindre Cloudflare, et la porte (P10) sait qu'un build à
 *                   sentinelle n'est PAS déployable, la provenance en portant la trace.
 * Sans drapeau, refus : un build production dont on ne sait pas dire quelle API il appelle
 * n'est ni testable ni déployable.
 *
 *   node packages/knowledge/scripts/build-production.mjs --same-origin   # production réelle
 *   node packages/knowledge/scripts/build-production.mjs --sentinelle    # CI, jamais déployé
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { requireNode } from "./lib/require-node.mjs";
import { ecrireProvenance, environnementDeBuild, ErreurProvenance } from "./lib/provenance.mjs";

requireNode("le build de production");

const SENTINEL_API_BASE = "https://00000000-mydogcanfly-api-preview.fromparis.workers.dev";
const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const log = (m) => process.stderr.write(`[build-production] ${m}\n`);

const args = process.argv.slice(2);
const SAME_ORIGIN = args.includes("--same-origin");
const SENTINELLE = args.includes("--sentinelle");
const inconnus = args.filter((a) => a !== "--same-origin" && a !== "--sentinelle");
if (inconnus.length > 0) {
  log(`Argument(s) non reconnu(s) : ${inconnus.join(", ")}`);
  log("Arguments acceptés : --same-origin (production réelle) OU --sentinelle (CI).");
  process.exit(2);
}
if (SAME_ORIGIN === SENTINELLE) {
  log("Choisir EXACTEMENT un mode d'API : --same-origin (production réelle) ou --sentinelle (CI).");
  log("Un build production sans choix d'API explicite n'est ni testable ni déployable.");
  process.exit(2);
}

const apiBase = SAME_ORIGIN ? "" : SENTINEL_API_BASE;
log(`PUBLIC_SITE_ENV=production · PUBLIC_API_BASE=${apiBase === "" ? "(vide — same-origin)" : apiBase}`);
log(SAME_ORIGIN
  ? "Mode PRODUCTION RÉELLE : cet artefact, une fois vert à la porte, est déployable tel quel."
  : "Mode CI (sentinelle) : cet artefact sert à juger, JAMAIS à déployer.");

let childEnv;
try {
  childEnv = environnementDeBuild(process.env, {
    PUBLIC_API_BASE: apiBase,
    PUBLIC_SITE_ENV: "production",
    /* Site ENTIER : aucun filtre — environnementDeBuild a déjà neutralisé les hérités. */
  });
} catch (e) {
  if (!(e instanceof ErreurProvenance)) throw e;
  log(`ÉCHEC : ${e.message}`);
  process.exit(2);
}

const r = spawnSync("npm", ["-w", "@mydogcanfly/ui", "run", "build"], {
  cwd: REPO_ROOT,
  env: childEnv,
  stdio: ["ignore", 2, 2],
});
if (r.status !== 0) {
  log("ÉCHEC : le build production a échoué (voir la sortie ci-dessus).");
  process.exit(1);
}

/* La carte d'identité — bloquante : un dist sans carte n'est jugeable par rien. Elle porte le
   SHA, la propreté (échec fermé), les entrées, les PARAMÈTRES réellement passés (dont
   PUBLIC_SITE_ENV=production et le PUBLIC_API_BASE choisi) et l'empreinte exacte du dist :
   c'est elle que la porte relit, et elle que le déployeur revérifie avant d'envoyer CES octets. */
try {
  ecrireProvenance(join(REPO_ROOT, "packages", "ui", "dist"), "complet", childEnv);
} catch (e) {
  if (!(e instanceof ErreurProvenance)) throw e;
  log(`ÉCHEC : la carte d'identité du site n'a pas pu être écrite — ${e.message}`);
  process.exit(1);
}

/* Garde-fou existant du dépôt : accueils indexables, robots ouvert, sitemap déclaré. */
const check = spawnSync(process.execPath, [join(REPO_ROOT, "packages/knowledge/scripts/check-prod-build.mjs")], {
  cwd: REPO_ROOT, stdio: ["ignore", 2, 2],
});
if (check.status !== 0) {
  log("ÉCHEC : check-prod-build refuse cet artefact (voir ci-dessus).");
  process.exit(1);
}
log("Build production scellé et conforme. Prochaine étape : la porte, en --attendu=production.");
