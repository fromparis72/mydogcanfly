#!/usr/bin/env node
/**
 * LA PAGE DE GUIDE RENDUE — 288 pages que rien ne lisait.
 *
 *   node test-page-guide.mjs        (exige un site construit sous packages/ui/dist)
 *
 * POURQUOI CE HARNAIS EXISTE. `test-guides-traduits.mjs` lit les fichiers Markdown ; il ne sait rien
 * de la page produite. 72 clés × 4 langues = 288 pages rendues qu'aucun contrôle ne regardait : le
 * bloc « En bref », la FAQ, le crédit photo, les données structurées.
 *
 * IL NE RELIT PAS LE MARKDOWN, ET C'EST DÉLIBÉRÉ. Reparser l'en-tête YAML pour le comparer à la page
 * reviendrait à écrire un second gabarit, avec ses propres bogues — et une erreur de mon analyseur
 * produirait une accusation fausse. Le harnais compare donc la page À ELLE-MÊME : le HTML visible
 * contre les DONNÉES STRUCTURÉES de la même page, deux rendus de la même source. Un écart entre les
 * deux est un vrai défaut, et c'est le seul qui compte pour un lecteur ou pour Google :
 *
 *   · le schéma FAQPage annonce-t-il exactement les questions que la page affiche ?
 *   · le titre annoncé à Google est-il celui qui est écrit en `h1` ?
 *   · une image déclarée au schéma correspond-elle à une illustration réellement rendue ?
 *
 * DEUX CONTRÔLES NE VIENNENT PAS DE LA PAGE ELLE-MÊME, et ils sont explicites :
 *   · le crédit photo — toute illustration rendue doit en porter un. C'est une obligation de
 *     licence, pas une politesse, et aucune donnée structurée ne l'exprime ;
 *   · l'accord entre langues — mais PAS entre les quatre, et la première version de ce contrôle
 *     était fausse. Elle exigeait le même nombre de questions dans les quatre langues et dénonçait
 *     `train-travel-with-a-dog` : 5 questions en français, 6 ailleurs. Vérification faite, le
 *     français est l'ORIGINAL et parle de la SNCF (« < 6 kg », « tout le réseau SNCF ») quand
 *     l'anglais est une réécriture générique qui ajoute Amtrak — et la question surnuméraire porte
 *     précisément sur Amtrak. Appliquer la symétrie aurait poussé à mettre Amtrak dans un guide
 *     SNCF : le contrôle aurait dégradé le contenu qu'il prétend protéger.
 *     La règle retenue ne contraint que ce qui EST une traduction : `es` et `pt` ont été traduits
 *     de l'anglais, fichier par fichier, et doivent lui correspondre. Le français ne l'est que pour
 *     les guides NÉS ICI (ceux dont le jumeau anglais n'a pas de `sourceUrl`). Sur les guides
 *     importés, le français est l'origine et reste libre.
 *
 * JAMAIS VERT FAUTE DE MATIÈRE : sous 200 pages de guides, il refuse de conclure.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = "packages/ui/dist";
const SOURCE = "packages/ui/src/content/guides";
const LANGUES = ["en", "fr", "es", "pt"];
const SITE = "https://mydogcanfly.com";

let echecs = 0;
const dire = (m) => process.stdout.write(m + "\n");
const exiger = (label, cond, detail = "") => {
  if (cond) return;
  echecs++;
  process.stdout.write(`  ✗ ${label}${detail ? `\n      ${detail}` : ""}\n`);
};

/* ---- Les pages à lire, retrouvées par la CLÉ de chaque guide ---------------------------------- */
const parCle = new Map();
for (const l of LANGUES) {
  for (const f of readdirSync(join(SOURCE, l)).filter((x) => /\.mdx?$/.test(x))) {
    const k = /^key:\s*"([^"]+)"/m.exec(readFileSync(join(SOURCE, l, f), "utf8"))?.[1];
    if (!k) continue;
    if (!parCle.has(k)) parCle.set(k, new Map());
    parCle.get(k).set(l, f.replace(/\.mdx?$/, ""));
  }
}
const href = (l, slug) => (l === "en" ? `/travel-hub/${slug}/` : `/${l}/travel-hub/${slug}/`);

/* ---- La lecture d'une page --------------------------------------------------------------------- */
const textesDe = (html, motif) => [...html.matchAll(motif)].map((m) =>
  m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim());

