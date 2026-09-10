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
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split("=").slice(1).join("=");
const PORT = Number(arg("port", "8788"));
const BASE = `http://localhost:${PORT}`;
/* LE CHEMIN DU NAVIGATEUR N'EST PLUS ÉCRIT EN DUR (07/09/2026).
 *
 * Il valait `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` par défaut — le chemin de LA
 * machine où ce harnais a été écrit. Tant qu'il ne tournait qu'à la main, cela passait ; au
 * premier passage en CI, Playwright a bien téléchargé son navigateur dans
 * `~/.cache/ms-playwright`, et le lancement est allé le chercher dans `/opt`, où il n'y a rien.
 *
 * Ce défaut est resté invisible aussi longtemps que le contrôle n'était lancé par aucun
 * workflow : c'est le même constat que pour ses « 104/104 » — un contrôle qu'on ne fait tourner
 * que soi-même finit par ne décrire que sa propre machine.
 *
 * `CHROMIUM` reste honoré quand il est donné. Sinon, on ne force RIEN : Playwright résout le
 * navigateur qu'il a lui-même installé, ce qu'il sait faire mieux qu'un chemin deviné. */
const CHROME = process.env.CHROMIUM
  ?? (existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
      ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
      : undefined);

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
  /* HORS CI, une absence de Playwright est un simple « non joué » : le harnais est fait pour
     tourner sur une machine de travail qui ne l'a pas forcément.
     EN CI, c'est un ÉCHEC. Ce contrôle a longtemps annoncé « 104/104 » sans qu'aucun workflow ne
     le lance ; le jour où on le câble, un runner sans Playwright rendrait 0 en disant « non joué »
     et la coche verte laisserait croire que le navigateur a vu la page. Un contrôle qui ne s'est
     pas exécuté ne protège rien, et doit le dire assez fort pour arrêter la chaîne. */
  const enCI = process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
  console.log(`[aperçu] ${enCI ? "ÉCHEC" : "NON JOUÉ"} — playwright introuvable.`);
  console.log("  npm i playwright ailleurs, puis : PLAYWRIGHT=/chemin/playwright node test-apercu-navigateur.mjs");
  process.exit(enCI ? 1 : 0);
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

const navigateur = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const contexte = await navigateur.newContext({ viewport: { width: 1280, height: 900 } });

/** Les erreurs JS sont collectées PAR PAGE : une page qui plante en silence rend un écran vide
 *  que tous les contrôles de texte traverseraient sans rien voir. */
