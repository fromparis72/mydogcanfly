#!/usr/bin/env node
/**
 * LA RÉÉCRITURE DU VOCABULAIRE IATA, PAR PORTÉES DE LANGUE.
 *
 *   node reecrire-iata.mjs            n'écrit rien : compte, et NOMME ce qu'il ne sait pas traiter
 *   node reecrire-iata.mjs --ecrire   applique
 *
 * POURQUOI CETTE VERSION EXISTE, ET CE QUE LA PRÉCÉDENTE A CASSÉ. La v1 portait UNE table, rendue
 * insensible à la casse, appliquée au fichier ENTIER. Deux dégâts mesurés sur 1799325 :
 *
 *   · 52 FRAGMENTS ESPAGNOLS DANS DU PORTUGAIS. `homologado` et `homologada` s'écrivent pareil
 *     dans les deux langues ; les règles espagnoles accrochaient donc les valeurs portugaises.
 *     « Equipamento conforme a los requisitos aplicables », publié tel quel.
 *   · 15 CONSTRUCTIONS ANGLAISES CASSÉES. Le remplacement portait sur l'ADJECTIF seul, sans
 *     toucher l'article : « an compliant with the applicable requirements crate ».
 *
 * ET CE QUE CELA DIT DE LA MESURE. L'instrument démontrait que le motif interdit avait disparu.
 * Il ne dit rien de la LANGUE ni de la GRAMMAIRE de ce qui le remplace. Une réécriture ne se
 * valide pas au compteur : elle se valide sur la phrase produite.
 *
 * LE MÉCANISME, EN TROIS TEMPS.
 *   1. TRANSFORMER STRUCTURELLEMENT. La langue d'un texte vient de la STRUCTURE, jamais de son
 *      apparence : `yaml.visit()` donne la plage source exacte de chaque scalaire et la clé qui
 *      le porte — `en:`, `- en:`, `{ en: … }`, un bloc `|` ou `>`, une chaîne citée contenant des
 *      deux-points. Les glossaires `_pt/*.json` sont le cas limite : la CLÉ est anglaise et la
 *      VALEUR portugaise, sur la même ligne ; ce sont deux portées, deux tables.
 *   2. APPLIQUER TEXTUELLEMENT, de droite à gauche, pour préserver le format à l'octet près.
 *   3. VÉRIFIER PAR REPARSE. Le fichier réécrit est reparsé et comparé à la structure voulue.
 *      C'est la VÉRIFICATION qui garantit, pas la façon d'appliquer : une clé perdue, un scalaire
 *      abîmé, un JSON invalide font échouer le script au lieu d'être écrits.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import YAML from "yaml";
import { classer, MOTIF, SLUGS_CONSERVES } from "./inventaire-iata.mjs";

const ECRIRE = process.argv.includes("--ecrire");
const LANGUES = ["en", "fr", "es", "pt"];

/* ---- LES TABLES, UNE PAR LANGUE -------------------------------------------------------------
 *
 * AUCUNE RÈGLE N'EST PARTAGÉE ENTRE DEUX LANGUES, même quand le motif s'écrit pareil. C'est la
 * cause exacte de la contamination : `homologado` existe en espagnol ET en portugais.
 *
 * L'ORDRE COMPTE : le plus spécifique d'abord, et l'ARTICLE fait partie du motif quand il change.
 *
 * CE QUE CHAQUE FORMULATION AFFIRME — arbitrage du 03/09/2026. Le motif qui disparaît ne suffit
 * pas : la phrase produite doit être vraie de son SUJET.
 *   · Énoncé GÉNÉRAL sur ce qu'exige le transport aérien → « conforme aux exigences applicables ».
 *   · Produit ou modèle PRÉCIS, sans preuve propre → on décrit le contenant, on ne le certifie pas.
 *   · Harnais automobile → aucun régime d'homologation publique n'existe pour les harnais canins :
 *     l'article R412-6 impose au conducteur de conserver ses manœuvres, le règlement ONU n° 16
 *     vise les occupants humains, et le règlement UE 2023/988 est une obligation générale de
 *     sécurité des produits. Formulation neutre, jamais « homologué ».
 */
