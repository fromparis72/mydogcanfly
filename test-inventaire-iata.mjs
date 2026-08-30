#!/usr/bin/env node
/**
 * LES CONTRE-ÉPREUVES DE L'INVENTAIRE IATA.
 *
 *   node test-inventaire-iata.mjs
 *
 * L'inventaire est un CONTRAT pour deux lots : il dit combien d'affirmations sont à corriger et
 * qui les corrige. Un contrat dont le classificateur se trompe en silence est pire qu'aucun
 * contrat. On éprouve donc ici les quatre faux-verts trouvés par la contre-revue du 30/08/2026,
 * chacun sur sa propre cause.
 */
import { classer, relever, verifier, citationsDeLHeritage, ancresOrphelines, MOTIF, ALTERNATIVES, CATEGORIES } from "./inventaire-iata.mjs";

let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

/** Classe toutes les occurrences d'une ligne, comme le fait le relevé. */
const classerLigne = (chemin, ligne) => {
  MOTIF.lastIndex = 0;
  return [...ligne.matchAll(MOTIF)].map((m) => ({
    trouve: m[0], colonne: m.index + 1,
    categorie: classer(chemin, ligne, m[0], m.index, m.index + m[0].length),
  }));
};

/* 1 — P0-2a : UNE RÉFÉRENCE LÉGITIME ET UNE AFFIRMATION INTERDITE SUR LA MÊME LIGNE.
   Mesuré sur la v1 : les deux recevaient « interdit », parce que la décision portait sur la
   ligne. La référence licite disparaissait donc du compte. */
{
  const vus = classerLigne("packages/ui/src/lib/faq.ts", "IATA LAR ; IATA-approved crate");
  const par = Object.fromEntries(vus.map((v) => [v.trouve, v.categorie]));
  if (vus.length !== 2) echec("1 même ligne, deux natures", `${vus.length} occurrence(s) trouvée(s) au lieu de 2`);
  else if (par["IATA LAR"] !== "reference_reglementaire_legitime")
    echec("1 même ligne, deux natures", `« IATA LAR » classée ${par["IATA LAR"]}`);
  else if (par["IATA-approved"] !== "affirmation_publique_interdite")
    echec("1 même ligne, deux natures", `« IATA-approved » classée ${par["IATA-approved"]}`);
  else ok("1 sur une même ligne, la référence licite et l'affirmation interdite sont séparées");
}

/* 2 — P0-2b : UNE CITATION ET UN CHAMP PUBLIC SUR LA MÊME LIGNE. Mesuré sur la v1 : la présence
   d'un `"quote":` n'importe où absorbait l'occurrence extérieure à la citation. */
{
  const ligne = '{"quote": "IATA-approved crates only", "titre": "Caisse homologuée IATA"}';
  const vus = classerLigne("packages/knowledge/raw/sources.json", ligne);
  const dansCitation = vus.filter((v) => v.categorie === "citation_attribuee");
  const dehors = vus.filter((v) => v.categorie !== "citation_attribuee");
  if (dansCitation.length !== 1 || dansCitation[0].trouve !== "IATA-approved")
    echec("2 citation et champ public", `dans la citation : ${JSON.stringify(dansCitation)}`);
  else if (dehors.length !== 1 || !/homologu/i.test(dehors[0].trouve))
    echec("2 citation et champ public", `hors citation : ${JSON.stringify(dehors)}`);
  else ok("2 sur une même ligne, ce qui est dans la citation et ce qui est dehors sont séparés");
}

/* 3 — P0-3 : LE REFUS EXISTE VRAIMENT. La v1 se terminait par un repli qui bénissait toute forme
   inconnue en « référence légitime » : le contrôle « aucune occurrence non classée » ne pouvait
   pas rougir. On exige ici que `classer` rende `null`, et que `verifier` REFUSE. */
{
  const inconnue = classer("packages/ui/src/lib/faq.ts", "an IATA-blessed crate", "IATA-blessed", 3, 15);
  if (inconnue !== null) echec("3 forme inconnue", `classée « ${inconnue} » au lieu de null`);
  else {
    const v = verifier([{ fichier: "f.ts", ligne: 1, colonne: 4, trouve: "IATA-blessed", categorie: null }]);
    if (v.ok) echec("3 refus", "un relevé portant une occurrence non classée est accepté");
    else if (v.inconnues.length !== 1) echec("3 refus", `${v.inconnues.length} inconnue(s) rapportée(s)`);
    else ok("3 une forme qu'aucune règle ne reconnaît rend null, et fait REFUSER le relevé");
  }
}

