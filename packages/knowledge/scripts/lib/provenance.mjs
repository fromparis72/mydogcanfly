/**
 * LA CARTE D'IDENTITÉ D'UN SITE CONSTRUIT — producteur, garde-fou d'environnement et validateur,
 * au même endroit.
 *
 * `packages/ui/dist` est ignoré par git : rien, en le lisant, ne dit de QUELLE version il sort.
 * Un dossier de mesure qui s'en contente parce qu'il « compte assez de pages » peut donc valider
 * un site construit d'un autre commit, ou amputé de centaines de pages qu'il ne regarde pas.
 *
 * POURQUOI CE MODULE EXISTE PLUTÔT QUE QUATRE COPIES. La première version écrivait la carte dans
 * `build-ci.mjs` ET `build-preview.mjs`, puis la relisait dans T0-B3-d ET T0-B3-e — quatre copies
 * d'un même contrat, qui avaient déjà commencé à diverger : l'une des deux écritures portait un
 * antislash littéral au lieu d'un saut de ligne.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * HISTOIRE DU PÉRIMÈTRE, PARCE QU'ELLE EXPLIQUE LA FORME ACTUELLE
 *
 * v4 — J'avais retiré `scripts/` de l'empreinte au motif que `BUILD_ONLY` et `BUILD_SLUGS`,
 *      inscrits sur la carte, capturaient déjà l'influence du constructeur. C'est faux : ces
 *      variables décrivent ses PARAMÈTRES, pas son IMPLÉMENTATION. Le motif que j'avançais —
 *      éviter des reconstructions inutiles — est un problème de CONFORT, et on ne règle pas un
 *      problème de confort en affaiblissant une preuve.
 *
 * v5 — Liste fichier par fichier, énumérée à la main. Codex a reproduit le trou le 22/08/2026 :
 *      `packages/ui/scripts/fix-404.mjs` — invoqué par le script `build` de `packages/ui` — et
 *      `packages/ui/tsconfig.json` n'y figuraient pas. On pouvait donc les modifier sans que
 *      l'empreinte bouge NI que `salete()` dise quoi que ce soit. Le défaut n'est pas d'avoir
 *      oublié deux chemins : c'est qu'une liste énumérée à la main est fausse par construction,
 *      et qu'elle le redevient à chaque fichier ajouté.
 *
 * v6, celle-ci — LES PAQUETS ENTIERS, avec des exclusions explicites, bornées et VÉRIFIÉES.
 *      Le défaut se retourne dans le bon sens : un fichier nouveau est dans le périmètre par
 *      défaut, et il faut un geste délibéré — inscrit dans EXCLUSIONS, donc inscrit sur la carte,
 *      donc invalidant toutes les cartes existantes — pour l'en sortir. Une entrée qui ne
 *      couvrirait AUCUN fichier suivi arrête tout : c'est la règle « jamais vert faute de
 *      matière » appliquée à l'empreinte elle-même, et c'est ce qui rend impossible la famille
 *      de pannes où quatorze condensés valent tous `e3b0c442…` (le sha256 du vide).
 * ────────────────────────────────────────────────────────────────────────────────────────────
 *
 * GIT ÉCHOUE FERMÉ. La version précédente enveloppait chaque appel dans un `catch { return "" }`.
 * Hors dépôt git — ou avec un git absent, ou un index verrouillé — elle rendait donc quatorze
 * empreintes vides et `salete() === ""`, c'est-à-dire qu'elle DÉCLARAIT PROPRE un arbre dont elle
 * n'avait rien pu lire. Ici, toute erreur git lève `ErreurProvenance` : à l'écriture le build
 * s'arrête, à la lecture l'écart est nommé. Et tous les appels portent `-C <racine>`, si bien que
 * le répertoire courant de l'appelant ne peut pas désigner un AUTRE dépôt.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** La racine du dépôt, déduite de l'emplacement de CE fichier — jamais de `process.cwd()`. */
export const RACINE = resolve(fileURLToPath(import.meta.url), "..", "..", "..", "..", "..");

/**
 * Tout ce dont le site produit dépend. Des PAQUETS ENTIERS : sources, données, traductions,
 * outillage de build, configurations, manifestes. Plus la racine de l'espace de travail, dont
 * `package-lock.json` — une dépendance qui change change les pages — et `.nvmrc`.
 */
