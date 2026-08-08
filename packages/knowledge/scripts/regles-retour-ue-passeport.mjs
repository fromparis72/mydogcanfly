#!/usr/bin/env node
/* Retour vers l'UE : le passeport européen n'est pas annulé par une escale hors d'Europe.
 *
 * LE DÉFAUT CORRIGÉ. Le 8 août 2026, `regles-ue-origine.mjs` a créé 27 règles
 * `rule_<iso>_import_non_eu` conditionnées sur la seule origine du vol : dès que le pays de départ
 * n'est pas un État membre, elles imposent un certificat sanitaire UE établi par un vétérinaire
 * officiel du pays de départ. C'est juste pour un chien qui part pour la première fois d'un pays
 * tiers. C'est FAUX pour un chien européen qui rentre chez lui. Sur Paris → New York → Paris — un
 * des trajets les plus courants du site — le Finder envoyait le propriétaire faire endosser un
 * certificat par l'USDA alors que son passeport suffisait.
 *
 * CE QUE DIT LA SOURCE, MOT POUR MOT. Commission européenne, DG SANTÉ, « Bringing a pet into the EU
 * from a non-EU country », section « Exceptions › Animal health certificate », point 2 : un animal
 * peut entrer dans l'UE sans certificat sanitaire s'il « enters an EU country after movement to a
 * non-EU country or territory, and it can be established from the pet passport completed by an
 * authorised veterinarian that BEFORE LEAVING THE EU, the pet animal complies with the conditions
 * for rabies vaccination and for the rabies antibody titration test, WHERE APPLICABLE ».
 * La FAQ de la même direction le redit en clair : « You may use an EU pet passport to enter the EU
 * after a short stay in a non-EU country or territory, provided the passport […] shows that before
 * leaving the EU, your pet met the required conditions for rabies vaccination and for the rabies
 * antibody titration test, where applicable. If these conditions cannot be established from the EU
 * pet passport you will need an animal health certificate instead. »
 * https://food.ec.europa.eu/animals/live-animal-movements/dogs-cats-and-ferrets/bringing-pet-eu-non-eu-country_en
 * https://food.ec.europa.eu/animals/live-animal-movements/dogs-cats-and-ferrets/faqs_en
 *
 * TROIS PIÈGES DE LA SOURCE, à ne pas gommer dans le texte des règles :
 *   1. « WHERE APPLICABLE » porte aussi sur le TITRAGE, pas seulement sur la vaccination. Un chien
 *      parti vers un pays non listé sans titrage préalable ne peut pas invoquer la dispense. La même
 *      page ajoute d'ailleurs que le délai de 90 jours entre prise de sang et certificat ne s'applique
 *      pas au retour d'un animal résidant habituellement dans l'UE dont le passeport atteste un titrage
 *      favorable ANTÉRIEUR à sa sortie de l'UE — c'est la contrepartie de la dispense, on la cite.
 *   2. « SHORT STAY » : la dispense couvre un séjour, pas un déménagement. La FAQ est catégorique —
 *      un propriétaire qui réside désormais hors de l'UE ne peut plus utiliser le passeport, même de
 *      nationalité européenne, même propriétaire d'un bien dans l'UE. La règle le dit en clair, sinon
 *      on remplace une erreur par une autre.
 *   3. GRANDE-BRETAGNE : un passeport européen délivré à un résident britannique n'est plus valable
 *      depuis le 31/12/2020, sans période transitoire. Mentionné dans le texte plutôt qu'en 28ᵉ règle.
 *
 * POURQUOI UNE QUESTION, ET POURQUOI CELLE-LÀ. Le moteur ne connaît que l'origine du vol, jamais
 * l'historique de l'animal : aucune condition sur `route.*` ne peut trancher. Il fallait donc un fait
 * déclaré. Le libellé validé — « Ton chien a-t-il un passeport européen dont le vaccin antirabique
 * était valide avant de quitter l'UE ? » — interroge LE DOCUMENT DÉTENU, pas l'origine de l'animal ni
 * son statut juridique : le visiteur ouvre son carnet et répond, et la réponse recouvre exactement la
 * condition réglementaire. Elle arrive dans le contrat sous `eu_passport` et devient le fait
 * `docs.eu_passport` (packages/engine/src/evaluate.ts).
 *
 * LA RÈGLE DE PRUDENCE, QUI EST LE CŒUR DU DISPOSITIF. Les deux règles se recouvrent volontairement :
 *   — parcours passeport  : `docs.eu_passport` IN ["yes", "unknown", ""]
 *   — parcours certificat : `docs.eu_passport` IN ["no",  "unknown", ""]
 * Sans réponse ("") ou avec « je ne sais pas », LES DEUX se déclenchent et le rapport affiche les deux
 * parcours. On n'impose jamais le certificat par défaut d'information : mieux vaut un visiteur qui lit
 * deux paragraphes qu'un visiteur envoyé chez le vétérinaire pour rien. C'est aussi pour ça que
 * l'absence de réponse est une chaîne VIDE et non "no" — confondre les deux réintroduirait le défaut.
 *
 * LE TEXTE HORS-UE EST RETOUCHÉ, PAS RÉÉCRIT. Sa première phrase affirmait « le passeport européen
 * n'est délivré qu'à un animal résidant déjà dans l'UE : depuis un pays tiers, ce n'est pas une
 * option ». Vrai pour la délivrance, faux pour l'usage — et surtout, affiché à côté du parcours
 * passeport dans le cas « je ne sais pas », cela se contredisait à l'écran. Seule cette phrase change.
 *
 * CE QU'ON NE TOUCHE PAS. `rule_<iso>_import` (intra-UE) : une origine intra-UE ne pose pas la
 * question du retour. Le vermifuge Echinococcus (Finlande, Irlande, Malte) suit la destination et non
 * l'origine : il est donc repris tel quel dans la règle de retour. `rule_ch_import`, `rule_no_import`
 * et `rule_li_import` restent hors périmètre — ce ne sont pas des États membres, elles demandent leur
 * propre source.
 *
 * Idempotent : relancer ne duplique rien et ne réécrit rien.
 *   node packages/knowledge/scripts/regles-retour-ue-passeport.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = resolve(HERE, "../raw/rules.json");
const dry = process.argv.includes("--dry");

const TODAY = "2026-08-08";
const REVIEWER = "MyDogCanFly Data Team";
const plus = (iso, d) => { const x = new Date(iso + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const REVIEW_DUE = plus(TODAY, 180); // cadence "country" (REVIEW_CADENCE_DAYS, common.ts)

const SRC_ENTRY = "https://food.ec.europa.eu/animals/live-animal-movements/dogs-cats-and-ferrets/bringing-pet-eu-non-eu-country_en";
const SRC_FAQ = "https://food.ec.europa.eu/animals/live-animal-movements/dogs-cats-and-ferrets/faqs_en";

/* Les 27 États membres, dans l'ordre exact de regles-ue-origine.mjs (les conditions doivent coïncider). */
const EU_ISO = ["at", "be", "bg", "hr", "cy", "cz", "dk", "ee", "fi", "fr", "de", "gr", "hu", "ie",
  "it", "lv", "lt", "lu", "mt", "nl", "pl", "pt", "ro", "sk", "si", "es", "se"];
