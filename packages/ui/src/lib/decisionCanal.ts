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
import { preuveAuditee as preuveAuditeeCanonique, sourceAffichable as sourceAffichableCanonique } from "@mydogcanfly/knowledge";

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

/**
 * LE VERDICT DE TÊTE D'UNE FICHE — dérivé des trois canaux, jamais de l'éditorial.
 *
 * Il vit ici et non dans le gabarit, pour la même raison que le reste de ce fichier : une règle
 * écrite dans une page n'est pas éprouvable, et la contre-revue du 05/09/2026 a refusé deux
 * rédactions successives qui rendaient la main au YAML — d'abord pour le libellé, puis pour le
 * score. Une porte de derrière fermée dans le gabarit se rouvre au prochain gabarit.
 *
 * La table est celle qu'a fixée l'arbitrage, et elle ne connaît que les statuts canoniques :
 *
 *   au moins un `allowed`                          → transport possible sur au moins un canal vérifié
 *   les TROIS canaux présents et tous `denied`     → aucun canal accepté
 *   tout le reste, y compris un état incomplet     → conditions à confirmer
 *
 * LE DERNIER CAS ÉTAIT UN REPLI, ET IL MENTAIT (contre-revue du 05/09/2026).
 *
 * La rédaction précédente concluait `premium.verdict_none` — « aucun canal accepté » — dès qu'elle
 * ne trouvait ni `allowed` ni `confirmation_required`. Elle le concluait donc aussi sur une
 * politique ABSENTE, sur un seul canal refusé, sur deux. Mesuré sur la fonction elle-même :
 *
 *     undefined                        → « aucun canal accepté »
 *     { cabin: denied }                → « aucun canal accepté »
 *     { cabin: denied, hold: denied }  → « aucun canal accepté »
 *     trois canaux `denied`            → « aucun canal accepté »   ← le SEUL cas légitime
 *
 * `Object.values()` ne voit que les clés PRÉSENTES : deux canaux inconnus ne pesaient rien, et
 * l'absence se lisait comme un refus. C'est la faute que ce dépôt répète — un contrôle qui ne
 * parle que de ce qu'il reconnaît compte zéro là où il ne regarde pas — cette fois dans le sens
 * le plus dur, puisqu'elle transformait l'ignorance en verdict de refus sur la fiche.
 *
 * Les trois canaux sont donc énumérés EXPLICITEMENT, et « tous refusés » exige qu'ils soient tous
 * les trois présents. Un canal manquant est inconnu, et l'inconnu se confirme — il ne se refuse
 * pas. (Le dépôt en compte 4 aujourd'hui, sur 306.)
 */
const PLACEMENTS_FICHE: readonly Placement[] = ["cabin", "hold", "cargo"];
export function verdictDeFiche(
  policy: Partial<Record<Placement, PlacementPolicy>> | undefined,
): { cls: "ok" | "warn" | "no"; cle: string } {
  const statuts = PLACEMENTS_FICHE.map((p) => policy?.[p]?.status);
  if (statuts.includes("allowed")) return { cls: "ok", cle: "premium.verdict_open" };
  /* `every` sur les TROIS positions : un canal absent vaut `undefined`, jamais `denied`. */
  if (statuts.every((s) => s === "denied")) return { cls: "no", cle: "premium.verdict_none" };
  return { cls: "warn", cle: "air.to_confirm" };
}

/** La source AUDITÉE d'une politique, ou `null` — règle canonique, appliquée telle quelle. */
export const preuveAuditee = (d: PlacementPolicy | undefined): PolicySource | null =>
  preuveAuditeeCanonique(d) ?? null;

/**
 * LE LIEN OFFICIEL À MONTRER, preuve ou simple page associée — contrat plus faible, nom distinct.
 * L'écran a besoin des deux notions : ce qui FONDE la réponse (rien, aujourd'hui) et ce que le
 * visiteur peut aller lire. Les confondre au niveau du code ferait passer la seconde pour la
 * première ; c'est la raison d'être des deux résolveurs séparés dans `preuve.ts`.
 */
export const sourceAffichable = (d: PlacementPolicy | undefined): PolicySource | null =>
  sourceAffichableCanonique(d) ?? null;