export const ENTREES = [
  "packages/ui",
  "packages/knowledge",
  "packages/engine",
  "package.json",
  "package-lock.json",
  ".nvmrc",
];

/**
 * LES SEULES EXCLUSIONS, ET ELLES SONT BORNÉES.
 *
 * · ce fichier-ci, seul producteur de la carte : il l'écrit et la relit sans participer au build.
 *   Son SCHÉMA est versionné et EXIGÉ, donc un changement de format ne peut pas passer pour une
 *   carte valide ; et la liste ci-dessous est INSCRITE SUR LA CARTE puis comparée à la relecture,
 *   donc élargir le trou invalide d'un coup toutes les cartes déjà émises.
 * · tout chemin sous un répertoire `dist` — exclusion de ceinture : `git ls-files` ne rend que
 *   l'index, et aucun `dist` n'y est suivi aujourd'hui. Si l'un venait à l'être, il ne devrait pas
 *   pour autant entrer dans l'empreinte des ENTRÉES : un produit n'est pas une entrée.
 *
 * Chaque chemin listé ici doit être SUIVI PAR GIT, faute de quoi l'écriture s'arrête : une
 * exclusion mal orthographiée n'exclurait rien et laisserait croire qu'elle protège quelque chose.
 */
export const EXCLUSIONS = ["packages/knowledge/scripts/lib/provenance.mjs"];
const sousDist = (chemin) => /(^|\/)dist(\/|$)/.test(chemin);

/**
 * LES VARIABLES D'ENVIRONNEMENT QUI CHANGENT LE SITE PRODUIT — toutes, pas seulement celles que
 * les constructeurs fixent eux-mêmes. Relevé mécaniquement dans les sources par
 * `variablesLuesParLesSources()`, dont `test-provenance.mjs` exige l'égalité avec cette liste :
 * une variable nouvelle lue par une page ne peut donc pas rester hors du contrat.
 *
 * `OUTDIR` est la plus dangereuse des sept et c'est pourquoi elle est REFUSÉE plus bas : Astro
 * construirait ailleurs pendant que le script scelle et mesure un `packages/ui/dist` ancien.
 */
export const PARAMETRES = [
  "OUTDIR",
  "BUILD_ONLY",
  "BUILD_SLUGS",
  "BUILD_SHARDS",
  "BUILD_SHARD",
  "PUBLIC_API_BASE",
  "PUBLIC_SITE_ENV",
];

/** Refusée net : un build dont la sortie part ailleurs que là où l'on scelle n'est pas mesurable. */
export const REFUSEES = ["OUTDIR"];

/**
 * Retirées explicitement de l'environnement hérité par les deux constructeurs. Les filtres et le
 * découpage en tranches produisent un site AMPUTÉ ; hérités sans qu'on le sache — d'un shell, d'un
 * `env` de CI, d'un essai précédent — ils rendaient un « site complet » qui ne l'était pas.
 * Les constructeurs qui veulent un filtre le posent ENSUITE, en surcharge nommée.
 */
export const NEUTRALISEES = ["BUILD_ONLY", "BUILD_SLUGS", "BUILD_SHARDS", "BUILD_SHARD"];

/** Les chemins scrutés à la recherche de lectures d'environnement. */
export const SOURCES_A_SCRUTER = [
  "packages/ui/src",
  "packages/ui/scripts",
  "packages/ui/astro.config.mjs",
  "packages/knowledge/src",
  "packages/knowledge/scripts",
  "packages/engine/src",
];

