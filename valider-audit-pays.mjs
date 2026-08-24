#!/usr/bin/env node
/**
 * LOT A — LE VALIDATEUR PERMANENT DE LA MATRICE D'AUDIT. Câblé en CI : c'est un invariant du
 * dépôt, pas une preuve manuelle.
 *
 *   node --import tsx valider-audit-pays.mjs --as-of=AAAA-MM-JJ
 *
 * CE QU'IL TIENT (contrôles 17 à 44 du dossier lot A, v4-ter approuvée en contre-revue) :
 *   · SCHÉMA STRICT — la matrice est une union discriminée zod `.strict()` : un champ inconnu
 *     est une erreur, une branche `tentative` ne peut porter ni pièce ni pertinence affirmée ;
 *   · BIJECTION 91/91 sur le TRIPLET EXACT (country_id, label, url_publiee) avec les liens
 *     publiés par les guides — un libellé modifié rougit autant qu'une URL ;
 *   · PIÈCES PROUVÉES — extrait verbatim (langue BCP-47, locator), ou fichier sous
 *     `audit-pays-pieces/`, RÉGULIER (pas un lien symbolique), SUIVI par git
 *     (`git ls-files --error-unmatch`), SHA-256 de 64 hexa égal au contenu ;
 *   · CONTRATS CANONIQUES RÉUTILISÉS — `SourcedQuote` pour la preuve décisive et pour chaque
 *     preuve de rattachement ; `Source` pour la projection ; `reviewDueFrom` pour l'échéance ;
 *   · PROMOTION — désigne son observation décisive, dont la pièce est un `extrait` ;
 *     concordance exacte SourcedQuote ↔ observation (url_finale, date, citation, langue,
 *     locator) ; `verified_date` = consultation ; `reviewer` = auditeur ; `review_due` dérivée ;
 *     `locator` obligatoire ; hôte MyDogCanFly interdit ;
 *   · NÉGATIF VÉRIDIQUE — `aucune_source_officielle` est INVALIDE si une candidate éligible
 *     existe ; toute nature d'éditeur ≠ `non_etabli` exige au moins une preuve de rattachement ;
 *   · ESCALADE — un lien publié classé `non_officiel` reste affiché sous « Sources
 *     officielles » par la fiche : c'est un ÉCHEC BLOQUANT qui exige un arbitrage, jamais une
 *     correction silencieuse ;
 *   · TEMPS — `--as-of` obligatoire et calendaire ; aucune date future ; `audite_le` ≥ toutes
 *     les consultations/tentatives du pays ;
 *   · PROJECTION — si `objects.json` porte une source pour un des 18, elle doit être la
 *     projection canonique EXACTE du `SourcedQuote` promu (URL FINALE comprise). L'inverse
 *     (promue non encore appliquée) est licite : les promotions s'appliquent après contre-revue.
 *
 * Sortie 0 si tout tient ; 1 au premier lot d'écarts, chacun nommé (pays, candidate, champ) ;
 * 2 si --as-of manque ou n'existe pas.
 */
import { readFileSync, lstatSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { z } from "zod";
import { Source } from "./packages/knowledge/src/common.ts";
import { reviewDueFrom } from "./packages/knowledge/src/common.ts";
import { SourcedQuote } from "./packages/knowledge/src/breed-restrictions.ts";

const MATRICE = "audit-pays.json";
const SCELLE = "etat-reference-lot-a.json";
const PIECES = "audit-pays-pieces/";

/* ---- --as-of --------------------------------------------------------------------------------- */
const asOf = (process.argv.find((a) => a.startsWith("--as-of=")) || "").slice(8);
const dateExiste = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d));
  if (!m) return false;
  const u = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return u.getUTCFullYear() === +m[1] && u.getUTCMonth() === +m[2] - 1 && u.getUTCDate() === +m[3];
};
if (!dateExiste(asOf)) {
  process.stderr.write(`[audit] ÉCHEC : --as-of=AAAA-MM-JJ est OBLIGATOIRE et la date doit exister${asOf ? ` — « ${asOf} » n'est pas un jour du calendrier` : ""}.\n`);
  process.exit(2);
}

const ecarts = [];
const echec = (m) => ecarts.push(m);

/* ---- schéma STRICT de la matrice ------------------------------------------------------------- */
const DateISO = z.string().refine(dateExiste, { message: "date inexistante au calendrier" });
const LT = z.object({ en: z.string(), fr: z.string(), es: z.string().optional(), pt: z.string().optional() }).strict();
const Langue = z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/);
const Sha256 = z.string().regex(/^[0-9a-f]{64}$/, "SHA-256 de 64 caractères hexadécimaux attendu");
const Fichier = z.object({ chemin: z.string().min(1), sha256: Sha256 }).strict();

