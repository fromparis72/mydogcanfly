#!/usr/bin/env node
/**
 * T0-B3-b — LA MESURE RÉELLE du changement de référentiel.
 *
 * Ce dossier ne simule rien. Il compare deux états du RÉFÉRENTIEL sur le MÊME moteur :
 *   · AVANT — les fichiers bruts lus au commit figé `MESURE_BASE_SHA`, par `git show` ;
 *   · APRÈS — les fichiers bruts de l'arbre de travail.
 *
 * C'est l'inverse de T0-B3-a, qui simulait des options sur un référentiel intact. Ici le
 * référentiel a réellement changé, le moteur ne bouge pas, et l'écart mesuré est celui que le
 * visiteur verra. Aucun chiffre n'est repris de la simulation : ils sont recalculés, puis
 * CONFRONTÉS à ceux que la contre-revue a validés — un écart est un échec, pas une nuance.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { normalize } from "../../../packages/knowledge/src/index.ts";
import { evaluate } from "../../../packages/engine/src/evaluate.ts";
import { explain } from "../../../packages/engine/src/explain.ts";

/** Le commit qui précède le changement de référentiel — l'état « avant », jamais réécrit à la main. */
export const MESURE_BASE_SHA = "dadecc29bd377fc6fa598ae234988cdb1ff0a8c1";

const DOSSIER = "mesures/t0b3b-referentiel-brachy";
const RAW = {
  objets: "packages/knowledge/raw/objects.json",
  regles: "packages/knowledge/raw/rules.json",
  race: "packages/knowledge/raw/breed-restrictions.json",
};
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const auCommit = (chemin) => execFileSync("git", ["show", `${MESURE_BASE_SHA}:${chemin}`],
  { maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });

/* ---- Les deux états ------------------------------------------------------------------------- */
const litAvant = (chemin) => { try { return JSON.parse(auCommit(chemin).toString("utf8")); } catch { return []; } };
const litApres = (chemin) => JSON.parse(readFileSync(chemin, "utf8"));

/* CONTRE-ÉPREUVE : on fait croire à la mesure que le référentiel n'a pas bougé. Ses exigences
   doivent alors TOUTES tomber — une mesure incapable d'échouer ne mesure rien. */
const CONTRE = (process.argv.find((a) => a.startsWith("--contre-epreuve=")) ?? "").split("=")[1] ?? "";
const kbAvant = CONTRE === "sans-changement"
  ? normalize({ ...litApres(RAW.objets), rules: litApres(RAW.regles), breed_restrictions: litApres(RAW.race) })
  : normalize({ ...litAvant(RAW.objets), rules: litAvant(RAW.regles), breed_restrictions: litAvant(RAW.race) });
const kbApres = normalize({ ...litApres(RAW.objets), rules: litApres(RAW.regles), breed_restrictions: litApres(RAW.race) });

let echecs = 0;
const exiger = (label, cond, detail = "") => {
  if (!cond) { echecs++; process.stdout.write(`    ✗ ${label}${detail ? ` — ${detail}` : ""}\n`); }
  return cond;
};

/* Les OBJETS n'ont pas bougé : ce lot ne touche qu'aux règles et au registre de race. */
exiger("les fiches (objects.json) sont inchangées",
  sha256(auCommit(RAW.objets)) === sha256(readFileSync(RAW.objets)));

const idsAvant = new Set(kbAvant.rules.map((r) => r.id));
const idsApres = new Set(kbApres.rules.map((r) => r.id));
const retirees = [...idsAvant].filter((i) => !idsApres.has(i)).sort();
const ajoutees = [...idsApres].filter((i) => !idsAvant.has(i)).sort();
exiger("exactement 42 règles retirées", retirees.length === 42, String(retirees.length));
exiger("aucune règle ajoutée ni modifiée", ajoutees.length === 0, ajoutees.join(", "));
exiger("les 42 étaient toutes `breed_ban` et toutes `deny hold+cargo`",
  retirees.every((i) => {
    const r = kbAvant.rules.find((x) => x.id === i);
    return r.category === "breed_ban" && r.effect.action === "deny"
      && JSON.stringify(r.effect.placement) === JSON.stringify(["hold", "cargo"]);
  }));
