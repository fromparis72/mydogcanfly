#!/usr/bin/env node
/**
 * Harnais T0-B1 — le MANIFESTE de migration est un contrat, pas un fichier de travail.
 *
 *   npx tsx test-t0b-manifeste.mjs
 *
 * Ce harnais valide la FORME du manifeste (schéma Zod strict, livré dans
 * `packages/knowledge/src/t0b-migration.ts` pour que l'ingestion T0-B2 s'en serve). La preuve
 * CRYPTOGRAPHIQUE — empreintes recalculées, relecture des fiches YAML, bijection avec les 74
 * `conditional: true` d'`objects.json` — appartient à `test-t0b-matrice.mjs`, livrable approuvé
 * et figé, exécuté à part dans `test:unit`. Les deux sont complémentaires et aucun ne remplace
 * l'autre : un manifeste bien formé peut décrire une donnée qui a bougé, et une empreinte juste
 * peut accompagner une décision incohérente.
 *
 * Le cœur du harnais est la TABLE DE DÉCISION : chaque combinaison (état, disponibilité visée,
 * cause runtime) est testée dans les deux sens — celles qui doivent passer passent, et TOUTES
 * les autres sont refusées à la validation. C'est là que se joue la promesse de T0-B : une
 * décision d'audit ne peut pas être écrite à moitié.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  T0bMigrationManifest, T0bMigrationRow, T0bDecision, T0bAuditSource,
  T0B_MIGRATION_ROW_COUNT, T0B_FINGERPRINT_ALGORITHM, T0B_FINGERPRINT_FIELDS, T0B_AUDIT_HINTS,
} from "./packages/knowledge/src/t0b-migration.ts";
import { reviewDueFrom } from "./packages/knowledge/src/common.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};
const clone = (v) => JSON.parse(JSON.stringify(v));
const MATRICE = "test-baselines/t0b-migration-matrice.json";
const OCTETS = readFileSync(MATRICE);
const brut = JSON.parse(OCTETS.toString("utf8"));

/* ---- SCELLEMENT (contre-revue Codex du 15/08/2026 — faux vert fermé) -------------------------
 *
 * Défaut trouvé et reproduit : déplacer la décision auditée de Thai Cargo vers Aegean Cargo, puis
 * remettre Thai en `legacy_unreviewed`, passait TOUT :
 *   - `test-t0b-matrice.mjs` → 74 lignes, 0 écart, parce que les empreintes SHA-256 scellent les
 *     BLOCS YAML observés, et rien d'autre : les décisions, sources et justifications ne sont pas
 *     couvertes par elles ;
 *   - le schéma Zod → valide, parce qu'un manifeste où Aegean serait audité et Thai non est
 *     parfaitement BIEN FORMÉ. Le schéma dit la forme, jamais l'approbation.
 *
 * Il manquait donc la troisième garde, celle de l'APPROBATION : quelles décisions ont réellement
 * été revues, et sur quelles lignes. Deux verrous complémentaires ci-dessous :
 *   1. l'empreinte du fichier ENTIER — tout octet modifié est vu, décision comprise ;
 *   2. un recensement NOMINATIF des décisions auditées — qui survit même si quelqu'un régénère
 *      le fichier (nouvelle empreinte) au lieu de l'éditer.
 */
const MANIFESTE_SHA256 = "de1b9783aacd1b325546f9117826195b1aad5fecb08b3d15e4959a6412c52893";

/** Les décisions AUDITÉES approuvées, nommément. Ajouter une ligne ici est un acte de revue. */
const DECISIONS_AUDITEES_APPROUVEES = new Map([
  ["airline_thai_airways/cargo", { target_availability: "undocumented", cause_runtime: "policy_unpublished" }],
]);

const cle = (r) => `${r.identity.airline_id}/${r.identity.placement}`;

/**
 * Garde d'APPROBATION : le manifeste porte-t-il exactement les décisions auditées approuvées,
 * sur exactement les lignes approuvées ? Rend la liste des écarts (vide = conforme).
 * Volontairement indépendante des empreintes : elle raisonne sur les décisions, pas sur les octets.
 */
