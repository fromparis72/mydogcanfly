#!/usr/bin/env node
/**
 * Harnais « jamais de vol direct sans preuve » — moteur + contrat HTTP.
 *
 * Règle maison : aucune affirmation sans source officielle. Annoncer « ✈ Direct » sur une paire
 * origine/destination absente du graphe `direct_routes` de la compagnie est une affirmation sans
 * source — et elle n'est pas cosmétique : `explain.ts` attribue une qualité de route de 0,8 à
 * `direct_assumed` contre 0,7 à une correspondance documentée, donc l'invention remonte le score.
 *
 * Défaut d'origine (relevé par Codex le 11/08/2026, `evaluate.ts` l. 329-331) : un hub à l'une des
 * extrémités forçait `direct = true` même lorsque le graphe de routes, présent et documenté,
 * disait le contraire. Qantas ressortait « Direct » sur CDG→SYD parce qu'elle a un hub à Sydney.
 *
 * Les 102 compagnies ont toutes un graphe `direct_routes`. Or le contrat (`contracts.ts` l. 136)
 * réserve `direct_assumed` au cas « pas de graphe de routes ». Cet état ne devrait donc JAMAIS être
 * produit aujourd'hui : c'est l'invariant central testé ici.
 *
 *   npm run test:direct        (équivaut à `npx tsx test-direct-claims.mjs`)
 *
 * `tsx` et non `node` : ce harnais importe directement les sources TypeScript du Worker et du
 * moteur, sans étape de compilation — c'est ce qui lui permet de tester le code du dépôt plutôt
 * qu'un artefact. `node` seul échoue sur l'import `.ts`.
 */
import worker from "./packages/workers/src/index.ts";
import { loadKB } from "./packages/knowledge/src/index.ts";

let pass = 0;
let fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

const finder = async (origin, destination, extra = "") => {
  const q = `origin=${origin}&destination=${destination}&weight_kg=8&breed=breed_golden_retriever&placement=any&locale=en${extra}`;
  const res = await worker.fetch(new Request(`https://x/v1/finder?${q}`), {});
  if (res.status !== 200) throw new Error(`${origin}→${destination} : HTTP ${res.status}`);
  return await res.json();
};

/* Les paires servant de référence. CDG→SYD est le cas fondateur ; les autres ont été relevés
   comme produisant eux aussi des « Direct » non documentés lors de la mesure d'ampleur. */
const ROUTES = [
  ["airport_cdg", "airport_syd"],
  ["airport_cdg", "airport_nrt"],
  ["airport_lhr", "airport_syd"],
  ["airport_cdg", "airport_jfk"],
  ["airport_jfk", "airport_cdg"],
  ["airport_cdg", "airport_gru"],
];

/* ── Invariant de données ────────────────────────────────────────────────────────────────
 * L'invariant testé plus bas — « aucun `direct_assumed` » — n'est légitime QUE parce que toutes
 * les compagnies possèdent un graphe de routes. Si une compagnie sans graphe entrait un jour dans
 * la base, `direct_assumed` redeviendrait un état valide et l'invariant deviendrait un faux
 * positif silencieux. On vérifie donc d'abord sa prémisse, plutôt que de la supposer.
 * Demandé par Codex le 11/08/2026. */
console.log("— Prémisse : les 102 compagnies ont toutes un graphe de routes —");

const airlines = [...loadKB().airlines.values()];
check("la base contient bien 102 compagnies", airlines.length === 102, `${airlines.length} trouvée(s)`);
const sansGraphe = airlines.filter((a) => !a.direct_routes || a.direct_routes.length === 0);
check(
  "toutes possèdent un `direct_routes` non vide",
  sansGraphe.length === 0,
  sansGraphe.length
    ? `${sansGraphe.length} sans graphe : ${sansGraphe.slice(0, 8).map((a) => a.id).join(", ")}` +
      " — si c'est voulu, l'invariant `direct_assumed` ci-dessous doit être révisé, pas contourné."
    : "",
);

console.log("\n— Invariant : aucun `direct_assumed` tant que les 102 compagnies ont un graphe —");

let assumedTotal = 0;
const assumedDetail = [];
for (const [o, d] of ROUTES) {
  const r = await finder(o, d);
  const assumed = (r.airlines ?? []).filter((a) => a.itinerary_confidence === "direct_assumed");
  assumedTotal += assumed.length;
  for (const a of assumed) assumedDetail.push(`${o.slice(8)}→${d.slice(8)} : ${a.airline_id}`);
}
check(
  `aucune compagnie en \`direct_assumed\` sur les ${ROUTES.length} trajets de référence`,
  assumedTotal === 0,
  assumedTotal ? `${assumedTotal} occurrence(s) : ${assumedDetail.join(" · ")}` : "",
);

console.log("\n— Cas fondateur : Qantas CDG→SYD —");

