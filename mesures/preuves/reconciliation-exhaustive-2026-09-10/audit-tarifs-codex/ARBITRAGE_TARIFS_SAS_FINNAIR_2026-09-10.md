# Arbitrage Codex — tarifs, SAS et Finnair — 10 septembre 2026

À transmettre à Claude. Sources officielles relues directement le 10 septembre 2026.

## 1. Verdict sur le schéma tarifaire

Principe accepté, schéma refusé en l'état pour une raison P0 : `unit` mélange deux axes qui peuvent s'appliquer simultanément. SAS facture par contenant **et** par vol/segment. Une seule valeur parmi `per_segment | per_journey | per_one_way | per_animal | per_container` ne peut pas exprimer ce fait.

Forme minimale recommandée :

```yaml
fares:
  - id: fare_airline_placement_scope
    placement: cabin | hold | cargo
    price:
      kind: exact | range | quote
      amounts:                # devises publiées, jamais converties par nous
        - { amount: 75, currency: EUR }
    billing_subject: pet | container | pet_or_container | booking | shipment | kilogram
    journey_basis: per_segment | per_one_way | per_journey | per_round_trip
    applies_when: {}          # prédicat exécutable sur les faits réellement injectés au Finder
    purchase_window:          # facultatif ; condition tarifaire, distincte de la date du voyage
      min_days_before_departure: 7
    source: {}                # SourceCitable existant, citation propre au tarif
```

Décisions de contrat :

- Réemployer `Money`, `SourceCitable` et le système de prédicats canonique ; ne pas créer une seconde provenance ni un second langage de règles.
- Une zone en texte libre sert à l'affichage, jamais à choisir un prix. La portée doit être opposable au trajet dans les deux sens : origine, destination, région, vol domestique/international et transporteur opérant si la page le précise.
- Si les faits nécessaires manquent, le Finder n'invente pas un prix : il affiche la plage publiée ou « tarif sur devis ».
- Le prix a sa propre citation. La citation qui prouve qu'un canal existe ne prouve pas son prix.
- Ne jamais convertir une devise. Plusieurs devises sur une même ligne sont des montants publiés équivalents, pas un conflit.
- Pour une correspondance facturée par vol, afficher « X par segment » ; ne calculer un total que si les segments opérés sont réellement établis.
- Un conflit non résolu interdit l'affichage d'un montant exact sur la portée concernée.

Le bloc de conflit doit porter les deux **observations complètes**, pas seulement deux URL :

```yaml
fare_conflicts:
  - id: fare_conflict_finnair_hold_2026_09_10
    placement: hold
    applies_when: {}          # même portée structurée que les tarifs
    status: unresolved
    effect: suppress_exact_fare
    observations:
      - price: {}
        source: {}            # SourceCitable complet
      - price: {}
        source: {}
    note: "Deux pages officielles vivantes publient des montants différents."
```

Invariants à éprouver : aucune portée libre ne décide ; aucun tarif sans citation ; aucune conversion ; `billing_subject` et `journey_basis` obligatoires ; zéro ou un tarif applicable par devise et portée ; tout chevauchement différent devient conflit ; conflit couvrant un trajet = aucun montant exact dans le Finder.

## 2. SAS — faits stricts

Provenance commune : `source_type: official_website`, `verified_date: 2026-09-10`, `review_due: 2026-12-09`, `confidence: 4`, `reviewer: Codex — direct reading of official airline material`.

### Soute

```yaml
airline_id: airline_sas
placement: hold
recommendation: offered_with_conditions
condition_scope: "Chiens et chats seulement ; réservation auprès de SAS et disponibilité ; poids maximal publié de 50 kg ; dimensions selon l'appareil ; restrictions pour certaines races brachycéphales. La page n'établit pas clairement dans le libellé du poids si le contenant est inclus : laisser weight_includes_carrier non renseigné."
finder_effect: "SAS soute : acceptée sous conditions ; plafond publié de 50 kg, portée exacte du poids à confirmer."
url: https://www.flysas.com/en/travel-info/travel-with-pets/in-hold
quote: "it will need to travel in the cargo hold"
quote_language: en
locator: "Pets traveling in hold → opening paragraph; Size and weight limits"
```

### Fret

```yaml
airline_id: airline_sas
placement: cargo
recommendation: offered_with_conditions
condition_scope: "Fret via un transitaire lorsque l'animal ne remplit pas les critères de soute ou pour certains pays ; SAS cite explicitement la Chine, le Royaume-Uni et les Émirats arabes unis."
finder_effect: "SAS fret : accepté sous conditions via un transitaire ; requis dans les cas et destinations publiés."
url: https://www.flysas.com/en/travel-info/baggage/cargo
quote: "book it as cargo using a freight forwarder"
quote_language: en
locator: "Pet as cargo → opening paragraph"
```

### Tarifs SAS publiés

Source : même page officielle « Pets traveling in hold », sections « Fees for bringing a pet on board », « Pet in cabin » et « Pet in cargo hold ». La page précise une facturation par contenant, par aller simple, et indique aussi que les frais sont appliqués par vol : encoder `billing_subject: container`, `journey_basis: per_segment`.

