#!/usr/bin/env node
/**
 * Le REGISTRE EXACT du routage Pages — scellé à trois niveaux (conception porte v6, P0-2).
 *
 *   node porte-sceller-routage.mjs --dist=packages/ui/dist              vérifie contre le scellé
 *   node porte-sceller-routage.mjs --dist=packages/ui/dist --ecrire     (re)scelle — mouvement nommé
 *
 * Trois niveaux, parce que chacun voit ce que les autres ne voient pas :
 *   a. la représentation canonique EXACTE de `_routes.json` (include/exclude, ordonnés) —
 *      une exclusion troquée contre une autre à effectif constant ne passe pas ;
 *   b. le registre canonique des RÈGLES parsées, par famille (redirections statiques de
 *      `_redirects` ; LEGACY_REDIRECTS 301 ; GONE_EXACT 410 ; GONE_PREFIXES 410 ; le mapping
 *      dynamique chaleur/races et l'alias presskit sont des FONCTIONS, donc couverts par c) —
 *      les diagnostics restent lisibles et le diff approuvable ;
 *   c. l'empreinte SHA-256 de chacun des trois fichiers du dist (`_routes.json`, `_redirects`,
 *      `_worker.js`) — aucune logique dynamique (heatRaceTarget, presskitTarget…) ne change
 *      hors d'un rescellement nommé, quelles que soient les tables.
 * Les décomptes DÉRIVENT du registre : ils ne tiennent jamais seuls (« agrégats exacts,
 * registre non figé » est la classe de faute que ce fichier interdit).
 *
 * Le registre se scelle depuis un DIST (l'artefact que la porte juge), jamais depuis les
 * sources : la porte ne lit que ce qui sera publié. La cohérence sources ↔ registre vit dans
 * test-registre-routage-sources.mjs (test:unit), séparée et nommée.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

export const FICHIER_SCELLE = "porte-routage-scelle.json";
export const SCHEMA_ROUTAGE = 1;

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

/** Canonisation : clés triées, récursif — la même que partout dans le dépôt. */
const canon = (v) => Array.isArray(v) ? v.map(canon)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
  : v;
export const cjson = (v) => JSON.stringify(canon(v));

/* ---- Parseurs — LA seule analyse du routage du dépôt : la porte les importe d'ici ---------- */

/** `_redirects` : lignes « source cible [statut] », commentaires # et vides ignorés. */
export function parserRedirects(texte) {
  const regles = [];
  for (const brute of texte.split("\n")) {
    const ligne = brute.trim();
    if (!ligne || ligne.startsWith("#")) continue;
    const morceaux = ligne.split(/\s+/);
    if (morceaux.length < 2) { regles.push({ source: ligne, cible: null, statut: null, malformee: true }); continue; }
    const [source, cible, statut] = morceaux;
    regles.push({ source, cible, statut: statut ? Number(statut) : 302 });
  }
  return regles;
}

/**
 * `_worker.js` : les TABLES vivent entre les marqueurs LEGACY-DATA-START/END, générées par
 * map-legacy-urls.mjs — c'est ce bloc que l'on parse, pas le code libre. Trois structures :
 * LEGACY_REDIRECTS (Map de paires), GONE_EXACT (Set de chaînes), GONE_PREFIXES (tableau).
 * Le code dynamique hors tables est couvert par l'empreinte du fichier (niveau c).
 */