/* ---- LES LIMITES DE MOT, ET POURQUOI ELLES NE SONT PAS `\b` ---------------------------------
 *
 * DÉFAUT MESURÉ LE 03/09/2026 : en JavaScript, `\w` vaut `[A-Za-z0-9_]` et n'inclut PAS les
 * lettres accentuées. `homologué\b` ne peut donc JAMAIS correspondre : après le `é`, qui n'est
 * pas un caractère de mot, il n'y a aucune limite à franchir. Toutes les règles françaises,
 * espagnoles et portugaises à terminaison accentuée étaient mortes, et le réécriveur les comptait
 * pour zéro sans rien signaler. C'est le même piège que `\w*` sur les terminaisons accentuées,
 * déjà nommé dans l'instrument.
 *
 * On borne donc sur `[\wÀ-ÿ]`, qui couvre les alphabets des quatre langues. */
const D = "(?<![\\wÀ-ÿ])";      // limite gauche
const F = "(?![\\wÀ-ÿ])";       // limite droite
const re = (source, drapeaux = "gi") => new RegExp(D + source + F, drapeaux);

const EN = [
  /* L'ARTICLE FAIT PARTIE DU MOTIF : « an IATA-approved crate » ne devient jamais
     « an compliant with… crate », mais une phrase qu'on peut lire à voix haute. */
  [re("an\\s+IATA[- ](?:approved|compliant|certified|accredited)\\s+(travel\\s+|rigid\\s+|hard\\s+)?(crate|kennel|carrier|cage|container|box)", "gi"),
    (_m, adj, nom) => `a ${adj ?? ""}${nom} that meets the applicable requirements`],
  [re("IATA[- ](?:approved|compliant|certified|accredited)\\s+(travel\\s+|rigid\\s+|hard\\s+)?(crates|kennels|carriers|cages|containers|boxes)", "gi"),
    (_m, adj, nom) => `${adj ?? ""}${nom} that meet the applicable requirements`],
  [re("IATA[- ](?:approved|compliant|certified|accredited)\\s+(travel\\s+|rigid\\s+|hard\\s+)?(crate|kennel|carrier|cage|container|box)", "gi"),
    (_m, adj, nom) => `${adj ?? ""}${nom} that meets the applicable requirements`],
  /* Adjectif détaché — « Rigid double-shell crate, IATA-compliant (CR82) ». */
  [re("IATA[- ](?:approved|compliant|certified|accredited)", "gi"), "meeting the applicable requirements"],
  /* Le contenant garde son nom ; seule l'attribution part. L'article suit. */
  [re("an\\s+IATA\\s+crate", "gi"), "a travel crate"],
  [re("an\\s+IATA\\s+kennel", "gi"), "a kennel"],
  [re("an\\s+IATA\\s+(carrier|cage)", "gi"), (_m, n) => `a travel ${n}`],
  [re("IATA\\s+crates", "gi"), "travel crates"],
  [re("IATA\\s+crate", "gi"), "travel crate"],
  [re("IATA\\s+kennels", "gi"), "kennels"],
  [re("IATA\\s+kennel", "gi"), "kennel"],
  [re("IATA\\s+carriers", "gi"), "travel carriers"],
  [re("IATA\\s+carrier", "gi"), "travel carrier"],
  [re("IATA\\s+cages", "gi"), "travel cages"],
  [re("IATA\\s+cage", "gi"), "travel cage"],
  [re("rigid\\s+IATA\\s+type", "gi"), "rigid travel"],
];

