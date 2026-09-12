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
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
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
    portees.length === 3 && portees.every((e) => e.includes('"airline":"airline_air_france"')),
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
    /* ── P1 DE CODEX (12/09) : LA PROVENANCE ENTIÈRE EST OPPOSABLE ───────────────────────────
       L'empreinte ne liait que la citation. Ces cinq mutations-là passaient donc toutes :
       le lien officiel, la langue annoncée au visiteur, l'emplacement sur la page et les deux
       dates de fraîcheur pouvaient dériver SANS relecture. Un rattachement est relu CONTRE une
       source précise ; changer la source change ce qui a été relu. */
    ["l'URL officielle remplacée", (c) => { c.cabin.source.url = "https://wwws.airfrance.fr/autre-page"; }],
    ["la langue annoncée de la citation changée", (c) => { c.cabin.source.quote_language = "en"; }],
    ["le localisateur réécrit", (c) => { c.cabin.source.locator = "Ailleurs sur la page"; }],
    ["la date de vérification avancée", (c) => { c.cabin.source.verified_date = "2026-09-12"; }],
    ["l'échéance de revue repoussée", (c) => { c.cabin.source.review_due = "2030-01-01"; }],
    ["le type de source changé", (c) => { c.cabin.source.source_type = "press"; }],
    ["le relecteur changé sans relecture", (c) => { c.cabin.source.reviewer = "quelqu'un d'autre"; }],
    ["l'indice de confiance relevé", (c) => { c.cabin.source.confidence = 5; }],
  ];
  for (const [quoi, f] of mutations) {
    const motifs = attestationsNonRelues("airline_air_france", muter(f));
    check(`${quoi} → NON RELUE`, motifs.length > 0, motifs.length ? "" : "(AUCUN motif — faux vert)");
  }

  /* LA SEULE EXCLUSION, ET ELLE EST NOMMÉE. `source.history` est le journal des révisions
     passées : y ajouter une ligne est de la tenue de registre, pas une affirmation nouvelle sur
     la compagnie. Sans ce témoin, l'exclusion serait une porte dont personne ne vérifie qu'elle
     est la seule. */
  check("`source.history` n'entre PAS dans l'empreinte — y ajouter une ligne n'exige pas de relecture",
    attestationsNonRelues("airline_air_france",
      muter((c) => { c.cabin.source.history = [{ verified_date: "2026-01-01", url: "https://exemple" }]; })).length === 0,
    JSON.stringify(attestationsNonRelues("airline_air_france",
      muter((c) => { c.cabin.source.history = [{ verified_date: "2026-01-01", url: "https://exemple" }]; }))));

  /* …ET LE TÉMOIN POSITIF : la fiche telle qu'elle est publiée passe. Sans lui, « tout refuser »
     serait vert. */
  check("témoin : la fiche Air France INTACTE est relue et acceptée",
    attestationsNonRelues("airline_air_france", pol).length === 0,
    attestationsNonRelues("airline_air_france", pol).join(" | "));

  /* Le motif NOMME l'empreinte à relire : une relecture humaine n'a rien à recomposer. */
  const m = attestationsNonRelues("airline_air_france", muter((c) => { c.cabin.attestations[0].borne = "de moins de 8 kg"; }));
  check("le refus donne l'empreinte EXACTE à ajouter au scellé",
    m[0].includes('"airline":"airline_air_france"') && m[0].includes('"placement":"cabin"')
    && m[0].includes('"borne":"de moins de 8 kg"'), m[0]);
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

console.log("\n=== 4. L'empreinte est stable, elle distingue, et elle ne collisionne pas ===");
{
  const a = { claim: { kind: "weight_max", kg: 8, bound: "lt", subject: "dog_plus_carrier" },
    poids: "8 kg", borne: "moins de 8 kg", sujet: "8 kg, sac compris" };
  const src = (quote) => ({ url: "https://exemple.fr", source_type: "official_website", quote,
    quote_language: "fr", locator: "ici", verified_date: "2026-09-01", review_due: "2026-11-30", confidence: 4 });
  const e = (x, p, q) => empreinteAttestation(x, p, a, src(q));
  check("la même attestation donne toujours la même empreinte",
    e("airline_x", "cabin", "q") === e("airline_x", "cabin", "q"));
  check("la compagnie entre dans l'empreinte", e("airline_x", "cabin", "q") !== e("airline_y", "cabin", "q"));
  check("le canal entre dans l'empreinte", e("airline_x", "cabin", "q") !== e("airline_x", "hold", "q"));
  check("la citation entre dans l'empreinte", e("airline_x", "cabin", "q") !== e("airline_x", "cabin", "q2"));
  /* Une source ABSENTE ne doit pas se confondre avec une source quelconque : sans quoi retirer la
     preuve d'un canal laisserait son attestation scellée. */
  check("une source absente ne se confond avec aucune source",
    empreinteAttestation("airline_x", "cabin", a, undefined) !== e("airline_x", "cabin", "q"));

  /* ── LA COLLISION, SUR UN CAS CONCRET (P1 de Codex, point 2) ────────────────────────────────
     L'ancien assemblage écrivait `poids=…|borne=…|sujet=…` puis joignait le tout par « § ». Il
     suffisait qu'un fragment CONTIENNE l'un de ces noms de champ pour que deux attestations
     distinctes produisent la même chaîne. Les deux ci-dessous sont exactement ce cas : sous
     l'ancien format, toutes deux donnaient « poids=8 kg|borne=a|sujet=b|sujet=- ». */
  const A = { claim: a.claim, poids: "8 kg", borne: "a|sujet=b", sujet: undefined };
  const B = { claim: a.claim, poids: "8 kg", borne: "a", sujet: "b|sujet=-" };
  const ancienne = (x) => `poids=${x.poids}|borne=${x.borne}|sujet=${x.sujet ?? "-"}`;
  check("préalable : ces deux jeux de fragments COLLISIONNAIENT sous l'ancien assemblage",
    ancienne(A) === ancienne(B), `${ancienne(A)}\n         ${ancienne(B)}`);
  check("…et la sérialisation canonique les sépare",
    empreinteAttestation("airline_x", "cabin", A, src("q")) !== empreinteAttestation("airline_x", "cabin", B, src("q")));

  /* Le séparateur n'existe plus : un fragment qui contient des guillemets ou des accolades est
     échappé, pas interprété. */
  const C = { claim: a.claim, poids: '8 kg","borne":"x', borne: "moins de 8 kg", sujet: "8 kg, sac compris" };
  check("un fragment qui imite la syntaxe de l'empreinte est échappé, pas interprété",
    empreinteAttestation("airline_x", "cabin", C, src("q")) !== empreinteAttestation("airline_x", "cabin", a, src("q")));
}

