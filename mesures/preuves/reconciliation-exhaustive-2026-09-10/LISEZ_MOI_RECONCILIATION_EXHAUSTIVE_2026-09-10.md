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