/**
 * CE QUI, DANS LES TROIS PAQUETS, NE PEUT PAS LIRE L'ENVIRONNEMENT EN CONSTRUISANT UNE PAGE — et
 * POURQUOI, chemin par chemin.
 *
 * `SOURCES_A_SCRUTER` est une liste écrite à la main : c'est exactement le défaut que la v5 a payé
 * sur `ENTREES`, vraie le jour où on l'écrit et fausse au répertoire suivant. Le RÉSIDU la referme
 * — `test-provenance.mjs` exige que TOUT chemin suivi des trois paquets soit ou bien scruté, ou
 * bien inscrit ici avec son motif. Un `packages/ui/lib` nouveau fait donc rougir tant que personne
 * ne l'a classé, et le classement est une phrase qu'il faut écrire, pas un oubli qui passe.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * UN RÉPERTOIRE NE CLASSE JAMAIS DU CODE. Le résidu, tel qu'il a été écrit le 22/08/2026, avait un
 * FAUX VERT que Codex a reproduit le lendemain : `packages/knowledge/scripts` était classé EN BLOC,
 * alors qu'il contient `build-ci.mjs` et `build-preview.mjs`. Ajouter dans `build-ci.mjs` une
 * lecture d'une variable nommée `PROVENANCE_UNTRACKED_ENV` choisissant entre deux scripts de build —
 * qui change réellement le site — laissait le harnais à 74/74 : le code nouveau restait couvert par
 * la classification du répertoire, il n'apparaissait jamais en résidu.
 *
 * Le défaut n'est pas ce répertoire-là. C'est qu'un classement PAR RÉPERTOIRE est une promesse sur
 * du code qui n'est pas encore écrit. La règle est donc structurelle, et le harnais l'exige :
 *
 *     tout fichier EXÉCUTABLE (.mjs .cjs .js .ts .tsx .astro) des trois paquets est soit scruté,
 *     soit classé PAR SON CHEMIN EXACT — jamais par le répertoire qui le contient.
 *
 * Les répertoires ne classent donc plus que ce qui ne s'exécute pas : données, traductions, actifs.
 * Un exécutable nouveau devient du résidu, où qu'il naisse — c'est ce qui rend le cas de Codex
 * impossible plutôt que corrigé.
 *
 * CONSÉQUENCE SUR LA PROSE, ET ELLE EST ASSUMÉE. Ce fichier est désormais SCRUTÉ comme les autres,
 * et le relevé des lectures ne fait pas la différence entre du code et un commentaire : il
 * SUR-détecte, délibérément, parce qu'un relevé qui sous-détecte laisse passer exactement ce qu'il
 * existe pour voir. On n'écrit donc pas ici la forme littérale d'une lecture (`process` `.env.X`,
 * `env.X`) pour une variable qu'on ne déclare pas — on la nomme sans cette forme. Le jour où
 * quelqu'un l'oublie, le harnais rougit et demande de choisir : reformuler, ou déclarer.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 */
export const HORS_SCRUTATION = {
  "packages/ui/README.md": "documentation, aucun code exécuté au build",
  "packages/ui/package.json": "manifeste : il FIXE des variables (`build:prod`), il n'en lit aucune",
  "packages/ui/public": "actifs statiques copiés tels quels ; les trois scripts qu'il contient "
    + "sont classés nommément plus bas, comme l'exige la règle des exécutables",
  "packages/ui/tsconfig.json": "configuration TypeScript déclarative",
  "packages/knowledge/README.md": "documentation, aucun code exécuté au build",
  "packages/knowledge/package.json": "manifeste npm : dépendances et scripts, aucune lecture d'environnement",
  "packages/knowledge/tsconfig.json": "configuration TypeScript déclarative",
  "packages/knowledge/quality": "contrôles de la base de connaissances, hors construction de pages",
  "packages/knowledge/raw": "données brutes : elles sont LUES par le code, elles ne lisent rien",
  "packages/knowledge/translations": "données de traduction : lues, ne lisent rien",
  /* Ajouté le 01/09/2026, après que le RÉSIDU a nommé ces trois fichiers. Le micro-lot Tarifs les
     a créés dans un paquet scellé sans les classer : ils PÈSENT donc sur l'empreinte — `ENTREES`
     couvre tout `packages/knowledge` —, mais ils échappaient au relevé des lectures
     d'environnement, ni scrutés ni déclarés. C'est exactement le trou que le résidu existe pour
     refermer, et il l'a refermé. Le répertoire ne contient que des JSON : aucun exécutable, donc
     aucun classement par répertoire qui masquerait du code. */
  "packages/knowledge/tarifs": "registres de caisses : données JSON non exécutables, lues par le "
    + "contrat des caisses, elles ne lisent aucune variable d'environnement",
  "packages/engine/README.md": "documentation, aucun code exécuté au build",
  "packages/engine/package.json": "manifeste npm : dépendances et scripts, aucune lecture d'environnement",
  "packages/engine/tsconfig.json": "configuration TypeScript déclarative",
  "packages/engine/scripts": "démonstration, jamais exécutée par un build",
  /* LES EXÉCUTABLES SE CLASSENT UN PAR UN, JAMAIS PAR RÉPERTOIRE — voir la règle ci-dessous. */
  "packages/engine/scripts/demo.ts": "démonstration lancée à la main (`npm run demo`)",
  "packages/engine/scripts/dest-test.ts": "essai de destinations lancé à la main",
  "packages/engine/scripts/repro-finder2.ts": "reproduction d'anomalie lancée à la main",
  "packages/knowledge/quality/check.ts": "contrôle de la base de connaissances (`npm run check`) : "
    + "il LIT les données et n'entre dans aucune page",
  "packages/ui/public/_worker.js": "Worker Cloudflare : son `env` est un jeu de LIAISONS "
    + "d'exécution — la liaison `ASSETS` de Cloudflare —, pas l'environnement du build : il ne "
    + "change aucune page produite",
  "packages/ui/public/presskit/doc-page.js": "script de page servi tel quel, exécuté dans le "
    + "navigateur du visiteur : il n'a pas d'environnement de build à lire",
  "packages/ui/public/presskit/support.js": "script de page servi tel quel, exécuté dans le "
    + "navigateur du visiteur : il n'a pas d'environnement de build à lire",
};

