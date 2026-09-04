#!/usr/bin/env node
/**
 * LA PRÉVERSION, SERVIE EN LOCAL — pour la regarder dans un vrai navigateur.
 *
 *   npx tsx apercu-local.mjs [--dist=packages/ui/dist] [--port=8788]
 *
 * POURQUOI ELLE EXISTE. La journée 5 demande de vérifier la préversion AU NAVIGATEUR. Je ne peux
 * ni créer la préversion Cloudflare ni la promouvoir — ce sont des décisions de Philippe, et ce
 * conteneur n'a de toute façon pas d'accès réseau sortant. Mais l'artefact à vérifier, lui, est
 * ici : c'est le `dist` que le déploiement enverrait. On le sert donc tel quel, avec le VRAI
 * Worker derrière `/v1/*`, et on le pilote avec le Chromium installé dans l'image.
 *
 * CE QUE CELA VAUT, ET CE QUE CELA NE VAUT PAS. Le HTML, le CSS, le JavaScript, le moteur et les
 * données sont exactement ceux qui partiraient en production : un défaut d'affichage, un verdict
 * faux ou un montant résiduel se voient ici comme ils se verraient en ligne. Ce qui ne se voit
 * PAS ici : la couche Cloudflare elle-même — en-têtes du CDN, `_routes.json`, alias, cache. Ces
 * points-là restent à vérifier après la bascule, et `preflight-production.mjs` les imprime.
 *
 * `_redirects` EST APPLIQUÉ, parce qu'une redirection non servie ferait passer pour cassé un lien
 * qui fonctionne en ligne — et inversement.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import worker from "./packages/workers/src/index.ts";

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split("=").slice(1).join("=");
const DIST = arg("dist", "packages/ui/dist");
const PORT = Number(arg("port", "8788"));

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon", ".zip": "application/zip",
  ".woff2": "font/woff2", ".webmanifest": "application/manifest+json",
};

/* Les redirections, dans l'ordre du fichier : la première qui correspond gagne, comme chez Pages. */
const redirections = [];
if (existsSync(join(DIST, "_redirects"))) {
  for (const ligne of readFileSync(join(DIST, "_redirects"), "utf8").split("\n")) {
    const t = ligne.trim();
    if (!t || t.startsWith("#")) continue;
    const [de, vers, code] = t.split(/\s+/);
    if (de && vers) redirections.push({ de, vers, code: Number(code ?? 301) });
  }
}
const redirectionPour = (chemin) => {
  for (const r of redirections) {
    if (r.de === chemin) return r;
    if (r.de.endsWith("/*") && chemin.startsWith(r.de.slice(0, -1))) {
      return { ...r, vers: r.vers.replace(":splat", chemin.slice(r.de.length - 1)) };
    }
  }
  return null;
};

/** Le fichier qui sert un chemin d'URL, ou `null`. `/x/` → `dist/x/index.html`. */
const fichierPour = (chemin) => {
  const candidats = [join(DIST, chemin), join(DIST, chemin, "index.html"), join(DIST, chemin + "/index.html")];
  for (const c of candidats) {
    try { if (statSync(c).isFile()) return c; } catch { /* suivant */ }
  }
  return null;
};

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const chemin = decodeURIComponent(url.pathname);

  /* 1 — l'API passe par le VRAI Worker, pas par une doublure : une doublure prouverait que ma
     doublure fonctionne. */
  if (chemin.startsWith("/v1/")) {
    const corps = req.method === "POST" || req.method === "PUT"
      ? await new Promise((ok) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => ok(d)); })
      : undefined;
    const requete = new Request(`https://localhost${req.url}`, {
      method: req.method, headers: req.headers, body: corps,
    });
    try {
      const reponse = await worker.fetch(requete, {});
      res.writeHead(reponse.status, Object.fromEntries(reponse.headers));
      res.end(Buffer.from(await reponse.arrayBuffer()));
    } catch (e) {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(`worker: ${e.message}`);
    }
    return;
  }

  /* 2 — les redirections déclarées, avant le statique. */
  const r = redirectionPour(chemin);
  if (r && !fichierPour(chemin)) {
    res.writeHead(r.code, { location: r.vers });
    res.end();
    return;
  }

  /* 3 — le statique. */
  const f = fichierPour(chemin);
  if (f) {
    res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" });
    res.end(readFileSync(f));
    return;
  }

  /* 4 — la 404, avec son VRAI code : une 404 servie en 200 est une page d'erreur indexable. */
  const p404 = join(DIST, "404.html");
  res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
  res.end(existsSync(p404) ? readFileSync(p404) : "404");
});

serveur.listen(PORT, () => {
  console.log(`aperçu local : http://localhost:${PORT}  ·  dist ${DIST}  ·  ${redirections.length} redirection(s)`);
});
