# Frontière de confiance — dossier complet pour la contre-revue

**Branche** `claude/passation-t0-b2-xgrvye` · **SHA** `e3f046a` · arbre propre
**`test:unit` vert (code 0)** · aucune PR, aucune fusion, aucun déploiement, aucun alias Cloudflare
touché, aucune soumission Search Console.

Ce document remplace les envois précédents. Il est écrit pour être lu d'un bout à l'autre par
quelqu'un qui n'a pas suivi, et chaque chiffre qu'il avance est rejouable par une commande donnée
au § 10.

---

## 1. Les trois P0 sont fermés, et le premier me donne tort

### P0-1 — l'appariement ne regardait ni l'action ni la portée

**Confirmé, et la contre-revue était en dessous de la vérité.** J'ai reproduit son chiffre
exactement : **32 politiques `offered` adossées uniquement à des règles `deny`**. Puis j'ai mesuré
le fait qui tranche :

> **Les 208 règles de portée compagnie sont TOUTES des `deny`.**

Aucune règle de ce jeu ne peut soutenir une acceptation — pas « rarement » : jamais,
structurellement. La moitié `offered` de mes 60 était impossible par construction.

Le chiffre de 60 est **retiré**. `classer.mjs` continue de le calculer mais l'imprime sous un
bandeau « RÉFUTÉ » portant sa cause : une mesure rejouable qui garde en tête un chiffre démenti
finit par le voir recopié ailleurs.

L'appariement correct vit dans **`mesures/politiques-veracite/qualifier.mjs`** et rend les trois
ensembles demandés.

### P0-2 — `corroborated` était un nom faux

Accepté sans réserve. La cause s'appelle **`official_source_unquoted`**, quatrième valeur de
l'énumération **existante** `status_cause`. Libellés publiés :

| | |
|---|---|
| fr | Une page officielle de la compagnie est rattachée à ce canal, mais nous n'en avons pas encore cité de phrase — lis-y les conditions et confirme-les auprès de la compagnie. |
| en | An official airline page is linked to this channel, but we have not yet quoted a sentence from it — read the conditions there and confirm them with the airline. |
| es | Una página oficial de la aerolínea está vinculada a este canal, pero aún no hemos citado ninguna frase de ella: consulta allí las condiciones y confírmalas con la aerolínea. |
| pt | Uma página oficial da companhia está associada a este canal, mas ainda não citámos nenhuma frase dela — leia lá as condições e confirme-as com a companhia. |

### P0-3 — `preuveAuditee` refuse la page non citée

Accepté, et ma proposition était mauvaise : lui faire rendre une URL dont aucune phrase n'a été lue,
c'était renommer le fait sans le changer.

`preuveAuditee` retourne `null` sur `official_source_unquoted`. Un résolveur distinct,
**`sourceAffichable`**, rend le lien à l'écran — **sans bouclier, sans « vérifié le… », sans indice
de confiance** : les trois signes qui disent « nous avons lu », et personne n'a lu.

### Les neuf conditions d'appariement, vérifiées une par une

Chacune est une contre-épreuve exécutable, pas une intention :

| condition posée | état |
|---|---|
| même compagnie, même canal | ✓ |
| source officielle non auto-citée | ✓ |
| portée compatible avec ce qu'on affiche | ✓ |
| aucune sélection arbitraire si plusieurs URL | ✓ — « ambigu : 2 URL différentes, aucune n'est choisie » |
| règle limitée au Royaume-Uni reste dans sa portée | ✓ — ensemble 2, aucune source injectée |
| règle de dépassement de poids ne prouve pas l'acceptation | ✓ |
| … ni un refus global du canal | ✓ |
| un `deny` ne soutient jamais `offered` | ✓ |
| refus global + `deny` exclusif au canal → qualifié | ✓ |

---

## 2. Ce que le correctif donne — sans qu'une seule donnée ait été écrite

Point d'application : **`projectPlacementPolicy`** (`objects.ts`), le seul passage entre la donnée
et l'écran — la fiche compagnie comme les cartes du Finder le traversent.

