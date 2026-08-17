/**
 * T0-B3-a · la COMMANDE UNIQUE de reproduction.
 *
 *   npm run mesure:t0b3a
 *
 * Elle fait les quatre choses qu'exige la contre-revue, dans cet ordre, et échoue franchement à la
 * première qui ne tient pas :
 *
 *   0. l'arbre Git est-il propre AVANT de commencer, et la détection de saleté fonctionne-t-elle ?
 *   1. les fichiers bruts correspondent-ils à la base de mesure figée `e2cf302` ?
 *   2. régénérer l'artefact d'arbitrage ;
 *   3. vérifier `SHA256SUMS` — les artefacts doivent être identiques au bit près ;
 *   4. exiger un arbre Git PROPRE à la fin : régénérer ne doit rien changer.
 *
 * Le point 4 est celui qui manquait au départ. La première version scellait `git rev-parse HEAD` :
 * les artefacts devenaient irreproductibles dès leur propre commit, puisque régénérer changeait le
 * sceau, donc le fichier, donc son empreinte. Un dossier de mesure qui ne se reproduit pas depuis
 * son propre commit ne prouve rien — il documente une exécution, il n'établit pas un fait.
 *
 * ─── POURQUOI L'ARBRE EST CONTRÔLÉ EN ENTIER, ET POURQUOI LA DÉTECTION EST ELLE-MÊME TESTÉE ────
 *
 * Deuxième contre-revue du 16/08/2026 : un fichier non suivi déposé à la RACINE passait au vert.
 * Le contrôle ne regardait que `mesures/t0b3-…` et `packages/` — il annonçait « arbre propre »
 * pendant que `git status` montrait le contraire. Un contrôle qui ne peut pas échouer ne prouve
 * rien, et celui-là mentait par cadrage.
 *
 * Deux corrections, indissociables : le contrôle porte désormais sur TOUT l'arbre, et il est
 * lui-même mis à l'épreuve à chaque exécution — on dépose un fichier parasite à la racine, on
 * exige que la détection le voie, puis on l'efface. Sans cette contre-épreuve, un futur cadrage
 * trop étroit repasserait au vert sans que personne ne s'en aperçoive.
 *
 *   --ecrire   recalcule SHA256SUMS au lieu de le vérifier (à n'utiliser que si l'on a
 *              DÉLIBÉRÉMENT changé la mesure, et alors la contre-revue doit revoir le diff).
 *              Ce mode SEUL tolère un arbre sale au départ : les outils viennent d'être modifiés.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { preparerWorktree } from "../../../test-lib/worktree-historique.mjs";
import { createHash } from "node:crypto";
import { MESURE_BASE_SHA, MESURE_MOTEUR_SHA, etatDuMoteur } from "./lib-arbitrage.mjs";

const DOSSIER = "mesures/t0b3a-arbitrage-brachy";
const ECRIRE = process.argv.includes("--ecrire");
const OUTILS = ["arbitrer", "simuler-h"];
const ARTEFACTS = ["README.md", "OPTION-H.md", "arbitrage-p0-brachy.json", "option-h-simulee.json"];
/* ---- LES CONTRE-ÉPREUVES, ET CE QU'ELLES DOIVENT DIRE -------------------------------------------
 *
 * Se contenter de `status !== 0` acceptait n'importe quel échec pour une réussite : un processus
 * tué, une erreur d'import, une exception levée AVANT l'assertion visée — tout cela « prouvait »
 * que le simulateur savait échouer. On exige donc le code 1 exact, l'absence de signal, ET un
 * fragment de diagnostic PROPRE à l'invariant cassé : sans lui, l'échec ne dit pas qu'on a bien
 * atteint puis mis en défaut l'assertion qu'on visait.
 *
 * `mode` distingue les deux façons dont une contre-épreuve peut légitimement échouer :
 *   `exigence`  — le simulateur va au bout et refuse ses propres exigences ;
 *   `exception` — le chargement du référentiel est refusé, et rien ne doit aller plus loin. */
const CONTRE_EPREUVES = [
  { code: "causes", mode: "exigence", fragment: "G5 · aucune cause préexistante perdue" },
  { code: "table", mode: "exigence", fragment: "les fixtures de la table H sont toutes conformes" },
  { code: "ids42", mode: "exigence", fragment: "les 42 identités sont exactement 42" },
  { code: "bascules", mode: "exigence", fragment: "bascules vont EXCLUSIVEMENT vers confirmation_required" },
  { code: "validateur", mode: "exception", fragment: "ensemble refusé par validateBreedRestrictions" },
  { code: "multi", mode: "exigence", fragment: "deux exigences auditées produisent DEUX causes distinctes" },
];

