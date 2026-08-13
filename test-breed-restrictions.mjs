#!/usr/bin/env node
/**
 * Harnais du contrat `BreedRestriction` — le schéma seul, aucune donnée, aucun verdict touché.
 *
 * Chaque cas correspond à un défaut RÉEL. Ceux de la section « contre-épreuves » viennent de la
 * revue du 12/08/2026 : la première version du contrat acceptait `temperature_c > "hot"`,
 * `fr.mydogcanfly.com` comme source, la date `2026-99-99`, les tableaux dupliqués, et ignorait
 * les conflits entre une règle globale et une règle compagnie — c'est-à-dire exactement la
 * famille de défaut qu'elle prétendait empêcher.
 *
 *   npx tsx test-breed-restrictions.mjs
 */
import {
  BreedRestriction, ExecutablePredicate, FACT_TYPES, INJECTED_FACTS, MONTH_UNKNOWN, SENTINELS,
  MODELLED_DEFAULTS, sentinelRisks, unsatisfiable, isForbiddenSource, normalizeHost, validateBreedRestrictions,
} from "./packages/knowledge/src/breed-restrictions.ts";
import { FinderRequest, DestinationsRequest } from "./packages/engine/src/contracts.ts";
import { travelDateBounds } from "./packages/knowledge/src/common.ts";
import { travelDateBoundsClient } from "./packages/ui/src/lib/travel-date-bounds.ts";
import { Fact } from "./packages/knowledge/src/rules.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

const SOURCE = {
  url: "https://www.thaiairways.com/en/travel_information/pets.page",
  source_type: "official_website",
  verified_date: "2026-08-12",
  review_due: "2027-02-08",
  confidence: 4,
  reviewer: "MyDogCanFly Data Team",
  history: [],
  quote: "Snub-nosed breeds are not accepted in the aircraft hold.",
  quote_language: "en",
};
/** Référentiels connus — désormais OBLIGATOIRES : un contrôle qu'on peut désactiver par oubli
 *  n'est pas un contrôle. */
const K = {
  airlineIds: new Set(["airline_thai_airways", "airline_westjet", "airline_vietnam_airlines", "airline_etihad"]),
  breedIds: new Set(["breed_pug", "breed_boxer"]),
  countryIds: new Set(["country_fr", "country_th"]),
  airportIds: new Set(["airport_cdg", "airport_bkk"]),
};

const base = (over = {}) => ({
  id: "brest_thai_hold", airline_id: "airline_thai_airways",
  applies_to: { trait: "brachycephalic" }, action: "deny",
  placements: ["hold"], source: SOURCE, ...over,
});

console.log("=== 1. Cas nominal ===");
{
  const r = BreedRestriction.safeParse(base());
  check("une restriction bien formée est acceptée", r.success, JSON.stringify(r.error?.issues?.[0]));
}

console.log("\n=== 2. Provenance : le contrat Source existant, pas un second modèle ===");
// La première version recréait un modèle appauvri — sans source_type, review_due, confidence,
// reviewer ni history — et validait la date par expression régulière. Deux modèles de provenance
// dans un même dépôt, c'est la garantie qu'ils divergeront.
{
  for (const missing of ["source_type", "review_due", "confidence", "reviewer"]) {
    const s = { ...SOURCE }; delete s[missing];
    check(`champ \`${missing}\` obligatoire (hérité de Source)`, !BreedRestriction.safeParse(base({ source: s })).success);
  }
  check("date calendaire invalide refusée (2026-99-99)",
    !BreedRestriction.safeParse(base({ source: { ...SOURCE, verified_date: "2026-99-99" } })).success);
  check("date calendaire invalide refusée (2026-02-30)",
    !BreedRestriction.safeParse(base({ source: { ...SOURCE, verified_date: "2026-02-30" } })).success);
  check("citation trop courte refusée", !BreedRestriction.safeParse(base({ source: { ...SOURCE, quote: "non" } })).success);
  check("langue de citation obligatoire",
    !BreedRestriction.safeParse(base({ source: (({ quote_language, ...r }) => r)(SOURCE) })).success);
  check("champ inconnu dans source refusé",
    !BreedRestriction.safeParse(base({ source: { ...SOURCE, severity: "high" } })).success);
}

console.log("\n=== 3. Auto-citation : domaine racine ET sous-domaines ===");
// 41 des 48 règles brachycéphales actuelles se sourcent sur mydogcanfly.com.
{
  for (const u of [
    "https://mydogcanfly.com/x", "https://www.mydogcanfly.com/x",
    "https://fr.mydogcanfly.com/x", "https://mydogcanfly.com./x", "https://MyDogCanFly.COM/x",
  ]) check(`refusé : ${u}`, isForbiddenSource(u));
  for (const u of ["https://notmydogcanfly.com/x", "https://mydogcanfly.com.example.org/x", "https://www.iata.org/x"])
    check(`accepté : ${u}`, !isForbiddenSource(u));
  check("le hostname est normalisé (casse, point final)",
    normalizeHost("https://FR.MyDogCanFly.com./x") === "fr.mydogcanfly.com");
  check("intégré au schéma", !BreedRestriction.safeParse(base({ source: { ...SOURCE, url: "https://fr.mydogcanfly.com/x" } })).success);
}

