// Test harness for the two FlightFinder.astro P0 fixes from the tour-6 contre-revue Codex
// (10/08/2026) : (1) le lien "voir la fiche" (acard__fiche) recopiait le poids AFFICHÉ (parfois en
// livres) comme si c'était déjà des kilogrammes ; (2) ce même lien relisait race/poids EN DIRECT
// dans le formulaire au moment du rendu plutôt qu'à l'instant du clic "Rechercher" — une recherche
// en vol pouvait donc produire une fiche décrivant un AUTRE chien que celui réellement recherché.
//
// Comme test-fiche-harness.cjs : on charge le VRAI HTML construit (page d'accueil, qui embarque
// <FlightFinder />), le VRAI bundle hissé du composant, et le script is:inline de Base.astro (qui
// définit window.mdcfQuery, lu sans garde par le composant). On simule un visiteur (remplit le
// formulaire, soumet), on contrôle nous-mêmes la réponse réseau (mockée, jamais un vrai Worker), et
// on inspecte le lien "voir la fiche" généré pour chaque compagnie du rapport.

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const LOCALES = [{ code: "en", dir: "" }];
// Le contrôle des badges d'itinéraire (ajouté 11/08/2026) parcourt les 4 langues : le libellé
// « Direct non vérifié » doit exister et être distinct partout, pas seulement en anglais.
const BADGE_LOCALES = [{ code: "en", dir: "" }, { code: "fr", dir: "fr" }, { code: "es", dir: "es" }, { code: "pt", dir: "pt" }];
// Un seul passage (en) : la logique de snapshot (lastWeightKg/lastBreedLabel/lastBreedId) ne
// dépend d'aucune donnée localisée, seuls les libellés affichés changent — voir la même
// justification dans test-fiche-harness.cjs pour l'invariant compagnies.

const DIST = path.join(__dirname, "packages/ui/dist");

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

  return { sectionHtml: section[0], baseScript, clientScript, labels };
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
function stripImports(script) {
  let out = script.replace(/import\s*\{([^}]*)\}\s*from\s*"[^"]*";?/g, (_, bindings) => {
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

  dom.window.eval(stripImports(parts.clientScript));

  return dom;
}

let failures = 0;
function check(label, cond) {
  if (cond) { console.log("  OK   " + label); } else { console.log("  FAIL " + label); failures++; }
}

const FAKE_REPORT = {
  verdict: "compatible",
  confidence: 3,
  positives: [],
  conditions: [],
  domestic: false,
  score: 80,
  climate: null,
  warnings: [], risks: [], alternatives: [], partners: [],
  airlines: [{
    airline_id: "airline_air_france", name: "Air France",
    direct: true, cabin: true, hold: false, cargo: false,
    label: "OK", source_url: "", carrier_of_origin: false, carrier_of_destination: false,
    itinerary_confidence: "confirmed", heat_embargo: false, fee: "",
  }],
  sources: [],
};

function ficheLinks(dom) {
  return [...dom.window.document.querySelectorAll("a.acard__fiche")].map((a) => {
    const href = a.getAttribute("href") || "";
    const frag = href.split("#")[1] || "";
    return Object.fromEntries(new URLSearchParams(frag).entries());
  });
}

async function flush(times = 6) {
  for (let i = 0; i < times; i++) await new Promise((r) => setTimeout(r, 10));
}

