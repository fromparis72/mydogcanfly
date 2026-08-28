/**
 * LE VOLET RÉSEAU DU DÉPLOIEMENT, ÉCRIT POUR ÊTRE ÉPROUVÉ — contre-revue Codex du 28/08/2026,
 * P0-3 et P0-4.
 *
 * POURQUOI CE FICHIER EXISTE. La première version faisait ses appels Cloudflare en ligne droite
 * dans `deployer-production.mjs` : aucun de ces chemins n'était exerçable sans déployer pour de
 * vrai, c'est-à-dire jamais. Deux fautes y vivaient donc sans que rien puisse les voir :
 *
 *   P0-3 — « le déploiement actif » était le PREMIER déploiement réussi rendu par
 *   `/deployments?env=production`. Ce n'est pas la production servie : l'API expose pour cela
 *   `project.canonical_deployment`, défini comme le déploiement de production le plus récent.
 *   Il n'y avait par ailleurs AUCUNE attente : entre l'envoi et la lecture, la promotion peut
 *   n'être pas encore faite — la concordance « le déploiement envoyé est devenu l'actif »
 *   pouvait donc rougir sur une course, et un déploiement CONCURRENT arrivé entre-temps était
 *   écrasé sans un mot.
 *
 *   P0-4 — le contre-test « exhaustif » ne contrôlait que TROIS pages noindex codées en dur sur
 *   les 585 du dist, et son `if (res.ok && …)` laissait échapper au contrôle toute réponse
 *   non-2xx : une page noindex servie en 500 passait pour conforme.
 *
 * Tout ce qui suit est donc PUR ou INJECTÉ : `api`, `http` et `dormir` sont des paramètres. Le
 * harnais les remplace par une fausse API Cloudflare déterministe et voit chaque refus rougir
 * pour sa cause — la promotion qui n'arrive jamais, le déploiement concurrent, la page noindex
 * servie sans noindex, la 500 qui échappait au contrôle.
 *
 * Références officielles consultées via Codex : Cloudflare Pages « Projects » (le champ
 * canonical_deployment) et « Deployments » (env, deployment_trigger.metadata.commit_hash,
 * created_on, latest_stage.status).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const ATTENTE = { essais: 30, pauseMs: 4000 };

/* ---- P0-3 : QUEL déploiement, sans ambiguïté ------------------------------------------------ */

/**
 * Le déploiement que NOUS venons de créer, identifié par les quatre traits que Codex exige :
 * l'environnement, le SHA du commit, la branche, et une création POSTÉRIEURE au début du cycle.
 * Rend `{ deploiement }`, ou `{ erreur }` — jamais « le premier de la liste ».
 *
 * Le cas à plusieurs candidats n'est pas un détail d'implémentation : c'est un DÉPLOIEMENT
 * CONCURRENT (un collègue, une action GitHub, un redéploiement manuel). On refuse alors, au
 * lieu de choisir au hasard et d'écraser le travail d'un autre.
 */
export function identifierNouveauDeploiement(deploiements, { sha, branche, depuis }) {
  const production = (deploiements ?? []).filter((d) => d.environment === "production");
  const recents = production.filter((d) => {
    const t = Date.parse(d.created_on ?? "");
    return Number.isFinite(t) && t >= depuis;
  });
  if (recents.length === 0) {
    return { erreur: `aucun déploiement de production créé depuis le début du cycle (${new Date(depuis).toISOString()}) — l'envoi n'a rien produit` };
  }
  const notres = recents.filter((d) =>
    d.deployment_trigger?.metadata?.commit_hash === sha
    && (d.deployment_trigger?.metadata?.branch ?? branche) === branche);
  if (notres.length === 0) {
    const vus = recents.map((d) => `${d.id?.slice(0, 8)}…(${d.deployment_trigger?.metadata?.commit_hash?.slice(0, 8) ?? "?"}, ${d.deployment_trigger?.metadata?.branch ?? "?"})`);
    return { erreur: `aucun déploiement récent ne porte le SHA ${sha.slice(0, 12)}… sur « ${branche} » — vus : ${vus.join(", ")}` };
  }
  if (notres.length > 1) {
    return { erreur: `${notres.length} déploiements récents portent le MÊME SHA et la même branche (${notres.map((d) => d.id).join(", ")}) — ambiguïté, aucun ne sera confondu avec l'autre` };
  }
  const concurrents = recents.filter((d) => d.id !== notres[0].id);
  if (concurrents.length) {
    return { erreur: `déploiement CONCURRENT inattendu pendant le cycle : ${concurrents.map((d) => `${d.id} (${d.deployment_trigger?.metadata?.commit_hash?.slice(0, 12) ?? "?"}…)`).join(", ")} — on ne l'écrase pas` };
  }
  return { deploiement: notres[0] };
}