console.log("\n=== 4. Conditions typées : le nom du fait ne suffit pas ===");
// `evalPredicate` compare deux nombres pour `gt` ; `temperature_c > "hot"` renvoie donc false en
// silence. Un fait de type incompatible est une condition inerte, comme un fait non injecté.
{
  check("`temperature_c gt \"hot\"` refusé", !ExecutablePredicate.safeParse({ fact: "weather.temperature_c", op: "gt", value: "hot" }).success);
  check("`brachycephalic eq \"yes\"` refusé", !ExecutablePredicate.safeParse({ fact: "dog.brachycephalic", op: "eq", value: "yes" }).success);
  check("`placement gt 5` refusé (opérateur sans effet)", !ExecutablePredicate.safeParse({ fact: "placement", op: "gt", value: 5 }).success);
  check("`placement eq \"soute\"` refusé (valeur hors énumération)", !ExecutablePredicate.safeParse({ fact: "placement", op: "eq", value: "soute" }).success);
  check("`dest_country_id eq \"FR\"` refusé (identifiant mal formé)", !ExecutablePredicate.safeParse({ fact: "route.dest_country_id", op: "eq", value: "FR" }).success);
  check("`in` avec liste vide refusé", !ExecutablePredicate.safeParse({ fact: "placement", op: "in", value: [] }).success);
  check("`eq` avec une liste refusé", !ExecutablePredicate.safeParse({ fact: "placement", op: "eq", value: ["hold"] }).success);
  check("`temperature_c gt 27` accepté", ExecutablePredicate.safeParse({ fact: "weather.temperature_c", op: "gt", value: 27 }).success);
  check("`brachycephalic eq true` accepté", ExecutablePredicate.safeParse({ fact: "dog.brachycephalic", op: "eq", value: true }).success);
  check("`placement in [hold, cargo]` accepté", ExecutablePredicate.safeParse({ fact: "placement", op: "in", value: ["hold", "cargo"] }).success);
}

console.log("\n=== 5. Le registre = ce que le moteur injecte, avec son type et son domaine ===");
{
  check("le registre porte type, opérateurs et domaine pour CHAQUE fait",
    INJECTED_FACTS.every((f) => typeof FACT_TYPES[f]?.kind === "string" && FACT_TYPES[f].ops.length > 0));
  check("tout fait du registre existe dans l'énumération Fact du moteur",
    INJECTED_FACTS.every((f) => Fact.options.includes(f)), INJECTED_FACTS.filter((f) => !Fact.options.includes(f)).join(", "));

  check("`season.month` fait maintenant partie du registre", INJECTED_FACTS.includes("season.month"));
  check("MONTH_UNKNOWN vaut 0", MONTH_UNKNOWN === 0);
  check("les deux sentinelles sont déclarées",
    SENTINELS["season.month"] === 0 && SENTINELS["dog.weight_kg"] === 0);

  // Bornes atteignables : une condition hors domaine est inerte, comme un fait non injecté.
  check("`temperature_c gt 999` refusé", !ExecutablePredicate.safeParse({ fact: "weather.temperature_c", op: "gt", value: 999 }).success);
  check("`weight_kg gt 999` refusé", !ExecutablePredicate.safeParse({ fact: "dog.weight_kg", op: "gt", value: 999 }).success);
  check("`breed_id eq \"breed_\"` refusé (préfixe seul)", !ExecutablePredicate.safeParse({ fact: "dog.breed_id", op: "eq", value: "breed_" }).success);

  // La parité avec le moteur n'est plus vérifiée par lecture du code source : `evaluate.ts` type
  // `baseCtx` avec Omit<EvalContextShape,"placement"> ET le contexte par canal avec
  // EvalContextShape complet — ce second typage couvre `placement`, que le premier excluait.
  // `npm run typecheck` EST le test de parité, dans les deux sens et pour les douze faits.
  check("le registre n'est pas vide", INJECTED_FACTS.length >= 12, `${INJECTED_FACTS.length} faits`);
}

console.log("\n=== 6. Strict, récursivement, et sans doublon ===");
{
  check("champ inconnu à la racine refusé", !BreedRestriction.safeParse(base({ severity: "high" })).success);
  check("champ inconnu dans applies_to refusé", !BreedRestriction.safeParse(base({ applies_to: { trait: "brachycephalic", note: "x" } })).success);
  check("champ inconnu dans une condition refusé",
    !ExecutablePredicate.safeParse({ fact: "dog.brachycephalic", op: "eq", value: true, weight: 1 }).success);
  check("placements vide refusé", !BreedRestriction.safeParse(base({ placements: [] })).success);
  check("placements dupliqués refusés", !BreedRestriction.safeParse(base({ placements: ["hold", "hold"] })).success);
  check("breed_ids dupliqués refusés",
    !BreedRestriction.safeParse(base({ applies_to: { breed_ids: ["breed_pug", "breed_pug"] } })).success);
  check("trait ET breed_ids ensemble refusés",
    !BreedRestriction.safeParse(base({ applies_to: { trait: "brachycephalic", breed_ids: ["breed_pug"] } })).success);
  check("identifiant mal formé refusé", !BreedRestriction.safeParse(base({ id: "thai-hold" })).success);
}

