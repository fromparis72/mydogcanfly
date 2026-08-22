#!/usr/bin/env node
/**
 * LES CONTRE-ÉPREUVES, MÉCANISÉES.
 *
 *   npm run contre-epreuves            les mutations du moteur et des données (rapide)
 *   npm run contre-epreuves -- --dom   y ajoute celles de l'interface (chacune exige un build)
 *   npm run contre-epreuves -- --dist-complet  celles qui LISENT un site complet déjà construit
 *   npm run contre-epreuves -- --complet       celles qui exigent de RECONSTRUIRE le site entier
 *
 * TROIS BESOINS DISTINCTS, ET LES CONFONDRE COÛTE CHER. Une mutation qui touche une SOURCE DU SITE
 * oblige à reconstruire ; une mutation qui touche un OUTIL D'ANALYSE — l'audit, par exemple — n'y
 * change rien : le site déjà construit lui suffit. Confondre les deux ajoutait trois builds de
 * douze minutes pour rien.
 *
 * POURQUOI CE FICHIER EXISTE. Un harnais vert ne prouve rien tant qu'on n'a pas montré qu'il sait
 * rougir. Depuis dix tours de contre-revue, chaque garantie de ce chantier a été éprouvée en
 * cassant À LA MAIN ce qu'elle protège — et c'est exactement là que la contre-revue m'a repris le
 * plus souvent : un contrôle qui compte au lieu d'identifier, un `||` entre deux effets attendus,
 * un repli qui transforme une absence en valeur bénigne. Ce qui est manuel s'oublie ; ce qui est
 * mécanique se rejoue.
 *
 * CHAQUE MUTATION DÉCLARE CE QU'ELLE DOIT PROVOQUER — pas seulement « un échec ». Le harnais visé
 * doit sortir en code non nul ET publier le diagnostic attendu : un import cassé, une exception
 * précoce ou un processus tué ne sont pas la preuve qu'une garantie porte. C'est la leçon de la
 * contre-revue du 17/08/2026 sur les six contre-épreuves du simulateur.
 *
 * TROIS ÉTATS POSSIBLES, ET ILS SONT DISTINCTS :
 *   · la mutation ne s'applique pas   → ÉCHEC DUR. Le code a bougé sous la mutation, qui est
 *                                        devenue muette : elle ne prouverait plus rien en silence.
 *   · elle s'applique, rien ne rougit → ÉCHEC. La garantie ne porte pas.
 *   · elle s'applique, le bon contrôle rougit → la garantie porte.
 *
 * L'arbre est restauré quoi qu'il arrive, et sa propreté est vérifiée à la fin.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const AVEC_DOM = process.argv.includes("--dom");
/* Certaines garanties ne se lisent que sur le site ENTIER — l'audit, par exemple, refuse de
 * conclure sous 1 500 pages. Sous le build réduit, leur harnais échouerait faute de matière et non
 * parce que la mutation a mordu : il prouverait le vide. Elles sont donc derrière un drapeau
 * distinct, parce qu'elles coûtent un build complet chacune, et le total ci-dessous dit toujours
 * combien n'ont PAS été jouées. */
const AVEC_COMPLET = process.argv.includes("--complet");
/* `--dist-complet` : la mutation ne touche pas le site, elle touche ce qui le LIT. Aucun build
 * n'est nécessaire — mais un `dist` complet, si, et son absence doit faire échouer plutôt que
 * laisser le harnais lire un message d'arrêt. */
const AVEC_DIST_COMPLET = process.argv.includes("--dist-complet");

/* ---- LE CATALOGUE ---------------------------------------------------------------------------
 * `editions` : une ou plusieurs substitutions, chacune devant apparaître EXACTEMENT une fois —
 * une chaîne ambiguë muterait un endroit qu'on ne contrôle pas. `attendu` est le fragment du
 * diagnostic qui prouve qu'on a bien mis en défaut l'assertion visée, et pas une autre.
 *
 * POURQUOI PLUSIEURS ÉDITIONS. Une mutation doit décrire la régression RÉELLEMENT dangereuse, pas
 * la plus petite modification possible. Deux gardes de l'interface ne se relâchent qu'ensemble :
 * retirer la seule vérification laisse le rendu échouer, et le visiteur voit le message d'erreur
 * prévu — désagréable, mais honnête. C'est en REMETTANT AUSSI le repli permissif qu'on obtient
 * l'état à craindre : un rapport publié comme s'il n'avait aucun avis. Muter l'un sans l'autre
 * aurait fait croire que la garantie ne porte pas ; c'est le runner qui l'a montré. */
