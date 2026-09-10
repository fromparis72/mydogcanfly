#!/usr/bin/env node
/**
 * CONTRE-ÉPREUVES DE LA RÉCONCILIATION CIBLÉE — décisions de Philippe du 09/09/2026, sur avis de Codex, après le
 * correctif d'arbitrages (mesures/preuves/correctif-arbitrages-2026-09-09).
 *
 *   npx tsx test-preuves-reconciliation.mjs
 *
 * Quatre décisions, éprouvées ici :
 *   1. Bangkok Airways fret : `case_by_case` CONSERVÉ — « à confirmer » est le seul état global honnête tant que le
 *      modèle ne sait pas exprimer « intérieur sous conditions / international refusé ». Dette prioritaire nommée.
 *   2. Air Austral, borne stricte : comparateur typé `weight_limit_bound` (`lt` | `lte`) ajouté au modèle ; « inférieur à
 *      8 kg » s'écrit `lt` — contre-épreuves à 7,9 / 8 / 8,1 kg, et la borne inclusive en miroir (SWISS, « up to 8 kg »).
 *      Aucun arrondi : 8 reste 8.
 *   3. Aer Lingus soute et 4. Air China cabine : les règles héritées non citées `rule_aer_lingus_no_hold` et
 *      `rule_air_china_no_cabin` sont RETIRÉES (copie dans le dossier du correctif) ; seules les restrictions présentes
 *      dans les sources officielles relues le 09/09 restent, en conditions, dans les quatre langues. Le verdict cité
 *      atteint le Finder. PRINCIPE : une règle historique non citée n'a pas priorité sur une politique officielle plus
 *      récente et citée.
 */
import { readFileSync, existsSync } from "node:fs";
import { loadKB } from "./packages/knowledge/src/index.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { FinderRequest } from "./packages/engine/src/contracts.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};
const kb = loadKB();
const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
const regles = (() => { const r = JSON.parse(readFileSync("packages/knowledge/raw/rules.json", "utf8")); return Array.isArray(r) ? r : r.rules; })();
const politique = (id, pl) => objets.airlines.find((a) => a.id === id)?.premium?.policy?.[pl];
const projetee = (id, pl) => kb.airlines.get(id)?.premium?.policy?.[pl];
const fiche = (slug) => readFileSync(`content/airlines/${slug}.yml`, "utf8");
const JUILLET = (() => { const n = new Date(), y = n.getUTCFullYear(); return `${Date.UTC(y, n.getUTCMonth(), n.getUTCDate()) <= Date.UTC(y, 6, 15) ? y : y + 1}-07-15`; })();
const decide = (o, dst, dog) => evaluate(kb, FinderRequest.parse({ origin: o, destination: dst, dog, date: JUILLET }));
const canal = (dec, id, pl) => dec.airlines.find((a) => a.airline_id === id)?.placements.find((p) => p.placement === pl);

console.log("=== 1. Bangkok Airways fret : `case_by_case` conservé le 09/09, dette de portée FERMÉE le 10/09 (annexe 37) ===");
{
  /* MOUVEMENT NOMMÉ (10/09/2026) : la dette « le modèle ne sait pas restreindre un canal par route » est fermée par trois règles
     géographiques citées (R1 international, R2/R3 Krabi) ; la fiche revient à `offered`, la citation et les conditions restent.
     Le témoin d'ici ne garde que ce qui est resté vrai : la citation, et l'absence de « sous conditions » réseau entier
     (l'international est refusé — voir test-bangkok-fret-geographie.mjs). */
  const b = politique("airline_bangkok_airways", "cargo");
  check("`offered` depuis le 10/09, citation et conditions Krabi intactes ; projeté « sous conditions » (réseau intérieur), l'international refusé par R1 citée",
    b?.availability === "offered" && !!b?.source?.quote && /Krabi/.test(b?.conditions?.fr ?? "") && projetee("airline_bangkok_airways", "cargo")?.status === "accepted_with_conditions"
    && regles.some((r) => r.id === "rule_bangkok_airways_cargo_international_denied" && r.source?.quote === "International Routes: All station: Not Accept"));
}

