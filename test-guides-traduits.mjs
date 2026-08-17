#!/usr/bin/env node
/**
 * LES GUIDES TRADUITS — ce qu'une traduction doit tenir pour entrer.
 *
 *   node --import tsx test-guides-traduits.mjs
 *
 * POURQUOI CE HARNAIS EXISTE. Traduire 62 guides en deux langues, c'est produire environ
 * 136 000 mots en une quinzaine de lots. Aucun relecteur ne revérifiera le lot n° 3 en écrivant
 * le n° 12. Ce qui n'est pas mécanique dérivera : un « en bref » qui perd une puce, une FAQ qui
 * en perd une, une image de couverture qui pointe ailleurs, un lien interne vers un guide qui
 * n'existe pas dans cette langue — et surtout un paragraphe resté en anglais au milieu du texte.
 *
 * CE QU'IL VÉRIFIE, ET CE QU'IL NE PEUT PAS VÉRIFIER. Il contrôle la FIDÉLITÉ DE STRUCTURE :
 * mêmes clés, mêmes cardinalités, mêmes métadonnées, liens qui résolvent, aucun bloc laissé dans
 * la langue source. Il ne contrôle PAS la justesse de la traduction — aucun programme ne le peut,
 * et le prétendre serait le pire des faux verts. Cette relecture-là reste humaine, et le dossier
 * le dit plutôt que de la sous-entendre.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const RACINE = "packages/ui/src/content/guides";
const SOURCES = ["en", "fr"];      // les langues d'origine, importées d'ailleurs
const TRADUITES = ["es", "pt"];    // les langues qui naissent ici
const LANGUES = [...SOURCES, ...TRADUITES];

let echecs = 0;
const dire = (m) => process.stdout.write(m + "\n");
const exiger = (label, cond, detail = "") => {
  if (cond) return;
  echecs++;
  process.stdout.write(`  ✗ ${label}${detail ? `\n      ${detail}` : ""}\n`);
};

/* ---- Lecture ------------------------------------------------------------------------------- */
const lire = (locale) => {
  const d = join(RACINE, locale);
  if (!existsSync(d)) return [];
  return readdirSync(d).filter((f) => /\.mdx?$/.test(f)).sort().map((f) => {
    const brut = readFileSync(join(d, f), "utf8");
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(brut);
    if (!m) return { locale, fichier: f, slug: f.replace(/\.mdx?$/, ""), casse: true };
    const [, fm, corps] = m;
    const champ = (k) => (new RegExp(`^${k}:\\s*"([^"]*)"`, "m").exec(fm) || [])[1];
    /* Compter les entrées d'une liste YAML : les puces de premier niveau sous la clé, pas les
       lignes de continuation — une réponse de FAQ tient parfois sur plusieurs lignes. */
    const liste = (k) => {
      const i = fm.indexOf(`\n${k}:`);
      if (i < 0) return null;
      const suite = fm.slice(i + 1).split("\n").slice(1);
      let n = 0;
      for (const l of suite) {
        if (/^\S/.test(l)) break;          // la clé suivante, au même niveau
        if (/^\s{2}- /.test(l)) n++;
      }
      return n;
    };
    return {
      locale, fichier: f, slug: f.replace(/\.mdx?$/, ""), fm, corps,
      key: champ("key"), title: champ("title"), description: champ("description"),
      summary: champ("summary"), date: champ("date"), lastmod: champ("lastmod"),
      author: champ("author"), coverImage: champ("image"),
      aSourceUrl: /^sourceUrl:\s*"/m.test(fm),
      enbref: liste("enbref"), faq: liste("faq"),
      categories: (/^categories:\s*\[([^\]]*)\]/m.exec(fm) || [])[1] ?? "",
    };
  });
};
const parLangue = Object.fromEntries(LANGUES.map((l) => [l, lire(l)]));
const tous = LANGUES.flatMap((l) => parLangue[l]);
exiger("aucun fichier de guide n'a un front matter illisible",
  tous.every((g) => !g.casse), tous.filter((g) => g.casse).map((g) => `${g.locale}/${g.fichier}`).join(", "));

/* Jamais vert faute de matière : les deux langues d'origine doivent être là, entières. */
exiger("les 62 guides anglais et les 62 français sont présents",
  parLangue.en.length === 62 && parLangue.fr.length === 62,
  `en=${parLangue.en.length} fr=${parLangue.fr.length}`);

