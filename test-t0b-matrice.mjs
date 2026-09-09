#!/usr/bin/env node
/* Contre-épreuve T0-B — vérifie le bloc STOCKÉ autant que le YAML relu (contre-revue v5 :
 * un bloc falsifié dans la matrice, une ligne supprimée ou dupliquée passaient inaperçus).
 *   node t0b-verifie-empreintes.mjs <racine-du-depot> <t0b-matrice-74-v5.json>
 * Par ligne : hash(YAML relu) === fingerprint === hash(obs.block) ET canon(obs.block) ===
 * canon(YAML relu). Globalement : 74 lignes exactement, unicité (airline_id, placement),
 * BIJECTION avec les 74 politiques conditional:true d'objects.json, locator ^channels\[\d+\]$,
 * algorithme/champs constants, chemin de fiche cohérent avec airline_id. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
const [repoArg, matrixPath] = process.argv.slice(2);
const repo = resolve(repoArg);
const YAML = createRequire(join(repo, "package.json"))("yaml");
const ALGO = "sha256-canonical-json-v1";
const FIELDS = ["name", "statusLabel", "detail", "fee", "value", "cls"];
const canon = (v) => Array.isArray(v) ? v.map(canon)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
  : v;
const cjson = (v) => JSON.stringify(canon(v));
const hash = (v) => createHash("sha256").update(Buffer.from(cjson(v), "utf8")).digest("hex");
let bad = 0;
const err = (m) => { bad++; console.log("  ÉCART " + m); };
const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
const rows = matrix.rows;
if (rows.length !== 74) err(`nombre de lignes: ${rows.length} ≠ 74`);
const ids = rows.map((r) => `${r.identity.airline_id}|${r.identity.placement}`);
if (new Set(ids).size !== rows.length) err("doublon (airline_id, placement)");
/* ---- Bijection : le manifeste a-t-il été CONSOMMÉ, exactement ? (T0-B2) --------------------
 *
 * Jusqu'à la migration, la cible était l'ensemble des 74 `conditional: true` d'objects.json : le
 * vérificateur gardait l'état AVANT et refusait de migrer une donnée qui n'était plus celle qui
 * avait été auditée. Cette cible a disparu avec la migration — c'était son but.
 *
 * La cible devient ce que le cadrage exige ensuite : « entrée du manifeste non consommée ou
 * couple supplémentaire → échec ». Chaque ligne doit avoir produit sa décision, à sa valeur, et
 * aucune politique migrée ne doit exister hors du manifeste — à l'exception des dix anciens
 * POLICY_STALE, versés en `legacy_unreviewed` par décision de contre-revue et scellés ici par
 * IDENTITÉ, jamais par cardinal.
 *
 * Le cœur cryptographique, lui, est INCHANGÉ : les empreintes portent sur `name`, `statusLabel`,
 * `detail`, `fee`, `value`, `cls` — la migration n'a fait qu'AJOUTER `placement` aux canaux, sans
 * toucher un seul de ces champs. Les 74 empreintes se revérifient donc à l'identique sur les
 * fiches migrées, ce qui prouve qu'aucun bloc audité n'a bougé pendant la migration. */
const objects = JSON.parse(readFileSync(join(repo, "packages/knowledge/raw/objects.json"), "utf8"));
const STALE_VERSES = new Set([
  "airline_asiana|cargo", "airline_condor|cargo", "airline_eva_air|cargo",
  "airline_french_bee|cargo", "airline_korean_air|cargo", "airline_malaysia_airlines|cargo",
  "airline_norwegian|cargo", "airline_qantas|cargo", "airline_qantas|hold",
  "airline_virgin_australia|hold",
]);
/* Décisions POST-MIGRATION arbitrées, scellées par IDENTITÉ — jamais par cardinal.
 *
 * Le manifeste fige la MIGRATION T0-B2 ; il ne gèle pas l'éditorial pour toujours. Mais toute
 * bascule ultérieure vers une forme migrée (`case_by_case`, `undocumented`, `review_state`)
 * doit être NOMMÉE ici avec sa décision, sinon elle rougit — c'est la même discipline que les
 * dix POLICY_STALE ci-dessus.
 *
 *  · airline_virgin_australia|cabin (28/08/2026, arbitrage propriétaire + Codex, option
 *    A-bis) : « offered » → « case_by_case ». « Pets in Cabin » existe (≤ 8 kg animal + sac)
 *    mais seulement sur routes/dates domestiques éligibles, service encadré comme une
 *    expérimentation — ni refus absolu (la règle no_cabin est supprimée), ni oui universel.
 *    Contre-épreuves : test-virgin-australia-cabine.mjs.
 *  · airline_garuda_indonesia|cabin (28/08/2026, 2e passe de contre-revue Codex) :
 *    « not_offered » → « review_state: legacy_unreviewed ». La lecture directe n'a trouvé
 *    aucune page passager officielle lisible établissant l'interdiction cabine — la page
 *    Cargo ne la prouve pas. « Refusé » affirmait un fait non prouvé : la décision rejoint
 *    l'héritage non re-vérifié, comme la soute et le fret de la même fiche.
 *    Contre-épreuves : test-fiches-affirmations-retirees.mjs. */
