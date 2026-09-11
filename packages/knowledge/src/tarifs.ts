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
import { Money, Placement } from "./common";
import type { Placement as PlacementType, Money as MoneyType } from "./common";
import { Predicate, Condition, type Fact } from "./rules";
/* LA provenance stricte du dépôt, réemployée telle quelle — jamais recopiée. `T0bAuditSource`
   est `SourcedQuote` (URL http(s), aucun domaine MyDogCanFly, type de source FACTUEL, citation
   d'au moins dix caractères, étiquette BCP-47) plus la cadence `airline` de 90 jours au jour près
   et le localisateur obligatoire. Voir la porte P0-1 de l'annexe 46. */
import { T0bAuditSource } from "./t0b-migration";

/**
 * LA PROVENANCE D'UN TARIF, TYPÉE DEPUIS LE SCHÉMA QUI LA VALIDE RÉELLEMENT.
 *
 * *Porte P1-2, refermée le 10/09 au soir.* Les types déclarés de `Fare` et `FareObservation`
 * annonçaient `SourcedQuote` — la forme FAIBLE — alors que les schémas validaient déjà
 * `T0bAuditSource`. `resoudreTarif` reçoit des `Fare[]` sans les reparser : un appelant en
 * TypeScript pouvait donc lui passer, en toute légalité de compilation, une provenance que le
 * schéma aurait refusée. Le type suit désormais la définition validée, et la suivra si elle bouge.
 *
 * *Et cet alias, SEUL, ne ferme rien — quatrième tour, 11/09.* J'avais nommé la limite (« les
 * `.refine()` de Zod ne restreignent pas le type inféré ») en croyant que la nommer suffisait.
 * Codex l'a reproduite : une provenance pointant vers `mydogcanfly.com`, sans `locator`, avec une
 * échéance en 2030, compile sans un seul diagnostic ; `Fare.safeParse` la refuse, et
 * `resoudreTarif` la publiait quand même, puisqu'il recevait des `Fare[]` sans les reparser.
 * **Nommer une limite n'est pas la fermer.** C'est la même faute que j'ai commise trois fois dans
 * ce fichier sous une autre forme — un commentaire juste tenant lieu de garantie. Ce que cet alias
 * fait vraiment tient en une phrase : il évite une SECONDE définition et suivra `T0bAuditSource`
 * si elle se resserre. La fermeture, elle, est ailleurs — voir « La frontière » plus bas.
 */
export type FareAuditSource = z.infer<typeof T0bAuditSource>;

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

/* LA PREUVE D'UN TARIF EST `T0bAuditSource`, ET RIEN D'AUTRE — voir la déclaration de `Fare`.

   *Porte P0-1, premier tour (10/09, matin).* La version d'avant n'exigeait la phrase que des
   natures chiffrées : « sur devis », « calculateur », « prix visible à la réservation » et
   « formule » passaient nus. J'ai alors ajouté un contrôle maison, `citationComplete`, qui
   vérifiait la présence de `quote`, `quote_language` et `locator` sur un `SourceCitable`.

   *Porte P0-1, second tour (10/09, soir) — et c'est la même faute, en plus grave.* Ce contrôle
   maison vérifiait que les trois champs EXISTAIENT, jamais qu'ils étaient ADMISSIBLES. Codex a
   fait passer cinq sabotages d'affilée : une URL `mydogcanfly.com` (auto-citation), un
   `source_type: press`, un `source_type: other`, une URL `ftp://`, et une échéance de relecture
   repoussée arbitrairement loin — c'est-à-dire pas de relecture du tout. J'avais écrit une
   SECONDE définition de « source sérieuse », plus faible que celle du dépôt : exactement la faute
   que l'en-tête de `ingest-airlines.mjs` documente déjà, mot pour mot, à propos de la provenance,
   et que j'avais lue en écrivant ce fichier. `citationComplete` est supprimé, le contrat approuvé
   est réemployé tel quel, et rien de ce qu'il garantit n'est retapé ici. */

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
  /** LA PREUVE DU PRIX, sous le contrat strict du dépôt. La phrase qui prouve qu'un canal existe
   *  ne prouve pas son montant : deux citations distinctes, deux champs distincts. Et une phrase
   *  n'est pas une preuve si sa page n'en est pas une — d'où `T0bAuditSource` et non un contrôle
   *  de présence écrit ici (P0-1, second tour). */
  source: T0bAuditSource,
}).strict()
  /* P1 : aucune portée vide par vacuité. */
  .refine((f: { applies_when?: Predicate }) => porteeSaine(f.applies_when), {
    message: "une portée tarifaire ne peut porter de combinateur vide : `{ all: [] }` s'appliquerait à tous les trajets", path: ["applies_when"],
  });
