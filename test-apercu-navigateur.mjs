#!/usr/bin/env node
/**
 * LA JOURNÉE 5, AU NAVIGATEUR — sur l'artefact qui partirait en production.
 *
 *   PLAYWRIGHT=/chemin/vers/playwright node test-apercu-navigateur.mjs [--port=8788]
 *
 * CE QUE CE HARNAIS EST, ET CE QU'IL N'EST PAS. La journée 5 demande de vérifier la préversion
 * AU NAVIGATEUR. Je ne peux ni créer la préversion Cloudflare ni promouvoir un alias — ce sont
 * des décisions de Philippe — et ce conteneur n'a pas d'accès réseau sortant. Mais l'artefact à
 * vérifier est ici : c'est le `dist` que le déploiement enverrait. `apercu-local.mjs` le sert avec
 * le VRAI Worker derrière `/v1/*`, et Chromium le pilote pour de bon — formulaire rempli, requête
 * envoyée, résultat rendu, JavaScript exécuté.
 *
 * CE QUI EST DONC RÉELLEMENT PROUVÉ : le HTML, le CSS, le JavaScript, le moteur et les données
 * sont exactement ceux qui partiraient. Un verdict faux, une incertitude mal dite ou un montant
 * résiduel se voient ici comme ils se verraient en ligne.
 * CE QUI NE L'EST PAS : la couche Cloudflare — en-têtes, `_routes.json`, alias, cache. Elle reste
 * à vérifier APRÈS la bascule, et `preflight-production.mjs` imprime comment.
 *
 * IL N'EST PAS DANS `test:unit` : il exige un navigateur, que la CI n'a pas garanti. Il est
 * OPT-IN et le dit quand il ne peut pas s'exécuter, plutôt que de passer en silence — un contrôle
 * qui s'escamote tout seul est un contrôle qui ne prouve rien.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split("=").slice(1).join("=");
const PORT = Number(arg("port", "8788"));
const BASE = `http://localhost:${PORT}`;
const CHROME = process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  ÉCHEC ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

/* Playwright n'est pas une dépendance du dépôt : le harnais le prend où on le lui dit. */
let chromium;
try {
  const req = createRequire(import.meta.url);
  chromium = req(process.env.PLAYWRIGHT ?? "playwright").chromium;
} catch {
  console.log("[aperçu] NON JOUÉ — playwright introuvable.");
  console.log("  npm i playwright ailleurs, puis : PLAYWRIGHT=/chemin/playwright node test-apercu-navigateur.mjs");
  process.exit(0);
}

/* ---- Le serveur d'aperçu, démarré et arrêté par le harnais ---------------------------------- */
const serveur = spawn("npx", ["tsx", "apercu-local.mjs", `--port=${PORT}`], { stdio: ["ignore", "pipe", "pipe"] });
const arreter = () => { try { serveur.kill("SIGTERM"); } catch { /* déjà mort */ } };
process.on("exit", arreter);

