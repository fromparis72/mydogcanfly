#!/usr/bin/env node
/**
 * LES CONTRE-ÉPREUVES DU CONTRAT DES CAISSES.
 *
 *   node --import tsx test-caisses.mjs
 *
 * Chaque garantie du contrat est vue REFUSER pour sa cause : on part d'un modèle valide, on le
 * mute d'une seule façon, et on exige que le MÊME schéma — jamais une réimplémentation — le
 * rejette, avec le bon chemin d'erreur.
 *
 * Le modèle témoin est FICTIF et le dit : il ne prétend décrire aucun produit réel. C'est
 * volontaire — un harnais qui citerait de vrais chiffres non collectés referait exactement la
 * faute que ce contrat existe pour empêcher.
 */
import { readFileSync } from "node:fs";
import {
  ModeleCaisse, ProfilCaisse, CorrespondanceRace,
  RegistreModeles, RegistreProfils, RegistreCorrespondances,
  deriverProfil, intervalleTotal, trancheUnique, reviewDueFrom,
  verifierRegistresCaisses, estLibellePoidsNet, parserDimensions, parserPoids,
} from "@mydogcanfly/knowledge";

let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

const VERIF = "2026-08-29";
const preuve = (quote, extra = {}) => ({
  quote, quote_language: "en", locator: "characteristics > net weight",
  url: "https://exemple-fabricant.test/modele", source_type: "official_website",
  verified_date: VERIF, review_due: reviewDueFrom(VERIF, "equipment"),
  confidence: 4, reviewer: "MyDogCanFly Data Team", history: [], ...extra,
});
const QUOTE = "Dimensions (L x W x H) 100 x 60 x 70 cm — net weight 10 kg — shipping weight 66 kg";

/** Un modèle TÉMOIN, fictif et nommé comme tel — 100 × 60 × 70 cm, 10 kg. */
const temoin = (over = {}) => ({
  id: "fabricant_temoin_a",
  fabricant: "Fabricant Témoin A",
  modele: "Modèle d'épreuve (fictif)",
  type: "rigide",
  specifications: {
    valeurs_originales: { unite_longueur: "cm", unite_masse: "kg", l: 100, w: 60, h: 70, poids_a_vide: 10 },
    normalisees_cm_kg: { l: 100, w: 60, h: 70, poids_a_vide_kg: 10,
                         derive_de: "conversion mécanique depuis valeurs_originales" },
    preuve_dimensions: { fragment_source: "(L x W x H) 100 x 60 x 70 cm", citation: preuve(QUOTE) },
    preuve_poids: { fragment_source: "net weight 10 kg", citation: preuve(QUOTE) },
  },
  ...over,
});

/** Mute une COPIE, exige le refus, et exige qu'il porte le bon chemin. */
function refus(nom, muter, cheminAttendu) {
  const m = JSON.parse(JSON.stringify(temoin()));
  const applique = muter(m);
  if (applique === false) { echec(nom, "la mutation ne s'applique pas — elle ne prouverait rien"); return; }
  const r = ModeleCaisse.safeParse(m);
  if (r.success) { echec(nom, "le schéma a ACCEPTÉ la mutation"); return; }
  const chemins = r.error.issues.map((i) => i.path.join("."));
  if (!chemins.some((c) => c.includes(cheminAttendu))) {
    echec(nom, `refusé, mais pour un AUTRE motif — attendu un chemin « ${cheminAttendu} », vu : ${chemins.join(" | ")}`);
    return;
  }
  ok(nom);
}

/* ---- Ligne de départ : le témoin est valide, sinon rien ne prouve rien -------------------- */
{
  const r = ModeleCaisse.safeParse(temoin());
  if (!r.success) {
    console.error("  ✗ départ — le modèle témoin est refusé :", JSON.stringify(r.error.issues, null, 1));
    process.exit(1);
  }
  ok("départ : le modèle témoin est valide");
}

/* 1 — L'ATTAQUE DE LA CONTRE-REVUE DU 29/08/2026, reproduite puis fermée : les valeurs
   originales, les normalisées ET le libellé du champ changent ENSEMBLE, la citation reste
   intacte. La première rédaction ne mutait que l'originale et rougissait par la conversion —
   elle ne prouvait donc rien de l'ancrage. */
