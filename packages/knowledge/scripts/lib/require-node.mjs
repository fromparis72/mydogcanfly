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

export function requireNode(scriptLabel = "ce script") {
  const major = Number(process.versions.node.split(".")[0]);
  if (major === REQUIRED_MAJOR) return;

  const lines = [
    `Node ${process.versions.node} détecté — ${scriptLabel} exige Node ${REQUIRED_MAJOR}.x.`,
    "",
    `Le dépôt épingle Node ${REQUIRED_MAJOR} (.nvmrc et le champ "engines"). Un build Astro complet`,
    "sous une autre version majeure échoue tardivement, après plusieurs milliers de pages, sur une",
    "erreur qui ne mentionne jamais Node — constaté sous 24.18.0 le 11/08/2026.",
    "",
    "Pour corriger :",
    "  nvm use            # lit le .nvmrc du dépôt",
    `  nvm install ${REQUIRED_MAJOR}      # si cette version n'est pas installée`,
    "",
    "Puis relancer la même commande.",
  ];
  for (const l of lines) process.stderr.write(`[node-guard] ${l}\n`);
  process.exit(3);
}
