#!/usr/bin/env node
/**
 * LES CONTRE-ÉPREUVES, MÉCANISÉES.
 *
 *   npm run contre-epreuves            les mutations du moteur et des données (rapide)
 *   npm run contre-epreuves -- --dom   y ajoute celles de l'interface (chacune exige un build)
 *   npm run contre-epreuves -- --dist-complet  celles qui LISENT un site complet déjà construit
 *   npm run contre-epreuves -- --complet       celles qui exigent de RECONSTRUIRE le site entier
 *   npm run contre-epreuves -- --tout          les trois portées, et RIEN de non joué
 *   npm run contre-epreuves -- --contrat       la bijection avec la référence, sans jouer une seule
 *                                              mutation (deux secondes)
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

const TOUT = process.argv.includes("--tout");
const AVEC_DOM = process.argv.includes("--dom") || TOUT;
/* Certaines garanties ne se lisent que sur le site ENTIER — l'audit, par exemple, refuse de
 * conclure sous 1 500 pages. Sous le build réduit, leur harnais échouerait faute de matière et non
 * parce que la mutation a mordu : il prouverait le vide. Elles sont donc derrière un drapeau
 * distinct, parce qu'elles coûtent un build complet chacune, et le total ci-dessous dit toujours
 * combien n'ont PAS été jouées. */
const AVEC_COMPLET = process.argv.includes("--complet") || TOUT;
/* `--dist-complet` : la mutation ne touche pas le site, elle touche ce qui le LIT. Aucun build
 * n'est nécessaire — mais un `dist` complet, si, et son absence doit faire échouer plutôt que
 * laisser le harnais lire un message d'arrêt. */
const AVEC_DIST_COMPLET = process.argv.includes("--dist-complet") || TOUT;

