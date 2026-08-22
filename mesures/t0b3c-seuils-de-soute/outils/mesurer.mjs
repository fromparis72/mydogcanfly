#!/usr/bin/env node
/**
 * T0-B3-c — LES 34 SEUILS DE SOUTE AUTO-CITÉS, MESURÉS.
 *
 * Ce dossier ne corrige rien : aucune règle n'est retirée, aucun seuil déplacé, aucun fichier de
 * `packages/` écrit. Les retraits sont simulés EN MÉMOIRE, et l'empreinte des fichiers bruts est
 * relue à la fin.
 *
 * T0-B3 les avait nommés comme candidate de premier sous-lot : 34 règles, 34 compagnies,
 * dominantes 34 sur 34, aucun filet derrière. Un seuil faux refuse un chien qui pouvait voler, ou
 * en accepte un qui ne le pouvait pas. Ce dossier dit lequel des deux, et sur quelle preuve.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { normalize } from "../../../packages/knowledge/src/normalize.ts";
import { evaluate } from "../../../packages/engine/src/evaluate.ts";
import { explain } from "../../../packages/engine/src/explain.ts";

/** Base de mesure FIGÉE, jamais `HEAD` : un sceau qui change parce qu'on a commité le sceau ne
 *  scelle rien (défaut relevé en contre-revue sur la première version de T0-B3). */
export const MESURE_BASE_SHA = "ff692b2d2a446f069c965b5901021150fab44d83";

const DOSSIER = "mesures/t0b3c-seuils-de-soute";
const RAW = {
  objets: "packages/knowledge/raw/objects.json",
  regles: "packages/knowledge/raw/rules.json",
  race: "packages/knowledge/raw/breed-restrictions.json",
};
/* L'empreinte du MOTEUR fait partie du sceau : ces chiffres décrivent ce que le code fait, pas
   seulement ce que les données disent. Leçon de T0-B3-b, où deux dossiers ont changé de chiffres
   à référentiel identique. */
const SOURCES_MOTEUR = ["packages/engine/src/evaluate.ts", "packages/engine/src/explain.ts",
  "packages/engine/src/contracts.ts", "packages/knowledge/src/normalize.ts"];

const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const auCommit = (c) => execFileSync("git", ["show", `${MESURE_BASE_SHA}:${c}`],
  { maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });

const CONTRE = (process.argv.find((a) => a.startsWith("--contre-epreuve=")) ?? "").split("=")[1] ?? "";
let echecs = 0;
const exiger = (label, cond, detail = "") => {
  if (!cond) { echecs++; process.stdout.write(`    ✗ ${label}${detail ? ` — ${detail}` : ""}\n`); }
};

/* ---- Le référentiel, scellé ------------------------------------------------------------------- */
for (const chemin of Object.values(RAW)) {
  if (sha256(readFileSync(chemin)) !== sha256(auCommit(chemin))) {
    process.stderr.write(`[t0b3c] ÉCHEC — ${chemin} diffère de la base ${MESURE_BASE_SHA.slice(0, 7)} : `
      + "ce dossier ne peut pas se mesurer sur un autre état.\n");
    process.exit(1);
  }
}
const brut = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, JSON.parse(readFileSync(v, "utf8"))]));

/* ---- LES CONTRE-ÉPREUVES ------------------------------------------------------------------------
 * Une mesure incapable d'échouer ne mesure rien. Chacune casse EN MÉMOIRE un invariant précis —
 * jamais un fichier — et le runner exige qu'elle sorte en 1 avec le diagnostic correspondant.
 *   `rationale` : les textes ne décrivent plus une limite chien + caisse → l'écart central tombe ;
 *   `temoin`    : le témoin passe SOUS le seuil → « elles mordent » et « elles sont dominantes »
 *                 tombent, ce qui prouve que ces deux-là se lisent bien dans le moteur. */
if (CONTRE === "rationale") {
  for (const r of brut.regles) {
    if (r.category === "hold_weight") r.rationale = (r.rationale ?? "").replace(/combined dog \+ crate/i, "dog");
  }
}
const kb = normalize({ ...brut.objets, rules: brut.regles, breed_restrictions: brut.race });