/** Une contre-épreuve n'a réussi que si elle échoue POUR LA BONNE RAISON. */
function exigerContreEpreuve(ce, r, ou) {
  const sortie = `${r.stdout || ""}${r.stderr || ""}`;
  if (r.signal) echouer(`contre-épreuve « ${ce.code} » ${ou} : processus tué par ${r.signal} — un `
    + `processus abattu n'est pas une assertion mise en défaut`);
  if (r.status !== 1) echouer(`contre-épreuve « ${ce.code} » ${ou} : code ${r.status}, attendu 1`);
  if (!sortie.includes(ce.fragment)) {
    echouer(`contre-épreuve « ${ce.code} » ${ou} : sortie en 1, mais SANS le diagnostic attendu `
      + `« ${ce.fragment} » — elle a échoué pour une autre raison que l'invariant visé.\n`
      + `${sortie.slice(-800)}`);
  }
  /* Le mode dit COMMENT elle doit échouer : aller au bout et refuser ses exigences, ou refuser le
     référentiel au chargement. Confondre les deux laisserait passer une exception précoce. */
  const auBout = /ÉCHEC — \d+ exigence\(s\) non tenue\(s\)/.test(sortie);
  if (ce.mode === "exigence" && !auBout) {
    echouer(`contre-épreuve « ${ce.code} » ${ou} : elle devait aller au bout et refuser ses `
      + `exigences ; elle s'est interrompue avant.\n${sortie.slice(-800)}`);
  }
  if (ce.mode === "exception" && auBout) {
    echouer(`contre-épreuve « ${ce.code} » ${ou} : elle devait refuser le référentiel AU `
      + `CHARGEMENT ; elle est allée jusqu'au décompte des exigences.`);
  }
}
const SOURCES = OUTILS.map((o) => `outils/${o}.mjs`).concat("outils/lib-arbitrage.mjs", "outils/reproduire.mjs");

const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const echouer = (m) => { process.stderr.write(`[mesure:t0b3a] ÉCHEC — ${m}\n`); process.exit(1); };
const dire = (m) => process.stdout.write(`[mesure:t0b3a] ${m}\n`);

/** L'état de TOUT l'arbre — suivi et non suivi, à la racine comme ailleurs. Pas de chemin en
 *  argument : c'est le cadrage qui avait rendu ce contrôle complaisant. */
const arbreSale = () =>
  execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" }).trim();

/* ---- 0. le contrôle de propreté doit d'abord prouver qu'il sait échouer ------------------------ */
{
  const parasite = `.mesure-t0b3-contre-epreuve-${process.pid}`;
  writeFileSync(parasite, "contre-épreuve : ce fichier doit rendre l'arbre sale\n");
  let vu;
  try {
    vu = arbreSale().split("\n").some((l) => l.includes(parasite));
  } finally {
    if (existsSync(parasite)) unlinkSync(parasite);
  }
  if (!vu) {
    echouer("la détection d'arbre sale ne voit pas un fichier parasite déposé à la racine — " +
      "le contrôle de propreté est inopérant, tout « arbre propre » qu'il annoncerait serait faux");
  }
  dire("0/4 contre-épreuve : un fichier parasite à la racine EST détecté");
}

/* ---- 0 bis. et l'arbre doit être propre AVANT de commencer ------------------------------------- */
{
  const sale = arbreSale();
  if (sale && !ECRIRE) {
    echouer(`l'arbre est sale AVANT de commencer — une reproduction partant d'un état modifié ne ` +
      `prouve rien :\n${sale}\n(« --ecrire » est le seul mode qui tolère un arbre sale au départ)`);
  }
  dire(sale ? "0bis/4 arbre sale au départ, toléré par --ecrire" : "0bis/4 arbre propre au départ");
}

/* ---- 1 ter. LE MOTEUR ---------------------------------------------------------------------------
   Un dossier de mesure décrit un état, MOTEUR COMPRIS. Le câblage de l'option H l'a prouvé ici même :
   à référentiel identique, les options B à G de l'arbitrage se sont confondues avec H, parce que le
   moteur APPLIQUE désormais H dès que les 42 règles sont retirées. Régénérer aurait remplacé en
   silence les chiffres d'un arbitrage déjà tranché par une tautologie. Ces artefacts deviennent donc
   historiques : on vérifie qu'ils sont intacts, et on refuse de les recalculer. */
