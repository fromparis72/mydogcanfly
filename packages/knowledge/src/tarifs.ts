/**
 * LE CONTRAT TARIFAIRE — schéma, portée exécutable, conflits (10/09/2026, annexe 44).
 *
 * Arbitré par Codex, tranché par Philippe. Ce fichier ne fait qu'une chose : dire ce qu'est un
 * tarif prouvé, et RÉPONDRE si l'un d'eux s'applique à un trajet. Il n'affiche rien, il n'importe
 * rien, il ne convertit rien.
 *
 * ── POURQUOI UN SCHÉMA, ET PAS UNE CHAÎNE ─────────────────────────────────────────────────────
 * Le dépôt a déjà eu des tarifs : des chaînes libres (`fee`, `fareList`) sans devise séparée, sans
 * route, sans date d'applicabilité. Mesuré à l'époque : sur 101 champs tarifaires, 91 venaient de
 * cet héritage, et la carte les rendait nus — une fourchette générique prenait l'apparence d'un
 * prix calculé pour le trajet demandé. Ils ont tous été retirés de l'affichage. Ce contrat est ce
 * qui permet à un montant de revenir : il ne revient que porté par une preuve qui lui est propre.
 *
 * ── LE REFUS DE MON PREMIER SCHÉMA, ET CE QU'IL A APPRIS ──────────────────────────────────────
 * J'avais proposé un champ `unit` unique : `per_segment | per_journey | per_animal | per_container`.
 * Codex l'a refusé pour une raison P0 que je n'avais pas vue : DEUX AXES s'appliquent en même
 * temps. SAS facture par contenant ET par vol. Une seule valeur ne peut pas dire les deux.
 *   · `billing_subject` — ce qui est facturé (l'animal, le contenant, la réservation, l'envoi, le kilo) ;
 *   · `journey_basis`  — à quelle fréquence (par segment, par aller simple, par trajet, par aller-retour).
 * Les deux sont OBLIGATOIRES : un montant dont on ignore l'un des deux ne veut rien dire.
 *
 * ── LA PORTÉE DÉCIDE, LE LIBELLÉ ILLUSTRE ─────────────────────────────────────────────────────
 * « Scandinavie, Europe, Moyen-Orient » est une phrase officielle : elle se montre, elle ne
 * choisit pas un prix. Ce qui choisit est `applies_when`, un prédicat de la MÊME grammaire que les
 * règles (`all` / `any` / `not` / condition sur un `Fact` canonique) — pas une seconde grammaire.
 *
 * Et il est évalué à TROIS valeurs, jamais deux. Un prédicat qui interroge un fait que le moteur
 * ne possède pas ne vaut pas « faux » : il vaut « indécidable ». C'est la faute que ce dépôt
 * répète — un contrôle qui ne parle que de ce qu'il reconnaît compte zéro là où il ne regarde
 * pas — et ici elle publierait un prix pour la mauvaise zone, ou en cacherait un qui s'applique.
 * Un tarif indécidable n'est jamais appliqué au trajet ; il peut être montré comme grille.
 *
 * ── CE QUE LE MOTEUR SAIT, ET CE QU'IL NE SAIT PAS ────────────────────────────────────────────
 * Faits disponibles : origine et destination (aéroport, pays), type de voyage (domestique ou
 * international), poids du chien, canal. Faits ABSENTS, nommés : la ZONE commerciale (« Europe »,
 * « Asie » — aucun découpage de ce genre n'existe dans la base) et le TRANSPORTEUR OPÉRANT (une
 * correspondance opérée par une filiale : Finnair publie 75 kg sur Finnair et 50 kg sur Norra).
 * Une grille zonée est donc, aujourd'hui, indécidable sur la plupart des trajets — et c'est la
 * bonne réponse tant que les zones ne sont pas modélisées, pas une raison de deviner.
 *
 * ── LES CONFLITS ──────────────────────────────────────────────────────────────────────────────
 * Deux pages officielles vivantes qui publient des montants différents ne se tranchent pas au
 * jugé. Le conflit porte les DEUX observations complètes, avec leurs sources et leurs dates, et
 * son effet est de SUPPRIMER le montant exact sur la portée concernée. Trois existent au
 * 10/09/2026 : Finnair soute, South African Airways soute, SunExpress soute à Ercan.
 *
 * ── CE QUE CE FICHIER NE FAIT PAS ─────────────────────────────────────────────────────────────
 * Aucune conversion de devise : plusieurs devises sur une même ligne sont des montants PARALLÈLES
 * publiés par la compagnie, jamais un conflit. Aucun total de correspondance : additionner deux
 * segments exigerait de savoir quels segments sont réellement opérés. Aucun affichage.
 */
