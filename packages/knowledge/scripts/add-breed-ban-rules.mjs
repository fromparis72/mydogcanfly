#!/usr/bin/env node
/* Règles d'interdiction de race à l'entrée d'un pays.
 *
 * Pourquoi c'est indispensable : le moteur sait déjà refuser une entrée (entry_allowed passe à
 * false dès qu'une règle pays a l'effet "deny"), mais AUCUNE règle n'utilisait dog.breed_id.
 * Sans ces règles, le Finder répondait « oui » pour un Pit Bull vers Londres — une réponse
 * fausse dont la conséquence réelle est la saisie et l'euthanasie de l'animal.
 *
 * Périmètre volontairement limité aux interdictions NOMMÉMENT vérifiées dans un texte officiel.
 * Les cas dépendant d'un pedigree (France : un Tosa inscrit au LOF est catégorie 2, donc
 * admissible sous conditions, alors que le même chien sans pedigree est catégorie 1 et interdit)
 * ne sont PAS traités par un deny : le moteur ne connaît pas le statut LOF du chien. Ils
 * relèvent du contenu éditorial de la fiche pays, pas d'une règle automatique.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const RULES = resolve(dirname(fileURLToPath(import.meta.url)), "..", "raw", "rules.json");

const PIT = "breed_american_pit_bull_terrier";
const TOSA = "breed_tosa_inu";
const BULLY = "breed_american_bully_xl";

const src = (url) => ({
  url, source_type: "government", verified_date: "2026-07-28",
  review_due: "2027-07-28", confidence: 5, reviewer: "research",
  history: [{ date: "2026-07-28", reviewer: "research", note: "Ajout initial — interdiction de race vérifiée sur le texte officiel." }],
});

const ban = (iso, breeds, url, en, fr, es) => ({
  id: `rule_${iso}_breed_ban_restricted_types`,
  scope: { type: "country", id: `country_${iso}` },
  category: "breed_ban",
  criticality: "critical",
  applies_when: {
    all: [
      { fact: "route.dest_country_id", op: "eq", value: `country_${iso}` },
      { fact: "dog.breed_id", op: "in", value: breeds },
    ],
  },
  effect: { action: "deny" },
  params: {},
  rationale: en,
  rationale_i18n: { fr, es },
  source: src(url),
});

const NEW = [
  ban("gb", [PIT, TOSA, BULLY],
    "https://www.legislation.gov.uk/ukpga/1991/65/section/1",
    "Prohibited under section 1 of the Dangerous Dogs Act 1991: the pit bull terrier type and the Japanese tosa are banned by name, and the XL Bully was added as a designated type. A dog of these types cannot be brought into Great Britain; possession is only lawful under a court-ordered Certificate of Exemption, which cannot be obtained for a dog arriving from abroad.",
    "Interdit par l'article 1 du Dangerous Dogs Act 1991 : le type pit bull terrier et le tosa japonais sont bannis nommément, et l'XL Bully y a été ajouté comme type désigné. Un chien de ces types ne peut pas être introduit en Grande-Bretagne ; la détention n'est licite que sous un certificat d'exemption ordonné par un tribunal, impossible à obtenir pour un chien arrivant de l'étranger.",
    "Prohibido por el artículo 1 de la Dangerous Dogs Act 1991: el tipo pit bull terrier y el tosa japonés están prohibidos por su nombre, y el XL Bully se añadió como tipo designado. Un perro de estos tipos no puede introducirse en Gran Bretaña; la tenencia solo es lícita con un certificado de exención ordenado por un tribunal, inaccesible para un perro que llega del extranjero."),

  ban("fr", [PIT],
    "https://agriculture.gouv.fr/les-chiens-de-categorie-1-et-2-et-les-chiens-dangereux",
    "The American Pit Bull Terrier has no French studbook, so it falls in catégorie 1 (chien d'attaque) under loi n° 99-5. Introducing a catégorie 1 dog into France is entirely prohibited, transit included, with penalties of six months' imprisonment and a €15,000 fine.",
    "L'American Pit Bull Terrier n'a pas de livre des origines français : il relève de la catégorie 1 (chien d'attaque) au titre de la loi n° 99-5. L'introduction d'un chien de catégorie 1 en France est totalement interdite, transit compris, sous peine de 6 mois d'emprisonnement et de 15 000 € d'amende.",
    "El American Pit Bull Terrier no tiene libro de orígenes francés: se clasifica en catégorie 1 (perro de ataque) según la ley n.º 99-5. Introducir un perro de catégorie 1 en Francia está totalmente prohibido, incluido el tránsito, con penas de 6 meses de prisión y 15 000 € de multa."),

  ban("au", [PIT, TOSA],
    "https://www.agriculture.gov.au/biosecurity-trade/cats-dogs/how-to-import/step-by-step-guides/category-3-step-by-step-guide-for-dogs",
    "Prohibited import under the Customs (Prohibited Imports) Regulations 1956. The Department of Agriculture lists the American pit bull terrier (or pit bull terrier) and the Japanese tosa among the breeds that cannot be imported into Australia.",
    "Importation interdite au titre des Customs (Prohibited Imports) Regulations 1956. Le ministère de l'Agriculture liste l'American pit bull terrier (ou pit bull terrier) et le tosa japonais parmi les races qui ne peuvent pas entrer en Australie.",
    "Importación prohibida según las Customs (Prohibited Imports) Regulations 1956. El Ministerio de Agricultura incluye el American pit bull terrier (o pit bull terrier) y el tosa japonés entre las razas que no pueden importarse a Australia."),

  ban("nz", [PIT, TOSA],
    "https://www.mpi.govt.nz/bring-send-to-nz/pets-travelling-to-nz/bringing-cats-and-dogs-to-nz/step-by-step-guide-to-bringing-cats-and-dogs-to-nz",
    "Prohibited under the Dog Control Act 1996. MPI lists the Japanese Tosa as a prohibited breed and the American pit bull terrier as a prohibited type; neither may be imported into New Zealand.",
    "Interdit par le Dog Control Act 1996. Le MPI classe le tosa japonais parmi les races interdites et l'American pit bull terrier parmi les types interdits ; ni l'un ni l'autre ne peut être importé en Nouvelle-Zélande.",
    "Prohibido por la Dog Control Act 1996. El MPI clasifica el tosa japonés como raza prohibida y el American pit bull terrier como tipo prohibido; ninguno puede importarse a Nueva Zelanda."),

  ban("ie", [BULLY],
    "https://www.irishstatutebook.ie/eli/2024/si/491/made/en/print",
    "Importing an XL Bully into Ireland has been illegal since 1 October 2024 under the Control of Dogs (XL Bully) Regulations 2024. Owning one without a Certificate of Exemption has been an offence since 1 February 2025.",
    "Importer un XL Bully en Irlande est illégal depuis le 1er octobre 2024, au titre des Control of Dogs (XL Bully) Regulations 2024. En détenir un sans certificat d'exemption constitue une infraction depuis le 1er février 2025.",
    "Importar un XL Bully a Irlanda es ilegal desde el 1 de octubre de 2024, según las Control of Dogs (XL Bully) Regulations 2024. Tener uno sin certificado de exención es delito desde el 1 de febrero de 2025."),

  ban("de", [PIT],
    "https://www.lufthansa.com/us/en/dangerous-dogs",
    "Germany prohibits bringing in the Pit Bull Terrier under the Hundeverbringungs- und -einfuhrbeschränkungsgesetz, which restricts four breeds. Export and transit remain possible, but import does not.",
    "L'Allemagne interdit l'introduction du Pit Bull Terrier au titre du Hundeverbringungs- und -einfuhrbeschränkungsgesetz, qui vise quatre races. L'export et le transit restent possibles, mais pas l'import.",
    "Alemania prohíbe la introducción del Pit Bull Terrier según la Hundeverbringungs- und -einfuhrbeschränkungsgesetz, que afecta a cuatro razas. La exportación y el tránsito siguen siendo posibles, la importación no."),
];

const rules = JSON.parse(readFileSync(RULES, "utf8"));
const have = new Set(rules.map((r) => r.id));
let added = 0;
for (const r of NEW) {
  if (have.has(r.id)) { console.log(`déjà présent : ${r.id}`); continue; }
  rules.push(r); added++;
}
writeFileSync(RULES, JSON.stringify(rules, null, 2) + "\n");
console.log(`règles ajoutées : ${added} — total ${rules.length}`);
console.log("NON traité par une règle (dépend du pedigree, relève de l'éditorial) :");
console.log("  • France — Tosa : catégorie 1 sans LOF (interdit) / catégorie 2 avec LOF (fret uniquement)");
console.log("  • France — American Bully : non nommé dans l'arrêté du 27 avril 1999, statut ouvert");
console.log("  • Danemark — bannis depuis 1991, texte primaire non vérifié");
