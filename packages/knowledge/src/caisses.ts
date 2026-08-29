import { z } from "zod";
import { Source, reviewDueFrom } from "./common";
import { SourcedQuote } from "./breed-restrictions";

/**
 * Contrat des CAISSES DE TRANSPORT — schéma seul, sans données.
 * Conception : DOSSIER-TARIFS-PRELANCEMENT.md (v3, feu vert de contre-revue du 29/08/2026).
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * POURQUOI CE CONTRAT EXISTE, ET CE QU'IL INTERDIT
 *
 * Le Flight Finder affichait un montant comme prix du trajet alors qu'il recopiait une chaîne
 * générique. La correction impose de savoir dans quelle TRANCHE de poids tombe l'ensemble
 * « animal + caisse » — donc de connaître le poids d'une caisse. Et c'est exactement là qu'on
 * remplacerait un prix inventé par un POIDS inventé si rien ne s'y opposait.
 *
 * TROIS RÈGLES, chacune tirée d'une faute constatée pendant la conception :
 *
 * 1. UNE SOURCE NE PROUVE PAS UN CHIFFRE. `Source` dit d'où vient une page ; elle ne dit pas que
 *    la dimension enregistrée y figure. Chaque spécification porte donc SA citation et SON
 *    locator. (La v1 du dossier attribuait à une caisse des dimensions que personne n'avait
 *    mesurées : la source était réelle, les chiffres non.)
 *
 * 2. LA VALEUR ORIGINALE D'ABORD, LA CONVERSION ENSUITE. Petmate publie en pouces et en livres,
 *    Ferplast en centimètres et en kilogrammes. On enregistre ce que la page dit, et la valeur
 *    normalisée en est DÉRIVÉE — jamais saisie. Une normalisée qui ne correspond pas à la
 *    conversion de son originale est refusée ici, pas découverte plus tard.
 *
 * 3. LE POIDS EST CELUI QUI EST NOMMÉ « POIDS NET ». Une même page peut exposer, à côté, un poids
 *    d'expédition ou un poids de plateforme marchande. Prendre le premier nombre trouvé serait une
 *    erreur silencieuse ; `champ_source` oblige à nommer le champ retenu.
 *
 * ET UNE RÈGLE SUPÉRIEURE, QUI NE SE DISCUTE PAS : IATA publie des exigences minimales de
 * contenant et déclare explicitement NE CERTIFIER, N'APPROUVER NI NE RECOMMANDER aucune marque ni
 * aucun modèle ; l'acceptation finale appartient à l'opérateur. Aucun champ de ce contrat ne peut
 * porter une homologation, et une déclaration de conformité reste une phrase de fabricant, citée
 * et attribuée.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 */

/** Un nombre de production : strictement positif. Aucun zéro de gabarit dans les données. */
const positif = z.number().positive();

/**
 * `locator` est OPTIONNEL dans le schéma canonique — il ne l'est pas ici. Une spécification sans
 * l'endroit où la lire n'est pas vérifiable par un relecteur : elle demanderait de re-parcourir
 * la page entière, c'est-à-dire de refaire la collecte pour contrôler la collecte.
 */
export const PreuveChiffree = SourcedQuote.refine((s) => typeof s.locator === "string" && s.locator.length > 0, {
  message: "`locator` est obligatoire pour une preuve chiffrée : sans lui, le chiffre n'est pas retrouvable",
  path: ["locator"],
});
export type PreuveChiffree = z.infer<typeof PreuveChiffree>;

export const UniteLongueur = z.enum(["cm", "in"]);
export const UniteMasse = z.enum(["kg", "lb"]);

export const POUCE_EN_CM = 2.54;
export const LIVRE_EN_KG = 0.45359237;

/** La conversion, écrite UNE fois : le schéma la vérifie, le dériveur l'applique. */
export function versCm(valeur: number, unite: z.infer<typeof UniteLongueur>): number {
  return unite === "cm" ? valeur : valeur * POUCE_EN_CM;
}
export function versKg(valeur: number, unite: z.infer<typeof UniteMasse>): number {
  return unite === "kg" ? valeur : valeur * LIVRE_EN_KG;
}
/** Tolérance de comparaison : deux décimales suffisent, et une conversion exacte les tient. */
const proche = (a: number, b: number) => Math.abs(a - b) < 0.005;

export const ValeursOriginales = z.object({
  unite_longueur: UniteLongueur,
  unite_masse: UniteMasse,
  l: positif, w: positif, h: positif,
  poids_a_vide: positif,
  /** Le nom EXACT du champ d'où le poids est tiré, tel que la page le libelle. */
  champ_source: z.string().min(1),
}).strict();