| | |
|---|---|
| blocs de politique | 302 |
| `allowed` | **0** |
| `denied` | **0** |
| `confirmation_required` | **302** |
| … `official_source_unquoted` (une page à montrer) | **33** |
| … `legacy_unreviewed` (rien à montrer) | **267** |
| … `policy_unpublished` / `airline_approval` | 1 / 1 |

**La passe d'écriture que j'avais chiffrée est devenue inutile** : les 33 liens étaient déjà dans la
base (11 compagnies × 3 canaux — Air France, BA, Lufthansa, Delta, United, AA, KLM, Turkish, Air
Canada, Iberia, WestJet). **Rien n'a été injecté dans une fiche.**

Vérifié sur le DOM construit : **1 184 blocs de canal** relus sur 408 pages, aucun `allowed`, aucun
`denied`, la réserve dite dans la langue de chaque page. La non-vacuité est vérifiée AVANT la
conclusion — « aucun canal n'est autorisé » serait vrai aussi d'un lecteur qui n'en reconnaît aucun.

**Aucun modèle nouveau.** Deux registres retapés ont en revanche été ramenés à une définition
unique **parce qu'ils venaient de diverger** : les types de source factuels et l'auto-citation
(descendus dans `common.ts`), et les causes de confirmation — retapées dans le contrat du moteur, où
l'ajout de la quatrième cause a fait **répondre HTTP 400 au Finder**.

---

## 3. UNE FAUTE TROUVÉE APRÈS COUP, ET CORRIGÉE — le site se citait lui-même

**C'est la trouvaille la plus sérieuse du lot, et elle était EN LIGNE.**

Sur un CDG → Almaty, le rapport servait **une seule source** :
`https://mydogcanfly.com/dog-travel-requirements-by-country/` — notre propre page — donnée comme
fondement des **exigences légales d'entrée au Kazakhstan**, en criticité `high`.

**44 règles d'entrée pays** citent cette page, dont trois en `critical`. Le balayage complet en
trouve **128** : 84 de portée compagnie, 44 de portée pays — exactement la répartition que la
contre-revue avait chiffrée (84 `deny` + 44 `require`, 52 URL).

**Pourquoi ce n'était pas une décision à arbitrer.** `preuve.ts` interdit l'auto-citation depuis le
15/08/2026, et son en-tête dit que la règle vaut « partout où une source justifie une décision —
fiche compagnie, carte du Finder, **liste de sources d'un rapport** ». Le chemin pays ne l'appliquait
pas : `toFired` recopiait l'URL telle quelle. **Bogue contre un arbitrage rendu**, pas décision
nouvelle. Corrigé, et nommé.

**Pourquoi la contre-épreuve existante ne l'avait pas vu.** Elle vérifie les **72 scénarios figés**,
dont aucun ne va vers ces 44 pays. *Le contrôle était juste ; son échantillon ne mordait pas là.*
La nouvelle ne prend aucun échantillon : elle balaie toutes les règles, puis éprouve **les 19
destinations réelles** de ces pays, une par une.

**Ce qui n'est pas corrigé.** L'exigence reste **affichée** — elle est peut-être juste, et la retirer
serait une décision de contenu. Ce qui disparaît est le seul mensonge présent. `source_url` reste
intact dans `fired` : l'audit doit continuer de voir d'où vient la règle.

**Une dette plus petite, signalée et non corrigée :** les 84 règles compagnie auto-citées ne sont
jamais présentées, mais elles alimentent `confidences`, donc **l'indice de confiance affiché**.
Notre propre page contribue à notre propre note. Modifier le calcul du score est une décision de
produit — et le score est déjà en arbitrage (§ 4.3).

---

## 4. LES SIX ARBITRAGES EN ATTENTE

Six faces d'une seule question : **combien montrer d'une donnée non prouvée ?** Elles gagnent à être
tranchées ensemble.

### 4.1 — Les listes « meilleures compagnies » des fiches de race sont VIDES

