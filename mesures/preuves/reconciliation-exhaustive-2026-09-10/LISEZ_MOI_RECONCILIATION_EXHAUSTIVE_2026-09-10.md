# Réconciliation exhaustive des politiques officielles avec le Finder — mesure préalable (10/09/2026)

Ordre de Philippe, relayé par Codex : vérifier les 102 compagnies × 3 canaux (306 couples) pour que toute
information utile publiée par une source officielle atteigne le contrat de preuve du Finder — acceptations,
plafonds et base du poids, restrictions, délais, **tarifs** (montant, devise, unité de facturation, zone,
canal, date, URL), fret obligatoire. Inventaire complet AVANT toute modification, puis lots de compagnies,
un seul build complet et une seule batterie CI par PR.

## Ce que ce dossier contient

`MATRICE_306_PRE_LECTURE.{json,csv}` — les 306 lignes, avec les colonnes demandées :

`compagnie · canal · état Finder actuel · ancienne information disponible · URL officielle · fait officiel
trouvé · preuve raccordée oui/non · tarif trouvé · tarif raccordé oui/non · action`

Colonnes CALCULÉES depuis le dépôt (`objects.json`, `airlines.generated.json`, inventaire des preuves,
projection `loadKB`) : état Finder actuel (statut + cause), ancienne information (bloc `channels:` éditorial,
plafond hérité et sa base, brachycéphales, conditions héritées), URL officielle connue, preuve raccordée,
tarif hérité (`fee`, `fareList`), classe pré-lecture, catégorie de l'inventaire, action.

Colonnes marquées **« À LIRE (Codex) »** : le fait officiel trouvé et le tarif officiel trouvé exigent la
lecture directe des pages officielles actuelles, que ce conteneur ne peut pas faire. C'est le partage de
travail établi : Codex lit et cite ; l'importeur rejouable écrit ; les compteurs bougent par mouvements nommés.

## Mesuré (pré-lecture)

| classe | lignes |
|---|---|
| décision du Finder déjà correcte (politique citée) | **179** |
| ancienne information présente, non raccordée (piste) | **118** (cabine 22, soute 29, fret 67) |
| aucune ancienne information | **9** : Air Tahiti Nui soute, Virgin Australia soute, et le fret d'Asiana, Condor, EVA Air, La Compagnie, Norwegian, Smartwings, Transavia |
| lignes portant un tarif hérité (`fee` / `fareList`), inventaire non prouvé | **199**, dont 133 sur un canal cité et 66 sur un canal non cité |
| tarifs raccordés au Finder | **0** — aucun montant n'atteint le Finder aujourd'hui (règle : pas de montant sans preuve tarifaire propre) |

Les deux premières catégories de l'ordre (« décisive trouvée mais non raccordée », « tarif officiel trouvé mais
masqué ») ne peuvent être établies qu'après lecture : cette matrice en fournit les candidats — les 118 pistes
et les 199 tarifs hérités — dans l'ordre où les lire.

## SAS et Finnair — cas déjà établis par Codex, à recevoir au format des lots

État actuel : SAS cabine citée (8 kg chien + sac), soute et fret « à confirmer » (`legacy_unreviewed`) ;
Finnair cabine citée, soute et fret « à confirmer ». Tarifs hérités présents (SAS cabine/soute « domestique →
Chine », Finnair cabine/soute Europe / intercontinental), non prouvés.

Pour importer, il faut le **dossier au format des lots stricts** (facts : `airline_id`, `placement`,
`recommendation`, `condition_scope`, `finder_effect`, `url`, `quote`, `quote_language`, `locator` ;
`provenance_defaults`) — soute et fret pour les deux compagnies — et, pour les tarifs, des faits tarifaires
au schéma proposé ci-dessous. La contradiction Finnair soute (deux pages officielles, deux montants) doit
arriver avec ses deux sources et leurs dates : elle sera consignée comme conflit, jamais tranchée en silence.

## Proposition de schéma tarifaire (à arbitrer avant tout import)

```yaml
policies:
  hold:
    fares:
      - amount: 140
        currency: EUR
        unit: per_segment          # per_segment | per_journey | per_one_way | per_animal | per_container
        zone: "Europe"             # libellé officiel
        zone_scope:                # ce que le moteur peut opposer au trajet ; absent = tarif non appliqué au trajet, seulement affiché
          destination_regions: [europe]
        booking: "at booking"      # facultatif, texte officiel court
        source: { url, quote, quote_language, locator, verified_date, review_due, confidence, reviewer }
    fare_conflicts:
      - field: hold_fare_europe
        sources: [{ url, quote, verified_date }, { url, quote, verified_date }]
        note: "deux pages officielles, deux montants — non tranché"
```

