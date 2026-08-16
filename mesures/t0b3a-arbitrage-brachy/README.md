# T0-B3-a — arbitrage de l'ensemble brachycéphale (42 règles) · v3

**Ce dossier ne corrige rien et ne tranche rien.** Il mesure ce que chaque option déplacerait —
verdicts, cartes, placements, scores — avant toute modification. Aucun fichier de `packages/` n'est
écrit ; l'empreinte SHA-256 des deux fichiers bruts est relue à la fin et comparée à celle du début.

## ⚠ Ces chiffres décrivent le moteur d'avant l'option H — et se rejouent sur lui

Le moteur applique désormais l'option H : dès que les 42 règles sont retirées, il place le canal à
« à confirmer » avec une cause de race, au lieu de reprendre la politique générale. **Les options
A à G de la table ci-dessous ne sont donc plus mesurables** — elles se confondraient toutes avec H.
Vérifié : régénérer sur le moteur actuel donnait « D : 147 placements, tous vers *à confirmer* » au
lieu de « 65 vers `allowed`, 82 vers *à confirmer* », et un écart de score de `0…+57` ramené à
`0…+2`. Ce ne serait pas une mesure, ce serait une tautologie : chaque option contiendrait H.

**`npm run mesure:t0b3a` reste une reproduction.** Lorsque l'empreinte des sources du moteur diffère
de celle de la mesure, les outils — et les **six contre-épreuves** — sont rejoués dans un worktree
Git détaché au commit qui a produit ces artefacts (`a9a6556…`), puis les artefacts sont comparés
**octet à octet** à ceux archivés ici. Ce qui n'est plus fait : recalculer sur le moteur actuel, ce
qui remplacerait en silence les chiffres d'un arbitrage tranché par une tautologie.

Ce qui n'a **pas** bougé, et ce qui compte : les chiffres de l'option H elle-même. Rejouée sur le
moteur actuel, la simulation redonne exactement les mêmes — 147 placements brachycéphales tous vers
« à confirmer », aucun golden retriever touché, score `0…+2` — alors qu'elle s'applique désormais
par-dessus un moteur qui fait déjà H. Un seul compteur de diagnostic diffère (`dominance_jouee`,
1 → 2), pour cette raison précise. Il n'est **pas** publié ici : `option-h-simulee.json` garde sa
valeur historique, celle du moteur qui l'a produite.

Base de mesure figée : **`e2cf302ccf045c539ca450f23964bb7bf20af84c`** — SHA complet, jamais abrégé :
un préfixe court est ambigu par construction.

```
npm run mesure:t0b3a
```

## Ce qui a changé depuis la v2

| correction | v2 | v3 |
|---|---|---|
| **destination des placements** | « D les rouvre vers `allowed` » | **faux** : sur 147 placements, 65 vont vers `allowed` et **82 vers « à confirmer »**. Nouvelle colonne `placements_par_statut_cible` |
| **« G, seul chemin vers à confirmer »** | affirmé | **faux** : D en produit déjà 82. G en produit davantage (122) et laisse **26 placements brachycéphales en `allowed`** |
| **`limite_du_moteur`** | disait encore « identique à un retrait pur » | corrigé : **statuts identiques, scores différents sur 28 scénarios** |
| **source IATA** | paraphrase française appelée « citation », non vérifiée | **citations exactes en anglais**, vérifiées indépendamment par la contre-revue le 16/08/2026 |

## Ce qui avait changé depuis la v1

| correction | v1 | v2 |
|---|---|---|
| **compagnie ≠ placement** | « D rouvre 81 canaux » — c'était 81 **compagnies** | les deux grandeurs publiées côte à côte : **81 compagnies, 147 placements** |
| **« statuts publics »** | comptait des scénarios, pas des statuts | remplacé par trois colonnes explicites + le grain carte et placement |
| **option F** | « identique à un retrait » — affirmé, non mesuré | **mesurée** : 28 scénarios sur 72 au score différent de D. `require` mesuré séparément |
| **source IATA** | non documentée | section dédiée : ancienne URL, état rapporté, nouvelle URL, citation, et **la provenance du relevé** |
| **famille 3** | « 0 officiellement confirmée » | « **0 interdiction représentée comme auditée dans le référentiel** » — un état de notre documentation, pas un fait sur le monde |

## Le résultat central, formulé correctement

**Le moteur ne sait pas produire une confirmation DONT LA CAUSE EST LA RACE.**

