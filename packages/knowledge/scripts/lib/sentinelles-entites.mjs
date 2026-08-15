/**
 * LES PAGES D'ENTITÉS SENTINELLES — une seule liste, deux consommateurs.
 *
 * `build-ci.mjs` les CONSTRUIT, `test-entity-pages-harness.mjs` les LIT. Écrire la liste deux
 * fois, c'est se garantir qu'un jour le harnais cherchera une page que le build n'aura pas
 * produite — et qu'il échouera « faute de matière » au lieu de mesurer quelque chose.
 *
 * POURQUOI CELLES-CI. Chacune couvre une FORME DE DÉCISION distincte du contrat T0-B2, pas un
 * cas signalé :
 *   · `offered`            → Air France, cabine        (statut `allowed`)
 *   · `not_offered`        → Thai Airways, cabine      (statut `denied`)
 *   · `undocumented`       → Thai Airways, fret        (`confirmation_required`, source AUDITÉE)
 *   · `legacy_unreviewed`  → Aegean, fret              (`confirmation_required`, SANS source)
 * `case_by_case` n'a aucun porteur dans les données (0 politique) : lui donner une sentinelle
 * reviendrait à tester une fixture, pas le site.
 *
 * La page pays est là pour `CountryOnward`, le second composant qui appelle `mdcfQuery()` — la
 * fonction dont l'absence produisait l'erreur de console relevée au contre-test du 15/08/2026.
 */

/** Les quatre décisions observées, sur trois fiches. */
export const SENTINELLES_COMPAGNIES = [
  { slug: "thai-airways", id: "airline_thai_airways", placement: "cargo", statut: "confirmation_required", role: "auditée · undocumented" },
  { slug: "aegean", id: "airline_aegean", placement: "cargo", statut: "confirmation_required", role: "non revérifiée · legacy_unreviewed" },
  { slug: "air-france", id: "airline_air_france", placement: "cabin", statut: "allowed", role: "offerte · offered" },
  { slug: "thai-airways", id: "airline_thai_airways", placement: "cabin", statut: "denied", role: "non offerte · not_offered" },
];

/** La page pays sentinelle — France, dont le guide est complet dans les quatre langues. */
export const SENTINELLE_PAYS = { slug: "fr", id: "country_fr" };

/** Les familles de routes à construire, et les slugs à y garder — format `BUILD_SLUGS`. */
export const BUILD_ONLY_SENTINELLES = "airlines,countries";
export const BUILD_SLUGS_SENTINELLES = [
  ...new Set(SENTINELLES_COMPAGNIES.map((s) => `airlines:${s.slug}`)),
  `countries:${SENTINELLE_PAYS.slug}`,
].join(",");
