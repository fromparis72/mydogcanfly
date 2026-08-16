# Option H — conception, simulation et patch des contrats · v5

**Aucune ligne de moteur n'a été écrite.** Aucun fichier de `packages/` n'est modifié.

```
node --import tsx mesures/t0b3a-arbitrage-brachy/outils/simuler-h.mjs
```

## Le patch moteur — étape 1 : les contrats

Feu vert reçu. Cette étape crée les **contrats de sortie** ; le câblage de `evaluate` sur
`BreedRestriction` suivra. Ce qui est en place dans `packages/engine/src/contracts.ts` :

| contrat | état |
|---|---|
| `ConfirmationCause` connaît **`breed_policy_unreviewed`** (`policy_ref`) | ✅ |
| `ConfirmationCause` connaît **`breed_requirement`** (`policy_ref` + `restriction_ref` **obligatoire**) | ✅ |
| `causeKey()` intègre `restriction_ref` pour `breed_requirement` | ✅ |
| **`RestrictionEvidence`** — preuves **plurielles**, composant `SourcedQuote` | ✅ |
| `PlacementDecision.evidence` sur les trois branches | ✅ |
| **`SafetyAdvisory`** exporté par le moteur, `text` déjà localisé | ✅ |
| `advisoryKey()` — déduplication (restriction, portée) | ✅ |
| `DecisionReport.safety_advisories` **obligatoire**, quitte à être vide | ✅ |

**Sept lacunes, pas six.** J'avais oublié `breed_policy_unreviewed` dans ma liste : la sonde la
détectait et la branche 4 l'exigeait, mais elle ne figurait pas dans le décompte. `ConfirmationCause`
reçoit donc **deux** branches distinctes — « nous ne savons pas » et « la compagnie exige ceci ».

**Un seul chemin de preuve, pas deux.** `DecisionSource` reste la projection **courte** de la
politique générale du canal et **ne porte pas** la citation ; les faits de race passent par
`RestrictionEvidence`, au pluriel et avec leur `SourcedQuote` complète. Une exigence vérifie
explicitement que `DecisionSource` reste sans citation — corriger deux fois le même problème aurait
recréé les modèles concurrents que ce chantier a passé quatre revues à supprimer.

**La sonde est passée du négatif au positif.** Elle exigeait les lacunes **ouvertes** — seule façon
de ne rien laisser croire tant que le patch n'existait pas. Elle serait devenue rouge à l'instant
exact où le moteur est réparé. Elle vérifie désormais ce que le contrat **doit** porter, et la sonde
`makePlacementDecision` exige que les deux causes soient **acceptées**, que deux exigences distinctes
soient **conservées**, et qu'un `breed_requirement` sans `restriction_ref` soit **refusé**.

`safety_advisories` est produit **vide** par `explain` : les avis naîtront quand `evaluate`
consommera les `BreedRestriction`. Un tableau vide dit « aucun avis » — ce qu'un champ absent ne sait
pas dire, et c'est pourquoi le champ est obligatoire.

**Contrôles** : `typecheck` propre, `test:unit` 64 OK / 0 FAIL, **46 exigences** de simulation
tenues, six contre-épreuves en code 1.

### Ce qui reste au patch

1. `evaluate` consomme `BreedRestriction` et produit les décisions de race ;
2. `explain` émet les `safety_advisories` dédupliqués ;
3. le rendu DOM dans les quatre langues, avec harnais bloquant ;
4. l'entrée `brest_iata_snub_nose_hot_season` dans le référentiel, et le retrait des 42.

## Les corrections de la v4-ter

### P0-1 · Les preuves multiples étaient encore perdues — et le compteur était mort

Deux `require` produisaient bien deux causes, mais **une seule preuve** descendait, celle de la
première restriction. Et le compteur censé le détecter était **mécaniquement nul** : les branches
`deny` et `allow` sortaient avant lui, `require` en était explicitement exclue, et il n'était même
pas publié dans l'artefact.

Désormais : **une preuve par restriction décisive**, enregistrée avec son `restriction_ref`, sa
source, sa citation et sa langue. Et la perte du contrat actuel est **mesurée**, non supposée :

| | |
|---|---|
| causes produites | **2** |
| preuves produites | **2** — `brest_fx_req1`, `brest_fx_req2` |
| portées par `PlacementDecision.source` | **1** |
| **perdues par le contrat actuel** | **1** |

La contre-épreuve `multi` exige deux exigences, deux causes **et deux preuves distinctes à la sortie
publique**.