function gardeApprobation(m) {
  const ecarts = [];
  const auditees = new Map(m.rows.filter((r) => r.decision.state === "reviewed").map((r) => [cle(r), r.decision]));
  for (const [k, attendu] of DECISIONS_AUDITEES_APPROUVEES) {
    const d = auditees.get(k);
    if (!d) { ecarts.push(`décision auditée ABSENTE de sa ligne approuvée : ${k}`); continue; }
    if (d.target_availability !== attendu.target_availability) {
      ecarts.push(`${k} : disponibilité visée « ${d.target_availability} » ≠ « ${attendu.target_availability} » approuvée`);
    }
    if (d.cause_runtime !== attendu.cause_runtime) {
      ecarts.push(`${k} : cause « ${d.cause_runtime} » ≠ « ${attendu.cause_runtime} » approuvée`);
    }
  }
  for (const k of auditees.keys()) {
    if (!DECISIONS_AUDITEES_APPROUVEES.has(k)) ecarts.push(`décision auditée NON APPROUVÉE sur ${k}`);
  }
  /* Le sens inverse : une ligne approuvée rétrogradée en `legacy_unreviewed` effacerait un audit
     réel — c'est le second temps exact de la manipulation trouvée en contre-revue. */
  for (const r of m.rows) {
    if (r.decision.state !== "reviewed" && DECISIONS_AUDITEES_APPROUVEES.has(cle(r))) {
      ecarts.push(`${cle(r)} : décision approuvée RÉTROGRADÉE en « ${r.decision.state} »`);
    }
  }
  return ecarts;
}

/** Accepte / refuse, sans jamais lever : `.safeParse` sur le schéma demandé. */
const accepte = (schema, v) => schema.safeParse(v).success;
const refuse = (schema, v) => !schema.safeParse(v).success;

console.log("=== 1. Le manifeste APPROUVÉ est accepté tel quel ===");
{
  const r = T0bMigrationManifest.safeParse(brut);
  check(`les ${T0B_MIGRATION_ROW_COUNT} lignes approuvées passent le schéma strict`, r.success,
    r.success ? "" : JSON.stringify(r.error.issues.slice(0, 3), null, 1));
  check("constantes d'empreinte : algorithme canonique", T0B_FINGERPRINT_ALGORITHM === "sha256-canonical-json-v1");
  check("constantes d'empreinte : 6 champs, dans l'ordre du contrat",
    JSON.stringify(T0B_FINGERPRINT_FIELDS) === JSON.stringify(["name", "statusLabel", "detail", "fee", "value", "cls"]));
  check("registre d'indices d'audit FERMÉ à 14 valeurs", T0B_AUDIT_HINTS.length === 14, T0B_AUDIT_HINTS.join(","));
  check("chaque indice employé par le manifeste appartient au registre",
    brut.rows.every((r2) => r2.audit_hints.every((h) => T0B_AUDIT_HINTS.includes(h))));
  /* La seule ligne auditée à ce jour : Thai Cargo — NOMMÉMENT, pas « une ligne quelque part ». */
  const auditees = brut.rows.filter((r2) => r2.decision.state === "reviewed");
  check("exactement 1 ligne auditée dans le manifeste approuvé", auditees.length === 1,
    auditees.map(cle).join(","));
  check("cette ligne est NOMMÉMENT airline_thai_airways/cargo", auditees[0] && cle(auditees[0]) === "airline_thai_airways/cargo",
    auditees[0] ? cle(auditees[0]) : "(aucune)");
  check("elle vise `undocumented` avec la cause `policy_unpublished`",
    auditees[0]?.decision.target_availability === "undocumented"
      && auditees[0]?.decision.cause_runtime === "policy_unpublished");
  check("sa source porte une citation verbatim et respecte la cadence airline (90 j)",
    !!auditees[0]?.decision.source?.quote
      && auditees[0].decision.source.review_due === reviewDueFrom(auditees[0].decision.source.verified_date, "airline"));
  /* Les 73 autres lignes sont non auditées — aucune décision fantôme ne s'est glissée ailleurs. */
  const nonAuditees = brut.rows.filter((r2) => r2.decision.state === "legacy_unreviewed");
  check("les 73 autres lignes sont non auditées, cause `legacy_unreviewed`",
    nonAuditees.length === 73 && nonAuditees.every((r2) => r2.decision.cause_runtime === "legacy_unreviewed"),
    String(nonAuditees.length));
}

