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
import { JSDOM } from "jsdom";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { compter } from "./test-lib/montants.mjs";

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
  const politiqueDe = (slug, canal) => {
    const air = [...kb.airlines.values()].find((x) => x.id === `airline_${slug.replace(/-/g, "_")}`);
    return air?.premium?.policy?.[canal] ?? null;
  };
  const statutDe = (slug, canal) => {
    const p = politiqueDe(slug, canal);
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
  /* UNE VALEUR HÉRITÉE N'EST PAS FORCÉMENT UN PRIX, ET LA PREMIÈRE RÉDACTION LE SUPPOSAIT.
   * Ce contrôle cherchait dans le HTML la CHAÎNE de chaque champ `fee` hérité, quelle qu'elle
   * soit. Or onze de ces champs ne portent aucun chiffre : « via Virgin Australia Cargo »,
   * « excess-baggage rate », « via IAG Cargo (quote) »… Ce sont des faits de transport, écrits
   * ailleurs dans la fiche parce qu'ils y sont vrais et utiles. Le contrôle les comptait comme
   * des prix servis et rougissait sur deux d'entre eux — un faux positif de contrôle, pas un
   * défaut du site, et l'arbitrage du 31/08/2026 a tranché : la phrase de Virgin Australia reste.
   *
   * ON REMPLACE DONC LE SUBSTITUT PAR LA CHOSE MESURÉE. Ce qui est interdit, c'est un PRIX ; on
   * ne garde ici que les valeurs héritées qui en portent un, au sens du détecteur partagé. Les
   * autres sont mises de côté, comptées et nommées ci-dessous plutôt que tues. La garantie au
   * niveau du chiffre — quelle que soit la formulation, connue ou non — n'est pas perdue pour
   * autant : elle est tenue par `test-montants-publies.mjs`, qui juge la FORME sur les quatre
   * zones publiques de chaque fiche, et non l'identité d'une chaîne. */
  const toutes = [...new Set(heritees)];
  const uniques = toutes.filter((v) => compter(v) > 0);
  const qualitatives = toutes.filter((v) => compter(v) === 0);
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
  } else ok(`5 DOM : aucune des ${uniques.length} valeurs héritées CHIFFRÉES n'apparaît dans les `
    + `${fiches.length} fiches construites (${qualitatives.length} valeurs héritées sans chiffre écartées : `
    + `${qualitatives.slice(0, 3).map((v) => `« ${v} »`).join(", ")}…)`);

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
    /* LA PASTILLE, ET ELLE SEULE — PARSÉE, JAMAIS DÉCOUPÉE AU TEXTE.
     *
     * PREMIÈRE RÉDACTION FAUTIVE, NOMMÉE, et découverte par la CI et non par moi : elle cherchait
     * les trois libellés d'état dans TOUT le bloc du canal, conditions comprises. Dix-huit
     * contre-épreuves rougissaient donc sur des pages parfaitement correctes. Vérifié à la main
     * sur le dist : Turkish cargo porte `data-status="allowed"` et une pastille « Accepted » ;
     * son « Not accepted » vit dans les conditions de races, où il est parfaitement légitime.
     * Virgin Australia cabine porte « Policy to confirm… » et emploie « Accepted » dans son texte
     * explicatif. Aucun défaut public : un défaut de MON contrôle, qui confondait la pastille
     * avec la prose qui l'entoure.
     *
     * Le gabarit isole pourtant la pastille exactement — `.mini[data-placement][data-status]`,
     * puis `.t .pill`. On la sélectionne donc, au lieu de deviner ses bornes. */
    const LIBELLES = { allowed: "Accepted", confirmation_required: "Policy to confirm with the airline", denied: "Not accepted" };
    const vus = new Set();
    let absencesLegitimes = 0;
    for (const p of fiches) {
      const slug = p.split("/")[2];
      /* LA FENÊTRE EST FERMÉE EN FIN DE TOUR (voir plus bas). Sans cela, 408 arbres jsdom
         restent vivants et ce contrôle meurt d'un dépassement de tas sur un coureur de CI —
         il l'a fait, avec un `core dumped`, et ma machine avait assez de mémoire pour me le
         cacher. */
      const dom = new JSDOM(readFileSync(join(DIST, p), "utf8"));
      const doc = dom.window.document;
      for (const canal of ["cabin", "hold", "cargo"]) {
        const st = statutDe(slug, canal);
        if (!st || !LIBELLES[st]) continue;
        const minis = doc.querySelectorAll(`.mini[data-placement="${canal}"]`);
        /* UN CANAL PEUT LÉGITIMEMENT N'AVOIR AUCUN BLOC — mais à une seule condition. La fiche ne
           publie que ses propres canaux ; ceux dont la politique est HÉRITÉE ET NON REVÉRIFIÉE
           (`legacy_unreviewed`) n'y figurent pas, conformément à l'arbitrage : une donnée héritée
           non revérifiée ne devient pas une affirmation publique. Ma rédaction précédente exigeait
           un bloc pour CHAQUE canal de la base, et rougissait donc sur quatre absences correctes.
           L'absence reste interdite pour toute autre cause : un canal réellement publié qui
           disparaîtrait ferait toujours rougir. */
        if (minis.length === 0) {
          const cause = politiqueDe(slug, canal)?.status_cause;
          if (cause === "legacy_unreviewed") { absencesLegitimes++; continue; }
          echec("5quater pastille", `${slug}/${canal} (${st}) : aucun bloc, et la cause est « ${cause ?? "aucune"} », pas « legacy_unreviewed »`);
          continue;
        }
        if (minis.length !== 1) { echec("5quater pastille", `${slug}/${canal} : ${minis.length} blocs au lieu d'un`); continue; }
        const mini = minis[0];
        /* Le statut CANONIQUE est porté par le DOM : la page ne peut pas dire autre chose que
           ce que la donnée décide. */
        if (mini.getAttribute("data-status") !== st) {
          echec("5quater pastille", `${slug}/${canal} : data-status « ${mini.getAttribute("data-status")} » au lieu de « ${st} »`); continue;
        }
        const pills = mini.querySelectorAll(".t .pill");
        if (pills.length !== 1) { echec("5quater pastille", `${slug}/${canal} : ${pills.length} pastille(s) au lieu d'une`); continue; }
        const texte = pills[0].textContent.trim();
        if (texte !== LIBELLES[st]) {
          echec("5quater pastille", `${slug}/${canal} (${st}) : la pastille dit « ${texte} » au lieu de « ${LIBELLES[st]} »`); continue;
        }
        vus.add(st);
      }
      dom.window.close();
    }
    /* ── MOUVEMENT NOMMÉ (05/09/2026) — LA COUVERTURE SE MESURE SUR LA DONNÉE, PAS SUR UN VŒU ──
     *
     * Cette contre-épreuve exigeait que les TROIS états soient rencontrés dans le HTML : sans
     * quoi elle serait « verte faute de matière ». L'intention est juste et elle est conservée.
     * Mais depuis la frontière de confiance, `allowed` n'a plus AUCUN porteur — aucune des 302
     * politiques ne l'est, `denied` ne s'obtenant que sur une phrase citée. Exiger sa présence
     * dans le DOM, c'est exiger que la base affirme quelque chose qu'elle ne peut plus prouver :
     * la seule façon de faire reverdir le contrôle serait de RE-PUBLIER une acceptation non
     * prouvée. Un contrôle qui pousse à cela travaille contre ce qu'il protège.
     *
     * On mesure donc les états RÉELLEMENT présents dans la base, et on exige exactement ceux-là
     * dans le HTML construit. La garantie ne baisse pas, elle se déplace au bon endroit :
     *   · un état porté par la donnée et absent du DOM fait toujours rougir ;
     *   · l'absence d'`allowed` est EXPLIQUÉE par une mesure, jamais tolérée par principe ;
     *   · le jour où une citation rendra un canal `allowed`, il rentrera de lui-même dans les
     *     états attendus et devra reparaître dans le DOM — le contrôle se réarme seul.
     * Et la couverture ne peut pas tomber à zéro sans être vue. */
    const etatsEnBase = new Set();
    for (const air of kb.airlines.values()) {
      for (const canal of ["cabin", "hold", "cargo"]) {
        const st = air?.premium?.policy?.[canal]?.status;
        if (st && LIBELLES[st]) etatsEnBase.add(st);
      }
    }
    const manquants = [...etatsEnBase].filter((s) => !vus.has(s));
    const sansPorteur = Object.keys(LIBELLES).filter((s) => !etatsEnBase.has(s));
    if (etatsEnBase.size < 2) {
      echec("5quater couverture", `la base ne porte que ${etatsEnBase.size} état(s) — le contrôle n'a plus de matière`);
    } else if (manquants.length) {
      echec("5quater couverture", `états portés par la base mais jamais rendus : ${manquants.join(", ")}`);
    } else {
      ok(`5quater la pastille dit les ${vus.size} état(s) que la base porte, chacun rencontré dans le HTML construit`
        + `${sansPorteur.length ? ` — « ${sansPorteur.join(", ")} » n'a AUCUN porteur depuis la frontière de confiance, absence mesurée et non supposée` : ""}`
        + ` (${absencesLegitimes} canal/canaux hérités non revérifiés, légitimement absents)`);
    }
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
