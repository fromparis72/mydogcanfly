/**
 * LE CONTRAT TARIFAIRE — schéma, portée exécutable, conflits (10/09/2026, annexes 44 et 45).
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
 * ── LES SIX PORTES REFERMÉES LE 10/09 (contre-revue de Codex sur la PR #56) ────────────────────
 * La première version de ce fichier était juste dans son principe et fuyait par six endroits. Ils
 * sont nommés ici, et chacun est nommé une seconde fois à l'endroit du code qui le referme :
 *   · P0-1 — la citation n'était exigée QUE des montants. « Sur devis », « calculateur officiel »,
 *     « prix visible à la réservation » et « formule » passaient sans preuve, alors que ce sont des
 *     affirmations tarifaires que le visiteur croira. Elle est désormais exigée de TOUT tarif, et
 *     de CHAQUE observation d'un conflit — deux URL nues ne prouvent pas un désaccord.
 *   · P0-2 — `purchase_window` était enregistrée et jamais lue. Les deux prix Finnair (J-7 ou plus,
 *     J-6 ou moins) étaient donc applicables ENSEMBLE, et se déclaraient en chevauchement. Le délai
 *     avant départ entre maintenant dans le contexte, et s'évalue lui aussi à trois valeurs.
 *   · P0-3 — `status: "resolved"` était une porte arrière : remplacer un mot suffisait à éteindre un
 *     conflit, sans gagnant, sans preuve, sans date, sans auteur. Seul `unresolved` est admis.
 *   · P0-4 — une fourchette n'exigeait qu'un NOMBRE PAIR de montants : « 60 EUR » et « 100 USD »
 *     passaient. Compter n'est pas vérifier. Deux bornes PAR DEVISE, basse avant haute.
 *   · P1 — `{ all: [] }` est vrai par vacuité : une portée qui ne dit rien s'appliquait partout.
 *     Les combinateurs vides sont refusés récursivement.
 *   · P1 — deux tarifs applicables dans des devises disjointes étaient déclarés compatibles, puis
 *     le premier seul était servi. La résolution rend désormais TOUTES les variantes parallèles.
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
 * jugé. Le conflit porte les DEUX observations complètes, avec leurs sources, leurs citations et
 * leurs dates, et son effet est de SUPPRIMER le montant exact sur la portée concernée. Trois
 * existent au 10/09/2026 : Finnair soute, South African Airways soute, SunExpress soute à Ercan.
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
const deviseISO = (m: MoneyType) => /^[A-Z]{3}$/.test(m.currency);

/** Les montants regroupés PAR DEVISE, dans l'ordre où la page les publie.
 *
 *  *Porte P0-4, refermée le 10/09.* La version précédente n'exigeait d'une fourchette qu'un NOMBRE
 *  PAIR de montants. « 60 EUR » et « 100 USD » faisaient donc une « fourchette » parfaitement
 *  valide, où aucune devise ne porte à la fois sa borne basse et sa borne haute. Compter n'est pas
 *  vérifier : une fourchette se lit devise par devise, ou elle ne se lit pas. */
const grouperParDevise = (amounts: readonly MoneyType[]): Map<string, number[]> => {
  const parDevise = new Map<string, number[]>();
  for (const m of amounts) parDevise.set(m.currency, [...(parDevise.get(m.currency) ?? []), m.amount]);
  return parDevise;
};

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
 * Elles exigent en revanche la MÊME preuve que les autres — voir `citationComplete`.
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
  /* P0-4, premier volet : EXACTEMENT deux bornes par devise. Ni une (une borne seule n'encadre
     rien), ni trois (on ne saurait pas laquelle est le maximum). */
  .refine((p) => p.kind !== "range" || [...grouperParDevise(p.amounts).values()].every((v) => v.length === 2), {
    message: "une fourchette porte EXACTEMENT deux montants par devise (minimum puis maximum) : « 60 EUR et 100 USD » n'encadre aucune devise", path: ["amounts"],
  })
  /* P0-4, second volet : la borne basse d'abord. Une fourchette inversée publierait un « à partir
     de 100 € » là où la page dit « jusqu'à 100 € ». */
  .refine((p) => p.kind !== "range" || [...grouperParDevise(p.amounts).values()].every((v) => v.length !== 2 || v[0] <= v[1]), {
    message: "la borne basse d'une fourchette ne peut dépasser la borne haute (minimum d'abord, maximum ensuite)", path: ["amounts"],
  })
  .refine((p) => new Set(p.amounts.map((m) => m.currency)).size === p.amounts.length || p.kind === "range", {
    message: "une devise ne peut porter deux montants sur la même ligne — c'est un conflit, pas un tarif", path: ["amounts"],
  })
  .refine((p) => p.amounts.every(deviseISO), {
    message: "code ISO 4217 à trois lettres majuscules attendu", path: ["amounts"],
  });