/** Les paquets sur lesquels le résidu ci-dessus est exigé. */
export const PAQUETS = ["packages/ui", "packages/knowledge", "packages/engine"];

/** Le format de la carte. Une carte d'un autre schéma est REFUSÉE, jamais interprétée. */
export const SCHEMA = 3;

const NOM = ".provenance.json";
const sha256 = (x) => createHash("sha256").update(x).digest("hex");

/** Toute défaillance de provenance : git muet, entrée vide, exclusion fantôme, carte illisible. */
export class ErreurProvenance extends Error {
  constructor(message) {
    super(message);
    this.name = "ErreurProvenance";
  }
}

/**
 * git, ÉCHOUANT FERMÉ et toujours sur la racine du dépôt.
 * Un `catch { return "" }` ici, et « je n'ai rien pu lire » devient « il n'y a rien » : c'est
 * exactement la panne que Codex a reproduite le 22/08/2026 hors dépôt.
 */
function git(...args) {
  const r = spawnSync("git", ["-C", RACINE, ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.error) {
    throw new ErreurProvenance(
      `git ${args[0]} n'a pas pu être lancé dans ${RACINE} : ${r.error.message}. `
      + "Aucune provenance ne peut être établie sans git."
    );
  }
  if (r.status !== 0) {
    throw new ErreurProvenance(
      `git ${args.join(" ")} a échoué (code ${r.status}) dans ${RACINE} : `
      + `${(r.stderr || "").trim() || "aucun message"}. Aucune provenance ne peut être établie.`
    );
  }
  return r.stdout.trim();
}

/** `RACINE` est-elle bien la racine d'un dépôt git — et du BON ? */
function exigerDepot() {
  const sommet = git("rev-parse", "--show-toplevel");
  const reel = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };
  if (reel(sommet) !== reel(RACINE)) {
    throw new ErreurProvenance(
      `${RACINE} n'est pas la racine du dépôt git qui la contient (${sommet}). `
      + "La provenance serait calculée sur un autre arbre que celui qui a construit le site."
    );
  }
}

/** Le nombre de pages HTML d'un site construit — `_astro` exclu, comme partout ailleurs. */
export function compterPages(dist) {
  if (!existsSync(dist)) return 0;
  let n = 0;
  for (const e of readdirSync(dist, { withFileTypes: true })) {
    if (e.isDirectory()) { if (e.name !== "_astro") n += compterPages(join(dist, e.name)); }
    else if (e.name.endsWith(".html")) n++;
  }
  return n;
}

/**
 * L'empreinte des ENTRÉES, préfixe par préfixe.
 *
 * Lue dans l'INDEX git (`ls-files -s`), ce qui est exact parce que la propreté du même périmètre
 * est exigée juste à côté : index et copie de travail y sont alors identiques. Un condensé PAR
 * PRÉFIXE plutôt qu'un seul total, pour que le diagnostic nomme ce qui a changé ; et le NOMBRE de
 * fichiers à côté du condensé, pour que « le paquet a fondu » se lise sans le recalculer.
 */