import { z } from "zod";
import { SourceCitable, Money, Placement } from "./common";
import type { Placement as PlacementType, Money as MoneyType } from "./common";
import { Predicate, Condition, type Fact } from "./rules";

/* ---- Montant publié ---------------------------------------------------------------------- */

/* `Money` EXISTE DÉJÀ dans `common.ts` — et Codex l'a demandé explicitement : « réemployer `Money`,
   `SourceCitable` et le système de prédicats canonique ; ne pas créer une seconde provenance ni un
   second langage de règles ». *Erreur nommée* : mon premier jet en redéfinissait une copie, avec un
   contrôle ISO 4217 plus strict — deux `Money` dans le même paquet, exactement la faute que ce dépôt
   répète. Le contrôle de casse manquant est rattrapé ici, sur la LIGNE tarifaire, sans toucher au
   type partagé : `AUCUNE conversion`, mais une devise se dit en majuscules. */
const deviseISO = (m: Money) => /^[A-Z]{3}$/.test(m.currency);

/**
 * La NATURE du prix, reprise des classes de l'audit de Codex.
 *   · `exact`        — un montant, ferme, sur sa portée ;
 *   · `range`        — une fourchette publiée (deux montants par devise, min puis max) ;
 *   · `matrix`       — une grille de portées, chacune écrite comme son propre tarif ;
 *   · `formula`      — un calcul publié (poids, volume) que nous ne rejouons pas ;
 *   · `calculator`   — un outil officiel : le prix existe, il n'est pas un nombre chez nous ;
 *   · `booking_only` — le prix n'apparaît qu'à la réservation ;
 *   · `quote`        — sur devis (fret, le plus souvent).
 * Les quatre dernières PROUVENT un mécanisme, jamais une valeur : elles n'autorisent aucun montant.
 */
export const FareKind = z.enum(["exact", "range", "matrix", "formula", "calculator", "booking_only", "quote"]);
export type FareKind = z.infer<typeof FareKind>;

/** Les natures qui portent des montants, et sont donc seules à pouvoir en publier un. */
export const NATURES_CHIFFREES: ReadonlySet<FareKind> = new Set<FareKind>(["exact", "range", "matrix"]);

export const FarePrice = z.object({
  kind: FareKind,
  /** Les montants publiés. Plusieurs devises = la même ligne, dite plusieurs fois. */
  amounts: z.array(Money).default([]),
}).strict()
  .refine((p) => !NATURES_CHIFFREES.has(p.kind) || p.amounts.length > 0, {
    message: "une nature chiffrée (exact, range, matrix) exige au moins un montant", path: ["amounts"],
  })
  .refine((p) => NATURES_CHIFFREES.has(p.kind) || p.amounts.length === 0, {
    message: "une nature non chiffrée (formula, calculator, booking_only, quote) ne porte aucun montant", path: ["amounts"],
  })
  .refine((p) => p.kind !== "range" || p.amounts.length % 2 === 0, {
    message: "une fourchette se dit par paires (minimum puis maximum) dans chaque devise", path: ["amounts"],
  })
  .refine((p) => new Set(p.amounts.map((m) => m.currency)).size === p.amounts.length || p.kind === "range", {
    message: "une devise ne peut porter deux montants sur la même ligne — c'est un conflit, pas un tarif", path: ["amounts"],
  })
  .refine((p) => p.amounts.every(deviseISO), {
    message: "code ISO 4217 à trois lettres majuscules attendu", path: ["amounts"],
  });
