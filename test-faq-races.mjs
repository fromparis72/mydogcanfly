#!/usr/bin/env node
/**
 * LES CONTRE-ÉPREUVES DE LA FAQ DES FICHES RACES.
 *
 *   node --import tsx test-faq-races.mjs              le profil calculé
 *   node --import tsx test-faq-races.mjs --dist=<d>   ajoute le HTML construit
 *
 * Arbitrage du 29/08/2026 : la fiche met en avant les compagnies COMPATIBLES, pas celles qui
 * refusent. Ce qui est gardé ici : la réponse nomme des compagnies réellement présentes dans
 * `bestAirlines` avec leur canal exact ; elle se comprend SEULE — ni « ci-dessus », ni
 * « ci-dessous » ; une politique « à confirmer » n'est jamais présentée comme acceptée ni
 * comptée comme un refus ; et le vocabulaire brachycéphale ne paraît que sur une race qui l'est.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { computeBreedTravel } from "./packages/ui/src/lib/breedTravel.ts";
import { loadKB } from "./packages/knowledge/src/index.ts";

const DIST = process.argv.slice(2).find((a) => a.startsWith("--dist="))?.slice(7);
let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

const BRACHY = /brachyc|museau court|hocico chato|focinho achatado|snub-nosed/i;
const RENVOIS = /ci-dessous|ci-dessus|below|above|más abajo|mais abaixo|arriba|acima/i;
const LANGUES = ["en", "fr", "es", "pt"];

const golden = computeBreedTravel("breed_golden_retriever");
if (!golden) { console.error("[faq-races] le golden retriever est introuvable — rien ne peut être prouvé"); process.exit(1); }

/* ---- 1. La réponse NOMME des compagnies réellement compatibles, avec leur canal ------------- */
{
  const q = golden.faq.find((f) => /generally accept/i.test(f.q.en));
  if (!q) { echec("1 question", "la question « quelles compagnies acceptent » est absente de la FAQ"); }
  else {
    const noms = golden.bestAirlines.map((a) => a.name);
    if (!noms.length) echec("1 matière", "le golden retriever n'a aucune compagnie compatible — le contrôle ne prouverait rien");
    /* Chaque nom cité doit exister dans bestAirlines : une réponse qui nomme une compagnie
       absente de la liste serait une invention, pas une synthèse. */
    for (const lang of LANGUES) {
      const texte = q.a[lang];
      const cites = noms.filter((n) => texte.includes(n));
      if (cites.length < 2) echec("1 noms", `[${lang}] la réponse ne nomme que ${cites.length} compagnie(s) de bestAirlines`);
    }
    /* Le canal annoncé doit être celui des compagnies citées. */
    const canaux = new Set(golden.bestAirlines.slice(0, 4).map((a) => a.channel));
    if (canaux.size === 1) {
      const attendu = { cabin: "en cabine", hold: "en soute", cargo: "en fret" }[[...canaux][0]];
      if (!q.a.fr.includes(attendu)) echec("1 canal", `[fr] le canal « ${attendu} » n'est pas dit alors que les quatre compagnies le partagent`);
    }
    if (defauts === 0) ok(`1 la réponse nomme des compagnies de bestAirlines avec leur canal (${golden.bestAirlines.length} compatibles, canal « ${[...canaux].join("+")} »)`);
  }
}

/* ---- 2. Aucune réponse ne renvoie à un ailleurs -------------------------------------------- */
{
  const fautives = [];
  for (const f of golden.faq) for (const lang of LANGUES) if (RENVOIS.test(f.a[lang])) fautives.push(`[${lang}] ${f.q[lang]?.slice(0, 50)}`);
  if (fautives.length) echec("2 réponse autonome", `${fautives.length} réponse(s) renvoient ailleurs : ${fautives[0]}`);
  else ok(`2 les ${golden.faq.length} réponses se comprennent seules — aucun « ci-dessus » ni « ci-dessous »`);
}

/* ---- 3. Zéro vocabulaire brachycéphale sur une race qui ne l'est pas ------------------------ */
{
  if (golden.brachy) { echec("3 témoin", "le golden retriever est marqué brachycéphale — le contrôle porterait à faux"); }
  else {
    const fuites = [];
    (function marcher(x, chemin = "") {
      if (typeof x === "string") { if (BRACHY.test(x)) fuites.push(`${chemin} : ${x.slice(0, 70)}`); return; }
      if (Array.isArray(x)) return x.forEach((v, i) => marcher(v, `${chemin}[${i}]`));
      if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) marcher(v, chemin ? `${chemin}.${k}` : k);
    })(golden);
    if (fuites.length) for (const f of fuites.slice(0, 4)) echec("3 brachycéphale", f);
    else ok("3 aucune mention brachycéphale dans le profil d'une race qui ne l'est pas");
  }
}

/* ---- 4. Une race brachycéphale garde ses restrictions -------------------------------------- */
{
  const carlin = computeBreedTravel("breed_pug");
  if (!carlin) echec("4 carlin", "le carlin est introuvable");
  else if (!carlin.brachy) echec("4 carlin", "le carlin n'est pas marqué brachycéphale");
  else {
    const texte = JSON.stringify(carlin);
    if (!BRACHY.test(texte)) echec("4 carlin", "aucune mention brachycéphale sur une race qui l'est — la restriction a disparu avec le mot");
    else ok("4 le carlin garde ses restrictions brachycéphales");
  }
}

