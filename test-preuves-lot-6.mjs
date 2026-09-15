#!/usr/bin/env node
/**
 * CONTRE-ÉPREUVES DU LOT 6 DE L'IMPORT STRICT — 22 faits de Codex (09/09/2026), 21 importés, 1 refusé.
 *
 *   npx tsx test-preuves-lot-6.mjs
 *
 * Même méthode que les lots précédents. Ce que ce lot apporte de NEUF, et qui est éprouvé ici :
 *   · trois plafonds combinés écrits tels que la phrase les porte (Aeromexico cabine 9 et soute 45,
 *     EgyptAir cabine 8) — même lecture de la règle 5 de Codex qu'au lot 5 : portée générale, chien +
 *     contenant ; Royal Jordanian 7 n'est PAS écrit (la phrase citée s'arrête avant le chiffre, et sa
 *     portée est Economy + vol ≤ 5 h) ;
 *   · SIX lignes non revérifiées réactivées sur citation, dont la PREMIÈRE en REFUS cité (Saudia
 *     cabine, `not_offered`) — South African soute et fret, Kenya fret, Gulf Air fret, Royal
 *     Jordanian cabine ;
 *   · deux compagnies « fret seulement » (Kenya Airways, Gulf Air : cabine et soute refusées, fret
 *     sous conditions), lues chacune d'UNE phrase pour trois canaux ;
 *   · UN FAIT REFUSÉ par l'importeur : Air China cabine. La fiche dit `not_offered` (sans phrase),
 *     Codex dit « sous conditions » (vols intérieurs) ; l'importeur ne change jamais une
 *     disponibilité. La ligne reste « à confirmer », et la question va à Philippe et Codex ;
 *   · UNE PROVENANCE À CONTRE-REVOIR, nommée : l'URL Saudia est un sous-domaine `booking-uat`
 *     (environnement de test de la compagnie). Le domaine est saudia.com, le contrat l'accepte ; il
 *     est signalé, pas réécrit.
 *   · MESURÉ : United cabine citée, mais un Golden de 32 kg reste « à confirmer » par des règles de
 *     poids héritées non citées, nommées (`rule_ua_cabin_weight`, `rule_united_cabin_weight`) ; sa
 *     soute et son fret, volontairement non décidés, restent « à confirmer » — jamais déduits.
 */
import { readFileSync } from "node:fs";
import { loadKB, reviewDueFrom } from "./packages/knowledge/src/index.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { FinderRequest } from "./packages/engine/src/contracts.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

const DOSSIER = "mesures/preuves/import-strict-lot-6-2026-09-09/PREUVES_POLITIQUES_COMPAGNIES_LOT_6_STRICT_2026-09-09.json";
const d = JSON.parse(readFileSync(DOSSIER, "utf8"));
const faits = d.facts.map((x, i) => ({ index: i, verified_date: d.provenance_defaults.verified_date, ...x }));
const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
const kb = loadKB();
const JUILLET = (() => { const n = new Date(), y = n.getUTCFullYear(); return `${Date.UTC(y, n.getUTCMonth(), n.getUTCDate()) <= Date.UTC(y, 6, 15) ? y : y + 1}-07-15`; })();
const GOLDEN_32 = { breed_id: "breed_golden_retriever", weight_kg: 32 };
const CAVALIER_6 = { breed_id: "breed_cavalier_king_charles", weight_kg: 6 };
const CARLIN_8 = { breed_id: "breed_pug", weight_kg: 8 };
const BULLY_50 = { breed_id: "breed_american_bully_xl", weight_kg: 50 };
const decide = (o, dst, dog) => evaluate(kb, FinderRequest.parse({ origin: o, destination: dst, dog, date: JUILLET }));
const canal = (dec, id, pl) => dec.airlines.find((a) => a.airline_id === id)?.placements.find((p) => p.placement === pl);
const politique = (id, pl) => objets.airlines.find((a) => a.id === id)?.premium?.policy?.[pl];
const projetee = (id, pl) => kb.airlines.get(id)?.premium?.policy?.[pl];
const SEUILS = {
  "airline_aeromexico.cabin": [9, true], "airline_aeromexico.hold": [45, true],
  "airline_egyptair.cabin": [8, true], "airline_air_china.hold": [32, true],
  "airline_royal_jordanian.cabin": [7, true],
};
const SUPERSEDEES = {
  "airline_air_china.hold": {
    history_date: "2026-09-15", url: "https://m.airchina.com.cn/ac/c/invoke/animalInstruction%40pgzhcn", quote_language: "zh",
    quote: "每只小动物（包含包装容器以及容器内的水及食物），不得超过32公斤。", locator: "小动物托运 → 五、运输要求",
  },
  "airline_royal_jordanian.cabin": {
    history_date: "2026-09-15", url: "https://www.rj.com/en/info-and-tips/special-services/flying-with-pets", quote_language: "en",
    quote: "Maximum Weight of animal & crate | 7 kg (15 Ibs)", locator: "Flying with Pets → passenger cabin requirements table → Maximum Weight of animal & crate",
  },
};
const REACTIVEES = ["airline_south_african_airways.hold", "airline_south_african_airways.cargo", "airline_kenya_airways.cargo", "airline_gulf_air.cargo", "airline_royal_jordanian.cabin"];
const REFUSE = "airline_air_china.cabin";
const CORRECTIF = JSON.parse(readFileSync("mesures/preuves/correctif-arbitrages-2026-09-09/CORRECTIF_ARBITRAGES_POLITIQUES_COMPAGNIES_2026-09-09.json", "utf8"));

