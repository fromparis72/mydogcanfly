#!/usr/bin/env node
/* Suisse, Liechtenstein, Norvège : même défaut que les 27 pays de l'UE corrigés le 8 août
 * (REPRISE.md, item 5). Les trois règles `rule_ch_import`, `rule_li_import`, `rule_no_import`
 * affirmaient un passeport européen inconditionnel — vrai seulement au départ d'un pays qui en
 * délivre un, faux depuis un pays tiers. Los Angeles → Zurich recevait le même conseil que
 * Paris → Zurich, alors que le passeport n'existe pas pour un chien californien.
 *
 * CE QUI SE SOURCE, CE QUI NE SE SOURCE PAS. Les trois pays ne sont pas trois variantes du même
 * texte : ce sont deux sources indépendantes, l'une pour deux pays.
 *
 * SUISSE — BLV (Office fédéral de la sécurité alimentaire et des affaires vétérinaires), page
 * « Travelling with dogs, cats and ferrets » (blv.admin.ch), + la « Länderliste nach
 * Tollwutrisiko » (juin 2026, PDF officiel BLV) pour la répartition par pays. Trois paliers,
 * pas deux :
 *   1. UE/EEE + micro-États et territoires assimilés (passeport reconnu) → passeport suffit.
 *   2. Pays tiers à risque faible (liste 2 du PDF BLV) → certificat vétérinaire + déclaration du
 *      propriétaire, pas de titrage.
 *   3. Tout le reste (risque de rage urbaine) → certificat + titrage + minimum 7 mois + une
 *      autorisation d'importation FSVO pour une entrée directe par avion (aéroports de Bâle,
 *      Genève ou Zurich).
 * Le délai précis du titrage (prise de sang → entrée) n'est pas chiffré sur cette page anglaise :
 * on garde donc le texte qualitatif de la source (« long waiting times ») plutôt que d'inventer
 * un nombre de jours qu'elle ne donne pas — contrairement à l'âge minimum (7 mois) et à
 * l'autorisation d'importation, qui eux SONT chiffrés/nommés explicitement.
 *
 * LIECHTENSTEIN — pas un régime à sourcer séparément. Les notes explicatives officielles de
 * l'EDAV-Ht (l'ordonnance suisse elle-même, blv.admin.ch) le disent noir sur blanc : « Liechtenstein
 * […] ist ein Zollanschlussgebiet und gehört veterinärrechtlich zum Einfuhrgebiet » — le
 * Liechtenstein est un territoire d'union douanière qui appartient, en droit vétérinaire, au
 * territoire d'importation SUISSE. Ce n'est donc pas une variante nationale : c'est la même règle,
 * la même source, les mêmes trois paliers. L'ancienne règle `rule_li_import` citait une page
 * generic europa.eu (« Your Europe ») qui ne s'applique qu'aux États membres de l'UE — le
 * Liechtenstein n'en est pas un ; cette source était fausse, pas seulement incomplète. Corrigée ici.
 *
 * NORVÈGE — Mattilsynet (Office norvégien de sécurité alimentaire), DEUX pages officielles
 * distinctes, une par origine :
 *   — depuis un pays UE/EEE : passeport + vermifuge Echinococcus (déjà en place, texte inchangé).
 *   — depuis un pays tiers : certificat au modèle de l'Annexe IV du règlement (UE) n° 577/2013 +
 *     vaccination antirabique + titrage « sauf si le pays de départ figure à l'Annexe II du
 *     règlement (UE) n° 577/2013 » — la page Mattilsynet cite ce règlement PAR RÉFÉRENCE sans en
 *     republier la liste. On ne réutilise PAS ici la liste que l'UE elle-même applique
 *     (`regles-ue-origine.mjs`) : rien ne garantit que la Norvège applique la version 2026 du
 *     règlement au même rythme que l'UE via le comité mixte EEE, et attribuer à un État la loi
 *     d'un autre serait exactement l'erreur qu'on corrige pour le Liechtenstein. Le texte dit donc
 *     « sauf si le pays de départ figure sur la liste UE des pays dispensés » sans résoudre la
 *     liste, `params.no_titer_origin_country_ids` reste absent — champ non sourçable, laissé vide.
 *     Le délai de titrage, lui, EST chiffré sur cette page (30 jours après vaccination, 90 jours
 *     avant l'entrée) : gardé tel quel. Un seul palier « pays tiers », pas trois comme la Suisse —
 *     la source norvégienne ne distingue pas de sous-catégorie « risque faible ».
 *
 * PÉRIMÈTRE DÉCIDÉ AVEC L'UTILISATEUR : scission par origine seulement. Contrairement au correctif
 * UE du 8 août, on n'ajoute PAS ici le volet « retour avec passeport après séjour hors zone » —
 * hors périmètre de cet item REPRISE.md, à traiter plus tard si besoin.
 *
 * LISTES DE PAYS : construites à partir des documents sources cités, puis filtrées sur les pays
 * réellement présents au référentiel (`keep()`) — les territoires absents (micro-îles, dépendances)
 * sont journalisés, jamais inventés en `country_xx`.
 *
 * Idempotent : relancer ne duplique rien et ne réécrit rien.
 *   node packages/knowledge/scripts/regles-ch-li-no-origine.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = resolve(HERE, "../raw/rules.json");
const OBJECTS = resolve(HERE, "../raw/objects.json");
const dry = process.argv.includes("--dry");

const TODAY = "2026-08-09";
const REVIEWER = "MyDogCanFly Data Team";
const plus = (iso, d) => { const x = new Date(iso + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const REVIEW_DUE = plus(TODAY, 180); // cadence "country" (REVIEW_CADENCE_DAYS, common.ts)

const SRC_CH_MAIN = "https://www.blv.admin.ch/en/travelling-with-dogs-cats-and-ferrets";
const SRC_CH_LIST = "https://www.blv.admin.ch/dam/de/sd-web/rGF02-RRaF0f/liste-laender-tollwut-de.pdf";
const SRC_LI_ZOLLANSCHLUSS = "https://www.blv.admin.ch/dam/blv/de/dokumente/import-export/rechts-und-vollzugsgrundlagen/erlaeuterungen-edav-ht.pdf.download.pdf/Erl%C3%A4uterungen%20zur%20EDAV-Ht_d.pdf";
const SRC_NO_EU = "https://www.mattilsynet.no/en/animals/travelling-with-dogs-cats-and-ferrets-from-eu-countries-to-norway";
const SRC_NO_THIRD = "https://www.mattilsynet.no/en/animals/travelling-with-dogs-cats-and-ferrets-from-third-countries-and-territories-to-norway";

/* Les 27 États membres — recopiés tels quels de regles-ue-origine.mjs (même liste, même ordre). */
const EU_ISO = ["at", "be", "bg", "hr", "cy", "cz", "dk", "ee", "fi", "fr", "de", "gr", "hu", "ie",
  "it", "lv", "lt", "lu", "mt", "nl", "pl", "pt", "ro", "sk", "si", "es", "se"];

