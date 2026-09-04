# Dossier pour la reprise de la contre-revue

**État :** branche `claude/passation-t0-b2-xgrvye`, arbre propre, `test:unit` vert (code 0).
**Période couverte :** du 04/09/2026 au retour de Codex.
**Rien n'a été fusionné, déployé, promu, ni soumis à Search Console.** Aucune PR ouverte.

Ce dossier est écrit pour être lu d'un bout à l'autre par quelqu'un qui n'a pas suivi. Il dit ce
qui a été fait, ce que j'ai eu faux, ce qui reste à trancher, et ce dont j'ai besoin.

---

## 1. Les trois P0 de la contre-revue sont fermés

### P0-1 — l'appariement ne regardait ni l'action ni la portée

Contre-revue confirmée, et **elle était en dessous de la vérité**.

J'ai reproduit le chiffre exactement : **32 politiques `offered` adossées uniquement à des règles
`deny`**. Puis j'ai mesuré le fait qui tranche : **les 208 règles de portée compagnie sont TOUTES
des `deny`**. Aucune règle de ce jeu de données ne peut soutenir une acceptation — pas
« rarement » : jamais, structurellement. La moitié `offered` de mes 60 était impossible par
construction.

Le chiffre de 60 est **retiré**. `mesures/politiques-veracite/classer.mjs` continue de le calculer
mais l'imprime désormais sous un bandeau « RÉFUTÉ », avec sa cause — la mesure fautive n'est pas
effacée, elle est nommée.

L'appariement correct vit dans **`mesures/politiques-veracite/qualifier.mjs`**, qui rend les trois
ensembles demandés et refuse d'injecter quoi que ce soit en cas d'ambiguïté.

### P0-2 — `corroborated` était un nom faux

Accepté sans réserve. Une URL unique assortie d'une note d'historique ne corrobore rien.

La cause s'appelle **`official_source_unquoted`**, quatrième valeur de l'énumération EXISTANTE
`status_cause` (`packages/knowledge/src/objects.ts`). Libellés publiés dans les quatre langues :

| | |
|---|---|
| fr | Une page officielle de la compagnie est rattachée à ce canal, mais nous n'en avons pas encore cité de phrase — lis-y les conditions et confirme-les auprès de la compagnie. |
| en | An official airline page is linked to this channel, but we have not yet quoted a sentence from it — read the conditions there and confirm them with the airline. |
| es | Una página oficial de la aerolínea está vinculada a este canal, pero aún no hemos citado ninguna frase de ella: consulta allí las condiciones y confírmalas con la aerolínea. |
| pt | Uma página oficial da companhia está associada a este canal, mas ainda não citámos nenhuma frase dela — leia lá as condições e confirme-as com a companhia. |

### P0-3 — `preuveAuditee` refuse la page non citée

Accepté, et ma proposition était mauvaise : lui faire rendre une URL dont aucune phrase n'a été lue,
c'était renommer le fait sans le changer. Tous ses appelants, moteur compris, l'auraient prise pour
une preuve.

`preuveAuditee` retourne `null` sur `official_source_unquoted`. Un résolveur distinct,
**`sourceAffichable`** (`packages/knowledge/src/preuve.ts`), au contrat plus faible et au nom qui le
dit, rend le lien à l'écran — sans bouclier, sans « vérifié le… », sans indice de confiance.

---

## 2. Ce que le correctif donne, sans qu'une seule donnée ait été écrite

Le point d'application est **`projectPlacementPolicy`** (`objects.ts:290`), le seul passage entre la
donnée et l'écran : la fiche compagnie comme les cartes du Finder le traversent. Une disponibilité
n'y produit plus de verdict qu'accompagnée d'une phrase citée, de sa langue et de son emplacement.

Sur la base réelle :

| | |
|---|---|
| blocs de politique | 302 |
| `allowed` | **0** |
| `denied` | **0** |
| `confirmation_required` | **302** |
| … dont `official_source_unquoted` (une page à montrer) | **33** |
| … dont `legacy_unreviewed` (rien à montrer) | **267** |
| … `policy_unpublished` (Thai fret) / `airline_approval` (Virgin cabine) | 1 / 1 |

**La passe d'écriture que j'avais chiffrée est devenue inutile** : les 33 liens étaient déjà dans la
base (11 compagnies × 3 canaux — Air France, BA, Lufthansa, Delta, United, AA, KLM, Turkish, Air
Canada, Iberia, WestJet). Rien n'a été injecté dans une fiche.

