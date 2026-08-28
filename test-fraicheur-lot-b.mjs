#!/usr/bin/env node
/**
 * LOT B — LE CONTRÔLEUR DE FRAÎCHEUR NE FABRIQUE RIEN : ni état, ni référence, ni panne.
 *
 *   node --import tsx test-fraicheur-lot-b.mjs
 *   (tsx : les modules du lot B lisent le schéma canonique `Source` en TypeScript)
 *
 * MÉTHODE. Un arbre de travail git jetable reçoit les modules du lot B ; un FAUX `curl`
 * (seul dans le PATH, journalisant CHAQUE invocation) pilote les réponses par FAUX_MODE.
 * Chaque cas exige le refus, le rapport, ou l'invariant — exactement.
 *
 * VINGT-ET-UN CAS :
 *   1.  registre VIDE → sortie 2, « AUCUNE source vivante », aucun rapport.
 *   2.  les DEUX AXES sont indépendants : une source ÉCHUE et INACCESSIBLE porte les deux
 *       états ; une source à jour hors tranche reste NON_CONTROLEE — jamais implicitement
 *       accessible ni inchangée.
 *   3.  PREMIER RUN (références vides) : aucune « inchangee » — tout contrôle abouti est
 *       SANS_REFERENCE, et le rapport Markdown le dit ; la première capture ne consacre rien.
 *   4.  des ÉCHÉANCES PASSÉES existent → elles sont TOUTES dans la file de travail, et la
 *       sortie est 0 — une échéance naturelle n'est pas une panne.
 *   5.  le contrôleur N'ÉCRIT RIEN hors de sa sortie : références, objets, règles,
 *       restrictions — identiques à l'octet près après un run nominal ; et une sortie qui
 *       résout dans les données versionnées est REFUSÉE avant tout.
 *   6.  PRIORISATION : la file est triée par impact (A avant B avant C avant D) puis par
 *       échéance — jamais une documentaire devant une règle.
 *   7.  rapport JSON au SCHÉMA attendu ; et un references.json DIFFORME → sortie 2.
 *   8.  DÉDOUBLONNAGE : l'URL la plus réutilisée est téléchargée UNE seule fois (journal du
 *       faux curl) et distribuée à TOUS ses locators dans le rapport.
 *   9.  COUPE-CIRCUIT : sonde rouge → 2 ; zéro URL joignable → 2 ; signature EGRESS en
 *       cours de run → 2 — dans les trois cas AUCUNE source n'est classée inaccessible et
 *       aucun rapport n'est produit.
 *   10. ROTATION SANS ÉTAT : chaque URL est sélectionnée au moins une fois sur 8 semaines
 *       consécutives — fenêtre ordinaire ET fenêtre traversant décembre-janvier (la
 *       frontière qui justifie la semaine continue).
 *   11. URL DÉPLACÉE : nommée « modifiée » par la comparaison symétrique ; la nouvelle URL
 *       est SANS_REFERENCE au run suivant ; et l'ANCIENNE référence figée est nommée
 *       ORPHELINE au rapport ET en file — jamais évaporée.
 *   12. Set-Cookie SECRET injecté dans chaque réponse → absent de TOUS les artefacts.
 *   13. RÉFÉRENCE FIGÉE : corps identique → INCHANGEE ; corps altéré → POTENTIELLEMENT
 *       MODIFIÉE — jamais « règle devenue fausse » (le rapport ne porte aucun verdict).
 *   14. registre EXACT : une URL remplacée à agrégats constants change l'empreinte globale
 *       ET celle de sa famille, et la comparaison symétrique la nomme au locator.
 *   15. scellé du registre ABSENT → sortie 2, aucun rapport — rien ne se surveille sans
 *       contrat. [contre-revue du socle]
 *   16. source changée SANS rescellement → la vérification de CI (sceller-registre) la
 *       NOMME au locator et échoue ; le contrôleur hebdomadaire REFUSE (panne structurelle,
 *       aucun rapport) ; rescellée explicitement, la vérification repasse au vert — le
 *       remplacement furtif d'URL est mort DANS LE SYSTÈME QUI TOURNE, plus seulement dans
 *       les tests. [contre-revue du socle]
 *   17. la référence a HUIT champs, aucun n'est décoratif : corps identique mais url_finale,
 *       statut, type ou octets faux → POTENTIELLEMENT MODIFIÉE, champs divergents nommés ;
 *       version de contrôleur différente → REFERENCE_INCOMPATIBLE. [contre-revue cf13cba]
 *   18. signature EGRESS placée APRÈS 64 Kio de corps → environnement, refus — le corps
 *       borné se balaie EN ENTIER. [contre-revue cf13cba]
 *   19. scellé aux EMPREINTES FALSIFIÉES (triplets intacts) → échec nommé — l'égalité est
 *       canonique et TOTALE ; une entrée dupliquée → échec nommé. [contre-revue cf13cba]
 *   20. BUDGET GLOBAL épuisé → les URL non exécutées sont REPORTÉES — comptées, nommées au
 *       Markdown, ET TOUTES en file (lignes reportee = compte exact : un compteur seul
 *       n'est pas un état), jamais « inaccessibles » ; sortie 0, le run tient son budget à
 *       l'arrondi de seconde près (le temps restant est transmis à curl). [contre-revues]
 *   21. l'ORDRE D'EXÉCUTION est l'ordre de priorité : urgence avant rotation, impact A→D,
 *       échéance la plus proche, URL en départage — le journal du faux curl égale le miroir
 *       de priorité, la première exécutée est une règle urgente, et aucune rotation-à-jour
 *       ne précède une urgente. [contre-revue e4711d1]
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, symlinkSync, mkdtempSync, rmSync, existsSync, readdirSync, chmodSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { lireRegistre, comparerRegistres, dansLaTranche, semaineContinue, N_TRANCHES,
  etatEcheance, CLASSE_IMPACT, ORDRE_IMPACT } from "./fraicheur/registre-fraicheur.mjs";

const defauts = [];
const echec = (cas, m) => defauts.push(`${cas} — ${m}`);
const sha256 = (x) => createHash("sha256").update(x).digest("hex");

const conteneur = mkdtempSync(join(tmpdir(), "fraicheur-wt-"));
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
fs.appendFileSync(path.join(process.env.FAUX_ETAT, "appels.log"), args[args.length - 1] + "\\n");
const url = args[args.length - 1];
const sortie = args.includes("-o") ? args[args.indexOf("-o") + 1] : null;
const entetes = args.includes("-D") ? args[args.indexOf("-D") + 1] : null;
const mode = process.env.FAUX_MODE || "ok";
const estSonde = url === "https://example.com/";
/* les lignes que RIEN ne doit laisser passer dans un artefact */
process.stderr.write("* Uses proxy env variable https_proxy == 'http://SECRET-PROXY:3128'\\n");
process.stderr.write("< Set-Cookie: session=SECRET-COOKIE-42; Path=/\\n");
if (mode === "sonde-rouge" && estSonde) { process.stderr.write("curl: (56) CONNECT tunnel failed, response 403\\n"); process.exit(56); }
if (mode === "tout-echoue" && !estSonde) { process.stderr.write("curl: (6) Could not resolve host\\n"); process.exit(6); }
if (mode === "un-echec" && url === process.env.FAUX_URL_ECHEC) { process.stderr.write("curl: (28) Operation timed out\\n"); process.exit(28); }
const egress = mode === "egress" && url === process.env.FAUX_URL_ECHEC;
/* la signature APRÈS 64 Kio : une inspection en tranche initiale la manquait (contre-revue) */
const tardif = mode === "egress-tardif" && url === process.env.FAUX_URL_ECHEC;
const altere = mode === "corps-alterne" && url === process.env.FAUX_URL_CIBLE;
const corps = tardif
  ? "A".repeat(70000) + " Access denied: EGRESS_BLOCKED by network policy.\\n"
  : "Corps de " + url + " (faux curl, jeu d'essai)" + (altere ? " ALTERE" : "") + (egress ? " Access denied: EGRESS_BLOCKED by network policy." : "") + "\\n";