const DECISIONS_POST_MIGRATION = new Set([
  "airline_virgin_australia|cabin",
  "airline_garuda_indonesia|cabin",
]);
/* LIGNES DU MANIFESTE RÉACTIVÉES SUR CITATION (08/09/2026, import strict, lots 2 et 3).
 *
 * Trois lignes versées en `legacy_unreviewed` par la migration ont reçu une phrase officielle
 * lue directement (Codex, 08/09/2026) : Cathay Pacific fret (« Your pet will need to travel in
 * cargo. »), Air India fret (« … must be carried as cargo. »), Ethiopian fret (« … must be
 * transported as cargo, following cargo procedures. »). L'importeur a réécrit leur discriminant
 * en `availability: offered` — la SEULE situation où il écrit une disponibilité, et seulement
 * parce que la preuve complète l'accompagne (c'est ce que la frontière prescrit : ne jamais
 * réactiver une valeur sans cette preuve). Elles sont admises ici par IDENTITÉ, et le contrôle
 * exige la preuve : `offered` ET une citation (phrase ≥ 10, langue, localisateur). Sans elle,
 * la ligne rougit à nouveau. L'observation de migration, elle, reste intacte. */
const REACTIVEES_SUR_CITATION = new Set([
  "airline_cathay_pacific|cargo",
  "airline_air_india|cargo",
  "airline_ethiopian|cargo",
  /* Lot 4 (09/09/2026) : Emirates fret (« …pets must be carried either as cargo or as checked
     baggage in the hold. ») et Alaska fret (« Our Pet Connect@ animal travel program… »). Même
     discipline : admises par identité, preuve exigée. */
  "airline_emirates|cargo",
  "airline_alaska|cargo",
  /* Lot 5 (09/09/2026) : Virgin Australia fret (« …take good care of your animal in the cargo
     hold. »), Philippine fret (« …via Cargo ONLY… AVIH »), Air Mauritius fret (« …contact our Air
     Mauritius Cargo Office… »), Garuda fret (« Garuda Indonesia Cargo service is ready… »). */
  "airline_virgin_australia|cargo",
  "airline_philippine|cargo",
  "airline_air_mauritius|cargo",
  "airline_garuda_indonesia|cargo",
  /* Lot 6 (09/09/2026) : South African soute (« …either as cargo, or as checked baggage in the
     hold. ») et fret (« …manifested cargo under an Air Waybill… »), Kenya fret (« Live animals
     shall be consigned as cargo only. »), Gulf Air fret (« All live animals on Gulf Air travel as
     cargo. »), Royal Jordanian cabine (« …only permitted in Economy Class Cabins… »), et Saudia
     cabine — PREMIÈRE réactivation en REFUS cité (« Dogs must be transported in the cargo hold… ») :
     la preuve exigée est la même, la disponibilité réactivée est `not_offered`. */
  "airline_south_african_airways|hold",
  "airline_south_african_airways|cargo",
  "airline_kenya_airways|cargo",
  "airline_gulf_air|cargo",
  "airline_royal_jordanian|cabin",
  "airline_saudia|cabin",
  /* Lot 7 (09/09/2026) : Air Caraïbes fret (« devront voyager par FRET. »), Air Tahiti Nui fret (« …il
     peut certainement être transporté par fret… »), Aircalin fret (« Le transport des animaux
     s'effectue en fret uniquement. »), Corsair fret (« Au-delà de 50 kg, le transport devra
     s'effectuer par le fret. »). */
  "airline_air_caraibes|cargo",
  "airline_air_tahiti_nui|cargo",
  "airline_aircalin|cargo",
  "airline_corsair|cargo",
  /* Lot 8 (09/09/2026) : Bangkok Airways fret (« Special cargo service as Live animals dog, cat (AVI)… »,
     routes INTÉRIEURES — portée nommée), Copa fret (« must be arranged through Copa Cargo »), KM Malta
     fret (« booking your pet in the aircraft hold as Cargo »), SKY express soute (« Dogs and cats
     weighing more than 8 kilograms »), SunExpress soute (« Dogs and cats weighing more than 8 kg »). */
  "airline_bangkok_airways|cargo",
  "airline_copa|cargo",
  "airline_km_malta|cargo",
  "airline_sky_express|hold",
  "airline_sunexpress|hold",
  /* Lot 9 (09/09/2026), clôture : Aerolíneas Argentinas fret (« Aerolineas Cargo ofrece transporte de
     mascotas… »), Air Astana fret (« …исключительно по грузовой авианакладной », portée : destinations où le
     bagage est interdit), Edelweiss fret (« …transported unaccompanied as freight. »), TAROM soute (« …more
     than 8kg can be transported safely in the hold ») et fret (« May be accepted only as cargo. », chiens
     > 40 kg). */
  "airline_aerolineas_argentinas|cargo",
  "airline_air_astana|cargo",
  "airline_edelweiss|cargo",
  "airline_tarom|hold",
  "airline_tarom|cargo",
]);
/* POLICY_STALE RÉACTIVÉS SUR CITATION (09/09/2026, lot 4). Deux des dix anciens POLICY_STALE
 * versés en `legacy_unreviewed` — Qantas soute et Qantas fret — ont reçu une phrase des Conditions
 * of Carriage (§ 8.8), lue directement par Codex. L'importeur a réécrit leur discriminant en
 * `availability: offered` : ils ne sont donc plus « migrés » (plus de `review_state`), et le
 * contrôle « versé non migré » rougirait à tort. Admis ici par IDENTITÉ, et la preuve est exigée
 * exactement comme pour les lignes du manifeste réactivées : `offered` ET une citation complète.
 * Les huit autres POLICY_STALE restent versés, et le contrôle continue de l'exiger. */