const attendre = async () => {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${BASE}/v1/health`); if (r.ok) return true; } catch { /* pas encore */ }
    await new Promise((ok) => setTimeout(ok, 1000));
  }
  return false;
};
if (!(await attendre())) { console.error("[aperçu] le serveur local n'a pas démarré"); arreter(); process.exit(2); }

/* LES CAPTURES. Philippe ne lit pas le code : « vérifier au navigateur » veut dire, pour lui,
   REGARDER. Le harnais dépose donc des images de ce qu'il a vu, au même titre que ses assertions —
   elles ne prouvent rien à elles seules, mais elles rendent la vérification consultable. */
const CAPTURES = arg("captures", "mesures/apercu-jour5");
mkdirSync(CAPTURES, { recursive: true });
const capturer = async (page, nom) => {
  try { await page.screenshot({ path: join(CAPTURES, `${nom}.png`), fullPage: false }); } catch { /* non bloquant */ }
};

const navigateur = await chromium.launch({ executablePath: CHROME });
const contexte = await navigateur.newContext({ viewport: { width: 1280, height: 900 } });

/** Les erreurs JS sont collectées PAR PAGE : une page qui plante en silence rend un écran vide
 *  que tous les contrôles de texte traverseraient sans rien voir. */
const nouvellePage = async () => {
  const p = await contexte.newPage();
  p.__erreurs = [];
  p.on("pageerror", (e) => p.__erreurs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|ERR_INTERNET/.test(m.text())) p.__erreurs.push(m.text()); });
  return p;
};

/** Une recherche complète : lien profond, poids, race éventuelle, soumission, attente du résultat. */
async function chercher({ from, dest, kg, race = null, placement = null, locale = "" }) {
  const p = await nouvellePage();
  await p.goto(`${BASE}${locale}/?from=${from}&dest=${dest}`, { waitUntil: "networkidle" });
  if (race) { await p.fill("#f-breed", race); await p.dispatchEvent("#f-breed", "input"); }
  await p.fill("#f-weight", String(kg));
  if (placement) await p.selectOption("#f-placement", placement);
  await p.click("#mdcf-finder button[type=submit]");
  await p.waitForSelector("#mdcf-finder-result:not([hidden])", { timeout: 30000 });
  await p.waitForTimeout(1200);
  const texte = (await p.textContent("#mdcf-finder-result")) ?? "";
  const cartes = await p.$$eval(".acard, [class*=acard]", (n) => n.length).catch(() => 0);
  return { p, texte, cartes };
}

/* Les MONTANTS. Un chiffre accolé à une devise — les poids (« 8 kg »), les pourcentages et les
   dates ne sont pas des prix.
 *
 * MAIS TOUS LES MONTANTS NE SONT PAS DES TARIFS, et ma première rédaction les confondait. Elle
 * a fait rougir la fiche France sur « une amende de 15 000 € » (article L211-15 du Code rural),
 * l'Estonie sur « jusqu'à 6 400 € » et le Portugal sur « 42,25 € de contrôle vétérinaire » : trois
 * FAITS JURIDIQUES sourcés, publiés par des textes officiels, qui n'ont rien à voir avec ce que le
 * micro-lot Tarifs a retiré. Ce lot-là visait les TARIFS DE TRANSPORT ANIMAL — des chaînes libres,
 * sans devise séparée, sans route, sans date d'applicabilité, impossibles à rapporter à un trajet.
 * Une amende légale n'est pas de cette nature : la masquer appauvrirait la page sans rien rendre
 * plus vrai. Le contrôle porte donc là où le tarif de transport pourrait reparaître — le rapport
 * du Finder et les fiches compagnie —, et PAS sur les pages pays. */
const MONTANT = /(?:[€$£¥]\s?\d[\d\s.,]*|(?:USD|EUR|GBP|CHF|CAD|AUD)\s?\d[\d\s.,]*|\d[\d\s.,]*\s?(?:€|\$|£|EUR|USD|GBP))/;
/* La capture doit porter le montant ENTIER. Une première version s'arrêtait au premier chiffre et
   rapportait « €1 » là où la page dit « €15,000 » : un relevé qui tronque ce qu'il mesure raconte
   autre chose que ce qu'il a vu, et c'est exactement ce qu'on reproche aux données du site. */

console.log("— journée 5 : la préversion, au navigateur —\n");

/* ---- 1, 2, 3. Trois tailles de chien, sur la même route directe ------------------------------ */
console.log("=== Trois tailles de chien — CDG → JFK, vol direct ===");
for (const [nom, kg] of [["petit", 4], ["moyen", 15], ["grand", 32]]) {
  const { p, texte, cartes } = await chercher({ from: "airport_cdg", dest: "airport_jfk", kg });
  check(`chien ${nom} (${kg} kg) : le rapport se rend, ${cartes} carte(s) compagnie`, cartes > 0, `${cartes} carte(s)`);
  check(`chien ${nom} : aucune erreur JavaScript`, p.__erreurs.length === 0, p.__erreurs.slice(0, 2).join(" | "));
  check(`chien ${nom} : AUCUN montant numérique résiduel`, !MONTANT.test(texte),
    (texte.match(MONTANT) ?? []).join(" | "));
  /* L'incertitude doit être DITE, pas seulement absente de contradiction. */
  check(`chien ${nom} : l'incertitude est écrite en toutes lettres`,
    /to confirm with the airline/i.test(texte), texte.slice(0, 120));
  /* Et surtout : aucun verdict catégorique de canal ne doit s'afficher. */
  check(`chien ${nom} : aucune carte n'affiche « Accepted » ni « Not accepted »`,
    !/\b(Accepted|Not accepted)\b/.test(texte), (texte.match(/\b(Accepted|Not accepted)\b/g) ?? []).slice(0, 3).join(" | "));
  await capturer(p, `1-chien-${nom}-${kg}kg`);
  await p.close();
}