Vérifié sur le DOM construit : **1 184 blocs de canal** relus sur 408 pages (102 fiches × 4 langues),
aucun `allowed`, aucun `denied`, la réserve dite dans la langue de chaque page. La non-vacuité est
vérifiée AVANT la conclusion — « aucun canal n'est autorisé » serait vrai aussi d'un lecteur qui ne
reconnaît aucun canal.

**Aucun modèle nouveau.** `T0bAuditSource` est déjà `SourcedQuote` + locator obligatoire ;
`PolicySource` porte déjà `quote` en option ; `legacy_unreviewed` existait et était déjà rendu.

Deux registres retapés ont en revanche été ramenés à une définition unique, **parce qu'ils venaient
de diverger** : les types de source factuels et l'auto-citation (recopiés dans
`breed-restrictions.ts`, descendus dans `common.ts`), et les causes de confirmation — retapées dans
le contrat du moteur, où l'ajout de la quatrième cause a fait **répondre HTTP 400 au Finder**. Elles
sont désormais engendrées depuis `PLACEMENT_STATUS_CAUSES`.

---

## 3. LES CINQ ARBITRAGES EN ATTENTE — c'est la partie qui compte

Ce sont **cinq faces d'une seule question** : combien montrer d'une donnée non prouvée ? Elles
gagnent à être tranchées ensemble.

### 3.1 — Les listes « meilleures compagnies » des fiches de race sont VIDES

`bestAirlines` exclut les politiques à confirmer, par **l'arbitrage du 29/08** : « elle n'est ni un
oui, ni un non ». Comme plus rien n'est `allowed`, la liste est vide sur **les 172 races, dans les
quatre langues**.

La page ne ment pas : la branche vide rend « Aucune compagnie compatible n'est actuellement établie
dans les données vérifiées ». Elle est honnête, et pauvre.

Rouvrir l'arbitrage du 29/08 pour y faire entrer les « à confirmer » est une décision de produit.
Je ne l'ai pas prise. L'état réel est figé dans une contre-épreuve (`test-faq-races.mjs`, contrôle
1 bis) qui dit « 0 race sur 172, arbitrage en attente » et rougira dans un sens comme dans l'autre.

### 3.2 — `offers_pet_transport` est désormais VRAI pour toutes les compagnies

Il vaut « ≥ 1 canal `allowed` OU `confirmation_required` ». Ryanair, Batik Air et les autres refus
documentés passent de « ne transporte pas d'animaux » à « à confirmer ».

C'est l'envers exact du critère : on ne ment plus par excès de certitude, on risque de mentir par
excès d'espoir. Une troisième valeur — « on ne sait pas » — serait peut-être la réponse, mais elle
touche un champ que le contrat expose et que plusieurs écrans lisent.

### 3.3 — Le score du rapport tombe de 76 à 10

Mesuré sur la **même route et les mêmes 22 cartes** (CDG → JFK, chien de 4 kg) :

| | score | compagnies acceptantes |
|---|---|---|
| données réelles | **10** | 0 |
| données citées (fixture) | **76** | 20 |

Le Finder affiche « Yes — with conditions » à côté de « 9 % » : le titre promet, le chiffre
décourage, et les deux se contredisent à l'œil. Figé dans `test-apercu-navigateur.mjs`.

### 3.4 — Le VERDICT de tête des fiches est encore éditorial

Chaque fiche compagnie porte, au-dessus de tout, une pastille colorée **écrite à la main dans le
YAML** : « ★ Easy » en vert, « ★ Hard » ou « ★ No pets » en rouge. Elle ne descend PAS du bloc
`policies:`.

Mesuré sur les 102 fiches construites : **8 vertes, 29 rouges, 65 prudentes — et ZÉRO canal décidé
sous aucune d'elles.** La fiche Aegean affiche « ★ Easy » en vert au-dessus de trois canaux « à
confirmer » ; Aer Lingus affiche « ★ Hard » en rouge au-dessus de trois canaux dont aucun n'est
refusé.

C'est exactement la faute que `decisionCanal.ts` a fermée un niveau plus bas — « une couleur de
pastille et une étiquette écrites à la main [qui] contredisent la décision canonique » — mais elle
n'a jamais été fermée à l'étage du verdict de fiche.

