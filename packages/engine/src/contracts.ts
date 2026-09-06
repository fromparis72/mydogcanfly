import { z } from "zod";
import { Placement, TravelType, Locale, TravelDate, PlacementStatus, TemperatureProvenance, estAutoCitation, SourcedQuote, PLACEMENT_STATUS_CAUSES } from "@mydogcanfly/knowledge";
import type { LocalizedText } from "@mydogcanfly/knowledge";
export type { PlacementStatus, TemperatureProvenance };

/* ---- T0-A : le statut porte sa cause (contre-revues des 13–14/08/2026) ----------------------
 *
 * Jusqu'à ce lot, `confirmation_required` n'avait qu'une seule source possible (l'embargo
 * climatique sur température estimée) et cinq points du code déduisaient la CHALEUR du seul
 * STATUT. T0-B introduira des confirmations de politique : chaque confirmation doit donc porter
 * sa cause, structurée et traçable jusqu'au fait source — pas une étiquette d'interface.
 *
 * Le contrat est une UNION DISCRIMINÉE par statut (pas une table optionnelle parallèle) : un
 * `confirmation_required` sans cause, un `allowed` porteur d'une cause, ou un booléen `allowed`
 * en désaccord avec son statut sont INCONSTRUCTIBLES — refusés par Zod à la construction même
 * (`makePlacementDecision` retourne le résultat de `.parse()`), pas seulement à la sérialisation. */

/** Référence d'une politique de canal : `airline_xxx#cabin|hold|cargo` — jamais un id de règle
 *  (une règle se référence par `rule_id`). */
const POLICY_REF_RE = /^airline_[a-z0-9_]+#(cabin|hold|cargo)$/;

/** Les trois statuts, en littéraux — pour indexer une table sans la désynchroniser du contrat. */
type PlacementStatusLitteral = "allowed" | "denied" | "confirmation_required";

export const ConfirmationCause = z.discriminatedUnion("code", [
  /** Embargo `summer_embargo` déclenché sur une température ESTIMÉE — la seule cause active en T0-A. */
  z.object({ code: z.literal("estimated_climate"), rule_id: z.string().min(1) }).strict(),
  /** Embargo `summer_embargo` déclenché sur une température CERTAINE, par une règle NON CITÉE.
   *  La température ne fait pas de doute ; c'est la règle qui n'est pas prouvée. Elle ne peut donc
   *  plus refuser (frontière de confiance du 05/09/2026, étendue au chemin climatique le même
   *  jour) : elle demande confirmation, en nommant sa règle. Sa cause est DISTINCTE
   *  d'`estimated_climate` parce que le doute n'est pas le même — confondre les deux aurait remis
   *  deux définitions derrière un seul nom, la faute que cette base répète. */
  z.object({ code: z.literal("climate_rule_unquoted"), rule_id: z.string().min(1) }).strict(),
  /* LES CAUSES DE POLITIQUE NE SONT PLUS RETAPÉES ICI — elles sont ENGENDRÉES depuis
     `PLACEMENT_STATUS_CAUSES`, le registre du contrat de connaissance, parce que les trois
     littéraux qui figuraient à cet endroit ont divergé au premier ajout : la quatrième cause
     (`official_source_unquoted`) était émise par la projection, transmise telle quelle par
     `evaluate.ts`, et REFUSÉE ici — le Finder répondait HTTP 400 sur toute route touchant une
     compagnie concernée. Les quatre partagent exactement la même forme `{code, policy_ref}` ;
     une cause ajoutée là-bas est désormais acceptée ici sans que personne ait à y penser.

       `airline_approval`         acceptation au cas par cas ;
       `policy_unpublished`       la compagnie ne publie pas ses conditions ;
       `legacy_unreviewed`        NOTRE donnée n'a pas été revérifiée ;
       `official_source_unquoted` page officielle rattachée, aucune phrase citée. */
  ...PLACEMENT_STATUS_CAUSES.map((code) =>
    z.object({ code: z.literal(code), policy_ref: z.string().regex(POLICY_REF_RE) }).strict()),
  /**
   * NOTRE politique BRACHYCÉPHALE n'a pas été revérifiée (T0-B3-a). Distincte de
   * `legacy_unreviewed`, qui parle de notre donnée de CANAL : celle-ci parle de ce que la
   * compagnie fait des chiens au museau écrasé, et les confondre reproduirait exactement la perte
   * d'interprétation que T0-B a réparée. Aucune preuve ne l'accompagne — une absence de fait n'en
   * a pas ; lui attacher la provenance du canal présenterait cette page comme la preuve d'une
   * politique de race qu'elle ne documente pas.
   */
  z.object({ code: z.literal("breed_policy_unreviewed"), policy_ref: z.string().regex(POLICY_REF_RE) }).strict(),
  /**
   * Une EXIGENCE officielle auditée porte sur cette race (`BreedRestriction` `require`) : la
   * compagnie accepte, à condition que quelque chose soit satisfait. Ce n'est PAS une politique
   * non revérifiée — l'une dit « nous ne savons pas », l'autre « la compagnie exige ceci ».
   *
   * `restriction_ref` est OBLIGATOIRE : le contrat autorise plusieurs exigences sur un même canal
   * — certificat vétérinaire ET caisse renforcée — et sans elle `causeKey()` les écraserait en
   * une, si bien que le visiteur n'en verrait qu'une (mesuré en simulation, 2 causes → 1 clé).
   */
  z.object({
    code: z.literal("breed_requirement"),
    policy_ref: z.string().regex(POLICY_REF_RE),
    restriction_ref: z.string().regex(/^brest_[a-z0-9_]+$/),
  }).strict(),
  /**
   * UNE RÈGLE `deny` S'EST DÉCLENCHÉE MAIS N'A PAS LE DROIT DE REFUSER (05/09/2026).
   *
   * Deux causes, parce que le visiteur n'est pas dans la même situation selon qu'il a une page à
   * lire ou rien du tout — exactement la distinction déjà faite au niveau des politiques entre
   * `official_source_unquoted` et `legacy_unreviewed`.
   *
   * `rule_id` est OBLIGATOIRE : une incertitude qui ne dit pas de quelle règle elle vient est
   * inauditable, et c'est précisément ce qui a permis à `rule_british_airways_no_cabin` de fermer
   * la soute pendant des mois sans que personne puisse le rattacher à quoi que ce soit.
   */
  z.object({ code: z.literal("rule_official_unquoted"), rule_id: z.string().min(1) }).strict(),
  z.object({ code: z.literal("rule_unverified"), rule_id: z.string().min(1) }).strict(),
  /**
   * AUCUNE POLITIQUE DÉCLARÉE POUR CE CANAL. L'absence valait `denied` par défaut — « la fiche ne
   * documente pas cette soute, donc elle n'existe pas ». C'est une inférence, pas un fait : une
   * absence signifie qu'on ne sait pas. Elle vaut donc confirmation, comme tout le reste.
   */
  z.object({ code: z.literal("policy_absent"), policy_ref: z.string().regex(POLICY_REF_RE) }).strict(),
  /** Fait requis absent (poids total T2, âge T3). `fact` restera à resserrer en registre fermé
   *  avant la première migration T2/T3 — aucune donnée réelle ne l'émet en T0-A. */
  z.object({ code: z.literal("missing_fact"), fact: z.string().min(1), requirement_ref: z.string().min(1) }).strict(),
  /** Un FAIT DE RACE `deny` s'est déclenché sans porter une preuve complète (05/09/2026).
   *
   *  `SourcedQuote` impose la phrase et sa langue, mais laisse le `locator` FACULTATIF : un fait
   *  de race pouvait donc refuser un canal sur une provenance que la même frontière refuse à une
   *  RÈGLE. Deux exigences de preuve pour une même décision à l'écran — la faute que ce dépôt
   *  répète. Les deux chemins lisent maintenant le même prédicat canonique, et un fait de race
   *  non prouvé demande confirmation en nommant sa restriction. */
  z.object({ code: z.literal("breed_deny_unverified"), policy_ref: z.string().regex(POLICY_REF_RE), restriction_ref: z.string().min(1) }).strict(),
]);
export type ConfirmationCause = z.infer<typeof ConfirmationCause>;