export type FarePrice = z.infer<typeof FarePrice>;

/* ---- Les deux axes de facturation, jamais confondus --------------------------------------- */

/** CE QUI est facturé. `pet_or_container` : la page dit « par animal ou par contenant » sans trancher. */
export const BillingSubject = z.enum(["pet", "container", "pet_or_container", "booking", "shipment", "kilogram"]);
export type BillingSubject = z.infer<typeof BillingSubject>;

/** À QUELLE FRÉQUENCE. `per_segment` : chaque vol ; `per_one_way` : l'aller ; `per_journey` : le trajet. */
export const JourneyBasis = z.enum(["per_segment", "per_one_way", "per_journey", "per_round_trip"]);
export type JourneyBasis = z.infer<typeof JourneyBasis>;

/* ---- Le tarif ----------------------------------------------------------------------------- */

/** Fenêtre d'ACHAT — une condition tarifaire (Finnair : 60 € à J-7 ou plus, 65 € à J-6 ou moins).
 *  Distincte de la date du voyage, que le formulaire recueille déjà. */
export const PurchaseWindow = z.object({
  min_days_before_departure: z.number().int().nonnegative().optional(),
  max_days_before_departure: z.number().int().nonnegative().optional(),
}).strict().refine((w) => w.min_days_before_departure != null || w.max_days_before_departure != null, {
  message: "une fenêtre d'achat vide n'est pas une condition",
});
export type PurchaseWindow = z.infer<typeof PurchaseWindow>;

export const Fare = z.object({
  /** Identifiant stable, pour que deux lots ne réécrivent pas la même ligne sans le dire. */
  id: z.string().min(3),
  placement: Placement,
  price: FarePrice,
  billing_subject: BillingSubject,
  journey_basis: JourneyBasis,
  /** La portée EXÉCUTABLE. Absente = le tarif ne s'applique à aucun trajet en particulier : il se
   *  montre comme grille, jamais comme le prix de CE voyage. */
  applies_when: Predicate.optional(),
  /** La portée telle que la page l'écrit — pour l'œil du visiteur. Ne décide jamais. */
  scope_label: z.string().min(1).optional(),
  purchase_window: PurchaseWindow.optional(),
  /** LA CITATION DU PRIX. La phrase qui prouve qu'un canal existe ne prouve pas son montant. */
  source: SourceCitable,
}).strict()
  .refine((f: { price: FarePrice; source: SourceCitable }) => !NATURES_CHIFFREES.has(f.price.kind) || (!!f.source.quote && !!f.source.locator && !!f.source.quote_language), {
    message: "un montant exige sa propre citation : phrase, langue et localisateur", path: ["source", "quote"],
  });
/** Le type est DÉCLARÉ, pas inféré : `applies_when` est un prédicat récursif (`z.lazy`), et
 *  l'inférence le rend `unknown` à travers les `.refine()`. Une portée typée `unknown` se
 *  passerait silencieusement de l'évaluateur — exactement ce que ce fichier existe pour empêcher. */
export type Fare = {
  id: string;
  placement: PlacementType;
  price: FarePrice;
  billing_subject: BillingSubject;
  journey_basis: JourneyBasis;
  applies_when?: Predicate;
  scope_label?: string;
  purchase_window?: PurchaseWindow;
  source: SourceCitable;
};

/* ---- Le conflit --------------------------------------------------------------------------- */

