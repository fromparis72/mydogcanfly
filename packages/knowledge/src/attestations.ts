/**
 * LE RATTACHEMENT D'UN FAIT À LA PHRASE QUI L'ÉTABLIT (11/09/2026, annexe 51).
 *
 * Arbitré par Codex, tranché par Philippe, après une capture de la fiche Air France en portugais.
 *
 * ── LE PROBLÈME, TEL QUE LE VISITEUR LE VIT ───────────────────────────────────────────────────
 * Sur `/pt/airlines/air-france/`, la carte « Cabine » affichait : un état traduit, puis une phrase
 * EN FRANÇAIS — « En cabine (chats et chiens de moins de 8 kg, sac de transport compris) » — puis un
 * localisateur français, puis une date. Le lecteur lusophone repartait sans le chiffre. En soute,
 * même page, la citation était en anglais et le localisateur disait « Important! ». **L'information
 * essentielle ne passait pas**, et la prudence de septembre en était la cause directe : le détail
 * éditorial avait été retiré de la carte parce qu'il publiait des seuils que rien ne prouvait.
 *
 * ── CE QU'ON NE FERA PAS, ET POURQUOI ─────────────────────────────────────────────────────────
 * On ne traduit pas la citation. Une citation traduite n'est plus une citation : le jour où la
 * traduction dit dix kilos là où la page en dit huit, plus rien ne le révèle. Elle reste dans sa
 * langue, avec son étiquette, et le volet qui la porte ANNONCE cette langue.
 *
 * On ne réaffiche pas non plus `channels[].detail`, le texte éditorial historique : il contient des
 * faits que personne n'a rattachés à une preuve. Le retirer était juste ; le remettre serait
 * revenir en arrière.
 *
 * ── CE QU'ON FAIT : UNE SYNTHÈSE DÉRIVÉE DE FAITS ATTESTÉS ────────────────────────────────────
 * Un nombre et une unité se rendent dans n'importe quelle langue sans rien interpréter. La synthèse
 * localisée n'est donc pas une traduction de la source : c'est l'affichage d'un fait que la base
 * porte déjà sous forme structurée. Mais — et c'est tout l'objet de ce fichier — **un fait
 * structuré et une citation qui cohabitent sur le même canal ne prouvent rien ensemble.**
 *
 * *Mesuré avant d'écrire, sur les 302 politiques de canal :*
 *   · 49 portent un fait structuré (poids ou dimensions) ;
 *   · 43 d'entre elles portent aussi une citation ;
 *   · 36 seulement ont une citation où le nombre de kilos APPARAÎT ;
 *   · **0 — zéro — ont leurs trois dimensions de sac dans la citation.**
 * Sept canaux ont donc un seuil et une phrase qui ne le dit pas, et six un fait sans aucune phrase.
 *
 * *Et les 36 ne sont que des CANDIDATES, jamais des preuves* (Codex, 11/09) : qu'un « 8 » suive un
 * « kg » dans la phrase n'établit pas qu'il s'agisse du plafond DU CANAL. Ce pourrait être un âge,
 * un délai, une autre borne. **Aucun rattachement AUTOMATIQUE : chaque attestation est écrite à la
 * main, fait par fait.**
 *
 * *Promesse corrigée le 11/09/2026, sur remarque de Codex.* Cette ligne a longtemps dit « aucun
 * rattachement par expression régulière », alors que la garde SÉMANTIQUE reposait précisément sur
 * des expressions régulières — et que quatre contre-revues successives ont montré qu'elles ne
 * décidaient pas du sens. Ce qui est vrai, et ce qui reste : rien n'est rattaché automatiquement.
 * Ce qui était faux, et qui est retiré : prétendre qu'aucune expression régulière n'intervenait.
 *
 * ── LA FORME DU RATTACHEMENT ──────────────────────────────────────────────────────────────────
 * Une attestation dit DEUX choses, et les deux sont vérifiables :
 *   · `claim` — la sémantique COMPLÈTE de ce que la phrase établit : pas « max_weight_kg », mais
 *     « plafond de 8 kg, borne stricte, contenant compris ». Le champ seul ne suffit pas : deux
 *     politiques peuvent porter `max_weight_kg: 8` en voulant dire des choses différentes ;
 *   · les FRAGMENTS — les morceaux EXACTS de la phrase citée qui l'établissent, un par composant.
 *
 * ── TROIS FRAGMENTS, PAS UN (contre-revue de Codex, 11/09/2026, seconde passe) ─────────────────
 * La première rédaction n'attachait qu'un fragment unique, `excerpt`, et vérifiait que le fait s'y
 * trouvait « quelque part ». Codex a montré que « quelque part » ne prouve rien : un fragment assez
 * long finit toujours par contenir un mot de contenant, un marqueur de borne et un nombre, sans
 * qu'aucun des trois ne parle du même fait. Chaque composant est donc rattaché SÉPARÉMENT, et chacun
 * doit être une sous-chaîne de `source.quote` :
 *
 *   · `poids` — la valeur AVEC son unité de masse. « 8 kg », jamais « 8 » : un 8 de date ou un 75
 *     de numéro de vol ne franchit pas cette ligne ;
 *   · `borne` — la tournure qui dit la DIRECTION, collée à ce poids-là. « up to 8 kg » n'établit
 *     pas `lt`, « moins de 8 kg » n'établit pas `lte`, et « no more than » n'établit pas `gt` ;
 *   · `sujet` — ce qui est pesé, et **seulement si la phrase le dit**.
 *
 * ── L'ABSENCE DE PREUVE N'EST PAS UNE PREUVE (P0 de Codex, même passe) ─────────────────────────
 * `weight_includes_carrier` absent valait `false`, et l'interface publiait alors « chien seul ».
 * C'est un renversement de la charge de la preuve : qu'une source ne dise pas que le contenant est
 * inclus n'établit pas qu'il est exclu. Le sujet pesé est donc devenu FACULTATIF et à trois états —
 * « chien + contenant » attesté, « chien seul » attesté, ou **rien**. Quand rien n'est attesté, la
 * synthèse publie la borne SANS nommer de sujet. Aucune valeur par défaut n'est plus déduite.
 *
 * Permuter la preuve entre deux canaux casse le lien immédiatement, sur les trois fragments à la
 * fois. Ajouter une dimension absente de la phrase le casse aussi. C'est ce que les contre-épreuves
 * de sabotage exigent.
 *
 * La `claim` doit en outre CONCORDER avec les champs structurés de la politique : une attestation
 * qui annonce 8 kg sur une politique qui en porte 10 est refusée. Les deux se gardent l'un l'autre.
 */
