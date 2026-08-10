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
// a fee, and outbound links pointing at an attacker-controlled domain — exactly what Option B
// must stop from ever reaching the DOM.
const FORGED_QS =
  "from=us&to=fr&an=" + encodeURIComponent("FAUSSE COMPAGNIE") +
  "&sc=100&cab=1&hold=1&cargo=1&direct=1&fee=" + encodeURIComponent("0€ garanti") +
  "&emb=1&as=" + encodeURIComponent("https://evil.example.com/book") +
  "&af=" + encodeURIComponent("https://evil.example.com/fiche") +
  "&air=evilair&bid=carlin&breed=Carlin&brachy=1&w=8";

// Legitimate Finder-style URL: a real country pair + dog context.
const LEGIT_QS = "from=fr&to=us&breed=Labrador&w=25&eu_passport=1";

// Old-style shared link: pre-patch FlightFinder used to embed an/sc/cab/hold/direct/air. This
// simulates an already-shared URL from BEFORE this patch, which must now render safely too.
const OLD_SHARED_QS =
  "from=fr&to=us&an=" + encodeURIComponent("Air France") +
  "&sc=87&cab=1&hold=1&direct=1&air=airline_air_france&breed=Labrador&w=25";

// Exact URL FlightFinder.astro generates today (10/08/2026 fix, contre-revue Codex) — only the
// whitelisted context params: from/to/air/breed/bid/w/eu_passport. No more an/sc/cab/hold/cargo/
// direct/emb/fee/as/af. Mirrors packages/ui/src/components/FlightFinder.astro lines ~458-473.
const FINDER_QS =
  "from=fr&to=us&air=airline_air_france&breed=" + encodeURIComponent("Labrador") +
  "&bid=labrador&w=25&eu_passport=1";

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
  return { bibleData, bibleCfg, clientScript, bundlePath: target };
}

function run(localeDir, qs) {
  const { bibleData, bibleCfg, clientScript } = loadPageParts(localeDir);
  const dom = new JSDOM(
    `<!doctype html><html><body>
      <div id="bible" class="bible"><p class="bible__empty">loading</p></div>
      <div id="bible-tools" hidden></div>
      <script type="application/json" id="bible-data">${bibleData}</script>
      <script type="application/json" id="bible-cfg">${bibleCfg}</script>
    </body></html>`,
    { url: "https://mydogcanfly.com/tools/fiche?" + qs, runScripts: "outside-only" }
  );
  const { window } = dom;
  window.mdcfQuery = () => new window.URLSearchParams(qs);
  window.mdcfPut = (href) => href;
  try {
    // The bundle is emitted as an ES module: it may start with an `import "./other.js"` for an
    // unrelated hoisted script (here, the mobile-nav menu wiring — irrelevant to bible rendering)
    // and end with `export {};`. Strip both so eval() as a plain classic script works; nothing
    // about the fiche-rendering logic itself is touched.
    const script = clientScript
      .replace(/^import\s*"[^"]*";?\s*/m, "")
      .replace(/\bexport\s*\{\s*\};?\s*$/m, "");
    dom.window.eval(script);
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
  return { html: raw, raw, mailtoHref, error: null };
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
    check("mailto body only carries whitelisted params (from/to/air/breed/bid/w/eu_passport)", !forged.mailtoHref || (() => {
      const frag = forged.mailtoHref.split("#")[1] || "";
      const keys = [...new URLSearchParams(frag).keys()];
      const allowed = new Set(["from", "to", "air", "breed", "bid", "w", "eu_passport"]);
      return keys.every((k) => allowed.has(k));
    })());
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
  }
}

console.log("\n=== SUMMARY ===");
console.log(failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