export function parserWorker(texte) {
  const debut = texte.indexOf(">>> LEGACY-DATA-START");
  const fin = texte.indexOf("LEGACY-DATA-END");
  if (debut === -1 || fin === -1 || fin <= debut) {
    throw new Error("_worker.js : marqueurs LEGACY-DATA-START/END introuvables — le bloc de tables a bougé, le parseur doit être revu AVEC un rescellement nommé");
  }
  const bloc = texte.slice(debut, fin);

  const extraireTableau = (nom, contenu) => {
    const m = contenu.match(new RegExp(`const ${nom}\\s*=\\s*(?:new\\s+(?:Map|Set)\\()?\\[`));
    if (!m) throw new Error(`_worker.js : « const ${nom} » introuvable dans le bloc de tables`);
    let i = contenu.indexOf("[", m.index);
    let profondeur = 0, j = i;
    for (; j < contenu.length; j++) {
      if (contenu[j] === "[") profondeur++;
      else if (contenu[j] === "]") { profondeur--; if (profondeur === 0) break; }
    }
    if (profondeur !== 0) throw new Error(`_worker.js : tableau ${nom} non refermé`);
    /* Le littéral extrait ne contient que chaînes, tableaux et virgules — JSON après
       normalisation des virgules terminales. Tout échec de parse est BLOQUANT et nommé. */
    const litteral = contenu.slice(i, j + 1).replace(/,\s*([\]}])/g, "$1");
    try { return JSON.parse(litteral); }
    catch (e) { throw new Error(`_worker.js : tableau ${nom} illisible en JSON strict — ${e.message}`); }
  };

  const paires = extraireTableau("LEGACY_REDIRECTS", bloc);
  const gone = extraireTableau("GONE_EXACT", bloc);
  const prefixes = extraireTableau("GONE_PREFIXES", texte); /* hors bloc marqué, mais table pure */
  return {
    legacy_redirects: paires.map(([source, cible]) => ({ source, cible })),
    gone_exact: gone.map((source) => ({ source })),
    gone_prefixes: prefixes.map((source) => ({ source })),
  };
}

/** Lit les trois pièces du routage D'UN DIST et rend la structure canonique + les empreintes. */
export function lireRoutage(dist) {
  const chemins = {
    routes: join(dist, "_routes.json"),
    redirects: join(dist, "_redirects"),
    worker: join(dist, "_worker.js"),
  };
  for (const [nom, p] of Object.entries(chemins)) {
    if (!existsSync(p)) throw new Error(`${p} absent : le dist ne porte pas sa pièce de routage « ${nom} »`);
  }
  const textes = {
    routes: readFileSync(chemins.routes, "utf8"),
    redirects: readFileSync(chemins.redirects, "utf8"),
    worker: readFileSync(chemins.worker, "utf8"),
  };
  const routes = JSON.parse(textes.routes);
  return {
    schema: SCHEMA_ROUTAGE,
    routes: { version: routes.version, include: routes.include, exclude: routes.exclude },
    familles: {
      redirects_statiques: parserRedirects(textes.redirects),
      ...parserWorker(textes.worker),
    },
    empreintes_fichiers: {
      "_routes.json": sha256(textes.routes),
      "_redirects": sha256(textes.redirects),
      "_worker.js": sha256(textes.worker),
    },
  };
}

/** Empreintes dérivées (globale + par famille) — TOUJOURS recalculées depuis les règles. */
export function empreintesDe(routage) {
  const parFamille = {};
  for (const [famille, regles] of Object.entries(routage.familles)) parFamille[famille] = sha256(cjson(regles));
  return { globale: sha256(cjson(routage)), par_famille: parFamille };
}

/**
 * Compare un dist au registre scellé. Renvoie la liste des écarts, chacun NOMMÉ (fichier,
 * famille, règle) — jamais un simple décompte.
 */
