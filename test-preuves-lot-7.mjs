#!/usr/bin/env node
/**
 * CONTRE-ÉPREUVES DU LOT 7 DE L'IMPORT STRICT — 23 faits de Codex (09/09/2026), 23 importés, 0 refusé.
 *
 *   npx tsx test-preuves-lot-7.mjs
 *
 * Même méthode que les lots précédents. Ce que ce lot apporte de NEUF, et qui est éprouvé ici :
 *   · RÈGLE PRÉCISÉE sur les seuils (importeur, table SEUILS) : un plafond n'est écrit que si la phrase
 *     citée porte le chiffre ET la base du poids (animal + contenant). Écrits : Air Austral 8, La
 *     Compagnie 8. Non écrits : Air Algérie 6 (« small pets under 6 kg » — base absente), Corsair
 *     8/50, Iberia Express 8/45, Luxair 8 (chiffre absent de la phrase). Air Algérie PERD son 6 kg
 *     jusque-là déduit de la grille tarifaire (cabine désormais citée) ;
 *   · quatre lignes non revérifiées réactivées sur citation, toutes en fret (Air Caraïbes, Air
 *     Tahiti Nui, Aircalin, Corsair) ;
 *   · deux compagnies « fret uniquement » ou « cabine seule » : Aircalin (cabine et soute refusées
 *     sur UNE phrase, fret sous conditions), La Compagnie (cabine 8 kg sac compris, soute refusée) ;
 *   · citations en FRANÇAIS et en ESPAGNOL conservées telles quelles ;
 *   · MESURÉ, et nommé comme dette : des règles de poids héritées non citées gardent un Golden de
 *     32 kg « à confirmer » en cabine chez Air Algérie, Air Caraïbes, Air Tahiti Nui, Corsair, French
 *     Bee (nommées) — jamais un refus prouvé, jamais un oui.
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

const DOSSIER = "mesures/preuves/import-strict-lot-7-2026-09-09/PREUVES_POLITIQUES_COMPAGNIES_LOT_7_STRICT_2026-09-09.json";
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
  "airline_air_algerie.cabin": { max: 6, incl: true }, "airline_air_algerie.hold": { max: 32, incl: false }, "airline_air_algerie.cargo": { min: 32, incl: false },
  "airline_air_austral.cabin": { max: 8, incl: true }, "airline_air_austral.hold": { max: 75, incl: true }, "airline_air_austral.cargo": { min: 75, incl: true },
  "airline_air_caraibes.cabin": { max: 8, incl: true }, "airline_air_caraibes.hold": { max: 75, incl: true }, "airline_air_caraibes.cargo": { min: 75, incl: true },
  "airline_air_tahiti_nui.cabin": { max: 8, incl: true },
  "airline_corsair.cabin": { max: 8, incl: true }, "airline_corsair.hold": { max: 50, incl: true }, "airline_corsair.cargo": { min: 50, incl: true },
  "airline_french_bee.cabin": { max: 8, incl: true }, "airline_french_bee.hold": { max: 75, incl: true }, "airline_french_bee.cargo": { min: 75, incl: true },
  "airline_iberia_express.cabin": { max: 8, incl: true }, "airline_iberia_express.hold": { max: 45, incl: true },
  "airline_la_compagnie.cabin": { max: 8, incl: true },
  "airline_luxair.cabin": { max: 8, incl: true }, "airline_luxair.hold": { min: 8, max: 50, incl: true },
};
const REACTIVEES = ["airline_air_caraibes.cargo", "airline_air_tahiti_nui.cargo", "airline_aircalin.cargo", "airline_corsair.cargo"];
const ACTUALISEES_12_09 = {
  "airline_air_algerie.cabin": {
    url: "https://airalgerie.dz/planifier-et-reserver/bagage/animaux-de-compagnie/",
    quote: "Les animaux domestiques admis en cabine ne doivent pas excéder un poids maximum de 06 kg (animal + contenant de transport).",
    lang: "fr",
  },
  "airline_air_algerie.hold": {
    url: "https://airalgerie.dz/planifier-et-reserver/bagage/animaux-de-compagnie/", verified_date: "2026-09-15",
    quote: "Les animaux en soute sont acceptés d’un poids allant jusqu’à un maximum de 32 kg. Au-delà de 32 kg le transport se fera via le fret.", lang: "fr",
  },
  "airline_air_austral.hold": {
    url: "https://www.air-austral.com/preparer-mon-vol/demandes-speciales/animaux.html", verified_date: "2026-09-09",
    quote: "poids (animal + contenant) ≤ 75kg", lang: "fr",
  },
  "airline_air_caraibes.cabin": {
    url: "https://www.aircaraibes.com/avant-voyage/demandes-particulieres/animaux", verified_date: "2026-09-09",
    quote: "Les chiens et les chats d'un poids maximum de 5kg sur le réseau régional et 8kg sur le réseau transatlantique, contenant compris.", lang: "fr",
  },
  "airline_air_caraibes.hold": {
    url: "https://www.aircaraibes.com/avant-voyage/demandes-particulieres/animaux", verified_date: "2026-09-09",
    quote: "Le poids maximum autorisé pour le transport des AVIH sur les vols transatlantiques est de 75KG (poids de l’animal et cage de type n°5/Ref 700 inclus) au-delà, le transport doit se faire par FRET.", lang: "fr",
  },
  "airline_air_caraibes.cargo": {
    url: "https://www.aircaraibes.com/avant-voyage/demandes-particulieres/animaux", verified_date: "2026-09-09",
    quote: "Le poids maximum autorisé pour le transport des AVIH sur les vols transatlantiques est de 75KG (poids de l’animal et cage de type n°5/Ref 700 inclus) au-delà, le transport doit se faire par FRET.", lang: "fr",
  },
  "airline_air_tahiti_nui.cabin": {
    url: "https://pf.airtahitinui.com/voyager-avec-un-animal", verified_date: "2026-09-09",
    quote: "Le poids total de l’animal et son contenant doit être inférieur ou égal à 8 Kg.", lang: "fr",
  },
  "airline_corsair.cabin": {
    url: "https://www.flycorsair.com/fr/information/avant-voyage/animaux-de-compagnie", verified_date: "2026-09-09",
    quote: "Le poids total (animal + contenant) ne doit pas dépasser 8 kg. En cas de dépassement, l'animal devra voyager en soute.", lang: "fr",
  },
  "airline_corsair.hold": {
    url: "https://www.flycorsair.com/fr/legal/conditions-generales-de-vente-et-de-transport", verified_date: "2026-09-09",
    quote: "Si le poids total de l'animal avec sa cage est inférieur ou égal à 50 kg, le transport s'effectue en soute.", lang: "fr",
  },
  "airline_french_bee.cabin": {
    url: "https://www.frenchbee.com/fr/preparer-voyage/avant-le-vol/animaux",
    quote: "Les chiens et les chats d'un poids maximum de 8kg contenant compris.",
    lang: "fr",
  },
  "airline_french_bee.hold": {
    url: "https://www.frenchbee.com/fr/preparer-voyage/avant-le-vol/animaux",
    quote: "Le poids maximum autorisé pour le transport des AVIH (animal en soute) sur les vols est de 75KG (poids de l'animal et cage inclus), au delà, le transport doit se faire par fret.",
    lang: "fr",
  },
  "airline_iberia_express.cabin": {
    url: "https://www.iberiaexpress.com/informacion-general/informacion-pasajero/antes-de-volar/mascotas",
    quote: "El peso máximo permitido del animal será de 8 kg incluyendo en el mismo el peso del recipiente o jaula en el que será transportado el animal. El recipiente podrá tener como máximo 45 cm de largo, 35 cm de ancho y 25 cm de profundidad, siempre que la suma de estas tres dimensiones no exceda de 105 cm. El transporte debe cumplir estas condiciones teniendo en cuenta que irá situado debajo de los pies del pasajero.",
    lang: "es",
  },
  "airline_iberia_express.hold": {
    url: "https://www.iberiaexpress.com/informacion-general/informacion-pasajero/antes-de-volar/mascotas",
    quote: "Como regla general, el transporte de animales vivos deberá hacerse en la bodega del avión, en recipientes o contenedores adecuados proporcionados por el pasajero. Los recipientes deberán tener las siguientes características: Resistencia y seguridad Comodidad para la talla del animal Ventilación Un cierre que ofrezca garantías de que no va a abrirse en ningún momento Fondo impermeable Cuando no reúna estas condiciones, el transporte será rechazado. CONSIDERACIONES IMPORTANTES: El peso máximo aceptable para animales en bodega es 45 kg (incluyendo el peso del animal + el peso del contenedor) Para vuelos en conexión, el servicio en bodega será aplicable si dicha conexión es mayor a 90 minutos y no supera las 4 horas La petición del servicio ha de realizarse con una antelación mínima de 48 horas a la salida del vuelo Las reservas que no indiquen la raza de los animales serán rechazados Solo se aceptarán un máximo de 2 animales en bodega para cada trayecto en vuelos de corto y medio radio No se aceptarán animales de razas peligrosas, considerandose perros potencialmente peligrosos los de constitución robusta, aquellos que manifiesten un carácter marcadamente agresivo y los siguientes perros y sus cruces Pit Bull Terrier, Staffordshire Bull Terrier, American Staffodshire Terrier, Rottweiler, Dogo Argentino, Fila Brasileiro, Tosa Inu, Akita Inu",
    lang: "es",
  },
  "airline_la_compagnie.cabin": {
    url: "https://www.lacompagnie.com/fr/legal/conditions-of-carriage",
    quote: "l’Animal de Compagnie et son contenant nedoivent pas excéder un poids total de huit (8) kg, et le contenant doitrespecter les dimensions maximales applicables, notamment 55 cm de longueur, 35cm de largeur et 25 cm de hauteur.",
    lang: "fr",
  },
  "airline_la_compagnie.hold": {
    url: "https://www.lacompagnie.com/fr/legal/conditions-of-carriage",
    quote: "Le transport des Animaux de Compagnie et des Chiensd’Assistance Éduqués est autorisé uniquement en cabine. Le transport d’animauxen soute n’est pas proposé par le Transporteur.",
    lang: "fr",
  },
  "airline_luxair.cabin": {
    url: "https://www.luxair.lu/fr/node/502/", verified_date: "2026-09-09",
    quote: "Votre animal ne peut être accepté en cabine que s'il ne pèse pas plus de 8 kg (cage comprise)", lang: "fr",
  },
  "airline_luxair.hold": {
    url: "https://www.luxair.lu/fr/node/502/", verified_date: "2026-09-09",
    quote: "Votre animal ne peut être accepté en cabine que s'il ne pèse pas plus de 8 kg (cage comprise). Votre animal ne peut être accepté en soute que s'il ne pèse pas plus de 50 kg (cage comprise).", lang: "fr",
  },
};

console.log("=== Étage 1 — 23 faits relus, 23 dans la donnée à l'octet près ===");
{
  check("23 faits relus depuis le dossier, 7 non-décisions déclarées", faits.length === 23 && d.intentionally_unset.length === 7);
  for (const f of faits) {
    const cle = `${f.airline_id}.${f.placement}`;
    const pol = politique(f.airline_id, f.placement);
    const s = pol?.source ?? {};
    const proj = projetee(f.airline_id, f.placement);
    const actualisee = ACTUALISEES_12_09[cle];
    if (actualisee) {
      /* MOUVEMENT NOMMÉ (12/09/2026, vague exhaustive) : une source nationale
         actuelle remplace la citation du lot 7. Le témoin garde une comparaison
         exacte de la nouvelle phrase et exige toujours le verdict historique. */
      const dateActuelle = actualisee.verified_date ?? "2026-09-12";
      check(`${cle} (LOT7[${f.index}]) : source nationale actuelle, phrase exacte et localisateur présent`,
        !!pol && s.quote === actualisee.quote && s.url === actualisee.url && s.quote_language === actualisee.lang
          && s.verified_date === dateActuelle && !!s.locator,
        JSON.stringify({ attendu: actualisee.quote, lu: s.quote }));
      check(`  …la preuve précédente reste consignée dans l'historique, avec son URL, sa phrase et son localisateur`,
        s.history?.some((h) => h.date === "2026-09-15" && h.note?.includes(f.url) && h.note?.includes(f.quote) && h.note?.includes(f.locator)), JSON.stringify(s.history));
      check(`  …review_due calculé par reviewDueFrom`,
        s.review_due === reviewDueFrom(s.verified_date ?? "", "airline"),
        `${s.verified_date} → ${s.review_due}`);
      const attendu = f.recommendation.startsWith("not_offered") ? "denied" : "accepted_with_conditions";
      check(`  …projeté ${attendu}`, proj?.status === attendu, JSON.stringify({ status: proj?.status, cause: proj?.status_cause }));
      const seuil = SEUILS[cle];
      if (seuil) check(`  …frontière de poids officielle conservée`,
        (seuil.max === undefined || proj?.max_weight_kg === seuil.max) && (seuil.min === undefined || proj?.min_weight_kg === seuil.min) && proj?.weight_includes_carrier === seuil.incl,
        JSON.stringify({ min: proj?.min_weight_kg, max: proj?.max_weight_kg, incl: proj?.weight_includes_carrier }));
      else check(`  …aucun plafond écrit sans rattachement attesté`,
        pol?.weight_includes_carrier === undefined && pol?.max_weight_kg === undefined,
        JSON.stringify({ max: pol?.max_weight_kg, incl: pol?.weight_includes_carrier }));
      continue;
    }
    check(`${cle} (LOT7[${f.index}]) : phrase, URL, localisateur, langue, date de lecture`,
      !!pol && s.quote === f.quote && s.locator === f.locator && s.quote_language === f.quote_language && s.url === f.url && s.verified_date === f.verified_date,
      JSON.stringify({ attendu: f.quote, lu: s.quote }));
    check(`  …review_due calculé par reviewDueFrom (2026-12-08)`, s.review_due === reviewDueFrom(s.verified_date ?? "", "airline") && s.review_due === "2026-12-08", `${s.verified_date} → ${s.review_due}`);
    const attendu = f.recommendation.startsWith("not_offered") ? "denied" : "accepted_with_conditions";
    check(`  …projeté ${attendu}${REACTIVEES.includes(cle) ? " — ligne non revérifiée RÉACTIVÉE sur citation" : ""}`, proj?.status === attendu, JSON.stringify({ status: proj?.status, cause: proj?.status_cause }));
    const seuil = SEUILS[cle];
    if (seuil) check(`  …frontière de poids écrite telle que la phrase le dit`,
      (seuil.max === undefined || proj?.max_weight_kg === seuil.max) && (seuil.min === undefined || proj?.min_weight_kg === seuil.min) && proj?.weight_includes_carrier === seuil.incl,
      JSON.stringify({ min: proj?.min_weight_kg, max: proj?.max_weight_kg, incl: proj?.weight_includes_carrier }));
    else check(`  …aucun plafond écrit (la phrase ne porte pas le chiffre ET la base du poids)`, pol?.weight_includes_carrier === undefined && pol?.max_weight_kg === undefined, JSON.stringify({ max: pol?.max_weight_kg, incl: pol?.weight_includes_carrier }));
  }
  for (const u of d.intentionally_unset) {
    const pol = politique(u.airline_id, u.placement);
    if (["airline_air_algerie", "airline_air_austral", "airline_french_bee"].includes(u.airline_id) && u.placement === "cargo") {
      const seuil = SEUILS[`${u.airline_id}.cargo`];
      check(`non-décision historique ${u.airline_id}.cargo : refermée sur une frontière fret officielle`,
        !!pol?.source?.quote && projetee(u.airline_id, u.placement)?.status === "accepted_with_conditions"
          && projetee(u.airline_id, u.placement)?.min_weight_kg === seuil.min,
        JSON.stringify({ quote: pol?.source?.quote, status: projetee(u.airline_id, u.placement)?.status }));
      continue;
    }
    check(`non-décision ${u.airline_id}.${u.placement} : aucune citation écrite, « à confirmer »`,
      !pol?.source?.quote && (projetee(u.airline_id, u.placement)?.status ?? "confirmation_required") === "confirmation_required",
      JSON.stringify({ quote: pol?.source?.quote, status: projetee(u.airline_id, u.placement)?.status }));
  }
  const fr = ["airline_air_austral.cabin", "airline_aircalin.cargo", "airline_la_compagnie.cabin"].map((k) => politique(...k.split("."))?.source);
  check("citations en français conservées telles quelles (`quote_language: fr`) : Air Austral, Aircalin, La Compagnie",
    fr.every((s) => s?.quote_language === "fr") && fr[0].quote === "le poids de l'animal + son contenant doit être inférieur à 8 kg" && fr[1].quote === "Le transport des animaux s’effectue en fret uniquement." && fr[2].quote === ACTUALISEES_12_09["airline_la_compagnie.cabin"].quote);
  check("citations en espagnol conservées (`quote_language: es`) : Iberia Express cabine et soute",
    politique("airline_iberia_express", "cabin")?.source?.quote_language === "es" && politique("airline_iberia_express", "hold")?.source?.quote_language === "es");
  /* La page nationale établit désormais le plafond combiné de la cabine. */
  const aaC = projetee("airline_air_algerie", "cabin");
  check("Air Algérie cabine PROJETÉE : sous conditions, plafond officiel 6 kg animal + contenant",
    aaC?.status === "accepted_with_conditions" && aaC?.max_weight_kg === 6 && aaC?.weight_includes_carrier === true, JSON.stringify(aaC));
  check("Aircalin : une seule phrase fonde trois canaux — cabine et soute refusées, fret sous conditions",
    projetee("airline_aircalin", "cabin")?.status === "denied" && projetee("airline_aircalin", "hold")?.status === "denied" && projetee("airline_aircalin", "cargo")?.status === "accepted_with_conditions"
      && new Set(["cabin", "hold", "cargo"].map((c) => politique("airline_aircalin", c)?.source?.quote)).size === 1);
}