`bestAirlines` exclut les politiques à confirmer, par l'arbitrage du 29/08 (« elle n'est ni un oui,
ni un non »). Plus rien n'étant `allowed`, la liste est vide sur **les 172 races, en quatre langues**.

La page ne ment pas : elle rend « Aucune compagnie compatible n'est actuellement établie dans les
données vérifiées ». Elle est honnête, et pauvre. Rouvrir l'arbitrage du 29/08 est une décision de
produit. L'état réel est figé (`test-faq-races.mjs`, contrôle 1 bis).

### 4.2 — `offers_pet_transport` est désormais VRAI pour toutes les compagnies

Il vaut « ≥ 1 canal `allowed` OU `confirmation_required` ». Ryanair, Batik Air et les autres refus
documentés passent de « ne transporte pas d'animaux » à « à confirmer ». **L'envers exact du
critère** : on ne ment plus par excès de certitude, on risque de mentir par excès d'espoir.

### 4.3 — Le score du rapport tombe de 76 à 10

Même route, mêmes 22 cartes (CDG → JFK, chien de 4 kg) :

| | score | compagnies acceptantes |
|---|---|---|
| données réelles | **10** | 0 |
| données citées (fixture) | **76** | 20 |

Le Finder affiche « Yes — with conditions » à côté de « 9 % » : le titre promet, le chiffre
décourage.

### 4.4 — Le VERDICT de tête des fiches est encore éditorial

Chaque fiche porte au-dessus de tout une pastille **écrite à la main dans le YAML** : « ★ Easy » en
vert, « ★ Hard » ou « ★ No pets » en rouge. Elle ne descend pas de `policies:`.

Mesuré sur les 102 fiches : **8 vertes, 29 rouges, 65 prudentes — et ZÉRO canal décidé sous aucune.**
Aegean affiche « ★ Easy » en vert au-dessus de trois canaux « à confirmer ». **19 des 102 notes**
sous le verdict le disent aussi en prose (« Cabin and hold are both open »).

C'est la faute que `decisionCanal.ts` a fermée un niveau plus bas, jamais fermée à cet étage-ci.
**Je ne l'ai pas corrigée** : contrairement à l'auto-citation, le bloc `verdict:` n'a jamais été
arbitré et c'est l'élément éditorial principal de la fiche.

*Trois options, si cela aide :* dériver la COULEUR des décisions en gardant le libellé ; n'afficher
le verdict que si un canal est décidé ; l'assumer tel quel.

**Une accusation que je retire :** 17 notes parlent de « clear published fees ». J'y ai d'abord vu
une promesse que le site ne tient plus. En les relisant, elles décrivent **la compagnie**, pas notre
page. Ce n'est pas un mensonge — une incohérence de lecture. Constat, pas défaut.

### 4.5 — Les fiches annoncent des sources qu'elles ne montrent pas

**95 fiches** affichent, sous un bouclier « 🛡️ Source officielle », « 4 sources Aegean · relevées le
8 août 2026 ». Le visiteur n'en reçoit **aucune** : le seul lien sortant est la page d'accueil. Et le
compte n'est adossé à rien — le dépôt porte 2 URL pour Aegean, dont une auto-citation, donc **une**
source officielle pour un chiffre annoncé de 4. Sur 95 fiches, **80 annoncent plus que ce que le
dépôt contient**.

**Non réécrit, prudence assumée** : retirer le nombre demande de refaire l'amorce en quatre langues
— « 1 source Aircalin » → « Source Aircalin », avec singulier, pluriel, article et genre. C'est
exactement la manœuvre qui, en août, a produit des phrases fausses dans 302 fichiers. À une semaine
du lancement, le risque dépasse le gain.

**Ce que j'ai corrigé, parce que c'était ma faute :** mon remplacement des « dernière vérification »
avait créé « 4 Aegean sources · **sources** collected… ». 408 redondances réparées par suppression
stricte du nom en trop. *La différence décide de tout : supprimer un mot ne peut pas casser une
phrase, refaire une amorce si.*

### 4.6 — Les citations de l'étape B