/* BLV, « Länderliste nach Tollwutrisiko », catégorie 1.2 : micro-États et territoires dont le
   passeport est reconnu par la Suisse, en plus des 27 + is/li/no (déjà EEE). "ch" et "ni" (Irlande
   du Nord, non modélisée séparément au référentiel) sont exclus de cette liste. */
const CH_TIER1_EXTRA = ["ad", "fo", "gi", "gl", "is", "li", "mc", "no", "sm", "va"];

/* BLV, même document, catégorie 2 : pays tiers à risque faible (certificat, pas de titrage). */
const CH_TIER2 = ["ac", "ae", "ag", "ar", "au", "aw", "ba", "bb", "bh", "bm", "bq", "ca", "cl", "cw",
  "fj", "fk", "gb", "gg", "hk", "im", "jm", "jp", "je", "kn", "ky", "lc", "me", "mk", "ms", "mu",
  "mx", "my", "nc", "nz", "pf", "pm", "rs", "sg", "sh", "sx", "tt", "tw", "us", "vc", "vg", "vu", "wf"];

const rules = JSON.parse(readFileSync(RULES, "utf8"));
const objects = JSON.parse(readFileSync(OBJECTS, "utf8"));
const knownIso = new Set(objects.countries.map((c) => c.iso2.toLowerCase()));
const cid = (iso) => "country_" + iso;
const keep = (list) => list.filter((iso) => knownIso.has(iso));
const dropped = (list) => list.filter((iso) => !knownIso.has(iso));

