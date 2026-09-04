#!/usr/bin/env node
/**
 * LES CONTRE-ÉPREUVES DE LA RÉÉCRITURE DU VOCABULAIRE IATA.
 *
 *   node test-reecriture-iata.mjs
 *
 * POURQUOI CE HARNAIS EXISTE, ET CE QU'IL ÉPROUVE QUE L'INVENTAIRE NE PEUT PAS ÉPROUVER.
 * L'instrument dit si le motif interdit a disparu. Il ne dit RIEN de la langue ni de la grammaire
 * de ce qui le remplace. Deux dégâts l'ont montré, tous deux publiés :
 *
 *   · 52 fragments ESPAGNOLS insérés dans du contenu PORTUGAIS — « Equipamento conforme a los
 *     requisitos aplicables ». `homologado` s'écrit pareil dans les deux langues, et une table
 *     unique appliquée au fichier entier ne sait pas dans laquelle elle se trouve.
 *   · 15 constructions ANGLAISES cassées — « an compliant with the applicable requirements
 *     crate ». Le remplacement portait sur l'adjectif seul, sans toucher l'article.
 *
 * Un compteur à zéro ne prouve donc pas une réécriture. Ce harnais éprouve la PHRASE PRODUITE :
 * sa langue, sa grammaire, son genre, et la portée exacte des règles.
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { appliquer, plagesYaml, langueDeFichier, verifierYaml, TABLES, ATTRIBUES } from "./reecrire-iata.mjs";
import { dansUnFragmentAttribue, FRAGMENTS_ATTRIBUES, CORRECTIONS_CARGO, MOTIF, jugerOccurrence } from "./inventaire-iata.mjs";
import YAML from "yaml";

let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

/* ---- 1. LE MÊME MOT DANS DEUX LANGUES DONNE DEUX SORTIES, CHACUNE DANS LA SIENNE ----------- */
/* La cause EXACTE de la contamination : `homologada` est espagnol ET portugais.
 *
 * LE TÉMOIN A CHANGÉ LE 03/09/2026, ET C'EST LE CONTRAT QUI A CHANGÉ, PAS LE CONTRÔLE. Il portait
 * « una jaula homologado » / « uma caixa homologado » — le mot NU, sans sujet et au mauvais genre
 * —, parce qu'un repli général réécrivait alors `homologad*` partout. Ce repli est retiré : il
 * écrivait la formulation du contenant aérien sur des harnais automobiles. Le témoin est donc
 * désormais une phrase RÉELLE de chaque langue, au bon genre, avec son sujet. Ce qu'il éprouve
 * n'a pas bougé d'un pouce : le même mot, dans deux langues, doit rendre deux sorties, chacune
 * dans la sienne, et aucun fragment de l'une ne doit apparaître dans l'autre. */
{
  const es = appliquer("una jaula homologada", "es");
  const pt = appliquer("uma caixa homologada", "pt");
  const ecarts = [];
  if (!/jaula de transporte/.test(es)) ecarts.push(`ES ne rend pas de l'espagnol : ${JSON.stringify(es)}`);
  if (!/requisitos aplicáveis/.test(pt)) ecarts.push(`PT ne rend pas du portugais : ${JSON.stringify(pt)}`);
  if (/aplicables|de transporte(?! rígida)/.test(pt) && !/em conformidade/.test(pt)) ecarts.push(`FRAGMENT ESPAGNOL dans la sortie portugaise : ${JSON.stringify(pt)}`);
  if (/aplicáveis|conformidade/.test(es)) ecarts.push(`fragment portugais dans la sortie espagnole : ${JSON.stringify(es)}`);
  if (es === "una jaula homologada") ecarts.push("l'espagnol n'a rien réécrit : le témoin ne prouve rien");
  if (pt === "uma caixa homologada") ecarts.push("le portugais n'a rien réécrit : le témoin ne prouve rien");
  if (ecarts.length) echec("1 même mot, deux langues", ecarts.join(" · "));
  else ok(`1 « homologada » rend « ${es} » en espagnol et « ${pt} » en portugais — deux tables, deux sorties, aucun fragment croisé`);
}

/* ---- 2. UNE RÈGLE D'UNE LANGUE NE TOUCHE JAMAIS UNE AUTRE LANGUE --------------------------- */
/* Les deux sens, sans quoi le contrôle 1 pourrait tenir par hasard. */
{
  const ecarts = [];
  const temoinPt = "uma caixa homologado pela IATA";
  const temoinEs = "una jaula homologado por la IATA";
  /* On donne à `appliquer` des tables où UNE langue est vide : l'autre ne doit rien changer. */
  const sansEs = { ...TABLES, es: [] };
  const sansPt = { ...TABLES, pt: [] };
  if (appliquer(temoinEs, "es", new Map(), sansEs) !== temoinEs) ecarts.push("la table ES vidée modifie quand même l'espagnol");
  if (appliquer(temoinPt, "pt", new Map(), sansEs) === temoinPt) ecarts.push("la table ES vidée casse le portugais : les règles étaient partagées");
  if (appliquer(temoinPt, "pt", new Map(), sansPt) !== temoinPt) ecarts.push("la table PT vidée modifie quand même le portugais");
  if (appliquer(temoinEs, "es", new Map(), sansPt) === temoinEs) ecarts.push("la table PT vidée casse l'espagnol : les règles étaient partagées");
  if (ecarts.length) echec("2 étanchéité des langues", ecarts.join(" · "));
  else ok("2 vider la table d'une langue fait rougir SON témoin et laisse l'autre intact — les deux sens");
}