/* 3 bis — et une catégorie hors liste est refusée elle aussi : sans quoi une faute de frappe
   dans un nom de catégorie passerait pour une catégorie. */
{
  const v = verifier([{ fichier: "f.ts", ligne: 1, colonne: 1, trouve: "homologué", categorie: "categorie_inventee" }]);
  if (v.ok || v.hors.length !== 1) echec("3bis catégorie hors liste", "acceptée");
  else ok("3bis une catégorie absente de la liste fait REFUSER le relevé");
}

/* 4 — AUCUNE ALTERNATIVE DU MOTIF N'ÉCHAPPE AUX SOUS-CLASSIFICATEURS. C'est ce qui rendrait le
   refus théorique : si le motif attrape une forme que personne ne sait juger, elle bloquerait le
   relevé. Chaque alternative porte donc un échantillon représentatif, et en ajouter une sans son
   échantillon rougit ici. */
{
  const ECHANTILLONS = [
    "IATA-approved", "IATA LAR", "Live Animals Regulations",
    "homologué", "homologada", "homologação",
    "conforme IATA", "conforme a la IATA", "conforme à norma IATA",
    "norma IATA", "norme IATA", "exigences IATA",
    "certifiée IATA", "approuvée par l'IATA", "aprobado por la IATA", "aprovada pela IATA",
  ];
  if (ECHANTILLONS.length !== ALTERNATIVES.length) {
    echec("4 couverture du motif", `${ALTERNATIVES.length} alternative(s) au motif pour ${ECHANTILLONS.length} échantillon(s) — l'une d'elles n'est pas éprouvée`);
  } else {
    const muets = ECHANTILLONS.filter((e) => { MOTIF.lastIndex = 0; return !MOTIF.test(e); });
    const orphelins = ECHANTILLONS.filter((e) => classer("packages/ui/src/lib/faq.ts", e, e, 0, e.length) === null);
    if (muets.length) echec("4 couverture du motif", `le motif ne voit pas : ${muets.join(", ")}`);
    else if (orphelins.length) echec("4 couverture du motif", `aucune règle ne juge : ${orphelins.join(", ")}`);
    else ok(`4 les ${ECHANTILLONS.length} formes du motif sont toutes jugées par une règle`);
  }
}

/* 5 — P1 : DÉTERMINISME. Le relevé ne doit dépendre ni de l'ordre du système de fichiers, ni de
   rien d'autre. On rejoue tout avec l'énumération INVERSÉE et on exige l'octet près. */
{
  const a = JSON.stringify(relever());
  const b = JSON.stringify(relever({ inverse: true }));
  const c = JSON.stringify(relever());
  if (a !== c) echec("5 déterminisme", "deux relevés successifs diffèrent");
  else if (a !== b) {
    const x = JSON.parse(a), y = JSON.parse(b);
    const i = x.findIndex((r, k) => JSON.stringify(r) !== JSON.stringify(y[k]));
    echec("5 déterminisme", `l'ordre d'énumération change le relevé — premier écart au rang ${i} : ${JSON.stringify(x[i])} contre ${JSON.stringify(y[i])}`);
  } else ok(`5 le relevé est identique à l'octet près, énumération inversée comprise (${JSON.parse(a).length} occurrences)`);
}

/* 6 — PLUS AUCUNE PRÉTENTION D'INERTIE. La v2 affirmait prouver que l'héritage v1 n'est lu par
   personne, en cherchant `"static/…"` dans les scripts. C'était indémontrable : `join(ROOT,
   "static", f)` y échappait, et ajouter des motifs n'aurait fait que déplacer le trou. La
   catégorie ne protège donc plus rien : elle DIT qu'il y a 18 affirmations à corriger ou à
   supprimer, et elles entrent au micro-lot éditorial. */
{
  const releve = relever();
  const her = releve.filter((r) => r.categorie === "heritage_a_corriger_ou_supprimer");
  if (CATEGORIES.includes("heritage_v1_non_publie")) echec("6 inertie", "la catégorie « non publié » subsiste, avec sa prétention");
  else if (!her.length) echec("6 héritage", "aucune occurrence d'héritage — la catégorie ne peut rien prouver");
  else {
    const constats = citationsDeLHeritage();
    ok(`6 l'héritage v1 ne prétend plus être inerte : ${her.length} occurrence(s) à corriger ou supprimer, ${constats.length} citation(s) rapportée(s) sans conclusion`);
  }
}

