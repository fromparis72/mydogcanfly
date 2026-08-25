/**
 * LOT A — LA VÉRIFICATION DE BASE PARTAGÉE : manifestes immuables, pièces prouvées, curation
 * scellée. LE MÊME CODE sert de préflight au collecteur (`--rattachements-seulement`, AVANT
 * tout appel réseau et toute création de run) et de socle au validateur permanent — la
 * contre-revue du second passage a montré qu'un collecteur qui « parse et compte » sans
 * vérifier pouvait collecter sur une base altérée (capture.sha256 réécrit, sortie 0 côté
 * collecteur, réseau déjà sollicité).
 *
 * CE QUE LA BASE TIENT :
 *   · SÉQUENCE CANONIQUE des manifestes : `audit-pays-consultations.json`, `-2`, …, `-k` —
 *     sans -0, -1, zéro initial ni trou (contre-revue : base + -3 rendait la cible calculée
 *     égale à un manifeste existant) ;
 *   · chaque manifeste : schéma strict, compteurs recalculés, n contigus, run propre
 *     (appartenance par chemins résolus, bijection des pièces, inventaire exact) ;
 *   · chaque résultat : pièces PROUVÉES (fichier régulier, suivi par git, SHA-256, octets =
 *     taille réelle, format recalculé des octets, texte dérivé = re-dérivation) ;
 *   · VERSIONS D'EXTRACTEUR ADMISES : gelées à `lot-a-4` pour ce lot — une version future
 *     exigera un dispatch de re-dérivation sous contre-revue, jamais la réécriture d'un
 *     manifeste immuable (P1 de la contre-revue) ;
 *   · CURATION SCELLÉE : la liste cumulative est confrontée à
 *     `etat-curation-rattachements.json` (cardinalité + empreinte) — supprimer, ajouter ou
 *     modifier une entrée curée sans rescellement explicite rougit, même en attente de
 *     collecte (contre-revue : l'entrée népalaise supprimée passait en silence) ;
 *   · PRÉFIXE EXACT : les observations de rattachement (ordre des runs) = préfixe de la
 *     liste ; la queue non observée est comptée, jamais silencieuse ;
 *   · UNION des candidates = exactement les couples publiés, une fois chacun ;
 *   · si `audit-pays.json` existe : chaque référence composite de la matrice résout
 *     (manifeste présent, empreinte égale, n existant) — la collecte brute peut précéder la
 *     matrice, jamais la contredire.
 */
import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { resolve, sep, join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { z } from "zod";
import { extraireTexte, detecterFormat } from "./extraire-texte-lot-a.mjs";
import { erreursListeRattachements, estUrlHttp, LIMITE_CORPS_OCTETS } from "./liste-rattachements-lot-a.mjs";

export const PIECES = "audit-pays-pieces/";
export const CURATION = "etat-curation-rattachements.json";
/* GEL des versions d'extracteur admises pour CE lot. Un futur `lot-a-5` devra être ajouté ici
 * AVEC son dispatch de re-dérivation, sous contre-revue — les manifestes `lot-a-4` restent
 * valides et immuables. */
export const VERSIONS_EXTRACTEUR_ADMISES = ["lot-a-4"];
const EXTRACTEURS = { "lot-a-4": extraireTexte };

/** Le nom CANONIQUE du k-ième manifeste (k ≥ 1). */
export const nomManifeste = (k) => (k === 1 ? "audit-pays-consultations.json" : `audit-pays-consultations-${k}.json`);

export const sha256De = (b) => createHash("sha256").update(b).digest("hex");
export function jsonCanonique(x) {
  if (Array.isArray(x)) return "[" + x.map(jsonCanonique).join(",") + "]";
  if (x && typeof x === "object") return "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + jsonCanonique(x[k])).join(",") + "}";
  return JSON.stringify(x);
}
export const empreinteListe = (liste) => sha256De(Buffer.from(jsonCanonique(liste)));

const dateExiste = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d));
  if (!m) return false;
  const u = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return u.getUTCFullYear() === +m[1] && u.getUTCMonth() === +m[2] - 1 && u.getUTCDate() === +m[3];
};

