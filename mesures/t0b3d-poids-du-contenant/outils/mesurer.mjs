#!/usr/bin/env node
/**
 * T0-B3-d — LE POIDS DU CONTENANT : LE PÉRIMÈTRE RÉEL.
 *
 * Ce dossier ne corrige rien : aucune règle retirée, aucun seuil déplacé, aucun fichier de
 * `packages/` écrit. L'empreinte des fichiers bruts est relue à la fin.
 *
 * POURQUOI IL EXISTE. T0-B3-c a mesuré « 34 seuils de soute auto-cités » et conclu 34/34 sur un
 * écart réel : la règle annonce une limite qui couvre le chien ET sa caisse, sa condition ne pèse
 * que le chien. Le chiffre 34 était juste — mais il décrivait le périmètre que T0-B3-c s'était
 * donné, pas celui du DÉFAUT. Ce périmètre avait été tracé par UNE PHRASE, `combined dog + crate`.
 * Les règles de cabine disent « including the carrier » : la même faute, un autre mot, invisible à
 * la recherche. Un dossier qui cherche une phrase trouve une phrase.
 *
 * CE DOSSIER NE CHERCHE PLUS UNE PHRASE. Il part de TOUS les seuils de poids publiés — toute règle
 * portant un `params.max_weight_kg`, quelle que soit sa catégorie et quelle que soit sa source — et
 * exige que CHACUN soit classé : soit il annonce une limite incluant le contenant, soit il figure
 * nommément au résidu versionné. Aucun troisième état n'est toléré. Une formulation nouvelle ou
 * modifiée tombe donc dans le résidu, hors de la liste, et fait ÉCHOUER la mesure — au lieu de
 * disparaître en silence. C'est ce mécanisme, et non ma vigilance, qui a rattrapé
 * `rule_km_malta_hold_weight` (« the dog plus crate ») que mon premier lexique manquait encore.
 *
 * LES CONTRE-ÉPREUVES (chacune doit sortir en 1 avec SON diagnostic) :
 *   `lexique`     une entrée morte est ajoutée au lexique      → « aucune formulation morte » tombe
 *   `formulation` les textes n'annoncent plus le contenant     → l'exhaustivité et le compte tombent
 *   `temoin`      le témoin passe SOUS le seuil                → « mordent » et « dominantes » tombent
 *   `langue`      un texte FR cesse d'annoncer le contenant    → « les langues disent la même chose » tombe
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { exigerProvenance } from "../../../packages/knowledge/scripts/lib/provenance.mjs";
import { createHash } from "node:crypto";
import { normalize } from "../../../packages/knowledge/src/normalize.ts";
import { evaluate } from "../../../packages/engine/src/evaluate.ts";
import { explain } from "../../../packages/engine/src/explain.ts";

/** Base de mesure FIGÉE, jamais `HEAD`. */
export const MESURE_BASE_SHA = "eb3562c27cafb5a41ee19d2519580753a9a040f8";

const DOSSIER = "mesures/t0b3d-poids-du-contenant";
const RAW = {
  objets: "packages/knowledge/raw/objects.json",
  regles: "packages/knowledge/raw/rules.json",
  race: "packages/knowledge/raw/breed-restrictions.json",
};
const SOURCES_MOTEUR = ["packages/engine/src/evaluate.ts", "packages/engine/src/explain.ts",
  "packages/engine/src/contracts.ts", "packages/knowledge/src/normalize.ts"];
/* La page d'entité est ce qui PUBLIE la phrase : son empreinte fait partie du sceau au même titre
   que celle du moteur. Si elle cesse d'afficher `rationale`, ces chiffres ne valent plus. */
const SOURCES_PAGE = ["packages/ui/src/components/EntityPage.astro", "packages/ui/src/lib/pagedata.ts"];
const SITE = "packages/ui/dist";

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
    process.stderr.write(`[t0b3d] ÉCHEC — ${chemin} diffère de la base ${MESURE_BASE_SHA.slice(0, 7)}.\n`);
    process.exit(1);
  }
}
const brut = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, JSON.parse(readFileSync(v, "utf8"))]));

/* ---- LE LEXIQUE ---------------------------------------------------------------------------------
 * Les formulations qui annoncent que le CONTENANT est compris dans la limite. Anglais et français
 * séparément : les pages `es` et `pt` retombent sur l'anglais faute de traduction (mesuré plus bas),
 * et il faut pouvoir le dire.
 *
 * Chaque entrée doit attraper au moins une règle. Une entrée morte serait le début du retour au
 * défaut de T0-B3-c : un lexique qu'on ne relit plus, dont on ne sait plus ce qu'il couvre. */