const MUTATIONS = [
  // ---- Le contrat : causes, preuves, rôles ----
  {
    nom: "l'accord causes ↔ preuves est neutralisé",
    fichier: "packages/engine/src/contracts.ts",
    cherche: "export const PlacementDecision = PlacementDecisionShape.superRefine((d, ctx) => {",
    remplace: "export const PlacementDecision = PlacementDecisionShape.superRefine((d, ctx) => { if (1) return;",
    harnais: "test-t0b3a-contrat-preuves.mjs",
    attendu: "exigence SANS preuve → REFUSÉE",
  },
  {
    nom: "un tableau de preuves VIDE redevient acceptable",
    fichier: "packages/engine/src/contracts.ts",
    cherche: "const EvidenceArray = z.array(RestrictionEvidence).min(1);",
    remplace: "const EvidenceArray = z.array(RestrictionEvidence);",
    harnais: "test-t0b3a-contrat-preuves.mjs",
    attendu: "`allowed` avec `evidence: []` → refusé",
  },
  {
    nom: "les rôles de preuve ne sont plus contraints par le statut",
    fichier: "packages/engine/src/contracts.ts",
    cherche: "  const admis = ROLES_ADMIS[d.status];",
    remplace: '  const admis = ["authorisation", "requirement", "refusal"];',
    harnais: "test-t0b3a-moteur-race.mjs",
    attendu: "`allowed` + refus → refusé",
  },
  {
    nom: "un avis peut à nouveau répéter le même canal",
    fichier: "packages/engine/src/contracts.ts",
    cherche: `  placements: z.array(Placement).min(1).refine((p) => new Set(p).size === p.length, {
    message: "placements : doublon",
  }),`,
    remplace: "  placements: z.array(Placement).min(1),",
    harnais: "test-t0b3a-contrat-preuves.mjs",
    attendu: "canaux DUPLIQUÉS",
  },
  // ---- `explain` : ce qui atteint le rapport ----
  {
    nom: "les preuves sont perdues quand `entryAllowed` dégrade le statut",
    fichier: "packages/engine/src/explain.ts",
    cherche: "        d.evidence);",
    remplace: "        );",
    harnais: "test-t0b3a-contrat-preuves.mjs",
    attendu: "la PREUVE DE RACE survit à la reconstruction",
  },
  {
    nom: "les preuves n'atteignent plus les sources du rapport",
    fichier: "packages/engine/src/explain.ts",
    cherche: "    for (const d of placement_decisions) {\n      for (const e of d.evidence ?? []) {",
    remplace: "    for (const d of []) {\n      for (const e of d.evidence ?? []) {",
    harnais: "test-t0b3a-moteur-race.mjs",
    attendu: "atteignent `report.sources`",
  },
  {
    nom: "une restriction compte autant de fois qu'elle est portée (déduplication retirée)",
    fichier: "packages/engine/src/explain.ts",
    cherche: `        if (!preuvesDeRaceVues.has(e.restriction_ref)) {
          preuvesDeRaceVues.add(e.restriction_ref);
          confidences.push(e.source.confidence);
        }`,
    remplace: "        confidences.push(e.source.confidence);",
    harnais: "test-t0b3a-moteur-race.mjs",
    attendu: "une restriction, un vote",
  },
  {
    nom: "la confiance ne pèse plus sur le score",
    fichier: "packages/engine/src/explain.ts",
    cherche: "  const confidenceRatio = Math.max(0, Math.min(1, avgConfidence / 5));",
    remplace: "  const confidenceRatio = 0;",
    harnais: "test-t0b3a-moteur-race.mjs",
    attendu: "la confiance publiée ET le score se déplacent",
  },
  // ---- `evaluate` : motifs, avis, registre ----
  {
    nom: "un refus de race ne porte plus son motif",
    fichier: "packages/engine/src/evaluate.ts",
    cherche: "        placement: x.decision.placement, fires: x.fires, breedDeny: x.breedDeny }))),",
    remplace: "        placement: x.decision.placement, fires: x.fires }))),",
    harnais: "test-t0b3a-moteur-race.mjs",
    attendu: "motif `breed_restricted`",
  },
  {
    nom: "les avis sont collectés avant le filtre des itinéraires — donc orphelins",
    fichier: "packages/engine/src/evaluate.ts",
    cherche: "  const advisories: AdvisorySignal[] = airlineDecisions",
    remplace: "  const advisories: AdvisorySignal[] = airlineDecisionsRaw",
    harnais: "test-t0b3a-moteur-race.mjs",
    attendu: "aucun avis de compagnie ne survit à sa compagnie",
  },
  {
    nom: "un registre de race absent redevient « aucun fait audité »",
    fichier: "packages/knowledge/src/normalize.ts",
    cherche: `  if (!Array.isArray(raw.breed_restrictions)) {
    throw new Error("normalize: \`breed_restrictions\` ABSENT — un registre vide s'écrit \`[]\`. "
      + "Confondre « aucun fait de race audité » et « registre oublié » republierait des décisions "
      + "de race sans leur référentiel.");
  }
  const breedRestrictions = raw.breed_restrictions.map((x) => BreedRestriction.parse(x));`,
    remplace: "  const breedRestrictions = (raw.breed_restrictions ?? []).map((x) => BreedRestriction.parse(x));",
    harnais: "test-t0b3a-moteur-race.mjs",
    attendu: "registre ABSENT",
  },
  // ---- LES DONNÉES : le référentiel lui-même ----
  {
    nom: "l'avis IATA voit sa portée réduite à la soute",
    fichier: "packages/knowledge/raw/breed-restrictions.json",
    cherche: `    "placements": ["cabin", "hold", "cargo"],`,
    remplace: `    "placements": ["hold"],`,
    harnais: "test-t0b3a-moteur-race.mjs",
    attendu: "elle porte les TROIS canaux",
  },
  {
    nom: "la citation de l'IATA est remplacée par une phrase plausible",
    fichier: "packages/knowledge/raw/breed-restrictions.json",
    cherche: `"quote": "Transport of snub nose dogs, such as boxers, pugs, bulldogs and Pekinese, in hot season is not recommended."`,
    remplace: `"quote": "Snub-nosed dogs must never be transported by air."`,
    harnais: "test-t0b3a-moteur-race.mjs",
    attendu: "la CITATION est celle de l'IATA, mot pour mot",
  },
  {
    nom: "une règle CONSERVÉE est modifiée en douce",
    fichier: "packages/knowledge/raw/rules.json",
    cherche: `    "id": "rule_aa_cabin_weight",`,
    remplace: `    "id": "rule_aa_cabin_weight",\n    "_mutation": "contre-épreuve",`,
    harnais: "mesures/t0b3b-referentiel-brachy/outils/mesurer.mjs",
    args: ["--sans-ecrire"],
    attendu: "l'après est l'avant PRIVÉ des 42",
  },
  {
    nom: "un `.nvmrc` vide redevient un plancher satisfait",
    fichier: "mesures/t0b3a-arbitrage-brachy/outils/lib-arbitrage.mjs",
    /* LE DÉFAUT EXACT TROUVÉ PAR LA CONTRE-REVUE DU 23/08/2026, FIGÉ. La lecture manquante
       échouait bien, mais un `Buffer` vide est truthy : `nvmrc` valait `""`, et le ternaire
       `nvmrc ? … : true` rendait la conformité VRAIE. Une absence déguisée en conformité.
       La mutation remet ce repli en relâchant le format exigé. */
    /* La première version de cette mutation ajoutait `brut &&` devant la garde de format. Elle NE
       MORDAIT PAS : avec un `.nvmrc` vide, `majH` devenait `NaN` et la comparaison de majeure
       refusait quand même — la garantie tenait par une autre branche. Une mutation qui laisse le
       harnais vert ne prouve rien ; celle-ci rétablit exactement l'ancien repli permissif. */
    cherche: '  const brut = String(nvmrc ?? "").trim();',
    remplace: '  const brut = String(nvmrc ?? "").trim();\n  if (!brut) return { ok: true, motif: "" };',
    harnais: "test-plancher-node.mjs",
    attendu: "`.nvmrc` vide",
  },
  // ---- LA CHAÎNE D'INTÉGRATION : les actions et leur runtime ----
  {
    nom: "une action redevient épinglée sur un tag, qui se déplace",
    fichier: ".github/workflows/ci.yml",
    /* ANCRE ÉLARGIE : le workflow a DEUX jobs, qui partagent les mêmes étapes d'installation.
       La mutation courte est devenue ambiguë et le runner l'a déclarée MUETTE — c'est exactement
       ce pour quoi cet état existe. L'ancre inclut le voisinage qui distingue `verify`. */
    cherche: "timeout-minutes: 30\n\n    steps:\n      # `fetch-depth: 0`",
    remplace: "timeout-minutes: 30\n\n    steps:\n      - uses: actions/checkout@v7 # v7.0.1\n      # `fetch-depth: 0`",
    harnais: "packages/knowledge/scripts/check-actions-node.mjs",
    attendu: "n'est pas épinglée sur un SHA complet",
  },
  {
    nom: "une épingle jamais mesurée entre dans le workflow",
    fichier: ".github/workflows/ci.yml",
    /* ANCRE ÉLARGIE : le workflow a DEUX jobs, qui partagent les mêmes étapes d'installation.
       La mutation courte est devenue ambiguë et le runner l'a déclarée MUETTE — c'est exactement
       ce pour quoi cet état existe. L'ancre inclut le voisinage qui distingue `verify`. */
    cherche: "timeout-minutes: 30\n\n    steps:\n      # `fetch-depth: 0`",
    remplace: "timeout-minutes: 30\n\n    steps:\n      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0\n      # `fetch-depth: 0`",
    harnais: "packages/knowledge/scripts/check-actions-node.mjs",
    attendu: "n'est PAS déclarée au manifeste",
  },
  {
    nom: "le commentaire de version ment sur le SHA qu'il annote",
    fichier: ".github/workflows/ci.yml",
    /* ANCRE ÉLARGIE : le workflow a DEUX jobs, qui partagent les mêmes étapes d'installation.
       La mutation courte est devenue ambiguë et le runner l'a déclarée MUETTE — c'est exactement
       ce pour quoi cet état existe. L'ancre inclut le voisinage qui distingue `verify`. */
    cherche: "      - name: Node 22 (depuis .nvmrc)\n        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0\n        with:\n          node-version-file: .nvmrc\n          cache: npm\n\n      # Le seul contrôle du lot",
    remplace: "      - name: Node 22 (depuis .nvmrc)\n        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v6.5.0\n        with:\n          node-version-file: .nvmrc\n          cache: npm\n\n      # Le seul contrôle du lot",
    harnais: "packages/knowledge/scripts/check-actions-node.mjs",
    attendu: "alors que le manifeste dit",
  },
  {
    nom: "une épingle du manifeste ne sert plus à rien et y reste",
    fichier: ".github/workflows/ci.yml",
    /* ANCRE ÉLARGIE : le workflow a DEUX jobs, qui partagent les mêmes étapes d'installation.
       La mutation courte est devenue ambiguë et le runner l'a déclarée MUETTE — c'est exactement
       ce pour quoi cet état existe. L'ancre inclut le voisinage qui distingue `verify`. */
    /* DEUX ÉDITIONS, ET C'EST LE FOND DE LA MUTATION. Le workflow a deux jobs : remplacer
       `setup-node` dans UN seul laisse l'épingle utilisée par l'autre, donc toujours utile — le
       runner l'a montré en restant vert. Pour qu'une épingle du manifeste devienne réellement
       inutilisée, il faut qu'AUCUN job ne s'en serve. */
    editions: [
      { cherche: "      - name: Node 22 (depuis .nvmrc)\n        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0\n        with:\n          node-version-file: .nvmrc\n          cache: npm\n\n      # Le seul contrôle du lot",
        remplace: "      - name: Node 22 (depuis .nvmrc)\n        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1\n        with:\n          node-version-file: .nvmrc\n          cache: npm\n\n      # Le seul contrôle du lot" },
      { cherche: "      - name: Node 22 (depuis .nvmrc)\n        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0\n        with:\n          node-version-file: .nvmrc\n          cache: npm\n\n      - name: Installation reproductible",
        remplace: "      - name: Node 22 (depuis .nvmrc)\n        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1\n        with:\n          node-version-file: .nvmrc\n          cache: npm\n\n      - name: Installation reproductible" },
    ],
    harnais: "packages/knowledge/scripts/check-actions-node.mjs",
    attendu: "n'est utilisée par aucun",
  },
  {
    nom: "le runtime Node 20 déprécié redevient acceptable",
    fichier: ".github/actions-epinglees.json",
    cherche: `      "sha": "3d3c42e5aac5ba805825da76410c181273ba90b1",
      "version": "v7.0.1",
      "using": "node24",`,
    remplace: `      "sha": "3d3c42e5aac5ba805825da76410c181273ba90b1",
      "version": "v7.0.1",
      "using": "node20",`,
    harnais: "packages/knowledge/scripts/check-actions-node.mjs",
    attendu: "qui n'est pas supporté",
  },
  /* ---- LE CONTRAT DE PROVENANCE : ce qui prouve qu'un site vient bien de ses entrées ----------
   *
   * `args: ["--arbre-modifie-attendu"]` — ces mutations écrivent DANS le dépôt, et
   * `test-provenance.mjs` refuse par défaut de conclure sur un arbre modifié : sans ce drapeau il
   * ne dirait jamais que son refus, et ces cinq mutations seraient injouables. Le drapeau lève ce
   * refus et rien d'autre ; le harnais fige alors son relevé de saleté et juge ses attaques sur ce
   * qu'elles CHANGENT. Voir l'en-tête de `test-provenance.mjs`.
   */
  {
    nom: "le périmètre redevient une liste de fichiers, et l'outillage de build en sort",
    fichier: "packages/knowledge/scripts/lib/provenance.mjs",
    /* La v5 exacte, celle où Codex a montré le 22/08/2026 qu'on pouvait modifier
       `packages/ui/scripts/fix-404.mjs` — invoqué par le script `build` de `packages/ui` — sans
       que l'empreinte bouge ni que `salete()` dise quoi que ce soit. */
    cherche: `export const ENTREES = [
  "packages/ui",`,
    remplace: `export const ENTREES = [
  "packages/ui/src", "packages/ui/public", "packages/ui/astro.config.mjs", "packages/ui/package.json",`,
    harnais: "test-provenance.mjs",
    args: ["--arbre-modifie-attendu"],
    attendu: "n'est couvert par aucune entrée",
  },
  {
    nom: "un filtre d'entités hérité survit au mode complet",
    fichier: "packages/knowledge/scripts/lib/provenance.mjs",
    cherche: "  for (const k of NEUTRALISEES) delete env[k];",
    remplace: "  for (const k of []) delete env[k];",
    harnais: "test-provenance.mjs",
    args: ["--arbre-modifie-attendu"],
    attendu: "un filtre hérité amputerait un site déclaré complet",
  },
  {
    nom: "OUTDIR redevient accepté : Astro écrirait ailleurs qu'on ne scelle",
    fichier: "packages/knowledge/scripts/lib/provenance.mjs",
    cherche: "  for (const k of REFUSEES) {\n    const v = surcharges[k] ?? base[k];",
    remplace: "  for (const k of []) {\n    const v = surcharges[k] ?? base[k];",
    harnais: "test-provenance.mjs",
    args: ["--arbre-modifie-attendu"],
    attendu: "le build écrirait ailleurs que là où l'on scelle",
  },
  {
    nom: "git redevient un échec OUVERT : « je n'ai rien pu lire » repasse pour « il n'y a rien »",
    fichier: "packages/knowledge/scripts/lib/provenance.mjs",
    /* QUATRE ÉDITIONS, ET C'EST LE FOND DE LA MUTATION — pas une commodité. « Échouer fermé hors
       dépôt » n'est pas écrit à un endroit mais à quatre, et EN RETIRER UN SEUL LAISSE LA PROPRIÉTÉ
       DEBOUT : le garde suivant rattrape, le harnais reste vert, et le runner le dirait — à juste
       titre. Pour retrouver l'état qu'a reproduit Codex — quatorze condensés `e3b0c442…` et
       `salete() === ""`, c'est-à-dire « propre » déclaré là où rien n'a pu être lu —, il faut les
       relâcher tous les quatre. C'est exactement la v5. */
    editions: [
      { cherche: 'function git(...args) {\n  const r = spawnSync("git", ["-C", RACINE, ...args], {',
        remplace: 'function git(...args) {\n  const q = spawnSync("git", ["-C", RACINE, ...args], '
          + '{ encoding: "utf8", maxBuffer: 1 << 28 });\n  if (q.status !== 0) return "";\n'
          + '  return q.stdout.trim();\n  const r = spawnSync("git", ["-C", RACINE, ...args], {' },
      { cherche: 'function exigerDepot() {\n  const sommet = git("rev-parse", "--show-toplevel");',
        remplace: 'function exigerDepot() {\n  if (1) return;\n  const sommet = git("rev-parse", "--show-toplevel");' },
      { cherche: "    if (!suivis.has(x)) {", remplace: "    if (false) {" },
      { cherche: "    if (l.length === 0) {", remplace: "    if (false) {" },
    ],
    harnais: "test-provenance.mjs",
    args: ["--arbre-modifie-attendu"],
    attendu: "« e3b0c44298fc1c14 » présent",
  },
  {
    nom: "une variable non déclarée entre dans un constructeur et choisit le script de build",
    fichier: "packages/knowledge/scripts/build-ci.mjs",
    /* LA CONTRE-ÉPREUVE DE CODEX DU 23/08/2026, FIGÉE. Elle a montré un FAUX VERT : le harnais
       restait à 74/74 alors qu'une variable inconnue du contrat choisissait entre deux scripts de
       build — donc changeait réellement le site. Le résidu ne pouvait rien y voir : le code neuf
       était couvert par la classification EN BLOC de `packages/knowledge/scripts`, il n'apparaissait
       donc jamais comme résidu. `build:prod` fixe `PUBLIC_SITE_ENV=production` : le site produit
       devient indexable, ce n'est pas une nuance. */
    cherche: 'const r = spawnSync("npm", ["-w", "@mydogcanfly/ui", "run", "build"], {',
    remplace: 'const r = spawnSync("npm", ["-w", "@mydogcanfly/ui", "run",\n'
      + '  process.env.PROVENANCE_UNTRACKED_ENV ? "build:prod" : "build"], {',
    harnais: "test-provenance.mjs",
    args: ["--arbre-modifie-attendu"],
    attendu: "variable non déclarée",
  },
  {
    nom: "un exécutable redevient classé par le répertoire qui le contient",
    fichier: "packages/knowledge/scripts/lib/provenance.mjs",
    /* La correction de fond du 23/08/2026 : ce n'est pas `packages/knowledge/scripts` qui était le
       défaut, c'est qu'un classement PAR RÉPERTOIRE est une promesse sur du code pas encore écrit.
       Remettre les constructeurs sous un classement de répertoire doit rougir même si, à cet
       instant précis, aucune variable nouvelle n'y est lue. */
    editions: [
      { cherche: '  "packages/knowledge/scripts",\n  "packages/engine/src",',
        remplace: '  "packages/engine/src",' },
      { cherche: 'export const HORS_SCRUTATION = {',
        remplace: 'export const HORS_SCRUTATION = {\n  "packages/knowledge/scripts": '
          + '"classement en bloc, exactement ce que la regle interdit",' },
    ],
    harnais: "test-provenance.mjs",
    args: ["--arbre-modifie-attendu"],
    attendu: "classé par le répertoire qui le contient",
  },
  {
    nom: "un répertoire de sources sort de la scrutation sans être classé",
    fichier: "packages/knowledge/scripts/lib/provenance.mjs",
    /* Le relevé des variables d'environnement ne vaut que ce que vaut la liste des chemins
       scrutés — écrite à la main, donc du même bois que l'`ENTREES` de la v5. Le résidu est ce qui
       l'empêche de se rétrécir en silence. */
    cherche: '  "packages/ui/src",\n  "packages/ui/scripts",\n  "packages/ui/astro.config.mjs",',
    remplace: '  "packages/ui/src",\n  "packages/ui/astro.config.mjs",',
    harnais: "test-provenance.mjs",
    args: ["--arbre-modifie-attendu"],
    attendu: "échappent au classement",
  },
  {
    nom: "les URL des sitemaps peuvent à nouveau être comptées deux fois",
    fichier: "packages/knowledge/scripts/lib/provenance.mjs",
    cherche: "      if (vues.has(m[1])) doublons.add(m[1]); else vues.add(m[1]);",
    remplace: "      vues.add(m[1]);",
    harnais: "test-provenance.mjs",
    args: ["--arbre-modifie-attendu"],
    attendu: "PLUSIEURS fois par les sitemaps » attendu",
  },
  // ---- L'INTERFACE (chaque mutation exige un build, d'où `--dom`) ----
  {
    dom: true,
    nom: "l'interface republie un rapport sans `safety_advisories` comme « aucun avis »",
    fichier: "packages/ui/src/components/FlightFinder.astro",
    editions: [
      { cherche: "&& avisRecevables(data)) return data;", remplace: ") return data;" },
      { cherche: "    const list = r.safety_advisories;", remplace: "    const list = r.safety_advisories ?? [];" },
    ],
    harnais: "test-t0b3a-avis-dom.cjs",
    attendu: "ABSENT → rapport REFUSÉ",
  },
  {
    dom: true,
    nom: "une portée inconnue est de nouveau élargie à « toutes les compagnies »",
    fichier: "packages/ui/src/components/FlightFinder.astro",
    editions: [
      { cherche: '      && (a.scope === "global" || connues.has(a.scope)));', remplace: "      );" },
      { cherche: "      if (!a) throw new Error(`safety advisory: unknown scope ${scope}`);\n      return a.name;",
        remplace: "      return a ? a.name : L.safetyScopeGlobal;" },
    ],
    harnais: "test-t0b3a-avis-dom.cjs",
    attendu: "JAMAIS élargi",
  },
  /* ---- L'audit dit-il ce qu'il a vu ? ----
   * Deux mutations sur le RAPPORT, pas sur le code de sortie. L'audit sortait en 0 tout en
   * n'imprimant JAMAIS ses constatations de niveau `INFO` : code juste, rapport muet. Aucun
   * contrôle ne pouvait le voir, puisque tous ne lisaient que le code de sortie.
   *
   * Elles exigent un `dist` COMPLET — l'audit s'arrête de lui-même sous 1 500 pages — mais PAS de
   * reconstruire : `audit-site.mjs` n'entre dans aucun build, le site produit est le même avant et
   * après la mutation. D'où `distComplet` et non `dom` : le site déjà construit suffit, et trois
   * builds de douze minutes disparaissent. La distinction a été relevée par la contre-revue du
   * 20/08/2026 ; je les avais confondus. */
  {
    /* UNE SEULE OCCURRENCE RETIRÉE, ET C'EST TOUT L'ENJEU. Le contrôle ne vérifiait que l'existence
       d'un usage QUELQUE PART : retirer `setup-node` du seul job `site-complet` le laissait vert,
       « 3 épingles, toutes déclarées », alors que le workflow avait perdu une étape d'installation.
       Trouvé par la contre-revue du 20/08/2026, qui a joué exactement cette mutation. */
    nom: "une étape d'installation disparaît d'un seul job, l'épingle servant encore ailleurs",
    fichier: ".github/workflows/ci.yml",
    cherche: "      - name: Node 22 (depuis .nvmrc)\n        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0\n        with:\n          node-version-file: .nvmrc\n          cache: npm\n\n      - name: Installation reproductible",
    remplace: "      - name: Installation reproductible",
    harnais: "packages/knowledge/scripts/check-actions-node.mjs",
    attendu: "le manifeste en attend 1",
  },
  {
    distComplet: true,
    nom: "le contrôle hors-sitemap se tait au lieu de dire qu'il ne peut pas conclure",
    fichier: "packages/knowledge/scripts/audit-site.mjs",
    cherche: "if (indexables.length === 0) {",
    remplace: "if (false) {",
    harnais: "test-audit-observations.mjs",
    attendu: "la section INFO porte la ligne ENTIÈRE du contrôle hors-sitemap",
  },
  {
    distComplet: true,
    nom: "la sévérité INFO quitte l'ordre d'affichage, ET sa garde est neutralisée",
    fichier: "packages/knowledge/scripts/audit-site.mjs",
    /* DEUX ÉDITIONS, PARCE QUE LA RÉGRESSION EN EXIGE DEUX. Retirer `INFO` de l'ordre déclenche la
       garde des sévérités inconnues, qui arrête l'audit en code 2 : le défaut serait donc déjà vu.
       L'état RÉELLEMENT à craindre est celui d'avant — l'ordre incomplet ET aucune garde — où le
       rapport perd une section sans que rien ne bronche. C'est celui-là qu'on reproduit. */
    editions: [
      { cherche: 'const ORDER = ["BLOQUANT", "À VÉRIFIER", "SEO", "A11Y", "INFO"];',
        remplace: 'const ORDER = ["BLOQUANT", "À VÉRIFIER", "SEO", "A11Y"];' },
      { cherche: "  if (inconnues.length) {", remplace: "  if (false) {" },
    ],
    harnais: "test-audit-observations.mjs",
    attendu: "le rapport porte une section INFO",
  },
];

