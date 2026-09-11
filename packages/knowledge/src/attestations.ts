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
 * un délai, une autre borne. **Aucun rattachement par expression régulière.**
 *
 * ── LA FORME DU RATTACHEMENT ──────────────────────────────────────────────────────────────────
 * Une attestation dit DEUX choses, et les deux sont vérifiables :
 *   · `claim` — la sémantique COMPLÈTE de ce que la phrase établit : pas « max_weight_kg », mais
 *     « plafond de 8 kg, borne stricte, contenant compris ». Le champ seul ne suffit pas : deux
 *     politiques peuvent porter `max_weight_kg: 8` en voulant dire des choses différentes ;
 *   · `excerpt` — le fragment EXACT de la phrase citée qui l'établit, recopié de la citation.
 *
 * Le second rend le premier contrôlable par une machine sans qu'elle ait rien à deviner :
 * `excerpt` DOIT être une sous-chaîne de `source.quote`. Permuter la preuve entre deux canaux casse
 * ce lien immédiatement. Ajouter une dimension absente de la phrase le casse aussi. C'est ce que
 * les contre-épreuves de sabotage exigent.
 *
 * La `claim` doit en outre CONCORDER avec les champs structurés de la politique : une attestation
 * qui annonce 8 kg sur une politique qui en porte 10 est refusée. Les deux se gardent l'un l'autre.
 */
import { z } from "zod";

/* ---- Ce qu'une phrase peut établir ---------------------------------------------------------- */

/** UN PLAFOND. `bound` distingue « moins de 8 kg » (`lt`) de « jusqu'à 8 kg » (`lte`) : un chien
 *  pesant exactement le plafond est refusé dans le premier cas, accepté dans le second. */
export const ClaimPoidsMax = z.object({
  kind: z.literal("weight_max"),
  kg: z.number().positive(),
  bound: z.enum(["lt", "lte"]),
  /** Le seuil porte-t-il sur le chien SEUL, ou sur le chien AVEC son contenant ? */
  includes_carrier: z.boolean(),
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
  includes_carrier: z.boolean(),
}).strict();

/** LES DIMENSIONS DU CONTENANT. Aucune n'est attestée au 11/09/2026 dans tout le dépôt : les dix
 *  politiques qui portent des dimensions structurées ont toutes une citation qui n'en parle pas. */
export const ClaimDims = z.object({
  kind: z.literal("carrier_dims_cm"),
  l: z.number().positive(), w: z.number().positive(), h: z.number().positive(),
}).strict();

export const Claim = z.discriminatedUnion("kind", [ClaimPoidsMax, ClaimPoidsMin, ClaimDims]);
export type Claim = z.infer<typeof Claim>;

/* ---- L'attestation --------------------------------------------------------------------------- */

export const Attestation = z.object({
  claim: Claim,
  /** LE FRAGMENT EXACT de la citation du canal qui établit ce fait, recopié tel quel.
   *  Dix caractères au moins : « 8 kg » seul ne montre pas ce qu'il qualifie. */
  excerpt: z.string().min(10),
}).strict();
export type Attestation = z.infer<typeof Attestation>;

/** Les espaces et les apostrophes typographiques ne doivent pas faire échouer un rattachement
 *  juste. On normalise les DEUX côtés de la même façon, et rien d'autre : ni casse, ni accents,
 *  ni ponctuation — sans quoi la comparaison cesserait de prouver que le fragment vient bien
 *  de la phrase. */
const normaliser = (s: string) => s.replace(/[  \s]+/g, " ").replace(/[’‘]/g, "'").trim();

/** LE FRAGMENT VIENT-IL DE LA PHRASE ? C'est la garantie mécanique du rattachement. */
export const extraitVientDeLaCitation = (excerpt: string, quote: string | undefined): boolean =>
  typeof quote === "string" && normaliser(quote).includes(normaliser(excerpt));

/** LES NOMBRES QUE PORTE UN FRAGMENT, en jetons distincts.
 *
 *  *Trou refermé le 11/09, trouvé par mon propre sabotage.* La première version de cette garde ne
 *  vérifiait qu'une chose : que l'extrait soit une SOUS-CHAÎNE de la citation. Le sabotage exigé par
 *  Codex — « ajouter une dimension non présente dans la citation doit faire rougir » — passait donc
 *  au vert : j'avais rattaché `46 × 28 × 24 cm` au fragment « sac de transport compris », qui vient
 *  bien de la phrase Air France mais ne dit rien de ces trois nombres. Prouver la PROVENANCE d'un
 *  fragment ne prouve pas qu'il porte le fait. Les deux contrôles sont maintenant distincts.
 *
 *  `17.64` ne contient pas le jeton `8` : les nombres sont découpés, jamais cherchés en sous-chaîne. */