/** LES CAUSES DE CHALEUR, EN UN SEUL ENDROIT.
 *
 *  Trois lecteurs dérivent un drapeau de chaleur — `hasActiveClimateCause` ici, le balayage des
 *  destinations, le titre de la section « à confirmer » de l'outil Destinations. Chacun comparait
 *  le code à `"estimated_climate"` en dur. Ajouter une seconde cause climatique par cette porte
 *  aurait allumé le drapeau chez l'un et pas chez les autres : c'est exactement la faute
 *  récurrente de ce dépôt — deux définitions du même fait qui divergent. Elles lisent désormais
 *  toutes cette fonction. */
export const CLIMATE_CAUSE_CODES = ["estimated_climate", "climate_rule_unquoted"] as const;
export const estCauseClimatique = (
  c: { code: string },
): c is Extract<ConfirmationCause, { code: (typeof CLIMATE_CAUSE_CODES)[number] }> =>
  (CLIMATE_CAUSE_CODES as readonly string[]).includes(c.code);

/** Clé canonique d'une cause — tri stable et déduplication des snapshots. */
export const causeKey = (c: ConfirmationCause): string =>
  estCauseClimatique(c) ? `${c.code}|${c.rule_id}`
  : c.code === "missing_fact" ? `${c.code}|${c.fact}|${c.requirement_ref}`
  /* `restriction_ref` fait partie de l'identité d'une exigence : deux exigences distinctes sur le
     même canal partagent leur `policy_ref` et seraient dédupliquées sans elle. */
  : (c.code === "breed_requirement" || c.code === "breed_deny_unverified") ? `${c.code}|${c.policy_ref}|${c.restriction_ref}`
  /* Les causes de RÈGLE s'identifient par leur règle, pas par un canal : deux règles distinctes
     déclenchées sur le même canal doivent rester deux causes, sans quoi le visiteur n'en verrait
     qu'une — la même faute que `restriction_ref` a fermée pour les exigences de race. */
  : (c.code === "rule_official_unquoted" || c.code === "rule_unverified") ? `${c.code}|${c.rule_id}`
  : `${c.code}|${c.policy_ref}`;

const sortDedupCauses = (causes: ConfirmationCause[]): ConfirmationCause[] => {
  const m = new Map<string, ConfirmationCause>();
  for (const c of causes) m.set(causeKey(c), c);
  return [...m.values()].sort((a, b) => causeKey(a).localeCompare(causeKey(b)));
};

/* ---- La PREUVE d'une décision de canal (T0-B2-UI) -------------------------------------------
 *
 * Le contre-test navigateur du 15/08/2026 a trouvé la carte du Finder affichant
 * « mydogcanfly.com » comme source de la politique de Thai Airways : la source RACINE de la
 * fiche, `source_type: "other"`, que 52 compagnies sur 102 portent encore. Une décision se
 * justifie par la page de la COMPAGNIE, pas par la nôtre.
 *
 * La preuve descend donc AVEC la décision, canal par canal, plutôt qu'à la racine de la carte.
 * L'auto-citation n'est pas filtrée à l'affichage mais refusée À LA CONSTRUCTION : une décision
 * fondée sur notre propre page est INCONSTRUCTIBLE, comme l'est déjà une confirmation sans cause.
 * `preuveAuditee` (knowledge) écarte en amont les sources dérivées et les politiques non
 * revérifiées ; ce refus-ci est la dernière barrière, celle qu'aucun appelant ne contourne. */
export const DecisionSource = z.object({
  url: z.string().url(),
  source_type: z.string().min(1),
  verified_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confidence: z.number().int().min(1).max(5),
}).strict().refine((s) => !estAutoCitation(s.url), {
  message: "auto-citation MyDogCanFly : une décision ne peut pas se fonder sur notre propre page",
});
export type DecisionSource = z.infer<typeof DecisionSource>;

/**
 * LA PREUVE D'UNE RESTRICTION DE RACE — au PLURIEL, et distincte de `DecisionSource`.
 *
 * Deux chemins concurrents auraient été pires que le défaut : `DecisionSource` reste la projection
 * COURTE de la politique générale du canal (quatre champs, pas de citation), et les faits de race
 * portent leur propre preuve, complète et au pluriel.
 *
 * Pourquoi le pluriel : le contrat `BreedRestriction` autorise plusieurs entrées décisives sur un
 * même canal — deux `require`, ou deux `deny` concordants documentés sur deux pages. Une source
 * singulière en perdait une (mesuré en simulation : 2 preuves produites, 1 transportée).
 *
 * Pourquoi `SourcedQuote` et non une provenance réduite : ce contrat garantit la citation, sa
 * langue, un type de source factuel, les dates, la confiance, le relecteur, l'historique et le
 * refus des auto-citations. En redéfinir une version appauvrie ici recréerait le modèle parallèle
 * que T0-B3-a a passé quatre revues à supprimer.
 */
export const RestrictionEvidence = z.object({
  restriction_ref: z.string().regex(/^brest_[a-z0-9_]+$/),
  /**
   * CE QUE LA PREUVE FONDE — ajouté au câblage de l'étape 2, sur un état que l'étape 1-bis
   * n'avait pas rencontré et que le contrat refusait donc à tort.
   *
   * Une restriction `allow` sur un canal dont le statut de base est déjà « à confirmer » (politique
   * non publiée, par exemple) laisse le statut inchangé et ne crée AUCUNE cause : sa preuve
   * apparaissait alors comme « une preuve sans cause correspondante » et la décision devenait
   * inconstructible. Les deux réponses possibles étaient mauvaises : perdre la preuve de
   * l'autorisation (la même restriction serait citée quand la politique est ouverte et muette
   * quand elle est à confirmer), ou relâcher l'accord et rouvrir le défaut que l'étape 1-bis a
   * fermé.
   *
   * Le rôle tranche : l'accord exact ne porte que sur les preuves d'EXIGENCE, celles qui motivent
   * une cause. Les preuves d'autorisation et de refus documentent sans motiver — elles restent
   * libres, mais toujours uniques et jamais orphelines d'une restriction réelle.
   */
  role: z.enum(["requirement", "authorisation", "refusal"]),
  source: SourcedQuote,
}).strict();
export type RestrictionEvidence = z.infer<typeof RestrictionEvidence>;

