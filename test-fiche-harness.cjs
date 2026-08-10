// Test harness for the Option B patch on fiche.astro.
// Loads the REAL built HTML (bible-data + bible-cfg) and the REAL bundled client script
// (Astro hoists page <script> blocks into an external /_astro/hoisted.*.js module) for each
// locale, executes it inside jsdom against (a) a forged URL carrying fake airline/verdict
// params, (b) a legitimate Finder-style URL, and (c) an old already-shared URL from before this
// patch, then asserts on the rendered DOM.

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const LOCALES = [
  { code: "en", dir: "" },
  { code: "fr", dir: "fr/" },
  { code: "es", dir: "es/" },
  { code: "pt", dir: "pt/" },
];

const DIST = path.join(__dirname, "packages/ui/dist");

// Forged URL: fake airline name, fake score, all capability flags forced true, an embargo flag,
// a fee, outbound links pointing at an attacker-controlled domain, a made-up airline id
// (`evilair`, absent de la liste des 76 compagnies connues), un identifiant de race inventé
// (`zzz_not_a_real_breed` — le vrai id du carlin serait `breed_pug`), un poids hors bornes
// (500 kg) et une race en texte
// libre truffée de caractères de contrôle et bien trop longue — exactement ce que le tour 5
// (validation par champ, contre-revue Codex 10/08/2026) doit maintenant arrêter EN PLUS de ce
// qu'Option B arrêtait déjà.
const FORGED_QS =
  "from=us&to=fr&an=" + encodeURIComponent("FAUSSE COMPAGNIE") +
  "&sc=100&cab=1&hold=1&cargo=1&direct=1&fee=" + encodeURIComponent("0€ garanti") +
  "&emb=1&as=" + encodeURIComponent("https://evil.example.com/book") +
  "&af=" + encodeURIComponent("https://evil.example.com/fiche") +
  "&air=evilair&bid=zzz_not_a_real_breed&breed=" + encodeURIComponent("Berger\x00\x07" + "X".repeat(200)) +
  "&brachy=1&w=500&eu_passport=maybe";

// Legitimate Finder-style URL: a real country pair + dog context, no airline/breed id (both
// optional — un visiteur qui n'a pas encore choisi de compagnie précise a quand même une fiche
// utile, la chronologie pays ne dépend d'aucun des deux).
const LEGIT_QS = "from=fr&to=us&breed=Labrador&w=25&eu_passport=yes";

// Old-style shared link: pre-patch FlightFinder used to embed an/sc/cab/hold/direct/air. `air`
// est un VRAI identifiant de compagnie (airline_air_france) — ce scénario doit donc le voir
// survivre à la validation, seuls les champs de verdict disparaissent.
const OLD_SHARED_QS =
  "from=fr&to=us&an=" + encodeURIComponent("Air France") +
  "&sc=87&cab=1&hold=1&direct=1&air=airline_air_france&breed=Labrador&w=25";

// Exact URL FlightFinder.astro generates today (10/08/2026 fix, contre-revue Codex) — only the
// whitelisted context params: from/to/air/breed/bid/w/eu_passport. No more an/sc/cab/hold/cargo/
// direct/emb/fee/as/af. Mirrors packages/ui/src/components/FlightFinder.astro lines ~458-473.
// `air`/`bid` sont de VRAIS identifiants (airline_air_france / breed_labrador_retriever) —
// FlightFinder ne les écrit que depuis ses propres listes connues, jamais à la main.
const FINDER_QS =
  "from=fr&to=us&air=airline_air_france&breed=" + encodeURIComponent("Labrador") +
  "&bid=breed_labrador_retriever&w=25&eu_passport=yes";

// Only the 7 canonical keys, in this order — the exhaustive whitelist that `canon` (fiche.astro)
// must reduce every scenario down to. Tout le reste doit disparaître, quelle que soit sa valeur.
const WHITELISTED_KEYS = ["from", "to", "air", "breed", "bid", "w", "eu_passport"];

// Correction P0 (contre-revue Codex, tour 6, 10/08/2026) : le cas fondateur de toute cette
// contre-revue. `airline_la_compagnie` est une VRAIE compagnie (kb.airlines, 102 entrées) mais
// n'a PAS de logo (packages/ui/src/data/airline-logos.generated.json n'en compte que 76) — le
// tour 5 validait `air` contre `Object.keys(C.logos)` et la rejetait donc à tort. Doit survivre
// à la canonicalisation exactement comme `airline_air_france` (scénario OLD_SHARED_QS ci-dessus).
const LA_COMPAGNIE_QS = "from=fr&to=us&air=airline_la_compagnie&breed=Labrador&w=25&eu_passport=yes";

