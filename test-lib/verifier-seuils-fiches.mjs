#!/usr/bin/env node
/**
 * AUCUN SEUIL NON PROUVÉ NE SORT SUR UNE FICHE — un processus court, une mémoire reprise.
 *
 *   node test-lib/verifier-seuils-fiches.mjs <fichier-de-taches.json>
 *
 * POURQUOI CE FICHIER EXISTE — ET POURQUOI IL EST UN PROCESSUS SÉPARÉ
 *
 * LE DÉFAUT QU'IL FERME (contre-revue du 05/09/2026). J'avais écrit que « rien de faux
 * n'atteint l'écran » après n'avoir regardé que la PASTILLE. C'était inexact. Sous une pastille
 * « à confirmer », la fiche publiait encore le texte éditorial historique — « moins de 8 kg »,
 * « 46 × 28 × 24 cm », « soute jusqu'à 75 kg » chez Air France, l'âge minimal et les exceptions
 * de routes chez Thai Airways, « max 55 × 40 × 23 cm — mais 40 × 25 × 25 cm sur DH8-100 et ATR »
 * chez Aegean — par SIX surfaces distinctes : `channels[].detail`, la FAQ (et son balisage
 * `FAQPage`, lu par une machine comme une réponse autorisée), `crate`, `temperature`,
 * `assistance` et `goodToKnow`. Le visiteur lisait « à confirmer », puis une règle détaillée
 * donnée pour certaine.
 *
 * POURQUOI UN PROCESSUS À PART. La première rédaction de ce contrôle lisait ses 16 pages dans le
 * processus du harnais. Le plafond mémoire du harnais — 400 Mo, un contrôle et non un confort —
 * est aussitôt passé de 355 à 565 Mo : la fuite JSDOM documentée dans
 * `verifier-blocs-entites.mjs` (~5 Mo retenus par page, même après `close()` et ramasse-miettes
 * forcé) ne se ferme que par la fin du processus. J'avais donc introduit, en écrivant un
 * contrôle de véracité, la régression que le harnais surveille par ailleurs. Il tourne ici.
 *
 * CE QU'IL N'ACCUSE PAS. Le bloc « ces N races sont la classification brachycéphale de
 * MyDogCanFly — ce n'est PAS la liste publiée par {compagnie} » porte des poids de races : ce
 * sont NOS données, assumées comme telles, pas une règle prêtée à un tiers. Il est retiré du
 * texte examiné — et, parce qu'une exclusion est un endroit où se cacher, sa présence et sa
 * phrase de désaveu sont RENVOYÉES au harnais, qui les contre-prouve.
 *
 * ENTRÉE : { "dist": "<chemin>", "motifs": [ [source, drapeaux, quoi] ], "classif": [source, drapeaux],
 *            "taches": [ { "rel", "slug", "langue" } ] }
 * SORTIE : { "pagesLues", "blocsNotres", "notresSansDesaveu": [], "fuites": [], "picMo" } sur stdout.
 */
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const entree = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const MOTIFS = entree.motifs.map(([src, dr, quoi]) => [new RegExp(src, dr), quoi]);
const CLASSIF = new RegExp(entree.classif[0], entree.classif[1]);
const ANCIENNE_META = /fares|restrictions|tarifs|official sources|fuentes oficiales|fontes oficiais/i;
const BRACHY = new RegExp(entree.classif[0], entree.classif[1]);
const sortie = { pagesLues: 0, blocsNotres: 0, notresSansDesaveu: [], fuites: [], picMo: 0,
  zonesVides: [], metaAnciennes: [], metaDivergentes: [], sectionsVides: [], brachyPresents: [], cartesExaminees: 0 };