/** Un tableau de preuves : jamais vide quand il est présent — `evidence: []` dirait « des preuves,
 *  aucune », ce qui n'a pas de sens et masquerait un chemin de code qui les a perdues. */
const EvidenceArray = z.array(RestrictionEvidence).min(1);

const PlacementDecisionShape = z.discriminatedUnion("status", [
  z.object({ placement: Placement, status: z.literal("allowed"), allowed: z.literal(true),
    source: DecisionSource.optional(), evidence: EvidenceArray.optional() }).strict(),
  z.object({ placement: Placement, status: z.literal("denied"), allowed: z.literal(false),
    source: DecisionSource.optional(), evidence: EvidenceArray.optional() }).strict(),
  z.object({
    placement: Placement,
    status: z.literal("confirmation_required"),
    allowed: z.literal(false),
    confirmation_causes: z.array(ConfirmationCause).min(1),
    source: DecisionSource.optional(),
    evidence: EvidenceArray.optional(),
  }).strict(),
]);

/* ---- L'ACCORD ENTRE LES CAUSES ET LES PREUVES (contre-revue du 16/08/2026) -------------------
 *
 * Le contrat pluriel existait, mais rien ne le RELIAIT aux causes : une exigence sans preuve, une
 * preuve sans exigence, la même preuve deux fois et une politique non revérifiée accompagnée d'une
 * preuve de race passaient toutes les quatre. Un contrat qui décrit la forme sans décrire la
 * relation laisse au moteur le soin de la tenir — c'est-à-dire à personne.
 *
 * La règle est une ÉGALITÉ D'ENSEMBLES, pas une inclusion : sur un canal `confirmation_required`,
 * les `restriction_ref` des preuves d'EXIGENCE (`role: "requirement"`) sont exactement ceux des
 * causes `breed_requirement`.
 *   · une exigence sans sa preuve publierait « la compagnie exige ceci » sans dire d'où ça sort ;
 *   · une preuve d'exigence sans sa cause afficherait une citation qui ne motive rien ;
 *   · le cas `breed_policy_unreviewed` n'a AUCUNE preuve de race, quel qu'en soit le rôle — une
 *     absence de fait n'en a pas, et lui en attacher une la présenterait comme documentée ;
 *   · un doublon compterait deux fois la même page.
 *
 * `allowed` / `denied` ne portent pas de causes : leurs preuves restent facultatives (une
 * interdiction de race documentée reste utile à afficher), mais toujours non vides et uniques.
 * Une preuve d'EXIGENCE y reste légitime : c'est l'état exact d'une confirmation dégradée en refus
 * par `entryAllowed`, où les causes s'éteignent et où la preuve, elle, doit survivre.
 */
/**
 * Quels RÔLES un statut peut porter.
 *
 *   · `allowed` — une autorisation, et rien d'autre : une preuve de refus sur un canal ouvert, ou
 *     une exigence sur un canal sans condition, décriraient un état que le moteur ne peut pas
 *     produire et que le visiteur ne pourrait pas lire ;
 *   · `confirmation_required` — une autorisation ou une exigence ; jamais un refus, qui aurait
 *     fermé le canal ;
 *   · `denied` — LES TROIS. Une confirmation dégradée en refus par l'interdiction d'entrée du pays
 *     garde ses preuves, exigences comprises : c'est le cas verrouillé par l'étape 1-bis, et le
 *     refuser ici reperdrait exactement ce qu'elle a sauvé.
 */
const ROLES_ADMIS: Record<PlacementStatusLitteral, readonly string[]> = {
  allowed: ["authorisation"],
  confirmation_required: ["authorisation", "requirement"],
  denied: ["authorisation", "requirement", "refusal"],
};

export const PlacementDecision = PlacementDecisionShape.superRefine((d, ctx) => {
  const refs = (d.evidence ?? []).map((e) => e.restriction_ref);
  const uniques = new Set(refs);
  const admis = ROLES_ADMIS[d.status];
  for (const e of d.evidence ?? []) {
    if (!admis.includes(e.role)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evidence"],
        message: `preuve de rôle « ${e.role} » sur un canal ${d.status} (${e.restriction_ref}) : `
          + `rôles admis — ${admis.join(", ")}` });
    }
  }
  if (uniques.size !== refs.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evidence"],
      message: `preuve dupliquée sur ${d.placement} : ${refs.join(", ")}` });
  }
  if (d.status !== "confirmation_required") return;
  if (d.confirmation_causes.some((c) => c.code === "breed_policy_unreviewed") && refs.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evidence"],
      message: `« politique de race non revérifiée » sur ${d.placement} : une absence de fait ne `
        + `porte aucune preuve (${refs.join(", ")})` });
  }
  const exigences = new Set(
    d.confirmation_causes.flatMap((c) => (c.code === "breed_requirement" ? [c.restriction_ref] : [])),
  );
  const preuvesExigence = new Set(
    (d.evidence ?? []).flatMap((e) => (e.role === "requirement" ? [e.restriction_ref] : [])),
  );
  const sansPreuve = [...exigences].filter((r) => !preuvesExigence.has(r));
  const sansCause = [...preuvesExigence].filter((r) => !exigences.has(r));
  if (sansPreuve.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evidence"],
      message: `exigence de race sans preuve sur ${d.placement} : ${sansPreuve.join(", ")}` });
  }
  if (sansCause.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evidence"],
      message: `preuve d'exigence sans cause correspondante sur ${d.placement} : ${sansCause.join(", ")}` });
  }
});
export type PlacementDecision = z.infer<typeof PlacementDecision>;

/** Le triplet complet d'une compagnie : exactement cabine, soute et fret — ni absence, ni doublon.
 *  Le schéma d'une décision isolée ne peut pas garantir cet invariant ; celui-ci le valide. */
export const PlacementDecisionSet = z.array(PlacementDecision).length(3).superRefine((ds, ctx) => {
  const seen = ds.map((d) => d.placement).sort().join(",");
  if (seen !== "cabin,cargo,hold") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `PlacementDecisionSet: placements {${seen}} ≠ {cabin,cargo,hold}` });
  }
});

/** L'UNIQUE constructeur d'une décision — valide À LA CONSTRUCTION, jamais un littéral libre.
 *  `allowed` est imposé par la branche du statut ; les causes sont triées et dédupliquées ici,
 *  une fois pour toutes, pour des snapshots reproductibles. */
