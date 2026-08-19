# T0-B3-f — ce que les règles affirment, face à leur propre phrase

**Ce lot ne corrige rien.** Aucune règle modifiée, aucun texte réécrit, aucun fichier de
`packages/knowledge/raw/` touché. L'empreinte SHA-256 du référentiel est relue **avant et après** la
mesure et comparée à celle de la base : une mesure qui modifierait ce qu'elle mesure ne mesure rien.

## Reproduction — une seule commande

```
npm run mesure:t0b3f
```

Ni build, ni moteur, ni réseau : ce dossier ne lit que `rules.json`. Il se rejoue en une seconde,
et c'est la raison pour laquelle il peut être rejoué souvent.

**Base de mesure : `adfd06d1341201e029c2220185a484af13948913`**, en dur dans `mesurer.mjs`, jamais
déduite de `HEAD` — un sceau qui change parce qu'on a commité le sceau ne scelle rien.

## La question

Chaque règle porte **deux affirmations sur le même objet** : un `params` que le moteur applique, et
une `rationale` que le lecteur lit. Personne n'avait vérifié qu'elles disent la même chose.

## Trois versions de ce contrôle ont été rejetées, et il faut le dire

Chacune aurait produit une **accusation fausse**. C'est le cœur méthodologique de ce dossier.

| version | ce qu'elle aurait dénoncé | pourquoi elle est fausse |
|---|---|---|
| « le nombre appliqué doit figurer dans la phrase » | 65 règles | `lead_time_days: 60` face à « 1 to 2 months » n'est pas un mensonge : c'est une autre unité |
| « comparons après conversion des unités » | 54 règles | ces phrases portent **plusieurs durées qui ne parlent pas du même objet** — âge de vaccination (12 semaines), attente après titrage (90 jours), validité d'un certificat |
| **retenue** : ne comparer que l'**ouverture** de la phrase | 14 règles | seule la forme « 6 to 7 months. Requirements: … » énonce le même objet que `lead_time_days` |

Les 130 phrases qui n'ouvrent sur aucun délai ne sont **pas** comptées comme conformes : elles sont
**MUETTES** sur ce point. Les blanchir aurait été le faux vert le plus facile de ce dossier.

## Ce qui tient — et c'est la majorité

| contrôle | résultat |
|---|---|
| règles portant une source dont l'URL se résout en un hôte | **407 / 407** |
| revues échues à la date du sceau | **0** |
| règles sans date de revue | **0** |
| seuils de **poids, température, validité, âge** écrits dans la phrase, en anglais **et** en français | **131 / 131** couples |

Le référentiel est donc formellement irréprochable sur sa provenance, et les seuils **directs** —
ceux qu'un lecteur peut vérifier d'un coup d'œil — disent exactement ce que le moteur applique, dans
les deux langues où ils existent. Ce n'est pas un détail : c'est la partie qu'un audit hostile
attaquerait en premier, et elle tient.

## Constat n° 1 — 14 délais divergent, dont **3 dans le sens dangereux**

Sur 183 règles portant un `lead_time_days` : **53** l'énoncent en ouverture de phrase, **39**
concordent, **14** divergent, **130** sont muettes.

Le sens compte davantage que le nombre. Une règle **plus stricte** que sa phrase déroute le lecteur ;
une règle **plus permissive** que sa phrase le fait préparer son voyage **en dessous de ce que le
site lui conseille lui-même**.

**Les trois permissives — le moteur planifie moins que sa propre phrase :**

| règle | le moteur applique | la phrase annonce |
|---|---|---|
| `rule_au_import` (Australie) | 150 j | « 6 to 7 months » = 180–210 j |
| `rule_nz_import` (Nouvelle-Zélande) | 150 j | « 6 to 7 months » = 180–210 j |
| `rule_vn_import` (Viêt Nam) | 21 j | « About 1 month » = 30 j |

L'Australie et la Nouvelle-Zélande sont précisément les destinations où un mois de retard coûte le
voyage : titrage, quarantaine, permis d'importation. Un voyageur qui suit l'outil démarre **un mois
plus tard** que ce que le texte de la même page lui recommande.

**Les onze strictes** — `cn`, `fi`, `ie`, `il`, `ke`, `kr`, `mt`, `no`, `pa`, `ph`, `ua` — vont dans
l'autre sens : l'outil exige davantage que la phrase. Moins grave, mais c'est la même incohérence.

Ce dossier **ne tranche pas** lequel des deux nombres est le bon. Il constate qu'ils diffèrent, et
que l'arbitrage exige de relire la source de chaque pays — travail qui n'est pas mécanisable.

## Constat n° 2 — la phrase publiée n'existe presque pas en espagnol ni en portugais

| langue | règles dont la phrase est traduite |
|---|---|
| français | **407 / 407** |
| espagnol | **48 / 407** (12 %) |
| portugais | **8 / 407** (2 %) |

T0-B3-e avait constaté que le site sert de l'anglais aux lecteurs espagnols et portugais. Ce dossier
en donne la **cause à la source** : le corpus lui-même n'est pas traduit. Même une interface
parfaite ne pourrait rien montrer d'autre. Traduire les 62 guides ne corrige donc **rien** de ce
défaut-ci : ce sont deux corpus distincts.

## Constat n° 3 — 130 règles sur 407 citent le site lui-même

L'auto-citation se lit sur l'**hôte** de l'URL, jamais sur le `source_type` déclaré — le dossier
T0-B3 avait montré que s'y fier surcomptait de 13. Recompté sur le corpus d'aujourd'hui : **130
règles sur 407 (32 %)** pointent `mydogcanfly.com`, réparties sur 85 hôtes distincts au total.

Le chiffre du dossier T0-B3 — 171 sur 449 — décrivait un autre corpus, à une autre base. Les deux
ne se comparent pas terme à terme, et ce dossier ne le prétend pas.

## Les contre-épreuves

Un harnais vert ne prouve rien tant qu'il n'a pas su rougir. Quatre mutations, chacune devant sortir
en **1** avec **son** diagnostic — un échec obtenu pour une autre raison ne prouverait pas que
l'exigence visée porte.

| mutation | ce qu'elle casse | l'exigence qui doit tomber |
|---|---|---|
| `delai` | ajoute « 999 days » en tête d'une phrase | « 39 concordent, 14 divergent » |
| `permissif` | inverse le sens d'une divergence stricte | « le moteur planifie MOINS que sa propre phrase » |
| `traduction` | ajoute une phrase espagnole partout | « en espagnol pour 48 » |
| `source` | vide une URL | « portent une source dont l'URL se résout » |

## Ce que ce dossier ne dit pas

Il ne lit **aucune source externe**. Il ne peut donc pas dire si `150 j` ou `180 j` est le bon chiffre
pour l'Australie — seulement que la règle et sa phrase se contredisent. Confronter chaque règle au
texte réel de l'autorité qu'elle cite suppose un accès réseau et une lecture humaine, et reste à
faire.

Il ne dit rien non plus des 130 règles muettes sur leur délai : une phrase qui n'annonce pas de délai
ne se contredit pas, mais elle n'informe pas non plus.
