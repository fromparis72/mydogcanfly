import type { NormalizedKB, Rule, Predicate, Condition, EvalContextShape, PlacementPolicy, PlacementStatus, TemperatureProvenance, BreedRestriction } from "@mydogcanfly/knowledge";
import { MONTH_UNKNOWN, isEstimatedTemperature, preuveAuditee } from "@mydogcanfly/knowledge";
import type { FinderRequest, Decision, AirlineDecision, FiredRule, ConfirmationCause, RestrictionEvidence, AdvisorySignal } from "./contracts";
import { makePlacementDecision, makePlacementDecisionSet } from "./contracts";

type Ctx = Record<string, string | number | boolean>;
const PLACEMENTS = ["cabin", "hold", "cargo"] as const;

// Great-circle distance (km) — used by the connection-plausibility ("maximum permitted detour") filter.
function greatCircleKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

function evalCondition(c: Condition, ctx: Ctx): boolean {
  const left = ctx[c.fact];
  const v = c.value as string | number | boolean | Array<string | number>;
  switch (c.op) {
    case "eq": return left === v;
    case "neq": return left !== v;
    case "in": return Array.isArray(v) && v.includes(left as string | number);
    case "nin": return Array.isArray(v) && !v.includes(left as string | number);
    case "gt": return typeof left === "number" && typeof v === "number" && left > v;
    case "gte": return typeof left === "number" && typeof v === "number" && left >= v;
    case "lt": return typeof left === "number" && typeof v === "number" && left < v;
    case "lte": return typeof left === "number" && typeof v === "number" && left <= v;
    default: return false;
  }
}

function evalPredicate(p: Predicate, ctx: Ctx): boolean {
  if ("all" in p) return p.all.every((q) => evalPredicate(q, ctx));
  if ("any" in p) return p.any.some((q) => evalPredicate(q, ctx));
  if ("not" in p) return !evalPredicate(p.not, ctx);
  return evalCondition(p as Condition, ctx);
}

// Coarse seasonal climate model: estimate a peak temperature from the destination region and travel month,
// so users never have to guess a temperature months ahead (the heat embargo becomes automatic).
const CLIMATE: Record<string, { hemi: "N" | "S"; summer: number; winter: number }> = {
  "Middle East": { hemi: "N", summer: 42, winter: 22 },
  "Africa": { hemi: "N", summer: 35, winter: 24 },
  "Asia": { hemi: "N", summer: 34, winter: 16 },
  "Europe": { hemi: "N", summer: 28, winter: 6 },
  "European Union / Schengen": { hemi: "N", summer: 28, winter: 6 },
  "North America": { hemi: "N", summer: 30, winter: 4 },
  "Central America": { hemi: "N", summer: 33, winter: 27 },
  "Caribbean": { hemi: "N", summer: 32, winter: 26 },
  "South America": { hemi: "S", summer: 32, winter: 17 },
  "Oceania": { hemi: "S", summer: 32, winter: 15 },
};
function estimateTempC(region: string | undefined, month: number | undefined): number | undefined {
  if (!region || !month) return undefined;
  const c = CLIMATE[region] ?? { hemi: "N" as const, summer: 30, winter: 12 };
  const peak = c.hemi === "S" ? 1 : 7; // Jan (south) / Jul (north)
  const dist = Math.min(Math.abs(month - peak), 12 - Math.abs(month - peak)); // 0..6
  return Math.round(c.summer - (c.summer - c.winter) * (dist / 6));
}

// "Possible but unconfirmed" heat: the seasonal AVERAGE stays under the embargo threshold, yet in temperate
// regions (Europe, North America) climate-change heat waves regularly spike above it during the two peak
// summer months. We flag the risk WITHOUT denying any placement (that stays a rules/temperature decision).
const HEAT_RISK_MIN_SUMMER_C = 27; // region must be warm enough to plausibly exceed 30 °C in a heat wave
function heatRiskSeason(region: string | undefined, month: number | undefined, temperature_c: number): boolean {
  if (!month || temperature_c > 30) return false; // no date, or already a confirmed embargo
  const c = CLIMATE[region ?? ""] ?? { hemi: "N" as const, summer: 30, winter: 12 };
  if (c.summer < HEAT_RISK_MIN_SUMMER_C) return false;
  const peak = c.hemi === "S" ? 1 : 7;
  const next = (peak % 12) + 1; // the month after the peak: {Jul,Aug} north / {Jan,Feb} south
  return month === peak || month === next;
}

/* Traduction d'une catégorie de règle en motif de refus affichable.
   POURQUOI : jusqu'ici l'interface déduisait le motif d'un raisonnement en creux — « la compagnie
   prend des animaux mais aucun mode n'est accepté, donc c'est la race ». C'était faux trois fois
   sur trois (Delta, JetBlue, Brussels refusent un golden de 30 kg pour son POIDS, ou parce qu'ils
   ne proposent ni soute ni fret). Le motif se lit sur la règle qui a refusé : sa catégorie et les
   placements qu'elle vise sont des données, pas une interprétation. Une catégorie inconnue ne
   produit AUCUN motif — mieux vaut un libellé neutre qu'un motif inventé. */
