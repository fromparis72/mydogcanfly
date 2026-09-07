/**
 * LES ZONES PUBLIQUES D'UNE PAGE CONSTRUITE — UN SEUL LECTEUR, PARTAGÉ.
 *
 * POURQUOI IL VIT DANS SON PROPRE FICHIER (02/09/2026). Il était enfermé dans le détecteur de
 * montants, si bien que le contrôle du vocabulaire IATA lisait le HTML BRUT avec sa propre
 * méthode : deux lectures de la même page, donc deux comptes, et un registre de dette publique
 * bâti sur la plus étroite des deux. Ce qui compte comme « publié » ne peut pas dépendre de
 * l'instrument qui regarde.
 *
 * SON HISTOIRE, PARCE QU'ELLE EXPLIQUE SA FORME. Trois rédactions, chacune corrigeant une faute
 * que la précédente avait introduite en corrigeant la sienne.
 *
 *   1. UNE FENÊTRE JSDOM PAR PAGE, refermée ensuite. Correct, mais sur les 3 121 pages du site
 *      complet le contrôle est mort d'un dépassement de tas après onze minutes : `window.close()`
 *      ne rend pas tout.
 *
 *   2. UN `<div>` RÉUTILISÉ, où l'on réinjectait le HTML par `innerHTML`. La mémoire tenait, mais
 *      un `<div>` N'EST PAS UN DOCUMENT : « head » n'y existe pas comme élément, et ses enfants
 *      devenaient frères du corps. Il a donc fallu retirer `title` de l'arbre pour que le titre
 *      ne soit pas compté deux fois — et ce retrait emportait AUSSI les `<title>` de SVG, qui
 *      appartiennent pourtant au corps public et accessible. Contre-exemple mesuré le
 *      02/09/2026 : `<svg><title>IATA crate</title></svg>` disparaissait entièrement du corps, et
 *      un montant écrit dans ce même titre accessible échappait à la garde tarifaire. Le lecteur
 *      étant partagé, ce trou touchait DEUX portes de lancement.
 *
 *   3. LE `<div>` RÉUTILISÉ, MAIS LE TRI PAR ESPACE DE NOMS. Un `<title>` HTML et un `<title>`
 *      SVG portent le même nom de balise et ne sont PAS la même chose : le premier est le titre
 *      du document, le second est le nom accessible d'une image, lu à voix haute avec elle. Le
 *      parseur les distingue déjà — `namespaceURI` vaut `.../1999/xhtml` pour l'un,
 *      `.../2000/svg` pour l'autre. On ne retire donc du corps que les éléments de tête HTML
 *      (`title`, `meta`, `link`) et ce qui n'est jamais du texte public (`script`, `style`,
 *      `template`). Les titres SVG restent où ils sont : dans le corps.
 *
 * POURQUOI PAS UN VRAI DOCUMENT PAR PAGE, qui rendrait ce tri inutile. Parce que jsdom ne le
 * supporte pas à cette échelle, et c'est MESURÉ sur les 3 121 pages du site, à 3 Go de tas :
 *
 *   `new JSDOM(html)` par page, puis `window.close()`  ......  dépassement vers 1 000 pages
 *   `document.open()` / `write()` / `close()` réutilisé  ....  dépassement vers 250 pages
 *   `createHTMLDocument()` réutilisé  .......................  dépassement vers 500 pages
 *   `<div>` réutilisé + `innerHTML`  ........................  3 121 pages, 446 s, pic 2,9 Go
 *
 * Les trois premiers reconstruisent un document et ne le rendent jamais entièrement. Le tri par
 * espace de noms est le prix à payer pour que la garde puisse seulement s'exécuter.
 *
 * LE DÉCODAGE EST FAIT PAR LE PARSEUR, JAMAIS À LA MAIN : c'est lui qui sait que « &#65; » vaut
 * « A » et que « I » vaut « I ». Aucun filtre ne doit être posé sur le HTML brut AVANT ce
 * lecteur — un filtre posé avant le décodage annule le décodage.
 */
import { JSDOM } from "jsdom";
import { Parser, defaultTreeAdapter } from "parse5";   // le parseur que jsdom emploie lui-même

/* LA FENÊTRE UNIQUE DU PROCESSUS. Elle est créée à la première lecture et ne l'est plus jamais :
   c'est tout l'intérêt. Chaque page est réinjectée dans un `<div>` neuf de ce document. */
let doc = null;
function document_() {
  if (!doc) doc = new JSDOM("<!doctype html><html><head></head><body></body></html>").window.document;
  return doc;
}