console.log("\n=== 7. `warn` : un avertissement, jamais un refus déguisé ===");
// L'IATA déconseille en saison chaude ; elle N'ÉNONCE AUCUN SEUIL. La version précédente de ce
// harnais encodait `temperature_c > 27` en l'attribuant à l'IATA : un chiffre inventé, dans le
// lot même qui interdit les affirmations sans source. Retiré.
{
  check("warn sans detail refusé", !BreedRestriction.safeParse(base({ id: "brest_w", action: "warn" })).success);
  check("require sans detail refusé", !BreedRestriction.safeParse(base({ id: "brest_r", action: "require" })).success);
  check("detail non localisé refusé", !BreedRestriction.safeParse(base({ id: "brest_w", action: "warn", detail: "texte brut" })).success);
  const iata = BreedRestriction.safeParse(base({
    id: "brest_iata_hot_season", airline_id: undefined, action: "warn", placements: ["hold", "cargo"],
    detail: { en: "Not recommended in hot season (IATA).", fr: "Déconseillé en saison chaude (IATA)." },
    // Pas de `when` : la source ne donne aucun seuil. Écrire une condition ici reviendrait à
    // inventer le chiffre que la page ne porte pas.
    source: {
      ...SOURCE, url: "https://www.iata.org/en/programs/cargo/live-animals/pets/",
      quote: "Transport of snub nose dogs, such as boxers, pugs, bulldogs and Pekinese, in hot season is not recommended.",
      locator: "Pets — General guidance",
    },
  }));
  check("l'avertissement IATA, cité et sans seuil inventé, est acceptable", iata.success, JSON.stringify(iata.error?.issues?.[0]));
}

console.log("\n=== 8. Chevauchements : matrice d'actions, portées, intervalles ===");
// La v2 traitait TOUTE différence d'action comme une contradiction : un avertissement IATA
// global à côté d'un refus compagnie était signalé, alors que les deux disent la même chose.
{
  const deny = base({ id: "brest_a" });
  const warnG = base({ id: "brest_g", airline_id: undefined, action: "warn", detail: { en: "hot season" } });
  check("`warn` global + `deny` compagnie : AUCUN signalement (warn compose)",
    validateBreedRestrictions([warnG, deny], K).length === 0,
    JSON.stringify(validateBreedRestrictions([warnG, deny], K)));
  check("`require` + `warn` : aucun signalement",
    validateBreedRestrictions([base({ id: "brest_x", action: "require", detail: { en: "a" } }), base({ id: "brest_y", action: "warn", detail: { en: "b" } })], K).length === 0);

  check("`allow` vs `deny` : CONTRADICTION — la contradiction fondatrice est exprimable",
    validateBreedRestrictions([base({ id: "brest_x", action: "allow" }), base({ id: "brest_y" })], K).some((i) => i.code === "CONTRADICTION"));
  check("`deny` + `require` : UNREACHABLE",
    validateBreedRestrictions([base({ id: "brest_x" }), base({ id: "brest_y", action: "require", detail: { en: "b" } })], K).some((i) => i.code === "UNREACHABLE"));

  check("conflit GLOBAL vs COMPAGNIE nommé comme tel",
    validateBreedRestrictions([base({ id: "brest_gd", airline_id: undefined, action: "allow" }), base({ id: "brest_t" })], K)
      .some((i) => i.code.startsWith("GLOBAL_VS_AIRLINE")));

  const T = (op, value) => ({ fact: "weather.temperature_c", op, value });
  check("intervalles démontrablement disjoints : aucun signalement",
    validateBreedRestrictions([base({ id: "brest_x", when: T("gt", 30) }), base({ id: "brest_y", action: "allow", when: T("lt", 10) })], K).length === 0);
  check("intervalles qui se chevauchent : POSSIBLE_CONFLICT",
    validateBreedRestrictions([base({ id: "brest_x", when: T("gt", 30) }), base({ id: "brest_y", action: "allow", when: T("gt", 27) })], K).some((i) => i.code === "POSSIBLE_CONFLICT"));
  check("conditions identiques et actions opposées : CONTRADICTION",
    validateBreedRestrictions([base({ id: "brest_x", when: T("gt", 30) }), base({ id: "brest_y", action: "allow", when: { value: 30, op: "gt", fact: "weather.temperature_c" } })], K).some((i) => i.code === "CONTRADICTION"));

  check("placements disjoints : rien",
    validateBreedRestrictions([deny, base({ id: "brest_d", placements: ["cabin"], action: "allow" })], K).length === 0);
  check("compagnies différentes : rien",
    validateBreedRestrictions([deny, base({ id: "brest_e", airline_id: "airline_westjet", action: "allow" })], K).length === 0);
  check("races disjointes : rien",
    validateBreedRestrictions([
      base({ id: "brest_f", applies_to: { breed_ids: ["breed_pug"] } }),
      base({ id: "brest_h", applies_to: { breed_ids: ["breed_boxer"] }, action: "allow" }),
    ], K).length === 0);
  check("identifiant en double détecté",
    validateBreedRestrictions([deny, base({ id: "brest_a", placements: ["cabin"] })], K).some((i) => i.code === "DUPLICATE_ID"));
  check("jeu cohérent : rien", validateBreedRestrictions([deny], K).length === 0);
}

