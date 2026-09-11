#!/usr/bin/env node
/**
 * LE SCELLÉ DES RATTACHEMENTS RELUS PAR UN HUMAIN — bidirectionnel (annexe 56).
 *
 *   npx tsx test-attestations-scellees.mjs
 *
 * POURQUOI CE FICHIER EXISTE, ET CE QU'IL REMPLACE.
 *
 * Le contrat d'attestation a subi QUATRE contre-revues en une journée. Chacune a fermé les
 * formulations qu'elle nommait ; chacune a été suivie d'une reformulation qui repassait :
 * « The carrier must be labelled », puis « Carrier not included in this weight », puis
 * « with the carrier included in the ticket price », puis « with their carrier stored separately ».
 * À chaque tour j'ai élargi la liste d'expressions régulières, et à chaque tour la liste suivante
 * était battue par la phrase suivante.
 *
 * Codex a refusé le cinquième élargissement, et il a eu raison : **une garantie sémantique par
 * expressions régulières n'a pas de terme.** La frontière est donc DÉPLACÉE, pas repoussée.
 *
 *   · LA MACHINE prouve la citation exacte, le nombre, l'unité, la borne, le canal et la
 *     concordance avec les champs structurés — `test-attestations-semantique.mjs` l'éprouve ;
 *   · UN HUMAIN valide le SENS du sujet pesé, « contenant compris » ou « chien seul », et cette
 *     validation vit dans `raw/attestations-relues.json` — ce fichier-ci l'éprouve.
 *
 * Le scellé est BIDIRECTIONNEL. Une attestation absente du scellé rougit ; une entrée du scellé
 * sans attestation correspondante rougit aussi. La seconde moitié compte autant que la première :
 * sans elle, le scellé accumulerait des autorisations pour des rattachements qui n'existent plus,
 * et l'une d'elles redeviendrait valable le jour où quelqu'un réécrirait la même phrase.
 */
import { loadKB } from "./packages/knowledge/src/index.ts";
import { empreinteAttestation, empreintesScellees, empreintesPortees, attestationsNonRelues }
  from "./packages/knowledge/src/attestations.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

const kb = loadKB();
const airlines = [...kb.airlines.values()];
const portees = empreintesPortees(airlines);
const scellees = empreintesScellees();

console.log("=== 1. Les deux sens du scellé ===");
{
  /* Le chargement du référentiel a déjà refusé toute attestation non relue — sans quoi la ligne
     ci-dessus aurait levé. On le redit ici en clair, avec les comptes. */
  check(`le référentiel porte ${portees.length} attestation(s), le scellé en relit ${scellees.length}`,
    portees.length === 3 && scellees.length === 3, `${portees.length} / ${scellees.length}`);

  const nonRelues = portees.filter((e) => !scellees.includes(e));
  check("SENS 1 — aucune attestation du référentiel n'échappe au scellé",
    nonRelues.length === 0, nonRelues.slice(0, 2).join("\n         "));

  const orphelines = scellees.filter((e) => !portees.includes(e));
  check("SENS 2 — aucune entrée du scellé ne survit à l'attestation qu'elle autorisait",
    orphelines.length === 0, orphelines.slice(0, 2).join("\n         "));

  /* NON-VACUITÉ : les deux contrôles ci-dessus passeraient aussi sur deux ensembles VIDES. */
  check("témoin : les trois attestations relues sont celles d'Air France",
    portees.length === 3 && portees.every((e) => e.startsWith("airline_air_france§")),
    portees.join("\n         "));
}

