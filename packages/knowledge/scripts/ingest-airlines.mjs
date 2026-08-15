// Ingest per-airline pet-policy fiches (YAML, source of truth) into a generated JSON
// that the UI consumes. Validates every fiche against a Zod schema so a typo or a
// missing EN/FR field fails the build instead of shipping.
//
//   npm run ingest          (régénère et écrit)
//   npm run ingest:check    (vérifie, n'écrit rien)
//
// Ces deux commandes passent par `tsx`, et c'est OBLIGATOIRE : ce script importe le contrat de
// provenance auditée `T0bAuditSource` depuis TypeScript, plutôt que d'en recopier un second.
// `node packages/knowledge/scripts/ingest-airlines.mjs` échoue donc — hors npm, utilisez
// `npx tsx packages/knowledge/scripts/ingest-airlines.mjs [--check]`.
//
// Source:  content/airlines/<slug>.yml   (one bilingual fiche per airline)
// Output:  packages/ui/src/data/airlines.generated.json   (Record<airline_id, Fiche>)
//          packages/knowledge/raw/objects.json            (premium.policy dérivée)
//
// ---- Pourquoi `--check` (lot M1, 12/08/2026) --------------------------------
// Ce script n'était appelé NI par le build, NI par la CI — alors qu'`airlines.ts` affirmait
// le contraire. Rien ne garantissait donc que les artefacts versionnés correspondent encore
// aux fiches : il suffisait d'éditer un YAML sans relancer l'ingestion pour que le site et le
// moteur servent une version périmée, sans le moindre signal.
//
// `--check` régénère les deux artefacts EN MÉMOIRE et les compare à ceux du dépôt. Il n'écrit
// jamais : la CI peut donc l'exécuter sur un arbre propre sans le salir, et échoue si un écart
// existe. Le message nomme les compagnies concernées — un diff de 100 000 lignes ne dit rien.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { z } from "zod";
/* LE contrat de provenance auditée, réutilisé tel quel (jamais recopié) : citation verbatim,
   langue BCP-47, URL http(s) hors domaines maison, type de source factuel, cadence de 90 jours
   dérivée et locator obligatoire. C'est ce qui impose d'exécuter ce script sous `tsx`. */
import { T0bAuditSource } from "../src/t0b-migration.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const SRC = join(ROOT, "content", "airlines");
const OUT = join(ROOT, "packages", "ui", "src", "data", "airlines.generated.json");
const OBJECTS = join(ROOT, "packages", "knowledge", "raw", "objects.json");

// Mode d'exécution — verrouillé (Codex, 12/08/2026). `process.argv.includes("--check")` laissait
// passer `--chek` : le script basculait en mode ÉCRITURE et réécrivait les deux artefacts, sans
// le moindre signal. Une faute de frappe dans un job de CI aurait donc silencieusement modifié
// le dépôt au lieu de le vérifier. Deux modes, rien d'autre, et la validation précède toute
// lecture comme toute écriture.
const ARGS = process.argv.slice(2);
if (ARGS.length > 1 || (ARGS.length === 1 && ARGS[0] !== "--check")) {
  console.error(`✖ argument non reconnu : ${ARGS.join(" ")}`);
  console.error("  usage : npm run ingest          (régénère et écrit)");
  console.error("          npm run ingest:check    (vérifie, n'écrit rien)");
  console.error("  hors npm : npx tsx packages/knowledge/scripts/ingest-airlines.mjs [--check]");
  process.exit(2);
}
const CHECK = ARGS[0] === "--check";
const rel = (p) => p.replace(ROOT + "/", "");

/** Écarts relevés en mode --check. Le script ne s'interrompt pas au premier : un rapport
 *  partiel oblige à relancer autant de fois qu'il y a de problèmes. */
const drift = [];

/**
 * Seul point d'écriture du script. En mode `--check`, compare au lieu d'écrire — c'est ce qui
 * garantit que la vérification ne peut pas modifier le dépôt, même par accident : il n'existe
 * pas d'autre chemin vers le disque.
 */
function emit(path, content, describeDiff) {
  if (!CHECK) { writeFileSync(path, content); return; }
  let current;
  try { current = readFileSync(path, "utf8"); }
  catch { drift.push(`${rel(path)} : absent du dépôt — l'artefact n'a jamais été généré`); return; }
  if (current === content) return;
  drift.push(`${rel(path)} : diffère de la régénération${describeDiff ? "\n" + describeDiff(current, content) : ""}`);
}

// ---- Schema (source of truth for the fiche contract) ----------------------
// Zod, en mode « strip » par défaut, efface en silence toute clé non déclarée : une langue
// absente d'ici disparaîtrait des données sans qu'aucune erreur ne le signale (c'est ce qui
// était arrivé à `brachy_allowed`). Toute langue ajoutée doit donc être déclarée ici.
const LT = z.object({
  en: z.string().min(1),
  fr: z.string().min(1),
  es: z.string().min(1).optional(),
  pt: z.string().min(1).optional(),
});
const CLS = z.enum(["ok", "no", "warn", "neutral"]);
const Chip = z.object({ icon: z.string(), label: LT, cls: CLS.optional() });
const Pill = z.object({ cls: CLS, label: LT });
/** Les trois placements, dans leur ordre canonique. La clé du bloc `policies:` EST le placement. */
const PLACEMENTS = ["cabin", "hold", "cargo"];
const Placement = z.enum(PLACEMENTS);

/**
 * Décision d'un placement (T0-B2) — union stricte à discriminant obligatoire, exactement comme
 * le schéma d'auteur du moteur. Un objet qui porterait les deux clés, aucune, ou une valeur
 * inventée n'appartient à aucune branche : il est REFUSÉ à l'ingestion, pas corrigé en silence.
 *
 * `.strict()` sur chaque branche est ce qui rend l'objet hybride inconstructible ; sans lui, Zod
 * effacerait la clé surnuméraire et la fiche passerait en ayant dit deux choses.
 */
