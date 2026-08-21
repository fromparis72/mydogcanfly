/**
 * LA CARTE D'IDENTITÉ D'UN SITE CONSTRUIT — producteur et validateur, au même endroit.
 *
 * `packages/ui/dist` est ignoré par git : rien, en le lisant, ne dit de QUELLE version il sort.
 * Un dossier de mesure qui s'en contente parce qu'il « compte assez de pages » peut donc valider
 * un site construit d'un autre commit, ou amputé de centaines de pages qu'il ne regarde pas.
 *
 * POURQUOI CE MODULE EXISTE PLUTÔT QUE QUATRE COPIES. La première version écrivait la carte dans
 * `build-ci.mjs` ET `build-preview.mjs`, puis la relisait dans T0-B3-d ET T0-B3-e — quatre copies
 * d'un même contrat, qui avaient déjà commencé à diverger : l'une des deux écritures portait un
 * antislash littéral au lieu d'un saut de ligne.
 *
 * CINQ VERSIONS DU PÉRIMÈTRE, ET LA QUATRIÈME ÉTAIT UN AFFAIBLISSEMENT. J'avais retiré `scripts/`
 * de l'empreinte au motif que `BUILD_ONLY` et `BUILD_SLUGS`, inscrits sur la carte, capturaient
 * déjà l'influence du constructeur. C'est faux : ces variables décrivent ses PARAMÈTRES, pas son
 * IMPLÉMENTATION. À paramètres identiques, une modification de `build-ci.mjs`, de la configuration
 * d'Astro ou d'une dépendance change les pages et laissait la provenance verte. Le motif que
 * j'avançais — éviter des reconstructions inutiles — est un problème de CONFORT, et on ne règle
 * pas un problème de confort en affaiblissant une preuve.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

/** Tout ce dont le site produit dépend : ses sources, ses données, et le code qui le construit. */
export const ENTREES = [
  "packages/ui/src", "packages/ui/public", "packages/ui/astro.config.mjs", "packages/ui/package.json",
  "packages/knowledge/src", "packages/knowledge/raw", "packages/knowledge/translations",
  "packages/knowledge/scripts", "packages/knowledge/package.json",
  "packages/engine/src", "packages/engine/package.json",
  "package.json", "package-lock.json", ".nvmrc",
];

/**
 * SEULE EXCEPTION, ET ELLE EST BORNÉE : ce fichier-ci, qui écrit et relit la carte sans participer
 * au build. Il est hors empreinte — mais son SCHÉMA est versionné et EXIGÉ, si bien qu'un
 * changement de format ne peut pas passer pour une carte valide.
 */
export const HORS_EMPREINTE = new Set(["packages/knowledge/scripts/lib/provenance.mjs"]);

/** Les variables d'environnement qui changent le site produit. */
export const PARAMETRES = ["BUILD_ONLY", "BUILD_SLUGS", "PUBLIC_API_BASE", "PUBLIC_SITE_ENV"];

/** Le format de la carte. Une carte d'un autre schéma est REFUSÉE, jamais interprétée. */
export const SCHEMA = 2;

const NOM = ".provenance.json";
const git = (...a) => {
  try { return execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim(); }
  catch { return ""; }
};

/** Le nombre de pages HTML d'un site construit — `_astro` exclu, comme partout ailleurs. */
export function compterPages(dist) {
  if (!existsSync(dist)) return 0;
  let n = 0;
  for (const e of readdirSync(dist, { withFileTypes: true })) {
    if (e.isDirectory()) { if (e.name !== "_astro") n += compterPages(join(dist, e.name)); }
    else if (e.name.endsWith(".html")) n++;
  }
  return n;
}

/**
 * L'empreinte des ENTRÉES, préfixe par préfixe.
 *
 * Lue dans l'INDEX git (`ls-files -s`), ce qui est exact parce que la propreté du même périmètre
 * est exigée juste à côté : index et copie de travail y sont alors identiques. Un condensé PAR
 * PRÉFIXE plutôt qu'un seul total, pour que le diagnostic nomme ce qui a changé.
 */