const nouvellePage = async () => {
  const p = await contexte.newPage();
  p.__erreurs = [];
  p.on("pageerror", (e) => p.__erreurs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|ERR_INTERNET/.test(m.text())) p.__erreurs.push(m.text()); });
  /* LES REQUÊTES AU MOTEUR SONT COMPTÉES, PAR PAGE (08/09/2026). Le défaut de la date passée se
     caractérisait par une ABSENCE : aucun POST /v1/finder. Un harnais qui ne lit que l'écran ne
     distingue pas « rien n'est parti » de « c'est parti et le rendu a échoué ». On garde le corps
     de chaque POST : c'est aussi la seule preuve que la race tapée a bien été RÉSOLUE en `breed_id`. */
  p.__finder = [];
  p.on("request", (r) => {
    if (r.method() !== "POST" || !/\/v1\/finder(?:[?#]|$)/.test(r.url())) return;
    let corps = null;
    try { corps = JSON.parse(r.postData() ?? "null"); } catch { /* corps illisible : on le note tel quel */ }
    p.__finder.push(corps);
  });
  return p;
};

/** Une recherche complète : lien profond, poids, race éventuelle, placement, date, soumission,
 *  attente du résultat.
 *
 *  `date` (ISO `AAAA-MM-JJ`, 08/09/2026) : posée dans `#f-date` AVANT la soumission, par `fill`,
 *  c'est-à-dire comme un visiteur qui tape. Le rendu peut ne JAMAIS apparaître — c'est précisément
 *  le défaut que la date passée a révélé —, alors `chercher` ne lève plus : il rend `visible=false`,
 *  et laisse le contrôle appelant nommer ce qu'il attendait. `attente` borne cette patience. */
async function chercher({ from, dest, kg, race = null, placement = null, locale = "", date = null, attente = 30000 }) {
  const p = await nouvellePage();
  await p.goto(`${BASE}${locale}/?from=${from}&dest=${dest}`, { waitUntil: "networkidle" });
  if (race) { await p.fill("#f-breed", race); await p.dispatchEvent("#f-breed", "input"); await p.waitForTimeout(300); }
  /* LE POIDS EST POSÉ APRÈS LA RACE, ET RELU. Choisir une race REMPLIT le poids automatiquement
     (poids type de la race) : ma première rédaction écrivait « 7 » puis laissait le gabarit
     préfixer le sien, et le formulaire partait avec 87 kg pour un carlin. Les contrôles passaient
     — l'avis brachycéphale s'affichait bien — mais ils portaient sur un autre chien que celui
     annoncé. Un harnais qui dit tester un chien de 7 kg doit tester un chien de 7 kg. */
  await p.fill("#f-weight", "");
  await p.fill("#f-weight", String(kg));
  const poseE = await p.inputValue("#f-weight");
  if (poseE !== String(kg)) throw new Error(`poids non posé : voulu ${kg}, formulaire ${poseE}`);
  if (placement) await p.selectOption("#f-placement", placement);
  if (date) {
    await p.fill("#f-date", date);
    const poseD = await p.inputValue("#f-date");
    if (poseD !== date) throw new Error(`date non posée : voulue ${date}, formulaire ${poseD}`);
  }
  /* Où en est la page AVANT le clic : le défaut faisait défiler la page vers le champ sans rien
     afficher ; on relève la position pour pouvoir dire, après, si elle a bougé et vers quoi. */
  const defilAvant = await p.evaluate(() => window.scrollY);
  await p.click("#mdcf-finder button[type=submit]");
  const visible = await p.waitForSelector("#mdcf-finder-result:not([hidden])", { timeout: attente })
    .then(() => true).catch(() => false);
  await p.waitForTimeout(1200);
  const texte = visible ? ((await p.textContent("#mdcf-finder-result")) ?? "") : "";
  const defilApres = await p.evaluate(() => window.scrollY);
  /* On relit le poids APRÈS la soumission aussi : un gabarit qui le réécrirait au moment
     d'envoyer produirait le même mensonge, une étape plus loin. */
  const poidsFinal = await p.inputValue("#f-weight");
  const cartes = await p.$$eval(".acard, [class*=acard]", (n) => n.length).catch(() => 0);
  const verdict = await p.$eval(".report__answer", (n) => n.textContent.trim()).catch(() => "");
  return { p, texte, cartes, poidsFinal, visible, verdict, requetes: p.__finder, defilAvant, defilApres };
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
  /* L'incertitude doit être DITE, pas seulement absente de contradiction.
     RE-FONDÉ LE 10/09/2026 (annexe 38, contrat de carte arbitré par Philippe) : la phrase « confirm with
     the airline » n'est plus répétée dans chaque carte, elle est écrite UNE FOIS au-dessus des résultats
     (`.acards__notes`), et chaque ligne canal dit « to be confirmed » là où rien n'est prouvé. Le témoin
     exige les deux : l'avertissement général présent, et au moins une ligne canal qui porte le doute. */
  const notesGen = await p.$$eval(".acards__notes .acards__note", (n) => n.map((x) => x.textContent ?? "").join(" | ")).catch(() => "");
  check(`chien ${nom} : l'incertitude est écrite en toutes lettres`,
    /confirm (?:directly )?with the airline|to be confirmed/i.test(notesGen) || /to be confirmed/i.test(texte),
    `notes : ${notesGen.slice(0, 120)} · résultat : ${texte.slice(0, 120)}`);
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
  const { p, texte, cartes, poidsFinal } = await chercher({ from: "airport_cdg", dest: "airport_jfk", kg: 7, race: "Pug" });
  check("le formulaire porte bien le chien annoncé : un carlin de 7 kg", poidsFinal === "7", `poids envoyé : ${poidsFinal} kg`);
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

/* ---- 9. LE SCORE DE COMPATIBILITÉ, CONSTATÉ — un effet de la frontière, pas de la route ------ */
console.log("\n=== Le score affiché en tête de rapport ===");
{
  const { p, texte } = await chercher({ from: "airport_cdg", dest: "airport_jfk", kg: 4 });
  const m = texte.match(/(\d{1,3})\s*%/);
  const score = m ? Number(m[1]) : null;
  /* MESURÉ HORS NAVIGATEUR le 04/09/2026, sur la MÊME route et les MÊMES 22 cartes :
   *   données réelles  → score 10, 0 compagnie acceptante
   *   données citées   → score 76, 20 compagnies acceptantes
   * L'effondrement ne venait donc pas du trajet : il venait de ce qu'aucune politique n'est
   * prouvée. Le rapport affichait « Yes — with conditions » à côté de « 9 % », et les deux se
   * contredisaient à l'œil : le titre promettait, le chiffre décourageait.
   *
   * L'ARBITRAGE EST RENDU (05/09/2026), ET CE TÉMOIN CHANGE DE SENS. Il figeait le chiffre pour
   * qu'il ne passe pas inaperçu, en attendant la décision. La décision est prise : la jauge ne
   * s'affiche plus du tout, parce qu'un pourcentage précis posé sur des données non prouvées est
   * la réponse catégorique trompeuse que le critère de lancement interdit. Le contrôle exige
   * donc maintenant l'ABSENCE — propriété strictement plus forte que « ≤ 15 », et vérifiée là où
   * ça compte : dans le DOM réel, pas dans le contrat.
   *
   * Il reste NON VIDE : la réponse de tête, elle, doit être présente et dire « pas encore
   * établi ». Sans cette moitié, une page blanche satisferait le contrôle. */
  check("AUCUN pourcentage n'est affiché en tête de rapport — la jauge est masquée",
    score === null, `score affiché : ${score}%`);
  const reponse = await p.$eval(".report__answer", (n) => n.textContent.trim()).catch(() => "");
  /* MOUVEMENT NOMMÉ (08/09/2026, import strict V3) : sur ce trajet, des canaux sont désormais
     prouvés SOUS CONDITIONS, et la réponse de tête dit « Oui — sous conditions » au lieu de « pas
     encore établi ». Ce que le contrôle défend est intact : une réponse de tête présente, jamais
     un oui sec, jamais un pourcentage. La note « pourquoi » n'existe que sur un verdict inconnu. */
  check("…et la réponse de tête est bien rendue : « pas encore établi » ou « sous conditions », jamais un oui sec",
    /pas encore|not established|aún no|ainda não|conditions|condições|condiciones/i.test(reponse) && !/^(yes|oui|sí|sim)\s*$/i.test(reponse), JSON.stringify(reponse));
  const note = await p.$eval(".report__unknown", (n) => n.textContent.trim()).catch(() => "");
  check("…et si une note « pourquoi » est rendue, elle ne se lit pas comme un refus",
    note === "" || (note.length > 40 && !/refus|refused|rechaz|recus/i.test(note)), JSON.stringify(note.slice(0, 90)));
  await p.close();
}

/* ---- 10. La préversion reste fermée aux moteurs ------------------------------------------------ */
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

/* ---- 10 ter. FICHE COMPAGNIE : LE BANDEAU SOUS LE TITRE, LES PASTILLES SANS CHEVAUCHEMENT ---------------
   Arbitrage Codex (10/09/2026), sur la capture d'Aeromexico en ligne : le bandeau « … sur au moins un canal cité »
   passait SUR le H1, les capsules des canaux débordaient. On mesure des RECTANGLES rendus, trois largeurs (bureau,
   tablette, mobile), quatre langues — l'espagnol et le portugais donnent les libellés les plus longs. */
console.log("\n=== Fiche compagnie : bandeau sur sa ligne, pastilles courtes, aucun chevauchement — 3 largeurs × 4 langues ===");
{
  const ATTENDU = {
    "": { verdict: "Transport possible under conditions", pastilles: ["Under conditions", "Refused", "To confirm", "Accepted"] },
    "/fr": { verdict: "Transport possible sous conditions", pastilles: ["Sous conditions", "Refusé", "À confirmer", "Accepté"] },
    "/es": { verdict: "Transporte posible bajo condiciones", pastilles: ["Bajo condiciones", "Rechazado", "A confirmar", "Aceptado"] },
    "/pt": { verdict: "Transporte possível sob condições", pastilles: ["Sob condições", "Recusado", "A confirmar", "Aceito"] },
  };
  const mesurer = (p) => p.evaluate(() => {
    const R = (el) => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right) }; };
    const h1 = document.querySelector(".afp h1"), v = document.querySelector(".afp .hero-verdict .pill.big");
    const minis = [...document.querySelectorAll(".afp .mini")].map((mi) => {
      const nm = mi.querySelector(".t .nm"), pill = mi.querySelector(".t .pill");
      return { mini: R(mi), nm: nm && R(nm), pill: pill && R(pill), texte: pill?.textContent.trim(), pos: pill && getComputedStyle(pill).position };
    });
    return { h1: h1 && R(h1), v: v && R(v), vTexte: v?.textContent.replace(/^★\s*/, "").trim(), vPos: v && getComputedStyle(v).position,
      minis, scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth };
  });
  const chev = (a, b) => !!a && !!b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  for (const [loc, att] of Object.entries(ATTENDU)) {
    const nom = loc || "/en";
    const p = await nouvellePage();
    const r = await p.goto(`${BASE}${loc}/airlines/aeromexico/`, { waitUntil: "domcontentloaded" });
    check(`fiche Aeromexico ${nom} : s'ouvre`, r?.status() === 200, `HTTP ${r?.status()}`);
    for (const w of [1280, 800, 400]) {
      await p.setViewportSize({ width: w, height: 900 });
      await p.waitForTimeout(150);
      const m = await mesurer(p);
      check(`${nom} @${w} : le bandeau dit « ${att.verdict} », sur sa ligne SOUS le titre, sans le chevaucher`,
        m.vTexte === att.verdict && !!m.h1 && !!m.v && m.v.top >= m.h1.bottom - 1 && !chev(m.h1, m.v), JSON.stringify({ v: m.vTexte, h1: m.h1, pill: m.v }));
      check(`${nom} @${w} : aucune pastille en position absolue`, m.vPos !== "absolute" && m.minis.every((x) => x.pos !== "absolute"));
      check(`${nom} @${w} : la page ne défile pas horizontalement`, m.scrollW <= m.innerW + 1, `${m.scrollW} > ${m.innerW}`);
      check(`${nom} @${w} : trois pastilles de canal, chacune un état court, dans sa carte, sans chevaucher « Cabine / Soute / Fret »`,
        m.minis.length === 3 && m.minis.every((x) => x.pill && att.pastilles.includes(x.texte) && x.pill.right <= x.mini.right + 1 && x.pill.left >= x.mini.left - 1 && x.nm && !chev(x.nm, x.pill)),
        JSON.stringify(m.minis.map((x) => ({ t: x.texte, nm: x.nm, pill: x.pill, mini: x.mini }))));
      check(`${nom} @${w} : la fiche ne dit plus « sur au moins un canal cité »`, !/at least one cited channel|au moins un canal cité|al menos un canal citado|pelo menos um canal citado/.test(await p.textContent("body")));
    }
    await capturer(p, `12-fiche-aeromexico${loc.replace("/", "-") || "-en"}-400px`);
    await p.close();
  }
  /* Un REFUS documenté sur la pastille, dans la langue la plus longue et la plus étroite des largeurs : British Airways cabine, pt, 400 px. */
  {
    const p = await nouvellePage();
    await p.setViewportSize({ width: 400, height: 900 });
    const r = await p.goto(`${BASE}/pt/airlines/british-airways/`, { waitUntil: "domcontentloaded" });
    const m = r?.status() === 200 ? await mesurer(p) : null;
    const cab = m?.minis.find((x) => true);
    check("British Airways pt @400 : la pastille cabine dit « Recusado », dans sa carte, sans chevauchement",
      !!m && m.minis.length === 3 && m.minis[0].texte === "Recusado" && m.minis[0].pill.right <= m.minis[0].mini.right + 1 && !chev(m.minis[0].nm, m.minis[0].pill), JSON.stringify(cab));
    await capturer(p, "12-fiche-british-airways-pt-400px");
    await p.close();
  }
}