/**
 * Attendre que `cible` DEVIENNE la production servie — `project.canonical_deployment.id`, et
 * rien d'autre. Une promotion prend quelques secondes ; lire une fois et conclure, c'est tirer
 * à pile ou face. Rend `{ ok: true }` ou `{ erreur }`.
 */
export async function attendreCanonique(lireProjet, cible, { essais, pauseMs } = ATTENTE, dormir = attendre) {
  let vu = null;
  for (let i = 0; i < essais; i++) {
    let projet;
    try { projet = await lireProjet(); }
    catch (e) { return { erreur: `projet illisible pendant l'attente de promotion : ${e.message}` }; }
    vu = projet?.canonical_deployment?.id ?? null;
    if (vu === cible) return { ok: true, essais: i + 1 };
    if (i < essais - 1) await dormir(pauseMs);
  }
  return { erreur: `après ${essais} lectures, canonical_deployment=${vu ?? "(absent)"} ≠ ${cible} — la production servie n'est pas celle attendue` };
}
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- P0-4 : CE QU'IL FAUT SONDER, construit depuis l'artefact scellé ------------------------- */

/** Les pages HTML du dist, chemins relatifs commençant par « / » — `_astro` exclu. */
export function pagesDuDist(dist) {
  const pages = [];
  (function marcher(d, base = "") {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const rel = `${base}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== "_astro") marcher(join(d, e.name), rel); }
      else if (e.name.endsWith(".html")) pages.push(rel);
    }
  })(dist);
  return pages.sort();
}

const relVersUrl = (rel) => rel.replace(/\/index\.html$/, "/").replace(/^\/$/, "/");

/**
 * L'INVENTAIRE EXACT des pages volontairement noindex, tiré du DIST SCELLÉ — pas d'une liste de
 * trois chemins. Chaque entrée porte le statut que la production doit rendre (motif) et le fait
 * que la page doit être servie noindex. Une page noindex du dist qu'aucun motif ne couvre est
 * une ERREUR ici aussi : elle serait sondée sans attente, donc sans contrôle.
 */
export function inventaireNoindex(dist, motifs) {
  const admis = motifs.map((m) => ({ re: new RegExp(m.motif), statut: m.statut_http ?? 200, motif: m.motif }));
  const inventaire = [], orphelines = [];
  for (const rel of pagesDuDist(dist)) {
    const html = readFileSync(join(dist, rel), "utf8");
    const robots = html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? null;
    if (!(robots && /noindex/.test(robots))) continue;
    const m = admis.find((a) => a.re.test(rel));
    if (!m) { orphelines.push(rel); continue; }
    inventaire.push({ rel, url: relVersUrl(rel), statut: m.statut, motif: m.motif });
  }
  return { inventaire, orphelines };
}

/**
 * Les sondes de ROUTAGE, toutes familles du registre scellé comprises — y compris les préfixes
 * 410 et les règles dynamiques, que la première version n'exerçait pas. Les exemples versionnés
 * (porte-redirects-exemples.json) donnent les URL concrètes des règles à motif.
 */
export function sondesRoutage(scelle, exemples, domaine) {
  const sondes = [];
  for (const { source, cible } of scelle.familles.legacy_redirects) {
    sondes.push({ url: domaine + source, attendu: { status: 301, location: cible }, famille: "legacy_redirects" });
  }
  for (const { source } of scelle.familles.gone_exact) {
    sondes.push({ url: domaine + source, attendu: { status: 410 }, famille: "gone_exact" });
  }
  /* LES PRÉFIXES 410 : un préfixe ne se sonde pas tel quel — on lui forge une URL concrète.
     Sans cela, la famille entière restait déclarée et jamais exercée. */
  for (const { prefixe } of scelle.familles.gone_prefixes) {
    sondes.push({ url: domaine + prefixe.replace(/\*$/, "") + "sonde-de-porte/", attendu: { status: 410 }, famille: "gone_prefixes" });
  }
  /* Les règles statiques SANS motif se sondent directement ; celles à motif passent par leurs
     exemples versionnés — c'est ce qui exerce heatSafetyTarget et presskitTarget en ligne. */
  for (const r of scelle.familles.redirects_statiques) {
    if (r.source.includes("*") || r.source.includes(":")) continue;
    sondes.push({ url: domaine + r.source, attendu: { status: r.statut ?? 301, location: r.cible }, famille: "redirects_statiques" });
  }
  for (const e of exemples.exemples ?? exemples) {
    sondes.push({ url: domaine + e.source, attendu: { status: 301, location: e.cible }, famille: "exemples dynamiques" });
  }
  return sondes;
}

/* ---- Les sondes elles-mêmes — AUCUN contrôle conditionné par le succès de la réponse -------- */

/** Une page publique : 200, aucun noindex (meta ou en-tête), canonique égale à son URL. */
export async function sonderPagePublique(http, url) {
  const res = await http(url, { redirect: "manual" });
  if (res.status !== 200) return `${url} → ${res.status} (attendu 200)`;
  const xr = res.headers.get("x-robots-tag") ?? "";
  if (/noindex/i.test(xr)) return `${url} → X-Robots-Tag « ${xr} » : une règle de transformation désindexe cette page`;
  const html = await res.text();
  if (/<meta name="robots" content="[^"]*noindex/.test(html)) return `${url} → meta noindex SERVIE sur une page publique`;
  const canon = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (canon !== url) return `${url} → canonique servie « ${canon ?? "(absente)"} »`;
  return null;
}

/**
 * Une page volontairement noindex : le statut ATTENDU (404 pour les pages d'erreur, 200 sinon)
 * et un noindex réellement servi. Le contrôle du noindex n'est PLUS conditionné par `res.ok` —
 * c'était le trou : une réponse non-2xx sautait le contrôle au lieu de le faire échouer.
 */
export async function sonderPageNoindex(http, { url, statut }) {
  const res = await http(url, { redirect: "manual" });
  if (res.status !== statut) return `${url} → ${res.status} (attendu ${statut} pour une page volontairement noindex)`;
  const xr = res.headers.get("x-robots-tag") ?? "";
  const html = await res.text();
  if (!/noindex/i.test(xr) && !/<meta name="robots" content="[^"]*noindex/.test(html)) {
    return `${url} : admise noindex mais servie SANS noindex (ni meta, ni X-Robots-Tag)`;
  }
  return null;
}

/** Une sonde de routage : statut exact, et Location exacte quand la règle en promet une. */
export async function sonderRoutage(http, { url, attendu, famille }, domaine) {
  const res = await http(url, { redirect: "manual" });
  if (res.status !== attendu.status) return `${famille} : ${url} → ${res.status} (attendu ${attendu.status})`;
  if (attendu.location !== undefined) {
    const loc = res.headers.get("location");
    const nu = loc?.startsWith(domaine) ? loc.slice(domaine.length) : loc;
    if (nu !== attendu.location) return `${famille} : ${url} → Location « ${loc ?? "(absente)"} » (attendu ${attendu.location})`;
  }
  return null;
}

/** Exécution par lots, en s'arrêtant au PREMIER défaut — un rollback n'attend pas la suite. */
export async function parLots(elements, taille, sonde) {
  for (let i = 0; i < elements.length; i += taille) {
    const r = await Promise.all(elements.slice(i, i + taille).map(sonde));
    for (const d of r) if (d) return d;
  }
  return null;
}
