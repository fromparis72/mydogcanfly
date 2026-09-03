#!/usr/bin/env node
/**
 * LA RÉÉCRITURE DU VOCABULAIRE IATA DANS LES SOURCES DE VÉRITÉ ACTIVES.
 *
 *   node reecrire-iata.mjs            n'écrit rien : compte, et NOMME ce qu'il ne sait pas traiter
 *   node reecrire-iata.mjs --ecrire   applique
 *
 * POURQUOI UN SCRIPT PLUTÔT QU'UNE MAIN. 799 occurrences dans 302 fichiers : à la main, le geste
 * n'est ni rejouable ni relisible, et une substitution manquée ne se voit pas. Ici la table est
 * le contrat, elle se relit d'un coup d'œil, et le relevé canonique dit après coup s'il reste
 * quoi que ce soit.
 *
 * LES DEUX RÈGLES DE FOND, ARBITRÉES.
 *   1. LE CONTENANT RÉEL EST PRÉSERVÉ. Une caisse reste une caisse, un sac reste un sac, un
 *      « transportín » reste un « transportín ». On retire l'ATTRIBUTION à l'IATA, pas l'objet.
 *      Remplacer mécaniquement tout contenant par « cage » a été explicitement refusé.
 *   2. LES RÉFÉRENCES RÉGLEMENTAIRES LICITES NE BOUGENT PAS — « normes IATA », « exigences
 *      IATA », « IATA requirements », « IATA LAR », « Live Animals Regulations ». Elles disent
 *      vrai : l'IATA publie bien des exigences. Ce qu'elle ne fait pas, c'est approuver,
 *      certifier ou homologuer un modèle.
 *
 * CE QU'IL NE FAIT PAS. Il ne touche AUCUN artefact généré : ceux-là se régénèrent depuis leurs
 * sources. Il ne touche pas l'héritage Hugo v1, ni `content/hub`, ni `content/posts` — 669
 * occurrences qui ne publient plus, dette déclarée et arbitrée hors de ce lot.
 *
 * CE QU'IL SIGNALE. Toute occurrence interdite qu'aucune règle ne reconnaît est IMPRIMÉE avec son
 * contexte, et le script sort en 1. Une réécriture qui laisse passer en silence ne vaut rien.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { classer, MOTIF, SLUGS_CONSERVES } from "./inventaire-iata.mjs";

const ECRIRE = process.argv.includes("--ecrire");

/* LES SOURCES DE VÉRITÉ ACTIVES, ET ELLES SEULES. */
const SURFACES = [
  "content/airlines/", "content/countries/",
  "packages/ui/src/content/guides/", "packages/ui/public/presskit/",
];

/* ---- LA TABLE ------------------------------------------------------------------------------
 * L'ORDRE COMPTE : le plus spécifique d'abord. « jaula rígida conforme a la IATA » doit être vu
 * avant « conforme a la IATA », sinon la seconde règle coupe la phrase en deux et laisse un
 * « jaula rígida » orphelin de son sens. Même raison pour « caixa de transporte IATA », qui doit
 * passer avant « caixa IATA ».
 *
 * TOUTES LES RÈGLES SONT INSENSIBLES À LA CASSE. Première rédaction fautive, mesurée : elles ne
 * l'étaient pas, et 117 occurrences restaient — presque toutes en tête de phrase, « Caisse IATA »,
 * « Jaula IATA », « Caixa IATA ». Une règle sensible à la casse ne voit pas le début des phrases,
 * c'est-à-dire l'endroit le plus visible d'un texte.
 *
 * LA MAJUSCULE SE DÉCIDE SUR LA POSITION, PAS SUR LA CASSE DU TEXTE TROUVÉ. Seconde faute,
 * trouvée sur les échantillons : la règle capitalisait dès que le texte trouvé commençait par une
 * majuscule — or « IATA » est un acronyme, il en porte TOUJOURS une. « a rigid IATA crate »
 * devenait donc « a rigid Travel crate », une capitale au milieu d'une phrase. On regarde
 * désormais ce qui PRÉCÈDE l'occurrence : début de texte, de ligne, ou fin de phrase. */
