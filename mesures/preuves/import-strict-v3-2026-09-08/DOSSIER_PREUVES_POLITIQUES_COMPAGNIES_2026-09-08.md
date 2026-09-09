# Dossier de preuves — politiques chiens des compagnies

**État :** lot de recherche, sans modification de donnée ni de code.  
**Établi le :** 8 septembre 2026.  
**But :** rendre au Finder des réponses utiles sur le *mode de transport* sans faire passer une disponibilité de place, une règle de pays ou une donnée historique pour une décision de la compagnie.

## Règle de travail non négociable

Une réponse catégorique ne peut être produite que si le dossier porte, pour le fait précis :

```yaml
source_type: official_website
url: "https://..."                 # page de la compagnie, jamais MyDogCanFly
quote: "phrase reproduite à l’identique"
quote_language: en                  # BCP-47
locator: "titre de section → sous-section"
verified_date: "2026-09-08"        # date de LECTURE directe, pas la date de publication
review_due: derive(reviewDueFrom(verified_date, "airline"))
confidence: 4
reviewer: "Codex — lecture directe de la page officielle"
```

Au 8 septembre, la cadence `airline` est de 90 jours : une lecture du `2026-09-08` donne donc une révision le `2026-12-07`. **Le code doit néanmoins calculer cette valeur avec `reviewDueFrom`, jamais recopier le résultat.**

`availability: offered` signifie seulement : *la compagnie publie ce mode de transport sous les conditions citées*. Il ne signifie ni « place disponible sur ce vol », ni « le chien concret satisfait déjà toutes les conditions ». La disponibilité doit être affichée comme une condition de réservation secondaire, pas faire retomber tout le résultat en « inconnu ».

### Point de modélisation indispensable

Le formulaire recueille le poids du **chien**, tandis que les plafonds officiels comprennent presque toujours chien + contenant. Il est donc sûr de refuser la cabine à un chien de 30 ou 32 kg lorsqu’un plafond est de 8 kg, mais il n’est **pas** sûr de conclure « cabine acceptée » à 7,5 kg sans connaître le poids du sac.

Ne pas réactiver les règles existantes telles quelles : plusieurs s’auto-citent encore (`mydogcanfly.com`) et certaines confondent poids du chien et poids chien + contenant. Conserver leurs identifiants comme pistes d’audit seulement.

## Cohorte A — éléments directement exploitables maintenant

Tous les liens ci-dessous ont été lus le **2026-09-08**. Chaque citation est courte et doit être copiée à l’octet près dans le YAML. Les sources à date antérieure déjà intégrées ne sont pas « remises à zéro » : ces lectures constituent une nouvelle preuve datée.

