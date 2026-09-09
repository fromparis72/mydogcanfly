#!/usr/bin/env node
/**
 * LES CONTRE-ÉPREUVES DE L'INVENTAIRE DES PREUVES.
 *
 *   node test-inventaire-preuves.mjs
 *
 * Ce que ce harnais doit établir, et rien d'autre :
 *   (a) le registre commité est REJOUABLE : reconstruit en mémoire depuis les données brutes, il
 *       est identique à l'octet près à mesures/preuves/inventaire-compagnies.json ;
 *   (b) les comptes par catégorie et par canal sont FIGÉS en sentinelles nommées ;
 *   (c) les témoins : les 3 A et les 3 D sont ceux attendus, par nom ;
 *   (d) le classement est COHÉRENT avec `niveauDePreuve` (objects.ts) — reproduit en Node pur et
 *       éprouvé sur les 3 A et sur 5 B, plus un fil de détente sur le texte TypeScript lui-même ;
 *   (e) non-vacuité : une ligne mutée change de catégorie, dans les deux sens.
 *
 * Le registre n'est PAS une source de vérité pour décider (voir l'en-tête du script) ; ce
 * harnais protège seulement sa reproductibilité et son accord avec la frontière de confiance.
 */
import { readFileSync } from "node:fs";
import { CANAUX, CATEGORIES, CHEMIN_REGISTRE, chargerDonnees, construireRegistre, serialiser,
  classerLigne, niveauDePreuveReproduit, manquesDeCitation } from "./packages/knowledge/scripts/inventaire-preuves.mjs";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

/* SENTINELLES — 08/09/2026. Elles n'avancent que par MOUVEMENT NOMMÉ, comme les compteurs de
 * test-frontiere-confiance.mjs : chaque citation intégrée, chaque URL officielle posée sur une
 * politique ou une règle, chaque canal renseigné devra bouger ces chiffres en se nommant ici,
 * dans un commentaire daté. Un chiffre qui bouge sans commentaire est une régression, dans un
 * sens comme dans l'autre. */