// Toutes les compagnies réelles de la base (packages/knowledge/raw/objects.json, la même source
// que loadKB().airlines) — sert au test d'invariant demandé par Codex : chacune doit survivre à
// la validation par champ, pas seulement les 76 qui ont un logo. Chargé ici plutôt que recopié à
// la main pour ne jamais désynchroniser le test de la vraie liste blanche.
const ALL_AIRLINE_IDS = require("./packages/knowledge/raw/objects.json").airlines.map((a) => a.id);

function loadPageParts(localeDir) {
  const htmlPath = path.join(DIST, localeDir, "tools/fiche/index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const bibleData = html.match(/<script type="application\/json" id="bible-data"[^>]*>([\s\S]*?)<\/script>/)[1];
  const bibleCfg = html.match(/<script type="application\/json" id="bible-cfg"[^>]*>([\s\S]*?)<\/script>/)[1];
  const hoistedSrc = html.match(/<script type="module" src="(\/_astro\/hoisted\.[^"]+\.js)"><\/script>/);
  if (!hoistedSrc) throw new Error("could not find hoisted module script tag in " + htmlPath);
  // Multiple hoisted bundles are referenced on the page; find the one containing our page logic.
  const candidates = [...html.matchAll(/<script type="module" src="(\/_astro\/hoisted\.[^"]+\.js)"><\/script>/g)]
    .map((m) => path.join(DIST, m[1]));
  const target = candidates.find((p) => {
    const src = fs.readFileSync(p, "utf8");
    return src.includes("bible-data") && src.includes("mdcfQuery");
  });
  if (!target) throw new Error("could not locate the fiche client bundle among: " + candidates.join(", "));
  const clientScript = fs.readFileSync(target, "utf8");
  // Résidu Option B, tour 5 (contre-revue Codex, 10/08/2026) : Base.astro porte un mécanisme
  // site-wide (script `is:inline`, donc littéralement présent dans le HTML de CHAQUE page, pas
  // hissé dans un bundle séparé) qui définit `window.mdcfQuery`/`mdcfAncre`/`mdcfPut` et recopie
  // `location.hash` brut dans les liens `<a hreflang>` du sélecteur de langue au chargement.
  // Le harness ne le chargeait jamais jusqu'ici — c'est exactement le trou que Codex a trouvé en
  // navigateur réel et qu'aucun de nos tests jsdom n'aurait pu voir. On l'extrait ici tel quel
  // (aucune transformation Astro sur un script is:inline) pour l'exécuter avant le bundle fiche,
  // dans le même ordre que sur la vraie page.
  const baseScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const baseScript = baseScripts.find((s) => s.includes("mdcfQuery") && s.includes("hreflang"));
  if (!baseScript) throw new Error("could not locate Base.astro's inline mdcfQuery/hreflang script in " + htmlPath);
  return { bibleData, bibleCfg, clientScript, baseScript, bundlePath: target };
}