const REASON_BY_CATEGORY: Record<string, string> = {
  breed_ban: "breed_restricted",
  cabin_weight: "weight_limit",
  hold_weight: "weight_limit",
};
/** Ordre d'affichage : d'abord ce qui tient au chien, ensuite ce que la compagnie ne propose pas. */
const REASON_ORDER = ["breed_restricted", "weight_limit", "cabin_unavailable", "hold_unavailable", "cargo_unavailable"];
function denyReasonsOf(perPlacement: { placement: string; fires: Rule[]; breedDeny?: boolean }[]): string[] {
  const found = new Set<string>();
  for (const { breedDeny } of perPlacement) {
    /* Un refus prononcé par une RESTRICTION DE RACE porte le même motif qu'un refus prononcé par
       une règle `breed_ban` : le visiteur lit pourquoi son chien est refusé, pas quel objet du
       référentiel l'a décidé. Sans cette ligne, une compagnie refusant la soute sur un fait de
       race audité afficherait un refus sans motif. */
    if (breedDeny) found.add("breed_restricted");
  }
  for (const { placement, fires } of perPlacement) {
    for (const r of fires) {
      if (r.effect.action !== "deny") continue;
      if (r.effect.placement && !(r.effect.placement as string[]).includes(placement)) continue;
      // L'embargo chaleur est déjà porté par son propre bandeau, et il est temporaire : le
      // ranger parmi les motifs de refus laisserait croire à une incompatibilité de fond.
      if (r.category === "summer_embargo") continue;
      const code = REASON_BY_CATEGORY[r.category] ?? (r.category === "placement" ? `${placement}_unavailable` : undefined);
      if (code) found.add(code);
    }
  }
  return REASON_ORDER.filter((c) => found.has(c));
}

/* ---- LES FAITS DE RACE — option H (T0-B3-a, arbitrage du 16/08/2026) --------------------------
 *
 * Le moteur ne savait pas produire une confirmation DONT LA CAUSE EST LA RACE : après retrait
 * d'une règle de race, il reprenait la politique générale du canal — tantôt `allowed`, tantôt
 * `confirmation_required` — sans jamais rattacher l'incertitude au chien qui la motive. C'est ce
 * que ce bloc répare, en consommant le registre canonique `BreedRestriction`.
 *
 * Deux principes, tenus par le code plutôt que par la discipline :
 *
 *   · `warn` N'AGIT SUR RIEN — ni statut, ni score, ni `fired`, ni preuve. Il ne produit qu'un
 *     avis. C'est le cas fondateur : l'IATA écrit « not recommended … in hot season », et en avoir
 *     fait un refus est ce qui a produit une interdiction universelle et permanente.
 *   · AUCUNE PRIORITÉ N'EST INVENTÉE. `allow` + `deny` est une contradiction, `deny` + `require`
 *     une exigence inatteignable : `validateBreedRestrictions()` les refuse AU CHARGEMENT, si bien
 *     qu'aucune résolution n'a à exister ici. Reste `allow` + `require`, que le validateur
 *     autorise : l'exigence l'emporte, puisqu'elle décrit ce qu'il faut satisfaire pour que
 *     l'autorisation vaille.
 */

/** Le chien tel que les restrictions le voient : son identité de race et le trait effectif. */
type DogForBreed = { breed_id?: string; brachycephalic: boolean };

const breedTargetHits = (t: BreedRestriction["applies_to"], dog: DogForBreed): boolean =>
  "trait" in t
    ? t.trait === "brachycephalic" && dog.brachycephalic
    : dog.breed_id !== undefined && t.breed_ids.includes(dog.breed_id);

/**
 * Les restrictions qui portent réellement sur (ce chien, cette compagnie, ce canal).
 *
 * `when` est ÉVALUÉ, avec l'évaluateur du moteur et le contexte du scénario. La simulation, elle,
 * refusait de le faire et signalait les restrictions conditionnelles comme « non simulables » :
 * elle n'avait pas d'évaluateur. Le moteur en a un — s'en priver inventerait une limitation, et
 * une condition ignorée en silence est exactement le défaut que ce chantier corrige.
 */
function breedRestrictionsFor(
  kb: NormalizedKB, airlineId: string, placement: (typeof PLACEMENTS)[number], dog: DogForBreed, ctx: Ctx,
): BreedRestriction[] {
  return kb.breedRestrictions.filter((r) =>
    (r.airline_id === undefined || r.airline_id === airlineId) &&
    (r.placements as string[]).includes(placement) &&
    breedTargetHits(r.applies_to, dog) &&
    (r.when === undefined || evalPredicate(r.when as Predicate, ctx)));
}

/** Ordre total et stable sur les restrictions : leur identité. `find()` en perdait toutes sauf une. */
const byRestrictionId = (a: BreedRestriction, b: BreedRestriction) => a.id.localeCompare(b.id);

/**
 * LE PÉRIMÈTRE DE « NOUS NE SAVONS PAS ».
 *
 * Les branches décisives — `deny`, `require`, `allow` — s'appliquent aux TROIS canaux et à TOUT
 * chien visé : c'est le contrat, et une restriction qui déclare `cabin` doit agir en cabine, sinon
 * le registre ment.
 *
 * La branche « aucun fait audité → à confirmer » est bornée, elle, aux chiens BRACHYCÉPHALES en
 * soute et en fret. Ce n'est pas une commodité : c'est exactement le périmètre où le site affirmait
 * un refus qu'il ne peut pas prouver (les 42 règles de T0-B3-a). Étendre « nous ne savons pas » à
 * toutes les races et à la cabine publierait une ignorance que nous n'avons jamais affirmée, sur
 * des canaux où rien n'a été mesuré — ce serait une décision distincte, à mesurer avant, pas un
 * effet de bord de ce câblage.
 */
const PERIMETRE_INCERTITUDE_RACE = ["hold", "cargo"] as const;

type BreedOutcome = {
  status: PlacementStatus;
  causes: ConfirmationCause[];
  evidence?: RestrictionEvidence[];
  /** Transmise telle quelle à `makePlacementDecision`, qui la réduit aux quatre champs du contrat
   *  — la projeter ici recréerait un second chemin de réduction à maintenir en parallèle. */
  source?: unknown;
  denied_by_breed: boolean;
};

/**
 * La table de décision, appliquée APRÈS le statut de base du canal. Elle ne l'ouvre jamais :
 * un canal structurellement fermé le reste, parce qu'un fait de race ne crée pas une soute.
 */
