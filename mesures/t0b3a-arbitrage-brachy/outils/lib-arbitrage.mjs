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
