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
 * code ISO, avec la virgule ou le point pour décimale, et les espaces d'usage typographique (fine,
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
 * portant « RMB 500 » traversait donc les DEUX contrôles, celui des sources comme celui du rendu. */
const ALIAS = "RMB|RM|Rp|Rs";

/* LES CODES ISO. La liste est délibérément INCOMPLÈTE, et c'est le point délicat de ce fichier :
 * une douzaine de codes ISO sont aussi des mots ordinaires dans les quatre langues du site, et les
 * admettre transformerait des phrases parfaitement innocentes en montants —
 *     « ALL 4 dogs »        (ALL, lek albanais)      « World Cup 2026 »  (CUP, peso cubain)
 *     « Top 10 »            (TOP, paʻanga tongan)    « gel 100 ml »      (GEL, lari géorgien)
 *     « SOS 24/7 »          (SOS, shilling somalien) « BSD 3 »           (BSD, dollar bahaméen)
 * Ces codes-là sont ÉCARTÉS, nommément, et une contre-épreuve exige qu'ils le restent. Le prix de
 * cette exclusion est nommé lui aussi : un prix écrit « ALL 4 000 » ne serait pas vu. Aucune de ces
 * devises n'apparaît sur les fiches, et le jour où l'une d'elles y entrerait, il faudra la traiter
 * autrement que par le code seul — par le symbole, ou par un champ tarifaire structuré. */
const CODES = "EUR|USD|GBP|CHF|ZAR|AUD|NZD|CAD|SEK|NOK|DKK|ISK|PLN|CZK|HUF|RON|RSD|BGN|HRK|TRY"
  + "|MAD|TND|EGP|XPF|XOF|XAF|JPY|CNY|CNH|KRW|INR|THB|VND|IDR|MYR|SGD|PHP|TWD|HKD|BRL|MXN|ARS|CLP"
  + "|COP|PEN|UYU|AED|SAR|QAR|KWD|OMR|BHD|JOD|ILS|KES|MUR|NGN|GHS|RUB|UAH"
  /* Ajoutées à la contre-revue du 01/09/2026 — aucune n'est un mot dans les quatre langues. */
  + "|PKR|LKR|NPR|BDT|MVR|BND|KHR|MMK|KZT|UZS|AZN|MNT|DZD|LYD|SDG|ETB|TZS|UGX|ZMW|BWP|NAD|MZN"
  + "|AOA|CVE|JMD|TTD|DOP|GTQ|CRC|HNL|NIO|PYG|VES|FJD|PGK|MDL|RWF|XCD";

/* Le nombre : chiffres, séparateurs de milliers (virgule, point, espace fine ou insécable),
   décimales. Il doit COMMENCER et FINIR par un chiffre. */
const NOMBRE = "\\d(?:[\\d.,\\u00a0\\u202f\\u2009 ]*\\d)?";

export const MOTIF_MONTANT = new RegExp(
  `(?:${SYMBOLES})\\s?${NOMBRE}`                    // €200, US$ 500, ¥5,000, ₱300
  + `|${NOMBRE}\\s?(?:${SYMBOLES})`                 // 200 €, 89,99 €
  + `|\\b(?:${ALIAS})\\.?\\s?${NOMBRE}`             // RM 500, Rp500, Rs. 500, RMB 500
  + `|\\b${NOMBRE}\\s?(?:${ALIAS})\\b`              // 500 RM, 500 Rs
  + `|\\b(?:${CODES})\\s?${NOMBRE}`                 // ZAR 300, CHF 90
  + `|\\b${NOMBRE}\\s?(?:${CODES})\\b`,             // 300 ZAR, 90 CHF
  "gi",
);

/** Combien de montants dans ce texte. */
export function compter(texte) {
  MOTIF_MONTANT.lastIndex = 0;
  return (String(texte ?? "").match(MOTIF_MONTANT) ?? []).length;
}

/** Les montants trouvés, dans l'ordre. */
export function trouver(texte) {
  MOTIF_MONTANT.lastIndex = 0;
  return [...String(texte ?? "").matchAll(MOTIF_MONTANT)].map((m) => ({ texte: m[0], index: m.index }));
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
  const doc = new JSDOM(html).window.document;

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

  return { titre, corps, metas, jsonLd, jsonLdInvalide };
}
