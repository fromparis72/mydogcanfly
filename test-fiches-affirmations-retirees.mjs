#!/usr/bin/env node
/**
 * Garde des affirmations RETIRÉES des fiches — 2e passe de contre-revue Codex (28/08/2026).
 *
 * Les règles moteur non prouvées d'Alaska et de Garuda ont été supprimées en RC, mais les
 * FICHES publiaient encore les mêmes faits : le seuil Pet Connect (150 lb, un seuil FRET)
 * transposé au bagage accompagné d'Alaska, et chez Garuda l'interdiction cabine, le « ≤ 32 kg »
 * de soute et le « au-delà de 32 kg » de fret qu'aucune page officielle lisible ne prouve.
 * Cette garde rend leur retrait OPPOSABLE, même si les règles moteur restent absentes :
 *   1. la fiche Alaska ne porte plus « 150 lb » (les tarifs « $150 » restent légitimes) ;
 *   2. la fiche Garuda ne porte plus « 32 kg » ni un refus cabine catégorique — la décision
 *      cabine est l'héritage non re-vérifié, ou un refus ADOSSÉ à une source auditée ;
 *   3. les données générées (objects.json, airlines.generated.json) suivent ;
 *   4. les guides Garuda (en/fr) ne publient plus le refus catégorique du gabarit ;
 *   5. le dist construit suit, borné aux pages de la compagnie concernée — « 32 kg » est
 *      légitime ailleurs (China Southern…), « 150 lb » nulle part chez Alaska ;
 *   6. contre-épreuves : chaque réintroduction est détectée par le MÊME vérificateur,
 *      exercé contre une copie mutée — jamais une réimplémentation.
 *
 * EXCLUSION QUALIFIÉE (réserve de contre-revue du 28/08/2026, soldée ici) : les sources
 * héritées du site v1 portent encore les anciens chiffres — `content/posts/*-dog-policy.md`
 * (62 fiches compagnies, dont alaska-airlines-dog-policy.md et ses « 68 kg / 150 lb ») et
 * `static/tools/can-my-dog-fly/index.html` (le jeu de données v1 complet). Leur état, MESURÉ :
 * elles ne sont PAS importées par le Travel Hub (aucun guide ne porte leur sourceUrl), PAS
 * construites par Astro (aucune page dans dist), et leurs 62 URL v1 sont REDIRIGÉES en 301
 * vers /airlines/<slug>/ par le Worker Pages (`packages/ui/public/_worker.js`,
 * LEGACY_REDIRECTS, périmètre contrôlé par `_routes.json`, exercé par
 * `packages/knowledge/scripts/test-legacy-urls.mjs`).
 *
 * CORRECTION DE MESURE (28/08/2026, 2e contre-revue de la conception porte), nommée : la
 * première version de ce commentaire affirmait « leurs URL ne sont PAS redirigées, elles
 * répondent 404 » et qualifiait d'inexact le constat de contre-revue qui disait l'inverse.
 * C'était MA mesure qui était fausse : j'avais grepé `_redirects` (86 règles, qui ne couvrent
 * effectivement aucune de ces URL) sans ouvrir `_worker.js` NI `_routes.json` — deux fichiers
 * du MÊME répertoire, que j'avais pourtant listé. `_redirects` est une vue partielle du
 * routage Pages, pas son registre effectif — la même classe de défaut que « agrégats exacts,
 * registre non figé ». Le contrôle HTTP de contre-revue a établi les 62/62 en 301 vers leur
 * cible exacte.
 *
 * Le contrôle 1 bis rend l'exclusion OPPOSABLE : si une de ces sources se met à être
 * importée ou construite, il rougit. Le verdict final de cette garde est borné en
 * conséquence : « toutes les surfaces CONSTRUITES », jamais « toutes les surfaces ».
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const YAML = createRequire(join(process.cwd(), "package.json"))("yaml");
/** Les commentaires YAML racontent (mentions historiques qualifiées), ils ne publient pas :
 *  seul le texte PUBLIABLE de la fiche est balayé. */
