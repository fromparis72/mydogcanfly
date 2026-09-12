#!/usr/bin/env node
/**
 * LE CONTRAT DU RATTACHEMENT `fait → preuve`, ÉPROUVÉ SUR SA PROPRE SURFACE (annexes 51 à 53).
 *
 *   npx tsx test-attestations-semantique.mjs
 *
 * POURQUOI CE FICHIER N'EXISTAIT PAS, ET CE QUE ÇA A COÛTÉ.
 *
 * Le contrat des attestations est né le 11/09/2026 avec DEUX contre-épreuves seulement — les deux
 * sabotages d'ingestion exigés par Codex — et aucun témoin sur la fonction elle-même. Le raisonnement
 * était que le sabotage sur données réelles vaut mieux qu'une fixture. Il vaut mieux, mais il ne
 * couvre QUE les formes présentes dans les données réelles : deux canaux, une langue et demie, une
 * borne haute et une borne basse. Tout ce que le dépôt ne contient pas encore restait non éprouvé.
 *
 * Codex a exploité ce vide le jour même, sur la tête `80e3ce6` que je venais de déclarer verte, avec
 * quatre faux verts que les données réelles ne pouvaient pas révéler ; puis un CINQUIÈME sur
 * `4443653`, d'une autre nature — l'absence de preuve prise pour une preuve du contraire.
 * Les cinq sont ici, nommés, en tête de fichier. Ils ne partiront jamais : un contrôle qui a déjà
 * attrapé quelque chose se garde.
 *
 * CE FICHIER ÉPROUVE LA FONCTION ; `test-ingest-check.mjs` éprouve LE CHEMIN. Les deux sont
 * nécessaires et aucun ne remplace l'autre — c'est la leçon inverse de celle du matin, et elle a
 * coûté une contre-revue.
 */
import { motifsDeRefus, faitsAttestes, semantiqueAbsente, attestationsNonRelues }
  from "./packages/knowledge/src/attestations.ts";
/* La synthèse vit dans le paquet UI ; le défaut de rendu s'éprouve donc ici, sur la fonction qui
   compose la phrase, et non seulement sur la page construite — les données réelles portent le même
   sujet sur leurs deux bornes et ne peuvent pas montrer ce cas-là. */
import { syntheseAttestee } from "./packages/ui/src/lib/syntheseAttestee.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

/** Un canal complet : l'attestation, la phrase dont elle vient, les champs structurés. */
const canal = (attestation, quote, champs) => ({ attestations: [attestation], quote, champs });
const motifs = (c) => motifsDeRefus(c.attestations, c.quote, c.champs);

const refuse = (label, c, fragmentAttendu) => {
  const m = motifs(c);
  check(label, m.length > 0 && (!fragmentAttendu || m.some((x) => x.includes(fragmentAttendu))),
    m.length ? m.join(" | ") : "(AUCUN motif — faux vert)");
};
const accepte = (label, c, kindsAttendus) => {
  const m = motifs(c);
  const faits = faitsAttestes(c.attestations, c.quote, c.champs).map((x) => x.kind);
  check(label, m.length === 0 && JSON.stringify(faits) === JSON.stringify(kindsAttendus),
    m.length ? m.join(" | ") : `faits = ${JSON.stringify(faits)}`);
};

/* La phrase réelle de la cabine Air France, et les champs réels de sa politique. */
const Q_CAB = "En cabine (chats et chiens de moins de 8 kg, sac de transport compris)";
const CH_CAB = { max_weight_kg: 8, weight_limit_bound: "lt", weight_includes_carrier: true };
const AT_CAB = {
  claim: { kind: "weight_max", kg: 8, bound: "lt", subject: "dog_plus_carrier" },
  poids: "8 kg", borne: "moins de 8 kg", sujet: "8 kg, sac de transport compris",
};

