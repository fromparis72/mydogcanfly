/**
 * Garde de version de Node, à appeler en tête de tout script qui construit ou déploie.
 *
 * Pourquoi une garde plutôt que le seul `.nvmrc` : `.nvmrc` est une *indication* lue par `nvm use`
 * quand on pense à le taper. Il ne change rien au Node par défaut du shell. Le 11/08/2026, le
 * `.nvmrc` était en place et le build a quand même tourné sous Node 24.18.0 — il a échoué après
 * plusieurs milliers de pages, sur un `ENOENT` dans `dist/chunks/`, c'est-à-dire de la manière la
 * moins lisible possible : une dizaine de minutes perdues et un diagnostic qui a mobilisé trois
 * personnes avant qu'on identifie la version de Node.
 *
 * `engines` dans package.json ne suffit pas non plus : npm n'en fait qu'un avertissement, sauf
 * `engine-strict`, et il ne couvre pas un script lancé directement par `node`.
 *
 * La garde échoue donc en une seconde, avec la marche à suivre, avant d'avoir rien construit.
 * Demandée par Codex le 11/08/2026.
 */
const REQUIRED_MAJOR = 22;
/* Plancher PRÉCIS dans la lignée 22, aligné sur le lockfile — et le lockfile est plus exigeant
 * qu'on ne le pensait : jsdom@30.0.1 déclare `engines: ^22.22.2 || ^24.15.0 || >=26.0.0` (vérifié
 * dans package-lock.json ; ses dépendances @asamuzakjp/* demandent ^22.13.0 et undici >=22.19.0,
 * mais c'est jsdom qui fixe le plancher réel). Un Node 22.5 passerait la garde de majeure et
 * casserait quand même `npm ci`. `.nvmrc`, `engines`, cette garde et la CI pointent donc tous la
 * même version : 22.22.2. */
const REQUIRED_MIN = [22, 22, 2];

export function requireNode(scriptLabel = "ce script") {
  const parts = process.versions.node.split(".").map(Number);
  const major = parts[0];
  const atLeastMin =
    major === REQUIRED_MIN[0] &&
    (parts[1] > REQUIRED_MIN[1] || (parts[1] === REQUIRED_MIN[1] && parts[2] >= REQUIRED_MIN[2]));
  if (atLeastMin) return;

  const minStr = REQUIRED_MIN.join(".");
  const lines = [
    `Node ${process.versions.node} détecté — ${scriptLabel} exige Node ${REQUIRED_MAJOR}.x (≥ ${minStr}).`,
    "",
    `Le dépôt épingle Node ${REQUIRED_MAJOR} (.nvmrc et le champ "engines"). Un build Astro complet`,
    "sous une autre version majeure échoue tardivement, après plusieurs milliers de pages, sur une",
    "erreur qui ne mentionne jamais Node — constaté sous 24.18.0 le 11/08/2026.",
    "",
    "Pour corriger :",
    "  nvm use            # lit le .nvmrc du dépôt",
    `  nvm install ${minStr}   # si cette version n'est pas installée`,
    "",
    "Puis relancer la même commande.",
  ];
  for (const l of lines) process.stderr.write(`[node-guard] ${l}\n`);
  process.exit(3);
}

/* Exécutable aussi en ligne de commande, pour précéder les scripts npm qui ne sont pas des .mjs
 * à nous (build, build:prod, release délèguent à `astro build`) :
 *   node packages/knowledge/scripts/lib/require-node.mjs "le build de production"
 * Sort en 0 si la version convient, en 3 sinon — ce qui coupe la chaîne `&&` du script npm. */
import { fileURLToPath as __f } from "node:url";
if (process.argv[1] && __f(import.meta.url) === (await import("node:path")).resolve(process.argv[1])) {
  requireNode(process.argv[2] ?? "ce script");
}