export function makePlacementDecision(
  placement: z.infer<typeof Placement>,
  status: PlacementStatus,
  causes?: ConfirmationCause[],
  /** La preuve du canal, DÉJÀ passée par `preuveAuditee` — jamais la source racine de la fiche. */
  source?: unknown,
  /** Les preuves des restrictions de RACE qui ont tranché — une par restriction décisive, jamais
   *  réduites à la première. Distinctes de `source`, qui reste la projection courte du canal. */
  evidence?: RestrictionEvidence[],
): PlacementDecision {
  /* La preuve est facultative : la plupart des politiques n'en ont pas d'auditée, et une décision
     sans source vaut mieux qu'une décision avec une source fabriquée. Quand elle existe, elle est
     réduite aux quatre champs du contrat — le reste (citation, relecteur, historique) appartient
     à la fiche, pas à la carte. */
  const preuve = source ? DecisionSource.parse(reduireSource(source)) : undefined;
  /* `evidence === undefined` (aucune preuve) et `evidence === []` (« des preuves, aucune ») sont
     deux choses différentes : la première est légitime, la seconde est refusée par le schéma.
     La première version ramenait le tableau vide à `undefined` — un appelant qui aurait perdu ses
     preuves en chemin aurait produit une décision valide et muette. Les preuves sont TRIÉES ici,
     jamais dédupliquées : dédupliquer effacerait le doublon que le contrat doit refuser. */
  const preuves = evidence && [...evidence].sort((a, b) => a.restriction_ref.localeCompare(b.restriction_ref));
  return PlacementDecision.parse(
    status === "confirmation_required"
      ? { placement, status, allowed: false, confirmation_causes: sortDedupCauses(causes ?? []),
          source: preuve, evidence: preuves }
      : { placement, status, allowed: status === "allowed", source: preuve, evidence: preuves },
  );
}
/** Les quatre champs du contrat, extraits d'une source de fiche — `.strict()` refuse les autres. */
const reduireSource = (s: unknown) => {
  const o = s as Record<string, unknown>;
  return { url: o.url, source_type: o.source_type, verified_date: o.verified_date, confidence: o.confidence };
};

/** Valide le triplet complet d'une compagnie (défense en profondeur : chaque décision a déjà
 *  été validée individuellement à sa construction). */
export function makePlacementDecisionSet(ds: PlacementDecision[]): PlacementDecision[] {
  return PlacementDecisionSet.parse(ds);
}

/** La chaleur dérive d'une CAUSE CLIMATIQUE ACTIVE — jamais du seul statut (T0-A). */
export const hasActiveClimateCause = (d: PlacementDecision): boolean =>
  d.status === "confirmation_required" && d.confirmation_causes.some(estCauseClimatique);

/** Signal de confirmation d'une destination : la cause SANS perdre la compagnie ni le canal
 *  (contre-revue v2 : deux signaux identiques chez deux compagnies ou sur deux canaux sont deux
 *  informations distinctes). L'agrégat de statut d'une destination suit sa propre dominance
 *  (`allowed > confirmation_required > denied`) ; ces signaux survivent même quand le statut
 *  agrégé vaut `allowed` grâce à une autre compagnie. */
export interface DestinationConfirmationSignal {
  airline_id: string;
  placement: z.infer<typeof Placement>;
  cause: ConfirmationCause;
}
export const signalKey = (s: DestinationConfirmationSignal): string =>
  `${s.airline_id}|${s.placement}|${causeKey(s.cause)}`;

/* ---- Public input contract (frozen in Phase 1, contract-first) ---- */
export const FinderRequest = z.object({
  origin: z.string(),      // airport id (representative origin — the primary of the origin set)
  destination: z.string(), // airport id (representative destination)
  // Optional airport sets — used for city-level search (e.g. Paris = CDG + ORY). Fall back to [origin]/[destination].
  origins: z.array(z.string()).optional(),
  destinations: z.array(z.string()).optional(),
  dog: z.object({
    breed_id: z.string().optional(),
    // Plafond ajouté (audit du 09/08/2026) : `positive()` seul laissait passer n'importe quel poids
    // absurde (999 999 kg reproduit en direct via l'API) et obtenait un verdict "conditional" avec
    // de vraies compagnies listées en soute/fret. 120 kg couvre largement le plus gros chien réel
    // (mâtin/dogue ~100 kg) tout en bloquant une confusion d'unité (grammes au lieu de kilos) ou
    // une saisie fantaisiste.
    weight_kg: z.number().positive().max(120).optional(),
    brachycephalic: z.boolean().optional(),
  }),
  travel_type: TravelType.default("pet"),
  placement: z.union([Placement, z.literal("any")]).default("any"),
  date: TravelDate.optional(),
  /* PLAGE OPÉRATIONNELLE PRODUIT sur la température — pas une limite physique terrestre
     (reformulé au L-bis sur remarque de Codex : l'OMM recense des températures continentales
     sous −60 °C, Vostok est descendu à −89,2 °C ; « physique » était donc faux). Ce que borne
     cette plage, c'est le domaine où un embargo de chaleur pour un chien sur un vol commercial
     a un sens : −60 °C à +60 °C est la plage opérationnelle produit retenue pour le voyage
     commercial, et le record officiel OMM de chaleur à l'ombre (56,7 °C, table des records de
     l'OMM) tient largement dedans. Hors plage, la saisie
     est bien plus probablement une erreur d'unité (Fahrenheit, dixièmes) qu'une expédition
     antarctique avec chien en soute : le contrat répond 400, et si ce cas d'usage émergeait un
     jour, élargir la borne est une décision produit d'une ligne. Ce champ pilote les embargos
     de chaleur — une valeur absurde ne fausse pas un affichage, elle décide. */
  /* `.strict()` et non le mode strip par défaut : le mini-contrat climat promet qu'un client ne
     peut pas DÉCLARER la provenance de sa température. En strip, un champ `provenance` envoyé par
     un client aurait été ignoré en silence — c'est-à-dire accepté ; en strict, il est refusé en
     400. La provenance est posée par le serveur, exclusivement. */
  weather: z.object({ temperature_c: z.number().min(-60).max(60) }).strict().optional(),
  /* Retour vers l'UE — le seul fait que le moteur ne peut pas déduire du vol.
     On interroge la SITUATION du chien ("vit-il habituellement dans l'Union européenne ?"), au
     présent et sans rien faire vérifier : "yes" = il rentre chez lui, "no" = il découvre l'UE.
     La question portait autrefois sur le document et au passé, ce qui n'avait pas de sens pour qui
     n'a jamais quitté l'UE ; « vit habituellement » dit en plus ce que la Commission pose et que
     l'ancienne formulation ratait — la dispense vaut pour un séjour, pas pour un propriétaire qui
     réside désormais hors UE.
     ABSENT = on ne devine pas : les DEUX parcours (passeport et certificat) sont affichés. Ne
     jamais traiter l'absence de réponse comme un "no".
     Le "unknown" d'avant n'est plus ni produit ni attendu ; s'il arrive encore d'une page en cache,
     il est ramené à l'absence de réponse plutôt que rejeté — un 400 priverait le visiteur de tout
     son rapport pour une valeur dont on connaît déjà le sens prudent. */
  eu_passport: z.preprocess(
    (v) => (v === "unknown" || v === "" ? undefined : v),
    z.enum(["yes", "no"]).optional(),
  ),
  locale: Locale.default("en"),
});
export type FinderRequest = z.infer<typeof FinderRequest>;

