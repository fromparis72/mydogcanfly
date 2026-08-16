# T0-B3 — les 171 règles auto-sourcées, mesurées

**Ce lot ne corrige rien.** Aucune règle n'est retirée, aucune source n'est remplacée, aucun fichier
de `packages/knowledge/raw/` n'est modifié — l'empreinte SHA-256 des deux fichiers bruts est relue
après chaque simulation et comparée à celle du début. Tous les retraits sont **simulés en mémoire**.

Référentiel scellé au SHA `ca254bf973bbab89f06073bdc36716f0cdb58660` (`main`, CI complète verte,
run 34). Les quatre artefacts portent ce sceau et les deux empreintes.

## Le périmètre, recompté

**449 règles au total, 171 auto-citées** — leur source pointe `mydogcanfly.com`, c'est-à-dire le
site lui-même.

| catégorie | règles | portée |
|---|---|---|
| `import_rules` | 44 | 44 pays distincts |
| `breed_ban` | 41 | 41 compagnies |
| `cabin_weight` | 40 | compagnies |
| `hold_weight` | 34 | compagnies |
| `placement` | 12 | compagnies |

Le discriminant est l'**hôte de l'URL**, jamais le `source_type` déclaré : 184 règles portent
`source_type: "other"`, dont **13 citent un tiers réel** (pettravel.com, IATA, anivetvoyage). Se
fier au type aurait surcompté de 13. Ces 13 sont consignées dans l'inventaire, hors périmètre.

## Classification fermée — et ce qu'elle veut dire exactement

Ce dossier **n'ouvre aucune page web**. « Source officielle confirmante » ne peut donc pas signifier
« j'ai lu la page et elle confirme ». Cela signifie, et rien de plus :

> le référentiel contient, pour la même entité et sur le même fait, une politique dont la source
> passe `preuveAuditee` — non auto-citée, non dérivée de la fiche, non marquée « non revérifiée » —
> et cette politique dit la même chose.

C'est une **confrontation interne**. Elle ne remplace pas la revérification en ligne ; elle dit où
celle-ci manque.

| classe | règles |
|---|---|
| `officielle_indisponible` — l'entité n'a **aucune** preuve auditée, nulle part | **116** |
| `non_revue` — la politique qui couvre le fait est explicitement `legacy_unreviewed` | 42 |
| `auto_citation_seule` — l'entité a une preuve auditée, mais aucune sur ce fait | 10 |
| `officielle_confirmante` | 3 |
| `officielle_contradictoire` | **0** |

**Le zéro contradiction est un artefact, et il faut le lire comme tel.** Sur 178 confrontations
tentées, **164 étaient impossibles** faute de la moindre preuve auditée en face, 11 muettes, et
**3 seulement ont abouti** — toutes confirmantes (`rule_american_no_hold`, `rule_delta_no_hold`,
`rule_united_no_hold`). Le référentiel ne se contredit pas ; il ne se confronte presque jamais.
12 compagnies sur 102 possèdent au moins une preuve auditée ; **90 n'en ont aucune**.

## Simulation de retrait — deux volets, parce qu'un seul mentirait

**Volet public** : les 72 scénarios de la baseline T0-A (9 routes × 2 chiens × 2 saisons ×
2 placements). **Volet témoin** : un scénario construit à partir des conditions de la règle
elle-même, sur une route réellement desservie par son entité.

Le volet public seul serait trompeur — 164 des 171 règles n'affectent aucun de ses 9 itinéraires,
non parce qu'elles sont inertes mais parce que ces routes ne les rencontrent pas.

| mesure | valeur |
|---|---|
| règles simulées | 171 |
| témoins construits | 140 |
| témoins impossibles | **31** — pays sans **aucun** aéroport au référentiel |
| la règle se déclenche sur son témoin | 129 |
| **dominantes** — le retrait change l'état de l'entité | **79** |
| **redondantes** — elle mord, mais une autre dit déjà la même chose | 61 |
| affectant les 72 scénarios publics | 7 |

Le déclenchement n'est pas déduit de mon solveur de conditions : il est tranché par le moteur, en
comparant une base réduite à cette seule règle à une base sans aucune règle. `evalPredicate` n'étant
pas exporté, c'était la seule mesure possible sans réimplémenter la grammaire — donc sans créer une
deuxième vérité à côté du moteur.

### Trois résultats qui déplacent le sujet

**Les 41 règles de race sont toutes redondantes.** Retirer `rule_aegean_brachy_hold` seule : rien ne
change. Retirer `rule_global_brachy_hold` seule : rien ne change. Retirer **les deux** : la soute
passe `denied → allowed` et le fret `denied → confirmation_required`. Ce sont les seules règles
classées `critical`, et ce sont celles dont la correction change le moins — la protection tient
grâce à une règle globale sourcée sur une page générique de l'IATA.