const XHTML = "http://www.w3.org/1999/xhtml";
/* Les éléments de TÊTE, qui se retrouvent frères du corps parce qu'un `<div>` n'a pas de `<head>`.
   Le tri par espace de noms est ce qui empêche d'emporter un `<title>` SVG avec eux. */
const TETE_HTML = new Set(["title", "meta", "link", "base"]);
/* Ce qui n'est JAMAIS du texte public, dans quelque espace de noms que ce soit. */
const JAMAIS_PUBLIC = new Set(["script", "style", "template"]);

/* ---- LES ÉLÉMENTS QUI SÉPARENT DEUX MOTS À L'ÉCRAN ------------------------------------------
 *
 * POURQUOI CETTE LISTE EXISTE (02/09/2026). `textContent` recolle bout à bout le texte de tous
 * les nœuds, sans jamais rien intercaler. Deux textes que le navigateur affiche sur deux lignes
 * deviennent donc UN SEUL MOT, et une affirmation collée à la suivante cesse d'être reconnue :
 * « Rigid double-shell crate, » suivi de « IATA-compliant » se lisait bien, mais
 * « …en noscript » suivi de « caisse IATA » donnait « noscriptcaisse IATA », que plus aucune
 * limite de mot n'accroche. C'était un SOUS-COMPTE de la dette publiée, dans les deux gardes.
 *
 * POURQUOI PAS UN SÉPARATEUR PARTOUT, qui serait plus simple. Parce qu'un élément EN LIGNE ne
 * sépare pas deux mots : la page des caisses écrit `<strong>IATA</strong>-compliant`, que le
 * navigateur rend « IATA-compliant » en un seul mot. Séparer partout perdait cette occurrence, et
 * en inventait une sur la fiche JAL.
 *
 * ON REPRODUIT DONC LE RENDU : un saut de ligne à l'entrée et à la sortie des éléments de BLOC,
 * rien du tout pour les éléments en ligne. Mesuré sur les 3 121 pages du site construit :
 *   · affirmations IATA interdites dans le corps  389 → 394 — cinq occurrences réellement
 *     publiées que la soudure cachait (deux guides « équipement », les trois press kits) ;
 *   · montants relevés dans le corps  322 → 321 — un FAUX positif en moins : sur la fiche des
 *     Maldives, « Category 1 » suivi de « All breeds… » se soudait en « 1All », que le détecteur
 *     de montants lisait comme une quantité.
 * Les deux gardes y gagnent, et dans les deux sens. */
const BLOCS = new Set([
  "address", "article", "aside", "blockquote", "br", "caption", "dd", "details", "dialog", "div",
  "dl", "dt", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5",
  "h6", "header", "hgroup", "hr", "legend", "li", "main", "nav", "noscript", "ol", "optgroup",
  "option", "p", "pre", "section", "summary", "table", "tbody", "td", "tfoot", "th", "thead",
  "tr", "ul",
]);

/* DANS UN SVG, `title` et `desc` sont des chaînes ACCESSIBLES distinctes — elles ne sont pas
   affichées à côté du texte de l'image, elles sont annoncées séparément. Les souder au `<text>`
   voisin fabriquerait un mot qui n'existe nulle part. `text` sépare pour la même raison. */
const SEPARENT_SVG = new Set(["title", "desc", "text"]);

