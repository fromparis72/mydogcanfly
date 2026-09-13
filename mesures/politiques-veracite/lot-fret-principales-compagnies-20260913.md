# Lot fret — principales compagnies — 13 septembre 2026

## Origine et intégrité

- Archive remise par Philippe : `______dossier-preuves-fret-20260912-rev2.zip`.
- SHA-256 recalculé : `5306393a20c9bb827bc82dff4e11bdd61ed68b56792bb9998c84129199ef6424`.
- 74 fragments relus par le vérificateur de l'archive, zéro divergence de digest.
- Chaque mouvement ci-dessous repose sur une page officielle citée. Aucun montant de fret n'est importé : les sources décrivent des mécanismes, des restrictions ou un service, jamais une grille numérique opposable.

## Mouvements publiés

- Fret proposé et cité : Air Canada, Air France, ANA, Avianca, Cathay Pacific, China Airlines, Emirates, Ethiopian, Etihad, KLM, Korean Air, LATAM, Lufthansa, Qantas, Singapore Airlines, SWISS et Turkish Airlines.
- Fret traité au cas par cas : Aer Lingus, British Airways, Iberia et Vueling via IAG Cargo ; Aeromexico, dont la page officielle ne couvre que les envois domestiques.
- Fret non proposé au public ordinaire : Delta et United, réservés aux catégories militaires ou diplomatiques publiées ; Virgin Atlantic, dont le produit cargo animaux est déclaré indisponible.
- Aerolíneas Argentinas : service fret documenté sur la page officielle « Animales », sans prix cargo. Les pages passagers remises par Philippe alimentent séparément onze lignes tarifaires prouvées, cinq en cabine et six en soute.

## Arbitrages et limites conservés

- British Airways, Iberia, Aer Lingus et Vueling ne reçoivent aucun prix cargo : IAG Cargo demande une prise en charge au cas par cas.
- Qatar Airways n'est pas modifiée : le dossier établit l'existence d'installations, pas une politique de transport vendue au client.
- Air Canada : la restriction brachycéphale ne vaut plus pour le fret ; le seuil chaleur officiel est `29,5 °C`. La fermeture saisonnière du 15 décembre au 12 janvier reste hors règle tant que le moteur ne sait pas porter une fenêtre jour/mois traversant deux années.
- Aeromexico reste `case_by_case` : la preuve de fret ne couvre pas les routes internationales.
- Virgin Atlantic perd son ancienne ligne tarifaire cargo, devenue non publiable avec l'indisponibilité officielle du produit.
- La grille Aerolíneas est conservée ligne par ligne avec sa devise, sa portée visible et sa preuve. Faute de classification complète des zones et tailles par le Finder, l'interface peut en montrer l'amplitude mais ne doit pas prétendre calculer un prix exact du trajet.

## Mouvement mesuré

- Runtime des 302 politiques : `159 / 40 / 103` avant, puis `173 / 43 / 86` après pour `accepted_with_conditions / denied / confirmation_required`.
- Causes prudentes : `88 legacy_unreviewed + 11 official_source_unquoted + 4 airline_approval` avant, puis `76 + 2 + 8` après.
- Tarifs prouvés : 224 lignes sur 121 canaux et 70 compagnies. Aerolíneas ajoute onze lignes ; Virgin Atlantic en retire une, soit +10 lignes nettes.
- La baseline vivante du Finder couvre 72 scénarios et est régénérée ; les baselines historiques restent inchangées.
