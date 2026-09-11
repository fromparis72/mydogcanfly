/**
 * LES PAGES D'ENTITÉS SENTINELLES — une seule liste, deux consommateurs.
 *
 * `build-ci.mjs` les CONSTRUIT, `test-entity-pages-harness.mjs` les LIT. Écrire la liste deux
 * fois, c'est se garantir qu'un jour le harnais cherchera une page que le build n'aura pas
 * produite — et qu'il échouera « faute de matière » au lieu de mesurer quelque chose.
 *
 * POURQUOI CELLES-CI. Chacune couvre une FORME DE DÉCISION distincte, telle qu'elle existe
 * RÉELLEMENT dans les données. La liste ci-dessous est relue du tableau, jamais de mémoire :
 *   · arbitrée sur ordre  → Thai Airways, fret        (`accepted_with_conditions`, citée)
 *   · sans source         → Aegean, fret              (`confirmation_required`, SANS preuve)
 *   · page sans phrase    → United, soute             (`confirmation_required`, à côté d'un canal prouvé)
 *   · non offerte         → Bangkok Airways, cabine   (`confirmation_required`, refus d'auteur sans phrase)
 *   · refus PROUVÉ        → British Airways, cabine   (`denied`, sur citation stricte)
 *   · fait ATTESTÉ        → Air France, cabine ET soute (`accepted_with_conditions`, synthèse localisée)
 *
 * ERREUR NOMMÉE (11/09/2026). Ce sommaire avait DÉRIVÉ du tableau : il annonçait encore Thai
 * Airways fret « auditée », Air France cabine « politique d'auteur » et Thai Airways cabine « non
 * offerte », trois rôles que les mouvements des 08 et 09/09 avaient déplacés plus bas SANS remonter
 * ici. Le tableau, lui, était juste. Le coût a été payé le 11/09 : cherchant à relire la fiche Air
 * France dans le build réduit, j'ai lu ce sommaire, conclu qu'elle était construite, et trouvé un
 * dist sans elle. Un commentaire qui prétend décrire le code d'à côté doit être relu avec lui, ou
 * il devient une mesure fausse qui a l'air d'une mesure. Le sommaire est refondé sur le tableau tel
 * qu'il est aujourd'hui ; les mouvements qui l'ont fait bouger restent écrits en regard de chaque
 * ligne, où ils ont toujours été.
 *
 * MOUVEMENT NOMMÉ (05/09/2026, conservé). Air France cabine portait `allowed` et Thai Airways
 * cabine `denied` : depuis la frontière de confiance, aucune politique n'est `allowed`, et `denied`
 * ne s'obtient que sur une phrase citée. La couverture d'un VRAI refus n'est pas perdue pour
 * autant — elle passe à British Airways cabine, seule décision du dépôt fondée sur une citation
 * stricte. La branche `allowed`, elle, n'a plus aucun porteur réel : elle est éprouvée par un
 * témoin SYNTHÉTIQUE nommé, dans le harnais, et jamais par une page du site.
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
  /* MOUVEMENT NOMMÉ (11/09/2026, rattachement fait → preuve). Une SIXIÈME forme entre dans le
     référentiel réel : une politique dont un fait structuré est explicitement rattaché à la phrase
     qui l'établit, et qui publie donc une synthèse dans la langue de la page en plus de sa citation
     d'origine. Aucune sentinelle ne la portait — et elle ne pouvait pas l'être, puisque la forme
     n'existait pas avant ce lot.
     Air France est, au 11/09, la SEULE fiche qui la porte : deux canaux sur 302. Ses deux canaux
     entrent tous les deux, parce qu'ils éprouvent deux constructions différentes de la même
     synthèse — la cabine une borne haute seule (« moins de 8 kg »), la soute une borne basse ET une
     borne haute (« plus de 8 kg et jusqu'à 75 kg »). Son FRET, lui, n'a aucune attestation : la même
     page construite porte donc aussi le témoin négatif, un canal qui ne publie AUCUNE synthèse.
     Ces deux entrées sont un AJOUT, pas un remplacement : aucun rôle existant n'est abaissé. */
  { slug: "air-france", id: "airline_air_france", placement: "cabin", statut: "accepted_with_conditions", role: "fait ATTESTÉ · borne haute seule · synthèse localisée" },
  { slug: "air-france", id: "airline_air_france", placement: "hold", statut: "accepted_with_conditions", role: "fait ATTESTÉ · deux bornes · synthèse localisée" },
];

/** La page pays sentinelle — France, dont le guide est complet dans les quatre langues. */
export const SENTINELLE_PAYS = { slug: "fr", id: "country_fr" };

/** Les familles de routes à construire, et les slugs à y garder — format `BUILD_SLUGS`. */
export const BUILD_ONLY_SENTINELLES = "airlines,countries";
export const BUILD_SLUGS_SENTINELLES = [
  ...new Set(SENTINELLES_COMPAGNIES.map((s) => `airlines:${s.slug}`)),
  `countries:${SENTINELLE_PAYS.slug}`,
].join(",");