console.log("\n=== 9. Identifiants vérifiés contre le référentiel fourni ===");
// Le module n'importe aucune donnée — sinon le contrat dépendrait de ce qu'il contraint.
// L'appelant fournit les ensembles connus ; sans eux, les identifiants ne sont pas vérifiés,
// et c'est explicite.
{
  check("compagnie inconnue détectée",
    validateBreedRestrictions([base({ airline_id: "airline_fake" })], K).some((i) => i.code === "UNKNOWN_AIRLINE"));
  check("race inconnue détectée",
    validateBreedRestrictions([base({ applies_to: { breed_ids: ["breed_fake"] } })], K).some((i) => i.code === "UNKNOWN_BREED"));
  check("identifiants connus : rien", validateBreedRestrictions([base()], K).length === 0);
  check("identifiant inconnu DANS une condition détecté",
    validateBreedRestrictions([base({ when: { fact: "route.dest_country_id", op: "eq", value: "country_fake" } })], K)
      .some((i) => i.code === "UNKNOWN_ID_IN_CONDITION"));
  check("…y compris imbriqué dans un `all`",
    validateBreedRestrictions([base({ when: { all: [{ fact: "dog.brachycephalic", op: "eq", value: true }, { fact: "route.dest_airport_id", op: "eq", value: "airport_fake" }] } })], K)
      .some((i) => i.code === "UNKNOWN_ID_IN_CONDITION"));
  check("identifiants connus dans une condition : rien",
    validateBreedRestrictions([base({ when: { fact: "route.dest_country_id", op: "eq", value: "country_fr" } })], K).length === 0);
  check("une règle globale ne déclenche pas UNKNOWN_AIRLINE",
    validateBreedRestrictions([base({ airline_id: undefined })], K).length === 0);
}

console.log("\n=== 10. Le contrat sait écrire les cas qui cassent aujourd'hui ===");
{
  const holdOnly = BreedRestriction.safeParse(base({
    id: "brest_westjet_hold", airline_id: "airline_westjet", placements: ["hold"],
    source: { ...SOURCE, url: "https://www.westjet.com/en-ca/travel-info/pets", quote: "Brachycephalic breeds may not travel in the baggage compartment." },
  }));
  check("« soute refusée » seule — le fret n'est ni ouvert ni fermé, il est non documenté", holdOnly.success);
  check("deux placements dans une entrée (vietnam_airlines : cabine + soute)",
    BreedRestriction.safeParse(base({ id: "brest_vn", airline_id: "airline_vietnam_airlines", placements: ["cabin", "hold"] })).success);
  check("liste nominative (thai_airways : 34 races)",
    BreedRestriction.safeParse(base({ id: "brest_thai_named", applies_to: { breed_ids: ["breed_pug", "breed_boxer"] } })).success);
  check("liste nominative vide refusée", !BreedRestriction.safeParse(base({ applies_to: { breed_ids: [] } })).success);
}

console.log("\n=== 11. Provenance : source officielle, dates cohérentes, protocole, langue ===");
{
  check("source_type `press` refusée pour un fait métier",
    !BreedRestriction.safeParse(base({ source: { ...SOURCE, source_type: "press" } })).success);
  check("source_type `other` refusée",
    !BreedRestriction.safeParse(base({ source: { ...SOURCE, source_type: "other" } })).success);
  check("source_type `regulation` acceptée",
    BreedRestriction.safeParse(base({ source: { ...SOURCE, source_type: "regulation" } })).success);
  check("`review_due` antérieur à `verified_date` refusé",
    !BreedRestriction.safeParse(base({ source: { ...SOURCE, review_due: "2026-01-01" } })).success);
  check("`ftp://` refusé", !BreedRestriction.safeParse(base({ source: { ...SOURCE, url: "ftp://example.com/p" } })).success);
  check("le grec (`el`) est accepté — plus de liste fermée",
    BreedRestriction.safeParse(base({ source: { ...SOURCE, quote_language: "el" } })).success);
  check("`pt-BR` accepté", BreedRestriction.safeParse(base({ source: { ...SOURCE, quote_language: "pt-BR" } })).success);
  check("étiquette de langue absurde refusée",
    !BreedRestriction.safeParse(base({ source: { ...SOURCE, quote_language: "français" } })).success);
}