const FR = [
  /* « caisse homologuée IATA » est UNE affirmation : on la remplace entière, jamais l'adjectif
     seul — sans quoi il reste un « IATA » orphelin qui remet la phrase à parler de l'IATA. */
  [re("caisses\\s+homologuées\\s+IATA", "gi"), "caisses conformes aux exigences applicables"],
  [re("caisse\\s+homologuée\\s+IATA", "gi"), "caisse conforme aux exigences applicables"],
  [re("homologuées\\s+IATA", "gi"), "conformes aux exigences applicables"],
  [re("homologués\\s+IATA", "gi"), "conformes aux exigences applicables"],
  [re("homologuée\\s+IATA", "gi"), "conforme aux exigences applicables"],
  [re("homologué\\s+IATA", "gi"), "conforme aux exigences applicables"],
  [re("conformes?\\s+(?:à\\s+la\\s+norme\\s+)?IATA", "gi"), "conforme aux exigences applicables"],
  [re("certifiées\\s+IATA", "gi"), "conformes aux exigences applicables"],
  [re("certifiée\\s+IATA", "gi"), "conforme aux exigences applicables"],
  [re("type\\s+IATA\\s+rigide", "gi"), "de transport rigide"],
  [re("caisses\\s+IATA", "gi"), "caisses de transport"],
  [re("caisse\\s+IATA", "gi"), "caisse de transport"],
  [re("cages\\s+IATA", "gi"), "cages de transport"],
  [re("cage\\s+IATA", "gi"), "cage de transport"],
  [re("sacs\\s+IATA", "gi"), "sacs de transport"],
  [re("sac\\s+IATA", "gi"), "sac de transport"],
  [re("contenants\\s+IATA", "gi"), "contenants de transport"],
  [re("contenant\\s+IATA", "gi"), "contenant de transport"],
  /* LE CONTENANT AÉRIEN EST DÉCRIT, JAMAIS CERTIFIÉ. Un modèle précis n'a pas de preuve propre :
     « conforme aux exigences applicables » est la formulation arbitrée pour ce cas. */
  [re("caisses\\s+rigides\\s+homologuées"), "caisses rigides conformes aux exigences applicables"],
  [re("caisse\\s+rigide\\s+homologuée"), "caisse rigide conforme aux exigences applicables"],
  [re("caisses\\s+de\\s+transport\\s+homologuées"), "caisses de transport conformes aux exigences applicables"],
  [re("caisse\\s+de\\s+transport\\s+homologuée"), "caisse de transport conforme aux exigences applicables"],
  [re("caisses\\s+homologuées"), "caisses conformes aux exigences applicables"],
  [re("caisse\\s+homologuée"), "caisse conforme aux exigences applicables"],
  /* LES PRODUITS ANTIPARASITAIRES SONT RÉELLEMENT AUTORISÉS — mais « homologué » n'est pas le
     terme d'un médicament vétérinaire, qui reçoit une autorisation de mise sur le marché. On
     écrit « autorisés » : c'est vrai, et cela n'emprunte rien à l'IATA. */
  [re("produits\\s+homologués"), "produits autorisés"],
  /* HARNAIS ET RETENUE AUTOMOBILE — aucune homologation publique n'existe. Voir l'arbitrage. */
  [re("ceintures\\s+bas\\s+de\\s+gamme\\s+non\\s+homologuées"), "ceintures bas de gamme sans essai de choc publié"],
  /* LE GENRE SUIT LE NOM CONSERVÉ : « l'attache homologuée » ne peut pas devenir « l' dispositif ».
     On garde le nom féminin et on change seulement ce qui affirme une homologation. */
  [re("attaches?\\s+homologuées?"), "attache adaptée au chien et au véhicule"],
  [re("grilles?\\s+homologuées?"), "grille de séparation adaptée au véhicule"],
  [re("harnais\\s+de\\s+sécurité\\s+(?:voiture|automobile)\\s+homologué", "gi"), "harnais de sécurité automobile pour chien"],
  [re("harnais\\s+(?:voiture|automobile)\\s+homologué", "gi"), "harnais de sécurité automobile pour chien"],
  [re("harnais\\s+de\\s+sécurité\\s+homologué", "gi"), "harnais de sécurité automobile pour chien"],
  [re("harnais\\s+homologués", "gi"), "harnais de sécurité automobile pour chien"],
  [re("harnais\\s+homologué", "gi"), "harnais de sécurité automobile pour chien"],
  [re("harnais\\s+non\\s+homologué", "gi"), "harnais inadapté"],
  [re("système\\s+d'attache\\s+homologué", "gi"), "dispositif de retenue adapté au chien et au véhicule"],
  [re("systèmes?\\s+homologués?", "gi"), "dispositif de retenue adapté au chien et au véhicule"],
  [re("(?:matériel|équipement)\\s+(?:durable\\s+et\\s+)?homologué", "gi"), "matériel adapté au mode de transport"],
  /* Les dernières formes, chacune vue dans le dépôt et nommée par la passe à blanc. */
  [re("cages?\\s+homologuées?"), "cage de transport"],
  [re("modèles\\s+homologués"), "modèles conformes aux exigences applicables"],
  [re("modèle\\s+homologué"), "modèle conforme aux exigences applicables"],
  /* L'EMPHASE MARKDOWN NE COUPE PAS UNE PHRASE : « Le matériel **homologué** » se lit d'un trait
     à l'écran, mais les étoiles cassent l'expression régulière. L'emphase est reportée sur le
     terme qui porte désormais le sens, jamais supprimée — c'est du style. */
  [re("(?:matériel|équipement)\\s+\\*\\*homologué\\*\\*"), "**matériel adapté au mode de transport**"],
  /* Groupe C — le sac souple de cabine : on préserve le CONTENANT et on attribue la décision. */
  [re("sacs?\\s+homologués?"), "sac accepté par la compagnie, sous réserve de ses dimensions et conditions"],
  [re("sac\\s+souple\\s+homologué", "gi"), "sac souple accepté par la compagnie, sous réserve de ses dimensions et conditions"],
  [re("caisse\\/sac\\s+homologué", "gi"), "caisse ou sac accepté par la compagnie"],
  [re("homologation", "gi"), "conformité aux exigences applicables"],
];