import { z } from "zod";

/* ---- Ce qu'une phrase peut établir ---------------------------------------------------------- */

/** CE QUI EST PESÉ. Trois états, dont le troisième est l'absence : une phrase qui ne dit pas sur
 *  quoi porte le seuil n'établit NI « contenant compris » NI « chien seul ». */
export const SujetPese = z.enum(["dog_plus_carrier", "dog_alone"]);
export type SujetPese = z.infer<typeof SujetPese>;

/** UN PLAFOND. `bound` distingue « moins de 8 kg » (`lt`) de « jusqu'à 8 kg » (`lte`) : un chien
 *  pesant exactement le plafond est refusé dans le premier cas, accepté dans le second. */
export const ClaimPoidsMax = z.object({
  kind: z.literal("weight_max"),
  kg: z.number().positive(),
  bound: z.enum(["lt", "lte"]),
  /** FACULTATIF, et c'est tout l'objet du correctif : rien ne se déduit de son absence. */
  subject: SujetPese.optional(),
}).strict();

/** UN PLANCHER — « à partir de 8 kg », « more than 8 kg ».
 *
 *  *Pourquoi ce champ naît ici.* La phrase de la soute Air France établit DEUX bornes :
 *  « more than 8 kg … and up to 75 kg … with its carrier ». Le modèle ne portait que le maximum.
 *  Codex l'a nommé le 11/09 : ne pas afficher « plus de 8 kg » tant que cette borne basse n'est pas
 *  structurée. Elle l'est maintenant, avec sa borne exclusive, plutôt que tue. */
export const ClaimPoidsMin = z.object({
  kind: z.literal("weight_min"),
  kg: z.number().positive(),
  bound: z.enum(["gt", "gte"]),
  subject: SujetPese.optional(),
}).strict();

/** LES DIMENSIONS DU CONTENANT. Aucune n'est attestée au 11/09/2026 dans tout le dépôt : les dix
 *  politiques qui portent des dimensions structurées ont toutes une citation qui n'en parle pas. */
export const ClaimDims = z.object({
  kind: z.literal("carrier_dims_cm"),
  l: z.number().positive(), w: z.number().positive(), h: z.number().positive(),
}).strict();

export const Claim = z.discriminatedUnion("kind", [ClaimPoidsMax, ClaimPoidsMin, ClaimDims]);
export type Claim = z.infer<typeof Claim>;

/* ---- L'attestation : un fait, et les morceaux de phrase qui l'établissent -------------------- */

/** UN POIDS ATTESTÉ. Les fragments sont nommés parce qu'ils sont vérifiés séparément. */
export const AttestationPoids = z.object({
  claim: z.discriminatedUnion("kind", [ClaimPoidsMax, ClaimPoidsMin]),
  /** La valeur AVEC son unité, telle que la phrase l'écrit — « 8 kg », « 75 kg/165.35 lb. ». */
  poids: z.string().min(3),
  /** La tournure de direction, collée à ce poids — « moins de 8 kg », « up to 75 kg ». */
  borne: z.string().min(4),
  /** Ce qui est pesé. Présent SI ET SEULEMENT SI `claim.subject` l'est. */
  sujet: z.string().min(3).optional(),
}).strict();

/** DES DIMENSIONS ATTESTÉES — un seul fragment, qui doit porter les trois nombres et leur unité. */
export const AttestationDims = z.object({
  claim: ClaimDims,
  dimensions: z.string().min(5),
}).strict();

export const Attestation = z.union([AttestationPoids, AttestationDims]);
export type Attestation = z.infer<typeof Attestation>;