const parCle = new Map();
for (const g of tous) {
  if (!parCle.has(g.key)) parCle.set(g.key, {});
  parCle.get(g.key)[g.locale] = g;
}

/* ---- 1. Le pivot ---------------------------------------------------------------------------- */
/* `key` relie les langues entre elles. Une traduction sans jumeau anglais serait une page
   orpheline : pas d'alternates, pas d'entrée à l'index, invisible au sélecteur de langue. */
for (const l of TRADUITES) {
  const orphelins = parLangue[l].filter((g) => !parCle.get(g.key)?.en);
  exiger(`chaque guide ${l} a son jumeau anglais (pivot \`key\`)`,
    orphelins.length === 0, orphelins.map((g) => `${g.fichier} → key « ${g.key} » inconnue`).join(", "));
}
for (const l of LANGUES) {
  const slugs = parLangue[l].map((g) => g.slug);
  exiger(`les slugs ${l} sont uniques`, new Set(slugs).size === slugs.length,
    slugs.filter((s, i) => slugs.indexOf(s) !== i).join(", "));
  exiger(`les slugs ${l} sont en minuscules, sans accent ni espace`,
    slugs.every((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)),
    slugs.filter((s) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)).join(", "));
}

/* ---- 2. `sourceUrl` : la garantie déplacée, pas supprimée ------------------------------------ */
/* Le schéma ne voit pas le chemin du fichier ; ce contrôle, si. Les guides importés gardent leur
   adresse d'origine — sans quoi `gen-redirects.mjs` perdrait une 301. Ceux qui naissent ici n'en
   ont pas, et ne doivent pas s'en inventer une. */
for (const l of SOURCES) {
  const sans = parLangue[l].filter((g) => !g.aSourceUrl);
  exiger(`les guides ${l} portent tous leur \`sourceUrl\` d'origine`,
    sans.length === 0, sans.map((g) => g.fichier).join(", "));
}
for (const l of TRADUITES) {
  const avec = parLangue[l].filter((g) => g.aSourceUrl);
  exiger(`aucun guide ${l} ne s'invente un \`sourceUrl\` : ils naissent ici`,
    avec.length === 0, avec.map((g) => g.fichier).join(", "));
}

/* ---- 3. Fidélité de structure au jumeau anglais ---------------------------------------------- */
const CHAMPS_IDENTIQUES = ["date", "lastmod", "author", "coverImage"];
const CHAMPS_TRADUITS = ["title", "description", "summary"];
for (const l of TRADUITES) {
  for (const g of parLangue[l]) {
    const en = parCle.get(g.key)?.en;
    if (!en) continue; // déjà signalé plus haut
    const ou = `${l}/${g.fichier}`;
    for (const c of CHAMPS_IDENTIQUES) {
      exiger(`${ou} — \`${c}\` doit être identique à l'anglais`, g[c] === en[c],
        `« ${g[c]} » ≠ « ${en[c]} »`);
    }
    for (const c of CHAMPS_TRADUITS) {
      /* Un champ absent des deux côtés est légitime ; présent d'un seul, non. Et s'il est
         présent des deux côtés, il doit avoir été TRADUIT, pas recopié. */
      exiger(`${ou} — \`${c}\` présent des deux côtés ou d'aucun`,
        (g[c] == null) === (en[c] == null), `${l}=${g[c] ?? "∅"} / en=${en[c] ?? "∅"}`);
      if (g[c] != null && en[c] != null) {
        exiger(`${ou} — \`${c}\` n'est pas resté en anglais`, g[c] !== en[c], `« ${g[c]} »`);
      }
    }
    exiger(`${ou} — le « en bref » garde ses ${en.enbref} puces`, g.enbref === en.enbref,
      `${g.enbref} ≠ ${en.enbref}`);
    exiger(`${ou} — la FAQ garde ses ${en.faq} questions`, g.faq === en.faq, `${g.faq} ≠ ${en.faq}`);
    exiger(`${ou} — autant de catégories que l'anglais`,
      g.categories.split(",").length === en.categories.split(",").length,
      `« ${g.categories} » vs « ${en.categories} »`);
  }
}

