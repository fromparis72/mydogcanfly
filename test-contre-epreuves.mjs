#!/usr/bin/env node
/**
 * LES CONTRE-ÉPREUVES, MÉCANISÉES.
 *
 *   npm run contre-epreuves            les mutations du moteur et des données (rapide)
 *   npm run contre-epreuves -- --dom   y ajoute celles de l'interface (chacune exige un build)
 *   npm run contre-epreuves -- --complet  y ajoute celles qui exigent le SITE ENTIER (~12 min chacune)
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
import { readFileSync, writeFileSync } from "node:fs";

const AVEC_DOM = process.argv.includes("--dom");
/* Certaines garanties ne se lisent que sur le site ENTIER — les `hreflang` et les sitemaps
 * confrontés aux pages construites. Sous le build réduit, leur harnais échouerait faute de pages
 * et non parce que la mutation a mordu : il prouverait le vide. Elles sont donc derrière un
 * drapeau distinct, parce qu'elles coûtent un build complet chacune, et le total ci-dessous dit
 * toujours combien n'ont PAS été jouées. */
const AVEC_COMPLET = process.argv.includes("--complet");

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
  // ---- LA CHAÎNE D'INTÉGRATION : les actions et leur runtime ----
  {
    nom: "une action redevient épinglée sur un tag, qui se déplace",
    fichier: ".github/workflows/ci.yml",
    /* ANCRE ÉLARGIE le 20/08/2026 : deux jobs partagent désormais ces étapes. */
    cherche: "timeout-minutes: 30\n\n    steps:\n      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1",
    remplace: "timeout-minutes: 30\n\n    steps:\n      - uses: actions/checkout@v7 # v7.0.1",
    harnais: "packages/knowledge/scripts/check-actions-node.mjs",
    attendu: "n'est pas épinglée sur un SHA complet",
  },
  {
    nom: "une épingle jamais mesurée entre dans le workflow",
    fichier: ".github/workflows/ci.yml",
    /* ANCRE ÉLARGIE le 20/08/2026 : le workflow a désormais DEUX jobs, qui partagent les mêmes
       étapes d'installation. La mutation courte est devenue ambiguë et le runner l'a déclarée
       MUETTE — c'est exactement ce pour quoi cet état existe. L'ancre inclut le voisinage qui
       distingue le job `verify` de `site-complet`. */
    cherche: "timeout-minutes: 30\n\n    steps:\n      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1",
    remplace: "timeout-minutes: 30\n\n    steps:\n      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0",
    harnais: "packages/knowledge/scripts/check-actions-node.mjs",
    attendu: "n'est PAS déclarée au manifeste",
  },
  {
    nom: "le commentaire de version ment sur le SHA qu'il annote",
    fichier: ".github/workflows/ci.yml",
    /* ANCRE ÉLARGIE le 20/08/2026 : le workflow a désormais DEUX jobs, qui partagent les mêmes
       étapes d'installation. La mutation courte est devenue ambiguë et le runner l'a déclarée
       MUETTE — c'est exactement ce pour quoi cet état existe. L'ancre inclut le voisinage qui
       distingue le job `verify` de `site-complet`. */
    cherche: "      - name: Node 22 (depuis .nvmrc)\n        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0\n        with:\n          node-version-file: .nvmrc\n          cache: npm\n\n      # Le seul contrôle du lot",
    remplace: "      - name: Node 22 (depuis .nvmrc)\n        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v6.5.0\n        with:\n          node-version-file: .nvmrc\n          cache: npm\n\n      # Le seul contrôle du lot",
    harnais: "packages/knowledge/scripts/check-actions-node.mjs",
    attendu: "alors que le manifeste dit",
  },
  {
    nom: "une épingle du manifeste ne sert plus à rien et y reste",
    fichier: ".github/workflows/ci.yml",
    /* ANCRE ÉLARGIE le 20/08/2026 : le workflow a désormais DEUX jobs, qui partagent les mêmes
       étapes d'installation. La mutation courte est devenue ambiguë et le runner l'a déclarée
       MUETTE — c'est exactement ce pour quoi cet état existe. L'ancre inclut le voisinage qui
       distingue le job `verify` de `site-complet`. */
    /* DEUX ÉDITIONS, et c'est le runner qui l'a montré : retirer `setup-node` du seul job
       `verify` laissait `site-complet` l'utiliser encore — l'épingle restait donc utile et le
       harnais restait vert. Une mutation doit décrire l'état RÉELLEMENT à craindre : l'action
       disparaît des deux jobs, et alors seulement son épingle devient orpheline. */
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
  // ---- LES GUIDES TRADUITS ----
  {
    nom: "un paragraphe est resté dans la langue source",
    fichier: "packages/ui/src/content/guides/es/viajar-en-avion-con-perro.md",
    cherche: "El avión abre la puerta a viajes lejanos con tu perro, pero es también el medio de transporte más regulado.",
    remplace: "Flying opens the door to far-away trips with your dog, but it's also the most heavily regulated way to travel.",
    harnais: "test-guides-traduits.mjs",
    attendu: "aucune phrase n'est restée en anglais",
  },
  {
    nom: "un guide né ici s'invente une adresse d'origine",
    fichier: "packages/ui/src/content/guides/es/viajar-en-avion-con-perro.md",
    cherche: `key: "flying-with-a-dog"`,
    remplace: `key: "flying-with-a-dog"\nsourceUrl: "/viajar-en-avion-con-perro/"`,
    harnais: "test-guides-traduits.mjs",
    attendu: "ne s'invente un `sourceUrl`",
  },
  {
    nom: "un lien renvoie à l'anglais alors que la traduction existe",
    fichier: "packages/ui/src/content/guides/es/avion-con-perro-cabina-bodega-carga.md",
    cherche: "](/es/travel-hub/viajar-en-avion-con-perro/)",
    remplace: "](/travel-hub/flying-with-a-dog/)",
    harnais: "test-guides-traduits.mjs",
    attendu: "aucun lien ne sort de la langue du lecteur",
  },
  {
    nom: "un guide renvoie vers un outil que le site ne sert pas",
    fichier: "packages/ui/src/content/guides/en/dog-heatstroke.md",
    cherche: "## Why are dogs so vulnerable to heat?",
    remplace:
      "👉 Check the live heat risk with our [checker](/tools/is-it-too-hot-for-my-dog/).\n\n## Why are dogs so vulnerable to heat?",
    harnais: "test-guides-traduits.mjs",
    attendu: "visent une route existante",
  },
  {
    nom: "un guide français importé perd son adresse d'origine",
    fichier: "packages/ui/src/content/guides/fr/mal-des-transports-chien.md",
    cherche: 'sourceUrl: "/mal-des-transports-chien/"\n',
    remplace: "",
    harnais: "test-guides-traduits.mjs",
    attendu: "même statut d'origine que son jumeau anglais",
  },
  {
    nom: "un guide français né ici s'invente une adresse d'origine",
    fichier: "packages/ui/src/content/guides/fr/retroplanning-vol-international-chien.md",
    cherche: 'key: "pet-flight-timeline"',
    remplace: 'key: "pet-flight-timeline"\nsourceUrl: "/retroplanning-vol-international-chien/"',
    harnais: "test-guides-traduits.mjs",
    attendu: "même statut d'origine que son jumeau anglais",
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
  /* ---- Ce que le site ANNONCE ----
   * Les deux régressions que la plus vieille leçon du chantier a laissées derrière elle : une
   * adresse annoncée qui ne mène nulle part, et une famille de pages qui décroche du sitemap sans
   * que rien ne le dise. Elles ont toujours été surveillées à la main, dans une conversation ;
   * elles le sont désormais ici. Le harnais visé lit les octets du site construit, d'où « dom » —
   * et le site ENTIER, d'où « buildComplet » : sous le build réduit, sitemaps complets contre
   * 121 pages construites, il échouerait sans que la mutation y soit pour rien.
   *
   * CE QU'ELLES NE COUVRENT PAS, ET JE PRÉFÈRE L'ÉCRIRE : « chaque guide annonce EXACTEMENT les
   * langues où sa clé existe » n'est revendiquée par aucune mutation, parce qu'elle est
   * aujourd'hui infalsifiable — le corpus est symétrique (72 clés × 4 langues), donc une
   * `languesDe()` qui renverrait les quatre langues sans les constater produirait exactement la
   * même sortie. Elle redeviendra éprouvable au premier contenu partiel. */
  {
    dom: true,
    buildComplet: true,
    nom: "l'adresse annoncée d'un guide traduit perd son préfixe de langue",
    fichier: "packages/ui/src/lib/guides.ts",
    cherche: 'locale === "en" ? `/travel-hub/${slug}/` : `/${locale}/travel-hub/${slug}/`;',
    remplace: '`/travel-hub/${slug}/`;',
    harnais: "test-annonce-du-site.mjs",
    attendu: "vise une page réellement construite",
  },
  {
    dom: true,
    buildComplet: true,
    nom: "les guides des langues traduites décrochent du sitemap",
    fichier: "packages/ui/src/pages/sitemap-[lang].xml.ts",
    cherche: "const guides = await guidesDe(lang);",
    remplace: 'const guides = lang === "en" ? await guidesDe(lang) : [];',
    harnais: "test-annonce-du-site.mjs",
    attendu: "listée au sitemap de SA langue",
  },
  /* ---- Le calculateur de caisse ----
   * T0-B3-g a constaté que quatre des huit outils du site ne sont lus par aucun harnais. Celui-ci
   * conseille une taille de caisse : une caisse trop petite est un refus à l'embarquement. Les
   * trois mutations décrivent les régressions réellement dangereuses, pas les plus petites. */
  {
    dom: true,
    nom: "une compagnie qui refuse les trois placements retrouve un message de soute ambigu",
    fichier: "packages/ui/src/components/CrateCalculator.astro",
    cherche: "if (air && air.noPets) {",
    remplace: "if (false && air.noPets) {",
    harnais: "test-crate-harness.cjs",
    attendu: "le message « ni cabine ni soute » est affiché mot pour mot",
  },
  {
    dom: true,
    nom: "la majoration brachycéphale de la caisse est neutralisée",
    fichier: "packages/ui/src/components/CrateCalculator.astro",
    cherche: "const k = brachy ? 1.1 : 1;",
    remplace: "const k = 1;",
    harnais: "test-crate-harness.cjs",
    attendu: "majore STRICTEMENT les trois dimensions",
  },
  {
    dom: true,
    nom: "la taille standard proposée ne couvre plus le minimum calculé",
    fichier: "packages/ui/src/components/CrateCalculator.astro",
    cherche: "const size = SIZES.find((s) => s.l >= Lc && s.w >= Wc && s.h >= Hc);",
    remplace: "const size = SIZES[0];",
    harnais: "test-crate-harness.cjs",
    attendu: "couvre le minimum calculé",
  },
  /* ---- Le chercheur de coins pipi ----
   * Cet outil ne calcule rien : il oriente. Son risque propre est l'orientation FAUSSE — une
   * pastille qui annonce une zone documentée là où le référentiel n'en connaît pas, un raccourci
   * « bien documenté » qui n'en est pas un, une soumission vide qui emmène quelque part. */
  {
    dom: true,
    nom: "la pastille de statut annonce une zone documentée là où il n'y en a pas",
    fichier: "packages/ui/src/components/PetReliefFinder.astro",
    cherche: 'no: "prf-d-no"',
    remplace: 'no: "prf-d-yes"',
    harnais: "test-pet-relief-harness.cjs",
    attendu: "la pastille rendue est celle du statut",
  },
  {
    dom: true,
    nom: "les raccourcis « bien documentés » ne filtrent plus sur le statut",
    fichier: "packages/ui/src/components/PetReliefFinder.astro",
    cherche: 'const featured = airports.filter((a) => a.relief === "yes").slice(0, 8);',
    remplace: "const featured = airports.slice(0, 8);",
    harnais: "test-pet-relief-harness.cjs",
    attendu: "tous les raccourcis sont au statut documenté",
  },
  {
    dom: true,
    nom: "une soumission sans aéroport navigue quand même",
    fichier: "packages/ui/src/components/PetReliefFinder.astro",
    cherche: "if (!a || !norm(input.value))",
    remplace: "if (false)",
    harnais: "test-pet-relief-harness.cjs",
    attendu: "une soumission sans aéroport affiche le message d'aide",
  },
  /* ---- Ce que le site LIE, et ce que ses pages de guides affichent ----
   * Deux harnais du site entier, donc deux mutations à build complet. Sous le build réduit, les
   * pages d'entités et les guides n'existent pas : les deux harnais échoueraient faute de matière,
   * sans que la mutation y soit pour rien. */
  {
    dom: true,
    buildComplet: true,
    nom: "les fiches d'entités sont liées par une adresse que le site ne sert pas",
    fichier: "packages/ui/src/lib/routes.ts",
    cherche: "  return localizeHref(`/${plural}/${slug}/`, locale);",
    remplace: "  return localizeHref(`/${plural}/${slug}-x/`, locale);",
    harnais: "test-liens-internes.mjs",
    attendu: "ne mènent nulle part",
  },
  {
    dom: true,
    buildComplet: true,
    nom: "le schéma FAQ annonce une question que la page n'affiche pas",
    fichier: "packages/ui/src/pages/[...loc]/travel-hub/[slug].astro",
    cherche: "    mainEntity: d.faq.map((f) => ({",
    remplace: "    mainEntity: [...d.faq, d.faq[0]].map((f) => ({",
    harnais: "test-page-guide.mjs",
    attendu: "annonce EXACTEMENT les questions",
  },
  /* ---- La chronologie des guides ----
   * `lastmod` a cessé le 20/08/2026 d'être exigé identique à l'anglais — cette égalité forçait à
   * ANTIDATER les traductions. L'assouplissement ouvrait la porte à n'importe quelle date : ces
   * deux mutations prouvent que le contrat qui l'a remplacé la referme. */
  {
    nom: "une traduction se déclare révisée AVANT d'avoir été publiée",
    fichier: "packages/ui/src/content/guides/es/retroplanning-de-un-vuelo-internacional.md",
    cherche: 'lastmod: "2026-08-19',
    remplace: 'lastmod: "2026-08-15',
    harnais: "test-guides-traduits.mjs",
    attendu: "aucun guide n'est révisé avant d'être publié",
  },
  {
    nom: "un guide se redate dans le futur, comme les six de l'étalement inventé",
    fichier: "packages/ui/src/content/guides/es/retroplanning-de-un-vuelo-internacional.md",
    cherche: 'lastmod: "2026-08-19T09:00:00+02:00"',
    remplace: 'lastmod: "2027-08-19T09:00:00+02:00"',
    harnais: "test-guides-traduits.mjs",
    attendu: "aucun guide ne se déclare publié ou révisé dans le futur",
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

const choisies = MUTATIONS.filter((m) =>
  m.buildComplet ? AVEC_COMPLET : AVEC_DOM || !m.dom);
const ignoreesDom = MUTATIONS.filter((m) => m.dom && !m.buildComplet && !AVEC_DOM).length;
const ignoreesCompletes = MUTATIONS.filter((m) => m.buildComplet && !AVEC_COMPLET).length;

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
     entier, restaurer un site réduit laisserait `dist` amputé de 2 400 pages — intact au sens de
     « sans mutation », mais inutilisable pour le harnais suivant, qui échouerait faute de matière. */
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
  dire(`  ${ignoreesCompletes} mutation(s) NON jouée(s) exigeant le SITE ENTIER — environ douze minutes de build chacune. « npm run contre-epreuves -- --complet » les inclut.`);
}
if (echecs.length) {
  process.stderr.write(`\n[contre-épreuves] ÉCHEC — ${echecs.length} :\n`
    + echecs.map((e) => `  · ${e}`).join("\n") + "\n");
  process.exit(1);
}
dire("[contre-épreuves] toutes les garanties éprouvées portent réellement.");
