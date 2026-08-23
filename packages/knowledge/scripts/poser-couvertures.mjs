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
 * PAS DE CHAMP `credit`, ET C'EST UNE DÉCISION. Les 62 guides importés en portent un —
 * attribution Unsplash avec ses paramètres UTM — parce qu'ils ont été constitués ainsi. Pour ces
 * dix-là, le propriétaire du site a choisi de ne pas en poser. La licence Unsplash ne l'exige
 * pas : elle rend l'attribution appréciée, non obligatoire. Le schéma la déclare d'ailleurs
 * `optional()`. On l'écrit ici pour que l'exception soit LUE comme un choix et non découverte
 * comme un oubli — et pour corriger au passage le commentaire du schéma, qui affirmait à tort
 * que « la licence Unsplash l'exige ».
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

/**
 * Ce que MONTRE chaque photo, dans les quatre langues.
 *
 * Rédigé en REGARDANT les images, une à une. Un `alt` qui décrit ce que l'article traite plutôt
 * que ce que la photo montre est pire qu'un `alt` absent : il ment à qui ne voit pas l'image,
 * et lui seul.
 */
const ALT = {
  "airline-pet-policy-changes": {
    en: "A Yorkshire Terrier held up in an aircraft cabin, beside a window and a seat, wearing an identification tag",
    fr: "Un yorkshire tenu dans une cabine d'avion, près d'un hublot et d'un siège, portant une étiquette d'identification",
    es: "Un yorkshire terrier sostenido en la cabina de un avión, junto a una ventanilla y un asiento, con una etiqueta de identificación",
    pt: "Um yorkshire terrier no colo dentro da cabine de um avião, junto a uma janela e a um assento, com uma etiqueta de identificação",
  },
  "airport-day-with-a-dog": {
    en: "A yellow Labrador lying on a terminal floor, in a harness and on a lead, at its handler's feet",
    fr: "Un labrador sable couché sur le sol d'une aérogare, en harnais et en laisse, aux pieds de son maître",
    es: "Un labrador color arena tumbado en el suelo de una terminal, con arnés y correa, a los pies de su guía",
    pt: "Um labrador amarelo deitado no piso de um terminal, de peitoral e guia, aos pés do seu tutor",
  },
  "booking-a-pet-flight": {
    en: "A small Pomeranian wearing glasses, standing in front of a tablet on a wooden table",
    fr: "Un petit spitz nain à lunettes, debout devant une tablette posée sur une table en bois",
    es: "Un pequeño pomerania con gafas, de pie ante una tableta sobre una mesa de madera",
    pt: "Um pequeno lulu da pomerânia de óculos, em pé diante de um tablet sobre uma mesa de madeira",
  },
  "cargo-vs-excess-baggage": {
    en: "A Boeing 747 at the jet bridge, surrounded by cargo containers and ground vehicles",
    fr: "Un Boeing 747 à la passerelle, entouré de conteneurs de fret et d'engins de piste",
    es: "Un Boeing 747 en la pasarela, rodeado de contenedores de carga y vehículos de pista",
    pt: "Um Boeing 747 na ponte de embarque, cercado por contêineres de carga e veículos de pista",
  },
  "layovers-with-a-pet": {
    en: "A deserted airport connecting walkway, lined with moving walkways and glass walls",
    fr: "Une passerelle de correspondance déserte, bordée de tapis roulants et de baies vitrées",
    es: "Una pasarela de conexión desierta, flanqueada por cintas transportadoras y cristaleras",
    pt: "Uma passarela de conexão deserta, ladeada por esteiras rolantes e paredes de vidro",
  },
  "measuring-your-dog-for-a-crate": {
    en: "A Border Collie lying in an open wire crate, on a mat",
    fr: "Un border collie couché dans une caisse grillagée ouverte, sur un tapis",
    es: "Un border collie tumbado en un transportín de rejilla abierto, sobre una manta",
    pt: "Um border collie deitado numa caixa de arame aberta, sobre um tapete",
  },
  "pet-flight-timeline": {
    en: "Two black Labradors in vests, sitting on the apron in front of an aircraft",
    fr: "Deux labradors noirs en gilet, assis sur le tarmac devant un avion",
    es: "Dos labradores negros con chaleco, sentados en la pista ante un avión",
    pt: "Dois labradores pretos de colete, sentados na pista diante de um avião",
  },
  "pet-heat-embargoes": {
    en: "A light-coated dog flopped in the shade on cobblestones, wearing sunglasses",
    fr: "Un chien au poil clair affalé à l'ombre sur des pavés, coiffé de lunettes de soleil",
    es: "Un perro de pelo claro tumbado a la sombra sobre adoquines, con gafas de sol",
    pt: "Um cachorro de pelo claro largado à sombra sobre paralelepípedos, de óculos de sol",
  },
  "pet-travel-documents": {
    en: "An open passport covered in visa stamps, resting on a folder",
    fr: "Un passeport ouvert couvert de tampons de visa, posé sur une chemise",
    es: "Un pasaporte abierto cubierto de sellos de visado, sobre una carpeta",
    pt: "Um passaporte aberto coberto de carimbos de visto, sobre uma pasta",
  },
  "snub-nosed-breeds-and-flying": {
    en: "A French Bulldog lying on a sheepskin, its short muzzle clearly visible",
    fr: "Un bouledogue français couché sur une peau de mouton, museau court bien visible",
    es: "Un bulldog francés tumbado sobre una piel de oveja, con el hocico corto bien visible",
    pt: "Um buldogue francês deitado sobre uma pele de carneiro, com o focinho curto bem visível",
  },
};

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