const SENTINELLES = {
  compagnies: 102, lignes: 306, politiques: 302,
  /* MOUVEMENT NOMMÉ (09/09/2026, import strict lot 4 — 22 citations de plus, 74 en tout) : A 52 → 74 ; B 102 → 90 ; C 149 → 139 ; D inchangé. */
  par_categorie: { A: 74, A_incomplete: 0, B: 90, C: 139, D: 3 },
  par_canal: {
    /* MOUVEMENT NOMMÉ (08/09/2026, import strict V3 — 25 citations importées) : A 3 → 28 ; B 125 → 108 ; C 175 → 167 ; D inchangé. */
    /* MOUVEMENT NOMMÉ (08/09/2026, import strict lots 2 et 3 — 24 citations de plus, 52 en tout) : A 28 → 52 ; B 108 → 102 ; C 167 → 149. */
    /* MOUVEMENT NOMMÉ (09/09/2026, import strict lot 4) : cabine 26/24/52 → 36/19/47 ; soute 21/56/25 → 29/51/22 ; fret 5/22/72 → 9/20/70. */
    cabin: { A: 36, A_incomplete: 0, B: 19, C: 47, D: 0 },
    hold: { A: 29, A_incomplete: 0, B: 51, C: 22, D: 0 },
    cargo: { A: 9, A_incomplete: 0, B: 20, C: 70, D: 3 },
  },
  /* 42 B par la politique = les 45 politiques non fabriquées moins les 3 citées ; 83 B par une
     règle = 82 politiques fabriquées + Air Tahiti Nui soute (sans politique) ; 41 de ces 83 ne
     tiennent qu'à la table gov.uk des routes agréées, pas à une page de la compagnie. */
  /* MOUVEMENT NOMMÉ (08/09/2026, import strict V3 — 25 citations importées) : politique 42 → 33, règle 83 → 75, gov.uk seul 41 → 37. */
  /* MOUVEMENT NOMMÉ (08/09/2026, import strict lots 2 et 3 — 24 citations de plus, 52 en tout) : politique 33 → 30, règle 75 → 72. */
  /* MOUVEMENT NOMMÉ (09/09/2026, import strict lot 4 — 22 citations de plus, 74 en tout) : politique 30 → 24, règle 72 → 66, gov.uk seul 37 → 35. */
  B_par_piste: { politique: 24, regle: 66 }, B_par_regle_gov_uk_seul: 35,
  regles_sans_canal: ["rule_transavia_gb_no_pets"],
};
/* MOUVEMENT NOMMÉ (08/09/2026, import strict V3 — 25 citations importées) : 3 → 28 A, nominativement. */
const A_ATTENDUS = [
  /* MOUVEMENT NOMMÉ (09/09/2026, import strict lot 4 — 22 citations de plus, 74 en tout) : 52 → 74, nominativement, dans l'ordre de l'inventaire (cabine, soute, fret). */
  "airline_aegean#cabin",
  "airline_aegean#hold",
  "airline_aer_lingus#cabin",
  "airline_air_canada#cabin",
  "airline_air_canada#hold",
  "airline_air_europa#cabin",
  "airline_air_europa#hold",
  "airline_air_france#hold",
  "airline_air_india#cabin",
  "airline_air_india#hold",
  "airline_air_india#cargo",
  "airline_air_transat#cabin",
  "airline_air_transat#hold",
  "airline_alaska#cabin",
  "airline_alaska#hold",
  "airline_alaska#cargo",
  "airline_american#cabin",
  "airline_american#cargo",
  "airline_ana#cabin",
  "airline_ana#hold",
  "airline_austrian#cabin",
  "airline_austrian#hold",
  "airline_avianca#cabin",
  "airline_avianca#hold",
  "airline_british_airways#cabin",
  "airline_brussels#cabin",
  "airline_brussels#hold",
  "airline_cathay_pacific#cabin",
  "airline_cathay_pacific#cargo",
  "airline_delta#cabin",
  "airline_easyjet#cabin",
  "airline_easyjet#hold",
  "airline_emirates#cabin",
  "airline_emirates#hold",
  "airline_emirates#cargo",
  "airline_ethiopian#cabin",
  "airline_ethiopian#hold",
  "airline_ethiopian#cargo",
  "airline_etihad#cabin",
  "airline_eva_air#cabin",
  "airline_eva_air#hold",
  "airline_finnair#cabin",
  "airline_iberia#cabin",
  "airline_iberia#hold",
  "airline_ita_airways#cabin",
  "airline_ita_airways#hold",
  "airline_jal#hold",
  "airline_jetblue#cabin",
  "airline_klm#cabin",
  "airline_klm#hold",
  "airline_lufthansa#cabin",
  "airline_lufthansa#hold",
  "airline_qantas#cabin",
  "airline_qantas#hold",
  "airline_qantas#cargo",
  "airline_qatar_airways#cabin",
  "airline_qatar_airways#hold",
  "airline_ryanair#cabin",
  "airline_ryanair#hold",
  "airline_ryanair#cargo",
  "airline_sas#cabin",
  "airline_swiss#cabin",
  "airline_swiss#hold",
  "airline_tap#cabin",
  "airline_tap#hold",
  "airline_thai_airways#cargo",
  "airline_transavia#cabin",
  "airline_transavia#hold",
  "airline_turkish#cabin",
  "airline_turkish#hold",
  "airline_virgin_australia#cabin",
  "airline_vueling#hold",
  "airline_westjet#cabin",
  "airline_westjet#hold",
];
const D_ATTENDUS = ["airline_la_compagnie#cargo", "airline_smartwings#cargo", "airline_transavia#cargo"];
/* Cinq B par la politique, pris parmi les 42 : deux décidées `offered`, deux `not_offered`,
   une `legacy_unreviewed` — pour que la cohérence soit éprouvée sur les trois formes. */
/* KLM soute est devenue A (citée) : témoin B re-fondé sur Air Canada soute, jamais abaissé. */
const B_TEMOINS = ["airline_air_canada#cargo", "airline_air_france#cabin", "airline_american#hold", "airline_british_airways#hold", "airline_asiana#cargo"];

const donnees = chargerDonnees();
const registre = construireRegistre(donnees);
const { resume, lignes } = registre;
const cle = (l) => `${l.airline_id}#${l.canal}`;
const par = new Map(lignes.map((l) => [cle(l), l]));

console.log("=== (a) Le registre commité est rejouable ===");
{
  const commis = readFileSync(CHEMIN_REGISTRE, "utf8");
  const rejoue = serialiser(registre);
  check(`${CHEMIN_REGISTRE} est identique à l'octet près à sa reconstruction en mémoire`,
    commis === rejoue, "relancer `npm run inventaire:preuves` et commiter le fichier (ou expliquer le mouvement)");
  check("l'empreinte des données brutes est celle du fichier commité",
    JSON.parse(commis).resume.empreinte_donnees_sha256 === resume.empreinte_donnees_sha256);
  check("aucune ligne ne porte d'horodatage (rejouable = sans date)",
    !/"genere_le"|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(rejoue));
  const ordre = lignes.map(cle);
  const attendu = [...lignes].sort((x, y) => x.airline_id.localeCompare(y.airline_id, "en") || CANAUX.indexOf(x.canal) - CANAUX.indexOf(y.canal)).map(cle);
  check("les lignes sont triées par airline_id puis canal (cabin, hold, cargo)", ordre.join() === attendu.join());
  check("chaque ligne porte une catégorie du registre fermé", lignes.every((l) => CATEGORIES.includes(l.categorie)));
}

