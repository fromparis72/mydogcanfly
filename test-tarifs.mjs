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

  const { loadKB } = await import("./packages/knowledge/src/index.ts");
  const kb = loadKB();
  /** Le statut CANONIQUE d'un canal, lu dans la base normalisée — jamais deviné d'un booléen. */
  const statutDe = (slug, canal) => {
    const air = [...kb.airlines.values()].find((x) => x.id === `airline_${slug.replace(/-/g, "_")}`);
    const p = air?.premium?.policy?.[canal];
    return p ? (p.status ?? (p.allowed ? "allowed" : "denied")) : null;
  };
  /**
   * LE BLOC D'UN CANAL S'ARRÊTE AU CANAL SUIVANT. Une première rédaction cherchait
   * « </div></div> », qui tombait au-delà du bloc voisin : un canal REFUSÉ paraissait alors
   * porter la ligne tarifaire de la soute qui le suivait. Faux positif de contrôle, pas défaut du
   * site — la faute est nommée pour qu'on ne « corrige » pas le site sur un mauvais relevé.
   */
  const blocDuCanal = (html, canal) => {
    const i = html.indexOf(`data-placement="${canal}"`);
    if (i < 0) return null;
    const debut = html.lastIndexOf("<div", i);
    const suivant = html.indexOf("data-placement=", i + 1);
    const fin = suivant < 0 ? html.length : html.lastIndexOf("<div", suivant);
    return debut < 0 ? null : html.slice(debut, fin);
  };

  const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
  const heritees = [];
  for (const a of objets.airlines) {
    for (const v of Object.values(a.fees ?? {})) if (v && String(v).trim().length > 3) heritees.push(String(v).trim());
    for (const p of Object.values(a.premium?.policy ?? {})) if (p?.fee && String(p.fee).trim().length > 3) heritees.push(String(p.fee).trim());
  }
  const uniques = [...new Set(heritees)];
  const trouvees = new Map();
  const fiches = pages.filter((p) => /\/airlines\/[^/]+\/index\.html$/.test(p));
  /* Pas de seuil arbitraire : un build réduit porte trois compagnies et reste un terrain valable.
     Ce qui est exigé plus bas, c'est que les trois ÉTATS soient rencontrés. */
  if (!fiches.length) echec("5 dist", "aucune fiche compagnie dans le dist");
  for (const p of fiches) {
    const html = readFileSync(join(DIST, p), "utf8");
    for (const v of uniques) if (html.includes(v)) trouvees.set(v, (trouvees.get(v) ?? 0) + 1);
  }
  if (trouvees.size) {
    const ex = [...trouvees].slice(0, 3).map(([v, n]) => `« ${v} » sur ${n} page(s)`).join(" ; ");
    echec("5 DOM", `${trouvees.size} valeur(s) héritée(s) servies dans le HTML : ${ex}`);
  } else ok(`5 DOM : aucune des ${uniques.length} valeurs héritées n'apparaît dans les ${fiches.length} fiches construites`);

  /* ON NE TARIFE PAS UN CANAL QU'ON REFUSE — jugé dans le HTML SERVI, pas dans le code. Les
     témoins se choisissent parmi les fiches réellement construites : un slug codé en dur devient
     faux au premier build réduit. */
  {
    const slugs = fiches.map((p) => p.split("/")[2]);
    const chercher = (voulu) => {
      for (const slug of slugs) for (const canal of ["cabin", "hold", "cargo"]) {
        if (statutDe(slug, canal) === voulu) return [slug, canal];
      }
      return null;
    };
    const refuse = chercher("denied");
    const aConfirmer = chercher("confirmation_required");
    if (!refuse) echec("5ter canal refusé", `aucun canal « denied » parmi les ${slugs.length} fiches du dist`);
    if (!aConfirmer) echec("5ter canal à confirmer", `aucun canal « confirmation_required » parmi les ${slugs.length} fiches du dist`);
    const STATUTS = ["Fee to confirm", "Fee to request"];
    for (const [cas, doitTarifer] of [[refuse, false], [aConfirmer, true]]) {
      if (!cas) continue;
      const [slug, canal] = cas;
      const html = readFileSync(join(DIST, `/airlines/${slug}/index.html`), "utf8");
      const bloc = blocDuCanal(html, canal);
      if (!bloc) { echec("5ter bloc", `${slug} : aucun bloc « ${canal} » — la fiche a changé de forme`); continue; }
      const tarife = STATUTS.some((s) => bloc.includes(s));
      if (doitTarifer && !tarife) echec("5ter canal à confirmer", `${slug}/${canal} : un canal « à confirmer » doit porter son statut tarifaire prudent`);
      else if (!doitTarifer && tarife) echec("5ter canal refusé", `${slug}/${canal} : un canal REFUSÉ porte une ligne tarifaire`);
      else ok(`5ter ${slug} / ${canal} (${doitTarifer ? "à confirmer" : "refusé"}) : ${tarife ? "statut présent" : "aucune ligne tarifaire"} — conforme`);
    }
  }

  /* LA PASTILLE DIT LES TROIS ÉTATS. Elle se lisait sur le seul booléen `allowed` : une politique
     « à confirmer » porte allowed=false, la page annonçait donc « non accepté » puis affichait
     juste dessous « Tarif à confirmer ». Contradiction publique, née d'un booléen là où la donnée
     en dit trois. */
  {
    /* LES LIBELLÉS CANONIQUES, ceux que `cleLibelleStatut` publie — pas une liste réécrite ici :
       le contrôle doit lire ce que la production dit, sinon il juge autre chose. */
    const LIBELLES = { allowed: "Accepted", confirmation_required: "Policy to confirm with the airline", denied: "Not accepted" };
    const vus = new Set();
    for (const p of fiches) {
      const slug = p.split("/")[2];
      const html = readFileSync(join(DIST, p), "utf8");
      for (const canal of ["cabin", "hold", "cargo"]) {
        const st = statutDe(slug, canal);
        if (!st || !LIBELLES[st]) continue;
        const bloc = blocDuCanal(html, canal);
        if (!bloc) continue;
        const attendu = LIBELLES[st];
        if (!bloc.includes(attendu)) { echec("5quater pastille", `${slug}/${canal} (${st}) : le libellé « ${attendu} » est absent de son bloc`); continue; }
        const intrus = Object.entries(LIBELLES).filter(([k, v]) => k !== st && v !== attendu && !attendu.includes(v) && bloc.includes(v));
        if (intrus.length) echec("5quater pastille", `${slug}/${canal} (${st}) : le bloc porte AUSSI « ${intrus[0][1]} »`);
        else vus.add(st);
      }
    }
    const manquants = Object.keys(LIBELLES).filter((s) => !vus.has(s));
    if (manquants.length) echec("5quater couverture", `états jamais rencontrés : ${manquants.join(", ")} — le contrôle serait vert faute de matière`);
    else ok("5quater la pastille dit les trois états, chacun rencontré dans le HTML construit");
  }

  /* Les quatre langues portent bien un statut, et pas un mot anglais laissé là. */
  const ATTENDU = { "": "to confirm", "/fr": "à confirmer", "/es": "por confirmar", "/pt": "a confirmar" };
  let langues = 0;
  for (const [prefixe, fragment] of Object.entries(ATTENDU)) {
    const p = `${prefixe}/airlines/aegean/index.html`;
    if (!existsSync(join(DIST, p))) { echec("5bis langues", `${p} absente du dist`); continue; }
    if (!readFileSync(join(DIST, p), "utf8").toLowerCase().includes(fragment)) echec("5bis langues", `${p} ne porte pas « ${fragment} »`);
    else langues++;
  }
  if (langues === 4) ok("5bis les quatre langues portent leur statut tarifaire traduit");
} else {
  console.log("  · 5 contrôle du DOM non joué (aucun --dist=) — il l'est en CI sur le site complet");
}

if (defauts) { console.error(`\n[tarifs] ÉCHEC — ${defauts} contre-épreuve(s) en défaut`); process.exit(1); }
console.log("\n[tarifs] aucun montant ne sort du moteur, aucune valeur héritée n'est publiée, chaque statut nomme son canal.");
