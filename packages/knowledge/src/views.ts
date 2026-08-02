import type { NormalizedKB } from "./normalize";
import type { Rule, RuleScope, Predicate, Condition } from "./rules";
import type { Edge } from "./graph";

/* Pure projections of the knowledge base for interfaces to render.
   No business logic — traversal + labels + schema.org, all data-driven. */

export function kindOf(id: string): string {
  return id.split("_")[0] ?? "";
}
export function slugFor(id: string): string {
  return id.split("_").slice(1).join("-");
}

export function rulesForScope(kb: NormalizedKB, type: RuleScope["type"], id: string): Rule[] {
  return kb.rules.filter((r) => r.scope.type === type && r.scope.id === id);
}

/** Edges touching a node, either direction (ADR-0014). */
export function edgesFor(kb: NormalizedKB, id: string): Edge[] {
  return kb.graph.filter((e) => e.from === id || e.to === id);
}

/** Distinct related ENTITY ids (excludes rules + self), derived purely from the graph. */
export function relatedIds(kb: NormalizedKB, id: string): string[] {
  const out = new Set<string>();
  for (const e of edgesFor(kb, id)) {
    const other = e.from === id ? e.to : e.from;
    if (other !== id && kindOf(other) !== "rule") out.add(other);
  }
  return [...out];
}

/** Ids on the far side of a specific relation type/direction (graph-derived). */
export function neighbors(kb: NormalizedKB, id: string, type: Edge["type"], dir: "out" | "in"): string[] {
  return kb.graph
    .filter((e) => e.type === type && (dir === "out" ? e.from === id : e.to === id))
    .map((e) => (dir === "out" ? e.to : e.from));
}

function predicateMentions(p: Predicate, pred: (c: Condition) => boolean): boolean {
  if ("all" in p) return p.all.some((q) => predicateMentions(q, pred));
  if ("any" in p) return p.any.some((q) => predicateMentions(q, pred));
  if ("not" in p) return predicateMentions(p.not, pred);
  return pred(p);
}

/** Rules that concern a given breed, derived from their predicates (never hardcoded). */
export function rulesForBreed(kb: NormalizedKB, breedId: string): Rule[] {
  const breed = kb.breeds.get(breedId);
  return kb.rules.filter((r) =>
    predicateMentions(r.applies_when, (c) => {
      if (c.fact === "dog.breed_id") return c.value === breedId;
      if (c.fact === "dog.brachycephalic") return !!breed?.brachycephalic && c.value === true;
      return false;
    }),
  );
}

/** Human label for any entity id. Country and airport names localize via LocalizedText;
 *  airline names are proper nouns and never change.
 *
 *  L'aéroport lisait `a.name.en` en dur, quelle que soit la langue. Sur une page espagnole,
 *  le fil d'Ariane disait « Londres (LHR) » et le titre « London Heathrow (LHR) » — la même
 *  ville, deux langues, une seule page. Le nom suit maintenant la locale, avec repli sur
 *  l'anglais tant qu'une langue n'a pas sa table. */
export function labelOf(kb: NormalizedKB, id: string, locale = "en"): string {
  switch (kindOf(id)) {
    case "airline": return kb.airlines.get(id)?.name ?? id;
    case "country": { const c = kb.countries.get(id); return c ? (c.name[locale] ?? c.name.en) : id; }
    case "airport": { const a = kb.airports.get(id); return a ? `${a.iata} · ${airportName(a, locale)}` : id; }
    case "breed": { const b = kb.breeds.get(id); return b ? (b.name_i18n?.[locale] ?? b.name) : id; }
    default: return id;
  }
}

/** Localized breed display name, falling back to the English name. */
export function breedName(b: { name: string; name_i18n?: Record<string, string> }, locale = "en"): string {
  return b.name_i18n?.[locale] ?? b.name;
}

/** Localized airport display name, falling back to English.
 *  Le pendant de `cityName` : sept endroits écrivaient `a.name.en` en dur, ce qui laissait le
 *  titre en anglais sur des pages dont tout le reste — fil d'Ariane, badge, prose — était
 *  déjà traduit. Un seul lecteur, comme pour les races et les villes. */
export function airportName(a: { name: Record<string, string> }, locale = "en"): string {
  return a.name[locale] ?? a.name.en;
}

/** Localized city display name, falling back to the default (English) city string. */
export function cityName(a: { city: string; city_i18n?: Record<string, string> }, locale = "en"): string {
  return a.city_i18n?.[locale] ?? a.city;
}

/** Schema.org projection per entity type (data-driven, locale-aware for country names). */
export function schemaFor(kb: NormalizedKB, id: string, locale = "en"): Record<string, unknown> {
  const base = { "@context": "https://schema.org" };
  switch (kindOf(id)) {
    case "airline": { const a = kb.airlines.get(id)!; return { ...base, "@type": "Airline", name: a.name, iataCode: a.iata, url: a.website }; }
    case "country": { const c = kb.countries.get(id)!; return { ...base, "@type": "Country", name: c.name[locale] ?? c.name.en }; }
    case "airport": { const a = kb.airports.get(id)!; return { ...base, "@type": "Airport", name: airportName(a, locale), iataCode: a.iata }; }
    case "breed": { const b = kb.breeds.get(id)!; return { ...base, "@type": "Thing", name: b.name }; }
    default: return base;
  }
}
