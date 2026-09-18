/**
 * L'ÉTAT TARIFAIRE D'UN CANAL — une seule dérivation, pour le Finder comme pour la fiche.
 *
 * POURQUOI CE MODULE EXISTE (18/09/2026, demande de Philippe, point 4). Jusqu'ici, tout ce qui
 * n'était pas un montant ferme finissait sous le même libellé : « tarif à confirmer ». Or « la
 * compagnie facture au barème de l'excédent de bagages » (Tunisair), « le prix n'apparaît qu'à la
 * réservation », « sur devis » et « nous n'avons pas encore vérifié » sont QUATRE situations
 * différentes, dont trois sont parfaitement connues et sourcées. Les confondre revenait à jeter de
 * l'information que le contrat tarifaire avait pris la peine d'établir.
 *
 * CE QUE CE MODULE FAIT, ET CE QU'IL NE FAIT PAS. Il classe, il ne calcule rien : aucune
 * conversion de devise, aucune sélection de zone, aucune décision d'applicabilité à un trajet.
 * Il reçoit la politique canonique d'un canal — celle-là même dont le moteur tire les cartes du
 * Finder — et rend un état, plus la liste des mécanismes publiés. L'interface traduit ; elle
 * n'invente pas d'état.
 *
 * POURQUOI IL VIT DANS `knowledge` ET NON DANS L'INTERFACE. Parce que la fiche (page statique
 * Astro) et le Finder (composant client lisant le rapport du Worker) doivent répondre la même
 * chose sur la même donnée. Une dérivation dupliquée aurait dérivé ; celle-ci est importée des
 * deux côtés, et un test l'exige.
 */

/** Les natures de prix qui portent un montant — reprises du contrat, jamais redéfinies ici. */
const AVEC_MONTANT_FERME = new Set(["exact", "matrix"]);
const AVEC_MONTANT_BORNE = new Set(["minimum", "range"]);

export type EtatTarifaire =
  /** Le canal est refusé : il n'y a pas de tarif à montrer, et en montrer un serait un contresens. */
  | "canal_refuse"
  /** Deux pages officielles vivantes se contredisent : aucun montant exact n'est publiable. */
  | "conflit"
  /** Un ou plusieurs montants fermes, publiés et cités. */
  | "publie"
  /** Un plancher (« à partir de ») ou une fourchette, publiés et cités. */
  | "plancher_ou_fourchette"
  /** La compagnie renvoie à son calculateur officiel : le prix existe, il n'est pas un nombre ici. */
  | "calculateur"
  /** La compagnie publie la RÈGLE de calcul (poids, excédent de bagages) et non le chiffre. */
  | "bareme"
  /** Le montant n'apparaît qu'au moment de la réservation. */
  | "a_la_reservation"
  /** Fret ou transport sur devis. */
  | "sur_devis"
  /** Vérifié : la compagnie ne publie aucun montant, et la citation le prouve. */
  | "aucun_montant_publie"
  /** Rien n'est encore établi de notre côté. C'est un aveu, pas une description de la compagnie. */
  | "non_verifie";

/** Les mécanismes publiés, cumulables : un canal peut porter une grille ET un devis. */
export type MecanismeTarifaire = "calculateur" | "bareme" | "a_la_reservation" | "sur_devis";

export interface LectureTarifaire {
  etat: EtatTarifaire;
  /** Les mécanismes publiés, dans l'ordre du contrat ; vide quand il n'y en a pas. */
  mecanismes: MecanismeTarifaire[];
  /** Vrai quand un conflit éteint les montants exacts — le Finder et la fiche s'alignent dessus. */
  montantsExactsSupprimes: boolean;
}

