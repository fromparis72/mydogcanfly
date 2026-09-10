# Audit indépendant des tarifs animaux — cohorte B

Date de lecture des pages : **10 septembre 2026**. Périmètre : 34 compagnies, trois canaux par compagnie, soit 102 décisions tarifaires. Les pages non officielles, extraits d’agrégateurs et résultats sans page officielle identifiable ont été exclus. `NON_TROUVE` signifie que l’audit n’a pas établi de tarif public actuel ; ce n’est ni un tarif nul, ni la preuve que le service n’existe pas.

La matrice exploitable ligne par ligne est dans `cohorte-b.tsv`. Les citations y sont volontairement courtes ; le locator et l’URL officielle doivent rester attachés à chaque donnée importée.

Répartition des 102 lignes après audit : 47 services acceptés, 20 conditionnels, 25 non proposés et 10 non établis. Côté tarif : 5 montants exacts, 24 grilles, 4 formules, 2 fourchettes, 1 prix « à partir de », 2 prix dans la réservation, 2 calculateurs, 19 devis, 17 tarifs non trouvés, 1 conflit officiel et 25 lignes sans objet parce que le canal n’est pas proposé.

## Conclusion transversale sur le dépôt

Les 34 fiches YAML contiennent d’anciens `channels[].fee` et/ou `fareList`, mais **aucune des 34 sections `policies` ne porte une source tarifaire structurée**. Le moteur ne publie plus les montants de ces champs : il rend aujourd’hui un état générique (« tarif à confirmer » ou « devis cargo »). `fareList` reste lu par l’ingest pour certains enrichissements de poids cabine, pas comme preuve tarifaire. En conséquence :

- les montants anciens ne sont pas raccordés à une preuve utilisable par le Finder ;
- ils ne doivent pas être réactivés en bloc ;
- l’import doit distinguer montant exact, grille, formule de bagage, prix dans la réservation, devis et absence de service ;
- les lignes `NON_TROUVE` doivent rester prudentes même si le YAML contient un chiffre.

## Écarts qui bloquent une réactivation naïve

1. **Finnair : conflit officiel actuel.** La page « Pets on Finnair flights » publie 140 EUR en soute en Europe et 650 EUR en intercontinental, tandis que « Extra baggage fees » publie 120 et 600 EUR. Les deux pages coïncident pour la cabine (60/65 et 120/130 EUR). Il faut afficher le conflit et demander confirmation, jamais choisir silencieusement 120/600 ou 140/650.
2. **Services ordinaires confondus avec exceptions.** Delta ne propose la soute qu’aux militaires américains et agents du Département d’État en mutation ; le `200 USD` du YAML n’est pas un tarif passager ordinaire. Kenya Airways ne propose le chien qu’en fret. Gulf Air est cargo uniquement. easyJet et IndiGo n’acceptent pas les animaux ordinaires.
3. **Montants anciens devenus non démontrables.** Les grilles historiques de Croatia Airlines, EL AL, JetBlue, LATAM et LOT ne sont pas soutenues par une page officielle actuelle exploitable. Elles doivent rester masquées ou être remplacées par l’action officielle permettant d’obtenir le prix.
4. **Bornes devenues fausses.** Iberia monte désormais jusqu’à 220 EUR en cabine et 385 EUR en soute selon l’itinéraire/connexion ; ITA jusqu’à 300 EUR en soute, pas 330 ; Edelweiss jusqu’à 440 CHF pour une grande caisse long-courrier, pas 220.
5. **Formules, pas prix fixes.** EVA Air et Garuda facturent selon une formule d’excédent de bagage ; Lufthansa renvoie au calculateur et ajoute certains suppléments de transit ; EgyptAir publie des multiplicateurs et un supplément de transit, pas un montant universel.
6. **Portées indispensables.** JAL `5 500–7 700 JPY` ne vaut que pour le Japon domestique. La Compagnie facture 200 EUR par trajet, cabine seulement. French bee publie 100 USD/segment et 195 USD/segment sur son marché anglophone, mais la grille EUR du YAML ne doit pas être projetée mondialement sans page officielle de marché.

## Relevé par compagnie

### China Southern