const CH_TIER1_IDS = [...keep(EU_ISO), ...keep(CH_TIER1_EXTRA)].map(cid).sort();
const CH_TIER2_IDS = keep(CH_TIER2).map(cid).sort();
const NO_TIER1_IDS = [...keep(EU_ISO), ...keep(["is", "li"])].map(cid).sort();

/* ---------------------------------------------------------------- */
/* SUISSE et LIECHTENSTEIN : même structure, mêmes listes, même source (cf. header). */

function tier2Rule(iso, countryLabelEn, countryLabelFr, countryLabelEs) {
  return {
    id: `rule_${iso}_import_low_risk`,
    scope: { type: "country", id: cid(iso) },
    category: "import_rules",
    criticality: "high",
    applies_when: {
      all: [
        { fact: "route.dest_country_id", op: "eq", value: cid(iso) },
        // Palier 2 seul : la liste elle-même (catégorie 2 BLV) exclut déjà la catégorie 1 par
        // construction (deux listes disjointes) — un `nin` combiné aux deux listes ici serait
        // contradictoire avec le `in` qui suit (aucun pays ne pourrait jamais satisfaire les deux).
        { fact: "route.origin_country_id", op: "in", value: CH_TIER2_IDS },
      ],
    },
    effect: { action: "require" },
    params: { docs: ["microchip", "rabies_vaccine", "health_certificate", "owner_declaration"], lead_time_days: 21 },
    rationale: `No EU pet passport from outside the EU/EEA-recognised area. From a country with a favourable rabies situation, entering ${countryLabelEn} needs a veterinary health certificate issued by an official veterinarian in the country of departure, a valid rabies vaccination (first dose from 12 weeks, then a 21-day wait) and a special owner declaration — no rabies antibody titration test required.`,
    rationale_i18n: {
      fr: `Pas de passeport européen depuis un pays hors UE/EEE reconnu. Depuis un pays à situation rabique favorable, l'entrée ${countryLabelFr} demande un certificat vétérinaire établi par un vétérinaire officiel du pays de départ, une vaccination antirabique valide (première dose dès 12 semaines, puis 21 jours d'attente) et une déclaration spéciale du propriétaire — pas de titrage des anticorps antirabiques.`,
      es: `Sin pasaporte europeo desde fuera del área UE/EEE reconocida. Desde un país con situación rábica favorable, entrar ${countryLabelEs} exige un certificado veterinario expedido por un veterinario oficial del país de salida, una vacunación antirrábica válida (primera dosis desde las 12 semanas, luego 21 días de espera) y una declaración especial del propietario — sin prueba de titulación de anticuerpos antirrábicos.`,
    },
    source: {
      url: SRC_CH_LIST,
      source_type: "government",
      verified_date: TODAY,
      review_due: REVIEW_DUE,
      confidence: 4,
      reviewer: REVIEWER,
      history: [{ date: TODAY, reviewer: REVIEWER, note: `Règle créée pour séparer les pays tiers à risque faible (catégorie 2 de la « Länderliste nach Tollwutrisiko » BLV, juin 2026) du parcours UE/EEE. Voir rule_${iso}_import (palier 1) et rule_${iso}_import_high_risk (palier 3).` }],
    },
  };
}

