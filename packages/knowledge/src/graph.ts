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
    if (r.scope.id && r.scope.type === "country" && r.category === "vaccination") {
      edges.push({ from: r.scope.id, type: "REQUIRES", to: r.id });
      edges.push({ from: r.id, type: "APPLIES_TO", to: "dog" });
    }
    if (r.scope.id && r.scope.type === "airline" && r.category === "breed_ban") {
      edges.push({ from: r.scope.id, type: "RESTRICTED_BY", to: r.id });
    }
  }
  return edges;
}