console.log("=== 1. Ce que la MACHINE prouve — les faux verts mécaniques de `80e3ce6` ===");
{
  /* MOUVEMENT NOMMÉ (11/09/2026, arbitrage de Codex). Ce paragraphe comptait quatre cas. Le
     premier — « un sujet “contenant compris” sur un fragment qui ne nomme aucun contenant » — a
     QUITTÉ ce fichier : il relève du SENS, et le sens n'est plus décidé ici. Il est éprouvé au
     paragraphe 6, avec les six autres phrases qui ont battu quatre listes successives.
     Les trois qui restent sont mécaniques, et le resteront : une borne, une unité, un nombre. */

  refuse("(2) « up to 8 kg » rattaché à la borne STRICTE `lt`",
    canal({ claim: { kind: "weight_max", kg: 8, bound: "lt", subject: "dog_plus_carrier" },
      poids: "8 kg", borne: "up to 8 kg", sujet: "up to 8 kg with its carrier" },
      "pets up to 8 kg with its carrier travel in the cabin", CH_CAB), "borne « lt »");

  refuse("(3) le « 8 » d'une DATE rattaché comme un poids de 8 kg",
    canal({ claim: { kind: "weight_max", kg: 8, bound: "lte" },
      poids: "8 September", borne: "up to 8 September" },
      "updated up to 8 September 2026 by the airline",
      { max_weight_kg: 8, weight_limit_bound: "lte" }), "comme un POIDS");

  refuse("(4) le « 75 » d'un NUMÉRO DE VOL rattaché comme un poids de 75 kg",
    canal({ claim: { kind: "weight_max", kg: 75, bound: "lte" },
      poids: "AF 75", borne: "up to AF 75" },
      "flights up to AF 75 depart daily from Paris",
      { max_weight_kg: 75, weight_limit_bound: "lte" }), "comme un POIDS");
}

console.log("\n=== 2. Le cinquième, sur `4443653` : l'absence de preuve n'est pas une preuve ===");
{
  /* LE DÉFAUT. `weight_includes_carrier` absent valait `false`, et l'interface publiait
     « chien seul ». Une politique muette sur le contenant affirmait donc quelque chose. */
  refuse("(5) sujet « chien seul » déclaré alors que la politique ne porte AUCUN champ de contenant",
    canal({ claim: { kind: "weight_max", kg: 8, bound: "lt", subject: "dog_alone" },
      poids: "8 kg", borne: "moins de 8 kg", sujet: "sans son sac" },
      "chiens de moins de 8 kg sans son sac", { max_weight_kg: 8, weight_limit_bound: "lt" }),
    "l'absence ne vaut ni oui ni non");

  refuse("(5 bis) un fragment de sujet qui ne porte même pas les kilos dont il parle",
    canal({ claim: { kind: "weight_max", kg: 8, bound: "lt", subject: "dog_alone" },
      poids: "8 kg", borne: "moins de 8 kg", sujet: "chats et chiens" },
      "chats et chiens de moins de 8 kg", { ...CH_CAB, weight_includes_carrier: false }),
    "ne porte pas les 8 kg");

  refuse("(5 ter) un sujet déclaré SANS fragment rattaché",
    canal({ claim: { kind: "weight_max", kg: 8, bound: "lt", subject: "dog_plus_carrier" },
      poids: "8 kg", borne: "moins de 8 kg" }, Q_CAB, CH_CAB), "sans le rattacher");

  refuse("(5 quater) un fragment de sujet SANS sujet déclaré",
    canal({ claim: { kind: "weight_max", kg: 8, bound: "lt" },
      poids: "8 kg", borne: "moins de 8 kg", sujet: "sac de transport compris" }, Q_CAB, CH_CAB),
    "ne déclare aucun sujet");

  /* ET LE CONTRAIRE, QUI EST LE POINT : une phrase muette sur le contenant reste ATTESTABLE.
     Elle publie sa borne, et ne nomme simplement pas ce qui est pesé. */
  accepte("(5 quinquies) une phrase muette sur le contenant atteste sa BORNE, sans sujet",
    canal({ claim: { kind: "weight_max", kg: 8, bound: "lt" }, poids: "8 kg", borne: "less than 8 kg" },
      "dogs weighing less than 8 kg may travel in the cabin",
      { max_weight_kg: 8, weight_limit_bound: "lt" }), ["weight_max"]);
}