const sansCommentaires = (yml) => yml.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
let defauts = 0;
const echec = (cas, detail) => { defauts++; console.error(`  ✗ ${cas} — ${detail}`); };
const ok = (cas) => console.log(`  ✓ ${cas}`);

/* ---- Les vérificateurs — ce sont EUX que les contre-épreuves exercent ------------------------ */

/** Alaska : aucun « 150 lb » (le seuil Pet Connect ne se transpose pas au bagage accompagné). */
function verifierAlaska(texte) {
  const problemes = [];
  const m = texte.match(/150\s*lb/i);
  if (m) problemes.push(`« ${m[0]} » réapparaît — seuil Pet Connect (fret), jamais prouvé pour le bagage accompagné`);
  return problemes;
}

/** Garuda : aucun « 32 kg », aucun refus cabine catégorique sans source auditée. */
function verifierGarudaTexte(texte) {
  const problemes = [];
  const kg = texte.match(/32\s*kg/i);
  if (kg) problemes.push(`« ${kg[0]} » réapparaît — seuil de soute passager qu'aucune source lisible ne prouve`);
  const CATEGORIQUES = [
    "No pets in the cabin", "Pas d'animaux en cabine", "Sin mascotas en cabina", "Sem animais na cabine",
    "not accepted in the cabin</p>", "non accepté en cabine</p>",
    "❌ not accepted", "❌ non acceptée",
    "No cabin travel for companion dogs", "Pas de transport en cabine pour les chiens de compagnie",
  ];
  for (const motif of CATEGORIQUES) {
    if (texte.includes(motif)) problemes.push(`refus cabine catégorique réintroduit : « ${motif} »`);
  }
  return problemes;
}

/** Garuda : la DÉCISION cabine ne redevient pas un refus sans preuve. */
function verifierGarudaDecision(policies) {
  const cabine = policies?.cabin ?? {};
  if (cabine.availability === "not_offered" && !cabine.source) {
    return ["policies.cabin redevient « not_offered » SANS source auditée — le refus non prouvé que la contre-revue a fait retirer"];
  }
  return [];
}

/* ---- 1 + 2. Les fiches ----------------------------------------------------------------------- */
{
  const alaska = sansCommentaires(readFileSync("content/airlines/alaska.yml", "utf8"));
  const pa = verifierAlaska(alaska);
  if (pa.length) for (const p of pa) echec("1 fiche Alaska", p);
  else ok("1 fiche Alaska : aucun « 150 lb »");

  const brut = readFileSync("content/airlines/garuda_indonesia.yml", "utf8");
  const garuda = sansCommentaires(brut);
  const pg = [...verifierGarudaTexte(garuda), ...verifierGarudaDecision(YAML.parse(brut).policies)];
  if (pg.length) for (const p of pg) echec("2 fiche Garuda", p);
  else ok("2 fiche Garuda : aucun « 32 kg », aucun refus cabine catégorique, décision cabine héritée ou sourcée");
}

/* ---- 1 bis. L'exclusion des sources héritées v1 est réelle, pas supposée --------------------- */
{
  const problemes = [];
  /* (a) aucun guide du Travel Hub n'importe une fiche compagnie héritée. */
  const marcherGuides = (dossier) => {
    for (const nom of readdirSync(dossier)) {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) { marcherGuides(chemin); continue; }
      if (!nom.endsWith(".md")) continue;
      const m = readFileSync(chemin, "utf8").match(/sourceUrl:\s*"([^"]*-dog-policy\/?)"/);
      if (m) problemes.push(`${chemin} importe la fiche héritée ${m[1]}`);
    }
  };
  if (existsSync("packages/ui/src/content/guides")) marcherGuides("packages/ui/src/content/guides");
  /* (b) le build ne sert aucune fiche héritée `*-dog-policy`. */
  if (existsSync("packages/ui/dist")) {
    const marcherDist = (dossier) => {
      for (const nom of readdirSync(dossier)) {
        const chemin = join(dossier, nom);
        if (statSync(chemin).isDirectory()) {
          if (/-dog-policy$/.test(nom)) problemes.push(`${chemin} : une fiche héritée est construite`);
          else marcherDist(chemin);
        }
      }
    };
    marcherDist("packages/ui/dist");
  }
  if (problemes.length) for (const p of problemes) echec("1bis exclusion des sources héritées", p);
  else ok("1bis sources héritées v1 : ni importées par le Travel Hub, ni construites — l'exclusion est réelle");
}