/* ---- Destination-finder input contract: "where can I fly my dog on this date?" ----
   Same dog + date model as the finder, but no fixed destination — the engine scans every
   country reachable from the origin and returns a compact per-destination match. */
/* Retest 09/08/2026, point 4 : une date passée (ex. 2020-01-15) était acceptée telle quelle — le
 * moteur mélangeait alors le réseau aérien ACTUEL avec le climat moyen d'un mois révolu, produisant
 * un résultat sans signification. Validée ici (moteur), en plus du `min`/`max` posés côté client
 * sur le champ — la validation client seule est contournable (saisie directe, DevTools, appel API
 * direct). Horizon plafonné à 18 mois : au-delà, ni le réseau de routes ni les règles ne sont
 * garantis stables, et rien dans le référentiel ne modélise leur évolution future.
 */
// La validation vit désormais dans `TravelDate` (knowledge/common.ts), partagée par les deux
// requêtes. L'ancienne version, par expression régulière et comparaison lexicographique, acceptait
// « 2027-02-30 » et « 2026-13-01 » — et le moteur en dérivait un mois hors domaine.

export const DestinationsRequest = z.object({
  origin: z.string(),                       // representative origin airport id
  origins: z.array(z.string()).optional(),  // origin airport set (city search, e.g. Paris = CDG + ORY)
  dog: z.object({
    breed_id: z.string().optional(),
    weight_kg: z.number().positive().max(120).optional(), // même plafond que FinderRequest — cf. commentaire là-bas
    brachycephalic: z.boolean().optional(),
  }),
  placement: z.union([Placement, z.literal("any")]).default("any"),
  date: TravelDate.optional(),
  locale: Locale.default("en"),
});
export type DestinationsRequest = z.infer<typeof DestinationsRequest>;

/** One reachable destination CITY (airport), reachable by a DIRECT flight, summarised for the ranking.
    Climate is estimated per airport from its latitude + travel month (not the country) — honest about
    intra-country variation, though altitude is not captured. Formalities are added by the UI (country
    guide difficulty × the documents the traveller holds). */
export interface DestinationMatch {
  airport_id: string;
  iata: string;
  city: string;              // localized city name
  country_id: string;
  iso2: string;
  country_name: string;      // localized country name
  region: string;
  temperature_c: number;     // per-airport seasonal estimate (latitude + month)
  climate_estimated: boolean; // true when a travel month was supplied
  /** TOUJOURS false dans cet outil : sa température est toujours estimée (latitude), et une
   *  estimation ne peut plus produire un embargo (P0 climat). Conservé pour la transition. */
  heat_embargo: boolean;
  /** ≥1 compagnie directe porte RÉELLEMENT un canal `confirmation_required` — dérivé de la
   *  décision, jamais du seul seuil de température (contre-revue v2 : un carlin dont tous les
   *  canaux sont refusés par les règles de race ne doit rien avoir « à confirmer »). */
  heat_confirmation_required: boolean;
  /** Indicateur BRUT : température estimée au-dessus du seuil. Aucune prétention sur les règles
   *  compagnie — c'est un signal météo modélisé, à afficher comme tel. */
  estimated_heat_signal: boolean;
  heat_risk: boolean;        // warm-but-not-embargo band
  airlines_total: number;          // compagnies directes avec ≥1 canal réellement `allowed`
  airlines_to_confirm_total: number; // compagnies directes SANS canal allowed mais avec ≥1 « à confirmer »
  /* Booléens de transition, vrais UNIQUEMENT pour `allowed` ; les statuts sont la vérité.
     Le fret entre officiellement dans l'outil (arbitrage du 13/08/2026, option 1) : `cargo_ok`
     était calculé, utilisé dans `placement_ok`, et jamais émis — 3 à 5 destinations étaient
     « compatibles » par un canal que le visiteur ne pouvait pas voir. */
  cabin_ok: boolean;
  hold_ok: boolean;
  cargo_ok: boolean;
  cabin_status: PlacementStatus;
  hold_status: PlacementStatus;
  cargo_status: PlacementStatus;
  /** T0-A — les causes de confirmation AVEC leur compagnie et leur canal (jamais aplaties : deux
   *  causes identiques chez deux compagnies sont deux signaux). Survivent à l'agrégation même
   *  quand le statut agrégé vaut `allowed` grâce à une autre compagnie. Triées, dédupliquées
   *  sur le triplet complet. */
  confirmation_signals: DestinationConfirmationSignal[];
  placement_ok: boolean;         // le placement demandé est réellement `allowed` sur ≥1 compagnie directe
  /** Aucun canal demandé `allowed`, mais ≥1 « à confirmer » : à afficher en ALTERNATIVE, jamais en compatible. */
  placement_to_confirm: boolean;
  /** Le statut d'entrée du pays — voir `EntryStatus`. Le classement doit le lire, pas le booléen. */
  entry_status: EntryStatus;
  entry_allowed: boolean;    // projection legacy : `entry_status !== "blocked"`
  flight_hours: number;      // estimated direct flight time (great-circle distance ÷ cruise speed)
}

/* Retest 09/08/2026, point 2 : le seul champ `matches` ne permettait pas de distinguer "aucune
 * compagnie ne dessert de destination directe depuis cette ville" (candidates_total = 0) de "des
 * destinations sont desservies, mais aucune n'accepte ce chien nulle part" (candidates_total > 0,
 * matches vide) — les deux retombaient sur le même "matches: []" et donc le même message générique
 * côté UI. */
export interface DestinationsResult {
  matches: DestinationMatch[];
  candidates_total: number; // aéroports directement desservis depuis l'origine, avant tout filtrage race/placement
}

/* ---- Internal (Decision Engine output) ---- */
/** LE PAYS LAISSE-T-IL ENTRER CE CHIEN ? TROIS RÉPONSES, PARCE QU'IL Y EN A TROIS.
 *
 *  `entry_allowed` était un BOOLÉEN, et il rejouait mot pour mot la faute d'`offers_pet_transport` :
 *  aucune place pour l'inconnu, donc il tranchait. Depuis que la frontière garde ce chemin, une
 *  interdiction NON CITÉE le laissait à `true` — et le rapport disait alors trois choses à la fois
 *  sur le même trajet (mesuré, CDG → LHR, American Bully XL) :
 *
 *      « Interdit par l'article 1 du Dangerous Dogs Act 1991 »   (exigence, critique)
 *      « Pas encore établi »                                     (verdict global)
 *      « Le Royaume-Uni autorise l'entrée »                      (élément positif)
 *
 *  Le troisième énoncé était une conclusion tirée d'une absence de preuve, et c'est le seul des
 *  trois qui soit franchement faux.
 *
 *    "blocked"               ≥1 refus d'entrée DÉCISIF — le pays refuse, c'est établi ;
 *    "confirmation_required" ≥1 refus applicable mais non décisif — une restriction existe peut-être,
 *                            elle n'est pas prouvée, et le trajet ne peut pas être déclaré possible ;
 *    "no_known_block"        aucun refus applicable identifié. Ce n'est PAS « le pays autorise » :
 *                            c'est « aucune interdiction bloquante établie dans nos données ».
 */
