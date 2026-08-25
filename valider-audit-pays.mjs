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
 *   · PIÈCES PROUVÉES — tout fichier référencé est sous `audit-pays-pieces/`, RÉGULIER (pas
 *     un lien symbolique), SUIVI par git (`git ls-files --error-unmatch`), SHA-256 de 64 hexa
 *     égal au contenu ;
 *   · EXTRAITS ANCRÉS — toute consultation scelle sa CAPTURE BRUTE, son TEXTE DÉRIVÉ et la
 *     VERSION de l'extracteur déterministe (`extraire-texte-lot-a.mjs` — HTML ; PDF → chaîne
 *     vide PAR CONSTRUCTION depuis lot-a-4, ni décompressé ni analysé). Le
 *     validateur RE-DÉRIVE le texte depuis le brut et exige l'égalité d'empreinte, puis
 *     recherche l'extrait dans CE texte. L'extrait lui-même : au moins dix caractères
 *     SIGNIFICATIFS après normalisation (un extrait fait de balises se normalise en vide, et
 *     le vide s'ancre partout — refusé), et AUCUN balisage dans l'extrait ;
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
 *   · LES MANIFESTES FONT FOI DE L'OBSERVATION, ET ILS SONT PLUSIEURS ET IMMUABLES — chaque
 *     candidate et chaque preuve référencent un résultat par RÉFÉRENCE COMPOSITE
 *     { manifeste, manifeste_sha256, n } : le manifeste doit exister, son empreinte courante
 *     doit égaler l'empreinte référencée, et n se résout DANS CE MANIFESTE seulement (jamais
 *     par numéro nu). Tous les champs OBSERVÉS doivent être ÉGAUX au résultat référencé.
 *     Chaque manifeste garde son ensemble exact (n contigus, bijection, inventaire de son
 *     run) ; l'union des candidates = exactement les couples publiés ; la concaténation des
 *     rattachements = exactement la liste cumulative (contre-revue du second passage) ;
 *   · AUCUNE PREUVE TEXTUELLE DEPUIS UN PDF en lot-a-1 — l'extracteur produit des mots
 *     éclatés sur les PDF réels : le brut est conservé, mais ni pièce `extrait`, ni preuve
 *     de rattachement, ni candidate décisive ne peuvent venir d'un PDF ;
 *   · TOUT RÉSULTAT DU MANIFESTE RESTE CONTRE-VÉRIFIABLE, décision ou pas — consultation :
 *     brut, texte dérivé, en-têtes et trace prouvés ; tentative : trace prouvée. La liste
 *     versionnée des rattachements passe le SCHÉMA STRICT PARTAGÉ avec le collecteur
 *     (`liste-rattachements-lot-a.mjs`), et une preuve de rattachement vise une observation
 *     de RÔLE « rattachement » — jamais une candidate ordinaire (contre-revue v5-quinquies) ;
 *   · L'INVENTAIRE DU RUN EST UNE BIJECTION — chaque pièce appartient à UN SEUL couple
 *     (résultat n, champ), aucune pièce orpheline, et `capture.octets` est OBLIGATOIRE,
 *     borné par la limite partagée (25 MiB) et ÉGAL à la taille réelle du fichier
 *     (contre-revue v5-septies).
 *
 * Sortie 0 si tout tient ; 1 au premier lot d'écarts, chacun nommé (pays, candidate, champ) ;
 * 2 si --as-of manque ou n'existe pas.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { Source } from "./packages/knowledge/src/common.ts";
import { reviewDueFrom } from "./packages/knowledge/src/common.ts";
import { SourcedQuote } from "./packages/knowledge/src/breed-restrictions.ts";
import { normaliser } from "./extraire-texte-lot-a.mjs";
import { estUrlHttp } from "./liste-rattachements-lot-a.mjs";
import { verifierBase } from "./verifier-base-lot-a.mjs";

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
/* Le contrat HTTP(S) PARTAGÉ (liste, collecteur, validateur) : `z.string().url()` accepte
 * `file://` — pas ce schéma (contre-revue v5-sexies). */
const UrlHttp = z.string().refine(estUrlHttp, { message: "URL au contrat HTTP(S) partagé exigée (http/https, hôte non vide)" });
const LT = z.object({ en: z.string(), fr: z.string(), es: z.string().optional(), pt: z.string().optional() }).strict();
const Langue = z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/);
const Sha256 = z.string().regex(/^[0-9a-f]{64}$/, "SHA-256 de 64 caractères hexadécimaux attendu");
const Fichier = z.object({ chemin: z.string().min(1), sha256: Sha256 }).strict();
const CaptureScellee = z.object({
  chemin: z.string().min(1), sha256: Sha256,
  content_type: z.string().min(1),
  format_detecte: z.enum(["pdf", "html", "autre"]),
  texte_derive: Fichier,
  extracteur: z.string().min(1),
}).strict();

