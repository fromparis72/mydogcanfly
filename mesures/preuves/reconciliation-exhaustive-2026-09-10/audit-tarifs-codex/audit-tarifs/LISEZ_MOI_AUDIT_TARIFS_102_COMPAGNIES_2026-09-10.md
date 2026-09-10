# Audit indépendant des tarifs animaux — 102 compagnies

Date de lecture des sources : **10 septembre 2026**  
Révision : **V2 — contre-lecture Air China et Batik Air Indonesia**  
Échéance de revue recommandée : **9 décembre 2026**  
Objet : fournir à Claude une collecte officielle, structurée et indépendante pour raccorder les tarifs au Finder sans réactiver aveuglément les anciens champs `fee` et `fareList`.

## Livrables

- `consolidation-102-compagnies.tsv` : table consolidée, une ligne par compagnie et canal.
- `consolidation-102-compagnies.json` : même collecte, avec métadonnées et comptages.
- `cohorte-a.tsv`, `cohorte-b.tsv`, `cohorte-c.tsv` : relevés d'origine conservés.
- `cohorte-a.md`, `cohorte-b.md`, `cohorte-c.md` : méthode, diagnostics par compagnie et différentiel avec la branche de réconciliation de Claude.
- `consolider.mjs` : générateur et garde rejouable des deux fichiers consolidés.
- `../ARBITRAGE_TARIFS_SAS_FINNAIR_2026-09-10.md` : proposition de contrat tarifaire, faits SAS et Finnair, conflit Finnair et ordre d'import.

Commande de contrôle :

```bash
node audit-tarifs/consolider.mjs
```

Résultat exigé : **102 compagnies, 306 lignes, aucun doublon, exactement trois canaux par compagnie, date de vérification uniforme au 2026-09-10**.

## Ce que la collecte établit

Les 306 couples compagnie × canal se répartissent ainsi :

| Nature tarifaire officielle | Canaux | Usage public possible |
|---|---:|---|
| montant exact, fourchette, grille, formule, calculateur, minimum ou prix dans la réservation | **128** | afficher la valeur ou le mécanisme avec sa portée et sa preuve propre |
| devis ou devis/non trouvé | **62** | afficher « sur devis » seulement lorsque la source établit réellement le service ou le devis |
| tarif actuel non trouvé | **50** | ne pas réactiver le montant historique ; afficher « tarif à confirmer » si le canal existe |
| sans objet, canal non proposé | **63** | ne pas afficher de ligne tarifaire |
| conflit entre sources officielles | **3** | masquer le montant exact et signaler le conflit |
| **Total** | **306** | |

Les 128 mécanismes tarifaires exploitables concernent surtout les canaux voyageurs : **61 cabines, 65 soutes et 2 frets**. Ce résultat confirme que le fret est le moins rentable à documenter en prix public : il est généralement vendu sur devis.

Après la passe de renforcement des citations, **112 de ces 128** lignes portent dans l'extrait consolidé le prix, la formule, le calculateur ou le mécanisme de réservation. Les **16 autres** sont volontairement marquées `LOCATOR_ONLY_REVIEW_BEFORE_IMPORT` : la valeur figure dans une matrice officielle multi-lignes ou une surface difficile à extraire, mais une citation courte ne suffit pas à prouver toute la grille. Elles ne doivent pas être importées automatiquement.

La classe de service normalisée compte 153 canaux offerts, 37 conditionnels, 20 limités, 63 non proposés et 33 non établis. `NOT_ESTABLISHED` ne signifie jamais « refusé ».

## Conclusion sur le raccord actuel au Finder

Le travail de réconciliation de Claude raccorde les **politiques de transport** au Finder, pas les tarifs : les trois comparaisons Git trouvent **zéro modification de `channels[].fee` et zéro modification de `fareList`**.

Autrement dit, les décisions cabine/soute/fret ont beaucoup progressé, mais les prix restent dormants. Il faut maintenant :

1. ajouter un contrat tarifaire structuré ;
2. importer les preuves tarifaires de ce dossier ;
3. projeter la valeur applicable au trajet dans le Finder ;
4. garder « à confirmer », « sur devis » et « conflit » comme sorties distinctes.

## Contrat minimal à adopter avant l'import

Le champ `unit` proposé initialement ne suffit pas : SAS facture simultanément **par contenant** et **par vol/segment**. Le modèle doit séparer au minimum :

- `placement` : cabin / hold / cargo ;
- `price.kind` : exact / range / matrix / formula / calculator / booking_only / quote ;
- `price.amounts` : montant et devise tels que publiés, sans conversion ;
- `billing_subject` : animal / contenant / réservation / expédition / kilogramme ;
- `journey_basis` : segment / aller simple / trajet / aller-retour ;
- `applies_when` : portée exécutable sur origine, destination, zone, domestique/international, transporteur opérant, poids et fenêtre d'achat ;
- `source` : URL, citation contiguë, langue, locator, date de lecture et date de page si elle existe ;
- `conflict` : deux observations officielles complètes et effet `suppress_exact_fare`.

