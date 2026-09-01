import { JSDOM } from "jsdom";

/**
 * LE DÉTECTEUR DE MONTANTS TARIFAIRES — une seule définition, partagée par tous les contrôles.
 *
 * POURQUOI IL EXISTE. Le micro-lot Tarifs interdit de publier un prix que rien ne rattache au
 * trajet demandé. Plusieurs rédactions successives de mes contrôles ont manqué la moitié des cas :
 * l'une ne comparait que les chaînes EXACTES du champ hérité `fees` et laissait passer les mêmes
 * prix reformulés ailleurs ; une autre ne regardait que la balise `<meta name="description">` et
 * ignorait `og:description`, `twitter:description` et le JSON-LD, où la même phrase est recopiée.
 *
 * CE QU'IL RECONNAÎT — la devise AVANT ou APRÈS le nombre, en symbole, en alias de symbole ou en
 * code ISO 4217 (la liste entière, quelle qu'en soit la casse), avec la virgule ou le point pour décimale, et les espaces d'usage typographique (fine,
 * insécable) comme séparateurs de milliers. Mesuré sur les fiches : China Southern écrit le même
 * prix sous quatre formes selon la langue — `¥5,000`, `¥5.000`, `5 000 ¥`, `5000 ¥` — et un
 * détecteur qui n'en verrait qu'une laisserait passer les trois autres.
 *
 * CE QU'IL NE RECONNAÎT PAS, ET PAR STRUCTURE PLUTÔT QUE PAR LISTE D'EXEMPLES. Un nombre n'est un
 * montant QUE s'il est adjacent à un marqueur de devise. Un poids (« 8 kg »), une dimension
 * (« 55 × 35 × 25 cm »), une durée (« 10 h »), une date (« 2026-07-11 ») ou un pourcentage n'en
 * portent aucun : ils ne peuvent donc pas être confondus, quelle que soit leur valeur. C'est le
 * marqueur qui décide, jamais la grandeur du nombre — « €8 » est un montant, « 8 kg » n'en est
 * pas un, et aucune liste d'exceptions n'est nécessaire pour les séparer.
 */

/* Les symboles, les plus longs d'abord : « US$ » doit gagner sur « $ ». */
const SYMBOLES = "US\\$|A\\$|C\\$|R\\$|NZ\\$|HK\\$|S\\$|NT\\$|\\$|€|£|¥|₩|₹|₽|฿|₺|₪|₦|₫|₱|₲|₴|₸|₾|₡|₵|﷼";

/* LES ALIAS DE SYMBOLE : des LETTRES employées comme un symbole, collées au nombre ou presque, et
 * souvent suivies d'un point. Les compagnies les écrivent bien plus souvent que le code ISO :
 * « RM 500 » (Malaisie), « Rp 500 » (Indonésie), « Rs 500 » (sous-continent indien), « RMB 500 »
 * (Chine). Aucun de ces quatre n'était vu avant la contre-revue du 01/09/2026, et une `metaDesc`
 * portant « RMB 500 » traversait donc les DEUX contrôles, celui des sources comme celui du rendu.
 * Ils gardent leur RÈGLE PROPRE, insensible à la casse : « Rp », « RP » et « rp » s'écrivent tous. */
const ALIAS = "RMB|RM|Rp|Rs";