if (sortie) fs.writeFileSync(sortie, corps);
if (entetes) fs.writeFileSync(entetes, "HTTP/1.1 200 OK\\r\\nContent-Type: text/html; charset=utf-8\\r\\nSet-Cookie: session=SECRET-COOKIE-42\\r\\n\\r\\n");
const format = args.includes("-w") ? args[args.indexOf("-w") + 1] : "";
process.stdout.write(format.replace("%{http_code}", "200").replace("%{url_effective}", url)
  .replace("%{content_type}", "text/html; charset=utf-8"));
process.exit(0);
`);
writeFileSync(join(bin, "curl"), `#!/bin/sh\nexec "${process.execPath}" "${fauxCurlJs}" "$@"\n`);
chmodSync(join(bin, "curl"), 0o755);

const lancer = (args, env = {}) => spawnSync("node", ["--import", "tsx", "fraicheur/controler-fraicheur.mjs", ...args], {
  cwd: arbre, encoding: "utf-8",
  env: { ...process.env, PATH: `${bin}:${dirname(process.execPath)}`, FAUX_ETAT: etat, ...env },
});
const corpsFaux = (url) => `Corps de ${url} (faux curl, jeu d'essai)\n`;
const viderJournal = () => rmSync(join(etat, "appels.log"), { force: true });
const journal = () => (existsSync(join(etat, "appels.log")) ? readFileSync(join(etat, "appels.log"), "utf-8").split("\n").filter(Boolean) : []);
const lireRapport = (sortie, date) => JSON.parse(readFileSync(join(arbre, sortie, `rapport-${date}.json`), "utf-8"));