type PriceLike = { kind?: string; amounts?: readonly unknown[] };
type FareLike = { price?: PriceLike };
/* DEUX VOCABULAIRES POUR UN SEUL FAIT, et il faut les connaître tous les deux (18/09/2026).
   La forme ÉCRITE dans les fiches dit `availability: not_offered` ; la forme RUNTIME, après
   `normalize`, dit `status: denied` et ne porte plus `availability` du tout. La fiche lit la
   seconde, les scripts de contrôle lisent souvent la première. N'en reconnaître qu'une faisait
   passer un canal refusé pour un canal « pas encore vérifié » — relevé sur Eurowings, dont la
   soute et le fret affichaient un état tarifaire là où il ne doit rien y avoir. */
const REFUS = new Set(["not_offered", "denied"]);

type PolitiqueLike = {
  availability?: string;
  status?: string;
  allowed?: boolean;
  fares?: readonly FareLike[];
  fare_conflicts?: readonly unknown[];
  /** Preuve que la page officielle a été lue et ne porte aucun montant (champ optionnel du schéma). */
  no_published_fare?: unknown;
};

const MECANISMES: ReadonlyArray<[string, MecanismeTarifaire]> = [
  ["calculator", "calculateur"],
  ["formula", "bareme"],
  ["booking_only", "a_la_reservation"],
  ["quote", "sur_devis"],
];

/**
 * LA DÉRIVATION. L'ordre des tests est l'ordre des priorités, et il est délibéré :
 *   1. un canal refusé n'a pas de tarif, quoi que porte le reste ;
 *   2. un conflit prime sur les montants qu'il éteint ;
 *   3. un montant ferme prime sur un plancher, qui prime sur un mécanisme ;
 *   4. l'absence de tarif se dit « non vérifié », sauf preuve explicite du contraire.
 */
export function lireEtatTarifaire(politique: PolitiqueLike | null | undefined): LectureTarifaire {
  const vide: LectureTarifaire = { etat: "non_verifie", mecanismes: [], montantsExactsSupprimes: false };
  if (!politique) return vide;

  if (REFUS.has(politique.availability ?? "") || REFUS.has(politique.status ?? "")) {
    return { etat: "canal_refuse", mecanismes: [], montantsExactsSupprimes: false };
  }

  const tarifs = politique.fares ?? [];
  const natures = new Set(tarifs.map((f) => f.price?.kind).filter((k): k is string => !!k));
  const mecanismes = MECANISMES.filter(([kind]) => natures.has(kind)).map(([, m]) => m);

  const conflits = politique.fare_conflicts ?? [];
  if (conflits.length > 0) {
    return { etat: "conflit", mecanismes, montantsExactsSupprimes: true };
  }

  const aUnMontant = (ensemble: ReadonlySet<string>) =>
    tarifs.some((f) => ensemble.has(f.price?.kind ?? "") && (f.price?.amounts?.length ?? 0) > 0);

  if (aUnMontant(AVEC_MONTANT_FERME)) return { etat: "publie", mecanismes, montantsExactsSupprimes: false };
  if (aUnMontant(AVEC_MONTANT_BORNE)) return { etat: "plancher_ou_fourchette", mecanismes, montantsExactsSupprimes: false };
  if (mecanismes.length > 0) return { etat: mecanismes[0], mecanismes, montantsExactsSupprimes: false };
  if (politique.no_published_fare) return { etat: "aucun_montant_publie", mecanismes: [], montantsExactsSupprimes: false };
  return vide;
}

/** La clé de libellé, pour que l'interface traduise sans réinventer la nomenclature. */
export const CLE_LIBELLE_TARIF: Record<EtatTarifaire, string> = {
  canal_refuse: "fare.state.refused",
  conflit: "fare.state.conflict",
  publie: "fare.state.published",
  plancher_ou_fourchette: "fare.state.range",
  calculateur: "fare.state.calculator",
  bareme: "fare.state.formula",
  a_la_reservation: "fare.state.booking_only",
  sur_devis: "fare.state.quote",
  aucun_montant_publie: "fare.state.none_published",
  non_verifie: "fare.state.unverified",
};