/* ---- 4. Les trois canaux sont nommés --------------------------------------------------------- */
console.log("\n=== Cabine, soute et fret ===");
{
  const { p, texte } = await chercher({ from: "airport_cdg", dest: "airport_jfk", kg: 5 });
  for (const canal of ["Cabin", "Hold", "Cargo"]) {
    check(`le canal « ${canal} » est présenté au visiteur`, texte.includes(canal));
  }
  await p.close();
}

/* ---- 5. Direct ET correspondance -------------------------------------------------------------- */
console.log("\n=== Route directe, puis route avec correspondance ===");
{
  const direct = await chercher({ from: "airport_cdg", dest: "airport_jfk", kg: 5 });
  check("CDG → JFK annonce des vols DIRECTS", /Direct/i.test(direct.texte));
  await direct.p.close();
  /* CDG → SYD n'a aucun vol direct dans le graphe : toutes les cartes passent par une escale. */
  const escale = await chercher({ from: "airport_cdg", dest: "airport_syd", kg: 5 });
  check("CDG → SYD se rend et propose des compagnies", escale.cartes > 0, `${escale.cartes} carte(s)`);
  await capturer(escale.p, "2-correspondance-cdg-syd");
  check("…et la correspondance est DITE (escale nommée)",
    /\bvia\b|\bstop\b|escale/i.test(escale.texte), escale.texte.slice(0, 200));
  await escale.p.close();
}

