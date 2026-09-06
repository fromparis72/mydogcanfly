#!/usr/bin/env node
/**
 * PRÉ-VOL DE PRODUCTION — vérifier, puis DIRE quoi faire. Jamais déployer.
 *
 *   node preflight-production.mjs
 *   → code 0 : les conditions locales sont réunies, le mode d'emploi est imprimé
 *   → code 1 : une condition manque, NE PAS BASCULER
 *
 * CE SCRIPT NE DÉPLOIE RIEN, ET C'EST DÉLIBÉRÉ — il n'appelle ni `wrangler`, ni `git push`, ni
 * la Search Console. La mise en production, la promotion d'un alias Cloudflare et la soumission
 * du sitemap sont des décisions de Philippe, et chacune demande son ordre. Un script capable de
 * basculer tout seul finit par basculer tout seul. Celui-ci VÉRIFIE, puis IMPRIME les commandes
 * exactes, avec ce qu'on doit voir en retour.
 *
 * CE QU'IL PEUT PROUVER, ET CE QU'IL NE PEUT PAS. Ce conteneur n'a pas d'accès réseau sortant :
 * tout ce qui touche au site EN LIGNE — codes HTTP, redirections servies, robots.txt publié — ne
 * peut pas être vérifié d'ici. Ces contrôles-là ne sont pas escamotés : ils sont imprimés en
 * clair, à exécuter côté Philippe, avec la réponse attendue. Un contrôle qu'on ne peut pas faire
 * doit se voir, pas disparaître.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const DIST = "packages/ui/dist";
let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  ÉCHEC ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};
const git = (cmd, defaut = null) => {
  try { return execSync(`git ${cmd}`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return defaut; }
};

console.log("— pré-vol de production —\n");

/* ---- 1. L'arbre, la branche, la synchronisation ---------------------------------------------- */
const sha = git("rev-parse HEAD");
const branche = git("rev-parse --abbrev-ref HEAD");
check("le SHA est lisible", !!sha, sha ?? "");
check("l'arbre de travail est propre", git("status --porcelain") === "",
  "des modifications non validées existent — le contenu publié ne serait rattachable à rien");
/* Rien n'est déployé depuis une branche de travail : la production suit `main`, et seulement lui. */
check("on est sur `main`", branche === "main", `branche courante : ${branche}`);
const distant = git("rev-parse origin/main", null);
check("`main` local et `origin/main` sont au même commit", !!distant && distant === sha,
  `local ${sha?.slice(0, 8)} · distant ${distant?.slice(0, 8) ?? "inconnu"} — faites « git fetch origin main » puis comparez`);

/* ---- 2. L'artefact : présent, complet, et EMPREINTÉ ------------------------------------------ */
check(`le dist existe (${DIST})`, existsSync(DIST));
let empreinte = null, nPages = 0;
if (existsSync(DIST)) {
  const fichiers = [];
  (function marcher(d) {
    for (const e of readdirSync(d).sort()) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) marcher(p); else fichiers.push(p);
    }
  })(DIST);
  nPages = fichiers.filter((f) => f.endsWith(".html")).length;
  /* L'empreinte porte sur le CONTENU, fichier par fichier, dans un ordre stable : c'est elle qui
     permettra de dire, demain, si ce qui est en ligne est bien ce qui a été vérifié. */
  const h = createHash("sha256");
  for (const f of fichiers) { h.update(f.slice(DIST.length)); h.update(readFileSync(f)); }
  empreinte = h.digest("hex");
  check(`le dist contient des pages (${nPages})`, nPages > 100, String(nPages));
}

/* ---- 3. La porte de lancement doit être verte ------------------------------------------------ */
{
  let sortie = "", code = 0;
  try { sortie = execSync(`node porte-lancement.mjs --dist=${DIST}`, { encoding: "utf8" }); }
  catch (e) { code = e.status ?? 1; sortie = (e.stdout ?? "") + (e.stderr ?? ""); }
  const rouges = sortie.split("\n").filter((l) => l.startsWith("  ÉCHEC"));
  check("la porte de lancement est verte sur CE dist", code === 0,
    rouges.join("\n         ") || `code ${code}`);
}

