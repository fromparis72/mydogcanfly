#!/usr/bin/env node
/* Approfondissement du point 2 laissé en attente le 09/08/2026 : après la correction du
 * Saint-Bernard (script précédent), 30 races du référentiel portaient encore le drapeau global
 * `brachycephalic: true`. Ce drapeau est lu par UNE règle globale unique (rule_global_brachy_hold)
 * qui s'applique À TOUTES LES COMPAGNIES sans distinction — correct pour une race réellement
 * brachycéphale (Carlin, Bouledogue…), mais faux pour une race que SEULES certaines compagnies
 * restreignent par leur propre politique commerciale (cf. Staffordshire Bull Terrier/Dogo
 * Argentino, déjà traités en règles PROPRES À Lufthansa/SWISS/KLM dans le script précédent, jamais
 * en touchant leur drapeau global — parce qu'ils sont vraiment non-brachycéphales).
 *
 * MÉTHODE : chacune des 13 races restantes (hors les ~17 races au consensus universel — Carlin,
 * Bouledogue, Boxer, Shih Tzu, Pékinois, Chow-Chow, etc. — non touchées ici) vérifiée sur au moins
 * deux registres indépendants quand possible :
 *   - pages officielles compagnies déjà collectées le 09/08 (Lufthansa, SWISS, KLM) ;
 *   - IATA Live Animals Regulations, 52nd Edition, Addendum I (edition 2026-01-01, iata.org) —
 *     document réglementaire où PLUSIEURS compagnies (Air France AF-01, Lufthansa LH-05, Austrian
 *     OS-03/04, Turkish Cargo TK-01/03/04, Oman Air WY-11) déposent CHACUNE sa propre liste ;
 *   - référence sectorielle généraliste (airtransportanimal.com/en/list-dogs-cats-turned-up-noses).
 *
 * RÉSULTAT : aucune de ces 13 races n'apparaît sur une liste UNIVERSELLE ou anatomiquement
 * consensuelle de la même façon que Carlin/Bouledogue. 8 n'apparaissent QUE sur des listes de
 * gabarit/cage renforcée (sans lien avec le museau) ou sur une seule liste peu fiable (la liste
 * TK-04 de Turkish Cargo inclut par exemple le Chihuahua, ce qui n'est standard nulle part
 * ailleurs — signal que cette liste précise est trop large pour servir seule de preuve) : leur
 * drapeau global passe à false. Les 5 autres ont au moins deux sources dédiées « museau écrasé »
 * concordantes (pas seulement gabarit) et gardent leur drapeau global à true.
 *
 * PASSÉ À FALSE (8, aucune preuve suffisante de brachycéphalie universelle) :
 *   - American Bulldog, American Pit Bull Terrier, American Bully (XL) — apparaissent sur les
 *     listes maison Lufthansa/Austrian, mais PAS universellement (SWISS classe l'American Bully en
 *     « race dangereuse », pas « museau écrasé » — désaccord entre compagnies = pas un fait
 *     anatomique). Repli : ajoutés en règles PROPRES à Lufthansa (déjà champion du Staffordshire
 *     Bull Terrier/Dogo Argentino) pour ne rien perdre là où c'est réellement sourcé.
 *   - Boerboel, Fila Brasileiro, Mastiff (English Mastiff), Olde English Bulldogge : sur AUCUNE
 *     liste "museau écrasé" dédiée trouvée (Fila Brasileiro n'apparaît que sur une liste de types
 *     dangereux/interdits à l'import, sujet différent — déjà traité par ailleurs, cf. Dangerous
 *     Dogs Act britannique).
 *   - Ca de Bou (Majorca Mastiff / Presa Mallorquin) : une seule mention, sur la liste TK-04 déjà
 *     jugée trop large (Chihuahua y figure) — preuve insuffisante.
 *
 * RESTENT À TRUE (5, au moins deux sources "museau écrasé" dédiées concordantes) :
 *   - Bullmastiff (Austrian OS-03 + Turkish TK-04 + référence sectorielle)
 *   - Dogue de Bordeaux (Turkish TK-04 + référence sectorielle + standard de race à museau court)
 *   - Neapolitan Mastiff (Turkish TK-04 + Oman WY-11)
 *   - Presa Canario / Dogo Canario (référence sectorielle + Oman WY-11)
 *   - Spanish Mastiff (référence sectorielle, source dédiée "museau écrasé" et non une liste de
 *     gabarit générique)
 *
 * BACKFILL Lufthansa/SWISS : pour ne pas créer un trou (une race désormais false globalement,
 * mais que Lufthansa/SWISS continuent réellement de restreindre par leur propre page), les listes
 * déjà créées le 09/08 (rule_lufthansa_snubnosed_own_list, rule_lufthansa_fighting_dog_no_hold,
 * rule_swiss_fighting_dog_no_hold) sont complétées avec le reste de leurs listes officielles,
 * jusqu'ici volontairement tronquées par prudence de sourcing — le recoupement avec le dépôt IATA
 * LH-05 (qui cite exactement les mêmes races) relève cette fois la confiance au niveau requis.
 * SWISS "museau écrasé" complété avec Bull Terrier (« certain Bull Terriers » sur sa page, comme
 * Lufthansa qui exclut nommément le Bull Terrier Miniature). American Bully n'est PAS ajouté à la
 * liste SWISS « museau écrasé » : sa propre page le classe en race dangereuse, pas museau écrasé —
 * traité dans le bon panier (fighting dog, soute refusée, fret en caisse renforcée) à la place.
 *
 * NON traité ici, volontairement — mesuré mais pas implémenté (nouvelles compagnies, pas
 * correction d'un drapeau existant) : Air France (AF-01, IATA) restreint museau écrasé sur
 * American Bully/Bouledogue anglais/Bouledogue français/Boston Terrier/Carlin — Austrian Airlines
 * (OS-03/04) et Turkish Airlines ont chacune leur propre liste complète dans le dépôt IATA. Ce
 * sont des compagnies entières sans AUCUNE règle de race à ce jour dans le référentiel ; les
 * ajouter est un chantier séparé (à trancher avec l'utilisateur), pas une correction de ce script.
 *
 * Idempotent : relancer sans rien avoir changé ne modifie rien.
 *   node packages/knowledge/scripts/fix-brachycephalic-list-09-08.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES_PATH = resolve(HERE, "../raw/rules.json");
const OBJECTS_PATH = resolve(HERE, "../raw/objects.json");
const dry = process.argv.includes("--dry");
const TODAY = "2026-08-09";
const REVIEWER = "MyDogCanFly Data Team";
const plus = (iso, d) => { const x = new Date(iso + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const REVIEW_DUE_AIRLINE = plus(TODAY, 90);

let rules = JSON.parse(readFileSync(RULES_PATH, "utf8"));
let objects = JSON.parse(readFileSync(OBJECTS_PATH, "utf8"));
let changed = [];

// ---- 1. Drapeau global brachycephalic : 8 corrections ----
const TO_FALSE = [
  "breed_american_bulldog", "breed_american_pit_bull_terrier", "breed_american_bully_xl",
  "breed_boerboel", "breed_fila_brasileiro", "breed_mastiff_english_mastiff",
  "breed_olde_english_bulldogge", "breed_ca_de_bou_majorca_mastiff",
];
for (const id of TO_FALSE) {
  const b = objects.breeds.find((x) => x.id === id);
  if (b && b.brachycephalic === true) {
    b.brachycephalic = false;
    changed.push(`${id} : brachycephalic true → false`);
  }
}

// ---- 2. Backfill Lufthansa / SWISS pour ne pas perdre la restriction réelle de ces compagnies ----
function extendBreedList(ruleId, addIds) {
  const r = rules.find((x) => x.id === ruleId);
  if (!r) { console.error(`ATTENTION : ${ruleId} introuvable — script précédent appliqué ?`); return; }
  const cond = r.applies_when.all.find((c) => c.fact === "dog.breed_id");
  const missing = addIds.filter((id) => !cond.value.includes(id));
  if (!missing.length) return;
  cond.value.push(...missing);
  r.source = {
    ...r.source, verified_date: TODAY, review_due: REVIEW_DUE_AIRLINE,
    history: [...(r.source.history ?? []), {
      date: TODAY, reviewer: REVIEWER,
      note: `Complété suite au nettoyage du drapeau brachycéphale global (${missing.join(", ")}) : recoupé avec le dépôt IATA LAR 52e édition Addendum I, qui cite les mêmes races pour cette compagnie.`,
    }],
  };
  changed.push(`${ruleId} : ${missing.join(", ")} ajouté(s)`);
}

extendBreedList("rule_lufthansa_snubnosed_own_list", [
  "breed_american_pit_bull_terrier", "breed_american_staffordshire_terrier", "breed_american_bully_xl", "breed_bull_terrier",
]);
extendBreedList("rule_lufthansa_fighting_dog_no_hold", [
  "breed_american_bulldog", "breed_kangal_anatolian_shepherd", "breed_caucasian_shepherd", "breed_rottweiler",
]);
extendBreedList("rule_swiss_fighting_dog_no_hold", [
  "breed_american_bulldog", "breed_american_bully_xl", "breed_kangal_anatolian_shepherd", "breed_caucasian_shepherd", "breed_rottweiler",
]);
extendBreedList("rule_swiss_snubnosed_own_list", ["breed_bull_terrier"]);

console.log(changed.length ? changed.join("\n") : "(aucun changement)");
console.log(`${dry ? "[--dry] " : ""}${changed.length} correction(s).`);
if (!dry && changed.length) {
  writeFileSync(RULES_PATH, JSON.stringify(rules, null, 2) + "\n");
  writeFileSync(OBJECTS_PATH, JSON.stringify(objects, null, 2) + "\n");
}
