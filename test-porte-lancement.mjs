#!/usr/bin/env node
/**
 * Les VINGT ET UNE contre-épreuves de la porte de lancement — conception v6, § 5, feu vert Codex.
 *
 *   node test-porte-lancement.mjs --dist-production=<dist scellé production> --dist-preview=<dist scellé preview>
 *
 * Chaque garantie est VUE ROUGIR POUR SA CAUSE : mutation appliquée au dist (fichiers touchés
 * sauvegardés puis restaurés), la VRAIE porte relancée dans un PROCESSUS NEUF (aucun cache de
 * modules ne peut faire juger une ancienne copie — v6, P1), sortie 1 exigée ET le diagnostic
 * attendu exigé dans la sortie. Une mutation qui ne s'applique pas est un ÉCHEC : elle ne
 * prouverait rien. À la fin, la porte doit être VERTE sur les deux dists : la preuve que
 * chaque restauration a réellement restauré.
 *
 * Les deux dists sont OBLIGATOIRES : les contre-épreuves 13-14 jugent un artefact de
 * préversion — sans lui, elles ne tourneraient pas, et un contrôle qui ne tourne pas en
 * silence est indiscernable d'un contrôle vert.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { validerCommandeDeploiement, commandeDeploiement } from "./packages/knowledge/scripts/deployer-production.mjs";
import { empreinteDist, compterPages } from "./packages/knowledge/scripts/lib/provenance.mjs";

const args = process.argv.slice(2);
const lireArg = (nom) => args.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
const DIST_PROD = lireArg("dist-production");
const DIST_PREV = lireArg("dist-preview");
if (!DIST_PROD || !DIST_PREV) {
  console.error("[contre-porte] usage : node test-porte-lancement.mjs --dist-production=<dist> --dist-preview=<dist>");
  console.error("[contre-porte] les DEUX artefacts sont obligatoires : 13-14 jugent la préversion.");
  process.exit(2);
}

let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

/** La VRAIE porte, dans un PROCESSUS NEUF. */
const porte = (dist, attendu, sha = null) => {
  const argv = ["porte-lancement.mjs", `--dist=${dist}`, `--attendu=${attendu}`];
  if (sha) argv.push(`--sha=${sha}`);
  const r = spawnSync(process.execPath, argv, { encoding: "utf8" });
  return { code: r.status, sortie: (r.stdout ?? "") + (r.stderr ?? "") };
};

/**
 * RESCELLER APRÈS MUTATION, ET POURQUOI CE N’EST PAS UN AFFAIBLISSEMENT.
 *
 * L’étape 0 de la porte refuse tout dist dont l’empreinte a bougé depuis le scellement. Sans ce
 * geste-ci, TOUTES les mutations de dist rougiraient en « 0 provenance » : la porte s’arrêterait
 * avant P1..P8 et les vingt contre-épreuves prouveraient une seule chose, vingt fois. On remet
 * donc la carte en accord avec les octets mutés — l’empreinte du dist et le décompte de pages,
 * RIEN d’autre : ni le SHA, ni les empreintes d’ENTRÉES, ni la propreté de l’arbre —, afin que
 * chaque garantie SEO soit jugée pour elle-même.
 *
 * Ce que ce geste ne cache pas : la contre-épreuve 11 mute le dist SANS resceller, et c’est
 * exactement là que l’empreinte doit rougir. Les deux moitiés du contrat sont donc vues.
 */
function resceller(dist) {
  const chemin = join(dist, ".provenance.json");
  const carte = JSON.parse(readFileSync(chemin, "utf8"));
  carte.dist = empreinteDist(dist);
  carte.pages = compterPages(dist);
  writeFileSync(chemin, JSON.stringify(carte, null, 2) + "\n");
}

