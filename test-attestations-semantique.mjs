#!/usr/bin/env node
/**
 * LE CONTRAT DU RATTACHEMENT `fait → preuve`, ÉPROUVÉ SUR SA PROPRE SURFACE (annexe 51 bis).
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
 * quatre faux verts que les données réelles ne pouvaient pas révéler :
 *   1. `includes_carrier: true` sur un extrait qui ne nomme aucun contenant ;
 *   2. « up to 8 kg » attesté avec la borne STRICTE `lt` ;
 *   3. le « 8 » d'une date pris pour un poids ;
 *   4. le « 75 » d'un numéro de vol pris pour un poids.
 *
 * Les quatre sont ici, nommés, en tête de fichier, avec le piège de négation qui les accompagne.
 * Ils ne partiront jamais : un contrôle qui a déjà attrapé quelque chose se garde.
 *
 * CE FICHIER ÉPROUVE LA FONCTION ; `test-ingest-check.mjs` éprouve LE CHEMIN. Les deux sont
 * nécessaires et aucun ne remplace l'autre — c'est la leçon inverse de celle du matin, et elle a
 * coûté une contre-revue.
 */
import { motifsDeRefus, faitsAttestes, semantiqueAbsente } from "./packages/knowledge/src/attestations.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

/** Un canal complet : l'attestation, la phrase dont elle vient, les champs structurés. */
const canal = (claim, excerpt, champs, quote = excerpt) =>
  ({ attestations: [{ claim, excerpt }], quote, champs });

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

const MAX8 = { kind: "weight_max", kg: 8, bound: "lt", includes_carrier: true };
const CH8 = { max_weight_kg: 8, weight_limit_bound: "lt", weight_includes_carrier: true };

console.log("=== 1. Les quatre faux verts reproduits par Codex sur `80e3ce6` ===");
{
  refuse("(1) `includes_carrier: true` alors que l'extrait ne nomme aucun contenant",
    canal(MAX8, "dogs weighing less than 8 kg may travel in the cabin", CH8), "aucun contenant");

  refuse("(2) « up to 8 kg » attesté avec la borne STRICTE `lt`",
    canal(MAX8, "up to 8 kg with its carrier", CH8), "borne « lt »");

  refuse("(3) le « 8 » d'une DATE pris pour un poids de 8 kg",
    canal({ kind: "weight_max", kg: 8, bound: "lte", includes_carrier: false },
      "updated on 8 September 2026 by the airline",
      { max_weight_kg: 8, weight_limit_bound: "lte", weight_includes_carrier: false }), "pas comme un POIDS");

  refuse("(4) le « 75 » d'un NUMÉRO DE VOL pris pour un poids de 75 kg",
    canal({ kind: "weight_max", kg: 75, bound: "lte", includes_carrier: false },
      "flight AF 75 departs daily from Paris",
      { max_weight_kg: 75, weight_limit_bound: "lte", weight_includes_carrier: false }), "pas comme un POIDS");
}

console.log("\n=== 2. Les pièges qui accompagnent ces quatre-là ===");
{
  /* « no more than » CONTIENT « more than » : un marqueur de plancher au milieu d'un plafond. */
  refuse("(a) « no more than 8 kg » ne prouve pas un PLANCHER `gt`",
    canal({ kind: "weight_min", kg: 8, bound: "gt", includes_carrier: true },
      "no more than 8 kg with its carrier",
      { min_weight_kg: 8, weight_min_bound: "gt", weight_includes_carrier: true }), "borne « gt »");
  /* …et « not less than » ne prouve pas un plafond strict. */
  refuse("(b) « not less than 8 kg » ne prouve pas un PLAFOND `lt`",
    canal(MAX8, "not less than 8 kg with its carrier", CH8), "borne « lt »");
  /* La valeur est en KILOGRAMMES : une livre de même nombre ne l'établit pas. */
  refuse("(c) « 8 lb » ne prouve pas un seuil de 8 KILOS",
    canal(MAX8, "less than 8 lb. with its carrier", CH8), "pas comme un POIDS");
  /* La direction est lue, pas supposée : une phrase qui dit un plafond ne fonde pas un plancher. */
  refuse("(d) « less than 8 kg » ne prouve pas un PLANCHER `gte`",
    canal({ kind: "weight_min", kg: 8, bound: "gte", includes_carrier: true },
      "less than 8 kg with its carrier",
      { min_weight_kg: 8, weight_min_bound: "gte", weight_includes_carrier: true }), "borne « gte »");
  /* Le sujet inverse : on ne peut pas dire « chien seul » dans une phrase qui parle du sac. */
  refuse("(e) `includes_carrier: false` alors que l'extrait parle d'un contenant",
    canal({ kind: "weight_max", kg: 8, bound: "lt", includes_carrier: false },
      "chiens de moins de 8 kg, sac de transport compris",
      { max_weight_kg: 8, weight_limit_bound: "lt", weight_includes_carrier: false }), "chien SEUL");
  /* Une tournure hors de la liste fermée est REFUSÉE, jamais devinée. */
  refuse("(f) une tournure absente de la liste fermée est refusée, pas interprétée",
    canal(MAX8, "dogs tipping the scales beneath 8 kg with their carrier", CH8), "liste fermée");
}