const ES = [
  [re("jaulas?\\s+rígidas?\\s+conformes?\\s+a\\s+la\\s+IATA", "gi"), (m) => m.replace(/\s*conformes?\s+a\s+la\s+IATA/i, " de transporte")],
  [re("jaulas?\\s+conformes?\\s+a\\s+la\\s+IATA", "gi"), (m) => m.replace(/\s*conformes?\s+a\s+la\s+IATA/i, " de transporte")],
  [re("homologadas\\s+(?:por\\s+la\\s+)?IATA", "gi"), "conformes a los requisitos aplicables"],
  [re("homologados\\s+(?:por\\s+la\\s+)?IATA", "gi"), "conformes a los requisitos aplicables"],
  [re("homologada\\s+(?:por\\s+la\\s+)?IATA", "gi"), "conforme a los requisitos aplicables"],
  [re("homologado\\s+(?:por\\s+la\\s+)?IATA", "gi"), "conforme a los requisitos aplicables"],
  [re("aprobadas\\s+por\\s+la\\s+IATA", "gi"), "conformes a los requisitos aplicables"],
  [re("aprobada\\s+por\\s+la\\s+IATA", "gi"), "conforme a los requisitos aplicables"],
  [re("conformes?\\s+a\\s+la\\s+IATA", "gi"), "conforme a los requisitos aplicables"],
  [re("certificadas\\s+IATA", "gi"), "conformes a los requisitos aplicables"],
  [re("tipo\\s+IATA\\s+rígida", "gi"), "rígida de transporte"],
  [re("jaulas\\s+IATA", "gi"), "jaulas de transporte"],
  [re("jaula\\s+IATA", "gi"), "jaula de transporte"],
  [re("transportines\\s+IATA", "gi"), "transportines"],
  [re("transportín\\s+IATA", "gi"), "transportín"],
  [re("homologadas", "gi"), "conformes a los requisitos aplicables"],
  [re("homologados", "gi"), "conformes a los requisitos aplicables"],
  [re("homologada", "gi"), "conforme a los requisitos aplicables"],
  [re("homologado", "gi"), "conforme a los requisitos aplicables"],
];

