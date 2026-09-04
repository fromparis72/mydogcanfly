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
import { classer, MOTIF, SLUGS_CONSERVES, FRAGMENTS_ATTRIBUES } from "./inventaire-iata.mjs";

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
  /* LE TERME ENTRE GUILLEMETS ÉTAIT UNE ÉTIQUETTE, et l'étiquette disparaît avec le terme.
     « What is an "IATA-compliant" crate ? » remplacé mot à mot donnait « What is an "meeting the
     applicable requirements" crate ? » — article faux, et des guillemets qui ne citent plus rien.
     On réécrit la question entière, qui est d'ailleurs celle que la FAQ pose déjà. */
  [/(?<![\wÀ-ÿ])an\s+"IATA[- ]compliant"\s+crate(?![\wÀ-ÿ])/gi, "a crate that meets the applicable requirements"],
  [/\(IATA-Compliant\)/g, "(Meeting the Applicable Requirements)"],
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
  /* L'EMPHASE MARKDOWN NE COUPE PAS UNE PHRASE. Les guides écrivent « **IATA**-compliant » : les
     étoiles ne se voient pas à l'écran, mais elles cassent l'expression régulière, et deux
     affirmations survivaient à la réécriture EN ÉTANT PUBLIÉES. L'emphase est reportée sur le
     terme qui porte désormais le sens — jamais supprimée, c'est du style. */
  [/\*\*IATA\*\*-(?:approved|compliant|certified|accredited)\b/gi, "meeting the **applicable requirements**"],
  /* Le contenant garde son nom ; seule l'attribution part. L'article suit. */
  /* LA CASSE DU TITRE EST DU SENS, elle aussi. « Measuring Your Dog for an IATA Crate » est en
     capitales de titre : rendre « a travel crate » y écrit une minuscule au milieu d'un titre.
     La variante sensible à la casse passe donc AVANT la variante générale. */
  [/(?<![\wÀ-ÿ])an\s+IATA\s+Crate(?![\wÀ-ÿ])/g, "a Travel Crate"],
  [re("an\\s+IATA\\s+crate", "gi"), "a travel crate"],
  [re("an\\s+IATA\\s+kennel", "gi"), "a kennel"],
  [re("an\\s+IATA\\s+(carrier|cage)", "gi"), (_m, n) => `a travel ${n}`],
  /* `IATA container` — mesuré sur la fiche Thai Airways, dont le français, l'espagnol et le
     portugais disent déjà « contenant / jaula / caixa de transport(e) ». L'anglais dit donc la
     même chose, et pas autre chose. */
  [re("IATA\\s+containers", "gi"), "travel containers"],
  [re("IATA\\s+container", "gi"), "travel container"],
  [re("IATA\\s+crates", "gi"), "travel crates"],
  [re("IATA\\s+crate", "gi"), "travel crate"],
  [re("IATA\\s+kennels", "gi"), "kennels"],
  [re("IATA\\s+kennel", "gi"), "kennel"],
  [re("IATA\\s+carriers", "gi"), "travel carriers"],
  [re("IATA\\s+carrier", "gi"), "travel carrier"],
  [re("IATA\\s+cages", "gi"), "travel cages"],
  [re("IATA\\s+cage", "gi"), "travel cage"],
  [re("rigid\\s+IATA\\s+type", "gi"), "rigid travel"],
  /* LE QUALIFICATIF INTERCALÉ — même extension que dans l'instrument. « IATA travel crate »
     attribue la caisse à l'IATA aussi sûrement que « IATA crate » ; seul un mot les séparait.
     L'ARTICLE FAIT PARTIE DU MOTIF quand l'initiale change : « for an IATA Travel Crate » ne
     peut pas devenir « for an Travel Crate ». */
  [re("an\\s+IATA\\s+Travel\\s+Crate", "gi"), "a Travel Crate"],
  [re("IATA\\s+travel\\s+crates", "gi"), "travel crates"],
  [re("IATA\\s+travel\\s+crate", "gi"), "travel crate"],
  /* JAL LOUE des caisses. Ce qui est vrai, c'est qu'elles répondent aux exigences applicables —
     pas que l'IATA les loue ni qu'elle les délivre. */
  [re("IATA\\s+rental\\s+crates", "gi"), "rental crates that meet the applicable requirements"],
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
  [/\bconformes?\s+\*\*IATA\*\*/gi, "conforme aux **exigences applicables**"],
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
  /* LE QUALIFICATIF INTERCALÉ. « caisse rigide IATA » et « caisse de transport IATA » attribuent
     le contenant à l'IATA exactement comme « caisse IATA » : l'adjectif ne change rien à
     l'affirmation, il la cachait seulement au motif. On garde l'adjectif, on retire
     l'attribution. */
  [re("caisses\\s+rigides\\s+IATA", "gi"), "caisses de transport rigides"],
  [re("caisse\\s+rigide\\s+IATA", "gi"), "caisse de transport rigide"],
  [re("caisses\\s+de\\s+transport\\s+IATA", "gi"), "caisses de transport"],
  [re("caisse\\s+de\\s+transport\\s+IATA", "gi"), "caisse de transport"],
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
  /* ON N'AJOUTE PAS « pour chien » QUAND LA PHRASE LE DIT DÉJÀ. Le titre du guide était
     « Choisir un harnais de sécurité voiture homologué pour son chien » : la formulation neutre
     y écrivait « harnais de sécurité automobile pour chien pour son chien ». La règle regarde
     donc ce qui SUIT, sans le consommer. */
  [re("harnais\\s+de\\s+sécurité\\s+(?:voiture|automobile)\\s+homologué(?=\\s+pour\\s+(?:son\\s+)?chien)", "gi"), "harnais de sécurité automobile"],
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
  /* L'emphase porte le TITRE de la ligne, pas la phrase entière : « Le **matériel homologué**
     selon le mode de transport » ne peut pas devenir « Le **matériel adapté au mode de
     transport** selon le mode de transport ». La règle générale dit le mode de transport
     parce que rien d'autre ne le dit ; ici la ligne le dit déjà. */
  [re("(?:matériel|équipement)\\s+\\*\\*homologué\\*\\*"), "**matériel adapté**"],
  /* (4) LA REDONDANCE, vue en RELISANT la phrase produite et non en lisant le compteur. « admis en
         cabine » était juste, mais la phrase porteuse dit déjà « voyagent souvent EN CABINE » :
         « en cabine dans un sac souple admis en cabine » se lit deux fois. Les trois langues
         portaient la même phrase, donc la même redondance. Ce qui contraint réellement le sac,
         c'est sa DIMENSION : on le dit, et on ne redit pas la cabine.
     Groupe C — le sac de cabine. TROIS FAUTES MESURÉES ICI, nommées par la contre-revue du
     03/09/2026 et conservées comme telles.
     (1) L'ORDRE. Les deux formes précises étaient placées APRÈS la forme générale : « caisse/sac
         homologué » et « sac souple homologué » étaient mangés par « sac homologué » avant d'être
         cherchés. Une règle précise placée après la règle qu'elle précise ne s'exécute jamais.
     (2) LA CATÉGORIE GRAMMATICALE. « sac accepté par la compagnie, sous réserve de ses dimensions
         et conditions » est une proposition, pas un adjectif. Insérée devant un participe, elle a
         produit « sous réserve de ses dimensions et conditions glissé sous le siège ». Ce qui
         remplace un adjectif doit rester un adjectif : « admis en cabine » dit la même vérité —
         la compagnie admet, elle ne certifie pas — et tient dans la phrase.
     (3) LE NOMBRE. Un motif `sacs?` qui rend un singulier fabrique une faute d'accord muette.
         Le pluriel est écrit à part ; toute autre forme sortira au rapport des résidus. */
  [re("caisse\\/sac\\s+homologué", "gi"), "caisse ou sac accepté par la compagnie"],
  [re("sac\\s+souple\\s+homologué", "gi"), "sac souple aux dimensions admises"],
  [re("sacs\\s+homologués", "gi"), "sacs admis en cabine"],
  [re("sac\\s+homologué", "gi"), "sac admis en cabine"],
  /* « HOMOLOGATION » N'A PLUS DE REPLI GÉNÉRAL, ET C'EST UNE FAUTE MESURÉE QUI LE RETIRE. Le repli
     a détruit la seule phrase du site qui dise la vérité sur le sujet : « Ce n'est pas une
     homologation au sens d'un label payant » est devenu « Ce n'est pas une conformité aux
     exigences applicables au sens d'un label payant ». Cette phrase n'affirme aucune homologation
     — elle en NIE une, et explique le régime réel. Elle reste intacte. Une seule forme du dépôt
     affirme réellement une homologation qui n'existe pas, et elle est nommée ici. */
  [re("homologation\\s+crash-test", "gi"), "essai de choc"],
  /* LA PHRASE QUI NIE L'HOMOLOGATION EST LA PLUS JUSTE DU SITE, et le repli général l'avait
     rendue absurde. Elle explique le régime réel du CR82 : ce n'est pas un label payant, c'est un
     jeu d'exigences vérifiées à l'enregistrement. Elle N'AFFIRME aucune homologation — elle en
     NIE une. On ne la supprime donc pas : on remplace le seul mot que le motif interdit par
     celui qui dit la même chose, et la négation reste entière. */
  [re("homologation\\s+au\\s+sens\\s+d['’]un\\s+label\\s+payant", "gi"), "certification au sens d'un label payant"],
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
  /* LA CONFORMITÉ AFFIRMÉE D'UN OBJET À L'ORGANISATION ELLE-MÊME (03/09/2026). « jaula conforme
     a IATA » ne veut rien dire : l'IATA publie des exigences, elle ne valide pas un objet. Le
     contenant garde son nom ; l'affirmation devient ce qu'elle peut être — une conformité aux
     exigences applicables, sans certificateur. */
  [re("jaulas\\s+conformes\\s+a\\s+IATA", "gi"), "jaulas de transporte conformes a los requisitos aplicables"],
  [re("jaula\\s+conforme\\s+a\\s+IATA", "gi"), "jaula de transporte conforme a los requisitos aplicables"],
  [re("transportines\\s+conformes\\s+a\\s+IATA", "gi"), "transportines conformes a los requisitos aplicables"],
  [re("transportín\\s+conforme\\s+a\\s+IATA", "gi"), "transportín conforme a los requisitos aplicables"],
  [re("jaulas\\s+conformes\\s+con\\s+la\\s+IATA", "gi"), "jaulas de transporte conformes a los requisitos aplicables"],
  [re("jaula\\s+conforme\\s+con\\s+la\\s+IATA", "gi"), "jaula de transporte conforme a los requisitos aplicables"],
  [re("conformes\\s+con\\s+(?:la\\s+)?IATA", "gi"), "conformes a los requisitos aplicables"],
  [re("conforme\\s+con\\s+(?:la\\s+)?IATA", "gi"), "conforme a los requisitos aplicables"],
  [re("compatibles\\s+con\\s+la\\s+IATA", "gi"), "conformes a los requisitos aplicables"],
  [re("compatible\\s+con\\s+la\\s+IATA", "gi"), "conforme a los requisitos aplicables"],
  [re("conformes\\s+a\\s+IATA", "gi"), "conformes a los requisitos aplicables"],
  [re("conforme\\s+a\\s+IATA", "gi"), "conforme a los requisitos aplicables"],
  [re("conformes?\\s+a\\s+la\\s+IATA", "gi"), "conforme a los requisitos aplicables"],
  /* L'emphase markdown, comme en anglais et en français : « conforme a **IATA** » se lit d'un
     trait à l'écran. Mesuré publié sur le guide espagnol des transportines. */
  [/\bconformes\s+a\s+\*\*IATA\*\*/gi, "conformes a los **requisitos aplicables**"],
  [/\bconforme\s+a\s+\*\*IATA\*\*/gi, "conforme a los **requisitos aplicables**"],
  [re("certificadas\\s+IATA", "gi"), "conformes a los requisitos aplicables"],
  [re("tipo\\s+IATA\\s+rígida", "gi"), "rígida de transporte"],
  [re("jaulas\\s+IATA", "gi"), "jaulas de transporte"],
  [re("jaula\\s+IATA", "gi"), "jaula de transporte"],
  [re("transportines\\s+IATA", "gi"), "transportines"],
  [re("transportín\\s+IATA", "gi"), "transportín"],
  /* Le qualificatif intercalé, en espagnol. */
  [re("transportines\\s+r[íi]gidos\\s+IATA", "gi"), "transportines rígidos"],
  [re("transport[íi]n\\s+r[íi]gido\\s+IATA", "gi"), "transportín rígido"],
  [re("jaulas\\s+r[íi]gidas\\s+IATA", "gi"), "jaulas de transporte rígidas"],
  [re("jaula\\s+r[íi]gida\\s+IATA", "gi"), "jaula de transporte rígida"],
  [re("jaulas\\s+de\\s+viaje\\s+IATA", "gi"), "jaulas de viaje"],
  [re("jaula\\s+de\\s+viaje\\s+IATA", "gi"), "jaula de viaje"],
  /* LA FAA N'HOMOLOGUE PAS DE CONTENANT POUR ANIMAL. L'anglais et le français de la même fiche
     JetBlue disent « FAA carrier » et « sac FAA » ; l'espagnol et le portugais affirmaient une
     homologation par un régulateur qui n'en délivre pas. Ce qui est vrai et publié : la
     compagnie l'accepte, aux dimensions données juste après dans la même phrase. */
  [re("jaula\\s+homologada\\s+por\\s+la\\s+FAA", "gi"), "jaula aceptada por la compañía"],
  /* AIR FRANCE EXIGE UNE CAGE — elle n'en homologue aucune. Le français de la même fiche dit
     « cage de transport » ; l'espagnol dit la même chose, sinon les deux divergent. */
  [re("jaula\\s+homologada", "gi"), "jaula de transporte"],
  /* LES QUATRE MARQUES CITÉES PAR AIR AUSTRAL, et c'est le deuxième dégât nommé par la
     contre-revue. Ce qui est publié, c'est que la compagnie les ACCEPTE — pas qu'un organisme les
     homologue, et surtout pas modèle par modèle. L'anglais dit « approved brands cited », le
     portugais « marcas aprovadas citadas » : l'espagnol dit désormais la même chose, et non plus
     « conformes a los requisitos aplicables », qui affirmait d'une MARQUE ce qui ne se vérifie
     que d'un MODÈLE. */
  [re("Marcas\\s+homologadas\\s+citadas", "g"), "Marcas aprobadas citadas"],
  /* ---- LES REPLIS GÉNÉRAUX `homologad*` SONT RETIRÉS, ET C'EST UNE FAUTE MESURÉE QUI LES RETIRE.
     Quatre lignes — `homologadas`, `homologados`, `homologada`, `homologado` — remplaçaient le mot
     PARTOUT, sans regarder de quoi la phrase parlait. Elles ont écrit la formulation du CONTENANT
     AÉRIEN sur des sujets qui n'ont rien à voir : dix-neuf passages sur les harnais automobiles
     ont affirmé une conformité « aux exigences applicables » qu'aucun texte ne publie, et une
     fiche compagnie a déclaré quatre marques conformes sans preuve par modèle. Un compteur qui
     tombe à zéro ne dit rien de la phrase produite : il dit seulement que le mot a disparu.
     Chaque forme est donc reprise ici PAR SUJET RÉEL, dans la langue, avec la même vérité que le
     français, et rien n'est écrit qui ne soit vérifiable :
       · harnais et retenue automobile → aucun régime d'homologation publique n'existe. On nomme
         l'objet et son usage, jamais une conformité ;
       · contenant aérien → l'exigence existe et elle est publiée : « conforme aux exigences
         applicables » est la formulation arbitrée ;
       · sac de cabine → la compagnie ADMET, sous condition de dimensions. Elle ne certifie pas ;
       · matériel générique → adapté au mode de transport, ce qui est le sens visé ;
       · marque ou modèle précis → aucune conformité affirmée.
     Toute forme non nommée ici sortira au rapport des résidus au lieu d'être écrasée en silence. */
  /* Retenue automobile — le sujet est un harnais, pas une caisse. */
  [re("arn[ée]s\\s+de\\s+seguridad\\s+homologado", "gi"), "arnés de seguridad de coche para perro"],
  [re("arneses\\s+homologados", "gi"), "arneses de seguridad de coche para perro"],
  [re("arn[ée]s\\s+no\\s+homologado", "gi"), "arnés inadecuado"],
  [re("arn[ée]s\\s+homologado", "gi"), "arnés de seguridad de coche para perro"],
  [re("sistema\\s+de\\s+sujeci[óo]n\\s+homologado", "gi"), "sistema de sujeción adecuado al perro y al vehículo"],
  [re("sujeci[óo]n\\s+homologada", "gi"), "sujeción adecuada al perro y al vehículo"],
  [re("reja\\s+homologada", "gi"), "reja de separación adecuada al vehículo"],
  [re("ataduras\\s+baratas\\s+y\\s+no\\s+homologadas", "gi"), "ataduras baratas y sin ensayo de choque publicado"],
  /* Contenant aérien — l'exigence existe et elle est publiée. */
  [re("transport[íi]n\\s+o\\s+bolso\\s+homologado", "gi"), "transportín o bolso aceptado por la compañía"],
  [re("transport[íi]n\\s+r[íi]gido\\s+homologado", "gi"), "transportín rígido conforme a los requisitos aplicables"],
  [re("transportines\\s+homologados", "gi"), "transportines conformes a los requisitos aplicables"],
  [re("transport[íi]n\\s+homologado", "gi"), "transportín conforme a los requisitos aplicables"],
  /* Sac de cabine — la compagnie admet sous condition de dimensions, elle ne certifie pas. */
  [re("bolso\\s+flexible\\s+homologado", "gi"), "bolso flexible con las dimensiones admitidas"],
  [re("bolso\\s+homologado", "gi"), "bolso admitido en cabina"],
  /* Matériel générique — la ligne à emphase dit déjà le mode de transport, elle ne le redit pas. */
  [/\*\*Equipamiento\s+homologado\*\*/g, "**Equipamiento adecuado**"],
  [re("equipamiento\\s+homologado\\s+y\\s+duradero", "gi"), "equipamiento duradero y adecuado al medio de transporte"],
  [re("material\\s+duradero\\s+y\\s+homologado", "gi"), "material duradero y adecuado al medio de transporte"],
  [re("equipamiento\\s+homologado", "gi"), "equipamiento adecuado al medio de transporte"],
];