const LEXIQUE = {
  en: [/combined dog \+ crate/i, /including the carrier/i, /dog plus crate/i],
  fr: [/caisse comprise/i, /sac compris/i, /ensemble chien \+ caisse/i, /le chien et sa caisse/i],
};
if (CONTRE === "lexique") LEXIQUE.en.push(/kennel weight allowance/i); // n'existe nulle part

/* LE RÉSIDU VERSIONNÉ — les seuils publiés qui n'annoncent PAS le contenant, nommés un par un.
 * Ce n'est pas une exception de confort : c'est la seule porte de sortie, et elle est étroite. Tout
 * seuil qui n'est ni classé « contenant » ni listé ici fait échouer la mesure. */
const RESIDU_CONNU = {
  rule_global_cabin_weight_cap:
    "Défaut de sécurité global, non rattaché à une compagnie. Son texte parle bien du CHIEN "
    + "(« dogs over about 10 kg are not accepted in the cabin ») ; la mention du sac souple qualifie "
    + "le canal, pas la limite. C'est le seul seuil publié dont l'annonce et la condition portent "
    + "sur la même quantité.",
};

/* ---- Le corpus : TOUS les seuils de poids publiés, sans présélection --------------------------- */
if (CONTRE === "formulation") {
  for (const r of brut.regles) {
    if (r.params?.max_weight_kg != null) r.rationale = (r.rationale ?? "")
      .replace(/combined dog \+ crate/i, "dog").replace(/including the carrier/i, "")
      .replace(/dog plus crate/i, "dog");
  }
}
if (CONTRE === "langue") {
  const r = brut.regles.find((x) => x.rationale_i18n?.fr && /caisse comprise/i.test(x.rationale_i18n.fr));
  if (r) r.rationale_i18n = { ...r.rationale_i18n, fr: r.rationale_i18n.fr.replace(/, caisse comprise/i, "") };
}
const kb = normalize({ ...brut.objets, rules: brut.regles, breed_restrictions: brut.race });

const estAutoCitee = (url) => { try { return /(^|\.)mydogcanfly\.com$/i.test(new URL(url).hostname); } catch { return false; } };
const annonce = (texte, langue) => (LEXIQUE[langue] ?? []).some((x) => x.test(texte ?? ""));

const SEUILS = brut.regles.filter((r) => r.params?.max_weight_kg != null)
  .sort((a, b) => a.id.localeCompare(b.id));
const AVEC_CONTENANT = SEUILS.filter((r) => annonce(r.rationale, "en"));
const RESIDU = SEUILS.filter((r) => !annonce(r.rationale, "en"));

/* EXIGENCE CENTRALE — l'exhaustivité. C'est elle qui rend le périmètre incontestable : il n'est
   plus tracé par ce qu'on a cherché, mais par ce qui existe. */
exiger("chaque seuil publié est classé : contenant, ou résidu NOMMÉ — aucun troisième état",
  RESIDU.every((r) => r.id in RESIDU_CONNU),
  RESIDU.filter((r) => !(r.id in RESIDU_CONNU)).map((r) => `${r.id} « ${r.rationale?.slice(0, 70)}… »`).join(" | "));
exiger("le résidu versionné ne contient aucune entrée périmée",
  Object.keys(RESIDU_CONNU).every((id) => SEUILS.some((r) => r.id === id)));
exiger("aucune formulation morte au lexique : chaque entrée attrape au moins une règle",
  [...LEXIQUE.en.map((x) => ["en", x]), ...LEXIQUE.fr.map((x) => ["fr", x])]
    .every(([l, x]) => SEUILS.some((r) => x.test((l === "en" ? r.rationale : r.rationale_i18n?.fr) ?? ""))),
  [...LEXIQUE.en.map((x) => ["en", x]), ...LEXIQUE.fr.map((x) => ["fr", x])]
    .filter(([l, x]) => !SEUILS.some((r) => x.test((l === "en" ? r.rationale : r.rationale_i18n?.fr) ?? "")))
    .map(([l, x]) => `${l}:${x}`).join(" | "));
exiger("95 des 96 seuils publiés annoncent une limite incluant le contenant",
  SEUILS.length === 96 && AVEC_CONTENANT.length === 95,
  `${AVEC_CONTENANT.length} / ${SEUILS.length}`);