Effet Finder : quand un tarif cité s'applique au trajet (zone opposable), la ligne canal dit « 140 € par
segment (Europe) », provenance datée dans le volet des preuves ; sinon « tarif à confirmer » reste, et un
conflit consigné force « tarif à confirmer » en nommant le conflit. Zones non modélisées : affichées sur la
fiche, jamais appliquées au trajet. Le bandeau « itinéraire à confirmer » de SAS est une question séparée
(départ et arrivée exacts de la recherche), hors de ce schéma.

## Conditions de clôture (reprises de l'ordre)

Aucun canal décisif publié sans preuve ; aucun canal « à confirmer » quand une phrase officielle actuelle
décide ; aucun tarif applicable connu derrière « tarif à confirmer » ; aucun fret documenté présenté comme non
publié ; compte exact des réponses améliorées et liste nominative des inconnues restantes. Conflits et
ambiguïtés : soumis à Philippe. Raccordements explicites : exécutés sans nouvel arbitrage.

## Erreur nommée

Premier jet de ce LISEZ_MOI (commit `34d6419`) : trois chiffres écrits avant d'avoir relu le calcul — soute 31 / fret
65 (réel : 29 / 67), « 113 sur un canal cité » (réel : 133), et une liste des neuf « sans information » inventée de
mémoire (la vraie est ci-dessus). Corrigés ici ; le message du commit fautif reste tel quel dans l'historique.

## Arbitrage de Codex sur le schéma tarifaire (10/09/2026) — reçu, schéma refusé en l'état

`ARBITRAGE_TARIFS_SAS_FINNAIR_2026-09-10.md`, conservé ici tel quel. Mon `unit` unique est refusé pour une
raison P0 que je n'avais pas vue : **deux axes s'appliquent simultanément**. SAS facture par contenant ET par
vol. Le schéma retenu les sépare — `billing_subject` (pet, container, pet_or_container, booking, shipment,
kilogram) et `journey_basis` (per_segment, per_one_way, per_journey, per_round_trip) —, ajoute
`price.kind: exact | range | quote`, un `applies_when` qui est un prédicat **exécutable sur les faits
réellement injectés au Finder** (et non une zone en texte libre), un `purchase_window` distinct de la date du
voyage, et exige une **citation propre au tarif** : la phrase qui prouve qu'un canal existe ne prouve pas son
prix. Aucune conversion de devise ; plusieurs devises publiées sur une même ligne sont des montants parallèles,
pas un conflit.

Invariants à éprouver, tels qu'arbitrés : aucune portée libre ne décide ; aucun tarif sans citation ; aucune
conversion ; `billing_subject` et `journey_basis` obligatoires ; zéro ou un tarif applicable par devise et par
portée ; tout chevauchement divergent devient un conflit ; un conflit couvrant le trajet interdit tout montant
exact dans le Finder.

## Ordre de lecture — ma proposition corrigée par Codex

J'additionnais deux populations différentes. Les **133** sont des lignes TARIFAIRES héritées sur un canal déjà
cité ; les 22 cabine, 29 soute et 67 fret sont **118 pistes de POLITIQUES** non raccordées. Ordre de rendement
retenu : (1) les 133 tarifs sur canal cité, cabine et soute d'abord ; (2) les 66 tarifs sur canal non cité, en
privilégiant les pages qui ferment politique et tarif d'une seule lecture ; (3) les 22 et 29 pistes cabine et
soute ; (4) les 67 pistes fret en dernier, sauf fret imposé par la route ou seul canal restant. Lots de dix
compagnies, matrice avant/après, comparaison Claude/Codex, import des seules intersections confirmées ou des
conflits structurés.

## SAS et Finnair — reçus au format strict

