#!/usr/bin/env node
/**
 * mesurer-achevement.mjs — l'annexe reproductible du DOSSIER-ACHEVEMENT-PROJET.
 *
 *   node --import tsx mesurer-achevement.mjs --as-of=2026-08-23                     relevé lisible
 *   node --import tsx mesurer-achevement.mjs --as-of=2026-08-23 --json              le même, exploitable
 *   node --import tsx mesurer-achevement.mjs --as-of=2026-08-23 --bloc              le bloc contractuel à embarquer
 *   node --import tsx mesurer-achevement.mjs --as-of=2026-08-23 --verifier-dossier  le dossier CONTRE le relevé
 *
 * `--import tsx` parce que ce script réutilise le SCHÉMA CANONIQUE `Source` de
 * `packages/knowledge/src/common.ts` — celui que `npm run check` applique aux données. La version
 * précédente maintenait un validateur partiel (« url, source_type, review_due ») qui laissait
 * passer une confiance absente, un reviewer absent, un type inconnu, une date impossible. Deux
 * validateurs pour un même contrat finissent toujours par diverger, et c'est le partiel qu'on
 * croit.
 *
 * LA CONCORDANCE EST UN BLOC STRUCTURÉ, PAS DES SOUS-CHAÎNES. La version précédente cherchait 38
 * fragments avec `includes()` : un fragment présent DEUX fois dans le dossier laissait passer
 * l'altération de l'une des occurrences — contre-épreuve de Codex, « 28/09/2026 » modifié dans la
 * section fraîcheur, intact dans le lot B, sortie 0. Le dossier embarque désormais un BLOC
 * CONTRACTUEL JSON, délimité, exigé UNIQUE, comparé au relevé À ÉGALITÉ EXACTE et dans les deux
 * sens. Cinq classes d'écart, chacune avec son diagnostic : valeur modifiée, entrée supprimée du
 * bloc, entrée ajoutée au bloc, donnée source modifiée (le relevé recalculé ne correspond plus),
 * bloc dupliqué ou absent. La prose du dossier est narrative ; le bloc fait foi.
 *
 * LE BLOC FIGE AUSSI LE REGISTRE EXACT, pas seulement les agrégats : empreintes SHA-256 des
 * objets `Source` canoniques appariés à leur locator, en JSON canonique — globale, par famille,
 * et séparée pour les archives. Remplacer une URL par une autre URL valide de même type, modifier
 * un relecteur, déplacer une `verified_date` sans changer de tranche : aucun agrégat ne bouge,
 * l'empreinte rougit.
 *
 * LES IDENTITÉS SONT UN LOCATOR PROVISOIRE, PAS UNE IDENTITÉ LONGITUDINALE. 250 sources vivantes
 * vivaient sous un indice numérique (`contacts[0].source`) : une insertion ou un tri changeait
 * leur adresse. Un élément de tableau sans `id` est désormais adressé par l'EMPREINTE DE L'URL de
 * sa source (`h:xxxxxxxxxxxx`), jointe à son `year` pour les évènements de frise historique, qui
 * citent légitimement la même page. Ce locator résiste aux insertions et aux tris — PAS au
 * déménagement d'une source : si une URL officielle change, l'empreinte change, et un suivi
 * longitudinal y verrait une suppression et une création, pas la mise à jour d'une même source.
 * C'est une empreinte provisoire ; le lot B devra soit introduire des identifiants explicites,
 * soit assumer cette sémantique. Seule compte l'adresse d'un élément dont le sous-arbre porte une
 * source datée (les tableaux de tags ou de routes n'ont pas d'adresse à perdre) ; la première
 * source rangée sous un élément sans clé — ou sous une empreinte en collision — incrémenterait
 * `identites_instables`, que le bloc contractuel fige à 0.
 *
 * LES ARCHIVES SONT UN CONTRAT, PAS UN MOT-CLÉ. L'exclusion de `history` était globale : toute
 * future source rangée sous n'importe quel champ `history` aurait disparu du registre en silence.
 * Seul le chemin d'archive CONNU — `airlines[*].premium.history[*]` — est admis ; une source
 * datée sous tout autre `history` est BLOQUANTE et nommée. Les archives elles-mêmes sont
 * validées au schéma canonique : hors registre n'est pas hors contrat.
 *
 * IL NE CORRIGE RIEN. Il lit, il compte, il n'écrit aucun fichier du dépôt.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { Source } from "./packages/knowledge/src/common.ts";

/* ---- arguments ------------------------------------------------------------------------------ */
const args = process.argv.slice(2);
const JSON_OUT = args.includes("--json");
const BLOC_OUT = args.includes("--bloc");
const VERIFIER = args.includes("--verifier-dossier");
const CHEMIN_DOSSIER = (args.find((a) => a.startsWith("--dossier=")) || "--dossier=DOSSIER-ACHEVEMENT-PROJET.md").slice(10);
const asOf = (args.find((a) => a.startsWith("--as-of=")) || "").slice(8);