const PT = [
  [re("caixas\\s+de\\s+transporte\\s+(?:aprovadas\\s+pela\\s+|homologadas\\s+pela\\s+|adequadas\\s+à\\s+)?IATA", "gi"), "caixas de transporte"],
  [re("caixa\\s+de\\s+transporte\\s+(?:aprovada\\s+pela\\s+|homologada\\s+pela\\s+|adequada\\s+à\\s+)?IATA", "gi"), "caixa de transporte"],
  [re("caixas\\s+IATA", "gi"), "caixas de transporte"],
  [re("caixa\\s+IATA", "gi"), "caixa de transporte"],
  [re("bolsas\\s+IATA", "gi"), "bolsas de transporte"],
  [re("bolsa\\s+IATA", "gi"), "bolsa de transporte"],
  [re("aprovadas\\s+pela\\s+IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("aprovada\\s+pela\\s+IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("homologadas\\s+(?:pela\\s+)?IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("homologados\\s+(?:pela\\s+)?IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("homologada\\s+(?:pela\\s+)?IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("homologado\\s+(?:pela\\s+)?IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("adequadas\\s+à\\s+IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("adequada\\s+à\\s+IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("conformes?\\s+(?:à\\s+|com\\s+a\\s+)?IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("tipo\\s+IATA\\s+rígida", "gi"), "rígida de transporte"],
  [re("tipo\\s+IATA\\s+rígido", "gi"), "rígido de transporte"],
  [re("homologadas", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("homologados", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("homologada", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("homologado", "gi"), "em conformidade com os requisitos aplicáveis"],
];

export const TABLES = { en: EN, fr: FR, es: ES, pt: PT };

/* ---- LES FRAGMENTS ATTRIBUÉS, PAR CHEMIN EXACT ----------------------------------------------
 *
 * L'IATA ACCRÉDITE RÉELLEMENT DES ENTREPRISES DE FRET — « IATA Cargo Agency Accreditation »,
 * « IATA Accredited Freight Forwarder ». Ce n'est NI l'homologation d'une caisse, NI une
 * certification générique d'un agent quelconque. Aucune permission lexicale générale n'est donc
 * ouverte sur `IATA-accredited`, `IATA-certified` ou le mot « agent » : ces deux phrases sont
 * réécrites À LEUR CHEMIN EXACT, d'après la page officielle de la compagnie, et rien d'autre dans
 * le dépôt n'en bénéficie.
 *
 *   · Cathay Pacific — la page officielle nomme TROIS catégories (membre IPATA ou ATA, IATA
 *     Accredited Freight Forwarder, titulaire d'un certificat de formation IATA LAR valide). La
 *     formulation actuelle en omet deux et transforme « freight forwarder » en « agent ».
 *   · airBaltic — la page ne dit pas que les agents sont « IATA-certified » : elle recommande des
 *     agents TITULAIRES d'un certificat de formation IATA LAR. L'un qualifie une entreprise,
 *     l'autre la formation d'une personne.
 */
export const ATTRIBUES = [
  { fichier: "content/airlines/cathay_pacific.yml",
    de: re("IPATA\\s*\\/\\s*IATA[- ]accredited\\s+agents", "gi"),
    vers: "IPATA or ATA members, IATA Accredited Freight Forwarders, or holders of a valid IATA Live Animals Regulations training certificate",
    source: "https://www.cathaypacific.com/cx/en_IN/prepare-trip/help-for-passengers/travelling-with-animals/overview-cargo.html" },
  { fichier: "content/airlines/air_baltic.yml",
    de: re("IATA[- ]certified\\s+cargo\\s+agents", "gi"),
    vers: "cargo agents holding a valid IATA Live Animals Regulations training certificate",
    source: "https://www.airbaltic.com/en/cargo/shipping-animals-cargo" },
];

/* ---- LA LANGUE D'UN FICHIER ENTIER ---------------------------------------------------------- */
export function langueDeFichier(chemin) {
  const g = /\/content\/guides\/(en|fr|es|pt)\//.exec(chemin);
  if (g) return g[1];
  const p = /press-kit-(en|fr|es|pt)\.html$/.exec(chemin);
  if (p) return p[1];
  return null;
}

/* ---- LES PORTÉES D'UN YAML, PAR LE PARSEUR ET NON PAR L'APPARENCE ---------------------------
   `yaml.visit()` rend la plage source de chaque scalaire ET la clé qui le porte. Cela couvre sans
   règle supplémentaire les quatre formes du dépôt : `en:`, `- en:`, `{ en: …, fr: … }` sur une
   seule ligne, et les blocs `|` / `>`. Une expression régulière qui reconnaîtrait l'APPARENCE du
   YAML se tromperait sur au moins la troisième. */
export function plagesYaml(texte) {
  const doc = YAML.parseDocument(texte);
  const plages = [];
  YAML.visit(doc, {
    Pair(_i, pair) {
      if (!LANGUES.includes(pair.key?.value)) return;
      const v = pair.value;
      if (!v || typeof v.value !== "string" || !v.range) return;
      plages.push({ langue: pair.key.value, debut: v.range[0], fin: v.range[1] });
    },
  });
  return plages;
}

/* ---- LES SLUGS CONSERVÉS SONT INTOUCHABLES --------------------------------------------------
   Détecter avec une règle et agir avec une autre, c'est n'en avoir aucune : la v1 exemptait les
   slugs à la DÉTECTION mais les écrasait au REMPLACEMENT — `\bhomologado\b` accroche au milieu de
   `transportin-homologado-iata-perro`, et deux slugs disparaissaient de six fichiers chacun. */
const masquer = (t) => {
  const gardes = [];
  let out = t;
  for (const sl of SLUGS_CONSERVES) {
    if (!out.includes(sl)) continue;
    out = out.split(sl).join(` S${gardes.length} `);
    gardes.push(sl);
  }
  return { texte: out, gardes };
};
const restituer = (t, g) => g.reduce((x, sl, i) => x.split(` S${i} `).join(sl), t);

/** Applique la table d'UNE langue à UN fragment, et rien d'autre. */
export function appliquer(fragment, langue, compteur = new Map(), tables = TABLES) {
  const { texte: masque, gardes } = masquer(fragment);
  let out = masque;
  for (const [motif, rep] of tables[langue]) {
    const avant = out;
    /* LA CAPITALE DU MOT REMPLACÉ EST RENDUE — mais jamais celle d'un ACRONYME. « Harnais
       homologué » doit rester « Harnais… » ; « IATA crate » ne doit PAS donner « Travel crate »,
       parce qu'« IATA » porte toujours une majuscule sans être un début de phrase. Les deux
       fautes ont été mesurées, chacune dans son sens. */
    out = out.replace(motif, (...args) => {
      const m = args[0];
      const sortie = typeof rep === "function" ? rep(...args) : rep;
      const premier = /^[\wÀ-ÿ]+/.exec(m)?.[0] ?? "";
      const acronyme = premier.length > 1 && premier === premier.toUpperCase();
      return !acronyme && /^\p{Lu}/u.test(m) ? sortie.charAt(0).toUpperCase() + sortie.slice(1) : sortie;
    });
    if (out !== avant) {
      const n = (avant.match(motif) ?? []).length;
      compteur.set(`${langue}  ${motif}`, (compteur.get(`${langue}  ${motif}`) ?? 0) + n);
    }
  }
  return restituer(out, gardes);
}

/* ---- LE JUGEMENT EST CELUI DE L'INSTRUMENT CANONIQUE, ENTIER -------------------------------- */
const A_REECRIRE = new Set(["source_editoriale", "source_generatrice_active"]);
function interdites(chemin, texte) {
  const out = [];
  let base = 0;
  for (const ligne of texte.split("\n")) {
    MOTIF.lastIndex = 0;
    for (const m of ligne.matchAll(MOTIF)) {
      if (A_REECRIRE.has(classer(chemin, ligne, m[0], m.index, m.index + m[0].length))) {
        out.push({ texte: m[0], index: base + m.index });
      }
    }
    base += ligne.length + 1;
  }
  return out;
}

/* ---- LA VÉRIFICATION PAR REPARSE ------------------------------------------------------------ */
const formeDe = (o, p = "") => {
  if (Array.isArray(o)) return o.flatMap((v, i) => formeDe(v, `${p}[${i}]`));
  if (o && typeof o === "object") return Object.entries(o).flatMap(([k, v]) => formeDe(v, `${p}.${k}`));
  return [p];
};

function verifierYaml(avant, apres) {
  let da, db;
  try { da = YAML.parse(avant); } catch (e) { return `YAML illisible AVANT : ${e.message}`; }
  try { db = YAML.parse(apres); } catch (e) { return `YAML invalide APRÈS réécriture : ${e.message}`; }
  const a = plagesYaml(avant).length, b = plagesYaml(apres).length;
  if (a !== b) return `scalaires de langue : ${a} → ${b}`;
  const fa = formeDe(da).join("|"), fb = formeDe(db).join("|");
  return fa === fb ? null : "la forme de l'arbre a changé";
}

/* ---- LE PROGRAMME -----------------------------------------------------------------------
   Le corps principal est protégé : les contre-épreuves importent `appliquer`, `plagesYaml` et
   `langueDeFichier` sans que le dépôt entier soit parcouru. */
if (import.meta.url === `file://${process.argv[1]}`) {
  /* ---- LES FICHIERS ---------------------------------------------------------------------------- */
  const SURFACES = ["content/airlines/", "content/countries/",
    "packages/ui/src/content/guides/", "packages/ui/public/presskit/"];
  const fichiers = execSync("git ls-files " + SURFACES.map((s) => `'${s}'`).join(" "), { encoding: "utf8" })
    .split("\n").filter(Boolean);

  let avant = 0, apres = 0, touches = 0;
  const compteur = new Map();
  const restes = [], defauts = [], sansPortee = [];

  for (const f of fichiers) {
    const orig = readFileSync(f, "utf8");
    const n0 = interdites(f, orig).length;
    if (!n0) continue;
    avant += n0;
    let texte = orig;

    const langueEntiere = langueDeFichier(f);

    if (langueEntiere) {
      /* Guides et press kits : le fichier ENTIER est d'une seule langue. Aucun mélange possible. */
      texte = appliquer(orig, langueEntiere, compteur);

    } else if (f.endsWith(".json")) {
      /* GLOSSAIRES `_pt` : la CLÉ est anglaise, la VALEUR portugaise — deux portées, deux tables.
         On transforme l'OBJET, puis on remplace chaque littéral par le sien dans le texte d'origine,
         ce qui préserve le format ; la garantie vient du REPARSE, pas de la substitution. */
      let obj;
      try { obj = JSON.parse(orig); } catch (e) { defauts.push(`${f} : JSON illisible — ${e.message}`); continue; }
      const collision = [];
      const muter = (n) => {
        if (typeof n === "string") return n;
        if (Array.isArray(n)) return n.map(muter);
        if (n && typeof n === "object") {
          const out = {};
          for (const [k, v] of Object.entries(n)) {
            const nk = appliquer(k, "en", compteur);
            if (nk in out) collision.push(nk);
            out[nk] = typeof v === "string" ? appliquer(v, "pt", compteur) : muter(v);
          }
          return out;
        }
        return n;
      };
      const nouveau = muter(obj);
      if (collision.length) { defauts.push(`${f} : collision de clés après réécriture — ${collision[0]}`); continue; }
      if (formeDe(obj).length !== formeDe(nouveau).length) { defauts.push(`${f} : cardinalité changée`); continue; }
      const paires = [];
      (function collecter(a, b) {
        if (typeof a === "string") { if (a !== b) paires.push([a, b]); return; }
        if (Array.isArray(a)) return a.forEach((x, i) => collecter(x, b[i]));
        if (a && typeof a === "object") {
          const ea = Object.entries(a), eb = Object.entries(b);
          ea.forEach(([k, v], i) => { if (k !== eb[i][0]) paires.push([k, eb[i][0]]); collecter(v, eb[i][1]); });
        }
      })(obj, nouveau);
      for (const [de, vers] of paires) texte = texte.split(JSON.stringify(de)).join(JSON.stringify(vers));
      let relu;
      try { relu = JSON.parse(texte); } catch (e) { defauts.push(`${f} : JSON invalide APRÈS — ${e.message}`); continue; }
      if (JSON.stringify(relu) !== JSON.stringify(nouveau)) { defauts.push(`${f} : le reparse ne rend pas la structure voulue`); continue; }

    } else if (f.endsWith(".yml") || f.endsWith(".yaml")) {
      const plages = plagesYaml(orig);
      /* DE DROITE À GAUCHE : les décalages des plages restantes restent valides. */
      for (const p of [...plages].sort((a, b) => b.debut - a.debut)) {
        const frag = orig.slice(p.debut, p.fin);
        const neuf = appliquer(frag, p.langue, compteur);
        if (neuf !== frag) texte = texte.slice(0, p.debut) + neuf + texte.slice(p.fin);
      }
      const ecart = verifierYaml(orig, texte);
      if (ecart) { defauts.push(`${f} : ${ecart}`); continue; }
      /* Ce qui reste interdit HORS d'une plage de langue est NOMMÉ, jamais réécrit à l'aveugle. */
      const couvert = (i) => plages.some((p) => i >= p.debut && i < p.fin);
      for (const o of interdites(f, texte)) if (!couvert(o.index)) sansPortee.push(`${f} · « ${o.texte} »`);

    } else {
      defauts.push(`${f} : aucune portée de langue connue pour ce format`);
      continue;
    }

    for (const a of ATTRIBUES) if (a.fichier === f) texte = texte.replace(a.de, a.vers);

    const reste = interdites(f, texte);
    apres += reste.length;
    for (const m of reste) {
      restes.push(`${f} · « ${m.texte} » — …${texte.slice(Math.max(0, m.index - 55), m.index + m.texte.length + 55).replace(/\s+/g, " ")}…`);
    }
    if (texte !== orig) { touches++; if (ECRIRE) writeFileSync(f, texte); }
  }

  console.log(`${fichiers.length} fichier(s) lus`);
  console.log(`${avant} occurrence(s) interdite(s) au départ · ${apres} après · ${touches} fichier(s) modifié(s)${ECRIRE ? "" : "  (RIEN N'A ÉTÉ ÉCRIT)"}`);
  console.log("\n— ce que chaque règle a traité, par langue —");
  for (const [k, n] of [...compteur].sort((a, b) => b[1] - a[1]).slice(0, 28)) console.log(`  ${String(n).padStart(4)}  ${k}`);
  if (sansPortee.length) {
    console.log(`\n— ${sansPortee.length} occurrence(s) HORS de toute portée de langue —`);
    for (const l of sansPortee.slice(0, 15)) console.log("  " + l);
  }
  if (defauts.length) {
    console.log(`\n— ${defauts.length} FICHIER(S) EN DÉFAUT —`);
    for (const l of defauts.slice(0, 15)) console.log("  " + l);
  }
  if (restes.length) {
    console.log(`\n— ${restes.length} OCCURRENCE(S) QU'AUCUNE RÈGLE NE RECONNAÎT —`);
    for (const l of restes) console.log("  " + l);
  }
  process.exit(restes.length || defauts.length || sansPortee.length ? 1 : 0);
}
