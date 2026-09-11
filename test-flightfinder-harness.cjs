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
/* Le chargement du DOM du Finder (HTML construit, bundle hissé, imports neutralisés, fetch mocké)
   vit dans `test-lib/finder-dom.cjs` : `test-entity-pages-harness.mjs` s'en sert aussi, et deux
   copies de cette mécanique divergeraient au premier changement de build. */
const { DIST, loadHomeParts, norm, reKey, resolveEndpointFrom, pickDestinationLabel, stripImports, buildDom, flush } = require("./test-lib/finder-dom.cjs");

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
    /* P0-1 DE LA CONTRE-REVUE (Codex, 10/09/2026) : cette fixture ne portait que les booléens, et l'interface
       en DÉRIVAIT des statuts (« hold: false » devenait un refus). La frontière refuse désormais un rapport
       sans les trois `*_status` et les trois décisions concordantes ; la fixture dit donc ce que le repli
       disait tout bas — cabine ouverte, soute et fret refusés —, mais en toutes lettres. */
    cabin_status: "allowed", hold_status: "denied", cargo_status: "denied",
    placement_decisions: [
      { placement: "cabin", status: "allowed", allowed: true },
      { placement: "hold", status: "denied", allowed: false },
      { placement: "cargo", status: "denied", allowed: false },
    ],
    label: "OK", source_url: "", carrier_of_origin: false, carrier_of_destination: false,
    itinerary_confidence: "confirmed", heat_embargo: false, fee: "",
  }],
  /* `safety_advisories` est OBLIGATOIRE au contrat depuis T0-B3-a, et l'interface REFUSE désormais
     un rapport qui ne le porte pas — un champ obligatoire absent n'est pas un rapport vide, c'est
     un rapport qu'on ne sait pas lire. Ce fauteuil-là n'existait pas quand cette fixture a été
     écrite : sans cette ligne, elle décrit un rapport que le contrat n'admet plus. */
  safety_advisories: [],
  sources: [],
};