console.log("\n=== 12. Sentinelles : contrôle FAIT PAR FAIT, sur « peut être vrai » ===");
// La v4 demandait si le prédicat était CERTAINEMENT vrai avec TOUTES les sentinelles à la fois.
// Quatre conditions passaient donc, alors qu'elles se déclenchent bel et bien quand une donnée
// manque. Un `unknown` n'est pas une absence de risque, c'est un « peut-être ».
{
  const when = (w) => BreedRestriction.safeParse(base({ when: w })).success;
  const M = (op, value) => ({ fact: "season.month", op, value });
  const W = (op, value) => ({ fact: "dog.weight_kg", op, value });
  const T = (op, value) => ({ fact: "weather.temperature_c", op, value });
  const P = (value) => ({ fact: "placement", op: "eq", value });

  for (const [label, w] of [
    ["all[weight lt 8, placement eq cabin]", { all: [W("lt", 8), P("cabin")] }],
    ["all[weight lt 8, month gt 0]", { all: [W("lt", 8), M("gt", 0)] }],
    ["all[month lt 3, temperature gt 30]", { all: [M("lt", 3), T("gt", 30)] }],
    ["all[month lt 3, weight gt 0]", { all: [M("lt", 3), W("gt", 0)] }],
    ["weight lt 8", W("lt", 8)], ["weight lte 8", W("lte", 8)],
    ["month eq 0", M("eq", 0)], ["month in [0,11]", M("in", [0, 11])],
    ["month lt 3", M("lt", 3)], ["month lte 1", M("lte", 1)], ["month gte 0", M("gte", 0)],
    ["any[weight lt 8, temperature gt 30]", { any: [W("lt", 8), T("gt", 30)] }],
  ]) check(`refusé : ${label}`, !when(w));

  // Les vraies gardes restent écrivables — sinon le contrat interdirait les seuils.
  for (const [label, w] of [
    ["all[weight gt 0, weight lt 8]", { all: [W("gt", 0), W("lt", 8)] }],
    ["month in [11,12,1,2]", M("in", [11, 12, 1, 2])],
    ["all[month in [11,12,1,2], weight gt 0]", { all: [M("in", [11, 12, 1, 2]), W("gt", 0)] }],
    ["weight gt 8", W("gt", 8)],
    ["temperature gt 30 (aucune sentinelle citée)", T("gt", 30)],
  ]) check(`accepté : ${label}`, when(w));

  check("un prédicat qui ne cite pas le poids n'est pas « risqué pour le poids »",
    sentinelRisks(M("in", [11, 12, 1, 2])).length === 0);
  check("sentinelRisks nomme le fait fautif",
    sentinelRisks({ all: [W("lt", 8), P("cabin")] }).includes("dog.weight_kg"));
  check("la sentinelle reste une borne (`weight gt 0`)", ExecutablePredicate.safeParse(W("gt", 0)).success);
  check("mais pas une valeur d'égalité (`weight eq 0`)", !ExecutablePredicate.safeParse(W("eq", 0)).success);
}

console.log("\n=== 12 bis. Conditions numériques inertes ===");
// La valeur était dans le domaine, mais la comparaison ne pouvait jamais être satisfaite.
{
  const t = (o) => ExecutablePredicate.safeParse(o).success;
  const M = (op, value) => ({ fact: "season.month", op, value });
  for (const [label, c] of [
    ["month gt 12", M("gt", 12)], ["month lt 0", M("lt", 0)],
    ["month eq 1.5", M("eq", 1.5)], ["month in [1.5]", M("in", [1.5])],
    ["weight_kg gt 120", { fact: "dog.weight_kg", op: "gt", value: 120 }],
    ["temperature_c lt -60", { fact: "weather.temperature_c", op: "lt", value: -60 }],
  ]) check(`refusé : ${label}`, !t(c));
  check("accepté : month gt 6", t(M("gt", 6)));
  check("accepté : temperature_c gt 30", t({ fact: "weather.temperature_c", op: "gt", value: 30 }));
  check("`docs.eu_passport eq \"unknown\"` refusé — le moteur ne l'injecte plus",
    !t({ fact: "docs.eu_passport", op: "eq", value: "unknown" }));
  check("`docs.eu_passport eq \"yes\"` accepté", t({ fact: "docs.eu_passport", op: "eq", value: "yes" }));
}

console.log("\n=== 13. La date du Finder est un contrat partagé ===");
// Mesuré avant correction : « garbage », « 2026-00-15 », « 2026-13-01 » et « 2027-02-30 » étaient
// tous acceptés, et le moteur en dérivait un mois NaN, 0, 13 ou 2 — une valeur qui viole son
// propre registre de faits.
{
  const fr = (date) => FinderRequest.safeParse({ origin: "airport_cdg", destination: "airport_jfk", dog: { weight_kg: 6 }, date }).success;
  for (const d of ["garbage", "2026-00-15", "2026-13-01", "2027-02-30", "2020-01-01"])
    check(`date refusée : ${d}`, !fr(d));

  // Frontières visées au JOUR PRÈS grâce à l'horloge injectable, au lieu d'une date lointaine
  // choisie au hasard qui vieillit avec le dépôt.
  const { min, max } = travelDateBounds();
  const plus = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  check(`borne basse acceptée : ${min}`, fr(min));
  check(`borne haute acceptée : ${max}`, fr(max));
  check(`max + 1 jour refusé : ${plus(max, 1)}`, !fr(plus(max, 1)));
  check(`min − 1 jour refusé : ${plus(min, -1)}`, !fr(plus(min, -1)));

  // Fin de mois : « 31 août + 18 mois » ne doit pas déborder sur mars.
  const b1 = travelDateBounds(new Date(Date.UTC(2026, 7, 31)));
  check(`31/08/2026 + 18 mois = 2028-02-29 exactement (2028 est bissextile) — obtenu ${b1.max}`, b1.max === "2028-02-29");
  const b2 = travelDateBounds(new Date(Date.UTC(2026, 0, 15)));
  check(`15/01/2026 + 18 mois = 15/07/2027 — obtenu ${b2.max}`, b2.max === "2027-07-15");
  check("date absente acceptée (le champ reste optionnel)", fr(undefined));
  check("DestinationsRequest partage le même contrat",
    !DestinationsRequest.safeParse({ origin: "airport_cdg", dog: {}, date: "2027-02-30" }).success);
}

