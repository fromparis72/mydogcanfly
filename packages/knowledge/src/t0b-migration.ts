import { z } from "zod";
import { LocalizedText, Placement, id, reviewDueFrom, Source, FACTUAL_SOURCE_TYPES, isForbiddenSource } from "./common";
/* Le modèle de provenance citée existe déjà et il est le bon : `Source` étendu d'une citation
   verbatim, d'une langue BCP-47 et d'un locator, avec interdiction de l'auto-citation, URL
   http(s) obligatoire et types de source factuels seulement. On le RÉUTILISE — deux modèles de
   provenance dans le même dépôt, c'est la garantie qu'ils divergeront (le commentaire qui
   accompagne sa définition dit exactement pourquoi). T0-B n'ajoute que ses spécialisations. */
import { SourcedQuote } from "./breed-restrictions";

/* ---- T0-B : le MANIFESTE de migration des 74 politiques héritées ----------------------------
 *
 * Les 74 couples (compagnie, canal) portant `conditional: true` sont la dernière donnée du
 * référentiel dont la sémantique n'a jamais été établie : une classe visuelle (`cls: "warn"`)
 * héritée des fiches, lue par personne comme un statut métier. Le manifeste est la table de
 * décision qui les fera passer, un par un, à la forme canonique — et il est un CONTRAT, pas une
 * note de travail :
 *
 *   - chaque ligne fige le bloc YAML OBSERVÉ et son empreinte SHA-256 : si la fiche bouge avant
 *     la migration, la garde (`test-t0b-matrice.mjs`) le voit et refuse de migrer une donnée qui
 *     n'est plus celle qui a été auditée ;
 *   - chaque ligne dit son ÉTAT : `legacy_unreviewed` (rien n'a encore été vérifié, la cause
 *     runtime est notre propre incertitude) ou `reviewed` (un audit a eu lieu, sur source
 *     officielle, avec citation verbatim) ;
 *   - un état `reviewed` ne peut PAS exister sans source, et la disponibilité qu'il vise
 *     DÉTERMINE la cause runtime — les combinaisons incohérentes sont inconstructibles.
 *
 * Ce schéma est livré (et non cantonné aux tests) parce que T0-B2 l'utilisera à l'ingestion :
 * c'est lui qui autorisera l'écriture d'une politique canonique dans une fiche, jamais un script
 * de migration qui se relit lui-même.
 *
 * Ce que ce schéma NE fait PAS : recalculer les empreintes, vérifier la bijection avec les 74
 * `conditional: true` d'`objects.json`, ni relire les fiches YAML. Cette contre-épreuve
 * cryptographique appartient à `test-t0b-matrice.mjs`, livrable approuvé et figé. Les deux sont
 * complémentaires : la forme ici, la preuve là-bas.
 */

/** Le manifeste approuvé compte EXACTEMENT 74 lignes — une par politique héritée recensée.
 *  Changer ce nombre, c'est changer le contrat : cela passe par une revue, pas par un commit. */
export const T0B_MIGRATION_ROW_COUNT = 74;

/** Algorithme d'empreinte du manifeste — `sha256(JSON canonique du bloc observé)`. */
export const T0B_FINGERPRINT_ALGORITHM = "sha256-canonical-json-v1";

/** Les champs du bloc YAML couverts par l'empreinte, dans CET ordre (l'ordre fait partie de
 *  l'algorithme : il est sérialisé tel quel dans le manifeste et comparé strictement). */
export const T0B_FINGERPRINT_FIELDS = ["name", "statusLabel", "detail", "fee", "value", "cls"] as const;

/**
 * Registre FERMÉ des indices d'audit (14). Ce sont des indices d'extraction lexicale, NON
 * EXHAUSTIFS et NON DÉCISIONNELS : ils orientent l'auditeur vers ce qu'il faut aller lire, ils
 * ne décident jamais du verdict — seul un audit sur source officielle le fait. Le registre est
 * fermé pour qu'un indice inventé au fil de l'eau (typo comprise) soit refusé au lieu d'être
 * accepté puis ignoré en silence.
 */
