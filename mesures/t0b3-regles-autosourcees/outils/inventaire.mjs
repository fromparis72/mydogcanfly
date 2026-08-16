/**
 * T0-B3 · outil 1 — l'inventaire EXHAUSTIF et STABLE des règles auto-citées.
 *
 *   node --import tsx mesures/t0b3-regles-autosourcees/outils/inventaire.mjs
 *   → mesures/t0b3-regles-autosourcees/inventaire-171.json
 *
 * Ce que l'outil établit, et rien d'autre :
 *   · l'identité des règles dont la source cite mydogcanfly.com ;
 *   · pour chacune : effet décisionnel, conditions, source actuelle, entité portée ;
 *   · le décompte par catégorie, recomputé et non recopié.
 *
 * Le cardinal 171 n'est PAS un paramètre : il est mesuré, puis vérifié contre les cinq totaux par
 * catégorie. Sceller une dette par son cardinal est précisément ce qu'on s'interdit depuis T0-B2 —
 * un cardinal juste peut recouvrir un ensemble faux. Ce qui est scellé ici, ce sont les 171
 * IDENTITÉS, plus l'empreinte SHA-256 des deux fichiers du référentiel.
 */
import {
  chargerReferentiel, indexerEntites, estAutoCitee, conditionLisible,
  effetLisible, trierRegles, ecrireJson, hote, TYPES_OFFICIELS,
} from "./lib-regles.mjs";

const SORTIE = "mesures/t0b3-regles-autosourcees/inventaire-171.json";

const { sceau, regles, objets } = chargerReferentiel();
const entites = indexerEntites(objets);

const autoCitees = regles.filter(estAutoCitee).sort(trierRegles);

/* Le contexte large, mesuré une fois pour toutes : il évite de rejouer le décompte à chaque
   lecture du dossier, et il montre ce que les 171 représentent DANS l'ensemble. */
const parCategorie = {};
for (const r of autoCitees) parCategorie[r.category] = (parCategorie[r.category] ?? 0) + 1;

const typeAutre = regles.filter((r) => r.source.source_type === "other");
const tiersNonOfficiels = typeAutre.filter((r) => !estAutoCitee(r));

const inventaire = autoCitees.map((r) => {
  const e = entites.get(r.scope.id ?? "") ?? null;
  return {
    id: r.id,
    categorie: r.category,
    criticite: r.criticality,
    portee: { type: r.scope.type, id: r.scope.id ?? null, nom: e?.nom ?? null },
    effet: effetLisible(r.effect),
    effet_brut: r.effect,
    conditions: conditionLisible(r.applies_when),
    conditions_brutes: r.applies_when,
    params: r.params ?? {},
    source: {
      url: r.source.url,
      hote: hote(r.source.url),
      source_type: r.source.source_type,
      verified_date: r.source.verified_date,
      review_due: r.source.review_due,
      confidence: r.source.confidence,
      reviewer: r.source.reviewer,
    },
    rationale: r.rationale,
  };
});

/* ---- Contrôles internes : un inventaire qui ne se contredit pas n'est pas encore prouvé, mais
   un inventaire qui se contredit est immédiatement disqualifié. ---------------------------------- */
const anomalies = [];
const total = Object.values(parCategorie).reduce((s, n) => s + n, 0);
if (total !== autoCitees.length) anomalies.push(`somme des catégories ${total} ≠ ${autoCitees.length}`);
if (new Set(inventaire.map((x) => x.id)).size !== inventaire.length) anomalies.push("identifiants en double");
for (const r of autoCitees) {
  if (TYPES_OFFICIELS.has(r.source.source_type)) {
    anomalies.push(`${r.id} : auto-citée mais déclarée ${r.source.source_type}`);
  }
}
/* Une portée sans entité connue rendrait la règle inanalysable : on veut le savoir tout de suite. */
for (const x of inventaire) {
  if (x.portee.id && !x.portee.nom) anomalies.push(`${x.id} : entité ${x.portee.id} introuvable`);
}

const doc = {
  lot: "T0-B3 — mesure des règles auto-sourcées",
  nature: "MESURE — aucune correction, aucune suppression, aucun retrait appliqué",
  sceau,
  contexte: {
    regles_total: regles.length,
    auto_citees_total: autoCitees.length,
    auto_citees_par_categorie: parCategorie,
    auto_citees_par_portee: autoCitees.reduce((acc, r) => {
      acc[r.scope.type] = (acc[r.scope.type] ?? 0) + 1;
      return acc;
    }, {}),
    urls_auto_citees_distinctes: new Set(autoCitees.map((r) => r.source.url)).size,
    /* Observation ADJACENTE, hors périmètre de ce lot mais consignée pour ne pas la reperdre :
       13 règles supplémentaires portent `source_type: "other"` en citant un tiers réel
       (pettravel.com, IATA, anivetvoyage). Elles ne sont PAS auto-citées et ne font pas partie des
       171 — mais elles montrent que `source_type` ne peut pas servir de discriminant. */
    source_type_other_total: typeAutre.length,
    tiers_non_officiels_hors_perimetre: tiersNonOfficiels.map((r) => ({ id: r.id, hote: hote(r.source.url) })),
  },
  anomalies,
  regles: inventaire,
};

ecrireJson(SORTIE, doc);
console.log(`inventaire écrit : ${SORTIE}`);
console.log(`  ${autoCitees.length} règles auto-citées sur ${regles.length}`);
for (const [k, v] of Object.entries(parCategorie).sort()) console.log(`    ${k.padEnd(14)} ${v}`);
console.log(`  anomalies internes : ${anomalies.length}`);
if (anomalies.length) for (const a of anomalies.slice(0, 5)) console.log(`    · ${a}`);