const PieceExtrait = z.object({ type: z.literal("extrait"), extrait: z.string().min(10), langue: Langue, locator: z.string().min(1) }).strict()
  .refine((p) => normaliser(p.extrait).length >= 10, { message: "moins de dix caractères SIGNIFICATIFS après normalisation — le vide s'ancre partout", path: ["extrait"] })
  .refine((p) => !/<[^>]*>/.test(p.extrait), { message: "balisage refusé dans l'extrait — l'extrait est du texte, pas du HTML", path: ["extrait"] });
const PieceCapture = z.object({ type: z.literal("capture"), chemin: z.string().min(1), sha256: Sha256 }).strict();
const Trace = z.object({ type: z.enum(["transcript", "capture"]), chemin: z.string().min(1), sha256: Sha256 }).strict();

const NatureEditeur = z.enum(["autorite_pays", "mission_diplomatique_pays", "officiel_tiers", "non_officiel", "non_etabli"]);
const Pertinence = z.enum(["etaye_le_fait", "partielle", "page_generique", "hors_sujet", "non_evaluee"]);

/* L'ATTESTATION D'ANNUAIRE : la pièce structurée qui prouve le DOMAINE d'une candidate quand
 * le lien n'est pas ancrable en texte dérivé (contre-revue des 18 décisions : la fiche de
 * l'annuaire fidjien porte « website » dans un blob JSON de <script>, que l'extracteur ôte —
 * remplacer baf.com.fj par bad.com.fj dans la capture brute, empreintes recalculées, sortait
 * en 0). Le validateur lit la CAPTURE BRUTE de l'observation et exige mécaniquement les trois
 * champs EXACTS — organisationName, organisationTypeCode, website — et l'unicité du champ
 * website ; puis l'égalité d'hôte avec la candidate. */
const AttestationAnnuaire = z.object({
  organisation: z.string().min(1),
  type_organisation: z.string().min(1),
  site_web: UrlHttp,
}).strict();
/* La VALIDATION ÉDITORIALE HUMAINE de l'identité d'éditeur (arbitrage du 25/08/2026 —
 * recalibrage de la profondeur d'audit : pas d'infrastructure de parseurs par site
 * institutionnel). Elle enregistre QUI a validé, QUAND et POURQUOI, sur QUELLE observation
 * (celle de la preuve qui la porte). Elle ne peut attester QUE l'identité de l'éditeur :
 * le FAIT MÉTIER reste obligatoirement porté par l'extrait ancré de la page source —
 * aucune garde mécanique (ancre, concordance, pièce EXTRAIT, rôle, capture scellée)
 * n'est levée par une validation humaine.
 * LA VALIDATION NOMME CE QU'ELLE VALIDE (contre-revue de v5-sexdecies, attaque reproduite :
 * la preuve conçue pour customs.gov.om recopiée sur gov.om passait) : éditeur, site et
 * nature validés sont des CHAMPS STRUCTURÉS — l'hôte du site validé doit être exactement
 * celui de la candidate, la nature validée exactement celle que la matrice déclare, et
 * AUCUN domaine ne se déduit du texte libre du motif. */
const ValidationEditeur = z.object({
  validateur: z.string().min(1),
  date: DateISO,
  motif: z.string().min(10),
  editeur: z.string().min(1),
  site_web: UrlHttp,
  nature_validee: NatureEditeur,
}).strict();
/* La RÉFÉRENCE COMPOSITE : une observation se désigne par (manifeste, empreinte du manifeste,
 * n) — jamais par un numéro nu, qui redeviendrait ambigu entre manifestes ; l'empreinte rend
 * chaque manifeste publié IMMUABLE (contre-revue du second passage). */
const ReferenceObservation = z.object({
  manifeste: z.string().regex(/^audit-pays-consultations(-\d+)?\.json$/),
  manifeste_sha256: Sha256,
  n: z.number().int().min(1),
}).strict();
const PreuveRattachement = z.object({ observation: ReferenceObservation, citation: z.unknown(), capture: CaptureScellee,
  attestation_annuaire: AttestationAnnuaire.optional(),
  validation_editeur: ValidationEditeur.optional() }).strict();

const CandidateConsultee = z.object({
  observation: ReferenceObservation,         // l'identité composite de l'observation
  label: LT,
  url_publiee: UrlHttp,
  acces: z.literal("consultee"),
  url_finale: UrlHttp,
  statut_http: z.number().int().min(200).max(299),
  consultee_le: DateISO,
  capture: CaptureScellee,                   // brut + texte dérivé + version d'extracteur, scellés ensemble
  entetes: Fichier,                          // la copie canonique EXPURGÉE des en-têtes corrélés
  trace: Trace,
  piece: z.union([PieceExtrait, PieceCapture]),
  captures_complementaires: z.array(Fichier).optional(),
  nature_editeur: NatureEditeur,
  preuves_rattachement: z.array(PreuveRattachement).default([]),
  pertinence: Pertinence,
}).strict();

