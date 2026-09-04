#!/usr/bin/env node
/**
 * LE LOT PILOTE — CE QUE LE SITE AFFIRME AUJOURD'HUI, CANAL PAR CANAL, POUR QUATRE COMPAGNIES.
 *
 * Gulf Air, Kenya Airways, South African Airways, TUI Airways : les quatre dont un refus
 * catégorique est publié sans qu'aucune règle ne le fonde. Cette matrice n'affirme RIEN de vrai ;
 * elle expose exactement ce qui est publié, avec sa portée déclarée et sa provenance déclarée,
 * pour que la confrontation aux pages officielles porte sur des phrases précises et non sur une
 * impression. C'est l'entrée du travail de Codex, pas sa conclusion.
 *
 * LA PORTÉE EST LE PIÈGE PRINCIPAL. Une politique peut valoir pour un pays d'immatriculation, une
 * région, un type d'appareil ou une classe commerciale. Le site publie des verdicts sans portée :
 * la colonne « portée déclarée » est donc presque toujours vide, et c'est le constat.
 */
import { readFileSync } from "node:fs";
import YAML from "yaml";

const PILOTE = ["gulf_air", "kenya_airways", "south_african_airways", "tui_airways"];
const regles = JSON.parse(readFileSync("packages/knowledge/raw/rules.json", "utf8"));
const PORTEE = /(only|uniquement|solo|somente|route|destination|from |to |depuis|vers|domestic|international|intra|hors|except|sauf)/i;

for (const cle of PILOTE) {
  let d;
  try { d = YAML.parse(readFileSync(`content/airlines/${cle}.yml`, "utf8")); }
  catch { console.log(`\n### ${cle} — FICHE INTROUVABLE\n`); continue; }
  const regs = regles.filter((r) => r?.scope?.type === "airline" && r.scope.id === d.id);
  console.log(`\n### ${d.name}  (${d.mono})   fiche vérifiée le ${d.verified_date ?? "—"}`);
  console.log(`    provenance déclarée au visiteur : « ${(d.sources?.en ?? "—").trim()} »`);
  console.log(`    règles dans le dépôt : ${regs.length}`);
  for (const ch of d.channels ?? []) {
    const det = (ch.detail?.en ?? "").trim();
    const pert = regs.filter((r) => (r.effect?.placement ?? []).includes(ch.placement));
    console.log(`\n  ┌ ${ch.placement.toUpperCase()} — « ${(ch.statusLabel?.en ?? "").trim()} »  (cls: ${ch.cls})`);
    console.log(`  │ affirmé : ${det.slice(0, 200)}${det.length > 200 ? "…" : ""}`);
    console.log(`  │ tarif publié : ${(ch.fee?.en ?? "—").trim()}`);
    console.log(`  │ portée déclarée : ${PORTEE.test(det) ? "évoquée dans le texte, jamais structurée" : "AUCUNE"}`);
    if (!pert.length) console.log(`  └ preuve : AUCUNE RÈGLE ne nomme ce canal`);
    else for (const r of pert) {
      const s = r.source ?? {};
      console.log(`  └ règle ${r.id} · ${r.effect?.action} · ${s.source_type} · ${s.verified_date}`);
      console.log(`      url : ${s.url}`);
      console.log(`      citation : ${s.quote ? `« ${s.quote} »` : "AUCUNE"}   locator : ${s.locator ?? "AUCUN"}`);
    }
  }
}
console.log(`\n— CE QUI MANQUE POUR CHAQUE FAIT, ET QUE SEUL UN ACCÈS AUX PAGES OFFICIELLES DONNE —`);
console.log(`  la citation verbatim, sa langue, son locator, l'URL finale, le statut HTTP,`);
console.log(`  et la portée réelle : géographique, commerciale, par appareil, par saison.`);