/* ---- 11. LES DEUX AUTRES ARBITRAGES, DANS LE DOM RÉEL --------------------------------------- */
console.log("\n=== Fiche de race : plus aucune affirmation sans preuve ===");
{
  /* Ce que la page annonçait le 05/09/2026 au matin, sur 172 races et quatre langues :
     « Accepté par la plupart (cabine) », « Très souvent possible » d'après une limite SUPPOSÉE de
     8 kg, « Souvent refusé » en soute sur « 0 acceptent, 0 non », et « Voyageur très difficile ·
     1,5/5 · 18/100 ». Quatre réponses catégoriques produites par un vide. On les cherche ici dans
     le HTML SERVI — pas dans la fonction qui les calcule, où je les avais déjà crues absentes. */
  const p = await nouvellePage();
  await p.goto(`${BASE}/fr/breeds/pug/`, { waitUntil: "domcontentloaded" });
  const texte = (await p.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
  check("la fiche du carlin s'ouvre et porte du contenu", texte.length > 800, `${texte.length} caractères`);
  for (const interdit of ["Accepté par la plupart", "Souvent refusé", "Très souvent possible"]) {
    check(`aucune affirmation « ${interdit} » — elle ne reposait sur rien`, !texte.includes(interdit));
  }
  check("aucune note chiffrée /100 — elle mesurait un dossier vide",
    !/\/100/.test(texte), (texte.match(/[^ ]{0,12}\/100/) || [])[0] || "");
  /* MOUVEMENT NOMMÉ (08/09/2026, import strict V3) : neuf limites cabine sont CITÉES, les canaux
     ne disent plus « pas encore établi » mais « sous conditions » — et jamais « accepté ». */
  check("les canaux disent « sous conditions », jamais « accepté par la plupart » ni « très souvent possible »",
    /sous conditions/i.test(texte) && !/Accept[ée] par la plupart|Très souvent possible|Largement accepté/i.test(texte));
  /* ── LA PRÉCAUTION SURVIT, MAIS ON N'EN VÉRIFIE PLUS LE MOT : ON EN VÉRIFIE LA PHRASE ───────
   *
   * Ce témoin exigeait l'expression « museau court » quelque part sur la fiche. Il avait une
   * raison d'être — j'avais un jour supprimé la mention en même temps qu'un faux chiffre, et la
   * fiche d'un brachycéphale avait cessé de dire ce qu'il est. Mais chercher un MOT laisse passer
   * n'importe quelle phrase qui le contient : celle qui portait « museau court » affirmait, sans
   * citation, des embargos chaleur et des restrictions respiratoires. Elle est supprimée le
   * 07/09/2026, et avec elle l'expression.
   *
   * Le témoin ne demande donc plus qu'un mot soit là, il demande que LA phrase prudente soit là —
   * celle du dépôt, `race.brachy_prudence`, relue dans la table de traduction plutôt que recopiée
   * ici. Et il exige en plus qu'aucune affirmation catégorique ne l'accompagne. */
  {
    const fsn = await import("node:fs");
    const strFr = JSON.parse(fsn.readFileSync("packages/knowledge/translations/fr/strings.json", "utf8"));
    const prudence = strFr["race.brachy_prudence"];
    check("…et la précaution brachycéphale SURVIT — la phrase prudente canonique est publiée",
      Boolean(prudence) && texte.includes(prudence.replace(/\s+/g, " ")),
      `attendu : « ${(prudence ?? "").slice(0, 50)}… »`);
    const AFFIRMATIONS = /embargos? chaleur|restrictions? respiratoires?|risque respiratoire|refusé par de nombreuses/i;
    check("…et aucune affirmation catégorique sur la catégorie ne l'accompagne",
      !AFFIRMATIONS.test(texte), (texte.match(/[^.]{0,60}(embargos? chaleur|restrictions? respiratoires?|risque respiratoire)[^.]{0,40}/i) || [])[0] || "");
  }
  /* MOUVEMENT NOMMÉ (08/09/2026) : la section n'est plus vide — elle liste des compagnies citées,
     chacune « sous conditions », sans coche pleine ni « Accepté ». */
  const lignesCompagnies = await p.$$eval(".bt2-air", (ns) => ns.map((n) => n.textContent.replace(/\s+/g, " ").trim()));
  check("la section « Compagnies à vérifier » liste des compagnies citées, chacune « sous conditions », jamais « Accepté »",
    lignesCompagnies.length > 0 && lignesCompagnies.every((l) => /sous conditions|confirmer/i.test(l) && !/✅|Accepté en/i.test(l)),
    lignesCompagnies.slice(0, 3).join(" | "));
  /* TÉMOIN : un golden n'est pas brachycéphale — la précaution ne doit pas se propager. */
  const p2 = await nouvellePage();
  await p2.goto(`${BASE}/fr/breeds/golden-retriever/`, { waitUntil: "domcontentloaded" });
  const t2 = (await p2.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
  check("TÉMOIN : la fiche d'un golden ne parle pas de museau court", !/museau court/i.test(t2));
  await p.close(); await p2.close();
}

console.log("\n=== Carte compagnie : aucune affirmation structurelle sur l'ignorance ===");
{
  /* LE CAS EXACT DE LA CONTRE-REVUE (P0-2, 05/09/2026) : CDG → LHR avec un American Bully XL.
   * L'interdiction d'entrée britannique éteignait les trois canaux, et les DIX compagnies —
   * toutes `offers_pet_transport: "unknown"` — annonçaient « No pets ». Une interdiction du PAYS
   * devenait une affirmation structurelle fausse sur chaque compagnie, qui aurait suivi le
   * visiteur sur tous ses autres trajets. On le vérifie ici dans le DOM SERVI.
   *
   * MESURE DU JOUR, ET ELLE COMPTE : depuis que la frontière atteint aussi l'entrée dans le pays,
   * la branche « aucun canal ouvert ni à confirmer » est devenue INATTEIGNABLE sur les données
   * réelles — il faudrait trois refus prouvés, or le dépôt n'en porte qu'un (British Airways
   * cabine). Le contrôle ne prétend donc pas l'exercer : il MESURE qu'elle est vide, et l'imprime.
   * Le jour où une citation la rendra atteignable, le compte changera et se verra. */
  const { p, texte } = await chercher({ from: "airport_cdg", dest: "airport_lhr", kg: 50, race: "American Bully (XL)" });
  const cartes = await p.$$(".acard");
  check("des cartes compagnie sont rendues (témoin non vide)", cartes.length > 0, String(cartes.length));
  const badges = await p.$$eval(".acard__status", (n) => n.map((x) => x.textContent.trim()));
  check("des étiquettes de statut sont rendues (témoin non vide)", badges.length > 0, `${badges.length}`);
  const structurelles = await p.$$(".acard__status--petsunknown, .acard__status--nopets, .acard__status--nomatch");
  console.log(`  ·    cartes structurelles atteintes : ${structurelles.length} — la branche est vide sur données réelles, c'est le constat du jour`);
  /* LA PROPRIÉTÉ, elle, se vérifie sur TOUT le rapport et non sur cette seule branche : aucune
     affirmation structurelle ne doit apparaître nulle part, ni en badge ni en libellé de carte. */
  const interdits = [/Animaux refusés/i, /No pets/i, /Sin mascotas/i, /Não aceita animais/i,
    /Non compatible/i, /Not compatible\b(?! with this dog or this route)/i];
  const fuites = interdits.filter((re) => re.test(texte));
  check("AUCUNE affirmation « animaux refusés » ni « non compatible » dans tout le rapport",
    fuites.length === 0, JSON.stringify(fuites.map(String)));
  /* Et le motif ne revient pas par la bande : les cartes disaient « cabine non proposée, soute non
     proposée », des motifs tirés de règles auxquelles la frontière avait retiré le droit de
     décider. Le refus venait du PAYS ; la carte l'imputait à la compagnie. */
  for (const motif of [/cabin not offered/i, /hold not offered/i, /breed not accepted/i,
                       /cabine non proposée/i, /race non acceptée/i]) {
    check(`aucun motif « ${String(motif).slice(1, 26)}… » imputé aux compagnies`, !motif.test(texte));
  }
  /* CE CONTRÔLE DISAIT L'INVERSE, ET IL GRAVAIT LE DÉFAUT (contre-revue du 05/09/2026). Il
     EXIGEAIT que le texte officiel soit « publié entier ». Or ce texte est `rationale` — NOTRE
     résumé éditorial — et il était présenté sous l'autorité de la page officielle, alors que la
     règle britannique n'a aucune `source.quote`. Ce qui doit rester, c'est le LIEN. */
  check("NOTRE résumé éditorial n'est PAS publié sous l'autorité de la page officielle",
    !/Dangerous Dogs Act/i.test(texte) && !/Certificate of Exemption/i.test(texte));
  const liens = await p.$$eval("#mdcf-finder-result a[href^='http']", (n) => n.map((a) => a.getAttribute("href")));
  check("…mais le LIEN officiel, lui, est bien servi — le visiteur va lire le vrai texte",
    liens.some((h) => /^https:\/\/www\.gov\.uk\//.test(h)), JSON.stringify(liens.slice(0, 4)));

  /* ── LE STATUT D'ENTRÉE TERNAIRE, DANS LE DOM (contre-revue du 05/09/2026) ──────────────────
   *
   * Le même rapport affirmait « Le Royaume-Uni autorise l'entrée » à côté de « Interdit par
   * l'article 1 du Dangerous Dogs Act ». `entry_allowed` était booléen : il valait `true` dès
   * qu'aucune interdiction n'était PROUVÉE, et l'écran en tirait une phrase positive. Nous ne
   * connaissons pas les autorisations, seulement les blocages — et leur absence dans nos données. */
  check("AUCUNE phrase n'affirme que le pays autorise l'entrée",
    !/allows entry|autorise l'entrée|permite la entrada|autoriza a entrada/i.test(texte));
  check("…le rapport dit à la place que l'entrée est à confirmer pour ce chien",
    /may restrict this dog on entry|Entrée à confirmer pour ce chien/i.test(texte));
  check("…et l'exigence est présentée comme une restriction POTENTIELLE, pas comme un fait acquis",
    /An entry restriction may apply to this dog/i.test(texte), texte.slice(0, 120));
  /* Et elle n'affirme rien sur NOTRE processus de vérification. */
  check("…sans prétendre que nous n'avons pas vérifié la page nous-mêmes",
    !/we have not been able to verify/i.test(texte));
  await p.close();
}

console.log("\n=== Une interdiction PROUVÉE, elle, tranche encore ===");
{
  /* SANS CE PARAGRAPHE, TOUT CE QUI PRÉCÈDE NE PROUVERAIT QUE L'INACTION. La Nouvelle-Zélande est
   * la première RÈGLE citée du dépôt — phrase, langue et emplacement relevés sur la norme
   * d'importation 2026 du MPI. Son interdiction doit donc, elle, produire un refus franc : le
   * statut ternaire n'est pas un binaire déguisé qui aurait simplement tout rendu prudent. */
  const { p, texte } = await chercher({ from: "airport_cdg", dest: "airport_akl", kg: 60, race: "Tosa Inu" });
  check("Auckland, Tosa Inu : le rapport se rend et porte du contenu", texte.length > 400, `${texte.length}`);
  /* Le libellé anglais exact est « Not as requested » (answer.incompatible) — relevé dans le
     fichier de traduction, pas deviné : c'est en devinant « American Bully XL » au lieu de
     « American Bully (XL) » que j'ai fabriqué un faux vert hier. */
  check("…et l'entrée est refusée FRANCHEMENT, pas « à confirmer »",
    /Not as requested/i.test(texte) && !/may restrict this dog on entry/i.test(texte),
    texte.slice(0, 120));
  check("…sur la phrase citée de la norme d'importation néo-zélandaise",
    /Dog Control Act 1996/i.test(texte), texte.slice(0, 120));
  await p.close();
}

/* ---- CINQ RECHERCHES EN FRANÇAIS, PLUS UNE DATE PASSÉE (non-régression, 08/09/2026) ----------
 *
 * POURQUOI. Un testeur a joué, sur /fr/, « Carlin, 8 kg, CDG → ATH, 15 juillet » — le 8 septembre,
 * donc une date PASSÉE. Il n'a rien obtenu : ni carte, ni message, et la page a défilé vers le
 * champ. La cause, mesurée : `#f-date` portait `min`/`max`, et la validation NATIVE du navigateur
 * arrêtait `submit` avant notre gestionnaire ; le message explicite n'était jamais écrit dans
 * `#mdcf-finder-result`. Le harnais jsdom ne pouvait pas le voir — il émet `submit` lui-même.
 *
 * CE QUE CE BLOC EXIGE, sur le VRAI Chromium et le VRAI rendu :
 *   · cinq recherches ordinaires rendent un verdict VISIBLE (`.report__answer` non vide) et une
 *     réponse utile (au moins une carte, ou un message explicite) ;
 *   · la date passée rend le message explicite de date hors contrat, avec les bornes du jour,
 *     SANS aucune requête au moteur, et sans laisser la page défiler vers un écran muet.
 *
 * LES DATES SONT CALCULÉES, JAMAIS ÉCRITES EN DUR : « le prochain 15 juillet » vaut 2027-07-15
 * aujourd'hui et vaudra autre chose dans un an — un harnais qui figerait 2027 passerait au rouge
 * (ou au vert, à tort) à date fixe. « Le dernier 15 juillet passé » est calculé de même.
 *
 * LES NOMS DE RACE SONT CEUX DU CHAMP FRANÇAIS, et l'un d'eux NE RÉSOUT PAS tel que le testeur
 * l'écrit : « Cavalier King Charles » n'est pas dans la liste, qui porte « Cavalier King Charles
 * Spaniel » (`name_i18n.fr` de `breed_cavalier_king_charles`). `resolveBreed` compare le texte
 * ENTIER, normalisé : un préfixe ne résout rien, et la requête partirait sans `breed_id`, avec le
 * poids tapé pour seule description du chien. On emploie donc le libellé exact, on VÉRIFIE dans le
 * corps du POST que chaque race est bien devenue un `breed_id`, et on MESURE le préfixe : le jour
 * où le gabarit acceptera « Cavalier King Charles » seul, ce constat changera et se verra. */
console.log("\n=== Six recherches en français : verdict visible, réponse utile, date hors contrat ===");
{
  /* Prochain 15 juillet (inclus : un 15 juillet, c'est encore aujourd'hui, donc dans le contrat)
     et dernier 15 juillet passé — tous deux en UTC, comme les bornes du champ. */
  const iso = (d) => d.toISOString().slice(0, 10);
  const maintenant = new Date();
  const annee = maintenant.getUTCFullYear();
  const juillet = (a) => new Date(Date.UTC(a, 6, 15));
  const auj = iso(new Date(Date.UTC(annee, maintenant.getUTCMonth(), maintenant.getUTCDate())));
  const prochain15Juillet = iso(juillet(annee)) >= auj ? iso(juillet(annee)) : iso(juillet(annee + 1));
  const dernier15JuilletPasse = iso(juillet(annee)) < auj ? iso(juillet(annee)) : iso(juillet(annee - 1));
  console.log(`  ·    aujourd'hui ${auj} — prochain 15 juillet : ${prochain15Juillet} ; dernier 15 juillet passé : ${dernier15JuilletPasse}`);
  check("témoin : le prochain 15 juillet est dans le contrat (≤ 18 mois) et le dernier est bien passé",
    prochain15Juillet >= auj && prochain15Juillet <= iso(new Date(Date.UTC(annee, maintenant.getUTCMonth() + 18, maintenant.getUTCDate())))
    && dernier15JuilletPasse < auj);

  /* Les libellés, tels que la liste `#mdcf-breeds` les porte en français — relus dans la page
     plutôt que crus. */
  const p0 = await nouvellePage();
  await p0.goto(`${BASE}/fr/`, { waitUntil: "domcontentloaded" });
  const liste = await p0.$$eval("#mdcf-breeds option", (n) => n.map((o) => o.value));
  await p0.close();
  for (const nom of ["Carlin", "Golden Retriever", "Cavalier King Charles Spaniel"]) {
    check(`la liste française des races porte « ${nom} »`, liste.includes(nom));
  }
  console.log(`  ·    « Cavalier King Charles » seul ${liste.includes("Cavalier King Charles") ? "EST" : "n'est PAS"} dans la liste — le libellé complet est employé ci-dessous`);

  const scenarios = [
    { nom: "Cavalier King Charles Spaniel 6 kg, CDG → ATH, cabine", race: "Cavalier King Charles Spaniel", id: "breed_cavalier_king_charles", kg: 6, dest: "airport_ath", placement: "cabin" },
    { nom: "Golden Retriever 32 kg, CDG → ATH", race: "Golden Retriever", id: "breed_golden_retriever", kg: 32, dest: "airport_ath" },
    { nom: "Golden Retriever 30 kg, CDG → JFK", race: "Golden Retriever", id: "breed_golden_retriever", kg: 30, dest: "airport_jfk" },
    { nom: "Golden Retriever 32 kg, CDG → LHR", race: "Golden Retriever", id: "breed_golden_retriever", kg: 32, dest: "airport_lhr" },
    { nom: `Carlin 8 kg, CDG → ATH, soute, le ${prochain15Juillet}`, race: "Carlin", id: "breed_pug", kg: 8, dest: "airport_ath", placement: "hold", date: prochain15Juillet },
  ];
  for (const s of scenarios) {
    const r = await chercher({ from: "airport_cdg", dest: s.dest, kg: s.kg, race: s.race, placement: s.placement ?? null, date: s.date ?? null, locale: "/fr" });
    check(`${s.nom} : la zone de résultat s'affiche`, r.visible);
    check(`${s.nom} : aucune erreur JavaScript`, r.p.__erreurs.length === 0, r.p.__erreurs.slice(0, 2).join(" | "));
    check(`${s.nom} : une requête au moteur est partie, avec la race RÉSOLUE et le poids annoncé`,
      r.requetes.length === 1 && r.requetes[0]?.dog?.breed_id === s.id && r.requetes[0]?.dog?.weight_kg === s.kg,
      JSON.stringify({ requetes: r.requetes.length, dog: r.requetes[0]?.dog, placement: r.requetes[0]?.placement, date: r.requetes[0]?.date }));
    if (s.placement) check(`${s.nom} : le placement demandé est transmis`, r.requetes[0]?.placement === s.placement, JSON.stringify(r.requetes[0]?.placement));
    if (s.date) check(`${s.nom} : la date est transmise SANS MODIFICATION`, r.requetes[0]?.date === s.date, JSON.stringify(r.requetes[0]?.date));
    check(`${s.nom} : un verdict est VISIBLE en tête de rapport`, r.verdict.length > 0, JSON.stringify(r.verdict));
    check(`${s.nom} : une réponse utile — ${r.cartes} carte(s) compagnie, ou un message explicite`,
      r.cartes > 0 || /\S{20,}/.test(r.texte.replace(/\s+/g, " ")), `${r.cartes} carte(s), ${r.texte.trim().length} caractères`);
    console.log(`  ·    verdict : « ${r.verdict.slice(0, 70)} » — ${r.cartes} carte(s)`);
    /* LE BANDEAU FORMALITÉS SUR UN TRAJET INTRA-UE (point 4 de Codex, 08/09/2026). Paris → Athènes
       est de niveau « info » (Grèce : régime `eu`, pas de sortie). Avant : « prévois un certificat
       vétérinaire dans chaque sens », sans source, et faux — le moteur liste passeport, puce, rage.
       Attendu : un bandeau `info` qui ne nomme aucun document et renvoie aux étapes ci-dessous,
       et des étapes rendues qui portent bien passeport, identification et rage. */
    if (s.dest === "airport_ath") {
      const bandeau = await r.p.$eval(".rtflag", (n) => ({ classe: n.className, corps: n.querySelector(".rtflag__b")?.textContent ?? "" })).catch(() => null);
      check(`${s.nom} : le bandeau formalités est de niveau « info » et ne nomme aucun document`,
        !!bandeau && /rtflag--info/.test(bandeau.classe) && !/certif|passeport|vaccin/i.test(bandeau.corps), JSON.stringify(bandeau));
      check(`${s.nom} : …et renvoie aux étapes listées ci-dessous`, !!bandeau && /ci-dessous/.test(bandeau.corps), JSON.stringify(bandeau?.corps));
      const etapes = r.texte.replace(/\s+/g, " ");
      check(`${s.nom} : les étapes rendues portent passeport, identification (puce) et rage — pas « certificat vétérinaire dans chaque sens »`,
        /passeport/i.test(etapes) && /puce|transpondeur|identif/i.test(etapes) && /rage|antirabique/i.test(etapes) && !/certificat vétérinaire dans chaque sens/i.test(etapes),
        etapes.slice(0, 300));
    }
    /* LE CONTRAT D'AFFICHAGE, SUR LE VRAI RENDU : le résumé par canal existe, le compteur
       « options confirmées · pistes » n'existe plus, et aucune carte « ? » sur ses trois canaux
       n'est à plat hors du <details> des pistes. */
    const contrat = await r.p.evaluate(() => {
      const acap = !!document.querySelector(".acap");
      const asum = [...document.querySelectorAll(".asum__ch")].map((n) => n.textContent.replace(/\s+/g, " ").trim());
      const aPlat = [...document.querySelectorAll("ul.acards")].filter((ul) => !ul.closest("details")).flatMap((ul) => [...ul.querySelectorAll(".acard")]);
      const pistesAPlat = aPlat.filter((c) => [...c.querySelectorAll(".ab")].every((b) => /\?\s*$/.test(b.textContent))).length;
      const det = document.querySelector("details.acards__leads");
      return { acap, asum, aPlat: aPlat.length, pistesAPlat, details: det ? { ouvert: det.hasAttribute("open"), cartes: det.querySelectorAll(".acard").length, resume: det.querySelector("summary")?.textContent.trim() } : null };
    });
    check(`${s.nom} : le compteur « options confirmées · pistes » a disparu, le résumé par canal est là (3 canaux)`,
      !contrat.acap && contrat.asum.length === 3, JSON.stringify(contrat.asum));
    check(`${s.nom} : aucune carte « ? » sur ses trois canaux n'est à plat — elles sont dans le <details> fermé`,
      contrat.pistesAPlat === 0 && (contrat.details === null || !contrat.details.ouvert), JSON.stringify(contrat));
    console.log(`  ·    résumé : ${contrat.asum.join(" | ")} — ${contrat.aPlat} carte(s) à plat, ${contrat.details?.cartes ?? 0} repliée(s)`);
    await capturer(r.p, `6-fr-${s.race.toLowerCase().replace(/[^a-z]+/g, "-")}-${s.kg}kg-${s.dest.replace("airport_", "")}${s.placement ? "-" + s.placement : ""}`);
    await r.p.close();
  }

  /* LE SIXIÈME : la date passée, celle du testeur. Attente courte : ce qu'on attend n'est pas un
     rapport (rien ne doit partir), c'est un message, qui s'écrit sans réseau. */
  {
    const r = await chercher({ from: "airport_cdg", dest: "airport_ath", kg: 8, race: "Carlin", placement: "hold",
      date: dernier15JuilletPasse, locale: "/fr", attente: 8000 });
    check(`Carlin 8 kg, CDG → ATH, le ${dernier15JuilletPasse} (passé) : la zone de résultat s'affiche — jamais un retour silencieux`, r.visible);
    check("…AUCUNE requête n'est partie vers le moteur", r.requetes.length === 0, `${r.requetes.length} POST /v1/finder`);
    /* Le message exact, EN FRANÇAIS, avec les bornes du jour recalculées ici (ISO, UTC) — jamais
       recopiées depuis le gabarit, ni acceptées telles qu'affichées. */
    const bornes = (() => {
      const y = maintenant.getUTCFullYear(), m = maintenant.getUTCMonth(), d = maintenant.getUTCDate();
      const dernierJour = new Date(Date.UTC(y, m + 19, 0)).getUTCDate();
      return { min: iso(new Date(Date.UTC(y, m, d))), max: iso(new Date(Date.UTC(y, m + 18, Math.min(d, dernierJour)))) };
    })();
    const attendu = `Choisis une date comprise entre aujourd'hui (${bornes.min}) et 18 mois (${bornes.max}).`;
    check("…le message explicite de date hors contrat est affiché, et il NOMME la plage acceptée",
      r.texte.replace(/\s+/g, " ").trim() === attendu, JSON.stringify(r.texte.trim().slice(0, 140)));
    check("…aucune carte ni verdict n'est rendu sur une date que le moteur refuserait",
      r.cartes === 0 && r.verdict === "", `${r.cartes} carte(s), verdict « ${r.verdict} »`);
    /* La page ne fuit pas vers un écran muet : le message est DANS la fenêtre après le clic. */
    const boite = await r.p.$eval("#mdcf-finder-result", (n) => { const b = n.getBoundingClientRect(); return { haut: b.top, bas: b.bottom, h: window.innerHeight }; }).catch(() => null);
    check("…et le message est dans la fenêtre — la page n'a pas défilé vers un écran sans verdict",
      !!boite && boite.haut >= 0 && boite.haut < boite.h, JSON.stringify({ boite, defilement: [r.defilAvant, r.defilApres] }));
    console.log(`  ·    défilement avant/après le clic : ${r.defilAvant} → ${r.defilApres}`);
    check("…et le champ de date est marqué invalide pour les lecteurs d'écran",
      (await r.p.getAttribute("#f-date", "aria-invalid")) === "true");
    check("…sans erreur JavaScript", r.p.__erreurs.length === 0, r.p.__erreurs.slice(0, 2).join(" | "));
    await capturer(r.p, "6-fr-carlin-date-passee");
    await r.p.close();
  }
}

console.log("\n=== Outil Destinations : les trois états d'entrée, dans le VRAI rendu ===");
{
  /* DEUX FAUTES CORRIGÉES ICI, toutes deux relevées en contre-revue le 05/09/2026.
   *
   * 1. PREUVE CIRCULAIRE. Ma première rédaction affirmait « on rejoue la fonction de porte telle
   *    qu'elle est écrite dans la page » : elle en RECOPIAIT une seconde version dans le test.
   *    La porte vit maintenant dans `packages/ui/src/lib/entryGate.ts`, importée par la page, et
   *    ce paragraphe n'appelle plus aucune fonction — il lit le rendu.
   *
   * 2. LE SCÉNARIO NE REMPLISSAIT PAS LA RACE, POURTANT OBLIGATOIRE. Le code de production fait
   *    `const b = resolveBreed(); if (!b) { showHint(S.breedMissing); return; }` : sans race, la
   *    requête ne part pas et aucune carte n'est rendue. Mon `waitForSelector(...).catch(() => {})`
   *    masquait l'attente, et le témoin des cinq cartes aurait fini rouge. La race est désormais
   *    posée, l'appel intercepté est COMPTÉ, et son corps est vérifié avant toute assertion.
   *
   * 3. LES POSITIONS NE SUFFISENT PAS. Exiger « ABSENT ne passe pas devant LIBRE » acceptait le
   *    faux vert : avec un repli fautif vers `no_known_block`, ABSENT obtient le MÊME score que
   *    LIBRE et reste derrière par stabilité du tri. On relève donc les SCORES rendus. */
  const p = await nouvellePage();
  const villes = [
    { id: "BLOCKEDCITY", st: "blocked" },
    { id: "CONFIRMCITY", st: "confirmation_required" },
    { id: "FREECITY", st: "no_known_block" },
    { id: "ABSENTCITY", st: undefined },
    { id: "INVALIDCITY", st: "totalement_inconnu" },
  ];
  const corps = [];
  await p.route("**/v1/destinations", async (route) => {
    try { corps.push(JSON.parse(route.request().postData() ?? "{}")); } catch { corps.push(null); }
    const matches = villes.map((v, i) => ({
      airport_id: `airport_fixture_${i}`, iata: `T${i}0`, city: v.id,
      country_id: "country_fixture", iso2: "US", country_name: v.id, region: "North America",
      temperature_c: 18, climate_estimated: false,
      heat_embargo: false, heat_confirmation_required: false, confirmation_signals: [],
      estimated_heat_signal: false, heat_risk: false,
      airlines_total: 4, airlines_to_confirm_total: 0,
      cabin_ok: true, hold_ok: true, cargo_ok: true,
      cabin_status: "allowed", hold_status: "allowed", cargo_status: "allowed",
      placement_ok: true, placement_to_confirm: false,
      ...(v.st === undefined ? {} : { entry_status: v.st }),
      entry_allowed: true, flight_hours: 2,
    }));
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ matches, candidates_total: matches.length }) });
  });
  await p.goto(`${BASE}/tools/destinations/`, { waitUntil: "networkidle" });
  /* LES DEUX CHAMPS SONT DES COMBOBOX : taper ne suffit pas, il faut CHOISIR dans la liste —
     `resolveOrigin`/`resolveBreed` ne lisent que ce qui a été sélectionné. Sans cela le
     formulaire répond « Choose a city or airport from the list. » et rien ne part. */
  const choisir = async (champ, texte) => {
    await p.fill(champ, texte);
    await p.dispatchEvent(champ, "input");
    await p.waitForSelector(`${champ}-listbox .ac-item`, { timeout: 10000 });
    await p.click(`${champ}-listbox .ac-item`);
    await p.waitForTimeout(200);
  };
  await choisir("#dfx-origin", "Paris");
  /* LA RACE EST OBLIGATOIRE — libellé exact relevé dans la base, jamais deviné. */
  await choisir("#dfx-breed", "Golden Retriever");
  check("témoin : les deux champs obligatoires portent une valeur RÉSOLUE",
    (await p.inputValue("#dfx-origin")).includes("Paris") && (await p.inputValue("#dfx-breed")) === "Golden Retriever",
    JSON.stringify({ o: await p.inputValue("#dfx-origin"), r: await p.inputValue("#dfx-breed") }));
  /* Le bouton est recouvert par la liste déroulante : on soumet le formulaire lui-même. */
  await p.keyboard.press("Escape");
  await p.evaluate(() => document.getElementById("dfx-form").requestSubmit());
  await p.waitForSelector("#dfx-result .dfx-card", { timeout: 20000 }).catch(() => {});

  /* LA PREUVE QUE LA REQUÊTE EST PARTIE, AVANT TOUTE ASSERTION DE SCORE. */
  check("exactement UNE requête /v1/destinations est partie", corps.length === 1, `${corps.length}`);
  check("…et son corps porte bien la race choisie",
    corps[0]?.dog?.breed_id === "breed_golden_retriever", JSON.stringify(corps[0]?.dog));
  /* `showHint` écrit dans `#dfx-result` un `<p class="dfx__hint">` — c'est là qu'atterrirait
     « Choose your dog's breed. » si la race n'avait pas été posée. */
  const indice = await p.textContent("#dfx-result .dfx__hint").catch(() => "");
  check("…et le formulaire ne réclame pas la race (aucun indice « choisis la race »)",
    !/Choose your dog's breed|Choisis la race/i.test(indice ?? ""), JSON.stringify(indice));

  const rendu = await p.$$eval("#dfx-result .dfx-card", (n) => n.map((c) => ({
    texte: c.textContent.replace(/\s+/g, " "),
    score: Number((c.querySelector(".dfx-card__score") || {}).textContent),
  })));
  check("le VRAI rendu produit les cinq destinations de la fixture", rendu.length === 5,
    JSON.stringify(rendu.map((x) => x.texte.slice(0, 24))));
  const sc = {};
  for (const v of villes) sc[v.id] = rendu.find((x) => x.texte.includes(v.id))?.score;
  console.log(`  ·    scores rendus : ${JSON.stringify(sc)}`);
  /* LES CINQ SCORES DOIVENT ÊTRE LISIBLES AVANT TOUTE COMPARAISON. Sans cette garde, les deux
     égalités ci-dessous seraient satisfaites par `undefined === undefined` : elles étaient vertes
     sur un rendu VIDE, à côté de six contrôles rouges. Une égalité entre deux absences ne prouve
     rien — c'est la même faute que « un contrôle qui ne parle que de ce qu'il reconnaît ». */
  const lisibles = Object.values(sc).every(Number.isFinite);
  check("les cinq scores sont lisibles", lisibles, JSON.stringify(sc));
  check("LIBRE > À CONFIRMER", lisibles && sc.FREECITY > sc.CONFIRMCITY, JSON.stringify(sc));
  check("À CONFIRMER > BLOQUÉ", lisibles && sc.CONFIRMCITY > sc.BLOCKEDCITY, JSON.stringify(sc));
  check("ABSENT = À CONFIRMER exactement — le repli est prudent",
    lisibles && sc.ABSENTCITY === sc.CONFIRMCITY, JSON.stringify(sc));
  check("INVALIDE = À CONFIRMER exactement",
    lisibles && sc.INVALIDCITY === sc.CONFIRMCITY, JSON.stringify(sc));
  await p.unroute("**/v1/destinations");
  await p.close();
}

console.log("\n=== Et sur les VRAIES données : les trois états voyagent jusqu'au navigateur ===");
{
  /* La fixture ci-dessus prouve le comportement de la porte ; celle-ci prouve que le Worker sert
     bien le champ, sur la base réelle, à travers l'API que la page appelle. */
  const p = await nouvellePage();
  await p.goto(`${BASE}/tools/destinations/`, { waitUntil: "domcontentloaded" });
  const statuts = await p.evaluate(async () => {
    const r = await fetch("/v1/destinations", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ origin: "airport_cdg", dog: { breed_id: "breed_american_bully_xl", weight_kg: 50 }, locale: "en" }) });
    const j = await r.json();
    const n = {};
    for (const m of (j.matches ?? [])) n[m.entry_status ?? "ABSENT"] = (n[m.entry_status ?? "ABSENT"] ?? 0) + 1;
    return n;
  });
  check("chaque destination servie porte un statut d'entrée (aucun ABSENT)",
    !statuts.ABSENT && Object.keys(statuts).length > 0, JSON.stringify(statuts));
  check("…et les deux états attendus sont présents pour cette race",
    statuts.confirmation_required > 0 && statuts.no_known_block > 0, JSON.stringify(statuts));
  await p.close();
}

