#!/usr/bin/env node
/* Seconde passe : les puces d'arrivée dont la condition d'origine n'est pas le partage UE/hors-UE.
 *
 * La première passe (tag-arrival-origin.mjs) a traité les 57 puces bâties sur le seul motif
 * régulier du corpus. Restent celles où le pays d'arrivée applique SA PROPRE grille — le Mexique
 * distingue l'Amérique du Nord du reste du monde, la Nouvelle-Zélande isole l'Australie, Hong Kong
 * classe la planète en quatre groupes, les États-Unis en deux niveaux de risque rabique. Aucune ne
 * se déduit d'une règle générale : chacune est une liste, publiée par l'autorité du pays d'arrivée.
 *
 * D'OÙ DEUX CLÉS DE PLUS, et pas une de plus que nécessaire :
 *
 *   from: [us, ca]         la puce ne vaut qu'au départ de ces pays
 *   from_except: [us, ca]  la puce vaut partout SAUF au départ de ces pays
 *
 * `from_except` n'est pas un luxe : ces règles vont presque toujours par paire — un cas nommé et
 * son complément (« depuis les États-Unis ou le Canada » / « depuis tout autre pays »). Écrire le
 * complément en extension obligerait à lister 190 pays et à les tenir à jour ; l'écrire en creux
 * garantit au contraire que les deux puces resteront cohérentes le jour où la liste bougera.
 *
 * LES LISTES SONT RELEVÉES SUR LA SOURCE OFFICIELLE, jamais reconstituées de mémoire, et leur
 * date de relevé est inscrite ici. Elles sont posées par ancre YAML (`&nom` puis `*nom`) : la
 * liste n'est écrite qu'une fois et sa négation la référence, si bien qu'une mise à jour ne peut
 * pas laisser les deux puces en désaccord.
 *
 * CE QUE CE SCRIPT NE TAGUE PAS, ET POURQUOI. Deux puces repérées par le balayage ressemblent à
 * une condition mais n'en sont pas une : « If you have not coordinated in advance… » (Bahreïn) et
 * « If you plan to leave Tanzania later with your dog… » portent sur ce que fait le voyageur, pas
 * sur l'endroit d'où il vient. Elles valent pour tout le monde et restent affichées pour tout le
 * monde.
 *
 * UNE LIMITE À DIRE. Le moteur connaît le pays de DÉPART ; le CDC, lui, raisonne sur les pays où
 * le chien a séjourné dans les six derniers mois. Un chien parti de Paris mais qui était au Maroc
 * il y a trois mois relève du régime « haut risque » alors que notre filtre ne le verra pas.
 * C'est précisément pourquoi les puces écartées sont REPLIÉES et non supprimées : elles restent
 * dans la page, sous « Autres cas de figure et précisions », à un clic.
 *
 * Rejouable : une puce déjà taguée est laissée intacte.
 *
 *   node packages/knowledge/scripts/tag-arrival-origin-listes.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", "content", "countries");
const dry = process.argv.includes("--dry");

/* CDC — High-Risk Countries for Dog Rabies, relevé le 03/08/2026 sur la page officielle
 * (dernière mise à jour annoncée par le CDC : 15/04/2026) :
 * https://www.cdc.gov/importation/dogs/high-risk-countries.html
 *
 * Ceuta et Melilla figurent sur la liste du CDC et n'ont pas de code ISO propre : elles sont
 * espagnoles, et l'Espagne dans son ensemble n'est PAS classée à haut risque. Les omettre est
 * donc juste — les inscrire sous `es` classerait à tort tout départ d'Espagne. */
const CDC_HAUT_RISQUE = [
  "af", "dz", "ao", "am", "az", "bd", "by", "bz", "bj", "bo", "bw", "br", "bn", "bf", "bi",
  "kh", "cm", "cf", "td", "cn", "co", "km", "ci", "cu", "cd", "dj", "do", "ec", "eg", "sv",
  "gq", "er", "sz", "et", "ga", "gm", "ge", "gh", "gt", "gn", "gw", "gy", "ht", "hn", "in",
  "id", "ir", "iq", "il", "jo", "kz", "ke", "kw", "kg", "la", "lb", "ls", "lr", "ly", "mg",
  "mw", "my", "ml", "mr", "md", "mn", "ma", "mz", "mm", "na", "np", "ne", "ng", "kp", "om",
  "pk", "pe", "ph", "qa", "cg", "ru", "rw", "st", "sn", "sl", "so", "za", "ss", "lk", "sd",
  "sr", "sy", "tj", "tz", "th", "tl", "tg", "tn", "tr", "tm", "ug", "ua", "ae", "uz", "ve",
  "vn", "ye", "zm", "zw",
];

/* AFCD — Import of Dogs and Cats, groupes I et II réunis, relevé le 03/08/2026 sur la page
 * officielle (date de la page : 02/02/2026) :
 * https://www.afcd.gov.hk/english/quarantine/qua_ie/qua_ie_ipab/qua_ie_ipab_idc/qua_ie_ipab_idc.html
 *
 * Groupe I : Australie, Fidji, Hawaï, Irlande, Japon, Nouvelle-Zélande, Royaume-Uni, Jersey.
 * Groupe II : la liste ci-dessous complète — dont « USA (Continental) », Hawaï et Guam, tous
 * trois couverts par `us`, et « Virgin Islands », que l'AFCD ne désambiguïse pas : les deux
 * codes sont retenus, l'oubli d'un archipel coûtant plus cher qu'un code inutile.
 *
 * À NOTER, ET C'EST TOUT L'INTÉRÊT DE LA VRAIE LISTE : la Hongrie et la Lituanie, membres de
 * l'UE, sont en groupe IIIA — donc en quarantaine. Une règle « UE / hors-UE » déduite au jugé
 * aurait affirmé le contraire à Hong Kong. */