console.log("\n=== 2. La borne du seuil : `lt` exclut la valeur, `lte` l'inclut — sans arrondi ===");
{
  const aa = politique("airline_air_austral", "cabin");
  check("Air Austral cabine : `weight_limit_bound: lt` ÉCRIT dans la fiche, depuis « inférieur à 8 kg », et projeté", aa?.weight_limit_bound === "lt" && projetee("airline_air_austral", "cabin")?.weight_limit_bound === "lt" && /weight_limit_bound: lt/.test(fiche("air_austral")));
  let bornesStrictes = 0, seuils = 0;
  for (const a of objets.airlines) for (const p of Object.values(a.premium?.policy ?? {})) { if (typeof p.max_weight_kg === "number" && typeof p.weight_includes_carrier === "boolean") { seuils++; if (p.weight_limit_bound === "lt") bornesStrictes++; } }
  /* MOUVEMENT NOMMÉ (10/09/2026, complément Air France cabine — Codex) : 37 → 38 seuils qualifiés, 1 → 2 bornes strictes — Air France
     cabine, « chiens de moins de 8 kg, sac de transport compris », rejoint Air Austral ; Codex : « ne pas convertir en ≤ 8 kg ». */
  check("état figé : 38 seuils qualifiés, DEUX bornes strictes (Air Austral, Air France — mesuré sur les phrases citées : toutes les autres disent « jusqu'à », « maximum », « ne dépasse pas »)", seuils === 38 && bornesStrictes === 2, `${seuils} seuils, ${bornesStrictes} stricte(s)`);
  const afB = politique("airline_air_france", "cabin");
  check("Air France cabine : `weight_limit_bound: lt` ÉCRIT dans la fiche, depuis « moins de 8 kg », et projeté", afB?.weight_limit_bound === "lt" && projetee("airline_air_france", "cabin")?.weight_limit_bound === "lt" && /weight_limit_bound: lt/.test(fiche("air_france")));
  const st = (w) => canal(decide("airport_cdg", "airport_run", { breed_id: "breed_pug", weight_kg: w }), "airline_air_austral", "cabin");
  check("Air Austral, 7,9 kg : sous conditions (jamais un oui), la carte porte 8 kg, contenant compris, borne stricte", st(7.9)?.status === "accepted_with_conditions" && st(7.9)?.weight_limit_kg === 8 && st(7.9)?.weight_limit_includes_carrier === true && st(7.9)?.weight_limit_bound === "lt", JSON.stringify(st(7.9)));
  check("Air Austral, 8,0 kg exactement : REFUSÉ — « inférieur à 8 kg » exclut 8", st(8)?.status === "denied", JSON.stringify(st(8)));
  check("Air Austral, 8,1 kg : REFUSÉ", st(8.1)?.status === "denied");
  const sw = (w) => canal(decide("airport_cdg", "airport_zrh", { breed_id: "breed_pug", weight_kg: w }), "airline_swiss", "cabin");
  check("miroir inclusif — SWISS (« up to 8 kg », borne absente = `lte`) : 7,9 et 8,0 kg sous conditions, 8,1 kg refusé",
    sw(7.9)?.status === "accepted_with_conditions" && sw(8)?.status === "accepted_with_conditions" && sw(8.1)?.status === "denied" && sw(8)?.weight_limit_bound === undefined, JSON.stringify([sw(7.9)?.status, sw(8)?.status, sw(8.1)?.status]));
  check("aucun arrondi : le plafond écrit reste 8, pas 7,99", aa?.max_weight_kg === 8);
}

