/**
 * LE BLOC « TARIFS POUR VOYAGER AVEC UN CHIEN », ÉPROUVÉ SUR LE SITE CONSTRUIT.
 *
 * POURQUOI CE FICHIER (18/09/2026, demande de Philippe, point 6). Une section tarifaire est la
 * surface où une erreur coûte le plus cher : un visiteur qui lit « 500 $ » réserve sur cette base.
 * Les sept garanties demandées sont donc éprouvées ici, et six des sept le sont sur le HTML
 * RÉELLEMENT CONSTRUIT, pas sur les intentions du composant — c'est la leçon des contrôles de DOM
 * de ce dépôt : une relecture cherche là où elle pense à regarder, un contrôle qui lit le HTML
 * servi cherche partout.
 *
 * CE QUI EST EXIGÉ :
 *   1. aucun montant sans sa citation ;
 *   2. un canal refusé n'affiche aucun tarif — ni bloc, ni état ;
 *   3. la fiche et le Finder lisent la MÊME donnée : autant de lignes que la politique canonique
 *      en porte, ni plus ni moins ;
 *   4. l'unité de facturation reste visible — un chiffre nu n'est pas un tarif ;
 *   5. un conflit éteint les montants exacts du canal ;
 *   6. les quatre langues publient les mêmes montants et les mêmes devises ;
 *   7. aucun champ libre hérité (`fareGrid`, `fareList`, `fee`) ne revient par une porte dérobée.
 *
 * Le contrôle 8 est unitaire : la dérivation d'état doit rendre les neuf états, et pas un
 * générique « à confirmer » — c'est l'objet même de la demande (point 4).
 */
import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { lireEtatTarifaire } from "./packages/knowledge/src/etatTarifaire.ts";

const DIST = path.join(process.cwd(), "packages", "ui", "dist");
const OBJETS = JSON.parse(fs.readFileSync("packages/knowledge/raw/objects.json", "utf8"));
let ok = 0, fail = 0;
const check = (nom, cond, detail = "") => {
  if (cond) { ok++; console.log(`  OK   ${nom}`); }
  else { fail++; console.log(`  FAIL ${nom}${detail ? `\n         ${detail}` : ""}`); }
};

/* La cible est calculée sur les DONNÉES, jamais choisie à la main : une compagnie qui gagne un
   tarif demain entre d'elle-même dans le contrôle, et « aucune fiche trouvée » est un échec. */
const slug = (id) => id.replace(/^airline_/, "").replace(/_/g, "-");
const PLACEMENTS = ["cabin", "hold", "cargo"];
const REFUS = new Set(["not_offered", "denied"]);

const compagniesTarifees = OBJETS.airlines.filter((a) =>
  PLACEMENTS.some((p) => (a.premium?.policy?.[p]?.fares ?? []).length > 0));

const lireFiche = (id, locale = "en") => {
  const rel = locale === "en" ? ["airlines", slug(id)] : [locale, "airlines", slug(id)];
  const f = path.join(DIST, ...rel, "index.html");
  if (!fs.existsSync(f)) return null;
  return new JSDOM(fs.readFileSync(f, "utf8")).window.document;
};

console.log("\n=== 0. La cible existe et n'est pas vide ===");
check("des compagnies portent des tarifs dans la politique canonique", compagniesTarifees.length > 0,
  `${compagniesTarifees.length} compagnie(s)`);
const fiches = compagniesTarifees.map((a) => ({ a, doc: lireFiche(a.id) })).filter((x) => x.doc);
check("leurs fiches anglaises sont construites", fiches.length === compagniesTarifees.length,
  `${fiches.length} / ${compagniesTarifees.length}`);
check("le bloc tarifaire est rendu sur chacune",
  fiches.every(({ doc }) => doc.querySelector('[data-bloc="tarifs-chien"]')),
  fiches.filter(({ doc }) => !doc.querySelector('[data-bloc="tarifs-chien"]')).map((x) => x.a.id).slice(0, 3).join(" | "));

console.log("\n=== 1. Aucun montant sans sa citation ===");
{
  let nus = [];
  for (const { a, doc } of fiches) {
    for (const li of doc.querySelectorAll(".tc-i")) {
      const montant = li.querySelector(".tc-m[data-montants]");
      const citation = li.querySelector(".tc-pr .tc-q");
      if (montant && !(citation && citation.textContent.trim().length > 2)) nus.push(`${a.id} — ${montant.getAttribute("data-montants")}`);
    }
  }
  check("tout montant publié porte la phrase officielle qui l'établit", nus.length === 0, nus.slice(0, 3).join(" | "));
  /* TÉMOIN DE NON-VACUITÉ. Sans lui, ce contrôle passe au vert sur un site où AUCUN montant n'est
     rendu — c'est exactement ce qui s'est produit au premier essai, sur un `dist` construit avant
     la dernière retouche du composant. Un contrôle qui ne trouve rien n'a rien vérifié. */
  const montantsRendus = fiches.reduce((n, { doc }) => n + doc.querySelectorAll(".tc-m[data-montants]").length, 0);
  check("et ce contrôle a de la matière : des montants sont bien rendus", montantsRendus > 20, `${montantsRendus} montant(s)`);
}

