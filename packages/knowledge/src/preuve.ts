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
import { FACTUAL_SOURCE_TYPES, isForbiddenSource } from "./common";

/** La branche d'auteur « non revérifiée », extraite de l'union — jamais son littéral retapé. */
type BrancheNonRevue = Extract<PlacementPolicyAuthored, { review_state: unknown }>;
/** Idem côté runtime : la seule branche qui porte une cause. */
type BrancheConfirmation = Extract<PlacementPolicy, { status: "confirmation_required" }>;

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
    /** Forme RUNTIME : le registre FERMÉ des causes, extrait de la branche `confirmation_required`.
     *
     *  Il était retapé en `string`, ce que le commentaire d'en-tête démentait déjà — « les champs
     *  qui décident sont tirés des schémas ». Ce n'était pas cosmétique : `estNonRevue` teste
     *  `status_cause === "legacy_unreviewed"`, et DIX politiques non revérifiées portent une
     *  source officielle NON dérivée (Qantas soute et fret, Asiana, Condor, EVA Air, French Bee,
     *  Korean Air, Malaysia, Norwegian, Virgin Australia). Sur un `string`, un renommage du
     *  littéral dans le schéma passait à la compilation — et ces dix-là auraient été présentées
     *  comme AUDITÉES. Sur le registre fermé, la comparaison elle-même devient une erreur de
     *  type. La contre-épreuve d'exécution vit dans `test-t0b-legacy-unreviewed.mjs`. */
    status_cause?: BrancheConfirmation["status_cause"];
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
  if (estSourceOfficielleNonCitee(p)) return null;
  if (p.source_derived) return null;
  if (estAutoCitation(p.source.url)) return null;
  return p.source as NonNullable<T["source"]>;
}

/**
 * QUATRIÈME EXCLUSION — la page officielle SANS phrase citée (contre-revue Codex, P0-3).
 *
 * J'avais proposé de laisser ce fichier inchangé pour que la source d'un canal « source
 * officielle associée » reste exposée par `preuveAuditee`. C'était faux, et le nom de la fonction
 * suffisait à le dire : elle promet une preuve AUDITÉE. Lui faire retourner une URL dont aucune
 * phrase n'a été lue, c'est renommer le fait sans le changer — et tous ses appelants, moteur
 * compris, auraient pris cette URL pour une preuve. La fonction la refuse donc.
 */
export const estSourceOfficielleNonCitee = (p: PolitiqueSourcable | undefined | null): boolean =>
  p?.status_cause === "official_source_unquoted";

/**
 * LE LIEN OFFICIEL AFFICHABLE — délibérément distinct de la preuve.
 *
 * Ce n'est pas un troisième modèle de provenance : c'est la même `Source`, résolue par une
 * fonction dont le contrat est plus faible et dit lequel. Elle répond « voici la page où le
 * visiteur ira lire lui-même », jamais « voici ce qui fonde notre réponse ». Les deux
 * résolveurs restent séparés pour qu'aucun appelant ne puisse confondre l'un avec l'autre.
 */
export function sourceAffichable<T extends PolitiqueSourcable>(p: T | undefined | null): NonNullable<T["source"]> | null {
  const auditee = preuveAuditee(p);
  if (auditee) return auditee;
  if (!p || !p.source) return null;
  if (!estSourceOfficielleNonCitee(p)) return null;   // rien d'autre ne devient affichable
  if (p.source_derived) return null;
  if (estAutoCitation(p.source.url)) return null;
  return p.source as NonNullable<T["source"]>;
}


/**
 * CE QU'UNE RÈGLE A LE DROIT DE DÉCIDER — la frontière de confiance, côté RÈGLES.
 *
 * LA FAILLE QUE CECI FERME (contre-revue du 05/09/2026). La frontière avait rétrogradé les 302
 * POLITIQUES : plus aucune ne produisait de verdict sans citation. Mais `evaluate.ts` refusait
 * toujours un canal dès qu'une règle `deny` se déclenchait, sans rien demander à sa provenance.
 * Les deux chemins menaient au même écran, et l'un des deux n'était pas gardé.
 *
 * British Airways l'a montré, et je l'avais rapporté comme une bonne nouvelle : la carte affichait
 * déjà « refusé » en cabine AVANT la citation. Ce n'était pas une confirmation, c'était le
 * symptôme. Pire : `rule_british_airways_no_cabin` refuse cabine ET SOUTE — son nom ne parle que
 * de la cabine, son effet couvre les deux —, sans citation, alors que la page officielle dit
 * l'inverse pour la soute (« Your pet will travel in the hold of our aircraft »).
 *
 * ÉTAT MESURÉ LE 05/09/2026 : sur les règles `deny`, ZÉRO est citée, 130 portent une page
 * officielle sans phrase, 88 sont faibles (type non factuel, ou auto-citation). Aucune ne peut
 * donc décider — et c'est le résultat correct, pas un accident.
 *
 * CE QUI DÉCIDE, ET CE QUI NE DÉCIDE PAS :
 *   `citee`                 page officielle + phrase + langue + emplacement → peut REFUSER, et
 *                           seulement sur les placements que porte son propre `effect.placement` :
 *                           une citation qui prouve la cabine ne ferme pas la soute. Séparer la
 *                           règle est le travail de qui apporte la citation ;
 *   `officielle_non_citee`  une page à montrer, aucun refus ;
 *   `faible`                ni l'un ni l'autre.
 */
export type NiveauDePreuveRegle = "citee" | "officielle_non_citee" | "faible";

/** Forme minimale d'une règle pour ce jugement — on ne lit QUE sa provenance. */
export type RegleSourcable = {
  source?: {
    url?: string; source_type?: string;
    quote?: string; quote_language?: string; locator?: string;
  };
};

export function niveauDePreuveRegle(r: RegleSourcable | undefined | null): NiveauDePreuveRegle {
  const s = r?.source;
  if (!s?.url) return "faible";
  if (isForbiddenSource(s.url)) return "faible";                     // auto-citation : jamais
  if (!(FACTUAL_SOURCE_TYPES as readonly string[]).includes(String(s.source_type))) return "faible";
  try { if (!/^https?:$/.test(new URL(s.url).protocol)) return "faible"; } catch { return "faible"; }
  const citee = typeof s.quote === "string" && s.quote.length >= 10
    && typeof s.quote_language === "string" && s.quote_language.length > 0
    && typeof s.locator === "string" && s.locator.length > 0;
  return citee ? "citee" : "officielle_non_citee";
}

/** `true` si cette règle a le droit de produire un refus ferme. */
export const regleDecisive = (r: RegleSourcable | undefined | null): boolean =>
  niveauDePreuveRegle(r) === "citee";