/** Une observation : ce qu'UNE page officielle publiait, à la date où elle a été lue. */
export const FareObservation = z.object({
  price: FarePrice,
  source: SourceCitable,
}).strict();
export type FareObservation = z.infer<typeof FareObservation>;

export const FareConflict = z.object({
  id: z.string().min(3),
  placement: Placement,
  applies_when: Predicate.optional(),
  scope_label: z.string().min(1).optional(),
  status: z.enum(["unresolved", "resolved"]),
  /** Le seul effet admis aujourd'hui : aucun montant exact sur la portée. */
  effect: z.literal("suppress_exact_fare"),
  /** DEUX observations au moins : un conflit à une seule voix n'en est pas un. */
  observations: z.array(FareObservation).min(2),
  note: z.string().optional(),
}).strict();
/** Même raison que `Fare` : le type est déclaré. */
export type FareConflict = {
  id: string;
  placement: PlacementType;
  applies_when?: Predicate;
  scope_label?: string;
  status: "unresolved" | "resolved";
  effect: "suppress_exact_fare";
  observations: FareObservation[];
  note?: string;
};

/* ---- La portée, évaluée à TROIS valeurs ---------------------------------------------------- */

/** Les faits que le Finder injecte réellement. Une clé absente n'est pas « faux » : elle est inconnue. */
export type FaitsTrajet = Partial<Record<Fact, string | number | boolean>>;

export type Verite = "vrai" | "faux" | "indecidable";

const compare = (op: Condition["op"], gauche: unknown, valeur: Condition["value"]): Verite => {
  const arr = Array.isArray(valeur) ? valeur : null;
  switch (op) {
    case "eq": return gauche === valeur ? "vrai" : "faux";
    case "neq": return gauche !== valeur ? "vrai" : "faux";
    case "in": return arr ? (arr.includes(gauche as string | number) ? "vrai" : "faux") : "indecidable";
    case "nin": return arr ? (arr.includes(gauche as string | number) ? "faux" : "vrai") : "indecidable";
    case "gt": case "gte": case "lt": case "lte": {
      if (typeof gauche !== "number" || typeof valeur !== "number") return "indecidable";
      const ok = op === "gt" ? gauche > valeur : op === "gte" ? gauche >= valeur : op === "lt" ? gauche < valeur : gauche <= valeur;
      return ok ? "vrai" : "faux";
    }
    default: return "indecidable";
  }
};

/**
 * ÉVALUATION À TROIS VALEURS, et c'est tout l'objet de ce fichier.
 *
 * `all` : un « faux » suffit à conclure faux ; sinon un « indécidable » rend indécidable.
 * `any` : un « vrai » suffit à conclure vrai ; sinon un « indécidable » rend indécidable.
 * `not` : renverse vrai et faux, laisse l'indécidable indécidable.
 * Condition : un fait absent du contexte rend la condition indécidable — jamais fausse.
 */
export function evaluerPortee(p: Predicate | undefined, faits: FaitsTrajet): Verite {
  if (!p) return "indecidable";
  if ("all" in p) {
    const v = p.all.map((q) => evaluerPortee(q, faits));
    if (v.includes("faux")) return "faux";
    return v.includes("indecidable") ? "indecidable" : "vrai";
  }
  if ("any" in p) {
    const v = p.any.map((q) => evaluerPortee(q, faits));
    if (v.includes("vrai")) return "vrai";
    return v.includes("indecidable") ? "indecidable" : "faux";
  }
  if ("not" in p) {
    const v = evaluerPortee(p.not, faits);
    return v === "vrai" ? "faux" : v === "faux" ? "vrai" : "indecidable";
  }
  const c = p as Condition;
  const gauche = faits[c.fact];
  if (gauche === undefined) return "indecidable";
  return compare(c.op, gauche, c.value);
}

/* ---- La résolution ------------------------------------------------------------------------- */

