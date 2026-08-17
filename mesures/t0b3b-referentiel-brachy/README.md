# T0-B3-b — le retrait des 42 règles brachycéphales, mesuré pour de vrai

**Ce lot change ce que le site affirme.** C'est le premier du chantier T0-B3 à le faire : les trois
précédents mesuraient, contractualisaient et câblaient sans déplacer un seul statut publié.

```
npm run mesure:t0b3b
```

## Ce qui change dans le référentiel

| | avant | après |
|---|---|---|
| règles | 449 | **407** — 42 retirées, **0 ajoutée, 0 modifiée** |
| registre des faits de race | 0 entrée | **1** : `brest_iata_snub_nose_hot_season`, un **avis**, jamais un refus |
| fiches (`objects.json`) | — | **inchangées**, empreinte SHA-256 identique |

Les 42 sont celles que T0-B3-a a identifiées et que la contre-revue a validées : la règle globale
`rule_global_brachy_hold` et les 41 règles compagnie, toutes `breed_ban`, toutes
`deny hold + cargo`, toutes citant `mydogcanfly.com` — sauf la globale, qui citait une page IATA
aujourd'hui en 404.

## Ce qui NE change pas — et c'est le point le plus important

**Six interdictions brachycéphales restent en place**, parce qu'elles sont documentées chez la
compagnie elle-même :

| règle | compagnie | source |
|---|---|---|
| `rule_ac_brachy_hold` | Air Canada | `aircanada.com` |
| `rule_af_brachy_hold` | Air France | `airfrance.com` |
| `rule_ba_brachy_hold` | British Airways | `britishairways.com` |
| `rule_kl_brachy_hold` | KLM | `klm.com` |
| `rule_lh_brachy_hold` | Lufthansa | `lufthansa.com` |
| `rule_tk_brachy_hold` | Turkish Airlines | `turkishairlines.com` |

Ce lot ne « rouvre pas les brachycéphales ». Il retire les interdictions que **nous** affirmions
sans pouvoir les prouver, et laisse intactes celles que les compagnies publient.

## Le diff mesuré — pas simulé

Les deux états sont confrontés sur le **même moteur** : l'« avant » est lu par `git show` au commit
figé `dadecc29bd377fc6fa598ae234988cdb1ff0a8c1`, l'« après » est l'arbre de travail. C'est
l'inverse de T0-B3-a, qui simulait des options sur un référentiel intact.

| grille | mesure |
|---|---|
| **publique** (72 scénarios T0-A) | 20 verdicts · 524 cartes · **940 placements** · score **0 … +2** |
| bascules, toutes | **940 × `denied` → « à confirmer »**, et **0 vers `allowed`** |
| **brachycéphale** (102 compagnies) | **81 compagnies, 147 placements**, tous vers « à confirmer » |
| **témoin golden retriever** | **0 compagnie, 0 placement** |
| avis IATA | émis sur les **36** scénarios carlin de la grille publique |

Ces chiffres sont exactement ceux que la contre-revue a validés sur la simulation de l'option H —
recalculés ici sur le référentiel réel, jamais recopiés. Un écart aurait fait échouer la mesure.

**Aucun canal ne s'ouvre en `allowed`.** Le site cesse d'affirmer un refus qu'il ne peut pas
prouver ; il n'affirme pas pour autant une acceptation qu'il ne prouverait pas davantage.

## Une sentinelle posée le 13/08/2026 a joué — et sa prédiction était fausse

`test-tristate-climat.mjs` portait ce commentaire : « quand P0-B requalifiera ces règles, des
confirmations climatiques **apparaîtront** pour les brachycéphales — ce contrôle échouera alors, et
c'est voulu : il force le lot à re-mesurer l'interaction au lieu de l'hériter en silence ».

Elle a échoué. La re-mesure donne autre chose :

| CDG→IST, carlin, juillet | avant | après |
|---|---|---|
| canaux à confirmer | 0 / 60 | **24 / 60** |
| dont de cause **climatique** | 0 | **0** |
| dont de cause **race** | 0 | **24** |

Aucune confirmation climatique n'apparaît. Le drapeau chaleur dérive d'une **cause climatique
active**, pas d'un statut : une confirmation de race ne l'allume pas — l'invariant de T0-A tient
sous des données qu'il n'avait jamais vues. Et sur cette route, la chaleur ne se déclenche pas du
tout : le modèle région donne 28 °C, sous le seuil.

La sentinelle comptait **toutes** les confirmations sous l'étiquette « climatique ». Tant que la
réponse était zéro, la confusion ne se voyait pas. Elle compte désormais ce qu'elle annonce.

## Les baselines figées

`test-baselines/t0b3b-finder-baseline-{avant,apres}.json` scellent les 72 scénarios de part et
d'autre. Une preuve **permanente** de `test-t0a-baseline.mjs` les compare : exactement 36 scénarios
bougent, ce sont exactement les 36 carlins, aucun golden ne bouge d'un octet, et les 940 bascules
vont toutes de `denied` vers « à confirmer ». Aucun lot futur ne pourra élargir ce retrait à
d'autres races sans que cette preuve ne rougisse.

## Ce que ce dossier NE fait pas

- il ne déploie rien, et n'ouvre aucune preview ;
- il ne touche pas aux **130 autres règles auto-citées** (`cabin_weight`, `hold_weight`,
  `placement`, `import_rules`) : lot distinct, déjà cadré par T0-B3 ;
- il ne rouvre pas les **six** interdictions sourcées chez la compagnie — elles n'ont jamais été
  en cause ;
- il n'invente ni seuil ni saison : l'avis IATA dit « not recommended … in hot season », et c'est
  exactement ce qui est publié, avec sa citation.