const parCategorie = AVEC_CONTENANT.reduce((a, r) => (a[r.category] = (a[r.category] ?? 0) + 1, a), {});
exiger("le défaut occupe DEUX catégories : 53 en cabine, 42 en soute",
  parCategorie.cabin_weight === 53 && parCategorie.hold_weight === 42, JSON.stringify(parCategorie));

/* ---- Ce que la condition mesure réellement ------------------------------------------------------ */
const faitsDe = (r) => { const s = new Set(); (function w(n) {
  if (!n || typeof n !== "object") return; if (n.fact) s.add(n.fact);
  for (const v of Object.values(n)) Array.isArray(v) ? v.forEach(w) : w(v); })(r.applies_when); return s; };
const conditionDe = (r) => {
  const c = JSON.stringify(r.applies_when).match(/"fact":"dog\.weight_kg","op":"([a-z]+)","value":([0-9.]+)/);
  return c ? { fait: "dog.weight_kg", op: c[1], valeur: Number(c[2]) } : null;
};
exiger("les 95 ne pèsent QUE `dog.weight_kg`, en `gt`, sur la valeur même du seuil annoncé",
  AVEC_CONTENANT.every((r) => {
    const c = conditionDe(r);
    return c && c.op === "gt" && c.valeur === r.params.max_weight_kg
      && [...faitsDe(r)].filter((f) => /weight/i.test(f)).join() === "dog.weight_kg";
  }),
  AVEC_CONTENANT.filter((r) => conditionDe(r)?.valeur !== r.params.max_weight_kg).map((r) => r.id).join(", "));
exiger("aucun poids de contenant ni poids total nulle part dans le référentiel",
  !/crate_weight|carrier_weight|total_weight/i.test(JSON.stringify(brut.objets) + JSON.stringify(brut.regles)));

/* ---- Les langues : la même annonce, ou l'anglais faute de traduction ---------------------------- */
const langues = ["fr", "es", "pt"];
const traduction = Object.fromEntries(langues.map((l) => [l, {
  traduites: SEUILS.filter((r) => r.rationale_i18n?.[l]).length,
  repli_anglais: SEUILS.filter((r) => !r.rationale_i18n?.[l]).length,
}]));
const divergentes = AVEC_CONTENANT.filter((r) => r.rationale_i18n?.fr && !annonce(r.rationale_i18n.fr, "fr"));
exiger("là où le français existe, il annonce le contenant comme l'anglais — aucune divergence",
  divergentes.length === 0, divergentes.map((r) => r.id).join(", "));
exiger("le français couvre les 96 seuils ; l'espagnol et le portugais, un seul",
  traduction.fr.traduites === 96 && traduction.es.traduites === 1 && traduction.pt.traduites === 1,
  JSON.stringify(traduction));

/* ---- Ce que T0-B3-c avait vu, chiffré ------------------------------------------------------------ */
const PHRASE_T0B3C = /combined dog \+ crate/i;
const vuParT0B3C = SEUILS.filter((r) => PHRASE_T0B3C.test(r.rationale ?? ""));
const perimetreT0B3C = SEUILS.filter((r) => r.category === "hold_weight" && estAutoCitee(r.source.url));
const tiers = AVEC_CONTENANT.filter((r) => !estAutoCitee(r.source.url));
exiger("la phrase de T0-B3-c n'attrape que 41 des 95",
  vuParT0B3C.length === 41, String(vuParT0B3C.length));
exiger("le périmètre de T0-B3-c n'en couvrait que 34",
  perimetreT0B3C.length === 34, String(perimetreT0B3C.length));
exiger("21 des 95 citent un tiers — hors de portée de tout lot « auto-citées »",
  tiers.length === 21, String(tiers.length));

/* ---- L'ampleur relative : le contenant pèse plus lourd en cabine -------------------------------- */
const distribution = (cat) => {
  const s = AVEC_CONTENANT.filter((r) => r.category === cat).map((r) => r.params.max_weight_kg).sort((a, b) => a - b);
  return { n: s.length, min: s[0], mediane: s[(s.length / 2) | 0], max: s.at(-1) };
};
const ampleur = { cabin_weight: distribution("cabin_weight"), hold_weight: distribution("hold_weight") };
exiger("la médiane des seuils de cabine (8 kg) est bien inférieure à celle de la soute (45 kg)",
  ampleur.cabin_weight.mediane === 8 && ampleur.hold_weight.mediane === 45,
  JSON.stringify(ampleur));