function tier3Rule(iso, countryLabelEn, countryLabelFr, countryLabelEs) {
  return {
    id: `rule_${iso}_import_high_risk`,
    scope: { type: "country", id: cid(iso) },
    category: "import_rules",
    criticality: "high",
    applies_when: {
      all: [
        { fact: "route.dest_country_id", op: "eq", value: cid(iso) },
        { fact: "route.origin_country_id", op: "nin", value: [...CH_TIER1_IDS, ...CH_TIER2_IDS] },
      ],
    },
    effect: { action: "require" },
    params: {
      docs: ["microchip", "rabies_vaccine", "health_certificate", "rabies_titer_test", "import_permit"],
      lead_time_days: 21,
      min_age_months: 7,
      titer_wait_undocumented: true, // la source ne chiffre pas le délai prise de sang → entrée, contrairement à l'âge minimum et au permis
      no_titer_origin_country_ids: CH_TIER2_IDS,
    },
    rationale: `From a country where urban rabies cannot be ruled out, entering ${countryLabelEn} needs a veterinary health certificate, a valid rabies vaccination, and a rabies antibody titration test from a designated laboratory — long waiting times apply and are not published as a fixed number of days by the source. Dogs under 7 months old cannot enter ${countryLabelEn} from a high-rabies-risk country. Direct arrival by plane additionally requires an import licence (Basel, Geneva or Zurich).`,
    rationale_i18n: {
      fr: `Depuis un pays où la rage urbaine ne peut pas être exclue, l'entrée ${countryLabelFr} demande un certificat vétérinaire, une vaccination antirabique valide, et un titrage des anticorps antirabiques dans un laboratoire agréé — de longs délais s'appliquent, non chiffrés en un nombre de jours fixe par la source. Un chien de moins de 7 mois ne peut pas entrer ${countryLabelFr} depuis un pays à risque rabique élevé. Une arrivée directe par avion demande en plus une autorisation d'importation (Bâle, Genève ou Zurich).`,
      es: `Desde un país donde no puede descartarse la rabia urbana, entrar ${countryLabelEs} exige un certificado veterinario, una vacunación antirrábica válida y una prueba de titulación de anticuerpos antirrábicos en un laboratorio designado — se aplican plazos largos que la fuente no fija en un número de días concreto. Un perro menor de 7 meses no puede entrar ${countryLabelEs} desde un país de alto riesgo rábico. La llegada directa en avión exige además una autorización de importación (Basilea, Ginebra o Zúrich).`,
    },
    source: {
      url: SRC_CH_MAIN,
      source_type: "government",
      verified_date: TODAY,
      review_due: REVIEW_DUE,
      confidence: 4,
      reviewer: REVIEWER,
      history: [{ date: TODAY, reviewer: REVIEWER, note: `Règle créée pour le palier 3 (pays à rage urbaine, catégorie 3 de la Länderliste BLV = tout ce qui n'est pas en catégorie 1 ou 2). Âge minimum 7 mois et permis d'importation FSVO chiffrés par la source ; délai du titrage laissé qualitatif, la page ne le chiffre pas.` }],
    },
  };
}

const report = { ch: {}, li: {}, no: {} };