/* `--tout` — LE CATALOGUE ENTIER, ET LA PREUVE QU'IL L'EST.
 *
 * Le workflow hebdomadaire lançait `--dom --complet` sous un titre qui annonçait « toutes les
 * garanties ». C'était FAUX de deux mutations : celles qui LISENT un site complet déjà construit
 * relèvent d'un troisième drapeau, et sans lui le runner les déclarait simplement « non jouées » —
 * puis sortait en 0. Un passage vert qui saute deux garanties tout en se disant complet est
 * exactement le genre de faux vert que ce fichier existe pour interdire.
 *
 * `--tout` allume les trois portées ET exige, à la fin, que le compte des non-jouées soit NUL.
 * Il ne se contente donc pas de demander la couverture : il refuse de conclure sans elle. */

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
    id: "l-accord-causes-preuves-est-neutralise",
    fichier: "packages/engine/src/contracts.ts",
    cherche: "export const PlacementDecision = PlacementDecisionShape.superRefine((d, ctx) => {",
    remplace: "export const PlacementDecision = PlacementDecisionShape.superRefine((d, ctx) => { if (1) return;",
    harnais: "test-t0b3a-contrat-preuves.mjs",
    attendu: "exigence SANS preuve → REFUSÉE",
  },
  {
    nom: "un tableau de preuves VIDE redevient acceptable",
    id: "un-tableau-de-preuves-vide-redevient-acceptable",
    fichier: "packages/engine/src/contracts.ts",
    cherche: "const EvidenceArray = z.array(RestrictionEvidence).min(1);",
    remplace: "const EvidenceArray = z.array(RestrictionEvidence);",
    harnais: "test-t0b3a-contrat-preuves.mjs",
    attendu: "`allowed` avec `evidence: []` → refusé",
  },
  {
    nom: "les rôles de preuve ne sont plus contraints par le statut",
    id: "les-roles-de-preuve-ne-sont-plus-contraints-par-le-statu",
    fichier: "packages/engine/src/contracts.ts",
    cherche: "  const admis = ROLES_ADMIS[d.status];",
    remplace: '  const admis = ["authorisation", "requirement", "refusal"];',
    harnais: "test-t0b3a-moteur-race.mjs",
    attendu: "`allowed` + refus → refusé",
  },
  {
    nom: "un avis peut à nouveau répéter le même canal",
    id: "un-avis-peut-a-nouveau-repeter-le-meme-canal",
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
    id: "les-preuves-sont-perdues-quand-entryallowed-degrade-le-s",
    fichier: "packages/engine/src/explain.ts",
    cherche: "        d.evidence);",
    remplace: "        );",
    harnais: "test-t0b3a-contrat-preuves.mjs",
    attendu: "la PREUVE DE RACE survit à la reconstruction",
  },
  {
    nom: "les preuves n'atteignent plus les sources du rapport",
    id: "les-preuves-n-atteignent-plus-les-sources-du-rapport",
    fichier: "packages/engine/src/explain.ts",
    cherche: "    for (const d of placement_decisions) {\n      for (const e of d.evidence ?? []) {",
    remplace: "    for (const d of []) {\n      for (const e of d.evidence ?? []) {",
    harnais: "test-t0b3a-moteur-race.mjs",
    attendu: "atteignent `report.sources`",
  },
  {
    nom: "une restriction compte autant de fois qu'elle est portée (déduplication retirée)",
    id: "une-restriction-compte-autant-de-fois-qu-elle-est-portee",
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
    id: "la-confiance-ne-pese-plus-sur-le-score",
    fichier: "packages/engine/src/explain.ts",
    cherche: "  const confidenceRatio = Math.max(0, Math.min(1, avgConfidence / 5));",
    remplace: "  const confidenceRatio = 0;",
    harnais: "test-t0b3a-moteur-race.mjs",
    attendu: "la confiance publiée ET le score se déplacent",
  },
  // ---- `evaluate` : motifs, avis, registre ----
  {
    nom: "un refus de race ne porte plus son motif",
    id: "un-refus-de-race-ne-porte-plus-son-motif",
    fichier: "packages/engine/src/evaluate.ts",
    cherche: "        placement: x.decision.placement, fires: x.fires, breedDeny: x.breedDeny }))),",
    remplace: "        placement: x.decision.placement, fires: x.fires }))),",
    harnais: "test-t0b3a-moteur-race.mjs",
    attendu: "motif `breed_restricted`",
  },
  {
    nom: "les avis sont collectés avant le filtre des itinéraires — donc orphelins",
    id: "les-avis-sont-collectes-avant-le-filtre-des-itineraires",
    fichier: "packages/engine/src/evaluate.ts",
    cherche: "  const advisories: AdvisorySignal[] = airlineDecisions",
    remplace: "  const advisories: AdvisorySignal[] = airlineDecisionsRaw",
    harnais: "test-t0b3a-moteur-race.mjs",
    attendu: "aucun avis de compagnie ne survit à sa compagnie",
  },
  {
    nom: "un registre de race absent redevient « aucun fait audité »",
    id: "un-registre-de-race-absent-redevient-aucun-fait-audite",
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
    id: "l-avis-iata-voit-sa-portee-reduite-a-la-soute",
    fichier: "packages/knowledge/raw/breed-restrictions.json",
    cherche: `    "placements": ["cabin", "hold", "cargo"],`,
    remplace: `    "placements": ["hold"],`,
    harnais: "test-t0b3a-moteur-race.mjs",
    attendu: "elle porte les TROIS canaux",
  },
  {
    nom: "la citation de l'IATA est remplacée par une phrase plausible",
    id: "la-citation-de-l-iata-est-remplacee-par-une-phrase-plaus",
    fichier: "packages/knowledge/raw/breed-restrictions.json",
    cherche: `"quote": "Transport of snub nose dogs, such as boxers, pugs, bulldogs and Pekinese, in hot season is not recommended."`,
    remplace: `"quote": "Snub-nosed dogs must never be transported by air."`,
    harnais: "test-t0b3a-moteur-race.mjs",
    attendu: "la CITATION est celle de l'IATA, mot pour mot",
  },
  {
    nom: "une règle CONSERVÉE est modifiée en douce",
    id: "une-regle-conservee-est-modifiee-en-douce",
    fichier: "packages/knowledge/raw/rules.json",
    cherche: `    "id": "rule_aa_cabin_weight",`,
    remplace: `    "id": "rule_aa_cabin_weight",\n    "_mutation": "contre-épreuve",`,
    harnais: "mesures/t0b3b-referentiel-brachy/outils/mesurer.mjs",
    args: ["--sans-ecrire"],
    attendu: "l'après est l'avant PRIVÉ des 42",
  },
  {
    nom: "un `.nvmrc` vide redevient un plancher satisfait",
    id: "un-nvmrc-vide-redevient-un-plancher-satisfait",
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
    id: "une-action-redevient-epinglee-sur-un-tag-qui-se-deplace",
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
    id: "une-epingle-jamais-mesuree-entre-dans-le-workflow",
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
    id: "le-commentaire-de-version-ment-sur-le-sha-qu-il-annote",
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
    id: "une-epingle-du-manifeste-ne-sert-plus-a-rien-et-y-reste",
    /* TROIS ÉDITIONS DANS DEUX FICHIERS, ET C'EST LE FOND DE LA MUTATION. Le diagnostic visé —
       « n'est utilisée par aucun » — ne se déclenche que si l'épingle ne sert NULLE PART.

       Premier temps : `ci.yml` a deux jobs, et la retirer d'un seul la laissait utile à l'autre ;
       le runner l'a montré en restant vert. Second temps, 23/08/2026 : le lot 3 ajoute un SECOND
       WORKFLOW qui l'utilise aussi, et deux éditions ne suffisent plus — le runner l'a montré une
       deuxième fois, en refusant un échec obtenu pour une AUTRE raison (un écart de décompte par
       job, pas une épingle orpheline). Le même raisonnement, monté d'un cran.

       C'est cette mutation qui a rendu nécessaire le support multi-fichiers : décrire la régression
       réelle passe par les deux workflows, sans quoi elle décrit autre chose. */
    fichiers: [{
      fichier: ".github/workflows/contre-epreuves-completes.yml",
      editions: [
        { cherche: "        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0",
          remplace: "        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1" },
      ],
    }, {
      fichier: ".github/workflows/ci.yml",
      editions: [
      { cherche: "      - name: Node 22 (depuis .nvmrc)\n        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0\n        with:\n          node-version-file: .nvmrc\n          cache: npm\n\n      # Le seul contrôle du lot",
        remplace: "      - name: Node 22 (depuis .nvmrc)\n        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1\n        with:\n          node-version-file: .nvmrc\n          cache: npm\n\n      # Le seul contrôle du lot" },
      { cherche: "      - name: Node 22 (depuis .nvmrc)\n        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0\n        with:\n          node-version-file: .nvmrc\n          cache: npm\n\n      - name: Installation reproductible",
        remplace: "      - name: Node 22 (depuis .nvmrc)\n        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1\n        with:\n          node-version-file: .nvmrc\n          cache: npm\n\n      - name: Installation reproductible" },
      ],
    }],
    harnais: "packages/knowledge/scripts/check-actions-node.mjs",
    attendu: "n'est utilisée par aucun",
  },
  {
    nom: "le runtime Node 20 déprécié redevient acceptable",
    id: "le-runtime-node-20-deprecie-redevient-acceptable",
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
    id: "le-perimetre-redevient-une-liste-de-fichiers-et-l-outill",
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
    id: "un-filtre-d-entites-herite-survit-au-mode-complet",
    fichier: "packages/knowledge/scripts/lib/provenance.mjs",
    cherche: "  for (const k of NEUTRALISEES) delete env[k];",
    remplace: "  for (const k of []) delete env[k];",
    harnais: "test-provenance.mjs",
    args: ["--arbre-modifie-attendu"],
    attendu: "un filtre hérité amputerait un site déclaré complet",
  },
  {
    nom: "OUTDIR redevient accepté : Astro écrirait ailleurs qu'on ne scelle",
    id: "outdir-redevient-accepte-astro-ecrirait-ailleurs-qu-on-n",
    fichier: "packages/knowledge/scripts/lib/provenance.mjs",
    cherche: "  for (const k of REFUSEES) {\n    const v = surcharges[k] ?? base[k];",
    remplace: "  for (const k of []) {\n    const v = surcharges[k] ?? base[k];",
    harnais: "test-provenance.mjs",
    args: ["--arbre-modifie-attendu"],
    attendu: "le build écrirait ailleurs que là où l'on scelle",
  },
  {
    nom: "git redevient un échec OUVERT : « je n'ai rien pu lire » repasse pour « il n'y a rien »",
    id: "git-redevient-un-echec-ouvert-je-n-ai-rien-pu-lire-repas",
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
    id: "une-variable-non-declaree-entre-dans-un-constructeur-et",
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
    id: "un-executable-redevient-classe-par-le-repertoire-qui-le",
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
    id: "un-repertoire-de-sources-sort-de-la-scrutation-sans-etre",
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
    id: "les-url-des-sitemaps-peuvent-a-nouveau-etre-comptees-deu",
    fichier: "packages/knowledge/scripts/lib/provenance.mjs",
    cherche: "      if (vues.has(m[1])) doublons.add(m[1]); else vues.add(m[1]);",
    remplace: "      vues.add(m[1]);",
    harnais: "test-provenance.mjs",
    args: ["--arbre-modifie-attendu"],
    attendu: "PLUSIEURS fois par les sitemaps » attendu",
  },
  /* ---- LE HUB DE VOYAGE EN QUATRE LANGUES ----------------------------------------------------
   * Les huit garanties de `test-guides-traduits.mjs`, éprouvées. Elles LISENT les sources — aucun
   * build n'est nécessaire —, et elles arrivent avec le lot qui apporte le harnais : une garantie
   * livrée sans sa contre-épreuve est une garantie dont personne n'a montré qu'elle sait rougir.
   *
   * Celle du lien d'outil mort mérite d'être nommée. `/tools/is-it-too-hot-for-my-dog/` promettait
   * un risque chaleur GÉOLOCALISÉ que le site ne sert pas ; `/tools/heat/` estime un embargo en
   * soute PAR ITINÉRAIRE ET PAR MOIS. Y repointer l'appel aurait fabriqué un lien trompeur — pire
   * qu'un lien mort, parce qu'il aboutit. L'appel a donc été retiré dans les six fichiers, ce qui
   * rétablit la parité avec le français, qui ne l'avait jamais eu. La mutation réintroduit
   * exactement ce lien et exige que le harnais le refuse.
   */
  {
    nom: "un paragraphe est resté dans la langue source",
    id: "un-paragraphe-est-reste-dans-la-langue-source",
    fichier: "packages/ui/src/content/guides/es/viajar-en-avion-con-perro.md",
    cherche: "El avión abre la puerta a viajes lejanos con tu perro, pero es también el medio de transporte más regulado.",
    remplace: "Flying opens the door to far-away trips with your dog, but it's also the most heavily regulated way to travel.",
    harnais: "test-guides-traduits.mjs",
    attendu: "aucune phrase n'est restée en anglais",
  },
  {
    nom: "un guide né ici s'invente une adresse d'origine",
    id: "un-guide-ne-ici-s-invente-une-adresse-d-origine",
    fichier: "packages/ui/src/content/guides/es/viajar-en-avion-con-perro.md",
    cherche: `key: "flying-with-a-dog"`,
    remplace: `key: "flying-with-a-dog"\nsourceUrl: "/viajar-en-avion-con-perro/"`,
    harnais: "test-guides-traduits.mjs",
    attendu: "ne s'invente un `sourceUrl`",
  },
  {
    nom: "un lien renvoie à l'anglais alors que la traduction existe",
    id: "un-lien-renvoie-a-l-anglais-alors-que-la-traduction-exis",
    fichier: "packages/ui/src/content/guides/es/avion-con-perro-cabina-bodega-carga.md",
    cherche: "](/es/travel-hub/viajar-en-avion-con-perro/)",
    remplace: "](/travel-hub/flying-with-a-dog/)",
    harnais: "test-guides-traduits.mjs",
    attendu: "aucun lien ne sort de la langue du lecteur",
  },
  {
    nom: "un paragraphe FRANÇAIS est resté dans sa version anglaise exacte",
    id: "un-paragraphe-francais-est-reste-dans-sa-version-anglais",
    fichier: "packages/ui/src/content/guides/fr/retroplanning-vol-international-chien.md",
    /* LA CONTRE-ÉPREUVE DE CODEX DU 23/08/2026, FIGÉE. Elle a montré un faux vert : `fr` était rangé
       parmi les langues SOURCES, si bien que les contrôles de fidélité, de cardinalité et d'anglais
       résiduel ne parcouraient que `es` et `pt`. Les dix traductions françaises nées dans ce lot y
       échappaient entièrement, et remplacer un paragraphe par sa version anglaise EXACTE laissait
       le harnais répondre « tout tient ».

       La mutation reprend son geste mot pour mot : le premier paragraphe français cède la place au
       premier paragraphe anglais de son jumeau `pet-flight-timeline`. */
    cherche: "La plupart des guides sur l'avion avec un animal présentent une liste à cocher. Une liste laisse entendre que les points peuvent se faire dans n'importe quel ordre et en parallèle, et pour un déménagement international c'est exactement le mauvais modèle mental. Plusieurs étapes comportent des **délais d'attente obligatoires**, et ce sont ces délais — pas les papiers, pas la réservation — qui décident si une date de départ donnée est possible.",
    remplace: "Most guides to flying with a pet present a checklist. A checklist implies the items can be done in any order and in parallel, and for an international move that is exactly the wrong mental model. Several steps carry **mandatory waiting periods**, and those periods — not the paperwork, not the booking — decide whether a given departure date is possible at all.",
    harnais: "test-guides-traduits.mjs",
    attendu: "aucune phrase n'est restée en anglais",
  },
  {
    nom: "un guide renvoie vers un outil que le site ne sert pas",
    id: "un-guide-renvoie-vers-un-outil-que-le-site-ne-sert-pas",
    fichier: "packages/ui/src/content/guides/en/dog-heatstroke.md",
    cherche: "## Why are dogs so vulnerable to heat?",
    remplace:
      "👉 Check the live heat risk with our [checker](/tools/is-it-too-hot-for-my-dog/).\n\n## Why are dogs so vulnerable to heat?",
    harnais: "test-guides-traduits.mjs",
    attendu: "visent une route existante",
  },
  {
    nom: "un guide français importé perd son adresse d'origine",
    id: "un-guide-francais-importe-perd-son-adresse-d-origine",
    fichier: "packages/ui/src/content/guides/fr/mal-des-transports-chien.md",
    cherche: 'sourceUrl: "/mal-des-transports-chien/"\n',
    remplace: "",
    harnais: "test-guides-traduits.mjs",
    attendu: "même statut d'origine que son jumeau anglais",
  },
  {
    nom: "un guide français né ici s'invente une adresse d'origine",
    id: "un-guide-francais-ne-ici-s-invente-une-adresse-d-origine",
    fichier: "packages/ui/src/content/guides/fr/retroplanning-vol-international-chien.md",
    cherche: 'key: "pet-flight-timeline"',
    remplace: 'key: "pet-flight-timeline"\nsourceUrl: "/retroplanning-vol-international-chien/"',
    harnais: "test-guides-traduits.mjs",
    attendu: "même statut d'origine que son jumeau anglais",
  },
  {
    nom: "une traduction se déclare révisée AVANT d'avoir été publiée",
    id: "une-traduction-se-declare-revisee-avant-d-avoir-ete-publ",
    fichier: "packages/ui/src/content/guides/es/retroplanning-de-un-vuelo-internacional.md",
    cherche: 'lastmod: "2026-08-19',
    remplace: 'lastmod: "2026-08-15',
    harnais: "test-guides-traduits.mjs",
    attendu: "aucun guide n'est révisé avant d'être publié",
  },
  {
    nom: "un guide se redate dans le futur, comme les six de l'étalement inventé",
    id: "un-guide-se-redate-dans-le-futur-comme-les-six-de-l-etal",
    fichier: "packages/ui/src/content/guides/es/retroplanning-de-un-vuelo-internacional.md",
    cherche: 'lastmod: "2026-08-19T09:00:00+02:00"',
    remplace: 'lastmod: "2027-08-19T09:00:00+02:00"',
    harnais: "test-guides-traduits.mjs",
    attendu: "aucun guide ne se déclare publié ou révisé dans le futur",
  },
  /* ---- LE CATALOGUE SE SURVEILLE LUI-MÊME -----------------------------------------------------
   * Ces trois-là mutent CE FICHIER et n'appellent que `--contrat`, qui vérifie la bijection puis
   * sort sans jouer une seule mutation : sans quoi le runner se relancerait entièrement lui-même.
   *
   * LEUR ANCRE EST MULTILIGNE, ET CE N'EST PAS UN DÉTAIL. Un fichier qui se mute lui-même contient
   * ses propres chaînes de recherche : l'ancre d'une seule ligne `id: "…"` apparaissait au vrai
   * site ET dans le texte de ces trois mutations, donc trois fois. Le runner les a déclarées
   * MUETTES — son échec dur pour « la mutation ne s'applique pas de façon univoque » —, et il
   * avait raison. Dans un littéral JS le saut de ligne s'écrit `\n`, deux caractères : une ancre
   * qui en porte un ne peut donc matcher que le vrai code, jamais sa propre citation.
   */
  {
    nom: "une garantie disparaît proprement du catalogue",
    id: "une-garantie-disparait-proprement-du-catalogue",
    fichier: "test-contre-epreuves.mjs",
    cherche: '\n    id: "un-avis-peut-a-nouveau-repeter-le-meme-canal",',
    remplace: "",
    harnais: "test-contre-epreuves.mjs",
    args: ["--contrat"],
    attendu: "attendue(s) mais ABSENTE(s) du catalogue",
  },
  {
    nom: "deux mutations portent le même identifiant",
    id: "deux-mutations-portent-le-meme-identifiant",
    fichier: "test-contre-epreuves.mjs",
    cherche: '\n    id: "un-avis-peut-a-nouveau-repeter-le-meme-canal",',
    remplace: '\n    id: "un-tableau-de-preuves-vide-redevient-acceptable",',
    harnais: "test-contre-epreuves.mjs",
    args: ["--contrat"],
    attendu: "identifiant(s) EN DOUBLE",
  },
  {
    nom: "une identité est substituée, à effectif constant",
    id: "une-identite-est-substituee-a-effectif-constant",
    fichier: "test-contre-epreuves.mjs",
    cherche: '\n    id: "un-avis-peut-a-nouveau-repeter-le-meme-canal",',
    remplace: '\n    id: "un-avis-peut-a-nouveau-repeter-le-meme-canal-bis",',
    harnais: "test-contre-epreuves.mjs",
    args: ["--contrat"],
    attendu: "INCONNUE(s) de la référence",
  },
  // ---- L'INTERFACE (chaque mutation exige un build, d'où `--dom`) ----
  {
    dom: true,
    nom: "l'interface republie un rapport sans `safety_advisories` comme « aucun avis »",
    id: "l-interface-republie-un-rapport-sans-safety-advisories-c",
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
    id: "une-portee-inconnue-est-de-nouveau-elargie-a-toutes-les",
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
    id: "une-etape-d-installation-disparait-d-un-seul-job-l-eping",
    fichier: ".github/workflows/ci.yml",
    cherche: "      - name: Node 22 (depuis .nvmrc)\n        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0\n        with:\n          node-version-file: .nvmrc\n          cache: npm\n\n      - name: Installation reproductible",
    remplace: "      - name: Installation reproductible",
    harnais: "packages/knowledge/scripts/check-actions-node.mjs",
    attendu: "le manifeste en attend 1",
  },
  {
    distComplet: true,
    nom: "le contrôle hors-sitemap se tait au lieu de dire qu'il ne peut pas conclure",
    id: "le-controle-hors-sitemap-se-tait-au-lieu-de-dire-qu-il-n",
    fichier: "packages/knowledge/scripts/audit-site.mjs",
    cherche: "if (indexables.length === 0) {",
    remplace: "if (false) {",
    harnais: "test-audit-observations.mjs",
    attendu: "la section INFO porte la ligne ENTIÈRE du contrôle hors-sitemap",
  },
  {
    distComplet: true,
    nom: "la sévérité INFO quitte l'ordre d'affichage, ET sa garde est neutralisée",
    id: "la-severite-info-quitte-l-ordre-d-affichage-et-sa-garde",
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

  // ---- LES QUATRE INDEX DU TRAVEL HUB ----
  //
  // Le défaut d'origine — cinq rubriques en français, libellés anglais en espagnol et en
  // portugais — a vécu plusieurs jours dans `main`, a traversé quatre pull requests, deux jobs
  // de CI, 45 contre-épreuves et un contre-test navigateur. Il a été vu à l'œil sur une capture.
  // Les cinq mutations ci-dessous reproduisent chacune une FORME de ce défaut, et exigent que
  // `test-index-travel-hub.mjs` rougisse avec son diagnostic propre — pas seulement qu'il échoue.
  {
    dom: true,
    nom: "un libellé de rubrique redevient anglais sur les pages espagnoles",
    id: "un-libelle-de-rubrique-redevient-anglais-sur-les-pages-e",
    fichier: "packages/knowledge/translations/es/strings.json",
    cherche: '"travel_hub.category.gear": "Equipo"',
    remplace: '"travel_hub.category.gear": "Gear"',
    harnais: "test-index-travel-hub.mjs",
    attendu: "libellé anglais « Gear » sur une page ES",
  },
  {
    dom: true,
    nom: "le surtitre espagnol redevient « Travel Hub »",
    id: "le-surtitre-espagnol-redevient-travel-hub",
    fichier: "packages/knowledge/translations/es/strings.json",
    cherche: '"nav.travel_hub": "Central de viajes"',
    remplace: '"nav.travel_hub": "Travel Hub"',
    harnais: "test-index-travel-hub.mjs",
    attendu: "surtitre « Travel Hub » au lieu de « Central de viajes »",
  },
  {
    dom: true,
    nom: "la clé de rubrique est affichée telle quelle, sans passer par les traductions",
    id: "la-cle-de-rubrique-est-affichee-telle-quelle-sans-passer",
    fichier: "packages/ui/src/pages/[...loc]/travel-hub/index.astro",
    cherche: "const libelle = (cle: string) => t(locale, `travel_hub.category.${cle}`);",
    remplace: "const libelle = (cle: string) => cle;",
    harnais: "test-index-travel-hub.mjs",
    attendu: "la clé est affichée telle quelle comme libellé",
  },
  {
    dom: true,
    nom: "une langue seule voit ses effectifs dériver, les trois autres restant justes",
    id: "une-langue-seule-voit-ses-effectifs-deriver-les-trois-au",
    /* La forme EXACTE du défaut d'origine : une langue en désaccord avec les autres. Le total
       français restait pourtant juste — 10 + 10 font 20 — ce qui montre qu'un contrôle du seul
       total serait passé à côté. Ici un guide change de rubrique : 19 et 26 au lieu de 20 et 25,
       et la signature française cesse de correspondre aux trois autres. */
    fichier: "packages/ui/src/content/guides/fr/embargos-chaleur-en-soute.md",
    cherche: 'category: "travel"',
    remplace: 'category: "gear"',
    harnais: "test-index-travel-hub.mjs",
    attendu: "guide(s) au lieu de",
  },
  {
    dom: true,
    nom: "les rubriques deviennent illisibles au harnais, qui doit le dire au lieu de se taire",
    id: "les-rubriques-deviennent-illisibles-au-harnais-qui-doit",
    /* « JAMAIS VERT FAUTE DE MATIÈRE ». Sans l'attribut, l'extraction ne trouve plus aucune
       rubrique. Un harnais mal écrit conclurait « rien à redire » sur zéro rubrique lue — c'est
       la panne la plus dangereuse, parce qu'elle est verte. Celui-ci doit compter QUATRE
       rubriques, donc zéro le met en défaut. */
    fichier: "packages/ui/src/pages/[...loc]/travel-hub/index.astro",
    cherche: '<h2 class="th-h2" id={cle} data-categorie={cle}>',
    remplace: '<h2 class="th-h2" id={cle}>',
    harnais: "test-index-travel-hub.mjs",
    attendu: "rubrique(s) au lieu de 4",
  },

  // ---- LA MIGRATION DES RUBRIQUES ----
  //
  // Les deux mutations ci-dessous reproduisent les deux P0 relevés par la contre-revue du
  // 23/08/2026. Toutes deux portent sur du code de VÉRIFICATION, et c'est ce qui les rend
  // précieuses : un défaut dans un vérificateur ne se voit jamais dans son verdict.
  {
    nom: "la migration écrit au fil de l'eau et laisse un dépôt à moitié migré",
    id: "la-migration-ecrit-au-fil-de-l-eau-et-laisse-un-depot-a",
    /* L'état exact d'avant le correctif : validation et écriture dans la même boucle. Codex a
       placé une rubrique inconnue dans le dernier fichier PT — sortie 1, et 287 fichiers déjà
       écrits. Un code de sortie honnête sur un dépôt incohérent. */
    fichier: "packages/knowledge/scripts/migrer-categories.mjs",
    editions: [
      { cherche: "    plan.push({ chemin, texte, ligne: ligne[0], cle });",
        remplace: "    if (!DRY) writeFileSync(chemin, texte.replace(ligne[0], `category: \"${cle}\"`));\n    plan.push({ chemin, texte, ligne: ligne[0], cle });" },
    ],
    harnais: "test-migration-categories.mjs",
    attendu: "l'arbre a CHANGÉ malgré l'échec",
  },
  {
    nom: "un guide est rangé sous une clé valide mais fausse au regard de son ancienne rubrique",
    id: "un-guide-est-range-sous-une-cle-valide-mais-fausse-au-re",
    /* La correspondance doit MORDRE, et pas seulement exister. La clé posée ici est parfaitement
       licite au regard du schéma — `z.enum` la laisse passer, le site se construit, l'index
       affiche quatre rubriques — mais elle ne correspond PAS à ce que portait le fichier avant
       migration. Seul un vérificateur qui recalcule depuis l'état antérieur peut le voir. */
    fichier: "packages/ui/src/content/guides/es/embargos-por-calor-en-bodega.md",
    cherche: 'category: "travel"',
    remplace: 'category: "health"',
    harnais: "preuve-migration-categories.mjs",
    attendu: "aurait dû donner",
  },

  // ---- LES COUVERTURES DES GUIDES ----
  //
  // Le champ `cover` est `optional()` au schéma, à raison : un guide sans photo reste lisible.
  // Mais « toléré par le schéma » n'est pas « voulu », et c'est tout l'écart que ces trois
  // mutations éprouvent. Aucune ne casse le build : le site se construit dans les trois cas.
  {
    nom: "une couverture pointe vers une image qui n'existe pas",
    id: "une-couverture-pointe-vers-une-image-qui-n-existe-pas",
    /* `image` est une chaîne au schéma : Astro construit sans broncher et la page sert une
       image morte. Seule une confrontation au disque peut le voir. */
    fichier: "packages/ui/src/content/guides/en/pet-travel-documents.md",
    cherche: 'image: "/travel-hub/pet-travel-documents.webp"',
    remplace: 'image: "/travel-hub/pet-travel-documents-disparue.webp"',
    harnais: "test-couvertures-guides.mjs",
    attendu: "image INTROUVABLE",
  },
  {
    nom: "un texte alternatif portugais est recopié de l'anglais",
    id: "un-texte-alternatif-portugais-est-recopie-de-l-anglais",
    /* Le `alt` ne s'adresse qu'à qui NE VOIT PAS l'image — donc au seul lecteur qui ne pourra
       jamais s'apercevoir qu'on lui parle anglais. C'est la forme la plus silencieuse du défaut
       que le Travel Hub vient de fermer sur ses rubriques. */
    fichier: "packages/ui/src/content/guides/pt/documentos-de-viagem-para-cachorro.md",
    cherche: '  alt: "Um passaporte aberto coberto de carimbos de visto, sobre uma pasta"',
    remplace: '  alt: "An open passport covered in visa stamps, resting on a folder"',
    harnais: "test-couvertures-guides.mjs",
    attendu: "partagent le MÊME texte alternatif",
  },
  {
    nom: "deux langues d'un même guide montrent deux photos différentes",
    id: "deux-langues-d-un-meme-guide-montrent-deux-photos-diffe",
    /* Une couverture est un fait éditorial attaché au GUIDE, pas à sa traduction. Deux images
       pour un même article signalent presque toujours une reprise partielle — et l'image posée
       ici existe bel et bien, si bien que le contrôle du disque, lui, resterait vert. */
    fichier: "packages/ui/src/content/guides/es/documentos-de-viaje-para-perro.md",
    cherche: 'image: "/travel-hub/pet-travel-documents.webp"',
    remplace: 'image: "/travel-hub/booking-a-pet-flight.webp"',
    harnais: "test-couvertures-guides.mjs",
    attendu: "images différentes selon la langue",
  },
  {
    nom: "un texte alternatif s'écarte de la référence approuvée",
    id: "un-texte-alternatif-s-ecarte-de-la-reference-approuvee",
    /* La phrase posée ici est FRANÇAISE, plausible, et différente des trois autres langues : elle
       satisfait tous les contrôles de forme. Seule la confrontation à la référence peut la voir.
       C'est ce qui remplace la prétention abandonnée — « chaque alt dans sa langue » — par une
       promesse tenable : ces textes sont ceux qui ont été relus. */
    fichier: "packages/ui/src/content/guides/fr/documents-de-voyage-pour-chien.md",
    cherche: '  alt: "Un passeport ouvert couvert de tampons de visa, posé sur une chemise"',
    remplace: '  alt: "Un passeport ouvert posé sur un bureau, avec des tampons"',
    harnais: "test-couvertures-guides.mjs",
    attendu: "NON CONFORME à la référence",
  },
  {
    nom: "un guide perd une langue et gagne une clé fantôme",
    id: "un-guide-perd-une-langue-et-gagne-une-cle-fantome",
    /* Compter 72 fichiers par langue ne prouvait RIEN : renommer la seule clé portugaise laisse
       72 fichiers partout, un guide en trois langues et une clé qui n'existe qu'en portugais. Le
       harnais annonçait alors « 73 guides pourvus dans les quatre langues ». Un décompte n'est
       pas une bijection. */
    fichier: "packages/ui/src/content/guides/pt/documentos-de-viagem-para-cachorro.md",
    cherche: 'key: "pet-travel-documents"',
    remplace: 'key: "pet-travel-papers"',
    harnais: "test-couvertures-guides.mjs",
    attendu: "absent en PT",
  },
  {
    nom: "un téléchargement incomplet est publié, et les quatre guides y sont repointés",
    id: "un-telechargement-incomplet-est-publie-et-les-quatre-gui",
    /* L'état exact d'avant le correctif, en trois éditions parce que le défaut en exigeait trois :
       écriture directe dans la destination, aucun nettoyage, et une réécriture conditionnée à
       l'EXISTENCE du fichier plutôt qu'à sa validation. Le fichier partiel survivait à l'échec,
       et les quatre langues étaient repointées vers lui dans la seconde où le compte rendu
       annonçait « échec ». */
    fichier: "packages/knowledge/scripts/fetch-guide-covers.mjs",
    editions: [
      { cherche: "  const temp = `${out}.part`;", remplace: "  const temp = out;" },
      { cherche: "    if (existsSync(temp)) rmSync(temp, { force: true });",
        remplace: "    /* aucun nettoyage */" },
      { cherche: "    if (!key || !validees.has(key) || !existsSync(join(DEST, `${key}.jpg`))) continue;",
        remplace: "    if (!key || !existsSync(join(DEST, `${key}.jpg`))) continue;" },
    ],
    harnais: "test-fetch-couvertures.mjs",
    attendu: "a été MODIFIÉ alors que le téléchargement a échoué",
  },
  {
    nom: "un fichier déjà présent est cru sur son existence, sans être ouvert",
    id: "un-fichier-deja-present-est-cru-sur-son-existence-sans-e",
    /* « Existe » n'est pas « validé ». Un `.jpg` de 9 000 octets de TEXTE dépassait le seuil de
       taille, était classé « déjà présent », et les quatre langues étaient repointées vers lui.
       La taille ne dit rien du format : seule une lecture des octets le voit. */
    fichier: "packages/knowledge/scripts/fetch-guide-covers.mjs",
    editions: [
      { cherche: "    try { validerJpeg(out); deja.push(key); }\n    catch (e) { echecs.push(`${key} : fichier déjà présent mais INVALIDE — ${e.message}`); }\n    continue;",
        remplace: "    deja.push(key);\n    continue;" },
    ],
    harnais: "test-fetch-couvertures.mjs",
    attendu: "a été MODIFIÉ alors que le téléchargement a échoué",
  },
  {
    nom: "le téléchargeur liste ses échecs puis sort en 0",
    id: "le-telechargeur-liste-ses-echecs-puis-sort-en-0",
    /* Un travail qui rend compte de son échec dans un code de sortie « tout va bien » ne rend
       compte de rien : l'appelant — CI, script, humain pressé — le croit réussi. */
    fichier: "packages/knowledge/scripts/fetch-guide-covers.mjs",
    cherche: "  console.error(`\\n${echecs.length} échec(s) : aucun de ces guides n'a été repointé.`);\n  process.exit(1);",
    remplace: "  console.error(`\\n${echecs.length} échec(s) : aucun de ces guides n'a été repointé.`);",
    harnais: "test-fetch-couvertures.mjs",
    attendu: "sort en 0 alors qu'il a échoué",
  },
  {
    nom: "une image disparaît de la référence avec toute sa provenance",
    id: "une-image-disparait-de-la-reference-avec-toute-sa-proven",
    /* « Référence non vide » ne verrouillait rien : retirer une entrée emportait l'image, sa
       provenance et ses quatre textes alternatifs, et le harnais annonçait « 9 images · 36
       textes », en sortant 0. Les dix identités sont désormais écrites DANS le contrôle. */
    fichier: "couvertures-guides.json",
    cherche: '"pet-travel-documents": {',
    remplace: '"pet-travel-papers": {',
    harnais: "test-couvertures-guides.mjs",
    attendu: "clé(s) ATTENDUE(S) absente(s) de la référence",
  },
  {
    nom: "une provenance se déclare vérifiée sans dire par qui ni d'où",
    id: "une-provenance-se-declare-verifiee-sans-dire-par-qui-ni",
    /* Le champ `verifie` décorait : le poser à `true` avec un auteur et une URL à `null` passait.
       Se déclarer vérifié sans nommer le vérificateur, la date et la source n'est pas une
       vérification, c'est une affirmation. */
    fichier: "couvertures-guides.json",
    cherche: '      "verifie": false,\n      "acquise_le": "2026-08-23",\n      "alt": {\n        "en": "A small Pomeranian',
    remplace: '      "verifie": true,\n      "acquise_le": "2026-08-23",\n      "alt": {\n        "en": "A small Pomeranian',
    harnais: "test-couvertures-guides.mjs",
    attendu: "« verifie: true » mais « auteur » vide",
  },
  {
    distComplet: true,
    nom: "une page sans crédit n'est plus déclarée, et le harnais compte au lieu d'identifier",
    id: "une-page-sans-credit-n-est-plus-declaree-et-le-harnais-c",
    /* Le contrôle figeait un NOMBRE — « les 4 connues, pas une de plus » — sans dire lesquelles.
       Il rougissait donc pour toute décision éditoriale nouvelle, et serait resté vert si quatre
       AUTRES pages avaient perdu leur crédit. Retirer une clé de l'ensemble déclaré doit faire
       apparaître ses quatre pages comme NON déclarées. */
    fichier: "test-page-guide.mjs",
    cherche: '  "flying-with-a-dog-cabin-hold-cargo",',
    remplace: "",
    harnais: "test-page-guide.mjs",
    attendu: "NON déclarée",
  },
];

