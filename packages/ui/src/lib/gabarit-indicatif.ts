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
 * LA TABLE N'EST PAS INVENTÉE ICI. Codex prépare la correspondance et ses limites ; tant qu'elle n'est pas
 * livrée, `classes` est VIDE, `gabaritPour` rend `null`, et l'interface n'affiche aucun gabarit — seulement
 * les dimensions. Aucun seuil silencieux : la version le dit.
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

/** LA TABLE, VIDE TANT QUE CODEX NE L'A PAS LIVRÉE. Remplir `classes` est un mouvement nommé, avec sa version. */
export const TABLE_GABARIT_INDICATIF: TableGabaritIndicatif = {
  nature: "indicatif",
  auteur: "MyDogCanFly",
  version: "0 — table attendue (Codex prépare la correspondance et ses limites, 09/09/2026)",
  note: "Repère commercial non normalisé. Les appellations varient selon les fabricants : vérifier toujours les dimensions intérieures du modèle choisi.",
  classes: [],
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