/* -- Suisse -- */
{
  const ch = rules.find((r) => r.id === "rule_ch_import");
  if (ch) {
    const conds = ch.applies_when.all;
    if (!conds.some((c) => c.fact === "route.origin_country_id")) {
      conds.push({ fact: "route.origin_country_id", op: "in", value: CH_TIER1_IDS });
      ch.source.history = ch.source.history ?? [];
      ch.source.history.push({ date: TODAY, reviewer: REVIEWER, note: "Portée restreinte aux départs UE/EEE + micro-États assimilés (catégorie 1, Länderliste BLV juin 2026) : le texte affirmait le passeport européen sans condition d'origine. Les autres origines relèvent de rule_ch_import_low_risk et rule_ch_import_high_risk." });
      report.ch.scoped = true;
    }
  } else report.ch.missingBase = true;
  if (!rules.some((r) => r.id === "rule_ch_import_low_risk")) {
    rules.splice(rules.indexOf(ch) + 1, 0, tier2Rule("ch", "Switzerland", "en Suisse", "a Suiza"));
    report.ch.addedLow = true;
  }
  if (!rules.some((r) => r.id === "rule_ch_import_high_risk")) {
    const anchor = rules.findIndex((r) => r.id === "rule_ch_import_low_risk");
    rules.splice(anchor + 1, 0, tier3Rule("ch", "Switzerland", "en Suisse", "a Suiza"));
    report.ch.addedHigh = true;
  }
}

/* -- Liechtenstein -- même paliers que la Suisse (Zollanschlussgebiet, cf. header) -- */
{
  const li = rules.find((r) => r.id === "rule_li_import");
  if (li) {
    const conds = li.applies_when.all;
    let touched = false;
    if (!conds.some((c) => c.fact === "route.origin_country_id")) {
      conds.push({ fact: "route.origin_country_id", op: "in", value: CH_TIER1_IDS });
      touched = true;
    }
    // Source corrigée : l'ancienne citait une page generic europa.eu qui ne couvre que les États
    // membres de l'UE — le Liechtenstein n'en est pas un. La vraie source est le régime suisse.
    if (li.source.url !== SRC_CH_MAIN) {
      li.source.url = SRC_CH_MAIN;
      li.source.verified_date = TODAY;
      li.source.review_due = REVIEW_DUE;
      li.rationale = "Liechtenstein has no independent pet-import regime: under the 1923 customs treaty it is a customs-annexed territory that belongs, in veterinary law, to Switzerland's own import territory (Swiss EDAV-Ht ordinance, explanatory notes). Entering Liechtenstein therefore follows the exact same rules as entering Switzerland. From the EU/EEA and the micro-states whose pet passport Switzerland recognises: microchip, valid rabies vaccination (first dose from 12 weeks, then a 21-day wait) and a recognised pet passport — nothing else.";
      li.rationale_i18n = { fr: "Le Liechtenstein n'a pas de régime d'importation propre : en vertu du traité douanier de 1923, c'est un territoire d'union douanière qui appartient, en droit vétérinaire, au territoire d'importation suisse (ordonnance suisse EDAV-Ht, notes explicatives). Entrer au Liechtenstein suit donc exactement les mêmes règles qu'entrer en Suisse. Depuis l'UE/EEE et les micro-États dont la Suisse reconnaît le passeport : puce ISO, vaccination antirabique valide (première dose dès 12 semaines, puis 21 jours d'attente) et passeport reconnu — rien de plus.", es: "Liechtenstein no tiene un régimen de importación propio: en virtud del tratado aduanero de 1923, es un territorio de unión aduanera que pertenece, en derecho veterinario, al territorio de importación suizo (ordenanza suiza EDAV-Ht, notas explicativas). Entrar en Liechtenstein sigue por tanto exactamente las mismas reglas que entrar en Suiza. Desde la UE/EEE y los microestados cuyo pasaporte reconoce Suiza: microchip, vacunación antirrábica válida (primera dosis desde las 12 semanas, luego 21 días de espera) y pasaporte reconocido — nada más." };
      touched = true;
    }
    if (touched) {
      li.source.history = li.source.history ?? [];
      li.source.history.push({ date: TODAY, reviewer: REVIEWER, note: "Source corrigée (l'ancienne, europa.eu « Your Europe », ne couvre que les États membres de l'UE) et portée restreinte à l'origine UE/EEE + micro-États assimilés, par identité avec le régime suisse (Liechtenstein = territoire d'importation suisse en droit vétérinaire, notes explicatives EDAV-Ht, BLV). Voir " + SRC_LI_ZOLLANSCHLUSS + ". Les autres origines relèvent de rule_li_import_low_risk et rule_li_import_high_risk." });
      report.li.scoped = true;
    }
  } else report.li.missingBase = true;
  if (!rules.some((r) => r.id === "rule_li_import_low_risk")) {
    const anchor = rules.findIndex((r) => r.id === "rule_li_import");
    rules.splice(anchor + 1, 0, tier2Rule("li", "Liechtenstein", "au Liechtenstein", "a Liechtenstein"));
    report.li.addedLow = true;
  }
  if (!rules.some((r) => r.id === "rule_li_import_high_risk")) {
    const anchor = rules.findIndex((r) => r.id === "rule_li_import_low_risk");
    rules.splice(anchor + 1, 0, tier3Rule("li", "Liechtenstein", "au Liechtenstein", "a Liechtenstein"));
    report.li.addedHigh = true;
  }
}

