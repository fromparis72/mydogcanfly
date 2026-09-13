import type { NormalizedKB } from "@mydogcanfly/knowledge";

/* L'état de connaissance d'une fiche de race, en un seul endroit.
 *
 * POURQUOI CE FICHIER. Même raison que `reliefEtat.ts`, et le même piège : trois consommateurs
 * — le gabarit de la fiche (`noindex`), le sitemap (inclure ou non l'URL) et l'index des races —
 * doivent répondre exactement la même chose. Une règle écrite trois fois finit par dire
 * « indexable » d'un côté pendant qu'elle retire l'URL de l'autre, ce que Google rapporte
 * ensuite comme « exclue par une balise noindex » tout en la trouvant au sitemap.
 *
 * CE QUI A ÉTÉ MESURÉ, le 13/09/2026, et qui motive cette porte. Deux fiches de race prises au
 * hasard — Berger australien et Beagle — ont été comparées caractère par caractère, hors
 * navigation : 520 mots de corps, et 144 caractères de différence sur 3 195, soit 4,5 %. Ce
 * delta se résume au nom de la race et à un chiffre de poids. Sur 173 races × 4 langues, cela
 * fait 692 URL que Google explore et refuse : les fiches les plus touchées par « explorée,
 * actuellement non indexée » sont précisément celles-là.
 *
 * ET POURQUOI CE N'EST PAS UN DÉFAUT DU GABARIT. Ces pages étaient différentes il y a deux
 * semaines. Le retrait de la série de caisses (02/09), celui des indicateurs physiologiques
 * (06/09) et la frontière de confiance (04/09), qui a vidé `bestAirlines` faute d'une seule
 * politique établie, ont ôté l'un après l'autre tout ce qui distinguait une race d'une autre.
 * Chacun de ces retraits était juste. Leur effet cumulé est 173 pages qui se ressemblent, et
 * une page qui ne dit rien de propre n'a rien à faire dans un index de recherche.
 *
 * LA RÈGLE. Est indexable la fiche qui porte, sur la race elle-même, au moins un fait établi
 * par le registre canonique `breedRestrictions` — un fait SOURCÉ, daté, et affiché sur la page.
 * Aujourd'hui cela désigne les races brachycéphales, couvertes par la règle IATA du registre :
 * elles sont les seules dont la fiche affiche une section qui n'existe pas ailleurs.
 *
 * CE QUI N'EST PAS FAIT ICI, et qu'il faut lire comme une promesse et non comme un oubli : les
 * autres races ne sont ni supprimées, ni retirées du site, ni sorties du Finder, ni coupées du
 * maillage. Elles restent atteignables, utilisables, et listées dans l'index des races. Elles
 * cessent seulement d'être proposées en réponse à une recherche, le temps que le sourcing leur
 * rende quelque chose à dire. Le jour où un fait de race entre au registre, la fiche
 * correspondante revient au sitemap sans qu'une ligne de ce fichier ne change : la porte lit le
 * registre, elle ne tient pas de liste.
 */

/** Les traits que le registre sait porter aujourd'hui, et que la fiche sait afficher. */
type Trait = "brachycephalic";

const traitDeLaRace = (breed: any, trait: Trait): boolean =>
  trait === "brachycephalic" ? !!breed?.brachycephalic : false;

/**
 * Les faits du registre qui s'appliquent à CETTE race — par son identifiant, ou par un trait
 * qu'elle porte. Sert la porte d'indexation et l'affichage de la source sur la fiche : une
 * seule lecture, donc aucun risque que la page cite ce que la porte ignore, ou l'inverse.
 */
export function faitsDeRace(kb: NormalizedKB, breed: any): any[] {
  return (kb.breedRestrictions ?? []).filter((r: any) => {
    const a = r?.applies_to ?? {};
    if (a.breed_id) return a.breed_id === breed?.id;
    if (a.trait) return traitDeLaRace(breed, a.trait as Trait);
    return false;
  });
}

/** Indexable si, et seulement si, la fiche porte un fait établi PROPRE à cette race. */
export function raceIndexable(kb: NormalizedKB, breed: any): boolean {
  return faitsDeRace(kb, breed).length > 0;
}
