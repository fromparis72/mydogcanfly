# Audit indépendant des tarifs officiels — cohorte A

Date de lecture : **2026-09-10**  
Périmètre : **34 compagnies × 3 canaux = 102 lignes**  
Livrable tabulaire exhaustif : [`cohorte-a.tsv`](./cohorte-a.tsv)

## Méthode et limites

- Les YAML historiques inspectés pendant cet audit sont ceux du commit exact **`92b2b9f2b35775891c83dd7ba41ecf1e21e794c4`** (`main`, fusion de la PR #36). L'annexe différentielle compare ce même état à **`56f546f85cd5e605925e60672bf6ddcf3f564be5`** (`origin/lot/reconciliation-exhaustive` au 2026-09-10).
- Seules les pages, PDF, centres d’aide et sites cargo appartenant officiellement aux compagnies ont été retenus.
- Un résumé de moteur de recherche a servi à localiser une page, jamais à combler une information absente de cette page.
- Aucun montant de `channels[].fee` ou de `fareList` n’a été repris comme vérité. Il n’apparaît que dans les colonnes `legacy_*`, pour comparaison.
- `NON_ESTABLISHED` signifie que la page officielle consultable ne permet pas d’établir le service. Ce n’est pas un refus.
- `NOT_FOUND` signifie qu’aucun montant actuel n’a été trouvé sur la surface officielle consultable. Ce n’est ni « gratuit », ni une validation du montant historique.
- Les montants « à partir de », les formules au kilogramme, les grilles régionales, les devis et les tarifs exacts sont distingués. La base de facturation et la portée géographique sont consignées séparément.
- Les extraits du TSV sont volontairement très courts. Le `locator` indique la section à relire sur la page officielle.

## Résultat principal

La cohorte ne se résume pas à une grille unique « cabine / soute / fret ». Les 102 lignes se répartissent entre tarifs exacts, grilles régionales, formules, devis, services non offerts et cas que les pages officielles ne permettent pas d’établir.

Le dépôt confirme par ailleurs que les montants historiques sont **dormants** :

- `packages/engine/src/explain.ts` rappelle que le moteur ne calcule plus de montant à partir de `fee` ;
- `packages/engine/src/evaluate.ts` conserve l’ancien accès au tarif dans un commentaire historique, pas dans le chemin exécuté ;
- `packages/ui/src/data/airlines.ts` dit que la décision se lit dans `policies[placement]` ;
- `AirlinePremiumPage.astro` n’autorise pas la publication du champ libre `premium.policy[canal].fee` sans structure de devise, route, base et date.

Conclusion : **aucun tarif du TSV n’est aujourd’hui raccordé au Finder par une preuve tarifaire structurée**. Le Finder consomme des statuts de politique ; `fee` et `fareList` sont des données éditoriales historiques non rendues.

## Mouvement par rapport aux données historiques

Les écarts les plus importants à traiter avant toute réactivation de prix sont :

1. **China Eastern** : le YAML dit cabine non offerte ; la règle officielle actuelle permet une demande sur certains vols domestiques via l’application. C’est un écart de statut, pas seulement de prix.
2. **Batik Air Indonesia et Malaysia** : les trois refus écrits dans les YAML ne sont pas prouvés par une page officielle accessible. Ils doivent rester « non établis » tant qu’une règle officielle n’est pas obtenue.
3. **Alaska** : la soute historique à USD 150 est désormais annoncée à USD 200 par un article officiel daté du 26 août 2026. La cabine reste USD 100, avec USD 35 pour un voyage entièrement à Hawaï.
4. **Air Europa** : la grille actuelle 36/52/155 en cabine et 93/155/310 en soute ne correspond plus aux fourchettes historiques.
5. **ANA** : le domestique est passé à JPY 6 600 / 4 400 à compter du 19 mai 2026 ; les JPY 6 000 / 4 000 historiques sont périmés.
6. **Austrian** : l’Europe cabine vaut actuellement EUR 80, pas EUR 75. La grille soute actuelle est 80–380 selon zone et taille.
7. **Brussels Airlines** : plusieurs montants historiques sont trop bas ; l’Europe vaut désormais EUR 80 en cabine et EUR 200 en soute.
8. **American** : le supplément universel `Quote + $150` attribué au cargo n’est pas retrouvé. Le site dit seulement que le prix cargo sera confirmé à la réservation.
9. **Air Caraïbes** : EUR 75 cabine et EUR 150 soute sont corroborés pour le transatlantique ; les anciens EUR 10 / 20 court-courrier n’ont pas été retrouvés sur la page actuelle.
10. **Air France, Aeroméxico, Aerolíneas Argentinas** : les prix historiques existent dans le YAML, mais la surface officielle actuelle consultée ne les publie pas sous une forme vérifiable. Ils ne doivent pas être réactivés.

## Vue synthétique par compagnie

| Compagnie | Cabine | Soute | Fret | Diagnostic sur l’historique |
|---|---|---|---|---|
| AEGEAN | 35 / 65 EUR | 50–190 EUR selon poids, zone et correspondance | devis/non trouvé | grille historique corroborée |
| Aer Lingus | non offerte | pas comme bagage passager | via agent/IAG Cargo, devis | ancien PDF EUR 160 de 2010 rejeté comme périmé |
| Aerolíneas Argentinas | offerte, prix actuel non trouvé | non établi | grille cargo officielle | montants cabine/soute historiques non corroborés |
| Aeroméxico | offerte, prix non extrait | offerte, prix non extrait | non établi | fourchettes historiques non corroborées |
| Air Algérie | taux excédent + cas Chine explicite | idem | contact fret | formule historique partiellement corroborée |
| Air Astana | 2× excédent par kg | 2× excédent par kg | devis | formule corroborée, montant dépend du trajet |
| Air Austral | 125 EUR / trajet | 200 EUR / trajet | devis | montants corroborés |
| Air Canada | CAD 50–120 | CAD 105–324 | devis | grille corroborée, page datée 2024-10-28 |
| Air Caraïbes | 75 EUR transatlantique | 150 EUR transatlantique | devis | anciens 10/20 EUR non retrouvés |
| Air China | non offerte | CNY 3 900 / 5 200 / 7 800 selon poids | devis | PDF officiel lié mais version 2022 |
| Air Europa | EUR 36 / 52 / 155 | EUR 93 / 155 / 310 | devis | historique périmé |
| Air France | offerte, tarif non trouvé | offerte, tarif non trouvé | devis | anciennes fourchettes non corroborées |
| Air India | INR 7 500; USD 140/160/225 | INR 16 000; USD 350 | devis | grille largement corroborée; vérifier le sous-groupe Europe |
| Air Mauritius | non offerte | taux excédent | devis | formule corroborée |
| Air New Zealand | non offerte | NZD 120 domestique | transporteur agréé, devis | montant corroboré |
| Air Serbia | EUR 40–130 par zone | non offerte | non établi | grille cabine corroborée |
| Air Tahiti Nui | XPF 14 000/24 000; USD/EUR 150 | non établi | devis | grille cabine corroborée |
| Air Transat | CAD 50 / 100 | CAD 100 / 150 / 275 | non établi | grille corroborée |
| airBaltic | EUR 70 | EUR 130 / 220 | devis | grille corroborée |
| Aircalin | non offerte | pas comme bagage passager | fret uniquement, devis | refus cabine/soute corroboré, prix cargo absent |
| Alaska | USD 100; 35 intra-Hawaï | USD 200, remises non chiffrées | calcul/devis Pet Connect | soute historique USD 150 périmée |
| American | USD 150 | USD 200; 150 Brésil, personnels officiels seulement | devis | `Quote + $150` cargo non corroboré |
| ANA | non offerte | USD 250/400 international; JPY 6 600/4 400 domestique | devis | domestique historique périmé |
| Asiana | même grille régionale, cabine sous limite de poids | KRW 30 000–590 000 selon poids/zone | non établi | historique incomplet au-dessus de 32 kg |
| Austrian | EUR 65–125 | EUR 80–380 + transfert | devis | Europe cabine historique périmé |
| Avianca | tarifs « à partir de » multi-devises | tarifs « à partir de » multi-devises | devis | grille historique trop agrégée |
| Bangkok Airways | non offerte | THB 180/kg domestique; USD 8–48/kg zones internationales | devis | historique omet la grille internationale |
| Batik Air Indonesia | non établi | non établi | non établi | les refus historiques sont sans preuve officielle accessible |
| Batik Air Malaysia | non établi | non établi | non établi | les refus historiques sont sans preuve officielle accessible |
| British Airways | non offerte | pas comme bagage passager | devis selon poids/taille/distance | statut cargo corroboré |
| Brussels Airlines | EUR 65–115 selon zone | EUR 160–380 selon zone + transfert | devis | plusieurs valeurs historiques périmées |
| Cathay Pacific | non offerte | pas comme bagage passager | Cathay Cargo via agent, devis | anciens tarifs bagage non traités comme actuels |
| China Airlines | non offerte | grille interactive; fixe ≤32 kg, double >32 kg | devis | formule corroborée, chiffres non capturés |
| China Eastern | limitée à certains vols domestiques | formule excédent par kg / zone | non établi | statut cabine historique contredit par la règle actuelle |

## Points de vigilance avant intégration

### Ne pas confondre « soute » et « fret »

Aer Lingus, Aircalin, British Airways et Cathay placent physiquement l’animal dans une soute, mais le contrat commercial est du fret/manifeste cargo. Les classer `hold: offered` comme bagage accompagné serait trompeur.

### Ne pas réduire une grille à une fourchette

Une fourchette ne permet pas d’établir le prix du trajet. C’est particulièrement vrai pour AEGEAN, Air Canada, Air Europa, Air India, Air Transat, Asiana, Austrian, Avianca et Brussels Airlines. Une future structure devrait conserver :

- le sujet facturé : animal, contenant ou expédition ;
- la base de voyage : segment, direction, trajet ou itinéraire ;
- la zone origine/destination ;
- le poids et/ou la taille ;
- la devise de départ ;
- la date de lecture et, lorsqu’elle existe, la date d’effet de la page.

### Pages officielles dynamiques ou incomplètes

- **Aeroméxico** : la page annonce une section de coûts, mais les chiffres n’étaient pas présents dans le document officiel récupérable.
- **Aerolíneas Argentinas** : la cabine se paie via WhatsApp ; aucune grille actuelle n’était visible. La page soute passager n’a pas été retrouvée.
- **Air France** : le prix est rattaché au parcours de réservation ; aucune grille actuelle statique n’a été trouvée.
- **China Airlines** : le tarif utilise un sélecteur origine/destination. La règle fixe/double est visible, pas les montants du widget.
- **Batik Air** : aucune politique animaux officielle exploitable n’a été trouvée sur les deux sites. Le résultat est `NON_ESTABLISHED`, pas `NOT_OFFERED`.

## Recommandation d’usage

Ce livrable est une **collecte de preuve**, pas un correctif de données. L’intégration devrait être une passe séparée avec un modèle tarifaire structuré. À défaut de ce modèle, la bonne sortie publique est « tarif à confirmer auprès de la compagnie » avec le lien officiel, jamais la remise en service de `fee` ou `fareList`.

Priorité de contre-vérification humaine avant intégration :

1. China Eastern cabine — changement de statut ;
2. Batik Air × 2 — refus non prouvés ;
3. Air Europa, Alaska, ANA, Austrian, Brussels — tarifs historiques manifestement périmés ;
4. Air France, Aeroméxico, Aerolíneas Argentinas — prix actuels non récupérables sans parcours interactif/contact ;
5. Air India — résoudre le conflit de libellé de zone cabine entre FAQ et PDF officiel.

## Annexe — différentiel avec `origin/lot/reconciliation-exhaustive`

Cette annexe est une comparaison Git des 34 YAML, **sans nouvel audit web**. Elle ne reprend que les écarts qui changent l'état de service, retirent `legacy_unreviewed` ou modifient le verdict consommé par le Finder.

### Résultat global

- `channels[].fee` : **aucun écart** sur les 34 fiches.
- `fareList` : **aucun écart** sur les 34 fiches.
- état brut de `policies` : **12 canaux changent** ; dix cargos passent de `legacy_unreviewed` à `offered`, Aer Lingus soute passe de `not_offered` à `offered`, Air China cabine de `not_offered` à `offered`.
- raccord Finder : **63 canaux de 29 compagnies** passent de `confirmation_required` à un verdict cité — **54 `allowed` et 9 `denied`**. Les cinq compagnies sans changement de raccord sont Air New Zealand, Air Serbia, airBaltic, Batik Air Malaysia et British Airways.

La différence entre 12 et 63 est intentionnelle : sur 51 canaux, la valeur `availability` ne change pas, mais l'ajout d'une source officielle avec citation, langue et locator franchit la frontière de confiance de `projectPlacementPolicy()` et rend le verdict catégorique dans le Finder.

### Les 12 changements d'état brut

| Compagnie | Canal | `92b2b9f` | `56f546f` | Effet Finder |
|---|---|---|---|---|
| Aer Lingus | soute | `not_offered` non cité | `offered` cité | confirmation → allowed |
| Aerolíneas Argentinas | fret | `legacy_unreviewed` | `offered` cité | confirmation → allowed |
| Air Astana | fret | `legacy_unreviewed` | `offered` cité | confirmation → allowed |
| Air Caraïbes | fret | `legacy_unreviewed` | `offered` cité | confirmation → allowed |
| Air China | cabine | `not_offered` non cité | `offered` cité | confirmation → allowed |
| Air India | fret | `legacy_unreviewed` | `offered` cité | confirmation → allowed |
| Air Mauritius | fret | `legacy_unreviewed` | `offered` cité | confirmation → allowed |
| Air Tahiti Nui | fret | `legacy_unreviewed` | `offered` cité | confirmation → allowed |
| Aircalin | fret | `legacy_unreviewed` | `offered` cité | confirmation → allowed |
| Alaska | fret | `legacy_unreviewed` | `offered` cité | confirmation → allowed |
| Bangkok Airways | fret | `legacy_unreviewed` | `offered` cité | confirmation → allowed |
| Cathay Pacific | fret | `legacy_unreviewed` | `offered` cité | confirmation → allowed |

### Tous les changements de raccord Finder

Dans chaque ligne ci-dessous, l'état de départ est `confirmation_required`. La mention « donnée changée » identifie les 12 cas du tableau précédent ; les autres sont des promotions dues à l'ajout d'une preuve citée.

| Compagnie | Canaux après réconciliation |
|---|---|
| AEGEAN | cabine `allowed` ; soute `allowed` |
| Aer Lingus | cabine `denied` ; soute `allowed` — donnée changée |
| Aerolíneas Argentinas | cabine `allowed` ; soute `allowed` ; fret `allowed` — donnée changée |
| Aeroméxico | cabine `allowed` ; soute `allowed` |
| Air Algérie | cabine `allowed` ; soute `allowed` |
| Air Astana | cabine `allowed` ; soute `allowed` ; fret `allowed` — donnée changée |
| Air Austral | cabine `allowed` ; soute `allowed` |
| Air Canada | cabine `allowed` ; soute `allowed` |
| Air Caraïbes | cabine `allowed` ; soute `allowed` ; fret `allowed` — donnée changée |
| Air China | cabine `allowed` — donnée changée ; soute `allowed` |
| Air Europa | cabine `allowed` ; soute `allowed` |
| Air France | cabine `allowed` ; soute `allowed` |
| Air India | cabine `allowed` ; soute `allowed` ; fret `allowed` — donnée changée |
| Air Mauritius | cabine `denied` ; soute `allowed` ; fret `allowed` — donnée changée |
| Air Tahiti Nui | cabine `allowed` ; fret `allowed` — donnée changée |
| Air Transat | cabine `allowed` ; soute `allowed` |
| Aircalin | cabine `denied` ; soute `denied` ; fret `allowed` — donnée changée |
| Alaska | cabine `allowed` ; soute `allowed` ; fret `allowed` — donnée changée |
| American | cabine `allowed` ; fret `allowed` |
| ANA | cabine `denied` ; soute `allowed` |
| Asiana | cabine `allowed` ; soute `allowed` |
| Austrian | cabine `allowed` ; soute `allowed` |
| Avianca | cabine `allowed` ; soute `allowed` |
| Bangkok Airways | fret `allowed` — donnée changée |
| Batik Air Indonesia | cabine `denied` ; soute `denied` |
| Brussels Airlines | cabine `allowed` ; soute `allowed` |
| Cathay Pacific | cabine `denied` ; fret `allowed` — donnée changée |
| China Airlines | soute `allowed` |
| China Eastern | cabine `denied` ; soute `allowed` |

### Écarts qui imposent une réconciliation humaine

Cette comparaison ne suffit pas à arbitrer trois contradictions avec la collecte tarifaire :

1. **Air China cabine** : l'audit tarifaire avait conclu « non offerte » depuis la page bagages consultée ; la branche ajoute un accord officiel distinct qui dit `offered`. Le verdict de la branche ne doit être accepté qu'après validation de sa portée (vols opérés, routes, dates et conditions).
2. **Aer Lingus soute** : la branche écrit `hold: offered`, alors que l'audit distingue le transport physique en soute du contrat commercial via agent/fret. Il faut décider si `hold` signifie emplacement physique ou bagage accompagné ; sinon le Finder mélangera deux services.
3. **Batik Air Indonesia** : l'audit n'avait pas trouvé de page officielle exploitable et avait conclu `NON_ESTABLISHED`; la branche rattache désormais une page d'aide officielle et produit deux `denied`. Cette preuve nouvelle n'a pas été reconsultée dans le présent différentiel et doit être contre-lue avant intégration.

Les autres promotions indiquent ce que **produirait** la branche par la frontière de confiance ; elles ne constituent pas une seconde validation indépendante de la justesse des citations ni de leur portée.