/* ---- LES TEXTES ACCESSIBLES PORTÉS PAR DES ATTRIBUTS -----------------------------------------
 *
 * POURQUOI CETTE ZONE EXISTE (contre-revue du 02/09/2026). Le raisonnement qui a réintégré
 * `<svg><title>` ne s'arrêtait pas au SVG : un texte lu à voix haute, ou affiché au survol, EST
 * publié, qu'il vive dans un nœud de texte ou dans un attribut. Le lecteur n'en voyait aucun.
 *
 * CE N'ÉTAIT PAS THÉORIQUE. `presskit/press-kit-es.html` publie
 * `alt="Bailey junto a su transportín IATA"` — une affirmation que le motif canonique interdit,
 * absente du registre. La dette annoncée à 162 pages / 543 occurrences n'était donc pas
 * exhaustive, et un défaut déplacé du corps vers un `alt` serait passé inaperçu.
 *
 * CE QUE LA ZONE LIT, ET POURQUOI CHACUN.
 *   `alt`               le texte de remplacement d'une image : lu à voix haute, affiché si
 *                       l'image manque. C'est le cas du press kit.
 *   `aria-label`        le nom accessible d'un contrôle sans texte visible.
 *   `aria-description`  sa description accessible.
 *   `title`             l'ATTRIBUT, à ne pas confondre avec l'élément : l'infobulle au survol,
 *                       visible pour tout le monde.
 *   `placeholder`       le texte affiché dans un champ vide. Il est vu à l'écran.
 *   `aria-placeholder`  son équivalent pour un contrôle qui n'est pas un `<input>`.
 *   `value`             UNIQUEMENT sur un bouton (`button`, `submit`, `reset`) : c'est alors son
 *                       libellé visible. Sur un champ de saisie, `value` est une donnée, pas un
 *                       libellé — la lire ferait entrer dans la dette ce que l'utilisateur tape.
 *
 * CE QU'ELLE NE LIT PAS, ET POURQUOI. `aria-labelledby` et `aria-describedby` ne portent pas de
 * texte : ils portent des IDENTIFIANTS renvoyant à des éléments dont le texte est DÉJÀ dans le
 * corps. Les lire compterait deux fois la même affirmation, et compterait des identifiants comme
 * du contenu. Même raison pour `href`, `src` et `data-*` : ce sont des adresses et des données,
 * pas des textes publiés — un slug d'URL est d'ailleurs déjà arbitré ailleurs.
 *
 * LES ATTRIBUTS SONT LUS APRÈS LE RETRAIT DES ÉLÉMENTS NON PUBLICS : un `title` porté par un
 * `<template>` ou par un `<link>` de tête n'est pas du contenu servi. */
const ATTRIBUTS_ACCESSIBLES = ["alt", "aria-label", "aria-description", "title", "placeholder", "aria-placeholder"];
const VALEUR_EST_UN_LIBELLE = new Set(["button", "submit", "reset"]);

/** Les textes accessibles du fragment, un par ligne, dans l'ordre du document. */
function attributsAccessibles(racine) {
  const out = [];
  for (const n of racine.querySelectorAll("*")) {
    for (const a of ATTRIBUTS_ACCESSIBLES) {
      const v = n.getAttribute?.(a);
      if (v) out.push(v);
    }
    if (n.namespaceURI === XHTML && n.localName === "input"
      && VALEUR_EST_UN_LIBELLE.has((n.getAttribute("type") ?? "").toLowerCase())) {
      const v = n.getAttribute("value");
      if (v) out.push(v);
    }
  }
  return out.join("\n");
}

/** Le texte tel qu'il se lit : les blocs séparent, les éléments en ligne ne séparent pas. */
function texteRendu(noeud, sortie) {
  for (let n = noeud.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 3) { sortie.push(n.data); continue; }
    if (n.nodeType !== 1) continue;
    const bloc = n.namespaceURI === XHTML ? BLOCS.has(n.localName) : SEPARENT_SVG.has(n.localName);
    if (bloc) sortie.push("\n");
    texteRendu(n, sortie);
    if (bloc) sortie.push("\n");
  }
  return sortie;
}

const METAS_PUBLIQUES = [
  'meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]',
  'meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[itemprop="description"]',
];

/**
 * LES ZONES PUBLIQUES, LUES APRÈS DÉCODAGE — jamais sur le HTML brut.
 *
 * `jsonLdInvalide` compte les blocs `application/ld+json` qui ne se parsent pas. Un bloc illisible
 * n'est PAS une zone vide : c'est une zone dont on ne sait rien, et l'appelant doit le savoir.
 */
