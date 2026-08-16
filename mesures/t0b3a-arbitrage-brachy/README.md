# T0-B3-a — arbitrage de l'ensemble brachycéphale (42 règles)

**Ce dossier ne corrige rien et ne tranche rien.** Il mesure ce que chaque option déplacerait —
verdicts, canaux, scores — avant toute modification. Aucun fichier de `packages/` n'est écrit ;
l'empreinte SHA-256 des deux fichiers bruts est relue à la fin et comparée à celle du début.

Base de mesure figée : **`e2cf302`** (`main`, CI complète verte, run 36).

```
npm run mesure:t0b3a
```

## Le résultat central : le moteur ne sait pas dire « brachycéphale : à confirmer »

Le deuxième principe directeur — *« une politique non vérifiée devient à confirmer, jamais
interdit »* — **n'est pas réalisable en données seules**. Deux démonstrations :

| geste | attendu naïvement | observé |
|---|---|---|
| passer les 42 règles de `deny` à `warn` | le canal passerait « à confirmer » | **identique à un retrait pur** — `evaluate()` ne retient que `action === "deny"` pour décider d'un statut ; une règle d'une autre action reste visible dans `fired` et ne déplace rien |
| basculer la politique du canal sur « non documentée » | le canal passe « à confirmer » | **c'est vrai** — mais la politique d'un canal n'a aucune dimension race : **38 canaux de chiens non brachycéphales** basculent aussi, pour un golden retriever dont rien n'a jamais été douteux |

Y parvenir proprement demanderait une **évolution du moteur** : une classe de règle produisant
`confirmation_required` sur le chien qu'elle vise. C'est un lot de code, à contre-revoir et mesurer
à part. Ce dossier le nomme plutôt que de faire passer une option approchante pour la bonne.

## Les quatre familles

### 1 · La règle globale IATA — `rule_global_brachy_hold`

`deny` sur `hold` + `cargo`, portée **globale**, **sans aucune condition de saison ni de
température**, appliquée aux 102 compagnies. Source : une page générique de l'IATA. Son propre
`rationale` dit « la plupart des compagnies les refusent et les spécialistes le déconseillent » —
un défaut de sécurité assumé, pas une interdiction documentée compagnie par compagnie.

**40 compagnies ne tiennent que par elle** : elles n'ont aucune règle propre.

### 2 · Les règles propres aux compagnies — 41 règles, 41 compagnies

Toutes de forme identique : `deny hold+cargo`. Une par compagnie, aucun doublon.

### 3 · Les règles officiellement confirmées — **0**

Critère : la politique du canal porte une preuve auditée — non auto-citée, non dérivée de la fiche,
non « non revérifiée » — **qui dit `brachy_allowed = false`**. Pas « la compagnie a une source
quelque part » : la source doit énoncer le fait que la règle affirme.

**Aucune des 41 ne satisfait ce critère.** Sous le premier principe directeur — *« une interdiction
ne subsiste que si une source officielle actuelle l'énonce explicitement »* — aucune ne subsiste
telle quelle.

### 4 · Les règles auto-sourcées ou non vérifiables — **41**

La totalité des règles compagnie. Chacune est fichée avec sa source, sa date, le statut canonique
de sa soute et de son fret, et ce que la politique déclare de `brachy_allowed`.

## Le diff prévisionnel, option par option

Grille publique : les 72 scénarios de la baseline T0-A. Grille brachycéphale : un carlin en soute
sur la première route directe de **chacune des 102 compagnies**. Grille témoin : un golden
retriever, mêmes routes — sans elle, le dommage collatéral resterait invisible.

| option | verdicts publics | statuts publics | écart de score | canaux brachy déplacés | dont sans règle propre | **témoin golden** |
|---|---|---|---|---|---|---|
| **A** statu quo | — | — | — | — | — | — |
| **B** retirer la seule règle globale | 18 | 18 | 0 … +39 | **40** / 102 | 40 | 0 |
| **C** retirer les 41 règles compagnie | 0 | 0 | 0 … +1 | **0** / 102 | 0 | 0 |
| **D** retirer les 42 | 20 | 16 | 0 … +57 | **81** / 102 | 40 | 0 |
| **G** retirer les 42 + politique « non documentée » | 20 | 52 | **−23** … +39 | **81** / 102 | 40 | **38** |

### Deux options se confondent avec D

- **E — ne garder que les interdictions officiellement confirmées** : identique à D, puisque cet
  ensemble est **vide** (0 sur 41).
- **F — passer les 42 en `warn` ou `require`** : identique à D, le moteur n'accordant d'effet sur un
  statut qu'à l'action `deny`.

L'espace des options se réduit donc à **quatre issues distinctes**, et aucune ne produit
« à confirmer » pour la seule race concernée.

### Comment lire ces colonnes

- **B** ne déplace aucun canal des 41 compagnies qui ont leur propre règle : leur interdiction tient
  toute seule. Ce qu'elle déplace, ce sont les **40 compagnies sans règle propre** — celles pour
  lesquelles le site interdit aujourd'hui la soute sur la seule foi d'une page générale de l'IATA.
- **C** ne déplace **aucun** statut : les 41 règles compagnie sont intégralement doublées par la
  globale. Seul le score bouge, de +1 au plus, parce qu'une source faible quitte le calcul de
  confiance.
- **D** rouvre 81 canaux — mais les rouvre en **`allowed`**, pas en « à confirmer ». Le site
  publierait une acceptation que rien ne soutient : l'inverse exact du deuxième principe directeur.
- **G** est la seule à produire « à confirmer », et la seule à faire **baisser** un score
  (jusqu'à −23) : 38 golden retrievers perdent une soute qui n'était pas en cause.

## Aucune option saisonnière n'est proposée

Le quatrième principe directeur l'interdit, et la mesure le confirme : le référentiel ne contient
**aucun seuil brachycéphale sourcé**, ni température ni période. Une option « interdiction d'avril à
octobre » aurait été facile à écrire et impossible à justifier — elle aurait fabriqué exactement le
type de fait non sourcé que ce chantier corrige. Elle n'existe donc pas ici.

## Ce que ce dossier NE fait pas

- il n'applique aucune option et ne modifie aucun fichier de `packages/` ;
- il ne rouvre pas les **47 candidates** de T0-B3, qui restent hors décision ;
- il ne juge pas la véracité médicale du risque brachycéphale : il mesure ce que le site **affirme**,
  et avec quelle preuve. Que le risque soit réel ne rend pas sourcée une interdiction qui ne l'est
  pas — et n'autorise pas davantage à publier « autorisé » sans preuve.

## L'artefact

`arbitrage-p0-brachy.json` — les quatre familles nommément, la limite du moteur démontrée, et le
diff prévisionnel des cinq options sur les trois axes.