export type FarePrice = z.infer<typeof FarePrice>;

/* ---- Les deux exigences transversales : la preuve, et la portée non vide ------------------- */

/**
 * LA CITATION, exigée de TOUT tarif — pas seulement des montants.
 *
 * *Porte P0-1, refermée le 10/09.* La version précédente ne l'exigeait que des natures chiffrées.
 * « Sur devis », « calculateur officiel », « prix visible à la réservation » et « formule »
 * passaient donc sans phrase, sans langue et sans localisateur. Ce sont pourtant des affirmations
 * tarifaires comme les autres : écrire « le fret se fait sur devis » engage exactement autant que
 * « 725 € », et un visiteur qui le lit y croit. Prouver un mécanisme est aussi coûteux que prouver
 * un nombre, et ce contrat n'accepte plus de le faire à moindre frais.
 */
const citationComplete = (s: SourceCitable) => !!s.quote && !!s.quote_language && !!s.locator;

/**
 * Un combinateur VIDE est refusé, récursivement, où qu'il se trouve dans la portée.
 *
 * *Porte P1, refermée le 10/09.* `{ all: [] }` est vrai par vacuité : un tarif ainsi porté
 * s'appliquerait à TOUS les trajets, sans que personne l'ait jamais écrit. `{ any: [] }` est faux
 * par vacuité : le tarif disparaîtrait aussi silencieusement. Les deux sont des pertes muettes,
 * et un fichier `.yml` mal indenté suffit à en produire une. Une portée qui ne dit rien ne doit ni
 * tout dire ni rien dire : elle doit être refusée à l'écriture.
 */
export function porteeSaine(p: Predicate | undefined): boolean {
  if (!p) return true;
  if ("all" in p) return p.all.length > 0 && p.all.every(porteeSaine);
  if ("any" in p) return p.any.length > 0 && p.any.every(porteeSaine);
  if ("not" in p) return porteeSaine(p.not);
  return true;
}

/* ---- Les deux axes de facturation, jamais confondus --------------------------------------- */

/** CE QUI est facturé. `pet_or_container` : la page dit « par animal ou par contenant » sans trancher. */
export const BillingSubject = z.enum(["pet", "container", "pet_or_container", "booking", "shipment", "kilogram"]);
export type BillingSubject = z.infer<typeof BillingSubject>;

/** À QUELLE FRÉQUENCE. `per_segment` : chaque vol ; `per_one_way` : l'aller ; `per_journey` : le trajet. */
export const JourneyBasis = z.enum(["per_segment", "per_one_way", "per_journey", "per_round_trip"]);
export type JourneyBasis = z.infer<typeof JourneyBasis>;

/* ---- Le tarif ----------------------------------------------------------------------------- */

/** Fenêtre d'ACHAT — une condition tarifaire (Finnair : 60 € à J-7 ou plus, 65 € à J-6 ou moins).
 *  Distincte de la date du voyage, que le formulaire recueille déjà.
 *
 *  *Porte P0-2, refermée le 10/09.* Ce champ existait déjà, et RIEN ne le lisait. Les deux prix
 *  Finnair, dont les portées `applies_when` sont identiques, étaient donc applicables ensemble et
 *  se déclaraient mutuellement en chevauchement : le contrat inventait un conflit là où la page
 *  publie une règle parfaitement claire. Il est maintenant évalué par `evaluerFenetre`. */
