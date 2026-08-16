# T0-B3-a — arbitrage de l'ensemble brachycéphale (42 règles) · v2

**Ce dossier ne corrige rien et ne tranche rien.** Il mesure ce que chaque option déplacerait —
verdicts, cartes, placements, scores — avant toute modification. Aucun fichier de `packages/` n'est
écrit ; l'empreinte SHA-256 des deux fichiers bruts est relue à la fin et comparée à celle du début.

Base de mesure figée : **`e2cf302ccf045c539ca450f23964bb7bf20af84c`** — SHA complet, jamais abrégé :
un préfixe court est ambigu par construction.

```
npm run mesure:t0b3a
```

## Ce qui a changé depuis la v1

| correction | v1 | v2 |
|---|---|---|
| **compagnie ≠ placement** | « D rouvre 81 canaux » — c'était 81 **compagnies** | les deux grandeurs publiées côte à côte : **81 compagnies, 147 placements** |
| **« statuts publics »** | comptait des scénarios, pas des statuts | remplacé par trois colonnes explicites + le grain carte et placement |
| **option F** | « identique à un retrait » — affirmé, non mesuré | **mesurée** : 28 scénarios sur 72 au score différent de D. `require` mesuré séparément |
| **source IATA** | non documentée | section dédiée : ancienne URL, état rapporté, nouvelle URL, citation, et **la provenance du relevé** |
| **famille 3** | « 0 officiellement confirmée » | « **0 interdiction représentée comme auditée dans le référentiel** » — un état de notre documentation, pas un fait sur le monde |

## Le résultat central : le moteur ne sait pas dire « brachycéphale : à confirmer »

Le deuxième principe directeur — *« une politique non vérifiée devient à confirmer, jamais
interdit »* — **n'est pas réalisable en données seules**.

| geste | observé |
|---|---|
| passer les 42 de `deny` à `warn` ou `require` | **aucun statut ne bouge** : `evaluate()` ne retient que `action === "deny"` pour décider d'un statut |
| basculer la politique du canal sur « non documentée » | le canal passe « à confirmer » — mais la politique n'a **aucune dimension race** : 38 compagnies et 40 placements basculent aussi pour un **golden retriever** |

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

## La source IATA — relevé de contre-revue, non vérifié par moi

| | |
|---|---|
| URL enregistrée dans la règle | `https://www.iata.org/en/youandiata/travelers/pets/` |
| état rapporté | **404 — page disparue** |
| URL officielle vivante rapportée | `https://www.iata.org/en/programs/cargo/live-animals/pets/` |
| citation rapportée | le transport des chiens brachycéphales en saison chaude est **« not recommended »** — pas interdit — et une caisse **10 % plus grande** est demandée |

**Provenance de ce relevé** : rapporté par la contre-revue le 16/08/2026, **non vérifié par moi**.
L'accès réseau à `iata.org` est bloqué par le proxy d'egress de cet environnement, en `curl` comme
en `WebFetch`. Dans un dossier dont l'objet est la provenance, présenter la lecture d'un autre comme
la mienne serait le défaut même que ce chantier corrige.

**L'écart, s'il se confirme, est de nature et non de degré** : l'IATA *recommande* de ne pas
transporter **en saison chaude** ; notre règle *interdit* **en toute saison**. Nous avons transformé
une recommandation conditionnelle en interdiction universelle et permanente.

**Ce que cela n'autorise pas** : inventer une période ou un seuil de température. Remplacer une
affirmation non sourcée par une autre ne serait pas un progrès. Et la caisse « 10 % plus grande » est
une exigence de **matériel**, pas un critère d'acceptation — elle ne peut pas justifier un refus.

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

| option | verdicts | cartes | placements | écart de score | brachy : compagnies / placements | dont sans règle propre | **témoin golden** |
|---|---|---|---|---|---|---|---|
| **A** statu quo | — | — | — | — | — | — | — |
| **B** retirer la règle globale | 18 | 200 | 324 | 0 … +39 | 40 / **70** | 40 | 0 / 0 |
| **C** retirer les 41 compagnie | 0 | 0 | 0 | 0 … +1 | 0 / **0** | 0 | 0 / 0 |
| **D** retirer les 42 | 20 | 524 | 940 | 0 … +57 | 81 / **147** | 40 | 0 / 0 |
| **F-warn** les 42 en `warn` | 20 | 524 | 940 | 0 … +56 | 81 / **147** | 40 | 0 / 0 |
| **F-require** les 42 en `require` | 20 | 524 | 940 | 0 … +56 | 81 / **147** | 40 | 0 / 0 |
| **G** retirer + politique « non documentée » | 20 | 844 | 1312 | **−23** … +39 | 81 / **148** | 40 | **38 / 40** |

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
- **D** déplace 147 placements — mais vers **`allowed`**, pas « à confirmer ». Le site publierait une
  acceptation que rien ne soutient : l'inverse exact du deuxième principe directeur.
- **G** est la seule à produire « à confirmer », la seule à faire **baisser** un score (−23), et elle
  coûte 40 placements à des chiens qui n'étaient pas en cause.

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
