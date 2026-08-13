/**
 * HARNAIS du calculateur Chaleur — page CONSTRUITE, sélecteurs DOM précis, quatre langues.
 *
 *   npm run build:ci && node test-heat-harness.cjs      (branché dans test:built-ui)
 *
 * Durcissements exigés par la contre-revue du 13/08/2026 :
 *   - sélecteurs DOM PRÉCIS : le niveau est lu dans la classe `hx-b-*` de `.hx-verdict`, le titre
 *     dans `.hx-vtitle`, les températures dans les badges `.hx-leg .hx-b` — jamais par une
 *     recherche de sous-chaîne dans le textContent global ;
 *   - 52 scénarios OBLIGATOIRES : 13 aéroports × 2 mois × {chien non brachycéphale, carlin} ;
 *     un scénario qui ne rend pas de verdict, ou dont le niveau est inconnu, fait ÉCHOUER le
 *     harnais (exit 1) au lieu d'afficher « (?) » ;
 *   - QUATRE LANGUES : les 52 scénarios sont rejoués sur en/fr/es/pt (208 exécutions). Le titre
 *     affiché doit être EXACTEMENT le libellé de la langue (lu dans le hx-data de CHAQUE page),
 *     et le niveau d'un même scénario doit être IDENTIQUE dans les quatre langues — une
 *     traduction ne change pas une catégorie.
 *
 * Le harnais ne réimplémente pas le modèle : il vérifie des INVARIANTS de rendu (niveau connu,
 * libellé exact, cohérence verdict/badges, cohérence entre langues, seuils brachycéphales
 * strictement plus stricts), pas des températures recalculées.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const DIST = path.join(__dirname, "packages/ui/dist");
const LOCALES = [["en", ""], ["fr", "fr"], ["es", "es"], ["pt", "pt"]];
const CIBLES = ["ATH", "BOG", "HER", "IST", "JNB", "LAX", "MEX", "MLA", "MRU", "MTY", "NBO", "PEK", "TNR"];
const MOIS = [[1, "janvier"], [7, "juillet"]];
const NIVEAUX = { "hx-b-ok": "ok", "hx-b-warn": "warn", "hx-b-no": "no" };

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  if (cond) { pass++; }
  else { fail++; console.log("  FAIL " + label + (detail ? `\n         ${detail}` : "")); }
};

function chargerPage(dir) {
  const html = fs.readFileSync(path.join(DIST, dir, "tools/heat/index.html"), "utf8");
  const hoisted = [...html.matchAll(/<script type="module" src="(\/_astro\/hoisted\.[^"]+\.js)"><\/script>/g)]
    .map((m) => path.join(DIST, m[1]));
  const target = hoisted.find((p) => fs.readFileSync(p, "utf8").includes("hx-data"));
  if (!target) throw new Error("bundle hx introuvable pour " + (dir || "en"));
  let script = fs.readFileSync(target, "utf8")
    .replace(/import\s*\{([^}]*)\}\s*from\s*"[^"]*";?/g, (_, b) =>
      b.split(",").map((x) => (x.includes(" as ") ? x.split(" as ")[1] : x).trim()).filter(Boolean)
        .map((n) => `const ${n} = () => {};`).join(" "))
    .replace(/import\s*"[^"]*";?/g, "");
  const section = html.match(/<div class="hx"[^>]*>[\s\S]*?<script type="application\/json" id="hx-data"[^>]*>[\s\S]*?<\/script>/);
  if (!section) throw new Error("section hx introuvable pour " + (dir || "en"));
  const L = JSON.parse(html.match(/<script type="application\/json" id="hx-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
  return { section: section[0], script, L };
}

function scenario(page, depIata, arrIata, month, breedKey) {
  const dom = new JSDOM(`<!doctype html><html><body>${page.section}</body></html>`, {
    url: "https://mydogcanfly.com/tools/heat/", runScripts: "outside-only",
  });
  const doc = dom.window.document;
  dom.window.Element.prototype.scrollIntoView = () => {};
  dom.window.eval(page.script);
  const labelOf = (iata) => {
    const a = page.L.airports.find((x) => x.iata === iata);
    if (!a) throw new Error("aéroport absent : " + iata);
    return `${a.city} (${a.iata})`;
  };
  doc.getElementById("hx-dep").value = labelOf(depIata);
  doc.getElementById("hx-arr").value = labelOf(arrIata);
  doc.getElementById("hx-month").value = String(month);
  doc.getElementById("hx-breed").value = breedKey ?? "";
  doc.getElementById("hx-form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));

  // --- Sélecteurs précis, un par information ---
  const verdict = doc.querySelector("#hx-out .hx-verdict");
  if (!verdict) return { erreur: "aucun .hx-verdict rendu" };
  const cls = [...verdict.classList].find((c) => NIVEAUX[c]);
  const niveau = cls ? NIVEAUX[cls] : null;
  const titre = verdict.querySelector(".hx-vtitle")?.textContent.trim() ?? "";
  // Les badges de température portent `hx-pill hx-ok|hx-warn|hx-no` (et non `hx-b-*`).
  const PILL = { "hx-ok": "ok", "hx-warn": "warn", "hx-no": "no" };
  const badges = [...verdict.querySelectorAll(".hx-leg .hx-pill")].map((b) => {
    const lvCls = [...b.classList].find((c) => PILL[c]);
    return { niveau: lvCls ? PILL[lvCls] : null, texte: b.textContent.trim() };
  });
  const calendrier = [...doc.querySelectorAll("#hx-out .hx-mon")].length;
  const texteVerdict = (verdict.textContent || "").replace(/\s+/g, " ").trim();
  return { niveau, titre, badges, calendrier, texteVerdict };
}

/**
 * BASELINE BLOQUANTE — les 52 niveaux attendus (locale en), figés le 13/08/2026 sur `fef1f70`.
 *
 * Tout écart — un seul scénario qui change de niveau — fait échouer le harnais. C'est voulu :
 * un changement de modèle ou de seuil doit se VOIR ici et être assumé en mettant à jour cette
 * table dans le même commit, jamais passer en silence. La distribution agrégée (18/8/26) et le
 * nombre exact de scénarios où le carlin est strictement plus défavorable (8) sont vérifiés en
 * plus : une table réécrite à la va-vite qui casserait ces invariants serait rattrapée.
 */
