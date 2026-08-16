/**
 * T0-B3 · outil 5 — la PROPOSITION de premier sous-lot, dérivée des mesures.
 *
 *   npx tsx mesures/t0b3-regles-autosourcees/outils/sous-lot.mjs
 *   → mesures/t0b3-regles-autosourcees/sous-lot-propose.json
 *
 * Cet outil ne mesure rien de neuf : il TRIE ce que les outils 1 à 4 ont établi, selon un critère
 * écrit, pour qu'une proposition ne soit pas une opinion déguisée en liste.
 *
 * ─── « DANGEREUSE » RECOUVRE DEUX CHOSES OPPOSÉES, ET IL FAUT LES SÉPARER ─────────────────────
 *
 *   DANGER DE L'ÉTAT ACTUEL — la règle décide d'un refus publié sans qu'aucune preuve extérieure
 *     ne le soutienne. Les 171 le portent, par construction ; ce qui les distingue, c'est le POIDS
 *     de leur décision.
 *
 *   DANGER DE L'INTERVENTION — la retirer ou la corriger ROUVRE un canal. Mesuré, pas supposé :
 *     c'est le verdict « dominante » de l'outil 3, confirmé par le retrait groupé de l'outil 4.
 *
 * Un premier sous-lot doit viser fort sur le premier axe et être maîtrisable sur le second. Il
 * commence donc par les règles DOMINANTES : ce sont elles qui décident seules, et donc elles dont
 * une source erronée ferait le plus de dégâts — dans les deux sens, refus injustifié comme
 * réouverture silencieuse.
 *
 * ─── CE QUE LA MESURE DIT DE L'ORDRE PROPOSÉ EN CONTRE-REVUE ──────────────────────────────────
 *
 * L'ordre suggéré était : interdictions globales, importation, race, placement. La mesure le
 * corrige sur un point net et un seul : les 41 règles de RACE sont toutes redondantes — leur
 * retrait isolé ET groupé ne rouvre aucune soute, la règle globale `rule_global_brachy_hold`
 * (source IATA, non auto-citée) tenant seule le filet. Les traiter en premier occuperait le
 * sous-lot le plus visible avec les règles dont la correction change le moins. Elles restent à
 * revérifier — mais après, et ce dossier dit pourquoi.
 */
import { readFileSync } from "node:fs";
import { ecrireJson, chargerReferentiel } from "./lib-regles.mjs";

const DOSSIER = "mesures/t0b3-regles-autosourcees";
const lire = (f) => JSON.parse(readFileSync(`${DOSSIER}/${f}`, "utf8"));

const { sceau } = chargerReferentiel();
const inventaire = lire("inventaire-171.json");
const classification = lire("classification.json");
const impact = lire("impact-retrait.json");
const groupe = lire("retrait-groupe.json");

const parId = new Map(inventaire.regles.map((r) => [r.id, r]));
const classeDe = new Map(classification.regles.map((r) => [r.id, r.classe]));

/* Cohérence entre les quatre artefacts : trois vues du même ensemble doivent porter les mêmes
   identités, sinon la proposition trierait un ensemble qui n'existe pas. */
const anomalies = [];
const idsInv = new Set(parId.keys());
for (const src of [classification.regles, impact.regles]) {
  for (const r of src) if (!idsInv.has(r.id)) anomalies.push(`${r.id} absent de l'inventaire`);
  if (src.length !== idsInv.size) anomalies.push(`cardinal divergent : ${src.length} vs ${idsInv.size}`);
}

/** Trois strates, disjointes et exhaustives sur les 171. */
const strates = { dominantes: [], redondantes: [], inatteignables: [] };
for (const r of impact.regles) {
  const strate = !r.temoin.construit ? "inatteignables" : r.temoin.dominante ? "dominantes" : "redondantes";
  strates[strate].push(r.id);
}

/* Priorité au sein des dominantes : le poids décisionnel d'abord (une règle qui ferme la soute
   engage la vie de l'animal ; une règle de cabine engage un refus d'embarquement), puis le fait
   qu'elle touche déjà les scénarios publics, puis l'identité pour un ordre total et stable. */
