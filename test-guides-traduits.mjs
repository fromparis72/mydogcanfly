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
      aSourceUrl: /^sourceUrl:\s*"/m.test(fm), sourceUrl: champ("sourceUrl"),
      enbref: liste("enbref"), faq: liste("faq"),
      categories: (/^categories:\s*\[([^\]]*)\]/m.exec(fm) || [])[1] ?? "",
    };
  });
};
const parLangue = Object.fromEntries(LANGUES.map((l) => [l, lire(l)]));
const tous = LANGUES.flatMap((l) => parLangue[l]);
exiger("aucun fichier de guide n'a un front matter illisible",
  tous.every((g) => !g.casse), tous.filter((g) => g.casse).map((g) => `${g.locale}/${g.fichier}`).join(", "));

/* Jamais vert faute de matière : le corpus IMPORTÉ doit être là, entier.
 *
 * « en = 62 » ne peut plus être le critère : des articles naissent désormais ici, en anglais, sans
 * venir de l'ancien site. Le compte figé porte donc sur ce qui a été importé — reconnaissable à son
 * `sourceUrl` — et non sur le total. Sans quoi ajouter un article masquerait la disparition d'un
 * guide importé, et le contrôle deviendrait un faux vert. */
const IMPORTES = Object.fromEntries(SOURCES.map((l) => [l, parLangue[l].filter((g) => g.aSourceUrl)]));
exiger("les 62 guides importés de l'ancien site sont là, en anglais comme en français",
  IMPORTES.en.length === 62 && IMPORTES.fr.length === 62,
  `importés : en=${IMPORTES.en.length} fr=${IMPORTES.fr.length}`
  + ` · total : en=${parLangue.en.length} fr=${parLangue.fr.length}`);

const parCle = new Map();
for (const g of tous) {
  if (!parCle.has(g.key)) parCle.set(g.key, {});
  parCle.get(g.key)[g.locale] = g;
}

/* ---- QUI EST UNE TRADUCTION ? ÇA SE DÉDUIT, ÇA NE SE DÉCLARE PAS PAR LA LANGUE ---------------
 *
 * LE FAUX VERT DU 23/08/2026, trouvé par Codex et reproduit : `fr` était rangé une fois pour
 * toutes parmi les langues SOURCES, si bien que les sections 3 et 4 — fidélité au jumeau anglais,
 * cardinalités, corps non recopié, phrases restées en anglais — ne parcouraient que `es` et `pt`.
 * Remplacer un paragraphe français par sa version anglaise EXACTE laissait le harnais vert.
 *
 * Le classement par langue était juste le jour où il a été écrit — le français ne contenait alors
 * que des articles importés — et il est devenu faux dès que dix traductions françaises sont nées
 * ici. C'est le même défaut que les listes de chemins écrites à la main : vrai à l'écriture, faux
 * au fichier suivant.
 *
 * LE DISCRIMINANT EXISTE DÉJÀ, ET IL EST DÉJÀ VÉRIFIÉ. Un guide importé de l'ancien site porte un
 * `sourceUrl` ; un guide né ici n'en a pas. La section 2 confronte en outre chaque `sourceUrl`
 * anglais aux fichiers réels de `content/posts`, et exige que le statut d'un guide français soit
 * celui de son jumeau anglais. On peut donc s'y fier : est une TRADUCTION tout guide non anglais
 * sans `sourceUrl`, quelle que soit sa langue.
 *
 * Et les 62 français importés restent hors de ces contrôles, à raison : ce ne sont pas des
 * traductions de l'anglais mais des originaux écrits dans leur langue. Leur exiger la cardinalité
 * de FAQ de l'anglais serait la faute que ce chantier a déjà commise une fois. */
const A_CONFRONTER = Object.fromEntries(LANGUES.filter((l) => l !== "en")
  .map((l) => [l, parLangue[l].filter((g) => !g.aSourceUrl)]));
/* JAMAIS VERT FAUTE DE MATIÈRE, et c'est ce contrôle-ci qui aurait crié le 23/08 : le nombre de
   traductions françaises confrontées doit être EXACTEMENT le nombre d'articles anglais nés ici.
   S'il retombait à zéro — le trou d'origine —, cette ligne le dirait au lieu de le taire. */
const EN_NES_ICI = parLangue.en.filter((g) => !g.aSourceUrl);
for (const l of Object.keys(A_CONFRONTER)) {
  const attendu = l === "fr" ? EN_NES_ICI.length : parLangue.en.length;
  exiger(`${A_CONFRONTER[l].length} traduction(s) ${l} sont confrontées à l'anglais, ${attendu} attendue(s)`,
    A_CONFRONTER[l].length === attendu && attendu > 0,
    `un écart ici veut dire que des traductions échappent aux sections 3 et 4`);
}