### P0-2 · `SafetyAdvisory` était encore un modèle parallèle

Le schéma local redéfinissait une provenance appauvrie — `url + quote + quote_language` — et
contournait `SourcedQuote`, qui garantit **aussi** le type de source factuel, les dates, l'échéance
de revue, la confiance, le relecteur, l'historique et le refus des auto-citations.

C'était le défaut P0-B refait à l'identique, un niveau plus bas. `SafetyAdvisory` **compose**
désormais `SourcedQuote`.

### P0-3 · `safety_advisories` n'appartient pas encore au contrat moteur — et le dossier le dit

La cible reste celle de la contre-revue : `SafetyAdvisory` exporté par le contrat moteur,
`DecisionReport.safety_advisories` déclaré, texte déjà localisé, rendu DOM bloquant.

**Mais ce sont des lignes de moteur, que le mandat interdit encore.** Plutôt que de laisser croire
que le champ serait contractuel, le dossier **mesure les six lacunes** et exige qu'elles soient
toutes ouvertes — aucun acquis supposé :

| lacune | état mesuré |
|---|---|
| `DecisionReport` déclare `safety_advisories` | **non** |
| `SafetyAdvisory` exporté par le moteur | **non** |
| `ConfirmationCause` connaît `breed_requirement` | **non** |
| `causeKey()` intègre `restriction_ref` | **non** |
| `DecisionSource` porte la citation | **non** |
| `PlacementDecision` porte plusieurs preuves | **non** |

Le premier contrôle répondait « oui » à tort : un `/quote/` sur tout le fichier tombait sur
`fee_quote_only`. Un contrôle imprécis qui répond oui est pire que pas de contrôle — il est
maintenant ciblé sur le bloc `DecisionSource`.

### P0 · Le test « quadrilingue » relisait son entrée

Il lisait `detail[locale]` dans l'objet multilingue qu'il venait lui-même de fournir. Il lit
désormais le **`text` produit dans le rapport**, choisi dans la langue de la requête : **4 textes
distincts** sur 4 langues, sur un rapport précis portant **exactement 1** avis.

### Hygiène · une contre-épreuve ne publie plus rien

Découvert en vérifiant cette v4-ter à la main : lancer `--contre-epreuve=multi` **écrasait
l'artefact** avec les chiffres du cas cassé. Le runner enchaînant contre-épreuves puis régénération,
le défaut restait invisible. Une contre-épreuve n'écrit plus l'artefact.

## Les corrections de la v4-bis

### P0 · Plusieurs exigences applicables étaient perdues

`decisionH()` utilisait `find()` et ne gardait qu'une restriction décisive. Le contrat autorise
pourtant plusieurs `require` sur un même canal — certificat vétérinaire **et** caisse renforcée.

- une cause **par** `require` applicable, tri par identité pour un ordre total ;
- `breed_requirement` porte `restriction_ref` **obligatoire** ;
- la clé de déduplication de H intègre `restriction_ref`.

**Et la clé du moteur ne suffit pas** : `causeKey()` ne connaît pas `breed_requirement` et retombe
sur `code|policy_ref`. Deux exigences distinctes sur le même canal seraient **écrasées en une**. La
simulation le mesure — 2 clés distinctes avec la clé de H, **1 seule** avec `causeKey()` — au lieu
de l'annoncer. Sixième contre-épreuve : `--contre-epreuve=multi` n'injecte qu'une exigence, et
l'attente de deux causes **ne s'adapte pas** ; elle échoue en code 1.


### P0 · La preuve était contrôlée avant le parcours, donc jamais prouvée

Les fixtures lisaient la citation dans `r.decisive.source`, l'objet d'**entrée**. Elles annonçaient
« citation conforme » sans que cette citation atteigne jamais le rapport.

Elles appellent désormais le parcours complet — `decisionH` → `appliquerH` → `explain` → **rapport
public** — et contrôlent la source **là où le visiteur la verrait**. Trois cas structurellement
distingués :

| cas | preuve dans le rapport |
|---|---|
| `deny` / `allow` / `require` audité | la source **de la restriction**, pas celle du canal |
| aucun fait audité | **aucune** preuve de race sur la cause |
| politique générale du canal | inchangée, à sa place |

**Constat de contrat, mesuré** : `DecisionSource` est `.strict()` et ne porte **ni citation ni
langue**. La phrase officielle **ne peut pas** atteindre le rapport public par ce chemin. Il faudra
l'y faire entrer — c'était le faux vert de la v4.

