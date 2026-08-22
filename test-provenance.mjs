#!/usr/bin/env node
/**
 * test-provenance.mjs — LE HARNAIS PERMANENT DU CONTRAT DE PROVENANCE.
 *
 * POURQUOI IL EXISTE. Les huit contre-épreuves qui ont établi ce contrat les 20 et 21/08/2026
 * ont été jouées À LA MAIN, une fois, et leur relevé est allé dans un compte rendu. Codex l'a
 * dit sans détour le 22/08/2026 : c'est exactement ce que l'en-tête de `test-contre-epreuves.mjs`
 * reproche aux vérifications manuelles. Une contre-épreuve non versionnée est une contre-épreuve
 * qui ne sera pas rejouée, et les trois trous qu'il a trouvés dans ce même contrat — deux fichiers
 * hors périmètre, trois variables ignorées, git échouant OUVERT — sont précisément le genre de
 * régression qu'un catalogue figé aurait vue.
 *
 * CE QU'IL FAIT. Il attaque le contrat, une attaque à la fois, et exige que chaque attaque
 * produise LE DIAGNOSTIC ATTENDU. Chaque attaque est encadrée par son TÉMOIN : le motif cherché
 * doit être ABSENT avant, PRÉSENT après. Un harnais qui ne vérifie que « ça rougit » ne distingue
 * pas une garantie qui mord d'un montage cassé.
 *
 * IL REFUSE DE CONCLURE SUR UN ARBRE SALE. Ses attaques se lisent dans les mêmes signaux que vos
 * modifications en cours — `salete()` ne dit pas QUI a écrit. Plutôt que de sauter les contrôles
 * qu'il ne peut pas juger, il s'arrête et le dit : un harnais qui saute est un harnais vert.
 *
 *   node test-provenance.mjs
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ENTREES, EXCLUSIONS, NEUTRALISEES, PARAMETRES, RACINE, REFUSEES, SCHEMA,
  ecrireProvenance, empreinte, environnementDeBuild, ErreurProvenance,
  salete, variablesLuesParLesSources, verifierProvenance,
} from "./packages/knowledge/scripts/lib/provenance.mjs";

let echecs = 0;
let total = 0;
const ok = (libelle) => { total++; process.stdout.write(`  ✔ ${libelle}\n`); };
function verifier(libelle, condition, detail = "") {
  total++;
  if (condition) { process.stdout.write(`  ✔ ${libelle}\n`); return true; }
  echecs++;
  process.stdout.write(`  ✘ ${libelle}${detail ? ` — ${detail}` : ""}\n`);
  return false;
}
const titre = (t) => process.stdout.write(`\n${t}\n`);

/** Une attaque se juge sur un MOTIF : absent du témoin, présent après. */
function attaque(libelle, motif, temoin, apres) {
  const dansTemoin = temoin.some((e) => e.includes(motif));
  const dansApres = apres.some((e) => e.includes(motif));
  if (dansTemoin) {
    return verifier(libelle, false,
      `TÉMOIN INVALIDE : « ${motif} » est déjà signalé AVANT l'attaque — le contrôle ne prouve rien`);
  }
  return verifier(libelle, dansApres,
    `« ${motif} » attendu ; écarts obtenus : ${apres.length ? apres.map((e) => e.split("\n")[0]).join(" | ") : "aucun"}`);
}

/* ── 0. L'arbre doit être propre ─────────────────────────────────────────────────────────── */
titre("0 · Conditions d'exécution");
{
  let sale;
  try { sale = salete(); }
  catch (e) {
    process.stderr.write(`[provenance] impossible de lire l'état du dépôt : ${e.message}\n`);
    process.exit(1);
  }
  if (sale) {
    process.stderr.write(
      "[provenance] ARRÊT — l'arbre de travail est modifié sur le périmètre des entrées :\n"
      + sale.split("\n").map((l) => `    ${l}`).join("\n") + "\n"
      + "[provenance] Ce harnais compare des états AVANT et APRÈS ses propres attaques ; il ne\n"
      + "[provenance] sait pas distinguer les vôtres des siennes. Committer ou remiser, puis relancer.\n"
    );
    process.exit(1);
  }
  ok("arbre propre sur le périmètre des entrées");
}

