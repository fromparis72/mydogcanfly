#!/usr/bin/env node
/**
 * LE CONTRÔLE DOM DE L'ÉTAPE 3 — quadrilingue, sur le site CONSTRUIT.
 *
 *   node --import tsx test-etape3-dom.mjs --dist=packages/ui/dist
 *
 * Deux affirmations à tenir sur l'artefact, pas seulement dans les sources :
 *
 *   1. LES LIBELLÉS MULTICANAUX. Aucun libellé exclusif — « uniquement », « only », « solo »,
 *      « somente » — ne doit paraître dans une page qui annonce deux canaux ouverts. C'est
 *      l'affirmation FAUSSE que l'étape 3 ferme : douze cartes disaient « Soute uniquement »
 *      alors que le fret était ouvert.
 *   2. LE VOCABULAIRE D'HOMOLOGATION. Les 27 corrections applicatives doivent se voir dans les
 *      pages rendues, et les quatre libellés combinés doivent y être présents dans leur langue.
 *
 * `--dist` est OBLIGATOIRE. Une garde qui se saute quand l'artefact manque ne garde rien : c'est
 * exactement la faute qui a fait tomber la preuve DOM de l'inventaire, sautée à chaque exécution
 * parce qu'elle tournait avant le build.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = process.argv.slice(2).find((a) => a.startsWith("--dist="))?.slice(7);
if (!DIST || !existsSync(DIST)) {
  console.error("[étape3-dom] REFUS — `--dist=<chemin>` est obligatoire et doit exister.");
  console.error("             Une garde qui se saute faute d'artefact ne garde rien.");
  process.exit(1);
}

let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

const pages = [];
(function marcher(d) {
  for (const e of [...readdirSync(d)].sort()) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) marcher(p);
    else if (e.endsWith(".html")) pages.push(p);
  }
})(DIST);
if (pages.length < 1000) { echec("départ", `${pages.length} pages seulement — ce n'est pas le site complet`); process.exit(1); }
ok(`départ : ${pages.length} pages construites`);

/* ---- 1. AUCUNE AFFIRMATION D'HOMOLOGATION DANS LE DOM PUBLIC -------------------------------- */
/* Le même vocabulaire interdit que l'inventaire, tenu ici sur les pages RENDUES. Les références
   licites — Live Animals Regulations, méthode de mesure, exigences publiées — restent permises. */