/* LES CODES ISO 4217 — LA LISTE ENTIÈRE, ET SANS CONDITION DE CASSE.
 *
 * DEUX FAUTES SUCCESSIVES, TOUTES DEUX DES FAUX NÉGATIFS TARIFAIRES.
 *   · La première ÉCARTAIT six codes — ALL, CUP, TOP, GEL, SOS, BSD — parce qu'ils s'écrivent
 *     comme des mots ordinaires. « ALL 4 000 » n'était donc pas détecté : supprimer une devise du
 *     monde entier pour éviter une collision de mots n'est pas une exclusion bornée, c'est un trou.
 *   · La seconde a rétabli les 179 codes mais les a exigés EN CAPITALES, ce qui écartait toutes
 *     leurs autres écritures : « Usd 100 », « usd 100 », « Eur 99 », « eur 99 », « cad 200 » ne
 *     valaient rien. La capitale évitait bien « Top 10 » et « World Cup 2026 », mais au prix de
 *     tarifs plausibles rendus invisibles — et l'affirmation « plus aucune devise n'est écartée »
 *     était fausse une seconde fois.
 *
 * LE PRINCIPE EST CELUI DÉJÀ RETENU POUR « SOS 24/7 » : ON DÉTECTE, PUIS ON MESURE. Les 179 codes
 * sont reconnus quelle que soit leur casse, et le corpus a été balayé — 103 fiches sources et 408
 * fiches construites, dans les quatre zones publiques — pour savoir ce que cet élargissement
 * attrape RÉELLEMENT. Aucune exception n'est créée par anticipation. Une collision qui existerait
 * vraiment serait nommée et bornée AU CONTRÔLE APPELANT, par chemin et fragment exact — jamais en
 * retirant une devise, ni en interdisant ses minuscules.
 *
 * CE QUE CELA COÛTE, DÉCLARÉ : « Top 10 », « World Cup 2026 », « gel 100 ml » et « All 4 dogs »
 * deviennent des montants aux yeux du détecteur. Ce sont des faux positifs THÉORIQUES — aucun ne
 * paraît dans le corpus —, ils sont consignés avec « SOS 24/7 » dans la liste que le contrôle 5
 * vérifie, et ils se voient. Un tarif invisible, lui, ne se voit pas. */
const CODES = [
  "AED","AFN","ALL","AMD","ANG","AOA","ARS","AUD","AWG","AZN","BAM","BBD","BDT","BGN","BHD","BIF",
  "BMD","BND","BOB","BOV","BRL","BSD","BTN","BWP","BYN","BZD","CAD","CDF","CHE","CHF","CHW","CLF",
  "CLP","CNH","CNY","COP","COU","CRC","CUP","CVE","CZK","DJF","DKK","DOP","DZD","EGP","ERN","ETB",
  "EUR","FJD","FKP","GBP","GEL","GHS","GIP","GMD","GNF","GTQ","GYD","HKD","HNL","HTG","HUF","IDR",
  "ILS","INR","IQD","IRR","ISK","JMD","JOD","JPY","KES","KGS","KHR","KMF","KPW","KRW","KWD","KYD",
  "KZT","LAK","LBP","LKR","LRD","LSL","LYD","MAD","MDL","MGA","MKD","MMK","MNT","MOP","MRU","MUR",
  "MVR","MWK","MXN","MYR","MZN","NAD","NGN","NIO","NOK","NPR","NZD","OMR","PAB","PEN","PGK","PHP",
  "PKR","PLN","PYG","QAR","RON","RSD","RUB","RWF","SAR","SBD","SCR","SDG","SEK","SGD","SHP","SLE",
  "SOS","SRD","SSP","STN","SVC","SYP","SZL","THB","TJS","TMT","TND","TOP","TRY","TTD","TWD","TZS",
  "UAH","UGX","USD","UYU","UZS","VED","VES","VND","VUV","WST","XAF","XCD","XCG","XOF","XPF","YER",
  "ZAR","ZMW","ZWG",
].join("|");

/* Le nombre : chiffres, séparateurs de milliers (virgule, point, espace fine ou insécable),
   décimales. Il doit COMMENCER et FINIR par un chiffre. */
const NOMBRE = "\\d(?:[\\d.,\\u00a0\\u202f\\u2009 ]*\\d)?";

/* DEUX MOTIFS, PARCE QUE LEURS RÉSULTATS DOIVENT ÊTRE FUSIONNÉS SANS RECOUVRIR. « $50 CAD » porte
 * un symbole ET un code sur le même montant : les deux motifs le voient, et il n'en faut compter
 * qu'un. Le premier en position gagne. */
