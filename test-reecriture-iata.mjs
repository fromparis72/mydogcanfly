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
import { appliquer, plagesYaml, langueDeFichier, TABLES, ATTRIBUES } from "./reecrire-iata.mjs";

let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

/* ---- 1. LE MÊME MOT DANS DEUX LANGUES DONNE DEUX SORTIES, CHACUNE DANS LA SIENNE ----------- */
/* La cause EXACTE de la contamination : `homologado` est espagnol ET portugais. */
{
  const es = appliquer("una jaula homologado", "es");
  const pt = appliquer("uma caixa homologado", "pt");
  const ecarts = [];
  if (!/requisitos aplicables/.test(es)) ecarts.push(`ES ne rend pas de l'espagnol : ${JSON.stringify(es)}`);
  if (!/requisitos aplicáveis/.test(pt)) ecarts.push(`PT ne rend pas du portugais : ${JSON.stringify(pt)}`);
  if (/aplicables/.test(pt)) ecarts.push(`FRAGMENT ESPAGNOL dans la sortie portugaise : ${JSON.stringify(pt)}`);
  if (/aplicáveis/.test(es)) ecarts.push(`fragment portugais dans la sortie espagnole : ${JSON.stringify(es)}`);
  if (ecarts.length) echec("1 même mot, deux langues", ecarts.join(" · "));
  else ok(`1 « homologado » rend « ${es.split(" ").slice(-2).join(" ")} » en espagnol et « ${pt.split(" ").slice(-2).join(" ")} » en portugais`);
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
  const cas = [
    ["an IATA-approved crate", "a crate that meets the applicable requirements"],
    ["an IATA crate", "a travel crate"],
    ["an IATA kennel", "a kennel"],
    ["Suitable IATA crate if travelling in the hold", "Suitable travel crate if travelling in the hold"],
  ];
  const ecarts = [];
  for (const [de, attendu] of cas) {
    const vu = appliquer(de, "en");
    if (vu !== attendu) ecarts.push(`« ${de} » → « ${vu} » au lieu de « ${attendu} »`);
  }
  if (ecarts.length) echec("5 grammaire anglaise", ecarts.join(" · "));
  else ok(`5 l'article suit le nom : « an IATA-approved crate » devient « ${appliquer("an IATA-approved crate", "en")} »`);
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
  const cas = [["un harnais homologué", "fr", /automobile/], ["una jaula homologada", "es", /aplicables/],
    ["uma caixa homologada", "pt", /aplicáveis/]];
  const ecarts = [];
  for (const [de, l, attendu] of cas) {
    const vu = appliquer(de, l);
    if (!attendu.test(vu)) ecarts.push(`[${l}] « ${de} » → « ${vu} »`);
  }
  if (ecarts.length) echec("7 terminaisons accentuées", ecarts.join(" · "));
  else ok("7 les formes à terminaison accentuée sont vues — `\\b` ne franchit pas un « é »");
}

/* ---- 8. LES DEUX FRAGMENTS ATTRIBUÉS DISENT CE QUE DIT LEUR SOURCE ------------------------- */
/* L'IATA accrédite réellement des ENTREPRISES de fret. Ce n'est ni l'homologation d'une caisse,
   ni la formation d'une personne — et la nuance est exactement ce qui manquait. */
{
  const ecarts = [];
  const cathay = ATTRIBUES.find((a) => a.fichier.includes("cathay"));
  const baltic = ATTRIBUES.find((a) => a.fichier.includes("baltic"));
  if (!cathay || !baltic) ecarts.push("un des deux fragments attribués a disparu de la table");
  else {
    for (const [nom, attendu] of [["IPATA", /IPATA/], ["ATA", /\bATA\b/],
      ["Accredited Freight Forwarder", /Accredited Freight Forwarder/],
      ["certificat LAR", /Live Animals Regulations training certificate/]]) {
      if (!attendu.test(cathay.vers)) ecarts.push(`Cathay : la catégorie « ${nom} » manque`);
    }
    if (/accredited agents?/i.test(baltic.vers)) ecarts.push("airBaltic confond encore accréditation d'entreprise et certificat de formation");
    if (!/training certificate/.test(baltic.vers)) ecarts.push("airBaltic ne nomme pas le certificat de formation");
    for (const a of [cathay, baltic]) if (!/^https:\/\//.test(a.source ?? "")) ecarts.push(`${a.fichier} : aucune source citée`);
  }
  if (ecarts.length) echec("8 fragments attribués", ecarts.join(" · "));
  else ok("8 Cathay nomme les trois catégories officielles, airBaltic distingue le certificat de formation de l'accréditation d'entreprise, chacun avec sa source");
}

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
  if (!/jaula conforme a los requisitos aplicables/.test(vu)) ecarts.push(`la prose voisine n'a PAS été réécrite : ${JSON.stringify(vu)}`);
  for (const sl of ["caisse-transport-avion-homologuee-chien", "transportin-homologado-iata-perro", "caixa-de-transporte-homologada-iata"]) {
    const n = execSync(`git grep -l -- '${sl}' -- content packages/ui | wc -l`, { encoding: "utf8" }).trim();
    if (n === "0") ecarts.push(`le slug conservé « ${sl} » a disparu du dépôt`);
  }
  if (ecarts.length) echec("11 slugs conservés", ecarts.join(" · "));
  else ok("11 un slug conservé traverse la réécriture intact, et la prose qui l'entoure est réécrite quand même");
}

console.log(defauts
  ? `\n[réécriture] ÉCHEC — ${defauts} contre-épreuve(s) en défaut`
  : "\n[réécriture] chaque langue a sa table, l'anglais reste grammatical, le genre et la casse suivent, et aucune sentinelle ne subsiste.");
process.exit(defauts ? 1 : 0);
