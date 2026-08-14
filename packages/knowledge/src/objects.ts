import { z } from "zod";
import { id, LocalizedText, DogSize, Source, PlacementStatus } from "./common";

export const Country = z.object({
  id: id("country"),
  iso2: z.string().length(2),
  name: LocalizedText,
  region: z.string(),
  pet_scheme: z.string().optional(),
  source: Source.optional(),
});
export type Country = z.infer<typeof Country>;

/** Pet / service-animal relief areas at an airport (ADR-0006: no claim without provenance).
    `available: "unknown"` is the honest default — we assert nothing we haven't verified. */
export const PetRelief = z.object({
  available: z.enum(["yes", "no", "unknown"]),
  post_security: z.boolean().optional(),          // at least one relief area inside the sterile (post-security) area
  locations: z.array(LocalizedText).default([]),  // short, sourced descriptions e.g. "Terminal 3 Rotunda — post-security"
  note: LocalizedText.optional(),
  basis: z.enum(["regulation", "airport_official", "verified", "unverified"]).optional(),
  /** Zone réservée aux chiens d'assistance : le chien de compagnie n'y a pas accès.
   *  Distinction décisive hors États-Unis (Sydney, Tel-Aviv…), où la zone existe mais
   *  n'est pas ouverte au voyageur ordinaire — voire où le chien est interdit en terminal. */
  assistance_only: z.boolean().optional(),
  source: Source.optional(),
});
export type PetRelief = z.infer<typeof PetRelief>;

/** Airport-level, pet-relevant practical info. Every populated block carries a Source (ADR-0006). All optional — a bare airport still validates, and unfilled blocks simply don't render (nothing fabricated). */
export const AirportInfo = z.object({
  address: z.string().optional(),
  website: z.string().url().optional(),
  terminals: z.string().optional(),                       // e.g. "1 · 2A–2G · 3"
  access: LocalizedText.optional(),                       // how to reach the airport
  /** Leash / carrier / muzzle rules that apply inside the terminals. */
  terminal_rules: z.object({ items: z.array(LocalizedText).min(1), source: Source }).optional(),
  /** Veterinary border-inspection post for animals arriving from outside the customs union. */
  border_post: z.object({
    note: LocalizedText,
    applies_when: LocalizedText.optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    hours: z.string().optional(),
    source: Source,
  }).optional(),
  /** Service / assistance-dog handling at this airport. */
  assistance: z.object({ note: LocalizedText, source: Source.optional() }).optional(),
  contacts: z.array(z.object({ label: LocalizedText, value: z.string(), source: Source.optional() })).optional(),
});
export type AirportInfo = z.infer<typeof AirportInfo>;

export const Airport = z.object({
  id: id("airport"),
  iata: z.string().length(3),
  name: LocalizedText,
  city: z.string(),
  city_i18n: LocalizedText.optional(), // localized city display name (e.g. Beirut → Beyrouth); falls back to `city`
  /* Regroupement "ville (tous les aéroports)" du Finder (ajouté 10/08/2026) — distinct de `city`.
   * `city`/`city_i18n` sont aussi le fait "Ville" affiché sur la propre fiche de l'aéroport : ils
   * doivent rester administrativement exacts (Newark reste "Newark", pas "New York"). Ce champ
   * optionnel ne sert QUE de clé de regroupement pour FlightFinder/DestinationFinder — quand un
   * aéroport dessert la même agglomération qu'un autre sous un nom administratif différent (EWR
   * pour la zone de New York), il porte ici le libellé de recherche à utiliser à sa place. Absent
   * pour tout le reste : `cityName()`/le regroupement retombent alors sur `city`/`city_i18n` comme
   * avant. Ne pas l'utiliser pour des villes simplement proches mais distinctes (ex. Bruxelles/
   * Charleroi, Baltimore/Washington) — c'est un choix produit à part, pas ce mécanisme.
   */
  search_city_i18n: LocalizedText.optional(),
  country_id: id("country"),
  geo: z.object({ lat: z.number(), lon: z.number() }).optional(),
  pet_relief: PetRelief.optional(),
  info: AirportInfo.optional(),
});
export type Airport = z.infer<typeof Airport>;

/* ---- Premium airline dossier (Sprint B) ----
   Every block is optional so lean records still validate, but any block that IS present
   must carry its own Source: "strictly sourced everywhere" (no claim without provenance). */

/** A neutral image reference. `src` is a placeholder path until real, rights-cleared assets land (Sprint C). */
export const MediaRef = z.object({
  src: z.string(),                 // e.g. "/brand/airlines/air-france/logo.svg" (placeholder for now)
  placeholder: z.boolean().default(true),
  alt: LocalizedText.optional(),
  credit: z.string().optional(),
  source_url: z.string().url().optional(),
});
export type MediaRef = z.infer<typeof MediaRef>;