/* ---- LA FICHE republie-t-elle le même nombre ? --------------------------------------------------- */
const canalDe = (cat) => (cat === "cabin_weight" ? "cabin" : "hold");
const fiche = AVEC_CONTENANT.map((r) => {
  const pol = kb.airlines.get(r.scope.id)?.premium?.policy?.[canalDe(r.category)];
  return { id: r.id, compagnie: r.scope.id, canal: canalDe(r.category), seuil_regle: r.params.max_weight_kg,
    seuil_fiche: pol?.max_weight_kg ?? null };
});
const ficheMuette = fiche.filter((f) => f.seuil_fiche === null);
const ficheIdentique = fiche.filter((f) => f.seuil_fiche === f.seuil_regle);
const ficheDivergente = fiche.filter((f) => f.seuil_fiche !== null && f.seuil_fiche !== f.seuil_regle);
exiger("là où la fiche parle, elle republie EXACTEMENT le nombre de la règle — elle ne corrige rien",
  ficheDivergente.length === 0, JSON.stringify(ficheDivergente));

/* ---- L'EFFET, LU DANS LE MOTEUR ------------------------------------------------------------------ */
/* LA DATE DE VOYAGE VIENT DU SCEAU, PAS DE L'HORLOGE. T0-B3-c calculait `année courante + 1` : le
 * 1er janvier, ses chiffres changeaient sans qu'une seule donnée ait bougé, et son SHA256SUMS
 * cessait de correspondre. On dérive donc la date du commit de base — déterministe, toujours
 * postérieure au scellement, et jamais dépendante du jour où l'on relance la mesure. */
const DATE_BASE = execFileSync("git", ["show", "-s", "--format=%cI", MESURE_BASE_SHA], { encoding: "utf8" }).trim();
const DATE_VOYAGE = `${Number(DATE_BASE.slice(0, 4)) + 1}-01-15`;
const requete = (route, poids, canal) => {
  const [o, d] = route.split("|");
  return { origin: o, destination: d, dog: { breed_id: "breed_labrador_retriever", weight_kg: poids },
    travel_type: "pet", placement: canal, date: DATE_VOYAGE, locale: "en" };
};
const statut = (dec, cie, canal) => dec.airlines.find((a) => a.airline_id === cie)
  ?.placements.find((p) => p.placement === canal)?.status ?? null;

/* LE TÉMOIN SE CHERCHE, IL NE SE DEVINE PAS. Ma première version prenait le premier trajet direct
 * de la compagnie par ordre alphabétique — et `rule_egyptair_hold_weight` ne mordait pas, non parce
 * qu'elle est morte, mais parce qu'elle porte une TROISIÈME condition : destination Tunisie ou
 * Tanzanie. Reconstruire ces conditions à la main reviendrait à réécrire le moteur dans l'outil de
 * mesure. On essaie donc les trajets l'un après l'autre et on s'arrête au premier où le moteur DIT
 * que la règle a tiré. Une règle qui ne mord sur AUCUN de ses trajets est un fait, pas une excuse :
 * elle est nommée. */
const temoinPour = (r, canal, poids) => {
  for (const route of [...(kb.airlines.get(r.scope.id)?.direct_routes ?? [])].sort()) {
    const dec = evaluate(kb, requete(route, poids, canal));
    const carte = dec.airlines.find((a) => a.airline_id === r.scope.id);
    if ((carte?.fired ?? []).some((f) => f.rule_id === r.id)) return { route, dec, carte };
  }
  return null;
};
const effets = [];
for (const r of AVEC_CONTENANT) {
  const canal = canalDe(r.category);
  const seuil = r.params.max_weight_kg;
  const dessus = temoinPour(r, canal, CONTRE === "temoin" ? Math.max(1, seuil - 1) : seuil + 1);
  if (!dessus) { effets.push({ id: r.id, compagnie: r.scope.id, canal, seuil_kg: seuil, mord: false }); continue; }
  const decDessous = evaluate(kb, requete(dessus.route, Math.max(1, seuil - 1), canal));
  const carteDessous = decDessous.airlines.find((a) => a.airline_id === r.scope.id);
  const sansElle = evaluate({ ...kb, rules: kb.rules.filter((x) => x.id !== r.id) },
    requete(dessus.route, seuil + 1, canal));
  const avant = statut(dessus.dec, r.scope.id, canal), apres = statut(sansElle, r.scope.id, canal);
  /* Ce qui refuse le canal EN PLUS d'elle, lu dans `fired` : c'est ce qui explique qu'un retrait
     ne déplace rien quand il ne déplace rien. */
  const autresRefus = (dessus.carte?.fired ?? [])
    .filter((f) => f.rule_id !== r.id && f.action === "deny").map((f) => f.rule_id);
  effets.push({
    id: r.id, compagnie: r.scope.id, canal, route: dessus.route, seuil_kg: seuil, mord: true,
    temoin: { au_dessus_kg: seuil + 1, en_dessous_kg: Math.max(1, seuil - 1) },
    mord_encore_sous_le_seuil: (carteDessous?.fired ?? []).some((f) => f.rule_id === r.id),
    statut_au_dessus: avant, statut_en_dessous: statut(decDessous, r.scope.id, canal),
    statut_sans_la_regle: apres,
    dominante: avant === "denied" && apres !== "denied",
    masquee_par: avant === "denied" && apres === "denied" ? autresRefus : [],
    score_avec: explain(dessus.dec, "en").score, score_sans: explain(sansElle, "en").score,
  });
}
const mordantes = effets.filter((e) => e.mord);
exiger("les 95 MORDENT — sur un trajet cherché, jamais supposé, et lu dans `fired`",
  mordantes.length === AVEC_CONTENANT.length,
  effets.filter((e) => !e.mord).map((e) => e.id).join(", "));