const PieceExtrait = z.object({ type: z.literal("extrait"), extrait: z.string().min(10), langue: Langue, locator: z.string().min(1) }).strict();
const PieceCapture = z.object({ type: z.literal("capture"), chemin: z.string().min(1), sha256: Sha256 }).strict();
const Trace = z.object({ type: z.enum(["transcript", "capture"]), chemin: z.string().min(1), sha256: Sha256 }).strict();

const NatureEditeur = z.enum(["autorite_pays", "mission_diplomatique_pays", "officiel_tiers", "non_officiel", "non_etabli"]);
const Pertinence = z.enum(["etaye_le_fait", "partielle", "page_generique", "hors_sujet", "non_evaluee"]);

const CandidateConsultee = z.object({
  label: LT,
  url_publiee: z.string().url(),
  acces: z.literal("consultee"),
  url_finale: z.string().url(),
  statut_http: z.number().int().min(200).max(299),
  consultee_le: DateISO,
  piece: z.union([PieceExtrait, PieceCapture]),
  captures_complementaires: z.array(Fichier).optional(),
  nature_editeur: NatureEditeur,
  preuves_rattachement: z.array(z.unknown()).default([]),
  pertinence: Pertinence,
}).strict();

const CandidateTentative = z.object({
  label: LT,
  url_publiee: z.string().url(),
  acces: z.literal("tentative"),
  tentee_le: DateISO,
  resultat: z.string().min(1),
  trace: Trace,
  nature_editeur: NatureEditeur,
  preuves_rattachement: z.array(z.unknown()).default([]),
  pertinence: z.literal("non_evaluee"),
}).strict();

const Candidate = z.discriminatedUnion("acces", [CandidateConsultee, CandidateTentative]);

const DecisionPromue = z.object({
  statut: z.literal("promue"),
  observation_decisive: z.number().int().min(0),
  source: z.unknown(),               // SourcedQuote — validé par le contrat canonique ci-dessous
}).strict();
const DecisionSans = z.object({
  statut: z.literal("aucune_source_officielle"),
  motif: z.string().min(10),
}).strict();

const EntreePays = z.object({
  audite_par: z.string().min(1),
  audite_le: DateISO,
  candidates: z.array(Candidate).min(1),
  decision: z.discriminatedUnion("statut", [DecisionPromue, DecisionSans]),
}).strict();

const Matrice = z.object({ audits: z.record(z.string(), EntreePays) }).strict();

/* ---- chargements ----------------------------------------------------------------------------- */
const lire = (p) => JSON.parse(readFileSync(p, "utf-8"));
let matriceBrute;
try { matriceBrute = lire(MATRICE); }
catch { process.stderr.write(`[audit] ÉCHEC : ${MATRICE} introuvable ou illisible — jamais vert faute de matière.\n`); process.exit(1); }
const scelle = lire(SCELLE);
const guides = lire("packages/ui/src/data/countries.generated.json");
const objets = lire("packages/knowledge/raw/objects.json");
const CONTRACTUELS = Object.keys(scelle.pays);

const parseMatrice = Matrice.safeParse(matriceBrute);
if (!parseMatrice.success) {
  for (const i of parseMatrice.error.issues.slice(0, 30)) {
    echec(`schéma — ${i.path.join(".") || "(racine)"} : ${i.message}`);
  }
}
const audits = matriceBrute.audits ?? {};

/* ---- 17-18 · la matrice couvre exactement les 18, bijection TRIPLET par pays ----------------- */
const idsMatrice = Object.keys(audits).sort();
if (JSON.stringify(idsMatrice) !== JSON.stringify([...CONTRACTUELS].sort())) {
  echec(`périmètre — pays en trop [${idsMatrice.filter((x) => !CONTRACTUELS.includes(x)).join(", ")}] · ` +
    `manquants [${CONTRACTUELS.filter((x) => !idsMatrice.includes(x)).join(", ")}]`);
}

const canon = (x) => JSON.stringify(x, Object.keys(x ?? {}).sort ? undefined : undefined);
const jsonCanonique = (x) => {
  if (Array.isArray(x)) return "[" + x.map(jsonCanonique).join(",") + "]";
  if (x && typeof x === "object") return "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + jsonCanonique(x[k])).join(",") + "}";
  return JSON.stringify(x);
};

const dansFenetre = (d, pays, quoi) => {
  if (typeof d === "string" && dateExiste(d) && d > asOf) echec(`${pays} — ${quoi} « ${d} » est POSTÉRIEURE à --as-of=${asOf}`);
};