/* ---- Les quatre outils, EXERCÉS EN PORTUGAIS -------------------------------------------------
 *
 * POURQUOI CE BLOC EXISTE. Le contre-test navigateur de la préversion 82fcf408 a trouvé trois
 * phrases anglaises sur `/pt/about/` — une page STATIQUE, qu'il suffisait d'ouvrir. Les phrases
 * des outils, elles, ne paraissent qu'APRÈS une interaction : messages de validation, états
 * vides, avertissements de seuil, résultats. Ouvrir la page ne les montre pas ; 47 des 60 phrases
 * traduites dans ce lot sont dans ce cas. Un contrôle qui se contenterait de charger l'URL
 * conclurait « aucune phrase anglaise » sans avoir rien exercé — un faux témoin, comme celui du
 * §8ter du lot précédent.
 *
 * CE QUE LE CONTRÔLE FAIT. Il relève les phrases anglaises directement DANS LA SOURCE du gabarit
 * (jamais recopiées ici : une liste recopiée dérive), exerce l'outil en portugais, puis exige que
 * le texte visible n'en porte aucune. Il exige aussi qu'au moins une traduction attendue soit
 * VUE — sans quoi un outil qui ne rendrait rien du tout passerait pour irréprochable.
 *
 * CE QU'IL NE PRÉTEND PAS FAIRE. Il ne juge pas la qualité du portugais, et il ne teste que les
 * phrases d'au moins 30 caractères : « airline » ou « airlines », qui sont dans la liste, sont
 * des mots trop courts pour être cherchés dans un texte sans produire de faux positifs. Leur
 * présence dans la table est garantie ailleurs, par le balayage du harnais d'entités. */
