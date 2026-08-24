#!/usr/bin/env node
/**
 * LES 28 CONTRÔLES D'EXÉCUTION DU LOT A (17–44) SAVENT ROUGIR, CHACUN POUR SA CAUSE.
 *
 *   node test-audit-pays.mjs
 *
 * Le validateur permanent `valider-audit-pays.mjs` est câblé en CI ; ce harnais-ci est la
 * PREUVE MANUELLE DATÉE qu'il mord — un validateur qu'on n'a jamais vu rougir est un ornement.
 *
 * MÉTHODE. Un arbre de travail git jetable reçoit une MATRICE-FIXTURE construite depuis les
 * triplets RÉELS des guides (bijection respectée) mais aux observations manifestement
 * d'essai : chaque candidate est une consultation fictive avec extrait témoin, nature
 * `non_etabli`, pertinence `non_evaluee` ; dix-sept pays concluent « aucune source
 * officielle » (motif d'essai), et country_fj porte une promotion complète et concordante
 * (autorité prouvée par une pièce de rattachement d'essai). Cette fixture passe le validateur
 * (cas 0) ; chaque cas suivant mute UNE chose et exige la sortie 1 avec la cause nommée.
 * Aucune donnée réelle n'est affirmée : la fixture vit dans l'arbre jetable, jamais au dépôt.
 *
 * CINQUANTE-ET-UN CAS : 0 (fixture conforme — manifeste complet avec une observation de
 * rattachement de rôle dédié, candidate PDF à pièce-capture), 17 à 52 (bijection, décisions,
 * pièces, ancres, PDF, liaison au manifeste), puis 53-57 (contre-revue v5-ter) : PDF déguisé
 * en text/plain — le format recalculé depuis les OCTETS prime ; résultat de manifeste
 * supplémentaire non exercé ; URL de rattachement inventée (capture et citation intactes) ;
 * rattachement sans manifeste_n ; pièce du manifeste hors du répertoire de run déclaré.
 * Puis 58-63 (contre-revue v5-quater) : rattachement sans décision éditoriale ; PDF déclaré
 * utilisé ; compteur falsifié ; run hors motif ; n non contigus ; manifeste ≠ liste
 * versionnée. La fixture écarte proprement un rattachement PDF et une tentative (vert).
 * Puis 64-66 (contre-revue v5-quinquies) : liste versionnée difforme ({} puis URL locale)
 * refusée PAR LE VALIDATEUR aussi ; pièces d'un rattachement ÉCARTÉ remplacées par du néant ;
 * preuve de rattachement visant une candidate ordinaire (citation ancrée, capture concordante,
 * observation dédiée écartée — seule la garde de RÔLE la voit).
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, symlinkSync, mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { extraireTexte, detecterFormat, VERSION_EXTRACTEUR } from "./extraire-texte-lot-a.mjs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const AS_OF = "2026-08-24";
const JOUR = "2026-08-24";
/* La dérivation ADR-0007, recopiée pour la FIXTURE seulement — le validateur, lui, utilise la
 * fonction canonique `reviewDueFrom` importée du schéma. */
const plus180 = (d) => { const u = new Date(d + "T00:00:00Z"); u.setUTCDate(u.getUTCDate() + 180); return u.toISOString().slice(0, 10); };
const DUE = plus180(JOUR);

const defauts = [];
const echec = (cas, m) => defauts.push(`${cas} — ${m}`);
const lancer = (cwd) => spawnSync("node", ["--import", "tsx", "valider-audit-pays.mjs", `--as-of=${AS_OF}`], { cwd, encoding: "utf-8" });

const conteneur = mkdtempSync(join(tmpdir(), "audit-wt-"));
const arbre = join(conteneur, "arbre");
const gitWt = (...a) => spawnSync("git", ["worktree", ...a], { encoding: "utf-8" });
const gitArbre = (...a) => spawnSync("git", ["-C", arbre, ...a], { encoding: "utf-8" });

const quoteFixture = (texte) => ({
  url: "https://example.org/annuaire-temoin", source_type: "government",
  verified_date: JOUR, review_due: DUE, confidence: 3, reviewer: "Harnais lot A",
  history: [], quote: texte, quote_language: "en", locator: "section témoin de l'annuaire",
});
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const EXTRAIT_TEMOIN = "Extrait témoin relevé sur la page consultée (jeu d'essai).";

/** La fixture : matrice ET manifeste, construits d'une même énumération — le manifeste
 *  porte les observations, la matrice les référence par manifeste_n et n'ajoute que le
 *  jugement. Une candidate PDF (country_bs[1]) montre la forme licite : sa pièce est sa
 *  capture, jamais un extrait. */
