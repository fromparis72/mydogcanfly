# Passation urgente à Claude — garde-fou de poids en cabine

Date : 18 septembre 2026  
Priorité : P0 — exactitude du Finder

## 1. Anomalie constatée

Le Finder répondait **« Cabin: yes, under conditions »** pour un Alaskan Malamute de 38 kg sur
Montréal (YUL) → Paris avec Air Canada.

La fiche Air Canada est pourtant correctement sourcée : la compagnie parle d'un **« small dog »**
placé dans un sac souple sous le siège, mais elle ne publie pas de plafond chiffré global. Le défaut
était dans le moteur : en l'absence de `max_weight_kg`, aucun contrôle de poids ne s'appliquait. Une
absence de nombre était donc, à tort, transformée en absence de limite.

Le même défaut pouvait toucher toutes les politiques cabine `offered` ne comportant pas de plafond
structuré, notamment plusieurs compagnies nord-américaines.

## 2. Arbitrage produit validé par Philippe

Pour un animal de compagnie ordinaire :

- lorsqu'une compagnie publie un plafond de poids cabine qualifié, **le plafond officiel décide** ;
- lorsqu'elle n'en publie aucun, **un chien de plus de 10 kg doit être refusé en cabine** ;
- le seuil de 10 kg est un **garde-fou conservateur MyDogCanFly**, pas une règle attribuée à la
  compagnie ;
- il ne doit donc jamais être injecté dans `weight_limit_kg`, ni présenté comme une citation ou une
  limite officielle de la compagnie ;
- à 10 kg ou moins, la politique qualitative continue de s'appliquer : le résultat reste « sous
  conditions » ou « à confirmer » selon la qualité de la donnée ;
- les plafonds officiels inférieurs à 10 kg restent naturellement prioritaires ;
- le service ITA « Large Dog On Board » reste l'unique exception connue, uniquement sur les routes
  domestiques italiennes couvertes et toujours avec confirmation préalable ;
- les chiens d'assistance sont exclus de ce garde-fou, car ils relèvent d'un régime distinct du
  transport d'un animal de compagnie ordinaire.

Cette règle corrige aussi les cas de 12 ou 15 kg : une politique cabine sans chiffre ne peut plus
produire un résultat positif au-delà de 10 kg.

## 3. Implémentation engagée par Codex

Branche : `fix/finder-cabin-weight-gate-20260918`

Fichier moteur : `packages/engine/src/evaluate.ts`

Une constante explicite a été ajoutée :

```ts
export const CABIN_CONSERVATIVE_MAX_WEIGHT_KG = 10;
```

Le garde-fou est évalué après un éventuel plafond officiel, mais avant la projection positive de la
politique. Il s'applique si et seulement si :

1. le canal évalué est `cabin` ;
2. la demande ne concerne pas un `service_dog` ;
3. le poids du chien est strictement supérieur à 10 kg ;
4. la politique ne possède pas de plafond officiel exploitable (`max_weight_kg` accompagné de
   `weight_includes_carrier`) ;
5. le trajet n'est pas une route domestique italienne relevant du cas ITA.

Le résultat devient `denied` et `weightDeny` est levé, mais aucun `weight_limit_kg: 10` n'est exposé.

## 4. Résultat déjà vérifié

- Air Canada, grand chien de 32 kg : cabine `denied`, sans faux plafond compagnie.
- Air Canada, petit chien de 6 kg : cabine `accepted_with_conditions`, sans plafond inventé.
- Delta et JetBlue, grand chien de 32 kg : cabine `denied` lorsque leur politique qualitative ne
  publie pas de plafond.
- Les plafonds officiels déjà structurés (Air Transat 8 kg, Air Europa 8 kg, Avianca 10 kg, etc.)
  continuent de produire leurs propres décisions.
- `npm run typecheck` passe.
- Le harnais `test-preuves-lots-2-3.mjs` a été adapté aux nouvelles attentes ; un ancien cas JAL a
  révélé exactement le même défaut et doit désormais attendre un refus cabine pour le grand chien.

## 5. Tests indispensables avant fusion

Ajouter ou conserver un harnais dédié qui couvre au minimum :

- Air Canada YUL → CDG : 38 kg cabine refusée ; 6 kg cabine sous conditions ;
- WestJet Canada → Europe : 38 kg cabine refusée ; 6 kg cabine sous conditions ;
- Air Transat YUL → CDG : 38 kg refusé par son plafond officiel de 8 kg ;
- toutes les politiques cabine `offered` sans plafond : 10,1 kg ne peut jamais produire
  `allowed`, `accepted_with_conditions` ou `confirmation_required` ;
- ITA domestique : le service Large Dog reste à confirmer et n'est pas écrasé par le garde-fou ;
- ITA international : un chien de plus de 10 kg reste refusé ;
- absence de régression sur les petits chiens ;
- absence de `weight_limit_kg: 10` dans les décisions fondées uniquement sur le garde-fou interne.

Puis exécuter :

```bash
npm run typecheck
node --import tsx test-preuves-lots-2-3.mjs
npm run test:raccordement-finder
npm run test:unit
```

## 6. Point de vigilance éditorial

Le message utilisateur ne doit pas dire « la compagnie limite à 10 kg » lorsque ce nombre n'est pas
publié. Le résultat peut dire que la cabine n'est pas compatible avec le poids renseigné et rappeler
la contrainte officielle du petit animal dans un contenant sous le siège. La source visible doit
rester celle de la compagnie et ne doit prouver que ce qu'elle dit réellement.

## 7. Périmètre volontairement séparé

L'audit renforcé d'Air Canada, WestJet et Air Transat — tarifs, réservation, dimensions, soute,
fret, restrictions de route et divergences de sources — sera transmis dans un **deuxième document**.
Il ne faut pas mélanger ce nettoyage de données avec le correctif moteur P0 ci-dessus.
