#!/usr/bin/env node
/**
 * L'INVENTAIRE DU VOCABULAIRE IATA — UN SEUL RELEVÉ, QUI FAIT FOI. Version 3.
 *
 *   node inventaire-iata.mjs              le tableau de synthèse
 *   node inventaire-iata.mjs --json       le relevé complet, une ligne par occurrence
 *   node inventaire-iata.mjs --cat=<c>    les occurrences d'une seule catégorie
 *
 * POURQUOI CE FICHIER EXISTE. J'ai annoncé « 270 occurrences dans 41 fichiers », puis « environ
 * 340 dans 71 ». Les deux relevés étaient bricolés à la main, avec des motifs et des périmètres
 * différents, et aucun n'était rejouable. Un chiffre qu'on ne peut pas rejouer n'est pas une
 * mesure. Cet instrument sert de CONTRAT à deux lots : il dit combien d'affirmations sont à
 * corriger, et qui les corrige.
 *
 * SON HISTOIRE, PARCE QU'ELLE EXPLIQUE SA FORME. Trois versions, chacune corrigeant une faute
 * que la précédente ne voyait pas.
 *
 *   V1 — classait par LIGNE, avec un repli complaisant, et déclarait l'héritage inerte sans rien
 *        vérifier.
 *
 *   V2 — a fermé trois de ces défauts.
 *        · La décision porte désormais sur L'OCCURRENCE et sa position ; la ligne n'est plus que
 *          du contexte, et la colonne est enregistrée. Sur « IATA LAR ; IATA-approved crate »,
 *          la v1 donnait « interdit » aux DEUX occurrences — la référence licite disparaissait
 *          du compte. Même défaut sur les citations : un `"quote":` n'importe où sur la ligne
 *          absorbait une occurrence extérieure à la citation.
 *        · Le repli final `return "reference_reglementaire_legitime"` est supprimé : il bénissait
 *          toute forme inconnue, si bien que le contrôle « aucune occurrence non classée » ne
 *          pouvait pas rougir. Une occurrence que nulle règle ne reconnaît rend `null` et FAIT
 *          ÉCHOUER le relevé, en nommant fichier, ligne, colonne et texte.
 *        · `readdirSync()` n'est pas trié par contrat : l'énumération et le relevé final le sont,
 *          et une contre-épreuve rejoue tout avec un ordre d'énumération inversé.
 *        Mais la v2 a cru pouvoir PROUVER l'inertie de l'héritage v1, en cherchant le chemin
 *        littéral `"static/…"` dans les scripts du dépôt. Cette preuve n'en était pas une : un
 *        générateur écrivant `join(ROOT, "static", f)` y échappait, et ajouter des motifs n'aurait
 *        fait que déplacer le trou. Aucune analyse textuelle ne démontre qu'aucun code ne
 *        construit un chemin dynamiquement.
 *
 *   V3 — RETIRE cette prétention plutôt que de la rafistoler. `heritage_v1_non_publie` devient
 *        `heritage_a_corriger_ou_supprimer` : ces 18 occurrences ne sont plus protégées par une
 *        preuve impossible, elles entrent au micro-lot éditorial, et leur suppression éventuelle
 *        sera une décision séparée et explicite. Ce qui cite ces répertoires reste rapporté, mais
 *        comme un CONSTAT indicatif qui ne conclut rien.
 *        La v3 ajoute aussi `reference_reglementaire_a_reformuler`, sans quoi deux modifications
 *        approuvées manquaient au contrat : « IATA standard » et « norme IATA » sont licites
 *        prises seules, « norma IATA » ne l'est pas, et les trois appartiennent au MÊME titre,
 *        remplacé en entier. L'ancre est un fragment de TEXTE, jamais un numéro de ligne — une
 *        ligne se déplace, un texte non — et une ancre qui ne trouve rien fait refuser le relevé.
 *
 * L'ORDRE DES CATÉGORIES EST LE CONTRAT — le changer change les agrégats, et doit donc être un
 * mouvement nommé. Il se lit en deux temps :
 *
 *   1. `slug_conserve` — l'occurrence EST un identifiant d'URL conservé par arbitrage. Rien à
 *      corriger : ce n'est pas une phrase, c'est une adresse.
 *   2. `citation_attribuee` — l'occurrence est À L'INTÉRIEUR d'une citation qui reproduit une
 *      source identifiée. On ne réécrit pas une source : on la garde ou on la retire.
 *   3. `reference_reglementaire_a_reformuler` — l'occurrence peut être licite prise seule, mais
 *      la PHRASE qui la porte est arbitrée à remplacer. Le contexte prime ici sur le mot, parce
 *      que c'est le titre entier qui change. À CORRIGER, dans l'étape 3.
 *   4. `reference_reglementaire_legitime` — le règlement, la méthode de mesure, les exigences de
 *      contenant réellement publiées. Rien à corriger, où que l'occurrence vive.
 *
 * À partir de là, l'occurrence EST une affirmation interdite, et sa catégorie ne dit plus quoi
 * mais QUI : un harnais qui décrit le défaut, un artefact à régénérer, une source qui alimente
 * un générateur, l'héritage v1, une surface applicative, ou un guide éditorial.
 *
 * En v1 cet ordre était inverse, si bien qu'une référence licite vivant dans un artefact généré
 * était comptée « artefact généré » — donc rangée parmi les choses à traiter alors qu'elle est
 * juste.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { createHash } from "node:crypto";

const RACINE = process.cwd();

/* ---- LE MOTIF, UNIQUE ---------------------------------------------------------------------
   Il attrape tout le champ lexical, licite comme illicite : c'est la CLASSIFICATION qui
   tranche ensuite, jamais le motif. Un motif qui trierait déjà rendrait la catégorie
   « référence légitime » invisible, donc incomptable. */
/* LES TERMINAISONS ACCENTUÉES. Faute trouvée par la contre-épreuve 4 : `\\w*` ne contient PAS les
   lettres accentuées en JavaScript, si bien que « certifiée IATA » et « approuvée par l'IATA »
   n'étaient jamais vues — deux formes françaises entières manquaient au relevé. */
/* ---- L'ESPACE À L'INTÉRIEUR D'UNE PHRASE ---------------------------------------------------
 *
 * DÉFAUT MESURÉ LE 03/09/2026, ET IL INVENTAIT DES AFFIRMATIONS. Depuis que le lecteur de zones
 * rend le texte comme il est AFFICHÉ, une frontière de bloc devient une ligne vide. Or `\s+`
 * traverse les lignes vides : la fin d'une cellule de tableau se soudait donc au début de la
 * suivante. Sur la page espagnole « equipamiento de viaje », une cellule finit par « …opciones
 * conformes a IATA » — une référence LICITE — et la suivante commence par « Transportín
 * flexible » ; le motif y lisait « IATA Transportín », une attribution de contenant qui n'est
 * écrite nulle part. Deux occurrences fantômes au registre public, plus deux autres du même
 * mécanisme sur d'autres pages.
 *
 * UNE PHRASE NE TRAVERSE PAS UNE LIGNE VIDE. L'espace intra-phrase autorise donc les espaces, les
 * tabulations et UN retour à la ligne — un paragraphe peut être replié par l'éditeur — mais
 * jamais deux, qui signent un changement de bloc. C'est le lecteur qui a rendu ce défaut visible :
 * avant lui, tout était collé et le motif ne pouvait pas franchir ce qu'il ne voyait pas. */
