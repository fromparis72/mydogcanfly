/**
 * HARNAIS du calculateur de caisse — page CONSTRUITE, sélecteurs DOM précis, quatre langues.
 *
 *   npm run build:ci && node test-crate-harness.cjs      (branché dans test:built-ui)
 *
 * POURQUOI IL EXISTE. T0-B3-g a constaté que quatre des huit outils du site ne sont lus par AUCUN
 * harnais. `crate` est le plus lourd des quatre : il conseille une taille de caisse, et une caisse
 * trop petite est un refus à l'embarquement — ou pire.
 *
 * CE QU'IL VÉRIFIE, ET POURQUOI CHACUN EST UN VRAI RISQUE :
 *   1. les 7 compagnies qui refusent LES TROIS placements affichent le message dédié, et JAMAIS
 *      une ligne de soute qui laisserait croire la cabine possible. C'est la régression du
 *      09/08/2026, corrigée à la main et gardée par rien depuis ;
 *   2. la taille standard proposée est ≥ au minimum calculé sur les TROIS dimensions. Proposer une
 *      caisse plus petite que son propre minimum serait un conseil dangereux ;
 *   3. la majoration brachycéphale est STRICTEMENT positive sur les trois dimensions ;
 *   4. un chien plus lourd que la limite cabine ne reçoit JAMAIS un verdict cabine favorable ;
 *   5. un même scénario donne la même taille et le même verdict dans les quatre langues — une
 *      traduction ne change pas une catégorie.
 *
 * Le harnais ne réimplémente pas la formule IATA : il vérifie des INVARIANTS de rendu. Recalculer
 * la formule ici reviendrait à comparer le code à lui-même.
 *
 * JAMAIS VERT FAUTE DE MATIÈRE : il exige un référentiel peuplé et un résultat rendu pour CHAQUE
 * scénario. Un scénario muet fait échouer le harnais au lieu de disparaître du total.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const DIST = path.join(__dirname, "packages/ui/dist");
const LOCALES = [["en", ""], ["fr", "fr"], ["es", "es"], ["pt", "pt"]];

/** Les compagnies qui refusent cabine ET soute ET fret, figées le 19/08/2026. Un écart doit se
 *  VOIR ici et être assumé dans le même commit, jamais passer en silence.
 *
 *  MESURÉ À 17, PAS À 7. Le commentaire de `CrateCalculator.astro` (retest du 09/08/2026) nomme
 *  sept compagnies — Ryanair, easyJet, Wizz Air, Icelandair, IndiGo, Batik Air Indonésie et
 *  Malaisie — comme si la liste était close. Le référentiel en produit dix-sept aujourd'hui :
 *  s'y ajoutent Aer Lingus, Aircalin, Cathay Pacific, Garuda Indonesia, Gulf Air, Kenya Airways,
 *  Qantas, South African Airways, TUI Airways et Virgin Atlantic. Le code n'a pas dérivé — les
 *  DONNÉES ont bougé sous un commentaire resté figé. Signalé, non corrigé : réécrire un
 *  commentaire daté d'une contre-revue n'est pas à moi de le faire.
 *
 *  RETOUR À 7 (28/08/2026, lot RC). Le « 17 » n'était pas une évolution des données : c'était
 *  la dérivation qui confondait deux réalités que T0-A a séparées. `noPets` jugeait sur
 *  `allowed === false`, qui recouvre le refus explicite (`denied`) ET l'incertitude à
 *  confirmer (`confirmation_required`, dont les canaux `legacy_unreviewed`) — les dix
 *  compagnies « ajoutées » avaient simplement une soute ou un fret non revérifiés, et l'outil
 *  leur faisait dire « ne transporte pas les chiens ». La bascule de Virgin Australia en
 *  cabine conditionnelle (arbitrage A-bis) l'a fait voir : elle entrait dans la liste alors
 *  que sa cabine ACCEPTE les petits chiens sous conditions. La dérivation juge désormais par
 *  STATUT (`denied` sur les trois canaux), et le compte retombe exactement sur les sept
 *  compagnies du commentaire d'origine : Ryanair, easyJet, Wizz Air, Icelandair, IndiGo,
 *  Batik Air Indonésie et Malaisie. */