/* ---- 1. Le pivot ---------------------------------------------------------------------------- */
/* `key` relie les langues entre elles. Une traduction sans jumeau anglais serait une page
   orpheline : pas d'alternates, pas d'entrée à l'index, invisible au sélecteur de langue. */
for (const l of ["fr", ...TRADUITES]) {
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

/* ---- 1bis. TOUT ARTICLE ANGLAIS PARAÎT DANS LES QUATRE LANGUES ------------------------------
 * Le pivot ci-dessus interdit l'orphelin dans UN sens : une traduction sans jumeau anglais. Il ne
 * disait rien de l'autre — un article anglais sans traduction passait sans un mot. Le « reste à
 * traduire » du verdict le comptait bien, mais il n'était qu'AFFICHÉ : un nombre qu'il faut
 * regarder n'est pas un contrôle. Ici il bloque, et c'est ce qui rend vraie la promesse du lot —
 * chaque article paraît d'emblée dans les quatre langues. */
{
  const autres = LANGUES.filter((l) => l !== "en");
  const manques = [];
  for (const g of parLangue.en) {
    for (const l of autres) if (!parCle.get(g.key)?.[l]) manques.push(`${g.key} → ${l}`);
  }
  exiger(`les ${parLangue.en.length} articles anglais paraissent tous en ${autres.join(", ")}`,
    manques.length === 0 && parLangue.en.length > 0,
    manques.slice(0, 6).join(", ") + (manques.length > 6 ? `, et ${manques.length - 6} autre(s)` : ""));
}

/* ---- 2. `sourceUrl` : la garantie déplacée, pas supprimée ------------------------------------ */
/* Le schéma ne voit pas le chemin du fichier ; ce contrôle, si. Les guides importés gardent leur
   adresse d'origine — sans quoi `gen-redirects.mjs` perdrait une 301. Ceux qui naissent ici n'en
   ont pas, et ne doivent pas s'en inventer une. */
/* EN ANGLAIS, un `sourceUrl` n'est plus seulement PRÉSENT : il doit désigner un article hérité qui
 * existe vraiment sous content/posts/. C'est plus fort que l'ancienne règle, qui se contentait du
 * champ : une adresse d'origine inventée, ou devenue fausse après un renommage, échoue désormais.
 *
 * EN FRANÇAIS, CE CONTRÔLE EST IMPOSSIBLE, et je ne le simule pas : content/posts/ ne contient que
 * l'anglais (149 fichiers), le corpus hérité français n'est pas dans ce dépôt. On s'en tient donc à
 * la présence du champ. Un contrôle qu'on ne peut pas faire doit être dit, pas maquillé en vert. */
const faux = parLangue.en
  .filter((g) => g.aSourceUrl)
  .filter((g) => !existsSync(join("content/posts", `${(g.sourceUrl ?? "").replace(/^\/|\/$/g, "")}.md`)))
  .map((g) => `${g.fichier} → « ${g.sourceUrl} » : aucun article hérité de ce nom`);
exiger("chaque `sourceUrl` anglais désigne un article hérité réel", faux.length === 0, faux.join(", "));
/* LE FRANÇAIS A DÉSORMAIS DEUX POPULATIONS, comme l'anglais : les 62 importés de l'ancien site, et
 * ceux qui naissent ici. « tous les guides fr portent un sourceUrl » devient donc faux — mais le
 * relâcher en « certains en portent » ne prouverait plus rien.
 *
 * La règle exacte est ailleurs : le statut d'origine d'un guide français doit être CELUI DE SON
 * JUMEAU ANGLAIS. C'est plus fort que l'ancienne règle, et c'est vérifiable, parce que le sourceUrl
 * anglais est lui-même confronté aux fichiers réels de content/posts juste au-dessus. Un importé
 * qui perdrait son adresse échoue ; un article né ici qui s'en inventerait une échoue aussi. */
const desaccords = parLangue.fr
  .map((g) => ({ g, en: parCle.get(g.key)?.en }))
  .filter(({ en }) => en)                       // sans jumeau : déjà signalé par le contrôle du pivot
  .filter(({ g, en }) => g.aSourceUrl !== en.aSourceUrl)
  .map(({ g, en }) => `${g.fichier} : ${g.aSourceUrl ? "porte" : "n'a pas"} de \`sourceUrl\`,`
    + ` son jumeau anglais ${en.aSourceUrl ? "en a un" : "n'en a pas"}`);
exiger("chaque guide français a le même statut d'origine que son jumeau anglais",
  desaccords.length === 0, desaccords.join(", "));
for (const l of TRADUITES) {
  const avec = parLangue[l].filter((g) => g.aSourceUrl);
  exiger(`aucun guide ${l} ne s'invente un \`sourceUrl\` : ils naissent ici`,
    avec.length === 0, avec.map((g) => g.fichier).join(", "));
}

/* ---- 3. Fidélité de structure au jumeau anglais ---------------------------------------------- */
/* `lastmod` A QUITTÉ CETTE LISTE le 20/08/2026, sur contre-revue, et le motif est de fond.
 *
 * Exiger `lastmod` identique à l'anglais forçait à ANTIDATER les traductions : un texte espagnol
 * écrit le 19 devait se déclarer modifié le 17 pour satisfaire une égalité qui ne correspondait à
 * rien. C'est le contrôle qui produisait la fausseté, pas le contenu.
 *
 * Le contrat retenu sépare ce qui doit être commun de ce qui est propre à chaque version :
 *   · `date`    — la publication de l'ARTICLE : identique dans les quatre langues ;
 *   · `lastmod` — la dernière révision de CE FICHIER : propre à chacun ;
 *   · et pour tous, `date <= lastmod <= maintenant`.
 * Aucune traduction n'est jamais antidatée pour satisfaire une égalité artificielle. */
const CHAMPS_IDENTIQUES = ["date", "author", "coverImage"];
const CHAMPS_TRADUITS = ["title", "description", "summary"];
for (const l of Object.keys(A_CONFRONTER)) {
  for (const g of A_CONFRONTER[l]) {
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

/* ---- 3bis. LA CHRONOLOGIE DE CHAQUE FICHIER, DANS TOUTES LES LANGUES -------------------------
 * `lastmod` étant désormais propre à chaque version, il lui faut son propre contrat — sans quoi
 * l'assouplissement ci-dessus ouvrirait la porte à n'importe quelle date. Trois bornes, et elles
 * valent pour l'anglais et le français autant que pour les traductions. Le futur est exclu :
 * six articles s'étaient déclarés publiés jusqu'au 26 août, un étalement inventé sans aucun
 * mécanisme de programmation derrière. */
{
  const MAINTENANT = new Date();
  const jour = (v) => (v ?? "").slice(0, 10);
  const desordre = [], futur = [];
  for (const l of LANGUES) {
    for (const g of parLangue[l]) {
      if (!g.date || !g.lastmod) { desordre.push(`${l}/${g.fichier} — date ou lastmod absent`); continue; }
      if (jour(g.lastmod) < jour(g.date)) {
        desordre.push(`${l}/${g.fichier} — révisé (${jour(g.lastmod)}) AVANT sa publication (${jour(g.date)})`);
      }
      if (new Date(g.date) > MAINTENANT || new Date(g.lastmod) > MAINTENANT) {
        futur.push(`${l}/${g.fichier} — ${jour(g.date)} / ${jour(g.lastmod)}`);
      }
    }
  }
  exiger("aucun guide n'est révisé avant d'être publié", desordre.length === 0, desordre.slice(0, 6).join(" · "));
  exiger("aucun guide ne se déclare publié ou révisé dans le futur", futur.length === 0, futur.slice(0, 6).join(" · "));
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
for (const l of Object.keys(A_CONFRONTER)) {
  for (const g of A_CONFRONTER[l]) {
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
/* Le français a DEUX populations, et les confondre est exactement ce qui a produit le faux vert du
   23/08/2026 : le total « fr=72 » ne disait pas que dix d'entre eux sont des traductions, ni
   qu'aucune n'était confrontée à l'anglais. Le relevé les sépare désormais. */
dire(`  dont traductions confrontées à l'anglais : `
  + Object.keys(A_CONFRONTER).map((l) => `${l} ${A_CONFRONTER[l].length}`).join(" · ")
  + ` (fr : ${parLangue.fr.length - A_CONFRONTER.fr.length} importés, hors ces contrôles)`);
/* Le reste à traduire se COMPTE, il ne se déduit pas d'un 62 figé : ce nombre était le total du
   corpus importé, et il est devenu faux le jour où des articles sont nés ici. Un compteur qui
   affiche « es -10 » ne renseigne plus personne — on compare donc les clés, langue par langue. */
const clesEn = new Set(parLangue.en.map((g) => g.key));
const restant = (l) => {
  const presentes = new Set(parLangue[l].map((g) => g.key));
  return [...clesEn].filter((k) => !presentes.has(k)).length;
};
dire(`  reste à traduire : ${["fr", ...TRADUITES].map((l) => `${l} ${restant(l)}`).join(" · ")}`);
if (echecs) {
  process.stderr.write(`\n[guides-traduits] ÉCHEC — ${echecs} contrôle(s) non tenu(s)\n`);
  process.exit(1);
}
dire("[guides-traduits] structure, métadonnées, langue et liens : tout tient.");
dire("  (la JUSTESSE de la traduction n'est pas contrôlable ici — cette relecture reste humaine)");