| Compagnie / faits publiables | Citation verbatim et localisateur | Effet attendu dans le Finder |
| --- | --- | --- |
| **Air France** — chien + contenant de plus de 8 kg et jusqu’à 75 kg | [Page officielle](https://wwws.airfrance.fr/en/information/passagers/voyager-avec-son-animal-chien-chat), `Important!` : “If your cat or dog weighs more than 8 kg/17.64 lb. and up to 75 kg/165.35 lb. with its carrier, it must travel in the hold.” | Pour un Golden de 32 kg : **cabine non adaptée / soute proposée sous conditions**. Conserver l’obligation de réservation et l’acceptation finale de la réservation comme conditions ; ne pas les présenter comme une absence de politique. Ne pas statuer cargo sans une citation dédiée. |
| **AEGEAN** — cabine | [Page officielle](https://en.aegeanair.com/travel-info/travelling-with-aegean/special-assistance/traveling-with-pet/), `Pets in cabin` : “The maximum permitted weight for a pet, combined with its container, is eight (8) kilos.” | Règle de refus cabine sûre dès que le seul chien dépasse 8 kg. En dessous : condition « poids total avec contenant ≤ 8 kg », pas feu vert absolu. |
| **AEGEAN** — soute | Même page, `Animals in aircraft hold` : “If you have a larger cat or dog which exceeds the eight (8) kilos weight limit (including its container), then it should only be transported in the baggage hold compartment of the aircraft.” | Soute **proposée sous conditions** pour le grand chien. Préserver les exceptions : correspondance >3 h, races particulières, appareil, destination. |
| **AEGEAN** — fret | Même page, `Pets & animals as cargo` : “Please contact our Cargo Department” pour animal non accompagné, caisse hors dimensions, ou UK. | Ne pas promettre le fret pour chaque trajet ; le présenter comme orientation conditionnelle dans les cas cités. |
| **Transavia** — cabine | [Page officielle](https://www.transavia.com/help/en-eu/children-pets-groups/pets-on-board/cabin), `Weight` : “Maximum weight of the pet, including the carrying bag: 8 kg.” | Pour 32 kg : **cabine non adaptée**. Sous 8 kg chien seul : « possible seulement si total avec sac ≤8 kg ». |
| **Transavia** — soute | [Page officielle](https://www.transavia.com/help/en-eu/children-pets-groups/pets-on-board/hold-luggage-pet), ouverture : “You may transport your pet in our cargo hold.” | **Soute proposée sous conditions**. La même source exclut les races brachycéphales de soute et limite à deux animaux par vol : ce sont des conditions, pas une réponse sur l’existence d’une place. |
| **easyJet** — animaux de compagnie | [Page officielle](https://www.easyjet.com/en/help/baggage/restricted-and-unusual-items), `Pets` : “Animals are not allowed on our flights, apart from recognised registered guide and assistance dogs.” | Pour un chien de compagnie : **cabine et soute non proposées**. Ne rien dire sur un service cargo tiers sans source easyJet distincte. Les chiens d’assistance sont hors du modèle « animal de compagnie ». |
| **KLM** — cabine | [Page officielle](https://www.klm.com/information/pets/reservation), `Pets in the cabin` : “Because they'll need to travel underneath the seat in front of you, the bag or kennel can weigh no more than 8 kg (17.6 lb), with your pet inside.” | Refus cabine sûr si chien seul >8 kg. En dessous, exprimer la condition du poids combiné et les classes/routes exclues. |
| **KLM** — soute | Même page, `Pets in the hold` : “You can bring up to 3 pets in the hold.” et “Keep your pet and kennel's combined weight under 75 kg.” | **Soute proposée sous conditions** ; conserver les exclusions publiées (certaines flottes, correspondance ≥3 h, Royaume-Uni, races brachycéphales). |
| **Lufthansa** — cabine | [Page officielle](https://www.lufthansa.com/ua/en/travelling-with-animals), `What travel options…` : “Only smaller dogs and cats weighing no more than 8 kg including their transport container may be transported under certain conditions as additional carry-on baggage in the passenger cabin.” | Pour chien de 32 kg : **cabine non adaptée**. Sous le seuil : poids total avec contenant et route à vérifier. |
| **Lufthansa** — soute | Même page : “Dogs and cats weighing more than 8 kg including their transport container may be carried as excess baggage in the aircraft’s air-conditioned cargo hold under certain conditions.” | **Soute proposée sous conditions** pour grand chien ; disponibilité et route sont des conditions, non une absence d’information. |
| **SWISS** — transport passager | [Page officielle](https://www.swiss.com/xx/en/prepare/special-care/animals-travelling), introduction : “It will travel … either in the cabin or in the hold.” | Preuve que les deux modes existent, mais avant une réponse individualisée il faut compléter la citation sur les seuils/races/itinéraires. Ne pas inventer le seuil depuis une fiche historique. |
| **British Airways** — cabine | [Page officielle](https://www.britishairways.com/content/information/travel-assistance/travelling-with-pets), `Travelling to and from the UK` : “We don’t carry pets in the cabin on any route.” | Déjà preuve forte : **cabine non proposée** pour animal de compagnie sur toute route. Maintenir la preuve existante ; ne pas déduire de cette phrase un refus de soute ou de fret. |
| **Iberia** — cabine | [Page officielle](https://www.iberia.com/us/fly-with-iberia/pets/), `Acceptance in the cabin` : “Dogs, cats, ornamental fish, tortoises and birds (except poultry and birds of prey) may travel with you in the cabin if they do not exceed 8 kg in weight, including the pet carrier.” | Pour chien de 32 kg : **cabine non adaptée**. Sous le seuil, citer le poids total et les conditions de contrôle au comptoir. |
| **Iberia** — soute | Même page, `Acceptance in hold` : “allow cats and dogs to travel in the hold”, avec les exceptions de races indiquées. | **Soute proposée sous conditions**. Le plafond est de 45 kg, animal + contenant ; ne pas oublier les races exclues, autorisation préalable et transit. |
| **Iberia** — fret | Même page, `Acceptance as cargo` : “If for any reason your pet cannot travel with you in the cabin or hold, you can transport it as cargo”. | Fret **conditionnel** (dont poids total >45 kg, restrictions de destination ou de race) ; pas une promesse globale. |
| **TAP Air Portugal** — cabine | [Page officielle](https://www.flytap.com/en-gb/information/traveling-with-animals/pets), `Transporting pets in the cabin → Weight and size` : “Maximum total weight: 8 kg / 17 lbs (pets + carrier).” | Pour chien de 32 kg : **cabine non adaptée**. Sous le seuil, conserver le poids combiné, l’avion, l’origine/destination et la réservation parmi les conditions. |
| **TAP Air Portugal** — soute | Même page, `General acceptance criteria` : “whether in the cabin or in the aircraft's hold” ; `Maximum total weight` : 32 kg vers/de/passage France, États-Unis, Hongrie ou Pays-Bas, 45 kg ailleurs, contenant compris. | **Soute proposée sous conditions** ; pour une recherche vers/depuis France, un chien de 32 kg ne peut pas être catégoriquement accepté sans connaître le poids de la caisse. La liste officielle exclut notamment le carlin de soute, sauf exception documentée. |
| **Turkish Airlines** — cabine et soute | [Page officielle](https://www.turkishairlines.com/en-ch/any-questions/traveling-with-pets/), `Are there weight or size limits…` : “Pets traveling in the aircraft cabin cannot exceed a total of 8 kg, including their carrier.” | Pour chien de 32 kg : **cabine non adaptée**. La même source limite la soute à 50 kg, animal + caisse, avec dimensions maximales : soute proposée sous conditions. |
| **Qatar Airways** — cabine | [Portail officiel partenaires](https://www.qatarairways.com/tradeportal/en/specialservices/Carriage-of-live-animals.html), `Carriage of Live Animals` : “With effect from 11 January 2021, Qatar Airways will only accept service animal (SVAN) on board QR operated flights on regulated routes to assist passengers with a disability, with a maximum of 2 dogs per passenger.” | Pour le modèle « chien de compagnie » : **cabine non proposée**. Les chiens d’assistance sont un parcours distinct. |
| **Qatar Airways** — soute | [Page officielle](https://www.qatarairways.com/en-au/baggage/animals.html), `Eligibility` : “We accept domesticated dogs, cats and birds as checked baggage”, avec exigences de santé et de pays. | **Soute proposée sous conditions**. Fret imposé dans les cas publiés (animal seul, >75 kg, certaines dimensions/destinations/connexions). |

## Format attendu pour l’intégration

1. Mettre à jour **une compagnie à la fois** dans `content/airlines/<id>.yml` ; ne jamais copier une URL dans `rules.json` sans citer aussi la phrase qui déclenche la règle.
2. Pour les statuts de canal, réemployer `T0bAuditSource` dans `packages/knowledge/src/t0b-migration.ts` via l’ingestion existante. Une URL officielle sans citation reste `official_source_unquoted` et ne donne pas un verdict ferme.
3. Ajouter les conditions multilingues au bloc `policies`, mais ne pas remettre en service `channels[].cls` comme source décisionnelle.
4. Pour un seuil qui concerne **animal + contenant**, la règle moteur peut refuser au-dessus du seuil lorsque le chien seul le dépasse. Elle ne doit jamais autoriser de façon absolue sous le seuil sans le poids du contenant.
5. Ajouter un test de scénario pour chaque import :
   - grand chien : par ex. Golden Retriever, 32 kg ;
   - petit chien sous condition de contenant ;
   - race brachycéphale lorsque la page le traite ;
   - route avec exception connue (UK / USA / correspondance) quand la source la nomme.
6. Ne pas modifier les anciens tarifs, listes de races ou règles météo au passage : ce lot porte seulement les faits réellement lus ci-dessus.

## Résultat cible visible — exemple Paris → Athènes, Golden Retriever 32 kg

Le Finder ne doit ni dire « 0 options confirmées », ni prétendre qu’un siège animal est réservé. Il doit pouvoir exprimer, avec le lien et la date de la preuve :

* **Cabine : non adaptée** chez Air France, AEGEAN, Transavia, KLM et Lufthansa car les pages publiées plafonnent le poids total à 8 kg ; un chien de 32 kg dépasse ce plafond à lui seul.
* **Soute : proposée sous conditions** chez Air France, AEGEAN, Transavia, KLM et Lufthansa, avec la condition de réservation et les exceptions propres à chaque source.
* **easyJet : animaux de compagnie non transportés.**
* Les autres compagnies du trajet restent des pistes tant qu’aucune citation équivalente n’est importée : elles ne doivent pas contaminer le verdict des compagnies réellement prouvées.

## Cohorte B — 13 faits supplémentaires, directement exploitables

Le fichier machine correspondant est [PREUVES_POLITIQUES_COMPAGNIES_COHORTE_B_2026-09-08.json](PREUVES_POLITIQUES_COMPAGNIES_COHORTE_B_2026-09-08.json). Toutes les pages ont été relues directement le **2026-09-08**, avec le même contrat de preuve que la cohorte A.

| Compagnie / faits publiables | Citation et portée exacte | Effet Finder sûr |
| --- | --- | --- |
| **Finnair** — cabine | [Page officielle](https://www.finnair.com/en/pets-on-finnair-flights), `Travel options for pets → Pets in cabin` : “Max. 8 kg (17.6 lb).” Le plafond porte sur l’animal **et** le contenant. | Chien seul de 30/32 kg : **cabine non adaptée**. Sous 8 kg chien seul : pas de feu vert absolu. |
| **Finnair** — soute et fret | Même page, `Pets in aircraft hold` : les grands chiens peuvent voyager en soute, jusqu’à 75 kg contenant compris (50 kg sur Norra). `Pets as cargo` impose le fret au-delà ou dans les cas de route/non-accompagnement publiés. | Soute **proposée sous conditions** ; fret uniquement dans les cas explicitement nommés. |
| **SAS** — cabine | [Page officielle](https://www.flysas.com/en/travel-info/travel-with-pets/cabin), `Pet carrier requirements` : “Max weight: 8 kg (including pet).” | Chien seul de 30/32 kg : **cabine non adaptée**. |
| **SAS** — soute | [Page officielle](https://www.flysas.com/us-en/travel-info/travel-with-pets/in-hold), `Pets traveling in hold` : chien/chat seulement, maximum 50 kg contenant compris ; plusieurs races brachycéphales sont explicitement exclues. | Soute **proposée sous conditions** pour un grand chien non exclu ; pas pour les races citées. |
| **Brussels Airlines** — cabine | [Page officielle](https://www.brusselsairlines.com/be/en/special-care/pets/cats-and-small-dogs-in-the-cabin), `Which conditions apply…` : maximum 8 kg, sac compris. | Chien seul de 30/32 kg : **cabine non adaptée**. |
| **Brussels Airlines** — soute et fret | [Soute officielle](https://www.brusselsairlines.com/be/en/special-care/pets/cats-and-dogs-in-the-hold) : chat/chien en partie ventilée de soute ; contenant max. 125 × 75 × 85 cm, au-delà fret. | Soute **proposée sous conditions** ; fret seulement si le cas dépasse les limites ou relève d’une route spécifiquement exclue. |
| **American Airlines** — cabine / soute / fret | [Page officielle](https://www.aa.com/web/i18n/travel-info/special-assistance/pets.html). La cabine est publiée sous contraintes de taille, âge et destination, sans seuil kilogramme simple. La soute accompagnée est réservée aux militaires actifs et agents Foreign Service en mission officielle. Cargo PetEmbark est documenté pour les autres cas. | Ne pas inventer un seuil cabine. Pour le public normal : **soute accompagnée non proposée**, fret conditionnel. |
| **Singapore Airlines** — soute et fret | [Page officielle](https://www.singaporeair.com/en_UK/gb/travel-info/special-assistance/travelling-with-pets/) : chien/chat en bagage enregistré sous conditions ; au-delà de 32 kg animal + contenant, arrangement via agent fret. | Soute **proposée sous conditions** ; à 32 kg chien seul, ne pas conclure sans poids du contenant. **Cabine laissée inconnue** : l’absence de phrase officielle n’est pas un refus. |

## Cohorte C — refus global documenté, directement exploitable

Le fichier machine correspondant est [PREUVES_POLITIQUES_COMPAGNIES_COHORTE_C_2026-09-08.json](PREUVES_POLITIQUES_COMPAGNIES_COHORTE_C_2026-09-08.json).

| Compagnie / faits publiables | Citation et portée exacte | Effet Finder sûr |
| --- | --- | --- |
| **Ryanair** — cabine et soute | [Centre d’aide officiel](https://help.ryanair.com/hc/en-us/articles/12890968181521-Does-Ryanair-carry-animals), `Does Ryanair carry animals?` : “We do not carry animals on board any Ryanair flights, except guide/assistance dogs on certain routes.” | Pour le chien de compagnie : **non transporté**, en cabine comme en soute. Le parcours des chiens guides/d’assistance ne doit jamais se mêler au résultat « animal de compagnie ». |
| **Ryanair** — fret | [Conditions officielles](https://oat.ryanair.com/hr/en/useful-info/help-centre/terms-and-conditions), `8.8.2` : “We do not carry cargo on our flights.” | **Pas de fret Ryanair** à suggérer au visiteur. |

## Cohorte D — 5 faits nord-américains, directement exploitables

Le fichier machine correspondant est [PREUVES_POLITIQUES_COMPAGNIES_COHORTE_D_2026-09-08.json](PREUVES_POLITIQUES_COMPAGNIES_COHORTE_D_2026-09-08.json).

| Compagnie / faits publiables | Citation et portée exacte | Effet Finder sûr |
| --- | --- | --- |
| **Air Canada** — cabine | [Page officielle](https://www.aircanada.com/ca/en/aco/home/plan/special-assistance/pets.html), `In the Cabin` : chat ou petit chien en sac souple sous le siège. Elle ne donne pas un plafond de poids de chien seul. | Chemin cabine **proposé sous conditions de taille** ; ne pas inventer un oui/non fondé seulement sur le poids. |
| **Air Canada** — soute | Même page : maximum de **45 kg chien + caisse**, soute pressurisée sur la plupart des appareils, avec exclusions météo, aéronef, pays et races. | Pour un chien de 32 kg : soute **proposée sous conditions**, jamais « acceptée » sans le poids de caisse et l’itinéraire. |
| **Air Canada** — fret | Même page : AC Animals pour une caisse dépassant les limites passager ou un animal seul. | Fret **conditionnel**. |
| **Delta** — cabine | [Page officielle](https://www.delta.com/us/en/pet-travel/overview), `Traveling with In-Cabin Pets` : petit chien/chat satisfaisant les exigences d’âge, santé, taille et caisse ; plusieurs destinations ne permettent pas la cabine. | Chemin cabine **proposé sous conditions** mais pas de verdict par poids seul. |
| **Delta** — fret | [Page officielle](https://www.delta.com/us/en/pet-travel/shipping-your-pet), `Shipping Your Pet` : expédition temporairement limitée aux militaires américains actifs et agents Foreign Service avec ordre de mutation. | Pour le grand public : **fret non proposé actuellement**. La soute reste volontairement non décidée : aucune phrase consommateur aussi nette n’a été trouvée dans la lecture directe. |

## Cohorte E — Emirates, 3 faits directement exploitables

Le fichier machine correspondant est [PREUVES_POLITIQUES_COMPAGNIES_COHORTE_E_2026-09-08.json](PREUVES_POLITIQUES_COMPAGNIES_COHORTE_E_2026-09-08.json).

| Compagnie / faits publiables | Citation et portée exacte | Effet Finder sûr |
| --- | --- | --- |
| **Emirates** — cabine | [Page officielle](https://www.emirates.com/us/english/before-you-fly/baggage/unusual-baggage-and-special-allowances/), `Pets` : les animaux ne sont pas autorisés en cabine, exception limitée aux faucons sur certaines liaisons de Dubaï. | Pour le chien de compagnie : **cabine non proposée**. Les chiens d’assistance sont un parcours distinct. |
| **Emirates** — soute | [Formulaire officiel](https://www.emirates.com/english/help/forms/pets-travel/) : animal en excédent bagage dans une zone spéciale de soute. | Soute **proposée sous conditions**, sans promettre une place ni ignorer les conditions d’itinéraire. |
| **Emirates** — fret | Même page : au-delà de 300 cm de dimensions linéaires de caisse, fret obligatoire. | Fret **conditionnel**, fondé sur la caisse, non sur une approximation du poids du chien. |

## Cohorte F — Vueling, 2 faits directement exploitables

Le fichier machine correspondant est [PREUVES_POLITIQUES_COMPAGNIES_COHORTE_F_2026-09-08.json](PREUVES_POLITIQUES_COMPAGNIES_COHORTE_F_2026-09-08.json).

| Compagnie / faits publiables | Citation et portée exacte | Effet Finder sûr |
| --- | --- | --- |
| **Vueling** — cabine | [Aide officielle](https://help.vueling.com/hc/en-gb/articles/19798818168337-Fly-with-my-Pet) : sac non rigide, **10 kg animal compris**, dimensions max. 45 × 39 × 21 cm. | Chien seul de 30/32 kg : **cabine non adaptée**. Sous 10 kg chien seul, garder la condition du poids combiné et des routes exclues. |
| **Vueling** — soute | Même page : « animals cannot be carried in the plane’s cargo hold ». | **Soute passager non proposée**. Ne pas en déduire une réponse fret : aucune source Vueling distincte n’a encore été lue. |

## Cohorte G — Norwegian, Condor et Eurowings, 5 faits directement exploitables

Le fichier machine correspondant est [PREUVES_POLITIQUES_COMPAGNIES_COHORTE_G_2026-09-08.json](PREUVES_POLITIQUES_COMPAGNIES_COHORTE_G_2026-09-08.json).

| Compagnie / faits publiables | Citation et portée exacte | Effet Finder sûr |
| --- | --- | --- |
| **Norwegian** — cabine | [Page officielle](https://www.norwegian.com/uk/travel-info/baggage/travelling-with-pets/), `Getting ready to fly → Kennels and crates → In the cabin` : contenant + animal **≤ 8 kg** ; routes limitées à des cas Schengen/UE et Svalbard explicitement listés. | Chien seul de 30/32 kg : **cabine non adaptée**. Sous 8 kg, conserver les conditions de caisse et de route. |
| **Norwegian** — soute | Même page, `Pets in the cargo hold` : chats et chiens peuvent voyager en soute sur les liaisons explicitement listées ; les correspondances sont elles aussi bornées. | Soute **proposée sous conditions de route, caisse et capacité** ; jamais une réservation garantie. |
| **Condor** — cabine | [Page officielle](https://www.condor.com/eu/flight-preparation/baggage-and-animals/travelling-with-pets/pets-in-cabin.jsp), `Transportation in the Cabin` : caisse **avec l’animal ≤ 8 kg**. | Chien seul de 30/32 kg : **cabine non adaptée**. |
| **Condor** — soute | [Page officielle](https://www.condor.com/eu/flight-preparation/baggage-and-animals/travelling-with-pets/pets-in-cargo-hold.jsp), `Transporting Pets in Cargo Hold` : nombre limité, caisse et race exigées ; réservation jusqu’à 48 h avant, **vol direct seulement**. | Soute **proposée sous conditions** ; ne pas masquer la contrainte de vol direct. |
| **Eurowings** — cabine | [Page officielle](https://www.eurowings.com/en/booking/travel-extras/komfort-services.html), `Travelling with animals` : chien/chat **jusqu’à 8 kg** en cabine si la caisse tient sous le siège. | Chien seul de 30/32 kg : **cabine non adaptée**. La soute et le fret restent volontairement non décidés ici. |

## Cohorte H — LOT, SWISS, Austrian, airBaltic et Air Serbia, 14 faits directement exploitables

Le fichier machine correspondant est [PREUVES_POLITIQUES_COMPAGNIES_COHORTE_H_2026-09-08.json](PREUVES_POLITIQUES_COMPAGNIES_COHORTE_H_2026-09-08.json).

| Compagnie / faits publiables | Citation et portée exacte | Effet Finder sûr |
| --- | --- | --- |
| **LOT Polish Airlines** — cabine | [Page officielle](https://www.lot.com/hu/en/journey/special-services/traveling-with-pets/pet-in-cabin) : animal + caisse **≤ 8 kg**. | Chien seul de 30/32 kg : **cabine non adaptée**. |
| **LOT** — soute / fret | [Soute passager](https://www.lot.com/ca/en/journey/special-services/traveling-with-pets/animal-in-hold) : disponibilité à vérifier pendant la réservation ; [fret](https://www.lot.com/is/en/journey/special-services/traveling-with-pets/animal-in-cargo) via LOT Cargo et un expéditeur. | Soute et fret **sous conditions**. Le fret n’est pas une réponse automatique à une soute impossible. |
| **LOT** — brachycéphales en soute | [Page officielle](https://www.lot.com/us/en/journey/special-services/traveling-with-pets/animal-in-hold) : interdiction explicite, y compris croisements/caractéristiques listés. | **Ne pas proposer la soute** pour cette catégorie ; cabine et fret sont des questions distinctes. |
| **SWISS** — cabine / soute | [Page officielle](https://www.swiss.com/xx/en/prepare/special-care/animals-travelling) : cabine ≤ 8 kg avec caisse ; soute pour chien/chat non brachycéphale dépassant ce seuil ou la taille cabine. | Chien seul de 30/32 kg : cabine **non adaptée** ; soute **sous conditions** pour un chien non brachycéphale. |
| **SWISS** — brachycéphales en soute | Même page : les races à nez plat ne sont acceptées qu’en cabine, jamais en soute. | **Ne pas proposer la soute** ; ne pas transformer cette interdiction en refus de fret. |
| **Austrian Airlines** — cabine / soute | [Page officielle](https://www.austrian.com/pt/en/plan/special-requirements/travelling-with-animals) : cabine animal+caisse ≤ 8 kg ; soute sous réserve de caisse, chargement, itinéraire et disponibilité. | Chien seul de 30/32 kg : cabine **non adaptée** ; soute **à confirmer selon les conditions**. |
| **Austrian** — brachycéphales en soute | Même page : chiens/chats brachycéphales non autorisés en soute. | **Ne pas proposer la soute** à cette catégorie. |
| **airBaltic** — cabine / soute / fret | [Page officielle](https://www.airbaltic.com/en/assisted-travel/travelling-with-pets) : cabine ≤ 8 kg ; soute ≤ 75 kg animal+caisse (39 kg via Amsterdam) ; au-delà, fret. | Pour chien de 30/32 kg : cabine **non adaptée** ; soute **sous conditions de caisse/route**. |
| **Air Serbia** — cabine | [Page officielle](https://www.airserbia.com/en/info-and-help/travel-guidelines/traveling-with-your-pets) : chien/chat + caisse ≤ 8 kg, capacité préconfirmée, certaines routes exclues. | Chien seul de 30/32 kg : **cabine non adaptée**. Soute et fret restent non décidés dans cette cohorte. |

## Cohorte I — ITA Airways, Aer Lingus, Icelandair et Royal Air Maroc, 9 faits directement exploitables

Le fichier machine correspondant est [PREUVES_POLITIQUES_COMPAGNIES_COHORTE_I_2026-09-08.json](PREUVES_POLITIQUES_COMPAGNIES_COHORTE_I_2026-09-08.json).

| Compagnie / faits publiables | Citation et portée exacte | Effet Finder sûr |
| --- | --- | --- |
| **ITA Airways** — cabine standard | [Page officielle](https://www.ita-airways.com/ae/en/book-and-prepare/other-requests/travelling-with-pets/pets-in-cabin) : 8 kg caisse+animal sur les vols non domestiques, 12 kg sur les domestiques. | Ne jamais appliquer un plafond unique de 8 kg à tous les trajets ITA. Chien seul de 30/32 kg : aucun service cabine standard. |
| **ITA** — grand chien en cabine | [Service officiel](https://www.ita-airways.com/us/en/book-and-prepare/other-requests/travelling-with-pets/pets-in-cabin/large-dog-on-board) : jusqu’à **30 kg**, sur une sélection de vols domestiques seulement et après vérification. | Une piste très bornée pour un chien ≤ 30 kg ; **32 kg exclu**. Pas d’extension aux vols internationaux. |
| **ITA** — soute | La page officielle établit le transport de chiens/chats en soute, soumis aux mesures, routes, capacité et réservation. | Soute **proposée sous conditions**. |
| **Aer Lingus** — soute | [Page officielle](https://www.aerlingus.com/localized/en/modals/baggage-information.html) : chien/chat via un agent animalier, en soute ; exclusion de certains appareils et d’Aer Lingus Regional. | Soute **sous conditions de vol et d’opérateur**. |
| **Icelandair** — soute internationale | [Page officielle](https://www.icelandair.com/support/special-assistance/animal-transportation/) : soute animale internationale indisponible depuis le 1er novembre 2024. | **Ne pas proposer la soute internationale** ; ce fait ne décide pas les vols domestiques ni la cabine. |
| **Royal Air Maroc** — cabine | [Page officielle](https://www.royalairmaroc.com/uk-en/information/travel-with-animals) : 8 kg animal+caisse. | Chien seul de 30/32 kg : **cabine non adaptée**. |
| **Royal Air Maroc** — soute / fret | [Page officielle](https://pre.royalairmaroc.com/us-en/information/travel-with-animals) : soute jusqu’à 70 kg ; [page officielle](https://www.royalairmaroc.com/es-es/information/viajar-con-animales) : au-delà, cargo. | Soute **sous conditions** sous 70 kg ; au-delà, ne proposer que l’orientation fret. |

## Cohorte J — Pegasus, TUI Airways et Volotea, 7 faits directement exploitables

Le fichier machine correspondant est [PREUVES_POLITIQUES_COMPAGNIES_COHORTE_J_2026-09-08.json](PREUVES_POLITIQUES_COMPAGNIES_COHORTE_J_2026-09-08.json).

| Compagnie / faits publiables | Citation et portée exacte | Effet Finder sûr |
| --- | --- | --- |
| **Pegasus** — cabine | [FAQ officielle](https://www.flypgs.com/en/useful-info/other-info/frequently-asked-questions) : 8 kg animal+caisse. | Chien seul de 30/32 kg : **cabine non adaptée**. |
| **Pegasus** — soute | [Règles officielles](https://www.flypgs.com/fr/informations-utiles/informations-de-vol/regles-generales) : soute AVIH seulement sur vols domestiques et Chypre Nord, jamais sur international. | Soute **possible sous conditions** sur ce périmètre, **non proposée sur international**. |
| **TUI Airways** — routes Royaume-Uni | [FAQ officielle](https://www.tui.co.uk/destinations/faq/airport-flights-and-luggage/flight-information/can-i-take-my-pet-with-me) : animaux en fret/soute, pas en cabine vers ou depuis le Royaume-Uni ; validation Cargo obligatoire. | Pas de cabine sur ce périmètre ; **orientation fret conditionnelle**. |
| **Volotea** — cabine / soute | [Conditions officielles](https://www.volotea.com/en/legal-conditions/conditions-of-carriage/) : cabine ≤ 10 kg caisse+animal+accessoires ; **aucun transport animal en soute**. | Chien seul de 30/32 kg : **cabine non adaptée**, soute **non proposée**. |

## Cohorte K — Qantas, Alaska, Air New Zealand, Virgin Atlantic et Wizz Air, 9 faits directement exploitables

Le fichier machine correspondant est [PREUVES_POLITIQUES_COMPAGNIES_COHORTE_K_2026-09-08.json](PREUVES_POLITIQUES_COMPAGNIES_COHORTE_K_2026-09-08.json).

| Compagnie / faits publiables | Citation et portée exacte | Effet Finder sûr |
| --- | --- | --- |
| **Qantas** — soute / fret | [Conditions officielles](https://www.qantas.com/en-za/book/flights/conditions-of-carriage) et [page animaux](https://www.qantas.com/en-gb/travel-information/pets) : aéroport et Qantas Freight décident entre fret et soute passager. | Deux pistes **conditionnelles**, aucune confirmation automatique. |
| **Alaska Airlines** — cabine / soute / fret | [Page officielle](https://www.alaskaair.com/content/travel-info/pets) : cabine sous siège, soute climatisée, fret Pet Connect ; restrictions de races, dates, flotte et capacité. | Les trois canaux existent **sous conditions** ; ne pas déduire une acceptation de la seule taille du chien. |
| **Air New Zealand** — international | [Page officielle](https://www.airnewzealand.co.nz/flights/en-nz/) : pas de soute passager sur international, fret obligatoire. | Sur international : **soute non proposée**, orientation fret conditionnelle. Les vols domestiques restent distincts. |
| **Virgin Atlantic** — cabine | [Conditions officielles](https://www.virginatlantic.com/policies/conditions-of-carriage/article-16) : cabine réservée aux chiens d’assistance. | **Ne pas proposer la cabine** à un chien de compagnie. |
| **Wizz Air** — chien de compagnie | [Conditions officielles](https://wizzair.com/cms/api/docs/default-source/downloadable-documents/gcc-w6_en_final_010323-clean_6c8388cf-bc51-4942-a584-80934a0c3d83.pdf) : aucun animal vivant hors chien d’assistance reconnu. | **Aucun canal proposé** au chien de compagnie. Cette règle a un rappel rapproché, car la révision PDF affichée date de 2023. |

## Cohorte L — sources officielles localisées, à transcrire avant décision

Ces sources sont des pistes de première main, mais ce dossier ne fournit pas encore pour chacune un extrait/locator suffisamment relu pour une mutation directe. **Elles ne doivent pas être transformées en verdicts avant cette transcription.**

| Compagnie | Source officielle localisée | Ce qu’elle semble couvrir ; limite à respecter |
| --- | --- | --- |
| Iberia | [Pets](https://www.iberia.com/us/fly-with-iberia/pets/) | Déjà transcrit dans la cohorte A. |
| TAP Air Portugal | [Pets](https://www.flytap.com/en-gb/information/traveling-with-animals/pets) | Déjà transcrit dans la cohorte A. |
| ITA Airways | [Pets in cabin](https://www.ita-airways.com/us/en/book-and-prepare/other-requests/travelling-with-pets/pets-in-cabin.html) | Seuil cabine qui varie notamment entre national/international ; nécessite des conditions de route. |
| Turkish Airlines | [Travelling with pets](https://www.turkishairlines.com/en-ch/any-questions/traveling-with-pets/) | Déjà transcrit dans la cohorte A. |
| Emirates | [Pets and unusual baggage](https://www.emirates.com/us/english/before-you-fly/baggage/unusual-baggage-and-special-allowances/) | Les chiens de compagnie ne vont pas en cabine ; distinction soute/fret dépendante des circonstances. |
| Qatar Airways | [Animals](https://www.qatarairways.com/en-au/baggage/animals.html) | Déjà transcrit dans la cohorte A. |
| Air Canada | [Pets](https://www.aircanada.com/ca/en/aco/home/plan/special-assistance/pets.html) | Cabine pour petit chien/chat et compartiment cargo pressurisé selon avion ; relever les exclusions. |
| American Airlines | [Pets](https://www.aa.com/web/i18n/travel-info/special-assistance/pets.html) | Déjà transcrit dans la cohorte B. |
| Delta | [Pet travel](https://www.delta.com/us/en/pet-travel/overview) | Cabine ; la page cargo est actuellement limitée à certains ordres officiels. Ne pas conclure « soute disponible » pour tous. |
| SAS | [Pets in cabin](https://www.flysas.com/us-en/travel-info/travel-with-pets/cabin) | Déjà transcrit dans la cohorte B. |
| Finnair | [Pets on Finnair flights](https://www.finnair.com/en/pets-on-finnair-flights) | Déjà transcrit dans la cohorte B. |
| Brussels Airlines | [Cabin pets](https://www.brusselsairlines.com/ua/en/special-care/pets/cats-and-small-dogs-in-the-cabin) | Déjà transcrit dans la cohorte B. |
| Air Transat | [Pets](https://www.airtransat.com/es-ES/informacion-de-viaje/servicios-especiales/perros-guia-y-animales-de-compania) | Cabine et soute ; seuil de 8 kg et réservation. Vérifier la version de marché qui correspond au trajet. |
| WestJet | [Pets](https://www.westjet.com/en-us/pets) | Cabine, bagage enregistré, fret ; compléter seuils et exceptions. |
| Singapore Airlines | [Travelling with pets](https://www.singaporeair.com/en_UK/gb/travel-info/special-assistance/travelling-with-pets/) | Déjà transcrit dans la cohorte B ; cabine intentionnellement non décidée. |

## À ne pas décider actuellement

* **Ryanair** : déjà couvert par la cohorte C à partir du Centre d’aide et des conditions officielles ; ne pas créer une seconde règle à partir d’un agrégateur ou d’une page d’aéroport.
* **United, JetBlue, Qantas et toutes les compagnies hors cohortes** : pas de réponse catégorique tant que la même chaîne URL officielle + citation + locator + date n’est pas réunie.
* **Fret** : ne jamais convertir « contactez Cargo » en « fret accepté ». C’est une orientation de procédure, pas une acceptation pour le chien, la caisse, l’itinéraire et la saison concrets.

## Cadence de production recommandée

1. Importer et tester les 20 faits structurés de la cohorte A (11 compagnies) dans une PR courte. La preuve SWISS est conservée dans le dossier, mais attend son complément de seuils avant import individuel.
2. Contrôler à l’écran les scénarios grand chien / petit chien / brachycéphale / route UK ou USA, en quatre langues.
3. Importer la cohorte B par sous-groupes de cinq compagnies, jamais par remplacement global ; poursuivre la cohorte C de la même manière.
4. Chaque lundi, lister les sources dont `review_due` est atteint ; une source expirée rétablit un état prudent, elle ne conserve pas par inertie un oui ou un non.

Ce dossier améliore immédiatement les réponses sur les compagnies les plus utilisées tout en laissant explicitement ouvertes les zones qui nécessitent une lecture directe supplémentaire.
