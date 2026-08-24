#!/usr/bin/env node
/**
 * LOT A — L'ÉTAT DE RÉFÉRENCE DES 18 PAYS SANS SOURCE, SCELLÉ EXACTEMENT, ET UN SCELLEUR
 * QUI NE PEUT PAS CONSACRER UNE DÉRIVE.
 *
 *   node --import tsx mesurer-lot-a.mjs --as-of=2026-08-24
 *   node --import tsx mesurer-lot-a.mjs --as-of=… --sceller [--remplace=<sha256 du scellé actuel>]
 *
 * TROIS PASSAGES INDUS fermés depuis la v2 (contre-revue du 24/08/2026) :
 *   · `pet_scheme` modifié → sortie 0. Or c'est LE fait que la future source doit étayer.
 *     Le scellé porte désormais sa valeur exacte.
 *   · `iso2` altéré dans le scellé, pays parasite ajouté → sortie 0. La comparaison est
 *     désormais STRUCTURELLE et symétrique sur l'objet entier : pays absent ou supplémentaire,
 *     champ absent ou supplémentaire, valeur modifiée — chacun nommé.
 *   · une URL remplacée puis `--sceller` → le scellé consacrait la dérive. `--sceller` est
 *     désormais VERROUILLÉ : refus si les données mesurées (content/countries,
 *     countries.generated.json, knowledge/raw) ne sont pas propres au sens de git, et — si un
 *     scellé existe déjà — exigence de `--remplace=<sha256>` égal à l'empreinte du scellé en
 *     place : remplacer un état de référence est un acte explicite, tracé, jamais un réflexe.
 *
 * `--as-of` est OBLIGATOIRE : la date doit exister (reconstruction UTC), et aucune
 * `verified_date` de guide ne peut lui être postérieure — une vérification datée du futur
 * n'est pas une vérification.
 *
 * Le reste est inchangé depuis la v2 : empreinte SHA-256 par pays des triplets (label, url),
 * sémantique canonique `rulesForCountry` (scope + prédicats de destination), relecture des
 * YAML et égalité canonique avec l'artefact généré, validation calendaire et http(s).
 * IL NE CORRIGE RIEN : il lit, il compte, et n'écrit que le scellé, sur ordre verrouillé.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import YAML from "yaml";
import { loadKB } from "./packages/knowledge/src/data.ts";
import { rulesForCountry } from "./packages/knowledge/src/views.ts";

const SCELLE = "etat-reference-lot-a.json";
/* Les seuls chemins dont la propreté conditionne le scellement : les DONNÉES mesurées.
 * L'instrument lui-même s'édite sous revue git ; il ne scelle pas son propre code. */
const DONNEES = ["content/countries", "packages/ui/src/data/countries.generated.json", "packages/knowledge/raw"];

const args = process.argv.slice(2);
const SCELLER = args.includes("--sceller");
const REMPLACE = (args.find((a) => a.startsWith("--remplace=")) || "").slice(11);
const asOf = (args.find((a) => a.startsWith("--as-of=")) || "").slice(8);

const dateExiste = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d));
  if (!m) return false;
  const u = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return u.getUTCFullYear() === +m[1] && u.getUTCMonth() === +m[2] - 1 && u.getUTCDate() === +m[3];
};
if (!dateExiste(asOf)) {
  process.stderr.write("[lot-a] ÉCHEC : --as-of=AAAA-MM-JJ est OBLIGATOIRE et la date doit EXISTER.\n" +
    (asOf ? `[lot-a] « ${asOf} » n'est pas un jour du calendrier.\n` : "") +
    "[lot-a]   node --import tsx mesurer-lot-a.mjs --as-of=2026-08-24\n");
  process.exit(2);
}

/* Les 18, tels que figés par le bloc contractuel du dossier d'achèvement (annexe A). */
const CONTRACTUELS = [
  "country_bh", "country_bs", "country_ci", "country_ec", "country_et", "country_fj",
  "country_gh", "country_jm", "country_kw", "country_lb", "country_mg", "country_mv",
  "country_ng", "country_np", "country_om", "country_ru", "country_sc", "country_uy",
];

