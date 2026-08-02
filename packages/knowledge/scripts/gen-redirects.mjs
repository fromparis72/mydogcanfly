#!/usr/bin/env node
/* Fabrique la table de redirections qui remplacera lechienvoyageur.com.
 *
 * Le principe. Le VPS ne sert plus Hugo : il ne fait plus que renvoyer chaque ancienne adresse
 * vers son équivalent MyDogCanFly. C'est ce transfert qui récupère l'antériorité et les liens
 * accumulés par le site français ; sans lui, la fusion revient à jeter trois ans de
 * référencement et à republier du contenu qui se concurrence lui-même.
 *
 * Quatre décisions inscrites dans le fichier produit, chacune pour une raison :
 *
 *   · 301 et non 302. Une redirection temporaire ne transfère rien : Google garde l'ancienne
 *     URL en index et attend un retour qui ne viendra pas.
 *   · L'apex ET le www. Le site répond aux deux ; n'en traiter qu'un laisserait la moitié des
 *     liens entrants dans le vide.
 *   · 410 pour le reste, pas une redirection vers l'accueil. Renvoyer massivement vers la
 *     racine est traité par Google comme une page introuvable déguisée — le fameux « soft
 *     404 » — et n'apporte rien. Le 410 dit la vérité : cette page n'existe plus.
 *   · Aucune redirection en chaîne. Chaque ligne pointe vers la destination FINALE, jamais
 *     vers une adresse qui redirige à son tour.
 *
 * Les 62 guides vont vers leur nouvelle page ; les 87 autres articles — fiches pays et
 * compagnies, comparatif, outils — vers la fiche MyDogCanFly qui les remplace, d'après le
 * tableau A de l'inventaire.
 *
 *   node packages/knowledge/scripts/gen-redirects.mjs > /tmp/lechienvoyageur.conf
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DEST = "https://mydogcanfly.com";
const FR = "packages/ui/src/content/guides/fr";
const INV = "INVENTAIRE-LECHIENVOYAGEUR.md";

const regles = new Map();

/* 1. Les 62 guides — la source fait foi, c'est le fichier importé qui porte son ancienne URL. */
for (const f of readdirSync(FR).filter((f) => f.endsWith(".md"))) {
  const t = readFileSync(join(FR, f), "utf-8");
  const src = (/^sourceUrl:\s*"([^"]+)"/m.exec(t) || [])[1];
  if (src) regles.set(src.replace(/\/+$/, "") + "/", `/fr/travel-hub/${f.slice(0, -3)}/`);
}