const CandidateTentative = z.object({
  observation: ReferenceObservation,
  label: LT,
  url_publiee: UrlHttp,
  acces: z.literal("tentative"),
  tentee_le: DateISO,
  resultat: z.string().min(1),
  trace: Trace,
  nature_editeur: NatureEditeur,
  preuves_rattachement: z.array(PreuveRattachement).default([]),
  pertinence: z.literal("non_evaluee"),
}).strict();

const Candidate = z.discriminatedUnion("acces", [CandidateConsultee, CandidateTentative]);

const DecisionPromue = z.object({
  statut: z.literal("promue"),
  observation_decisive: z.number().int().min(0),
  source: z.unknown(),               // SourcedQuote — validé par le contrat canonique ci-dessous
}).strict();
/* ÉTAPE 4 : cette constante passera à true LORS de l'application des promotions — la règle
 * devient alors INCONDITIONNELLE : toute décision promue DOIT avoir sa projection exacte
 * dans objects.json, et la supprimer rougit. Aucun interrupteur dans les DONNÉES : un
 * marqueur par décision se retirait avec la source (contre-revue des 18 décisions) ; le
 * passage à l'étape 4 est un changement de CODE, sous contre-revue, porté par la CI. */
const PROJECTION_INCONDITIONNELLE = true;
const DecisionSans = z.object({
  statut: z.literal("aucune_source_officielle"),
  motif: z.string().min(10),
}).strict();
/* Le statut HONNÊTE quand l'audit ne peut pas conclure DANS CE RUN : rattachements non
 * instruits alors qu'une candidate étaye le fait, ou aucune page consultée — « aucune source
 * officielle » affirmerait une absence que les pièces ne montrent pas (contre-revue des 18
 * décisions, cas des Maldives). */
const DecisionNonConcluante = z.object({
  statut: z.literal("aucune_source_promouvable_dans_ce_run"),
  motif: z.string().min(10),
}).strict();

const EntreePays = z.object({
  audite_par: z.string().min(1),
  audite_le: DateISO,
  candidates: z.array(Candidate).min(1),
  decision: z.discriminatedUnion("statut", [DecisionPromue, DecisionSans, DecisionNonConcluante]),
}).strict();

/* Chaque observation de rattachement du manifeste reçoit EXACTEMENT UNE décision éditoriale :
 * `utilisee` (liée à au moins une preuve) ou `ecartee` (motif obligatoire, citée par aucune
 * preuve) — un PDF réussi ou un échec réseau légitime s'ÉCARTENT, ils ne bloquent pas la
 * matrice (contre-revue v5-quater). */
const DecisionRattachement = z.discriminatedUnion("statut", [
  z.object({ statut: z.literal("utilisee") }).strict(),
  z.object({ statut: z.literal("ecartee"), motif: z.string().min(10) }).strict(),
  /* l'état LÉGAL de la collecte brute : observé, pas encore instruit — compté, jamais
   * silencieux ; jamais une preuve ; refusé par --exiger-audit-complet (contre-revue du
   * second passage : la séquence approuvée collecte D'ABORD, juge APRÈS l'extension du
   * contrat de preuve). */
  z.object({ statut: z.literal("a_instruire") }).strict(),
]);
const Matrice = z.object({
  audits: z.record(z.string(), EntreePays),
  rattachements: z.record(z.string(), DecisionRattachement),
}).strict();

/* ---- chargements ----------------------------------------------------------------------------- */
const lire = (p) => JSON.parse(readFileSync(p, "utf-8"));
let matriceBrute;
try { matriceBrute = lire(MATRICE); }
catch { process.stderr.write(`[audit] ÉCHEC : ${MATRICE} introuvable ou illisible — jamais vert faute de matière.\n`); process.exit(1); }
const scelle = lire(SCELLE);
const guides = lire("packages/ui/src/data/countries.generated.json");
const objets = lire("packages/knowledge/raw/objects.json");
const CONTRACTUELS = Object.keys(scelle.pays);
/* ---- LA BASE PARTAGÉE : manifestes immuables, pièces prouvées, curation scellée -------------
 * (verifier-base-lot-a.mjs — LE MÊME code sert de préflight au collecteur, contre-revue du
 * second passage). Elle rend les manifestes chargés, le compte en attente et les OUTILS de
 * preuve liés au même puits d'écarts. */
const base = verifierBase(echec);
const { manifestes, parNomManifeste, rattachementsEnAttente, fichierProuve, captureProuvee, formatReel } = base;

const nsVus = new Set();
const nsRattachementExerces = new Set();
const cleRef = (ref) => `${ref.manifeste}#${ref.n}`;
/** Résout une RÉFÉRENCE COMPOSITE : le manifeste doit exister, son empreinte courante doit
 *  égaler l'empreinte référencée (immuabilité — supprimer ou modifier un manifeste encore
 *  référencé rougit), et n se résout DANS CE MANIFESTE seulement. */