/* ── 1. Le contrat des variables d'environnement ─────────────────────────────────────────── */
titre("1 · Aucune variable ne change le site sans figurer au contrat");
{
  const lues = variablesLuesParLesSources();
  const declarees = [...PARAMETRES].sort();
  const manquantes = lues.filter((v) => !declarees.includes(v));
  const superflues = declarees.filter((v) => !lues.includes(v));
  verifier(`les ${lues.length} variables lues par les sources sont toutes déclarées`,
    manquantes.length === 0, `non déclarée(s) : ${manquantes.join(", ")}`);
  /* L'autre sens compte autant : une variable déclarée que plus personne ne lit fait croire à une
     couverture qui n'existe plus, et masque le jour où une VRAIE variable disparaît du relevé. */
  verifier("aucune variable déclarée n'est devenue morte",
    superflues.length === 0, `déclarée(s) mais lue(s) nulle part : ${superflues.join(", ")}`);
  verifier("le relevé n'est pas vide", lues.length > 0, "relevé vide : le contrôle passerait sans matière");
}

/* ── 2. Le périmètre couvre l'outillage de build (P0-1, reproduit par Codex le 22/08/2026) ── */
titre("2 · Le périmètre couvre TOUT ce qui construit le site");
{
  const BLOB = /^[0-9a-f]{40,64}$/;
  const relever = (prefixe) => execFileSync(
    "git", ["-C", RACINE, "ls-files", "-s", "--", prefixe], { encoding: "utf8", maxBuffer: 1 << 28 },
  ).trim().split("\n").filter(Boolean).map((l) => {
    const [meta, chemin] = l.split("\t");
    return `${meta.split(" ")[1]} ${chemin}`;
  }).filter((x) => !EXCLUSIONS.includes(x.split(" ")[1]));
  const condense = (l) => createHash("sha256").update(l.slice().sort().join("\n")).digest("hex").slice(0, 16);

  const releve = relever("packages/ui");
  const reference = empreinte().entrees["packages/ui"];
  verifier("le modèle du harnais reproduit exactement l'empreinte du module",
    condense(releve) === reference.sha,
    `harnais ${condense(releve)}, module ${reference.sha} — le reste de ce bloc ne prouverait rien`);
  verifier("chaque ligne relevée porte bien un condensé d'objet git",
    releve.every((x) => BLOB.test(x.split(" ")[0])), "format de « ls-files -s » inattendu");

  /* Les deux fichiers que la v5 laissait dehors. La preuve porte sur l'INDEX : si la ligne du
     fichier disparaissait du relevé, l'empreinte du paquet changerait — c'est donc que son
     contenu y participe. On ne touche pas à l'index pour le montrer. */
  for (const chemin of ["packages/ui/scripts/fix-404.mjs", "packages/ui/tsconfig.json"]) {
    const present = releve.some((x) => x.endsWith(` ${chemin}`));
    if (!verifier(`${chemin} est dans le périmètre`, present, "absent du relevé")) continue;
    const sans = releve.filter((x) => !x.endsWith(` ${chemin}`));
    verifier(`${chemin} pèse sur l'empreinte de packages/ui`,
      condense(sans) !== reference.sha, "le retirer ne change pas le condensé");
  }

  for (const e of Object.entries(empreinte().entrees)) {
    verifier(`entrée « ${e[0]} » : ${e[1].fichiers} fichier(s) suivis`, e[1].fichiers > 0, "entrée vide");
  }
}

