/**
 * OUTILLAGE DOM DU FINDER — partagé, parce qu'il ne doit exister qu'en un exemplaire.
 *
 * Charger le VRAI HTML construit, en extraire le bundle client hissé, neutraliser ses imports
 * sans casser ceux dont il a besoin au chargement, poser un `fetch` mocké AVANT d'évaluer le
 * bundle : chacune de ces étapes est un piège documenté, et deux copies de ce code divergeraient
 * au premier changement de build. `test-flightfinder-harness.cjs` l'a écrit ; il vit ici depuis
 * que `test-entity-pages-harness.mjs` en a besoin lui aussi, pour prouver ce que la CARTE rend
 * réellement — et non ce que le moteur renvoie.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const DIST = path.join(__dirname, "..", "packages/ui/dist");

function loadHomeParts(localeDir) {
  const htmlPath = path.join(DIST, localeDir, "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  const section = html.match(/<section id="flight-finder"[\s\S]*?<\/section>/);
  if (!section) throw new Error("could not find <section id=\"flight-finder\"> in " + htmlPath);

  const baseScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const baseScript = baseScripts.find((s) => s.includes("mdcfQuery") && s.includes("hreflang"));
  if (!baseScript) throw new Error("could not locate Base.astro's inline mdcfQuery script in " + htmlPath);

  const candidates = [...html.matchAll(/<script type="module" src="(\/_astro\/hoisted\.[^"]+\.js)"><\/script>/g)]
    .map((m) => path.join(DIST, m[1]));
  // Build minifiée : les noms de variables (dont `lastWeightKg`) sont renommés par esbuild et ne
  // sont donc pas un marqueur fiable. `"2.20462"` (la constante LB de conversion livres↔kg,
  // propre à FlightFinder.astro) est un littéral numérique — jamais renommé, jamais minifié —
  // combiné à `"mdcf-finder"` (id du formulaire) pour cibler sans ambiguïté le bon bundle.
  const target = candidates.find((p) => {
    const src = fs.readFileSync(p, "utf8");
    return src.includes("mdcf-finder") && src.includes("2.20462");
  });
  if (!target) throw new Error("could not locate the FlightFinder client bundle among: " + candidates.join(", "));
  const clientScript = fs.readFileSync(target, "utf8");

  const labelsMatch = section[0].match(/<script type="application\/json" id="mdcf-finder-labels"[^>]*>([\s\S]*?)<\/script>/);
  if (!labelsMatch) throw new Error("could not find mdcf-finder-labels JSON in " + htmlPath);
  const labels = JSON.parse(labelsMatch[1]);

  return { sectionHtml: section[0], baseScript, clientScript, labels, chunkDir: path.dirname(target) };
}

// Reproduit exactement resolveEndpoint() de FlightFinder.astro (norm() + cityMap/airMap), pour
// choisir depuis les VRAIES données générées (labels.airMap/cityMap) une destination valide, sans
// jamais deviner un libellé à la main (fragile d'une locale/build à l'autre).
function norm(s) {
  return (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function reKey(m) {
  const out = {};
  for (const k in m) out[norm(k)] = m[k];
  return out;
}
function resolveEndpointFrom(labels, valueRaw) {
  const cityMap = reKey(labels.cityMap || {});
  const airMap = reKey(labels.airMap || {});
  const v = norm(valueRaw);
  const cityIds = cityMap[v];
  if (cityIds && cityIds.length) return { ids: cityIds, primary: cityIds[0] };
  const aid = airMap[v];
  return aid ? { ids: [aid], primary: aid } : { ids: [], primary: "" };
}
// Choisit, parmi les vraies données générées, un libellé "Arrivée" dont les aéroports résolus ne
// recoupent pas ceux de l'origine par défaut (pré-remplie côté serveur) — condition requise par le
// formulaire (from != to), sans jamais coder en dur un nom de ville qui pourrait ne pas exister
// selon la locale ou une future évolution des données.
function pickDestinationLabel(labels, originIds) {
  const originSet = new Set(originIds);
  for (const rawLabel of Object.keys(labels.airMap || {})) {
    const { ids } = resolveEndpointFrom(labels, rawLabel);
    if (ids.length && !ids.some((id) => originSet.has(id))) return rawLabel;
  }
  throw new Error("no destination candidate found that differs from the default origin");
}

// Le bundle hissé importe un module partagé, en plus de l'import "nu" habituel : `attachCombobox`
// (autocomplete accent-insensible, `../lib/combobox`). Contrairement à test-fiche-harness.cjs (un
// seul import "nu"), on ne peut pas se contenter de retirer la ligne : le binding importé (renommé
// par la minification, ex. `te`) est appelé plus loin dans le script. On le remplace par un stub
// no-op portant le MÊME nom local — l'autocomplete n'entre pas dans le périmètre de ce test (les
// champs sont renseignés directement via `.value`, jamais via le menu déroulant).
/**
 * Les imports du bundle sont neutralisés par des stubs — sauf ceux dont le harnais peut charger
 * le VRAI module depuis `dist`. Le stub muet suffisait tant que les modules importés n'étaient
 * que des utilitaires interactifs (combobox) ; il ne suffit plus depuis que le Finder calcule
 * ses bornes de date via un module partagé : `travelDateBoundsClient()` renvoyait `undefined` et
 * la page tombait au chargement, sans que le harnais ne l'attribue à autre chose qu'un stub.
 *
 * `dir` est le répertoire des chunks, pour résoudre les chemins relatifs.
 */
