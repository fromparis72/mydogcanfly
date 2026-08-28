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
export const SCHEMA_ROUTAGE = 2;

/**
 * LA FORME EXIGÉE DU SCELLÉ — et pourquoi elle est exigée CHAMP PAR CHAMP.
 *
 * Contre-revue Codex du 28/08/2026 (P0-2), attaque REPRODUITE avant d'être fermée : retirer
 * « _worker.js » de `empreintes_fichiers`, recalculer les empreintes dérivées, puis modifier le
 * code dynamique du Worker — `comparerAuScelle` rendait 0 écart. La cause n'était pas une
 * comparaison fausse : c'est que le niveau (c) ne parcourait QUE les empreintes PRÉSENTES dans
 * le scellé. Un contrôle dont le périmètre est dicté par la pièce qu'il contrôle ne contrôle
 * rien — même classe de faux vert que « l'entrée vide produit le condensé du vide », fermée
 * dans provenance.mjs.
 *
 * Trois verrous, et le schéma passe donc à 2 :
 *   · les CLÉS sont exactes — ni absente (le contrôle disparaîtrait), ni supplémentaire (un
 *     champ inconnu dit que ce validateur n'est pas celui qui a scellé) ;
 *   · les trois empreintes de fichiers sont EXIGÉES nommément, quelles que soient les clés du
 *     scellé ;
 *   · les empreintes DÉRIVÉES sont recalculées depuis le scellé et confrontées : un registre
 *     dont la globale ne correspond plus à son propre contenu est refusé.
 */
export const FICHIERS_ROUTAGE = ["_routes.json", "_redirects", "_worker.js"];
export const FAMILLES_ROUTAGE = ["redirects_statiques", "legacy_redirects", "gone_exact", "gone_prefixes"];
const CLES_SCELLE = ["schema", "routes", "familles", "empreintes_fichiers", "empreintes"];
const CLES_ROUTES = ["version", "include", "exclude"];

/** La forme du scellé, contrôlée avant toute comparaison. Rend la liste des écarts. */
export function verifierFormeScelle(scelle) {
  const ecarts = [];
  if (!scelle || typeof scelle !== "object" || Array.isArray(scelle)) return ["le registre scellé n'est pas un objet"];
  const exact = (vues, attendues, ou) => {
    for (const k of attendues) if (!vues.includes(k)) ecarts.push(`${ou} : champ « ${k} » ABSENT du registre scellé — un contrôle dont le périmètre est dicté par la pièce contrôlée ne contrôle rien`);
    for (const k of vues) if (!attendues.includes(k)) ecarts.push(`${ou} : champ « ${k} » inconnu au registre scellé — ce validateur n'est pas celui qui a scellé`);
  };
  exact(Object.keys(scelle), CLES_SCELLE, "registre");
  if (scelle.routes && typeof scelle.routes === "object") exact(Object.keys(scelle.routes), CLES_ROUTES, "routes");
  else ecarts.push("routes : absent ou illisible");
  if (scelle.empreintes_fichiers && typeof scelle.empreintes_fichiers === "object") {
    exact(Object.keys(scelle.empreintes_fichiers), FICHIERS_ROUTAGE, "empreintes_fichiers");
    for (const f of FICHIERS_ROUTAGE) {
      const h = scelle.empreintes_fichiers[f];
      if (h !== undefined && !/^[0-9a-f]{64}$/.test(String(h))) ecarts.push(`empreintes_fichiers[${f}] : « ${h} » n'est pas un SHA-256`);
    }
  } else ecarts.push("empreintes_fichiers : absent ou illisible");
  if (scelle.familles && typeof scelle.familles === "object") {
    exact(Object.keys(scelle.familles), FAMILLES_ROUTAGE, "familles");
    for (const f of FAMILLES_ROUTAGE) {
      if (scelle.familles[f] !== undefined && !Array.isArray(scelle.familles[f])) ecarts.push(`familles[${f}] : ce n'est pas une liste de règles`);
    }
  } else ecarts.push("familles : absent ou illisible");
  if (scelle.empreintes && typeof scelle.empreintes === "object") {
    exact(Object.keys(scelle.empreintes), ["globale", "par_famille"], "empreintes");
    if (scelle.empreintes.par_famille && typeof scelle.empreintes.par_famille === "object") {
      exact(Object.keys(scelle.empreintes.par_famille), FAMILLES_ROUTAGE, "empreintes.par_famille");
    } else ecarts.push("empreintes.par_famille : absent ou illisible");
  } else ecarts.push("empreintes : absent ou illisible");
  if (ecarts.length) return ecarts;

  /* Auto-cohérence : les dérivées RECALCULÉES depuis le scellé — sans son propre champ
     « empreintes », qui ne peut pas se contenir — doivent être celles inscrites. */
  const { schema, routes, familles, empreintes_fichiers } = scelle;
  const recalculees = empreintesDe({ schema, routes, familles, empreintes_fichiers });
  if (recalculees.globale !== scelle.empreintes.globale) {
    ecarts.push(`empreintes.globale inscrite ${String(scelle.empreintes.globale).slice(0, 12)}… ≠ recalculée ${recalculees.globale.slice(0, 12)}… — le registre ne correspond plus à son propre contenu`);
  }
  for (const f of FAMILLES_ROUTAGE) {
    if (recalculees.par_famille[f] !== scelle.empreintes.par_famille[f]) {
      ecarts.push(`empreintes.par_famille[${f}] inscrite ${String(scelle.empreintes.par_famille[f]).slice(0, 12)}… ≠ recalculée ${recalculees.par_famille[f].slice(0, 12)}…`);
    }
  }
  return ecarts;
}

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
      redirects_statiques: parserRedirects(textes.redirects)
        .map((r) => ({ ...r, surface: surfaceDe(r.source, routes) })),
      ...parserWorker(textes.worker),
    },
    empreintes_fichiers: {
      "_routes.json": sha256(textes.routes),
      "_redirects": sha256(textes.redirects),
      "_worker.js": sha256(textes.worker),
    },
  };
}

