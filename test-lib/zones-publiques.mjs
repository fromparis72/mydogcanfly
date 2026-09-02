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
  racine.innerHTML = String(html ?? "");

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

  racine.innerHTML = "";            // on ne garde rien d'une page à l'autre
  return { titre, corps, metas, jsonLd, jsonLdInvalide };
}