export function empreinte(env = process.env) {
  const lignes = git("ls-files", "-s", "--", ...ENTREES).split("\n").filter(Boolean);
  const parPrefixe = Object.fromEntries(ENTREES.map((e) => [e, []]));
  for (const l of lignes) {
    const [meta, chemin] = l.split("\t");
    if (!chemin || HORS_EMPREINTE.has(chemin)) continue;
    const e = ENTREES.find((x) => chemin === x || chemin.startsWith(x + "/"));
    if (e) parPrefixe[e].push(`${meta.split(" ")[1]} ${chemin}`);
  }
  const entrees = {};
  for (const [e, l] of Object.entries(parPrefixe)) {
    entrees[e] = createHash("sha256").update(l.sort().join("\n")).digest("hex").slice(0, 16);
  }
  const parametres = {};
  for (const p of PARAMETRES) parametres[p] = env[p] ?? null;
  return { entrees, parametres, node: process.version };
}

/**
 * L'empreinte du SITE PRODUIT, `.provenance.json` exclu — une carte ne peut pas se contenir.
 * C'est la preuve de complétude la plus forte : elle ne dépend d'aucun seuil et voit la
 * disparition d'un seul octet dans n'importe quel fichier, pas seulement d'une page entière.
 */
export function empreinteDist(dist) {
  const h = createHash("sha256");
  let n = 0;
  (function marcher(d, base = "") {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = base ? `${base}/${e.name}` : e.name;
      if (e.isDirectory()) marcher(join(d, e.name), rel);
      else if (rel !== NOM) {
        h.update(rel).update(" ").update(createHash("sha256").update(readFileSync(join(d, e.name))).digest());
        n++;
      }
    }
  })(dist);
  return { empreinte: h.digest("hex"), fichiers: n };
}

/** L'arbre est-il sale SUR LE PÉRIMÈTRE DES ENTRÉES ? Renvoie le relevé, ou "". */
export const salete = () => git("status", "--porcelain", "--untracked-files=all", "--", ...ENTREES);

/** Déposer la carte d'identité dans le site construit. À faire EN DERNIER : elle scelle le reste. */
export function ecrireProvenance(dist, portee, env = process.env) {
  const { entrees, parametres, node } = empreinte(env);
  const dist_ = empreinteDist(dist);
  writeFileSync(join(dist, NOM), JSON.stringify({
    schema: SCHEMA,
    sha: git("rev-parse", "HEAD"),
    entrees_propres: salete() === "",
    entrees, parametres, node, portee,
    pages: compterPages(dist),
    dist: dist_,
  }, null, 2) + "\n");
}

/**
 * Relire la carte et la confronter à l'état courant. Renvoie la liste des écarts — vide si le
 * site correspond à ses entrées. `porteeAttendue` vaut « complet » pour les dossiers de mesure.
 */