/** Mutation encadrée : sauvegarde des fichiers touchés, application VÉRIFIÉE, porte, restauration. */
function contreEpreuve({ nom, dist, mode, sha = null, fichiers = [], muter, attendu, rescelle = false }) {
  const touches = rescelle ? [...fichiers, join(dist, ".provenance.json")] : fichiers;
  const sauvegardes = touches.map((f) => [f, existsSync(f) ? readFileSync(f) : null]);
  try {
    if (muter) {
      const applique = muter();
      if (applique === false) { echec(nom, "la mutation ne s'applique pas (ancre introuvable) — elle ne prouverait rien"); return; }
    }
    if (rescelle) resceller(dist);
    const { code, sortie } = porte(dist, mode, sha);
    if (code === 0) { echec(nom, "la porte est restée VERTE sous la mutation"); return; }
    const manquants = [attendu].flat().filter((a) => !sortie.includes(a));
    if (manquants.length) {
      echec(nom, `rouge, mais pour un AUTRE diagnostic — attendu « ${manquants[0]} » ; vu :\n${sortie.split("\n").filter((l) => l.includes("✗")).slice(0, 4).join("\n")}`);
      return;
    }
    ok(nom);
  } finally {
    for (const [f, contenu] of sauvegardes) if (contenu !== null) writeFileSync(f, contenu);
  }
}
/** Retire du sitemap le BLOC <url>…</url> qui porte cette adresse. Faux si l'adresse n'y est pas. */
function retirerUrlDuSitemap(fichier, url) {
  const t = readFileSync(fichier, "utf8");
  const debut = t.indexOf("<urlset");
  const bloc = t.match(new RegExp("[ \\t]*<url>[\\s\\S]*?</url>\\n", "g"))
    ?.find((b) => b.includes("<loc>" + url + "</loc>"));
  if (debut < 0 || !bloc) return false;
  writeFileSync(fichier, t.replace(bloc, ""));
  return true;
}

const remplacerDans = (fichier, ancre, remplacement) => {
  const t = readFileSync(fichier, "utf8");
  if (!t.includes(ancre)) return false;
  writeFileSync(fichier, t.replace(ancre, remplacement));
  return true;
};

/* ---- Ligne de départ : les deux artefacts sont VERTS dans leur mode -------------------------- */
{
  const p = porte(DIST_PROD, "production");
  if (p.code !== 0) { echec("départ production", `la porte doit être VERTE avant les mutations :\n${p.sortie.split("\n").slice(-8).join("\n")}`); }
  else ok("départ : porte VERTE sur l'artefact production");
  const v = porte(DIST_PREV, "preview");
  if (v.code !== 0) { echec("départ preview", `la porte doit être VERTE avant les mutations :\n${v.sortie.split("\n").slice(-8).join("\n")}`); }
  else ok("départ : porte VERTE sur l'artefact preview");
  if (defauts) { console.error("\n[contre-porte] ÉCHEC — pas de ligne de départ verte, les mutations ne prouveraient rien."); process.exit(1); }
}

const P = (f) => join(DIST_PROD, f);
const V = (f) => join(DIST_PREV, f);
const SHA_PROD = JSON.parse(readFileSync(P(".provenance.json"), "utf8")).sha;

/* 1 — un noindex réintroduit sur une page publique → P1 rougit et nomme la page.
   MESURÉ : une page indexable ne porte AUCUNE balise robots — il n'y a donc rien à remplacer,
   la balise s'insère après <head>. (La première rédaction ancrait sur « <meta name="robots" » :
   ancre introuvable, la contre-épreuve n'aurait rien prouvé — faute nommée, pas effacée.) */
contreEpreuve({
  nom: "1 noindex injecté dans le <head> d'une page publique", dist: DIST_PROD, mode: "production", rescelle: true,
  fichiers: [P("airlines/air-france/index.html")],
  muter: () => remplacerDans(P("airlines/air-france/index.html"), "<head>", "<head><meta name=\"robots\" content=\"noindex, follow\">"),
  attendu: ["P1", "airlines/air-france"],
});