Rien n'avance sans elles. **Je ne reconstruirai jamais une citation à partir d'un résumé**, et mon
conteneur n'a pas d'accès réseau ouvert. Il me faut, par canal : URL, phrase exacte, langue,
emplacement dans la page, date de lecture. Écriture + contre-épreuve : ~10 minutes par canal.

---

## 5. LES DEUX DIVERGENCES DE MESURE

Je ne les ai pas ajustées pour tomber sur les chiffres de la contre-revue : **fitter une définition
à un nombre, c'est fabriquer un accord.**

| | ma mesure | contre-revue |
|---|---|---|
| ensemble 1 (refus global + `deny` exclusif au canal + source officielle) | **34** | 14 |
| refus globaux adossés à une restriction UK seule | **12** | 15 |

Lectures essayées sans reproduire 14 : historique non réduit à « Initial import » (→ 30) ;
`effect.placement` ne visant qu'un canal (→ 27) ; les deux combinées (→ 25).

**Ce désaccord ne bloque rien** : l'ensemble 1 donne un LIEN, jamais un verdict. Aucun comportement
n'en dépend. J'attends le prédicat canonique annoncé.

---

## 6. Le côté PAYS est bien meilleur que les règles ne le laissent croire

**Correction importante.** Mesurer les 189 **règles** pays donne une image sombre — 0 citation,
0 locator, 44 auto-citations. Mesurer les 140 **fiches**, ce que les pages rendent réellement, donne
l'inverse :

| | |
|---|---|
| fiches pays | **140** (et non 189 — vocabulaire corrigé) |
| fiches pourvues de sources | **140 / 140** |
| sources libellées | **800** (5,7 par fiche) |
| confiance déclarée | 70 en ★4 · 38 en ★3 · 25 en ★2 · 7 en ★1 |

Les sources ne sont pas des pages d'accueil : elles pointent la page de **service** de l'autorité,
avec un libellé — « MOCCAE — Import of pets », `moccae.gov.ae/en/services/import-permit-pets`.

**Le contenu s'y refuse même explicitement les sources faibles.** La fiche Koweït écrit : *« Restricted-breed
lists circulate on commercial pet-relocation sites, but MyDogCanFly does not treat those as official
sources… this point must be verified directly with PAAF. »* C'est la norme que le côté compagnie
n'avait pas.

**Priorité de vérification, dérivée des données.** Les 32 fiches en ★1–★2 sont les destinations les
**moins** consultées (Angola, Tchad, Djibouti, Gabon, Mauritanie, Niger, Congo en ★1). Les **20
destinations réellement fréquentées sont toutes en ★3 ou ★4**, avec 4 à 10 sources : US, GB, CA, AU,
JP, DE, ES, IT, PT, NL, CH, MA, TN, DZ, TH, AE, SN, CI, BR, MX.

> **Conséquence pour le calendrier : la « dizaine de destinations prioritaires » de l'étape B est
> déjà en bon état. Le côté pays n'est pas le chemin critique du lancement — le côté compagnie l'est.**

Cet état est FIGÉ par six contre-épreuves : un bon état non verrouillé se dégrade sans que personne
le voie. Je confirme par ailleurs qu'**aucun changement pays** n'entre dans ce lot, hors le retrait
de l'auto-citation du § 3, qui est un correctif de présentation.

**Une faute de ma propre méthode, à consigner.** J'ai compté trois fois les domaines « officiels » à
l'expression régulière : **130, puis 135, puis 140**. Elle sous-comptait parce que
`inspection.canada.ca`, `mattilsynet.no`, `dld.go.th`, `mafra.go.kr`, `govmu.org`, `gub.uy`,
`rks-gov.net` ne suivent aucun motif commun. Les domaines d'État n'ont pas de forme mondiale. C'est
ma version de la faute que je traque ailleurs : **un instrument qui ne parle que de ce qu'il
reconnaît.** La contre-épreuve s'appuie sur ce que la fiche DÉCLARE, pas sur mes devinettes.

---

## 7. Les 172 fiches de RACE — inventaire pour l'après-lancement