/* ---- schéma STRICT du manifeste (déplacé du validateur — un seul exemplaire) ----------------- */
const DateISO = z.string().refine(dateExiste, { message: "date inexistante au calendrier" });
const UrlHttp = z.string().refine(estUrlHttp, { message: "URL au contrat HTTP(S) partagé exigée (http/https, hôte non vide)" });
const LT = z.object({ en: z.string(), fr: z.string(), es: z.string().optional(), pt: z.string().optional() }).strict();
const Sha256 = z.string().regex(/^[0-9a-f]{64}$/, "SHA-256 de 64 caractères hexadécimaux attendu");
const Fichier = z.object({ chemin: z.string().min(1), sha256: Sha256 }).strict();
const Trace = z.object({ type: z.enum(["transcript", "capture"]), chemin: z.string().min(1), sha256: Sha256 }).strict();
const CaptureManifeste = z.object({
  chemin: z.string().min(1), sha256: Sha256,
  content_type: z.string().min(1),
  format_detecte: z.enum(["pdf", "html", "autre"]),
  texte_derive: Fichier,
  extracteur: z.string().min(1),
  /* `octets` OBLIGATOIRE, borné par la limite partagée, confronté à la taille réelle. */
  octets: z.number().int().min(0).max(LIMITE_CORPS_OCTETS, `au-delà de la borne partagée de ${LIMITE_CORPS_OCTETS} octets`),
}).strict();
const ResCandidate = { n: z.number().int().min(1), role: z.literal("candidate"),
  country_id: z.string().min(1), index_lien: z.number().int().min(0), label: LT, url_publiee: UrlHttp };
const ResRattachement = { n: z.number().int().min(1), role: z.literal("rattachement"),
  url_demandee: UrlHttp, motif: z.string().min(1) };
const ObsConsultee = { acces: z.literal("consultee"), statut_http: z.number().int().min(200).max(299), url_finale: UrlHttp,
  redirections: z.number().int().min(0).optional(), consultee_le: DateISO, content_type: z.string().min(1),
  capture: CaptureManifeste, entetes: Fichier, trace: Trace };
const ObsTentative = { acces: z.literal("tentative"), tentee_le: DateISO, resultat: z.string().min(1), trace: Trace };
const Resultat = z.union([
  z.object({ ...ResCandidate, ...ObsConsultee }).strict(),
  z.object({ ...ResCandidate, ...ObsTentative }).strict(),
  z.object({ ...ResRattachement, ...ObsConsultee }).strict(),
  z.object({ ...ResRattachement, ...ObsTentative }).strict(),
]);
const ManifesteSchema = z.object({
  consultees_le: DateISO,
  run: z.string().regex(/^audit-pays-pieces\/run-[A-Za-z0-9-]+$/, "run doit être audit-pays-pieces/run-*"),
  total: z.number().int().min(1),
  candidates: z.number().int().min(0), rattachements: z.number().int().min(0),
  extracteur: z.string().min(1), resultats: z.array(Resultat).min(1),
}).strict();

/** LA vérification de base. `echec` reçoit chaque écart nommé ; le retour porte l'état
 *  partagé (manifestes chargés avec parN et empreintes, compte en attente, liste) et les
 *  OUTILS de preuve liés au même puits d'écarts. */