Ce n'est pas « le moteur ne sait pas dire à confirmer » — il le dit très bien. Après retrait des
règles, il reprend la **politique générale du canal**, qui est tantôt `allowed`, tantôt
`confirmation_required`. Ce qu'il ne sait pas faire, c'est attacher la confirmation au chien qui la
motive.

| geste | observé |
|---|---|
| passer les 42 de `deny` à `warn` ou `require` | **aucun statut ne bouge** — `evaluate()` ne retient que `action === "deny"`. Mais **ce n'est pas un retrait** : les règles restent dans `fired`, leur confiance pèse encore, et 28 scénarios sur 72 affichent un score différent de D |
| retirer les 42 (option D) | 147 placements déplacés : **65 vers `allowed`**, **82 vers « à confirmer »** — le repli sur la politique existante, pas une réouverture uniforme |
| basculer la politique du canal sur « non documentée » (option G) | 122 vers « à confirmer », mais **26 restent en `allowed`**, et la politique n'ayant **aucune dimension race**, 40 placements de **golden retriever** basculent aussi |

Y parvenir demanderait une **évolution du moteur** : une classe de règle produisant
`confirmation_required` sur le chien qu'elle vise. C'est un lot de code, à contre-revoir et mesurer
à part.

**Mais F n'est pas D pour autant.** Les règles en `warn`/`require` restent chargées, restent dans
`fired`, et leur confiance continue d'alimenter le score :

| comparaison | scénarios au score différent | verdicts | statuts | écart de score |
|---|---|---|---|---|
| **F-warn** vs D | **28** / 72 | 0 | 0 | −2 … 0 |
| **F-require** vs D | **28** / 72 | 0 | 0 | −2 … 0 |

Le score n'est pas cosmétique : c'est ce que le visiteur lit. La v1 écrivait « identique à un
retrait pur » sans l'avoir mesuré scénario par scénario.

## La source IATA — vérifiée indépendamment

| | |
|---|---|
| URL enregistrée dans la règle | `https://www.iata.org/en/youandiata/travelers/pets/` |
| état de cette URL | **404 — page disparue** |
| page officielle vivante | `https://www.iata.org/en/programs/cargo/live-animals/pets/` |

Citations **exactes**, en anglais, non paraphrasées :

> « **Transport of snub nose dogs, such as boxers, pugs, bulldogs and Pekinese, in hot season is not
> recommended.** »
>
> « **Snub-nosed breeds require 10% larger container.** » — prescription **distincte**, portant sur la
> taille de la caisse et non sur l'acceptation

La première est citée en entier : le sujet de la recommandation doit être dans la citation, pas dans
une glose autour d'elle.

**Vérification** : effectuée par la contre-revue le 16/08/2026 — 404 de l'ancienne URL,
accessibilité de la page actuelle, et les deux formulations ci-dessus. **Pas par moi** : l'accès
réseau à `iata.org` est bloqué par le proxy d'egress de cet environnement, en `curl` comme en
`WebFetch` — essayé, pas supposé. La v2 présentait ici une reformulation française sous l'étiquette
« citation » ; c'est exactement le glissement que ce chantier corrige.

**L'écart est de nature, pas de degré** : l'IATA écrit « not recommended » et le conditionne à la
saison chaude ; notre règle produit un `deny` en toute saison, sans aucune condition. Une
recommandation conditionnelle est devenue une interdiction universelle et permanente.

**Ce que cela n'autorise pas** : inventer une période ou un seuil. « Hot season » ne définit ni mois
ni degré ; en déduire « avril à octobre » ou « au-dessus de 27 °C » remplacerait une affirmation non
sourcée par une autre. Et la caisse « 10 % plus grande » est une exigence de **matériel**, pas un
critère d'acceptation — elle ne peut pas justifier un refus.

## Les quatre familles

### 1 · La règle globale IATA — `rule_global_brachy_hold`

`deny` sur `hold` + `cargo`, portée **globale**, **sans aucune condition de saison ni de
température**, appliquée aux 102 compagnies. **40 compagnies ne tiennent que par elle.**

### 2 · Les règles propres aux compagnies — 41 règles, 41 compagnies

Toutes de forme identique : `deny hold+cargo`. Une par compagnie, aucun doublon.

### 3 · Interdictions représentées comme auditées dans le référentiel — **0**

Critère : la politique du canal porte une preuve auditée — non auto-citée, non dérivée de la fiche,
non « non revérifiée » — **qui dit `brachy_allowed = false`**.

> **« 0 » ne veut pas dire qu'aucune compagnie ne publie réellement d'interdiction.** Beaucoup en
> publient probablement. Cela veut dire que **nous ne l'avons pas prouvé**. C'est un état de notre
> documentation, pas un fait sur le monde — et cela appelle une revérification, pas un retrait
> automatique.