export const T0B_AUDIT_HINTS = [
  "accompaniment_condition",  // « doit voyager avec son maître », « animal non accompagné »
  "aircraft_condition",       // dépend du type d'appareil
  "breed_condition",          // races brachycéphales, races interdites
  "facility_condition",       // dépend des installations de l'escale
  "mandatory_in_cases",       // canal imposé dans certains cas
  "on_request_or_contact",    // « sur demande », « contacter la compagnie »
  "operator_condition",       // dépend du transporteur effectif (partage de code, filiale)
  "procedure",                // décrit une procédure de réservation, pas une condition
  "route_condition",          // dépend de la route ou de la destination
  "size_condition",           // dimensions de la caisse
  "sole_channel_claim",       // « uniquement en fret », « seul canal possible »
  "species_exclusion",        // exclusion d'espèce (chats, NAC…) — inapplicable au chien
  "terms_unpublished",        // conditions non publiées
  "weight_condition",         // poids de l'animal ou poids total
] as const;

export const T0bAuditHint = z.enum(T0B_AUDIT_HINTS);
export type T0bAuditHint = z.infer<typeof T0bAuditHint>;

/** Le bloc YAML observé, tel qu'il est stocké dans le manifeste. Fermé aux six champs de
 *  l'empreinte : un septième champ dans le bloc stocké voudrait dire que l'observation et
 *  l'algorithme d'empreinte ne parlent plus de la même chose. */
export const T0bObservedBlock = z.object({
  name: LocalizedText.optional(),
  statusLabel: LocalizedText.optional(),
  detail: LocalizedText.optional(),
  fee: LocalizedText.optional(),
  value: z.union([z.string(), z.number()]).optional(),
  cls: z.string().min(1).optional(),
}).strict().refine((b) => Object.keys(b).length > 0, {
  message: "bloc observé vide : une observation sans aucun champ n'observe rien",
});

export const T0bYamlObservation = z.object({
  /** Fiche compagnie d'où vient le bloc, relative à la racine du dépôt. */
  file: z.string().regex(/^content\/airlines\/[a-z0-9_-]+\.yml$/, "chemin de fiche attendu : content/airlines/<slug>.yml"),
  /** Position du canal dans la fiche — un INDEX, pas un nom : c'est ce qui a été lu. */
  locator: z.string().regex(/^channels\[\d+\]$/, "locator attendu : channels[<index>]"),
  block: T0bObservedBlock,
  fingerprint_algorithm: z.literal(T0B_FINGERPRINT_ALGORITHM),
  fingerprint_fields: z.tuple([
    z.literal("name"), z.literal("statusLabel"), z.literal("detail"),
    z.literal("fee"), z.literal("value"), z.literal("cls"),
  ]),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/, "empreinte attendue : 64 caractères hexadécimaux minuscules"),
}).strict();

/**
 * Provenance d'une décision T0-B = `SourcedQuote` (citation verbatim obligatoire) plus DEUX
 * spécialisations propres à ce lot :
 *
 *  - la CADENCE est celle du domaine `airline`, au jour près. `SourcedQuote` exige seulement que
 *    `review_due` ne précède pas `verified_date` — une revue repoussée de cinq ans passerait,
 *    et une revue repoussée de cinq ans est la même chose que pas de revue. Ici, `review_due` est
 *    DÉRIVÉ (ADR-0007) : 90 jours, ni plus ni moins.
 *  - le LOCATOR devient obligatoire. Il est facultatif dans le modèle général ; pour une décision
 *    de migration, savoir dans QUELLE section de la page se trouve la phrase est ce qui rend la
 *    contre-revue possible sans relire la page entière.
 */