/* La revendication exacte : SOUS le seuil, la règle ne tire plus. Le canal, lui, peut rester
   refusé par une autre — confondre les deux (ma première version le faisait) aurait imputé à ces
   règles un refus qui ne vient pas d'elles. */
exiger("sous le seuil, aucune de ces règles ne tire plus",
  mordantes.every((e) => !e.mord_encore_sous_le_seuil),
  mordantes.filter((e) => e.mord_encore_sous_le_seuil).map((e) => e.id).join(", "));
const dominantes = mordantes.filter((e) => e.dominante);
const masquees = mordantes.filter((e) => !e.dominante);
exiger("des dominantes sur les DEUX canaux, pas seulement en soute",
  new Set(dominantes.map((e) => e.canal)).size === 2,
  [...new Set(dominantes.map((e) => e.canal))].join(", "));
/* Une règle non dominante doit avoir une CAUSE nommée, lue dans le moteur : sans quoi « non
   dominante » deviendrait un fourre-tout où l'on rangerait ce qu'on n'explique pas. */
exiger("toute règle non dominante est masquée par un refus NOMMÉ, lu dans `fired`",
  masquees.every((e) => e.masquee_par.length > 0),
  masquees.filter((e) => !e.masquee_par.length).map((e) => `${e.id} (${e.statut_au_dessus})`).join(", "));

const apresRetrait = {};
for (const e of mordantes) {
  const c = `${e.canal} : ${e.statut_au_dessus} → ${e.statut_sans_la_regle}`;
  apresRetrait[c] = (apresRetrait[c] ?? 0) + 1;
}

/* ---- CE QUE LE VOYAGEUR LIT — dans les octets publiés, pas dans l'intention ----------------------
 * `EntityPage.astro` affiche `rule.rationale` et `pagedata.ts` y injecte la traduction quand elle
 * existe. Le vérifier dans le code ne suffit pas : on le lit dans le SITE CONSTRUIT. Sans site
 * complet, la mesure ÉCHOUE — elle ne se déclare jamais verte faute de matière. */
const pagesHtml = [];
(function parcourir(d) {
  if (!existsSync(d)) return;
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) parcourir(p);
    else if (e.endsWith(".html")) pagesHtml.push(p);
  }
})(SITE);

/* ---- D'OÙ VIENT CE SITE ? ----------------------------------------------------------------------
 * Compter les pages ne dit pas de quelle VERSION elles sortent, ni si le site est complet. Le
 * contrat est écrit UNE fois, dans `scripts/lib/provenance.mjs` : empreinte des sources, des
 * fichiers déterminants et des paramètres du build, décompte annoncé confronté au décompte réel,
 * et bijection sitemap → fichiers. Il l'était auparavant quatre fois, et les copies divergeaient. */
exigerProvenance(SITE, "t0b3d");

const PLANCHER_PAGES = 2000;
if (pagesHtml.length < PLANCHER_PAGES) {
  process.stderr.write(`[t0b3d] ÉCHEC — le site construit est absent ou partiel (${pagesHtml.length} pages HTML `
    + "sous packages/ui/dist, attendu ≥ 2000). Ce dossier prouve la publication sur les octets "
    + "publiés : `npm run build` d'abord.\n");
  process.exit(1);
}
/* CE QUE J'AI CRU, ET CE QUE LES OCTETS DISENT. `EntityPage.astro` contient bien un bloc qui
 * affiche `rule.rationale`, et `pagedata.ts` y injecte la traduction : j'en avais conclu que la
 * phrase contradictoire était sous les yeux du voyageur. Les 2 957 pages construites disent le
 * contraire. La classe `ep__rationale` — la seule par laquelle une rationale puisse sortir —
 * n'apparaît sur AUCUNE page. Lire le code ne remplace pas lire le site. */