const resoudre = (contexte, ref) => {
  const man = parNomManifeste.get(ref.manifeste);
  if (!man) {
    echec(`${contexte} : manifeste référencé « ${ref.manifeste} » INTROUVABLE — un manifeste encore référencé ne se supprime pas`);
    return null;
  }
  if (man.sha256 !== ref.manifeste_sha256) {
    echec(`${contexte} : empreinte courante de « ${ref.manifeste} » ≠ empreinte référencée — un manifeste publié est IMMUABLE (modifié à chemin constant ?)`);
    return null;
  }
  const r = man.parN.get(ref.n);
  if (!r) {
    echec(`${contexte} : n ${ref.n} ne désigne aucun résultat du manifeste « ${ref.manifeste} » — la résolution est PAR MANIFESTE, jamais par numéro nu`);
    return null;
  }
  return r;
};
/* Par candidate : le DOMAINE est-il prouvé (citation ancrée portant l'hôte, ou attestation
 * d'annuaire vérifiée sur la capture brute) ? Toute PROMOTION l'exige pour sa décisive. */
const domaineProuveParCandidate = new Set();
const hote = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; } };
/** Extrait et parse l'objet JSON passé à initMinisterDetailPlaceholder(...) dans une capture
 *  d'annuaire gouvernemental fidjien : balayage d'accolades équilibrées (chaînes et
 *  échappements respectés) puis JSON.parse — les trois champs attestés se lisent dans le
 *  MÊME sous-arbre organisationDetails, jamais par sous-chaînes éparses (contre-revue :
 *  une occurrence homonyme dans personnelList suffisait à maintenir le vert). Retourne null
 *  si le marqueur est absent, AMBIGU (plus d'une occurrence) ou imparsable. */
const annuaireDe = (brut) => {
  const texte = brut.toString("utf-8");
  const marque = "initMinisterDetailPlaceholder";
  const i = texte.indexOf(marque);
  if (i < 0 || texte.indexOf(marque, i + 1) >= 0) return null;
  const j = texte.indexOf("(", i);
  if (j < 0 || texte[j + 1] !== "{") return null;
  let k = j + 1, prof = 0, chaine = false, esc = false;
  for (; k < texte.length; k++) {
    const ch = texte[k];
    if (chaine) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') chaine = false; }
    else if (ch === '"') chaine = true;
    else if (ch === "{") prof++;
    else if (ch === "}") { prof--; if (prof === 0) break; }
  }
  if (prof !== 0) return null;
  try { return JSON.parse(texte.slice(j + 1, k + 1)); } catch { return null; }
};

const parseMatrice = Matrice.safeParse(matriceBrute);
if (!parseMatrice.success) {
  /* Un schéma en défaut ARRÊTE la vérification : continuer sur une matrice difforme
   * produirait des diagnostics dérivés d'une forme qu'on vient de refuser. */
  process.stderr.write(`[audit] ÉCHEC — schéma de la matrice refusé (${parseMatrice.error.issues.length} défaut(s)) :\n`);
  for (const i of parseMatrice.error.issues.slice(0, 30)) {
    process.stderr.write(`  · schéma — ${i.path.join(".") || "(racine)"} : ${i.message}\n`);
  }
  process.exit(1);
}
const audits = matriceBrute.audits ?? {};

/* ---- 17-18 · la matrice couvre exactement les 18, bijection TRIPLET par pays ----------------- */
const idsMatrice = Object.keys(audits).sort();
if (JSON.stringify(idsMatrice) !== JSON.stringify([...CONTRACTUELS].sort())) {
  echec(`périmètre — pays en trop [${idsMatrice.filter((x) => !CONTRACTUELS.includes(x)).join(", ")}] · ` +
    `manquants [${CONTRACTUELS.filter((x) => !idsMatrice.includes(x)).join(", ")}]`);
}

const canon = (x) => JSON.stringify(x, Object.keys(x ?? {}).sort ? undefined : undefined);
function jsonCanonique(x) {
  if (Array.isArray(x)) return "[" + x.map(jsonCanonique).join(",") + "]";
  if (x && typeof x === "object") return "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + jsonCanonique(x[k])).join(",") + "}";
  return JSON.stringify(x);
}

const dansFenetre = (d, pays, quoi) => {
  if (typeof d === "string" && dateExiste(d) && d > asOf) echec(`${pays} — ${quoi} « ${d} » est POSTÉRIEURE à --as-of=${asOf}`);
};

/** L'extrait doit se RETROUVER dans le TEXTE DÉRIVÉ/** L'extrait doit se RETROUVER dans le TEXTE DÉRIVÉ — sinon il est inventé, ou la page a changé. */
const ancre = (pays, quoi, extrait, cap) => {
  let texte;
  try { texte = readFileSync(cap.texte_derive.chemin, "utf-8"); }
  catch { return; /* l'existence est déjà jugée */ }
  const cible = normaliser(extrait);
  if (cible.length < 10) {
    echec(`${pays} — ${quoi} : moins de dix caractères SIGNIFICATIFS après normalisation — le vide s'ancre partout`);
    return;
  }
  if (!normaliser(texte).includes(cible)) {
    echec(`${pays} — ${quoi} : l'extrait est INTROUVABLE dans le texte dérivé « ${cap.texte_derive.chemin} » — citation inventée ou page changée`);
  }
};