/** Les espaces et les apostrophes typographiques ne doivent pas faire échouer un rattachement
 *  juste. On normalise les DEUX côtés de la même façon, et rien d'autre : ni casse, ni accents,
 *  ni ponctuation — sans quoi la comparaison cesserait de prouver que le fragment vient bien
 *  de la phrase. */
const normaliser = (s: string) => s.replace(/[  \s]+/g, " ").replace(/[’‘]/g, "'").trim();

/** LE FRAGMENT VIENT-IL DE LA PHRASE ? C'est la garantie mécanique du rattachement. */
export const extraitVientDeLaCitation = (excerpt: string, quote: string | undefined): boolean =>
  typeof quote === "string" && normaliser(quote).includes(normaliser(excerpt));

/* ---- LA SÉMANTIQUE DU FAIT, LUE DANS SES FRAGMENTS ------------------------------------------ */
/**
 * P0 REPRODUIT PAR CODEX SUR `80e3ce6`, PUIS RENFORCÉ APRÈS `4443653` — une seule leçon.
 *
 * J'avais NOMMÉ cette limite dans mon propre dossier (« `includes_carrier` et le sens d'une borne
 * ne sont pas vérifiables depuis les nombres de l'extrait »), puis livré comme si la nommer
 * suffisait. C'est mot pour mot la faute de l'annexe 48 : *nommer une limite n'est pas la fermer.*
 * Codex l'a exploitée quatre fois sur la tête exacte que je venais de déclarer verte :
 *
 *   1. `includes_carrier: true` passait sur un fragment qui ne mentionne AUCUN contenant ;
 *   2. « up to 8 kg » passait avec la borne STRICTE `lt` — la phrase dit « jusqu'à », le fait dit
 *      « moins de », et un chien de 8 kg exactement basculait d'accepté à refusé ;
 *   3. le « 8 » d'une DATE passait pour un poids de 8 kg ;
 *   4. le « 75 » d'un NUMÉRO DE VOL passait pour 75 kg.
 *
 * La première correction a ajouté ces trois contrôles à l'intérieur d'un fragment unique. Codex a
 * répondu que « à l'intérieur du même fragment » n'est pas un rattachement : chaque composant doit
 * être attaché séparément, et c'est ce que ce fichier fait maintenant.
 *
 *   · LE NOMBRE EST UN POIDS. Le fragment `poids` doit porter la valeur suivie d'une unité de MASSE
 *     MÉTRIQUE. Une date, un numéro de vol, un âge ou un délai n'en portent pas.
 *   · LA BORNE EST DITE. Le fragment `borne` doit porter un marqueur de direction compatible,
 *     immédiatement suivi de CE poids. Les deux sont liés par construction, pas par voisinage.
 *   · LE SUJET EST DIT, OU N'EST PAS AFFIRMÉ. Le fragment `sujet` n'existe que si la phrase le dit,
 *     et alors il doit nommer un contenant, ou dire explicitement que le chien est pesé seul.
 *
 * POURQUOI DES MARQUEURS ET NON UNE ANALYSE. Ce n'est pas de la compréhension de texte : c'est une
 * liste FERMÉE de tournures, écrite dans les quatre langues du dépôt, qui REFUSE tout ce qu'elle ne
 * reconnaît pas. Une phrase dont la tournure manque à la liste n'est pas devinée — elle est
 * rejetée, et c'est la relecture humaine qui tranche. Le silence est le défaut, jamais l'accord.
 *
 * LES NÉGATIONS SONT PIÉGÉES EXPRÈS. « no more than 8 kg » contient « more than » : un marqueur de
 * plancher dans une phrase qui dit un plafond. Les marqueurs sont donc refusés dès qu'une négation
 * les précède immédiatement.
 */

/** Casse et accents sont neutralisés POUR CETTE LECTURE SEULEMENT — la garde de provenance, elle,
 *  continue de comparer les fragments accents compris. Ici on cherche des tournures, pas une
 *  identité : « Jusqu'à », « jusqu'a » et « JUSQU'À » disent la même chose. */
const aplatir = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Les unités de MASSE MÉTRIQUE. La valeur d'une claim est en kilogrammes : « 8 lb » ne l'établit
 *  pas, et « 17.64 » ne doit jamais valider un fait qui annonce 8. */
const UNITE_MASSE = "(?:kgs?|kilos?|kilogramm?es?|kilograms?|quilos?)";
/** L'unité de LONGUEUR — le CENTIMÈTRE, et lui seul.
 *
 *  *Sabotage 4 de Codex, sur `59d4788`* : « 46 × 28 × 24 in » validait une claim `carrier_dims_cm`
 *  de 46 × 28 × 24. Les nombres concordaient, l'unité non — et la fiche publiait des centimètres là
 *  où la compagnie écrit des pouces, soit un sac deux fois et demie trop grand. Le champ s'appelle
 *  `carrier_dims_cm` : la phrase doit dire des centimètres. Une source en pouces demandera une
 *  conversion DÉCLARÉE, avec son facteur écrit dans la fiche ; aucune n'existe au 11/09/2026, et
 *  aucune ne se fera en silence ici. */
const UNITE_LONGUEUR = "(?:cm|centimetres?|centimeters?)";