const STALE_REACTIVES_SUR_CITATION = new Set([
  "airline_qantas|cargo",
  "airline_qantas|hold",
]);
const citee = (p) => typeof p?.source?.quote === "string" && p.source.quote.length >= 10
  && typeof p.source.quote_language === "string" && p.source.quote_language.length > 0
  && typeof p.source.locator === "string" && p.source.locator.length > 0;
/* Éditions POST-MIGRATION d'un bloc AUDITÉ, nommées avec leur nouvelle empreinte.
 *
 * L'observation de migration reste INTACTE dans la baseline — elle prouve toujours qu'aucun
 * bloc n'a bougé PENDANT la migration. Mais l'éditorial vit : quand une contre-revue impose
 * de corriger un bloc audité, la correction est admise ici par identité, avec l'empreinte du
 * bloc corrigé — le YAML relu doit correspondre soit à l'observation d'origine, soit à
 * l'édition nommée. Toute autre divergence rougit toujours.
 *
 *  · airline_virgin_australia/cargo (28/08/2026, contre-revue Codex) : « les animaux non
 *    éligibles à la cabine VOYAGENT en soute via Cargo » recréait le « soute sinon » refusé
 *    par l'arbitrage A-bis — le détail devient conditionnel (« peuvent éventuellement être
 *    transportés … sous réserve de l'itinéraire, de l'appareil, du partenaire de transport
 *    et de l'acceptation préalable »), dans les quatre langues.
 *  · airline_alaska/cargo (28/08/2026, 2e passe de contre-revue Codex) : « ou de plus de
 *    150 lb » transposait le seuil Pet Connect (fret) au bagage accompagné — le détail dit
 *    désormais que Pet Connect applique SES règles et seuils, sans chiffre, quatre langues.
 *  · airline_garuda_indonesia/hold (id.) : « ≤ 32 kg avec la caisse » n'est prouvé par
 *    aucune source lisible — le détail dit « aucune limite de poids vérifiée ; à confirmer »,
 *    quatre langues.
 *  · airline_garuda_indonesia/cargo (id.) : « au-delà de 32 kg » disparaît pour la même
 *    raison — « animaux plus grands », sans seuil, quatre langues.
 *
 * MICRO-LOT ÉDITORIAL IATA (03/09/2026). Quatre blocs cargo portaient un vocabulaire qui
 * attribue à l'IATA ce qu'elle ne fait pas. La correction est éditoriale, jamais décisionnelle :
 * aucune décision, aucun statut, aucun canal ne bouge — seule la phrase change.
 *  · airline_air_tahiti_nui/cargo, airline_virgin_atlantic/cargo : « IATA crate » / « caisse
 *    IATA » attribuaient le contenant à l'IATA. Le contenant garde son nom, l'attribution part.
 *  · airline_cathay_pacific/cargo : « bookings only through IPATA / IATA-accredited agents »
 *    omettait deux des trois catégories de la page officielle et transformait « freight
 *    forwarder » en « agent ». Les trois catégories sont rétablies telles que la compagnie les
 *    publie — membre IPATA ou ATA, IATA Accredited Freight Forwarder, ou titulaire d'un
 *    certificat de formation IATA LAR valide.
 *  · airline_airbaltic/cargo : « third-party IATA-certified cargo agents » disait qu'une
 *    ENTREPRISE est certifiée par l'IATA. La page dit autre chose : elle recommande des agents
 *    TITULAIRES d'un certificat de formation IATA LAR. L'accréditation d'entreprise et le
 *    certificat de formation d'une personne ne sont pas la même chose.
 *
 * SECONDE PASSE SUR CES DEUX BLOCS (03/09/2026), après contre-revue. La première correction ne
 * s'était pas exécutée : le chemin airBaltic déclaré n'existait pas, et l'exception Cathay passait
 * APRÈS les règles génériques, qui avaient déjà transformé son texte. Les quatre langues sont
 * désormais traitées pour chacune des deux compagnies, et la formulation dit ce que dit la page :
 * Cathay nomme ses TROIS catégories et l'exception de Hong Kong ; airBaltic nomme un certificat de
 * FORMATION, jamais une entreprise certifiée. */