Hors périmètre selon le plan. Voici l'état, pour que le lot ne commence pas par un inventaire.

| | |
|---|---|
| races | 172, dont **22 brachycéphales** |
| portant un poids | 172 / 172 |
| source pour le poids ou le caractère brachycéphale | **0** |
| source des traits de voyage | `dogtime.com`, `source_type: "other"` |
| sources affichées sur la page | **aucune** |

**Ce n'est pas anodin, même hors périmètre** : `brachycephalic` déclenche les avis et les
restrictions de soute, et `weight_kg` préremplit le Finder — donc décide de l'éligibilité cabine.

**Et une incohérence de standard :** la fiche pays Koweït refuse les sites commerciaux comme
sources, pendant que le référentiel de races est bâti sur l'un d'eux, du type même que
`SourcedQuote` interdit pour fonder un fait métier.

---

## 8. Ce qui a été livré par ailleurs

**Les « Vérifié le… » sont partis.** 102 fiches l'affirmaient, cochées en vert, sans rien derrière.
Seul le VERBE change : la date reste, la coche devient un calendrier, la pastille perd son vert.
`verified_date:` — structurel, il porte la cadence de 90 jours — n'est pas touché. Outil rejouable et
idempotent, dont le relevé de résidus a nommé **une cinquième forme que je n'avais pas su
dénombrer** (« · verified 18 July 2026 », sans « last ») et ses trois traductions.

**La porte de lancement.** Les dix contrôles demandés, tous hors ligne sur le `dist` — un contrôle
qui interroge le site en ligne mesure le site d'HIER. **29/29 verts sur l'artefact de production.**
`test-porte-lancement.mjs` lui inflige **dix-neuf fautes une à une** sur un dist synthétique : elle
mord aux dix-neuf, sur le bon contrôle, avec un témoin négatif. Elle a distingué la préversion de la
production en rougissant sur `Disallow: /` — **la panne du 5 août 2026, trait pour trait**, vue avant
le déploiement.

Quatre de ses accusations étaient les siennes et sont corrigées **dans la porte** : tous les nœuds
JSON-LD comparés au titre (6 149 fausses discordances — le nœud `Organization` s'appelle
« MyDogCanFly ») ; cibles à ancre et à joker non résolues ; `.zip` non admis (trois archives de
presse pourtant présentes) ; les `<a>` écrits dans un gabarit JavaScript pris pour des liens morts.
*Une porte qui se trompe finit désactivée.*

**Quatre contrôles ajoutés, tous mesurés propres avant d'être exigés** : bijection entre les 2 536
pages indexables et les 2 536 entrées de sitemap, dans les deux sens et sans doublon ; aucune page
listée ne portant `noindex` ; **réciprocité des 2 536 grappes de langues** — Google écarte en silence
une grappe non réciproque, et cela ne se voit qu'en Search Console six semaines plus tard.

**Le pré-vol du jour 7** (`preflight-production.mjs`) **ne déploie rien**, délibérément : ni
`wrangler`, ni `git push`, ni Search Console. *Un script capable de basculer tout seul finit par
basculer tout seul.* Il vérifie ce qui est vérifiable ici, puis imprime les dix contrôles en ligne
avec leurs commandes et la réponse attendue.

**La journée 5, au navigateur.** Chromium pilote le `dist` de production servi en local avec le VRAI
Worker. **39 contrôles, 0 échec**, huit captures. Les huit points sont couverts, témoin négatif
compris pour la race brachycéphale.

---

## 9. Mes erreurs, nommées

Toutes consignées dans le code, pas seulement ici.

1. **J'ai mesuré la mauvaise surface** — `channels[].cls`, que l'écran ne lit plus depuis T0-B2.
   209 (faux) → **216** (vrai).
2. **« 189 fiches pays »** — c'étaient 189 RÈGLES ; il y a **140 fiches**.
3. **Les 60 corroborés n'existaient pas** (§ 1).
4. **`preuveAuditee`** : je voulais lui faire rendre une page non citée (§ 1).
5. **La porte m'a accusé à tort quatre fois, et c'était elle** (§ 8).
6. **Les montants des fiches pays ne sont pas des tarifs** : 15 000 € est l'amende de l'article
   L211-15 du Code rural, 6 400 € une amende estonienne, 42,25 € une taxe vétérinaire portugaise.