console.log("\n=== Étage 2 — Paris → Alger, La Réunion ; Orly → Pointe-à-Pitre, Fort-de-France ===");
{
  const alg = decide("airport_cdg", "airport_alg", GOLDEN_32), algC = decide("airport_cdg", "airport_alg", CAVALIER_6), algP = decide("airport_cdg", "airport_alg", CARLIN_8);
  check("Air Algérie : cabine Cavalier 6 kg sous conditions au plafond 6 ; soute Golden 32 sous conditions ; fret documenté au-delà de 32 kg",
    canal(algC, "airline_air_algerie", "cabin")?.status === "accepted_with_conditions" && canal(algC, "airline_air_algerie", "cabin")?.weight_limit_kg === 6 && canal(alg, "airline_air_algerie", "hold")?.status === "accepted_with_conditions" && canal(alg, "airline_air_algerie", "cargo")?.status === "confirmation_required");
  const aaG = canal(alg, "airline_air_algerie", "cabin"), aaP = canal(algP, "airline_air_algerie", "cabin");
  check("Air Algérie cabine, Golden 32 kg et Carlin 8 kg : refusés au-dessus du plafond officiel de 6 kg",
    aaG?.status === "denied" && aaP?.status === "denied", JSON.stringify(aaP));
  const run = decide("airport_cdg", "airport_run", GOLDEN_32), runC = decide("airport_cdg", "airport_run", CAVALIER_6), runP = decide("airport_cdg", "airport_run", CARLIN_8), runB = decide("airport_cdg", "airport_run", BULLY_50);
  const auC = canal(runC, "airline_air_austral", "cabin");
  /* MOUVEMENT NOMMÉ (09/09/2026, réconciliation — règle des seuils de Codex, tranchée par Philippe) : « inférieur à 8 kg »
     est une borne STRICTE : le Carlin de 8,0 kg, accepté sous conditions à l'import du lot 7, est désormais REFUSÉ. */
  check("Air Austral cabine, Cavalier 6 kg : sous conditions, plafond 8 chien + contenant, borne STRICTE ; Carlin 8,0 kg, Golden 32 kg et Bully 50 kg : REFUS sûr",
    auC?.status === "accepted_with_conditions" && auC?.weight_limit_kg === 8 && auC?.weight_limit_includes_carrier === true && auC?.weight_limit_bound === "lt" && canal(runP, "airline_air_austral", "cabin")?.status === "denied" && canal(run, "airline_air_austral", "cabin")?.status === "denied" && canal(runB, "airline_air_austral", "cabin")?.status === "denied", JSON.stringify(auC));
  check("Air Austral : soute Golden 32 kg sous conditions au plafond 75 ; fret documenté au-dessus de 75 kg",
    canal(run, "airline_air_austral", "hold")?.status === "accepted_with_conditions" && canal(run, "airline_air_austral", "hold")?.weight_limit_kg === 75 && canal(runB, "airline_air_austral", "cargo")?.status === "confirmation_required");
  for (const [dst, nom] of [["airport_ptp", "Pointe-à-Pitre"], ["airport_fdf", "Fort-de-France"]]) {
    const g = decide("airport_ory", dst, GOLDEN_32), c = decide("airport_ory", dst, CAVALIER_6);
    /* MOUVEMENT NOMMÉ (15/09/2026, audit raccordement complet) : la phrase fret ne couvre que
       les animaux de plus de 75 kg. À 32 kg, elle ne prouve ni offre ni refus du fret. */
    check(`Air Caraïbes vers ${nom} : cabine Cavalier 6 kg et soute Golden 32 kg sous conditions ; fret Golden hors de la portée > 75 kg → à confirmer`,
      canal(c, "airline_air_caraibes", "cabin")?.status === "accepted_with_conditions" && canal(g, "airline_air_caraibes", "hold")?.status === "accepted_with_conditions" && canal(g, "airline_air_caraibes", "cargo")?.status === "confirmation_required"
        && canal(g, "airline_air_caraibes", "cargo")?.confirmation_causes?.some((x) => x.code === "weight_scope_unmet"));
    const cg = canal(g, "airline_air_caraibes", "cabin");
    check(`Air Caraïbes vers ${nom} : cabine Golden 32 kg refusé au-dessus du plafond officiel`,
      cg?.status === "denied", JSON.stringify(cg));
  }
  const cor = decide("airport_ory", "airport_fdf", GOLDEN_32), corC = decide("airport_ory", "airport_fdf", CAVALIER_6);
  check("Corsair (Orly → Fort-de-France) : cabine 8 kg, soute 50 kg et fret au-delà de 50, tous reliés à leurs preuves",
    canal(corC, "airline_corsair", "cabin")?.status === "accepted_with_conditions" && canal(corC, "airline_corsair", "cabin")?.weight_limit_kg === 8 && canal(cor, "airline_corsair", "hold")?.status === "accepted_with_conditions" && canal(cor, "airline_corsair", "hold")?.weight_limit_kg === 50 && canal(cor, "airline_corsair", "cargo")?.status === "confirmation_required");
}

