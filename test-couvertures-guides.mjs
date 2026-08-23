#!/usr/bin/env node
/**
 * LES COUVERTURES DES GUIDES — CE QUE CE HARNAIS PROUVE, ET CE QU'IL NE PROUVE PAS.
 *
 *   node test-couvertures-guides.mjs        (lit les sources, aucun build nécessaire)
 *
 * IL NE PROUVE PAS QUE LES TEXTES ALTERNATIFS SONT DANS LA BONNE LANGUE. Sa première version le
 * laissait croire — elle concluait « chaque guide montre quelque chose, et le dit dans sa
 * langue » alors qu'elle vérifiait seulement que les quatre chaînes DIFFÈRENT. Remplacer l'alt
 * portugais par une AUTRE phrase anglaise la laissait verte. Aucun contrôle automatique ne juge
 * une langue de façon fiable sur une phrase de dix mots, et prétendre le contraire est pire que
 * de se taire : cela endort la relecture humaine qui, elle, le pourrait.
 *
 * CE QU'IL PROUVE À LA PLACE, plus étroit et plus vrai : les 40 textes alternatifs des dix guides
 * du lot 2 sont EXACTEMENT ceux qui ont été relus et approuvés, consignés dans
 * `couvertures-guides.json`. Changer un alt devient un geste en deux endroits, chacun relisible
 * en revue. La relecture par un locuteur natif reste un PRÉREQUIS, jamais une conséquence.
 *
 * SIX PROPRIÉTÉS :
 *
 *   1. BIJECTION DES GUIDES — exactement 72 clés logiques, chacune présente dans les QUATRE
 *      langues, aucun doublon (clé, langue). Compter 72 fichiers par langue ne suffisait pas :
 *      renommer la seule clé portugaise d'un guide laissait 72 fichiers partout, un guide en
 *      trois langues, une clé fantôme en portugais — et le harnais annonçait « 73 guides
 *      pourvus dans les quatre langues ». Un décompte n'est pas une bijection.
 *   2. COUVERTURE COMPLÈTE — exactement 72 guides pourvus dans les quatre langues.
 *   3. L'IMAGE EXISTE ET EST UNE IMAGE — `image` n'est qu'une chaîne au schéma : un fichier texte
 *      renommé `.webp` passait. On vérifie la signature RIFF/WEBP, une taille non triviale, et
 *      la largeur décodée depuis l'en-tête.
 *   4. UNE SEULE IMAGE PAR GUIDE — une couverture est un fait éditorial attaché au guide, pas à
 *      sa traduction.
 *   5. TEXTES ALTERNATIFS PRÉSENTS ET DISTINCTS entre langues d'un même guide.
 *   6. RÉFÉRENCE RESPECTÉE — pour les dix guides du lot 2 : alt identique à la référence, et
 *      manifeste de provenance complet, empreinte et taille confrontées au fichier réel.
 *
 * JAMAIS VERT FAUTE DE MATIÈRE : il exige 72 clés et échoue s'il en lit moins.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const RACINE = "packages/ui/src/content/guides";
const PUBLIC = "packages/ui/public";
const REFERENCE = "couvertures-guides.json";
const LANGUES = ["en", "fr", "es", "pt"];
const CLES_ATTENDUES = 72;
const OCTETS_MINIMUM = 4096;   // en deçà, ce n'est pas une photographie de 1 400 px

const defauts = [];
const echec = (n, m) => defauts.push(`${n}. ${m}`);

const champ = (t, n) => (new RegExp(`^\\s*${n}:\\s*"([\\s\\S]*?)"\\s*$`, "m").exec(t) || [])[1] ?? null;

function couverture(texte) {
  const bloc = /^cover:\s*\n((?:[ \t]+\w+:.*\n?)+)/m.exec(texte);
  if (!bloc) return null;
  return { image: champ(bloc[1], "image"), alt: champ(bloc[1], "alt") };
}

/**
 * La largeur d'un WebP, lue dans son en-tête — sans dépendance.
 *
 * Rend `{ largeur }` ou `{ motif }`. Trois formes de flux existent et une image produite
 * aujourd'hui peut changer de forme demain selon l'encodeur : les trois sont donc décodées,
 * plutôt qu'une seule avec un repli silencieux sur « je ne sais pas », qui reviendrait à ne rien
 * vérifier le jour où l'encodeur change.
 */
