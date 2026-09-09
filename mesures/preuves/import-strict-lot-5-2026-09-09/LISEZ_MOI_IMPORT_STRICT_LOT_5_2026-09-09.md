# Import strict — lot 5

Ce lot est un **candidat d’import**. Il n’autorise pas une modification
manuelle des règles compagnie.

Fichiers à garder ensemble :

- `PREUVES_POLITIQUES_COMPAGNIES_LOT_5_STRICT_2026-09-09.json`
- `DOSSIER_PREUVES_POLITIQUES_COMPAGNIES_LOT_5_STRICT_2026-09-09.md`

## Résultat attendu

Après ingestion stricte, le dépôt porte 19 preuves nouvelles, avec URL
officielle, citation continue, langue, locator, date de lecture et échéance
calculée par le mécanisme existant. Les 11 canaux volontairement non décidés
restent `confirmation_required`.

## Ce qu’il ne faut pas faire

- Ne pas déduire une acceptation cabine d’un plafond de poids combiné.
- Ne pas transformer un essai local Virgin Australia en offre internationale.
- Ne pas confondre le compartiment cargo de l’avion (soute accompagnée) avec
  l’offre de fret expédié du Finder.
- Ne pas créer une règle soute Philippine à partir de la mention AVIH Cargo.
- Ne pas traduire ou tronquer les citations, notamment celles de Korean Air.
- Ne pas remplacer une citation par un résumé éditorial.

## Contrôles minimaux

1. Le chargeur rejette tout identifiant, statut ou champ de provenance
   inconnu.
2. L’inventaire reste bijectif, daté et conforme à la cadence de revue.
3. Les 11 canaux laissés indécis restent prudents dans le Finder.
4. Tester au moins : Malaysia/China Eastern cabine refusée, Virgin cabine hors
   de son essai restée conditionnelle, Garuda limité au fret, et une citation
   Korean Air rendue sans perte de sa langue d’origine.

L’artefact a été établi le 09/09/2026 par lecture directe de pages officielles.
Une nouvelle lecture reste obligatoire à l’échéance définie par le dépôt.
