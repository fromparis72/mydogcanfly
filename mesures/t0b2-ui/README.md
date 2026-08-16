# T0-B2-UI — le contre-test navigateur, reproduit puis fermé

Contre-test navigateur du 15/08/2026, sur la préversion de T0-B2. Trois anomalies, qu'aucun
contrôle automatique ne regardait :

1. la **fiche compagnie** affichait le statut ÉDITORIAL (`channels[].cls` / `statusLabel`) au lieu
   de la décision canonique — 78 canaux sur 71 fiches ;
2. la **carte du Finder** exposait la source RACINE de la fiche comme source de la politique —
   `https://mydogcanfly.com/…-dog-policy/` sur 52 compagnies sur 102, et une simple page
   d'accueil (`aerlingus.com`, `airchina.com`) sur 35 des 50 restantes ;
3. `window.mdcfQuery is not a function` sur toutes les pages d'entités.

## La preuve ROUGE, puis VERTE — même harnais, deux états du dépôt

| fichier | état du dépôt | résultat |
|---|---|---|
| `harnais-avant-correctif.txt` | `6c656ea` (avant correctif) | **28 OK, 97 FAIL** |
| `harnais-apres-correctif.txt` | après correctif | **125 OK, 0 FAIL** |

Le harnais est identique dans les deux passes — seul le code de l'application change. La passe
rouge a été obtenue dans un `git worktree` sur `6c656ea`, où seuls le harnais et son outillage ont
été copiés — `build:ci`, la liste de sentinelles, `buildShard.ts`, `finder-dom.cjs` et
`preuve.ts` : ce qu'elle mesure est bien l'application d'avant, pas un harnais complaisant.

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

Il **ne remplace pas** les 102 sources racines de fiche : il cesse seulement de les présenter
comme la preuve d'une décision (fiche, `placement_decisions`, `rapport.sources`, cartes), en
supprimant le champ du contrat moteur. Leur audit et leur remplacement sont un lot à part, qui ne
doit pas bloquer la correction d'interface.

Il ne traite pas non plus la **dette signalée en contre-revue** : certaines règles compagnie
portent encore des sources auto-citées qui pèsent sur la confiance, donc sur le score, même sans
apparaître dans `rapport.sources`. Ce point relève du chantier métier brachycéphale.