console.log("=== 1 bis. SCELLEMENT : empreinte du fichier ENTIER + approbation nominative ===");
{
  /* Verrou 1 — l'octet. Couvre tout ce que les empreintes de bloc ne couvrent pas : décisions,
     disponibilités visées, causes, justifications, citations, URL, dates de revue. */
  const empreinte = createHash("sha256").update(OCTETS).digest("hex");
  check(`empreinte SHA-256 du manifeste = ${MANIFESTE_SHA256.slice(0, 12)}…`, empreinte === MANIFESTE_SHA256, empreinte);

  /* Verrou 2 — l'approbation. Survit à une régénération du fichier, que l'empreinte ne verrait
     que comme « un autre fichier » sans savoir dire ce qui a changé de main. */
  const ecarts = gardeApprobation(brut);
  check("garde d'approbation : les décisions auditées sont sur leurs lignes approuvées, et nulle part ailleurs",
    ecarts.length === 0, ecarts.join(" | "));
}

console.log("=== 1 ter. CONTRE-ÉPREUVE : la manipulation trouvée en contre-revue échoue MAINTENANT ===");
{
  /* Reproduction exacte du faux vert : on ÉCHANGE les décisions de Thai Cargo et d'Aegean Cargo.
     Les blocs YAML observés et leurs empreintes ne bougent pas d'un octet — seules les décisions
     changent de main. C'est précisément ce que ni le vérificateur approuvé ni le schéma ne
     peuvent voir, et c'est ce que la garde d'approbation doit voir. */
  const falsifie = clone(brut);
  const iThai = falsifie.rows.findIndex((r) => cle(r) === "airline_thai_airways/cargo");
  const iAegean = falsifie.rows.findIndex((r) => cle(r) === "airline_aegean/cargo");
  check("les deux lignes de la manipulation existent bien dans le manifeste", iThai >= 0 && iAegean >= 0,
    JSON.stringify({ iThai, iAegean }));
  const dThai = falsifie.rows[iThai].decision;
  falsifie.rows[iThai].decision = falsifie.rows[iAegean].decision;
  falsifie.rows[iAegean].decision = dThai;

  /* a) Le schéma reste satisfait — un manifeste où Aegean serait audité est BIEN FORMÉ. Ce n'est
        pas un défaut du schéma : c'est la preuve qu'il ne parle pas d'approbation. */
  check("le schéma Zod accepte toujours le manifeste falsifié (il dit la forme, pas l'approbation)",
    accepte(T0bMigrationManifest, falsifie));

  /* b) Le vérificateur, exécuté pour de vrai sur le manifeste falsifié.
   *
   * En T0-B1 il disait encore « 74 lignes, 0 écart » : les empreintes scellaient les blocs YAML,
   * pas les décisions — d'où la garde d'approbation du (c), écrite précisément pour couvrir cet
   * angle mort. T0-B2 lui a donné une seconde cible : la CONSOMMATION du manifeste, ligne par
   * ligne, à sa valeur. Échanger deux décisions se voit donc maintenant par les DEUX chemins.
   *
   * Ce que la contre-épreuve démontre est inchangé, et le reste : l'empreinte seule ne suffit
   * jamais à approuver une décision. Le (c) le prouve toujours sur un manifeste que le schéma
   * accepte — et il reste le seul contrôle qui distingue « auditée » de « approuvée ». */
  const chemin = join(tmpdir(), "t0b-manifeste-falsifie-contre-epreuve.json");
  writeFileSync(chemin, JSON.stringify(falsifie, null, 1));
  let sortie = "";
  try {
    sortie = execFileSync(process.execPath, ["test-t0b-matrice.mjs", ".", chemin], { encoding: "utf8" });
  } catch (e) {
    sortie = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }
  check("les 74 empreintes de blocs YAML restent intactes — la falsification ne les touche pas",
    /74 lignes vérifiées/.test(sortie) && !/empreinte ≠|bloc stocké ≠/.test(sortie),
    sortie.trim().split("\n").slice(-3).join(" / "));
  check("le vérificateur voit désormais l'échange de décisions (consommation du manifeste, T0-B2)",
    /ligne de manifeste non consommée à sa valeur: airline_thai_airways\|cargo/.test(sortie),
    sortie.trim().split("\n").slice(-3).join(" / "));

  /* c) La garde d'approbation, elle, échoue — et elle NOMME les deux mouvements. */
  const ecarts = gardeApprobation(falsifie);
  check("la garde d'approbation ÉCHOUE sur le manifeste falsifié", ecarts.length > 0, ecarts.join(" | "));
  check("elle nomme la décision auditée non approuvée (airline_aegean/cargo)",
    ecarts.some((x) => x.includes("NON APPROUVÉE") && x.includes("airline_aegean/cargo")), ecarts.join(" | "));
  check("elle nomme la décision approuvée rétrogradée (airline_thai_airways/cargo)",
    ecarts.some((x) => x.includes("RÉTROGRADÉE") && x.includes("airline_thai_airways/cargo")), ecarts.join(" | "));

  /* d) Et l'empreinte aurait vu la même chose, par un autre chemin — à condition de comparer du
        COMPARABLE (contre-revue v2 : la première version confrontait un JSON compact à
        l'empreinte du fichier FORMATÉ — deux sérialisations différentes du même objet, donc un
        contrôle qui « passait » même sur le manifeste intact). Ici les deux empreintes viennent
        de la MÊME sérialisation, et le témoin négatif prouve que l'écart mesuré vient bien de la
        falsification, pas du formatage. */
  const empreinteObjet = (v) => createHash("sha256").update(Buffer.from(JSON.stringify(v), "utf8")).digest("hex");
  check("témoin négatif : une copie intacte conserve la même empreinte sémantique",
    empreinteObjet(clone(brut)) === empreinteObjet(brut));
  check("l'échange Thai/Aegean modifie l'empreinte sémantique",
    empreinteObjet(falsifie) !== empreinteObjet(brut));

  /* e) Le second temps de la manipulation, isolé : rétrograder Thai SANS rien promouvoir. */
  const rétrogradé = clone(brut);
  rétrogradé.rows[iThai].decision = {
    state: "legacy_unreviewed", cause_runtime: "legacy_unreviewed", justification: "prétendument non revue",
  };
  check("rétrograder la seule décision auditée, sans rien d'autre → garde en échec",
    gardeApprobation(rétrogradé).some((x) => x.includes("ABSENTE") || x.includes("RÉTROGRADÉE")),
    gardeApprobation(rétrogradé).join(" | "));

  /* f) Altérer la disponibilité visée SUR la bonne ligne : la garde le voit aussi. */
  const dévié = clone(brut);
  dévié.rows[iThai].decision = { ...clone(brut.rows[iThai].decision), target_availability: "case_by_case", cause_runtime: "airline_approval" };
  check("changer la disponibilité visée de la ligne approuvée → garde en échec",
    gardeApprobation(dévié).some((x) => x.includes("disponibilité visée")), gardeApprobation(dévié).join(" | "));
}

