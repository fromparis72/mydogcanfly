/**
 * T0-B2 — faisabilité de l'OPTION C (arbitrage Codex) : un bloc `policies:` unique et non
 * éditorial par fiche, portant les 302 décisions ; chaque canal visible reçoit un `placement`
 * qui le RELIE à sa politique, sans jamais la décider.
 *
 * Cette sonde ne modifie rien : elle établit la carte exacte, canal par canal, et vérifie les
 * invariants que la structure devra faire respecter.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

const ROOT = process.argv[2];
const REGISTRE = process.argv[3];
const OUT = process.argv[4];
if (!ROOT || !REGISTRE || !OUT) {
  console.error("usage : faisabilite-option-c.mjs <racine> <registre-migration.json> <sortie.json>");
  process.exit(2);
}
const SRC = join(ROOT, "content", "airlines");
const registre = JSON.parse(readFileSync(REGISTRE, "utf8"));

/* Rattachement EXPLICITE des 4 canaux que `catOf` ne reconnaît pas. Ce sont les seuls cas où le
   placement ne peut pas être relu du nom — c'est précisément ce que l'option C supprime. Chacun
   est justifié par son libellé de statut, pas par une devinette sur le nom.
   La liste est SCELLÉE : chaque entrée doit être consommée exactement une fois, et aucun autre
   canal ne peut en réclamer une. Un rattachement inventé, déplacé ou devenu inutile échoue. */
const RATTACHEMENT_EXPLICITE = {
  "airline_french_bee|channels[2]":         "cargo",  // « Freight » / statut « Via freight »
  "airline_korean_air|channels[2]":         "cargo",  // « Specialized-LIVE » / statut « Via agent »
  "airline_malaysia_airlines|channels[2]":  "cargo",  // « MASkargo Animal Hotel » / statut « Via cargo »
  "airline_qantas|channels[1]":             "cargo",  // « Qantas Freight » / statut « Via freight »
};

/* Dette éditoriale SCELLÉE : les 6 politiques qui n'ont aucun canal visible. Comparée par
   IDENTITÉ, jamais par cardinal — à effectif constant, une dette résorbée et une autre créée
   s'annuleraient et le contrôle resterait vert sur un défaut tout neuf. */
const POLITIQUES_SANS_CANAL_ATTENDUES = [
  "airline_asiana.cargo", "airline_condor.cargo", "airline_eva_air.cargo",
  "airline_norwegian.cargo", "airline_qantas.hold", "airline_virgin_australia.hold",
];

const catOf = (name) => {
  const n = (name || "").toLowerCase();
  if (/cargo|fret/.test(n)) return "cargo";
  if (/hold|soute|checked/.test(n)) return "hold";
  if (/cabin|cabine/.test(n)) return "cabin";
  return null;
};

const cibleParCouple = new Map(registre.registre.map((r) => [r.key, r]));
const fiches = [];
let canaux = 0, parCatOf = 0, parRattachement = 0;
const doublons = [], canauxSansPolitique = [], nonRattaches = [];
/** Chaque entrée scellée doit être consommée exactement une fois. */
const rattachementsConsommes = new Map(Object.keys(RATTACHEMENT_EXPLICITE).map((k) => [k, 0]));

for (const f of readdirSync(SRC).filter((x) => x.endsWith(".yml")).sort()) {
  const fiche = YAML.parse(readFileSync(join(SRC, f), "utf8"));
  const vus = new Map();
  const placements = [];
  (fiche.channels || []).forEach((c, i) => {
    canaux++;
    const cle = `${fiche.id}|channels[${i}]`;
    const explicite = RATTACHEMENT_EXPLICITE[cle];
    const pl = explicite ?? catOf(c.name?.en);
    if (explicite) { parRattachement++; rattachementsConsommes.set(cle, rattachementsConsommes.get(cle) + 1); }
    else if (pl) parCatOf++;
    if (!pl) { nonRattaches.push(cle); return; }
    if (vus.has(pl)) doublons.push({ fiche: fiche.id, placement: pl, premier: vus.get(pl), second: `channels[${i}]` });
    else vus.set(pl, `channels[${i}]`);
    placements.push(pl);
    if (!cibleParCouple.has(`${fiche.id}.${pl}`)) canauxSansPolitique.push(`${fiche.id}.${pl}`);
  });
  // politiques de cette compagnie, d'après le registre
  const politiques = ["cabin", "hold", "cargo"].filter((m) => cibleParCouple.has(`${fiche.id}.${m}`));
  fiches.push({
    id: fiche.id, file: `content/airlines/${f}`,
    canaux: placements, politiques,
    politiques_sans_canal: politiques.filter((m) => !placements.includes(m)),
  });
}