console.log("=== Étage 1 — 22 faits relus, 21 dans la donnée à l'octet près, 1 refusé et nommé ===");
{
  check("22 faits relus depuis le dossier, 8 non-décisions déclarées", faits.length === 22 && d.intentionally_unset.length === 8);
  for (const f of faits) {
    const cle = `${f.airline_id}.${f.placement}`;
    const pol = politique(f.airline_id, f.placement);
    const s = pol?.source ?? {};
    const proj = projetee(f.airline_id, f.placement);
    if (cle === "airline_saudia.cabin" || cle === "airline_saudia.hold") {
      /* La preuve UAT du lot 6 a d'abord été retirée. Le 12/09, une page nationale arabe
         officielle a établi à nouveau les deux verdicts, sans réintroduire l'adresse de test. */
      const attendu = cle.endsWith(".cabin") ? "denied" : "accepted_with_conditions";
      check(`${cle} (LOT6[${f.index}]) : preuve UAT remplacée par la page nationale arabe officielle`,
        pol?.source?.url === "https://www.saudia.com/ar-SA/book/flight-information/travelling-with-pets"
          && pol?.source?.quote_language === "ar" && pol?.source?.verified_date === "2026-09-12"
          && !/booking-uat/.test(JSON.stringify(pol ?? {})) && proj?.status === attendu,
        JSON.stringify({ politique: pol, projete: proj }));
      check(`  …le fait UAT reste lisible uniquement dans le dossier historique, jamais comme provenance active`, (f.quote ?? "").startsWith("Dogs must be transported in the cargo hold"));
      continue;
    }
    if (cle === REFUSE) {
      /* HISTOIRE : refusé à l'import du lot 6 (la fiche disait `not_offered`), porté à l'arbitrage. ARBITRAGE (09/09/2026,
         Codex, tranché par Philippe — correctif) : « maintenu sous conditions sur les vols opérés par Air China » ; « domestic
         dogs » = chiens domestiques, pas vols intérieurs. Disponibilité changée À LA MAIN sur ordre, phrase écrite par
         l'importeur du correctif : même phrase que le lot 6, page de l'accord de transport en cabine (URL du correctif). */
      const arb = CORRECTIF.replace_facts.find((x) => x.airline_id === f.airline_id && x.placement === f.placement);
      check(`${cle} (LOT6[${f.index}]) : ARBITRÉ — \`offered\` sur ordre, phrase du lot 6, URL et localisateur du correctif`,
        pol?.availability === "offered" && s.quote === f.quote && s.quote === arb.quote && s.url === arb.url && s.locator === arb.locator && s.verified_date === "2026-09-09", JSON.stringify({ availability: pol?.availability, quote: s.quote, url: s.url }));
      check(`  …projeté « accepté sous conditions » — jamais \`allowed\``, proj?.status === "accepted_with_conditions", JSON.stringify({ status: proj?.status, cause: proj?.status_cause }));
      continue;
    }
    if (cle === "airline_egyptair.cabin" || cle === "airline_egyptair.hold") {
      /* MOUVEMENT NOMMÉ (12/09/2026, source nationale) : les deux citations anglophones du
         lot 6 sont remplacées par la page française officielle, plus précise et relue par
         Philippe. La cabine gagne en outre la première dimension attestée du dépôt. */
      check(`${cle} : source française officielle, phrase, langue et date du 12/09`,
        pol?.availability === "offered" && s.url === "https://www.egyptair.com/fr/fly/special-services/Pages/traveling-with-pets.aspx"
          && s.quote_language === "fr" && s.verified_date === "2026-09-12" && !!s.quote, JSON.stringify(s));
      check(`  …review_due calculé par reviewDueFrom (2026-12-11) et canal toujours sous conditions`,
        s.review_due === reviewDueFrom(s.verified_date ?? "", "airline") && s.review_due === "2026-12-11"
          && proj?.status === "accepted_with_conditions", `${s.verified_date} → ${s.review_due}`);
      continue;
    }
    if (f.airline_id === "airline_south_african_airways") {
      /* MOUVEMENT NOMMÉ (12/09/2026, source nationale actuelle) : le lot exhaustif
         remplace la lecture du lot 6 par trois citations actuelles. La cabine et le
         fret gardent leur verdict. La soute est désormais explicitement circonscrite
         au réseau intérieur et soumise à accord : le modèle la projette donc
         `confirmation_required/airline_approval`, jamais comme un oui réseau entier. */
      const citationAttendue = f.placement === "hold"
        ? "The specifications of cage shall not exceed 1m X 1m & maximum weight of 23kg. (Cages larger than the required specification shall be transported as cargo). Your pet's original vaccination and rabies certificate must be present at the time of pet check-in."
        : f.quote;
      check(`${cle} (LOT6[${f.index}]) : source nationale relue le 12/09, canal conservé ou soute circonscrite`,
        !!pol && s.quote === citationAttendue && s.quote_language === "en" && s.verified_date === "2026-09-12",
        JSON.stringify({ attendu: citationAttendue, lu: s.quote }));
      check(`  …review_due calculé par reviewDueFrom (2026-12-11)`,
        s.review_due === reviewDueFrom(s.verified_date ?? "", "airline") && s.review_due === "2026-12-11",
        `${s.verified_date} → ${s.review_due}`);
      const attendu = f.placement === "cabin" ? "denied" : f.placement === "hold" ? "confirmation_required" : "accepted_with_conditions";
      check(`  …projeté ${attendu}${f.placement === "hold" ? " — cas par cas, réseau intérieur seulement" : ""}`,
        proj?.status === attendu && (f.placement !== "hold" || proj?.status_cause === "airline_approval"),
        JSON.stringify({ status: proj?.status, cause: proj?.status_cause }));
      check(`  …aucun plafond général écrit depuis une règle limitée à la soute intérieure`,
        pol?.weight_includes_carrier === undefined && pol?.max_weight_kg === undefined,
        JSON.stringify({ max: pol?.max_weight_kg, incl: pol?.weight_includes_carrier }));
      continue;
    }
    /* MOUVEMENT NOMMÉ (12/09/2026, source nationale actuelle) : Aeromexico conserve
       mot pour mot les deux lignes de politique du lot 6, mais quitte le sous-domaine
       beta pour la page publique www et reçoit la nouvelle date de lecture. */
    const aeromexicoActualise = cle === "airline_aeromexico.cabin" || cle === "airline_aeromexico.hold";
    const supersedee = SUPERSEDEES[cle];
    const sourceAttendue = supersedee ?? f;
    const urlAttendue = aeromexicoActualise
      ? "https://www.aeromexico.com/es-mx/informacion-de-vuelos/transporte-aereo-de-mascotas"
      : sourceAttendue.url;
    const dateAttendue = aeromexicoActualise ? "2026-09-12" : f.verified_date;
    const echeanceAttendue = aeromexicoActualise ? "2026-12-11" : "2026-12-08";
    check(`${cle} (LOT6[${f.index}]) : phrase, URL, localisateur, langue, date de lecture`,
      !!pol && s.quote === sourceAttendue.quote && s.locator === sourceAttendue.locator && s.quote_language === sourceAttendue.quote_language && s.url === urlAttendue && s.verified_date === dateAttendue,
      JSON.stringify({ attendu: sourceAttendue.quote, lu: s.quote }));
    if (supersedee) check("  …la preuve précédente reste consignée dans l'historique, avec son URL, sa phrase et son localisateur",
      s.history?.some((h) => h.date === supersedee.history_date && h.note?.includes(f.url) && h.note?.includes(f.quote) && h.note?.includes(f.locator)), JSON.stringify(s.history));
    check(`  …review_due calculé par reviewDueFrom (${echeanceAttendue})`, s.review_due === reviewDueFrom(s.verified_date ?? "", "airline") && s.review_due === echeanceAttendue, `${s.verified_date} → ${s.review_due}`);
    const attendu = f.recommendation.startsWith("not_offered") ? "denied" : "accepted_with_conditions";
    check(`  …projeté ${attendu}${REACTIVEES.includes(cle) ? " — ligne non revérifiée RÉACTIVÉE sur citation" : ""}`, proj?.status === attendu, JSON.stringify({ status: proj?.status, cause: proj?.status_cause }));
    const seuil = SEUILS[cle];
    if (seuil) check(`  …plafond ${seuil[0]} kg, chien + contenant — écrit tel que la phrase le dit`,
      proj?.max_weight_kg === seuil[0] && proj?.weight_includes_carrier === seuil[1], JSON.stringify({ max: proj?.max_weight_kg, incl: proj?.weight_includes_carrier }));
    else check(`  …aucun plafond écrit (la phrase n'en porte pas, ou sa portée est une route)`, pol?.weight_includes_carrier === undefined && pol?.max_weight_kg === undefined, JSON.stringify({ max: pol?.max_weight_kg, incl: pol?.weight_includes_carrier }));
  }
  for (const u of d.intentionally_unset) {
    const pol = politique(u.airline_id, u.placement);
    if (u.airline_id === "airline_united" && u.placement === "hold") {
      /* MOUVEMENT NOMMÉ (12/09/2026, lot de 30 compagnies) : la soute United quitte la
         non-décision sur la phrase officielle réservant ce transport à certaines missions. */
      check("United soute quitte la non-décision sur un refus officiel cité",
        !!pol?.source?.quote && projetee(u.airline_id, u.placement)?.status === "denied");
      continue;
    }
    if (u.airline_id === "airline_aeromexico" && u.placement === "cargo") {
      /* MOUVEMENT NOMMÉ (13/09/2026, lot fret) : la page cargo officielle ne couvre
         que le réseau intérieur ; le canal est donc cité mais reste à confirmer. */
      check("Aeromexico fret quitte la non-décision, mais reste à confirmer hors portée nationale",
        !!pol?.source?.quote && projetee(u.airline_id, u.placement)?.status === "confirmation_required");
      continue;
    }
    if (u.airline_id === "airline_latam" && u.placement === "cargo") {
      check("LATAM fret quitte la non-décision sur une offre cargo officielle citée",
        !!pol?.source?.quote && projetee(u.airline_id, u.placement)?.status === "accepted_with_conditions");
      continue;
    }
    if (u.airline_id === "airline_united" && u.placement === "cargo") {
      check("United fret quitte la non-décision sur une restriction officielle citée",
        !!pol?.source?.quote && projetee(u.airline_id, u.placement)?.status === "denied");
      continue;
    }
    check(`non-décision ${u.airline_id}.${u.placement} : aucune citation écrite, « à confirmer »`,
      !pol?.source?.quote && projetee(u.airline_id, u.placement)?.status === "confirmation_required",
      JSON.stringify({ quote: pol?.source?.quote, status: projetee(u.airline_id, u.placement)?.status }));
  }
  /* Aeromexico : la phrase est une LIGNE DE TABLEAU en espagnol, conservée avec ses barres. */
  const am = politique("airline_aeromexico", "cabin")?.source;
  check("Aeromexico : la ligne de tableau citée est conservée telle quelle, en espagnol (`quote_language: es`)",
    am?.quote_language === "es" && am?.quote?.startsWith("Mascota bajo el asiento (PETC)") && am?.quote?.endsWith("Hasta 9 kg (Incluyendo transportadora)"));
  /* La provenance UAT a été retirée, puis la page nationale arabe a refermé le canal. */
  const sc = politique("airline_saudia", "cabin");
  check("Saudia cabine : refus documenté sur la page nationale arabe, jamais sur l'ancienne surface UAT",
    sc?.availability === "not_offered" && sc?.source?.quote_language === "ar" && projetee("airline_saudia", "cabin")?.status === "denied", JSON.stringify(sc));
  check("AUCUNE politique du dépôt ne repose sur une adresse de test (`booking-uat`, `.uat.`, `staging`)",
    !/booking-uat|\.uat\.|staging\./i.test(JSON.stringify(objets.airlines.map((a) => a.premium?.policy ?? {}))),
    (JSON.stringify(objets.airlines.map((a) => a.premium?.policy ?? {})).match(/https?:\/\/[^"]*(booking-uat|\.uat\.|staging\.)[^"]*/) || [""])[0]);
  /* Le seuil Royal Jordanian est désormais écrit depuis la ligne chiffrée du tableau officiel. */
  const rj = projetee("airline_royal_jordanian", "cabin");
  check("Royal Jordanian cabine PROJETÉE : sous conditions, plafond officiel 7 kg animal + caisse",
    rj?.status === "accepted_with_conditions" && rj?.max_weight_kg === 7 && rj?.weight_includes_carrier === true, JSON.stringify(rj));
  /* Les plafonds Aeromexico et EgyptAir étaient jusqu'ici DÉDUITS de la grille tarifaire ; ils sont
     désormais ÉCRITS depuis la phrase, avec la qualification du contenant. */
  const blocFiche = (slug, pl) => { const l = readFileSync(`content/airlines/${slug}.yml`, "utf8").split("\n"); const i = l.findIndex((x) => new RegExp(`^  ${pl}:\\s*$`).test(x)); const j = l.findIndex((x, k) => k > i && /^  [a-z_]+:\s*$/.test(x)); return l.slice(i + 1, j < 0 ? undefined : j).join("\n"); };
  check("Aeromexico 9/45 et EgyptAir 8 : écrits dans les FICHES avec `weight_includes_carrier: true`",
    /max_weight_kg:\s*9/.test(blocFiche("aeromexico", "cabin")) && /max_weight_kg:\s*45/.test(blocFiche("aeromexico", "hold")) && /max_weight_kg:\s*8/.test(blocFiche("egyptair", "cabin"))
      && [blocFiche("aeromexico", "cabin"), blocFiche("aeromexico", "hold"), blocFiche("egyptair", "cabin")].every((b) => /weight_includes_carrier:\s*true/.test(b)));
}