/* LE NOMBRE DE PAGES LUES NE FAIT PAS PARTIE DE L'ARTEFACT — corrigé le 20/08/2026.
 *
 * Il y figurait, figé à 2 957. C'est le nombre de pages qu'avait le site ce jour-là, pas un fait
 * mesuré sur le poids du contenant : chaque article publié depuis le faisait bouger, l'artefact
 * changeait, et SHA256SUMS échouait. Le dossier n'était donc plus reproductible — même famille de
 * défaut que celui relevé sur T0-B3-g par la contre-revue du 20/08/2026, trouvé en cherchant s'il
 * était seul de son espèce. Il ne l'était pas.
 *
 * Ce qui est mesuré ne change pas : AUCUNE page ne publie de rationale. Ce qui disparaît du sceau
 * est le décompte incident du site ; ce qui reste est le PLANCHER déclaré, qui garantit qu'on a
 * bien lu quelque chose. Le compte réel est toujours affiché à l'écran, il n'est simplement plus
 * scellé. */
const CLASSE_RATIONALE = "ep__rationale";
const publication = { pages_lues_minimum: PLANCHER_PAGES, pages_portant_la_classe: 0, pages_portant_une_rationale: 0 };
const phrasesDesRegles = AVEC_CONTENANT.flatMap((r) => [r.rationale, r.rationale_i18n?.fr, r.rationale_i18n?.es,
  r.rationale_i18n?.pt].filter(Boolean).map((t) => t.slice(0, 60)));
for (const p of pagesHtml) {
  const html = readFileSync(p, "utf8");
  if (html.includes(CLASSE_RATIONALE)) publication.pages_portant_la_classe++;
  if (phrasesDesRegles.some((t) => html.includes(t))) publication.pages_portant_une_rationale++;
}
exiger("aucune page ne porte la classe qui publierait une rationale — le bloc existe, il ne sort jamais",
  publication.pages_portant_la_classe === 0, String(publication.pages_portant_la_classe));
exiger("aucune page du site ne publie l'une des 95 rationales, dans aucune des 4 langues",
  publication.pages_portant_une_rationale === 0,
  `${publication.pages_portant_une_rationale} page(s) sur ${pagesHtml.length} lues`);

/* CE QUE CE DOSSIER NE MESURE PAS, ET POURQUOI IL S'EN ABSTIENT.
 *
 * La fiche publie, elle, des notes de politique qui annoncent parfois une limite « contenant
 * compris » — j'ai vu « up to 75 kg including the carrier » sur Qatar Airways et « Jusqu'à 45 kg
 * caisse comprise » sur Asiana, dans les octets. J'ai voulu en donner le compte, et j'ai obtenu
 * 44 avec un lexique large, 2 avec le lexique de ce dossier. Les deux chiffres sont faux : le
 * lexique ci-dessus est fermé par résidu CONTRE LE CORPUS DES RÈGLES, et ne prouve rien contre
 * celui des fiches, dont les tournures diffèrent et dont les traductions sont réelles.
 *
 * Publier l'un des deux referait, à la lettre, la faute que ce dossier corrige : laisser une
 * phrase choisir un périmètre. Ce dossier ne publie donc AUCUN compte de fiches. Ce qu'il établit
 * de la fiche, il l'établit exhaustivement plus haut, sur ses SEUILS : 20 republient au kilo près
 * le nombre de la règle, 75 sont muettes, aucune ne diverge. */
publication.comptes_de_fiches = null;