for (const tache of entree.taches) {
  const abs = path.join(entree.dist, tache.rel);
  if (!fs.existsSync(abs)) continue;
  const dom = new JSDOM(fs.readFileSync(abs, "utf8"), { url: `https://mydogcanfly.com/${tache.rel.replace(/index\.html$/, "")}` });
  try {
    const doc = dom.window.document;
    sortie.pagesLues++;
    /* LE BLOC EST REPÉRÉ PAR SA STRUCTURE, PAS PAR SA PHRASE DE DÉSAVEU.
     *
     * Première rédaction : je le cherchais par le texte « classification de MyDogCanFly », puis
     * je vérifiais qu'il portait… ce même texte. Le contrôle était vide — il ne pouvait pas
     * rougir. On le repère donc par ce qui le rend reconnaissable SANS son désaveu : une carte
     * qui contient des pastilles de race portant un poids (`.reach-iata` en « N kg » — les
     * pastilles de la carte « portée » portent des codes IATA, jamais un poids). Le désaveu
     * devient alors une EXIGENCE réfutable : une carte de races qui perdrait sa phrase serait
     * signalée, et son texte resterait dans l'examen. */
    const notre = [...doc.querySelectorAll(".card")].find((c) =>
      [...c.querySelectorAll(".reach-iata")].some((x) => /\d+\s*kg/i.test(x.textContent)));
    if (notre) {
      sortie.blocsNotres++;
      if (CLASSIF.test(notre.textContent)) notre.remove();
      else sortie.notresSansDesaveu.push(tache.rel);
    }
    /* ── LES QUATRE ZONES PUBLIQUES : plus aucune trace de l'ancienne `metaDesc` ─────────────
       Elle annonçait « cabin, hold and cargo rules, fares, restrictions and official sources » —
       des tarifs retirés au micro-lot Tarifs et des restrictions retirées à celui-ci. La page
       promettait donc, à l'extérieur d'elle-même, un contenu qu'elle ne présente plus. On lit les
       quatre zones et on exige la MÊME description neutre partout : une seule définition. */
    const zone = (sel, attr) => doc.querySelector(sel)?.getAttribute(attr) ?? null;
    const desc = [
      ["description", zone('meta[name="description"]', "content")],
      ["og:description", zone('meta[property="og:description"]', "content")],
      ["twitter:description", zone('meta[name="twitter:description"]', "content")],
      ["WebPage/JSON-LD", (() => {
        for (const el of doc.querySelectorAll('script[type="application/ld+json"]')) {
          try {
            for (const n of [].concat(JSON.parse(el.textContent))) {
              if (n && n["@type"] === "WebPage") return n.description ?? null;
            }
          } catch { /* un JSON-LD illisible est signalé par le contrôle de zone, pas ici */ }
        }
        return null;
      })()],
    ];
    for (const [nom, valeur] of desc) {
      if (!valeur) sortie.zonesVides.push(`${tache.rel} — ${nom}`);
      else if (ANCIENNE_META.test(valeur)) sortie.metaAnciennes.push(`${tache.rel} — ${nom} : ${valeur.slice(0, 90)}`);
    }
    const distinctes = new Set(desc.map(([, v]) => v));
    if (distinctes.size !== 1) sortie.metaDivergentes.push(`${tache.rel} — ${distinctes.size} descriptions différentes`);

    /* ── AUCUNE SECTION VIDE ─────────────────────────────────────────────────────────────────
       Les premières suppressions laissaient des coquilles : une carte « Restrictions importantes »
       rendue sans contenu, l'enveloppe `.ladder` vide sous son titre. Une carte qui n'a qu'un
       titre est un contenu promis puis absent. */
    for (const carte of doc.querySelectorAll(".card")) {
      sortie.cartesExaminees++;
      const titre = carte.querySelector("h2");
      const reste = carte.textContent.replace(titre?.textContent ?? "", "").replace(/\s+/g, "").trim();
      if (!reste) sortie.sectionsVides.push(`${tache.rel} — « ${(titre?.textContent ?? "sans titre").trim()} »`);
    }

    /* Le bloc brachycéphale ne doit plus paraître du tout sur une fiche compagnie : sa PRÉSENCE
       établissait une association entre ces races et la compagnie, qu'aucun désaveu ne défait. */
    if (BRACHY.test(doc.body.textContent)) sortie.brachyPresents.push(tache.rel);

    const texte = doc.body.textContent.replace(/\s+/g, " ");
    for (const [re, quoi] of MOTIFS) {
      const m = texte.match(re);
      if (m) {
        sortie.fuites.push({
          slug: tache.slug, langue: tache.langue, quoi,
          extrait: texte.slice(Math.max(0, m.index - 60), m.index + 60),
        });
      }
    }
  } finally {
    dom.window.close();
  }
  sortie.picMo = Math.max(sortie.picMo, Math.round(process.memoryUsage().heapUsed / 1048576));
}

process.stdout.write(JSON.stringify(sortie));
