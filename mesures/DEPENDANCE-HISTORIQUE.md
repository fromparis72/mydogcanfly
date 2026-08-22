# `t0b3-source-fige` — NE PAS SUPPRIMER CETTE BRANCHE

Cinq dossiers de mesure lisent leur état « avant » à un commit figé, par
`git show <sha>:<chemin>`. Ces cinq commits ne sont **pas** atteignables depuis
les branches de lots : la reconstruction est thématique, elle ne rejoue pas
l'histoire d'origine. Ils ne vivent que sur la branche `t0b3-source-fige`,
conservée pour cela.

**Supprimer cette branche rend cinq dossiers irreproductibles** — c'est-à-dire
que leur mesure ne prouve plus rien.

| commit | dossier | ce qu'il fixe |
|---|---|---|
| `dadecc29bd37` | `t0b3b-referentiel-brachy` | l'« avant » du référentiel |
| `ff692b2d2a44` | `t0b3c-seuils-de-soute` | l'« avant » des seuils |
| `eb3562c27caf` | `t0b3d-poids-du-contenant` | l'« avant » du contenant |
| `34b04cd8fe9e` | `t0b3e-ce-que-le-site-montre` | l'« avant » de l'affichage |
| `a9a6556a6d38` | `t0b3-regles-autosourcees` | le moteur de la mesure |

**Vérifier que la branche les conserve tous :**

```bash
git fetch origin t0b3-source-fige
for sha in dadecc29bd37 ff692b2d2a44 eb3562c27caf 34b04cd8fe9e a9a6556a6d38; do
  git merge-base --is-ancestor "$sha" FETCH_HEAD && echo "$sha ancêtre" || echo "$sha ABSENT"
done
```

## Pourquoi ces bases n'ont pas été déplacées

La tentation était de les rescellers sur un commit de la lignée reconstruite,
comme cela a été fait pour T0-B3-f, g et h. **C'est faux ici, et la contre-revue
du 23/08/2026 l'a arrêté avant que ce soit commis.**

T0-B3-b mesure un **avant/après**. Le sommet du lot 1 contient déjà le retrait
des 42 règles : y rebaser la mesure détruirait son « avant », et le dossier
comparerait l'état final à lui-même — un dossier vert qui ne mesure plus rien.
L'équivalent reconstruit exact de sa base, sur les trois fichiers bruts, serait
`0edab28e5b1050f6f35fc18fcf4420a438ee5015` ; et pour `a9a6556…` aucun équivalent
exact n'existe dans la lignée pour l'ensemble moteur + dépendances.

Ces cinq références restent donc **historiques et immuables**, et la branche qui
les porte fait partie du dépôt au même titre qu'un fichier.

## Conséquence sur l'intégration continue

Les trois `actions/checkout` du dépôt portent `fetch-depth: 0`. Le clone
superficiel par défaut ne contient qu'un commit : `git show <base>:<chemin>`
y échoue, et les mesureurs s'arrêtent — c'est ce qui a rendu trois pull requests
rouges le 23/08/2026, avant que la lecture n'échoue proprement.
