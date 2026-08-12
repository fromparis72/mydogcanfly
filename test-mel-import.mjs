#!/usr/bin/env node
/**
 * Harnais « la règle d'importation de Melbourne ne s'applique qu'aux arrivées internationales ».
 *
 * Défaut d'origine (relevé par Codex le 12/08/2026) : `rule_au_mel_cargo_only` est de portée
 * GLOBALE et refusait cabine et soute sur toute requête dont la destination est Melbourne, sans
 * distinguer un vol intérieur australien d'une arrivée de l'étranger. Sa justification, elle,
 * ne parle que d'importation : un animal qui arrive à Melbourne sur un vol commercial
 * international doit voyager en fret manifesté, cabine et soute accompagnée interdites.
 * (Le passage obligé par Melbourne relève des GROUPES 2 et 3 ; pour la Nouvelle-Zélande et
 * l'île Norfolk, les guides publiés situent le contrôle au premier point d'entrée australien,
 * quel qu'il soit. Les îles Cocos sont aussi du groupe 1, mais le DAFF n'y publie aucun
 * parcours pour les chiens — rien n'y est présumé. Voir l'historique de la règle dans
 * `rules.json`, entrée du 12/08/2026.)
 * Une règle d'importation appliquée à un Sydney→Melbourne fermait donc la cabine à un chien
 * australien qui ne traverse aucune frontière, et refermera silencieusement le service
 * Pets in Cabin de Virgin Australia (ADL↔MEL, énuméré au communiqué officiel du 23/06/2026)
 * le jour où il sera modélisé.
 *
 * DEUX PIÈGES DE MÉTHODE, tous deux rencontrés en vrai, que ce harnais évite par construction :
 *
 * 1. `evaluate(kb, objetÉcritÀLaMain)` ne teste PAS le moteur de production. `contracts.ts` déclare
 *    `travel_type: TravelType.default("pet")` ; un objet construit à la main court-circuite ce
 *    défaut Zod et produit un contexte que le Worker ne génère jamais. La règle semblait alors
 *    dormante alors qu'elle se déclenche sur 100 % des requêtes réelles. Ici, TOUT scénario passe
 *    par `FinderRequest.parse()` — et un cas vérifie explicitement que le défaut est bien appliqué.
 *
 * 2. Vérifier `cabin === false` ne prouve rien : trois règles distinctes peuvent produire ce
 *    booléen, et la disparition de celle qu'on teste passerait inaperçue. On vérifie donc la
 *    PRÉSENCE ou l'ABSENCE de `rule_au_mel_cargo_only` dans `fired`, pas le verdict final.
 *
 * 3. Une assertion d'ABSENCE réussit trivialement quand aucune compagnie n'est candidate : plus
 *    personne n'est évalué, donc aucune règle ne se déclenche, donc « la règle est absente » —
 *    et le test devient vert au moment précis où il cesse de tester quoi que ce soit. Toute
 *    assertion négative exige donc AUSSI `decision.airlines.length > 0` (relevé par Codex,
 *    12/08/2026). De même, un aéroport témoin manquant doit faire ÉCHOUER la CI, jamais être
 *    sauté : un référentiel amputé est exactement ce que ce harnais doit détecter.
 *
 *   node --experimental-strip-types test-mel-import.mjs   (ou `npx tsx test-mel-import.mjs`)
 */
import { loadKB } from "./packages/knowledge/src/index.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { FinderRequest } from "./packages/engine/src/contracts.ts";

const RULE = "rule_au_mel_cargo_only";

let pass = 0;
let fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

const kb = loadKB();

/** Le seul chemin d'appel autorisé : le contrat d'abord, le moteur ensuite. */
const decide = (raw) => evaluate(kb, FinderRequest.parse(raw));

/** Tous les identifiants de règles déclenchées, toutes compagnies confondues. */
const firedRules = (decision) => {
  const out = new Set();
  for (const a of decision.airlines ?? []) for (const f of a.fired ?? []) out.add(f.rule_id);
  return out;
};

/**
 * Assertion d'absence NON VACUE : la règle doit être absente ET au moins une compagnie doit
 * avoir été évaluée. Sans la seconde condition, un référentiel vidé rendrait le test vert.
 */