/* ---- Le périmètre : l'hôte de l'URL, jamais le `source_type` déclaré ---------------------------- */
const estAutoCitee = (url) => { try { return /(^|\.)mydogcanfly\.com$/i.test(new URL(url).hostname); } catch { return false; } };
const TOUS_SEUILS = brut.regles.filter((r) => r.category === "hold_weight");
const LES_34 = TOUS_SEUILS.filter((r) => estAutoCitee(r.source.url))
  .sort((a, b) => a.id.localeCompare(b.id));
exiger("34 seuils de soute auto-cités, un par compagnie, sans doublon",
  LES_34.length === 34 && new Set(LES_34.map((r) => r.scope.id)).size === 34, String(LES_34.length));
exiger("toutes refusent, aucune n'autorise", LES_34.every((r) => r.effect.action === "deny"));

/* ---- SECOND ÉCART : six d'entre elles ferment le fret EN DISANT qu'il est la solution -----------
 *
 * 28 règles ne ferment que la soute ; six ferment `hold` ET `cargo`. Or leur rationale — la même
 * phrase pour les 34 — se termine par « heavier dogs travel via cargo ». Ces six-là renvoient donc
 * le voyageur vers un canal qu'elles viennent de fermer. Pour elles, un seuil faux ne déplace pas
 * le chien vers le fret : il lui ferme la dernière porte. */
const ferment_le_fret = LES_34.filter((r) =>
  (r.effect.placement ?? []).includes("cargo"))
  .map((r) => ({ id: r.id, compagnie: r.scope.id, seuil_kg: r.params?.max_weight_kg ?? null,
    rationale_renvoie_au_fret: /travel via cargo/i.test(r.rationale ?? "") }));
exiger("les règles fermant le fret le font toutes en renvoyant au fret — contradiction interne",
  ferment_le_fret.every((f) => f.rationale_renvoie_au_fret),
  JSON.stringify(ferment_le_fret.filter((f) => !f.rationale_renvoie_au_fret)));
exiger("le partage entre les deux formes est stable : 28 soute seule, 6 soute + fret",
  LES_34.length - ferment_le_fret.length === 28 && ferment_le_fret.length === 6,
  `${LES_34.length - ferment_le_fret.length} / ${ferment_le_fret.length}`);

/* ---- L'ÉCART CENTRAL : ce que la règle DIT vs ce qu'elle MESURE ---------------------------------
 *
 * Chaque rationale décrit une limite qui porte sur le chien ET SA CAISSE. Chaque condition, elle,
 * ne peut interroger que `dog.weight_kg` — le seul fait de poids que le moteur injecte. Le
 * référentiel ne contient AUCUN poids de caisse : ni `objects.json`, ni le registre des faits.
 * L'écart entre les deux vaut donc exactement le poids de la caisse, une quantité que le site ne
 * détient pas. */
const seuilDe = (r) => r.params?.max_weight_kg ?? null;
const conditionDe = (r) => {
  const c = JSON.stringify(r.applies_when).match(/"fact":"dog\.weight_kg","op":"([a-z]+)","value":([0-9.]+)/);
  return c ? { fait: "dog.weight_kg", op: c[1], valeur: Number(c[2]) } : null;
};
const DIT_CAISSE = /combined dog \+ crate/i;
const ecart = LES_34.map((r) => ({
  id: r.id, compagnie: r.scope.id, seuil_kg: seuilDe(r), condition: conditionDe(r),
  rationale: r.rationale,
  la_source_dit_chien_plus_caisse: DIT_CAISSE.test(r.rationale ?? ""),
  la_condition_mesure_le_chien_seul: conditionDe(r)?.fait === "dog.weight_kg",
}));
exiger("les 34 rationales décrivent une limite CHIEN + CAISSE",
  ecart.every((e) => e.la_source_dit_chien_plus_caisse),
  String(ecart.filter((e) => !e.la_source_dit_chien_plus_caisse).length));
