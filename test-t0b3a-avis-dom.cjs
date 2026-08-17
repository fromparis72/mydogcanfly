/**
 * Harnais DOM T0-B3-a — les AVIS DE SÉCURITÉ, rendus dans les quatre langues.
 *
 *   npm run build:ci && node test-t0b3a-avis-dom.cjs
 *
 * Le moteur sait produire des avis (`safety_advisories`) ; ce harnais prouve ce que le VISITEUR
 * voit. Il charge le HTML réellement construit, le bundle client hissé, et contrôle lui-même la
 * réponse réseau — jamais un vrai Worker. Ce n'est pas un test du moteur : c'est un test du rendu,
 * et il ne relit aucune donnée qu'il aurait lui-même posée dans le DOM.
 *
 * Ce qu'il verrouille, et pourquoi :
 *   · le TITRE de section est celui de la langue demandée, figé en toutes lettres. Vérifier que
 *     deux libellés « diffèrent » laisserait passer une clé manquante retombant sur l'anglais ;
 *   · le TEXTE de l'avis est celui que le moteur a localisé — l'interface ne traduit rien ;
 *   · la PORTÉE s'affiche comme un NOM de compagnie ou « toutes les compagnies », jamais comme un
 *     identifiant `airline_…` ;
 *   · la CITATION officielle est rendue telle quelle, dans sa langue d'origine (`lang`) : la
 *     traduire l'interpréterait, et c'est tout le sens de `quote_language` ;
 *   · un avis ne PEUT PAS se lire comme un refus — aucun canal du rapport ne bouge ;
 *   · sans avis, la section n'existe pas (un bloc vide dirait « nous avons regardé, rien à dire »).
 */
const { loadHomeParts, resolveEndpointFrom, pickDestinationLabel, buildDom, flush } = require("./test-lib/finder-dom.cjs");

const LOCALES = [{ code: "en", dir: "" }, { code: "fr", dir: "fr" }, { code: "es", dir: "es" }, { code: "pt", dir: "pt" }];

/* Libellés ATTENDUS, en toutes lettres — alignés sur packages/knowledge/translations/<loc>/strings.json.
   S'ils changent, c'est une décision éditoriale, et elle doit se voir ici. */
const EXPECTED = {
  en: { titre: "Safety advisories", global: "All airlines", canaux: "Concerns", hold: "Hold", cargo: "Cargo" },
  fr: { titre: "Avis de sécurité", global: "Toutes les compagnies", canaux: "Concerne", hold: "Soute", cargo: "Fret" },
  es: { titre: "Avisos de seguridad", global: "Todas las aerolíneas", canaux: "Afecta a", hold: "Bodega", cargo: "Carga" },
  pt: { titre: "Avisos de segurança", global: "Todas as companhias", canaux: "Diz respeito a", hold: "Porão", cargo: "Carga" },
};

/* Le texte de l'avis est LOCALISÉ PAR LE MOTEUR : le rapport simulé porte donc quatre phrases
   distinctes, et le rendu doit publier celle de la langue demandée — sans jamais la fabriquer. */
const TEXTE = {
  en: "IATA advises against transporting snub-nosed dogs in hot season.",
  fr: "L'IATA déconseille le transport des chiens au museau écrasé en saison chaude.",
  es: "La IATA desaconseja transportar perros de hocico chato en temporada calurosa.",
  pt: "A IATA desaconselha o transporte de cães de focinho achatado em época quente.",
};
const CITATION = "Transport of snub nose dogs, such as boxers, pugs, bulldogs and Pekinese, in hot season is not recommended.";
const URL_IATA = "https://www.iata.org/en/programs/cargo/live-animals/pets/";
const CITATION_CIE = "Snub-nosed breeds travel in the hold only with a veterinary certificate.";
const URL_CIE = "https://exemple-compagnie.example/pets";

const SOURCE = (url, quote) => ({
  url, source_type: "official_website", verified_date: "2026-08-16", review_due: "2027-02-12",
  confidence: 4, reviewer: "harnais T0-B3-a", history: [], quote, quote_language: "en",
});

const CARTE = {
  airline_id: "airline_air_france", name: "Air France",
  direct: true, cabin: true, hold: true, cargo: true,
  cabin_status: "allowed", hold_status: "allowed", cargo_status: "allowed",
  placement_decisions: [
    { placement: "cabin", status: "allowed", allowed: true },
    { placement: "hold", status: "allowed", allowed: true },
    { placement: "cargo", status: "allowed", allowed: true },
  ],
  label: "OK", carrier_of_origin: false, carrier_of_destination: false,
  itinerary_confidence: "direct_documented", heat_embargo: false, fee: "",
};

const RAPPORT = (locale, avis) => ({
  verdict: "compatible", confidence: 4, score: 80,
  positives: [], conditions: [], domestic: false, climate: null,
  warnings: [], risks: [], alternatives: [], partners: [],
  airlines: [CARTE],
  safety_advisories: avis,
  sources: [],
});

const AVIS = (locale) => [
  { restriction_ref: "brest_iata_snub_nose_hot_season", scope: "global",
    placements: ["hold", "cargo"], text: TEXTE[locale], source: SOURCE(URL_IATA, CITATION) },
  { restriction_ref: "brest_af_snub_nose", scope: "airline_air_france",
    placements: ["hold"], text: TEXTE[locale], source: SOURCE(URL_CIE, CITATION_CIE) },
];

let failures = 0;
function check(label, cond, detail) {
  if (cond) { console.log("  OK   " + label); }
  else { console.log("  FAIL " + label); if (detail) console.log("         reçu : " + detail); failures++; }
}