export const MOTIF_SYMBOLES = new RegExp(
  `(?:${SYMBOLES})\\s?${NOMBRE}`                    // €200, US$ 500, ¥5,000, ₱300
  + `|${NOMBRE}\\s?(?:${SYMBOLES})`                 // 200 €, 89,99 €
  + `|\\b(?:${ALIAS})\\.?\\s?${NOMBRE}`             // RM 500, Rp500, Rs. 500, RMB 500
  + `|\\b${NOMBRE}\\s?(?:${ALIAS})\\b`,             // 500 RM, 500 Rs
  "gi",
);
export const MOTIF_CODES = new RegExp(
  `\\b(?:${CODES})\\s?${NOMBRE}`                    // ZAR 300, CHF 90, ALL 4 000, eur 99
  + `|\\b${NOMBRE}\\s?(?:${CODES})\\b`,             // 300 ZAR, 90 CHF, 200 cad
  "gi",
);

/* PAS DE RÈGLE DU RAPPORT — ET C'EST UN RENONCEMENT MESURÉ, PAS UN OUBLI.
 *
 * Deux rédactions successives ont voulu écarter « SOS 24/7 », où le code du shilling somalien est
 * suivi d'un nombre sans qu'il s'agisse d'un prix. La première regardait aussi ce qui PRÉCÈDE le
 * montant et a effacé huit prix bien réels des fiches — « £110 » dans « $150 (€120/£110) »,
 * « 1100 TRY » dans « 1000/1100 TRY ». La seconde, restreinte au marqueur en tête, effaçait encore
 * « €100/2 personnes », « USD 100/2 passengers », « SOS 500/2 trajets » : trois FORMES TARIFAIRES
 * ORDINAIRES, un prix rapporté à un nombre de personnes. Le commentaire l'avouait, ce qui rendait
 * fausse la garantie « aucun montant numérique publié ».
 *
 * LA MESURE A TRANCHÉ. Balayage des 103 fiches sources et des 408 fiches construites, dans les
 * quatre zones publiques : ZÉRO occurrence de la forme « marqueur en tête + nombre / chiffre ».
 * La règle ne neutralisait donc rien de réel, et coûtait un faux négatif tarifaire. Elle est
 * retirée entièrement, et AUCUNE exception n'est créée par anticipation : on ne borde pas
 * aujourd'hui, au prix d'un prix invisible, un idiome que rien ne publie.
 *
 * CE QUE CE CHOIX COÛTE, DIT PLUTÔT QUE TU : « SOS 24/7 » est désormais VU comme un montant. C'est
 * un faux positif, il est assumé, et une contre-épreuve le consigne pour qu'il ne se découvre pas
 * un jour par surprise. Le jour où une fiche écrira réellement cette expression, la garde rougira
 * et il faudra trancher — par une exception bornée à un chemin et à un fragment exact, jamais par
 * une règle générale. Un faux positif se voit et se discute ; un faux négatif tarifaire, non.
 * « ouvert 24/7 » reste ignoré : il ne porte aucun marqueur de devise. */

/** Les montants d'un texte, les deux motifs fusionnés, sans recouvrement. */
function reperer(texte) {
  const t = String(texte ?? "");
  const bruts = [];
  for (const motif of [MOTIF_SYMBOLES, MOTIF_CODES]) {
    motif.lastIndex = 0;
    for (const m of t.matchAll(motif)) bruts.push({ texte: m[0], index: m.index });
  }
  bruts.sort((a, b) => a.index - b.index || b.texte.length - a.texte.length);
  const gardes = [];
  let finPrecedente = -1;
  for (const m of bruts) {
    if (m.index < finPrecedente) continue;                     // recouvrement : le premier gagne
    gardes.push(m);
    finPrecedente = m.index + m.texte.length;
  }
  return gardes;
}

/** Combien de montants dans ce texte. */
export function compter(texte) {
  return reperer(texte).length;
}

/** Les montants trouvés, dans l'ordre. */
export function trouver(texte) {
  return reperer(texte);
}

