// Ingest per-airline pet-policy fiches (YAML, source of truth) into a generated JSON
// that the UI consumes. Validates every fiche against a Zod schema so a typo or a
// missing EN/FR field fails the build instead of shipping.
//
//   node packages/knowledge/scripts/ingest-airlines.mjs            (régénère et écrit)
//   node packages/knowledge/scripts/ingest-airlines.mjs --check     (vérifie, n'écrit rien)
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
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { z } from "zod";

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
  console.error("  usage : ingest-airlines.mjs            (régénère et écrit)");
  console.error("          ingest-airlines.mjs --check    (vérifie, n'écrit rien)");
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
const Channel = z.object({ icon: z.string(), name: LT, cls: CLS, statusLabel: LT, detail: LT, fee: LT });
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
}).strict();

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
const catOf = (name) => { const n = (name || "").toLowerCase(); if (/cargo|fret/.test(n)) return "cargo"; if (/hold|soute|checked/.test(n)) return "hold"; if (/cabin|cabine/.test(n)) return "cabin"; return null; };
const kgOf = (s) => { const m = (s || "").match(/(?:≤|<=|up to|jusqu'?à)?\s*(\d{1,3})\s*kg/i); return m ? parseInt(m[1], 10) : null; };

function derivePolicy(fiche) {
  const p = { cabin: {}, hold: {}, cargo: {} };
  for (const c of (fiche.channels || [])) {
    const cat = catOf(c.name?.en); if (!cat) continue;
    if (c.cls === "no") p[cat].allowed = false;
    else if (c.cls === "ok" || c.cls === "warn") p[cat].allowed = true;   // warn = conditional/on-request
    if (c.cls === "warn") p[cat].conditional = true;
  }
  for (const r of (fiche.fareList?.rows || [])) {
    const cat = catOf(r.label?.en); if (cat !== "cabin") continue;         // only cabin weight is an unambiguous max
    const kg = kgOf(r.label?.en) ?? kgOf(r.value?.en); if (kg && p.cabin.max_weight_kg == null) p.cabin.max_weight_kg = kg;
  }
  for (const r of (fiche.restrictions || [])) {
    if (!/flat-faced|brachy|snub|nose|nez|museau/i.test(r.title?.en || "")) continue;
    for (const pill of (r.pills || [])) {
      if (pill.cls === "no" && /hold|soute|cargo/i.test(pill.label?.en || "")) p.hold.brachy_allowed = false;
    }
  }
  // Drop empty modes (no signal at all → unknown). Un mode supprimé peut malgré tout porter des
  // faits — c'est le cas d'un refus brachycéphale attaché à une soute que la fiche ne décrit pas.
  // Ils sont consignés avant suppression pour que `--check` puisse les nommer.
  const dropped = [];
  for (const k of ["cabin", "hold", "cargo"]) {
    if (p[k].allowed !== undefined) continue;
    for (const [field, value] of Object.entries(p[k])) dropped.push([k, field, value]);
    delete p[k];
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
const COMPARED_FIELDS = ["allowed", "max_weight_kg", "brachy_allowed"];
const handAuthoredConflicts = [];   // POLICY_DRIFT — les deux côtés parlent et se contredisent
const policyGaps = [];              // POLICY_GAP   — la fiche affirme, le moteur ne reçoit rien
const policyStale = [];             // POLICY_STALE — canal marqué dérivé que la fiche ne produit plus

/**
 * POLICY_STALE connus (lot M1-v3, 12/08/2026) — L'ENSEMBLE EXACT, comme pour les GAP.
 *
 * Défaut relevé par Codex dans la garantie principale de `--check` : le script repart de
 * `objects.json`, écrase ce qu'il sait encore dériver, mais **ne retire ni ne signale** un canal
 * marqué `derived_from_fiche` que la fiche ne produit plus. Il comparait donc l'artefact à
 * lui-même. Contre-épreuve de Codex : renommer « Aegean Cargo » en libellé non reconnu, relancer
 * l'ingestion, puis `--check` → sortie 0 alors que `airline_aegean.cargo` survit dans l'artefact.
 *
 * Mesure : **269** canaux portent `derived_from_fiche`, la dérivation courante n'en reproduit que
 * **259**. Les 10 restants sont des survivances : leur canal a disparu de la fiche (ou son libellé
 * n'est plus reconnu, cf. §4.1 de la doc) et la politique dérivée d'alors est restée.
 *
 * Ils ne sont PAS supprimés ici : retirer un canal d'une politique change un verdict, c'est de la
 * donnée métier. Ils sont figés en dette, et toute variation de l'ensemble échoue.
 */
const KNOWN_POLICY_STALE = {
  "airline_asiana.cargo":            "927bef315543c80f",
  "airline_condor.cargo":            "21deb5a48932c426",
  "airline_eva_air.cargo":           "5109d9d4f2b544f7",
  "airline_french_bee.cargo":        "3f98ea1a87e8511c",
  "airline_korean_air.cargo":        "2e7926507bd7368f",
  "airline_malaysia_airlines.cargo": "0887662bf0ff0ebd",
  "airline_norwegian.cargo":         "db7ac03546cd3d0e",
  "airline_qantas.cargo":            "18d2f77b78e69afa",
  "airline_qantas.hold":             "d1af29ce1e0eb683",
  "airline_virgin_australia.hold":   "49c97acf6c340078",
};

/**
 * Empreinte CANONIQUE d'une politique de canal : clés triées récursivement, puis SHA-256 tronqué.
 * Le tri rend l'empreinte insensible à l'ordre de sérialisation — sans lui, une simple
 * réécriture d'`objects.json` par un outil tiers ferait rougir la CI sans qu'aucune valeur
 * n'ait changé.
 */
function policyFingerprint(value) {
  const canon = (v) => {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
    }
    return v;
  };
  return createHash("sha256").update(JSON.stringify(canon(value))).digest("hex").slice(0, 16);
}

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
  // POLICY_STALE : un canal marqué « dérivé » que la dérivation courante ne produit plus.
  // L'ingestion ne le réécrit pas (rien à écrire) et ne le supprime pas — il survit en silence.
  if (CHECK) {
    for (const mode of ["cabin", "hold", "cargo"]) {
      if (derived[mode] === undefined && pol[mode]?.derived_from_fiche === true) {
        policyStale.push({ id: a.id, mode, fingerprint: policyFingerprint(pol[mode]) });
      }
    }
  }
  for (const mode of ["cabin", "hold", "cargo"]) {
    const d = derived[mode]; if (!d) continue;
    const cur = pol[mode];
    // Preserve richer hand-authored policy (has a real source, not derived). Overwrite/refresh derived ones.
    if (cur && cur.allowed !== undefined && cur.source && !cur.derived_from_fiche) {
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
      continue;
    }
    pol[mode] = {
      allowed: d.allowed,
      ...(d.max_weight_kg != null ? { max_weight_kg: d.max_weight_kg } : {}),
      ...(d.brachy_allowed === false ? { brachy_allowed: false } : {}),
      ...(d.conditional ? { conditional: true } : {}),
      source,
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

  // POLICY_STALE : ensemble figé ET contenu figé. La clé seule ne suffit pas — Codex l'a montré
  // en passant `airline_french_bee.cargo.allowed` de false à true : la clé reste, l'ensemble est
  // identique, et un verdict change sans alerte. On compare donc aussi l'empreinte canonique de
  // la politique complète, sous chaque clé connue.
  const staleFoundMap = new Map(policyStale.map((s) => [`${s.id}.${s.mode}`, s.fingerprint]));
  const staleFound = [...staleFoundMap.keys()].sort();
  const staleExpected = Object.keys(KNOWN_POLICY_STALE).sort();
  const staleNew = staleFound.filter((k) => !staleExpected.includes(k));
  const staleGone = staleExpected.filter((k) => !staleFound.includes(k));
  const staleDrift = staleFound
    .filter((k) => staleExpected.includes(k))
    .filter((k) => staleFoundMap.get(k) !== KNOWN_POLICY_STALE[k])
    .map((k) => ({ key: k, expected: KNOWN_POLICY_STALE[k], found: staleFoundMap.get(k) }));

  if (staleNew.length || staleGone.length) {
    failed = true;
    console.error("\n✖ l'ensemble des POLICY_STALE a changé.");
    if (staleNew.length) {
      console.error(`\n  ${staleNew.length} NOUVEAU(X) — un canal marqué « dérivé » n'est plus produit par sa fiche :`);
      for (const k of staleNew) console.error(`    + ${k}   empreinte ${staleFoundMap.get(k)}`);
      console.error("    Le canal a disparu de la fiche, ou son libellé n'est plus reconnu par catOf().");
      console.error("    Retirez le canal de la politique, ou rétablissez le libellé, ou figez la clé avec son empreinte.");
    }
    if (staleGone.length) {
      console.error(`\n  ${staleGone.length} RÉSOLU(S) — retirez la clé de KNOWN_POLICY_STALE dans la MÊME PR :`);
      for (const k of staleGone) console.error(`    - ${k}`);
    }
    console.error(`\n  attendus : ${staleExpected.length} · trouvés : ${staleFound.length}`);
  }

  if (staleDrift.length) {
    failed = true;
    console.error(`\n✖ le CONTENU d'une politique périmée a changé (${staleDrift.length}) :`);
    for (const d of staleDrift) {
      const [id, mode] = [d.key.slice(0, d.key.lastIndexOf(".")), d.key.slice(d.key.lastIndexOf(".") + 1)];
      console.error(`  POLICY_STALE_DRIFT ${id}.${mode}`);
      console.error(`    empreinte attendue = ${d.expected}`);
      console.error(`    empreinte trouvée  = ${d.found}`);
    }
    console.error("\n  Une politique périmée n'est plus reproductible depuis sa fiche : personne ne la");
    console.error("  régénère, donc rien ne la corrigerait. La modifier change un verdict en silence.");
    console.error("  Si le changement est voulu, mettez à jour l'empreinte dans KNOWN_POLICY_STALE et");
    console.error("  justifiez-le — la table est là pour rendre ce geste explicite, pas pour l'interdire.");
  }

  if (policyStale.length) {
    console.warn(`\n⚠ ${policyStale.length} POLICY_STALE connus — canal marqué « dérivé » que la fiche ne produit plus :`);
    for (const s of policyStale) console.warn(`  POLICY_STALE ${s.id}.${s.mode}   empreinte ${s.fingerprint}`);
    console.warn("  La politique dérivée d'alors survit dans objects.json. Non bloquants tant que l'ensemble");
    console.warn("  est celui attendu — leur retrait change un verdict, c'est de la donnée métier.");
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