/* 2 — robots.txt passé à « Disallow: / » en mode production → P2 rougit. */
contreEpreuve({
  nom: "2 « Disallow: / » en production", dist: DIST_PROD, mode: "production", rescelle: true,
  fichiers: [P("robots.txt")],
  muter: () => remplacerDans(P("robots.txt"), "Disallow: /lab/", "Disallow: /"),
  attendu: ["P2"],
});

/* 3 — une canonique réécrite vers un hôte de préversion → P4 rougit. */
contreEpreuve({
  nom: "3 canonique vers un hôte de préversion", dist: DIST_PROD, mode: "production", rescelle: true,
  fichiers: [P("airlines/air-france/index.html")],
  muter: () => remplacerDans(P("airlines/air-france/index.html"),
    "<link rel=\"canonical\" href=\"https://mydogcanfly.com/airlines/air-france/\">",
    "<link rel=\"canonical\" href=\"https://c069856d.mydogcanfly-v2-preview.pages.dev/airlines/air-france/\">"),
  attendu: ["P4", "PRÉVERSION"],
});

/* 4 — un hreflang cassé (l'alternate pt retiré d'une seule page) → P5 rougit. */
contreEpreuve({
  nom: "4 alternate pt retiré d'une seule page", dist: DIST_PROD, mode: "production", rescelle: true,
  fichiers: [P("airlines/air-france/index.html")],
  muter: () => remplacerDans(P("airlines/air-france/index.html"),
    "<link rel=\"alternate\" hreflang=\"pt\" href=\"https://mydogcanfly.com/pt/airlines/air-france/\">", ""),
  attendu: ["P5"],
});

/* 5 — une URL 404 ajoutée au sitemap → P3 rougit (surnuméraire, aucune page construite). */
contreEpreuve({
  nom: "5 URL fantôme ajoutée au sitemap", dist: DIST_PROD, mode: "production", rescelle: true,
  fichiers: [P("sitemap-en.xml")],
  muter: () => remplacerDans(P("sitemap-en.xml"), "</urlset>", "  <url>\n    <loc>https://mydogcanfly.com/nexiste-pas/</loc>\n  </url>\n</urlset>"),
  attendu: ["P3", "/nexiste-pas/"],
});

/* 6 — une règle de redirection bouclée ajoutée à _redirects → P7 rougit. */
contreEpreuve({
  nom: "6 boucle ajoutée à _redirects", dist: DIST_PROD, mode: "production", rescelle: true,
  fichiers: [P("_redirects")],
  muter: () => { writeFileSync(P("_redirects"), readFileSync(P("_redirects"), "utf8") + "\n/boucle-a/ /boucle-b/ 301\n/boucle-b/ /boucle-a/ 301\n"); return true; },
  attendu: ["P7", "boucle-a"],
});

/* 7 — une question ajoutée au JSON-LD FAQ sans texte visible → P8 rougit. */
contreEpreuve({
  nom: "7 question FAQ invisible ajoutée au JSON-LD", dist: DIST_PROD, mode: "production", rescelle: true,
  fichiers: [P("airlines/air-france/index.html")],
  muter: () => remplacerDans(P("airlines/air-france/index.html"), "\"@type\":\"FAQPage\",\"mainEntity\":[",
    "\"@type\":\"FAQPage\",\"mainEntity\":[{\"@type\":\"Question\",\"name\":\"Question fantôme jamais rendue ?\",\"acceptedAnswer\":{\"@type\":\"Answer\",\"text\":\"Réponse que personne ne voit.\"}},"),
  attendu: ["P8", "fantôme"],
});

/* 8 — le dist de PRODUCTION jugé en --attendu=preview → refus : jamais vert dans les deux modes. */
contreEpreuve({
  nom: "8 artefact production jugé en mode preview", dist: DIST_PROD, mode: "preview",
  attendu: ["les deux verdicts ne peuvent pas être verts sur le même artefact"],
});

/* 9 — une source modifiée NON COMMITÉE après le build → refus (propreté/empreintes d'entrées). */
contreEpreuve({
  nom: "9 source modifiée non commitée après le build", dist: DIST_PROD, mode: "production",
  fichiers: ["packages/ui/src/lib/env.ts"],
  muter: () => { writeFileSync("packages/ui/src/lib/env.ts", readFileSync("packages/ui/src/lib/env.ts", "utf8") + "\n// contre-épreuve 9\n"); return true; },
  attendu: ["0 provenance", "entrées"],
});