const ESP = "(?:[^\\S\\n]|\\n(?!\\s*\\n))+";

const SUITE = "[\\wÀ-ÿ]*";
export const ALTERNATIVES = [
  "IATA[- ]?(?:approved|compliant|certified|accredited)",
  "IATA[- ]?(?:LAR|formula|method|requirements?|standards?|guidelines?)",
  "Live Animals Regulations",
  `homologu${SUITE}`, `homologad${SUITE}`, `homologa${SUITE}`,
  /* ---- LA CONFORMITÉ AFFIRMÉE D'UN OBJET, EN ESPAGNOL ET EN PORTUGAIS -----------------------
   *
   * TROU MESURÉ LE 03/09/2026, ET C'ÉTAIT UNE DETTE PRÉEXISTANTE — 37 occurrences dans 24
   * fichiers actifs, dont des guides espagnols et portugais RÉELLEMENT PUBLIÉS :
   * « caixa de transporte em conformidade com a IATA », « transportín conforme a IATA »,
   * « contêiner compatível com a IATA ». Le motif ne connaissait que les formes AVEC article —
   * « conforme a LA IATA » — et ces phrases-là n'en portent pas. Le registre a donc pu annoncer
   * zéro alors que la dette publiée ne l'était pas : un zéro LEXICAL, jamais un zéro réel.
   *
   * LA DISTINCTION EST DANS L'ORDRE. Se conformer aux EXIGENCES publiées par l'IATA est vrai et
   * licite ; être conforme à L'IATA ne veut rien dire, sinon prétendre que l'organisation valide
   * l'objet. Les formes qui nomment les exigences sont donc écrites AVANT, et accrochent les
   * premières. */
  `em${ESP}conformidade${ESP}com${ESP}(?:os${ESP})?requisitos(?:${ESP}d[ao]s?)?${ESP}IATA`,
  `conformes?${ESP}aos${ESP}requisitos(?:${ESP}d[ao]s?)?${ESP}IATA`,
  `requisitos${ESP}(?:d[ao]s?${ESP})?IATA`,
  `em${ESP}conformidade${ESP}com${ESP}a${ESP}IATA`,
  `compat[íi]ve(?:l|is)${ESP}com${ESP}a${ESP}IATA`,
  `compatibles?${ESP}con${ESP}la${ESP}IATA`,
  `conforme[s]?${ESP}(?:à${ESP}la${ESP}norme${ESP})?IATA`,
  `conforme[s]?${ESP}(?:a|à)${ESP}la${ESP}IATA`,
  `conforme[s]?${ESP}(?:à|a)${ESP}(?:la${ESP})?norma${ESP}IATA`,
  `conformes?${ESP}(?:a|à)${ESP}IATA`,
  /* SYMÉTRIE LINGUISTIQUE (arbitrage du 02/09/2026). « norme(s) IATA » était licite et
     « norma IATA » interdit, alors que les deux nomment le même référentiel — une incohérence
     entre langues, pas une règle. Les deux sont désormais licites À L'OCCURRENCE. Les
     AFFIRMATIONS COMPLÈTES restent interdites, et les alternatives qui les portent — « conforme
     à la norme IATA », « conforme a la norma IATA » — sont placées AVANT celles-ci, donc elles
     accrochent les premières. */
  `normas?${ESP}IATA`, `normes?${ESP}IATA`, `exigences${ESP}IATA`,
  `certifi${SUITE}${ESP}IATA`,
  `approuv${SUITE}${ESP}par${ESP}(?:l')?IATA`,
  `aprobad${SUITE}${ESP}por${ESP}la${ESP}IATA`,
  `aprovad${SUITE}${ESP}pela${ESP}IATA`,
];

/* ---- LA FAMILLE « CONTENANT + IATA », AJOUTÉE LE 02/09/2026 ---------------------------------
 *
 * CE QUI L'A RÉVÉLÉE : un contre-test navigateur, pas ce fichier. Deux libellés publiés —
 * « Choisir une caisse IATA » sur l'accueil, « Caisse IATA type » sur les fiches de race — ne
 * figuraient dans AUCUNE des huit catégories. Ils n'étaient pas mal classés : ils étaient
 * INVISIBLES. Aucune alternative ci-dessus ne produit un « IATA » nu, si bien qu'un nom de
 * contenant collé à « IATA » ne déclenchait rien du tout.
 *
 * POURQUOI C'EST UNE AFFIRMATION INTERDITE. « Caisse IATA » ne dit pas « homologuée », mais il
 * attribue le contenant à l'IATA — qui publie des EXIGENCES de contenant et déclare ne certifier,
 * n'approuver ni ne recommander aucun modèle. La forme « Caisse IATA type — 500 XL » allait plus
 * loin encore : elle laissait lire une nomenclature de fabricant comme une classification IATA.
 *
 * CE QUI RESTE LICITE, ET QUE CETTE FAMILLE NE TOUCHE PAS : « normes IATA », « exigences IATA »,
 * « IATA LAR », « méthode de mesure IATA », « Live Animals Regulations ». Aucune ne comporte de
 * nom de contenant ; les alternatives ci-dessus les captent AVANT celles-ci, et une contre-épreuve
 * exige qu'elles restent classées légitimes.
 *
 * LE MOTIF EST ÉCRIT UNE SEULE FOIS et sert AUX DEUX étages — le relevé et le jugement. Les
 * définir séparément, c'est les laisser diverger : ce lot en a fait deux fois l'expérience avec le
 * détecteur de montants. */
const CONTENANT = "caisses?|cages?|crates?|kennels?|carriers?|sacs?|bags?|jaulas?"
  + "|transport[íi]n(?:es)?|caixas?|bolsas?|conteneurs?";
const QUALIF = `(?:de${ESP})?(?:type|typical|tipo|t[íi]pic[ao]s?)`;
/* L'ORDRE COMPTE : dans une alternance, la première branche qui accroche gagne. La forme à
 * qualificatif SUIVANT — « Caisse IATA type » — doit donc précéder la forme nue, sans quoi celle-ci
 * s'arrêterait à « Caisse IATA » et le relevé montrerait une phrase tronquée. */
export const FAMILLE_CONTENANT = [
  `\\b(?:${CONTENANT})${ESP}IATA${ESP}(?:${QUALIF})\\b`,     // Caisse IATA type · Jaula IATA típica
  `\\b(?:${CONTENANT})${ESP}(?:${QUALIF}${ESP})?IATA\\b`,   // caisse IATA · caisse de type IATA
  `\\bIATA${ESP}(?:${QUALIF}${ESP})?(?:${CONTENANT})\\b`,    // IATA crate · IATA typical kennel
];