const dire = (m) => process.stdout.write(m + "\n");
let ATTENDUES_N = 0;
const git = (...a) => execFileSync("git", a, { encoding: "utf8" });
const arbreSale = () => git("status", "--porcelain", "--untracked-files=all").trim();

/* ---- LE CONTRAT DU CATALOGUE : UNE SECONDE SOURCE, ET UNE BIJECTION -------------------------
 *
 * LE TROU QUE CECI FERME, trouvé par Codex le 23/08/2026. `--tout` garantit que toutes les
 * mutations PRÉSENTES ont été sélectionnées et jouées. Il ne garantit RIEN sur celles qui
 * devraient l'être : supprimer proprement un objet de `MUTATIONS` laissait les trois compteurs de
 * non-jouées à zéro et le runner concluait « 40 sur 40 », avec succès. Une garantie disparue en
 * silence, et un workflow hebdomadaire vert pour l'annoncer.
 *
 * POURQUOI PAS UN SIMPLE DÉCOMPTE. `MUTATIONS.length === 44` attraperait la suppression — pas la
 * SUBSTITUTION à effectif constant : retirer une garantie et en ajouter une autre laisse le total
 * intact. C'est donc une BIJECTION sur des identifiants, pas une comparaison de cardinaux.
 *
 * Quatre défauts distincts, quatre diagnostics distincts : identifiant manquant ou mal formé,
 * identifiant en double, garantie attendue absente, mutation inconnue de la référence. Et la
 * référence vide est refusée d'emblée — elle s'accorderait avec n'importe quel catalogue, ce qui
 * est la version « faute de matière » de ce contrôle-ci.
 *
 * `--contrat` vérifie tout cela puis SORT, sans jouer une seule mutation : c'est ce qui permet aux
 * trois contre-épreuves du catalogue de s'appeler elles-mêmes sans se relancer entièrement. Il ne
 * dépend pas de la propreté de l'arbre — il n'écrit rien — et se place donc avant ce garde-fou. */