/** Les tournures reconnues, par borne, dans les quatre langues rendues. Liste FERMÉE. */
const MARQUEURS: Record<"lt" | "lte" | "gt" | "gte", string[]> = {
  lt: ["less than", "under", "below", "fewer than", "smaller than",
       "moins de", "inferieur a", "inferieure a",
       "menos de", "inferior a", "menor que", "abaixo de"],
  lte: ["up to", "no more than", "not more than", "not exceeding", "maximum of", "max of", "max",
        "maximum", "or less", "at most",
        "jusqu'a", "au maximum", "au plus", "ou moins", "n'excedant pas",
        "hasta", "como maximo", "no mas de", "o menos",
        "ate", "no maximo", "ou menos"],
  gt: ["more than", "over", "above", "exceeding", "greater than", "heavier than",
       "plus de", "superieur a", "superieure a", "au-dela de",
       "mas de", "superior a", "mayor que",
       "mais de", "acima de", "maior que"],
  gte: ["at least", "from", "or more", "minimum of", "minimum",
        "a partir de", "au moins", "ou plus",
        "al menos", "desde", "o mas",
        "pelo menos", "ou mais"],
};

/* ── LA FRONTIÈRE ENTRE CE QU'UNE MACHINE PROUVE ET CE QU'UN HUMAIN VALIDE ────────────────────
 *
 * ARBITRAGE DE CODEX, 11/09/2026, après quatre contre-revues sur ce seul contrat. Chacune a fermé
 * les cas qu'elle nommait ; chacune a été suivie d'une reformulation qui repassait :
 *   · « The carrier must be labelled »            (mot de contenant dans une autre proposition)
 *   · « Carrier not included in this weight »     (le sens exactement inverse)
 *   · « with the carrier included in the ticket price »        (l'inclusion porte sur le prix)
 *   · « a carrier without a label is refused »                 (l'exclusion porte sur l'étiquette)
 *   · « may travel with their carrier stored separately »      (le contenant voyage à part)
 *   · « with the carrier included in the reservation »         (inclus dans la réservation)
 *   · « The total weight of the dog is up to 8 kg and the carrier travels separately »
 *
 * *Chaque correction reconnaissait des mots et leur proximité, jamais le sens.* La cinquième liste
 * aurait été battue par la huitième phrase. Codex a refusé d'entrer dans cette course, et il a
 * raison : **la frontière est déplacée, pas repoussée.**
 *
 * CE QUE LA MACHINE PROUVE, seule, sans jugement :
 *   · le fragment vient MOT POUR MOT de la citation de CE canal ;
 *   · les fragments tiennent dans une MÊME PROPOSITION de cette citation ;
 *   · la valeur annoncée est suivie d'une UNITÉ DE MASSE MÉTRIQUE ;
 *   · une TOURNURE DE BORNE compatible précède immédiatement ce poids ;
 *   · la claim CONCORDE avec les champs structurés de la politique.
 *
 * CE QU'UN HUMAIN VALIDE, parce qu'aucune machine de ce dépôt ne le décide :
 *   · le SENS du sujet pesé — « contenant compris » ou « chien seul ».
 *
 * La validation humaine n'est pas une intention : c'est un SCELLÉ, `raw/attestations-relues.json`,
 * qui porte compagnie, canal, claim, citation et fragments. Il est BIDIRECTIONNEL — toute
 * attestation absente du scellé rougit, et toute entrée du scellé sans attestation correspondante
 * rougit aussi. Changer un seul caractère d'un fragment, d'une citation ou d'une claim casse
 * l'empreinte et exige une relecture. Trois attestations y figurent au 11/09/2026 : les trois
 * d'Air France, relues par Philippe et contre-revues par Codex.
 *
 * *COMPTE CORRIGÉ (12/09/2026, relevé par Codex).* J'avais écrit « 49 autres canaux ». C'était deux
 * mesures confondues en une. Rejoué sur les 302 politiques de canal : **49 portent un fait
 * structuré**, 43 d'entre elles portent aussi une citation, et **37 ont une citation qui énonce
 * réellement un poids ou des dimensions** — ce sont les candidates. Deux sont relues ; il en reste
 * donc **35**, et elles ne publient rien. Un compteur écrit de mémoire est un compteur faux.
 */

/* ── LE SCELLÉ : SA LECTURE, SA VALIDATION, SON EMPREINTE ─────────────────────────────────────
 *
 * P1 DE CODEX (12/09/2026), en quatre points, tous justes :
 *
 *   1. *L'empreinte ne liait pas la provenance complète.* Modifier `source.url`, `quote_language`,
 *      `locator`, `verified_date` ou `review_due` sans toucher à la citation laissait l'empreinte
 *      identique : le lien officiel, la langue annoncée au visiteur ou la fraîcheur de la preuve
 *      pouvaient dériver **sans relecture**. Un rattachement est relu CONTRE une source précise ;
 *      changer la source, c'est changer ce qui a été relu.
 *   2. *Le `join("§")` était ambigu.* Deux jeux de fragments distincts pouvaient produire la même
 *      chaîne — il suffisait qu'un fragment contienne le séparateur ou l'un des noms de champs.
 *      Le témoin de collision le démontre sur un cas concret.
 *   3. *Les sabotages manquaient* pour l'URL, la langue, le localisateur, les dates et la collision.
 *   4. *Le fichier du scellé n'était pas validé*, et les doublons d'empreintes disparaissaient dans
 *      un `Set` au lieu d'être refusés.
 *
 * CE QUI ENTRE DANS L'EMPREINTE : la compagnie, le canal, la claim, **toute la source** et les
 * fragments. CE QUI N'Y ENTRE PAS : `source.history`, le journal des révisions passées — y ajouter
 * une ligne est de la tenue de registre, pas une affirmation nouvelle sur la compagnie, et cela ne
 * doit pas exiger une relecture. C'est la seule exclusion, et elle est nommée.
 */

