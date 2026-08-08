#!/usr/bin/env node
/* Entrée dans l'UE : séparer le parcours intra-UE du parcours depuis un pays tiers.
 *
 * POURQUOI CE SCRIPT EXISTE. Les 27 règles `rule_<iso>_import` des États membres se déclenchaient
 * sur une seule condition — `route.dest_country_id == country_<iso>` — tout en affirmant dans leur
 * texte le parcours intra-UE (« an EU pet passport », « between EU countries »). Le passeport
 * européen n'est pourtant délivré qu'à un animal DÉJÀ résidant dans l'UE. Résultat, pour
 * Minneapolis → Paris le Finder conseillait un document que le voyageur ne peut pas obtenir, et
 * passait sous silence le seul qui compte : le certificat sanitaire UE. Le voyageur se présentait
 * à l'embarquement avec le mauvais dossier. Ce n'était pas une limite du moteur — `route.origin_country_id`
 * existe depuis toujours (`packages/engine/src/evaluate.ts`) et les deux règles mexicaines
 * (`rule_mx_import_us_ca` / `rule_mx_import_other`) s'en servent déjà. Ces 27 règles ne l'utilisaient pas.
 *
 * CE QU'IL FAIT. Pour chacun des 27 États membres, deux règles au lieu d'une :
 *   — `rule_<iso>_import` garde son texte, inchangé, et reçoit la condition qui le rend enfin vrai :
 *     `route.origin_country_id` IN les 27. Le texte ne bouge pas, c'est son domaine qui se rétrécit.
 *   — `rule_<iso>_import_non_eu` est créée, avec la condition miroir NIN les 27, et décrit le vrai
 *     parcours depuis un pays tiers : puce ISO, vaccin antirabique valide, certificat sanitaire UE.
 *
 * POURQUOI ON NE RENOMME PAS LA PREMIÈRE EN `..._import_eu`. La forme des conditions suit exactement
 * le précédent mexicain (`in` / `nin` sur `route.origin_country_id`), mais l'identifiant, lui, est
 * conservé : `rule_id` remonte jusque dans le rapport de décision servi par l'API. Renommer 27 règles
 * casserait tout ce qui les cite au-dehors, pour un gain purement cosmétique.
 *
 * LA DONNÉE SENSIBLE : QUI EST DISPENSÉ DE TITRAGE. C'est le seul chiffre qu'on ne pouvait pas écrire
 * de mémoire. Source retenue, officielle : la Commission européenne, DG SANTÉ,
 * « Listing of territories and non-EU countries ». Attention, le cadre a changé : le règlement
 * d'exécution (UE) n° 577/2013 cité par le relevé du 5 août est remplacé par le règlement délégué
 * (UE) 2026/131 et le règlement d'exécution (UE) 2026/636 — l'ancienne « Annexe II » de 577/2013 est
 * devenue les Annexes I et II de 2026/636 (Annexe II amendée par 2026/1228, qui y ajoute le
 * Monténégro et la Serbie). Les certificats établis sous l'Annexe IV de 577/2013 restent valables
 * s'ils sont délivrés avant le 1er octobre 2026 ; ce n'est pas une exigence à afficher, seulement une
 * transition qui s'éteint.
 *
 * DEUX LISTES, PAS UNE, ET ELLES NE DISENT PAS LA MÊME CHOSE :
 *   — Annexe I (Andorre, Suisse, Féroé, Gibraltar, Groenland, Islande, Liechtenstein, Monaco,
 *     Saint-Marin, Vatican) : pas de titrage, ET un passeport délivré sur place REMPLACE le
 *     certificat sanitaire. Les confondre avec les pays tiers ordinaires ferait réclamer un
 *     certificat à un voyageur suisse qui n'en a pas besoin — d'où la phrase de sortie explicite
 *     à la fin du texte hors-UE, plutôt qu'une troisième règle.
 *   — Annexe II (États-Unis, Canada, Royaume-Uni, Japon, Australie, Mexique…) : pas de titrage,
 *     mais le certificat sanitaire reste obligatoire.
 * On ne retient de ces listes que les pays qui existent dans le référentiel ; les territoires absents
 * (Aruba, Curaçao, Wallis-et-Futuna…) sont signalés à l'exécution, jamais inventés en `country_xx`.
 *
 * CE QU'ON NE PEUT PAS TRANCHER DANS UNE RÈGLE UNIQUE. Une règle porte un texte, pas une branche.
 * Le texte hors-UE dit donc « titrage exigé seulement si le pays de départ n'est pas sur la liste »
 * au lieu de conclure. La liste elle-même part dans `params.no_titer_origin_country_ids`, prête à
 * être exploitée par l'UI le jour où elle voudra résoudre la condition pour le lecteur.
 *
 * ORIGINE INCONNUE. Si l'aéroport de départ n'est pas au référentiel, `route.origin_country_id` vaut
 * "" : le `nin` est vrai, c'est la règle hors-UE qui parle. Choix délibéré, et identique au précédent
 * mexicain — mieux vaut afficher le dossier le plus exigeant que de ne rien afficher du tout.
 *
 * VERRUE ASSUMÉE. Le vermifuge contre Echinococcus multilocularis (Finlande, Irlande, Malte) ne
 * dépend pas de l'origine : il suit la destination. Il reste donc dans les deux règles de ces trois pays.
 *
 * HORS PÉRIMÈTRE, MAIS RELEVÉ. `rule_ch_import`, `rule_no_import` et `rule_li_import` promettent elles
 * aussi un passeport européen sans condition d'origine. Ce ne sont pas des États membres : la
 * correction demande sa propre source (BLV suisse, Mattilsynet norvégien) et n'est pas faite ici.
 *
 * Idempotent : relancer ne duplique rien et ne réécrit rien.
 *   node packages/knowledge/scripts/regles-ue-origine.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = resolve(HERE, "../raw/rules.json");
const OBJECTS = resolve(HERE, "../raw/objects.json");
const dry = process.argv.includes("--dry");

const TODAY = "2026-08-08";
const REVIEWER = "MyDogCanFly Data Team";
const plus = (iso, d) => { const x = new Date(iso + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const REVIEW_DUE = plus(TODAY, 180); // cadence "country" (REVIEW_CADENCE_DAYS, common.ts)

/* Source officielle du dispositif d'entrée depuis un pays tiers (certificat, 10 jours, titrage). */
const SRC_ENTRY = "https://food.ec.europa.eu/animals/live-animal-movements/dogs-cats-and-ferrets/bringing-pet-eu-non-eu-country_en";
/* Source officielle des deux listes de pays dispensés de titrage. */
const SRC_LIST = "https://food.ec.europa.eu/animals/live-animal-movements/dogs-cats-and-ferrets/listing-territories-and-non-eu-countries_en";