/* LES FORMES SANS CONTENANT ADJACENT, BORNÉES UNE PAR UNE.
 *
 * UNE PREMIÈRE RÉDACTION AVAIT AJOUTÉ « type|tipo IATA » TOUT NU à la famille, ce qui la
 * contredisait : la famille s'appelle « contenant + IATA », et ce motif-là n'en contient aucun. Il
 * aurait attrapé « IATA document type » et « IATA airport code », qui ne disent rien d'un
 * contenant. La contre-épreuve « et rien de plus » n'avait alors aucun cas négatif pour le voir.
 *
 * CE QU'IL FALLAIT COUVRIR est réel mais étroit : la fiche Luxair décrit une caisse dont le
 * contenant est nommé PLUS TÔT dans la phrase — « caisse de 115 × 60 × 85 cm maximum, type IATA
 * rigide » —, hors de portée d'une règle d'adjacence. On les borne donc EXACTEMENT, dans les
 * quatre langues réellement écrites, plutôt que d'élargir le motif au risque de tout attraper.
 * LA LIMITE EST NOMMÉE : une cinquième formulation de ce genre serait invisible jusqu'à ce qu'on
 * l'ajoute ici — c'est le prix d'un bornage exact, et il est préférable au prix inverse. */
export const FORMES_BORNEES = [
  `\\brigid${ESP}IATA${ESP}type\\b`,            // en — « rigid IATA type with two-point locking »
  `\\btype${ESP}IATA${ESP}rigide\\b`,           // fr — « type IATA rigide avec verrouillage »
  `\\btipo${ESP}IATA${ESP}r[íi]gid[ao]\\b`,     // es/pt — « tipo IATA rígida con cierre »
];

/* LE MOTIF HÉRITÉ, GARDÉ POUR PROUVER QUE L'EXTENSION N'EST QU'UN AJOUT. La contre-épreuve rejoue
 * le relevé avec lui et exige que CHAQUE occurrence d'alors soit encore là, à la même place et
 * dans la même catégorie : une extension qui déplacerait un classement existant serait une
 * réécriture déguisée du contrat, pas un élargissement. */
export const ALTERNATIVES_HERITEES = [...ALTERNATIVES];
ALTERNATIVES.push(...FAMILLE_CONTENANT, ...FORMES_BORNEES);

export const MOTIF = new RegExp(ALTERNATIVES.join("|"), "gi");
export const MOTIF_HERITE = new RegExp(ALTERNATIVES_HERITEES.join("|"), "gi");

/* ---- LES DEUX JUGEMENTS, PORTÉS SUR LE TEXTE TROUVÉ SEUL -----------------------------------
   Pas sur la ligne : c'est toute la correction du P0-2. Chacun ne voit que l'occurrence. */
