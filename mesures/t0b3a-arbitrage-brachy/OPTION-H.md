# Option H — conception et simulation · v2

**Aucune ligne de moteur n'a été écrite.** Aucun fichier de `packages/` n'est modifié.

```
node --import tsx mesures/t0b3a-arbitrage-brachy/outils/simuler-h.mjs
```

## Les deux P0 de la v1, et ce qui les corrige

### P0-1 · La v1 effaçait les causes existantes

Elle remplaçait chaque décision `confirmation_required` par un objet neuf ne portant que
`breed_policy_unreviewed`. **452 causes supprimées** sur la seule grille publique des carlins :

| cause effacée | occurrences |
|---|---|
| `legacy_unreviewed` | 440 |
| `policy_unpublished` | 8 |
| `estimated_climate` | **4** |

Sa « garantie climatique » passait donc **pour une mauvaise raison** : les causes climatiques
disparaissaient avant que le contrôle puisse les voir. Un test qui supprime son propre objet ne
prouve rien.

**v2** : les causes sont **fusionnées**, dédupliquées par `causeKey` — la fonction du moteur, pas une
réimplémentation — et triées. L'inclusion est ensuite prouvée : **452 avant → 1392 après, 0 perdue**.

### P0-2 · La v1 laissait les auto-citations noter la compatibilité

Elle gardait les 41 règles en `warn` : invisibles comme sources, mais leur `confidence` alimentait
encore le score via `fired`. C'est exactement ce que T0-B3 a nommé — une auto-citation devenue preuve
invisible.

**v2** : les 42 sortent **du calcul**. L'état brachycéphale est porté par la **politique
compagnie/canal**. L'avertissement IATA est conservé **à part** :

| | |
|---|---|
| nature | avertissement de sécurité, jamais une interdiction ni une preuve de politique |
| URL | `https://www.iata.org/en/programs/cargo/live-animals/pets/` |
| citation | « Transport of snub nose dogs, such as boxers, pugs, bulldogs and Pekinese, in hot season is not recommended. » |
| ce qu'il ne fait pas | il ne prouve la politique d'aucune compagnie · il n'entre pas dans le calcul de confiance · il n'introduit ni période ni seuil |

**Conséquence sur le score annoncé** : il passe de `−1…0` (v1, faussé par les confiances
auto-citées) à **`0…+2`**. C'est ce dernier chiffre qui est validable.

## Portée

**H s'applique aux 102 compagnies**, pas aux 41 qui portaient une ancienne règle. Ces 41 n'étaient
qu'un sous-ensemble arbitraire de notre documentation ; l'incertitude sur la politique
brachycéphale est générale.

## La table de décision, pour un chien brachycéphale

| branche | situation | statut | exercée par les données réelles | fixture |
|---|---|---|---|---|
| **1** | canal structurellement fermé | `denied` | **1 420** | ✅ conforme |
| **2** | preuve auditée : `brachy_allowed = false` | `denied` | **0** | ✅ conforme |
| **3** | preuve auditée : `brachy_allowed = true` | inchangé | **0** | ✅ conforme |
| **4** | politique brachycéphale non revérifiée | `confirmation_required` + cause fusionnée | **2 110** | ✅ conforme |

Les branches 2 et 3 ne sont exercées par **aucune donnée réelle** — le référentiel ne contient ni
interdiction ni autorisation brachycéphale auditée. Les déclarer « vérifiées » sans fixtures aurait
été une illusion : quatre compagnies de test, une par branche, sont donc construites dans une base
**synthétique jamais écrite sur le disque**.

## Les garanties

