# Import strict — lot 9, clôture des 102 compagnies

Ce lot est un **candidat d’import**, pas une autorisation de compléter les trous
avec l’ancienne base. Il ne doit être ni enrichi de mémoire, ni fusionné avec un
verdict éditorial historique.

Fichiers inséparables :

- `PREUVES_POLITIQUES_COMPAGNIES_LOT_9_STRICT_2026-09-09.json`
- `DOSSIER_PREUVES_POLITIQUES_COMPAGNIES_LOT_9_STRICT_2026-09-09.md`

## Résultat attendu

18 preuves datées sont importées ; 9 canaux restent à confirmer. Trois
distinctions doivent rester visibles :

- Batik Air **Indonesia** : cabine et soute refusées, fret inconnu ; Batik Air
  **Malaysia** : trois inconnues ;
- Air Astana : le cargo n’est documenté que pour certains cas de destination ;
- EL AL : la checklist de cage ne suffit pas à décider un canal.

## Contrôles minimaux

1. Rejeter tout champ, placement, statut ou identifiant inconnu.
2. Exiger exactement 27 issues uniques et aucun doublon compagnie × canal.
3. Exiger 18 faits et 9 non-décisions, sans canal manquant.
4. Vérifier que les neuf identifiants existent dans `objects.json`.
5. Interdire toute propagation Batik Indonesia → Batik Malaysia.
6. Conserver les limites de poids combiné, de route, d’appareil et de race.
7. Ne pas convertir les deux décisions Croatia en « fraîches » sans relecture
   des pages passager courantes ; leur source datée doit rester nommée.
8. Tester dans le Finder au minimum Aerolíneas Argentinas, Air Astana, les deux
   Batik Air, Croatia, EL AL, Neos et TAROM.
9. Vérifier que l’import ne crée aucun `allowed` : les canaux positifs restent
   `offered_with_conditions`.

## Sens de la clôture

Avec ce lot, les 102 compagnies ont toutes été examinées dans les artefacts
stricts. Ce n’est pas un taux de preuve à 100 % : chaque canal inconnu reste
inconnu jusqu’à une citation officielle exploitable.

Établi le 09/09/2026 par lecture directe de sources de première partie.
