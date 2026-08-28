#!/usr/bin/env node
/**
 * `npm run release` — RETIRÉ, et le refus est le contrôle.
 *
 * CE QUE CE SCRIPT REMPLACE, ET POURQUOI. Jusqu'au 28/08/2026, `release` faisait :
 *
 *     build:prod && verify:index && npx wrangler pages deploy packages/ui/dist \
 *       --project-name=… --branch=main --commit-dirty=true
 *
 * Quatre choses manquaient, et la dernière est la pire :
 *   · aucune PORTE — ni indexabilité, ni sitemaps, ni canoniques, ni routage exercé ;
 *   · aucune CONCORDANCE après publication — rien ne vérifiait que le déploiement envoyé est
 *     bien devenu la production active, au bon commit ;
 *   · aucun CONTRE-TEST HTTP et aucun ROLLBACK — un site cassé le restait ;
 *   · `--commit-dirty=true` acceptait explicitement un arbre SALE : le site publié ne
 *     correspondait alors à aucun commit, et plus rien ne pouvait le dire après coup.
 *
 * Contre-revue Codex du 28/08/2026 (P0-1) : « l'ancienne porte de production reste ouverte ».
 * Elle l'était. Elle ne l'est plus : le seul chemin vers la production est
 * `deployer-production.mjs`, qui scelle, juge, déploie, constate et revient en arrière au
 * premier écart. Ce script-ci ne déploie RIEN — il refuse, et il nomme la commande exacte.
 *
 * Le refus vaut mieux qu'une délégation silencieuse : le déployeur exige `--sha=<40 hex>`
 * ÉCRIT PAR L'OPÉRATEUR, parce que « le SHA que je crois déployer » est précisément ce que la
 * porte confronte à la carte de provenance de l'artefact. Un `release` qui le déduirait tout
 * seul rendrait ce contrôle décoratif.
 */
import { spawnSync } from "node:child_process";

const git = (...a) => {
  const r = spawnSync("git", a, { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};
const sha = git("rev-parse", "HEAD");
const sale = git("status", "--porcelain");

process.stderr.write(`
[release] RETIRÉ — ce script ne déploie plus rien.

  Il reconstruisait puis appelait « wrangler pages deploy » directement : sans porte de
  lancement, sans concordances après publication, sans contre-test HTTP, sans rollback, et
  avec « --commit-dirty=true », c'est-à-dire en acceptant un arbre de travail SALE.

  LE SEUL CHEMIN VERS LA PRODUCTION :

    1. npm run build:production -- --same-origin      (build scellé, carte de provenance)
    2. npm run porte -- --dist=packages/ui/dist --attendu=production --sha=<sha>
    3. npm run deployer:production -- --sha=<sha>     (--repetition pour un essai hors réseau)

  Le déployeur refait lui-même 1-bis et 2 avant tout appel réseau : il ne fait confiance à
  aucun verdict antérieur.

${sha ? `  HEAD est actuellement ${sha}${sale ? "  — ARBRE SALE : aucun artefact scellé ne peut en sortir." : ""}` : "  (HEAD illisible : hors dépôt git ?)"}
`);
process.exit(2);