/* ---- 6. La compagnie opératrice est nommée, et sa fiche est atteignable ---------------------- */
console.log("\n=== Compagnie opératrice ===");
{
  const { p, texte } = await chercher({ from: "airport_cdg", dest: "airport_jfk", kg: 5 });
  check("une compagnie réelle est nommée sur les cartes", /Air France|Delta|American Airlines/.test(texte));
  /* LA CARTE NE RENVOIE PAS VERS `/airlines/…`, ET C'EST LE DESSIN DU SITE. Elle renvoie vers
     `/tools/fiche/#from=…&air=airline_…`, l'outil de détail qui recompose la fiche pour CE trajet
     et CE chien. Ma première rédaction exigeait un lien `/airlines/` et rougissait sur zéro : elle
     mesurait ce que j'avais supposé, pas ce que le site fait. Ce qui compte pour le visiteur est
     vérifié ici : le lien existe, il NOMME la compagnie, et il s'ouvre. */
  const liens = await p.$$eval("#mdcf-finder-result a[href*='/tools/fiche/']", (n) => n.map((a) => a.getAttribute("href")));
  check("chaque carte offre un lien de détail qui NOMME sa compagnie", liens.length > 0
    && liens.every((h) => /[?#&]air=airline_[a-z0-9_]+/.test(h)), `${liens.length} lien(s)`);
  if (liens.length) {
    const q = await nouvellePage();
    const r = await q.goto(`${BASE}${liens[0]}`, { waitUntil: "domcontentloaded" });
    check(`le détail s'ouvre (${liens[0].split("#")[0]})`, r?.status() === 200, `HTTP ${r?.status()}`);
    await q.close();
  }
  /* Et la fiche compagnie elle-même, atteinte directement : c'est là que le tarif de transport
     reparaîtrait s'il devait reparaître. */
  const q2 = await nouvellePage();
  const r2 = await q2.goto(`${BASE}/airlines/air-france/`, { waitUntil: "domcontentloaded" });
  await capturer(q2, "3-fiche-compagnie-air-france");
  check("la fiche compagnie s'ouvre", r2?.status() === 200, `HTTP ${r2?.status()}`);
  const fiche = (await q2.textContent("body")) ?? "";
  check("la fiche compagnie ne publie AUCUN tarif de transport", !MONTANT.test(fiche),
    (fiche.match(MONTANT) ?? []).join(" | "));
  check("la fiche compagnie dit son incertitude", /to confirm with the airline/i.test(fiche));
  await q2.close();
  await p.close();
}

/* ---- 7. Restrictions de race ------------------------------------------------------------------ */
console.log("\n=== Restrictions de race — un carlin ===");
{
  const { p, texte, cartes } = await chercher({ from: "airport_cdg", dest: "airport_jfk", kg: 7, race: "Pug" });
  check("la recherche aboutit avec une race brachycéphale", cartes > 0, `${cartes} carte(s)`);
  check("la particularité brachycéphale est DITE au visiteur",
    /brachy|snub|short-nosed|flat-faced|museau/i.test(texte), texte.slice(0, 200));
  await capturer(p, "4-race-carlin");
  await p.close();
  /* Le témoin négatif : un chien NON brachycéphale ne doit pas recevoir cet avis. Sans lui, un
     gabarit qui affiche l'avis à tout le monde passerait le contrôle précédent. */
  const g = await chercher({ from: "airport_cdg", dest: "airport_jfk", kg: 7 });
  check("TÉMOIN : sans race brachycéphale, l'avis n'apparaît pas",
    !/brachy|snub-nosed|flat-faced/i.test(g.texte), (g.texte.match(/brachy\w*/gi) ?? []).slice(0, 3).join(" | "));
  await g.p.close();
}

/* ---- 8. Pays vérifié et pays NON vérifié ------------------------------------------------------ */
console.log("\n=== Un pays adossé à une source gouvernementale, un pays sans ===");
for (const [nom, slug, gouvernemental] of [["France", "fr", true], ["Brésil", "br", false]]) {
  const p = await nouvellePage();
  const r = await p.goto(`${BASE}/countries/${slug}/`, { waitUntil: "domcontentloaded" });
  check(`la fiche pays ${nom} s'ouvre`, r?.status() === 200, `HTTP ${r?.status()}`);
  const corps = (await p.textContent("body")) ?? "";
  check(`${nom} : la page porte du contenu`, corps.length > 800, `${corps.length} caractères`);
  /* Pas de contrôle de montant ici, et la raison est écrite plus haut : les sommes des pages pays
     sont des amendes et des taxes officielles, sourcées. On CONSTATE ce qu'elles contiennent
     plutôt que de l'interdire à tort. */
  const sommes = corps.match(new RegExp(MONTANT.source, "g")) ?? [];
  console.log(`  ·    ${nom} : ${sommes.length} somme(s) affichée(s) — amendes et taxes officielles${sommes.length ? " : " + sommes.slice(0, 3).join(", ") : ""}`);
  check(`${nom} : aucune erreur JavaScript`, p.__erreurs.length === 0, p.__erreurs.slice(0, 2).join(" | "));
  await capturer(p, `5-pays-${slug}`);
  /* La différence attendue est de PROVENANCE, pas de mise en page : la fiche gouvernementale
     doit citer une source officielle, l'autre ne doit pas prétendre en avoir une. */
  const sources = await p.$$eval("a[href^='http']", (n) => n.map((a) => a.getAttribute("href")));
  const officielles = sources.filter((h) => /\.gov|\.gouv|europa\.eu|\.gc\.ca|\.gov\.uk/i.test(h));
  if (gouvernemental) {
    check(`${nom} : au moins une source gouvernementale est citée`, officielles.length > 0, `${officielles.length}`);
  } else {
    console.log(`  ·    ${nom} : ${officielles.length} lien(s) gouvernemental(aux) — constat, non exigé`);
  }
  await p.close();
}

/* ---- 9. La préversion reste fermée aux moteurs ------------------------------------------------ */
console.log("\n=== La préversion ne doit PAS être indexable ===");
{
  /* Codex l'exige explicitement : « la préversion reste en noindex, nofollow ». Le dist servi ici
     est celui de PRODUCTION — il est donc ouvert, et c'est normal. On le CONSTATE plutôt que de
     l'exiger à l'envers : ce qui doit être fermé, c'est la préversion Cloudflare, construite par
     `npm run build` (préversion) et non par `build:prod`. Le contrôle vit dans la porte. */
  const p = await nouvellePage();
  await p.goto(`${BASE}/airlines/air-france/`, { waitUntil: "domcontentloaded" });
  const robots = await p.$eval('meta[name="robots"]', (n) => n.getAttribute("content")).catch(() => null);
  console.log(`  ·    dist servi : meta robots = ${robots ?? "(absente)"} — artefact de PRODUCTION`);
  console.log("  ·    la préversion Cloudflare, elle, est construite par `npm run build` et reste fermée");
  await p.close();
}

await contexte.close();
await navigateur.close();
arreter();

console.log(`\ncaptures déposées dans ${CAPTURES}/`);
console.log(`\n${pass} OK, ${fail} ÉCHEC`);
process.exit(fail > 0 ? 1 : 0);