const TABLE = [
  /* — ANGLAIS — le contenant garde son nom, l'attribution part. */
  [/\bIATA[- ]approved\b/g, "compliant with the applicable requirements"],
  [/\bIATA[- ]compliant\b/g, "compliant with the applicable requirements"],
  [/\bIATA[- ]certified\b/g, "compliant with the applicable requirements"],
  [/\bIATA[- ]accredited\b/g, "compliant with the applicable requirements"],
  [/\brigid IATA type\b/g, "rigid travel"],
  [/\bIATA crates\b/g, "travel crates"],
  [/\bIATA crate\b/g, "travel crate"],
  [/\bIATA kennel\b/g, "kennel"],
  [/\bIATA carrier\b/g, "travel carrier"],
  [/\bIATA cage\b/g, "travel cage"],

  /* — FRANÇAIS — */
  [/\btype IATA rigide\b/g, "de transport rigide"],
  /* « contenant IATA » : l'instrument canonique ne le voit PAS — « contenant » ne figure pas dans
     sa famille de contenants, qui connaît « conteneur ». C'est un trou signalé à l'arbitrage ;
     en attendant, la formulation est réécrite ici, parce qu'elle attribue bien un contenant à
     l'IATA et qu'elle est publiée sur la fiche Thai Airways. */
  [/\bcontenants?\s+IATA\b/g, "contenant de transport"],
  [/\bconformes?\s+(?:à\s+la\s+norme\s+)?IATA\b/g, "conforme aux exigences applicables"],
  [/\bcertifiées\s+IATA\b/g, "conformes aux exigences applicables"],
  [/\bcaisses\s+IATA\b/g, "caisses de transport"],
  [/\bcaisse\s+IATA\b/g, "caisse de transport"],
  [/\bcage\s+IATA\b/g, "cage de transport"],
  [/\bsac\s+IATA\b/g, "sac de transport"],

  /* — ESPAGNOL — « transportín » se suffit à lui-même : rien à lui ajouter. */
  [/\bjaulas?\s+rígidas?\s+conformes?\s+a\s+la\s+IATA\b/g, (m) => m.replace(/\s*conformes?\s+a\s+la\s+IATA/, " de transporte")],
  [/\bjaulas?\s+conformes?\s+a\s+la\s+IATA\b/g, (m) => m.replace(/\s*conformes?\s+a\s+la\s+IATA/, " de transporte")],
  [/\bconformes?\s+a\s+la\s+IATA\b/g, "conforme a los requisitos aplicables"],
  [/\bcertificadas\s+IATA\b/g, "conformes a los requisitos aplicables"],
  [/\btipo\s+IATA\s+rígida\b/g, "rígida de transporte"],
  [/\bjaulas\s+IATA\b/g, "jaulas de transporte"],
  [/\bjaula\s+IATA\b/g, "jaula de transporte"],
  [/\btransportín\s+IATA\b/g, "transportín"],
  [/\btransportines\s+IATA\b/g, "transportines"],

  /* — PORTUGAIS — « caixa de transporte IATA » dit déjà le contenant : il ne reste qu'à retirer
     l'attribution, sans quoi on écrirait « caixa de transporte de transporte ». */
  [/\bcaixas\s+de\s+transporte\s+IATA\b/g, "caixas de transporte"],
  [/\bcaixa\s+de\s+transporte\s+IATA\b/g, "caixa de transporte"],
  [/\bcaixas\s+IATA\b/g, "caixas de transporte"],
  [/\bcaixa\s+IATA\b/g, "caixa de transporte"],
];

/* LES AFFIRMATIONS D'HOMOLOGATION, traitées à part parce qu'elles s'accordent. La forme est
   « homologué·e·s / homologado·a·s », et elle ne qualifie pas toujours le même mot : la règle
   remplace donc l'ADJECTIF par la formulation arbitrée, accordée elle aussi. */
const HOMOLOGATION = [
  /* « homologuée IATA » EST UNE SEULE AFFIRMATION, ET ELLE SE REMPLACE ENTIÈRE. Faute mesurée le
     03/09/2026 : la première table ne remplaçait que l'ADJECTIF, laissant un « IATA » orphelin —
     « caisse de transport rigide conforme aux exigences applicables IATA. », dix-sept fois. C'était
     à la fois bancal et trompeur, puisque la phrase se remettait à parler de l'IATA.
     La bonne cible existait déjà : « exigences IATA » est une référence LICITE, et elle dit
     exactement le vrai — l'IATA publie des exigences, elle n'homologue rien. Ces règles passent
     donc AVANT celles qui traitent l'adjectif seul. */
  [/\bhomologuées\s+IATA\b/g, "conformes aux exigences IATA"],
  [/\bhomologués\s+IATA\b/g, "conformes aux exigences IATA"],
  [/\bhomologuée\s+IATA\b/g, "conforme aux exigences IATA"],
  [/\bhomologué\s+IATA\b/g, "conforme aux exigences IATA"],
  [/\bhomologadas\s+IATA\b/g, "conformes a los requisitos IATA"],
  [/\bhomologados\s+IATA\b/g, "conformes a los requisitos IATA"],
  [/\bhomologada\s+(?:pela\s+)?IATA\b/g, "em conformidade com os requisitos da IATA"],
  [/\bhomologado\s+IATA\b/g, "conforme a los requisitos IATA"],

  [/\bhomologuées\b/g, "conformes aux exigences applicables"],
  [/\bhomologués\b/g, "conformes aux exigences applicables"],
  [/\bhomologuée\b/g, "conforme aux exigences applicables"],
  [/\bhomologué\b/g, "conforme aux exigences applicables"],
  [/\bhomologadas\b/g, "conformes a los requisitos aplicables"],
  [/\bhomologados\b/g, "conformes a los requisitos aplicables"],
  [/\bhomologada\b/g, "conforme a los requisitos aplicables"],
  [/\bhomologado\b/g, "conforme a los requisitos aplicables"],
  [/\baprovadas\s+pela\s+IATA\b/g, "em conformidade com os requisitos aplicáveis"],
  [/\baprovada\s+pela\s+IATA\b/g, "em conformidade com os requisitos aplicáveis"],
  [/\baprobadas\s+por\s+la\s+IATA\b/g, "conformes a los requisitos aplicables"],
  [/\baprobada\s+por\s+la\s+IATA\b/g, "conforme a los requisitos aplicables"],
  [/\bhomologation\b/g, "conformité aux exigences applicables"],
];