export function verifierBase(echec) {
  const scelle = JSON.parse(readFileSync("etat-reference-lot-a.json", "utf-8"));
  const guides = JSON.parse(readFileSync("packages/ui/src/data/countries.generated.json", "utf-8"));
  const CONTRACTUELS = Object.keys(scelle.pays);

  /* ---- outils de preuve (déplacés du validateur) --------------------------------------------- */
  let indexPieces = null;
  const suiviParGit = (chemin) => {
    if (indexPieces === null) {
      const r = spawnSync("git", ["ls-files", "-z", "--", PIECES], { encoding: "utf-8" });
      indexPieces = new Set((r.stdout || "").split("\0").filter(Boolean));
    }
    return indexPieces.has(chemin);
  };
  const fichierProuve = (pays, quoi, chemin, sha) => {
    if (!chemin.startsWith(PIECES) || chemin.includes("..")) {
      echec(`${pays} — ${quoi} : chemin « ${chemin} » hors du répertoire ${PIECES}`); return;
    }
    let st;
    try { st = lstatSync(chemin); }
    catch { echec(`${pays} — ${quoi} : « ${chemin} » ne désigne aucun fichier`); return; }
    if (st.isSymbolicLink() || !st.isFile()) { echec(`${pays} — ${quoi} : « ${chemin} » n'est pas un fichier régulier (lien symbolique refusé)`); return; }
    if (!suiviParGit(chemin)) { echec(`${pays} — ${quoi} : « ${chemin} » n'est PAS SUIVI par git — « versionnée » se prouve`); return; }
    const reel = sha256De(readFileSync(chemin));
    if (reel !== sha) echec(`${pays} — ${quoi} : SHA-256 de « ${chemin} » ≠ scellé (contenu remplacé à chemin constant ?)`);
  };
  const captureProuvee = (pays, quoi, cap) => {
    fichierProuve(pays, `${quoi} (brut)`, cap.chemin, cap.sha256);
    fichierProuve(pays, `${quoi} (texte dérivé)`, cap.texte_derive.chemin, cap.texte_derive.sha256);
    if (!VERSIONS_EXTRACTEUR_ADMISES.includes(cap.extracteur)) {
      echec(`${pays} — ${quoi} : extracteur « ${cap.extracteur} » hors des versions ADMISES pour ce lot [${VERSIONS_EXTRACTEUR_ADMISES.join(", ")}] — un manifeste immuable ne se réaligne jamais`);
      return;
    }
    try {
      const brut = readFileSync(cap.chemin);
      const reel = detecterFormat(brut);
      if (reel !== cap.format_detecte) {
        echec(`${pays} — ${quoi} : format_detecte « ${cap.format_detecte} » ≠ recalculé depuis les octets « ${reel} » — un PDF déguisé reste un PDF`);
      }
      /* la re-dérivation est DISPATCHÉE selon la version SCELLÉE — jamais « la courante ». */
      const rederive = EXTRACTEURS[cap.extracteur](brut, cap.content_type);
      if (sha256De(Buffer.from(rederive)) !== cap.texte_derive.sha256) {
        echec(`${pays} — ${quoi} : le texte dérivé scellé n'est PAS la re-dérivation du brut par l'extracteur ${cap.extracteur}`);
      }
    } catch { /* brut illisible : déjà jugé par fichierProuve */ }
  };
  const formatReel = (cap) => {
    try { return detecterFormat(readFileSync(cap.chemin)); } catch { return cap?.format_detecte; }
  };

  /* ---- séquence CANONIQUE et chargement des manifestes --------------------------------------- */
  const trouves = readdirSync(".").filter((f) => /^audit-pays-consultations(-\d+)?\.json$/.test(f));
  const attendusNoms = Array.from({ length: trouves.length }, (_, i) => nomManifeste(i + 1));
  const trouvesTries = [...trouves].sort((a, b) => (Number(/-(\d+)\.json$/.exec(a)?.[1] ?? 1)) - (Number(/-(\d+)\.json$/.exec(b)?.[1] ?? 1)));
  if (JSON.stringify(trouvesTries) !== JSON.stringify(attendusNoms)) {
    echec(`manifestes — séquence NON CANONIQUE : trouvés [${trouvesTries.join(", ")}], attendus [${attendusNoms.join(", ")}] — base, -2, …, -k, sans -0, -1, zéro initial ni trou`);
  }
  const manifestes = [];
  for (const nom of trouvesTries) {
    try {
      const octets = readFileSync(nom);
      manifestes.push({ nom, donnees: JSON.parse(octets.toString("utf-8")), sha256: sha256De(octets), parN: new Map() });
    } catch { echec(`${nom} — illisible : un manifeste publié ne se lit pas à moitié`); }
  }
  const parNomManifeste = new Map(manifestes.map((m) => [m.nom, m]));

  /* ---- chaque manifeste est un ENSEMBLE EXACT ------------------------------------------------ */
  const referencesParChemin = new Map();
  const runsDeclares = new Set();
  for (const m of manifestes) {
    const parse = ManifesteSchema.safeParse(m.donnees);
    if (!parse.success) {
      echec(`schéma du MANIFESTE « ${m.nom} » refusé — ${parse.error.issues.slice(0, 6).map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`).join(" · ")}`);
      continue;
    }
    const d = m.donnees;
    if (d.total !== d.resultats.length) echec(`${m.nom} — total ${d.total} ≠ ${d.resultats.length} résultats — l'ensemble n'est pas exact`);
    const nbC = d.resultats.filter((r) => r.role === "candidate").length;
    const nbR = d.resultats.filter((r) => r.role === "rattachement").length;
    if (d.candidates !== nbC) echec(`${m.nom} — candidates ${d.candidates} ≠ ${nbC} recalculées`);
    if (d.rattachements !== nbR) echec(`${m.nom} — rattachements ${d.rattachements} ≠ ${nbR} recalculés`);
    if (!VERSIONS_EXTRACTEUR_ADMISES.includes(d.extracteur)) {
      echec(`${m.nom} — extracteur « ${d.extracteur} » hors des versions ADMISES pour ce lot [${VERSIONS_EXTRACTEUR_ADMISES.join(", ")}]`);
    }
    const ns = d.resultats.map((r) => r.n).sort((a, b) => a - b);
    if (JSON.stringify(ns) !== JSON.stringify(Array.from({ length: d.resultats.length }, (_, i) => i + 1))) {
      echec(`${m.nom} — les n ne sont pas uniques et contigus de 1 à ${d.resultats.length} (relevés : ${ns.slice(0, 8).join(", ")}…)`);
    }
    if (runsDeclares.has(d.run)) echec(`${m.nom} — répertoire de run « ${d.run} » déjà déclaré par un autre manifeste`);
    runsDeclares.add(d.run);
    const racineRun = resolve(d.run) + sep;
    for (const r of d.resultats) {
      if (!m.parN.has(r.n)) m.parN.set(r.n, r);
      for (const [champ, f] of [["capture", r.capture?.chemin], ["texte dérivé", r.capture?.texte_derive?.chemin],
        ["en-têtes", r.entetes?.chemin], ["trace", r.trace?.chemin]]) {
        if (!f) continue;
        const cle = resolve(String(f));
        if (!referencesParChemin.has(cle)) referencesParChemin.set(cle, { chemin: String(f), usages: [] });
        referencesParChemin.get(cle).usages.push(`${m.nom} n ${r.n} (${champ})`);
        if (!cle.startsWith(racineRun)) {
          echec(`${m.nom} — n ${r.n} : « ${f} » hors du répertoire de run déclaré « ${d.run} » (chemins résolus)`);
        }
      }
    }
    {
      const orphelines = [];
      const marcher = (dir) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          const chemin = join(dir, e.name);
          if (e.isDirectory()) marcher(chemin);
          else if (!referencesParChemin.has(resolve(chemin))) orphelines.push(chemin);
        }
      };
      try { marcher(d.run); }
      catch { echec(`${m.nom} — répertoire de run « ${d.run} » introuvable ou illisible`); }
      for (const chemin of orphelines) {
        echec(`${m.nom} — pièce ORPHELINE « ${chemin} » : présente dans le run, référencée par aucun résultat — le run n'est pas un inventaire exact`);
      }
    }
    /* chaque résultat reste CONTRE-VÉRIFIABLE, décision ou pas */
    for (const r of d.resultats) {
      const qui = `n ${r.n} (${r.role === "rattachement" ? `rattachement ${r.url_demandee}` : `candidate ${r.country_id}[${r.index_lien}]`})`;
      if (r.acces === "consultee") {
        captureProuvee(m.nom, `${qui} capture`, r.capture);
        try {
          const taille = lstatSync(r.capture.chemin).size;
          if (r.capture.octets !== taille) {
            echec(`${m.nom} — ${qui} : capture.octets ${r.capture.octets} ≠ taille réelle ${taille} du fichier « ${r.capture.chemin} »`);
          }
        } catch { /* l'existence est déjà jugée */ }
        fichierProuve(m.nom, `${qui} en-têtes`, r.entetes.chemin, r.entetes.sha256);
        fichierProuve(m.nom, `${qui} trace`, r.trace.chemin, r.trace.sha256);
      } else if (r.acces === "tentative") {
        fichierProuve(m.nom, `${qui} trace`, r.trace.chemin, r.trace.sha256);
      }
    }
  }
  /* bijection des pièces, entre manifestes aussi */
  for (const { chemin, usages } of referencesParChemin.values()) {
    if (usages.length > 1) {
      echec(`manifestes — pièce « ${chemin} » référencée par PLUSIEURS couples : ${usages.join(" ; ")} — l'inventaire est une bijection`);
    }
  }

  /* ---- liste cumulative : schéma, CURATION SCELLÉE, préfixe exact ---------------------------- */
  let liste = null, rattachementsEnAttente = 0;
  {
    let listeLisible = true;
    try { liste = JSON.parse(readFileSync("rattachements-a-consulter.json", "utf-8")); }
    catch {
      listeLisible = false;
      echec("manifestes — rattachements-a-consulter.json introuvable ou illisible : la liste cumulative est le contrat des rattachements");
    }
    if (listeLisible) {
      for (const e of erreursListeRattachements(liste)) echec(`liste versionnée — rattachements-a-consulter.json ${e}`);
    }
    /* La CURATION est SCELLÉE indépendamment du préfixe : la queue approuvée mais pas encore
     * collectée ne peut NI disparaître, NI enfler, NI changer de motif en silence. */
    let curation = null;
    try { curation = JSON.parse(readFileSync(CURATION, "utf-8")); }
    catch { echec(`curation — ${CURATION} introuvable ou illisible : la liste curée se scelle (cardinalité + empreinte)`); }
    if (curation && Array.isArray(liste)) {
      if (liste.length !== curation.total) {
        echec(`curation — ${liste.length} entrée(s) dans la liste ≠ ${curation.total} scellée(s) — une entrée curée a été ajoutée ou supprimée sans rescellement`);
      }
      if (empreinteListe(liste) !== curation.empreinte_liste) {
        echec(`curation — l'empreinte de la liste cumulative ≠ scellé ${CURATION} — la curation approuvée a été modifiée sans rescellement (entrée supprimée, ajoutée, ou motif réécrit)`);
      }
    }
    if (Array.isArray(liste)) {
      const desManifestes = manifestes.flatMap((m) => (m.donnees.resultats ?? [])
        .filter((r) => r.role === "rattachement").map((r) => ({ url: r.url_demandee, motif: r.motif })));
      if (jsonCanonique(desManifestes) !== jsonCanonique(liste.slice(0, desManifestes.length))) {
        echec("manifestes — les observations de rattachement (dans l'ordre des runs) ne sont pas le PRÉFIXE EXACT de la liste cumulative rattachements-a-consulter.json (url et motif, dans l'ordre) — ancienne URL recollectée, observation hors liste ou ordre réécrit");
      }
      rattachementsEnAttente = Math.max(0, liste.length - desManifestes.length);
    }
  }

  /* ---- union des candidates = exactement les couples publiés -------------------------------- */
  {
    const attendus = new Set();
    for (const id of CONTRACTUELS) for (const [i] of (guides[id]?.sources ?? []).entries()) attendus.add(`${id}#${i}`);
    const presents = new Set();
    for (const m of manifestes) {
      for (const r of m.donnees.resultats ?? []) {
        if (r.role !== "candidate") continue;
        const cle = `${r.country_id}#${r.index_lien}`;
        if (!attendus.has(cle)) echec(`${m.nom} — n ${r.n} : candidate ${cle} HORS de l'ensemble attendu`);
        if (presents.has(cle)) echec(`${m.nom} — candidate ${cle} en double (tous manifestes confondus)`);
        presents.add(cle);
      }
    }
    for (const cle of attendus) if (!presents.has(cle)) echec(`manifestes — candidate attendue ${cle} ABSENTE de tous les manifestes`);
  }

  /* ---- si la matrice existe, ses références composites doivent RÉSOUDRE ---------------------- */
  {
    let matrice = null;
    try { matrice = JSON.parse(readFileSync("audit-pays.json", "utf-8")); }
    catch { /* la collecte brute peut précéder la matrice — rien à confronter */ }
    if (matrice && typeof matrice === "object") {
      const refs = [];
      for (const [id, a] of Object.entries(matrice.audits ?? {})) {
        for (const [i, c] of (a.candidates ?? []).entries()) {
          if (c?.observation) refs.push([`${id} — candidate[${i}]`, c.observation]);
          for (const [j, pr] of (c?.preuves_rattachement ?? []).entries()) {
            if (pr?.observation) refs.push([`${id} — candidate[${i}] preuve [${j}]`, pr.observation]);
          }
        }
      }
      for (const [contexte, ref] of refs) {
        const man = parNomManifeste.get(ref?.manifeste);
        if (!man) { echec(`${contexte} : manifeste référencé « ${ref?.manifeste} » INTROUVABLE — un manifeste encore référencé ne se supprime pas`); continue; }
        if (man.sha256 !== ref.manifeste_sha256) {
          echec(`${contexte} : empreinte courante de « ${ref.manifeste} » ≠ empreinte référencée — un manifeste publié est IMMUABLE (modifié à chemin constant ?)`);
        } else if (!man.parN.has(ref.n)) {
          echec(`${contexte} : n ${ref.n} ne désigne aucun résultat du manifeste « ${ref.manifeste} » — la résolution est PAR MANIFESTE, jamais par numéro nu`);
        }
      }
    }
  }

  return { manifestes, parNomManifeste, rattachementsEnAttente, liste,
    scelle, guides, CONTRACTUELS, fichierProuve, captureProuvee, formatReel };
}
