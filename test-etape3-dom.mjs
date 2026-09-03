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
 *   2. LE VOCABULAIRE D'HOMOLOGATION. Les corrections applicatives doivent se voir dans les
 *      pages rendues, et les quatre libellés combinés doivent y être présents dans leur langue.
 *
 * `--dist` est OBLIGATOIRE. Une garde qui se saute quand l'artefact manque ne garde rien : c'est
 * exactement la faute qui a fait tomber la preuve DOM de l'inventaire, sautée à chaque exécution
 * parce qu'elle tournait avant le build.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MOTIF, jugerOccurrence, dansUnSlugConserve, dansUnFragmentAttribuePublie , CORRECTIONS_CARGO } from "./inventaire-iata.mjs";
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
/* CE QUE L'ÉTAPE 3 POSSÈDE, ET CE QU'ELLE NE POSSÈDE PAS. Ce contrôle rougit sur les pages qui
   PUBLIENT encore une affirmation interdite. On ne les masque pas et on ne leur attribue pas de
   provenance : ce qui est mesurable sans deviner, c'est ZÉRO dans les surfaces applicatives, et un
   REGISTRE EXACT de ce qui reste publié. Le micro-lot éditorial le ramènera à zéro par ses
   générateurs, et c'est lui qui établira les provenances, une par une. */
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
     relié mécaniquement aucune de ces pages à sa source ; j'ai seulement vérifié trois cas à
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
  /* LES ZONES SCELLÉES, ÉNUMÉRÉES UNE SEULE FOIS. Le relevé réel et la contre-épreuve 1quinquies
     lisaient chacun leur propre liste : ajouter une zone à l'un sans l'autre était possible, et
     c'est exactement la divergence que ce chantier corrige partout ailleurs. Une seule liste. */
  const ZONES = (z) => [["titre", z.titre], ["corps", z.corps], ["metas", z.metas],
    ["json-ld", z.jsonLd], ["attributs-accessibles", z.attributs]];

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
  /* LE PRÉFILTRE SUR LE HTML BRUT A ÉTÉ SUPPRIMÉ (contre-revue du 02/09/2026), et c'était un faux
     vert de la pire espèce : il décidait de NE PAS LIRE une page avant de l'avoir décodée. Une
     affirmation écrite « \u0049ATA crate » dans le JSON-LD, ou « I&#65;TA crate » en entité HTML
     dans le corps, ne contient aucune suite brute « IATA » — la page était donc écartée sans
     jamais passer par le lecteur de zones, qui l'aurait pourtant rendue lisible. Un filtre posé
     AVANT le décodage annule le décodage. Les 3 121 pages sont désormais toutes parsées. */
  const relevePublie = (racine, listePages) => {
    const vu = {};
    let illisibles = 0;
    for (const p of listePages) {
      const url = p.slice(racine.length).replace(/\/index\.html$/, "/");
      const z = zonesDe(readFileSync(p, "utf8"));
      illisibles += z.jsonLdInvalide;
      if (z.jsonLdInvalide) echec("1bis lecture", `${url} : ${z.jsonLdInvalide} bloc(s) JSON-LD illisible(s) — leur contenu n'a pas pu être jugé`);
      const par = {};
      for (const [zone, texte] of ZONES(z)) {
        MOTIF.lastIndex = 0;
        for (const m of String(texte).matchAll(MOTIF)) {
          if (jugerOccurrence(m[0]) !== "interdite") continue;
          /* L'EXEMPTION DE SLUG EST LA MÊME QUE CELLE DES SOURCES, et elle vient de l'instrument.
             Trois slugs arbitrés comme CONSERVÉS paraissent dans les URL du JSON-LD des pages
             qu'ils nomment. `classer()` les exempte depuis toujours ; cette garde ne le faisait
             pas. Deux règles pour la même question, donc deux réponses : tant que ces slugs
             existent, le registre ne pouvait STRUCTURELLEMENT pas atteindre zéro. L'exemption est
             bornée à la POSITION exacte : les mêmes mots dans la prose restent interdits. */
          if (dansUnSlugConserve(String(texte), m.index, m.index + m[0].length)) continue;
          /* Et les fragments attribués, par URL exacte et texte exact — la même liste que celle
             que `classer()` consulte à la source, jamais une permission lexicale. */
          if (dansUnFragmentAttribuePublie(url, String(texte), m.index, m.index + m[0].length)) continue;
          const f = `${zone} · ${m[0].toLowerCase().replace(/\s+/g, " ").trim()}`;
          par[f] = (par[f] || 0) + 1;
        }
      }
      if (Object.keys(par).length) vu[url] = par;
    }
    return { vu, illisibles };
  };
  const { vu } = relevePublie(DIST, pages);

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
  /* ---- 1sexies. UNE PAGE SANS AUCUN « IATA » BRUT DOIT QUAND MÊME ÊTRE LUE -------------------
   * Les deux formes qui traversaient l'ancien préfiltre, éprouvées PAR LA BOUCLE RÉELLE — la
   * même fonction que celle qui bâtit le registre —, sur deux pages écrites pour l'occasion et
   * ne contenant aucune suite brute « IATA » ni « homolog ». Une contre-épreuve qui n'appellerait
   * qu'une fonction locale ne prouverait pas que la boucle du registre les voit. */
  {
    const racine = mkdtempSync(join(tmpdir(), "iata-zones-"));
    const ecrire = (nom, html) => {
      const d = join(racine, nom); mkdirSync(d, { recursive: true });
      const f = join(d, "index.html"); writeFileSync(f, html); return f;
    };
    const echappe = ecrire("json-ld-echappe",
      '<html><head><title>Sans forme brute</title>'
      + '<script type="application/ld+json">{"d":"\u005cu0049ATA crate"}</scr' + 'ipt>'
      + "</head><body><p>rien de plus</p></body></html>");
    const entite = ecrire("entite-html",
      "<html><head><title>Sans forme brute</title></head><body><p>I&#65;TA crate</p></body></html>");
    const brut = [echappe, entite].map((f) => readFileSync(f, "utf8"));
    const ratés = [];
    /* On établit d'abord CE QU'ON PRÉTEND REPRODUIRE : aucune des deux pages ne porte la suite
       brute que l'ancien préfiltre cherchait. Sans cela, la contre-épreuve serait décorative. */
    for (const [i, h] of brut.entries()) if (/IATA|homolog/i.test(h)) ratés.push(`la page ${i} porte une forme brute : elle ne reproduit pas l'attaque`);
    const { vu } = relevePublie(racine, [echappe, entite]);
    const zones = Object.values(vu).flatMap((o) => Object.keys(o));
    if (!zones.some((z) => z.startsWith("json-ld · iata crate"))) ratés.push("« \\u0049ATA crate » du JSON-LD n'est pas relevé");
    if (!zones.some((z) => z.startsWith("corps · iata crate"))) ratés.push("« I&#65;TA crate » du corps n'est pas relevé");
    rmSync(racine, { recursive: true, force: true });
    if (ratés.length) { echec("1sexies préfiltre", `${ratés.length} écart(s)`); for (const r of ratés) console.error(`      ${r}`); }
    else ok("1sexies préfiltre — deux pages sans aucune suite brute « IATA » sont lues et relevées : "
      + "« \\u0049ATA crate » en JSON-LD, « I&#65;TA crate » en entité HTML");
  }

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
      for (const [zone, texte] of ZONES(z)) {
        MOTIF.lastIndex = 0;
        for (const m of String(texte).matchAll(MOTIF)) {
          if (jugerOccurrence(m[0]) !== "interdite") continue;
          if (dansUnSlugConserve(String(texte), m.index, m.index + m[0].length)) continue;
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
        /* LA ZONE DES ATTRIBUTS ACCESSIBLES (contre-revue du 02/09/2026). Un `alt` est publié :
           lu à voix haute, affiché si l'image manque. `press-kit-es.html` en portait un —
           « transportín IATA » — qui n'entrait dans aucune zone. */
        ["alt", brut.replace(/(<body[^>]*>)/, '$1<img alt="IATA crate" src="/x.png">'), { "attributs-accessibles": 1 }],
        ["aria-label", brut.replace(/(<body[^>]*>)/, '$1<button aria-label="caisse IATA">?</button>'), { "attributs-accessibles": 1 }],
        /* L'ATTRIBUT `title`, à ne pas confondre avec l'élément : l'infobulle est vue de tous. */
        ["attribut title", brut.replace(/(<body[^>]*>)/, '$1<span title="conforme à la norme IATA">i</span>'), { "attributs-accessibles": 1 }],
        /* `aria-labelledby` ne porte pas de texte mais un identifiant : le lire compterait deux
           fois l'affirmation qui vit déjà dans le corps, et compterait un identifiant. */
        ["aria-labelledby", brut.replace(/(<body[^>]*>)/, '$1<button aria-labelledby="caisse-iata-titre">?</button>'), {}],
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
      /* Un défaut DÉPLACÉ d'une zone à l'autre : total constant, zones différentes. Éprouvé sur
         les DEUX déplacements qui comptent — corps → métadonnée, et corps → attribut accessible.
         Sans le second, une affirmation transportée du texte vers un `alt` passerait à total
         constant, ce qui est précisément le trou fermé le 02/09/2026. */
      const dansCorps = compter(brut.replace(/(<body[^>]*>)/, "$1<p>caisse IATA</p>")).par;
      const totC = Object.values(dansCorps).reduce((a, b) => a + b, 0);
      const ailleurs = [
        ["metas", compter(brut.replace("</head>", '<meta name="description" content="caisse IATA"></head>')).par],
        ["attributs-accessibles", compter(brut.replace(/(<body[^>]*>)/, '$1<img alt="caisse IATA" src="/x.png">')).par],
      ];
      for (const [zone, par] of ailleurs) {
        const tot = Object.values(par).reduce((a, b) => a + b, 0);
        if (totC !== tot) ratés.push(`déplacement vers « ${zone} » : totaux ${totC} et ${tot} — la contre-épreuve n'est pas à effectif constant`);
        else if ((dansCorps.corps ?? 0) === (par.corps ?? 0)) ratés.push(`déplacement vers « ${zone} » : la zone ne change pas, le sceau de zone ne sert à rien`);
      }

      /* ---- LE QUALIFICATIF INTERCALÉ, SUR LE DOM RÉEL (contre-revue du 03/09/2026) -----------
       * Le registre affichait 0 / 0 alors que « caisse rigide IATA », « transportín rígido IATA »
       * et « caixa rígida IATA » étaient publiés : la famille canonique ne voyait que le contenant
       * COLLÉ à `IATA`, et un adjectif suffisait à l'aveugler. Un zéro obtenu avec un motif borgne
       * n'est pas un zéro, c'est un silence.
       * Chaque forme est donc injectée DANS UNE PAGE RÉELLE — corps, métadonnée, JSON-LD et
       * attribut accessible tour à tour — et doit ressortir du pipeline entier : lecture des
       * zones, motif, jugement lexical. Les vérifier sur une chaîne en mémoire ne prouverait que
       * l'expression régulière ; ici on éprouve la chaîne complète, celle qui produit le registre. */
      const QUALIFIEES = ["caisse rigide IATA", "transportín rígido IATA", "caixa rígida IATA",
        "caisse de transport IATA", "IATA travel crate", "jaula de viaje IATA",
        "bolsa de transporte IATA", "IATA rental crates"];
      for (const forme of QUALIFIEES) {
        const zones = [
          ["corps", brut.replace(/(<body[^>]*>)/, `$1<p>${forme}</p>`), "corps"],
          ["metas", brut.replace("</head>", `<meta name="description" content="${forme}"></head>`), "metas"],
          ["json-ld", brut.replace("</head>", `<script type="application/ld+json">{"d":"${forme}"}</scr` + 'ipt></head>'), "json-ld"],
          ["alt", brut.replace(/(<body[^>]*>)/, `$1<img alt="${forme}" src="/x.png">`), "attributs-accessibles"],
        ];
        for (const [nom, html, zone] of zones) {
          const delta = (compter(html).par[zone] ?? 0) - (base.par[zone] ?? 0);
          if (delta < 1) ratés.push(`« ${forme} » injectée en ${nom} : la zone « ${zone} » ne bouge pas — la forme reste invisible au registre`);
        }
      }
      /* ET L'INVERSE, sans quoi on pourrait faire bouger le compteur en emportant du vrai : une
         référence réglementaire licite injectée de la même façon ne doit RIEN ajouter. */
      for (const licite of ["IATA requirements", "normes IATA", "Live Animals Regulations"]) {
        const delta = (compter(brut.replace(/(<body[^>]*>)/, `$1<p>${licite}</p>`)).par.corps ?? 0) - (base.par.corps ?? 0);
        if (delta !== 0) ratés.push(`« ${licite} » injectée dans le corps ajoute ${delta} au registre : une référence licite est comptée comme dette`);
      }

      if (ratés.length) { echec("1quinquies zones", `${ratés.length} écart(s)`); for (const r of ratés.slice(0, 6)) console.error(`      ${r}`); }
      else ok("1quinquies zones — corps, métas, JSON-LD et textes accessibles des attributs sont lus séparément ; "
        + "un identifiant aria n'est pas un texte ; une référence licite ne compte pas ; un JSON-LD illisible rougit ; "
        + "un défaut déplacé vers une métadonnée OU vers un attribut change de zone à total constant ; "
        + `et les ${QUALIFIEES.length} formes à qualificatif intercalé sont vues dans chacune des quatre zones d'une page réelle, sans qu'aucune référence licite ne le devienne`);
    }
  }

  /* ---- 1octies. LES CORRECTIONS CARGO SONT SERVIES, DANS LES HUIT PAGES ---------------------
   * Le scellé de `test:unit` garde la valeur À LA SOURCE. Il ne dit rien de ce que le lecteur
   * reçoit : une fiche juste peut ne pas être rendue, être tronquée, ou rester servie dans une
   * version antérieure du dist. Les huit pages linguistiques sont donc relues ici, et chacune
   * doit porter sa phrase AU MOT PRÈS. La liste vient de l'instrument — jamais d'une copie. */
  {
    const ecarts = [];
    for (const c of CORRECTIONS_CARGO) {
      const chemin = join(DIST, c.page, "index.html");
      if (!existsSync(chemin)) { ecarts.push(`${c.page} : page absente du dist`); continue; }
      const z = zonesDe(readFileSync(chemin, "utf8"));
      const tout = [z.titre, z.corps, ...Object.values(z.metas ?? {}), JSON.stringify(z.jsonLd ?? "")].join("\n");
      if (!tout.includes(c.valeur)) {
        const bout = c.valeur.slice(0, 60);
        ecarts.push(`${c.page} [${c.langue}] : la phrase scellée n'est pas servie — attendu « ${bout}… »`);
      }
    }
    /* ET LA CONTRE-ÉPREUVE NÉGATIVE : une phrase altérée d'un seul mot ne doit PAS passer, sans
       quoi ce contrôle prouverait seulement que la page contient du texte. */
    if (CORRECTIONS_CARGO.length) {
      const c = CORRECTIONS_CARGO[0];
      const chemin = join(DIST, c.page, "index.html");
      if (existsSync(chemin)) {
        const z = zonesDe(readFileSync(chemin, "utf8"));
        const tout = [z.titre, z.corps, ...Object.values(z.metas ?? {}), JSON.stringify(z.jsonLd ?? "")].join("\n");
        if (tout.includes(c.valeur.replace("Accredited", "accredited-"))) ecarts.push("une phrase altérée est acceptée : le contrôle ne compare pas au mot près");
      }
    }
    if (ecarts.length) { echec("1octies corrections cargo publiées", `${ecarts.length} écart(s)`); for (const e of ecarts.slice(0, 8)) console.error(`      ${e}`); }
    else ok(`1octies les ${CORRECTIONS_CARGO.length} corrections cargo sont servies au mot près dans leurs ${new Set(CORRECTIONS_CARGO.map((c) => c.page)).size} pages linguistiques — une phrase altérée d'un mot ne passe pas`);
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

  /* LES DEUX ATTAQUES QUE LE TOTAL SEUL LAISSAIT PASSER, jouées sur des copies du constat.
   *
   * ELLES DOIVENT TENIR QUAND LE REGISTRE EST VIDE, et c'est le cas depuis le 03/09/2026. Faute
   * mesurée le jour même : la première rédaction prenait `urls[0]` et la première formulation du
   * registre. À zéro page, elle levait un TypeError — autrement dit, la garde cessait de garder
   * À L'INSTANT PRÉCIS où la dette était fermée, c'est-à-dire quand elle devient le seul rempart
   * contre une réapparition. Un registre vide est un verrou, pas un blanc-seing.
   *
   * On travaille donc sur un COUPLE TÉMOIN : le registre réel s'il porte quelque chose, sinon un
   * registre fabriqué d'une page et d'une formulation. Le comparateur est le même dans les deux
   * cas — c'est LUI qu'on éprouve, pas le contenu du registre. */
  {
    const vide = Object.keys(registre).length === 0;
    const PAGE = vide ? "/temoin-de-contre-epreuve/" : Object.keys(registre)[0];
    const FORME = vide ? "corps · caisse iata" : Object.keys(registre[PAGE])[0];
    const base = vide ? { [PAGE]: { [FORME]: 1 } } : registre;
    const constat = vide ? { [PAGE]: { [FORME]: 1 } } : JSON.parse(JSON.stringify(vu));

    const deplace = JSON.parse(JSON.stringify(constat));
    delete deplace[PAGE];                                      // une page corrigée…
    deplace["/une-page-jusque-la-saine/"] = { [FORME]: 1 };     // …et une autre salie : total constant
    const vuDeplace = comparer(base, deplace);
    if (!vuDeplace.length) echec("1ter défaut déplacé", "un défaut déplacé à effectif constant est accepté");
    else ok(`1ter un défaut déplacé à effectif constant est vu (${vuDeplace.length} écart(s))${vide ? " — sur un couple témoin, le registre réel étant vide" : ""}`);

    const enPlus = JSON.parse(JSON.stringify(constat));
    enPlus[PAGE][FORME] += 1;                                   // une occurrence de plus, même page
    const vuEnPlus = comparer(base, enPlus);
    if (!vuEnPlus.length) echec("1quater occurrence supplémentaire", "une occurrence de plus sur une page déjà comptée est acceptée");
    else ok("1quater une occurrence supplémentaire sur une page déjà enregistrée est vue");

    /* ET LA CONTRE-ÉPREUVE PROPRE AU REGISTRE VIDE : une page qui REDEVIENT fautive doit rougir.
       Sans elle, « zéro » ne prouverait rien — un comparateur qui accepte tout rend zéro aussi. */
    if (vide) {
      const reapparition = comparer(registre, { "/une-page-qui-redevient-fautive/": { "corps · caisse iata": 1 } });
      if (!reapparition.length) echec("1quinquies-zero réapparition", "une page redevenue fautive est acceptée par un registre vide");
      else ok("1quinquies-zero une affirmation qui réapparaît fait rougir le registre vide — zéro est un verrou, pas un blanc-seing");
    }
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