export function comparerAuScelle(dist, scelle) {
  const ecarts = [];
  let vivant;
  try { vivant = lireRoutage(dist); }
  catch (e) { return [String(e.message)]; }

  if (scelle.schema !== SCHEMA_ROUTAGE) return [`registre au schéma ${scelle.schema}, attendu ${SCHEMA_ROUTAGE} — resceller plutôt qu'interpréter`];

  /* c. Les empreintes des trois fichiers — le niveau qui voit le code dynamique. */
  for (const [f, h] of Object.entries(scelle.empreintes_fichiers)) {
    if (vivant.empreintes_fichiers[f] !== h) {
      ecarts.push(`${f} : empreinte ${vivant.empreintes_fichiers[f]?.slice(0, 12)}… ≠ scellée ${h.slice(0, 12)}… — le fichier a changé hors rescellement nommé`);
    }
  }
  /* a. _routes.json, représentation canonique exacte. */
  if (cjson(vivant.routes) !== cjson(scelle.routes)) {
    const vi = new Set(vivant.routes.include), si = new Set(scelle.routes.include);
    const ve = new Set(vivant.routes.exclude), se = new Set(scelle.routes.exclude);
    for (const x of vi) if (!si.has(x)) ecarts.push(`_routes.json : include « ${x} » absent du scellé`);
    for (const x of si) if (!vi.has(x)) ecarts.push(`_routes.json : include scellé « ${x} » absent du dist`);
    for (const x of ve) if (!se.has(x)) ecarts.push(`_routes.json : exclude « ${x} » absent du scellé`);
    for (const x of se) if (!ve.has(x)) ecarts.push(`_routes.json : exclude scellé « ${x} » absent du dist`);
    if (![...vi, ...ve].some((x) => !si.has(x) && !se.has(x)) && vi.size === si.size && ve.size === se.size
      && [...si].every((x) => vi.has(x)) && [...se].every((x) => ve.has(x))) {
      ecarts.push("_routes.json : mêmes ensembles mais représentation différente (ordre/champs) — resceller pour approuver la nouvelle forme");
    }
  }
  /* b. Les règles, famille par famille, dans les DEUX sens. */
  for (const famille of new Set([...Object.keys(scelle.familles), ...Object.keys(vivant.familles)])) {
    const s = scelle.familles[famille], v = vivant.familles[famille];
    if (!s) { ecarts.push(`famille « ${famille} » présente au dist, absente du scellé`); continue; }
    if (!v) { ecarts.push(`famille « ${famille} » scellée, absente du dist`); continue; }
    const cle = (r) => cjson(r);
    const sSet = new Map(s.map((r) => [cle(r), r]));
    const vSet = new Map(v.map((r) => [cle(r), r]));
    for (const [k, r] of vSet) if (!sSet.has(k)) ecarts.push(`${famille} : règle du dist hors scellé — ${JSON.stringify(r)}`);
    for (const [k, r] of sSet) if (!vSet.has(k)) ecarts.push(`${famille} : règle scellée absente du dist — ${JSON.stringify(r)}`);
  }
  return ecarts;
}

/* ---- CLI ------------------------------------------------------------------------------------ */
const estCli = import.meta.url === new URL(`file://${process.argv[1]}`).href
  || process.argv[1]?.endsWith("porte-sceller-routage.mjs");
if (estCli) {
  const args = process.argv.slice(2);
  const ECRIRE = args.includes("--ecrire");
  const distArg = args.find((a) => a.startsWith("--dist="));
  const dist = distArg ? distArg.slice(7) : "packages/ui/dist";
  const inconnus = args.filter((a) => a !== "--ecrire" && !a.startsWith("--dist="));
  if (inconnus.length) { console.error(`[routage] argument(s) non reconnu(s) : ${inconnus.join(", ")}`); process.exit(2); }

  if (ECRIRE) {
    const routage = lireRoutage(dist);
    const empreintes = empreintesDe(routage);
    writeFileSync(FICHIER_SCELLE, JSON.stringify({ ...routage, empreintes }, null, 2) + "\n");
    const n = Object.fromEntries(Object.entries(routage.familles).map(([f, r]) => [f, r.length]));
    console.error(`[routage] scellé RÉGÉNÉRÉ depuis ${dist} : ${JSON.stringify(n)} · globale ${empreintes.globale.slice(0, 16)}… — le diff du scellé porte le mouvement, la PR le montre`);
  } else {
    if (!existsSync(FICHIER_SCELLE)) { console.error(`[routage] ${FICHIER_SCELLE} absent — « --ecrire » le déposera`); process.exit(1); }
    const scelle = JSON.parse(readFileSync(FICHIER_SCELLE, "utf8"));
    const ecarts = comparerAuScelle(dist, scelle);
    if (ecarts.length) {
      for (const e of ecarts) console.error(`  ÉCART ${e}`);
      console.error(`[routage] ÉCHEC — ${ecarts.length} écart(s) entre ${dist} et le scellé`);
      process.exit(1);
    }
    console.error(`[routage] scellé tenu : le routage du dist est exactement celui approuvé (globale ${empreintesDe(lireRoutage(dist)).globale.slice(0, 16)}…)`);
  }
}