function largeurWebp(octets) {
  if (octets.length < 30) return { motif: "fichier trop court pour porter un en-tête WebP" };
  if (octets.toString("ascii", 0, 4) !== "RIFF") return { motif: "signature RIFF absente" };
  if (octets.toString("ascii", 8, 12) !== "WEBP") return { motif: "signature WEBP absente" };
  const forme = octets.toString("ascii", 12, 16);
  const p = 20;                                   // début de la charge utile du premier chunk
  if (forme === "VP8 ") {
    if (octets.toString("hex", p + 3, p + 6) !== "9d012a") return { motif: "code de départ VP8 absent" };
    return { largeur: octets.readUInt16LE(p + 6) & 0x3fff };
  }
  if (forme === "VP8L") {
    if (octets[p] !== 0x2f) return { motif: "signature VP8L absente" };
    return { largeur: (octets.readUInt32LE(p + 1) & 0x3fff) + 1 };
  }
  if (forme === "VP8X") return { largeur: octets.readUIntLE(p + 4, 3) + 1 };
  return { motif: `forme de flux inconnue « ${forme} »` };
}

/* ---- lecture ------------------------------------------------------------------------------- */
if (!existsSync(REFERENCE)) {
  process.stderr.write(`[couvertures] ÉCHEC — référence absente : ${REFERENCE}\n`);
  process.exit(1);
}
const REF = JSON.parse(readFileSync(REFERENCE, "utf-8")).images;
if (!REF || Object.keys(REF).length === 0) {
  process.stderr.write("[couvertures] ÉCHEC — la référence est VIDE : elle s'accorderait avec n'importe quoi.\n");
  process.exit(1);
}

/* LES DIX IDENTITÉS ATTENDUES, ÉCRITES ICI ET NON LUES DANS LA RÉFÉRENCE.
 *
 * « Référence non vide » ne verrouille rien : retirer une entrée de `images` retirait du même
 * geste l'image, sa provenance et ses quatre textes alternatifs, et le harnais annonçait
 * tranquillement « 9 images du lot 2 · 36 textes alternatifs », en sortant 0. Une garantie
 * disparue en silence, exactement comme une mutation supprimée du catalogue.
 *
 * La liste vit donc DANS LE CONTRÔLE, et la bijection est exigée dans les deux sens : une clé
 * absente de la référence échoue, une clé qu'elle ajouterait sans qu'on l'ait décidé aussi. */
const CLES_LOT2 = [
  "airline-pet-policy-changes", "airport-day-with-a-dog", "booking-a-pet-flight",
  "cargo-vs-excess-baggage", "layovers-with-a-pet", "measuring-your-dog-for-a-crate",
  "pet-flight-timeline", "pet-heat-embargoes", "pet-travel-documents",
  "snub-nosed-breeds-and-flying",
];
{
  const presentes = new Set(Object.keys(REF));
  const absentes = CLES_LOT2.filter((k) => !presentes.has(k));
  const intruses = [...presentes].filter((k) => !CLES_LOT2.includes(k));
  if (absentes.length) echec(6, `${absentes.length} clé(s) ATTENDUE(S) absente(s) de la référence : ${absentes.join(", ")}`);
  if (intruses.length) echec(6, `${intruses.length} clé(s) INCONNUE(S) du contrôle dans la référence : ${intruses.join(", ")}`);
}

/** clé → langue → { chemin, cover }. Les doublons sont conservés pour être dénoncés. */
const parCle = new Map();
const doublons = [];
for (const langue of LANGUES) {
  for (const nom of readdirSync(join(RACINE, langue)).filter((f) => f.endsWith(".md"))) {
    const chemin = join(RACINE, langue, nom);
    const texte = readFileSync(chemin, "utf-8");
    const cle = champ(texte, "key");
    if (!cle) { echec(1, `${chemin} : aucun champ « key: »`); continue; }
    if (!parCle.has(cle)) parCle.set(cle, new Map());
    if (parCle.get(cle).has(langue)) {
      doublons.push(`${cle} en ${langue.toUpperCase()} : ${parCle.get(cle).get(langue).chemin} ET ${chemin}`);
    }
    parCle.get(cle).set(langue, { chemin, cover: couverture(texte) });
  }
}