const BASELINE_EN = {
  "ATH|janvier|normal": "ok",
  "ATH|janvier|carlin": "ok",
  "ATH|juillet|normal": "no",
  "ATH|juillet|carlin": "no",
  "BOG|janvier|normal": "warn",
  "BOG|janvier|carlin": "no",
  "BOG|juillet|normal": "no",
  "BOG|juillet|carlin": "no",
  "HER|janvier|normal": "ok",
  "HER|janvier|carlin": "ok",
  "HER|juillet|normal": "no",
  "HER|juillet|carlin": "no",
  "IST|janvier|normal": "ok",
  "IST|janvier|carlin": "ok",
  "IST|juillet|normal": "warn",
  "IST|juillet|carlin": "no",
  "JNB|janvier|normal": "no",
  "JNB|janvier|carlin": "no",
  "JNB|juillet|normal": "ok",
  "JNB|juillet|carlin": "warn",
  "LAX|janvier|normal": "ok",
  "LAX|janvier|carlin": "ok",
  "LAX|juillet|normal": "no",
  "LAX|juillet|carlin": "no",
  "MEX|janvier|normal": "ok",
  "MEX|janvier|carlin": "warn",
  "MEX|juillet|normal": "no",
  "MEX|juillet|carlin": "no",
  "MLA|janvier|normal": "ok",
  "MLA|janvier|carlin": "ok",
  "MLA|juillet|normal": "no",
  "MLA|juillet|carlin": "no",
  "MRU|janvier|normal": "no",
  "MRU|janvier|carlin": "no",
  "MRU|juillet|normal": "ok",
  "MRU|juillet|carlin": "warn",
  "MTY|janvier|normal": "ok",
  "MTY|janvier|carlin": "ok",
  "MTY|juillet|normal": "no",
  "MTY|juillet|carlin": "no",
  "NBO|janvier|normal": "no",
  "NBO|janvier|carlin": "no",
  "NBO|juillet|normal": "warn",
  "NBO|juillet|carlin": "no",
  "PEK|janvier|normal": "ok",
  "PEK|janvier|carlin": "ok",
  "PEK|juillet|normal": "warn",
  "PEK|juillet|carlin": "no",
  "TNR|janvier|normal": "no",
  "TNR|janvier|carlin": "no",
  "TNR|juillet|normal": "ok",
  "TNR|juillet|carlin": "warn",
};
const BASELINE_DISTRIBUTION = { ok: 18, warn: 8, no: 26 };
const BASELINE_CARLIN_PLUS_STRICT = 8;

