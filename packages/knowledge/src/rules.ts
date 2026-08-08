import { z } from "zod";
import { id, Placement, TravelType, RuleCategory, Criticality, Source } from "./common";

/**
 * Facts the evaluator reads from the evaluation context (ADR-0009).
 * Airline logic is never hardcoded — it is expressed as data over these facts.
 */
export const Fact = z.enum([
  "dog.brachycephalic", "dog.size", "dog.weight_kg", "dog.breed_id",
  "travel_type", "placement",
  "route.origin_country_id", "route.dest_country_id", "route.dest_airport_id",
  "season.month", "weather.temperature_c",
  // Documents que le voyageur détient DÉJÀ — pas l'origine du vol, pas le statut de l'animal.
  // "yes" | "no" | "unknown" | "" (question non posée ou sans réponse). Le vide et "unknown"
  // sont volontairement distincts de "no" : une règle qui impose un document ne doit jamais
  // se déclencher sur une absence de réponse (cf. les règles de retour vers l'UE).
  "docs.eu_passport",
]);
export type Fact = z.infer<typeof Fact>;

export const Op = z.enum(["eq", "neq", "in", "nin", "gt", "gte", "lt", "lte"]);
export type Op = z.infer<typeof Op>;

export const Condition = z.object({
  fact: Fact,
  op: Op,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]),
});
export type Condition = z.infer<typeof Condition>;

/** Recursive predicate grammar: all / any / not / leaf condition. Deliberately not a full DSL. */
export type Predicate =
  | { all: Predicate[] }
  | { any: Predicate[] }
  | { not: Predicate }
  | Condition;

export const Predicate: z.ZodType<Predicate> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(Predicate) }),
    z.object({ any: z.array(Predicate) }),
    z.object({ not: Predicate }),
    Condition,
  ]),
);

export const RuleEffect = z.object({
  action: z.enum(["allow", "deny", "require", "limit", "warn"]),
  placement: z.array(Placement).optional(),
  travel_type: z.array(TravelType).optional(),
});
export type RuleEffect = z.infer<typeof RuleEffect>;

export const RuleScope = z.object({
  type: z.enum(["airline", "country", "route", "breed", "global"]),
  id: z.string().optional(),
});
export type RuleScope = z.infer<typeof RuleScope>;

export const Rule = z.object({
  id: id("rule"),
  scope: RuleScope,
  category: RuleCategory,
  criticality: Criticality,
  applies_when: Predicate,
  effect: RuleEffect,
  params: z.record(z.unknown()).default({}),
  rationale: z.string().min(1), // English base — every rule explains itself
  rationale_i18n: z.record(z.string()).optional(), // optional localized rationales, keyed by locale (fallback → rationale)
  source: Source,               // every rule is sourced + dated (ADR-0006)
});
export type Rule = z.infer<typeof Rule>;