/* ---- 4. Aucun bloc laissé dans la langue source ----------------------------------------------
 * Le défaut le plus probable d'une traduction en série n'est pas la faute de langue : c'est le
 * paragraphe oublié. On compare donc les PHRASES : toute phrase d'au moins huit mots présente
 * telle quelle dans le texte anglais ET dans la traduction est un bloc non traduit.
 *
 * Le seuil de huit mots n'est pas décoratif. En dessous, les noms de modèles et les listes
 * d'équipement — « Petmate Sky Kennel », « Live Animals » — déclencheraient des faux positifs :
 * ce sont des noms propres, et un nom propre ne se traduit pas.
 *
 * ET LES LIENS SONT RETIRÉS EN ENTIER, libellé compris. Première version, je gardais le libellé :
 * la ligne « Sources » de chaque guide — `[US DOT — Service Animals] · [BARK Air] · [K9 Jets]` —
 * était alors signalée comme « restée en anglais » dans les deux traductions. Elle l'est, et elle
 * doit l'être : un titre de source ne se traduit pas, sans quoi on ne retrouve plus la source. La
 * règle exacte est donc : on ne compare que la PROSE que le traducteur écrit lui-même. Un
 * paragraphe réellement oublié reste détecté — il contient bien plus de huit mots hors liens. */
