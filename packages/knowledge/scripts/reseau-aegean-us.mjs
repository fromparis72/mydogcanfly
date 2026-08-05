#!/usr/bin/env node
/* Pourquoi Aegean ne dessert PAS les États-Unis dans ce corpus — et pourquoi c'est volontaire.
 *
 * LE SIGNALEMENT. Une recherche Athènes → New York en octobre ne renvoie aucune ligne Aegean.
 * La fiche Aegean déclare 44 pays desservis, aucun n'étant les États-Unis, et 73 liaisons
 * directes, aucune vers New York. Une compagnie qui ne dessert pas le pays d'arrivée est écartée
 * avant même qu'on regarde sa politique animaux : le moteur faisait donc exactement son travail.
 *
 * LA FAUSSE PISTE, ET C'ÉTAIT LA MIENNE. Aegean vend bien un Athènes → Newark quotidien, le vol
 * A3 3415, et j'ai commencé par l'ajouter au graphe. C'était une erreur, relevée par Philippe :
 * ce vol est un PARTAGE DE CODE. Il est opéré par Emirates sous le numéro EK209 — accord étendu
 * à cette route en septembre 2023, annoncé par les deux compagnies. Aegean n'y met pas ses
 * avions.
 *
 * POURQUOI C'EST DÉCISIF ICI, et pas seulement une subtilité de programme de fidélité : sur un
 * site de voyage animalier, LA POLITIQUE QUI S'APPLIQUE EST CELLE DU TRANSPORTEUR EFFECTIF. Un
 * voyageur à qui l'on propose « Aegean » sur ce vol lirait un verdict « Facile », une cabine
 * ouverte aux petits chiens et des tarifs publiés — alors qu'il embarquerait sur un appareil
 * Emirates, que ce même site classe « Difficile » et dont les conditions animaux sont tout
 * autres. Ce n'est pas une imprécision, c'est une réservation qui se termine au comptoir.
 *
 * LA RÈGLE, arrêtée le 04/08/2026 : `direct_routes` et `serves_country_ids` ne contiennent que
 * du vol PROPRE. Jamais de partage de code, même quand la compagnie le vend sous son numéro et
 * l'affiche sur son propre site de réservation. Le graphe ne répond pas à « puis-je acheter ce
 * billet chez eux ? » mais à « de quelle compagnie mon chien subira-t-il les règles ? ».
 *
 * Ce script est donc un script de RETRAIT : il défait l'ajout si quelqu'un l'a refait, et sert
 * de trace écrite à la décision. Il est sans effet sur un corpus déjà propre.
 *
 * CE QUE ÇA LAISSE OUVERT. Rien dans la chaîne ne distingue aujourd'hui un vol propre d'un
 * partage de code, ni ne détecte qu'un réseau a changé de saison. Les deux mériteraient un
 * contrôle périodique, au moins sur les compagnies les mieux notées — ce sont elles que le
 * Finder met en avant, donc elles qui coûtent le plus cher quand la donnée dérape.
 *
 *   node packages/knowledge/scripts/reseau-aegean-us.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FICHIER = join(HERE, "..", "raw", "objects.json");
const dry = process.argv.includes("--dry");

let texte = readFileSync(FICHIER, "utf-8");

/* Retrait en texte, pas par sérialisation : `objects.json` fait trois mégaoctets et un
 * `JSON.stringify` en réécrirait chaque ligne. */
const A_RETIRER = [
  {
    quoi: "pays desservi « country_us »",
    avec: `        "country_tr",\n        "country_us"\n      ],\n      "source": {\n        "url": "https://mydogcanfly.com/aegean-airlines-dog-policy/"`,
    sans: `        "country_tr"\n      ],\n      "source": {\n        "url": "https://mydogcanfly.com/aegean-airlines-dog-policy/"`,
  },
  {
    quoi: "liaison directe Athènes–Newark",
    avec: `        "airport_ath|airport_edi",\n        "airport_ath|airport_ewr",\n        "airport_ath|airport_fco",`,
    sans: `        "airport_ath|airport_edi",\n        "airport_ath|airport_fco",`,
  },
];

let retires = 0;
for (const e of A_RETIRER) {
  if (!texte.includes(e.avec)) { console.log(`· ${e.quoi} : absent, rien à faire`); continue; }
  texte = texte.replace(e.avec, e.sans);
  retires++;
  console.log(`✓ ${e.quoi} retiré`);
}

if (retires && !dry) writeFileSync(FICHIER, texte);

const o = JSON.parse(texte);
const a = (Array.isArray(o.airlines) ? o.airlines : Object.values(o.airlines)).find((x) => /aegean/i.test(x.name ?? ""));
const usa = a.serves_country_ids.includes("country_us");
const ewr = a.direct_routes.includes("airport_ath|airport_ewr");
console.log(`\nAegean : ${a.serves_country_ids.length} pays, ${a.direct_routes.length} liaisons propres.`);
console.log(`États-Unis : ${usa ? "PRÉSENT — anormal" : "absent, conforme"} · Newark : ${ewr ? "PRÉSENTE — anormal" : "absente, conforme"}${dry ? " — essai à blanc" : ""}`);
if (usa || ewr) process.exitCode = 1;