const cid = (iso) => "country_" + iso;
const EU_IDS = EU_ISO.map(cid);

/* Valeurs du fait `docs.eu_passport`. "" = question non posée ou sans réponse. */
const YES_SIDE = ["yes", "unknown", ""];
const NO_SIDE = ["no", "unknown", ""];

/* Destinations où le vermifuge s'ajoute — dépend de la destination, jamais de l'origine ni du document. */
const TAPEWORM = {
  fi: { en: "Finland", fr: "en Finlande", es: "a Finlandia" },
  ie: { en: "Ireland", fr: "en Irlande", es: "a Irlanda" },
  mt: { en: "Malta", fr: "à Malte", es: "a Malta" },
};

/* ---- Texte du parcours passeport (retour vers l'UE) ---- */
function returningEn(iso) {
  const tw = TAPEWORM[iso]
    ? ` Entering ${TAPEWORM[iso].en} additionally requires a treatment against the tapeworm Echinococcus multilocularis, given by a veterinarian between 24 and 120 hours before arrival and certified in the passport by the vet who administered it.`
    : "";
  return "Coming back to the EU after a stay abroad, your dog can re-enter on its EU pet passport alone — no EU animal health certificate is needed — provided the passport, completed by an authorised veterinarian, establishes that BEFORE it left the EU the dog already met the rabies vaccination conditions and, where applicable, the rabies antibody titration test. "
    + "It still needs its ISO microchip and a rabies vaccination that is valid on the day of travel; a booster given abroad can be entered in Section V of the passport by an authorised veterinarian. "
    + "For a dog habitually residing in the EU whose passport certifies a favourable titration test carried out before departure, the 90-day waiting period between the blood sample and the paperwork does not apply on the way back. "
    + "If any of these elements cannot be established from the passport, an EU animal health certificate is required instead. "
    + "Two limits: this covers a stay abroad, not a change of residence — once the owner habitually resides outside the EU the passport can no longer be used, whatever their nationality or property in the EU; "
    + "and an EU pet passport issued to an owner resident in Great Britain has not been valid for travel to the EU since 31 December 2020." + tw;
}

