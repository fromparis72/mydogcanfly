# Dossier de preuves — compagnies, lot 2 strict

**État :** recherche prête à importer, sans modification de code ou de données.  
**Lecture directe :** 8 septembre 2026.  
**Contenu :** 12 faits pour 7 compagnies : Air Canada, Delta, JetBlue, Air Transat, Air Europa, Cathay Pacific et EVA Air.

## Contrat de lecture

Chaque fait du fichier JSON comporte une URL de première main, une citation continue, sa langue, un localisateur et une date de lecture. Un canal `offered_with_conditions` veut dire que la compagnie publie le canal : il ne signifie ni qu’il reste une place, ni que le chien, la caisse, l’appareil ou la route ont déjà été acceptés.

Un seuil portant sur l’animal **et** son contenant ne permet un refus sûr que si le poids du chien seul dépasse ce seuil. Il n’autorise pas un feu vert sous ce seuil.

## Résumé des faits importables

| Compagnie | Faits sûrs importables | Conséquence utile au Finder |
| --- | --- | --- |
| Air Canada | Cabine pour chat/petit chien sous siège ; soute pressurisée sur certains vols Air Canada/Rouge/Jazz | Une piste cabine seulement pour petit chien ; soute conditionnelle, aucun raccourci sur un codeshare. |
| Delta | Cabine pour petit chien sous conditions | Piste cabine conditionnelle, jamais une promesse sur tous les pays ou classes. |
| JetBlue | Cabine pour petit chien sous siège | Piste cabine conditionnelle ; la page ne fonde pas une décision soute/fret. |
| Air Transat | Cabine ≤8 kg animal+caisse ; soute pour chien/chat sous conditions | Un chien de plus de 8 kg ne peut pas être proposé en cabine ; soute conditionnelle. |
| Air Europa | Cabine : chien ≤8 kg, animal+caisse ≤10 kg ; soute selon espèce/race/poids | Même déduction négative sûre pour grand chien ; soute conditionnelle. |
| Cathay Pacific | Chien de compagnie hors cabine ; parcours fret | Ne pas proposer la cabine ; fret comme orientation conditionnelle. |
| EVA Air | Chien de compagnie hors cabine ; soute accompagnée documentée | Ne pas proposer la cabine ; soute conditionnelle, avec limites de route/saison/race. |

## Import sans élargir l’interface

La carte Finder conserve son contrat actuel : verdict, lien source, type et date. La phrase verbatim reste sur la fiche compagnie, où le visiteur peut la lire avec son contexte. Il n’est pas nécessaire d’étendre la carte avant d’importer ce lot.

Pour chaque compagnie : `SourcedQuote` → `premium.policy` → vérification de la carte Finder et de la fiche rendue. Les canaux explicitement listés dans `intentionally_unset` ne doivent produire aucune décision par défaut.

## Sources officielles

- [Air Canada — travelling with your pet](https://www.aircanada.com/ca/en/aco/home/plan/special-assistance/pets.html)
- [Delta — pet travel](https://www.delta.com/us/en/pet-travel/overview)
- [JetBlue — travelling with pets](https://www.jetblue.com/help/traveling-with-pets)
- [Air Transat — pets and assistance dogs](https://www.airtransat.com/en-GB/travel-information/special-services/pets-and-service-dogs)
- [Air Europa — flying with pets](https://www.aireuropa.com/us/en/aea/informacion-para-volar/pasajeros/mascotas.html)
- [Cathay Pacific — pets in the cabin](https://www.cathaypacific.com/cx/en_GB/faqs/baggage/cabin-baggage-allowance/are-pets-allowed-in-the-cabin.html?cxsource=LANGUAGE_SELECTOR_EN_HK)
- [EVA Air — travelling with pets](https://www.evaair.com/en-us/fly-prepare/baggage/travelling-with-pets/)