console.log("\n=== 13 bis. Un seul algorithme de bornes, deux outils ===");
// DestinationFinder faisait `setMonth(getMonth() + 18)`, qui déborde en fin de mois : au 31 août,
// l'interface autorisait des jours de mars alors que le contrat serveur s'arrête au 29 février.
{
  for (const d of [Date.UTC(2026, 7, 31), Date.UTC(2026, 0, 15), Date.UTC(2026, 11, 31), Date.UTC(2027, 4, 30), Date.UTC(2028, 1, 29)]) {
    const iso = new Date(d).toISOString().slice(0, 10);
    const a = travelDateBoundsClient(new Date(d)), b = travelDateBounds(new Date(d));
    check(`client == serveur pour ${iso} (${a.max})`, a.max === b.max && a.min === b.min);
  }
  check("le débordement de setMonth est bien évité (31/08 → 29/02, pas 03/03)",
    travelDateBoundsClient(new Date(Date.UTC(2026, 7, 31))).max === "2028-02-29");

  /* CONVENTION ASSUMÉE, épinglée ici pour qu'elle ne dérive pas en silence : « aujourd'hui » est
   * le jour UTC, des deux côtés. Un visiteur en UTC−7 consultant le site à 18 h locales est déjà
   * au lendemain en UTC et ne peut pas choisir SA journée d'aujourd'hui — coût connu et accepté
   * (au pire une journée), en échange de la garantie qu'aucune date acceptée par la page ne sera
   * refusée par le moteur. Le corriger demanderait d'élargir la borne basse du serveur, donc de
   * modifier une règle du moteur : décision de produit, pas d'outillage.
   * Si ce contrôle tombe, c'est que quelqu'un est passé à l'heure locale d'un seul côté — le
   * scénario exact qui ramène le 400 que ce contrat existe pour éviter. */
  const soirCalifornien = new Date(Date.UTC(2026, 7, 14, 1, 0, 0)); // 13/08 18 h UTC−7
  check("convention UTC épinglée : 13/08 18 h en UTC−7 donne min = 2026-08-14, pas 2026-08-13",
    travelDateBoundsClient(soirCalifornien).min === "2026-08-14"
    && travelDateBounds(soirCalifornien).min === "2026-08-14");
}

console.log("\n=== 13 ter. Sentinelles non numériques ===");
// Le registre n'en déclarait que deux. Le moteur injecte aussi "" pour une race non choisie et
// pour une question passeport sans réponse : une condition dessus décide sur du vide.
{
  const when = (w) => BreedRestriction.safeParse(base({ when: w })).success;
  for (const [label, w] of [
    ['docs.eu_passport eq ""', { fact: "docs.eu_passport", op: "eq", value: "" }],
    ['docs.eu_passport neq "yes"', { fact: "docs.eu_passport", op: "neq", value: "yes" }],
    ['dog.breed_id neq "breed_pug"', { fact: "dog.breed_id", op: "neq", value: "breed_pug" }],
  ]) check(`refusé : ${label}`, !when(w));
  check('accepté : docs.eu_passport eq "yes"', when({ fact: "docs.eu_passport", op: "eq", value: "yes" }));
  check('accepté : dog.breed_id eq "breed_pug"', when({ fact: "dog.breed_id", op: "eq", value: "breed_pug" }));
  check("les valeurs MODÉLISÉES ne sont pas des sentinelles (taille, brachy, température)",
    MODELLED_DEFAULTS.length === 3 && !MODELLED_DEFAULTS.some((f) => f in { "season.month": 1, "dog.weight_kg": 1 }));
}