/* ---- 3. LE GLOSSAIRE : CLÉ ANGLAISE ET VALEUR PORTUGAISE SUR LA MÊME LIGNE ----------------- */
/* Le cas limite du dépôt. Une portée « par ligne » aurait réécrit la source anglaise avec la
   table portugaise, ou l'inverse. */
{
  const cleEn = "Suitable IATA crate if travelling in the hold";
  const valeurPt = "Caixa de transporte adequada à IATA se a viagem for no porão";
  const kEn = appliquer(cleEn, "en");
  const vPt = appliquer(valeurPt, "pt");
  const ecarts = [];
  if (!/travel crate/.test(kEn)) ecarts.push(`la clé anglaise n'est pas traitée en anglais : ${JSON.stringify(kEn)}`);
  if (/de transporte|aplicáveis/.test(kEn)) ecarts.push(`la clé anglaise a reçu du portugais : ${JSON.stringify(kEn)}`);
  if (!/caixa de transporte/i.test(vPt)) ecarts.push(`la valeur portugaise n'est pas traitée en portugais : ${JSON.stringify(vPt)}`);
  if (/travel crate|aplicables/.test(vPt)) ecarts.push(`la valeur portugaise a reçu une autre langue : ${JSON.stringify(vPt)}`);
  if (ecarts.length) echec("3 glossaire clé/valeur", ecarts.join(" · "));
  else ok("3 sur la même ligne du glossaire, la clé reçoit l'anglais et la valeur le portugais");
}

/* ---- 4. LES QUATRE FORMES YAML SONT VUES PAR LE PARSEUR, PAS PAR L'APPARENCE --------------- */
/* Une expression régulière qui reconnaîtrait l'aspect du YAML se tromperait sur au moins l'objet
   en syntaxe « flow », où quatre langues tiennent sur une seule ligne. */
{
  const yml = [
    'simple:',
    '  en: "an IATA crate"',
    'liste:',
    '  - en: "IATA crate"',
    '    fr: "caisse IATA"',
    'flow: { en: "IATA crate", fr: "caisse IATA", es: "jaula IATA", pt: "caixa IATA" }',
    'bloc:',
    '  pt: |',
    '    primeira linha com caixa IATA',
    '    segunda linha',
    '',
  ].join("\n");
  const plages = plagesYaml(yml);
  const parLangue = {};
  for (const p of plages) parLangue[p.langue] = (parLangue[p.langue] ?? 0) + 1;
  const ecarts = [];
  if (plages.length !== 8) ecarts.push(`${plages.length} portée(s) au lieu de 8`);
  for (const [l, n] of [["en", 3], ["fr", 2], ["es", 1], ["pt", 2]]) {
    if (parLangue[l] !== n) ecarts.push(`${l} : ${parLangue[l] ?? 0} portée(s) au lieu de ${n}`);
  }
  /* La portée du bloc « | » doit couvrir SES DEUX lignes, pas seulement l'en-tête. */
  const bloc = plages.find((p) => yml.slice(p.debut, p.fin).includes("segunda"));
  if (!bloc) ecarts.push("le scalaire multiligne n'est pas couvert en entier");
  else if (bloc.langue !== "pt") ecarts.push(`le bloc multiligne est attribué à « ${bloc.langue} »`);
  /* Chaque portée « flow » doit être distincte : quatre langues sur UNE ligne. */
  const surLaLigneFlow = plages.filter((p) => yml.slice(0, p.debut).split("\n").length === 6);
  if (surLaLigneFlow.length !== 4) ecarts.push(`objet flow : ${surLaLigneFlow.length} portée(s) au lieu de 4`);
  if (ecarts.length) echec("4 portées YAML", ecarts.join(" · "));
  else ok("4 les quatre formes YAML sont vues : `en:`, `- en:`, objet flow à quatre langues sur une ligne, bloc multiligne");
}