const CONTRAT = process.argv.includes("--contrat");
{
  const ATTENDUES = JSON.parse(readFileSync("contre-epreuves-attendues.json", "utf8")).identifiants;
  const ids = MUTATIONS.map((m) => m.id);
  const malFormes = MUTATIONS.filter((m) => typeof m.id !== "string"
    || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.id)).map((m) => m.nom);
  const doubles = [...new Set(ids.filter((i, n) => i && ids.indexOf(i) !== n))];
  const presentes = new Set(ids.filter(Boolean));
  const absentes = ATTENDUES.filter((i) => !presentes.has(i));
  const inconnues = [...presentes].filter((i) => !ATTENDUES.includes(i));
  const griefs = [];
  if (!Array.isArray(ATTENDUES) || ATTENDUES.length === 0) {
    griefs.push("la référence est VIDE : elle s'accorderait avec n'importe quel catalogue");
  }
  if (new Set(ATTENDUES).size !== ATTENDUES.length) {
    griefs.push("la référence elle-même porte des identifiant(s) EN DOUBLE");
  }
  if (malFormes.length) {
    griefs.push(`${malFormes.length} mutation(s) sans identifiant utilisable : ${malFormes.slice(0, 3).join(" · ")}`);
  }
  if (doubles.length) griefs.push(`${doubles.length} identifiant(s) EN DOUBLE : ${doubles.join(" · ")}`);
  if (absentes.length) {
    griefs.push(`${absentes.length} garantie(s) attendue(s) mais ABSENTE(s) du catalogue : ${absentes.join(" · ")}`);
  }
  if (inconnues.length) {
    griefs.push(`${inconnues.length} mutation(s) INCONNUE(s) de la référence : ${inconnues.join(" · ")}`);
  }
  if (griefs.length) {
    process.stderr.write("[contre-épreuves] ÉCHEC — le catalogue ne correspond pas à sa référence :\n"
      + griefs.map((g) => `  · ${g}`).join("\n") + "\n"
      + "  Retirer ou renommer une garantie se fait en DEUX endroits : ici et dans "
      + "`contre-epreuves-attendues.json`.\n");
    process.exit(1);
  }
  ATTENDUES_N = ATTENDUES.length;
  if (CONTRAT) {
    dire(`[contre-épreuves] contrat du catalogue : ${ATTENDUES_N} garanties, bijection exacte avec la référence.`);
    process.exit(0);
  }
}

