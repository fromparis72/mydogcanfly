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

/* Libellés ATTENDUS, en toutes lettres et par langue. Vérifier seulement que deux libellés
 * « diffèrent » (première version de ce test, 11/08/2026) était trop faible : une régression de
 * traduction, une clé manquante retombant sur l'anglais, ou une inversion entre deux langues
 * seraient toutes passées. On fige donc les textes ; s'ils changent, c'est une décision éditoriale
 * qui doit se voir ici. Doivent rester alignés sur packages/knowledge/translations/<loc>/strings.json. */
const EXPECTED = {
  en: { direct: "✈ Direct", assumed: "? Direct — unverified", conn: "✈ Connection", unver: "? Itinerary to confirm" },
  fr: { direct: "✈ Direct", assumed: "? Direct non vérifié", conn: "✈ Correspondance", unver: "? Itinéraire à confirmer" },
  es: { direct: "✈ Directo", assumed: "? Directo sin verificar", conn: "✈ Con escala", unver: "? Itinerario por confirmar" },
  pt: { direct: "✈ Direto", assumed: "? Direto não verificado", conn: "✈ Conexão", unver: "? Itinerário a confirmar" },
};
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

let failures = 0;
function check(label, cond, detail) {
  if (cond) { console.log("  OK   " + label); }
  else { console.log("  FAIL " + label); if (detail) console.log("         reçu : " + detail); failures++; }
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


/* T0-A (contre-revue v1, P0-3) : les libellés VISIBLES par famille de cause, la classe de base
 * `acard--confirm` et le modificateur `acard--heat` réservé au climat — dans les quatre langues,
 * avec les TEXTES EXACTS. */
const T0A_LABELS = {
  en: { policy: "Airline policy to confirm before booking", missing: "Additional information needed — confirm with the airline" },
  fr: { policy: "Politique de la compagnie à confirmer avant de réserver", missing: "Information supplémentaire nécessaire — confirme auprès de la compagnie" },
  es: { policy: "Política de la aerolínea a confirmar antes de reservar", missing: "Se necesita información adicional: confirma con la aerolínea" },
  pt: { policy: "Política da companhia a confirmar antes de reservar", missing: "Informação adicional necessária — confirma com a companhia" },
};
const t0aCard = (over) => ({
  ...FAKE_REPORT.airlines[0], airline_id: "airline_t0a", name: "T0A Air",
  cabin: false, hold: false, cargo: false,
  cabin_status: "denied", hold_status: "denied", cargo_status: "confirmation_required",
  to_confirm: ["cargo"], carries_pets: true, offers_pet_transport: true,
  heat_confirmation_required: false,
  placement_decisions: [
    { placement: "cabin", status: "denied", allowed: false },
    { placement: "hold", status: "denied", allowed: false },
    { placement: "cargo", status: "confirmation_required", allowed: false,
      confirmation_causes: [{ code: "policy_unpublished", policy_ref: "airline_t0a#cargo" }] },
  ],
  ...over,
});
async function t0aPass() {
  for (const loc of BADGE_LOCALES) {
    console.log(`\n— T0-A : causes visibles et styles par cause (${loc.code}) —`);
    const exp = T0A_LABELS[loc.code];
    const scenarios = [
      ["politique seule", t0aCard({}), (card, txt) => {
        check(`${loc.code} : classe de base acard--confirm SANS acard--heat (cause non climatique)`,
          card.className.includes("acard--confirm") && !card.className.includes("acard--heat"), card.className);
        check(`${loc.code} : ligne « politique » EXACTE : ${JSON.stringify(exp.policy)}`,
          txt.includes(exp.policy), txt.slice(0, 200));
        check(`${loc.code} : aucune ligne « information manquante »`, !txt.includes(exp.missing));
      }],
      ["fait manquant", t0aCard({
        placement_decisions: [
          { placement: "cabin", status: "denied", allowed: false },
          { placement: "hold", status: "denied", allowed: false },
          { placement: "cargo", status: "confirmation_required", allowed: false,
            confirmation_causes: [{ code: "missing_fact", fact: "transport.total_weight_kg", requirement_ref: "req_x" }] },
        ],
      }), (card, txt) => {
        check(`${loc.code} : ligne « information manquante » EXACTE`, txt.includes(exp.missing), txt.slice(0, 200));
        check(`${loc.code} : pas d'habit climatique`, !card.className.includes("acard--heat"));
      }],
      ["climat seul", t0aCard({
        heat_confirmation_required: true,
        placement_decisions: [
          { placement: "cabin", status: "denied", allowed: false },
          { placement: "hold", status: "denied", allowed: false },
          { placement: "cargo", status: "confirmation_required", allowed: false,
            confirmation_causes: [{ code: "estimated_climate", rule_id: "rule_tst" }] },
        ],
      }), (card, txt) => {
        check(`${loc.code} : climat = base confirm + modificateur heat`,
          card.className.includes("acard--confirm") && card.className.includes("acard--heat"), card.className);
        check(`${loc.code} : AUCUNE ligne de cause politique (le climat a son bandeau, pas de doublon)`,
          !txt.includes(exp.policy) && !txt.includes(exp.missing));
      }],
    ];
    for (const [nom, card0, asserts] of scenarios) {
      let dom;
      try {
        const parts = loadHomeParts(loc.dir);
        const rep = { ...FAKE_REPORT, airlines: [card0] };
        const fetchMock = async (url, opts) => {
          if (String(url).includes("/nearest-airport")) return { ok: false };
          if (opts && opts.method === "POST") return { ok: true, json: async () => rep };
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
          new window.Event("submit", { bubbles: true, cancelable: true }));
        await flush();
      } catch (e) {
        check(`${loc.code} ${nom} : rendu`, false, e.message || String(e));
        continue;
      }
      const card = dom.window.document.querySelector(".acard");
      if (!card) { check(`${loc.code} ${nom} : une carte est rendue`, false); continue; }
      const txt = card.textContent.replace(/\s+/g, " ");
      const badge = [...card.querySelectorAll(".ab--confirm")].length;
      check(`${loc.code} ${nom} : badge « ? » sur le canal à confirmer`, badge === 1, String(badge));
      asserts(card, txt);
    }
  }
}


/* P1 texte chaleur (14/08/2026) : la phrase `heatToolWhy` ne doit plus AFFIRMER une suspension
 * universelle. Contrôle sur les VRAIES pages construites (le défaut portugais est un défaut de
 * résolution au build — un rg dans les sources ne l'attraperait pas) : égalité EXACTE dans les
 * quatre langues, portugais réellement portugais (jamais le repli anglais), anciennes
 * formulations absolues absentes, lien vers l'outil chaleur conservé. */
const HEATWHY_EXPECTED = {
  en: "Check the expected temperature at departure and arrival for your travel date: some airlines may restrict or suspend hold or cargo transport in hot weather. Confirm the applicable policy before booking.",
  fr: "Vérifie la température prévue au départ et à l'arrivée pour ta date de voyage : certaines compagnies peuvent limiter ou suspendre le transport en soute ou en fret par forte chaleur. Confirme la règle applicable avant de réserver.",
  es: "Comprueba la temperatura prevista en la salida y la llegada para tu fecha de viaje: algunas aerolíneas pueden limitar o suspender el transporte en bodega o como carga cuando hace mucho calor. Confirma la política aplicable antes de reservar.",
  pt: "Verifique a temperatura prevista na partida e na chegada para a data da viagem: algumas companhias podem limitar ou suspender o transporte no porão ou como carga em caso de calor intenso. Confirme a política aplicável antes de reservar.",
};
const HEATWHY_FORBIDDEN = /are suspended above|sont suspendus au-delà|se suspenden por encima|são suspensos acima/i;
async function heatWhyPass() {
  for (const loc of BADGE_LOCALES) {
    console.log(`\n— P1 texte chaleur (${loc.code}) —`);
    const parts = loadHomeParts(loc.dir);
    const got = parts.labels.heatToolWhy;
    check(`${loc.code} : heatToolWhy EXACT`, got === HEATWHY_EXPECTED[loc.code], JSON.stringify(got));
    check(`${loc.code} : aucune formulation absolue résiduelle`, !HEATWHY_FORBIDDEN.test(got || ""));
    if (loc.code === "pt") {
      check("pt : réellement portugais, jamais le repli anglais", got !== HEATWHY_EXPECTED.en && /Verifique/.test(got || ""));
    }
    /* Contre-revue v1 : la présence de l'URL dans le JSON de config ne prouvait rien — on
       prouve le RENDU : après une vraie soumission, le <li> « outils complémentaires » porte
       le lien réel vers l'outil chaleur ET la phrase exacte à côté. */
    let dom;
    try {
      const fetchMock = async (url, opts) => {
        if (String(url).includes("/nearest-airport")) return { ok: false };
        /* Le bloc « outils complémentaires » n'est rendu qu'avec un partenaire equipment
           (la caisse) — le rapport de fixture le porte, comme un vrai rapport. */
        const rep = { ...FAKE_REPORT, partners: [{ partner_id: "p_crates", vertical: "equipment", name: "IATA Pet Crates", url: "", sponsored: false, reason: "Hold travel requires an IATA-compliant crate." }] };
        if (opts && opts.method === "POST") return { ok: true, json: async () => rep };
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
        new window.Event("submit", { bubbles: true, cancelable: true }));
      await flush();
      /* P1-bis (contre-validation preview) : le contrôle v2 vérifiait la présence du lien,
         pas son TEXTE — « Heat risk calculator » restait anglais en pt. Désormais : texte
         EXACT du lien, chemin EXACT par langue, et UNICITÉ. */
      const links = [...dom.window.document.querySelectorAll("li a")].filter((a) => /tools\/heat\//.test(a.getAttribute("href") || ""));
      const link = links[0];
      check(`${loc.code} : le lien outil chaleur est rendu et UNIQUE`, links.length === 1, `${links.length} lien(s)`);
      const HEATNAME = { en: "Heat risk calculator", fr: "Calculateur de risque chaleur", es: "Calculadora de riesgo de calor", pt: "Calculadora de risco de calor" };
      check(`${loc.code} : TEXTE du lien exact = ${JSON.stringify(HEATNAME[loc.code])}`,
        !!link && link.textContent.trim() === HEATNAME[loc.code], JSON.stringify(link?.textContent.trim()));
      const expPath = loc.dir ? `/${loc.dir.replace(/\/+$/, "")}/tools/heat/` : "/tools/heat/";
      check(`${loc.code} : CHEMIN du lien exact = ${expPath}`,
        !!link && (link.getAttribute("href") || "").split("#")[0] === expPath,
        JSON.stringify(link?.getAttribute("href")));
      check(`${loc.code} : la phrase prudente est RENDUE à côté du lien`,
        !!link && (link.closest("li")?.textContent || "").includes(HEATWHY_EXPECTED[loc.code]),
        (link ? link.closest("li")?.textContent.slice(0, 160) : ""));
    } catch (e) {
      check(`${loc.code} : rendu du bloc outils`, false, e.message || String(e));
    }
  }
}

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

    const exp = EXPECTED[loc.code];
    const [docTxt, assumedTxt, unverTxt] = statuses;
    const assumedCard = cards[1];
    const unverCard = cards[2];

    // Textes EXACTS, pas seulement « différents ».
    check(`${loc.code} : direct attesté = ${JSON.stringify(exp.direct)}`,
      docTxt.length === 1 && docTxt[0] === exp.direct, JSON.stringify(docTxt));
    check(`${loc.code} : direct supposé = ${JSON.stringify(exp.assumed)}, en UN seul badge`,
      assumedTxt.length === 1 && assumedTxt[0] === exp.assumed, JSON.stringify(assumedTxt));

    /* La correspondance non vérifiée porte DEUX badges, et c'est voulu : la nature de l'itinéraire
     * (« Correspondance ») et sa fiabilité (« Itinéraire à confirmer ») sont deux informations
     * distinctes. Le direct supposé, lui, tient en un seul badge parce que « Direct non vérifié »
     * dit déjà les deux. On vérifie donc les deux formes, pas seulement l'une. */
    check(`${loc.code} : correspondance non vérifiée = 2 badges [${JSON.stringify(exp.conn)}, ${JSON.stringify(exp.unver)}]`,
      unverTxt.length === 2 && unverTxt[0].startsWith(exp.conn) && unverTxt[1] === exp.unver,
      JSON.stringify(unverTxt));

    check(`${loc.code} : la carte du direct supposé est marquée non vérifiée`,
      assumedCard.className.includes("acard--unverified"));
    check(`${loc.code} : la carte de la correspondance non vérifiée l'est aussi`,
      unverCard.className.includes("acard--unverified"));
    check(`${loc.code} : la carte du direct attesté ne l'est PAS`,
      !cards[0].className.includes("acard--unverified"));

    const cap = doc.querySelector(".acap");
    const capCount = cap ? (cap.textContent.match(/\d+/) || [])[0] : null;
    check(`${loc.code} : le compteur « directs » annonce 1 (le direct attesté), pas 2`,
      capCount === "1", `compteur lu : ${cap ? cap.textContent.replace(/\s+/g, " ").trim() : "(absent)"}`);
  }
}

