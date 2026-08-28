#!/usr/bin/env node
/**
 * deployer-production.mjs — TOUT le cycle de mise en production, dans UN processus.
 * Conception : DOSSIER-PORTE-LANCEMENT.md § 6 (v3→v6, feu vert Codex sur v6).
 *
 * NE SE LANCE QUE SUR ORDRE EXPLICITE DU PROPRIÉTAIRE — et cet ordre couvre le cycle entier,
 * rollback automatique compris : une seule décision, pas deux. Jamais lancé par la CI.
 *
 *   node packages/knowledge/scripts/deployer-production.mjs --sha=<sha de main> [--repetition]
 *
 * Le cycle :
 *   1. point de retour : le déploiement production ACTIF est mémorisé (API Pages) — sans point
 *      de retour vérifié, refus de déployer ;
 *   2. scellement : provenance valide, arbre propre, SHA courant = SHA demandé = SHA de la
 *      carte, PUBLIC_SITE_ENV=production, PUBLIC_API_BASE VIDE (same-origin : la seule forme
 *      déployable — une sentinelle CI est un artefact de jugement, jamais de déploiement) ;
 *   3. la PORTE, --attendu=production --sha, P9 (audit + liens) compris — verte ou rien ;
 *   4. re-vérification de l'empreinte du dist IMMÉDIATEMENT avant l'envoi : le verdict ne se
 *      transfère pas à d'autres octets ;
 *   5. déploiement des octets scellés, SANS reconstruction, commande VALIDÉE avant tout appel
 *      réseau : --project-name + --branch=main + --commit-hash exigés (sans --branch, Wrangler
 *      peut déduire la branche courante et produire une preview validée à tort) ;
 *   6. QUATRE CONCORDANCES avant le contre-test : production_branch === "main" ; le déploiement
 *      créé est de type production ; il est devenu le déploiement ACTIF ; son commit est le SHA
 *      de la provenance. Une discordance → rollback immédiat ;
 *   7. contre-test HTTP EXHAUSTIF sur la production servie (toutes les URL des sitemaps :
 *      statut, meta robots, X-Robots-Tag, canonique ; les pages noindex admises ; robots.txt ;
 *      chaque redirection et disparition scellées) — un échantillon passerait à côté d'une
 *      Transform Rule conditionnée par chemin ;
 *   8. au PREMIER défaut : rollback AUTOMATIQUE vers le déploiement mémorisé (API Pages),
 *      puis rollback CONSTATÉ (relecture du déploiement actif + santé) — jamais « demandé »,
 *      toujours « constaté » ;
 *   9. la Search Console est INTERDITE dans tous les cas d'échec — écart HTTP, rollback réussi
 *      ou rollback lui-même en échec ; et même en succès elle reste un geste séparé, sur ordre.
 *
 * --repetition : s'arrête après l'étape 4 (aucun appel réseau) — la répétition générale que la
 * contre-épreuve 18 et le rejeu local exercent.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { requireNode } from "./lib/require-node.mjs";
import { verifierProvenance } from "./lib/provenance.mjs";

export const PROJET_PAGES = "mydogcanfly-v2-preview";
export const BRANCHE_PRODUCTION = "main";
export const DOMAINE_PRODUCTION = "https://mydogcanfly.com";
const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const DIST = join(REPO_ROOT, "packages", "ui", "dist");
const log = (m) => process.stderr.write(`[deployer] ${m}\n`);

/**
 * LA commande de déploiement, construite ici et NULLE PART ailleurs.
 * `validerCommandeDeploiement` refuse toute forme privée d'un des trois drapeaux — c'est la
 * garde que la contre-épreuve 18 exerce : sans `--branch=main`, AUCUN déploiement, refus avant
 * tout appel réseau.
 */