/* Les 27 États membres. Appartenance à l'UE = fait public, pas une donnée à sourcer. */
const EU_ISO = ["at", "be", "bg", "hr", "cy", "cz", "dk", "ee", "fi", "fr", "de", "gr", "hu", "ie",
  "it", "lv", "lt", "lu", "mt", "nl", "pl", "pt", "ro", "sk", "si", "es", "se"];

/* Dispensés de titrage. Codes ISO recopiés tels quels des deux tableaux de la page Commission. */
const NO_TITER_ANNEX_I = ["ad", "ch", "fo", "gi", "gl", "is", "li", "mc", "sm", "va"];
const NO_TITER_ANNEX_II = ["ac", "ae", "ag", "ar", "au", "aw", "ba", "bb", "bh", "bm", "bq", "ca",
  "cl", "cw", "fj", "fk", "gb", "gg", "hk", "im", "jm", "jp", "je", "kn", "ky", "lc", "me", "ms",
  "mk", "mu", "mx", "my", "nc", "nz", "pf", "pm", "rs", "sg", "sh", "sx", "tt", "tw", "us", "vc",
  "vg", "vu", "wf"];

/* Destinations où le vermifuge s'ajoute — dépend de la destination, jamais de l'origine. */
const TAPEWORM = {
  fi: { en: "Finland", fr: "en Finlande" },
  ie: { en: "Ireland", fr: "en Irlande" },
  mt: { en: "Malta", fr: "à Malte" },
};

const rules = JSON.parse(readFileSync(RULES, "utf8"));
const objects = JSON.parse(readFileSync(OBJECTS, "utf8"));
const knownIso = new Set(objects.countries.map((c) => c.iso2.toLowerCase()));

