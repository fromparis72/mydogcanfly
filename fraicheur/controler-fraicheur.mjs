#!/usr/bin/env node
/**
 * LOT B — LE CONTRÔLEUR HEBDOMADAIRE DE FRAÎCHEUR. Il OBSERVE, il ne corrige JAMAIS.
 *
 *   node --import tsx fraicheur/controler-fraicheur.mjs --date=AAAA-MM-JJ [--sortie=DIR]
 *
 * CE QU'IL FAIT : lit le registre EXACT (1 508 sources — familles d'objects.json, rules,
 * et breed-restrictions en extension explicite), calcule pour CHACUNE son état d'ÉCHÉANCE,
 * consulte les URL sélectionnées (échues, bientôt à revoir, et la tranche tournante sans
 * état — SHA256(url) mod 8 contre le numéro de semaine continue mod 8, couverture ≤ 56
 * jours), confronte chaque corps à la RÉFÉRENCE FIGÉE de `fraicheur/references.json`, et
 * produit une FILE DE TRAVAIL priorisée par impact utilisateur (JSON exploitable + Markdown
 * lisible) dans un répertoire de sortie HORS des données versionnées.
 *
 * DEUX AXES INDÉPENDANTS, jamais fusionnés (contre-revue, P0-2) :
 *   echeance : a_jour | bientot_a_revoir | echue          (toutes les sources, chaque run)
 *   controle : non_controlee | reportee (budget épuisé) | sans_reference | inchangee
 *            | potentiellement_modifiee | reference_incompatible | inaccessible
 * (et les RÉFÉRENCES ORPHELINES — URL absente du registre — sont nommées au rapport et en
 * file). « inchangee » exige l'égalité des CINQ champs observables de la référence
 * (empreinte du corps, url_finale, statut, content_type, octets) sous la MÊME version de
 * contrôleur — aucun champ du contrat n'est décoratif.
 * Une source hors tranche reste `non_controlee` — jamais implicitement accessible ni
 * inchangée. Une URL sans référence VALIDÉE est `sans_reference` — la première capture ne
 * consacre RIEN (P0-3) : une empreinte ne devient référence que par décision humaine et PR
 * sur `fraicheur/references.json`. Une inaccessible n'est JAMAIS « inchangée ».
 *
 * CE QU'IL NE FAIT JAMAIS :
 *   · modifier une donnée, une règle, un verdict, ou `references.json` — toute correction
 *     est une PR humaine ;
 *   · écrire ailleurs que dans son répertoire de sortie (refus si la sortie résout dans les
 *     données versionnées) ;
 *   · rougir la CI principale sur une échéance naturelle — une file non vide sort en 0 ;
 *   · classer quoi que ce soit « inaccessible » pendant une panne systémique : sonde rouge,
 *     signature environnementale, ou zéro URL joignable → sortie 2, AUCUN état persisté
 *     (une panne de l'exécutant ne fabrique jamais 300 inaccessibles) ;
 *   · analyser le DOM — la comparaison d'empreintes dit « potentiellement modifié »,
 *     jamais « règle devenue fausse ».
 *
 * Sortie 0 : run accompli, rapport écrit (file de travail comprise). Sortie 2 : panne
 * structurelle ou systémique NOMMÉE (registre invalide, references.json difforme,
 * environnement inapte) — rien d'interprétable n'a été produit.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { z } from "zod";
import { lireRegistre, jsonCanonique, sha256De, CLASSE_IMPACT, ORDRE_IMPACT,
  etatEcheance, dansLaTranche, trancheDe, semaineContinue, N_TRANCHES,
  SEUIL_BIENTOT_JOURS, VERSION_CONTROLEUR } from "./registre-fraicheur.mjs";
import { sondeEnvironnement, consulterUrl } from "./reseau-fraicheur.mjs";
import { ecartsAuScelle, CHEMIN_SCELLE } from "./sceller-registre.mjs";
import { estUrlHttp } from "../liste-rattachements-lot-a.mjs";

const CHEMIN_REFERENCES = "fraicheur/references.json";

const refus = (m) => { process.stderr.write(`[fraicheur] ÉCHEC — ${m}\n`); process.exit(2); };

/* ---- arguments ------------------------------------------------------------------------------- */
const dateExiste = (d) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d));
  if (!m) return false;
  const u = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return u.getUTCFullYear() === +m[1] && u.getUTCMonth() === +m[2] - 1 && u.getUTCDate() === +m[3];
};
const DATE = (process.argv.find((a) => a.startsWith("--date=")) || "").slice(7);
if (!dateExiste(DATE)) refus("--date=AAAA-MM-JJ est OBLIGATOIRE et la date doit exister au calendrier");
const SORTIE = (process.argv.find((a) => a.startsWith("--sortie=")) || "").slice(9) || "fraicheur-sortie";
/* BUDGET GLOBAL de consultation (contre-revue : 45 s × 280 URL séquentielles dépassait le
 * budget du workflow — le job mourait sans rapport). Le run TERMINE TOUJOURS dans son
 * budget : les URL sélectionnées mais non exécutées sont classées `reportee`, comptées et
 * nommées — jamais silencieuses, jamais « inaccessibles ». */