**Je ne l'ai pas corrigé, et voici pourquoi la différence avec l'auto-citation (§ 3 bis) est
réelle :** l'auto-citation contredisait un arbitrage RENDU et explicitement étendu à « la liste de
sources d'un rapport » — c'était un bogue. Le bloc `verdict:` n'a jamais été arbitré, et c'est
l'élément éditorial principal de la fiche. Le trancher est une décision de produit.

Trois options, si cela aide : dériver la COULEUR des décisions canoniques en gardant le libellé ;
n'afficher le verdict que lorsqu'au moins un canal est décidé ; ou le laisser tel quel en assumant
la contradiction. Le compte est figé dans une contre-épreuve et rougira dans un sens comme dans
l'autre.

### 3.5 — Les citations de l'étape B

Rien n'avance sans elles. **Je ne reconstruirai jamais une citation à partir d'un résumé**, et mon
conteneur n'a pas d'accès réseau ouvert. Pour chaque canal à remonter en `verified_official`, il me
faut : l'URL, la phrase exacte, sa langue, son emplacement dans la page, la date de lecture.
Écriture + contre-épreuve : environ 10 minutes par canal de mon côté.

Priorité proposée, inchangée : les 16 canaux orphelins, puis les compagnies principales devenues
entièrement « à confirmer » (liste des 51 dans `rapport-frontiere-confiance.txt`).

---

## 3 bis. UNE FAUTE TROUVÉE APRÈS COUP, ET CORRIGÉE — le site se citait lui-même

**C'est la trouvaille la plus sérieuse depuis le début du lot, et elle était EN LIGNE.**

Sur un CDG → Almaty, le rapport servait **une seule source**, et c'était
`https://mydogcanfly.com/dog-travel-requirements-by-country/` — notre propre page — donnée comme
fondement des **exigences légales d'entrée au Kazakhstan**, en criticité `high`.

**44 règles d'entrée pays** citent cette page ; trois d'entre elles sont en criticité `critical`.
Le balayage complet en a trouvé **128 au total** : 84 de portée compagnie, 44 de portée pays —
exactement la répartition que la contre-revue avait chiffrée (84 `deny` + 44 `require`, 52 URL).

### Pourquoi ce n'était pas une décision à arbitrer

`preuve.ts` interdit l'auto-citation depuis le 15/08/2026, et son en-tête dit que la règle vaut
« partout où une source justifie une décision — fiche compagnie, carte du Finder, **liste de sources
d'un rapport** ». Le chemin des exigences pays ne l'appliquait simplement pas : `toFired` recopiait
`r.source.url` tel quel. C'est un **bogue contre un arbitrage déjà rendu**, pas une décision
nouvelle — je l'ai donc corrigé, en le nommant.

### Pourquoi la contre-épreuve existante ne l'avait pas vu

Elle vérifie qu'aucune auto-citation ne subsiste dans les **72 scénarios figés**, et aucun de ces
72 ne va vers l'un de ces 44 pays. **Le contrôle était juste ; son échantillon ne mordait pas là.**
C'est la même famille de faute que les trois faux zéros de l'instrument IATA : un contrôle qui ne
parle que de ce qu'il regarde.

La nouvelle contre-épreuve (`test-frontiere-confiance.mjs`, § 11 bis) ne prend **pas d'échantillon** :
elle balaie toutes les règles du dépôt, puis éprouve **chaque destination réelle** de ces 44 pays —
19 aéroports — et exige qu'aucune auto-citation n'atteigne ni les sources du rapport ni les
conditions.

### Ce qui est corrigé, et ce qui ne l'est pas

L'exigence elle-même **reste affichée** : elle est peut-être juste, et la retirer serait une
décision de contenu. Ce qui disparaît est le seul mensonge présent — la prétention qu'une page à
nous la fonde. Une exigence sans source est plus honnête qu'une exigence adossée à soi-même.
`f.source_url` reste intact dans `fired` : l'audit doit continuer de voir d'où vient la règle.

### Une dette plus petite, NON corrigée, signalée

Les 84 règles compagnie auto-citées ne sont jamais présentées — `fired` ne quitte pas le moteur.
Mais elles alimentent `confidences`, donc **l'indice de confiance affiché au visiteur**. Notre
propre page contribue ainsi à la note de confiance. Je n'y touche pas : modifier le calcul du score
est une décision de produit, et le score est déjà en attente d'arbitrage (§ 3.3).