refus("1 chiffres changés ensemble, citation intacte", (m) => {
  m.specifications.valeurs_originales = { unite_longueur: "cm", unite_masse: "kg", l: 999, w: 888, h: 777, poids_a_vide: 66 };
  m.specifications.normalisees_cm_kg = { l: 999, w: 888, h: 777, poids_a_vide_kg: 66,
                                         derive_de: "conversion mécanique depuis valeurs_originales" };
  m.specifications.preuve_poids.champ_source = "shipping weight";
  return true;
}, "preuve_dimensions.fragment_source");
/* 1 bis — le poids seul, citation intacte : l'ancrage doit mordre là aussi. */
refus("1bis poids seul modifié, citation intacte", (m) => {
  m.specifications.valeurs_originales.poids_a_vide = 11;
  m.specifications.normalisees_cm_kg.poids_a_vide_kg = 11;
  return true;
}, "preuve_poids.fragment_source");
/* 1 ter — un fragment cité qui n'est PAS dans la citation. */
refus("1ter fragment absent de la citation", (m) => {
  m.specifications.preuve_dimensions.fragment_source = "(L x W x H) 100 x 60 x 71 cm";
  return true;
}, "preuve_dimensions.fragment_source");

/* 2 — une normalisée qui n'est pas la conversion de son originale. */
refus("2 valeur normalisée ≠ conversion de l'originale", (m) => {
  m.specifications.normalisees_cm_kg.l = 101;
  return true;
}, "normalisees_cm_kg");

/* 2 bis — la conversion pouce → cm doit être faite, pas recopiée. */
refus("2bis unité changée alors que la citation dit « cm »", (m) => {
  m.specifications.valeurs_originales.unite_longueur = "in";
  return true;
}, "preuve_dimensions.fragment_source");

/* 3 — un poids tiré d'un champ commercial générique plutôt que du poids net.
   LA LISTE DES LIBELLÉS ADMIS VIT EN PRODUCTION (`estLibellePoidsNet`) : la première rédaction
   la redéclarait ici, si bien que le test se donnait lui-même la réponse et qu'aucun registre
   n'était réellement gardé. */
{
  if (estLibellePoidsNet("shipping weight") || estLibellePoidsNet("weight")) {
    echec("3 libellés admis", "« shipping weight » ou « weight » est admis comme poids net par la production");
  } else if (!estLibellePoidsNet("net weight") || !estLibellePoidsNet("Poids net")) {
    echec("3 libellés admis", "un vrai libellé de poids net est refusé par la production");
  } else ok("3 la production distingue « net weight » de « shipping weight » — la liste n'est plus dans le test");
}
/* 3 bis — L'ATTAQUE DU 29/08 (2) : le libellé et la valeur sont tous deux dans la citation, mais
   la valeur retenue est celle du POIDS D'EXPÉDITION. Le fragment probatoire doit porter le
   libellé ET sa valeur ensemble — « net weight 10 kg — shipping weight 66 kg » avec 66 inscrit
   ne prouve pas que 66 est le poids net. */
refus("3bis le poids d'expédition passé pour le poids net", (m) => {
  m.specifications.valeurs_originales.poids_a_vide = 66;
  m.specifications.normalisees_cm_kg.poids_a_vide_kg = 66;
  m.specifications.preuve_poids.fragment_source = "net weight 10 kg — shipping weight 66 kg";
  return true;
}, "preuve_poids.fragment_source");
/* 3 ter — un fragment qui ne porte QUE le poids d'expédition n'est pas une preuve de poids net. */
refus("3ter fragment « shipping weight » seul", (m) => {
  m.specifications.preuve_poids.fragment_source = "shipping weight 66 kg";
  m.specifications.preuve_poids.citation.quote += " shipping weight 66 kg";
  return true;
}, "preuve_poids.fragment_source");
/* 3 quater — L'ATTAQUE DU 29/08 (3) : l'unité absente du fragment ne vaut pas « centimètres ». */
refus("3quater unité absente du fragment de dimensions", (m) => {
  m.specifications.preuve_dimensions.fragment_source = "(L x W x H) 100 x 60 x 70";
  return true;
}, "preuve_dimensions.fragment_source");

/* 3 quinquies — L'ATTAQUE DE LA CONTRE-REVUE DU 29/08 (4), reproduite mot pour mot puis fermée :
   le fragment ne porte AUCUNE unité sur ses dimensions, mais en contient une AILLEURS — celle de
   la porte. L'ancienne rédaction balayait tout le fragment et empruntait ces centimètres ; ce
   modèle passait, `success === true`. L'unité doit désormais se lire DANS l'expression des trois
   nombres, jamais dans le reste de la phrase. */
