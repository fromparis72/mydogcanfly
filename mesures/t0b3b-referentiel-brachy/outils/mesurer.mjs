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
import { execFileSync, spawnSync } from "node:child_process";
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
/* LA LECTURE AU COMMIT DE BASE ÉCHOUE FERMÉ, et ce n'est pas une précaution de style.
 *
 * Elle échouait OUVERT jusqu'au 22/08/2026 : `litAvant` enveloppait cet appel dans un
 * `catch { return [] }`. Un commit de base illisible donnait donc un « avant » VIDE, et la mesure
 * comparait le référentiel entier à rien du tout — sans jamais dire qu'elle n'avait rien pu lire.
 * C'est mot pour mot le défaut que la contre-revue avait fait corriger dans `lib/provenance.mjs`
 * cinq jours plus tôt ; il vivait ici aussi, dans le dossier qui MESURE le référentiel.
 *
 * La CI l'a exposé sans le nommer : `actions/checkout` clone en profondeur 1, `git show <base>:…`
 * ne résout pas, l'« avant » devenait vide et le harnais mourait plus loin d'une exception. Le
 * runner de contre-épreuves a refusé cet échec — « sans le diagnostic attendu, mis en défaut pour
 * une autre raison » —, et il avait raison : c'est exactement ce qu'il existe pour attraper. */
