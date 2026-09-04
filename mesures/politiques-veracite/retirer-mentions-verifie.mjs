#!/usr/bin/env node
/**
 * « VÉRIFIÉ LE … » — RETIRER UNE AFFIRMATION QUE RIEN NE FONDE.
 *
 *   node mesures/politiques-veracite/retirer-mentions-verifie.mjs [--ecrire]
 *
 * Sans `--ecrire`, l'outil ne touche à rien et rend le relevé. Il est REJOUABLE et IDEMPOTENT :
 * relancé sur un dépôt déjà corrigé, il rapporte zéro remplacement.
 *
 * POURQUOI. 102 fiches affichent une pastille « Vérifié le 11 juil. 2026 », cochée en vert, et
 * 100 une ligne « … · dernière vérification 8 août 2026 ». Le lot « frontière de confiance » vient
 * d'établir que ZÉRO des 302 politiques ne porte de phrase citée : l'historique de la plupart dit
 * lui-même « Initial import — pending live re-verification ». Une date de RELEVÉ n'est pas une
 * date de VÉRIFICATION, et l'écrire en vert avec une coche est l'affirmation la plus visible du
 * site — celle qu'un visiteur lit avant tout le reste.
 *
 * CE QUI EST REMPLACÉ, ET CE QUI NE L'EST PAS. Seul le VERBE change. La date reste, le nombre de
 * sources reste, la phrase autour reste : ce qui est vrai n'est pas retiré, ce qui est faux
 * n'est pas conservé. La coche « ✓ » devient un calendrier « 🗓 » et la pastille perd son vert :
 * un signe qui dit « validé » est une affirmation, au même titre qu'un mot.
 *
 * `verified_date:` — le champ STRUCTUREL — n'est pas touché. Il n'est pas lu par le visiteur, il
 * sert à dériver `review_due` (cadence de 90 jours, ADR-0007) : le renommer casserait la cadence
 * sans rien corriger d'affiché.
 *
 * ÉCRITURE TEXTUELLE, JAMAIS UN ALLER-RETOUR YAML. Le round-trip `parseDocument` → `String()` ne
 * restitue à l'identique aucune des fiches (guillemets, largeur de ligne, commentaires) : le diff
 * deviendrait illisible et la correction indiscernable d'un reformatage. Règle héritée de
 * `mesures/t0b2/outils/ecrire-policies-yaml.mjs`, et elle vaut toujours.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ECRIRE = process.argv.includes("--ecrire");
const SRC = "content/airlines";

/* La pastille, prise comme un BLOC : icône, les quatre libellés, et la classe verte qui suit.
   La prendre ligne par ligne remplacerait « Verified » partout où il apparaît — y compris dans
   une phrase de canal où il peut être légitime. */
const PASTILLE = new RegExp(
  "([ \\t]*)- icon: ✓\\n"
  + "([ \\t]*)label:\\n"
  + "([ \\t]*)en: Verified ([^\\n]+)\\n"
  + "([ \\t]*)fr: Vérifié le ([^\\n]+)\\n"
  + "([ \\t]*)es: Verificado (?:el )?([^\\n]+)\\n"
  + "([ \\t]*)pt: \"Verificado em ([^\\n]+)\"\\n"
  + "([ \\t]*)cls: ok\\n",
  "g",
);

/* Le segment de la ligne « sources » : le verbe seul, la date conservée telle quelle.
 *
 * HUIT FORMES, ET NON QUATRE. Ma première rédaction n'en connaissait que quatre — celles que
 * j'avais dénombrées en cherchant « last verified ». Deux fiches, Icelandair et KM Malta, en
 * portent une CINQUIÈME (« · verified 18 July 2026 », sans « last »), et ses trois traductions.
 * Je ne les ai pas trouvées en réfléchissant : le contrôle de résidu les a nommées. C'est
 * exactement la faute que ce dépôt collectionne — un instrument qui ne parle que de ce qu'il
 * reconnaît compte zéro là où il ne voit rien. Le relevé résiduel existe pour ça, et il reste. */
const SEGMENTS = [
  [/· last verified /g, "· sources collected "],
  [/· dernière vérification /g, "· sources relevées le "],
  [/· última verificación /g, "· fuentes recopiladas el "],
  [/· última verificação em /g, "· fontes recolhidas em "],
  [/· verified /g, "· sources collected "],
  [/· vérifiée le /g, "· sources relevées le "],
  [/· verificada el /g, "· fuentes recopiladas el "],
  [/· verificada em /g, "· fontes recolhidas em "],
];

let fiches = 0, pastilles = 0, segments = 0, ecrites = 0;
const restants = [];

for (const f of readdirSync(SRC).filter((x) => x.endsWith(".yml") && x !== "_template.yml").sort()) {
  const chemin = join(SRC, f);
  const avant = readFileSync(chemin, "utf8");
  fiches++;
  let apres = avant.replace(PASTILLE, (_m, i1, i2, i3, dEn, i5, dFr, i7, dEs, i9, dPt) => {
    pastilles++;
    return `${i1}- icon: 🗓\n${i2}label:\n`
      + `${i3}en: Updated ${dEn}\n`
      + `${i5}fr: Mise à jour le ${dFr}\n`
      + `${i7}es: Actualizado el ${dEs}\n`
      + `${i9}pt: "Atualizado em ${dPt}"\n`;
  });
  for (const [motif, remplacement] of SEGMENTS) {
    apres = apres.replace(motif, () => { segments++; return remplacement; });
  }
  /* Ce que l'outil n'a PAS su corriger doit se voir, plutôt que de passer pour un zéro. */
  if (/Verified \d|Vérifié le \d|Verificado (?:el |em )?\d|last verified|dernière vérification|última verifica/i.test(apres)) {
    restants.push(f);
  }
  if (apres !== avant) {
    ecrites++;
    if (ECRIRE) writeFileSync(chemin, apres);
  }
}

console.log(`${fiches} fiches lues`);
console.log(`  ${pastilles} pastille(s) « Vérifié le … » remplacée(s) par « Mise à jour le … »`);
console.log(`  ${segments} segment(s) « dernière vérification » remplacé(s) par « sources relevées le »`);
console.log(`  ${ecrites} fiche(s) ${ECRIRE ? "réécrite(s)" : "à réécrire"}`);
if (restants.length) {
  console.log(`\n  ⚠ ${restants.length} fiche(s) portent ENCORE une mention non reconnue :`);
  for (const f of restants) console.log(`      ${f}`);
  process.exitCode = 1;
} else {
  console.log(`\n  aucune mention de vérification résiduelle`);
}