export const PurchaseWindow = z.object({
  min_days_before_departure: z.number().int().nonnegative().optional(),
  max_days_before_departure: z.number().int().nonnegative().optional(),
}).strict()
  .refine((w) => w.min_days_before_departure != null || w.max_days_before_departure != null, {
    message: "une fenêtre d'achat vide n'est pas une condition",
  })
  .refine((w) => w.min_days_before_departure == null || w.max_days_before_departure == null
    || w.min_days_before_departure <= w.max_days_before_departure, {
    message: "une fenêtre d'achat dont le plancher dépasse le plafond ne s'ouvre jamais",
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
  /* P0-1 : la citation n'est plus réservée aux montants. Tout tarif la doit. */
  .refine((f: { source: SourceCitable }) => citationComplete(f.source), {
    message: "tout tarif exige sa propre citation : phrase, langue et localisateur — un mécanisme se prouve comme un montant", path: ["source", "quote"],
  })
  /* P1 : aucune portée vide par vacuité. */
  .refine((f: { applies_when?: Predicate }) => porteeSaine(f.applies_when), {
    message: "une portée tarifaire ne peut porter de combinateur vide : `{ all: [] }` s'appliquerait à tous les trajets", path: ["applies_when"],
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

/** Une observation : ce qu'UNE page officielle publiait, à la date où elle a été lue.
 *
 *  *Porte P0-1, second volet.* Sa citation est obligatoire, au même titre que celle d'un tarif :
 *  un conflit ne s'affirme pas avec deux URL nues. Ce que la fiche dira un jour au visiteur, c'est
 *  « ces deux pages publient ces deux phrases » — il faut donc les deux phrases. */
export const FareObservation = z.object({
  price: FarePrice,
  source: SourceCitable,
}).strict()
  .refine((o: { source: SourceCitable }) => citationComplete(o.source), {
    message: "chaque observation d'un conflit exige sa citation complète : phrase, langue et localisateur", path: ["source", "quote"],
  });
export type FareObservation = z.infer<typeof FareObservation>;

export const FareConflict = z.object({
  id: z.string().min(3),
  placement: Placement,
  applies_when: Predicate.optional(),
  scope_label: z.string().min(1).optional(),
  /**
   * `unresolved`, ET RIEN D'AUTRE.
   *
   * *Porte P0-3, refermée le 10/09.* Le schéma admettait `resolved`, et rien de plus : pas de
   * gagnant désigné, pas de preuve nouvelle, pas de date, pas d'auteur, pas de motif. Changer un
   * mot dans un `.yml` suffisait donc à rallumer un montant que deux pages officielles
   * contredisent — une porte arrière, et mon témoin la consacrait en la déclarant normale.
   * Pour cette première version, le choix sûr est qu'un conflit ne se résout PAS ici : il se
   * retire, ce qui laisse une trace dans l'historique du dépôt. Un vrai modèle de résolution
   * (gagnant, preuve, date, auteur) viendra avec sa propre preuve, ou ne viendra pas.
   */
  status: z.literal("unresolved"),
  /** Le seul effet admis aujourd'hui : aucun montant exact sur la portée. */
  effect: z.literal("suppress_exact_fare"),
  /** DEUX observations au moins : un conflit à une seule voix n'en est pas un. */
  observations: z.array(FareObservation).min(2),
  note: z.string().optional(),
}).strict()
  .refine((c: { applies_when?: Predicate }) => porteeSaine(c.applies_when), {
    message: "une portée de conflit ne peut porter de combinateur vide", path: ["applies_when"],
  });
/** Même raison que `Fare` : le type est déclaré. */
export type FareConflict = {
  id: string;
  placement: PlacementType;
  applies_when?: Predicate;
  scope_label?: string;
  status: "unresolved";
  effect: "suppress_exact_fare";
  observations: FareObservation[];
  note?: string;
};

/* ---- La portée, évaluée à TROIS valeurs ---------------------------------------------------- */

/**
 * Les faits que le Finder injecte réellement. Une clé absente n'est pas « faux » : elle est inconnue.
 *
 * `days_before_departure` n'est PAS un `Fact` du moteur, et n'est pas ajouté à la grammaire des
 * règles : aucune règle de placement ne s'en sert, et gonfler l'énumération partagée pour un seul
 * usage tarifaire créerait un fait que 302 politiques ignoreraient. C'est une donnée du CONTEXTE
 * D'ACHAT, propre au calcul d'un prix, et elle est traitée comme telle — nommée ici pour que
 * personne ne la cherche dans `rules.ts`.
 */
export type FaitsTrajet = Partial<Record<Fact, string | number | boolean>> & {
  /** Jours entre l'achat et le départ. Absent = délai inconnu, donc fenêtre indécidable. */
  days_before_departure?: number;
};

export type Verite = "vrai" | "faux" | "indecidable";

/** La conjonction à trois valeurs : un « faux » l'emporte, puis un « indécidable ». */
const et = (a: Verite, b: Verite): Verite =>
  a === "faux" || b === "faux" ? "faux" : a === "indecidable" || b === "indecidable" ? "indecidable" : "vrai";

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
 *
 * COMBINATEUR VIDE : `indecidable`, jamais la vérité par vacuité. Le schéma le refuse déjà à
 * l'écriture (`porteeSaine`), et c'est là que se joue la garantie ; l'évaluateur est néanmoins
 * exporté et pourra recevoir un prédicat construit ailleurs. Répondre « vrai » à une portée vide
 * appliquerait le tarif partout ; répondre « indécidable » ne l'applique nulle part et le dit.
 * La prudence se règle dans le même sens aux deux endroits.
 */
export function evaluerPortee(p: Predicate | undefined, faits: FaitsTrajet): Verite {
  if (!p) return "indecidable";
  if ("all" in p) {
    if (p.all.length === 0) return "indecidable";
    const v = p.all.map((q) => evaluerPortee(q, faits));
    if (v.includes("faux")) return "faux";
    return v.includes("indecidable") ? "indecidable" : "vrai";
  }
  if ("any" in p) {
    if (p.any.length === 0) return "indecidable";
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

/**
 * LA FENÊTRE D'ACHAT, évaluée aux mêmes trois valeurs (P0-2).
 *
 * Trois cas, et le troisième est celui qui compte :
 *   · pas de fenêtre du tout → `vrai` : le tarif ne pose aucune condition d'achat, il ne restreint
 *     rien. C'est différent d'une fenêtre qu'on ne saurait pas évaluer.
 *   · un délai connu → `vrai` ou `faux`, selon qu'il tombe ou non dans la fenêtre ;
 *   · une fenêtre écrite, un délai ABSENT du contexte → `indecidable`. Le Finder ne demande pas
 *     encore la date d'achat ; tant qu'il ne la demande pas, les deux prix Finnair sont tous deux
 *     indécidables, et aucun montant n'est publié. C'est la bonne réponse : à moitié su, pas dit.
 */
export function evaluerFenetre(w: PurchaseWindow | undefined, faits: FaitsTrajet): Verite {
  if (!w) return "vrai";
  const jours = faits.days_before_departure;
  if (typeof jours !== "number" || !Number.isFinite(jours)) return "indecidable";
  if (w.min_days_before_departure != null && jours < w.min_days_before_departure) return "faux";
  if (w.max_days_before_departure != null && jours > w.max_days_before_departure) return "faux";
  return "vrai";
}

/** La portée COMPLÈTE d'un tarif : sa portée de trajet ET sa fenêtre d'achat, conjuguées à trois
 *  valeurs. Aucune des deux ne se lit sans l'autre — c'était tout le défaut P0-2. */
export function porteeTarif(f: Fare, faits: FaitsTrajet): Verite {
  return et(evaluerPortee(f.applies_when, faits), evaluerFenetre(f.purchase_window, faits));
}

/* ---- La résolution ------------------------------------------------------------------------- */

/** Ce que le Finder recevra un jour — et qu'aucune interface ne lit encore (annexe 45). */
export type ResolutionTarifaire =
  /** Un ou plusieurs tarifs s'appliquent au trajet, prouvés, sur une portée décidée. PLUSIEURS
   *  quand la compagnie publie des variantes parallèles en devises disjointes : elles sont TOUTES
   *  rendues, jamais réduites à la première (P1). */
  | { etat: "applicable"; tarifs: Fare[] }
  /** Le mécanisme est prouvé, la valeur n'est pas un nombre chez nous (devis, formule, calculateur…). */
  | { etat: "mecanisme"; tarifs: Fare[] }
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
 *   2. les tarifs dont la portée ET la fenêtre d'achat sont VRAIES sont candidats ; deux candidats
 *      chiffrés qui diffèrent dans la même devise sont un CHEVAUCHEMENT, donc un conflit ;
 *   3. les candidats chiffrés s'appliquent — TOUS, y compris les variantes en devises disjointes ;
 *      les candidats non chiffrés prouvent un mécanisme ;
 *   4. sinon, s'il existe des tarifs à portée INDÉCIDABLE, on le dit — la grille peut se montrer,
 *      le prix du trajet non ;
 *   5. sinon, rien.
 *
 * *Porte P1, refermée le 10/09* : l'étape 3 rendait `chiffres[0]`. Deux montants publiés en
 * devises disjointes, tous deux applicables, étaient déclarés compatibles par `memeDevise` — puis
 * un seul sortait, l'autre disparaissait sans un mot. Elles sortent maintenant ensemble, et c'est
 * à l'affichage de dire « 725 € ou 5 400 DKK », pas au résolveur de choisir pour le visiteur.
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

  const vrais = duCanal.filter((f) => porteeTarif(f, faits) === "vrai");
  const chiffres = vrais.filter((f) => NATURES_CHIFFREES.has(f.price.kind));
  const divergents = chiffres.filter((a, i) => chiffres.some((b, j) => i !== j && memeDevise(a, b) && !memeMontant(a, b)));
  if (divergents.length > 0) return { etat: "chevauchement", tarifs: divergents };
  if (chiffres.length > 0) return { etat: "applicable", tarifs: chiffres };
  if (vrais.length > 0) return { etat: "mecanisme", tarifs: vrais };

  const indecidables = duCanal.filter((f) => porteeTarif(f, faits) === "indecidable");
  if (indecidables.length > 0) return { etat: "indecidable", tarifs: indecidables };
  return { etat: "aucun" };
}
