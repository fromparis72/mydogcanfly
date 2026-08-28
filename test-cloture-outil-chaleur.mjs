#!/usr/bin/env node
/**
 * Garde de la CLÔTURE du lot F — l'outil chaleur ne sera pas construit, son adresse est morte.
 *
 *   node test-cloture-outil-chaleur.mjs            (sources — toujours)
 *   node test-cloture-outil-chaleur.mjs            (+ dist si packages/ui/dist existe)
 *
 * Arbitrage propriétaire (27/08/2026) : `/tools/is-it-too-hot-for-my-dog/` est retirée
 * définitivement, en 404 franc, sans redirection (celle vers /tools/heat/ est un interdit —
 * elle enverrait le lecteur sur une page qui ne répond pas à la promesse du lien). La
 * contre-revue du 28/08 a montré que « définitif dans les sources » était plus large que le
 * geste : 44 chemins hérités (content/, layouts/) portaient encore des CTA réimportables.
 * Cette garde rend la clôture OPPOSABLE :
 *   1. le fichier de l'ancienne page n'existe pas ;
 *   2. l'adresse est absente de TOUTES les sources publiables ou rebâtissables ;
 *   3. l'adresse est absente des sitemaps construits (quand dist existe) ;
 *   4. le build complet ne sert pas la page et ne la redirige pas — le 404 est le contrat ;
 *   5. contre-épreuve : réintroduire un CTA dans un article fait rougir la garde (prouvé sur
 *      le VRAI scanner, contre une copie mutée) ;
 *   6. la page /tools/ ne promet que ce qu'elle montre : le nombre d'outils annoncé dans le
 *      texte égale le nombre réel de cartes, et aucune promesse de diagnostic chaleur ne
 *      subsiste. Contre-revue du 28/08 (2e passe) : le scanner ne cherchait que l'ancien slug,
 *      quatre passages promettaient encore l'outil (« Four free tools », « too hot »…) sans
 *      que rien ne rougisse — la promesse fonctionnelle survivait à l'adresse morte.
 * Les mentions HISTORIQUES qualifiées (dossiers, commentaires d'audit, contre-épreuves, docs
 * d'inventaire) vivent HORS du périmètre balayé — elles racontent, elles ne publient pas.
 */
