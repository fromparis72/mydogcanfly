#!/usr/bin/env node
/* Corrections issues du retest en conditions réelles du 09/08/2026 (retour utilisateur détaillé,
 * 8 scénarios rejoués sur le site en production). Chaque point ci-dessous a été rejoué dans le
 * moteur AVANT correction pour confirmer le défaut, puis sourcé sur la page officielle de la
 * compagnie ou du gouvernement concerné — jamais sur la seule affirmation de l'utilisateur (« une
 * compagnie fait foi sur sa politique, jamais sur le droit d'un État », et aucune affirmation sans
 * source officielle).
 *
 * 1. EGYPTAIR — rule_egyptair_hold_weight interdisait la soute au-delà de 32 kg pour TOUTES les
 *    destinations. Source officielle (egyptair.com/en/fly/special-services/Pages/traveling-with-
 *    pets.aspx, relu le 09/08/2026) : le seuil général est 23 kg, au-delà duquel l'animal voyage
 *    SEUL et facturé comme deux pièces — mais reste en SOUTE. Les 32 kg ne sont un plafond
 *    (soute refusée au-delà) QUE pour deux destinations nommément citées : Tunisie et Tanzanie.
 *    Un Golden Retriever de 40 kg vers Le Caire se voyait donc à tort écarté de la soute. La
 *    règle est reportée sur ces deux pays uniquement ; aucune règle générale de plafond soute
 *    n'est ajoutée pour les autres destinations (la source n'en donne aucun).
 *
 * 2. ROYAUME-UNI — rule_gb_breed_ban_restricted_types (Dangerous Dogs Act 1991) ne listait que
 *    3 des 5 types interdits. Source officielle (gov.uk/control-dog-public/banned-dogs, relu le
 *    09/08/2026) : Pit Bull Terrier, Japanese Tosa, Dogo Argentino, Fila Brasileiro, XL Bully.
 *    Dogo Argentino et Fila Brasileiro manquaient — un Dogo Argentino vers Londres recevait
 *    « entrée autorisée », alors que le type est interdit d'importation par la loi.
 *
 * 3. SAINT-BERNARD — marqué brachycephalic:true dans breeds.json, sans aucune source. Absent de
 *    la liste "snub-nosed" officielle de Lufthansa, SWISS, KLM (relues le 09/08/2026) et de la
 *    liste de référence du secteur (airtransportanimal.com/en/list-dogs-cats-turned-up-noses).
 *    Racialement museau long (pas écrasé) — la classification était une erreur, pas une variante
 *    éditoriale. Corrigé à false. NOTE : ce champ concerne UNIQUEMENT le Saint-Bernard ; d'autres
 *    races du référentiel partagent potentiellement le même défaut (mesuré séparément, PAS corrigé
 *    ici — périmètre à trancher avec l'utilisateur, cf. rapport de session).
 *
 * 4. TRANSAVIA + ROYAUME-UNI — aucune règle ne couvrait cette route ; en l'absence de refus
 *    explicite, cabine/soute étaient refusées par d'autres règles (poids/gabarit) mais le FRET
 *    restait "autorisé" par défaut — l'absence de règle n'est pas une autorisation. Source
 *    officielle (transavia.com/help/en-eu/.../pet-travel-destinations, relue le 09/08/2026) :
 *    « Transavia does not transport pets to or from the United Kingdom [...] ». Nouvelle règle :
 *    refus total (cabine + soute + fret) dès que l'origine OU la destination est le Royaume-Uni.
 *
 * 5-6. LUFTHANSA — sa page officielle dédiée (lufthansa.com/us/en/dangerous-dogs, relue le
 *    09/08/2026) classe le Staffordshire Bull Terrier dans sa liste "museau écrasé" maison
 *    (soute + fret refusés, cabine seule) — DISTINCTE de la classification zoologique du
 *    référentiel (dog.brachycephalic reste false pour cette race : correct, general — c'est
 *    la politique PROPRE à Lufthansa qui diverge, pas la race elle-même). Et le Dogo Argentino
 *    dans sa liste "chiens de combat" (soute refusée, fret encore possible en caisse spéciale).
 *    Ces deux classifications sont donc encodées comme des règles PROPRES À LUFTHANSA
 *    (dog.breed_id), jamais en touchant le drapeau brachycephalic global de ces races.
 *
 * 7-8. SWISS — même mécanisme, sourcé sur swiss.com/us/en/prepare/special-care/animals-
 *    travelling (relue le 09/08/2026) : Staffordshire Bull Terrier en liste "museau écrasé"
 *    (soute + fret refusés), Dogo Argentino en liste "chiens dangereux" (soute refusée, fret en
 *    caisse spéciale).
 *
 * 9. KLM — sourcé sur klm.com/information/pets/reservation (relue le 09/08/2026) : Staffordshire
 *    Bull Terrier ET American Bully (XL) « cannot travel in the hold » — MAIS la page précise
 *    explicitement une alternative fret ("these breeds may travel in the cabin or via cargo
 *    services") : contrairement à Lufthansa/SWISS, KLM ne refuse donc QUE la soute, pas le fret.
 *
 * Volontairement NON ajouté par prudence de sourcing (pages non trouvées avec un niveau de
 * confiance suffisant au moment de la correction) : Iberia (aucune page officielle exploitable
 * trouvée), et pour Lufthansa/SWISS les autres races de leurs listes maison (American Pit Bull
 * Terrier, American Staffordshire Terrier, American Bulldog, Kangal, Berger du Caucase,
 * Rottweiler) — les deux résumés de pages obtenus se contredisaient sur le classement de
 * l'American Bully (« museau écrasé » chez Lufthansa vs « dangereux » chez SWISS), signe que le
 * niveau de confiance n'était pas suffisant pour les ajouter sans relecture directe de la page.
 *
 * Idempotent : relancer sans rien avoir changé ne modifie rien.
 *   node packages/knowledge/scripts/fix-live-testing-09-08.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(HERE, "../raw/rules.json");
const OBJECTS_PATH = resolve(HERE, "../raw/objects.json");
const dry = process.argv.includes("--dry");
const TODAY = "2026-08-09";
const REVIEWER = "MyDogCanFly Data Team";
const plus = (iso, d) => { const x = new Date(iso + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const REVIEW_DUE_COUNTRY = plus(TODAY, 180); // cadence "country" (REVIEW_CADENCE_DAYS, common.ts)
const REVIEW_DUE_AIRLINE = plus(TODAY, 90);  // cadence "airline"

let rules = JSON.parse(readFileSync(RULES_PATH, "utf8"));
let objects = JSON.parse(readFileSync(OBJECTS_PATH, "utf8"));
let changed = [];

// ---- 1. EgyptAir : plafond 32 kg reporté sur Tunisie/Tanzanie uniquement ----
{
  const r = rules.find((x) => x.id === "rule_egyptair_hold_weight");
  if (r && !r.applies_when.all.some((c) => c.fact === "route.dest_country_id")) {
    r.applies_when.all.push({ fact: "route.dest_country_id", op: "in", value: ["country_tn", "country_tz"] });
    r.rationale = "As accompanied baggage the combined dog + crate must not exceed about 32 kg for Tunisia and Tanzania; heavier dogs travel via cargo. (Other destinations: dogs over 23 kg travel individually, billed as two pieces, but remain hold-eligible.)";
    r.rationale_i18n = {
      fr: "En bagage accompagné, l'ensemble chien + caisse ne doit pas dépasser environ 32 kg pour la Tunisie et la Tanzanie ; au-delà, transport en fret. (Autres destinations : au-delà de 23 kg, l'animal voyage seul, facturé comme deux pièces, mais reste éligible à la soute.)",
      es: "Como equipaje acompañado, el conjunto perro + caja no debe superar unos 32 kg para Túnez y Tanzania; por encima, transporte en carga. (Otros destinos: por encima de 23 kg, el animal viaja solo, facturado como dos piezas, pero sigue siendo elegible para bodega.)",
      pt: "Como bagagem acompanhada, o conjunto cão + caixa não deve exceder cerca de 32 kg para a Tunísia e a Tanzânia; acima disso, transporte como carga. (Outros destinos: acima de 23 kg, o animal viaja sozinho, cobrado como duas peças, mas continua elegível para o porão.)",
    };
    r.source = {
      url: "https://www.egyptair.com/en/fly/special-services/Pages/traveling-with-pets.aspx",
      source_type: "official_website", verified_date: TODAY, review_due: REVIEW_DUE_AIRLINE,
      confidence: 4, reviewer: REVIEWER,
      history: [...(r.source.history ?? []), { date: TODAY, reviewer: REVIEWER, note: "Retest utilisateur du 09/08/2026 : le plafond 32 kg était appliqué à toutes les destinations au lieu de Tunisie/Tanzanie uniquement — reporté sur la page officielle EgyptAir." }],
    };
    changed.push("rule_egyptair_hold_weight : plafond 32 kg reporté sur Tunisie/Tanzanie uniquement");
  }
}

// ---- 2. Royaume-Uni : types interdits complétés (Dangerous Dogs Act 1991) ----
{
  const r = rules.find((x) => x.id === "rule_gb_breed_ban_restricted_types");
  const cond = r?.applies_when.all.find((c) => c.fact === "dog.breed_id");
  if (r && cond && Array.isArray(cond.value)) {
    const missing = ["breed_dogo_argentino", "breed_fila_brasileiro"].filter((id) => !cond.value.includes(id));
    if (missing.length) {
      cond.value.push(...missing);
      r.source = {
        ...r.source, verified_date: TODAY, review_due: REVIEW_DUE_COUNTRY,
        history: [...(r.source.history ?? []), { date: TODAY, reviewer: REVIEWER, note: `Retest utilisateur du 09/08/2026 : ${missing.join(", ")} manquant(s) — les 5 types de la Dangerous Dogs Act 1991 sont désormais tous listés (gov.uk/control-dog-public/banned-dogs).` }],
      };
      changed.push(`rule_gb_breed_ban_restricted_types : ${missing.join(", ")} ajouté(s)`);
    }
  }
}

// ---- 3. Saint-Bernard : brachycephalic corrigé à false ----
{
  const b = objects.breeds.find((x) => x.id === "breed_saint_bernard");
  if (b && b.brachycephalic === true) {
    b.brachycephalic = false;
    changed.push("breed_saint_bernard : brachycephalic true → false (absent de toute liste officielle sourcée)");
  }
}

// ---- 4. Transavia + Royaume-Uni : refus total ----
{
  const id = "rule_transavia_gb_no_pets";
  if (!rules.some((x) => x.id === id)) {
    rules.push({
      id, scope: { type: "airline", id: "airline_transavia" }, category: "placement", criticality: "critical",
      applies_when: { any: [
        { fact: "route.dest_country_id", op: "eq", value: "country_gb" },
        { fact: "route.origin_country_id", op: "eq", value: "country_gb" },
      ] },
      effect: { action: "deny" }, // pas de `placement` : refuse cabine + soute + fret (evaluate.ts)
      params: {},
      rationale: "Transavia does not transport pets to or from the United Kingdom on any route or placement.",
      rationale_i18n: {
        fr: "Transavia ne transporte aucun animal à destination ou en provenance du Royaume-Uni, quel que soit le mode.",
        es: "Transavia no transporta animales con destino o procedencia del Reino Unido, sea cual sea el modo.",
        pt: "A Transavia não transporta animais com destino ou origem no Reino Unido, seja qual for o modo.",
      },
      source: {
        url: "https://www.transavia.com/help/en-eu/children-pets-groups/pets-on-board/pet-travel-destinations",
        source_type: "official_website", verified_date: TODAY, review_due: REVIEW_DUE_AIRLINE,
        confidence: 4, reviewer: REVIEWER,
        history: [{ date: TODAY, reviewer: REVIEWER, note: "Ajout suite au retest utilisateur du 09/08/2026 : le fret s'affichait par défaut faute de règle explicite, alors que Transavia ne dessert aucun animal vers/depuis le Royaume-Uni." }],
      },
    });
    changed.push("rule_transavia_gb_no_pets : nouvelle règle (refus total UK)");
  }
}

// ---- 5-9. Restrictions de race propres à Lufthansa / SWISS / KLM ----
function addBreedRule(idSuffix, airlineId, breedIds, placements, sourceUrl, rationaleEn, rationaleFr, rationaleEs, rationalePt) {
  const id = `rule_${idSuffix}`;
  if (rules.some((x) => x.id === id)) return;
  rules.push({
    id, scope: { type: "airline", id: airlineId }, category: "breed_ban", criticality: "critical",
    applies_when: { all: [
      { fact: "dog.breed_id", op: "in", value: breedIds },
      { fact: "placement", op: "in", value: placements },
    ] },
    effect: { action: "deny", placement: placements },
    params: {},
    rationale: rationaleEn,
    rationale_i18n: { fr: rationaleFr, es: rationaleEs, pt: rationalePt },
    source: {
      url: sourceUrl, source_type: "official_website", verified_date: TODAY, review_due: REVIEW_DUE_AIRLINE,
      confidence: 4, reviewer: REVIEWER,
      history: [{ date: TODAY, reviewer: REVIEWER, note: "Ajout suite au retest utilisateur du 09/08/2026 — classification propre à cette compagnie (sa page officielle), distincte du référentiel racial général." }],
    },
  });
  changed.push(`${id} : nouvelle règle`);
}

addBreedRule(
  "lufthansa_snubnosed_own_list", "airline_lufthansa", ["breed_staffordshire_bull_terrier"], ["hold", "cargo"],
  "https://www.lufthansa.com/us/en/dangerous-dogs",
  "Lufthansa classifies the Staffordshire Bull Terrier under its own snub-nosed policy: not accepted in the hold or cargo.",
  "Lufthansa classe le Staffordshire Bull Terrier dans sa propre liste « museau écrasé » : refusé en soute et en fret.",
  "Lufthansa clasifica al Staffordshire Bull Terrier en su propia lista de raza «hocico chato»: no admitido en bodega ni en carga.",
  "A Lufthansa classifica o Staffordshire Bull Terrier na sua própria lista de raça «focinho achatado»: não aceito no porão nem na carga.",
);
addBreedRule(
  "lufthansa_fighting_dog_no_hold", "airline_lufthansa", ["breed_dogo_argentino"], ["hold"],
  "https://www.lufthansa.com/us/en/dangerous-dogs",
  "Lufthansa classifies the Dogo Argentino as a fighting/dangerous breed: not accepted in the hold; cargo remains possible in a reinforced crate.",
  "Lufthansa classe le Dogo Argentino comme chien de combat/dangereux : refusé en soute ; le fret reste possible en caisse renforcée.",
  "Lufthansa clasifica al Dogo Argentino como raza de combate/peligrosa: no admitido en bodega; la carga sigue siendo posible en caja reforzada.",
  "A Lufthansa classifica o Dogo Argentino como raça de combate/perigosa: não aceito no porão; a carga continua possível em caixa reforçada.",
);
addBreedRule(
  "swiss_snubnosed_own_list", "airline_swiss", ["breed_staffordshire_bull_terrier"], ["hold", "cargo"],
  "https://www.swiss.com/us/en/prepare/special-care/animals-travelling",
  "SWISS classifies the Staffordshire Bull Terrier under its own snub-nosed policy: not accepted in the hold or cargo.",
  "SWISS classe le Staffordshire Bull Terrier dans sa propre liste « museau écrasé » : refusé en soute et en fret.",
  "SWISS clasifica al Staffordshire Bull Terrier en su propia lista de raza «hocico chato»: no admitido en bodega ni en carga.",
  "A SWISS classifica o Staffordshire Bull Terrier na sua própria lista de raça «focinho achatado»: não aceito no porão nem na carga.",
);
addBreedRule(
  "swiss_fighting_dog_no_hold", "airline_swiss", ["breed_dogo_argentino"], ["hold"],
  "https://www.swiss.com/us/en/prepare/special-care/animals-travelling",
  "SWISS classifies the Dogo Argentino as a dangerous breed: not accepted in the hold; cargo remains possible in a reinforced crate.",
  "SWISS classe le Dogo Argentino comme race dangereuse : refusé en soute ; le fret reste possible en caisse renforcée.",
  "SWISS clasifica al Dogo Argentino como raza peligrosa: no admitido en bodega; la carga sigue siendo posible en caja reforzada.",
  "A SWISS classifica o Dogo Argentino como raça perigosa: não aceito no porão; a carga continua possível em caixa reforçada.",
);
addBreedRule(
  "klm_own_hold_list", "airline_klm", ["breed_staffordshire_bull_terrier", "breed_american_bully_xl"], ["hold"],
  "https://www.klm.com/information/pets/reservation",
  "KLM does not accept the Staffordshire Bull Terrier or the American Bully (XL) in the hold; cabin or cargo remain possible.",
  "KLM refuse le Staffordshire Bull Terrier et l'American Bully (XL) en soute ; la cabine ou le fret restent possibles.",
  "KLM no admite al Staffordshire Bull Terrier ni al American Bully (XL) en bodega; la cabina o la carga siguen siendo posibles.",
  "A KLM não aceita o Staffordshire Bull Terrier nem o American Bully (XL) no porão; a cabine ou a carga continuam possíveis.",
);

console.log(changed.length ? changed.join("\n") : "(aucun changement)");
console.log(`${dry ? "[--dry] " : ""}${changed.length} correction(s).`);
if (!dry && changed.length) {
  writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2) + "\n");
  writeFileSync(OBJECTS_PATH, JSON.stringify(objects, null, 2) + "\n");
}