const REGLES = [...TABLE, ...HOMOLOGATION];

/* ---- L'EMPHASE MARKDOWN NE COUPE PAS UNE PHRASE --------------------------------------------
 *
 * FAUTE MESURÉE : les guides écrivent « conforme **IATA** (CR82) » et « **IATA**-compliant ».
 * Les étoiles ne se voient pas à l'écran — le lecteur lit bien « conforme IATA » —, mais elles
 * cassent chacune de mes expressions régulières. Deux affirmations survivaient donc à la
 * réécriture ET étaient publiées.
 *
 * ON NE RETIRE PAS L'EMPHASE : elle est du style, et la supprimer changerait la page. On la MET
 * DE CÔTÉ le temps de la substitution, comme les slugs, puis on la restitue — sur le mot qui
 * porte désormais le sens. Ici, l'emphase enveloppait « IATA » ; après réécriture elle enveloppe
 * le terme qui l'a remplacé. */
const EMPHASE = [
  [/\bconforme\s+\*\*IATA\*\*/g, "conforme aux **exigences IATA**"],
  [/\bconformes\s+\*\*IATA\*\*/g, "conformes aux **exigences IATA**"],
  [/\*\*IATA\*\*-compliant\b/g, "compliant with the **applicable requirements**"],
  [/\*\*IATA\*\*-approved\b/g, "compliant with the **applicable requirements**"],
  [/\*\*caisse\s+IATA\*\*/gi, "**caisse de transport**"],
  [/\*\*IATA\s+crate\*\*/gi, "**travel crate**"],
];
REGLES.unshift(...EMPHASE);

const fichiers = execSync("git ls-files " + SURFACES.map((s) => `'${s}'`).join(" "), { encoding: "utf8" })
  .split("\n").filter(Boolean);

/* LES CATÉGORIES QUI FORMENT LE MICRO-LOT ÉDITORIAL, et elles seules. */
const A_REECRIRE = new Set(["source_editoriale", "source_generatrice_active"]);

/* LE JUGEMENT EST CELUI DE L'INSTRUMENT CANONIQUE, ENTIER — `classer()`, pas `jugerOccurrence()`.
 * Faute nommée le 03/09/2026 : la première rédaction n'appelait que le jugement LEXICAL, si bien
 * qu'elle voulait réécrire 22 occurrences que l'instrument exempte déjà — 9 vivant à l'intérieur
 * du slug conservé `caisse-transport-avion-homologuee-chien`, arbitré comme une ADRESSE et non
 * comme une phrase. Un réécriveur qui juge autrement que la mesure est une seconde définition de
 * la même chose : exactement la faute que ce chantier corrige partout ailleurs. */
const interdites = (chemin, t) => {
  const lignes = t.split("\n");
  const out = [];
  let base = 0;
  for (const ligne of lignes) {
    MOTIF.lastIndex = 0;
    for (const m of ligne.matchAll(MOTIF)) {
      const cat = classer(chemin, ligne, m[0], m.index, m.index + m[0].length);
      if (A_REECRIRE.has(cat)) out.push({ 0: m[0], index: base + m.index, categorie: cat });
    }
    base += ligne.length + 1;
  }
  return out;
};

