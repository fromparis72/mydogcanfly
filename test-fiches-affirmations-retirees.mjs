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
import { zonesDe } from "./test-lib/zones-publiques.mjs";   // le lecteur canonique, jamais un quatrième

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

/* ---- 7. DESSERVIR N'EST PAS ACCEPTER, ET AUCUNE SURFACE NE PROMET « LA PLUS ADAPTÉE » -------
 *
 * CE PARAGRAPHE A ÉTÉ ÉCRIT DEUX FOIS, ET LA PREMIÈRE ÉTAIT UN FAUX VERT.
 *
 * Il annonçait « lire le DOM » et se donnait pour cela sa PROPRE fonction : le contenu de
 * `<main>`, les balises retirées à l'expression régulière. Il ne voyait donc ni les métadonnées —
 * que le commit portant ce contrôle venait précisément de corriger —, ni le JSON-LD, ni les
 * attributs accessibles. Trois zones publiques, invisibles au contrôle censé les garder.
 *
 * `test-lib/zones-publiques.mjs` existe depuis le 02/09/2026 et rend exactement ces cinq zones.
 * Son en-tête raconte les trois rédactions qu'il a fallu pour qu'il soit juste. En écrire une
 * quatrième à côté, c'est le défaut qu'il a lui-même été créé pour clore : « ce qui compte comme
 * publié ne peut pas dépendre de l'instrument qui regarde ».
 *
 * TROIS AUTRES TROUS DE LA PREMIÈRE RÉDACTION, tous relevés en contre-revue :
 *   · trois pages pays et trois aéroports par langue, dans l'ordre du système de fichiers ;
 *   · aucune exigence de PRÉSENCE : supprimer les blocs corrigés laissait le contrôle vert ;
 *   · les anciens titres (« Airlines flying to … with a dog ») absents des témoins. */
{
  const DIST = "packages/ui/dist";
  const COMPLET = process.argv.includes("--dist-complet");
  if (!existsSync(DIST)) {
    console.log("  · 7 dist absent : contrôle porté par le job « Site entier »");
  } else {
    /* CE QU'AUCUNE PAGE N'A LE DROIT DE DIRE. Le mot intercalé s'écrit `[^\s]+` : `\w` ne couvre
       pas les lettres accentuées en JavaScript, et « também » avait fait rater le motif portugais
       à la rédaction précédente — le témoin de non-vacuité l'a vu, pas moi. */
    const INTERDITS = [
      // Desservir présenté comme accepter (pages pays et aéroports, 4 langues)
      ["desserte", /serve this country and accept dogs/i],
      ["desserte", /airlines?\s+(?:[^\s]+\s+){0,3}accept(?:ing)? dogs/i],
      ["desserte", /compagnies?\s+(?:[^\s]+\s+){0,3}accept(?:ent|ant) (?:le chien|les chiens)/i],
      ["desserte", /aerol[ií]neas?\s+(?:[^\s]+\s+){0,3}acept(?:an|ando) perros/i],
      ["desserte", /companhias?\s+(?:[^\s]+\s+){0,3}aceit(?:am|ando) (?:cães|cachorros)/i],
      // Les anciens titres de section, qui promettaient le voyage plutôt que la desserte
      ["ancien titre", /Airlines flying to .{0,40} with a dog/i],
      ["ancien titre", /Compagnies qui desservent .{0,40} avec un chien/i],
      ["ancien titre", /Aerol[ií]neas que vuelan a .{0,40} con un perro/i],
      /* Refus catégorique non cité — BORNÉ À LA PAGE CAISSE, qui est son objet. Appliqué à tout
         le site, ce motif rougit sur une phrase ÉDITORIALE des fiches pays : « many carriers
         refuse or restrict snub-nosed breeds in the hold », présente dans 7 fiches de
         `content/countries/`. C'est le même défaut — une affirmation catégorique sans citation —
         mais dans les DONNÉES et non dans un gabarit, hors du périmètre arbitré pour ce lot. Il
         est relevé dans le dossier plutôt que corrigé au passage ou masqué en rétrécissant le
         motif. */
      ["refus caisse", /(?:beaucoup|nombreuses?) de compagnies\s+(?:[^\s]+\s+){0,3}refusent/i, "/tools/crate/"],
      ["refus caisse", /many airlines\s+(?:[^\s]+\s+){0,2}refuse/i, "/tools/crate/"],
      ["refus caisse", /muchas aerol[ií]neas\s+(?:[^\s]+\s+){0,2}rechazan/i, "/tools/crate/"],
      ["refus caisse", /muitas companhias\s+(?:[^\s]+\s+){0,2}recusam/i, "/tools/crate/"],
      // « La plus adaptée » et la recommandation personnalisée (accueil : corps ET JSON-LD)
      ["plus adaptée", /(?:la compagnie|compagnie) a[ée]rienne la plus adapt[ée]e/i],
      ["plus adaptée", /celles qui sont les plus adapt[ée]es/i],
      ["plus adaptée", /airline best suited to your dog/i],
      ["plus adaptée", /those best suited to your dog/i],
      ["plus adaptée", /aerol[ií]nea que mejor se adapta/i],
      ["plus adaptée", /las que mejor se adaptan/i],
      ["plus adaptée", /companhia a[ée]rea mais adequada/i],
      ["plus adaptée", /as mais adequadas ao seu/i],
      ["recommandation", /recommandation personnalis[ée]e/i],
      ["recommandation", /personalised recommendation/i],
      ["recommandation", /recomendaci[óo]n personalizada/i],
      ["recommandation", /recomenda[çc][ãa]o personalizada/i],
      // Le titre SEO qui affirmait que les règles sont sourcées
      ["titre sourcé", /Airline Rules, Checked and Sourced/i],
      ["titre sourcé", /r[èe]gles des compagnies, sourc[ée]es/i],
    ];

    /* CE QUI DOIT ÊTRE PRÉSENT — ET POURQUOI CE N'EST PAS CE QUE J'AVAIS ÉCRIT.
     *
     * La contre-revue demandait « au moins un témoin réel de la formulation corrigée par langue »,
     * sans quoi supprimer les blocs laisserait le contrôle vert. J'ai d'abord exigé la présence
     * de la formulation des pages pays et aéroports. Elle a rougi, et la mesure explique
     * pourquoi : `dogChannel()` ne retient une compagnie que si `premium.policy.<canal>.allowed`
     * est vrai, et depuis la frontière de confiance AUCUNE des 102 compagnies ne l'est —
     * 0/102, mesuré le 07/09/2026. La section n'est donc rendue sur AUCUNE des 140 pages pays ni
     * sur aucune page aéroport : elle est dormante, et ma reformulation avec elle.
     *
     * Exiger sa présence dans le DOM reviendrait à exiger qu'une acceptation non prouvée soit
     * republiée pour satisfaire un contrôle — exactement ce que `tarifs` §5quater a déjà refusé
     * de faire. L'exigence est donc portée sur deux plans, sans rien abaisser :
     *
     *   · PRÉSENCE RÉELLE là où la surface est servie : la page caisse et l'accueil, dans les
     *     quatre langues. Supprimer ces blocs fait rougir.
     *   · PRÉSENCE EN SOURCE pour les sections dormantes : les deux gabarits doivent porter la
     *     formulation prudente et aucune trace de l'ancienne. Une section dormante qui se
     *     réveillera le jour d'une citation se réveillera avec le bon texte.
     *   · RÉARMEMENT AUTOMATIQUE : si une page rend la section, la formulation prudente y est
     *     exigée. Le contrôle n'a rien à changer le jour où la donnée revient. */
    const ATTENDUS_RENDUS = {
      "":   [["caisse", "/tools/crate/", /may also apply specific restrictions to snub-nosed breeds/i],
             ["accueil", "index.html", /what a cited source confirms and what is still to be checked/i]],
      "fr": [["caisse", "/tools/crate/", /appliquer des restrictions particulières aux races brachycéphales/i],
             ["accueil", "index.html", /ce qui est confirmé par une source citée et ce qui reste à vérifier/i]],
      "es": [["caisse", "/tools/crate/", /aplicar restricciones específicas a las razas braquicéfalas/i],
             ["accueil", "index.html", /lo que confirma una fuente citada y lo que queda por comprobar/i]],
      "pt": [["caisse", "/tools/crate/", /aplicar restrições específicas às raças braquicefálicas/i],
             ["accueil", "index.html", /o que uma fonte citada confirma e o que ainda falta verificar/i]],
    };
    /* La formulation prudente exigée DÈS QU'UNE PAGE REND LA SECTION — le réarmement. */
    /* Le titre de SECTION est suivi d'un pays ou d'un code IATA ; la MÉTADONNÉE des pages
       aéroport, corrigée dans le même commit, dit « Documented airlines serving it, and how to
       report… ». Sans la négation ci-dessous, ce réarmement rougissait sur la métadonnée — un
       faux positif de ma main, vu par le contrôle lui-même sur les pages ALG et ASU. */
    const SI_RENDUE = [
      [/Documented airlines serving (?!it[,.])/i, /to be checked on each airline's page/i],
      [/Compagnies documentées desservant (?!ce pays)/i, /à vérifier sur chaque fiche compagnie/i],
      [/Aerolíneas documentadas que operan (?!allí)/i,   /hay que comprobarlo en la ficha de cada aerolínea/i],
      [/Companhias documentadas que operam (?!lá)/i,     /você confere na ficha de cada companhia/i],
    ];

    const check7 = (cas, condition, libelleOk, detailEchec) => {
      if (condition) ok(`${cas} : ${libelleOk}`);
      else echec(cas, detailEchec);
    };
    const lister = (fragment) => {
      const t = [];
      const marcher = (d) => {
        for (const n of readdirSync(d).sort()) {          // ordre stable, pas celui du disque
          const c = join(d, n);
          const st = statSync(c);
          if (st.isDirectory()) { marcher(c); continue; }
          if (st.isFile() && n.endsWith(".html") && c.includes(fragment)) t.push(c);
        }
      };
      marcher(DIST);
      return t.sort();
    };

    /* TOUTES les pages pays et aéroports, pas un échantillon — le gabarit est unique mais les
       données ne le sont pas, et c'est une donnée (le nom d'une compagnie, un compteur) qui
       pourrait ramener la promesse sur une page et pas sur une autre. */
    const pages = [...lister("/countries/"), ...lister("/airports/"), ...lister("/tools/crate/")];
    for (const l of ["", "/fr", "/es", "/pt"]) {
      const acc = join(DIST, l.slice(1), "index.html");
      if (existsSync(acc)) pages.push(acc);
    }

    /* L'ACCUEIL EST UN CHEMIN EXACT, PAS UN SUFFIXE. `f.includes("index.html")` était vrai de
       TOUTE page Astro — chacune se rend en `…/index.html`. La garde de présence serait donc
       restée verte si la phrase avait disparu de l'accueil pour être copiée sur une page pays.
       Une exigence de présence qui accepte n'importe quelle page ne prouve rien de la page
       qu'elle vise. L'attaque correspondante est jouée plus bas. */
    const ACCUEILS = new Set(["index.html", "fr/index.html", "es/index.html", "pt/index.html"]);
    const estLa = (chemin, frag, lang) => {
      const rel = chemin.slice(DIST.length + 1);
      if (frag === "index.html") return ACCUEILS.has(rel);
      const langDuChemin = /^(fr|es|pt)\//.test(rel) ? rel.slice(0, 2) : "";
      return chemin.includes(frag) && langDuChemin === lang;
    };
    const fuites = [];
    let jsonLdIllisibles = 0;
    const vus = { "": 0, fr: 0, es: 0, pt: 0 };
    const presents = { "": new Set(), fr: new Set(), es: new Set(), pt: new Set() };
    for (const f of pages) {
      const rel = f.slice(DIST.length + 1);
      const lang = /^(fr|es|pt)\//.test(rel) ? rel.slice(0, 2) : "";
      const z = zonesDe(readFileSync(f, "utf8"));
      /* LES CINQ ZONES, pas seulement le corps : le titre et les métadonnées sont ce que la
         rédaction précédente ne voyait pas, et le JSON-LD reprend la FAQ mot pour mot. */
      const tout = [z.titre, z.corps, z.metas, z.jsonLd, z.attributs].join("\n");
      jsonLdIllisibles += z.jsonLdInvalide ?? 0;
      vus[lang]++;
      for (const [nom, re, portee] of INTERDITS) {
        if (portee && !f.includes(portee)) continue;      // un motif borné ne juge que son objet
        const m = re.exec(tout);
        if (m) fuites.push(`${rel} [${nom}] : « ${m[0].slice(0, 60)} »`);
      }
      for (const [nom, frag, re] of (ATTENDUS_RENDUS[lang] ?? []))
        if (estLa(f, frag, lang) && re.test(tout)) presents[lang].add(nom);
      /* Réarmement : une page qui rend la section doit porter la formulation prudente entière. */
      for (const [titre, prudence] of SI_RENDUE)
        if (titre.test(tout) && !prudence.test(tout))
          fuites.push(`${rel} [section rendue] : titre corrigé présent, phrase prudente absente`);
    }

    if (!pages.length) {
      if (COMPLET) echec("7 zones", "aucune page pays, aéroport ou caisse dans le dist — le contrôle ne saurait pas conclure");
      else console.log("  · 7 pages absentes de ce dist réduit : contrôle porté par --dist-complet");
    } else {
      if (fuites.length) for (const f of fuites.slice(0, 6)) echec("7 zones", f);
      else ok(`7 ${pages.length} pages lues par le lecteur canonique (titre, corps, métadonnées, JSON-LD, attributs) : aucune promesse retirée n'y reparaît`);

      /* La PRÉSENCE, langue par langue — et seulement sur un dist complet, où toutes les pages
         pays et aéroports existent. Sur le dist réduit, leur absence est normale. */
      const manquants = [];
      for (const [lang, attendus] of Object.entries(ATTENDUS_RENDUS)) {
        if (!vus[lang]) { if (COMPLET) manquants.push(`aucune page lue en « ${lang || "en"} »`); continue; }
        for (const [nom, frag] of attendus) {
          if (!pages.some((f) => estLa(f, frag, lang))) continue;
          if (!presents[lang].has(nom)) manquants.push(`${lang || "en"} · ${nom}`);
        }
      }
      if (manquants.length) for (const m of manquants.slice(0, 6)) echec("7 présence", `formulation prudente absente — ${m}`);
      else ok(`7 présence : la formulation prudente est servie sur la page caisse et l'accueil dans les quatre langues (supprimer ces blocs ferait rougir)`);

      /* L'ATTAQUE, JOUÉE SUR LE CORPUS RÉEL. On retire la phrase de l'accueil français et on la
         copie sur une page pays française, puis on REJOUE le calcul de présence sur ce corpus
         muté. Il doit signaler l'accueil manquant. Avec l'ancien `f.includes("index.html")`,
         la page pays — qui se rend elle aussi en `index.html` — l'aurait satisfait. */
      {
        /* Le drapeau `g` n'est pas un détail : la FAQ d'accueil est publiée DEUX fois — dans le
           corps et dans le JSON-LD qui la reprend mot pour mot. Sans lui, la mutation n'en
           retirait qu'une et l'attaque échouait en donnant l'impression que la garde était
           mauvaise. C'est la garde qui avait raison, et ma mutation qui était incomplète. */
        const PHRASE = /ce qui est confirmé par une source citée et ce qui reste à vérifier/gi;
        const presenceSur = (corpus) => {
          const vusM = { "": 0, fr: 0, es: 0, pt: 0 };
          const presentsM = { "": new Set(), fr: new Set(), es: new Set(), pt: new Set() };
          for (const [chemin, texte] of corpus) {
            const rel = chemin.slice(DIST.length + 1);
            const lg = /^(fr|es|pt)\//.test(rel) ? rel.slice(0, 2) : "";
            vusM[lg]++;
            for (const [nom, frag, re] of (ATTENDUS_RENDUS[lg] ?? []))
              if (estLa(chemin, frag, lg) && re.test(texte)) presentsM[lg].add(nom);
          }
          return presentsM;
        };
        const accueilFr = join(DIST, "fr", "index.html");
        const paysFr = pages.find((f) => f.includes("/fr/countries/"));
        if (existsSync(accueilFr) && paysFr) {
          const zonesDe_ = (f) => { const z = zonesDe(readFileSync(f, "utf8")); return [z.titre, z.corps, z.metas, z.jsonLd, z.attributs].join("\n"); };
          const reel = [[accueilFr, zonesDe_(accueilFr)], [paysFr, zonesDe_(paysFr)]];
          check7("7 attaque", presenceSur(reel).fr.has("accueil"),
            "témoin : sur le corpus réel, l'accueil français porte bien la phrase prudente",
            "la phrase n'est pas sur l'accueil français — l'attaque ne prouverait rien");
          /* Le déplacement : l'accueil perd la phrase, la page pays la gagne. */
          const mute = [
            [accueilFr, zonesDe_(accueilFr).replace(PHRASE, "…")],
            [paysFr, zonesDe_(paysFr) + "\nce qui est confirmé par une source citée et ce qui reste à vérifier"],
          ];
          check7("7 attaque", !presenceSur(mute).fr.has("accueil"),
            "phrase déplacée de l'accueil vers une page pays : le contrôle de présence rougit",
            "le contrôle reste vert alors que l'accueil ne porte plus la phrase — une page pays l'a satisfait");
        }
      }

      /* LE JSON-LD DOIT ÊTRE LISIBLE. Le lecteur canonique compte les blocs qu'il n'a pas su
         analyser ; annoncer « cinq zones lues » en ignorant ce compte reviendrait à dire qu'on a
         regardé une zone dont on n'a rien pu tirer. */
      check7("7 json-ld", jsonLdIllisibles === 0,
        "aucun bloc JSON-LD illisible sur les pages parcourues",
        `${jsonLdIllisibles} bloc(s) JSON-LD non analysables — la zone annoncée comme lue ne l'est pas`);

      /* LA PRÉSENCE EN SOURCE, pour les deux sections dormantes — 0/102 compagnies ont un canal
         `allowed`, la section n'est donc rendue nulle part et le DOM ne peut rien prouver ici. */
      const GABARITS = [
        ["CountryGuidePage.astro", /Compagnies documentées desservant/, /accept(?:ent|ant) (?:le chien|les chiens)|serve this country and accept dogs/],
        ["AirportReliefPage.astro", /Compagnies documentées desservant/, /Compagnies acceptant le chien|Airlines accepting dogs/],
      ];
      for (const [fichier, attendu, interdit] of GABARITS) {
        const src = readFileSync(join("packages/ui/src/components", fichier), "utf8");
        const utile = src.replace(/\{\/\*[\s\S]*?\*\/\}/g, " ").replace(/^\s*\/\/.*$/gm, " ");
        if (!attendu.test(utile)) echec("7 source", `${fichier} : la formulation prudente a disparu du gabarit`);
        else if (interdit.test(utile)) echec("7 source", `${fichier} : la promesse d'acceptation est revenue dans le gabarit`);
        else ok(`7 source : ${fichier} porte la formulation prudente et aucune promesse d'acceptation (section dormante : 0/102 compagnies ont un canal établi)`);
      }
    }

    /* NON-VACUITÉ. Les motifs doivent reconnaître les phrases RÉELLEMENT retirées ; sinon ce
       paragraphe ne garantit rien et se contente de ne rien trouver. */
    const retirees = [
      ["desserte en",     "Carriers we document that serve this country and accept dogs."],
      ["desserte fr",     "Compagnies acceptant le chien à CDG"],
      ["desserte es",     "Aerolíneas que aceptan perros en CDG"],
      ["desserte pt",     "companhias que aceitam cães neste aeroporto"],
      ["titre pays en",   "Airlines flying to Portugal with a dog"],
      ["titre pays fr",   "Compagnies qui desservent le Portugal avec un chien"],
      ["titre pays es",   "Aerolíneas que vuelan a Portugal con un perro"],
      ["caisse fr",       "Beaucoup de compagnies refusent par ailleurs ces races en soute."],
      ["caisse en",       "Many airlines also refuse these breeds in the hold."],
      ["caisse es",       "Además, muchas aerolíneas rechazan estas razas en bodega."],
      ["caisse pt",       "Muitas companhias também recusam essas raças no porão."],
      ["faq fr",          "t'aider à choisir la compagnie aérienne la plus adaptée à ton chien"],
      ["faq en",          "help you choose the airline best suited to your dog and your destination"],
      ["faq es",          "elegir la aerolínea que mejor se adapta a tu perro"],
      ["faq pt",          "escolher a companhia aérea mais adequada ao seu cachorro"],
      ["reco fr",         "tu obtiens une recommandation personnalisée accompagnée des sources"],
      ["reco en",         "you get a personalised recommendation along with the official sources"],
      ["reco es",         "obtienes una recomendación personalizada junto con las fuentes"],
      ["reco pt",         "você recebe uma recomendação personalizada acompanhada das fontes"],
      ["titre seo en",    "Can My Dog Fly? Airline Rules, Checked and Sourced | MyDogCanFly"],
      ["titre seo fr",    "Voyager avec son chien en avion : règles des compagnies, sourcées"],
    ];
    let aveugles = 0;
    for (const [nom, phrase] of retirees) {
      if (!INTERDITS.some(([, re]) => re.test(phrase))) { aveugles++; echec("7 témoin", `aucun motif ne reconnaît la phrase retirée (${nom})`); }
    }
    if (!aveugles) ok(`7 témoin : les motifs reconnaissent les ${retirees.length} phrases retirées, mot intercalé et accents compris`);
  }
}

if (defauts) { console.error(`\n[affirmations-retirees] ÉCHEC — ${defauts} défaut(s)`); process.exit(1); }
console.log("\n[affirmations-retirees] les faits non prouvés sont retirés de toutes les surfaces CONSTRUITES — les sources héritées v1 restent non publiées (contrôle 1 bis) — et tout retour rougirait.");