/* ---- pièces : versionnées au sens PROUVÉ ----------------------------------------------------- */
const fichierProuve = (pays, quoi, chemin, sha) => {
  if (!chemin.startsWith(PIECES) || chemin.includes("..")) {
    echec(`${pays} — ${quoi} : chemin « ${chemin} » hors du répertoire ${PIECES}`); return;
  }
  let st;
  try { st = lstatSync(chemin); }
  catch { echec(`${pays} — ${quoi} : « ${chemin} » ne désigne aucun fichier`); return; }
  if (st.isSymbolicLink() || !st.isFile()) { echec(`${pays} — ${quoi} : « ${chemin} » n'est pas un fichier régulier (lien symbolique refusé)`); return; }
  const suivi = spawnSync("git", ["ls-files", "--error-unmatch", "--", chemin], { encoding: "utf-8" });
  if (suivi.status !== 0) { echec(`${pays} — ${quoi} : « ${chemin} » n'est PAS SUIVI par git — « versionnée » se prouve`); return; }
  const reel = createHash("sha256").update(readFileSync(chemin)).digest("hex");
  if (reel !== sha) echec(`${pays} — ${quoi} : SHA-256 de « ${chemin} » ≠ scellé (contenu remplacé à chemin constant ?)`);
};

/* ---- par pays -------------------------------------------------------------------------------- */
for (const id of CONTRACTUELS) {
  const a = audits[id];
  if (!a) continue;
  const publies = (guides[id]?.sources ?? []).map((s) => ({ label: s.label, url_publiee: s.url }));
  const declares = (a.candidates ?? []).map((c) => ({ label: c.label, url_publiee: c.url_publiee }));
  if (jsonCanonique(publies) !== jsonCanonique(declares)) {
    echec(`${id} — bijection TRIPLET rompue : les candidates ne sont pas exactement les ${publies.length} liens publiés (label et url_publiee, dans l'ordre)`);
  }

  dansFenetre(a.audite_le, id, "audite_le");
  for (const [i, c] of (a.candidates ?? []).entries()) {
    const qui = `candidate[${i}] (${c.url_publiee})`;
    if (c.acces === "consultee") {
      dansFenetre(c.consultee_le, id, `${qui} consultee_le`);
      if (a.audite_le < c.consultee_le) echec(`${id} — audite_le « ${a.audite_le} » antérieure à la consultation ${qui}`);
      if (c.piece?.type === "capture") fichierProuve(id, `${qui} pièce capture`, c.piece.chemin, c.piece.sha256);
      for (const [j, f] of (c.captures_complementaires ?? []).entries()) fichierProuve(id, `${qui} capture complémentaire [${j}]`, f.chemin, f.sha256);
    } else if (c.acces === "tentative") {
      dansFenetre(c.tentee_le, id, `${qui} tentee_le`);
      if (a.audite_le < c.tentee_le) echec(`${id} — audite_le « ${a.audite_le} » antérieure à la tentative ${qui}`);
      /* L'absence de trace est déjà un échec de schéma — on ne vérifie que ce qui existe. */
      if (c.trace?.chemin) fichierProuve(id, `${qui} trace`, c.trace.chemin, c.trace.sha256);
    }
    /* 41 — le rattachement se prouve, quelle que soit la nature affirmée. */
    if (c.nature_editeur !== "non_etabli" && (c.preuves_rattachement ?? []).length === 0) {
      echec(`${id} — ${qui} : nature « ${c.nature_editeur} » sans AUCUNE preuve de rattachement`);
    }
    for (const [j, p] of (c.preuves_rattachement ?? []).entries()) {
      const r = SourcedQuote.safeParse(p);
      if (!r.success) echec(`${id} — ${qui} preuve de rattachement [${j}] rejetée par SourcedQuote : ${r.error.issues.map((x) => `${x.path.join(".")} — ${x.message}`).slice(0, 3).join(" · ")}`);
      else dansFenetre(p.verified_date, id, `${qui} preuve de rattachement [${j}] verified_date`);
    }
    /* 25 — ESCALADE : le lien reste affiché sous « Sources officielles » par la fiche. */
    if (c.nature_editeur === "non_officiel") {
      echec(`${id} — ${qui} : classé NON OFFICIEL alors que la fiche le présente sous « Sources officielles » — ÉCHEC BLOQUANT, arbitrage requis (jamais de correction silencieuse dans ce lot)`);
    }
  }

  /* ---- décision ------------------------------------------------------------------------------ */
  const d = a.decision;
  if (!d) continue;
  if (d.statut === "promue") {
    const c = (a.candidates ?? [])[d.observation_decisive];
    if (!c) { echec(`${id} — observation_decisive ${d.observation_decisive} ne désigne aucune candidate`); continue; }
    if (c.acces !== "consultee") echec(`${id} — la candidate décisive n'est pas une consultation`);
    if (c.nature_editeur !== "autorite_pays") echec(`${id} — promotion depuis une nature « ${c.nature_editeur} » — seule l'autorité du pays est éligible`);
    if (c.pertinence !== "etaye_le_fait") echec(`${id} — promotion depuis une pertinence « ${c.pertinence} »`);
    if (c.piece?.type !== "extrait") echec(`${id} — la pièce décisive d'une promotion doit être un EXTRAIT (capture seule refusée)`);

    const r = SourcedQuote.safeParse(d.source);
    if (!r.success) {
      echec(`${id} — source promue rejetée par SourcedQuote : ${r.error.issues.map((x) => `${x.path.join(".")} — ${x.message}`).slice(0, 4).join(" · ")}`);
    } else {
      const s = d.source;
      if (!s.locator) echec(`${id} — source promue sans locator (obligatoire au lot A)`);
      if (c.acces === "consultee") {
        if (s.url !== c.url_finale) echec(`${id} — concordance : source.url « ${s.url} » ≠ url_finale « ${c.url_finale} » (la projection porte l'URL FINALE)`);
        if (s.verified_date !== c.consultee_le) echec(`${id} — concordance : verified_date « ${s.verified_date} » ≠ consultee_le « ${c.consultee_le} »`);
        if (c.piece?.type === "extrait") {
          if (s.quote !== c.piece.extrait) echec(`${id} — concordance : la citation promue diffère de l'extrait de l'observation décisive`);
          if (s.quote_language !== c.piece.langue) echec(`${id} — concordance : langue « ${s.quote_language} » ≠ « ${c.piece.langue} »`);
          if (s.locator !== c.piece.locator) echec(`${id} — concordance : locator « ${s.locator} » ≠ « ${c.piece.locator} »`);
        }
      }
      if (s.reviewer !== a.audite_par) echec(`${id} — source promue : reviewer « ${s.reviewer} » ≠ audite_par « ${a.audite_par} »`);
      if (s.review_due !== reviewDueFrom(s.verified_date, "country")) {
        echec(`${id} — review_due « ${s.review_due} » ≠ dérivation ADR-0007 « ${reviewDueFrom(s.verified_date, "country")} » (cadence pays, jamais saisie à la main)`);
      }
      dansFenetre(s.verified_date, id, "source promue verified_date");
    }
  } else if (d.statut === "aucune_source_officielle") {
    const eligible = (a.candidates ?? []).find((c) =>
      c.acces === "consultee" && c.nature_editeur === "autorite_pays" && c.pertinence === "etaye_le_fait");
    if (eligible) echec(`${id} — « aucune_source_officielle » alors qu'une candidate ÉLIGIBLE existe : ${eligible.url_publiee}`);
  }

  /* ---- 27/31 · projection dans objects.json : jamais sans la matrice, jamais différente ------- */
  const pays = objets.countries.find((x) => x.id === id);
  if (pays?.source) {
    if (d.statut !== "promue") {
      echec(`${id} — objects.json porte une source alors que la matrice ne promeut pas — la matrice fait foi`);
    } else {
      const projection = { url: d.source.url, source_type: d.source.source_type, verified_date: d.source.verified_date,
        review_due: d.source.review_due, confidence: d.source.confidence, reviewer: d.source.reviewer, history: d.source.history ?? [] };
      const canonique = Source.safeParse(projection);
      if (!canonique.success || jsonCanonique(pays.source) !== jsonCanonique(canonique.data ?? projection)) {
        echec(`${id} — la source d'objects.json n'est PAS la projection canonique exacte du SourcedQuote promu`);
      }
    }
  }
}

/* ---- verdict --------------------------------------------------------------------------------- */
if (ecarts.length) {
  process.stderr.write(`[audit] ÉCHEC — ${ecarts.length} écart(s) :\n`);
  for (const e of ecarts.slice(0, 40)) process.stderr.write(`  · ${e}\n`);
  if (ecarts.length > 40) process.stderr.write(`  … et ${ecarts.length - 40} autre(s).\n`);
  process.exit(1);
}
const total = Object.values(audits).reduce((n, a) => n + a.candidates.length, 0);
const promues = Object.values(audits).filter((a) => a.decision.statut === "promue").length;
process.stdout.write(`[audit] matrice conforme — 18 pays · ${total} candidates (bijection triplet) · ${promues} promue(s) · ` +
  `${18 - promues} sans source officielle · pièces prouvées, contrats canoniques tenus (${asOf}).\n`);
