# Politiques compagnies — lot strict 6

Date de lecture : **9 septembre 2026**. Ce dossier accompagne
`PREUVES_POLITIQUES_COMPAGNIES_LOT_6_STRICT_2026-09-09.json`.

## Portée

10 compagnies, 22 faits importables et 8 non-décisions explicites. Chaque
fait porte une citation continue de première partie. Les catégories du Finder
restent strictes : « cargo hold », « cargo compartment » et « checked baggage »
fondent la soute accompagnée, jamais le fret expédié.

| Compagnie | Cabine | Soute | Fret | Point de prudence |
| --- | --- | --- | --- | --- |
| Aeromexico | sous conditions | sous conditions | non décidé | seuils combinés de 9 kg / 45 kg |
| LATAM | sous conditions | sous conditions | non décidé | vols LATAM uniquement, sans codeshare |
| United | sous conditions | non décidé | non décidé | une place animale par adulte/senior, autres restrictions applicables |
| South African Airways | refus documenté | sous conditions | sous conditions | la route et les formalités déterminent soute ou fret |
| Saudia | refus documenté | sous conditions | non décidé | le refus cabine concerne les chiens ordinaires |
| EgyptAir | sous conditions | sous conditions | non décidé | cabine limitée à 8 kg avec le contenant |
| Air China | sous conditions | sous conditions | non décidé | accord, route, appareil et approbation préalables |
| Kenya Airways | refus documenté | refus documenté | sous conditions | animaux vivants uniquement en cargo |
| Gulf Air | refus documenté | refus documenté | sous conditions | tous les animaux vivants vont en cargo |
| Royal Jordanian | sous conditions | sous conditions | non décidé | cabine Economy, 7 kg avec le contenant et vol ≤ 5 h |

## Décisions volontairement non prises

- **Aeromexico, LATAM, EgyptAir, Air China et Royal Jordanian — fret** : les
  pages examinées établissent les canaux passager, non une expédition séparée.
- **United — soute/fret** : seul le canal cabine est établi ici. Ne pas faire
  revivre les anciennes règles non sourcées par complétion éditoriale.
- **Saudia — fret** : le texte « cargo hold » établit la soute, pas le fret au
  sens du contrat du Finder.

## Règles d’intégration obligatoires

1. Importer exactement les 22 objets `facts`. Les 8 éléments
   `intentionally_unset` doivent rester `confirmation_required`.
2. Conserver sans changement `url`, `quote`, `quote_language`, `locator` et la
   date de vérification du 09/09/2026.
3. L’échéance de relecture reste calculée par la cadence compagnie du dépôt.
4. `offered_with_conditions` signifie une voie décrite par la compagnie, jamais
   une disponibilité, un prix ou une autorisation de transport finale.
5. Les plafonds 7, 8, 9 ou 45 kg associent chien et contenant et dépendent
   parfois de la route. Aucun ne peut devenir un seuil global du moteur sans
   modéliser toute sa portée.
6. Ne pas appliquer les refus cabine aux chiens d’assistance : les citations
   visent les animaux de compagnie ordinaires et le JSON le borne ainsi.
7. Rejouer l’inventaire, les tests du quatrième état et un scénario Finder
   réaliste avant toute PR.

## Sources directes relues

- Aeromexico — https://beta.aeromexico.com/es-mx/informacion-de-vuelos/transporte-aereo-de-mascotas
- LATAM — https://www.latamairlines.com/ca/en/help-center/faq/pets/transport/airplaine-flight
- United — https://www.united.com/en/us/fly/travel/special-assistance/pets-in-cabin.html
- South African Airways — https://www.flysaa.com/manage-fly/baggage/checked-baggage/special-baggage
- Saudia — https://booking-uat.dcloud.saudia.com/book/flight-information/travelling-with-pets
- EgyptAir — https://www.egyptair.com/en/fly/special-services/Pages/traveling-with-pets.aspx
- Air China — https://www.airchina.com.cn/en-US/content/travel_info/preparing/luggage/check/small_animals/
- Kenya Airways — https://www.kenya-airways.com/en-gb/plan/baggage-information/pet-carriage/
- Gulf Air Cargo — https://www.gulfair.com/cargo
- Royal Jordanian — https://www.rj.com/en/info-and-tips/special-services/flying-with-pets

## Vérification avant livraison

- 10 identifiants compagnie vérifiés dans le référentiel.
- 22 citations continues : ni ellipse ni paraphrase dans le champ `quote`.
- 8 canaux laissés indécis avec une raison explicite.
- Cet artefact ne modifie ni code, ni données du dépôt, ni déploiement.