const BUDGET_SECONDES = Number((process.argv.find((a) => a.startsWith("--budget-secondes=")) || "").slice(18) || 1800);
if (!Number.isFinite(BUDGET_SECONDES) || BUDGET_SECONDES < 0) refus("--budget-secondes doit être un nombre de secondes ≥ 0");

/* La sortie ne résout JAMAIS dans les données versionnées : le contrôleur observe. */
const sortieResolue = resolve(SORTIE) + sep;
for (const interdit of ["packages", "content", "fraicheur", "audit-pays-pieces", ".github"]) {
  if (sortieResolue.startsWith(resolve(interdit) + sep) || sortieResolue === resolve(interdit) + sep) {
    refus(`répertoire de sortie « ${SORTIE} » DANS les données versionnées (${interdit}/) — le contrôleur n'écrit jamais dans le dépôt`);
  }
}

/* ---- 1. le registre exact, CONFRONTÉ à son scellé versionné ---------------------------------
 * (contre-revue du socle : un registre exact que le run ne confronte à rien ne protège rien).
 * La CI de PR porte le rouge au moment du changement ; un `main` qui ne respecte pas son
 * scellé est donc une panne STRUCTURELLE — le run refuse, rien n'est interprétable. */
let registre;
try { registre = lireRegistre("."); }
catch (e) { refus(e.message); }
{
  let scelle;
  try { scelle = JSON.parse(readFileSync(CHEMIN_SCELLE, "utf-8")); }
  catch { refus(`${CHEMIN_SCELLE} ABSENT ou illisible — le registre exact se scelle, rien ne se surveille sans contrat`); }
  const ecarts = ecartsAuScelle(registre, scelle);
  if (ecarts.length) {
    refus(`le registre recalculé ≠ scellé versionné : ${ecarts.length} écart(s) — ` +
      ecarts.slice(0, 8).map((e) => `${e.type} ${e.famille}:${e.locator}`).join(" · ") +
      (ecarts.length > 8 ? ` · … et ${ecarts.length - 8} autre(s)` : "") +
      " — une source a changé sans rescellement (la CI de PR aurait dû rougir) : panne structurelle, rien n'est interprétable");
  }
}

/* ---- 2. les références FIGÉES (versionnées, modifiées par PR humaine uniquement) ------------- */
const Reference = z.object({
  url: z.string().refine(estUrlHttp, { message: "URL au contrat HTTP(S) exigée" }),
  empreinte_corps: z.string().regex(/^[0-9a-f]{64}$/),
  url_finale: z.string().refine(estUrlHttp, { message: "URL au contrat HTTP(S) exigée" }),
  statut_http: z.number().int().min(200).max(299),
  content_type: z.string(),
  octets: z.number().int().min(0),
  capturee_le: z.string().refine(dateExiste, { message: "date inexistante au calendrier" }),
  version_controleur: z.string().min(1),
}).strict();
const References = z.object({ version: z.literal(VERSION_CONTROLEUR), references: z.array(Reference) }).strict();
let references;
try { references = References.parse(JSON.parse(readFileSync(CHEMIN_REFERENCES, "utf-8"))); }
catch (e) {
  refus(`${CHEMIN_REFERENCES} ABSENT ou difforme (${String(e.message).split("\n")[0]}) — les références figées sont le contrat de comparaison, rien ne s'invente`);
}
const referenceParUrl = new Map(references.references.map((r) => [r.url, r]));
if (referenceParUrl.size !== references.references.length) refus(`${CHEMIN_REFERENCES} — URL en double : une URL a UNE référence figée`);

/* ---- 3. échéances (toutes les sources) et sélection (URL uniques) ---------------------------- */
const echeanceParEntree = new Map();
for (const e of registre.entrees) echeanceParEntree.set(e, etatEcheance(e.source.review_due, DATE));
const urls = [...registre.parUrl.keys()].sort();
const urgent = new Set();
for (const [url, entrees] of registre.parUrl) {
  if (entrees.some((e) => echeanceParEntree.get(e) !== "a_jour")) urgent.add(url);
}
const selection = urls.filter((u) => urgent.has(u) || dansLaTranche(u, DATE));