exiger("le registre de race passe de 0 à 1 entrée",
  kbAvant.breedRestrictions.length === 0 && kbApres.breedRestrictions.length === 1);
exiger("l'entrée ajoutée est un AVIS (`warn`), jamais un refus",
  kbApres.breedRestrictions[0]?.action === "warn", kbApres.breedRestrictions[0]?.action);

/* ---- Les grilles ------------------------------------------------------------------------------
   Identiques à celles de l'arbitrage T0-B3-a, pour que les chiffres soient confrontables. */
const ROUTES = [
  ["airport_cdg", "airport_bkk"], ["airport_cdg", "airport_jfk"], ["airport_cdg", "airport_dxb"],
  ["airport_lhr", "airport_mia"], ["airport_fra", "airport_sin"], ["airport_mad", "airport_mex"],
  ["airport_cdg", "airport_lhr"], ["airport_jfk", "airport_cdg"], ["airport_mxp", "airport_jfk"],
];
const AN = new Date().getUTCFullYear() + 1;
const publique = [];
for (const [o, d] of ROUTES)
  for (const [nom, breed] of [["golden", "breed_golden_retriever"], ["pug", "breed_pug"]])
    for (const m of ["01", "07"])
      for (const pl of ["any", "hold"])
        publique.push({ cle: `${o.slice(8)}-${d.slice(8)}|${nom}|${m}-15|${pl}`, chien: nom,
          req: { origin: o, destination: d, dog: { breed_id: breed, weight_kg: 8 },
            placement: pl, date: `${AN}-${m}-15`, locale: "en", travel_type: "pet" } });

const toutes = [...kbApres.airlines.keys()].sort();
const grille = (breed_id, extra = {}) => toutes.flatMap((id) => {
  const route = [...(kbApres.airlines.get(id)?.direct_routes ?? [])].sort()[0];
  if (!route) return [];
  const [o, d] = route.split("|");
  return [{ cle: id, airline_id: id, req: { origin: o, destination: d, placement: "hold",
    date: `${AN}-01-15`, locale: "en", travel_type: "pet", dog: { breed_id, weight_kg: 8, ...extra } } }];
});
const grilleBrachy = grille("breed_pug", { brachycephalic: true });
const grilleTemoin = grille("breed_golden_retriever");

const rapport = (kb, req) => explain(evaluate(kb, req), "en");
const PL = ["cabin_status", "hold_status", "cargo_status"];
const carteDe = (r, id) => (r?.airlines ?? []).find((x) => x.airline_id === id) ?? null;

/* ---- Le diff public ---------------------------------------------------------------------------- */
const diff = { scenarios: publique.length, verdicts: 0, cartes: 0, placements: 0,
  ecart_score: [0, 0], golden_affecte: 0, avis_emis: 0, scenarios_avec_avis: 0 };
const bascules = {};
for (const s of publique) {
  const a = rapport(kbAvant, s.req), b = rapport(kbApres, s.req);
  if (a.verdict !== b.verdict) diff.verdicts++;
  diff.ecart_score = [Math.min(diff.ecart_score[0], b.score - a.score), Math.max(diff.ecart_score[1], b.score - a.score)];
  diff.avis_emis += b.safety_advisories.length;
  if (b.safety_advisories.length) diff.scenarios_avec_avis++;
  const ma = new Map((a.airlines ?? []).map((x) => [x.airline_id, x]));
  for (const cb of b.airlines ?? []) {
    const ca = ma.get(cb.airline_id);
    if (!ca) continue;
    const n = PL.filter((p) => ca[p] !== cb[p]).length;
    if (n) {
      diff.cartes++; diff.placements += n;
      if (s.chien === "golden") diff.golden_affecte += n;
      for (const p of PL) if (ca[p] !== cb[p]) bascules[`${ca[p]} → ${cb[p]}`] = (bascules[`${ca[p]} → ${cb[p]}`] ?? 0) + 1;
    }
  }
}

