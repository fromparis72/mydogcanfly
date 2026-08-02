# Fiches pays — étude de redondance et proposition de refonte

Mesures faites sur le site en production, 29 juillet 2026, sur trois profils :
**Espagne** (cas simple, régime UE), **Mexique** (cas moyen), **Australie** (cas le plus lourd).

---

## 1. Ce que disent les chiffres

| | Espagne | Mexique | Australie |
|---|---|---|---|
| Mots visibles | 2 994 | 3 324 | 3 488 |
| Temps de lecture | ~15 min | ~17 min | ~17 min |
| Cartes / sections | 16 | 16 | 16 |
| Liens vers nos outils | 1 | 1 | 1 |

**Le cas « simple » pèse presque aussi lourd que le cas « difficile ».** Une entrée en
Espagne depuis la France est pourtant une formalité : puce, vaccin, passeport. La page
demande quinze minutes de lecture pour dire cela.

### Répétition des faits essentiels

Nombre de blocs distincts où le même fait est énoncé :

| Fait | Espagne | Mexique | Australie |
|---|---|---|---|
| Certificat sanitaire | **8×** | **8×** | 4× |
| Vaccination antirabique | **7×** | **7×** | 5× |
| Puce électronique | **7×** | 3× | 4× |
| Titrage antirabique | **7×** | 3× | **6×** |
| Délais / attente | 5× | 2× | **7×** |
| Quarantaine | 3× | 4× | **8×** |

Les blocs concernés sont toujours les mêmes : `hero` → `summary` → `prepTime` →
`factors` → `requirements` → `origin` → `arrival` → `checklist`.

**Autrement dit : le lecteur apprend sept fois qu'il faut vacciner son chien.**

---

## 2. Diagnostic par bloc

| Bloc | Fonction réelle | Verdict |
|---|---|---|
| `hero.intro` | Narratif d'accueil, 8–12 lignes | **À raccourcir** — il redit le sommaire |
| `summary` | Tableau exigence → statut | **Redondant** avec `requirements` |
| `prepTime` | 3 barres de délai par origine | **À fusionner** dans le verdict (1 ligne) |
| `notice` | Alertes | **À garder** — c'est le seul bloc qui surprend |
| `factors` | Pédagogie « 3 facteurs » | **À réduire** — 3 200 caractères pour dire « ça dépend » |
| `requirements` | Tableau détaillé + sources | **Cœur de la page. À garder tel quel.** |
| `origin` | Variantes selon provenance | **À refondre** — voir §3 |
| `arrival` | Ce qui se passe à l'arrivée | **À garder** — information unique |
| `restrictedDogs` | Races interdites | **À garder** |
| `domestic` | Vols intérieurs | **À garder** |
| `exit` | Sortie du pays | **À garder** |
| `checklist` | Liste à cocher | **Redondant** — reformule `requirements` |
| `sources` | Références officielles | **À garder** — fonde la crédibilité |

Sur 13 blocs, **4 n'apportent aucune information neuve** : `summary`, `prepTime`,
`factors`, `checklist`. Ils représentent environ **8 700 caractères**, soit un quart du
contenu d'une fiche.

---

## 3. Le bloc `origin` — un carcan européen

Le gabarit impose trois colonnes fixes : *Depuis l'UE*, *Depuis un pays listé*,
*Depuis un pays non listé*. Or **48 fiches sur 140** rangent sous « Depuis l'UE » un
contenu qui ne parle pas de l'UE.

Exemple relevé sur le Mexique :

| Étiquette affichée | Contenu réel |
|---|---|
| Depuis l'UE | « Depuis les USA ou le Canada — simple inspection » |
| Depuis un pays listé | « Depuis tout autre pays — Certificat de Bonne Santé » |
| Depuis un pays non listé | « Documents manquants & voyage de retour » |

La troisième colonne n'est même pas une origine. D'autres pays ont leur propre
taxonomie : l'Australie parle de *groupes 1/2/3*, le Canada de *pays indemne de rage*,
le Brésil d'*origine touchée par la rage*.

**Deux corrections nécessaires**, indépendantes l'une de l'autre :
1. rendre l'étiquette de colonne **surchargeable par fiche** (champ `tag` optionnel) ;
2. n'écrire dans ces colonnes que ce qui **change** d'une origine à l'autre, pas
   l'intégralité des exigences — sinon on triple le tableau `requirements`.

---

## 4. Maillage outils — quasi inexistant

Une fiche pays contient **un seul lien** vers nos outils : le calculateur de caisse.
Les quatre autres n'apparaissent nulle part, alors que chacun a un usage évident depuis
une fiche pays :

| Outil | Pertinence sur une fiche pays |
|---|---|
| **Finder** | « Quelles compagnies vont là-bas avec un chien ? » — l'action principale |
| **Risque chaleur** | La température à l'arrivée conditionne la soute |
| **Coins pipi** | Les aéroports de ce pays |
| **Destinations** | Comparer avec des pays voisins plus simples |
| **Caisse IATA** | déjà présent |