if (arbreSale()) {
  process.stderr.write("[contre-épreuves] ÉCHEC — l'arbre est sale : ces mutations écrivent dans "
    + "les fichiers du dépôt et les restaurent par `git checkout`. Partir d'un arbre modifié "
    + `risquerait d'effacer un travail en cours :\n${arbreSale()}\n`);
  process.exit(1);
}

const joue = (m) => m.buildComplet ? AVEC_COMPLET
  : m.distComplet ? AVEC_DIST_COMPLET
  : AVEC_DOM || !m.dom;
/* L'ORDRE N'EST PAS LIBRE, et c'est ce qui rend `--tout` jouable en UNE passe. Une mutation
   d'interface reconstruit `packages/ui/dist` en portée RÉDUITE ; jouée avant celles qui LISENT le
   site complet, elle leur retirerait la matière sous les pieds et elles échoueraient sans que la
   mutation y soit pour rien. Les voici donc reléguées à la fin — partition stable, l'ordre relatif
   du catalogue est conservé dans chaque moitié. */
const choisies = [...MUTATIONS.filter((m) => joue(m) && !m.dom),
                  ...MUTATIONS.filter((m) => joue(m) && m.dom)];
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

/* UNE MUTATION PEUT TOUCHER PLUSIEURS FICHIERS, et c'est parfois la seule façon de décrire la
   régression réelle. `fichiers: [{ fichier, editions }]` en donne le moyen ; `fichier` + `editions`
   (ou `cherche`/`remplace`) restent la forme courte pour le cas ordinaire.

   POURQUOI CE BESOIN EST APPARU. La mutation « une épingle du manifeste ne sert plus à rien »
   portait déjà DEUX éditions parce que le workflow a deux jobs : la retirer d'un seul la laissait
   utile à l'autre. Le lot 3 ajoute un SECOND WORKFLOW qui l'utilise aussi — le même raisonnement
   monte donc d'un cran, et deux éditions dans un seul fichier ne suffisent plus. Le runner l'a
   montré tout seul : il a refusé le diagnostic obtenu parce que ce n'était pas celui attendu. */