const HK_GROUPES_I_II = [
  "au", "fj", "ie", "jp", "nz", "gb", "je",
  "at", "bh", "bm", "ca", "cy", "cz", "fi", "de", "gu", "it", "lu", "mt", "no", "pg", "sc",
  "sb", "es", "ch", "tw", "vu", "bs", "be", "bn", "ky", "dk", "fr", "gi", "is", "jm", "mv",
  "mu", "nc", "pt", "kr", "sg", "se", "nl", "us", "vg", "vi",
];

/* Chaque consigne : le fichier, le début de la puce anglaise (qui l'identifie sans ambiguïté),
 * la clé à poser, sa valeur, et l'ancre YAML éventuelle. `ancre` DÉCLARE la liste, `alias` la
 * réutilise — l'ordre des consignes est donc celui du fichier, déclaration avant réutilisation. */
const CONSIGNES = [
  // Bosnie-Herzégovine : complément de la puce « From an EU/EFTA country » déjà taguée `eu`.
  { f: "ba", debut: "From another listed or a non-listed country", cle: "from", valeur: "non_eu" },

  // Mexique : le cas relevé par Philippe — le texte « depuis les États-Unis ou le Canada »
  // s'affichait pour un départ de Paris.
  { f: "mx", debut: "From the US or Canada", cle: "from", liste: ["us", "ca"], ancre: "amerique_du_nord" },
  { f: "mx", debut: "From any other country", cle: "from_except", alias: "amerique_du_nord" },

  /* Norvège. « Most non-EEA countries » : l'EEE, ce sont les 27 plus la Norvège, l'Islande et le
   * Liechtenstein — et la Suisse s'y ajoute en pratique par accord bilatéral. C'est exactement
   * l'ensemble que le gabarit appelle `eu` (l'Islande y étant rattachée à la main). Le mot-clé
   * `non_eu` dit donc ici la bonne chose, et il la dira encore si un pays entre dans l'EEE. */
  { f: "no", debut: "From most non-EEA countries", cle: "from", valeur: "non_eu" },
  /* Puce que le premier balayage avait manquée : elle ne commence pas par « From », mais
   * « Dogs coming directly from Sweden » est bien une condition d'origine, et la plus étroite
   * du corpus — un seul pays. */
  { f: "no", debut: "Dogs coming directly from Sweden", cle: "from", liste: ["se"] },

  // Nouvelle-Zélande : l'Australie seule échappe à la quarantaine.
  { f: "nz", debut: "From Australia (Category 1)", cle: "from", liste: ["au"], ancre: "australie" },
  { f: "nz", debut: "From all other approved countries", cle: "from_except", alias: "australie" },

  // Hong Kong : groupes I et II (sans quarantaine) contre IIIA et IIIB (avec).
  { f: "hk", debut: "From Group I or II", cle: "from", liste: HK_GROUPES_I_II, ancre: "hk_sans_quarantaine" },
  { f: "hk", debut: "From Group IIIA or IIIB", cle: "from_except", alias: "hk_sans_quarantaine" },

  // États-Unis : classement CDC du risque de rage canine.
  { f: "us", debut: "From a rabies-free or low-risk country", cle: "from_except", liste: CDC_HAUT_RISQUE, ancre: "cdc_haut_risque" },
  { f: "us", debut: "A foreign-vaccinated dog from a high-risk country", cle: "from", alias: "cdc_haut_risque" },
];

let poses = 0, deja = 0;
const parFichier = new Map();
for (const c of CONSIGNES) {
  if (!parFichier.has(c.f)) parFichier.set(c.f, []);
  parFichier.get(c.f).push(c);
}

for (const [f, consignes] of parFichier) {
  const chemin = join(SRC, `${f}.yml`);
  let texte = readFileSync(chemin, "utf-8");
  const points = YAML.parse(texte)?.arrival?.points ?? [];
  let modifie = false;

  for (const c of consignes) {
    const p = points.find((x) => (x.en ?? "").startsWith(c.debut));
    if (!p) {
      console.error(`✗ ${f}.yml — aucune puce ne commence par « ${c.debut} », rien n'est écrit.`);
      process.exitCode = 1;
      continue;
    }
    if (p.from || p.from_except) { deja++; continue; }

    const ligne = texte.split("\n").find((l) => /^\s*- en: /.test(l) && l.includes(c.debut));
    if (!ligne) {
      console.error(`✗ ${f}.yml — puce introuvable dans le texte source : ${c.debut}`);
      process.exitCode = 1;
      continue;
    }
    const indent = ligne.match(/^(\s*)- /)[1];
    const valeur = c.alias ? `*${c.alias}`
      : c.liste ? `${c.ancre ? `&${c.ancre} ` : ""}[${c.liste.join(", ")}]`
      : c.valeur;
    const remplacement = `${indent}- ${c.cle}: ${valeur}\n${indent}  ` + ligne.trim().replace(/^- /, "");
    texte = texte.replace(ligne, remplacement);
    modifie = true;
    poses++;
  }

  if (modifie && !dry) writeFileSync(chemin, texte);
  if (modifie) console.log(`${f}.yml — ${consignes.length} consigne(s) appliquée(s)`);
}

console.log(`\n${poses} puce(s) taguée(s)${deja ? `, ${deja} déjà taguée(s)` : ""}${dry ? " — essai à blanc" : ""}`);
