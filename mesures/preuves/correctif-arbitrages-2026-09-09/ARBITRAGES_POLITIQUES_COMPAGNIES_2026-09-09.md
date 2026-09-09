# Arbitrages de six questions ouvertes — 9 septembre 2026

Ces arbitrages proviennent d'une lecture directe des pages officielles le 9 septembre 2026. Ils ne donnent jamais un feu vert de réservation : `offered_with_conditions` signifie que le canal existe sous conditions et doit encore être confirmé pour le vol précis.

## Verdicts

### 1. Thai Airways — fret : conserver, mais remplacer la preuve

**Verdict :** `offered_with_conditions`.

La phrase « contactez Cargo » est trop faible pour établir seule l'existence du service. La page officielle de THAI Cargo le fait explicitement et décrit réservation, documents et conditions d'acceptation.

- URL : https://www.thaicargo.com/en/product-view/1/live-animals---pets
- Citation continue : `The acceptance of live - animal consignments is subject to the conditions described in the IATA's Live Animals Regulations and to TG's Regulations`
- Locator : `Live Animals & Pets → opening paragraph`
- Portée : fret animal vivant, sous confirmation de réservation, type d'animal, avion, températures, documents et règles TG ; jamais une acceptation garantie sur tout vol.

### 2. China Southern — soute : conserver, citation à remplacer

**Verdict :** `offered_with_conditions`.

Le fragment « you can check it » ne doit pas rester seul. La réponse officielle complète établit à la fois le refus cabine et la possibilité d'enregistrement.

- URL : https://www.csair.com/sg/en/tourguide/faq/baggage/dongwu.shtml
- Citation continue : `Sorry, a pet can not be taken into cabin. However, you can check it.`
- Locator : `Pets → May I take my pet into cabin?`
- Portée : transport enregistré après accord préalable de China Southern et des transporteurs successifs, avec certificats et autres conditions ; pas de décision fret séparée.

### 3. IndiGo — fret : refus maintenu, mais sur la page Cargo

**Verdict :** `not_offered_for_pet_dogs`.

La FAQ passager n'avait pas à être étendue au fret. La page officielle IndiGo CarGo répond directement à la question du chien transporté en fret.

- URL : https://www.goindigo.in/cargo/products-guidelines.html
- Citation continue : `No, IndiGo does not carry livestock`
- Locator : `Product Guidelines → Need help? Check FAQs → Can I transport my pet dog on CarGo?`
- Portée : chiens de compagnie en CarGo. Les décisions cabine et soute restent fondées séparément sur la politique passager.

### 4. Bangkok Airways — fret : uniquement intérieur, avec exclusions

**Verdict :** `offered_with_conditions`, mais seulement quand le trajet entre dans la portée publiée.

- URL canonique : https://www.bangkokair.com/cargo-service/pet_carriage
- Citation de l'offre : `Special cargo service as Live animals dog, cat (AVI) is available on Airbus and ATR72 on the following routes:`
- Locator : `Cargo Service → Pet Carriage Service → Domestic Routes / International Routes`
- Portée exacte : toutes les liaisons intérieures sauf Bangkok–Krabi aller-retour et Chiang Mai–Krabi aller-retour ; toutes les escales internationales sont indiquées `Not Accept`.
- Conséquence Finder : hors de ce périmètre intérieur explicite, ne pas afficher le fret comme proposé ; ce n'est pas un simple avertissement après un résultat positif.

### 5. Aer Lingus — soute : arbitrage maintenu

**Verdict :** `offered_with_conditions` en soute ; cabine ordinaire refusée ; fret séparé non décidé.

- URL : https://www.aerlingus.com/localized/en/modals/baggage-information.html
- Citation : `Pets must be booked to travel with a pet agent, and they will be carried in the aircraft hold.`
- Locator : `Baggage Information → General Animals & Pets Rules`
- Portée : réservation par agent, vol réellement opéré et appareil compatibles. Aer Lingus Regional/Emerald interdit les animaux ; certains A321neo LR ont une soute non ventilée. Le recours à un agent ne transforme pas automatiquement la soute accompagnée en canal fret du modèle.

### 6. Air China — cabine : arbitrage maintenu, formulation à corriger

**Verdict :** `offered_with_conditions`.

- URL : https://m.airchina.com.cn/ac/c/invoke/specialService/petCabinAgreement%40pg
- Citation : `A maximum of 2 pets are permitted per flight, and each passenger may bring no more than 1 pet into the cabin.`
- Locator : `Agreement for In-Cabin Transportation of Pets → I. Carrier's Regulations on Pet Transportation`
- Portée : chats et chiens de compagnie, vol opéré par Air China, réservation préalable, quota, âge, race, documents et contenant sous le siège. Ne pas écrire « domestic dogs and cats » en français comme une restriction aux vols intérieurs : ici `domestic` signifie animaux domestiques. Ne pas étendre aux vols opérés par un partenaire.

## Règle commune des seuils de poids

1. Un seuil structuré n'est importable que si la source officielle donne le **chiffre**, l'**unité**, la **comparaison** et la **base pesée** : chien seul ou chien + contenant, éventuellement eau/nourriture.
2. Un plafond combiné peut produire un refus certain si le poids du chien seul le dépasse déjà. Exemple : chien de 9 kg face à un maximum `chien + contenant ≤ 8 kg`.
3. Le raisonnement inverse est interdit : un chien de 6 kg sous ce plafond n'est pas « accepté », car le contenant peut faire dépasser la limite et les autres conditions restent à vérifier.
4. Un seuil « chien seul » peut être comparé directement au poids saisi. Un seuil combiné ne doit jamais être stocké comme seuil chien seul.
5. Si la base du poids est absente, contradictoire ou ambiguë, le chiffre reste dans le texte de condition mais ne devient pas une règle calculée.
6. Respecter la borne publiée : `up to` / `maximum` / `not exceeding` incluent la valeur ; `less than` l'exclut. Aucun arrondi inventé.
7. Un seuil est un **filtre négatif**, jamais à lui seul une preuve positive de disponibilité ou d'acceptation sur le vol précis.

## Provenance

- `verified_date` : `2026-09-09`
- `review_due` : `2026-12-08` avec la cadence compagnie de 90 jours
- `source_type` : `official_website`
- Les URLs et citations exactes de remplacement sont reprises dans le fichier JSON compagnon.