const cibles = (m) => m.fichiers
  ?? [{ fichier: m.fichier, editions: m.editions ?? [{ cherche: m.cherche, remplace: m.remplace }] }];

for (const m of choisies) {
  const sources = new Map(cibles(m).map((c) => [c.fichier, readFileSync(c.fichier, "utf8")]));
  /* Une édition qui ne s'applique plus est un ÉCHEC DUR, jamais un « rien à faire » : elle
     prouverait le vide en silence. Une chaîne ambiguë l'est tout autant. */
  let muette = null;
  for (const c of cibles(m)) {
    const src = sources.get(c.fichier);
    const e = c.editions.find((x) => src.split(x.cherche).length - 1 !== 1);
    if (e) { muette = { ...e, fichier: c.fichier, vu: src.split(e.cherche).length - 1 }; break; }
  }
  if (muette) {
    echecs.push(`${m.nom}\n      la mutation ne s'applique pas : « ${muette.cherche.slice(0, 60)}… » `
      + `apparaît ${muette.vu} fois dans ${muette.fichier} (attendu : 1). `
      + `Le code a bougé — la mutation doit être remise à jour, sans quoi elle ne prouve plus rien.`);
    dire(`  MUETTE  ${m.nom}`);
    continue;
  }
  let resultat;
  try {
    for (const c of cibles(m)) {
      writeFileSync(c.fichier,
        c.editions.reduce((t, e) => t.replace(e.cherche, e.remplace), sources.get(c.fichier)));
    }
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
    for (const c of cibles(m)) git("checkout", "--", `:(literal)${c.fichier}`);
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
/* Sous `--tout`, ne pas jouer une mutation n'est plus une information : c'est un échec. */
/* Sous `--tout`, la couverture se juge sur la RÉFÉRENCE, pas sur ce que le catalogue contenait au
   moment de l'exécution : c'est ce qui distingue « tout ce qui est là » de « tout ce qui est dû ». */
if (TOUT && tenues !== ATTENDUES_N) {
  echecs.push(`« --tout » : ${tenues} garantie(s) tenue(s) pour ${ATTENDUES_N} attendues par la référence.`);
}
if (TOUT && (ignoreesDom || ignoreesCompletes || ignoreesDist)) {
  echecs.push(`« --tout » demandé, mais ${ignoreesDom + ignoreesCompletes + ignoreesDist} mutation(s) `
    + "n'ont pas été jouées. La couverture annoncée n'est pas celle obtenue.");
}
if (echecs.length) {
  process.stderr.write(`\n[contre-épreuves] ÉCHEC — ${echecs.length} :\n`
    + echecs.map((e) => `  · ${e}`).join("\n") + "\n");
  process.exit(1);
}
dire("[contre-épreuves] toutes les garanties éprouvées portent réellement.");