const nombresDe = (s: string): number[] =>
  (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => Number(x.replace(",", ".")));

/** LES VALEURS ANNONCÉES PAR UNE CLAIM — celles que le fragment doit porter. */
const valeursDe = (c: Claim): number[] =>
  c.kind === "carrier_dims_cm" ? [c.l, c.w, c.h] : [c.kg];

/** LE FRAGMENT PORTE-T-IL les nombres qu'il prétend établir ? */
export const extraitPorteLesValeurs = (excerpt: string, claim: Claim): boolean => {
  const vus = nombresDe(excerpt);
  return valeursDe(claim).every((v) => vus.includes(v));
};

/* ---- LA SÉMANTIQUE DU FAIT, LUE DANS LE FRAGMENT ------------------------------------------- */
/**
 * P0 REPRODUIT PAR CODEX SUR `80e3ce6`, ET REFERMÉ ICI — quatre faux verts, un seul défaut.
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
 * La garde prouvait la PRÉSENCE du fragment et la PRÉSENCE du nombre. Aucune des deux ne dit ce que
 * le nombre qualifie ni dans quel sens. Trois exigences s'ajoutent donc, et elles portent sur le
 * fragment lui-même :
 *
 *   · LE NOMBRE EST UN POIDS. La valeur annoncée doit être suivie d'une unité de MASSE MÉTRIQUE
 *     dans le fragment. Une date (`2026-09-08`), un numéro de vol (`AF75`), un âge ou un délai n'en
 *     portent pas — les cas 3 et 4 tombent tous les deux ici.
 *   · LA BORNE EST DITE. Un marqueur de direction compatible avec `bound` doit PRÉCÉDER ce poids,
 *     à portée de lecture. « up to » n'établit pas `lt`, « moins de » n'établit pas `lte`.
 *   · LE SUJET PESÉ EST DIT. `includes_carrier: true` exige un mot de contenant dans le fragment ;
 *     `false` exige qu'il n'y en ait AUCUN — on ne peut pas affirmer qu'un seuil exclut le sac
 *     dans une phrase qui parle du sac.
 *
 * POURQUOI DES MARQUEURS ET NON UNE ANALYSE. Ce n'est pas de la compréhension de texte : c'est une
 * liste FERMÉE de tournures, écrite dans les quatre langues du dépôt, qui REFUSE tout ce qu'elle ne
 * reconnaît pas. Une phrase dont la tournure manque à la liste n'est pas devinée — elle est
 * rejetée, et c'est la relecture humaine qui tranche. Le silence est le défaut, jamais l'accord.
 *
 * LES NÉGATIONS SONT PIÉGÉES EXPRÈS. « no more than 8 kg » contient « more than » : un marqueur de
 * plancher dans une phrase qui dit un plafond. Les marqueurs stricts sont donc refusés dès qu'une
 * négation les précède immédiatement.
 */

/** Casse et accents sont neutralisés POUR CETTE LECTURE SEULEMENT — la garde de provenance, elle,
 *  continue de comparer les fragments accents compris. Ici on cherche des tournures, pas une
 *  identité : « Jusqu'à », « jusqu'a » et « JUSQU'À » disent la même chose. */
const aplatir = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Les unités de MASSE MÉTRIQUE. La valeur d'une claim est en kilogrammes : « 8 lb » ne l'établit
 *  pas, et « 17.64 » ne doit jamais valider un fait qui annonce 8. */
const UNITE_MASSE = "(?:kgs?|kilos?|kilogramm?es?|kilograms?|quilos?)";
/** Les unités de LONGUEUR, pour les dimensions de contenant. */
const UNITE_LONGUEUR = "(?:cm|centimetres?|centimeters?|mm|in|inch|inches|pouces?)";

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

/** Les mots qui désignent le CONTENANT, dans les quatre langues. */
const CONTENANTS = ["carrier", "container", "carry-on bag", "bag", "crate", "kennel", "cage",
  "sac", "sacoche", "caisse", "panier", "contenant", "cabas",
  "transportin", "bolso", "bolsa", "jaula", "caja", "cesta",
  "caixa", "transportadora"];

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
 *  « à portée de lecture » = au plus 40 caractères, sans franchir une fin de proposition. Sans
 *  cette limite, « more than 8 kg … and up to 75 kg » validerait n'importe quelle borne sur
 *  n'importe laquelle de ses deux valeurs. */
const borneEstDite = (plat: string, kg: number, bound: "lt" | "lte" | "gt" | "gte") =>
  MARQUEURS[bound].some((m) => new RegExp(
    `(?<!\\b(?:no|not|non|nao|ne|pas|sans)\\s)${echapper(m)}\\b[^.;:]{0,40}?(?<![\\d.,])${motifNombre(kg)}\\s*${UNITE_MASSE}\\b`,
  ).test(plat));