console.log("\n=== Étage 2 — Los Angeles → Papeete ; Sydney → Nouméa ; Orly → San Francisco, Newark ; Luxembourg → Paris ===");
{
  const ppt = decide("airport_lax", "airport_ppt", GOLDEN_32), pptC = decide("airport_lax", "airport_ppt", CAVALIER_6);
  check("Air Tahiti Nui (Los Angeles → Papeete) : cabine Cavalier 6 kg sous conditions ; fret RÉACTIVÉ → sous conditions ; soute volontairement NON décidée (Air Tahiti Nui Cargo n'est pas de l'AVIH) → à confirmer",
    canal(pptC, "airline_air_tahiti_nui", "cabin")?.status === "accepted_with_conditions" && canal(ppt, "airline_air_tahiti_nui", "cargo")?.status === "accepted_with_conditions" && canal(ppt, "airline_air_tahiti_nui", "hold")?.status === "confirmation_required");
  const nou = decide("airport_syd", "airport_nou", GOLDEN_32), nouC = decide("airport_syd", "airport_nou", CAVALIER_6);
  check("Aircalin (Sydney → Nouméa), Golden 32 kg et Cavalier 6 kg : cabine ET soute refusées sur citation ; fret, Golden : sous conditions",
    [nou, nouC].every((x) => canal(x, "airline_aircalin", "cabin")?.status === "denied" && canal(x, "airline_aircalin", "hold")?.status === "denied") && canal(nou, "airline_aircalin", "cargo")?.status === "accepted_with_conditions");
  const sfo = decide("airport_ory", "airport_sfo", GOLDEN_32), sfoC = decide("airport_ory", "airport_sfo", CAVALIER_6), sfoP = decide("airport_ory", "airport_sfo", CARLIN_8);
  check("French Bee (Orly → San Francisco) : cabine 8 kg et soute 75 kg appliquées ; fret documenté au-delà de 75 kg",
    canal(sfoC, "airline_french_bee", "cabin")?.status === "accepted_with_conditions" && canal(sfoC, "airline_french_bee", "cabin")?.weight_limit_kg === 8 && canal(sfo, "airline_french_bee", "hold")?.status === "accepted_with_conditions" && canal(sfo, "airline_french_bee", "hold")?.weight_limit_kg === 75 && canal(sfo, "airline_french_bee", "cargo")?.status === "confirmation_required");
  const fbP = canal(sfoP, "airline_french_bee", "hold");
  check("French Bee soute, Carlin 8 kg (brachycéphale) : « à confirmer », jamais un oui — la restriction de race n'est pas citée, elle reste une incertitude nommée",
    fbP?.status === "confirmation_required" && (fbP?.confirmation_causes ?? []).some((x) => x.code === "breed_policy_unreviewed"), JSON.stringify(fbP));
  const ewr = decide("airport_ory", "airport_ewr", GOLDEN_32), ewrC = decide("airport_ory", "airport_ewr", CAVALIER_6);
  const lcC = canal(ewrC, "airline_la_compagnie", "cabin");
  check("La Compagnie (Orly → Newark) : cabine Cavalier 6 kg sous conditions, plafond 8 sac compris ; Golden 32 kg : cabine REFUSÉE au seuil ET soute refusée sur citation",
    lcC?.status === "accepted_with_conditions" && lcC?.weight_limit_kg === 8 && lcC?.weight_limit_includes_carrier === true && canal(ewr, "airline_la_compagnie", "cabin")?.status === "denied" && canal(ewr, "airline_la_compagnie", "hold")?.status === "denied", JSON.stringify(lcC));
  check("La Compagnie fret : politique non revue dans la fiche → à confirmer, jamais une offre déduite",
    projetee("airline_la_compagnie", "cargo")?.status === "confirmation_required");
  const lux = decide("airport_lux", "airport_cdg", GOLDEN_32), luxC = decide("airport_lux", "airport_cdg", CAVALIER_6);
  check("Luxair (Luxembourg → Paris) : cabine Cavalier sous conditions au plafond 8 ; soute Golden sous conditions entre 8 et 50 ; fret à confirmer",
    canal(luxC, "airline_luxair", "cabin")?.status === "accepted_with_conditions" && canal(luxC, "airline_luxair", "cabin")?.weight_limit_kg === 8 && canal(lux, "airline_luxair", "hold")?.status === "accepted_with_conditions" && canal(lux, "airline_luxair", "hold")?.weight_limit_kg === 50 && canal(lux, "airline_luxair", "cargo")?.status === "confirmation_required");
  /* Iberia Express ne dessert aucun des trajets essayés (MAD→LIS, MAD→BCN) : ses deux canaux sont éprouvés à l'étage 1 sur la donnée projetée. */
  check("Iberia Express : cabine et soute projetées sous conditions aux plafonds officiels de 8 et 45 kg",
    projetee("airline_iberia_express", "cabin")?.status === "accepted_with_conditions" && projetee("airline_iberia_express", "hold")?.status === "accepted_with_conditions" && projetee("airline_iberia_express", "cabin")?.max_weight_kg === 8 && projetee("airline_iberia_express", "hold")?.max_weight_kg === 45);
}

console.log("\n=== Ce que l'import n'a PAS fait ===");
{
  let allowed = 0;
  for (const a of kb.airlines.values()) for (const p of Object.values(a.premium?.policy ?? {})) if (p.status === "allowed") allowed++;
  check("aucune politique réelle n'est `allowed`", allowed === 0, String(allowed));
  check("Air Tahiti Nui soute : politique héritée non revue, donc toujours à confirmer",
    politique("airline_air_tahiti_nui", "hold")?.review_state === "legacy_unreviewed" && projetee("airline_air_tahiti_nui", "hold")?.status === "confirmation_required");
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail ? 1 : 0);