function fabriquerJeu(guides, scelle, fx) {
  const audits = {};
  const resultats = [];
  let n = 0;
  for (const id of Object.keys(scelle.pays)) {
    const candidates = guides[id].sources.map((s, i) => {
      n++;
      const estPdf = id === "country_bs" && i === 1;
      const cap = JSON.parse(JSON.stringify(estPdf ? fx.capturePdfTexte : fx.captureTemoin));
      resultats.push({
        n, role: "candidate", country_id: id, index_lien: i, label: s.label, url_publiee: s.url,
        acces: "consultee", statut_http: 200, url_finale: s.url, redirections: 0,
        consultee_le: JOUR, content_type: cap.content_type,
        capture: JSON.parse(JSON.stringify(cap)),
        entetes: { ...fx.entetesTemoin }, trace: { ...fx.traceTemoin },
      });
      return {
        manifeste_n: n, label: s.label, url_publiee: s.url, acces: "consultee",
        url_finale: s.url, statut_http: 200, consultee_le: JOUR,
        capture: cap, entetes: { ...fx.entetesTemoin }, trace: { ...fx.traceTemoin },
        piece: estPdf ? { type: "capture", chemin: cap.chemin, sha256: cap.sha256 }
                      : { type: "extrait", extrait: EXTRAIT_TEMOIN, langue: "en", locator: "section témoin" },
        nature_editeur: "non_etabli", preuves_rattachement: [], pertinence: "non_evaluee",
      };
    });
    audits[id] = {
      audite_par: "Harnais lot A", audite_le: JOUR, candidates,
      decision: { statut: "aucune_source_officielle", motif: "Jeu d'essai : aucune candidate n'est jugée ici." },
    };
  }
  /* Les observations de RATTACHEMENT (rôle dédié) : une utilisée (HTML), une PDF à écarter,
   * une tentative à écarter — un PDF réussi ou un échec réseau ne bloquent pas la matrice,
   * ils s'ÉCARTENT avec motif (contre-revue v5-quater). */
  n++;
  const nRattachement = n;
  resultats.push({
    n: nRattachement, role: "rattachement",
    url_demandee: "https://example.org/annuaire-temoin", motif: "Annuaire témoin du jeu d'essai.",
    acces: "consultee", statut_http: 200, url_finale: "https://example.org/annuaire-temoin",
    redirections: 0, consultee_le: JOUR, content_type: fx.captureRattachement.content_type,
    capture: JSON.parse(JSON.stringify(fx.captureRattachement)),
    entetes: { ...fx.entetesTemoin }, trace: { ...fx.traceTemoin },
  });
  n++;
  const nRattachementPdf = n;
  resultats.push({
    n: nRattachementPdf, role: "rattachement",
    url_demandee: "https://example.org/document-pdf-temoin", motif: "Document PDF témoin du jeu d'essai.",
    acces: "consultee", statut_http: 200, url_finale: "https://example.org/document-pdf-temoin",
    redirections: 0, consultee_le: JOUR, content_type: fx.capturePdfTexte.content_type,
    capture: JSON.parse(JSON.stringify(fx.capturePdfTexte)),
    entetes: { ...fx.entetesTemoin }, trace: { ...fx.traceTemoin },
  });
  n++;
  const nRattachementTentative = n;
  resultats.push({
    n: nRattachementTentative, role: "rattachement",
    url_demandee: "https://example.org/annuaire-injoignable", motif: "Annuaire injoignable du jeu d'essai.",
    acces: "tentative", tentee_le: JOUR, resultat: "HTTP 403", trace: { ...fx.traceTemoin },
  });
  /* country_fj : la promotion complète et concordante, rattachement ancré dans sa capture. */
  const fj = audits.country_fj;
  const c0 = fj.candidates[0];
  c0.nature_editeur = "autorite_pays";
  c0.preuves_rattachement = [fx.preuveTemoin(nRattachement)];
  c0.pertinence = "etaye_le_fait";
  fj.decision = {
    statut: "promue", observation_decisive: 0,
    source: {
      url: c0.url_finale, source_type: "official_website",
      verified_date: JOUR, review_due: DUE, confidence: 3, reviewer: "Harnais lot A", history: [],
      quote: c0.piece.extrait, quote_language: c0.piece.langue, locator: c0.piece.locator,
    },
  };
  return {
    matrice: { audits, rattachements: {
      [String(nRattachement)]: { statut: "utilisee" },
      [String(nRattachementPdf)]: { statut: "ecartee", motif: "PDF : aucune preuve textuelle en lot-a-1 (jeu d'essai)." },
      [String(nRattachementTentative)]: { statut: "ecartee", motif: "Tentative : la page n'a pas été obtenue (jeu d'essai)." },
    } },
    manifeste: { consultees_le: JOUR, run: "audit-pays-pieces/run-fixture", total: n,
      candidates: n - 3, rattachements: 3, extracteur: VERSION_EXTRACTEUR, resultats },
    liste: resultats.filter((r) => r.role === "rattachement").map((r) => ({ url: r.url_demandee, motif: r.motif })),
  };
}