| garantie | résultat |
|---|---|
| **1 · aucun chien non brachycéphale touché** | **0** compagnie, **0** placement, **0** scénario golden |
| **2 · aucun canal non proposé rouvert** | **0** violation |
| **3 · aucune confirmation devenue message climatique** | **0** violation, sur **56 causes climatiques réellement observées** |
| **4 · aucune auto-citation présentée comme preuve** | **0** violation (l'ancienne URL IATA en 404 est également surveillée) |
| **5 · causes préexistantes conservées** | **452 → 1392, 0 perdue** — inclusion stricte vérifiée |
| **6 · dominance respectée** | un refus dur éteint toutes les causes : **0** cas où des causes survivent à un refus |
| **7 · les 42 hors du calcul** | **0** occurrence dans `fired` |

La garantie 3 ne vaut que parce que les causes climatiques **survivent désormais**. Le compteur
« 56 causes climatiques observées » est publié à côté du « 0 violation » précisément pour qu'un zéro
obtenu sur zéro observation saute aux yeux.

### Coexistence des causes — les trois combinaisons observées

| combinaison | occurrences |
|---|---|
| `breed_policy_unreviewed` + `legacy_unreviewed` | 440 |
| `breed_policy_unreviewed` + `policy_unpublished` | 8 |
| `breed_policy_unreviewed` + **`estimated_climate`** | **4** |

Le climat et la politique brachycéphale cohabitent sur le même canal sans que l'un masque l'autre.

## Ce que H ne nettoie pas — et qu'il ne faut pas lire de travers

**224 occurrences, 12 règles auto-citées distinctes** continuent d'alimenter la confiance après H :
`rule_cathay_pacific_hold_weight`, `rule_korean_air_cabin_weight`, `rule_etihad_hold_deny`… Ce sont
les **autres** auto-citations mesurées en T0-B3 — poids de cabine, poids de soute, placement,
importation. H ne les traite pas, et leur résorption est le lot suivant.

Les compter à part évite de lire la garantie 7 comme une propreté générale qui n'est pas atteinte.

## Diff exhaustif contre le statu quo

### Grille publique — 72 scénarios

| | |
|---|---|
| scénarios dont le verdict change | **20** |
| cartes compagnie modifiées | 524 |
| placements modifiés | 940 |
| écart de score | **0 … +2** |
| scénarios **golden** affectés | **0** |
| échecs de production du rapport | 0 |

### Grille brachycéphale — 102 compagnies

| | |
|---|---|
| compagnies touchées | **81** |
| placements déplacés | **147** |
| **→ `allowed`** | **0** |
| **→ « à confirmer »** | **147** |
| → `denied` | 0 |

Aucun placement ne devient `allowed` — la différence de fond avec D (65 vers `allowed`) et G (26).

## Ce que H exigera avant d'être implémenté

`makePlacementDecision` avec `breed_policy_unreviewed` **échoue** : `ConfirmationCause` est une union
stricte. La simulation construit ses objets **littéralement** et contourne donc ce contrôle — sans
sonde dédiée, on aurait lu « 0 rapport refusé » comme « rien à faire au contrat ».

1. ajouter `breed_policy_unreviewed` à l'union stricte, `policy_ref` obligatoire ;
2. son libellé dans les **quatre langues**, distinct de `legacy_unreviewed` : celui-ci dit que notre
   donnée de **canal** n'est pas revérifiée, H dit que notre politique **brachycéphale** ne l'est
   pas ;
3. porter l'état brachycéphale dans `PlacementPolicy` — la simulation le **dérive** des mêmes
   données pour ne pas préjuger d'une écriture du référentiel ;
4. la classe de règle qui produit cette confirmation dans `evaluate` — aujourd'hui, seule l'action
   `deny` déplace un statut.

## Ce que cette simulation ne prouve pas

- rien sur le **contrat** : elle le contourne, et c'est la sonde dédiée qui établit le besoin ;
- rien sur la **véracité médicale** du risque brachycéphale ;
- elle n'introduit **aucun seuil de saison ni de température** : « hot season » n'en définit aucun.

## L'artefact

`option-h-simulee.json` — la table de décision, les branches exercées, les fixtures, les sept
garanties, la coexistence des causes, le diff exhaustif et la sonde de contrat.
