#!/usr/bin/env node
/** Rendu construit du service ITA : fiche permanente + alerte Finder strictement contextuelle. */
const fs = require("fs");
const path = require("path");
const { loadHomeParts, buildDom, flush } = require("./test-lib/finder-dom.cjs");

const DIST = path.join(__dirname, "packages/ui/dist");
const LOCALES = [
  { code: "en", dir: "", title: "Special case: large dog in the cabin" },
  { code: "fr", dir: "fr", title: "Cas particulier : grand chien en cabine" },
  { code: "es", dir: "es", title: "Caso especial: perro grande en cabina" },
  { code: "pt", dir: "pt", title: "Caso especial: cão grande na cabine" },
];
let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "  OK  " : "  FAIL"} ${label}${ok || !detail ? "" : `\n       ${detail}`}`);
  if (!ok) failures++;
};
const emptyFare = () => ["cabin", "hold", "cargo"].map((placement) => ({
  placement, resolution: { conflits: [], montants: [], chevauchements: [], mecanismes: [], indecidables: [], supprimes: [] },
}));
const report = {
  verdict: "unknown", confidence: 3, positives: [], conditions: [], domestic: true, score: 50,
  climate: null, warnings: [], risks: [], alternatives: [], partners: [], safety_advisories: [], sources: [],
  airlines: [{
    airline_id: "airline_ita_airways", name: "ITA Airways", direct: true,
    cabin: false, hold: false, cargo: false,
    cabin_status: "confirmation_required", hold_status: "accepted_with_conditions", cargo_status: "confirmation_required",
    to_confirm: ["cabin", "cargo"], itinerary_confidence: "direct_documented", heat_embargo: false,
    heat_confirmation_required: false, offers_pet_transport: "unknown", carrier_of_origin: true, carrier_of_destination: true,
    placement_decisions: [
      { placement: "cabin", status: "confirmation_required", allowed: false, confirmation_causes: [{ code: "rule_unverified", rule_id: "rule_global_cabin_weight_cap" }] },
      { placement: "hold", status: "accepted_with_conditions", allowed: false },
      { placement: "cargo", status: "confirmation_required", allowed: false, confirmation_causes: [{ code: "legacy_unreviewed" }] },
    ],
    fare_resolutions: emptyFare(), label: "À confirmer",
  }],
};

async function finder(locale, origin, destination, weight, placement = "cabin") {
  const parts = loadHomeParts(locale.dir);
  const fetchMock = async (url, opts) => {
    if (String(url).includes("/nearest-airport")) return { ok: false };
    if (opts?.method === "POST") return { ok: true, json: async () => report };
    throw new Error(`unexpected fetch: ${url}`);
  };
  const dom = buildDom(parts, fetchMock);
  const doc = dom.window.document;
  doc.getElementById("f-origin").value = parts.labels.airRev[origin];
  doc.getElementById("f-dest").value = parts.labels.airRev[destination];
  doc.getElementById("f-weight").value = String(weight);
  doc.getElementById("f-placement").value = placement;
  doc.getElementById("mdcf-finder").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  await flush(2); await flush();
  return doc;
}

(async () => {
  for (const locale of LOCALES) {
    console.log(`\n— ${locale.code} —`);
    const page = path.join(DIST, locale.dir, "airlines", "ita-airways", "index.html");
    const html = fs.readFileSync(page, "utf8");
    check(`${locale.code} : la fiche ITA rend le paragraphe permanent`, html.includes("data-special-service=\"special_ita_large_dog_on_board\"") && html.includes(locale.title));
    check(`${locale.code} : la fiche renvoie vers la page nationale officielle`, html.includes("/it/it/book-and-prepare/other-requests/travelling-with-pets/pets-in-cabin/large-dog-on-board"));

    const domestic = await finder(locale, "airport_fco", "airport_lin", 30);
    const alert = domestic.querySelector(".acard__special");
    check(`${locale.code} : FCO → LIN, 30 kg affiche l'alerte localisée`, !!alert && alert.textContent.includes(locale.title), alert?.textContent ?? "absente");
    check(`${locale.code} : l'alerte n'emploie jamais le mot chat comme bénéficiaire`, !!alert && !/\b(cat|chat|gato)\b/i.test(alert.textContent));

    check(`${locale.code} : trajet international, même poids — aucune alerte`, !(await finder(locale, "airport_fco", "airport_cdg", 30)).querySelector(".acard__special"));
    check(`${locale.code} : 10 kg exactement — aucune alerte`, !(await finder(locale, "airport_fco", "airport_lin", 10)).querySelector(".acard__special"));
    check(`${locale.code} : recherche soute — aucune alerte cabine`, !(await finder(locale, "airport_fco", "airport_lin", 30, "hold")).querySelector(".acard__special"));
  }
  console.log(`\n=== ITA UI — ${failures ? `${failures} échec(s)` : "TOUT EST VERT"} ===`);
  process.exit(failures ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