/* ---- 4. Le retour arrière doit être PRÉPARÉ avant, jamais improvisé après -------------------- */
{
  /* La version qui est en ligne AUJOURD'HUI est le filet. Elle doit être identifiée et notée
     AVANT la bascule : la chercher pendant un incident, c'est la chercher trop tard. */
  const precedent = git("rev-parse HEAD~1", null);
  check("un commit de repli est identifiable", !!precedent, precedent?.slice(0, 8) ?? "");
  console.log(`         (repli local : ${precedent?.slice(0, 12) ?? "?"} — à confronter au SHA réellement en ligne, ci-dessous)`);
}

console.log(`\n  empreinte du dist : ${empreinte ?? "—"}`);
console.log(`  SHA               : ${sha ?? "—"}`);
console.log(`  pages             : ${nPages}`);

/* ---- Ce qui ne peut PAS être vérifié d'ici, imprimé plutôt qu'escamoté ----------------------- */
console.log(`
──────────────────────────────────────────────────────────────────────────────
CE QUI RESTE À FAIRE, ET QUI NE PEUT PAS L'ÊTRE DEPUIS CE CONTENEUR
──────────────────────────────────────────────────────────────────────────────
Ce conteneur n'a pas d'accès réseau sortant. Les contrôles suivants portent sur
le site EN LIGNE : ils sont à exécuter côté Philippe, et AUCUN n'est facultatif.

AVANT LA BASCULE
  1. Les deux jobs CI doivent être VERTS sur ce SHA :
       ${sha ?? "<sha>"}
  2. Noter le SHA actuellement EN PRODUCTION (c'est le filet de retour) :
       tableau de bord Cloudflare Pages → projet → Deployments → l'entrée « Production »
  3. Vérifier que Cloudflare déploie bien la branche « main ».

LA BASCULE — ordre explicite de Philippe requis, elle n'est pas automatisée ici :
       npm run release

APRÈS LA BASCULE, dans cet ordre
  4. Les pages principales répondent 200 :
       curl -sS -o /dev/null -w "%{http_code} %{url_effective}\\n" -L \\
         https://mydogcanfly.com/ \\
         https://mydogcanfly.com/fr/ \\
         https://mydogcanfly.com/airlines/air-france/ \\
         https://mydogcanfly.com/fr/countries/france/
  5. robots.txt ne referme pas le site :
       curl -sS https://mydogcanfly.com/robots.txt
       → doit contenir « Allow: / » et AUCUN « Disallow: / » seul
  6. Le sitemap répond et n'est pas vide :
       curl -sS https://mydogcanfly.com/sitemap.xml | head -20
  7. Une page au hasard ne porte pas noindex :
       curl -sS https://mydogcanfly.com/airlines/air-france/ | grep -i "noindex" || echo "aucun noindex — correct"
  8. Trois anciennes URL suivent bien leur 301 :
       curl -sS -o /dev/null -w "%{http_code} → %{redirect_url}\\n" \\
         https://mydogcanfly.com/tools/iata-dog-crate-calculator/
       → doit répondre 301 vers /tools/crate/
  9. La 404 voulue est restée une 404 :
       curl -sS -o /dev/null -w "%{http_code}\\n" https://mydogcanfly.com/tools/is-it-too-hot-for-my-dog/
       → doit répondre 404. La rediriger est explicitement interdit.

SEULEMENT ENSUITE, et sur ordre séparé de Philippe
 10. Soumettre le sitemap à la Search Console, puis surveiller pendant 48 h les
     erreurs d'indexation et les 404 signalées.
──────────────────────────────────────────────────────────────────────────────`);

console.log(`\n${pass} condition(s) locale(s) OK, ${fail} en échec`);
if (fail > 0) { console.log("\nNE PAS BASCULER."); process.exit(1); }
console.log("\nLes conditions locales sont réunies. La bascule reste la décision de Philippe.");
