# Option H — conception et simulation

**Aucune ligne de moteur n'a été écrite.** Aucun fichier de `packages/` n'est modifié. Cette
simulation mesure H avant sa conception détaillée, comme demandé.

```
node --import tsx mesures/t0b3a-arbitrage-brachy/outils/simuler-h.mjs
```

## H, tel que l'arbitrage le définit

- le `deny` global IATA est retiré ; l'information IATA reste un **avertissement de sécurité** ;
- une confirmation **propre à la race** apparaît, avec une cause structurée `breed_policy_unreviewed` ;
- un chien **non brachycéphale** n'est touché en rien ;
- les 41 règles compagnie passent de refus à confirmation, à résorber une par une par audit officiel.

### La table de décision, pour un chien brachycéphale

| situation | statut | pourquoi |
|---|---|---|
| canal structurellement fermé | `denied` | H n'ouvre rien : une compagnie qui ne propose pas de soute n'a pas une soute « à confirmer », elle n'en a pas |
| preuve auditée disant `brachy_allowed = false` | `denied` | interdiction prouvée : elle subsiste |
| preuve auditée disant `brachy_allowed = true` | inchangé | on n'ajoute pas de doute là où une source auditée tranche |
| tout le reste | **`confirmation_required`** | notre politique brachycéphale n'est pas auditée. L'incertitude est **la nôtre** — elle se dit « à confirmer », jamais « interdit » |

## Comment H a été mesuré sans être implémenté

Le pipeline est `explain(evaluate(kb, req))`. H ne change que la couche **décision**. La simulation :

1. appelle `evaluate` sur une base où les 42 règles ne refusent plus mais **restent chargées** —
   leur confiance continue d'alimenter le score, exactement comme H le prévoit pour l'avertissement
   IATA ;
2. applique la table de décision ci-dessus aux placements, **et seulement pour un chien
   brachycéphale** ;
3. passe la décision au **vrai `explain`**.

Verdict, score, cartes et libellés sont donc calculés par le moteur d'explication réel. Ce qui est
modélisé à la main, c'est précisément ce que H changerait dans `evaluate` — ni plus, ni moins.

## Les cinq garanties exigées

| garantie | résultat |
|---|---|
| **1 · aucun chien non brachycéphale touché** | **0** compagnie, **0** placement, **0** scénario golden |
| **2 · aucun canal non proposé rouvert** | **0** violation |
| **3 · aucune confirmation transformée en message climatique** | **0** violation |
| **4 · aucune auto-citation présentée comme preuve** | **0** violation |
| **5 · toute confirmation de race porte la cause dédiée** | **147** conformes, **0** violation |

La garantie 3 est en outre **structurelle** : `heat_confirmation_required` dérive de
`hasActiveClimateCause`, jamais du statut — une confirmation de race ne peut pas allumer le message
climatique. La mesure le confirme au lieu de s'y fier.

## Diff exhaustif contre le statu quo

### Grille publique — 72 scénarios

| | |
|---|---|
| scénarios dont le verdict change | **20** |
| cartes compagnie modifiées | 524 |
| placements modifiés | 940 |
| écart de score | **−1 … 0** |
| scénarios **golden** affectés | **0** |
| échecs de production du rapport | 0 |

L'écart de score est le fait marquant : **−1 à 0**, là où retirer les 42 (option D) montait
jusqu'à **+57**. H n'accepte rien de nouveau — il transforme un refus non sourcé en question
ouverte. Le score ne récompense donc pas la levée d'une interdiction.

### Grille brachycéphale — 102 compagnies

| | |
|---|---|
| compagnies touchées | **81** |
| placements déplacés | **147** |
| **→ `allowed`** | **0** |
| **→ « à confirmer »** | **147** |
| → `denied` | 0 |

**Aucun placement ne devient `allowed`.** C'est la différence de fond avec toutes les options
mesurées jusqu'ici : D en envoyait 65 vers `allowed`, G en laissait encore 26. H n'en laisse aucun.

## Ce que H exige avant d'être implémenté

**La cause `breed_policy_unreviewed` n'existe pas dans le contrat.** Vérifié par une sonde dédiée :
`makePlacementDecision("hold", "confirmation_required", [{ code: "breed_policy_unreviewed", … }])`
**échoue** — `ConfirmationCause` est une union stricte.

Cette sonde était nécessaire. La simulation construit ses objets de décision **littéralement**, donc
elle contourne le point de contrôle : sans poser la question directement, on aurait lu « 0 rapport
refusé » comme « rien à faire au contrat ». De même, la sonde de dégradation — un chien à la fois
brachycéphale et de type réglementé, le dogue canarien vers l'Australie, seul couple du référentiel —
montre que le rapport passe, mais **pas** parce que la cause serait valide : `explain` éteint les
causes quand il dégrade une confirmation en refus, si bien que la validation ne la voit jamais.

Le travail de contrat, donc, et rien de moins :

1. ajouter `breed_policy_unreviewed` à l'union stricte `ConfirmationCause`, avec `policy_ref`
   obligatoire — une incertitude sans le couple (compagnie, canal) serait inauditables ;
2. son libellé dans les **quatre langues**, distinct de `legacy_unreviewed` : celui-ci dit que
   **notre donnée de canal** n'a pas été revérifiée, H dit que **notre politique brachycéphale** ne
   l'a pas été. Les confondre reproduirait la perte d'interprétation que T0-B a réparée ;
3. la classe de règle qui produit cette confirmation dans `evaluate` — aujourd'hui, seule l'action
   `deny` déplace un statut.

## Ce que cette simulation ne prouve pas

- elle ne prouve rien sur le **contrat** : elle le contourne, et c'est la sonde dédiée qui établit le
  besoin ;
- elle ne dit rien de la **véracité médicale** du risque brachycéphale — elle mesure ce que le site
  affirmerait, et avec quelle preuve ;
- elle n'introduit **aucun seuil de saison ni de température**, conformément au principe directeur :
  « hot season » ne définit ni mois ni degré.

## L'artefact

`option-h-simulee.json` — la table de décision, les cinq garanties, le diff exhaustif, la sonde de
contrat et la sonde de dégradation.