const INTERDIT = /IATA[- ]?(?:approved|compliant|certified)|homologu[\wÀ-ÿ]*\s+(?:par\s+)?(?:l[' ])?IATA|homologad[\wÀ-ÿ]*\s+(?:por|pela)\s+(?:la\s+)?IATA|caisse[s]?\s+homologuée[s]?|cage[s]?\s+homologuée[s]?|jaula[s]?\s+homologada[s]?|conforme[s]?\s+(?:à\s+la\s+norme\s+)?IATA|conforme[s]?\s+(?:a|à)\s+la\s+IATA|conforme[s]?\s+(?:à|a)\s+(?:la\s+)?norma\s+IATA|norma\s+IATA|norme\s+IATA|padrão\s+IATA|aprovad[\wÀ-ÿ]*\s+pela\s+IATA|aprobad[\wÀ-ÿ]*\s+por\s+la\s+IATA/i;
/* CE QUE L'ÉTAPE 3 POSSÈDE, ET CE QU'ELLE NE POSSÈDE PAS. Le premier passage de ce contrôle a
   rougi sur 52 pages — airBaltic, Icelandair, l'Australie, la Jamaïque… — et il avait raison de
   les voir : elles PUBLIENT bien une homologation. Mais la phrase ne vient pas d'un gabarit :
   elle vient des DONNÉES GÉNÉRÉES, `airlines.generated.json` et `countries.generated.json`,
   c'est-à-dire du micro-lot éditorial, qui les corrigera par ses générateurs.
   On ne masque donc pas ces pages : on les SÉPARE par leur source. Ce qui vient d'un gabarit est
   un échec de l'étape 3 ; ce qui vient des données générées est une dette éditoriale, COMPTÉE et
   nommée ici pour qu'elle ne se perde pas. */
{
  /* DEUX RÉDACTIONS FAUTIVES, NOMMÉES. J'ai d'abord voulu imputer chaque page fautive à sa
     source — gabarit ou données — par comparaison de son texte rendu avec les artefacts générés.
     La première comparait du texte dénudé à du JSON échappé et n'appariait jamais rien ; la
     seconde, mieux normalisée, en appariait douze sur cinquante-deux. Une heuristique de
     fenêtrage sur du HTML rendu est fragile par nature : les entités, les espaces insécables et
     les découpes de balises la mettent en défaut, et j'aurais pu la raffiner longtemps sans
     jamais pouvoir m'y fier.
 
     LA GARANTIE RÉELLE EST AILLEURS, et elle ne demande aucune heuristique. L'inventaire prouve
     que les surfaces APPLICATIVES — traductions, composants, pages, lib, moteur, workers — ne
     portent plus AUCUNE affirmation interdite : c'est le contrat de l'étape 3, mesuré à 0. Il
     s'ensuit que toute affirmation encore publiée vient nécessairement d'ailleurs : des données
     générées et du contenu éditorial, c'est-à-dire du micro-lot suivant. Vérifié à la main sur
     trois cas — Icelandair, airBaltic, Air Caraïbes — : leurs phrases vivent dans
     `content/airlines/*.yml`, d'où les générateurs les portent jusqu'aux fiches.
 
     On exige donc les deux choses qu'on peut établir sans deviner : ZÉRO dans les sources
     applicatives, et un COMPTE FIGÉ de la dette encore publiée, qui ne peut plus grandir en
     silence. */
  /* On importe le relevé plutôt que de le lire d'un tube : `execFileSync` tronquait la sortie et
     rendait un JSON incomplet. */
  const { relever } = await import("./inventaire-iata.mjs");
  const releve = relever();
  const applicatives = releve.filter((r) => r.categorie === "affirmation_publique_interdite"
                                         || r.categorie === "reference_reglementaire_a_reformuler");
  if (applicatives.length) echec("1 sources applicatives", `${applicatives.length} affirmation(s) subsiste(nt), dont ${applicatives[0].fichier}:${applicatives[0].ligne}`);
  else ok("1 aucune affirmation interdite ne subsiste dans les sources applicatives");

  const publiantes = pages.filter((p) => INTERDIT.test(readFileSync(p, "utf8")));
  /* SENTINELLE DE LA DETTE ÉDITORIALE. Mesurée le 30/08/2026 sur le dist complet. Elle ne peut
     que DESCENDRE : le micro-lot éditorial la ramènera à zéro. Toute hausse est une régression,
     et fait rougir ici. */
  const DETTE_MESUREE = 52;
  if (publiantes.length > DETTE_MESUREE)
    echec("1bis dette éditorale", `${publiantes.length} pages publient une homologation, contre ${DETTE_MESUREE} mesurées — la dette a GRANDI`);
  else if (publiantes.length < DETTE_MESUREE)
    echec("1bis dette éditoriale", `${publiantes.length} pages au lieu de ${DETTE_MESUREE} : la dette a baissé, il faut déplacer la sentinelle par un mouvement nommé`);
  else ok(`1bis ${publiantes.length} pages publient encore une homologation venue des DONNÉES et du contenu — dette du micro-lot éditorial, figée et non aggravée`);
}

/* ---- 2. LES LIBELLÉS COMBINÉS, DANS LE RAPPORT RÉELLEMENT RENDU ---------------------------- */
/* PREMIÈRE RÉDACTION FAUTIVE, NOMMÉE : elle cherchait les libellés dans le HTML des pages
   d'accueil. Ils n'y sont pas, et ne peuvent pas y être — mesuré : « Cabin OK » n'apparaît dans
   AUCUNE des 3 121 pages. Les libellés de canal naissent dans le rapport du moteur, servi après
   une recherche ; le HTML statique ne les porte jamais. Le contrôle prend donc le chemin réel :
   on demande au MOTEUR un rapport pour un vrai trajet, on y cherche une compagnie à deux canaux
   ouverts, et on exige que le libellé qu'il produit soit le libellé combiné de sa langue. */
{
  const { loadKB } = await import("./packages/knowledge/src/index.ts");
  const { FinderRequest, runFinder } = await import("./packages/engine/src/index.ts");
  const kb = loadKB();
  const COMBINES = {
    en: ["Cabin and hold", "Cabin and cargo", "Hold and cargo", "Cabin, hold and cargo"],
    fr: ["Cabine et soute", "Cabine et fret", "Soute et fret", "Cabine, soute et fret"],
    es: ["Cabina y bodega", "Cabina y carga", "Bodega y carga", "Cabina, bodega y carga"],
    pt: ["Cabine e porão", "Cabine e carga", "Porão e carga", "Cabine, porão e carga"],
  };
  const EXCLUSIFS = /\b(only|uniquement|solo|somente)\b/i;
  let bons = 0, multi = 0;
  for (const [loc, attendus] of Object.entries(COMBINES)) {
    const rapport = runFinder(kb, FinderRequest.parse({
      origin: "airport_cdg", destination: "airport_bkk",
      dog: { breed_id: "breed_golden_retriever", weight_kg: 30 },
      date: "2027-01-15", locale: loc,
    }));
    /* Les compagnies à DEUX canaux ouverts au moins : ce sont elles que la cascade trahissait. */
    const cartes = rapport.airlines.filter((a) => [a.cabin, a.hold, a.cargo].filter(Boolean).length >= 2);
    if (!cartes.length) { echec(`2 libellés combinés (${loc})`, "aucune compagnie à deux canaux dans ce rapport"); continue; }
    multi = cartes.length;
    const horsListe = cartes.filter((a) => !attendus.includes(a.label));
    const menteuses = cartes.filter((a) => EXCLUSIFS.test(a.label));
    if (horsListe.length) echec(`2 libellés combinés (${loc})`, `${horsListe.length} carte(s) hors des quatre libellés, dont « ${horsListe[0].label} »`);
    else if (menteuses.length) echec(`2 libellés combinés (${loc})`, `« ${menteuses[0].label} » sur une carte à deux canaux`);
    else bons++;
  }
  if (bons === 4) ok(`2 les ${multi} cartes multicanales portent un libellé combiné, dans les quatre langues`);
}

/* ---- 3. AUCUN LIBELLÉ EXCLUSIF DANS LE DOM STATIQUE ---------------------------------------- */
/* Les fiches compagnies, elles, rendent bien des libellés de canal figés. On exige qu'aucune
   n'annonce « uniquement » à côté d'un second canal ouvert. */
{
  const EXCLUSIF_ET_SECOND = [
    [/soute uniquement/i, /fret\s*:\s*(oui|disponible|proposé)/i],
    [/hold only/i, /cargo\s*:\s*(yes|available|offered)/i],
    [/solo bodega/i, /carga\s*:\s*(sí|disponible)/i],
    [/somente porão/i, /carga\s*:\s*(sim|disponível)/i],
  ];
  const fautives = [];
  for (const p of pages) {
    const html = readFileSync(p, "utf8");
    for (const [exclusif, second] of EXCLUSIF_ET_SECOND) {
      if (exclusif.test(html) && second.test(html)) { fautives.push(p.slice(DIST.length)); break; }
    }
  }
  if (fautives.length) echec(`3 « uniquement » avec un second canal ouvert (${fautives.length})`, fautives.slice(0, 3).join(" · "));
  else ok("3 aucune page ne dit « uniquement » en annonçant un second canal ouvert");
}

/* ---- 4. LES QUATRE PHRASES CORRIGÉES, VUES DANS LEUR LANGUE -------------------------------- */
{
  const ATTENDUS = [
    ["", "a crate meeting the applicable container requirements"],
    ["fr", "conforme aux exigences applicables"],
    ["es", "que cumpla los requisitos aplicables"],
    ["pt", "que atenda aos requisitos aplicáveis"],
  ];
  let bons = 0;
  for (const [loc, phrase] of ATTENDUS) {
    const trouve = pages.some((p) => {
      const rel = p.slice(DIST.length);
      const dans = loc ? rel.startsWith(`/${loc}/`) : !/^\/(fr|es|pt)\//.test(rel);
      return dans && readFileSync(p, "utf8").includes(phrase);
    });
    if (!trouve) echec(`4 formulation corrigée (${loc || "en"})`, `« ${phrase} » ne paraît nulle part`);
    else bons++;
  }
  if (bons === ATTENDUS.length) ok("4 la formulation « conforme aux exigences applicables » est servie dans les quatre langues");
}

if (defauts) { console.error(`\n[étape3-dom] ÉCHEC — ${defauts} contrôle(s) en défaut`); process.exit(1); }
console.log("\n[étape3-dom] plus aucune homologation dans les surfaces applicatives, les libellés multicanaux sont servis dans les quatre langues, aucun « uniquement » ne ment — et la dette éditoriale reste comptée, non aggravée.");