/* ---- 4. environnement apte, puis UNE consultation par URL sélectionnée ----------------------- */
const sonde = sondeEnvironnement();
if (!sonde.apte) refus(`environnement INAPTE : ${sonde.cause} — aucun contrôle n'est interprétable, AUCUNE source n'est déclarée inaccessible`);
const controleParUrl = new Map();
const debutConsultations = Date.now();
let joignables = 0, reportees = 0;
for (const url of selection) {
  if ((Date.now() - debutConsultations) / 1000 >= BUDGET_SECONDES) {
    /* budget épuisé : l'URL n'est PAS exécutée — état honnête, jamais « inaccessible » */
    controleParUrl.set(url, { controle: "reportee" });
    reportees++;
    continue;
  }
  const r = consulterUrl(url);
  if (r.controle === "environnement") {
    refus(`${r.cause} — panne systémique en cours de run : rien n'est interprétable, AUCUNE source n'est déclarée inaccessible`);
  }
  if (r.controle === "ok") joignables++;
  controleParUrl.set(url, r);
}
const executees = selection.length - reportees;
if (executees > 0 && joignables === 0) {
  refus(`0 URL joignable sur ${executees} exécutée(s) — l'outil ne peut rien contrôler : c'est la signature d'une panne, pas un état des sources`);
}

/* ---- 5. l'état de contrôle par URL (axe RÉSEAU, indépendant de l'échéance) ------------------- */
const etatControle = (url) => {
  const r = controleParUrl.get(url);
  if (!r) return { controle: "non_controlee" };
  if (r.controle === "reportee") return { controle: "reportee" };
  if (r.controle === "inaccessible") return { controle: "inaccessible", cause: r.cause };
  const ref = referenceParUrl.get(url);
  if (!ref) {
    /* première capture : elle ne consacre RIEN — la référence naît d'une PR humaine */
    return { controle: "sans_reference", observe: r };
  }
  /* la référence a HUIT champs, et aucun n'est décoratif (contre-revue : seule l'empreinte
   * du corps était confrontée — url_finale, statut, type et octets faux passaient
   * « inchangée »). Une version de contrôleur différente rend la référence INCOMPATIBLE :
   * elle ne prouve ni le même, ni le changé — elle se re-promeut par PR humaine. */
  if (ref.version_controleur !== VERSION_CONTROLEUR) {
    return { controle: "reference_incompatible", observe: r,
      reference: { version_controleur: ref.version_controleur, capturee_le: ref.capturee_le } };
  }
  const champsDivergents = [];
  if (r.empreinte_corps !== ref.empreinte_corps) champsDivergents.push("empreinte_corps");
  if (r.url_finale !== ref.url_finale) champsDivergents.push("url_finale");
  if (r.statut_http !== ref.statut_http) champsDivergents.push("statut_http");
  if (r.content_type !== ref.content_type) champsDivergents.push("content_type");
  if (r.octets !== ref.octets) champsDivergents.push("octets");
  return champsDivergents.length === 0
    ? { controle: "inchangee", observe: r }
    : { controle: "potentiellement_modifiee", champs_divergents: champsDivergents, observe: r,
        reference: { empreinte_corps: ref.empreinte_corps, capturee_le: ref.capturee_le } };
};

/* ---- 6. le rapport : JSON exploitable + Markdown lisible ------------------------------------- */
const lignes = registre.entrees.map((e) => {
  const url = e.source.url;
  const c = etatControle(url);
  return {
    famille: e.famille,
    locator: e.locator,
    classe_impact: CLASSE_IMPACT[e.famille] ?? "D",
    url,
    review_due: e.source.review_due,
    verified_date: e.source.verified_date,
    echeance: echeanceParEntree.get(e),
    ...c,
  };
});
const enFile = (l) => l.echeance !== "a_jour"
  || l.controle === "potentiellement_modifiee" || l.controle === "inaccessible"
  || l.controle === "sans_reference" || l.controle === "reference_incompatible";
const file = lignes.filter(enFile).sort((a, b) =>
  (ORDRE_IMPACT[a.classe_impact] - ORDRE_IMPACT[b.classe_impact])
  || (a.review_due < b.review_due ? -1 : a.review_due > b.review_due ? 1 : 0)
  || (a.locator < b.locator ? -1 : 1));
/* Les RÉFÉRENCES ORPHELINES : une référence figée dont l'URL n'existe plus au registre —
 * la source a disparu ou déplacé son adresse. Elle est NOMMÉE au rapport et en file, jamais
 * évaporée (contre-revue : une source disparue mais encore présente dans l'historique doit
 * être nommée) ; la décision — retirer ou migrer la référence — est une PR humaine. */
