import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalize } from "../src/normalize";

/* Quality gates (ADR-0015): schema-check · rule-check · coverage · (link-check offline-skipped). */

const here = dirname(fileURLToPath(import.meta.url));
const raw = {
  ...JSON.parse(readFileSync(join(here, "../raw/objects.json"), "utf8")),
  rules: JSON.parse(readFileSync(join(here, "../raw/rules.json"), "utf8")),
};

let failed = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
  if (!cond) failed++;
}

// schema-check (throws on invalid data)
let kb;
try {
  kb = normalize(raw);
  ok("schema-check", true, `${kb.airlines.size} airlines · ${kb.countries.size} countries · ${kb.rules.length} rules · ${kb.graph.length} graph edges`);
} catch (e) {
  ok("schema-check", false, String(e));
  process.exit(1);
}

// rule-check
ok("rule-check: every rule has a source URL", kb.rules.every((r) => !!r.source?.url));
ok("rule-check: review_due after verified_date", kb.rules.every((r) => r.source.review_due > r.source.verified_date));
ok("rule-check: predicate facts are declared", kb.rules.every((r) => !!r.applies_when));

/* coverage: every airline has SOME sourced answer to "does it carry pets, and where" — either its
 * own rules.json entries, or a fiche-derived premium.policy. Both are valid: since 08/2026,
 * evaluate.ts falls back to premium.policy.<mode>.allowed for any airline with no rules.json
 * entry of its own (see evaluate.ts's policyFallbackDenyRule). An airline with NEITHER is the
 * exact silent "always allowed" bug that fallback was built to close — this gate exists to make
 * sure no airline ever regresses back into that gap unnoticed. */
const airlinesWithRules = new Set(kb.rules.filter((r) => r.scope.type === "airline").map((r) => r.scope.id));
const airlinesWithPolicy = new Set(
  [...kb.airlines.values()]
    .filter((a) => a.premium?.policy && Object.values(a.premium.policy).some((m) => m && typeof m.allowed === "boolean"))
    .map((a) => a.id),
);
ok(
  "coverage: airlines have at least one rule or a fiche-derived policy",
  [...kb.airlines.keys()].every((id) => airlinesWithRules.has(id) || airlinesWithPolicy.has(id)),
);

/* coherence: un pays desservi doit avoir un aéroport où atterrir.
 *
 * Le site lit deux fois la même destination par deux chemins différents. La fiche pays affiche
 * les compagnies via `serves_country_ids` — une liste de PAYS, qui s'affiche même si le pays
 * n'a aucun aéroport. Le Finder, lui, construit ses destinations en parcourant les aéroports.
 * Quand la première liste avance un pays que la seconde ignore, le site affirme à la fois
 * « TUI dessert le Cap-Vert » et « aucun aéroport n'existe au Cap-Vert » (constaté le 08/08/2026).
 *
 * Ce contrôle refuse cette situation au lieu de la laisser vivre. Il échoue tant que la
 * couverture n'est pas comblée, et il NOMME les pays : un défaut de données chiffré et
 * actionnable vaut mieux qu'une contradiction invisible en production. Deux réparations
 * possibles pour chaque nom listé — ajouter l'aéroport (si la desserte est réelle) ou retirer
 * le pays de `serves_country_ids` (si elle ne l'est pas). Jamais une exception ajoutée ici.
 */
const countriesWithAirport = new Set([...kb.airports.values()].map((a) => a.country_id));
const promisedWithoutAirport = [
  ...new Set([...kb.airlines.values()].flatMap((a) => a.serves_country_ids)),
]
  .filter((cid) => !countriesWithAirport.has(cid))
  .map((cid) => kb.countries.get(cid)?.name?.en ?? cid)
  .sort();
ok(
  "coherence: countries served by an airline have at least one airport",
  promisedWithoutAirport.length === 0,
  promisedWithoutAirport.length ? `${promisedWithoutAirport.length} without: ${promisedWithoutAirport.join(", ")}` : "",
);

// link-check: network-gated, runs in CI only
console.log("ℹ️  link-check: skipped (network-gated; runs in CI)");

console.log(failed ? `\n${failed} check(s) failed` : "\nAll quality checks passed ✨");
process.exit(failed ? 1 : 0);
