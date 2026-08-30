#!/usr/bin/env node
/**
 * LES CONTRE-ÉPREUVES DE MUTATION DU MICRO-LOT LIBELLÉS.
 *
 *   node test-libelles-mutations.mjs        (exige un dist construit)
 *
 * Le harnais `test-flightfinder-harness.cjs` vérifie que les libellés publics sont JUSTES. Ce
 * fichier vérifie qu'il SAIT LES VOIR FAUX : on mute l'artefact construit d'une seule façon, on
 * rejoue le harnais, et on exige qu'il rougisse. Une garde qu'on n'a jamais vue rougir n'est
 * qu'une affirmation.
 *
 * On mute le DIST, pas les sources : reconstruire quatre fois coûterait une heure et prouverait
 * la même chose. Chaque mutation est appliquée sur le fichier réel puis DÉFAITE, et le fichier
 * est relu après restauration pour s'assurer qu'il est revenu à l'octet près.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

const page = (loc) => `packages/ui/dist${loc ? "/" + loc : ""}/index.html`;

/** Rejoue le harnais complet et dit s'il a rougi. */
function harnaisRougit() {
  try {
    execFileSync("node", ["test-flightfinder-harness.cjs"], { stdio: "pipe" });
    return false;
  } catch {
    return true;
  }
}

/**
 * Mute un fichier du dist, rejoue le harnais, restaure. La mutation DOIT s'appliquer : si le
 * texte cherché est absent, on le dit plutôt que de conclure d'un non-événement.
 */
function mutation(nom, fichier, avant, apres) {
  const original = readFileSync(fichier, "utf8");
  if (!original.includes(avant)) { echec(nom, `le texte à muter est absent de ${fichier} — la mutation ne prouverait rien`); return; }
  writeFileSync(fichier, original.split(avant).join(apres));
  let rouge;
  try { rouge = harnaisRougit(); } finally { writeFileSync(fichier, original); }
  if (readFileSync(fichier, "utf8") !== original) { echec(nom, "le fichier n'a pas été restauré à l'identique"); return; }
  if (rouge) ok(nom);
  else echec(nom, "le harnais est resté VERT sur un artefact muté");
}

/* Ligne de départ : sans harnais vert au repos, aucune mutation ne prouverait rien. */
if (harnaisRougit()) {
  console.error("[libellés] le harnais rougit DÉJÀ sur le dist intact — rien ne peut être prouvé");
  process.exit(1);
}
ok("départ : le harnais est vert sur le dist intact");

/* 1 — le décompte réintroduit, mot pour mot celui du défaut d'origine. */
mutation("1 « Voir les 4 étapes » réintroduit en français", page("fr"),
  "Voir les différentes étapes", "Voir les 4 étapes");

/* 2 — un AUTRE nombre : ce n'est pas le 4 qu'on interdit, c'est le décompte. */
mutation("2 un autre décompte réintroduit en français", page("fr"),
  "Voir les différentes étapes", "Voir les 7 étapes");

/* 3 — la traduction portugaise retirée : la page retombe sur l'anglais, en silence. C'est
   exactement ce qui se passait avant ce lot. */
mutation("3 la traduction portugaise du CTA retirée", page("pt"),
  "Ver as diferentes etapas", "See the different steps");

/* 4 et 5 — LE PAYS RÉELLEMENT RENDU, pas un pays choisi au hasard. Première rédaction fautive,
   nommée : elle mutait les Émirats, alors que le harnais rend la Côte d'Ivoire — la mutation
   s'appliquait au fichier mais ne touchait rien de ce qui était affiché, et restait verte pour
   cette seule raison. Le pays muté est donc CELUI QUE LE HARNAIS CHOISIT, calculé ici par la
   même règle que lui : le premier aéroport dont le pays porte des formalités aller-retour. */
const paysRendu = (() => {
  const { loadHomeParts } = require("./test-lib/finder-dom.cjs");
  const l = loadHomeParts("fr").labels;
  const rt = l.countryRT || {}, iso = l.airportCountry || {};
  for (const [, id] of Object.entries(l.airMap || {})) if (iso[id] && rt[iso[id]]) return rt[iso[id]];
  return null;
})();
if (!paysRendu) echec("4 et 5", "aucun pays à formalités aller-retour n'est atteignable");
else {
  /* 4 — le nom du pays retiré du CTA : le libellé ne dit plus de quel pays il parle. */
  mutation(`4 le nom du pays (${paysRendu.name}) retiré du bandeau`, page("fr"),
    `"name":"${paysRendu.name}","slug":"${paysRendu.slug}"`, `"name":"","slug":"${paysRendu.slug}"`);

  /* 5 — le lien du CTA vidé : un CTA sans destination ne mène nulle part. */
  mutation("5 le lien du bandeau vidé", page("fr"),
    `"name":"${paysRendu.name}","slug":"${paysRendu.slug}"`, `"name":"${paysRendu.name}","slug":""`);
}

/* 6 — le nom interne republié à la place du libellé localisé : la fuite d'origine, refaite. */
mutation("6 le nom interne « IATA Pet Crates » remis dans le libellé", page("fr"),
  "Quelle taille de cage de transport pour mon chien ?", "IATA Pet Crates");

/* 7 et 8 — LES DEUX RAISONS, SOUTE ET FRET, altérées à la source. Elles ne vivent pas dans le
   dist : le moteur les lit dans les traductions au moment du rendu. C'est exactement la fuite
   que l'ancienne preuve ne pouvait pas voir, puisqu'elle s'injectait sa propre réponse. */
const STRINGS_FR = "packages/knowledge/translations/fr/strings.json";
mutation("7 la raison SOUTE altérée dans les traductions", STRINGS_FR,
  "Le voyage en soute exige une cage adaptée à ton chien",
  "Le voyage en soute exige une caisse conforme IATA");
mutation("8 la raison FRET altérée dans les traductions", STRINGS_FR,
  "avec une cage adaptée à ton chien et acceptée pour l’expédition.",
  "avec une caisse homologuée IATA.");

if (defauts) { console.error(`\n[libellés] ÉCHEC — ${defauts} contre-épreuve(s) en défaut`); process.exit(1); }
console.log("\n[libellés] chaque garde a été vue rougir sur sa propre cause.");