exiger("les 34 conditions ne mesurent QUE le chien — le seul fait de poids du moteur",
  ecart.every((e) => e.la_condition_mesure_le_chien_seul && e.condition.op === "gt"));
exiger("le seuil de la condition est celui des `params`, sans écart interne",
  ecart.every((e) => e.condition.valeur === e.seuil_kg));
/* Aucun poids de caisse nulle part : le vérifier plutôt que l'affirmer. */
const FAITS_DE_POIDS = ["dog.weight_kg"];
exiger("le référentiel ne contient AUCUN poids de caisse ni poids total",
  !("equipment" in brut.objets) && !JSON.stringify(brut.objets).includes("crate_weight"));

/* ---- LA FICHE dit-elle quelque chose du même fait ? --------------------------------------------- */
const fiche = LES_34.map((r) => {
  const pol = kb.airlines.get(r.scope.id)?.premium?.policy?.hold;
  return { compagnie: r.scope.id, seuil_regle: seuilDe(r),
    seuil_fiche: pol?.max_weight_kg ?? null, statut_fiche: pol?.status ?? null,
    source_fiche: pol?.source?.url ?? null };
});
const ficheMuette = fiche.filter((f) => f.seuil_fiche === null);
exiger("aucune fiche ne porte de seuil de soute : la règle est SEULE à le tenir",
  ficheMuette.length === 34, `${34 - ficheMuette.length} fiche(s) en portent un`);

/* ---- L'EFFET, LU DANS LE MOTEUR ------------------------------------------------------------------
   Un témoin par compagnie : son premier trajet direct, un chien juste AU-DESSUS du seuil, puis
   juste EN DESSOUS. On ne déduit rien de la forme de la règle — on lit `fired` et les statuts. */
const AN = new Date().getUTCFullYear() + 1;
const requete = (route, poids) => {
  const [o, d] = route.split("|");
  return { origin: o, destination: d, dog: { breed_id: "breed_labrador_retriever", weight_kg: poids },
    travel_type: "pet", placement: "hold", date: `${AN}-01-15`, locale: "en" };
};
const sansLaRegle = (id) => ({ ...kb, rules: kb.rules.filter((r) => r.id !== id) });
const statutSoute = (dec, cie) => dec.airlines.find((a) => a.airline_id === cie)
  ?.placements.find((p) => p.placement === "hold")?.status ?? null;

const effets = [];
for (const r of LES_34) {
  const cie = kb.airlines.get(r.scope.id);
  const route = [...(cie?.direct_routes ?? [])].sort()[0];
  if (!route) { effets.push({ id: r.id, compagnie: r.scope.id, temoin: null }); continue; }
  const seuil = seuilDe(r);
  /* `temoin` : on pèse le chien SOUS le seuil tout en prétendant tester le dessus. */
  const au_dessus = evaluate(kb, requete(route, CONTRE === "temoin" ? Math.max(1, seuil - 1) : seuil + 1));
  const en_dessous = evaluate(kb, requete(route, Math.max(1, seuil - 1)));
  const carte = au_dessus.airlines.find((a) => a.airline_id === r.scope.id);
  const sansElle = evaluate(sansLaRegle(r.id), requete(route, seuil + 1));
  const avant = statutSoute(au_dessus, r.scope.id), apres = statutSoute(sansElle, r.scope.id);
  effets.push({
    id: r.id, compagnie: r.scope.id, route, seuil_kg: seuil,
    temoin: { au_dessus_kg: seuil + 1, en_dessous_kg: Math.max(1, seuil - 1) },
    fired: (carte?.fired ?? []).some((f) => f.rule_id === r.id),
    soute_au_dessus: avant,
    soute_en_dessous: statutSoute(en_dessous, r.scope.id),
    soute_sans_la_regle: apres,
    dominante: avant === "denied" && apres !== "denied",
    score_avec: explain(au_dessus, "en").score,
    score_sans: explain(sansElle, "en").score,
  });
}
const avecTemoin = effets.filter((e) => e.temoin);
exiger("les 34 compagnies ont un témoin constructible",
  avecTemoin.length === 34, `${avecTemoin.length} / 34`);
