#!/usr/bin/env node
/**
 * LES CONTRE-ÉPREUVES, MÉCANISÉES.
 *
 *   npm run contre-epreuves            les mutations du moteur et des données (rapide)
 *   npm run contre-epreuves -- --dom   y ajoute celles de l'interface (chacune exige un build)
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
    cherche: "uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1",
    remplace: "uses: actions/checkout@v7 # v7.0.1",
    harnais: "packages/knowledge/scripts/check-actions-node.mjs",
    attendu: "n'est pas épinglée sur un SHA complet",
  },
  {
    nom: "une épingle jamais mesurée entre dans le workflow",
    fichier: ".github/workflows/ci.yml",
    cherche: "uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1",
    remplace: "uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0",
    harnais: "packages/knowledge/scripts/check-actions-node.mjs",
    attendu: "n'est PAS déclarée au manifeste",
  },
  {
    nom: "le commentaire de version ment sur le SHA qu'il annote",
    fichier: ".github/workflows/ci.yml",
    cherche: "uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0",
    remplace: "uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v6.5.0",
    harnais: "packages/knowledge/scripts/check-actions-node.mjs",
    attendu: "alors que le manifeste dit",
  },
  {
    nom: "une épingle du manifeste ne sert plus à rien et y reste",
    fichier: ".github/workflows/ci.yml",
    cherche: "        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0",
    remplace: "        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1",
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

const choisies = MUTATIONS.filter((m) => AVEC_DOM || !m.dom);
const ignorees = MUTATIONS.length - choisies.length;

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
      const b = spawnSync("npm", ["run", "build:ci"], { encoding: "utf8" });
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
    /* Restauration systématique : une mutation laissée en place corromprait tout ce qui suit. */
    git("checkout", "--", m.fichier);
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
  const r = spawnSync("npm", ["run", "build:ci"], { encoding: "utf8" });
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
if (ignorees) {
  /* Jamais de troncature muette : dire ce qui n'a pas été joué vaut mieux qu'un total flatteur. */
  dire(`  ${ignorees} mutation(s) d'interface NON jouée(s) — chacune exige un build. « npm run contre-epreuves -- --dom » les inclut.`);
}
if (echecs.length) {
  process.stderr.write(`\n[contre-épreuves] ÉCHEC — ${echecs.length} :\n`
    + echecs.map((e) => `  · ${e}`).join("\n") + "\n");
  process.exit(1);
}
dire("[contre-épreuves] toutes les garanties éprouvées portent réellement.");