/**
 * Provenance AUDITÉE, portée par la fiche elle-même — sous LE contrat approuvé, `T0bAuditSource`.
 *
 * Une décision auditée sans sa preuve n'est pas migrée, elle est recopiée : le manifeste porte
 * pour Thai Cargo l'URL exacte, la date du 13/08/2026, la confiance 4, la citation verbatim et
 * l'emplacement dans la page — mais la fiche ne disait que `availability: undocumented`, et la
 * politique canonique recevait la page d'accueil de la compagnie (contre-revue du 15/08/2026).
 *
 * La première correction définissait ici un schéma PARALLÈLE. C'était l'erreur que le dépôt
 * documente déjà à propos de la provenance — « deux modèles dans le même dépôt, c'est la garantie
 * qu'ils divergeront » — et elle avait un coût immédiat : six garanties contournées (auto-citation
 * interdite, citation d'au moins dix caractères, étiquette BCP-47, URL http(s), types de source
 * factuels, cadence de 90 jours exactement). Une source `https://mydogcanfly.com/fake`, citation
 * « x », langue « not a language », `review_due` en 2030, passait de bout en bout.
 *
 * On réutilise donc le contrat existant, tel quel. C'est aussi pourquoi l'ingestion s'exécute
 * sous `tsx` : le contrat vit en TypeScript, et le recopier en JavaScript recréerait exactement
 * le doublon qu'on vient de supprimer.
 */
const DecisionPlacement = z.union([
  z.object({
    availability: z.enum(["offered", "not_offered", "case_by_case", "undocumented"]),
    source: T0bAuditSource.optional(),
  }).strict(),
  z.object({ review_state: z.literal("legacy_unreviewed") }).strict(),
]);

/**
 * `placement` RELIE le canal visible à sa politique — il ne la décide pas. `name`, `cls`,
 * `statusLabel`, `detail` et `fee` redeviennent ce qu'ils n'auraient jamais dû cesser d'être :
 * de l'éditorial. C'est la fin de `catOf(name.en)`, qui devinait le canal depuis son libellé
 * anglais, et de la traduction `cls` → `allowed`/`conditional`.
 */
/* `.strict()` : un canal porte maintenant le LIEN vers sa décision. Sans lui, Zod effacerait en
   silence toute clé surnuméraire — la famille de défauts que ce dépôt documente depuis
   `brachy_allowed`, `season.month`, `conditional` et `derived_from_fiche`. Sur un objet devenu
   décisionnel par son `placement`, ce silence n'est plus acceptable. */
const Channel = z.object({
  placement: Placement, icon: z.string(), name: LT, cls: CLS, statusLabel: LT, detail: LT, fee: LT,
}).strict();
const LadderSeg = z.object({ flex: z.number(), color: z.string(), label: LT, sub: z.union([z.string(), LT]) });
const Restriction = z.object({ icon: z.string(), title: LT, pills: z.array(Pill), note: LT });
const InfoRow = z.object({ icon: z.string(), label: LT, value: LT });
const FareRow = z.object({ zone: LT, cabin: z.string(), hold: z.string() });
const FareItem = z.object({ label: LT, value: LT });

const Fiche = z.object({
  id: z.string().regex(/^airline_[a-z0-9_]+$/),
  mono: z.string().min(1).max(3),
  name: z.string().min(1),
  titleH1: LT,
  metaDesc: LT,
  chips: z.array(Chip).min(1),
  verdict: Pill,
  verdictNote: LT,
  ladder: z.array(LadderSeg).min(1),
  /**
   * LA source de vérité décisionnelle (T0-B2). Bloc UNIQUE et non éditorial : une décision par
   * placement, la clé portant le placement. Au moins une politique — une fiche qui ne décide de
   * rien n'a rien à dire au moteur.
   *
   * Pourquoi ici et non dans `channels[]` : six politiques n'ont AUCUN canal visible (dette
   * éditoriale scellée en T0-B2). Les loger dans les canaux aurait exigé d'inventer six blocs
   * affichés — un changement éditorial déguisé en migration. Et deux emplacements décisionnels
   * (296 dans `channels`, 6 ailleurs) auraient divergé tôt ou tard.
   */
  policies: z.object({
    cabin: DecisionPlacement.optional(),
    hold: DecisionPlacement.optional(),
    cargo: DecisionPlacement.optional(),
  }).strict().refine((p) => PLACEMENTS.some((m) => p[m] !== undefined), {
    message: "bloc policies vide : une fiche doit décider d'au moins un placement",
  }),
  channels: z.array(Channel).min(1),
  fareGrid: z.object({ headCabin: LT, headHold: LT, rows: z.array(FareRow).min(1), note: LT }).optional(),
  fareList: z.object({ rows: z.array(FareItem).min(1), note: LT }).optional(),
  restrictions: z.array(Restriction),
  // Pays où la compagnie ne transporte AUCUN animal, en code ISO 3166-1 alpha-2 majuscule.
  //
  // Le bloc « Où <compagnie> vole avec les chiens » se construisait sur le réseau commercial
  // (`serves_country_ids`), qui ignore la politique animaux : la fiche Volotea affichait Malte
  // et le Royaume-Uni dans ses destinations tout en disant deux lignes plus haut qu'elle n'y
  // transporte pas d'animaux. Le lecteur voyait la contradiction, pas la règle.
  //
  // Le réseau reste la source du réseau ; cette clé dit seulement où la politique animaux se
  // ferme, et seulement quand la compagnie l'a écrit. Une fiche sans la clé se comporte comme
  // avant — on ne déduit jamais une fermeture d'un silence.
  noPetCountries: z.array(z.string().regex(/^[A-Z]{2}$/)).optional(),
  crate: z.array(LT).optional(),
  temperature: z.object({ pills: z.array(Pill), note: LT }),
  assistance: z.array(InfoRow).min(1),
  goodToKnow: z.array(InfoRow).min(1),
  book: z.object({ host: z.string().min(1), url: z.string().url() }),
  sources: LT,
  verified_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "verified_date must be YYYY-MM-DD"),
}).strict().superRefine((fiche, ctx) => {
  /* ---- Les trois liens que la structure doit garantir (T0-B2, contre-épreuves du cadrage) ----
   *
   * Sans eux, `policies:` et `channels:` pourraient dériver l'un de l'autre en silence : un canal
   * rattaché à un placement dont aucune politique ne parle, deux canaux revendiquant le même
   * placement, ou une politique orpheline apparue au fil de l'eau. */
  const vus = new Map();
  fiche.channels.forEach((c, i) => {
    if (vus.has(c.placement)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom, path: ["channels", i, "placement"],
        message: `placement ${c.placement} déjà porté par channels[${vus.get(c.placement)}] — un placement, un canal visible`,
      });
    } else vus.set(c.placement, i);
    if (fiche.policies[c.placement] === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom, path: ["channels", i, "placement"],
        message: `channels[${i}] pointe le placement ${c.placement}, dont policies: ne décide pas`,
      });
    }
  });
  /* Une politique SANS canal visible n'est pas interdite — six existent, scellées — mais elle
     doit figurer dans la dette, sinon une politique invisible pourrait naître sans revue. */
  for (const m of PLACEMENTS) {
    if (fiche.policies[m] === undefined || vus.has(m)) continue;
    if (!POLITIQUES_SANS_CANAL_VISIBLE.includes(`${fiche.id}.${m}`)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom, path: ["policies", m],
        message: `politique ${m} sans canal visible et hors de la dette scellée (${POLITIQUES_SANS_CANAL_VISIBLE.length} entrées)`,
      });
    }
  }
});