/* ---- 5. L'ANGLAIS PRODUIT EST GRAMMATICAL ------------------------------------------------- */
/* La faute exacte : le remplacement portait sur l'adjectif seul et laissait l'article. */
{
  /* LES TROIS PREMIERS CAS SONT DÉSORMAIS PLACÉS DANS UNE PHRASE, et c'est une correction du
     témoin, pas du contrat. Depuis que la capitalisation tient compte de la POSITION — un
     acronyme en tête de scalaire est quand même un début de phrase, voir la pastille Thai
     Airways —, « an IATA crate » donné TOUT SEUL commence bel et bien une phrase, et « A travel
     crate » y est juste. Le témoin voulait éprouver l'ARTICLE au milieu d'une phrase : il le dit
     maintenant explicitement, au lieu de s'appuyer sur un décalage nul. Le quatrième cas reste
     nu : il commence vraiment un libellé, et sa capitale initiale est vérifiée pour elle-même. */
  const cas = [
    ["You need an IATA-approved crate", "You need a crate that meets the applicable requirements"],
    ["You need an IATA crate", "You need a travel crate"],
    ["You need an IATA kennel", "You need a kennel"],
    ["Suitable IATA crate if travelling in the hold", "Suitable travel crate if travelling in the hold"],
    /* Et le début de scalaire, éprouvé pour lui-même : la pastille Thai Airways disait
       « IATA container required » et devait devenir « Travel container required », pas
       « travel container required » à côté de « Contenant de transport requis ». */
    ["IATA container required", "Travel container required"],
    ["IATA crate required", "Travel crate required"],
  ];
  const ecarts = [];
  for (const [de, attendu] of cas) {
    const vu = appliquer(de, "en");
    if (vu !== attendu) ecarts.push(`« ${de} » → « ${vu} » au lieu de « ${attendu} »`);
  }
  if (ecarts.length) echec("5 grammaire anglaise", ecarts.join(" · "));
  else ok("5 l'article suit le nom au milieu d'une phrase, et la capitale suit la POSITION en tête de scalaire"
    + ` : « You need an IATA-approved crate » → « ${appliquer("You need an IATA-approved crate", "en")} », `
    + `« IATA container required » → « ${appliquer("IATA container required", "en")} »`);
}