/* Une ligne réelle sert de socle à toutes les mutations : on ne teste jamais un objet inventé
   de toutes pièces, mais une ligne VALIDE qu'on abîme d'un seul point à la fois. */
const LIGNE = clone(brut.rows[0]);
const ligne = (mut) => { const r = clone(LIGNE); mut(r); return r; };

console.log("=== 2. Enveloppe : fermée, comptée, algorithme nommé ===");
{
  check("clé inconnue dans l'enveloppe → refusée", refuse(T0bMigrationManifest, { ...brut, note_libre: "x" }));
  check("`audit_hints_note` absente → refusée", refuse(T0bMigrationManifest,
    (() => { const m = clone(brut); delete m.audit_hints_note; return m; })()));
  check(`${T0B_MIGRATION_ROW_COUNT - 1} lignes → refusées (le contrat compte ses lignes)`,
    refuse(T0bMigrationManifest, { ...brut, rows: brut.rows.slice(0, T0B_MIGRATION_ROW_COUNT - 1) }));
  check("une ligne de plus → refusée", refuse(T0bMigrationManifest, { ...brut, rows: [...brut.rows, LIGNE] }));
  check("algorithme d'empreinte étranger → refusé",
    refuse(T0bMigrationManifest, { ...brut, fingerprint_algorithm: "md5-quelque-chose" }));
  /* Doublon (airline_id, placement) : deux décisions contradictoires pour le même canal
     passeraient inaperçues si seul le nombre de lignes était vérifié. */
  const avecDoublon = clone(brut);
  avecDoublon.rows[1] = clone(avecDoublon.rows[0]);
  check("couple (airline_id, placement) dupliqué → refusé", refuse(T0bMigrationManifest, avecDoublon));
}