/* Le type est DÉCLARÉ, pas inféré : `applies_when` est un prédicat récursif (`z.lazy`), et
   l'inférence le rend `unknown` à travers les `.refine()`. Une portée typée `unknown` se passerait
   silencieusement de l'évaluateur. Il est déclaré plus bas, avec sa marque de validation. */

/* ---- LA FRONTIÈRE ENTRE VALIDATION ET RÉSOLUTION ------------------------------------------ */

/**
 * LA MARQUE DE VALIDATION (porte P1, quatrième tour — 11/09/2026, annexe 48).
 *
 * *Ce que Codex a reproduit sur `a676fb8`.* Un tarif dont la provenance pointe vers
 * `mydogcanfly.com`, sans localisateur, avec une échéance de relecture en 2030, était accepté par
 * TypeScript sans un seul diagnostic. `Fare.safeParse(...)` rendait `false` — le schéma faisait son
 * travail — mais `resoudreTarif(...).montants` rendait `1`, parce que le résolveur reçoit des
 * `Fare[]` et ne les reparse pas. Entre le schéma qui refuse et le résolveur qui publie, il n'y
 * avait RIEN. Aucun tarif n'étant encore importé ni affiché, la production n'a jamais été exposée ;
 * la porte devait néanmoins se fermer avant l'import des 102 compagnies.
 *
 * Elle se ferme aux DEUX endroits, et il faut les deux :
 *   · à la COMPILATION, une marque de type. Un `Fare` ne s'écrit plus à la main : il s'obtient par
 *     `lireTarif`, qui parse. Le coût de l'erreur tombe à zéro — elle devient rouge dans l'éditeur.
 *     Mais une marque est purement typographique : `valeur as Fare` l'efface sans laisser de trace.
 *   · à l'EXÉCUTION, `resoudreTarif` REPARSE toutes ses entrées et LÈVE si l'une d'elles ne passe
 *     pas. C'est la seule garantie qu'aucun transtypage ne contourne.
 * Prise seule, chacune se contourne : une marque par un `as`, un reparsage par un chemin de code
 * que personne n'emprunte. Prises ensemble, elles ferment la frontière.
 *
 * *Pourquoi LEVER plutôt que filtrer en silence.* Écarter discrètement un tarif non conforme
 * rendrait « aucun montant » là où la donnée est fautive, et ce dossier passe son temps à
 * combattre exactement cette disparition muette. Un tarif que le schéma refuse au moment de la
 * résolution n'est pas une donnée incertaine : c'est un défaut de programme ou d'artefact, et la
 * bonne réponse est un arrêt bruyant, au build, avec l'identifiant et le motif.
 */
declare const MARQUE_VALIDE: unique symbol;

/** `T` tel que le contrat l'a réellement accepté. La marque n'existe qu'au type : rien ne la porte
 *  à l'exécution, et c'est précisément pourquoi le reparsage reste nécessaire. */
export type Valide<T> = T & { readonly [MARQUE_VALIDE]: true };

/** LE TARIF TEL QU'ON L'ÉCRIT dans une fiche — avant que le contrat ne l'ait accepté. */
export type FareEcrit = {
  id: string;
  placement: PlacementType;
  price: FarePrice;
  billing_subject: BillingSubject;
  journey_basis: JourneyBasis;
  applies_when?: Predicate;
  scope_label?: string;
  purchase_window?: PurchaseWindow;
  source: FareAuditSource;
};