console.log("\n=== 2 bis. Ce que la machine prouve encore, des sabotages de `59d4788` ===");
{
  /* Deux des cinq — « carrier not included » pris pour son contraire, et « without the owner » pris
     pour une exclusion — relèvent du SENS et ont quitté ce fichier avec lui (paragraphe 6). Les
     trois autres sont mécaniques : une proposition, une unité, un sujet commun. */
  refuse("(6) le contenant est mentionné dans une AUTRE proposition de la phrase",
    canal({ claim: { kind: "weight_max", kg: 8, bound: "lt", subject: "dog_plus_carrier" },
      poids: "8 kg", borne: "under 8 kg", sujet: "The carrier must be labelled" },
      "Dogs under 8 kg may travel in cabin. The carrier must be labelled.", CH_CAB),
    "PAS d'une même proposition");

  refuse("(9) « 46 × 28 × 24 in » ne prouve pas 46 × 28 × 24 CENTIMÈTRES",
    canal({ claim: { kind: "carrier_dims_cm", l: 46, w: 28, h: 24 }, dimensions: "46 x 28 x 24 in" },
      "the bag must not exceed 46 x 28 x 24 in", { carrier_dims_cm: { l: 46, w: 28, h: 24 } }),
    "avec leur unité");

  const Q_MIXTE = "Dogs from 8 kg travel in the hold, up to 75 kg with its carrier";
  accepte("(10) préalable : un plancher SANS sujet est attestable seul",
    canal({ claim: { kind: "weight_min", kg: 8, bound: "gte" }, poids: "8 kg", borne: "from 8 kg" },
      Q_MIXTE, { min_weight_kg: 8, weight_min_bound: "gte" }), ["weight_min"]);
  accepte("(10 bis) préalable : le plafond de la même phrase porte, lui, un sujet",
    canal({ claim: { kind: "weight_max", kg: 75, bound: "lte", subject: "dog_plus_carrier" },
      poids: "75 kg", borne: "up to 75 kg", sujet: "up to 75 kg with its carrier" },
      Q_MIXTE, { max_weight_kg: 75, weight_limit_bound: "lte", weight_includes_carrier: true }),
    ["weight_max"]);
}

console.log("\n=== 3. Les pièges qui accompagnent ces cinq-là ===");
{
  const q = (b) => `pets ${b} with its carrier travel in the hold`;
  /* « no more than » CONTIENT « more than » : un marqueur de plancher au milieu d'un plafond. */
  refuse("(a) « no more than 8 kg » ne prouve pas un PLANCHER `gt`",
    canal({ claim: { kind: "weight_min", kg: 8, bound: "gt", subject: "dog_plus_carrier" },
      poids: "8 kg", borne: "no more than 8 kg", sujet: "with its carrier" },
      q("no more than 8 kg"), { min_weight_kg: 8, weight_min_bound: "gt", weight_includes_carrier: true }),
    "borne « gt »");
  refuse("(b) « not less than 8 kg » ne prouve pas un PLAFOND `lt`",
    canal({ claim: { kind: "weight_max", kg: 8, bound: "lt", subject: "dog_plus_carrier" },
      poids: "8 kg", borne: "not less than 8 kg", sujet: "with its carrier" },
      q("not less than 8 kg"), CH_CAB), "borne « lt »");
  /* La valeur est en KILOGRAMMES : une livre de même nombre ne l'établit pas. */
  refuse("(c) « 8 lb » ne prouve pas un seuil de 8 KILOS",
    canal({ claim: { kind: "weight_max", kg: 8, bound: "lt", subject: "dog_plus_carrier" },
      poids: "8 lb.", borne: "less than 8 lb.", sujet: "with its carrier" },
      q("less than 8 lb."), CH_CAB), "comme un POIDS");
  /* La borne doit être collée à CE poids, pas à l'autre borne de la même phrase. */
  refuse("(d) la borne d'un plancher ne peut pas emprunter le marqueur du plafond voisin",
    canal({ claim: { kind: "weight_min", kg: 8, bound: "gt", subject: "dog_plus_carrier" },
      poids: "8 kg", borne: "more than 8 kg/17.64 lb. and up to 75 kg", sujet: "with its carrier" },
      "weighs more than 8 kg/17.64 lb. and up to 75 kg/165.35 lb. with its carrier",
      { min_weight_kg: 75, weight_min_bound: "gt", weight_includes_carrier: true }), "min_weight_kg");
  /* Une tournure hors de la liste fermée est REFUSÉE, jamais devinée. */
  refuse("(e) une tournure absente de la liste fermée est refusée, pas interprétée",
    canal({ claim: { kind: "weight_max", kg: 8, bound: "lt", subject: "dog_plus_carrier" },
      poids: "8 kg", borne: "beneath 8 kg", sujet: "with its carrier" },
      q("beneath 8 kg"), CH_CAB), "liste fermée");
}

