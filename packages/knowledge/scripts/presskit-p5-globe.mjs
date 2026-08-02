#!/usr/bin/env node
/* Page 5, bloc « Détails du voyage » : la mappemonde n'est plus coupée.
 *
 * LE DIAGNOSTIC, qui change la correction. Le défaut n'était pas un problème de placement : le
 * FICHIER lui-même est rogné. `p5-globe.png` mesure 240 × 223 alors que la sphère qu'il contient
 * a un diamètre de 239 px — il manque 7,5 px de calotte en haut et 8,5 px en bas. La sphère est
 * donc aplatie des deux côtés, et le bas se voit parce qu'il donne sur le vide du bloc. Remonter
 * ou décaler l'image n'y aurait rien changé : le pixel manquant reste manquant où qu'on le place.
 *
 * LA RÉPARATION. `p5-globe-2.png` fait 240 × 239, soit le disque entier. Les deux calottes sont
 * reconstruites en miroir des lignes voisines — c'est justifiable ici et nulle part ailleurs :
 * ces zones sont de l'océan uni, sans continent ni tracé, et le rendu final fait 13 mm de haut.
 * Un masque circulaire anticrénelé redonne ensuite au disque un bord net et régulier.
 *
 * NOM DE FICHIER DIFFÉRENT, et non écrasement : les plaquettes sont distribuées et mises en
 * cache ; un fichier remplacé sur place resservirait l'ancienne image pendant des jours.
 *
 * LA HAUTEUR SUIT, ET ELLE N'EST PAS LA MÊME PARTOUT. Trois plaquettes affichent la sphère à
 * 6,2cqh, l'espagnole à 5cqh — son titre est plus long et lui laisse moins de place. La consigne
 * de hauteur ne peut donc pas être écrite en dur : elle est LUE puis multipliée par 1,0717, le
 * rapport qui conserve le diamètre apparent quand l'image passe de 223 à 239 px de haut. Sans
 * cela, la sphère réparée paraîtrait plus petite que celle qu'elle remplace.
 *
 * LE DÉCALAGE. 10 px vers la gauche et 2 px vers le haut, réglés sur rendu : d'abord 15 px à
 * gauche, puis 5 px repris vers la droite une fois la sphère entière visible. Les deux valeurs
 * sont ici, en clair, et le script est REJOUABLE — il reconnaît une image déjà remplacée et se
 * contente d'en réécrire le décalage, au lieu de l'ignorer comme il le faisait d'abord.
 *
 *   node packages/knowledge/scripts/presskit-p5-globe.mjs [--dry]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIR = "packages/ui/public/presskit";
const dry = process.argv.includes("--dry");
const PAGE = 4;
const GAUCHE = 10;   // 15 px puis 5 px repris vers la droite
const HAUT = 2;      // léger relevé, demandé après le premier rendu

/* 240/223 ÷ 240/239 : ce qu'il faut ajouter à la hauteur pour que la largeur ne bouge pas. */
const RATIO = 239 / 223;
const MOTIF = /<img src="assets\/icons\/p5-globe\.png" alt="" style="height:([\d.]+)cqh;width:auto;display:block;flex:0 0 auto">/;
/* La forme déjà corrigée : on relit sa hauteur, qui a donc DÉJÀ subi le ratio — d'où le
 * `dejaMise` plus bas, qui empêche de l'appliquer une seconde fois. */
const DEJA = /<img src="assets\/icons\/p5-globe-2\.png" alt="" style="height:([\d.]+)cqh;[^"]*">/;

if (!existsSync(`${DIR}/assets/icons/p5-globe-2.png`)) {
  console.error("✗ p5-globe-2.png absent — réparer l'image avant de lancer ce script.");
  process.exit(1);
}

let faits = 0;
for (const langue of ["en", "fr", "es", "pt"]) {
  const path = `${DIR}/press-kit-${langue}.html`;
  if (!existsSync(path)) { console.error(`${path} absent`); continue; }
  const html = readFileSync(path, "utf-8");
  const pages = html.match(/<section class="page"[^>]*>[\s\S]*?<\/section>/g) ?? [];
  if (pages.length !== 13) { console.error(`✗ ${langue} : ${pages.length} pages au lieu de 13`); process.exit(1); }
  const p = pages[PAGE];
  const trouve = MOTIF.exec(p) ?? DEJA.exec(p);
  if (!trouve) {
    console.error(`✗ ${langue} : la mappemonde de la page 5 n'est pas celle attendue — rien n'est écrit.`);
    process.exit(1);
  }
  const dejaMise = trouve[0].includes("p5-globe-2.png");
  const avant = Number(trouve[1]);
  const apres = dejaMise ? avant : Math.round(avant * RATIO * 10) / 10;
  const neuf = `<img src="assets/icons/p5-globe-2.png" alt="" style="height:${apres}cqh;width:auto;` +
    `display:block;flex:0 0 auto;transform:translate(-${GAUCHE}px,-${HAUT}px)">`;
  if (!dry) writeFileSync(path, html.replace(p, p.replace(trouve[0], neuf)));
  faits++;
  console.log(`${langue} : mappemonde entière, ${avant} → ${apres}cqh, ` +
    `décalée de ${GAUCHE} px à gauche et ${HAUT} px vers le haut`);
}
console.log(`\n${faits} plaquette(s) mise(s) à jour${dry ? " — essai à blanc" : ""}`);
