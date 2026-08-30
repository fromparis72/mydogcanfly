#!/usr/bin/env node
/**
 * LA PREUVE MOTEUR DE LA RECOMMANDATION DE CAISSE.
 *
 *   node --import tsx test-partenaire-caisse.mjs           joue les contrôles
 *   node --import tsx test-partenaire-caisse.mjs --json     n'imprime que les PartnerRef produits
 *
 * POURQUOI CE FICHIER EXISTE. Le contrôle DOM du harnais Finder injectait dans sa fixture la
 * raison qu'il allait ensuite exiger : `reason: CRATE_REASON[loc]` puis
 * `bloc.includes(CRATE_REASON[loc])`. Modifier `partner.equipment.reason` dans les traductions,
 * ou casser sa sélection dans `selectPartners`, l'aurait laissé VERT. Et la branche fret
 * n'était jamais exécutée, alors que le lot annonçait huit textes.
 *
 * Ici, les raisons viennent du MOTEUR : `selectPartners` est appelée pour de vrai, sur la base
 * canonique et sur une requête validée par le schéma canonique `FinderRequest`, et sur un
 * rapport RÉEL produit par `runFinder` — dont on ne fait varier que le mode retenu, soute ou
 * fret. Le harnais DOM consomme ensuite CE `PartnerRef`, et non plus le sien : les huit textes
 * attendus n'y sont plus qu'une attente, jamais la source.
 */
import { loadKB } from "./packages/knowledge/src/index.ts";
import { FinderRequest, runFinder, selectPartners } from "./packages/engine/src/index.ts";

const JSON_SEUL = process.argv.includes("--json");
let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => { if (!JSON_SEUL) console.log(`  ✓ ${nom}`); };

const LANGUES = ["en", "fr", "es", "pt"];

/* LES HUIT RAISONS ATTENDUES, en toutes lettres. Elles doivent rester alignées sur
   packages/knowledge/translations/<lang>/strings.json ; si elles changent, c'est une décision
   éditoriale qui doit se voir ici. */
const ATTENDU = {
  hold: {
    en: "Hold travel requires a crate suited to your dog and accepted by the airline operating the flight.",
    fr: "Le voyage en soute exige une cage adaptée à ton chien et acceptée par la compagnie qui opère le vol.",
    es: "El viaje en bodega exige un transportín adecuado a tu perro y aceptado por la aerolínea que opera el vuelo.",
    pt: "Viajar no porão exige uma caixa de transporte adequada ao seu cachorro e aceita pela companhia que opera o voo.",
  },
  cargo: {
    en: "Cargo is booked with a freight agent, not at check-in: quote, drop-off and pick-up at the cargo terminal, and a crate suited to your dog, accepted by the agent and by the airline operating the flight.",
    fr: "En fret, la réservation se fait auprès d’un transitaire, pas au comptoir : devis, dépôt et retrait au terminal fret, avec une cage adaptée à ton chien et acceptée pour l’expédition.",
    es: "En carga la reserva se hace con un agente de carga, no en el mostrador: presupuesto, entrega y recogida en la terminal de carga, con un transportín adecuado a tu perro, aceptado por el agente y por la aerolínea que opera el vuelo.",
    pt: "No transporte como carga, a reserva é feita com um agente de carga, não no balcão: cotação, entrega e retirada no terminal de carga, com uma caixa adequada ao seu cachorro e aceita para o envio.",
  },
};

/* AUCUNE HOMOLOGATION, dans aucune des huit. Le même motif que le harnais DOM, tenu ici sur la
   sortie du moteur — l'endroit où le texte NAÎT. */
const IATA_INTERDIT = /iata[- ]?(compliant|approved|certified)|conforme[s]? (?:à la norme )?iata|homologu|approuvée? par (?:l')?iata|conforme a la iata|norma iata|certificad[oa] iata/i;

const kb = loadKB();

/* Un vrai trajet, une vraie requête : validée par le schéma canonique, jamais bricolée. */
const requete = (locale) => FinderRequest.parse({
  origin: "airport_cdg", destination: "airport_bkk",
  dog: { breed_id: "breed_golden_retriever", weight_kg: 30 },
  date: "2027-01-15", locale,
});

const sortie = {};
for (const locale of LANGUES) {
  const req = requete(locale);
  /* Un rapport RÉEL, puis un seul paramètre varié : le mode effectivement retenu. C'est ce que
     lit `selectPartners` pour choisir entre la phrase soute et la phrase fret. */
  const reel = runFinder(kb, req);
  for (const mode of ["hold", "cargo"]) {
    const rapport = { ...reel, compatible: [{ airline_id: "airline_air_france", placement: mode }] };
    const refs = selectPartners(kb, req, rapport, locale);
    const caisse = refs.find((p) => p.vertical === "equipment");
    if (!caisse) { echec(`${locale}/${mode}`, "le moteur ne recommande aucune caisse"); continue; }
    sortie[`${locale}/${mode}`] = caisse;

    if (caisse.reason !== ATTENDU[mode][locale]) {
      echec(`${locale}/${mode} raison exacte`, JSON.stringify(caisse.reason));
    } else if (IATA_INTERDIT.test(caisse.reason)) {
      echec(`${locale}/${mode} homologation`, "la raison produite affirme une conformité IATA");
    } else ok(`${locale}/${mode} : le moteur produit la raison exacte, sans homologation`);

    /* LE NOM INTERNE RESTE BRUT dans le PartnerRef : c'est la donnée, et c'est ce qui rend la
       fuite reproductible côté rendu. Le masquer ici ferait disparaître le défaut au lieu de le
       garder sous contrôle. */
    if (caisse.name !== "IATA Pet Crates") echec(`${locale}/${mode} nom interne`, JSON.stringify(caisse.name));
  }
}

/* Soute et fret doivent VRAIMENT différer : si les deux branches rendaient le même texte, les
   huit contrôles ci-dessus n'en prouveraient que quatre. */
for (const locale of LANGUES) {
  const h = sortie[`${locale}/hold`]?.reason, c = sortie[`${locale}/cargo`]?.reason;
  if (!h || !c) continue;
  if (h === c) echec(`${locale} soute ≠ fret`, "les deux branches rendent le même texte");
  else ok(`${locale} : la branche soute et la branche fret rendent bien deux textes distincts`);
}

if (JSON_SEUL) {
  if (defauts) process.exit(1);
  process.stdout.write(JSON.stringify(sortie));
  process.exit(0);
}
if (defauts) { console.error(`\n[partenaire-caisse] ÉCHEC — ${defauts} contrôle(s) en défaut`); process.exit(1); }
console.log(`\n[partenaire-caisse] les 8 raisons viennent du moteur, exactes, sans homologation, soute et fret distinctes.`);