/** SÉRIALISATION CANONIQUE — ordonnée, typée, sans séparateur à deviner.
 *
 *  `JSON.stringify` échappe les guillemets et distingue `"8"` de `8` ; trier les clés rend la
 *  sortie stable quel que soit l'ordre d'écriture dans le YAML. Deux valeurs distinctes ne peuvent
 *  plus produire la même chaîne, ce qui était exactement le défaut du `join("§")`. */
const canonique = (v: unknown): string => {
  if (v === undefined || v === null) return "null";
  if (Array.isArray(v)) return `[${v.map(canonique).join(",")}]`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonique(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
};

/** La source telle qu'elle est OPPOSABLE : tout sauf le journal des révisions. */
export type SourceOpposable = { history?: unknown } & Record<string, unknown>;
const partieOpposable = (source: SourceOpposable | undefined) => {
  if (!source) return null;
  const copie: Record<string, unknown> = {};
  for (const k of Object.keys(source)) if (k !== "history") copie[k] = source[k];
  return copie;
};

/** L'EMPREINTE D'UNE ATTESTATION — ce qui a été relu, en entier. Toute modification de la claim,
 *  d'un fragment ou d'un champ opposable de la source produit une empreinte différente, donc un
 *  refus, donc une relecture. */
export function empreinteAttestation(
  airlineId: string, placement: string, a: Attestation, source: SourceOpposable | undefined,
): string {
  const fragments = "dimensions" in a
    ? { dimensions: a.dimensions }
    : { poids: a.poids, borne: a.borne, sujet: a.sujet ?? null };
  return canonique({ airline: airlineId, placement, claim: a.claim, source: partieOpposable(source), fragments });
}

/* ── LA LECTURE DU SCELLÉ, VALIDÉE ET SANS ABSORPTION SILENCIEUSE ─────────────────────────────
 * Un scellé mal formé est pire qu'un scellé absent : il autorise sans que personne ne sache quoi.
 * Il est donc relu par un schéma strict, et un doublon d'empreinte est REFUSÉ plutôt que fondu
 * dans un `Set` — deux relectures d'une même attestation, c'est une relecture de trop qu'aucun
 * compteur n'aurait signalée. L'erreur est levée au CHARGEMENT : rien ne démarre sur un scellé
 * douteux. */
import scelleBrut from "../raw/attestations-relues.json";

const EntreeScellee = z.object({
  empreinte: z.string().min(1),
  /** Le sens reconnu, écrit pour l'humain qui relira la suivante — jamais lu par la machine. */
  sens_relu: z.string().min(20),
}).strict();

const FichierScelle = z.object({
  _comment: z.array(z.string()).min(1),
  relu_le: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  relu_par: z.string().min(3),
  attestations: z.array(EntreeScellee),
}).strict();

const SCELLE: ReadonlySet<string> = (() => {
  const lu = FichierScelle.safeParse(scelleBrut);
  if (!lu.success) {
    throw new Error("raw/attestations-relues.json est invalide — le scellé de relecture humaine ne "
      + "peut pas être lu, donc AUCUNE attestation n'est autorisée :\n"
      + lu.error.issues.map((i) => `  · ${i.path.join(".")} — ${i.message}`).join("\n"));
  }
  const vues = new Set<string>();
  for (const e of lu.data.attestations) {
    if (vues.has(e.empreinte)) {
      throw new Error(`raw/attestations-relues.json : empreinte EN DOUBLE, refusée plutôt `
        + `qu'absorbée — deux relectures d'un même rattachement, dont une au moins est de trop :\n  ${e.empreinte}`);
    }
    vues.add(e.empreinte);
  }
  return vues;
})();

/** LES EMPREINTES SCELLÉES, pour le contrôle de bidirectionnalité — aucune entrée orpheline. */
export const empreintesScellees = (): string[] => [...SCELLE];

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Le nombre, écrit comme le fragment peut l'écrire : « 8 », « 8.0 », « 8,0 ». */
const motifNombre = (n: number) => {
  const entier = String(n).replace(".", "[.,]");
  return `${echapper(entier)}(?:[.,]0+)?`;
};

/** LE FRAGMENT DIT-IL QUE CETTE VALEUR EST UN POIDS ? */
const valeurEstUnPoids = (plat: string, kg: number) =>
  new RegExp(`(?<![\\d.,])${motifNombre(kg)}\\s*${UNITE_MASSE}\\b`).test(plat);

/** LE FRAGMENT DIT-IL LA DIRECTION DE LA BORNE, juste avant ce poids ?
 *
 *  « juste avant » = au plus 20 caractères, sans franchir une fin de proposition. Sans cette
 *  limite, « more than 8 kg … and up to 75 kg » validerait n'importe quelle borne sur n'importe
 *  laquelle de ses deux valeurs. */
const borneEstDite = (plat: string, kg: number, bound: "lt" | "lte" | "gt" | "gte") =>
  MARQUEURS[bound].some((m) => new RegExp(
    `(?<!\\b(?:no|not|non|nao|ne|pas|sans)\\s)${echapper(m)}\\b[^.;:]{0,20}?(?<![\\d.,])${motifNombre(kg)}\\s*${UNITE_MASSE}\\b`,
  ).test(plat));

/* ── UNE SEULE PROPOSITION, PAS UNE PHRASE ENTIÈRE ────────────────────────────────────────────
 * *Sabotage 1 de Codex.* « Dogs under 8 kg may travel in cabin. The carrier must be labelled. » :
 * le poids et la borne viennent de la première phrase, le contenant de la seconde, et le tout
 * passait. Trois fragments qui viennent de la même CITATION ne parlent pas pour autant du même
 * fait. Ils doivent désormais tenir dans une même proposition.
 *
 * Les abréviations d'unité sont protégées avant le découpage : « 17.64 lb. and up to 75 kg »
 * est une seule proposition, et la soute Air France ne doit pas se couper en deux au milieu de sa
 * propre fourchette. */
/* L'abréviation n'est protégée QUE si la phrase CONTINUE derrière elle — une minuscule ou un
   chiffre. Trouvé deux fois en écrivant le sabotage : d'abord parce que « kg. » était protégé sans
   regarder la suite, puis parce que la lecture de cette suite portait le drapeau `i` et prenait
   donc une majuscule pour une minuscule. Le test de la suite est ici SENSIBLE À LA CASSE, et il est
   séparé du motif pour que ce soit visible. */
const ABREV = /\b(lb|lbs|oz|kg|cm|mm|in|no|nr|approx|etc|max|min)\./gi;
const protegerAbrev = (q: string) => q.replace(ABREV, (trouve, mot: string, offset: number, entier: string) => {
  const suite = entier.slice(offset + trouve.length).match(/^\s*(.)/);
  return suite && /[a-z0-9]/.test(suite[1]) ? `${mot}\u0000` : trouve;
});
/** Le point DÉCIMAL n'est pas une fin de proposition. Trouvé en écrivant le découpage : « 17.64 »
 *  se coupait en « 17 » et « 64 », et la soute Air France perdait sa propre fourchette. */
const DECIMAL = /(?<=\d)\.(?=\d)/g;
const propositionsDe = (quote: string): string[] =>
  protegerAbrev(quote.replace(DECIMAL, "\u0000"))
    .split(/[.;:]+/).map((p) => normaliser(p.replace(/\u0000/g, ".")))
    .filter((p) => p.length > 0);

/** LES FRAGMENTS TIENNENT-ILS DANS UNE MÊME PROPOSITION DE LA CITATION ? */
const memeProposition = (fragments: string[], quote: string | undefined): boolean =>
  typeof quote === "string"
  && propositionsDe(quote).some((p) => fragments.every((f) => p.includes(normaliser(f))));

/** LES TROIS DIMENSIONS, DANS L'ORDRE, AVEC LEUR UNITÉ — rien de moins ne prouve un gabarit. */
const dimensionsSontDites = (plat: string, l: number, w: number, h: number) =>
  new RegExp(`${motifNombre(l)}\\s*[x×]\\s*${motifNombre(w)}\\s*[x×]\\s*${motifNombre(h)}\\s*${UNITE_LONGUEUR}\\b`).test(plat);

/** TOUS LES FRAGMENTS d'une attestation, pour la garde de provenance. */
export const fragmentsDe = (a: Attestation): string[] =>
  "dimensions" in a ? [a.dimensions] : [a.poids, a.borne, ...(a.sujet ? [a.sujet] : [])];

/**
 * LA SÉMANTIQUE DU FAIT EST-ELLE DITE PAR SES FRAGMENTS ? Rend le motif du refus, ou `null`.
 * Un seul motif est rendu à la fois : le premier manque suffit à éteindre le rattachement.
 */
export function semantiqueAbsente(a: Attestation): string | null {
  if ("dimensions" in a) {
    const { l, w, h } = a.claim;
    return dimensionsSontDites(aplatir(a.dimensions), l, w, h) ? null
      : `le fragment de dimensions ne dit pas ${l} × ${w} × ${h} avec leur unité`;
  }
  const { claim } = a;
  if (!valeurEstUnPoids(aplatir(a.poids), claim.kg)) {
    return `le fragment « ${a.poids} » ne porte pas ${claim.kg} comme un POIDS : aucune unité de masse ne le suit`;
  }
  if (!borneEstDite(aplatir(a.borne), claim.kg, claim.bound)) {
    return `le fragment « ${a.borne} » ne dit pas la borne « ${claim.bound} » devant ${claim.kg} kg — aucune tournure reconnue de la liste fermée`;
  }
  /* LE SUJET EST DÉCLARÉ ET ATTESTÉ ENSEMBLE, OU PAS DU TOUT. Un fait sans fragment de sujet ne
     peut pas nommer ce qui est pesé ; un fragment de sujet sans fait déclaré ne sert à rien. */
  if (claim.subject && !a.sujet) {
    return `l'attestation annonce le sujet pesé « ${claim.subject} » sans le rattacher à aucun fragment`;
  }
  if (a.sujet && !claim.subject) {
    return `un fragment de sujet est rattaché, mais l'attestation ne déclare aucun sujet pesé`;
  }
  /* LE FRAGMENT DE SUJET DOIT PORTER LE POIDS — c'est mécanique, et c'est tout ce qui l'est. Ce que
     ce fragment SIGNIFIE — le contenant compte-t-il dans ces kilos, ou en est-il exclu — n'est pas
     décidé ici : c'est le scellé de relecture humaine qui l'autorise, ou rien ne paraît. */
  if (claim.subject && !valeurEstUnPoids(aplatir(a.sujet as string), claim.kg)) {
    return `le fragment de sujet « ${a.sujet} » ne porte pas les ${claim.kg} kg dont il prétend dire ce qui est pesé`;
  }
  return null;
}

/** LA CLAIM CONCORDE-T-ELLE avec les champs structurés de la politique ?
 *
 *  Les deux se gardent l'un l'autre : corriger le seuil structuré sans toucher l'attestation, ou
 *  l'inverse, fait rougir le build. C'est exactement la dérive que ce lot existe pour empêcher —
 *  un chiffre affiché en gras et une preuve qui en dit un autre, dans le même bloc. */
export type ChampsStructures = {
  max_weight_kg?: number;
  min_weight_kg?: number;
  weight_includes_carrier?: boolean;
  weight_limit_bound?: "lt" | "lte";
  weight_min_bound?: "gt" | "gte";
  carrier_dims_cm?: { l: number; w: number; h: number };
};

/** LE SUJET DÉCLARÉ CONCORDE-T-IL avec le champ structuré ?
 *
 *  *P0 de Codex.* `weight_includes_carrier` ABSENT valait `false`, et « chien seul » s'affichait.
 *  Aucune valeur par défaut n'est plus lue : un sujet attesté exige que le champ le DISE, dans le
 *  même sens ; un sujet non attesté n'exige rien et ne publie rien. */
function desaccordSujet(subject: SujetPese | undefined, champ: boolean | undefined): string | null {
  if (subject === undefined) return null;
  const attendu = subject === "dog_plus_carrier";
  if (champ === undefined) {
    return `l'attestation dit « ${subject} », mais la politique ne porte AUCUN weight_includes_carrier — l'absence ne vaut ni oui ni non`;
  }
  if (champ !== attendu) {
    return `sujet pesé : la politique dit weight_includes_carrier=${String(champ)}, l'attestation « ${subject} »`;
  }
  return null;
}

export function desaccord(claim: Claim, p: ChampsStructures): string | null {
  if (claim.kind === "weight_max") {
    if (p.max_weight_kg !== claim.kg) return `la politique porte max_weight_kg=${String(p.max_weight_kg)}, l'attestation annonce ${claim.kg}`;
    if ((p.weight_limit_bound ?? "lte") !== claim.bound) return `borne du plafond : la politique dit ${p.weight_limit_bound ?? "lte"}, l'attestation ${claim.bound}`;
    return desaccordSujet(claim.subject, p.weight_includes_carrier);
  }
  if (claim.kind === "weight_min") {
    if (p.min_weight_kg !== claim.kg) return `la politique porte min_weight_kg=${String(p.min_weight_kg)}, l'attestation annonce ${claim.kg}`;
    if ((p.weight_min_bound ?? "gte") !== claim.bound) return `borne du plancher : la politique dit ${p.weight_min_bound ?? "gte"}, l'attestation ${claim.bound}`;
    return desaccordSujet(claim.subject, p.weight_includes_carrier);
  }
  const d = p.carrier_dims_cm;
  if (!d) return "la politique ne porte aucune dimension de contenant";
  if (d.l !== claim.l || d.w !== claim.w || d.h !== claim.h) return `dimensions : la politique dit ${d.l}×${d.w}×${d.h}, l'attestation ${claim.l}×${claim.w}×${claim.h}`;
  return null;
}

/** TOUS LES MOTIFS DE REFUS d'un jeu d'attestations, nommés un par un. Vide = tout est rattaché. */
export function motifsDeRefus(
  attestations: readonly Attestation[] | undefined,
  quote: string | undefined,
  champs: ChampsStructures,
): string[] {
  const motifs: string[] = [];
  (attestations ?? []).forEach((a, i) => {
    let provenanceCassee = false;
    for (const f of fragmentsDe(a)) {
      if (!extraitVientDeLaCitation(f, quote)) {
        motifs.push(`attestations[${i}] : le fragment « ${f.slice(0, 60)} » ne se trouve pas dans la citation de ce canal`);
        provenanceCassee = true;
      }
    }
    /* La sémantique n'est demandée que si les fragments viennent bien de la phrase : deux motifs
       sur le même manque diraient deux fois la même chose et cacheraient le vrai. */
    if (!provenanceCassee) {
      if (!memeProposition(fragmentsDe(a), quote)) {
        motifs.push(`attestations[${i}] : les fragments viennent bien de la citation, mais PAS d'une même proposition — ils ne parlent donc pas forcément du même fait`);
      } else {
        const sem = semantiqueAbsente(a);
        if (sem) motifs.push(`attestations[${i}] : ${sem}`);
      }
    }
    const d = desaccord(a.claim, champs);
    if (d) motifs.push(`attestations[${i}] : ${d}`);
  });
  const kinds = (attestations ?? []).map((a) => a.claim.kind);
  if (new Set(kinds).size !== kinds.length) motifs.push("deux attestations portent le même type de fait");
  return motifs;
}

/** LES FAITS RÉELLEMENT ATTESTÉS d'une politique — la seule source de la synthèse localisée.
 *  Rend une liste vide dès qu'un motif de refus existe : on ne publie pas la moitié d'un
 *  rattachement cassé. */
export function faitsAttestes(
  attestations: readonly Attestation[] | undefined,
  quote: string | undefined,
  champs: ChampsStructures,
): Claim[] {
  if (!attestations || attestations.length === 0) return [];
  return motifsDeRefus(attestations, quote, champs).length === 0 ? attestations.map((a) => a.claim) : [];
}

/**
 * LA GARDE ZOD, ÉCRITE UNE FOIS POUR DEUX CONSOMMATEURS — la fiche YAML et l'objet canonique.
 *
 * ERREUR NOMMÉE (11/09/2026). Cette garde n'existait d'abord QUE sur le schéma canonique
 * (`objects.ts`). Les deux contre-épreuves exigées par Codex — permuter la preuve entre deux
 * canaux, ajouter une dimension absente de la citation — ont donc été écrites, lancées… et
 * l'ingestion RÉELLE les a acceptées toutes les deux, en écrivant `objects.json`. Le rattachement
 * n'était en fait relu qu'au chargement du référentiel, c'est-à-dire au build, longtemps après
 * l'écriture, et sans nommer ni la fiche ni le canal fautif.
 *
 * J'avais mesuré la garde par appel direct à `faitsAttestes` et conclu qu'elle mordait. C'est le
 * même défaut que celui déjà nommé le 11/09 sur la fiche portugaise : j'avais vérifié la fonction,
 * pas le chemin que la donnée emprunte vraiment. La garde vit donc ici, en un seul exemplaire, et
 * les deux schémas l'appellent — recopier la règle dans le script d'ingestion aurait recréé la
 * seconde définition que ce dépôt combat depuis `citationComplete`.
 */
export const gardeAttestations = (
  p: { attestations?: unknown; source?: { quote?: string } } & ChampsStructures,
  ctx: { addIssue: (i: { code: "custom"; path: (string | number)[]; message: string }) => void },
): void => {
  for (const m of motifsDeRefus(p.attestations as never, p.source?.quote, p)) {
    ctx.addIssue({ code: "custom", path: ["attestations"], message: m });
  }
};

/**
 * LA GARDE DU SCELLÉ, appelée là où l'identifiant de la compagnie existe — c'est-à-dire sur
 * `Airline`, et non sur la politique, qui ne sait pas à qui elle appartient.
 *
 * Elle rend un motif par attestation non relue. Le message nomme l'empreinte exacte, pour que la
 * relecture humaine n'ait rien à recomposer : il suffit de la lire, de la vérifier contre la page
 * officielle, puis de l'ajouter au scellé avec le sens qu'on lui reconnaît.
 */
export function attestationsNonRelues(
  airlineId: string,
  policy: Record<string, { attestations?: readonly Attestation[]; source?: SourceOpposable & { quote?: string } } | undefined>,
): string[] {
  const motifs: string[] = [];
  for (const placement of ["cabin", "hold", "cargo"]) {
    const d = policy[placement];
    for (const a of d?.attestations ?? []) {
      const e = empreinteAttestation(airlineId, placement, a, d?.source);
      if (!SCELLE.has(e)) {
        motifs.push(`${placement} : attestation NON RELUE par un humain. Le sens du sujet pesé ne se `
          + `déduit pas d'une expression régulière : ajouter cette empreinte à `
          + `raw/attestations-relues.json après lecture de la page officielle —\n           ${e}`);
      }
    }
  }
  return motifs;
}

/** TOUTES LES EMPREINTES RÉELLEMENT PORTÉES par un référentiel — l'autre sens du scellé. */
export function empreintesPortees(
  airlines: Iterable<{ id: string; premium?: { policy?: Record<string, { attestations?: readonly Attestation[]; source?: SourceOpposable & { quote?: string } } | undefined> } }>,
): string[] {
  const vues: string[] = [];
  for (const a of airlines) {
    const pol = a.premium?.policy ?? {};
    for (const placement of ["cabin", "hold", "cargo"]) {
      const d = pol[placement];
      for (const att of d?.attestations ?? []) vues.push(empreinteAttestation(a.id, placement, att, d?.source));
    }
  }
  return vues;
}
