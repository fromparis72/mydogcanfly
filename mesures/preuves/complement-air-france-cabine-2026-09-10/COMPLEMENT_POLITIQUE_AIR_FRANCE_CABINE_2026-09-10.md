# Complément de preuve — Air France, cabine

Date de lecture : **2026-09-10**
Révision à prévoir : **2026-12-09** (cadence compagnie : 90 jours)

## Décision exploitable

- Compagnie : `airline_air_france`
- Canal : `cabin`
- État : `accepted_with_conditions`
- Disponibilité de place : à confirmer lors de la réservation
- Poids : **strictement inférieur à 8 kg, chien + sac compris**
- Limite : `max_weight_kg: 8`
- Borne : `weight_limit_bound: lt`
- Contenant inclus : `weight_includes_carrier: true`

## Source officielle

URL : https://wwws.airfrance.fr/information/passagers/voyager-avec-son-animal-chien-chat

Citation verbatim : « En cabine (chats et chiens de moins de 8 kg, sac de transport compris) »

Langue : `fr`
Locator : `Transport de chiens, de chats et autres animaux de compagnie` → option `En cabine`

## Portée et prudence

Cette phrase suffit pour faire passer la cabine d'Air France de `confirmation_required` à
`accepted_with_conditions` pour un chihuahua de 3 kg, sous réserve des autres conditions du
trajet et de la disponibilité. Elle ne justifie pas un `allowed` inconditionnel.

La formulation officielle dit **« moins de 8 kg »**. Ne pas convertir cette borne en `≤ 8 kg`
sans autre source : le cas exact de 8,0 kg reste hors de cette phrase.

Ce complément ne prouve aucun tarif. La grille tarifaire Air France est documentée séparément
dans `TARIFS_ANIMAUX_LOT_PRIORITAIRE_2026-09-10.*`.