/**
 * Dette ÉDITORIALE scellée (T0-B2) — les six placements décidés par une fiche qu'aucun canal
 * visible ne décrit. Elle remplace les dix `POLICY_STALE` du lot M1 : ceux-ci étaient une dette
 * DÉCISIONNELLE (une politique que l'ingestion ne savait plus rattacher à sa fiche, donc que
 * personne ne régénérait), et l'option C la referme — les 302 décisions viennent désormais des
 * fiches. Ce qui subsiste est d'une autre nature, et bien plus faible : ces six placements
 * décident, ils ne sont simplement pas racontés au lecteur.
 *
 * Scellée par IDENTITÉ, jamais par cardinal : à effectif constant, une dette résorbée et une
 * dette neuve doivent échouer, pas s'annuler.
 */
const POLITIQUES_SANS_CANAL_VISIBLE = [
  "airline_asiana.cargo", "airline_condor.cargo", "airline_eva_air.cargo",
  "airline_norwegian.cargo", "airline_qantas.hold", "airline_virgin_australia.hold",
];

// ---- Ingest ---------------------------------------------------------------
const files = readdirSync(SRC)
  .filter((f) => (f.endsWith(".yml") || f.endsWith(".yaml")) && !f.startsWith("_") && !f.startsWith("."))
  .sort();
const out = {};
const errors = [];

for (const file of files) {
  const raw = YAML.parse(readFileSync(join(SRC, file), "utf8"));
  const res = Fiche.safeParse(raw);
  if (!res.success) {
    errors.push(`${file}: ${res.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; ")}`);
    continue;
  }
  const fiche = res.data;
  if (out[fiche.id]) errors.push(`${file}: duplicate id ${fiche.id}`);
  out[fiche.id] = fiche;
}

if (errors.length) {
  console.error(`✖ airline fiche validation failed (${errors.length}):`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));

/** Quelles compagnies diffèrent, plutôt qu'un diff illisible de plusieurs milliers de lignes. */
const namedDiff = (before, after) => {
  let a, b;
  try { a = JSON.parse(before); b = JSON.parse(after); } catch { return "         (artefact illisible)"; }
  const ids = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  const changed = ids.filter((id) => JSON.stringify(a[id]) !== JSON.stringify(b[id]));
  const label = (id) => (!(id in a) ? `${id} (absent du dépôt)` : !(id in b) ? `${id} (retirée)` : id);
  return `         ${changed.length} entrée(s) : ${changed.slice(0, 12).map(label).join(", ")}` +
    (changed.length > 12 ? `, … et ${changed.length - 12} autre(s)` : "");
};

emit(OUT, JSON.stringify(sorted, null, 2) + "\n", namedDiff);
console.log(
  CHECK
    ? `• ${Object.keys(sorted).length} fiches valides ; ${rel(OUT)} vérifié`
    : `✓ ingested ${Object.keys(sorted).length} airline fiches → ${rel(OUT)}`,
);