### P0 · `avis_securite` est devenu un contrat

Un champ librement attaché, qu'aucun contrat ne vérifiait et que l'interface pouvait ignorer sans
que rien n'échoue. Désormais :

- type strict **`SafetyAdvisory`** — `restriction_ref`, `scope`, `placements`, `text` **déjà
  localisé**, `criticality`, et une source qui est la **`SourcedQuote` canonique** ;
- clé de déduplication `(restriction, portée)` : un avis global vaut pour le **rapport**, non par
  compagnie et par canal. Tout compteur cumulé d'appels internes est sans signification ici — la
  seule mesure qui vaut est **un avis dédupliqué dans un rapport précis** ;
- test sur un **rapport précis** : exactement **1** avis, référence, portée, placements, URL et
  citation exactes ;
- rendu vérifié dans les **quatre langues**, quatre textes distincts ;
- absence d'effet **mesurée** : grille rejouée sans l'avis, 0 écart de verdict, de score, de statut.

**Deux corrections de fond sur la source IATA** :

- **les trois placements**, pas `hold`+`cargo`. La page ne limite pas son conseil à la soute et au
  fret — elle traite aussi de la cabine. Restreindre l'avis reconduisait le cadrage de l'**ancienne
  règle**, pas ce que la source dit ;
- **`official_website`**, pas `regulation` : c'est une page de conseils aux voyageurs, pas le texte
  des Live Animals Regulations. La classer en règlement lui prêterait une force qu'elle n'a pas.

Effet de bord attrapé au passage : mon raccourci « la cabine n'est jamais touchée » supprimait aussi
la **collecte** de l'avis en cabine. Le statut et l'avis sont maintenant deux chemins distincts.

## Les corrections de la v4

### P0 · Le validateur d'ensemble était contourné

`chargerRestrictions()` n'appelait que `BreedRestriction.safeParse()`, entrée par entrée, et
« résolvait » ensuite les conflits par une priorité que j'avais inventée : `deny > require > allow`.
C'était contourner la moitié du contrat. `validateBreedRestrictions()` refuse `allow` + `deny`
(**CONTRADICTION**), rend `deny` + `require` **UNREACHABLE**, signale les conditions non disjointes
et les identifiants inconnus — **y compris entre une règle globale et une règle compagnie**.

**Une contradiction ne se résout pas : elle se refuse.** La priorité est supprimée. Le chargement
appelle désormais schéma **puis** validation d'ensemble, avec les `KnownIds` du référentiel, et
lève à la moindre anomalie.

Cinquième contre-épreuve permanente : `--contre-epreuve=validateur` injecte `allow` + `deny` sur la
même compagnie, la même race et le même canal. Le chargement devient **impossible** — `CONTRADICTION`,
avant toute décision.

Effet de bord immédiat et sain : mes fixtures visaient `airline_fx`, qui n'existe pas. Le validateur
les a refusées (`UNKNOWN_AIRLINE`). Elles visent maintenant une compagnie réelle.

### P0 · `require` produisait une cause fausse et perdait sa preuve

Les branches 4 et 5 émettaient toutes deux `breed_policy_unreviewed`. C'est faux pour la branche 5 :
une exigence officielle auditée n'est **pas** une politique non revérifiée. L'une dit « nous ne
savons pas », l'autre « la compagnie exige ceci ».

| branche | cause | référence | source |
|---|---|---|---|
| 4 · aucun fait audité | `breed_policy_unreviewed` | `policy_ref` seul | **aucune** — une absence de fait n'a pas de preuve |
| 5 · `require` audité | **`breed_requirement`** | `policy_ref` + **`restriction_ref`** | celle de la restriction décisive |
| 2 · `deny` audité | — (refus, causes éteintes) | — | celle de la restriction décisive |
| 3 · `allow` audité | — | — | celle de la restriction décisive |

La v3 conservait `d.source`, la provenance générale du canal, même sur une branche tranchée par une
restriction : la carte aurait montré la mauvaise page. La preuve descend maintenant **avec** la
décision.

Les fixtures contrôlent désormais **statut, branche, cause, `restriction_ref`, URL et citation
exactes**, et l'absence de source sur `breed_policy_unreviewed`.

### P1 · L'avertissement IATA est maintenant dans le parcours réel