export function empreinte(env = process.env) {
  exigerDepot();
  const lignes = git("ls-files", "-s", "--", ...ENTREES).split("\n").filter(Boolean);
  const suivis = new Set();
  const parPrefixe = Object.fromEntries(ENTREES.map((e) => [e, []]));

  for (const ligne of lignes) {
    const [meta, chemin] = ligne.split("\t");
    if (!chemin) {
      throw new ErreurProvenance(`ligne de « git ls-files -s » illisible : ${JSON.stringify(ligne)}`);
    }
    suivis.add(chemin);
    if (EXCLUSIONS.includes(chemin) || sousDist(chemin)) continue;
    const e = ENTREES.find((x) => chemin === x || chemin.startsWith(x + "/"));
    if (!e) {
      /* git a rendu un chemin qu'aucune entrée ne réclame : le filtre et le rattachement ne
         disent pas la même chose. Plutôt que d'ignorer le fichier — donc de le sortir de
         l'empreinte en silence —, on s'arrête. */
      throw new ErreurProvenance(`${chemin} rendu par git mais rattaché à aucune entrée déclarée`);
    }
    parPrefixe[e].push(`${meta.split(" ")[1]} ${chemin}`);
  }

  /* Une exclusion qui ne désigne aucun fichier suivi est une exclusion FANTÔME : elle laisse
     croire qu'un trou est fermé alors qu'il est ailleurs, ou déjà refermé et oublié. */
  for (const x of EXCLUSIONS) {
    if (!suivis.has(x)) {
      throw new ErreurProvenance(
        `exclusion « ${x} » : aucun fichier suivi ne porte ce chemin. Une exclusion qui ne `
        + "désigne rien n'exclut rien — corriger le chemin ou retirer l'exclusion."
      );
    }
  }

  const entrees = {};
  for (const [e, l] of Object.entries(parPrefixe)) {
    /* « JAMAIS VERT FAUTE DE MATIÈRE », appliqué à l'empreinte. Une entrée vide rendrait le
       condensé du vide — `e3b0c442…` — qui se compare parfaitement à lui-même d'un build à
       l'autre et ne prouve donc RIEN. */
    if (l.length === 0) {
      throw new ErreurProvenance(
        `entrée « ${e} » déclarée mais aucun fichier suivi ne s'y rattache. Une entrée vide `
        + "produirait le condensé du vide, qui vaut accord avec n'importe quoi."
      );
    }
    entrees[e] = { fichiers: l.length, sha: sha256(l.sort().join("\n")).slice(0, 16) };
  }

  return {
    entrees,
    exclusions: [...EXCLUSIONS].sort(),
    parametres: parametresDe(env),
    node: process.version,
  };
}

/**
 * Les paramètres INSCRITS sur la carte : les sept variables déclarées, plus TOUTE variable
 * `PUBLIC_*` présente dans l'environnement du build. Ce second volet n'est pas du zèle : Vite
 * expose au bundle l'intégralité des `PUBLIC_*`, donc une variable qu'on n'aurait pas prévue
 * change le site produit sans figurer nulle part.
 */
export function parametresDe(env = process.env) {
  const p = {};
  for (const k of PARAMETRES) p[k] = env[k] ?? null;
  for (const k of Object.keys(env).filter((k) => k.startsWith("PUBLIC_")).sort()) p[k] = env[k];
  return p;
}

/**
 * L'ENVIRONNEMENT DE BUILD, construit ici et nulle part ailleurs, pour que les deux constructeurs
 * ne puissent pas diverger. Il REFUSE `OUTDIR` et RETIRE les filtres hérités ; les surcharges
 * nommées — le filtre du build réduit, l'adresse sentinelle — s'appliquent ensuite, en clair.
 *
 * Retirer plutôt que fixer à vide : une chaîne vide est falsy pour `shardPaths`, mais `OUTDIR=""`
 * donnerait `"" || "dist"` — le hasard, pas une garantie. Ici la variable n'existe simplement plus.
 */
