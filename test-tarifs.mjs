#!/usr/bin/env node
/**
 * LES CONTRE-ÉPREUVES DU CONTRAT TARIFAIRE.
 *
 *   node --import tsx test-tarifs.mjs              contrat moteur + sources
 *   node --import tsx test-tarifs.mjs --dist=<d>   ajoute le contrôle du DOM construit
 *
 * Ce qu'elles gardent : plus aucun montant ne sort du moteur, plus aucune valeur héritée n'est
 * publiée, et chaque statut affiché nomme SON canal. Les mutations portent sur les données
 * d'entrée et sur le code lui-même — un repli réintroduit doit faire rougir, pas passer.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

const DIST = process.argv.slice(2).find((a) => a.startsWith("--dist="))?.slice(7);

/* ---- 1. LE CODE : le repli ne doit pas pouvoir revenir -------------------------------------- */
{
  const evaluate = readFileSync("packages/engine/src/evaluate.ts", "utf8");
  /* On cherche le repli EXÉCUTABLE, pas sa mention dans le commentaire qui explique sa
     suppression : les lignes de commentaire commencent par « * ». */
  const executable = evaluate.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");
  if (/policy\s*\?\.\[[^\]]+\]\s*\?\.\s*fee\s*\?\?\s*fees/.test(executable)) {
    echec("1 repli vers airline.fees", "le repli « policy?.[canal]?.fee ?? fees?.[canal] » est de retour dans le code exécutable");
  } else ok("1 le repli vers airline.fees n'existe plus dans le code exécutable");

  if (/\bfees\s*\?\./.test(executable) || /\.fees\b/.test(executable)) {
    echec("1bis lecture de airline.fees", "le champ hérité « fees » est lu quelque part dans evaluate.ts");
  } else ok("1bis le champ hérité « fees » n'est plus lu du tout");
}

/* ---- 2. LE CONTRAT : le champ `fee` a disparu, et sa place avec lui ------------------------- */
{
  const contrats = readFileSync("packages/engine/src/contracts.ts", "utf8");
  const executable = contrats.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/)/.test(l)).join("\n");
  if (/^\s*fee\??\s*:/m.test(executable)) echec("2 champ fee au contrat", "un champ « fee » est déclaré dans contracts.ts");
  else ok("2 aucun champ « fee » au contrat du moteur");
  if (!/statuts_tarifaires\??\s*:/.test(executable)) echec("2bis statuts", "le contrat ne déclare pas « statuts_tarifaires »");
  else ok("2bis le contrat porte les statuts tarifaires par canal");
}

/* ---- 3. LE MOTEUR, EXÉCUTÉ : aucun montant, un statut par canal ouvert ---------------------- */
{
  /* LE SEUL CHEMIN D'APPEL AUTORISÉ, comme dans les autres harnais : la base chargée, le
     contrat d'abord, le moteur ensuite. Fabriquer une requête à la main sauterait la validation
     et testerait autre chose que la production. */
  const { loadKB } = await import("./packages/knowledge/src/index.ts");
  const { evaluate } = await import("./packages/engine/src/evaluate.ts");
  const { explain } = await import("./packages/engine/src/explain.ts");
  const { FinderRequest } = await import("./packages/engine/src/contracts.ts");
  let rapport = null;
  try {
    const kb = loadKB();
    /* La forme exacte du contrat : identifiants d'aéroport préfixés, et un chien — sans lui,
       le moteur n'a rien à décider. Un Akita de 38 kg ouvre soute et fret, donc plusieurs
       canaux : c'est le cas qui fait paraître un statut par canal. */
    const decision = evaluate(kb, FinderRequest.parse({
      origin: "airport_cdg", destination: "airport_jfk", dog: { weight_kg: 38 }, locale: "en",
    }));
    rapport = explain(decision, "en");
  } catch (e) { echec("3 moteur", `l'évaluation a échoué : ${e.message}`); }

  if (rapport) {
    const cartes = rapport.airlines ?? [];
    if (!cartes.length) echec("3 moteur", "aucune compagnie rendue — le contrôle ne prouverait rien");
    else {
      const avecMontant = cartes.filter((c) => "fee" in c && c.fee != null);
      if (avecMontant.length) echec("3 montant au rapport", `${avecMontant.length} carte(s) portent encore un champ « fee »`);
      else ok(`3 ${cartes.length} cartes évaluées : aucune ne porte de montant`);

      /* Chaque statut nomme son canal, et aucun ne contient de chiffre monétaire. */
      const CHIFFRE = /[€$£¥]\s*\d|\d+\s*[€$£¥]|\d+\s*(?:eur|usd|gbp)\b/i;
      let statuts = 0, sansCanal = 0, avecChiffre = 0;
      for (const c of cartes) {
        for (const s of c.statuts_tarifaires ?? []) {
          statuts++;
          if (!["cabin", "hold", "cargo"].includes(s.placement)) sansCanal++;
          if (CHIFFRE.test(s.statut)) avecChiffre++;
        }
      }
      if (!statuts) echec("3bis statuts", "aucun statut tarifaire rendu — un contrôle qui ne tourne pas est vert pour rien");
      else if (sansCanal) echec("3bis statuts", `${sansCanal} statut(s) sans canal reconnu`);
      else if (avecChiffre) echec("3bis statuts", `${avecChiffre} statut(s) contiennent un montant`);
      else ok(`3bis ${statuts} statuts rendus, tous attribués à un canal, aucun ne porte de montant`);

      /* Un canal FERMÉ ne porte pas de statut tarifaire : on ne tarife pas ce qu'on refuse. */
      const bavards = cartes.filter((c) => (c.statuts_tarifaires ?? []).some((s) =>
        c[`${s.placement}_status`] === "denied"));
      if (bavards.length) echec("3ter canal fermé", `${bavards.length} carte(s) tarifient un canal refusé`);
      else ok("3ter aucun canal refusé ne porte de statut tarifaire");
    }
  }
}

