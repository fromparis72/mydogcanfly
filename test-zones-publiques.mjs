#!/usr/bin/env node
/**
 * LES CONTRE-ÉPREUVES DU LECTEUR DE ZONES PUBLIQUES.
 *
 *   node test-zones-publiques.mjs
 *
 * POURQUOI CE FICHIER EXISTE, ET POURQUOI IL EST SEUL. `zonesDe()` est le SEUL lecteur de page
 * du dépôt : la garde des montants et la garde du vocabulaire IATA s'en servent toutes deux, et
 * ce sont deux portes de lancement. Un trou dans ce lecteur est donc un faux vert DOUBLE. Son
 * contrat ne peut pas être éprouvé pour moitié dans un harnais et pour moitié dans l'autre —
 * deux contrats de la même chose finissent toujours par diverger. Il est éprouvé ICI, une fois,
 * et les deux détecteurs sont appelés sur les mêmes pages témoins.
 *
 * CE QUI L'A PROVOQUÉ (contre-revue du 02/09/2026). Pour éviter un dépassement de tas sur les
 * 3 121 pages, le lecteur réinjectait le HTML dans un `<div>` réutilisé. Un `<div>` n'est pas un
 * document : « head » n'y existe pas comme élément, ses enfants devenaient frères du corps, et il
 * a fallu retirer `title` de l'arbre pour que le titre ne soit pas compté deux fois. Ce retrait
 * emportait AUSSI les `<title>` de SVG — qui sont du contenu public, lu à voix haute avec
 * l'image. Mesuré : `<svg><title>IATA crate</title></svg>` disparaissait du corps, et un montant
 * écrit au même endroit échappait à la garde tarifaire.
 *
 * CE HARNAIS NE LIT AUCUN SITE CONSTRUIT : il tourne dans `test:unit`, sur chaque pull request,
 * sans build. Le rejeu sur les 3 121 pages réelles, lui, reste le fait des deux gardes complètes.
 */
import { zonesDe } from "./test-lib/zones-publiques.mjs";
import { trouver } from "./test-lib/montants.mjs";
import { MOTIF, jugerOccurrence } from "./inventaire-iata.mjs";

let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

/** Les affirmations INTERDITES d'un texte, jugées par l'instrument canonique. */
const interdites = (texte) => {
  MOTIF.lastIndex = 0;
  return [...String(texte).matchAll(MOTIF)].map((m) => m[0]).filter((t) => jugerOccurrence(t) === "interdite");
};

/* ---- 1. LE TITRE DU DOCUMENT EST DANS SA ZONE, ET NULLE PART AILLEURS ---------------------- */
/* Le double compte est une faute mesurée de la rédaction 2 : le titre paraissait dans le corps,
   si bien qu'un défaut de titre semblait déplacé alors qu'il ne l'était pas. */
{
  const z = zonesDe('<html><head><title>Caisse IATA</title></head><body><p>Bonjour</p></body></html>');
  const ecarts = [];
  if (z.titre !== "Caisse IATA") ecarts.push(`zone titre = ${JSON.stringify(z.titre)}`);
  if (z.corps.includes("Caisse IATA")) ecarts.push("le titre du document se retrouve AUSSI dans le corps");
  if (!z.corps.includes("Bonjour")) ecarts.push("le corps a perdu son texte");
  if (ecarts.length) echec("1 titre du document", ecarts.join(" · "));
  else ok("1 le titre du document est lu dans sa zone, et il n'entre pas dans le corps");
}

/* ---- 2. LE TITRE D'UN SVG APPARTIENT AU CORPS ---------------------------------------------- */
/* LA FAUTE EXACTE DE LA RÉDACTION 2, rejouée. `<svg><title>` est le nom accessible de l'image :
   il est publié, il est lu à voix haute. Le retirer revenait à ne pas voir une affirmation. */
{
  const html = '<html><head><title>Page</title></head>'
    + '<body><svg><title>IATA crate</title><text>Icône</text></svg></body></html>';
  const z = zonesDe(html);
  const ecarts = [];
  if (z.titre !== "Page") ecarts.push(`zone titre = ${JSON.stringify(z.titre)} au lieu de « Page »`);
  if (!z.corps.includes("IATA crate")) ecarts.push("« IATA crate » du titre SVG est absent du corps");
  if (z.titre.includes("IATA crate")) ecarts.push("le titre SVG est passé pour le titre du document");
  const vues = interdites(z.corps);
  if (!vues.includes("IATA crate")) ecarts.push(`la garde IATA ne voit pas l'affirmation : ${JSON.stringify(vues)}`);
  if (ecarts.length) echec("2 titre SVG", ecarts.join(" · "));
  else ok("2 le titre accessible d'un SVG reste dans le corps, et la garde IATA l'y voit");
}