const ORDRE = { ok: 0, warn: 1, no: 2 };
const parScenario = new Map(); // "IATA|mois|dog" → { locale: niveau }

for (const [code, dir] of LOCALES) {
  const page = chargerPage(dir);
  const breedKey = Object.keys(page.L.breeds).find((k) => page.L.breeds[k]?.id === "breed_pug")
    ?? Object.keys(page.L.breeds).find((k) => page.L.breeds[k]?.br);
  check(`${code} : une race brachycéphale existe dans les données`, !!breedKey);
  const TITRES = { ok: page.L.s.ok, warn: page.L.s.risk, no: page.L.s.embargo };
  let executes = 0;

  for (const iata of CIBLES) {
    for (const [m, moisFr] of MOIS) {
      for (const [dogLabel, breed] of [["normal", null], ["carlin", breedKey]]) {
        const r = scenario(page, "CDG", iata, m, breed);
        executes++;
        const id = `${code} ${iata} ${moisFr} ${dogLabel}`;
        if (r.erreur) { check(id + " : verdict rendu", false, r.erreur); continue; }

        check(`${id} : niveau CONNU (classe hx-b-*)`, r.niveau !== null,
          "classes du verdict sans niveau reconnu");
        if (r.niveau === null) continue;
        check(`${id} : titre EXACT de la langue`, r.titre === TITRES[r.niveau],
          `attendu ${JSON.stringify(TITRES[r.niveau])}, obtenu ${JSON.stringify(r.titre)}`);
        check(`${id} : deux badges de température, niveaux connus`,
          r.badges.length === 2 && r.badges.every((b) => b.niveau !== null && /-?\d+\s*°C/.test(b.texte)),
          JSON.stringify(r.badges));
        // Le verdict est le PIRE des deux aéroports : jamais plus clément que ses badges.
        if (r.badges.length === 2 && r.badges.every((b) => b.niveau !== null)) {
          const pire = Math.max(...r.badges.map((b) => ORDRE[b.niveau]));
          check(`${id} : verdict = pire des deux badges`, ORDRE[r.niveau] === pire,
            `verdict ${r.niveau}, badges ${r.badges.map((b) => b.niveau).join("/")}`);
        }
        check(`${id} : calendrier de 12 mois rendu`, r.calendrier === 12, `${r.calendrier} cellules`);

        /* P0 climat : une ESTIMATION ne produit jamais une affirmation positive de sécurité.
           Les formulations historiques sont interdites dans tout le verdict rendu, quelle que
           soit la langue — et le niveau « ok » doit porter le libellé NEUTRE de la langue
           (« aucun signal détecté par cet indicateur »), lu dans le hx-data de la page. */
        const INTERDITES = ["Clear to fly", "Feu vert", "safe range", "plage sûre", "Luz verde",
          "rango seguro", "Confortable", "Comfortable on your date", "Cómodo en tu fecha",
          /* v3 : l'outil n'a AUCUN historique d'embargos — il ne peut pas en revendiquer un. */
          "historically", "historiquement", "históricamente", "historicamente"];
        const texteVerdict = r.texteVerdict ?? "";
        const trouvee = INTERDITES.find((f) => texteVerdict.toLowerCase().includes(f.toLowerCase()));
        check(`${id} : AUCUNE affirmation positive de sécurité sur estimation`, !trouvee,
          `formulation interdite trouvée : ${JSON.stringify(trouvee)}`);
        if (r.niveau === "ok") {
          check(`${id} : niveau « ok » = libellé NEUTRE exact de la langue`, r.titre === page.L.s.ok,
            `attendu ${JSON.stringify(page.L.s.ok)}, obtenu ${JSON.stringify(r.titre)}`);
        }

        const cle = `${iata}|${moisFr}|${dogLabel}`;
        parScenario.set(cle, { ...(parScenario.get(cle) ?? {}), [code]: r.niveau });
        if (code === "en") {
          check(`${id} : niveau conforme à la BASELINE (${BASELINE_EN[cle]})`, r.niveau === BASELINE_EN[cle],
            `baseline ${BASELINE_EN[cle]}, obtenu ${r.niveau}`);
        }
      }
    }
  }
  check(`${code} : les 52 scénarios obligatoires ont tous été exécutés`, executes === 52, `${executes}/52`);
}

/* Garde ANTI-RETOUR : le libellé « ok » de chaque langue doit être la formulation neutre — si
   quelqu'un remet « Feu vert »/« Clear to fly » dans le composant, ces contrôles tombent avant
   même les scénarios. */