// ---- Derive a STRUCTURED policy from each fiche and propagate it to the KB -------------------
// Single source of truth: the verified fiche fields (channels = allowed status per mode, fareList =
// cabin weight, restrictions = snub-nosed hold ban). The crate calculator + finder read the KB, so we
// inject the derived policy into raw/objects.json. Existing hand-authored policy (richer, with cabin
// dimensions) is preserved — the derivation only fills gaps. A missing signal stays "unknown" (omitted),
// never a fabricated refusal.
const kgOf = (s) => { const m = (s || "").match(/(?:≤|<=|up to|jusqu'?à)?\s*(\d{1,3})\s*kg/i); return m ? parseInt(m[1], 10) : null; };

/**
 * T0-B2 — LA décision vient du bloc `policies:`, et de lui seul.
 *
 * Ce que cette fonction ne fait plus, et qui était le vrai sujet du lot :
 *  - `catOf(name.en)` a disparu. Deviner le canal depuis son libellé anglais laissait quatre
 *    canaux non reconnus (« Freight », « Specialized-LIVE », « MASkargo Animal Hotel »,
 *    « Qantas Freight ») dont la politique survivait sans lien vivant avec sa fiche. Un simple
 *    renommage éditorial suffisait à détacher un canal de sa décision, sans le moindre signal.
 *  - la traduction `cls` → `allowed`/`conditional` a disparu. Une classe VISUELLE ne décide plus
 *    d'un verdict : `warn` valait `allowed:true` + `conditional:true`, et `conditional` était
 *    ensuite effacé par Zod — 74 politiques portaient donc une nuance que personne ne lisait.
 *
 * Ce qu'elle continue de faire : dériver les ENRICHISSEMENTS que la fiche modélise (poids maximal
 * en cabine, refus brachycéphale en soute). Ce sont des faits, pas des décisions ; ils traversent
 * la projection sans rien arbitrer.
 */
function derivePolicy(fiche) {
  const p = {};
  for (const mode of PLACEMENTS) {
    const decision = fiche.policies[mode];
    if (decision === undefined) continue;      // la fiche ne décide pas ce placement → il n'existe pas
    /* `availability` XOR `review_state`, garanti par le schéma. `source` est extraite à part :
       c'est une PREUVE, pas un discriminant — elle est réinjectée à l'écriture de la politique. */
    const { source: sourceAuditee, ...discriminant } = decision;
    p[mode] = { ...discriminant };
    if (sourceAuditee) Object.defineProperty(p[mode], "__source_auditee", { value: sourceAuditee, enumerable: false });
  }
  /* Poids maximal en cabine : le seul maximum non ambigu que la fiche exprime. Le rattachement
     passe désormais par le placement du canal, plus par le libellé de la ligne tarifaire. */
  if (p.cabin) {
    for (const r of (fiche.fareList?.rows || [])) {
      if (!/cabin|cabine/i.test(r.label?.en || "")) continue;
      const kg = kgOf(r.label?.en) ?? kgOf(r.value?.en);
      if (kg && p.cabin.max_weight_kg == null) p.cabin.max_weight_kg = kg;
    }
  }
  /* Refus brachycéphale en soute. Inchangé, y compris son angle mort connu : si la fiche ne
     décide pas la soute, le fait n'a nulle part où aller — il est consigné dans `__dropped`,
     que `--check` nomme (POLICY_GAP). */
  const dropped = [];
  for (const r of (fiche.restrictions || [])) {
    if (!/flat-faced|brachy|snub|nose|nez|museau/i.test(r.title?.en || "")) continue;
    for (const pill of (r.pills || [])) {
      if (pill.cls !== "no" || !/hold|soute|cargo/i.test(pill.label?.en || "")) continue;
      if (p.hold) p.hold.brachy_allowed = false;
      else dropped.push(["hold", "brachy_allowed", false]);
    }
  }
  Object.defineProperty(p, "__dropped", { value: dropped, enumerable: false });
  return p;
}

const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const objects = JSON.parse(readFileSync(OBJECTS, "utf8"));
let patched = 0, filledModes = 0;
/**
 * Canaux écrits à la main que l'ingestion préserve, et dont une valeur contredit sa fiche.
 *
 * `conditional` est délibérément HORS de cette liste : il est absent du schéma `PlacementPolicy`
 * et Zod l'efface à la normalisation, donc il n'atteint jamais le moteur. Le comparer ferait
 * rougir la CI sur un champ sans effet, et masquerait les trois qui décident vraiment. Le rendre
 * effectif est un sujet de M3, pas de M1.
 */
const COMPARED_FIELDS = ["max_weight_kg", "brachy_allowed"];

/** Les deux discriminants d'auteur, et l'ancien booléen tant qu'il subsiste dans l'artefact. */
const DISCRIMINANTS = ["availability", "review_state"];
const estDecidee = (pol) => pol !== undefined && (DISCRIMINANTS.some((d) => d in pol) || pol.allowed !== undefined);
const handAuthoredConflicts = [];   // POLICY_DRIFT — les deux côtés parlent et se contredisent
const policyGaps = [];              // POLICY_GAP   — la fiche affirme, le moteur ne reçoit rien
const provenanceCuratee = [];       // PROVENANCE_CURATED — provenance plus précise que la dérivée
const politiquesRetirees = [];      // POLICY_REMOVED — la fiche ne décide plus ce placement

/**
 * Ensemble APPROUVÉ des identités de politiques, versionné à part et comparé à ce que les FICHES
 * décident — jamais à `objects.json`.
 *
 * La première version comparait l'artefact d'avant à celui d'après. Elle voyait bien une
 * suppression, mais une seule fois : après régénération, `objects.json` ne contenait plus la
 * politique, `--check` ne voyait donc plus rien, et la preuve disparaissait avec l'artefact
 * (contre-revue du 15/08/2026). Une liste d'exceptions ne pouvait pas non plus tenir : une clé
 * qui y figure devient, au contrôle suivant, une « suppression attendue disparue ».
 *
 * La référence est donc EXTÉRIEURE aux artefacts et durable. Apparition, disparition, ou
 * substitution à cardinal constant : les trois échouent tant que ce fichier n'a pas été modifié
 * explicitement — ce qui passe par une revue, pas par un commit.
 */
const IDENTITES_APPROUVEES = JSON.parse(
  readFileSync(join(ROOT, "test-baselines", "t0b2-policy-identities.json"), "utf8"),
).identities;

/**
 * PROVENANCE_CURATED — provenances plus précises que ce que la dérivation sait produire, sur des
 * politiques par ailleurs dérivées. L'ENSEMBLE EXACT, comme les GAP.
 *
 * D'où elles viennent : ce sont les dix anciens `POLICY_STALE`. Leur canal n'étant plus rattaché
 * à sa fiche, l'ingestion ne les réécrivait plus — et quelqu'un a, entre-temps, précisé leur
 * source (URL de fret dédiée, confiance 4) sans que le drapeau `derived_from_fiche` cesse
 * d'affirmer le contraire. T0-B2 les rend de nouveau dérivables : sans ce garde-fou, la
 * régénération remplacerait `https://asianacargo.com/contents/lifeAnimalsAviGuide.do` par
 * `https://flyasiana.com` et abaisserait la confiance de 4 à 3 — une PERTE de provenance, que le
 * cadrage interdit au même titre qu'une perte de poids ou de conditions.
 *
 * La provenance stockée est donc PRÉSERVÉE, et l'écart est NOMMÉ : jamais un silence. Le contrôle
 * porte sur l'ensemble des clés, jamais sur le cardinal — à effectif constant, une provenance
 * réalignée et une autre divergente doivent échouer, pas s'annuler.
 *
 * Ce n'est pas une dette éternelle : réconcilier ces dix provenances (ou remonter l'URL de fret
 * dans la fiche) les fera disparaître de cette liste, ce qui est le geste attendu — hors T0-B2,
 * dont le périmètre exclut tout audit de source.
 */
const KNOWN_PROVENANCE_CURATED = [
  "airline_asiana.cargo",
  "airline_condor.cargo",
  "airline_eva_air.cargo",
  "airline_french_bee.cargo",
  "airline_korean_air.cargo",
  "airline_malaysia_airlines.cargo",
  "airline_norwegian.cargo",
  "airline_qantas.cargo",
  "airline_qantas.hold",
  "airline_virgin_australia.hold",
];
/**
 * T0-B2 — les dix `POLICY_STALE` du lot M1 n'existent plus, et leur CAUSE est refermée.
 *
 * Ils naissaient d'un mécanisme : la dérivation devinait le canal depuis `name.en`, et une
 * politique dont le libellé n'était plus reconnu — ou dont le canal avait disparu de la fiche —
 * survivait dans l'artefact sans que personne ne la régénère. La fiche ne pouvait plus la
 * corriger ; seule une édition manuelle d'`objects.json` l'aurait pu.
 *
 * Le bloc `policies:` supprime le mécanisme : les 302 décisions viennent des fiches, par leur
 * PLACEMENT, jamais par un libellé. Une politique non reproductible depuis sa fiche est devenue
 * inconstructible — le schéma refuse une politique orpheline, et refuse un canal qui pointerait
 * un placement dont `policies:` ne parle pas.
 *
 * Ce qui subsiste est d'une autre nature, bien plus faible, et scellé ailleurs
 * (`POLITIQUES_SANS_CANAL_VISIBLE`) : six placements décident sans qu'aucun canal visible ne les
 * raconte au lecteur. C'est une dette ÉDITORIALE, pas décisionnelle.
 */

/** POLICY_GAP connus et acceptés à ce jour (lot M1, 12/08/2026) — L'ENSEMBLE EXACT, pas le compte.
 *
 *  Mécanisme emprunté au `xfail`/`XPASS` retenu pour M2 : un défaut connu ne fait pas rougir la
 *  CI — sinon `main` naît rouge — mais sa DISPARITION doit être remarquée, sinon un correctif de
 *  passage referme le trou sans que personne ne convertisse le constat en garantie.
 *
 *  Un COMPTEUR ne suffit pas (correction de Codex, 12/08/2026) : à total constant, une compagnie
 *  corrigée et une autre cassée s'annulent, et la CI reste verte sur un défaut tout neuf. On fige
 *  donc les clés une par une. Toute clé en plus, en moins, ou remplacée par une autre, échoue.
 *
 *  Les 10 sont tous `hold.brachy_allowed` : la fiche déclare le refus des races à face plate en
 *  soute, le moteur ne le reçoit pas. Impact mesuré, canal par canal :
 *    · 7 faux « soute disponible » — air_canada, air_france, iberia, klm, lufthansa, turkish,
 *      westjet : `hold.allowed = true` et aucun garde-fou brachycéphale ;
 *    · 2 sans conséquence d'affichage — american, delta : `hold.allowed = false` de toute façon,
 *      la restriction est perdue mais la soute n'est pas proposée ;
 *    · 1 en état « inconnu » — air_tahiti_nui : pas de canal soute du tout.
 *
 *  À corriger dans un P0 dédié « propagation des restrictions brachycéphales », canal par canal
 *  et source par source — pas par dix `brachy_allowed: false` ajoutés à l'aveugle. Chaque clé
 *  corrigée doit disparaître de cette liste DANS LA MÊME PR. */
const KNOWN_POLICY_GAPS = [
  "airline_air_canada.hold.brachy_allowed",
  "airline_air_france.hold.brachy_allowed",
  "airline_air_tahiti_nui.hold.brachy_allowed",
  "airline_american.hold.brachy_allowed",
  "airline_delta.hold.brachy_allowed",
  "airline_iberia.hold.brachy_allowed",
  "airline_klm.hold.brachy_allowed",
  "airline_lufthansa.hold.brachy_allowed",
  "airline_turkish.hold.brachy_allowed",
  "airline_westjet.hold.brachy_allowed",
];
for (const a of (objects.airlines || [])) {
  const fiche = sorted[a.id]; if (!fiche) continue;
  const derived = derivePolicy(fiche);
  a.premium = a.premium || {};
  a.premium.policy = a.premium.policy || {};
  const pol = a.premium.policy;
  // Provenance: the fiche is verified from the airline's official site; keep that as the structured source.
  const source = {
    url: a.website || fiche.book?.url,
    source_type: "official_website",
    verified_date: fiche.verified_date,
    review_due: addDays(fiche.verified_date, 90),
    confidence: 3,
    reviewer: "MyDogCanFly Data Team (derived from fiche)",
    history: [],
  };
  let touched = false;
  // Second chemin de perte, distinct de la préservation : `derivePolicy` supprime un mode dont
  // `allowed` est inconnu, et emporte avec lui les faits qui y étaient attachés. Une fiche qui
  // déclare le refus des brachycéphales en soute SANS porter de canal « soute » perd donc son
  // refus. Relevé ici avant que le mode ne disparaisse.
  if (CHECK) {
    for (const [mode, field, value] of derived.__dropped ?? []) {
      policyGaps.push({ id: a.id, mode, field, fiche: value, curated: undefined, cause: "canal absent de la fiche" });
    }
  }
  /* La fiche est AUTORITAIRE, y compris par la suppression (contre-revue du 15/08/2026).
   *
   * Le lot précédent se contentait de `continue` sur un placement que la fiche ne décide plus :
   * la politique d'alors SURVIVAIT dans `objects.json`, et `--check` sortait 0 puisqu'il compare
   * l'artefact à une régénération qui la préservait elle aussi. Retirer un canal d'une fiche
   * laissait donc un fantôme — exactement la classe de défaut que T0-B2 devait fermer, et la
   * cause même des dix anciens POLICY_STALE.
   *
   * Une politique retirée change un verdict : la suppression est RELEVÉE ici pour le rapport, et
   * c'est la comparaison à `IDENTITES_APPROUVEES` — extérieure aux artefacts — qui la fait
   * échouer, de façon durable. */
  for (const mode of PLACEMENTS) {
    if (derived[mode] === undefined && pol[mode] !== undefined) {
      politiquesRetirees.push({ id: a.id, mode });
      delete pol[mode];
      touched = true;
      continue;
    }
    const d = derived[mode]; if (!d) continue;
    const cur = pol[mode];
    /* La DÉCISION vient toujours de la fiche, y compris ici (T0-B2). C'est le seul champ que la
       préservation ne couvre plus : une politique enrichie reste plus riche que la dérivation,
       mais elle ne peut plus contredire sa fiche sur le verdict — il n'y a qu'une source. */
    const decision = DISCRIMINANTS.reduce((o, k) => (k in d ? { ...o, [k]: d[k] } : o), {});
    // Preserve richer hand-authored policy (has a real source, not derived). Overwrite/refresh derived ones.
    if (cur && estDecidee(cur) && cur.source && !cur.derived_from_fiche) {
      // Cette préservation est voulue — une politique écrite à la main est plus riche que la
      // dérivation (dimensions de sac, conditions). Mais elle crée un angle mort : le jour où
      // la fiche est corrigée, la politique reste à sa valeur d'origine, en silence. Ici on ne
      // touche à rien ; on SIGNALE seulement les cas où les deux se contredisent frontalement.
      //
      // Champs comparés : ceux que la fiche MODÉLISE réellement. On ne compare que si la
      // dérivation produit une valeur — l'absence d'un signal dans la fiche n'est pas une
      // contradiction, c'est un silence. Et les champs propres à la politique enrichie que la
      // fiche ne sait pas exprimer (dimensions de sac, tarifs, conditions) sont ignorés : les
      // signaler reviendrait à reprocher à la fiche d'être moins riche, ce qui est le but.
      for (const field of COMPARED_FIELDS) {
        const fiche = d[field];
        if (fiche === undefined) continue;              // la fiche ne dit rien → pas de contradiction
        if (cur[field] === fiche) continue;
        // Deux situations très différentes, qu'il serait faux de confondre :
        //   DRIFT — les deux côtés portent une valeur, et elles s'opposent. Contradiction franche.
        //   GAP   — la fiche affirme, la politique enrichie est muette. Le fait n'atteint pas le
        //           moteur : ce n'est pas une contradiction, c'est une perte.
        (cur[field] === undefined ? policyGaps : handAuthoredConflicts)
          .push({ id: a.id, mode, field, fiche, curated: cur[field], cause: "politique enrichie préservée" });
      }
      /* Seule la décision est réécrite ; tout le reste de la politique enrichie est préservé
         DANS SON ORDRE, et l'ancien booléen d'auteur est retiré s'il traîne encore. */
      const { allowed: _a, conditional: _c, availability: _av, review_state: _rs, ...enrichissements } = cur;
      /* Une source AUDITÉE écrite dans la fiche l'emporte, ici aussi. La première correction
         plaçait cette priorité UNIQUEMENT dans la branche dérivée : sur une politique enrichie,
         l'audit était accepté par le schéma puis silencieusement ignoré, et l'ancienne provenance
         survivait — ingestion et `--check` en 0 (contre-revue du 15/08/2026). Une preuve citée ne
         peut pas être moins forte qu'une provenance écrite à la main sans citation. */
      if (d.__source_auditee) enrichissements.source = d.__source_auditee;
      const remplacee = { ...decision, ...enrichissements };
      if (JSON.stringify(remplacee) !== JSON.stringify(cur)) { pol[mode] = remplacee; touched = true; }
      continue;
    }
    /* Provenance : la dérivée, SAUF pour les clés EXACTEMENT listées dans l'allowlist.
     *
     * La première version préservait toute provenance stockée qui différait de la dérivée. Elle
     * empêchait bien la perte des dix provenances curatoriales — mais elle gelait aussi toutes
     * les autres : corriger la `verified_date` d'une fiche ne se propageait plus, et `--check`
     * signalait ensuite de NOUVEAUX PROVENANCE_CURATED (contre-revue du 15/08/2026). Le remède
     * était devenu la maladie : une provenance figée en silence, précisément ce que ce lot ferme.
     *
     * L'exception est donc nominative. Partout ailleurs la provenance SUIT la fiche. */
    const cle = `${a.id}.${mode}`;
    const provenanceExistante = cur?.source;
    const divergente = provenanceExistante && JSON.stringify(provenanceExistante) !== JSON.stringify(source);
    const provenanceDivergente = divergente && KNOWN_PROVENANCE_CURATED.includes(cle);
    if (provenanceDivergente) provenanceCuratee.push({ id: a.id, mode, stockee: cur.source.url, derivee: source.url });
    /* Priorité de provenance, du plus fort au plus faible :
       1. la source AUDITÉE écrite dans la fiche (une preuve citée l'emporte sur une dérivation) ;
       2. la provenance curatoriale préservée, pour les seules clés de l'allowlist ;
       3. la provenance dérivée de la fiche. */
    const auditee = d.__source_auditee;
    /* `source_derived` qualifie la SOURCE, `derived_from_fiche` la POLITIQUE — deux choses que le
       drapeau unique confondait. Le fret de Thai Airways est une politique dérivée (`true`) dont
       la source est auditée (donc PAS `source_derived`) : sans cette séparation, la seule preuve
       auditée du dépôt disparaissait des écrans qui trient les sources. */
    const sourceRetenue = auditee ? auditee : provenanceDivergente ? provenanceExistante : source;
    pol[mode] = {
      ...decision,
      ...(d.max_weight_kg != null ? { max_weight_kg: d.max_weight_kg } : {}),
      ...(d.brachy_allowed === false ? { brachy_allowed: false } : {}),
      source: sourceRetenue,
      ...(sourceRetenue === source ? { source_derived: true } : {}),
      derived_from_fiche: true,
    };
    touched = true; filledModes++;
  }
  if (touched) patched++;
}
/** Pour objects.json, nommer les compagnies dont la politique dérivée diffère. */
const namedPolicyDiff = (before, after) => {
  let a, b;
  try { a = JSON.parse(before); b = JSON.parse(after); } catch { return "         (artefact illisible)"; }
  const pol = (o) => Object.fromEntries((o.airlines || []).map((x) => [x.id, x.premium?.policy]));
  const pa = pol(a), pb = pol(b);
  const changed = [...new Set([...Object.keys(pa), ...Object.keys(pb)])]
    .filter((id) => JSON.stringify(pa[id]) !== JSON.stringify(pb[id])).sort();
  if (!changed.length) return "         (écart hors premium.policy — comparer le fichier entier)";
  return `         ${changed.length} politique(s) : ${changed.slice(0, 12).map((s) => s.replace("airline_", "")).join(", ")}` +
    (changed.length > 12 ? `, … et ${changed.length - 12} autre(s)` : "");
};

emit(OBJECTS, JSON.stringify(objects, null, 2) + "\n", namedPolicyDiff);
console.log(
  CHECK
    ? `• ${patched} compagnies / ${filledModes} canaux dérivés ; ${rel(OBJECTS)} vérifié`
    : `✓ derived structured policy → patched ${patched} airlines (${filledModes} modes filled) in ${rel(OBJECTS)}`,
);

// ---- Verdict du mode --check ------------------------------------------------
if (CHECK) {
  let failed = false;

  // Égalité EXACTE des identifiants (Codex, 12/08/2026). Sans ce contrôle, ajouter ou retirer une
  // fiche laisse `objects.json` orphelin — l'ingestion ne crée ni ne supprime de compagnie, elle
  // se contente de patcher celles qui existent des deux côtés — et `--check` sortait 0.
  const ficheIds = new Set(Object.keys(sorted));
  const objectIds = new Set((objects.airlines || []).map((a) => a.id));
  const sansObjet = [...ficheIds].filter((id) => !objectIds.has(id)).sort();
  const sansFiche = [...objectIds].filter((id) => !ficheIds.has(id)).sort();
  if (sansObjet.length || sansFiche.length) {
    failed = true;
    console.error("\n✖ les identifiants de fiches et ceux d'objects.json ne coïncident plus :");
    for (const id of sansObjet) console.error(`  + ${id} : fiche présente, absente d'objects.json (compagnie à créer)`);
    for (const id of sansFiche) console.error(`  - ${id} : dans objects.json, aucune fiche (fiche supprimée ?)`);
    console.error("  L'ingestion ne crée ni ne supprime de compagnie : ces deux ensembles doivent être égaux.");
  }

  if (drift.length) {
    failed = true;
    console.error(`\n✖ artefacts désynchronisés (${drift.length}) — une fiche a été modifiée sans relancer l'ingestion :`);
    for (const d of drift) console.error("  - " + d);
    console.error(`\n  Correction : node ${rel(join(HERE, "ingest-airlines.mjs"))}  puis committer les artefacts régénérés.`);
  }

  // Contrôle distinct du précédent, et volontairement bloquant : une politique écrite à la main
  // qui affirme l'inverse de sa fiche n'est PAS une désynchronisation d'artefact — la
  // régénération ne la corrigerait pas, elle la préserverait. Il faut un arbitrage humain :
  // soit la fiche a raison et la politique doit être réécrite, soit l'inverse.
  if (handAuthoredConflicts.length) {
    failed = true;
    console.error(`\n✖ politiques écrites à la main en contradiction avec leur fiche (${handAuthoredConflicts.length}) :`);
    for (const c of handAuthoredConflicts) {
      console.error(`  POLICY_DRIFT ${c.id}.${c.mode}.${c.field}`);
      console.error(`    fiche=${JSON.stringify(c.fiche)}`);
      console.error(`    curated=${JSON.stringify(c.curated)}`);
      console.error(`    source fiche : content/airlines/${c.id.replace("airline_", "")}.yml`);
    }
    console.error("\n  Aucune régénération ne résoudra ceci : l'ingestion préserve délibérément ces politiques.");
    console.error("  Les deux représentations doivent être alignées dans la MÊME PR, ou l'écart arbitré à la source");
    console.error("  (règle maison : une compagnie fait foi sur sa politique, jamais sur le droit d'un État).");
  }

  // POLICY_GAP : défauts connus, figés par leur CLÉ. Ni bloquants tant qu'ils sont ceux attendus,
  // ni figés en silence — la comparaison porte sur l'ensemble, jamais sur le cardinal.
  const found = policyGaps.map((g) => `${g.id}.${g.mode}.${g.field}`).sort();
  const expected = [...KNOWN_POLICY_GAPS].sort();
  const nouveaux = found.filter((k) => !expected.includes(k));
  const refermes = expected.filter((k) => !found.includes(k));

  if (nouveaux.length || refermes.length) {
    failed = true;
    console.error("\n✖ l'ensemble des POLICY_GAP a changé.");
    if (nouveaux.length) {
      console.error(`\n  ${nouveaux.length} NOUVEAU(X) — un fait déclaré par une fiche n'atteint plus le moteur :`);
      for (const k of nouveaux) console.error(`    + ${k}`);
      console.error("    Corrigez la propagation, ou arbitrez et ajoutez la clé à KNOWN_POLICY_GAPS avec sa raison.");
    }
    if (refermes.length) {
      console.error(`\n  ${refermes.length} REFERMÉ(S) — bonne nouvelle, mais elle doit devenir une garantie :`);
      for (const k of refermes) console.error(`    - ${k}`);
      console.error("    Retirez la clé de KNOWN_POLICY_GAPS DANS LA MÊME PR que le correctif.");
    }
    console.error(`\n  attendus : ${expected.length} · trouvés : ${found.length}`);
    console.error("  Le contrôle porte sur l'ENSEMBLE des clés : à total constant, une compagnie");
    console.error("  corrigée et une autre cassée doivent échouer, pas s'annuler.");
  }

  /* IDENTITÉS : ce que les FICHES décident, comparé à l'ensemble approuvé et versionné. Ce
     contrôle ne dépend d'aucun artefact, il survit donc à la régénération — c'est ce qui manquait
     à la version précédente. Il couvre les trois mouvements d'un seul geste : apparition,
     disparition, et substitution à cardinal constant. */
  const identitesFiches = [];
  for (const [id, f] of Object.entries(sorted)) {
    for (const m of PLACEMENTS) if (f.policies[m] !== undefined) identitesFiches.push(`${id}.${m}`);
  }
  identitesFiches.sort();
  const approuvees = [...IDENTITES_APPROUVEES].sort();
  const apparues = identitesFiches.filter((k) => !approuvees.includes(k));
  const disparues = approuvees.filter((k) => !identitesFiches.includes(k));
  if (apparues.length || disparues.length) {
    failed = true;
    console.error("\n✖ l'ensemble des IDENTITÉS de politiques a changé.");
    for (const k of apparues) console.error(`    + ${k} — politique NOUVELLE : aucune ligne approuvée ne la prévoit`);
    for (const k of disparues) console.error(`    - ${k} — politique DISPARUE des fiches ; elle sera retirée d'objects.json`);
    console.error(`\n  approuvées : ${approuvees.length} · décidées par les fiches : ${identitesFiches.length}`);
    console.error("  Retirer ou ajouter une politique change un verdict : arbitrez, puis mettez à jour");
    console.error("  test-baselines/t0b2-policy-identities.json DANS LA MÊME PR, avec son diff approuvé.");
  }

  if (politiquesRetirees.length) {
    console.warn(`\n⚠ ${politiquesRetirees.length} POLICY_REMOVED — politique(s) supprimée(s) d'objects.json (absentes des fiches) :`);
    for (const r of politiquesRetirees) console.warn(`  POLICY_REMOVED ${r.id}.${r.mode}`);
  }

  /* Dette éditoriale des six placements sans canal visible : contrôlée DANS LES DEUX SENS, par
     identité. Une dette qui apparaît doit être revue ; une dette qui disparaît doit devenir une
     garantie, pas s'effacer en silence. */
  const detteObservee = [];
  for (const [id, f] of Object.entries(sorted)) {
    const portes = new Set(f.channels.map((c) => c.placement));
    for (const m of PLACEMENTS) if (f.policies[m] !== undefined && !portes.has(m)) detteObservee.push(`${id}.${m}`);
  }
  detteObservee.sort();
  const detteAttendue = [...POLITIQUES_SANS_CANAL_VISIBLE].sort();
  const detteNouvelle = detteObservee.filter((k) => !detteAttendue.includes(k));
  const detteResorbee = detteAttendue.filter((k) => !detteObservee.includes(k));
  if (detteNouvelle.length || detteResorbee.length) {
    failed = true;
    console.error("\n✖ l'ensemble des politiques SANS CANAL VISIBLE a changé.");
    for (const k of detteNouvelle) console.error(`    + ${k} — un placement décide sans qu'aucun canal ne le raconte au lecteur`);
    for (const k of detteResorbee) console.error(`    - ${k} — RÉSOLU : retirez la clé de POLITIQUES_SANS_CANAL_VISIBLE dans la MÊME PR`);
    console.error(`\n  attendues : ${detteAttendue.length} · observées : ${detteObservee.length}`);
  }

  // PROVENANCE_CURATED : ensemble figé par identité, comme les GAP. Une provenance préservée est
  // un écart assumé entre la fiche et l'artefact ; elle doit être nommée, sinon la préservation
  // redevient exactement le silence que T0-B2 ferme.
  const provFound = provenanceCuratee.map((p) => `${p.id}.${p.mode}`).sort();
  const provExpected = [...KNOWN_PROVENANCE_CURATED].sort();
  const provNouveaux = provFound.filter((k) => !provExpected.includes(k));
  const provRefermes = provExpected.filter((k) => !provFound.includes(k));
  if (provNouveaux.length || provRefermes.length) {
    failed = true;
    console.error("\n✖ l'ensemble des PROVENANCE_CURATED a changé.");
    if (provNouveaux.length) {
      console.error(`\n  ${provNouveaux.length} NOUVEAU(X) — une provenance stockée diverge de la dérivée :`);
      for (const k of provNouveaux) {
        const p = provenanceCuratee.find((x) => `${x.id}.${x.mode}` === k);
        console.error(`    + ${k}\n        stockée = ${p.stockee}\n        dérivée = ${p.derivee}`);
      }
      console.error("    Réalignez la fiche, ou figez la clé si la provenance stockée est la bonne.");
    }
    if (provRefermes.length) {
      console.error(`\n  ${provRefermes.length} RÉSOLU(S) — retirez la clé de KNOWN_PROVENANCE_CURATED dans la MÊME PR :`);
      for (const k of provRefermes) console.error(`    - ${k}`);
    }
    console.error(`\n  attendus : ${provExpected.length} · trouvés : ${provFound.length}`);
  }

  if (provenanceCuratee.length) {
    console.warn(`\n⚠ ${provenanceCuratee.length} PROVENANCE_CURATED — provenance stockée PRÉSERVÉE, plus précise que la dérivée :`);
    for (const p of provenanceCuratee) console.warn(`  PROVENANCE_CURATED ${p.id}.${p.mode}\n    stockée = ${p.stockee}\n    dérivée = ${p.derivee}`);
    console.warn("  Non bloquants tant que l'ensemble est celui attendu. Les écraser ferait PERDRE de la provenance.");
  }

  if (policyGaps.length) {
    console.warn(`\n⚠ ${policyGaps.length} POLICY_GAP connus — la fiche affirme, le moteur ne reçoit rien :`);
    for (const g of policyGaps) {
      console.warn(`  POLICY_GAP ${g.id}.${g.mode}.${g.field}`);
      console.warn(`    fiche=${JSON.stringify(g.fiche)}  curated=${JSON.stringify(g.curated)}  cause=${g.cause}`);
    }
    console.warn("  Non bloquants tant que l'ensemble est celui attendu — P0 « propagation brachycéphale » dédié.");
  }

  if (failed) process.exit(1);
  console.log("\n✓ artefacts à jour, aucune politique en contradiction avec sa fiche — rien écrit");
}
