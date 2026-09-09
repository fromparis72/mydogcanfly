# Politiques compagnies — lot strict 5

Date de lecture : **9 septembre 2026**. Ce dossier accompagne
`PREUVES_POLITIQUES_COMPAGNIES_LOT_5_STRICT_2026-09-09.json`.

## Portée

10 compagnies, 19 faits importables et 11 non-décisions explicites. Chaque
fait reprend une citation continue publiée par la compagnie elle-même. Le lot
ne convertit jamais « cargo compartment » ou « cargo cabin » en fret : cela
établit le transport en soute accompagnée, pas l’offre publique `cargo` du
Finder.

| Compagnie | Cabine | Soute | Fret | Point de prudence |
| --- | --- | --- | --- | --- |
| Virgin Australia | sous conditions | non décidé | sous conditions | essai limité à certains vols intérieurs ; plafond combiné de 8 kg |
| Korean Air | sous conditions | sous conditions | non décidé | plafonds combinés de 7 kg et 45 kg, cités en coréen |
| China Airlines | non décidé | sous conditions | non décidé | la source ne fonde que l’AVIH en bagage enregistré |
| Philippine Airlines | sous conditions | non décidé | sous conditions | cabine FurPAL uniquement sur vols PAL domestiques |
| Vietnam Airlines | sous conditions | sous conditions | non décidé | les deux canaux sont cités sans fret séparé |
| Malaysia Airlines | refus documenté | sous conditions | non décidé | « cargo compartment » est la soute, pas le fret expédié |
| Asiana Airlines | sous conditions | sous conditions | non décidé | plafond combiné de 7 kg en cabine |
| China Eastern | refus documenté | sous conditions | non décidé | « cargo cabin » décrit le transport accompagné en soute |
| Air Mauritius | refus documenté | sous conditions | sous conditions | soute limitée à la plupart des appareils ; fret avec réservation dédiée |
| Garuda Indonesia | non décidé | non décidé | sous conditions | source CargoWeb uniquement ; rien n’est inféré sur les canaux passager |

## Décisions volontairement non prises

- **Virgin Australia — soute** : les pages examinées établissent un essai
  cabine et une offre fret, pas une règle générale de soute accompagnée.
- **Korean Air — fret**, **Vietnam Airlines — fret** et **Asiana — fret** :
  les pages établissent les canaux passager, non une expédition séparée.
- **China Airlines — cabine/fret** et **Philippine Airlines — soute** : les
  termes AVIH/cargo de ces pages ne correspondent pas sans ambiguïté aux trois
  catégories publiques du Finder.
- **Malaysia — fret** et **China Eastern — fret** : les textes parlent du
  compartiment/cabine cargo de l’avion, donc du placement de l’animal
  accompagné, non d’une offre mondiale de cargo expédié.
- **Garuda — cabine/soute** : la seule source retenue est le service CargoWeb.

## Règles d’intégration obligatoires

1. Importer exactement les 19 objets de `facts` et garder les 11 canaux de
   `intentionally_unset` à confirmer.
2. Conserver intégralement `url`, `quote`, `quote_language`, `locator` et la
   date de vérification du 09/09/2026. Le coréen de Korean Air est une citation
   originale ; ne pas le traduire dans le champ de preuve.
3. Calculer `review_due` avec la cadence compagnie existante, jamais en le
   copiant à la main depuis cet artefact.
4. `offered_with_conditions` signifie « accepté sous conditions » et non une
   place disponible, un tarif, ni l’acceptation finale du transporteur.
5. Les plafonds de 7, 8 et 10 kg sont des règles dépendant du vol, du marché et
   du contenant. Ils ne doivent devenir un refus moteur que si le modèle porte
   toute leur portée géographique et leur poids combiné.
6. Rejouer l’inventaire de preuves, les contrôles du quatrième état et un
   scénario Finder réel avant toute PR.

## Sources directes relues

- Virgin Australia — https://www.virginaustralia.com/au/en/travel-info/specific-travel/pets/pets-in-cabin/
- Korean Air — https://www.koreanair.com/contents/plan-your-travel/special-assistance/travel-with-pets/guide?hl=en
- China Airlines — https://www.china-airlines.com/tw/en/prepare-for-the-fly/information/baggage/pet-transport
- Philippine Airlines — https://www.philippineairlines.com/ph/en/inflight-experience/furpal.html
- Vietnam Airlines — https://www.vietnamairlines.com/en/buy-tickets-other-products/special-services/See-more-page/special-meals-popup-1
- Malaysia Airlines — https://www.malaysiaairlines.com/content/dam/mh/my/en/legal/2021-08-31-General-Conditions-of-Carriage-Malaysia-Airlines.pdf
- Asiana Airlines — https://m.flyasiana.com/C/TW/EN/contents/traveling-with-pets
- China Eastern — https://global.ceair.com/global/en_static/Announcement/TravelTips/SpecialPassengerServiceNotice/LittleAnimal/
- Air Mauritius — https://www.airmauritius.com/en-au/before-you-fly/travel-information/assistance-and-health/travelling-with-pets
- Garuda Indonesia Cargo — https://cargo.garuda-indonesia.com/Live-Animals

## Vérification avant livraison

- Les 10 identifiants de compagnie ont été vérifiés dans le référentiel.
- Les 19 citations sont continues : aucune ellipse et aucune paraphrase ne se
  trouve dans le champ `quote`.
- Les 11 omissions sont explicites et motivées.
- Aucun fichier, code, branche, déploiement ou donnée du dépôt n’est modifié
  par ce dossier.