refus("3quinquies l'unité empruntée à une autre mesure du fragment", (m) => {
  const frag = "Door clearance 10 cm; dimensions 40 x 27 x 30";
  m.specifications.valeurs_originales.l = 40;
  m.specifications.valeurs_originales.w = 27;
  m.specifications.valeurs_originales.h = 30;
  m.specifications.normalisees_cm_kg.l = 40;
  m.specifications.normalisees_cm_kg.w = 27;
  m.specifications.normalisees_cm_kg.h = 30;
  m.specifications.preuve_dimensions.fragment_source = frag;
  m.specifications.preuve_dimensions.citation.quote = `${frag} — net weight 10 kg`;
  m.specifications.preuve_poids.citation.quote = `${frag} — net weight 10 kg`;
  return true;
}, "preuve_dimensions.fragment_source");
/* 3 sexies — trois nombres et leur unité, mais AUCUN AXE ÉCRIT : rien ne dit lequel est la
   longueur. La position ne prouve pas l'ordre. */
refus("3sexies l'ordre des axes n'est pas écrit dans le fragment", (m) => {
  m.specifications.preuve_dimensions.fragment_source = "100 x 60 x 70 cm";
  m.specifications.preuve_dimensions.citation.quote =
    "Dimensions 100 x 60 x 70 cm — net weight 10 kg — shipping weight 66 kg";
  m.specifications.preuve_poids.citation.quote =
    "Dimensions 100 x 60 x 70 cm — net weight 10 kg — shipping weight 66 kg";
  return true;
}, "preuve_dimensions.fragment_source");
/* 3 septies — DEUX séries dans le même fragment : l'intérieur et l'extérieur ne disent pas
   laquelle est citée. */
refus("3septies deux expressions de dimensions dans un même fragment", (m) => {
  const frag = "Interior L 100 x W 60 x H 70 cm; Exterior L 110 x W 65 x H 75 cm";
  m.specifications.preuve_dimensions.fragment_source = frag;
  m.specifications.preuve_dimensions.citation.quote = `${frag} — net weight 10 kg`;
  m.specifications.preuve_poids.citation.quote = `${frag} — net weight 10 kg`;
  return true;
}, "preuve_dimensions.fragment_source");
/* 3 octies — deux unités qui se contredisent DANS l'expression : on refuse, on n'en choisit pas
   une. */
refus("3octies deux unités contradictoires dans l'expression", (m) => {
  const frag = "L 100 x W 60 x H 70 in cm";
  m.specifications.preuve_dimensions.fragment_source = frag;
  m.specifications.preuve_dimensions.citation.quote = `${frag} — net weight 10 kg`;
  m.specifications.preuve_poids.citation.quote = `${frag} — net weight 10 kg`;
  return true;
}, "preuve_dimensions.fragment_source");
/* 3 nonies — LE PARSEUR LUI-MÊME, sur les formes que publient réellement les fabricants, et sur
   la preuve que l'ORDRE EST LU : « H 70 x L 100 x W 60 » doit rendre l = 100, pas 70. */
{
  const meme = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const cas = [
    ['40.7" L X 26.9" W X 30.4" H', { l: 40.7, w: 26.9, h: 30.4, unite: "in" }],
    ["Length 48 x Width 72.5 x Height 51 cm", { l: 48, w: 72.5, h: 51, unite: "cm" }],
    ["Dimensions (L x W x H) in inches: 40 x 27 x 30", { l: 40, w: 27, h: 30, unite: "in" }],
    ["H 70 x L 100 x W 60 cm", { l: 100, w: 60, h: 70, unite: "cm" }],
    ["longueur 100 x largeur 60 x hauteur 70 cm", { l: 100, w: 60, h: 70, unite: "cm" }],
    ["L 100 x L 60 x H 70 cm", null],
    ["Dimensions in 40 x 27 x 30", null],
  ];
  const rates = cas.filter(([f, att]) => !meme(parserDimensions(f), att));
  if (rates.length) echec("3nonies formes réelles", rates.map(([f]) => JSON.stringify(f)).join(" | "));
  else ok(`3nonies le parseur lit ${cas.length} formes, dont l'ordre des axes quand il est inversé`);
}

/* 4 — un champ supplémentaire glissé dans la citation. */
refus("4 champ supplémentaire dans la preuve", (m) => {
  m.specifications.preuve_poids.citation.attribution = "fabricant";
  return true;
}, "preuve_poids.citation");