const POIDS_CATEGORIE = { hold_weight: 0, import_rules: 1, cabin_weight: 2, placement: 3, breed_ban: 4 };
const dominantes = strates.dominantes
  .map((id) => {
    const i = parId.get(id), m = impact.regles.find((x) => x.id === id);
    return {
      id, categorie: i.categorie, criticite: i.criticite,
      portee: i.portee, effet: i.effet, conditions: i.conditions,
      seuil: i.params?.max_weight_kg ?? null,
      classe: classeDe.get(id),
      source_actuelle: i.source.url,
      verifiee_le: i.source.verified_date,
      scenarios_publics_affectes: m.public.scenarios_affectes,
      temoin: m.temoin.requete,
      effet_du_retrait: m.temoin.entite_avant && m.temoin.entite_apres
        ? `${m.temoin.entite_avant} → ${m.temoin.entite_apres}`
        : `verdict ${m.temoin.verdict_avant} → ${m.temoin.verdict_apres}`,
    };
  })
  .sort((a, b) =>
    POIDS_CATEGORIE[a.categorie] - POIDS_CATEGORIE[b.categorie] ||
    b.scenarios_publics_affectes - a.scenarios_publics_affectes ||
    a.id.localeCompare(b.id));

/* Le sous-lot proposé : les dominantes de poids décisionnel maximal, bornées à un volume qu'une
   revérification humaine peut réellement absorber. Le nombre n'est pas rond par coquetterie — il
   est celui des deux familles entières, pour qu'aucune compagnie ne reste à moitié traitée. */
const familles = ["hold_weight", "import_rules"];
const sousLot = dominantes.filter((d) => familles.includes(d.categorie));

const doc = {
  lot: "T0-B3 — mesure des règles auto-sourcées",
  nature: "PROPOSITION — aucune correction appliquée ; la décision revient à Philippe après contre-revue",
  sceau,
  anomalies,
  strates: Object.fromEntries(Object.entries(strates).map(([k, v]) => [k, v.length])),
  lecture_des_strates: {
    dominantes: "le retrait change l'état de l'entité sur un témoin qui déclenche la règle : elle décide seule",
    redondantes: "le témoin la déclenche, mais le retrait ne change rien : une autre règle dit déjà la même chose",
    inatteignables: "aucun témoin constructible — les 31 pays concernés n'ont AUCUN aéroport au référentiel",
  },
  garde_fou_mesure: {
    rappel: "les 41 règles de race sont redondantes UNE À UNE, mais pas avec la règle globale",
    preuve: groupe.mesures.find((m) => m.groupe.startsWith("breed_ban auto-citées +")) ?? null,
    consequence:
      "toute intervention sur la famille brachycéphale doit vérifier que rule_global_brachy_hold " +
      "reste en place : sans elle, 41 soutes se rouvrent pour un chien au museau écrasé.",
  },
  sous_lot_propose: {
    intitule: "T0-B3-a — revérifier les seuils de soute et les règles d'importation atteignables",
    familles,
    regles: sousLot.length,
    entites_concernees: new Set(sousLot.map((d) => d.portee.id)).size,
    pourquoi:
      "Ce sont les règles DOMINANTES au poids décisionnel le plus lourd : un seuil de soute faux " +
      "refuse un chien qui pouvait voler, ou en accepte un qui ne le pouvait pas ; une règle " +
      "d'importation fausse envoie un voyageur vers une frontière qui le refusera. Les 34 seuils " +
      "de soute sont dominants à 34 sur 34 — aucun filet derrière eux. Les 13 règles " +
      "d'importation retenues sont celles dont le pays est réellement atteignable ; les 31 autres " +
      "visent des pays sans aucun aéroport au référentiel et ne peuvent affecter aucun visiteur.",
    liste: sousLot,
  },
  apres_ce_sous_lot: [
    "cabin_weight — 31 dominantes sur 40, mais un refus de cabine se rattrape en soute",
    "placement — 1 dominante sur 12 ; l'essentiel est déjà porté par la politique canonique",
    "breed_ban — 41 redondantes ; à revérifier pour la confiance, sans urgence décisionnelle",
    "les 31 règles d'importation inatteignables — à traiter le jour où ces pays reçoivent un aéroport",
  ],
};

ecrireJson(`${DOSSIER}/sous-lot-propose.json`, doc);
console.log(`proposition écrite : ${DOSSIER}/sous-lot-propose.json`);
console.log(`  strates : ${doc.strates.dominantes} dominantes · ${doc.strates.redondantes} redondantes · ${doc.strates.inatteignables} inatteignables`);
console.log(`  sous-lot T0-B3-a : ${sousLot.length} règles · ${doc.sous_lot_propose.entites_concernees} entités`);
console.log(`  anomalies de cohérence : ${anomalies.length}`);
for (const a of anomalies.slice(0, 5)) console.log(`    · ${a}`);
