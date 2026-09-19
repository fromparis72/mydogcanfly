# Passation à Claude — audit renforcé des compagnies canadiennes

Date : 18 septembre 2026  
Compagnies : Air Canada, WestJet, Air Transat  
Contexte : préparation d'un échange avec une journaliste de TravelPulse Canada

## 1. État technique

Branche Codex : `fix/finder-cabin-weight-gate-20260918`

Le correctif moteur décrit dans `docs/passation-claude-garde-fou-cabine-2026-09-18.md` est appliqué.
Les fiches canadiennes ont ensuite été contrôlées séparément contre leurs sources officielles.

Sources de vérité modifiées :

- `content/airlines/westjet.yml`
- `content/airlines/air_transat.yml`
- `packages/knowledge/raw/objects.json` — régénéré par l'ingestion
- `packages/ui/src/data/airlines.generated.json` — régénéré par l'ingestion

Ne pas modifier uniquement les JSON générés : les changements doivent naître dans les fiches YAML,
puis être propagés par `npm run ingest`.

## 2. Air Canada

Source officielle :
https://www.aircanada.com/ca/fr/aco/home/plan/special-assistance/pets.html

### Cabine

- La compagnie parle d'un **chat ou petit chien** dans un sac souple placé sous le siège.
- Elle ne publie pas de plafond de poids cabine global exploitable.
- Le Finder ne doit donc afficher aucun faux `weight_limit_kg`.
- Grâce au garde-fou moteur, un chien de plus de 10 kg est maintenant refusé en cabine ; un chien de
  6 kg reste « accepté sous conditions ».
- Tarifs officiels déjà structurés :
  - Canada/États-Unis : 50–60 CAD/USD par aller ;
  - international : 100–120 CAD/USD par aller.

### Soute

- Plafond officiel : 45 kg, animal et caisse combinés.
- Dimensions linéaires maximales publiées : 292 cm.
- Tarifs officiels déjà structurés :
  - Canada/États-Unis : 105–126 CAD/USD ;
  - international : 270–324 CAD/USD.
- Des restrictions saisonnières, de température et de races brachycéphales subsistent ; aucune
  réservation ne garantit l'acceptation opérationnelle du trajet.

### Fret

- Air Canada Cargo / AC Animaux prend le relais lorsque la caisse dépasse 45 kg ou 292 cm.
- Le moteur comporte un plancher de portée à plus de 45 kg : en dessous, le fret reste à confirmer ;
  au-dessus, il devient un canal documenté sous conditions.

### Résultat témoin

YUL → CDG, Alaskan Malamute, 38 kg :

- cabine : `denied` ;
- soute : `accepted_with_conditions`, plafond officiel 45 kg ;
- fret : `confirmation_required`, car le plancher documenté de plus de 45 kg n'est pas atteint.

Ce triplet est désormais cohérent.

## 3. WestJet

Sources officielles :

- politique animaux : https://www.westjet.com/en-ca/pets
- frais : https://www.westjet.com/en-ca/flights/fees

### Corrections effectuées

1. **Cabine**

   - La preuve vague « small pets on most international flights » a été remplacée par la règle
     fonctionnelle actuelle : l'animal doit pouvoir se tenir debout, s'asseoir, se retourner et se
     coucher confortablement dans sa caisse.
   - Dimensions conservées dans la fiche : 41 × 21,5 × 25,4 cm.
   - Aucun plafond chiffré officiel n'est inventé.
   - Plus de 10 kg : refus par le garde-fou interne ; 6 kg : sous conditions.

2. **Réservation**

   - L'ancien texte « impossible d'ajouter un animal en ligne » était devenu faux.
   - Le texte interne a été corrigé : l'espace peut être réservé **en ligne ou par téléphone**, dès
     la réservation terminée, idéalement au moins 48 heures avant le départ.

3. **Tarifs**

   - Cabine : 50–59 CAD Canada/États-Unis ; 100–118 CAD hors Canada/États-Unis.
   - Soute : 100–118 CAD Canada/États-Unis ; 200–236 CAD hors Canada/États-Unis.
   - Des lignes tarifaires sourcées ont été ajoutées aux politiques cabine et soute.
   - Elles restent volontairement des grilles `indecidables` dans le moteur tant que leur portée
     géographique n'est pas exprimée par un prédicat exécutable. Le site peut présenter la grille,
     mais ne doit pas prétendre qu'il s'agit du prix exact du trajet demandé.

4. **Soute**

   - Plafond conservé : 45 kg, animal et caisse combinés.
   - Point à surveiller : la page animaux et le tarif PDF ne publient pas exactement la même hauteur
     maximale de caisse (81 cm sur la page, 76 cm dans le tarif consulté). Ne pas fabriquer une
     valeur unique sans arbitrage de source et de marché. Le plafond de poids, lui, est concordant.