export const T0bAuditSource = SourcedQuote
  .refine(
    (s) => s.review_due === reviewDueFrom(s.verified_date, "airline"),
    (s) => ({
      message: `review_due doit valoir exactement ${reviewDueFrom(s.verified_date, "airline")} (cadence airline : 90 jours après verified_date)`,
      path: ["review_due"],
    }),
  )
  .refine((s) => typeof s.locator === "string" && s.locator.length > 0, {
    message: "locator obligatoire : une décision de migration doit dire OÙ la phrase a été lue",
    path: ["locator"],
  });

/**
 * LA PAGE OFFICIELLE ASSOCIÉE, SANS PHRASE CITÉE — le contrat FAIBLE, écrit à côté du fort pour
 * que la différence soit lisible d'un coup d'œil et non déduite.
 *
 * Elle exige tout ce qui rend un lien sérieux — page officielle ou réglementaire, jamais une de
 * nos pages, http(s), cadence de revue à 90 jours — et n'exige PAS la seule chose qui ferait
 * d'elle une preuve : la phrase. C'est pourquoi une politique qui n'a que celle-ci ne peut pas
 * produire de verdict catégorique (`projectPlacementPolicy`) et n'est pas retournée par
 * `preuveAuditee` (`preuve.ts`), seulement par `sourceAffichable`.
 *
 * Les prédicats ne sont pas retapés : `FACTUAL_SOURCE_TYPES` et `isForbiddenSource` sont ceux de
 * `common.ts`, les mêmes que ceux dont `SourcedQuote` se sert. Une seconde définition de
 * « source officielle » aurait divergé de la première — c'est la faute que ce dépôt collectionne.
 */
export const T0bSourceOfficielleNonCitee = Source
  .extend({ quote: z.undefined().optional(), locator: z.string().min(1).optional() })
  .strict()
  .refine((s) => /^https?:$/.test((() => { try { return new URL(s.url).protocol; } catch { return ""; } })()), {
    message: "seules les URL http(s) sont acceptées", path: ["url"],
  })
  .refine((s) => !isForbiddenSource(s.url), {
    message: "auto-citation : un domaine MyDogCanFly ne peut pas accompagner une décision",
    path: ["url"],
  })
  .refine((s) => (FACTUAL_SOURCE_TYPES as readonly string[]).includes(s.source_type), {
    message: `un lien officiel exige une source ${FACTUAL_SOURCE_TYPES.join(", ")}`, path: ["source_type"],
  })
  .refine((s) => s.review_due === reviewDueFrom(s.verified_date, "airline"), (s) => ({
    message: `review_due doit valoir exactement ${reviewDueFrom(s.verified_date, "airline")} (cadence airline : 90 jours)`,
    path: ["review_due"],
  }));

/**
 * LA provenance qu'une fiche peut porter sur une décision : citée, ou officielle non citée.
 * L'ordre compte — la forme forte est essayée d'abord, pour qu'une source complète ne soit
 * jamais validée par le contrat faible et perde sa citation en silence.
 */
export const T0bSourceDePolitique = z.union([T0bAuditSource, T0bSourceOfficielleNonCitee]);

const justification = z.string().min(1);

/**
 * Ligne NON AUDITÉE. La cause runtime est `legacy_unreviewed` — notre donnée, notre incertitude,
 * jamais une incertitude attribuée à la compagnie. Ni disponibilité visée ni source : une ligne
 * qui n'a pas été auditée ne peut pas en porter, et `.strict()` le rend inconstructible.
 */
export const T0bDecisionLegacyUnreviewed = z.object({
  state: z.literal("legacy_unreviewed"),
  cause_runtime: z.literal("legacy_unreviewed"),
  justification,
}).strict();

/** Fabrique d'une branche AUDITÉE : la disponibilité visée détermine la cause, et la cause seule.
 *  `offered` / `not_offered` sont des statuts fermes — ils n'ont AUCUNE cause de confirmation. */
const reviewedBranch = <A extends string, C extends string>(
  target_availability: A,
  cause_runtime: C | null,
) => z.object({
  state: z.literal("reviewed"),
  target_availability: z.literal(target_availability),
  ...(cause_runtime === null ? {} : { cause_runtime: z.literal(cause_runtime) }),
  justification,
  source: T0bAuditSource,
}).strict();