try {
  const ajout = gitWt("add", "--detach", arbre, "HEAD");
  if (ajout.status !== 0) throw new Error(`git worktree add : ${(ajout.stderr || "").trim()}`);
  symlinkSync(resolve("node_modules"), join(arbre, "node_modules"));
  mkdirSync(join(arbre, "fraicheur"), { recursive: true });
  for (const f of ["fraicheur/registre-fraicheur.mjs", "fraicheur/reseau-fraicheur.mjs",
    "fraicheur/controler-fraicheur.mjs", "fraicheur/sceller-registre.mjs",
    "fraicheur/registre-scelle.json", "fraicheur/references.json", "liste-rattachements-lot-a.mjs"]) {
    copyFileSync(f, join(arbre, f));
  }
  /* L'arbre de mesure repart TOUJOURS de l'état canonique « aucune référence figée » : ce
   * harnais prouve le mécanisme, pas l'état du dépôt. Les références réelles sont promues
   * par PR humaine et grossiront avec le temps — sans cette ligne, la première promotion
   * (China Eastern, 27/08/2026) rendait fausse la prémisse du cas 3 (« premier run, les
   * références sont vides ») et rougissait la CI. Chaque cas qui a besoin d'une référence
   * écrit la sienne ; aucun ne dépend de celles du dépôt. */
  writeFileSync(join(arbre, "fraicheur/references.json"),
    JSON.stringify({ version: "fraicheur-1", references: [] }, null, 2) + "\n");
  const CHEMINS_DONNEES = ["fraicheur/references.json", "fraicheur/registre-scelle.json",
    "packages/knowledge/raw/objects.json",
    "packages/knowledge/raw/rules.json", "packages/knowledge/raw/breed-restrictions.json"];
  const pristins = Object.fromEntries(CHEMINS_DONNEES.map((p) => [p, readFileSync(join(arbre, p))]));
  const restaurer = () => { for (const [p, c] of Object.entries(pristins)) writeFileSync(join(arbre, p), c); };

  /* le registre RÉEL de l'arbre, lu par le module lui-même (cas 10, 11, 14) */
  const registre = lireRegistre(arbre);
  /* le geste légitime : source changée + scellé RESCELLÉ dans le même mouvement */
  const sceller = (...args) => spawnSync("node", ["--import", "tsx", "fraicheur/sceller-registre.mjs", ...args],
    { cwd: arbre, encoding: "utf-8" });
  const urlMax = [...registre.parUrl.entries()].sort((a, b) => b[1].length - a[1].length)[0];

  /* ---- 1. registre vide ---------------------------------------------------------------------- */
  {
    writeFileSync(join(arbre, "packages/knowledge/raw/objects.json"),
      JSON.stringify({ countries: [], airports: [], airlines: [], breeds: [], partners: [] }));
    writeFileSync(join(arbre, "packages/knowledge/raw/rules.json"), "[]");
    writeFileSync(join(arbre, "packages/knowledge/raw/breed-restrictions.json"), "{}");
    const r = lancer(["--date=2026-08-31", "--sortie=sortie-1"]);
    restaurer();
    if (r.status !== 2) echec("1 registre vide", `sortie ${r.status} au lieu de 2 — un registre vide passe pour un état du monde`);
    else if (!/AUCUNE source vivante/.test(r.stderr)) echec("1 registre vide", `le refus ne nomme pas le vide — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 2).join("\n      ")}`);
    if (existsSync(join(arbre, "sortie-1"))) echec("1 registre vide", "un rapport a été écrit malgré le refus");
  }

  /* ---- R1 : run nominal COMPLET (tout échu au 2027-08-01 → toutes les URL sélectionnées) ------ */
  viderJournal();
  const R1 = lancer(["--date=2027-08-01", "--sortie=sortie-r1"]);
  const rapportsR1 = R1.status === 0 ? lireRapport("sortie-r1", "2027-08-01") : null;

  /* ---- 3. premier run : la première capture ne consacre rien --------------------------------- */
  if (R1.status !== 0) echec("3 premier run", `sortie ${R1.status} :\n      ${R1.stderr.trim().split("\n").slice(0, 3).join("\n      ")}`);
  else {
    if (rapportsR1.controles.inchangee) echec("3 premier run", `${rapportsR1.controles.inchangee} « inchangee » sans AUCUNE référence figée — la première capture consacre`);
    if (!rapportsR1.controles.sans_reference) echec("3 premier run", "aucune « sans_reference » alors que les références sont vides");
    const md = readFileSync(join(arbre, "sortie-r1", "RAPPORT-2027-08-01.md"), "utf-8");
    if (!/Aucune référence figée/.test(md)) echec("3 premier run", "le rapport Markdown ne dit pas l'absence d'historique");
  }

  /* ---- 4. les échues sont TOUTES en file, et la sortie est 0 --------------------------------- */
  if (rapportsR1) {
    const echues = (rapportsR1.echeances.echue ?? 0);
    const enFile = rapportsR1.file_de_travail.filter((l) => l.echeance === "echue").length;
    if (echues === 0) echec("4 échéances passées", "le jeu ne porte aucune échue au 2027-08-01 — cas non exercé");
    if (enFile !== echues) echec("4 échéances passées", `${enFile} échue(s) en file sur ${echues} — une échéance s'est perdue en silence`);
  }

  /* ---- 5. rien n'est écrit hors de la sortie ------------------------------------------------- */
  for (const [p, avant] of Object.entries(pristins)) {
    if (!readFileSync(join(arbre, p)).equals(avant)) echec("5 aucune écriture hors sortie", `${p} a été MODIFIÉ par un run nominal`);
  }
  for (const sortie of ["fraicheur/sous-la-donnee", "packages/x", "content/y"]) {
    const r = lancer(["--date=2027-08-01", `--sortie=${sortie}`]);
    if (r.status !== 2 || !/n'écrit jamais dans le dépôt/.test(r.stderr)) {
      echec("5 aucune écriture hors sortie", `sortie « ${sortie} » non refusée (statut ${r.status})`);
    }
  }

  /* ---- 6. priorisation : impact puis échéance ------------------------------------------------ */
  if (rapportsR1) {
    const ordres = rapportsR1.file_de_travail.map((l) => ({ A: 0, B: 1, C: 2, D: 3 })[l.classe_impact]);
    if (!ordres.some((o) => o === 0) || !ordres.some((o) => o === 3)) {
      echec("6 priorisation", "le jeu n'exerce pas A et D à la fois");
    }
    for (let i = 1; i < ordres.length; i++) {
      if (ordres[i] < ordres[i - 1]) { echec("6 priorisation", `rang ${i} : classe ${rapportsR1.file_de_travail[i].classe_impact} devant ${rapportsR1.file_de_travail[i - 1].classe_impact}`); break; }
    }
  }

  /* ---- 7. schéma du rapport, et références difformes refusées -------------------------------- */
  if (rapportsR1) {
    for (const champ of ["version_controleur", "date", "registre", "references", "selection", "echeances", "controles", "file_de_travail"]) {
      if (!(champ in rapportsR1)) echec("7 schéma du rapport", `champ « ${champ} » absent du rapport JSON`);
    }
    if (rapportsR1.registre.entrees !== registre.entrees.length) echec("7 schéma du rapport", "le compte du registre ne correspond pas");
    if (rapportsR1.registre.empreintes.globale !== registre.empreintes.globale) echec("7 schéma du rapport", "l'empreinte globale du registre ne correspond pas");
  }
  {
    writeFileSync(join(arbre, "fraicheur/references.json"), "{ pas du json");
    const r = lancer(["--date=2027-08-01", "--sortie=sortie-7"]);
    restaurer();
    if (r.status !== 2 || !/ABSENT ou difforme/.test(r.stderr)) echec("7 références difformes", `sortie ${r.status} — un contrat de comparaison illisible passe`);
  }

  /* ---- 8. une URL, UN téléchargement, TOUS ses locators -------------------------------------- */
  if (rapportsR1) {
    const [url, entrees] = urlMax;
    const acces = journal().filter((u) => u === url).length;
    if (acces !== 1) echec("8 dédoublonnage", `${acces} téléchargement(s) de l'URL la plus réutilisée (${entrees.length} locators) au lieu de 1`);
    const lignes = rapportsR1.file_de_travail.filter((l) => l.url === url).length;
    if (lignes !== entrees.length) echec("8 dédoublonnage", `${lignes} ligne(s) de file pour ${entrees.length} locators — le résultat n'est pas distribué`);
  }

  /* ---- 2. les deux axes sont indépendants (un échec ciblé, au 2026-10-15) -------------------- */
  {
    const urlEchue = registre.entrees.find((e) => e.source.review_due < "2026-10-15").source.url;
    const r = lancer(["--date=2026-10-15", "--sortie=sortie-2"], { FAUX_MODE: "un-echec", FAUX_URL_ECHEC: urlEchue });
    if (r.status !== 0) echec("2 axes indépendants", `sortie ${r.status} :\n      ${r.stderr.trim().split("\n").slice(0, 3).join("\n      ")}`);
    else {
      const rap = lireRapport("sortie-2", "2026-10-15");
      const ligne = rap.file_de_travail.find((l) => l.url === urlEchue);
      if (!ligne || ligne.echeance !== "echue" || ligne.controle !== "inaccessible") {
        echec("2 axes indépendants", `la source échue ET inaccessible ne porte pas les deux axes (${JSON.stringify({ echeance: ligne?.echeance, controle: ligne?.controle })})`);
      }
      if (!(rap.controles.non_controlee > 0)) echec("2 axes indépendants", "aucune source hors tranche n'est restée non_controlee");
      const aJourControlee = rap.file_de_travail.some((l) => l.controle === "non_controlee" && l.echeance === "a_jour");
      if (aJourControlee) echec("2 axes indépendants", "une a_jour non contrôlée figure en file — les axes fuient l'un dans l'autre");
    }
  }

  /* ---- 13. référence figée : inchangée, puis potentiellement modifiée ------------------------ */
  {
    const urlCible = registre.entrees.find((e) => e.source.review_due < "2026-10-15").source.url;
    const reference = {
      url: urlCible, empreinte_corps: sha256(corpsFaux(urlCible)),
      url_finale: urlCible, statut_http: 200, content_type: "text/html; charset=utf-8",
      octets: Buffer.byteLength(corpsFaux(urlCible)), capturee_le: "2026-09-01", version_controleur: "fraicheur-1",
    };
    writeFileSync(join(arbre, "fraicheur/references.json"),
      JSON.stringify({ version: "fraicheur-1", references: [reference] }, null, 2));
    const r1 = lancer(["--date=2026-10-15", "--sortie=sortie-13a"]);
    const l1 = r1.status === 0 ? lireRapport("sortie-13a", "2026-10-15").file_de_travail.find((l) => l.url === urlCible) : null;
    if (!l1 || l1.controle !== "inchangee") echec("13 référence figée", `corps identique → « ${l1?.controle} » au lieu d'inchangee (statut ${r1.status})`);
    const r2 = lancer(["--date=2026-10-15", "--sortie=sortie-13b"], { FAUX_MODE: "corps-alterne", FAUX_URL_CIBLE: urlCible });
    const l2 = r2.status === 0 ? lireRapport("sortie-13b", "2026-10-15").file_de_travail.find((l) => l.url === urlCible) : null;
    if (!l2 || l2.controle !== "potentiellement_modifiee") echec("13 référence figée", `corps altéré → « ${l2?.controle} » au lieu de potentiellement_modifiee`);
    if (l2 && JSON.stringify(l2).match(/fausse|invalide|verdict/i)) echec("13 référence figée", "le rapport prononce un verdict — il ne dit que « potentiellement modifié »");
    restaurer();
  }

  /* ---- 9. coupe-circuit : sonde rouge, zéro joignable, signature egress ---------------------- */
  for (const [nom, mode, motif] of [
    ["sonde rouge", "sonde-rouge", /environnement INAPTE/],
    ["zéro joignable", "tout-echoue", /0 URL joignable|ne peut rien contrôler/],
  ]) {
    const r = lancer(["--date=2027-08-01", `--sortie=sortie-9-${mode}`], { FAUX_MODE: mode });
    if (r.status !== 2) echec(`9 coupe-circuit (${nom})`, `sortie ${r.status} au lieu de 2`);
    else if (!motif.test(r.stderr)) echec(`9 coupe-circuit (${nom})`, `le refus ne nomme pas la panne — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 2).join("\n      ")}`);
    if (existsSync(join(arbre, `sortie-9-${mode}`))) echec(`9 coupe-circuit (${nom})`, "un rapport a été produit pendant la panne");
    if (/inaccessible/.test(r.stdout)) echec(`9 coupe-circuit (${nom})`, "des sources ont été déclarées inaccessibles pendant une panne");
  }
  {
    const urlEgress = registre.entrees.find((e) => e.source.review_due < "2027-08-01").source.url;
    const r = lancer(["--date=2027-08-01", "--sortie=sortie-9-egress"], { FAUX_MODE: "egress", FAUX_URL_ECHEC: urlEgress });
    if (r.status !== 2 || !/signature environnementale/.test(r.stderr)) {
      echec("9 coupe-circuit (egress)", `sortie ${r.status} — une signature d'egress en cours de run n'interrompt pas tout`);
    }
    if (existsSync(join(arbre, "sortie-9-egress"))) echec("9 coupe-circuit (egress)", "un rapport a été produit malgré la signature");
  }

  /* ---- 10. rotation sans état : aucune URL éternellement hors sélection — y compris à la
   *          FRONTIÈRE D'ANNÉE, la raison d'être de la semaine continue (contre-revue) -------- */
  for (const [nom, lundiDepart] of [["ordinaire", Date.UTC(2026, 8, 7)], ["frontière décembre-janvier", Date.UTC(2026, 10, 30)]]) {
    const semaines = Array.from({ length: 8 }, (_, i) => {
      const d = new Date(lundiDepart);
      d.setUTCDate(d.getUTCDate() + 7 * i);
      return d.toISOString().slice(0, 10);
    });
    if (nom.includes("frontière") && semaines[0].slice(0, 4) === semaines[7].slice(0, 4)) {
      echec(`10 rotation (${nom})`, `la fenêtre ${semaines[0]} → ${semaines[7]} ne traverse pas l'année — cas non exercé`);
    }
    const jamais = [...registre.parUrl.keys()].filter((u) => !semaines.some((s) => dansLaTranche(u, s)));
    if (jamais.length) echec(`10 rotation (${nom})`, `${jamais.length} URL jamais sélectionnée(s) sur 8 semaines consécutives (ex. ${jamais[0]})`);
    const tranches = new Set(semaines.map((s) => semaineContinue(s) % N_TRANCHES));
    if (tranches.size !== 8) echec(`10 rotation (${nom})`, `8 semaines consécutives ne couvrent que ${tranches.size} tranche(s)`);
  }

  /* ---- 11 & 14. registre exact : URL remplacée nommée ; la nouvelle sans référence ; et
   *              l'ANCIENNE référence figée devient ORPHELINE — nommée, jamais évaporée
   *              (contre-revue : « une source disparue mais encore présente dans
   *              l'historique doit être nommée »). ------------------------------------------- */
  {
    /* une URL UNIQUE au registre : son déplacement la fait entièrement disparaître */
    const objets = JSON.parse(pristins["packages/knowledge/raw/objects.json"].toString("utf-8"));
    const urlUnique = [...registre.parUrl.entries()]
      .find(([u, es]) => es.length === 1 && es[0].famille === "countries" && objets.countries.some((c) => c.source?.url === u))[0];
    const cible = objets.countries.find((c) => c.source?.url === urlUnique);
    cible.source.url = "https://autorite-deplacee.example/nouvelle-adresse";
    writeFileSync(join(arbre, "packages/knowledge/raw/objects.json"), JSON.stringify(objets, null, 2));
    /* la référence figée de l'ANCIENNE adresse existe — elle doit devenir orpheline */
    writeFileSync(join(arbre, "fraicheur/references.json"), JSON.stringify({ version: "fraicheur-1", references: [{
      url: urlUnique, empreinte_corps: sha256(corpsFaux(urlUnique)), url_finale: urlUnique,
      statut_http: 200, content_type: "text/html; charset=utf-8", octets: Buffer.byteLength(corpsFaux(urlUnique)),
      capturee_le: "2026-09-01", version_controleur: "fraicheur-1" }] }, null, 2));
    sceller("--ecrire");   // le geste légitime : la donnée ET son scellé, ensemble
    const registreApres = lireRegistre(arbre);
    const ecarts = comparerRegistres(registre, registreApres);
    if (!ecarts.some((e) => e.type === "modifiee" && e.famille === "countries")) {
      echec("14 registre exact", `l'URL remplacée n'est pas nommée par la comparaison symétrique (${JSON.stringify(ecarts.slice(0, 2))})`);
    }
    if (registre.empreintes.globale === registreApres.empreintes.globale
      || registre.empreintes.par_famille.countries === registreApres.empreintes.par_famille.countries) {
      echec("14 registre exact", "l'empreinte (globale ou famille) n'a pas bougé — un remplacement à agrégats constants passe");
    }
    /* 11 — au run suivant : nouvelle URL sans_reference, ancienne identité disparue, et
     * l'ancienne référence NOMMÉE orpheline au rapport ET en file */
    const r = lancer(["--date=2027-08-01", "--sortie=sortie-11"]);
    if (r.status !== 0) echec("11 URL déplacée", `sortie ${r.status}`);
    else {
      const rap = lireRapport("sortie-11", "2027-08-01");
      const nouvelle = rap.file_de_travail.find((l) => l.url === cible.source.url);
      if (!nouvelle || nouvelle.controle !== "sans_reference") echec("11 URL déplacée", `la nouvelle URL n'est pas sans_reference (${nouvelle?.controle})`);
      if (rap.file_de_travail.some((l) => l.url === urlUnique && l.famille === "countries")) {
        echec("11 URL déplacée", "l'ancienne identité subsiste — la migration a été silencieuse");
      }
      if (!(rap.references_orphelines ?? []).includes(urlUnique)) {
        echec("11 URL déplacée", "l'ancienne référence n'est PAS nommée orpheline au rapport");
      }
      if (!rap.file_de_travail.some((l) => l.controle === "reference_orpheline" && l.url === urlUnique)) {
        echec("11 URL déplacée", "l'ancienne référence n'est PAS en file de travail");
      }
      if (rap.references.orphelines !== 1) echec("11 URL déplacée", `compte d'orphelines ${rap.references.orphelines} ≠ 1`);
    }
    restaurer();
  }

  /* ---- 15. scellé du registre ABSENT → panne structurelle, rien d'interprétable -------------- */
  {
    rmSync(join(arbre, "fraicheur/registre-scelle.json"), { force: true });
    const r = lancer(["--date=2026-10-15", "--sortie=sortie-15"]);
    restaurer();
    if (r.status !== 2 || !/registre-scelle\.json ABSENT/.test(r.stderr)) {
      echec("15 scellé absent", `sortie ${r.status} — un run sans contrat de registre passe :\n      ${r.stderr.trim().split("\n").slice(0, 2).join("\n      ")}`);
    }
    if (existsSync(join(arbre, "sortie-15"))) echec("15 scellé absent", "un rapport a été produit sans scellé");
  }

  /* ---- 16. source changée SANS rescellement : nommée par la CI, refusée par le run,
   *          puis verte une fois RESCELLÉE — le remplacement furtif d'URL est mort ------------- */
  {
    const objets = JSON.parse(pristins["packages/knowledge/raw/objects.json"].toString("utf-8"));
    objets.countries.find((c) => c.source).source.url = "https://furtive.example/remplacee-sans-bouger-les-agregats";
    writeFileSync(join(arbre, "packages/knowledge/raw/objects.json"), JSON.stringify(objets, null, 2));
    const v = sceller();
    if (v.status !== 1 || !/SANS rescellement/.test(v.stderr) || !/modifiee — countries/.test(v.stderr)) {
      echec("16 remplacement furtif", `la vérification de CI ne nomme pas l'écart (statut ${v.status}) :\n      ${(v.stderr || "").trim().split("\n").slice(0, 3).join("\n      ")}`);
    }
    const r = lancer(["--date=2026-10-15", "--sortie=sortie-16"]);
    if (r.status !== 2 || !/≠ scellé versionné/.test(r.stderr)) {
      echec("16 remplacement furtif", `le contrôleur hebdomadaire laisse passer (statut ${r.status})`);
    }
    if (existsSync(join(arbre, "sortie-16"))) echec("16 remplacement furtif", "un rapport a été produit sur un registre hors scellé");
    const e = sceller("--ecrire");
    if (e.status !== 0) echec("16 remplacement furtif", "le rescellement explicite échoue");
    else if (sceller().status !== 0) echec("16 remplacement furtif", "après rescellement, la vérification ne repasse pas au vert");
    restaurer();
  }

  /* ---- 17. la référence a HUIT champs — aucun n'est décoratif (contre-revue) ----------------- */
  {
    const urlCible = registre.entrees.find((e) => e.source.review_due < "2026-10-15").source.url;
    const champsJustes = {
      url: urlCible, empreinte_corps: sha256(corpsFaux(urlCible)), url_finale: urlCible,
      statut_http: 200, content_type: "text/html; charset=utf-8",
      octets: Buffer.byteLength(corpsFaux(urlCible)), capturee_le: "2026-09-01", version_controleur: "fraicheur-1",
    };
    /* (a) corps IDENTIQUE mais url_finale, statut, type et octets faux → jamais « inchangée » */
    writeFileSync(join(arbre, "fraicheur/references.json"), JSON.stringify({ version: "fraicheur-1", references: [{
      ...champsJustes, url_finale: urlCible + "?ailleurs", statut_http: 299,
      content_type: "application/pdf", octets: 999 }] }, null, 2));
    const rA = lancer(["--date=2026-10-15", "--sortie=sortie-17a"]);
    const lA = rA.status === 0 ? lireRapport("sortie-17a", "2026-10-15").file_de_travail.find((l) => l.url === urlCible) : null;
    if (!lA || lA.controle !== "potentiellement_modifiee") {
      echec("17 référence à huit champs", `corps identique + quatre champs faux → « ${lA?.controle} » au lieu de potentiellement_modifiee (statut ${rA.status})`);
    } else {
      for (const champ of ["url_finale", "statut_http", "content_type", "octets"]) {
        if (!lA.champs_divergents.includes(champ)) echec("17 référence à huit champs", `le champ divergent « ${champ} » n'est pas nommé`);
      }
      if (lA.champs_divergents.includes("empreinte_corps")) echec("17 référence à huit champs", "empreinte_corps déclarée divergente alors que le corps est identique");
    }
    /* (b) tous les champs justes mais version de contrôleur DIFFÉRENTE → incompatible */
    writeFileSync(join(arbre, "fraicheur/references.json"), JSON.stringify({ version: "fraicheur-1", references: [{
      ...champsJustes, version_controleur: "ancienne-version" }] }, null, 2));
    const rB = lancer(["--date=2026-10-15", "--sortie=sortie-17b"]);
    const lB = rB.status === 0 ? lireRapport("sortie-17b", "2026-10-15").file_de_travail.find((l) => l.url === urlCible) : null;
    if (!lB || lB.controle !== "reference_incompatible") {
      echec("17 référence à huit champs", `version de contrôleur différente → « ${lB?.controle} » au lieu de reference_incompatible`);
    }
    restaurer();
  }

  /* ---- 18. signature EGRESS APRÈS 64 Kio : le corps se balaie EN ENTIER (contre-revue) ------- */
  {
    const urlTardive = registre.entrees.find((e) => e.source.review_due < "2026-10-15").source.url;
    const r = lancer(["--date=2026-10-15", "--sortie=sortie-18"], { FAUX_MODE: "egress-tardif", FAUX_URL_ECHEC: urlTardive });
    if (r.status !== 2 || !/signature environnementale/.test(r.stderr)) {
      echec("18 signature tardive", `sortie ${r.status} — une signature après 64 Kio passe pour un contrôle « ok »`);
    }
    if (existsSync(join(arbre, "sortie-18"))) echec("18 signature tardive", "un rapport a été produit malgré la signature");
  }

  /* ---- 19. le scellé se compare à ÉGALITÉ CANONIQUE TOTALE (contre-revue) -------------------- */
  {
    const scelleFalsifie = JSON.parse(pristins["fraicheur/registre-scelle.json"].toString("utf-8"));
    scelleFalsifie.empreintes.globale = "0".repeat(64);
    scelleFalsifie.empreintes.par_famille.countries = "1".repeat(64);
    writeFileSync(join(arbre, "fraicheur/registre-scelle.json"), JSON.stringify(scelleFalsifie, null, 2));
    const v = sceller();
    if (v.status !== 1 || !/empreintes_falsifiees|décoratif/.test(v.stderr)) {
      echec("19 scellé à égalité totale", `empreintes falsifiées, triplets intacts → statut ${v.status} — un champ du contrat est décoratif`);
    }
    const scelleDouble = JSON.parse(pristins["fraicheur/registre-scelle.json"].toString("utf-8"));
    scelleDouble.entrees.push({ ...scelleDouble.entrees[0] });
    writeFileSync(join(arbre, "fraicheur/registre-scelle.json"), JSON.stringify(scelleDouble, null, 2));
    const v2 = sceller();
    if (v2.status !== 1 || !/doublon/.test(v2.stderr)) {
      echec("19 scellé à égalité totale", `entrée dupliquée → statut ${v2.status} — le doublon est absorbé`);
    }
    restaurer();
  }

  /* ---- 20. le BUDGET global garantit la terminaison : les non-exécutées sont REPORTÉES ------- */
  {
    const r = lancer(["--date=2026-10-15", "--sortie=sortie-20", "--budget-secondes=0"]);
    if (r.status !== 0) echec("20 budget épuisé", `sortie ${r.status} — un budget épuisé passe pour une panne :\n      ${r.stderr.trim().split("\n").slice(0, 2).join("\n      ")}`);
    else {
      const rap = lireRapport("sortie-20", "2026-10-15");
      if (rap.selection.executees !== 0 || rap.selection.reportees !== rap.selection.urls) {
        echec("20 budget épuisé", `exécutées ${rap.selection.executees} / reportées ${rap.selection.reportees} sur ${rap.selection.urls} — les non-exécutées ne sont pas honnêtement reportées`);
      }
      if ((rap.controles.inaccessible ?? 0) !== 0) echec("20 budget épuisé", "des « inaccessibles » ont été fabriquées hors budget");
      if (!(rap.controles.reportee > 0)) echec("20 budget épuisé", "aucune source « reportee » au rapport");
      /* TOUTES les reportées sont NOMMÉES en file — un compteur seul n'est pas un état
       * (contre-revue : 191 reportées à jour n'existaient que comme nombre) */
      const enFileReportees = rap.file_de_travail.filter((l) => l.controle === "reportee").length;
      if (enFileReportees !== rap.controles.reportee) {
        echec("20 budget épuisé", `${enFileReportees} reportée(s) en file ≠ ${rap.controles.reportee} comptée(s) — un état non nommé n'existe pas`);
      }
      const md = readFileSync(join(arbre, "sortie-20", "RAPPORT-2026-10-15.md"), "utf-8");
      if (!/REPORTÉE/.test(md)) echec("20 budget épuisé", "le rapport Markdown ne nomme pas le report");
      if (rapportsR1 && rapportsR1.budget_secondes !== 1800) echec("20 budget épuisé", `budget par défaut ${rapportsR1.budget_secondes} ≠ 1800 s`);
    }
  }

  /* ---- 21. l'ORDRE D'EXÉCUTION est l'ordre de PRIORITÉ, pas l'alphabet (contre-revue :
   *          quand le budget s'épuise, la documentaire à jour ne passe jamais avant la
   *          règle urgente — la file finale ne répare pas une consultation qui n'a jamais
   *          eu lieu) ------------------------------------------------------------------------- */
  {
    viderJournal();
    const r = lancer(["--date=2026-10-15", "--sortie=sortie-21"]);
    if (r.status !== 0) echec("21 ordre d'exécution", `sortie ${r.status}`);
    else {
      const executees = journal().filter((u) => u !== "https://example.com/");
      /* miroir du comparateur : la priorité la plus forte des locators de chaque URL */
      const prio = new Map();
      for (const [url, entrees] of registre.parUrl) {
        let m = null;
        for (const e of entrees) {
          const cand = [etatEcheance(e.source.review_due, "2026-10-15") !== "a_jour" ? 0 : 1,
            ORDRE_IMPACT[CLASSE_IMPACT[e.famille] ?? "D"], e.source.review_due];
          if (!m || cand[0] < m[0] || (cand[0] === m[0] && (cand[1] < m[1] || (cand[1] === m[1] && cand[2] < m[2])))) m = cand;
        }
        prio.set(url, m);
      }
      const attendu = [...registre.parUrl.keys()]
        .filter((u) => prio.get(u)[0] === 0 || dansLaTranche(u, "2026-10-15"))
        .sort((a, b) => {
          const [pa, pb] = [prio.get(a), prio.get(b)];
          return (pa[0] - pb[0]) || (pa[1] - pb[1]) || (pa[2] < pb[2] ? -1 : pa[2] > pb[2] ? 1 : 0) || (a < b ? -1 : 1);
        });
      if (JSON.stringify(executees) !== JSON.stringify(attendu)) {
        const i = executees.findIndex((u, k) => u !== attendu[k]);
        echec("21 ordre d'exécution", `l'ordre réel diverge du miroir de priorité au rang ${i} : « ${executees[i]} » au lieu de « ${attendu[i]} »`);
      }
      /* ancres SÉMANTIQUES, indépendantes du miroir : la première exécutée est une règle
       * urgente, et aucune rotation-à-jour ne précède une urgente */
      const premiere = registre.parUrl.get(executees[0]) ?? [];
      if (!premiere.some((e) => CLASSE_IMPACT[e.famille] === "A" && etatEcheance(e.source.review_due, "2026-10-15") !== "a_jour")) {
        echec("21 ordre d'exécution", `la première URL exécutée (${executees[0]}) n'est pas une règle/restriction URGENTE`);
      }
      let vuNonUrgente = false;
      for (const u of executees) {
        if (prio.get(u)[0] !== 0) vuNonUrgente = true;
        else if (vuNonUrgente) { echec("21 ordre d'exécution", `l'urgente « ${u} » passe APRÈS une rotation à jour`); break; }
      }
    }
  }

  /* ---- 12. le secret n'atteint AUCUN artefact ------------------------------------------------ */
  {
    let fuites = 0;
    const marcher = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const chemin = join(dir, e.name);
        if (e.isDirectory()) marcher(chemin);
        else if (/SECRET-COOKIE-42|SECRET-PROXY/.test(readFileSync(chemin, "latin1"))) { fuites++; echec("12 secret", `le secret apparaît dans ${chemin}`); }
      }
    };
    for (const d of readdirSync(arbre).filter((x) => x.startsWith("sortie-"))) marcher(join(arbre, d));
    if (fuites === 0 && !readdirSync(arbre).some((x) => x.startsWith("sortie-"))) echec("12 secret", "aucun artefact à inspecter — cas non exercé");
  }
} finally {
  gitWt("remove", "--force", arbre);
  rmSync(conteneur, { recursive: true, force: true });
}