/**
 * LES ZONES PUBLIQUES D'UNE PAGE — LUES APRÈS DÉCODAGE, JAMAIS SUR LE HTML BRUT.
 *
 * LA FAUTE QUE CETTE FONCTION CORRIGE (contre-revue du 01/09/2026). La rédaction précédente
 * découpait le HTML à l'expression régulière et laissait le texte encodé. Elle était donc aveugle
 * à quatre choses, toutes reproduites sur le détecteur réel :
 *     · « 199 &euro; », « 199 &#8364; », « 199 &#x20AC; » — l'entité HTML n'est pas le caractère,
 *       et la page affiche pourtant « 199 € » ;
 *     · « €199 » dans le JSON-LD — JSON échappe ses caractères non-ASCII, et le moteur, lui,
 *       lit la valeur décodée ;
 *     · le `<title>`, qui n'entrait dans AUCUNE zone contrôlée alors qu'il est ce que le moteur
 *       affiche en premier.
 * Une page pouvait donc publier un prix et rester verte.
 *
 * CE QU'ON FAIT MAINTENANT. Le document est parsé (jsdom), et l'on ne lit que des valeurs
 * DÉCODÉES : `textContent` pour le corps et le titre, `getAttribute` pour les métas, `JSON.parse`
 * puis parcours récursif de toutes les chaînes pour le JSON-LD. Le décodage n'est plus fait à la
 * main : il est fait par le parseur, comme chez le lecteur.
 *
 * `jsonLdInvalide` compte les blocs `application/ld+json` qui ne se parsent pas. Un bloc illisible
 * n'est PAS une zone vide : c'est une zone dont on ne sait rien, et l'appelant doit le savoir.
 */
export function zonesDe(html) {
  /* LA FENÊTRE EST FERMÉE AVANT DE RENDRE LA MAIN. Une page du site pèse ~190 ko et son arbre
   * jsdom bien davantage ; sans `close()`, les 408 fiches gardent 408 réalités JavaScript vivantes
   * et le contrôle meurt d'un dépassement de tas sur un coureur de CI. Cette fonction ne rend que
   * des CHAÎNES : rien n'a besoin de survivre à son retour. */
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const titre = doc.querySelector("title")?.textContent ?? "";

  const METAS_PUBLIQUES = [
    'meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]',
    'meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[itemprop="description"]',
  ];
  const metas = METAS_PUBLIQUES.flatMap((s) => [...doc.querySelectorAll(s)])
    .map((m) => m.getAttribute("content") ?? "").join("\n");

  /* LE JSON-LD EST PARSÉ, PUIS PARCOURU DANS SES CHAÎNES — clés comprises comme valeurs, parce
   * qu'un montant peut vivre dans l'une comme dans l'autre, et à n'importe quelle profondeur. */
  const chaines = [];
  let jsonLdInvalide = 0;
  const parcourir = (v) => {
    if (typeof v === "string") { chaines.push(v); return; }
    if (Array.isArray(v)) { v.forEach(parcourir); return; }
    if (v && typeof v === "object") { for (const [k, x] of Object.entries(v)) { chaines.push(k); parcourir(x); } }
  };
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try { parcourir(JSON.parse(s.textContent ?? "")); } catch { jsonLdInvalide++; }
  }
  const jsonLd = chaines.join("\n");

  /* LE CORPS VISIBLE : le texte du document, scripts et styles retirés de l'ARBRE — pas du texte
   * brut découpé aux balises. `<template>` part aussi : son contenu n'est pas rendu. On retire ces
   * nœuds du document déjà parsé, APRÈS en avoir tiré le JSON-LD : parser la page une seconde fois
   * coûterait le double sur 408 fiches, pour le même résultat. */
  for (const n of doc.querySelectorAll("script, style, template")) n.remove();
  const corps = doc.body?.textContent ?? "";

  dom.window.close();
  return { titre, corps, metas, jsonLd, jsonLdInvalide };
}