const EDITIONS_POST_MIGRATION = new Map([
  ["airline_virgin_australia/cargo", "4398ecf181f18a61f2c1a0f99d4905f6bb9086c80cfd0a50e99a507c5f566fef"],
  ["airline_alaska/cargo", "faee91262c08431b11bc9e3b8f6dc3739dd4131cf3af0484fa6410ad8ca28c2a"],
  ["airline_garuda_indonesia/hold", "2d72e7da86ada5c91cd319398dde07aa8b5d6669a04f88dda5f1da0662bc6812"],
  ["airline_garuda_indonesia/cargo", "63a75a5b654ce0e1fc3f107d9ad1422840e35ca49920db352e822c291b7c302b"],
  ["airline_air_tahiti_nui/cargo", "2133d076933a63806f16a1373edcf0167e9dfb946680b169fdf49afbc8ea6903"],
  ["airline_airbaltic/cargo", "d63a3bf6f427ce14292050779bf1a417a2e972a7fbf071ea61b41dcc0e2f2a19"],
  ["airline_cathay_pacific/cargo", "03d38ebebe05c9639cb8a560638943964d82a0badaf25be1ca59c4db42d50a60"],
  ["airline_virgin_atlantic/cargo", "5d884e29651651b6d7291de3af9a13401c36615b7b7b84c834d57c4924c6304d"],
]);
/** Décision runtime visée par une ligne du manifeste, sous forme d'auteur. */
const attenduPour = (r) => r.decision.state === "legacy_unreviewed"
  ? { review_state: "legacy_unreviewed" }
  : { availability: r.decision.target_availability };