/* 2. Les 87 doublons — tableau A de l'inventaire, déjà vérifié cible par cible. */
const bloc = readFileSync(INV, "utf-8").split("## 2. Tableau A")[1].split("## 3. Tableau B")[0];
for (const l of bloc.split("\n")) {
  const m = /^\|\s*(\/[^|\s]+)\s*\|[^|]*\|\s*(\/fr\/[^\s|(]*|\/fr\/?)\s*/.exec(l);
  if (m && !regles.has(m[1].replace(/\/+$/, "") + "/")) regles.set(m[1].replace(/\/+$/, "") + "/", m[2]);
}
Object.entries({
  "/outils/": "/fr/tools/",
  "/outils/comparateur-vol-chien/": "/fr/#flight-finder",
  "/outils/calculateur-caisse-iata-chien/": "/fr/tools/crate/",
  "/outils/formalites-chien-par-pays/": "/fr/countries/",
  /* Les pages de service n'ont pas d'équivalent article par article : elles vont vers la page
   * du même office chez MyDogCanFly, ou vers l'accueil quand il n'y en a pas. */
  "/a-propos/": "/fr/about/",
  "/auteur/": "/fr/about/",
  "/contact/": "/fr/about/",
  "/mentions-legales/": "/fr/legal-notice/",
  "/politique-de-confidentialite/": "/fr/privacy/",
  "/charte-editoriale/": "/fr/about/",
  "/": "/fr/",
}).forEach(([k, v]) => { if (!regles.has(k)) regles.set(k, v); });


const lignes = [...regles.entries()].sort(([a], [b]) => a.localeCompare(b));

/* Cloudflare Pages lit un fichier `_redirects` : une règle par ligne, « source cible code ».
 *
 * Deux précautions qui ne coûtent rien et évitent des trous :
 *   · chaque adresse est écrite AVEC et SANS barre oblique finale. Pages compare le chemin
 *     tel quel ; un lien entrant qui aurait perdu sa barre finale tomberait sinon dans le
 *     vide. On reste très en dessous du plafond de 2 100 règles statiques.
 *   · aucune règle attrape-tout. Renvoyer massivement le reste vers l'accueil produirait un
 *     « soft 404 » — Google le traite comme une page introuvable, en moins clair, et sans
 *     rien transférer. Une vraie 404 dit la vérité et désindexe proprement.
 */
const paires = [];
for (const [de, vers] of lignes) {
  const cible = DEST + vers;
  paires.push([de, cible]);
  const sans = de.replace(/\/+$/, "");
  if (sans && sans !== de) paires.push([sans, cible]);
}

/* Les pages de navigation de l'ancien site : catégories, pagination, flux.
 *
 * Elles n'ont pas d'équivalent article par article — ce sont des listes — mais elles ont
 * bien un successeur : l'index du Travel Hub, qui est exactement la même chose en mieux.
 * Les rediriger vaut mieux que les laisser en 404 : ce sont des pages qui reçoivent des
 * liens internes et parfois externes, et Google les a explorées.
 *
 * Les motifs `:splat` couvrent la pagination (`/page/3/`, `/categories/sante/page/2/`) sans
 * avoir à énumérer des dizaines d'adresses. Cloudflare Pages lit les règles dans l'ordre :
 * celles-ci arrivent APRÈS les 319 règles exactes, donc elles ne peuvent rien détourner.
 *
 * Ce qui reste volontairement en 404 :
 *   · `/images/*` — un 301 d'une image vers une page HTML est traité par Google Images comme
 *     une page introuvable ; on ne gagne rien et on brouille le signal.
 *   · `/sitemap.xml` — voir le brief : on le laisse servir l'ANCIENNE liste quelques
 *     semaines, c'est le moyen le plus rapide de faire découvrir les 301 à Google.
 */
const NAVIGATION = [
  ["/categories/", "/fr/travel-hub/"],
  ["/categories/compagnies-aeriennes/", "/fr/airlines/"],
  ["/categories/destinations/", "/fr/travel-hub/"],
  ["/categories/equipement/", "/fr/travel-hub/"],
  ["/categories/sante/", "/fr/travel-hub/"],
  ["/categories/voyager/", "/fr/travel-hub/"],
  ["/index.xml", "/fr/travel-hub/"],
];
for (const [de, vers] of NAVIGATION) {
  paires.push([de, DEST + vers]);
  const sans = de.replace(/\/+$/, "");
  if (sans && sans !== de) paires.push([sans, DEST + vers]);
}
/* Les motifs, en tout dernier : ils ne s'appliquent qu'à ce qu'aucune règle exacte n'a pris. */
const MOTIFS = [
  ["/page/*", "/fr/travel-hub/"],
  ["/categories/*/page/*", "/fr/travel-hub/"],
];

const large = Math.max(...paires.map(([d]) => d.length));

console.log(`# lechienvoyageur.com — redirections permanentes vers MyDogCanFly.
# Généré par packages/knowledge/scripts/gen-redirects.mjs le ${new Date().toISOString().slice(0, 10)}.
# ${paires.length + MOTIFS.length} règles : ${lignes.length} adresses métier (avec et sans barre
# finale), les pages de navigation de l'ancien site, puis deux motifs pour la pagination.
# Ne pas éditer à la main : régénérer.
#
# Déposer à la RACINE du dossier publié du projet Cloudflare Pages de lechienvoyageur.com.
# Les codes sont des 301 : une redirection temporaire ne transfère pas le référencement.
# Garder le projet et le domaine au moins douze mois, Google consolide lentement.
`);
for (const [de, cible] of paires) console.log(`${de.padEnd(large)}  ${cible}  301`);
for (const [de, vers] of MOTIFS) console.log(`${de.padEnd(large)}  ${DEST}${vers}  301`);
