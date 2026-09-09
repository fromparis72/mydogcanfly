# Import strict — lot 7

Ce lot est un **candidat d’import**, pas une autorisation de compléter les
politiques à la main.

Fichiers inséparables :

- `PREUVES_POLITIQUES_COMPAGNIES_LOT_7_STRICT_2026-09-09.json`
- `DOSSIER_PREUVES_POLITIQUES_COMPAGNIES_LOT_7_STRICT_2026-09-09.md`

## Résultat attendu

L’ingestion crée 23 preuves datées. Les 7 canaux non décidés restent prudents.
Elle doit notamment préserver ces distinctions :

- Air Tahiti Nui Cargo n’est pas une preuve d’AVIH accompagné ;
- Aircalin est fret uniquement pour les animaux ordinaires ;
- La Compagnie propose la cabine et refuse explicitement la soute ;
- le seuil cabine Air Algérie ne devient pas un seuil chien seul ;
- les refus ne s’appliquent pas aux chiens d’assistance.

## Contrôles minimaux

1. Rejeter tout identifiant, statut, champ ou placement inconnu.
2. Exiger 30 issues uniques, soit `facts` soit `intentionally_unset`.
3. Vérifier la bijection entre les 23 preuves importées et l’inventaire daté.
4. Tester des routes qui activent et désactivent Air Tahiti Nui, Air Algérie et
   Luxair ; tester un chien brachycéphale sur French Bee et Air Caraïbes.
5. Vérifier dans le Finder que « sous conditions » ne devient jamais
   « accepté » sans réserve de place, de route et d’accord final.

Établi le 09/09/2026 par lecture directe des pages officielles.

