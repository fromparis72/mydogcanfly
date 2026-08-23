#!/usr/bin/env node
/**
 * build-ci.mjs — build RÉDUIT destiné à l'intégration continue, et à elle seule.
 *
 * Mesuré le 11/08/2026 : 36 s et 97 pages, contre ~12 min et 2949 pages pour le build complet.
 * L'écart vient des pages d'entités (aéroports, races, pays, compagnies, guides), 2728 pages qui
 * n'apportent rien aux contrôles exécutés sur une pull request : les harnais DOM lisent la page
 * d'accueil dans les 4 langues et `/tools/fiche`, toutes présentes ici.
 *
 * … SAUF LES SENTINELLES (15/08/2026). « Rien à apporter » était faux, et le contre-test
 * navigateur l'a montré : trois anomalies vivaient sur les pages d'entités, qu'AUCUN contrôle
 * automatique ne regardait — puisque `BUILD_ONLY=__none__` n'en construisait aucune. Documenter
 * le prérequis n'aurait rien refermé ; il fallait que la CI en CONSTRUISE.
 *
 * Quatre fiches compagnies couvrent les quatre formes de décision (offerte, non offerte, non
 * documentée mais auditée, non revérifiée) et une page pays couvre `CountryOnward` — c'est le
 * minimum qui rende `test-entity-pages-harness.mjs` exécutable, et il tient dans le budget de
 * temps. Les deux familles sont construites EN UNE SEULE PASSE : `dist` est purgé à chaque
 * build Astro, donc deux commandes successives se nettoieraient l'une l'autre.
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
 * `--complet` — MÊME sentinelle, MÊME environnement, mais SANS les filtres d'entités : le site
 * entier. Ajouté le 19/08/2026 pour les contre-épreuves de `test-annonce-du-site.mjs`, qui
 * confrontent les `hreflang` et les sitemaps aux pages construites : sous le build réduit, elles
 * échoueraient parce que les pages manquent, pas parce que la mutation a mordu — c'est-à-dire
 * qu'elles prouveraient le vide. Le drapeau vit ICI et non dans un second script pour que
 * l'adresse sentinelle reste écrite UNE fois : deux copies finissent toujours par diverger.
 *
 *   npm run build:ci              le site réduit (pull request)
 *   npm run build:ci -- --complet le site entier, même sentinelle (~12 min)
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { requireNode } from "./lib/require-node.mjs";
import { ecrireProvenance, environnementDeBuild, ErreurProvenance } from "./lib/provenance.mjs";
import { BUILD_ONLY_SENTINELLES, BUILD_SLUGS_SENTINELLES } from "./lib/sentinelles-entites.mjs";



requireNode("le build de CI");

/* Un argument non reconnu est une ERREUR, jamais un silence — même garde-fou que build-preview.mjs :
 * `--complte` construirait sinon un site réduit en croyant l'avoir demandé entier, et les
 * contre-épreuves échoueraient faute de pages, sans que rien ne dise pourquoi. */
const COMPLET = process.argv.includes("--complet");
const inconnus = process.argv.slice(2).filter((a) => a !== "--complet");
if (inconnus.length > 0) {
  process.stderr.write(`[build-ci] Argument(s) non reconnu(s) : ${inconnus.join(", ")}\n`);
  process.stderr.write("[build-ci] Argument accepté : --complet\n");
  process.exit(2);
}

const SENTINEL_API_BASE = "https://00000000-mydogcanfly-api-preview.fromparis.workers.dev";
const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const log = (m) => process.stderr.write(`[build-ci] ${m}\n`);

log(`PUBLIC_API_BASE=${SENTINEL_API_BASE} (sentinelle : aucune requête réseau attendue)`);
log(COMPLET
  ? "PUBLIC_SITE_ENV=preview · site ENTIER (--complet) : aucun filtre d'entités"
  : `PUBLIC_SITE_ENV=preview · BUILD_ONLY=${BUILD_ONLY_SENTINELLES} · BUILD_SLUGS=${BUILD_SLUGS_SENTINELLES}`);

/* L'ENVIRONNEMENT DU BUILD est fabriqué par `lib/provenance.mjs` et par lui seul : il REFUSE
 * `OUTDIR` — qui ferait écrire Astro ailleurs que dans le dossier scellé et mesuré — et RETIRE
 * les filtres hérités (`BUILD_ONLY`, `BUILD_SLUGS`, `BUILD_SHARDS`, `BUILD_SHARD`) avant que les
 * surcharges nommées ci-dessous ne s'appliquent.
 *
 * C'est ce retrait qui rend `--complet` honnête : jusqu'au 22/08/2026 le mode complet se
 * contentait de ne RIEN ajouter (`...(COMPLET ? {} : …)`), si bien qu'un `BUILD_ONLY` hérité d'un
 * shell ou d'un essai précédent survivait — et produisait un « site complet » amputé, scellé
 * comme complet. Codex l'a relevé le même jour, avec `BUILD_SHARDS`/`BUILD_SHARD` qui amputent
 * de la même façon sans même nommer ce qu'ils retirent. */
let childEnv;
try {
  childEnv = environnementDeBuild(process.env, {
    PUBLIC_API_BASE: SENTINEL_API_BASE,
    PUBLIC_SITE_ENV: "preview",
    /* Les deux familles d'entités, réduites à leurs sentinelles, dans la MÊME passe. Les autres
       familles (races, aéroports, guides) restent hors du build réduit ; les pages qui ne sont
       pas des entités (accueil, outils) ne passent pas par ce filtre et sont construites. */
    ...(COMPLET ? {} : {
      BUILD_ONLY: BUILD_ONLY_SENTINELLES,
      BUILD_SLUGS: BUILD_SLUGS_SENTINELLES,
    }),
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
  log("ÉCHEC : le build réduit a échoué (voir la sortie ci-dessus).");
  process.exit(1);
}
log(COMPLET
  ? "Site ENTIER prêt. Les harnais lisant packages/ui/dist peuvent tourner."
  : "Build réduit prêt. Les harnais lisant packages/ui/dist peuvent tourner.");

/* La carte d'identité du site : voir lib/provenance.mjs. Les paramètres du build en font partie,
   c'est ce qui distingue un site réduit d'un site complet — et c'est `childEnv`, l'environnement
   RÉELLEMENT passé au build, qui est inscrit : une seconde reconstitution « à la main » de ces
   variables finirait par mentir le jour où l'une des deux changerait sans l'autre.

   Un échec ici est BLOQUANT : un `dist` sans carte est un dossier dont plus rien ne dit de quelle
   version il sort, et les harnais qui le lisent le refuseraient de toute façon. Mieux vaut que le
   build le dise tout de suite, et avec le motif. */
try {
  ecrireProvenance(join(REPO_ROOT, "packages", "ui", "dist"), COMPLET ? "complet" : "reduit", childEnv);
} catch (e) {
  if (!(e instanceof ErreurProvenance)) throw e;
  log(`ÉCHEC : la carte d'identité du site n'a pas pu être écrite — ${e.message}`);
  process.exit(1);
}