async function main() {
for (const { code, dir } of LOCALES) {
  console.log("\n=== locale: " + code + " ===");
  const parts = loadHomeParts(dir);

  // -- Scénario lb (correction P0 : le poids affiché en livres était recopié tel quel comme kg) --
  console.log("-- unité livres : le lien fiche doit porter le poids converti en kg, jamais la valeur lb brute --");
  {
    const fetchMock = async (url, opts) => {
      if (String(url).includes("/nearest-airport")) return { ok: false };
      if (opts && opts.method === "POST") return { ok: true, json: async () => FAKE_REPORT };
      throw new Error("unexpected fetch: " + url);
    };
    const dom = buildDom(parts, fetchMock);
    const { window } = dom;
    const form = window.document.getElementById("mdcf-finder");
    const originEl = window.document.getElementById("f-origin");
    const destEl = window.document.getElementById("f-dest");
    const weightEl = window.document.getElementById("f-weight");
    const uLb = window.document.getElementById("u-lb");

    const originIds = resolveEndpointFrom(parts.labels, originEl.value).ids;
    const destLabel = pickDestinationLabel(parts.labels, originIds);
    destEl.value = destLabel;

    uLb.dispatchEvent(new window.Event("click", { bubbles: true }));
    const LB_VALUE = "110.2"; // livres, saisi tel quel par un visiteur en unité lb
    weightEl.value = LB_VALUE;

    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await flush();

    const links = ficheLinks(dom);
    const expectedKg = String(+(parseFloat(LB_VALUE) / 2.20462).toFixed(1));
    check("au moins un lien fiche généré", links.length > 0);
    if (links.length) {
      check(`w=${expectedKg} (kg, converti) — jamais w=${LB_VALUE} (lb brut)`,
        links[0].w === expectedKg && links[0].w !== LB_VALUE);
    }
  }

  // -- Scénario course (correction P0 : relecture live du DOM au rendu plutôt que la valeur figée
  //    au lancement de LA recherche) --
  console.log("-- édition du formulaire pendant une requête en vol : la fiche doit décrire le chien recherché, pas le chien édité entre-temps --");
  {
    let pendingResolve = null;
    const fetchMock = async (url, opts) => {
      if (String(url).includes("/nearest-airport")) return { ok: false };
      if (opts && opts.method === "POST") {
        return new Promise((resolve) => { pendingResolve = () => resolve({ ok: true, json: async () => FAKE_REPORT }); });
      }
      throw new Error("unexpected fetch: " + url);
    };
    const dom = buildDom(parts, fetchMock);
    const { window } = dom;
    const form = window.document.getElementById("mdcf-finder");
    const originEl = window.document.getElementById("f-origin");
    const destEl = window.document.getElementById("f-dest");
    const breedEl = window.document.getElementById("f-breed");
    const weightEl = window.document.getElementById("f-weight");

    const originIds = resolveEndpointFrom(parts.labels, originEl.value).ids;
    const destLabel = pickDestinationLabel(parts.labels, originIds);
    destEl.value = destLabel;

    const breedEntries = Object.entries(parts.labels.breedById || {});
    if (breedEntries.length < 2) throw new Error("besoin d'au moins 2 races connues pour ce test");
    const [[origBreedId, origBreedLabel], [, otherBreedLabel]] = breedEntries;
    breedEl.value = origBreedLabel;
    weightEl.value = "40"; // kg, poids AU LANCEMENT de la recherche

    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await flush(2); // laisse buildRequest() s'exécuter et figer lastBreedLabel/lastBreedId/lastWeightKg, avant que la promesse réseau ne se résolve

    // Le visiteur modifie le formulaire PENDANT que la requête est en vol — jamais relancée.
    breedEl.value = otherBreedLabel;
    weightEl.value = "99";

    check("réponse réseau toujours en attente au moment de l'édition (le test simule bien une édition en vol)", !!pendingResolve);
    pendingResolve();
    await flush();

    const links = ficheLinks(dom);
    check("au moins un lien fiche généré", links.length > 0);
    if (links.length) {
      check(`breed="${origBreedLabel}" (figé au lancement) — jamais "${otherBreedLabel}" (édité pendant la requête)`,
        links[0].breed === origBreedLabel);
      check(`bid=${origBreedId} (figé au lancement)`, links[0].bid === origBreedId);
      check("w=40 (figé au lancement) — jamais w=99 (édité pendant la requête)", links[0].w === "40");
    }
  }
}
}


/* ── Badges d'itinéraire : aucun « Direct » non qualifié ────────────────────────────────────
 * Ajouté le 11/08/2026 à la demande de Codex, en accompagnement du correctif P0 « jamais de vol
 * direct sans preuve de route ».
 *
 * Le moteur ne produit plus `direct_assumed` tant que toutes les compagnies ont un graphe de
 * routes — mais l'UI ne doit pas dépendre de cette circonstance. On lui injecte donc un rapport
 * contenant les trois natures d'itinéraire et on vérifie ce qui est RENDU :
 *   - `direct_documented` → « Direct » ;
 *   - `direct_assumed`    → « Direct non vérifié », en UN SEUL badge (jamais « Direct » suivi
 *                            d'un démenti : deux badges contradictoires se lisent mal, et c'est
 *                            le premier que l'œil retient) ;
 *   - `connection_unverified` → « Correspondance » + pastille d'itinéraire à confirmer.
 * Et le compteur « N directs » ne doit additionner que le direct attesté.
 */
