#!/usr/bin/env node
/**
 * LE COLLECTEUR NE FABRIQUE PAS D'OBSERVATIONS — SES PANNES REFUSENT, SES PIÈCES SE CORRÈLENT.
 *
 *   node test-consulter-lot-a.mjs
 *
 * POURQUOI. Contre-épreuve de Codex sur la v1 du collecteur : `curl` ABSENT produisait
 * « 91 liens · 0 consultation · 91 tentatives », sortie 0 — une panne d'environnement
 * transformée en 91 observations de sources. S'y ajoutaient : l'inventaire lu sans
 * confrontation au scellé, l'effacement des captures précédentes, DEUX requêtes par échec
 * (statut de l'une, transcript de l'autre), un relevé partiel après interruption, et des
 * traces `curl -v` porteuses d'informations de proxy.
 *
 * MÉTHODE. Un FAUX `curl` est placé seul dans le PATH d'un arbre de travail jetable ; ses
 * comportements sont pilotés par FAUX_MODE. Chaque cas exige le refus, ou la collecte, ou la
 * conservation — exactement.
 *
 * DOUZE CAS :
 *   1. curl ABSENT → sortie 2, « curl est absent », AUCUN répertoire de run créé.
 *   2. PROXY BLOQUANT (la sonde échoue sur « CONNECT tunnel failed ») → sortie 2, panne
 *      systémique, rien d'écrit.
 *   3. INVENTAIRE DÉRIVÉ (une URL des guides mutée) → sortie 2, « ne correspondent plus au
 *      scellé », rien d'écrit — on ne collecte pas sur un inventaire altéré.
 *   4. COLLECTE NOMINALE → sortie 0 ; manifeste publié ; 91 consultations ; corps ET trace
 *      pour chaque lien, issus du MÊME appel ; les traces sont ASSAINIES (la ligne de proxy
 *      du faux curl est expurgée, le secret n'apparaît nulle part).
 *   5. MIXTE (un 403, un timeout, 89 succès) → sortie 0 ; les deux tentatives portent leur
 *      résultat précis et leur trace ; rien n'est maquillé en consultation.
 *   6. DÉRIVE D'URL (redirection vers un autre hôte) → l'url_finale ENREGISTRÉE est l'hôte
 *      dérivé, fidèlement — l'observation dit ce qu'elle a vu.
 *   7. INTERRUPTION (le processus meurt au 10ᵉ appel) → le manifeste précédent est INTACT
 *      octet à octet, les runs précédents aussi ; le run interrompu reste partiel, sans
 *      manifeste qui se ferait passer pour complet.
 *   8. 0 CONSULTATION (tous les liens en 403, sonde pourtant verte) → sortie 2 : 0/91 est la
 *      signature d'une panne, le manifeste n'est PAS remplacé.
 *   9. PROXY PARTIEL (sonde verte, UNE autorité répond « CONNECT tunnel failed », les autres
 *      en 2xx) → sortie 2 : la signature environnementale interrompt TOUT le run avant
 *      d'être expurgée, elle ne devient jamais une « tentative » de la source ; le manifeste
 *      précédent est intact. [contre-revue v5]
 *   10. EGRESS_BLOCKED uniquement dans le CORPS d'un 403 (stderr muet), puis uniquement dans
 *       les EN-TÊTES → sortie 2 dans les deux cas, ancien manifeste intact : la détection
 *       inspecte stderr + en-têtes + corps avant toute classification. [contre-revue v5-bis]
 *   11. Set-Cookie: SECRET dans les en-têtes de chaque réponse → le secret est ABSENT de
 *       toutes les pièces du run (en-têtes assainis avant scellement), la marque
 *       d'expurgation présente. [contre-revue v5-bis]
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, symlinkSync, mkdtempSync, rmSync, existsSync, readdirSync, chmodSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";

const defauts = [];
const echec = (cas, m) => defauts.push(`${cas} — ${m}`);

const conteneur = mkdtempSync(join(tmpdir(), "collecte-wt-"));
const arbre = join(conteneur, "arbre");
const bin = join(conteneur, "bin");
const etat = join(conteneur, "etat");
mkdirSync(bin, { recursive: true });
mkdirSync(etat, { recursive: true });
const gitWt = (...a) => spawnSync("git", ["worktree", ...a], { encoding: "utf-8" });

/* ---- le faux curl ---------------------------------------------------------------------------- */
const fauxCurlJs = join(conteneur, "faux-curl.js");
writeFileSync(fauxCurlJs, `
const fs = require("fs");
const path = require("path");
const args = process.argv.slice(2);
if (args.includes("--version")) { process.stdout.write("curl 8.0.0-faux\\n"); process.exit(0); }
const url = args[args.length - 1];
const sortie = args.includes("-o") ? args[args.indexOf("-o") + 1] : null;
const entetes = args.includes("-D") ? args[args.indexOf("-D") + 1] : null;
const mode = process.env.FAUX_MODE || "ok";
const etat = process.env.FAUX_ETAT;
/* La ligne que l'assainisseur DOIT expurger. */
process.stderr.write("* Uses proxy env variable https_proxy == 'http://SECRET-PROXY:3128'\\n* Connected (faux)\\n");
if (mode === "proxy") { process.stderr.write("curl: (56) CONNECT tunnel failed, response 403\\n"); process.exit(56); }
if (mode === "proxy-partiel" && url.includes("paaf.gov.kw")) {
  process.stderr.write("curl: (56) CONNECT tunnel failed, response 403\\n"); process.exit(56);
}
if (mode === "interruption" && !url.includes("example.com")) {
  const c = path.join(etat, "compteur");
  const n = (fs.existsSync(c) ? Number(fs.readFileSync(c, "utf8")) : 0) + 1;
  fs.writeFileSync(c, String(n));
  if (n === 10) { process.kill(process.ppid, "SIGKILL"); process.exit(1); }
}
const est403 = (mode === "tous403" || (mode === "egress-corps" && url.includes("paaf.gov.kw"))) && !url.includes("example.com");
const mixte403 = mode === "mixte" && url.includes("services.bahrain.bh");
const timeout = mode === "mixte" && url.includes("cdn.bahamas.gov.bs");
if (timeout) { process.stderr.write("curl: (28) Operation timed out\\n"); process.exit(28); }
const code = (est403 || mixte403) ? "403" : "200";
let finale = url;
if (mode === "derive" && url.includes("moa.gov.jm")) finale = "https://parking-domaine.example/vendu";
const corpsEgress = (mode === "egress-corps" && url.includes("paaf.gov.kw")) ? "Access denied: EGRESS_BLOCKED by network policy." : "";
if (sortie) fs.writeFileSync(sortie, "<html><body>Page de " + url + " (faux curl, jeu d'essai)" + corpsEgress + "</body></html>");
const enteteEgress = (mode === "egress-entetes" && url.includes("paaf.gov.kw")) ? "X-Deny: EGRESS_BLOCKED\\r\\n" : "";
if (entetes) fs.writeFileSync(entetes, "HTTP/1.1 " + code + " OK\\r\\nContent-Type: text/html; charset=utf-8\\r\\nSet-Cookie: session=SECRET-COOKIE-42\\r\\n" + enteteEgress + "\\r\\n");
/* Le format -w est RESPECTÉ, comme le vrai curl : la sonde demande %{http_code} seul. */
const format = args.includes("-w") ? args[args.indexOf("-w") + 1] : "";
process.stdout.write(format.replace("%{http_code}", code).replace("%{url_effective}", finale)
  .replace("%{num_redirects}", "0").replace("%{content_type}", "text/html; charset=utf-8"));
process.exit(0);
`);
writeFileSync(join(bin, "curl"), `#!/bin/sh\nexec "${process.execPath}" "${fauxCurlJs}" "$@"\n`);
chmodSync(join(bin, "curl"), 0o755);