exiger("les 34 règles MORDENT sur leur témoin — lu dans `fired`, jamais déduit",
  avecTemoin.every((e) => e.fired), avecTemoin.filter((e) => !e.fired).map((e) => e.id).join(", "));
exiger("les 34 sont DOMINANTES : leur retrait déplace le statut de la soute",
  avecTemoin.every((e) => e.dominante), avecTemoin.filter((e) => !e.dominante).map((e) => e.id).join(", "));
exiger("sous le seuil, la soute n'est jamais refusée par elles",
  avecTemoin.every((e) => e.soute_en_dessous !== "denied"),
  avecTemoin.filter((e) => e.soute_en_dessous === "denied").map((e) => e.id).join(", "));

/* CE QUE LE RETRAIT DÉCOUVRIRAIT : la fiche étant muette, que devient la soute ? */
const cibles = {};
for (const e of avecTemoin) cibles[e.soute_sans_la_regle] = (cibles[e.soute_sans_la_regle] ?? 0) + 1;

/* ---- LA GRILLE PUBLIQUE ------------------------------------------------------------------------- */
const ROUTES = [
  ["airport_cdg", "airport_bkk"], ["airport_cdg", "airport_jfk"], ["airport_cdg", "airport_dxb"],
  ["airport_lhr", "airport_mia"], ["airport_fra", "airport_sin"], ["airport_mad", "airport_mex"],
  ["airport_cdg", "airport_lhr"], ["airport_jfk", "airport_cdg"], ["airport_mxp", "airport_jfk"],
];
const sansLes34 = { ...kb, rules: kb.rules.filter((r) => !LES_34.some((x) => x.id === r.id)) };
const publique = { scenarios: 0, cartes_touchees: 0, placements: 0, cibles: {} };
for (const [o, d] of ROUTES) {
  for (const poids of [10, 30, 40]) {
    for (const m of ["01", "07"]) {
      const req = { origin: o, destination: d, dog: { breed_id: "breed_labrador_retriever", weight_kg: poids },
        travel_type: "pet", placement: "hold", date: `${AN}-${m}-15`, locale: "en" };
      publique.scenarios++;
      const a = evaluate(kb, req), b = evaluate(sansLes34, req);
      const ma = new Map(a.airlines.map((x) => [x.airline_id, x]));
      for (const cb of b.airlines) {
        const ca = ma.get(cb.airline_id);
        if (!ca) continue;
        const sa = statutSoute(a, cb.airline_id), sb = statutSoute(b, cb.airline_id);
        if (sa !== sb) {
          publique.cartes_touchees++; publique.placements++;
          publique.cibles[`${sa} → ${sb}`] = (publique.cibles[`${sa} → ${sb}`] ?? 0) + 1;
        }
      }
    }
  }
}