console.log("\n=== 2. Un canal refusé n'affiche aucun tarif ===");
{
  let fautes = [], temoins = 0;
  for (const { a, doc } of fiches) {
    for (const p of PLACEMENTS) {
      const pol = a.premium?.policy?.[p];
      if (!pol || !REFUS.has(pol.availability ?? "")) continue;
      temoins++;
      if (doc.querySelector(`.tc[data-placement="${p}"]`)) fautes.push(`${a.id}/${p}`);
    }
  }
  check("aucune section tarifaire sur un canal refusé", fautes.length === 0, fautes.slice(0, 3).join(" | "));
  check("et ce contrôle n'est pas vacant : des canaux refusés existent bien", temoins > 0, `${temoins} canal(aux) refusé(s)`);
}

console.log("\n=== 3. La fiche et le Finder lisent la même donnée ===");
{
  /* Le Finder tire ses cartes de `objects.json` ; la fiche est construite depuis la même base.
     Exiger l'ÉGALITÉ DES COMPTES par canal interdit la dérive silencieuse : une seconde base
     tarifaire réservée aux fiches ferait diverger ces deux nombres au premier ajout. */
  let ecarts = [];
  for (const { a, doc } of fiches) {
    for (const p of PLACEMENTS) {
      const pol = a.premium?.policy?.[p];
      if (!pol || REFUS.has(pol.availability ?? "")) continue;
      const attendu = (pol.fares ?? []).length;
      const conflit = (pol.fare_conflicts ?? []).length > 0;
      const chiffrees = (pol.fares ?? []).filter((f) => (f.price?.amounts?.length ?? 0) > 0).length;
      const cible = conflit ? attendu - chiffrees : attendu;
      const rendu = doc.querySelectorAll(`.tc[data-placement="${p}"] .tc-i`).length;
      if (rendu !== cible) ecarts.push(`${a.id}/${p} : ${rendu} rendu(s) pour ${cible} attendu(s)`);
    }
  }
  check("chaque canal rend exactement les lignes de la politique canonique", ecarts.length === 0, ecarts.slice(0, 3).join(" | "));
}

console.log("\n=== 4. L'unité de facturation reste visible ===");
{
  let nus = [];
  for (const { a, doc } of fiches) {
    for (const li of doc.querySelectorAll(".tc-i")) {
      const u = li.querySelector(".tc-u");
      if (!u || u.textContent.trim().length === 0) nus.push(`${a.id} — ${li.getAttribute("data-kind")}`);
      if (!li.getAttribute("data-sujet") || !li.getAttribute("data-base")) nus.push(`${a.id} — axes absents`);
    }
  }
  check("toute ligne dit par quoi elle est facturée et sur quel trajet", nus.length === 0, nus.slice(0, 3).join(" | "));
}

console.log("\n=== 5. Un conflit éteint les montants exacts ===");
{
  const enConflit = OBJETS.airlines.filter((a) =>
    PLACEMENTS.some((p) => (a.premium?.policy?.[p]?.fare_conflicts ?? []).length > 0));
  let fautes = [];
  for (const a of enConflit) {
    const doc = lireFiche(a.id);
    if (!doc) continue;
    for (const p of PLACEMENTS) {
      if ((a.premium?.policy?.[p]?.fare_conflicts ?? []).length === 0) continue;
      const chiffres = doc.querySelectorAll(`.tc[data-placement="${p}"] .tc-m[data-montants]`).length;
      if (chiffres > 0) fautes.push(`${a.id}/${p} : ${chiffres} montant(s) survivant(s)`);
    }
  }
  check("aucun montant chiffré ne survit à un conflit ouvert", fautes.length === 0, fautes.slice(0, 3).join(" | "));
  /* Le témoin négatif : la dérivation doit SAVOIR éteindre, sur une politique fabriquée pour ça. */
  const fabrique = lireEtatTarifaire({
    availability: "offered",
    fares: [{ price: { kind: "exact", amounts: [{ amount: 100, currency: "EUR" }] } }],
    fare_conflicts: [{}],
  });
  check("et la dérivation éteint bien les montants sur un conflit fabriqué",
    fabrique.etat === "conflit" && fabrique.montantsExactsSupprimes === true, JSON.stringify(fabrique));
}

