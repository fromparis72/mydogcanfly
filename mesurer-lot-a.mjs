#!/usr/bin/env node
/**
 * LOT A — L'INVENTAIRE EXACT DES 18 PAYS SANS SOURCE, SUR LES DEUX COUCHES DE PROVENANCE.
 *
 *   node mesurer-lot-a.mjs
 *
 * CE QU'IL MESURE. Le dossier d'achèvement (annexe A, bloc contractuel) a figé 18 pays du
 * référentiel `objects.json` sans AUCUNE source. Ce relevé-ci établit l'état de référence du
 * lot A — et il a découvert en route que la dette n'est pas celle qu'on croyait :
 *
 *   COUCHE 1 — le référentiel (`packages/knowledge/raw/objects.json`). Les 18 pays y portent
 *   cinq champs (`id, iso2, name, region, pet_scheme`), un `pet_scheme` générique
 *   (« National import rules »), zéro règle du moteur qui les cible — et pas de `source`.
 *
 *   COUCHE 2 — les guides pays (`content/countries/<iso2>.yml`, ingérés et validés par zod
 *   dans `countries.generated.json`). CHACUN des 18 a un guide RICHE ET PUBLIÉ : exigences
 *   d'entrée détaillées, races restreintes, autorité de sortie, 3 à 7 liens sources — pour la
 *   plupart des hôtes gouvernementaux du pays — un `verified_date`, un `reviewer`, une
 *   `confidence`. Cette couche n'est PAS au format canonique `Source` (liens sans date, sans
 *   type, sans confiance par lien) et n'entre pas dans le registre des 1 505.
 *
 * La dette du lot A n'est donc pas « trouver des sources » : c'est AUDITER les sources déjà
 * publiées par les guides, et promouvoir dans le référentiel une `Source` canonique par pays —
 * ou constater véridiquement qu'aucune ne tient, ce qui met le guide publié lui-même en cause.
 *
 * IL NE CORRIGE RIEN. Il lit, il compte, il n'écrit aucun fichier du dépôt.
 * Sortie 1 si l'état de référence a dérivé : l'ensemble des pays sans source n'est plus
 * exactement les 18 contractuels, un des 18 n'a pas de guide, ou son guide n'a pas de sources.
 */
import { readFileSync, readdirSync } from "node:fs";

/* Les 18, tels que figés par le bloc contractuel du dossier d'achèvement (annexe A). */
const CONTRACTUELS = [
  "country_bh", "country_bs", "country_ci", "country_ec", "country_et", "country_fj",
  "country_gh", "country_jm", "country_kw", "country_lb", "country_mg", "country_mv",
  "country_ng", "country_np", "country_om", "country_ru", "country_sc", "country_uy",
];

const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf-8"));
const regles = JSON.parse(readFileSync("packages/knowledge/raw/rules.json", "utf-8"));
const guides = JSON.parse(readFileSync("packages/ui/src/data/countries.generated.json", "utf-8"));
const ymls = readdirSync("content/countries").filter((f) => f.endsWith(".yml") && !f.startsWith("_"));

const defauts = [];
const hote = (u) => { try { return new URL(u).hostname; } catch { return `URL-INVALIDE(${u})`; } };
const l = (m) => process.stdout.write(m + "\n");

/* ---- l'ensemble sans source, recalculé — il doit être EXACTEMENT les 18 ------------------- */
const sansSource = objets.countries.filter((c) => !c.source).map((c) => c.id).sort();
if (JSON.stringify(sansSource) !== JSON.stringify([...CONTRACTUELS].sort())) {
  defauts.push(`l'ensemble sans source a dérivé : ${sansSource.length} pays — ` +
    `ajoutés [${sansSource.filter((x) => !CONTRACTUELS.includes(x)).join(", ")}] · ` +
    `disparus [${CONTRACTUELS.filter((x) => !sansSource.includes(x)).join(", ")}]`);
}

/* ---- inventaire par pays, sur les deux couches -------------------------------------------- */
l(`LOT A — état de référence · ${objets.countries.length} pays · ${ymls.length} guides YAML`);
l("");
let liensTotal = 0;
for (const id of CONTRACTUELS) {
  const p = objets.countries.find((c) => c.id === id);
  const g = guides[id];
  const ciblantes = regles.filter((r) => r.scope?.type === "country" && r.scope?.id === id);
  l(`${id} · ${p?.name?.en ?? "?"}`);
  l(`  référentiel : champs [${Object.keys(p ?? {}).join(", ")}] · pet_scheme ${JSON.stringify(p?.pet_scheme)} · règles ciblantes : ${ciblantes.length}`);
  if (!g) { defauts.push(`${id} : AUCUN guide dans countries.generated.json`); l("  guide : ABSENT"); continue; }
  const hs = (g.sources ?? []).map((s) => hote(s.url));
  liensTotal += hs.length;
  if (hs.length === 0) defauts.push(`${id} : guide sans AUCUN lien source`);
  l(`  guide : regime=${g.regime ?? "—"} · difficulté=${g.difficulty?.level ?? "—"} · verified_date=${g.verified_date} · confidence=${g.confidence}`);
  l(`  autorité de sortie : ${g.exit?.authority ?? "—"}${g.exit?.authorityUrl ? " · " + hote(g.exit.authorityUrl) : ""}`);
  l(`  liens sources du guide (${hs.length}) : ${hs.join(" · ")}`);
}
l("");
l(`liens sources publiés par les guides des 18 : ${liensTotal}`);

/* ---- la couche guides, globalement — hors registre des 1 505 ------------------------------ */
const tous = Object.values(guides);
const dates = tous.filter((g) => typeof g.verified_date === "string").length;
const liens = tous.reduce((n, g) => n + (g.sources?.length ?? 0), 0);
l("");
l(`COUCHE GUIDES (hors registre du dossier d'achèvement) : ${tous.length} guides · ${dates} datés · ${liens} liens sources`);
l("  contrat d'ingestion : label+url par lien (sans date, type ni confiance) · verified_date");
l("  validé par REGEX seulement — l'existence du jour n'est pas contrôlée à l'ingestion.");

/* ---- panorama des 122 sources pays du référentiel — pour situer la barre ------------------ */
const parHote = {};
for (const c of objets.countries) {
  if (!c.source?.url) continue;
  const h = hote(c.source.url);
  parHote[h] = (parHote[h] ?? 0) + 1;
}
l("");
l("PANORAMA des 122 sources pays déjà au référentiel (hôte × pays) :");
for (const [h, n] of Object.entries(parHote).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
  l(`  ${String(n).padStart(3)} × ${h}`);
}
l(`  … et ${Object.keys(parHote).length - 8} hôtes à 1 pays.`);

/* ---- verdict ------------------------------------------------------------------------------ */
if (defauts.length) {
  process.stderr.write(`\n[lot-a] ÉCHEC — l'état de référence a dérivé (${defauts.length}) :\n`);
  for (const d of defauts) process.stderr.write(`  ${d}\n`);
  process.exit(1);
}
l("");
l("[lot-a] état de référence conforme : 18 pays sans source au référentiel, 18 guides publiés avec liens.");