const moteur = etatDuMoteur();
if (!moteur.conforme) {
  /* `--ecrire` reste permis, et ne peut PAS réécrire les chiffres : en mode historique la
     régénération est court-circuitée plus bas, si bien qu'il ne rescelle que les outils. Sans quoi
     corriger une virgule dans ce script rendrait le dossier impossible à remettre au vert. */
  dire(`1ter/4 MOTEUR DIFFÉRENT de celui de la mesure `
    + `(mesure : ${moteur.attendu.slice(0, 12)} · actuel : ${moteur.courant.slice(0, 12)})`);
} else {
  dire(`1ter/4 moteur identique à celui de la mesure (${moteur.courant.slice(0, 12)})`);
}

/* ---- 1. la base de mesure ---------------------------------------------------------------------- */
/* Le référentiel de l'ARBRE DE TRAVAIL ne doit correspondre à la base que si l'on régénère ICI.
   Quand le moteur a changé, la reproduction se joue dans un worktree au commit d'origine, où les
   fichiers bruts sont ceux de la base par construction — et l'arbre courant a parfaitement le
   droit d'avoir avancé depuis, c'est même ce qui a motivé le worktree. Exiger la conformité ici
   rendrait tout dossier irreproductible dès le premier lot qui touche au référentiel : T0-B3-b a
   retiré 42 règles, et les deux dossiers seraient morts le jour même. */
if (moteur.conforme) {
  for (const f of ["packages/knowledge/raw/rules.json", "packages/knowledge/raw/objects.json"]) {
    let auCommit;
    try {
      auCommit = execFileSync("git", ["show", `${MESURE_BASE_SHA}:${f}`], { maxBuffer: 256 * 1024 * 1024 });
    } catch {
      echouer(`la base de mesure ${MESURE_BASE_SHA.slice(0, 7)} est absente du dépôt local — « git fetch origin main » puis relancer`);
    }
    if (sha256(readFileSync(f)) !== sha256(auCommit)) {
      echouer(`${f} diffère de la base ${MESURE_BASE_SHA.slice(0, 7)} — le dossier ne peut pas se régénérer sur un autre état`);
    }
  }
  dire(`1/4 référentiel de l'arbre conforme à la base ${MESURE_BASE_SHA.slice(0, 7)}`);
} else {
  dire(`1/4 référentiel de l'arbre AVANCÉ depuis la base ${MESURE_BASE_SHA.slice(0, 7)} — la `
    + `reproduction se jouera au commit d'origine, où il est celui de la mesure`);
}




/* ---- L'ENVIRONNEMENT DU REJEU -------------------------------------------------------------------
 *
 * Un worktree au bon commit ne suffit pas : les dépendances et le moteur Node en font partie. La
 * v1 montait les `node_modules` COURANTS dans le worktree historique — cela fonctionnait parce que
 * les deux lockfiles se trouvaient identiques, mais la première mise à niveau de dépendance aurait
 * silencieusement transformé le rejeu en « mesure sur d'autres bibliothèques ».
 *
 * On refuse donc de rejouer si le lockfile a bougé, plutôt que de monter les modules actuels sans
 * le dire. Et la version de Node est CONSIGNÉE et confrontée au `.nvmrc` du commit historique —
 * plancher de version, comme partout dans ce dépôt, pas égalité stricte. */