const artefact = {
  lot: "T0-B3-c — les 34 seuils de soute auto-cités",
  nature: "mesure seule : aucune règle retirée, aucun seuil déplacé, aucun fichier de packages/ écrit",
  sceau: {
    measurement_base_sha: MESURE_BASE_SHA,
    raw_rules_sha256: sha256(readFileSync(RAW.regles)),
    raw_objects_sha256: sha256(readFileSync(RAW.objets)),
    moteur_sha256: sha256(SOURCES_MOTEUR.map((c) => `${c}:${sha256(readFileSync(c))}`).join("\n")),
  },
  perimetre: {
    seuils_de_soute_au_total: TOUS_SEUILS.length,
    auto_cites: LES_34.length,
    non_auto_cites: TOUS_SEUILS.length - LES_34.length,
    compagnies: [...new Set(LES_34.map((r) => r.scope.id))].sort(),
  },
  ecart_central: {
    question: "ce que la règle DIT vs ce qu'elle MESURE",
    rationales_decrivant_chien_plus_caisse: ecart.filter((e) => e.la_source_dit_chien_plus_caisse).length,
    conditions_mesurant_le_chien_seul: ecart.filter((e) => e.la_condition_mesure_le_chien_seul).length,
    faits_de_poids_disponibles_dans_le_moteur: FAITS_DE_POIDS,
    poids_de_caisse_dans_le_referentiel: null,
    sens_de_l_ecart: "PERMISSIF : la limite citée couvre le chien ET sa caisse ; la condition ne "
      + "pèse que le chien. Le site ouvre donc la soute à des chiens que la limite citée exclut, "
      + "d'une marge égale au poids de la caisse — quantité que le référentiel ne détient pas.",
    detail: ecart,
  },
  second_ecart: {
    question: "six règles ferment le fret en disant que le fret est la solution",
    ferment_soute_seule: LES_34.length - ferment_le_fret.length,
    ferment_soute_et_fret: ferment_le_fret.length,
    lecture: "La rationale est la même pour les 34 : « heavier dogs travel via cargo ». Pour ces "
      + "six-là, un seuil faux ne déplace pas le chien vers le fret — il lui ferme la dernière "
      + "porte, et le texte affiché lui conseille pourtant d'y aller.",
    detail: ferment_le_fret,
  },
  la_fiche: {
    fiches_sans_seuil_de_soute: ficheMuette.length,
    lecture: "La règle est SEULE à porter le seuil : aucune fiche n'en publie. Son retrait ne "
      + "révélerait donc aucune limite de repli.",
    detail: fiche,
  },
  effet_mesure: {
    temoins_constructibles: avecTemoin.length,
    mordent_sur_leur_temoin: avecTemoin.filter((e) => e.fired).length,
    dominantes: avecTemoin.filter((e) => e.dominante).length,
    statut_de_la_soute_apres_retrait: cibles,
    ecart_de_score: avecTemoin.filter((e) => e.score_avec !== e.score_sans).length,
    detail: effets,
  },
  grille_publique: publique,
  exigences_tenues: echecs === 0,
};
if (!CONTRE) writeFileSync(`${DOSSIER}/seuils-de-soute.json`, JSON.stringify(artefact, null, 1) + "\n");

process.stdout.write(`
  périmètre    : ${TOUS_SEUILS.length} seuils de soute, dont ${LES_34.length} auto-cités (${TOUS_SEUILS.length - LES_34.length} citent un tiers)
  second écart : ${ferment_le_fret.length}/34 ferment AUSSI le fret, en renvoyant au fret dans leur texte
  écart central: ${artefact.ecart_central.rationales_decrivant_chien_plus_caisse}/34 rationales disent « chien + caisse », ${artefact.ecart_central.conditions_mesurant_le_chien_seul}/34 conditions pèsent le chien SEUL
  la fiche     : ${ficheMuette.length}/34 sans seuil de soute — la règle est seule à le tenir
  effet        : ${avecTemoin.filter((e) => e.fired).length}/34 mordent · ${avecTemoin.filter((e) => e.dominante).length}/34 dominantes · ${avecTemoin.filter((e) => e.score_avec !== e.score_sans).length} déplacent le score
  après retrait: ${JSON.stringify(cibles)}
  publique     : ${publique.scenarios} scénarios · ${publique.placements} soutes déplacées · ${JSON.stringify(publique.cibles)}
`);
/* Le référentiel doit être INTACT à la sortie : une mesure qui écrit dans ce qu'elle mesure ne
   mesure plus rien. */
for (const chemin of Object.values(RAW)) {
  if (sha256(readFileSync(chemin)) !== sha256(auCommit(chemin))) {
    process.stderr.write(`[t0b3c] ÉCHEC — ${chemin} a été MODIFIÉ pendant la mesure.\n`);
    process.exit(1);
  }
}
process.stdout.write(echecs === 0
  ? "[t0b3c] toutes les exigences sont tenues.\n"
  : `[t0b3c] ÉCHEC — ${echecs} exigence(s) non tenue(s)\n`);
process.exit(echecs === 0 ? 0 : 1);
