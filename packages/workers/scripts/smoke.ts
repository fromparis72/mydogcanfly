import worker from "../src/index";

/* Verifies the live pipeline through the Worker without deploying (Node 22 has fetch/Request/Response). */

async function call(method: string, body?: unknown, query = "") {
  const res = await worker.fetch(
    new Request(`https://api.mydogcanfly.com/v1/finder${query}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }),
    // Second argument = les variables Cloudflare (voir `interface Env` dans src/index.ts).
    // Le smoke tourne hors Cloudflare : pas de BUILD_SHA, ce qui exerce au passage le repli
    // "unknown" de /v1/health.
    {},
  );
  return { status: res.status, report: await res.json() };
}

const golden = {
  origin: "airport_cdg",
  destination: "airport_hnd",
  dog: { breed_id: "breed_golden_retriever", weight_kg: 11, brachycephalic: false },
  weather: { temperature_c: 34 },
};

const post = await call("POST", golden);
const frReport = (await call("POST", { ...golden, locale: "fr" })).report;

/* GET : lit la query string, et ne fabrique jamais de requête.
 * Ces quatre contrôles existent parce que GET renvoyait auparavant une démo « CDG → Tokyo »
 * à toute requête, y compris nue — et que le Finder l'affichait comme un vrai résultat. */
const getBare = await call("GET");                                            // → 400
const getQuery = await call("GET", undefined, "?origin=CDG&destination=HND&weight_kg=11&breed=golden_retriever&temperature_c=34");
const getUnknown = await call("GET", undefined, "?origin=CDG&destination=XXX"); // → 400
const getPartial = await call("GET", undefined, "?origin=CDG");                // → 400
const okFr = /cabine|soute|Japon|brachyc|assurance|conforme/i.test(JSON.stringify(frReport));
const partners = (post.report as { partners: { vertical: string; url: string; sponsored: boolean }[] }).partners;
const okPartners = Array.isArray(partners) && partners.length > 0;
// Safeguard: sponsored ⇒ has URL ; not sponsored ⇒ no outbound URL (never free qualified traffic).
const safeguard = partners.every((p) => (p.sponsored ? p.url.length > 0 : p.url === ""));
// Aucun partenaire n'est actif tant que le commercial est gelé : on vérifie donc l'INVARIANT
// (sponsorisé ⇔ URL présente), pas la présence d'un partenaire sponsorisé. L'ancienne
// assertion exigeait un partenaire actif avec une URL — elle validait en réalité un lien
// fictif (« track.example-affiliate.com »), servi en production dans chaque rapport.
const equipment = partners.find((p) => p.vertical === "equipment"); // placeholder partner
const okNoFakeUrl = partners.every((p) => p.url === "" || /^https:\/\/(?!.*example)/.test(p.url));
const okPlaceholder = !equipment || (equipment.sponsored === false && equipment.url === "");

console.log("POST /v1/finder →", post.status);
console.log(JSON.stringify(post.report, null, 2));

const r = post.report as { verdict: string; sources: unknown[] };
const okShape =
  /* « unknown » depuis le 05/09/2026 : la réponse « pas encore établi ». Cette liste l'ignorait,
     donc le fumigène aurait déclaré la forme invalide sur la quasi-totalité des trajets réels. */
  ["compatible", "conditional", "unknown", "incompatible"].includes(r.verdict) &&
  Array.isArray(r.sources) && r.sources.length >= 2;
const errOf = (x: { report: unknown }) => (x.report as { error?: string }).error;
const okGetBare = getBare.status === 400 && errOf(getBare) === "missing_parameters";
const okGetPartial = getPartial.status === 400 && errOf(getPartial) === "missing_parameters";
const okGetUnknown = getUnknown.status === 400 && errOf(getUnknown) === "unknown_airport";
// Une requête GET complète doit produire exactement le même rapport que le POST équivalent.
const okGetQuery = getQuery.status === 200 && (getQuery.report as { verdict?: string }).verdict === r.verdict;
const okGet = okGetBare && okGetPartial && okGetUnknown && okGetQuery;

console.log("\nverdict:", r.verdict, "· sources:", r.sources.length);
console.log("GET nu → 400 missing_parameters:", okGetBare, "· GET incomplet → 400:", okGetPartial);
console.log("GET aéroport inconnu → 400 unknown_airport:", okGetUnknown);
console.log("GET avec query string → même verdict que POST:", okGetQuery);
console.log("FR POST returns a localized report:", okFr);
console.log("contextual partners returned:", okPartners, partners?.map((p) => `${p.vertical}${p.sponsored ? "*" : ""}`).join(", "));
console.log("safeguard (no free outbound traffic):", safeguard, "· aucune URL fictive:", okNoFakeUrl, "· placeholder text-only:", okPlaceholder);
if (!(okShape && okGet && okFr && okPartners && safeguard && okNoFakeUrl && okPlaceholder))
  throw new Error("❌ Worker pipeline mismatch");
console.log("✅ Worker pipeline live and correct (EN + FR + partners + affiliate safeguard)");