const migrees = new Set(), formeHeritee = [];
for (const a of objects.airlines) {
  const pol = a.premium?.policy ?? {};
  for (const ch of ["cabin", "hold", "cargo"]) {
    const p = pol[ch]; if (!p) continue;
    if ("allowed" in p || "conditional" in p) formeHeritee.push(`${a.id}|${ch}`);
    if ("review_state" in p || p.availability === "undocumented" || p.availability === "case_by_case") migrees.add(`${a.id}|${ch}`);
  }
}
for (const k of formeHeritee) err(`forme d'auteur héritée réintroduite: ${k}`);
for (const k of migrees) {
  if (ids.includes(k) || STALE_VERSES.has(k) || DECISIONS_POST_MIGRATION.has(k)) continue;
  err(`politique migrée hors manifeste et hors dette scellée: ${k}`);
}
for (const k of STALE_VERSES) {
  if (STALE_REACTIVES_SUR_CITATION.has(k)) {
    const [id, ch] = k.split("|");
    const p = objects.airlines.find((a) => a.id === id)?.premium?.policy?.[ch];
    if (!(p?.availability === "offered" && citee(p))) err(`POLICY_STALE réactivé SANS preuve complète: ${k}`);
    continue;
  }
  if (!migrees.has(k)) err(`POLICY_STALE versé non migré: ${k}`);
}
for (const r of rows) {
  const k = `${r.identity.airline_id}|${r.identity.placement}`;
  const a = objects.airlines.find((x) => x.id === r.identity.airline_id);
  const p = a?.premium?.policy?.[r.identity.placement];
  if (!p) { err(`ligne de manifeste NON consommée (politique absente): ${k}`); continue; }
  if (REACTIVEES_SUR_CITATION.has(k)) {
    /* Une ligne réactivée porte une DÉCISION citée — `offered` ou, depuis le lot 6 (Saudia cabine),
       `not_offered` : un refus cité réactive aussi, jamais sans sa phrase. */
    if (!((p.availability === "offered" || p.availability === "not_offered") && citee(p))) err(`ligne réactivée SANS sa preuve: ${k} → availability=${p.availability}, citée=${citee(p)}`);
    continue;
  }
  const attendu = attenduPour(r);
  const cle = Object.keys(attendu)[0];
  if (p[cle] !== attendu[cle]) err(`ligne de manifeste non consommée à sa valeur: ${k} → ${cle}=${p[cle]} ≠ ${attendu[cle]}`);
}
for (const r of rows) {
  const who = `${r.identity.airline_id}/${r.identity.placement}`;
  const obs = r.yaml_observation;
  if (obs.fingerprint_algorithm !== ALGO) err(`${who}: algorithme ≠ ${ALGO}`);
  if (JSON.stringify(obs.fingerprint_fields) !== JSON.stringify(FIELDS)) err(`${who}: fingerprint_fields inattendus`);
  const m = /^channels\[(\d+)\]$/.exec(obs.locator);
  if (!m) { err(`${who}: locator invalide ${obs.locator}`); continue; }
  const slug = r.identity.airline_id.replace(/^airline_/, "").replace(/_/g, "-");
  if (obs.file !== `content/airlines/${slug}.yml` && obs.file !== `content/airlines/${r.identity.airline_id.replace(/^airline_/, "")}.yml`)
    err(`${who}: chemin de fiche incohérent ${obs.file}`);
  const doc = YAML.parse(readFileSync(join(repo, obs.file), "utf8"));
  const ch = (doc.channels || [])[parseInt(m[1], 10)];
  const fromYaml = {};
  for (const k of FIELDS) if (k in ch) fromYaml[k] = ch[k];
  /* Une édition post-migration NOMMÉE est admise : le YAML relu doit alors porter exactement
     l'empreinte de l'édition — l'observation d'origine, elle, reste vérifiée telle quelle. */
  const edition = EDITIONS_POST_MIGRATION.get(who);
  const yamlAttendu = edition && hash(fromYaml) === edition ? edition : obs.fingerprint;
  if (hash(fromYaml) !== yamlAttendu) err(`${who}: empreinte ≠ YAML relu`);
  if (hash(obs.block) !== obs.fingerprint) err(`${who}: empreinte ≠ bloc STOCKÉ (bloc falsifié ?)`);
  if (yamlAttendu === obs.fingerprint && cjson(obs.block) !== cjson(fromYaml)) err(`${who}: bloc stocké ≠ YAML relu`);
}
console.log(`${rows.length} lignes vérifiées, ${bad} écart(s)`);
process.exit(bad ? 1 : 0);
