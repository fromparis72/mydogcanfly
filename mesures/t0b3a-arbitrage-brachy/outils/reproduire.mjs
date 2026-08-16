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
import { readFileSync, writeFileSync, unlinkSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { MESURE_BASE_SHA, MESURE_MOTEUR_SHA, etatDuMoteur } from "./lib-arbitrage.mjs";

const DOSSIER = "mesures/t0b3a-arbitrage-brachy";
const ECRIRE = process.argv.includes("--ecrire");
const OUTILS = ["arbitrer", "simuler-h"];
const ARTEFACTS = ["README.md", "OPTION-H.md", "arbitrage-p0-brachy.json", "option-h-simulee.json"];
const CONTRE_EPREUVES = ["causes", "table", "ids42", "bascules", "validateur", "multi"];
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

/* ---- 1. la base de mesure ---------------------------------------------------------------------- */
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
dire(`1/4 référentiel conforme à la base ${MESURE_BASE_SHA.slice(0, 7)}`);

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
  const base = `${tmpdir()}/mdcf-mesure-t0b3a-${process.pid}`;
  const racine = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  execFileSync("git", ["worktree", "add", "--detach", "--quiet", base, MESURE_MOTEUR_SHA]);
  try {
    symlinkSync(`${racine}/node_modules`, `${base}/node_modules`);
    /* Les CONTRE-ÉPREUVES aussi se rejouent dans le worktree : un simulateur historique dont on ne
       vérifierait plus qu'il sait échouer ne prouverait rien de plus qu'un fichier intact. */
    for (const c of CONTRE_EPREUVES) {
      const r = spawnSync(process.execPath, ["--import", "tsx",
        `${DOSSIER}/outils/simuler-h.mjs`, `--contre-epreuve=${c}`], { encoding: "utf8", cwd: base });
      if (r.status === 0) {
        echouer(`reproduction historique : la contre-épreuve « ${c} » passe au VERT au commit `
          + `${MESURE_MOTEUR_SHA.slice(0, 7)} — le simulateur ne sait pas échouer`);
      }
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
  for (const c of CONTRE_EPREUVES) {
    const r = spawnSync(process.execPath, ["--import", "tsx",
      `${DOSSIER}/outils/simuler-h.mjs`, `--contre-epreuve=${c}`], { encoding: "utf8" });
    if (r.status === 0) echouer(`la contre-épreuve « ${c} » est passée au VERT — le simulateur ne sait pas échouer`);
  }
  dire(`1bis/4 les 6 contre-épreuves échouent bien (code 1)`);

  for (const o of OUTILS) {
    const r = spawnSync(process.execPath, ["--import", "tsx", `${DOSSIER}/outils/${o}.mjs`], { encoding: "utf8" });
    if (r.status !== 0) echouer(`outil « ${o} » sorti en ${r.status}\n${(r.stderr || "").slice(-1500)}`);
  }
  dire(`2/4 artefacts régénérés`);
} else {
  const n = reproduireAuMoteurHistorique();
  dire(`1bis/4 les ${CONTRE_EPREUVES.length} contre-épreuves rejouées dans le worktree historique — `
    + `toutes en code 1`);
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
