/**
 * T0-B2 — couverture DIRECTE des 302 politiques au niveau normalisation/projection.
 *
 * La matrice des 72 scénarios HTTP n'exerce que 48 des 84 couples migrés (9 routes). Cette sonde
 * couvre les 302, une par une, à travers `normalize()` — donc à travers `PlacementPolicyAuthored`
 * (validation stricte de la forme d'auteur) puis `projectPlacementPolicy` (projection runtime).
 * Elle prouve la cible de CHAQUE couple sans dépendre d'une route.
 */
import { readFileSync } from "node:fs";
/* Import RELATIF, et non par le nom du paquet : `@mydogcanfly/knowledge` n'exporte pas ses
   sources. La sonde est copiée à la racine de la copie jetable par `reproduire.sh`, ce qui rend
   ce chemin valide — et garantit qu'elle mesure la copie, jamais le dépôt. */
import { normalize } from "./packages/knowledge/src/normalize.ts";

const SIM = process.argv[2];
const objects = JSON.parse(readFileSync(SIM + "/packages/knowledge/raw/objects.json", "utf8"));
const rules = JSON.parse(readFileSync(SIM + "/packages/knowledge/raw/rules.json", "utf8"));
const manifest = JSON.parse(readFileSync(SIM + "/test-baselines/t0b-migration-matrice.json", "utf8"));
const registre = JSON.parse(readFileSync(process.argv[3], "utf8"));

const kb = normalize({ ...objects, rules });
const attendu = new Map(registre.registre.map((r) => [r.key, r]));

let ok = 0;
const echecs = [];
const parStatut = {};
const parCause = {};
let vus = 0;

for (const a of kb.airlines.values()) {
  const pol = a.premium?.policy ?? {};
  for (const mode of ["cabin", "hold", "cargo"]) {
    const p = pol[mode];
    if (!p) continue;
    vus++;
    const key = `${a.id}.${mode}`;
    const att = attendu.get(key);
    if (!att) { echecs.push({ key, probleme: "politique hors registre" }); continue; }
    parStatut[p.status] = (parStatut[p.status] || 0) + 1;
    if (p.status_cause) parCause[p.status_cause] = (parCause[p.status_cause] || 0) + 1;

    // cible → statut runtime attendu, par la table du cadrage
    const table = {
      "availability:offered":            { status: "allowed", allowed: true, cause: undefined },
      "availability:not_offered":        { status: "denied", allowed: false, cause: undefined },
      "availability:undocumented":       { status: "confirmation_required", allowed: false, cause: "policy_unpublished" },
      "review_state:legacy_unreviewed":  { status: "confirmation_required", allowed: false, cause: "legacy_unreviewed" },
    }[att.cible];
    if (!table) { echecs.push({ key, probleme: `cible inconnue ${att.cible}` }); continue; }
    if (p.status !== table.status || p.allowed !== table.allowed || p.status_cause !== table.cause) {
      echecs.push({ key, lot: att.lot, attendu: table, obtenu: { status: p.status, allowed: p.allowed, cause: p.status_cause } });
      continue;
    }
    // aucune forme d'auteur héritée ne doit survivre à la projection
    if ("conditional" in p) { echecs.push({ key, probleme: "conditional survivant" }); continue; }
    ok++;
  }
}

const migres = registre.registre.filter((r) => r.lot !== "218_mecanique");
console.log("politiques projetées      :", vus, "(attendu 302)");
console.log("conformes au registre     :", ok);
console.log("échecs                    :", echecs.length);
echecs.slice(0, 10).forEach((e) => console.log("   ", JSON.stringify(e)));
console.log("répartition par statut    :", parStatut);
console.log("répartition par cause     :", parCause);
console.log("couples migrés couverts   :", migres.length, "(84 attendus : 73 manifeste + 10 stale + 1 thai)");
if (vus !== 302) throw new Error("≠ 302 politiques");
if (echecs.length) throw new Error("échecs de projection");
if (migres.length !== 84) throw new Error(`migrés ≠ 84 (${migres.length})`);
console.log("\nCOUVERTURE DIRECTE COMPLÈTE : 302/302 politiques, dont les 84 migrées, prouvées à la projection.");
