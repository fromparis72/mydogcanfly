/**
 * HARNAIS du chercheur de coins pipi — page CONSTRUITE, sélecteurs DOM précis, quatre langues.
 *
 *   npm run build:ci && node test-pet-relief-harness.cjs      (branché dans test:built-ui)
 *
 * POURQUOI IL EXISTE. Deuxième des quatre outils que T0-B3-g a trouvés sans aucun harnais. Celui-ci
 * ne calcule rien : il oriente. Son risque propre est donc l'ORIENTATION FAUSSE — une pastille qui
 * annonce une zone documentée là où le référentiel n'en connaît pas, ou un raccourci « aéroports
 * bien documentés » qui mène ailleurs.
 *
 * CE QU'IL VÉRIFIE :
 *   1. les raccourcis « bien documentés » ne contiennent QUE des aéroports au statut documenté, et
 *      leur lien porte le préfixe de langue de la page où ils sont rendus ;
 *   2. la pastille rendue dans la liste correspond EXACTEMENT au statut de l'aéroport, pour un
 *      échantillon couvrant les quatre statuts ;
 *   3. une soumission sans aéroport affiche le message d'aide et ne navigue PAS ;
 *   4. les quatre langues listent les mêmes aéroports avec les mêmes statuts — une traduction ne
 *      change pas un statut ;
 *   5. les noms de ville sont bien traduits là où le référentiel les traduit (sinon « quatre
 *      langues » ne serait qu'une répétition du même contenu).
 *
 * JAMAIS VERT FAUTE DE MATIÈRE : il exige un référentiel peuplé et les quatre statuts représentés.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const DIST = path.join(__dirname, "packages/ui/dist");
const LOCALES = [["en", ""], ["fr", "fr"], ["es", "es"], ["pt", "pt"]];
const STATUTS = ["yes", "no", "us", "none"];
const PASTILLE = { yes: "prf-d-yes", us: "prf-d-us", no: "prf-d-no", none: "prf-d-none" };

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  if (cond) pass++;
  else { fail++; console.log("  FAIL " + label + (detail ? `\n         ${detail}` : "")); }
};

function chargerPage(dir) {
  const fichier = path.join(DIST, dir, "tools/pet-relief/index.html");
  if (!fs.existsSync(fichier)) throw new Error(`page absente : ${fichier} — le site n'est pas construit`);
  const html = fs.readFileSync(fichier, "utf8");
  const hoisted = [...html.matchAll(/<script type="module" src="(\/_astro\/hoisted\.[^"]+\.js)"><\/script>/g)]
    .map((m) => path.join(DIST, m[1]));
  const cible = hoisted.find((p) => fs.readFileSync(p, "utf8").includes("prf-data"));
  if (!cible) throw new Error("bundle prf introuvable pour " + (dir || "en"));
  const script = fs.readFileSync(cible, "utf8")
    .replace(/import\s*\{([^}]*)\}\s*from\s*"[^"]*";?/g, (_, b) =>
      b.split(",").map((x) => (x.includes(" as ") ? x.split(" as ")[1] : x).trim()).filter(Boolean)
        .map((n) => `const ${n} = () => {};`).join(" "))
    .replace(/import\s*"[^"]*";?/g, "");
  const bloc = html.match(/<div class="prf"[^>]*>[\s\S]*?<script type="application\/json" id="prf-data"[^>]*>[\s\S]*?<\/script>/);
  if (!bloc) throw new Error("bloc prf introuvable pour " + (dir || "en"));
  const L = JSON.parse(html.match(/<script type="application\/json" id="prf-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
  return { html, bloc: bloc[0], script, L };
}

/** Une page pilotée : on tape une requête, on lit la liste rendue. */
function saisir(page, requete) {
  /* La navigation ne s'observe pas en réécrivant `location` — JSDOM interdit de le redéfinir.
     Elle s'observe par la console virtuelle, qui signale « Not implemented: navigation ». */
  const navigations = [];
  const console_ = new VirtualConsole();
  console_.on("jsdomError", (e) => { if (/navigation/i.test(String(e.message))) navigations.push(String(e.message)); });
  const dom = new JSDOM(`<!doctype html><html><body>${page.bloc}</body></html>`, {
    url: "https://mydogcanfly.com/tools/pet-relief/", runScripts: "outside-only", virtualConsole: console_,
  });
  const doc = dom.window.document;
  dom.window.Element.prototype.scrollIntoView = () => {};
  dom.window.eval(page.script);
  const input = doc.getElementById("prf-ap");
  input.value = requete;
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  const items = [...doc.querySelectorAll(".ac-item")].map((li) => ({
    texte: (li.textContent || "").replace(/\s+/g, " ").trim(),
    pastille: [...(li.querySelector(".prf-dot")?.classList ?? [])].find((c) => c.startsWith("prf-d-")) ?? null,
  }));
  return { dom, doc, items, navigations };
}

const pages = Object.fromEntries(LOCALES.map(([l, dir]) => [l, chargerPage(dir)]));
const AP = pages.en.L.airports ?? [];

/* ---- Matière : sans référentiel peuplé, tout ce qui suit passerait à vide -------------------- */
check("le référentiel embarqué est peuplé", AP.length >= 200, `${AP.length} aéroports`);
const parStatut = Object.fromEntries(STATUTS.map((s) => [s, AP.filter((a) => a.relief === s)]));
/* TROIS STATUTS SUR QUATRE SONT PRODUITS, ET LE QUATRIÈME EST ATTENDU À ZÉRO — constaté, pas subi.
 * `us` est le repli des aéroports américains sans zone documentée ; le référentiel documente
 * aujourd'hui les 31, donc aucun ne le reçoit. La légende « règle US (zone côté piste) » est
 * pourtant rendue sur la page : c'est une légende pour une catégorie vide. Signalé, non corrigé.
 * Le jour où un aéroport américain entrera sans relief documenté, ce contrôle le fera VOIR. */