/* La date DOIT exister. `Date.parse` normalise « 2026-02-31 » en 3 mars au lieu de refuser : on
 * reconstruit en UTC et on exige l'égalité exacte année/mois/jour avec la chaîne. */
{
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOf);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  const existe = d && d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  if (!existe) {
    process.stderr.write(
      "[mesure] ÉCHEC : --as-of=AAAA-MM-JJ est OBLIGATOIRE et la date doit EXISTER.\n" +
      (asOf ? `[mesure] « ${asOf} » n'est pas un jour du calendrier.\n` : "") +
      "[mesure]   node --import tsx mesurer-achevement.mjs --as-of=2026-08-23\n");
    process.exit(2);
  }
}

const lire = (p) => JSON.parse(readFileSync(p, "utf-8"));
const jours = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
const compter = (xs) => xs.reduce((m, x) => (m[x] = (m[x] ?? 0) + 1, m), {});

/* ---- état du dépôt -------------------------------------------------------------------------- */
const git = (...a) => spawnSync("git", a, { encoding: "utf-8" });
const sha = git("rev-parse", "HEAD").stdout.trim();
const propre = git("status", "--porcelain", "-uall").stdout.trim() === "";
const nvmrc = readFileSync(".nvmrc", "utf-8").trim();

/* ---- guides : traductions ET originaux importés ---------------------------------------------- */
const RACINE = "packages/ui/src/content/guides";
const LANGUES = ["en", "fr", "es", "pt"];
const champ = (t, n) => (new RegExp(`^${n}:\\s*"([^"]*)"\\s*$`, "m").exec(t) || [])[1] ?? null;

const parCle = new Map();
for (const l of LANGUES) {
  for (const f of readdirSync(join(RACINE, l)).filter((x) => x.endsWith(".md"))) {
    const t = readFileSync(join(RACINE, l, f), "utf-8");
    const cle = champ(t, "key");
    if (!cle) continue;
    if (!parCle.has(cle)) parCle.set(cle, {});
    parCle.get(cle)[l] = { sourceUrl: champ(t, "sourceUrl") };
  }
}
/* Une traduction se reconnaît à son ORIGINE, pas à sa langue : sans `sourceUrl`, le texte est né
 * ici, donc traduit de l'anglais. Avec, c'est un original importé. */
const traductions = { fr: 0, es: 0, pt: 0 };
const importes = { fr: 0, es: 0, pt: 0 };
for (const v of parCle.values()) {
  for (const l of ["fr", "es", "pt"]) {
    if (!v[l]) continue;
    if (v[l].sourceUrl) importes[l]++; else traductions[l]++;
  }
}