/* ---- par pays --------------------------------------------------------------------------------/* ---- par pays -------------------------------------------------------------------------------- */
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

    /* LE MANIFESTE FAIT FOI : l'observation de la matrice doit être CELLE du manifeste,
     * champ à champ — la matrice n'ajoute que le jugement. */
    const res = resoudre(`${id} — ${qui}`, c.observation);
    if (!res) continue;
    if (nsVus.has(cleRef(c.observation))) echec(`${id} — ${qui} : observation ${cleRef(c.observation)} déjà utilisée par une autre candidate`);
    nsVus.add(cleRef(c.observation));
    const observe = (champ, matrice, mani) => {
      if (jsonCanonique(matrice) !== jsonCanonique(mani)) {
        echec(`${id} — ${qui} : « ${champ} » ≠ manifeste (matrice ${jsonCanonique(matrice)?.slice(0, 60)} · manifeste ${jsonCanonique(mani)?.slice(0, 60)}) — observation réécrite hors manifeste`);
      }
    };
    if (res.role !== "candidate") echec(`${id} — ${qui} : l'observation ${cleRef(c.observation)} est de rôle « ${res.role} », pas une candidate`);
    if (res.country_id !== id || res.index_lien !== i) {
      echec(`${id} — ${qui} : l'observation ${cleRef(c.observation)} appartient à ${res.country_id}[${res.index_lien}], pas à ${id}[${i}]`);
    }
    observe("label", c.label, res.label);
    observe("url_publiee", c.url_publiee, res.url_publiee);
    observe("acces", c.acces, res.acces);
    if (c.acces === "consultee" && res.acces === "consultee") {
      observe("statut_http", c.statut_http, res.statut_http);
      observe("url_finale", c.url_finale, res.url_finale);
      observe("consultee_le", c.consultee_le, res.consultee_le);
      observe("content_type", c.capture?.content_type, res.content_type);
      const capMani = res.capture ? { chemin: res.capture.chemin, sha256: res.capture.sha256,
        content_type: res.capture.content_type, format_detecte: res.capture.format_detecte,
        texte_derive: res.capture.texte_derive, extracteur: res.capture.extracteur } : null;
      observe("capture", c.capture, capMani);
      observe("entetes", c.entetes, res.entetes);
      observe("trace", c.trace, res.trace);
    } else if (c.acces === "tentative" && res.acces === "tentative") {
      observe("tentee_le", c.tentee_le, res.tentee_le);
      observe("resultat", c.resultat, res.resultat);
      observe("trace", c.trace, res.trace);
    }

    /* AUCUNE PREUVE TEXTUELLE DEPUIS UN PDF (lot-a-1) : l'extracteur produit des mots éclatés
     * sur les PDF réels — le brut est conservé, le texte n'y fait pas preuve. */
    const estPdf = c.acces === "consultee" && formatReel(c.capture) === "pdf";
    if (estPdf && c.piece?.type === "extrait") {
      echec(`${id} — ${qui} : pièce EXTRAIT depuis un PDF — interdit en lot-a-1 (texte dérivé non fiable), la pièce d'un PDF est sa capture`);
    }
    if (c.acces === "consultee") {
      dansFenetre(c.consultee_le, id, `${qui} consultee_le`);
      if (a.audite_le < c.consultee_le) echec(`${id} — audite_le « ${a.audite_le} » antérieure à la consultation ${qui}`);
      if (c.capture?.chemin) {
        captureProuvee(id, `${qui} capture`, c.capture);
        if (c.piece?.type === "extrait" && formatReel(c.capture) !== "pdf") {
          ancre(id, `${qui} pièce extrait`, c.piece.extrait, c.capture);
        }
      }
      if (c.entetes?.chemin) fichierProuve(id, `${qui} en-têtes`, c.entetes.chemin, c.entetes.sha256);
      if (c.trace?.chemin) fichierProuve(id, `${qui} trace`, c.trace.chemin, c.trace.sha256);
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
      /* LE RATTACHEMENT AUSSI VIENT DU MANIFESTE : une preuve dont l'URL ne correspond à
       * aucune observation collectée autoriserait autorite_pays — donc la promotion — sur
       * une pièce inventée (contre-revue v5-ter). */
      const obs = resoudre(`${id} — ${qui} preuve de rattachement [${j}]`, p.observation);
      if (!obs) {
        /* échec déjà nommé par la résolution composite */
      } else {
        /* Le RÔLE est exigé explicitement : une preuve de rattachement qui vise une candidate
         * ordinaire contourne toute la liste versionnée — citation et capture peuvent concorder
         * avec la candidate, seule cette garde le voit (contre-revue v5-quinquies). */
        if (obs.role !== "rattachement") {
          echec(`${id} — ${qui} preuve de rattachement [${j}] : l'observation ${cleRef(p.observation)} est de rôle « ${obs.role} » — ` +
            `une preuve de rattachement vise une observation de RÔLE rattachement, la liste versionnée ne se contourne pas`);
        } else {
          nsRattachementExerces.add(cleRef(p.observation));
        }
        if (obs.acces !== "consultee") echec(`${id} — ${qui} preuve de rattachement [${j}] : l'observation ${cleRef(p.observation)} n'est pas une consultation`);
        else {
          if (p.citation?.url !== obs.url_finale) {
            echec(`${id} — ${qui} preuve de rattachement [${j}] : citation.url « ${p.citation?.url} » ≠ url_finale observée « ${obs.url_finale} » — rattachement hors manifeste`);
          }
          if (p.citation?.verified_date !== obs.consultee_le) {
            echec(`${id} — ${qui} preuve de rattachement [${j}] : verified_date « ${p.citation?.verified_date} » ≠ consultee_le observée « ${obs.consultee_le} »`);
          }
          const capObs = obs.capture ? { chemin: obs.capture.chemin, sha256: obs.capture.sha256,
            content_type: obs.capture.content_type, format_detecte: obs.capture.format_detecte,
            texte_derive: obs.capture.texte_derive, extracteur: obs.capture.extracteur } : null;
          if (jsonCanonique(p.capture) !== jsonCanonique(capObs)) {
            echec(`${id} — ${qui} preuve de rattachement [${j}] : la capture ne correspond pas à l'observation ${cleRef(p.observation)}`);
          }
        }
      }
      const r = SourcedQuote.safeParse(p.citation);
      if (!r.success) {
        echec(`${id} — ${qui} preuve de rattachement [${j}] rejetée par SourcedQuote : ${r.error.issues.map((x) => `${x.path.join(".")} — ${x.message}`).slice(0, 3).join(" · ")}`);
      } else {
        dansFenetre(p.citation.verified_date, id, `${qui} preuve de rattachement [${j}] verified_date`);
      }
      /* Chaque preuve de rattachement est LIÉE à sa propre capture scellée, et sa citation s'y retrouve. */
      captureProuvee(id, `${qui} capture de rattachement [${j}]`, p.capture);
      if (formatReel(p.capture) === "pdf") {
        echec(`${id} — ${qui} preuve de rattachement [${j}] depuis un PDF — interdit en lot-a-1`);
      } else if (typeof p.citation?.quote === "string") {
        ancre(id, `${qui} citation de rattachement [${j}]`, p.citation.quote, p.capture);
      }
      /* Le DOMAINE de la candidate ne se prouve QUE par ATTESTATION D'ANNUAIRE vérifiée —
       * qu'une citation MENTIONNE un hôte ne prouve pas son attribution (contre-revue).
       * L'attestation se vérifie dans le MÊME objet organisationDetails du JSON parsé de la
       * capture brute : nom, type et website du même sous-arbre — une occurrence homonyme
       * ailleurs (personnelList) ne compte pas ; remplacer le domaine, ou le nom du seul
       * organisationDetails, rougit même empreintes rescellées. */
      const hoteCandidate = hote(c.acces === "consultee" ? c.url_finale : c.url_publiee);
      if (p.attestation_annuaire) {
        const att = p.attestation_annuaire;
        let brut = null;
        try { brut = readFileSync(p.capture.chemin); } catch { /* déjà jugé par la preuve de fichier */ }
        const annuaire = brut === null ? null : annuaireDe(brut);
        const od = annuaire?.organisationDetails;
        if (brut !== null && (!od || typeof od !== "object")) {
          echec(`${id} — ${qui} attestation d'annuaire [${j}] : l'objet initMinisterDetailPlaceholder(...) est absent, ambigu ou imparsable dans la capture brute`);
        } else if (od) {
          const okNom = od.organisationName === att.organisation;
          const okType = od.organisationTypeCode === att.type_organisation;
          const okSite = od.organisationData?.website === att.site_web;
          if (!okNom || !okType || !okSite) {
            echec(`${id} — ${qui} attestation d'annuaire [${j}] : le MÊME objet organisationDetails ne porte pas les champs attestés ` +
              `(organisationName ${okNom ? "oui" : "NON"} · organisationTypeCode ${okType ? "oui" : "NON"} · organisationData.website ${okSite ? "oui" : "NON"})`);
          } else if (!hoteCandidate || hote(att.site_web) !== hoteCandidate) {
            echec(`${id} — ${qui} attestation d'annuaire [${j}] : site attesté « ${att.site_web} » ≠ domaine de la candidate « ${hoteCandidate ?? "?"} »`);
          } else {
            domaineProuveParCandidate.add(`${id}#${i}`);
          }
        }
      }
      /* La VALIDATION ÉDITORIALE HUMAINE : seconde voie de preuve d'identité d'éditeur —
       * datée, motivée, nominative, portée par une preuve COMPLÈTE (observation de rôle
       * rattachement, consultée ; citation ancrée et capture concordante restent exigées
       * par les gardes ci-dessus, qu'aucune validation ne lève). Elle n'atteste que
       * l'identité : la pièce décisive, l'ancre et la concordance portent seules le fait. */
      if (p.validation_editeur) {
        const val = p.validation_editeur;
        dansFenetre(val.date, id, `${qui} validation éditoriale [${j}] date`);
        if (!(obs && obs.role === "rattachement" && obs.acces === "consultee")) {
          echec(`${id} — ${qui} validation éditoriale [${j}] : une validation d'identité d'éditeur ne porte que sur une observation de rattachement CONSULTÉE — elle ne remplace ni une observation ni le fait métier`);
        } else {
          let saine = true;
          /* une validation FONDÉE sur une observation ne peut pas la précéder */
          if (val.date < obs.consultee_le) {
            echec(`${id} — ${qui} validation éditoriale [${j}] : datée « ${val.date} », ANTÉRIEURE à la consultation de son observation « ${obs.consultee_le} » — on ne valide pas ce qu'on n'a pas encore observé`);
            saine = false;
          }
          /* la validation nomme ce qu'elle valide : hôte EXACT, nature EXACTE — jamais
           * réutilisable pour un autre éditeur que celui arbitré */
          if (!hoteCandidate || hote(val.site_web) !== hoteCandidate) {
            echec(`${id} — ${qui} validation éditoriale [${j}] : site validé « ${val.site_web} » ≠ domaine de la candidate « ${hoteCandidate ?? "?"} » — une validation nomme ce qu'elle valide, elle ne se réutilise pas`);
            saine = false;
          }
          if (val.nature_validee !== c.nature_editeur) {
            echec(`${id} — ${qui} validation éditoriale [${j}] : nature validée « ${val.nature_validee} » ≠ nature déclarée de la candidate « ${c.nature_editeur} » — l'identité validée ne se transpose pas`);
            saine = false;
          }
          if (saine) domaineProuveParCandidate.add(`${id}#${i}`);
        }
      }
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
    if (c.acces === "consultee" && formatReel(c.capture) === "pdf") {
      echec(`${id} — la candidate décisive est un PDF — aucune preuve décisive depuis un PDF en lot-a-1`);
    }
    /* Le DOMAINE de la décisive se prouve — être une autorité ne prouve pas posséder le site
     * (contre-revue des 18 décisions : bad.com.fj passait). */
    if (!domaineProuveParCandidate.has(`${id}#${d.observation_decisive}`)) {
      echec(`${id} — promotion : le DOMAINE de la candidate décisive n'est PAS prouvé — aucune attestation d'annuaire ` +
        `vérifiée ni validation éditoriale humaine ne lui attribue l'identité de son éditeur ` +
        `(mentionner un hôte dans une citation ne prouve pas son attribution)`);
    }

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
  } else if (d.statut === "aucune_source_officielle" || d.statut === "aucune_source_promouvable_dans_ce_run") {
    const eligible = (a.candidates ?? []).find((c) =>
      c.acces === "consultee" && c.nature_editeur === "autorite_pays" && c.pertinence === "etaye_le_fait");
    if (eligible) echec(`${id} — « ${d.statut} » alors qu'une candidate ÉLIGIBLE existe : ${eligible.url_publiee}`);
    if (d.statut === "aucune_source_officielle") {
      /* « Aucune source officielle » AFFIRME une absence : elle est interdite tant que le
       * rattachement d'une candidate qui étaye le fait n'est pas instruit, et interdite sans
       * aucune page consultée (contre-revue des 18 décisions — l'absence ne se conclut pas
       * de zéro lecture). Le statut honnête est aucune_source_promouvable_dans_ce_run. */
      const nonInstruite = (a.candidates ?? []).find((c) =>
        c.acces === "consultee" && c.pertinence === "etaye_le_fait" && c.nature_editeur === "non_etabli");
      if (nonInstruite) {
        echec(`${id} — « aucune_source_officielle » alors que « ${nonInstruite.url_publiee} » ÉTAYE LE FAIT sans nature instruite — ` +
          `rattachement non instruit : le statut honnête est aucune_source_promouvable_dans_ce_run`);
      }
      if ((a.candidates ?? []).filter((c) => c.acces === "consultee").length === 0) {
        echec(`${id} — « aucune_source_officielle » sans AUCUNE consultation — zéro page lue ne conclut pas à l'absence ; ` +
          `le statut honnête est aucune_source_promouvable_dans_ce_run`);
      }
      /* Et AUCUNE candidate ne doit rester INCONNUE : une tentative, ou une pertinence
       * non_evaluee, laisse un trou dans l'instruction — conclure « aucune source » par-dessus
       * est une surqualification (contre-revue : les Seychelles). */
      const inconnue = (a.candidates ?? []).find((c) => c.acces === "tentative" || c.pertinence === "non_evaluee");
      if (inconnue) {
        echec(`${id} — « aucune_source_officielle » alors que « ${inconnue.url_publiee} » reste INCONNUE ` +
          `(${inconnue.acces === "tentative" ? "tentative sans consultation" : "pertinence non_evaluee"}) — ` +
          `l'absence ne se conclut pas avec des candidates non évaluées ; le statut honnête est aucune_source_promouvable_dans_ce_run`);
      }
    }
  }

  /* ---- 27/31 · projection dans objects.json : jamais sans la matrice, jamais différente ;
   *      et BIDIRECTIONNELLE dès qu'une promotion est déclarée APPLIQUÉE ------------------------ */
  const pays = objets.countries.find((x) => x.id === id);
  if (d.statut === "promue" && PROJECTION_INCONDITIONNELLE && !pays?.source) {
    echec(`${id} — promotion SANS PROJECTION dans objects.json — à l'étape 4 la projection est OBLIGATOIRE et bidirectionnelle, la supprimer rougit`);
  }
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