/**
 * Ligne AUDITÉE. Union discriminée par la disponibilité visée — la table de correspondance
 * n'est pas un commentaire, c'est le type :
 *
 *   offered      → aucune cause      (le canal est proposé, rien à confirmer)
 *   not_offered  → aucune cause      (le canal n'est pas proposé, rien à confirmer)
 *   case_by_case → airline_approval  (la compagnie décide au cas par cas)
 *   undocumented → policy_unpublished (la compagnie ne publie pas ses conditions)
 *
 * Une cause sur `offered`, une absence de cause sur `undocumented`, ou un croisement des deux
 * couples, sont refusés à la validation — pas signalés en revue.
 */
export const T0bDecisionReviewed = z.discriminatedUnion("target_availability", [
  reviewedBranch("offered", null),
  reviewedBranch("not_offered", null),
  reviewedBranch("case_by_case", "airline_approval"),
  reviewedBranch("undocumented", "policy_unpublished"),
]);

/* `z.union` et non `z.discriminatedUnion("state")` : la branche `reviewed` est elle-même une
   union discriminée (par `target_availability`), et un discriminant ne peut pas pointer vers
   quatre options portant la même valeur. La validation reste exacte — chaque branche est
   `.strict()` et porte un discriminant obligatoire distinct. */
export const T0bDecision = z.union([T0bDecisionLegacyUnreviewed, T0bDecisionReviewed]);
export type T0bDecision = z.infer<typeof T0bDecision>;

export const T0bMigrationRow = z.object({
  identity: z.object({
    airline_id: id("airline"),
    placement: Placement,
  }).strict(),
  yaml_observation: T0bYamlObservation,
  decision: T0bDecision,
  /** Indices d'audit : registre fermé, sans doublon (deux fois le même indice n'ajoute rien).
   *  Volontairement sans minimum : une ligne dont l'extraction lexicale ne donne aucun indice
   *  reste une ligne valide — elle sera auditée sur la source, comme toutes les autres. */
  audit_hints: z.array(T0bAuditHint).refine(
    (h) => new Set(h).size === h.length,
    { message: "indices d'audit dupliqués" },
  ),
}).strict().superRefine((row, ctx) => {
  /* Le chemin de fiche doit désigner LA compagnie de la ligne : sans ce lien, une observation
     pourrait figer le bloc d'une autre compagnie tout en portant le bon identifiant. Les fiches
     existent sous deux conventions de nommage (tirets ou traits soulignés) — les deux sont
     acceptées, aucune autre. */
  const base = row.identity.airline_id.replace(/^airline_/, "");
  const attendus = [`content/airlines/${base.replace(/_/g, "-")}.yml`, `content/airlines/${base}.yml`];
  if (!attendus.includes(row.yaml_observation.file)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["yaml_observation", "file"],
      message: `fiche ${row.yaml_observation.file} incohérente avec ${row.identity.airline_id} (attendu : ${attendus.join(" ou ")})`,
    });
  }
});
export type T0bMigrationRow = z.infer<typeof T0bMigrationRow>;

export const T0bMigrationManifest = z.object({
  /** Décrit l'algorithme en toutes lettres ; DOIT commencer par son identifiant canonique. */
  fingerprint_algorithm: z.string().startsWith(T0B_FINGERPRINT_ALGORITHM),
  /** Rappel, dans le fichier lui-même, que les indices ne décident de rien. */
  audit_hints_note: z.string().min(1),
  rows: z.array(T0bMigrationRow).length(T0B_MIGRATION_ROW_COUNT),
}).strict().superRefine((m, ctx) => {
  const vus = new Set<string>();
  m.rows.forEach((r, i) => {
    const cle = `${r.identity.airline_id}|${r.identity.placement}`;
    if (vus.has(cle)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rows", i, "identity"], message: `couple dupliqué : ${cle}` });
    }
    vus.add(cle);
  });
});
export type T0bMigrationManifest = z.infer<typeof T0bMigrationManifest>;
