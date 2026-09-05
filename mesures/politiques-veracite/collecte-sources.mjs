#!/usr/bin/env node
/**
 * LE FICHIER DE COLLECTE — pour que la lecture des sources ne recommence pas par un inventaire.
 *
 *   node mesures/politiques-veracite/collecte-sources.mjs [--ecrire]
 *
 * Il produit `collecte-sources.tsv` et `collecte-sources.json`, une ligne par canal à établir, avec
 * le contexte déjà résolu : personne n'a à reconstruire l'appariement depuis `rules.json`.
 *
 * DEUX ENSEMBLES, dans l'ordre de priorité arbitré :
 *   A — les 16 canaux ORPHELINS : un refus publié qu'AUCUNE règle n'accompagne. L'URL est vide,
 *       c'est justement ce qu'il faut trouver ;
 *   B — les 34 refus globaux disposant DÉJÀ d'une page officielle non citée. L'URL est explicite ;
 *       il ne manque que la phrase.
 *
 * LE « FAIT EXACT À ÉTABLIR » est écrit pour chaque ligne, parce qu'une citation collectée sans
 * savoir ce qu'elle doit prouver est une citation qu'il faudra recollecter.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { qualifier } from "./qualifier.mjs";

const ECRIRE = process.argv.includes("--ecrire");
const regles = JSON.parse(readFileSync("packages/knowledge/raw/rules.json", "utf8"));
const par = new Map();
for (const r of regles) if (r?.scope?.type === "airline") {
  if (!par.has(r.scope.id)) par.set(r.scope.id, []);
  par.get(r.scope.id).push(r);
}

/** Ce qu'une citation doit établir, selon la disponibilité publiée et le canal. */
const faitAEtablir = (dispo, canal) => dispo === "not_offered"
  ? `La compagnie n'accepte AUCUN chien en ${canal} — phrase de refus, sans condition de route, de poids ni de saison.`
  : `La compagnie accepte les chiens en ${canal} — phrase d'acceptation, avec ses conditions si elle en pose.`;

const lignes = [];
for (const f of readdirSync("content/airlines").filter((x) => x.endsWith(".yml") && x !== "_template.yml").sort()) {
  const d = YAML.parse(readFileSync(join("content/airlines", f), "utf8"));
  const rs = par.get(d.id) ?? [];
  for (const [canal, p] of Object.entries(d.policies ?? {})) {
    if (p.availability !== "offered" && p.availability !== "not_offered") continue;
    const surLeCanal = rs.filter((r) => (r.effect?.placement ?? []).includes(canal));
    const q = qualifier(p, canal, rs);
    const orphelin = p.availability === "not_offered" && surLeCanal.length === 0;
    if (!orphelin && !(q.ensemble === 1 && q.source)) continue;   // seuls A et B entrent
    lignes.push({
      airline_id: d.id,
      compagnie: d.name,
      canal,
      disponibilite_actuelle: p.availability,
      ensemble: orphelin ? "A — orphelin (aucune règle sur ce canal)" : "B — page officielle non citée",
      url_officielle_candidate: orphelin ? "" : q.source.url,
      fait_exact_a_etablir: faitAEtablir(p.availability, canal),
      rule_id: orphelin ? "" : (rs.find((r) => r.source?.url === q.source.url)?.id ?? ""),
    });
  }
}
/* A d'abord : c'est là qu'on ne sait rien du tout. */
lignes.sort((x, y) => x.ensemble.localeCompare(y.ensemble) || x.compagnie.localeCompare(y.compagnie) || x.canal.localeCompare(y.canal));

const COLONNES = ["airline_id", "compagnie", "canal", "disponibilite_actuelle", "ensemble",
  "url_officielle_candidate", "fait_exact_a_etablir", "rule_id"];
const tsv = [COLONNES.join("\t"), ...lignes.map((l) => COLONNES.map((c) => String(l[c]).replace(/\t/g, " ")).join("\t"))].join("\n") + "\n";
const json = JSON.stringify({
  _quoi: "Canaux dont une citation officielle est attendue, par ordre de priorité arbitré.",
  _format_attendu_en_retour: "url · phrase exacte (verbatim) · langue (BCP-47) · emplacement dans la page (locator) · date de lecture",
  _rappel: "Une citation reconstruite depuis un résumé n'est pas une citation. Seul le texte lu sur la page compte.",
  totaux: { A: lignes.filter((l) => l.ensemble.startsWith("A")).length, B: lignes.filter((l) => l.ensemble.startsWith("B")).length },
  lignes,
}, null, 1) + "\n";

if (ECRIRE) {
  writeFileSync("mesures/politiques-veracite/collecte-sources.tsv", tsv);
  writeFileSync("mesures/politiques-veracite/collecte-sources.json", json);
}
console.log(`${lignes.length} ligne(s) — A (orphelins) : ${lignes.filter((l) => l.ensemble.startsWith("A")).length}`
  + ` · B (page non citée) : ${lignes.filter((l) => l.ensemble.startsWith("B")).length}`);
console.log(ECRIRE ? "écrits : collecte-sources.tsv et collecte-sources.json" : "(essai à blanc — --ecrire pour produire les fichiers)");