/* ---- LA GRILLE PUBLIQUE -------------------------------------------------------------------------- */
const ROUTES = [
  ["airport_cdg", "airport_bkk"], ["airport_cdg", "airport_jfk"], ["airport_cdg", "airport_dxb"],
  ["airport_lhr", "airport_mia"], ["airport_fra", "airport_sin"], ["airport_mad", "airport_mex"],
  ["airport_cdg", "airport_lhr"], ["airport_jfk", "airport_cdg"], ["airport_mxp", "airport_jfk"],
];
const sansLes95 = { ...kb, rules: kb.rules.filter((r) => !AVEC_CONTENANT.some((x) => x.id === r.id)) };
const publique = { scenarios: 0, placements_deplaces: 0, cibles: {} };
for (const [o, d] of ROUTES) {
  for (const poids of [7, 9, 30, 50]) {
    for (const canal of ["cabin", "hold"]) {
      publique.scenarios++;
      const a = evaluate(kb, requete(`${o}|${d}`, poids, canal));
      const b = evaluate(sansLes95, requete(`${o}|${d}`, poids, canal));
      for (const carte of b.airlines) {
        const sa = statut(a, carte.airline_id, canal), sb = statut(b, carte.airline_id, canal);
        if (sa !== null && sa !== sb) {
          publique.placements_deplaces++;
          publique.cibles[`${canal} : ${sa} → ${sb}`] = (publique.cibles[`${canal} : ${sa} → ${sb}`] ?? 0) + 1;
        }
      }
    }
  }
}

/* ---- L'ARTEFACT ---------------------------------------------------------------------------------- */
const artefact = {
  lot: "T0-B3-d — le poids du contenant : le périmètre réel",
  nature: "mesure seule : aucune règle retirée, aucun seuil déplacé, aucun fichier de packages/ écrit",
  sceau: {
    measurement_base_sha: MESURE_BASE_SHA,
    raw_rules_sha256: sha256(readFileSync(RAW.regles)),
    raw_objects_sha256: sha256(readFileSync(RAW.objets)),
    moteur_sha256: sha256(SOURCES_MOTEUR.map((c) => `${c}:${sha256(readFileSync(c))}`).join("\n")),
    page_sha256: sha256(SOURCES_PAGE.map((c) => `${c}:${sha256(readFileSync(c))}`).join("\n")),
    date_de_voyage: DATE_VOYAGE,
    date_de_voyage_origine: "dérivée du commit de base, jamais de l'horloge",
  },
  methode: {
    principe: "partir de TOUS les seuils publiés, pas d'une phrase : tout `params.max_weight_kg` du "
      + "référentiel, toutes catégories, toutes sources. Chaque seuil doit être classé — contenant, "
      + "ou résidu nommé. Aucun troisième état.",
    lexique: { en: LEXIQUE.en.map(String), fr: LEXIQUE.fr.map(String) },
    residu_versionne: RESIDU_CONNU,
  },
  perimetre: {
    seuils_publies: SEUILS.length,
    annoncent_le_contenant: AVEC_CONTENANT.length,
    residu: RESIDU.map((r) => r.id),
    par_categorie: parCategorie,
    auto_cites: AVEC_CONTENANT.length - tiers.length,
    citent_un_tiers: tiers.length,
    compagnies_distinctes: new Set(AVEC_CONTENANT.map((r) => r.scope.id)).size,
  },
  ce_que_t0b3c_voyait: {
    sa_phrase_attrape: vuParT0B3C.length,
    son_perimetre: perimetreT0B3C.length,
    lecture: "34 sur 95. Le chiffre de T0-B3-c était juste pour le périmètre qu'il s'était donné ; "
      + "il décrivait un onzième du défaut. 21 des 95 citent un tiers : aucun lot « retirer les "
      + "règles auto-citées » ne les atteindrait.",
  },
  ampleur_relative: {
    seuils: ampleur,
    lecture: "L'écart permissif vaut exactement le poids du contenant. Sur un seuil de soute médian "
      + "à 45 kg, une caisse de 8 kg ouvre une fenêtre de 18 %. Sur un seuil de cabine médian à "
      + "8 kg, un sac de 2 kg en ouvre une de 25 %, et le canal concerné est celui que le voyageur "
      + "consulte en premier. Ces pourcentages illustrent : le référentiel ne détient AUCUN poids "
      + "de contenant, et ce dossier n'en invente pas.",
  },
  langues: {
    traduction, divergences_en_fr: divergentes.map((r) => r.id),
    lecture: "Le français couvre les 96 seuils et annonce le contenant partout. L'espagnol et le "
      + "portugais n'en traduisent qu'un : les 95 autres phrases sont publiées EN ANGLAIS sur les "
      + "pages `es` et `pt`. C'est une dette distincte de celle-ci, mesurée ici parce qu'elle porte "
      + "sur les mêmes phrases.",
  },
  la_fiche: {
    muettes: ficheMuette.length, republient_le_meme_nombre: ficheIdentique.length,
    divergentes: ficheDivergente.length,
    lecture: "Là où la fiche publie un seuil, c'est le même nombre que la règle — au kilo près. La "
      + "fiche ne fournit donc aucun garde-fou : elle republie l'annonce, contenant compris.",
    detail: fiche,
  },
  effet_mesure: {
    mordent: mordantes.length,
    dominantes: dominantes.length,
    dominantes_par_canal: dominantes.reduce((a, e) => (a[e.canal] = (a[e.canal] ?? 0) + 1, a), {}),
    masquees_par_un_autre_refus: masquees.length,
    masquees_detail: masquees.map((e) => ({ id: e.id, canal: e.canal, par: e.masquee_par })),
    statut_apres_retrait: apresRetrait,
    deplacent_le_score: mordantes.filter((e) => e.score_avec !== e.score_sans).length,
    lecture: "Une règle masquée n'est pas inoffensive : elle est fausse au même titre que les "
      + "autres, mais son retrait ne déplacerait rien tant que le refus qui la couvre tient. "
      + "Distinguer les deux évite de compter comme « sans effet » une erreur qui attend son tour.",
    detail: effets,
  },
  publication: {
    ...publication,
    lecture: "Lu dans les OCTETS du site construit, et il dément ce que la lecture du code laissait "
      + "croire. `EntityPage.astro` contient un bloc qui afficherait `rule.rationale` ; il ne sort "
      + "sur aucune des 2 957 pages. Les 95 phrases contradictoires sont donc invisibles : ce qui "
      + "atteint le voyageur, c'est leur CONSÉQUENCE — un verdict calculé sur le chien seul — sans "
      + "le texte qui permettrait de la contester.",
    a_mesurer_ensuite: "la FICHE publie ses propres notes, qui annoncent parfois une limite "
      + "« contenant compris » dans la langue du visiteur. Les compter demande un lexique fermé par "
      + "résidu CONTRE LE CORPUS DES FICHES, dans les quatre langues — celui de ce dossier est "
      + "fermé contre les règles et n'y vaut rien. Aucun compte de fiches n'est publié ici : c'est "
      + "un dossier à part, et le donner de travers referait la faute que celui-ci corrige.",
  },
  grille_publique: publique,
  exigences_tenues: echecs === 0,
};
if (!CONTRE) writeFileSync(`${DOSSIER}/poids-du-contenant.json`, JSON.stringify(artefact, null, 1) + "\n");