/* ---- TOUTES les sources du référentiel, identités stables ------------------------------------ */
const empreinte = (s) => "h:" + createHash("sha256").update(String(s)).digest("hex").slice(0, 12);
/** L'URL qui identifie un élément de tableau : la sienne, ou celle de sa source imbriquée. */
const urlDe = (v) => (v && typeof v === "object")
  ? (typeof v.url === "string" ? v.url : (v.source && typeof v.source.url === "string" ? v.source.url : null))
  : null;
/** La clé stable d'un élément : son `id`, sinon l'empreinte de son URL — jointe à son `year`
 *  quand l'élément est un évènement daté, car deux évènements d'une même frise citent
 *  légitimement la même page (Air Canada 1937 et 1997 citent le même article Wikipédia). */
const cleDe = (v) => {
  if (v && typeof v === "object" && typeof v.id === "string") return v.id;
  const u = urlDe(v);
  if (u === null) return null;
  return typeof v.year === "number" ? empreinte(`${u}#${v.year}`) : empreinte(u);
};

let identitesInstables = 0;
function sourcesDatees(x, chemin, dansHistory = false) {
  if (Array.isArray(x)) {
    const resultats = [];
    const vues = new Set();
    for (let i = 0; i < x.length; i++) {
      const v = x[i];
      let cle = cleDe(v);
      const instable = cle === null || vues.has(cle);
      if (instable) cle = String(i);
      vues.add(cle);
      const sous = sourcesDatees(v, `${chemin}[${cle}]`, dansHistory);
      /* Un indice n'est une identité INSTABLE que s'il adresse quelque chose : seul un élément
       * dont le sous-arbre porte au moins une source datée entre au registre. Les milliers
       * d'éléments de tableaux sans source (tags, routes, alias) n'ont pas d'identité à perdre —
       * les compter noierait le signal. Le bloc contractuel fige ce compteur à sa valeur du jour
       * (0) : la première source rangée sous un élément sans `id` ni URL — ou sous une empreinte
       * en collision — fera échouer la concordance. */
      if (instable && sous.length) identitesInstables++;
      resultats.push(...sous);
    }
    return resultats;
  }
  if (x && typeof x === "object") {
    const resultats = [];
    if (typeof x.verified_date === "string") resultats.push({ chemin, source: x, dansHistory });
    for (const [k, v] of Object.entries(x)) {
      resultats.push(...sourcesDatees(v, `${chemin}.${k}`, dansHistory || k === "history"));
    }
    return resultats;
  }
  return [];
}

const objets = lire("packages/knowledge/raw/objects.json");
const regles = lire("packages/knowledge/raw/rules.json");

const toutes = [];
const archives = [];
const parFamille = {};
for (const [fam, contenu] of [...Object.entries(objets), ["rules", regles]]) {
  const trouvees = [...sourcesDatees(contenu, fam)].map((e) => ({ famille: fam, ...e }));
  const vivantes = trouvees.filter((e) => !e.dansHistory);
  archives.push(...trouvees.filter((e) => e.dansHistory));
  const items = Array.isArray(contenu) ? contenu : Object.values(contenu ?? {});
  parFamille[fam] = { objets: items.length, sources_datees: vivantes.length };
  toutes.push(...vivantes);
}

/* L'ARCHIVE EST UN CONTRAT DE CHEMIN, pas un mot-clé. Seul `airlines[*].premium.history[*]` est
 * une forme d'archive connue ; une source datée sous tout autre `history` serait sortie du
 * registre EN SILENCE par la simple présence du mot — c'est l'exclusion globale que la
 * contre-revue a refusée. */
