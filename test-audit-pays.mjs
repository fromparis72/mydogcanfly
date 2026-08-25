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
 * QUATRE-VINGT-QUATRE CAS : 0 (fixture conforme — manifeste complet avec une observation de
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
 * Puis 67-69 (contre-revue v5-sexies) : statut_http 404 gardé « consultee » et url_finale
 * locale — refusés PAR LE SCHÉMA DU MANIFESTE, même sur une observation écartée ; et une
 * pièce orpheline dans le run rougit — le manifeste est l'inventaire exact des pièces.
 * Puis 70-72 (contre-revue v5-septies) : l'inventaire est une BIJECTION — deux résultats
 * partageant les mêmes pièces (anciennes pièces retirées, matrice alignée) rougissent avec
 * les deux n nommés ; et `octets` est obligatoire (absent → schéma) et prouvé (falsifié →
 * ≠ taille réelle). La fixture crée UNE pièce par (résultat, champ).
 * Puis 73 (incident de collecte réelle) : l'extraction PDF TERMINE en temps borné sur un
 * flux adversarial — sous lot-a-2, retour-arrière exponentiel, jamais de retour.
 * Puis 74 (lot-a-4) : le chemin PDF probatoire est FERMÉ — un PDF comprimé portant un
 * opérateur textuel VALIDE produit la chaîne vide, immédiatement (la bombe de décompression
 * d'inflateSync est morte avec le chemin).
 * Puis 75-81 (contre-revues des 18 décisions) : le DOMAINE se prouve dans le MÊME objet
 * organisationDetails du JSON parsé (« website » réécrit rougit ; organisationName substitué
 * avec homonyme conservé dans personnelList rougit) ; promotion sans preuve de domaine
 * rougit ; « aucune_source_officielle » rougit face à une candidate étayante non instruite,
 * sans aucune consultation, ou avec une candidate INCONNUE (tentative ou non_evaluee — les
 * Seychelles) ; la règle d'étape 4, ACCOMPLIE (constante true de plein droit), rougit toute
 * projection supprimée, sans marqueur de données à retirer — la fixture porte sa propre
 * projection fidjienne dans son objects.json.
 * Puis 82-86 (multi-runs, contre-revue du second passage) : la fixture porte DEUX manifestes
 * aux n recouvrants — la résolution est composite (bon n, mauvais manifeste → rouge) ; un
 * manifeste modifié à chemin constant rougit par l'empreinte ; une ancienne URL recollectée
 * rompt le préfixe exact de la liste cumulative ; une entrée en attente de collecte est
 * verte mais COMPTÉE ; un manifeste supprimé encore référencé rougit.
 * Puis 87-90 (contre-revue du mécanisme multi-runs) : la CURATION est SCELLÉE — la queue
 * approuvée mais pas encore collectée ne se supprime pas (l'attaque népalaise), ne s'enfle
 * pas et ne se réécrit pas sans rescellement explicite (trois variantes, que le préfixe ne
 * voit pas) ; « a_instruire » est l'état légal de la collecte brute — cité par une preuve il
 * rougit, et `--exiger-audit-complet` rougit tant qu'il en reste un ; une version
 * d'extracteur hors des versions ADMISES gelées rougit — un manifeste immuable ne se
 * réaligne jamais.
 * Puis 91-96 (arbitrage du 25/08/2026) : la VALIDATION ÉDITORIALE HUMAINE — seconde voie
 * d'identité d'éditeur (validateur, date, motif) — passe au vert sur une preuve complète,
 * rougit datée du futur, rougit au motif indigent (schéma), ne lève PAS l'ancre (citation
 * réécrite rouge malgré la validation), ne fabrique PAS le fait métier (pièce capture
 * refusée pour la décisive), et ne remplace pas une observation consultée (tentative rouge).
 * Puis 97-99 (contre-revue de v5-sexdecies) : la validation NOMME ce qu'elle valide —
 * recopiée sur un autre éditeur (site validé ≠ hôte de la candidate) rouge ; nature validée
 * transposée rouge ; datée AVANT la consultation de son observation rouge.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, symlinkSync, mkdtempSync, rmSync, readdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { extraireTexte, detecterFormat, VERSION_EXTRACTEUR } from "./extraire-texte-lot-a.mjs";
import { empreinteListe } from "./verifier-base-lot-a.mjs";
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
const lancer = (cwd, args = []) => spawnSync("node", ["--import", "tsx", "valider-audit-pays.mjs", `--as-of=${AS_OF}`, ...args], { cwd, encoding: "utf-8" });

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
const CITATION_RATTACHEMENT = "La Biosecurity Authority of Fiji est instituée par la loi sur la biosécurité (pièce d'essai).";
const EXTRAIT_PDF = "Extrait temoin PDF du jeu d'essai, lot A.";
const CONTENU_HTML = `<html><body><h2>section témoin</h2><p>${EXTRAIT_TEMOIN}</p></body></html>`;
/* La capture d'annuaire porte, comme l'annuaire réel, l'appel initMinisterDetailPlaceholder
 * avec son objet organisationDetails ET une occurrence HOMONYME dans personnelList — que
 * l'extracteur ôte du texte dérivé : le site n'est PAS ancrable, seule l'ATTESTATION
 * D'ANNUAIRE le prouve, en lisant le MÊME sous-arbre organisationDetails (l'homonyme du
 * personnel ne compte pas — contre-revue). */
const CONTENU_HTML_RATTACHEMENT = `<html><head><script>initMinisterDetailPlaceholder({"homePageURL":"https://exemple.invalid","organisationDetails":{"organisationName":"Autorité témoin du jeu d'essai","organisationTypeCode":"Government Agencies","organisationData":{"city":"Suva","website":"http://www.baf.com.fj"}},"personnelList":[{"firstName":"Témoin","organisationName":"Autorité témoin du jeu d'essai"}]});</script></head><body><h2>section témoin de l'annuaire</h2><p>${CITATION_RATTACHEMENT}</p></body></html>`;
const ATTESTATION_TEMOIN = { organisation: "Autorité témoin du jeu d'essai",
  type_organisation: "Government Agencies", site_web: "http://www.baf.com.fj" };
/* La VALIDATION ÉDITORIALE HUMAINE témoin (arbitrage du 25/08/2026) : identité d'éditeur
 * validée par une personne — datée, motivée, nominative, et NOMMANT ce qu'elle valide
 * (éditeur, site, nature — contre-revue : une validation sans objet se recopiait sur une
 * autre candidate) ; jamais le fait métier. */
const VALIDATION_TEMOIN = { validateur: "Arbitre du jeu d'essai", date: JOUR,
  motif: "Validation éditoriale témoin du jeu d'essai : l'identité de l'éditeur est validée par l'arbitre.",
  editeur: "Autorité témoin du jeu d'essai", site_web: "http://www.baf.com.fj",
  nature_validee: "autorite_pays" };
const FLUX_PDF = `BT /F1 12 Tf 72 700 Td (${EXTRAIT_PDF}) Tj ET`;
const CONTENU_PDF = Buffer.from(`%PDF-1.4\n4 0 obj << /Length ${FLUX_PDF.length} >> stream\n${FLUX_PDF}\nendstream endobj\ntrailer\n%%EOF`);
const CONTENU_ENTETES = "HTTP/1.1 200 OK\n[en-tête expurgé : cookies/authentification/proxy]\nContent-Type: text/html; charset=utf-8\n";
const CONTENU_TRACE = "# trace témoin du jeu d'essai\n[ligne expurgée : proxy/authentification]\n";

/* Chaque RÉSULTAT a SES pièces (n-<n>.*) : l'inventaire du run est une BIJECTION — une pièce
 * appartient à un seul couple (résultat, champ), le partage rougit (contre-revue v5-septies).
 * Les fichiers sont créés une seule fois (mémoïsés) puis git-ajoutés en bloc. */
const M1 = "audit-pays-consultations.json";
const M2 = "audit-pays-consultations-2.json";
const refFixture = (manifeste, n) => ({ manifeste, manifeste_sha256: "0".repeat(64), n });
const fichiersCrees = new Set();
const ecrireFixture = (chemin, contenu) => {
  if (fichiersCrees.has(chemin)) return;
  writeFileSync(join(arbre, chemin), contenu);
  fichiersCrees.add(chemin);
};
const capturePourN = (n, contenu, contentType, run = "run-fixture") => {
  const buf = Buffer.isBuffer(contenu) ? contenu : Buffer.from(contenu);
  const ext = contentType.includes("pdf") ? "pdf" : "html";
  const chemin = `audit-pays-pieces/${run}/n-${n}.${ext}`;
  ecrireFixture(chemin, buf);
  const texte = extraireTexte(buf, contentType);
  const cheminTexte = `audit-pays-pieces/${run}/n-${n}.texte.txt`;
  ecrireFixture(cheminTexte, texte);
  return { chemin, sha256: sha256(buf), octets: buf.length, content_type: contentType,
    format_detecte: detecterFormat(buf),
    texte_derive: { chemin: cheminTexte, sha256: sha256(Buffer.from(texte)) },
    extracteur: VERSION_EXTRACTEUR };
};
const fichierPourN = (n, quoi, contenu, run = "run-fixture") => {
  const chemin = `audit-pays-pieces/${run}/n-${n}.${quoi}.txt`;
  ecrireFixture(chemin, contenu);
  return { chemin, sha256: sha256(Buffer.from(contenu)) };
};
/* La capture du MANIFESTE porte `octets` (obligatoire, confronté à la taille réelle) ; la
 * capture de la MATRICE et des preuves reste le contrat CaptureScellee, sans octets. */
const sansOctets = (cap) => { const { octets, ...reste } = cap; return reste; };

/** La fixture : matrice ET manifeste, construits d'une même énumération — le manifeste
 *  porte les observations, la matrice les référence par manifeste_n et n'ajoute que le
 *  jugement. Une candidate PDF (country_bs[1]) montre la forme licite : sa pièce est sa
 *  capture, jamais un extrait. */
function fabriquerJeu(guides, scelle) {
  const audits = {};
  const resultats = [];
  let n = 0;
  for (const id of Object.keys(scelle.pays)) {
    const candidates = guides[id].sources.map((s, i) => {
      n++;
      const estPdf = id === "country_bs" && i === 1;
      const cap = estPdf ? capturePourN(n, CONTENU_PDF, "application/pdf")
                         : capturePourN(n, CONTENU_HTML, "text/html; charset=utf-8");
      const entetes = fichierPourN(n, "entetes", CONTENU_ENTETES);
      const trace = { type: "transcript", ...fichierPourN(n, "trace", CONTENU_TRACE) };
      resultats.push({
        n, role: "candidate", country_id: id, index_lien: i, label: s.label, url_publiee: s.url,
        acces: "consultee", statut_http: 200, url_finale: s.url, redirections: 0,
        consultee_le: JOUR, content_type: cap.content_type,
        capture: JSON.parse(JSON.stringify(cap)),
        entetes: { ...entetes }, trace: { ...trace },
      });
      return {
        observation: refFixture(M1, n), label: s.label, url_publiee: s.url, acces: "consultee",
        url_finale: s.url, statut_http: 200, consultee_le: JOUR,
        capture: sansOctets(cap), entetes: { ...entetes }, trace: { ...trace },
        piece: estPdf ? { type: "capture", chemin: cap.chemin, sha256: cap.sha256 }
                      : { type: "extrait", extrait: EXTRAIT_TEMOIN, langue: "en", locator: "section témoin" },
        /* pertinence JUGÉE (page_generique) : « aucune_source_officielle » exige désormais
         * qu'aucune candidate ne reste inconnue — ni tentative, ni non_evaluee. */
        nature_editeur: "non_etabli", preuves_rattachement: [], pertinence: "page_generique",
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
  const capRatt = capturePourN(n, CONTENU_HTML_RATTACHEMENT, "text/html; charset=utf-8");
  resultats.push({
    n: nRattachement, role: "rattachement",
    url_demandee: "https://example.org/annuaire-temoin", motif: "Annuaire témoin du jeu d'essai.",
    acces: "consultee", statut_http: 200, url_finale: "https://example.org/annuaire-temoin",
    redirections: 0, consultee_le: JOUR, content_type: capRatt.content_type,
    capture: JSON.parse(JSON.stringify(capRatt)),
    entetes: fichierPourN(n, "entetes", CONTENU_ENTETES),
    trace: { type: "transcript", ...fichierPourN(n, "trace", CONTENU_TRACE) },
  });
  n++;
  const nRattachementPdf = n;
  const capRattPdf = capturePourN(n, CONTENU_PDF, "application/pdf");
  resultats.push({
    n: nRattachementPdf, role: "rattachement",
    url_demandee: "https://example.org/document-pdf-temoin", motif: "Document PDF témoin du jeu d'essai.",
    acces: "consultee", statut_http: 200, url_finale: "https://example.org/document-pdf-temoin",
    redirections: 0, consultee_le: JOUR, content_type: capRattPdf.content_type,
    capture: JSON.parse(JSON.stringify(capRattPdf)),
    entetes: fichierPourN(n, "entetes", CONTENU_ENTETES),
    trace: { type: "transcript", ...fichierPourN(n, "trace", CONTENU_TRACE) },
  });
  n++;
  const nRattachementTentative = n;
  resultats.push({
    n: nRattachementTentative, role: "rattachement",
    url_demandee: "https://example.org/annuaire-injoignable", motif: "Annuaire injoignable du jeu d'essai.",
    acces: "tentative", tentee_le: JOUR, resultat: "HTTP 403",
    trace: { type: "transcript", ...fichierPourN(n, "trace", CONTENU_TRACE) },
  });
  /* country_fj : la promotion complète et concordante, rattachement ancré dans sa capture. */
  const fj = audits.country_fj;
  const c0 = fj.candidates[0];
  c0.nature_editeur = "autorite_pays";
  c0.preuves_rattachement = [{ observation: refFixture(M1, nRattachement),
    citation: quoteFixture(CITATION_RATTACHEMENT), capture: sansOctets(capRatt),
    attestation_annuaire: { ...ATTESTATION_TEMOIN } }];
  c0.pertinence = "etaye_le_fait";
  fj.decision = {
    statut: "promue", observation_decisive: 0,
    source: {
      url: c0.url_finale, source_type: "official_website",
      verified_date: JOUR, review_due: DUE, confidence: 3, reviewer: "Harnais lot A", history: [],
      quote: c0.piece.extrait, quote_language: c0.piece.langue, locator: c0.piece.locator,
    },
  };
  /* Le SECOND manifeste (multi-runs) : un rattachement de second run, n = 1 — le même n que
   * le premier résultat du manifeste 1 : seule la référence COMPOSITE lève l'ambiguïté. */
  const capRatt2 = capturePourN(1, CONTENU_HTML, "text/html; charset=utf-8", "run-fixture-2");
  const resultats2 = [{
    n: 1, role: "rattachement",
    url_demandee: "https://example.org/annuaire-second-run", motif: "Annuaire du second run (jeu d'essai).",
    acces: "consultee", statut_http: 200, url_finale: "https://example.org/annuaire-second-run",
    redirections: 0, consultee_le: JOUR, content_type: capRatt2.content_type,
    capture: JSON.parse(JSON.stringify(capRatt2)),
    entetes: fichierPourN(1, "entetes", CONTENU_ENTETES, "run-fixture-2"),
    trace: { type: "transcript", ...fichierPourN(1, "trace", CONTENU_TRACE, "run-fixture-2") },
  }];
  return {
    matrice: { audits, rattachements: {
      [`${M1}#${nRattachement}`]: { statut: "utilisee" },
      [`${M1}#${nRattachementPdf}`]: { statut: "ecartee", motif: "PDF : aucune preuve textuelle en lot-a-1 (jeu d'essai)." },
      [`${M1}#${nRattachementTentative}`]: { statut: "ecartee", motif: "Tentative : la page n'a pas été obtenue (jeu d'essai)." },
      /* L'observation du second run reste À INSTRUIRE : l'état LÉGAL de la collecte brute —
       * comptée, jamais probatoire, refusée par --exiger-audit-complet (cas 88-89). */
      [`${M2}#1`]: { statut: "a_instruire" },
    } },
    manifeste: { consultees_le: JOUR, run: "audit-pays-pieces/run-fixture", total: n,
      candidates: n - 3, rattachements: 3, extracteur: VERSION_EXTRACTEUR, resultats },
    manifeste2: { consultees_le: JOUR, run: "audit-pays-pieces/run-fixture-2", total: 1,
      candidates: 0, rattachements: 1, extracteur: VERSION_EXTRACTEUR, resultats: resultats2 },
    liste: resultats.concat(resultats2).filter((r) => r.role === "rattachement").map((r) => ({ url: r.url_demandee, motif: r.motif })),
    captureRattachement: sansOctets(capRatt),
    capturePdf: sansOctets(capRattPdf),
  };
}

try {
  const ajout = gitWt("add", "--detach", arbre, "HEAD");
  if (ajout.status !== 0) throw new Error(`git worktree add : ${(ajout.stderr || "").trim()}`);
  symlinkSync(resolve("node_modules"), join(arbre, "node_modules"));
  copyFileSync("valider-audit-pays.mjs", join(arbre, "valider-audit-pays.mjs"));
  copyFileSync("verifier-base-lot-a.mjs", join(arbre, "verifier-base-lot-a.mjs"));
  copyFileSync("extraire-texte-lot-a.mjs", join(arbre, "extraire-texte-lot-a.mjs"));
  copyFileSync("liste-rattachements-lot-a.mjs", join(arbre, "liste-rattachements-lot-a.mjs"));
  copyFileSync("etat-reference-lot-a.json", join(arbre, "etat-reference-lot-a.json"));
  mkdirSync(join(arbre, "audit-pays-pieces"), { recursive: true });

  const guides = JSON.parse(readFileSync(join(arbre, "packages/ui/src/data/countries.generated.json"), "utf-8"));
  const scelle = JSON.parse(readFileSync(join(arbre, "etat-reference-lot-a.json"), "utf-8"));
  const CHEMIN_MATRICE = join(arbre, "audit-pays.json");
  const CHEMIN_OBJETS = join(arbre, "packages/knowledge/raw/objects.json");
  const objetsPristins = readFileSync(CHEMIN_OBJETS, "utf-8");
  /* Depuis l'étape 4, la projection est INCONDITIONNELLE : la fixture porte SA projection
   * fidjienne (dérivée de sa propre promotion d'essai) et retire les projections RÉELLES
   * des 18 (fj, om) — le monde de la fixture est cohérent avec sa matrice, pas avec le
   * dépôt. objetsFixture est le nouvel état de référence de l'arbre jetable. */
  let objetsFixture = null;   // posé après fabrication du jeu

  /* Les pièces-fixtures : une par (résultat, champ) — brut, texte dérivé (extracteur
   * versionné), en-têtes, trace — créées par fabriquerJeu puis git-ajoutées EN BLOC.
   * (Le PDF « scanné » de la fixture historique a été retiré : référencé par personne,
   * il serait une pièce ORPHELINE du run — l'inventaire exact le refuserait, à raison.) */
  mkdirSync(join(arbre, "audit-pays-pieces/run-fixture"), { recursive: true });
  mkdirSync(join(arbre, "audit-pays-pieces/run-fixture-2"), { recursive: true });
  /* Les manifestes RÉELS du dépôt (présents dans HEAD) sont écartés de l'arbre de travail :
   * la fixture est le seul monde observable du harnais. */
  for (const f of readdirSync(arbre).filter((x) => /^audit-pays-consultations(-\d+)?\.json$/.test(x))) {
    rmSync(join(arbre, f), { force: true });
  }

  const poser = (m) => writeFileSync(CHEMIN_MATRICE, JSON.stringify(m, null, 2));
  const CHEMIN_MANIFESTE = join(arbre, "audit-pays-consultations.json");
  const CHEMIN_MANIFESTE_2 = join(arbre, "audit-pays-consultations-2.json");
  const jeu0 = fabriquerJeu(guides, scelle);
  {
    const o = JSON.parse(objetsPristins);
    const s = jeu0.matrice.audits.country_fj.decision.source;
    for (const id of Object.keys(scelle.pays)) delete o.countries.find((c) => c.id === id)?.source;
    o.countries.find((c) => c.id === "country_fj").source = { url: s.url, source_type: s.source_type,
      verified_date: s.verified_date, review_due: s.review_due, confidence: s.confidence,
      reviewer: s.reviewer, history: s.history ?? [] };
    objetsFixture = JSON.stringify(o, null, 2);
    writeFileSync(CHEMIN_OBJETS, objetsFixture);
  }
  gitArbre("add", "--", "audit-pays-pieces/run-fixture", "audit-pays-pieces/run-fixture-2");
  const manifestePristin = JSON.stringify(jeu0.manifeste, null, 2);
  const manifestePristin2 = JSON.stringify(jeu0.manifeste2, null, 2);
  writeFileSync(CHEMIN_MANIFESTE, manifestePristin);
  writeFileSync(CHEMIN_MANIFESTE_2, manifestePristin2);
  const shaFichier = (chemin) => sha256(readFileSync(chemin));
  /* Les références composites de la matrice sont RESCELLÉES sur les manifestes tels qu'ils
   * sont sur disque — après toute mutation de manifeste, pour que l'immuabilité ne masque
   * pas le défaut visé par un cas. */
  const rescellerRefs = (m) => {
    const shas = { [M1]: shaFichier(CHEMIN_MANIFESTE), [M2]: shaFichier(CHEMIN_MANIFESTE_2) };
    for (const a of Object.values(m.audits)) {
      for (const c of a.candidates) {
        if (c.observation && shas[c.observation.manifeste]) c.observation.manifeste_sha256 = shas[c.observation.manifeste];
        for (const pr of c.preuves_rattachement ?? []) {
          if (pr.observation && shas[pr.observation.manifeste]) pr.observation.manifeste_sha256 = shas[pr.observation.manifeste];
        }
      }
    }
    return m;
  };
  const matricePristine = JSON.stringify(rescellerRefs(jeu0.matrice), null, 2);
  /* La liste versionnée des rattachements — le manifeste doit lui être EXACTEMENT égal —
   * et son SCEAU DE CURATION (cardinalité + empreinte canonique), que tout changement
   * légitime de la liste doit resceller (cas 85), et qu'aucune mutation ne contourne (87). */
  const poserSceau = (liste) => writeFileSync(join(arbre, "etat-curation-rattachements.json"),
    JSON.stringify({ total: liste.length, empreinte_liste: empreinteListe(liste) }, null, 2));
  writeFileSync(join(arbre, "rattachements-a-consulter.json"), JSON.stringify(jeu0.liste, null, 2));
  poserSceau(jeu0.liste);
  const neuve = () => JSON.parse(matricePristine);
  const neuveManifeste = () => JSON.parse(manifestePristin);
  const preuveTemoin = (n = 92) => ({
    observation: { manifeste: M1, manifeste_sha256: shaFichier(CHEMIN_MANIFESTE), n },
    citation: quoteFixture(CITATION_RATTACHEMENT),
    capture: JSON.parse(JSON.stringify(jeu0.captureRattachement)),
  });

  /** Mute une matrice neuve (et, si demandé, une copie du manifeste), pose, lance, exige 1 + motifs. */
  const cas = (nom, muter, motifs, muterManifeste = null) => {
    const m = neuve();
    muter(m);
    if (muterManifeste) {
      const mf = neuveManifeste();
      muterManifeste(mf);
      writeFileSync(CHEMIN_MANIFESTE, JSON.stringify(mf, null, 2));
      rescellerRefs(m);
    }
    poser(m);
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
    const o = JSON.parse(objetsFixture);
    o.countries.find((c) => c.id === "country_bs").source = {
      url: "https://example.org/x", source_type: "government", verified_date: JOUR,
      review_due: DUE, confidence: 3, reviewer: "X", history: [] };
    writeFileSync(CHEMIN_OBJETS, JSON.stringify(o, null, 2));
  }, [/country_bs/, /la matrice fait foi/]);
  writeFileSync(CHEMIN_OBJETS, objetsFixture);
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
    /* La candidate PDF licite (pièce = capture) reçoit un extrait : l'interdiction doit
     * frapper PAR LE FORMAT, avant tout ancrage — depuis lot-a-4 le texte dérivé d'un PDF
     * est vide par construction, l'interdiction reste le premier rempart nommé. */
    bs(m).candidates[1].piece = { type: "extrait", extrait: EXTRAIT_PDF, langue: "en", locator: "page 1" };
  }, [/country_bs/, /pièce EXTRAIT depuis un PDF/]);
  cas("51 rattachement depuis un PDF", (m) => {
    const preuve = preuveTemoin();
    preuve.capture = JSON.parse(JSON.stringify(jeu0.capturePdf));
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
    const c = bs(m).candidates[1];
    c.capture = { ...c.capture, content_type: "text/plain", format_detecte: "autre" };
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
  cas("56 rattachement sans référence d'observation", (m) => {
    delete fj(m).candidates[0].preuves_rattachement[0].observation;
  }, [/schéma/, /observation/]);
  cas("57 pièce du manifeste hors du répertoire de run", (m) => { /* matrice inchangée */ }, [
    /hors du répertoire de run déclaré/,
  ], (mf) => {
    mf.resultats[0].capture.chemin = "packages/knowledge/raw/objects.json";
  });

  /* ---- 58-63 · décisions de rattachement et ensemble exact (contre-revue v5-quater) ---------- */
  cas("58 rattachement sans décision", (m) => {
    delete m.rattachements[Object.keys(m.rattachements).find((k) => k !== `${M1}#92`)];
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
    /PRÉFIXE EXACT de la liste cumulative/,
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
    /audit-pays-consultations\.json — n \d+ \(rattachement/, /ne désigne aucun fichier/,
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
    p.observation = { ...c.observation };
    p.citation.url = c.url_finale;
    p.citation.quote = EXTRAIT_TEMOIN;
    p.capture = JSON.parse(JSON.stringify(c.capture));
    m.rattachements[`${M1}#92`] = { statut: "ecartee", motif: "Écartée pour couvrir le contournement (jeu d'essai)." };
  }, [/country_fj/, /rôle « candidate »/, /liste versionnée ne se contourne pas/]);

  /* ---- 67-69 · le contrat des observations au schéma du manifeste, l'inventaire exact du run
   *             (contre-revue v5-sexies) ------------------------------------------------------ */
  cas("67 rattachement écarté en 404 gardé « consultee »", (m) => { /* matrice inchangée, décision ecartee conservée */ }, [
    /schéma du MANIFESTE .* refusé/,
  ], (mf) => {
    const pdf = mf.resultats.find((x) => x.role === "rattachement" && /document-pdf/.test(x.url_demandee));
    pdf.statut_http = 404;
  });
  cas("68 rattachement écarté à url_finale locale", (m) => { /* matrice inchangée, décision ecartee conservée */ }, [
    /schéma du MANIFESTE .* refusé/,
  ], (mf) => {
    const pdf = mf.resultats.find((x) => x.role === "rattachement" && /document-pdf/.test(x.url_demandee));
    pdf.url_finale = "file:///etc/passwd";
  });
  {
    /* 69 — une pièce présente dans le run mais référencée par personne : le manifeste doit
     * être l'inventaire EXACT des pièces, l'orpheline rougit. */
    const orpheline = join(arbre, "audit-pays-pieces/run-fixture/orpheline-69.txt");
    writeFileSync(orpheline, "pièce présente dans le run mais référencée par aucun résultat");
    poser(neuve());
    const r = lancer(arbre);
    rmSync(orpheline, { force: true });
    if (r.status !== 1) echec("69 pièce orpheline dans le run", `sortie ${r.status} au lieu de 1 — le run n'est pas un inventaire exact`);
    else if (!/ORPHELINE/.test(r.stderr) || !/orpheline-69\.txt/.test(r.stderr)) {
      echec("69 pièce orpheline dans le run", `le diagnostic ne nomme pas l'orpheline — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 5).join("\n      ")}`);
    }
  }

  /* ---- 70-72 · la bijection de l'inventaire, et octets prouvé (contre-revue v5-septies) ------ */
  {
    /* 70 — deux résultats PARTAGEANT les mêmes pièces, les anciennes pièces du second retirées
     * du run : l'ensemble reste exact (rien d'orphelin, tout existe), la matrice est ALIGNÉE
     * pour que l'égalité champ à champ passe — seule la BIJECTION peut le voir, et elle doit
     * nommer les deux n. */
    const mf = neuveManifeste();
    const A = mf.resultats.find((x) => x.n === 1);
    const B = mf.resultats.find((x) => x.n === 2);
    const anciens = [B.capture.chemin, B.capture.texte_derive.chemin, B.entetes.chemin, B.trace.chemin];
    const sauvegardes = anciens.map((c) => [c, readFileSync(join(arbre, c))]);
    B.capture = JSON.parse(JSON.stringify(A.capture));
    B.entetes = { ...A.entetes };
    B.trace = { ...A.trace };
    const m = neuve();
    const candB = Object.values(m.audits).flatMap((a) => a.candidates).find((c) => c.observation.n === 2);
    candB.capture = JSON.parse(JSON.stringify(sansOctets(A.capture)));
    candB.entetes = { ...A.entetes };
    candB.trace = { ...A.trace };
    for (const c of anciens) rmSync(join(arbre, c), { force: true });
    poser(m);
    writeFileSync(CHEMIN_MANIFESTE, JSON.stringify(mf, null, 2));
    const r = lancer(arbre);
    for (const [c, contenu] of sauvegardes) writeFileSync(join(arbre, c), contenu);
    writeFileSync(CHEMIN_MANIFESTE, manifestePristin);
    if (r.status !== 1) echec("70 pièces partagées entre deux résultats", `sortie ${r.status} au lieu de 1 — l'inventaire n'est qu'un ensemble, pas une bijection`);
    else {
      if (!/PLUSIEURS couples/.test(r.stderr)) {
        echec("70 pièces partagées entre deux résultats", `le diagnostic ne nomme pas le partage — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 5).join("\n      ")}`);
      }
      if (!/n 1 \(/.test(r.stderr) || !/n 2 \(/.test(r.stderr)) {
        echec("70 pièces partagées entre deux résultats", `les DEUX n ne sont pas nommés — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 5).join("\n      ")}`);
      }
    }
  }
  cas("71 octets absent du manifeste", (m) => { /* matrice inchangée */ }, [
    /schéma du MANIFESTE .* refusé/,
  ], (mf) => { delete mf.resultats[0].capture.octets; });
  cas("72 octets falsifié", (m) => { /* matrice inchangée */ }, [
    /capture\.octets/, /taille réelle/,
  ], (mf) => { mf.resultats[0].capture.octets += 1; });

  /* ---- 73 · l'extraction PDF TERMINE en temps borné sur un flux adversarial ------------------
   * [incident de collecte réelle du 24/08/2026 : la regex TJ de lot-a-2 était ambiguë — un
   * flux dégonflé portant « [ » puis des groupes « (…) » sans « ] » se lisait en 2^k façons ;
   * mesuré : 0,5 s à 20 groupes, 19 s à 28, >100 s à 32. À 40 groupes, lot-a-2 ne rend
   * JAMAIS la main — lot-a-3 termine en quelques millisecondes.] */
  {
    const code = [
      'import { extraireTexte } from "./extraire-texte-lot-a.mjs";',
      'import { deflateSync } from "node:zlib";',
      'const flux = deflateSync(Buffer.from("[" + "(a)".repeat(40) + " sans crochet fermant", "latin1"));',
      'const pdf = Buffer.concat([Buffer.from("%PDF-1.4\\n1 0 obj << >> stream\\n", "latin1"),',
      '  flux, Buffer.from("\\nendstream\\ntrailer\\n%%EOF", "latin1")]);',
      'extraireTexte(pdf, "application/pdf");',
      'process.stdout.write("TERMINE");',
    ].join("\n");
    const r = spawnSync("node", ["--input-type=module", "-e", code], { cwd: arbre, encoding: "utf-8", timeout: 20000 });
    if (r.stdout !== "TERMINE") {
      echec("73 extraction PDF bornée", `l'extracteur n'a pas terminé en 20 s sur le flux adversarial (40 groupes) — retour-arrière exponentiel`);
    }
  }

  /* ---- 74 · le chemin PDF probatoire est FERMÉ, pas seulement borné --------------------------
   * [contre-revue lot-a-3 : `inflateSync` décompressait SANS LIMITE — 32 699 octets bruts
   * → 33 554 432 octets dégonflés (×1026, +67,5 MiB) sous la borne de 25 MiB qui ne
   * s'applique qu'au comprimé. lot-a-4 : un PDF comprimé portant un opérateur textuel
   * VALIDE produit malgré tout la chaîne vide, immédiatement — ni décompression, ni
   * analyse.] */
  {
    const flux = deflateSync(Buffer.from("BT /F1 12 Tf 72 700 Td (Bonjour, opérateur textuel valide.) Tj ET", "latin1"));
    const pdf = Buffer.concat([
      Buffer.from(`%PDF-1.4\n4 0 obj << /Length ${flux.length} /Filter /FlateDecode >> stream\n`, "latin1"),
      flux,
      Buffer.from("\nendstream endobj\ntrailer\n%%EOF", "latin1"),
    ]);
    const t0 = Date.now();
    const texte = extraireTexte(pdf, "application/pdf");
    const duree = Date.now() - t0;
    if (texte !== "") {
      echec("74 chemin PDF probatoire fermé", `l'extracteur a produit du texte depuis un PDF (« ${texte.slice(0, 40)} ») — lot-a-4 doit retourner la chaîne VIDE`);
    }
    if (duree > 5000) {
      echec("74 chemin PDF probatoire fermé", `${duree} ms — le PDF ne doit être ni décompressé ni analysé`);
    }
  }

  /* ---- 75-79 · le domaine se prouve, les négatifs sont honnêtes, la projection est
   *             bidirectionnelle (contre-revue des 18 décisions) ------------------------------ */
  {
    /* 75 — l'attaque exacte : « website » remplacé par un autre domaine DANS LA CAPTURE BRUTE,
     * empreintes recalculées dans le manifeste ET la matrice, citation et texte dérivé
     * intacts — seule l'attestation d'annuaire mécanique peut le voir. */
    const chemin92 = "audit-pays-pieces/run-fixture/n-92.html";
    const brutAvant = readFileSync(join(arbre, chemin92));
    const brutMute = Buffer.from(brutAvant.toString("latin1").replace("www.baf.com.fj", "www.bad.com.fj"), "latin1");
    writeFileSync(join(arbre, chemin92), brutMute);
    const shaMute = sha256(brutMute);
    const m = neuve();
    const mf = neuveManifeste();
    const res92 = mf.resultats.find((x) => x.n === 92);
    res92.capture.sha256 = shaMute;
    res92.capture.octets = brutMute.length;
    const preuve = m.audits.country_fj.candidates[0].preuves_rattachement[0];
    preuve.capture.sha256 = shaMute;
    writeFileSync(CHEMIN_MANIFESTE, JSON.stringify(mf, null, 2));
    rescellerRefs(m);
    poser(m);
    const r = lancer(arbre);
    writeFileSync(join(arbre, chemin92), brutAvant);
    writeFileSync(CHEMIN_MANIFESTE, manifestePristin);
    if (r.status !== 1) echec("75 domaine réécrit dans la capture brute", `sortie ${r.status} au lieu de 1 — bad.com.fj passe encore`);
    else if (!/organisationDetails/.test(r.stderr) || !/organisationData\.website NON/.test(r.stderr)) {
      echec("75 domaine réécrit dans la capture brute", `le diagnostic ne vient pas du sous-arbre organisationDetails — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 5).join("\n      ")}`);
    }
  }
  cas("76 promotion sans preuve de domaine", (m) => {
    /* attestation retirée, citation intacte (elle n'ancre pas l'hôte) : la garde de
     * promotion doit exiger la preuve de domaine. */
    delete m.audits.country_fj.candidates[0].preuves_rattachement[0].attestation_annuaire;
  }, [/country_fj/, /DOMAINE de la candidate décisive n'est PAS prouvé/]);
  {
    /* 80 — l'attaque exacte de la contre-revue : SEUL le organisationName du sous-arbre
     * organisationDetails est remplacé par une autre organisation ; l'occurrence HOMONYME de
     * personnelList est conservée ; type et website intacts ; empreintes rescellées partout.
     * Les sous-chaînes éparses laissaient passer — le parse du même objet rougit. */
    const chemin92 = "audit-pays-pieces/run-fixture/n-92.html";
    const brutAvant = readFileSync(join(arbre, chemin92));
    const texte = brutAvant.toString("utf-8");
    const brutMute = Buffer.from(texte.replace(
      '"organisationDetails":{"organisationName":"Autorité témoin du jeu d\'essai"',
      '"organisationDetails":{"organisationName":"Autre organisation substituée"'), "utf-8");
    if (brutMute.equals(brutAvant)) echec("80 organisationName substitué", "la mutation n'a pas eu lieu — motif introuvable");
    writeFileSync(join(arbre, chemin92), brutMute);
    const shaMute = sha256(brutMute);
    const m = neuve();
    const mf = neuveManifeste();
    const res92 = mf.resultats.find((x) => x.n === 92);
    res92.capture.sha256 = shaMute;
    res92.capture.octets = brutMute.length;
    m.audits.country_fj.candidates[0].preuves_rattachement[0].capture.sha256 = shaMute;
    writeFileSync(CHEMIN_MANIFESTE, JSON.stringify(mf, null, 2));
    rescellerRefs(m);
    poser(m);
    const r = lancer(arbre);
    writeFileSync(join(arbre, chemin92), brutAvant);
    writeFileSync(CHEMIN_MANIFESTE, manifestePristin);
    if (r.status !== 1) echec("80 organisationName substitué", `sortie ${r.status} au lieu de 1 — l'homonyme du personnel maintient le vert`);
    else if (!/organisationName NON/.test(r.stderr)) {
      echec("80 organisationName substitué", `le diagnostic ne nomme pas organisationName — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 5).join("\n      ")}`);
    }
  }
  cas("81 « aucune_source_officielle » avec une candidate non évaluée", (m) => {
    /* les Seychelles de la contre-revue : une pertinence non_evaluee subsiste, conclure à
     * l'absence est une surqualification. */
    bs(m).candidates[0].pertinence = "non_evaluee";
  }, [/country_bs/, /reste INCONNUE/, /aucune_source_promouvable_dans_ce_run/]);
  cas("77 « aucune_source_officielle » malgré une candidate étayante non instruite", (m) => {
    bs(m).candidates[0].pertinence = "etaye_le_fait";
  }, [/country_bs/, /ÉTAYE LE FAIT sans nature instruite/, /aucune_source_promouvable_dans_ce_run/]);
  cas("78 « aucune_source_officielle » sans aucune consultation", (m) => {
    /* toutes les candidates du pays deviennent des tentatives — zéro page lue ne conclut
     * pas à l'absence de source (cas des Maldives). */
    bs(m).candidates = bs(m).candidates.map((c) => ({
      observation: c.observation, label: c.label, url_publiee: c.url_publiee,
      acces: "tentative", tentee_le: JOUR, resultat: "HTTP 403", trace: { ...c.trace },
      nature_editeur: "non_etabli", preuves_rattachement: [], pertinence: "non_evaluee",
    }));
  }, [/country_bs/, /sans AUCUNE consultation/], (mf) => {
    for (const x of mf.resultats) {
      if (x.role === "candidate" && x.country_id === "country_bs") {
        for (const k of ["acces", "statut_http", "url_finale", "redirections", "consultee_le", "content_type", "capture", "entetes"]) delete x[k];
        x.acces = "tentative"; x.tentee_le = JOUR; x.resultat = "HTTP 403";
      }
    }
  });
  {
    /* 79 — l'étape 4 est ACCOMPLIE : la constante est true DE PLEIN DROIT dans le validateur
     * livré — supprimer la projection d'une promue rougit, sans qu'aucun marqueur de données
     * ne puisse partir avec la source (contre-revue : « source et marqueur retirés
     * ensemble » ; contre-épreuve de la suppression exigée à l'étape 4). */
    const o = JSON.parse(objetsFixture);
    delete o.countries.find((c) => c.id === "country_fj").source;
    writeFileSync(CHEMIN_OBJETS, JSON.stringify(o, null, 2));
    poser(neuve());
    const r = lancer(arbre);
    writeFileSync(CHEMIN_OBJETS, objetsFixture);
    if (r.status !== 1) echec("79 étape 4 : projection supprimée", `sortie ${r.status} au lieu de 1 — la règle inconditionnelle ne mord pas`);
    else if (!/country_fj/.test(r.stderr) || !/SANS PROJECTION/.test(r.stderr)) {
      echec("79 étape 4 : projection supprimée", `le diagnostic ne nomme pas la projection manquante — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 5).join("\n      ")}`);
    }
  }

  /* ---- 82-86 · multi-runs : références composites, manifestes immuables (contre-revue du
   *             second passage). La fixture conforme porte DEUX manifestes dont les n se
   *             recouvrent (n = 1 dans chacun) : le cas 0 prouve déjà l'absence d'ambiguïté. */
  cas("82 référence au bon n mais au mauvais manifeste", (m) => {
    /* n 92 existe dans le manifeste 1, pas dans le 2 : la résolution est PAR MANIFESTE,
     * jamais par numéro nu. */
    const p = fj(m).candidates[0].preuves_rattachement[0];
    p.observation = { manifeste: M2, manifeste_sha256: shaFichier(CHEMIN_MANIFESTE_2), n: 92 };
  }, [/country_fj/, /aucun résultat du manifeste « audit-pays-consultations-2\.json »/, /jamais par numéro nu/]);
  {
    /* 83 — manifeste 1 modifié à CHEMIN CONSTANT (un octet ajouté, JSON toujours valide),
     * références de la matrice NON rescellées : l'immuabilité rougit par l'empreinte. */
    writeFileSync(CHEMIN_MANIFESTE, manifestePristin + "\n");
    poser(neuve());
    const r = lancer(arbre);
    writeFileSync(CHEMIN_MANIFESTE, manifestePristin);
    if (r.status !== 1) echec("83 manifeste modifié à chemin constant", `sortie ${r.status} au lieu de 1 — un manifeste publié n'est plus immuable`);
    else if (!/IMMUABLE|empreinte/.test(r.stderr)) {
      echec("83 manifeste modifié à chemin constant", `le diagnostic ne nomme pas l'immuabilité — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 5).join("\n      ")}`);
    }
  }
  {
    /* 84 — une ANCIENNE URL recollectée dans le second run : l'observation du manifeste 2
     * duplique une URL du manifeste 1 — le préfixe exact de la liste cumulative rompt. */
    const mf2 = JSON.parse(manifestePristin2);
    mf2.resultats[0].url_demandee = "https://example.org/annuaire-temoin";
    mf2.resultats[0].url_finale = "https://example.org/annuaire-temoin";
    writeFileSync(CHEMIN_MANIFESTE_2, JSON.stringify(mf2, null, 2));
    const m = rescellerRefs(neuve());
    poser(m);
    const r = lancer(arbre);
    writeFileSync(CHEMIN_MANIFESTE_2, manifestePristin2);
    if (r.status !== 1) echec("84 ancienne URL recollectée", `sortie ${r.status} au lieu de 1 — la recollecte d'une URL déjà observée passe`);
    else if (!/PRÉFIXE EXACT/.test(r.stderr)) {
      echec("84 ancienne URL recollectée", `le diagnostic ne nomme pas le préfixe — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 5).join("\n      ")}`);
    }
  }
  {
    /* 85 — une entrée de liste PAS ENCORE observée est l'état légitime entre curation et
     * collecte : vert, mais JAMAIS silencieux — le compte « EN ATTENTE » est affiché. La
     * curation est RESCELLÉE avec la liste : c'est le geste légitime, d'un seul mouvement. */
    const CHEMIN_LISTE = join(arbre, "rattachements-a-consulter.json");
    const listePristine = readFileSync(CHEMIN_LISTE, "utf-8");
    const liste = JSON.parse(listePristine);
    liste.push({ url: "https://example.org/annuaire-en-attente", motif: "Entrée curée, pas encore collectée (jeu d'essai)." });
    writeFileSync(CHEMIN_LISTE, JSON.stringify(liste, null, 2));
    poserSceau(liste);
    poser(neuve());
    const r = lancer(arbre);
    writeFileSync(CHEMIN_LISTE, listePristine);
    poserSceau(JSON.parse(listePristine));
    if (r.status !== 0) echec("85 entrée en attente de collecte", `sortie ${r.status} au lieu de 0 — l'état intermédiaire légitime rougit :\n      ${r.stderr.trim().split("\n").slice(0, 4).join("\n      ")}`);
    else if (!/1 rattachement\(s\) EN ATTENTE de collecte/.test(r.stdout)) {
      echec("85 entrée en attente de collecte", `le compte rendu ne nomme pas l'attente — reçu : ${r.stdout.trim()}`);
    }
  }
  {
    /* 86 — le manifeste 1 SUPPRIMÉ alors que la matrice le référence encore. */
    rmSync(CHEMIN_MANIFESTE, { force: true });
    poser(neuve());
    const r = lancer(arbre);
    writeFileSync(CHEMIN_MANIFESTE, manifestePristin);
    if (r.status !== 1) echec("86 manifeste supprimé encore référencé", `sortie ${r.status} au lieu de 1`);
    else if (!/INTROUVABLE|ne se supprime pas|ABSENTE de tous les manifestes/.test(r.stderr)) {
      echec("86 manifeste supprimé encore référencé", `le diagnostic ne nomme pas la suppression — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 5).join("\n      ")}`);
    }
  }

  /* ---- 87-90 · curation scellée, a_instruire, versions gelées (contre-revue multi-runs) ------ */
  {
    /* 87 — la CURATION est SCELLÉE indépendamment du préfixe : l'état légitime « queue
     * approuvée, pas encore collectée » est posé AVEC rescellement (liste + sceau, le geste
     * du cas 85), puis trois attaques mutent la liste SANS resceller — l'entrée en attente
     * SUPPRIMÉE (l'attaque népalaise : le préfixe ne la voit pas, elle est après la partie
     * observée), une entrée AJOUTÉE hors curation, un MOTIF réécrit. Chacune rougit par le
     * scellé, jamais en silence. */
    const CHEMIN_LISTE = join(arbre, "rattachements-a-consulter.json");
    const listePristine = readFileSync(CHEMIN_LISTE, "utf-8");
    const enAttente = { url: "https://example.org/annuaire-cure-en-attente", motif: "Entrée curée en attente de collecte (jeu d'essai)." };
    const listeCuree = JSON.parse(listePristine).concat([enAttente]);
    const variantes = [
      ["entrée en attente supprimée", JSON.parse(listePristine)],
      ["entrée ajoutée hors curation", listeCuree.concat([{ url: "https://example.org/entree-inseree", motif: "Insérée sans curation (jeu d'essai)." }])],
      ["motif réécrit", listeCuree.map((e) => (e.url === enAttente.url ? { ...e, motif: "Motif réécrit après approbation (jeu d'essai)." } : e))],
    ];
    for (const [nom, listeMutee] of variantes) {
      writeFileSync(CHEMIN_LISTE, JSON.stringify(listeCuree, null, 2));
      poserSceau(listeCuree);
      writeFileSync(CHEMIN_LISTE, JSON.stringify(listeMutee, null, 2));   // la mutation, SANS resceller
      poser(neuve());
      const r = lancer(arbre);
      if (r.status !== 1) { echec(`87 curation non rescellée (${nom})`, `sortie ${r.status} au lieu de 1 — la curation se mute en silence`); continue; }
      if (!/curation/.test(r.stderr) || !/sans rescellement/.test(r.stderr)) {
        echec(`87 curation non rescellée (${nom})`, `le diagnostic ne vient pas du scellé de curation — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 5).join("\n      ")}`);
      }
    }
    writeFileSync(CHEMIN_LISTE, listePristine);
    poserSceau(JSON.parse(listePristine));
  }
  cas("88 observation À INSTRUIRE citée par une preuve", (m) => {
    /* la promotion fidjienne cite M1#92 ; l'observation passe « a_instruire » : l'état de
     * collecte brute n'est JAMAIS probatoire — l'instruction précède tout usage, la
     * promotion qui s'appuie dessus rougit avec elle. */
    m.rattachements[`${M1}#92`] = { statut: "a_instruire" };
  }, [/audit-pays-consultations\.json#92/, /À INSTRUIRE mais cité par une preuve/]);
  {
    /* 89 — le mode FINAL : `--exiger-audit-complet` rougit tant qu'il reste UNE observation
     * à instruire — la fixture pristine en porte une (le rattachement du second run). */
    poser(neuve());
    const r = lancer(arbre, ["--exiger-audit-complet"]);
    if (r.status !== 1) echec("89 mode final avec reste à instruire", `sortie ${r.status} au lieu de 1 — --exiger-audit-complet laisse passer un a_instruire`);
    else if (!/encore À INSTRUIRE/.test(r.stderr)) {
      echec("89 mode final avec reste à instruire", `le diagnostic ne nomme pas l'instruction restante — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 5).join("\n      ")}`);
    }
  }
  cas("90 version d'extracteur hors des versions admises", (m) => { /* matrice inchangée */ }, [
    /hors des versions ADMISES/, /ne se réaligne jamais/,
  ], (mf) => {
    /* le gel des versions (P1) : « lot-a-5 » n'existe pas dans le dispatch — le manifeste ET
     * la capture qui s'en réclament rougissent, on n'aligne jamais un manifeste immuable. */
    mf.extracteur = "lot-a-5";
    mf.resultats[0].capture.extracteur = "lot-a-5";
  });

  /* ---- 91-96 · la validation éditoriale humaine (arbitrage du 25/08/2026) : seconde voie
   *             d'identité d'éditeur — datée, motivée, nominative — qui ne lève AUCUNE garde
   *             mécanique et ne porte JAMAIS le fait métier ----------------------------------- */
  const basculerSurValidation = (m) => {
    const p = fj(m).candidates[0].preuves_rattachement[0];
    delete p.attestation_annuaire;
    p.validation_editeur = { ...VALIDATION_TEMOIN };
    return p;
  };
  {
    /* 91 — le chemin VERT : l'attestation mécanique retirée, la validation humaine suffit à
     * prouver l'identité d'éditeur de la décisive — toutes les autres gardes tiennent. */
    const m = neuve();
    basculerSurValidation(m);
    poser(m);
    const r = lancer(arbre);
    if (r.status !== 0) echec("91 validation éditoriale — chemin vert", `sortie ${r.status} :\n      ${r.stderr.trim().split("\n").slice(0, 5).join("\n      ")}`);
    else if (!/1 promue/.test(r.stdout)) echec("91 validation éditoriale — chemin vert", "le compte rendu n'annonce plus la promotion");
  }
  cas("92 validation éditoriale datée du futur", (m) => {
    basculerSurValidation(m).validation_editeur.date = "2026-08-25";   // > AS_OF
  }, [/validation éditoriale/, /POSTÉRIEURE à --as-of/]);
  cas("93 validation présente mais citation non ancrée", (m) => {
    /* la validation n'atteste que l'identité : une citation qui ne s'ancre plus dans la
     * capture rougit MALGRÉ la validation — le fait ne se décrète pas. */
    basculerSurValidation(m);
    fj(m).candidates[0].preuves_rattachement[0].citation.quote = "Citation réécrite, absente de la capture du jeu d'essai.";
  }, [/country_fj/, /INTROUVABLE dans le texte dérivé/]);
  cas("94 validation au motif indigent", (m) => {
    basculerSurValidation(m).validation_editeur.motif = "court";
  }, [/schéma/, /validation_editeur|motif/]);
  cas("95 validation ne fabrique pas le fait métier", (m) => {
    /* pièce décisive basculée en capture seule, validation présente : la promotion exige
     * toujours un EXTRAIT ancré — l'identité validée ne produit aucun fait. */
    basculerSurValidation(m);
    const chemin = join(arbre, "audit-pays-pieces/temoin-95.html");
    const contenu = "capture témoin pour la contre-épreuve quatre-vingt-quinze";
    writeFileSync(chemin, contenu);
    gitArbre("add", "--", "audit-pays-pieces/temoin-95.html");
    fj(m).candidates[0].piece = { type: "capture", chemin: "audit-pays-pieces/temoin-95.html",
      sha256: sha256(Buffer.from(contenu)) };
  }, [/country_fj/, /pièce décisive d'une promotion doit être un EXTRAIT/]);
  cas("96 validation sur une observation non consultée", (m) => {
    /* la preuve vise la TENTATIVE de rattachement : une validation humaine ne remplace ni
     * une observation ni sa capture — le rôle et l'accès restent exigés. */
    const p = basculerSurValidation(m);
    p.observation = { manifeste: M1, manifeste_sha256: shaFichier(CHEMIN_MANIFESTE), n: 94 };
    m.rattachements[`${M1}#94`] = { statut: "utilisee" };
    m.rattachements[`${M1}#92`] = { statut: "ecartee", motif: "Écartée pour la contre-épreuve quatre-vingt-seize (jeu d'essai)." };
  }, [/validation éditoriale/, /rattachement CONSULTÉE/]);
  cas("97 validation recopiée sur un autre éditeur", (m) => {
    /* l'attaque exacte de la contre-revue : la validation conçue pour un site se recopie
     * sur une candidate d'un AUTRE hôte — le site validé est un champ structuré, l'hôte
     * doit être exactement celui de la candidate. */
    basculerSurValidation(m).validation_editeur.site_web = "http://www.autre-autorite.example";
  }, [/validation éditoriale/, /site validé/, /ne se réutilise pas/]);
  cas("98 nature validée ≠ nature déclarée", (m) => {
    /* le domaine conservé mais la nature transposée : la validation nomme la nature qu'elle
     * valide, à égalité exacte avec celle que la matrice déclare. */
    basculerSurValidation(m).validation_editeur.nature_validee = "officiel_tiers";
  }, [/validation éditoriale/, /nature validée/, /ne se transpose pas/]);
  cas("99 validation antérieure à la consultation", (m) => {
    /* une validation FONDÉE sur une observation ne peut pas la précéder. */
    basculerSurValidation(m).validation_editeur.date = "2026-08-23";   // < consultee_le (JOUR)
  }, [/validation éditoriale/, /ANTÉRIEURE à la consultation/]);
} finally {
  gitWt("remove", "--force", arbre);
  rmSync(conteneur, { recursive: true, force: true });
}

/* ---- verdict ---------------------------------------------------------------------------------- */
if (defauts.length === 0) {
  process.stdout.write("84 cas éprouvés : la fixture conforme — DEUX manifestes immuables aux n recouvrants,\n");
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
  process.stdout.write("ordinaire est arrêtée par la garde de rôle ; la v5-sexies aussi : statut_http hors\n");
  process.stdout.write("2xx ou url_finale locale échouent AU SCHÉMA DU MANIFESTE même écartés, et une pièce\n");
  process.stdout.write("orpheline du run rougit — le manifeste est l'inventaire exact des pièces ; et la\n");
  process.stdout.write("v5-septies : l'inventaire est une BIJECTION (pièces partagées → les deux n nommés),\n");
  process.stdout.write("octets obligatoire au schéma et égal à la taille réelle du fichier ; le chemin PDF\n");
  process.stdout.write("probatoire est FERMÉ (lot-a-4) : un PDF comprimé à opérateur textuel valide produit\n");
  process.stdout.write("la chaîne vide, immédiatement — plus de décompression, plus d'analyse ; et la\n");
  process.stdout.write("contre-revue des 18 décisions est morte : le domaine se prouve dans le MÊME objet\n");
  process.stdout.write("organisationDetails du JSON parsé (bad.com.fj et le nom substitué rougissent, homonyme\n");
  process.stdout.write("du personnel conservé), les négatifs sont honnêtes (étayante non instruite, zéro\n");
  process.stdout.write("consultation, candidate inconnue — tentative ou non_evaluee — rougissent), et la\n");
  process.stdout.write("règle d'étape 4, accomplie, rougit toute projection supprimée ; et le multi-runs\n");
  process.stdout.write("tient : références composites (jamais un numéro nu), manifestes immuables par\n");
  process.stdout.write("empreinte, préfixe exact de la liste cumulative, attente de collecte comptée ; et sa\n");
  process.stdout.write("contre-revue est morte : la curation est SCELLÉE (entrée en attente supprimée —\n");
  process.stdout.write("l'attaque népalaise —, entrée ajoutée, motif réécrit : trois mutations sans\n");
  process.stdout.write("rescellement, trois rouges), « a_instruire » est l'état légal de la collecte brute\n");
  process.stdout.write("(cité par une preuve il rougit, --exiger-audit-complet rougit tant qu'il en reste),\n");
  process.stdout.write("et les versions d'extracteur sont GELÉES — un manifeste immuable ne se réaligne\n");
  process.stdout.write("jamais ; enfin la validation éditoriale humaine (arbitrage du 25/08/2026) est une\n");
  process.stdout.write("seconde voie d'identité d'éditeur, jamais un passe-droit : verte sur preuve complète,\n");
  process.stdout.write("rouge datée du futur, au motif indigent, sur citation désancrée, sur pièce sans\n");
  process.stdout.write("extrait, sur observation non consultée — le fait métier reste porté par l'ancre ;\n");
  process.stdout.write("et elle NOMME ce qu'elle valide : recopiée sur un autre éditeur, nature transposée,\n");
  process.stdout.write("ou datée avant la consultation de son observation — trois rouges.\n\n");
  process.stdout.write("[audit-pays] le validateur mord, sur les 83 contrôles.\n");
  process.exit(0);
}
process.stderr.write(`\n[audit-pays] ÉCHEC — ${defauts.length} défaut(s) :\n`);
for (const d of defauts) process.stderr.write(`  ${d}\n`);
process.exit(1);