function run(localeDir, qs) {
  const { bibleData, bibleCfg, clientScript, baseScript } = loadPageParts(localeDir);
  // Quatre liens de langue factices, à l'image du header réel (Header.astro, `a.hdr__langopt`) :
  // au chargement, AUCUN ne porte de dièse — c'est précisément ce que Base.astro leur ajoute.
  const langHrefs = { en: "/tools/fiche/", fr: "/fr/tools/fiche/", es: "/es/tools/fiche/", pt: "/pt/tools/fiche/" };
  const langLinksHtml = Object.entries(langHrefs)
    .map(([code, href]) => `<a class="hdr__langopt" href="${href}" hreflang="${code}" data-lang="${code}">${code.toUpperCase()}</a>`)
    .join("\n      ");
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <div class="hdr__lang" role="group" aria-label="Language">
      ${langLinksHtml}
      </div>
      <div id="bible" class="bible"><p class="bible__empty">loading</p></div>
      <div id="bible-tools" hidden></div>
      <script type="application/json" id="bible-data">${bibleData}</script>
      <script type="application/json" id="bible-cfg">${bibleCfg}</script>
    </body></html>`,
    // Le dièse, pas la requête : c'est la convention réelle du site (mdcfQuery lit location.hash
    // en premier, cf. Base.astro) — utiliser `?` ici masquerait justement le canal testé.
    { url: "https://mydogcanfly.com/tools/fiche#" + qs, runScripts: "outside-only" }
  );
  const { window } = dom;
  try {
    // 1) Base.astro d'abord : définit la VRAIE window.mdcfQuery (plus un stub), et enregistre les
    //    écouteurs DOMContentLoaded/hashchange — exactement l'ordre du chargement réel de la page.
    dom.window.eval(baseScript);
    // 2) Le bundle fiche ensuite : lit window.mdcfQuery(), construit `canon`, appelle
    //    history.replaceState, puis rend #bible. Toujours un module ES : mêmes nettoyages qu'avant.
    const script = clientScript
      .replace(/^import\s*"[^"]*";?\s*/m, "")
      .replace(/\bexport\s*\{\s*\};?\s*$/m, "");
    dom.window.eval(script);
    // 3) DOMContentLoaded, une seule fois — déclenche les écouteurs de Base.astro (dont la recopie
    //    vers les liens hreflang), après coup, comme dans un vrai navigateur : les scripts de
    //    module s'exécutent avant cet événement, jamais après.
    dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded", { bubbles: true, cancelable: true }));
  } catch (e) {
    return { error: e.stack || e.message, html: dom.window.document.getElementById("bible").innerHTML };
  }
  const raw = dom.window.document.getElementById("bible").innerHTML;
  // Résidu Option B corrigé (10/08/2026, contre-revue Codex) : le lien "partager par email" est
  // désormais reconstruit depuis une liste blanche de paramètres canoniques (from/to/air/breed/
  // bid/w/eu_passport), jamais depuis `location.href` brute. Il doit donc maintenant être aussi
  // sûr que le reste du rendu — on ne l'exclut plus des vérifications de fuite, on l'inclut.
  const mailtoMatch = raw.match(/<a class="bbtn" href="mailto:([^"]*)"[^>]*>/);
  const mailtoHref = mailtoMatch ? decodeURIComponent(mailtoMatch[1].replace(/&amp;/g, "&")) : null;
  // Résidu Option B, tour 5 : les 4 liens de langue, après le DOMContentLoaded de Base.astro —
  // c'est le canal que Codex a trouvé non couvert. Doivent ne porter QUE le dièse canonique.
  const hreflangHrefs = {};
  for (const a of dom.window.document.querySelectorAll("a[hreflang]")) {
    hreflangHrefs[a.getAttribute("hreflang")] = a.getAttribute("href");
  }
  const canonicalHash = dom.window.location.hash;
  return { html: raw, raw, mailtoHref, hreflangHrefs, canonicalHash, error: null };
}

let failures = 0;
function check(label, cond) {
  if (cond) {
    console.log("  OK   " + label);
  } else {
    console.log("  FAIL " + label);
    failures++;
  }
}

// Résidu Option B, tour 5 : vérifie que les 4 liens de langue (le canal trouvé par Codex) ne
// portent, après DOMContentLoaded, que les clés listées dans `expectedKeys` — jamais une clé
// hors liste blanche, jamais une valeur brute forgée. `label` sert juste à l'affichage.
function checkHreflang(label, result, expectedKeys) {
  const hrefs = result.hreflangHrefs || {};
  const codes = Object.keys(hrefs);
  check(`${label}: 4 liens hreflang présents`, codes.length === 4);
  for (const code of codes) {
    const href = hrefs[code] || "";
    const hashIdx = href.indexOf("#");
    check(`${label}: lien ${code} porte un dièse`, hashIdx >= 0);
    const frag = hashIdx >= 0 ? href.slice(hashIdx + 1) : "";
    const keys = [...new URLSearchParams(frag).keys()].sort();
    check(`${label}: lien ${code} ne porte que ${expectedKeys.join("/") || "(rien)"}`,
      keys.join(",") === [...expectedKeys].sort().join(","));
    check(`${label}: lien ${code} sans evil.example.com/FAUSSE COMPAGNIE/zzz_not_a_real_breed/evilair`,
      !/evil\.example\.com|FAUSSE COMPAGNIE|zzz_not_a_real_breed|evilair/i.test(href));
  }
}

for (const { code, dir } of LOCALES) {
  console.log("\n=== locale: " + code + " ===");

  console.log("-- forged URL --");
  const forged = run(dir, FORGED_QS);
  if (forged.error) {
    console.log("  FAIL script threw: " + forged.error);
    failures++;
  } else {
    const h = forged.html;
    check("no 'FAUSSE COMPAGNIE' in DOM", !h.includes("FAUSSE COMPAGNIE"));
    check("no '100 %' / '100%' score in DOM", !h.includes("100 %") && !h.includes("100%"));
    check("no evil.example.com in DOM", !h.toLowerCase().includes("evil.example.com"));
    check("no '0€ garanti' fee in DOM", !h.includes("0€ garanti"));
    check("no bhead__r / bscore / bvolh / bairlogo--block markup", !/bhead__r|bscore|bvolh|bairlogo--block/.test(h));
    check("renders non-empty content (country chronology)", h.length > 500);
    check("shows a step/chrono/domestic block", /bstep|bchrono|bdomH|bcard__h/.test(h));
    // Résidu Option B (mailto): la liste blanche ne doit reprendre que from/to/air/breed/bid/w/
    // eu_passport — jamais le nom de compagnie, le score, evil.example.com, la remise ou l'embargo.
    check("mailto link present", !!forged.mailtoHref);
    check("mailto body has no 'FAUSSE COMPAGNIE'", !forged.mailtoHref || !forged.mailtoHref.includes("FAUSSE COMPAGNIE"));
    check("mailto body has no evil.example.com", !forged.mailtoHref || !forged.mailtoHref.toLowerCase().includes("evil.example.com"));
    check("mailto body has no sc=100 / cab / hold / cargo / emb / fee / as / af / an params", !forged.mailtoHref || !/[?&#](sc|cab|hold|cargo|emb|fee|as|af|an)=/.test(forged.mailtoHref));
    check("mailto body only carries whitelisted params", !forged.mailtoHref || (() => {
      const frag = forged.mailtoHref.split("#")[1] || "";
      const keys = [...new URLSearchParams(frag).keys()];
      return keys.every((k) => WHITELISTED_KEYS.includes(k));
    })());
    // Résidu Option B, tour 5 (validation par champ) : `air=evilair` (inconnu), `bid=zzz_not_a_real_breed`
    // (inconnu), `w=500` (>120), `eu_passport=maybe` (ni yes ni no) doivent tous disparaître de
    // l'URL canonique elle-même — pas seulement du rendu ou du mailto. `breed` doit survivre,
    // mais assaini (sans caractères de contrôle, plafonné à 60 caractères).
    const canonKeys = [...new URLSearchParams(forged.canonicalHash.slice(1)).keys()].sort();
    check("URL canonique : seulement from/to/breed (air/bid/w/eu_passport invalides, rejetés)",
      canonKeys.join(",") === ["breed", "from", "to"].sort().join(","));
    const canonBreed = new URLSearchParams(forged.canonicalHash.slice(1)).get("breed") || "";
    check("URL canonique : breed sans caractères de contrôle", !/[\x00-\x1f\x7f]/.test(canonBreed));
    check("URL canonique : breed plafonnée à 60 caractères", canonBreed.length <= 60);
    check("URL canonique : from=us, to=fr (valides, conservés)", forged.canonicalHash.includes("from=us") && forged.canonicalHash.includes("to=fr"));
    checkHreflang("forgée", forged, ["from", "to", "breed"]);
  }

  console.log("-- legitimate Finder URL --");
  const legit = run(dir, LEGIT_QS);
  if (legit.error) {
    console.log("  FAIL script threw: " + legit.error);
    failures++;
  } else {
    const h = legit.html;
    check("renders non-empty content", h.length > 500);
    check("no leftover airline verdict markup (bhead__r/bvolh/bscore)", !/bhead__r|bvolh|bscore/.test(h));
    check("shows a step/chrono block (country formalities present)", /bstep|bchrono/.test(h));
    check("mailto link present", !!legit.mailtoHref);
    checkHreflang("légitime", legit, ["from", "to", "breed", "w", "eu_passport"]);
  }

  console.log("-- old already-shared URL (pre-patch style, carries an/sc/cab/hold) --");
  const old = run(dir, OLD_SHARED_QS);
  if (old.error) {
    console.log("  FAIL script threw: " + old.error);
    failures++;
  } else {
    const h = old.html;
    check("no 'Air France' airline name leaks into DOM", !h.includes("Air France"));
    check("no '87 %' / '87%' score leaks into DOM", !h.includes("87 %") && !h.includes("87%"));
    check("still renders content (no crash on legacy params)", h.length > 500);
    check("mailto body has no 'Air France'", !old.mailtoHref || !old.mailtoHref.includes("Air France"));
    check("mailto body has no sc=87 / cab / hold / direct params", !old.mailtoHref || !/[?&#](sc|cab|hold|direct|an)=/.test(old.mailtoHref));
    // `air=airline_air_france` est un VRAI identifiant : il doit survivre à la validation, seuls
    // les champs de verdict pré-Option B (an/sc/cab/hold/direct) disparaissent de l'URL elle-même.
    check("URL canonique : an/sc/cab/hold/direct absents", !/[?&#](an|sc|cab|hold|direct)=/.test(old.canonicalHash));
    check("URL canonique : air=airline_air_france conservé (identifiant réel)", old.canonicalHash.includes("air=airline_air_france"));
    checkHreflang("ancienne URL partagée", old, ["from", "to", "air", "breed", "w"]);
  }

  console.log("-- exact URL generated today by FlightFinder.astro (from/to/air/breed/bid/w/eu_passport only) --");
  const finder = run(dir, FINDER_QS);
  if (finder.error) {
    console.log("  FAIL script threw: " + finder.error);
    failures++;
  } else {
    const h = finder.html;
    check("renders non-empty content", h.length > 500);
    check("shows a step/chrono block (country formalities present)", /bstep|bchrono/.test(h));
    check("mailto link present", !!finder.mailtoHref);
    check("mailto body round-trips exactly the 7 whitelisted params, nothing else", !finder.mailtoHref || (() => {
      const frag = finder.mailtoHref.split("#")[1] || "";
      const got = new URLSearchParams(frag);
      const expected = new URLSearchParams(FINDER_QS);
      const gotKeys = [...got.keys()].sort();
      const expKeys = [...expected.keys()].sort();
      if (gotKeys.join(",") !== expKeys.join(",")) return false;
      return expKeys.every((k) => got.get(k) === expected.get(k));
    })());
    // Tous les identifiants sont réels ici (air/bid) : rien ne doit être rejeté par la validation
    // par champ — c'est le test de non-régression pour un lien légitime généré aujourd'hui.
    check("URL canonique : les 7 paramètres du Finder survivent tous, identiques", (() => {
      const got = new URLSearchParams(finder.canonicalHash.slice(1));
      const expected = new URLSearchParams(FINDER_QS);
      const gotKeys = [...got.keys()].sort(), expKeys = [...expected.keys()].sort();
      return gotKeys.join(",") === expKeys.join(",") && expKeys.every((k) => got.get(k) === expected.get(k));
    })());
    checkHreflang("Finder", finder, WHITELISTED_KEYS);
  }

  console.log("-- airline_la_compagnie (compagnie réelle sans logo — le cas fondateur, contre-revue Codex tour 6) --");
  const laCompagnie = run(dir, LA_COMPAGNIE_QS);
  if (laCompagnie.error) {
    console.log("  FAIL script threw: " + laCompagnie.error);
    failures++;
  } else {
    check("URL canonique : air=airline_la_compagnie survit (compagnie réelle, sans logo)",
      laCompagnie.canonicalHash.includes("air=airline_la_compagnie"));
    checkHreflang("La Compagnie", laCompagnie, ["from", "to", "air", "breed", "w", "eu_passport"]);
  }
}

// Correction P0 (contre-revue Codex, tour 6, 10/08/2026) : test d'invariant demandé explicitement —
// "vérifier que les 102 identifiants de loadKB().airlines survivent à la canonicalisation". La
// logique de validation (KNOWN_AIRLINES) ne dépend d'aucune donnée localisée : elle vient de
// `loadKB().airlines`, identique quel que soit `locale`. Un seul passage (locale "en") suffit donc
// à couvrir les 102 cas sans 4x le travail pour zéro couverture supplémentaire — voir le commentaire
// sur `airlineIds` dans fiche.astro (même Map que Header.astro/FlightFinder.astro).
console.log("\n=== invariant : les " + ALL_AIRLINE_IDS.length + " compagnies réelles (loadKB().airlines) survivent toutes ===");
{
  let survived = 0;
  const rejected = [];
  for (const id of ALL_AIRLINE_IDS) {
    const qs = "from=fr&to=us&air=" + encodeURIComponent(id);
    const r = run("", qs);
    if (r.error) { rejected.push(id + " (script threw: " + r.error + ")"); continue; }
    const got = new URLSearchParams(r.canonicalHash.slice(1)).get("air");
    if (got === id) survived++; else rejected.push(id);
  }
  check(survived + "/" + ALL_AIRLINE_IDS.length + " identifiants de compagnie survivent tous à la canonicalisation",
    survived === ALL_AIRLINE_IDS.length);
  if (rejected.length) console.log("  rejetés à tort : " + rejected.join(", "));
}

console.log("\n=== SUMMARY ===");
console.log(failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