/* 5 — un zéro de gabarit dans une donnée de production. */
refus("5 zéro de gabarit", (m) => { m.specifications.valeurs_originales.l = 0; return true; },
  "valeurs_originales.l");

/* 6 — une preuve sans locator. */
refus("6 preuve sans locator", (m) => { delete m.specifications.preuve_poids.citation.locator; return true; },
  "locator");

/* 7 — une review_due qui n'est pas dérivée de la cadence « equipment ». */
refus("7 review_due tapée à la main", (m) => {
  m.specifications.preuve_poids.citation.review_due = "2026-12-31";
  return true;
}, "review_due");

/* 8 — une condition de conformité REFORMULÉE plutôt que citée. */
{
  const m = temoin({ declaration_fabricant: {
    attribution: "déclaration du fabricant — MyDogCanFly ne l'a pas vérifiée",
    condition: "avec un kit de grille spécifique",
    citation: preuve("This carrier meets airline requirements when fitted with the metal door kit."),
  } });
  const r = ModeleCaisse.safeParse(m);
  if (!r.success && r.error.issues.some((i) => i.path.join(".").includes("condition"))) {
    ok("8 une condition reformulée est refusée — elle doit être citée mot pour mot");
  } else echec("8 condition reformulée", r.success ? "acceptée" : "refusée pour un autre motif");
}
/* 8 bis — la même, citée mot pour mot, est acceptée : la garde ne bloque pas le cas légitime. */
{
  const m = temoin({ declaration_fabricant: {
    attribution: "déclaration du fabricant — MyDogCanFly ne l'a pas vérifiée",
    condition: "fitted with the metal door kit",
    citation: preuve("This carrier meets airline requirements when fitted with the metal door kit."),
  } });
  const r = ModeleCaisse.safeParse(m);
  if (r.success) ok("8bis une condition citée mot pour mot est acceptée");
  else echec("8bis condition citée", JSON.stringify(r.error.issues[0]));
}

/* 8 ter — la cadence vaut aussi pour la citation de la DÉCLARATION du fabricant : une réserve de
   conformité vieillit comme un chiffre. */
{
  const m = temoin({ declaration_fabricant: {
    attribution: "déclaration du fabricant — MyDogCanFly ne l'a pas vérifiée",
    citation: preuve("This carrier meets airline requirements.", { review_due: "2026-12-31" }),
  } });
  const r = ModeleCaisse.safeParse(m);
  if (!r.success && r.error.issues.some((i) => i.message.includes("review_due"))) {
    ok("8ter la cadence « equipment » vaut aussi pour la déclaration du fabricant");
  } else echec("8ter cadence déclaration", r.success ? "acceptée" : "refusée pour un autre motif");
}

/* 9 — un profil qui publie avec un seul fabricant. */
{
  const a = temoin(), b = temoin({ id: "fabricant_temoin_b", modele: "Autre modèle (fictif)" });
  const r = deriverProfil("rigide_xl", [a, b]);
  if ("refus" in r && r.refus.includes("un seul fabricant")) ok("9 un profil à fabricant unique ne publie pas");
  else echec("9 fabricant unique", "refus attendu ; vu : " + JSON.stringify(r).slice(0, 120));
}
/* 9 bis — deux fabricants distincts : la dérivation passe, et l'intervalle est CELUI des modèles. */
{
  const a = temoin();
  const b = temoin({ id: "fabricant_temoin_b", fabricant: "Fabricant Témoin B" });
  b.specifications.valeurs_originales.poids_a_vide = 13;
  b.specifications.normalisees_cm_kg.poids_a_vide_kg = 13;
  const r = deriverProfil("rigide_xl", [a, b]);
  if ("profil" in r && r.profil.poids_kg.min === 10 && r.profil.poids_kg.max === 13
      && r.profil.poids_kg.arrondi[0] === 10 && r.profil.poids_kg.arrondi[1] === 13
      && ProfilCaisse.safeParse(r.profil).success) {
    ok("9bis deux fabricants : l'intervalle dérivé est exactement [10, 13]");
  } else echec("9bis dérivation", JSON.stringify(r).slice(0, 200));
}
/* 9 ter — un profil unique ne suffit pas non plus. */
{
  const r = deriverProfil("rigide_xl", [temoin()]);
  if ("refus" in r && r.refus.includes("deux au minimum")) ok("9ter un seul modèle ne publie pas");
  else echec("9ter modèle unique", JSON.stringify(r).slice(0, 120));
}