/** Soumet le formulaire du Finder et rend le DOM obtenu pour le rapport fourni. */
async function rendre(parts, rapport) {
  const fetchMock = async (url, opts) => {
    if (String(url).includes("/nearest-airport")) return { ok: false };
    if (opts && opts.method === "POST") return { ok: true, json: async () => rapport };
    throw new Error("fetch inattendu : " + url);
  };
  const dom = buildDom(parts, fetchMock);
  const { window } = dom;
  const form = window.document.getElementById("mdcf-finder");
  const originEl = window.document.getElementById("f-origin");
  const destEl = window.document.getElementById("f-dest");
  const originIds = resolveEndpointFrom(parts.labels, originEl.value).ids;
  destEl.value = pickDestinationLabel(parts.labels, originIds);
  /* Le poids est OBLIGATOIRE côté formulaire : sans lui la requête n'est pas construite et aucun
     rapport n'est rendu — le harnais passerait alors « au vert » sur un DOM vide. */
  window.document.getElementById("f-weight").value = "8";
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await flush();
  return dom;
}

async function main() {
  for (const { code, dir } of LOCALES) {
    console.log("\n=== langue : " + code + " ===");
    const parts = loadHomeParts(dir);
    const E = EXPECTED[code];

    const dom = await rendre(parts, RAPPORT(code, AVIS(code)));
    const doc = dom.window.document;
    const sec = doc.querySelector(".report__sec.safety");
    check("la section des avis est rendue", !!sec);
    if (!sec) { continue; }

    const items = [...sec.querySelectorAll(".safety__item")];
    const texte = (n) => (n ? n.textContent.replace(/\s+/g, " ").trim() : "");

    check(`titre « ${E.titre} » — exactement, pas un repli anglais`,
      texte(sec.querySelector("h4")) === E.titre, texte(sec.querySelector("h4")));
    check("deux avis rendus — le global et celui de la compagnie", items.length === 2,
      String(items.length));

    /* 1 · Le texte vient du MOTEUR, déjà localisé. */
    check("le texte publié est celui que le moteur a localisé pour cette langue",
      items.every((li) => texte(li.querySelector(".safety__text")) === TEXTE[code]),
      items.map((li) => texte(li.querySelector(".safety__text"))).join(" | "));
    /* Le contrôle qui attrape une inversion de langues : le texte d'UNE AUTRE langue n'apparaît pas. */
    const autres = Object.entries(TEXTE).filter(([l]) => l !== code).map(([, v]) => v);
    check("aucun texte d'une autre langue ne traîne dans la section",
      !autres.some((t) => texte(sec).includes(t)));

    /* 2 · La portée : un NOM, jamais un identifiant. */
    const metas = items.map((li) => texte(li.querySelector(".safety__meta")));
    check(`l'avis global s'annonce « ${E.global} »`, metas.some((m) => m.startsWith(E.global)), metas.join(" | "));
    check("l'avis de compagnie s'annonce par son NOM (« Air France »)",
      metas.some((m) => m.startsWith("Air France")), metas.join(" | "));
    check("aucun identifiant `airline_…` n'est montré au visiteur",
      !texte(sec).includes("airline_"), texte(sec).slice(0, 200));

    /* 3 · Les canaux concernés, avec les libellés de la langue. */
    check(`les canaux sont nommés dans la langue (« ${E.hold} », « ${E.cargo} ») et introduits par « ${E.canaux} »`,
      metas.some((m) => m.includes(E.canaux) && m.includes(E.hold) && m.includes(E.cargo)),
      metas.join(" | "));
    check("l'avis de compagnie ne cite QUE son canal (soute), pas le fret",
      (() => {
        const cie = items.find((li) => texte(li.querySelector(".safety__meta")).startsWith("Air France"));
        const m = texte(cie && cie.querySelector(".safety__meta"));
        return m.includes(E.hold) && !m.includes(E.cargo);
      })(), metas.join(" | "));

    /* 4 · La citation officielle, telle quelle et dans SA langue. */
    const citations = [...sec.querySelectorAll(".safety__quote")];
    check("chaque avis porte sa citation officielle, mot pour mot",
      citations.length === 2
        && citations.some((q) => texte(q).includes(CITATION))
        && citations.some((q) => texte(q).includes(CITATION_CIE)),
      citations.map(texte).join(" | "));
    check("la citation est marquée dans la langue de la SOURCE, jamais traduite",
      citations.every((q) => q.getAttribute("lang") === "en"),
      citations.map((q) => q.getAttribute("lang")).join(","));

    /* 5 · La source, cliquable et vers la page officielle. */
    const liens = [...sec.querySelectorAll(".safety__src a")].map((a) => a.getAttribute("href"));
    check("chaque avis renvoie à sa page officielle",
      liens.includes(URL_IATA) && liens.includes(URL_CIE), liens.join(" | "));

    /* 6 · UN AVIS N'EST PAS UN REFUS. Le canal reste ouvert, et le rapport ne se dégrade pas. */
    const sansAvis = await rendre(parts, RAPPORT(code, []));
    const rep = (d) => d.window.document.querySelector(".report");
    check("aucun avis → la section n'existe pas du tout (un bloc vide dirait autre chose)",
      !sansAvis.window.document.querySelector(".report__sec.safety"));
    check("le verdict de la carte est le même avec et sans avis — un conseil ne ferme rien",
      rep(dom).className === rep(sansAvis).className,
      `${rep(dom).className} vs ${rep(sansAvis).className}`);
    const statuts = (d) => [...d.window.document.querySelectorAll(".acard")]
      .map((c) => c.textContent.replace(/\s+/g, " ").trim()).join(" || ");
    check("les cartes compagnie sont identiques avec et sans avis",
      statuts(dom) === statuts(sansAvis));
  }

  console.log(failures === 0 ? "\nTous les contrôles passent." : `\n${failures} contrôle(s) en échec.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
