#!/usr/bin/env node
/**
 * VÉRIFICATEUR DE BLOCS, PAR LOTS — un processus court, une mémoire reprise à la fin.
 *
 *   node test-lib/verifier-blocs-entites.mjs <fichier-de-taches.json>
 *
 * POURQUOI UN PROCESSUS SÉPARÉ (CI du 16/08/2026, run 31 sur main)
 *
 * Le harnais lisait les 284 pages localisées en ouvrant un JSDOM par page. La CI est morte en
 * « JavaScript heap out of memory » à son premier passage en portée complète — après avoir
 * validé toutes les autres sections. Trois mesures ont établi la cause, et écarté les fausses
 * pistes :
 *
 *   · fermer la fenêtre (`window.close()` dans un `finally`) est INDISPENSABLE mais NE SUFFIT
 *     PAS : après fermeture ET ramasse-miettes forcé, 408 pages retiennent encore 2 145 Mo,
 *     soit ~5 Mo par page qui ne reviennent jamais ;
 *   · la rétention est RÉELLE, pas un ramasse-miettes paresseux : sous `--max-old-space-size=512`,
 *     V8 meurt au lieu de reprendre la mémoire ;
 *   · réutiliser UNE seule fenêtre et reparser dedans (`DOMParser`) est PIRE — 5 787 Mo.
 *
 * La fuite est donc dans JSDOM, et aucun geste à l'intérieur d'un même processus ne la ferme.
 * Ce qui la ferme, c'est la fin du processus. Le harnais découpe donc la lecture en lots courts,
 * chacun exécuté ici, sous une limite de tas VOLONTAIREMENT BASSE : un lot qui grossirait au-delà
 * de ce que sa taille justifie meurt, et le harnais le voit.
 *
 * Ce qui n'est PAS abandonné en chemin : la lecture reste un vrai DOM. Remplacer JSDOM par une
 * expression régulière aurait supprimé la fuite en supprimant la fidélité — c'est-à-dire en
 * cessant de vérifier ce que le navigateur voit.
 *
 * ENTRÉE  : { "dist": "<chemin>", "taches": [ { "rel", "attendus": [ { placement, statut, libelle } ] } ] }
 * SORTIE  : { "pagesLues", "blocsVerifies", "absentes": [], "anomalies": [], "picMo" } sur stdout.
 */
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";

const entree = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const sortie = { pagesLues: 0, blocsVerifies: 0, absentes: [], anomalies: [], picMo: 0 };

for (const tache of entree.taches) {
  const abs = path.join(entree.dist, tache.rel);
  if (!fs.existsSync(abs)) { sortie.absentes.push(tache.rel); continue; }
  sortie.pagesLues++;
  const dom = new JSDOM(fs.readFileSync(abs, "utf8"));
  try {
    const doc = dom.window.document;
    for (const a of tache.attendus) {
      const blocs = doc.querySelectorAll(`[data-placement="${a.placement}"]`);
      if (blocs.length !== 1) { sortie.anomalies.push(`${tache.rel}#${a.placement} : ${blocs.length} bloc(s)`); continue; }
      const statut = blocs[0].getAttribute("data-status");
      if (statut !== a.statut) { sortie.anomalies.push(`${tache.rel}#${a.placement} : data-status=${statut} ≠ ${a.statut}`); continue; }
      /* Comparaison à l'ÉGAL : « Accepté » est un sous-texte de « Non accepté ». */
      const pastille = blocs[0].querySelector(".t .pill")?.textContent?.trim() ?? null;
      if (pastille !== a.libelle) {
        sortie.anomalies.push(`${tache.rel}#${a.placement} : pastille « ${pastille} » ≠ « ${a.libelle} »`);
        continue;
      }
      sortie.blocsVerifies++;
    }
  } finally {
    /* Ne ferme pas la fuite — la fin du processus s'en charge — mais ne la nourrit pas non plus. */
    dom.window.close();
  }
  sortie.picMo = Math.max(sortie.picMo, Math.round(process.memoryUsage().heapUsed / 1048576));
}

process.stdout.write(JSON.stringify(sortie));