export function commandeDeploiement(sha) {
  return ["pages", "deploy", DIST,
    `--project-name=${PROJET_PAGES}`, `--branch=${BRANCHE_PRODUCTION}`, `--commit-hash=${sha}`];
}
export function validerCommandeDeploiement(args) {
  const problemes = [];
  if (!args.includes(`--branch=${BRANCHE_PRODUCTION}`)) {
    problemes.push(`--branch=${BRANCHE_PRODUCTION} ABSENT : Wrangler déduirait la branche courante et pourrait produire une PREVIEW que le contrôle « production inchangée » validerait à tort — aucun déploiement autorisé`);
  }
  if (!args.includes(`--project-name=${PROJET_PAGES}`)) problemes.push(`--project-name=${PROJET_PAGES} absent`);
  if (!args.some((a) => /^--commit-hash=[0-9a-f]{40}$/.test(a))) problemes.push("--commit-hash=<sha complet> absent ou malformé");
  return problemes;
}

/* ---- Exécution ------------------------------------------------------------------------------- */
const estCli = process.argv[1]?.endsWith("deployer-production.mjs");
if (estCli) await principal();

async function principal() {
  requireNode("le déploiement de production");
  const args = process.argv.slice(2);
  const REPETITION = args.includes("--repetition");
  const SHA = args.find((a) => a.startsWith("--sha="))?.slice(6);
  const inconnus = args.filter((a) => !a.startsWith("--sha=") && a !== "--repetition");
  if (inconnus.length || !/^[0-9a-f]{40}$/.test(SHA ?? "")) {
    log("usage : node packages/knowledge/scripts/deployer-production.mjs --sha=<sha complet de main> [--repetition]");
    process.exit(2);
  }
  const die = (etape, motif) => {
    log(`ÉCHEC (${etape}) : ${motif}`);
    log("La Search Console reste INTERDITE tant qu'un cycle n'est pas intégralement vert.");
    process.exit(1);
  };

  /* 2. Scellement — avant même le point de retour : inutile d'appeler le réseau pour un
     artefact qu'on refusera. */
  {
    const ecarts = verifierProvenance(DIST, "complet");
    if (ecarts.length) die("scellement", `provenance invalide — ${ecarts.join(" ; ")}`);
    const prov = JSON.parse(readFileSync(join(DIST, ".provenance.json"), "utf8"));
    if (!prov.entrees_propres) die("scellement", "artefact construit d'un arbre SALE");
    if (prov.sha !== SHA) die("scellement", `SHA de la carte ${prov.sha} ≠ SHA demandé ${SHA}`);
    const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT }).stdout.toString().trim();
    if (head !== SHA) die("scellement", `HEAD ${head.slice(0, 12)}… ≠ SHA demandé — un nouveau commit est arrivé après le build`);
    if (prov.parametres?.PUBLIC_SITE_ENV !== "production") die("scellement", "l'artefact n'est pas un build production");
    if ((prov.parametres?.PUBLIC_API_BASE ?? "") !== "") {
      die("scellement", `PUBLIC_API_BASE=« ${prov.parametres.PUBLIC_API_BASE} » : seul un bundle SAME-ORIGIN se déploie — une sentinelle CI est un artefact de jugement`);
    }
    log(`scellement OK : artefact ${SHA.slice(0, 12)}…, production, same-origin, arbre propre`);
  }

  /* 3. La porte, verte ou rien — P9 compris puisque le dist est le canonique. */
  {
    const r = spawnSync(process.execPath, [join(REPO_ROOT, "porte-lancement.mjs"),
      `--dist=${DIST}`, "--attendu=production", `--sha=${SHA}`], { cwd: REPO_ROOT, stdio: ["ignore", 2, 2] });
    if (r.status !== 0) die("porte", "la porte est ROUGE — aucun déploiement (voir ci-dessus)");
  }

  /* 4. L'empreinte, revérifiée juste avant l'envoi : le verdict porte sur CES octets. */
  {
    const ecarts = verifierProvenance(DIST, "complet");
    if (ecarts.length) die("empreinte", `le dist a bougé APRÈS la porte — ${ecarts.join(" ; ")}`);
  }

  /* 5-pré. La commande, validée AVANT tout réseau — contre-épreuve 18. */
  const cmd = commandeDeploiement(SHA);
  {
    const problemes = validerCommandeDeploiement(cmd);
    if (problemes.length) die("commande", problemes.join(" ; "));
  }

  if (REPETITION) {
    log("RÉPÉTITION terminée : scellement, porte, empreinte et commande valides — aucun appel réseau effectué.");
    log(`La commande qui serait exécutée : npx wrangler ${cmd.join(" ")}`);
    process.exit(0);
  }

  /* ---- À partir d'ici : réseau. Jeton et compte exigés. -------------------------------------- */
  const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
  const COMPTE = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!TOKEN || !COMPTE) die("réseau", "CLOUDFLARE_API_TOKEN et CLOUDFLARE_ACCOUNT_ID requis pour le point de retour, les concordances et le rollback");
  const api = async (chemin, options = {}) => {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${COMPTE}/pages/projects/${PROJET_PAGES}${chemin}`, {
      ...options, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...options.headers },
    });
    const corps = await res.json();
    if (!corps.success) throw new Error(`API Pages ${chemin} : ${JSON.stringify(corps.errors)}`);
    return corps.result;
  };
  const deploiementActif = async () => {
    const ds = await api("/deployments?env=production&per_page=5");
    return ds.find((d) => d.latest_stage?.status === "success") ?? ds[0];
  };

  /* 1. Le point de retour, mémorisé et vérifié. */
  let retour;
  try {
    const projet = await api("");
    if (projet.production_branch !== BRANCHE_PRODUCTION) die("point de retour", `production_branch=« ${projet.production_branch} » ≠ « ${BRANCHE_PRODUCTION} »`);
    retour = await deploiementActif();
    if (!retour?.id) die("point de retour", "aucun déploiement production antérieur réussi — pas de point de retour, pas de déploiement");
    log(`point de retour mémorisé : déploiement ${retour.id} (${retour.deployment_trigger?.metadata?.commit_hash?.slice(0, 12) ?? "?"}…)`);
  } catch (e) { die("point de retour", e.message); }

  /* 5. Le déploiement des octets scellés — la commande validée, telle quelle. */
  log(`déploiement : npx wrangler ${cmd.join(" ")}`);
  const dep = spawnSync("npx", ["wrangler", ...cmd], { cwd: REPO_ROOT, stdio: ["ignore", "pipe", 2] });
  if (dep.status !== 0) die("déploiement", "wrangler a échoué — la production active reste le point de retour");

  const rollback = async (motif) => {
    log(`ROLLBACK automatique (${motif}) vers ${retour.id}…`);
    try {
      await api(`/deployments/${retour.id}/rollback`, { method: "POST" });
      const actif = await deploiementActif();
      if (actif?.id !== retour.id) die("rollback", `demandé mais NON CONSTATÉ : actif=${actif?.id} ≠ ${retour.id}`);
      const sante = await fetch(`${DOMAINE_PRODUCTION}/`);
      if (!sante.ok) die("rollback", `constaté côté API mais la racine répond ${sante.status}`);
      die("contre-test", `${motif} — rollback CONSTATÉ vers ${retour.id}, production revenue à l'état antérieur`);
    } catch (e) { die("rollback", `échec du rollback lui-même : ${e.message} — INTERVENTION MANUELLE REQUISE, Search Console toujours interdite`); }
  };

  /* 6. Les quatre concordances. */
  try {
    const projet = await api("");
    if (projet.production_branch !== BRANCHE_PRODUCTION) return await rollback(`production_branch=« ${projet.production_branch} »`);
    const actif = await deploiementActif();
    if (actif.environment !== "production") return await rollback(`déploiement actif de type « ${actif.environment} »`);
    if (actif.id === retour.id) return await rollback("le déploiement envoyé n'est PAS devenu l'actif");
    const commit = actif.deployment_trigger?.metadata?.commit_hash;
    if (commit !== SHA) return await rollback(`commit du déploiement actif ${commit} ≠ ${SHA}`);
    log(`concordances OK : branche main, type production, actif ${actif.id}, commit ${SHA.slice(0, 12)}…`);
  } catch (e) { return await rollback(`concordances illisibles : ${e.message}`); }

  /* 7. Le contre-test HTTP exhaustif. */
  {
    const defauts = [];
    const admis = JSON.parse(readFileSync(join(REPO_ROOT, "porte-noindex-admis.json"), "utf8")).motifs.map((m) => new RegExp(m.motif));
    const scelle = JSON.parse(readFileSync(join(REPO_ROOT, "porte-routage-scelle.json"), "utf8"));
    const robots = await fetch(`${DOMAINE_PRODUCTION}/robots.txt`).then((r) => r.text()).catch((e) => null);
    if (!robots || /^\s*Disallow:\s*\/\s*$/m.test(robots) || !/^Sitemap:/m.test(robots)) defauts.push("robots.txt servi non conforme");
    const urls = [];
    const index = await fetch(`${DOMAINE_PRODUCTION}/sitemap.xml`).then((r) => r.text());
    for (const sm of [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])) {
      const enfant = await fetch(sm).then((r) => r.text());
      for (const u of [...enfant.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])) urls.push(u);
    }
    log(`contre-test : ${urls.length} URL de sitemaps + redirections scellées…`);
    const sonderPage = async (u) => {
      const res = await fetch(u, { redirect: "manual" });
      if (res.status !== 200) return `${u} → ${res.status}`;
      const xr = res.headers.get("x-robots-tag") ?? "";
      if (/noindex/i.test(xr)) return `${u} → X-Robots-Tag « ${xr} » (une Transform Rule désindexe cette page)`;
      const html = await res.text();
      if (/<meta name="robots" content="[^"]*noindex/.test(html)) return `${u} → meta noindex SERVIE`;
      const canon = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
      if (canon !== u) return `${u} → canonique servie « ${canon} »`;
      return null;
    };
    const lots = 20;
    for (let i = 0; i < urls.length && !defauts.length; i += lots) {
      const r = await Promise.all(urls.slice(i, i + lots).map(sonderPage));
      for (const d of r) if (d) defauts.push(d);
    }
    if (!defauts.length) {
      for (const { source, cible } of scelle.familles.legacy_redirects) {
        const res = await fetch(DOMAINE_PRODUCTION + source, { redirect: "manual" });
        const loc = res.headers.get("location")?.replace(DOMAINE_PRODUCTION, "");
        if (res.status !== 301 || (loc !== cible && loc !== DOMAINE_PRODUCTION + cible)) { defauts.push(`${source} → ${res.status} ${loc ?? ""} (attendu 301 ${cible})`); break; }
      }
      for (const { source } of scelle.familles.gone_exact) {
        const res = await fetch(DOMAINE_PRODUCTION + source, { redirect: "manual" });
        if (res.status !== 410) { defauts.push(`${source} → ${res.status} (attendu 410)`); break; }
      }
      /* Les pages volontairement noindex : servies, ET toujours noindex. */
      for (const rel of ["/404.html", "/airports/abj/", "/tools/fiche/"]) {
        const res = await fetch(DOMAINE_PRODUCTION + rel, { redirect: "manual" });
        const html = res.ok ? await res.text() : "";
        if (res.ok && !/noindex/.test(html) && admis.some((re) => re.test(rel.endsWith("/") ? rel + "index.html" : rel))) {
          defauts.push(`${rel} : admise noindex mais servie SANS noindex`);
        }
      }
    }
    if (defauts.length) return await rollback(`premier défaut HTTP : ${defauts[0]}`);
    log(`contre-test HTTP intégralement vert (${urls.length} pages, redirections et disparitions comprises).`);
  }

  log("CYCLE VERT. La production sert les octets scellés. La Search Console reste un geste séparé, sur ordre propriétaire.");
  process.exit(0);
}
