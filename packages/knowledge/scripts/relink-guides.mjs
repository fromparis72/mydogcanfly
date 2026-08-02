#!/usr/bin/env node
/* Réécrit le maillage interne des 62 guides du Travel Hub.
 *
 * Le problème. Les corps importés portent environ 1 200 liens internes hérités de leur site
 * d'origine : `/comparatif-compagnies-aeriennes-chien/`, `/outils/calculateur-caisse-iata-chien/`,
 * `/voyager-chien-japon/`… Toutes ces adresses vont être redirigées. Les laisser en l'état
 * « fonctionnerait » — le lecteur arriverait à bon port après un rebond — mais un lien interne
 * qui passe par une 301 est une faute à trois titres : un aller-retour réseau pour le lecteur,
 * une dilution du signal pour les moteurs, et une dépendance permanente du site neuf au VPS
 * qu'on veut pouvoir éteindre un jour.
 *
 * La règle. Chaque lien est résolu vers sa destination FINALE sur MyDogCanFly :
 *   · un guide importé      → /fr/travel-hub/<slug>/   (ou /travel-hub/<slug>/ en anglais)
 *   · une fiche pays        → /fr/countries/<iso2>/
 *   · une fiche compagnie   → /fr/airlines/<slug>/
 *   · un outil              → /fr/tools/<outil>/
 *
 * Ce que le script ne fait PAS : deviner. Un lien qu'il ne sait pas résoudre est laissé intact
 * et signalé à la fin. Un mauvais lien silencieux coûte plus cher qu'un lien non traité, parce
 * qu'on ne le cherche pas.
 *
 * La table vient de INVENTAIRE-LECHIENVOYAGEUR.md pour le français et de la table
 * LEGACY_REDIRECTS du Worker pour l'anglais — deux sources déjà arbitrées et vérifiées. On ne
 * réinvente aucune correspondance.
 *
 *   node packages/knowledge/scripts/relink-guides.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const INV = "INVENTAIRE-LECHIENVOYAGEUR.md";
const WORKER = "packages/ui/public/_worker.js";
const FR = "packages/ui/src/content/guides/fr";
const EN = "packages/ui/src/content/guides/en";
const dry = process.argv.includes("--dry");

const cle = (t) => (/^key:\s*"([^"]+)"/m.exec(t) || [])[1];

/* ---------------------------------------------------------------- les tables */

/** Les 62 guides : ancienne adresse → nouvelle, dans les deux langues. */
const guides = { fr: new Map(), en: new Map() };
for (const [dir, lang, prefixe] of [[FR, "fr", "/fr/travel-hub/"], [EN, "en", "/travel-hub/"]]) {
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const t = readFileSync(join(dir, f), "utf-8");
    const src = (/^sourceUrl:\s*"([^"]+)"/m.exec(t) || [])[1];
    if (src) guides[lang].set(src.replace(/\/+$/, "") + "/", `${prefixe}${f.slice(0, -3)}/`);
  }
}

/** Le tableau A de l'inventaire : `| /source/ | sujet | /fr/cible/ | … |`. */
const doublonsFr = new Map();
{
  const bloc = readFileSync(INV, "utf-8").split("## 2. Tableau A")[1].split("## 3. Tableau B")[0];
  for (const l of bloc.split("\n")) {
    const m = /^\|\s*(\/[^|\s]+)\s*\|[^|]*\|\s*(\/fr\/[^\s|(]*|\/fr\/?)\s*/.exec(l);
    if (m) doublonsFr.set(m[1].replace(/\/+$/, "") + "/", m[2]);
  }
}
/* Les quatre outils, écrits ici parce que le tableau les décrit en prose. */
Object.entries({
  "/outils/": "/fr/tools/",
  "/outils/comparateur-vol-chien/": "/fr/#flight-finder",
  "/outils/calculateur-caisse-iata-chien/": "/fr/tools/crate/",
  "/outils/formalites-chien-par-pays/": "/fr/countries/",
}).forEach(([k, v]) => doublonsFr.set(k, v));

/** La table anglaise : celle du Worker, déjà en production pour les URL du site v1. */
const doublonsEn = new Map();
{
  const w = readFileSync(WORKER, "utf-8");
  for (const m of w.matchAll(/\[\s*"(\/[^"]+)"\s*,\s*"(\/[^"]+)"\s*\]/g)) doublonsEn.set(m[1], m[2]);
}

const table = {
  fr: new Map([...doublonsFr, ...guides.fr]),   // les guides priment : ils sont plus précis
  en: new Map([...doublonsEn, ...guides.en]),
};

/* ---------------------------------------------------------------- réécriture */

let liens = 0, reecrits = 0;
const inconnus = new Map();
for (const [dir, lang] of [[FR, "fr"], [EN, "en"]]) {
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const p = join(dir, f);
    const src = readFileSync(p, "utf-8");
    /* Uniquement les liens Markdown et les href HTML vers une adresse absolue du site.
     * On ne touche ni aux liens externes, ni aux ancres, ni aux images. */
    const out = src.replace(/(\]\(|href=")(\/[a-z0-9][a-z0-9\-/]*\/?)((?:#[^)"]*)?)(\)|")/gi,
      (tout, avant, url, ancre, apres) => {
        liens++;
        const norm = url.replace(/\/+$/, "") + "/";
        /* Déjà une adresse MyDogCanFly (préfixe de langue, ou une famille connue) : on ne
         * la retouche pas — le script doit pouvoir être relancé sans dégât. */
        if (/^\/(fr|es|pt)\//.test(norm) || /^\/(airlines|countries|breeds|airports|tools|travel-hub)\//.test(norm))
          return tout;
        const cible = table[lang].get(norm);
        if (!cible) {
          inconnus.set(`${lang} ${norm}`, (inconnus.get(`${lang} ${norm}`) ?? 0) + 1);
          return tout;
        }
        reecrits++;
        return `${avant}${cible}${ancre}${apres}`;
      });
    if (out !== src && !dry) writeFileSync(p, out);
  }
}

console.log(`${liens} liens internes examinés · ${reecrits} réécrits${dry ? " — essai à blanc" : ""}`);
if (inconnus.size) {
  console.log(`\n${inconnus.size} adresses non résolues, laissées intactes :`);
  for (const [u, n] of [...inconnus.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25))
    console.log(`  ×${String(n).padStart(3)}  ${u}`);
}