**Question pour la contre-revue :** les 44 exigences pays « Baseline: most destinations require ISO
microchip… », en criticité `high` pour 46 d'entre elles et `critical` pour 3, doivent-elles rester
publiées maintenant qu'elles n'ont plus aucune source ? Elles sont génériques et probablement
justes ; elles ne sont plus adossées à rien.

---

## 3 ter. L'état de preuve du côté PAYS, mesuré pour préparer votre retour

Jamais mesuré jusqu'ici. Le voici, pour que la vérification prioritaire puisse démarrer sans phase
d'inventaire.

| | |
|---|---|
| règles de portée pays | 189 (pour **140 fiches**) |
| sources gouvernementales | 137 |
| sources de type `other` | 52 — dont **44 auto-citations** |
| portant une citation verbatim | **0** |
| portant un locator | **0** |
| action `require` / `deny` | 183 / **6** |

**Les 6 refus catégoriques pays sont les faits les mieux sourcés du dépôt.** Ce sont six
interdictions de race, toutes gouvernementales, chacune citant son instrument légal : Dangerous Dogs
Act 1991 (GB), Hundeverbringungs- und -einfuhrbeschränkungsgesetz (DE), loi sur les chiens de
catégorie 1 (FR), Control of Dogs (XL Bully) Regulations 2024 (IE), Dog Control Act 1996 (NZ),
Customs (Prohibited Imports) Regulations 1956 (AU). **Elles ne devraient PAS être rétrogradées à
l'aveugle** : leur `rationale` nomme la loi, il ne leur manque que le champ `quote`.

Différence de nature avec le côté compagnie : une exigence `require` fausse fait faire des démarches
inutiles ; un `deny` faux bloque à tort. Les 183 `require` sont donc moins dangereux que les 216
verdicts compagnie l'étaient — mais 44 d'entre eux n'avaient, jusqu'à aujourd'hui, que nous-mêmes
pour source.

---

## 4. DEUX DIVERGENCES DE MESURE NON RÉSOLUES

Je ne les ai pas ajustées pour tomber sur les chiffres de la contre-revue : **fitter une définition
à un nombre, c'est fabriquer un accord**. Il faut le prédicat exact.

| | ma mesure | contre-revue |
|---|---|---|
| ensemble 1 (refus global + `deny` exclusif au canal + source officielle) | **34** | 14 |
| refus globaux adossés à une restriction UK seule | **12** | 15 |

Lectures essayées sans reproduire 14 : historique non réduit à « Initial import » (→ 30),
`effect.placement` ne visant qu'un canal (→ 27), les deux combinées (→ 25).

**Ce désaccord ne bloque rien** : l'ensemble 1 donne un LIEN, jamais un verdict. Aucun comportement
n'en dépend. J'ai besoin du prédicat pour converger, pas pour avancer.

---

## 5. Ce qui a été livré par ailleurs

**Les « Vérifié le… » sont partis.** 102 fiches l'affirmaient, cochées en vert, sans rien derrière.
Seul le VERBE change : la date reste, le nombre de sources reste, la coche devient un calendrier, la
pastille perd son vert. `verified_date:` — structurel, il porte la cadence de 90 jours — n'est pas
touché. Outil rejouable et idempotent.

**La porte de lancement** (`porte-lancement.mjs`) : les dix contrôles demandés, tous hors ligne sur
le `dist`. **24/24 verts sur l'artefact de production.** `test-porte-lancement.mjs` lui inflige
**quatorze fautes une à une** sur un dist synthétique — elle mord aux quatorze, sur le bon contrôle,
avec un témoin négatif. `porte-noindex-admis.json` déclare les 585 pages légitimement fermées (564
fiches aéroport + outils internes), chacune avec sa raison.

**Le pré-vol du jour 7** (`preflight-production.mjs`) **ne déploie rien**, délibérément : ni
`wrangler`, ni `git push`, ni Search Console. Il vérifie ce qui est vérifiable ici, puis imprime les
dix contrôles en ligne avec leurs commandes et la réponse attendue.

**La journée 5, au navigateur** : Chromium pilote le `dist` de production servi en local avec le
VRAI Worker (`apercu-local.mjs`). 39 contrôles, 0 échec, huit captures. Les huit points sont
couverts, témoin négatif compris pour la race brachycéphale.