const OCC_LEGITIME = /^(?:Live Animals Regulations|IATA[- ]?(?:LAR|formula|method|requirements?|standards?|guidelines?)|normes?\s+IATA|normas?\s+IATA|exigences\s+IATA|requisitos\s+(?:d[ao]s?\s+)?IATA|em\s+conformidade\s+com\s+(?:os\s+)?requisitos(?:\s+d[ao]s?)?\s+IATA|conformes?\s+aos\s+requisitos(?:\s+d[ao]s?)?\s+IATA)$/i;
const OCC_INTERDITE_FAMILLE = new RegExp(`^(?:${[...FAMILLE_CONTENANT, ...FORMES_BORNEES].join("|")})$`, "i");
const OCC_INTERDITE = /^(?:IATA[- ]?(?:approved|compliant|certified|accredited)|homologu[\wÀ-ÿ]*|homologad[\wÀ-ÿ]*|homologa[\wÀ-ÿ]*|conforme[s]?\s+(?:à\s+la\s+norme\s+)?IATA|conforme[s]?\s+(?:a|à)\s+la\s+IATA|conforme[s]?\s+(?:à|a)\s+(?:la\s+)?norma\s+IATA|certifi[\wÀ-ÿ]*\s+IATA|approuv[\wÀ-ÿ]*\s+par\s+(?:l')?IATA|aprobad[\wÀ-ÿ]*\s+por\s+la\s+IATA|aprovad[\wÀ-ÿ]*\s+pela\s+IATA|em\s+conformidade\s+com\s+a\s+IATA|compat[íi]ve(?:l|is)\s+com\s+a\s+IATA|compatibles?\s+con\s+la\s+IATA|conformes?\s+(?:a|à)\s+IATA)$/i;

/* Les quatre slugs que l'arbitrage conserve : identifiants historiques stables, jamais du
   contenu éditorial à reproduire dans un titre ou un texte. */
export const SLUGS_CONSERVES = [
  "airline-approved-dog-crate",
  "caisse-transport-avion-homologuee-chien",
  "transportin-homologado-iata-perro",
  "caixa-de-transporte-homologada-iata",
];

const APPLICATIF = [
  /^packages\/knowledge\/translations\//,
  /^packages\/ui\/src\/components\//,
  /^packages\/ui\/src\/pages\//,
  /^packages\/ui\/src\/lib\//,
  /^packages\/engine\/src\//,
  /^packages\/workers\//,
];
const GENERES = [/^packages\/knowledge\/raw\/guides\.json$/, /\.generated\.json$/, /^packages\/ui\/\.astro\//];

/* LES INSTRUMENTS DE MESURE, PAR ÉGALITÉ EXACTE DE CHEMIN — jamais un préfixe, jamais un motif.
 *
 * CE QU'ILS SONT. Deux fichiers ne PORTENT pas d'affirmations : ils portent le RELEVÉ des
 * affirmations des autres, et les vecteurs qui servent à l'éprouver.
 *   · `dette-iata-publiee.json` énumère les formulations encore PUBLIÉES par le site. Il est
 *     dérivé du DOM construit, il n'est servi à personne, et le corriger à la main serait
 *     exactement le mauvais geste : les contenus se corrigent, le site se reconstruit, PUIS le
 *     registre se régénère.
 *   · `test-etape3-dom.mjs` porte depuis le 02/09/2026 les vecteurs de la contre-épreuve du
 *     relevé public — « caisse IATA », « IATA crate », « conforme à la norme IATA »,
 *     « IATA requirements », « \u0049ATA crate », « I&#65;TA crate ». Ce sont des mutations
 *     écrites pour être VUES par la garde, pas des affirmations servies.
 *
 * DEUX AUTO-CONTAMINATIONS, TOUTES DEUX MESURÉES, AUCUNE EFFACÉE.
 *   · 30/08/2026 — sans cette catégorie, l'instrument comptait sa propre pièce de preuve comme
 *     dette à corriger : 59 occurrences apportées, dont 56 en `source_editoriale`, micro-lot
 *     éditorial gonflé de 592 à 649, et le registre EN TÊTE des fichiers à corriger.
 *   · 02/09/2026 — le registre était déjà excepté, mais son test arrivait APRÈS celui des slugs
 *     conservés et après le jugement lexical. Trois de ses URL étaient donc comptées
 *     « slug_conserve » et les vecteurs licites gonflaient les références réglementaires :
 *     33 slugs au lieu de 30, 589 légitimes au lieu de 586 — et le commentaire du code affirmait
 *     pourtant que le registre « prime sur tout classement ». Une exception qui n'est pas la
 *     PREMIÈRE règle appliquée n'est pas une exception.
 * Une mesure qui se compte elle-même n'est plus une mesure.
 *
 * LE CINQUIÈME, AJOUTÉ LE 03/09/2026 : `reecrire-iata.mjs`. Il porte la TABLE de réécriture,
 * c'est-à-dire le vocabulaire interdit en toutes lettres et sa contrepartie licite — il le porte
 * pour la même raison que l'instrument le porte, définir le geste. Sans cette entrée il gonflait
 * de quatre les slugs conservés et de quatre les références licites, dès sa première exécution.
 * C'est le SCELLÉ qui l'a désigné : la mesure a rougi avant que le chiffre n'entre dans un
 * rapport. C'est exactement ce pour quoi il a été écrit.
 *
 * LES PREMIERS, ET POURQUOI. `inventaire-iata.mjs` et `test-inventaire-iata.mjs`
 * citent tout le champ lexical pour le DÉFINIR et l'ÉPROUVER ; les compter comme dette
 * reviendrait à mesurer sa propre règle. Ils sortaient jusqu'ici du périmètre de lecture, donc
 * en silence ; ils sortent désormais par cette liste, donc à découvert. Voir `FICHIERS_IGNORES`.
 *
 * L'ÉGALITÉ EST EXACTE, ET UNE CONTRE-ÉPREUVE L'EXIGE : `dette-iata-publiee.backup.json`,
 * `docs/dette-iata-publiee.json`, `test-etape3-dom.backup.mjs` et une vraie source éditoriale ne
 * bénéficient pas de cette priorité — la même formulation y reste comptée. */
export const INSTRUMENTS_DE_MESURE = ["dette-iata-publiee.json", "inventaire-iata.mjs", "reecrire-iata.mjs", "test-etape3-dom.mjs", "test-inventaire-iata.mjs", "test-reecriture-iata.mjs"];

/* ---- LE SCELLÉ DES INSTRUMENTS -------------------------------------------------------------
 *
 * ATTAQUE REPRODUITE PAR LA CONTRE-REVUE DU 02/09/2026, sur le vrai harnais. Ajouter
 * `packages/ui/src/content/guides/fr/voyager-avion-avec-chien.md` — une VRAIE source éditoriale,
 * onze occurrences — à la liste ci-dessus, sans rien changer d'autre : sortie 0, tout vert. Le
 * harnais annonçait cinq instruments et retirait onze occurrences du micro-lot éditorial sans
 * qu'aucun contrôle ne bronche.
 *
 * POURQUOI LES CONTRE-ÉPREUVES NE LE VOYAIENT PAS. Elles importaient cette même liste au lieu de
 * la recopier — ce qui était la bonne décision contre la divergence, et reste la bonne. Mais une
 * liste confrontée à elle-même ne prouve que son APPLICATION et son BORNAGE par chemin, jamais la
 * LÉGITIMITÉ de ses membres. Il fallait un second témoin, versionné, extérieur au code.
 *
 * LE CONTRAT, repris du scellé de curation du lot B : la liste canonique reste unique, et elle
 * est confrontée à `instruments-de-mesure-scelle.json`. Ajouter un instrument exige donc DEUX
 * gestes dans la même pull request — l'ajout, puis `node inventaire-iata.mjs --sceller` — et le
 * diff du scellé rend l'ajout visible et relisible. Le mode par défaut ne sait qu'échouer, en
 * NOMMANT le chemin ajouté ou retiré. */
export const CHEMIN_SCELLE_INSTRUMENTS = "instruments-de-mesure-scelle.json";

const empreinteDe = (chemins) => createHash("sha256").update(JSON.stringify([...chemins].sort())).digest("hex");

/** Les écarts entre la liste canonique et son scellé versionné. Vide = scellé tenu. */
export function verifierScelleInstruments(liste = INSTRUMENTS_DE_MESURE, chemin = CHEMIN_SCELLE_INSTRUMENTS) {
  const ecarts = [];
  let scelle;
  try { scelle = JSON.parse(readFileSync(chemin, "utf8")); }
  catch (e) { return [`scellé illisible (${chemin}) : ${e.message}`]; }

  const attendus = Array.isArray(scelle?.chemins) ? scelle.chemins : null;
  if (!attendus) return [`scellé sans liste « chemins » : ${chemin}`];

  /* L'EMPREINTE EST CONFRONTÉE, PAS SEULEMENT DÉCLARÉE — sans quoi il suffirait d'éditer la liste
     du scellé en laissant l'empreinte, et le scellé mentirait sur lui-même. */
  if (scelle.empreinte !== empreinteDe(attendus)) ecarts.push("l'empreinte du scellé ne correspond pas à sa propre liste — le scellé a été édité à la main");

  const vus = new Set(liste), fige = new Set(attendus);
  for (const c of [...vus].sort()) if (!fige.has(c)) ecarts.push(`instrument AJOUTÉ sans rescellement : ${c}`);
  for (const c of [...fige].sort()) if (!vus.has(c)) ecarts.push(`instrument RETIRÉ sans rescellement : ${c}`);
  /* Un doublon ne change ni l'ensemble ni l'empreinte : il est nommé pour lui-même. */
  if (liste.length !== vus.size) ecarts.push(`la liste canonique porte ${liste.length} entrées pour ${vus.size} chemins distincts`);
  return ecarts;
}

/** Réécrit le scellé. Geste EXPLICITE : `node inventaire-iata.mjs --sceller`. */
export function scellerInstruments(liste = INSTRUMENTS_DE_MESURE, chemin = CHEMIN_SCELLE_INSTRUMENTS) {
  const chemins = [...new Set(liste)].sort();
  writeFileSync(chemin, JSON.stringify({
    _commentaire: "LES INSTRUMENTS DE MESURE DU VOCABULAIRE IATA, SCELLÉS. Ces fichiers portent le relevé et ses vecteurs de contre-épreuve, jamais une affirmation servie : leurs occurrences sont comptées à part et n'entrent dans aucun lot à corriger. Une liste confrontée à elle-même ne prouve pas la légitimité de ses membres — ce scellé est le second témoin. Ajouter ou retirer un instrument exige le rescellement dans la même pull request, par « node inventaire-iata.mjs --sceller ».",
    chemins,
    empreinte: empreinteDe(chemins),
  }, null, 2) + "\n");
  return chemins;
}
const TESTS = [/^test-/, /^mesures\//, /^test-baselines\//, /^test-lib\//, /^DOSSIER-/, /^docs\//, /^ADR/, /\.test\.[tj]s$/];

/* L'HÉRITAGE V1. La v2 prétendait PROUVER qu'il est inerte, en cherchant `"static/…"` dans les
   scripts. Cette preuve est impossible : un générateur écrivant `join(ROOT, "static", f)` ou
   `resolve(ROOT, "static", f)` y échapperait, et ajouter des motifs ne ferait que déplacer le
   trou — aucune analyse textuelle ne démontre qu'aucun code ne construit un chemin dynamiquement.
   La prétention est donc RETIRÉE. Ces répertoires ne sont plus « non publiés » : ils sont
   « à corriger ou à supprimer », et leurs 18 occurrences rejoignent le micro-lot éditorial. Leur
   suppression éventuelle sera une décision séparée et explicite, pas un effet de bord d'un
   classement. */
const HERITAGE_V1 = ["static/", "layouts/", "deploy/", "themes/", "SLUG-MAP.md"];

/* LES RÉFÉRENCES CONTEXTUELLEMENT À REFORMULER. Une occurrence peut être licite prise seule et
   devoir pourtant changer, parce que la PHRASE qui la porte présente l'IATA trop vaguement comme
   une « norme ». Le titre de section ci-dessous en est le cas arbitré : « IATA standard » et
   « norme IATA » sont licites à l'occurrence, « norma IATA » ne l'est pas, et les trois
   appartiennent au même titre — qui est remplacé en entier. Sans cette catégorie, deux des trois
   modifications approuvées manqueraient au contrat de l'étape 3.
   L'ancre est un fragment de texte, jamais un numéro de ligne : une ligne se déplace, un texte
   non. Une ancre qui ne trouve rien FAIT REFUSER le relevé — une déclaration qui ne s'applique
   pas est un mensonge, pas une exception. */
/* La liste est VIDE depuis l'étape 3 du 30/08/2026 : le seul titre qu'elle contenait — « The hold
   crate (IATA standard) / La caisse soute (norme IATA) / La jaula de bodega (norma IATA) » — a été
   reformulé. La garde d'ancre a rougi d'elle-même au moment de la correction, ce pour quoi elle
   existe : une déclaration qui ne s'applique plus à rien ne doit pas survivre à son objet. */
const A_REFORMULER = [];

/* UNE EXCEPTION DE COMMENTAIRE A EXISTÉ ICI, ET ELLE EST SUPPRIMÉE. Elle classait à part une
   occurrence vivant dans un commentaire de code — non publiée, donc ni une affirmation ni un
   travail à faire. Deux attaques de la contre-revue du 30/08/2026 l'ont mise à terre, toutes
   deux reproduites avant correction :

       const rendu = "/* <fragment> *\/";
       const rendu = `<p>/* <fragment> *\/</p>`;

   Les deux rendaient « zone valide, zéro problème » : une chaîne potentiellement RENDUE était
   classée « commentaire non publié ». Une regex ne distingue pas un commentaire d'une chaîne qui
   en contient les marqueurs ; seul un analyseur lexical le ferait.

   La preuve DOM censée rattraper cela ne s'exécutait JAMAIS : ce harnais tourne dans `test:unit`,
   avant tout build, si bien que `dist` était toujours absent et le contrôle toujours sauté. Ma
   phrase « en CI, il en existe toujours un » était fausse — vérifié : `test-inventaire-iata.mjs`
   n'apparaît nulle part dans `.github/workflows/ci.yml`.

   Plutôt que d'écrire un analyseur lexical pour UNE occurrence non publiée, la ligne interne de
   `FlightFinder.astro` a été reformulée : elle dit la même chose sans employer la forme suivie
   qui déclenchait le motif. L'instrument redevient simple, et le contrat vaut 24 + 3 = 27. */

const GENERATRICES_DECLAREES = ["content/"];

export const CATEGORIES = [
  /* — rien à corriger — */
  "slug_conserve",
  "citation_attribuee",
  "reference_reglementaire_a_reformuler",
  "reference_reglementaire_legitime",
  /* — une affirmation interdite ; la catégorie dit QUI la corrige — */
  "registre_preuve_non_public",
  "test_commentaire_historique",
  "artefact_genere",
  "source_generatrice_active",
  "heritage_a_corriger_ou_supprimer",
  "affirmation_publique_interdite",
  "source_editoriale",
];

/** Les portées d'une citation attribuée DANS une ligne : `"quote": "…"`, `citation: '…'`. */
function portéesDeCitation(ligne) {
  const out = [];
  const re = /(?:"quote"|"citation"|quote|citation)\s*:\s*(["'`])/g;
  let m;
  while ((m = re.exec(ligne))) {
    const guillemet = m[1];
    let i = m.index + m[0].length;
    while (i < ligne.length) {
      if (ligne[i] === "\\") { i += 2; continue; }
      if (ligne[i] === guillemet) break;
      i++;
    }
    out.push([m.index + m[0].length, i]);
  }
  return out;
}

/**
 * La catégorie d'UNE occurrence. `ligne` n'est que du contexte ; la décision porte sur `trouve`
 * et sur sa position [debut, fin). Rend `null` quand aucune règle ne reconnaît l'occurrence —
 * jamais un repli complaisant.
 */
/**
 * LE JUGEMENT LEXICAL, SEUL ET UNIQUE — « legitime », « interdite » ou « inconnue ».
 *
 * POURQUOI IL EST EXTRAIT (contre-revue du 02/09/2026). `test-etape3-dom.mjs` portait SA PROPRE
 * expression du vocabulaire interdit et bâtissait le registre de dette publique avec elle : deux
 * définitions de la même chose, donc deux nombres, et un verrou de lancement mesuré au motif le
 * plus étroit. Le contrat est désormais ici, et là seulement ; `classer()` le consulte, le
 * contrôle du DOM aussi.
 *
 * IL NE JUGE QUE LE TEXTE TROUVÉ. Ce qui dépend du FICHIER — slug conservé, citation attribuée,
 * phrase arbitrée à reformuler, qui corrige quoi — reste dans `classer()`, parce que cela ne se
 * décide pas sur l'occurrence seule. Un contrôle qui lit des pages construites n'a pas de fichier
 * source à consulter : il lui faut exactement ce jugement-ci, et rien de plus.
 */
export function jugerOccurrence(trouve) {
  if (OCC_LEGITIME.test(trouve)) return "legitime";
  if (OCC_INTERDITE.test(trouve) || OCC_INTERDITE_FAMILLE.test(trouve)) return "interdite";
  return "inconnue";
}

/* ---- L'EXEMPTION DE SLUG, CANONIQUE ET PARTAGÉE ---------------------------------------------
 *
 * POURQUOI ELLE SORT DE `classer()` (03/09/2026). Trois slugs arbitrés comme CONSERVÉS —
 * `caisse-transport-avion-homologuee-chien`, `transportin-homologado-iata-perro`,
 * `caixa-de-transporte-homologada-iata` — apparaissent dans les URL du JSON-LD des pages qu'ils
 * nomment. La garde de la dette PUBLIÉE les comptait comme des affirmations, alors que `classer()`
 * les exempte depuis toujours dans les sources. Deux règles pour la même question, donc deux
 * réponses : tant que ces slugs existent, le registre ne pouvait STRUCTURELLEMENT pas atteindre
 * zéro. Une seule définition, ici, consommée par les deux.
 *
 * ELLE EST BORNÉE À LA POSITION EXACTE DU SLUG, ET C'EST TOUT L'ENJEU : l'occurrence doit vivre
 * ENTIÈREMENT à l'intérieur du slug. Les mêmes mots écrits dans la prose voisine restent
 * interdits, et un slug altéré d'un seul caractère ne bénéficie de rien. */
export function dansUnSlugConserve(texte, debut, fin) {
  for (const sl of SLUGS_CONSERVES) {
    let i = texte.indexOf(sl);
    while (i !== -1) {
      if (debut >= i && fin <= i + sl.length) return true;
      i = texte.indexOf(sl, i + 1);
    }
  }
  return false;
}

/* ---- LES FRAGMENTS ATTRIBUÉS, PAR CHEMIN EXACT ET TEXTE EXACT --------------------------------
 *
 * L'IATA ACCRÉDITE RÉELLEMENT DES ENTREPRISES DE FRET — le programme « IATA Cargo Agency
 * Accreditation » existe, et « IATA Accredited Freight Forwarder » est sa désignation officielle.
 * Elle délivre par ailleurs un certificat de formation « IATA Live Animals Regulations » à des
 * PERSONNES. Ce sont deux choses différentes, et aucune des deux n'est l'homologation d'une caisse.
 *
 * AUCUNE PERMISSION LEXICALE GÉNÉRALE N'EST OUVERTE, et c'est l'arbitrage du 03/09/2026 :
 * `IATA-accredited`, `IATA-certified` et le mot « agent » restent interdits partout. Ne sont
 * licites que ces FRAGMENTS EXACTS, à ces CHEMINS EXACTS, chacun avec la page qui l'établit. Un
 * mot déplacé, une lettre changée, un autre fichier : rien n'est exempté.
 *
 * L'occurrence doit vivre ENTIÈREMENT à l'intérieur du fragment déclaré — comme pour les slugs.
 * Les mêmes mots écrits ailleurs dans la même ligne restent interdits. */
const PAGES_CATHAY = ["/airlines/cathay-pacific/", "/fr/airlines/cathay-pacific/", "/es/airlines/cathay-pacific/", "/pt/airlines/cathay-pacific/"];
const PAGES_AIRBALTIC = ["/airlines/airbaltic/", "/fr/airlines/airbaltic/", "/es/airlines/airbaltic/", "/pt/airlines/airbaltic/"];
export const FRAGMENTS_ATTRIBUES = [
  /* `pages` : les URL PUBLIÉES où le fragment peut paraître — la garde du DOM n'exempte que là,
     et que le texte exact. Une page de plus, un mot de moins : rien n'est exempté. */
  { chemin: "content/airlines/cathay_pacific.yml", pages: PAGES_CATHAY,
    fragment: "IATA Accredited Freight Forwarder",
    source: "https://www.cathaypacific.com/cx/en_IN/prepare-trip/help-for-passengers/travelling-with-animals/overview-cargo.html" },
  { chemin: "content/airlines/cathay_pacific.yml", pages: PAGES_CATHAY,
    fragment: "certificat IATA Live Animals Regulations",
    source: "idem — la page nomme le certificat de formation LAR comme troisième catégorie admise" },
  { chemin: "content/airlines/cathay_pacific.yml", pages: PAGES_CATHAY,
    fragment: "IATA Live Animals Regulations certificate",
    source: "idem" },
  { chemin: "content/airlines/cathay_pacific.yml", pages: PAGES_CATHAY,
    fragment: "certificado IATA Live Animals Regulations",
    source: "idem — la désignation officielle du certificat, en espagnol comme en portugais" },
  { chemin: "content/airlines/airbaltic.yml", pages: PAGES_AIRBALTIC,
    fragment: "IATA Live Animals Regulations training certificate",
    source: "https://www.airbaltic.com/en/cargo/shipping-animals-cargo" },
  { chemin: "content/airlines/airbaltic.yml", pages: PAGES_AIRBALTIC,
    fragment: "certificat de formation IATA Live Animals Regulations",
    source: "idem" },
  { chemin: "content/airlines/airbaltic.yml", pages: PAGES_AIRBALTIC,
    fragment: "certificado de formación IATA Live Animals Regulations",
    source: "idem" },
  { chemin: "content/airlines/airbaltic.yml", pages: PAGES_AIRBALTIC,
    fragment: "certificado de formação IATA Live Animals Regulations",
    source: "idem" },
];

/** Vrai si l'occurrence vit ENTIÈREMENT dans un fragment attribué déclaré POUR CE CHEMIN. */
export function dansUnFragmentAttribue(chemin, ligne, debut, fin) {
  for (const f of FRAGMENTS_ATTRIBUES) {
    if (f.chemin !== chemin) continue;
    let i = ligne.indexOf(f.fragment);
    while (i !== -1) {
      if (debut >= i && fin <= i + f.fragment.length) return true;
      i = ligne.indexOf(f.fragment, i + 1);
    }
  }
  return false;
}

/** Côté PUBLIÉ : vrai si l'occurrence vit entièrement dans un fragment déclaré POUR CETTE URL. */
export function dansUnFragmentAttribuePublie(url, texte, debut, fin) {
  for (const f of FRAGMENTS_ATTRIBUES) {
    if (!f.pages?.includes(url)) continue;
    let i = texte.indexOf(f.fragment);
    while (i !== -1) {
      if (debut >= i && fin <= i + f.fragment.length) return true;
      i = texte.indexOf(f.fragment, i + 1);
    }
  }
  return false;
}

export function classer(chemin, ligne, trouve, debut, fin) {
  /* 0 — UN INSTRUMENT DE MESURE NE SE MESURE PAS LUI-MÊME. Cette règle passe AVANT toutes les
     autres, y compris avant les slugs et avant le jugement lexical : sinon une URL du registre est
     comptée comme slug conservé, et ses vecteurs de contre-épreuve comme de vraies références
     licites. C'est exactement ce qui se produisait. */
  if (INSTRUMENTS_DE_MESURE.includes(chemin)) return "registre_preuve_non_public";

  /* 1 — L'occurrence EST à l'intérieur d'un slug conservé : un identifiant, pas une phrase. */
  if (dansUnSlugConserve(ligne, debut, fin)) return "slug_conserve";

  /* 1 bis — L'occurrence vit dans un FRAGMENT ATTRIBUÉ, déclaré pour CE chemin et sourcé : une
     désignation officielle de l'IATA, qui existe vraiment. Voir `FRAGMENTS_ATTRIBUES`. */
  if (dansUnFragmentAttribue(chemin, ligne, debut, fin)) return "reference_reglementaire_legitime";
  /* 2 — L'occurrence est À L'INTÉRIEUR d'une citation attribuée : on ne réécrit pas une source. */
  for (const [a, b] of portéesDeCitation(ligne)) if (debut >= a && fin <= b) return "citation_attribuee";

  /* 3 — La PHRASE porteuse est arbitrée « à reformuler » : elle prime sur le jugement porté sur
     l'occurrence seule, licite ou non, car c'est le titre entier qui est remplacé. */
  if (A_REFORMULER.some((r) => r.fichier === chemin && ligne.includes(r.ancre))) return "reference_reglementaire_a_reformuler";

  /* 4 — L'occurrence elle-même est une référence licite : le règlement, la méthode de mesure,
     les exigences de contenant. Rien à corriger, où qu'elle vive. */
  const jugement = jugerOccurrence(trouve);
  if (jugement === "legitime") return "reference_reglementaire_legitime";

  /* À partir d'ici, l'occurrence DOIT être une affirmation interdite. Sinon on ne sait pas ce
     que c'est, et on le dit. */
  if (jugement !== "interdite") return null;

  if (TESTS.some((r) => r.test(chemin))) return "test_commentaire_historique";
  if (GENERES.some((r) => r.test(chemin))) return "artefact_genere";
  if (GENERATRICES_DECLAREES.some((p) => chemin.startsWith(p))) return "source_generatrice_active";
  if (HERITAGE_V1.some((p) => chemin === p || chemin.startsWith(p))) return "heritage_a_corriger_ou_supprimer";
  if (APPLICATIF.some((r) => r.test(chemin))) return "affirmation_publique_interdite";
  return "source_editoriale";
}

/* ---- LES CITATIONS DE L'HÉRITAGE, RAPPORTÉES SANS RIEN PRÉTENDRE ---------------------------
   On ne prouve plus l'inertie : c'est indémontrable statiquement. On se contente de DIRE qui
   cite ces répertoires, pour que la décision de les corriger ou de les supprimer se prenne en
   connaissance de cause. Aucun de ces constats ne fait échouer le relevé. */
export function citationsDeLHeritage() {
  const scripts = [];
  const chercher = (d) => {
    if (!existsSync(d)) return;
    for (const e of [...readdirSync(d)].sort()) {
      const p = join(d, e);
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) { if (!["node_modules", ".git", "dist"].includes(e)) chercher(p); }
      else if ([".mjs", ".ts", ".js", ".cjs", ".json"].includes(extname(e)) && e !== "package-lock.json") scripts.push(p);
    }
  };
  for (const d of ["packages", "worker", "workers", "scripts"]) chercher(join(RACINE, d));
  for (const e of [...readdirSync(RACINE)].sort()) {
    if ([".mjs", ".cjs", ".js"].includes(extname(e))) scripts.push(join(RACINE, e));
  }
  const constats = [];
  for (const prefixe of HERITAGE_V1) {
    const cible = prefixe.replace(/\/$/, "");
    for (const f of scripts) {
      const rel = relative(RACINE, f);
      if (rel.startsWith("inventaire-iata") || rel.startsWith("test-inventaire-iata")) continue;
      let c; try { c = readFileSync(f, "utf8"); } catch { continue; }
      /* Le chemin littéral, ou construit par morceaux : `join(ROOT, "static", …)`. Ce relevé
         SUR-RAPPORTE volontairement — `output: "static"` d'Astro y figure, et c'est une valeur de
         configuration, pas un chemin. Il reste néanmoins incomplet : un chemin calculé lui
         échapperait. C'est précisément pourquoi on n'en tire plus aucune conclusion d'inertie ;
         il informe une décision humaine, il ne conclut rien. */
      if (new RegExp(`["'\`]${cible}/|["'\`]${cible}["'\`]\\s*,`).test(c)) constats.push({ prefixe, cite_par: rel });
    }
  }
  return constats;
}

/* Les ancres de reformulation doivent toutes MORDRE : une déclaration qui ne s'applique à rien
   ne protège rien, et masquerait une modification approuvée qu'on croirait couverte. */
export function ancresOrphelines(releve, declarations = A_REFORMULER) {
  return declarations.filter((r) => !releve.some((o) => o.fichier === r.fichier && o.categorie === "reference_reglementaire_a_reformuler"));
}

/* ---- LE PARCOURS, DÉTERMINISTE ------------------------------------------------------------- */
const IGNORE = new Set(["node_modules", ".git", "dist", ".astro", "coverage", ".wrangler"]);
/* IL N'Y A PLUS QU'UNE SEULE FAÇON POUR UN INSTRUMENT DE NE PAS SE MESURER LUI-MÊME
   (02/09/2026). Il y en avait DEUX, et c'est la faute récurrente de ce chantier : deux
   définitions de la même chose. `inventaire-iata.mjs` et `test-inventaire-iata.mjs` sortaient
   ICI, du PÉRIMÈTRE, donc en silence — elles n'apparaissaient dans aucun compte, et personne ne
   pouvait relire ce qu'elles contenaient ; `dette-iata-publiee.json` et `test-etape3-dom.mjs`
   sortaient plus bas, par CATÉGORIE, donc visiblement. Les deux auto-contaminations de ce projet
   ont été trouvées parce que les occurrences étaient VISIBLES. Les quatre passent donc par
   `INSTRUMENTS_DE_MESURE` : elles sont lues, comptées, et rangées dans une catégorie qui n'entre
   pas au micro-lot éditorial.
   LE MOUVEMENT EXACT, mesuré : total 3297 → 3431, fichiers 586 → 588, catégorie 342 → 476.
   Toutes les autres catégories sont INCHANGÉES — source éditoriale 267, sources génératrices
   1172, héritage v1 29, références licites 586, slugs 30, commentaires de test 55, artefacts à
   régénérer 816, affirmations publiques interdites 0. Rien à corriger n'est apparu ni disparu :
   seul l'invisible est devenu lisible.
   (Ces nombres décrivent CE MOUVEMENT-LÀ, à sa date, et rien d'autre.)

   AUCUN TOTAL COURANT N'EST ÉCRIT DANS CE COMMENTAIRE, ET C'EST DÉLIBÉRÉ. J'ai rapporté « 3 462 »
   quand l'instrument en mesurait 3 467 : le chiffre avait été relevé AVANT la régénération du
   registre, que l'inventaire recompte ensuite dans la catégorie instrumentale. Un total écrit ici
   est de surcroît périmé par sa propre écriture — les instruments et leurs contre-épreuves se
   comptent eux-mêmes, si bien que toute contre-épreuve ajoutée le déplace. Le seul nombre
   citable est donc celui que la mesure IMPRIME au moment où on la rejoue : le tableau de synthèse
   de ce fichier, et la ligne « 7 relevé réel » de `test-inventaire-iata.mjs`. Ce sont eux qui
   font foi, jamais un commentaire.
   `package-lock.json` reste hors périmètre : ce n'est pas un instrument, c'est un fichier généré
   que personne ne relit. */
const FICHIERS_IGNORES = new Set(["package-lock.json"]);
const EXT_TEXTE = new Set([".json", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".astro", ".md", ".mdx", ".yml", ".yaml", ".html", ".txt", ""]);

export function* parcourir(dir, inverse = false) {
  let entrees;
  try { entrees = [...readdirSync(dir)].sort(); } catch { return; }
  if (inverse) entrees.reverse();          // pour la contre-épreuve de déterminisme
  for (const e of entrees) {
    if (IGNORE.has(e)) continue;
    const p = join(dir, e);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) yield* parcourir(p, inverse);
    else if (!FICHIERS_IGNORES.has(e) && EXT_TEXTE.has(extname(e))) yield p;
  }
}

/** Le relevé complet, TRIÉ — l'ordre ne dépend d'aucun système de fichiers. */
export function relever({ inverse = false, racine = RACINE, motif = MOTIF } = {}) {
  const out = [];
  for (const p of parcourir(racine, inverse)) {
    const chemin = relative(racine, p);
    let contenu;
    try { contenu = readFileSync(p, "utf8"); } catch { continue; }
    if (!/IATA|homolog/i.test(contenu)) continue;
    const lignes = contenu.split("\n");
    for (let i = 0; i < lignes.length; i++) {
      motif.lastIndex = 0;
      for (const m of lignes[i].matchAll(motif)) {
        out.push({
          fichier: chemin, ligne: i + 1, colonne: m.index + 1, trouve: m[0],
          categorie: classer(chemin, lignes[i], m[0], m.index, m.index + m[0].length),
        });
      }
    }
  }
  return out.sort((a, b) =>
    a.fichier.localeCompare(b.fichier) || a.ligne - b.ligne || a.colonne - b.colonne || a.trouve.localeCompare(b.trouve));
}

/**
 * Ce qui fait ÉCHOUER un relevé. Extraite pour être éprouvée : la CLI l'appelle, le harnais
 * aussi, avec un relevé délibérément corrompu.
 */
export function verifier(releve, declarations = A_REFORMULER) {
  const inconnues = releve.filter((r) => r.categorie === null || r.categorie === undefined);
  const hors = releve.filter((r) => r.categorie != null && !CATEGORIES.includes(r.categorie));
  const orphelines = ancresOrphelines(releve, declarations);
  /* LE SCELLÉ EST VÉRIFIÉ ICI, avec les autres refus, et pas seulement dans le harnais : un
     instrument ajouté en douce retire des occurrences du compte, ce qui EST une falsification du
     relevé — pas un détail de test. */
  const scelle = verifierScelleInstruments();
  return {
    inconnues, hors, orphelines, scelle,
    ok: inconnues.length === 0 && hors.length === 0 && orphelines.length === 0 && scelle.length === 0,
  };
}

/* ---- SORTIE -------------------------------------------------------------------------------- */
if (import.meta.url === `file://${process.argv[1]}`) {
  const ARGS = process.argv.slice(2);
  if (ARGS.includes("--sceller")) {
    const chemins = scellerInstruments();
    console.log(`scellé RÉÉCRIT : ${chemins.length} instrument(s)`);
    for (const c of chemins) console.log(`  · ${c}`);
    process.exit(0);
  }
  const releve = relever();

  const constats = citationsDeLHeritage();
  const v = verifier(releve);
  if (!v.ok) {
    console.error("RELEVÉ REFUSÉ.");
    for (const r of v.inconnues.slice(0, 20)) console.error(`  occurrence qu'aucune règle ne reconnaît : ${r.fichier}:${r.ligne}:${r.colonne}  « ${r.trouve} »`);
    for (const r of v.hors.slice(0, 20)) console.error(`  catégorie hors liste : ${r.fichier}:${r.ligne}:${r.colonne}  « ${r.categorie} »`);
    for (const r of v.orphelines) console.error(`  ancre de reformulation qui ne trouve rien : ${r.fichier} « ${r.ancre} »`);
    for (const e of v.scelle) console.error(`  scellé des instruments : ${e}`);
    process.exit(1);
  }

  if (ARGS.includes("--json")) { process.stdout.write(JSON.stringify(releve, null, 1)); process.exit(0); }
  const filtre = ARGS.find((a) => a.startsWith("--cat="))?.slice(6);
  if (filtre) {
    const sel = releve.filter((r) => r.categorie === filtre);
    for (const r of sel) console.log(`${r.fichier}:${r.ligne}:${r.colonne}  « ${r.trouve} »`);
    console.log(`\n${sel.length} occurrence(s) en « ${filtre} », dans ${new Set(sel.map((r) => r.fichier)).size} fichier(s)`);
    process.exit(0);
  }

  console.log(`INVENTAIRE DU VOCABULAIRE IATA — ${releve.length} occurrences, ${new Set(releve.map((r) => r.fichier)).size} fichiers\n`);
  console.log("  — rien à corriger —");
  for (const c of CATEGORIES) {
    if (c === "reference_reglementaire_a_reformuler") console.log("  — licite à l'occurrence, mais la phrase porteuse est arbitrée à reformuler —");
    if (c === "reference_reglementaire_legitime") console.log("  — rien à corriger (suite) —");
    if (c === "registre_preuve_non_public") console.log("  — instrument de mesure : il porte le relevé et les vecteurs, jamais une affirmation servie —");
    if (c === "test_commentaire_historique") console.log("  — une affirmation interdite ; la catégorie dit qui la corrige —");
    const sel = releve.filter((r) => r.categorie === c);
    console.log(`${String(sel.length).padStart(5)}  ${c.padEnd(34)} ${String(new Set(sel.map((r) => r.fichier)).size).padStart(3)} fichier(s)`);
  }
  console.log(`${String(releve.length).padStart(5)}  ${"TOTAL".padEnd(34)}`);
  if (constats.length) {
    console.log("\n— l'héritage v1, et qui le cite (constat indicatif : l'inertie n'est PAS prouvable statiquement) —");
    for (const c of constats) console.log(`       ${c.prefixe} cité par ${c.cite_par}`);
  }

  const applic = releve.filter((r) => ["affirmation_publique_interdite", "reference_reglementaire_a_reformuler"].includes(r.categorie)).length;
  /* Le registre de preuve est VISIBLE dans le total général — on ne cache pas ce qu'on mesure —
     mais EXCLU du micro-lot éditorial : personne n'ira le corriger à la main. */
  const edito = releve.filter((r) => ["source_editoriale", "source_generatrice_active", "heritage_a_corriger_ou_supprimer"].includes(r.categorie)).length;
  console.log(`\nÉTAPE 3 APPLICATIVE : ${applic} modification(s)   ·   MICRO-LOT ÉDITORIAL : ${edito}   ·   À RÉGÉNÉRER : ${releve.filter((r) => r.categorie === "artefact_genere").length}`);

  for (const [titre, cat] of [["ÉTAPE 3 — affirmations interdites", "affirmation_publique_interdite"],
                              ["ÉTAPE 3 — références à reformuler", "reference_reglementaire_a_reformuler"],
                              ["MICRO-LOT ÉDITORIAL — sources", "source_editoriale"],
                              ["MICRO-LOT ÉDITORIAL — sources génératrices", "source_generatrice_active"],
                              ["MICRO-LOT ÉDITORIAL — héritage v1", "heritage_a_corriger_ou_supprimer"]]) {
    const par = releve.filter((r) => r.categorie === cat)
      .reduce((a, r) => ((a[r.fichier] = (a[r.fichier] || 0) + 1), a), {});
    const n = Object.values(par).reduce((a, b) => a + b, 0);
    console.log(`\n— ${titre} : ${n} occurrence(s), ${Object.keys(par).length} fichier(s) —`);
    for (const [f, k] of Object.entries(par).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`${String(k).padStart(5)}  ${f}`);
  }
}
