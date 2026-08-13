/**
 * Bornes de la date de voyage, côté NAVIGATEUR — algorithme unique, deux outils.
 *
 * Le Finder et le Finder de destinations bornaient chacun leur champ, avec deux calculs
 * différents : `DestinationFinder` faisait `setMonth(getMonth() + 18)`, qui **déborde en fin de
 * mois** — au 31 août, l'interface autorisait des jours de mars alors que le contrat serveur
 * s'arrête au dernier jour de février. Un visiteur pouvait donc choisir une date que la page
 * acceptait et que le moteur refusait.
 *
 * Cette fonction reproduit exactement `travelDateBounds()` de `@mydogcanfly/knowledge`, sans
 * dépendre de Zod (qui n'a rien à faire dans le bundle client). `test-breed-restrictions.mjs`
 * vérifie que les deux implémentations coïncident sur un jeu de dates, dont les fins de mois et
 * une année bissextile : c'est ce contrôle qui empêche la copie de dériver.
 */
/**
 * CONVENTION ASSUMÉE — « aujourd'hui » est le jour **UTC**, des deux côtés.
 *
 * Client et serveur lisent tous deux `getUTC*()`, ils sont donc cohérents entre eux : aucune date
 * acceptée par la page ne peut être refusée par le moteur pour cette raison. Le prix est visible
 * et assumé : un visiteur en UTC−7 qui consulte le site à 18 h locales est déjà au lendemain en
 * UTC, et ne peut donc pas choisir *sa* journée d'aujourd'hui. La borne basse lui coûte au pire
 * une journée, jamais un voyage.
 *
 * Corriger cela ne se fait PAS en passant le client à l'heure locale : le serveur refuserait alors
 * la date que la page vient d'accepter, et on retomberait exactement sur le 400 que ce contrat
 * existe pour éviter. Il faudrait élargir la borne basse du serveur d'un jour (tolérance ±1 pour
 * couvrir tous les fuseaux), c'est-à-dire modifier une règle du moteur. C'est une décision de
 * produit, consignée comme telle et non prise ici.
 */
export const TRAVEL_DATE_HORIZON_MONTHS = 18;

export function travelDateBoundsClient(now: Date = new Date()): { min: string; max: string } {
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
  const iso = (dt: Date) => dt.toISOString().slice(0, 10);
  // Dernier jour du mois cible : `Date.UTC(y, m + 19, 0)` désigne le jour 0 du mois suivant,
  // c'est-à-dire le dernier jour du mois visé. Sans ce plafond, « 31 août + 18 mois » deviendrait
  // le 3 mars au lieu du 29 février.
  const lastDay = new Date(Date.UTC(y, m + TRAVEL_DATE_HORIZON_MONTHS + 1, 0)).getUTCDate();
  return {
    min: iso(new Date(Date.UTC(y, m, d))),
    max: iso(new Date(Date.UTC(y, m + TRAVEL_DATE_HORIZON_MONTHS, Math.min(d, lastDay)))),
  };
}