function applyBreedRestrictions(args: {
  restrictions: BreedRestriction[];
  policyRef: string;
  placement: (typeof PLACEMENTS)[number];
  dog: DogForBreed;
  baseStatus: PlacementStatus;
  baseCauses: ConfirmationCause[];
  baseSource?: unknown;
}): BreedOutcome {
  const { restrictions, policyRef, placement, dog, baseStatus, baseCauses, baseSource } = args;
  const inchange: BreedOutcome = { status: baseStatus, causes: baseCauses, source: baseSource, denied_by_breed: false };
  /* Canal structurellement fermé : H n'ouvre rien. */
  if (baseStatus === "denied") return inchange;

  const parAction = (a: BreedRestriction["action"]) => restrictions.filter((r) => r.action === a).sort(byRestrictionId);
  const denies = parAction("deny"), requires = parAction("require"), allows = parAction("allow");
  /* La preuve DESCEND avec la décision : quand une restriction tranche, c'est SA page qui justifie
     le canal, pas la provenance générale préexistante — laquelle ne documente pas la race. */
  const preuves = (rs: BreedRestriction[], role: RestrictionEvidence["role"]): RestrictionEvidence[] =>
    rs.map((r) => ({ restriction_ref: r.id, role, source: r.source }));
  if (denies.length) {
    /* Dominance : un refus éteint les causes de confirmation du canal, comme un refus dur de règle. */
    return { status: "denied", causes: [], evidence: preuves(denies, "refusal"), source: denies[0].source, denied_by_breed: true };
  }
  if (requires.length) {
    return {
      status: "confirmation_required",
      causes: [...baseCauses, ...requires.map((r): ConfirmationCause => ({
        code: "breed_requirement", policy_ref: policyRef, restriction_ref: r.id,
      }))],
      evidence: preuves(requires, "requirement"), source: requires[0].source, denied_by_breed: false,
    };
  }
  if (allows.length) {
    return { status: baseStatus, causes: baseCauses, evidence: preuves(allows, "authorisation"), source: allows[0].source, denied_by_breed: false };
  }
  if (dog.brachycephalic && (PERIMETRE_INCERTITUDE_RACE as readonly string[]).includes(placement)) {
    /* Notre incertitude, dite comme telle. AUCUNE preuve ne l'accompagne — une absence de fait n'en
       a pas — et la source du canal reste celle de la politique, qui ne documente pas la race. */
    return {
      status: "confirmation_required",
      causes: [...baseCauses, { code: "breed_policy_unreviewed", policy_ref: policyRef }],
      source: baseSource, denied_by_breed: false,
    };
  }
  return inchange;
}

function toFired(r: Rule, locale: string): FiredRule {
  return {
    rule_id: r.id, action: r.effect.action, category: r.category, criticality: r.criticality,
    rationale: r.rationale_i18n?.[locale] ?? r.rationale, // localized where available, else EN
    source_url: r.source.url, confidence: r.source.confidence, params: r.params,
  };
}

/* `PolicyMode` A ÉTÉ SUPPRIMÉ (contre-revue du 15/08/2026).
 *
 * C'était une redéclaration à la main de la politique runtime — `{ status?, status_cause?,
 * allowed?, fee?, source? }` — accompagnée d'un cast à la lecture. Elle a dérivé aussitôt qu'on
 * y a touché : le champ ajouté pour `preuveAuditee` s'appelait `derived_from_fiche` alors que la
 * donnée lue s'appelle `source_derived`. Le code fonctionnait — l'objet JavaScript porte bien la
 * propriété à l'exécution — mais plus aucun type ne protégeait cette donnée. C'est le trou exact
 * par lequel `brachy_allowed`, `season.month`, `conditional` et `derived_from_fiche` avaient
 * disparu en silence ; le rouvrir ici aurait été le rouvrir au dernier endroit qui décide.
 *
 * Ce fichier lit désormais `PlacementPolicy` — l'union discriminée produite par
 * `projectPlacementPolicy`, la seule définition. Un champ qui n'y figure pas ne se lit pas, et un
 * champ qu'elle gagne arrive ici sans qu'on ait à y penser. */

/* Fiche = socle systématique (décision utilisateur, 10/08/2026 — bug signalé sur La Compagnie EWR→ORY,
   32 kg : la fiche dit cabine oui/soute non/fret inconnu, le Finder répondait "soute uniquement"). Deux
   défauts cumulés, désormais corrigés ensemble :
   1) AVANT, ce repli ne jouait QUE si `airlineOwnRules.length === 0` — dès qu'une compagnie avait ne
      serait-ce qu'UNE règle propre, même sans rapport (ex. La Compagnie n'a qu'une règle "soute refusée
      vers le Royaume-Uni"), le repli se désactivait EN BLOC pour tous les placements et tous les
      trajets. Une restriction générale de la fiche (soute non proposée, partout) redevenait "allowed"
      sur tout trajet hors Royaume-Uni. Mesuré à la levée de cette condition : 18 compagnies sur 102,
      26 couples (compagnie, placement) concernés — la liste complète est tracée dans l'historique de
      cette fonction et dans le rapport livré à l'utilisateur (audit du 09-10/08/2026).
   2) Le test `=== false` ignorait aussi les placements que la fiche ne renseigne simplement pas encore
      (clé absente dans `premium.policy`, ni true ni false) : 14 cas sur 102 compagnies × 3 placements,
      ex. Qantas dont la fiche structurée n'a que `cabin: false`, ni soute ni fret. Une donnée absente
      redevenait "allowed" au lieu de rester "inconnue".
   Nouvelle règle, unique et sans exception : la fiche est désormais TOUJOURS le socle, que la compagnie
   ait ou non des règles rules.json propres. `allowed === true` → option potentielle, que les règles
   peuvent encore restreindre. `allowed === false` OU absent (« inconnu ») → refusé par défaut, jamais
   montré comme disponible sans confirmation positive. Les règles rules.json ne peuvent plus qu'AJOUTER
   une restriction, jamais lever celle que documente la fiche — exactement l'inverse de l'ancien
   comportement où la présence d'UNE règle, quel que soit son objet, levait TOUTES les restrictions
   fiche. `premium.policy.<mode>.allowed` reste dérivé et sourcé par derivePolicy() dans
   ingest-airlines.mjs à partir de la fiche elle-même — on n'invente aucune donnée nouvelle. Catégorie
   "placement" : denyReasonsOf() la traduit en "<mode>_unavailable", exactement le motif qu'aurait porté
   une vraie règle rules.json. */
