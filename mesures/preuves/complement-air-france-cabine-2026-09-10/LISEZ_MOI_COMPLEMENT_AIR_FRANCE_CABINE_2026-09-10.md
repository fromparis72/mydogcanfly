# Complément Air France cabine — 10/09/2026

Un seul fait, lu par Codex sur la page officielle Air France (français) le 10/09/2026, relayé par
Philippe avec ses deux fichiers d'origine (`COMPLEMENT_POLITIQUE_AIR_FRANCE_CABINE_2026-09-10.md`
et `.json`, conservés ici tels quels).

Fichiers inséparables :

- `COMPLEMENT_POLITIQUE_AIR_FRANCE_CABINE_2026-09-10.json` — l'original de Codex ;
- `PREUVES_POLITIQUES_COMPAGNIES_AIR_FRANCE_CABINE_2026-09-10.json` — le même fait au format des
  lots stricts, pour `importer-preuves-v3.mjs --lot=af_cabine` (aucun champ ajouté).

## Ce que l'import écrit, et rien d'autre

Dans `content/airlines/air_france.yml`, bloc `policies.cabin` :
`max_weight_kg: 8`, `weight_includes_carrier: true`, `weight_limit_bound: lt` (la phrase dit
« moins de 8 kg » : 8,0 kg exactement est HORS de la phrase, donc refusé — jamais converti en
« ≤ 8 kg »), et la source citée (URL, citation verbatim, `fr`, localisateur, date de lecture
2026-09-10, `review_due` calculé par `reviewDueFrom` = 2026-12-09, confiance 4, relecteur).

## Ce que l'import ne fait pas

- il ne change pas la disponibilité (`offered`, déjà dans la fiche) ;
- il ne prouve aucun tarif (`fare_proven: false` chez Codex) ;
- il ne touche ni la règle héritée `rule_af_cabin_weight` (non citée, `> 8 kg`), ni les blocs
  éditoriaux `channels:` — voir l'annexe pour ce qui reste nommé.

## Contrôles minimaux

1. Le fait est dans la donnée à l'octet près (citation, URL, localisateur, langue, date).
2. `review_due` est calculé, jamais recopié (2026-12-09).
3. Chihuahua 3 kg, CDG → JFK : cabine `accepted_with_conditions`, plafond 8 kg chien + sac, borne
   stricte ; 7,9 kg : idem ; 8 kg : `denied` ; 9 kg : `denied`.
4. Aucun `allowed` n'est créé.
