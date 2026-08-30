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
{
  const fautives = [];
  for (const p of pages) {
    const html = readFileSync(p, "utf8");
    const m = INTERDIT.exec(html);
    if (m) fautives.push(`${p.slice(DIST.length)} « ${m[0]} »`);
  }
  if (fautives.length) echec(`1 homologation dans le DOM (${fautives.length} page(s))`, fautives.slice(0, 4).join(" · "));
  else ok(`1 aucune affirmation d'homologation IATA dans les ${pages.length} pages construites`);
}

/* ---- 2. LES QUATRE LIBELLÉS COMBINÉS, DANS LEUR LANGUE ------------------------------------- */
/* Ils vivent dans la configuration JSON du Finder, servie à chaque page d'accueil localisée. */
const COMBINES = {
  "": ["Cabin and hold", "Cabin and cargo", "Hold and cargo", "Cabin, hold and cargo"],
  fr: ["Cabine et soute", "Cabine et fret", "Soute et fret", "Cabine, soute et fret"],
  es: ["Cabina y bodega", "Cabina y carga", "Bodega y carga", "Cabina, bodega y carga"],
  pt: ["Cabine e porão", "Cabine e carga", "Porão e carga", "Cabine, porão e carga"],
};
{
  let bons = 0;
  for (const [loc, attendus] of Object.entries(COMBINES)) {
    const f = join(DIST, loc, "index.html");
    if (!existsSync(f)) { echec(`2 libellés combinés (${loc || "en"})`, "page d'accueil absente"); continue; }
    const html = readFileSync(f, "utf8");
    const manquants = attendus.filter((t) => !html.includes(t));
    if (manquants.length) echec(`2 libellés combinés (${loc || "en"})`, `absent(s) : ${manquants.join(" | ")}`);
    else bons++;
  }
  if (bons === Object.keys(COMBINES).length) ok("2 les quatre libellés combinés sont servis dans les quatre langues");
}

/* ---- 3. AUCUN LIBELLÉ EXCLUSIF LÀ OÙ DEUX CANAUX SONT OUVERTS ------------------------------ */
/* Les fiches compagnies rendent les canaux ET leur libellé. On y exige la cohérence : un
   « uniquement » ne peut pas voisiner l'annonce d'un second canal ouvert dans le même bloc. */
const EXCLUSIF = { "": /\bonly\b/i, fr: /\buniquement\b/i, es: /\bsolo\b/i, pt: /\bsomente\b/i };
{
  const COMBINE_TOUS = Object.values(COMBINES).flat();
  const fautives = [];
  for (const p of pages) {
    const loc = ["fr", "es", "pt"].find((l) => p.slice(DIST.length).startsWith(`/${l}/`)) ?? "";
    const html = readFileSync(p, "utf8");
    /* Un libellé combiné et un libellé exclusif ne peuvent pas décrire la MÊME carte. On lit donc
       chaque bloc de carte, pas la page entière. */
    for (const bloc of html.split(/<article|<li class="acard/).slice(1)) {
      const combine = COMBINE_TOUS.find((t) => bloc.slice(0, 2000).includes(t));
      if (combine && EXCLUSIF[loc].test(bloc.slice(0, 2000))) {
        fautives.push(`${p.slice(DIST.length)} « ${combine} » voisine un libellé exclusif`);
        break;
      }
    }
  }
  if (fautives.length) echec(`3 libellé exclusif sur une carte multicanale (${fautives.length})`, fautives.slice(0, 3).join(" · "));
  else ok("3 aucune carte n'annonce deux canaux et « uniquement » à la fois");
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
console.log("\n[étape3-dom] aucune homologation publiée, les libellés multicanaux sont servis, et aucun « uniquement » ne ment.");