const ARCHIVE_CONTRACTUELLE = /^airlines\[[^\]]+\]\.premium\.history\[/;
const archivesHorsContrat = archives.filter((e) => !ARCHIVE_CONTRACTUELLE.test(e.chemin));

/* LE SCHÉMA CANONIQUE, sur les vivantes ET les archives : hors registre n'est pas hors contrat.
 * L'entrée `history` d'une Source cite d'autres sources par `date` — un `ReviewEvent`, pas une
 * `Source` — et le schéma canonique le sait déjà. */
const invalides = [];
for (const e of [...toutes, ...archives]) {
  const r = Source.safeParse(e.source);
  if (!r.success) {
    const motifs = r.error.issues.map((i) => `${i.path.join(".") || "(racine)"} — ${i.code}`).join(" · ");
    invalides.push(`${e.chemin} : ${motifs}`);
  } else {
    /* La vue CANONIQUE de la source — ce que le schéma a validé — sert aux empreintes. */
    e.canonique = r.data;
  }
}

if (archivesHorsContrat.length || invalides.length) {
  if (archivesHorsContrat.length) {
    process.stderr.write(`[mesure] ÉCHEC — ${archivesHorsContrat.length} source(s) datée(s) sous un « history » HORS CONTRAT d'archive :\n`);
    for (const e of archivesHorsContrat.slice(0, 10)) process.stderr.write(`  ${e.chemin}\n`);
  }
  if (invalides.length) {
    process.stderr.write(`[mesure] ÉCHEC — ${invalides.length} source(s) rejetée(s) par le schéma canonique \`Source\` :\n`);
    for (const m of invalides.slice(0, 20)) process.stderr.write(`  ${m}\n`);
  }
  process.exit(1);
}

/* LE BLOC FIGE LE REGISTRE, PAS SEULEMENT LES AGRÉGATS. Contre-épreuve de Codex sur la v4 :
 * remplacer une URL par une autre URL valide de même type ne changeait aucun total, aucune
 * répartition, aucune classe d'auto-citation — la vérification sortait en 0 pendant qu'une source
 * métier était remplacée en silence. Le bloc porte donc l'EMPREINTE SHA-256 DU REGISTRE EXACT :
 * les objets `Source` CANONIQUES complets (la vue validée par le schéma) appariés à leur locator,
 * triés par locator, sérialisés en JSON canonique (clés ordonnées récursivement). Une empreinte
 * globale, une par famille — pour LOCALISER l'écart — et une, séparée, pour les 20 archives. */
const jsonCanonique = (x) => {
  if (Array.isArray(x)) return "[" + x.map(jsonCanonique).join(",") + "]";
  if (x && typeof x === "object") {
    return "{" + Object.keys(x).sort().map((k) => JSON.stringify(k) + ":" + jsonCanonique(x[k])).join(",") + "}";
  }
  return JSON.stringify(x);
};
const empreinteRegistre = (entrees) => createHash("sha256").update(jsonCanonique(
  entrees.slice().sort((a, b) => (a.chemin < b.chemin ? -1 : a.chemin > b.chemin ? 1 : 0))
    .map((e) => ({ locator: e.chemin, source: e.canonique }))
)).digest("hex");
const empreintesParFamille = Object.fromEntries(
  Object.keys(parFamille).map((f) => [f, empreinteRegistre(toutes.filter((e) => e.famille === f))])
);

/* L'AUTO-CITATION, au nom d'hôte parsé et non à la sous-chaîne. */
const estAutoCitee = (u) => {
  try {
    const h = new URL(String(u)).hostname.toLowerCase();
    return h === "mydogcanfly.com" || h.endsWith(".mydogcanfly.com");
  } catch { return false; }
};
const autocitees = toutes.filter(({ source }) => estAutoCitee(source.url));

/* ---- fraîcheur ------------------------------------------------------------------------------- */
const fraicheur = { echue: 0, moins_30j: 0, moins_90j: 0, plus_90j: 0 };
const echeances = [];
const octobre = {};
for (const { famille, source } of toutes) {
  echeances.push(source.review_due);
  if (String(source.review_due).startsWith("2026-10")) octobre[famille] = (octobre[famille] ?? 0) + 1;
  const j = jours(source.review_due, asOf);
  if (j < 0) fraicheur.echue++;
  else if (j < 30) fraicheur.moins_30j++;
  else if (j < 90) fraicheur.moins_90j++;
  else fraicheur.plus_90j++;
}
echeances.sort();

/* ---- pays, compagnies, couvertures, correspondances ------------------------------------------ */
const pays = Array.isArray(objets.countries) ? objets.countries : Object.values(objets.countries ?? {});
const paysSansSource = pays.filter((c) => !c.source);

const cies = lire("packages/ui/src/data/airlines.generated.json");
const legacy = {};
const ciesTouchees = new Set();
for (const [id, c] of Object.entries(cies)) {
  for (const [canal, p] of Object.entries(c.policies ?? {})) {
    if (p?.review_state === "legacy_unreviewed") { legacy[canal] = (legacy[canal] ?? 0) + 1; ciesTouchees.add(id); }
  }
}
const agesCies = Object.values(cies).filter((c) => c.verified_date)
  .map((c) => jours(asOf, c.verified_date)).sort((a, b) => a - b);

const couv = existsSync("couvertures-guides.json") ? lire("couvertures-guides.json").images : {};
const routes = lire("packages/knowledge/raw/collecte-2026-07/routes_FULL_strict.json");
const champsRoutes = [...new Set(Object.values(routes).flatMap((v) => Object.keys(v)))].sort();
const motsOperateur = ["codeshare", "operating_carrier", "marketing_carrier", "operated_by"];
const trouves = motsOperateur.filter((m) =>
  spawnSync("grep", ["-rql", m, "packages/engine/src", "packages/knowledge/src"], { encoding: "utf-8" }).status === 0);
const workflows = existsSync(".github/workflows") ? readdirSync(".github/workflows").sort() : [];
const catalogue = existsSync("contre-epreuves-attendues.json")
  ? lire("contre-epreuves-attendues.json").identifiants.length : null;

/* ---- LE BLOC CONTRACTUEL ---------------------------------------------------------------------
 * La projection EXCLUT ce qui varie sans que les données changent — SHA du commit, version de
 * Node, propreté de l'arbre — et fige tout le reste. C'est ce bloc, embarqué dans le dossier
 * entre marqueurs, que `--verifier-dossier` confronte au relevé recalculé, à égalité exacte. */
const bloc = {
  as_of: asOf,
  workflows,
  guides: {
    cles_logiques: parCle.size,
    par_langue: Object.fromEntries(LANGUES.map((l) => [l, [...parCle.values()].filter((v) => v[l]).length])),
    traductions_a_relire: traductions,
    originaux_importes: importes,
    traductions_total: Object.values(traductions).reduce((s, n) => s + n, 0),
  },
  couvertures: {
    images: Object.keys(couv).length,
    non_verifiees: Object.values(couv).filter((v) => v.verifie !== true).length,
  },
  referentiel: {
    sources_datees_total: toutes.length,
    archives_dans_history: archives.length,
    identites_instables: identitesInstables,
    empreinte_registre: empreinteRegistre(toutes),
    empreinte_par_famille: empreintesParFamille,
    empreinte_archives: empreinteRegistre(archives),
    par_famille: parFamille,
    par_type_de_source: compter(toutes.map(({ source }) => source.source_type)),
    par_confiance: compter(toutes.map(({ source }) => String(source.confidence))),
    autocitees: autocitees.length,
    autocitees_par_famille: compter(autocitees.map((e) => e.famille)),
    fraicheur,
    premiere_echeance: echeances[0] ?? null,
    derniere_echeance: echeances[echeances.length - 1] ?? null,
    echeances_par_mois: compter(echeances.map((d) => d.slice(0, 7))),
    octobre_2026_par_famille: octobre,
  },
  pays: {
    total: pays.length,
    avec_source_datee: pays.filter((c) => c.source?.verified_date).length,
    sans_source: paysSansSource.length,
    identites_sans_source: paysSansSource.map((c) => c.id).sort(),
  },
  compagnies: {
    total: Object.keys(cies).length,
    policies_legacy_unreviewed: legacy,
    policies_legacy_total: Object.values(legacy).reduce((s, n) => s + n, 0),
    compagnies_touchees: ciesTouchees.size,
    age_verification_jours: agesCies.length
      ? { min: agesCies[0], mediane: agesCies[Math.floor(agesCies.length / 2)], max: agesCies[agesCies.length - 1],
          au_dela_90j: agesCies.filter((a) => a > 90).length }
      : null,
  },
  correspondances: {
    compagnies_avec_routes: Object.keys(routes).length,
    champs_de_route: champsRoutes,
    marqueurs_operateur_trouves: trouves,
  },
  contre_epreuves: catalogue,
};

const DEBUT = "<!-- BLOC-CONTRACTUEL:debut -->";
const FIN = "<!-- BLOC-CONTRACTUEL:fin -->";

if (BLOC_OUT) {
  process.stdout.write(`${DEBUT}\n\`\`\`json\n${JSON.stringify(bloc, null, 2)}\n\`\`\`\n${FIN}\n`);
  process.exit(0);
}

/* ---- mode vérification : égalité EXACTE, dans les deux sens ---------------------------------- */
if (VERIFIER) {
  let dossier;
  try { dossier = readFileSync(CHEMIN_DOSSIER, "utf-8"); }
  catch { process.stderr.write(`[verif] ÉCHEC : dossier introuvable — ${CHEMIN_DOSSIER}\n`); process.exit(1); }

  /* Le bloc doit exister UNE fois. Deux blocs, c'est le doublon documentaire : l'un pourrait
   * être juste et l'autre faux, et un lecteur ne saurait pas lequel fait foi. */
  const occurrences = dossier.split(DEBUT).length - 1;
  if (occurrences !== 1) {
    process.stderr.write(`[verif] ÉCHEC — ${occurrences} bloc(s) contractuel(s) dans le dossier (attendu : exactement 1).\n`);
    process.exit(1);
  }
  const brut = dossier.split(DEBUT)[1].split(FIN)[0];
  const json = (/```json\n([\s\S]*?)\n```/.exec(brut) || [])[1];
  let declare;
  try { declare = JSON.parse(json); }
  catch { process.stderr.write("[verif] ÉCHEC — le bloc contractuel n'est pas un JSON lisible.\n"); process.exit(1); }

  /* Comparaison profonde, symétrique, chemins nommés. Trois classes d'écart : une valeur qui
   * diffère, une entrée que le bloc a en trop (ajoutée), une entrée qui lui manque (supprimée).
   * La quatrième classe — donnée source modifiée — passe par les deux premières : le relevé
   * recalculé ne correspond plus au bloc resté figé. */
  const ecarts = [];
  const compare = (a, b, chemin) => {   // a = bloc déclaré, b = relevé recalculé
    if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        ecarts.push(`valeur modifiée à ${chemin} : bloc ${JSON.stringify(a)} · relevé ${JSON.stringify(b)}`);
      }
      return;
    }
    if (Array.isArray(a) !== Array.isArray(b)) { ecarts.push(`nature différente à ${chemin}`); return; }
    const clesA = Array.isArray(a) ? a.map((_, i) => String(i)) : Object.keys(a);
    const clesB = Array.isArray(b) ? b.map((_, i) => String(i)) : Object.keys(b);
    for (const k of clesA) if (!clesB.includes(k)) ecarts.push(`entrée AJOUTÉE au bloc : ${chemin}.${k} = ${JSON.stringify(a[k])}`);
    for (const k of clesB) if (!clesA.includes(k)) ecarts.push(`entrée SUPPRIMÉE du bloc : ${chemin}.${k} (relevé : ${JSON.stringify(b[k])})`);
    for (const k of clesA) if (clesB.includes(k)) compare(a[k], b[k], `${chemin}.${k}`);
  };
  compare(declare, bloc, "bloc");

  if (ecarts.length === 0) {
    process.stdout.write("[verif] bloc contractuel unique, égal au relevé recalculé, dans les deux sens.\n");
    process.exit(0);
  }
  process.stderr.write(`[verif] ÉCHEC — ${ecarts.length} écart(s) entre le bloc contractuel et le relevé :\n`);
  for (const e of ecarts.slice(0, 20)) process.stderr.write(`  · ${e}\n`);
  process.stderr.write("[verif] Soit une donnée a bougé sous un dossier resté figé, soit le dossier a été altéré.\n");
  process.exit(1);
}