`RESTRICTIONS_REELLES` valait `[]` : l'avis n'existait qu'en fixture, et le parcours public en
émettait **zéro**. La cible de H contient désormais l'entrée `brest_iata_snub_nose_hot_season` —
`warn`, **les trois placements**, URL vivante, phrase officielle complète, texte localisé dans les
quatre langues.

Le chemin est simulé de bout en bout : `BreedRestriction warn` → avis structuré → rattaché au
rapport public (`safety_advisories`), **jamais** dans les sources probantes. La mesure qui compte :
**exactement un avis dédupliqué** dans un rapport précis.

Et l'absence d'effet n'est plus affirmée mais **mesurée** : la grille publique est rejouée sans
l'avis, et l'égalité stricte des verdicts, scores et statuts est exigée — **0 écart**.

La recommandation reste formulée « en saison chaude », sans calendrier ni température inventés.

### P1 · Les chiffres approuvés sont verrouillés littéralement

72 scénarios · 20 verdicts · 524 cartes · 940 placements · score exactement `[0, 2]` ·
81 compagnies · 147 placements · 147 cibles `confirmation_required` et aucune autre ·
56 causes climatiques. **41 exigences** au total, toutes bloquantes.

## Les quatre P0 de la v2, et ce qui les corrige

### P0-A · Le simulateur n'échouait sur aucune garantie métier

Il ne sortait en erreur que si le référentiel avait bougé. Des causes perdues, une fixture fausse,
une auto-citation détectée auraient été **écrites dans le JSON**, puis le processus serait sorti en
0. Un contrôle dont l'échec ne coûte rien n'est pas un contrôle.

**v3, étendue jusqu'en v4-ter** : les **41 exigences** passent par `exiger()`. Une seule violation ⇒ **code 1**. Et quatre
contre-épreuves cassent volontairement un invariant, vérifiées à chaque reproduction :

| contre-épreuve | exigence mise en défaut | code |
|---|---|---|
| `--contre-epreuve=causes` | G5 · aucune cause préexistante perdue | **1** |
| `--contre-epreuve=table` | fixtures de la table H | **1** |
| `--contre-epreuve=ids42` | les 42 identités sont exactement 42 | **1** |
| `--contre-epreuve=bascules` | les bascules vont exclusivement vers « à confirmer » | **1** |
| `--contre-epreuve=validateur` | `allow` + `deny` — le chargement devient impossible | **1** |
| `--contre-epreuve=multi` | une seule exigence là où deux sont attendues | **1** |

`npm run mesure:t0b3a` les exécute **avant** de régénérer : si l'une passait au vert, tout le reste
du dossier perdrait sa valeur.

### P0-B · H contournait le contrat déjà construit

`BreedRestriction` existe dans `packages/knowledge/src/breed-restrictions.ts` : action
`allow | deny | warn | require`, cible de race, placements, conditions, et une **`SourcedQuote`
obligatoire** — citation, langue BCP-47, type de source factuel, refus des domaines MyDogCanFly.
Son propre commentaire nomme `rule_global_brachy_hold` comme le défaut fondateur.

**Je ne l'avais pas cherché.** Je proposais d'ajouter un état concurrent dans `PlacementPolicy` —
deux modèles pour un même fait. Pire : ma fixture « source auditée » n'avait ni citation ni langue,
et `preuveAuditee` l'acceptait parce qu'elle vérifie **autre chose** (ni dérivée, ni auto-citée, ni
non revue). Ce n'était pas une preuve brachycéphale au sens du contrat.

**v3** : H consomme `BreedRestriction`, et rien d'autre. Chaque fixture est **validée par le
contrat lui-même** — une source sans citation est désormais refusée à la construction.

### P0-C · Les fixtures testaient une seconde implémentation

Elles appelaient `brancheFx`, un clone de la table. Une inversion dans la vraie table H les aurait
laissées vertes.

**v3** : **une** fonction, `decisionH`, paramétrée par le référentiel. Simulation, fixtures et
contre-épreuves l'appellent toutes — et **elle a immédiatement révélé un vrai défaut** : un golden
retriever tombait en branche 4 et recevait une confirmation de race. Le filtre de périmètre vivait
dans `appliquerH` ; il devait être dans la table, sinon la table est fausse dès qu'on l'appelle
autrement.

### P0-D · La conservation des causes n'était pas vérifiée par scénario

La clé du journal était `airline#placement|cause` : une cause perdue sur un trajet pouvait être
masquée par la même cause présente sur un autre trajet de la même compagnie.

