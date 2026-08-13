/**
 * Harnais DOM du FINDER DE DESTINATIONS — la surface n'en avait AUCUN, et c'est exactement
 * pourquoi les défauts de la contre-revue P0-C v1 passaient la CI (libellé brachy affirmatif,
 * « 0 compagnie — à confirmer », section mal titrée, « soute » affiché pour un fret demandé).
 *
 *   npm run build:ci && node test-destinations-harness.cjs      (branché dans test:built-ui)
 *
 * Même méthode que les autres harnais : la VRAIE page construite dans jsdom, le formulaire rempli
 * comme un visiteur, la réponse réseau contrôlée (jamais un vrai Worker), et le DOM rendu inspecté
 * par sélecteurs précis. Les fixtures portent le contrat COMPLET de DestinationMatch — un champ
 * manquant ferait échouer le rendu, pas passer le test.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const DIST = path.join(__dirname, "packages/ui/dist");

let failures = 0;
function check(label, cond, detail) {
  if (cond) { console.log("  OK   " + label); }
  else { console.log("  FAIL " + label); if (detail) console.log("         reçu : " + detail); failures++; }
}

function loadParts(dir) {
  const htmlPath = path.join(DIST, dir, "tools", "destinations", "index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const section = html.match(/<section id="dest-finder"[\s\S]*?<\/section>/);
  if (!section) throw new Error("section dest-finder introuvable dans " + htmlPath);
  const baseScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const baseScript = baseScripts.find((s) => s.includes("mdcfQuery") && s.includes("hreflang")) || "";
  const candidates = [...html.matchAll(/<script type="module" src="(\/_astro\/hoisted\.[^"]+\.js)"><\/script>/g)]
    .map((m) => path.join(DIST, m[1]));
  const target = candidates.find((p) => fs.readFileSync(p, "utf8").includes("dfx-form"));
  if (!target) throw new Error("bundle DestinationFinder introuvable");
  const labels = JSON.parse(html.match(/<script type="application\/json" id="dfx-labels"[^>]*>([\s\S]*?)<\/script>/)[1]);
  return { sectionHtml: section[0], baseScript, clientScript: fs.readFileSync(target, "utf8"), labels, chunkDir: path.dirname(target) };
}

/* stripImports : copie du harnais Finder — inline RÉELLEMENT le chunk travel-date-bounds
   (le bundle l'appelle au chargement pour poser min/max du champ date), stubs muets pour le
   reste (combobox). */
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

/**
 * Fixture au contrat COMPLET, COHÉRENTE PAR CONSTRUCTION (contre-revue P0-C v2 : des fixtures
 * écrites à la main portaient `heat_confirmation_required: true` sans aucun statut
 * `confirmation_required` — elles reproduisaient le résultat souhaité au lieu de tester la
 * contradiction, et la masquaient). Ici :
 *   - `heat_confirmation_required` DÉRIVE des statuts — le surcharger est une ERREUR ;
 *   - `estimated_heat_signal` DÉRIVE de la température — idem ;
 *   - les booléens *_ok dérivent des statuts.
 * Une fixture ne peut plus affirmer une chose et son contraire.
 */
function match(over = {}) {
  for (const interdit of ["heat_confirmation_required", "estimated_heat_signal", "cabin_ok", "hold_ok", "cargo_ok"]) {
    if (interdit in over) throw new Error(`fixture incohérente : « ${interdit} » est DÉRIVÉ, pas surchargable`);
  }
  const base = {
    airport_id: "airport_tst", iata: "TST", city: "Testville", country_id: "country_us",
    iso2: "US", country_name: "United States", region: "North America",
    temperature_c: 24, climate_estimated: true,
    heat_embargo: false, heat_risk: false,
    airlines_total: 1, airlines_to_confirm_total: 0,
    cabin_status: "allowed", hold_status: "denied", cargo_status: "denied",
    placement_ok: true, placement_to_confirm: false,
    entry_allowed: true, flight_hours: 8,
    ...over,
  };
  const sts = [base.cabin_status, base.hold_status, base.cargo_status];
  return {
    ...base,
    cabin_ok: base.cabin_status === "allowed",
    hold_ok: base.hold_status === "allowed",
    cargo_ok: base.cargo_status === "allowed",
    heat_confirmation_required: sts.includes("confirmation_required"),
    estimated_heat_signal: base.climate_estimated && base.temperature_c > 30,
  };
}

