# Politiques compagnies — lot strict 7

Date de lecture : **9 septembre 2026**. Ce dossier accompagne
`PREUVES_POLITIQUES_COMPAGNIES_LOT_7_STRICT_2026-09-09.json`.

## Portée

10 compagnies, 23 faits importables et 7 non-décisions explicites. Chaque fait
porte une citation continue de première partie. Une voie « sous conditions »
signifie que la compagnie décrit ce canal ; elle ne garantit ni la place, ni
l’acceptation finale du chien, ni l’applicabilité à toute route.

| Compagnie | Cabine | Soute | Fret | Point de prudence |
| --- | --- | --- | --- | --- |
| Air Algérie | sous conditions | sous conditions | non décidé | incohérence de la page sur la base du seuil de 6 kg ; soute interdite au Royaume-Uni |
| Air Austral | sous conditions | sous conditions | non décidé | 8 kg avec contenant en cabine ; exclusions de races et de routes |
| Air Caraïbes | sous conditions | sous conditions | sous conditions | quotas, brachycéphales exclus de soute, fret pour grands chiens hors capacité AVIH |
| Air Tahiti Nui | sous conditions | non décidé | sous conditions | cabine limitée aux quatre liaisons publiées ; autre transport décrit par Air Tahiti Nui Cargo |
| Aircalin | refus documenté | refus documenté | sous conditions | animaux ordinaires annoncés « fret uniquement » ; exception chiens guides |
| Corsair | sous conditions | sous conditions | sous conditions | plafonds combinés de 8 kg et 50 kg ; fret au-delà |
| French Bee | sous conditions | sous conditions | non décidé | chiens brachycéphales exclus de soute |
| Iberia Express | sous conditions | sous conditions | non décidé | 8 kg combinés cabine, 45 kg combinés soute, restrictions route/race |
| La Compagnie | sous conditions | refus documenté | non décidé | cabine seule, 8 kg sac compris et quota de quatre animaux |
| Luxair | sous conditions | sous conditions | non décidé | nombreuses exclusions de routes ; soute indisponible à Paris-CDG |

## Décisions volontairement non prises

- **Air Algérie — fret** : le fret est explicitement imposé sur les liaisons
  britanniques, mais cela ne fonde pas une offre générale sur tout le réseau.
- **Air Austral — fret** : la page l’évoque pour d’autres espèces, pas comme
  réponse générale et autonome pour un chien ordinaire.
- **Air Tahiti Nui — soute** : la source parle de fret Air Tahiti Nui Cargo dans
  la soute de l’appareil. Elle ne prouve pas un service AVIH accompagné.
- **French Bee, Iberia Express, La Compagnie et Luxair — fret** : les pages
  examinées ne fondent pas une offre générale de fret canin distincte.

## Règles d’intégration obligatoires

1. Importer exactement les 23 objets `facts`. Les 7 éléments
   `intentionally_unset` restent `confirmation_required`.
2. Conserver à l’octet utile `url`, `quote`, `quote_language`, `locator` et la
   date du 09/09/2026. Ne jamais remplacer la citation par le résumé.
3. L’échéance de relecture vient de la cadence compagnie du dépôt.
4. Ne pas convertir « dans la soute de l’appareil » en AVIH quand la compagnie
   parle explicitement de fret.
5. Ne pas appliquer au chien seul un plafond qui inclut sac, caisse, nourriture
   ou contenant.
6. Les refus Aircalin et La Compagnie ne couvrent pas les chiens d’assistance.
7. Les restrictions de route doivent rester opposables : Air Tahiti Nui cabine,
   Air Algérie Royaume-Uni, Luxair, Corsair, French Bee et Iberia Express.
8. Rejouer l’inventaire, les tests du quatrième état et des scénarios Finder
   avant toute PR.

## Sources directes relues

- Air Algérie — https://airalgerie.dz/en/plan-your-trip/baggage/travel-with-pets/
- Air Austral — https://www.air-austral.com/preparer-mon-vol/demandes-speciales/animaux.html
- Air Caraïbes — https://www.aircaraibes.com/avant-voyage/demandes-particulieres/animaux
- Air Tahiti Nui, cabine — https://pf.airtahitinui.com/voyager-avec-un-animal
- Air Tahiti Nui Cargo — https://pf.airtahitinui.com/transport-danimaux-en-soute
- Aircalin — https://www.aircalin.com/fr/animaux
- Corsair — https://www.flycorsair.com/fr/legal/conditions-generales-de-vente-et-de-transport
- French Bee, cabine — https://support.frenchbee.com/hc/fr/articles/4408189999633-Quel-type-de-sac-pour-mon-animal-en-cabine
- French Bee, soute — https://support.frenchbee.com/hc/fr/articles/360039534611-Puis-je-faire-voyager-mon-animal-avec-moi-dans-l-avion
- Iberia Express — https://www.iberiaexpress.com/informacion-general/informacion-pasajero/antes-de-volar/mascotas
- La Compagnie — https://www.lacompagnie.com/fr/plan/special-services
- Luxair — https://www.luxair.lu/en/node/502/

## Vérification avant livraison

- 10 identifiants compagnie présents dans le référentiel.
- 23 citations continues : aucune ellipse ni paraphrase dans `quote`.
- 7 canaux explicitement indécis, chacun avec une raison.
- 30 issues au total : une et une seule par compagnie × canal.
- Aucun code, donnée du dépôt ou déploiement n’est modifié par cet artefact.