/* ---- chaque résultat du manifeste a un ÉTAT LÉGAL : jugé (candidate) ou DÉCIDÉ (rattachement).
 * Un PDF réussi, un échec réseau, une pièce non pertinente s'ÉCARTENT avec motif — ils ne
 * rendent pas la matrice invalidable (contre-revue v5-quater). */
const decisionsRattachement = matriceBrute.rattachements ?? {};
const clesRattachementConnues = new Set();
let aInstruire = 0;
for (const m of manifestes) {
  for (const r of m.donnees.resultats ?? []) {
    const cle = `${m.nom}#${r.n}`;
    if (r.role === "candidate" && !nsVus.has(cle)) {
      echec(`${m.nom} — n ${r.n} (candidate ${r.country_id}[${r.index_lien}]) n'est référencé par aucune candidate de la matrice — résultat sans jugement`);
    }
    if (r.role === "rattachement") {
      clesRattachementConnues.add(cle);
      const d = decisionsRattachement[cle];
      if (!d) {
        echec(`${m.nom} — n ${r.n} (rattachement ${r.url_demandee}) SANS DÉCISION éditoriale — utilisee ou ecartee, rien d'implicite (clé « ${cle} »)`);
      } else if (d.statut === "utilisee" && !nsRattachementExerces.has(cle)) {
        echec(`matrice — rattachement ${cle} déclaré UTILISÉ mais cité par aucune preuve`);
      } else if (d.statut === "ecartee" && nsRattachementExerces.has(cle)) {
        echec(`matrice — rattachement ${cle} déclaré ÉCARTÉ mais cité par une preuve — les deux ne se cumulent pas`);
      } else if (d.statut === "a_instruire") {
        aInstruire++;
        if (nsRattachementExerces.has(cle)) {
          echec(`matrice — rattachement ${cle} déclaré À INSTRUIRE mais cité par une preuve — l'instruction précède tout usage probatoire`);
        }
      }
    }
  }
}
/* Aucune décision orpheline : les clés de matrice.rattachements = exactement les couples
 * composites « <manifeste>#<n> » des observations de rôle rattachement. */