function verifierEnvironnementDuRejeu() {
  const auCommit = (chemin) => {
    try {
      return execFileSync("git", ["show", `${MESURE_MOTEUR_SHA}:${chemin}`],
        { maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
    } catch { return null; }
  };
  const lockHist = auCommit("package-lock.json");
  if (!lockHist) {
    echouer(`package-lock.json introuvable au commit ${MESURE_MOTEUR_SHA.slice(0, 7)} — rejeu impossible`);
  }
  const lockCourant = readFileSync("package-lock.json");
  if (sha256(lockHist) !== sha256(lockCourant)) {
    echouer(`les dépendances ont changé depuis la mesure : le rejeu utiliserait D'AUTRES `
      + `bibliothèques que celles qui ont produit ces chiffres.\n`
      + `  package-lock.json au ${MESURE_MOTEUR_SHA.slice(0, 7)} : ${sha256(lockHist).slice(0, 12)}\n`
      + `  package-lock.json actuel                  : ${sha256(lockCourant).slice(0, 12)}\n`
      + `Rejouer depuis un « npm ci » à ce commit, ou déclarer une nouvelle base de mesure.`);
  }
  /* `.nvmrc` déclare un PLANCHER (voir scripts/lib/require-node.mjs) : même majeure, version au
     moins égale. Exiger l'égalité stricte serait plus dur que le contrat du dépôt lui-même. */
  const nvmrc = (auCommit(".nvmrc") ?? Buffer.from("")).toString("utf8").trim();
  const num = (v) => v.replace(/^v/, "").split(".").map(Number);
  const [majH, minH, patH] = num(nvmrc || "0.0.0");
  const [maj, min, pat] = num(process.version);
  const conforme = nvmrc
    ? maj === majH && (min > minH || (min === minH && pat >= patH))
    : true;
  if (!conforme) {
    echouer(`Node ${process.version} ne satisfait pas le contrat du commit historique `
      + `(.nvmrc ${nvmrc}, plancher sur la majeure ${majH}) — le rejeu tournerait sur un autre moteur.`);
  }
  return { node: process.version, nvmrc: nvmrc || "(absent)", lock: sha256(lockCourant).slice(0, 12) };
}

/* ---- REPRODUCTION DANS UN WORKTREE HISTORIQUE ---------------------------------------------------
 *
 * Quand le moteur a changé, rejouer les outils SUR PLACE donnerait d'autres chiffres : ce ne serait
 * pas une reproduction, ce serait une nouvelle mesure écrasant l'ancienne. Et se contenter de
 * comparer les empreintes des fichiers archivés ne serait qu'un contrôle d'intégrité — un fichier
 * intact ne prouve pas qu'un calcul se rejoue.
 *
 * On rejoue donc les outils DANS LEUR MONDE : un worktree Git détaché au commit qui a produit ces
 * artefacts, moteur d'alors compris, puis comparaison octet à octet avec ce qui est archivé ici.
 * `node_modules` y est lié — les dépendances sont verrouillées par le lockfile, pas par le commit.
 *
 * Seuls les JSON sont comparés : les `.md` sont écrits à la main et ont légitimement évolué depuis.
 */
function reproduireAuMoteurHistorique() {
  const env = verifierEnvironnementDuRejeu();
  dire(`1quater/4 environnement du rejeu : Node ${env.node} (.nvmrc historique ${env.nvmrc}), `
    + `lockfile ${env.lock} identique à celui de la mesure`);
  const base = `${tmpdir()}/mdcf-mesure-t0b3a-${process.pid}`;
  const racine = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  execFileSync("git", ["worktree", "add", "--detach", "--quiet", base, MESURE_MOTEUR_SHA]);
  try {
    /* Le worktree reçoit SON PROPRE `node_modules` : lier celui de la racine ferait résoudre
       `@mydogcanfly/…` vers les paquets d'AUJOURD'HUI, et le rejeu ne rejouerait plus rien. */
    preparerWorktree(base, racine);
    /* Les CONTRE-ÉPREUVES aussi se rejouent dans le worktree : un simulateur historique dont on ne
       vérifierait plus qu'il sait échouer ne prouverait rien de plus qu'un fichier intact. */
    for (const ce of CONTRE_EPREUVES) {
      const r = spawnSync(process.execPath, ["--import", "tsx",
        `${DOSSIER}/outils/simuler-h.mjs`, `--contre-epreuve=${ce.code}`], { encoding: "utf8", cwd: base });
      exigerContreEpreuve(ce, r, `au commit ${MESURE_MOTEUR_SHA.slice(0, 7)}`);
    }
    for (const o of OUTILS) {
      const r = spawnSync(process.execPath, ["--import", "tsx", `${DOSSIER}/outils/${o}.mjs`, ...[]],
        { encoding: "utf8", cwd: base });
      if (r.status !== 0) {
        echouer(`reproduction historique : l'outil « ${o} » sort en ${r.status} au commit `
          + `${MESURE_MOTEUR_SHA.slice(0, 7)}\n${(r.stderr || "").slice(-1500)}`);
      }
    }
    const ecarts = ARTEFACTS.filter((f) => f.endsWith(".json")).flatMap((f) => {
      const rejoue = `${base}/${DOSSIER}/${f}`;
      if (!existsSync(rejoue)) return [`${f} : non produit par la reproduction`];
      const a = sha256(readFileSync(rejoue)), b = sha256(readFileSync(`${DOSSIER}/${f}`));
      return a === b ? [] : [`${f} : rejoué ${a.slice(0, 12)} ≠ archivé ${b.slice(0, 12)}`];
    });
    if (ecarts.length) {
      echouer(`la reproduction au moteur historique ${MESURE_MOTEUR_SHA.slice(0, 7)} ne redonne pas `
        + `les artefacts archivés :\n  ${ecarts.join("\n  ")}`);
    }
    return ARTEFACTS.filter((f) => f.endsWith(".json")).length;
  } finally {
    try { execFileSync("git", ["worktree", "remove", "--force", base]); } catch { /* nettoyage au mieux */ }
  }
}

/* ---- 2. régénérer -------------------------------------------------------------------------------- */
/* `process.execPath` et non `npx` : `npx` résout dans l'environnement et peut TÉLÉCHARGER un paquet
   absent du lockfile — c'est-à-dire exécuter un autre code que celui qu'on a verrouillé, en
   silence. Le risque avait déjà été écarté ailleurs dans le dépôt ; il était revenu ici. On lance
   donc le Node courant, avec le tsx installé localement. */
/* Les CONTRE-ÉPREUVES d'abord : un simulateur dont l'échec ne coûte rien ne prouve rien. Chacune
   casse volontairement un invariant et DOIT sortir en 1. Si l'une d'elles passait au vert, tout ce
   que le dossier affiche par ailleurs perdrait sa valeur. */
if (moteur.conforme) {
  for (const ce of CONTRE_EPREUVES) {
    const r = spawnSync(process.execPath, ["--import", "tsx",
      `${DOSSIER}/outils/simuler-h.mjs`, `--contre-epreuve=${ce.code}`], { encoding: "utf8" });
    exigerContreEpreuve(ce, r, "dans l'arbre courant");
  }
  dire(`1bis/4 les ${CONTRE_EPREUVES.length} contre-épreuves sortent en 1 AVEC leur diagnostic propre`);

  for (const o of OUTILS) {
    const r = spawnSync(process.execPath, ["--import", "tsx", `${DOSSIER}/outils/${o}.mjs`], { encoding: "utf8" });
    if (r.status !== 0) echouer(`outil « ${o} » sorti en ${r.status}\n${(r.stderr || "").slice(-1500)}`);
  }
  dire(`2/4 artefacts régénérés`);
} else {
  const n = reproduireAuMoteurHistorique();
  dire(`1bis/4 les ${CONTRE_EPREUVES.length} contre-épreuves rejouées dans le worktree historique — `
    + `code 1 et diagnostic propre pour chacune`);
  dire(`2/4 les ${n} artefacts REJOUÉS dans un worktree au moteur d'origine `
    + `(${MESURE_MOTEUR_SHA.slice(0, 7)}) — identiques aux archivés, octet à octet`);
}

/* ---- 3. SHA256SUMS ------------------------------------------------------------------------------- */
const lignes = [...ARTEFACTS, ...SOURCES].sort()
  .map((f) => `${sha256(readFileSync(`${DOSSIER}/${f}`))}  ${f}`);
if (ECRIRE) {
  writeFileSync(`${DOSSIER}/SHA256SUMS`, lignes.join("\n") + "\n");
  dire(`3/4 SHA256SUMS RÉÉCRIT (${lignes.length} entrées) — le diff doit passer en contre-revue`);
} else {
  const attendu = readFileSync(`${DOSSIER}/SHA256SUMS`, "utf8").trim().split("\n");
  const ecarts = [];
  const parFichier = new Map(attendu.map((l) => [l.slice(66).trim(), l.slice(0, 64)]));
  for (const l of lignes) {
    const f = l.slice(66).trim(), h = l.slice(0, 64);
    if (!parFichier.has(f)) ecarts.push(`${f} : absent de SHA256SUMS`);
    else if (parFichier.get(f) !== h) ecarts.push(`${f} : ${h.slice(0, 12)} ≠ ${parFichier.get(f).slice(0, 12)}`);
  }
  for (const f of parFichier.keys()) if (!lignes.some((l) => l.slice(66).trim() === f)) ecarts.push(`${f} : listé mais absent du dossier`);
  if (ecarts.length) echouer(`SHA256SUMS ne correspond pas :\n  ${ecarts.join("\n  ")}`);
  dire(`3/4 SHA256SUMS vérifié — ${lignes.length} fichiers identiques au bit près`);
}

/* ---- 4. l'arbre entier doit être propre à la fin -------------------------------------------------- */
const sale = arbreSale();
if (sale && !ECRIRE) {
  echouer(`régénérer a MODIFIÉ l'arbre — le dossier n'est pas reproductible :\n${sale}`);
}
dire(sale ? "4/4 arbre modifié (attendu avec --ecrire)"
  : moteur.conforme ? "4/4 arbre entier propre : régénérer ne change rien"
  : "4/4 arbre entier propre : aucun artefact n'a été touché");
dire(moteur.conforme ? "dossier T0-B3-a reproductible."
  : `dossier T0-B3-a reproductible AU MOTEUR DE SA MESURE (${MESURE_MOTEUR_SHA.slice(0, 7)}) — `
    + "le moteur actuel a changé, ces chiffres décrivent l'état d'alors.");