function stripImports(script, dir) {
  let out = script.replace(/import\s*\{([^}]*)\}\s*from\s*"([^"]*)";?/g, (_, bindings, from) => {
    // Chunk local et lisible → on l'inline vraiment, en réexposant ses exports sous les noms
    // attendus par l'appelant. C'est le seul moyen de tester le code tel qu'il s'exécute.
    // Liste explicite : seuls les modules dont le bundle a besoin AU CHARGEMENT sont inlinés.
    // Les autres (combobox…) restent des stubs muets — ils ne servent qu'à l'interaction, et les
    // inliner ferait entrer leurs propres dépendances dans le bac à sable.
    const INLINE_REAL = ["travel-date-bounds"];
    const real = dir && /^\.\//.test(from) && INLINE_REAL.some((n) => from.includes(n))
      ? path.join(dir, from.slice(2)) : null;
    if (real && fs.existsSync(real)) {
      const raw = fs.readFileSync(real, "utf8");
      // La clause `export{s as t}` fait correspondre un nom LOCAL (`s`) à un nom EXPORTÉ (`t`).
      // L'appelant importe le nom exporté ; il faut donc traduire, sans quoi on référence un
      // identifiant qui n'existe pas dans le chunk.
      const expMatch = raw.match(/\bexport\s*\{([^}]*)\};?\s*$/m);
      const localOf = {};
      if (expMatch) for (const e of expMatch[1].split(",")) {
        const [loc, exp] = e.trim().split(/\s+as\s+/).map((x) => x.trim());
        localOf[exp || loc] = loc;
      }
      const mod = raw.replace(/\bexport\s*\{[^}]*\};?\s*$/m, "");
      // Le chunk est inliné dans un BLOC : ses identifiants minifiés (`m`, `t`…) entreraient
      // sinon en collision avec ceux du bundle appelant, qui sont tirés du même alphabet.
      const pairs = bindings.split(",").map((b) => {
        const [orig, alias] = b.trim().split(/\s+as\s+/).map((x) => x.trim());
        return { orig, alias: alias || orig };
      });
      const decl = pairs.map((x) => `let __mdcf_${x.alias};`).join(" ");
      const assign = pairs.map((x) => `__mdcf_${x.alias} = ${localOf[x.orig] || x.orig};`).join(" ");
      const expose = pairs.map((x) => `const ${x.alias} = __mdcf_${x.alias};`).join(" ");
      return `${decl}\n{\n${mod}\n${assign}\n}\n${expose}\n`;
    }
    const names = bindings.split(",").map((b) => {
      const parts = b.trim().split(/\s+as\s+/);
      return (parts[1] || parts[0]).trim();
    }).filter(Boolean);
    return names.map((n) => `const ${n} = () => {};`).join(" ");
  });
  out = out.replace(/import\s*"[^"]*";?/g, "");
  out = out.replace(/\bexport\s*\{\s*\};?\s*$/m, "");
  return out;
}

// `fetchMock` DOIT être posé avant d'évaluer le bundle du Finder : celui-ci lance, à son
// évaluation même (IIFE de géolocalisation), un premier `fetch(.../nearest-airport)` — le poser
// après aurait laissé ce tout premier appel filer vers le `fetch` global réel (indisponible/à
// réseau, selon l'environnement) au lieu du mock.
function buildDom(parts, fetchMock) {
  const dom = new JSDOM(
    `<!doctype html><html><body>${parts.sectionHtml}</body></html>`,
    { url: "https://mydogcanfly.com/", runScripts: "outside-only" }
  );
  const { window } = dom;
  window.fetch = fetchMock;

  // Base.astro d'abord : définit window.mdcfQuery, lu sans garde par le Finder (prefill race/dest).
  dom.window.eval(parts.baseScript);

  dom.window.eval(stripImports(parts.clientScript, parts.chunkDir));

  return dom;
}

async function flush(times = 6) {
  for (let i = 0; i < times; i++) await new Promise((r) => setTimeout(r, 10));
}

/** Rend les cartes du Finder à partir d'un rapport DONNÉ, et retourne le DOM obtenu. */
async function rendreCartes(localeDir, rapport) {
  const parts = loadHomeParts(localeDir);
  const fetchMock = async (url, opts) => {
    if (String(url).includes("/nearest-airport")) return { ok: false };
    if (opts && opts.method === "POST") return { ok: true, json: async () => rapport };
    throw new Error("unexpected fetch: " + url);
  };
  const dom = buildDom(parts, fetchMock);
  const { window } = dom;
  const originEl = window.document.getElementById("f-origin");
  const destEl = window.document.getElementById("f-dest");
  const originIds = resolveEndpointFrom(parts.labels, originEl.value).ids;
  destEl.value = pickDestinationLabel(parts.labels, originIds);
  window.document.getElementById("f-weight").value = "8";
  window.document.getElementById("mdcf-finder").dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }));
  await flush();
  return dom;
}

module.exports = { DIST, loadHomeParts, norm, reKey, resolveEndpointFrom, pickDestinationLabel, stripImports, buildDom, flush, rendreCartes };
