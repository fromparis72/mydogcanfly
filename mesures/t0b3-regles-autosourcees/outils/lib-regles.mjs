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

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** Charge le référentiel ET son empreinte. Sans scellement, une mesure n'est qu'une opinion
 *  datée : rejouer ce dossier sur un autre état donnerait d'autres chiffres sans le dire. */
export function chargerReferentiel() {
  const lire = (chemin) => {
    const brut = readFileSync(chemin);
    return { chemin, sha256: sha256(brut), valeur: JSON.parse(brut.toString("utf8")) };
  };
  const regles = lire("packages/knowledge/raw/rules.json");
  const objets = lire("packages/knowledge/raw/objects.json");
  const gitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const gitPropre =
    execFileSync("git", ["status", "--porcelain", "packages/knowledge/raw"], { encoding: "utf8" }).trim() === "";
  return {
    sceau: {
      git_sha: gitSha,
      raw_rules_sha256: regles.sha256,
      raw_objects_sha256: objets.sha256,
      raw_non_modifie: gitPropre,
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