process.stdout.write(`
  périmètre    : ${SEUILS.length} seuils publiés · ${AVEC_CONTENANT.length} annoncent le contenant · résidu ${RESIDU.length} (${RESIDU.map((r) => r.id).join(", ") || "—"})
  catégories   : ${JSON.stringify(parCategorie)} · ${AVEC_CONTENANT.length - tiers.length} auto-citées / ${tiers.length} citant un tiers · ${new Set(AVEC_CONTENANT.map((r) => r.scope.id)).size} compagnies
  T0-B3-c      : sa phrase en attrapait ${vuParT0B3C.length}, son périmètre ${perimetreT0B3C.length} — sur ${AVEC_CONTENANT.length}
  ampleur      : cabine ${JSON.stringify(ampleur.cabin_weight)} · soute ${JSON.stringify(ampleur.hold_weight)}
  langues      : ${JSON.stringify(traduction)}
  la fiche     : ${ficheMuette.length} muettes · ${ficheIdentique.length} republient le même nombre · ${ficheDivergente.length} divergentes
  effet        : ${mordantes.length}/${AVEC_CONTENANT.length} mordent · ${dominantes.length} dominantes ${JSON.stringify(dominantes.reduce((a, e) => (a[e.canal] = (a[e.canal] ?? 0) + 1, a), {}))} · ${masquees.length} masquées par un autre refus
  après retrait: ${JSON.stringify(apresRetrait)}
  publication  : ${pagesHtml.length} pages lues · ${publication.pages_portant_une_rationale} publient une rationale
  publique     : ${publique.scenarios} scénarios · ${publique.placements_deplaces} déplacés · ${JSON.stringify(publique.cibles)}
`);

for (const chemin of Object.values(RAW)) {
  if (sha256(readFileSync(chemin)) !== sha256(auCommit(chemin))) {
    process.stderr.write(`[t0b3d] ÉCHEC — ${chemin} a été MODIFIÉ pendant la mesure.\n`);
    process.exit(1);
  }
}
process.stdout.write(echecs === 0
  ? "[t0b3d] toutes les exigences sont tenues.\n"
  : `[t0b3d] ÉCHEC — ${echecs} exigence(s) non tenue(s)\n`);
process.exit(echecs === 0 ? 0 : 1);