/* ── 3. Les exclusions sont bornées et réelles ───────────────────────────────────────────── */
titre("3 · Les exclusions ne sont ni fantômes ni tacites");
{
  const suivis = new Set(execFileSync("git", ["-C", RACINE, "ls-files"], { encoding: "utf8", maxBuffer: 1 << 28 })
    .trim().split("\n"));
  for (const x of EXCLUSIONS) verifier(`exclusion « ${x} » désigne un fichier suivi`, suivis.has(x));
  verifier("la seule exclusion nominative est le producteur de la carte",
    EXCLUSIONS.length === 1 && EXCLUSIONS[0] === "packages/knowledge/scripts/lib/provenance.mjs",
    `EXCLUSIONS = ${JSON.stringify(EXCLUSIONS)} — élargir le trou doit être un geste délibéré, `
    + "documenté ici et dans l'en-tête du module");
  verifier("les entrées sont des paquets entiers, pas une liste de fichiers",
    ENTREES.filter((e) => e.startsWith("packages/")).every((e) => e.split("/").length === 2),
    `entrées trop fines : ${ENTREES.filter((e) => e.startsWith("packages/") && e.split("/").length > 2).join(", ")}`);
}

/* ── 4. L'environnement de build refuse et neutralise (P0-2) ─────────────────────────────── */
titre("4 · L'environnement de build refuse OUTDIR et retire les filtres hérités");
{
  const base = { PATH: "/usr/bin", HOME: "/home/x" };
  /* TÉMOIN : sans variable interdite, la fabrique rend bien un environnement. */
  let temoin = null;
  try { temoin = environnementDeBuild(base, { PUBLIC_SITE_ENV: "preview" }); } catch { /* témoin */ }
  verifier("témoin : un environnement sain est accepté", temoin?.PUBLIC_SITE_ENV === "preview");

  for (const k of REFUSEES) {
    for (const [origine, b, s] of [["hérité", { ...base, [k]: "/ailleurs" }, {}],
                                   ["en surcharge", base, { [k]: "/ailleurs" }]]) {
      let leve = null;
      try { environnementDeBuild(b, s); } catch (e) { leve = e; }
      verifier(`${k} ${origine} est REFUSÉ`,
        leve instanceof ErreurProvenance && leve.message.includes(k),
        leve ? leve.message : "aucune erreur levée : le build écrirait ailleurs que là où l'on scelle");
    }
  }

  for (const k of NEUTRALISEES) {
    const env = environnementDeBuild({ ...base, [k]: "valeur-heritee" });
    verifier(`${k} hérité est RETIRÉ`, !(k in env),
      `${k} = ${JSON.stringify(env[k])} — un filtre hérité amputerait un site déclaré complet`);
  }

  /* La surcharge nommée doit rester possible : c'est ainsi que `build:ci` pose ses sentinelles. */
  const filtre = environnementDeBuild({ ...base, BUILD_ONLY: "herite" }, { BUILD_ONLY: "airlines" });
  verifier("une surcharge NOMMÉE s'applique après le retrait", filtre.BUILD_ONLY === "airlines",
    `BUILD_ONLY = ${JSON.stringify(filtre.BUILD_ONLY)}`);
}