const auCommit = (chemin) => {
  const r = spawnSync("git", ["show", `${MESURE_BASE_SHA}:${chemin}`],
    { maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) {
    process.stderr.write(`[t0b3b] ÉCHEC — impossible de lire ${chemin} au commit de base `
      + `${MESURE_BASE_SHA.slice(0, 7)} : ${(r.stderr ?? "").toString().trim() || "git muet"}.\n`
      + "  Un « avant » qu'on ne peut pas lire ne se remplace pas par un « avant » vide : la mesure\n"
      + "  comparerait le référentiel entier à rien. Si l'historique est superficiel (la CI clone en\n"
      + "  profondeur 1 par défaut), demander « fetch-depth: 0 ».\n");
    process.exit(1);
  }
  return r.stdout;
};

/* ---- Les deux états ------------------------------------------------------------------------- */
const litAvant = (chemin) => JSON.parse(auCommit(chemin).toString("utf8"));
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

/* ---- LES 42, PAR IDENTITÉ — pas par cardinalité ------------------------------------------------
 *
 * La v1 exigeait « 42 règles retirées, de forme `breed_ban / deny hold+cargo` ». Une cardinalité
 * n'est pas une identité : réintroduire Aegean et retirer Air Canada laissait la mesure verte, à 42
 * retraits, tout en publiant 540 cartes au lieu de 524 (contre-épreuve de la contre-revue).
 *
 * La liste vient de l'ARTEFACT SCELLÉ de T0-B3-a, celui que la contre-revue a validé — pas d'une
 * constante recopiée ici, qui n'aurait aucune provenance. Cet artefact est lui-même verrouillé par
 * `mesure:t0b3a` : empreinte SHA-256 et rejeu en worktree au commit d'origine. */
const ARBITRAGE = JSON.parse(readFileSync("mesures/t0b3a-arbitrage-brachy/arbitrage-p0-brachy.json", "utf8"));
const IDS_42 = [ARBITRAGE.familles["1_regle_globale_iata"].id,
  ...ARBITRAGE.familles["2_regles_propres_aux_compagnies"].liste].sort();
/* Toute entrée manquante dans l'artefact donnerait `undefined` ici, et `undefined` compte pour un
   élément : on exige donc des identifiants BIEN FORMÉS, pas seulement une cardinalité. */
exiger("la liste approuvée par T0-B3-a compte 42 identités distinctes et bien formées",
  IDS_42.length === 42 && new Set(IDS_42).size === 42
    && IDS_42.every((i) => typeof i === "string" && /^rule_[a-z0-9_]+$/.test(i)),
  JSON.stringify(IDS_42.filter((i) => typeof i !== "string" || !/^rule_[a-z0-9_]+$/.test(i))));

const idsAvant = new Set(kbAvant.rules.map((r) => r.id));
const idsApres = new Set(kbApres.rules.map((r) => r.id));
const retirees = [...idsAvant].filter((i) => !idsApres.has(i)).sort();
const ajoutees = [...idsApres].filter((i) => !idsAvant.has(i)).sort();
const memeEnsemble = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
exiger("les règles retirées sont EXACTEMENT les 42 approuvées — égalité d'ensembles, pas décompte",
  memeEnsemble(retirees, IDS_42),
  `en trop : ${retirees.filter((i) => !IDS_42.includes(i)).join(", ") || "—"} · manquantes : ${IDS_42.filter((i) => !retirees.includes(i)).join(", ") || "—"}`);
exiger("aucune règle ajoutée", ajoutees.length === 0, ajoutees.join(", "));

/* AUCUNE RÈGLE MODIFIÉE — sur le CONTENU, et dans l'ORDRE. La v1 ne regardait que les
   identifiants : changer `source.reviewer` d'une règle conservée passait inaperçu (contre-épreuve
   de la contre-revue). On confronte donc les tableaux BRUTS : l'après doit être, octet pour octet
   après resérialisation, l'avant privé des 42 — même contenu, même ordre. */
{
  const brutAvant = JSON.parse(auCommit(RAW.regles).toString("utf8"));
  const brutApres = JSON.parse(readFileSync(RAW.regles, "utf8"));
  const attendu = brutAvant.filter((r) => !IDS_42.includes(r.id));
  exiger("l'après est l'avant PRIVÉ des 42 : contenu et ordre, règle par règle",
    JSON.stringify(brutApres) === JSON.stringify(attendu),
    (() => {
      const n = Math.min(brutApres.length, attendu.length);
      for (let i = 0; i < n; i++) {
        if (JSON.stringify(brutApres[i]) !== JSON.stringify(attendu[i])) return `1er écart : ${attendu[i]?.id ?? "?"} (index ${i})`;
      }
      return `longueurs ${brutApres.length} ≠ ${attendu.length}`;
    })());
}

exiger("les 42 étaient toutes `breed_ban` et toutes `deny hold+cargo`",
  IDS_42.every((i) => {
    const r = kbAvant.rules.find((x) => x.id === i);
    return r && r.category === "breed_ban" && r.effect.action === "deny"
      && JSON.stringify(r.effect.placement) === JSON.stringify(["hold", "cargo"]);
  }));

/* LEURS SOURCES : 41 auto-citations et une seule page IATA. C'est le fait qui a fondé tout
   l'arbitrage — le vérifier ici empêche qu'un retrait futur se pare de la même justification. */
{
  const hote = (id) => new URL(kbAvant.rules.find((x) => x.id === id).source.url).hostname;
  const auto = IDS_42.filter((i) => /(^|\.)mydogcanfly\.com$/i.test(hote(i)));
  const iata = IDS_42.filter((i) => /(^|\.)iata\.org$/i.test(hote(i)));
  exiger("41 des 42 citaient mydogcanfly.com, et la 42e la page IATA — aucune autre provenance",
    auto.length === 41 && iata.length === 1 && auto.length + iata.length === 42,
    JSON.stringify({ auto: auto.length, iata: iata.length }));
  exiger("la seule citant l'IATA est bien la règle GLOBALE",
    iata[0] === "rule_global_brachy_hold", iata[0]);
}

/* LES SIX CONSERVÉES, par identité : ce lot ne retire QUE ce que nous affirmions sans preuve. */
const SIX_CONSERVEES = ["rule_ac_brachy_hold", "rule_af_brachy_hold", "rule_ba_brachy_hold",
  "rule_kl_brachy_hold", "rule_lh_brachy_hold", "rule_tk_brachy_hold"];
{
  const restantes = kbApres.rules
    .filter((r) => r.category === "breed_ban" && /brachy/i.test(JSON.stringify(r.applies_when)))
    .map((r) => r.id).sort();
  exiger("les interdictions brachycéphales conservées sont EXACTEMENT les six sourcées chez la compagnie",
    memeEnsemble(restantes, SIX_CONSERVEES), restantes.join(", "));
  exiger("aucune des six ne cite mydogcanfly.com — elles sont documentées chez la compagnie",
    SIX_CONSERVEES.every((i) => {
      const h = new URL(kbApres.rules.find((x) => x.id === i).source.url).hostname;
      return !/(^|\.)mydogcanfly\.com$/i.test(h);
    }));
}
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

/* ---- LES EXIGENCES, confrontées aux chiffres validés en contre-revue ------------------------------
   Verrouillés à leurs VALEURS, pas seulement à leur existence. La v1 publiait « 20 verdicts,
   524 cartes, 940 placements, score 0…+2 » sans jamais les exiger : une dérive du périmètre —
   Aegean réintroduite, Air Canada retirée, toujours 42 retraits — affichait 540 cartes et
   972 placements et sortait pourtant en code 0. */
exiger("grille publique : exactement 20 verdicts déplacés", diff.verdicts === 20, String(diff.verdicts));
exiger("grille publique : exactement 524 cartes modifiées", diff.cartes === 524, String(diff.cartes));
exiger("grille publique : exactement 940 placements déplacés", diff.placements === 940, String(diff.placements));
exiger("grille publique : le score ne bouge que de 0 à +2",
  JSON.stringify(diff.ecart_score) === JSON.stringify([0, 2]), JSON.stringify(diff.ecart_score));
/* UNE SEULE transition possible, et rien d'autre : `denied` → « à confirmer ». Un canal qui
   s'ouvrirait en `allowed` remplacerait une affirmation non prouvée par une autre. */
exiger("une seule transition sur toute la grille : 940 × `denied` → « à confirmer »",
  JSON.stringify(bascules) === JSON.stringify({ "denied → confirmation_required": 940 }),
  JSON.stringify(bascules));
exiger("81 compagnies brachycéphales déplacées", brachy.compagnies === 81, String(brachy.compagnies));
exiger("147 placements brachycéphales déplacés", brachy.placements === 147, String(brachy.placements));
exiger("TOUS vers « à confirmer », aucun vers `allowed` ni `denied`",
  JSON.stringify(brachy.cibles) === JSON.stringify({ confirmation_required: 147 }), JSON.stringify(brachy.cibles));
exiger("AUCUN chien non brachycéphale touché", temoin.placements === 0, JSON.stringify(temoin));
exiger("aucun verdict public ne s'aggrave — le score ne baisse jamais",
  diff.ecart_score[0] >= 0, JSON.stringify(diff.ecart_score));
exiger("aucun golden retriever affecté sur la grille publique", diff.golden_affecte === 0, String(diff.golden_affecte));
/* L'avis IATA doit être RÉELLEMENT publié : le retrait sans l'avis serait une perte d'information. */
exiger("l'avis IATA est publié sur les 36 scénarios brachycéphales, et un seul par rapport",
  diff.scenarios_avec_avis === 36 && diff.avis_emis === 36,
  JSON.stringify({ scenarios: diff.scenarios_avec_avis, avis: diff.avis_emis }));
/* Le grain COMPAGNIE de la grille brachycéphale, valeur par valeur lui aussi. */
exiger("les 147 placements viennent tous de `denied` — soute et fret, jamais la cabine",
  JSON.stringify(brachy.depuis) === JSON.stringify({
    "hold denied → confirmation_required": 70, "cargo denied → confirmation_required": 77,
  }), JSON.stringify(brachy.depuis));

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