export function environnementDeBuild(base = process.env, surcharges = {}) {
  for (const k of REFUSEES) {
    const v = surcharges[k] ?? base[k];
    if (v != null && v !== "") {
      throw new ErreurProvenance(
        `${k} est fixé (« ${v} ») : le build écrirait ailleurs que là où la carte est scellée et `
        + "où les harnais lisent. Retirer la variable, ou construire hors de ces scripts en "
        + "assumant qu'aucune provenance ne sera établie."
      );
    }
  }
  const env = { ...base };
  for (const k of NEUTRALISEES) delete env[k];
  for (const [k, v] of Object.entries(surcharges)) {
    if (v === undefined || v === null) delete env[k];
    else env[k] = String(v);
  }
  return env;
}

/**
 * Les variables d'environnement réellement LUES par les sources du site. Sert au harnais, qui en
 * exige l'égalité avec `PARAMETRES` : c'est ce qui empêche qu'une variable nouvelle influe sur les
 * pages sans être inscrite au contrat.
 */
export function variablesLuesParLesSources() {
  exigerDepot();
  const fichiers = git("ls-files", "--", ...SOURCES_A_SCRUTER).split("\n").filter(Boolean);
  if (fichiers.length === 0) {
    throw new ErreurProvenance("aucun fichier source à scruter : le relevé serait vide par défaut");
  }
  const vues = new Set();
  for (const f of fichiers) {
    const texte = readFileSync(join(RACINE, f), "utf8");
    for (const m of texte.matchAll(/(?:process|import\.meta)\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
      vues.add(m[1]);
    }
    /* `shardPaths` lit `env.BUILD_ONLY` sur un objet local capturé depuis `globalThis.process.env` :
       la forme qualifiée ne suffit donc pas. On accepte volontairement large — un faux positif
       ferait rougir le harnais jusqu'à ce que la variable soit déclarée, ce qui est le bon sens
       de l'erreur. */
    for (const m of texte.matchAll(/(?:^|[^A-Za-z0-9_.])env\.([A-Z][A-Z0-9_]{2,})/g)) vues.add(m[1]);
  }
  return [...vues].sort();
}

/**
 * L'empreinte du SITE PRODUIT, `.provenance.json` exclu — une carte ne peut pas se contenir.
 * C'est la preuve de complétude la plus forte : elle ne dépend d'aucun seuil et voit la
 * disparition d'un seul octet dans n'importe quel fichier, pas seulement d'une page entière.
 */
export function empreinteDist(dist) {
  const h = createHash("sha256");
  let n = 0;
  (function marcher(d, base = "") {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = base ? `${base}/${e.name}` : e.name;
      if (e.isDirectory()) marcher(join(d, e.name), rel);
      else if (rel !== NOM) {
        h.update(rel).update(" ").update(createHash("sha256").update(readFileSync(join(d, e.name))).digest());
        n++;
      }
    }
  })(dist);
  return { empreinte: h.digest("hex"), fichiers: n };
}

/** L'arbre est-il sale SUR LE PÉRIMÈTRE DES ENTRÉES ? Renvoie le relevé, ou "". Lève si git échoue. */
export function salete() {
  exigerDepot();
  return git("status", "--porcelain", "--untracked-files=all", "--", ...ENTREES);
}

/** Déposer la carte d'identité dans le site construit. À faire EN DERNIER : elle scelle le reste. */
export function ecrireProvenance(dist, portee, env = process.env) {
  const { entrees, exclusions, parametres, node } = empreinte(env);
  const dist_ = empreinteDist(dist);
  writeFileSync(join(dist, NOM), JSON.stringify({
    schema: SCHEMA,
    sha: git("rev-parse", "HEAD"),
    entrees_propres: salete() === "",
    entrees, exclusions, parametres, node, portee,
    pages: compterPages(dist),
    dist: dist_,
  }, null, 2) + "\n");
}

/**
 * Relire la carte et la confronter à l'état courant. Renvoie la liste des écarts — vide si le
 * site correspond à ses entrées. `porteeAttendue` vaut « complet » pour les dossiers de mesure.
 *
 * Aucune exception ne sort d'ici : une défaillance de git devient un ÉCART NOMMÉ, jamais un
 * silence et jamais une trace d'exécution brute.
 */
