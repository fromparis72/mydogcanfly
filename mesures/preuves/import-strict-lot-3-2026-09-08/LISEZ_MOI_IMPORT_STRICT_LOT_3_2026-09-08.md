# Import strict — preuves compagnies, lot 3

**Fichier faisant foi :** `PREUVES_POLITIQUES_COMPAGNIES_LOT_3_STRICT_2026-09-08.json`  
**État :** prêt à importer après validation du schéma du dépôt. Aucune valeur ne doit être complétée à partir d’une règle historique, d’une fiche existante ou d’une compagnie voisine.

## Périmètre autorisé

Les **12 objets de `facts`** sont les seules décisions importables. Chacun porte une citation officielle continue, une URL, un localisateur, la langue et la date de vérification du 8 septembre 2026.

Le chemin de preuve est obligatoire : `SourcedQuote` → politique de canal canonique → fiche compagnie et Finder rendus. Vérifier le DOM final dans les quatre langues ; une donnée correctement écrite mais non affichée, ou une carte redevenue plus affirmative que sa source, sont des échecs.

## Interprétation obligatoire

- `offered_with_conditions` n’est jamais une disponibilité, ni une acceptation du chien, de la caisse, de la route ou de l’avion.
- `deny_when_dog_weight_kg_gt_N` déclenche seulement si le poids saisi du chien est **strictement supérieur** à `N`. Il ne donne jamais un feu vert à `N` ou moins car la caisse s’ajoute au poids total exigé par la compagnie.
- `not_offered_for_pet_dogs` ne vise que les chiens de compagnie ordinaires ; les chiens d’assistance restent un parcours différent.
- Les entrées `intentionally_unset` doivent demeurer indécidables. Elles ne peuvent être transformées en oui ou en non par défaut.

## Contrat UI inchangé

Ne pas faire remonter la citation intégrale sur la carte Finder dans ce lot. Elle reste consultable sur la fiche compagnie avec son contexte. La carte conserve verdict, date, type et lien de source.

## À ne pas importer

Ne pas importer de canal pour une compagnie absente du JSON. Les informations collectées sur les compagnies non présentes dans le catalogue ou sur les politiques de fret non explicitement décrites sont volontairement hors lot.