/** Ce que le Finder recevra un jour — et qu'aucune interface ne lit encore (annexe 44). */
export type ResolutionTarifaire =
  /** Un tarif s'applique au trajet, prouvé, sur une portée décidée. */
  | { etat: "applicable"; tarif: Fare }
  /** Le mécanisme est prouvé, la valeur n'est pas un nombre chez nous (devis, formule, calculateur…). */
  | { etat: "mecanisme"; tarif: Fare }
  /** Un conflit officiel couvre ce trajet : aucun montant exact, et on dit lequel. */
  | { etat: "conflit"; conflit: FareConflict }
  /** Des tarifs existent, mais leur portée n'est pas décidable avec les faits injectés. */
  | { etat: "indecidable"; tarifs: Fare[] }
  /** Deux tarifs différents s'appliquent au même trajet dans la même devise : c'est un conflit. */
  | { etat: "chevauchement"; tarifs: Fare[] }
  /** Rien de prouvé pour ce canal. */
  | { etat: "aucun" };

const memeDevise = (a: Fare, b: Fare) =>
  a.price.amounts.some((x) => b.price.amounts.some((y) => y.currency === x.currency));

const memeMontant = (a: Fare, b: Fare) =>
  JSON.stringify(a.price.amounts.map((m: MoneyType) => [m.currency, m.amount]).sort())
    === JSON.stringify(b.price.amounts.map((m: MoneyType) => [m.currency, m.amount]).sort())
  && a.billing_subject === b.billing_subject && a.journey_basis === b.journey_basis;

/**
 * LE TARIF APPLICABLE À UN TRAJET, ou la raison pour laquelle il n'y en a pas.
 *
 * L'ordre des questions est l'ordre de prudence, et il ne se négocie pas :
 *   1. un CONFLIT dont la portée couvre le trajet (ou dont la portée est indécidable) éteint tout
 *      montant exact — c'est l'invariant « un conflit couvrant le trajet = aucun montant exact » ;
 *   2. les tarifs dont la portée est VRAIE sont candidats ; deux candidats chiffrés qui diffèrent
 *      dans la même devise sont un CHEVAUCHEMENT, donc un conflit, jamais un choix ;
 *   3. un candidat chiffré unique s'applique ; un candidat non chiffré prouve un mécanisme ;
 *   4. sinon, s'il existe des tarifs à portée INDÉCIDABLE, on le dit — la grille peut se montrer,
 *      le prix du trajet non ;
 *   5. sinon, rien.
 */
export function resoudreTarif(
  tarifs: readonly Fare[],
  conflits: readonly FareConflict[],
  placement: PlacementType,
  faits: FaitsTrajet,
): ResolutionTarifaire {
  const conflitsCanal = conflits.filter((c) => c.placement === placement && c.status === "unresolved");
  const conflitCouvrant = conflitsCanal.find((c) => evaluerPortee(c.applies_when, faits) !== "faux");
  if (conflitCouvrant) return { etat: "conflit", conflit: conflitCouvrant };

  const duCanal = tarifs.filter((f) => f.placement === placement);
  if (duCanal.length === 0) return { etat: "aucun" };

  const vrais = duCanal.filter((f) => evaluerPortee(f.applies_when, faits) === "vrai");
  const chiffres = vrais.filter((f) => NATURES_CHIFFREES.has(f.price.kind));
  const divergents = chiffres.filter((a, i) => chiffres.some((b, j) => i !== j && memeDevise(a, b) && !memeMontant(a, b)));
  if (divergents.length > 0) return { etat: "chevauchement", tarifs: divergents };
  if (chiffres.length > 0) return { etat: "applicable", tarif: chiffres[0] };
  if (vrais.length > 0) return { etat: "mecanisme", tarif: vrais[0] };

  const indecidables = duCanal.filter((f) => evaluerPortee(f.applies_when, faits) === "indecidable");
  if (indecidables.length > 0) return { etat: "indecidable", tarifs: indecidables };
  return { etat: "aucun" };
}