/* ── 5. Git échoue FERMÉ (P0-3, reproduit par Codex hors dépôt) ──────────────────────────── */
titre("5 · Hors dépôt git, le module s'arrête au lieu de déclarer « propre »");
{
  const RUNNER = [
    'import { empreinte, salete } from "./packages/knowledge/scripts/lib/provenance.mjs";',
    "const out = {};",
    'for (const [nom, f] of [["empreinte", () => empreinte({})], ["salete", () => salete()]]) {',
    "  try { out[nom] = { ok: true, valeur: f() }; }",
    "  catch (e) { out[nom] = { ok: false, nom: e.name, message: e.message }; }",
    "}",
    "process.stdout.write(JSON.stringify(out));",
  ].join("\n");

  const jouer = (racine) => {
    const r = spawnSync(process.execPath, [join(racine, "sonde.mjs")], { encoding: "utf8" });
    try { return JSON.parse(r.stdout); }
    catch { return { erreur: `sortie illisible (code ${r.status}) : ${r.stdout}${r.stderr}` }; }
  };

  /* TÉMOIN : la même sonde, sur le vrai dépôt, doit RÉUSSIR. Sans lui, « ça lève » ne
     distinguerait pas un garde-fou qui mord d'un module qui ne s'importe même pas. */
  const sondeReelle = join(RACINE, "sonde.mjs");
  let temoin;
  try { writeFileSync(sondeReelle, RUNNER); temoin = jouer(RACINE); }
  finally { rmSync(sondeReelle, { force: true }); }
  verifier("témoin : dans le dépôt, l'empreinte est établie",
    temoin?.empreinte?.ok === true && Object.keys(temoin.empreinte.valeur?.entrees ?? {}).length === ENTREES.length,
    JSON.stringify(temoin).slice(0, 300));
  verifier("témoin : dans le dépôt, l'état de propreté est lisible", temoin?.salete?.ok === true);

  const hors = mkdtempSync(join(tmpdir(), "provenance-hors-depot-"));
  try {
    mkdirSync(join(hors, "packages/knowledge/scripts/lib"), { recursive: true });
    cpSync(join(RACINE, "packages/knowledge/scripts/lib/provenance.mjs"),
      join(hors, "packages/knowledge/scripts/lib/provenance.mjs"));
    writeFileSync(join(hors, "sonde.mjs"), RUNNER);
    const r = jouer(hors);
    verifier("hors dépôt, `empreinte()` LÈVE au lieu de rendre des condensés vides",
      r?.empreinte?.ok === false && r.empreinte.nom === "ErreurProvenance",
      JSON.stringify(r?.empreinte ?? r).slice(0, 400));
    verifier("hors dépôt, `salete()` LÈVE au lieu de répondre « propre »",
      r?.salete?.ok === false && r.salete.nom === "ErreurProvenance",
      JSON.stringify(r?.salete ?? r).slice(0, 400));
    verifier("le diagnostic nomme git",
      /git/i.test(r?.empreinte?.message ?? "") || /dépôt/i.test(r?.empreinte?.message ?? ""),
      r?.empreinte?.message);
    /* La panne exacte que ce contrôle ferme : le condensé du vide, qui s'accorde avec lui-même. */
    const VIDE = createHash("sha256").update("").digest("hex").slice(0, 16);
    verifier("aucun condensé du vide n'est rendu",
      !JSON.stringify(r?.empreinte?.valeur ?? {}).includes(VIDE), `« ${VIDE} » présent`);
  } finally {
    rmSync(hors, { recursive: true, force: true });
  }
}