---

## 6. Mes erreurs, nommées

Elles sont toutes consignées dans le code, pas seulement ici.

1. **J'ai mesuré la mauvaise surface.** Mon premier rapport comptait les verdicts sur
   `channels[].cls`, la pastille éditoriale. L'écran ne lit plus ce champ depuis T0-B2 : il lit
   `premium.policy[canal]`. 209 (faux) → **216** (vrai).
2. **« 189 fiches pays »** — c'étaient 189 RÈGLES de portée pays ; il y a **140 fiches**.
3. **Les 60 corroborés n'existaient pas** (§ 1).
4. **`preuveAuditee`** : je voulais lui faire rendre une page non citée (§ 1).
5. **La porte de lancement m'a accusé à tort quatre fois, et c'était elle** : tous les nœuds JSON-LD
   comparés au titre (6 149 fausses discordances — le nœud `Organization` s'appelle « MyDogCanFly »),
   les cibles à ancre et à joker non résolues, l'extension `.zip` non admise (trois archives de
   presse pourtant présentes), et les `<a>` écrits dans un gabarit JavaScript pris pour des liens
   morts.
6. **Les montants des fiches pays ne sont pas des tarifs** : 15 000 € est l'amende de l'article
   L211-15 du Code rural, 6 400 € une amende estonienne, 42,25 € une taxe vétérinaire portugaise.
   Des faits juridiques sourcés. Le micro-lot Tarifs visait les tarifs de TRANSPORT.
7. **Mon relevé tronquait ce qu'il mesurait** : il rapportait « €1 » là où la page dit « €15,000 ».
8. **Le harnais navigateur testait un carlin de 87 kg.** Choisir une race remplit le poids
   automatiquement ; mon « 7 » s'ajoutait au « 8 » du gabarit. Tous les contrôles passaient, sur un
   autre chien que celui annoncé. **Je ne l'ai pas trouvé en relisant le code — je l'ai vu sur une
   capture d'écran.**

---

## 7. Les comptes figés qui ont bougé, et pourquoi

Aucun n'a été déplacé en silence.

| compte | avant | après | cause |
|---|---|---|---|
| répartition runtime | 142 allowed · 74 denied · 86 à confirmer | 0 · 0 · 302 | frontière de confiance |
| causes | 84 `legacy_unreviewed` | 267 + 33 `official_source_unquoted` | idem |
| bascules Finder (72 scénarios) | — | **1 948**, toutes vers « à confirmer » | idem |
| confirmations carlin CDG→IST | 25, toutes de race | 44 — toutes de provenance, 27 aussi de race | les causes s'accumulent |
| causes de race sur données réelles | 280 | 298 | des canaux fermés en dur laissent la cause s'exprimer |

Une preuve permanente encadre le lot par deux baselines figées et établit ce qu'il a le droit de
faire : **aucune bascule vers `allowed`, aucune vers `denied`** — ni acceptation ni refus fabriqués.

Le témoin de transition `carries_pets` est constaté **inatteignable**, avec sa cause : l'ancien
calcul exigeait `allowed === true`, ce que la frontière rend impossible. Il rougira le jour où une
politique redeviendra `allowed`.

---

## 8. Ce que je demande

1. **Les cinq arbitrages du § 3**, tranchés ensemble.
2. **Le prédicat exact de l'ensemble 1** (§ 4), pour converger sur 14 ou 34.
3. **Les citations de l'étape B**, au format : URL, phrase exacte, langue, emplacement, date.

Rien d'autre. Le mécanisme est en place et vert ; ce qui manque est du jugement et des preuves.

---

## 9. Où regarder

| | |
|---|---|
| mesure d'impact rejouable | `node mesures/politiques-veracite/classer.mjs` |
| appariement des règles | `mesures/politiques-veracite/qualifier.mjs` |
| contre-épreuves de la frontière | `npx tsx test-frontiere-confiance.mjs [--dist=packages/ui/dist]` |
| porte de lancement | `node porte-lancement.mjs` · attaques : `node test-porte-lancement.mjs` |
| pré-vol de production | `node preflight-production.mjs` |
| vérification navigateur | `PLAYWRIGHT=… npx tsx test-apercu-navigateur.mjs` |
| rapport d'impact initial | `mesures/politiques-veracite/rapport-frontiere-confiance.txt` |