console.log("\n=== 6. Les quatre langues publient les mêmes montants ===");
{
  let ecarts = [];
  for (const { a } of fiches.slice(0, 12)) {
    const parLangue = {};
    for (const loc of ["en", "fr", "es", "pt"]) {
      const doc = lireFiche(a.id, loc);
      if (!doc) continue;
      parLangue[loc] = [...doc.querySelectorAll(".tc-m[data-montants]")].map((n) => n.getAttribute("data-montants")).sort().join(" ;; ");
    }
    const valeurs = Object.values(parLangue);
    if (valeurs.length > 1 && new Set(valeurs).size !== 1) ecarts.push(`${a.id} : ${JSON.stringify(parLangue).slice(0, 160)}`);
  }
  check("la traduction ne déplace ni un chiffre ni une devise", ecarts.length === 0, ecarts.slice(0, 2).join(" | "));
  /* Même exigence de matière : comparer quatre chaînes vides ne prouve rien. */
  const comparees = fiches.slice(0, 12).reduce((n, { a }) => {
    const d = lireFiche(a.id, "fr");
    return n + (d ? d.querySelectorAll(".tc-m[data-montants]").length : 0);
  }, 0);
  check("et la comparaison porte sur des montants réels", comparees > 10, `${comparees} montant(s) en français`);
}

console.log("\n=== 7. Aucun champ libre hérité ne revient ===");
{
  /* `fee`, `fareGrid` et `fareList` existent encore dans les données historiques : le contrôle
     vérifie que leur CONTENU ne réapparaît pas dans le bloc tarifaire, quel que soit le chemin. */
  let fautes = [];
  for (const { a, doc } of fiches) {
    const bloc = doc.querySelector('[data-bloc="tarifs-chien"]');
    if (!bloc) continue;
    /* LA CITATION OFFICIELLE EST HORS DU CONTRÔLE, et il faut le dire. Le champ hérité `fee` de
       United porte « $150 each way » — une phrase que la page officielle de United écrit aussi.
       L'interdire dans la citation reviendrait à interdire de citer la compagnie. Ce qui est
       interdit, c'est que ce texte libre serve de TARIF : on regarde donc le bloc PRIVÉ de ses
       volets de preuve. */
    const copie = bloc.cloneNode(true);
    for (const preuve of copie.querySelectorAll(".tc-pr")) preuve.remove();
    const texte = copie.textContent;
    for (const p of PLACEMENTS) {
      const fee = a.premium?.policy?.[p]?.fee;
      if (typeof fee === "string" && fee.trim().length > 3 && texte.includes(fee.trim())) fautes.push(`${a.id}/${p} : « ${fee} »`);
    }
  }
  check("le champ hérité `fee` ne reparaît nulle part dans le bloc", fautes.length === 0, fautes.slice(0, 3).join(" | "));
}

console.log("\n=== 8. Les neuf états existent, et se distinguent ===");
{
  const cas = [
    ["canal refusé (forme écrite)", { availability: "not_offered" }, "canal_refuse"],
    ["canal refusé (forme runtime)", { status: "denied" }, "canal_refuse"],
    ["montant ferme", { fares: [{ price: { kind: "exact", amounts: [{ amount: 60, currency: "EUR" }] } }] }, "publie"],
    ["grille zonée", { fares: [{ price: { kind: "matrix", amounts: [{ amount: 500, currency: "USD" }] } }] }, "publie"],
    ["plancher", { fares: [{ price: { kind: "minimum", amounts: [{ amount: 60, currency: "EUR" }] } }] }, "plancher_ou_fourchette"],
    ["calculateur", { fares: [{ price: { kind: "calculator", amounts: [] } }] }, "calculateur"],
    ["barème", { fares: [{ price: { kind: "formula", amounts: [] } }] }, "bareme"],
    ["à la réservation", { fares: [{ price: { kind: "booking_only", amounts: [] } }] }, "a_la_reservation"],
    ["sur devis", { fares: [{ price: { kind: "quote", amounts: [] } }] }, "sur_devis"],
    ["aucun montant publié, prouvé", { no_published_fare: { url: "x", quote: "y" } }, "aucun_montant_publie"],
    ["rien d'établi", {}, "non_verifie"],
  ];
  const rendus = new Set();
  let fautes = [];
  for (const [nom, politique, attendu] of cas) {
    const lu = lireEtatTarifaire(politique).etat;
    rendus.add(lu);
    if (lu !== attendu) fautes.push(`${nom} → ${lu} au lieu de ${attendu}`);
  }
  check("chaque situation rend son propre état", fautes.length === 0, fautes.join(" | "));
  check("neuf états distincts sont atteignables", rendus.size === 10 - 1 + 1 ? true : rendus.size >= 9, `${rendus.size} état(s)`);
  check("une politique absente ne se lit pas comme un refus",
    lireEtatTarifaire(null).etat === "non_verifie" && lireEtatTarifaire(undefined).etat === "non_verifie");
}

console.log(`\n${ok} OK, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
