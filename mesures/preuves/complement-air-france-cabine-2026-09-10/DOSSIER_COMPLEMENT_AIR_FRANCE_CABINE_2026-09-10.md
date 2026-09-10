# Air France, cabine — complément de preuve importé (10/09/2026)

Date de lecture : **10 septembre 2026** (Codex, page officielle en français). Ce dossier accompagne
`PREUVES_POLITIQUES_COMPAGNIES_AIR_FRANCE_CABINE_2026-09-10.json` et conserve les deux fichiers
d'origine de Codex.

## Mesuré avant d'écrire

| | avant | après |
|---|---|---|
| politique cabine Air France | `offered`, plafond 8 kg hérité d'`objects.json`, page officielle **sans phrase** (`official_source_unquoted`) | `offered`, plafond **8 kg, sac compris, borne stricte**, phrase citée (fr), localisateur, lecture 2026-09-10, révision 2026-12-09 |
| chihuahua 3 kg, CDG → JFK | cabine « à confirmer » | cabine **sous conditions**, plafond 8 kg chien + sac, `lt` |
| 7,9 kg | « à confirmer » | sous conditions |
| 8,0 kg | « à confirmer » | **refusé** (« moins de 8 kg » exclut 8) |
| 9 kg | « à confirmer » + `rule_official_unquoted` (`rule_af_cabin_weight`) | refusé sur la politique citée, aucune cause de règle |
| Golden 32 kg | « à confirmer » | refusé |

## Ce que l'import a écrit, et rien d'autre

Bloc `policies.cabin` de `content/airlines/air_france.yml` : `max_weight_kg: 8`,
`weight_includes_carrier: true`, `weight_limit_bound: lt`, source citée. Importeur rejouable
(`--lot=af_cabine`), `SEUILS` et `SEUIL_BORNE_STRICTE` étendus d'une ligne chacun. Disponibilité
inchangée, aucun tarif (Codex : `fare_proven: false`), aucun `allowed`.

## Mouvements nommés (tous figés sur mesure)

- politiques citées 178 → **179** ; « page officielle non citée » 15 → **14** ; sous conditions
  143 → **144**, à confirmer 125 → **124** ; seuils qualifiés 37 → **38**, bornes strictes 1 → **2**
  (Air Austral, Air France) ; limites cabine citées du calculateur de caisses 30 → **31** ;
  témoin hérité `carries` 29 490 → **29 529** ; carlin CDG → ATH 45 → **44** confirmations
  (30 → 29 de provenance) ;
- baseline du Finder : paire figée `complement-air-france-cabine-{avant,apres}.json`, chaîne
  continue depuis la réconciliation — **72 cartes / 1 560**, Air France seule, 72 cabines
  « à confirmer » → **refusées** sur citation (les deux chiens des scénarios, Golden 32 kg et
  carlin 8,0 kg, sont à la borne ou au-dessus), aucun verdict déplacé, la ligne tarifaire de la
  cabine disparaît avec le refus ;
- trois témoins RE-FONDÉS, parce qu'Air France cabine était leur spécimen « non citée » :
  `test-ingest-check` (m) remplace la phrase citée au lieu d'insérer un second bloc `source:` ;
  `test-quatrieme-etat` §2 passe à Eurowings cabine (plafond dérivé de la fiche, non citée), et
  éprouve l'inverse sur Air France ; `test-preuves-v3` exige que le refus porte la source du
  10/09, pas le dossier V3 ; `test-inventaire-preuves` : témoin B → Air France **fret** (même page,
  sans phrase).

## Ce qui reste nommé, pas fermé

- `rule_af_cabin_weight` (règle héritée, `> 8 kg`, source non citée, confiance 3) n'est pas
  touchée : elle ne décide plus rien (le refus au-dessus du seuil vient de la politique citée) et
  ne se nomme plus (à 9 kg, aucune cause). Sa citation ou son retrait est une décision distincte.
- La page citée est en français ; la soute (import V3) cite la page anglaise. Deux URL, même hôte.
- Aucun tarif Air France n'est prouvé ; la grille `TARIFS_ANIMAUX_LOT_PRIORITAIRE_2026-09-10.*`
  de Codex n'est pas dans ce lot.