/**
 * CONTRAT DE DATE — quatre exigences, vérifiées sur la VRAIE page construite.
 *
 * 1. Le champ porte `min`/`max`, posés à l'exécution depuis le contrat partagé.
 * 2. Une date hors contrat ARRÊTE la soumission : zéro POST, message visible, zéro résultat.
 * 3. Les deux bornes elles-mêmes sont acceptées (une exclusion de borne fermerait un jour valide).
 * 4. La date acceptée part au moteur SANS MODIFICATION — c'est le point le plus important.
 *
 * Défaut relevé le 12/08/2026 : la garde retirait silencieusement la date hors contrat, et le
 * POST partait sans elle. Le visiteur recevait un rapport calculé SANS sa date en croyant qu'il
 * portait dessus — plus dangereux que le 400 que la garde voulait éviter. C'est le contrôle
 * « corps du POST » ci-dessous qui interdit à cette forme de revenir : compter les POST ne
 * suffisait pas, puisque le POST fautif partait bel et bien.
 */

// Message attendu, en toutes lettres (locale en) — aligné sur `L.dateOutOfRange` de
// FlightFinder.astro. Figé ici pour la même raison que les badges : vérifier qu'« un message
// s'affiche » laisserait passer un message vide de sens ou celui d'une autre garde.
const DATE_MSG_EN = "Choose a date between today and 18 months from now.";

