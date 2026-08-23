#!/usr/bin/env node
/**
 * poser-couvertures.mjs — inscrit le bloc `cover:` des guides qui n'en avaient pas.
 *
 * Les 62 guides importés portaient une couverture ; les 10 nés du lot 2 n'en avaient aucune.
 * L'image est PARTAGÉE entre les quatre langues — un seul fichier sous `/travel-hub/<clé>.webp`,
 * la clé étant celle du guide, identique d'une langue à l'autre. Le texte `alt`, lui, est TRADUIT :
 * c'est le seul élément du bloc qui s'adresse à un lecteur, et un `alt` anglais sur une page
 * portugaise est exactement le défaut que le Travel Hub vient de fermer sur ses rubriques.
 *
 * PAS DE CHAMP `credit`, ET C'EST UNE DÉCISION. Le compte exact, puisqu'il a été énoncé faux une
 * fois : 62 guides portaient déjà une couverture, mais 61 seulement portent un crédit. Le
 * soixante-deuxième — `flying-with-a-dog-cabin-hold-cargo` — n'en a jamais eu. Avec les dix
 * nouveaux, ce sont donc ONZE guides sans attribution, et non dix.
 *
 * Pour ces dix-là, le propriétaire du site a choisi de ne pas en poser. La licence Unsplash ne
 * l'exige pas : elle rend l'attribution appréciée, non obligatoire. Le schéma la déclare
 * d'ailleurs `optional()`. On l'écrit ici pour que l'exception soit LUE comme un choix et non
 * découverte comme un oubli — et pour corriger au passage le commentaire du schéma, qui
 * affirmait à tort que « la licence Unsplash l'exige ».
 *
 * L'ABSENCE DE CRÉDIT AFFICHÉ N'EST PAS UNE ABSENCE DE PROVENANCE. Origine, base de droits,
 * empreinte et date d'acquisition de chaque binaire sont consignées dans `couvertures-guides.json`,
 * avec un champ `verifie` qui distingue ce qui est DÉCLARÉ de ce qui est établi.
 *
 * IL ÉCHOUE FERMÉ. Une clé sans image sur le disque, une langue manquante, un guide portant déjà
 * une couverture : tout arrête le script avant la moindre écriture. Comme la migration des
 * rubriques, il est TOUT OU RIEN — le plan entier est calculé et validé d'abord.
 *
 *   node packages/knowledge/scripts/poser-couvertures.mjs --dry
 *   node packages/knowledge/scripts/poser-couvertures.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const RACINE = "packages/ui/src/content/guides";
const IMAGES = "packages/ui/public/travel-hub";
const LANGUES = ["en", "fr", "es", "pt"];

/* LES TEXTES ALTERNATIFS NE SONT PAS ÉCRITS ICI. Ils vivent dans `couvertures-guides.json`,
 * qui sert aussi de référence au harnais : une table recopiée dans le script qui l'applique et
 * dans le contrôle qui la vérifie n'est plus une référence, c'est un miroir. Ce fichier porte
 * aussi la provenance de chaque binaire — origine, base de droits, empreinte, date. */
const REF = JSON.parse(readFileSync("couvertures-guides.json", "utf-8")).images;
const ALT = Object.fromEntries(Object.entries(REF).map(([k, v]) => [k, v.alt]));

const DRY = process.argv.includes("--dry");
const inconnus = process.argv.slice(2).filter((a) => a !== "--dry");
if (inconnus.length) {
  process.stderr.write(`[couvertures] Argument(s) non reconnu(s) : ${inconnus.join(", ")}\n`);
  process.exit(2);
}

/** Tous les fichiers du dépôt, indexés par clé puis par langue. */
const parCle = new Map();
for (const langue of LANGUES) {
  for (const nom of readdirSync(join(RACINE, langue)).filter((f) => f.endsWith(".md"))) {
    const chemin = join(RACINE, langue, nom);
    const texte = readFileSync(chemin, "utf-8");
    const cle = (/^key:\s*"([^"]*)"\s*$/m.exec(texte) || [])[1];
    if (!cle) continue;
    if (!parCle.has(cle)) parCle.set(cle, new Map());
    parCle.get(cle).set(langue, { chemin, texte });
  }
}

/* ---- PHASE 1 : tout valider, ne rien écrire ------------------------------------------------ */
const plan = [];
const erreurs = [];

for (const [cle, alts] of Object.entries(ALT)) {
  const image = join(IMAGES, `${cle}.webp`);
  if (!existsSync(image)) { erreurs.push(`${cle} : image absente du disque (${image})`); continue; }

  const fichiers = parCle.get(cle);
  if (!fichiers) { erreurs.push(`${cle} : aucun guide ne porte cette clé`); continue; }

  for (const langue of LANGUES) {
    const f = fichiers.get(langue);
    if (!f) { erreurs.push(`${cle} : aucune version ${langue}`); continue; }
    if (/^cover:/m.test(f.texte)) { erreurs.push(`${f.chemin} : porte DÉJÀ une couverture`); continue; }
    const alt = alts[langue];
    if (!alt) { erreurs.push(`${cle} : aucun texte alternatif en ${langue}`); continue; }

    /* Le bloc s'insère après `sourceUrl:` s'il existe, sinon après `tags:` — c'est la place
       qu'occupe `cover:` dans les 62 guides existants, et un front matter dont l'ordre varie
       d'un fichier à l'autre se relit mal en revue. */
    const ancre = /^sourceUrl:.*$/m.exec(f.texte) || /^tags:.*$/m.exec(f.texte);
    if (!ancre) { erreurs.push(`${f.chemin} : ni « sourceUrl: » ni « tags: » pour ancrer le bloc`); continue; }

    const bloc = `${ancre[0]}\ncover:\n  image: "/travel-hub/${cle}.webp"\n  alt: "${alt.replace(/"/g, '\\"')}"`;
    plan.push({ chemin: f.chemin, texte: f.texte, ancre: ancre[0], bloc });
  }
}

if (erreurs.length) {
  process.stderr.write(`\n[couvertures] ARRÊT — ${erreurs.length} anomalie(s). AUCUN fichier écrit, `
    + `pas même les ${plan.length} valides :\n`);
  for (const e of erreurs) process.stderr.write(`  ${e}\n`);
  process.exit(1);
}

/* ---- PHASE 2 : écrire le plan entier -------------------------------------------------------- */
if (!DRY) for (const { chemin, texte, ancre, bloc } of plan) {
  writeFileSync(chemin, texte.replace(ancre, bloc));
}

process.stdout.write(`${DRY ? "[à blanc] " : ""}${plan.length} bloc(s) « cover: » posé(s) — `
  + `${Object.keys(ALT).length} guides × ${LANGUES.length} langues\n`);
for (const cle of Object.keys(ALT)) process.stdout.write(`  ${cle}\n`);
