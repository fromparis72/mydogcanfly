/**
 * LES ZONES PUBLIQUES D'UNE PAGE CONSTRUITE — UN SEUL LECTEUR, PARTAGÉ.
 *
 * POURQUOI IL VIT DANS SON PROPRE FICHIER (02/09/2026). Il était enfermé dans le détecteur de
 * montants, si bien que le contrôle du vocabulaire IATA lisait le HTML BRUT avec sa propre
 * méthode : deux lectures de la même page, donc deux comptes, et un registre de dette publique
 * bâti sur la plus étroite des deux. Ce qui compte comme « publié » ne peut pas dépendre de
 * l'instrument qui regarde.
 *
 * POURQUOI UN SEUL DOCUMENT, RÉUTILISÉ. La première rédaction construisait une fenêtre jsdom par
 * page et la fermait ensuite. Sur 408 fiches, cela passait ; sur les 3 121 pages du site complet,
 * le contrôle est mort d'un dépassement de tas après onze minutes — `window.close()` ne rend pas
 * tout. On garde donc UNE fenêtre pour tout le processus et l'on y réinjecte le HTML page après
 * page. Le décodage reste fait par le PARSEUR, jamais à la main : c'est lui qui sait que
 * « &#65; » vaut « A » et que « I » vaut « I ».
 */
import { JSDOM } from "jsdom";

/* La fenêtre unique, créée à la première lecture. */
let doc = null;
function document_() {
  if (!doc) doc = new JSDOM("<!doctype html><html><head></head><body></body></html>").window.document;
  return doc;
}

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

  const titre = racine.querySelector("title")?.textContent ?? "";

  const METAS_PUBLIQUES = [
    'meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]',
    'meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[itemprop="description"]',
  ];
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

  /* LE CORPS VISIBLE : le texte du document, scripts, styles, templates et `<head>` retirés de
   * l'ARBRE — pas du texte brut découpé aux balises. */
  /* `<title>` PART AUSSI, et cette ligne vient d'un défaut mesuré : le HTML est réinjecté dans un
   * `<div>`, où « head » n'existe pas comme élément — ses enfants deviennent frères du corps. Sans
   * ce retrait, le titre était compté DEUX FOIS, dans sa zone et dans le corps, et un défaut de
   * titre aurait paru déplacé alors qu'il ne l'était pas. */
  for (const n of racine.querySelectorAll("script, style, template, head, title, meta, link")) n.remove();
  const corps = racine.textContent ?? "";

  racine.innerHTML = "";            // on ne garde rien d'une page à l'autre
  return { titre, corps, metas, jsonLd, jsonLdInvalide };
}