/* ---- T0-A : schéma d'AUTEUR strict → projection nommée → schéma RUNTIME strict --------------
 *
 * Troisième membre de la famille « champ effacé par Zod en mode strip » : `brachy_allowed`
 * (25 occurrences, 30/07), `season.month` (12/08), puis `conditional` (74) et
 * `derived_from_fiche` (269) découverts les 13–14/08. La fermeture n'est pas une interdiction
 * de clé, c'est un changement de régime : tout objet décisionnel est `.strict()`, la donnée
 * d'auteur a SON schéma, et ce qu'une projection abandonne est ÉNUMÉRÉ dans une fonction
 * nommée — plus jamais un effet silencieux du strip. */

/** Bloc commun aux deux branches d'auteur ET au runtime : les champs enrichis existants
 *  (302 politiques de canal en portent — source, tarif, dimensions, conditions, poids,
 *  restriction brachycéphale). Ils traversent la projection SANS PERTE. */
const PlacementPolicyCommon = {
  max_weight_kg: z.number().positive().optional(),   // incl. carrier where the airline states so
  carrier_dims_cm: z.object({ l: z.number(), w: z.number(), h: z.number() }).optional(),
  fee: z.string().optional(),                        // as published, e.g. "€125 (intra-Europe)"
  conditions: LocalizedText.optional(),
  /** La compagnie accepte-t-elle les races brachycéphales sur ce canal ? `false` = refus explicite.
   *  Absent = la compagnie ne dit rien, ce qui n'est pas un refus.
   *
   *  Ce champ manquait au schéma alors que les données le renseignaient 25 fois (30/07/2026).
   *  Zod, en mode « strip » par défaut, l'effaçait à l'ingestion : `breedTravel.ts` teste bien
   *  `h.brachy_allowed === false` mais la valeur n'arrivait jamais jusqu'à lui. Résultat : les
   *  25 compagnies qui refusent explicitement un carlin ou un bouledogue en soute étaient
   *  affichées « ✅ Accepté en soute » sur les fiches des races concernées. */
  brachy_allowed: z.boolean().optional(),
  source: Source,
} as const;

/** Forme HISTORIQUE des 302 politiques actuelles. `conditional` (74 occurrences) et
 *  `derived_from_fiche` (269) sont enfin DÉCLARÉS — le premier meurt en T0-B (manifeste de
 *  migration par couple), le second est une métadonnée d'ingestion. */
export const LegacyPlacementPolicyAuthored = z.object({
  ...PlacementPolicyCommon,
  allowed: z.boolean(),
  /** Classe visuelle `warn` héritée des fiches — PAS un statut métier (contre-revue du 13/08 :
   *  45 « via cargo/agent », 13 conditions déterministes, 8 on-request, 6 non publiés,
   *  2 inapplicables aux chiens). Projection T0-A volontairement neutre : IGNORÉ (→ allowed),
   *  jusqu'à la table de décision explicite de T0-B. */
  conditional: z.boolean().optional(),
  derived_from_fiche: z.boolean().optional(),
}).strict();

/** Forme CANONIQUE cible : la fiche écrit une sémantique, plus une couleur de pastille. */
export const CanonicalPlacementPolicyAuthored = z.object({
  ...PlacementPolicyCommon,
  availability: z.enum(["offered", "not_offered", "case_by_case", "undocumented"]),
  derived_from_fiche: z.boolean().optional(),
}).strict();

/** L'union stricte interdit qu'un objet porte à la fois `allowed` et `availability`. */
export const PlacementPolicyAuthored = z.union([LegacyPlacementPolicyAuthored, CanonicalPlacementPolicyAuthored]);
export type PlacementPolicyAuthored = z.infer<typeof PlacementPolicyAuthored>;

/** Runtime : UNION DISCRIMINÉE, comme le contrat moteur (contre-revue T0-A v1, P0-1 — un objet
 *  plat `.strict()` acceptait cinq combinaisons contradictoires : `allowed:false` sur statut
 *  allowed, cause sur un refus, confirmation sans cause…). `allowed` est IMPOSÉ par la branche
 *  (booléen de transition consommé par l'UI existante) ; `status_cause` n'existe QUE sur la
 *  branche confirmation, et y est OBLIGATOIRE — le moteur lit une cause garantie par le type,
 *  il n'en fabrique jamais. */