/* 6 bis — LA PHRASE PORTEUSE PRIME SUR L'OCCURRENCE. « IATA standard » et « norme IATA » sont
   licites prises seules ; « norma IATA » ne l'est pas ; et les trois appartiennent au MÊME titre,
   remplacé en entier. Sans cette catégorie, deux des trois modifications approuvées manqueraient
   au contrat de l'étape 3 — le relevé annonçait 33 applicatives là où il en faut 35. */
{
  const releve = relever();
  const ref = releve.filter((r) => r.categorie === "reference_reglementaire_a_reformuler");
  const fichiers = new Set(ref.map((r) => r.fichier));
  const lignes = new Set(ref.map((r) => r.ligne));
  const textes = ref.map((r) => r.trouve.toLowerCase()).sort();
  if (ref.length !== 3) echec("6bis à reformuler", `${ref.length} occurrence(s) au lieu de 3`);
  else if (fichiers.size !== 1 || !/AirlinePremiumPage\.astro$/.test([...fichiers][0]))
    echec("6bis à reformuler", `fichier(s) : ${[...fichiers].join(", ")}`);
  else if (lignes.size !== 1) echec("6bis à reformuler", `réparties sur ${lignes.size} lignes`);
  else if (JSON.stringify(textes) !== JSON.stringify(["iata standard", "norma iata", "norme iata"]))
    echec("6bis à reformuler", `textes : ${JSON.stringify(textes)}`);
  else ok(`6bis les trois occurrences du même titre sont à reformuler ensemble (ligne ${[...lignes][0]})`);
}

/* 6 ter — LE CONTRAT CHIFFRÉ DE L'ÉTAPE 3 : 32 affirmations interdites, 3 références à
   reformuler, 35 modifications applicatives. Un contrat sans chiffre exigé n'engage à rien. */
{
  const releve = relever();
  const interdites = releve.filter((r) => r.categorie === "affirmation_publique_interdite").length;
  const aRef = releve.filter((r) => r.categorie === "reference_reglementaire_a_reformuler").length;
  if (interdites !== 32 || aRef !== 3)
    echec("6ter contrat de l'étape 3", `${interdites} interdites et ${aRef} à reformuler, attendu 32 et 3`);
  else ok(`6ter contrat de l'étape 3 : ${interdites} + ${aRef} = ${interdites + aRef} modifications applicatives`);
}

/* 6 quater — UNE ANCRE DE REFORMULATION QUI NE TROUVE RIEN FAIT REFUSER LE RELEVÉ. Une
   déclaration qui ne s'applique à rien ne protège rien, et masquerait une modification approuvée
   qu'on croirait couverte. */
{
  const bidon = [{ fichier: "packages/ui/src/components/AirlinePremiumPage.astro", ligne: 1, colonne: 1,
                   trouve: "norma IATA", categorie: "affirmation_publique_interdite" }];
  const v = verifier(bidon);
  if (v.ok || !v.orphelines.length) echec("6quater ancre orpheline", "un relevé où l'ancre ne mord pas est accepté");
  else if (ancresOrphelines(relever()).length) echec("6quater ancre orpheline", "l'ancre réelle ne mord pas non plus");
  else ok("6quater une ancre de reformulation qui ne trouve rien fait REFUSER le relevé");
}

/* 7 — LE RELEVÉ RÉEL PASSE SA PROPRE VÉRIFICATION, et tout est classé. */
{
  const releve = relever();
  const v = verifier(releve);
  if (!v.ok) echec("7 relevé réel", `${v.inconnues.length} inconnue(s), ${v.hors.length} hors liste, ${v.violations.length} violation(s)`);
  else {
    const somme = CATEGORIES.reduce((n, c) => n + releve.filter((r) => r.categorie === c).length, 0);
    if (somme !== releve.length) echec("7 relevé réel", `${somme} classées pour ${releve.length} occurrences`);
    else ok(`7 le relevé réel — ${releve.length} occurrences, ${new Set(releve.map((r) => r.fichier)).size} fichiers — est intégralement classé`);
  }
}

if (defauts) { console.error(`\n[inventaire] ÉCHEC — ${defauts} contre-épreuve(s) en défaut`); process.exit(1); }
console.log("\n[inventaire] la décision porte sur l'occurrence, le refus existe, rien ne se cache derrière une inertie invérifiable, l'ordre ne compte pas.");