**v3** : l'inclusion est vérifiée **dans la transformation**, avec la clé complète du scénario.

### Les P1

- **dominance** : une fixture dédiée l'exerce — confirmation portant une cause, puis refus audité,
  et la cause doit s'éteindre. La v2 l'annonçait « vérifiée » avec un compteur à zéro ;
- **G2** : ta formulation littérale — « tout placement `denied` avant H reste `denied` » — est
  **incompatible avec H** : les 147 placements *sont* refusés au statu quo, et les faire passer
  « à confirmer » est exactement son objet. L'invariant juste porte sur le refus **structurel**,
  celui que le moteur produit sans les 42. Il est doublé d'un second contrôle : tout refus levé
  l'est **uniquement** parce que les 42 ont disparu ;
- **`explain`** : l'erreur n'est plus avalée — `rapports_refuses === 0` est une exigence bloquante ;
- **les 42 identités** sont verrouillées en nombre, en unicité et en nature.

## La table de décision — sur `BreedRestriction`

| branche | situation | statut |
|---|---|---|
| **9** | chien non ciblé (non brachycéphale) | **hors périmètre**, statut inchangé |
| **1** | canal structurellement fermé | `denied` |
| **2** | `deny` audité applicable | `denied` |
| **5** | `require` audité applicable | `confirmation_required` (l'exigence est à satisfaire) |
| **3** | `allow` audité applicable | statut général inchangé |
| **4** | aucun fait audité applicable | `confirmation_required` (`breed_policy_unreviewed`) |

`warn` — la recommandation IATA — **n'agit jamais sur le statut ni sur le score** : c'est le cas
fondateur du contrat, et en faire un refus est ce qui a produit la règle globale.

**Aucune précédence n'est appliquée entre `deny`, `require` et `allow`.** `allow` + `deny` est une
CONTRADICTION et `deny` + `require` une situation UNREACHABLE : `validateBreedRestrictions()` les
refuse au **chargement**. Le moteur n'a donc aucune priorité à appliquer — il n'a jamais à trancher
une contradiction, puisqu'elle ne peut pas entrer. Seul `allow` + `require`, que le validateur
autorise, est résolu : l'exigence l'emporte, puisqu'elle dit ce qu'il faut faire pour que
l'autorisation vaille.

Une restriction **conditionnelle** (`when`) demande un évaluateur de prédicat que cette simulation
n'a pas : elle est **signalée et bloquante**, jamais ignorée en silence.

**Le référentiel ne contient aujourd'hui aucune `BreedRestriction`.** Sous H, les 102 compagnies
tombent donc toutes sur « aucun fait audité applicable ». C'est un état de notre documentation, pas
un choix de simulation.

### Les huit fixtures — toutes conformes

branche 1 · branche 2 (`deny`) · branche 3 (`allow`) · branche 4 · branche 5 (`require`) ·
`warn` IATA sans effet sur le statut · `deny` ciblant une autre race · chien non brachycéphale.
Plus la fixture de **dominance**.

## Les anciens P0 de la v1 — pour mémoire

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

**v2** : les 42 sortent **du calcul**. L'avertissement IATA est conservé **à part**.

> La v2 portait alors l'état brachycéphale dans `PlacementPolicy`, et raisonnait sur
> `brachy_allowed = false/true`. **Abandonné dès la v3** : c'était un second modèle à côté de
> `BreedRestriction`, qui existait déjà. La cible est exclusivement `BreedRestriction`. Voir P0-B.

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
| **5 · causes préexistantes conservées** | **0 perdue**, vérifié scénario par scénario dans la transformation |
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
3. ajouter `breed_requirement` à la même union, avec `restriction_ref` — une exigence auditée n'est
   pas une politique non revérifiée, et les confondre reproduirait la perte d'interprétation que
   T0-B a réparée ;
4. la classe de règle qui produit cette confirmation dans `evaluate` — aujourd'hui, seule l'action
   `deny` déplace un statut.

## Ce que cette simulation ne prouve pas

- rien sur le **contrat** : elle le contourne, et c'est la sonde dédiée qui établit le besoin ;
- rien sur la **véracité médicale** du risque brachycéphale ;
- elle n'introduit **aucun seuil de saison ni de température** : « hot season » n'en définit aucun.

## L'artefact

`option-h-simulee.json` — la table de décision, les branches exercées, les fixtures, les sept
garanties, la coexistence des causes, le diff exhaustif et la sonde de contrat.
