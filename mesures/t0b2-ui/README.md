# T0-B2-UI — le contre-test navigateur, reproduit puis fermé

Contre-test navigateur du 15/08/2026, sur la préversion de T0-B2. Trois anomalies, qu'aucun
contrôle automatique ne regardait :

1. la **fiche compagnie** affichait le statut ÉDITORIAL (`channels[].cls` / `statusLabel`) au lieu
   de la décision canonique — 78 canaux sur 71 fiches ;
2. la **carte du Finder** exposait `https://mydogcanfly.com/…-dog-policy/` comme source de la
   politique — notre propre page, portée par 52 compagnies sur 102 ;
3. `window.mdcfQuery is not a function` sur toutes les pages d'entités.

## La preuve ROUGE, puis VERTE — même harnais, deux états du dépôt

| fichier | état du dépôt | résultat |
|---|---|---|
| `harnais-avant-correctif.txt` | `6c656ea` (avant correctif) | **24 OK, 95 FAIL** |
| `harnais-apres-correctif.txt` | après correctif | **119 OK, 0 FAIL** |

Le harnais est identique dans les deux passes — seul le code de l'application change. La passe
rouge a été obtenue dans un `git worktree` sur `6c656ea`, où seuls le harnais, `build:ci`, la
liste de sentinelles et `buildShard.ts` ont été copiés : ce qu'elle mesure est bien l'application
d'avant, pas un harnais complaisant.

Les trois anomalies apparaissent nommément dans la passe rouge : erreurs console sur les huit
pages, `0 bloc(s)` porteur de `data-status`, et
`https://mydogcanfly.com/thai-airways-dog-policy/` dans la carte rendue.

## Les outils de mesure

| outil | ce qu'il établit |
|---|---|
| `outils/repro-fiches.cjs` | la reproduction d'origine : 78 contradictions, 71 fiches |
| `outils/equation-84.cjs` | 84 = 78 + 0 + 6, comparé à des références indépendantes |
| `outils/diff-sources.cjs` | le diff `sources` approuvé entre les deux baselines figées |

## Ce que ce lot NE fait pas

Il **ne remplace pas** les 52 sources racines `mydogcanfly.com` : il cesse seulement de les
présenter comme la preuve d'une décision (fiche, `placement_decisions`, `rapport.sources`,
cartes). Leur audit et leur remplacement sont un lot à part, qui ne doit pas bloquer la
correction d'interface.