const sansCanal = fiches.flatMap((x) => x.politiques_sans_canal.map((m) => `${x.id}.${m}`)).sort();
const totalPolitiques = fiches.reduce((n, x) => n + x.politiques.length, 0);

/* Comparaison par IDENTITÉ des deux ensembles scellés. */
const attenduTrie = [...POLITIQUES_SANS_CANAL_ATTENDUES].sort();
const detteInattendue = sansCanal.filter((k) => !attenduTrie.includes(k));
const detteDisparue = attenduTrie.filter((k) => !sansCanal.includes(k));
const rattachementsNonConsommes = [...rattachementsConsommes].filter(([, n]) => n !== 1)
  .map(([k, n]) => ({ entree: k, consommations: n }));

console.log("fiches                         :", fiches.length);
console.log("canaux visibles                :", canaux, `(catOf ${parCatOf} + rattachement explicite ${parRattachement})`);
console.log("canaux sans placement          :", nonRattaches.length, nonRattaches);
console.log("doublons de placement          :", doublons.length, doublons);
console.log("canaux sans politique cible    :", canauxSansPolitique.length, canauxSansPolitique);
console.log("politiques déclarées (bloc)    :", totalPolitiques, "(attendu 302)");
console.log("politiques SANS canal visible  :", sansCanal.length, "(attendu 6)");
sansCanal.forEach((k) => console.log("    ", k));

console.log("dette inattendue               :", detteInattendue.length, detteInattendue);
console.log("dette scellée disparue         :", detteDisparue.length, detteDisparue);
console.log("rattachements non consommés × 1:", rattachementsNonConsommes.length, rattachementsNonConsommes);

const invariants = {
  "chaque canal visible référence une politique": canauxSansPolitique.length === 0 && nonRattaches.length === 0,
  "aucun placement dupliqué dans une fiche": doublons.length === 0,
  "302 politiques déclarées": totalPolitiques === 302,
  "296 canaux visibles porteront un placement": canaux === 296,
  /* IDENTITÉ, et non cardinal : une dette résorbée compensée par une dette neuve doit échouer. */
  "les 6 politiques sans canal sont EXACTEMENT celles scellées": detteInattendue.length === 0 && detteDisparue.length === 0,
  "les 4 rattachements scellés sont consommés une fois chacun": rattachementsNonConsommes.length === 0,
};
console.log("\n=== INVARIANTS DE L'OPTION C ===");
for (const [k, v] of Object.entries(invariants)) console.log(`${v ? "OK   " : "ECHEC"}  ${k}`);

writeFileSync(OUT, JSON.stringify({
  option: "C — bloc `policies:` unique et non éditorial ; `placement` sur les canaux visibles (lien, jamais décision)",
  totaux: { fiches: fiches.length, canaux, par_catOf: parCatOf, par_rattachement_explicite: parRattachement, politiques: totalPolitiques },
  rattachement_explicite: RATTACHEMENT_EXPLICITE,
  politiques_sans_canal_visible_attendues: attenduTrie,
  politiques_sans_canal_visible_observees: sansCanal,
  dette_inattendue: detteInattendue,
  dette_scellee_disparue: detteDisparue,
  rattachements_non_consommes: rattachementsNonConsommes,
  invariants,
  fiches,
}, null, 1) + "\n");
if (Object.values(invariants).some((v) => !v)) {
  console.error("\nECHEC : au moins un invariant de l'option C n'est pas tenu.");
  process.exit(1);
}
console.log("\nOPTION C FAISABLE en l'état : aucun changement éditorial requis.");