for (const cle of Object.keys(decisionsRattachement)) {
  if (!clesRattachementConnues.has(cle)) {
    echec(`matrice — décision de rattachement « ${cle} » ne correspond à aucune observation de rattachement d'aucun manifeste`);
  }
}

/* ---- mode FINAL : --exiger-audit-complet refuse tout reste à instruire ou à collecter -------- */
if (process.argv.includes("--exiger-audit-complet")) {
  if (aInstruire > 0) echec(`audit incomplet — ${aInstruire} observation(s) de rattachement encore À INSTRUIRE (mode --exiger-audit-complet)`);
  if (rattachementsEnAttente > 0) echec(`audit incomplet — ${rattachementsEnAttente} rattachement(s) encore EN ATTENTE de collecte (mode --exiger-audit-complet)`);
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
const sans = Object.values(audits).filter((a) => a.decision.statut === "aucune_source_officielle").length;
const nonConcluantes = Object.values(audits).filter((a) => a.decision.statut === "aucune_source_promouvable_dans_ce_run").length;
process.stdout.write(`[audit] matrice conforme — 18 pays · ${total} candidates (bijection triplet) · ${promues} promue(s) · ` +
  `${sans} sans source officielle · ${nonConcluantes} non promouvable(s) dans ce run · ${manifestes.length} manifeste(s)` +
  `${aInstruire ? ` · ${aInstruire} rattachement(s) À INSTRUIRE` : ""}` +
  `${rattachementsEnAttente ? ` · ${rattachementsEnAttente} rattachement(s) EN ATTENTE de collecte` : ""} · ` +
  `pièces prouvées, contrats canoniques tenus (${asOf}).\n`);