export const ValeursNormalisees = z.object({
  l: positif, w: positif, h: positif, poids_a_vide_kg: positif,
  derive_de: z.literal("conversion mécanique depuis valeurs_originales"),
}).strict();

/**
 * Une déclaration de conformité du fabricant. `attribution` et `condition` vivent DANS
 * L'ENVELOPPE, jamais dans la citation : `SourcedQuote` est `.strict()` et rejetterait tout champ
 * ajouté (mesuré : `unrecognized_keys attribution`).
 *
 * `condition` n'est pas une phrase libre : elle doit être CONTENUE dans la citation, ou n'être pas
 * là. Sans cette contrainte, ce champ deviendrait l'endroit où une nuance s'invente — le fabricant
 * Ferplast, par exemple, subordonne sa déclaration à l'emploi d'un kit de grille, et cette réserve
 * doit venir de sa page, pas de nous.
 */
export const DeclarationFabricant = z.object({
  attribution: z.string().min(1),
  condition: z.string().min(1).optional(),
  citation: PreuveChiffree,
}).strict().refine((d) => d.condition == null || d.citation.quote.includes(d.condition), {
  message: "`condition` doit être contenue mot pour mot dans la citation — une condition reformulée est une condition inventée",
  path: ["condition"],
});

export const ModeleCaisse = z.object({
  id: z.string().regex(/^[a-z0-9]+(_[a-z0-9]+)+$/, "identifiant « fabricant_modele » attendu"),
  fabricant: z.string().min(1),
  modele: z.string().min(1),
  type: z.enum(["rigide", "souple"]),
  materiau: z.string().min(1).optional(),
  specifications: z.object({
    valeurs_originales: ValeursOriginales,
    normalisees_cm_kg: ValeursNormalisees,
    preuve: PreuveChiffree,
  }).strict(),
  declaration_fabricant: DeclarationFabricant.optional(),
}).strict()
  /* LA CONVERSION EST VÉRIFIÉE ICI, pas seulement produite ailleurs : un registre édité à la main
     ne peut pas porter une normalisée qui ne découle pas de son originale. */
  .refine((m) => {
    const o = m.specifications.valeurs_originales, n = m.specifications.normalisees_cm_kg;
    return proche(n.l, versCm(o.l, o.unite_longueur)) && proche(n.w, versCm(o.w, o.unite_longueur))
      && proche(n.h, versCm(o.h, o.unite_longueur))
      && proche(n.poids_a_vide_kg, versKg(o.poids_a_vide, o.unite_masse));
  }, { message: "les valeurs normalisées ne sont pas la conversion des valeurs originales", path: ["specifications", "normalisees_cm_kg"] })
  /* `review_due` est DÉRIVÉE de la cadence « equipment » (365 j), jamais tapée à la main. */
  .refine((m) => m.specifications.preuve.review_due === reviewDueFrom(m.specifications.preuve.verified_date, "equipment"), {
    message: "`review_due` doit être reviewDueFrom(verified_date, « equipment »)", path: ["specifications", "preuve", "review_due"],
  });
export type ModeleCaisse = z.infer<typeof ModeleCaisse>;

/**
 * UN PROFIL PUBLIE UN POIDS OU IL N'EN PUBLIE PAS. La règle vient de l'arbitrage : deux à quatre
 * modèles, dont au moins DEUX FABRICANTS DISTINCTS. Un seul fabricant décrit sa gamme, pas le
 * marché ; et un champ de confiance ne remplace pas des observations manquantes.
 *
 * AUCUNE ENVELOPPE DE DIMENSIONS. Prendre séparément les minima et maxima de longueur, largeur et
 * hauteur fabriquerait une caisse composite qu'aucun fabricant ne vend, et l'adéquation d'un chien
 * s'y jugerait contre un objet inexistant. Les dimensions restent PAR MODÈLE ; seul le poids à
 * vide s'agrège.
 */
export const ProfilCaisse = z.object({
  id: z.string().regex(/^[a-z]+_[a-z0-9]+$/, "identifiant « type_taille » attendu (ex. rigide_xl)"),
  modeles: z.array(z.string()).max(4),
  publiable: z.boolean(),
  poids_kg: z.object({
    min: positif, max: positif,
    arrondi: z.tuple([positif, positif]),
    derive_de: z.literal("min/max des poids à vide normalisés des modèles cités"),
  }).strict().optional(),
}).strict()
  .refine((p) => !p.publiable || (p.modeles.length >= 2 && p.poids_kg != null), {
    message: "un profil publiable exige au moins deux modèles et un intervalle dérivé", path: ["publiable"],
  })
  .refine((p) => p.publiable || p.poids_kg == null, {
    message: "un profil NON publiable ne porte aucun poids : un intervalle présent serait affiché tôt ou tard",
    path: ["poids_kg"],
  })
  .refine((p) => p.poids_kg == null || p.poids_kg.min <= p.poids_kg.max, {
    message: "intervalle inversé", path: ["poids_kg"],
  });