console.log("\n=== 5. Le fichier du scellé est VALIDÉ, et les doublons sont refusés ===");
{
  /* Un scellé mal formé est pire qu'un scellé absent : il autorise sans que personne ne sache
     quoi. La lecture est donc relue par un schéma strict, et un doublon d'empreinte est REFUSÉ
     plutôt que fondu dans un `Set` — deux relectures d'un même rattachement, c'est une relecture
     de trop qu'aucun compteur n'aurait signalée.

     Ces contrôles s'exécutent dans un PROCESSUS COURT, sur une copie du paquet : la garde lève au
     CHARGEMENT du module, et un test qui la déclencherait dans son propre processus emporterait
     tout le harnais avec elle. */
  const require2 = createRequire(import.meta.url);
  const { spawnSync } = require2("node:child_process");
  const fs = require2("node:fs");
  const path = require2("node:path");
  const os = require2("node:os");

  const ROOT = path.dirname(fileURLToPath(import.meta.url));
  const SCELLE_REL = path.join("packages", "knowledge", "raw", "attestations-relues.json");
  const original = JSON.parse(fs.readFileSync(path.join(ROOT, SCELLE_REL), "utf8"));

  /** Écrit un scellé muté dans un bac à sable, tente de l'importer, rend le code et la sortie. */
  const chargerAvec = (mutation) => {
    /* LE BAC À SABLE VIT DANS LE DÉPÔT (`.scelle-sandbox/`, ignoré par git), comme celui de
       `test-ingest-check.mjs`. Écrit d'abord dans `/tmp`, il ne résolvait ni `zod` ni les modules
       du paquet : la remontée vers `node_modules` s'arrêtait à la racine du disque, et les six
       contrôles rougissaient pour une raison qui n'avait rien à voir avec ce qu'ils mesurent.
       L'arbre RÉEL n'est jamais muté — c'est la règle du dépôt, et une interruption au mauvais
       moment laisserait sinon un scellé corrompu. */
    const bac = fs.mkdtempSync(path.join(ROOT, ".scelle-sandbox-"));
    try {
      fs.cpSync(path.join(ROOT, "packages", "knowledge"), path.join(bac, "packages", "knowledge"),
        { recursive: true, filter: (src) => !src.includes("node_modules") });
      const copie = JSON.parse(JSON.stringify(original));
      mutation(copie);
      fs.writeFileSync(path.join(bac, SCELLE_REL), JSON.stringify(copie, null, 2) + "\n");
      const entree = path.join(bac, "sonde.mts");
      fs.writeFileSync(entree,
        'import { empreintesScellees } from "./packages/knowledge/src/attestations.ts";\n'
        + 'console.log(empreintesScellees().length);\n');
      const r = spawnSync(process.execPath, ["--import", "tsx", entree],
        { encoding: "utf8", cwd: ROOT, maxBuffer: 8 * 1024 * 1024 });
      return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
    } finally {
      fs.rmSync(bac, { recursive: true, force: true });
    }
  };

  const temoin = chargerAvec(() => {});
  check("témoin : le scellé RÉEL se charge, et rend ses 3 empreintes", temoin.code === 0 && temoin.out.trim().endsWith("3"),
    temoin.out.slice(-400));

  const doublon = chargerAvec((c) => { c.attestations.push({ ...c.attestations[0] }); });
  check("une empreinte EN DOUBLE est refusée, pas absorbée", doublon.code !== 0, doublon.out.slice(-300));
  check("…et le refus nomme le doublon", doublon.out.includes("EN DOUBLE"), doublon.out.slice(-300));

  const cleInconnue = chargerAvec((c) => { c.attestations[0].note = "x"; });
  check("une clé inconnue dans une entrée est refusée", cleInconnue.code !== 0, cleInconnue.out.slice(-300));

  const sansSens = chargerAvec((c) => { c.attestations[0].sens_relu = "ok"; });
  check("un « sens relu » vide ou expédié est refusé — la relecture doit dire ce qu'elle a compris",
    sansSens.code !== 0, sansSens.out.slice(-300));

  const dateFolle = chargerAvec((c) => { c.relu_le = "hier"; });
  check("une date de relecture mal formée est refusée", dateFolle.code !== 0, dateFolle.out.slice(-300));

  const champManquant = chargerAvec((c) => { delete c.relu_par; });
  check("un scellé sans relecteur nommé est refusé", champManquant.code !== 0, champManquant.out.slice(-300));
}

console.log("\n=== SUMMARY ===");
console.log(fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
