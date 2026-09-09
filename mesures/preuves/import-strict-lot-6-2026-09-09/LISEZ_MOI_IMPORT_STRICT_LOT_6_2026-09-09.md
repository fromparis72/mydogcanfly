# Import strict — lot 6

Ce lot est un **candidat d’import**. Il ne permet pas de compléter ou modifier
manuellement les politiques des compagnies.

Fichiers à garder ensemble :

- `PREUVES_POLITIQUES_COMPAGNIES_LOT_6_STRICT_2026-09-09.json`
- `DOSSIER_PREUVES_POLITIQUES_COMPAGNIES_LOT_6_STRICT_2026-09-09.md`

## Résultat attendu

L’ingestion stricte crée 22 preuves datées et traçables. Les 8 canaux
explicitement non décidés restent à confirmer. Les six refus cabine/soute ne
s’appliquent qu’aux chiens de compagnie ordinaires, pas aux chiens d’assistance.

## Ce qu’il ne faut pas faire

- Ne pas convertir « cargo hold » en fret expédié.
- Ne pas appliquer les seuils combinés chien + contenant au seul chien.
- Ne pas transformer LATAM, Royal Jordanian ou Saudia en réponses valables sur
  toutes les routes.
- Ne pas déduire la soute ou le fret United à partir de son seul fait cabine.
- Ne pas complèter les données Kenya ou Gulf Air avec des exceptions de service.
- Ne pas remplacer une citation par un résumé éditorial.

## Contrôles minimaux

1. Le chargeur rejette tout identifiant, statut ou champ de provenance inconnu.
2. L’inventaire est bijectif et daté ; l’échéance vient de la cadence du dépôt.
3. Les huit canaux non décidés restent prudents dans le Finder.
4. Tester au moins : Kenya et Gulf Air sans cabine/soute ; Saudia sans cabine
   pour un chien ; LATAM conditionnelle sur route exploitée par LATAM ; et une
   réponse cabine United qui ne fait pas apparaître soute ou fret.

L’artefact a été établi le 09/09/2026 par lecture de pages officielles. Il doit
être revu selon l’échéance calculée par le dépôt avant toute réaffirmation.