const urlsRegistre = new Set(registre.parUrl.keys());
const referencesOrphelines = references.references
  .filter((x) => !urlsRegistre.has(x.url))
  .map((x) => ({ type: "reference_orpheline", famille: "references", locator: `reference:${x.url}`,
    classe_impact: "—", url: x.url, review_due: x.capturee_le, echeance: "—", controle: "reference_orpheline" }));
file.push(...referencesOrphelines);
const compter = (xs, par) => xs.reduce((acc, x) => { const k = par(x); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});

const rapport = {
  version_controleur: VERSION_CONTROLEUR,
  date: DATE,
  semaine_continue: semaineContinue(DATE),
  tranche_du_run: semaineContinue(DATE) % N_TRANCHES,
  seuil_bientot_jours: SEUIL_BIENTOT_JOURS,
  budget_secondes: BUDGET_SECONDES,
  registre: {
    entrees: registre.entrees.length,
    urls_uniques: registre.parUrl.size,
    empreintes: registre.empreintes,
  },
  references: { total: references.references.length, orphelines: referencesOrphelines.length },
  selection: { urls: selection.length, urgentes: urgent.size, executees, joignables, reportees },
  echeances: compter(lignes, (l) => l.echeance),
  controles: compter(lignes, (l) => l.controle),
  references_orphelines: referencesOrphelines.map((x) => x.url),
  file_de_travail: file,
};
mkdirSync(SORTIE, { recursive: true });
writeFileSync(`${SORTIE}/rapport-${DATE}.json`, JSON.stringify(rapport, null, 2) + "\n");

const md = [];
md.push(`# Fraîcheur des sources — ${DATE}`);
md.push("");
md.push(`Registre : **${rapport.registre.entrees} sources** (${rapport.registre.urls_uniques} URL uniques) · empreinte \`${rapport.registre.empreintes.globale.slice(0, 16)}…\` · références figées : ${rapport.references.total}.`);
md.push(`Sélection : ${selection.length} URL (tranche ${rapport.tranche_du_run}/${N_TRANCHES}, semaine continue ${rapport.semaine_continue}) · ${executees} exécutée(s) · ${joignables} joignable(s)` +
  (reportees ? ` · **${reportees} REPORTÉE(S)** — budget de ${BUDGET_SECONDES} s épuisé : non exécutées, jamais « inaccessibles »` : "") + ".");
if (referencesOrphelines.length) {
  md.push("");
  md.push(`**${referencesOrphelines.length} référence(s) ORPHELINE(S)** — leur URL n'existe plus au registre (source disparue ou déplacée) : retirer ou migrer par PR humaine — voir la file.`);
}
if (references.references.length === 0) {
  md.push("");
  md.push("**Aucune référence figée n'existe encore** : chaque contrôle est `sans_reference` — l'historique ne s'invente pas ; les références naissent par PR humaine sur `fraicheur/references.json` (les champs nécessaires sont dans le rapport JSON).");
}
md.push("");
md.push(`Échéances : ${Object.entries(rapport.echeances).map(([k, v]) => `${k} **${v}**`).join(" · ")}`);
md.push(`Contrôles : ${Object.entries(rapport.controles).map(([k, v]) => `${k} **${v}**`).join(" · ")}`);
md.push("");
md.push(`## File de travail (${file.length}) — impact puis échéance`);
md.push("");
md.push("| impact | famille | échéance | contrôle | review_due | locator |");
md.push("|---|---|---|---|---|---|");
for (const l of file.slice(0, 200)) {
  md.push(`| ${l.classe_impact} | ${l.famille} | ${l.echeance} | ${l.controle} | ${l.review_due} | \`${l.locator}\` |`);
}
if (file.length > 200) md.push(`| … | … | … | … | … | _et ${file.length - 200} autre(s) — détail complet dans le JSON_ |`);
md.push("");
md.push("_Aucune donnée n'a été modifiée par ce run : toute correction (source, citation, date, règle) et toute promotion de référence passent par une PR humaine._");
writeFileSync(`${SORTIE}/RAPPORT-${DATE}.md`, md.join("\n") + "\n");

process.stdout.write(`[fraicheur] ${rapport.registre.entrees} sources · ${selection.length} URL sélectionnées (${executees} exécutées, ${joignables} joignables` +
  `${reportees ? `, ${reportees} reportées hors budget` : ""}) · file de travail : ${file.length} · rapport : ${SORTIE}/rapport-${DATE}.json\n`);