console.log("\n=== 4. Les gardes antérieures tiennent toujours ===");
{
  refuse("(f) un fragment qui ne vient pas de la citation de CE canal — preuve permutée",
    canal(AT_CAB, "If your cat or dog weighs more than 8 kg with its carrier, it must travel in the hold.", CH_CAB),
    "ne se trouve pas dans la citation");
  refuse("(g) une dimension que le fragment ne dit pas",
    canal({ claim: { kind: "carrier_dims_cm", l: 46, w: 28, h: 24 }, dimensions: "sac de transport compris" },
      Q_CAB, { carrier_dims_cm: { l: 46, w: 28, h: 24 } }), "avec leur unité");
  refuse("(h) la claim est en désaccord avec le champ structuré",
    canal(AT_CAB, Q_CAB, { ...CH_CAB, max_weight_kg: 10 }), "max_weight_kg");
  const deuxFois = { attestations: [AT_CAB, AT_CAB], quote: Q_CAB, champs: CH_CAB };
  refuse("(i) deux attestations du même type de fait", deuxFois, "même type de fait");
  /* UN SEUL motif suffit à tout éteindre : on ne publie pas la moitié d'un rattachement cassé. */
  const moitie = { attestations: [AT_CAB,
    { claim: { kind: "carrier_dims_cm", l: 46, w: 28, h: 24 }, dimensions: "sac de transport compris" }],
    quote: Q_CAB, champs: { ...CH_CAB, carrier_dims_cm: { l: 46, w: 28, h: 24 } } };
  check("(j) un rattachement cassé éteint TOUS les faits du canal, pas seulement le sien",
    faitsAttestes(moitie.attestations, moitie.quote, moitie.champs).length === 0,
    JSON.stringify(faitsAttestes(moitie.attestations, moitie.quote, moitie.champs)));
}

console.log("\n=== 5. Les témoins POSITIFS — sans eux, tout refuser serait « vert » ===");
{
  accepte("(k) Air France cabine, telle qu'elle est publiée", canal(AT_CAB, Q_CAB, CH_CAB), ["weight_max"]);

  const Q_HOLD = "If your cat or dog weighs more than 8 kg/17.64 lb. and up to 75 kg/165.35 lb. with its carrier, it must travel in the hold.";
  accepte("(l) Air France soute, plancher exclusif — le contenant rattaché par SON fragment",
    canal({ claim: { kind: "weight_min", kg: 8, bound: "gt", subject: "dog_plus_carrier" },
      poids: "8 kg", borne: "more than 8 kg",
      sujet: "8 kg/17.64 lb. and up to 75 kg/165.35 lb. with its carrier" },
      Q_HOLD, { min_weight_kg: 8, weight_min_bound: "gt", weight_includes_carrier: true }), ["weight_min"]);
  accepte("(m) Air France soute, plafond inclusif sur la même phrase",
    canal({ claim: { kind: "weight_max", kg: 75, bound: "lte", subject: "dog_plus_carrier" },
      poids: "75 kg", borne: "up to 75 kg", sujet: "75 kg/165.35 lb. with its carrier" },
      Q_HOLD, { max_weight_kg: 75, weight_limit_bound: "lte", weight_includes_carrier: true }), ["weight_max"]);

  /* LA LISTE FERMÉE EST ÉCRITE DANS QUATRE LANGUES : si une seule y est réellement exercée, les
     trois autres sont une promesse. Une par langue, sur une borne différente à chaque fois. */
  accepte("(n) espagnol — « hasta 8 kg » établit un plafond INCLUSIF",
    canal({ claim: { kind: "weight_max", kg: 8, bound: "lte", subject: "dog_plus_carrier" },
      poids: "8 kg", borne: "hasta 8 kg", sujet: "8 kg, transportin incluido" },
      "perros de hasta 8 kg, transportin incluido",
      { max_weight_kg: 8, weight_limit_bound: "lte", weight_includes_carrier: true }), ["weight_max"]);
  accepte("(o) portugais — « acima de 8 kg » établit un plancher EXCLUSIF",
    canal({ claim: { kind: "weight_min", kg: 8, bound: "gt", subject: "dog_plus_carrier" },
      poids: "8 kg", borne: "acima de 8 kg", sujet: "8 kg, incluindo a caixa de transporte" },
      "caes acima de 8 kg, incluindo a caixa de transporte",
      { min_weight_kg: 8, weight_min_bound: "gt", weight_includes_carrier: true }), ["weight_min"]);
  accepte("(p) français — « à partir de 8 kg », chien pesé SEUL et dit comme tel",
    canal({ claim: { kind: "weight_min", kg: 8, bound: "gte", subject: "dog_alone" },
      poids: "8 kg", borne: "a partir de 8 kg", sujet: "8 kg sans le sac de transport" },
      "les chiens a partir de 8 kg sans le sac de transport voyagent en soute",
      { min_weight_kg: 8, weight_min_bound: "gte", weight_includes_carrier: false }), ["weight_min"]);

  /* LES DIMENSIONS : aucune n'est attestée dans le dépôt, la branche doit quand même être vivante. */
  accepte("(q) des dimensions RÉELLEMENT dites par la phrase sont acceptées",
    canal({ claim: { kind: "carrier_dims_cm", l: 46, w: 28, h: 24 }, dimensions: "46 x 28 x 24 cm" },
      "le sac ne doit pas depasser 46 x 28 x 24 cm", { carrier_dims_cm: { l: 46, w: 28, h: 24 } }),
    ["carrier_dims_cm"]);
  refuse("(r) « 46 x 28 x 24 » sans unité ne prouve aucune dimension",
    canal({ claim: { kind: "carrier_dims_cm", l: 46, w: 28, h: 24 }, dimensions: "46 x 28 x 24 chez" },
      "reference du sac : 46 x 28 x 24 chez le fabricant", { carrier_dims_cm: { l: 46, w: 28, h: 24 } }),
    "avec leur unité");

  /* NON-VACUITÉ DE LA FONCTION ELLE-MÊME : elle sait rendre `null`. */
  check("(s) témoin : `semantiqueAbsente` rend bien `null` sur une attestation complète",
    semantiqueAbsente(AT_CAB) === null, String(semantiqueAbsente(AT_CAB)));
  check("(t) témoin : aucune attestation du tout → aucun fait, aucun motif",
    faitsAttestes(undefined, "peu importe", {}).length === 0 && motifsDeRefus(undefined, "peu importe", {}).length === 0);
}

