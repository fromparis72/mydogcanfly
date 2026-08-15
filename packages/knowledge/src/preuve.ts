/**
 * CE QUI COMPTE COMME PREUVE D'UNE DÉCISION — une règle, un seul endroit.
 *
 * Le contre-test navigateur du 15/08/2026 a trouvé la carte du Finder de Thai Airways affichant
 * « mydogcanfly.com » comme source de sa politique. C'est notre propre page : elle ne prouve rien
 * sur ce que la compagnie publie. 52 des 102 fiches portent une telle source RACINE
 * (`source_type: "other"`), héritée de l'import de juin 2026.
 *
 * TROIS EXCLUSIONS, et elles valent partout où une source justifie une décision — fiche
 * compagnie, carte du Finder, liste de sources d'un rapport :
 *
 *   1. AUTO-CITATION. Un lien vers mydogcanfly.com ne fonde aucune décision. (Le remplacement
 *      des 52 sources racines est un lot à part : ce lot-ci se contente de ne plus les présenter
 *      comme des preuves — les données ne sont pas touchées.)
 *   2. SOURCE DÉRIVÉE. `source_derived` marque une provenance FABRIQUÉE par l'ingestion à partir
 *      de notre propre fiche : page d'accueil de la compagnie, confiance 3, relecteur « derived
 *      from fiche ». Elle documente d'où vient la donnée, elle n'atteste d'aucune lecture d'un
 *      texte publié.
 *      Ne PAS confondre avec `derived_from_fiche`, qui qualifie la POLITIQUE : le fret de Thai
 *      Airways le porte à `true` tout en citant l'URL auditée le 13/08/2026. Trier les preuves
 *      sur ce drapeau-là faisait disparaître la seule source auditée du dépôt.
 *   3. POLITIQUE NON REVÉRIFIÉE. `legacy_unreviewed` dit que NOTRE donnée n'a pas été confrontée
 *      à une source à jour. Lui accoler une source la ferait passer pour vérifiée : une
 *      politique non revue reste SANS source plutôt qu'avec une auto-source.
 *
 * La fonction accepte les DEUX formes d'une politique — celle d'auteur (`review_state`) et celle
 * du runtime (`status_cause`) — parce que la règle est la même des deux côtés et qu'en écrire
 * deux versions, c'est se garantir qu'elles divergeront.
 */

import type { PlacementPolicy, PlacementPolicyAuthored } from "./objects";

/** La branche d'auteur « non revérifiée », extraite de l'union — jamais son littéral retapé. */
type BrancheNonRevue = Extract<PlacementPolicyAuthored, { review_state: unknown }>;

/** Le domaine du site. Les sous-domaines comptent ; « notmydogcanfly.com » ne compte pas. */
const AUTO_CITATION = /(^|\.)mydogcanfly\.com$/i;

/** `true` si l'URL est une page de MyDogCanFly. Une URL illisible n'est pas une auto-citation. */
export function estAutoCitation(url: string | undefined | null): boolean {
  if (!url) return false;
  try { return AUTO_CITATION.test(new URL(String(url)).hostname); } catch { return false; }
}

/**
 * Forme minimale commune aux deux modèles de politique — rien d'autre n'est lu ici.
 *
 * Les deux champs qui décident sont TIRÉS des schémas, jamais retapés : `Pick` échoue à la
 * compilation si `source` ou `source_derived` change de nom dans `PlacementPolicy`, et
 * `review_state` reprend le littéral de la branche non revérifiée. La contre-revue du 15/08/2026
 * a montré ce que coûte une redéclaration à la main — un champ décrit sous un nom, lu sous un
 * autre, et plus aucun type pour le dire.
 */
export type PolitiqueSourcable =
  Partial<Pick<PlacementPolicy, "source" | "source_derived">>
  & {
    /** Forme d'AUTEUR : la branche non revérifiée porte ce discriminant. */
    review_state?: BrancheNonRevue["review_state"];
    /** Forme RUNTIME : présent sur la seule branche `confirmation_required`, d'où le `string`. */
    status_cause?: string;
  };

/** `true` quand la politique dit « notre donnée n'a pas été revérifiée », quelle que soit sa forme. */
export const estNonRevue = (p: PolitiqueSourcable | undefined | null): boolean =>
  p?.review_state === "legacy_unreviewed" || p?.status_cause === "legacy_unreviewed";

/**
 * La source AUDITÉE d'une politique, ou `null` si elle n'en a pas au sens ci-dessus.
 * Le type de retour suit celui de l'entrée : l'appelant garde ses champs (`quote`, `confidence`…).
 */
export function preuveAuditee<T extends PolitiqueSourcable>(p: T | undefined | null): NonNullable<T["source"]> | null {
  if (!p || !p.source) return null;
  if (estNonRevue(p)) return null;
  if (p.source_derived) return null;
  if (estAutoCitation(p.source.url)) return null;
  return p.source as NonNullable<T["source"]>;
}