/**
 * LE PÉRIMÈTRE DU WORKER, ET CE QU'IL REND MORT — mesuré le 28/08/2026 en écrivant le
 * contre-test en ligne, et c'est un faux vert trouvé à cette occasion.
 *
 * `_routes.json` dit quels chemins passent par le Worker ; ceux-là ne voient JAMAIS `_redirects`,
 * que la plateforme n'applique qu'aux chemins servis par la liaison ASSETS. Juger `_redirects`
 * en isolation — ce que faisait P7 — c'est refaire, à l'envers, la faute de méthode du faux
 * constat « 62 URL en 404 » : conclure sans ouvrir le fichier voisin.
 *
 * La surface est donc INSCRITE AU REGISTRE, règle par règle : « worker » (le Worker précède) ou
 * « statique » (la plateforme applique la règle). Un mouvement de périmètre change le scellé,
 * donc le diff de la pull request le montre — il ne se découvre plus en production.
 */
export function surfaceDe(chemin, routes) {
  const echapper = (r) => r.replace(/[.+?^${}()|[\]\\]/g, (c) => "\\" + c).replace(/\*/g, ".*");
  const toRe = (r) => new RegExp("^" + echapper(r) + "$");
  const inc = routes.include.map(toRe), exc = routes.exclude.map(toRe);
  /* Une règle à motif se juge sur une source CONCRÈTE — son préfixe suivi d'un segment
     quelconque —, comme la plateforme le fera de chacune de ses sources. */
  const echantillon = chemin.includes("*") ? chemin.replace(/\*/g, "sonde-de-porte/") : chemin;
  return inc.some((r) => r.test(echantillon)) && !exc.some((r) => r.test(echantillon)) ? "worker" : "statique";
}

/**
 * L'EFFET RÉEL d'une règle de `_redirects`, exécuté sur le VRAI Worker de l'artefact.
 *
 * Une règle en surface « worker » n'agit que si le Worker DÉLÈGUE à la liaison ASSETS ; sinon
 * il répond lui-même et la règle écrite ne s'applique jamais. La délégation se détecte en
 * instrumentant ASSETS. L'effet mesuré est inscrit au registre ; la porte (P7 ter) refuse
 * ensuite toute règle dont l'effet dément la promesse, tant qu'un arbitrage nommé — le champ
 * `ombre_approuvee` et son motif — ne l'a pas acceptée.
 */
export async function mesurerEffets(dist, routage, domaine = "https://mydogcanfly.com") {
  const { pathToFileURL } = await import("node:url");
  const { resolve } = await import("node:path");
  const worker = (await import(pathToFileURL(resolve(join(dist, "_worker.js"))).href + `?scelleur=${Date.now()}`)).default;
  const regles = [];
  for (const r of routage.familles.redirects_statiques) {
    if (r.surface !== "worker") { regles.push({ ...r, effet: { par: "plateforme", status: r.statut, location: r.cible } }); continue; }
    let delegue = false;
    const env = { ASSETS: { fetch: async () => { delegue = true; return new Response("__ASSET__", { status: 200 }); } } };
    const chemin = r.source.includes("*") ? r.source.replace(/\*/g, "sonde-de-porte/") : r.source;
    const res = await worker.fetch(new Request(domaine + chemin), env);
    regles.push({ ...r, effet: delegue
      ? { par: "plateforme", status: r.statut, location: r.cible }
      : { par: "worker", status: res.status, location: res.headers.get("Location") ?? null } });
  }
  return { ...routage, familles: { ...routage.familles, redirects_statiques: regles } };
}