/* ---- Le diff brachycéphale, compagnie par compagnie ---------------------------------------------- */
const mesurerGrille = (g) => {
  const res = { compagnies: 0, placements: 0, cibles: {}, depuis: {} };
  for (const s of g) {
    const a = carteDe(rapport(kbAvant, s.req), s.airline_id);
    const b = carteDe(rapport(kbApres, s.req), s.airline_id);
    const n = PL.filter((p) => (a?.[p] ?? null) !== (b?.[p] ?? null));
    if (!n.length) continue;
    res.compagnies++; res.placements += n.length;
    for (const p of n) {
      res.cibles[b[p]] = (res.cibles[b[p]] ?? 0) + 1;
      res.depuis[`${p.replace("_status", "")} ${a[p]} → ${b[p]}`] = (res.depuis[`${p.replace("_status", "")} ${a[p]} → ${b[p]}`] ?? 0) + 1;
    }
  }
  return res;
};
const brachy = mesurerGrille(grilleBrachy);
const temoin = mesurerGrille(grilleTemoin);

/* ---- LES SIX EXIGENCES, confrontées aux chiffres validés en contre-revue -------------------------- */
exiger("81 compagnies brachycéphales déplacées", brachy.compagnies === 81, String(brachy.compagnies));
exiger("147 placements brachycéphales déplacés", brachy.placements === 147, String(brachy.placements));
exiger("TOUS vers « à confirmer », aucun vers `allowed` ni `denied`",
  JSON.stringify(brachy.cibles) === JSON.stringify({ confirmation_required: 147 }), JSON.stringify(brachy.cibles));
exiger("AUCUN chien non brachycéphale touché", temoin.placements === 0, JSON.stringify(temoin));
exiger("aucun verdict public ne s'aggrave — le score ne baisse jamais",
  diff.ecart_score[0] >= 0, JSON.stringify(diff.ecart_score));
exiger("aucun golden retriever affecté sur la grille publique", diff.golden_affecte === 0, String(diff.golden_affecte));
/* L'avis IATA doit être RÉELLEMENT publié : le retrait sans l'avis serait une perte d'information. */
exiger("l'avis IATA est publié sur tous les scénarios brachycéphales de la grille publique",
  diff.scenarios_avec_avis === publique.filter((s) => s.chien === "pug").length,
  `${diff.scenarios_avec_avis} / ${publique.filter((s) => s.chien === "pug").length}`);

/* ---- L'INTERACTION CLIMAT × RACE, exigée par une sentinelle posée le 13/08/2026 ------------------
   `test-tristate-climat.mjs` annonçait : « quand P0-B requalifiera ces règles, des confirmations
   climatiques APPARAÎTRONT pour les brachycéphales — ce contrôle échouera alors, et c'est voulu ».
   Elle a échoué. La re-mesure qu'elle exigeait donne un résultat DIFFÉRENT de ce qu'elle
   anticipait, et c'est pour cela qu'elle devait être re-mesurée plutôt que retournée. */
const interaction = (() => {
  const reqIst = { origin: "airport_cdg", destination: "airport_ist",
    dog: { breed_id: "breed_pug", weight_kg: 8 }, date: `${AN}-07-15`, locale: "en", travel_type: "pet" };
  const compter = (kb) => {
    const dec = evaluate(kb, reqIst);
    const canaux = dec.airlines.flatMap((a) => a.placements);
    const conf = canaux.filter((p) => p.status === "confirmation_required");
    const parCause = {};
    for (const p of conf) for (const c of p.confirmation_causes ?? []) parCause[c.code] = (parCause[c.code] ?? 0) + 1;
    return { canaux: canaux.length, a_confirmer: conf.length, par_cause: parCause,
      climatiques: conf.filter((p) => (p.confirmation_causes ?? []).some((c) => c.code === "estimated_climate")).length };
  };
  return { route: "CDG→IST, carlin, juillet", avant: compter(kbAvant), apres: compter(kbApres) };
})();
exiger("aucune confirmation CLIMATIQUE n'apparaît pour un brachycéphale — ni avant, ni après",
  interaction.avant.climatiques === 0 && interaction.apres.climatiques === 0, JSON.stringify(interaction));