console.log("\n=== 13 quater. Prédicats globalement inertes ===");
// Le contrôle portait feuille par feuille : une conjonction impossible passait.
{
  const when = (w) => BreedRestriction.safeParse(base({ when: w })).success;
  for (const [label, w] of [
    ["all[month gt 10, month lt 5]", { all: [{ fact: "season.month", op: "gt", value: 10 }, { fact: "season.month", op: "lt", value: 5 }] }],
    ["all[placement eq cabin, placement eq hold]", { all: [{ fact: "placement", op: "eq", value: "cabin" }, { fact: "placement", op: "eq", value: "hold" }] }],
    ["placement nin [cabin, hold, cargo]", { fact: "placement", op: "nin", value: ["cabin", "hold", "cargo"] }],
    ["dog.size nin [toutes les tailles]", { fact: "dog.size", op: "nin", value: ["toy", "small", "medium", "large", "giant"] }],
  ]) check(`refusé : ${label}`, !when(w));
  check("accepté : placement in [hold, cargo]", when({ fact: "placement", op: "in", value: ["hold", "cargo"] }));
  check("accepté : all[month in [11,12,1,2], weight gt 0]",
    when({ all: [{ fact: "season.month", op: "in", value: [11, 12, 1, 2] }, { fact: "dog.weight_kg", op: "gt", value: 0 }] }));
  check("unsatisfiable() nomme le fait fautif",
    (unsatisfiable({ all: [{ fact: "season.month", op: "gt", value: 10 }, { fact: "season.month", op: "lt", value: 5 }] }) || "").includes("season.month"));
}

console.log("\n=== 13 quinquies. Les cinq contournements de la v6, et le cas `not` ===");
/* Relevés par Codex le 13/08/2026, tous acceptés par la version précédente. Cinq CAUSES
 * distinctes, et non cinq variantes d'une même :
 *   1. `v + Number.EPSILON` ne décale pas 30 en IEEE-754 (epsilon = 2⁻⁵², ULP de 30 = 2⁻⁴⁸) ;
 *   2. le caractère ENTIER de `season.month` n'était pas lu ;
 *   3. `neq`, `in` et `nin` étaient ignorés sur les faits numériques ;
 *   4. les `all` imbriqués n'étaient pas aplatis dans une même conjonction ;
 *   5. le booléen n'était pas traité comme le domaine fini {true, false}.
 *
 * Tout passe par `BreedRestriction.safeParse()` — l'API PUBLIQUE — et non par le helper : un
 * garde-fou qui n'est pas branché sur le schéma ne protège personne. Et le motif du refus est
 * vérifié : un refus obtenu pour une AUTRE raison (sentinelle, domaine, opérateur) rendrait le
 * contrôle vert sans rien prouver.
 */
{
  const refusePourInertie = (w) => {
    const r = BreedRestriction.safeParse(base({ when: w }));
    if (r.success) return false;
    return r.error.issues.some((i) => (i.message || "").includes("inerte"));
  };
  const C = (fact, op, value) => ({ fact, op, value });

  for (const [label, w] of [
    ["weight_kg gt 30 && weight_kg lte 30", { all: [C("dog.weight_kg", "gt", 30), C("dog.weight_kg", "lte", 30)] }],
    ["month gt 10 && month lt 11 (aucun entier entre)", { all: [C("season.month", "gt", 10), C("season.month", "lt", 11)] }],
    ["month eq 5 && month neq 5", { all: [C("season.month", "eq", 5), C("season.month", "neq", 5)] }],
    ["month gt 10 && all[month lt 5, placement eq cabin] (all imbriqué)",
      { all: [C("season.month", "gt", 10), { all: [C("season.month", "lt", 5), C("placement", "eq", "cabin")] }] }],
    ["brachycephalic eq true && eq false (domaine booléen)",
      { all: [C("dog.brachycephalic", "eq", true), C("dog.brachycephalic", "eq", false)] }],
    ["temperature_c gte 20 && lte 20 && neq 20 (seule valeur possible exclue)",
      { all: [C("weather.temperature_c", "gte", 20), C("weather.temperature_c", "lte", 20), C("weather.temperature_c", "neq", 20)] }],
    ["breed_id eq breed_pug && neq breed_pug", { all: [C("dog.breed_id", "eq", "breed_pug"), C("dog.breed_id", "neq", "breed_pug")] }],
    ["any[placement nin les 3, month gt 10 && lt 11] (toutes les branches inertes)",
      { any: [C("placement", "nin", ["cabin", "hold", "cargo"]), { all: [C("season.month", "gt", 10), C("season.month", "lt", 11)] }] }],
  ]) check(`refusé COMME INERTE : ${label}`, refusePourInertie(w));

  /* `not` : traité par mise en forme normale négative, donc EXACTEMENT et non par approximation.
   * L'ancienne version renvoyait `null` dès qu'elle voyait un `not`. */
  for (const [label, w] of [
    ["not(placement in [cabin, hold, cargo])", { not: C("placement", "in", ["cabin", "hold", "cargo"]) }],
    ["not(any[placement eq cabin, placement eq hold, placement eq cargo])",
      { not: { any: [C("placement", "eq", "cabin"), C("placement", "eq", "hold"), C("placement", "eq", "cargo")] } }],
    ["not(brachycephalic eq true) && brachycephalic eq true",
      { all: [{ not: C("dog.brachycephalic", "eq", true) }, C("dog.brachycephalic", "eq", true)] }],
    ["not(not(placement nin [cabin, hold, cargo]))", { not: { not: C("placement", "nin", ["cabin", "hold", "cargo"]) } }],
  ]) check(`refusé COMME INERTE : ${label}`, refusePourInertie(w));

  /* TÉMOINS — sans eux, « tout refuser » validerait ce fichier. Chacun doit rester ACCEPTÉ. */
  for (const [label, w] of [
    ["not(placement eq cabin)", { not: C("placement", "eq", "cabin") }],
    ["month gte 6 && month lte 8", { all: [C("season.month", "gte", 6), C("season.month", "lte", 8)] }],
    ["weight_kg gt 0 && weight_kg lt 8 (garde de sentinelle)",
      { all: [C("dog.weight_kg", "gt", 0), C("dog.weight_kg", "lt", 8)] }],
    ["temperature_c gt 20 && lt 30 (bornes strictes, intervalle réel)",
      { all: [C("weather.temperature_c", "gt", 20), C("weather.temperature_c", "lt", 30)] }],
    ["month gt 10 && month lt 12 (le 11 reste possible)",
      { all: [C("season.month", "gt", 10), C("season.month", "lt", 12)] }],
    ["breed_id in [breed_pug, breed_boxer] (appartenance positive)",
      C("dog.breed_id", "in", ["breed_pug", "breed_boxer"])],
  ]) check(`accepté : ${label}`, BreedRestriction.safeParse(base({ when: w })).success,
      JSON.stringify(BreedRestriction.safeParse(base({ when: w })).error?.issues?.[0]));

  /* FRONTIÈRE entre les deux garde-fous, qu'il ne faut pas confondre. Ces deux prédicats sont
   * satisfaisables — il leur reste une valeur possible — mais cette valeur est la SENTINELLE :
   * ils ne se déclenchent QUE lorsque la donnée manque. C'est le second garde-fou qui les refuse,
   * et son message est le bon diagnostic ; « condition inerte » serait faux.
   *
   * Conséquence de conception, assumée : sur un fait dont l'absence est notée `""`, seules les
   * formes d'APPARTENANCE (`eq`, `in`) sont écrivables. `neq`/`nin` se déclenchent par
   * construction quand la race est inconnue — « tout sauf le carlin » inclut « on ne sait pas ».
   */
  const refusePourSentinelle = (w) => {
    const r = BreedRestriction.safeParse(base({ when: w }));
    return !r.success && r.error.issues.some((i) => (i.message || "").includes("sentinelle"));
  };
  check("refusé COMME SENTINELLE, pas comme inerte : month nin [1..12] (ne reste que 0 = inconnu)",
    refusePourSentinelle(C("season.month", "nin", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])));
  check("refusé COMME SENTINELLE, pas comme inerte : breed_id nin [breed_pug, breed_boxer]",
    refusePourSentinelle(C("dog.breed_id", "nin", ["breed_pug", "breed_boxer"])));

  /* La LIMITE, écrite plutôt que tue : un `any` à l'intérieur d'une conjonction n'est pas
   * distribué. Ce prédicat est vide et passe — la mise en forme disjonctive qu'il faudrait pour
   * le voir explose en taille. Ce contrôle échouera le jour où quelqu'un la mettra en œuvre : ce
   * sera alors une bonne nouvelle, à consigner ici. */
  check("LIMITE ASSUMÉE : all[month gt 10, any[month lt 5, month lt 3]] passe (pas de distribution)",
    BreedRestriction.safeParse(base({ when: {
      all: [C("season.month", "gt", 10), { any: [C("season.month", "lt", 5), C("season.month", "lt", 3)] }],
    } })).success);
}