const SANS_ANIMAUX = 7;

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  if (cond) pass++;
  else { fail++; console.log("  FAIL " + label + (detail ? `\n         ${detail}` : "")); }
};

function chargerPage(dir) {
  const fichier = path.join(DIST, dir, "tools/crate/index.html");
  if (!fs.existsSync(fichier)) throw new Error(`page absente : ${fichier} — le site n'est pas construit`);
  const html = fs.readFileSync(fichier, "utf8");
  const hoisted = [...html.matchAll(/<script type="module" src="(\/_astro\/hoisted\.[^"]+\.js)"><\/script>/g)]
    .map((m) => path.join(DIST, m[1]));
  const cible = hoisted.find((p) => fs.readFileSync(p, "utf8").includes("crx-labels"));
  if (!cible) throw new Error("bundle crx introuvable pour " + (dir || "en"));
  const script = fs.readFileSync(cible, "utf8")
    .replace(/import\s*\{([^}]*)\}\s*from\s*"[^"]*";?/g, (_, b) =>
      b.split(",").map((x) => (x.includes(" as ") ? x.split(" as ")[1] : x).trim()).filter(Boolean)
        .map((n) => `const ${n} = () => {};`).join(" "))
    .replace(/import\s*"[^"]*";?/g, "");
  const section = html.match(/<section id="crate-calc"[\s\S]*?<\/section>/);
  if (!section) throw new Error("section crx introuvable pour " + (dir || "en"));
  const L = JSON.parse(html.match(/<script type="application\/json" id="crx-labels"[^>]*>([\s\S]*?)<\/script>/)[1]);
  return { section: section[0], script, L };
}

/** Un scénario : deux mesures, un poids, une compagnie, une case brachycéphale. */
function scenario(page, { a, d, poids, airId = "", brachy = false, race = "" }) {
  const dom = new JSDOM(`<!doctype html><html><body>${page.section}</body></html>`, {
    url: "https://mydogcanfly.com/tools/crate/", runScripts: "outside-only",
  });
  const doc = dom.window.document;
  dom.window.Element.prototype.scrollIntoView = () => {};
  /* Le script lit `?breed=` / `?air=` au chargement : sans ce stub il lèverait avant de s'attacher. */
  dom.window.mdcfQuery = () => new dom.window.URLSearchParams("");
  dom.window.eval(page.script);

  doc.getElementById("m-a").value = String(a);
  doc.getElementById("m-d").value = String(d);
  if (poids != null) doc.getElementById("crx-weight").value = String(poids);
  if (race) doc.getElementById("crx-breed").value = race;
  if (airId) doc.getElementById("crx-airline").value = airId;
  doc.getElementById("crx-brachy").checked = brachy;
  doc.getElementById("crx-form").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));

  const out = doc.getElementById("crx-result");
  if (!out || out.hidden) return { erreur: "aucun résultat rendu" };
  const nombres = (s) => [...String(s).matchAll(/(\d+(?:[.,]\d+)?)/g)].map((m) => parseFloat(m[1].replace(",", ".")));
  const minimum = [...out.querySelectorAll(".crx-dims span b")].map((b) => nombres(b.textContent)[0]);
  const codeTaille = out.querySelector(".crx-size__code")?.textContent.trim() ?? null;
  const dimsTaille = codeTaille ? nombres(out.querySelector(".crx-size__d")?.textContent ?? "") : null;
  const lignes = [...out.querySelectorAll(".crx-line")].map((l) => ({
    genre: [...l.classList].map((c) => /^crx-line--(.+)$/.exec(c)?.[1]).find(Boolean) ?? null,
    texte: (l.textContent || "").replace(/\s+/g, " ").trim(),
  }));
  return { minimum, codeTaille, dimsTaille, lignes };
}

