/**
 * LES PAGES D'ENTITÉS SENTINELLES — une seule liste, deux consommateurs.
 *
 * `build-ci.mjs` les CONSTRUIT, `test-entity-pages-harness.mjs` les LIT. Écrire la liste deux
 * fois, c'est se garantir qu'un jour le harnais cherchera une page que le build n'aura pas
 * produite — et qu'il échouera « faute de matière » au lieu de mesurer quelque chose.
 *
 * POURQUOI CELLES-CI. Chacune couvre une FORME DE DÉCISION distincte, telle qu'elle existe
 * RÉELLEMENT dans les données :
 *   · refus PROUVÉ        → British Airways, cabine   (`denied`, sur citation stricte)
 *   · source AUDITÉE      → Thai Airways, fret        (`confirmation_required`, avec preuve)
 *   · sans source         → Aegean, fret              (`confirmation_required`, SANS preuve)
 *   · politique d'auteur  → Air France, cabine        (`confirmation_required` depuis la frontière)
 *   · non offerte         → Thai Airways, cabine      (`confirmation_required` depuis la frontière)
 *
 * MOUVEMENT NOMMÉ (05/09/2026). Air France cabine portait `allowed` et Thai Airways cabine
 * `denied` : depuis la frontière de confiance, aucune politique n'est `allowed`, et `denied` ne
 * s'obtient que sur une phrase citée. Les deux valent donc `confirmation_required`. La couverture
 * d'un VRAI refus n'est pas perdue pour autant — elle passe à British Airways cabine, seule
 * décision du dépôt fondée sur une citation stricte. La branche `allowed`, elle, n'a plus aucun
 * porteur réel : elle est éprouvée par un témoin SYNTHÉTIQUE nommé, dans le harnais, et jamais
 * par une page du site.
 *
 * `case_by_case` n'a aucun porteur dans les données (0 politique) : lui donner une sentinelle
 * reviendrait à tester une fixture, pas le site.
 *
 * La page pays est là pour `CountryOnward`, le second composant qui appelle `mdcfQuery()` — la
 * fonction dont l'absence produisait l'erreur de console relevée au contre-test du 15/08/2026.
 */

/** Les décisions observées, sur quatre fiches. */
export const SENTINELLES_COMPAGNIES = [
  { slug: "thai-airways", id: "airline_thai_airways", placement: "cargo", statut: "confirmation_required", role: "auditée · undocumented" },
  { slug: "aegean", id: "airline_aegean", placement: "cargo", statut: "confirmation_required", role: "non revérifiée · legacy_unreviewed" },
  { slug: "air-france", id: "airline_air_france", placement: "cabin", statut: "confirmation_required", role: "politique d'auteur, non prouvée" },
  { slug: "thai-airways", id: "airline_thai_airways", placement: "cabin", statut: "confirmation_required", role: "non offerte, non prouvée" },
  { slug: "british-airways", id: "airline_british_airways", placement: "cabin", statut: "denied", role: "refus PROUVÉ · citation stricte" },
];

/** La page pays sentinelle — France, dont le guide est complet dans les quatre langues. */
export const SENTINELLE_PAYS = { slug: "fr", id: "country_fr" };

/** Les familles de routes à construire, et les slugs à y garder — format `BUILD_SLUGS`. */
export const BUILD_ONLY_SENTINELLES = "airlines,countries";
export const BUILD_SLUGS_SENTINELLES = [
  ...new Set(SENTINELLES_COMPAGNIES.map((s) => `airlines:${s.slug}`)),
  `countries:${SENTINELLE_PAYS.slug}`,
].join(",");
