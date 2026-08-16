# T0-B3 — les 171 règles auto-sourcées, mesurées

**Ce lot ne corrige rien.** Aucune règle n'est retirée, aucune source remplacée, aucun fichier de
`packages/knowledge/raw/` modifié — l'empreinte SHA-256 des deux fichiers bruts est relue après
chaque simulation et comparée à celle du début. Tous les retraits sont **simulés en mémoire**.

## Reproduction — une seule commande

```
npm run mesure:t0b3
```

Elle vérifie que les fichiers bruts correspondent à la base de mesure figée, régénère les six
artefacts, vérifie `SHA256SUMS`, puis **exige un arbre Git propre** : régénérer ne doit rien
changer.

## ⚠ Dossier HISTORIQUE depuis le 17/08/2026 — le moteur a changé

Ces chiffres ont été mesurés sur le moteur d'alors. Le câblage de l'option H l'a modifié, et la
mesure ne se rejoue plus à l'identique : **le retrait des 42 règles brachycéphales ne rouvre plus
une soute en `allowed`, il la place à « à confirmer »**. C'est exactement l'effet voulu par
l'arbitrage T0-B3-a — mais cela veut dire que la ligne « `breed_ban` + `rule_global_brachy_hold` »
du tableau ci-dessous décrit un comportement que le moteur n'a plus.

`npm run mesure:t0b3` le détecte tout seul : il compare l'empreinte des sources du moteur à celle
de la base de mesure, **ne régénère plus** les artefacts, et vérifie seulement qu'ils sont intacts.
Recalculer aurait remplacé en silence une mesure validée par une autre, produite par un code
différent — le sceau ne portait que le référentiel, pas le code qui le lit ; c'est cette lacune que
l'incident a révélée.

Pour mesurer le moteur actuel : déclarer une **nouvelle base** et un **nouveau dossier**. Ce
dossier-ci reste ce qu'il est — la mesure sur laquelle l'arbitrage a été tranché.

**Base de mesure : `ca254bf973bbab89f06073bdc36716f0cdb58660`**, en dur dans `lib-regles.mjs`. Elle
n'est pas déduite de `HEAD` — la première version de ce dossier le faisait, et ses artefacts
devenaient irreproductibles dès leur propre commit : régénérés, ils restaient métier-identiques mais
leur `git_sha` passait de `ca254bf…` à `c85261f…` et `SHA256SUMS` échouait. Un sceau qui change
parce qu'on a commité le sceau ne scelle rien.

## Le périmètre, recompté

**449 règles au total, 171 auto-citées** — leur source pointe `mydogcanfly.com`, le site lui-même.

| catégorie | règles | portée |
|---|---|---|
| `import_rules` | 44 | 44 pays distincts |
| `breed_ban` | 41 | 41 compagnies |
| `cabin_weight` | 40 | compagnies |
| `hold_weight` | 34 | compagnies |
| `placement` | 12 | compagnies |

Le discriminant est l'**hôte de l'URL**, jamais le `source_type` déclaré : 184 règles portent
`source_type: "other"`, dont **13 citent un tiers réel** (pettravel.com, IATA, anivetvoyage). Se
fier au type aurait surcompté de 13. Ces 13 sont consignées, hors périmètre.

## Classification fermée — et ce qu'elle veut dire exactement

Ce dossier **n'ouvre aucune page web**. « Source officielle confirmante » ne peut donc pas signifier
« j'ai lu la page et elle confirme ». Cela signifie, et rien de plus :

> le référentiel contient, pour la même entité et sur le même fait, une politique dont la source
> passe `preuveAuditee` — non auto-citée, non dérivée de la fiche, non marquée « non revérifiée » —
> et cette politique dit la même chose.

| classe | règles |
|---|---|
| `officielle_indisponible` — l'entité n'a **aucune** preuve auditée, nulle part | **116** |
| `non_revue` — la politique couvrant le fait est `legacy_unreviewed` | 42 |
| `auto_citation_seule` — l'entité a une preuve auditée, mais aucune sur ce fait | 10 |
| `officielle_confirmante` | 3 |
| `officielle_contradictoire` | **0** |

**Le zéro contradiction est un artefact.** Sur 178 confrontations tentées, **164 étaient
impossibles** faute de preuve auditée en face, 11 muettes, **3 seulement ont abouti**. Le référentiel
ne se contredit pas ; il ne se confronte presque jamais. 12 compagnies sur 102 possèdent au moins
une preuve auditée ; **90 n'en ont aucune**.

## Simulation de retrait — quatre questions, quatre champs

Le déclenchement est **lu dans le moteur**, pas inféré : `evaluate().airlines[].fired[].rule_id` et
`countryRequirements[].rule_id`.

| champ | question |
|---|---|
| `fired` | la règle mord-elle sur son témoin ? |
| `status_changed_on_removal` | son retrait déplace-t-il le statut publié du canal ? |
| `score_changed_on_removal` | son retrait déplace-t-il le score de confiance ? |
| `dominant_for_status` | les deux premiers réunis : elle mord **et** elle décide seule |

| mesure | valeur |
|---|---|
| règles simulées | 171 |
| témoins construits | 140 |
| témoins non constructibles | 31 |
| **`fired` sur leur témoin** | **140 / 140** |
| `dominant_for_status` | 79 |
| se déclenchent sans effet marginal sur le statut | 61 |
| dont le retrait déplace le score | 84 |