export type EntryStatus = "blocked" | "confirmation_required" | "no_known_block";

/** Trois valeurs, parce que l'ignorance en est une — voir AirlineDecision.offers_pet_transport. */
export type PetTransportStatus = "yes" | "no" | "unknown";

export interface FiredRule {
  rule_id: string;
  action: string;
  category: string;
  criticality: string;
  rationale: string;
  source_url: string;
  confidence: number;
  params: Record<string, unknown>;
  /** La règle porte-t-elle une preuve CITÉE (page officielle + phrase + langue + emplacement) ?
   *  Seule une règle décisive peut refuser. `fired` conserve les autres pour l'audit ; ce champ
   *  empêche qu'elles décident silencieusement en aval. */
  decisive: boolean;
}
export interface AirlineDecision {
  airline_id: string;
  airline_name: string;
  country_id?: string;        // pays d'immatriculation déclaré dans les données — PAS un statut de porte-drapeau
  direct: boolean;            // likely a direct flight on this route (hub at origin or destination)
  /* INTERNE, jamais public : projection booléenne d'`offers_pet_transport === "yes"`. Elle ne
     sert qu'à la mesure d'écart versionnée ; l'écran lit le statut ternaire. */
  carries_pets: boolean;
  /* Ce que vaut réellement l'itinéraire proposé. On ne présente plus un nonstop attesté et une
     correspondance fabriquée par géométrie de hub sous la même étiquette :
       direct_documented       — la paire origine|destination figure dans `direct_routes` ;
       direct_assumed          — pas de graphe de routes : « direct » vient de l'heuristique du hub ;
       connection_documented   — les DEUX segments origine→hub et hub→destination sont dans `direct_routes` ;
       connection_unverified   — hub géométriquement plausible, mais aucun segment attesté.
     `connection_unverified` ne dit pas que l'itinéraire n'existe pas : il dit que rien ne l'établit. */
  itinerary_confidence?: "direct_documented" | "direct_assumed" | "connection_documented" | "connection_unverified";
  /* Motifs du refus, LUS sur les règles qui ont réellement refusé chaque placement (leur catégorie
     et les placements qu'elles visent), jamais déduits d'une absence de mode accepté.
     Codes : breed_restricted · weight_limit · cabin_unavailable · hold_unavailable · cargo_unavailable. */
  deny_reasons?: string[];
  connect_airport_id?: string;     // for a connection, the airline hub the itinerary plausibly routes through
  detour_km?: number;              // extra distance vs the direct great-circle (0 for a direct) — ranks/trims connections
  /* `source_url` — la source RACINE de la fiche — a été SUPPRIMÉE (T0-B2-UI, contre-revue du
     15/08/2026). Elle ne documentait aucun canal : sur 102 compagnies, 52 pointaient une page de
     MyDogCanFly et 35 des 50 restantes une simple page d'accueil (aerlingus.com, airchina.com…).
     Ne filtrer que les auto-citations laissait donc 35 pages d'accueil présentées comme la preuve
     d'une politique. La preuve descend maintenant AVEC la décision : `PlacementDecision.source`.
     Ne pas la réintroduire « juste pour le lien » : l'absence du champ est ce qui garantit
     qu'aucune surface ne peut la rendre. */
  /* `fee` SUPPRIMÉ (micro-lot Tarifs, 29/08/2026) — comme `source_url` avant lui, et pour la
     même raison : tant que le champ existe, une surface finit par le rendre. Il portait un montant
     unique, attribué au premier canal accepté et affiché sans canal ; 91 des 101 valeurs venaient
     de l'ancien champ libre `fees`. Le statut tarifaire vit maintenant par CANAL, dans le
     rapport. Ne pas le réintroduire « juste pour l'information ». */
  origin_airport_id?: string;      // the origin airport this airline actually uses, when it differs from the representative origin (city search)
  destination_airport_id?: string; // idem for the destination
  /* `status` est la vérité ; `allowed` est le booléen de transition, vrai UNIQUEMENT pour
     `allowed`. Un embargo chaleur déclenché sur une température ESTIMÉE produit
     `confirmation_required` — jamais un refus dur, jamais une disponibilité.
     T0-A : le triplet est validé (`PlacementDecisionSet`) et chaque confirmation porte ses
     causes structurées. */
  placements: PlacementDecision[];
  /** LA COMPAGNIE TRANSPORTE-T-ELLE DES ANIMAUX ? OUI, NON, OU ON NE SAIT PAS (05/09/2026).
   *
   *  Ce champ était un BOOLÉEN, et il valait `true` sur les 102 compagnies du dépôt. Il était
   *  dérivé de « la politique n'est pas refusée » — c'est-à-dire d'une ABSENCE de refus, jamais
   *  d'une preuve d'acceptation. Un booléen n'a pas de place pour l'ignorance : il fallait bien
   *  qu'il tranche, alors il tranchait toujours dans le même sens, et le site affirmait 102 fois
   *  un fait que personne n'avait établi.
   *
   *  Les trois valeurs suivent la même frontière que les canaux :
   *    "yes"     ≥1 canal `allowed` — une acceptation PROUVÉE (citation complète) ;
   *    "no"      les trois canaux `denied` — trois refus PROUVÉS ;
   *    "unknown" tout le reste, y compris une politique absente.
   *  Aujourd'hui : 0 « oui », 0 « non », 102 « on ne sait pas ». C'est la vérité du dépôt. */
  offers_pet_transport: PetTransportStatus;
  /** TÉMOIN DE TRANSITION, jamais public (retiré par explain) : l'ancien calcul verbatim, pour
   *  que la CI recalcule l'écart exhaustif versionné (t0a-carries-pets-diff.json). À retirer
   *  avec le fichier une fois la migration digérée. */
  _legacy_carries_pets?: boolean;
  fired: FiredRule[];
}
/** Seasonal climate context used for the heat-embargo filter (temperature-driven hold/cargo denials). */
export interface Climate {
  temperature_c: number; // temperature applied to the evaluation (explicit, or model-estimated from the date)
  provenance: TemperatureProvenance; // posée par le serveur — visitor_input | estimated_region | estimated_latitude
  estimated: boolean;    // true when derived from the travel month + destination region (not user-supplied)
  provided: boolean;     // true when the user gave a travel date or explicit temperature (else it's the mild default)
  month?: number;        // 1..12, when a date was supplied
  risk: boolean;         // possible-but-unconfirmed heat: temperate region in peak-summer months (heat-wave season)
}
export interface Decision {
  request: FinderRequest;
  airlines: AirlineDecision[];
  countryRequirements: FiredRule[];
  destination: {
    country_id: string; country_name: string;
    /** LE PAYS LAISSE-T-IL ENTRER CE CHIEN ? TROIS RÉPONSES — voir `EntryStatus`. */
    entry_status: EntryStatus;
    /** Projection booléenne HISTORIQUE d'`entry_status === "blocked"`, inversée : elle ne vaut
     *  `false` que sur un blocage PROUVÉ. Conservée pour les lecteurs internes qui n'ont besoin
     *  que de « est-ce bloqué » ; elle ne doit JAMAIS servir à conclure que le pays autorise. */
    entry_allowed: boolean;
    /** Les interdictions d'entrée qui se sont déclenchées SANS pouvoir décider, par `rule_id`.
     *  Elles ne ferment rien, mais elles ne se perdent pas : leur exigence reste publiée en tête
     *  du rapport, et ce champ permet de les auditer et de les compter. */
    entry_unverified_denies?: string[];
  };
  origin_country_id: string; // pays de l'aéroport de départ (le départage carrier_of_* est retiré — J-bis 11/08/2026)
  domestic: boolean;       // same country at both ends: no border crossing, so no import requirements apply
  brachycephalic: boolean; // effective snub-nosed flag (from request or breed) — drives welfare wording
  climate: Climate;        // seasonal temperature context (drives the automatic heat embargo)
  /** Les signaux d'avis levés par les restrictions `warn`, AVANT localisation et déduplication.
   *  OBLIGATOIRE, quitte à être vide — voir `DecisionReport.safety_advisories`. */
  breed_advisories: AdvisorySignal[];
}