| Portée | Cabine | Soute |
|---|---:|---:|
| Domestique | 55 EUR | 90 EUR |
| Scandinavie, Europe, Moyen-Orient | 75 EUR | 169 EUR |
| Asie, Canada, États-Unis | 99 EUR | 340 EUR |
| Chine | 149 EUR | 725 EUR |

Les autres devises publiées peuvent être conservées comme montants parallèles de la même ligne. Le fret reste `price.kind: quote`.

## 3. Finnair — faits stricts

Provenance commune : `source_type: official_website`, `verified_date: 2026-09-10`, `review_due: 2026-12-09`, `confidence: 4`, `reviewer: Codex — direct reading of official airline material`.

### Soute

```yaml
airline_id: airline_finnair
placement: hold
recommendation: offered_with_conditions
condition_scope: "Chiens et furets de plus grande taille sur le même vol ; animal + contenant jusqu'à 75 kg sur un vol Finnair et 50 kg sur un vol Norra ; dimensions selon l'appareil ; réservation anticipée et disponibilité."
finder_effect: "Finnair soute : acceptée sous conditions, jusqu'à 75 kg avec le contenant sur Finnair, 50 kg sur Norra."
url: https://www.finnair.com/fr-fr/les-animaux-de-compagnie-%C3%A0-bord-des-vols-finnair
quote: "peuvent voyager en soute sur le même vol que vous"
quote_language: fr
locator: "Options de voyage pour les animaux de compagnie → Animaux de compagnie dans la soute de l'appareil"
```

### Fret

```yaml
airline_id: airline_finnair
placement: cargo
recommendation: offered_with_conditions
condition_scope: "Fret séparé au-dessus de 75 kg sur Finnair ou 50 kg sur Norra ; également pour certaines espèces, origines, destinations/transits ou animaux non accompagnés ; réservation par une société d'expédition."
finder_effect: "Finnair fret : accepté sous conditions lorsque les seuils ou cas publiés l'imposent ; tarif auprès du transitaire."
url: https://www.finnair.com/fr-fr/les-animaux-de-compagnie-%C3%A0-bord-des-vols-finnair
quote: "devra être expédié séparément comme fret"
quote_language: fr
locator: "Options de voyage pour les animaux de compagnie → Animal de compagnie transporté comme fret"
```

### Conflit officiel Finnair — soute

Ne choisir aucun montant. Les deux pages sont officielles, vivantes et ont été relues le même jour.

| Source officielle | Europe | Long-courrier | Date |
|---|---:|---:|---|
| Page « Animaux de compagnie à bord » | 140 EUR | 650 EUR / 700 USD | lue le 2026-09-10 ; aucune date de mise à jour visible |
| Page « Frais de bagage supplémentaire » | 120 EUR | 600 EUR / 650 USD | lue le 2026-09-10 ; la page annonce une mise à jour des frais le 2026-06-08 |

Effet obligatoire : `fare_conflicts.status: unresolved` et `effect: suppress_exact_fare` pour la soute Finnair. La fiche peut dire « tarifs officiels contradictoires — à confirmer », mais ne doit publier ni 120/140 ni 600/650 comme vérité tranchée.

La cabine, elle, est concordante sur les deux pages : Europe 60 EUR à J-7 ou plus, 65 EUR à J-6 ou moins ; long-courrier 120 EUR / 130 USD à J-7 ou plus, 130 EUR / 140 USD à J-6 ou moins. Les frais sont par voyage/aller simple selon les pages ; conserver le libellé publié et ne pas calculer une correspondance sans règle de segment explicite. Le fret reste sur devis.

## 4. Ordre de lecture arbitré

L'ordre proposé est corrigé car les nombres ne décrivent pas la même population : les 133 sont des lignes tarifaires héritées sur canal déjà cité ; les 22 cabine, 29 soute et 67 fret sont 118 pistes de politiques non raccordées. On ne doit pas les additionner comme des tarifs.

Ordre de rendement :

1. Les 133 tarifs hérités sur un canal déjà cité, avec priorité aux compagnies les plus visibles et aux canaux cabine/soute. Chaque prix reçoit toutefois sa propre citation : la preuve du canal n'est pas réutilisée comme preuve du montant.
2. Les 66 tarifs hérités sur canal non cité, en privilégiant les pages officielles qui permettent de fermer en une lecture la politique **et** le tarif.
3. Les 22 pistes cabine et 29 pistes soute restantes, toujours avant le fret sauf si le fret est le seul canal possible.
4. Les 67 pistes fret en dernier, sauf fret imposé par la route ou seul canal restant. Beaucoup aboutiront légitimement à « sur devis », ce qui est une réponse utile mais de rendement inférieur à un tarif cabine/soute.

Pilotage recommandé : lots de 10 compagnies, matrice avant/après, comparaison indépendante Claude/Codex, conflit explicite dès que deux sources officielles divergent, puis import seulement des intersections confirmées ou des conflits structurés.

## 5. Travail Codex en parallèle

L'audit indépendant est lancé sur les 102 compagnies en trois cohortes. Livrables prévus : un TSV factuel et un rapport Markdown par cohorte, avec URL officielle, citation verbatim, locator, date de lecture, canal, montants, portée, unité, conflit et verdict d'import. Claude peut commencer le contrat et les deux cas SAS/Finnair sans attendre ces cohortes ; leur comparaison servira de contre-lecture avant les imports de masse.