function policyFallbackDenyRule(airlineId: string, placement: (typeof PLACEMENTS)[number], mode: PlacementPolicy | undefined): Rule {
  /* `mode` peut être ABSENT : c'est précisément le cas « la fiche ne décide pas ce canal », que
     cette règle de repli existe pour refuser. La provenance neutre ci-dessous le dit. */
  const source: Rule["source"] = mode?.source ?? {
    url: "", source_type: "other", verified_date: "1970-01-01", review_due: "1970-01-01",
    confidence: 1, reviewer: "unknown", history: [],
  };
  const label = { cabin: "cabin", hold: "hold", cargo: "cargo" } as const;
  const labelFr = { cabin: "cabine", hold: "soute", cargo: "fret" } as const;
  const labelEs = { cabin: "cabina", hold: "bodega", cargo: "carga" } as const;
  const labelPt = { cabin: "cabine", hold: "porão", cargo: "carga" } as const;
  return {
    id: `rule_fallback_policy_${airlineId}_${placement}`,
    scope: { type: "airline", id: airlineId },
    category: "placement",
    criticality: "high",
    applies_when: { all: [] },
    effect: { action: "deny", placement: [placement] },
    params: {},
    rationale: `No documented ${label[placement]} option per the airline's own published policy.`,
    rationale_i18n: {
      fr: `Aucune option ${labelFr[placement]} documentée dans la politique officielle de la compagnie.`,
      es: `Ninguna opción de ${labelEs[placement]} documentada en la política oficial de la aerolínea.`,
      pt: `Nenhuma opção de ${labelPt[placement]} documentada na política oficial da companhia.`,
    },
    source,
  };
}

/**
 * Decision Engine (ADR-0013): pure evaluation of the normalized knowledge base against a request.
 * No narration, no localization — that is the Explanation Engine's job.
 */
/**
 * @param opts.weatherProvenance Étiquette INTERNE posée par l'appelant serveur quand `req.weather`
 *   porte une température qui n'a PAS été saisie par un visiteur — aujourd'hui, uniquement
 *   `destinations.ts` avec son estimation par latitude. Jamais dérivée du payload : un client ne
 *   peut pas la fournir (le champ n'existe pas dans `FinderRequest`, qui est `strict()`).
 */
