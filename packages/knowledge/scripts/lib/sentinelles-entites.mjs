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
  /* RE-FONDÉE SOUS UNE AUTRE FORME (09/09/2026, correctif d'arbitrages) : la décision auditée « undocumented » de Thai
     fret est SUPERSÉDÉE par l'arbitrage (Codex, tranché par Philippe) — `offered` sur la page THAI Cargo. Mesuré : plus
     AUCUNE politique du référentiel réel n'émet `policy_unpublished` ; cette forme-là (« auditée · undocumented ») n'existe
     plus, et on le dit. La même page porte désormais le témoin de la forme qui l'a remplacée : une décision ARBITRÉE sur
     ordre, citée, « accepté sous conditions » — la pastille doit dire la condition, jamais une place. */
  { slug: "thai-airways", id: "airline_thai_airways", placement: "cargo", statut: "accepted_with_conditions", role: "arbitrée sur ordre · citée (THAI Cargo) · jamais une place promise" },
  { slug: "aegean", id: "airline_aegean", placement: "cargo", statut: "confirmation_required", role: "non revérifiée · legacy_unreviewed" },
  /* RE-FONDÉE (08/09/2026, import strict V3) : Air France publie désormais une citation de SOUTE
     (8 à 75 kg chien + contenant) ; sa fiche n'est plus « entièrement à confirmer » et ne peut
     plus témoigner qu'une telle fiche ne publie aucun seuil. Air Canada cabine tient le même
     rôle — politique d'auteur `offered`, page officielle sans phrase citée. Jamais abaissée. */
  /* RE-FONDÉE UNE SECONDE FOIS (08/09/2026, lots 2 et 3) : Air Canada cabine est citée à son tour.
     WestJet cabine tient le rôle — `offered`, page officielle sans phrase citée, aucun canal
     prouvé sur la fiche. */
  /* RE-FONDÉE UNE TROISIÈME FOIS (09/09/2026, lot 4) : WestJet cabine est citée à son tour (« WestJet
     accepts small pets in the cabin… »). Mesuré sur les 102 fiches : United cabine est la SEULE
     politique d'auteur `offered` restante dont la page officielle n'a aucune phrase citée et dont
     la fiche n'a aucun canal prouvé. Le prochain lot qui la citera devra re-fonder ce rôle sur une
     autre forme, ou constater qu'elle n'existe plus — et le dire. */
  /* RE-FONDÉE UNE QUATRIÈME FOIS, SOUS UNE AUTRE FORME (09/09/2026, lot 6) : United cabine est citée
     (« We allow one pet per adult or senior in a reservation. »). Mesuré sur la base projetée : il ne
     reste AUCUNE politique d'auteur `offered` à page officielle sans phrase sur une fiche sans canal
     prouvé — cette forme-là n'existe plus, et on le dit. Les 15 « page officielle sans phrase citée »
     restantes vivent toutes à côté d'un canal prouvé. Le rôle est donc re-fondé sur cette forme :
     United SOUTE — page officielle, aucune phrase citée, « à confirmer » à côté d'une cabine citée.
     Même slug, même page construite ; le statut attendu ne change pas. */
  { slug: "united", id: "airline_united", placement: "hold", statut: "confirmation_required", role: "page officielle sans phrase citée, à côté d'un canal prouvé" },
  /* RE-FONDÉE (09/09/2026, lot 8) : Thai Airways cabine est citée (« As a general policy, we do not accept
     pets in the cabin… ») — un refus PROUVÉ, plus « non prouvé ». Même forme, autre porteuse, mesurée
     sur les 12 cabines « non offertes, non prouvées » de la base projetée : Air China — précisément la
     ligne que le lot 6 a REFUSÉ d'importer (la fiche dit `not_offered`, Codex dit « sous conditions »).
     Tant que l'arbitrage n'est pas rendu, elle est le témoin exact de cette forme. */
  /* RE-FONDÉE (09/09/2026, correctif d'arbitrages) : Air China cabine est désormais citée (arbitrage Codex, tranché par
     Philippe : « sous conditions » sur les vols opérés par Air China). Même forme, autre porteuse, mesurée sur les 10
     cabines « non offertes, non prouvées » restantes : Bangkok Airways — dont Codex a explicitement laissé la cabine
     non décidée (lot 8 : « la source examinée est une page Cargo ; elle ne prouve aucun canal passager »). */
  { slug: "bangkok-airways", id: "airline_bangkok_airways", placement: "cabin", statut: "confirmation_required", role: "non offerte, non prouvée · refus d'auteur sans phrase" },
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