function ficheLinks(dom) {
  return [...dom.window.document.querySelectorAll("a.acard__fiche")].map((a) => {
    const href = a.getAttribute("href") || "";
    const frag = href.split("#")[1] || "";
    return Object.fromEntries(new URLSearchParams(frag).entries());
  });
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
/* T0-B1 : `unreviewed` est une famille DISTINCTE de `policy` — « politique de la compagnie à
 * confirmer » attribuerait à la compagnie une incertitude qui vient de NOTRE donnée héritée.
 * Les quatre textes sont figés ici comme les autres : une régression de traduction, une clé
 * portugaise manquante retombant sur l'anglais, ou une fusion des deux familles échouent. */
const T0A_LABELS = {
  en: { policy: "Airline policy to confirm before booking", missing: "Additional information needed — confirm with the airline", unreviewed: "This information has not yet been reverified against a current official source — confirm directly with the airline before booking." },
  fr: { policy: "Politique de la compagnie à confirmer avant de réserver", missing: "Information supplémentaire nécessaire — confirme auprès de la compagnie", unreviewed: "Cette information n'a pas encore été revérifiée à partir d'une source officielle à jour — confirme-la directement auprès de la compagnie avant de réserver." },
  es: { policy: "Política de la aerolínea a confirmar antes de reservar", missing: "Se necesita información adicional: confirma con la aerolínea", unreviewed: "Esta información aún no se ha vuelto a verificar a partir de una fuente oficial actualizada; confírmala directamente con la aerolínea antes de reservar." },
  pt: { policy: "Política da companhia a confirmar antes de reservar", missing: "Informação adicional necessária — confirma com a companhia", unreviewed: "Esta informação ainda não foi verificada novamente com base numa fonte oficial atualizada — confirma-a diretamente com a companhia antes de reservar." },
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
/* ---- CARTES DU FINDER — LE CONTRAT D'INTERFACE ARBITRÉ PAR PHILIPPE (10/09/2026, annexe 38) --------------
 * La réponse d'abord, la condition tout de suite après, le tarif quand il est établi, la preuve sans envahir
 * l'écran ; une information n'apparaît qu'une fois ; le fret replié quand rien n'est publié ; les avertissements
 * généraux une seule fois au-dessus des cartes. Fixtures, quatre langues, textes EXACTS. */
/* La quatrième phrase de justification interne (« page officielle, aucune citation ») vit ici depuis l'annexe 42 :
   elle n'est plus rendue nulle part, et c'est ce que les témoins exigent — il faut donc la connaître pour la chercher. */
const CARTE_LABELS = {
  en: { officialLink: "An official airline page covers this channel, but no sentence has been quoted from it yet", confirm: "to be confirmed", yesCond: "yes, under conditions", no: "no", quiet: "information not published", fareConfirm: "fare to confirm", fareQuote: "on quotation", proofs: "See the evidence", prov: "Verified on an official source on", limit: "up to 75 kg" },
  fr: { officialLink: "Une page officielle de la compagnie couvre ce canal, mais aucune phrase n'en a encore été citée", confirm: "à confirmer", yesCond: "oui, sous conditions", no: "non", quiet: "informations non publiées", fareConfirm: "tarif à confirmer", fareQuote: "sur devis", proofs: "Voir les preuves", prov: "Vérifié sur une source officielle le", limit: "jusqu'à 75 kg" },
  es: { officialLink: "Una página oficial de la aerolínea cubre este canal, pero aún no se ha citado ninguna frase", confirm: "a confirmar", yesCond: "sí, bajo condiciones", no: "no", quiet: "información no publicada", fareConfirm: "tarifa a confirmar", fareQuote: "bajo presupuesto", proofs: "Ver las pruebas", prov: "Verificado en una fuente oficial el", limit: "hasta 75 kg" },
  pt: { officialLink: "Uma página oficial da companhia cobre este canal, mas ainda não foi citada nenhuma frase", confirm: "a confirmar", yesCond: "sim, sob condições", no: "não", quiet: "informações não publicadas", fareConfirm: "tarifa a confirmar", fareQuote: "sob orçamento", proofs: "Ver as provas", prov: "Fonte oficial verificada em", limit: "até 75 kg" },
};
const SRC_SOUTE = { url: "https://www.airfrance.com/pets", source_type: "official_website", verified_date: "2026-09-08", confidence: 4 };
const carteContrat = (over) => ({
  ...FAKE_REPORT.airlines[0], airline_id: "airline_contrat", name: "Contrat Air",
  /* ERREUR NOMMÉE (10/09/2026, P0 second passage de Codex) : cette fixture posait `hold: true` sur une soute « sous
     conditions ». Le moteur, lui, ne met un booléen à `true` que pour `allowed` (explain.ts, `has`) : la fixture masquait
     donc le repli booléen de l'apparence. Les booléens disent désormais ce que le moteur dirait — tous faux. */
  cabin: false, hold: false, cargo: false,
  cabin_status: "confirmation_required", hold_status: "accepted_with_conditions", cargo_status: "confirmation_required",
  to_confirm: ["cabin", "cargo"], carries_pets: true, offers_pet_transport: true, heat_confirmation_required: false,
  placement_decisions: [
    { placement: "cabin", status: "confirmation_required", allowed: false, confirmation_causes: [{ code: "official_source_unquoted", policy_ref: "airline_contrat#cabin" }] },
    { placement: "hold", status: "accepted_with_conditions", allowed: false, weight_limit_kg: 75, weight_limit_includes_carrier: true, source: SRC_SOUTE },
    { placement: "cargo", status: "confirmation_required", allowed: false, confirmation_causes: [{ code: "legacy_unreviewed", policy_ref: "airline_contrat#cargo" }] },
  ],
  ...over,
});
async function cartesPass() {
  for (const loc of BADGE_LOCALES) {
    console.log(`\n— Cartes : contrat d'interface (${loc.code}) —`);
    const X = CARTE_LABELS[loc.code];
    const rendre = async (card0, placement = "any") => {
      const parts = loadHomeParts(loc.dir);
      const rep = { ...FAKE_REPORT, airlines: [card0] };
      const fetchMock = async (url, opts) => {
        if (String(url).includes("/nearest-airport")) return { ok: false };
        if (opts && opts.method === "POST") return { ok: true, json: async () => rep };
        throw new Error("unexpected fetch: " + url);
      };
      const dom = buildDom(parts, fetchMock);
      const { window } = dom;
      const originEl = window.document.getElementById("f-origin");
      const destEl = window.document.getElementById("f-dest");
      const originIds = resolveEndpointFrom(parts.labels, originEl.value).ids;
      destEl.value = pickDestinationLabel(parts.labels, originIds);
      window.document.getElementById("f-weight").value = "8";
      const sel = window.document.getElementById("f-placement");
      if (sel) sel.value = placement;
      window.document.getElementById("mdcf-finder").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
      await flush();
      const doc = window.document;
      const card = doc.querySelector(".acard");
      return { doc, card, txt: card ? card.textContent.replace(/\s+/g, " ") : "" };
    };
    const ligne = (card, ch) => card?.querySelector(`.acard__line--${ch}`);
    const texteDe = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

    /* 1. La carte de référence : cabine à confirmer, soute sous conditions (75 kg, source du 08/09), fret non publié. */
    const { doc, card, txt } = await rendre(carteContrat({}));
    check(`${loc.code} : une carte est rendue`, !!card);
    if (!card) continue;
    check(`${loc.code} : trois lignes canal, cabine et soute toujours visibles`, !!ligne(card, "cabin") && !!ligne(card, "hold") && !!ligne(card, "cargo"));
    check(`${loc.code} : « Cabine : à confirmer » — la réponse d'abord`, texteDe(ligne(card, "cabin")).endsWith(X.confirm), texteDe(ligne(card, "cabin")));
    const soute = texteDe(ligne(card, "hold"));
    check(`${loc.code} : « Soute : oui, sous conditions · jusqu'à 75 kg … · tarif à confirmer » — la condition immédiatement après, le tarif sans montant`,
      soute.includes(X.yesCond) && soute.includes(X.limit) && soute.includes(X.fareConfirm) && !/\d+\s?€|\$\s?\d+|EUR|USD/.test(soute), soute);
    check(`${loc.code} : le fret non publié est REPLIÉ en une ligne discrète`, ligne(card, "cargo").classList.contains("acard__line--quiet") && texteDe(ligne(card, "cargo")).endsWith(X.quiet), texteDe(ligne(card, "cargo")));
    check(`${loc.code} : le fret replié ne porte pas de tarif`, !texteDe(ligne(card, "cargo")).includes(X.fareQuote) && !texteDe(ligne(card, "cargo")).includes(X.fareConfirm));
    check(`${loc.code} : les pastilles de statut restent, une par canal (à confirmer ×2, sous conditions ×1)`,
      card.querySelectorAll(".ab--confirm").length === 2 && card.querySelectorAll(".ab--cond").length === 1 && card.querySelectorAll(".ab--no").length === 0);
    /* Une information une fois : le plafond n'est écrit qu'une fois dans la carte, et les anciens blocs ont disparu. */
    check(`${loc.code} : le plafond de poids n'apparaît qu'UNE fois dans la carte`, txt.split(X.limit).length === 2, txt);
    check(`${loc.code} : plus de badges, de ligne de verdict, de lignes d'acceptation/refus, de ligne de sources ni de bloc tarifaire séparés`,
      !card.querySelector(".acard__badges, .acard__label, .acard__accepted, .acard__denied, .acard__psrc, .acard__fee, .acard__tarif, .acard__confirmwhy"));
    /* La provenance nomme ses canaux. */
    const prov = card.querySelector(".acard__prov");
    const provTxt = texteDe(prov?.querySelector(".acard__prov-text"));
    check(`${loc.code} : UNE ligne de provenance, qui nomme le canal prouvé (la soute) et sa date`, !!prov && provTxt.startsWith(X.prov) && /2026/.test(provTxt) && provTxt.includes(texteDe(ligne(card, "hold")).split(" ")[0]), provTxt);
    check(`${loc.code} : …et ne nomme PAS la cabine ni le fret (non prouvés)`, !!prov && !provTxt.includes(texteDe(ligne(card, "cabin")).split(" ")[0]) && !provTxt.includes(texteDe(ligne(card, "cargo")).split(" ")[0]), provTxt);
    const det = card.querySelector("details.acard__proofs");
    check(`${loc.code} : le volet « Voir les preuves » existe, FERMÉ, et porte la page officielle, la date et la confiance`,
      !!det && !det.hasAttribute("open") && texteDe(det.querySelector("summary")) === X.proofs && !!det.querySelector(`a[href="${SRC_SOUTE.url}"]`) && /2026-09-08/.test(texteDe(det)) && /4\/5/.test(texteDe(det)), texteDe(det));
    check(`${loc.code} : le volet renvoie à la fiche détaillée pour la citation intégrale`, !!det && !!det.querySelector(".acard__proofs-fiche a[href*='/tools/fiche/']"));
    /* RE-FONDÉ (10/09/2026, arbitrage de Philippe, annexe 42) : les avertissements généraux étaient rendus une fois
       au-dessus des cartes ; ils ne sont plus rendus du tout. Ce témoin exigeait leur présence — il exige leur absence,
       et celle des quatre phrases partout dans le rapport, la ligne canal restant seule à porter l'incertitude. */
    const doc0 = doc.querySelector("#mdcf-finder-result");
    const rapportTxt = doc0 ? doc0.textContent.replace(/\s+/g, " ") : "";
    check(`${loc.code} : aucun bloc d'avertissements généraux au-dessus des cartes`, !doc.querySelector(".acards__notes") && !doc.querySelector(".acards__note"));
    const QUATRE = [T0A_LABELS[loc.code].unreviewed, T0A_LABELS[loc.code].policy, T0A_LABELS[loc.code].missing, CARTE_LABELS[loc.code].officialLink];
    check(`${loc.code} : aucune des quatre phrases de justification interne n'apparaît dans le rapport`,
      QUATRE.every((ph) => !rapportTxt.includes(ph)), QUATRE.filter((ph) => rapportTxt.includes(ph)).join(" ‖ ").slice(0, 200));
    check(`${loc.code} : la ligne cabine porte seule l'incertitude — « ${X.confirm} », sans paragraphe`,
      texteDe(ligne(card, "cabin")).endsWith(X.confirm) && !txt.includes(T0A_LABELS[loc.code].unreviewed) && !txt.includes(T0A_LABELS[loc.code].policy));

    /* 2. Le fret se développe quand il est documenté (sous conditions, cité) : « Fret : oui, sous conditions · sur devis ». */
    const r2 = await rendre(carteContrat({ cargo: true, cargo_status: "accepted_with_conditions", to_confirm: ["cabin"], placement_decisions: [
      { placement: "cabin", status: "confirmation_required", allowed: false, confirmation_causes: [{ code: "official_source_unquoted", policy_ref: "x" }] },
      { placement: "hold", status: "accepted_with_conditions", allowed: false, weight_limit_kg: 75, weight_limit_includes_carrier: true, source: SRC_SOUTE },
      { placement: "cargo", status: "accepted_with_conditions", allowed: false, source: { ...SRC_SOUTE, verified_date: "2026-09-09" } },
    ] }));
    const fret2 = texteDe(ligne(r2.card, "cargo"));
    check(`${loc.code} : fret documenté → développé, « oui, sous conditions · sur devis », jamais un montant`, !ligne(r2.card, "cargo").classList.contains("acard__line--quiet") && fret2.includes(X.yesCond) && fret2.includes(X.fareQuote), fret2);
    /* P1 DE LA CONTRE-REVUE (Codex, 10/09/2026) : ce témoin ne comptait que deux occurrences de la formule. Il exige
       désormais les deux ASSOCIATIONS date ↔ canal : le segment daté du 8 septembre nomme la soute et pas le fret,
       celui du 9 septembre nomme le fret et pas la soute. Les dates sont rendues comme la carte les rend (Intl, langue
       de la page), le canal est le premier mot de sa propre ligne. */
    const lisible = (iso) => new Intl.DateTimeFormat(loc.code, { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso + "T00:00:00Z"));
    const capSoute = texteDe(ligne(r2.card, "hold")).split(" ")[0], capFret = texteDe(ligne(r2.card, "cargo")).split(" ")[0];
    const segments = texteDe(r2.card.querySelector(".acard__prov-text")).split(" · ");
    const seg8 = segments.find((x) => x.includes(lisible("2026-09-08"))), seg9 = segments.find((x) => x.includes(lisible("2026-09-09")));
    check(`${loc.code} : deux dates de vérification → deux segments, « ${lisible("2026-09-08")} : ${capSoute} » et « ${lisible("2026-09-09")} : ${capFret} », chacun avec SON canal seulement`,
      segments.length === 2 && !!seg8 && !!seg9 && seg8.startsWith(X.prov) && seg9.startsWith(X.prov)
        && seg8.includes(capSoute) && !seg8.includes(capFret) && seg9.includes(capFret) && !seg9.includes(capSoute),
      segments.join(" || "));

    /* 3. Le fret se développe quand il est le seul canal restant (cabine et soute refusées). */
    const r3 = await rendre(carteContrat({ hold: false, cabin_status: "denied", hold_status: "denied", to_confirm: ["cargo"], placement_decisions: [
      { placement: "cabin", status: "denied", allowed: false, source: SRC_SOUTE },
      { placement: "hold", status: "denied", allowed: false, source: SRC_SOUTE },
      { placement: "cargo", status: "confirmation_required", allowed: false, confirmation_causes: [{ code: "legacy_unreviewed", policy_ref: "x" }] },
    ] }));
    check(`${loc.code} : cabine et soute refusées → « non » en toutes lettres, et le fret se développe (« à confirmer »)`,
      texteDe(ligne(r3.card, "cabin")).endsWith(X.no) && texteDe(ligne(r3.card, "hold")).endsWith(X.no) && !ligne(r3.card, "cargo").classList.contains("acard__line--quiet") && texteDe(ligne(r3.card, "cargo")).endsWith(X.confirm),
      [texteDe(ligne(r3.card, "cabin")), texteDe(ligne(r3.card, "hold")), texteDe(ligne(r3.card, "cargo"))].join(" | "));
    check(`${loc.code} : un refus n'a pas de tarif`, !texteDe(ligne(r3.card, "cabin")).includes(X.fareConfirm));

    /* 4. Le fret se développe quand il est DEMANDÉ (préférence « fret » du formulaire), même non publié. */
    const r4 = await rendre(carteContrat({}), "cargo");
    check(`${loc.code} : fret demandé → développé, « à confirmer » (pas la ligne discrète)`, !!ligne(r4.card, "cargo") && !ligne(r4.card, "cargo").classList.contains("acard__line--quiet") && texteDe(ligne(r4.card, "cargo")).endsWith(X.confirm), texteDe(ligne(r4.card, "cargo")));

    /* 5. Une approbation au cas par cas n'est pas « rien de publié » : développé, « à confirmer ». */
    const r5 = await rendre(carteContrat({ placement_decisions: [
      { placement: "cabin", status: "confirmation_required", allowed: false, confirmation_causes: [{ code: "official_source_unquoted", policy_ref: "x" }] },
      { placement: "hold", status: "accepted_with_conditions", allowed: false, weight_limit_kg: 75, weight_limit_includes_carrier: true, source: SRC_SOUTE },
      { placement: "cargo", status: "confirmation_required", allowed: false, confirmation_causes: [{ code: "airline_approval", policy_ref: "x" }] },
    ] }));
    check(`${loc.code} : fret au cas par cas → développé, « à confirmer »`, !ligne(r5.card, "cargo").classList.contains("acard__line--quiet") && texteDe(ligne(r5.card, "cargo")).endsWith(X.confirm), texteDe(ligne(r5.card, "cargo")));

    /* 6. Sans aucune source : pas de ligne de provenance, pas de volet — rien n'est prétendu vérifié. */
    const r6 = await rendre(carteContrat({ placement_decisions: [
      { placement: "cabin", status: "confirmation_required", allowed: false, confirmation_causes: [{ code: "legacy_unreviewed", policy_ref: "x" }] },
      { placement: "hold", status: "confirmation_required", allowed: false, confirmation_causes: [{ code: "legacy_unreviewed", policy_ref: "x" }] },
      { placement: "cargo", status: "confirmation_required", allowed: false, confirmation_causes: [{ code: "legacy_unreviewed", policy_ref: "x" }] },
    ], hold: false, hold_status: "confirmation_required", to_confirm: ["cabin", "hold", "cargo"] }));
    check(`${loc.code} : aucune source → aucune ligne de provenance ni volet`, !!r6.card && !r6.card.querySelector(".acard__prov") && !r6.card.querySelector("details.acard__proofs"));

    /* 7. P1 (Codex, 10/09/2026) : un FAIT MANQUANT n'est pas « rien de publié » — le fret reste développé, « à confirmer ». */
    const r7 = await rendre(carteContrat({ placement_decisions: [
      { placement: "cabin", status: "confirmation_required", allowed: false, confirmation_causes: [{ code: "official_source_unquoted", policy_ref: "x" }] },
      { placement: "hold", status: "accepted_with_conditions", allowed: false, weight_limit_kg: 75, weight_limit_includes_carrier: true, source: SRC_SOUTE },
      { placement: "cargo", status: "confirmation_required", allowed: false, confirmation_causes: [{ code: "missing_fact", fact: "transport.total_weight_kg", requirement_ref: "req_x" }] },
    ] }));
    check(`${loc.code} : fret sur fait manquant → développé, « à confirmer » (pas la ligne discrète)`, !!ligne(r7.card, "cargo") && !ligne(r7.card, "cargo").classList.contains("acard__line--quiet") && texteDe(ligne(r7.card, "cargo")).endsWith(X.confirm), texteDe(ligne(r7.card, "cargo")));

    /* 8. P0-1 (Codex, 10/09/2026) : UN RAPPORT INCOMPLET PRODUIT L'ERREUR PRUDENTE, JAMAIS « CABINE : NON ».
       Trois amputations d'une réponse par ailleurs réelle : le statut cabine retiré ; le statut cabine discordant
       de sa décision ; la décision fret absente. Chacune doit rendre `.finder__error` et AUCUNE carte. */
    /* Premier jet fautif, nommé : je passais la carte amputée à `carteContrat(...)`, dont le gabarit REMETTAIT
       `cabin_status: "confirmation_required"` — le témoin « sans cabin_status » rendait une carte complète et
       rougissait sur sa propre erreur. L'amputation s'applique désormais APRÈS le gabarit. */
    const incomplet = (nom, amputer) => rendre(amputer(carteContrat({}))).then(({ doc, card, txt }) => {
      const err = doc.querySelector("#mdcf-finder-result .finder__error");
      check(`${loc.code} : rapport ${nom} → erreur prudente, aucune carte, jamais « ${X.no} »`,
        !!err && !card && !doc.querySelector("#mdcf-finder-result .ab--no"), card ? txt.slice(0, 160) : (err ? "" : (doc.querySelector("#mdcf-finder-result")?.textContent ?? "").slice(0, 160)));
    });
    await incomplet("sans cabin_status", (c) => { delete c.cabin_status; return c; });
    await incomplet("au statut cabine discordant de sa décision", (c) => ({ ...c, cabin_status: "denied" }));
    await incomplet("sans décision fret", (c) => ({ ...c, placement_decisions: c.placement_decisions.slice(0, 2) }));

    /* 9. P0 (Codex, 10/09/2026, second passage) : L'APPARENCE LIT LES STATUTS, JAMAIS LES BOOLÉENS NI `to_confirm`.
       Une réponse parfaitement valide — cabine refusée, soute sous conditions, fret refusé, aucun canal à confirmer —
       porte des booléens tous faux (le moteur ne les met à `true` que pour `allowed`). Elle doit être habillée en
       `acard--hold`, jamais `acard--no`, sans badge « non compatible » ni « animaux refusés » ni « ? ». */
    const DCD = carteContrat({ cabin_status: "denied", hold_status: "accepted_with_conditions", cargo_status: "denied", to_confirm: [], offers_pet_transport: "yes", placement_decisions: [
      { placement: "cabin", status: "denied", allowed: false, source: SRC_SOUTE },
      { placement: "hold", status: "accepted_with_conditions", allowed: false, weight_limit_kg: 75, weight_limit_includes_carrier: true, source: SRC_SOUTE },
      { placement: "cargo", status: "denied", allowed: false, source: SRC_SOUTE },
    ] });
    const r9 = await rendre(DCD);
    check(`${loc.code} : refusée / sous conditions / refusée (booléens tous faux) → classe acard--hold, jamais acard--no`,
      !!r9.card && r9.card.classList.contains("acard--hold") && !r9.card.classList.contains("acard--no") && !r9.card.classList.contains("acard--confirm"), r9.card?.className);
    check(`${loc.code} : …et aucun badge « non compatible », « animaux refusés » ou « ? » — la carte dit « Soute : oui, sous conditions »`,
      !!r9.card && !r9.card.querySelector(".acard__status--nomatch, .acard__status--nopets, .acard__status--petsunknown") && texteDe(ligne(r9.card, "hold")).includes(X.yesCond), r9.txt.slice(0, 160));
    /* Le partage par mode lit le statut aussi : demandée en soute, cette carte est « correspond à ce mode », pas une alternative. */
    const r9h = await rendre(DCD, "hold");
    check(`${loc.code} : demandée en soute, la soute « sous conditions » CORRESPOND au mode (pas une alternative, pas « aucune compagnie »)`,
      !!r9h.card && !!r9h.doc.querySelector("h5.acards__sub + ul.acards .acard") && !r9h.doc.querySelector("details.acards__leads") && !r9h.doc.querySelector("#mdcf-finder-result .finder__hint"), r9h.doc.querySelector("#mdcf-finder-result")?.textContent.replace(/\s+/g, " ").slice(0, 160));
    /* 10. Un canal « à confirmer » reste acard--confirm même si `to_confirm` est absent ou incohérent.
       Premier jet fautif, nommé : je partais de la carte de référence, dont la soute est OUVERTE sous conditions — un
       canal ouvert habille la carte avant tout canal à confirmer, et `acard--hold` était la bonne réponse. Le témoin
       part d'une carte dont le SEUL canal non refusé est à confirmer (cabine) : là, seule la lecture des statuts peut
       produire `acard--confirm`. */
    const SEULE_A_CONFIRMER = { cabin_status: "confirmation_required", hold_status: "denied", cargo_status: "denied", placement_decisions: [
      { placement: "cabin", status: "confirmation_required", allowed: false, confirmation_causes: [{ code: "official_source_unquoted", policy_ref: "x" }] },
      { placement: "hold", status: "denied", allowed: false, source: SRC_SOUTE },
      { placement: "cargo", status: "denied", allowed: false, source: SRC_SOUTE },
    ] };
    const sansTC = carteContrat(SEULE_A_CONFIRMER); delete sansTC.to_confirm;
    const r10 = await rendre(sansTC);
    check(`${loc.code} : canal à confirmer SANS \`to_confirm\` → acard--confirm quand même`, !!r10.card && r10.card.classList.contains("acard--confirm"), r10.card?.className);
    const r11 = await rendre(carteContrat({ ...SEULE_A_CONFIRMER, to_confirm: [] }));
    check(`${loc.code} : canal à confirmer avec \`to_confirm\` VIDE (incohérent) → acard--confirm quand même, jamais acard--no`, !!r11.card && r11.card.classList.contains("acard--confirm") && !r11.card.classList.contains("acard--no"), r11.card?.className);
    /* 11. Trois refus, aucun canal à confirmer : la carte est bien acard--no, et le badge tranche sur `offers_pet_transport`. */
    const r12 = await rendre(carteContrat({ cabin_status: "denied", hold_status: "denied", cargo_status: "denied", to_confirm: [], offers_pet_transport: "yes", placement_decisions: [
      { placement: "cabin", status: "denied", allowed: false }, { placement: "hold", status: "denied", allowed: false }, { placement: "cargo", status: "denied", allowed: false },
    ] }));
    check(`${loc.code} : trois refus → acard--no et badge « non compatible » (lu sur les trois statuts)`, !!r12.card && r12.card.classList.contains("acard--no") && !!r12.card.querySelector(".acard__status--nomatch"), r12.card?.className);
  }
}

/* Les quatre phrases de justification interne, dans la langue de la page — celles qui ne doivent plus jamais atteindre
   l'écran (arbitrage de Philippe, 10/09/2026, annexe 42). Elles sont relues des tables, jamais réécrites ici, et le
   témoin les exige NON VIDES avant de les chercher : un libellé vide rendrait chaque « absence » trivialement vraie. */
const PHRASES = (code) => [T0A_LABELS[code].unreviewed, T0A_LABELS[code].policy, T0A_LABELS[code].missing, CARTE_LABELS[code].officialLink];

async function t0aPass() {
  for (const loc of BADGE_LOCALES) {
    console.log(`\n— T0-A : les causes vivent dans les données, plus à l'écran (${loc.code}) —`);
    check(`${loc.code} : les quatre phrases cherchées sont réelles et distinctes — le témoin n'est pas vacant`,
      PHRASES(loc.code).every((ph) => typeof ph === "string" && ph.length > 25) && new Set(PHRASES(loc.code)).size === 4,
      JSON.stringify(PHRASES(loc.code).map((ph) => (ph || "").slice(0, 30))));
    const exp = T0A_LABELS[loc.code];
    const scenarios = [
      ["politique seule", t0aCard({}), (card, txt, notes, rapport) => {
        check(`${loc.code} : classe de carte correcte, lue sur le rendu`, card.className.includes("acard--confirm"), card.className);
        check(`${loc.code} : AUCUNE des quatre phrases de justification interne, ni dans la carte, ni dans le rapport`,
          PHRASES(loc.code).every((ph) => !txt.includes(ph) && !rapport.includes(ph)),
          PHRASES(loc.code).filter((ph) => txt.includes(ph) || rapport.includes(ph)).join(" ‖ ").slice(0, 220));
        check(`${loc.code} : aucun bloc d'avertissements généraux`, notes === "");
        check(`${loc.code} : aucun code interne servi au visiteur`,
          !txt.includes("legacy_unreviewed") && !txt.includes("official_source_unquoted") && !txt.includes("missing_fact") && !rapport.includes("legacy_unreviewed"), txt.slice(0, 200));
      }],
      ["fait manquant", t0aCard({
        placement_decisions: [
          { placement: "cabin", status: "denied", allowed: false },
          { placement: "hold", status: "denied", allowed: false },
          { placement: "cargo", status: "confirmation_required", allowed: false,
            confirmation_causes: [{ code: "missing_fact", fact: "transport.total_weight_kg", requirement_ref: "req_x" }] },
        ],
      }), (card, txt, notes, rapport) => {
        check(`${loc.code} : classe de carte correcte, lue sur le rendu`, card.className.includes("acard--confirm"), card.className);
        check(`${loc.code} : AUCUNE des quatre phrases de justification interne, ni dans la carte, ni dans le rapport`,
          PHRASES(loc.code).every((ph) => !txt.includes(ph) && !rapport.includes(ph)),
          PHRASES(loc.code).filter((ph) => txt.includes(ph) || rapport.includes(ph)).join(" ‖ ").slice(0, 220));
        check(`${loc.code} : aucun bloc d'avertissements généraux`, notes === "");
        check(`${loc.code} : aucun code interne servi au visiteur`,
          !txt.includes("legacy_unreviewed") && !txt.includes("official_source_unquoted") && !txt.includes("missing_fact") && !rapport.includes("legacy_unreviewed"), txt.slice(0, 200));
      }],
      ["climat seul", t0aCard({
        heat_confirmation_required: true,
        placement_decisions: [
          { placement: "cabin", status: "denied", allowed: false },
          { placement: "hold", status: "denied", allowed: false },
          { placement: "cargo", status: "confirmation_required", allowed: false,
            confirmation_causes: [{ code: "estimated_climate", rule_id: "rule_tst" }] },
        ],
      }), (card, txt, notes, rapport) => {
        check(`${loc.code} : classe de carte correcte, lue sur le rendu`, card.className.includes("acard--confirm"), card.className);
        check(`${loc.code} : AUCUNE des quatre phrases de justification interne, ni dans la carte, ni dans le rapport`,
          PHRASES(loc.code).every((ph) => !txt.includes(ph) && !rapport.includes(ph)),
          PHRASES(loc.code).filter((ph) => txt.includes(ph) || rapport.includes(ph)).join(" ‖ ").slice(0, 220));
        check(`${loc.code} : aucun bloc d'avertissements généraux`, notes === "");
        check(`${loc.code} : aucun code interne servi au visiteur`,
          !txt.includes("legacy_unreviewed") && !txt.includes("official_source_unquoted") && !txt.includes("missing_fact") && !rapport.includes("legacy_unreviewed"), txt.slice(0, 200));
      }],
      ["donnée non revérifiée seule", t0aCard({
        placement_decisions: [
          { placement: "cabin", status: "denied", allowed: false },
          { placement: "hold", status: "denied", allowed: false },
          { placement: "cargo", status: "confirmation_required", allowed: false,
            confirmation_causes: [{ code: "legacy_unreviewed", policy_ref: "airline_t0a#cargo" }] },
        ],
      }), (card, txt, notes, rapport) => {
        check(`${loc.code} : classe de carte correcte, lue sur le rendu`, card.className.includes("acard--confirm"), card.className);
        check(`${loc.code} : AUCUNE des quatre phrases de justification interne, ni dans la carte, ni dans le rapport`,
          PHRASES(loc.code).every((ph) => !txt.includes(ph) && !rapport.includes(ph)),
          PHRASES(loc.code).filter((ph) => txt.includes(ph) || rapport.includes(ph)).join(" ‖ ").slice(0, 220));
        check(`${loc.code} : aucun bloc d'avertissements généraux`, notes === "");
        check(`${loc.code} : aucun code interne servi au visiteur`,
          !txt.includes("legacy_unreviewed") && !txt.includes("official_source_unquoted") && !txt.includes("missing_fact") && !rapport.includes("legacy_unreviewed"), txt.slice(0, 200));
      }],
      ["non revérifiée ET politique sur le même canal", t0aCard({
        placement_decisions: [
          { placement: "cabin", status: "denied", allowed: false },
          { placement: "hold", status: "denied", allowed: false },
          { placement: "cargo", status: "confirmation_required", allowed: false,
            confirmation_causes: [
              { code: "legacy_unreviewed", policy_ref: "airline_t0a#cargo" },
              { code: "policy_unpublished", policy_ref: "airline_t0a#cargo" },
            ] },
        ],
      }), (card, txt, notes, rapport) => {
        check(`${loc.code} : classe de carte correcte, lue sur le rendu`, card.className.includes("acard--confirm"), card.className);
        check(`${loc.code} : AUCUNE des quatre phrases de justification interne, ni dans la carte, ni dans le rapport`,
          PHRASES(loc.code).every((ph) => !txt.includes(ph) && !rapport.includes(ph)),
          PHRASES(loc.code).filter((ph) => txt.includes(ph) || rapport.includes(ph)).join(" ‖ ").slice(0, 220));
        check(`${loc.code} : aucun bloc d'avertissements généraux`, notes === "");
        check(`${loc.code} : aucun code interne servi au visiteur`,
          !txt.includes("legacy_unreviewed") && !txt.includes("official_source_unquoted") && !txt.includes("missing_fact") && !rapport.includes("legacy_unreviewed"), txt.slice(0, 200));
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
      const notesEl = dom.window.document.querySelector(".acards__notes");
      const notes = notesEl ? notesEl.textContent.replace(/\s+/g, " ") : "";
      const resEl = dom.window.document.querySelector("#mdcf-finder-result");
      const rapport = resEl ? resEl.textContent.replace(/\s+/g, " ") : "";
      const badge = [...card.querySelectorAll(".ab--confirm")].length;
      check(`${loc.code} ${nom} : pastille « à confirmer » sur le canal à confirmer, et sur lui seul`, badge === 1, String(badge));
      asserts(card, txt, notes, rapport);
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
    /* RE-FONDÉ (10/09/2026, arbitrage de Philippe, annexe 42) : ce pass éprouvait les BADGES d'itinéraire — « Direct
       non vérifié » en un seul badge, « Correspondance » + « Itinéraire à confirmer » en deux. Ces cartes n'existent
       plus : une compagnie dont l'itinéraire n'est pas établi ne s'affiche plus et ne se compte plus. La fixture est
       inchangée (direct attesté, direct supposé, correspondance plausible) ; ce qu'on exige d'elle est renversé. */
    check(`${loc.code} : SEULE la compagnie à l'itinéraire attesté est rendue — 1 carte sur 3`,
      cards.length === 1, `${cards.length} carte(s) : ${cards.map((c) => (c.querySelector(".acard__top b") || {}).textContent || "?").join(", ")}`);
    const nomsRendus = cards.map((c) => c.textContent).join(" ‖ ");
    check(`${loc.code} : ni le direct supposé ni la correspondance plausible n'apparaissent`,
      !nomsRendus.includes("Assumed Air") && !nomsRendus.includes("Unver Air"), nomsRendus.slice(0, 200));
    check(`${loc.code} : elles ne sont pas non plus repliées dans les « pistes » — écartées, pas cachées`,
      !doc.querySelector(".acards__leads")?.textContent?.includes("Unver Air"), doc.querySelector(".acards__leads")?.textContent?.slice(0, 160) ?? "aucun repli");

    const exp = EXPECTED[loc.code];
    const statuses = cards.map((c) => [...c.querySelectorAll(".acard__status")].map((s) => s.textContent.trim()));
    console.log("         badges rendus : " + statuses.flat().join(" | "));
    check(`${loc.code} : la carte restante porte le badge du direct ATTESTÉ, ${JSON.stringify(exp.direct)}`,
      statuses.length === 1 && statuses[0].length === 1 && statuses[0][0] === exp.direct, JSON.stringify(statuses));
    check(`${loc.code} : aucun badge « ${exp.unver} » ni « ${exp.assumed} » nulle part dans le rapport`,
      !doc.querySelector("#mdcf-finder-result").textContent.includes(exp.unver)
        && !doc.querySelector("#mdcf-finder-result").textContent.includes(exp.assumed));
    check(`${loc.code} : aucune carte marquée acard--unverified`, !doc.querySelector(".acard--unverified"));
    check(`${loc.code} : le paragraphe « compagnie potentiellement pertinente… » a disparu`, !doc.querySelector(".acard__unver"));

    /* LES COMPTEURS SONT RECALCULÉS APRÈS FILTRAGE — c'est le cœur de l'arbitrage : « le filtrage doit intervenir dans
       les résultats ET dans leurs compteurs ». La fixture porte trois cartes identiques quant aux canaux (cabine
       ouverte, soute et fret fermés) : le résumé disait 3/0/0 · 0/3/0 · 0/3/0, il dit désormais 1/0/0 · 0/1/0 · 0/1/0. */
    const asum = [...doc.querySelectorAll(".asum__ch")].map((n) => (n.textContent.match(/\d+/g) || []).join("/"));
    check(`${loc.code} : le résumé par canal ne compte QUE la compagnie retenue (1/0/0 · 0/1/0 · 0/1/0)`,
      asum.length === 3 && asum[0] === "1/0/0" && asum[1] === "0/1/0" && asum[2] === "0/1/0", JSON.stringify(asum));
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
// Depuis le 08/09/2026 il NOMME les deux bornes du jour, en ISO : on les recalcule ici
// indépendamment (`expectedBounds`, plus bas) plutôt que d'accepter n'importe quelles dates.
const DATE_MSG_EN = (b) => `Choose a date between today (${b.min}) and 18 months from now (${b.max}).`;

/* CE QUE CE HARNAIS NE PROUVE PAS, ET QU'IL A LAISSÉ PASSER (08/09/2026). `runDateScenario`
   émet l'événement `submit` lui-même (`dispatchEvent`) : il passe OUTRE la validation native du
   navigateur. Or `#f-date` porte `min`/`max`, et un vrai clic sur le bouton, dans Chromium, avec
   une date passée, était arrêté par cette validation AVANT le gestionnaire : zéro requête, zéro
   message, et ce harnais restait vert. La preuve au navigateur est dans test-apercu-navigateur.mjs
   (« date hors contrat ») ; le gabarit porte désormais `novalidate`, vérifié ci-dessous. */

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
    /* Les bornes sont une AIDE, pas une garde : sans `novalidate`, une date hors bornes n'atteint
       jamais le gestionnaire dans un vrai navigateur (défaut P0 du 08/09/2026, voir plus haut). */
    const formEl = dom.window.document.getElementById("mdcf-finder");
    check("le formulaire porte `novalidate` — la garde de date vit dans le gestionnaire, pas dans le navigateur",
      !!formEl && formEl.hasAttribute("novalidate"), formEl ? formEl.outerHTML.slice(0, 80) : "(formulaire absent)");
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
    check(`${nom} (${valeur}) : le message exact est affiché, bornes du jour nommées`, r.text === DATE_MSG_EN(exp), JSON.stringify(r.text.slice(0, 120)));
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


/* ---------------------------------------------------------------------------------------------
 * MICRO-LOT PRÉLANCEMENT : les deux libellés publics du Finder.
 *
 *   1. Le lien vers le calculateur de caisse affichait `crate.name`, soit « IATA Pet Crates » —
 *      un identifiant interne de programme d'affiliation, encore au statut « placeholder »,
 *      publié tel quel en français, en espagnol et en portugais. Il suggérait de surcroît une
 *      homologation IATA que personne ne délivre : IATA publie des exigences de contenant et
 *      déclare ne certifier, n'approuver ni ne recommander aucun modèle.
 *   2. Le CTA des formalités annonçait « les 4 étapes », un 4 codé en dur, alors que la page
 *      visée en montre un nombre variable selon le pays et les données disponibles.
 *
 * La fixture GARDE `name: "IATA Pet Crates"` : sans cela le contrôle ne reproduirait pas la
 * fuite et ne prouverait rien.
 * ------------------------------------------------------------------------------------------- */
const CRATE_NAME = {
  en: "What size travel crate does my dog need?",
  fr: "Quelle taille de cage de transport pour mon chien ?",
  es: "¿Qué tamaño de transportín necesita mi perro?",
  pt: "Qual é o tamanho da caixa de transporte para o meu cachorro?",
};
/* LES RAISONS ATTENDUES, soute ET fret. Elles ne sont plus qu'une ATTENTE : la fixture reçoit
   désormais le `PartnerRef` réellement produit par `selectPartners`, obtenu en exécutant
   `test-partenaire-caisse.mjs --json`. Faute fermée, nommée : la version précédente injectait
   `reason: CRATE_REASON[loc]` puis exigeait `bloc.includes(CRATE_REASON[loc])` — modifier la
   traduction ou casser la sélection dans le moteur l'aurait laissée verte, et la branche fret
   n'était jamais exécutée alors que le lot portait sur huit textes. */
const MOTEUR = JSON.parse(require("child_process").execFileSync(
  "node", ["--import", "tsx", "test-partenaire-caisse.mjs", "--json"], { encoding: "utf8", maxBuffer: 4 << 20 }));
const CRATE_REASON = {
  hold: {
    en: "Hold travel requires a crate suited to your dog and accepted by the airline operating the flight.",
    fr: "Le voyage en soute exige une cage adaptée à ton chien et acceptée par la compagnie qui opère le vol.",
    es: "El viaje en bodega exige un transportín adecuado a tu perro y aceptado por la aerolínea que opera el vuelo.",
    pt: "Viajar no porão exige uma caixa de transporte adequada ao seu cachorro e aceita pela companhia que opera o voo.",
  },
  cargo: {
    en: "Cargo is booked with a freight agent, not at check-in: quote, drop-off and pick-up at the cargo terminal, and a crate suited to your dog, accepted by the agent and by the airline operating the flight.",
    fr: "En fret, la réservation se fait auprès d’un transitaire, pas au comptoir : devis, dépôt et retrait au terminal fret, avec une cage adaptée à ton chien et acceptée pour l’expédition.",
    es: "En carga la reserva se hace con un agente de carga, no en el mostrador: presupuesto, entrega y recogida en la terminal de carga, con un transportín adecuado a tu perro, aceptado por el agente y por la aerolínea que opera el vuelo.",
    pt: "No transporte como carga, a reserva é feita com um agente de carga, não no balcão: cotação, entrega e retirada no terminal de carga, com uma caixa adequada ao seu cachorro e aceita para o envio.",
  },
};
const CTA_STEPS = {
  en: "See the different steps",
  fr: "Voir les différentes étapes",
  es: "Ver las distintas etapas",
  pt: "Ver as diferentes etapas",
};
/* Toute homologation, conformité ou approbation IATA est interdite dans ce bloc — dans les
   quatre langues, et quelle que soit la tournure. */
const IATA_INTERDIT = /iata[- ]?(compliant|approved|certified)|conforme[s]? (?:à la norme )?iata|homologu|approuvée? par (?:l')?iata|conforme a la iata|norma iata|certificad[oa] iata/i;
/* Aucun décompte dans le CTA des formalités : ni « 4 étapes », ni un autre nombre. */
const CTA_DECOMPTE = /\b\d+\s*(steps|étapes|etapes|pasos|etapas)\b/i;

/* LES HUIT TEXTES QUE CE LOT REMPLACE, tels qu'ils étaient publiés — la matière historique du
   défaut. Le motif d'interdiction doit les reconnaître TOUS : un motif qui ne verrait pas la
   formulation d'origine ne protégerait de rien. */
const IATA_ANCIENS = [
  "Hold travel requires an IATA-compliant crate.",
  "Cargo is booked with a freight agent, not at check-in: quote, drop-off and pick-up at the cargo terminal, and an IATA-compliant crate they approve.",
  "Le voyage en soute exige une caisse conforme IATA.",
  "En fret, tu réserves auprès d'un transitaire et non au comptoir : devis, dépôt et retrait au terminal fret, et une caisse conforme IATA qu'il valide.",
  "El viaje en bodega requiere una jaula conforme a la IATA.",
  "En carga reservas con un agente de carga, no en el mostrador: presupuesto, entrega y recogida en la terminal de carga, y una jaula conforme a la IATA que él valide.",
  "Viajar no porão exige uma caixa de transporte conforme a norma IATA.",
  "Na carga você reserva com um agente de carga, não no balcão: cotação, entrega e retirada no terminal de carga, e uma caixa conforme a norma IATA aprovada por ele.",
];

async function libellesPass() {
  console.log("\n— Le motif d'interdiction, vu reconnaître ce qu'il remplace —");
  {
    const aveugle = IATA_ANCIENS.filter((t) => !IATA_INTERDIT.test(t));
    check(`le motif reconnaît les ${IATA_ANCIENS.length} anciens textes d'homologation`,
      aveugle.length === 0, JSON.stringify(aveugle[0] || "").slice(0, 140));
    const nouveaux = [...Object.values(CRATE_REASON.hold), ...Object.values(CRATE_REASON.cargo)];
    const fauxPositifs = nouveaux.filter((t) => IATA_INTERDIT.test(t));
    check(`le motif n'accuse aucun des ${nouveaux.length} nouveaux textes`,
      fauxPositifs.length === 0, JSON.stringify(fauxPositifs[0] || "").slice(0, 140));
    /* LE MOTEUR ET LE DOM PARLENT DU MÊME TEXTE. Sans ce lien explicite, la preuve moteur et la
       preuve DOM resteraient deux affirmations côte à côte. */
    const desaccords = [];
    for (const mode of ["hold", "cargo"]) for (const l of ["en", "fr", "es", "pt"]) {
      if ((MOTEUR[`${l}/${mode}`] || {}).reason !== CRATE_REASON[mode][l]) desaccords.push(`${l}/${mode}`);
    }
    check("les 8 raisons du moteur sont exactement celles que le DOM exigera",
      desaccords.length === 0, desaccords.join(", "));
    check("le moteur conserve le nom interne brut dans le PartnerRef",
      Object.values(MOTEUR).every((p) => p.name === "IATA Pet Crates"));
  }
  for (const loc of BADGE_LOCALES) {
    console.log(`\n— Libellés publics du Finder (${loc.code}) —`);
    const parts = loadHomeParts(loc.dir);

    /* LE CTA DES FORMALITÉS : texte exact, aucun décompte, et le portugais réellement portugais. */
    const cta = (parts.labels.rt || {}).cta;
    check(`${loc.code} : CTA formalités EXACT = ${JSON.stringify(CTA_STEPS[loc.code])}`,
      cta === CTA_STEPS[loc.code], JSON.stringify(cta));
    check(`${loc.code} : le CTA ne porte aucun décompte`, !CTA_DECOMPTE.test(cta || ""), JSON.stringify(cta));
    if (loc.code === "pt") {
      check("pt : le CTA n'est pas le repli anglais", cta !== CTA_STEPS.en && /etapas/.test(cta || ""), JSON.stringify(cta));
    }
    /* LE BANDEAU DES FORMALITÉS, RENDU. Lire le gabarit ne prouverait rien : le bundle client est
       minifié, et une vérification de source aurait été verte même sans rendu. On choisit donc
       une destination dont le pays PORTE des formalités aller-retour, on soumet, et on lit le
       CTA produit — texte, nom du pays accolé, et lien réel. */
    {
      const rt = parts.labels.countryRT || {};
      const paysDe = parts.labels.airportCountry || {};
      const origIds = resolveEndpointFrom(parts.labels, "").ids;
      let etiquette = null, attenduPays = null;
      for (const [lib, id] of Object.entries(parts.labels.airMap || {})) {
        const iso = paysDe[id];
        if (!iso || !rt[iso]) continue;
        etiquette = lib; attenduPays = rt[iso]; break;
      }
      if (!etiquette) check(`${loc.code} : une destination à formalités aller-retour existe`, false, "aucune");
      else {
        const fetchMock = async (url, opts) => {
          if (String(url).includes("/nearest-airport")) return { ok: false };
          if (opts && opts.method === "POST") return { ok: true, json: async () => FAKE_REPORT };
          throw new Error("unexpected fetch: " + url);
        };
        const d = buildDom(parts, fetchMock);
        d.window.document.getElementById("f-dest").value = etiquette;
        d.window.document.getElementById("f-weight").value = "8";
        d.window.document.getElementById("mdcf-finder").dispatchEvent(
          new d.window.Event("submit", { bubbles: true, cancelable: true }));
        await flush(2);
        await flush();
        const a = d.window.document.querySelector(".rtflag__cta");
        check(`${loc.code} : le bandeau formalités est rendu`, !!a, "aucun .rtflag__cta");
        /* LE BANDEAU N'AFFIRME PLUS AUCUN DOCUMENT (08/09/2026). « Prévois un certificat vétérinaire
           dans chaque sens » était faux pour un trajet intra-UE (passeport, puce, rage — pas de
           certificat) et n'avait aucune source : le corps du bandeau ne doit nommer ni certificat,
           ni passeport, ni vaccin. Ici le rapport factice n'a AUCUNE condition : le corps doit
           donc renvoyer à la page du pays, pas à des « étapes ci-dessous » qui n'existent pas. */
        const corps = (d.window.document.querySelector(".rtflag__b") || {}).textContent || "";
        check(`${loc.code} : le corps du bandeau ne nomme aucun document (certificat, passeport, vaccin)`,
          corps.length > 0 && !/certif|passeport|passport|pasaporte|passaporte|vaccin|vacuna|vacina/i.test(corps), JSON.stringify(corps));
        /* Le renvoi « page du pays / étapes ci-dessous » n'existe qu'au niveau « info » : les niveaux
           « crit » (titrage, île stricte) et « warn » (sortie du pays) portent leur propre texte,
           tiré des régimes. MA PREMIÈRE RÉDACTION l'exigeait sur tout bandeau : la destination
           choisie ici est de niveau « crit » (titrage), et le contrôle rougissait sur un texte
           juste. On ne l'exige donc que sur un bandeau `.rtflag--info`, et on dit lequel on a lu. */
        const niveau = (d.window.document.querySelector(".rtflag") || { className: "" }).className.match(/rtflag--(\w+)/)?.[1] ?? "(absent)";
        console.log(`         bandeau de niveau « ${niveau} »`);
        if (niveau === "info") {
          check(`${loc.code} : sans condition listée par le moteur, le bandeau renvoie à la page du pays — pas à des étapes absentes`,
            /country page|page du pays|página del país|página do país/i.test(corps) && !/below|ci-dessous|abajo|abaixo/i.test(corps), JSON.stringify(corps));
        }
        if (a) {
          const texte = a.textContent.trim();
          check(`${loc.code} : le CTA rendu porte le libellé sans décompte`,
            texte.startsWith(CTA_STEPS[loc.code]) && !CTA_DECOMPTE.test(texte), JSON.stringify(texte));
          /* CONTRÔLE NON CIRCULAIRE. Première rédaction fautive, nommée : elle comparait le
             texte rendu à `attenduPays.name` lu dans LES MÊMES données — vider le nom vidait
             aussi l'attendu, et la garde restait verte sur un bandeau sans pays. On exige
             maintenant une forme : un nom NON VIDE après le séparateur, et il doit être celui
             du pays. Idem pour le lien : un slug non vide dans un chemin de fiche pays. */
          const apres = texte.split(" · ").slice(1).join(" · ").replace(/\s*→\s*$/, "").trim();
          check(`${loc.code} : le nom du pays reste accolé au CTA, et il n'est pas vide`,
            apres.length >= 2 && apres === attenduPays.name, JSON.stringify(texte));
          const href = a.getAttribute("href") || "";
          check(`${loc.code} : le lien du CTA mène à la fiche d'un pays nommé`,
            /^(\/(?:fr|es|pt))?\/countries\/[a-z0-9-]+\/$/.test(href) && href.endsWith(`/${attenduPays.slug}/`),
            JSON.stringify(href));
        }
        void origIds;
      }
    }

    /* LE LIEN CAISSE, RENDU — SOUTE PUIS FRET. On soumet réellement le formulaire avec une race
       choisie, et on lit le <li> produit. La fixture ne fabrique plus son partenaire : elle
       transmet le `PartnerRef` que `selectPartners` a réellement produit, nom interne brut
       compris. La branche fret, jamais exécutée jusqu'ici, l'est maintenant aussi. */
    for (const mode of ["hold", "cargo"]) {
    let dom;
    try {
      const partenaire = MOTEUR[`${loc.code}/${mode}`];
      if (!partenaire) { check(`${loc.code}/${mode} : le moteur a produit un partenaire caisse`, false, "absent"); continue; }
      const fetchMock = async (url, opts) => {
        if (String(url).includes("/nearest-airport")) return { ok: false };
        const rep = { ...FAKE_REPORT, partners: [partenaire] };
        if (opts && opts.method === "POST") return { ok: true, json: async () => rep };
        throw new Error("unexpected fetch: " + url);
      };
      dom = buildDom(parts, fetchMock);
      const { window } = dom;
      const originEl = window.document.getElementById("f-origin");
      const destEl = window.document.getElementById("f-dest");
      const originIds = resolveEndpointFrom(parts.labels, originEl.value).ids;
      destEl.value = pickDestinationLabel(parts.labels, originIds);
      const breedEntries = Object.entries(parts.labels.breedById || {});
      const [[breedId, breedLabel]] = breedEntries;
      window.document.getElementById("f-breed").value = breedLabel;
      window.document.getElementById("f-weight").value = "40";
      window.document.getElementById("mdcf-finder").dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }));
      await flush(2);
      await flush();

      const liens = [...window.document.querySelectorAll("li a")].filter((a) => /tools\/crate\//.test(a.getAttribute("href") || ""));
      check(`${loc.code}/${mode} : le lien caisse est rendu et UNIQUE`, liens.length === 1, `${liens.length} lien(s)`);
      const lien = liens[0];
      check(`${loc.code}/${mode} : TEXTE du lien caisse exact = ${JSON.stringify(CRATE_NAME[loc.code])}`,
        !!lien && lien.textContent.trim() === CRATE_NAME[loc.code], JSON.stringify(lien && lien.textContent.trim()));
      const attendu = loc.dir ? `/${loc.dir.replace(/\/+$/, "")}/tools/crate/` : "/tools/crate/";
      const href = (lien && lien.getAttribute("href")) || "";
      check(`${loc.code}/${mode} : CHEMIN localisé exact = ${attendu}`, href.split("#")[0] === attendu, JSON.stringify(href));
      check(`${loc.code}/${mode} : l'ancre de race est conservée`, href.includes(`#breed=${breedId}`), JSON.stringify(href));

      /* LE NOM INTERNE NE SORT NULLE PART dans le DOM public. */
      check(`${loc.code}/${mode} : « IATA Pet Crates » absent du DOM`,
        !window.document.documentElement.outerHTML.includes("IATA Pet Crates"));

      /* AUCUNE AFFIRMATION D'HOMOLOGATION dans le bloc, ni dans le libellé ni dans la raison. */
      const bloc = lien ? (lien.closest("li").textContent || "") : "";
      check(`${loc.code}/${mode} : la raison affichée est celle attendue`,
        bloc.includes(CRATE_REASON[mode][loc.code]), JSON.stringify(bloc.slice(0, 180)));
      check(`${loc.code}/${mode} : aucune conformité ni homologation IATA dans ce bloc`,
        !IATA_INTERDIT.test(bloc), JSON.stringify(bloc.slice(0, 180)));
    } catch (e) {
      check(`${loc.code}/${mode} : rendu du lien caisse`, false, e.message || String(e));
    }
    }
  }
}

/**
 * LE CONTRAT D'AFFICHAGE (08/09/2026 — point 2 de Codex, P0 (c) de Philippe), vu sur le rendu.
 *
 * Deux rapports factices, soumis sur la vraie page construite, dans les quatre langues :
 *   · MIXTE : une compagnie avec un refus cabine DOCUMENTÉ et deux dont les trois canaux sont
 *     « ? ». Attendu : la documentée d'abord, à plat, sous son titre ; les deux pistes REPLIÉES
 *     dans un <details> qui porte leur nombre et la phrase « pistes, pas des réponses » ; le
 *     résumé par canal lit 0 · 1 · 2 en cabine, 0 · 0 · 3 en soute et en fret.
 *   · RIEN DE DOCUMENTÉ : trois pistes. Attendu : la phrase brève et honnête, AUCUNE carte à plat
 *     hors du <details>, et les trois cartes dedans.
 * Les statuts sont ceux des cartes ; le harnais n'en recalcule aucun. */
async function contratAffichagePass() {
  const piste = (id, name) => ({
    ...FAKE_REPORT.airlines[0], airline_id: id, name, cabin: false, hold: false, cargo: false,
    cabin_status: "confirmation_required", hold_status: "confirmation_required", cargo_status: "confirmation_required",
    to_confirm: ["cabin", "hold", "cargo"], label: "À confirmer", offers_pet_transport: "unknown",
    placement_decisions: ["cabin", "hold", "cargo"].map((placement) => ({
      placement, status: "confirmation_required", allowed: false, confirmation_causes: [{ code: "official_source_unquoted" }] })),
  });
  const documentee = {
    ...piste("airline_doc", "Doc Air"), cabin_status: "denied", to_confirm: ["hold", "cargo"], label: "Refus cabine",
    placement_decisions: [
      { placement: "cabin", status: "denied", allowed: false, source: { url: "https://exemple-compagnie.example/animaux", source_type: "official_website", verified_date: "2026-09-08", confidence: 4 } },
      { placement: "hold", status: "confirmation_required", allowed: false, confirmation_causes: [{ code: "official_source_unquoted" }] },
      { placement: "cargo", status: "confirmation_required", allowed: false, confirmation_causes: [{ code: "official_source_unquoted" }] },
    ],
  };
  const MIXTE = { ...FAKE_REPORT, verdict: "unknown", airlines: [documentee, piste("airline_p1", "Piste Un"), piste("airline_p2", "Piste Deux")] };
  const RIEN = { ...FAKE_REPORT, verdict: "unknown", airlines: [piste("airline_p1", "Piste Un"), piste("airline_p2", "Piste Deux"), piste("airline_p3", "Piste Trois")] };
  const rendre = async (parts, rapport) => {
    const fetchMock = async (url, opts) => {
      if (String(url).includes("/nearest-airport")) return { ok: false };
      if (opts && opts.method === "POST") return { ok: true, json: async () => rapport };
      throw new Error("unexpected fetch: " + url);
    };
    const dom = buildDom(parts, fetchMock);
    const { window } = dom;
    const originIds = resolveEndpointFrom(parts.labels, window.document.getElementById("f-origin").value).ids;
    window.document.getElementById("f-dest").value = pickDestinationLabel(parts.labels, originIds);
    window.document.getElementById("f-weight").value = "8";
    window.document.getElementById("mdcf-finder").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await flush(2);
    await flush();
    return window.document;
  };
  const nombres = (doc) => [...doc.querySelectorAll(".asum__ch")].map((n) => (n.textContent.match(/\d+/g) || []).join("/"));
  for (const loc of BADGE_LOCALES) {
    console.log(`\n— Contrat d'affichage : documentées d'abord, pistes repliées (${loc.code}) —`);
    const parts = loadHomeParts(loc.dir);
    {
      const doc = await rendre(parts, MIXTE);
      const sec = doc.querySelector(".report__sec .asum")?.closest(".report__sec");
      check(`${loc.code} : MIXTE — résumé par canal cabine 0/1/2, soute 0/0/3, fret 0/0/3`,
        JSON.stringify(nombres(doc)) === JSON.stringify(["0/1/2", "0/0/3", "0/0/3"]), JSON.stringify(nombres(doc)));
      const aPlat = sec ? [...sec.querySelectorAll(":scope > ul.acards .acard, :scope > h5 + ul.acards .acard")] : [];
      const aPlatNoms = [...(sec?.querySelectorAll("ul.acards") ?? [])].filter((ul) => !ul.closest("details")).flatMap((ul) => [...ul.querySelectorAll(".acard__top b")].map((b) => b.textContent.trim()));
      check(`${loc.code} : MIXTE — la seule carte à plat est la documentée (Doc Air)`,
        JSON.stringify(aPlatNoms) === JSON.stringify(["Doc Air"]), JSON.stringify(aPlatNoms));
      const titre = sec?.querySelector("h5.acards__sub")?.textContent.trim() ?? "";
      check(`${loc.code} : MIXTE — le titre des documentées porte leur nombre (1), pas une clé brute`,
        /\(1\)/.test(titre) && !/finder\.sum/.test(titre), JSON.stringify(titre));
      const det = sec?.querySelector("details.acards__leads");
      const dansDetails = det ? [...det.querySelectorAll(".acard__top b")].map((b) => b.textContent.trim()) : [];
      check(`${loc.code} : MIXTE — les deux pistes sont REPLIÉES dans un <details> fermé`,
        !!det && !det.hasAttribute("open") && JSON.stringify(dansDetails) === JSON.stringify(["Piste Un", "Piste Deux"]), JSON.stringify(dansDetails));
      const summ = det?.querySelector("summary")?.textContent.trim() ?? "";
      check(`${loc.code} : MIXTE — le résumé du <details> porte le nombre (2) et n'est pas une clé brute`,
        /\(2\)/.test(summ) && !/finder\.sum/.test(summ), JSON.stringify(summ));
      check(`${loc.code} : MIXTE — la phrase « pistes, pas des réponses » est dans le <details>`,
        !!det && det.querySelector("p.finder__hint") !== null && !/finder\.sum/.test(det.textContent));
      check(`${loc.code} : MIXTE — pas de phrase « rien de documenté » quand une réponse existe`, !doc.querySelector(".asum__none"));
      void aPlat;
    }
    {
      const doc = await rendre(parts, RIEN);
      check(`${loc.code} : RIEN — résumé par canal 0/0/3 sur les trois canaux`,
        JSON.stringify(nombres(doc)) === JSON.stringify(["0/0/3", "0/0/3", "0/0/3"]), JSON.stringify(nombres(doc)));
      const none = doc.querySelector(".asum__none");
      check(`${loc.code} : RIEN — la phrase brève et honnête est rendue, et n'est pas une clé brute`,
        !!none && none.textContent.trim().length > 20 && !/finder\.sum/.test(none.textContent), JSON.stringify(none?.textContent.trim() ?? ""));
      const horsDetails = [...doc.querySelectorAll("ul.acards")].filter((ul) => !ul.closest("details")).flatMap((ul) => [...ul.querySelectorAll(".acard")]);
      check(`${loc.code} : RIEN — AUCUNE carte à plat hors du <details>`, horsDetails.length === 0, `${horsDetails.length} à plat`);
      const det = doc.querySelector("details.acards__leads");
      check(`${loc.code} : RIEN — les trois pistes sont dans le <details>, fermé`,
        !!det && !det.hasAttribute("open") && det.querySelectorAll(".acard").length === 3);
    }
  }
}

main().then(() => badgesPass()).then(() => contratAffichagePass()).then(() => t0aPass()).then(() => cartesPass()).then(() => heatWhyPass()).then(() => datePass()).then(() => destinationsDatePass()).then(() => libellesPass()).then(() => {
  console.log("\n=== SUMMARY ===");
  console.log(failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
}).catch((e) => {
  console.log("  FAIL uncaught: " + (e.stack || e.message));
  console.log("\n=== SUMMARY ===");
  console.log((failures + 1) + " CHECK(S) FAILED");
  process.exit(1);
});