import { readFileSync, readdirSync, statSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ADRESSE = "is-it-too-hot-for-my-dog";
let defauts = 0;
const echec = (cas, detail) => { defauts++; console.error(`  ✗ ${cas} — ${detail}`); };
const ok = (cas) => console.log(`  ✓ ${cas}`);

/** Le scanner : les fichiers d'une racine qui portent l'adresse. C'est LUI que la
 *  contre-épreuve exerce — pas une réimplémentation. */
function scanner(racine) {
  const trouves = [];
  const marcher = (dossier) => {
    for (const nom of readdirSync(dossier)) {
      const chemin = join(dossier, nom);
      const st = statSync(chemin);
      if (st.isDirectory()) { marcher(chemin); continue; }
      if (!st.isFile()) continue;
      try {
        if (readFileSync(chemin, "utf8").includes(ADRESSE)) trouves.push(chemin);
      } catch { /* binaire : une adresse ne s'y publie pas */ }
    }
  };
  marcher(racine);
  return trouves;
}

/* ---- 1. l'ancienne page n'existe plus -------------------------------------------------------- */
{
  const chemin = "static/tools/is-it-too-hot-for-my-dog/index.html";
  if (existsSync(chemin)) echec("1 page supprimée", `${chemin} existe encore`);
  else ok("1 static/tools/is-it-too-hot-for-my-dog/ n'existe plus");
}

/* ---- 2. zéro mention dans les sources publiables ou rebâtissables ---------------------------- */
{
  const RACINES = ["content", "layouts", "worker/src", "packages/ui/src", "packages/ui/public", "static"];
  let total = 0;
  for (const racine of RACINES) {
    if (!existsSync(racine)) continue;
    for (const f of scanner(racine)) { echec("2 sources publiables", `${f} porte encore l'adresse`); total++; }
  }
  if (total === 0) ok(`2 zéro mention dans ${RACINES.join(", ")}`);
}

/* ---- 3 + 4. le build construit ne la sert pas, ne la liste pas, ne la redirige pas ----------- */
{
  const DIST = "packages/ui/dist";
  if (!existsSync(DIST)) {
    console.log("  · 3-4 dist absent : contrôles du build portés par le job « Site entier » (test:built-ui)");
  } else {
    let d = 0;
    for (const f of readdirSync(DIST).filter((n) => n.startsWith("sitemap") && n.endsWith(".xml"))) {
      if (readFileSync(join(DIST, f), "utf8").includes(ADRESSE)) { echec("3 sitemaps construits", `${f} liste l'adresse`); d++; }
    }
    if (existsSync(join(DIST, "tools", "is-it-too-hot-for-my-dog"))) { echec("4 le build sert la page", "dist/tools/is-it-too-hot-for-my-dog existe"); d++; }
    const redirects = join(DIST, "_redirects");
    if (existsSync(redirects) && readFileSync(redirects, "utf8").includes(ADRESSE)) {
      echec("4 pas de redirection", "dist/_redirects porte une règle pour l'adresse — le 404 franc est le contrat"); d++;
    }
    if (d === 0) ok("3-4 build : absente des sitemaps, aucune page servie, aucune redirection — le 404 est le contrat");
  }
}

/* ---- 5. contre-épreuve : un CTA réintroduit ROUGIT ------------------------------------------- */
{
  const tmp = mkdtempSync(join(tmpdir(), "cloture-chaleur-"));
  try {
    const article = readFileSync("content/dog-heat-safety/pug.md", "utf8");
    writeFileSync(join(tmp, "pug.md"), article +
      "\n👉 **Want a live answer?** Our **[checker](/tools/is-it-too-hot-for-my-dog/?breed=Pug)** is back.\n");
    const trouves = scanner(tmp);
    if (trouves.length !== 1) echec("5 contre-épreuve", `le scanner ne voit pas le CTA réintroduit (${trouves.length} trouvé(s))`);
    else ok("5 contre-épreuve : un CTA réintroduit dans un article est détecté par le même scanner");
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

/* ---- 6. la page /tools/ ne promet que ce qu'elle montre -------------------------------------- */

/** Le vérificateur de cohérence : cardinalité annoncée vs cartes réelles, et promesses chaleur.
 *  C'est LUI que les contre-épreuves 6b/6c exercent — pas une réimplémentation. */
function verifierPromesses(texte) {
  const problemes = [];
  const cartes = (texte.match(/class="lcv-tool"/g) ?? []).length;
  const NOMBRES = { two: 2, three: 3, four: 4, five: 5, six: 6 };
  for (const m of texte.matchAll(/\b(two|three|four|five|six)\b(?:\s+\w+){0,2}\s+tools\b/gi)) {
    const annonce = NOMBRES[m[1].toLowerCase()];
    if (annonce !== cartes) {
      problemes.push(`le texte annonce « ${m[0]} » (${annonce}) mais la page porte ${cartes} carte(s)`);
    }
  }
  for (const motif of [/too hot/i, /heat is safe/i, /heat check/i, /trop chaud/i]) {
    const m = texte.match(motif);
    if (m) problemes.push(`promesse chaleur survivante : « ${m[0]} »`);
  }
  return problemes;
}

{
  const texte = readFileSync("content/tools.md", "utf8");
  const problemes = verifierPromesses(texte);
  if (problemes.length > 0) for (const p of problemes) echec("6 promesses de la page /tools/", p);
  else ok("6 la page /tools/ annonce exactement ses cartes, sans promesse chaleur");

  // 6b. contre-épreuve : « four tools » réintroduit (cartes inchangées) doit être vu.
  const quatre = texte.replace(/\bthree\b(?=(?:\s+\w+){0,2}\s+tools\b)/i, "four");
  if (quatre === texte) echec("6b contre-épreuve", "la mutation « three → four » ne s'applique plus — la contre-épreuve ne prouve rien");
  else if (verifierPromesses(quatre).length === 0) echec("6b contre-épreuve", "« four tools » réintroduit sans quatrième carte n'est PAS détecté");
  else ok("6b contre-épreuve : « four tools » réintroduit sans quatrième carte est détecté");

  // 6c. contre-épreuve : une promesse de diagnostic chaleur réintroduite doit être vue.
  const chaleur = texte + "\nSee if it's too hot for your dog today.\n";
  if (verifierPromesses(chaleur).length === 0) echec("6c contre-épreuve", "une promesse chaleur réintroduite n'est PAS détectée");
  else ok("6c contre-épreuve : une promesse de diagnostic chaleur réintroduite est détectée");
}

if (defauts) { console.error(`\n[cloture-chaleur] ÉCHEC — ${defauts} défaut(s)`); process.exit(1); }
console.log("\n[cloture-chaleur] l'adresse est morte partout où elle pouvait renaître — et la garde sait rougir.");
