# T0-B3-g — Ce que les outils servent, et dans quelle langue

**Base de mesure figée : `6c81edf9f356619694e63694ccf5b5ac4ff9b021`.**
*Base déplacée le 20/08/2026 (de `50188bd`) : la contre-revue a arbitré l'ajout de deux clés
portugaises dans la table scellée par ce dossier. Les chiffres sont recalculés — ils sont ici
inchangés, les deux chaînes traduites appartenant au gabarit des guides, hors de ce périmètre.*
Reproduction : `npm run mesure:t0b3g` — une seconde, sans réseau ni moteur.

**Ce dossier ne corrige rien.** Aucun outil modifié, aucune phrase traduite, aucun fichier de
`packages/` écrit. Les 21 fichiers lus (16 du périmètre, la table portugaise, les 4 tables de
clés) sont comparés au bit près à leur version du commit de base ; la moindre différence fait
échouer la mesure avant qu'elle ne dise quoi que ce soit.

## La question

Le site annonce huit outils. Quatre ne sont lus par **aucun harnais**. Deux choses n'avaient jamais
été vérifiées : lesquels sont des outils qui *calculent*, et dans quelle langue chacun s'adresse
réellement au visiteur.

## Pourquoi la langue se mesure sans interpréter quoi que ce soit

`inlineT` a un contrat écrit dans le code :

```
locale === "fr" ? fr : locale === "es" ? (es ?? en) : table ? table[en] || en : en
```

Deux replis y sont **écrits**, pas devinés : un appel à deux arguments sert l'anglais en espagnol ;
une clé anglaise absente de la table portugaise sert l'anglais en portugais. Le second mécanisme,
`t(locale, clé)`, se replie de la même façon (`TABLES[locale]?.[key] ?? TABLES.en[key]`) — le
mesurer aussi était nécessaire, sans quoi le périmètre n'aurait été couvert qu'à moitié.

Ce dossier ne juge donc rien. Il compte deux conséquences mécaniques du code tel qu'il est.

## Ce que je ne mesure pas, et pourquoi je l'écris

« D'où vient ce chiffre ? » n'est pas automatisable sans accuser à tort : classer un littéral
numérique en « affirmation » confondrait un seuil IATA avec un index de tableau. T0-B3-f a rejeté
trois versions d'un contrôle pour exactement cette raison. **La provenance est donc inventoriée —
les imports du référentiel scellé, fichier par fichier — et non jugée.** 15 des 16 fichiers du
périmètre importent `@mydogcanfly/knowledge` ; le seizième est `Breadcrumb.astro`, qui n'affiche
aucune donnée.

Le gabarit `layouts/Base.astro` est **exclu du périmètre, et l'exclusion est déclarée** : il porte
l'en-tête, la navigation et le pied de page de *toutes* les pages du site. Compter ses phrases ici
attribuerait aux outils la langue du site entier.

## 1. L'état de service des huit routes

| outil | état | au sitemap | lié depuis `/tools/` | sites d'appel | dont anglais en portugais |
|---|---|---|---|---|---|
| `destinations` | servi | oui | oui | 85 | **23** |
| `heat` | servi | oui | oui | 40 | **9** |
| `crate` | servi | oui | oui | 49 | 0 |
| `pet-relief` | servi | oui | oui | 16 | 0 |
| `best-carriers` | **attente** | **oui** | **oui** | 5 | 0 |
| `best-crates` | **attente** | **oui** | **oui** | 5 | 0 |
| `timeline` | retiré (`noindex`) | non | non | 63 | 0 |
| `fiche` | retiré (`noindex`) | non | non | 85 | 0 |

Les 7 sites restants (355 au total) appartiennent à `RelatedTools.astro`, chrome partagé par
plusieurs outils — dont **1 sur l'anglais en portugais**.

**Deux constats, sans recommandation :**