const dire = (m) => process.stdout.write(m + "\n");
const git = (...a) => execFileSync("git", a, { encoding: "utf8" });
const arbreSale = () => git("status", "--porcelain", "--untracked-files=all").trim();

if (arbreSale()) {
  process.stderr.write("[contre-épreuves] ÉCHEC — l'arbre est sale : ces mutations écrivent dans "
    + "les fichiers du dépôt et les restaurent par `git checkout`. Partir d'un arbre modifié "
    + `risquerait d'effacer un travail en cours :\n${arbreSale()}\n`);
  process.exit(1);
}

const joue = (m) => m.buildComplet ? AVEC_COMPLET
  : m.distComplet ? AVEC_DIST_COMPLET
  : AVEC_DOM || !m.dom;
const choisies = MUTATIONS.filter(joue);
const ignoreesDom = MUTATIONS.filter((m) => m.dom && !m.buildComplet && !AVEC_DOM).length;
const ignoreesCompletes = MUTATIONS.filter((m) => m.buildComplet && !AVEC_COMPLET).length;
const ignoreesDist = MUTATIONS.filter((m) => m.distComplet && !AVEC_DIST_COMPLET).length;

/* JAMAIS VERT FAUTE DE MATIÈRE. Les mutations `distComplet` ne reconstruisent rien : si le site
   n'est pas déjà là, leur harnais lirait un message d'arrêt et « échouerait » sans que la mutation
   y soit pour rien. On refuse de les jouer plutôt que de prouver le vide. */