**Onze des douze règles `placement` sont lettre morte.** Sans aucune règle chargée, la soute est déjà
refusée : c'est la **politique canonique** issue de T0-B2 qui décide, pas elles.

**Trente et une des quarante-quatre règles d'importation sont inatteignables.** Les pays visés
(`country_am`, `country_ao`, `country_bf`…) n'ont aucun aéroport au référentiel : aucun visiteur ne
peut les rencontrer. Vérifié — zéro faux négatif, aucun de ces pays n'est atteignable autrement.

## Retrait groupé — parce qu'un sous-lot n'est pas une somme de retraits isolés

| famille retirée | règles | statuts changés | score seul | soutes brachy rouvertes |
|---|---|---|---|---|
| `breed_ban` | 41 | 0 | 12 | 0 |
| `cabin_weight` | 40 | 32 | 0 | 0 |
| `hold_weight` | 34 | 0 | 0 | 0 |
| `import_rules` | 44 | 0 | 0 | 0 |
| `placement` | 12 | 0 | 9 | 0 |
| **les 171** | 171 | 32 | 10 | 0 |
| `breed_ban` **+ `rule_global_brachy_hold`** | 42 | 36 | 0 | **41** |

Deux colonnes distinctes, parce que les deux natures n'ont pas la même gravité : un **statut** qui
bouge, c'est un canal qui s'ouvre ou se ferme — un fait publié ; un **score seul**, c'est la
confiance qui remonte parce qu'une source faible a quitté le calcul, sans promesse nouvelle sur le
transport. Les 12 scénarios de la famille `breed_ban` sont de la seconde nature : score 55 → 56,
aucun statut modifié, aucune compagnie ajoutée ni retirée.

La sonde brachycéphale ne compare **que la soute et le fret**. Comparer le triplet complet faisait
compter un changement de statut *cabine* comme « soute rouverte » — faux positif observé puis
corrigé le 16/08/2026 sur la famille `cabin_weight`.

## Proposition — sous-lot T0-B3-a

**47 règles, 47 entités** : les 34 seuils de soute et les 13 règles d'importation atteignables.

Ce sont les dominantes au poids décisionnel le plus lourd. Les seuils de soute sont dominants à
**34 sur 34** — aucun filet derrière eux : un seuil faux refuse un chien qui pouvait voler, ou en
accepte un qui ne le pouvait pas. Une règle d'importation fausse envoie un voyageur vers une
frontière qui le refusera.

**Écart assumé avec l'ordre proposé en contre-revue** (« interdictions globales, importation, race,
placement ») : la mesure corrige un point, la place de la **race**. Ses 41 règles sont redondantes,
isolément comme en groupe ; les traiter en premier occuperait le sous-lot le plus visible avec les
règles dont la correction change le moins. Elles restent à revérifier — après.

Ordre proposé pour la suite : `cabin_weight` (31 dominantes sur 40, mais un refus de cabine se
rattrape en soute), `placement` (1 dominante sur 12), `breed_ban` (pour la confiance, sans urgence
décisionnelle), et les 31 règles d'importation inatteignables le jour où ces pays reçoivent un
aéroport.

**Garde-fou, à porter dans tout sous-lot touchant la famille brachycéphale** : vérifier que
`rule_global_brachy_hold` reste en place. Sans elle, 41 soutes se rouvrent pour un chien au museau
écrasé.

## Les artefacts

| fichier | ce qu'il établit |
|---|---|
| `inventaire-171.json` | les 171 identités : effet, conditions, source, entité, paramètres |
| `classification.json` | les cinq classes, disjointes, avec le détail de chaque confrontation |
| `impact-retrait.json` | la simulation isolée : déclenchement, dominance, scénarios publics |
| `retrait-groupe.json` | le retrait par famille, et la contre-épreuve de la règle globale |
| `baseline-ca254bf.json` | les 72 scénarios publics figés au SHA scellé |
| `sous-lot-propose.json` | les 47 règles du sous-lot, triées, avec le témoin de chacune |

Reproduction, dans cet ordre :

```
npx tsx mesures/t0b3-regles-autosourcees/outils/inventaire.mjs
npx tsx mesures/t0b3-regles-autosourcees/outils/classer.mjs
npx tsx mesures/t0b3-regles-autosourcees/outils/simuler-retrait.mjs --ecrire-baseline
npx tsx mesures/t0b3-regles-autosourcees/outils/retrait-groupe.mjs
npx tsx mesures/t0b3-regles-autosourcees/outils/sous-lot.mjs
```

## Ce que ce dossier NE fait pas

Il ne revérifie aucune source en ligne : il dit où la revérification manque et ce qu'elle engage.
Il ne traite pas les **102 sources racines de fiche**, lot distinct déjà cadré. Il ne juge pas les
13 règles citant un tiers non officiel, consignées mais hors périmètre — dont
`rule_global_brachy_hold`, sur laquelle repose aujourd'hui toute la protection brachycéphale.