console.log("=== 3. Ligne, identité, observation : chaque niveau est `.strict()` ===");
{
  check("la ligne de référence est valide", accepte(T0bMigrationRow, LIGNE));
  check("clé inconnue au niveau ligne → refusée", refuse(T0bMigrationRow, ligne((r) => { r.commentaire = "x"; })));
  check("clé inconnue dans l'identité → refusée", refuse(T0bMigrationRow, ligne((r) => { r.identity.note = "x"; })));
  check("airline_id sans préfixe → refusé", refuse(T0bMigrationRow, ligne((r) => { r.identity.airline_id = "aegean"; })));
  check("placement inconnu → refusé", refuse(T0bMigrationRow, ligne((r) => { r.identity.placement = "belly"; })));
  check("clé inconnue dans l'observation → refusée", refuse(T0bMigrationRow, ligne((r) => { r.yaml_observation.extrait = "x"; })));
  check("locator par NOM de canal → refusé (l'observation a lu un index)",
    refuse(T0bMigrationRow, ligne((r) => { r.yaml_observation.locator = "channels[cargo]"; })));
  check("chemin de fiche hors content/airlines → refusé",
    refuse(T0bMigrationRow, ligne((r) => { r.yaml_observation.file = "content/autre/aegean.yml"; })));
  check("fiche d'une AUTRE compagnie → refusée (cohérence identité ↔ fichier)",
    refuse(T0bMigrationRow, ligne((r) => { r.yaml_observation.file = "content/airlines/air-france.yml"; })));
  check("empreinte tronquée → refusée", refuse(T0bMigrationRow, ligne((r) => { r.yaml_observation.fingerprint = "abc123"; })));
  check("empreinte en majuscules → refusée (forme canonique unique)",
    refuse(T0bMigrationRow, ligne((r) => { r.yaml_observation.fingerprint = r.yaml_observation.fingerprint.toUpperCase(); })));
  check("algorithme d'empreinte différent sur la ligne → refusé",
    refuse(T0bMigrationRow, ligne((r) => { r.yaml_observation.fingerprint_algorithm = "sha256"; })));
  check("champs d'empreinte DANS LE DÉSORDRE → refusés (l'ordre fait partie de l'algorithme)",
    refuse(T0bMigrationRow, ligne((r) => { r.yaml_observation.fingerprint_fields = ["cls", "name", "statusLabel", "detail", "fee", "value"]; })));
  check("champ d'empreinte manquant → refusé",
    refuse(T0bMigrationRow, ligne((r) => { r.yaml_observation.fingerprint_fields = ["name", "statusLabel", "detail", "fee", "cls"]; })));
  check("clé hors contrat dans le BLOC observé → refusée",
    refuse(T0bMigrationRow, ligne((r) => { r.yaml_observation.block.badge = "warn"; })));
  check("bloc observé VIDE → refusé (une observation sans champ n'observe rien)",
    refuse(T0bMigrationRow, ligne((r) => { r.yaml_observation.block = {}; })));
  check("texte localisé sans anglais → refusé",
    refuse(T0bMigrationRow, ligne((r) => { r.yaml_observation.block.name = { fr: "Fret" }; })));
}