Une portée libre peut être rendue au visiteur, mais ne doit jamais décider du prix. Si le moteur ne possède pas le fait nécessaire, il rend la grille ou « tarif à confirmer », pas une valeur inventée.

## Ordre d'intégration recommandé

1. **Cabine et soute avec prix exacts ou grilles**, sur compagnies prioritaires et canaux déjà cités dans le Finder.
2. **Formules, calculateurs et prix dans la réservation**, sans inventer de résultat chiffré.
3. **Canaux avec ancien tarif mais politique encore non raccordée**, lorsque la même page officielle permet de prouver les deux.
4. **Fret seulement lorsqu'il est le seul canal, imposé par la route ou documenté par un tarif public** ; sinon « sur devis » suffit.

Les imports doivent se faire par lots de dix compagnies avec matrice avant/après. La preuve du service ne vaut pas preuve du prix : chaque montant garde sa citation tarifaire.

## Blocages à résoudre avant import automatique

Ces divergences sont conservées et ne doivent pas être tranchées par déduction :

1. **Finnair soute** : deux pages officielles vivantes publient 120/600 EUR et 140/650 EUR. Masquer le montant exact jusqu'à clarification.
2. **South African Airways soute** : conflit de locale officielle, 300 ZAR en anglais contre 250 ZAR en portugais.
3. **SunExpress soute, Ercan** : conflit de locale officielle, 25 EUR contre 15 EUR au paiement à l'aéroport.
4. **Aer Lingus soute** : distinguer l'emplacement physique en soute du produit commercial fret via agent/IAG Cargo.
5. **Qantas soute** : la source dit que certains aéroports peuvent accepter l'animal comme bagage enregistré ; ne pas généraliser au réseau.
6. **Saudia cabine/soute** : la branche utilise une URL UAT, exclue de cet audit comme preuve de production.
7. **China Eastern cabine** : la règle actuelle autorise une demande sur certains vols intérieurs ; un refus mondial serait faux.

Ces sept points n'empêchent pas l'import des autres lignes ; ils bloquent uniquement les portées concernées.

Deux désaccords initialement listés sont désormais clos après contre-lecture directe :

- **Air China cabine** : la branche de Claude est correcte. L'accord officiel établit le transport en cabine sur les vols opérés par Air China et publie **1 399 RMB par animal et par segment**. La consolidation a été corrigée.
- **Batik Air Indonesia** : la page d'aide officielle corrobore les refus cabine et soute accompagnée. Elle ne suffit pas à décider séparément le fret.

## Règles d'exploitation du TSV/JSON

- `fare_class = EXACT | RANGE | MATRIX | FORMULA | CALCULATOR | MINIMUM | BOOKING_ONLY` : candidat tarifaire, à mapper dans le contrat sans aplatir la portée.
- `fare_class = QUOTE` : publier « sur devis », avec la source.
- `fare_class = QUOTE_OR_NOT_FOUND` : ne publier « sur devis » que si la citation établit effectivement le contact/devis ; sinon tarif non trouvé.
- `fare_class = NOT_FOUND` : aucune valeur actuelle établie ; l'ancien tarif reste une piste, pas une preuve.
- `fare_class = NOT_APPLICABLE` : le canal ordinaire n'est pas proposé ; ne pas fabriquer de tarif.
- `fare_class = CONFLICT` : aucune valeur exacte tant que le conflit est ouvert.
- `scope_raw` et `billing_basis_raw` décrivent la lecture officielle ; Claude doit les convertir en prédicats canoniques, pas les analyser à l'exécution comme texte libre.
- `legacy_fee` et `legacy_farelist` ne servent qu'à la comparaison. Ils ne sont jamais importables sans la preuve officielle de la même ligne.
- `verified_date` est la date réelle de lecture. Une page sans date visible n'est pas déclarée ancienne : `page_date` reste vide ou non visible.
- `citation_check = PRICE_EXCERPT_PRESENT` : l'extrait consolidé porte lui-même une valeur tarifaire ; `MECHANISM_EXCERPT_PRESENT` : il prouve un devis, une formule, un calculateur ou un prix dans la réservation ; `LOCATOR_ONLY_REVIEW_BEFORE_IMPORT` : la valeur a été lue dans la table officielle, mais l'extrait court ne suffit pas encore à porter seul le prix et doit être renforcé avant import.

## Niveau de confiance et limite honnête

La collecte a été faite sur les domaines officiels des compagnies, avec URL, locator, extrait et date de lecture. Les pages dynamiques, tarifs visibles seulement à la réservation, pages sans date et informations non trouvées sont nommés comme tels.

Ce dossier évite à Claude de recommencer la recherche des 102 compagnies. Il ne l'autorise pas à importer mécaniquement une ligne ambiguë, un conflit ou une portée textuelle non modélisée. Son travail restant est un travail de **schéma, mapping et tests**, pas une nouvelle extrapolation métier.