/* ---- 3. Les données générées ----------------------------------------------------------------- */
{
  const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
  const generes = JSON.parse(readFileSync("packages/ui/src/data/airlines.generated.json", "utf8"));
  const texteDe = (donnees, id) => {
    if (Array.isArray(donnees)) return JSON.stringify(donnees.find((a) => a.id === id) ?? {});
    if (Array.isArray(donnees.airlines)) return JSON.stringify(donnees.airlines.find((a) => a.id === id) ?? {});
    return JSON.stringify(donnees[id] ?? {}); // airlines.generated.json : objet indexé par id
  };
  const problemes = [
    ...verifierAlaska(texteDe(objets, "airline_alaska")).map((p) => `objects.json/alaska : ${p}`),
    ...verifierAlaska(texteDe(generes, "airline_alaska")).map((p) => `airlines.generated/alaska : ${p}`),
    ...verifierGarudaTexte(texteDe(objets, "airline_garuda_indonesia")).map((p) => `objects.json/garuda : ${p}`),
    ...verifierGarudaTexte(texteDe(generes, "airline_garuda_indonesia")).map((p) => `airlines.generated/garuda : ${p}`),
    ...verifierGarudaDecision(objets.airlines.find((a) => a.id === "airline_garuda_indonesia")?.premium?.policy)
      .map((p) => `objects.json/garuda : ${p}`),
  ];
  if (problemes.length) for (const p of problemes) echec("3 données générées", p);
  else ok("3 données générées : objects.json et airlines.generated.json suivent les fiches");
}

/* ---- 4. Les guides Garuda -------------------------------------------------------------------- */
{
  const guides = JSON.parse(readFileSync("packages/knowledge/raw/guides.json", "utf8"));
  const liste = Array.isArray(guides) ? guides : guides.guides ?? [];
  const garuda = liste.filter((g) => g.entity_id === "airline_garuda_indonesia");
  if (garuda.length !== 2) echec("4 guides Garuda", `${garuda.length} entrée(s) (attendu : 2, en + fr)`);
  let problemes = [];
  for (const g of garuda) problemes.push(...verifierGarudaTexte(g.html ?? "").map((p) => `${g.locale} : ${p}`));
  if (problemes.length) for (const p of problemes) echec("4 guides Garuda", p);
  else ok("4 guides Garuda (en/fr) : le refus catégorique du gabarit a disparu");
}