const cid = (iso) => "country_" + iso;
const EU_IDS = EU_ISO.map(cid);
const keep = (list) => list.filter((iso) => knownIso.has(iso));
const dropped = [...NO_TITER_ANNEX_I, ...NO_TITER_ANNEX_II].filter((iso) => !knownIso.has(iso));
const NO_TITER_IDS = [...keep(NO_TITER_ANNEX_I), ...keep(NO_TITER_ANNEX_II)].map(cid).sort();
const PASSPORT_TERRITORY_IDS = keep(NO_TITER_ANNEX_I).map(cid).sort();

/* Texte hors-UE. Chaque fait avancé ici vient de la page DG SANTÉ citée en source. */
function rationaleEn(iso) {
  const tw = TAPEWORM[iso]
    ? ` Dogs entering ${TAPEWORM[iso].en} must also be treated against the tapeworm Echinococcus multilocularis by a veterinarian between 24 and 120 hours before arrival, certified on the same certificate.`
    : "";
  return "An EU pet passport is issued only to a pet already residing in the EU, so it is not an option from outside the EU. "
    + "The dog needs an ISO microchip, a valid rabies vaccination (first dose from 12 weeks of age, then a 21-day wait) and an EU animal health certificate "
    + "completed by an official veterinarian in the country of departure and endorsed by its competent authority, together with the owner's written declaration "
    + "that the movement is non-commercial. That certificate is valid 10 days, from its date of issue until the documentary and identity checks at a designated "
    + "travellers' point of entry, then 6 months for onward travel inside the EU. A rabies antibody titration test is required only when the country of departure "
    + "is not on the EU list of countries and territories exempt from it — a list that includes the United States, Canada, the United Kingdom, Japan, Australia, "
    + "Mexico and Switzerland; where it is required, the blood sample must be taken at least 30 days after vaccination and at least 90 days before the certificate is issued. "
    + "From Andorra, Switzerland, the Faroe Islands, Gibraltar, Greenland, Iceland, Liechtenstein, Monaco, San Marino or Vatican City, a pet passport issued there "
    + "replaces the certificate." + tw;
}

function rationaleFr(iso) {
  const tw = TAPEWORM[iso]
    ? ` Pour entrer ${TAPEWORM[iso].fr}, le chien doit en outre recevoir un traitement contre le ténia Echinococcus multilocularis, administré par un vétérinaire entre 24 et 120 heures avant l'arrivée et certifié sur le même certificat.`
    : "";
  return "Le passeport européen n'est délivré qu'à un animal résidant déjà dans l'UE : depuis un pays tiers, ce n'est pas une option. "
    + "L'animal doit avoir une puce ISO, une vaccination antirabique valide (première dose dès 12 semaines, puis 21 jours d'attente) et un certificat sanitaire UE "
    + "établi par un vétérinaire officiel du pays de départ et validé par son autorité compétente, accompagné de la déclaration écrite du propriétaire attestant "
    + "le caractère non commercial du voyage. Ce certificat est valable 10 jours, de sa date de délivrance jusqu'aux contrôles documentaire et d'identité au point "
    + "d'entrée voyageurs désigné, puis 6 mois pour circuler ensuite dans l'UE. Un titrage des anticorps antirabiques n'est exigé que si le pays de départ ne figure "
    + "pas sur la liste UE des pays et territoires dispensés — elle comprend les États-Unis, le Canada, le Royaume-Uni, le Japon, l'Australie, le Mexique et la Suisse ; "
    + "le cas échéant, la prise de sang doit avoir lieu au moins 30 jours après la vaccination et au moins 90 jours avant la délivrance du certificat. "
    + "Depuis Andorre, la Suisse, les îles Féroé, Gibraltar, le Groenland, l'Islande, le Liechtenstein, Monaco, Saint-Marin ou le Vatican, un passeport délivré "
    + "sur place remplace le certificat." + tw;
}

