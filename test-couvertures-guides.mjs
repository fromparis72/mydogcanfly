#!/usr/bin/env node
/**
 * CHAQUE GUIDE A UNE COUVERTURE, ELLE EXISTE SUR LE DISQUE, ET SON TEXTE EST DANS SA LANGUE.
 *
 *   node test-couvertures-guides.mjs        (lit les sources, aucun build nécessaire)
 *
 * POURQUOI. Les 10 guides nés du lot 2 n'avaient aucune couverture, dans aucune des quatre
 * langues — 40 fichiers — et rien ne le disait. Le champ est `optional()` au schéma, à raison :
 * un guide sans photo reste lisible. Mais « toléré par le schéma » n'est pas « voulu », et la
 * différence entre les deux ne se voit qu'à l'œil, sur une page, si quelqu'un pense à regarder.
 *
 * TROIS CHOSES QU'UN SCHÉMA NE PEUT PAS DIRE :
 *
 *   1. LE FICHIER EXISTE. `image` est une chaîne : le schéma accepte `/travel-hub/inexistant.webp`
 *      sans broncher, et la page se construit avec une image morte. On confronte donc chaque
 *      chemin au disque.
 *   2. LES QUATRE LANGUES PARTAGENT LA MÊME IMAGE. Une couverture est un fait éditorial attaché
 *      au guide, pas à sa traduction : deux langues qui montrent deux photos différentes du même
 *      article sont presque toujours le signe d'une reprise partielle.
 *   3. LE TEXTE ALTERNATIF EST TRADUIT. C'est le seul élément du bloc qui s'adresse à un lecteur,
 *      et il ne s'adresse qu'à celui qui NE VOIT PAS l'image — donc le seul qui ne pourra jamais
 *      s'apercevoir qu'on lui parle anglais. Un `alt` identique entre deux langues est un `alt`
 *      recopié.
 *
 * JAMAIS VERT FAUTE DE MATIÈRE : le harnais exige 72 guides par langue et échoue s'il en lit
 * moins, plutôt que de conclure sur ce qu'il a trouvé.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const RACINE = "packages/ui/src/content/guides";
const PUBLIC = "packages/ui/public";
const LANGUES = ["en", "fr", "es", "pt"];
const ATTENDUS = 72;

const defauts = [];
const echec = (n, m) => defauts.push(`${n}. ${m}`);

const champ = (t, n) => (new RegExp(`^\\s*${n}:\\s*"([\\s\\S]*?)"\\s*$`, "m").exec(t) || [])[1] ?? null;

/** Le bloc `cover:` d'un guide : son image et son texte alternatif. */
function couverture(texte) {
  const bloc = /^cover:\s*\n((?:[ \t]+\w+:.*\n?)+)/m.exec(texte);
  if (!bloc) return null;
  return { image: champ(bloc[1], "image"), alt: champ(bloc[1], "alt") };
}

const parCle = new Map();
for (const langue of LANGUES) {
  const fichiers = readdirSync(join(RACINE, langue)).filter((f) => f.endsWith(".md"));
  if (fichiers.length !== ATTENDUS) {
    echec(0, `${langue.toUpperCase()} : ${fichiers.length} guides au lieu de ${ATTENDUS} — le harnais refuse de conclure sur un corpus partiel`);
  }
  for (const nom of fichiers) {
    const chemin = join(RACINE, langue, nom);
    const texte = readFileSync(chemin, "utf-8");
    const cle = champ(texte, "key");
    if (!cle) { echec(0, `${chemin} : aucun champ « key: »`); continue; }
    const c = couverture(texte);

    if (!c) { echec(1, `${chemin} : aucune couverture`); }
    else {
      if (!c.image) echec(1, `${chemin} : bloc « cover: » sans « image: »`);
      else {
        /* 1. l'image existe VRAIMENT */
        const disque = join(PUBLIC, c.image.replace(/^\//, ""));
        if (!c.image.startsWith("/")) echec(1, `${chemin} : image « ${c.image} » n'est pas un chemin du site`);
        else if (!existsSync(disque)) echec(1, `${chemin} : image INTROUVABLE sur le disque — ${disque}`);
      }
      if (!c.alt || !c.alt.trim()) echec(3, `${chemin} : couverture sans texte alternatif`);
    }

    if (!parCle.has(cle)) parCle.set(cle, new Map());
    parCle.get(cle).set(langue, { chemin, cover: c });
  }
}

for (const [cle, versions] of parCle) {
  const images = new Set();
  const alts = new Map();
  for (const [langue, v] of versions) {
    if (!v.cover) continue;
    if (v.cover.image) images.add(v.cover.image);
    if (v.cover.alt) alts.set(langue, v.cover.alt);
  }
  /* 2. une seule image pour les quatre langues */
  if (images.size > 1) {
    echec(2, `${cle} : ${images.size} images différentes selon la langue — ${[...images].join(" · ")}`);
  }
  /* 3. des textes alternatifs distincts d'une langue à l'autre */
  const vus = new Map();
  for (const [langue, alt] of alts) {
    if (vus.has(alt)) echec(3, `${cle} : ${langue.toUpperCase()} et ${vus.get(alt).toUpperCase()} partagent le MÊME texte alternatif — « ${alt.slice(0, 60)}… »`);
    else vus.set(alt, langue);
  }
}

const avec = [...parCle.values()].filter((v) => [...v.values()].every((x) => x.cover)).length;
if (defauts.length === 0) {
  process.stdout.write(`${parCle.size} guides · ${avec} pourvus d'une couverture dans les quatre langues\n`);
  process.stdout.write("image partagée entre langues, présente sur le disque, texte alternatif propre à chaque langue.\n\n");
  process.stdout.write("[couvertures] chaque guide montre quelque chose, et le dit dans sa langue.\n");
  process.exit(0);
}
process.stderr.write(`\n[couvertures] ÉCHEC — ${defauts.length} défaut(s) :\n`);
for (const d of defauts.slice(0, 30)) process.stderr.write(`  ${d}\n`);
if (defauts.length > 30) process.stderr.write(`  … et ${defauts.length - 30} autre(s)\n`);
process.exit(1);
