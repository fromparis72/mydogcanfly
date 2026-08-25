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
 * QUATORZE CAS :
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
 *   12. LISTE DE RATTACHEMENTS MALFORMÉE (six variantes, file:///etc/passwd comprise) →
 *       sortie 2 AVANT toute écriture. [contre-revue v5-quater]
 *   13. REDIRECTION HORS HTTP(S) (url_finale = file:///etc/passwd) → sortie 2, manifeste
 *       intact, contenu local détruit ; et chaque appel curl est épinglé
 *       --proto/--proto-redir =http,https (exigé au cas nominal). [contre-revue v5-quinquies]
 *   14. CORPS AU-DELÀ DE LA BORNE D'OCTETS (25 MiB, servi en 200) → tentative explicite
 *       « au-delà de la borne », aucune pièce orpheline ; chaque appel curl est borné
 *       --max-filesize (exigé au cas nominal). Le cas 5 vérifie de plus l'INVENTAIRE EXACT :
 *       les fichiers du run = exactement les chemins référencés. [contre-revue v5-sexies]
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
/* TOUT appel réseau doit être ÉPINGLÉ --proto/--proto-redir =http,https — sinon une
 * redirection pourrait quitter le web. Le manquement est journalisé, le cas nominal l'exige. */
if (!(args.includes("--proto") && args[args.indexOf("--proto") + 1] === "=http,https"
   && args.includes("--proto-redir") && args[args.indexOf("--proto-redir") + 1] === "=http,https")) {
  fs.writeFileSync(path.join(etat, "proto-manquant"), url);
}
/* Et BORNÉ en octets (--max-filesize) — le temps ne borne pas la taille. */
if (!(args.includes("--max-filesize") && Number(args[args.indexOf("--max-filesize") + 1]) > 0)) {
  fs.writeFileSync(path.join(etat, "borne-manquante"), url);
}
/* Les lignes que l'assainisseur DOIT expurger — y compris l'en-tête de réponse répété par
 * curl -v dans STDERR avec son préfixe « < » : la contre-revue de la collecte a montré que
 * le secret n'était injecté que dans la sortie -D, jamais dans la trace (faux vert). */
process.stderr.write("* Uses proxy env variable https_proxy == 'http://SECRET-PROXY:3128'\\n* Connected (faux)\\n");
process.stderr.write("< Set-Cookie: session=SECRET-COOKIE-42; Path=/\\n< Content-Type: text/html\\n");
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
/* Un curl NON épinglé qui aurait suivi une redirection hors du web : url_effective locale,
 * et le CONTENU LOCAL déjà écrit dans le corps provisoire. */
const localePasswd = mode === "redirige-local" && url.includes("moa.gov.jm");
if (localePasswd) finale = "file:///etc/passwd";
const corpsEgress = (mode === "egress-corps" && url.includes("paaf.gov.kw")) ? "Access denied: EGRESS_BLOCKED by network policy." : "";
/* Un corps AU-DELÀ de la borne (25 MiB), servi en 200 — comme si curl n'avait pas pu borner. */
const enorme = mode === "corps-enorme" && url.includes("moa.gov.jm");
const corps = localePasswd ? "root:x:0:0:CONTENU-LOCAL-PASSWD:/root:/bin/sh"
  : "<html><body>Page de " + url + " (faux curl, jeu d'essai)" + corpsEgress + "</body></html>";
if (sortie) fs.writeFileSync(sortie, enorme ? Buffer.alloc(26214401, 65) : corps);
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
  copyFileSync("liste-rattachements-lot-a.mjs", join(arbre, "liste-rattachements-lot-a.mjs"));
  copyFileSync("etat-reference-lot-a.json", join(arbre, "etat-reference-lot-a.json"));
  copyFileSync("rattachements-a-consulter.json", join(arbre, "rattachements-a-consulter.json"));
  const CHEMIN_GUIDES = join(arbre, "packages/ui/src/data/countries.generated.json");
  const guidesPristins = readFileSync(CHEMIN_GUIDES, "utf-8");
  /* Des runs RÉELS sont désormais commités dans le dépôt : la base de comparaison est l'état
   * initial de l'arbre, plus jamais « zéro run ». */
  const runsInitiaux = runs().length;

  /* ---- 1. curl absent ------------------------------------------------------------------------ */
  {
    const vide = join(conteneur, "bin-vide");
    mkdirSync(vide, { recursive: true });
    const r = lancer("ok", vide);
    if (r.status !== 2) echec("1 curl absent", `sortie ${r.status} au lieu de 2 — la panne devient observation`);
    if (!/curl est absent/.test(r.stderr)) echec("1 curl absent", "le refus ne nomme pas curl");
    if (runs().length !== runsInitiaux) echec("1 curl absent", "un répertoire de run a été créé malgré le refus");
  }

  /* ---- 2. proxy bloquant --------------------------------------------------------------------- */
  {
    const r = lancer("proxy");
    if (r.status !== 2) echec("2 proxy bloquant", `sortie ${r.status} au lieu de 2`);
    if (!/panne systémique|proxy bloquant/.test(r.stderr)) echec("2 proxy bloquant", "le refus ne nomme pas la panne systémique");
    if (runs().length !== runsInitiaux) echec("2 proxy bloquant", "un répertoire de run a été créé malgré le refus");
  }

  /* ---- 3. inventaire dérivé ------------------------------------------------------------------ */
  {
    const g = JSON.parse(guidesPristins);
    g.country_fj.sources[0].url = "https://example.org/derive";
    writeFileSync(CHEMIN_GUIDES, JSON.stringify(g, null, 2));
    const r = lancer("ok");
    if (r.status !== 2) echec("3 inventaire dérivé", `sortie ${r.status} au lieu de 2 — on collecte sur un inventaire altéré`);
    if (!/ne correspondent plus au scellé/.test(r.stderr)) echec("3 inventaire dérivé", "le refus ne nomme pas le scellé");
    if (runs().length !== runsInitiaux) echec("3 inventaire dérivé", "un run a été créé malgré le refus");
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
    /* Chaque appel réseau (sonde comprise) doit avoir été ÉPINGLÉ --proto/--proto-redir,
     * et BORNÉ --max-filesize. */
    if (existsSync(join(etat, "proto-manquant"))) {
      echec("4 nominale", `un appel curl n'était pas épinglé =http,https (URL : ${readFileSync(join(etat, "proto-manquant"), "utf-8")})`);
    }
    if (existsSync(join(etat, "borne-manquante"))) {
      echec("4 nominale", `un appel curl n'était pas borné --max-filesize (URL : ${readFileSync(join(etat, "borne-manquante"), "utf-8")})`);
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
    /* Le run est l'INVENTAIRE EXACT des pièces : rien d'orphelin (corps/en-têtes des
     * tentatives supprimés), rien de référencé absent (contre-revue v5-sexies). */
    const refs = new Set();
    for (const x of m.resultats) {
      for (const f of [x.capture?.chemin, x.capture?.texte_derive?.chemin, x.entetes?.chemin, x.trace?.chemin]) if (f) refs.add(f);
    }
    const reels = readdirSync(join(arbre, m.run)).map((f) => `${m.run}/${f}`);
    for (const f of reels) if (!refs.has(f)) echec("5 mixte", `pièce ORPHELINE dans le run : ${f} — le manifeste n'est pas l'inventaire exact`);
    for (const f of refs) if (!reels.includes(f)) echec("5 mixte", `pièce référencée ABSENTE du run : ${f}`);
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

  /* ---- 12. liste de rattachements : SCHÉMA STRICT, refus AVANT toute écriture ----------------
   * [contre-revue v5-quater : file:///etc/passwd passait, et le vrai curl aurait laissé du
   * contenu LOCAL dans le run] */
  {
    const pristin = readFileSync(join(arbre, "rattachements-a-consulter.json"), "utf-8");
    const CHEMIN_LISTE = join(arbre, "rattachements-a-consulter.json");
    const variantes = [
      ["URL locale file://", JSON.stringify([{ url: "file:///etc/passwd", motif: "Motif présent mais schéma local." }]), /HTTP\(S\) UNIQUEMENT/],
      ["champ inconnu", JSON.stringify([{ url: "https://example.org/a", motif: "Motif valide du jeu d'essai.", note: "x" }]), /aucun champ inconnu/],
      ["motif blanc", JSON.stringify([{ url: "https://example.org/a", motif: "   " }]), /motif blanc/],
      ["URL en double", JSON.stringify([{ url: "https://example.org/a", motif: "Premier motif." }, { url: "https://example.org/a", motif: "Second motif." }]), /en double/],
      ["JSON invalide", "{ pas du json", /ABSENT ou JSON invalide/],
      ["fichier absent", null, /ABSENT ou JSON invalide/],
    ];
    for (const [nom, contenu, motif] of variantes) {
      if (contenu === null) rmSync(CHEMIN_LISTE, { force: true });
      else writeFileSync(CHEMIN_LISTE, contenu);
      const runsAvant = runs().length;
      const r = lancer("ok");
      if (r.status !== 2) echec(`12 liste (${nom})`, `sortie ${r.status} au lieu de 2 — la liste malformée passe`);
      if (!motif.test(r.stderr)) echec(`12 liste (${nom})`, `le refus ne satisfait pas ${motif} — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 2).join("\n      ")}`);
      if (runs().length !== runsAvant) echec(`12 liste (${nom})`, "un run a été créé malgré le refus");
    }
    writeFileSync(CHEMIN_LISTE, pristin);
  }

  /* ---- 13. redirection hors HTTP(S) : url_finale = file:///etc/passwd -------------------------
   * [contre-revue v5-quinquies : un curl non épinglé suivait la redirection, l'url_finale locale
   * était persistée et le manifeste remplacé, sortie 0] */
  {
    const manifesteAvant = readFileSync(MANIFESTE(), "utf-8");
    const r = lancer("redirige-local");
    if (r.status !== 2) echec("13 redirection locale", `sortie ${r.status} au lieu de 2 — une url_finale hors HTTP(S) est persistée`);
    if (!/hors HTTP\(S\)/.test(r.stderr)) {
      echec("13 redirection locale", `le refus ne nomme pas « hors HTTP(S) » — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 2).join("\n      ")}`);
    }
    if (readFileSync(MANIFESTE(), "utf-8") !== manifesteAvant) echec("13 redirection locale", "le manifeste précédent a été REMPLACÉ malgré le refus");
    /* Le contenu LOCAL ne survit dans AUCUNE pièce d'AUCUN run — le corps provisoire est détruit. */
    for (const run of runs()) {
      for (const f of readdirSync(join(arbre, "audit-pays-pieces", run))) {
        if (readFileSync(join(arbre, "audit-pays-pieces", run, f), "latin1").includes("CONTENU-LOCAL-PASSWD")) {
          echec("13 redirection locale", `le contenu local apparaît dans ${run}/${f} — le corps provisoire a survécu au refus`);
        }
      }
    }
  }

  /* ---- 14. corps au-delà de la borne d'octets : tentative explicite, jamais une capture ------
   * [P1 de la contre-revue v5-sexies : --max-time borne le temps, pas la taille ; la stat
   * revérifie avant toute lecture en mémoire, même si curl n'a pas pu borner] */
  {
    const r = lancer("corps-enorme");
    if (r.status !== 0) echec("14 corps énorme", `sortie ${r.status} — la borne devait produire une tentative, pas un refus`);
    const m = JSON.parse(readFileSync(MANIFESTE(), "utf-8"));
    const g = m.resultats.find((x) => x.url_publiee?.includes("moa.gov.jm"));
    if (g?.acces !== "tentative" || !/au-delà de la borne/.test(g?.resultat ?? "")) {
      echec("14 corps énorme", `le corps hors borne n'est pas une tentative « au-delà de la borne » (${JSON.stringify(g?.resultat)})`);
    }
    /* Le corps énorme n'a laissé AUCUNE pièce orpheline dans le run. */
    const refs = new Set();
    for (const x of m.resultats) {
      for (const f of [x.capture?.chemin, x.capture?.texte_derive?.chemin, x.entetes?.chemin, x.trace?.chemin]) if (f) refs.add(f);
    }
    for (const f of readdirSync(join(arbre, m.run))) {
      if (!refs.has(`${m.run}/${f}`)) echec("14 corps énorme", `pièce orpheline dans le run : ${f}`);
    }
  }
} finally {
  gitWt("remove", "--force", arbre);
  rmSync(conteneur, { recursive: true, force: true });
}

/* ---- verdict ---------------------------------------------------------------------------------- */
if (defauts.length === 0) {
  process.stdout.write("14 cas éprouvés au faux curl : curl absent, proxy bloquant, inventaire dérivé, et la\n");
  process.stdout.write("liste de rattachements au schéma strict (file:// local, champ inconnu, motif blanc,\n");
  process.stdout.write("URL en double, JSON invalide, fichier absent) REFUSENT sans rien écrire ; une\n");
  process.stdout.write("redirection qui quitte HTTP(S) interrompt tout — manifeste intact, contenu local\n");
  process.stdout.write("détruit, chaque appel curl épinglé =http,https et borné --max-filesize ; un corps\n");
  process.stdout.write("au-delà de la borne devient une tentative explicite ; le run est l'inventaire EXACT\n");
  process.stdout.write("des pièces (tentatives : trace seule, rien d'orphelin) ; la nominale rapporte\n");
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