5. **Fret**

   - L'ancien canal `legacy_unreviewed` est devenu `case_by_case` sur preuve officielle.
   - Londres-Heathrow impose le fret manifesté.
   - Pour les autres cas, route, acceptation et tarif doivent être confirmés auprès de WestJet
     Cargo : le Finder rend donc `confirmation_required`, jamais une acceptation catégorique.

### Résultat témoin

YUL → CDG, Alaskan Malamute, 38 kg :

- cabine : `denied` ;
- soute : `accepted_with_conditions`, plafond officiel 45 kg ;
- fret : `confirmation_required` avec cause `airline_approval`.

## 4. Air Transat

Source officielle :
https://www.airtransat.com/en-GB/travel-information/special-services/pets-and-service-dogs

### Cabine

- Plafond officiel : 8 kg, animal et sac combinés.
- Sac souple : 43 × 24 × 25 cm.
- Réservation au moins 24 heures avant le départ.
- Un chien de 38 kg est refusé par la règle officielle elle-même, indépendamment du garde-fou
  conservateur.

### Soute

- Plafond officiel : 45 kg, animal et caisse combinés.
- Caisse publiée : jusqu'à 122 × 81,3 × 89 cm.
- Le résultat reste « sous conditions », avec restrictions de routes, de correspondances, de races
  et d'exploitation.

### Fret

- L'ancien canal `legacy_unreviewed` a été remplacé par une politique `case_by_case` sourcée.
- Citation officielle : les caisses plus grandes doivent être expédiées via Air Transat Cargo et
  nécessitent une organisation préalable.
- Le Finder rend donc `confirmation_required` avec cause `airline_approval`.

### Résultat témoin

YUL → CDG, Alaskan Malamute, 38 kg :

- cabine : `denied` sur plafond officiel de 8 kg ;
- soute : `accepted_with_conditions`, plafond officiel 45 kg ;
- fret : `confirmation_required` avec accord préalable de la compagnie.

## 5. Tests ajoutés ou adaptés

Nouveau harnais : `test-cabin-conservative-guard.mjs`

Il vérifie :

- le cas Air Canada 38 kg signalé par Philippe ;
- Air Canada, WestJet et Air Transat à 6 kg et 38 kg ;
- les neuf compagnies dont la cabine est proposée sans plafond structuré : Air Canada, Air China,
  Alaska Airlines, American Airlines, Delta, JetBlue, LATAM, United et WestJet ;
- l'absence de réponse positive dès 10,1 kg sur ces neuf politiques ;
- l'absence de faux `weight_limit_kg: 10` ;
- l'exception ITA domestique à confirmer et le refus ITA international.

Le harnais historique `test-preuves-lots-2-3.mjs` a aussi été adapté :

- Air Canada, Delta, JetBlue et JAL ne conservent plus un résultat positif pour un grand chien faute
  de plafond numérique ;
- le fret Air Transat est désormais reconnu comme une politique officielle `case_by_case`.

## 6. Résultats obtenus

- `test-cabin-conservative-guard.mjs` : **20/20**.
- `test-preuves-lots-2-3.mjs` : **139/139**.
- audit de raccordement : **102 compagnies × 3 canaux, aucune divergence**.
- contre-épreuves de raccordement : **15/15**.
- contrôle de schéma : **102 compagnies, 140 pays, 297 règles, 3 516 arêtes**, tout est vert.
- `npm run typecheck` : vert avant la régénération ; à conserver dans le passage final complet.

## 7. Ce qui reste à faire avant livraison

1. Exécuter la suite `npm run test:unit` complète.
2. Vérifier le rendu construit des trois cartes canadiennes en anglais et en français.
3. Contrôler que le libellé d'un refus issu du garde-fou n'attribue pas « 10 kg maximum » à la
   compagnie.
4. Ne pas résoudre artificiellement le conflit de dimensions WestJet sans relecture du marché et du
   document applicables.
5. Relire le diff final, committer et pousser la branche ; ne pas fusionner directement dans `main`
   sans CI.

## 8. Règle de coordination

Claude peut travailler sur les contenus ou tarifs en parallèle, mais ne doit pas réécrire
`packages/engine/src/evaluate.ts` ni `test-cabin-conservative-guard.mjs` sans coordination : ce sont
les deux fichiers qui matérialisent l'arbitrage P0. Toute modification des politiques canadiennes
doit partir des YAML puis passer par `npm run ingest`, afin de préserver l'identité entre fiche,
artefact public et Finder.