console.log("\n=== Étage 2 — Paris → Mexico, Le Caire : plafonds combinés 9 / 45 et 8 ===");
{
  const g = decide("airport_cdg", "airport_mex", GOLDEN_32), c = decide("airport_cdg", "airport_mex", CAVALIER_6), p = decide("airport_cdg", "airport_mex", CARLIN_8), b = decide("airport_cdg", "airport_mex", BULLY_50);
  const amC = canal(c, "airline_aeromexico", "cabin");
  check("Aeromexico cabine, Cavalier 6 kg et Carlin 8 kg : sous conditions, plafond 9 chien + contenant transporté",
    amC?.status === "accepted_with_conditions" && amC?.weight_limit_kg === 9 && amC?.weight_limit_includes_carrier === true && canal(p, "airline_aeromexico", "cabin")?.status === "accepted_with_conditions", JSON.stringify(amC));
  check("Aeromexico cabine, Golden 32 kg : REFUS sûr ; soute : sous conditions, plafond 45",
    canal(g, "airline_aeromexico", "cabin")?.status === "denied" && canal(g, "airline_aeromexico", "hold")?.status === "accepted_with_conditions" && canal(g, "airline_aeromexico", "hold")?.weight_limit_kg === 45, JSON.stringify(canal(g, "airline_aeromexico", "hold")));
  check("Aeromexico soute, Bully 50 kg : REFUS sûr — 50 kg de chien seul dépassent 45 kg chien + contenant", canal(b, "airline_aeromexico", "hold")?.status === "denied", JSON.stringify(canal(b, "airline_aeromexico", "hold")));
  check("Aeromexico fret : source cargo nationale citée, portée internationale à confirmer", canal(g, "airline_aeromexico", "cargo")?.status === "confirmation_required");
  const eg = decide("airport_cdg", "airport_cai", GOLDEN_32), egC = decide("airport_cdg", "airport_cai", CAVALIER_6), egP = decide("airport_cdg", "airport_cai", CARLIN_8);
  const egCab = canal(egC, "airline_egyptair", "cabin");
  check("EgyptAir cabine, Cavalier 6 kg et Carlin 8 kg : sous conditions, plafond 8 chien + contenant ; Golden 32 kg : refus sûr",
    egCab?.status === "accepted_with_conditions" && egCab?.weight_limit_kg === 8 && egCab?.weight_limit_includes_carrier === true && canal(egP, "airline_egyptair", "cabin")?.status === "accepted_with_conditions" && canal(eg, "airline_egyptair", "cabin")?.status === "denied", JSON.stringify(egCab));
  check("EgyptAir soute, Golden 32 kg : sous conditions sans plafond ; fret non décidé → à confirmer",
    canal(eg, "airline_egyptair", "hold")?.status === "accepted_with_conditions" && canal(eg, "airline_egyptair", "hold")?.weight_limit_kg === undefined && canal(eg, "airline_egyptair", "cargo")?.status === "confirmation_required");
}