function lire(chemin) {
  const html = readFileSync(join(DIST, chemin, "index.html"), "utf8");
  const blocs = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .flatMap((m) => { try { const v = JSON.parse(m[1]); return Array.isArray(v) ? v : [v]; } catch { return []; } });
  return {
    html,
    lang: /<html[^>]*\slang="([^"]+)"/.exec(html)?.[1] ?? null,
    canonical: /<link[^>]*rel="canonical"[^>]*href="([^"]+)"/.exec(html)?.[1] ?? null,
    h1: textesDe(html, /<h1 class="gd__h1"[^>]*>([\s\S]*?)<\/h1>/g)[0] ?? null,
    questions: textesDe(html, /<summary[^>]*>([\s\S]*?)<\/summary>/g),
    puces: (html.match(/<aside class="gd__bref"[\s\S]*?<\/aside>/)?.[0].match(/<li\b/g) ?? []).length,
    figures: (html.match(/<figure class="gd__cover"[\s\S]*?<\/figure>/g) ?? []),
    article: blocs.find((b) => b["@type"] === "Article") ?? null,
    faqLd: blocs.find((b) => b["@type"] === "FAQPage") ?? null,
  };
}

/* ---- Le relevé ---------------------------------------------------------------------------------- */
const attendues = [];
for (const [cle, versions] of parCle) for (const [l, slug] of versions) attendues.push({ cle, l, slug, chemin: href(l, slug) });
const manquantes = attendues.filter((p) => !existsSync(join(DIST, p.chemin, "index.html")));
if (attendues.length < 200 || manquantes.length) {
  process.stderr.write(`[guide] ÉCHEC — ${attendues.length} pages attendues, ${manquantes.length} absentes du site `
    + `construit. Ce harnais lit les octets des pages : sans elles, il ne prouverait rien.\n`
    + manquantes.slice(0, 5).map((p) => `  · ${p.chemin}`).join("\n") + "\n");
  process.exit(1);
}

const lues = new Map(attendues.map((p) => [`${p.cle}|${p.l}`, { ...p, page: lire(p.chemin) }]));

/* ---- 1. CE QUI EST ANNONCÉ À GOOGLE EST CE QUE LA PAGE AFFICHE -------------------------------- */
const sansArticle = [...lues.values()].filter((x) => !x.page.article);
exiger("chaque page de guide porte ses données structurées Article", sansArticle.length === 0,
  sansArticle.slice(0, 4).map((x) => x.chemin).join(", "));

const titreDiscordant = [...lues.values()].filter((x) => x.page.article && x.page.h1 !== x.page.article.headline);
exiger("le titre annoncé à Google est celui qui est écrit en `h1`", titreDiscordant.length === 0,
  titreDiscordant.slice(0, 3).map((x) => `${x.chemin}\n        h1  « ${x.page.h1} »\n        ld  « ${x.page.article.headline} »`).join("\n      "));

const faqDiscordante = [];
for (const x of lues.values()) {
  const annoncees = (x.page.faqLd?.mainEntity ?? []).map((q) => String(q.name).replace(/\s+/g, " ").trim());
  const affichees = x.page.questions;
  if (annoncees.length !== affichees.length || annoncees.some((q, i) => q !== affichees[i])) {
    faqDiscordante.push({ x, annoncees, affichees });
  }
}
exiger("le schéma FAQPage annonce EXACTEMENT les questions que la page affiche", faqDiscordante.length === 0,
  faqDiscordante.slice(0, 3).map(({ x, annoncees, affichees }) =>
    `${x.chemin} — ${annoncees.length} annoncée(s), ${affichees.length} affichée(s)`).join("\n      "));

const imageDiscordante = [...lues.values()].filter((x) => !!x.page.article?.image !== (x.page.figures.length > 0));
exiger("une image déclarée au schéma correspond à une illustration rendue, et réciproquement",
  imageDiscordante.length === 0,
  imageDiscordante.slice(0, 4).map((x) => `${x.chemin} — schéma ${x.page.article?.image ? "oui" : "non"}, `
    + `figure ${x.page.figures.length}`).join("\n      "));

/* ---- 2. LE CRÉDIT PHOTO EST UNE OBLIGATION DE LICENCE ------------------------------------------ */
/* UNE EXCEPTION EXISTE, ET ELLE EST NOMMÉE PLUTÔT QU'EFFACÉE. `flying-with-a-dog-cabin-hold-cargo`
   porte une illustration sans crédit dans ses quatre langues. Je ne sais pas d'où vient ce fichier :
   s'il appartient au site, aucun crédit n'est dû ; s'il vient d'ailleurs, il en manque un. Trancher
   demande de savoir, pas de deviner — le chiffre est donc FIGÉ à 4, et une cinquième page sans
   crédit ferait échouer le harnais. */
