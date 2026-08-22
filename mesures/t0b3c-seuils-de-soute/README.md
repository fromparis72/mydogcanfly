# T0-B3-c — les 34 seuils de soute auto-cités, mesurés

**Ce dossier ne corrige rien et ne tranche rien.** Aucune règle n'est retirée, aucun seuil déplacé,
aucun fichier de `packages/` écrit — l'empreinte des fichiers bruts est relue à la fin et comparée à
celle du début. Les retraits sont simulés en mémoire.

```
npm run mesure:t0b3c
```

Base de mesure figée : **`ff692b2d2a446f069c965b5901021150fab44d83`** — SHA complet, jamais abrégé.
Le sceau porte aussi l'**empreinte du moteur** : ces chiffres décrivent ce que le code fait, pas
seulement ce que les données disent. C'est la leçon de T0-B3-b, où deux dossiers ont changé de
chiffres à référentiel identique.

## Le périmètre

**42 règles `hold_weight`, dont 34 auto-citées** — une par compagnie, aucun doublon. Les 8 autres
citent un tiers et restent hors de ce dossier. Toutes refusent ; aucune n'autorise.

T0-B3 les avait nommées comme candidate de premier sous-lot : dominantes 34 sur 34, aucun filet
derrière. Ce dossier confirme la dominance — et trouve deux écarts que la mesure de T0-B3 ne
regardait pas.

## Écart n° 1 — la règle ne mesure pas ce qu'elle dit mesurer

Les 34 rationales portent **la même phrase** :

> « As accompanied baggage **the combined dog + crate** must not exceed about N kg; heavier dogs
> travel via cargo. »

Les 34 conditions, elles, testent `dog.weight_kg > N` — **le chien seul**.

| | mesuré |
|---|---|
| rationales décrivant une limite **chien + caisse** | **34 / 34** |
| conditions ne pesant que **le chien** | **34 / 34** |
| faits de poids disponibles dans le moteur | `dog.weight_kg`, et lui seul |
| poids de caisse dans le référentiel | **aucun** — ni dans `objects.json`, ni au registre des faits |

**Le sens de l'écart est PERMISSIF, et c'est le point.** La limite citée couvre le chien et sa
caisse ; la condition ne pèse que le chien. Le site ouvre donc la soute à des chiens que la limite
citée exclut, d'une marge **exactement égale au poids de la caisse** — une quantité que le
référentiel ne détient pas. Un chien de 30 kg dans une caisse de 8 kg fait 38 kg à l'enregistrement :
la compagnie refuse, le site dit oui.

Ce n'est pas une erreur de saisie répétée 34 fois. Les règles ont été écrites comme si le fait
« poids total » existait ; il n'existe pas. Le contrat du moteur le sait d'ailleurs déjà : la cause
`missing_fact` y est documentée comme « poids total T2 » — un lot prévu, jamais fait.

## Écart n° 2 — six règles ferment le fret en disant que le fret est la solution

| forme | règles |
|---|---|
| ferment la **soute seule** | 28 |
| ferment **soute + fret** | **6** — Air Europa, Air Transat, Alaska, Brussels, TAP, WestJet |

Les six portent la même rationale que les 28 autres, qui se termine par « heavier dogs travel via
cargo ». Elles renvoient donc le voyageur vers un canal qu'elles viennent de fermer. Pour ces
six-là, un seuil faux ne déplace pas le chien vers le fret : **il lui ferme la dernière porte**, et
le texte affiché lui conseille pourtant d'y aller.

## La fiche est muette — la règle est seule à tenir le seuil

**34 fiches sur 34** ne publient aucun `max_weight_kg` pour la soute. Leur politique dit `offered`,
sans limite. Le retrait d'une de ces règles ne révélerait donc **aucune limite de repli**.

## L'effet, lu dans le moteur

Un témoin par compagnie : son premier trajet direct, un chien à `seuil + 1 kg`, puis à `seuil − 1`.
Rien n'est déduit de la forme de la règle — `fired` et les statuts sont lus dans `evaluate()`.

| mesure | valeur |
|---|---|
| témoins constructibles | **34 / 34** |
| mordent sur leur témoin | **34 / 34** |
| dominantes (leur retrait déplace le statut) | **34 / 34** |
| sous le seuil, la soute n'est jamais refusée par elles | 34 / 34 |
| leur retrait déplace le score | 34 |
| statut de la soute **après retrait** | **`allowed` : 34 / 34** |

**Volet public** — 54 scénarios (9 routes × 3 poids × 2 saisons) : **36 soutes déplacées, toutes de
`denied` vers `allowed`**.

## Ce que cette dernière ligne interdit

Le lot brachycéphale s'est retiré vers « à confirmer » : le site cessait d'affirmer un refus sans
prouver une acceptation. **Ici, ce serait l'inverse.** La fiche étant muette, retirer ces 34 règles
publierait `allowed` sur 34 compagnies — une acceptation que rien ne soutient, sur le canal où un
chien voyage en soute.

Les deux gestes n'ont donc rien de comparable, et ce dossier ne propose aucun retrait. Ce qu'il
établit, c'est que **trois options doivent être pesées, pas une** :

1. corriger le seuil pour qu'il mesure ce qu'il dit — impossible sans un fait « poids total », qui
   n'existe ni dans le moteur ni dans le référentiel ;
2. requalifier ces refus en « à confirmer », comme l'a fait T0-B3-a — mais ici le seuil protège
   peut-être un vrai refus, et l'ouvrir en « à confirmer » sur 34 compagnies demande une mesure ;
3. les laisser telles quelles, en assumant par écrit un écart permissif de la taille d'une caisse.

Aucune des trois n'est proposée ici. Elles appellent un arbitrage, et l'arbitrage appelle des
sources — ce que ce dossier ne peut pas fournir : **il n'ouvre aucune page web.**

## Ce que ce dossier NE fait pas

- il ne retire rien, ne corrige aucun seuil, ne touche à aucun fichier de `packages/` ;
- il ne juge pas la véracité des seuils : il mesure ce que le site **affirme**, avec quelle preuve,
  et ce que sa condition **teste** réellement ;
- il ne traite pas les 8 seuils citant un tiers, ni les 40 `cabin_weight`, ni les 12 `placement`,
  ni les 44 `import_rules` — le reste de la dette nommée par T0-B3.

## Les contre-épreuves

Une mesure incapable d'échouer ne mesure rien. Deux invariants distincts, deux contre-épreuves,
chacune devant sortir en **code 1 avec son diagnostic propre** :

| contre-épreuve | invariant cassé | exigences tombées |
|---|---|---|
| `rationale` | les textes ne décrivent plus une limite chien + caisse | 1 |
| `temoin` | le témoin passe **sous** le seuil | 2 |

## L'artefact

`seuils-de-soute.json` — le périmètre, les deux écarts avec leur détail règle par règle, le silence
des fiches, l'effet mesuré dans le moteur et le volet public.
