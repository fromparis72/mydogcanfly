# Notice d’import strict — preuves politiques compagnies

Ce paquet est un **dossier de recherche sourcé**, pas une migration automatique de politiques. Il couvre les cohortes A à K : **90 faits**, **41 compagnies**, lus le **8 septembre 2026**.

## Fichiers à utiliser

1. `DOSSIER_PREUVES_POLITIQUES_COMPAGNIES_2026-09-08.md` — lecture humaine, contexte et liens.
2. `PREUVES_POLITIQUES_COMPAGNIES_COHORTES_A_K_2026-09-08.zip` — les onze JSON machine A…K, transmis ensemble pour éviter toute pièce jointe manquante.

## Règles d’intégration

1. Importer une compagnie à la fois et conserver, dans `SourcedQuote` / `T0bAuditSource`, **l’URL officielle, la citation verbatim, sa langue, le locator et `verified_date: 2026-09-08`**.
2. Ne jamais convertir `offered_with_conditions` en `allowed` absolu : cela établit l’existence d’un parcours sous conditions, pas la disponibilité d’une place ni l’acceptation finale du chien, de la caisse, de la route ou de la saison.
3. Les seuils « animal + contenant » autorisent seulement une déduction négative sûre : un chien dont le poids seul dépasse le seuil ne peut pas être admis dans ce canal. En dessous, garder la condition du contenant.
4. Préserver chaque portée : `international-only`, UK, domestique, brachycéphale, appareil, transit ou seuil de caisse ne doit pas être aplati en règle globale.
5. `intentionally_unset` signifie réellement **aucune décision à importer**. Ne pas le transformer en refus ni en acceptation supposée.
6. Le fait Wizz Air porte `confidence: 3` et une révision au `2026-10-08` : respecter cette cadence courte et le seuil de confiance du moteur avant un affichage catégorique.
7. Le fait Wizz `placement: "all"` doit être mappé explicitement aux trois canaux (cabine, soute, fret) ou à une règle globale d’animal de compagnie. Il ne doit jamais être ignoré silencieusement.

## Vérification obligatoire par compagnie importée

Pour chaque import, ajouter une contre-épreuve qui traverse les trois étages :

`donnée sourcée → premium.policy / décision moteur → texte et source rendus dans le DOM`.

Tester au minimum :

- un grand chien dépassant seul un plafond combiné ;
- un petit chien qui reste conditionnel car le poids du contenant manque ;
- toute restriction de race ou d’itinéraire citée ;
- la langue de la citation et son lien public.

Ne modifier ni tarifs historiques, ni listes de races, ni règles sanitaires ou météo dans ce lot de provenance compagnie.