Soute et fret des deux compagnies, citations, locators, lecture du 2026-09-10, révision 2026-12-09,
confiance 4. Tarifs SAS publiés par portée (domestique, Scandinavie/Europe/Moyen-Orient, Asie/Canada/États-Unis,
Chine), `billing_subject: container`, `journey_basis: per_segment`, fret sur devis. Finnair cabine concordante
sur les deux pages (Europe 60/65 EUR selon J-7, long-courrier 120/130 EUR et 130/140 USD), fret sur devis.
**Conflit Finnair soute** : 140/650 EUR sur la page « Animaux de compagnie à bord », 120/600 EUR sur la page
tarifaire (mise à jour annoncée le 2026-06-08). `status: unresolved`, `effect: suppress_exact_fare` — la fiche
peut dire « tarifs officiels contradictoires », jamais trancher.

SAS soute laisse `weight_includes_carrier` non renseigné : la page ne dit pas si le contenant entre dans les
50 kg. C'est exactement le cas où notre modèle refuse de refuser au seuil — la portée reste nommée, non déduite.

## Audit tarifaire indépendant de Codex — reçu, empreinte vérifiée, garde rejouée (10/09/2026)

Archive `AUDIT_TARIFS_102_COMPAGNIES_2026-09-10.zip`, dépliée dans `audit-tarifs-codex/`. **SHA-256 recalculé
ici : `252b7954…c6027` — identique à celui qu'annonce Codex.** Sa garde rejouable passe sans modification :

```
$ node audit-tarifs/consolider.mjs
OK — 102 compagnies, 306 lignes, aucun doublon, trois canaux chacune
```

Comptes relus dans le JSON, et concordants avec le LISEZ_MOI de Codex :

| classe tarifaire | canaux | | classe tarifaire | canaux |
|---|---:|---|---|---:|
| MATRIX | 59 | | QUOTE | 47 |
| EXACT | 35 | | QUOTE_OR_NOT_FOUND | 15 |
| RANGE | 13 | | NOT_FOUND | 52 |
| FORMULA | 12 | | NOT_APPLICABLE | 62 |
| CALCULATOR | 4 | | CONFLICT | 3 |
| MINIMUM, BOOKING_ONLY | 2 + 2 | | **total** | **306** |

Les sept premières classes font les **127** mécanismes exploitables ; QUOTE et QUOTE_OR_NOT_FOUND font les **62**
devis. Côté citation : 95 extraits portent un prix, 78 un mécanisme — dont les 62 devis, ce qui laisse bien
**111** lignes exploitables à preuve directe, **16** `LOCATOR_ONLY_REVIEW_BEFORE_IMPORT` et **3**
`CONFLICT_DO_NOT_IMPORT`. Rien à recompter : les nombres de Codex sont vérifiés, pas repris.

### Ce que cet audit change pour moi

Il remplace les deux colonnes « À LIRE (Codex) » de ma matrice pré-lecture. Ma matrice reste la carte du dépôt
(état du Finder, ancienne information, preuve raccordée) ; l'audit apporte le fait officiel et le tarif. Les
identifiants y sont nus (`sas`, `aegean`), sans le préfixe `airline_` : la jointure se fait sur le slug.

**Mon travail restant est un travail de schéma, de mapping et de témoins — pas une nouvelle lecture métier.**

### Neuf blocages nommés par Codex, dont trois touchent mes propres imports

Conflits officiels à consigner sans trancher : Finnair soute (120/600 contre 140/650 EUR), South African Airways
soute (300 ZAR en anglais contre 250 ZAR en portugais), SunExpress soute à Ercan (25 contre 15 EUR au paiement).
Portées à ne pas généraliser : Qantas soute (certains aéroports seulement — c'est aussi la dette de fiche nommée
en annexe 40), Aer Lingus soute (soute physique contre produit fret via agent), China Eastern cabine (demande sur
certains vols intérieurs, un refus mondial serait faux).

**Trois divergences visent des preuves que j'ai importées et demandent une contre-lecture :**

1. **Air China cabine** — l'audit conclut que les animaux ordinaires n'y sont pas proposés ; le correctif
   d'arbitrages du 09/09 l'a passée à `offered` sur ordre. Portée de cette preuve à relire.
2. **Batik Air Indonesia** — l'audit n'avait trouvé aucune preuve exploitable ; le lot 9 y a importé deux refus
   cités. Page à contre-lire.
3. **Saudia cabine et soute** — l'URL utilisée est une adresse `booking-uat`, exclue par l'audit comme preuve de
   production. C'est une dette que j'avais déjà nommée ; elle est maintenant opposée par un tiers.

Aucun de ces points n'est tranché ici : ils vont à Philippe, avec les deux lectures en regard.