try {
  const ajout = gitWt("add", "--detach", arbre, "HEAD");
  if (ajout.status !== 0) throw new Error(`git worktree add : ${(ajout.stderr || "").trim()}`);
  symlinkSync(resolve("node_modules"), join(arbre, "node_modules"));
  copyFileSync("valider-audit-pays.mjs", join(arbre, "valider-audit-pays.mjs"));
  copyFileSync("extraire-texte-lot-a.mjs", join(arbre, "extraire-texte-lot-a.mjs"));
  copyFileSync("liste-rattachements-lot-a.mjs", join(arbre, "liste-rattachements-lot-a.mjs"));
  copyFileSync("etat-reference-lot-a.json", join(arbre, "etat-reference-lot-a.json"));
  mkdirSync(join(arbre, "audit-pays-pieces"), { recursive: true });

  const guides = JSON.parse(readFileSync(join(arbre, "packages/ui/src/data/countries.generated.json"), "utf-8"));
  const scelle = JSON.parse(readFileSync(join(arbre, "etat-reference-lot-a.json"), "utf-8"));
  const CHEMIN_MATRICE = join(arbre, "audit-pays.json");
  const CHEMIN_OBJETS = join(arbre, "packages/knowledge/raw/objects.json");
  const objetsPristins = readFileSync(CHEMIN_OBJETS, "utf-8");

  /* Les captures-fixtures : brut + texte dérivé (extracteur versionné) + PDF témoins. */
  const CITATION_RATTACHEMENT = "La Biosecurity Authority of Fiji est instituée par la loi sur la biosécurité (pièce d'essai).";
  const EXTRAIT_PDF = "Extrait temoin PDF du jeu d'essai, lot A.";
  mkdirSync(join(arbre, "audit-pays-pieces/run-fixture"), { recursive: true });
  const poserCapture = (nom, contenu, contentType) => {
    const chemin = `audit-pays-pieces/run-fixture/${nom}`;
    writeFileSync(join(arbre, chemin), contenu);
    const texte = extraireTexte(Buffer.isBuffer(contenu) ? contenu : Buffer.from(contenu), contentType);
    const cheminTexte = `audit-pays-pieces/run-fixture/${nom}.texte.txt`;
    writeFileSync(join(arbre, cheminTexte), texte);
    gitArbre("add", "--", chemin, cheminTexte);
    return { chemin, sha256: sha256(contenu), content_type: contentType,
      format_detecte: detecterFormat(Buffer.isBuffer(contenu) ? contenu : Buffer.from(contenu)),
      texte_derive: { chemin: cheminTexte, sha256: sha256(Buffer.from(texte)) },
      extracteur: VERSION_EXTRACTEUR };
  };
  const captureTemoin = poserCapture("capture-temoin.html",
    `<html><body><h2>section témoin</h2><p>${EXTRAIT_TEMOIN}</p></body></html>`, "text/html; charset=utf-8");
  const captureRattachement = poserCapture("rattachement-temoin.html",
    `<html><body><h2>section témoin de l'annuaire</h2><p>${CITATION_RATTACHEMENT}</p></body></html>`, "text/html; charset=utf-8");
  const fluxPdf = `BT /F1 12 Tf 72 700 Td (${EXTRAIT_PDF}) Tj ET`;
  const capturePdfTexte = poserCapture("pdf-temoin.pdf",
    Buffer.from(`%PDF-1.4\n4 0 obj << /Length ${fluxPdf.length} >> stream\n${fluxPdf}\nendstream endobj\ntrailer\n%%EOF`),
    "application/pdf");
  const capturePdfScanne = poserCapture("pdf-scanne.pdf",
    Buffer.from("%PDF-1.4\n4 0 obj << >> stream\nimagebinairesanstexte\nendstream\n%%EOF"),
    "application/pdf");
  const preuveTemoin = (manifeste_n = 92) => ({
    manifeste_n,
    citation: quoteFixture(CITATION_RATTACHEMENT),
    capture: JSON.parse(JSON.stringify(captureRattachement)),
  });
  const poserFichier = (nom, contenu) => {
    const chemin = `audit-pays-pieces/run-fixture/${nom}`;
    writeFileSync(join(arbre, chemin), contenu);
    gitArbre("add", "--", chemin);
    return { chemin, sha256: sha256(contenu) };
  };
  const entetesTemoin = poserFichier("entetes-temoin.txt",
    "HTTP/1.1 200 OK\n[en-tête expurgé : cookies/authentification/proxy]\nContent-Type: text/html; charset=utf-8\n");
  const traceTemoinF = poserFichier("trace-temoin.txt", "# trace témoin du jeu d'essai\n[ligne expurgée : proxy/authentification]\n");
  const traceTemoin = { type: "transcript", ...traceTemoinF };
  const fx = { captureTemoin, captureRattachement, capturePdfTexte, capturePdfScanne, preuveTemoin, entetesTemoin, traceTemoin };

  const poser = (m) => writeFileSync(CHEMIN_MATRICE, JSON.stringify(m, null, 2));
  const CHEMIN_MANIFESTE = join(arbre, "audit-pays-consultations.json");
  const jeu0 = fabriquerJeu(guides, scelle, fx);
  const manifestePristin = JSON.stringify(jeu0.manifeste, null, 2);
  writeFileSync(CHEMIN_MANIFESTE, manifestePristin);
  /* La liste versionnée des rattachements — le manifeste doit lui être EXACTEMENT égal. */
  writeFileSync(join(arbre, "rattachements-a-consulter.json"), JSON.stringify(jeu0.liste, null, 2));
  const neuve = () => fabriquerJeu(guides, scelle, fx).matrice;
  const neuveManifeste = () => JSON.parse(manifestePristin);

  /** Mute une matrice neuve (et, si demandé, une copie du manifeste), pose, lance, exige 1 + motifs. */
  const cas = (nom, muter, motifs, muterManifeste = null) => {
    const m = neuve();
    muter(m);
    poser(m);
    if (muterManifeste) {
      const mf = neuveManifeste();
      muterManifeste(mf);
      writeFileSync(CHEMIN_MANIFESTE, JSON.stringify(mf, null, 2));
    }
    const r = lancer(arbre);
    if (muterManifeste) writeFileSync(CHEMIN_MANIFESTE, manifestePristin);
    if (r.status !== 1) { echec(nom, `sortie ${r.status} au lieu de 1 — la mutation passe`); return; }
    for (const motif of motifs) {
      if (!motif.test(r.stderr)) {
        echec(nom, `le diagnostic ne satisfait pas ${motif} — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 5).join("\n      ")}`);
      }
    }
  };
  const fj = (m) => m.audits.country_fj;
  const bs = (m) => m.audits.country_bs;

  /* ---- 0 · la fixture conforme passe --------------------------------------------------------- */
  poser(neuve());
  {
    const r = lancer(arbre);
    if (r.status !== 0) echec("0 fixture conforme", `sortie ${r.status} :\n      ${r.stderr.trim().split("\n").slice(0, 6).join("\n      ")}`);
    else if (!/1 promue/.test(r.stdout)) echec("0 fixture conforme", "le compte rendu n'annonce pas la promotion d'essai");
  }

  /* ---- 17-18 · bijection triplet ------------------------------------------------------------- */
  cas("17 candidate retirée", (m) => { bs(m).candidates.pop(); }, [/country_bs/, /bijection TRIPLET rompue/]);
  cas("18 libellé modifié", (m) => { bs(m).candidates[0].label = { ...bs(m).candidates[0].label, en: "Autre libellé" }; },
    [/country_bs/, /bijection TRIPLET rompue/]);

  /* ---- 19-21 --------------------------------------------------------------------------------- */
  cas("19 page générique promue", (m) => { fj(m).candidates[0].pertinence = "page_generique"; },
    [/country_fj/, /pertinence « page_generique »/]);
  cas("20 tentative avec pertinence affirmée", (m) => {
    const c = bs(m).candidates[0];
    bs(m).candidates[0] = { label: c.label, url_publiee: c.url_publiee, acces: "tentative", tentee_le: JOUR,
      resultat: "HTTP 403", trace: { type: "transcript", chemin: "audit-pays-pieces/t.txt", sha256: "0".repeat(64) },
      nature_editeur: "non_etabli", preuves_rattachement: [], pertinence: "partielle" };
  }, [/schéma/, /pertinence/]);
  cas("21 négatif malgré candidate éligible", (m) => {
    const c = bs(m).candidates[0];
    c.nature_editeur = "autorite_pays"; c.pertinence = "etaye_le_fait";
    c.preuves_rattachement = [preuveTemoin()];
  }, [/country_bs/, /candidate ÉLIGIBLE existe/]);

  /* ---- 22-26 --------------------------------------------------------------------------------- */
  cas("22 verified_date ≠ consultation", (m) => { fj(m).decision.source.verified_date = "2026-08-23"; },
    [/country_fj/, /verified_date « 2026-08-23 » ≠ consultee_le/]);
  cas("23 reviewer ≠ auditeur", (m) => { fj(m).decision.source.reviewer = "Quelqu'un d'autre"; },
    [/country_fj/, /reviewer « Quelqu'un d'autre » ≠ audite_par/]);
  cas("24 champ inconnu", (m) => { bs(m).candidates[0].champ_fantome = 1; }, [/schéma/, /champ_fantome|[Uu]nrecognized/]);
  cas("25 non officiel affiché « Sources officielles »", (m) => { bs(m).candidates[1].nature_editeur = "non_officiel";
    bs(m).candidates[1].preuves_rattachement = [preuveTemoin()]; },
    [/country_bs/, /ÉCHEC BLOQUANT/, /arbitrage requis/]);
  cas("26 review_due non dérivée", (m) => { fj(m).decision.source.review_due = "2027-02-21"; },
    [/country_fj/, /dérivation ADR-0007/]);

  /* ---- 27-28 --------------------------------------------------------------------------------- */
  cas("27 objects.json sans matrice", (m) => {
    const o = JSON.parse(objetsPristins);
    o.countries.find((c) => c.id === "country_bs").source = {
      url: "https://example.org/x", source_type: "government", verified_date: JOUR,
      review_due: DUE, confidence: 3, reviewer: "X", history: [] };
    writeFileSync(CHEMIN_OBJETS, JSON.stringify(o, null, 2));
  }, [/country_bs/, /la matrice fait foi/]);
  writeFileSync(CHEMIN_OBJETS, objetsPristins);
  cas("28 hôte MyDogCanFly promu", (m) => {
    fj(m).candidates[0].url_finale = "https://mydogcanfly.com/faux";
    fj(m).decision.source.url = "https://mydogcanfly.com/faux";
  }, [/country_fj/, /SourcedQuote/, /auto-citation|mydogcanfly/i]);

  /* ---- 29-33 --------------------------------------------------------------------------------- */
  cas("29 citation trop courte", (m) => { fj(m).candidates[0].piece.extrait = "court"; fj(m).decision.source.quote = "court"; },
    [/country_fj/, /schéma|SourcedQuote/]);
  cas("30 promue sans locator", (m) => { delete fj(m).decision.source.locator; },
    [/country_fj/, /sans locator \(obligatoire au lot A\)/]);
  cas("31 projection sur l'URL publiée", (m) => { fj(m).candidates[0].url_finale = fj(m).candidates[0].url_publiee + "?finale=autre"; },
    [/country_fj/, /URL FINALE/]);
  cas("32 rattachement en URL nue", (m) => { fj(m).candidates[0].preuves_rattachement = [{ url: "https://example.org/annuaire" }]; },
    [/schéma/, /preuves_rattachement/]);
  cas("33 audit antérieur à la consultation", (m) => { fj(m).audite_le = "2026-08-23"; },
    [/country_fj/, /audite_le « 2026-08-23 » antérieure/]);

  /* ---- 34-36 --------------------------------------------------------------------------------- */
  cas("34 consultation sans pièce", (m) => { delete bs(m).candidates[0].piece; }, [/schéma/, /piece/]);
  cas("35 verdict négatif sans pièce", (m) => { bs(m).candidates[0].pertinence = "page_generique"; delete bs(m).candidates[0].piece; },
    [/schéma/, /piece/]);
  cas("36 tentative sans résultat précis", (m) => {
    const c = bs(m).candidates[0];
    bs(m).candidates[0] = { label: c.label, url_publiee: c.url_publiee, acces: "tentative", tentee_le: JOUR,
      resultat: "", trace: { type: "transcript", chemin: "audit-pays-pieces/t.txt", sha256: "0".repeat(64) },
      nature_editeur: "non_etabli", preuves_rattachement: [], pertinence: "non_evaluee" };
  }, [/schéma/, /resultat/]);

  /* ---- 37-38 · pièces fichiers --------------------------------------------------------------- */
  cas("37 capture vers rien", (m) => {
    bs(m).candidates[0].piece = { type: "capture", chemin: "audit-pays-pieces/absente.html", sha256: "0".repeat(64) };
  }, [/country_bs/, /ne désigne aucun fichier/]);
  cas("38 contenu remplacé à chemin constant", (m) => {
    const chemin = join(arbre, "audit-pays-pieces/temoin-38.html");
    writeFileSync(chemin, "contenu remplacé après scellement");
    gitArbre("add", "--", "audit-pays-pieces/temoin-38.html");
    bs(m).candidates[0].piece = { type: "capture", chemin: "audit-pays-pieces/temoin-38.html",
      sha256: "1111111111111111111111111111111111111111111111111111111111111111" };
  }, [/country_bs/, /SHA-256 de « audit-pays-pieces\/temoin-38\.html » ≠ scellé/]);

  /* ---- 39-42 --------------------------------------------------------------------------------- */
  cas("39 tentative sans trace", (m) => {
    const c = bs(m).candidates[0];
    bs(m).candidates[0] = { label: c.label, url_publiee: c.url_publiee, acces: "tentative", tentee_le: JOUR,
      resultat: "HTTP 403", nature_editeur: "non_etabli", preuves_rattachement: [], pertinence: "non_evaluee" };
  }, [/schéma/, /trace/]);
  cas("40 citation contredisant l'observation", (m) => { fj(m).decision.source.quote = "Une phrase qui n'est pas l'extrait de l'observation désignée."; },
    [/country_fj/, /citation promue diffère de l'extrait/]);
  cas("41 autorité sans rattachement", (m) => { fj(m).candidates[0].preuves_rattachement = []; },
    [/country_fj/, /sans AUCUNE preuve de rattachement/]);
  cas("42 capture seule comme pièce décisive", (m) => {
    const chemin = join(arbre, "audit-pays-pieces/temoin-42.html");
    const contenu = "capture témoin pour la contre-épreuve quarante-deux";
    writeFileSync(chemin, contenu);
    gitArbre("add", "--", "audit-pays-pieces/temoin-42.html");
    const sha = spawnSync("node", ["-e", `process.stdout.write(require("crypto").createHash("sha256").update(require("fs").readFileSync(${JSON.stringify(chemin)})).digest("hex"))`], { encoding: "utf-8" }).stdout;
    fj(m).candidates[0].piece = { type: "capture", chemin: "audit-pays-pieces/temoin-42.html", sha256: sha };
  }, [/country_fj/, /pièce décisive d'une promotion doit être un EXTRAIT/]);

  /* ---- 43-44 --------------------------------------------------------------------------------- */
  cas("43 fichier non suivi", (m) => {
    writeFileSync(join(arbre, "audit-pays-pieces/non-suivi.html"), "présent mais hors index");
    const sha = spawnSync("node", ["-e", `process.stdout.write(require("crypto").createHash("sha256").update("présent mais hors index").digest("hex"))`], { encoding: "utf-8" }).stdout;
    bs(m).candidates[0].piece = { type: "capture", chemin: "audit-pays-pieces/non-suivi.html", sha256: sha };
  }, [/country_bs/, /PAS SUIVI par git/]);
  cas("44 lien symbolique", (m) => {
    try { symlinkSync("/etc/hostname", join(arbre, "audit-pays-pieces/lien-44.html")); } catch {}
    bs(m).candidates[0].piece = { type: "capture", chemin: "audit-pays-pieces/lien-44.html", sha256: "0".repeat(64) };
  }, [/country_bs/, /fichier régulier|lien symbolique/]);

  /* ---- 45-47 · les extraits sont ancrés, les rattachements capturés -------------------------- */
  cas("45 extrait absent de la capture", (m) => {
    bs(m).candidates[0].piece.extrait = "Texte qui ne figure dans aucune capture versionnée du jeu d'essai.";
  }, [/country_bs/, /INTROUVABLE dans le texte dérivé/]);
  cas("46 extrait modifié de façon concordante", (m) => {
    const nouveau = "Citation réécrite à l'identique des deux côtés, mais absente de la page.";
    fj(m).candidates[0].piece.extrait = nouveau;
    fj(m).decision.source.quote = nouveau;   // la concordance passe — seule l'ANCRE peut le voir
  }, [/country_fj/, /INTROUVABLE dans le texte dérivé/]);
  cas("47 rattachement sans capture", (m) => {
    delete fj(m).candidates[0].preuves_rattachement[0].capture;
  }, [/schéma/, /preuves_rattachement/]);

  /* ---- 48-52 · le vide ne s'ancre nulle part, les PDF ne font pas preuve, le manifeste fait foi */
  cas("48 extrait de balises seules", (m) => {
    bs(m).candidates[0].piece.extrait = "<b></b><i></i>";   // 14 caractères, 0 significatif
  }, [/schéma/, /SIGNIFICATIFS|balisage/]);
  cas("49 extrait d'entités seules", (m) => {
    bs(m).candidates[0].piece.extrait = "&nbsp;&nbsp;&amp;&nbsp;&nbsp;&nbsp;";
  }, [/schéma/, /SIGNIFICATIFS/]);
  cas("50 pièce extrait depuis un PDF", (m) => {
    /* La candidate PDF licite (pièce = capture) reçoit un extrait POURTANT ANCRABLE dans le
     * texte dérivé dégradé : l'interdiction lot-a-1 doit primer sur l'ancrage. */
    bs(m).candidates[1].piece = { type: "extrait", extrait: EXTRAIT_PDF, langue: "en", locator: "page 1" };
  }, [/country_bs/, /pièce EXTRAIT depuis un PDF/]);
  cas("51 rattachement depuis un PDF", (m) => {
    const preuve = preuveTemoin();
    preuve.capture = JSON.parse(JSON.stringify(capturePdfTexte));
    fj(m).candidates[0].preuves_rattachement = [preuve];
  }, [/country_fj/, /rattachement \[0\] depuis un PDF/]);
  cas("52 observation réécrite hors manifeste", (m) => {
    /* L'attaque exacte de la contre-revue : url_finale ET source.url réécrites ensemble —
     * la concordance passe, la capture et le manifeste sont intacts. */
    fj(m).candidates[0].url_finale = "https://autorite-inventee.example/politique-chiens";
    fj(m).decision.source.url = "https://autorite-inventee.example/politique-chiens";
  }, [/country_fj/, /url_finale/, /observation réécrite hors manifeste/]);

  /* ---- 53-57 · format par octets, ensemble exact, rattachement lié --------------------------- */
  cas("53 PDF déguisé en text/plain", (m) => {
    /* Les mêmes octets %PDF- sous text/plain, ALIGNÉS matrice + manifeste + dérivé : le
     * format recalculé depuis les octets doit primer, et l'interdiction PDF avec lui. */
    const deguisee = JSON.parse(JSON.stringify(capturePdfTexte));
    deguisee.content_type = "text/plain";
    deguisee.format_detecte = "autre";
    const c = bs(m).candidates[1];
    c.capture = deguisee;
    c.piece = { type: "extrait", extrait: EXTRAIT_PDF, langue: "en", locator: "page 1" };
  }, [/country_bs/, /format_detecte|PDF/, /recalculé depuis les octets|pièce EXTRAIT depuis un PDF/], (mf) => {
    const res = mf.resultats.find((x) => x.country_id === "country_bs" && x.index_lien === 1);
    res.content_type = "text/plain";
    res.capture.content_type = "text/plain";
    res.capture.format_detecte = "autre";
  });
  cas("54 résultat manifeste supplémentaire", (m) => { /* matrice inchangée */ }, [
    /contigus|999|en double/, /candidates|contigus|double/,
  ], (mf) => {
    const clone = JSON.parse(JSON.stringify(mf.resultats[0]));
    clone.n = 999;
    mf.resultats.push(clone);
    mf.total = mf.resultats.length;
  });
  cas("55 URL de rattachement inventée", (m) => {
    fj(m).candidates[0].preuves_rattachement[0].citation.url = "https://ministere-invente.gov.example/decret";
  }, [/country_fj/, /citation\.url/, /rattachement hors manifeste/]);
  cas("56 rattachement sans manifeste_n", (m) => {
    delete fj(m).candidates[0].preuves_rattachement[0].manifeste_n;
  }, [/schéma/, /manifeste_n/]);
  cas("57 pièce du manifeste hors du répertoire de run", (m) => { /* matrice inchangée */ }, [
    /hors du répertoire de run déclaré/,
  ], (mf) => {
    mf.resultats[0].capture.chemin = "packages/knowledge/raw/objects.json";
  });

  /* ---- 58-63 · décisions de rattachement et ensemble exact (contre-revue v5-quater) ---------- */
  cas("58 rattachement sans décision", (m) => {
    delete m.rattachements[Object.keys(m.rattachements).find((k) => m.audits.country_fj.candidates[0].preuves_rattachement[0].manifeste_n !== Number(k))];
  }, [/SANS DÉCISION éditoriale/]);
  cas("59 PDF déclaré utilisé", (m) => {
    const nPdf = Object.keys(m.rattachements).find((k) => /PDF/.test(m.rattachements[k].motif ?? ""));
    m.rattachements[nPdf] = { statut: "utilisee" };
  }, [/déclaré UTILISÉ mais cité par aucune preuve/]);
  cas("60 compteur rattachements falsifié", (m) => { /* matrice inchangée */ }, [
    /rattachements 999 ≠ 3 recalculés/,
  ], (mf) => { mf.rattachements = 999; });
  cas("61 run hors du motif run-*", (m) => { /* matrice inchangée */ }, [
    /schéma du MANIFESTE|run doit être/,
  ], (mf) => { mf.run = "audit-pays-pieces"; });
  cas("62 n non contigus", (m) => { /* matrice inchangée */ }, [
    /uniques et contigus/,
  ], (mf) => { mf.resultats[mf.resultats.length - 1].n = 500; });
  cas("63 manifeste ≠ liste versionnée des rattachements", (m) => { /* matrice inchangée */ }, [
    /EXACTEMENT la liste versionnée/,
  ], (mf) => {
    const r = mf.resultats.find((x) => x.role === "rattachement");
    r.motif = "Motif réécrit après coup, différent de la liste versionnée.";
  });

  /* ---- 64-66 · liste difforme, pièces de l'écarté, rôle des preuves (contre-revue v5-quinquies) */
  {
    /* 64 — le VALIDATEUR aussi refuse une liste versionnée difforme : `{}` à la place du
     * tableau, puis une URL locale — le schéma strict est PARTAGÉ avec le collecteur. */
    const CHEMIN_LISTE = join(arbre, "rattachements-a-consulter.json");
    const listePristine = readFileSync(CHEMIN_LISTE, "utf-8");
    const variantes = [
      ["{} à la place du tableau", "{}", /TABLEAU d'objets/],
      ["URL locale file://", JSON.stringify([{ url: "file:///etc/passwd", motif: "Motif présent mais schéma local." }]), /HTTP\(S\) UNIQUEMENT/],
    ];
    for (const [nom, contenu, motif] of variantes) {
      writeFileSync(CHEMIN_LISTE, contenu);
      poser(neuve());
      const r = lancer(arbre);
      writeFileSync(CHEMIN_LISTE, listePristine);
      if (r.status !== 1) { echec(`64 liste difforme (${nom})`, `sortie ${r.status} au lieu de 1 — le validateur saute la liste versionnée`); continue; }
      if (!motif.test(r.stderr)) {
        echec(`64 liste difforme (${nom})`, `le diagnostic ne satisfait pas ${motif} — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 5).join("\n      ")}`);
      }
    }
  }
  cas("65 pièces du rattachement écarté remplacées par du néant", (m) => { /* matrice inchangée, décision ecartee conservée */ }, [
    /manifeste — n \d+ \(rattachement/, /ne désigne aucun fichier/,
  ], (mf) => {
    const pdf = mf.resultats.find((x) => x.role === "rattachement" && /document-pdf/.test(x.url_demandee));
    pdf.capture.chemin = "audit-pays-pieces/run-fixture/fantome.pdf";
    pdf.capture.sha256 = "0".repeat(64);
    pdf.capture.texte_derive = { chemin: "audit-pays-pieces/run-fixture/fantome.texte.txt", sha256: "0".repeat(64) };
  });
  cas("66 preuve de rattachement visant une candidate ordinaire", (m) => {
    /* L'attaque exacte : la preuve pointe la candidate ELLE-MÊME ; citation et capture sont
     * ajustées pour concorder avec l'observation (la citation s'ANCRE dans la capture de la
     * candidate), et l'observation de rattachement dédiée est proprement écartée — sans la
     * garde de RÔLE, tout passe. */
    const c = fj(m).candidates[0];
    const p = c.preuves_rattachement[0];
    p.manifeste_n = c.manifeste_n;
    p.citation.url = c.url_finale;
    p.citation.quote = EXTRAIT_TEMOIN;
    p.capture = JSON.parse(JSON.stringify(c.capture));
    m.rattachements["92"] = { statut: "ecartee", motif: "Écartée pour couvrir le contournement (jeu d'essai)." };
  }, [/country_fj/, /rôle « candidate »/, /liste versionnée ne se contourne pas/]);
} finally {
  gitWt("remove", "--force", arbre);
  rmSync(conteneur, { recursive: true, force: true });
}

/* ---- verdict ---------------------------------------------------------------------------------- */
if (defauts.length === 0) {
  process.stdout.write("51 cas éprouvés : la fixture conforme — manifeste en ensemble exact égal à la liste\n");
  process.stdout.write("versionnée, rattachement utilisé + PDF et tentative proprement écartés — sort en 0 ;\n");
  process.stdout.write("rattachement de rôle dédié, candidate PDF à pièce-capture — sort en 0 ; les contrôles\n");
  process.stdout.write("17-52 rougissent chacun pour sa cause (bijection triplet, décisions, pièces prouvées,\n");
  process.stdout.write("ancres, interdictions PDF, liaison au manifeste) ; et la contre-revue v5-ter est morte :\n");
  process.stdout.write("le format se recalcule depuis les OCTETS (PDF déguisé en text/plain refusé), un\n");
  process.stdout.write("résultat de manifeste non exercé rougit, une URL de rattachement inventée — capture et\n");
  process.stdout.write("citation intactes — rougit par la liaison, un rattachement sans manifeste_n échoue au\n");
  process.stdout.write("schéma, un chemin hors run (résolu) est nommé ; et les décisions font loi : sans\n");
  process.stdout.write("décision rouge, PDF « utilisé » rouge, compteurs et contiguïté recalculés, liste\n");
  process.stdout.write("versionnée exigée à l'identique ; enfin la contre-revue v5-quinquies est morte : la\n");
  process.stdout.write("liste difforme rougit AU VALIDATEUR aussi (schéma partagé), les pièces d'un\n");
  process.stdout.write("rattachement écarté restent contre-vérifiables, et une preuve visant une candidate\n");
  process.stdout.write("ordinaire est arrêtée par la garde de rôle.\n\n");
  process.stdout.write("[audit-pays] le validateur mord, sur les 47 contrôles.\n");
  process.exit(0);
}
process.stderr.write(`\n[audit-pays] ÉCHEC — ${defauts.length} défaut(s) :\n`);
for (const d of defauts) process.stderr.write(`  ${d}\n`);
process.exit(1);
