/**
 * LES MONTANTS DANS LES SOURCES : CE QUI EST RENDU EST INTERDIT, CE QUI DORT EST COMPTÉ.
 *
 *   node test-montants-sources.mjs            (contrôle)
 *   node test-montants-sources.mjs --figer    (réécrit le registre après un mouvement nommé)
 *
 * DEUX RÈGLES, ET LA SECONDE N'EST PAS UNE PERMISSION.
 *
 * 1. AUCUN MONTANT NULLE PART, SAUF DANS LES CHAMPS EXPLICITEMENT DÉCLARÉS NON RENDUS. La règle
 *    est écrite dans ce sens-là, et pas dans l'autre, DÉLIBÉRÉMENT : une liste des champs rendus
 *    laisserait passer tout champ oublié ou ajouté plus tard — et les fiches en portent une
 *    soixantaine. En interdisant par défaut, un nouveau champ arrive INTERDIT : il faudra le
 *    classer pour qu'il porte un montant, ce qui est exactement le geste qu'on veut forcer.
 *
 * 2. LES CHAMPS NON RENDUS gardent leurs montants — `channels[].fee`, `fareList`, `fareGrid` — et
 *    ce sont eux, la dette. Le gabarit `AirlinePremiumPage.astro` a cessé de les rendre au
 *    micro-lot Tarifs ; les données, elles, n'ont pas été nettoyées, et l'arbitrage du 31/08/2026
 *    borne explicitement la correction de lancement au RENDU PUBLIC. Ce registre les compte pour
 *    qu'elles ne se perdent pas, une occurrence par occurrence de source, JAMAIS multipliée par le
 *    nombre d'exemplaires HTML : ce sont deux mesures différentes et les mélanger a déjà produit
 *    un chiffre faux dans ce lot (« 1 336 », soustraction de rendus à des sources, retirée).
 *
 * CE CONTRÔLE NE PROUVE PAS QUE LA CLASSE 2 EST INERTE. C'est une classification déclarée, pas une
 * mesure. Ce qui la vérifie vit ailleurs et lit le HTML servi : `test-montants-publies.mjs`. Si un
 * jour le gabarit se remettait à rendre `fee`, ce fichier-ci resterait vert et l'autre rougirait —
 * c'est voulu, et c'est le seul ordre honnête entre une déclaration et une mesure.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { parse } from "yaml";
import { compter, trouver } from "./test-lib/montants.mjs";

const DIR = "content/airlines";
const REGISTRE = "dette-montants-sources.json";
const FIGER = process.argv.includes("--figer");

let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

/* LES SEULS CHAMPS AUTORISÉS À PORTER UN MONTANT — ceux que le gabarit ne rend plus depuis le
 * micro-lot Tarifs. Le nom est celui du CHAMP, jamais celui d'une compagnie ni d'une phrase : la
 * règle vaut donc telle quelle pour les fiches qui n'existent pas encore. Retirer une entrée d'ici
 * resserre le contrat ; en ajouter une est un mouvement à nommer et à faire contre-relire. */
const CHAMPS_DORMANTS = new Set([
  "channels.fee",                                        // le tarif du canal, retiré du gabarit
  "fareList.note", "fareList.rows.label", "fareList.rows.value",   // le tableau « Tarifs », non rendu
  "fareGrid.note", "fareGrid.headCabin", "fareGrid.headHold",      // la grille par zone, non rendue
  "fareGrid.rows.zone", "fareGrid.rows.cabin", "fareGrid.rows.hold",
]);

function* feuilles(noeud, chemin = []) {
  if (typeof noeud === "string") { yield [chemin, noeud]; return; }
  if (Array.isArray(noeud)) { for (const [i, v] of noeud.entries()) yield* feuilles(v, [...chemin, i]); return; }
  if (noeud && typeof noeud === "object") { for (const [k, v] of Object.entries(noeud)) yield* feuilles(v, [...chemin, k]); }
}
const LANGUES = new Set(["en", "fr", "es", "pt"]);
const champDe = (c) => c.filter((p) => typeof p !== "number" && !LANGUES.has(p)).join(".");

/* LE SQUELETTE EST LU COMME LES AUTRES. Ce n'est pas une fiche publiée, mais c'est le point de
 * départ de toutes celles à venir : un montant d'exemple qui y dormirait serait recopié. */
const fichiers = readdirSync(DIR).filter((f) => f.endsWith(".yml")).sort();
const fautes = [];
const dormantes = {};
let totalSources = 0;