async function run(parts, { matches, breedKey, placement }) {
  const posts = [];
  const fetchMock = async (url, opts) => {
    if (opts && opts.method === "POST") {
      posts.push(JSON.parse(opts.body));
      return { ok: true, json: async () => ({ matches, candidates_total: matches.length }) };
    }
    return { ok: false };
  };
  const dom = new JSDOM(`<!doctype html><html><body>${parts.sectionHtml}</body></html>`,
    { url: "https://mydogcanfly.com/tools/destinations/", runScripts: "outside-only" });
  const { window } = dom;
  window.fetch = fetchMock;
  window.Element.prototype.scrollIntoView = () => {};
  if (parts.baseScript) window.eval(parts.baseScript);
  window.eval(stripImports(parts.clientScript, parts.chunkDir));
  const doc = window.document;
  doc.getElementById("dfx-origin").value = Object.keys(parts.labels.airMap)[0];
  doc.getElementById("dfx-breed").value = breedKey;
  // Le placement est posé APRÈS la race : un « change » sur la race le déduirait et l'écraserait.
  doc.getElementById("dfx-placement").value = placement;
  doc.getElementById("dfx-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await new Promise((r) => setTimeout(r, 40));
  return { doc, posts, texte: (doc.getElementById("dfx-result")?.textContent || "").replace(/\s+/g, " ").trim() };
}

async function main() {
  const parts = loadParts("");
  const S = JSON.parse(fs.readFileSync(path.join(DIST, "tools/destinations/index.html"), "utf8")
    .match(/<script type="application\/json" id="dfx-labels"[^>]*>([\s\S]*?)<\/script>/)[1]).s;
  const breeds = parts.labels.breeds;
  const normalBreed = Object.keys(breeds).find((k) => !breeds[k].br);
  const brachyBreed = Object.keys(breeds).find((k) => breeds[k]?.id === "breed_pug") ?? Object.keys(breeds).find((k) => breeds[k].br);

  console.log("=== 1. Destination entièrement « à confirmer » : sa PROPRE section, jamais compatible ===");
  {
    const m = match({
      city: "Miami", iata: "MIA", temperature_c: 34,
      airlines_total: 0, airlines_to_confirm_total: 2,
      cabin_status: "denied", hold_status: "confirmation_required", cargo_status: "confirmation_required",
      placement_ok: false, placement_to_confirm: true,
    });
    const r = await run(parts, { matches: [m], breedKey: normalBreed, placement: "any" });
    check("la section « à confirmer » existe (#dfx-toconfirm)", !!r.doc.getElementById("dfx-toconfirm"));
    check("son titre est le libellé dédié, pas « autre placement »",
      r.doc.getElementById("dfx-toconfirm-title")?.textContent.trim() === S.toConfirmSectionTitle,
      JSON.stringify(r.doc.getElementById("dfx-toconfirm-title")?.textContent));
    check("la carte est DANS cette section", !!r.doc.querySelector("#dfx-toconfirm .dfx-card"));
    check("aucune section « Meilleures villes » (rien de compatible)", !r.texte.includes(S.topTitle));
    check("le compte affiché est 2 (airlines_to_confirm_total), jamais 0",
      r.texte.includes(`2 `) && !/\b0\s/.test(r.doc.querySelector("#dfx-toconfirm .dfx-card")?.textContent ?? "0 "),
      r.doc.querySelector("#dfx-toconfirm .dfx-card")?.textContent.slice(0, 140));
    check("le libellé « à confirmer » est présent", r.texte.includes(S.plToConfirm));
  }

  console.log("\n=== 2. Chihuahua + soute : compagnie réelle en cabine, soute à confirmer — jamais « 0 compagnie » ===");
  {
    const m = match({
      city: "Lisbonne", iata: "LIS", temperature_c: 31,
      airlines_total: 1, airlines_to_confirm_total: 0,
      cabin_status: "allowed", hold_status: "confirmation_required", cargo_status: "denied",
      placement_ok: false, placement_to_confirm: true,
    });
    const r = await run(parts, { matches: [m], breedKey: normalBreed, placement: "hold" });
    check("le placement demandé est bien parti en POST", r.posts[0]?.placement === "hold", JSON.stringify(r.posts[0]?.placement));
    const carte = r.doc.querySelector(".dfx-card")?.textContent.replace(/\s+/g, " ") ?? "";
    check("la carte va dans la section À CONFIRMER (v3 — le placement demandé est à confirmer)",
      !!r.doc.querySelector("#dfx-toconfirm .dfx-card") && !r.texte.includes(S.altSectionTitle),
      r.texte.slice(0, 160));
    check("AUCUN « 0 » : le compte affiché est celui des compagnies réelles (1)",
      !/\b0\s/.test(carte) && carte.includes("1 "), carte.slice(0, 140));
    check("la carte nomme le statut à confirmer ET le canal réellement disponible (cabine)",
      carte.includes(S.plToConfirm) && carte.includes(S.plCabin), carte.slice(0, 180));
  }

  console.log("\n=== 3. Brachycéphale, cas RÉEL (contre-revue v2) : canaux REFUSÉS + chaleur estimée → signal, jamais « à confirmer » ===");
  {
    /* Le carlin d'Athènes : soute et fret `denied` par les règles de race, cabine ouverte,
       31 °C estimés. La v2 affichait « soute/fret à confirmer » — un conseil que le moteur
       contredisait. La fixture est désormais EXACTEMENT la sortie réelle du moteur (vérifiée par
       l'invariant de test-tristate-climat.mjs §8). */
    const m = match({
      city: "Athènes", iata: "ATH", temperature_c: 31,
      cabin_status: "allowed", hold_status: "denied", cargo_status: "denied",
      placement_ok: true,
    });
    const r = await run(parts, { matches: [m], breedKey: brachyBreed, placement: "any" });
    check("le libellé est le SIGNAL de sensibilité, pas « à confirmer »",
      r.texte.includes(S.climHeatSignalBrachy), r.texte.slice(0, 220));
    check("« à confirmer » n'apparaît PAS (rien n'est à confirmer : tout est refusé)",
      !r.texte.includes(S.climToConfirmBrachy) && !r.texte.includes(S.plToConfirm), r.texte.slice(0, 220));
    check("« Too hot »/« Trop chaud » ont disparu",
      !/too hot|trop chaud|demasiado calor/i.test(r.texte));
  }
  console.log("\n=== 3 bis. Brachycéphale avec confirmation RÉELLE (cas futur, post P0-B) ===");
  {
    const m = match({
      city: "Athènes", iata: "ATH", temperature_c: 31,
      cabin_status: "allowed", hold_status: "confirmation_required", cargo_status: "denied",
      placement_ok: true,
    });
    const r = await run(parts, { matches: [m], breedKey: brachyBreed, placement: "any" });
    check("avec une confirmation réelle dans les statuts, le libellé « à confirmer » brachy est licite",
      r.texte.includes(S.climToConfirmBrachy), r.texte.slice(0, 220));
  }
  console.log("\n=== 3 ter. Alternatives : le titre « autre placement » ne reçoit QUE son cas ===");
  {
    // Canal demandé REFUSÉ (pas à confirmer), cabine réellement ouverte → alternatives, pas « à confirmer ».
    const m = match({
      city: "Berlin", iata: "BER",
      cabin_status: "allowed", hold_status: "denied", cargo_status: "denied",
      placement_ok: false, placement_to_confirm: false,
    });
    const r = await run(parts, { matches: [m], breedKey: normalBreed, placement: "hold" });
    check("carte sous « Alternatives avec un autre placement », aucune section « à confirmer »",
      r.texte.includes(S.altSectionTitle) && !r.doc.getElementById("dfx-toconfirm"), r.texte.slice(0, 160));
  }

  console.log("\n=== 4. Fret demandé : le message parle de FRET, jamais de soute ===");
  {
    const m = match({ placement_ok: false, placement_to_confirm: false, cabin_status: "allowed" });
    const r = await run(parts, { matches: [m], breedKey: normalBreed, placement: "cargo" });
    check("le mot du message vide est celui du fret", r.texte.includes(S.plCargo),
      r.texte.slice(0, 160));
    check("le mot « soute » du placement demandé n'apparaît pas à sa place",
      !r.texte.includes(`"${S.plHold}"`), r.texte.slice(0, 160));
  }

  console.log("\n=== 5. Estimation sans signal : libellé neutre, jamais « Confortable » ===");
  {
    const m = match({ temperature_c: 22 });
    const r = await run(parts, { matches: [m], breedKey: normalBreed, placement: "any" });
    check("libellé neutre « aucun signal » présent", r.texte.includes(S.climNoSignal), r.texte.slice(0, 160));
    check("« Comfortable »/« Confortable » a disparu", !/comfortable|confortable|cómodo/i.test(r.texte));
  }

  console.log("\n=== 6. Langue témoin (fr) : mêmes règles, libellés traduits ===");
  {
    const partsFr = loadParts("fr");
    const Sfr = partsFr.labels.s;
    const m = match({
      airlines_total: 0, airlines_to_confirm_total: 1, cabin_status: "denied",
      hold_status: "confirmation_required", placement_ok: false, placement_to_confirm: true,
      temperature_c: 33,
    });
    const breedsFr = partsFr.labels.breeds;
    const r = await run(partsFr, { matches: [m], breedKey: Object.keys(breedsFr).find((k) => !breedsFr[k].br), placement: "any" });
    check("fr : section « à confirmer » titrée en français",
      r.doc.getElementById("dfx-toconfirm-title")?.textContent.trim() === Sfr.toConfirmSectionTitle,
      JSON.stringify(r.doc.getElementById("dfx-toconfirm-title")?.textContent));
    check("fr : aucun libellé anglais résiduel dans la carte",
      !/(to confirm with the airline|no heat signal)/i.test(r.doc.querySelector("#dfx-toconfirm .dfx-card")?.textContent ?? ""));
  }
}

main().then(() => {
  console.log("\n=== SUMMARY ===");
  console.log(failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
}).catch((e) => {
  console.log("  FAIL uncaught: " + (e.stack || e.message));
  console.log("\n=== SUMMARY ===");
  console.log((failures + 1) + " CHECK(S) FAILED");
  process.exit(1);
});
