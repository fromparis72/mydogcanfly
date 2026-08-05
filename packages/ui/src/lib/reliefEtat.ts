/* L'état de connaissance d'une fiche aéroport, en un seul endroit.
 *
 * POURQUOI CE FICHIER. Trois consommateurs doivent répondre exactement la même chose : le
 * gabarit de la fiche (titre, description, `noindex`), le sitemap (inclure ou non l'URL) et
 * plus tard l'index des aéroports. Dupliquer la règle dans trois fichiers, c'est se garantir
 * qu'un jour l'un dira « indexable » pendant qu'un autre retire l'URL du sitemap — soit
 * exactement la contradiction que Google signale comme « exclue par une balise noindex »
 * tout en la trouvant dans le sitemap.
 *
 * LA RÈGLE, arrêtée avec Philippe le 03/08/2026. Ces fiches n'ont qu'un but : dire au voyageur
 * où son chien peut se soulager. On indexe donc les pages qui RÉPONDENT à cette question, et
 * elles seules :
 *
 *   · « oui, voici où » — 74 aéroports, emplacement documenté, source de l'aéroport ;
 *   · « non, aucune aire n'est publiée » — 53 aéroports, constaté sur la page officielle.
 *     Une réponse négative sourcée est une information : elle évite au voyageur de chercher
 *     sur place avec un chien qui se retient.
 *
 * Et on n'indexe pas :
 *
 *   · les 118 fiches sans aucune vérification — elles ne promettent que du vide ;
 *   · les 4 absences adossées à un agrégateur tiers, alors que leur champ `basis` annonce
 *     `airport_official`. L'étiquette ment ; tant qu'elle n'est pas revérifiée, la fiche est
 *     traitée comme non vérifiée. Le site promet des sources officielles, cette promesse ne
 *     souffre pas d'exception discrète.
 *
 * `noindex` ne retire la page ni du site, ni du Finder, ni du maillage : elle reste atteignable
 * et utilisable. Elle cesse seulement d'être proposée en réponse à une recherche.
 */

/** Agrégateurs et forums : utiles pour orienter une recherche, jamais suffisants pour affirmer. */
const AGREGATEURS = /petabroad|tripadvisor|reddit|flyertalk|pinterest|quora|blogspot|wordpress\.com/i;

export type EtatRelief = "aire" | "absence" | "inconnu";

export function etatRelief(airport: any): EtatRelief {
  const pr = airport?.pet_relief;
  const av = pr?.available ?? "unknown";
  if (av === "yes") return "aire";
  if (av === "no") return AGREGATEURS.test(pr?.source?.url ?? "") ? "inconnu" : "absence";
  return "inconnu";
}

/** Indexable si, et seulement si, la page répond à la question posée. */
export function reliefIndexable(airport: any): boolean {
  return etatRelief(airport) !== "inconnu";
}