console.log("\n=== Étage 2 — Madrid → Santiago, Londres → Newark : LATAM et United, cabines citées, règles héritées nommées ===");
{
  const sclC = decide("airport_mad", "airport_scl", CAVALIER_6), sclG = decide("airport_mad", "airport_scl", GOLDEN_32);
  check("LATAM cabine, soute et fret : sous conditions sur leurs preuves propres",
    canal(sclC, "airline_latam", "cabin")?.status === "accepted_with_conditions" && canal(sclG, "airline_latam", "hold")?.status === "accepted_with_conditions" && canal(sclG, "airline_latam", "cargo")?.status === "accepted_with_conditions");
  /* La preuve cabine LATAM ne publie aucun nombre. Aucun plafond global n'est donc inventé. */
  const lg = canal(sclG, "airline_latam", "cabin");
  check("LATAM cabine, Golden 32 kg : sous conditions qualitatives, sans refus ni plafond chiffré inventé",
    lg?.status === "accepted_with_conditions" && lg?.weight_limit_kg === undefined && !(lg?.confirmation_causes ?? []).some((x) => x.rule_id), JSON.stringify(lg));
  const ewrC = decide("airport_lhr", "airport_ewr", CAVALIER_6), ewrG = decide("airport_lhr", "airport_ewr", GOLDEN_32);
  check("United cabine, Cavalier 6 kg : sous conditions ; soute et fret refusés sur leurs citations",
    canal(ewrC, "airline_united", "cabin")?.status === "accepted_with_conditions" && canal(ewrC, "airline_united", "hold")?.status === "denied" && canal(ewrC, "airline_united", "cargo")?.status === "denied");
  const ug = canal(ewrG, "airline_united", "cabin");
  check("United cabine, Golden 32 kg : sous conditions sans plafond inventé — la page publie explicitement l'absence de limite de poids",
    ug?.status === "accepted_with_conditions" && ug?.weight_limit_kg === undefined && !(ug?.confirmation_causes ?? []).some((x) => x.rule_id), JSON.stringify(ug));
}

