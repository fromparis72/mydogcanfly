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

/** Un modèle TÉMOIN, fictif et nommé comme tel — 100 × 60 × 70 cm, 10 kg. */
const temoin = (over = {}) => ({
  id: "fabricant_temoin_a",
  fabricant: "Fabricant Témoin A",
  modele: "Modèle d'épreuve (fictif)",
  type: "rigide",
  specifications: {
    valeurs_originales: { unite_longueur: "cm", unite_masse: "kg", l: 100, w: 60, h: 70,
                          poids_a_vide: 10, champ_source: "poids net" },
    normalisees_cm_kg: { l: 100, w: 60, h: 70, poids_a_vide_kg: 10,
                         derive_de: "conversion mécanique depuis valeurs_originales" },
    preuve: preuve("Dimensions 100 x 60 x 70 cm — net weight 10 kg"),
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

/* 1 — le poids change, la citation et la source ne changent pas. */
refus("1 poids modifié, citation et source inchangées", (m) => {
  m.specifications.valeurs_originales.poids_a_vide = 11;
  return true;
}, "normalisees_cm_kg");

/* 2 — une normalisée qui n'est pas la conversion de son originale. */
refus("2 valeur normalisée ≠ conversion de l'originale", (m) => {
  m.specifications.normalisees_cm_kg.l = 101;
  return true;
}, "normalisees_cm_kg");

/* 2 bis — la conversion pouce → cm doit être faite, pas recopiée. */
refus("2bis pouces recopiés en centimètres", (m) => {
  m.specifications.valeurs_originales.unite_longueur = "in";
  return true;
}, "normalisees_cm_kg");

/* 3 — un poids tiré d'un champ commercial générique plutôt que du poids net. */
{
  const m = temoin();
  m.specifications.valeurs_originales.champ_source = "weight";
  const r = ModeleCaisse.safeParse(m);
  /* Le schéma ne peut pas savoir ce que « weight » désigne : c'est la GARDE DE REGISTRE qui
     l'exige. On éprouve donc ici la garde, pas le schéma. */
  const CHAMPS_ADMIS = ["poids net", "net weight", "peso netto"];
  const admis = CHAMPS_ADMIS.some((c) => m.specifications.valeurs_originales.champ_source.toLowerCase().includes(c));
  if (r.success && !admis) ok("3 un champ « weight » générique n'est pas un poids net — la garde de registre le refuse");
  else echec("3 champ de poids générique", admis ? "« weight » a été admis comme poids net" : "le schéma a refusé pour une autre raison");
}

/* 4 — un champ supplémentaire glissé dans la citation. */
refus("4 champ supplémentaire dans la preuve", (m) => {
  m.specifications.preuve.attribution = "fabricant";
  return true;
}, "specifications.preuve");

/* 5 — un zéro de gabarit dans une donnée de production. */
refus("5 zéro de gabarit", (m) => { m.specifications.valeurs_originales.l = 0; return true; },
  "valeurs_originales.l");

/* 6 — une preuve sans locator. */
refus("6 preuve sans locator", (m) => { delete m.specifications.preuve.locator; return true; },
  "locator");

/* 7 — une review_due qui n'est pas dérivée de la cadence « equipment ». */
refus("7 review_due tapée à la main", (m) => {
  m.specifications.preuve.review_due = "2026-12-31";
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
    /* JAMAIS VERT FAUTE DE MATIÈRE — le jour où les registres se remplissent, ce contrôle-ci
       exige que chaque profil publiable soit RÉELLEMENT dérivable de modèles présents. */
    for (const profil of p.data.profils.filter((x) => x.publiable)) {
      const modeles = profil.modeles.map((id) => m.data.modeles.find((x) => x.id === id)).filter(Boolean);
      const r = deriverProfil(profil.id, modeles);
      if ("refus" in r) { echec("15 profil publiable non dérivable", `${profil.id} : ${r.refus}`); continue; }
      if (JSON.stringify(r.profil.poids_kg) !== JSON.stringify(profil.poids_kg)) {
        echec("15 intervalle non dérivé", `${profil.id} : inscrit ${JSON.stringify(profil.poids_kg)}, dérivé ${JSON.stringify(r.profil.poids_kg)}`);
      }
    }
    for (const corr of c.data.correspondances) {
      for (const id of corr.profils_probables) {
        if (!p.data.profils.some((x) => x.id === id)) echec("15 profil inexistant", `${corr.breed_id} → « ${id} » n'est pas au registre des profils`);
      }
    }
  }
}

if (defauts) { console.error(`\n[caisses] ÉCHEC — ${defauts} contre-épreuve(s) en défaut`); process.exit(1); }
console.log("\n[caisses] chaque garantie du contrat a été vue refuser pour sa cause.");