/** Une règle tient-elle sa promesse ? Rend null, ou le motif du démenti. */
export function dementiDe(regle) {
  const e = regle.effet;
  if (!e) return `${regle.source} : aucun effet mesuré au registre — la règle n'a jamais été exercée`;
  if (e.par === "plateforme") return null;
  if (e.status === regle.statut && e.location === regle.cible) return null;
  return `${regle.source} promet ${regle.statut} → ${regle.cible}, mais le Worker répond ${e.status}${e.location ? " → " + e.location : ""} avant que « _redirects » ne soit consulté`;
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
export async function comparerAuScelle(dist, scelle) {
  const ecarts = [];
  let vivant;
  try { vivant = await mesurerEffets(dist, lireRoutage(dist)); }
  catch (e) { return [String(e.message)]; }

  if (scelle.schema !== SCHEMA_ROUTAGE) return [`registre au schéma ${scelle.schema}, attendu ${SCHEMA_ROUTAGE} — resceller plutôt qu'interpréter`];

  /* LA FORME DU SCELLÉ D'ABORD. Un registre amputé ne se compare pas : il se refuse. */
  const forme = verifierFormeScelle(scelle);
  if (forme.length) return forme.map((e) => `registre scellé : ${e}`);

  /* c. Les empreintes des trois fichiers — le niveau qui voit le code dynamique.
     ITÉRÉ SUR LA LISTE EXIGÉE, jamais sur les clés du scellé (Codex, P0-2). */
  for (const f of FICHIERS_ROUTAGE) {
    const h = scelle.empreintes_fichiers[f];
    if (vivant.empreintes_fichiers[f] !== h) {
      ecarts.push(`${f} : empreinte ${vivant.empreintes_fichiers[f]?.slice(0, 12)}… ≠ scellée ${String(h).slice(0, 12)}… — le fichier a changé hors rescellement nommé`);
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
    /* MULTI-ENSEMBLES, et non ensembles : `new Map` absorbait silencieusement une règle en
       double. Une famille qui gagne un doublon a changé — c'est un mouvement, pas un détail. */
    const compter = (l) => { const m = new Map(); for (const r of l) { const k = cjson(r); m.set(k, [(m.get(k)?.[0] ?? 0) + 1, r]); } return m; };
    const sM = compter(s), vM = compter(v);
    for (const [k, [n, r]] of vM) {
      const m = sM.get(k)?.[0] ?? 0;
      if (m === 0) ecarts.push(`${famille} : règle du dist hors scellé — ${JSON.stringify(r)}`);
      else if (n !== m) ecarts.push(`${famille} : règle présente ${n}× au dist et ${m}× au scellé — ${JSON.stringify(r)}`);
    }
    for (const [k, [n, r]] of sM) if (!vM.has(k)) ecarts.push(`${famille} : règle scellée absente du dist — ${JSON.stringify(r)}`);
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
    const routage = await mesurerEffets(dist, lireRoutage(dist));
    const empreintes = empreintesDe(routage);
    writeFileSync(FICHIER_SCELLE, JSON.stringify({ ...routage, empreintes }, null, 2) + "\n");
    const n = Object.fromEntries(Object.entries(routage.familles).map(([f, r]) => [f, r.length]));
    console.error(`[routage] scellé RÉGÉNÉRÉ depuis ${dist} : ${JSON.stringify(n)} · globale ${empreintes.globale.slice(0, 16)}… — le diff du scellé porte le mouvement, la PR le montre`);
  } else {
    if (!existsSync(FICHIER_SCELLE)) { console.error(`[routage] ${FICHIER_SCELLE} absent — « --ecrire » le déposera`); process.exit(1); }
    const scelle = JSON.parse(readFileSync(FICHIER_SCELLE, "utf8"));
    const ecarts = await comparerAuScelle(dist, scelle);
    if (ecarts.length) {
      for (const e of ecarts) console.error(`  ÉCART ${e}`);
      console.error(`[routage] ÉCHEC — ${ecarts.length} écart(s) entre ${dist} et le scellé`);
      process.exit(1);
    }
    console.error(`[routage] scellé tenu : le routage du dist est exactement celui approuvé (globale ${empreintesDe(await mesurerEffets(dist, lireRoutage(dist))).globale.slice(0, 16)}…)`);
  }
}