export const PlacementPolicy = z.discriminatedUnion("status", [
  z.object({ ...PlacementPolicyCommon, status: z.literal("allowed"), allowed: z.literal(true), derived_from_fiche: z.boolean().optional() }).strict(),
  z.object({ ...PlacementPolicyCommon, status: z.literal("denied"), allowed: z.literal(false), derived_from_fiche: z.boolean().optional() }).strict(),
  z.object({
    ...PlacementPolicyCommon,
    status: z.literal("confirmation_required"),
    allowed: z.literal(false),
    status_cause: z.enum(["airline_approval", "policy_unpublished"]),
    derived_from_fiche: z.boolean().optional(),
  }).strict(),
]);
export type PlacementPolicy = z.infer<typeof PlacementPolicy>;

/** LA projection auteur → runtime. Ce qu'elle abandonne est écrit ici, nulle part ailleurs :
 *  - legacy `conditional` : ABANDONNÉ VOLONTAIREMENT en T0-A (neutralité — aucun des 74 canaux
 *    ne change de verdict avant le manifeste T0-B) ;
 *  - rien d'autre : tous les champs communs traversent, `derived_from_fiche` compris. */
export function projectPlacementPolicy(authored: PlacementPolicyAuthored): PlacementPolicy {
  const { max_weight_kg, carrier_dims_cm, fee, conditions, brachy_allowed, source, derived_from_fiche } = authored;
  const common = { max_weight_kg, carrier_dims_cm, fee, conditions, brachy_allowed, source, derived_from_fiche };
  if ("allowed" in authored) {
    // `conditional` sciemment ignoré (T0-A — neutralité jusqu'au manifeste T0-B)
    return PlacementPolicy.parse(authored.allowed
      ? { ...common, status: "allowed", allowed: true }
      : { ...common, status: "denied", allowed: false });
  }
  if (authored.availability === "offered") return PlacementPolicy.parse({ ...common, status: "allowed", allowed: true });
  if (authored.availability === "not_offered") return PlacementPolicy.parse({ ...common, status: "denied", allowed: false });
  return PlacementPolicy.parse({
    ...common, status: "confirmation_required", allowed: false,
    status_cause: authored.availability === "case_by_case" ? "airline_approval" : "policy_unpublished",
  });
}

export const TimelineEntry = z.object({
  year: z.number().int(),
  event: LocalizedText,
  source: Source,
});

export const FaqEntry = z.object({
  q: LocalizedText,
  a: LocalizedText,
  source: Source,
});

export const SourcedNote = z.object({
  text: LocalizedText,
  source: Source,
});

export const AirlinePremium = z.object({
  logo: MediaRef.optional(),
  hero_photo: MediaRef.optional(),
  summary: LocalizedText.optional(),
  summary_source: Source.optional(),
  /* La projection est BRANCHÉE ici : `Airline.parse()` (appelé par `normalize()`) valide la
     forme d'auteur strictement, PUIS projette vers le runtime — un schéma d'auteur défini mais
     non branché ne protégerait rien. */
  /* `.strict()` sur le CONTENEUR aussi (contre-revue v2 : `holdd`, `carog` étaient acceptés
     puis supprimés en silence — le canal mal orthographié disparaissait avec ses données). */
  policy: z.object({
    cabin: PlacementPolicyAuthored.transform(projectPlacementPolicy).optional(),
    hold: PlacementPolicyAuthored.transform(projectPlacementPolicy).optional(),
    cargo: PlacementPolicyAuthored.transform(projectPlacementPolicy).optional(),
  }).strict().optional(),
  booking: SourcedNote.optional(),          // how to book, lead time, channels
  history: z.array(TimelineEntry).default([]),
  faq: z.array(FaqEntry).default([]),
  examples: z.array(SourcedNote).default([]),
  tips: z.array(SourcedNote).default([]),
  precedents: z.array(SourcedNote).default([]),   // "jurisprudence" — only when a real, citable case exists
  last_reviewed: z.string().optional(),           // ISO date
}).strict();
export type AirlinePremium = z.infer<typeof AirlinePremium>;

