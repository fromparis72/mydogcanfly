/**
 * Socle commun du dossier T0-B3 — lecture du référentiel et vocabulaire partagé.
 *
 * Ce fichier ne DÉCIDE rien : il lit, il scelle, il nomme. Les jugements (classification,
 * simulation) vivent dans les outils qui l'importent, pour qu'on puisse les relire séparément.
 *
 * Zéro accès réseau, ici comme partout dans ce dossier. Une « source officielle confirmante » ne
 * peut donc PAS vouloir dire « j'ai ouvert la page et elle confirme » : elle veut dire ce que le
 * référentiel permet d'établir, et c'est écrit noir sur blanc dans `classer.mjs`. Prétendre le
 * contraire reproduirait exactement le défaut que ce lot mesure.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

/** L'auto-citation est une question d'HÔTE, jamais de `source_type` déclaré.
 *  Mesure du 16/08/2026 : 184 règles portent `source_type: "other"`, dont 13 citent un tiers réel
 *  (pettravel.com, IATA, anivetvoyage). Se fier au type aurait donc surcompté de 13. */
export const AUTO_CITATION = /(^|\.)mydogcanfly\.com$/i;

export function hote(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export const estAutoCiteeUrl = (url) => AUTO_CITATION.test(hote(url ?? ""));
export const estAutoCitee = (regle) => estAutoCiteeUrl(regle?.source?.url);

/** Les types de source qui font AUTORITÉ au sens du référentiel. `other` en est exclu : c'est le
 *  fourre-tout, et c'est là que se rangent les 171. */
export const TYPES_OFFICIELS = new Set(["official_website", "regulation", "government"]);

/**
 * LA BASE DE MESURE EST FIGÉE, PAS DÉDUITE DE `HEAD`.
 *
 * Première version de ce dossier (contre-revue du 16/08/2026) : le sceau portait
 * `git rev-parse HEAD`. Les artefacts devenaient donc irreproductibles dès leur propre commit —
 * régénérés depuis `c85261f`, ils étaient métier-identiques mais leur `git_sha` passait de
 * `ca254bf…` à `c85261f…`, et `SHA256SUMS` échouait. Un sceau qui change parce qu'on a commité le
 * sceau ne scelle rien.
 *
 * La base est donc une CONSTANTE, et les fichiers bruts sont confrontés à ce commit-là. Le dossier
 * refuse de se générer si l'arbre de travail ne correspond pas : mieux vaut ne rien produire que
 * produire une mesure dont personne ne saura sur quel état elle portait.
 */
export const MESURE_BASE_SHA = "ca254bf973bbab89f06073bdc36716f0cdb58660";

const RAW = ["packages/knowledge/raw/rules.json", "packages/knowledge/raw/objects.json"];

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** L'empreinte d'un fichier TEL QU'IL EST DANS UN COMMIT, sans toucher à l'arbre de travail. */
function sha256AuCommit(sha, chemin) {
  return sha256(execFileSync("git", ["show", `${sha}:${chemin}`], { maxBuffer: 256 * 1024 * 1024 }));
}

/* ---- L'EMPREINTE DU MOTEUR QUI A PRODUIT CES CHIFFRES -----------------------------------------
 *
 * Le sceau ne portait que le RÉFÉRENTIEL. Il était donc muet sur le CODE qui le lit — et le
 * câblage de l'option H (17/08/2026) l'a démontré : à référentiel strictement identique, la sonde
 * de retrait groupé est passée de « la soute se rouvre en `allowed` » à « la soute passe à
 * “à confirmer” », et l'arbitrage voyait ses options B à G se confondre avec H. `SHA256SUMS` l'a
 * bien signalé, mais rien n'en donnait la cause : on pouvait croire à une dérive du référentiel.
 *
 * Un dossier de mesure décrit un ÉTAT, moteur compris. Quand le moteur change, ces chiffres ne se
 * régénèrent plus : ils deviennent historiques. Les recalculer les remplacerait en silence — et
 * ici, cela aurait remplacé les options d'un arbitrage déjà tranché par une tautologie, chaque
 * option contenant désormais H.
 */
const SOURCES_MOTEUR = [
  "packages/engine/src/contracts.ts",
  "packages/engine/src/evaluate.ts",
  "packages/engine/src/explain.ts",
  "packages/knowledge/src/normalize.ts",
  "packages/knowledge/src/breed-restrictions.ts",
  "packages/knowledge/raw/breed-restrictions.json",
];
/** `sha` absent = l'arbre de travail ; sinon le contenu AU COMMIT. Un fichier qui n'existait pas
 *  à la base de mesure vaut « absent » — c'est un état, pas une erreur. */
const empreinteMoteur = (sha) => sha256(SOURCES_MOTEUR.map((c) => {
  let h;
  try { h = sha ? sha256(execFileSync("git", ["show", `${sha}:${c}`], { maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] })) : sha256(readFileSync(c)); }
  catch { h = "absent"; }
  return `${c}:${h}`;
}).join("\n"));