const checkAbsent = (label, decision, rule = RULE) => {
  const n = (decision.airlines ?? []).length;
  const rules = firedRules(decision);
  check(
    `${label} : ${rule} absente`,
    n > 0 && !rules.has(rule),
    `compagnies candidates : ${n}${n === 0 ? " ← ASSERTION VACUE" : ""} | règles déclenchées : ${[...rules].join(", ") || "aucune"}`,
  );
};

const req = (origin, destination, extra = {}) => ({
  origin,
  destination,
  dog: { weight_kg: 6 },
  locale: "fr",
  ...extra,
});

console.log("=== 1. Vols INTÉRIEURS australiens vers Melbourne : la règle d'importation ne doit pas s'appliquer ===");
// Trois origines et non une seule : une correction qui ne tiendrait qu'à l'aéroport testé
// (Sydney) resterait fausse pour Perth et Brisbane. C'est le contre-test du contre-test.
for (const origin of ["airport_syd", "airport_per", "airport_bne"]) {
  const d = decide(req(origin, "airport_mel", { travel_type: "pet" }));
  checkAbsent(`${origin.replace("airport_", "").toUpperCase()}→MEL (travel_type=pet)`, d);
}

console.log("\n=== 2. Arrivées INTERNATIONALES à Melbourne : la règle doit s'appliquer ===");
// Trois pays de départ distincts, pour prouver que c'est bien « hors Australie » qui déclenche
// et non une propriété particulière de la France.
for (const [origin, label] of [
  ["airport_cdg", "France"],
  ["airport_lhr", "Royaume-Uni"],
  ["airport_sin", "Singapour"],
]) {
  // Pas de SKIP : un aéroport témoin manquant est un échec, pas une dispense.
  check(
    `${origin} présent au référentiel`,
    !!kb.airports.get(origin),
    "un aéroport témoin absent rendrait les assertions suivantes vides de sens",
  );
  const d = decide(req(origin, "airport_mel", { travel_type: "pet" }));
  const rules = firedRules(d);
  check(
    `${origin.replace("airport_", "").toUpperCase()}→MEL (${label}) : ${RULE} présente`,
    rules.has(RULE),
    `règles déclenchées : ${[...rules].join(", ") || "aucune"}`,
  );
}

console.log("\n=== 3. Le défaut travel_type=pet du contrat est bien appliqué ===");
// Sans ce contrôle, un harnais qui oublie `FinderRequest.parse()` testerait un moteur fantôme :
// la règle ne se déclenche pas, et l'absence serait lue comme une réussite du point 1.
{
  const parsed = FinderRequest.parse(req("airport_cdg", "airport_mel")); // travel_type OMIS
  check(
    "FinderRequest.parse() sans travel_type → \"pet\"",
    parsed.travel_type === "pet",
    `valeur obtenue : ${JSON.stringify(parsed.travel_type)}`,
  );
  const rules = firedRules(evaluate(kb, parsed));
  check(
    `CDG→MEL sans travel_type explicite : ${RULE} présente quand même`,
    rules.has(RULE),
    `règles déclenchées : ${[...rules].join(", ") || "aucune"}`,
  );
}

console.log("\n=== 4. La correction n'a pas élargi la règle ailleurs ===");
// Une destination australienne autre que Melbourne, depuis l'étranger : cette règle-ci ne décrit
// que Melbourne. Ce n'est PAS l'affirmation que Sydney serait libre — les autres points d'entrée
// ont leurs propres exigences, et une lacune connue est consignée dans l'historique de la règle
// (soute accompagnée encore affichée ouverte sur certaines arrivées du groupe 1 vers SYD et BNE).
// Ce contrôle vérifie une portée, pas une politique.
checkAbsent("CDG→SYD (la règle ne vise que Melbourne)", decide(req("airport_cdg", "airport_syd", { travel_type: "pet" })));
// Et un type de voyage hors périmètre : les chiens d'assistance relèvent d'un régime
// d'importation distinct, soumis à permis et à des aménagements raisonnables évalués
// individuellement (cats-dogs/assistance-dogs). Leur exclusion de cette règle générique ne
// signifie PAS que la cabine leur est automatiquement ouverte — c'est une question de portée.
checkAbsent("CDG→MEL, travel_type=service_dog", decide(req("airport_cdg", "airport_mel", { travel_type: "service_dog" })));

console.log("\n=== SUMMARY ===");
console.log(fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
