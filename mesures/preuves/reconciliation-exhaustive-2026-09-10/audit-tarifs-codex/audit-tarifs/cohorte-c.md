# Audit indépendant des tarifs officiels — cohorte C

Date de consultation et de vérification : **2026-09-10**  
Périmètre : **34 compagnies × 3 canaux = 102 décisions tarifaires**.  
Révision exacte utilisée pour l'inspection des fiches YAML : **`ff5c60caeb57255df7bd603fb92ccb967da19894`** (lecture par `git show`, sans modifier le dépôt). La branche distante a continué d'avancer pendant l'audit ; ses commits ultérieurs ne sont pas confondus avec cette base.  
Registre machine : `cohorte-c.tsv` (102 lignes, une ligne par compagnie et canal).

## Conclusion utile

Le dépôt ne doit pas republier ses anciens `channels[].fee` ou `fareList` comme s'ils constituaient des tarifs actuels et prouvés. Pour cette cohorte, l'audit trouve :

| Nature du résultat | Canaux |
|---|---:|
| Tarif exact | 13 |
| Matrice tarifaire | 18 |
| Fourchette | 9 |
| Formule | 2 |
| Calculateur officiel | 2 |
| Minimum publié | 1 |
| Sur devis | 16 |
| Sur devis composite | 1 |
| Conflit entre surfaces officielles | 2 |
| Tarif non trouvé | 16 |
| Sans objet, service non offert | 22 |

Les statuts de service se répartissent en **54 offerts**, **14 restreints**, **22 non offerts** et **12 non établis**. `NON_ETABLI` ne signifie jamais « refusé » : cela signifie que la consultation officielle n'a pas permis d'établir le service.

## Écarts prioritaires avec les données historiques

Ces écarts justifient une correction avant toute remise en ligne d'un montant historique :

1. **Smartwings** — les anciens 100/200 EUR sont dépassés : la page officielle publie désormais **120 EUR en cabine** et **220 EUR en soute**, avec équivalents USD/CZK, par trajet.
2. **Volotea** — la soute n'est pas universellement refusée : elle est proposée à **60 EUR**, uniquement sur les routes italiennes de continuité territoriale.
3. **WestJet** — la soute historique reprend à tort la plage cabine. La page officielle publie **100–118** à l'intérieur Canada/États-Unis et **200–236** à l'extérieur, par cage et par direction.
4. **Philippine Airlines** — la plage internationale historique `USD 160–320` est incomplète : le tableau courant contient aussi des paliers **USD 120** et **USD 250**. La matrice complète doit rester structurée par route et poids/pièce.
5. **Saudia** — les anciens **USD 100 / USD 300** ne sont pas prouvés par une page officielle de production accessible. Une page UAT n'est pas une preuve actuelle : cabine, soute et fret restent `NON_TROUVE`/`NON_ETABLI` dans cet audit.
6. **United** — le montant historique **USD 150** n'a pas pu être extrait indépendamment de la page officielle actuelle, rendue par JavaScript. Il demande une capture navigateur officielle avant validation.
7. **South African Airways** — conflit officiel : la version anglaise indique **ZAR 300**, une version portugaise indique **ZAR 250**. Ne pas choisir silencieusement une valeur.
8. **SunExpress** — conflit officiel de locale pour Ercan en soute à l'aéroport (**25 EUR sur la page anglaise, 15 EUR sur la version turque**) ; les exclusions UK et UAE doivent accompagner le tarif.

## Cas SAS — quatre zones, unité impérative

La page SAS dit que les animaux sont facturés **par contenant, par aller simple**, et que les frais sont **facturés par vol**. Ce n'est donc ni un prix par réservation ni un prix garanti pour un itinéraire avec correspondance.

| Zone | Cabine (DKK / NOK / SEK / EUR / USD) | Soute (DKK / NOK / SEK / EUR / USD) |
|---|---|---|
| Vol intérieur | 420 / 550 / 550 / 55 / 60 | 680 / 950 / 950 / 90 / 100 |
| Scandinavie–Europe–Moyen-Orient | 550 / 750 / 750 / 75 / 80 | 1250 / 1740 / 1740 / 169 / 195 |
| Asie–Canada–États-Unis | 740 / 990 / 990 / 99 / 105 | 2500 / 3500 / 3500 / 340 / 370 |
| Chine | 1100 / 1540 / 1540 / 149 / 159 | 5400 / 7600 / 7600 / 725 / 775 |

Réservation : lors de la réservation ou jusqu'à 24 heures avant le départ, sous réserve de capacité. Le fret est requis pour certaines destinations (notamment Chine, Royaume-Uni, Émirats arabes unis) ou lorsque les critères passager ne sont pas satisfaits ; son prix est sur devis.

## Raccordement réel au moteur/Finder

Le contrôle du dépôt montre que les tarifs hérités **ne sont pas raccordés** au bloc de décision lu par le Finder :