/* ---- Public output contract: the Decision Report (Explanation Engine output) ---- */
export interface ReportItem {
  text: string;
  criticality: string;
  tone?: "positive" | "negative"; // UI marker: green check (default) vs red cross
  rule_id?: string;
  source_url?: string;
}
/** A contextual partner suggestion — only ever present when it adds value to this report. */
export interface PartnerRef {
  partner_id: string;
  vertical: string;
  name: string;
  url: string;        // monetizable outbound link — non-empty ONLY when sponsored (status = active)
  sponsored: boolean; // true only for an active affiliate; safeguard against sending free qualified traffic
  reason: string;     // the contextual value (why it is shown here)
}
/** One airline's outcome for this dog + route — the unit of the comparison list. */
export interface AirlineResult {
  airline_id: string;
  name: string;
  direct: boolean;
  connect_airport_id?: string;  // for a connection, the airline hub it routes through (e.g. Madrid) — shown as "via MAD"
  detour_km?: number;           // extra distance vs the direct route (0 for direct) — used to rank connections
  /* Booléens de transition : vrais UNIQUEMENT pour `allowed`. Les statuts sont la vérité. */
  cabin: boolean;
  hold: boolean;
  cargo: boolean;
  cabin_status: PlacementStatus;
  hold_status: PlacementStatus;
  cargo_status: PlacementStatus;
  /** Canaux au statut `confirmation_required` — à rendre « politique à confirmer », JAMAIS comme ouverts. */
  to_confirm?: string[];
  /** T0-A — le triplet canonique validé : trois décisions (cabine/soute/fret), chaque
   *  confirmation portant ses causes structurées. Les booléens et `*_status` ci-dessus en
   *  DÉRIVENT ; c'est la source d'affichage des libellés par famille de cause. */
  placement_decisions: PlacementDecision[];
  /** Statut ternaire — voir AirlineDecision.offers_pet_transport. */
  offers_pet_transport?: PetTransportStatus;
  /* Projection legacy de `offers_pet_transport` (T0-A — correction contrôlée, diff versionné :
     l'ancien calcul appliquait les règles du trajet au « chien neutre » et affichait « Animaux
     refusés » sur des compagnies dont la politique propose un canal).
     NE JAMAIS EN DÉDUIRE UN MOTIF : « true, mais aucun mode accepté » ne veut pas dire « race
     refusée » — c'est le plus souvent le poids, ou l'absence de soute/fret. Le motif réel est
     dans `deny_reasons`, lu sur les règles qui ont refusé. */
  /* RETIRÉ DE LA SURFACE PUBLIQUE (05/09/2026) : ce booléen était la projection d'un booléen
     qui valait `true` partout, et l'écran en tirait « la compagnie prend des animaux, mais pas
     ce chien-ci » — une affirmation sur la compagnie qu'aucune preuve ne soutenait. L'écran lit
     désormais le statut ternaire, qui sait dire « on ne sait pas ». */
  carries_pets?: undefined;
  /** Motifs du refus (codes stables), présents seulement quand aucun mode n'est accepté. */
  deny_reasons?: string[];
  /** Nature de l'itinéraire — voir AirlineDecision.itinerary_confidence. */
  itinerary_confidence?: "direct_documented" | "direct_assumed" | "connection_documented" | "connection_unverified";
  label: string;        // localized one-line verdict (e.g. "Cabin OK", "Hold only", "Not accepted")
  /** LE STATUT TARIFAIRE, PAR CANAL — jamais un montant, jamais un statut par compagnie.
   *  Dans ce lot il est DÉRIVÉ DU CANAL et de rien d'autre : « à confirmer » en cabine et en
   *  soute, « à demander au service cargo » pour le fret. Un statut par compagnie exigerait un
   *  registre tarifaire sourcé — il n'en existe pas encore, et un statut sans registre n'est pas
   *  meilleur qu'un montant sans source : il est seulement moins visible. */
  statuts_tarifaires?: { placement: Placement; statut: string }[];
  /* `source_url` SUPPRIMÉE — voir `AirlineDecision`. Une carte ne porte plus de source de fiche,
     même officielle : elle porte les sources de ses CANAUX (`placement_decisions[].source`), ou
     aucune. Le site de la compagnie reste accessible d'un clic, depuis la fiche compagnie. */
  /** Embargo chaleur CONFIRMÉ — température fournie par le visiteur au-dessus du seuil. Une
   *  estimation ne produit JAMAIS ce drapeau (P0 climat) : elle produit le suivant. */
  heat_embargo?: boolean;
  /** Signal de chaleur sur température ESTIMÉE : la soute/le fret sont « à confirmer auprès de la
   *  compagnie », pas suspendus. Distinct d'`heat_embargo` par la provenance, pas par le seuil. */
  heat_confirmation_required?: boolean;
  /* « Compagnie immatriculée dans ce pays », et RIEN DE PLUS : simple égalité de `country_id`.
   * Ces deux champs annonçaient « national/flag carrier » — c'était faux (voir explain.ts).
   * Ne pas réintroduire ce vocabulaire sans une donnée `flag_carrier` explicite. */
  carrier_of_origin?: boolean;      // compagnie immatriculée dans le pays de départ (triée juste après les vols directs)
  carrier_of_destination?: boolean; // compagnie immatriculée dans le pays d'arrivée (triée ensuite)
  origin_airport_id?: string;       // the specific origin airport used, when it differs from the one searched (city search)
  destination_airport_id?: string;  // idem for the destination
}
/**
 * UN AVIS DE SÉCURITÉ — ce que le site RECOMMANDE sans l'imposer.
 *
 * Il naît d'une `BreedRestriction` `warn` : le cas fondateur du contrat, celui de la
 * recommandation IATA qui déconseille le transport des chiens au museau écrasé en saison chaude
 * sans l'interdire. En faire un refus est précisément ce qui a produit `rule_global_brachy_hold`,
 * une interdiction universelle et permanente là où la source dit « not recommended ».
 *
 * Un avis N'AGIT SUR RIEN : ni statut de canal, ni score, ni `fired`, ni sources probantes. Il
 * informe. C'est pourquoi il vit dans un champ à lui et non parmi les preuves.
 *
 * `text` est DÉJÀ localisé, comme `ReportItem.text` : le rapport ne transporte pas un objet
 * multilingue que l'interface aurait à démêler.
 */