/** LE TARIF TEL QUE LE RÉSOLVEUR L'ACCEPTE : validé, et seulement par `lireTarif`. */
export type Fare = Valide<FareEcrit>;

/* ---- Le conflit --------------------------------------------------------------------------- */

/** Une observation : ce qu'UNE page officielle publiait, à la date où elle a été lue.
 *
 *  Sa provenance est le MÊME contrat strict que celle d'un tarif — un conflit ne s'affirme pas
 *  avec deux URL nues, et pas davantage avec deux pages de presse ou deux liens vers nous-mêmes.
 *  Ce que la fiche dira un jour au visiteur, c'est « ces deux pages officielles publient ces deux
 *  phrases » : il faut donc que ce soient deux pages officielles, et deux phrases.
 *
 *  Son prix est forcément CHIFFRÉ (P0-2) : l'effet d'un conflit est `suppress_exact_fare`, et
 *  deux mécanismes — « sur devis » contre « calculateur » — ne se contredisent sur aucun montant. */
export const FareObservation = z.object({
  price: FarePrice,
  source: T0bAuditSource,
}).strict()
  .refine((o: { price: FarePrice }) => NATURES_CHIFFREES.has(o.price.kind), {
    message: "une observation de conflit porte un MONTANT : deux mécanismes ne se contredisent sur aucun prix", path: ["price", "kind"],
  });
export type FareObservation = { price: FarePrice; source: FareAuditSource };

/**
 * DEUX OBSERVATIONS SE CONTREDISENT-ELLES VRAIMENT ? (P0-1, troisième tour)
 *
 * *Porte refermée le 10/09 au soir.* « 100 EUR sur une page, 120 USD sur une autre » passait pour
 * un conflit. Sans conversion — et ce fichier n'en fait aucune — ces deux montants ne se
 * contredisent sur rien : ce sont deux devises PARALLÈLES, exactement ce que le contrat reconnaît
 * déjà comme normal sur un tarif ordinaire depuis l'annexe 44. J'avais écrit la règle pour les
 * tarifs et oublié de l'appliquer aux conflits, qui sont pourtant faits des mêmes prix.
 *
 * Il faut donc AU MOINS UNE DEVISE COMMUNE portant des valeurs différentes. Deux observations aux
 * devises entièrement disjointes sont refusées.
 */
const desaccordSurUneDevise = (observations: readonly { price: FarePrice }[]): boolean => {
  for (let i = 0; i < observations.length; i++) {
    for (let j = i + 1; j < observations.length; j++) {
      const a = grouperParDevise(observations[i].price.amounts);
      const b = grouperParDevise(observations[j].price.amounts);
      for (const [devise, gauche] of a) {
        const droite = b.get(devise);
        if (droite && JSON.stringify([...gauche].sort()) !== JSON.stringify([...droite].sort())) return true;
      }
    }
  }
  return false;
};

/**
 * LA PREUVE CANONIQUE d'une observation (P1-1).
 *
 * *Porte refermée le 10/09 au soir.* Deux prix différents pouvaient s'appuyer sur la MÊME preuve —
 * même URL, même localisateur, même citation, même date de lecture — et fabriquer ainsi un conflit
 * à partir d'une seule lecture. Deux preuves distinctes sont désormais exigées.
 *
 * Le tuple retenu est `url + locator + quote + verified_date`, et pas le domaine ni l'URL seule :
 * une même page publie légitimement deux sections tarifaires, et l'exigence doit pouvoir se
 * satisfaire à l'intérieur d'une page. *Ce que ce contrôle ne prouve pas, et qu'il ne faut pas lui
 * faire dire* : que le nombre écrit corresponde à la phrase citée. Cette relecture-là reste
 * humaine. Il empêche seulement de DUPLIQUER une preuve unique pour manufacturer un désaccord.
 */
const preuveCanonique = (s: FareAuditSource): string =>
  `${s.url}|${s.locator ?? ""}|${s.quote}|${s.verified_date}`;