function returningFr(iso) {
  const tw = TAPEWORM[iso]
    ? ` Pour entrer ${TAPEWORM[iso].fr}, il faut en plus un traitement contre le ténia Echinococcus multilocularis, administré par un vétérinaire entre 24 et 120 heures avant l'arrivée et certifié dans le passeport par celui qui l'a donné.`
    : "";
  return "Au retour d'un séjour hors d'Europe, ton chien rentre avec son seul passeport européen — aucun certificat sanitaire UE n'est nécessaire — dès lors que ce passeport, rempli par un vétérinaire habilité, établit qu'AVANT sa sortie de l'UE le chien remplissait déjà les conditions de vaccination antirabique et, le cas échéant, de titrage des anticorps antirabiques. "
    + "Il lui faut toujours sa puce ISO et une vaccination antirabique valide le jour du voyage ; un rappel fait à l'étranger peut être inscrit en rubrique V du passeport par un vétérinaire habilité. "
    + "Pour un chien résidant habituellement dans l'UE dont le passeport atteste un titrage favorable réalisé avant le départ, le délai d'attente de 90 jours entre la prise de sang et les documents ne s'applique pas au retour. "
    + "Si l'un de ces éléments ne peut pas être établi dans le passeport, un certificat sanitaire UE est exigé à la place. "
    + "Deux limites : cela vaut pour un séjour, pas pour un déménagement — dès que le propriétaire réside habituellement hors de l'UE, le passeport ne peut plus servir, quelles que soient sa nationalité et ses propriétés dans l'UE ; "
    + "et un passeport européen délivré à un propriétaire résidant en Grande-Bretagne n'est plus valable pour voyager vers l'UE depuis le 31 décembre 2020." + tw;
}

function returningEs(iso) {
  const tw = TAPEWORM[iso]
    ? ` Para entrar ${TAPEWORM[iso].es} hace falta además un tratamiento contra la tenia Echinococcus multilocularis, administrado por un veterinario entre 24 y 120 horas antes de la llegada y certificado en el pasaporte por quien lo administró.`
    : "";
  return "Al volver a la UE tras una estancia en el extranjero, tu perro puede entrar solo con su pasaporte europeo — sin certificado sanitario de la UE — siempre que ese pasaporte, cumplimentado por un veterinario autorizado, acredite que ANTES de salir de la UE el perro ya cumplía las condiciones de vacunación antirrábica y, cuando proceda, de titulación de anticuerpos antirrábicos. "
    + "Sigue necesitando su microchip ISO y una vacunación antirrábica válida el día del viaje; un refuerzo administrado en el extranjero puede anotarse en el apartado V del pasaporte por un veterinario autorizado. "
    + "Para un perro que reside habitualmente en la UE y cuyo pasaporte acredita una titulación favorable realizada antes de la salida, el plazo de 90 días entre la extracción de sangre y los documentos no se aplica a la vuelta. "
    + "Si alguno de estos elementos no puede acreditarse en el pasaporte, se exige en su lugar un certificado sanitario de la UE. "
    + "Dos límites: esto vale para una estancia, no para un cambio de residencia — en cuanto el propietario reside habitualmente fuera de la UE, el pasaporte deja de servir, sea cual sea su nacionalidad o sus propiedades en la UE; "
    + "y un pasaporte europeo expedido a un propietario residente en Gran Bretaña ya no es válido para viajar a la UE desde el 31 de diciembre de 2020." + tw;
}

/* ---- Retouche de la première phrase du texte hors-UE (certificat) ---- */
const OPENERS = {
  rationale: {
    old: "An EU pet passport is issued only to a pet already residing in the EU, so it is not an option from outside the EU. ",
    new: "This is the route for a dog that holds no EU pet passport establishing its rabies status from before it left the EU: a passport cannot be obtained from outside the EU, so an EU animal health certificate is what applies here. ",
  },
  fr: {
    old: "Le passeport européen n'est délivré qu'à un animal résidant déjà dans l'UE : depuis un pays tiers, ce n'est pas une option. ",
    new: "C'est le parcours d'un chien qui ne détient pas de passeport européen attestant sa situation antirabique avant sa sortie de l'UE : un passeport ne s'obtient pas depuis un pays tiers, c'est donc le certificat sanitaire UE qui s'applique ici. ",
  },
};