- `best-carriers` et `best-crates` sont des **pages d'attente** — un texte et un bouton, aucun
  composant qui calcule. Elles annoncent toutes deux « classement en préparation ». Elles sont
  pourtant **déclarées au sitemap à priorité 0.8** (le rang des outils) et **liées depuis `/tools/`**
  comme les quatre autres. Un visiteur venu de Google y arrive en croyant trouver un classement.
- `timeline` est un outil **complet** — 63 sites d'appel, un rétro-planning daté, quatre langues —
  délibérément `noindex`, absent du sitemap et non lié depuis `/tools/`. Volontaire ou oublié :
  la question appartient à la contre-revue, pas à la mesure.

## 2. La langue réellement servie

**355 sites d'appel `inlineT` analysés sur 355 repérés dans le texte**, et l'égalité est une
exigence : un site que l'analyseur ne saurait pas lire ferait échouer la mesure au lieu d'être
silencieusement absent.

- **espagnol : 0 site sur l'anglais.** Les 355 appels portent leurs trois arguments.
- **portugais : 33 sites sur l'anglais** — la clé anglaise n'est pas dans `translations/pt/inline.json`.
- **0 traduction identique à l'anglais** dans l'une ou l'autre langue (comptées à part : « IATA »
  se dit IATA partout, ce ne serait pas un repli).
- **`t(locale, clé)` : 22 sites, 8 clés distinctes, aucune incomplète** dans les quatre tables.

**Ce que les 33 chaînes disent au lecteur portugais**, et c'est là que le fait compte :

- les **messages d'erreur** des deux outils interactifs (« The engine didn't answer. », « Please try
  again in a moment. ») ;
- les **messages de validation et de résultat** de `destinations` — « Choose your dog's breed. »,
  « No direct route referenced from this city yet. », « Missing for 100%: » ;
- les **réserves de `heat`** : « This value is a monthly climate average — not the maximum
  temperature, nor the forecast », « MyDogCanFly indicative threshold: amber from {risk} °C, red
  from {emb} °C. », « Some carriers apply a lower threshold… ».

Le dernier point est le plus net : le lecteur portugais reçoit le **résultat** de l'outil chaleur
dans sa langue, et la **réserve qui le qualifie** en anglais. La liste exhaustive des 33, avec
fichier et ligne, est dans `ce-que-les-outils-servent.json`.

## 3. Les contre-épreuves

Quatre, chacune chirurgicale : elle déplace **un seul** site ou une seule route, de façon à ne faire
tomber que l'exigence visée. Chacune doit sortir en 1 **avec son diagnostic propre** — un échec
obtenu pour une autre raison ne prouverait pas que l'exigence porte.

| code | ce qu'elle casse | ce qui doit tomber |
|---|---|---|
| `service` | une page d'attente devient un outil servi | « 4 outils servis, 2 pages d'attente » |
| `es` | un site bascule sur l'anglais en espagnol | « aucun site ne sert l'anglais en espagnol » |
| `pt` | une clé manquante est ajoutée à la table | « l'inventaire portugais est celui du sceau » |
| `residu` | un site d'appel est retiré de l'analyse | « classée dans exactement un état » |

`residu` en fait tomber **deux**, et c'est honnête : perdre un site change nécessairement
l'inventaire. Les trois autres n'en font tomber qu'une.

## Ce qui attend un arbitrage

1. **Les deux pages d'attente au sitemap.** Les retirer du sitemap jusqu'à publication, les
   dépublier, ou les laisser ? C'est une décision éditoriale.
2. **`timeline`.** Outil complet, invisible. Fini et oublié, ou volontairement retenu ?
3. **Les 33 chaînes portugaises.** Les traduire est un travail de données (une table, pas du code) —
   mais les réserves de sécurité de `heat` ne sont pas une phrase d'ornement.
4. **Les quatre outils sans harnais** — `crate`, `pet-relief`, `best-carriers`, `best-crates`. Ce
   dossier les mesure ; il ne les surveille pas.
