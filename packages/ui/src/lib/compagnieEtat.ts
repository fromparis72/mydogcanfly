import type { AirlineData } from "../data/airlines";
import { politiqueDuCanal, preuveAuditee } from "./decisionCanal";

/* L'état de connaissance d'une fiche compagnie, en un seul endroit.
 *
 * POURQUOI CE FICHIER. La page et le sitemap doivent franchir exactement la même porte : une
 * fiche compagnie n'est proposée aux moteurs que si au moins un de ses canaux VISIBLES porte
 * une preuve auditée. Une URL officielle associée, une source fabriquée par l'ingestion ou une
 * politique héritée non relue ne suffisent pas — `preuveAuditee` applique déjà ce contrat pour
 * le Finder et pour les citations de la page.
 *
 * La fiche UI est passée explicitement parce que six politiques du référentiel n'ont pas encore
 * de canal visible. Une preuve que la page ne montre pas ne peut pas ouvrir sa porte d'indexation.
 * Le jour où un canal reçoit une citation conforme, la page revient automatiquement au sitemap,
 * dans les quatre langues, sans liste d'exceptions et sans seconde condition à synchroniser.
 */

/** Les preuves effectivement publiables par la fiche, dans l'ordre de ses canaux visibles. */
export function preuvesDeCompagnie(airline: any, fiche: AirlineData) {
  return fiche.channels
    .map((canal) => preuveAuditee(politiqueDuCanal(airline?.premium?.policy, canal.placement, fiche.id ?? airline?.id ?? "compagnie-inconnue")))
    .filter((preuve): preuve is NonNullable<typeof preuve> => !!preuve);
}

/** Indexable si, et seulement si, la fiche montre au moins une réponse officiellement citée. */
export function compagnieIndexable(airline: any, fiche: AirlineData): boolean {
  return preuvesDeCompagnie(airline, fiche).length > 0;
}
