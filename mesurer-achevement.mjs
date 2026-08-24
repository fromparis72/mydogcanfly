#!/usr/bin/env node
/**
 * mesurer-achevement.mjs — l'annexe reproductible du DOSSIER-ACHEVEMENT-PROJET.
 *
 *   node mesurer-achevement.mjs --as-of=2026-08-23              relevé lisible
 *   node mesurer-achevement.mjs --as-of=2026-08-23 --json       le même, exploitable
 *   node mesurer-achevement.mjs --as-of=2026-08-23 --verifier-dossier
 *                                                               CONFRONTE le dossier au relevé
 *
 * POURQUOI UN MODE DE VÉRIFICATION. La version précédente calculait un relevé et l'affichait ;
 * la concordance avec le dossier était vérifiée À CÔTÉ, dans un shell, et annoncée « 19 contrôles,
 * zéro écart ». Ces contrôles n'existaient dans aucun des deux fichiers livrés : modifier un
 * chiffre du Markdown laissait tout sortir en 0. Une vérification qui ne vit pas dans le livrable
 * n'est pas une vérification — c'est un souvenir. `--verifier-dossier` exécute des contrôles
 * BLOQUANTS, chacun avec son diagnostic nommé, et sort en 1 au premier écart. `--dossier=<chemin>`
 * permet de le pointer sur une copie — c'est ce que fait la contre-épreuve, qui altère une valeur
 * et exige la sortie 1.
 *
 * LA DATE EST VALIDÉE POUR DE VRAI. `--as-of=2026-02-31` passait : `Date.parse` NORMALISE les
 * dates impossibles au lieu de les refuser, et le relevé sortait daté du 31 février. La date est
 * désormais reconstruite en UTC puis confrontée champ à champ — année, mois, jour — à la chaîne
 * fournie. « 2026-02-31 », « 2026-13-01 » et un 29 février d'année non bissextile sortent en 2.
 *
 * LA FORME `Source` EST EXIGÉE, PAS SEULEMENT RENCONTRÉE. Le parcours générique comptait comme
 * source toute structure portant un `verified_date` : une future métadonnée qui n'en serait pas
 * une aurait été comptée sans bruit. Chaque objet trouvé doit désormais porter `url`,
 * `source_type` et `review_due` ; un manquement est BLOQUANT et nommé par son chemin. Chaque
 * source reçoit d'ailleurs une identité de chemin stable — `airlines[airline_aegean].policies.
 * cargo` — qui servira de clé au registre du lot B.
 *
 * L'AUTO-CITATION SE JUGE AU NOM D'HÔTE. `includes("mydogcanfly")` attraperait aussi
 * `example.com/mydogcanfly-review` et raterait un déguisement. L'URL est parsée ; est auto-citée
 * une source dont l'hôte est `mydogcanfly.com` ou l'un de ses sous-domaines. Les deux mesures
 * coïncident aujourd'hui (226) — c'est le bon moment pour durcir : aucun écart à expliquer.
 *
 * IL NE CORRIGE RIEN. Il lit, il compte, il n'écrit aucun fichier du dépôt.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { URL } from "node:url";

/* ---- arguments ------------------------------------------------------------------------------ */
const args = process.argv.slice(2);
const JSON_OUT = args.includes("--json");
const VERIFIER = args.includes("--verifier-dossier");
const CHEMIN_DOSSIER = (args.find((a) => a.startsWith("--dossier=")) || "--dossier=DOSSIER-ACHEVEMENT-PROJET.md").slice(10);
const asOf = (args.find((a) => a.startsWith("--as-of=")) || "").slice(8);

/* La date DOIT exister. `Date.parse` normalise « 2026-02-31 » en 3 mars au lieu de refuser : on
 * reconstruit donc la date en UTC et on exige l'égalité exacte année/mois/jour avec la chaîne. */
{
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOf);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  const existe = d && d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  if (!existe) {
    process.stderr.write(
      "[mesure] ÉCHEC : --as-of=AAAA-MM-JJ est OBLIGATOIRE et la date doit EXISTER.\n" +
      (asOf ? `[mesure] « ${asOf} » n'est pas un jour du calendrier.\n` : "") +
      "[mesure]   node mesurer-achevement.mjs --as-of=2026-08-23\n");
    process.exit(2);
  }
}

const lire = (p) => JSON.parse(readFileSync(p, "utf-8"));
const jours = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);
const compter = (xs) => xs.reduce((m, x) => (m[x] = (m[x] ?? 0) + 1, m), {});
/* Milliers à la française — le dossier écrit « 1 525 », pas « 1525 ». */
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ").replace(/ /g, " ");

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