export function verifierProvenance(dist, porteeAttendue = "complet") {
  const chemin = join(dist, NOM);
  if (!existsSync(chemin)) {
    return [`${chemin} absent : impossible de savoir de quelle version ce site a été construit. `
      + "« npm run build:ci -- --complet » le déposera."];
  }
  let prov;
  try { prov = JSON.parse(readFileSync(chemin, "utf8")); }
  catch (e) { return [`${chemin} illisible : ${e.message}`]; }

  /* LE SCHÉMA D'ABORD : une carte d'un autre format ne se DISCUTE pas, elle se refuse. Sans cela,
     un champ disparu se lirait « undefined » et passerait pour une égalité. */
  if (prov.schema !== SCHEMA) {
    return [`carte au schéma ${prov.schema ?? "absent"}, ce validateur attend le schéma ${SCHEMA}. `
      + "Reconstruire le site plutôt que d'interpréter un format qui n'est pas celui-ci."];
  }

  const ecarts = [];
  if (!prov.entrees_propres) {
    ecarts.push("construit depuis des entrées MODIFIÉES : ses pages ne correspondent à aucun commit");
  }
  if (prov.portee !== porteeAttendue) ecarts.push(`portée « ${prov.portee} » et non « ${porteeAttendue} »`);

  /* ---- CE QUI DÉPEND DE GIT, ET QUI PEUT DONC ÉCHOUER ---------------------------------------- */
  try {
    const { entrees, exclusions, node } = empreinte();

    /* Les exclusions AVANT les condensés : élargir le trou change ce que l'empreinte couvre, donc
       une égalité de condensés sous deux périmètres différents ne voudrait rien dire. */
    const inscrites = JSON.stringify(prov.exclusions ?? null);
    const courantes = JSON.stringify(exclusions);
    if (inscrites !== courantes) {
      ecarts.push(`le périmètre a changé : ce site a été scellé en excluant ${inscrites}, `
        + `ce validateur exclut ${courantes}. Les condensés ne portent pas sur le même ensemble.`);
    }

    for (const [k, v] of Object.entries(entrees)) {
      const a = prov.entrees?.[k];
      if (a?.sha !== v.sha) {
        ecarts.push(`${k} : site construit sur ${String(a?.sha ?? "absent").slice(0, 12)} `
          + `(${a?.fichiers ?? "?"} fichiers), les entrées sont à ${v.sha.slice(0, 12)} `
          + `(${v.fichiers} fichiers)`);
      }
    }
    for (const k of Object.keys(prov.entrees ?? {})) {
      if (!(k in entrees)) ecarts.push(`${k} : inscrit sur la carte mais absent des entrées déclarées`);
    }
    if (prov.node !== node) {
      ecarts.push(`construit sous Node ${prov.node}, ce processus tourne sous ${node} — `
        + "un autre Node peut produire d'autres pages");
    }
    const sale = salete();
    if (sale) {
      ecarts.push(`les entrées du site ont changé depuis le build :\n      ${sale.replace(/\n/g, "\n      ")}`);
    }
  } catch (e) {
    if (!(e instanceof ErreurProvenance)) throw e;
    ecarts.push(`provenance impossible à établir : ${e.message}`);
  }

  /* ---- LES PARAMÈTRES, JUGÉS SUR CE QU'ILS DÉTERMINENT ---------------------------------------
   * Les confronter à `process.env` du mesureur — qui n'en porte aucun — rejetait un site
   * parfaitement valide. On juge donc ce qu'ils IMPLIQUENT sur le site scellé. */
  for (const k of PARAMETRES) {
    if (!(k in (prov.parametres ?? {}))) {
      ecarts.push(`paramètre ${k} déclaré au contrat mais absent de la carte`);
    }
  }
  /* `OUTDIR` quelle que soit la portée : s'il était fixé, rien ne dit que le dossier scellé est
     celui qu'Astro a écrit. Les constructeurs le refusent en amont ; ce contrôle est le filet. */
  if (prov.parametres?.OUTDIR) {
    ecarts.push(`paramètre OUTDIR = « ${prov.parametres.OUTDIR} » : le site a été construit ailleurs `
      + "que dans le dossier scellé, la carte ne prouve rien sur ce qu'on lit ici");
  }
  if (porteeAttendue === "complet") {
    for (const k of ["BUILD_ONLY", "BUILD_SLUGS"]) {
      const v = prov.parametres?.[k];
      if (v) {
        ecarts.push(`paramètre ${k} = « ${v} » : ce site a été construit sous un filtre d'entités, `
          + "il ne peut pas être complet quel que soit son nombre de pages");
      }
    }
    /* Le découpage en tranches ampute tout autant, mais sans nommer ce qu'il retire : une tranche
       sur quatre garde une page sur quatre DANS CHAQUE FAMILLE. Le décompte de pages seul ne le
       verrait pas si le seuil est bas. */
    const tranches = Number(prov.parametres?.BUILD_SHARDS ?? "1");
    if (Number.isFinite(tranches) && tranches > 1) {
      ecarts.push(`paramètre BUILD_SHARDS = « ${prov.parametres.BUILD_SHARDS} » : ce site est une `
        + `TRANCHE (nº ${prov.parametres?.BUILD_SHARD ?? "0"}), pas un site complet`);
    }
  }

  /* ---- LA COMPLÉTUDE, PROUVÉE PUIS EXPLIQUÉE --------------------------------------------------
   * L'empreinte du `dist` voit la disparition d'un octet ; le décompte de pages et l'inclusion
   * des sitemaps disent, eux, CE QUI manque quand elle diffère. Les trois sont gardées :
   * la première prouve, les deux autres expliquent. */
  const d = empreinteDist(dist);
  if (prov.dist?.empreinte !== d.empreinte) {
    ecarts.push(`le site a changé depuis le build : ${prov.dist?.fichiers ?? "?"} fichiers scellés, `
      + `${d.fichiers} présents, empreintes ${String(prov.dist?.empreinte ?? "absente").slice(0, 12)} `
      + `contre ${d.empreinte.slice(0, 12)}`);
  }
  const pages = compterPages(dist);
  if (prov.pages !== pages) {
    ecarts.push(`la carte annonce ${prov.pages} pages, le site en contient ${pages}`);
  }

  /* INCLUSION, ET LE MOT EST EXACT — ce n'est PAS une bijection, comme le disait ce commentaire
   * jusqu'au 22/08/2026 (relevé par Codex). On exige que chaque URL annoncée par un sitemap ait
   * une page construite ; on n'exige PAS l'inverse, et on aurait tort de le faire : les 404, le
   * lab et les pages `noindex` existent légitimement hors sitemap. Ce qui est ajouté ici, c'est
   * l'UNICITÉ des URL — sans elle, un même `<loc>` répété gonflerait le décompte et pourrait
   * porter le total au-dessus du plancher alors que des pages manquent. */
  const vues = new Set();
  const doublons = new Set();
  const absentes = [];
  for (const l of ["en", "fr", "es", "pt"]) {
    const f = join(dist, `sitemap-${l}.xml`);
    if (!existsSync(f)) { ecarts.push(`sitemap-${l}.xml absent`); continue; }
    for (const m of readFileSync(f, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)) {
      if (vues.has(m[1])) doublons.add(m[1]); else vues.add(m[1]);
      const p = m[1].replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "");
      if (!existsSync(join(dist, p, "index.html")) && !existsSync(join(dist, p))) absentes.push(p || "/");
    }
  }
  if (doublons.size) {
    ecarts.push(`${doublons.size} URL annoncées PLUSIEURS fois par les sitemaps — le décompte est `
      + "gonflé et ne mesure plus la couverture : " + [...doublons].slice(0, 3).join(", "));
  }
  if (vues.size < 2000) ecarts.push(`${vues.size} URL DISTINCTES aux sitemaps, attendu au moins 2000`);
  if (absentes.length) {
    ecarts.push(`${absentes.length} URL des sitemaps sans page construite — le site est amputé : `
      + absentes.slice(0, 3).join(", ") + (absentes.length > 3 ? ", et d'autres" : ""));
  }
  return ecarts;
}

/** Confronter, et s'arrêter si le site ne correspond pas. Utilisé par les dossiers de mesure. */
export function exigerProvenance(dist, etiquette, porteeAttendue = "complet") {
  const ecarts = verifierProvenance(dist, porteeAttendue);
  if (!ecarts.length) return;
  process.stderr.write(`[${etiquette}] ÉCHEC — le site construit ne correspond pas à ses entrées :\n`
    + ecarts.map((e) => `  · ${e}`).join("\n") + "\n");
  process.exit(1);
}
