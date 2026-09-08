#!/usr/bin/env node
/**
 * CE QUE LE SITE ANNONCE — et qui doit exister.
 *
 *   node test-annonce-du-site.mjs        (exige un site construit sous packages/ui/dist)
 *
 * POURQUOI CE HARNAIS EXISTE. La plus vieille leçon de ce chantier est un portugais ANNONCÉ avant
 * d'exister : des `hreflang` promettaient des pages qu'aucun fichier ne servait. Depuis, la
 * vérification n'a jamais été qu'un script lancé à la main dans une conversation. Rien, dans le
 * dépôt, n'empêchait la régression de revenir.
 *
 * CE QU'IL VÉRIFIE, DANS LES DEUX SENS :
 *   · tout `hreflang` annoncé vise une page RÉELLEMENT construite ;
 *   · toute page construite est listée au sitemap de SA langue ;
 *   · aucun sitemap n'annonce une URL sans page.
 * Un seul sens ne suffirait pas : annoncer trop et annoncer trop peu sont deux défauts distincts.
 *
 * UNE EXIGENCE EST AUJOURD'HUI INFALSIFIABLE, ET JE LE DIS PLUTÔT QUE DE LA MAQUILLER.
 * « chaque guide annonce EXACTEMENT les langues où sa clé existe » est vraie, mais le corpus est
 * devenu symétrique — 72 clés × 4 langues, aucune asymétrie nulle part sur le site. Muter
 * `languesDe()` pour qu'elle renvoie les quatre langues sans les constater ne changerait donc RIEN
 * à la sortie : la garantie ne peut pas être mise en défaut tant que les données sont symétriques.
 * Elle est conservée parce qu'elle redeviendra falsifiable au premier contenu partiel — mais elle
 * n'est PAS présentée comme éprouvée, et aucune contre-épreuve ne la revendique.
 *
 * LES DEUX GARANTIES RÉELLEMENT ÉPROUVABLES sont celles que les contre-épreuves visent :
 *   `href-annonce`  l'adresse annoncée est fabriquée autrement → « vise une page construite » tombe
 *   `sitemap`       une famille disparaît du sitemap           → « listée au sitemap de sa langue » tombe
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { zonesDe } from "./test-lib/zones-publiques.mjs";   // le lecteur canonique, jamais un cinquième

const DIST = "packages/ui/dist";
const LANGUES = ["en", "fr", "es", "pt"];
const SOURCE_GUIDES = "packages/ui/src/content/guides";
const SITE = "https://mydogcanfly.com";

let echecs = 0;
const dire = (m) => process.stdout.write(m + "\n");
const exiger = (label, cond, detail = "") => {
  if (cond) return;
  echecs++;
  process.stdout.write(`  ✗ ${label}${detail ? `\n      ${detail}` : ""}\n`);
};

/* ---- JAMAIS VERT FAUTE DE MATIÈRE ------------------------------------------------------------
 * Sans site construit, tous les contrôles ci-dessous passeraient sur des ensembles vides. Un
 * harnais qui se tait parce qu'il n'a rien à lire est pire qu'un harnais absent. */
const pagesHtml = (d) => {
  if (!existsSync(d)) return 0;
  let n = 0;
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) n += pagesHtml(join(d, e.name));
    else if (e.name.endsWith(".html")) n++;
  }
  return n;
};
const total = pagesHtml(DIST);
if (total < 2000) {
  process.stderr.write(`[annonce] ÉCHEC — site absent ou partiel (${total} pages HTML sous ${DIST}). `
    + "Ce harnais lit les octets du site : sans site, il ne prouverait rien.\n");
  process.exit(1);
}

/* ---- L'inventaire de ce qui EXISTE ------------------------------------------------------------ */
const cheminDe = (url) => url.replace(SITE, "");
const pageExiste = (url) => {
  const p = cheminDe(url).split("#")[0];
  return existsSync(join(DIST, p, "index.html")) || existsSync(join(DIST, p));
};

/* Les guides, groupés par CLÉ — leurs slugs sont traduits, donc grouper par slug n'apparierait
   rien entre langues. C'est une erreur que j'ai commise avant de l'écrire ici. */
