/**
 * LES ZONES PUBLIQUES D'UNE PAGE CONSTRUITE — UN SEUL LECTEUR, PARTAGÉ.
 *
 * POURQUOI IL VIT DANS SON PROPRE FICHIER (02/09/2026). Il était enfermé dans le détecteur de
 * montants, si bien que le contrôle du vocabulaire IATA lisait le HTML BRUT avec sa propre
 * méthode : deux lectures de la même page, donc deux comptes, et un registre de dette publique
 * bâti sur la plus étroite des deux. Ce qui compte comme « publié » ne peut pas dépendre de
 * l'instrument qui regarde.
 */
import { JSDOM } from "jsdom";

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