export const SafetyAdvisory = z.object({
  restriction_ref: z.string().regex(/^brest_[a-z0-9_]+$/),
  /** « global » ou une compagnie — la portée de l'avis, jamais devinée. */
  scope: z.union([z.literal("global"), z.string().regex(/^airline_[a-z0-9_]+$/)]),
  /** Non vide ET sans doublon : `["hold","hold"]` afficherait deux fois le même conseil sur le
   *  même canal, et rendrait la longueur du tableau inutilisable comme mesure de portée. */
  placements: z.array(Placement).min(1).refine((p) => new Set(p).size === p.length, {
    message: "placements : doublon",
  }),
  text: z.string().min(1),
  /* PAS DE `criticality`. La v1 en publiait une, toujours `"medium"` : aucune `BreedRestriction`
     n'en porte, et la page IATA ne donne aucune échelle de gravité. Une valeur constante présentée
     comme un fait de la source est une affirmation inventée, fût-elle neutre — exactement le
     glissement que ce chantier corrige. Si l'interface a besoin d'un ordre d'affichage, ce sera un
     contrat de PRÉSENTATION distinct, avec sa grille documentée, jamais un attribut prêté à la
     source. */
  source: SourcedQuote,
}).strict();
export type SafetyAdvisory = z.infer<typeof SafetyAdvisory>;

/** Clé de déduplication d'un avis : (restriction, portée). Un avis GLOBAL vaut pour le RAPPORT —
 *  l'émettre une fois par compagnie et par canal ne dit rien de ce que reçoit un visiteur. */
export const advisoryKey = (a: SafetyAdvisory): string => `${a.restriction_ref}|${a.scope}`;

/**
 * LE SIGNAL D'AVIS, tel qu'`evaluate` le produit — avant le choix de la langue.
 *
 * `evaluate` décide QUOI dire et sur quels canaux ; `explain` décide DANS QUELLE LANGUE, comme
 * pour tout `ReportItem`. Faire choisir la langue à `evaluate` l'aurait obligé à lire
 * `request.locale` alors que `explain(decision, locale)` reçoit la sienne : deux sources de
 * vérité pour la même question, et un rapport qui pourrait sortir dans une langue que son
 * appelant n'a pas demandée.
 */
export interface AdvisorySignal {
  restriction_ref: string;
  scope: "global" | string;
  placements: Placement[];
  /** Le texte MULTILINGUE de la restriction — `explain` en extrait la langue du rapport. */
  detail: LocalizedText;
  source: SourcedQuote;
}

export interface DecisionReport {
  /** LA RÉPONSE À « MON CHIEN PEUT-IL VOYAGER ? » — quatre valeurs depuis le 05/09/2026.
   *
   *  Elle n'en avait que trois, et aucune ne savait dire « on ne l'a pas encore établi ». Comme
   *  tout énoncé à trois valeurs sommé de trancher, elle tranchait : sur des trajets où AUCUN
   *  canal n'était prouvé, le site répondait « Oui — sous conditions » — un OUI catégorique tiré
   *  de zéro preuve. C'est exactement ce que le critère de lancement interdit.
   *
   *    "compatible"   ≥1 canal PROUVÉ ouvert, aucune formalité d'entrée ;
   *    "conditional"  ≥1 canal PROUVÉ ouvert, sous formalités ;
   *    "unknown"      rien de prouvé dans un sens ni dans l'autre, mais des pistes à confirmer ;
   *    "incompatible" le pays refuse l'entrée, ou tous les canaux sont refusés — PROUVÉS. */
  verdict: "compatible" | "conditional" | "unknown" | "incompatible";
  /** 0..100 TRIP-level score (see computeScore() in explain.ts) — every candidate airline on this
   *  route combined, never a single carrier's number. Weighted from real choice (accepted ÷
   *  candidate airlines), route-attestation quality (direct_documented > direct_assumed >
   *  connection_documented > connection_unverified), and average source confidence, minus a
   *  penalty for entry-formality friction. Not a probability of successful travel. */
  score: number;
  /** Airline-by-airline comparison for this dog + route, direct flights first. */
  airlines: AirlineResult[];
  /** Les avis de sécurité du rapport, dédupliqués par (restriction, portée). OBLIGATOIRE, quitte
   *  à être vide : un champ facultatif est un champ que l'interface peut ignorer sans que rien
   *  n'échoue — c'est exactement ce que la contre-revue a refusé. */
  safety_advisories: SafetyAdvisory[];
  /** Destination country, for the flag + link to its entry-requirements page. */
  destination_country?: { iso2: string; name: string };
  /** True when origin and destination are the same country: no border, so no import formalities apply. */
  domestic?: boolean;
  /** Seasonal temperature context — present only when the user supplied a travel date or temperature.
   *  embargo = confirmed (estimate above threshold); risk = possible-but-unconfirmed heat-wave season. */
  climate?: {
    temperature_c: number; estimated: boolean; provenance: TemperatureProvenance;
    /** Vrai UNIQUEMENT sur température fournie (`visitor_input`) au-dessus du seuil. */
    embargo: boolean;
    /** ≥1 compagnie du rapport porte réellement un canal à confirmer, ET la température estimée
     *  dépasse le seuil — jamais le seuil seul (contre-revue v2). */
    confirmation_required: boolean;
    /** Indicateur brut : température estimée au-dessus du seuil, sans prétention sur les règles. */
    estimated_heat_signal: boolean;
    risk: boolean; threshold_c: number;
  };
  /** Affirmative "why it works" statements, in plain language (narrative-first report). */
  positives: ReportItem[];
  /** Couples réellement `allowed` — jamais un `confirmation_required` (il irait dans `to_confirm`). */
  compatible: { airline_id: string; placement: string }[];
  conditions: ReportItem[];
  warnings: ReportItem[];
  risks: ReportItem[];
  alternatives: ReportItem[];
  confidence: number; // 1..5, derived from cited sources
  sources: { url: string }[];
  partners: PartnerRef[]; // contextual suggestions (recommendation-first) — may be empty
  generated_at: string;
}