/* ---- 6. LE GENRE ET LA CASSE SUIVENT LE FRANÇAIS ------------------------------------------ */
/* Deux fautes mesurées : « l'attache homologuée » devenue « l' dispositif… », et « Harnais
   homologué » revenu en minuscule au milieu d'un titre. */
{
  const cas = [
    ["l'attache homologuée", /l'attache adaptée/],
    ["**Harnais homologué** : attache", /\*\*Harnais de sécurité/],
    ["Suitable IATA crate", /^Suitable travel crate$/],
  ];
  const ecarts = [];
  for (const [de, attendu] of cas) {
    const vu = appliquer(de, de.startsWith("Suitable") ? "en" : "fr");
    if (!attendu.test(vu)) ecarts.push(`« ${de} » → « ${vu} »`);
  }
  if (ecarts.length) echec("6 genre et casse", ecarts.join(" · "));
  else ok("6 le genre suit le nom conservé, la capitale d'un mot est rendue, celle d'un acronyme ne l'est pas");
}

/* ---- 7. LES TERMINAISONS ACCENTUÉES SONT VUES ---------------------------------------------- */
/* `\b` ne franchit pas un « é » : `homologué\b` ne peut jamais correspondre en JavaScript. Toutes
   les règles FR/ES/PT à terminaison accentuée étaient mortes, et comptées pour zéro en silence. */
{
  /* L'ATTENDU ESPAGNOL A SUIVI LE CONTRAT, pas l'inverse : depuis le retrait du repli général,
     « jaula homologada » rend « jaula de transporte » — la formulation du français de la même
     fiche — et non plus la formulation du contenant aérien. La propriété éprouvée ne change pas :
     la forme à terminaison accentuée doit être VUE. */
  const cas = [["un harnais homologué", "fr", /automobile/], ["una jaula homologada", "es", /jaula de transporte/],
    ["uma caixa homologada", "pt", /aplicáveis/]];
  const ecarts = [];
  for (const [de, l, attendu] of cas) {
    const vu = appliquer(de, l);
    if (!attendu.test(vu)) ecarts.push(`[${l}] « ${de} » → « ${vu} »`);
  }
  if (ecarts.length) echec("7 terminaisons accentuées", ecarts.join(" · "));
  else ok("7 les formes à terminaison accentuée sont vues — `\\b` ne franchit pas un « é »");
}

/* ---- 8. RETIRÉE LE 03/09/2026, ET LA RAISON RESTE ÉCRITE ---------------------------------
 *
 * Ce contrôle relisait le CONTENU de la table `ATTRIBUES` — il vérifiait que les bonnes chaînes
 * y étaient écrites. Il était donc CIRCULAIRE : il n'exécutait jamais la transformation sur les
 * deux fiches, si bien qu'il est resté vert alors que le chemin airBaltic déclaré n'existait même
 * pas et que les exceptions, appliquées après les règles génériques, ne trouvaient plus rien.
 * Une contre-épreuve qui relit une déclaration au lieu d'éprouver un effet ne prouve rien.
 *
 * Ce qu'il prétendait garantir est désormais éprouvé par les contrôles 12 et 13, qui lisent les
 * fiches RÉELLES, appliquent la transformation dans les quatre langues, et exigent que la sortie
 * dise ce que dit la page officielle. */

/* ---- 9. LA LANGUE D'UN FICHIER ENTIER ------------------------------------------------------ */
{
  const cas = [["packages/ui/src/content/guides/pt/x.md", "pt"], ["packages/ui/src/content/guides/en/y.md", "en"],
    ["packages/ui/public/presskit/press-kit-es.html", "es"], ["content/airlines/jal.yml", null]];
  const ecarts = [];
  for (const [c, attendu] of cas) if (langueDeFichier(c) !== attendu) ecarts.push(`${c} → ${langueDeFichier(c)} au lieu de ${attendu}`);
  if (ecarts.length) echec("9 langue d'un fichier", ecarts.join(" · "));
  else ok("9 la langue vient du répertoire pour un guide, du nom pour un press kit, et d'aucun des deux pour un YAML multilingue");
}

/* ---- 10. LES SENTINELLES : CE QUI NE DOIT EXISTER NULLE PART ------------------------------- */
/* Les formes exactes que la v1 a publiées. Elles sont cherchées dans les SOURCES du dépôt : une
   contre-épreuve qui ne regarderait que des témoins fabriqués ne prouverait rien du réel. */
{
  const SENTINELLES = [
    ["an compliant with", "construction anglaise cassée"],
    ['an "compliant', "construction anglaise cassée entre guillemets"],
    ["conforme a los requisitos aplicables", "fragment espagnol", "pt"],
    ["conformes a los requisitos aplicables", "fragment espagnol", "pt"],
    ["exigences applicables IATA", "« IATA » orphelin après réécriture"],
  ];
  const surfaces = execSync("git ls-files content packages/ui/src/content/guides packages/ui/public/presskit", { encoding: "utf8" })
    .split("\n").filter(Boolean);
  const trouves = [];
  for (const f of surfaces) {
    const t = readFileSync(f, "utf8");
    for (const [s, quoi, seulementPt] of SENTINELLES) {
      if (seulementPt && !/\/pt\/|_pt\/|-pt\./.test(f)) continue;
      if (t.includes(s)) trouves.push(`${f} : ${quoi} — « ${s} »`);
    }
  }
  if (trouves.length) { echec("10 sentinelles", `${trouves.length} trouvée(s)`); for (const l of trouves.slice(0, 8)) console.error(`      ${l}`); }
  else ok(`10 aucune des ${SENTINELLES.length} formes sentinelles n'existe dans les sources — ni fragment espagnol en portugais, ni « an compliant with »`);
}

/* ---- 11. LES SLUGS CONSERVÉS SURVIVENT À LA RÉÉCRITURE ------------------------------------- */
/* La v1 les écrasait : `\bhomologado\b` accroche au milieu de
   `transportin-homologado-iata-perro`, et deux slugs disparaissaient de six fichiers chacun. */
{
  const ecarts = [];
  const url = "voir /es/travel-hub/transportin-homologado-iata-perro/ et une jaula homologada";
  const vu = appliquer(url, "es");
  if (!vu.includes("transportin-homologado-iata-perro")) ecarts.push(`le slug a été réécrit : ${JSON.stringify(vu)}`);
  if (!/jaula de transporte/.test(vu)) ecarts.push(`la prose voisine n'a PAS été réécrite : ${JSON.stringify(vu)}`);
  for (const sl of ["caisse-transport-avion-homologuee-chien", "transportin-homologado-iata-perro", "caixa-de-transporte-homologada-iata"]) {
    const n = execSync(`git grep -l -- '${sl}' -- content packages/ui | wc -l`, { encoding: "utf8" }).trim();
    if (n === "0") ecarts.push(`le slug conservé « ${sl} » a disparu du dépôt`);
  }
  if (ecarts.length) echec("11 slugs conservés", ecarts.join(" · "));
  else ok("11 un slug conservé traverse la réécriture intact, et la prose qui l'entoure est réécrite quand même");
}

/* ---- 12. LES DEUX CORRECTIONS CARGO S'EXÉCUTENT VRAIMENT, SUR LES FICHIERS RÉELS ---------- */
/* LA CONTRE-ÉPREUVE 8 ÉTAIT CIRCULAIRE, et c'est la faute la plus instructive de ce lot : elle
   relisait le CONTENU de la table `ATTRIBUES` sans jamais exécuter la transformation. Elle est
   donc restée verte pendant que les données restaient fausses — le chemin airBaltic déclaré
   n'existait même pas (`air_baltic.yml` au lieu de `airbaltic.yml`), et les exceptions passaient
   APRÈS les règles génériques, si bien que leur motif exact ne trouvait plus rien. On exécute
   maintenant la transformation sur les VALEURS RÉELLES des deux fiches, dans les quatre langues. */
{
  const ecarts = [];
  const INTERDIT = [/meeting the applicable requirements agents/i, /conformes aux exigences applicables tierces/i,
    /conformes a los requisitos aplicables externas/i, /certificadas pela IATA/i, /IATA[- ]certified/i];
  /* ON LIT L'ÉTAT D'ORIGINE DANS GIT, PAS LE FICHIER DÉJÀ RÉÉCRIT. Sinon la contre-épreuve
     deviendrait muette dès la première application : appliquer une seconde fois ne change rien,
     et « rien n'a changé » ressemblerait à « l'exception ne s'applique pas ». On confronte donc
     la transformation à la donnée qu'elle est censée corriger. */
  const BASE = "d9f4d53";
  for (const fichier of ["content/airlines/cathay_pacific.yml", "content/airlines/airbaltic.yml"]) {
    if (!existsSync(fichier)) { ecarts.push(`${fichier} : fichier introuvable — le chemin déclaré est faux`); continue; }
    let brut;
    try { brut = execSync(`git show ${BASE}:${fichier}`, { encoding: "utf8" }); }
    catch { ecarts.push(`${fichier} : état d'origine illisible à ${BASE}`); continue; }
    const doc = YAML.parse(brut);
    let vues = 0;
    (function marche(n, langue) {
      if (typeof n === "string") {
        if (!langue) return;
        const sortie = appliquer(n, langue, new Map(), TABLES, fichier);
        if (sortie !== n) vues++;
        for (const mauvais of INTERDIT) {
          if (mauvais.test(sortie)) ecarts.push(`${fichier} [${langue}] : sortie fautive « ${sortie.match(mauvais)[0]} »`);
        }
        return;
      }
      if (Array.isArray(n)) return n.forEach((v) => marche(v, langue));
      if (n && typeof n === "object") for (const [k, v] of Object.entries(n)) marche(v, ["en","fr","es","pt"].includes(k) ? k : langue);
    })(doc, null);
    if (!vues) ecarts.push(`${fichier} : la transformation ne change RIEN — l'exception ne s'applique pas`);
  }
  /* Et la formulation produite doit dire ce que dit la page : les trois catégories de Cathay,
     et pour airBaltic un CERTIFICAT DE FORMATION, jamais une entreprise « certifiée IATA ». */
  const cathay = ATTRIBUES.filter((a) => a.fichier.includes("cathay"));
  const baltic = ATTRIBUES.filter((a) => a.fichier.includes("airbaltic"));
  if (!cathay.length) ecarts.push("aucune exception déclarée pour Cathay");
  if (!baltic.length) ecarts.push("aucune exception déclarée pour airBaltic");
  for (const a of cathay) {
    for (const [nom, attendu] of [["IPATA", /IPATA/], ["ATA", /\bATA\b/], ["Freight Forwarder", /Freight Forwarder/],
      ["certificat LAR", /Live Animals Regulations/], ["Hong Kong", /Hong Kong/]]) {
      if (!attendu.test(a.vers)) ecarts.push(`Cathay [${a.langue}] : « ${nom} » manque`);
    }
  }
  for (const a of baltic) {
    if (!/(training certificate|certificat de formation|certificado de form)/i.test(a.vers))
      ecarts.push(`airBaltic [${a.langue}] : le certificat de FORMATION n'est pas nommé`);
    if (/certifi(ed|és|cadas|cadas)\s+(?:by|par|pela|por)?\s*(?:la\s+)?IATA/i.test(a.vers))
      ecarts.push(`airBaltic [${a.langue}] : confond encore accréditation d'entreprise et formation`);
  }
  for (const a of [...cathay, ...baltic]) if (!a.source) ecarts.push(`${a.fichier} [${a.langue}] : aucune source`);
  if (ecarts.length) { echec("12 corrections cargo exécutées", `${ecarts.length} écart(s)`); for (const l of ecarts.slice(0, 8)) console.error(`      ${l}`); }
  else ok("12 les deux corrections cargo s'exécutent sur les fiches RÉELLES, dans les quatre langues, et disent ce que dit la page officielle");
}

/* ---- 13. LES FRAGMENTS ATTRIBUÉS N'OUVRENT AUCUNE PERMISSION GÉNÉRALE --------------------- */
/* L'IATA accrédite vraiment des entreprises de fret. Mais `IATA-accredited`, `IATA-certified` et
   le mot « agent » restent interdits PARTOUT : seuls des fragments exacts, à des chemins exacts,
   sont licites. On éprouve les quatre sens. */
{
  const f = FRAGMENTS_ATTRIBUES[0];
  const ecarts = [];
  const ligne = `bookings via an ${f.fragment} only`;
  const i = ligne.indexOf("IATA");
  if (!dansUnFragmentAttribue(f.chemins[0], ligne, i, i + "IATA Accredited".length))
    ecarts.push("le fragment EXACT, à son chemin, n'est pas exempté");
  if (dansUnFragmentAttribue("content/airlines/lufthansa.yml", ligne, i, i + "IATA Accredited".length))
    ecarts.push("le même fragment à un AUTRE chemin est exempté — la permission fuit");
  /* L'ALTÉRATION DOIT ÊTRE INTÉRIEURE : ajouter un « s » à la FIN laisse le fragment déclaré
     intact comme préfixe, et l'exemption tient à juste titre. On change donc un mot au milieu. */
  const proche = ligne.replace("Accredited Freight", "Accredited Cargo");
  const j = proche.indexOf("IATA");
  if (dansUnFragmentAttribue(f.chemins[0], proche, j, j + "IATA Accredited".length))
    ecarts.push("un fragment ALTÉRÉ en son milieu est exempté");
  const ailleurs = "third-party IATA-accredited agents";
  const k = ailleurs.indexOf("IATA");
  if (dansUnFragmentAttribue(f.chemins[0], ailleurs, k, k + "IATA-accredited".length))
    ecarts.push("les mêmes mots hors du fragment déclaré sont exemptés");
  for (const x of FRAGMENTS_ATTRIBUES) if (!x.source) ecarts.push(`${x.chemins[0]} : fragment sans source`);
  if (ecarts.length) echec("13 fragments attribués", ecarts.join(" · "));
  else ok(`13 les ${FRAGMENTS_ATTRIBUES.length} fragments attribués sont licites à leur chemin exact et à leur texte exact — ailleurs, altérés, ou hors de leur portée, ils restent interdits`);
}

/* ---- 14. LES FORMES ES/PT DE CONFORMITÉ AFFIRMÉE SONT VUES ET RÉÉCRITES ------------------- */
/* FAUX ZÉRO LEXICAL, mesuré le 03/09/2026 : 37 occurrences dans 24 fichiers actifs échappaient au
   motif — « caixa de transporte em conformidade com a IATA », « transportín conforme a IATA »,
   « contêiner compatível com a IATA ». Le registre pouvait donc annoncer zéro sans l'être. */
{
  const ecarts = [];
  const juge = (t) => { MOTIF.lastIndex = 0; return [...t.matchAll(MOTIF)].map((m) => [m[0], jugerOccurrence(m[0])]); };
  for (const [t, attendu] of [["caixa em conformidade com a IATA", "interdite"], ["transportín conforme a IATA", "interdite"],
    ["contêiner compatível com a IATA", "interdite"], ["jaula compatible con la IATA", "interdite"],
    ["em conformidade com os requisitos da IATA", "legitime"], ["conforme aos requisitos da IATA", "legitime"],
    ["requisitos da IATA", "legitime"]]) {
    const v = juge(t);
    if (!v.length) ecarts.push(`le motif ne voit rien dans « ${t} »`);
    else if (v[0][1] !== attendu) ecarts.push(`« ${t} » jugé « ${v[0][1]} » au lieu de « ${attendu} »`);
  }
  for (const [t, l, attendu] of [["caixa de transporte em conformidade com a IATA", "pt", /requisitos aplicáveis/],
    ["transportín conforme a IATA", "es", /requisitos aplicables/],
    ["contêiner compatível com a IATA", "pt", /requisitos aplicáveis/]]) {
    const vu = appliquer(t, l);
    if (!attendu.test(vu)) ecarts.push(`[${l}] « ${t} » → « ${vu} »`);
    if (/com a IATA|conforme a IATA/i.test(vu)) ecarts.push(`[${l}] la forme interdite subsiste : « ${vu} »`);
  }
  if (ecarts.length) echec("14 conformité affirmée ES/PT", ecarts.join(" · "));
  else ok("14 « em conformidade com a IATA », « conforme a IATA » et « compatível com a IATA » sont vues et réécrites ; nommer les EXIGENCES publiées reste licite");
}

/* ---- 15. LA VÉRIFICATION COMPARE LES VALEURS, PAS SEULEMENT LA FORME DE L'ARBRE ----------- */
/* FAUX RAPPORT DE MA PART, RELEVÉ LE 03/09/2026. J'ai annoncé « reparse et comparaison
   profonde » : `verifierYaml()` ne confrontait en réalité que le NOMBRE de plages de langue et la
   LISTE DES CHEMINS. Une substitution pouvait donc altérer la valeur décodée d'un scalaire — une
   séquence d'échappement abîmée, un guillemet avalé — en laissant la forme de l'arbre
   RIGOUREUSEMENT identique, et rien ne l'aurait vu.

   ON ÉPROUVE LES DEUX SENS. Une réécriture CORRECTE doit passer ; une réécriture qui préserve la
   forme mais change la valeur décodée doit être REFUSÉE, en nommant le chemin et la valeur. */
{
  const avant = 'a:\n  en: "an IATA crate \\u00e9t\u00e9"\n  fr: "une caisse IATA"\n';
  const ecarts = [];

  /* 1. la réécriture légitime, telle que le script la produit : elle doit passer. */
  const plages = plagesYaml(avant);
  let correct = avant;
  for (const p of [...plages].sort((x, y) => y.debut - x.debut)) {
    const frag = avant.slice(p.debut, p.fin);
    const neuf = appliquer(frag, p.langue, new Map());
    if (neuf !== frag) correct = correct.slice(0, p.debut) + neuf + correct.slice(p.fin);
  }
  const verdictCorrect = verifierYaml(avant, correct, "temoin.yml");
  if (verdictCorrect) ecarts.push(`une réécriture correcte est refusée : ${verdictCorrect}`);

  /* 2. LA MÊME FORME, UNE AUTRE VALEUR. On abîme l'échappement « \u00e9 » en « \u00e8 » : le YAML
     reste valide, l'arbre garde exactement les mêmes chemins, seule la chaîne décodée change. */
  const sabote = correct.replace("\\u00e9", "\\u00e8");
  if (sabote === correct) ecarts.push("le témoin ne porte pas l'échappement attendu — la mutation ne prouverait rien");
  else {
    const verdict = verifierYaml(avant, sabote, "temoin.yml");
    if (!verdict) ecarts.push("une valeur décodée altérée à forme constante est ACCEPTÉE");
    else if (!/valeur décodée/.test(verdict)) ecarts.push(`refusée, mais sans nommer la valeur : ${verdict}`);
  }

  /* 3. Et une valeur SUPPRIMÉE, qui garde elle aussi la forme de l'arbre. */
  const vide = correct.replace(/en: "[^"]*"/, 'en: ""');
  const verdictVide = verifierYaml(avant, vide, "temoin.yml");
  if (!verdictVide) ecarts.push("un scalaire vidé de son contenu est ACCEPTÉ");

  if (ecarts.length) echec("15 vérification par valeurs", ecarts.join(" · "));
  else ok("15 la vérification compare les valeurs DÉCODÉES : une réécriture correcte passe, un échappement abîmé et un scalaire vidé sont refusés en nommant le chemin");
}

/* ---- 16. LES TROIS DÉGÂTS NOMMÉS PAR LA CONTRE-REVUE DU 03/09/2026 ------------------------ */
/* CE QUE CES SENTINELLES GARDENT, ET POURQUOI ELLES SONT ÉCRITES AINSI. Le réécriveur avait fait
 * TOMBER le compteur à zéro en écrivant des phrases fausses : le motif interdit avait bien
 * disparu, mais ce qui le remplaçait ne disait plus la vérité de son sujet. Un compteur ne relit
 * pas ; ces trois épreuves relisent.
 *
 * Elles partent du TEXTE ANTÉRIEUR, tiré du dépôt à `d9f4d53`, et exigent la sortie EXACTE. Un
 * contrôle qui se contenterait de chercher la chaîne fautive dans l'arbre courant passerait au
 * vert le jour où quelqu'un corrigerait la phrase à la main sans corriger la RÈGLE : la faute
 * reviendrait au passage suivant. On éprouve donc la règle, sur son entrée réelle. */
{
  const BASE = "d9f4d53";
  const ecarts = [];
  /* [entrée réelle, langue, fichier, sortie exacte attendue, ce que la faute avait écrit] */
  const CAS = [
    /* 1 — LE HARNAIS AUTOMOBILE N'EST PAS UNE CAISSE. Le repli général `homologad*` avait écrit la
       formulation du CONTENANT AÉRIEN sur dix-neuf passages de retenue automobile : « arnés
       conforme a los requisitos aplicables » affirme une conformité qu'aucun texte ne publie pour
       un harnais canin. Éprouvé dans les DEUX langues qui portaient le repli. */
    ["Utiliza siempre un arnés homologado que reparta la fuerza sobre el pecho.", "es",
     "packages/ui/src/content/guides/es/equipamiento-de-coche-para-perro.md",
     "Utiliza siempre un arnés de seguridad de coche para perro que reparta la fuerza sobre el pecho.",
     /arn[ée]s\s+conforme\s+a\s+los\s+requisitos/i],
    ["Use sempre um peitoral homologado que distribua a força pelo peito.", "pt",
     "packages/ui/src/content/guides/pt/equipamento-de-carro-para-cachorro.md",
     "Use sempre um peitoral de segurança de carro para cachorro que distribua a força pelo peito.",
     /peitoral\s+em\s+conformidade\s+com\s+os\s+requisitos/i],
    /* 2 — UNE MARQUE N'EST PAS UN MODÈLE. La fiche Air Austral déclarait quatre marques
       « conformes aux exigences applicables » : ce qui se vérifie d'un MODÈLE ne se déclare pas
       d'une MARQUE, et la compagnie publie seulement qu'elle les accepte. */
    ["Marcas homologadas citadas: Sky Kennel, Vari Kennel, Gulliver, Gateway", "es",
     "content/airlines/air_austral.yml",
     "Marcas aprobadas citadas: Sky Kennel, Vari Kennel, Gulliver, Gateway",
     /Marcas\s+conformes\s+a\s+los\s+requisitos/i],
    /* 3 — CE QUI REMPLACE UN ADJECTIF DOIT RESTER UN ADJECTIF. Une proposition insérée devant un
       participe avait produit « sous réserve de ses dimensions et conditions glissé sous le
       siège » — une phrase que personne ne peut lire à voix haute. */
    ["Les petits chiens voyagent souvent en cabine dans un sac souple homologué glissé sous le siège.", "fr",
     "packages/ui/src/content/guides/fr/caisse-transport-avion-homologuee-chien.md",
     "Les petits chiens voyagent souvent en cabine dans un sac souple aux dimensions admises glissé sous le siège.",
     /conditions\s+glissé/i],
    /* ET LA PHRASE QUI NIE L'HOMOLOGATION, qui explique le régime réel du CR82 : le repli général
       l'avait rendue absurde. Elle doit garder sa négation entière. */
    ["Ce n'est pas une homologation au sens d'un label payant : c'est un ensemble d'exigences.", "fr",
     "packages/ui/src/content/guides/fr/caisse-transport-avion-homologuee-chien.md",
     "Ce n'est pas une certification au sens d'un label payant : c'est un ensemble d'exigences.",
     /pas\s+une\s+conformité\s+aux\s+exigences\s+applicables\s+au\s+sens/i],
  ];
  for (const [entree, langue, fichier, attendu, fautif] of CAS) {
    const sortie = appliquer(entree, langue, new Map(), TABLES, fichier);
    if (sortie !== attendu) ecarts.push(`[${langue}] « ${sortie} » au lieu de « ${attendu} »`);
    if (fautif.test(sortie)) ecarts.push(`[${langue}] la sortie porte encore le dégât nommé : ${sortie.match(fautif)[0]}`);
  }
  /* ET LES REPLIS GÉNÉRAUX SONT BIEN PARTIS, éprouvé sur la TABLE et non sur un souvenir : un
     motif qui remplace `homologado` tout nu, sans regarder le sujet, ne doit plus exister. */
  /* UN REPLI GÉNÉRAL, C'EST LE MOT SEUL — rien avant, rien après que la limite de mot. Les règles
     qui NOMMENT l'IATA (« homologada pela IATA ») ne sont pas des replis : elles visent
     exactement l'affirmation interdite. Une première rédaction de cette sentinelle les comptait
     comme telles et rougissait à tort ; le motif est donc l'ÉGALITÉ au motif nu, pas un préfixe. */
  const nu = (mot) => `(?<![\\wÀ-ÿ])${mot}(?![\\wÀ-ÿ])`;
  for (const langue of ["es", "pt"]) {
    const nus = TABLES[langue].filter(([m]) => ["homologado", "homologada", "homologados", "homologadas"].some((x) => m.source === nu(x)));
    if (nus.length) ecarts.push(`[${langue}] ${nus.length} repli(s) général(aux) « homologad* » subsiste(nt) : ${nus[0][0].source}`);
  }
  if (TABLES.fr.some(([m]) => m.source === nu("homologation")))
    ecarts.push("[fr] le repli général « homologation » subsiste");
  /* ET LA SENTINELLE N'EST PAS DÉCORATIVE : on vérifie qu'elle SAURAIT voir un repli. */
  if (![[new RegExp(nu("homologado"), "gi"), "x"]].some(([m]) => m.source === nu("homologado")))
    ecarts.push("la sentinelle des replis ne reconnaît pas un repli fabriqué : elle ne garde rien");
  if (ecarts.length) { echec("16 dégâts nommés", `${ecarts.length} écart(s)`); for (const e of ecarts.slice(0, 6)) console.error(`      ${e}`); }
  else ok(`16 les ${CAS.length} dégâts nommés par la contre-revue sont éprouvés sur leur texte antérieur : chaque sortie est exacte, et les replis généraux qui les avaient causés n'existent plus`);
}

/* ---- 17. LES CORRECTIONS CARGO SONT SCELLÉES DANS L'ÉTAT COURANT -------------------------- */
/* La contre-épreuve 12 éprouve la RÈGLE, sur le texte antérieur. Celle-ci éprouve le RÉSULTAT :
 * les huit valeurs vivantes des deux fiches, comparées au scellé, une par une. Une modification
 * manuelle, une traduction reperdue, un mot retiré : le scellé le nomme. */
{
  const ecarts = [];
  for (const c of CORRECTIONS_CARGO) {
    let doc;
    try { doc = YAML.parse(readFileSync(c.fichier, "utf8")); }
    catch (e) { ecarts.push(`${c.fichier} : illisible — ${e.message}`); continue; }
    let trouve = false;
    (function marche(n) {
      if (trouve) return;
      if (Array.isArray(n)) return n.forEach(marche);
      if (!n || typeof n !== "object") return;
      if (typeof n[c.langue] === "string" && n[c.langue].trim() === c.valeur) { trouve = true; return; }
      for (const k of Object.keys(n)) marche(n[k]);
    })(doc);
    if (!trouve) ecarts.push(`${c.fichier} [${c.langue}] : la valeur scellée n'est plus dans la fiche`);
    /* ET LES FORMULATIONS D'AVANT LA CORRECTION SONT INTERDITES, nommément : sans cela, le scellé
       dirait seulement « quelque chose a changé », pas « la faute est revenue ». */
    for (const mauvais of [/agents?\s+accr[ée]dit[ée]s?\s+IATA/i, /agentes\s+credenciados\s+pela\s+IPATA\s*\/\s*IATA/i,
                           /IATA[- ]certified\s+cargo\s+agents?/i, /agences\s+de\s+fret\s+certifi[ée]es\s+IATA/i,
                           /agencias\s+de\s+carga\s+certificadas\s+IATA/i, /ag[êe]ncias\s+de\s+carga\s+certificadas\s+pela\s+IATA/i]) {
      if (mauvais.test(readFileSync(c.fichier, "utf8"))) ecarts.push(`${c.fichier} : la formulation d'avant la correction est revenue — ${mauvais}`);
    }
  }
  const langues = new Set(CORRECTIONS_CARGO.map((c) => `${c.fichier}|${c.langue}`));
  if (langues.size !== 8) ecarts.push(`le scellé porte ${langues.size} couples fiche/langue au lieu de 8`);
  if (CORRECTIONS_CARGO.some((c) => !c.source || !c.page)) ecarts.push("une correction scellée sans source ou sans page publiée");
  if (ecarts.length) { echec("17 corrections cargo scellées", `${ecarts.length} écart(s)`); for (const e of ecarts.slice(0, 6)) console.error(`      ${e}`); }
  else ok(`17 les ${CORRECTIONS_CARGO.length} valeurs cargo corrigées sont scellées dans l'état courant, chacune à son texte exact, et aucune formulation d'avant la correction n'est revenue`);
}

console.log(defauts
  ? `\n[réécriture] ÉCHEC — ${defauts} contre-épreuve(s) en défaut`
  : "\n[réécriture] chaque langue a sa table, l'anglais reste grammatical, le genre et la casse suivent, et aucune sentinelle ne subsiste.");
process.exit(defauts ? 1 : 0);