exiger("les confirmations qui apparaissent ont toutes pour cause la RACE",
  (interaction.apres.par_cause.estimated_climate ?? 0) === 0
    && (interaction.apres.par_cause.breed_policy_unreviewed ?? 0) > 0, JSON.stringify(interaction.apres.par_cause));

const artefact = {
  lot: "T0-B3-b — retrait des 42 règles brachycéphales et entrée de l'avis IATA",
  nature: "mesure RÉELLE du diff : deux états du référentiel, un seul et même moteur",
  sceau: {
    measurement_base_sha: MESURE_BASE_SHA,
    raw_objects_sha256: sha256(readFileSync(RAW.objets)),
    raw_rules_sha256_avant: sha256(auCommit(RAW.regles)),
    raw_rules_sha256_apres: sha256(readFileSync(RAW.regles)),
    raw_breed_restrictions_sha256_apres: sha256(readFileSync(RAW.race)),
  },
  referentiel: {
    regles_avant: kbAvant.rules.length, regles_apres: kbApres.rules.length,
    retirees: retirees.length, ajoutees: ajoutees.length, identites_retirees: retirees,
    registre_de_race_avant: kbAvant.breedRestrictions.map((r) => r.id),
    registre_de_race_apres: kbApres.breedRestrictions.map((r) => r.id),
    regles_brachycephales_conservees: kbApres.rules
      .filter((r) => r.category === "breed_ban" && /brachy/i.test(JSON.stringify(r.applies_when)))
      .map((r) => ({ id: r.id, compagnie: r.scope.id, source: r.source.url })),
  },
  diff_public: { ...diff, bascules },
  diff_brachycephale: brachy,
  temoin_non_brachycephale: temoin,
  interaction_climat_race: interaction,
  exigences_tenues: echecs === 0,
};
if (!process.argv.includes("--sans-ecrire")) {
  writeFileSync(`${DOSSIER}/diff-referentiel.json`, JSON.stringify(artefact, null, 1) + "\n");
}

process.stdout.write(`
  référentiel : ${kbAvant.rules.length} → ${kbApres.rules.length} règles (${retirees.length} retirées, ${ajoutees.length} ajoutées)
  registre    : ${kbAvant.breedRestrictions.length} → ${kbApres.breedRestrictions.length} entrée(s)
  publique    : ${diff.verdicts} verdict(s) · ${diff.cartes} carte(s) · ${diff.placements} placement(s) · score ${diff.ecart_score[0]}…+${diff.ecart_score[1]}
  bascules    : ${JSON.stringify(bascules)}
  brachy      : ${brachy.compagnies} compagnies, ${brachy.placements} placements → ${JSON.stringify(brachy.cibles)}
  témoin      : ${temoin.compagnies} compagnies, ${temoin.placements} placements
  avis IATA   : ${diff.avis_emis} émis sur ${diff.scenarios_avec_avis} scénario(s)
  conservées  : ${artefact.referentiel.regles_brachycephales_conservees.length} interdictions brachycéphales sourcées chez la compagnie
  climat×race : ${interaction.avant.a_confirmer} → ${interaction.apres.a_confirmer} confirmations, dont ${interaction.apres.climatiques} climatique(s)
`);
process.stdout.write(echecs === 0
  ? "[t0b3b] toutes les exigences sont tenues.\n"
  : `[t0b3b] ÉCHEC — ${echecs} exigence(s) non tenue(s)\n`);
process.exit(echecs === 0 ? 0 : 1);