if (choisies.some((m) => m.distComplet)) {
  const compter = (d) => {
    if (!existsSync(d)) return 0;
    let n = 0;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) { if (e.name !== "_astro") n += compter(join(d, e.name)); }
      else if (e.name.endsWith(".html")) n++;
    }
    return n;
  };
  const pages = compter("packages/ui/dist");
  if (pages < 1500) {
    process.stderr.write(`[contre-épreuves] ÉCHEC — ${pages} pages sous packages/ui/dist, et `
      + "des mutations `--dist-complet` ont été demandées. Elles LISENT le site sans le reconstruire : "
      + "sans site complet, leur harnais lirait un message d'arrêt au lieu d'un rapport.\n");
    process.exit(1);
  }
}

let tenues = 0;
const echecs = [];

for (const m of choisies) {
  const source = readFileSync(m.fichier, "utf8");
  const editions = m.editions ?? [{ cherche: m.cherche, remplace: m.remplace }];
  /* Une édition qui ne s'applique plus est un ÉCHEC DUR, jamais un « rien à faire » : elle
     prouverait le vide en silence. Une chaîne ambiguë l'est tout autant. */
  const muette = editions.find((e) => source.split(e.cherche).length - 1 !== 1);
  if (muette) {
    echecs.push(`${m.nom}\n      la mutation ne s'applique pas : « ${muette.cherche.slice(0, 60)}… » `
      + `apparaît ${source.split(muette.cherche).length - 1} fois dans ${m.fichier} (attendu : 1). `
      + `Le code a bougé — la mutation doit être remise à jour, sans quoi elle ne prouve plus rien.`);
    dire(`  MUETTE  ${m.nom}`);
    continue;
  }
  let resultat;
  try {
    writeFileSync(m.fichier, editions.reduce((t, e) => t.replace(e.cherche, e.remplace), source));
    if (m.dom) {
      const b = spawnSync("npm", ["run", "build:ci", ...(m.buildComplet ? ["--", "--complet"] : [])],
        { encoding: "utf8" });
      if (b.status !== 0) { resultat = { erreur: "le build a échoué" }; }
    }
    if (!resultat) {
      const args = m.harnais.endsWith(".cjs")
        ? [m.harnais, ...(m.args ?? [])]
        : ["--import", "tsx", m.harnais, ...(m.args ?? [])];
      const r = spawnSync(process.execPath, args, { encoding: "utf8" });
      const sortie = `${r.stdout ?? ""}${r.stderr ?? ""}`;
      if (r.signal) resultat = { erreur: `processus tué par ${r.signal}` };
      else if (r.status === 0) resultat = { erreur: "le harnais reste VERT — la garantie ne porte pas" };
      else if (!sortie.includes(m.attendu)) {
        resultat = { erreur: `échec, mais SANS le diagnostic attendu « ${m.attendu} » — `
          + `mis en défaut pour une autre raison :\n      ${sortie.trim().split("\n").slice(-3).join("\n      ")}` };
      }
    }
  } finally {
    /* Restauration systématique : une mutation laissée en place corromprait tout ce qui suit.
       `:(literal)` parce qu'un chemin de route Astro contient des crochets — `sitemap-[lang].xml.ts`
       est un motif valide pour git, qui ne désigne AUCUN fichier existant. La restauration
       échouerait alors dans un `finally`, et la mutation resterait dans l'arbre. */
    git("checkout", "--", `:(literal)${m.fichier}`);
  }
  if (resultat?.erreur) { echecs.push(`${m.nom}\n      ${resultat.erreur}`); dire(`  ÉCHEC   ${m.nom}`); }
  else { tenues++; dire(`  tenue   ${m.nom}`); }
}