export function evaluate(kb: NormalizedKB, req: FinderRequest, opts?: { weatherProvenance?: "estimated_latitude"; legacyCarriesWitness?: boolean }): Decision {
  const dest = kb.airports.get(req.destination);
  const origin = kb.airports.get(req.origin);
  const destCountry = dest?.country_id ?? "";
  const originCountry = origin?.country_id ?? "";
  const destCountryObj = kb.countries.get(destCountry);
  const destCountryName =
    (destCountryObj?.name as Record<string, string> | undefined)?.[req.locale] ??
    (destCountryObj?.name as Record<string, string> | undefined)?.en ??
    destCountry;
  const breed = req.dog.breed_id ? kb.breeds.get(req.dog.breed_id) : undefined;
  const weight = req.dog.weight_kg ?? breed?.weight_kg ?? 0;
  const brachy = req.dog.brachycephalic ?? breed?.brachycephalic ?? false;

  // Seasonal temperature: explicit wins; otherwise estimate from travel month + destination climate; else a mild default.
  const month = req.date ? parseInt(req.date.slice(5, 7), 10) : undefined;
  const estimatedTemp = estimateTempC(destCountryObj?.region, month);
  const temperature_c = req.weather?.temperature_c ?? estimatedTemp ?? 20;
  /* Provenance posée ICI, côté serveur — jamais lue du payload. Une valeur entrante est celle du
     visiteur, sauf si un appelant interne (destinations.ts) déclare sa propre estimation. */
  const provenance: TemperatureProvenance =
    req.weather?.temperature_c != null ? (opts?.weatherProvenance ?? "visitor_input") : "estimated_region";
  /* Une température estimée ne peut plus produire un refus dur (P0 climat, 13/08/2026) :
     les règles `summer_embargo` déclenchées sous estimation produisent `confirmation_required`. */
  const tempIsEstimated = isEstimatedTemperature(provenance);
  const climate = {
    temperature_c,
    provenance,
    /* `estimated` DÉRIVE de la provenance — une seule source de vérité. La v1 le calculait à part
       (« pas de météo dans la requête ») : une température injectée par destinations.ts ressortait
       `estimated: false` avec une provenance `estimated_latitude`, deux champs qui se
       contredisaient. Et une future température `sourced` n'est PAS une estimation :
       `isEstimatedTemperature` ne regarde que le préfixe `estimated_`. */
    estimated: isEstimatedTemperature(provenance) && (req.weather?.temperature_c != null || estimatedTemp != null),
    provided: req.weather?.temperature_c != null || estimatedTemp != null,
    month,
    risk: heatRiskSeason(destCountryObj?.region, month, temperature_c),
  };

  // PARITÉ CONTRAT / MOTEUR, vérifiée à la COMPILATION (lot P0-A, 12/08/2026).
  //
  // `EvalContextShape` est dérivé du registre `FACT_TYPES` de `breed-restrictions.ts`. Typer
  // `baseCtx` avec lui rend les deux erreurs symétriques impossibles : un fait injecté ici sans
  // être ouvert au contrat déclenche le contrôle de propriétés excédentaires, et un fait ouvert
  // au contrat sans être injecté ici manque à l'objet. `placement` est exclu parce qu'il est le
  // seul à varier À L'INTÉRIEUR d'une évaluation : il est ajouté par canal, quelques lignes plus
  // bas, dans `{ ...baseCtx, placement: p }`.
  //
  // Remplace une vérification qui lisait ce fichier à l'expression régulière — laquelle avait
  // d'ailleurs oublié `placement` dès sa première exécution.
  const baseCtx: Omit<EvalContextShape, "placement"> = {
    "dog.weight_kg": weight,
    "dog.brachycephalic": brachy,
    "dog.size": breed?.size ?? "medium",
    "dog.breed_id": req.dog.breed_id ?? "",
    "travel_type": req.travel_type,
    "route.dest_country_id": destCountry,
    "route.origin_country_id": originCountry,
    "route.dest_airport_id": req.destination,
    "weather.temperature_c": temperature_c,
    // Situation du chien, déclarée dans le formulaire : "yes" il vit dans l'UE, "no" il la découvre.
    // Sans réponse → chaîne vide, volontairement DIFFÉRENTE de "no" : les règles de retour vers l'UE
    // testent `in ["yes","unknown",""]` d'un côté et `in ["no","unknown",""]` de l'autre, si bien
    // qu'une absence de réponse fait sortir LES DEUX parcours. On n'impose jamais le certificat
    // sanitaire par défaut d'information. (Le "unknown" listé par les règles n'est plus produit
    // depuis que le formulaire n'a que deux options ; il y reste sans nuire, l'absence le remplace.)
    /* Mois du voyage — 1 à 12, ou MONTH_UNKNOWN (0) si le voyageur n'a pas donné de date.
       Le fait figurait dans l'énumération `Fact` sans jamais être injecté : toute condition sur
       le mois était donc inerte. L'injecter est NEUTRE pour les verdicts — aucune des 449 règles
       actuelles ne l'utilise (vérifié le 12/08/2026) — et c'est la seule façon d'exprimer une
       politique de fenêtre calendaire, comme une politique de fenêtre calendaire. Le
       contrat interdit les conditions négatives sur ce fait, pour qu'une date inconnue ne puisse
       jamais fermer un canal. */
    "season.month": month ?? MONTH_UNKNOWN,
    "docs.eu_passport": req.eu_passport ?? "",
  };

  // A domestic flight crosses no border, so the destination country's IMPORT rules simply do not apply
  // (no passport, no rabies titer, no entry certificate). Same-country special regimes — Hawaii, Guyane… —
  // are surfaced separately from the country's `domestic` data, not from these import rules.
  const isDomestic = !!originCountry && originCountry === destCountry;
  const countryRequirements = isDomestic ? [] : kb.rules
    .filter((r) => r.scope.type === "country" && r.scope.id === destCountry)
    .filter((r) => evalPredicate(r.applies_when, baseCtx))
    .map((r) => toFired(r, req.locale));

  // Origin/destination airport SETS — a city search (e.g. Paris = CDG + ORY) passes several; a single airport
  // falls back to [origin]/[destination]. An airline is a candidate if it reaches ANY origin airport AND ANY
  // destination airport (broadening the results across a city's airports).
  const originSet = req.origins && req.origins.length ? req.origins : [req.origin];
  const destSet = req.destinations && req.destinations.length ? req.destinations : [req.destination];
  const pairKeys = new Set<string>();
  for (const o of originSet) for (const d of destSet) pairKeys.add([o, d].sort().join("|"));

  // Candidate airlines. Route-aware when we have the route graph: the airline must actually reach an origin
  // AND a destination airport. Airlines without route data fall back to the coarser country-level rule.
  const airlines = [...kb.airlines.values()].filter((a) => {
    const served = a.served_airport_ids;
    return served && served.length
      ? originSet.some((o) => served.includes(o)) && destSet.some((d) => served.includes(d))
      : a.serves_country_ids.includes(destCountry);
  });

  /* Le chien tel que le registre de race le voit, et les avis levés au fil de l'évaluation.
     Les avis sont COLLECTÉS ici, un par (restriction, canal) : la déduplication par (restriction,
     portée) et le choix de la langue appartiennent à `explain`, qui seul connaît la langue du
     rapport. */
  const dogForBreed: DogForBreed = { breed_id: req.dog.breed_id, brachycephalic: brachy };
  const advisories: AdvisorySignal[] = [];

  // Global rules (e.g. the universal cabin size/weight backstop) apply to every airline.
  const globalRules = kb.rules.filter((r) => r.scope.type === "global");
  const airlineDecisionsRaw = airlines.map((a): AirlineDecision & { _plausible: boolean } => {
    const airlineOwnRules = kb.rules.filter((r) => r.scope.type === "airline" && r.scope.id === a.id);
    const airlineRules = [...airlineOwnRules, ...globalRules];
    // Fiche-derived policy (see policyFallbackDenyRule above) — désormais le socle systématique pour
    // TOUTE compagnie, pas seulement celles sans règle rules.json propre (voir le commentaire détaillé
    // au-dessus de policyFallbackDenyRule).
    const policy = a.premium?.policy;
    // Evaluate ALL placements (cabin/hold/cargo) so the comparison cards are complete;
    // the requested placement is applied later, when computing the headline verdict.
    const perPlacement = PLACEMENTS.map((p) => {
      // Typé avec la forme COMPLÈTE du contrat : c'est ici que `placement` est couvert par la
      // parité compilateur. Le typage de `baseCtx` seul l'excluait — retirer `placement` du
      // registre laissait `typecheck` vert, défaut relevé en revue le 12/08/2026.
      const ctx: EvalContextShape = { ...baseCtx, placement: p };
      const fires = airlineRules.filter((r) => evalPredicate(r.applies_when, ctx));
      const denyFires = fires.filter(
        (r) => r.effect.action === "deny" && (!r.effect.placement || r.effect.placement.includes(p)),
      );
      /* TRI-STATE (P0 climat). L'ordre de dominance est celui du contrat :
           denied  >  confirmation_required  >  allowed.
         Seul l'embargo chaleur (`summer_embargo`) déclenché sur une température ESTIMÉE est
         dégradé en `confirmation_required` : toute autre règle deny — race, poids, politique —
         reste un refus, et le socle fiche (`policyFallbackDenyRule`) aussi. Une compagnie dont la
         fiche ne documente aucune soute n'a pas une soute « à confirmer », elle n'en a pas. */
      const hardDenies = denyFires.filter((r) => r.category !== "summer_embargo");
      const climateDenies = denyFires.filter((r) => r.category === "summer_embargo");
      let allFires = fires;
      const pol = policy?.[p];
      /* T0-A : le statut de la POLITIQUE runtime est la vérité du socle fiche ; `allowed` n'est
         plus lu. Dominance intra-compagnie : denied > confirmation_required > allowed — un refus
         dur ÉTEINT les causes de confirmation du canal (les règles restent dans `fired` pour
         l'audit). Un embargo sur température FOURNIE reste un refus, comme avant. */
      let status: PlacementStatus;
      const causes: ConfirmationCause[] = [];
      if (hardDenies.length > 0) {
        status = "denied";
      } else if (pol?.status !== "allowed" && pol?.status !== "confirmation_required") {
        // Socle fiche systématique (corrigé 10/08/2026) : un statut `denied` explicite ou une clé
        // absente (« inconnu ») sont traités pareil, refusés par défaut, quel que soit le nombre
        // de règles propres à la compagnie par ailleurs.
        status = "denied";
        allFires = [...fires, policyFallbackDenyRule(a.id, p, pol)];
      } else if (climateDenies.length > 0 && !tempIsEstimated) {
        status = "denied";
      } else {
        /* Ici, plus aucun refus ne domine : les causes de confirmation s'accumulent — politique
           ET climat peuvent coexister sur le même canal (matrice T0-A, cas 4), aucune ne masque
           l'autre. */
        if (pol.status === "confirmation_required") {
          /* La cause est GARANTIE par l'union runtime (`status_cause` obligatoire sur cette
             branche) — le moteur n'en fabrique JAMAIS (contre-revue v1, P0-1 : le repli
             `?? "policy_unpublished"` inventait une cause sur une politique mal formée).
             Une violation est un bug de construction : échec franc, pas une invention. */
          if (!pol.status_cause) throw new Error(`politique ${a.id}#${p} à confirmer SANS cause — schéma runtime violé`);
          causes.push({ code: pol.status_cause, policy_ref: `${a.id}#${p}` });
        }
        if (climateDenies.length > 0) {
          // tempIsEstimated garanti par la branche précédente : cause climatique ACTIVE au sens
          // exact de la contre-revue (règle déclenchée + estimée + non dominée + statut final).
          for (const r of climateDenies) causes.push({ code: "estimated_climate", rule_id: r.id });
        }
        status = causes.length > 0 ? "confirmation_required" : "allowed";
      }
      /* ---- LES FAITS DE RACE ---------------------------------------------------------------
         Appliqués APRÈS le statut de base, et jamais dans l'autre sens : ils ne créent pas de
         canal, ils qualifient celui qui existe. Les avis `warn` se collectent sur les TROIS
         canaux, indépendamment de la table de statut — l'avis IATA porte aussi sur la cabine,
         qu'aucune décision de race ne touche, et confondre les deux questions supprimait l'avis
         en même temps que le statut (défaut relevé en simulation). */
      const restrictions = breedRestrictionsFor(kb, a.id, p, dogForBreed, ctx);
      for (const r of restrictions) {
        if (r.action !== "warn") continue;
        if (!r.detail) continue; // le contrat l'impose déjà sur `warn` ; ceci ne fait que le typer
        advisories.push({ restriction_ref: r.id, scope: r.airline_id ?? "global",
          placements: [p], detail: r.detail, source: r.source });
      }
      const race = applyBreedRestrictions({
        restrictions, policyRef: `${a.id}#${p}`, placement: p, dog: dogForBreed,
        baseStatus: status, baseCauses: causes, baseSource: preuveAuditee(pol),
      });
      /* La preuve descend AVEC la décision : la source de CE canal, et seulement si elle en est
         une (ni dérivée, ni auto-citation, ni posée sur une politique non revérifiée). La source
         racine de la fiche ne descend jamais ici — c'est elle que le contre-test a vue s'afficher
         comme justification d'une politique qu'elle ne documente pas. */
      return {
        decision: makePlacementDecision(p, race.status, race.causes, race.source, race.evidence),
        fires: allFires, breedDeny: race.denied_by_breed,
      };
    });
    /* Le triplet complet est validé — exactement {cabin, hold, cargo}, ni absence ni doublon. */
    const placementDecisions = makePlacementDecisionSet(perPlacement.map((x) => x.decision));
    // Does this airline carry pets at all, structurally? Re-evaluate with a neutral small non-brachy dog:
    // a low-cost that never carries pets stays false; an airline that takes pets but rules THIS dog out
    // (e.g. a snub-nosed breed → hold/cargo denied) is true. Lets the UI say "breed not accepted" vs "no pets".
    // "dog.breed_id" neutralisé aussi (audit du 09/08/2026) : sans ça, une race interdite (BSL) mais
    // testée par une future règle AIRLINE/GLOBAL (aujourd'hui seules des règles PAYS testent
    // breed_id, donc ce cas n'existe pas encore dans rules.json — vérifié) ferait passer
    // `carries_pets` à false pour une compagnie qui transporte pourtant des animaux normalement :
    // exactement la confusion "aucun animal transporté" vs "CE chien refusé" que ce bloc neutre a
    // été conçu pour éviter.
    // Même socle fiche systématique que perPlacement ci-dessus (corrigé 10/08/2026, ex-angle mort
    // devenu bug confirmé : Batik Air Indonesia/Malaysia, fiche 100% "non proposé" sur les 3
    // placements, ne portent qu'une règle UK — `carries_pets` ressortait quand même "true" hors
    // Royaume-Uni). `allowed === true` sur AU MOINS un placement est désormais requis pour dire que
    // la compagnie transporte des animaux ; un "false" ou une clé absente ne compte plus comme "true".
    /* T0-A — CORRECTION CONTRÔLÉE (diff versionné : test-baselines/t0a-carries-pets-diff.json).
       L'ancien calcul appliquait les règles du TRAJET et du climat à un « chien neutre », alors
       que le champ prétend décrire un attribut structurel de la compagnie : sur CDG→LHR,
       Eurowings, ITA et Vueling ressortaient « Animaux refusés » (mesure Codex du 14/08 :
       258 cartes sur 23 648, 8 compagnies, toutes false→true). La vérité canonique est
       désormais STRUCTURELLE : ≥1 canal dont la POLITIQUE (après projection) est `allowed` ou
       `confirmation_required` — sans règles de route, sans climat. Une estimation climatique ne
       peut jamais produire « aucun animal transporté » ; une compagnie fermée sur les trois
       canaux reste false. `carries_pets` devient la projection legacy de cette vérité unique. */
    const offers_pet_transport = PLACEMENTS.some(
      (p) => policy?.[p]?.status === "allowed" || policy?.[p]?.status === "confirmation_required",
    );
    const carries_pets = offers_pet_transport;
    /* TÉMOIN DE TRANSITION (à retirer avec test-baselines/t0a-carries-pets-diff.json une fois
       la migration digérée) : l'ANCIEN calcul, verbatim — chien neutre, règles du trajet et du
       climat appliquées. Jamais exposé au public (retiré par explain) ; il n'existe que pour
       que la CI RECALCULE l'écart exhaustif ancien/nouveau au lieu de croire un fichier
       (contre-revue v1, P0-2 : « une mesure recalculée devient une barrière »). */
    const neutralCtx: Ctx = { ...baseCtx, "dog.weight_kg": 5, "dog.brachycephalic": false, "dog.size": "small", "dog.breed_id": "" };
    const _legacy_carries_pets = !opts?.legacyCarriesWitness ? undefined : PLACEMENTS.some((p) => {
      const nf = airlineRules.filter((r) => evalPredicate(r.applies_when, { ...neutralCtx, placement: p }));
      const deniedByRules = nf.some(
        (r) => r.effect.action === "deny" && (!r.effect.placement || r.effect.placement.includes(p)),
      );
      if (deniedByRules) return false;
      if (policy?.[p]?.allowed !== true) return false;
      return true;
    });

    const hubs = (a as { hub_airport_ids?: string[] }).hub_airport_ids ?? [];
    const served = a.served_airport_ids ?? [];
    /* Nonstop ATTESTÉ : la paire origine|destination figure dans le graphe de routes.
     *
     * Le repli par heuristique de hub ne s'applique QU'EN L'ABSENCE de graphe. Il ne peut plus
     * contredire un graphe présent — correctif P0 du 11/08/2026, arbitré avec Codex.
     *
     * Défaut corrigé : un second passage (plus bas dans cette fonction) repassait `direct = true`
     * dès qu'un hub se trouvait à l'une des extrémités, MÊME quand le graphe documenté ne
     * contenait pas la paire. Qantas ressortait ainsi « Direct » sur CDG→SYD au seul motif qu'elle
     * a un hub à Sydney — alors que ses 48 routes documentées ne comportent pas cette paire.
     * Mesuré à l'époque : 5 des 15 badges « Direct » de la matrice de référence étaient dans ce
     * cas, soit 33 %.
     *
     * Ce n'était pas qu'un mauvais libellé : `explain.ts` note la qualité de route à 0,8 pour
     * `direct_assumed` contre 0,7 pour une correspondance documentée — l'invention remontait donc
     * le score affiché.
     *
     * Les 102 compagnies ayant aujourd'hui un graphe, `direct_assumed` ne devrait plus jamais être
     * produit ; le contrat (contracts.ts) le réserve d'ailleurs au cas « pas de graphe de routes ».
     * L'état reste possible pour une future compagnie sans graphe, et l'UI est tenue de le
     * présenter comme non vérifié — jamais comme un « Direct ». Invariant couvert par
     * test-direct-claims.mjs. */
    const hasRouteGraph = !!(a.direct_routes && a.direct_routes.length);
    const direct_documented = !!(hasRouteGraph && a.direct_routes!.some((k) => pairKeys.has(k)));
    let direct = hasRouteGraph
      ? direct_documented
      : hubs.some((h) => originSet.includes(h) || destSet.includes(h));
    // Which endpoint airports the airline actually uses — surfaced only when they differ from the searched one
    // (city search), e.g. "from ORY" when Paris was searched and this airline flies out of Orly.
    const servedOrigins = originSet.filter((o) => served.includes(o));
    const servedDests = destSet.filter((d) => served.includes(d));
    const usedOrigin = servedOrigins.includes(req.origin) ? req.origin : servedOrigins[0];
    const usedDest = servedDests.includes(req.destination) ? req.destination : servedDests[0];
    const origin_airport_id = usedOrigin && usedOrigin !== req.origin ? usedOrigin : undefined;
    const destination_airport_id = usedDest && usedDest !== req.destination ? usedDest : undefined;
    // Connection plausibility — "maximum permitted detour". A non-direct airline is only kept when it
    // can route via one of ITS hubs without an absurd detour: origin → hub → dest must add no more than
    // max(1500 km, 50% of the direct distance). This kills nonsense like Paris→Barcelona via Mexico City.
    // A non-direct airline with no usable hub geometry can't justify an itinerary → dropped.
    const originId = usedOrigin ?? req.origin;
    const destId = usedDest ?? req.destination;
    const og = kb.airports.get(originId)?.geo;
    const dg = kb.airports.get(destId)?.geo;
    // Arêtes nonstop attestées de la compagnie (paires triées) — la seule chose qui permette de
    // distinguer un itinéraire établi d'un itinéraire déduit.
    const routeSet = new Set(a.direct_routes ?? []);
    const edge = (x: string, y: string) => routeSet.has([x, y].sort().join("|"));
    let connect_airport_id: string | undefined;
    let detour_km = 0;
    let plausible = true;
    let connection_documented = false;
    if (!direct) {
      /* Un point de correspondance doit être un aéroport véritablement intermédiaire, jamais un
       * aéroport des villes de départ ou d'arrivée — c'est ce que garantit `endpointSet` plus bas,
       * et c'est ce qui évite d'inventer une correspondance intra-ville (Air France « via ORY »
       * alors que Paris était cherché via CDG).
       *
       * SUPPRIMÉ le 11/08/2026 (correctif P0) : un `if (hubs.some((h) => endpointSet.has(h))) {
       * direct = true; }` se trouvait ici. Il visait le même souci d'intra-ville, mais par un moyen
       * bien trop large : il déclarait un vol direct sur la seule présence d'un hub à une extrémité,
       * sans aucune preuve de route — et il écrasait même la conclusion d'un graphe documenté. La
       * protection intra-ville, elle, est déjà entièrement assurée par `endpointSet` ci-dessous.
       *
       * Sans preuve de route, on ne conclut plus au direct : on cherche une correspondance
       * documentée, à défaut une correspondance plausible signalée non vérifiée, et si rien ne tient
       * l'itinéraire est écarté par les règles existantes. Jamais « Direct ». */
      const endpointSet = new Set<string>([...originSet, ...destSet]);
      if (og && dg) {
        const dOD = greatCircleKm(og, dg);
        // BUG corrigé (audit du 09/08/2026) : le commentaire ci-dessus documente depuis toujours
        // "max(1500 km, 50% de la distance directe)", mais le code utilisait 800 km — incohérence
        // présente dès le tout premier commit de ce filtre (confirmée via `git log -p`), donc pas
        // une régression récente : personne n'avait remarqué que code et commentaire divergeaient.
        // 800 km est le plus strict des deux ; en pratique, ça a fait écarter à tort des
        // correspondances plausibles sur des trajets courts/moyens (un détour de 900-1500 km sur un
        // vol direct de 1600 km passait le seuil documenté mais pas le seuil réellement appliqué).
        const cap = Math.max(1500, 0.5 * dOD);
        /* Deux passes, et la distinction est le cœur du sujet. Un hub est ÉTAYÉ quand les deux
           segments — origine→hub et hub→destination — figurent dans les arêtes nonstop de la
           compagnie. Sinon il n'est que géométriquement plausible : on ne sait pas si la
           compagnie relie l'origine à son hub. On préfère toujours un hub étayé, même plus long,
           à un hub déduit ; et on garde la trace de ce qui a été retenu. */
        const pick = (only: "documented" | "any") => {
          let bestExtra = Infinity, bestHub: string | undefined;
          for (const h of hubs) {
            if (endpointSet.has(h)) continue;            // never connect via an endpoint-city airport
            if (only === "documented" && !(edge(originId, h) && edge(h, destId))) continue;
            const hg = kb.airports.get(h)?.geo;
            if (!hg) continue;
            const extra = greatCircleKm(og, hg) + greatCircleKm(hg, dg) - dOD;
            if (extra < bestExtra) { bestExtra = extra; bestHub = h; }
          }
          return bestHub != null && bestExtra <= cap ? { hub: bestHub, extra: bestExtra } : undefined;
        };
        const documented = routeSet.size ? pick("documented") : undefined;
        const chosen = documented ?? pick("any");
        if (chosen) {
          connect_airport_id = chosen.hub;
          detour_km = Math.round(chosen.extra);
          connection_documented = documented != null;
        } else {
          plausible = false;
        }
      } else {
        plausible = false;
      }
    }
    const fired = dedupe(perPlacement.flatMap((x) => x.fires.map((r) => toFired(r, req.locale))));
    // Published fee for the primary accepted placement (cabin > hold > cargo), when the airline states one.
    // (`policy` was already computed above, before perPlacement — reused here, not redeclared.)
    const fees = (a as { fees?: Record<string, string | undefined> }).fees;
    const okPlacement = placementDecisions.find((x) => x.allowed)?.placement;
    const fee = okPlacement ? (policy?.[okPlacement]?.fee ?? fees?.[okPlacement]) : undefined;
    return {
      airline_id: a.id,
      airline_name: (a as { name?: string }).name ?? a.id,
      country_id: (a as { country_id?: string }).country_id,
      direct,
      carries_pets,
      _legacy_carries_pets,
      itinerary_confidence: direct
        ? (direct_documented ? "direct_documented" : "direct_assumed")
        : (connection_documented ? "connection_documented" : "connection_unverified"),
      deny_reasons: denyReasonsOf(perPlacement.map((x) => ({ placement: x.decision.placement, fires: x.fires }))),
      connect_airport_id,
      detour_km,
      fee,
      origin_airport_id,
      destination_airport_id,
      placements: placementDecisions,
      offers_pet_transport,
      fired,
      _plausible: plausible,
    };
  });
  // Drop connections whose only routing is an implausible detour (kept: direct + sensible connections).
  const airlineDecisions: AirlineDecision[] = airlineDecisionsRaw
    .filter((a) => a._plausible)
    .map(({ _plausible, ...rest }) => rest);

  const entry_allowed = !countryRequirements.some((f) => f.action === "deny");

  return {
    request: req,
    airlines: airlineDecisions,
    countryRequirements,
    destination: { country_id: destCountry, country_name: destCountryName, entry_allowed },
    origin_country_id: originCountry,
    domestic: isDomestic,
    brachycephalic: brachy,
    breed_advisories: advisories,
    climate,
  };
}

function dedupe(f: FiredRule[]): FiredRule[] {
  return [...new Map(f.map((x) => [x.rule_id, x])).values()];
}