---

## 5. Architecture proposée

Trois temps de lecture, au lieu de seize blocs de même poids.

### A — Répondre en 30 secondes
Verdict (difficulté), délai à prévoir, **3 à 5 exigences clés**, et l'alerte s'il y en a une.
Absorbe : `hero`, `summary`, `prepTime`, `notice`.
→ **un seul bloc**, lisible sans défilement.

### B — Le référentiel
Le tableau `requirements`, inchangé : exigence, obligatoire ou non, quand, exceptions,
référence officielle. **C'est la source unique de vérité de la page.**
Suivi de `origin` refondu — uniquement les **écarts** selon la provenance.

### C — Approfondir
`arrival`, `restrictedDogs`, `domestic`, `exit`, la FAQ, puis `sources`.
Chaque bloc reste indépendant et peut être ignoré.

### D — Agir (nouveau)
Un bloc de services en fin de page, comme sur la Bible : Finder vers ce pays, risque
chaleur, coins pipi des aéroports du pays, caisse IATA.

**Gain estimé : de ~3 200 à ~1 900 mots**, sans perdre une seule information sourcée —
uniquement en supprimant les redites.

---

## 6. Ordre de travail suggéré

1. **Maillage outils** (rapide, gain immédiat, aucun risque éditorial).
2. **Étiquettes `origin` surchargeables** + correction des 48 fiches concernées.
3. **Fusion du bloc d'entrée** (`hero` + `summary` + `prepTime` + `notice`).
4. **Suppression de `checklist` et allègement de `factors`** — à valider, car ce sont
   les deux seuls blocs qui pourraient avoir une valeur d'usage propre (impression,
   pédagogie) au-delà de l'information qu'ils répètent.

Les points 1 et 2 sont sans débat. Les points 3 et 4 touchent à l'éditorial et méritent
ton arbitrage avant exécution.

---

## 7. Ce qui a été exécuté — 29 juillet 2026

### Point 1 — maillage outils : fait

`PageActions.astro` clôt désormais à l'identique les fiches pays, compagnies, races et la
Bible : réserver / imprimer / envoyer par email, puis les cinq outils, chacun pré-rempli
avec ce que la page sait déjà (destination, race, compagnie). On passe de **1 lien outil
par fiche pays à 5**.

### Points 3 et 4 — arbitrés puis exécutés

| Bloc | Décision | Mise en œuvre |
|---|---|---|
| `prepTime` | Fusionner | La carte et ses 3 barres disparaissent. Chaque délai rejoint **la colonne `origin` correspondante** — les clés `eu` / `listed` / `nonListed` étaient déjà identiques. Une ligne d'ordre de grandeur (« Plusieurs mois de préparation »), dérivée de `difficulty.level`, s'affiche à côté du verdict. |
| `factors` | Réduire | Les 3 intitulés et leurs étoiles restent ; `intro`, `text` et `note` ne sont plus rendus. |
| `checklist` | Rendre opérationnel | Remplacée par **« Dans quel ordre, et quand »**, une séquence numérotée construite depuis `requirements`. En contrepartie, la colonne « Quand » **quitte** le tableau de référence : l'information est *déplacée*, pas dupliquée. Le tableau passe de 5 à 4 colonnes (mieux sur mobile) ; la séquence est placée juste sous lui. |
| `summary` | Conservé intégralement | Le plafond de 5 lignes envisagé n'a pas été appliqué : les fiches ont 7 à 8 lignes, toutes distinctes (Australie : permis BICON, titrage 180 j, quarantaine 10 j). C'est le bloc le plus rapide à lire pour 2,8 % du poids. |

### Mesures après coup

Sur 12 fiches reconstruites : **3 205 → 2 961 mots** en moyenne (−7,6 %).

Répétition d'un même fait, en nombre de sections distinctes :

| Fait | Bosnie | France | Côte d'Ivoire | Angola |
|---|---|---|---|---|
| Certificat | 6 → 4 | 7 → 5 | 10 → 8 | 10 → 8 |
| Vaccin rage | 6 → 5 | 6 → 5 | 9 → 7 | 9 → 7 |
| Titrage | 8 → 6 | 8 → 6 | 5 → 5 | 6 → 5 |

**Correction d'une erreur de l'étude** : les « ~8 700 caractères » du §2 additionnaient les
trois langues. Le gain réel par page affichée est donc trois fois moindre que ce que le
chiffre laissait croire — d'où −7,6 % et non −25 %.

### Ce qui reste redondant

Le fait principal reste énoncé 5 à 8 fois. Les trois sources restantes :

1. **`hero.intro`** (7,1 % du poids, ~985 caractères par langue) — récit d'accueil qui
   redit le sommaire. C'est le plus gros gisement encore ouvert, mais il demande une
   réécriture éditoriale de 140 × 3 textes.
2. **`summary` vs `requirements`** — assumé : deux vitesses de lecture.
3. **La FAQ** — assumée : elle vise les moteurs génératifs, pas le lecteur.