const languesParCle = new Map();
for (const l of LANGUES) {
  for (const f of readdirSync(join(SOURCE_GUIDES, l)).filter((x) => /\.mdx?$/.test(x))) {
    const k = /^key:\s*"([^"]+)"/m.exec(readFileSync(join(SOURCE_GUIDES, l, f), "utf8"))?.[1];
    if (!k) continue;
    if (!languesParCle.has(k)) languesParCle.set(k, new Map());
    languesParCle.get(k).set(l, f.replace(/\.mdx?$/, ""));
  }
}
exiger("le corpus de guides est lisible et non vide", languesParCle.size >= 62, `${languesParCle.size} clés`);

const dossierGuides = (l) => (l === "en" ? join(DIST, "travel-hub") : join(DIST, l, "travel-hub"));
const pagesGuides = [];
for (const l of LANGUES) {
  const d = dossierGuides(l);
  if (!existsSync(d)) continue;
  for (const s of readdirSync(d)) {
    const f = join(d, s, "index.html");
    if (existsSync(f)) pagesGuides.push({ locale: l, slug: s, fichier: f });
  }
}
exiger("les pages de guides construites sont là", pagesGuides.length >= 240, `${pagesGuides.length} pages`);

/* ---- 1. TOUT CE QUI EST ANNONCÉ EXISTE -------------------------------------------------------- */
const ALTERNATE = /<link rel="alternate" hreflang="([a-z-]+)" href="([^"]+)"/g;
const morts = [];
const sansAlternate = [];
let alternatesLus = 0;
for (const pg of pagesGuides) {
  const html = readFileSync(pg.fichier, "utf8");
  const alts = [...html.matchAll(ALTERNATE)];
  if (!alts.length) { sansAlternate.push(`${pg.locale}/${pg.slug}`); continue; }
  for (const [, lang, url] of alts) {
    alternatesLus++;
    if (!pageExiste(url)) morts.push(`${pg.locale}/${pg.slug} → ${lang} ${url}`);
  }
}
exiger("chaque page de guide déclare ses alternates", sansAlternate.length === 0,
  sansAlternate.slice(0, 5).join(", "));
exiger("tout `hreflang` annoncé vise une page réellement construite",
  morts.length === 0, `${morts.length} mort(s) · ${morts.slice(0, 3).join(" · ")}`);
exiger("les alternates ont bien été lus — sinon le contrôle ci-dessus porterait sur le vide",
  alternatesLus >= pagesGuides.length, `${alternatesLus} alternates pour ${pagesGuides.length} pages`);

/* ---- 2. L'ANNONCE ÉPOUSE LA DISPONIBILITÉ RÉELLE ----------------------------------------------
 * INFALSIFIABLE AUJOURD'HUI (voir l'en-tête) : le corpus est symétrique. Conservée pour le jour où
 * il ne le sera plus, et revendiquée par AUCUNE contre-épreuve. */
const slugVersCle = new Map();
for (const [k, m] of languesParCle) for (const [l, s] of m) slugVersCle.set(`${l}/${s}`, k);
const ecarts = [];
for (const pg of pagesGuides) {
  const cle = slugVersCle.get(`${pg.locale}/${pg.slug}`);
  if (!cle) continue;
  const attendues = [...languesParCle.get(cle).keys()].sort();
  const annoncees = [...new Set([...readFileSync(pg.fichier, "utf8").matchAll(ALTERNATE)]
    .map((m) => m[1]).filter((l) => l !== "x-default"))].sort();
  if (attendues.join(",") !== annoncees.join(","))
    ecarts.push(`${pg.locale}/${pg.slug} : annonce ${annoncees.join("+")}, existe en ${attendues.join("+")}`);
}
exiger("chaque guide annonce EXACTEMENT les langues où sa clé existe",
  ecarts.length === 0, ecarts.slice(0, 4).join(" · "));