/* ---- LE BUILD AUSSI DOIT ÊTRE RENDU INTACT ----------------------------------------------------
 * `packages/ui/dist` est ignoré par git : le contrôle de propreté ne le voit donc PAS. Après une
 * mutation d'interface, le site construit sur le disque est le site MUTÉ — la source est bien
 * restaurée, mais le `dist` ment. Un `test:built-ui` lancé ensuite lirait du code qui n'existe plus,
 * et un déploiement depuis ce `dist` publierait la mutation. Trouvé en enchaînant les deux commandes.
 * On reconstruit donc depuis la source restaurée, et on le dit. */
if (choisies.some((m) => m.dom)) {
  /* Reconstruit dans la portée LA PLUS LARGE qui vient d'être jouée : après une mutation du site
     entier, restaurer un site réduit laisserait `dist` amputé — intact au sens de « sans mutation »,
     mais inutilisable pour le harnais suivant, qui échouerait faute de matière. */
  const large = choisies.some((m) => m.buildComplet);
  const r = spawnSync("npm", ["run", "build:ci", ...(large ? ["--", "--complet"] : [])],
    { encoding: "utf8" });
  if (r.status !== 0) {
    echecs.push("le build de restauration a échoué — `packages/ui/dist` contient encore une mutation. "
      + "Relancer `npm run build:ci` avant tout autre harnais d'interface.");
  } else {
    dire("  (site reconstruit depuis la source restaurée — `dist` ne conserve aucune mutation)");
  }
}