/* ── 6. La carte confrontée au site : un site témoin, puis les attaques ──────────────────── */
titre("6 · La carte confronte le site scellé à ce qu'on lui présente");
const bac = mkdtempSync(join(tmpdir(), "provenance-site-"));
try {
  const LANGUES = ["en", "fr", "es", "pt"];
  const PAGES = 2060;                     // au-dessus du plancher de 2000 URL distinctes
  const modele = join(bac, "modele");

  mkdirSync(modele, { recursive: true });
  const urls = LANGUES.map(() => []);
  for (let i = 0; i < PAGES; i++) {
    const chemin = `/p/${String(i).padStart(4, "0")}`;
    mkdirSync(join(modele, chemin), { recursive: true });
    writeFileSync(join(modele, chemin, "index.html"), `<html><body>${i}</body></html>\n`);
    urls[i % LANGUES.length].push(`https://mydogcanfly.com${chemin}`);
  }
  const ecrireSitemaps = (dist, listes) => LANGUES.forEach((l, i) => writeFileSync(
    join(dist, `sitemap-${l}.xml`),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset>\n`
    + listes[i].map((u) => `  <url><loc>${u}</loc></url>\n`).join("") + "</urlset>\n"));
  ecrireSitemaps(modele, urls);
  ecrireProvenance(modele, "complet");

  /** Un site neuf, identique au modèle, pour chaque attaque : les attaques ne se contaminent pas. */
  let n = 0;
  const site = () => {
    const d = join(bac, `site-${n++}`);
    cpSync(modele, d, { recursive: true });
    return d;
  };
  const carte = (d) => JSON.parse(readFileSync(join(d, ".provenance.json"), "utf8"));
  const rescelller = (d, c) => writeFileSync(join(d, ".provenance.json"), JSON.stringify(c, null, 2) + "\n");

  /* LE TÉMOIN. Un site intact, scellé à l'instant, ne doit produire AUCUN écart. C'est lui qui
     rend les attaques lisibles : sans lui, une liste non vide ne dirait pas si la garantie a mordu
     ou si le montage était cassé d'avance. */
  const temoin = verifierProvenance(modele, "complet");
  if (!verifier("témoin : un site intact ne produit aucun écart", temoin.length === 0,
    temoin.map((e) => e.split("\n")[0]).join(" | "))) {
    process.stderr.write("[provenance] le témoin est rouge : les attaques ci-dessous ne prouveraient rien.\n");
  }

  {
    const d = site();
    rmSync(join(d, ".provenance.json"));
    attaque("carte absente → refus", "absent : impossible de savoir", temoin, verifierProvenance(d, "complet"));
  }
  {
    const d = site();
    const c = carte(d); c.schema = SCHEMA + 99; rescelller(d, c);
    attaque("carte d'un autre schéma → refus sans interprétation", `schéma ${SCHEMA + 99}`,
      temoin, verifierProvenance(d, "complet"));
  }
  {
    const d = site();
    const c = carte(d); delete c.dist; delete c.pages; c.schema = SCHEMA; rescelller(d, c);
    /* Un champ disparu ne doit pas se lire « undefined » et passer pour une égalité. */
    attaque("champ disparu → écart, jamais une égalité tacite", "le site a changé depuis le build",
      temoin, verifierProvenance(d, "complet"));
  }
  {
    const d = site();
    const f = join(d, "p/0000/index.html");
    writeFileSync(f, readFileSync(f, "utf8") + " ");     // UN octet
    attaque("un seul octet ajouté → l'empreinte du dist le voit", "le site a changé depuis le build",
      temoin, verifierProvenance(d, "complet"));
  }
  {
    const d = site();
    rmSync(join(d, "p/0007"), { recursive: true });
    const apres = verifierProvenance(d, "complet");
    attaque("une page retirée → le décompte le dit", "la carte annonce", temoin, apres);
    attaque("une page retirée → l'inclusion des sitemaps la nomme", "sans page construite", temoin, apres);
  }
  {
    const d = site();
    const f = join(d, "sitemap-en.xml");
    const src = readFileSync(f, "utf8");
    const doublon = src.match(/ {2}<url><loc>[^<]+<\/loc><\/url>\n/)[0];
    writeFileSync(f, src.replace("</urlset>", doublon + "</urlset>"));
    /* P1-b : sans unicité, un `<loc>` répété gonflerait le total et pourrait le porter au-dessus
       du plancher pendant que des pages manquent. */
    attaque("une URL annoncée deux fois → doublon signalé", "PLUSIEURS fois par les sitemaps",
      temoin, verifierProvenance(d, "complet"));
  }
  {
    const d = site();
    attaque("portée « complet » exigée d'un site réduit → refus", "portée « complet » et non « reduit »",
      temoin, verifierProvenance(d, "reduit"));
  }
  {
    const d = site();
    const c = carte(d); c.parametres.OUTDIR = "/tmp/ailleurs"; rescelller(d, c);
    attaque("OUTDIR inscrit sur la carte → le dossier scellé n'est pas celui qu'Astro a écrit",
      "paramètre OUTDIR", temoin, verifierProvenance(d, "complet"));
  }
  for (const [k, v] of [["BUILD_ONLY", "airlines"], ["BUILD_SLUGS", "airlines:thai-airways"]]) {
    const d = site();
    const c = carte(d); c.parametres[k] = v; rescelller(d, c);
    attaque(`${k} inscrit → un site filtré ne peut pas être complet`, `paramètre ${k}`,
      temoin, verifierProvenance(d, "complet"));
  }
  {
    const d = site();
    const c = carte(d); c.parametres.BUILD_SHARDS = "4"; c.parametres.BUILD_SHARD = "1"; rescelller(d, c);
    attaque("BUILD_SHARDS inscrit → ce site est une TRANCHE", "est une TRANCHE",
      temoin, verifierProvenance(d, "complet"));
  }
  {
    const d = site();
    const c = carte(d); c.parametres = { ...c.parametres }; delete c.parametres.PUBLIC_API_BASE; rescelller(d, c);
    attaque("un paramètre du contrat absent de la carte → écart", "absent de la carte",
      temoin, verifierProvenance(d, "complet"));
  }
  {
    const d = site();
    const c = carte(d); c.exclusions = [...c.exclusions, "packages/ui/src"]; rescelller(d, c);
    /* Élargir le trou change ce que l'empreinte COUVRE : une égalité de condensés sous deux
       périmètres différents ne veut rien dire, et doit donc être refusée avant d'être lue. */
    attaque("périmètre élargi sur la carte → refus", "le périmètre a changé",
      temoin, verifierProvenance(d, "complet"));
  }
  {
    const d = site();
    const c = carte(d); c.node = "v18.0.0"; rescelller(d, c);
    attaque("construit sous un autre Node → écart", "construit sous Node v18.0.0",
      temoin, verifierProvenance(d, "complet"));
  }
  {
    const d = site();
    const c = carte(d);
    const k = Object.keys(c.entrees)[0];
    c.entrees[k] = { fichiers: c.entrees[k].fichiers, sha: "0".repeat(16) };
    rescelller(d, c);
    attaque("entrées d'un autre commit → écart nommant l'entrée", `${k} : site construit sur`,
      temoin, verifierProvenance(d, "complet"));
  }
  {
    const d = site();
    const c = carte(d); c.entrees_propres = false; rescelller(d, c);
    attaque("construit depuis des entrées modifiées → écart", "entrées MODIFIÉES",
      temoin, verifierProvenance(d, "complet"));
  }
} finally {
  rmSync(bac, { recursive: true, force: true });
}

/* ── 7. Une modification de l'outillage salit le périmètre (P0-1, versant copie de travail) ─ */
titre("7 · Toucher à l'outillage de build salit le périmètre");
for (const chemin of ["packages/ui/scripts/fix-404.mjs", "packages/ui/tsconfig.json"]) {
  const abs = join(RACINE, chemin);
  const original = readFileSync(abs);
  try {
    verifier(`témoin : ${chemin} intact → périmètre propre`, salete() === "");
    writeFileSync(abs, Buffer.concat([original, Buffer.from("\n")]));
    const sale = salete();
    verifier(`${chemin} modifié → le périmètre est déclaré SALE et le nomme`,
      sale.includes(chemin), sale ? `relevé : ${sale.replace(/\n/g, " ; ")}` : "périmètre déclaré propre");
  } finally {
    writeFileSync(abs, original);
  }
}
verifier("le harnais n'a rien laissé derrière lui", salete() === "", salete().replace(/\n/g, " ; "));

/* ── Verdict ─────────────────────────────────────────────────────────────────────────────── */
process.stdout.write(`\n${total - echecs}/${total} contrôles OK\n`);
if (echecs > 0) {
  process.stderr.write(`[provenance] ÉCHEC : ${echecs} contrôle(s) en défaut.\n`);
  process.exit(1);
}
process.stdout.write("[provenance] Le contrat de provenance tient : chaque attaque a produit son diagnostic.\n");