/* ---- Le référentiel doit être PEUPLÉ : sans compagnies, tout ce qui suit passerait à vide ---- */
const pages = Object.fromEntries(LOCALES.map(([l, dir]) => [l, chargerPage(dir)]));

/* ── DEUX TÉMOINS RE-FONDÉS, PAS ABAISSÉS (frontière de confiance) ─────────────────────────────
 *
 * `noPets` exige les TROIS canaux `denied`, et `cabin` n'existe que sur un canal `allowed`.
 * Depuis que seule une phrase citée décide, le dépôt ne porte plus qu'un seul refus prouvé
 * (British Airways cabine) et aucune acceptation : les deux populations sont donc VIDES sur les
 * données réelles — 0 compagnie « aucun animal » (contre 7 figées), 0 compagnie publiant une
 * limite cabine exploitable (contre 12). Les sections 1 et 4 de ce harnais n'exerçaient plus rien.
 *
 * On leur rend leur cas par DEUX COMPAGNIES SYNTHÉTIQUES, injectées dans les libellés de la page
 * — le script de production reste celui du dist, et c'est lui qu'on éprouve. Elles sont déclarées
 * comme telles et ne sortent pas d'ici. La démonstration que les données RÉELLES n'en portent plus
 * vit juste en dessous, sur les comptes mesurés. */
