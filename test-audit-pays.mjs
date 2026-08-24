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
 * VINGT-NEUF CAS : 0 (fixture conforme → 0) puis 17 à 44, dans l'ordre du dossier v4-ter.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, symlinkSync, mkdtempSync, rmSync } from "node:fs";
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

/** La matrice-fixture : bijection réelle, observations d'essai. */
function fabriquerMatrice(guides, scelle) {
  const audits = {};
  for (const id of Object.keys(scelle.pays)) {
    const candidates = guides[id].sources.map((s) => ({
      label: s.label, url_publiee: s.url, acces: "consultee",
      url_finale: s.url, statut_http: 200, consultee_le: JOUR,
      piece: { type: "extrait", extrait: "Extrait témoin relevé sur la page consultée (jeu d'essai).", langue: "en", locator: "section témoin" },
      nature_editeur: "non_etabli", preuves_rattachement: [], pertinence: "non_evaluee",
    }));
    audits[id] = {
      audite_par: "Harnais lot A", audite_le: JOUR, candidates,
      decision: { statut: "aucune_source_officielle", motif: "Jeu d'essai : aucune candidate n'est jugée ici." },
    };
  }
  /* country_fj : la promotion complète et concordante. */
  const fj = audits.country_fj;
  const c0 = fj.candidates[0];
  c0.nature_editeur = "autorite_pays";
  c0.preuves_rattachement = [quoteFixture("La Biosecurity Authority of Fiji est instituée par la loi sur la biosécurité (pièce d'essai).")];
  c0.pertinence = "etaye_le_fait";
  fj.decision = {
    statut: "promue", observation_decisive: 0,
    source: {
      url: c0.url_finale, source_type: "official_website",
      verified_date: JOUR, review_due: DUE, confidence: 3, reviewer: "Harnais lot A", history: [],
      quote: c0.piece.extrait, quote_language: c0.piece.langue, locator: c0.piece.locator,
    },
  };
  return { audits };
}

try {
  const ajout = gitWt("add", "--detach", arbre, "HEAD");
  if (ajout.status !== 0) throw new Error(`git worktree add : ${(ajout.stderr || "").trim()}`);
  symlinkSync(resolve("node_modules"), join(arbre, "node_modules"));
  copyFileSync("valider-audit-pays.mjs", join(arbre, "valider-audit-pays.mjs"));
  copyFileSync("etat-reference-lot-a.json", join(arbre, "etat-reference-lot-a.json"));
  mkdirSync(join(arbre, "audit-pays-pieces"), { recursive: true });

  const guides = JSON.parse(readFileSync(join(arbre, "packages/ui/src/data/countries.generated.json"), "utf-8"));
  const scelle = JSON.parse(readFileSync(join(arbre, "etat-reference-lot-a.json"), "utf-8"));
  const CHEMIN_MATRICE = join(arbre, "audit-pays.json");
  const CHEMIN_OBJETS = join(arbre, "packages/knowledge/raw/objects.json");
  const objetsPristins = readFileSync(CHEMIN_OBJETS, "utf-8");

  const poser = (m) => writeFileSync(CHEMIN_MATRICE, JSON.stringify(m, null, 2));
  const neuve = () => fabriquerMatrice(guides, scelle);

  /** Mute une matrice neuve, la pose, lance, et exige 1 + motifs. */
  const cas = (nom, muter, motifs) => {
    const m = neuve();
    muter(m);
    poser(m);
    const r = lancer(arbre);
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
    c.preuves_rattachement = [quoteFixture("Preuve de rattachement d'essai pour la contre-épreuve numéro vingt-et-un.")];
  }, [/country_bs/, /candidate ÉLIGIBLE existe/]);

  /* ---- 22-26 --------------------------------------------------------------------------------- */
  cas("22 verified_date ≠ consultation", (m) => { fj(m).decision.source.verified_date = "2026-08-23"; },
    [/country_fj/, /verified_date « 2026-08-23 » ≠ consultee_le/]);
  cas("23 reviewer ≠ auditeur", (m) => { fj(m).decision.source.reviewer = "Quelqu'un d'autre"; },
    [/country_fj/, /reviewer « Quelqu'un d'autre » ≠ audite_par/]);
  cas("24 champ inconnu", (m) => { bs(m).candidates[0].champ_fantome = 1; }, [/schéma/, /champ_fantome|[Uu]nrecognized/]);
  cas("25 non officiel affiché « Sources officielles »", (m) => { bs(m).candidates[1].nature_editeur = "non_officiel";
    bs(m).candidates[1].preuves_rattachement = [quoteFixture("Pièce d'essai établissant un éditeur tiers, contre-épreuve vingt-cinq.")]; },
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
  cas("30 promue sans locator", (m) => { delete fj(m).decision.source.locator; delete fj(m).candidates[0].piece.locator; },
    [/country_fj/, /locator/]);
  cas("31 projection sur l'URL publiée", (m) => { fj(m).candidates[0].url_finale = fj(m).candidates[0].url_publiee + "?finale=autre"; },
    [/country_fj/, /URL FINALE/]);
  cas("32 rattachement en URL nue", (m) => { fj(m).candidates[0].preuves_rattachement = [{ url: "https://example.org/annuaire" }]; },
    [/country_fj/, /preuve de rattachement \[0\] rejetée par SourcedQuote/]);
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
} finally {
  gitWt("remove", "--force", arbre);
  rmSync(conteneur, { recursive: true, force: true });
}

/* ---- verdict ---------------------------------------------------------------------------------- */
if (defauts.length === 0) {
  process.stdout.write("29 cas éprouvés sur matrice-fixture en arbre jetable : la fixture conforme sort en 0,\n");
  process.stdout.write("et les 28 contrôles d'exécution du dossier (17-44) rougissent chacun pour sa cause —\n");
  process.stdout.write("bijection triplet, éligibilité, escalade du non-officiel affiché, concordances,\n");
  process.stdout.write("dérivation ADR-0007, contrats SourcedQuote, pièces prouvées (existence, empreinte,\n");
  process.stdout.write("suivi git, fichier régulier), relations temporelles, et la matrice qui fait foi.\n\n");
  process.stdout.write("[audit-pays] le validateur mord, sur les 28 contrôles.\n");
  process.exit(0);
}
process.stderr.write(`\n[audit-pays] ÉCHEC — ${defauts.length} défaut(s) :\n`);
for (const d of defauts) process.stderr.write(`  ${d}\n`);
process.exit(1);
