/**
 * LE CONTRAT DES ANCIENNES URL, EXERCÉ SUR LE VRAI WORKER DE L'ARTEFACT.
 *
 * Exigé par la contre-revue du 28/08/2026, après l'arbitrage du propriétaire : les anciennes URL
 * du site v1 dont un équivalent v2 existe doivent répondre 301 vers cet équivalent ; le 410 ne
 * subsiste que sans remplacement pertinent, et alors avec un motif écrit au registre.
 *
 * CE QUE CE MODULE VÉRIFIE, ENTRÉE PAR ENTRÉE, EN EXÉCUTANT `dist/_worker.js` :
 *   · le statut exact — 301 pour une redirection, 410 pour une disparition ;
 *   · la cible exacte — pas « à peu près la bonne page », la bonne ;
 *   · la QUERY STRING conservée — une campagne suivie ne doit pas être perdue en chemin ;
 *   · aucune chaîne : la cible d'une redirection n'est jamais elle-même une source du registre ;
 *   · la cible répond 200 au routage réel, et elle existe dans le dist ;
 *   · la cible figure dans un sitemap et ne porte pas `noindex` — rediriger vers une page qu'on
 *     interdit aux moteurs, c'est perdre le lien deux fois ;
 *   · la correspondance est EXACTE dans les deux sens entre le registre et les tables servies.
 *
 * Il est écrit une fois et utilisé deux fois : par la porte de lancement (P7 ter) et par le
 * harnais de contre-épreuves, qui mute des copies et exige que CE code-ci rougisse.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const FICHIER_REGISTRE = "legacy-urls-registre.json";

/** Le routage réel de l'artefact : périmètre `_routes.json` + le VRAI Worker, module neuf. */
export async function routeurDu(dist, domaine = "https://mydogcanfly.com") {
  const routes = JSON.parse(readFileSync(join(dist, "_routes.json"), "utf8"));
  const echapper = (r) => r.replace(/[.+?^${}()|[\]\\]/g, (c) => "\\" + c).replace(/\*/g, ".*");
  const toRe = (r) => new RegExp("^" + echapper(r) + "$");
  const inc = routes.include.map(toRe), exc = routes.exclude.map(toRe);
  const passe = (p) => inc.some((r) => r.test(p)) && !exc.some((r) => r.test(p));
  /* URL d'import UNIQUE : sans elle, le cache de modules ferait juger une ancienne copie. */
  const worker = (await import(pathToFileURL(resolve(join(dist, "_worker.js"))).href + `?legacy=${Date.now()}`)).default;
  return async (chemin) => {
    if (!passe(chemin.split("?")[0])) return { status: "statique", loc: null };
    let deleguee = false;
    const env = { ASSETS: { fetch: async () => { deleguee = true; return new Response("__ASSET__", { status: 200 }); } } };
    const res = await worker.fetch(new Request(domaine + chemin), env);
    return { status: deleguee ? "assets" : res.status, loc: res.headers.get("Location") };
  };
}

const relDe = (cible) => {
  const sansFragment = (cible.split("#")[0] || "/").split("?")[0];
  /* Une cible qui EST déjà un fichier .html ne reçoit pas un second suffixe — défaut trouvé
     par la contre-épreuve « cible hors sitemap », qui visait /button-lab.html. */
  if (sansFragment.endsWith(".html")) return sansFragment;
  return sansFragment.endsWith("/") ? sansFragment + "index.html" : sansFragment + ".html";
};

/**
 * Le contrat, exécuté. Rend la liste des écarts — vide si l'artefact tient le registre.
 * `urlsSitemaps` et `pagesNoindex` viennent de l'appelant : la porte les a déjà calculés, et
 * deux calculs du même ensemble finiraient par diverger.
 */
