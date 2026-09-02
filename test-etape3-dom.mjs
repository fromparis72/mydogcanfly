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
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { MOTIF, jugerOccurrence } from "./inventaire-iata.mjs";
import { zonesDe } from "./test-lib/zones-publiques.mjs";

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

/* ---- 1. LE VOCABULAIRE D'HOMOLOGATION, DANS LES SOURCES ET DANS LE DOM --------------------- */
/* Le même vocabulaire interdit que l'inventaire, tenu ici sur les pages RENDUES. Les références
   licites — Live Animals Regulations, méthode de mesure, exigences publiées — restent permises. */
/* L'ANCIENNE EXPRESSION LOCALE A ÉTÉ RETIRÉE : elle vit maintenant dans l'instrument canonique,
   et c'est `jugerOccurrence()` qui tranche. Elle est conservée ici en commentaire d'histoire, non
   comme code, pour que la comparaison des chiffres d'avant et d'après reste lisible :
   IATA-approved/compliant/certified, homologué·e par l'IATA, caisse/cage homologuée, conforme
   IATA, norma/norme IATA, padrão IATA, aprovada pela IATA, aprobada por la IATA.
   Elle ne connaissait pas la famille « contenant + IATA », ni le pluriel « normas ». */
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
     portent plus AUCUNE affirmation interdite : c'est le contrat de l'étape 3, mesuré à 0.

     CE QUI RESTE PUBLIÉ EST NOMMÉ « DETTE PUBLIQUE RESTANTE », SANS PROVENANCE ATTRIBUÉE. Je n'ai
     relié mécaniquement aucune de ces 52 pages à sa source ; j'ai seulement vérifié trois cas à
     la main — Icelandair, airBaltic, Air Caraïbes —, ce qui ne fonde aucune règle. Écrire qu'elles
     « viennent nécessairement des données générées » serait une déduction que rien n'établit :
     l'inventaire dit où le vocabulaire vit dans les SOURCES, il ne dit pas quelle source a produit
     telle ligne d'une page. Le micro-lot éditorial ramènera ce registre à zéro, et c'est lui qui
     établira les provenances, une par une.

     On exige donc les deux choses qu'on peut établir sans deviner : ZÉRO dans les sources
     applicatives, et un REGISTRE EXACT de la dette encore publiée, qui ne peut plus bouger en
     silence. */
  /* On importe le relevé plutôt que de le lire d'un tube : `execFileSync` tronquait la sortie et
     rendait un JSON incomplet. */
  const { relever } = await import("./inventaire-iata.mjs");
  const releve = relever();
  const applicatives = releve.filter((r) => r.categorie === "affirmation_publique_interdite"
                                         || r.categorie === "reference_reglementaire_a_reformuler");
  if (applicatives.length) echec("1 sources applicatives", `${applicatives.length} affirmation(s) subsiste(nt), dont ${applicatives[0].fichier}:${applicatives[0].ligne}`);
  else ok("1 aucune affirmation interdite ne subsiste dans les sources applicatives");

  /* LE REGISTRE EXACT, COMPARÉ DANS LES DEUX SENS. Première rédaction fautive, nommée : elle
     n'exigeait que `publiantes.length === 52`. Attaque reproduite sur le contrôle réel — corriger
     une page fautive ET salir une page saine laisse le total à 52, donc VERT, avec un message
     mensonger « dette figée et non aggravée » ; ajouter une seconde affirmation sur une page
     DÉJÀ comptée passait de même. Un total ne fige rien : il fige une somme.
     Le registre porte donc, par CHEMIN PUBLIC, chaque formulation normalisée ET sa multiplicité,
     et la comparaison est bidirectionnelle. */
  const REGISTRE = "dette-iata-publiee.json";
  const registreBrut = JSON.parse(readFileSync(REGISTRE, "utf8"));
  const registre = registreBrut.pages;
  /* UN SEUL CONTRAT MESURE LA DETTE PUBLIQUE (contre-revue du 02/09/2026). Ce contrôle portait
     SA PROPRE expression du vocabulaire interdit et lisait le HTML BRUT : deux définitions et
     deux lectures pour la même question, donc deux nombres — et le verrou de lancement reposait
     sur le plus étroit. Il consulte désormais le jugement lexical de l'instrument canonique, et
     lit la page par ses ZONES PUBLIQUES DÉCODÉES, comme la garde des montants.
     LA ZONE EST SCELLÉE AVEC L'URL ET LA FORMULATION : sans elle, un défaut déplacé du corps vers
     une métadonnée passerait à total constant. */
  const vu = {};
  let jsonLdIllisibles = 0;
  for (const p of pages) {
    const url = p.slice(DIST.length).replace(/\/index\.html$/, "/");
    const html = readFileSync(p, "utf8");
    if (!/IATA|homolog/i.test(html)) continue;
    const z = zonesDe(html);
    jsonLdIllisibles += z.jsonLdInvalide;
    if (z.jsonLdInvalide) echec("1bis lecture", `${url} : ${z.jsonLdInvalide} bloc(s) JSON-LD illisible(s) — leur contenu n'a pas pu être jugé`);
    const par = {};
    for (const [zone, texte] of [["titre", z.titre], ["corps", z.corps], ["metas", z.metas], ["json-ld", z.jsonLd]]) {
      MOTIF.lastIndex = 0;
      for (const m of String(texte).matchAll(MOTIF)) {
        if (jugerOccurrence(m[0]) !== "interdite") continue;
        const f = `${zone} · ${m[0].toLowerCase().replace(/\s+/g, " ").trim()}`;
        par[f] = (par[f] || 0) + 1;
      }
    }
    if (Object.keys(par).length) vu[url] = par;
  }

  const comparer = (attendu, constate) => {
    const ecarts = [];
    for (const [url, formes] of Object.entries(attendu)) {
      if (!constate[url]) { ecarts.push(`page corrigée mais toujours au registre : ${url}`); continue; }
      for (const [f, n] of Object.entries(formes)) {
        const m = constate[url][f] ?? 0;
        if (m !== n) ecarts.push(`${url} « ${f} » : ${m} occurrence(s) contre ${n} au registre`);
      }
      for (const f of Object.keys(constate[url])) {
        if (!(f in formes)) ecarts.push(`${url} : formulation NON enregistrée « ${f} »`);
      }
    }
    for (const url of Object.keys(constate)) {
      if (!attendu[url]) ecarts.push(`page fautive ABSENTE du registre : ${url}`);
    }
    return ecarts;
  };

  const total = Object.values(vu).reduce((n, o) => n + Object.values(o).reduce((a, b) => a + b, 0), 0);
  /* ---- 1quinquies. LE PIPELINE VOIT CHAQUE ZONE, ET NE CONFOND PAS LICITE ET INTERDIT -------
   * Six mutations sur une PAGE RÉELLE, chacune exigeant son résultat exact. Sans elles, « un seul
   * contrat » resterait une intention : rien ne prouverait que les métadonnées et le JSON-LD sont
   * réellement lus, ni qu'un JSON-LD illisible rougit au lieu d'être compté zéro. */
  {
    const temoin = pages.find((p) => /\/airlines\/[^/]+\/index\.html$/.test(p.slice(DIST.length)));
    const brut = temoin ? readFileSync(temoin, "utf8") : "";
    const compter = (html) => {
      const z = zonesDe(html);
      const par = {};
      for (const [zone, texte] of [["titre", z.titre], ["corps", z.corps], ["metas", z.metas], ["json-ld", z.jsonLd]]) {
        MOTIF.lastIndex = 0;
        for (const m of String(texte).matchAll(MOTIF)) {
          if (jugerOccurrence(m[0]) !== "interdite") continue;
          par[zone] = (par[zone] ?? 0) + 1;
        }
      }
      return { par, illisibles: z.jsonLdInvalide };
    };
    if (!temoin) echec("1quinquies", "aucune fiche compagnie dans le dist : les mutations ne prouveraient rien");
    else {
      const base = compter(brut);
      const cas = [
        ["corps", brut.replace("<body", "<body data-x=\"1\"").replace(/(<body[^>]*>)/, "$1<p>caisse IATA</p>"), { corps: 1 }],
        ["metas", brut.replace("</head>", '<meta name="twitter:description" content="IATA crate"></head>'), { metas: 1 }],
        ["json-ld", brut.replace("</head>", '<script type="application/ld+json">{"d":"conforme à la norme IATA"}</scr' + 'ipt></head>'), { "json-ld": 1 }],
        ["licite", brut.replace(/(<body[^>]*>)/, "$1<p>IATA requirements</p>"), {}],
      ];
      const ratés = [];
      for (const [nom, html, attendu] of cas) {
        const { par } = compter(html);
        for (const z of ["titre", "corps", "metas", "json-ld"]) {
          const delta = (par[z] ?? 0) - (base.par[z] ?? 0);
          if (delta !== (attendu[z] ?? 0)) ratés.push(`${nom} : zone « ${z} » varie de ${delta}, attendu ${attendu[z] ?? 0}`);
        }
      }
      /* Un JSON-LD illisible n'est PAS un JSON-LD vide : c'est une zone dont on ne sait rien. */
      const casse = compter(brut.replace("</head>", '<script type="application/ld+json">{ ceci n\'est pas du JSON </scr' + 'ipt></head>'));
      if (casse.illisibles !== base.illisibles + 1) ratés.push(`json-ld illisible : ${casse.illisibles} signalé(s), attendu ${base.illisibles + 1}`);
      /* Un défaut DÉPLACÉ d'une zone à l'autre : total constant, zones différentes. */
      const dansCorps = compter(brut.replace(/(<body[^>]*>)/, "$1<p>caisse IATA</p>")).par;
      const dansMeta = compter(brut.replace("</head>", '<meta name="description" content="caisse IATA"></head>')).par;
      const totC = Object.values(dansCorps).reduce((a, b) => a + b, 0);
      const totM = Object.values(dansMeta).reduce((a, b) => a + b, 0);
      if (totC !== totM) ratés.push(`déplacement : totaux ${totC} et ${totM} — la contre-épreuve n'est pas à effectif constant`);
      else if ((dansCorps.corps ?? 0) === (dansMeta.corps ?? 0)) ratés.push("déplacement : la zone ne change pas, le sceau de zone ne sert à rien");

      if (ratés.length) { echec("1quinquies zones", `${ratés.length} écart(s)`); for (const r of ratés.slice(0, 6)) console.error(`      ${r}`); }
      else ok("1quinquies zones — corps, métas et JSON-LD sont lus séparément ; une référence licite ne compte pas ; "
        + "un JSON-LD illisible rougit ; un défaut déplacé change de zone à total constant");
    }
  }

  /* `--ecrire-registre` déplace la sentinelle. Il n'est PAS appelé par la CI : le registre ne
     bouge que par un geste délibéré, et le lot éditorial s'en servira pour le ramener vers zéro.
     Sans cette option, l'avancement dépendrait d'un script de brouillon hors du dépôt. */
  if (process.argv.includes("--ecrire-registre")) {
    const trie = Object.fromEntries(Object.keys(vu).sort().map((k) => [k, Object.fromEntries(Object.entries(vu[k]).sort())]));
    const ancien = JSON.parse(readFileSync(REGISTRE, "utf8"));
    writeFileSync(REGISTRE, JSON.stringify({ ...ancien, _mesure: { pages: Object.keys(trie).length, occurrences: total, dist_pages_html: pages.length }, pages: trie }, null, 2) + "\n");
    console.log(`  · registre RÉÉCRIT : ${Object.keys(trie).length} pages, ${total} occurrences`);
  }
  /* `_mesure` ÉTAIT DÉCORATIF : le contrôle ne lisait que `pages`, si bien qu'un total saboté ou
     un champ inconnu glissé à la racine ne changeaient rien. Les trois chiffres sont désormais
     confrontés au réel, et la forme racine est STRICTE — un champ qu'on n'attend pas est un
     champ que personne ne relit. */
  {
    const m = registreBrut._mesure ?? {};
    /* `_regle` est EXIGÉE, pas seulement tolérée : un registre qui ne dit pas COMMENT il a été
       mesuré laisse croire que son nombre est absolu. Celui-ci a changé de 108 à 538 sans qu'une
       seule page nouvelle soit fautive — c'est l'instrument qui a cessé d'être borgne. */
    const attendues = ["_commentaire", "_regle", "_mesure", "pages"];
    const inconnues = Object.keys(registreBrut).filter((k) => !attendues.includes(k));
    const manquantes = attendues.filter((k) => !(k in registreBrut));
    const ecartsMesure = [];
    if (m.pages !== Object.keys(vu).length) ecartsMesure.push(`_mesure.pages = ${m.pages} contre ${Object.keys(vu).length} réelles`);
    if (m.occurrences !== total) ecartsMesure.push(`_mesure.occurrences = ${m.occurrences} contre ${total} réelles`);
    if (m.dist_pages_html !== pages.length) ecartsMesure.push(`_mesure.dist_pages_html = ${m.dist_pages_html} contre ${pages.length} réelles`);
    if (inconnues.length) ecartsMesure.push(`champ(s) inconnu(s) à la racine : ${inconnues.join(", ")}`);
    if (manquantes.length) ecartsMesure.push(`champ(s) absent(s) : ${manquantes.join(", ")}`);
    if (ecartsMesure.length) echec("1bis-forme registre", ecartsMesure.join(" · "));
    else ok(`1bis-forme le registre déclare exactement ce qu'il mesure (${m.pages} pages, ${m.occurrences} occurrences, ${m.dist_pages_html} pages HTML)`);
  }

  const ecarts = comparer(registre, vu);
  if (ecarts.length) echec(`1bis registre de la dette (${ecarts.length} écart(s))`, ecarts.slice(0, 4).join(" · "));
  else ok(`1bis la dette publiée correspond EXACTEMENT au registre : ${Object.keys(vu).length} pages, ${total} occurrences`);

  /* LES DEUX ATTAQUES QUE LE TOTAL SEUL LAISSAIT PASSER, jouées sur des copies du constat. */
  {
    const urls = Object.keys(registre);
    const deplace = JSON.parse(JSON.stringify(vu));
    const premiere = urls[0], forme = Object.keys(registre[premiere])[0];
    delete deplace[premiere];                                  // une page corrigée…
    deplace["/une-page-jusque-la-saine/"] = { [forme]: 1 };     // …et une autre salie : total constant
    const vuDeplace = comparer(registre, deplace);
    if (!vuDeplace.length) echec("1ter défaut déplacé", "un défaut déplacé à effectif constant est accepté");
    else ok(`1ter un défaut déplacé à effectif constant est vu (${vuDeplace.length} écart(s))`);

    const enPlus = JSON.parse(JSON.stringify(vu));
    enPlus[premiere][forme] += 1;                               // une occurrence de plus, même page
    const vuEnPlus = comparer(registre, enPlus);
    if (!vuEnPlus.length) echec("1quater occurrence supplémentaire", "une occurrence de plus sur une page déjà comptée est acceptée");
    else ok("1quater une occurrence supplémentaire sur une page déjà enregistrée est vue");
  }
}