/** LE PRIX CANONIQUE d'une observation — devises triées, montants inclus, nature incluse.
 *  Deux observations qui rendent la même chaîne disent le MÊME prix : les opposer serait citer
 *  deux fois la même page. */
const prixCanonique = (p: FarePrice): string =>
  `${p.kind}|${p.amounts.map((m: MoneyType) => `${m.currency}:${m.amount}`).sort().join(",")}`;

export const FareConflict = z.object({
  id: z.string().min(3),
  placement: Placement,
  applies_when: Predicate.optional(),
  scope_label: z.string().min(1).optional(),
  /**
   * LES AXES COMMUNS, OBLIGATOIRES (P0-2).
   *
   * Un conflit n'existe qu'entre deux montants qui veulent dire la même chose. « 140 € par animal
   * et par aller » contre « 120 € par contenant et par segment » ne sont pas deux prix
   * contradictoires : ce sont deux tarifs différents, et les opposer effacerait les deux. Le
   * conflit doit donc DIRE sur quels axes il porte, au lieu de les laisser deviner.
   */
  billing_subject: BillingSubject,
  journey_basis: JourneyBasis,
  /** La fenêtre d'achat commune, si les deux pages parlent du même moment d'achat. Elle est
   *  réellement évaluée par `resoudreTarif` — un conflit hors fenêtre ne couvre pas le trajet. */
  purchase_window: PurchaseWindow.optional(),
  /**
   * `unresolved`, ET RIEN D'AUTRE.
   *
   * *Porte P0-3 du premier tour.* Le schéma admettait `resolved`, et rien de plus : pas de
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
  })
  /**
   * DEUX PRIX RÉELLEMENT DIFFÉRENTS (P0-2).
   *
   * *Porte refermée le 10/09 au soir.* Deux observations strictement identiques passaient, et le
   * résolveur éteignait alors un tarif parfaitement prouvé au nom d'un désaccord qui n'existait
   * pas. C'est le sabotage le plus coûteux des quatre : il ne publie pas un prix faux, il EFFACE
   * un prix vrai — et rien, dans l'interface, n'aurait dit pourquoi. Citer deux fois la même
   * page n'est pas un conflit ; c'est une citation en double.
   */
  .refine((c: { observations: { price: FarePrice }[] }) => new Set(c.observations.map((o) => prixCanonique(o.price))).size >= 2, {
    message: "un conflit exige au moins DEUX prix canoniquement différents : deux fois le même montant n'est pas un désaccord", path: ["observations"],
  })
  /* P0-1, troisième tour : des devises disjointes ne se contredisent pas. */
  .refine((c: { observations: { price: FarePrice }[] }) => desaccordSurUneDevise(c.observations), {
    message: "un conflit exige au moins une DEVISE COMMUNE portant des valeurs différentes : 100 EUR et 120 USD sont deux montants parallèles, pas un désaccord", path: ["observations"],
  })
  /* P1-1 : deux preuves, pas une preuve citée deux fois. */
  .refine((c: { observations: { source: FareAuditSource }[] }) => new Set(c.observations.map((o) => preuveCanonique(o.source))).size >= 2, {
    message: "un conflit exige DEUX preuves distinctes : même URL, même localisateur, même citation et même date de lecture ne font qu'une seule lecture", path: ["observations"],
  });
/** LE CONFLIT TEL QU'ON L'ÉCRIT — même raison que `FareEcrit` : le type est déclaré, pas inféré. */
export type FareConflictEcrit = {
  id: string;
  placement: PlacementType;
  applies_when?: Predicate;
  scope_label?: string;
  billing_subject: BillingSubject;
  journey_basis: JourneyBasis;
  purchase_window?: PurchaseWindow;
  status: "unresolved";
  effect: "suppress_exact_fare";
  observations: FareObservation[];
  note?: string;
};

/** LE CONFLIT TEL QUE LE RÉSOLVEUR L'ACCEPTE : validé, et seulement par `lireConflit`. */
export type FareConflict = Valide<FareConflictEcrit>;

/**
 * LES DEUX SEULES PORTES D'ENTRÉE du résolveur.
 *
 * Le transtypage est ici, une fois, à l'endroit exact où la validation vient d'avoir lieu : la
 * sortie de `safeParse` porte `applies_when: unknown` (prédicat récursif `z.lazy`) et ne
 * s'assigne donc pas au type déclaré. Une conversion nommée, dans une fonction de trois lignes qui
 * vient de prouver la conformité, est très différente d'un `as` dispersé chez l'appelant.
 *
 * Rendent `null` plutôt que de lever : lire une donnée peut légitimement échouer et l'appelant
 * décide quoi en dire. C'est la RÉSOLUTION qui lève, parce qu'à ce stade l'échec n'est plus une
 * donnée douteuse mais un défaut de programme.
 */
export function lireTarif(entree: unknown): Fare | null {
  const r = Fare.safeParse(entree);
  return r.success ? (r.data as unknown as Fare) : null;
}

export function lireConflit(entree: unknown): FareConflict | null {
  const r = FareConflict.safeParse(entree);
  return r.success ? (r.data as unknown as FareConflict) : null;
}

/** Le motif d'un refus, lisible dans un journal de build. */
const motifs = (e: z.ZodError): string => e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | ");

/** Le reparsage de la résolution : conforme, ou arrêt bruyant. */
function exigerTarif(valeur: Fare, ou: string): Fare {
  const r = Fare.safeParse(valeur);
  if (!r.success) {
    throw new Error(`résolution tarifaire refusée — ${ou} (id ${String((valeur as FareEcrit)?.id ?? "?")}) n'est pas conforme au contrat : ${motifs(r.error)}`);
  }
  return r.data as unknown as Fare;
}

function exigerConflit(valeur: FareConflict, ou: string): FareConflict {
  const r = FareConflict.safeParse(valeur);
  if (!r.success) {
    throw new Error(`résolution tarifaire refusée — ${ou} (id ${String((valeur as FareConflictEcrit)?.id ?? "?")}) n'est pas conforme au contrat : ${motifs(r.error)}`);
  }
  return r.data as unknown as FareConflict;
}

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

/**
 * CE QUE LE FINDER RECEVRA UN JOUR — et qu'aucune interface ne lit encore (annexe 46).
 *
 * *Porte P1, refermée le 10/09 au soir.* Ce type était une UNION à six états, et une union oblige
 * à choisir. Le résolveur choisissait donc, dans un ordre écrit par moi : un montant applicable
 * et un `booking_only` applicable en même temps rendaient `applicable [le montant]`, et le
 * mécanisme disparaissait sans un mot. Même défaut sur les conflits, où un `find()` ne gardait que
 * le premier. C'est la troisième fois dans ce seul fichier qu'une PRIORITÉ INTERNE fait
 * disparaître une ligne prouvée — après `chiffres[0]` et après les variantes monétaires.
 *
 * La leçon est prise à la racine : ce n'est plus une union, c'est un INVENTAIRE. Chaque catégorie
 * a sa liste, aucune ne masque l'autre, et l'affichage décidera de ce qu'il montre — mais il le
 * décidera en voyant tout. Une réponse vide se lit à ses six listes vides (`resolutionVide`).
 */
export type ResolutionTarifaire = {
  /** TOUS les conflits ouverts dont la portée et la fenêtre couvrent le trajet — jamais le premier seul. */
  conflits: FareConflict[];
  /** Les montants applicables et concordants. VIDE dès qu'un conflit couvre le trajet. */
  montants: Fare[];
  /** Les montants applicables qui se contredisent entre eux : même devise, montants ou axes différents. */
  chevauchements: Fare[];
  /** Les mécanismes applicables (devis, formule, calculateur, prix à la réservation). */
  mecanismes: Fare[];
  /** Les tarifs dont la portée ou la fenêtre n'est pas décidable avec les faits injectés. */
  indecidables: Fare[];
  /** Les montants QUE LE CONFLIT A ÉTEINTS — nommés, pour que rien ne disparaisse en silence. */
  supprimes: Fare[];
};

/** Une résolution qui ne dit rien : les six listes sont vides. */
export const resolutionVide = (r: ResolutionTarifaire): boolean =>
  r.conflits.length === 0 && r.montants.length === 0 && r.chevauchements.length === 0
  && r.mecanismes.length === 0 && r.indecidables.length === 0 && r.supprimes.length === 0;

const memeDevise = (a: Fare, b: Fare) =>
  a.price.amounts.some((x) => b.price.amounts.some((y) => y.currency === x.currency));

/**
 * DEUX TARIFS PARLENT-ILS DE LA MÊME CHOSE ? (10/09, soir — corollaire de la porte P0-2)
 *
 * Le témoin du supplément par kilogramme a révélé, à côté de l'extinction trop large, un défaut de
 * la même famille dans la détection de CHEVAUCHEMENT : « 100 EUR par contenant » et « 5 EUR par
 * kilogramme » partagent une devise et affichent des montants différents, donc mon détecteur les
 * déclarait contradictoires. Ils ne le sont pas : ce sont deux composantes qui S'ADDITIONNENT, et
 * les déclarer en chevauchement retirait les deux de l'affichage.
 *
 * Le discriminant est le SUJET FACTURÉ. Deux prix du même sujet ne peuvent pas être tous les deux
 * vrais — « par contenant et par segment » contre « par contenant et par trajet » ne coûtent pas
 * la même chose sur un trajet à deux vols, et c'est bien un chevauchement. Deux prix de sujets
 * DIFFÉRENTS ne se contredisent sur rien : ils se cumulent, ou ils s'appliquent à des cas que la
 * page distingue. C'est le raisonnement exact que Codex oppose sur les conflits — « une différence
 * d'unité décrit deux tarifs distincts » — étendu ici au détecteur de chevauchement, qui souffrait
 * du même excès.
 */
const memeSujetFacture = (a: Fare, b: Fare) => a.billing_subject === b.billing_subject;

const memeMontant = (a: Fare, b: Fare) =>
  JSON.stringify(a.price.amounts.map((m: MoneyType) => [m.currency, m.amount]).sort())
    === JSON.stringify(b.price.amounts.map((m: MoneyType) => [m.currency, m.amount]).sort())
  && a.billing_subject === b.billing_subject && a.journey_basis === b.journey_basis;

/** Un conflit couvre le trajet dès que sa portée ET sa fenêtre d'achat ne sont pas FAUSSES.
 *  L'indécidable compte comme une couverture : ne pas savoir si un désaccord s'applique n'est pas
 *  une raison de publier le montant qu'il conteste. */
const conflitCouvre = (c: FareConflict, faits: FaitsTrajet): boolean =>
  et(evaluerPortee(c.applies_when, faits), evaluerFenetre(c.purchase_window, faits)) !== "faux";

/**
 * L'INVENTAIRE TARIFAIRE D'UN TRAJET — tout ce qui est prouvé, rangé, rien de jeté.
 *
 * L'ordre des questions reste l'ordre de prudence ; ce qui change, c'est qu'aucune réponse n'en
 * exclut une autre :
 *   1. les CONFLITS ouverts qui couvrent le trajet sont TOUS retenus ;
 *   2. les tarifs dont la portée ET la fenêtre d'achat sont VRAIES sont candidats ;
 *   3. deux candidats chiffrés qui parlent du MÊME SUJET FACTURÉ et divergent dans une devise
 *      commune vont aux CHEVAUCHEMENTS — 725 € par segment et 725 € par trajet ne coûtent pas la
 *      même chose, et publier l'un des deux serait tirer à pile ou face. Deux sujets différents,
 *      eux, ne se contredisent pas : un supplément par kilogramme s'ajoute à un prix par
 *      contenant, il ne le conteste pas (`memeSujetFacture`) ;
 *   4. les autres candidats chiffrés sont des MONTANTS, les candidats non chiffrés des MÉCANISMES ;
 *   5. un conflit qui couvre le trajet éteint les montants PORTANT SES AXES, et eux seuls ; ils
 *      passent aux SUPPRIMÉS, où ils restent nommés. L'invariant tient toujours — « un conflit
 *      couvrant le trajet = aucun montant exact SUR CE QU'IL CONTESTE » — et un supplément par
 *      kilogramme survit à un désaccord sur un prix par contenant, parce qu'aucune page ne se
 *      contredit à son sujet ;
 *   6. les MÉCANISMES survivent au conflit : l'effet publié est `suppress_exact_fare`, et deux
 *      pages qui se contredisent sur un montant ne cessent pas de prouver qu'un devis existe ;
 *   7. les tarifs à portée ou fenêtre INDÉCIDABLE sont dits comme tels — la grille peut se
 *      montrer, le prix du trajet non.
 *
 * *Déviation REFUSÉE par Codex, et il a raison — porte P0-2, troisième tour (10/09, soir).* Je
 * faisais éteindre par un conflit TOUS les montants du canal qu'il couvre, y compris ceux dont les
 * axes n'ont rien à voir avec le sien, et je l'avais présenté comme de la prudence. Le sabotage le
 * montre : un désaccord sur « 100 contre 120 EUR, par contenant et par segment » effaçait aussi un
 * supplément « 5 EUR par kilogramme » parfaitement établi, sur lequel aucune page ne se contredit.
 * Ce n'est pas prudent, c'est destructeur — cela supprime une information officielle SANS RAPPORT
 * avec le désaccord, et c'est exactement le reproche que Philippe adresse aujourd'hui au site, qui
 * masque trop de choses exactes. « Ne rien dire » n'est pas la position sûre par défaut : c'est
 * une position, qui coûte, et qui doit se justifier ligne par ligne comme les autres.
 *
 * Un conflit n'éteint donc QUE les tarifs qui lui correspondent : même canal, portée et fenêtre
 * couvertes, MÊME `billing_subject`, MÊME `journey_basis`. C'est précisément à cela que servent
 * les axes que la porte P0-2 du second tour a rendus obligatoires.
 */
export function resoudreTarif(
  tarifs: readonly Fare[],
  conflits: readonly FareConflict[],
  placement: PlacementType,
  faits: FaitsTrajet,
): ResolutionTarifaire {
  /* LE REPARSAGE DE LA FRONTIÈRE (annexe 48). La marque de type rend l'erreur rouge dans
     l'éditeur ; elle s'efface avec un `as`. Ceci ne s'efface pas. Un tarif non conforme arrête le
     build en nommant son identifiant et son motif — il n'est jamais écarté en silence. */
  const tarifsValides = tarifs.map((f, i) => exigerTarif(f, `tarifs[${i}]`));
  const conflitsValides = conflits.map((c, i) => exigerConflit(c, `conflits[${i}]`));

  const conflitsCouvrants = conflitsValides.filter(
    (c) => c.placement === placement && c.status === "unresolved" && conflitCouvre(c, faits),
  );

  const duCanal = tarifsValides.filter((f) => f.placement === placement);
  const vrais = duCanal.filter((f) => porteeTarif(f, faits) === "vrai");
  const chiffres = vrais.filter((f) => NATURES_CHIFFREES.has(f.price.kind));
  const mecanismes = vrais.filter((f) => !NATURES_CHIFFREES.has(f.price.kind));
  const chevauchements = chiffres.filter((a, i) => chiffres.some(
    (b, j) => i !== j && memeSujetFacture(a, b) && memeDevise(a, b) && !memeMontant(a, b),
  ));
  const concordants = chiffres.filter((f) => !chevauchements.includes(f));
  const indecidables = duCanal.filter((f) => porteeTarif(f, faits) === "indecidable");

  /* L'extinction est CIBLÉE : un conflit ne parle que de ses propres axes (P0-2, troisième tour). */
  const eteintPar = (f: Fare) => conflitsCouvrants.some(
    (c) => c.billing_subject === f.billing_subject && c.journey_basis === f.journey_basis,
  );
  return {
    conflits: conflitsCouvrants,
    montants: concordants.filter((f) => !eteintPar(f)),
    chevauchements: chevauchements.filter((f) => !eteintPar(f)),
    mecanismes,
    indecidables,
    supprimes: [...concordants, ...chevauchements].filter(eteintPar),
  };
}