/* -- Norvège : UE/EEE (texte inchangé) + un seul palier pays tiers (cf. header, pas de sous-liste
   « risque faible » sourcée séparément pour la Norvège). -- */
{
  const no = rules.find((r) => r.id === "rule_no_import");
  if (no) {
    const conds = no.applies_when.all;
    if (!conds.some((c) => c.fact === "route.origin_country_id")) {
      conds.push({ fact: "route.origin_country_id", op: "in", value: NO_TIER1_IDS });
      no.source.history = no.source.history ?? [];
      no.source.history.push({ date: TODAY, reviewer: REVIEWER, note: "Portée restreinte aux départs UE/EEE (Mattilsynet, page « from EU-countries to Norway ») : le texte affirmait le passeport européen sans condition d'origine. Les autres origines relèvent de rule_no_import_non_eea." });
      report.no.scoped = true;
    }
  } else report.no.missingBase = true;

  if (!rules.some((r) => r.id === "rule_no_import_non_eea")) {
    const nonEea = {
      id: "rule_no_import_non_eea",
      scope: { type: "country", id: "country_no" },
      category: "import_rules",
      criticality: "high",
      applies_when: {
        all: [
          { fact: "route.dest_country_id", op: "eq", value: "country_no" },
          { fact: "route.origin_country_id", op: "nin", value: NO_TIER1_IDS },
        ],
      },
      effect: { action: "require" },
      params: {
        docs: ["microchip", "rabies_vaccine", "health_certificate", "tapeworm_treatment"],
        lead_time_days: 21,
        lead_time_days_if_titer_required: 120, // 30 j après vaccination + 90 j avant l'entrée, chiffré par Mattilsynet
        titer_required_unless_origin_listed: true,
        // Liste non résolue : Mattilsynet cite l'Annexe II du règlement (UE) n° 577/2013 par
        // référence sans la republier, et rien ne garantit qu'elle coïncide avec la liste que l'UE
        // applique elle-même en 2026 (comité mixte EEE, rythme d'incorporation propre). Laissé vide
        // plutôt qu'emprunté à une autre juridiction — champ non sourçable pour la Norvège.
        no_titer_list_note: "Referenced by Mattilsynet as Annex II to Regulation (EU) No 577/2013; not republished on the Norwegian source page, so the resolved list is left unpublished here rather than assumed identical to the EU's own current list.",
        health_certificate_model: "Annex IV to Regulation (EU) No 577/2013",
      },
      rationale: "From a non-EU/EEA country, entering Norway needs an identification document — an animal health certificate on the model of Annex IV to Regulation (EU) No 577/2013 — plus a valid rabies vaccination (first dose from 12 weeks, then a 21-day wait) and, unless the country of departure is listed as exempt, a rabies antibody titration test: blood sample at least 30 days after vaccination, and at least 90 days before entering Norway. An anti-echinococcus (tapeworm) treatment is required regardless of origin, given 24–120 hours before arrival.",
      rationale_i18n: {
        fr: "Depuis un pays hors UE/EEE, l'entrée en Norvège demande un document d'identification — un certificat sanitaire au modèle de l'Annexe IV du règlement (UE) n° 577/2013 — plus une vaccination antirabique valide (première dose dès 12 semaines, puis 21 jours d'attente) et, sauf si le pays de départ figure sur la liste des pays dispensés, un titrage des anticorps antirabiques : prise de sang au moins 30 jours après la vaccination, et au moins 90 jours avant l'entrée en Norvège. Un traitement contre le ténia (Echinococcus) est exigé quelle que soit l'origine, administré 24 à 120 heures avant l'arrivée.",
        es: "Desde un país fuera de la UE/EEE, entrar en Noruega exige un documento de identificación — un certificado sanitario según el modelo del Anexo IV del reglamento (UE) n.º 577/2013 — más una vacunación antirrábica válida (primera dosis desde las 12 semanas, luego 21 días de espera) y, salvo que el país de salida figure en la lista de países exentos, una prueba de titulación de anticuerpos antirrábicos: extracción de sangre al menos 30 días después de la vacunación, y al menos 90 días antes de entrar en Noruega. Se exige un tratamiento contra la tenia (Echinococcus) sea cual sea el origen, administrado entre 24 y 120 horas antes de la llegada.",
      },
      source: {
        url: SRC_NO_THIRD,
        source_type: "government",
        verified_date: TODAY,
        review_due: REVIEW_DUE,
        confidence: 4,
        reviewer: REVIEWER,
        history: [{ date: TODAY, reviewer: REVIEWER, note: "Règle créée pour le parcours pays tiers, distinct du parcours UE/EEE (rule_no_import). Un seul palier, pas trois comme la Suisse : la source norvégienne ne publie pas de sous-liste « risque faible » propre, elle renvoie à l'Annexe II du règlement (UE) 577/2013 sans la reproduire." }],
      },
    };
    const anchor = rules.findIndex((r) => r.id === "rule_no_import");
    rules.splice(anchor + 1, 0, nonEea);
    report.no.added = true;
  }
}

