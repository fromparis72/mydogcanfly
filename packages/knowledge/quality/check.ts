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
 * sure no airline ever regresses back into that gap unnoticed.
 *
 * Bug corrigé (audit du 09/08/2026, tâche 27) : la porte vérifiait `.some(...)` — UN SEUL des
 * trois placements (cabine/soute/fret) documenté suffisait à faire passer TOUTE la compagnie.
 * Or evaluate.ts applique le repli fiche placement PAR placement (policyFallbackDenyRule) : pour
 * une compagnie sans rules.json et dont, disons, seul `premium.policy.cabin` est renseigné, la
 * soute et le fret ne sont NI refusés par une règle NI refusés par le repli (qui exige
 * `policy[p]?.allowed === false`, absent ≠ false) — ils tombent silencieusement en "autorisé" par
 * défaut. C'est exactement le bug que ce gate a été créé pour empêcher, mais seulement pour les
 * compagnies dont AUCUN des trois placements n'est documenté ; une couverture partielle (1 ou 2
 * sur 3) le traversait sans bruit. On exige maintenant les TROIS. Mesuré le 09/08/2026 : les 8
 * compagnies actuellement sans rules.json ont déjà les 3/3 — ce correctif ne fait rien basculer
 * aujourd'hui, il ferme la porte à une régression future. */
const PLACEMENTS = ["cabin", "hold", "cargo"] as const; // recopié de evaluate.ts (packages/engine) — à garder synchronisé
const airlinesWithRules = new Set(kb.rules.filter((r) => r.scope.type === "airline").map((r) => r.scope.id));
const airlinesWithPartialPolicy: { id: string; missing: string[] }[] = [];
const airlinesWithPolicy = new Set(
  [...kb.airlines.values()]
    .filter((a) => {
      if (!a.premium?.policy) return false;
      const missing = PLACEMENTS.filter((p) => {
        const m = a.premium!.policy![p as keyof typeof a.premium.policy];
        return !(m && typeof m.allowed === "boolean");
      });
      // Le trou n'est réel QUE pour une compagnie sans rules.json propre — sinon rules.json fait
      // déjà foi sur les trois placements et le repli fiche partiel n'est jamais consulté (voir
      // le commentaire au-dessus). On ne le signale donc que dans ce cas, pour ne pas alarmer sur
      // une lacune de la fiche qui ne change rien au verdict rendu.
      if (missing.length > 0 && missing.length < PLACEMENTS.length && !airlinesWithRules.has(a.id)) {
        airlinesWithPartialPolicy.push({ id: a.id, missing });
      }
      return missing.length === 0;
    })
    .map((a) => a.id),
);
ok(
  "coverage: airlines have at least one rule, or a fiche policy covering all 3 placements",
  [...kb.airlines.keys()].every((id) => airlinesWithRules.has(id) || airlinesWithPolicy.has(id)),
  airlinesWithPartialPolicy.length
    ? `partial fiche policy (falls silently to "allowed" on the missing placement): ${airlinesWithPartialPolicy.map((a) => `${a.id} (missing ${a.missing.join(", ")})`).join("; ")}`
    : "",
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
