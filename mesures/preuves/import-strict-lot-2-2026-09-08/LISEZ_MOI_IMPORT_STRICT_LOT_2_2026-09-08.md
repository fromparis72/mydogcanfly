# Import strict — preuves compagnies, lot 2

**Fichier de données faisant foi :** `PREUVES_POLITIQUES_COMPAGNIES_LOT_2_STRICT_2026-09-08.json`  
**État :** prêt à importer après validation du schéma du dépôt ; aucune donnée ne doit être complétée par inférence.

## Ce que ce lot autorise

Les **12 faits** du tableau `facts` sont les seuls faits importables. Chacun contient :

- une URL de première main appartenant à la compagnie ;
- une citation continue, sans ellipse ;
- un localisateur, une langue et la date de lecture (`2026-09-08`) ;
- une conséquence Finder volontairement bornée.

L’import doit conserver le chemin : `SourcedQuote` → politique de canal canonique → fiche compagnie et carte Finder rendues. Après écriture, vérifier le texte réellement publié dans les quatre langues.

## Règles de décision

- `offered_with_conditions` signifie seulement que la compagnie décrit ce canal. Ce n’est ni une place disponible, ni l’acceptation de ce chien, de sa caisse, de l’avion ou de la route.
- `deny_when_dog_weight_kg_gt_8` ne vaut que **strictement au-dessus de 8 kg**. Il est sûr parce que le poids du chien seul dépasse déjà un plafond qui inclut aussi la caisse. À 8 kg ou moins, ne jamais déduire un accord.
- `not_offered_for_pet_dogs` exclut uniquement le chien de compagnie ordinaire. Il ne doit jamais être appliqué aux chiens d’assistance, qui relèvent d’un circuit distinct.
- Les quatre canaux de `intentionally_unset` restent réellement inconnus : aucune valeur historique, règle voisine, moteur de classement ou absence de résultat ne peut les transformer en oui ou en non.

## Contrat d’interface conservé

La carte du Finder reste limitée au verdict, à la date, au type de source et au lien source. La citation exacte reste sur la fiche compagnie, avec son contexte et son localisateur. Ne pas étendre le contrat de la carte dans ce lot.

## Ce qui a été volontairement écarté

Les pages officielles qui ne permettaient pas de produire une citation continue et une décision générale de canal ne sont pas importées. En particulier, aucune règle générale de soute Delta ou JetBlue, ni de fret Air Transat ou Air Europa, n’est créée à partir de ce lot.

