# Import strict — lot 4

Ce lot est un **candidat d’import**, pas une autorisation de modifier les
politiques à la main.

Fichiers à garder ensemble :

- `PREUVES_POLITIQUES_COMPAGNIES_LOT_4_STRICT_2026-09-09.json`
- `DOSSIER_PREUVES_POLITIQUES_COMPAGNIES_LOT_4_STRICT_2026-09-09.md`

## Résultat attendu

Après ingestion stricte, le dépôt doit contenir 23 nouvelles preuves
traçables : URL officielle, phrase continue, langue, locator, date de lecture
et échéance calculée par le mécanisme existant. Les 7 canaux non décidés doivent
rester `confirmation_required`.

## Ce qu’il ne faut pas faire

- Ne pas convertir les notes `intentionally_unset` en refus ou en acceptation.
- Ne pas transformer « accepted under conditions » en réponse de disponibilité.
- Ne pas inférer que 8 kg inclut une acceptation à 8 kg ou au-dessous.
- Ne pas importer le seuil ITA sans d’abord modéliser la distinction domestique
  Italie / autres vols.
- Ne pas remplacer les citations par des résumés éditoriaux.

## Contrôles minimaux

1. Le chargeur rejette un identifiant, une recommandation ou un champ de
   provenance inconnu.
2. L’inventaire de preuves demeure bijectif et daté.
3. Le Finder garde les réponses ambiguës à confirmer.
4. Tester au moins : chien de 32 kg (cabine Austrian/SWISS/Brussels refusée par
   seuil), Qantas cabine refusée, et un canal conditionnel sans promesse de
   place.

L’artefact a été établi le 09/09/2026 par lecture directe de pages officielles.
Une nouvelle lecture reste obligatoire à l’échéance définie par le dépôt.