console.log("\n=== 2. Le scellé MORD : toute modification exige une relecture ===");
{
  const af = kb.airlines.get("airline_air_france");
  const pol = JSON.parse(JSON.stringify(af.premium.policy));
  const muter = (f) => { const c = JSON.parse(JSON.stringify(pol)); f(c); return c; };

  const mutations = [
    ["un fragment de borne réécrit", (c) => { c.cabin.attestations[0].borne = "de moins de 8 kg"; }],
    ["un fragment de sujet raccourci", (c) => { c.cabin.attestations[0].sujet = "sac de transport compris"; }],
    ["le fragment de poids changé", (c) => { c.cabin.attestations[0].poids = "8 kilos"; }],
    ["la borne de la claim retournée", (c) => { c.cabin.attestations[0].claim.bound = "lte"; }],
    ["le sujet de la claim inversé", (c) => { c.cabin.attestations[0].claim.subject = "dog_alone"; }],
    ["le sujet de la claim retiré", (c) => { delete c.cabin.attestations[0].claim.subject; }],
    ["la valeur du seuil changée", (c) => { c.cabin.attestations[0].claim.kg = 10; }],
    ["la CITATION du canal réécrite", (c) => { c.cabin.source.quote = "En cabine, chiens de moins de 8 kg, sac de transport compris"; }],
    ["une attestation déplacée d'un canal à l'autre", (c) => { c.cargo = { ...c.hold, attestations: c.cabin.attestations }; }],
  ];
  for (const [quoi, f] of mutations) {
    const motifs = attestationsNonRelues("airline_air_france", muter(f));
    check(`${quoi} → NON RELUE`, motifs.length > 0, motifs.length ? "" : "(AUCUN motif — faux vert)");
  }

  /* …ET LE TÉMOIN POSITIF : la fiche telle qu'elle est publiée passe. Sans lui, « tout refuser »
     serait vert. */
  check("témoin : la fiche Air France INTACTE est relue et acceptée",
    attestationsNonRelues("airline_air_france", pol).length === 0,
    attestationsNonRelues("airline_air_france", pol).join(" | "));

  /* Le motif NOMME l'empreinte à relire : une relecture humaine n'a rien à recomposer. */
  const m = attestationsNonRelues("airline_air_france", muter((c) => { c.cabin.attestations[0].borne = "de moins de 8 kg"; }));
  check("le refus donne l'empreinte EXACTE à ajouter au scellé",
    m[0].includes("airline_air_france§cabin§") && m[0].includes("borne=de moins de 8 kg"), m[0]);
}

console.log("\n=== 3. Les trois reformulations qui avaient battu la quatrième liste ===");
{
  /* Elles ne sont plus arbitrées par un motif : elles ne sont simplement PAS RELUES. C'est le
     déplacement de frontière lui-même, éprouvé sur les phrases qui l'ont rendu nécessaire. */
  const PHRASES = [
    "Dogs under 8 kg may travel with their carrier stored separately.",
    "Dogs under 8 kg may travel, with the carrier included in the reservation.",
    "The total weight of the dog is up to 8 kg and the carrier travels separately.",
  ];
  for (const quote of PHRASES) {
    const sujet = quote.replace(/^(?:The |Dogs )/, "").replace(/\.$/, "");
    const pol = {
      cabin: {
        source: { quote },
        attestations: [{
          claim: { kind: "weight_max", kg: 8, bound: "lte", subject: "dog_plus_carrier" },
          poids: "8 kg", borne: "up to 8 kg", sujet,
        }],
      },
    };
    const motifs = attestationsNonRelues("airline_air_france", pol);
    check(`« ${quote.slice(0, 52)}… » → NON RELUE`, motifs.length > 0,
      motifs.length ? "" : "(AUCUN motif — faux vert)");
  }
}

console.log("\n=== 4. L'empreinte est stable, et elle distingue ===");
{
  const a = { claim: { kind: "weight_max", kg: 8, bound: "lt", subject: "dog_plus_carrier" },
    poids: "8 kg", borne: "moins de 8 kg", sujet: "8 kg, sac compris" };
  const e = (x, p, q) => empreinteAttestation(x, p, a, q);
  check("la même attestation donne toujours la même empreinte",
    e("airline_x", "cabin", "q") === e("airline_x", "cabin", "q"));
  check("la compagnie entre dans l'empreinte", e("airline_x", "cabin", "q") !== e("airline_y", "cabin", "q"));
  check("le canal entre dans l'empreinte", e("airline_x", "cabin", "q") !== e("airline_x", "hold", "q"));
  check("la citation entre dans l'empreinte", e("airline_x", "cabin", "q") !== e("airline_x", "cabin", "q2"));
  /* Une citation ABSENTE ne doit pas produire la même empreinte qu'une citation vide ou qu'un
     tiret : sans quoi retirer la preuve d'un canal laisserait son attestation scellée. */
  check("une citation absente ne se confond pas avec une citation quelconque",
    e("airline_x", "cabin", undefined) !== e("airline_x", "cabin", "-x"));
}

console.log("\n=== SUMMARY ===");
console.log(fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