### 4 · Les règles auto-sourcées ou non vérifiables — **41**

La totalité des règles compagnie, chacune fichée avec sa source, sa date, le statut canonique de sa
soute et de son fret, et ce que la politique déclare de `brachy_allowed`.

## Le diff prévisionnel, option par option

Grille publique : les 72 scénarios de la baseline T0-A. Grille brachycéphale : un carlin en soute sur
la première route directe de **chacune des 102 compagnies**. Grille témoin : un golden retriever,
mêmes routes.

| option | verdicts | cartes | placements | score | brachy : compagnies / placements | **→ `allowed`** | **→ « à confirmer »** | témoin golden |
|---|---|---|---|---|---|---|---|---|
| **A** statu quo | — | — | — | — | — | — | — | — |
| **B** retirer la règle globale | 18 | 200 | 324 | 0 … +39 | 40 / **70** | 26 | **44** | 0 / 0 |
| **C** retirer les 41 compagnie | 0 | 0 | 0 | 0 … +1 | 0 / **0** | 0 | 0 | 0 / 0 |
| **D** retirer les 42 | 20 | 524 | 940 | 0 … +57 | 81 / **147** | 65 | **82** | 0 / 0 |
| **F-warn** les 42 en `warn` | 20 | 524 | 940 | 0 … +56 | 81 / **147** | 65 | **82** | 0 / 0 |
| **F-require** les 42 en `require` | 20 | 524 | 940 | 0 … +56 | 81 / **147** | 65 | **82** | 0 / 0 |
| **G** retirer + politique « non documentée » | 20 | 844 | 1312 | **−23** … +39 | 81 / **148** | **26** | 122 | **38 / 40** |

Aucun placement ne va vers `denied` dans aucune option. Sous **G**, les 40 placements du golden
retriever vont tous vers « à confirmer ».

- **verdicts** : scénarios dont le verdict change. **cartes** : cartes compagnie modifiées, toutes
  occurrences confondues. **placements** : cabine/soute/fret modifiés individuellement.
- **E — ne garder que les interdictions représentées comme auditées** se confond avec D, cet ensemble
  étant vide (0 sur 41).

### Comment lire ces colonnes

- **B** ne touche aucune des 41 compagnies porteuses : leur interdiction tient seule. Ce qu'elle
  déplace, ce sont les **40 compagnies sans règle propre** — celles pour lesquelles le site interdit
  la soute sur la seule foi d'une page générale de l'IATA, aujourd'hui rapportée en 404.
- **C** ne déplace **aucun** statut : les 41 sont intégralement doublées par la globale. Seul le
  score bouge, de +1 au plus.
- **D** déplace 147 placements, dont **82 vers « à confirmer »** et 65 vers `allowed`. Ce n'est donc
  pas une réouverture uniforme : le moteur reprend la politique générale du canal, tantôt l'une
  tantôt l'autre. Les 65 `allowed` restent le point de vigilance — le site y publierait une
  acceptation que rien ne soutient.
- **G** n'est **pas** le seul chemin vers « à confirmer » : D en produit déjà 82. Elle en produit
  davantage (122), mais laisse tout de même **26 placements brachycéphales en `allowed`**, fait
  **baisser** un score jusqu'à −23, et coûte 40 placements à des chiens qui n'étaient pas en cause.

## Aucune option saisonnière n'est proposée

Le quatrième principe directeur l'interdit, et la mesure le confirme : le référentiel ne contient
**aucun seuil brachycéphale sourcé**, ni température ni période. Une option « interdiction d'avril à
octobre » aurait été facile à écrire et impossible à justifier — y compris en s'appuyant sur la
« saison chaude » de l'IATA, qui ne définit ni mois ni degré.

## Ce que ce dossier NE fait pas

- il n'applique aucune option et ne modifie aucun fichier de `packages/` ;
- il ne rouvre pas les **47 candidates** de T0-B3, qui restent hors décision ;
- il ne juge pas la véracité médicale du risque brachycéphale : il mesure ce que le site **affirme**,
  et avec quelle preuve. Que le risque soit réel ne rend pas sourcée une interdiction qui ne l'est
  pas — et n'autorise pas davantage à publier « autorisé » sans preuve.

## L'artefact

`arbitrage-p0-brachy.json` — les quatre familles, l'état de la source IATA, la limite du moteur
démontrée, le diff prévisionnel des sept options et la comparaison mesurée des variantes à D.
