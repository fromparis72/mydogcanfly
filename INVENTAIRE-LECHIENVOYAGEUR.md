# Inventaire de lechienvoyageur.com et classement des URL

Relevé du 1er août 2026. Toutes les pages de lechienvoyageur.com ont été récupérées avec
`web_fetch` uniquement. Les équivalences MyDogCanFly ont été vérifiées par lecture du
répertoire `packages/ui/dist/fr` (présence effective d'un `index.html`).

---

## 1. Synthèse

Le site compte **149 articles** répartis sur 8 pages de liste (19 articles par page,
16 sur la dernière), plus **4 URL d'outils** (`/outils/` et ses trois outils interactifs)
et **40 pages de service** (à propos, auteure, contact, charte, mentions légales,
index de catégories et pagination). Soit **193 URL** au total, dont 22 pages de pagination
de catégorie déduites des compteurs affichés sur `/categories/` mais **non vérifiées une
par une** (voir « Points d'attention »).

Le classement donne :

| Catégorie | Nombre d'URL | Ce que cela implique |
|---|---|---|
| **A — Doublon** | **91** | 62 fiches compagnies + 22 fiches pays + 2 hubs formalités + 1 comparatif + 4 URL d'outils. Aucun contenu à importer : uniquement des redirections 301 vers une page MyDogCanFly existante et vérifiée. |
| **B — Nouveau** | **62** | Guides pratiques que MyDogCanFly ne couvre pas : voiture, train, ferry, transports urbains, camping, plages, montagne, hébergements, GPS, harnais, manteaux, gamelles, tiques, anxiété, chiot, chien âgé… À importer dans le Travel Hub. |
| **C — Page de service** | **40** | Ni import ni redirection article par article. Une redirection globale vers `/fr/` ou `/fr/travel-hub/` suffit. |

Concrètement : **61 % des URL éditoriales du site sont déjà couvertes, et mieux, par
MyDogCanFly** (les 62 fiches compagnies ont toutes leur équivalent parmi les 78 fiches
`/fr/airlines/`, les 22 fiches pays parmi les 140 fiches `/fr/countries/`). Le gain réel
d'une reprise tient dans les **62 guides pratiques**, qui constituent précisément le type
de contenu que le Travel Hub `/fr/travel-hub/` attend aujourd'hui (la page ne contient
qu'un bloc « bientôt disponible »).

---

## 2. Tableau A — Doublons (redirection 301, rien à importer)

### 2.1 Fiches compagnies aériennes (62)

Les 62 compagnies traitées par lechienvoyageur ont **toutes** une fiche MyDogCanFly.
Vérification : présence de `dist/fr/airlines/<slug>/index.html` (79 entrées dans le
répertoire, dont `index.html` → 78 fiches).

| URL source | sujet | cible MyDogCanFly | vérifiée ? |
|---|---|---|---|
| /aegean-airlines-chien/ | Aegean Airlines | /fr/airlines/aegean/ | oui |
| /aeromexico-chien/ | Aeromexico | /fr/airlines/aeromexico/ | oui |
| /air-algerie-chien/ | Air Algérie | /fr/airlines/air-algerie/ | oui |
| /air-canada-chien/ | Air Canada | /fr/airlines/air-canada/ | oui |
| /air-caraibes-chien/ | Air Caraïbes | /fr/airlines/air-caraibes/ | oui |
| /air-europa-chien/ | Air Europa | /fr/airlines/air-europa/ | oui |
| /air-france-chien/ | Air France | /fr/airlines/air-france/ | oui |
| /air-india-chien/ | Air India | /fr/airlines/air-india/ | oui |
| /air-mauritius-chien/ | Air Mauritius | /fr/airlines/air-mauritius/ | oui |
| /air-tahiti-nui-chien/ | Air Tahiti Nui | /fr/airlines/air-tahiti-nui/ | oui |
| /air-transat-chien/ | Air Transat | /fr/airlines/air-transat/ | oui |
| /alaska-airlines-chien/ | Alaska Airlines | /fr/airlines/alaska/ | oui |
| /american-airlines-chien/ | American Airlines | /fr/airlines/american/ | oui |
| /ana-chien/ | ANA (All Nippon Airways) | /fr/airlines/ana/ | oui |
| /austrian-airlines-chien/ | Austrian Airlines | /fr/airlines/austrian/ | oui |
| /avianca-chien/ | Avianca | /fr/airlines/avianca/ | oui |
| /british-airways-chien/ | British Airways | /fr/airlines/british-airways/ | oui |
| /brussels-airlines-chien/ | Brussels Airlines | /fr/airlines/brussels/ | oui |
| /cathay-pacific-chien/ | Cathay Pacific | /fr/airlines/cathay-pacific/ | oui |
| /china-airlines-chien/ | China Airlines | /fr/airlines/china-airlines/ | oui |
| /copa-airlines-chien/ | Copa Airlines | /fr/airlines/copa/ | oui |
| /corsair-chien/ | Corsair | /fr/airlines/corsair/ | oui |
| /delta-air-lines-chien/ | Delta Air Lines | /fr/airlines/delta/ | oui |
| /easyjet-chien/ | easyJet | /fr/airlines/easyjet/ | oui |
| /egyptair-chien/ | EgyptAir | /fr/airlines/egyptair/ | oui |
| /emirates-chien/ | Emirates | /fr/airlines/emirates/ | oui |
| /ethiopian-airlines-chien/ | Ethiopian Airlines | /fr/airlines/ethiopian/ | oui |
| /etihad-airways-chien/ | Etihad Airways | /fr/airlines/etihad/ | oui |
| /eurowings-chien/ | Eurowings | /fr/airlines/eurowings/ | oui |
| /eva-air-chien/ | EVA Air | /fr/airlines/eva-air/ | oui |
| /finnair-chien/ | Finnair | /fr/airlines/finnair/ | oui |
| /french-bee-chien/ | French Bee | /fr/airlines/french-bee/ | oui |
| /iberia-chien/ | Iberia | /fr/airlines/iberia/ | oui |
| /iberia-express-chien/ | Iberia Express | /fr/airlines/iberia-express/ | oui |
| /ita-airways-chien/ | ITA Airways | /fr/airlines/ita-airways/ | oui |
| /japan-airlines-chien/ | Japan Airlines (JAL) | /fr/airlines/jal/ | oui |
| /jetblue-chien/ | JetBlue | /fr/airlines/jetblue/ | oui |
| /klm-chien/ | KLM | /fr/airlines/klm/ | oui |
| /korean-air-chien/ | Korean Air | /fr/airlines/korean-air/ | oui |
| /latam-chien/ | LATAM | /fr/airlines/latam/ | oui |
| /lot-polish-airlines-chien/ | LOT Polish Airlines | /fr/airlines/lot/ | oui |
| /lufthansa-chien/ | Lufthansa | /fr/airlines/lufthansa/ | oui |
| /norwegian-chien/ | Norwegian | /fr/airlines/norwegian/ | oui |
| /philippine-airlines-chien/ | Philippine Airlines | /fr/airlines/philippine/ | oui |
| /qatar-airways-chien/ | Qatar Airways | /fr/airlines/qatar-airways/ | oui |
| /royal-air-maroc-chien/ | Royal Air Maroc | /fr/airlines/royal-air-maroc/ | oui |
| /ryanair-chien/ | Ryanair | /fr/airlines/ryanair/ | oui |
| /sas-scandinavian-chien/ | SAS Scandinavian | /fr/airlines/sas/ | oui |
| /saudia-chien/ | Saudia | /fr/airlines/saudia/ | oui |
| /singapore-airlines-chien/ | Singapore Airlines | /fr/airlines/singapore-airlines/ | oui |
| /swiss-chien/ | SWISS | /fr/airlines/swiss/ | oui |
| /tap-air-portugal-chien/ | TAP Air Portugal | /fr/airlines/tap/ | oui |
| /thai-airways-chien/ | Thai Airways | /fr/airlines/thai-airways/ | oui |
| /transavia-chien/ | Transavia | /fr/airlines/transavia/ | oui |
| /tunisair-chien/ | Tunisair | /fr/airlines/tunisair/ | oui |
| /turkish-airlines-chien/ | Turkish Airlines | /fr/airlines/turkish/ | oui |
| /united-airlines-chien/ | United Airlines | /fr/airlines/united/ | oui |
| /vietnam-airlines-chien/ | Vietnam Airlines | /fr/airlines/vietnam-airlines/ | oui |
| /volotea-chien/ | Volotea | /fr/airlines/volotea/ | oui |
| /vueling-chien/ | Vueling | /fr/airlines/vueling/ | oui |
| /westjet-chien/ | WestJet | /fr/airlines/westjet/ | oui |
| /wizz-air-chien/ | Wizz Air | /fr/airlines/wizz-air/ | oui |

### 2.2 Fiches pays / formalités (22 articles)

Vérification : présence de `dist/fr/countries/<iso2>/index.html` (141 entrées, dont
`index.html` → 140 fiches pays).

| URL source | sujet | cible MyDogCanFly | vérifiée ? |
|---|---|---|---|
| /voyager-chien-allemagne/ | Allemagne | /fr/countries/de/ | oui |
| /voyager-chien-australie/ | Australie | /fr/countries/au/ | oui |
| /voyager-chien-belgique-pays-bas/ | Belgique + Pays-Bas (2 pays dans un article) | /fr/countries/be/ (principal) et /fr/countries/nl/ | oui (les deux) |
| /voyager-chien-bresil/ | Brésil | /fr/countries/br/ | oui |
| /voyager-chien-canada/ | Canada | /fr/countries/ca/ | oui |
| /voyager-chien-emirats-dubai/ | Émirats arabes unis | /fr/countries/ae/ | oui |
| /voyager-chien-espagne/ | Espagne | /fr/countries/es/ | oui |
| /voyager-chien-etats-unis/ | États-Unis | /fr/countries/us/ | oui |
| /voyager-chien-grece/ | Grèce | /fr/countries/gr/ | oui |
| /voyager-chien-irlande-finlande-malte-norvege/ | Irlande, Finlande, Malte, Norvège (4 pays dans un article) | /fr/countries/ie/ (principal) ; /fi/, /mt/, /no/ | oui (les quatre) |
| /voyager-chien-italie/ | Italie | /fr/countries/it/ | oui |
| /voyager-chien-japon/ | Japon | /fr/countries/jp/ | oui |
| /voyager-chien-maroc/ | Maroc | /fr/countries/ma/ | oui |
| /voyager-chien-mexique/ | Mexique | /fr/countries/mx/ | oui |
| /voyager-chien-nouvelle-zelande/ | Nouvelle-Zélande | /fr/countries/nz/ | oui |
| /voyager-chien-portugal/ | Portugal | /fr/countries/pt/ | oui |
| /voyager-chien-royaume-uni/ | Royaume-Uni | /fr/countries/gb/ | oui |
| /voyager-chien-singapour/ | Singapour | /fr/countries/sg/ | oui |
| /voyager-chien-suisse/ | Suisse | /fr/countries/ch/ | oui |
| /voyager-chien-thailande/ | Thaïlande | /fr/countries/th/ | oui |
| /voyager-chien-tunisie/ | Tunisie | /fr/countries/tn/ | oui |
| /voyager-chien-turquie/ | Turquie | /fr/countries/tr/ | oui |

### 2.3 Hubs, comparatif et outils (7)

| URL source | sujet | cible MyDogCanFly | vérifiée ? |
|---|---|---|---|
| /voyager-chien-etranger-pays/ | Hub « formalités pays par pays » | /fr/countries/ (titre : « Formalités d'entrée par pays pour voyager avec ton chien ») | oui |
| /voyager-chien-union-europeenne/ | Formalités UE (puce, vaccin, passeport) | /fr/countries/ | oui — mais MyDogCanFly n'a pas de page « Union européenne » unique, seulement les fiches pays. Voir Points d'attention. |
| /comparatif-compagnies-aeriennes-chien/ | Comparatif des 62 compagnies | /fr/airlines/ | oui |
| /outils/ | Index des outils | /fr/tools/ (« Outils gratuits pour voyager en avion avec ton chien ») | oui |
| /outils/comparateur-vol-chien/ | Comparateur de vols | /fr/ (ancre `#flight-finder`, le Finder est sur l'accueil) | oui — `href="/fr/#flight-finder"` présent dans le build |
| /outils/calculateur-caisse-iata-chien/ | Calculateur de caisse IATA | /fr/tools/crate/ | oui |
| /outils/formalites-chien-par-pays/ | Vérificateur de formalités par pays | /fr/countries/ | oui |

---

## 3. Tableau B — Nouveaux (à importer dans le Travel Hub)

62 articles. Aucun équivalent MyDogCanFly n'a été trouvé dans `dist/fr`. Les slugs
proposés reprennent le slug d'origine quand il est déjà bon (cela simplifie les 301 et
évite de perdre le bénéfice des liens externes) ; ils seraient servis sous
`/fr/travel-hub/<slug>/`.

Les lignes marquées ⚠ signalent une hésitation A/B : un outil MyDogCanFly touche au même
sujet sans le traiter de la même façon. Conformément à la consigne, elles sont classées B.

| URL source | titre | date | slug proposé | thème |
|---|---|---|---|---|
| /manteaux-bottines-chien-meteo/ | Manteaux et bottines : protéger son chien selon la météo | 16 juil. 2026 | manteaux-bottines-chien-meteo | Équipement / météo |
| /voyager-avec-chiot/ | Voyager avec un chiot : précautions et bonnes étapes | 15 juil. 2026 | voyager-avec-chiot | Chiot |
| /week-end-campagne-avec-chien/ | Un week-end à la campagne avec son chien : gîtes et nature | 14 juil. 2026 | week-end-campagne-avec-chien | Destinations |
| /aires-autoroute-dog-friendly/ | Aires d'autoroute avec son chien : réussir la pause | 13 juil. 2026 | aires-autoroute-avec-chien | Voiture ⚠ (MyDogCanFly a /fr/tools/pet-relief/, mais pour les **aéroports**, pas les autoroutes) |
| /gps-trackers-chien/ | GPS et trackers pour chien : ne plus jamais le perdre | 12 juil. 2026 | gps-traceurs-chien | Équipement |
| /blessure-chien-balade-premiers-gestes/ | Mon chien se blesse en balade : les premiers gestes | 11 juil. 2026 | blessure-chien-balade-premiers-gestes | Santé |
| /visiter-ville-avec-chien/ | Visiter une ville avec son chien : terrasses, musées et transports | 10 juil. 2026 | visiter-ville-avec-chien | Destinations |
| /transports-urbains-avec-chien/ | Prendre le métro, le bus et le tram avec son chien | 9 juil. 2026 | metro-bus-tram-avec-chien | Transports urbains |
| /gamelles-accessoires-nomades-chien/ | Gamelles nomades et accessoires de voyage pour son chien | 8 juil. 2026 | gamelles-accessoires-nomades-chien | Équipement |
| /tiques-puces-chien-voyage/ | Protéger son chien des tiques et des puces en voyage | 7 juil. 2026 | tiques-puces-chien-voyage | Santé |
| /camping-avec-chien/ | Camping avec son chien : conseils et bonnes pratiques | 6 juil. 2026 | camping-avec-chien | Hébergement |
| /voyager-ferry-bateau-avec-chien/ | Voyager en ferry ou en bateau avec son chien | 5 juil. 2026 | ferry-bateau-avec-chien | Transports |
| /sac-caisse-transport-chien/ | Sac ou caisse de transport : bien choisir pour son chien | 4 juil. 2026 | sac-ou-caisse-transport-chien | Équipement ⚠ (proche de /fr/tools/best-carriers/ et /fr/tools/best-crates/, qui sont des sélections de produits, pas un guide de choix) |
| /mer-plages-avec-chien/ | Vacances à la mer avec son chien : plages autorisées et conseils | 2 juil. 2026 | plages-autorisees-chien | Destinations |
| /voyager-avion-chien-options/ | Faire voyager son chien en avion : cabine, soute, fret et autres solutions | 1er juil. 2026 | avion-cabine-soute-fret-options | Avion ⚠ (recoupe la doctrine des fiches compagnies, mais aucune page pilier FR n'existe côté MyDogCanFly) |
| /anxiete-chien-transport/ | L'anxiété du chien en transport : reconnaître et apaiser | 1er juil. 2026 | anxiete-chien-transport | Santé / comportement |
| /road-trip-avec-chien/ | Road trip avec son chien : itinéraire, pauses et sécurité | 1er juil. 2026 | road-trip-avec-chien | Voiture |
| /accessoires-indispensables-voyage-chien/ | Les accessoires indispensables pour voyager avec son chien (2026) | 30 juin 2026 | accessoires-indispensables-voyage-chien | Équipement |
| /harnais-securite-voiture-chien/ | Choisir un harnais de sécurité voiture homologué pour son chien | 30 juin 2026 | harnais-securite-voiture-chien | Équipement / voiture |
| /meilleures-fontaines-eau-chien-2026/ | Les meilleures fontaines à eau pour chien en 2026 : comparatif | 29 juin 2026 | fontaines-eau-chien | Équipement |
| /hydratation-alimentation-chien-voyage/ | Hydratation et alimentation du chien en voyage | 29 juin 2026 | hydratation-alimentation-chien-voyage | Santé |
| /voyager-voiture-chien-equipements/ | Voyager en voiture avec son chien : les équipements utiles | 28 juin 2026 | equipements-voiture-chien | Voiture |
| /montagne-avec-chien/ | Partir à la montagne avec son chien : randonnée et sécurité | 28 juin 2026 | montagne-randonnee-avec-chien | Destinations |
| /harnais-chien-qui-tire/ | Quel harnais choisir pour un chien qui tire ? | 27 juin 2026 | harnais-anti-traction-chien | Équipement |
| /voyager-etranger-avec-chien/ | Voyager à l'étranger avec son chien : passeport, vaccins et formalités | 27 juin 2026 | passeport-vaccins-formalites-chien | Formalités ⚠ (hésitation forte avec /fr/countries/ : c'est un guide générique, pas un hub par pays — mais le recoupement est important) |
| /trousse-premiers-secours-chien/ | La trousse de premiers secours canine en voyage | 26 juin 2026 | trousse-premiers-secours-chien | Santé |
| /destinations-dog-friendly-france/ | Où partir avec son chien en France : les meilleures destinations dog-friendly | 26 juin 2026 | destinations-dog-friendly-france | Destinations |
| /choisir-hebergement-dog-friendly/ | Bien choisir un hébergement dog-friendly (chambre d'hôtes, gîte, hôtel) | 26 juin 2026 | choisir-hebergement-dog-friendly | Hébergement (page pilier du menu source) |
| /voyager-voiture-avec-chien/ | Voyager en voiture avec son chien : le guide complet | 26 juin 2026 | voyager-en-voiture-avec-chien | Voiture (page pilier du menu source) |
| /meilleurs-tapis-rafraichissants-chien/ | Les meilleurs tapis rafraîchissants pour chien (canicule) | 26 juin 2026 | tapis-rafraichissants-chien | Équipement ⚠ (/fr/tools/heat/ traite l'embargo chaleur en soute, sujet différent) |
| /premiere-fois-vacances-avec-chien/ | Première fois en vacances avec son chien : la checklist complète | 26 juin 2026 | premieres-vacances-avec-chien | Guide / checklist |
| /proteger-coussinets-chien/ | Protéger les coussinets de son chien : bitume chaud, sable, gel | 26 juin 2026 | proteger-coussinets-chien | Santé |
| /prendre-le-train-avec-chien/ | Prendre le train avec son chien : règles, billets et conseils | 25 juin 2026 | prendre-le-train-avec-chien | Train (page pilier du menu source) |
| /mal-des-transports-chien/ | Le mal des transports chez le chien : causes et solutions | 25 juin 2026 | mal-des-transports-chien | Santé |
| /voyager-avion-avec-chien/ | Voyager en avion avec son chien : cabine, soute, démarches | 25 juin 2026 | voyager-en-avion-avec-chien | Avion ⚠ (guide pilier ; aucune page FR équivalente dans dist, le Travel Hub est vide) |
| /materiel-voyage-chien/ | Choisir le matériel de voyage pour son chien (caisse, harnais, sac) | 25 juin 2026 | materiel-voyage-chien | Équipement |
| /proteger-coussinets-chien-ete/ | Comment protéger les coussinets de son chien en été ? | 25 juin 2026 | coussinets-chien-ete | Santé (doublon **interne** avec /proteger-coussinets-chien/ — à fusionner à l'import) |
| /canicule-chien-coup-de-chaleur/ | Canicule et chien : reconnaître et prévenir le coup de chaleur | 25 juin 2026 | coup-de-chaleur-chien | Santé ⚠ (/fr/tools/heat/ répond à « soute + chaleur », pas au coup de chaleur clinique) |
| /week-end-chien-pres-de-paris/ | Un week-end avec son chien près de Paris : idées et bonnes adresses | 25 juin 2026 | week-end-avec-chien-pres-de-paris | Destinations |
| /sacs-transport-petits-chiens/ | Les sacs de transport les plus confortables (petit chien) | 24 juin 2026 | sacs-transport-petit-chien | Équipement ⚠ (/fr/tools/best-carriers/) |
| /meilleures-gamelles-voyage-chien/ | Les meilleures gamelles de voyage pour son chien | 23 juin 2026 | gamelles-voyage-chien | Équipement |
| /caisse-transport-avion-homologuee-chien/ | Choisir une caisse de transport homologuée (avion) | 22 juin 2026 | caisse-homologuee-iata-chien | Équipement ⚠ (/fr/tools/crate/ calcule la taille, /fr/tools/best-crates/ liste des modèles ; ce guide explique la norme) |
| /museliere-transport-chien/ | Muselière de transport : laquelle et comment habituer | 17 juin 2026 | museliere-transport-chien | Équipement |
| /securite-visibilite-chien-nuit/ | Sécurité et visibilité : voir et être vu la nuit | 16 juin 2026 | visibilite-chien-nuit | Équipement |
| /trousse-toilette-entretien-chien/ | Trousse de toilette et entretien du chien en déplacement | 15 juin 2026 | trousse-toilette-chien-voyage | Équipement |
| /gourde-hydratation-nomade-chien/ | Gourde et hydratation nomade : bien s'équiper | 14 juin 2026 | gourde-hydratation-nomade-chien | Équipement |
| /occuper-chien-trajet-jouets/ | Occuper son chien en trajet : jouets et anti-ennui | 13 juin 2026 | occuper-chien-en-trajet | Comportement |
| /couchage-tapis-voyage-chien/ | Couchage et tapis de voyage : bien choisir | 12 juin 2026 | couchage-voyage-chien | Équipement |
| /barriere-coffre-separation-voiture-chien/ | Barrière de coffre et grille de séparation voiture | 11 juin 2026 | barriere-coffre-voiture-chien | Équipement / voiture |
| /rampe-marches-acces-chien/ | Rampe et marches d'accès : aider son chien à monter | 10 juin 2026 | rampe-acces-chien | Équipement |
| /sac-a-dos-transport-chien/ | Sac à dos et sac ventral de transport pour chien | 9 juin 2026 | sac-a-dos-transport-chien | Équipement |
| /laisse-collier-harnais-chien/ | Bien choisir la laisse, le collier et le harnais de voyage | 8 juin 2026 | laisse-collier-harnais-voyage | Équipement |
| /proprete-besoins-chien-voyage/ | Gérer la propreté et les besoins de son chien en voyage | 6 juin 2026 | proprete-besoins-chien-voyage | Pratique |
| /soigner-coussinets-rando-plage-chien/ | Soigner les coussinets après la randonnée ou la plage | 5 juin 2026 | soigner-coussinets-apres-balade | Santé |
| /voyager-chien-age-malade/ | Voyager avec un chien âgé ou malade en sécurité | 4 juin 2026 | voyager-chien-age-ou-malade | Santé |
| /piqures-morsures-chien/ | Piqûres et morsures : guêpes, serpents, chenilles | 3 juin 2026 | piqures-morsures-chien | Santé |
| /troubles-digestifs-voyage-chien/ | Troubles digestifs en voyage : prévenir et soulager | 2 juin 2026 | troubles-digestifs-chien-voyage | Santé |
| /otites-oreilles-baignade-chien/ | Otites et oreilles après la baignade : prévenir et repérer | 1er juin 2026 | otites-baignade-chien | Santé |
| /coup-de-froid-hypothermie-chien/ | Coup de froid et hypothermie chez le chien | 31 mai 2026 | hypothermie-chien | Santé |
| /epillets-danger-ete-chien/ | Épillets : le danger de l'été, prévention et retrait | 30 mai 2026 | epillets-chien | Santé |
| /anxiete-separation-vacances-chien/ | Anxiété de séparation en vacances : éviter le stress | 29 mai 2026 | anxiete-separation-vacances | Comportement |
| /vaccins-vermifuge-antiparasitaires-chien/ | Vaccins, vermifuge et antiparasitaires : le calendrier avant de partir | 28 mai 2026 | calendrier-sante-avant-depart | Santé ⚠ (/fr/tools/timeline/ est un rétro-planning administratif du voyage, pas un calendrier vétérinaire) |

**Répartition thématique de B** : équipement 24, santé et comportement 18, destinations et
hébergements 8, voiture 5, autres transports (train, ferry, urbain, avion) 5, formalités
et guides généraux 2.

---

## 4. Tableau C — Pages de service

| URL source | nature | traitement proposé |
|---|---|---|
| /a-propos/ | À propos du site | 301 vers /fr/about/ (existe) |
| /auteur/ | Fiche auteure « Camille Roussel » | pas d'équivalent — 301 vers /fr/about/ |
| /contact/ | Page contact (e-mail obfusqué par Cloudflare) | 301 vers /fr/about/ ou /fr/report-error/ (existent) |
| /charte-editoriale/ | Méthode, sources, indépendance | 301 vers /fr/about/ |
| /mentions-legales/ | Mentions légales (**champs éditeur non renseignés : « [À compléter] »**) | 301 vers /fr/legal-notice/ (existe) |
| /categories/ | Index des 5 catégories | 301 vers /fr/travel-hub/ |
| /categories/voyager/ | Catégorie (73 articles annoncés) | 301 vers /fr/travel-hub/ |
| /categories/compagnies-aeriennes/ | Catégorie (64 articles annoncés) | 301 vers /fr/airlines/ |
| /categories/destinations/ | Catégorie (32 articles annoncés) | 301 vers /fr/travel-hub/ |
| /categories/equipement/ | Catégorie (25 articles annoncés) | 301 vers /fr/travel-hub/ |
| /categories/sante/ | Catégorie (19 articles annoncés) | 301 vers /fr/travel-hub/ |
| /page/2/ … /page/8/ (7 URL) | Pagination de la liste principale | 301 vers /fr/travel-hub/ |
| /categories/<cat>/page/N/ (~22 URL) | Pagination de catégorie — **déduite** des compteurs (9 articles par page) et **non vérifiée une par une** | même traitement |
| /index.xml, /sitemap.xml | Flux RSS et sitemap | non récupérables avec `web_fetch` (« binary data ») ; à traiter côté serveur |

---

## 5. Points d'attention

**1. Contradiction de chiffres à l'intérieur même de lechienvoyageur.**
La balise `meta-description` de toutes les pages annonce « **61** compagnies aériennes »,
alors que le corps de l'accueil, la page `/outils/`, le comparateur et le titre de
l'article `/comparatif-compagnies-aeriennes-chien/` annoncent « **62** compagnies ». Le
décompte réel des fiches publiées est de **62**. Je ne tranche pas, je signale.

**2. Contradiction entre les deux sites : 62 contre 78.**
lechienvoyageur revendique 62 compagnies, MyDogCanFly en publie 78 (`dist/fr/airlines`
contient 79 entrées dont l'index). Les 62 de lechienvoyageur sont **toutes** couvertes par
MyDogCanFly ; les 16 compagnies supplémentaires côté MyDogCanFly sont : Aer Lingus,
Air China, Air New Zealand, China Eastern, China Southern, Condor, EL AL, Garuda Indonesia,
Icelandair, IndiGo, KM Malta, Malaysia Airlines, Qantas, Smartwings, Virgin Atlantic,
Virgin Australia. Aucune reprise de données n'est donc nécessaire côté compagnies.

**3. Aucun pays ni aucune compagnie « exclusifs » à lechienvoyageur.**
Vérification faite fiche par fiche : les 22 pays traités (y compris ceux regroupés dans
`/voyager-chien-irlande-finlande-malte-norvege/` et `/voyager-chien-belgique-pays-bas/`)
ont tous un dossier dans `dist/fr/countries/`. Il n'y a donc **rien à sauver** de ce
côté-là. C'est le résultat le plus important de cet inventaire : la valeur de la reprise
est entièrement dans les 62 guides pratiques.

**4. Deux articles regroupent plusieurs pays dans une seule URL.**
`/voyager-chien-irlande-finlande-malte-norvege/` (4 pays) et
`/voyager-chien-belgique-pays-bas/` (2 pays). Une 301 ne peut pointer que vers un seul
pays. Il faudra choisir la destination principale (proposition : `ie` et `be`) ou rediriger
vers `/fr/countries/`.

**5. Pas de page « Union européenne » côté MyDogCanFly.**
`/voyager-chien-union-europeenne/` est classé A (le sujet est couvert, pays par pays), mais
MyDogCanFly n'a pas d'unique page « voyager dans l'UE avec son chien ». La 301 vers
`/fr/countries/` fait perdre une intention de recherche assez générique. C'est le seul cas
de A où j'aurais compris qu'on choisisse B.

**6. Images : dépendance à Unsplash, pérennité non garantie.**
Une partie des visuels d'articles est appelée directement depuis
`https://images.unsplash.com/photo-…?ixid=…&ixlib=rb-4.1.0&w=800&h=500&…`, c'est-à-dire
en hotlink avec un `ixid` de session. Ces URL **ne sont pas des URL de fichier stables** :
elles dépendent du service Unsplash et de sa politique de hotlinking. Si des articles sont
importés, les images doivent être re-téléchargées, ré-hébergées, et le crédit photographe
reconstitué (il n'apparaît pas dans le HTML récupéré).
Corollaire visible : de nombreux textes alternatifs sont restés en **anglais**, tels que
fournis par Unsplash — « black pug puppy on car seat », « a brown and white dog eating out
of a metal bowl », « green grass field and trees covered mountain during daytime »… Sur un
site français, ces `alt` sont à réécrire à l'import.

**7. Un doublon interne à corriger avant import.**
`/proteger-coussinets-chien/` (26 juin) et `/proteger-coussinets-chien-ete/` (25 juin)
traitent le même sujet. À fusionner en une seule page dans le Travel Hub.

**8. Sept articles se situent à la frontière A/B** (marqués ⚠ dans le tableau B). Ils sont
tous classés B, conformément à la consigne. Les plus discutables :
`/voyager-etranger-avec-chien/` (recoupe le hub formalités) et
`/caisse-transport-avion-homologuee-chien/` (recoupe `/fr/tools/crate/` et
`/fr/tools/best-crates/`).

**9. Le Travel Hub est aujourd'hui vide.**
`dist/fr/travel-hub/index.html` ne contient qu'un bloc « bientôt disponible » (classe CSS
`th-soon`) et une grille de liens vers les fiches existantes. Les 62 articles de B ont donc
un emplacement d'accueil, mais le gabarit d'article éditorial reste à construire.

**10. Deux points techniques repérés.**
(a) `/outils/formalites-chien-par-pays/` est servi **sans en-tête ni pied de page**, et son
tableau « Niveau d'exigence par destination » est **vide dans le HTML** : il est rempli en
JavaScript. Contenu non crawlable.
(b) Le site répond aussi bien sur `lechienvoyageur.com` que sur `www.lechienvoyageur.com`,
avec des URL absolues qui changent de domaine selon l'hôte appelé, alors que le `canonical`
pointe toujours vers la version sans `www`. À vérifier avant de poser les 301, pour ne pas
créer de chaînes de redirection.

**11. Chiffre invérifié.**
L'accueil annonce « **85+** guides pratiques » alors que la pagination expose 149 articles.
Je ne sais pas ce que compte ce « 85+ » (il est proche de 149 − 62 fiches compagnies = 87,
mais ce n'est qu'une hypothèse). Je le signale sans conclure.

**12. Ce que je n'ai pas pu vérifier.**
`/sitemap.xml` et `/index.xml` renvoient « binary data » avec `web_fetch` : l'inventaire
repose donc entièrement sur la pagination HTML et les index de catégories. Des pages non
listées (`noindex`, orphelines, brouillons) peuvent exister sans apparaître ici. Les
~22 pages de pagination de catégorie ont été **déduites** des compteurs affichés sur
`/categories/`, non récupérées une à une.