/* 10 — un profil NON publiable qui porte quand même un intervalle. */
{
  const r = ProfilCaisse.safeParse({ id: "rigide_xl", modeles: [], publiable: false,
    poids_kg: { min: 10, max: 14, arrondi: [10, 14],
                derive_de: "min/max des poids à vide normalisés des modèles cités" } });
  if (!r.success && r.error.issues.some((i) => i.path.join(".").includes("poids_kg"))) {
    ok("10 un profil non publiable ne peut pas porter d'intervalle");
  } else echec("10 profil non publiable", r.success ? "accepté" : "refusé pour un autre motif");
}

/* 11 — la PROPAGATION : un poids de modèle qui change doit changer l'intervalle du profil. */
{
  const a = temoin(), b = temoin({ id: "fabricant_temoin_b", fabricant: "Fabricant Témoin B" });
  b.specifications.valeurs_originales.poids_a_vide = 13;
  b.specifications.normalisees_cm_kg.poids_a_vide_kg = 13;
  const avant = deriverProfil("rigide_xl", [a, b]);
  b.specifications.valeurs_originales.poids_a_vide = 16;
  b.specifications.normalisees_cm_kg.poids_a_vide_kg = 16;
  const apres = deriverProfil("rigide_xl", [a, b]);
  if ("profil" in avant && "profil" in apres && avant.profil.poids_kg.max === 13 && apres.profil.poids_kg.max === 16) {
    ok("11 le poids d'un modèle se propage au profil (13 → 16)");
  } else echec("11 propagation", "l'intervalle n'a pas suivi : " + JSON.stringify({ avant, apres }).slice(0, 160));
}

/* 12 — aucun montant sans poids du chien SAISI. */
{
  const sans = intervalleTotal(null, { min: 12, max: 14 });
  const avec = intervalleTotal(38, { min: 12, max: 14 });
  const sansCaisse = intervalleTotal(38, null);
  if ("refus" in sans && sans.refus.includes("non saisi")
      && "total" in avec && avec.total[0] === 50 && avec.total[1] === 52
      && "refus" in sansCaisse) {
    ok("12 poids du chien non saisi → aucun calcul ; saisi 38 kg + caisse 12–14 → total 50–52");
  } else echec("12 ordre des données", JSON.stringify({ sans, avec, sansCaisse }).slice(0, 200));
}

/* 13 — LE CAS AKITA : l'intervalle traverse la limite, donc aucune certitude. */
{
  const t = intervalleTotal(38, { min: 12, max: 14 });
  const verdict = trancheUnique(t.total, [8, 32, 50, 75]);
  if ("traverse" in verdict && verdict.traverse === 50) {
    ok("13 Akita 38 kg + caisse 12–14 kg : l'intervalle 50–52 traverse la limite de 50 kg — aucun verdict certain");
  } else echec("13 Akita", "traversée attendue à 50 ; vu " + JSON.stringify(verdict));
}
/* 13 bis — LE CAS LABRADOR : entièrement dans une tranche, estimation autorisée. */
{
  const t = intervalleTotal(30, { min: 12, max: 14 });
  const verdict = trancheUnique(t.total, [8, 32, 50, 75]);
  if ("couverte" in verdict) ok("13bis Labrador 30 kg + caisse 12–14 kg : 42–44 tient dans une seule tranche — estimation permise");
  else echec("13bis Labrador", "couverture attendue ; vu " + JSON.stringify(verdict));
}
/* 13 ter — LE CAS CABINE : le sac fait traverser la limite de 8 kg. */
{
  const t = intervalleTotal(7, { min: 0.8, max: 1.5 });
  const verdict = trancheUnique(t.total, [8]);
  if ("traverse" in verdict && verdict.traverse === 8) {
    ok("13ter petite race 7 kg + sac 0,8–1,5 kg : l'ensemble traverse la limite cabine de 8 kg");
  } else echec("13ter cabine", "traversée attendue à 8 ; vu " + JSON.stringify(verdict));
}

/* 14 — une correspondance de race doit se déclarer HYPOTHÈSE. */
{
  const sans = CorrespondanceRace.safeParse({ breed_id: "breed_x", profils_probables: ["rigide_l"],
    methode: "…", confiance: 3 });
  const avec = CorrespondanceRace.safeParse({ breed_id: "breed_x", profils_probables: ["rigide_l"],
    methode: "…", confiance: 3, nature: "hypothèse MyDogCanFly — les mesures réelles du chien priment" });
  if (!sans.success && avec.success) ok("14 une correspondance sans « nature : hypothèse » est refusée");
  else echec("14 nature d'hypothèse", `sans=${sans.success} avec=${avec.success}`);
}