/* ---- 2. LA BIJECTION COMBINAISON → LIBELLÉ, DANS LES QUATRE LANGUES ------------------------ */
/* DEUX RÉDACTIONS FAUTIVES DE CE CONTRÔLE, NOMMÉES.
 *
 *   a. La première cherchait les libellés dans le HTML des pages d'accueil. Ils n'y sont pas et ne
 *      peuvent pas y être : mesuré, « Cabin OK » n'apparaît dans AUCUNE page. Les libellés de
 *      canal naissent dans le rapport du moteur, servi après une recherche.
 *   b. La seconde n'exerçait qu'un trajet, CDG→BKK. Mesuré : ses cinq cartes multicanales sont
 *      TOUTES en `011`. Les combinaisons `110`, `101` et `111` n'étaient donc jamais exécutées —
 *      les trois quarts de ce que l'étape 3 corrige n'étaient pas prouvés. Et le contrôle se
 *      contentait d'exiger que le libellé APPARTIENNE à la liste des quatre : une permutation de
 *      deux d'entre eux serait passée.
 *
 * On exige donc la BIJECTION exacte, combinaison par combinaison, et la COUVERTURE des quatre —
 * une preuve qui n'exercerait que ce qui existe déjà ne prouve rien de ce qu'on a changé. */
{
  const { loadKB } = await import("./packages/knowledge/src/index.ts");
  const { FinderRequest, runFinder } = await import("./packages/engine/src/index.ts");
  const kb = loadKB();

  /* LE LIBELLÉ ATTENDU DE CHAQUE COMBINAISON, écrit en toutes lettres et par langue. Il n'est PAS
     relu des fichiers de traduction : le relire reviendrait à comparer la production à elle-même,
     la garde circulaire déjà nommée trois fois dans ce lot. */
  const ATTENDU = {
    "110": { en: "Cabin and hold",  fr: "Cabine et soute", es: "Cabina y bodega", pt: "Cabine e porão" },
    "101": { en: "Cabin and cargo", fr: "Cabine et fret",  es: "Cabina y carga",  pt: "Cabine e carga" },
    "011": { en: "Hold and cargo",  fr: "Soute et fret",   es: "Bodega y carga",  pt: "Porão e carga" },
    "111": { en: "Cabin, hold and cargo", fr: "Cabine, soute et fret", es: "Cabina, bodega y carga", pt: "Cabine, porão e carga" },
  };
  /* Les cas de contrôle qui atteignent les quatre combinaisons — mesurés, pas supposés : un
     golden de 30 kg ne passe jamais en cabine, d'où le `011` exclusif du premier trajet. */
  const CAS = [
    { origin: "airport_cdg", destination: "airport_bkk", breed_id: "breed_golden_retriever", weight_kg: 30 },
    { origin: "airport_cdg", destination: "airport_bkk", breed_id: "breed_bichon_frise", weight_kg: 6 },
    { origin: "airport_cdg", destination: "airport_jfk", breed_id: "breed_bichon_frise", weight_kg: 6 },
    { origin: "airport_lhr", destination: "airport_lax", breed_id: "breed_bichon_frise", weight_kg: 6 },
  ];
  const LANGUES = ["en", "fr", "es", "pt"];
  /* LA COUVERTURE EST PAR LANGUE, PAS GLOBALE. Première rédaction fautive, nommée : elle
     accumulait les combinaisons vues dans UN SEUL ensemble, si bien qu'une combinaison observée
     en anglais couvrait les quatre langues. Une traduction qui disparaîtrait d'une seule langue
     serait passée — or c'est exactement le genre de repli silencieux que ce lot a déjà rencontré
     trois fois côté portugais. */
  const vuesPar = Object.fromEntries(LANGUES.map((l) => [l, new Set()]));
  const ecarts = [];
  let cartes = 0;
  for (const loc of LANGUES) {
    for (const c of CAS) {
      const r = runFinder(kb, FinderRequest.parse({
        origin: c.origin, destination: c.destination,
        dog: { breed_id: c.breed_id, weight_kg: c.weight_kg }, date: "2027-01-15", locale: loc,
      }));
      for (const a of r.airlines) {
        const combo = `${+a.cabin}${+a.hold}${+a.cargo}`;
        if ((combo.match(/1/g) ?? []).length < 2) continue;
        cartes++;
        vuesPar[loc].add(combo);
        if (a.label !== ATTENDU[combo][loc]) {
          ecarts.push(`${loc}/${combo} : « ${a.label} » au lieu de « ${ATTENDU[combo][loc]} »`);
        }
      }
    }
  }
  const trous = LANGUES.flatMap((l) => Object.keys(ATTENDU).filter((k) => !vuesPar[l].has(k)).map((k) => `${l}/${k}`));
  if (trous.length) echec("2 couverture des combinaisons", `jamais exercée(s) : ${trous.join(", ")}`);
  else if (ecarts.length) echec("2 bijection combinaison → libellé", `${ecarts.length} écart(s), dont ${ecarts[0]}`);
  else {
    const detail = LANGUES.map((l) => `${l}:${[...vuesPar[l]].sort().join("+")}`).join(" ");
    ok(`2 bijection exacte sur ${cartes} cartes, les 4 combinaisons exercées DANS CHAQUE langue (${detail})`);
  }

  /* LA COUVERTURE PAR LANGUE, VUE ROUGIR : si une combinaison manquait à une seule langue, le
     contrôle doit le dire. On le vérifie en retirant une combinaison d'une langue. */
  {
    const ampute = Object.fromEntries(LANGUES.map((l) => [l, new Set(vuesPar[l])]));
    ampute.pt.delete("111");
    const vus = LANGUES.flatMap((l) => Object.keys(ATTENDU).filter((k) => !ampute[l].has(k)).map((k) => `${l}/${k}`));
    if (!vus.length) echec("2ter couverture par langue", "une combinaison retirée d'une langue passe inaperçue");
    else ok(`2ter une combinaison absente d'UNE SEULE langue est vue (${vus.join(", ")})`);
  }

  /* LA PREUVE VUE ROUGIR : une permutation de deux libellés doit être détectée. Sans cela, la
     bijection ne serait qu'une appartenance à une liste. */
  {
    const permute = JSON.parse(JSON.stringify(ATTENDU));
    [permute["110"].fr, permute["101"].fr] = [permute["101"].fr, permute["110"].fr];
    let vu = 0;
    for (const c of CAS) {
      const r = runFinder(kb, FinderRequest.parse({
        origin: c.origin, destination: c.destination,
        dog: { breed_id: c.breed_id, weight_kg: c.weight_kg }, date: "2027-01-15", locale: "fr",
      }));
      for (const a of r.airlines) {
        const combo = `${+a.cabin}${+a.hold}${+a.cargo}`;
        if ((combo.match(/1/g) ?? []).length < 2) continue;
        if (a.label !== permute[combo].fr) vu++;
      }
    }
    if (!vu) echec("2bis permutation", "échanger « Cabine et soute » et « Cabine et fret » ne change rien");
    else ok(`2bis une permutation de deux libellés est vue (${vu} carte(s) en désaccord)`);
  }
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