/** LE FRAGMENT NOMME-T-IL UN CONTENANT ? */
const contenantEstDit = (plat: string) =>
  CONTENANTS.some((c) => new RegExp(`\\b${echapper(c)}\\b`).test(plat));

/** LES TROIS DIMENSIONS, DANS L'ORDRE, AVEC LEUR UNITÉ — rien de moins ne prouve un gabarit. */
const dimensionsSontDites = (plat: string, l: number, w: number, h: number) =>
  new RegExp(`${motifNombre(l)}\\s*[x×]\\s*${motifNombre(w)}\\s*[x×]\\s*${motifNombre(h)}\\s*${UNITE_LONGUEUR}\\b`).test(plat);

/**
 * LA SÉMANTIQUE DU FAIT EST-ELLE DITE PAR LE FRAGMENT ? Rend le motif du refus, ou `null`.
 * Un seul motif est rendu à la fois : le premier manque suffit à éteindre le rattachement.
 */
export function semantiqueAbsente(excerpt: string, claim: Claim): string | null {
  const plat = aplatir(excerpt);
  if (claim.kind === "carrier_dims_cm") {
    return dimensionsSontDites(plat, claim.l, claim.w, claim.h) ? null
      : `l'extrait ne dit pas ${claim.l} × ${claim.w} × ${claim.h} comme des dimensions avec leur unité`;
  }
  if (!valeurEstUnPoids(plat, claim.kg)) {
    return `l'extrait porte bien « ${claim.kg} », mais pas comme un POIDS : aucune unité de masse ne le suit`;
  }
  if (!borneEstDite(plat, claim.kg, claim.bound)) {
    return `l'extrait ne dit pas la borne « ${claim.bound} » devant ${claim.kg} kg — aucune tournure reconnue de la liste fermée`;
  }
  if (claim.includes_carrier && !contenantEstDit(plat)) {
    return `l'attestation annonce un seuil CONTENANT COMPRIS, mais l'extrait ne nomme aucun contenant`;
  }
  if (!claim.includes_carrier && contenantEstDit(plat)) {
    return `l'attestation annonce un seuil sur le chien SEUL, mais l'extrait parle d'un contenant`;
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

export function desaccord(claim: Claim, p: ChampsStructures): string | null {
  if (claim.kind === "weight_max") {
    if (p.max_weight_kg !== claim.kg) return `la politique porte max_weight_kg=${String(p.max_weight_kg)}, l'attestation annonce ${claim.kg}`;
    if ((p.weight_limit_bound ?? "lte") !== claim.bound) return `borne du plafond : la politique dit ${p.weight_limit_bound ?? "lte"}, l'attestation ${claim.bound}`;
    if ((p.weight_includes_carrier ?? false) !== claim.includes_carrier) return `inclusion du contenant : la politique dit ${String(p.weight_includes_carrier ?? false)}, l'attestation ${String(claim.includes_carrier)}`;
    return null;
  }
  if (claim.kind === "weight_min") {
    if (p.min_weight_kg !== claim.kg) return `la politique porte min_weight_kg=${String(p.min_weight_kg)}, l'attestation annonce ${claim.kg}`;
    if ((p.weight_min_bound ?? "gte") !== claim.bound) return `borne du plancher : la politique dit ${p.weight_min_bound ?? "gte"}, l'attestation ${claim.bound}`;
    if ((p.weight_includes_carrier ?? false) !== claim.includes_carrier) return `inclusion du contenant : la politique dit ${String(p.weight_includes_carrier ?? false)}, l'attestation ${String(claim.includes_carrier)}`;
    return null;
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
    if (!extraitVientDeLaCitation(a.excerpt, quote)) {
      motifs.push(`attestations[${i}] : l'extrait « ${a.excerpt.slice(0, 60)} » ne se trouve pas dans la citation de ce canal`);
    }
    if (!extraitPorteLesValeurs(a.excerpt, a.claim)) {
      motifs.push(`attestations[${i}] : l'extrait « ${a.excerpt.slice(0, 60)} » ne porte pas ${valeursDe(a.claim).join(", ")} — un fragment venu de la phrase ne prouve pas pour autant ce fait`);
    } else {
      /* La sémantique n'est demandée que si les nombres sont là : deux motifs sur le même manque
         diraient deux fois la même chose et cacheraient le vrai. */
      const sem = semantiqueAbsente(a.excerpt, a.claim);
      if (sem) motifs.push(`attestations[${i}] : ${sem}`);
    }
    const d = desaccord(a.claim, champs);
    if (d) motifs.push(`attestations[${i}] : ${d}`);
  });
  const kinds = (attestations ?? []).map((a) => a.claim.kind);
  if (new Set(kinds).size !== kinds.length) motifs.push("deux attestations portent le même type de fait");
  return motifs;
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