- Cabine : animal ordinaire non proposé ; chiens d’assistance seulement.
- Soute internationale : animal + caisse + nourriture, 2–8 kg = 1 380 RMB / 200 USD / 190 EUR ; >8–23 kg = 2 100 / 300 / 280 ; >23–32 kg = 3 500 / 500 / 470. Demande au moins 72 h avant et présentation 90 min avant.
- Soute domestique : formule d’excédent de bagage. Cargo : aucun tarif public actuel établi.
- Source : [China Southern — Pets](https://www.csair.com/newh5/en/tourguide/luggage_service/special_baggage/pets/), sections « International pet transport » et « Application ».

### Condor

- Cabine, aller simple : 59,99 à 99,99 EUR selon zone ; 120 à 160 EUR à l’aéroport. Animal + sac jusqu’à 8 kg.
- Soute, aller simple : 79,99 à 254,99 EUR selon zone et taille ; autres devises publiées pour certaines origines. Réservation au moins 48 h avant.
- Cargo : aucun barème distinct public établi.
- Sources : [Condor — cabine](https://www.condor.com/de/flug-vorbereiten/gepaeck-tiere/tierbefoerderung/tiere-in-der-kabine.jsp) et [Condor — soute](https://www.condor.com/eu/flight-preparation/baggage-and-animals/travelling-with-pets/pets-in-cargo-hold.jsp).

### Copa Airlines

- Cabine : 25 USD + taxes sur le domestique Panama ; 125 USD + taxes à l’international. Réservation au moins 48 h avant.
- Soute accompagnée : non proposée. Fret : Copa Cargo, sur devis.
- Source : [Copa — politique animaux mise à jour](https://www.copaair.com/assets/ENG-COM-24-001-Update-Service-or-Emotional-Support-Dog-and-Pet-in-Cabin-Transportation-Policy.pdf), tableau des frais.

### Corsair

- Cabine : 75 EUR par trajet entre Paris et Fort-de-France, Pointe-à-Pitre, Mayotte ou La Réunion ; 150 EUR entre Paris et Abidjan.
- Soute : 150 EUR sur le premier groupe de routes ; 300 EUR vers Maurice/Abidjan. Paris → Maurice non accepté en soute.
- Cargo : cas spécialisés, sur devis. Prévenir en amont ; la page mentionne 72 h pour certains dossiers.
- Source : [Corsair — Transport d’un animal](https://www.flycorsair.com/en/information/before-flight/transport-animal), mise à jour visible 22 juin 2026 sur la version anglaise.

### Croatia Airlines

- Cabine et soute : service confirmé par le parcours officiel, mais **tarif public actuel non établi** par une page accessible. L’ancien barème du YAML ne peut pas être daté de 2026.
- Cargo : aucun tarif public actuel établi.
- Source consultée : [Croatia Airlines — Animals](https://www.croatiaairlines.com/Baggage/Animals). Obstacle : contenu tarifaire actuel non exploitable par le lecteur ; l’ancien document de distribution n’est pas une preuve courante.

### Delta

- Cabine, par sens : 150 USD/CAD sur États-Unis, Canada, Porto Rico et Îles Vierges pour billets émis depuis le 8 avril 2025 ; 200 USD/CAD/EUR à l’international ; Brésil 200 USD.
- Soute : non proposée au public ordinaire. Le tarif 200 USD vise uniquement certaines mutations militaires/diplomatiques.
- Cargo : pas de service général actuel ; parcours spécialisé limité. Réservation cargo au plus tôt 14 jours avant, avec délais de remise.
- Sources : [Delta — Pet Travel](https://www.delta.com/us/en/pet-travel/overview) et [Delta — Shipping your pet](https://www.delta.com/us/en/pet-travel/shipping-your-pet).

### easyJet

- Cabine, soute et fret : animaux ordinaires non proposés ; exception pour chiens d’assistance reconnus. Aucun tarif animal ordinaire.
- Source : [easyJet — Terms and conditions](https://www.easyjet.com/en/help-centre/policy-terms-and-conditions/terms-and-conditions), section animaux vivants.

### Edelweiss

- Cabine : 90 à 140 CHF par tronçon selon zone, avec tables équivalentes EUR/GBP/USD/CAD.
- Soute : petite caisse 115 à 220 CHF ; grandes caisses 230 à 440 CHF par tronçon selon zone.
- Enregistrement jusqu’à quatre jours ouvrés avant. Cargo : tarif distinct non publié.
- Source : [Edelweiss — Registration and charges](https://www.flyedelweiss.com/at/en/prepare/flight-preparation/animals-travelling/registration-and-charges.html), barème applicable depuis le 1er décembre 2025.

### EgyptAir

- Cabine/soute : acceptées sous conditions, réservation au moins 48 h avant. La page anglaise indique une facturation par direction mais pas de montant.
- Une page officielle localisée publie une formule : jusqu’à 23 kg = 100 % d’une unité d’excédent, 150 % Canada/États-Unis ; 23–32 kg = 150 % ou 200 % ; 45–75 kg = 250 % ou 350 %. Transit Francfort de plus de 3 h : 300 EUR.
- Cargo : au-delà des seuils/selon route, sur devis. À importer comme **formule officielle**, pas comme prix fixe.
- Source : [EgyptAir — Traveling with pets](https://www.egyptair.com/en/fly/special-services/Pages/traveling-with-pets.aspx), tableaux et notes de transit.

### EL AL

- Cabine, soute, cargo : service documenté mais **aucun tarif passager actuel vérifiable retrouvé** sur la page officielle accessible. Les anciens 100 USD / 50 NIS et 200–400 USD restent non prouvés.
- Source officielle exploitable limitée : [EL AL — Live animals cage guidelines](https://www.elal.com/media/2pvjlusr/live-animals-cage-guidelines-en.pdf). Obstacle : guide de caisse, sans grille tarifaire courante.

### Emirates

- Cabine : animal ordinaire non proposé.
- Soute, animal + caisse : ≤23 kg et ≤150 cm = 500 USD ; 24–32 kg et 150–300 cm = 650 USD ; >32 kg et 150–300 cm = 800 USD.
- Cargo obligatoire au-delà de 300 cm, pour Dubaï, trajet >17 h ou destination l’imposant. Documents au moins une semaine avant.
- Source : [Emirates — Unusual baggage](https://www.emirates.com/us/english/before-you-fly/baggage/unusual-baggage-and-special-allowances/), « Animal excess baggage charges ».

### Ethiopian Airlines

- Cabine, par direction : international 120 EUR / 110 GBP / 150 USD ; domestique 100 USD ; Addis-Abeba–États-Unis 300 USD.
- Soute : >8–32 kg = 370 USD international, 500 USD Addis-Abeba–États-Unis ; >32–45 kg = 500 USD. Domestique = 500 % du tarif d’excédent de bagage.
- Cargo au-delà des seuils : sur devis.
- Source : [Ethiopian — Optional service charges](https://www.ethiopianairlines.com/tz/information/essential-information/optional-service-charges), grille effective ventes/voyages depuis le 20 juin 2025.

### Etihad

- Cabine : 399 USD par vol en Economy ; en Business, siège supplémentaire + 399 USD. Formulaire sept jours avant, documents 72 h avant.
- Soute : non proposée aux chiens/chats ordinaires ; règles distinctes pour faucons.
- Cargo : pas de tarif public général établi.
- Source : [Etihad — Travelling with pets](https://www.etihad.com/en/plan/travel-companion/travelling-with-pets), « Pricing ». Réserve : un communiqué associait 399 USD à une promotion finissant le 31 mai 2026, mais la page opérationnelle affiche encore ce prix le 10 septembre.

### Eurowings

- Cabine seulement, prix de départ : 60 EUR / 53 GBP / 56 CHF / 69 USD / 1 449 CZK / 661 SEK / 709 NOK / 448 DKK / 254 PLN / 22 909 HUF / 255 AED selon marché.
- Soute et cargo : non proposés aux animaux ordinaires.
- Source : [Eurowings — Travel with pets](https://www.eurowings.com/en/information/baggage/travel-with-pets.html), section réservation.

### EVA Air

- Cabine : animaux ordinaires non acceptés.
- Soute : formule par unités d’excédent. Jusqu’au 28 septembre 2026 : ≤32 kg = 2 unités, >32 kg = 4. À compter du 29 septembre : ≤23 kg = 2, 23–32 = 3, 32–45 = 4 ; au-delà, évaluation et unité supplémentaire par tranche de 10 kg.
- Demande 48 h avant, présentation 2 h avant. Cargo : aucun tarif séparé public établi.
- Source : [EVA Air — Travelling with pets](https://www.evaair.com/en-global/fly-prepare/baggage/travelling-with-pets/), sections frais et calendrier de changement.

### Finnair

- Cabine : Europe 60 EUR ≥7 jours / 65 EUR plus tard ; intercontinental 120/130 EUR. Les deux pages concordent.
- Soute : **CONFLIT OFFICIEL**. Page animaux : 140 EUR Europe, 650 EUR intercontinental ; page frais : 120 EUR et 600 EUR. Pour les départs US, conflit analogue 650/700 USD selon page/ligne.
- Cargo : devis. Aucune des valeurs de soute ne doit être choisie comme vérité unique.
- Sources : [Finnair — Pets](https://www.finnair.com/en/pets-on-finnair-flights), « Pet transportation fees » ; [Finnair — Extra baggage fees](https://www.finnair.com/en/baggage-on-finnair-flights/extra-baggage-fees), « Pets ».

### French bee

- Cabine : 100 USD par segment sur la page officielle anglophone.
- Soute : 195 USD par segment. Tahiti exclue ; au-delà des seuils, cargo/devis.
- Réservation au plus tard 48 h avant. Les anciens 75/150 EUR peuvent relever d’un autre marché, mais ne doivent pas être extrapolés sans page locale courante.
- Source : [French bee — Optional services](https://www.frenchbee.com/en/optional-services), lignes animaux ; aide opérationnelle mise à jour le 16 juillet 2026.

### Garuda Indonesia

- Cabine : animal ordinaire non proposé.
- Soute : uniquement domestique, facturée au poids réel animal + caisse selon le tarif d’excédent de la route, minimum 5 kg. Chien/chat international non accepté comme bagage enregistré.
- Cargo : devis.
- Source : [Garuda — Baggage information](https://www.garuda-indonesia.com/static/en/garuda-indonesia-experience/baggage-info.html), section animaux.

### Gulf Air

- Cabine et soute passager : non proposées aux animaux ordinaires.
- Cargo : animaux vivants sous lettre de transport aérien, tarif sur devis.
- Source : [Gulf Air — Cargo](https://www.gulfair.com/cargo), rubrique animaux vivants.

### Iberia

- Cabine, par segment : Espagne 40 EUR en ligne / 44 aéroport ; Europe/Canaries/Afrique du Nord/Israël 60/66 ; Amériques/Asie/Qatar 180/198. Connexions jusqu’à 220 EUR.
- Soute, aéroport, par segment/connexion : de 90 à 385 EUR selon zone et poids, réservation au moins 48 h avant.
- Cargo : IAG Cargo/agent, devis.
- Source : [Iberia — Pets](https://www.iberia.com/gb/fly-with-iberia/pets/), tables cabine et soute.

### Iberia Express

- Cabine, par tronçon : Espagne 40 EUR ; Europe/Canaries/Moyen-Orient/Afrique du Nord 60 ; long-courrier 180. Autres devises publiées.
- Soute, par tronçon, aéroport : 100 à 360 EUR selon route, avec équivalents USD/GBP.
- Cargo : devis lorsque le parcours passager ne s’applique pas.
- Source : [Iberia Express — Travelling with pets](https://www.iberiaexpress.com/en/general-info/passenger-information/before-you-go/travelling-with-pets), tableaux tarifaires.

### Icelandair

- Cabine : animal ordinaire non proposé.
- Soute : impossible sur les vols internationaux depuis le 1er novembre 2024 ; encore possible sur le domestique, mais prix public courant non trouvé.
- Cargo : devis/non trouvé.
- Source : [Icelandair — Animal transportation](https://www.icelandair.com/support/special-assistance/animal-transportation/), « Animal in hold service ».

### IndiGo

- Cabine et soute : animaux ordinaires interdits ; chiens d’assistance selon procédure.
- Cargo : la page officielle cargo exclut le bétail/animaux vivants ; pas de tarif.
- Sources : [IndiGo — How to book](https://www.goindigo.in/information/how-to-book.html) et [IndiGo Cargo — Services](https://aem-beta-skyplus-prod-canary.goindigo.in/cargo/services.html).

### ITA Airways

- Cabine, par vol : 73 à 230 EUR selon route pour départs Europe/Japon.
- Soute : 83 à 300 EUR selon route. Les départs d’autres marchés peuvent être en USD.
- Cargo : aucun montant public général établi.
- Source : [ITA — Pet transportation charges](https://www.ita-airways.com/ae/en/book-and-prepare/other-requests/travelling-with-pets/pet-transportation-charges), grille officielle.

### Japan Airlines (JAL)

- Cabine : animaux ordinaires non acceptés.
- Soute : Japon domestique 5 500–7 700 JPY par caisse et par secteur. International : 25 000 ou 40 000 JPY, ou 250/400 USD-CAD selon zone, par caisse.
- Cargo : transitaire/devis.
- Sources : [JAL — Domestic pet charge](https://www.jal.co.jp/jp/en/dom/fare/f_pet/index.html), page au 18 août 2026 ; [JAL — International checked baggage](https://www.jal.co.jp/jp/en/inter/baggage/checked/).

### JetBlue

- Cabine : service avec supplément, mais **montant public courant non établi**. La page actuelle des frais ne liste pas le supplément animal.
- Soute et cargo : non proposés aux animaux ordinaires.
- Sources : [JetBlue — Fees](https://www.jetblue.com/legal/fees) et page officielle animaux. L’ancien contrat à 125 USD est historique ; le `150 USD` du YAML n’est pas prouvé par la page actuelle.

### Kenya Airways

- Cabine et soute passager : non proposées ; animaux transportés comme fret.
- Cargo : NBO–New York 20 USD/kg, minimum fret 140 USD, plus AWB 6, animal vivant 34,80, documentation 34,80 et caution douane 17,40 USD. Autres routes : devis.
- Source : [Kenya Airways — Optional fees](https://www.kenya-airways.com/en-nl/policies/optional-fees/), ligne fret animaux.

### KLM

- Cabine et soute : 70 à 500 EUR par aller simple selon aéroport de départ et destination ; prix exact dans la réservation.
- Cargo : transporteur spécialisé, devis.
- Source : [KLM — Reservation for pets](https://www.klm.com/information/pets/reservation), section frais.

### KM Malta Airlines

- Cabine : 85 EUR par sens et par sac/caisse.
- Soute : 10 EUR d’administration + 90 EUR (1–10 kg), 125 (11–20), 160 (21–32), par sens et contenant.
- Inscription au moins cinq jours ouvrés avant. Cargo : devis par réservations.
- Source : [KM Malta — Travelling with pets](https://kmmaltairlines.com/en/travelling-with-pets), grilles cabine/soute.

### Korean Air

- Cabine et soute jusqu’à 32 kg : Corée domestique 30 000 KRW ; international 150/225/300 USD-CAD selon distance.
- Soute 33–45 kg : 60 000 KRW domestique ; 300/450/600 USD-CAD international. Par caisse et aller simple.
- Cargo : devis.
- Source : [Korean Air — Service fees](https://www.koreanair.com/contents/footer/others/service-fees?hl=en), « Traveling with Pets ».

### La Compagnie

- Cabine seulement : 200 EUR par trajet. La page illustre aussi 400 EUR / 500 USD aller-retour. Réservation au plus tard 48 h avant ; quatre animaux maximum.
- Soute et cargo : non proposés.
- Source : [La Compagnie — Special services](https://www.lacompagnie.com/en/plan/special-services), section animaux.

### LATAM

- Cabine et soute : service tarifé selon type, taille, route et marché ; **aucun montant réseau unique vérifié**. Les pages sont dynamiques/localisées.
- Cargo : devis.
- Source : [LATAM — Pets transportation](https://www.latamairlines.com/us/en/experience/prepare-your-trip/pets-transportation). Obstacle : page officielle dynamique non exploitable de façon stable ; les fourchettes mondiales du YAML ne sont pas publiables comme vérité actuelle.

### LOT Polish Airlines

- Cabine et soute : le prix actuel est montré dans la réservation ou « Manage My Booking » ; montant fixe public global non établi. Réservation possible jusqu’à 12 h avant selon page.
- Une page localisée publie des prix de départ, mais elle ne concorde pas avec le parcours global ; ne pas réactiver les anciennes fourchettes.
- Cargo : devis.
- Source : [LOT — Pet in cabin](https://www.lot.com/cn/en/journey/special-services/traveling-with-pets/pet-in-cabin), section frais.

### Lufthansa

- Cabine et soute : prix selon route et taille, à calculer via le calculateur officiel ; facturation par direction sur un itinéraire Lufthansa.
- Suppléments publics : transit via BRU/GVA/FRA/VIE/ZRH 150 EUR / 170 CHF / 170 USD / 220 CAD ; nuitée Zurich 200 CHF par contenant.
- Réservation au moins 72 h avant. Cargo : devis.
- Source : [Lufthansa — Travelling with animals](https://www.lufthansa.com/de/en/animals-as-additional-carry-on-baggage) et calculateur bagages. Une table statique ancienne sur une page locale ne doit pas remplacer le calculateur courant.

## Obstacles et états à conserver

- **Page inaccessible/dynamique** : Croatia Airlines, LATAM et certaines pages EL AL ne fournissent pas un barème courant extractible. L’état reste `NON_TROUVE`, avec URL et motif.
- **Prix dans la réservation** : LOT, KLM (prix précis) et Lufthansa (calculateur) ne sont pas des montants universels.
- **Formule** : EgyptAir, EVA Air et Garuda exigent route/poids et grille d’excédent ; ne pas stocker une fourchette trompeuse.
- **Conflit** : Finnair doit conserver les deux jeux de montants officiels jusqu’à clarification.
- **Temporalité** : Etihad affiche encore 399 USD après l’échéance mentionnée dans un communiqué ; la valeur doit rester datée du 10/09/2026 et reconfirmée à la réservation.

## Recommandation d’intégration

1. Ne pas reconnecter `channels[].fee` ou `fareList` au Finder.
2. Importer les lignes structurées du TSV et conserver l’URL, le locator, la date de lecture, l’unité et la portée avec chaque tarif.
3. Afficher `NON_TROUVE`, `FORMULE`, `DEVIS`, `CONFLIT` et `NON_PROPOSE` comme des états distincts.
4. Si le moteur ne connaît pas la route, le marché, le poids ou la taille nécessaires, ne pas choisir le minimum ou le maximum de la grille.
5. Revue recommandée de cette cohorte : **10 octobre 2026**, en priorité Finnair, Etihad, JetBlue, Croatia, EL AL, LATAM et LOT.

## Annexe A — provenance Git et différentiel avec la réconciliation exhaustive

### État effectivement utilisé par l’audit

Les anciens champs YAML cités dans ce rapport ont été lus au commit exact :

`92b2b9f2b35775891c83dd7ba41ecf1e21e794c4` — « Correction de la préversion 9dca579a : rien de non prouvé ne décide plus seul, ni sur les compagnies ni sur les races (#36) ».

Ils ont ensuite été comparés, sans refaire l’audit web, à :

`origin/lot/reconciliation-exhaustive` = `56f546f85cd5e605925e60672bf6ddcf3f564be5` au moment du contrôle — « Réconciliation : trois chiffres du LISEZ_MOI corrigés… ».

Comparaison structurée des 34 fichiers, limitée à `policies`, `channels[].fee` et `fareList` :

- `channels[].fee` : **0 différence** ;
- `fareList` : **0 différence** ;
- `policies` : 29 compagnies modifiées, 61 canaux passent d’un verdict runtime `confirmation_required` à un verdict décidé grâce à une citation officielle ;
- parmi eux, 9 canaux fret changent aussi d’état auteur, de `legacy_unreviewed` à `availability: offered` ;
- les cinq compagnies sans aucun mouvement sur ces champs sont Condor, EL AL, Eurowings, Icelandair et LOT.

La réconciliation n’a donc ni corrigé ni reconnecté les **tarifs** hérités : elle a raccordé des preuves de disponibilité des canaux. Le présent audit tarifaire reste nécessaire, et aucun `fee`/`fareList` ne doit être interprété comme vérifié du seul fait que le même canal est maintenant décidé dans le Finder.

### Écarts qui changent le verdict du Finder ou l’état legacy

Dans le tableau suivant, `C` signifie `confirmation_required` sur `92b2b9f`; `A` signifie `allowed` et `D` `denied` sur `56f546f`. L’astérisque marque les neuf migrations `legacy_unreviewed → offered`.

| Compagnie | Canaux dont le raccord change | Nature exacte |
|---|---|---|
| China Southern | cabine C→D ; soute C→A | citations ajoutées ; disponibilités auteur inchangées |
| Copa | cabine C→A ; soute C→D ; fret C→A* | source sur les trois canaux ; fret legacy→offered |
| Corsair | cabine C→A ; soute C→A ; fret C→A* | source sur les trois canaux ; fret legacy→offered |
| Croatia Airlines | cabine C→A ; soute C→A | citations ajoutées ; fret reste legacy |
| Delta | cabine C→A | citation ajoutée ; soute/fret inchangés |
| easyJet | cabine C→D ; soute C→D | citations ajoutées ; fret reste sans preuve raccordée |
| Edelweiss | cabine C→A ; soute C→A ; fret C→A* | source sur les trois canaux ; fret legacy→offered |
| EgyptAir | cabine C→A ; soute C→A | citations ajoutées ; fret reste legacy |
| Emirates | cabine C→D ; soute C→A ; fret C→A* | source sur les trois canaux ; fret legacy→offered |
| Ethiopian Airlines | cabine C→A ; soute C→A ; fret C→A* | source sur les trois canaux ; fret legacy→offered |
| Etihad | cabine C→A | citation ajoutée ; soute et fret inchangés |
| EVA Air | cabine C→D ; soute C→A | citations ajoutées ; fret reste legacy |
| Finnair | cabine C→A | citation cabine ajoutée ; **soute reste sans source dans `policies` malgré le conflit tarifaire officiel** |
| French bee | cabine C→A ; soute C→A | citations ajoutées ; fret reste legacy |
| Garuda Indonesia | fret C→A* | fret legacy→offered ; cabine/soute restent legacy |
| Gulf Air | cabine C→D ; soute C→D ; fret C→A* | source sur les trois canaux ; fret legacy→offered |
| Iberia | cabine C→A ; soute C→A | citations ajoutées ; fret déjà `offered` mais sans changement de raccord |
| Iberia Express | cabine C→A ; soute C→A | citations ajoutées ; fret reste legacy |
| IndiGo | cabine C→D ; soute C→D ; fret C→D | citations ajoutées ; disponibilités auteur inchangées |
| ITA Airways | cabine C→A ; soute C→A | citations ajoutées ; fret inchangé `not_offered` non cité |
| JAL | soute C→A | citation ajoutée ; cabine inchangée non citée, fret legacy |
| JetBlue | cabine C→A | citation ajoutée ; soute/fret inchangés non cités |
| Kenya Airways | cabine C→D ; soute C→D ; fret C→A* | source sur les trois canaux ; fret legacy→offered |
| KLM | cabine C→A ; soute C→A | citations ajoutées ; fret déjà `offered` mais sans changement de raccord |
| KM Malta Airlines | cabine C→A ; soute C→A ; fret C→A* | source sur les trois canaux ; fret legacy→offered |
| Korean Air | cabine C→A ; soute C→A | citations ajoutées ; fret reste legacy |
| La Compagnie | cabine C→A ; soute C→D | citations ajoutées ; aucune politique fret dans les deux états |
| LATAM | cabine C→A ; soute C→A | citations ajoutées ; fret reste legacy |
| Lufthansa | cabine C→A ; soute C→A | citations ajoutées ; fret déjà `offered` mais sans changement de raccord |

### Conséquence pour l’import tarifaire

Cette annexe ne change aucune conclusion tarifaire du rapport. Elle corrige seulement la lecture du futur état du Finder : la branche de réconciliation permet à 61 disponibilités d’être décidées, mais **aucune preuve ajoutée dans `policies` ne porte le montant, la devise, l’unité de facturation ou la portée tarifaire**. Les colonnes tarifaires du TSV doivent donc être importées avec leur propre preuve et ne doivent jamais hériter automatiquement du statut de disponibilité du canal.