export async function verifierLegacy(dist, registre, { urlsSitemaps, pagesNoindex, domaine = "https://mydogcanfly.com", racinePages = dist } = {}) {
  const ecarts = [];
  let sonder;
  try { sonder = await routeurDu(dist, domaine); }
  catch (e) { return [`le Worker de l'artefact est inexploitable : ${e.message}`]; }

  const sources = new Set(registre.entrees.map((e) => e.source));
  let redirections = 0, disparitions = 0;

  for (const e of registre.entrees) {
    const r = await sonder(e.source);

    if (e.type === "gone") {
      if (r.status !== 410) { ecarts.push(`${e.source} : attendu 410 (motif au registre : ${e.motif}), servi ${r.status}${r.loc ? " → " + r.loc : ""}`); continue; }
      disparitions++;
      continue;
    }

    if (r.status !== 301) { ecarts.push(`${e.source} : attendu 301 → ${e.cible}, servi ${r.status}${r.loc ? " → " + r.loc : ""}`); continue; }
    if (r.loc !== e.cible) { ecarts.push(`${e.source} : redirigée vers « ${r.loc} » au lieu de « ${e.cible} » que le registre décide`); continue; }

    /* La query string, sur la même entrée : une campagne suivie ne se perd pas en chemin. */
    const avecQuery = await sonder(e.source + "?utm_source=porte&x=1");
    if (avecQuery.loc !== e.cible + "?utm_source=porte&x=1") {
      ecarts.push(`${e.source} : la query string est perdue — « ${avecQuery.loc} » au lieu de « ${e.cible}?utm_source=porte&x=1 »`);
      continue;
    }

    /* Aucune chaîne : la cible n'est pas elle-même une ancienne URL. */
    if (sources.has(e.cible)) { ecarts.push(`${e.source} → ${e.cible}, qui est elle-même une source du registre : chaîne interdite`); continue; }

    /* La cible vit, répond 200, est annonçable et n'est pas interdite aux moteurs. */
    const rel = relDe(e.cible);
    /* `racinePages` : le harnais mute une copie qui ne porte QUE les fichiers de routage —
       l’existence des pages se juge alors sur l’artefact réel, jamais sur la copie. */
    if (!existsSync(join(racinePages, rel))) { ecarts.push(`${e.source} → ${e.cible} : aucune page construite`); continue; }
    const rc = await sonder(e.cible.split("#")[0]);
    if (rc.status !== 200 && rc.status !== "statique" && rc.status !== "assets") {
      ecarts.push(`${e.source} → ${e.cible} : la cible répond ${rc.status} au routage réel`); continue;
    }
    if (pagesNoindex?.has(rel)) { ecarts.push(`${e.source} → ${e.cible} : la cible porte noindex — le lien est perdu deux fois`); continue; }
    if (urlsSitemaps && !e.cible.includes("#") && !urlsSitemaps.has(domaine + e.cible)) {
      ecarts.push(`${e.source} → ${e.cible} : la cible n'est annoncée par aucun sitemap alors qu'elle est indexable`); continue;
    }
    redirections++;
  }

  /* Les préfixes, exercés sur une URL forgée : une famille déclarée et jamais exercée ne prouve rien. */
  for (const p of registre.prefixes_gone) {
    const r = await sonder(p.prefixe + "sonde-de-porte/");
    if (r.status !== 410) ecarts.push(`préfixe 410 « ${p.prefixe} » : ${p.prefixe}sonde-de-porte/ répond ${r.status}${r.loc ? " → " + r.loc : ""}`);
  }
  for (const p of registre.prefixes_redirect) {
    const r = await sonder(p.prefixe + "sonde-de-porte/");
    if (r.status !== 301 || r.loc !== p.cible) ecarts.push(`préfixe 301 « ${p.prefixe} » → ${p.cible} : ${p.prefixe}sonde-de-porte/ répond ${r.status}${r.loc ? " → " + r.loc : ""}`);
  }
  for (const a of registre.breed_alias) {
    const r = await sonder(`/dog-heat-safety/${a.v1}/`);
    if (r.status !== 301 || r.loc !== `/breeds/${a.v2}/`) ecarts.push(`alias de race « ${a.v1} » → /breeds/${a.v2}/ : répond ${r.status}${r.loc ? " → " + r.loc : ""}`);
  }

  /* JAMAIS VERT FAUTE DE MATIÈRE. */
  const attenduRed = registre.entrees.filter((e) => e.type === "redirect").length;
  const attenduGone = registre.entrees.filter((e) => e.type === "gone").length;
  if (!ecarts.length && (redirections !== attenduRed || disparitions !== attenduGone)) {
    ecarts.push(`${redirections}/${attenduRed} redirections et ${disparitions}/${attenduGone} disparitions réellement exercées — un contrôle qui ne tourne pas est indiscernable d'un contrôle vert`);
  }
  return ecarts;
}

/**
 * L'autre sens : les tables SERVIES ne contiennent rien que le registre n'ait décidé. Sans ce
 * contrôle, une redirection ajoutée à la main dans le Worker passerait — et la double liste que
 * l'arbitrage vient de supprimer se reformerait aussitôt.
 */
export function verifierAucuneRegleHorsRegistre(dist, registre, familles) {
  const ecarts = [];
  const attendues = new Map(registre.entrees.filter((e) => e.type === "redirect").map((e) => [e.source, e.cible]));
  const disparues = new Set(registre.entrees.filter((e) => e.type === "gone").map((e) => e.source));
  for (const r of familles.legacy_redirects) {
    if (!attendues.has(r.source)) ecarts.push(`le Worker sert « ${r.source} → ${r.cible} », que le registre canonique ne décide pas`);
    else if (attendues.get(r.source) !== r.cible) ecarts.push(`le Worker sert « ${r.source} → ${r.cible} », le registre décide « ${attendues.get(r.source)} »`);
  }
  for (const [source, cible] of attendues) {
    if (!familles.legacy_redirects.some((r) => r.source === source && r.cible === cible)) {
      ecarts.push(`le registre décide « ${source} → ${cible} », le Worker ne la sert pas`);
    }
  }
  for (const r of familles.gone_exact) {
    if (!disparues.has(r.source)) ecarts.push(`le Worker fait disparaître « ${r.source} », que le registre ne classe pas en 410`);
  }
  for (const source of disparues) {
    if (!familles.gone_exact.some((r) => r.source === source)) ecarts.push(`le registre classe « ${source} » en 410, le Worker ne le fait pas disparaître`);
  }
  return ecarts;
}