**Volet public** : les 72 scénarios de la baseline T0-A. 7 règles seulement les affectent — non
parce que les 164 autres seraient inertes, mais parce que ces 9 itinéraires ne les rencontrent pas.

### Vocabulaire — ce que la mesure ne dit pas

« Sans effet marginal sur le statut » ne veut dire ni « redondante », ni « inerte », ni « superflue ».
La première version de ce dossier écrivait « lettre morte » à propos de onze règles `placement` :
elles se déclenchent **toutes**, elles sont seulement doublées par la politique canonique issue de
T0-B2, et l'une d'elles (`rule_air_tahiti_nui_hold_deny`) déplace tout de même le score, 65 → 63.
**L'absence d'effet marginal ne dit rien de la justesse d'une règle.**

De même, les 31 règles d'importation sans témoin sont **inatteignables dans le graphe Finder
actuel** — les pays visés n'ont aucun aéroport au référentiel. Elles ne sont pas définitivement
inertes : l'ajout d'un seul aéroport les remettrait en service sans que rien ne le signale.

## Retrait groupé — un sous-lot n'est pas une somme de retraits isolés

| famille retirée | règles | statuts changés | score seul | soutes brachy rouvertes |
|---|---|---|---|---|
| `breed_ban` | 41 | 0 | 12 | 0 |
| `cabin_weight` | 40 | 32 | 0 | 0 |
| `hold_weight` | 34 | 0 | 0 | 0 |
| `import_rules` | 44 | 0 | 0 | 0 |
| `placement` | 12 | 0 | 9 | 0 |
| **les 171** | 171 | 32 | 10 | 0 |
| `breed_ban` **+ `rule_global_brachy_hold`** | 42 | 36 | 0 | **41** |

Deux colonnes distinctes : un **statut** qui bouge, c'est un canal qui s'ouvre ou se ferme — un fait
publié ; un **score seul**, c'est la confiance qui bouge sans promesse nouvelle sur le transport.

La sonde brachycéphale ne compare **que la soute et le fret**. Comparer le triplet complet faisait
compter un changement de statut *cabine* comme « soute rouverte » — faux positif observé puis corrigé.

## P0 — l'ensemble brachycéphale : 41 + 1 = 42 règles

Ces 41 règles n'ont pas d'effet marginal **uniquement parce que `rule_global_brachy_hold` produit
déjà le même refus**. Or cette règle globale :

- refuse la soute **et** le fret à tout chien brachycéphale, **sans condition de saison ni de
  température** — un « déconseillé en période chaude » devenu interdiction permanente ;
- s'applique à toutes les compagnies, y compris celles n'ayant jamais publié une telle interdiction ;
- cite une page générique de l'IATA, et son propre `rationale` dit « la plupart des compagnies les
  refusent et les spécialistes le déconseillent » — un **défaut de sécurité assumé**, pas une
  interdiction documentée.

Demander qu'elle « reste en place » comme garde-fou reviendrait à garantir un ensemble par l'un de
ses membres contestés. **Les 41 et la globale forment un ensemble dépendant de 42 règles, à traiter
comme un P0 commun.** Aucune intervention partielle ne peut y être évaluée règle par règle : retirer
les 41 seules ne rouvre aucune soute, retirer les 42 en rouvre 41 sur 41.

## Candidate de backlog — non validée comme premier sous-lot

**47 règles, 47 entités** : les 34 seuils de soute (dominants 34 sur 34, aucun filet derrière) et les
13 règles d'importation atteignables dans le graphe actuel. Un seuil de soute faux refuse un chien
qui pouvait voler, ou en accepte un qui ne le pouvait pas ; une règle d'importation fausse envoie un
voyageur vers une frontière qui le refusera.

Son statut de **premier** sous-lot n'est pas acquis : l'arbitrage de la règle brachycéphale globale
passe devant et peut redistribuer les priorités.

Reste à traiter : `cabin_weight` (31 dominantes sur 40), `placement` (1 dominante sur 12), les 31
importations non atteignables aujourd'hui, et les 13 règles citant un tiers non officiel.

## Les artefacts

| fichier | ce qu'il établit |
|---|---|
| `inventaire-171.json` | les 171 identités : effet, conditions, source, entité, paramètres |
| `classification.json` | les cinq classes, disjointes, avec le détail de chaque confrontation |
| `impact-retrait.json` | `fired`, statut, score, dominance — par règle |
| `retrait-groupe.json` | le retrait par famille, et la contre-épreuve de la règle globale |
| `baseline-ca254bf.json` | les 72 scénarios publics figés à la base de mesure |
| `sous-lot-propose.json` | le P0 brachycéphale et la candidate de backlog |

## Ce que ce dossier NE fait pas

Il ne revérifie aucune source en ligne : il dit où la revérification manque et ce qu'elle engage. Il
ne traite pas les **102 sources racines de fiche**, lot distinct déjà cadré. Il ne juge pas les 13
règles citant un tiers non officiel — dont `rule_global_brachy_hold`, sur laquelle repose
aujourd'hui toute la protection brachycéphale, et qui entre au P0 pour cette raison.