/* 10 — un NOUVEAU COMMIT après le build → refus par le SHA (le déployeur passe toujours --sha=HEAD). */
contreEpreuve({
  nom: "10 nouveau commit après le build (SHA demandé ≠ carte)", dist: DIST_PROD, mode: "production",
  sha: "0123456789abcdef0123456789abcdef01234567",
  attendu: ["SHA de la carte", "SHA demandé"],
});

/* 11 — un fichier du dist modifié APRÈS la porte → l'empreinte du dist rougit. */
contreEpreuve({
  nom: "11 octet ajouté au dist après scellement", dist: DIST_PROD, mode: "production",
  fichiers: [P("index.html")],
  muter: () => { writeFileSync(P("index.html"), readFileSync(P("index.html"), "utf8") + "<!-- -->"); return true; },
  attendu: ["0 provenance"],
});

/* 12 — un ancien dist COHÉRENT mais d'un autre SHA → refus (empreinte juste, SHA étranger). */
contreEpreuve({
  nom: "12 dist cohérent d'un autre SHA présenté au déploiement", dist: DIST_PROD, mode: "production",
  sha: SHA_PROD.replace(/^./, SHA_PROD[0] === "0" ? "1" : "0"),
  attendu: ["SHA de la carte", "un ancien dist cohérent n'est pas le dist demandé"],
});

/* 13 — « Disallow: / » introduit dans le robots de PRÉVERSION → V2 rougit. */
contreEpreuve({
  nom: "13 « Disallow: / » en préversion", dist: DIST_PREV, mode: "preview", rescelle: true,
  fichiers: [V("robots.txt")],
  muter: () => { writeFileSync(V("robots.txt"), readFileSync(V("robots.txt"), "utf8") + "Disallow: /\n"); return true; },
  attendu: ["V2"],
});

/* 14 — une ligne Sitemap: dans le robots de préversion → V3 rougit. */
contreEpreuve({
  nom: "14 ligne Sitemap: en préversion", dist: DIST_PREV, mode: "preview", rescelle: true,
  fichiers: [V("robots.txt")],
  muter: () => { writeFileSync(V("robots.txt"), readFileSync(V("robots.txt"), "utf8") + "Sitemap: https://mydogcanfly.com/sitemap.xml\n"); return true; },
  attendu: ["V3"],
});

/* 15 — la redirection Alaska retirée du Worker du dist, registre scellé INCHANGÉ → la
   comparaison bidirectionnelle rougit et NOMME l'entrée (le test auto-alimenté ne verrait rien). */
contreEpreuve({
  nom: "15 entrée Alaska retirée du Worker, registre intact", dist: DIST_PROD, mode: "production", rescelle: true,
  fichiers: [P("_worker.js")],
  muter: () => remplacerDans(P("_worker.js"), "  [\"/alaska-airlines-dog-policy/\", \"/airlines/alaska/\"],\n", ""),
  attendu: ["règle scellée absente du dist", "alaska-airlines-dog-policy"],
});

/* 16 — _routes.json modifié pour qu'une ancienne URL n'atteigne plus le Worker → le routage
   RÉEL rougit : l'URL cesse de répondre 301. */
contreEpreuve({
  nom: "16 _routes.json contourne le Worker pour une ancienne URL", dist: DIST_PROD, mode: "production", rescelle: true,
  fichiers: [P("_routes.json")],
  muter: () => remplacerDans(P("_routes.json"), "\"exclude\": [", "\"exclude\": [\n    \"/alaska-airlines-dog-policy/\","),
  attendu: ["attendu 301", "alaska-airlines-dog-policy"],
});