console.log("\n=== 6. LE RENDU : un sujet prouvé pour UNE borne ne vaut pas pour l'autre ===");
{
  /* CINQUIÈME DÉFAUT DE CODEX SUR `59d4788`, et le seul qui ne vit pas dans le contrat. La synthèse
     écrit le sujet UNE fois, devant les deux bornes : « chien + caisse, plus de 8 kg et jusqu'à
     75 kg ». Elle lisait les sujets PRÉSENTS et ignorait les absents — un plancher sans sujet
     attesté héritait donc du sujet du plafond. Ce qui est prouvé pour une borne ne l'est pas pour
     l'autre, et la phrase rendue l'affirmait quand même. */
  const MIN = (subject) => ({ kind: "weight_min", kg: 8, bound: "gt", ...(subject ? { subject } : {}) });
  const MAX = (subject) => ({ kind: "weight_max", kg: 75, bound: "lte", ...(subject ? { subject } : {}) });
  const rendu = (claims) => syntheseAttestee(claims, "hold", "fr");

  check("(u) les deux bornes portent le MÊME sujet prouvé → il est écrit une fois, devant les deux",
    rendu([MIN("dog_plus_carrier"), MAX("dog_plus_carrier")]) === "chien + caisse, plus de 8 kg et jusqu'à 75 kg",
    String(rendu([MIN("dog_plus_carrier"), MAX("dog_plus_carrier")])));

  check("(v) une seule borne porte un sujet → AUCUN sujet n'est écrit, les bornes restent",
    rendu([MIN(undefined), MAX("dog_plus_carrier")]) === "plus de 8 kg et jusqu'à 75 kg",
    String(rendu([MIN(undefined), MAX("dog_plus_carrier")])));

  check("(w) deux sujets DIFFÉRENTS → aucun sujet n'est écrit",
    rendu([MIN("dog_alone"), MAX("dog_plus_carrier")]) === "plus de 8 kg et jusqu'à 75 kg",
    String(rendu([MIN("dog_alone"), MAX("dog_plus_carrier")])));

  check("(x) aucune borne ne porte de sujet → la synthèse dit la fourchette, et rien de plus",
    rendu([MIN(undefined), MAX(undefined)]) === "plus de 8 kg et jusqu'à 75 kg",
    String(rendu([MIN(undefined), MAX(undefined)])));

  /* NON-VACUITÉ : sans faits, pas de ligne du tout — jamais une phrase qui parle de rien. */
  check("(y) témoin : aucun fait attesté → aucune synthèse", rendu([]) === null, String(rendu([])));
}