const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf-8"));
const guides = JSON.parse(readFileSync("packages/ui/src/data/countries.generated.json", "utf-8"));
const kb = loadKB();

const defauts = [];
const echec = (pays, m) => defauts.push(`${pays} — ${m}`);
const l = (m) => process.stdout.write(m + "\n");

const jsonCanonique = (x) => {
  if (Array.isArray(x)) return "[" + x.map(jsonCanonique).join(",") + "]";
  if (x && typeof x === "object") {
    return "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + jsonCanonique(x[k])).join(",") + "}";
  }
  return JSON.stringify(x);
};
const sha = (s) => createHash("sha256").update(s).digest("hex");
const urlValide = (u) => {
  try { const p = new URL(String(u)); return /^https?:$/.test(p.protocol) && p.hostname.length > 0; }
  catch { return false; }
};

/* ---- l'ensemble sans source, recalculé — il doit être EXACTEMENT les 18 --------------------- */
const sansSource = objets.countries.filter((c) => !c.source).map((c) => c.id).sort();
if (JSON.stringify(sansSource) !== JSON.stringify([...CONTRACTUELS].sort())) {
  echec("ensemble", `les pays sans source ne sont plus les 18 contractuels : ` +
    `ajoutés [${sansSource.filter((x) => !CONTRACTUELS.includes(x)).join(", ")}] · ` +
    `disparus [${CONTRACTUELS.filter((x) => !sansSource.includes(x)).join(", ")}]`);
}

/* ---- relevé par pays : YAML relu, artefact confronté, URL, dates, pet_scheme ---------------- */
const CHAMPS = ["sources", "verified_date", "reviewer", "confidence"];
const releve = { liens_total: 0, pays: {} };
for (const id of CONTRACTUELS) {
  const p = objets.countries.find((c) => c.id === id);
  const g = guides[id];
  if (!g) { echec(id, "AUCUN guide dans countries.generated.json"); continue; }

  const iso2 = String(p?.iso2 ?? "").toLowerCase();
  let y = null;
  try { y = YAML.parse(readFileSync(`content/countries/${iso2}.yml`, "utf8")); }
  catch { echec(id, `YAML introuvable ou illisible : content/countries/${iso2}.yml`); }
  if (y && y.id !== id) echec(id, `le YAML ${iso2}.yml déclare l'id ${JSON.stringify(y.id)}`);
  if (y) {
    for (const champ of CHAMPS) {
      if (jsonCanonique(y[champ]) !== jsonCanonique(g[champ])) {
        echec(id, `l'artefact généré DIVERGE du YAML sur « ${champ} » — le YAML fait foi, régénérer par l'ingestion`);
      }
    }
  }

  const liens = Array.isArray(g.sources) ? g.sources : [];
  if (liens.length === 0) echec(id, "guide sans AUCUN lien source");
  for (const [i, s] of liens.entries()) {
    if (!urlValide(s.url)) echec(id, `lien source [${i}] : URL invalide ou non-http(s) — ${JSON.stringify(s.url)}`);
  }
  if (!dateExiste(g.verified_date)) echec(id, `verified_date « ${g.verified_date} » n'existe pas au calendrier`);
  else if (String(g.verified_date) > asOf) {
    echec(id, `verified_date « ${g.verified_date} » est POSTÉRIEURE à --as-of=${asOf} — une vérification datée du futur n'en est pas une`);
  }

  releve.liens_total += liens.length;
  releve.pays[id] = {
    iso2,
    pet_scheme: p?.pet_scheme ?? null,
    verified_date: g.verified_date,
    reviewer: g.reviewer,
    confidence: g.confidence,
    liens: liens.length,
    regles_ciblantes: rulesForCountry(kb, id).length,
    empreinte_sources: sha(jsonCanonique(liens)),
  };
}