const phrases = (t) => (t ?? "")
  .replace(/```[\s\S]*?```/g, " ")          // les blocs de code ne se traduisent pas
  .replace(/<[^>]+>/g, " ")                 // le bloc « étapes » est du HTML : ses ancres aussi
  .replace(/\[[^\]]*\]\([^)]*\)/g, " ")     // liens retirés en entier : un titre de source ne se traduit pas
  .split(/(?<=[.!?])\s+|\n{2,}/)
  .map((p) => p.replace(/[*_#>`|-]/g, " ").replace(/\s+/g, " ").trim().toLowerCase())
  .filter((p) => p.split(" ").length >= 8);
for (const l of TRADUITES) {
  for (const g of parLangue[l]) {
    const en = parCle.get(g.key)?.en;
    if (!en) continue;
    const communes = new Set(phrases(en.corps));
    const restees = phrases(g.corps).filter((p) => communes.has(p));
    exiger(`${l}/${g.fichier} — aucune phrase n'est restée en anglais`,
      restees.length === 0, restees.slice(0, 2).map((p) => `« ${p.slice(0, 90)}… »`).join(" | "));
    exiger(`${l}/${g.fichier} — le corps n'est pas la copie de l'anglais`,
      g.corps.trim() !== en.corps.trim());
  }
}

/* ---- 5. Les liens internes résolvent ---------------------------------------------------------
 * Un guide renvoie vers d'autres guides. Traduit langue par langue, il pourrait pointer vers une
 * adresse qui n'existe pas encore. On exige donc que TOUT lien `/…/travel-hub/<slug>/` vise un
 * fichier réellement présent dans la langue visée — c'est ce qui rend les états intermédiaires
 * sûrs, et ce qui permet d'avancer par lots sans publier de 404. */
const slugsDe = Object.fromEntries(LANGUES.map((l) => [l, new Set(parLangue[l].map((g) => g.slug))]));
/* Les liens sont écrits de DEUX façons dans ces fichiers : en markdown dans le corps, et en HTML
   dans le bloc « étapes » qui clôt chaque guide. N'en lire qu'une laisserait la moitié des renvois
   hors de tout contrôle — et c'est la moitié qui contient les liens de parcours. */
const liensDe = (corps) => [
  ...[...(corps ?? "").matchAll(/\]\((\/(?:(fr|es|pt)\/)?travel-hub\/([a-z0-9-]+)\/?)\)/g)],
  ...[...(corps ?? "").matchAll(/href="(\/(?:(fr|es|pt)\/)?travel-hub\/([a-z0-9-]+)\/?)"/g)],
].map((m) => ({ url: m[1], cible: m[2] ?? "en", slug: m[3] }));
/* La clé d'un guide à partir de sa langue et de son slug — pour savoir si le lien AURAIT PU
   viser la langue du lecteur. */
const cleDe = new Map(tous.map((g) => [`${g.locale}/${g.slug}`, g.key]));
for (const l of LANGUES) {
  for (const g of parLangue[l]) {
    const morts = [], detournes = [];
    for (const lien of liensDe(g.corps)) {
      if (!slugsDe[lien.cible]?.has(lien.slug)) { morts.push(`${lien.url} (langue ${lien.cible})`); continue; }
      /* Renvoyer vers l'anglais est LÉGITIME tant que la traduction n'existe pas — c'est ce qui
         rend la traduction par lots possible sans publier de 404. Cela cesse de l'être le jour où
         elle existe : le lien devient alors un renvoi hors de la langue du lecteur, et personne ne
         repassera derrière. Ce contrôle force la remise à jour au moment même de la traduction. */
      if (lien.cible === l) continue;
      const cle = cleDe.get(`${lien.cible}/${lien.slug}`);
      const versionLocale = cle && parCle.get(cle)?.[l];
      if (versionLocale) detournes.push(`${lien.url} → ${l}/${versionLocale.slug} existe désormais`);
    }
    exiger(`${l}/${g.fichier} — tous ses liens vers un guide existent`,
      morts.length === 0, morts.join(", "));
    exiger(`${l}/${g.fichier} — aucun lien ne sort de la langue du lecteur alors que la version traduite existe`,
      detournes.length === 0, detournes.join(", "));
  }
}

/* ---- 6. Les liens vers les OUTILS visent une route qui existe ---------------------------------
 * Le contrôle 5 ne regarde que les renvois d'un guide vers un autre guide. Or six liens du corpus
 * visaient un outil : quatre vers des adresses qu'aucune page ne sert (rattrapées par une 301 dans
 * `_redirects` — un lien interne ne doit pas passer par une redirection), et deux vers
 * `/tools/is-it-too-hot-for-my-dog/`, qui n'existe NI comme page NI comme redirection.
 *
 * La liste des outils n'est pas recopiée ici : elle est LUE dans les routes, hors ligne. Renommer
 * un outil sans mettre les guides à jour fait donc échouer ce contrôle, et le lexique ne peut pas
 * mentir sur ce que le site sert réellement. */
const ROUTES_OUTILS = join("packages/ui/src/pages/[...loc]/tools");
const outils = new Set(
  existsSync(ROUTES_OUTILS)
    ? readdirSync(ROUTES_OUTILS).filter((f) => /\.astro$/.test(f)).map((f) => f.replace(/\.astro$/, ""))
    : [],
);
/* Jamais vert faute de matière : si les routes deviennent introuvables, l'ensemble serait vide et
   tout lien passerait — ou plutôt échouerait en masse. On exige donc qu'elles soient là. */
exiger("les routes d'outils sont lisibles (sinon ce contrôle ne prouve rien)",
  outils.size >= 5, `${outils.size} route(s) trouvée(s) sous ${ROUTES_OUTILS}`);
for (const l of LANGUES) {
  for (const g of parLangue[l]) {
    const inconnus = [];
    for (const m of (g.corps ?? "").matchAll(/(?:\]\(|href=")(\/(?:(?:fr|es|pt)\/)?tools\/([a-z0-9-]*)\/?)(?:\)|")/g)) {
      const slug = m[2];
      if (slug === "" || outils.has(slug)) continue;   // « /tools/ » est l'index, une route réelle
      inconnus.push(`${m[1]} — aucun outil « ${slug} » n'est servi`);
    }
    exiger(`${l}/${g.fichier} — ses liens vers un outil visent une route existante`,
      inconnus.length === 0, inconnus.join(", "));
  }
}

/* ---- Verdict ---------------------------------------------------------------------------------- */
const traduits = TRADUITES.map((l) => `${l}=${parLangue[l].length}`).join(" · ");
dire("");
dire(`  guides : en=${parLangue.en.length} · fr=${parLangue.fr.length} · ${traduits}`);
dire(`  reste à traduire : ${TRADUITES.map((l) => `${l} ${62 - parLangue[l].length}`).join(" · ")}`);
if (echecs) {
  process.stderr.write(`\n[guides-traduits] ÉCHEC — ${echecs} contrôle(s) non tenu(s)\n`);
  process.exit(1);
}
dire("[guides-traduits] structure, métadonnées, langue et liens : tout tient.");
dire("  (la JUSTESSE de la traduction n'est pas contrôlable ici — cette relecture reste humaine)");