/* ---- 5. Le dist construit, borné par compagnie ----------------------------------------------- */
{
  const DIST = "packages/ui/dist";
  if (!existsSync(DIST)) {
    console.log("  · 5 dist absent : contrôle du build porté par le job « Site entier » (test:built-ui)");
  } else {
    const pagesDe = (fragment) => {
      const trouvees = [];
      const marcher = (dossier) => {
        for (const nom of readdirSync(dossier)) {
          const chemin = join(dossier, nom);
          const st = statSync(chemin);
          if (st.isDirectory()) { marcher(chemin); continue; }
          if (st.isFile() && nom.endsWith(".html") && chemin.includes(fragment)) trouvees.push(chemin);
        }
      };
      marcher(DIST);
      return trouvees;
    };
    /* `build:ci` (job « Vérifications ») ne construit que les compagnies sentinelles : l'absence
       des pages Alaska/Garuda y est normale et le contrôle est porté par le job « Site entier »,
       qui appelle cette garde avec `--dist-complet` — là, l'absence d'une page est un DÉFAUT :
       un contrôle qui ne peut pas conclure et se tait est indiscernable d'un contrôle qui a
       conclu. Une page PRÉSENTE, elle, doit être propre dans les deux modes. */
    const COMPLET = process.argv.includes("--dist-complet");
    const alaska = pagesDe("/airlines/alaska/");
    const garuda = pagesDe("/airlines/garuda-indonesia/");
    let problemes = [];
    if (COMPLET && alaska.length !== 4) problemes.push(`${alaska.length} page(s) Alaska construite(s) (attendu : 4 langues)`);
    if (COMPLET && garuda.length !== 4) problemes.push(`${garuda.length} page(s) Garuda construite(s) (attendu : 4 langues)`);
    for (const f of alaska) problemes.push(...verifierAlaska(readFileSync(f, "utf8")).map((p) => `${f} : ${p}`));
    for (const f of garuda) problemes.push(...verifierGarudaTexte(readFileSync(f, "utf8")).map((p) => `${f} : ${p}`));
    if (problemes.length) for (const p of problemes) echec("5 dist construit", p);
    else if (alaska.length === 0 && garuda.length === 0 && !COMPLET)
      console.log("  · 5 pages absentes de ce dist réduit : contrôle porté par le job « Site entier » (--dist-complet)");
    else ok(`5 dist construit : ${alaska.length} page(s) Alaska sans « 150 lb », ${garuda.length} page(s) Garuda sans « 32 kg » ni refus catégorique`);
  }
}

/* ---- 6. Contre-épreuves : chaque réintroduction ROUGIT --------------------------------------- */
{
  const alaska = sansCommentaires(readFileSync("content/airlines/alaska.yml", "utf8"));
  const garuda = sansCommentaires(readFileSync("content/airlines/garuda_indonesia.yml", "utf8"));

  const cas = [
    ["6a « ≤ 150 lb » réinséré dans la soute Alaska",
      () => verifierAlaska(alaska.replace("aucune limite de poids publiée", "animal + caisse ≤ 150 lb")).length > 0],
    ["6b « ≤ 32 kg » réinséré dans la soute Garuda",
      () => verifierGarudaTexte(garuda.replace("aucune limite de poids vérifiée", "≤ 32 kg avec la caisse")).length > 0],
    ["6c refus cabine catégorique réinséré dans la fiche Garuda",
      () => verifierGarudaTexte(garuda.replace("Historiquement annoncée fermée aux animaux", "Pas d'animaux en cabine — ")).length > 0],
    ["6d « not_offered » sans source rétabli sur la décision cabine Garuda",
      () => verifierGarudaDecision({ cabin: { availability: "not_offered" } }).length > 0],
    ["6e « ❌ not accepted » rétabli dans un guide Garuda",
      () => verifierGarudaTexte("<td>✈️ Cabin</td><td>❌ not accepted</td>").length > 0],
  ];
  for (const [nom, mute] of cas) {
    /* Chaque mutation doit d'abord S'APPLIQUER (sinon elle ne prouve rien), puis être VUE. */
    if (mute()) ok(`${nom} — détecté par le même vérificateur`);
    else echec(nom, "la réintroduction n'est PAS détectée");
  }
  /* Et les mutations 6a-6c doivent réellement s'être appliquées à leur copie : */
  if (!alaska.includes("aucune limite de poids publiée")) echec("6a", "la chaîne d'ancrage a disparu de la fiche Alaska — la contre-épreuve ne prouve plus rien");
  if (!garuda.includes("aucune limite de poids vérifiée")) echec("6b", "la chaîne d'ancrage a disparu de la fiche Garuda — la contre-épreuve ne prouve plus rien");
  if (!garuda.includes("Historiquement annoncée fermée aux animaux")) echec("6c", "la chaîne d'ancrage a disparu de la fiche Garuda — la contre-épreuve ne prouve plus rien");
}

if (defauts) { console.error(`\n[affirmations-retirees] ÉCHEC — ${defauts} défaut(s)`); process.exit(1); }
console.log("\n[affirmations-retirees] les faits non prouvés sont retirés de toutes les surfaces CONSTRUITES — les sources héritées v1 restent non publiées (contrôle 1 bis) — et tout retour rougirait.");