console.log("\n=== (b) Sentinelles : comptes figés par catégorie et par canal ===");
{
  check(`${SENTINELLES.compagnies} compagnies × 3 = ${SENTINELLES.lignes} lignes, ${SENTINELLES.politiques} politiques`,
    resume.compagnies === SENTINELLES.compagnies && resume.lignes === SENTINELLES.lignes && resume.politiques === SENTINELLES.politiques,
    JSON.stringify({ compagnies: resume.compagnies, lignes: resume.lignes, politiques: resume.politiques }));
  check(`par catégorie : ${JSON.stringify(SENTINELLES.par_categorie)}`,
    JSON.stringify(resume.par_categorie) === JSON.stringify(SENTINELLES.par_categorie), JSON.stringify(resume.par_categorie));
  for (const c of CANAUX) {
    check(`${c} : ${JSON.stringify(SENTINELLES.par_canal[c])}`,
      JSON.stringify(resume.par_canal[c]) === JSON.stringify(SENTINELLES.par_canal[c]), JSON.stringify(resume.par_canal[c]));
  }
  check("la somme des canaux redonne le total (aucune ligne comptée deux fois ou oubliée)",
    CATEGORIES.every((k) => CANAUX.reduce((n, c) => n + resume.par_canal[c][k], 0) === resume.par_categorie[k]));
  check(`B par piste ${JSON.stringify(SENTINELLES.B_par_piste)}, dont gov.uk seul ${SENTINELLES.B_par_regle_gov_uk_seul}`,
    JSON.stringify(resume.B_par_piste) === JSON.stringify(SENTINELLES.B_par_piste) && resume.B_par_regle_gov_uk_seul === SENTINELLES.B_par_regle_gov_uk_seul,
    JSON.stringify({ piste: resume.B_par_piste, gov: resume.B_par_regle_gov_uk_seul }));
  check("une seule règle compagnie sans canal, nommée, non attribuée",
    JSON.stringify(resume.regles_sans_canal) === JSON.stringify(SENTINELLES.regles_sans_canal), resume.regles_sans_canal.join(", "));
}

console.log("\n=== (c) Témoins nommés ===");
{
  const A = lignes.filter((l) => l.categorie === "A").map(cle);
  check(`les ${A_ATTENDUS.length} A sont ${A_ATTENDUS.join(", ")}`, A.join() === A_ATTENDUS.join(), A.join(", "));
  check("les 74 A passent par la POLITIQUE (aucune règle citée n'existe encore)",
    lignes.filter((l) => l.categorie === "A").every((l) => l.piste === "politique" && l.manques.length === 0));
  const D = lignes.filter((l) => l.categorie === "D").map(cle);
  check(`les 3 D sont ${D_ATTENDUS.join(", ")}`, D.join() === D_ATTENDUS.join(), D.join(", "));
  check("un D n'a ni politique, ni règle, ni URL — rien à montrer, rien d'hérité",
    lignes.filter((l) => l.categorie === "D").every((l) => l.niveau_de_preuve_politique === null && !l.priorite.regles.length && l.url === null));
  const tahiti = par.get("airline_air_tahiti_nui#hold");
  check("Air Tahiti Nui soute : sans politique mais B par la règle gov.uk — pas D",
    tahiti?.categorie === "B" && tahiti.piste === "regle:rule_air_tahiti_nui_gb_not_approved" && tahiti.niveau_de_preuve_politique === null);
  check("toute ligne C sur une URL fabriquée le dit (`url_fabriquee`) et n'expose pas cette URL comme piste",
    lignes.filter((l) => l.categorie === "C" && l.priorite.source_derived).every((l) => l.priorite.url_fabriquee && l.url === null));
}