console.log("\n=== Étage 2 — Paris → Riyad, Pékin, Nairobi, Amman ; Johannesburg → Le Cap ; Paris → Bahreïn ===");
{
  const ruh = decide("airport_cdg", "airport_ruh", GOLDEN_32), ruhC = decide("airport_cdg", "airport_ruh", CAVALIER_6), ruhP = decide("airport_cdg", "airport_ruh", CARLIN_8);
  check("Saudia cabine : refusée pour tout chien de compagnie sur la page nationale arabe",
    [ruh, ruhC, ruhP].every((x) => canal(x, "airline_saudia", "cabin")?.status === "denied"), JSON.stringify([ruh, ruhC, ruhP].map((x) => canal(x, "airline_saudia", "cabin")?.status)));
  check("Saudia soute sous conditions sur preuve nationale ; fret toujours à confirmer",
    canal(ruh, "airline_saudia", "hold")?.status === "accepted_with_conditions" && canal(ruh, "airline_saudia", "cargo")?.status === "confirmation_required");
  const pek = decide("airport_cdg", "airport_pek", GOLDEN_32), pekC = decide("airport_cdg", "airport_pek", CAVALIER_6);
  const acC = canal(pekC, "airline_air_china", "cabin");
  check("Air China cabine : Cavalier et Golden sous conditions, sans plafond global non cité",
    acC?.status === "accepted_with_conditions" && canal(pek, "airline_air_china", "cabin")?.status === "accepted_with_conditions" && canal(pek, "airline_air_china", "cabin")?.weight_limit_kg === undefined, JSON.stringify(acC));
  check("Air China soute, Golden 32 kg : sous conditions (demande préalable citée) ; fret non décidé → à confirmer",
    canal(pek, "airline_air_china", "hold")?.status === "accepted_with_conditions" && canal(pek, "airline_air_china", "cargo")?.status === "confirmation_required");
  const nbo = decide("airport_cdg", "airport_nbo", GOLDEN_32), nboC = decide("airport_cdg", "airport_nbo", CAVALIER_6);
  check("Kenya Airways, Golden 32 kg : cabine ET soute refusées sur UNE phrase, fret RÉACTIVÉ sur citation → sous conditions",
    canal(nbo, "airline_kenya_airways", "cabin")?.status === "denied" && canal(nbo, "airline_kenya_airways", "hold")?.status === "denied" && canal(nbo, "airline_kenya_airways", "cargo")?.status === "accepted_with_conditions");
  check("Kenya Airways, Cavalier 6 kg : cabine et soute refusées aussi — le refus ne dépend pas du poids",
    canal(nboC, "airline_kenya_airways", "cabin")?.status === "denied" && canal(nboC, "airline_kenya_airways", "hold")?.status === "denied");
  const bah = decide("airport_cdg", "airport_bah", GOLDEN_32), bahC = decide("airport_cdg", "airport_bah", CAVALIER_6);
  check("Gulf Air, Golden 32 kg : cabine ET soute refusées (« All live animals … travel as cargo »), fret RÉACTIVÉ → sous conditions",
    canal(bah, "airline_gulf_air", "cabin")?.status === "denied" && canal(bah, "airline_gulf_air", "hold")?.status === "denied" && canal(bah, "airline_gulf_air", "cargo")?.status === "accepted_with_conditions");
  check("Gulf Air, Cavalier 6 kg : cabine et soute refusées aussi", canal(bahC, "airline_gulf_air", "cabin")?.status === "denied" && canal(bahC, "airline_gulf_air", "hold")?.status === "denied");
  const cpt = decide("airport_jnb", "airport_cpt", GOLDEN_32), cptC = decide("airport_jnb", "airport_cpt", CAVALIER_6);
  check("South African Airways, Golden 32 kg (Johannesburg → Le Cap) : cabine refusée, soute à confirmer sur accord, fret sous conditions",
    canal(cpt, "airline_south_african_airways", "cabin")?.status === "denied"
      && canal(cpt, "airline_south_african_airways", "hold")?.status === "confirmation_required"
      && canal(cpt, "airline_south_african_airways", "hold")?.confirmation_causes?.some((x) => x.code === "airline_approval")
      && canal(cpt, "airline_south_african_airways", "cargo")?.status === "accepted_with_conditions");
  check("South African Airways, Cavalier 6 kg : cabine refusée aussi (« No pets permitted in Cabin. »)", canal(cptC, "airline_south_african_airways", "cabin")?.status === "denied");
  const amm = decide("airport_cdg", "airport_amm", GOLDEN_32), ammC = decide("airport_cdg", "airport_amm", CAVALIER_6);
  check("Royal Jordanian cabine, Cavalier 6 kg : sous conditions au plafond 7 kg ; soute Golden sous conditions ; fret à confirmer",
    canal(ammC, "airline_royal_jordanian", "cabin")?.status === "accepted_with_conditions" && canal(ammC, "airline_royal_jordanian", "cabin")?.weight_limit_kg === 7 && canal(amm, "airline_royal_jordanian", "hold")?.status === "accepted_with_conditions" && canal(amm, "airline_royal_jordanian", "cargo")?.status === "confirmation_required");
}

console.log("\n=== Ce que l'import n'a PAS fait ===");
{
  let allowed = 0;
  for (const a of kb.airlines.values()) for (const p of Object.values(a.premium?.policy ?? {})) if (p.status === "allowed") allowed++;
  check("aucune politique réelle n'est `allowed`", allowed === 0, String(allowed));
  check("Air China cabine a été basculée SUR ARBITRAGE (Codex 09/09, tranché par Philippe), et le dit dans la fiche",
    politique("airline_air_china", "cabin")?.availability === "offered" && /ARBITRAGE \(Codex, 09\/09\/2026/.test(readFileSync("content/airlines/air_china.yml", "utf8")));
  check("United soute et fret : restrictions officielles citées, toutes deux refusées pour le voyageur ordinaire",
    !!politique("airline_united", "hold")?.source?.quote && projetee("airline_united", "hold")?.status === "denied"
      && !!politique("airline_united", "cargo")?.source?.quote && projetee("airline_united", "cargo")?.status === "denied");
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail ? 1 : 0);