- [`objects.ts`](/Users/philippe/Documents/GitHub/mydogcanfly/packages/knowledge/src/objects.ts:123) autorise bien un champ `fee` dans l'ancien modèle ;
- [`ingest-airlines.mjs`](/Users/philippe/Documents/GitHub/mydogcanfly/packages/knowledge/scripts/ingest-airlines.mjs:325) construit cependant la politique à partir de `policies:` ;
- [`ingest-airlines.mjs`](/Users/philippe/Documents/GitHub/mydogcanfly/packages/knowledge/scripts/ingest-airlines.mjs:338) ne consulte `fareList` que pour extraire un **poids cabine**, pas un tarif ;
- aucun `channels[].fee` ou montant de `fareList` n'est projeté comme preuve tarifaire dans `premium.policy`/Finder.

Conséquence : les colonnes `yaml_legacy` du TSV sont des éléments de comparaison et de dette, **jamais des preuves**. Même lorsqu'elles coïncident avec le site officiel, le produit devra stocker le tarif courant avec sa propre URL, son locator, sa date, son unité et sa portée.

## Règles de lecture du registre

- `EXACT`, `RANGE`, `MATRIX`, `FORMULA`, `CALCULATOR` et `MINIMUM` décrivent exactement la nature publiée ; une matrice n'est pas aplatie en « prix moyen ».
- `SUR_DEVIS` signifie que le service est établi mais qu'aucun montant public exploitable n'a été trouvé.
- `CONFLICT` conserve les deux valeurs officielles ; aucune n'est choisie par déduction.
- `NON_TROUVE` signifie qu'aucun tarif exact n'a été trouvé sur la surface officielle consultable. Cela ne vaut ni gratuité ni refus.
- `SANS_OBJET` n'est employé que lorsqu'une source officielle établit que le canal ordinaire n'est pas offert.
- `structured_scope_origin_destination_region` conserve les zones, directions et restrictions de route.
- `billing_subject_and_journey_basis` distingue animal, contenant ou expédition et vol, segment, trajet ou aller simple.
- Les extraits ont été volontairement limités à moins de 25 mots par source.

## Obstacles et réserves de fraîcheur

- **Saudia** : la surface officielle de production n'a pas pu être consultée ; une surface UAT trouvée a été exclue. Les montants historiques ne sont donc pas validés.
- **United** : page officielle JavaScript non extractible dans ce parcours ; contrôle navigateur manuel requis.
- **Virgin Atlantic** : la politique officielle trouvée établit le fret mais sa fraîcheur documentaire est faible ; elle mérite une nouvelle collecte prioritaire.
- **Wizz Air** : la règle de non-transport est claire, mais le PDF historique référencé dans le TSV doit être remplacé par les conditions de transport les plus récentes dès qu'une URL stable est disponible.
- **Royal Air Maroc** : la matrice officielle consultée est servie sur un sous-domaine `pre.` ; conserver cette réserve de provenance.
- Les dates `NON_VISIBLE` signifient qu'aucune date de mise à jour n'était affichée sur la page, non que le contenu est ancien.

## Recommandation d'intégration

Ne pas importer ces valeurs dans un texte libre. Le plus petit modèle utile par tarif est : `channel`, `service_status`, `fare_nature`, `amount/currency`, `scope`, `billing_subject`, `journey_basis`, `booking_deadline`, `source.url`, `source.locator`, `source.quote`, `verified_date`, et éventuellement `page_date`. Les conflits et les tarifs non trouvés doivent rester des états explicites, pas être convertis en montants.

## Annexe — réconciliation Git avec la branche actuelle

Comparaison structurelle, sans nouvelle recherche web :

- état de départ : `ff5c60caeb57255df7bd603fb92ccb967da19894` ;
- état courant retenu : `origin/lot/reconciliation-exhaustive` à `56f546f85cd5e605925e60672bf6ddcf3f564be5` ;
- ce dernier contient `origin/main` à `8290573a4585543f16268d5228feb49aebebf13c`, donc c'est bien l'état le plus avancé des deux références proposées.

### Ce qui ne change pas

Sur les 34 compagnies, **aucun `channels[].fee` et aucun `fareList` ne change** entre les deux révisions. Les constats tarifaires du registre — notamment Smartwings, Volotea, WestJet et Philippine Airlines — ne sont donc pas rendus caducs par un correctif déjà présent dans cette branche. Les montants historiques problématiques restent à réconcilier.

Le code d'ingestion conserve le même contrat : le Finder lit `policies:` ; les anciens tarifs ne lui sont pas raccordés. Il n'existe donc toujours aucune preuve tarifaire structurée issue des `fee`/`fareList`.

### Changements de décision ou sortie d'un état historique

Ce sont les seuls changements qui modifient directement `service_status` ou `legacy` :