console.log("\n=== (d) Cohérence avec `niveauDePreuve` ===");
{
  /* Fil de détente : la reproduction n'a de valeur que si le texte TypeScript porte encore les
     mêmes conditions, dans le même ordre. On les cherche dans objects.ts. */
  const ts = readFileSync("packages/knowledge/src/objects.ts", "utf8");
  const corps = ts.slice(ts.indexOf("export function niveauDePreuve("), ts.indexOf("export function projectPlacementPolicy("));
  const conditions = [
    /if \(!s\) return "aucune"/, /source_derived\) return "aucune"/, /isForbiddenSource\(s\.url\)\) return "aucune"/,
    /FACTUAL_SOURCE_TYPES[^\n]*includes\(s\.source_type\)\) return "aucune"/, /https\?:\$\/\.test\(new URL\(s\.url\)\.protocol\)/,
    /s\.quote\.length >= 10/, /quote_language\.length > 0/, /locator\.length > 0/, /citee \? "citee" : "officielle_non_citee"/,
  ];
  const positions = conditions.map((re) => corps.search(re));
  check("objects.ts porte encore les 9 conditions de `niveauDePreuve`, dans l'ordre reproduit",
    positions.every((p) => p >= 0) && positions.every((p, i) => i === 0 || p > positions[i - 1]), positions.join(", "));
  const ft = readFileSync("packages/knowledge/src/common.ts", "utf8");
  check("`FACTUAL_SOURCE_TYPES` et `FORBIDDEN_SOURCE_DOMAINS` sont ceux repris par le script",
    /FACTUAL_SOURCE_TYPES = \[\s*"official_website", "regulation", "government", "airline_contact",\s*\]/.test(ft)
    && /FORBIDDEN_SOURCE_DOMAINS = \["mydogcanfly\.com"\]/.test(ft));

  const politiqueDe = (k) => {
    const [id, canal] = k.split("#");
    return donnees.objets.find((o) => o.id === id)?.premium?.policy?.[canal];
  };
  for (const k of A_ATTENDUS) {
    check(`${k} : A ⇔ niveauDePreuve = citee`,
      par.get(k).categorie === "A" && niveauDePreuveReproduit(politiqueDe(k)) === "citee" && par.get(k).niveau_de_preuve_politique === "citee");
  }
  for (const k of B_TEMOINS) {
    const l = par.get(k);
    check(`${k} : B par la politique ⇔ niveauDePreuve = officielle_non_citee`,
      l?.categorie === "B" && l.piste === "politique" && niveauDePreuveReproduit(politiqueDe(k)) === "officielle_non_citee",
      JSON.stringify({ categorie: l?.categorie, piste: l?.piste, niveau: niveauDePreuveReproduit(politiqueDe(k)) }));
  }
  /* Et sur l'ensemble : les paires (catégorie, niveau) sont exactement celles attendues, et le
     script lui-même ne signale aucune paire inattendue. */
  const paires = resume.coherence_niveau_de_preuve.paires;
  /* MOUVEMENT NOMMÉ (08/09/2026, import strict V3 — 25 citations importées) : 3/42/175 → 28/33/167 ; 82 → 74 B par règle sur politique « aucune ». */
  /* MOUVEMENT NOMMÉ (08/09/2026, import strict lots 2 et 3 — 24 citations de plus, 52 en tout) : 28/33/167 → 52/30/149 ; 74 → 71. */
  /* MOUVEMENT NOMMÉ (09/09/2026, import strict lot 4 — 22 citations de plus, 74 en tout) : 52/30/149 → 74/24/139 ; 71 → 65. */
  check("sur les 306 lignes, A ↔ citee 74, B(politique) ↔ officielle_non_citee 24, C ↔ aucune 139",
    paires["A ↔ citee"] === 74 && paires["B ↔ officielle_non_citee"] === 24 && paires["C ↔ aucune"] === 139, JSON.stringify(paires));
  check("les seuls écarts sont NOMMÉS : 65 B par règle sur politique « aucune », 1 B par règle sans politique, 3 D",
    resume.coherence_niveau_de_preuve.ecarts.B_par_regle_sur_politique_aucune === 65
    && resume.coherence_niveau_de_preuve.ecarts.B_par_regle_sans_politique === 1
    && resume.coherence_niveau_de_preuve.ecarts.D_sans_politique === 3
    && resume.coherence_niveau_de_preuve.ecarts.inattendus.length === 0, JSON.stringify(resume.coherence_niveau_de_preuve.ecarts));
  const niveaux = lignes.filter((l) => l.niveau_de_preuve_politique !== null).reduce((m, l) => { m[l.niveau_de_preuve_politique] = (m[l.niveau_de_preuve_politique] ?? 0) + 1; return m; }, {});
  check("302 politiques : 74 citées, 24 officielles non citées, 204 aucune — le compte de test-frontiere-confiance",
    niveaux.citee === 74 && niveaux.officielle_non_citee === 24 && niveaux.aucune === 204, JSON.stringify(niveaux));
}