/* ---- verdict ---------------------------------------------------------------------------------- */
if (defauts.length === 0) {
  process.stdout.write("21 cas éprouvés au faux curl : un registre vide refuse ; les axes échéance et contrôle\n");
  process.stdout.write("sont indépendants (échue ET inaccessible, hors tranche = non contrôlée) ; la première\n");
  process.stdout.write("capture ne consacre rien (sans_reference, jamais inchangée) ; les échues sont toutes en\n");
  process.stdout.write("file et la sortie reste 0 ; le contrôleur n'écrit rien hors de sa sortie et refuse une\n");
  process.stdout.write("sortie dans les données ; la file est triée impact puis échéance ; le rapport porte son\n");
  process.stdout.write("schéma et des références difformes refusent ; une URL se télécharge UNE fois pour tous\n");
  process.stdout.write("ses locators ; le coupe-circuit (sonde, zéro joignable, egress) ne fabrique aucune\n");
  process.stdout.write("inaccessible ; la rotation sans état couvre tout en 8 semaines ; une URL déplacée est\n");
  process.stdout.write("nommée puis sans référence ; aucun secret n'atteint un artefact ; la référence figée\n");
  process.stdout.write("distingue inchangée de potentiellement modifiée — sans jamais prononcer de verdict ;\n");
  process.stdout.write("et le SCELLÉ du registre vit dans le système qui tourne : absent → refus, source\n");
  process.stdout.write("changée sans rescellement → nommée en CI et refusée au run, rescellée → vert ; et la\n");
  process.stdout.write("contre-revue du scellement est morte : les huit champs de la référence comptent tous\n");
  process.stdout.write("(quatre faux sous un corps identique → modifiée nommée ; version → incompatible), la\n");
  process.stdout.write("signature d'egress se trouve même après 64 Kio, le scellé se compare en égalité\n");
  process.stdout.write("canonique totale (empreintes falsifiées et doublon rougissent), la rotation tient à\n");
  process.stdout.write("la frontière d'année, une référence orpheline est nommée, le budget global garantit\n");
  process.stdout.write("la terminaison — les non-exécutées sont reportées, TOUTES nommées en file, jamais\n");
  process.stdout.write("inaccessibles — et l'exécution suit la priorité : la règle urgente d'abord, jamais\n");
  process.stdout.write("l'alphabet.\n\n");
  process.stdout.write("[fraicheur] le contrôleur observe, il ne fabrique rien.\n");
  process.exit(0);
}
process.stderr.write(`\n[fraicheur] ÉCHEC — ${defauts.length} défaut(s) :\n`);
for (const d of defauts) process.stderr.write(`  ${d}\n`);
process.exit(1);
