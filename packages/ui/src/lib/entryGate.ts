/**
 * LA PORTE D'ENTRÉE DU CLASSEMENT — une seule définition, en production, lue par la page ET par
 * les harnais.
 *
 * POURQUOI CE FICHIER EXISTE (contre-revue du 05/09/2026)
 *
 * Le harnais navigateur prétendait « rejouer la fonction telle qu'elle est écrite dans la page ».
 * Il n'en faisait rien : il en RECOPIAIT une deuxième version dans le test. Si la vraie page était
 * sabotée pour retomber sur « aucun blocage connu », le contrôle restait vert — il éprouvait sa
 * propre copie. C'est la faute que ce dépôt répète sous toutes ses formes : deux définitions d'une
 * même chose, qui finissent par diverger. Ici elle était pire qu'une divergence possible, c'était
 * une preuve circulaire.
 *
 * La règle est donc celle qu'on applique partout ailleurs : la définition vit UNE fois, en
 * production, et tout le monde l'importe — le gabarit comme le harnais. Saboter la page, c'est
 * saboter ce fichier, et le contrôle le voit.
 */

/** Les trois états d'entrée, tels que le moteur les produit. */
export const ETATS_ENTREE = ["blocked", "confirmation_required", "no_known_block"] as const;
export type EtatEntree = (typeof ETATS_ENTREE)[number];

/**
 * LE FACTEUR DE CLASSEMENT D'UNE DESTINATION, SELON L'ÉTAT D'ENTRÉE DU PAYS.
 *
 * Trois portes, parce qu'il y a trois états. L'ancienne — `entry_allowed ? 1 : 0.05` — n'en
 * connaissait que deux : une destination dont l'entrée est seulement à confirmer passait à PLEINE
 * porte, au même rang qu'une ville sans la moindre restriction connue.
 *
 * UN ÉTAT ABSENT OU INCONNU ÉCHOUE VERS LA PRUDENCE. Une réponse d'API antérieure, tronquée ou
 * malformée n'est pas une absence de blocage : c'est une ignorance, et une ignorance se confirme.
 * Replier sur « aucun blocage connu » recréerait très exactement le faux-vert que ce lot retire.
 */
export function porteDEntree(statut: unknown): number {
  const etat: EtatEntree = (ETATS_ENTREE as readonly string[]).includes(statut as string)
    ? (statut as EtatEntree)
    : "confirmation_required";
  return etat === "blocked" ? 0.05 : etat === "confirmation_required" ? 0.35 : 1;
}