const ITINERARY_REPORT = {
  ...FAKE_REPORT,
  airlines: [
    { ...FAKE_REPORT.airlines[0], airline_id: "airline_doc", name: "Doc Air", direct: true, itinerary_confidence: "direct_documented" },
    { ...FAKE_REPORT.airlines[0], airline_id: "airline_assumed", name: "Assumed Air", direct: true, itinerary_confidence: "direct_assumed" },
    { ...FAKE_REPORT.airlines[0], airline_id: "airline_unver", name: "Unver Air", direct: false, itinerary_confidence: "connection_unverified" },
  ],
};

async function badgesPass() {
  for (const loc of BADGE_LOCALES) {
    console.log(`\n— Badges d'itinéraire (${loc.code}) —`);
    let dom;
    try {
      const parts = loadHomeParts(loc.dir);
      const fetchMock = async (url, opts) => {
        if (String(url).includes("/nearest-airport")) return { ok: false };
        if (opts && opts.method === "POST") return { ok: true, json: async () => ITINERARY_REPORT };
        throw new Error("unexpected fetch: " + url);
      };
      dom = buildDom(parts, fetchMock);
      const { window } = dom;
      const originEl = window.document.getElementById("f-origin");
      const destEl = window.document.getElementById("f-dest");
      const originIds = resolveEndpointFrom(parts.labels, originEl.value).ids;
      destEl.value = pickDestinationLabel(parts.labels, originIds);
      window.document.getElementById("f-weight").value = "8";
      window.document.getElementById("mdcf-finder").dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await flush();
    } catch (e) {
      check(`${loc.code} : rendu du rapport`, false);
      console.log("         " + (e.message || e));
      continue;
    }
    const doc = dom.window.document;
    const cards = [...doc.querySelectorAll(".acard")];
    check(`${loc.code} : les 3 compagnies sont rendues`, cards.length === 3);

    const statuses = cards.map((c) => [...c.querySelectorAll(".acard__status")].map((s) => s.textContent.trim()));
    const flat = statuses.flat().join(" | ");

    // Rapport synthétique, affiché même quand tout passe : c'est lui qu'on relit en contre-revue.
    console.log("         badges rendus : " + flat);

    const assumedCard = cards[1];
    const assumedTxt = [...assumedCard.querySelectorAll(".acard__status")].map((s) => s.textContent.trim());
    const docTxt = [...cards[0].querySelectorAll(".acard__status")].map((s) => s.textContent.trim());

    const directLabel = docTxt.find((t) => /✈/.test(t)) || "";
    const assumedLabel = assumedTxt.find((t) => /✈|\?/.test(t)) || "";

    check(`${loc.code} : le direct attesté porte un badge`, directLabel.length > 0);
    check(
      `${loc.code} : le direct supposé NE porte PAS le même libellé que le direct attesté`,
      assumedLabel !== "" && assumedLabel.replace(/^[^\p{L}]+/u, "") !== directLabel.replace(/^[^\p{L}]+/u, ""),
    );
    check(
      `${loc.code} : le direct supposé tient en UN seul badge d'itinéraire`,
      assumedTxt.length === 1,
    );
    check(
      `${loc.code} : la carte du direct supposé est marquée non vérifiée`,
      assumedCard.className.includes("acard--unverified"),
    );

    const cap = doc.querySelector(".acap");
    check(
      `${loc.code} : le compteur « directs » n'additionne que le direct attesté (1, pas 2)`,
      !!cap && /\b1\b/.test(cap.textContent) && !/\b2\b/.test(cap.textContent.split("·")[0]),
    );
  }
}

main().then(() => badgesPass()).then(() => {
  console.log("\n=== SUMMARY ===");
  console.log(failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
}).catch((e) => {
  console.log("  FAIL uncaught: " + (e.stack || e.message));
  console.log("\n=== SUMMARY ===");
  console.log((failures + 1) + " CHECK(S) FAILED");
  process.exit(1);
});
