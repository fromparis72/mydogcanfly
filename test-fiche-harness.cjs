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
  // The "share by email" mailto: link legitimately embeds the current page URL verbatim (that is
  // what "share this link" means) — it is not a rendered claim about the airline, just a copy of
  // the address bar. Strip it before searching for leaked forged content, same as a human
  // reviewer would ignore the mailto body when checking what the PAGE asserts.
  const html = raw.replace(/<a class="bbtn" href="mailto:[^"]*"[^>]*>[\s\S]*?<\/a>/, "");
  return { html, raw, error: null };
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
  }
}

console.log("\n=== SUMMARY ===");
console.log(failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