console.log("\n=== 7. LA FRONTIÈRE : ce que la machine laisse passer, et que l'humain arrête ===");
{
  /* LES SEPT PHRASES QUI ONT BATTU QUATRE LISTES SUCCESSIVES D'EXPRESSIONS RÉGULIÈRES.
   *
   * Chacune a été, un jour, acceptée comme « contenant compris » ou « chien seul ». Chacune a été
   * fermée par une liste plus longue, et chacune a été suivie d'une reformulation qui repassait.
   * Codex a refusé le cinquième élargissement : une garantie sémantique par expressions régulières
   * n'a pas de terme.
   *
   * Ce paragraphe ne prétend donc PAS que la machine les refuse. Il prouve exactement l'inverse, et
   * c'est le sens du lot : elles passent la garde MÉCANIQUE — le fragment vient de la phrase, le
   * nombre est un poids, la borne est dite — et elles sont arrêtées par le SCELLÉ DE RELECTURE
   * HUMAINE, parce qu'aucun humain ne les a validées. C'est la frontière, écrite en clair.
   *
   * Si l'une d'elles cessait un jour de passer la garde mécanique, ce témoin rougirait — et ce
   * serait une bonne nouvelle à constater, pas un vert à préserver en silence. */
  const PHRASES = [
    ["mot de contenant, aucune relation", "Dogs under 8 kg may travel in cabin, the carrier must be labelled",
      "8 kg may travel in cabin, the carrier must be labelled"],
    ["le sens exactement inverse", "Dogs under 8 kg, carrier not included in this weight, may travel",
      "8 kg, carrier not included in this weight"],
    ["l'inclusion porte sur le prix", "Dogs under 8 kg may travel, with the carrier included in the ticket price",
      "8 kg may travel, with the carrier included in the ticket price"],
    ["l'exclusion porte sur l'étiquette", "Dogs under 8 kg may travel, but a carrier without a label is refused",
      "8 kg may travel, but a carrier without a label is refused"],
    ["le contenant voyage à part", "Dogs under 8 kg may travel with their carrier stored separately",
      "8 kg may travel with their carrier stored separately"],
    ["inclus dans la réservation", "Dogs under 8 kg may travel, with the carrier included in the reservation",
      "8 kg may travel, with the carrier included in the reservation"],
    ["le contenant voyage séparément", "The total weight of the dog is up to 8 kg and the carrier travels separately",
      "up to 8 kg and the carrier travels separately"],
  ];
  for (const [quoi, quote, sujet] of PHRASES) {
    const att = { claim: { kind: "weight_max", kg: 8, bound: "lte", subject: "dog_plus_carrier" },
      poids: "8 kg", borne: "up to 8 kg", sujet };
    const borne = quote.includes("up to") ? "up to 8 kg" : "under 8 kg";
    att.borne = borne;
    const champs = { max_weight_kg: 8, weight_limit_bound: "lte", weight_includes_carrier: true };
    const mecanique = motifsDeRefus([att], quote, champs);
    const humain = attestationsNonRelues("airline_test", { cabin: { source: { quote }, attestations: [att] } });
    check(`${quoi} : la machine ne tranche pas, le scellé arrête`,
      humain.length > 0, `mécanique = ${JSON.stringify(mecanique)} · scellé = ${humain.length} motif(s)`);
  }

  /* ET LE CONTRE-TÉMOIN : une attestation RELUE traverse les deux gardes. Sans lui, « le scellé
     arrête tout » serait vrai et inutile. */
  /* LA SOURCE ENTIÈRE, et pas seulement la citation : depuis le P1 de Codex du 12/09, l'empreinte
     scellée porte tous les champs opposables. Un témoin qui n'en passerait qu'une partie
     rougirait — et il a rougi, ce qui est la preuve que la garde tient. */
  const SRC_CAB = {
    url: "https://wwws.airfrance.fr/information/passagers/voyager-avec-son-animal-chien-chat",
    source_type: "official_website", verified_date: "2026-09-10", review_due: "2026-12-09",
    confidence: 4, reviewer: "Codex — lecture directe de la page officielle", quote: Q_CAB,
    quote_language: "fr",
    locator: "Transport de chiens, de chats et autres animaux de compagnie → option En cabine",
  };
  check("témoin : l'attestation de cabine d'Air France, elle, est relue et passe les DEUX gardes",
    motifs(canal(AT_CAB, Q_CAB, CH_CAB)).length === 0
    && attestationsNonRelues("airline_air_france",
      { cabin: { source: SRC_CAB, attestations: [AT_CAB] } }).length === 0);
}

console.log("\n=== SUMMARY ===");
console.log(fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