7. **Mon relevé tronquait ce qu'il mesurait** — « €1 » là où la page dit « €15,000 ».
8. **Le harnais navigateur testait un carlin de 87 kg.** Choisir une race remplit le poids
   automatiquement ; mon « 7 » s'ajoutait au « 8 » du gabarit. Tous les contrôles passaient, sur un
   autre chien que celui annoncé. **Je ne l'ai pas trouvé en relisant le code — je l'ai vu sur une
   capture d'écran.**
9. **Mon détecteur de domaines d'État a sous-compté trois fois** (§ 6).
10. **J'allais accuser 17 notes de promettre des tarifs** — elles décrivent la compagnie (§ 4.4).

### Le motif qui les relie

Trois des six arbitrages et la faute la plus sérieuse du lot ne viennent pas d'une contre-revue :
ils viennent d'avoir cherché **là où un contrôle existant ne mordait pas**.

| trouvaille | pourquoi personne ne l'avait vue |
|---|---|
| le site se cite lui-même comme source légale d'un pays | contre-épreuve sur 72 scénarios figés, aucun vers ces 44 pays |
| le verdict de tête contredit ses propres canaux | T0-B2 a fermé l'étage des canaux, jamais celui du verdict |
| les fiches annoncent des sources qu'elles ne montrent pas | rien ne comparait le nombre annoncé au contenu du dépôt |
| le harnais testait un carlin de 87 kg | aucune assertion ne portait sur le formulaire ENVOYÉ |

**Un contrôle qui ne parle que de ce qu'il regarde compte zéro là où il ne regarde pas.** Les
nouvelles contre-épreuves ne prennent donc aucun échantillon.

---

## 10. Comptes figés qui ont bougé, et comment tout rejouer

Aucun n'a été déplacé en silence.

| compte | avant | après | cause |
|---|---|---|---|
| répartition runtime | 142 allowed · 74 denied · 86 à confirmer | 0 · 0 · 302 | frontière |
| causes | 84 `legacy_unreviewed` | 267 + 33 `official_source_unquoted` | idem |
| bascules Finder (72 scénarios) | — | **1 948**, toutes vers « à confirmer » | idem |
| confirmations carlin CDG→IST | 25, toutes de race | 44 — toutes de provenance, 27 aussi de race | causes cumulées |
| causes de race, données réelles | 280 | 298 | canaux fermés en dur qui laissent la cause s'exprimer |

Une preuve permanente encadre le lot par deux baselines figées : **aucune bascule vers `allowed`,
aucune vers `denied`** — ni acceptation ni refus fabriqués. Le témoin `carries_pets` est constaté
**inatteignable**, avec sa cause, et rougira le jour où une politique redeviendra `allowed`.

### Commandes

| | |
|---|---|
| mesure d'impact | `node mesures/politiques-veracite/classer.mjs` |
| appariement des règles | `mesures/politiques-veracite/qualifier.mjs` |
| contre-épreuves de la frontière (54) | `npx tsx test-frontiere-confiance.mjs [--dist=packages/ui/dist]` |
| porte de lancement (29) | `node porte-lancement.mjs` |
| attaques sur la porte (22) | `node test-porte-lancement.mjs` |
| pré-vol de production | `node preflight-production.mjs` |
| vérification navigateur (39) | `PLAYWRIGHT=… npx tsx test-apercu-navigateur.mjs` |
| tout | `npm run test:unit` |

---

## 11. Ce que je demande

1. **Les six arbitrages du § 4**, tranchés ensemble.
2. **Le prédicat canonique de l'ensemble 1** (§ 5), pour converger sur 14 ou 34.
3. **Les citations de l'étape B**, au format : URL, phrase exacte, langue, emplacement, date.

Rien d'autre. Le mécanisme est en place et vert ; ce qui manque est du jugement et des preuves.