/** Bornes attendues, recalculées ICI de façon indépendante (jamais importées du code testé). */
function expectedBounds(now = new Date()) {
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
  const iso = (dt) => dt.toISOString().slice(0, 10);
  const lastDay = new Date(Date.UTC(y, m + 19, 0)).getUTCDate();
  return { min: iso(new Date(Date.UTC(y, m, d))), max: iso(new Date(Date.UTC(y, m + 18, Math.min(d, lastDay)))) };
}
/** Décale une date ISO de n jours, en UTC. */
function shiftIso(isoStr, days) {
  const [y, m, d] = isoStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Joue un visiteur qui remplit le formulaire avec `dateValue`, soumet, et rend compte de ce que
 * le réseau a vu. Un DOM NEUF par scénario : réutiliser le précédent laisserait un rapport déjà
 * rendu dans `#mdcf-finder-result` et rendrait le contrôle « zéro résultat » complaisant.
 */
async function runDateScenario(parts, dateValue) {
  const posts = [];
  const fetchMock = async (url, opts) => {
    if (String(url).includes("/nearest-airport")) return { ok: false };
    if (opts && opts.method === "POST") {
      posts.push({ url: String(url), body: JSON.parse(opts.body) });
      return { ok: true, json: async () => FAKE_REPORT };
    }
    throw new Error("unexpected fetch: " + url);
  };
  const dom = buildDom(parts, fetchMock);
  const { window } = dom;
  const doc = window.document;

  const originEl = doc.getElementById("f-origin");
  const originIds = resolveEndpointFrom(parts.labels, originEl.value).ids;
  doc.getElementById("f-dest").value = pickDestinationLabel(parts.labels, originIds);
  doc.getElementById("f-weight").value = "8";
  // Saisie AU CLAVIER : `min`/`max` ne bloquent pas l'affectation directe de `.value`, ce qui est
  // exactement la situation que la garde doit couvrir.
  doc.getElementById("f-date").value = dateValue;

  doc.getElementById("mdcf-finder").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await flush();

  const out = doc.getElementById("mdcf-finder-result");
  return {
    posts,
    dom,
    text: (out?.textContent || "").replace(/\s+/g, " ").trim(),
    cards: out ? out.querySelectorAll(".acard").length : 0,
  };
}

async function datePass() {
  console.log("\n=== contrat de date : bornes du champ, arrêt de la soumission, transmission ===");
  const parts = loadHomeParts("");
  const exp = expectedBounds();

  // -- 1. Les bornes sont posées sur le champ --
  {
    const dom = buildDom(parts, async (url) => (String(url).includes("/nearest-airport") ? { ok: false } : { ok: false }));
    const dateEl = dom.window.document.getElementById("f-date");
    check("le champ de date existe et porte min et max", !!dateEl && !!dateEl.min && !!dateEl.max,
      dateEl ? `min=${dateEl.min} max=${dateEl.max}` : "(champ absent)");
    check(`min = aujourd'hui (${exp.min}) et max = +18 mois (${exp.max}), sans débordement de fin de mois`,
      !!dateEl && dateEl.min === exp.min && dateEl.max === exp.max,
      dateEl ? `obtenu ${dateEl.min}..${dateEl.max}` : "");
  }

  // -- 2. Les deux bornes sont ACCEPTÉES, et transmises telles quelles --
  for (const [nom, valeur] of [["min", exp.min], ["max", exp.max]]) {
    const r = await runDateScenario(parts, valeur);
    check(`${nom} (${valeur}) : la recherche part (1 POST)`, r.posts.length === 1, `POST : ${r.posts.length}`);
    check(`${nom} (${valeur}) : la date est transmise SANS MODIFICATION`,
      r.posts.length === 1 && r.posts[0].body.date === valeur,
      r.posts.length ? `date envoyée : ${JSON.stringify(r.posts[0].body.date)}` : "(aucun POST)");
    check(`${nom} (${valeur}) : le rapport est rendu`, r.cards >= 1, `cartes : ${r.cards}`);
  }

  // -- 3. Hors contrat des DEUX côtés : zéro POST, message visible, zéro résultat --
  for (const [nom, valeur] of [
    ["min − 1 jour", shiftIso(exp.min, -1)],
    ["max + 1 jour", shiftIso(exp.max, 1)],
    ["date lointaine", "2999-12-31"],
    ["date passée", "2020-01-01"],
  ]) {
    const r = await runDateScenario(parts, valeur);
    check(`${nom} (${valeur}) : AUCUN POST`, r.posts.length === 0,
      r.posts.length ? `date partie quand même : ${JSON.stringify(r.posts[0].body.date)}` : "");
    check(`${nom} (${valeur}) : le message exact est affiché`, r.text === DATE_MSG_EN, JSON.stringify(r.text.slice(0, 120)));
    check(`${nom} (${valeur}) : aucun rapport n'est rendu`, r.cards === 0, `cartes : ${r.cards}`);
  }

  // -- 4. Champ vide : la date est facultative, la recherche part sans elle --
  {
    const r = await runDateScenario(parts, "");
    check("date vide : la recherche part (la date reste facultative)", r.posts.length === 1, `POST : ${r.posts.length}`);
    check("date vide : aucune clé `date` n'est inventée dans la requête",
      r.posts.length === 1 && r.posts[0].body.date === undefined,
      r.posts.length ? `date envoyée : ${JSON.stringify(r.posts[0].body.date)}` : "(aucun POST)");
  }
}

/**
 * CONTRAT DE DATE, SECOND COMPOSANT — le Finder de destinations.
 *
 * Codex, 13/08/2026 : « le contrat de date est bien testé dans le Worker et dans le Finder
 * principal, mais pas dans le DOM du Finder de destinations alors que ce composant est également
 * modifié ». Exact : les deux composants partagent désormais `travelDateBoundsClient()`, et un
 * seul des deux était sous contre-épreuve. Un module partagé ne garantit pas deux usages corrects
 * — `DestinationFinder` calculait encore `min` de son côté et validait contre une borne posée au
 * chargement.
 */
function loadDestinationsParts() {
  const htmlPath = path.join(DIST, "tools", "destinations", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  const section = html.match(/<section id="dest-finder"[\s\S]*?<\/section>/);
  if (!section) throw new Error('could not find <section id="dest-finder"> in ' + htmlPath);

  const baseScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const baseScript = baseScripts.find((s) => s.includes("mdcfQuery") && s.includes("hreflang")) || "";

  const candidates = [...html.matchAll(/<script type="module" src="(\/_astro\/hoisted\.[^"]+\.js)"><\/script>/g)]
    .map((m) => path.join(DIST, m[1]));
  const target = candidates.find((p) => fs.readFileSync(p, "utf8").includes("dfx-form"));
  if (!target) throw new Error("could not locate the DestinationFinder bundle among: " + candidates.join(", "));

  const labelsMatch = section[0].match(/<script type="application\/json" id="dfx-labels"[^>]*>([\s\S]*?)<\/script>/);
  if (!labelsMatch) throw new Error("could not find dfx-labels JSON in " + htmlPath);

  return {
    sectionHtml: section[0], baseScript,
    clientScript: fs.readFileSync(target, "utf8"),
    labels: JSON.parse(labelsMatch[1]),
    chunkDir: path.dirname(target),
  };
}

const FAKE_DESTINATIONS = { matches: [], candidates_total: 0 };

async function runDestinationsScenario(parts, dateValue) {
  const posts = [];
  const fetchMock = async (url, opts) => {
    if (opts && opts.method === "POST") {
      posts.push({ url: String(url), body: JSON.parse(opts.body) });
      return { ok: true, json: async () => FAKE_DESTINATIONS };
    }
    return { ok: false };
  };
  const dom = buildDom(parts, fetchMock);
  const { window } = dom;
  const doc = window.document;

  // Origine et race choisies dans les VRAIES données générées, jamais codées en dur.
  doc.getElementById("dfx-origin").value = Object.keys(parts.labels.airMap)[0];
  doc.getElementById("dfx-breed").value = Object.keys(parts.labels.breeds)[0];
  doc.getElementById("dfx-date").value = dateValue;

  doc.getElementById("dfx-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await flush();

  const out = doc.getElementById("dfx-result");
  return { posts, text: (out?.textContent || "").replace(/\s+/g, " ").trim() };
}

async function destinationsDatePass() {
  console.log("\n=== contrat de date : Finder de destinations ===");
  let parts;
  try { parts = loadDestinationsParts(); }
  catch (e) { check("chargement de la page destinations", false, e.message || String(e)); return; }

  const exp = expectedBounds();
  {
    const dom = buildDom(parts, async () => ({ ok: false }));
    const dateEl = dom.window.document.getElementById("dfx-date");
    check(`dfx : min = ${exp.min} et max = ${exp.max}, les DEUX issus du contrat partagé`,
      !!dateEl && dateEl.min === exp.min && dateEl.max === exp.max,
      dateEl ? `obtenu ${dateEl.min}..${dateEl.max}` : "(champ absent)");
  }

  for (const [nom, valeur] of [["min", exp.min], ["max", exp.max]]) {
    const r = await runDestinationsScenario(parts, valeur);
    check(`dfx ${nom} (${valeur}) : la recherche part et la date est transmise SANS MODIFICATION`,
      r.posts.length === 1 && r.posts[0].body.date === valeur,
      r.posts.length ? `date envoyée : ${JSON.stringify(r.posts[0].body.date)}` : "(aucun POST)");
  }

  const S = parts.labels.s || {};
  for (const [nom, valeur, attendu] of [
    ["min − 1 jour", shiftIso(exp.min, -1), S.dateInPast],
    ["max + 1 jour", shiftIso(exp.max, 1), S.dateTooFar],
  ]) {
    const r = await runDestinationsScenario(parts, valeur);
    check(`dfx ${nom} (${valeur}) : AUCUN POST`, r.posts.length === 0,
      r.posts.length ? `date partie quand même : ${JSON.stringify(r.posts[0].body.date)}` : "");
    check(`dfx ${nom} : le message exact est affiché — ${JSON.stringify(attendu)}`,
      !!attendu && r.text === attendu, JSON.stringify(r.text.slice(0, 120)));
  }
}

main().then(() => badgesPass()).then(() => t0aPass()).then(() => heatWhyPass()).then(() => datePass()).then(() => destinationsDatePass()).then(() => {
  console.log("\n=== SUMMARY ===");
  console.log(failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
}).catch((e) => {
  console.log("  FAIL uncaught: " + (e.stack || e.message));
  console.log("\n=== SUMMARY ===");
  console.log((failures + 1) + " CHECK(S) FAILED");
  process.exit(1);
});