const lancer = (mode, cheminBin = bin) => spawnSync("node", ["consulter-candidates-lot-a.mjs"], {
  cwd: arbre, encoding: "utf-8",
  env: { ...process.env, PATH: `${cheminBin}:${dirname(process.execPath)}`, FAUX_MODE: mode, FAUX_ETAT: etat },
});
const runs = () => (existsSync(join(arbre, "audit-pays-pieces")) ? readdirSync(join(arbre, "audit-pays-pieces")).filter((d) => d.startsWith("run-")) : []);
const MANIFESTE = () => join(arbre, "audit-pays-consultations.json");

try {
  const ajout = gitWt("add", "--detach", arbre, "HEAD");
  if (ajout.status !== 0) throw new Error(`git worktree add : ${(ajout.stderr || "").trim()}`);
  copyFileSync("consulter-candidates-lot-a.mjs", join(arbre, "consulter-candidates-lot-a.mjs"));
  copyFileSync("extraire-texte-lot-a.mjs", join(arbre, "extraire-texte-lot-a.mjs"));
  copyFileSync("etat-reference-lot-a.json", join(arbre, "etat-reference-lot-a.json"));
  copyFileSync("rattachements-a-consulter.json", join(arbre, "rattachements-a-consulter.json"));
  const CHEMIN_GUIDES = join(arbre, "packages/ui/src/data/countries.generated.json");
  const guidesPristins = readFileSync(CHEMIN_GUIDES, "utf-8");

  /* ---- 1. curl absent ------------------------------------------------------------------------ */
  {
    const vide = join(conteneur, "bin-vide");
    mkdirSync(vide, { recursive: true });
    const r = lancer("ok", vide);
    if (r.status !== 2) echec("1 curl absent", `sortie ${r.status} au lieu de 2 — la panne devient observation`);
    if (!/curl est absent/.test(r.stderr)) echec("1 curl absent", "le refus ne nomme pas curl");
    if (runs().length !== 0) echec("1 curl absent", "un répertoire de run a été créé malgré le refus");
  }

  /* ---- 2. proxy bloquant --------------------------------------------------------------------- */
  {
    const r = lancer("proxy");
    if (r.status !== 2) echec("2 proxy bloquant", `sortie ${r.status} au lieu de 2`);
    if (!/panne systémique|proxy bloquant/.test(r.stderr)) echec("2 proxy bloquant", "le refus ne nomme pas la panne systémique");
    if (runs().length !== 0) echec("2 proxy bloquant", "un répertoire de run a été créé malgré le refus");
  }

  /* ---- 3. inventaire dérivé ------------------------------------------------------------------ */
  {
    const g = JSON.parse(guidesPristins);
    g.country_fj.sources[0].url = "https://example.org/derive";
    writeFileSync(CHEMIN_GUIDES, JSON.stringify(g, null, 2));
    const r = lancer("ok");
    if (r.status !== 2) echec("3 inventaire dérivé", `sortie ${r.status} au lieu de 2 — on collecte sur un inventaire altéré`);
    if (!/ne correspondent plus au scellé/.test(r.stderr)) echec("3 inventaire dérivé", "le refus ne nomme pas le scellé");
    if (runs().length !== 0) echec("3 inventaire dérivé", "un run a été créé malgré le refus");
    writeFileSync(CHEMIN_GUIDES, guidesPristins);
  }

  /* ---- 4. collecte nominale ------------------------------------------------------------------ */
  {
    const r = lancer("ok");
    if (r.status !== 0) echec("4 nominale", `sortie ${r.status} :\n      ${r.stderr.trim().split("\n").slice(0, 3).join("\n      ")}`);
    if (!existsSync(MANIFESTE())) { echec("4 nominale", "manifeste absent"); }
    else {
      const m = JSON.parse(readFileSync(MANIFESTE(), "utf-8"));
      if (m.total !== m.resultats.length) echec("4 nominale", `total ${m.total} ≠ ${m.resultats.length} résultats`);
      const candidates = m.resultats.filter((x) => x.role === "candidate");
      const rattachements = m.resultats.filter((x) => x.role === "rattachement");
      if (candidates.length !== 91) echec("4 nominale", `${candidates.length}/91 candidates`);
      if (rattachements.length !== 4) echec("4 nominale", `${rattachements.length}/4 observations de rattachement`);
      if (rattachements.some((x) => !x.url_demandee || !x.motif)) echec("4 nominale", "une observation de rattachement sans url_demandee ou motif");
      const consultees = m.resultats.filter((x) => x.acces === "consultee");
      if (consultees.length !== 95) echec("4 nominale", `${consultees.length}/95 consultations`);
      if (!consultees.every((x) => x.capture.format_detecte)) echec("4 nominale", "format_detecte absent d'une capture");
      const ex = consultees[0];
      if (!existsSync(join(arbre, ex.capture.chemin)) || !existsSync(join(arbre, ex.trace.chemin))) {
        echec("4 nominale", "corps ou trace manquants pour la première consultation");
      }
      const trace = readFileSync(join(arbre, ex.trace.chemin), "utf-8");
      if (trace.includes("SECRET-PROXY")) echec("4 nominale", "le SECRET de proxy apparaît dans une trace versionnable");
      if (!trace.includes("[ligne expurgée : proxy/authentification]")) echec("4 nominale", "l'assainissement ne laisse pas sa marque");
      if (!ex.capture.texte_derive || !existsSync(join(arbre, ex.capture.texte_derive.chemin))) {
        echec("4 nominale", "le texte dérivé de la première consultation n'existe pas");
      }
      if (!ex.capture.extracteur || !ex.capture.content_type) echec("4 nominale", "la capture ne scelle pas extracteur et content_type");
    }
  }

  /* ---- 5. mixte : 403 + timeout, le reste passe ---------------------------------------------- */
  {
    const r = lancer("mixte");
    if (r.status !== 0) echec("5 mixte", `sortie ${r.status}`);
    const m = JSON.parse(readFileSync(MANIFESTE(), "utf-8"));
    const t403 = m.resultats.find((x) => x.url_publiee.includes("services.bahrain.bh"));
    const t28 = m.resultats.find((x) => x.url_publiee.includes("cdn.bahamas.gov.bs"));
    if (t403?.acces !== "tentative" || t403?.resultat !== "HTTP 403") echec("5 mixte", `le 403 n'est pas une tentative « HTTP 403 » (${JSON.stringify(t403?.resultat)})`);
    if (t28?.acces !== "tentative" || !/curl exit 28/.test(t28?.resultat ?? "")) echec("5 mixte", `le timeout n'est pas une tentative « curl exit 28 » (${JSON.stringify(t28?.resultat)})`);
    if (t403 && !existsSync(join(arbre, t403.trace.chemin))) echec("5 mixte", "la trace du 403 n'existe pas");
    const consultees = m.resultats.filter((x) => x.role === "candidate" && x.acces === "consultee").length;
    if (consultees !== 89) echec("5 mixte", `${consultees} consultations candidates au lieu de 89`);
  }

  /* ---- 6. dérive d'URL ----------------------------------------------------------------------- */
  {
    const r = lancer("derive");
    if (r.status !== 0) echec("6 dérive", `sortie ${r.status}`);
    const m = JSON.parse(readFileSync(MANIFESTE(), "utf-8"));
    const d = m.resultats.find((x) => x.url_publiee.includes("moa.gov.jm"));
    if (d?.url_finale !== "https://parking-domaine.example/vendu") {
      echec("6 dérive", `l'url_finale dérivée n'est pas enregistrée fidèlement (${JSON.stringify(d?.url_finale)})`);
    }
  }

  /* ---- 7. interruption au 10e appel ---------------------------------------------------------- */
  {
    const manifesteAvant = readFileSync(MANIFESTE(), "utf-8");
    const runsAvant = runs().length;
    rmSync(join(etat, "compteur"), { force: true });
    const r = lancer("interruption");
    if (r.status === 0) echec("7 interruption", "sortie 0 alors que le processus devait mourir");
    if (readFileSync(MANIFESTE(), "utf-8") !== manifesteAvant) echec("7 interruption", "le manifeste précédent a été ALTÉRÉ par un run interrompu");
    if (runs().length !== runsAvant + 1) echec("7 interruption", "le run interrompu n'a pas laissé son répertoire partiel (ou en a détruit un ancien)");
  }

  /* ---- 8. zéro consultation : la signature d'une panne --------------------------------------- */
  {
    const manifesteAvant = readFileSync(MANIFESTE(), "utf-8");
    const r = lancer("tous403");
    if (r.status !== 2) echec("8 zéro consultation", `sortie ${r.status} au lieu de 2 — 91 tentatives fabriquées`);
    if (!/signature d'une panne/.test(r.stderr)) echec("8 zéro consultation", "le refus ne nomme pas la panne");
    if (readFileSync(MANIFESTE(), "utf-8") !== manifesteAvant) echec("8 zéro consultation", "le manifeste a été remplacé malgré le refus");
  }

  /* ---- 9. proxy partiel : la signature environnementale interrompt TOUT le run --------------- */
  {
    const manifesteAvant = readFileSync(MANIFESTE(), "utf-8");
    const r = lancer("proxy-partiel");
    if (r.status !== 2) echec("9 proxy partiel", `sortie ${r.status} au lieu de 2 — la signature de proxy devient une « tentative » de la source`);
    if (!/panne d'environnement sur/.test(r.stderr)) echec("9 proxy partiel", "le refus ne nomme pas la panne par requête");
    if (readFileSync(MANIFESTE(), "utf-8") !== manifesteAvant) echec("9 proxy partiel", "le manifeste précédent a été touché");
  }

  /* ---- 10. EGRESS_BLOCKED dans le corps, puis dans les en-têtes — et AUCUN secret dans les
   *          runs interrompus (contre-revue v5-ter : les en-têtes bruts restaient dans les
   *          runs partiels) ------------------------------------------------------------------ */
  for (const [variante, mode] of [["corps", "egress-corps"], ["en-têtes", "egress-entetes"]]) {
    const manifesteAvant = readFileSync(MANIFESTE(), "utf-8");
    const r = lancer(mode);
    if (r.status !== 2) echec(`10 EGRESS dans ${variante}`, `sortie ${r.status} au lieu de 2 — la signature devient une tentative légitime`);
    if (!new RegExp(`signature de blocage environnemental dans ${variante}`).test(r.stderr)) {
      echec(`10 EGRESS dans ${variante}`, `le refus ne nomme pas « ${variante} » — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 2).join("\n      ")}`);
    }
    if (readFileSync(MANIFESTE(), "utf-8") !== manifesteAvant) echec(`10 EGRESS dans ${variante}`, "le manifeste a été touché");
    /* TOUS les fichiers de TOUS les runs — y compris le run interrompu — sont inspectés. */
    for (const run of runs()) {
      for (const f of readdirSync(join(arbre, "audit-pays-pieces", run))) {
        if (readFileSync(join(arbre, "audit-pays-pieces", run, f), "latin1").includes("SECRET-COOKIE-42")) {
          echec(`10 EGRESS dans ${variante}`, `le secret apparaît dans ${run}/${f} — les en-têtes bruts ont touché les pièces`);
        }
      }
    }
  }

  /* ---- 11. Set-Cookie: SECRET — absent de TOUTES les pièces ---------------------------------- */
  {
    const r = lancer("ok");
    if (r.status !== 0) echec("11 Set-Cookie", `sortie ${r.status} sur collecte nominale`);
    const m = JSON.parse(readFileSync(MANIFESTE(), "utf-8"));
    const run = join(arbre, m.run);
    let fuites = 0, marques = 0;
    for (const f of readdirSync(run)) {
      const contenu = readFileSync(join(run, f), "latin1");
      if (contenu.includes("SECRET-COOKIE-42")) { fuites++; echec("11 Set-Cookie", `le secret apparaît dans ${f}`); }
      /* La marque porte un « é » UTF-8 : elle se cherche dans une lecture UTF-8, pas latin1. */
      if (f.endsWith(".headers.txt") && readFileSync(join(run, f), "utf-8").includes("[en-tête expurgé : cookies/authentification/proxy]")) marques++;
    }
    if (marques === 0) echec("11 Set-Cookie", "aucune marque d'expurgation dans les en-têtes scellés");
    if (readFileSync(MANIFESTE(), "utf-8").includes("SECRET-COOKIE-42")) echec("11 Set-Cookie", "le secret apparaît dans le manifeste");
  }

  /* ---- 12. liste de rattachements malformée : refus AVANT toute écriture -------------------- */
  {
    const pristin = readFileSync(join(arbre, "rattachements-a-consulter.json"), "utf-8");
    writeFileSync(join(arbre, "rattachements-a-consulter.json"), JSON.stringify([{ url: "https://example.org/sans-motif" }]));
    const runsAvant = runs().length;
    const r = lancer("ok");
    if (r.status !== 2) echec("12 rattachements malformés", `sortie ${r.status} au lieu de 2`);
    if (!/url et motif sont obligatoires/.test(r.stderr)) echec("12 rattachements malformés", "le refus ne nomme pas l'exigence");
    if (runs().length !== runsAvant) echec("12 rattachements malformés", "un run a été créé malgré le refus");
    writeFileSync(join(arbre, "rattachements-a-consulter.json"), pristin);
  }
} finally {
  gitWt("remove", "--force", arbre);
  rmSync(conteneur, { recursive: true, force: true });
}

/* ---- verdict ---------------------------------------------------------------------------------- */
if (defauts.length === 0) {
  process.stdout.write("12 cas éprouvés au faux curl : curl absent, proxy bloquant, inventaire dérivé et\n");
  process.stdout.write("rattachements malformés REFUSENT sans rien écrire ; la collecte nominale rapporte\n");
  process.stdout.write("91 candidates + 4 observations de rattachement, formats détectés depuis les octets ;\n");
  process.stdout.write("corps et trace se corrèlent d'un même appel ; un 403 et un timeout restent des tentatives\n");
  process.stdout.write("précises ; une URL dérivée est enregistrée fidèlement ; une interruption ne publie\n");
  process.stdout.write("rien et ne détruit rien ; zéro consultation refuse au lieu de fabriquer 91 pièces ;\n");
  process.stdout.write("et une signature environnementale sur UNE requête — dans la trace, le CORPS ou les\n");
  process.stdout.write("EN-TÊTES, sonde pourtant verte — interrompt tout le run avant expurgation ; enfin un\n");
  process.stdout.write("Set-Cookie secret n'atteint aucune pièce : les en-têtes sont expurgés avant scellement.\n\n");
  process.stdout.write("[collecte] une panne d'environnement n'est pas une observation de source.\n");
  process.exit(0);
}
process.stderr.write(`\n[collecte] ÉCHEC — ${defauts.length} défaut(s) :\n`);
for (const d of defauts) process.stderr.write(`  ${d}\n`);
process.exit(1);