const changed = Object.values(report).some((r) => Object.values(r).some(Boolean));
if (!dry && changed) writeFileSync(RULES, JSON.stringify(rules, null, 2) + "\n");

const p = dry ? "[--dry] " : "";
console.log(`${p}Suisse : ${report.ch.scoped ? "portée restreinte" : "déjà scindée"}, low_risk ${report.ch.addedLow ? "créée" : "déjà là"}, high_risk ${report.ch.addedHigh ? "créée" : "déjà là"}`);
console.log(`${p}Liechtenstein : ${report.li.scoped ? "source + portée corrigées" : "déjà corrigé"}, low_risk ${report.li.addedLow ? "créée" : "déjà là"}, high_risk ${report.li.addedHigh ? "créée" : "déjà là"}`);
console.log(`${p}Norvège : ${report.no.scoped ? "portée restreinte" : "déjà scindée"}, non_eea ${report.no.added ? "créée" : "déjà là"}`);
console.log(`Listes : tier1 CH/LI ${CH_TIER1_IDS.length} pays, tier2 CH/LI ${CH_TIER2_IDS.length} pays, tier1 NO ${NO_TIER1_IDS.length} pays.`);
const droppedT1 = dropped(CH_TIER1_EXTRA), droppedT2 = dropped(CH_TIER2);
if (droppedT1.length) console.log("territoires tier1 absents du référentiel, ignorés :", droppedT1.join(", "));
if (droppedT2.length) console.log("territoires tier2 absents du référentiel, ignorés :", droppedT2.join(", "));
if (report.ch.missingBase || report.li.missingBase || report.no.missingBase) console.log("ATTENTION : règle de base introuvable pour au moins un pays — rien touché pour lui.");