/* ---- sortie ----------------------------------------------------------------------------------- */
if (JSON_OUT) { process.stdout.write(JSON.stringify({ depot: { sha, arbre_propre: propre, nvmrc, node: process.version }, ...bloc }, null, 2) + "\n"); process.exit(0); }

const l = (m) => process.stdout.write(m + "\n");
l(`RELEVÉ AU ${asOf} — ${sha}`);
l(`arbre ${propre ? "PROPRE" : "MODIFIÉ"} · .nvmrc ${nvmrc} (plancher) · node ${process.version} · ${workflows.length} workflow(s)`);
l("");
l("GUIDES");
l(`  ${bloc.guides.cles_logiques} clés · ${JSON.stringify(bloc.guides.par_langue)}`);
l(`  traductions à relire : ${JSON.stringify(traductions)} — total ${bloc.guides.traductions_total} · importés ${JSON.stringify(importes)}`);
l("");
l("COUVERTURES");
l(`  ${bloc.couvertures.images} images · ${bloc.couvertures.non_verifiees} non vérifiées (dette acceptée)`);
l("");
l("RÉFÉRENTIEL — schéma canonique Source appliqué aux 1 505 vivantes ET aux archives");
l(`  ${bloc.referentiel.sources_datees_total} sources VIVANTES (+ ${archives.length} archives contractuelles, hors registre) · identités instables : ${identitesInstables}`);
l(`  empreinte du registre : ${bloc.referentiel.empreinte_registre}`);
l(`  empreinte des archives : ${bloc.referentiel.empreinte_archives}`);
for (const [f, v] of Object.entries(parFamille)) l(`    ${f.padEnd(12)} ${String(v.objets).padStart(4)} objets · ${String(v.sources_datees).padStart(5)} source(s)`);
l(`  types : ${JSON.stringify(bloc.referentiel.par_type_de_source)}`);
l(`  AUTO-CITÉES (au nom d'hôte) : ${bloc.referentiel.autocitees} — ${JSON.stringify(bloc.referentiel.autocitees_par_famille)}`);
l(`  fraîcheur : ${JSON.stringify(fraicheur)}`);
l(`  de ${bloc.referentiel.premiere_echeance} à ${bloc.referentiel.derniere_echeance}`);
l(`  par mois : ${JSON.stringify(bloc.referentiel.echeances_par_mois)}`);
l(`  octobre 2026 : ${JSON.stringify(octobre)}`);
l("");
l("PAYS");
l(`  ${bloc.pays.total} · ${bloc.pays.avec_source_datee} avec source datée · ${bloc.pays.sans_source} SANS AUCUNE SOURCE`);
l(`  sans source : ${bloc.pays.identites_sans_source.join(", ")}`);
l("");
l("COMPAGNIES");
l(`  ${bloc.compagnies.total} · legacy_unreviewed ${JSON.stringify(legacy)} = ${bloc.compagnies.policies_legacy_total} sur ${ciesTouchees.size} compagnies`);
l(`  âge de vérification : ${JSON.stringify(bloc.compagnies.age_verification_jours)}`);
l("");
l("CORRESPONDANCES");
l(`  ${bloc.correspondances.compagnies_avec_routes} compagnies · champs ${JSON.stringify(champsRoutes)}`);
l(`  marqueurs commercialisateur/opérateur : ${trouves.length ? trouves.join(", ") : "AUCUN"}`);
l("");
l(`CONTRE-ÉPREUVES au catalogue : ${catalogue}`);
