/**
 * GABARIT INDICATIF DE CAGE — micro-lot isolé (Philippe, sur proposition de Codex, 09/09/2026).
 *
 * Trois informations DISTINCTES sortent du calculateur, et ce module porte les deux dernières :
 *   1. `dimensions_minimales`  — le résultat de la méthode de dimensionnement publiée (calculé dans le
 *      composant depuis les mesures RÉELLES du chien : rien ici n'est déduit de la race seule) ;
 *   2. `dimensions_conseillees` — les minimales plus la marge MyDogCanFly, NOTRE recommandation, jamais
 *      présentée comme une exigence de la méthode publiée ;
 *   3. `gabarit_indicatif`     — S, M, L, XL ou XXL, repère COMMERCIAL non normalisé, dérivé des dimensions
 *      conseillées par une table MyDogCanFly explicitement indicative.
 *
 * LA TABLE N'EST PAS INVENTÉE ICI. Livrée par Codex le 09/09/2026 (« Gabarit indicatif MyDogCanFly »),
 * transmise et confirmée par Philippe, elle est une classification INTERNE, explicitement nommée : un repère
 * de recherche, pas la description d'un produit réellement disponible. Le classement se fait sur les dimensions
 * CONSEILLÉES (avec la marge MyDogCanFly), jamais sur la race ni sur le poids ; les trois dimensions doivent
 * entrer dans l'enveloppe, et si UNE seule la dépasse, on passe au gabarit suivant. Au-delà de XXL : « très
 * grand format / solution à rechercher », jamais un gabarit par défaut. Version 0 (table vide, micro-lot du
 * même jour) → version 1 : mouvement nommé, avec ses témoins aux frontières.
 *
 * CE QUI NE REVIENT PAS : les codes 100–700 (nomenclature de fabricant, retirés le 05/09/2026), toute
 * prétention qu'une cage satisferait une norme (le motif de l'inventaire interdit même les mots dans les
 * surfaces applicatives — cette phrase les évite à dessein), une estimation fondée sur la race seule,
 * une correspondance avec un modèle commercial non sourcé.
 */
export type CodeGabarit = "S" | "M" | "L" | "XL" | "XXL";
export const ORDRE_GABARITS: readonly CodeGabarit[] = ["S", "M", "L", "XL", "XXL"];

export interface Dimensions { l: number; w: number; h: number }

/** Une classe de la table : le gabarit convient si les trois dimensions conseillées tiennent sous ses maxima intérieurs. */
export interface ClasseGabarit { code: CodeGabarit; max_l_cm: number; max_w_cm: number; max_h_cm: number }

export interface TableGabaritIndicatif {
  nature: "indicatif";
  auteur: "MyDogCanFly";
  /** Version lisible : dit si la table est livrée ou attendue. */
  version: string;
  note: string;
  classes: ClasseGabarit[];
}

/** LA MARGE MYDOGCANFLY (cm, sur chaque dimension) : la nôtre, pas un chiffre de la méthode publiée.
 *  Elle reprend la borne haute du conseil déjà affiché par le calculateur (« 2–3 cm de marge de confort »). */
export const MARGE_CONSEILLEE_CM = 3;

/** LA TABLE « GABARIT INDICATIF MYDOGCANFLY » — version 1, livrée par Codex le 09/09/2026 (version 0 : vide).
 *  Enveloppe intérieure conseillée MAXIMALE par gabarit (L × l × H, cm). Un repère de recherche, pas un produit. */
export const TABLE_GABARIT_INDICATIF: TableGabaritIndicatif = {
  nature: "indicatif",
  auteur: "MyDogCanFly",
  version: "1 — table « Gabarit indicatif MyDogCanFly » livrée par Codex, confirmée par Philippe (09/09/2026)",
  note: "Repère de recherche non normalisé, pas la description d'un produit disponible. Les appellations et dimensions varient selon les fabricants : vérifier les dimensions intérieures et faire confirmer le modèle par la compagnie.",
  classes: [
    { code: "S",   max_l_cm: 60,  max_w_cm: 40, max_h_cm: 45 },
    { code: "M",   max_l_cm: 75,  max_w_cm: 50, max_h_cm: 55 },
    { code: "L",   max_l_cm: 90,  max_w_cm: 60, max_h_cm: 65 },
    { code: "XL",  max_l_cm: 105, max_w_cm: 70, max_h_cm: 75 },
    { code: "XXL", max_l_cm: 120, max_w_cm: 80, max_h_cm: 90 },
  ],
};

/** Les dimensions conseillées : les minimales calculées, plus la marge MyDogCanFly sur chaque dimension. */
export function dimensionsConseillees(min: Dimensions, marge: number = MARGE_CONSEILLEE_CM): Dimensions {
  return { l: min.l + marge, w: min.w + marge, h: min.h + marge };
}

/** Le premier gabarit, dans l'ordre S → XXL, dont les maxima intérieurs contiennent les dimensions conseillées.
 *  `null` si la table est vide, si une classe est mal formée, ou si aucune classe ne convient (chien trop grand
 *  pour la table) — jamais un gabarit « par défaut ». */
export function gabaritPour(conseillees: Dimensions, table: TableGabaritIndicatif = TABLE_GABARIT_INDICATIF): CodeGabarit | null {
  if (!table || table.nature !== "indicatif" || !Array.isArray(table.classes) || table.classes.length === 0) return null;
  const rang = (c: CodeGabarit) => ORDRE_GABARITS.indexOf(c);
  const classes = table.classes.filter((c) => rang(c.code) >= 0 && [c.max_l_cm, c.max_w_cm, c.max_h_cm].every((x) => Number.isFinite(x) && x > 0))
    .sort((a, b) => rang(a.code) - rang(b.code));
  if (classes.length !== table.classes.length) return null;
  for (const c of classes) {
    if (conseillees.l <= c.max_l_cm && conseillees.w <= c.max_w_cm && conseillees.h <= c.max_h_cm) return c.code;
  }
  return null;
}

/** LE CLASSEMENT, À TROIS ÉTATS DISTINCTS — l'interface ne doit pas confondre « table absente » et « chien
 *  plus grand que XXL » : le premier n'affiche rien, le second affiche « très grand format / solution à
 *  rechercher ». `gabarit` porte le code quand il existe, `null` sinon. */
export type ClassementGabarit =
  | { etat: "table_absente"; gabarit: null }
  | { etat: "gabarit"; gabarit: CodeGabarit }
  | { etat: "au_dela"; gabarit: null };

export function classerGabarit(conseillees: Dimensions, table: TableGabaritIndicatif = TABLE_GABARIT_INDICATIF): ClassementGabarit {
  const tableValide = !!table && table.nature === "indicatif" && Array.isArray(table.classes) && table.classes.length > 0
    && table.classes.every((c) => ORDRE_GABARITS.includes(c.code) && [c.max_l_cm, c.max_w_cm, c.max_h_cm].every((x) => Number.isFinite(x) && x > 0));
  if (!tableValide) return { etat: "table_absente", gabarit: null };
  const code = gabaritPour(conseillees, table);
  return code ? { etat: "gabarit", gabarit: code } : { etat: "au_dela", gabarit: null };
}