export const Airline = z.object({
  id: id("airline"),
  iata: z.string().length(2),
  name: z.string(),
  country_id: id("country"),
  alliance: z.enum(["star_alliance", "oneworld", "skyteam", "none"]).default("none"),
  website: z.string().url().optional(),
  serves_country_ids: z.array(id("country")).default([]),
  hub_airport_ids: z.array(id("airport")).default([]),  // hubs among known airports → drives "direct flight likely"
  /** Airports (among ours) this airline actually reaches, from the OpenFlights route graph. Drives route-aware candidacy. */
  served_airport_ids: z.array(id("airport")).default([]),
  /** Nonstop routes among our airports, as sorted "airport_a|airport_b" keys → drives the accurate "direct" flag. */
  direct_routes: z.array(z.string()).default([]),
  /** Routes flown only part of the year (summer/winter sampling). Kept apart from direct_routes so a
   *  February search never advertises a July-only nonstop; available for date-aware use later. */
  seasonal_routes: z.array(z.string()).default([]),
  /* `.strict()` (contre-revue v3) : `hodl` ou `carog` étaient acceptés puis supprimés — le tarif
     disparaissait en silence. */
  fees: z.object({ cabin: z.string().optional(), hold: z.string().optional(), cargo: z.string().optional() }).strict().optional(), // published fees, as-is
  /** Customer-service phone numbers, local first then international. Sourced (ADR-0006); optional — renders only when present. */
  contact: z.object({
    phones: z.array(z.object({ region: LocalizedText, number: z.string() })).min(1),
    source: Source,
  }).optional(),
  /** MyDogCanFly Decision Engine score, computed at ingest time (score /5, points /100). */
  rating: z.object({ score: z.number(), points: z.number() }).optional(),
  source: Source.optional(),
  premium: AirlinePremium.optional(),
  /* `.strict()` (contre-revue T0-A v2) : `premiun`, `polciy` ou tout conteneur mal orthographié
     est REFUSÉ — plus jamais accepté puis supprimé en silence avec ses données. */
}).strict();
export type Airline = z.infer<typeof Airline>;

/** Sourced behavioural / travel-relevant traits. Values are DogTime.com's published 1–5 ratings, stored
    verbatim (auditable); the engine converts them to a travel-favourable direction. */
export const BreedTravel = z.object({
  adaptability: z.number().int().min(1).max(5),     // DogTime "Adaptability" (5 = highly adaptable)
  sensitivity: z.number().int().min(1).max(5),      // DogTime "Sensitivity Level" (5 = very sensitive → less travel-favourable)
  tolerates_alone: z.number().int().min(1).max(5),  // DogTime "Tolerates Being Alone" (5 = copes well alone)
  cold_tolerance: z.number().int().min(1).max(5),   // DogTime "Tolerates Cold Weather"
  heat_tolerance: z.number().int().min(1).max(5),   // DogTime "Tolerates Hot Weather"
  energy: z.number().int().min(1).max(5),           // DogTime "Energy Level" (5 = very high → more exercise need)
  source: Source,
});
export type BreedTravel = z.infer<typeof BreedTravel>;

export const Breed = z.object({
  id: id("breed"),
  name: z.string(),
  name_i18n: z.record(z.string(), z.string()).optional(), // localized display name, e.g. { fr: "Berger allemand" }
  size: DogSize,
  weight_kg: z.number().positive(),
  brachycephalic: z.boolean(),
  coat: z.enum(["short", "double", "thick", "long", "curly", "wiry"]).optional(),
  travel: BreedTravel.optional(),
});
export type Breed = z.infer<typeof Breed>;

export const Dog = z.object({
  id: id("dog"),
  breed_id: id("breed"),
  weight_kg: z.number().positive(),
  age_months: z.number().int().nonnegative().optional(),
  microchip: z.boolean().optional(),
});
export type Dog = z.infer<typeof Dog>;

export const Route = z.object({
  id: id("route"),
  origin_airport_id: id("airport"),
  dest_airport_id: id("airport"),
  transit_airport_ids: z.array(id("airport")).default([]),
});
export type Route = z.infer<typeof Route>;

/** Affiliate lifecycle. Only `active` partners may emit a monetizable (sponsored) outbound link. */
export const PartnerStatus = z.enum(["placeholder", "applied", "active", "rejected"]);
export type PartnerStatus = z.infer<typeof PartnerStatus>;

export const Partner = z.object({
  id: id("partner"),
  vertical: z.enum([
    "airline", "insurance", "hotel", "equipment",
    "airport_parking", "airport_transfer", "veterinary", "car_rental",
  ]),
  name: z.string(),
  status: PartnerStatus.default("placeholder"),
  affiliate_network: z.string().optional(),   // e.g. "Awin", "CJ", "Impact"
  tracking_url: z.string().url().optional(),   // affiliate deep link — used ONLY when status = active
  direct_url: z.string().url().optional(),     // neutral brand link (non-monetizable)
  countries: z.array(z.string()).default([]),  // ISO2; empty = global
  notes: z.string().optional(),
});
export type Partner = z.infer<typeof Partner>;

export const Equipment = z.object({
  id: id("equipment"),
  type: z.enum(["soft_carrier", "hard_crate", "accessory"]),
  name: z.string(),
  iata_compliant: z.boolean(),
  dims_cm: z.object({ l: z.number(), w: z.number(), h: z.number() }).optional(),
  max_weight_kg: z.number().positive().optional(),
  partner_id: id("partner").optional(),
  source: Source.optional(),
});
export type Equipment = z.infer<typeof Equipment>;