/* L'arbre doit être RENDU intact : une restauration ratée se voit ici, jamais plus tard. */
const restant = arbreSale();
if (restant) {
  echecs.push(`l'arbre n'a pas été restauré — une mutation subsiste :\n      ${restant.replace(/\n/g, "\n      ")}`);
}

dire("");
dire(`  ${tenues} garantie(s) éprouvée(s) sur ${choisies.length}`);
/* Jamais de troncature muette : dire ce qui n'a pas été joué vaut mieux qu'un total flatteur. */
if (ignoreesDom) {
  dire(`  ${ignoreesDom} mutation(s) d'interface NON jouée(s) — chacune exige un build. « npm run contre-epreuves -- --dom » les inclut.`);
}
if (ignoreesCompletes) {
  dire(`  ${ignoreesCompletes} mutation(s) NON jouée(s) exigeant de RECONSTRUIRE le site entier — environ douze minutes de build chacune. « npm run contre-epreuves -- --complet » les inclut.`);
}
if (ignoreesDist) {
  dire(`  ${ignoreesDist} mutation(s) NON jouée(s) LISANT un site complet déjà construit — aucun build, mais un « dist » complet. « npm run contre-epreuves -- --dist-complet » les inclut.`);
}
if (echecs.length) {
  process.stderr.write(`\n[contre-épreuves] ÉCHEC — ${echecs.length} :\n`
    + echecs.map((e) => `  · ${e}`).join("\n") + "\n");
  process.exit(1);
}
dire("[contre-épreuves] toutes les garanties éprouvées portent réellement.");
