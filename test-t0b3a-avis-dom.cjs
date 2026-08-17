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
  en: { titre: "Safety advisories", global: "All airlines", canaux: "Concerns", hold: "Hold", cargo: "Cargo",
        note: "Advice, not a refusal: it does not change the statuses shown below. The official wording is quoted under each advisory." },
  fr: { titre: "Avis de sécurité", global: "Toutes les compagnies", canaux: "Concerne", hold: "Soute", cargo: "Fret",
        note: "Un conseil, pas un refus : il ne modifie pas les statuts affichés ci-dessous. La formulation officielle est citée sous chaque avis." },
  es: { titre: "Avisos de seguridad", global: "Todas las aerolíneas", canaux: "Afecta a", hold: "Bodega", cargo: "Carga",
        note: "Un consejo, no una negativa: no modifica los estados que se muestran abajo. La formulación oficial se cita debajo de cada aviso." },
  pt: { titre: "Avisos de segurança", global: "Todas as companhias", canaux: "Diz respeito a", hold: "Porão", cargo: "Carga",
        note: "Um conselho, não uma recusa: não altera os estados apresentados abaixo. A formulação oficial é citada abaixo de cada aviso." },
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

/* UNE CARTE AUX TROIS STATUTS DIFFÉRENTS. La v1 du harnais donnait trois canaux `allowed` : elle
   ne pouvait donc pas voir que la note « ces canaux restent ouverts » était FAUSSE. Un avis ne
   déplace aucun statut, mais les canaux qu'il vise peuvent être refusés ou à confirmer pour de
   tout autres raisons — poids, politique, entrée du pays. La fixture les mélange donc.

   Le mélange est LUI-MÊME vérifié plus bas, sur les classes que le rendu pose (`ab--ok`,
   `ab--confirm`, `ab--no`) : retirer n'importe lequel des trois statuts d'ici doit faire sortir ce
   harnais en code 1. */
const CARTE = {
  airline_id: "airline_air_france", name: "Air France",
  direct: true, cabin: true, hold: false, cargo: false,
  cabin_status: "allowed", hold_status: "confirmation_required", cargo_status: "denied",
  to_confirm: ["hold"],
  placement_decisions: [
    { placement: "cabin", status: "allowed", allowed: true },
    { placement: "hold", status: "confirmation_required", allowed: false,
      confirmation_causes: [{ code: "policy_unpublished", policy_ref: "airline_air_france#hold" }] },
    { placement: "cargo", status: "denied", allowed: false },
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

    /* 5 · LA NOTE dit ce qu'un avis fait, et rien de plus. */
    check(`la note est celle de la langue, en toutes lettres`,
      texte(sec.querySelector(".safety__note")) === E.note, texte(sec.querySelector(".safety__note")));
    check("la note ne prétend PAS que les canaux visés sont ouverts",
      !/reste[nt]? ouvert|stay open|siguen abiertos|continuam abertos/i.test(texte(sec.querySelector(".safety__note"))),
      texte(sec.querySelector(".safety__note")));

    /* 5 bis · Et la carte porte bien UN BADGE DE CHAQUE CLASSE — sans quoi la note ci-dessus
       serait vérifiée sur un cas où elle ne risque rien.
       La v1 de ce contrôle cherchait un mot de la famille « confirmer » dans le texte de la carte :
       remplacer le fret `denied` par `allowed` — donc retirer tout statut refusé de la fixture — la
       laissait verte. Un contrôle qui prétend voir trois statuts et n'en cherche qu'un est un faux
       vert. On lit donc les classes que le rendu POSE, une par statut, et on exige exactement une
       de chaque. */
    {
      const c = doc.querySelector(".acard");
      const compte = (cls) => (c ? c.querySelectorAll(cls).length : 0);
      const vus = { "ab--ok": compte(".ab--ok"), "ab--confirm": compte(".ab--confirm"), "ab--no": compte(".ab--no") };
      check("la carte porte EXACTEMENT un badge `allowed`, un « à confirmer » et un `denied`",
        !!c && vus["ab--ok"] === 1 && vus["ab--confirm"] === 1 && vus["ab--no"] === 1,
        JSON.stringify(vus));
    }

    /* 6 · La source, cliquable et vers la page officielle. */
    const liens = [...sec.querySelectorAll(".safety__src a")].map((a) => a.getAttribute("href"));
    check("chaque avis renvoie à sa page officielle",
      liens.includes(URL_IATA) && liens.includes(URL_CIE), liens.join(" | "));

    /* 7 · UN AVIS NE DÉPLACE AUCUN STATUT — ce qui n'est pas dire que les canaux sont ouverts. */
    const sansAvis = await rendre(parts, RAPPORT(code, []));
    const rep = (d) => d.window.document.querySelector(".report");
    check("aucun avis → la section n'existe pas du tout (un bloc vide dirait autre chose)",
      !sansAvis.window.document.querySelector(".report__sec.safety"));
    check("le verdict de la carte est le même avec et sans avis — un conseil ne ferme rien",
      rep(dom).className === rep(sansAvis).className,
      `${rep(dom).className} vs ${rep(sansAvis).className}`);
    const statuts = (d) => [...d.window.document.querySelectorAll(".acard")]
      .map((c) => c.textContent.replace(/\s+/g, " ").trim()).join(" || ");
    check("les cartes compagnie sont identiques avec et sans avis, statuts mêlés compris",
      statuts(dom) === statuts(sansAvis));

    /* 8 · LES DEUX ÉTATS QUE L'INTERFACE DOIT REFUSER, pas rendre à moitié. */
    {
      const sansChamp = RAPPORT(code, []);
      delete sansChamp.safety_advisories;
      const d1 = await rendre(parts, sansChamp);
      check("`safety_advisories` ABSENT → rapport refusé, pas rendu « sans avis »",
        !d1.window.document.querySelector(".report"),
        texte(d1.window.document.querySelector(".report")).slice(0, 160));

      const orphelin = RAPPORT(code, [{ ...AVIS(code)[1], scope: "airline_absente_du_rapport" }]);
      const d2 = await rendre(parts, orphelin);
      const sec2 = d2.window.document.querySelector(".report__sec.safety");
      check("portée ORPHELINE → rapport refusé, et surtout JAMAIS élargi à « toutes les compagnies »",
        !d2.window.document.querySelector(".report") && !sec2,
        sec2 ? texte(sec2).slice(0, 200) : "");
    }
  }

  console.log(failures === 0 ? "\nTous les contrôles passent." : `\n${failures} contrôle(s) en échec.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