for (const [code, dir] of LOCALES) {
  const L = chargerPage(dir).L;
  check(`${code} : le libellé « ok » du composant est neutre (« signal »)`,
    /signal|señal|sinal/i.test(L.s.ok), JSON.stringify(L.s.ok));
  /* Les PHRASES positives exactes, pas un mot isolé : « garantia de segurança » apparaît
     légitimement dans la description pt… précédé de « não é » — c'est une négation, pas une
     promesse. On interdit les formulations affirmatives historiques, telles quelles. */
  check(`${code} : la description « ok » ne promet ni sécurité ni plage sûre`,
    !/(safe range|plage sûre|rango seguro|faixa segura|is within|est dans la plage|están dentro)/i.test(L.s.okD), JSON.stringify(L.s.okD));
}

console.log("\n— Cohérence entre langues et entre chiens —");
let brachyPlusStrictViole = 0, localesIncoherentes = 0;
for (const [cle, niveaux] of parScenario) {
  const valeurs = new Set(Object.values(niveaux));
  if (Object.keys(niveaux).length === 4 && valeurs.size !== 1) {
    localesIncoherentes++;
    console.log(`  FAIL ${cle} : niveaux différents selon la langue — ${JSON.stringify(niveaux)}`);
  }
}
for (const iata of CIBLES) for (const [, moisFr] of MOIS) {
  const n = parScenario.get(`${iata}|${moisFr}|normal`)?.en;
  const b = parScenario.get(`${iata}|${moisFr}|carlin`)?.en;
  if (n && b && ORDRE[b] < ORDRE[n]) {
    brachyPlusStrictViole++;
    console.log(`  FAIL ${iata} ${moisFr} : le carlin obtient un niveau PLUS clément (${b}) que le chien normal (${n})`);
  }
}
check("aucun scénario n'a des niveaux différents selon la langue", localesIncoherentes === 0, `${localesIncoherentes} incohérence(s)`);
check("le carlin n'est jamais mieux traité que le chien normal", brachyPlusStrictViole === 0);
// Nombre EXACT et positif de scénarios où le carlin est STRICTEMENT plus défavorable : si les
// seuils brachycéphales cessaient d'être appliqués, ce compte tomberait à 0 et le harnais le verrait.
{
  let strictementPire = 0;
  for (const iata of CIBLES) for (const [, moisFr] of MOIS) {
    const n = parScenario.get(`${iata}|${moisFr}|normal`)?.en;
    const b = parScenario.get(`${iata}|${moisFr}|carlin`)?.en;
    if (n && b && ORDRE[b] > ORDRE[n]) strictementPire++;
  }
  check(`scénarios où le carlin est STRICTEMENT plus défavorable : exactement ${BASELINE_CARLIN_PLUS_STRICT}`,
    strictementPire === BASELINE_CARLIN_PLUS_STRICT, `obtenu ${strictementPire}`);
}

// Distribution EXACTE, bloquante — pas seulement « une répartition existe ».
const parNiveau = { ok: 0, warn: 0, no: 0 };
for (const [cle, n] of parScenario) if (n.en) parNiveau[n.en]++;
check(`distribution exacte des 52 niveaux : ok ${BASELINE_DISTRIBUTION.ok} · warn ${BASELINE_DISTRIBUTION.warn} · no ${BASELINE_DISTRIBUTION.no}`,
  parNiveau.ok === BASELINE_DISTRIBUTION.ok && parNiveau.warn === BASELINE_DISTRIBUTION.warn && parNiveau.no === BASELINE_DISTRIBUTION.no,
  JSON.stringify(parNiveau));
/* v7 (contre-revue v6) : le résumé imprimait « Feu vert »/« plage sûre » — les affirmations que
   ce lot retire précisément du composant. Le harnais vérifiait leur absence puis les
   réintroduisait dans sa propre sortie. Résumé descriptif, aligné sur les libellés réels. */
console.log(`\nRépartition (en, 52 scénarios) : « Aucun signal » ${parNiveau.ok} · « Estimation élevée » ${parNiveau.warn} · « Estimation au-dessus du seuil » ${parNiveau.no}`);
console.log("Ces catégories décrivent l'indicateur latitude+mois ; elles ne constituent ni une autorisation, ni une prévision, ni une garantie de sécurité.");

console.log("\n=== SUMMARY ===");
console.log(fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