/* ---- scellement : verrouillé — jamais un réflexe -------------------------------------------- */
if (SCELLER) {
  if (defauts.length) {
    process.stderr.write("[lot-a] REFUS de sceller un état en défaut :\n");
    for (const d of defauts) process.stderr.write(`  ${d}\n`);
    process.exit(1);
  }
  const statut = spawnSync("git", ["status", "--porcelain", "--", ...DONNEES], { encoding: "utf-8" });
  if (statut.status !== 0 || statut.stdout.trim() !== "") {
    process.stderr.write("[lot-a] REFUS de sceller : les données mesurées ne sont pas propres au sens de git —\n" +
      "[lot-a] un scellé posé sur des données non revues consacrerait la dérive qu'il doit révéler.\n" +
      statut.stdout.split("\n").filter(Boolean).slice(0, 10).map((x) => `  ${x}\n`).join(""));
    process.exit(1);
  }
  if (existsSync(SCELLE)) {
    const actuel = sha(readFileSync(SCELLE, "utf-8"));
    if (REMPLACE !== actuel) {
      process.stderr.write(`[lot-a] REFUS de remplacer le scellé existant sans le nommer :\n` +
        `[lot-a]   --remplace=${actuel}\n` +
        `[lot-a] Remplacer un état de référence est un acte explicite et tracé, jamais un réflexe.\n`);
      process.exit(1);
    }
  }
  const base = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout.trim();
  writeFileSync(SCELLE, JSON.stringify({ _scelle: { sha_base: base, remplace: REMPLACE || null }, ...releve }, null, 2) + "\n");
  l(`[lot-a] scellé écrit : ${SCELLE} — ${Object.keys(releve.pays).length} pays · ${releve.liens_total} liens · base ${base.slice(0, 7)}`);
  process.exit(0);
}

/* ---- vérification : égalité STRUCTURELLE de l'objet scellé entier --------------------------- */
let attendu = null;
try { attendu = JSON.parse(readFileSync(SCELLE, "utf-8")); }
catch { echec("scellé", `${SCELLE} introuvable ou illisible — un état de référence non scellé ne se vérifie pas`); }
if (attendu) {
  const { _scelle, ...corps } = attendu; // la traçabilité du scellement n'est pas une mesure
  const comparer = (a, b, chemin) => {   // a = scellé, b = relevé
    if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        echec("scellé", `valeur modifiée à ${chemin} : scellé ${JSON.stringify(a)} · relevé ${JSON.stringify(b)}`);
      }
      return;
    }
    if (Array.isArray(a) !== Array.isArray(b)) { echec("scellé", `nature différente à ${chemin}`); return; }
    const clesA = Array.isArray(a) ? a.map((_, i) => String(i)) : Object.keys(a);
    const clesB = Array.isArray(b) ? b.map((_, i) => String(i)) : Object.keys(b);
    for (const k of clesA) if (!clesB.includes(k)) echec("scellé", `entrée du scellé SANS CONTREPARTIE au relevé : ${chemin}.${k} = ${JSON.stringify(a[k]).slice(0, 80)}`);
    for (const k of clesB) if (!clesA.includes(k)) echec("scellé", `entrée du relevé ABSENTE du scellé : ${chemin}.${k} = ${JSON.stringify(b[k]).slice(0, 80)}`);
    for (const k of clesA) if (clesB.includes(k)) comparer(a[k], b[k], `${chemin}.${k}`);
  };
  comparer(corps, releve, "etat");
}

/* ---- sortie --------------------------------------------------------------------------------- */
if (defauts.length) {
  process.stderr.write(`[lot-a] ÉCHEC — ${defauts.length} écart(s) avec l'état de référence :\n`);
  for (const d of defauts) process.stderr.write(`  ${d}\n`);
  process.exit(1);
}
l(`LOT A — état de référence conforme au scellé (égalité structurelle, ${asOf}).`);
l(`18 pays sans source · ${releve.liens_total} liens publiés http(s) valides · dates existantes et non futures`);
l(`pet_scheme scellés · YAML ↔ artefact identiques · règles ciblantes (rulesForCountry) : ` +
  `${Object.values(releve.pays).reduce((n, p) => n + p.regles_ciblantes, 0)}`);