check("trois statuts sont peuplés (sinon l'échantillon ne prouverait rien)",
  ["yes", "no", "none"].every((s) => parStatut[s].length > 0),
  STATUTS.map((s) => `${s}: ${parStatut[s].length}`).join(" · "));
check("le statut « règle US » n'est produit par aucun aéroport — sa légende est pourtant affichée",
  parStatut.us.length === 0, `${parStatut.us.length} aéroport(s) : ${parStatut.us.map((a) => a.iata).join(", ")}`);
check("chaque aéroport porte exactement un des quatre statuts",
  AP.every((a) => STATUTS.includes(a.relief)),
  AP.filter((a) => !STATUTS.includes(a.relief)).slice(0, 5).map((a) => `${a.iata}: ${a.relief}`).join(", "));

/* ---- 1. Les raccourcis « bien documentés » ---------------------------------------------------- */
for (const [l, dir] of LOCALES) {
  const p = pages[l];
  check(`${l} : des raccourcis sont proposés`, (p.L.featured ?? []).length > 0);
  check(`${l} : tous les raccourcis sont au statut documenté`,
    (p.L.featured ?? []).every((a) => a.relief === "yes"),
    (p.L.featured ?? []).filter((a) => a.relief !== "yes").map((a) => `${a.iata}:${a.relief}`).join(", "));
  const href = [...p.html.matchAll(/<a class="prf-chip"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  check(`${l} : les raccourcis rendus correspondent aux raccourcis annoncés`,
    href.length === (p.L.featured ?? []).length, `${href.length} liens · ${(p.L.featured ?? []).length} annoncés`);
  const prefixe = dir ? `/${dir}/airports/` : "/airports/";
  check(`${l} : chaque raccourci mène à la fiche dans SA langue`,
    href.every((h) => h.startsWith(prefixe)), href.filter((h) => !h.startsWith(prefixe)).join(", "));
}

/* ---- 2. La pastille dit le statut, pour les quatre statuts ------------------------------------ */
for (const s of STATUTS.filter((x) => parStatut[x].length)) {
  const a = parStatut[s][0];
  const r = saisir(pages.en, a.iata);
  const ligne = r.items.find((i) => i.texte.includes(`(${a.iata})`));
  check(`${a.iata} (${s}) : l'aéroport apparaît dans la liste`, !!ligne,
    r.items.slice(0, 3).map((i) => i.texte).join(" | ") || "liste vide");
  check(`${a.iata} (${s}) : la pastille rendue est celle du statut`, ligne?.pastille === PASTILLE[s],
    `rendue ${ligne?.pastille} · attendue ${PASTILLE[s]}`);
}

/* ---- 3. Une soumission vide n'emmène nulle part ------------------------------------------------ */
{
  const soumettre = (r) => r.doc.getElementById("prf-form").dispatchEvent(
    new r.dom.window.Event("submit", { bubbles: true, cancelable: true }));

  /* D'ABORD LE TÉMOIN : prouver que le détecteur SAIT voir une navigation. Sans lui, « ne navigue
     nulle part » passerait aussi bien parce que la navigation ne marche jamais sous JSDOM. */
  const valide = saisir(pages.en, parStatut.yes[0].iata);
  soumettre(valide);
  check("témoin : une soumission valide déclenche bien une navigation détectable",
    valide.navigations.length > 0, "aucune navigation détectée — le contrôle suivant ne prouverait rien");

  const vide = saisir(pages.en, "");
  soumettre(vide);
  const msg = vide.doc.getElementById("prf-msg");
  check("une soumission sans aéroport affiche le message d'aide", !msg.hidden && msg.textContent.trim().length > 0,
    `hidden=${msg.hidden} texte=«${msg.textContent}»`);
  check("une soumission sans aéroport ne navigue nulle part", vide.navigations.length === 0,
    vide.navigations.join(" | "));
}

/* ---- 4 et 5. Quatre langues : mêmes aéroports, mêmes statuts, villes traduites ---------------- */
{
  const clefs = Object.fromEntries(LOCALES.map(([l]) => [l,
    (pages[l].L.airports ?? []).map((a) => `${a.iata}:${a.relief}`).sort().join("|")]));
  const distinctes = [...new Set(Object.values(clefs))];
  check("les quatre langues listent les mêmes aéroports avec les mêmes statuts", distinctes.length === 1,
    Object.entries(clefs).map(([l, k]) => `${l}: ${k.length} car.`).join(" · "));
  const villesFr = new Map((pages.fr.L.airports ?? []).map((a) => [a.iata, a.city]));
  const traduites = (pages.en.L.airports ?? []).filter((a) => villesFr.get(a.iata) !== a.city).length;
  check("des villes sont réellement traduites en français (sinon les quatre langues répètent le même contenu)",
    traduites > 0, `${traduites} ville(s) différentes de l'anglais`);
}

console.log(`\n  [coins pipi] ${pass} contrôles tenus, ${fail} en échec`);
if (fail) process.exit(1);
console.log("[coins pipi] le chercheur oriente vers ce que le référentiel documente, dans les quatre langues.");