console.log("\n=== (e) Non-vacuité : une ligne mutée change de catégorie ===");
{
  const ba = donnees.objets.find((o) => o.id === "airline_british_airways").premium.policy.cabin;
  const regles = donnees.regles.filter((r) => r.scope?.type === "airline" && r.scope.id === "airline_british_airways" && (r.effect?.placement ?? []).includes("cabin"));
  check("témoin intact : BA cabine est A", classerLigne(ba, regles).categorie === "A");
  const tronquee = { ...ba, source: { ...ba.source, quote: ba.source.quote.slice(0, 9) } };
  const c1 = classerLigne(tronquee, regles);
  check("citation tronquée à 9 caractères → A_incomplete, manque nommé `quote<10`",
    c1.categorie === "A_incomplete" && c1.manques.join() === "quote<10", JSON.stringify(c1.manques));
  const { locator, ...sansLocator } = ba.source;
  const c2 = classerLigne({ ...ba, source: sansLocator }, regles);
  check("citation sans locator → A_incomplete, manque nommé `locator`", c2.categorie === "A_incomplete" && c2.manques.join() === "locator");
  const { quote, quote_language, locator: _l, ...sansCitation } = ba.source;
  check("sans aucune citation → B par la politique (l'URL officielle reste)", classerLigne({ ...ba, source: sansCitation }, regles).categorie === "B");
  const c3 = classerLigne({ ...ba, source_derived: true }, regles);
  check("citation posée sur une URL fabriquée → A_incomplete, manque `url_fabriquee` (jamais A)",
    c3.categorie === "A_incomplete" && c3.manques.join() === "url_fabriquee");
  check("citation posée sur une page mydogcanfly.com → manque `url_officielle`",
    manquesDeCitation({ ...ba.source, url: "https://mydogcanfly.com/x" }).join() === "url_officielle");
  /* Dans l'autre sens : un B devient A dès que les cinq champs sont posés — et une règle citée
     vaut A pour le canal, sans toucher la politique. */
  /* MOUVEMENT NOMMÉ (08/09/2026, import strict V3 — 25 citations importées) : KLM soute et Aegean cabine sont devenues A (citées) ; les témoins B et C sont
     RE-FONDÉS sur Air Canada soute (B par la politique) et aeromexico cabin (C, URL fabriquée), pas abaissés. */
  /* MOUVEMENT NOMMÉ (08/09/2026, import strict lots 2 et 3 — 24 citations de plus, 52 en tout) : Air Canada soute est devenue A à son tour ; témoin B re-fondé sur WestJet soute. */
  /* WestJet soute n'a qu'une règle AUTO-CITÉE (mydogcanfly.com) : citée, elle donne A_incomplete,
     pas A — le témoin « règle citée → A » exige une règle à URL officielle. United soute en a. */
  const ac = donnees.objets.find((o) => o.id === "airline_united").premium.policy.hold;
  const acRegles = donnees.regles.filter((r) => r.scope?.type === "airline" && r.scope.id === "airline_united" && (r.effect?.placement ?? []).includes("hold"));
  const regleOfficielle = acRegles.findIndex((r) => r.id === "rule_ua_no_hold_cargo");
  check("United soute est B", classerLigne(ac, acRegles).categorie === "B");
  check("United soute + les cinq champs → A par la politique",
    classerLigne({ ...ac, source: { ...ac.source, quote: "Dogs travel in the hold up to 45 kg.", quote_language: "en", locator: "section « Hold »" } }, acRegles).categorie === "A");
  const regleCitee = { ...acRegles[regleOfficielle], source: { ...acRegles[regleOfficielle].source, quote: "Dogs travel in the hold up to 45 kg.", quote_language: "en", locator: "section « Hold »" } };
  const c4 = classerLigne(ac, [regleCitee, ...acRegles.filter((_, i) => i !== regleOfficielle)]);
  check("United soute + une RÈGLE citée (URL officielle) → A par la règle", c4.categorie === "A" && c4.piste === `regle:${regleCitee.id}`, JSON.stringify(c4));
  const temoinC = donnees.objets.find((o) => o.id === "airline_aeromexico").premium.policy.cabin;
  check("aeromexico cabin (URL fabriquée, règle auto-citée) est C", classerLigne(temoinC, []).categorie === "C");
  check("aeromexico cabin + une règle avec URL officielle → B par la règle",
    classerLigne(temoinC, [{ id: "rule_x", source: { url: "https://example-airline.example/pets", source_type: "official_website", verified_date: "2026-09-08" } }]).categorie === "B");
  check("ni politique ni règle → D", classerLigne(undefined, []).categorie === "D");
}

console.log(`\n${pass} OK, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