/* 17 — une règle REMPLACÉE à effectif constant → les décomptes ne bougent pas, le REGISTRE rougit. */
contreEpreuve({
  nom: "17 règle troquée à effectif constant (cible Alaska → KLM)", dist: DIST_PROD, mode: "production", rescelle: true,
  fichiers: [P("_worker.js")],
  muter: () => remplacerDans(P("_worker.js"), "[\"/alaska-airlines-dog-policy/\", \"/airlines/alaska/\"]", "[\"/alaska-airlines-dog-policy/\", \"/airlines/klm/\"]"),
  attendu: ["règle du dist hors scellé", "règle scellée absente du dist"],
});

/* 17 bis — une URL retirée d'un sitemap ENFANT, index intact → l'égalité d'ensembles de P3 rougit. */
contreEpreuve({
  nom: "17bis URL de page retirée d'un sitemap enfant", dist: DIST_PROD, mode: "production", rescelle: true,
  fichiers: [P("sitemap-en.xml")],
  muter: () => retirerUrlDuSitemap(P("sitemap-en.xml"), "https://mydogcanfly.com/airlines/air-france/"),
  attendu: ["P3", "page hors sitemap"],
});

/* 18 — la commande de déploiement privée de --branch=main → AUCUN déploiement, refus avant réseau. */
{
  const cmd = commandeDeploiement(SHA_PROD).filter((a) => !a.startsWith("--branch="));
  const problemes = validerCommandeDeploiement(cmd);
  if (problemes.length && problemes[0].includes("aucun déploiement autorisé")) ok("18 commande sans --branch=main refusée avant tout appel réseau");
  else echec("18 commande sans --branch=main", `la validation laisse passer : ${JSON.stringify(problemes)}`);
  const complete = validerCommandeDeploiement(commandeDeploiement(SHA_PROD));
  if (complete.length) echec("18 (sens inverse)", `la commande COMPLÈTE est refusée à tort : ${complete.join(" ; ")}`);
}

/* 19 — une exclusion de _routes.json TROQUÉE à effectif constant → la représentation canonique
   scellée rougit, même si aucune sonde n'exerce le chemin troqué. */
contreEpreuve({
  nom: "19 exclusion _routes.json troquée à effectif constant", dist: DIST_PROD, mode: "production", rescelle: true,
  fichiers: [P("_routes.json")],
  muter: () => remplacerDans(P("_routes.json"), "\"/presskit/*\"", "\"/presskitX/*\""),
  attendu: ["_routes.json", "presskit"],
});

/* 20 — une fonction dynamique du Worker modifiée, TABLES INTACTES → l'empreinte du fichier,
   scellée au registre, rougit. */
contreEpreuve({
  nom: "20 fonction dynamique modifiée, tables intactes", dist: DIST_PROD, mode: "production", rescelle: true,
  fichiers: [P("_worker.js")],
  muter: () => remplacerDans(P("_worker.js"), "function presskitTarget(path) {", "function presskitTarget(path) { /* mutation 20 */"),
  attendu: ["_worker.js", "empreinte", "hors rescellement nommé"],
});

/* ---- Ligne d'arrivée : tout restauré, la porte reste VERTE sur les deux artefacts ------------ */
{
  const p = porte(DIST_PROD, "production");
  if (p.code !== 0) echec("arrivée production", `une restauration a fui — la porte reste rouge :\n${p.sortie.split("\n").filter((l) => l.includes("✗")).slice(0, 5).join("\n")}`);
  else ok("arrivée : porte de nouveau VERTE sur l'artefact production — chaque mutation a été restaurée");
  const v = porte(DIST_PREV, "preview");
  if (v.code !== 0) echec("arrivée preview", "une restauration a fui côté préversion");
  else ok("arrivée : porte de nouveau VERTE sur l'artefact preview");
}

if (defauts) { console.error(`\n[contre-porte] ÉCHEC — ${defauts} contre-épreuve(s) en défaut sur 21`); process.exit(1); }
console.log("\n[contre-porte] 21 contre-épreuves : chaque garantie a rougi pour SA cause, dans un processus neuf, et tout est restauré.");