console.log("=== 4. Indices d'audit : registre fermé, sans doublon ===");
{
  check("indice hors registre → refusé", refuse(T0bMigrationRow, ligne((r) => { r.audit_hints = ["condition_de_poids"]; })));
  check("faute de frappe sur un indice réel → refusée", refuse(T0bMigrationRow, ligne((r) => { r.audit_hints = ["weight_conditon"]; })));
  check("indice dupliqué → refusé", refuse(T0bMigrationRow, ligne((r) => { r.audit_hints = ["procedure", "procedure"]; })));
  check("aucun indice → ACCEPTÉ (les indices n'ont jamais été décisionnels)",
    accepte(T0bMigrationRow, ligne((r) => { r.audit_hints = []; })));
}

/* ---- La table de décision, testée dans les deux sens ---------------------------------------- */
const SOURCE_OK = {
  url: "https://www.example-airline.com/pets",
  source_type: "official_website",
  verified_date: "2026-08-13",
  review_due: reviewDueFrom("2026-08-13", "airline"),
  confidence: 4,
  reviewer: "test",
  history: [],
  quote: "Pets are accepted on request only.",
  quote_language: "en",
  locator: "section « Travelling with pets »",
};
const NON_AUDITEE = { state: "legacy_unreviewed", cause_runtime: "legacy_unreviewed", justification: "aucune source officielle relue" };
const auditee = (target_availability, cause_runtime, over = {}) => ({
  state: "reviewed",
  target_availability,
  ...(cause_runtime ? { cause_runtime } : {}),
  justification: "audit du 13/08/2026",
  source: clone(SOURCE_OK),
  ...over,
});

console.log("=== 5. Table de décision — état NON AUDITÉ ===");
{
  check("legacy_unreviewed + cause legacy_unreviewed → ACCEPTÉ", accepte(T0bDecision, NON_AUDITEE));
  check("legacy_unreviewed SANS cause → refusé", refuse(T0bDecision, { state: "legacy_unreviewed", justification: "x" }));
  check("legacy_unreviewed avec une AUTRE cause → refusé",
    refuse(T0bDecision, { ...NON_AUDITEE, cause_runtime: "policy_unpublished" }));
  check("legacy_unreviewed + disponibilité visée → refusé (rien n'a été audité)",
    refuse(T0bDecision, { ...NON_AUDITEE, target_availability: "undocumented" }));
  check("legacy_unreviewed + source → refusé (une source implique un audit)",
    refuse(T0bDecision, { ...NON_AUDITEE, source: clone(SOURCE_OK) }));
  check("legacy_unreviewed sans justification → refusé", refuse(T0bDecision, { state: "legacy_unreviewed", cause_runtime: "legacy_unreviewed" }));
  check("état inventé → refusé", refuse(T0bDecision, { ...NON_AUDITEE, state: "en_cours" }));
}

console.log("=== 6. Table de décision — état AUDITÉ : la disponibilité DÉTERMINE la cause ===");
{
  const attendu = [
    ["offered", null], ["not_offered", null],
    ["case_by_case", "airline_approval"], ["undocumented", "policy_unpublished"],
  ];
  const CAUSES = [null, "airline_approval", "policy_unpublished", "legacy_unreviewed"];
  for (const [dispo, causeAttendue] of attendu) {
    check(`reviewed/${dispo} + ${causeAttendue ?? "aucune cause"} → ACCEPTÉ`, accepte(T0bDecision, auditee(dispo, causeAttendue)));
    for (const c of CAUSES) {
      if (c === causeAttendue) continue;
      check(`reviewed/${dispo} + ${c ?? "aucune cause"} → refusé`, refuse(T0bDecision, auditee(dispo, c)),
        JSON.stringify({ dispo, cause: c }));
    }
  }
  check("reviewed sans disponibilité visée → refusé",
    refuse(T0bDecision, { state: "reviewed", justification: "x", source: clone(SOURCE_OK) }));
  check("disponibilité inventée → refusée", refuse(T0bDecision, auditee("peut_etre", null)));
  check("clé inconnue sur une décision auditée → refusée", refuse(T0bDecision, auditee("offered", null, { note: "x" })));
}

