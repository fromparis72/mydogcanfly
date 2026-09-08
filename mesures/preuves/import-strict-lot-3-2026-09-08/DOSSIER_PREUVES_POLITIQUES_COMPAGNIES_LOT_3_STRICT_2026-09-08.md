# Dossier de preuves — compagnies, lot 3 strict

**État :** recherche prête à importer, sans modification de code ou de données.  
**Lecture directe :** 8 septembre 2026.  
**Contenu :** 12 faits pour 6 compagnies déjà présentes dans le catalogue : Air India, Avianca, Ethiopian Airlines, ANA, Japan Airlines (JAL) et Etihad Airways.

## Règle de lecture

Chaque fait contient une URL de première main, une citation continue, sa langue, un localisateur et une date de lecture. Une mention `offered_with_conditions` signifie uniquement que le canal existe dans la politique publiée : elle ne garantit ni une place, ni l’acceptation du chien, de la caisse, de l’appareil, du trajet ou des documents.

Les plafonds qui comprennent aussi la caisse permettent une seule déduction automatique : un chien **strictement plus lourd** que le plafond ne peut pas satisfaire la règle cabine. Sous le plafond, le Finder doit rester conditionnel : il ne sait pas encore si le chien et sa caisse réunis sont admissibles.

## Résumé des faits importables

| Compagnie | Faits sûrs importables | Conséquence Finder utile |
| --- | --- | --- |
| Air India | Cabine impossible au-delà de 10 kg de chien ; soute et fret décrits sous conditions | Retirer la cabine au-dessus de 10 kg ; soute/fret restent des pistes conditionnelles. |
| Avianca | Cabine impossible au-delà de 10 kg de chien ; soute publiée jusqu’à 70 kg animal+caisse | Retirer la cabine au-delà de 10 kg ; soute conditionnelle et soumise aux restrictions de vol. |
| Ethiopian Airlines | Cabine impossible au-delà de 8 kg de chien ; soute jusqu’à 45 kg animal+caisse ; fret au-delà | Retirer la cabine au-delà de 8 kg ; autres canaux restent conditionnels. |
| ANA | Pas de chien de compagnie en cabine ; prise en charge sous le plancher, avec réservation | Ne pas proposer la cabine ; soute conditionnelle uniquement sur vol ANA éligible. |
| JAL | Service d’animal enregistré avec son propriétaire | Soute conditionnelle, sans confondre le service accompagné avec le fret. |
| Etihad Airways | Cabine impossible au-delà de 8 kg de chien | Retirer la cabine au-delà de 8 kg ; aucun autre canal n’est déduit ici. |

## Inconnus intentionnels

Les six cas `intentionally_unset` du JSON restent vides. Ils ne sont pas des absences de travail : ce sont des frontières explicites contre une déduction trompeuse, notamment entre soute accompagnée et fret pour JAL, et entre la page cabine Etihad et ses autres canaux.

## Import sans élargir l’interface

Conserver le contrat actuel : la carte Finder rend le verdict, son type, sa date et un lien source ; le texte intégral et le localisateur restent sur la fiche compagnie. L’import exige la chaîne `SourcedQuote` → `premium.policy` → DOM réellement rendu, dans les quatre langues.

## Sources officielles

- [Air India — Pet Travel FAQ](https://www.airindia.com/in/en/frequently-asked-questions/pet-travel.html)
- [Avianca — Can I fly with my pet?](https://ayuda.avianca.com/hc/en-us/articles/13091527349787-Can-I-fly-with-my-pet)
- [Ethiopian Airlines — travelling with pets](https://www.ethiopianairlines.com/us/information/special-needs/travelling-with-pets)
- [ANA — passengers travelling with pets (international)](https://www.ana.co.jp/en/jp/guide/reservation/support/international/pets/)
- [JAL — travelling with pets (international)](https://www.jal.co.jp/jp/en/inter/support/pet/)
- [Etihad Airways — travelling with pets](https://www.etihad.com/en/plan/travel-companion/travelling-with-pets)