export function zonesDe(html) {
  const d = document_();
  const racine = d.createElement("div");
  const brut = String(html ?? "");
  racine.innerHTML = brut;

  /* LES ATTRIBUTS DE `<html>` ET `<body>`, QUE LE `<div>` RÉUTILISÉ FAIT DISPARAÎTRE.
   *
   * Quatrième correction de ce lecteur, trouvée le 07/09/2026 par une contre-épreuve qui plaçait
   * une promesse dans `<body aria-label="…">` et attendait qu'elle soit vue : elle ne l'était pas.
   * La cause est la même que celle qui avait fait perdre les `<title>` de SVG — l'injection par
   * `innerHTML` dans un `<div>`. Le parseur y jette `html`, `head` et `body` en ne gardant que
   * leurs enfants : les attributs portés par ces balises partent avec elles.
   *
   * Un `aria-label` sur le corps est lu à voix haute par un lecteur d'écran comme n'importe quel
   * autre : c'est du texte public, et il échappait à TOUTES les portes qui emploient ce lecteur.
   * On les relève donc sur le HTML BRUT, avant l'injection — seule la première balise de chaque
   * sorte, et uniquement les attributs déjà reconnus comme accessibles ailleurs dans ce fichier. */
  /* CINQUIÈME CORRECTION, ET LA PRÉCÉDENTE ÉTAIT UN PARSEUR DE PLUS. La quatrième relevait ces
   * attributs à l'expression régulière `<body\b([^>]*)>` puis découpait les guillemets à la main.
   * Trois formes parfaitement valides lui échappaient, mesurées en contre-revue :
   *
   *     <body aria-label="&#x20AC;400 each way">          l'entité n'était pas décodée
   *     <body aria-label="€400 > confirmation required">  le « > » fermait la balise trop tôt
   *     <body aria-label=€400>                            sans guillemets, rien n'était vu
   *
   * Un prix rendu « €400 » à l'écran pouvait donc traverser toutes les gardes tarifaires. Écrire
   * un analyseur de HTML à la main dans le fichier dont la raison d'être est de n'en avoir qu'un
   * seul : c'est le défaut que ce fichier combat, commis à l'intérieur de lui-même.
   *
   * DEUX GESTES, ET AUCUN NE DEVINE. On délimite la balise ouvrante par un scanner qui suit les
   * guillemets — un « > » entre guillemets ne ferme rien — puis on confie ses attributs AU MÊME
   * PARSEUR que le reste : réinjectés sur un `<div>` neutre, ils sont décodés par le DOM, avec ou
   * sans guillemets, entités comprises. Le lecteur ne fait plus que déléguer. */
  /* SIXIÈME CORRECTION, ET LA CINQUIÈME ÉTAIT ENCORE UN SCANNER. Elle suivait les guillemets —
   * un « > » entre guillemets ne fermait plus la balise — mais elle ne connaissait pas le CONTEXTE
   * HTML : elle prenait le premier `<body` du fichier, fût-il dans un script ou un commentaire.
   *
   *     <script>const t = "<body aria-label=piege>";</script>
   *     <body aria-label="€400 each way">          → le lecteur rendait « piege »
   *
   * Le faux `<body>`, jamais servi à personne, masquait donc le vrai, et son `aria-label` avec.
   * Trois rédactions de suite — expression régulière, puis scanner naïf, puis scanner à guillemets
   * — ont buté sur la même chose : écrire un analyseur de HTML est un métier, et ce fichier existe
   * précisément pour n'en avoir qu'un.
   *
   * ON NE LOCALISE PLUS RIEN SOI-MÊME. `parse5` — le parseur que jsdom emploie sous le capot —
   * lit le document selon les règles HTML, commentaires, scripts et styles compris. Un adaptateur
   * d'arbre délègue tout au sien et s'interrompt dès que `<body>` est construit : à cet instant le
   * parseur a déjà traversé toute la tête, et le reste du document ne coûte rien.
   *
   * MESURÉ sur les 3 121 pages du site complet, le 07/09/2026 :
   *   parse complet de chaque page ......... 116 s
   *   arrêt dès `<body>` ..................... 4,8 s, 0,2 Mo de tas
   * Le parseur intégral coûtait vingt-quatre fois plus cher pour la même réponse — c'est ce qui
   * a été écrit ici, et l'arrêt anticipé a été retiré le jour même : voir la huitième correction,
   * qui nomme ce que cet arrêt ne voyait pas, et remesure le rapport. */
  /* HUITIÈME CORRECTION, ET L'ARRÊT ANTICIPÉ ÉTAIT UNE SURFACE EN MOINS. La sixième interrompait
   * le parseur dès que `<body>` était CRÉÉ, au nom d'une mesure — vingt-quatre fois moins cher.
   * Mais une balise `<html>` ou `<body>` rencontrée PLUS LOIN dans le document n'est pas jetée par
   * le navigateur : la règle HTML lui fait ADOPTER, sur l'élément déjà construit, les attributs
   * qu'il ne portait pas encore. Mesuré sur parse5 comme sur jsdom, le 07/09/2026 :
   *
   *     <html><body><p>x</p><body aria-label="€400 each way">…
   *       → le navigateur publie « €400 each way » sur le corps ; le lecteur rendait « »
   *
   * L'arrêt anticipé avait donc acheté sa vitesse avec une surface accessible réelle. Et la
   * vitesse elle-même était mal pesée : mesurés sous la même charge, parse complet et arrêt
   * anticipé sont dans un rapport de 6, non de 24 — 3,2 s contre 0,5 s pour 500 pages — et le
   * lecteur entier coûte 48 s sur ces mêmes 500 pages. Le parse complet ajoute 7 % au lecteur.
   * On lit donc les attributs APRÈS le parse, sur les éléments capturés, une fois que le parseur a
   * fini de leur adjoindre ce que le document leur adjoint. Plus d'exception, plus de signal. */
  const attributsDeLaRacine = () => {
    let elHtml = null, elBody = null;
    const adaptateur = Object.create(defaultTreeAdapter);
    adaptateur.createElement = function (nom, ns, attrs) {
      const el = defaultTreeAdapter.createElement(nom, ns, attrs);
      if (nom === "html" && !elHtml) elHtml = el;
      if (nom === "body" && !elBody) elBody = el;
      return el;
    };
    Parser.parse(brut, { treeAdapter: adaptateur });
    const attrsHtml = elHtml?.attrs ?? [], attrsBody = elBody?.attrs ?? [];
    /* SEPTIÈME CORRECTION, ET CELLE-CI NE VENAIT PLUS DE L'ANALYSE MAIS DU RANGEMENT. La sixième
     * cumulait les attributs des deux balises dans une `Map` indexée par nom. Or `<html>` et
     * `<body>` sont DEUX éléments, et rien n'interdit qu'ils portent le même attribut :
     *
     *     <html aria-label="€400 each way"><body aria-label="ordinary label">
     *       → le lecteur ne rendait que « ordinary label »
     *
     * Le second écrasait le premier, et un prix publié sur la racine disparaissait derrière un
     * libellé anodin porté par le corps. On ne fusionne donc plus par nom : on filtre chaque liste
     * sur les attributs reconnus comme accessibles, et on concatène les deux, dans l'ordre du
     * document — les deux occurrences sont conservées, parce que les deux sont lues à voix haute. */
    const accessibles = (attrs) => (attrs ?? [])
      .filter(({ name }) => ATTRIBUTS_ACCESSIBLES.includes(name.toLowerCase()))
      .map(({ value }) => value)
      .filter((v) => v);
    return [...accessibles(attrsHtml), ...accessibles(attrsBody)];
  };
  const attributsRacine = attributsDeLaRacine();

  /* LE TITRE DU DOCUMENT, ET LUI SEUL. Un `querySelector("title")` nu ramènerait le PREMIER titre
     de l'arbre, qui peut être celui d'un SVG placé dans le corps. On exige l'espace de noms HTML. */
  const titre = [...racine.querySelectorAll("title")]
    .find((t) => t.namespaceURI === XHTML)?.textContent ?? "";

  /* Les métadonnées sont cherchées dans tout le fragment : `itemprop` vit souvent dans le corps.
     Un `<meta>` ne porte pas de texte, il n'y a donc aucun double compte avec le corps. */
  const metas = METAS_PUBLIQUES.flatMap((s) => [...racine.querySelectorAll(s)])
    .map((m) => m.getAttribute("content") ?? "").join("\n");

  /* LE JSON-LD EST PARSÉ, PUIS PARCOURU DANS SES CHAÎNES — clés comprises comme valeurs, parce
   * qu'un montant ou une affirmation peut vivre dans l'une comme dans l'autre, à n'importe quelle
   * profondeur. `JSON.parse` fait le décodage des échappements « \uXXXX ». */
  const chaines = [];
  let jsonLdInvalide = 0;
  const parcourir = (v) => {
    if (typeof v === "string") { chaines.push(v); return; }
    if (Array.isArray(v)) { v.forEach(parcourir); return; }
    if (v && typeof v === "object") { for (const [k, x] of Object.entries(v)) { chaines.push(k); parcourir(x); } }
  };
  for (const s of racine.querySelectorAll('script[type="application/ld+json"]')) {
    try { parcourir(JSON.parse(s.textContent ?? "")); } catch { jsonLdInvalide++; }
  }
  const jsonLd = chaines.join("\n");

  /* LE CORPS VISIBLE : le texte du fragment, dont on retire de l'ARBRE — pas du texte brut
     découpé aux balises — la tête HTML et ce qui n'est jamais public. Ces deux listes sont
     COURTES et le restent : chaque nom qu'on y ajoute est du contenu public qu'on cesse de voir,
     et le `<title>` SVG est précisément ce qu'on a cessé de voir en les confondant. */
  for (const n of [...racine.querySelectorAll("*")]) {
    const nom = n.localName;
    if (JAMAIS_PUBLIC.has(nom) || (n.namespaceURI === XHTML && TETE_HTML.has(nom))) n.remove();
  }
  const corps = texteRendu(racine, []).join("");
  const attributs = [...attributsRacine, attributsAccessibles(racine)].filter(Boolean).join("\n");

  racine.innerHTML = "";            // on ne garde rien d'une page à l'autre
  return { titre, corps, metas, jsonLd, attributs, jsonLdInvalide };
}