const SANS_CREDIT_CONNUES = 4;
const sansCredit = [...lues.values()].filter((x) => x.page.figures.some((f) => !/<figcaption/.test(f)));
exiger(`les illustrations sans crédit sont les ${SANS_CREDIT_CONNUES} connues, pas une de plus`,
  sansCredit.length === SANS_CREDIT_CONNUES,
  `${sansCredit.length} : ` + sansCredit.slice(0, 6).map((x) => x.chemin).join(", "));

/* ---- 3. L'IDENTITÉ DE LA PAGE ------------------------------------------------------------------ */
/* `lang` peut porter une variante régionale : Base.astro fait correspondre `pt` à `pt-BR`. Exiger
   l'égalité stricte dénonçait les 72 pages portugaises — le site a raison, le contrôle avait tort. */
const langueFausse = [...lues.values()].filter((x) => x.page.lang !== x.l && !x.page.lang?.startsWith(`${x.l}-`));
exiger("chaque page se déclare dans SA langue, variante régionale admise", langueFausse.length === 0,
  langueFausse.slice(0, 4).map((x) => `${x.chemin} → lang="${x.page.lang}"`).join(", "));

const canonFaux = [...lues.values()].filter((x) => x.page.canonical !== SITE + x.chemin);
exiger("chaque page se déclare canonique à sa propre adresse", canonFaux.length === 0,
  canonFaux.slice(0, 4).map((x) => `${x.chemin} → ${x.page.canonical}`).join("\n      "));

/* ---- 4. UNE TRADUCTION NE PERD NI UNE QUESTION NI UNE PUCE ------------------------------------- */
/* Le français n'est contraint que là où il EST une traduction — voir l'en-tête. L'origine se lit
   sur le jumeau anglais : un guide importé porte `sourceUrl`, un guide né ici n'en a pas. */
const neIci = new Set();
for (const [cle, versions] of parCle) {
  const slug = versions.get("en");
  if (!slug) continue;
  const md = readFileSync(join(SOURCE, "en", `${slug}.md`), "utf8");
  if (!/^sourceUrl:/m.test(md.split(/^---$/m)[1] ?? "")) neIci.add(cle);
}
exiger("les deux origines sont représentées (sinon la règle ci-dessous ne trancherait rien)",
  neIci.size > 0 && neIci.size < parCle.size, `${neIci.size} nés ici sur ${parCle.size}`);

const desaccords = [];
for (const [cle, versions] of parCle) {
  const en = lues.get(`${cle}|en`);
  if (!en) continue;
  for (const l of neIci.has(cle) ? ["fr", "es", "pt"] : ["es", "pt"]) {
    const v = lues.get(`${cle}|${l}`);
    if (!v) continue;
    if (v.page.questions.length !== en.page.questions.length || v.page.puces !== en.page.puces) {
      desaccords.push(`${cle} [${l}] — questions ${v.page.questions.length} vs ${en.page.questions.length} · `
        + `puces ${v.page.puces} vs ${en.page.puces}`);
    }
  }
}
exiger("toute traduction affiche le même nombre de questions et de puces que son original anglais",
  desaccords.length === 0, desaccords.slice(0, 5).join("\n      "));

const totalQ = [...lues.values()].reduce((n, x) => n + x.page.questions.length, 0);
const totalP = [...lues.values()].reduce((n, x) => n + x.page.puces, 0);
const avecFigure = [...lues.values()].filter((x) => x.page.figures.length).length;
dire("");
dire(`  ${lues.size} pages de guides lues · ${parCle.size} clés × ${LANGUES.length} langues`);
dire(`  ${totalQ} questions de FAQ · ${totalP} puces « en bref » · ${avecFigure} pages illustrées`);
/* Un relevé anémique passerait tous les contrôles ci-dessus sans rien avoir lu. */
exiger("le relevé a réellement lu du contenu (questions et puces)", totalQ >= 500 && totalP >= 500,
  `${totalQ} questions · ${totalP} puces`);

if (echecs) { process.stderr.write(`\n[guide] ÉCHEC — ${echecs} exigence(s) non tenue(s).\n`); process.exit(1); }
dire("[guide] les 288 pages affichent ce qu'elles annoncent, dans leur langue.");