function nonEuRule(iso, euRule) {
  const docs = (euRule.params?.docs ?? []).filter((d) => d !== "eu_pet_passport");
  const i = docs.indexOf("tapeworm_treatment");
  const extra = ["eu_animal_health_certificate", "owner_declaration"];
  docs.splice(i < 0 ? docs.length : i, 0, ...extra);
  return {
    id: `rule_${iso}_import_non_eu`,
    scope: { type: "country", id: cid(iso) },
    category: "import_rules",
    criticality: "high", // le cas où l'on se présente avec le mauvais document
    applies_when: {
      all: [
        { fact: "route.dest_country_id", op: "eq", value: cid(iso) },
        { fact: "route.origin_country_id", op: "nin", value: EU_IDS },
      ],
    },
    effect: { action: "require" },
    params: {
      docs,
      lead_time_days: euRule.params?.lead_time_days ?? 21,
      // Depuis un pays NON dispensé : 30 j min entre vaccination et prise de sang, puis 90 j min
      // avant délivrance du certificat — soit 120 jours incompressibles.
      lead_time_days_if_titer_required: 120,
      health_certificate_validity_days: 10,
      titer_required_unless_origin_listed: true,
      no_titer_origin_country_ids: NO_TITER_IDS,
      passport_territory_origin_country_ids: PASSPORT_TERRITORY_IDS,
      no_titer_list_source_url: SRC_LIST,
    },
    rationale: rationaleEn(iso),
    rationale_i18n: { fr: rationaleFr(iso) },
    source: {
      url: SRC_ENTRY,
      source_type: "government",
      verified_date: TODAY,
      review_due: REVIEW_DUE,
      confidence: 5,
      reviewer: REVIEWER,
      history: [{
        date: TODAY,
        reviewer: REVIEWER,
        note: "Règle créée pour séparer l'origine hors-UE du parcours intra-UE. Vérifiée sur la page DG SANTÉ « Bringing a pet into the EU from a non-EU country » (règlement délégué (UE) 2026/131 ; certificat modèle Annexe III du règlement d'exécution (UE) 2026/705) et sur « Listing of territories and non-EU countries » pour la dispense de titrage (Annexes I et II du règlement d'exécution (UE) 2026/636).",
      }],
    },
  };
}

const added = [];
const scoped = [];
const missing = [];

for (const iso of EU_ISO) {
  const eu = rules.find((r) => r.id === `rule_${iso}_import`);
  if (!eu) { missing.push(iso); continue; }

  // 1. Restreindre la règle existante aux origines intra-UE. Le texte n'est pas touché.
  const conds = eu.applies_when?.all;
  if (!Array.isArray(conds)) { missing.push(iso + " (applies_when.all absent)"); continue; }
  if (!conds.some((c) => c.fact === "route.origin_country_id")) {
    conds.push({ fact: "route.origin_country_id", op: "in", value: EU_IDS });
    eu.source.history = eu.source.history ?? [];
    eu.source.history.push({
      date: TODAY,
      reviewer: REVIEWER,
      note: "Portée restreinte aux départs depuis un État membre : le texte affirmait le parcours intra-UE (passeport européen, aucun titrage) alors que la règle se déclenchait aussi depuis un pays tiers. Le parcours hors-UE est traité par rule_" + iso + "_import_non_eu.",
    });
    scoped.push(iso);
  }

  // 2. Créer la jumelle hors-UE, juste après, si elle n'existe pas déjà.
  if (!rules.some((r) => r.id === `rule_${iso}_import_non_eu`)) {
    rules.splice(rules.indexOf(eu) + 1, 0, nonEuRule(iso, eu));
    added.push(iso);
  }
}

if (!dry && (added.length || scoped.length)) {
  writeFileSync(RULES, JSON.stringify(rules, null, 2) + "\n");
}

console.log(`${dry ? "[--dry] " : ""}règles restreintes aux origines UE : ${scoped.length}${scoped.length ? " — " + scoped.join(", ") : ""}`);
console.log(`${dry ? "[--dry] " : ""}règles hors-UE créées : ${added.length}${added.length ? " — " + added.join(", ") : ""}`);
console.log(`liste sans titrage : ${NO_TITER_IDS.length} pays du référentiel${dropped.length ? ` ; ${dropped.length} territoires listés absents du référentiel, ignorés : ${dropped.join(", ")}` : ""}`);
if (missing.length) console.log("règles d'import introuvables :", missing.join(", "));
if (!added.length && !scoped.length) console.log("rien à faire — déjà en place.");