export type ProfilCaisse = z.infer<typeof ProfilCaisse>;

/**
 * La correspondance race → profils est une HYPOTHÈSE MyDogCanFly, et le champ le dit. Sans les
 * mesures réelles du chien — que la méthode de dimensionnement exige —, elle ne peut jamais être
 * présentée comme une certitude. Plusieurs profils adjacents valent mieux qu'une fausse précision.
 */
export const CorrespondanceRace = z.object({
  breed_id: z.string().min(1),
  profils_probables: z.array(z.string()).min(1),
  methode: z.string().min(1),
  confiance: z.number().int().min(1).max(5),
  nature: z.literal("hypothèse MyDogCanFly — les mesures réelles du chien priment"),
}).strict();
export type CorrespondanceRace = z.infer<typeof CorrespondanceRace>;

/* Le commentaire de tête est DÉCLARÉ : les registres sont `.strict()`, et une prose qui
   explique le fichier ne doit pas se faire refuser — ni passer par un trou laissé ouvert. */
const commentaire = z.string().min(1);
export const RegistreModeles = z.object({ schema: z.literal(1), _commentaire: commentaire, modeles: z.array(ModeleCaisse) }).strict();
export const RegistreProfils = z.object({ schema: z.literal(1), _commentaire: commentaire, profils: z.array(ProfilCaisse) }).strict();
export const RegistreCorrespondances = z.object({ schema: z.literal(1), _commentaire: commentaire, correspondances: z.array(CorrespondanceRace) }).strict();

/**
 * LA DÉRIVATION — la seule façon dont un intervalle de profil peut naître.
 * Rend `{ profil }` ou `{ refus }` : un profil qui ne peut pas publier le dit, il ne devine pas.
 */
export function deriverProfil(id: string, modeles: ModeleCaisse[]): { profil: ProfilCaisse } | { refus: string } {
  if (modeles.length < 2) return { refus: `${id} : ${modeles.length} modèle(s) — deux au minimum pour publier un intervalle` };
  if (modeles.length > 4) return { refus: `${id} : ${modeles.length} modèles — quatre au maximum, au-delà l'intervalle cesse d'être lisible` };
  const fabricants = new Set(modeles.map((m) => m.fabricant.toLowerCase()));
  if (fabricants.size < 2) {
    return { refus: `${id} : un seul fabricant (${[...fabricants][0]}) — un fabricant décrit sa gamme, pas le marché` };
  }
  const poids = modeles.map((m) => m.specifications.normalisees_cm_kg.poids_a_vide_kg);
  const min = Math.min(...poids), max = Math.max(...poids);
  return {
    profil: {
      id, modeles: modeles.map((m) => m.id), publiable: true,
      poids_kg: { min, max, arrondi: [Math.floor(min), Math.ceil(max)],
                  derive_de: "min/max des poids à vide normalisés des modèles cités" },
    },
  };
}

/**
 * L'INTERVALLE « ANIMAL + CAISSE », et ses trois issues.
 * `poidsChienSaisi` : le poids DONNÉ par le visiteur. Un poids déduit de la race ne peut pas
 * ouvrir un calcul monétaire — les 172 poids de race sont des valeurs ponctuelles, sans la
 * provenance qu'un chiffre affiché comme tarif exigerait.
 */
export function intervalleTotal(
  poidsChienSaisi: number | null,
  caisse: { min: number; max: number } | null,
): { total: [number, number] } | { refus: string } {
  if (poidsChienSaisi == null) return { refus: "poids du chien non saisi : aucune estimation numérique" };
  if (!(poidsChienSaisi > 0)) return { refus: "poids du chien invalide" };
  if (caisse == null) return { refus: "aucun poids de caisse disponible : ni saisi, ni profil publiable" };
  return { total: [poidsChienSaisi + caisse.min, poidsChienSaisi + caisse.max] };
}

/**
 * Une tranche couvre-t-elle TOUT l'intervalle ? C'est la seule condition qui autorise une
 * estimation. Si l'intervalle traverse la limite, il n'y a pas de « valeur la plus probable » :
 * il y a deux réponses possibles, et le dire est la seule honnête.
 */
export function trancheUnique(total: [number, number], limites: number[]): { couverte: true } | { traverse: number } {
  for (const limite of [...limites].sort((a, b) => a - b)) {
    if (total[0] <= limite && limite < total[1]) return { traverse: limite };
  }
  return { couverte: true };
}

/** Le contrat de provenance réutilisé, ré-exporté pour que les registres n'en inventent pas d'autre. */
export { Source, SourcedQuote };