/** Le moteur de l'arbre de travail est-il celui qui a produit les artefacts scellés ? */
export function etatDuMoteur() {
  const attendu = empreinteMoteur(MESURE_BASE_SHA);
  const courant = empreinteMoteur();
  return { attendu, courant, conforme: attendu === courant };
}

/** Charge le référentiel ET son empreinte. Sans scellement, une mesure n'est qu'une opinion
 *  datée : rejouer ce dossier sur un autre état donnerait d'autres chiffres sans le dire. */
export function chargerReferentiel() {
  const lire = (chemin) => {
    const brut = readFileSync(chemin);
    return { chemin, sha256: sha256(brut), valeur: JSON.parse(brut.toString("utf8")) };
  };
  const regles = lire(RAW[0]);
  const objets = lire(RAW[1]);

  /* Confrontation à la base figée. Un écart ici n'est pas un avertissement : c'est un arrêt. */
  const ecarts = [];
  for (const { chemin, sha256: courant } of [regles, objets]) {
    let attendu;
    try {
      attendu = sha256AuCommit(MESURE_BASE_SHA, chemin);
    } catch {
      throw new Error(
        `base de mesure ${MESURE_BASE_SHA.slice(0, 7)} introuvable dans ce dépôt — ` +
        `récupérer le commit (git fetch) avant de régénérer le dossier`);
    }
    if (courant !== attendu) ecarts.push(`${chemin} : ${courant.slice(0, 12)} ≠ ${attendu.slice(0, 12)}`);
  }
  if (ecarts.length) {
    throw new Error(
      `l'arbre de travail ne correspond pas à la base de mesure ${MESURE_BASE_SHA.slice(0, 7)} :\n  ` +
      ecarts.join("\n  ") +
      `\nRégénérer depuis cette base, ou déclarer une nouvelle base et refaire TOUTES les mesures.`);
  }

  return {
    /* Le sceau ne contient QUE des valeurs stables : la base figée et les empreintes des fichiers
       bruts à cette base. Aucune trace de l'état du dépôt au moment de l'exécution — c'est ce qui
       rend les six artefacts identiques au bit près, quel que soit le commit d'où on les régénère. */
    sceau: {
      measurement_base_sha: MESURE_BASE_SHA,
      raw_rules_sha256: regles.sha256,
      raw_objects_sha256: objets.sha256,
    },
    regles: regles.valeur,
    objets: objets.valeur,
  };
}

/** Index des entités par identifiant, pour nommer une règle sans la deviner. */
export function indexerEntites(objets) {
  const par = new Map();
  for (const a of objets.airlines) par.set(a.id, { type: "airline", nom: a.name, obj: a });
  for (const c of objets.countries) par.set(c.id, { type: "country", nom: c.name, obj: c });
  for (const b of objets.breeds ?? []) par.set(b.id, { type: "breed", nom: b.name, obj: b });
  return par;
}

/** Rend un prédicat lisible sans le trahir : la forme reste l'arbre exact, en une ligne.
 *  Un résumé approximatif rendrait le dossier incontrôlable — on doit pouvoir relire la condition
 *  et la comparer au JSON d'origine. */
export function conditionLisible(p) {
  if (!p || typeof p !== "object") return String(p);
  if (Array.isArray(p.all)) return "(" + p.all.map(conditionLisible).join(" ET ") + ")";
  if (Array.isArray(p.any)) return "(" + p.any.map(conditionLisible).join(" OU ") + ")";
  if (p.not) return "NON " + conditionLisible(p.not);
  const v = Array.isArray(p.value) ? `[${p.value.join(", ")}]` : String(p.value);
  return `${p.fact} ${p.op} ${v}`;
}

/** L'effet décisionnel, en une chaîne stable et triable. */
export function effetLisible(effet) {
  const bouts = [effet.action];
  if (effet.placement?.length) bouts.push(`placement=${[...effet.placement].sort().join("+")}`);
  if (effet.travel_type?.length) bouts.push(`voyageur=${[...effet.travel_type].sort().join("+")}`);
  return bouts.join(" ");
}

/** Tri stable et total : deux exécutions produisent le même ordre, sur toute machine.
 *  Exigence de Codex — « liste exhaustive et STABLE ». */
export const trierRegles = (a, b) =>
  a.category.localeCompare(b.category) ||
  (a.scope.id ?? "").localeCompare(b.scope.id ?? "") ||
  a.id.localeCompare(b.id);

export const ecrireJson = (chemin, valeur) =>
  writeFileSync(chemin, JSON.stringify(valeur, null, 1) + "\n");