console.log("\n=== Les quatre outils, exercés EN PORTUGAIS ===");
{
  const fsn = await import("node:fs");
  const APPEL = /\b(?:T|L|F)\(\s*(["'`])((?:\\.|(?!\1).)*)\1\s*,/gs;
  const sansCommentaires = (t) => t
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
  const phrasesDe = (gabarit) => [...new Set(
    [...sansCommentaires(fsn.readFileSync(gabarit, "utf8")).matchAll(APPEL)]
      .map((m) => m[2].replace(/\\'/g, "'").replace(/\\"/g, '"')))]
    .filter((ph) => ph.length >= 30);
  const tablePt = JSON.parse(fsn.readFileSync("packages/knowledge/translations/pt/inline.json", "utf8"));

  /** Exige : aucune phrase anglaise du gabarit dans le texte, et au moins une traduction vue. */
  const exiger = (nom, gabarit, texte) => {
    const phrases = phrasesDe(gabarit);
    const anglais = phrases.filter((ph) => texte.includes(ph));
    check(`${nom} : témoin — des phrases sont relevées dans le gabarit (${phrases.length})`,
      phrases.length >= 5);
    check(`${nom} : aucune phrase anglaise dans l'état rendu en portugais`,
      anglais.length === 0, anglais.slice(0, 2).map((x) => `« ${x.slice(0, 55)}… »`).join(" | "));
    const traduites = phrases.map((ph) => tablePt[ph]).filter((v) => v && v.length >= 30);
    const vues = traduites.filter((v) => texte.includes(v));
    check(`${nom} : au moins une traduction portugaise est RÉELLEMENT vue (${vues.length}/${traduites.length})`,
      vues.length > 0, vues.length === 0 ? `aucune des ${traduites.length} traductions du gabarit n'apparaît` : "");
  };

  /* 1. LE FINDER — une recherche complète, en portugais. */
  {
    /* LA DESTINATION EST UN AÉROPORT, PAS UN PAYS. Première rédaction fautive, nommée : j'avais
       écrit `dest: "country_us"`, que le lien profond ne résout pas — le formulaire répondait
       « Escolha uma cidade ou aeroporto de destino… » et rendait 65 caractères. J'ai cru un
       instant à un défaut du portugais ; la même sonde en anglais donnait le même message, ce
       qui a désigné ma requête, pas la page. Les trois recherches du début de ce harnais
       emploient `airport_jfk` : on emploie la même. */
    const { p, texte } = await chercher({ from: "airport_cdg", dest: "airport_jfk", kg: 30,
      race: "Golden Retriever", locale: "/pt" });
    const corps = await p.textContent("body");
    check("finder pt : aucune erreur JavaScript", p.__erreurs.length === 0, p.__erreurs.slice(0, 2).join(" | "));
    check("finder pt : le résultat n'est pas vide", texte.trim().length > 80, `${texte.trim().length} caractères`);
    /* LE CAS EXACT DU CONTRE-TEST NAVIGATEUR DU 08/09/2026, sur cette même recherche.
       1. La règle d'entrée des États-Unis n'a pas de portugais : la page servait « Dogs need a
          readable microchip… » comme texte de la page. On lit `innerText` — ce que le navigateur
          RESTITUE, un `<details>` fermé exclu — et on exige le renvoi en portugais, l'anglais
          n'apparaissant que replié et étiqueté.
       2. British Airways via LHR : la cabine est refusée sur citation (fiche : « Não aceito »,
          05/09/2026) mais la carte ne l'écrivait pas — une rature CSS et « Política a confirmar ».
          La carte doit maintenant l'écrire en toutes lettres, avec l'hôte et la date. */
    const visible = await p.innerText("body");
    check("finder pt : la règle US non traduite n'est pas servie en anglais comme texte de la page",
      !/Dogs need a readable microchip/.test(visible), "« Dogs need a readable microchip » est visible");
    check("finder pt : la règle US non traduite est renvoyée en portugais",
      /Esta regra de entrada só está documentada em inglês/.test(visible));
    check("finder pt : l'original anglais existe, replié et étiqueté",
      /Texto original \(em inglês\)/.test(visible) && /Dogs need a readable microchip/.test(corps));
    const ba = p.locator(".acard", { hasText: "British Airways" });
    const baTexte = (await ba.count()) ? await ba.first().innerText() : "";
    check("finder pt : la carte British Airways est présente", baTexte.length > 0);
    /* RE-FONDÉ LE 10/09/2026 (annexe 38). La carte ne dit plus « não aceito — recusa documentada por
       fonte oficial citada — britishairways.com · 2026-09-05 » : le contrat de Philippe veut la réponse
       d'abord (« Cabine : não »), puis UNE ligne de provenance qui nomme les canaux prouvés et leur date en
       toutes lettres (« Fonte oficial verificada em 5 de setembro de 2026: Cabine » — formule pt-BR arbitrée par Codex le 10/09), l'hôte et la
       date ISO étant repliés dans « Ver as provas ». On lit donc trois choses : le verdict sur la ligne
       cabine, la provenance qui NOMME la cabine avec sa date, et l'hôte dans le volet des preuves
       (textContent, volet fermé compris — c'est bien là qu'il doit être, pas sur l'écran). */
    const baCabine = (await ba.count()) ? await ba.first().locator(".acard__line--cabin").innerText().catch(() => "") : "";
    const baProv = (await ba.count()) ? await ba.first().locator(".acard__prov-text").innerText().catch(() => "") : "";
    const baPreuves = (await ba.count()) ? await ba.first().locator(".acard__proofs").textContent().catch(() => "") : "";
    check("finder pt : la carte BA écrit le refus cabine documenté, avec hôte et date",
      /Cabine\s*:\s*não\b/.test(baCabine)
        && /Fonte oficial verificada em 5 de setembro de 2026\s*:\s*[^·]*Cabine/.test(baProv)
        && /britishairways\.com/.test(baPreuves ?? "") && /2026-09-05/.test(baPreuves ?? ""),
      `cabine : ${baCabine} · provenance : ${baProv} · preuves : ${(baPreuves ?? "").replace(/\s+/g, " ").slice(0, 160)}`);
    /* La cause « aucune phrase citée » n'accuse plus la compagnie entière : elle est dite UNE FOIS dans les
       notes générales, et sur la carte, chaque canal non prouvé porte son propre « a confirmar » — la cabine
       refusée, elle, reste « não ». Le témoin exige qu'un canal au moins (Porão ou Carga) soit à confirmer
       et que la cabine ne le soit pas. */
    const baPorao = (await ba.count()) ? await ba.first().locator(".acard__line--hold").innerText().catch(() => "") : "";
    const baCarga = (await ba.count()) ? await ba.first().locator(".acard__line--cargo").innerText().catch(() => "") : "";
    check("finder pt : la cause « aucune frase citada » nomme ses canaux, pas la compagnie entière",
      (/Porão\s*:\s*a confirmar/.test(baPorao) || /Carga\s*:\s*(?:a confirmar|informações não publicadas)/.test(baCarga))
        && !/a confirmar/.test(baCabine),
      `porão : ${baPorao} · carga : ${baCarga} · cabine : ${baCabine}`);
    exiger("finder pt", "packages/ui/src/components/FlightFinder.astro", corps);
    await capturer(p, "pt-finder");
    await p.close();
  }

  /* 1 bis. LE TITRE DE L'ACCUEIL NE CHEVAUCHE PAS L'EMBLÈME — quatre langues, fenêtre 1280 px.
     Relevé par Philippe sur le site en ligne le 08/09/2026 : la ligne orange du hero, en
     `white-space: nowrap`, passait sous l'emblème posé en absolu à droite. On mesure les
     rectangles rendus, pas le CSS : le bord droit du titre doit rester à gauche du bord gauche de
     l'emblème, et le titre doit tenir dans son conteneur. */
  const taillesTitre = {};
  for (const loc of ["", "/fr", "/es", "/pt"]) {
    const p = await nouvellePage();
    await p.goto(`${BASE}${loc}/`, { waitUntil: "networkidle" });
    const m = await p.evaluate(() => {
      const t = document.querySelector(".hero__title"), e = document.querySelector(".hero__emblem"), c = document.querySelector(".hero .mdcf-container");
      if (!t || !e || !c) return null;
      /* LES GLYPHES, PAS LE BLOC : un `nowrap` remis en place laisserait le bloc à sa largeur
         maximale et ferait déborder le texte sans que le rectangle du bloc bouge. Le `Range` sur
         le contenu mesure l'étendue réellement peinte. */
      const r = document.createRange(); r.selectNodeContents(t);
      const rt = r.getBoundingClientRect(), re = e.getBoundingClientRect(), rc = c.getBoundingClientRect();
      return { titreDroite: Math.round(rt.right), emblemeGauche: Math.round(re.left), conteneurDroite: Math.round(rc.right), taille: getComputedStyle(t).fontSize };
    });
    if (m) taillesTitre[loc || "/"] = m.taille;
    check(`accueil ${loc || "/"} : le hero a un titre, un emblème et un conteneur`, m !== null);
    if (m) {
      check(`accueil ${loc || "/"} : le titre s'arrête avant l'emblème`, m.titreDroite <= m.emblemeGauche,
        `titre → ${m.titreDroite}px, emblème ← ${m.emblemeGauche}px`);
      check(`accueil ${loc || "/"} : le titre tient dans son conteneur`, m.titreDroite <= m.conteneurDroite,
        `titre → ${m.titreDroite}px, conteneur → ${m.conteneurDroite}px`);
    }
    await p.close();
  }
  /* LA MÊME TAILLE DANS LES QUATRE LANGUES. Le portugais n'avait pas de règle `--pt` et retombait
     sur la taille de base : visiblement plus petit, relevé par Philippe le 08/09/2026. */
  check("accueil : le titre a la même taille de police dans les quatre langues",
    new Set(Object.values(taillesTitre)).size === 1, JSON.stringify(taillesTitre));

  /* 2. LE CALCULATEUR DE CAISSE — une race choisie, un résultat calculé. */
  {
    const p = await nouvellePage();
    await p.goto(`${BASE}/pt/tools/crate/`, { waitUntil: "networkidle" });
    await p.fill("#crx-breed", "Pug");
    await p.dispatchEvent("#crx-breed", "input");
    await p.waitForTimeout(400);
    await p.evaluate(() => document.getElementById("crx-form").requestSubmit());
    await p.waitForSelector("#crx-result:not([hidden])", { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(600);
    const corps = await p.textContent("body");
    const resultat = (await p.textContent("#crx-result").catch(() => "")) ?? "";
    check("caisse pt : aucune erreur JavaScript", p.__erreurs.length === 0, p.__erreurs.slice(0, 2).join(" | "));
    check("caisse pt : un résultat a été calculé", resultat.trim().length > 20, `${resultat.trim().length} caractères`);
    exiger("caisse pt", "packages/ui/src/components/CrateCalculator.astro", corps);
    await capturer(p, "pt-caisse");
    await p.close();
  }

  /* 3. LE CALCULATEUR CHALEUR — deux aéroports et une race, donc les seuils et les mises en garde. */
  {
    const p = await nouvellePage();
    await p.goto(`${BASE}/pt/tools/heat/`, { waitUntil: "networkidle" });
    const choisir = async (champ, texte) => {
      await p.fill(champ, texte);
      await p.dispatchEvent(champ, "input");
      await p.waitForSelector(`${champ}-listbox .ac-item`, { timeout: 10000 });
      await p.click(`${champ}-listbox .ac-item`);
      await p.waitForTimeout(200);
    };
    await choisir("#hx-dep", "Paris");
    await choisir("#hx-arr", "Dubai");
    await choisir("#hx-breed", "Pug");
    await p.keyboard.press("Escape");
    await p.evaluate(() => document.getElementById("hx-form").requestSubmit());
    await p.waitForSelector("#hx-out:not([hidden])", { timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(600);
    const corps = await p.textContent("body");
    const sortie = (await p.textContent("#hx-out").catch(() => "")) ?? "";
    check("chaleur pt : aucune erreur JavaScript", p.__erreurs.length === 0, p.__erreurs.slice(0, 2).join(" | "));
    check("chaleur pt : une estimation a été rendue", sortie.trim().length > 20, `${sortie.trim().length} caractères`);
    exiger("chaleur pt", "packages/ui/src/components/HeatCalculator.astro", corps);
    await capturer(p, "pt-chaleur");
    await p.close();
  }

  /* 4. DESTINATIONS — l'outil qui porte le plus de phrases (23 sur 60), exercé sur la base réelle. */
  {
    const p = await nouvellePage();
    await p.goto(`${BASE}/pt/tools/destinations/`, { waitUntil: "networkidle" });
    const choisir = async (champ, texte) => {
      await p.fill(champ, texte);
      await p.dispatchEvent(champ, "input");
      await p.waitForSelector(`${champ}-listbox .ac-item`, { timeout: 10000 });
      await p.click(`${champ}-listbox .ac-item`);
      await p.waitForTimeout(200);
    };
    await choisir("#dfx-origin", "Paris");
    await choisir("#dfx-breed", "Golden Retriever");
    await p.keyboard.press("Escape");
    await p.evaluate(() => document.getElementById("dfx-form").requestSubmit());
    await p.waitForSelector("#dfx-result:not([hidden])", { timeout: 25000 }).catch(() => {});
    await p.waitForTimeout(900);
    const corps = await p.textContent("body");
    const resultat = (await p.textContent("#dfx-result").catch(() => "")) ?? "";
    check("destinations pt : aucune erreur JavaScript", p.__erreurs.length === 0, p.__erreurs.slice(0, 2).join(" | "));
    check("destinations pt : l'outil a répondu quelque chose", resultat.trim().length > 20, `${resultat.trim().length} caractères`);
    exiger("destinations pt", "packages/ui/src/components/DestinationFinder.astro", corps);
    await capturer(p, "pt-destinations");
    await p.close();
  }

  /* 5. LA PAGE « À PROPOS » EN PORTUGAIS — celle qui a été prise en défaut, cette fois exigée
   *    à l'endroit exact où les trois phrases paraissaient. */
  {
    const p = await nouvellePage();
    await p.goto(`${BASE}/pt/about/`, { waitUntil: "domcontentloaded" });
    const corps = await p.textContent("body");
    exiger("à propos pt", "packages/ui/src/pages/[...loc]/about.astro", corps);
    check("à propos pt : la page ne se dit plus bilingue ni trilingue",
      !/bilingu|trilingu/i.test(corps ?? ""), (corps ?? "").match(/[^.]*(bilingu|trilingu)[^.]*/i)?.[0]?.slice(0, 80) ?? "");
    await capturer(p, "pt-a-propos");
    await p.close();
  }
}

await contexte.close();
await navigateur.close();
arreter();

console.log(`\ncaptures déposées dans ${CAPTURES}/`);
console.log(`\n${pass} OK, ${fail} ÉCHEC`);
process.exit(fail > 0 ? 1 : 0);