/* ---- 3. LES SITEMAPS, DANS LES DEUX SENS ------------------------------------------------------ */
const urlsSitemap = {};
for (const l of LANGUES) {
  const f = join(DIST, `sitemap-${l}.xml`);
  exiger(`le sitemap ${l} existe`, existsSync(f), f);
  if (!existsSync(f)) continue;
  urlsSitemap[l] = new Set([...readFileSync(f, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => (m[1].endsWith("/") ? m[1] : `${m[1]}/`)));
}
const absentes = [];
for (const pg of pagesGuides) {
  const prefixe = pg.locale === "en" ? "/" : `/${pg.locale}/`;
  const url = `${SITE}${prefixe}travel-hub/${pg.slug}/`;
  if (!urlsSitemap[pg.locale]?.has(url)) absentes.push(`${pg.locale}/${pg.slug}`);
}
exiger("toute page de guide construite est listée au sitemap de SA langue",
  absentes.length === 0, `${absentes.length} absente(s) · ${absentes.slice(0, 3).join(" · ")}`);

const fantomes = [];
for (const l of LANGUES) for (const u of urlsSitemap[l] ?? []) if (!pageExiste(u)) fantomes.push(`${l} → ${u}`);
exiger("aucun sitemap n'annonce une URL sans page construite",
  fantomes.length === 0, `${fantomes.length} fantôme(s) · ${fantomes.slice(0, 3).join(" · ")}`);

/* ---- Verdict ---------------------------------------------------------------------------------- */
dire("");
dire(`  site : ${total} pages HTML · guides : ${pagesGuides.length} pages, ${languesParCle.size} clés`);
dire(`  alternates lus : ${alternatesLus} · URL au sitemap : ${Object.values(urlsSitemap).reduce((a, s) => a + s.size, 0)}`);
/* ---- 6. LES CHIFFRES QUE LE SITE ANNONCE SUR LUI-MÊME ----------------------------------------
 *
 * `HomeSections.astro` majorait chaque compte de 20 % avant de l'afficher, et le press kit
 * portait quatre valeurs écrites à la main dont deux SUPÉRIEURES au corpus réel. Le contrôle
 * porte donc sur les trois surfaces à la fois — accueil, page press kit, documents
 * téléchargeables — parce que corriger la première en laissant les autres est exactement ce qui
 * s'est produit : la page dynamique avait été refaite, les quatre HTML statiques non.
 *
 * LE SUFFIXE « + » EST INTERDIT sur ces chiffres. « 102+ » se lit « au moins 102 » : c'est une
 * borne inférieure présentée comme un compte, et c'est ce que faisait `boost()` en arrondissant
 * vers le haut. Un compte exact n'a pas besoin d'être arrondi. */
{
  /* LES COMPTES VIENNENT DE LA SOURCE BRUTE, pas d'un import de la base. Ce contrôle tourne en
     Node pur — `node test-annonce-du-site.mjs`, sans `tsx` — et `@mydogcanfly/knowledge` est du
     TypeScript : l'importer faisait tomber le contrôle sur un `ERR_MODULE_NOT_FOUND`. Or
     `raw/objects.json` est précisément ce que `normalize()` reçoit : même origine, un cran plus
     tôt, lisible sans compilateur. */
  const brut = JSON.parse(readFileSync(join("packages", "knowledge", "raw", "objects.json"), "utf8"));
  const REELS = {
    compagnies: brut.airlines.length, pays: brut.countries.length,
    races: brut.breeds.length, aeroports: brut.airports.length,
  };
  dire(`\n=== 6. Les chiffres annoncés — base : ${REELS.compagnies} compagnies, ${REELS.pays} pays, ${REELS.races} races, ${REELS.aeroports} aéroports ===`);

  /* Les majorations exactes que `boost()` produisait, plus les valeurs jadis écrites à la main. */
  const FAUX = ["120+", "160+", "200+", "300+", "90+", "250+", "169"];
  /* LE LECTEUR EST CELUI DU DÉPÔT, ET C'EST LA SECONDE FOIS QU'IL FAUT LE DIRE (07/09/2026).
   *
   * Ce paragraphe transformait le HTML avec sa PROPRE fonction : scripts et balises effacés à
   * l'expression régulière, entités décodées à moitié. Il ne voyait donc ni les métadonnées, ni
   * le JSON-LD, ni les attributs accessibles. Une seule ligne suffisait à le rendre aveugle :
   *
   *     <meta name="description" content="€400 each way">
   *
   * la phrase est publique, et le contrôle passait à côté.
   *
   * `test-lib/zones-publiques.mjs` rend exactement ces cinq zones depuis le 02/09/2026. J'en ai
   * écrit une quatrième version pour le §7 — c'est l'annexe 11 — puis une CINQUIÈME ici, quelques
   * heures après avoir documenté pourquoi il ne fallait pas. Écrire son propre lecteur est mon
   * réflexe, pas un oubli : il faut le nommer comme tel pour cesser de le refaire.
   *
   * LES DOCUMENTS SONT LUS DANS `dist/`, pas dans `public/`. C'est là qu'ils sont réellement
   * publiés, après la copie du build ; lire la source revient à faire confiance à cette copie
   * plutôt qu'à la vérifier. */
  const zonesJointes = (chemin) => {
    const z = zonesDe(readFileSync(chemin, "utf8"));
    return { texte: [z.titre, z.corps, z.metas, z.jsonLd, z.attributs].join("\n"), invalides: z.jsonLdInvalide ?? 0 };
  };

  const surfaces = [];
  let jsonLdIllisibles = 0;
  const ajouter = (nom, f) => {
    if (!existsSync(f)) return;
    const { texte, invalides } = zonesJointes(f);
    jsonLdIllisibles += invalides;
    surfaces.push([nom, texte]);
  };
  for (const l of LANGUES) {
    ajouter(`accueil ${l}`, l === "en" ? join(DIST, "index.html") : join(DIST, l, "index.html"));
    ajouter(`press kit ${l}`, l === "en" ? join(DIST, "presskit", "index.html") : join(DIST, l, "presskit", "index.html"));
  }
  /* LES QUATRE DOSSIERS TÉLÉCHARGEABLES SONT DANS LE BALAYAGE (07/09/2026, arbitrage final).
   *
   * Ils en avaient été SORTIS le matin même, sur décision de Philippe : ils décrivaient un
   * produit antérieur, et il avait choisi de les rétablir en l'état pour les traiter à part. Le
   * contrôle se contentait alors d'annoncer qu'il y en avait huit, non audités.
   *
   * La contre-revue a ouvert les fichiers et y a trouvé ce que mon inventaire avait manqué : un
   * TARIF — « 400 € par trajet, sur cette route » — dans les quatre langues, en gros caractères.
   * C'est la famille de défaut que le lot « Tarifs » traitait comme bloquant le lancement. La
   * décision de rétablir avait été prise sur ma liste incomplète ; elle a été reprise dès que le
   * fait a été connu.
   *
   * Un document proposé au téléchargement est une surface publique comme une autre, et une
   * surface publique qu'aucun contrôle ne lit finit par dériver. */
  for (const l of LANGUES) ajouter(`press kit téléchargeable ${l}`, join(DIST, "presskit", `press-kit-${l}.html`));

  dire(`  surfaces lues (${surfaces.length}) : ${surfaces.map(([n]) => n).join(", ")}`);
  exiger("les trois surfaces publiées sont lues (accueil, page press kit, documents téléchargeables)", surfaces.length >= 12,
    `${surfaces.length} surface(s) — le contrôle ne saurait pas conclure`);

  /* Un compte majoré ne doit apparaître nulle part. */
  const majores = [];
  for (const [nom, texte] of surfaces)
    for (const f of FAUX)
      if (new RegExp(`(?<![\\d.,])${f.replace("+", "\\+")}(?![\\d])`).test(texte)) majores.push(`${nom} : « ${f} »`);
  exiger("aucun compte majoré ni écrit à la main ne subsiste", majores.length === 0, majores.slice(0, 4).join(" | "));

  /* Et le suffixe « + » collé à l'un des quatre comptes réels. */
  const avecPlus = [];
  for (const [nom, texte] of surfaces)
    for (const n of Object.values(REELS))
      if (new RegExp(`(?<![\\d.,])${n}\\+`).test(texte)) avecPlus.push(`${nom} : « ${n}+ »`);
  exiger("aucun compte réel n'est suivi d'un « + »", avecPlus.length === 0, avecPlus.slice(0, 4).join(" | "));

  /* Les comptes réels sont bien SERVIS, sans quoi les deux interdictions ci-dessus seraient
     satisfaites par une page qui n'annonce plus rien du tout. */
  const accueils = surfaces.filter(([n]) => n.startsWith("accueil"));
  const servis = accueils.filter(([, t]) =>
    Object.values(REELS).filter((n) => new RegExp(`(?<![\\d.,])${n}(?![\\d])`).test(t)).length >= 3);
  exiger("chaque accueil sert au moins trois des quatre comptes réels", servis.length === accueils.length,
    `${servis.length}/${accueils.length} accueil(s)`);

  /* LES CHIFFRES NE SONT PAS LE SEUL MENSONGE POSSIBLE (07/09/2026, second passage).
   *
   * Le contrôle qui précède ne cherchait que des NOMBRES. Il est resté vert devant quatre
   * dossiers de presse téléchargeables qui décrivaient un produit antérieur en entier : série de
   * caisse « 500 / XL » retirée des fiches, chaleur et froid « lus sur les données de la race »
   * retirés du Travel DNA, « meilleures compagnies », « score de compatibilité »,
   * « recommandations sur mesure », et surtout « chaque règle renvoie à une documentation
   * officielle » — quand 45 canaux sur 302 portent une citation propre.
   *
   * J'avais corrigé cinq tuiles chiffrées et déclaré la surface traitée. C'est la quatrième fois
   * dans ce chantier que je masque une surface en en laissant une autre. Les quatre documents
   * sont retirés ; ce qui suit garde la page qui reste. */
  /* LA MOITIÉ D'UNE PHRASE N'EST PAS LA PHRASE. Ces quatre motifs ont d'abord rougi sur le titre
     de l'accueil — « Chaque règle est sourcée et datée — OU SIGNALÉE À CONFIRMER ». Cette phrase
     est exactement ce que le lot défend : elle nomme les deux états. Ce qui est interdit, c'est
     l'affirmation universelle SANS son alternative ; l'alternative est donc cherchée dans ce qui
     suit, et sa présence disculpe la phrase. Sans cela, le contrôle aurait poussé à retirer une
     formulation honnête pour se satisfaire lui-même. */
  /* L'ALTERNATIVE DISCULPE, ET ELLE EST CHERCHÉE HORS DU MOTIF. Une première rédaction la
     plaçait en négation à l'intérieur : `{0,5}` étant variable, le moteur reculait jusqu'à
     trouver une découpe où la négation passait, et la phrase honnête rougissait quand même. La
     règle est appliquée APRÈS le match, sur ce qui suit — lisible, et sans retour arrière. */
  const ALTERNATIVE = /ou signal[ée]e? [àa] confirmer|or flagged as unconfirmed|o se marca como por confirmar|ou [ée] assinalada a confirmar|[àa] confirmer|to be checked|por confirmar|a confirmar/i;
  const PROMESSES = [
    /* « NOMME » MANQUAIT, et c'est le contrôle qui me l'a appris : la légende « chaque règle nomme
       son autorité » existait dans les QUATRE langues, et seul le portugais — qui dit « indica » —
       était vu. Un verbe oublié dans une liste de verbes est un trou aussi large que la liste. */
    ["source universelle", /chaque r[èe]gle[,\s]+(?:[^\s]+\s+){0,5}(?:porte|renvoie|indique|nomme|est sourc[ée]e)/i],
    /* « EACH » ET « EVERY » disent la même chose et le motif n'en connaissait qu'un : la légende
       anglaise dit « EACH rule names its authority ». Le témoin de non-vacuité l'a vu — c'est la
       seconde fois dans ce paragraphe qu'un mot manquant ouvre un trou de la taille du motif. */
    ["source universelle", /(?:every|each) rule[,\s]+(?:[^\s]+\s+){0,5}(?:carries|names|is sourced|traced)/i],
    ["source universelle", /cada norma[,\s]+(?:[^\s]+\s+){0,5}(?:incluye|indica|nombra|remite|tiene fuente)/i],
    ["source universelle", /cada regra[,\s]+(?:[^\s]+\s+){0,5}(?:tem|traz|indica|remete)/i],
    ["révision périodique", /revérifi[ée]es? tous les \d+ jours|re-checked every \d+ days|se revisan cada \d+ d[ií]as/i],
    ["score", /score de compatibilit[ée]|taux de compatibilit[ée]|compatibility score|porcentaje de compatibilidad/i],
    ["meilleure compagnie", /meilleures? compagnies?|best airlines? for your dog|mejores? aerol[ií]neas? para tu perro/i],
    ["recommandation", /recommandations? (?:sur mesure|personnalis[ée]es?)|tailored recommendations?|recomendaciones? a medida/i],
    ["physiologie publiée", /chaleur et froid\s+(?:[^\s]+\s+){0,3}lus sur les donn[ée]es de la race|heat and cold\s+(?:[^\s]+\s+){0,3}read from the breed/i],
    ["caisse non sourcée", /500\s*\/\s*XL|94\s*×\s*64/i],
    /* UN TARIF PRÉSENTÉ COMME UN FAIT. « 400 € par trajet, sur cette route » vivait dans les
       quatre dossiers téléchargeables, en gros caractères, alors que le lot « Tarifs » avait
       retiré ces montants de toutes les surfaces du site. Il a survécu parce que ces documents
       n'étaient lus par aucun contrôle. Le motif ne vise QUE les montants présentés comme un
       prix de transport : les chiffres de marché du dossier ($2,4 md, 4,0 md) portent un appel
       de note et restent licites. */
    ["tarif publié", /(?:€\s?\d[\d.,]*|\d[\d.,]*\s?€)[^.]{0,40}(?:par trajet|each way|por trayecto|por trecho)/i],
    ["tarif publié", /(?:par trajet|each way|por trayecto|por trecho)[^.]{0,40}(?:€\s?\d[\d.,]*|\d[\d.,]*\s?€)/i],
    ["origine de chaque réponse", /montre d'o[ùu] vient chaque r[ée]ponse|shows where each answer comes from|muestra de d[óo]nde viene cada respuesta/i],
  ];
  const promesses = [];
  for (const [nom, texte] of surfaces)
    for (const [quoi, re] of PROMESSES) {
      const m = re.exec(texte);
      if (!m) continue;
      /* Une affirmation universelle SUIVIE de son alternative nomme les deux états : c'est la
         formulation que ce lot installe partout, pas celle qu'il interdit. Le titre d'accueil
         « Chaque règle est sourcée et datée — OU SIGNALÉE À CONFIRMER » en est le cas type ; sans
         cette règle, le contrôle aurait poussé à retirer une phrase honnête pour se satisfaire. */
      if (quoi === "source universelle" && ALTERNATIVE.test(texte.slice(m.index, m.index + m[0].length + 90))) continue;
      promesses.push(`${nom} [${quoi}] : « ${m[0].slice(0, 55)} »`);
    }
  exiger("aucune surface d'annonce ne promet une vérification universelle, un score ou une recommandation",
    promesses.length === 0, promesses.slice(0, 5).join(" | "));

  /* UN JSON-LD ILLISIBLE EST UN ÉCHEC, comme dans `étape3` §1bis et le §7 des affirmations
     retirées : annoncer « cinq zones lues » en ignorant ce compte reviendrait à dire qu'on a
     regardé une zone dont on n'a rien pu tirer. */
  exiger("aucun bloc JSON-LD illisible sur les surfaces d'annonce", jsonLdIllisibles === 0,
    `${jsonLdIllisibles} bloc(s) non analysable(s) — la zone annoncée comme lue ne l'est pas`);

  /* LES PDF SONT RÉTABLIS SANS MODIFICATION, SUR ORDRE DE PHILIPPE (08/09/2026).
     Ce contrôle exigeait leur absence : ils portaient le même tarif (« 400 € par trajet ») et les
     mêmes promesses que les HTML, et il ne sait pas lire un PDF — leur composant `<doc-page>` ne
     rend aucune hauteur hors de son environnement d'origine, mes essais de régénération donnaient
     des pages blanches de 900 octets. Philippe a ordonné leur rétablissement tel quel. La garde
     ne peut donc pas garantir leur contenu, et elle ne prétend pas le faire : elle DIT, à chaque
     passage, que quatre documents sont publiés sans avoir été relus. Ce qu'elle garantit, c'est
     l'ordre lui-même — « sans modification » : chaque PDF est identique, à l'octet, à l'original
     d'avant le premier retrait (empreintes SHA-256 figées ci-dessous, blobs `ff44ea2b`,
     `a8ba76a6`, `a337cf04`, `7d626021` du dépôt). Tout changement de contenu est un mouvement
     nommé, pas une dérive. */
  /* EMPREINTES ENTIÈRES. Ma première rédaction en figeait dix-sept caractères — seize premiers
     et le soixante-quatrième, un `cut` mal lu — et comparait aux dix-sept premiers : la garde a
     rougi sur des PDF pourtant identiques. Une sentinelle tronquée à la main est une sentinelle
     fausse ; on fige l'empreinte complète, calculée par le même code qui la vérifie. */
  const PDF_ORIGINAUX = {
    en: "e892c802adb28b2c5bffaf68bb14f651e9bdbf9b5e15d7bc749d85022032135b",
    fr: "6dac30e0e23aa7e9f68d336f936340f87fb7a0c50c7666b2d19a10b1c6b60362",
    es: "84faf173aec7af68b64cb8f1b1b025d700c2216b7ae7f4307eb644b5616c9c3c",
    pt: "47370f823d32a49579f4f5feb531c1966bd8384094f54aeb9f84e071d2a4ef97",
  };
  const pdfDepot = LANGUES.map((l) => [l, join("packages", "ui", "public", "presskit", `press-kit-${l}.pdf`)]);
  const pdfDist = LANGUES.map((l) => [l, join(DIST, "presskit", `press-kit-${l}.pdf`)]);
  const manquants = [...pdfDepot, ...pdfDist].filter(([, f]) => !existsSync(f)).map(([, f]) => f);
  exiger("les quatre dossiers de presse PDF sont publiés — dépôt et dist — comme Philippe l'a ordonné",
    manquants.length === 0, `${manquants.length} manquant(s) : ${manquants.slice(0, 2).join(", ")}`);
  const modifies = [...pdfDepot, ...pdfDist].filter(([l, f]) => existsSync(f)
    && createHash("sha256").update(readFileSync(f)).digest("hex") !== PDF_ORIGINAUX[l]).map(([, f]) => f);
  exiger("chaque PDF est identique à l'octet à l'original — « sans modification » est l'ordre",
    modifies.length === 0, `${modifies.length} modifié(s) : ${modifies.slice(0, 2).join(", ")}`);
  console.log(`  ⚠ ${pdfDist.length} dossier(s) de presse PDF publié(s) SANS avoir été relus par ce contrôle (ordre de Philippe, 08/09/2026) — ils décrivent l'ancien produit.`);

  /* LES QUATRE HTML AUSSI, ET CE CONTRÔLE NE DOIT PAS ÊTRE UN VERT MUET. Il les relit avec ses
     motifs et ne rougit pas — mais le contre-test navigateur de Codex (08/09/2026) y a lu des
     promesses de l'ancien produit que ces motifs ne couvrent pas : « Decision Engine™ », « The
     right decision in minutes », « Verified information », « book with confidence », « aligned
     with IATA Live Animals Regulations ». Philippe a décidé de les garder tels quels. On ne
     rougit donc pas sur ordre, et on ne se tait pas non plus : on compte ces phrases et on le dit. */
  const CONNUES_NON_COUVERTES = [
    /Decision Engine/i, /right decision in minutes|bonne décision en quelques minutes|decisión correcta en minutos|decisão certa em minutos/i,
    /Verified information|Informations vérifiées|Información verificada|Informações verificadas/i,
    /with confidence|en confiance|con confianza|com confiança/i,
    /IATA Live Animals Regulations/i,
  ];
  let connues = 0;
  for (const l of LANGUES) {
    const f = join("packages", "ui", "public", "presskit", `press-kit-${l}.html`);
    if (!existsSync(f)) continue;
    const z = zonesDe(readFileSync(f, "utf8"));
    const tout = [z.titre, z.corps, z.metas, z.jsonLd, z.attributs].join("\n");
    for (const re of CONNUES_NON_COUVERTES) connues += (tout.match(new RegExp(re.source, re.flags + "g")) ?? []).length;
  }
  console.log(`  ⚠ ${LANGUES.length} dossier(s) de presse HTML publié(s) tels quels (décision de Philippe, 08/09/2026) : ${connues} phrase(s) de l'ancien produit relevée(s) par le contre-test, non couvertes par les motifs de ce contrôle.`);

  /* NON-VACUITÉ des motifs : ils doivent reconnaître les phrases réellement retirées. */
  {
    const retirees = [
      "Chaque règle porte sa source, sa date de vérification et un niveau de confiance.",
      "Every rule, policy and requirement is sourced, checked and kept up to date",
      "Les compagnies sont revérifiées tous les 90 jours",
      "Un verdict avec son taux de compatibilité",
      "Best airlines for your dog",
      "tailored recommendations",
      "Cabine, soute, cargo, chaleur et froid — lus sur les données de la race.",
      "500 / XL",
      "400 € par trajet, sur cette route",
      "€400 each way, on this route",
      "400 € por trayecto, en esta ruta",
      "400 € por trecho, nesta rota",
      "Étape par étape, aller et retour — chaque règle nomme son autorité.",
      "Step by step, outbound and return — each rule names its authority.",
      "Paso a paso, ida y vuelta — cada norma nombra su autoridad.",
      "Passo a passo, ida e volta — cada regra indica sua autoridade.",
      "montre d'où vient chaque réponse",
    ];
    const aveugles = retirees.filter((ph) => !PROMESSES.some(([, re]) => re.test(ph)));
    const disculpees = retirees.filter((ph) => ALTERNATIVE.test(ph));
    exiger("témoin : aucune phrase retirée ne porte l'alternative qui la disculperait",
      disculpees.length === 0, `${disculpees.length} phrase(s) : ${disculpees.slice(0, 2).join(" | ")}`);
    exiger("témoin : les motifs reconnaissent les phrases retirées du dossier de presse",
      aveugles.length === 0, `${aveugles.length} non reconnue(s) : ${aveugles.slice(0, 2).join(" | ")}`);
  }

  /* DEUX ATTAQUES SUR LES ZONES QUE LE LECTEUR MAISON NE VOYAIT PAS. Elles portent sur un HTML
     de presse RÉEL, copié, muté, relu par le même chemin de code : une métadonnée qui reprend le
     tarif, un attribut accessible qui reprend la promesse universelle. Sans le lecteur canonique,
     les deux passaient inaperçues — c'est très exactement le trou signalé en contre-revue. */
  {
    const reel = join(DIST, "presskit", "press-kit-en.html");
    if (!existsSync(reel)) {
      exiger("un dossier de presse réel est disponible pour les attaques", false,
        "press-kit-en.html absent du dist — les attaques ne prouveraient rien");
    } else {
      const brut = readFileSync(reel, "utf8");
      const muter = (html) => {
        const z = zonesDe(html);
        return [z.titre, z.corps, z.metas, z.jsonLd, z.attributs].join("\n");
      };
      const vu = (texte, quoi) => PROMESSES.some(([nom, re]) => nom === quoi && re.test(texte));

      const parMeta = muter(brut.replace("</head>", '<meta name="description" content="€400 each way, on this route"></head>'));
      exiger("attaque : un tarif réintroduit dans une métadonnée est vu", vu(parMeta, "tarif publié"),
        "la métadonnée échappe au balayage — le lecteur ne lit pas les cinq zones");

      const parAttribut = muter(brut.replace("<body", '<body aria-label="Every rule is sourced, checked and kept up to date"'));
      exiger("attaque : une promesse réintroduite dans un attribut accessible est vue",
        vu(parAttribut, "source universelle"),
        "l'attribut accessible échappe au balayage");

      /* Et le témoin qui empêche les deux précédents de passer pour vrais sans rien prouver :
         le document NON muté ne doit déclencher ni l'un ni l'autre. */
      const intact = muter(brut);
      exiger("témoin : le document réel, non muté, ne déclenche aucune des deux attaques",
        !vu(intact, "tarif publié") && !vu(intact, "source universelle"),
        "le document porte déjà l'une des deux phrases — les attaques ne prouveraient rien");
    }
  }

  /* ATTAQUES — les deux interdictions doivent savoir échouer. */
  {
    const [, unAccueil] = accueils[0] ?? [];
    if (unAccueil) {
      const falsifie = unAccueil.replace(new RegExp(`(?<![\\d.,])${REELS.compagnies}(?![\\d])`), "120+");
      const vuFalsifie = FAUX.some((f) => new RegExp(`(?<![\\d.,])${f.replace("+", "\\+")}(?![\\d])`).test(falsifie));
      exiger("attaque : un compte falsifié en « 120+ » est vu", vuFalsifie,
        "la falsification passe inaperçue — l'interdiction ne garde rien");
      const avecSuffixe = unAccueil.replace(new RegExp(`(?<![\\d.,])${REELS.compagnies}(?![\\d])`), `${REELS.compagnies}+`);
      const vuSuffixe = new RegExp(`(?<![\\d.,])${REELS.compagnies}\\+`).test(avecSuffixe);
      exiger("attaque : le retour du suffixe « + » est vu", vuSuffixe,
        "le « + » réintroduit passe inaperçu");
    }
  }
}

if (echecs) {
  process.stderr.write(`\n[annonce] ÉCHEC — ${echecs} contrôle(s) non tenu(s)\n`);
  process.exit(1);
}
dire("[annonce] ce que le site annonce existe, et ce qui existe est annoncé.");
