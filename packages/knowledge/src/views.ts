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

/** True quand la condition CONCERNE la valeur testée par `pred` — c'est-à-dire qu'elle l'INCLUT,
 *  pas qu'elle se contente de la citer pour l'exclure. Bug corrigé (audit du 09/08/2026, tâche
 *  28) : cette fonction recursait déjà dans `not`, mais sans jamais inverser le sens du test — une
 *  règle "tout SAUF ce pays/cette race" (via `not` enveloppant un eq/in, ou via un neq/nin
 *  autonome) aurait été lue comme "concerne ce pays/cette race", l'exact inverse. `rulesForCountry`
 *  ci-dessous appliquait déjà ce principe (son commentaire l'explique) mais seulement au niveau de
 *  sa propre feuille, jamais à travers un `not` englobant, et `rulesForBreed` ne l'appliquait pas
 *  du tout. Centralisé ici pour que les deux en bénéficient pareil.
 *  Vérifié en direct (09/08/2026) : aucune règle actuelle n'utilise `not`, `neq` ni `nin` sur
 *  dog.breed_id ni route.dest_country_id — ce correctif est un filet pour une règle future, pas la
 *  réparation d'un défaut aujourd'hui visible sur ce point précis. */
function predicateMentions(p: Predicate, pred: (c: Condition) => boolean, negated = false): boolean {
  if ("all" in p) return p.all.some((q) => predicateMentions(q, pred, negated));
  if ("any" in p) return p.any.some((q) => predicateMentions(q, pred, negated));
  if ("not" in p) return predicateMentions(p.not, pred, !negated);
  if (negated || p.op === "neq" || p.op === "nin") return false;
  return pred(p);
}

/** Rules that concern a given breed, derived from their predicates (never hardcoded). */
export function rulesForBreed(kb: NormalizedKB, breedId: string): Rule[] {
  const breed = kb.breeds.get(breedId);
  return kb.rules.filter((r) =>
    predicateMentions(r.applies_when, (c) => {
      /* Bug corrigé (audit du 09/08/2026, tâche 28) : ne testait que `c.value === breedId`, ce
       * qui ne peut matcher QUE l'opérateur "eq" (une seule race). Les 6 règles réelles de
       * rules.json qui référencent dog.breed_id utilisent TOUTES l'opérateur "in" (liste de
       * races) — `c.value` y est un tableau, jamais égal à la chaîne breedId : ces règles étaient
       * donc invisibles pour rulesForBreed(), toujours, pour toute race. Vérifié en direct. */
      if (c.fact === "dog.breed_id") {
        if (c.op === "eq") return c.value === breedId;
        if (c.op === "in") return Array.isArray(c.value) && c.value.includes(breedId);
        return false; // neq/nin déjà exclus par predicateMentions ci-dessus ; ceinture et bretelles
      }
      if (c.fact === "dog.brachycephalic") return !!breed?.brachycephalic && c.value === true;
      return false;
    }),
  );
}

/* Une fiche pays affiche deux vérifications distinctes : la relecture éditoriale de la fiche
 * (`verified_date` du YAML, bougée à la main) et le contrôle des règles d'entrée qui la
 * nourrissent (`source.verified_date` de chaque règle, bougé à chaque correction de donnée).
 * Quand les 27 règles d'entrée dans l'UE sont revérifiées auprès de la Commission, la fiche
 * continuait d'annoncer la date de sa dernière relecture : le lecteur voyait une date périmée
 * alors que l'information affichée venait d'être contrôlée le jour même.
 *
 * Les deux fonctions ci-dessous servent à afficher la plus récente des deux dates. Elles ne
 * datent jamais rien d'elles-mêmes : pas de « aujourd'hui », pas de date de build — seulement
 * le maximum de deux dates réellement constatées dans les données (ADR-0006).
 */

/** Règles qui concernent l'ENTRÉE dans un pays : celles qui lui sont attachées par leur `scope`,
 *  et celles qui le nomment comme destination dans leur prédicat.
 *
 *  Piège : on ne regarde délibérément PAS `route.origin_country_id`. Une règle d'import
 *  française énumère les 27 États membres comme origines possibles ; compter ces mentions
 *  ferait remonter la date de vérification de la France sur les 26 autres fiches, qui n'ont
 *  pourtant rien vu changer. De même on ignore `nin`/`neq` : « toute origine SAUF ces pays-là »
 *  cite un pays pour l'exclure, ce n'est pas une règle qui le concerne. */
export function rulesForCountry(kb: NormalizedKB, countryId: string): Rule[] {
  return kb.rules.filter((r) =>
    (r.scope.type === "country" && r.scope.id === countryId) ||
    predicateMentions(r.applies_when, (c) =>
      c.fact === "route.dest_country_id" &&
      ((c.op === "eq" && c.value === countryId) ||
       (c.op === "in" && Array.isArray(c.value) && c.value.includes(countryId)))),
  );
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Date de vérification à afficher pour une fiche pays : la plus récente entre la relecture de
 *  la fiche et le dernier contrôle des règles d'entrée du pays.
 *
 *  Le calcul se fait au rendu, jamais en réécrivant le YAML : la donnée éditoriale reste ce
 *  qu'elle est (« quand un humain a relu cette fiche »), c'est l'affichage qui suit les données.
 *  Comparaison de chaînes : le format ISO `YYYY-MM-DD` s'ordonne lexicographiquement, inutile
 *  de passer par `Date` (et ses fuseaux) pour prendre un maximum. Tout ce qui n'est pas une
 *  date ISO est écarté plutôt que réparé — on n'affiche pas une date qu'on ne sait pas lire. */
export function countryVerifiedDate(kb: NormalizedKB, countryId: string, guideDate?: string | null): string {
  const dates = [guideDate, ...rulesForCountry(kb, countryId).map((r) => r.source.verified_date)]
    .filter((d): d is string => typeof d === "string" && ISO_DATE.test(d));
  return dates.reduce((a, b) => (b > a ? b : a), "");
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