/* 15 — LES REGISTRES DE PRODUCTION sont valides, et honnêtement vides. */
{
  const lire = (f) => JSON.parse(readFileSync(`packages/knowledge/tarifs/${f}`, "utf8"));
  const m = RegistreModeles.safeParse(lire("modeles-caisses.json"));
  const p = RegistreProfils.safeParse(lire("profils-caisses.json"));
  const c = RegistreCorrespondances.safeParse(lire("caisses-par-race.json"));
  if (!m.success || !p.success || !c.success) {
    echec("15 registres de production", JSON.stringify([m.error?.issues[0], p.error?.issues[0], c.error?.issues[0]].filter(Boolean)).slice(0, 220));
  } else {
    const publiables = p.data.profils.filter((x) => x.publiable).length;
    ok(`15 registres valides : ${m.data.modeles.length} modèle(s), ${p.data.profils.length} profil(s) dont ${publiables} publiable(s), ${c.data.correspondances.length} correspondance(s)`);
    /* LE VALIDATEUR DE PRODUCTION, PAS DES BOUCLES DE TEST. Les boucles écrites ici ne
       tournaient que dans ce fichier ; `verifierRegistresCaisses` vit à côté des schémas et
       s'appelle depuis la CI comme depuis les consommateurs — unicité des identifiants,
       références croisées, et intervalles réellement dérivés de leurs modèles. */
    for (const e of verifierRegistresCaisses(m.data.modeles, p.data.profils, c.data.correspondances)) {
      echec("15 registres", e);
    }
  }
}

/* 16 — LE VALIDATEUR LUI-MÊME, vu rougir sur chacune de ses causes. */
{
  const modele = temoin();
  const cas = [
    ["identifiant en double", [modele, { ...modele }], [], [], "en double"],
    ["profil citant un modèle absent", [], [{ id: "rigide_xl", modeles: ["fantome"], publiable: false }], [], "absent du registre des modèles"],
    ["correspondance citant un profil absent", [], [], [{ breed_id: "breed_x", profils_probables: ["fantome"], methode: "…", confiance: 3, nature: "hypothèse MyDogCanFly — les mesures réelles du chien priment" }], "absent du registre des profils"],
  ];
  for (const [nom, mods, profs, corrs, attendu] of cas) {
    const ecarts = verifierRegistresCaisses(mods, profs, corrs);
    if (ecarts.some((e) => e.includes(attendu))) ok(`16 validateur : ${nom}`);
    else echec(`16 validateur : ${nom}`, `attendu « ${attendu} » ; vu : ${ecarts.join(" | ") || "(aucun écart)"}`);
  }
  /* Et l'intervalle qui ne suit plus ses modèles — la propagation vue par le validateur. */
  const b = temoin({ id: "fabricant_temoin_b", fabricant: "Fabricant Témoin B" });
  b.specifications.valeurs_originales.poids_a_vide = 13;
  b.specifications.normalisees_cm_kg.poids_a_vide_kg = 13;
  b.specifications.preuve_dimensions.fragment_source = "(L x W x H) 100 x 60 x 70 cm";
  b.specifications.preuve_poids.fragment_source = "13 kg";
  b.specifications.preuve_poids.citation = preuve("Dimensions (L x W x H) 100 x 60 x 70 cm — net weight 13 kg");
  const profilFaux = { id: "rigide_xl", modeles: [modele.id, b.id], publiable: true,
    poids_kg: { min: 10, max: 99, arrondi: [10, 99], derive_de: "min/max des poids à vide normalisés des modèles cités" } };
  const ecarts = verifierRegistresCaisses([modele, b], [profilFaux], []);
  if (ecarts.some((e) => e.includes("ne suit pas ses modèles"))) ok("16bis validateur : un intervalle qui ne suit plus ses modèles est vu");
  else echec("16bis validateur", `attendu « ne suit pas ses modèles » ; vu : ${ecarts.join(" | ") || "(aucun écart)"}`);
}

if (defauts) { console.error(`\n[caisses] ÉCHEC — ${defauts} contre-épreuve(s) en défaut`); process.exit(1); }
console.log("\n[caisses] chaque garantie du contrat a été vue refuser pour sa cause.");
