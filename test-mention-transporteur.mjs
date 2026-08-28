#!/usr/bin/env node
/**
 * Harnais de la mention « transporteur effectif » (G minimal, arbitrage Codex 28/08/2026).
 *
 *   node test-mention-transporteur.mjs
 *
 * La formulation retenue commence par ce que le modèle SAIT dire (« en partage de code, la
 * compagnie qui vend peut différer de celle qui opère ») — jamais par une identification que
 * le modèle ne porte pas (il ne connaît ni marketing_carrier, ni operating_carrier). Ce
 * harnais garantit :
 *   1. la présence des QUATRE traductions au lexique, chacune avec sa mention « opéré par » ;
 *   2. leur affichage effectif : le Flight Finder (sous les résultats) et la fiche compagnie
 *      (bloc source) référencent la clé — la retirer d'un des deux rougit ;
 *   3. qu'aucune traduction n'affirme identifier le vendeur ou l'opérateur d'un vol donné.
 */
import { readFileSync } from "node:fs";

let defauts = 0;
const echec = (cas, detail) => { defauts++; console.error(`  ✗ ${cas} — ${detail}`); };
const ok = (cas) => console.log(`  ✓ ${cas}`);

const CLE = "codeshare.notice";
const MARQUEURS = {
  en: ["codeshare", "operating carrier", "“operated by”"],
  fr: ["partage de code", "transporteur effectif", "« opéré par »"],
  es: ["código compartido", "operador efectivo", "« operado por »"],
  pt: ["codeshare", "transportadora efetiva", "« operado por »"],
};

/* ---- 1. les quatre traductions existent, chacune avec ses marqueurs ------------------------- */
{
  let d0 = defauts;
  for (const [lang, marqueurs] of Object.entries(MARQUEURS)) {
    const chemin = `packages/knowledge/translations/${lang}/strings.json`;
    const s = JSON.parse(readFileSync(chemin, "utf-8"));
    const texte = s[CLE];
    if (!texte || texte.length < 40) { echec("1 lexiques", `${lang} : « ${CLE} » absente ou trop courte`); continue; }
    for (const m of marqueurs) if (!texte.includes(m)) echec("1 lexiques", `${lang} : « ${m} » manque à la mention`);
  }
  if (defauts === d0) ok("1 les quatre traductions portent la mention et son « opéré par »");
}

/* ---- 2. les deux surfaces référencent la clé ------------------------------------------------ */
{
  let d0 = defauts;
  for (const [surface, chemin] of [
    ["Flight Finder", "packages/ui/src/components/FlightFinder.astro"],
    ["fiche compagnie", "packages/ui/src/components/AirlinePremiumPage.astro"],
  ]) {
    if (!readFileSync(chemin, "utf-8").includes(CLE)) echec("2 surfaces", `${surface} ne référence plus « ${CLE} »`);
  }
  if (defauts === d0) ok("2 Flight Finder et fiche compagnie affichent la mention");
}

/* ---- 3. la mention ne prétend jamais identifier le vendeur ou l'opérateur ------------------- */
{
  let d0 = defauts;
  const INTERDITS = [/this flight is operated by/i, /ce vol est opéré par [A-Z]/, /we identify the operating/i];
  for (const lang of Object.keys(MARQUEURS)) {
    const s = JSON.parse(readFileSync(`packages/knowledge/translations/${lang}/strings.json`, "utf-8"));
    for (const motif of INTERDITS) if (motif.test(s[CLE] ?? "")) echec("3 sobriété", `${lang} : la mention prétend identifier l'opérateur (${motif})`);
  }
  if (defauts === d0) ok("3 la mention renvoie le lecteur au « opéré par » de sa réservation, sans prétendre le connaître");
}

if (defauts) { console.error(`\n[transporteur] ÉCHEC — ${defauts} défaut(s)`); process.exit(1); }
console.log("\n[transporteur] la mention dit ce que le modèle ne couvre pas — dans les quatre langues, aux deux surfaces.");