/* ---- TOUTES les sources du référentiel, avec identité de chemin ------------------------------ */
/**
 * Parcourt une structure et rend chaque objet portant `verified_date`, avec un CHEMIN STABLE —
 * `airlines[airline_aegean].policies.cargo` — destiné à servir de clé au registre du lot B.
 * Les tableaux sont adressés par l'`id` de l'élément quand il existe, par l'indice sinon.
 */
function* sourcesDatees(x, chemin, dansHistory = false) {
  if (Array.isArray(x)) {
    for (let i = 0; i < x.length; i++) {
      const v = x[i];
      const cle = (v && typeof v === "object" && typeof v.id === "string") ? v.id : String(i);
      yield* sourcesDatees(v, `${chemin}[${cle}]`, dansHistory);
    }
    return;
  }
  if (x && typeof x === "object") {
    if (typeof x.verified_date === "string") yield { chemin, source: x, dansHistory };
    for (const [k, v] of Object.entries(x)) {
      /* `history` porte des instantanés PASSÉS de la même politique — 20 aujourd'hui, tous sous
       * `airlines[*].premium.history[]`, supplantés par la source vivante du même objet. Les
       * compter dans la charge de revue reviendrait à réviser des archives immuables, et le même
       * `review_due` y serait compté deux fois. Ils sont donc SÉPARÉS du registre vivant — mais
       * comptés et nommés, jamais tus : une exclusion silencieuse est une mesure qu'on ne peut
       * plus contester. */
      yield* sourcesDatees(v, `${chemin}.${k}`, dansHistory || k === "history");
    }
  }
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

/* LA FORME EST EXIGÉE. Un `verified_date` sans `url`, `source_type` ou `review_due` n'est pas une
 * source : c'est une métadonnée qui en a l'air, et la compter fausserait tous les totaux. */
const OBLIGATOIRES = ["url", "source_type", "review_due"];
const formesIncompletes = [];
for (const { famille, chemin, source } of toutes) {
  const absents = OBLIGATOIRES.filter((c) => !source[c]);
  if (absents.length) formesIncompletes.push(`${chemin} : sans ${absents.join(", ")}`);
}

/* L'AUTO-CITATION, au nom d'hôte et non à la sous-chaîne. */
const estAutoCitee = (u) => {
  try {
    const h = new URL(String(u)).hostname.toLowerCase();
    return h === "mydogcanfly.com" || h.endsWith(".mydogcanfly.com");
  } catch { return false; }
};
const urlsImparsables = toutes.filter(({ source }) => {
  try { new URL(String(source.url)); return false; } catch { return true; }
});
const autocitees = toutes.filter(({ source }) => estAutoCitee(source.url));

/* ---- fraîcheur ------------------------------------------------------------------------------- */
const fraicheur = { echue: 0, moins_30j: 0, moins_90j: 0, plus_90j: 0, sans_review_due: formesIncompletes.length ? undefined : 0 };
const echeances = [];
const octobre = {};
for (const { famille, source } of toutes) {
  if (!source.review_due) continue;
  echeances.push(source.review_due);
  if (String(source.review_due).startsWith("2026-10")) octobre[famille] = (octobre[famille] ?? 0) + 1;
  const j = jours(source.review_due, asOf);
  if (j < 0) fraicheur.echue++;
  else if (j < 30) fraicheur.moins_30j++;
  else if (j < 90) fraicheur.moins_90j++;
  else fraicheur.plus_90j++;
}
fraicheur.sans_review_due = toutes.length - echeances.length;
echeances.sort();

/* ---- pays ------------------------------------------------------------------------------------- */
const pays = Array.isArray(objets.countries) ? objets.countries : Object.values(objets.countries ?? {});
const paysSansSource = pays.filter((c) => !c.source);
const paysDates = pays.filter((c) => c.source?.verified_date);

/* ---- compagnies ------------------------------------------------------------------------------- */
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

/* ---- couvertures, correspondances, workflows -------------------------------------------------- */
const couv = existsSync("couvertures-guides.json") ? lire("couvertures-guides.json").images : {};
const routes = lire("packages/knowledge/raw/collecte-2026-07/routes_FULL_strict.json");
const champsRoutes = [...new Set(Object.values(routes).flatMap((v) => Object.keys(v)))].sort();
const motsOperateur = ["codeshare", "operating_carrier", "marketing_carrier", "operated_by"];
const trouves = motsOperateur.filter((m) =>
  spawnSync("grep", ["-rql", m, "packages/engine/src", "packages/knowledge/src"], { encoding: "utf-8" }).status === 0);
const workflows = existsSync(".github/workflows") ? readdirSync(".github/workflows").sort() : [];
const catalogue = existsSync("contre-epreuves-attendues.json")
  ? lire("contre-epreuves-attendues.json").identifiants.length : null;

const releve = {
  as_of: asOf,
  depot: { sha, arbre_propre: propre, nvmrc, node: process.version, workflows },
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
    total_avec_archives: toutes.length + archives.length,
    formes_incompletes: formesIncompletes,
    urls_imparsables: urlsImparsables.map((e) => e.chemin),
    par_famille: parFamille,
    par_type_de_source: compter(toutes.map(({ source }) => source.source_type ?? "(absent)")),
    par_confiance: compter(toutes.map(({ source }) => String(source.confidence ?? "(absente)"))),
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
    avec_source_datee: paysDates.length,
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

/* Une forme incomplète est BLOQUANTE : les totaux ci-dessus seraient faussés par sa présence. */
if (formesIncompletes.length) {
  process.stderr.write(`[mesure] ÉCHEC — ${formesIncompletes.length} objet(s) portent un « verified_date » SANS la forme Source complète :\n`);
  for (const m of formesIncompletes.slice(0, 20)) process.stderr.write(`  ${m}\n`);
  process.exit(1);
}

/* ---- mode vérification : le dossier CONTRE le relevé ----------------------------------------- */
if (VERIFIER) {
  /* Chaque contrôle cherche dans le Markdown un fragment CONSTRUIT depuis le relevé. Si la donnée
   * bouge, le fragment calculé ne se retrouve plus dans le dossier resté en arrière — écart. Si le
   * dossier est altéré, le fragment calculé ne s'y retrouve plus non plus — écart. Les deux sens
   * du même défaut, un seul mécanisme. */
  const R = releve;
  const controles = [
    ["total des sources datées", `**${fmt(R.referentiel.sources_datees_total)} sources datées**`],
    ["titre P0-2 (auto-citées / total)", `**${R.referentiel.autocitees} sources auto-citées sur ${fmt(R.referentiel.sources_datees_total)}**`],
    ["famille airlines", `| \`airlines\` | ${R.referentiel.par_famille.airlines.objets} | **${R.referentiel.par_famille.airlines.sources_datees}** | **${R.referentiel.autocitees_par_famille.airlines}** |`],
    ["famille airports", `| \`airports\` | ${R.referentiel.par_famille.airports.objets} | ${R.referentiel.par_famille.airports.sources_datees} | 0 |`],
    ["famille breeds", `| \`breeds\` | ${R.referentiel.par_famille.breeds.objets} | ${R.referentiel.par_famille.breeds.sources_datees} | 0 |`],
    ["famille countries", `| \`countries\` | ${R.pays.total} | ${R.pays.avec_source_datee} | **${R.referentiel.autocitees_par_famille.countries}** |`],
    ["famille rules", `| \`rules\` | ${R.referentiel.par_famille.rules.objets} | **${R.referentiel.par_famille.rules.sources_datees}** | **${R.referentiel.autocitees_par_famille.rules}** |`],
    ["type official_website", `| \`official_website\` | ${R.referentiel.par_type_de_source.official_website} |`],
    ["type other", `| \`other\` | ${R.referentiel.par_type_de_source.other} |`],
    ["type government", `| \`government\` | ${R.referentiel.par_type_de_source.government} |`],
    ["fraîcheur sous 90 j", `| sous 90 jours | **${R.referentiel.fraicheur.moins_90j}** |`],
    ["fraîcheur au-delà", `| au-delà | ${R.referentiel.fraicheur.plus_90j} |`],
    ["vague d'octobre", `**${R.referentiel.octobre_2026_par_famille.airlines}** \`airlines\` et **${R.referentiel.octobre_2026_par_famille.rules}** \`rules\``],
    ["première échéance", `**${R.referentiel.premiere_echeance.split("-").reverse().join("/")}**`],
    ["pays sourcés / sans source", `**${R.pays.avec_source_datee} pays sur ${R.pays.total} portent une source datée. Les ${R.pays.sans_source} autres n'ont AUCUNE source**`],
    ["traductions totales", `| **total à relire** | **${R.guides.traductions_total}** |`],
    ["originaux français importés", `| fr | **${R.guides.traductions_a_relire.fr}** | ${R.guides.originaux_importes.fr} |`],
    ["politiques legacy", `**${R.compagnies.policies_legacy_total}**, sur **${R.compagnies.compagnies_touchees} compagnies sur ${R.compagnies.total}**`],
    ["fret legacy", `| \`cargo\` | **${R.compagnies.policies_legacy_unreviewed.cargo}** |`],
    ["catalogue de contre-épreuves", `**${R.contre_epreuves}**, bijection exacte`],
    ...R.pays.identites_sans_source.map((id) => [`pays sans source « ${id} »`, `\`${id}\``]),
  ];

  let dossier;
  try { dossier = readFileSync(CHEMIN_DOSSIER, "utf-8"); }
  catch { process.stderr.write(`[verif] ÉCHEC : dossier introuvable — ${CHEMIN_DOSSIER}\n`); process.exit(1); }

  const ecarts = [];
  for (const [nom, fragment] of controles) {
    if (!dossier.includes(fragment)) ecarts.push([nom, fragment]);
  }
  if (ecarts.length === 0) {
    process.stdout.write(`[verif] ${controles.length} contrôles de concordance : le dossier dit ce que le relevé mesure.\n`);
    process.exit(0);
  }
  process.stderr.write(`[verif] ÉCHEC — ${ecarts.length} écart(s) entre le dossier et le relevé :\n`);
  for (const [nom, fragment] of ecarts) {
    process.stderr.write(`  · ${nom} : le dossier ne contient pas « ${fragment} »\n`);
  }
  process.stderr.write("[verif] Soit la donnée a bougé et le dossier est resté en arrière, soit le dossier a été altéré.\n");
  process.exit(1);
}

/* ---- sortie ----------------------------------------------------------------------------------- */
if (JSON_OUT) { process.stdout.write(JSON.stringify(releve, null, 2) + "\n"); process.exit(0); }

const l = (m) => process.stdout.write(m + "\n");
l(`RELEVÉ AU ${asOf} — ${sha}`);
l(`arbre ${propre ? "PROPRE" : "MODIFIÉ"} · .nvmrc ${nvmrc} · node ${process.version} · ${workflows.length} workflow(s)`);
l("");
l("GUIDES");
l(`  ${releve.guides.cles_logiques} clés · ${JSON.stringify(releve.guides.par_langue)}`);
l(`  traductions à relire : ${JSON.stringify(traductions)} — total ${releve.guides.traductions_total} · importés ${JSON.stringify(importes)}`);
l("");
l("COUVERTURES");
l(`  ${releve.couvertures.images} images · ${releve.couvertures.non_verifiees} non vérifiées (dette acceptée)`);
l("");
l("RÉFÉRENTIEL — TOUTES SOURCES DATÉES (forme Source complète exigée)");
l(`  ${releve.referentiel.sources_datees_total} sources VIVANTES (+ ${archives.length} archives dans history, hors registre) · formes incomplètes : ${formesIncompletes.length} · URL imparsables : ${urlsImparsables.length}`);
for (const [f, v] of Object.entries(parFamille)) l(`    ${f.padEnd(12)} ${String(v.objets).padStart(4)} objets · ${String(v.sources_datees).padStart(5)} source(s)`);
l(`  types : ${JSON.stringify(releve.referentiel.par_type_de_source)}`);
l(`  AUTO-CITÉES (au nom d'hôte) : ${releve.referentiel.autocitees} — ${JSON.stringify(releve.referentiel.autocitees_par_famille)}`);
l(`  fraîcheur : ${JSON.stringify(fraicheur)}`);
l(`  de ${releve.referentiel.premiere_echeance} à ${releve.referentiel.derniere_echeance}`);
l(`  par mois : ${JSON.stringify(releve.referentiel.echeances_par_mois)}`);
l(`  octobre 2026 : ${JSON.stringify(octobre)}`);
l("");
l("PAYS");
l(`  ${releve.pays.total} · ${releve.pays.avec_source_datee} avec source datée · ${releve.pays.sans_source} SANS AUCUNE SOURCE`);
l(`  sans source : ${releve.pays.identites_sans_source.join(", ")}`);
l("");
l("COMPAGNIES");
l(`  ${releve.compagnies.total} · legacy_unreviewed ${JSON.stringify(legacy)} = ${releve.compagnies.policies_legacy_total} sur ${ciesTouchees.size} compagnies`);
l(`  âge de vérification : ${JSON.stringify(releve.compagnies.age_verification_jours)}`);
l("");
l("CORRESPONDANCES");
l(`  ${releve.correspondances.compagnies_avec_routes} compagnies · champs ${JSON.stringify(champsRoutes)}`);
l(`  marqueurs commercialisateur/opérateur : ${trouves.length ? trouves.join(", ") : "AUCUN"}`);
l("");
l(`CONTRE-ÉPREUVES au catalogue : ${catalogue}`);