const syd = await finder("airport_cdg", "airport_syd");
const qantas = (syd.airlines ?? []).find((a) => a.airline_id === "airline_qantas");
check("Qantas figure bien dans les résultats CDG→SYD", !!qantas);
if (qantas) {
  check(
    "Qantas n'est PAS annoncée en vol direct sur CDG→SYD",
    qantas.direct !== true,
    `direct=${qantas.direct}, itinerary_confidence=${qantas.itinerary_confidence}`,
  );
  check(
    "son `itinerary_confidence` relève de la correspondance, pas du direct",
    String(qantas.itinerary_confidence ?? "").startsWith("connection"),
    `itinerary_confidence=${qantas.itinerary_confidence}`,
  );
}

console.log("\n— Cohérence : tout `direct` annoncé doit être documenté —");

for (const [o, d] of ROUTES) {
  const r = await finder(o, d);
  const menteurs = (r.airlines ?? []).filter((a) => a.direct === true && a.itinerary_confidence !== "direct_documented");
  check(
    `${o.slice(8)}→${d.slice(8)} : tout \`direct: true\` porte \`direct_documented\``,
    menteurs.length === 0,
    menteurs.map((a) => `${a.airline_id}=${a.itinerary_confidence}`).join(", "),
  );
}

console.log("\n— Non-régression : le direct attesté doit survivre —");

const jfk = await finder("airport_cdg", "airport_jfk");
const directsJfk = (jfk.airlines ?? []).filter((a) => a.direct === true);
check(
  "CDG→JFK conserve au moins une compagnie en direct attesté",
  directsJfk.length > 0,
  `${directsJfk.length} direct(s)`,
);
check(
  "et toutes portent `direct_documented`",
  directsJfk.every((a) => a.itinerary_confidence === "direct_documented"),
  directsJfk.map((a) => `${a.airline_id}=${a.itinerary_confidence}`).join(", "),
);

/* ── Étiquette « compagnie du pays » ───────────────────────────────────────────────────────
 * P1 relevé par Codex le 11/08/2026 : `carrier_of_origin` n'est qu'une égalité de `country_id`,
 * alors que l'UI l'affichait comme « Compagnie nationale ». Sur un départ de France, les huit
 * compagnies rattachées à `country_fr` étaient étoilées comme nationales.
 *
 * Le calcul est conservé (le tri par compagnie du pays reste pertinent) ; c'est l'étiquette qui a
 * été corrigée. Ce test fige donc ce que le champ signifie VRAIMENT, pour qu'un futur lecteur ne
 * le reprenne pas pour un statut de porte-drapeau. */
console.log("\n— `carrier_of_origin` = immatriculation, pas statut national —");

const fr = await finder("airport_cdg", "airport_syd");
const marquees = (fr.airlines ?? []).filter((a) => a.carrier_of_origin).map((a) => a.airline_id);
check(
  "au départ de France, PLUSIEURS compagnies portent carrier_of_origin (c'est une immatriculation)",
  marquees.length > 1,
  `${marquees.length} : ${marquees.join(", ")}`,
);
/* Sur CDG→SYD, Air France est purement ABSENTE des résultats (elle ne dessert pas Sydney d'après
 * les données). Les seules compagnies étoilées « du pays de départ » y sont donc Air Tahiti Nui et
 * Aircalin — ce qui rendait l'ancien libellé « Compagnie nationale · départ » d'autant plus faux :
 * il désignait exclusivement des compagnies qui ne sont pas le porte-drapeau français, sur un
 * trajet où le porte-drapeau ne figure même pas. */
check(
  "sur CDG→SYD, aucune des marquées n'est le porte-drapeau français",
  marquees.length > 0 && !marquees.includes("airline_air_france"),
  marquees.join(", "),
);

/* Sur un trajet où Air France est présente, elle est marquée exactement comme les autres — le
 * champ ne hiérarchise pas, il constate une immatriculation.
 * (CDG→JFK ne fait ressortir qu'Air France : French Bee et La Compagnie partent d'Orly et
 * n'apparaissent que sur une recherche métropolitaine Paris → New York.) */
const jfkFr = await finder("airport_cdg", "airport_jfk");
const marqueesJfk = (jfkFr.airlines ?? []).filter((a) => a.carrier_of_origin).map((a) => a.airline_id);
check(
  "sur CDG→JFK, Air France est marquée",
  marqueesJfk.includes("airline_air_france"),
  `${marqueesJfk.length} : ${marqueesJfk.join(", ")}`,
);
const qantasSyd = (fr.airlines ?? []).find((a) => a.airline_id === "airline_qantas");
check(
  "Qantas est bien marquée côté destination sur CDG→SYD",
  !!qantasSyd && qantasSyd.carrier_of_destination === true,
  `carrier_of_destination=${qantasSyd && qantasSyd.carrier_of_destination}`,
);

console.log("\n=== SUMMARY ===");
console.log(fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