/* ---- 3. LE MÊME TROU, DU CÔTÉ DES MONTANTS ------------------------------------------------- */
/* Le lecteur étant partagé, la contre-épreuve doit l'être aussi : ce qui masquait une affirmation
   masquait un prix. Sans ce contrôle, la garde tarifaire dépendrait d'un contrôle IATA pour ne
   pas régresser — et personne ne le saurait. */
{
  const html = '<html><head><title>Page</title></head>'
    + '<body><p>Tarif <svg><title>USD 250</title></svg></p></body></html>';
  const z = zonesDe(html);
  const vus = trouver(z.corps).map((m) => m.texte ?? m);
  if (!z.corps.includes("USD 250")) echec("3 montant en titre SVG", "« USD 250 » est absent du corps lu");
  else if (!vus.length) echec("3 montant en titre SVG", `le corps contient « USD 250 » mais la garde tarifaire ne relève rien : ${JSON.stringify(vus)}`);
  else ok(`3 un montant placé dans un titre accessible de SVG est vu par la garde tarifaire (${JSON.stringify(vus)})`);
}

/* ---- 4. CE QUI N'EST PAS DU TEXTE PUBLIC SORT DU CORPS, ET RIEN D'AUTRE -------------------- */
/* La liste des éléments retirés est COURTE par contrat : chaque ajout est du contenu public qu'on
   cesse de voir. On éprouve donc les deux sens — ce qui doit sortir, ce qui doit rester. */
{
  const html = '<html><head><title>T</title><style>.a{content:"caisse IATA"}</style></head><body>'
    + '<script>var x = "caisse IATA";</scr' + 'ipt>'
    + '<template><p>caisse IATA</p></template>'
    + '<noscript>caisse IATA en noscript</noscript>'
    + '<figcaption>caisse IATA en légende</figcaption>'
    + '</body></html>';
  const z = zonesDe(html);
  const ecarts = [];
  for (const [quoi, marqueur] of [["un script", 'var x'], ["une feuille de style", ".a{"], ["un template", "<p>"]]) {
    if (z.corps.includes(marqueur)) ecarts.push(`${quoi} reste dans le corps`);
  }
  if (interdites(z.corps).length !== 2) ecarts.push(`${interdites(z.corps).length} affirmation(s) vue(s) dans le corps, attendu 2 — la légende et le noscript`);
  if (!z.corps.includes("caisse IATA en légende")) ecarts.push("une légende de figure a disparu du corps");
  if (!z.corps.includes("caisse IATA en noscript")) ecarts.push("un contenu noscript a disparu du corps");
  if (ecarts.length) echec("4 périmètre du corps", ecarts.join(" · "));
  else ok("4 scripts, styles et templates sortent du corps ; légendes et noscript y restent");
}

/* ---- 5. LE DÉCODAGE EST FAIT PAR LE PARSEUR, JAMAIS À LA MAIN ------------------------------ */
/* C'est la raison d'être du lecteur : une affirmation écrite en entité HTML ou en échappement
   « \uXXXX » ne contient AUCUNE suite brute « IATA ». Tout filtre posé avant lui l'annule. */
{
  const html = '<html><head><title>T</title>'
    + '<script type="application/ld+json">{"d":"\\u0049ATA crate"}</scr' + 'ipt></head>'
    + '<body><p>I&#65;TA crate</p></body></html>';
  const z = zonesDe(html);
  const ecarts = [];
  if (/IATA/.test(html)) ecarts.push("le témoin contient déjà « IATA » en clair : il ne prouve pas le décodage");
  if (!interdites(z.corps).includes("IATA crate")) ecarts.push("l'entité HTML « I&#65;TA » n'est pas décodée dans le corps");
  if (!interdites(z.jsonLd).includes("IATA crate")) ecarts.push("l'échappement « \\u0049 » n'est pas décodé dans le JSON-LD");
  if (ecarts.length) echec("5 décodage", ecarts.join(" · "));
  else ok("5 entité HTML et échappement JSON sont décodés — aucune suite brute « IATA » dans la page source");
}

/* ---- 6. UN JSON-LD ILLISIBLE EST SIGNALÉ, PAS COMPTÉ ZÉRO --------------------------------- */
{
  const bon = zonesDe('<html><head><script type="application/ld+json">{"a":1}</scr' + 'ipt></head><body></body></html>');
  const casse = zonesDe('<html><head><script type="application/ld+json">{ pas du JSON </scr' + 'ipt></head><body></body></html>');
  if (bon.jsonLdInvalide !== 0) echec("6 JSON-LD illisible", `un bloc valide est signalé illisible (${bon.jsonLdInvalide})`);
  else if (casse.jsonLdInvalide !== 1) echec("6 JSON-LD illisible", `${casse.jsonLdInvalide} signalé(s), attendu 1 — une zone dont on ne sait rien passerait pour vide`);
  else ok("6 un bloc JSON-LD illisible est signalé au lieu d'être compté zéro");
}