| Compagnie | Canal | `ff5c60c` | Branche actuelle | Effet |
|---|---|---|---|---|
| Philippine Airlines | fret | `legacy_unreviewed` | `offered` + source | Le Finder peut décider le fret. |
| Qantas | soute | `legacy_unreviewed` | `offered` + source | Décision nouvelle ; voir réserve ci-dessous. |
| Qantas | fret | `legacy_unreviewed` | `offered` + source | Le fret devient décidé. |
| Royal Jordanian | cabine | `legacy_unreviewed` | `offered` + source | La cabine devient décidée. |
| Saudia | cabine | `legacy_unreviewed` | `not_offered` + source UAT | Décision nouvelle, mais preuve non acceptable pour le présent audit. |
| SKY express | soute | `legacy_unreviewed` | `offered` + source | La soute devient décidée. |
| South African Airways | soute | `legacy_unreviewed` | `offered` + source | La soute devient décidée. |
| South African Airways | fret | `legacy_unreviewed` | `offered` + source | Le fret devient décidé. |
| SunExpress | soute | `legacy_unreviewed` | `offered` + source | La soute devient décidée. |
| TAROM | soute | `legacy_unreviewed` | `offered` + source | La soute devient décidée. |
| TAROM | fret | `legacy_unreviewed` | `offered` + source | Le fret devient décidé. |
| Thai Airways | fret | `undocumented` | `offered` + nouvelle source | Décision et preuve remplacées. |
| Virgin Australia | fret | `legacy_unreviewed` | `offered` + source | Le fret devient décidé. |

Deux écarts demandent une décision humaine plutôt qu'une mise à jour mécanique du TSV :

- **Qantas soute** : la branche s'appuie sur les conditions de transport, qui disent que certains aéroports peuvent autoriser l'animal comme bagage enregistré ; le registre tarifaire avait classé la soute ordinaire `NOT_OFFERED` à partir du parcours Qantas Freight. La politique actuelle est au minimum **conditionnelle à l'aéroport** et ne doit pas devenir une disponibilité générale sans modéliser cette condition.
- **Saudia cabine** : la branche fonde `not_offered` sur `booking-uat.dcloud.saudia.com`. Le présent audit exclut explicitement cette surface UAT comme preuve de production actuelle. La différence est réelle dans Git, mais ne valide pas le fait.

### Raccordement au Finder sans changement de statut

La branche ajoute une `source` structurée à **52 politiques**. Cette provenance est désormais transportée avec `policies:` et peut donc influencer ce que le produit considère comme décidé ou vérifié, même lorsque la valeur `availability` ne change pas.

| Compagnie | Canaux dont le statut reste identique mais dont la preuve est ajoutée |
|---|---|
| Luxair | cabine, soute |
| Malaysia Airlines | cabine, soute |
| Neos | cabine, soute |
| Philippine Airlines | cabine |
| Qantas | cabine |
| Qatar Airways | cabine, soute |
| Royal Jordanian | soute |
| Ryanair | cabine, soute, fret |
| SAS | cabine |
| Saudia | soute — même réserve UAT |
| SKY express | cabine |
| Smartwings | cabine, soute |
| South African Airways | cabine |
| SunExpress | cabine |
| SWISS | cabine, soute |
| TAP | cabine, soute |
| TAROM | cabine |
| Thai Airways | cabine, soute |
| Transavia | cabine, soute |
| Tunisair | cabine, soute |
| Turkish Airlines | cabine, soute |
| United | cabine |
| Vietnam Airlines | cabine, soute |
| Vueling | soute |
| WestJet | cabine, soute |

Les sources ajoutées sur **12 des 13** canaux du tableau précédent complètent le total de 52. Thai Airways fret possédait déjà une source : son statut et sa source ont été remplacés.

### Enrichissements d'éligibilité lus par le Finder

Dix canaux reçoivent également des champs opérationnels absents à `ff5c60c` :

| Compagnie | Canal | Enrichissement ajouté |
|---|---|---|
| SAS | cabine | `max_weight_kg: 8`, contenant inclus |
| SunExpress | cabine | `max_weight_kg: 8`, contenant inclus |
| SWISS | cabine | `max_weight_kg: 8`, contenant inclus |
| TAP | cabine | `max_weight_kg: 8`, contenant inclus |
| TAROM | cabine | `max_weight_kg: 8`, contenant inclus |
| Transavia | cabine | `max_weight_kg: 8`, contenant inclus |
| Tunisair | cabine | `max_weight_kg: 8`, contenant inclus |
| Turkish Airlines | cabine | `max_weight_kg: 8`, contenant inclus |
| Turkish Airlines | soute | `max_weight_kg: 50`, contenant inclus |
| Virgin Australia | cabine | `max_weight_kg: 8`, contenant inclus |

Ces champs peuvent changer l'éligibilité calculée, mais **ne prouvent aucun tarif**.

### Conséquence pour ce livrable

Le TSV demeure l'audit tarifaire à intégrer. Pour l'exploiter sur la branche courante, il faut seulement superposer les 13 mouvements de décision ci-dessus et les dix enrichissements d'éligibilité. Il ne faut surtout pas conclure que les 52 nouvelles sources de politique prouvent les anciens montants : aucune modification de `fee` ou de `fareList` ne les accompagne.
