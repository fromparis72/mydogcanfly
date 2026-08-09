import type { Airline, Airport } from "./objects";
import type { Rule } from "./rules";

/** Typed relationships (ADR-0014). The graph is engine traversal + internal-linking, in one. */
export type RelationType =
  | "SERVES"        // airline → country
  | "BASED_IN"      // airline → country
  | "LOCATED_IN"    // airport → country
  | "REQUIRES"      // country → rule (import requirement)
  | "RESTRICTED_BY" // airline → rule (breed ban etc.)
  | "APPLIES_TO";   // rule → subject (e.g. dog)

export interface Edge {
  from: string;
  type: RelationType;
  to: string;
}

/** Relationships are derived from entity references, never duplicated. */
export function buildGraph(input: { airlines: Airline[]; airports: Airport[]; rules: Rule[] }): Edge[] {
  const edges: Edge[] = [];
  for (const a of input.airlines) {
    edges.push({ from: a.id, type: "BASED_IN", to: a.country_id });
    for (const c of a.serves_country_ids) edges.push({ from: a.id, type: "SERVES", to: c });
  }
  for (const ap of input.airports) {
    edges.push({ from: ap.id, type: "LOCATED_IN", to: ap.country_id });
  }
  for (const r of input.rules) {
    /* Bug corrigé (audit du 09/08/2026, tâche 26) : la catégorie réellement utilisée par les règles
     * pays d'entrée est "import_rules" (181 règles dans raw/rules.json) — "vaccination" n'en compte
     * QU'UNE SEULE. Le graphe REQUIRES (pays → règle) était donc quasi vide depuis toujours. Effet
     * pratique aujourd'hui nul : `relatedIds()` (views.ts) exclut déjà les ids de type "rule" du
     * résultat, donc aucune page ne s'appuyait dessus — mais un futur usage de
     * `neighbors(kb, countryId, "REQUIRES", "out")` (lister les règles d'entrée d'un pays via le
     * graphe) aurait silencieusement renvoyé une liste quasi vide. */
    if (r.scope.id && r.scope.type === "country" && r.category === "import_rules") {
      edges.push({ from: r.scope.id, type: "REQUIRES", to: r.id });
      edges.push({ from: r.id, type: "APPLIES_TO", to: "dog" });
    }
    if (r.scope.id && r.scope.type === "airline" && r.category === "breed_ban") {
      edges.push({ from: r.scope.id, type: "RESTRICTED_BY", to: r.id });
    }
  }
  return edges;
}