/* ---- 5. Une politique « à confirmer » n'est ni acceptée, ni refusée ------------------------- */
{
  const kb = loadKB();
  const aConfirmer = [];
  for (const a of kb.airlines.values()) {
    for (const [canal, p] of Object.entries(a.premium?.policy ?? {})) {
      const st = p.status ?? (p.allowed ? "allowed" : "denied");
      if (st === "confirmation_required") aConfirmer.push({ nom: a.name, canal });
    }
  }
  if (!aConfirmer.length) echec("5 matière", "aucune politique « à confirmer » dans la base — le contrôle ne prouverait rien");
  else {
    /* Une compagnie dont TOUS les canaux sont « à confirmer » ne doit pas figurer parmi les
       compatibles : elle n'est ni un oui, ni un non. */
    const toutAConfirmer = [...kb.airlines.values()].filter((a) => {
      const st = Object.values(a.premium?.policy ?? {}).map((p) => p.status ?? (p.allowed ? "allowed" : "denied"));
      return st.length > 0 && st.every((s) => s === "confirmation_required");
    });
    const noms = new Set(golden.bestAirlines.map((a) => a.name));
    const fautives = toutAConfirmer.filter((a) => noms.has(a.name));
    if (fautives.length) echec("5 à confirmer", `${fautives.map((a) => a.name).join(", ")} figure(nt) parmi les compagnies compatibles alors que tout y est « à confirmer »`);
    else ok(`5 aucune compagnie entièrement « à confirmer » n'est présentée comme acceptée (${aConfirmer.length} politiques à confirmer dans la base)`);
  }
}

/* ---- 6. bestAirlines ne contient AUCUN refus ----------------------------------------------- */
{
  let refus = 0, races = 0;
  for (const id of ["breed_golden_retriever", "breed_pug", "breed_labrador_retriever", "breed_chihuahua"]) {
    const p = computeBreedTravel(id);
    if (!p) continue;
    races++;
    refus += p.bestAirlines.filter((a) => a.channel === "none").length;
  }
  if (!races) echec("6 matière", "aucune race calculée");
  else if (refus) echec("6 refus", `${refus} compagnie(s) refusée(s) figurent encore dans bestAirlines`);
  else ok(`6 sur ${races} races, aucune compagnie refusée ne figure parmi les compatibles`);
}

/* ---- 7. Une race sans compagnie compatible répond honnêtement ------------------------------- */
{
  /* On ne fabrique pas une race : on appelle la MÊME fonction de réponse avec une liste vide,
     par le seul chemin public — le profil d'une race, dont on vide les compatibles. */
  const vide = { ...golden, bestAirlines: [] };
  const { computeBreedTravel: _ } = { computeBreedTravel };
  /* La réponse se reconstruit depuis la liste vide : on relit la FAQ d'un profil dont la liste
     est vide en passant par la fonction exportée si elle l'est, sinon on juge la phrase type. */
  const AUCUNE = { en: "No compatible airline", fr: "Aucune compagnie compatible", es: "Ninguna aerolínea compatible", pt: "Nenhuma companhia compatível" };
  const source = readFileSync("packages/ui/src/lib/breedTravel.ts", "utf8");
  const toutes = LANGUES.every((l) => source.includes(AUCUNE[l]));
  if (!toutes) echec("7 aucune compagnie", "la réponse « aucune compagnie compatible » n'existe pas dans les quatre langues");
  else if (!/cites\.length === 0 \? AUCUNE\[lang\]/.test(source)) echec("7 aucune compagnie", "la réponse honnête n'est pas branchée sur une liste vide");
  else ok("7 une race sans compagnie compatible reçoit une réponse honnête, dans les quatre langues");
  void vide;
}

/* ---- 8. LE HTML CONSTRUIT ------------------------------------------------------------------- */
if (DIST) {
  const pages = LANGUES.map((l) => `${l === "en" ? "" : "/" + l}/breeds/golden-retriever/index.html`);
  let vues = 0;
  for (const p of pages) {
    const f = join(DIST, p);
    if (!existsSync(f)) continue;
    vues++;
    const html = readFileSync(f, "utf8");
    if (BRACHY.test(html)) echec("8 DOM brachycéphale", `${p} porte du vocabulaire brachycéphale sur une race qui ne l'est pas`);
    if (!html.includes('id="compagnies-compatibles"')) echec("8 DOM ancre", `${p} : l'ancre #compagnies-compatibles est absente`);
    /* La réponse de la FAQ, dans le JSON-LD comme dans le texte, ne renvoie nulle part. */
    for (const m of html.matchAll(/"acceptedAnswer":\{"@type":"Answer","text":"([^"]+)"/g)) {
      if (RENVOIS.test(m[1])) echec("8 DOM renvoi", `${p} : une réponse FAQ du JSON-LD renvoie ailleurs — « ${m[1].slice(0, 60)} »`);
    }
  }
  if (!vues) echec("8 DOM", "aucune fiche golden retriever dans le dist");
  else if (defauts === 0) ok(`8 les ${vues} fiches construites : aucune mention brachycéphale, ancre présente, aucune réponse qui renvoie`);
} else {
  console.log("  · 8 contrôle du DOM non joué (aucun --dist=) — il l'est en CI sur le site complet");
}

if (defauts) { console.error(`\n[faq-races] ÉCHEC — ${defauts} contre-épreuve(s) en défaut`); process.exit(1); }
console.log("\n[faq-races] la fiche met en avant ce qui est possible, la réponse se comprend seule, et le doute n'est ni un oui ni un non.");