/* ---- 7. LA FENÊTRE EST RÉUTILISÉE SANS RIEN GARDER D'UNE PAGE À L'AUTRE ------------------- */
/* Le bénéfice mémoire vient de la réutilisation ; la réutilisation, elle, ne doit rien laisser
   fuir. Une page saine lue APRÈS une page fautive doit être rendue saine. */
{
  const fautive = '<html><head><title>Caisse IATA</title><meta name="description" content="IATA crate">'
    + '<script type="application/ld+json">{"d":"caisse IATA"}</scr' + 'ipt></head>'
    + '<body><p>caisse IATA</p></body></html>';
  const saine = '<html><head><title>Propre</title></head><body><p>Rien à signaler</p></body></html>';
  const a = zonesDe(fautive);
  const b = zonesDe(saine);
  const c = zonesDe(fautive);
  const ecarts = [];
  if (!interdites(a.corps).length) ecarts.push("la page fautive ne relève rien : le témoin ne prouve rien");
  for (const [zone, texte] of [["titre", b.titre], ["corps", b.corps], ["metas", b.metas], ["json-ld", b.jsonLd]]) {
    if (/IATA/i.test(texte)) ecarts.push(`la page saine hérite de la précédente en zone « ${zone} » : ${JSON.stringify(texte.slice(0, 60))}`);
  }
  const memeChose = ["titre", "corps", "metas", "jsonLd"].every((k) => a[k] === c[k]);
  if (!memeChose) ecarts.push("la même page relue après une autre ne rend pas le même résultat");
  if (ecarts.length) echec("7 réutilisation de la fenêtre", ecarts.join(" · "));
  else ok("7 la fenêtre réutilisée ne garde rien d'une page à l'autre, et relire rend le même résultat");
}

/* ---- 8. LE TEXTE EST LU COMME IL EST RENDU — LES BLOCS SÉPARENT ------------------------- */
/* `textContent` recolle tout sans rien intercaler : deux textes affichés sur deux lignes
   deviennent un seul mot, et l'affirmation collée à la précédente cesse d'être reconnue. Mesuré
   sur les 3 121 pages : cinq affirmations réellement publiées manquaient au relevé. */
{
  const z = zonesDe('<html><body><p>fin de phrase</p><p>caisse IATA</p></body></html>');
  const soude = "fin de phrasecaisse IATA";
  const ecarts = [];
  if (z.corps.replace(/\s+/g, "") === soude.replace(/\s+/g, "") && !/\s/.test(z.corps.trim()))
    ecarts.push("les deux paragraphes sont soudés");
  if (!interdites(z.corps).includes("caisse IATA"))
    ecarts.push(`l'affirmation du second bloc n'est pas vue : ${JSON.stringify(z.corps)}`);
  if (ecarts.length) echec("8 séparation des blocs", ecarts.join(" · "));
  else ok("8 deux blocs voisins ne se soudent pas : l'affirmation du second est vue");
}

/* ---- 9. …MAIS UN ÉLÉMENT EN LIGNE NE SÉPARE PAS ------------------------------------------ */
/* L'autre sens, sans lequel le contrôle 8 serait un blanc-seing pour tout séparer. La page des
   caisses écrit `<strong>IATA</strong>-compliant` : le navigateur rend UN mot, et un séparateur
   posé partout perdait cette occurrence — mesuré, elle aussi, sur le site construit. */
{
  const z = zonesDe('<html><body><p>crate, <strong>IATA</strong>-compliant (CR82)</p></body></html>');
  if (!z.corps.includes("IATA-compliant"))
    echec("9 éléments en ligne", `« IATA-compliant » a été coupé : ${JSON.stringify(z.corps)}`);
  else if (!interdites(z.corps).includes("IATA-compliant"))
    echec("9 éléments en ligne", "le texte est intact mais la garde ne relève pas l'affirmation");
  else ok("9 un élément en ligne ne coupe pas un mot : « <strong>IATA</strong>-compliant » reste une affirmation");
}

/* ---- 10. LA SOUDURE FABRIQUAIT AUSSI DE FAUX MONTANTS ------------------------------------- */
/* Le gain n'est pas seulement d'en voir plus : sur la fiche des Maldives, « Category 1 » suivi de
   « All breeds… » se soudait en « 1All », que le détecteur de montants lisait comme une quantité.
   Un faux positif dans une garde de lancement coûte aussi cher qu'un faux négatif. */
{
  const z = zonesDe('<html><body><p>Category 1</p><p>All breeds are affected equally.</p></body></html>');
  const vus = trouver(z.corps).map((m) => m.texte ?? m);
  if (z.corps.includes("1All")) echec("10 faux montant soudé", `le corps contient encore « 1All » : ${JSON.stringify(z.corps)}`);
  else if (vus.length) echec("10 faux montant soudé", `la garde tarifaire relève ${JSON.stringify(vus)} sur un texte qui ne porte aucun montant`);
  else ok("10 « Category 1 » et « All breeds » ne se soudent plus en un faux montant");
}

console.log(defauts
  ? `\n[zones] ÉCHEC — ${defauts} contre-épreuve(s) en défaut`
  : "\n[zones] un seul lecteur : le titre reste dans sa zone, les titres SVG dans le corps, le texte est lu comme il est rendu, et les deux gardes voient la même page.");
process.exit(defauts ? 1 : 0);
