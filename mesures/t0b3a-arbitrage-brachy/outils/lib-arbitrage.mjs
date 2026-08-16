/**
 * T0-B3-a · socle du dossier d'ARBITRAGE brachycéphale.
 *
 * Même discipline qu'en T0-B3 : base de mesure FIGÉE, jamais `git rev-parse HEAD`. Un sceau qui
 * change parce qu'on a commité le sceau ne scelle rien (défaut relevé en contre-revue le
 * 16/08/2026, corrigé dans le dossier précédent — on ne le réintroduit pas ici).
 *
 * Ce dossier n'écrit RIEN dans `packages/`. Toutes les options sont jouées en mémoire.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

/* SHA COMPLET, jamais abrégé : une base courte est ambiguë par construction — deux commits peuvent
   partager un préfixe, et rien dans le fichier ne dirait lequel a servi. Relevé en contre-revue le
   16/08/2026, en même temps qu'un SHA de passation que j'avais annoncé sans l'avoir lu. */
export const MESURE_BASE_SHA = "e2cf302ccf045c539ca450f23964bb7bf20af84c";
const RAW = ["packages/knowledge/raw/rules.json", "packages/knowledge/raw/objects.json"];
const sha256 = (b) => createHash("sha256").update(b).digest("hex");

/**
 * LE COMMIT QUI A PRODUIT CES ARTEFACTS — moteur compris.
 *
 * `MESURE_BASE_SHA` scelle le RÉFÉRENTIEL ; celui-ci scelle le CODE. Quand le moteur de l'arbre de
 * travail en diffère, la reproduction se joue dans un worktree détaché à ce commit : les chiffres
 * se rejouent dans leur monde, au lieu d'être recalculés dans un autre et de remplacer les anciens.
 */
export const MESURE_MOTEUR_SHA = "a9a6556a6d386584af4849bbb23d1b1a841714e8";

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
  const attendu = empreinteMoteur(MESURE_MOTEUR_SHA);
  const courant = empreinteMoteur();
  return { attendu, courant, conforme: attendu === courant };
}

export function chargerReferentiel() {
  const lu = RAW.map((chemin) => {
    const brut = readFileSync(chemin);
    return { chemin, sha256: sha256(brut), valeur: JSON.parse(brut.toString("utf8")) };
  });
  const ecarts = [];
  for (const { chemin, sha256: courant } of lu) {
    let attendu;
    try {
      attendu = sha256(execFileSync("git", ["show", `${MESURE_BASE_SHA}:${chemin}`], { maxBuffer: 256 * 1024 * 1024 }));
    } catch {
      throw new Error(`base de mesure ${MESURE_BASE_SHA} introuvable — « git fetch origin main » puis relancer`);
    }
    if (courant !== attendu) ecarts.push(`${chemin} : ${courant.slice(0, 12)} ≠ ${attendu.slice(0, 12)}`);
  }
  if (ecarts.length) throw new Error(`l'arbre ne correspond pas à la base ${MESURE_BASE_SHA} :\n  ${ecarts.join("\n  ")}`);
  return {
    sceau: { measurement_base_sha: MESURE_BASE_SHA, raw_rules_sha256: lu[0].sha256, raw_objects_sha256: lu[1].sha256 },
    regles: lu[0].valeur, objets: lu[1].valeur,
  };
}

export const AUTO_CITATION = /(^|\.)mydogcanfly\.com$/i;
export const estAutoCitee = (r) => { try { return AUTO_CITATION.test(new URL(r.source.url).hostname); } catch { return false; } };
export const ecrireJson = (p, v) => writeFileSync(p, JSON.stringify(v, null, 1) + "\n");