/* ---- LES SLUGS CONSERVÉS SONT INTOUCHABLES -------------------------------------------------
 *
 * FAUTE MESURÉE LE 03/09/2026, ET ELLE CASSAIT DES URL. Le réécriveur DÉTECTAIT par `classer()`,
 * qui exempte correctement les occurrences vivant à l'intérieur d'un slug conservé — mais il
 * REMPLAÇAIT par une expression régulière appliquée au fichier ENTIER. `\bhomologado\b` accroche
 * donc au milieu de `/es/travel-hub/transportin-homologado-iata-perro/`, parce qu'un tiret est
 * une limite de mot. Résultat : `transportin-homologado-iata-perro` et
 * `caixa-de-transporte-homologada-iata` disparaissaient de six fichiers chacun — liens internes
 * rompus, redirections caduques.
 *
 * DÉTECTER AVEC UNE RÈGLE ET AGIR AVEC UNE AUTRE, C'EST N'EN AVOIR AUCUNE. Les slugs sont donc
 * MASQUÉS avant la réécriture et restitués après, à l'octet près. La liste vient de l'instrument
 * canonique : elle n'est pas recopiée ici. */
const masquer = (texte) => {
  const gardes = [];
  let out = texte;
  for (const sl of SLUGS_CONSERVES) {
    if (!out.includes(sl)) continue;
    const jeton = `\u0000SLUG${gardes.length}\u0000`;
    gardes.push(sl);
    out = out.split(sl).join(jeton);
  }
  return { texte: out, gardes };
};
const restituer = (texte, gardes) =>
  gardes.reduce((t, sl, i) => t.split(`\u0000SLUG${i}\u0000`).join(sl), texte);

let avant = 0, apres = 0, touches = 0;
const parRegle = new Map();
const restes = [];

for (const f of fichiers) {
  const orig = readFileSync(f, "utf8");
  const n0 = interdites(f, orig).length;
  if (!n0) continue;
  avant += n0;
  const { texte: masque, gardes } = masquer(orig);
  let texte = masque;
  for (const [re, rep] of REGLES) {
    const avantR = texte;
    const insensible = new RegExp(re.source, re.flags.includes("i") ? re.flags : re.flags + "i");
    texte = texte.replace(insensible, (...args) => {
      const m = args[0];
      const sortie = typeof rep === "function" ? rep(m) : rep;
      /* LA POSITION DÉCIDE. `args` finit par (offset, chaîne entière) ; on lit ce qui précède. */
      const decalage = args[args.length - 2];
      const chaine = args[args.length - 1];
      const avantTexte = chaine.slice(0, decalage);
      /* UN GUILLEMET OUVRANT N'EST PAS UN DÉBUT DE PHRASE À LUI SEUL. Faute mesurée : le titre
         « Qu'est-ce qu'une caisse « Conforme aux exigences IATA » ? » recevait une capitale au
         milieu d'une phrase, parce que le `«` précédait. Une ouverture ne compte que si elle est
         elle-même en tête de ligne ou après une ponctuation de fin. */
      const finDeLigne = /(^|[\n\r])[^\n\r]*$/u.exec(avantTexte)?.[0].replace(/^[\n\r]/, "") ?? "";
      const debutDePhrase = avantTexte.trim() === ""
        || /[\n\r]\s*$/u.test(avantTexte)
        || /[.!?][\s"'»)\]]*$/u.test(avantTexte)
        || /^\s*["'«(\[>|-]+\s*$/u.test(finDeLigne);
      return debutDePhrase ? sortie.charAt(0).toUpperCase() + sortie.slice(1) : sortie;
    });
    if (texte !== avantR) {
      const d = (avantR.match(insensible) ?? []).length;
      parRegle.set(String(re), (parRegle.get(String(re)) ?? 0) + d);
    }
  }
  texte = restituer(texte, gardes);
  const reste = interdites(f, texte);
  apres += reste.length;
  for (const m of reste) {
    const i = m.index;
    restes.push(`${f} · « ${m[0]} » — …${texte.slice(Math.max(0, i - 60), i + m[0].length + 60).replace(/\s+/g, " ")}…`);
  }
  if (texte !== orig) { touches++; if (ECRIRE) writeFileSync(f, texte); }
}

console.log(`${fichiers.length} fichier(s) de source de vérité lus`);
console.log(`${avant} occurrence(s) interdite(s) au départ · ${apres} après réécriture · ${touches} fichier(s) modifié(s)${ECRIRE ? "" : " (RIEN N'A ÉTÉ ÉCRIT)"}`);
console.log("\n— ce que chaque règle a traité —");
for (const [re, n] of [...parRegle].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${re}`);
if (restes.length) {
  console.log(`\n— ${restes.length} OCCURRENCE(S) QU'AUCUNE RÈGLE NE RECONNAÎT —`);
  for (const l of restes.slice(0, 40)) console.log("  " + l);
  process.exit(1);
}
console.log("\naucune affirmation interdite ne subsiste dans les sources de vérité actives.");