console.log("\n=== 14. Exemple SYNTHÉTIQUE de fenêtre calendaire ===");
// ATTENTION — cet exemple est VOLONTAIREMENT synthétique. La version précédente attribuait à une
// URL Etihad une phrase (« accepted as cargo from 1 November to 1 March only ») qui NE FIGURE PAS
// sur cette page : j'avais fabriqué une citation dans le lot dont l'objet est d'interdire les
// affirmations sans source. Aucune politique de compagnie n'est écrite ici ; la vraie viendra de
// l'audit, avec sa page officielle.
//
// À noter pour l'audit : `in [11,12,1,2]` ne dit PAS « jusqu'au 1er mars » — le 1er mars tombe
// en dehors. Une fenêtre au jour près exigera un fait `month_day` ou une condition de date, ce
// que le registre ne porte pas encore. À trancher quand une source réelle l'imposera.
{
  const fenetre = BreedRestriction.safeParse(base({
    id: "brest_exemple_fenetre", airline_id: "airline_etihad", action: "allow", placements: ["cargo"],
    when: { fact: "season.month", op: "in", value: [11, 12, 1, 2] },
    source: {
      ...SOURCE, url: "https://example.org/politique-synthetique",
      quote: "EXEMPLE SYNTHÉTIQUE — aucune compagnie réelle n'est décrite ici.",
      quote_language: "fr",
    },
  }));
  check("une fenêtre de mois est exprimable", fenetre.success, JSON.stringify(fenetre.error?.issues?.[0]));
  check("elle n'invente aucune température",
    fenetre.success && !JSON.stringify(fenetre.data.when).includes("temperature"));
}

console.log("\n=== SUMMARY ===");
console.log(fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