for (const f of fichiers) {
  const doc = parse(readFileSync(`${DIR}/${f}`, "utf8"));
  for (const [chemin, texte] of feuilles(doc)) {
    const n = compter(texte);
    if (!n) continue;
    totalSources += n;
    const champ = champDe(chemin);
    if (CHAMPS_DORMANTS.has(champ)) {
      dormantes[f] ??= {};
      dormantes[f][champ] = (dormantes[f][champ] ?? 0) + n;
    } else {
      fautes.push(`${f} → ${chemin.join(".")} : ${trouver(texte).map((m) => m.texte).join(", ")}`);
    }
  }
}

const totalDormantes = Object.values(dormantes).reduce((s, o) => s + Object.values(o).reduce((a, b) => a + b, 0), 0);

/* ---- 1. AUCUN MONTANT DANS UN CHAMP RENDU -------------------------------------------------- */
if (fautes.length) {
  echec("1 aucun montant hors des champs dormants",
    `${fautes.length} occurrence(s) dans un champ non classé — donc publiable`);
  for (const l of fautes.slice(0, 30)) console.error(`      ${l}`);
  if (fautes.length > 30) console.error(`      … et ${fautes.length - 30} autres`);
} else ok(`1 aucun montant hors des champs dormants — ${fichiers.length} fiches, ${CHAMPS_DORMANTS.size} champs classés`);

/* ---- 2. LA DETTE DORMANTE EST CELLE QUI EST DÉCLARÉE ---------------------------------------- */
const mesure = { fiches: Object.keys(dormantes).length, occurrences: totalDormantes, occurrences_sources_totales: totalSources };
if (FIGER) {
  writeFileSync(REGISTRE, JSON.stringify({
    _lot: "Tarifs — prélancement",
    _regle: "Occurrences de montants restant dans les champs NON rendus des fiches compagnies. "
      + "Une occurrence de source = une occurrence, jamais multipliée par ses exemplaires HTML.",
    _mesure: mesure,
    fiches: Object.fromEntries(Object.entries(dormantes).sort(([a], [b]) => a.localeCompare(b))),
  }, null, 2) + "\n");
  console.log(`  · registre figé : ${mesure.fiches} fiches, ${mesure.occurrences} occurrences dormantes`);
} else {
  let reg;
  try { reg = JSON.parse(readFileSync(REGISTRE, "utf8")); }
  catch { echec("2 dette dormante", `${REGISTRE} illisible ou absent`); reg = null; }
  if (reg) {
    const ecarts = [];
    for (const [k, v] of Object.entries(mesure)) if (reg._mesure?.[k] !== v) ecarts.push(`_mesure.${k} = ${reg._mesure?.[k]} contre ${v} mesurées`);
    const declarees = reg.fiches ?? {};
    for (const f of new Set([...Object.keys(dormantes), ...Object.keys(declarees)])) {
      const a = JSON.stringify(dormantes[f] ?? null), b = JSON.stringify(declarees[f] ?? null);
      if (a !== b) ecarts.push(`${f} : mesuré ${a}, déclaré ${b}`);
    }
    if (ecarts.length) {
      echec("2 dette dormante", `${ecarts.length} écart(s) entre le registre et les fiches`);
      for (const l of ecarts.slice(0, 20)) console.error(`      ${l}`);
      if (ecarts.length > 20) console.error(`      … et ${ecarts.length - 20} autres`);
      console.error("      Si le mouvement est voulu et nommé : node test-montants-sources.mjs --figer");
    } else ok(`2 dette dormante — ${mesure.occurrences} occurrences sur ${mesure.fiches} fiches, exactement celles déclarées`);
  }
}

/* ---- 3. LE REGISTRE NE DIT PAS PLUS QUE CE QU'IL MESURE -------------------------------------- */
/* `occurrences` est la somme des champs déclarés, et `occurrences_sources_totales` compte AUSSI
 * les champs rendus. Après correction les seconds valent zéro, donc les deux nombres coïncident —
 * mais ils ne sont pas le même nombre, et le registre les tient séparés pour que le jour où un
 * montant reparaît dans un champ rendu, l'écart le dise au lieu de le fondre dans un total. */
if (mesure.occurrences + fautes.length !== mesure.occurrences_sources_totales)
  echec("3 comptabilité", `${mesure.occurrences} dormantes + ${fautes.length} hors classement ≠ ${mesure.occurrences_sources_totales} sources`);
else ok(`3 comptabilité — ${mesure.occurrences_sources_totales} occurrences sources = ${mesure.occurrences} dormantes + ${fautes.length} hors classement`);

console.log(defauts === 0
  ? `\n[montants-sources] ${fichiers.length} fiches, aucun montant hors des champs dormants, ${mesure.occurrences} occurrences déclarées.`
  : `\n[montants-sources] ${defauts} défaut(s).`);
process.exit(defauts === 0 ? 0 : 1);
