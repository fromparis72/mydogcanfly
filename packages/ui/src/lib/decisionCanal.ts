/**
 * LA lecture de la décision d'un canal, pour l'affichage — un seul endroit, quatre langues.
 *
 * POURQUOI CE FICHIER EXISTE (contre-test navigateur du 15/08/2026)
 *
 * La fiche compagnie rendait `channels[].cls` et `channels[].statusLabel` : une couleur de
 * pastille et une étiquette écrites à la main. Sur 78 canaux de 71 fiches, cet éditorial
 * CONTREDIT la décision canonique — « Autorisé » affiché là où la politique dit « à confirmer ».
 * Depuis T0-B2 la décision est explicite ; il restait à ce que l'écran la lise.
 *
 * D'OÙ VIENT LA DÉCISION AFFICHÉE : de `kb.airlines.get(id).premium.policy[placement]`, la
 * politique RUNTIME — le même objet, issu du même contrat, que celui dont le moteur tire les
 * cartes du Finder. Pas de la fiche relue en parallèle : deux chemins de lecture pour une même
 * décision finissent toujours par diverger, et c'est très exactement cette divergence que le
 * contre-test a trouvée. Le chemin est donc unique : fiche YAML → ingestion →
 * `PlacementPolicyAuthored` → `projectPlacementPolicy` → statut affiché.
 *
 * TROIS RÈGLES, et elles ne sont pas négociables :
 *
 *  1. AUCUN REPLI SILENCIEUX. Une politique absente lève une erreur qui casse le build. Le
 *     schéma d'ingestion garantit déjà que chaque canal visible pointe vers une politique
 *     déclarée ; si cette garantie tombe, la page ne doit pas se rabattre sur l'éditorial — elle
 *     doit refuser d'exister. Un repli, même vers « à confirmer », rouvrirait la porte à un
 *     affichage qui ne vient plus de la donnée.
 *
 *  2. LE LIBELLÉ EST PUBLIÉ, jamais réécrit ici. `premium.allowed`, `premium.not_allowed` et
 *     `air.to_confirm` existent déjà dans les quatre langues ; ce sont eux qui s'affichent.
 *
 *  3. UNE PREUVE EST UNE PREUVE. La règle n'est PAS écrite ici : elle vit dans
 *     `@mydogcanfly/knowledge` (`preuve.ts`), parce que le moteur l'applique aussi sur les
 *     cartes du Finder. Deux copies d'une même règle finissent toujours par diverger.
 */
import type { PlacementPolicy, PolicySource } from "@mydogcanfly/knowledge";
import { preuveAuditee as preuveAuditeeCanonique } from "@mydogcanfly/knowledge";

export type Placement = "cabin" | "hold" | "cargo";
export type StatutCanonique = "allowed" | "denied" | "confirmation_required";
export type PolitiqueCanal = PlacementPolicy;

/** La politique runtime d'un canal. Lève si elle manque — voir règle 1. */
export function politiqueDuCanal(
  policy: Partial<Record<Placement, PlacementPolicy>> | undefined,
  placement: Placement,
  airlineId: string,
): PlacementPolicy {
  const d = policy?.[placement];
  if (!d) {
    throw new Error(
      `[decisionCanal] ${airlineId} : canal « ${placement} » affiché sans politique déclarée. ` +
      "La décision ne peut pas être déduite de `cls`/`statusLabel` (éditoriaux) — corrigez la fiche.",
    );
  }
  return d;
}

/** La clé de traduction PUBLIÉE du libellé de statut. */
export const cleLibelleStatut = (s: StatutCanonique): string =>
  s === "allowed" ? "premium.allowed" : s === "denied" ? "premium.not_allowed" : "air.to_confirm";

/** La classe de pastille — purement visuelle, DÉRIVÉE du statut et non plus l'inverse. */
export const classeStatut = (s: StatutCanonique): "ok" | "no" | "warn" =>
  s === "allowed" ? "ok" : s === "denied" ? "no" : "warn";

/** Nature de l'incertitude, quand il y en a une : la NÔTRE ou celle de la compagnie. */
export const causeDeConfirmation = (d: PlacementPolicy): string | null =>
  d.status === "confirmation_required" ? d.status_cause : null;

/** La source AUDITÉE d'une politique, ou `null` — règle canonique, appliquée telle quelle. */
export const preuveAuditee = (d: PlacementPolicy | undefined): PolicySource | null =>
  preuveAuditeeCanonique(d) ?? null;
