# Lot de preuves compagnies — import strict V3

Cette note **remplace** toute instruction antérieure attachée au dossier A–K. Le paquet antérieur était une extraction de recherche : il a mis sur le même plan des citations complètes, des fragments et des paraphrases. Il ne doit donc pas être importé globalement.

## Seuls faits autorisés à l’import dans ce lot

| Fichier | Faits autorisés | Nombre |
| --- | --- | ---: |
| Cohorte A | `facts[0]` à `facts[19]` | 20 |
| Cohorte B | `facts[0]` Finnair cabine ; `facts[3]` SAS cabine | 2 |
| Cohorte C | `facts[0]` à `facts[2]` Ryanair | 3 |
| Cohorte F | `facts[1]` Vueling soute | 1 |
| **Total** |  | **26** |

Les extraits déficients relevés par Claude ont été remplacés par une citation continue dans la cohorte A : Air France, AEGEAN soute, KLM cabine, Lufthansa cabine/soute, Iberia cabine et Qatar cabine. Ryanair n’est plus contradictoire : la mention obsolète de « ne pas décider » a été retirée du dossier.

## Faits explicitement en attente — ne pas importer

- Cohorte B : tous les faits sauf Finnair cabine et SAS cabine.
- Cohorte D : les 5 faits.
- Cohorte E : les 3 faits.
- Cohorte F : Vueling cabine.
- Cohortes G à K : non ré-auditées sous le protocole V3.

Ils restent des **pistes de recherche officielles**, non des politiques candidates à l’écran. Les conserver pour gagner du temps de collecte est légitime ; en déduire un statut ne l’est pas.

## Décision sur la citation dans la carte Finder

Ne pas élargir le contrat de la carte dans ce lot. La carte doit afficher le verdict, la source liée, son type et sa date ; le texte verbatim reste sur la fiche compagnie, où il peut être lu avec son contexte et son localisateur. L’import de preuve ne dépend donc pas d’une refonte de la carte.

## Invariants d’intégration

1. Une phrase doit être une citation continue ou une ligne de tableau indivisible, jamais une reconstitution avec `…`.
2. `offered_with_conditions` décrit une possibilité documentaire, jamais une réservation disponible ni une acceptation finale.
3. Un plafond « chien + contenant » donne un refus sûr seulement si le poids du chien seul dépasse ce plafond.
4. La route, la race, la correspondance et l’appareil restent des conditions nommées, pas des détails perdus à l’import.
5. L’import doit être contrôlé : `SourcedQuote` source → `premium.policy` → carte Finder et fiche rendues, avec l’URL et la date accessibles.