export function verifierProvenance(dist, porteeAttendue = "complet") {
  const chemin = join(dist, NOM);
  if (!existsSync(chemin)) {
    return [`${chemin} absent : impossible de savoir de quelle version ce site a été construit. `
      + "« npm run build:ci -- --complet » le déposera."];
  }
  let prov;
  try { prov = JSON.parse(readFileSync(chemin, "utf8")); }
  catch (e) { return [`${chemin} illisible : ${e.message}`]; }

  /* LE SCHÉMA D'ABORD : une carte d'un autre format ne se DISCUTE pas, elle se refuse. Sans cela,
     un champ disparu se lirait « undefined » et passerait pour une égalité. */
  if (prov.schema !== SCHEMA) {
    return [`carte au schéma ${prov.schema ?? "absent"}, ce validateur attend le schéma ${SCHEMA}. `
      + "Reconstruire le site plutôt que d'interpréter un format qui n'est pas celui-ci."];
  }

  const ecarts = [];
  if (!prov.entrees_propres) {
    ecarts.push("construit depuis des entrées MODIFIÉES : ses pages ne correspondent à aucun commit");
  }
  if (prov.portee !== porteeAttendue) ecarts.push(`portée « ${prov.portee} » et non « ${porteeAttendue} »`);

  const { entrees, node } = empreinte();
  for (const [k, v] of Object.entries(entrees)) {
    if (prov.entrees?.[k] !== v) {
      ecarts.push(`${k} : site construit sur ${String(prov.entrees?.[k] ?? "absent").slice(0, 12)}, `
        + `les entrées sont à ${v.slice(0, 12)}`);
    }
  }
  for (const k of Object.keys(prov.entrees ?? {})) {
    if (!(k in entrees)) ecarts.push(`${k} : inscrit sur la carte mais absent des entrées déclarées`);
  }
  if (prov.node !== node) {
    ecarts.push(`construit sous Node ${prov.node}, ce processus tourne sous ${node} — `
      + "un autre Node peut produire d'autres pages");
  }
  /* Les paramètres se jugent sur ce qu'ils DÉTERMINENT : un site « complet » ne peut pas avoir été
     construit sous un filtre d'entités. Les confronter à `process.env` du mesureur — qui n'en porte
     aucun — rejetait un site parfaitement valide. */
  if (porteeAttendue === "complet") {
    for (const k of ["BUILD_ONLY", "BUILD_SLUGS"]) {
      const v = prov.parametres?.[k];
      if (v) {
        ecarts.push(`paramètre ${k} = « ${v} » : ce site a été construit sous un filtre d'entités, `
          + "il ne peut pas être complet quel que soit son nombre de pages");
      }
    }
  }
  const sale = salete();
  if (sale) {
    ecarts.push(`les entrées du site ont changé depuis le build :\n      ${sale.replace(/\n/g, "\n      ")}`);
  }

  /* ---- LA COMPLÉTUDE, PROUVÉE TROIS FOIS ------------------------------------------------------
   * L'empreinte du `dist` voit la disparition d'un octet ; le décompte de pages et la bijection
   * sitemap vers fichiers disent, eux, CE QUI manque quand elle diffère. Les trois sont gardées :
   * la première prouve, les deux autres expliquent. */
  const d = empreinteDist(dist);
  if (prov.dist?.empreinte !== d.empreinte) {
    ecarts.push(`le site a changé depuis le build : ${prov.dist?.fichiers ?? "?"} fichiers scellés, `
      + `${d.fichiers} présents, empreintes ${String(prov.dist?.empreinte ?? "absente").slice(0, 12)} `
      + `contre ${d.empreinte.slice(0, 12)}`);
  }
  const pages = compterPages(dist);
  if (prov.pages !== pages) {
    ecarts.push(`la carte annonce ${prov.pages} pages, le site en contient ${pages}`);
  }
  const absentes = [];
  let urls = 0;
  for (const l of ["en", "fr", "es", "pt"]) {
    const f = join(dist, `sitemap-${l}.xml`);
    if (!existsSync(f)) { ecarts.push(`sitemap-${l}.xml absent`); continue; }
    for (const m of readFileSync(f, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)) {
      urls++;
      const p = m[1].replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "");
      if (!existsSync(join(dist, p, "index.html")) && !existsSync(join(dist, p))) absentes.push(p || "/");
    }
  }
  if (urls < 2000) ecarts.push(`${urls} URL aux sitemaps, attendu au moins 2000`);
  if (absentes.length) {
    ecarts.push(`${absentes.length} URL des sitemaps sans page construite — le site est amputé : `
      + absentes.slice(0, 3).join(", ") + (absentes.length > 3 ? ", et d'autres" : ""));
  }
  return ecarts;
}

/** Confronter, et s'arrêter si le site ne correspond pas. Utilisé par les dossiers de mesure. */
export function exigerProvenance(dist, etiquette, porteeAttendue = "complet") {
  const ecarts = verifierProvenance(dist, porteeAttendue);
  if (!ecarts.length) return;
  process.stderr.write(`[${etiquette}] ÉCHEC — le site construit ne correspond pas à ses entrées :\n`
    + ecarts.map((e) => `  · ${e}`).join("\n") + "\n");
  process.exit(1);
}