console.log("=== 7. Source d'audit : citation verbatim et cadence EXACTE (90 j) ===");
{
  check("la source de référence est valide", accepte(T0bAuditSource, SOURCE_OK));
  check("reviewed SANS source → refusé", refuse(T0bDecision, { state: "reviewed", target_availability: "offered", justification: "x" }));
  const sans = (k) => { const s = clone(SOURCE_OK); delete s[k]; return s; };
  check("source sans citation → refusée", refuse(T0bAuditSource, sans("quote")));
  check("source sans langue de citation → refusée", refuse(T0bAuditSource, sans("quote_language")));
  check("source sans locator → refusée", refuse(T0bAuditSource, sans("locator")));
  check("citation vide → refusée", refuse(T0bAuditSource, { ...SOURCE_OK, quote: "" }));
  /* La langue de citation est une étiquette BCP-47 VALIDÉE DANS SA FORME, pas une liste fermée
     (une énumération oubliait le grec, et en oublierait d'autres sur 102 compagnies) : une
     étiquette rare passe, une étiquette malformée non. */
  check("langue de citation rare mais bien formée (« el ») → acceptée", accepte(T0bAuditSource, { ...SOURCE_OK, quote_language: "el" }));
  check("langue de citation régionale (« pt-BR ») → acceptée", accepte(T0bAuditSource, { ...SOURCE_OK, quote_language: "pt-BR" }));
  check("langue de citation malformée → refusée", refuse(T0bAuditSource, { ...SOURCE_OK, quote_language: "Anglais !" }));
  /* Spécialisations héritées du modèle de provenance réutilisé : un fait métier ne peut pas
     s'appuyer sur la presse, ni sur nous-mêmes. */
  check("source de presse → refusée (un fait métier exige une source officielle)",
    refuse(T0bAuditSource, { ...SOURCE_OK, source_type: "press" }));
  check("auto-citation d'un domaine MyDogCanFly → refusée",
    refuse(T0bAuditSource, { ...SOURCE_OK, url: "https://www.mydogcanfly.com/airlines/thai" }));
  check("clé inconnue dans la source → refusée", refuse(T0bAuditSource, { ...SOURCE_OK, commentaire: "x" }));
  check("URL non absolue → refusée", refuse(T0bAuditSource, { ...SOURCE_OK, url: "/pets" }));
  /* Le point exact de l'arbitrage : « postérieure » ne suffit pas. Une revue repoussée d'un an
     est une revue qui n'aura pas lieu — la cadence airline est DÉRIVÉE, jamais négociée. */
  check("review_due à J+91 → refusée (cadence airline = 90 j, pas « plus tard »)",
    refuse(T0bAuditSource, { ...SOURCE_OK, review_due: reviewDueFrom("2026-08-14", "airline") }));
  check("review_due à J+89 → refusée", refuse(T0bAuditSource, { ...SOURCE_OK, review_due: reviewDueFrom("2026-08-12", "airline") }));
  check("review_due à J+180 (cadence pays) → refusée",
    refuse(T0bAuditSource, { ...SOURCE_OK, review_due: reviewDueFrom(SOURCE_OK.verified_date, "country") }));
  check("review_due antérieure à verified_date → refusée", refuse(T0bAuditSource, { ...SOURCE_OK, review_due: "2026-08-01" }));
  check("une décision auditée hérite de la cadence (contrôle bout en bout)",
    refuse(T0bDecision, auditee("offered", null, { source: { ...clone(SOURCE_OK), review_due: "2027-08-13" } })));
}

console.log(`\n${pass} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