/* ---- Construction de la règle « retour » à partir de sa jumelle « certificat » ---- */
function returningRule(iso, nonEu) {
  // Mêmes documents que la règle intra-UE, plus le vermifuge quand la destination l'impose.
  const docs = ["microchip", "rabies_vaccine", "eu_pet_passport"];
  if (TAPEWORM[iso]) docs.push("tapeworm_treatment");
  return {
    id: `rule_${iso}_import_returning_eu`,
    scope: { type: "country", id: cid(iso) },
    category: nonEu.category,
    // "medium" et non "high" : c'est le parcours simple, celui où le voyageur a déjà tout en main.
    // La criticité ordonne l'affichage (explain.ts) — le certificat doit rester devant.
    criticality: "medium",
    applies_when: {
      all: [
        { fact: "route.dest_country_id", op: "eq", value: cid(iso) },
        { fact: "route.origin_country_id", op: "nin", value: EU_IDS },
        { fact: "docs.eu_passport", op: "in", value: YES_SIDE },
      ],
    },
    effect: { action: "require" },
    params: {
      docs,
      lead_time_days: 21,
      // La dispense de certificat repose sur ces deux éléments — et sur EUX SEULS.
      passport_must_predate_eu_exit: true,
      titer_must_predate_eu_exit_where_applicable: true,
      // Le délai de 90 jours titrage → document ne s'applique pas au retour d'un résident UE.
      titer_90_day_wait_waived_on_return: true,
      health_certificate_required: false,
      faq_source_url: SRC_FAQ,
    },
    rationale: returningEn(iso),
    rationale_i18n: { fr: returningFr(iso), es: returningEs(iso) },
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
        note: "Règle créée pour le retour dans l'UE avec passeport européen. Vérifiée sur « Bringing a pet into the EU from a non-EU country », Exceptions › Animal health certificate, point 2 (règlement délégué (UE) 2026/131), et sur la FAQ DG SANTÉ (« travelling back to the EU after a short stay »). Se déclenche aussi quand la question est sans réponse, en parallèle de rule_" + iso + "_import_non_eu.",
      }],
    },
  };
}

/* ---------------------------------------------------------------- */

const rules = JSON.parse(readFileSync(RULES, "utf8"));
const added = [];
const gated = [];
const reworded = [];
const missing = [];

for (const iso of EU_ISO) {
  const nonEu = rules.find((r) => r.id === `rule_${iso}_import_non_eu`);
  if (!nonEu) { missing.push(iso); continue; }
  const conds = nonEu.applies_when?.all;
  if (!Array.isArray(conds)) { missing.push(iso + " (applies_when.all absent)"); continue; }

  // 1. Conditionner le certificat au document détenu — « non », « je ne sais pas », ou sans réponse.
  if (!conds.some((c) => c.fact === "docs.eu_passport")) {
    conds.push({ fact: "docs.eu_passport", op: "in", value: NO_SIDE });
    gated.push(iso);
  }

  // 2. Corriger la première phrase, qui niait l'usage du passeport au lieu de sa délivrance.
  let touched = false;
  if (typeof nonEu.rationale === "string" && nonEu.rationale.startsWith(OPENERS.rationale.old)) {
    nonEu.rationale = OPENERS.rationale.new + nonEu.rationale.slice(OPENERS.rationale.old.length);
    touched = true;
  }
  const fr = nonEu.rationale_i18n?.fr;
  if (typeof fr === "string" && fr.startsWith(OPENERS.fr.old)) {
    nonEu.rationale_i18n.fr = OPENERS.fr.new + fr.slice(OPENERS.fr.old.length);
    touched = true;
  }
  if (touched) reworded.push(iso);

  if (gated.includes(iso) || touched) {
    nonEu.source.history = nonEu.source.history ?? [];
    nonEu.source.history.push({
      date: TODAY,
      reviewer: REVIEWER,
      note: "Certificat conditionné au document détenu (docs.eu_passport). Un chien qui rentre dans l'UE avec un passeport européen établissant sa situation antirabique d'avant sa sortie de l'UE relève de rule_" + iso + "_import_returning_eu, pas du certificat. Sans réponse ou en cas de doute, les deux règles se déclenchent.",
    });
  }

  // 3. Créer la règle de retour, juste après sa jumelle.
  if (!rules.some((r) => r.id === `rule_${iso}_import_returning_eu`)) {
    rules.splice(rules.indexOf(nonEu) + 1, 0, returningRule(iso, nonEu));
    added.push(iso);
  }
}

const changed = added.length || gated.length || reworded.length;
if (!dry && changed) writeFileSync(RULES, JSON.stringify(rules, null, 2) + "\n");

const p = dry ? "[--dry] " : "";
console.log(`${p}règles « retour avec passeport » créées : ${added.length}${added.length ? " — " + added.join(", ") : ""}`);
console.log(`${p}règles « certificat » conditionnées au document : ${gated.length}${gated.length ? " — " + gated.join(", ") : ""}`);
console.log(`${p}textes « certificat » dont la première phrase est corrigée : ${reworded.length}`);
if (missing.length) console.log("règles hors-UE introuvables :", missing.join(", "));
if (!changed) console.log("rien à faire — déjà en place.");