console.log("\n=== 3 et 4. Deux règles héritées non citées retirées ; les restrictions sourcées vivent en conditions ===");
{
  const ids = new Set(regles.map((r) => r.id));
  check("`rule_aer_lingus_no_hold` et `rule_air_china_no_cabin` ne sont plus dans rules.json", !ids.has("rule_aer_lingus_no_hold") && !ids.has("rule_air_china_no_cabin"));
  const copie = "mesures/preuves/correctif-arbitrages-2026-09-09/regles-retirees-reconciliation-2026-09-09.json";
  check("les deux règles retirées sont conservées telles quelles dans le dossier du correctif (rien n'est effacé)", existsSync(copie) && JSON.parse(readFileSync(copie, "utf8")).map((r) => r.id).sort().join() === "rule_aer_lingus_no_hold,rule_air_china_no_cabin");
  check("aucune autre règle ne vise Aer Lingus soute ni Air China cabine en `deny`",
    !regles.some((r) => r.scope?.id === "airline_aer_lingus" && r.effect?.action === "deny" && (r.effect?.placement ?? []).includes("hold"))
    && !regles.some((r) => r.scope?.id === "airline_air_china" && r.effect?.action === "deny" && (r.effect?.placement ?? []).includes("cabin")));
  for (const [id, pl, slug, mots] of [["airline_aer_lingus", "hold", "aer_lingus", ["Emerald", "Regional"]], ["airline_air_china", "cabin", "air_china", ["2", "1"]]]) {
    const c = politique(id, pl)?.conditions ?? {};
    check(`${id}.${pl} : conditions en quatre langues, tirées de la source officielle relue (${mots.join(", ")}) ; la fiche nomme la réconciliation`,
      ["en", "fr", "es", "pt"].every((l) => typeof c[l] === "string" && mots.every((m) => c[l].includes(m))) && /RÉCONCILIATION CIBLÉE \(Philippe, 09\/09\/2026/.test(fiche(slug)));
  }
  const dub = decide("airport_cdg", "airport_dub", { breed_id: "breed_golden_retriever", weight_kg: 32 });
  check("Aer Lingus soute (Paris → Dublin), Golden 32 kg : SOUS CONDITIONS dans le Finder, source citée transportée",
    canal(dub, "airline_aer_lingus", "hold")?.status === "accepted_with_conditions" && /aerlingus\.com/.test(canal(dub, "airline_aer_lingus", "hold")?.source?.url ?? ""));
  const pek = decide("airport_cdg", "airport_pek", { breed_id: "breed_cavalier_king_charles", weight_kg: 6 });
  check("Air China cabine (Paris → Pékin), Cavalier 6 kg : SOUS CONDITIONS dans le Finder, source citée transportée",
    canal(pek, "airline_air_china", "cabin")?.status === "accepted_with_conditions" && /airchina\.com\.cn/.test(canal(pek, "airline_air_china", "cabin")?.source?.url ?? ""));
  const pekG = decide("airport_cdg", "airport_pek", { breed_id: "breed_golden_retriever", weight_kg: 32 });
  check("Air China cabine, Golden 32 kg : « à confirmer » par la règle GLOBALE de poids non citée — nommée, hors de cette réconciliation (aucun plafond cité chez Air China)",
    canal(pekG, "airline_air_china", "cabin")?.status === "confirmation_required" && (canal(pekG, "airline_air_china", "cabin")?.confirmation_causes ?? []).some((x) => x.rule_id === "rule_global_cabin_weight_cap"));
}

console.log("\n=== Ce que la réconciliation n'a PAS fait ===");
{
  let allowed = 0; for (const a of kb.airlines.values()) for (const p of Object.values(a.premium?.policy ?? {})) if (p.status === "allowed") allowed++;
  check("aucune politique réelle n'est `allowed` — « sous conditions » n'est jamais une place promise", allowed === 0, String(allowed));
  /* MOUVEMENT NOMMÉ (10/09/2026, annexe 37) : 399 → 402, exactement les trois règles géographiques de Bangkok Airways, citées. */
  check("aucune autre règle n'a été touchée : 402 règles = 399 de la réconciliation + les trois règles Bangkok Airways fret", regles.length === 402 && regles.filter((r) => /^rule_bangkok_airways_cargo_/.test(r.id)).length === 3, String(regles.length));
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail ? 1 : 0);