const SYNTH_SANS_ANIMAUX = "airline_synthetique_sans_animaux";
const SYNTH_CABINE = "airline_synthetique_cabine_8kg";
function pageAvecTemoins(page) {
  const extra = {
    [SYNTH_SANS_ANIMAUX]: { name: "Synthetic NoPets Air", cabin: null, hold: "no", cargo: false,
      noPets: true, site: "", fiche: "/airlines/synthetic/" },
    [SYNTH_CABINE]: { name: "Synthetic Cabin Air", cabin: { maxKg: 8, dims: { l: 40, w: 30, h: 22 } },
      hold: "unknown", cargo: false, noPets: false, site: "", fiche: "/airlines/synthetic/" },
  };
  const L = JSON.parse(JSON.stringify(page.L));
  L.airlines = { ...(L.airlines ?? {}), ...extra };
  let section = page.section.replace(
    /(<script type="application\/json" id="crx-labels"[^>]*>)[\s\S]*?(<\/script>)/,
    (_, a, b) => a + JSON.stringify(L).replace(/<\//g, "<\\/") + b);
  if (section === page.section) throw new Error("injection des témoins impossible : bloc crx-labels introuvable");
  /* Le `<select>` est rendu côté serveur : sans option, `select.value = id` reste vide et le
     scénario porterait sur « toutes compagnies ». Le témoin serait alors muet, pas faux — donc
     invisible, ce qui est pire. */
  const options = Object.entries(extra)
    .map(([id, a]) => `<option value="${id}">${a.name}</option>`).join("");
  const avecOptions = section.replace(/(<select id="crx-airline"[^>]*>)/, (m) => m + options);
  if (avecOptions === section) throw new Error("injection des témoins impossible : select crx-airline introuvable");
  section = avecOptions;
  return { ...page, section, L };
}
const pagesT = Object.fromEntries(Object.entries(pages).map(([l, p]) => [l, pageAvecTemoins(p)]));

const AIR_REEL = pages.en.L.airlines ?? {};
const AIR = pagesT.en.L.airlines ?? {};
const sansAnimaux = Object.entries(AIR).filter(([, a]) => a.noPets).map(([id]) => id);
/* L'ÉTAT RÉEL, MESURÉ ET FIGÉ — mouvement nommé du 05/09/2026 : 7 → 0 et 12 → 0. Un refus total
   comme une limite cabine publiée sont des AFFIRMATIONS ; aucune n'est prouvée aujourd'hui. */
check("état réel figé : AUCUNE compagnie ne refuse les trois placements (7 avant la frontière)",
  Object.values(AIR_REEL).filter((a) => a.noPets).length === 0,
  `${Object.values(AIR_REEL).filter((a) => a.noPets).length}`);
check("état réel figé : AUCUNE compagnie ne publie de limite cabine exploitable (12 avant)",
  Object.values(AIR_REEL).filter((a) => !a.noPets && a.cabin && a.cabin.maxKg != null).length === 0,
  `${Object.values(AIR_REEL).filter((a) => !a.noPets && a.cabin && a.cabin.maxKg != null).length}`);
check("le référentiel embarqué est peuplé (sinon rien de ce qui suit ne prouverait quoi que ce soit)",
  Object.keys(AIR).length >= 50 && Object.keys(pages.en.L.breeds ?? {}).length >= 100,
  `${Object.keys(AIR).length} compagnies · ${Object.keys(pages.en.L.breeds ?? {}).length} races`);
check("le témoin « aucun animal » existe (synthétique — les données réelles n'en portent plus)",
  sansAnimaux.length === 1 && sansAnimaux[0] === SYNTH_SANS_ANIMAUX, sansAnimaux.join(", "));

/* ---- 1. « Aucun animal » prend le dessus, sans ligne de soute ambiguë ------------------------- */
for (const id of sansAnimaux) {
  const r = scenario(pagesT.en, { a: 60, d: 45, poids: 12, airId: id });
  if (r.erreur) { check(`${id} : un résultat est rendu`, false, r.erreur); continue; }
  const refus = r.lignes.filter((l) => l.genre === "no");
  /* LA PHRASE EXACTE, PAS UNE APPROXIMATION. Le danger n'est pas l'absence de refus — c'est un
     refus qui ne parle QUE de la soute : le lecteur en déduit que la cabine reste possible. Le
     harnais exige donc le message dédié, mot pour mot, et non « une ligne rouge quelconque ». */
  const attendu = String(pages.en.L.s.noPetsAtAll).replace("{name}", AIR[id].name).replace(/\s+/g, " ").trim();
  check(`${id} : le message « ni cabine ni soute » est affiché mot pour mot`,
    refus.some((l) => l.texte.includes(attendu)),
    refus.map((l) => l.texte.slice(0, 90)).join(" | ") || "aucune ligne de refus");
  check(`${id} : le refus total est affiché, en une seule ligne`, refus.length === 1,
    `${refus.length} ligne(s) de refus`);
  check(`${id} : aucune ligne de soute ne laisse croire la cabine possible`,
    !r.lignes.some((l) => l.genre === "soute" || l.genre === "neutral"),
    r.lignes.map((l) => `${l.genre}: ${l.texte.slice(0, 60)}`).join(" | "));
}

/* ---- 2 et 3. La taille standard couvre le minimum · le brachycéphale majore strictement ------- */
const MESURES = [
  { a: 40, d: 30, poids: 5 }, { a: 55, d: 40, poids: 9 }, { a: 70, d: 52, poids: 18 },
  { a: 85, d: 62, poids: 30 }, { a: 100, d: 75, poids: 45 },
];
for (const m of MESURES) {
  const nu = scenario(pages.en, m);
  const br = scenario(pages.en, { ...m, brachy: true });
  if (nu.erreur || br.erreur) { check(`A=${m.a} D=${m.d} : les deux scénarios rendent un résultat`, false); continue; }
  check(`A=${m.a} D=${m.d} : trois dimensions minimales sont affichées`, nu.minimum.length === 3,
    JSON.stringify(nu.minimum));
  if (nu.dimsTaille) {
    check(`A=${m.a} D=${m.d} : la taille standard ${nu.codeTaille} couvre le minimum calculé`,
      nu.dimsTaille.length === 3 && nu.dimsTaille.every((v, i) => v >= nu.minimum[i]),
      `standard ${JSON.stringify(nu.dimsTaille)} < minimum ${JSON.stringify(nu.minimum)}`);
  }
  check(`A=${m.a} D=${m.d} : le brachycéphale majore STRICTEMENT les trois dimensions`,
    br.minimum.length === 3 && br.minimum.every((v, i) => v > nu.minimum[i]),
    `sans ${JSON.stringify(nu.minimum)} → avec ${JSON.stringify(br.minimum)}`);
}

/* ---- 4. Un chien trop lourd ne reçoit jamais un verdict cabine favorable ---------------------- */
const avecPoidsCabine = Object.entries(AIR)
  .filter(([, a]) => !a.noPets && a.cabin && a.cabin.maxKg != null).slice(0, 12);
/* MOUVEMENT NOMMÉ : le seuil était « ≥ 5 compagnies réelles ». Depuis la frontière, AUCUNE
   politique n'est `allowed`, donc aucune limite cabine n'est exploitable — la population réelle
   est vide (mesurée ci-dessus) et la compagnie éprouvée ici est le témoin SYNTHÉTIQUE. Ce que la
   section démontre est inchangé : un chien trop lourd ne reçoit jamais un verdict cabine
   favorable, et c'est le script de production qui le décide. */
check("le témoin « limite cabine publiée » existe (synthétique — les données réelles n'en portent plus)",
  avecPoidsCabine.length === 1 && avecPoidsCabine[0][0] === SYNTH_CABINE,
  `${avecPoidsCabine.length} : ${avecPoidsCabine.map(([i]) => i).join(", ")}`);
for (const [id, a] of avecPoidsCabine) {
  const trop = scenario(pagesT.en, { a: 45, d: 32, poids: a.cabin.maxKg + 10, airId: id });
  if (trop.erreur) { check(`${id} : un résultat est rendu au-delà de la limite`, false, trop.erreur); continue; }
  check(`${id} : au-delà de ${a.cabin.maxKg} kg, aucun verdict cabine favorable`,
    !trop.lignes.some((l) => l.genre === "ok"),
    trop.lignes.map((l) => `${l.genre}: ${l.texte.slice(0, 60)}`).join(" | "));
}

/* ---- 5. Quatre langues, mêmes catégories ------------------------------------------------------ */
const REFERENCE = { a: 70, d: 52, poids: 18, airId: Object.keys(AIR).find((id) => AIR[id].cabin && !AIR[id].noPets) };
const parLangue = Object.fromEntries(LOCALES.map(([l]) => [l, scenario(pages[l], REFERENCE)]));
check("le scénario de référence rend un résultat dans les quatre langues",
  Object.values(parLangue).every((r) => !r.erreur),
  Object.entries(parLangue).filter(([, r]) => r.erreur).map(([l, r]) => `${l}: ${r.erreur}`).join(" | "));
if (Object.values(parLangue).every((r) => !r.erreur)) {
  const codes = [...new Set(Object.values(parLangue).map((r) => r.codeTaille))];
  check("la taille standard est la même dans les quatre langues", codes.length === 1,
    Object.entries(parLangue).map(([l, r]) => `${l}: ${r.codeTaille}`).join(" | "));
  const genres = [...new Set(Object.values(parLangue).map((r) => r.lignes.map((x) => x.genre).join(",")))];
  check("la suite des verdicts est la même dans les quatre langues", genres.length === 1,
    Object.entries(parLangue).map(([l, r]) => `${l}: ${r.lignes.map((x) => x.genre).join(",")}`).join(" | "));
  const minima = [...new Set(Object.values(parLangue).map((r) => JSON.stringify(r.minimum)))];
  check("le minimum calculé est le même dans les quatre langues", minima.length === 1, minima.join(" | "));
}

console.log(`\n  [caisse] ${pass} contrôles tenus, ${fail} en échec`);
if (fail) process.exit(1);
console.log("[caisse] le calculateur de caisse rend ce qu'il doit, dans les quatre langues.");