/* ---- 4. LES VALEURS HÉRITÉES : présentes dans les données, absentes des surfaces ------------ */
{
  const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
  const heritees = new Set();
  for (const a of objets.airlines) {
    for (const v of Object.values(a.fees ?? {})) if (v) heritees.add(String(v).trim());
    for (const p of Object.values(a.premium?.policy ?? {})) if (p?.fee) heritees.add(String(p.fee).trim());
  }
  if (heritees.size < 50) echec("4 dette", `${heritees.size} valeurs héritées relevées — trop peu, la mesure a dû rater quelque chose`);
  else ok(`4 ${heritees.size} valeurs tarifaires héritées vivent encore dans les données — c'est la dette, non publiée`);

  /* Les surfaces ne doivent plus les rendre. Sans dist, on juge le code des surfaces. */
  const surfaces = ["packages/ui/src/components/FlightFinder.astro",
                    "packages/ui/src/components/AirlinePremiumPage.astro",
                    "packages/ui/src/components/EntityPage.astro"];
  let fautives = [];
  for (const f of surfaces) {
    const src = readFileSync(f, "utf8");
    const executable = src.split("\n").filter((l) => !/^\s*(\*|\/\*|\/\/|\{\/\*)/.test(l)).join("\n");
    if (/\ba\.fee\b|\bc\.fee\b|\bpl\.fee\b/.test(executable)) fautives.push(f);
  }
  if (fautives.length) echec("4bis surfaces", `un montant est encore rendu par : ${fautives.join(", ")}`);
  else ok("4bis aucune des trois surfaces ne rend de montant");
}

/* ---- 5. LE DOM CONSTRUIT — le contrôle qui compte vraiment ---------------------------------- */
if (DIST) {
  const pages = [];
  (function marcher(d, base = "") {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const rel = `${base}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== "_astro") marcher(join(d, e.name), rel); }
      else if (e.name.endsWith(".html")) pages.push(rel);
    }
  })(DIST);

  const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
  const heritees = [];
  for (const a of objets.airlines) {
    for (const v of Object.values(a.fees ?? {})) if (v && String(v).trim().length > 3) heritees.push(String(v).trim());
    for (const p of Object.values(a.premium?.policy ?? {})) if (p?.fee && String(p.fee).trim().length > 3) heritees.push(String(p.fee).trim());
  }
  const uniques = [...new Set(heritees)];
  const trouvees = new Map();
  const fiches = pages.filter((p) => /\/airlines\/[^/]+\/index\.html$/.test(p));
  if (fiches.length < 100) echec("5 dist", `${fiches.length} fiches compagnies dans le dist — le contrôle porterait sur trop peu`);
  for (const p of fiches) {
    const html = readFileSync(join(DIST, p), "utf8");
    for (const v of uniques) if (html.includes(v)) trouvees.set(v, (trouvees.get(v) ?? 0) + 1);
  }
  if (trouvees.size) {
    const ex = [...trouvees].slice(0, 3).map(([v, n]) => `« ${v} » sur ${n} page(s)`).join(" ; ");
    echec("5 DOM", `${trouvees.size} valeur(s) héritée(s) servies dans le HTML : ${ex}`);
  } else ok(`5 DOM : aucune des ${uniques.length} valeurs héritées n'apparaît dans les ${fiches.length} fiches construites`);

  /* Les quatre langues portent bien un statut, et pas un mot anglais laissé là. */
  const ATTENDU = { "": "to confirm", "/fr": "à confirmer", "/es": "por confirmar", "/pt": "a confirmar" };
  for (const [prefixe, fragment] of Object.entries(ATTENDU)) {
    const p = `${prefixe}/airlines/air-france/index.html`;
    if (!existsSync(join(DIST, p))) { echec("5bis langues", `${p} absente du dist`); continue; }
    const html = readFileSync(join(DIST, p), "utf8").toLowerCase();
    if (!html.includes(fragment)) echec("5bis langues", `${p} ne porte pas « ${fragment} »`);
  }
  if (defauts === 0 || !Object.keys(ATTENDU).some((k) => false)) ok("5bis les quatre langues portent leur statut tarifaire traduit");
} else {
  console.log("  · 5 contrôle du DOM non joué (aucun --dist=) — il l'est en CI sur le site complet");
}

if (defauts) { console.error(`\n[tarifs] ÉCHEC — ${defauts} contre-épreuve(s) en défaut`); process.exit(1); }
console.log("\n[tarifs] aucun montant ne sort du moteur, aucune valeur héritée n'est publiée, chaque statut nomme son canal.");