console.log("\n=== 3. Les gardes antérieures tiennent toujours ===");
{
  refuse("(g) l'extrait ne vient pas de la citation de CE canal — preuve permutée",
    { ...canal(MAX8, "chiens de moins de 8 kg, sac de transport compris", CH8),
      quote: "If your cat or dog weighs more than 8 kg with its carrier, it must travel in the hold." },
    "ne se trouve pas dans la citation");
  refuse("(h) une dimension non portée par l'extrait",
    canal({ kind: "carrier_dims_cm", l: 46, w: 28, h: 24 }, "sac de transport compris",
      { carrier_dims_cm: { l: 46, w: 28, h: 24 } }), "ne porte pas");
  refuse("(i) la claim est en désaccord avec le champ structuré",
    canal(MAX8, "chiens de moins de 8 kg, sac de transport compris",
      { max_weight_kg: 10, weight_limit_bound: "lt", weight_includes_carrier: true }), "max_weight_kg");
  const deuxFois = { attestations: [{ claim: MAX8, excerpt: "chiens de moins de 8 kg, sac compris" },
    { claim: MAX8, excerpt: "chiens de moins de 8 kg, sac compris" }],
    quote: "chiens de moins de 8 kg, sac compris", champs: CH8 };
  refuse("(j) deux attestations du même type de fait", deuxFois, "même type de fait");
  /* UN SEUL motif suffit à tout éteindre : on ne publie pas la moitié d'un rattachement cassé. */
  const moitie = { attestations: [{ claim: MAX8, excerpt: "chiens de moins de 8 kg, sac compris" },
    { claim: { kind: "carrier_dims_cm", l: 46, w: 28, h: 24 }, excerpt: "chiens de moins de 8 kg, sac compris" }],
    quote: "chiens de moins de 8 kg, sac compris", champs: { ...CH8, carrier_dims_cm: { l: 46, w: 28, h: 24 } } };
  check("(k) un rattachement cassé éteint TOUS les faits du canal, pas seulement le sien",
    faitsAttestes(moitie.attestations, moitie.quote, moitie.champs).length === 0,
    JSON.stringify(faitsAttestes(moitie.attestations, moitie.quote, moitie.champs)));
}

console.log("\n=== 4. Les témoins POSITIFS — sans eux, tout refuser serait « vert » ===");
{
  accepte("(l) Air France cabine, telle qu'elle est publiée",
    canal(MAX8, "chats et chiens de moins de 8 kg, sac de transport compris", CH8), ["weight_max"]);

  const HOLD = "weighs more than 8 kg/17.64 lb. and up to 75 kg/165.35 lb. with its carrier";
  accepte("(m) Air France soute, plancher exclusif — l'extrait étendu au contenant",
    canal({ kind: "weight_min", kg: 8, bound: "gt", includes_carrier: true }, HOLD,
      { min_weight_kg: 8, weight_min_bound: "gt", weight_includes_carrier: true }), ["weight_min"]);
  accepte("(n) Air France soute, plafond inclusif sur la même phrase",
    canal({ kind: "weight_max", kg: 75, bound: "lte", includes_carrier: true },
      "up to 75 kg/165.35 lb. with its carrier",
      { max_weight_kg: 75, weight_limit_bound: "lte", weight_includes_carrier: true }), ["weight_max"]);

  /* LA LISTE FERMÉE EST ÉCRITE DANS QUATRE LANGUES : si une seule y est réellement exercée, les
     trois autres sont une promesse. Une par langue, sur une borne différente à chaque fois. */
  accepte("(o) espagnol — « hasta 8 kg » établit un plafond INCLUSIF",
    canal({ kind: "weight_max", kg: 8, bound: "lte", includes_carrier: true },
      "perros de hasta 8 kg, transportin incluido",
      { max_weight_kg: 8, weight_limit_bound: "lte", weight_includes_carrier: true }), ["weight_max"]);
  accepte("(p) portugais — « acima de 8 kg » établit un plancher EXCLUSIF",
    canal({ kind: "weight_min", kg: 8, bound: "gt", includes_carrier: true },
      "caes acima de 8 kg, incluindo a caixa de transporte",
      { min_weight_kg: 8, weight_min_bound: "gt", weight_includes_carrier: true }), ["weight_min"]);
  accepte("(q) français — « à partir de 8 kg » établit un plancher INCLUSIF",
    canal({ kind: "weight_min", kg: 8, bound: "gte", includes_carrier: false },
      "les chiens a partir de 8 kg voyagent en soute",
      { min_weight_kg: 8, weight_min_bound: "gte", weight_includes_carrier: false }), ["weight_min"]);

  /* LES DIMENSIONS : aucune n'est attestée dans le dépôt, la branche doit quand même être vivante. */
  accepte("(r) des dimensions RÉELLEMENT dites par la phrase sont acceptées",
    canal({ kind: "carrier_dims_cm", l: 46, w: 28, h: 24 },
      "le sac ne doit pas depasser 46 x 28 x 24 cm",
      { carrier_dims_cm: { l: 46, w: 28, h: 24 } }), ["carrier_dims_cm"]);
  /* …et la même phrase sans unité ne prouve rien. */
  refuse("(s) « 46 x 28 x 24 » sans unité ne prouve aucune dimension",
    canal({ kind: "carrier_dims_cm", l: 46, w: 28, h: 24 },
      "reference du sac : 46 x 28 x 24 chez le fabricant",
      { carrier_dims_cm: { l: 46, w: 28, h: 24 } }), "avec leur unité");

  /* NON-VACUITÉ DE LA FONCTION ELLE-MÊME : elle sait rendre `null`. */
  check("(t) témoin : `semantiqueAbsente` rend bien `null` sur un fragment complet",
    semantiqueAbsente("chats et chiens de moins de 8 kg, sac de transport compris", MAX8) === null,
    String(semantiqueAbsente("chats et chiens de moins de 8 kg, sac de transport compris", MAX8)));
  check("(u) témoin : aucune attestation du tout → aucun fait, aucun motif",
    faitsAttestes(undefined, "peu importe", {}).length === 0 && motifsDeRefus(undefined, "peu importe", {}).length === 0);
}

console.log("\n=== SUMMARY ===");
console.log(fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
