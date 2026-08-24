#!/usr/bin/env node
/**
 * LOT A — L'ÉTAT DE RÉFÉRENCE DES 18 PAYS SANS SOURCE, SCELLÉ ET INVIOLABLE.
 *
 *   node --import tsx mesurer-lot-a.mjs             vérifie l'état contre le scellé
 *   node --import tsx mesurer-lot-a.mjs --sceller   régénère etat-reference-lot-a.json
 *
 * `--import tsx` parce que ce relevé réutilise la SÉMANTIQUE CANONIQUE du dépôt au lieu de la
 * réimplémenter : `rulesForCountry` (packages/knowledge/src/views.ts) compte les règles qui
 * concernent l'entrée dans un pays — par leur `scope` ET par leur prédicat de destination
 * (`route.dest_country_id`, eq/in). La v1 filtrait sur le seul `scope` : une règle ajoutée par
 * prédicat restait invisible — contre-épreuve de la contre-revue, sortie 0 à tort.
 *
 * CE QUI EST SCELLÉ, par pays, dans `etat-reference-lot-a.json` :
 *   · l'EMPREINTE SHA-256 des liens sources publiés par le guide — les triplets (label, url)
 *     complets, en JSON canonique : remplacer une URL par une autre URL valide rougit ;
 *   · les MÉTADONNÉES du guide : `verified_date`, `reviewer`, `confidence` ;
 *   · le NOMBRE de règles ciblantes au sens canonique (0 pour les 18 aujourd'hui) ;
 *   · le nombre de liens, et leur total global (91).
 *
 * CE QUI EST VÉRIFIÉ à chaque exécution, avant même le scellé :
 *   · le YAML (`content/countries/<iso2>.yml`) et l'artefact généré
 *     (`countries.generated.json`) disent LA MÊME CHOSE sur `sources`, `verified_date`,
 *     `reviewer`, `confidence` — comparés en JSON canonique, l'artefact ne fait pas foi seul ;
 *   · chaque URL publiée est parsable, en http(s), avec un hôte non vide ;
 *   · chaque `verified_date` EXISTE au calendrier (reconstruction UTC, champ à champ — la
 *     regex de l'ingestion laisse passer « 2026-02-31 », la leçon est déjà payée ailleurs) ;
 *   · l'ensemble des pays sans source du référentiel est EXACTEMENT les 18 contractuels.
 *
 * IL NE CORRIGE RIEN. Il lit, il compte, et n'écrit que le scellé — sur ordre explicite
 * (`--sceller`), jamais en vérification. Sortie 1 au premier écart, en nommant pays et champ.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import YAML from "yaml";
import { loadKB } from "./packages/knowledge/src/data.ts";
import { rulesForCountry } from "./packages/knowledge/src/views.ts";

const SCELLE = "etat-reference-lot-a.json";
const SCELLER = process.argv.includes("--sceller");

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

const dateExiste = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d));
  if (!m) return false;
  const u = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return u.getUTCFullYear() === +m[1] && u.getUTCMonth() === +m[2] - 1 && u.getUTCDate() === +m[3];
};
const urlValide = (u) => {
  try {
    const p = new URL(String(u));
    return /^https?:$/.test(p.protocol) && p.hostname.length > 0;
  } catch { return false; }
};

/* ---- l'ensemble sans source, recalculé — il doit être EXACTEMENT les 18 --------------------- */
const sansSource = objets.countries.filter((c) => !c.source).map((c) => c.id).sort();
if (JSON.stringify(sansSource) !== JSON.stringify([...CONTRACTUELS].sort())) {
  echec("ensemble", `les pays sans source ne sont plus les 18 contractuels : ` +
    `ajoutés [${sansSource.filter((x) => !CONTRACTUELS.includes(x)).join(", ")}] · ` +
    `disparus [${CONTRACTUELS.filter((x) => !sansSource.includes(x)).join(", ")}]`);
}

/* ---- relevé par pays : YAML relu, artefact confronté, URL et dates validées ----------------- */
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

  const regles = rulesForCountry(kb, id);
  releve.liens_total += liens.length;
  releve.pays[id] = {
    iso2,
    verified_date: g.verified_date,
    reviewer: g.reviewer,
    confidence: g.confidence,
    liens: liens.length,
    regles_ciblantes: regles.length,
    empreinte_sources: sha(jsonCanonique(liens)),
  };
}

/* ---- scellé : refusé si l'état est déjà en défaut ; comparé champ à champ sinon ------------- */
if (defauts.length && SCELLER) {
  process.stderr.write("[lot-a] REFUS de sceller un état en défaut :\n");
  for (const d of defauts) process.stderr.write(`  ${d}\n`);
  process.exit(1);
}
if (SCELLER) {
  writeFileSync(SCELLE, JSON.stringify(releve, null, 2) + "\n");
  l(`[lot-a] scellé écrit : ${SCELLE} — ${Object.keys(releve.pays).length} pays · ${releve.liens_total} liens`);
  process.exit(0);
}

let attendu = null;
try { attendu = JSON.parse(readFileSync(SCELLE, "utf-8")); }
catch { echec("scellé", `${SCELLE} introuvable ou illisible — un état de référence non scellé ne se vérifie pas`); }
if (attendu) {
  if (attendu.liens_total !== releve.liens_total) {
    echec("scellé", `liens publiés : ${releve.liens_total}, scellé ${attendu.liens_total}`);
  }
  for (const id of CONTRACTUELS) {
    const a = attendu.pays?.[id], r = releve.pays[id];
    if (!a) { echec(id, "absent du scellé"); continue; }
    if (!r) continue; // déjà en défaut plus haut
    for (const champ of ["verified_date", "reviewer", "confidence", "liens", "regles_ciblantes", "empreinte_sources"]) {
      if (jsonCanonique(a[champ]) !== jsonCanonique(r[champ])) {
        echec(id, `« ${champ} » a bougé : relevé ${jsonCanonique(r[champ])} · scellé ${jsonCanonique(a[champ])}`);
      }
    }
  }
}

/* ---- sortie --------------------------------------------------------------------------------- */
if (defauts.length) {
  process.stderr.write(`[lot-a] ÉCHEC — ${defauts.length} écart(s) avec l'état de référence :\n`);
  for (const d of defauts) process.stderr.write(`  ${d}\n`);
  process.exit(1);
}
l(`LOT A — état de référence conforme au scellé.`);
l(`18 pays sans source · ${releve.liens_total} liens sources publiés, tous http(s) valides · dates existantes`);
l(`YAML ↔ artefact généré : identiques sur sources, verified_date, reviewer, confidence`);
l(`règles ciblantes (sémantique canonique rulesForCountry, scope + destination) : ` +
  `${Object.values(releve.pays).reduce((n, p) => n + p.regles_ciblantes, 0)} au total`);