/* ---- 1. BIJECTION -------------------------------------------------------------------------- */
if (parCle.size !== CLES_ATTENDUES) {
  echec(1, `${parCle.size} clés logiques au lieu de ${CLES_ATTENDUES} — le harnais refuse de conclure sur un corpus qui n'est pas celui qu'il connaît`);
}
for (const d of doublons) echec(1, `doublon (clé, langue) — ${d}`);
for (const [cle, versions] of parCle) {
  const manquantes = LANGUES.filter((l) => !versions.has(l));
  if (manquantes.length) {
    echec(1, `${cle} : absent en ${manquantes.map((l) => l.toUpperCase()).join(", ")} — présent seulement en ${[...versions.keys()].map((l) => l.toUpperCase()).join(", ")}`);
  }
}

/* ---- 2 à 5. couvertures --------------------------------------------------------------------- */
let quadrilingues = 0;
for (const [cle, versions] of parCle) {
  const images = new Set();
  const alts = new Map();
  let completes = 0;

  for (const [langue, v] of versions) {
    const c = v.cover;
    if (!c) { echec(2, `${v.chemin} : aucune couverture`); continue; }
    if (!c.image) { echec(2, `${v.chemin} : bloc « cover: » sans « image: »`); continue; }
    if (!c.alt || !c.alt.trim()) { echec(5, `${v.chemin} : couverture sans texte alternatif`); continue; }
    completes++;
    images.add(c.image);
    alts.set(langue, c.alt);

    /* 3. l'image existe, et c'est une image */
    if (!c.image.startsWith("/")) { echec(3, `${v.chemin} : « ${c.image} » n'est pas un chemin du site`); continue; }
    const disque = join(PUBLIC, c.image.replace(/^\//, ""));
    if (!existsSync(disque)) { echec(3, `${v.chemin} : image INTROUVABLE — ${disque}`); continue; }
    const taille = statSync(disque).size;
    if (taille < OCTETS_MINIMUM) {
      echec(3, `${disque} : ${taille} octets — trop petit pour une photographie, fichier probablement tronqué`);
      continue;
    }
    const l = largeurWebp(readFileSync(disque));
    if (l.motif) echec(3, `${disque} : ce n'est pas un WebP décodable — ${l.motif}`);
    else if (REF[cle] && l.largeur !== REF[cle].largeur) {
      echec(3, `${disque} : largeur ${l.largeur} px au lieu des ${REF[cle].largeur} px déclarés à la référence`);
    }
  }

  if (completes === LANGUES.length) quadrilingues++;

  /* 4. une seule image pour les quatre langues */
  if (images.size > 1) {
    echec(4, `${cle} : ${images.size} images différentes selon la langue — ${[...images].join(" · ")}`);
  }
  /* 5. des textes alternatifs distincts */
  const vus = new Map();
  for (const [langue, alt] of alts) {
    if (vus.has(alt)) echec(5, `${cle} : ${langue.toUpperCase()} et ${vus.get(alt).toUpperCase()} partagent le MÊME texte alternatif — « ${alt.slice(0, 60)}… »`);
    else vus.set(alt, langue);
  }
}
if (quadrilingues !== CLES_ATTENDUES) {
  echec(2, `${quadrilingues} guides pourvus d'une couverture dans les quatre langues, au lieu de ${CLES_ATTENDUES}`);
}

/* ---- 6. RÉFÉRENCE ET PROVENANCE ------------------------------------------------------------- */
/* Requis quel que soit le statut : ce qui identifie le fichier et ce sur quoi on s'appuie. */
const OBLIGATOIRES = ["fichier", "sha256", "octets", "largeur", "origine", "methode_acquisition",
                      "base_de_droits", "acquise_le"];
/* Requis SEULEMENT si la provenance se déclare VÉRIFIÉE. */
const EXIGES_SI_VERIFIE = ["auteur", "url_origine", "verificateur", "verifie_le"];

for (const [cle, entree] of Object.entries(REF)) {
  const versions = parCle.get(cle);
  if (!versions) { echec(6, `${cle} : référencé mais aucun guide ne porte cette clé`); continue; }

  for (const c of OBLIGATOIRES) {
    if (entree[c] === undefined || entree[c] === null || entree[c] === "") {
      echec(6, `${cle} : champ de provenance « ${c} » vide ou absent`);
    }
  }

  /* LE STATUT DE PROVENANCE EST UN CONTRAT, PAS UNE ÉTIQUETTE.
   *
   * Deux attaques passaient : supprimer entièrement `verifie`, et poser `verifie: true` avec un
   * auteur et une URL à `null`. Le champ censé distinguer « déclaré » de « établi » ne
   * distinguait donc rien — il décorait. Une union stricte le rend contraignant :
   *
   *   verifie: false  les lacunes sont PERMISES, mais l'origine et la méthode d'acquisition
   *                   doivent être explicites : on doit savoir d'où le fichier vient et comment
   *                   il est arrivé, même si l'on ignore qui l'a photographié.
   *   verifie: true   auteur, URL d'origine, NOM DU VÉRIFICATEUR et DATE de vérification sont
   *                   obligatoires. Se déclarer vérifié sans dire par qui ni quand n'est pas une
   *                   vérification, c'est une affirmation. */
  if (typeof entree.verifie !== "boolean") {
    echec(6, `${cle} : champ « verifie » absent ou non booléen — le statut de provenance doit être déclaré, jamais sous-entendu`);
  } else if (entree.verifie === true) {
    for (const c of EXIGES_SI_VERIFIE) {
      if (entree[c] === undefined || entree[c] === null || entree[c] === "") {
        echec(6, `${cle} : « verifie: true » mais « ${c} » vide — une provenance vérifiée dit par qui, quand, et d'où`);
      }
    }
  }

  const disque = join(PUBLIC, String(entree.fichier ?? "").replace(/^\//, ""));
  if (!existsSync(disque)) { echec(6, `${cle} : le fichier déclaré à la référence est introuvable — ${disque}`); }
  else {
    const octets = readFileSync(disque);
    if (octets.length !== entree.octets) echec(6, `${cle} : ${octets.length} octets sur le disque, ${entree.octets} déclarés`);
    const sha = createHash("sha256").update(octets).digest("hex");
    if (sha !== entree.sha256) echec(6, `${cle} : empreinte ${sha.slice(0, 16)}… sur le disque, ${String(entree.sha256).slice(0, 16)}… déclarée`);
  }

  for (const langue of LANGUES) {
    const attendu = entree.alt?.[langue];
    if (!attendu) { echec(6, `${cle} : aucun texte alternatif ${langue.toUpperCase()} à la référence`); continue; }
    const v = versions.get(langue);
    if (!v?.cover?.alt) continue;                 // déjà dénoncé plus haut
    if (v.cover.alt !== attendu) {
      echec(6, `${v.chemin} : texte alternatif NON CONFORME à la référence\n        fichier  « ${v.cover.alt} »\n        référence « ${attendu} »`);
    }
  }
}

/* ---- verdict --------------------------------------------------------------------------------- */
if (defauts.length === 0) {
  const nonVerifies = Object.values(REF).filter((e) => e.verifie !== true).length;
  process.stdout.write(`${parCle.size} clés · chacune en ${LANGUES.length} langues · ${quadrilingues} pourvues d'une couverture partout\n`);
  process.stdout.write(`${Object.keys(REF).length} images du lot 2 : WebP décodés, empreintes et tailles conformes au manifeste,\n`);
  process.stdout.write(`${Object.keys(REF).length * LANGUES.length} textes alternatifs identiques à la référence approuvée.\n\n`);
  if (nonVerifies) {
    process.stdout.write(`  (${nonVerifies} provenance(s) DÉCLARÉE(S) et non vérifiée(s) — voir « verifie » à la référence)\n`);
  }
  process.stdout.write("  (la LANGUE des textes alternatifs n'est pas contrôlable ici — cette relecture reste humaine)\n\n");
  process.stdout.write("[couvertures] bijection tenue, images réelles, textes alternatifs conformes à ce qui a été approuvé.\n");
  process.exit(0);
}
process.stderr.write(`\n[couvertures] ÉCHEC — ${defauts.length} défaut(s) :\n`);
for (const d of defauts.slice(0, 30)) process.stderr.write(`  ${d}\n`);
if (defauts.length > 30) process.stderr.write(`  … et ${defauts.length - 30} autre(s)\n`);
process.exit(1);
