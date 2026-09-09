# Politiques compagnies — lot strict 8

Date de lecture : **9 septembre 2026**. Ce dossier accompagne
`PREUVES_POLITIQUES_COMPAGNIES_LOT_8_STRICT_2026-09-09.json`.

## Portée

10 compagnies, 23 faits importables et 7 non-décisions explicites. Chaque fait
porte une citation continue issue d’une page, d’un tarif ou d’un contrat publié
par la compagnie. Le lot sépare strictement AVIH, soute technique et fret.

| Compagnie | Cabine | Soute | Fret | Point de prudence |
| --- | --- | --- | --- | --- |
| Bangkok Airways | non décidé | non décidé | sous conditions | fret intérieur seulement ; routes internationales refusées par la page |
| China Southern | refus documenté | sous conditions | non décidé | chiens guides hors verdict cabine |
| Copa Airlines | sous conditions | refus documenté | sous conditions | plus d’AVIH passager ; hors cabine, organisation par Copa Cargo |
| IndiGo | refus documenté | refus documenté | refus documenté | interdiction générale des animaux ordinaires ; chiens guides séparés |
| Thai Airways | refus documenté | sous conditions | sous conditions | cabine refusée aux animaux ordinaires ; nombreux embargos de races/routes |
| Tunisair | sous conditions | sous conditions | non décidé | accord préalable ; 8 kg incluant contenant et nourriture en cabine |
| SKY express | sous conditions | sous conditions | non décidé | soute ATR seulement, 25 kg avec caisse |
| KM Malta Airlines | sous conditions | sous conditions | sous conditions | routes directes et Royaume-Uni fortement bornés |
| SunExpress | sous conditions | sous conditions | non décidé | 8 kg avec contenant en cabine ; confirmation préalable |
| Smartwings | sous conditions | sous conditions | non décidé | 8 kg cabine, 32 kg soute avec caisse ; opérateur effectif et capacité |

## Décisions volontairement non prises

- **Bangkok Airways — cabine/soute** : la source examinée est une page Cargo ;
  elle ne prouve aucun canal passager.
- **China Southern, Tunisair, SKY express, SunExpress et Smartwings — fret** :
  les pages ne fondent pas une offre générale de fret canin séparée.

## Règles d’intégration obligatoires

1. Importer exactement les 23 objets `facts`; conserver les 7 non-décisions.
2. Ne pas changer les citations, URL, langues, localisateurs ou la date.
3. Dériver l’échéance par `reviewDueFrom` ; ne pas copier une date calculée.
4. **Copa** : `hold = not_offered_for_pet_dogs` et
   `cargo = offered_with_conditions`. Fusionner ces deux états serait faux.
5. **IndiGo** : le refus vise les animaux ordinaires, pas les chiens guides.
6. **Bangkok Airways** : la preuve cargo est limitée aux routes domestiques
   listées. Elle ne doit jamais devenir une réponse internationale.
7. **Thai Airways** : « contactez Cargo » reste conditionnel ; il ne garantit
   ni route, ni place, ni acceptation.
8. Respecter toutes les bases de poids combinées et les restrictions d’appareil.
9. Rejouer l’inventaire, les tests du quatrième état et des scénarios Finder.

## Sources directes relues

- Bangkok Airways Cargo — https://prod.bangkokair.com/eng/cargo-service/pet_carriage
- China Southern — https://www.csair.com/hk/en/tourguide/faq/baggage/dongwu.shtml
- Copa, politique cabine — https://www.copaair.com/assets/ENG-COM-24-001-Update-Service-or-Emotional-Support-Dog-and-Pet-in-Cabin-Transportation-Policy.pdf
- Copa, contrat de transport — https://www.copaair.com/assets/contrato-de-transporte-en-dot-oct-2024.pdf
- IndiGo — https://www.goindigo.in/information/how-to-book.html?loginPopup=true
- Thai Airways, cabine — https://www.thaiairways.com/en-th/content/special-assistance/travel-with-pets/pets-in-cabin/
- Thai Airways, soute/fret — https://www.thaiairways.com/en-tw/content/special-assistance/travel-with-pets/pets-as-checked-baggage-avih/
- Tunisair — https://www.tunisair.com/fr/conditions-generales-de-transport
- SKY express — https://www.skyexpress.gr/en/sky-experience/sky-pets
- KM Malta Airlines — https://kmmaltairlines.com/en/travelling-with-pets
- SunExpress — https://www.sunexpress.com/en-gb/information/luggage-info/transporting-animals/
- Smartwings — https://www.smartwings.com/en/fees-and-charges/?layout=default

## Vérification avant livraison

- 10 identifiants compagnie présents dans le référentiel.
- 23 citations continues, sans ellipse dans `quote`.
- 7 canaux explicitement indécis.
- 30 issues uniques : une par compagnie × canal.
- Aucun effet sur le dépôt applicatif ou la production.