const PT = [
  /* « ADEQUADA » N'EST PAS L'AFFIRMATION INTERDITE, ET ON NE LA JETTE PAS AVEC ELLE. La branche
     `adequada à IATA` avalait l'adjectif : « Caixa de transporte adequada à IATA em caso de
     viagem no porão » devenait « Caixa de transporte em caso de viagem no porão », alors que
     l'anglais de la même fiche garde « Suitable travel crate if travelling in the hold ». Ce
     n'est pas l'IATA qui rend la caisse adéquate — mais la caisse doit bien être adéquate. 76
     occurrences perdaient ce mot en silence ; il est rendu, et l'attribution seule s'en va. */
  [re("caixas\\s+de\\s+transporte\\s+adequadas\\s+à\\s+IATA", "gi"), "caixas de transporte adequadas"],
  [re("caixa\\s+de\\s+transporte\\s+adequada\\s+à\\s+IATA", "gi"), "caixa de transporte adequada"],
  [re("caixas\\s+de\\s+transporte\\s+(?:aprovadas\\s+pela\\s+|homologadas\\s+pela\\s+)?IATA", "gi"), "caixas de transporte"],
  [re("caixa\\s+de\\s+transporte\\s+(?:aprovada\\s+pela\\s+|homologada\\s+pela\\s+)?IATA", "gi"), "caixa de transporte"],
  [re("caixas\\s+IATA", "gi"), "caixas de transporte"],
  [re("caixa\\s+IATA", "gi"), "caixa de transporte"],
  [re("bolsas\\s+IATA", "gi"), "bolsas de transporte"],
  [re("bolsa\\s+IATA", "gi"), "bolsa de transporte"],
  /* Le qualificatif intercalé, en portugais. */
  [re("caixas\\s+r[íi]gidas\\s+IATA", "gi"), "caixas de transporte rígidas"],
  [re("caixa\\s+r[íi]gida\\s+IATA", "gi"), "caixa de transporte rígida"],
  [re("bolsas\\s+de\\s+transporte\\s+IATA", "gi"), "bolsas de transporte"],
  [re("bolsa\\s+de\\s+transporte\\s+IATA", "gi"), "bolsa de transporte"],
  /* JetBlue, en portugais : voir la note espagnole. La FAA n'homologue pas de sac pour animal. */
  [re("bolsa\\s+de\\s+transporte\\s+homologada\\s+pela\\s+FAA", "gi"), "bolsa de transporte aceita pela companhia"],
  [re("aprovadas\\s+pela\\s+IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("aprovada\\s+pela\\s+IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("homologadas\\s+(?:pela\\s+)?IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("homologados\\s+(?:pela\\s+)?IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("homologada\\s+(?:pela\\s+)?IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("homologado\\s+(?:pela\\s+)?IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("adequadas\\s+à\\s+IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("adequada\\s+à\\s+IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  /* Idem en portugais : « caixa de transporte em conformidade com a IATA » affirme que
     l'organisation valide la caisse. On nomme ce qui est vrai — les exigences applicables. */
  [re("caixas\\s+de\\s+transporte\\s+em\\s+conformidade\\s+com\\s+a\\s+IATA", "gi"), "caixas de transporte em conformidade com os requisitos aplicáveis"],
  [re("caixa\\s+de\\s+transporte\\s+em\\s+conformidade\\s+com\\s+a\\s+IATA", "gi"), "caixa de transporte em conformidade com os requisitos aplicáveis"],
  [re("caixas\\s+de\\s+transporte\\s+conformes\\s+a\\s+IATA", "gi"), "caixas de transporte em conformidade com os requisitos aplicáveis"],
  [re("caixa\\s+de\\s+transporte\\s+conforme\\s+a\\s+IATA", "gi"), "caixa de transporte em conformidade com os requisitos aplicáveis"],
  [re("cont[êe]ineres\\s+compat[íi]veis\\s+com\\s+a\\s+IATA", "gi"), "contêineres em conformidade com os requisitos aplicáveis"],
  [re("cont[êe]iner\\s+compat[íi]vel\\s+com\\s+a\\s+IATA", "gi"), "contêiner em conformidade com os requisitos aplicáveis"],
  [re("compat[íi]veis\\s+com\\s+a\\s+IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("compat[íi]vel\\s+com\\s+a\\s+IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("em\\s+conformidade\\s+com\\s+a\\s+IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [/\bem\s+conformidade\s+com\s+a\s+\*\*IATA\*\*/gi, "em conformidade com os **requisitos aplicáveis**"],
  [/\bconforme\s+a\s+\*\*IATA\*\*/gi, "em conformidade com os **requisitos aplicáveis**"],
  [re("conformes\\s+a\\s+IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("conforme\\s+a\\s+IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("conformes?\\s+(?:à\\s+|com\\s+a\\s+)?IATA", "gi"), "em conformidade com os requisitos aplicáveis"],
  [re("tipo\\s+IATA\\s+rígida", "gi"), "rígida de transporte"],
  [re("tipo\\s+IATA\\s+rígido", "gi"), "rígido de transporte"],
  /* ---- LES REPLIS GÉNÉRAUX `homologad*` SONT RETIRÉS, ET C'EST UNE FAUTE MESURÉE QUI LES RETIRE.
     Quatre lignes — `homologadas`, `homologados`, `homologada`, `homologado` — remplaçaient le mot
     PARTOUT, sans regarder de quoi la phrase parlait. Elles ont écrit la formulation du CONTENANT
     AÉRIEN sur des sujets qui n'ont rien à voir : dix-neuf passages sur les harnais automobiles
     ont affirmé une conformité « aux exigences applicables » qu'aucun texte ne publie, et une
     fiche compagnie a déclaré quatre marques conformes sans preuve par modèle. Un compteur qui
     tombe à zéro ne dit rien de la phrase produite : il dit seulement que le mot a disparu.
     Chaque forme est donc reprise ici PAR SUJET RÉEL, dans la langue, avec la même vérité que le
     français, et rien n'est écrit qui ne soit vérifiable :
       · harnais et retenue automobile → aucun régime d'homologation publique n'existe. On nomme
         l'objet et son usage, jamais une conformité ;
       · contenant aérien → l'exigence existe et elle est publiée : « conforme aux exigences
         applicables » est la formulation arbitrée ;
       · sac de cabine → la compagnie ADMET, sous condition de dimensions. Elle ne certifie pas ;
       · matériel générique → adapté au mode de transport, ce qui est le sens visé ;
       · marque ou modèle précis → aucune conformité affirmée.
     Toute forme non nommée ici sortira au rapport des résidus au lieu d'être écrasée en silence. */
  /* Retenue automobile — le sujet est un peitoral, pas une caisse. */
  [re("peitoral\\s+de\\s+seguran[çc]a\\s+homologado", "gi"), "peitoral de segurança de carro para cachorro"],
  [re("peitorais\\s+homologados", "gi"), "peitorais de segurança de carro para cachorro"],
  [re("peitoral\\s+n[ãa]o\\s+homologado", "gi"), "peitoral inadequado"],
  [re("peitoral\\s+homologado", "gi"), "peitoral de segurança de carro para cachorro"],
  [re("sistema\\s+de\\s+conten[çc][ãa]o\\s+homologado", "gi"), "sistema de contenção adequado ao cachorro e ao veículo"],
  [re("conten[çc][ãa]o\\s+homologada", "gi"), "contenção adequada ao cachorro e ao veículo"],
  [re("grade\\s+homologada", "gi"), "grade de separação adequada ao veículo"],
  [re("amarras\\s+baratas\\s+e\\s+n[ãa]o\\s+homologadas", "gi"), "amarras baratas e sem ensaio de impacto publicado"],
  /* Contenant aérien — l'exigence existe et elle est publiée. */
  [re("caixa\\s+ou\\s+bolsa\\s+homologada", "gi"), "caixa ou bolsa aceita pela companhia"],
  [re("caixa\\s+r[íi]gida\\s+homologada", "gi"), "caixa rígida em conformidade com os requisitos aplicáveis"],
  [re("caixas\\s+homologadas", "gi"), "caixas em conformidade com os requisitos aplicáveis"],
  [re("caixa\\s+homologada", "gi"), "caixa em conformidade com os requisitos aplicáveis"],
  /* Sac de cabine — la compagnie admet sous condition de dimensions, elle ne certifie pas. */
  [re("bolsa\\s+flex[íi]vel\\s+homologada", "gi"), "bolsa flexível com as dimensões admitidas"],
  [re("bolsa\\s+homologada", "gi"), "bolsa admitida na cabine"],
  /* Matériel générique — la ligne à emphase dit déjà le mode de transport, elle ne le redit pas. */
  [/\*\*Equipamento\s+homologado\*\*/g, "**Equipamento adequado**"],
  [re("equipamento\\s+homologado\\s+e\\s+dur[áa]vel", "gi"), "equipamento durável e adequado ao meio de transporte"],
  [re("material\\s+dur[áa]vel\\s+e\\s+homologado", "gi"), "material durável e adequado ao meio de transporte"],
  [re("equipamento\\s+homologado", "gi"), "equipamento adequado ao meio de transporte"],
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
  { fichier: "content/airlines/cathay_pacific.yml", langue: "en",
    de: /\bIPATA\s*\/\s*IATA[- ]accredited\s+agents\b/gi,
    vers: "IPATA or ATA members, IATA Accredited Freight Forwarders, or holders of a valid IATA Live Animals Regulations certificate (from Hong Kong, any agent may book)",
    source: "https://www.cathaypacific.com/cx/en_IN/prepare-trip/help-for-passengers/travelling-with-animals/overview-cargo.html" },
  { fichier: "content/airlines/cathay_pacific.yml", langue: "fr",
    de: /\bIPATA\s*\/\s*accrédités\s+IATA\b/gi,
    vers: "membres IPATA ou ATA, transitaires titulaires de l'accréditation IATA Cargo Agency (IATA Accredited Freight Forwarder), ou titulaires d'un certificat IATA Live Animals Regulations valide ; au départ de Hong Kong, n'importe quel agent peut réserver",
    source: "idem" },
  { fichier: "content/airlines/cathay_pacific.yml", langue: "es",
    de: /\bagentes\s+IPATA\s*\/\s*acreditados\s+por\s+IATA\b/gi,
    vers: "miembros de IPATA o ATA, transitarios con la acreditación IATA Cargo Agency (IATA Accredited Freight Forwarder), o titulares de un certificado IATA Live Animals Regulations en vigor; desde Hong Kong, cualquier agente puede reservar",
    source: "idem" },
  { fichier: "content/airlines/cathay_pacific.yml", langue: "pt",
    de: /\bagentes\s+credenciados\s+pela\s+IPATA\s*\/\s*IATA\b/gi,
    vers: "membros da IPATA ou da ATA, agentes de carga com a acreditação IATA Cargo Agency (IATA Accredited Freight Forwarder), ou titulares de um certificado IATA Live Animals Regulations válido; a partir de Hong Kong, qualquer agente pode reservar",
    source: "idem" },
  /* LE CHEMIN EST `airbaltic.yml`, PAS `air_baltic.yml`. Faute mesurée le 03/09/2026 : le fichier
     déclaré n'existait pas, l'exception ne s'appliquait donc jamais — et la contre-épreuve, qui ne
     relisait que la TABLE, restait verte pendant que la donnée restait fausse. */
  { fichier: "content/airlines/airbaltic.yml", langue: "en",
    de: /\bthird-party\s+IATA[- ]certified\s+cargo\s+agents\b/gi,
    vers: "third-party cargo agents holding a valid IATA Live Animals Regulations training certificate",
    source: "https://www.airbaltic.com/en/cargo/shipping-animals-cargo" },
  { fichier: "content/airlines/airbaltic.yml", langue: "fr",
    de: /agences\s+fret\s+certifiées\s+IATA\s+tierces/gi,
    vers: "agences de fret tierces titulaires d'un certificat de formation IATA Live Animals Regulations valide", source: "idem" },
  { fichier: "content/airlines/airbaltic.yml", langue: "es",
    de: /agencias\s+de\s+carga\s+certificadas\s+IATA\s+externas/gi,
    vers: "agencias de carga externas con un certificado de formación IATA Live Animals Regulations en vigor", source: "idem" },
  { fichier: "content/airlines/airbaltic.yml", langue: "pt",
    de: /agências\s+de\s+carga\s+terceirizadas\s+certificadas\s+pela\s+IATA/gi,
    vers: "agências de carga terceirizadas com certificado de formação IATA Live Animals Regulations válido", source: "idem" },
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
export function appliquer(fragment, langue, compteur = new Map(), tables = TABLES, fichier = null) {
  const { texte: masque, gardes } = masquer(fragment);
  let out = masque;
  /* LES EXCEPTIONS ATTRIBUÉES PASSENT EN PREMIER, ET C'EST UNE FAUTE MESURÉE QUI L'IMPOSE. Elles
     s'appliquaient APRÈS les règles génériques : « IPATA / IATA-accredited agents » était donc
     déjà devenu « IPATA / meeting the applicable requirements agents » quand son motif exact était
     cherché, et l'exception ne trouvait plus rien. Une exception qui passe après la règle qu'elle
     excepte n'est pas une exception. */
  /* ET LEUR SORTIE EST PROTÉGÉE DES RÈGLES GÉNÉRIQUES QUI SUIVENT. Faute mesurée le 03/09/2026 :
     l'exception écrivait bien « IATA Accredited Freight Forwarder », puis la table anglaise
     repassait dessus et rendait « meeting the applicable requirements Freight Forwarders ». Une
     exception défaite par la règle qu'elle excepte n'est pas une exception. Sa sortie est donc
     masquée le temps de la passe générique, exactement comme un slug conservé. */
  const attribues = [];
  if (fichier) {
    /* IDEMPOTENCE : un fragment attribué DÉJÀ écrit est masqué lui aussi, sinon la seconde passe
       le mange — l'exception ne trouve plus rien à remplacer, et la règle générique voit
       « IATA Accredited » à nu. Mesuré : le second passage à blanc annonçait encore un fichier
       modifié. La liste vient de l'instrument, pas d'une copie. */
    for (const f of FRAGMENTS_ATTRIBUES) {
      if (!f.chemins.includes(fichier) || !out.includes(f.fragment)) continue;
      out = out.split(f.fragment).join(` A${attribues.length} `);
      attribues.push(f.fragment);
    }
    for (const a of ATTRIBUES) {
      if (a.fichier !== fichier || a.langue !== langue) continue;
      const avant = out;
      out = out.replace(a.de, () => {
        attribues.push(a.vers);
        return ` A${attribues.length - 1} `;
      });
      if (out !== avant) compteur.set(`attribué  ${fichier} [${langue}]`, (compteur.get(`attribué  ${fichier} [${langue}]`) ?? 0) + 1);
    }
  }
  for (const [motif, rep] of tables[langue]) {
    const avant = out;
    /* LA CAPITALE DU MOT REMPLACÉ EST RENDUE — mais jamais celle d'un ACRONYME. « Harnais
       homologué » doit rester « Harnais… » ; « IATA crate » ne doit PAS donner « Travel crate »,
       parce qu'« IATA » porte toujours une majuscule sans être un début de phrase. Les deux
       fautes ont été mesurées, chacune dans son sens. */
    out = out.replace(motif, (...args) => {
      const m = args[0];
      const chaine = args[args.length - 1];
      const decalage = args[args.length - 2];
      const sortie = typeof rep === "function" ? rep(...args) : rep;
      const premier = /^[\wÀ-ÿ]+/.exec(m)?.[0] ?? "";
      const acronyme = premier.length > 1 && premier === premier.toUpperCase();
      /* UN ACRONYME EN DÉBUT DE PHRASE EST QUAND MÊME UN DÉBUT DE PHRASE. Faute mesurée le
         04/09/2026 sur la fiche Thai Airways : la pastille « IATA container required » est
         devenue « travel container required », en minuscule, à côté de ses sœurs « Contenant de
         transport requis » et « Jaula de transporte obligatoria ». La règle « jamais la capitale
         d'un acronyme » est juste AU MILIEU d'une phrase — « an IATA crate » ne doit pas donner
         « a Travel crate » — mais elle ne dit rien de la position.
         ET LE DÉBUT DE PHRASE EST DÉFINI ÉTROITEMENT, PARCE QU'UNE PREMIÈRE RÉDACTION L'A DÉFINI
         LARGEMENT ET A CASSÉ QUARANTE PHRASES. Y compter « ; » et « : » a produit « les chiots
         sont refusés ; Caisse de transport requise » ; y compter « . » a produit « pet + crate
         ≤ 32 kg incl. A travel crate », parce qu'une abréviation se termine par un point sans
         finir la phrase — et ces fiches en sont pleines (« incl. », « min. », « max. », « sept. »).
         Distinguer l'abréviation de la fin de phrase demanderait une liste d'abréviations par
         langue : on ne le fait pas, et on le DIT. Ne comptent donc que les deux positions dont
         rien ne dépend : le tout début du fragment, et le début d'une ligne.
         LE GUILLEMET OUVRANT EST TRANSPARENT, et c'est la VÉRIFICATION PAR VALEURS qui l'a
         imposé. Une règle qui dépend de la POSITION ne voit pas la même chose selon qu'on lui
         donne la valeur DÉCODÉE d'un scalaire — « crate that meets… », décalage 0 — ou sa PLAGE
         BRUTE dans le YAML — « "crate that meets… » , décalage 1 derrière un guillemet. Les deux
         chemins se sont donc contredits, et `verifierYaml` a REFUSÉ d'écrire six fichiers en
         nommant le chemin exact de la valeur : la garde a fait son travail avant moi. Le
         guillemet d'ouverture n'est pas du texte, il est de la syntaxe ; il ne sépare rien. */
      const debutDePhrase = /(^|\n)[ \t]*["'`\u00ab]?[ \t]*$/.test(chaine.slice(0, decalage));
      if (debutDePhrase) return sortie.charAt(0).toUpperCase() + sortie.slice(1);
      return !acronyme && /^\p{Lu}/u.test(m) ? sortie.charAt(0).toUpperCase() + sortie.slice(1) : sortie;
    });
    if (out !== avant) {
      const n = (avant.match(motif) ?? []).length;
      compteur.set(`${langue}  ${motif}`, (compteur.get(`${langue}  ${motif}`) ?? 0) + n);
    }
  }
  out = attribues.reduce((t, v, i) => t.split(` A${i} `).join(v), out);
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

/* LA VÉRIFICATION COMPARE LES VALEURS DÉCODÉES, PAS SEULEMENT LA FORME DE L'ARBRE.
 *
 * FAUTE MESURÉE LE 03/09/2026, ET C'ÉTAIT UN FAUX RAPPORT DE MA PART. Cette fonction ne
 * confrontait que le NOMBRE de plages de langue et la LISTE DES CHEMINS de l'arbre. J'ai
 * pourtant annoncé « reparse et comparaison profonde » : c'était faux. Une substitution pouvait
 * altérer la valeur décodée d'un scalaire — une séquence d'échappement abîmée, un guillemet
 * avalé, une chaîne coupée — en laissant la forme de l'arbre RIGOUREUSEMENT identique, et rien
 * ne l'aurait vu.
 *
 * LA VÉRIFICATION EST DONC UNE ÉGALITÉ DE VALEURS, en deux exigences séparées :
 *   1. chaque scalaire CIBLÉ vaut exactement ce que la table produit sur sa valeur DÉCODÉE ;
 *   2. tout le reste — clés comprises — est identique au bit près.
 * L'objet attendu est construit en mémoire depuis l'état initial : on ne compare donc pas le
 * résultat à lui-même, mais à ce qu'il aurait DÛ être. */
function valeursDe(o, p = "") {
  if (Array.isArray(o)) return o.flatMap((v, i) => valeursDe(v, `${p}[${i}]`));
  if (o && typeof o === "object") return Object.entries(o).flatMap(([k, v]) => valeursDe(v, `${p}.${k}`));
  return [[p, o]];
}

export function verifierYaml(avant, apres, fichier) {
  let da, db;
  try { da = YAML.parse(avant); } catch (e) { return `YAML illisible AVANT : ${e.message}`; }
  try { db = YAML.parse(apres); } catch (e) { return `YAML invalide APRÈS réécriture : ${e.message}`; }
  const a = plagesYaml(avant).length, b = plagesYaml(apres).length;
  if (a !== b) return `scalaires de langue : ${a} → ${b}`;

  /* L'ATTENDU, construit depuis l'état initial : la table appliquée à chaque valeur DÉCODÉE,
     sous la langue de sa propre clé. Le compteur est muet ici — on ne compte pas deux fois. */
  const muet = new Map();
  const attendu = (function muter(n, langue) {
    if (typeof n === "string") return langue ? appliquer(n, langue, muet, TABLES, fichier) : n;
    if (Array.isArray(n)) return n.map((v) => muter(v, langue));
    if (n && typeof n === "object") {
      return Object.fromEntries(Object.entries(n).map(([k, v]) =>
        [k, muter(v, LANGUES.includes(k) ? k : langue)]));
    }
    return n;
  })(da, null);

  const va = valeursDe(attendu), vb = valeursDe(db);
  if (va.length !== vb.length) return `nombre de valeurs : ${va.length} → ${vb.length}`;
  for (let i = 0; i < va.length; i++) {
    if (va[i][0] !== vb[i][0]) return `chemin ${vb[i][0]} au lieu de ${va[i][0]}`;
    if (va[i][1] !== vb[i][1]) {
      return `valeur décodée ≠ attendu en ${va[i][0]} : ${JSON.stringify(String(vb[i][1]).slice(0, 70))}`
        + ` au lieu de ${JSON.stringify(String(va[i][1]).slice(0, 70))}`;
    }
  }
  return null;
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
  const restes = [], defauts = [], sansPortee = [], invisibles = [];

  for (const f of fichiers) {
      const orig = readFileSync(f, "utf8");
    const n0 = interdites(f, orig).length;
    /* ON NE SAUTE PAS UN FICHIER QUE LA SOURCE DIT PROPRE. Défaut mesuré le 03/09/2026 : un guide
       écrit « **IATA**-compliant » ; les étoiles cassent le motif, donc l'instrument ne voit RIEN
       dans la source — mais le lecteur de zones rend « IATA-compliant » et la page le PUBLIE. Une
       affirmation peut être invisible à la source et visible à l'écran. Tous les fichiers sont
       donc traités ; ceux que rien ne change ne sont simplement pas réécrits. */
    avant += n0;
    let texte = orig;

    const langueEntiere = langueDeFichier(f);

    if (langueEntiere) {
      /* Guides et press kits : le fichier ENTIER est d'une seule langue. Aucun mélange possible. */
      texte = appliquer(orig, langueEntiere, compteur, TABLES, f);

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
        const neuf = appliquer(frag, p.langue, compteur, TABLES, f);
        if (neuf !== frag) texte = texte.slice(0, p.debut) + neuf + texte.slice(p.fin);
      }
      const ecart = verifierYaml(orig, texte, f);
      if (ecart) { defauts.push(`${f} : ${ecart}`); continue; }
      /* Ce qui reste interdit HORS d'une plage de langue est NOMMÉ, jamais réécrit à l'aveugle. */
      const couvert = (i) => plages.some((p) => i >= p.debut && i < p.fin);
      for (const o of interdites(f, texte)) if (!couvert(o.index)) sansPortee.push(`${f} · « ${o.texte} »`);

    } else if (n0 === 0) {
      /* RIEN À RÉÉCRIRE, DONC AUCUNE PORTÉE À CONNAÎTRE. Le press kit embarque ses images, ses
         PDF et ses archives : 143 fichiers étaient déclarés « en défaut » à chaque passage, et ce
         bruit-là masque le seul défaut qui compte — un fichier qui PORTE une affirmation sans que
         l'on sache dans quelle langue la corriger. Le tri ne se fait donc pas sur l'extension,
         qui laisserait passer un `.svg` ou un `.js` porteur, mais sur le contenu : un fichier qui
         ne contient aucune occupation du vocabulaire n'a rien à dire et rien à cacher. Dès qu'il
         en contient une, la ligne suivante le nomme et fait échouer le passage. */
      continue;
    } else {
      defauts.push(`${f} : ${n0} occurrence(s) mais aucune portée de langue connue pour ce format`);
      continue;
    }

    const reste = interdites(f, texte);
    apres += reste.length;
    for (const m of reste) {
      restes.push(`${f} · « ${m.texte} » — …${texte.slice(Math.max(0, m.index - 55), m.index + m.texte.length + 55).replace(/\s+/g, " ")}…`);
    }
    if (texte !== orig) {
      touches++;
      if (!n0) invisibles.push(f);          // rien à la source, quelque chose à l'écran
      if (ECRIRE) writeFileSync(f, texte);
    }
  }

  console.log(`${fichiers.length} fichier(s) lus`);
  console.log(`${avant} occurrence(s) interdite(s) au départ · ${apres} après · ${touches} fichier(s) modifié(s)${ECRIRE ? "" : "  (RIEN N'A ÉTÉ ÉCRIT)"}`);
  console.log("\n— ce que chaque règle a traité, par langue —");
  for (const [k, n] of [...compteur].sort((a, b) => b[1] - a[1]).slice(0, 28)) console.log(`  ${String(n).padStart(4)}  ${k}`);
  if (invisibles.length) {
    console.log(`\n— ${invisibles.length} fichier(s) propres À LA SOURCE mais réécrits quand même —`);
    console.log("     (emphase markdown : « **IATA**-compliant » ne se voit pas dans le texte brut, mais la page le publie)");
    for (const l of invisibles) console.log("  " + l);
  }
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
