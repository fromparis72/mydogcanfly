# Fermeture du moteur + trois arbitrages d'interface — dossier de contre-revue

**Date** : 5 septembre 2026 · **Branche** : `claude/passation-t0-b2-xgrvye`
**Point de départ** : `85c04d1` (bloqué par le P0 moteur de Codex)

Ce dossier couvre deux lots successifs. Le premier ferme le P0 moteur ; le second applique les
trois arbitrages d'interface restants. Chacun est mesuré, figé par une paire de baselines, et
prouvé par un contrôle permanent.

---

## LOT 1 — Aucune règle non prouvée ne refuse plus rien

### Ce que le P0 disait, et ce que la mesure a trouvé

Codex : « la carte British Airways affichait déjà `denied` en cabine — par une règle » signifie que
`projectPlacementPolicy` n'est pas le seul chemin de décision. Exact. La mesure en a trouvé **trois**,
pas un :

| # | Chemin | Ce qu'il produisait |
|---|--------|---------------------|
| 1 | `hardDenies` — les règles `deny` de `rules.json` | un refus catégorique sans rien demander à la provenance |
| 2 | l'absence de politique | « la fiche ne décide pas ce canal » traité comme « ce canal n'existe pas » |
| 3 | l'embargo d'été sur température **fournie** | une suspension annoncée que personne n'avait lue |

Le troisième n'était pas dans le P0 : je l'ai trouvé en re-fondant un témoin du harnais climat.
Les **six** règles `summer_embargo` du dépôt (AC, AF, IB, KL, LH, TK) portent une URL officielle et
**aucune phrase citée** — elles refermaient donc la soute et le fret de façon catégorique dès que le
visiteur saisissait une température au-dessus de 30 °C.

### La porte était infranchissable — défaut nommé

Le critère « seule une règle citée peut refuser » était **inapplicable par construction** : le schéma
d'une règle portait un `Source` nu, sans `quote`/`quote_language`/`locator`, et `normalize` effaçait
donc en silence toute citation qu'on y posait. `regleDecisive` ne pouvait être vrai pour aucune règle,
jamais. J'ai découvert le défaut en écrivant un témoin qui citait une règle : il échouait, et la
citation n'avait jamais atteint le moteur.

Correction : le schéma citable quitte `objects.ts` (où il s'appelait `PolicySource` et n'était
atteignable que par les politiques) pour **`common.ts`**, sous le nom `SourceCitable`. Politiques,
règles et faits de race lisent désormais la même définition — `common.ts` n'importe que zod, donc
sans cycle et sans copie. `PolicySource` reste comme alias du nom historique.

### Nouvelle cause, et pourquoi elle est distincte

`climate_rule_unquoted { rule_id }` : la température est **certaine**, c'est la **règle** qui n'est
pas prouvée. Distincte d'`estimated_climate` (où c'est la température qui est estimée) parce que le
doute n'est pas le même — les confondre aurait remis deux définitions derrière un seul nom.

Les deux allument le drapeau chaleur : la question posée à la compagnie est la même. Et parce que
**trois** lecteurs dérivaient ce drapeau en comparant le code en dur, la liste vit maintenant dans
une seule fonction du contrat, `estCauseClimatique` / `CLIMATE_CAUSE_CODES`. Le troisième lecteur
tourne dans le navigateur et ne peut pas importer le contrat : sa copie est **comparée
littéralement** par `test-frontiere-confiance.mjs` §13 quater, plutôt que laissée à la vigilance.

`FiredRule` gagne un champ `decisive`, calculé au seul endroit qui tient encore la règle complète.
Sans lui, `explain` déduisait « embargo appliqué » de la simple **présence** d'une règle d'embargo
dans `fired` : une carte se serait affichée « suspendu » alors que le moteur n'appliquait plus rien.
C'est exactement le point 4 de la fermeture — `fired` garde tout pour l'audit, mais rien n'y décide
silencieusement.

### Mouvement mesuré et figé

`test-baselines/frontiere-regles-avant.json` → `frontiere-regles-apres.json`

- **1 168 canaux** passent de `denied` à `confirmation_required` (408 cabine, 480 soute, 280 fret) ;
- **aucun** ne se referme, **aucun** ne va jusqu'à `allowed` ;
- causes gagnées : **992** `rule_official_unquoted`, **288** `rule_unverified`, **8** `policy_absent` ;
- **888 cartes** changent de rang — conséquence assumée de l'ouverture ;
- **British Airways cabine reste `denied`** sur sa phrase citée, et sa **soute** passe à « à
  confirmer » **en nommant** `rule_british_airways_no_cabin`. C'est le cas exact du P0.

### Trois erreurs nommées

1. **La baseline « Citation 1 » énonçait une règle fausse.** Elle affirmait qu'une citation ne doit
   changer que `sources`. Codex l'a déclarée conceptuellement fausse, et il a raison : une citation
   a précisément le droit de faire passer un fait de « à confirmer » à `denied`. Le commentaire est
   réécrit — la paire fige un **état daté**, pas une loi ; la loi vraie est celle de la **portée**
   (une preuve ne déplace que ce qu'elle prouve). Et si rien n'avait bougé, c'était le **symptôme** :
   un chemin non gardé avait déjà tout décidé.
2. **La surface figée rendait `rule_official_unquoted:undefined`.** La projection lisait `policy_ref`
   pour toute cause ; les causes de règle portent un `rule_id`. Une incertitude anonyme est
   inauditable — c'est ce qui avait laissé passer la règle BA. La baseline aurait scellé cet
   anonymat. Elle **échoue franchement** maintenant plutôt que d'écrire `undefined` dans un fichier
   scellé.
3. **J'ai d'abord mesuré « 28 bascules vers denied ».** Il n'y en a aucune : je comparais les cartes
   **par rang** alors que 888 en avaient changé — donc British Airways à Iberia. La comparaison porte
   désormais sur l'identité de la compagnie, et le rang est mesuré à part. (Deux autres outils de
   mesure fautifs le même jour : un diff qui parcourait une chaîne comme un objet, et un `pkill`
   dont le motif figurait dans sa propre ligne de commande.)

### Témoins re-fondés, jamais abaissés

Neuf contrôles du harnais climat reposaient sur un refus produit par une règle non citée. Leur
**témoin** est mort, pas leur **propriété**. `citerRegles(...ids)` cite **au scalpel** la règle dont
chaque contrôle a besoin — chacun nomme ses identifiants, pour qu'aucun ne devienne vert par une
preuve qu'il n'a pas demandée — et la démonstration inverse (« sans citation, rien ne refuse ») est
jouée juste à côté sur la base réelle.

**Athènes cesse d'être un témoin de « drapeau éteint ».** À 31 °C estimés, `rule_af_summer_embargo`
se déclenche sur la soute et le fret d'Air France et produit une confirmation climatique réelle. Elle
se déclenchait **déjà** ; c'est un refus de race non prouvé qui l'éteignait. Épingler « drapeau
éteint » reviendrait à exiger que le site **taise** une question légitime. La propriété défendue —
« une confirmation de RACE n'allume pas le drapeau CHALEUR » — garde **17 témoins réels** :
destinations chaudes dont toutes les confirmations sont non climatiques, drapeau éteint sur toutes.

Le même effet explique le compte de causes de race : **298 → 412**, à cartes constantes (206). Un
refus non prouvé ne masquait pas seulement son absence de preuve, **il masquait aussi tout ce que le
canal avait d'autre à dire**.

---

## LOT 2 — Les trois arbitrages d'interface

### 1. Statut ternaire

`offers_pet_transport` était un **booléen**, et il valait `true` sur les **102 compagnies**. Il
dérivait de « la politique n'est pas refusée » — d'une **absence de refus**, jamais d'une preuve
d'acceptation. Un booléen n'a nulle part où ranger l'ignorance : il tranchait donc toujours dans le
même sens.

Trois valeurs, sur la même frontière que les canaux : `"yes"` (≥1 canal `allowed` prouvé), `"no"`
(les trois `denied`, prouvés), `"unknown"` (tout le reste, politique absente comprise).
**État réel : 0 oui · 0 non · 102 on-ne-sait-pas.**

Sur l'écran, la ligne lisait `carries_pets` et affichait « 🐾 Non compatible » — c'est-à-dire *« cette
compagnie transporte des animaux, mais pas le vôtre »* — là où rien n'établissait ni l'un ni l'autre.
`carries_pets` **quitte la surface publique** ; le badge ne tranche plus que sur les deux états
prouvés et dit son ignorance dans le troisième, en gris (jamais le rouge d'un refus).

### 2. Verdict et score du Finder

**Le verdict n'avait que trois valeurs**, et aucune ne savait dire « on ne sait pas ». Sur un
CDG→JFK, les 22 compagnies sont toutes « à confirmer » : le verdict valait `conditional`, qui
s'affiche **« Oui — sous conditions »**. Le site répondait **OUI**, sur zéro preuve, à la question
qu'il pose lui-même en titre. Quatrième valeur : `"unknown"` → *« Pas encore établi »*, en gris, avec
une note qui dit pourquoi et renvoie vers ce qu'il faut confirmer.

**La jauge est masquée.** Elle annonçait « 10 % de compatibilité » sur un Paris → New York. Sa
première composante — part de compagnies acceptantes — vaut **zéro partout** depuis la frontière ; il
ne restait qu'un résidu de qualité d'itinéraire et d'étoiles de sources, affiché avec la précision
d'une mesure. « 10 % » se lit « presque impossible » ; la vérité est « nous ne le savons pas encore ».

`SCORE_AFFICHABLE = false`, **constante et non conditionnelle à la donnée** — même arbitrage que sur
les fiches compagnie, où la contre-revue a refusé `scoreEtNoteAffichables = aUnCanal("allowed")` :
rebrancher la jauge dès la **première** preuve publierait encore un nombre calculé sur 301 politiques
non prouvées. Le score reste **calculé et servi par l'API** — il n'est pas **affiché**. Le contrôle
permanent le vérifie explicitement : aucun score ne change de valeur.

### 3. Fiches de race — bien pire qu'une liste vide

L'arbitrage portait sur `bestAirlines` vide. La mesure a trouvé beaucoup plus grave sur **172 races ×
4 langues = 688 pages** :

| Ce qui s'affichait | Sur quoi |
|---|---|
| « **Accepté par la plupart (cabine)** » | 0 acceptation prouvée |
| « **Très souvent possible** » en cabine | une limite **supposée** de ~8 kg, avec juste en dessous le détail « *aucune compagnie ne publie de limite adaptée* » — le niveau contredisait son propre détail |
| « **Souvent refusé** » en soute | « *0 compagnies acceptent, 0 non* » — un refus déduit de `pct = tot ? yes/tot : 0` |
| « **Voyageur très difficile · 1,5/5 · 18/100** » | la même cascade, tombée dans son repli |

Quatre réponses catégoriques produites par un vide, en tête de page. Chaque verdict est fermé **à sa
propre source** : `ChannelView` gagne un drapeau `etabli`, et chacun retourne « Pas encore établi »
quand sa base de preuve est vide. La synthèse et la note globale suivent ; la note chiffrée ne
s'affiche plus. La section « Meilleures compagnies » **dit pourquoi elle est vide** au lieu de poser
un titre au-dessus de rien — un titre qui promet une liste et n'en livre aucune se lit comme une
panne, ou pire comme « aucune compagnie ne convient ».

La FAQ a hérité des libellés honnêtes **sans une ligne de code** : instrument unique.

**Erreur nommée** : ma première rédaction a supprimé, avec le faux chiffre « 0 compagnies
interdisent explicitement les chiens au museau court en soute », la **précaution de catégorie** qui,
elle, restait vraie et ne prétendait rien sur une compagnie particulière. La fiche du carlin a cessé
de mentionner son museau court en soute et en fret. Le contrôle 4 de `test-faq-races.mjs` l'a vu.
Seule la précaution est rétablie, sans son chiffre.

### Mouvement mesuré et figé

`test-baselines/arbitrages-interface-avant.json` → `arbitrages-interface-apres.json`

- **72 verdicts** sur 72 : `conditional` → `unknown`. Aucun ne devient compatible ni incompatible ;
- **1 560 cartes** changent leur **seul** segment `pets:` (booléen → ternaire), valeur `unknown` partout ;
- **AUCUN** statut de canal, **AUCUNE** cause, **AUCUN** rang, **AUCUN** score ne bouge.

Ce lot **retire des affirmations, il n'en déplace aucune**.

---

## Vérification dans le navigateur — et un faux vert attrapé là

Les trois arbitrages sont vérifiés dans le **DOM servi**, pas seulement dans les fonctions qui les
calculent : `test-apercu-navigateur.mjs` passe de 39 à **56 contrôles**, tous verts.

- la jauge : le contrôle qui **figeait** le score bas (« ≤ 15 ») en attendant l'arbitrage exige
  maintenant son **absence** — propriété strictement plus forte — et vérifie en plus que la réponse
  de tête est bien rendue et dit « pas encore établi » (sans cette moitié, une page blanche
  passerait) ;
- la fiche de race : les quatre affirmations retirées sont cherchées **par leur texte** dans la page
  du carlin, la précaution brachycéphale est exigée présente, et un golden sert de témoin négatif ;
- le statut ternaire : sur Paris → Dublin avec un American Bully XL, les **11 cartes** affichent
  « Pet transport to confirm ». **Avant ce lot, elles affichaient « 🐾 Not compatible »** — soit
  « ces compagnies transportent des animaux, mais pas le vôtre » — alors qu'aucune politique de ces
  compagnies n'est établie. C'est le cas exact que le ternaire ferme.

**FAUX VERT NOMMÉ, attrapé dans le navigateur.** Ma première rédaction de ce dernier contrôle a
écrit la race « American Bully XL » alors que la liste porte « American Bully (**XL**) ». La race
n'a pas été posée, la route n'a produit aucune carte structurelle, et les deux contrôles négatifs —
qui cherchent une étiquette **absente** — sont passés au vert **sans rien exercer**. Pire : le
témoin que j'avais ajouté pour l'éviter cherchait « à confirmer » n'importe où et a été satisfait
par `« ? Itinerary to confirm »`, un badge d'itinéraire sans rapport. Le témoin vise désormais la
classe CSS propre de l'étiquette, et le libellé exact.

C'est la troisième fois cette semaine que la même faute revient sous une forme neuve : *un contrôle
qui ne parle que de ce qu'il reconnaît compte zéro là où il ne regarde pas.*

---

## Ce que je n'ai PAS fait — arbitrage demandé

**Les six interdictions de race par PAYS.** `rule_{au,de,fr,gb,ie,nz}_breed_ban_restricted_types`
sont `deny`, de portée `country`, et **toutes `officielle_non_citee`**. Elles continuent de produire
`entry_allowed = false`, donc un verdict `incompatible` — *« Pas en l'état »* —, un refus catégorique
sur une règle non citée. À la lettre de la consigne, elles tombent sous la même interdiction.

**Je ne l'ai pas appliquée, et je le nomme plutôt que de trancher seul**, parce que l'asymétrie du
préjudice s'inverse ici :

- ce sont des **lois**, publiées sur des sites d'État (`agriculture.gouv.fr`, `gov.uk`,
  `gesetze-im-internet.de`, `irishstatutebook.ie`, `mpi.govt.nz`, `agriculture.gov.au`) ;
- dire « on ne sait pas » à quelqu'un dont le chien est **légalement interdit d'entrée** l'envoie à
  l'aéroport avec un animal qui peut être saisi. Le faux négatif coûte ici plus cher que le faux
  positif — l'inverse exact du cas compagnie.

**Proposition** : les citer plutôt que les dégrader. Six pages officielles, six phrases à relever —
c'est le lot le moins cher du dépôt, et il ferme le dernier chemin de refus non gardé **par le haut**
plutôt que par le bas. Je peux préparer les six emplacements ; la lecture des pages te revient.

---

## État de vérification

- `npm run test:unit` : **vert**, code de sortie 0
- `npm run typecheck` : vert sur les trois paquets
- `test-tristate-climat.mjs` : 87/87
- `test-frontiere-confiance.mjs` : 0 FAIL (dont §13 quater, nouveau)
- `test-t0a-baseline.mjs` : deux nouvelles preuves permanentes, chaîne des figées continue
- `npm run build:prod` : **3 121 pages**, code de sortie 0
- `porte-lancement.mjs` : **29 contrôles OK, 0 en échec**
- `test-apercu-navigateur.mjs` (Chromium sur le dist servi) : **56 OK, 0 échec**

## Chaîne des baselines figées

```
… → tarifs-etape3 → frontiere-finder → citation-ba-cabine
                                          ↓
                                    frontiere-regles (1 168 canaux ouverts)
                                          ↓
                                arbitrages-interface (72 verdicts, 1 560 statuts ternaires)
```

Aucune figée n'est écrasée ; chacune reste l'AVANT de la suivante, et chaque paire a son contrôle
permanent qui rougit si le mouvement s'inverse.

---

# CONTRE-REVUE DE `f0297db` — fermeture des trois P0 et des trois P1

**Date** : 5 septembre 2026, après-midi.

## P0-1 — le verdict de fiche transformait l'ignorance en refus total

Reproduit sur la fonction réelle, à l'identique :

| entrée | avant | après |
|---|---|---|
| `undefined` | `no` | `warn` |
| `{ cabin: denied }` | `no` | `warn` |
| `{ cabin: denied, hold: denied }` | `no` | `warn` |
| trois canaux `denied` | `no` | `no` |

`Object.values()` ne voyait que les clés **présentes** : deux canaux inconnus ne pesaient rien, et
l'absence se lisait comme un refus. Même faute que d'habitude — *un contrôle qui ne parle que de ce
qu'il reconnaît compte zéro là où il ne regarde pas* — cette fois dans le sens le plus dur, sur la
fiche. Les trois placements sont désormais énumérés explicitement ; « tous refusés » exige les trois.

**Option retenue** : la seconde (prudence sur tout état incomplet), et non l'échec de build, parce
que le dépôt porte réellement **4 canaux absents sur 306** — les faire échouer aurait cassé le build
sur une donnée légitimement inconnue. Le contrôle `politiqueDuCanal`, lui, continue de lever sur un
canal AFFICHÉ sans politique.

**La contre-épreuve gravait le défaut** : sa dernière ligne exigeait que `{ cabin: denied }` rende
`no`. Elle verrouillait le repli fautif — une correction l'aurait fait rougir, et on l'aurait crue
régressive. Remplacée par les quatre cas, plus deux mesures sur la base réelle (aucune des 102 fiches
ne conclut au refus total ; British Airways a sa cabine refusée sur preuve et sa **fiche** prudente).

## P0-2 — « No pets » sur l'ignorance, et le motif qui revenait par la bande

Reproduit exactement (CDG → LHR, `breed_american_bully_xl`) : **10 compagnies**, toutes
`offers_pet_transport: "unknown"`, toutes étiquetées **« No pets »**. `carries_pets` étant devenu la
projection de `=== "yes"`, il vaut `false` aussi bien sur un refus prouvé que sur un « on ne sait
pas ». L'interdiction du **pays** devenait une affirmation structurelle fausse sur chaque compagnie —
qui aurait suivi le visiteur sur tous ses autres trajets.

`air.no_pets` ne sort plus que d'`offers_pet_transport === "no"`.

**Défaut trouvé en vérifiant le correctif** : une fois « No pets » retiré, les cartes disaient
« cabine non proposée, soute non proposée, race non acceptée ». Ces motifs viennent de
`denyReasonsOf`, qui parcourait **toutes** les règles `deny` déclenchées, y compris celles auxquelles
la frontière venait de retirer le pouvoir de décider. Le refus venait du pays ; la carte l'imputait à
la compagnie. **Une règle qui ne peut pas décider ne peut pas non plus expliquer** : `denyReasonsOf`
lit désormais le même prédicat. Les dix cartes portent maintenant un libellé neutre, et l'exigence
pays — texte intégral du Dangerous Dogs Act, certificat d'exemption compris — reste en tête du
rapport au niveau `critical`.

## P0-3 — l'entrée dans le pays, quatrième chemin non gardé

`entry_allowed` passait à `false` sur une exigence pays `deny` sans rien demander à sa provenance —
et ce refus-là éteint les trois canaux de **toutes** les compagnies d'un coup. Le chemin est
maintenant gardé comme les autres.

**Ce n'est pas un silence** : l'exigence reste publiée en tête du rapport, texte intégral, niveau
`critical`, et l'interdiction non décisive est **nommée** dans `destination.entry_unverified_denies`
plutôt que perdue. Contre-épreuve versionnée : la même règle, citée, referme bien l'entrée — la porte
n'est pas condamnée.

**La citation ne suffira pas pour cinq des six.** Les lectures de la contre-revue sont consignées
dans `mesures/politiques-veracite/regles-pays-a-requalifier.json`, avec pour chacune ce qui manque :

| pays | condition à revoir | ce qui manque |
|---|---|---|
| Australie | — | la phrase exacte (locator connu) |
| Nouvelle-Zélande | « entièrement ou principalement » porte sur le **type**, pas sur un `breed_id` | la phrase exacte ; **et la source citée par la contre-revue n'est pas celle que porte la règle** |
| Allemagne | exceptions réglementaires du HundVerbrEinfG non vérifiées | la vérification, puis la phrase |
| France | catégorie 1 = **morphologie + absence de pedigree reconnu** ; `breed_id in [pit_bull]` est un raccourci faux dans les deux sens | un fait « pedigree reconnu », ou la rétrogradation en confirmation |
| Grande-Bretagne | (1) la source portée par la règle traite de la **détention**, pas de l'**importation** ; (2) l'exemption par certificat n'est pas exprimée | la bonne source, la phrase, l'exemption |
| Irlande | aucune condition de séjour ni de résidence ; la S.I. 491/2024 prévoit trente jours pour certains non-résidents | l'expression des exceptions, puis la phrase |

Un **garde-fou** rend ce registre contraignant : une règle pays qui deviendrait décisive sans être
déclarée `resolu` fait échouer la CI. Une citation future ne pourra donc pas restaurer en silence une
règle que la lecture des sources a déjà démentie.

**Je n'ai fabriqué aucune citation.** Australie et Nouvelle-Zélande n'attendent que le libellé exact,
mot pour mot — il me faut la phrase telle qu'elle est publiée.

## P1-1 — le contrôle qui se félicitait de n'avoir rien vu

`absences >= 0` est vrai de tout entier. Remplacé : la politique `airline_air_france#hold` est
réellement supprimée d'une copie de la base, et le contrôle exige `confirmation_required` +
`policy_absent` sur **la compagnie et le canal exacts**, avec un témoin négatif sur la base intacte.

## P1-2 — deux exigences de preuve pour une même décision

`SourcedQuote.locator` étant facultatif, un fait de race pouvait fermer un canal sur une provenance
que la frontière refuse à une règle. Les deux chemins lisent maintenant le **même prédicat
canonique** (`regleDecisive`). Un `deny` de race non prouvé demande confirmation et **nomme sa
restriction** (`breed_deny_unverified`), rangée dans la famille « notre incertitude » du Finder — pas
dans le vide, comme `official_source_unquoted` l'avait été.

**Erreur nommée** : j'ai d'abord versé ces provenances dans `evidence` au rôle `refusal`. Le contrat
l'a refusée, et il a raison — une preuve de **refus** sur un canal qui n'est pas refusé est
incohérente, et lui donnerait à l'écran le rang qui lui manque précisément. Le canal ne porte donc
aucune preuve.

**Et les fixtures du harnais étaient sous la barre** : aucune ne portait de `locator`. C'est en les
remontant qu'on a vu que le défaut était réel et non théorique. Un paragraphe neuf prouve la
frontière dans les deux sens — preuve complète → refus ; même fait sans emplacement → confirmation
nommée, sans preuve publiée, sans motif.

Cinq témoins d'interdiction d'entrée (synthétiques et réels) ont dû être **cités** pour continuer
d'exercer la dominance qu'ils défendent — jamais abaissés.

## P1 mineur — l'apostrophe

La citation portait une apostrophe **ASCII** (U+0027) là où la page écrit une apostrophe
**typographique** (U+2019). Le champ dit « reprise telle quelle » : il porte désormais l'octet lu.
**Option retenue : aucune normalisation typographique, nulle part** — replier « ’ » sur « ' » rendrait
`verbatim` approximatif et masquerait, lors d'une comparaison future à la page, lequel des deux
textes a bougé. La règle est écrite dans `lectures-effectuees.json` et gardée par un contrôle qui
compare la **chaîne complète**, dans la fiche et dans les deux artefacts engendrés.

La seconde phrase que tu confirmes — « Your pet will travel in the hold of our aircraft. » — est
consignée avec la lecture « soute NON PROUVÉE » : la page prouve le **contraire** d'un refus de
soute, ce qui rendait `rule_british_airways_no_cabin` doublement infondée sur ce canal.

## Ce qu'il me faut de toi pour aller plus loin

1. les **phrases exactes**, mot pour mot avec leur langue, pour l'Australie et la Nouvelle-Zélande ;
2. pour la Nouvelle-Zélande, **laquelle des deux URL** fait foi (celle de la règle ou celle que tu
   cites) ;
3. le résultat du contrôle des **exceptions allemandes** ;
4. ton arbitrage sur France / Grande-Bretagne / Irlande : conditionner les règles (ce qui demande
   d'ajouter un fait « pedigree reconnu » et un fait « durée de séjour » au contexte d'évaluation),
   ou les laisser en confirmation permanente avec leur texte d'exigence intégral.

---

# CONTRE-REVUE DE `cbcd9da` — le statut d'entrée ternaire, et un registre qui se prouve

**Date** : 5 septembre 2026, fin d'après-midi.

## P0 — j'ai refait, sur l'entrée, la faute que je venais de corriger deux fois

`entry_allowed` est resté **booléen**. Un booléen n'a pas de place pour l'inconnu : une
interdiction non citée le laissait donc à `true`, et le même rapport disait trois choses à la fois
(reproduit, CDG → LHR, American Bully XL) :

| énoncé | où | verdict de vérité |
|---|---|---|
| « Interdit par l'article 1 du Dangerous Dogs Act 1991 » | exigence, `critical` | texte officiel, non vérifié phrase à phrase |
| « Pas encore établi » | verdict global | juste |
| « **Le Royaume-Uni autorise l'entrée** » | élément positif | **faux** — conclusion tirée d'une absence de preuve |

C'est le troisième qui était intenable, et c'est exactement la faute d'`offers_pet_transport`
et du verdict de fiche, une troisième fois. **Nous ne connaissons pas les autorisations : nous ne
connaissons que les blocages, et leur absence dans nos données.**

`EntryStatus` remplace le booléen — `blocked` / `confirmation_required` / `no_known_block` —, avec
les quatre conséquences demandées :

1. le statut est ternaire, et `entry_allowed` n'en est plus qu'une projection interne
   (`!== "blocked"`), qui ne doit jamais servir à conclure qu'un pays autorise ;
2. un statut pays `confirmation_required` **plafonne le verdict à `unknown`**, même si une
   compagnie devient `allowed` — l'embarquement n'est pas l'entrée ;
3. plus aucune phrase ne conclut à une autorisation : `no_known_block` dit « aucune interdiction
   d'entrée bloquante établie dans nos données », `confirmation_required` dit « le pays restreint
   peut-être ce chien — à confirmer », au niveau `high` et en ton négatif ;
4. le `rationale` catégorique d'une règle non décisive est **encadré, pas supprimé** : le texte
   officiel reste lisible entier, avec son lien, sous « Restriction d'entrée potentielle, à
   confirmer auprès des autorités de … Ce que dit la page officielle, et que nous n'avons pas pu
   vérifier phrase par phrase : … ». La criticité `critical` est conservée — l'encadrer ne
   l'atténue pas.

Les quatre contre-épreuves demandées sont écrites, plus quatre autres : les deux autres états du
ternaire (pour qu'il ne soit pas un binaire déguisé), et le fait qu'aucune exigence issue d'un
`deny` non décisif ne **commence** par une affirmation d'interdiction.

Pour la troisième contre-épreuve — « une compagnie synthétiquement `allowed` ne peut rendre le
trajet compatible » — la base réelle ne portait aucun canal `allowed` : elle est construite en
citant les 302 politiques en mémoire, ce qui ouvre **3 compagnies** sur ce trajet, et le verdict
reste `unknown`. Sans cela, la règle « le statut pays plafonne le verdict » n'aurait été éprouvée
par aucune donnée.

## P1 — le registre se croyait sur parole

La garde vérifiait « citée **et** non résolue → rouge ». Ajouter une citation et basculer `resolu`
à la main suffisait donc à restaurer un refus dont le prédicat n'avait pas changé : le texte
exigeait les deux, le code n'en prouvait qu'un.

Chaque entrée porte maintenant `empreinte_predicat_constate` — SHA-256 tronqué de la forme
canonique de `{applies_when, effect}` au moment du constat. Une entrée `resolu: true` dont la
`condition_a_revoir` n'est pas vide doit présenter un prédicat dont **l'empreinte a changé**. La
contre-épreuve exacte est écrite : citer la règle GB, passer son entrée à `resolu: true`, ne rien
corriger → **la garde rougit** ; et une fois le prédicat réellement modifié, elle repasse au vert
(sans ce second volet, elle pourrait être rouge pour une raison sans rapport).

## Les sources — ce qui est appliqué, et ce qui ne l'est pas

**Nouvelle-Zélande : citée et appliquée.** La règle porte désormais la page 2026 du MPI, la phrase
exacte et son locator. Elle est la **première règle citée du dépôt**, comme British Airways cabine
fut la première politique. Le statut d'entrée devient `blocked` et le verdict `incompatible` — le
ternaire n'est donc pas un binaire déguisé.

Raisonnement pour l'appliquer : « *entirely or predominantly* » est **plus large** que le nom de
race — un chien déclaré d'une de ces races lui appartient au moins de façon prédominante, donc le
prédicat `dog.breed_id in [...]` est couvert par la phrase.

**Australie : citation relevée, mais NON appliquée.** Et c'est la même distinction, prise dans
l'autre sens : la page australienne n'interdit que les races **pures**, et annonce les croisés
comme admis. Or le formulaire demande une race, pas une **pureté** — choisir « Dogo Argentino »
n'établit pas que le chien est de race pure. Citer la règle la rendrait décisive et ferait refuser
des chiens que la page admet explicitement. La citation est conservée entière dans le registre,
prête à servir le jour où un fait de pureté existera. **C'est ma lecture, et je la soumets** :
ton critère était « si le choix de race signifie bien que le chien appartient effectivement à la
race visée », et pour l'Australie il ne le signifie pas.

**Allemagne : les trois exceptions que tu confirmes sont consignées** (chiens de service,
d'assistance, guides et de secours ; retour d'un chien légalement détenu ; séjour temporaire de
quatre semaines au plus avec une personne non résidente), avec les deux sources. Elle reste en
confirmation, avec France, Grande-Bretagne et Irlande. **Aucun champ n'est ajouté au formulaire**,
conformément à ton arbitrage.

## Mouvement mesuré et figé

`entree-ternaire-avant.json` → `entree-ternaire-apres.json` : **un seul énoncé change**, dans les
72 scénarios — « X autorise l'entrée » devient « aucune interdiction d'entrée bloquante établie
dans nos données pour X ». Aucun verdict, aucune carte, aucun statut, aucune cause, aucun rang,
aucun score. La matrice publique ne contient aucun trajet à interdiction applicable : le cas
`confirmation_required` vit dans `test-frontiere-confiance.mjs`.

Compte figé mis à jour, mouvement nommé : règles `deny` — **1 citée** (Nouvelle-Zélande, contre 0),
129 officielles non citées (contre 130), 88 faibles (inchangé).

## Deux détails corrigés en vérifiant, et une trappe reconnue

**L'accord de l'article.** Les nouvelles phrases rendaient « à confirmer auprès des autorités de
Royaume-Uni » et « Royaume-Uni restreint peut-être… » — sans article, en français comme en
espagnol. Plutôt que de construire une mécanique d'accord (une source de fautes à elle seule, et
j'en ai déjà commis une sur les participes), le nom du pays est déplacé **après un tiret** —
« Entrée à confirmer pour ce chien — Royaume-Uni » — et la condition parle du « pays de
destination ». Aucune langue n'a alors besoin d'article. L'anglais des éléments positifs n'est pas
touché : la baseline des 72 scénarios est en anglais, et je l'ai **vérifiée** plutôt que supposée —
elle ne bouge pas.

**`pgrep -f "astro build"` se trouve lui-même.** J'avais déjà tué mon propre shell avec `pkill -f`
en septembre ; cette fois le motif figurait dans la ligne de commande du *détecteur*, et
`pgrep` répondait « encore vivant » en se voyant lui-même. Le motif s'écrit désormais
`'astro[ ]build'` : la classe de caractères ne se contient pas elle-même. La même faute, prise par
l'autre bout.

## Une régression de ma part, trouvée en auditant mes propres consommateurs

Après avoir corrigé `entry_allowed`, j'ai cherché qui d'autre le lisait. Un consommateur plus loin,
la porte de classement de l'outil Destinations faisait `m.entry_allowed ? 1 : 0.05`.

Depuis que la frontière garde le chemin de l'entrée, ce booléen vaut `true` sur une interdiction non
citée. **Édimbourg et Cork, avec un American Bully XL, sont donc passés à pleine porte** — au même
rang qu'une ville sans la moindre restriction connue, alors qu'ils étaient enterrés la veille. Le
booléen restait juste ; la question posée était trop pauvre. C'est exactement la faute que tu venais
de relever, un cran plus loin dans la chaîne, et introduite par ma propre correction.

Trois portes pour trois états : `0,05` sur un blocage prouvé, `0,35` sur une entrée à confirmer, `1`
sans interdiction connue. Mesuré : **6 destinations à confirmer, 133 sans interdiction connue** pour
cette race.

**Et la garde que j'ai écrite pour ça était elle-même fautive** : elle cherchait l'ancien motif dans
le fichier entier et le trouvait — dans le commentaire où je venais d'expliquer que cette porte
était fautive. Elle accusait ma propre explication, exactement comme le contrôle qui avait rougi sur
la phrase légitime des races au museau court. Les commentaires sont retirés avant de chercher : un
contrôle doit lire le **code**, pas le texte qui en parle.

## Vérification de bout en bout de ce lot

- `npm run test:unit` : **vert**, code de sortie 0
- `npm run build:prod` : **3 121 pages**, code de sortie 0
- `porte-lancement.mjs` : **29 contrôles OK, 0 en échec**
- `test-apercu-navigateur.mjs` (Chromium sur le dist servi) : **65 OK, 0 échec** (44 avant ce lot)

Ce que le navigateur vérifie désormais sur l'entrée, dans le DOM servi :

- aucune phrase n'affirme que le pays autorise l'entrée ;
- le rapport dit à la place que l'entrée est **à confirmer pour ce chien** ;
- l'exigence est **encadrée** comme une restriction potentielle, et le texte officiel — Dangerous
  Dogs Act, certificat d'exemption — y reste entier ;
- **et une interdiction PROUVÉE tranche encore** : Auckland avec un Tosa Inu rend « Not as
  requested », sur la phrase citée du Dog Control Act 1996. Sans ce dernier contrôle, tout ce qui
  précède ne prouverait que l'inaction — un ternaire qui aurait simplement tout rendu prudent
  aurait été vert partout ailleurs.

## Chaîne des baselines figées

```
… → citation-ba-cabine → frontiere-regles → arbitrages-interface → entree-ternaire
```

Aucune figée n'est écrasée ; chacune reste l'AVANT de la suivante, et chaque paire a son contrôle
permanent qui rougit si le mouvement s'inverse.

---

# CONTRE-REVUE DE `f76cd7c` — deux faux-verts, et un repli qui recréait le défaut

**Date** : 5 septembre 2026, soir.

## P0-1 — un texte à nous, publié sous l'autorité de la page officielle

Mesuré : la règle britannique n'a **aucune `source.quote`** (`undefined`), et le rapport publiait
pourtant, sous « *What the official page says, and which we have not been able to verify sentence by
sentence :* », notre `rationale` — un résumé éditorial. Le visiteur lisait donc, attribué à gov.uk,
« *possession is only lawful under a court-ordered Certificate of Exemption, which cannot be obtained
for a dog arriving from abroad* », une conclusion catégorique que personne n'a lue sur la page.

**Encadrer un texte ne le rend pas sourçable.** Ma rédaction précédente croyait résoudre le problème
en annonçant l'incertitude ; elle ne faisait que donner une adresse officielle à une phrase interne.
Le `rationale` d'un `deny` non décisif **ne sort plus du tout** : le visiteur reçoit une formulation
neutre et **le lien officiel**, qui le mène au texte véritable. `rationale` reste dans `fired`, pour
l'audit.

Contre-épreuve exacte : remplacer le `rationale` britannique par une absurdité (« tous les chiens
doivent porter un chapeau ») ne change **aucun** texte public, et l'absurdité n'apparaît nulle part
dans le rapport ; le lien, le `rule_id` et la criticité `critical` restent servis.

Et le contrôle qui vérifiait ce point **gravait le défaut** : il EXIGEAIT que le texte officiel soit
« conservé entier ». Il est inversé.

## P0-2 — la garde constatait un mouvement, pas une correction

Reproduit exactement : citation ajoutée, `resolu: true`, **permutation de deux races** dans la liste
— `decisive: true`, empreinte modifiée, garde verte. Et ma propre contre-épreuve confirmait le
défaut, puisqu'elle remplaçait la liste par le seul XL Bully et appelait cela « réellement changé ».

Le registre porte désormais **l'état approuvé**, pas une empreinte de départ :

- `predicat_approuve` — l'objet canonique lisible, **tableaux triés** : ces tableaux sont des
  ensembles (`all` est une conjonction, la liste de races et `effect.placement` sont des ensembles),
  l'ordre n'y porte aucun sens. L'hypothèse est écrite dans le fichier ;
- `preuve_approuvee` — url, phrase, langue, emplacement, en entier ;
- une règle résolue ne passe que si **les deux sont exactement égaux** à l'état approuvé.

Cinq sabotages rougissent, et un témoin positif reste vert :

| sabotage | résultat |
|---|---|
| citation + `resolu`, permutation seule | **rouge** |
| citation + `resolu`, condition sans rapport | **rouge** |
| Nouvelle-Zélande, citation différente | **rouge** |
| Nouvelle-Zélande, une sixième race ajoutée | **rouge** |
| règle non citée déclarée `resolu` à la main | **rouge** |
| *permuter la liste d'une règle déjà approuvée* | *vert* — l'ordre n'a aucun sens |

Ton point sur la couverture néo-zélandaise est traité par ce mécanisme : la phrase dit « *these
breeds or types* » sans énumérer, donc c'est le **prédicat approuvé** qui fixe les cinq valeurs, et
l'égalité exacte les verrouille — le sabotage « sixième race » le démontre. L'entrée porte aussi
`valeurs_couvertes` en clair, pour qu'un lecteur humain voie ce que la preuve est réputée couvrir.

## P1 — le repli recréait le faux-vert, et le navigateur n'éprouvait rien

`entry_status` devient **obligatoire** dans le type, et le repli **échoue vers la prudence** :
`confirmation_required`, jamais `no_known_block`. Un statut absent n'est pas une absence de blocage,
c'est une ignorance.

Et tu avais raison sur les fixtures : le chemin ternaire n'était éprouvé **nulle part** dans le
navigateur — l'outil Destinations n'y était pas ouvert du tout. Un paragraphe neuf le pilote de bout
en bout (formulaire → Worker → rendu) et vérifie que chaque destination servie porte un statut, que
les deux états attendus sont présents, que les trois portes sont distinctes, et **qu'un statut absent
reçoit la porte de la prudence**.

## Finition

`git diff --check` : **propre** (l'espace final de `test-frontiere-confiance.mjs:862` et tous les
autres sont retirés).

---

# CLÔTURE TECHNIQUE — `5465f92b889d66b2704d762ee1a7bcf95756e7a3`

**Feu vert technique de Codex, 5 septembre 2026.** Aucune réserve restante sur la contre-revue
différentielle. Ce feu vert **n'autorise ni fusion ni déploiement** : ces deux décisions
appartiennent à Philippe, et lui seul.

## Ce que ce lot a fermé, commit par commit

Sept passes de contre-revue, après le P0 moteur qui a ouvert la série.

| commit | ce qui a été fermé |
|---|---|
| `c25221c` | les trois chemins de refus non gardés du moteur — règles, politique absente, embargo d'été |
| `2d1afe6` | les trois arbitrages d'interface — statut ternaire, quatrième réponse, jauge masquée |
| `cbcd9da` | le verdict de fiche, le libellé « No pets », le motif imputé à tort ; création du registre pays |
| `47a4cf1` | le statut d'entrée ternaire — « le pays autorise » ne se déduit plus d'une absence de preuve |
| `c38ea3b` | le classement des destinations, qui promouvait les pays interdisant peut-être le chien |
| `caca925` | résumé éditorial retiré ; état approuvé de la règle résolue verrouillé |
| `111a0a0` | prédicat des règles non résolues verrouillé ; porte d'entrée extraite ; formulation prudente corrigée |
| `a82a578` | scores exacts et parcours navigateur réellement exercé |
| `5465f92` | témoins du harnais caisse re-fondés |

**Correction du 05/09/2026, nommée.** La première rédaction de ce tableau annonçait « six passes »
en listant sept lignes, **omettait `111a0a0`**, et attribuait à `caca925` toute la garde du
registre. C'est inexact et vérifié comme tel : `caca925` a verrouillé l'état approuvé de la règle
RÉSOLUE (`predicat_approuve`) ; l'égalité avec `predicat_constate` pour les règles NON résolues —
le défaut par lequel la règle britannique pouvait gagner un golden retriever en silence — n'est
arrivée qu'avec `111a0a0`. Un tableau de clôture qui se trompe d'auteur sur une garde est
exactement le genre de document qui fera perdre une heure à quelqu'un dans six mois.

## Vérifications finales

`test:unit` vert · `test:built-ui` vert · `build:prod` **3 121 pages** · porte de lancement
**29/29** · navigateur **79/79** · caisse **24/24** · `git diff --check` propre.

Les harnais sont passés de 39 à **79** contrôles navigateur, et de 15 à **24** sur le calculateur
de caisse — non par ajout de confort, mais parce que chaque témoin devenu muet a dû être re-fondé
plutôt qu'abaissé.

## Ce qui reste ouvert, et à qui

**Décision maintenue — Australie** : statut prudent tant que le formulaire ne recueille pas la
pureté du chien. L'arbitrage est RENDU, pas en attente : la citation est relevée et conservée
entière dans `regles-pays-a-requalifier.json`, et elle n'est pas appliquée parce que la page
n'interdit que les races **pures** et admet explicitement les croisés — or le formulaire demande
une race, pas une pureté. La citer refuserait des chiens que la page admet.

**À un lot ultérieur** — France, Grande-Bretagne, Irlande et Allemagne restent en confirmation
prudente. Les conditionner demande d'ajouter au contexte d'évaluation des faits que le formulaire
ne recueille pas : pedigree reconnu, durée de séjour, résidence, certificat d'exemption, statut de
chien de service. Aucun champ n'a été ajouté avant le lancement, conformément à l'arbitrage.

**Dette cosmétique nommée** — deux règles CSS orphelines (`.crx-size__code`, `.crx-size__d`)
subsistent dans `CrateCalculator.astro` pour une fonctionnalité retirée. Elles ne publient aucune
donnée. Non nettoyées ici **délibérément** : toucher à la source invaliderait le dist sur lequel
tout ce lot a été vérifié.

**À la décision de Philippe** — la fusion, et le déploiement.

---

# Annexe — « rien de faux n'atteint l'écran » était FAUX (05/09/2026)

## L'erreur, nommée

J'ai conclu le lot précédent par : *« rien de faux n'atteint l'écran »*. C'était **inexact**, et
la contre-revue l'a établi. Je n'avais regardé que la **pastille**. La pastille est bien
canonique — elle lit `politiqueDuCanal`, elle est vérifiée bloc par bloc dans les quatre langues
— mais elle ne représente qu'une fraction de ce que la fiche publie. Sous elle, et autour d'elle,
le texte éditorial historique continuait de sortir tel quel.

Ce n'est pas une imprécision de rédaction. C'est une **vérification partielle présentée comme
une garantie générale** : j'ai contrôlé une surface, et j'ai conclu sur toutes. C'est la faute
que ce dépôt refuse partout ailleurs, commise par moi, dans la phrase de clôture.

## Ce que la fiche publiait réellement

Une fiche a **deux chemins de données** pour un même canal :

| chemin | contenu | citée ? |
| --- | --- | --- |
| `premium.policy[canal]` (base de connaissances) | statut, conditions, source, citation, date | oui, quand elle existe |
| `channels[]` (fiche générée) | `cls`, `statusLabel`, `detail` — texte libre écrit à la main | **jamais, et pas de place pour l'être** |

La carte avait été ramenée sur le premier. **Six surfaces** lisaient encore le second, ou des
champs de la même nature :

1. `channels[].detail`, rendu sans condition sous la pastille, chiffres **mis en gras** ;
2. la **FAQ** (`airlineFaq`), qui republiait `statusLabel` + `detail` — et, par le balisage
   `FAQPage`, les donnait à lire à une machine comme des réponses autorisées ;
3. `crate` — « max 55 × 40 × 23 cm — mais 40 × 25 × 25 cm sur DH8-100 et ATR » ;
4. `temperature` (pastilles + note) ;
5. `assistance` ;
6. `goodToKnow` — « accord préalable obligatoire · soute ≥ 24 h · États-Unis 48 h », « 15 semaines ».

À quoi s'ajoutaient `ladder` (« Cabine ≤ 8 kg »), les 201 `restrictions` — **aucune sourcée**,
mesuré — et les 102 puces « Mise à jour le … ».

**Mesure de la sourçabilité** : une entrée de `crate` n'a que les clés `en`, `fr`, `es`, `pt`.
Il n'y a pas même un champ où une source pourrait aller. Ces textes ne sont pas « en attente de
vérification » : ils sont **structurellement invérifiables** en l'état.

## Ce qui a été fait

**Canal non prouvé** — plus aucun `detail`. Une phrase générique localisée (`premium.channel_unproven`)
dit l'ignorance et renvoie à la compagnie ; le lien officiel non cité reste montré, sans bouclier,
sans « vérifié le… », sans indice de confiance.

**Canal prouvé** — seule la citation stricte est publiée, verbatim, dans le bloc `proof`, avec son
lien et son emplacement. Correction d'une seconde inexactitude de ma part : la phrase générique
était d'abord rendue **aussi** sur British Airways cabine, où elle affirme « rien n'a été confirmé
sur une source citée » — ce qui y est **faux**. Elle est désormais conditionnée à l'absence de preuve.

**La FAQ lit la politique canonique.** C'est le point qui ferme la classe entière : elle reçoit
`kbAir?.premium?.policy` et se construit avec les **mêmes pièces que la carte** — libellé publié du
statut, puis citation verbatim ou phrase d'ignorance. Elle ne se rabat **jamais** sur l'éditorial.
Les quatre questions adossées à `restrictions`, `crate`, `temperature` et `assistance` sont
retirées : une réponse de FAQ est catégorique par construction, et le balisage la donne pour
autorisée. Il reste **deux questions par fiche**, toutes deux adossées à la politique.

**Les surfaces éditoriales sont masquées** par `surfacesEditorialesAffichables` : `ladder`,
`restrictions`, `crate`, `temperature`, `assistance`, `goodToKnow`, et les puces de date et de refus.

**Une phrase devenue pendante a été retirée.** Le bloc brachycéphale disait « ce que la compagnie a
écrit figure dans les **restrictions ci-dessus** » — or `restrictions` venait d'être masqué. Elle
renvoyait à un bloc absent, et affirmait de surcroît un refus tiré de ces mêmes données non
sourcées. Ce masquage-là, je ne l'avais pas anticipé : c'est en relisant mes propres consommateurs
que je l'ai trouvé.

**Ce qui RESTE, et pourquoi.** La liste des races brachycéphales reste, avec leurs poids. Elle
porte sa phrase de désaveu : *« ces N races sont la classification de MyDogCanFly — ce n'est pas
la liste publiée par {compagnie} »*. Ce sont **nos** données, assumées comme telles, et le maillage
vers les fiches races en dépend. **Déviation nommée, soumise à arbitrage** : si Codex juge qu'un
poids de race publié à côté d'un nom de compagnie reste trop ambigu, il tombe au prochain lot.

## La dette 295/102 — interne, et désormais muette

Le compte des canaux dont le `cls` éditorial contredit la décision canonique passe de **80 sur 71
fiches** à **295 sur 102**. **Mouvement nommé** : depuis la frontière de confiance, aucune des 302
politiques n'est `allowed` et `denied` ne s'obtient que sur une phrase citée — 301 canaux valent
« à confirmer », tandis que le `cls` garde la couleur de son époque. Ce n'est pas une régression :
c'est la mesure de la dette éditoriale, rendue visible d'un coup.

**Aucun sous-système de réconciliation n'a été construit** — ç'aurait été traiter le symptôme.
Ce sont les **lecteurs** qui ont disparu. Le contrôle de la section 5 continue de prouver, bloc par
bloc et langue par langue, que c'est la décision canonique qui est publiée sur ces 295 canaux :
la dette est donc **inatteignable depuis l'interface**, et le restera tant que ce contrôle vit.

## Les preuves ajoutées

**Preuve DOM** (`test-lib/verifier-seuils-fiches.mjs`, section 2 bis) : sur les 5 fiches
sentinelles × 4 langues, **aucun** seuil de poids, dimension de caisse, date de mise à jour ni
puce de refus ne survit dans le DOM construit. 16 pages lues, 12 blocs « notre classification »
trouvés et retirés, **tous** porteurs de leur désaveu.

Deux corrections de ma main sur cette preuve elle-même :

- **le contrôle du désaveu était vide.** Je repérais le bloc par la phrase « classification de
  MyDogCanFly », puis je vérifiais qu'il portait… cette même phrase. Il ne pouvait pas rougir. Le
  bloc est désormais repéré par sa **structure** (une carte contenant des pastilles de race en
  « N kg »), ce qui rend le désaveu **réfutable** ;
- **j'ai introduit, en écrivant un contrôle de véracité, la régression que le harnais surveille
  par ailleurs.** Lire ces 16 pages dans le processus principal l'a fait passer de 355 à 565 Mo,
  au-delà de son plafond de 400. La lecture a été déplacée dans un **processus court**, comme
  l'exige déjà l'architecture de ce fichier.

**Témoin synthétique `allowed`** (section 2 ter) : Air France cabine et Thai Airways cabine
passent à `confirmation_required` — **mouvement nommé** dans `sentinelles-entites.mjs`. La
couverture d'un vrai refus passe à **British Airways cabine**, seule décision du dépôt fondée sur
une citation stricte (« We don't carry pets in the cabin on any route. »). La branche `allowed`
n'ayant plus **aucun** porteur réel — mesuré, et figé par un contrôle — elle est éprouvée par un
témoin **explicitement déclaré synthétique**, jamais par une page du site.

**Une mesure était tirée au sort.** Le plafond mémoire lisait `heapUsed` à un instant dépendant du
ramasse-miettes : trois exécutions **identiques** ont donné 365, 371 puis 420 Mo. Un contrôle qui
rougit une fois sur trois sans que rien ne change finit désactivé, et emporte sa garantie. Il
mesure désormais ce qui reste **retenu après collecte forcée** — quantité définie, reproductible,
et **plus sévère** : 115–131 Mo, plafond inchangé.

## Une erreur trouvée par le build de production

Ma première rédaction de la FAQ demandait le triplet cabine/soute/fret à **toutes** les fiches.
Air Tahiti Nui n'a pas de politique de soute, et `politiqueDuCanal` **lève** plutôt que de déduire
une décision d'un `cls` éditorial : le build de production s'est arrêté sur elle. Le garde avait
raison — c'est ma question qui inventait un canal. La FAQ n'interroge plus que les canaux que la
fiche **déclare**, exactement comme la carte.

## Ce qui reste ouvert

**À l'arbitrage de Codex** — les poids de races dans le bloc « notre classification », maintenus
avec leur désaveu (ci-dessus).

**À un lot ultérieur, nommé ici** — les `metaDesc` des 102 fiches annoncent encore « fares,
restrictions and official sources », alors que les tarifs et les restrictions ne sont plus
publiés. C'est une **inexactitude de métadonnée**, pas une affirmation sur le chien ; elle n'a pas
été corrigée ici pour ne pas ouvrir la revue des 102 fiches que la contre-revue a explicitement
écartée.

**À la décision de Philippe** — la fusion, et le déploiement.

---

# Annexe 2 — l'interrupteur n'était pas une frontière (contre-revue sur `5dee48f`)

## Le reproche central, et pourquoi il est juste

J'avais écrit que la dette éditoriale était devenue « inatteignable depuis l'interface ». Elle
était en réalité **à un booléen de distance** : `surfacesEditorialesAffichables = false` gardait
`ladder`, `restrictions`, `crate`, `temperature`, `assistance` et `goodToKnow`, et **tous leurs
lecteurs restaient dans le gabarit**. Repasser la constante à `true` — un caractère — aurait
republié d'un coup toute la couche non sourcée.

C'est la même erreur de raisonnement que celle de l'annexe 1, à un étage au-dessus : j'avais
vérifié **l'état** (le DOM est propre) et conclu sur la **propriété** (rien ne peut le salir).
Un contrôle sur le rendu constate ce qui sort aujourd'hui ; il ne dit rien de ce qu'un booléen
ferait sortir demain.

## Les quatre points

**P0-1 — les lecteurs sont supprimés.** Plus de constante, plus de branche JSX. Les six champs
n'ont **aucun lecteur** dans `AirlinePremiumPage.astro`. Les données restent intactes dans les
fiches ; leur retour au public exigera une implémentation neuve, alimentée par des preuves.

**P0-2 — la description publique ne promet plus ce que la page ne publie plus.** `d.metaDesc`
annonçait sur les 102 fiches « cabin, hold and cargo rules, **fares**, **restrictions** and
official sources » — dans la balise `description`, dans `og:description`, dans
`twitter:description` **et** dans le `WebPage` du JSON-LD. J'avais corrigé l'intérieur de la
fiche sans regarder ce qu'elle annonce d'elle-même à l'extérieur. Aucune fiche n'est réécrite :
le gabarit produit une description neutre, tenue dans le **catalogue de traductions** — donc
réellement déclinée en espagnol et en portugais. `inlineF` n'aurait pas suffi : sa table
portugaise est indexée par la phrase anglaise, et le portugais serait retombé sur l'anglais.
La **même chaîne** sert les quatre zones.

**P0-3 — le bloc brachycéphale est supprimé des fiches compagnies.** Le reproche est plus fin
que celui que j'avais entendu, et il est juste : les poids ne sont pas le problème. Le problème
est que ce bloc n'**apparaît** sur une fiche compagnie que si `brachyRestriction(kbAir)` y trouve
une restriction **non prouvée**. Sa présence même établit l'association entre ces races et cette
compagnie — une affirmation qu'aucun désaveu ne défait, puisqu'elle est portée par le fait d'être
là. Ma déviation argumentée de l'annexe 1 est donc **retirée**, pas maintenue. S'y ajoutait une
phrase devenue fausse par mon propre masquage : « lis le texte de la compagnie ci-dessus », alors
que ce texte venait d'être retiré. La classification reste sur les **fiches races**.

**P1 — les coquilles.** La carte « Restrictions importantes » était rendue **vide** ; l'enveloppe
`.ladder` subsistait avec la phrase « Poids incluant le sac de transport ou la caisse » commentant
des seuils absents ; la carte « Température & soute » restait affichée avec un message générique
et un appel à l'outil de caisse sans rapport. Tout cela disparaît. L'appel à l'outil **survit**,
déplacé dans la carte des canaux et reformulé sans mention de la compagnie : il n'affirme rien, et
le calculateur est lui-même canonique — mesuré, il ne retient un gabarit de cabine que sur un
statut `allowed`, ce qu'aucune politique ne vaut plus.

**Les puces ne sont plus filtrées par émoji.** Mon filtre `🗓`/`🚫` était une liste noire : la
première puce affirmant quelque chose sous une autre icône serait repassée. `d.chips` n'est plus
lu du tout ; les trois identités structurelles sont **rebâties** depuis `alliance`, `country_id`
et `hub_airport_ids`. Ce qui n'a pas de champ canonique n'a plus de puce.

## Les quatre preuves

1. **Aucun lecteur** des champs retirés dans le gabarit — contrôle sur la **source**, commentaires
   retirés d'abord (chaque suppression y est expliquée en nommant son champ : sans cela le
   contrôle s'accuserait lui-même, ce qui m'est déjà arrivé dans ce dépôt). Avec un témoin de
   non-vacuité — le code utile doit survivre au décommentage — et une contre-épreuve : un lecteur
   réintroduit serait attrapé.
2. **Aucune ancienne `metaDesc`** dans les quatre zones publiques, toutes renseignées et portant
   **exactement** la même chaîne.
3. **Aucun bloc brachycéphale** sur les fiches compagnies.
4. **Aucune section vide** sur les fiches sentinelles — 64 cartes réellement examinées, témoin de
   non-vacuité à l'appui ; une carte réduite à son titre serait signalée.

## Une garantie voisine, re-fondée plutôt qu'abaissée

`test-inventaire-iata.mjs` § 6 bis exigeait la **présence** du titre reformulé « La cage de
transport en soute » — parce que la section existait et qu'il fallait vérifier qu'elle ne réclamait
plus la norme IATA. La section supprimée, la contre-épreuve rougissait. **Mouvement nommé** : elle
exige désormais l'**interdiction** (l'ancien titre ne revient pas) et conditionne l'exigence
portugaise à la présence du titre — elle dort tant que rien ne le rend, et mord dès qu'il
reparaît. La garantie n'a pas baissé : ce qui ne se rend plus ne peut plus rien affirmer.

## Ce que la fiche compagnie publie désormais

Son identité ; les statuts canoniques des canaux réellement déclarés ; la citation stricte quand
elle existe ; sinon un message prudent et le lien officiel disponible ; des liens génériques vers
les outils. Rien d'autre.

## Vérifications

`test:unit` vert · frontière 133/133 · entités **164/164** · built-ui 793/793 ·
`build:prod` 3 113 pages · porte 29/29 · navigateur 79/79.

**À la décision de Philippe** — la fusion, et le déploiement.

---

# Annexe 3 — deux rougeurs de CI, et ce que mes contrôles locaux ne voyaient pas

## `astro check` : un commentaire dans une liste d'attributs

`Vérifications` est tombée sur `check-astro-debt.mjs` : **dette 175 → 188**, dont **13 erreurs**
dans `AirlinePremiumPage.astro` — `ts(1005)`, `ts(1002)`, `ts(1109)`, `ts(2657)`, `ts(7008)`.

Cause unique : un commentaire `{/* … */}` que j'avais placé **dans la liste d'attributs** de
`<FaqBlock>`, entre `title` et `note`. Le build Astro l'accepte et produit un HTML correct ;
`astro check` non — en position d'attribut, `{/* … */}` se lit comme une expression, et **tout le
fichier** part en erreur de syntaxe à partir de là. Le diagnostic le plus visible désignait un
`<OnwardNav />` vingt lignes plus bas, qui n'avait rien de fautif.

**Ce que cela dit de ma vérification.** `npm run typecheck` ne couvre pas les `.astro` : il lance
`tsc` sur `knowledge`, `engine` et `workers`. J'avais donc trois builds verts, 164 contrôles
d'entités verts, et une erreur de syntaxe dans le gabarit — invisible à tout ce que je lançais.
**`check-astro-debt.mjs` fait désormais partie de ce que je joue avant de pousser.**

`chiffresEnGras` et ses quatre expressions sont supprimés du même mouvement : leur unique
appelant était le défaut corrigé à l'annexe 1. Du code mort dont la seule raison d'être était de
mettre en gras des chiffres non prouvés est une invitation à les remettre.

## `faq-races` § 8 bis : la contre-épreuve a trouvé, sous une autre forme, la faute qu'elle visait

`Site entier` est tombée sur une phrase portugaise absente d'une fiche race. **Ce n'est pas mon
lot d'aujourd'hui** : la frontière de confiance a vidé `bestAirlines` le 04/09/2026 (`2d1afe6`) —
plus aucune politique n'est `allowed` —, et la note qui explique le classement ne se rend donc
plus. La contre-épreuve réclamait une phrase qui n'a plus d'objet.

Elle protège en réalité une propriété plus générale : **aucun repli silencieux vers l'anglais sur
la page portugaise**. Portée sur la phrase réellement rendue — celle qui dit pourquoi la section
est vide —, elle a **immédiatement rougi** : cette phrase n'avait aucune entrée dans
`translations/pt/inline.json`, et la fiche portugaise publiait bel et bien un paragraphe **en
anglais**. Le français et l'espagnol, eux, étaient traduits.

C'est le **même mécanisme** que celui documenté pour la description publique : `T(en, fr, es)`
n'a pas d'argument portugais, et `inlineT("pt")` retombe sur l'anglais dès que la table pt n'a
pas la clé. Deux occurrences dans le même lot ; c'est un motif, pas un accident.

Le contrôle a donc attrapé, sous sa nouvelle forme, exactement la faute qu'il avait été écrit
pour attraper. Les deux phrases d'origine restent exigées **si** le classement revient : elles
dorment, elles ne sont pas supprimées.

## Vérifications, tête `0b29a4f` + ces deux correctifs

`test:unit` vert · `astro check` **dette stable à 175** · frontière 133/133 · entités 164/164 ·
built-ui 793/793 · `faq-races` DOM vert · `build:prod` 3 113 pages · navigateur 79/79.

---

# Annexe 4 — la seconde constante, et une troisième fois le portugais

## P0 — j'avais corrigé un interrupteur en en laissant un autre, dans le même fichier

`scoreEtNoteAffichables = false` gardait `rating.score`, `rating.points` et `d.verdictNote`.
C'est **exactement** le défaut reproché à `surfacesEditorialesAffichables` — même fichier, même
mécanisme, à quarante lignes d'écart — et je ne l'ai pas vu en supprimant l'autre. J'avais même
écrit, en commentaire, que la constante était « écrite en clair pour que sa suppression soit un
geste délibéré » : une justification, là où il fallait une suppression.

Ce qu'ils affirmaient : `rating` est calculé sur des politiques dont **aucune** n'est prouvée —
un « 4,2/5 » donne à cette absence de preuve l'apparence d'une mesure ; `verdictNote` est une
phrase écrite avant la frontière (« Cabin and hold are both open »).

Supprimés : la constante, les trois branches JSX, `rating` et `scoreCls`. Les données restent.
Ce qui subsiste en tête de fiche est le verdict **dérivé**, qui ne lit que la politique canonique.

La garde de lecteurs couvre désormais **quatorze** identifiants, les deux constantes nommément.

## P1 — le portugais, une troisième fois, et la garde qui manquait

Mon nouveau libellé `"Check your crate size"` n'existait pas dans `pt/inline.json` : la page
portugaise serait retombée en anglais. Pire, en reformulant j'avais **perdu une traduction que
l'ancien libellé possédait** (`Confira o tamanho da caixa para esta companhia`). Le libellé
canonique déjà validé et déjà traduit est réemployé, sans en créer un de plus.

**Trois occurrences du même piège dans ce lot** — la phrase d'état vide des fiches races, ce
libellé, et une troisième que la garde a trouvée : la note de FAQ « This page summarises the
information currently on record… », que je publiais **en anglais sur la page portugaise** depuis
l'annexe 1. Trois fois, dont deux **après** l'avoir documentée.

Le mécanisme : `T(en, fr, es)` n'a pas d'argument portugais ; `inlineT("pt")` cherche la phrase
anglaise dans la table pt et, si la clé manque, publie l'anglais **sans rien signaler**.

Une garde ferme le trou pour ce gabarit : les phrases anglaises passées à `T(...)` sont relevées
dans la source et doivent toutes être connues de la table portugaise. Elle a rougi immédiatement,
sur la troisième occurrence. **Portée bornée, et elle le dit** : ce fichier, pas le dépôt. La
généralisation à toutes les surfaces reste à faire, et n'a pas été entreprise ici — c'eût été
ouvrir un chantier que la contre-revue a explicitement exclu.

## Une garantie voisine, re-fondée

`test-frontiere-confiance.mjs` exigeait que `scoreEtNoteAffichables` vaille `false`. La constante
supprimée, elle rougissait. **Mouvement nommé** : elle n'exige plus qu'un interrupteur soit dans
la bonne position, mais qu'il **n'y ait plus d'interrupteur ni de lecteur** — strictement plus
fort. Avec son témoin de non-vacuité.

## Vérifications

`test:unit` vert · `astro check` dette stable à 175 · frontière **134/134** · entités **171/171** ·
built-ui 793/793 · `faq-races` DOM vert · `build:prod` 3 113 pages · navigateur 79/79.

Vérifié sur le DOM construit : plus aucun `hv-score` ni `hv-pts`, et zéro repli anglais résiduel
sur la fiche portugaise.

---

# Annexe 5 — j'ai cessé de découvrir la CI un réveil à la fois

## Le vrai reproche à me faire

Trois lots de suite, j'ai poussé après avoir joué *mes* contrôles, et la CI a trouvé autre chose.
La cause n'est pas la malchance : **je ne jouais pas ce que la CI joue**. `npm run typecheck` ne
couvre pas les `.astro` ; sept contrôles ne tournent que sur un `dist` complet ; trois autres sur
un build de *preview*. J'ai donc énuméré les étapes du fichier de CI et je les ai toutes exécutées
d'un coup. **Trois échecs sont tombés ensemble** — dont deux que la CI n'avait même pas encore
atteints, s'arrêtant au premier.

## Les cinq contre-épreuves re-fondées — toutes de la même famille

Une même cause produit les cinq : **la frontière de confiance a retiré `allowed` à toutes les
politiques, et le lot a retiré `channels[].detail` de l'écran**. Des témoins écrits avant ces
deux gestes exigeaient donc soit un état qui n'existe plus, soit une phrase qui n'est plus servie.
Aucun n'a été abaissé.

| contre-épreuve | ce qu'elle exigeait | ce qu'elle exige maintenant |
| --- | --- | --- |
| `tarifs` § 5 quater | les **trois** états rencontrés dans le DOM | les états **que la base porte**, mesurés ; l'absence d'`allowed` est expliquée, jamais tolérée — et le contrôle se réarme seul le jour où une citation en produit un |
| `étape3` § 2 | les quatre combinaisons de canaux ouverts | idem, sur une base **synthétique déclarée**, avec l'état figé « aucun canal réel n'est `allowed` » à côté |
| `étape3` § 1 octies | les 8 phrases cargo corrigées **servies** au mot près | qu'**aucune** ne soit servie — la valeur reste scellée à la source par `test:unit` |
| `étape3` § 1 nonies | la phrase Thai de remplacement servie | ni l'ancienne **ni** la neuve servies ; à la source, rien ne change |
| `montants-propagation` § 2 | les 4 zones portent `d.metaDesc` | les 4 zones portent la **description canonique**, et `verdictNote` ne doit **pas** être publié |

Dans chaque cas l'exigence **monte** : on n'attend plus qu'une phrase soit exacte, on interdit
qu'elle paraisse. Et chaque contre-épreuve garde son sabotage : celui de `montants-propagation`
§ 2 bis, qui mutait un paragraphe désormais absent, **réintroduit** maintenant la note éditoriale
dans la page et exige qu'elle soit vue.

**Une erreur de ma main en chemin, mesurée puis corrigée** : pour la base synthétique j'avais
choisi Thai Airways, Aegean et British Airways « au jugé ». Aegean ne dessert aucun trajet de
contrôle, et les drapeaux du rapport ne découlent pas du seul statut — la cabine de Thai et la
soute de BA restent fermées par d'autres portes. J'ai mesuré quelles compagnies répondent
réellement sur leurs trois canaux, et retenu celles-là.

## Le scellé des licites, re-scellé par son geste

`occurrences-licites-scellees.json` enregistre où les tournures IATA licites sont **publiées**.
Les lecteurs éditoriaux retirés, huit entrées sont devenues orphelines. Le dépôt a un geste nommé
pour cela — `--sceller-licites` — et c'est lui qui a réécrit le scellé, jamais une main.

**Diff relu avant d'accepter** : 32 → 20 occurrences, 25 → 16 clés. **Que des retraits**, aucune
occurrence publiée ajoutée — Neos « caisse aux normes IATA jusqu'à 48 × 35 × 29 cm », Swiss
« IATA ventilation limits », Air Mauritius « IATA rules ». Le mouvement va dans le sens du lot.

## Ce qui n'est PAS une régression, et pourquoi je le dis plutôt que de le « corriger »

`test:audit-obs` échoue sur mon `dist` local et **doit** y échouer : il exige du rapport d'audit
une ligne INFO qui n'existe que sur un build de **preview** (`noindex` sur toutes les pages).
En CI, `audit` et `test:audit-obs` tournent après `build:preview` ; mon `dist` est un build de
production. De même, `contre-epreuves --dom` et `--dist-complet` **refusent** de tourner sur un
arbre sale : ils mutent des fichiers et les restaurent par `git checkout`. Les trois sont joués
après ce commit, sur arbre propre.

## Vérifications locales

Joués et verts : `test:unit`, `typecheck`, `check`, `ingest:check`, `smoke`, `test:provenance`,
`test:index-hub`, `test:migration-categories`, `test:couvertures`, `test:fetch-couvertures`,
`test:annonce`, `test:liens`, `test:guide-page`, `test:built-ui`, `test:entities`, `audit`,
`check-astro-debt`, `contre-epreuves --contrat`, et les sept contrôles sur `dist` complet
(`faq-races`, `tarifs`, `montants-publies`, `montants-propagation`, `caisses-non-sourcees`,
`etape3-dom`, `fiches-affirmations-retirees`).

---

# Annexe 6 — le contre-test navigateur a vu ce qu'aucun test technique ne regardait

La CI était verte sur les trois parcours, la préversion `9dca579a` techniquement conforme — et un
visiteur y lisait encore **du texte de diagnostic**, des **classements obsolètes** et plusieurs
**recommandations non étayées**. C'est la démonstration de ce que la préversion sert à trouver.

## P0-1 — mon commentaire s'est publié lui-même

Le pire du lot, et il est entièrement de ma main. Pour expliquer une correction, j'avais écrit un
commentaire qui **citait la syntaxe de commentaire en exemple** — `{/* … */}`. Cette citation
contient `*/}`, qui **referme le commentaire par anticipation** : les quatre lignes suivantes sont
devenues du texte publié, sur **toutes les fiches compagnies, dans les quatre langues**, juste
avant la FAQ. Un visiteur lisait « JSX expressions must have one parent element » et
« check-astro-debt.mjs ».

Le commentaire est supprimé, son histoire vit ici. Un **détecteur** a été écrit et vérifié contre
la version fautive : il repère un commentaire refermé trop tôt en cherchant, après la fermeture,
une queue de lignes en « * ». Zéro occurrence restante.

**Et surtout, la garde qui manquait** : `test-lib/verifier-seuils-fiches.mjs` lit désormais le
**TEXTE VISIBLE** des fiches construites et refuse tout vocabulaire de développement — nom de
fichier `.astro`/`.mjs`, « astro check », « TODO », ou un fragment de syntaxe de commentaire.
Les contrôles DOM existants cherchaient des **éléments nommés** ; aucun ne lisait ce qu'un
visiteur **lit**. Contre-épreuve faite sur une page réellement sabotée avec le texte fuité.

## P0-2 — l'accueil republiait ce que les fiches venaient de perdre

Il affichait « Turkish 4,9 », « Air France 4,8 », des rangs numérotés, « compagnies classées selon
leur compatibilité » et « chaque compagnie notée … sourcé et daté ». Ce sont **exactement** les
notes que la frontière a retirées des fiches. Les effacer de la fiche et les laisser sur la page
la plus vue du site, c'était **déplacer l'affirmation, pas la retirer**.

Le classement, les rangs et les scores sont supprimés. Reste une liste **triée par nom** : un tri
alphabétique n'affirme rien, un tri par note affirme tout. Les libellés « les meilleures
compagnies », « compagnies adaptées aux chiens » et « vérifié régulièrement » sont reformulés.

## P0-3 — la page « à propos » promettait ce que l'audit dément

Elle affirmait que **chaque** politique vient d'une source primaire officielle, que « rien n'est
inventé », et que chaque fiche porte source, date et confiance. Mesure : sur 302 politiques de
canal, **une seule** repose sur une phrase citée. Une page « à propos » qui sur-promet est plus
grave qu'une fiche qui sur-promet — c'est là que le visiteur décide s'il nous croit. Elle décrit
maintenant les deux états réels, et dit que le reste est en cours de revue.

## P0-4 — le réseau commercial présenté comme un réseau « avec chiens »

« Où Air France vole avec les chiens » : la source est le réseau **commercial**, qui ignore tout
de la politique animaux. Titre remplacé par « Réseau de {compagnie} et formalités des
destinations », avec une phrase qui dit que desservir n'est pas accepter. `noPetCountries` —
des exclusions **catégoriques sans citation** — n'a plus de lecteur.

## P0-5 — les fiches races recommandaient encore

Saisons notées en étoiles, pays « recommandés » (France, États-Unis, Royaume-Uni) et « à éviter »
(Émirats), risque d'embargo, difficulté, « niveau recommandé », « basé sur … les canaux
disponibles et les politiques publiées » — alors qu'**aucun canal n'est établi comme accepté**.
Tous ces lecteurs sont supprimés.

**Une faute déjà commise, refaite** : j'avais retiré ces affirmations du corps de la fiche et les
avais **laissées dans sa FAQ**, où « meilleure saison » et « un vol direct est-il recommandé ? Oui
— court/moyen-courrier » survivaient. C'est exactement ce qui s'était passé sur les fiches
compagnies. Les deux réponses sont retirées.

**Déviation nommée, soumise à arbitrage** : j'ai **gardé** les trois axes physiologiques — chaleur,
respiration, tolérance au froid. Ils décrivent le chien, pas une politique, et la contre-revue ne
les a pas nommés. Si leur méthode est jugée indéfendable, ils tomberont au prochain lot.

## Les deux P1

Le calculateur publiait « une caisse cabine rigide fait environ **44 × 30 × 19 cm** max » — des
dimensions écrites en dur, sourcées nulle part, et contredisant le principe même de l'outil
(le gabarit dépend de la compagnie). Retirée. Le Finder disait « 0 compagnies directes
**compatibles** · 27 compagnies » : devenu « 0 option confirmée · 27 pistes à vérifier », dans les
quatre langues.

## Vérifications

`test:unit` vert · `typecheck` vert · `astro check` **dette 175 → 166**, référence rescellée par
son geste · frontière **134/134** · entités **172/172** · built-ui, liens, annonce, guides, hub :
verts · les sept contrôles sur `dist` complet : verts · `build:prod` 3 113 pages · navigateur
**79/79**.

Vérifié sur le DOM construit, dans les quatre langues : plus aucun texte de développement, plus
aucun score ni rang sur l'accueil, plus aucune recommandation de saison ou de pays sur la fiche
race, plus de dimensions génériques dans le calculateur.

**La préversion `9dca579a` ne doit pas être promue.** Une nouvelle sera à créer sur ordre de
Philippe, après CI verte sur cette tête.

---

# Annexe 7 — les trois axes physiologiques : ma déviation est écartée

J'avais gardé « risque chaleur », « risque respiratoire » et « tolérance au froid » en les jugeant
physiologiques donc attribuables. L'arbitrage les retire, et il a raison sur le fond :

| axe | ce qu'il affirmait | pourquoi c'est indéfendable |
| --- | --- | --- |
| chaleur | un **risque** en avion | la source est une note DogTime de **tolérance** — pas la même question |
| respiration | `brachy ? élevé : faible` | la branche « faible » affirme un risque respiratoire **faible sur 150 races** sans rien avoir mesuré |
| froid | un niveau de tolérance | proche de sa source, mais **déduit du pelage** dès que la note manque |

Les replis `coat → heat/cold` et `brachy → respiratory` sont des déductions internes : ils restent
en donnée, jamais en affirmation publique.

**Ce qui est retiré** : les trois lignes du « Travel DNA », et la grille d'indicateurs — qui ne
rendait plus qu'eux, et serait devenue un titre au-dessus de rien.

**Ce qui reste** : le lien vers le **calculateur** de risque chaleur, qui part du trajet, de la
date et des températures — donc répond à une question réellement calculable. Et, pour une race
brachycéphale, un **fait sans qualification** : « Certaines compagnies appliquent des restrictions
particulières aux races brachycéphales ; confirme la règle applicable au vol auprès du
transporteur effectif. » Le renvoi au transporteur **effectif** compte : en partage de code, ce
n'est pas toujours celui qui vend.

## La garde, et la faute que j'y ai commise

Contrôle DOM sur les quatre langues : ni grille d'indicateurs, ni ligne Chaleur/Froid/Respiration
dans le « Travel DNA », **et** le lien vers le calculateur présent — sans cette seconde moitié,
une page vide passerait.

**Ma première rédaction cherchait le texte « Risque chaleur » dans tout le HTML.** Elle a rougi en
français, espagnol et portugais — sur le **lien vers l'outil**, « 🌡 Risque chaleur en soute »,
c'est-à-dire exactement ce que l'arbitrage demande de conserver. Un contrôle qui accuse ce qu'il
doit protéger est inutilisable. Il porte désormais sur la **structure** — `.bt2-indcell` et les
libellés de `.bt2-dnalbl` — avec un témoin de non-vacuité exigeant que le « Travel DNA » reste
peuplé.

## Vérifications

`test:unit` vert · `astro check` **166 → 165**, référence rescellée · frontière 134/134 ·
entités 172/172 · built-ui, liens, annonce, guides, hub verts · les six contrôles sur `dist`
complet verts · `faq-races` **8 ter vert** · `build:prod` 3 113 pages · navigateur 79/79.

Une restitution reste possible dans un lot distinct : afficher la note DogTime **comme telle** —
« tolérance déclarée par DogTime » —, sans la transformer en risque aérien, sans repli inventé,
et avec sa source visible.

**La préversion `ad57ac1` / `9dca579a` demeure invalide et ne doit jamais être promue.**

---

# Annexe 8 — le troisième lecteur, et le faux témoin que j'avais écrit

## Ce que la contre-vérification de `8f155bd` a trouvé

**Pour la troisième fois le même motif.** J'avais retiré chaleur et froid du « Travel DNA » et de
la grille d'indicateurs, et laissé l'**« Aperçu voyage »** (`.bt2-snap`), qui les publiait encore.
Masquer une surface et en oublier une autre : fiches compagnies, puis FAQ des races, puis ceci.

**Et ma garde mentait.** Elle ne lisait que les deux surfaces corrigées et concluait « aucune
qualification de risque ». Un contrôle qui rend un verdict qu'il n'a pas mesuré est pire que pas
de contrôle : il rassure.

**Le défaut différé.** La note globale appliquait toujours une pénalité de chaleur (jusqu'à 26
points) et 8 points pour une race brachycéphale. Aujourd'hui elle est masquée faute de canal
établi — rien ne paraît. Mais le jour où une citation établira un canal, elle redeviendrait
publique **en portant** deux déductions que l'arbitrage venait d'écarter, sans que personne les
revoie.

## Fermeture

- l'aperçu voyage se réduit aux **trois canaux** ;
- la note ne se calcule plus **que** sur les canaux — seule chose que ce dépôt sait établir par
  citation ; `heat` et `brachy` n'y entrent plus ;
- la garde 8 ter exige **exactement** trois cellules dans l'aperçu — une liste fermée ne peut pas
  accueillir un quatrième axe en silence ;
- **8 quater** : la liste des champs publiés est **relevée dans le gabarit** (ses `p.<champ>`),
  pas écrite à la main — un champ rebranché entrerait de lui-même dans le périmètre. Le profil
  est calculé sur la base réelle puis sur une base où `heat_tolerance`, `cold_tolerance` et le
  pelage sont modifiés : **aucun des 17 champs publiés ne bouge**, et un témoin vérifie que la
  mutation mord bien ailleurs dans le profil.

## Ce dont je suis sûr, et ce dont je ne le suis pas

Sûr, parce que mesuré : les 17 champs publiés ne contiennent aucun axe physiologique ; aucun
verdict physiologique n'apparaît dans le DOM construit, quatre langues, sur une race ordinaire
et sur une brachycéphale ; la note est insensible à la physiologie.

Pas sûr : qu'il n'existe aucune surface que ni la contre-revue ni moi n'avons regardée. La
différence avec les trois fois précédentes : la preuve est désormais **structurelle** — une liste
relevée dans la source — et non une énumération de mémoire.

---

## Annexe 9 — Contre-test navigateur de la préversion 82fcf408 (07/09/2026)

La préversion `82fcf408`, construite depuis `main` à `92b2b9f`, a été parcourue au navigateur.
Le moteur, les fiches compagnies, les fiches races et le calculateur de caisse ont tenu. Cinq
blocs de défauts rédactionnels sont ressortis. Ce qui suit dit ce qu'ils étaient, ce que j'ai
corrigé, et **ce que j'ai mesuré au-delà de ce qui m'était rapporté**.

### 1. Des chiffres majorés à l'accueil, et un press kit qui les dépassait encore

`HomeSections.astro` multipliait chaque compte par 1,2, arrondissait vers le haut et ajoutait
un « + » : **102** compagnies devenaient « 120+ », **140** pays « 160+ », **172** races « 200+ »,
**268** aéroports « 300+ ». Le commentaire d'origine assumait le geste — « boosted up to +20%
… per product decision ». Une décision de produit ne rend pas un chiffre vrai, et le « + »
promettait encore au-delà de la majoration.

Le press kit, lui, portait quatre valeurs écrites à la main : « 90+ », « 160+ », « 200+ »,
« 250+ ». Deux étaient **supérieures** au corpus réel, deux inférieures : figées à une date, elles
dérivaient dans les deux sens sans que rien ne le signale. Une plaquette de presse est reprise
telle quelle par ceux qui la lisent ; un chiffre faux y voyage plus loin qu'ailleurs.

Les deux surfaces lisent désormais `loadKB()` et affichent le compte exact, sans majoration ni
« + ». « Des milliers d'itinéraires » est **retiré et non corrigé** : aucune mesure d'itinéraires
n'existe dans ce dépôt. Une ligne qu'aucun calcul ne soutient ne peut pas être ramenée à sa vraie
valeur, seulement disparaître jusqu'à ce qu'une mesure existe. Les clés de traduction dorment.

### 2. Le portugais : trois phrases rapportées, cinquante-six trouvées

Le contre-test a vu trois phrases anglaises sur `/pt/about/` : le titre de méthode et les deux
paragraphes qui distinguent le vérifié du à-confirmer. **Ce sont exactement les trois textes que
j'avais réécrits au lot précédent.**

Le mécanisme est celui que j'ai déjà nommé trois fois : `T(en, fr, es)` n'a pas d'argument
portugais ; `inlineT("pt")` cherche la phrase anglaise dans la table pt et, si la clé manque,
publie l'anglais sans rien signaler. La garde que j'avais écrite pour le fermer était **bornée à
un seul gabarit**, `AirlinePremiumPage.astro` — déviation que j'avais nommée et jugée acceptable.
J'ai ensuite réécrit trois phrases dans un gabarit hors de sa portée.

La mesure complète, faite après le rapport, a relevé **56 phrases sur 12 gabarits** : Destinations
23, Finder 10, calculateur chaleur 9, fiches races 3, À propos 3, press kit 2, et six autres à une.
Le contre-test n'en avait vu que trois parce qu'il avait ouvert une page *statique* ; les autres
ne paraissent qu'après une interaction. **Le coût de la borne était de 53 phrases publiées en
anglais sur des pages portugaises, invisibles à tout ce que je jouais.**

Fait qui achève de condamner la borne : mes propres corrections de ce lot — nouveau titre
d'accueil, nouveau libellé du lien compagnies, nouvelle phrase de présentation — en ont créé
**cinq de plus** avant même que j'aie fini. Le total traduit est de **60 clés** (61 occurrences ;
« Travel Hub guides » est employé par deux gabarits).

Aucune exclusion n'a été retenue. Les cas qui auraient pu en être — la marque `MyDogCanFly`, le
nom de rubrique `Travel Hub`, `IATA`, `USDA APHIS`, `WOAH`, les noms propres — sont des
**fragments** à l'intérieur de phrases, pas des phrases : ils restent tels quels dans la
traduction, la phrase qui les porte est traduite.

La garde est étendue à **tout fichier de `packages/ui/src` appelant `inlineT`/`inlineF`** : 44
gabarits, 852 phrases relevées, zéro sans portugais. Elle porte son témoin de non-vacuité — retirer
une clé de la table la fait rougir.

### 3. « Beaucoup de compagnies refusent », aux quatre endroits où elle vivait

Le contre-test citait la phrase de `detailNonEtabli()`, publiée deux fois sur la fiche du carlin.
Elle affirmait que les races au museau court « sont exposées aux embargos chaleur saisonniers et à
des restrictions respiratoires », sans une seule citation — et elle paraissait **juste après** un
paragraphe disant « ce n'est pas un refus, c'est une absence de preuve ». La page se contredisait
d'une phrase à l'autre.

Le commentaire que j'avais laissé au-dessus la défendait comme « une PRÉCAUTION de catégorie qui,
elle, reste vraie ». Une précaution qui affirme qu'un risque existe est une affirmation.

Quatre emplacements traités, dont trois que le rapport ne nommait pas :

| Emplacement | État | Geste |
|---|---|---|
| `breedTravel.ts` · `detailNonEtabli` | publié, ×2 sur le carlin | supprimé ; le paramètre `brachy` disparaît avec |
| `breedTravel.ts` · `holdVerdict` | dormant (aucun canal établi) | le compte mesuré reste, la supposition part |
| `breedTravel.ts` · `cargoVerdict` | dormant | idem |
| `pagedata.ts` · `breedTravelView` | dormant (gabarit non rendu) | réécrit, sur ordre explicite |

Les trois derniers ne paraissent pas aujourd'hui : sans canal établi, c'est `detailNonEtabli` qui
sort, et `EntityPage.astro` ne rend plus les fiches races. Mais ils **reviendraient à l'écran dès
la première citation qui établit un canal**. C'est le défaut différé que j'avais déjà nommé pour
le score — cette fois je ne le diffère pas.

Ce que le site dit désormais des races brachycéphales tient dans une phrase unique et prudente,
`race.brachy_prudence`, rendue une fois sur la fiche.

*Ce que j'avais écrit ici, et qui était faux* : « le contre-test attribuait au calculateur de
caisse la variante "Beaucoup de compagnies refusent ces races en soute" ; cette phrase n'existe
nulle part dans le dépôt ». **Elle existe, dans les quatre langues.** Elle est dans
`packages/ui/src/pages/[...loc]/tools/crate.astro`, à la fin de la réponse FAQ sur la marge de
10 %. Voir l'annexe 10, qui dit comment je l'ai manquée et pourquoi cette erreur est la plus
grave des trois du lot.

### 4. L'accueil promettait encore « la meilleure compagnie »

Le corps de l'accueil était devenu prudent au lot précédent, mais son **titre principal** disait
toujours « Trouve la compagnie aérienne idéale ». Trois surfaces portaient la même promesse, et
deux d'entre elles sont plus reprises que la page elle-même :

- le H1 et son chapeau, dans les quatre langues ;
- les **quatre descriptions SEO** de l'accueil — « Find the best airline for your dog »,
  « les compagnies aériennes qui acceptent les chiens », « Encuentra la mejor opción » — et le
  titre français, qui annonçait « 90+ compagnies » pour 102 ;
- trois lecteurs : `HeatCalculator.astro`, `CountryOnward.astro`, et le titre « Meilleures
  compagnies pour cette race » des fiches races.

Tous disent maintenant ce que le site fait réellement : donner les conditions, et dire pour
chacune si elle est prouvée.

### 5. Ce que je n'ai pas fait, et pourquoi

`CountryGuidePage.astro` et `AirportReliefPage.astro` portent la même formulation — « les
compagnies documentées qui desservent ce pays **et acceptent les chiens** » — sur 140 pages pays.
Ces surfaces n'étaient pas dans le lot arbitré. Je les nomme ici : c'est le même défaut, il reste
publié, et il demandera un arbitrage.


---

## Annexe 10 — J'ai opposé une recherche vide à une observation directe (07/09/2026)

### Ce qui s'est passé

Le contre-test navigateur avait **lu à l'écran**, en portugais, sur la préversion, une phrase du
calculateur de caisse affirmant que beaucoup de compagnies refusent les races brachycéphales en
soute. Je l'ai cherchée, je ne l'ai pas trouvée, et j'ai écrit — dans un message, dans un commit
poussé et dans ce dossier — qu'elle **n'existait nulle part dans le dépôt**.

Elle existe, dans les quatre langues, dans `tools/crate.astro` :

> « … c'est une marge de confort MyDogCanFly, pas un chiffre imposé par l'IATA. **Beaucoup de
> compagnies refusent par ailleurs ces races en soute.** »

### Deux fautes de méthode, et la seconde est la vraie

**La première est technique.** J'ai cherché « refusent ces races ». Le texte dit « refusent **par
ailleurs** ces races » : deux mots intercalés, et le motif ne trouve rien. J'ai ensuite cherché
dans `CrateCalculator.astro` — le composant — alors que la phrase vit dans la **page**. Ce
mécanisme du qualificatif intercalé porte un nom dans ce dépôt : c'est le défaut **P0-1** d'un lot
antérieur, que j'ai moi-même corrigé et documenté. Je l'avais écrit, et je m'y suis repris.

**La seconde est de raisonnement, et c'est celle qui compte.** Une recherche qui ne trouve rien
**ne prouve rien** : elle dit que *ce motif-là*, dans *ces fichiers-là*, n'a rien vu. J'en ai tiré
une affirmation d'inexistence, et je l'ai opposée à quelqu'un qui avait **vu la phrase à
l'écran**. C'est l'inverse exact de la règle de ce projet : la surface rendue arbitre, jamais ma
recherche. Un rendu observé est une mesure ; un grep vide est l'absence d'une mesure.

Cette erreur est plus grave que la phrase elle-même. La phrase était un défaut de plus dans un lot
qui en corrigeait cinq. L'affirmation, elle, invitait à classer une observation juste comme une
erreur de l'observateur — et si Codex n'avait pas insisté en donnant le chemin du fichier, la
phrase serait partie en production avec ma signature en dessous.

### Ce que je change, au-delà de la correction

Le contrôle qui garde cette phrase **lit le DOM construit, pas la source** (§7 de
`test-fiches-affirmations-retirees.mjs`). Un contrôle qui lit la page rendue ne peut pas être
trompé par un mot intercalé, et il voit ce que le visiteur voit — ce que mon grep ne faisait pas.
Ses motifs tolèrent explicitement jusqu'à trois mots intercalés, et son témoin de non-vacuité
exige qu'ils reconnaissent les **huit** phrases réellement retirées ce jour-là, la version « par
ailleurs » comprise.

### Le second point du même arbitrage : desservir n'est pas accepter

`CountryGuidePage.astro` et `AirportReliefPage.astro` annonçaient « les compagnies qui desservent
ce pays **et acceptent les chiens** » — 140 pages pays, autant de pages aéroport, quatre langues,
plus la métadonnée des pages aéroport. Je l'avais relevé au lot précédent et rangé en « hors
périmètre, à arbitrer ».

C'était une erreur d'appréciation : ce n'est pas un chantier voisin, c'est **le même défaut**. La
fonction `dogAirlinesForCountry` ne sélectionne pas des compagnies acceptantes ; elle retient
celles dont un canal est **documenté** (`dogChannel(a) !== "none"`). Le titre, le chapeau et le
compteur promettaient donc un état que la donnée n'établit pas — et depuis la frontière de
confiance, aucune politique n'est prouvée acceptante.

Les trois surfaces distinguent maintenant les deux choses : **desservir est constaté, accepter est
à vérifier fiche par fiche.** Les sept clés portugaises qui portaient l'ancienne promesse sont
**retirées** de la table, et non laissées dormantes : une clé orpheline qui contient la promesse
peut la réintroduire au premier gabarit qui reprend son libellé.

---

## Annexe 11 — Le contrôle que j'avais écrit pour fermer un trou en ouvrait quatre (07/09/2026)

### Un contrôle qui annonce ce qu'il ne fait pas

L'annexe 10 se félicitait d'un point : le nouveau §7 « lit le DOM construit, pas la source », donc
« ne peut pas être trompé par un mot intercalé ». C'était vrai de la phrase qu'il visait, et faux
de tout le reste.

Pour lire ce DOM, je lui avais donné **sa propre fonction** : le contenu de `<main>`, les scripts
retirés, les balises effacées à l'expression régulière. Il ne voyait donc **ni les métadonnées, ni
le JSON-LD, ni les attributs accessibles**. Les métadonnées : celles-là mêmes que le commit
portant ce contrôle venait de corriger. Le JSON-LD : il reprend la FAQ d'accueil mot pour mot.
Un contrôle qui garde une correction sans voir la surface corrigée est un faux vert.

`test-lib/zones-publiques.mjs` existe depuis le 02/09/2026 et rend exactement ces cinq zones. Son
en-tête raconte les trois rédactions successives qu'il a fallu pour qu'il soit juste — dont un
`<title>` de SVG perdu, qui laissait passer un montant dans un nom accessible. J'en ai écrit une
quatrième à côté, sans le lire. C'est très précisément le défaut que ce fichier a été créé pour
clore, et qu'il énonce dans sa deuxième phrase :

> « Ce qui compte comme "publié" ne peut pas dépendre de l'instrument qui regarde. »

### Trois autres trous, tous relevés en contre-revue

- **Trois pages pays et trois aéroports par langue**, dans l'ordre du système de fichiers. Le
  gabarit est unique, mais les données ne le sont pas : c'est une donnée — un compteur, un nom —
  qui peut ramener la promesse sur une page et pas sur une autre. Le contrôle lit maintenant
  **toutes** les pages pays, aéroports et caisse, plus les quatre accueils, dans un ordre trié.
- **Aucune exigence de présence.** Supprimer purement et simplement les blocs corrigés laissait le
  contrôle vert : une interdiction seule ne garde rien. Il exige désormais, **par langue**, que la
  formulation prudente soit effectivement servie.
- **Les anciens titres absents des témoins.** « Airlines flying to … with a dog » pouvait revenir
  sans faire rougir quoi que ce soit. Les témoins passent de 8 à 21 phrases.

### Ce que je retiens, et qui vaut au-delà de ce contrôle

Trois fois dans ce lot, j'ai produit un instrument qui **disait** garder quelque chose sans le
garder : la constante booléenne au lieu d'une suppression, le grep vide opposé à une observation,
et maintenant un lecteur maison annoncé comme un lecteur de DOM. À chaque fois la faute est la
même — j'ai décrit l'intention de l'outil plutôt que sa portée réelle, et cette description m'a
servi de preuve.

La règle qui en sort : **avant d'écrire un lecteur, chercher celui qui existe** ; et quand un
contrôle prétend couvrir une surface, le prouver en supprimant cette surface pour le voir rougir.
C'est ce que fait l'exigence de présence ajoutée ici.

### Et le portugais, une fois de plus

Les cinq chaînes écrites la veille employaient `tua`, `teu`, `verificámos`, `junto da` — du
portugais européen, alors que le composant déclare et emploie partout un registre **brésilien**
(`você`, `seu`, `cachorro`). Le balayage complet de mes ajouts en a trouvé **9 sur 65**, pas 5 :
je traduisais phrase par phrase sans relire le registre du fichier d'accueil.

Toutes sont réalignées. Ce n'est pas un détail de style : une page qui alterne les deux registres
signale au lecteur qu'elle a été écrite par une machine qui ne sait pas à qui elle parle — et sur
un site dont l'argument est la fiabilité, cela coûte la même confiance qu'un chiffre faux.

---

## Annexe 12 — Quatre gardes vertes qui ne gardaient pas, et un PDF que je n'ai pas su refaire (07/09/2026)

### Le scanner portugais annonçait une couverture qu'il n'avait pas

Il cherchait les appels nommés `T`, `L` ou `F` — trois noms que j'avais **écrits à la main** après
avoir regardé quelques fichiers. Le dépôt en emploie un quatrième, `Q`, et appelle aussi
`inlineT(locale)(…)` directement. Un nom d'alias écrit en dur est une supposition sur le code ;
le code le déclare, il suffisait de le lire. La découverte se fait maintenant **par fichier** —
et c'est une seconde correction, car `q` est un alias de traduction quelque part et le
**constructeur de chaîne de requête** dans `RelatedTools.astro`. Réunis globalement, ces
homonymes gonflaient le compte sans être des traductions : c'est l'écart entre les 861 appels
annoncés en contre-revue et les **854** que je mesure.

Il décodait aussi les littéraux avec deux `replace`, pour `\'` et `\"`. Conséquence mesurée : le
corps du courriel des fiches aéroport contient des `\n`. La clé lue par le scanner gardait ses
barres obliques inverses, celle de la table portait le vrai saut de ligne — deux clés différentes,
`inlineT` ne trouvait rien, et les **268 fiches d'aéroport portugaises** préremplissaient le
courriel **en anglais** pendant que la garde restait verte. Le décodeur est maintenant explicite
et éprouvé sur cinq formes, dont celles qui l'ont fait échouer.

### Une substitution mécanique n'est pas une relecture

J'avais « corrigé » le registre portugais avec des expressions régulières. Elles ont produit
`verifiqueção` — un mot qui n'existe dans aucune langue, né d'un `verifica → verifique` appliqué à
l'intérieur de `verificação`. Et elles ont laissé des phrases qui mélangent deux personnes
grammaticales dans la même ligne : *« Compara … e verifique »*, *« Escolha … ou consulta »*,
*« lê lá … e confirme »*.

Les 66 chaînes du lot ont été **relues une par une**. C'est la seule méthode qui convienne : une
règle de substitution ne sait pas si `confirma` est un impératif européen à corriger ou la
troisième personne d'un indicatif à laisser.

### Une exigence de présence qui acceptait n'importe quelle page

Le §7 vérifiait la phrase de l'accueil avec `f.includes("index.html")`. **Toute** page Astro se
rend en `…/index.html` : la garde serait restée verte si la phrase avait disparu de l'accueil pour
être copiée sur une page pays. L'ancrage est désormais exact, et **l'attaque est jouée** sur le
corpus réel — on retire la phrase de l'accueil, on la copie sur une page pays, le contrôle doit
rougir. Il l'a fait, mais seulement à la seconde tentative : ma mutation n'avait pas le drapeau
`g` et n'en retirait qu'une des deux occurrences, car la FAQ d'accueil est publiée **deux fois**,
dans le corps et dans le JSON-LD qui la reprend. La garde avait raison, ma mutation était
incomplète.

Le lecteur canonique rend aussi `jsonLdInvalide`. Annoncer « cinq zones lues » en ignorant ce
compte, c'était dire qu'on a regardé une zone dont on n'a rien pu tirer. Il est exigé nul.

### Le press kit corrigé d'un côté, faux de l'autre

J'avais refait la page dynamique et laissé les **quatre HTML téléchargeables**, qui portaient
encore `90+` compagnies, `160+` destinations, `169` races — et surtout **« 100 % informations
sourcées »**, quand 45 canaux sur 302 portent une citation propre. Les quatre fichiers sont
corrigés : les comptes réels, et une tuile qui dit ce qui est mesurable (302 politiques
documentées) au lieu d'un pourcentage faux.

**Ce que je n'ai pas su faire** : régénérer les quatre PDF. Ils sont produits par un composant web
`<doc-page>` qui, dans mon environnement, ne rend aucune hauteur — mes essais donnaient des
fichiers de 900 octets, c'est-à-dire des pages blanches. Plutôt que de publier des PDF dégradés ou
de laisser en ligne des documents portant les anciens chiffres, **je les ai retirés**. Le gabarit
teste déjà l'existence du fichier : les boutons de téléchargement disparaissent d'eux-mêmes. Les
HTML restent, corrigés. C'est la seconde option de l'arbitrage, et je dis pourquoi j'ai dû la
prendre plutôt que la première.

### Le contre-test navigateur ne protégeait rien

Il n'était lancé par **aucun workflow**. Ses « 104/104 » figuraient dans mes messages de commit
comme s'ils protégeaient la branche : ils attestaient seulement que je l'avais lancé à la main.
Il est câblé au catalogue complet, avec Playwright installé pour la circonstance. Et son repli est
corrigé : hors CI, une absence de Playwright reste un « non joué » ; **en CI, c'est un échec** —
un contrôle qui ne s'est pas exécuté ne doit pas rendre une coche verte.

---

## Annexe 13 — Corriger cinq tuiles et déclarer la surface traitée (07/09/2026)

### La quatrième fois

J'ai corrigé les cinq compteurs des dossiers de presse téléchargeables et écrit qu'ils étaient
corrigés. La contre-revue a ouvert les fichiers en entier : ce sont des **copies publiques d'un
produit antérieur**. Ils publiaient encore, dans quatre langues :

- la série de caisse **« 500 / XL »** et son « ≈ 94 × 64 × 68 cm » — la série commerciale non
  sourcée retirée des fiches race et du calculateur ;
- **chaleur et froid « lus sur les données de la race »** — les déductions retirées du Travel DNA ;
- **« meilleures compagnies »**, **« score de compatibilité »**, **« recommandations sur mesure »**
  — les promesses que la frontière de confiance interdit ;
- **« chaque règle renvoie à une documentation officielle »** — quand 45 canaux sur 302 portent une
  citation propre ;
- une date de vérification figée et des promesses de révision continue.

C'est la **quatrième fois** dans ce chantier que je masque une surface en en laissant une autre :
la carte compagnie puis la FAQ, le corps de fiche race puis la FAQ, l'ADN puis l'aperçu voyage, et
maintenant la page dynamique puis les documents. Le motif est constant : je corrige ce que la
revue **nomme**, et je déclare corrigé ce qu'elle **désigne**.

Les quatre HTML avaient été retirés, comme les PDF avant eux. **Philippe a décidé le 07/09/2026
de les rétablir en l'état** et de traiter ces documents dans un lot séparé.

Ce qui doit rester écrit, parce que la décision ne le change pas : ces fichiers vivent dans
`public/`, sont copiés dans le site construit, servis à `/presskit/press-kit-<lg>.html`, proposés
au téléchargement par la page de presse et déclarés dans `porte-noindex-admis.json`. **Ils sont
publics**, et ils décrivent toujours un produit antérieur. Leur exclusion du contrôle est une
déviation nommée, pas un constat de propreté.

Deux choses ont été conservées de la correction : les cinq compteurs restent exacts
(102 / 140 / 172 / 4 / 302), parce que réintroduire sciemment des chiffres faux aurait été un
geste actif contre le critère de lancement, que la décision de rétablir ne demandait pas ; et le
contrôle annonce à chaque passage combien de documents sont publiés **sans être audités**, en
refusant que ce nombre dérive en silence.

### La page dynamique portait les mêmes promesses

Six formulations corrigées : le score de compatibilité, « chaque règle porte l'autorité dont elle
vient », « chaleur et froid lus sur les données de la race », « chaque règle porte sa source […]
revérifiées tous les 90 jours », « nous répondons avec la source et sa date de vérification », et
le moteur qui « montre d'où vient chaque réponse ».

### Le contrôle ne cherchait que des nombres

Mon §6 lisait les compteurs et le suffixe `+`. Il serait resté vert devant toutes les phrases
ci-dessus. Onze motifs de promesse s'y ajoutent, avec témoin de non-vacuité sur les neuf phrases
réellement retirées, et une exigence que les documents téléchargeables **restent retirés**.

Ces motifs ont attrapé mes propres corrections avant que je les termine : les six phrases neuves
de la page press kit n'existaient pas dans la table portugaise, et la garde des replis l'a dit
immédiatement.

### Le scanner annonçait encore une couverture qu'il n'avait pas

Il commençait par `if (!aliasDe(src).length) continue;` : un gabarit n'employant **que** l'appel
direct `inlineT(locale)(…)`, sans déclarer d'alias, aurait été ignoré en silence. Aucune fuite
réelle — le seul appel direct vit dans `faq.ts`, qui déclare aussi des alias — mais la prétention
de couverture générale était fausse, et c'est elle qui compte : un contrôle qu'on croit général
dispense d'en écrire un autre. Le `continue` est supprimé, et une contre-épreuve **fabrique** le
cas : un fichier jetable ne contenant qu'un appel direct, dont la clé manque à la table, doit être
lu.

---

## Annexe 14 — Un tarif publié, et deux verbes qui manquaient à un motif (07/09/2026)

### Ce que mon inventaire avait manqué

Les quatre dossiers de presse téléchargeables ont été rétablis le matin même, sur décision de
Philippe, après que je lui ai listé ce qu'ils contenaient encore : score de compatibilité,
« meilleures compagnies », « chaque règle sourcée ». La contre-revue a ouvert les fichiers et y a
trouvé ce que je n'avais pas mesuré :

> **400 € par trajet, sur cette route**

En gros caractères orange, dans les **quatre langues**. C'est la famille de défaut que le lot
« Tarifs » traitait comme **bloquant le lancement**, et elle était en ligne, téléchargeable, depuis
le début. La décision de rétablir avait été prise sur mon inventaire incomplet ; Philippe l'a
reprise dès que le fait a été connu.

Même mécanisme pour la série de caisse « 500 / XL » et son « ≈ 94 × 64 × 68 cm » : la série
commerciale non sourcée, retirée des fiches et du calculateur des semaines plus tôt, survivait ici.

### Les deux leçons du contrôle, qui valent plus que les corrections

Les quatre HTML sont corrigés — tarif, série, traçabilité universelle, score, physiologie,
« meilleures compagnies », recommandations sur mesure, date de vérification figée — et **remis dans
le balayage**. Un document proposé au téléchargement est une surface publique comme une autre, et
une surface publique qu'aucun contrôle ne lit finit par dériver.

Une fois remis, le contrôle a rougi **deux fois de suite**, sur des choses qu'aucun de nous n'avait
vues :

1. **Sur ma propre reformulation.** J'avais remplacé « chaque règle renvoie à une documentation
   officielle » par « chaque règle publiée porte sa propre date de vérification ». C'est la même
   affirmation universelle, déplacée de la source vers la date. J'avais échangé une promesse contre
   une autre en croyant corriger.
2. **Sur une phrase que mon inventaire manuel avait manquée** : « chaque règle nomme son autorité »,
   présente dans les quatre langues. Mon motif listait `porte | renvoie | indique | est sourcée` —
   il voyait le portugais (`indica`) et pas les trois autres (`names`, `nomme`, `nombra`). Puis, le
   témoin de non-vacuité en a trouvé une troisième : le motif anglais disait `every rule`, la
   légende dit `each rule`.

**Un verbe oublié dans une liste de verbes ouvre un trou de la taille de la liste.** Deux fois dans
le même paragraphe, un synonyme absent a rendu le contrôle aveugle à une phrase qu'il visait
explicitement. C'est le même défaut que le qualificatif intercalé de l'annexe 10, sous une autre
forme : ma recherche décrit ce que j'ai pensé à écrire, jamais ce que le texte dit.

### Les PDF

Ils portaient les mêmes phrases et je ne sais pas les régénérer : leur composant `<doc-page>` ne
rend aucune hauteur hors de son environnement d'origine, et mes essais donnaient des pages blanches
de 900 octets. Ils sont **retirés**, et leur absence est désormais **exigée** par le contrôle —
tant que personne ne peut garantir leur contenu, ils restent dehors plutôt que publiés sans garde.

---

## Annexe 15 — Un cinquième lecteur, et le trou qu'il a fini par trouver (07/09/2026)

### Le même défaut, dans le même lot, quelques heures après l'avoir écrit

L'annexe 11 raconte comment j'avais donné au §7 sa propre lecture du HTML au lieu d'employer
`test-lib/zones-publiques.mjs`, et pourquoi c'était un faux vert. J'ai écrit cette annexe le matin.
L'après-midi, en remettant les dossiers de presse sous contrôle, j'ai écrit une **cinquième**
lecture — `texteDe()`, quatre expressions régulières — dans `test-annonce-du-site.mjs`.

Une ligne suffisait à la rendre aveugle :

```html
<meta name="description" content="€400 each way">
```

La phrase est publique, et le contrôle passait à côté. Écrire mon propre lecteur n'est pas un
oubli, c'est un réflexe : il faut le nommer comme tel pour cesser de le refaire. `texteDe` est
supprimé ; toutes les surfaces du paragraphe — accueils, pages de presse, documents — passent par
`zonesDe()`. Les documents sont désormais lus dans `dist/presskit/`, là où ils sont réellement
publiés, et non dans `public/` : lire la source revenait à faire confiance à la copie du build
plutôt qu'à la vérifier. Un JSON-LD illisible fait échouer, comme dans les autres portes.

### L'attaque a trouvé mieux que ce qu'elle visait

Les deux contre-épreuves demandées réintroduisent une phrase interdite dans une zone que le lecteur
maison ne voyait pas : le tarif dans une métadonnée, la promesse universelle dans un attribut
accessible. La première a été vue immédiatement. **La seconde ne l'a pas été.**

Ce n'était pas l'attaque qui était mauvaise. `zonesDe` injecte le HTML dans un `<div>` réutilisé —
c'est ce qui lui permet de tenir sur 3 121 pages sans épuiser le tas. Or le parseur y jette `html`,
`head` et `body` en ne gardant que leurs enfants : **les attributs portés par ces balises partent
avec elles**. Un `aria-label` sur le corps est pourtant lu à voix haute par un lecteur d'écran
comme n'importe quel autre texte, et il échappait à **toutes** les portes qui emploient ce lecteur.

C'est la même cause que le `<title>` de SVG perdu en septembre — la troisième rédaction de ce
fichier — et c'est sa quatrième correction. Les attributs de `<html>` et `<body>` sont maintenant
relevés sur le HTML brut, avant l'injection, en n'acceptant que les attributs déjà reconnus comme
accessibles ailleurs dans le même fichier.

Vérifié qu'aucune autre garde ne rougit de cet élargissement : `tarifs`, `montants-publies`,
`montants-propagation`, `caisses-non-sourcees`, `étape3` et `affirmations-retirées` restent vertes.

### Ce que je retiens

Une contre-épreuve écrite pour prouver qu'un contrôle voit une zone a prouvé qu'il ne la voyait
pas — et le trou n'était pas dans le contrôle, mais dans l'instrument partagé sous lui. C'est
exactement ce à quoi sert une attaque : elle ne confirme pas ce qu'on croit, elle mesure.

---

## Annexe 16 — La correction du lecteur était un parseur de plus (07/09/2026)

### Ce que l'annexe 15 avait corrigé, et mal

L'annexe 15 raconte comment une contre-épreuve a découvert que `zonesDe()` perdait les attributs
portés par `<html>` et `<body>` : l'injection par `innerHTML` dans un `<div>` réutilisé jette ces
balises en ne gardant que leurs enfants. La correction relevait donc ces attributs sur le HTML
brut, à l'expression régulière `<body\b([^>]*)>`, en découpant les guillemets à la main.

**Trois formes parfaitement valides lui échappaient**, mesurées en contre-revue sur le lecteur
réel :

| HTML public | ce que le lecteur rendait |
|---|---|
| `<body aria-label="&#x20AC;400 each way">` | `&#x20AC;400 each way` — l'entité n'était pas décodée |
| `<body aria-label="€400 each way > confirmation required">` | vide — le `>` fermait la balise trop tôt |
| `<body aria-label=€400>` | vide — sans guillemets, rien n'était vu |

Un prix rendu **« €400 »** à l'écran pouvait donc traverser toutes les gardes tarifaires.

### Le défaut, commis à l'intérieur du fichier qui le combat

`zones-publiques.mjs` existe pour qu'il n'y ait **qu'un seul** lecteur de HTML dans ce dépôt. Sa
deuxième phrase le dit : *« ce qui compte comme publié ne peut pas dépendre de l'instrument qui
regarde »*. J'y ai écrit un analyseur de HTML à la main.

C'est la troisième fois dans ce lot que je réécris un lecteur au lieu d'employer celui qui existe —
le §7 des affirmations retirées (annexe 11), le §6 de l'annonce (annexe 15), et maintenant
**dedans**. Le réflexe survit à sa propre documentation : je l'ai nommé deux fois et je l'ai
recommis deux fois. Ce qui l'arrête n'est pas de le comprendre, c'est qu'une contre-épreuve le
mesure.

### Deux gestes, et aucun ne devine

- Un **scanner qui suit les guillemets** délimite la balise ouvrante : un `>` entre guillemets ne
  ferme plus rien, et une balise jamais fermée ne rend rien plutôt qu'une valeur inventée.
- Les attributs sont **réinjectés sur un `<div>` neutre** et lus par `getAttribute` : c'est le
  **même parseur** que tout le reste du fichier qui décode — avec ou sans guillemets, entités
  comprises. Le lecteur ne fait plus que déléguer.

### Six cas, pas trois

Le §13 de `test-zones-publiques.mjs` couvre les trois formes signalées, plus l'attribut porté par
`<html>`, les guillemets simples et la balise auto-fermante — un cas par forme, parce qu'un seul
les aurait toutes crues couvertes. Deux témoins l'encadrent : une page sans attribut de racine ne
doit **rien** rendre, et un attribut non accessible (`data-prix`, `id`) doit rester dehors.

Les sept gardes qui emploient ce lecteur — `tarifs`, `montants-publiés`, `montants-propagation`,
`caisses-non-sourcées`, `étape3`, `affirmations-retirées`, `annonce` — restent vertes après
l'élargissement.

---

## Annexe 17 — Trois scanners pour une balise, et le parseur qu'il fallait appeler (07/09/2026)

### Le même mur, trois fois

La correction précédente relevait les attributs de `<html>` et `<body>` avec un scanner qui suivait
les guillemets. Il ne connaissait pas le **contexte HTML** :

```html
<script>const t = "<body aria-label=piege>";</script>
<body aria-label="€400 each way">        →  le lecteur rendait « piege »
```

Le faux `<body>`, écrit dans une chaîne JavaScript et jamais servi à personne, précédait le vrai
dans le fichier. Le lecteur prenait le premier venu, et le prix réellement affiché passait sous les
gardes tarifaires. Même effet avec un `<!-- <body …> -->`.

C'est la **troisième rédaction** de la même chose à buter sur le même mur :

1. expression régulière `<body\b([^>]*)>` — cassait sur les entités, le `>` dans une valeur, et
   l'absence de guillemets ;
2. scanner à guillemets — corrigeait ces trois formes, ignorait le contexte ;
3. et il aurait fallu un troisième correctif pour les commentaires, puis un quatrième pour les
   `<textarea>`, et ainsi de suite.

À chaque tour, j'ai corrigé le symptôme signalé **en gardant l'approche fautive**. Écrire un
analyseur de HTML est un métier, et ce fichier existe précisément pour n'en avoir qu'un.

### Ce qu'il fallait faire dès le départ

`parse5` est déjà installé : c'est le parseur que **jsdom emploie sous le capot**. Il lit le
document selon les règles HTML — commentaires, scripts, styles, modes de texte brut — sans qu'on
ait rien à lui expliquer.

Un adaptateur d'arbre délègue tout au sien et **s'interrompt dès que `<body>` est construit**. À cet
instant, le parseur a déjà traversé toute la tête ; le reste du document ne coûte rien.

### La mesure, parce qu'un arrêt anticipé demande à être justifié

Sur les 3 121 pages du site complet :

| | Durée | Tas |
|---|---|---|
| parse complet de chaque page | 116 s | 0 Mo |
| **arrêt dès `<body>`** | **4,8 s** | **0,2 Mo** |

Et le lecteur entier ne bouge pas : **47,9 s / 227 Mo** avec `parse5`, contre **48,0 s / 226 Mo**
avec le scanner, sur 500 pages. Le poids du lecteur vient de jsdom sur le corps, pas de la
localisation de la racine — la question du coût, qui avait justifié le `<div>` réutilisé en
septembre, ne se posait pas ici.

### Neuf cas, et un témoin qui manquait

Le §13 de `test-zones-publiques.mjs` couvre maintenant : entité, chevron dans la valeur, absence de
guillemets, guillemets simples, balise auto-fermante, attribut sur `<html>`, faux `<body>` en
script, faux `<body>` en commentaire, faux `<html>` en commentaire. Un cas par forme — un seul les
aurait toutes crues couvertes.

Trois témoins l'encadrent : une page sans attribut de racine ne rend **rien** ; `data-prix` et `id`
restent dehors ; et **le piège seul, sans vrai `<body>` derrière, ne rend rien** — sans ce
troisième, le contrôle serait satisfait par un lecteur qui rend la première valeur venue.

## Annexe 18 — Le parseur était bon, le rangement effaçait une valeur (07/09/2026)

### Le défaut, et il ne venait plus de l'analyse

L'annexe 17 avait enfin confié la localisation de `<html>` et `<body>` à `parse5`. Mais ce que le
parseur rendait, je le rangeais dans une **`Map` indexée par nom d'attribut** :

```js
const lus = new Map();
for (const { name, value } of [...attrsHtml, ...attrsBody]) lus.set(name.toLowerCase(), value);
```

`<html>` et `<body>` sont **deux éléments**, et rien n'interdit qu'ils portent le même attribut.
Quand c'est le cas, le second écrase le premier :

```html
<html aria-label="€400 each way"><body aria-label="ordinary label">
        →  le lecteur ne rendait que « ordinary label »
```

Un prix publié sur la racine disparaissait derrière un libellé anodin porté par le corps — une
surface accessible réelle, masquée par la structure de données que j'avais choisie pour la ranger.
Mesuré sur le lecteur avant correction : `["ordinary label"]`, et rien d'autre.

### Pourquoi une `Map`, et pourquoi c'était faux

Je l'avais prise pour **dédoublonner** — sans me demander ce qu'il y avait à dédoublonner. Deux
attributs de même nom sur deux éléments distincts ne sont pas un doublon : ce sont deux textes,
lus à voix haute l'un après l'autre. Une `Map` répond à la question « quelle est la valeur de
`aria-label` ? », qui n'est pas la question du lecteur. La sienne est « qu'est-ce qui est publié ? »
— et la réponse est une liste, pas un dictionnaire.

C'est la **septième correction** de ce fichier, et la première qui ne porte pas sur la lecture du
HTML mais sur ce qu'on fait du résultat une fois lu. Le mur avait changé de place ; je ne l'ai pas vu
parce que je regardais encore l'ancien.

### Le correctif, tel que Codex l'a formulé

Plus de fusion par nom. Chaque liste d'attributs est **filtrée** sur les six noms accessibles, puis
les deux sont **concaténées** dans l'ordre du document — `<html>` puis `<body>`. Les deux occurrences
sont conservées, parce que les deux sont lues.

Le §13 de `test-zones-publiques.mjs` reçoit deux cas — `aria-label` sur les deux balises, `title`
sur les deux balises — avec deux valeurs distinctes et **l'exigence que les deux soient lues**.
C'est ce qui distingue un lecteur qui cumule d'un lecteur qui choisit : un lecteur qui n'en rend
qu'une échoue, et c'est mesuré — la `Map` rétablie le temps d'une contre-épreuve, le §13 tombe sur
exactement ces deux cas et se relève quand elle est retirée.

Onze formes couvertes désormais, contre neuf ; les trois témoins de l'annexe 17 inchangés.

### Et l'arrêt anticipé de l'annexe 17 cachait une surface, lui aussi

En regardant la même catégorie — *ce que le navigateur publie sur la racine* — plutôt que le seul
cas signalé, une seconde chose est apparue, que je n'avais pas cherchée la veille. L'annexe 17
interrompait le parseur **dès que `<body>` était créé**, au nom d'une mesure : 24 fois moins cher.

Mais une balise `<html>` ou `<body>` rencontrée **plus loin** dans le document n'est pas jetée par
le navigateur. La règle HTML (« in body », start tag `body` / `html`) lui fait **adopter**, sur
l'élément déjà construit, les attributs qu'il ne portait pas encore. Mesuré le 07/09/2026, sur
parse5 comme sur jsdom :

```html
<html><body><p>x</p><body aria-label="€400 each way"><html title="€400 par trajet">
   parse5  →  html.attrs = [title="€400 par trajet"]   body.attrs = [aria-label="€400 each way"]
   jsdom   →  documentElement.title = "€400 par trajet"   body.aria-label = "€400 each way"
   lecteur (arrêt anticipé)  →  ""
```

Un prix que le navigateur publie, et qu'aucune porte ne voyait. L'arrêt anticipé avait acheté sa
vitesse avec une surface accessible réelle.

**Et la vitesse elle-même était mal pesée.** Les 116 s contre 4,8 s de l'annexe 17 comparaient un
parse complet mesuré seul à un arrêt anticipé mesuré seul, sans les rapporter au lecteur entier.
Remesurés **sous la même charge**, sur les 500 mêmes pages :

| | 500 pages | rapporté à 3 121 |
|---|---|---|
| arrêt dès `<body>` | 0,5 s | 3,1 s |
| parse complet, arbre entier | 3,2 s | 19,9 s |
| parse complet, sans texte | 2,9 s | 18,1 s |

Rapport de **6**, non de 24. Et le lecteur entier coûte **48 s** sur ces mêmes 500 pages : le parse
complet lui ajoute **7 %**. J'avais optimisé, avec une exception et un symbole, 1 % du coût total —
et la surface perdue valait plus que ces 1 %.

**Huitième correction** : plus d'exception, plus de signal d'arrêt. Le parseur va au bout, les
éléments `html` et `body` sont capturés à leur création, et leurs attributs sont lus **après** —
une fois que le parseur a fini de leur adjoindre ce que le document leur adjoint. Le §13 reçoit les
deux cas tardifs, et un **témoin en sens inverse** : quand le corps porte déjà l'attribut, la balise
tardive ne le remplace pas — le navigateur garde le premier, le lecteur aussi. Sans ce témoin, un
lecteur qui lirait *des balises* plutôt que *ce qui est publié* passerait, et inventerait une
surface que personne ne voit.

Treize formes couvertes ; l'arrêt anticipé rétabli sur une copie du lecteur, exactement les deux
cas tardifs tombent et tout le reste tient.

### Ce que je retiens, cette fois

Deux erreurs dans une même fonction de vingt lignes, l'une signalée, l'autre trouvée en cherchant
autour de la première. La méthode du projet dit *mesurer avant de concevoir* ; elle dit aussi de
regarder **la catégorie** d'un défaut signalé, pas seulement son exemplaire. Les sept corrections
précédentes de ce fichier ont chacune corrigé l'exemplaire. Celle-ci est la première à avoir
cherché le voisin avant qu'on le lui montre.

## Annexe 19 — « Le parseur que jsdom emploie » était une phrase, pas une mesure (07/09/2026)

### Ce que Codex a trouvé

`parse5` était importé directement par le lecteur partagé, mais **aucun `package.json` du dépôt ne
le déclarait**. L'import résolvait vers ce que l'arbre de dépendances laissait à la racine :

```
npm ls parse5   (avant)
+-- @mydogcanfly/ui → astro@4.16.19 → @astrojs/markdown-remark → hast-util-from-html → parse5@7.3.0
`-- jsdom@30.0.1 → parse5@8.0.1        (imbriquée : node_modules/jsdom/node_modules/parse5)
```

La racine résolvait donc `parse5@7.3.0`, **apportée par hasard par Astro**, pendant que jsdom
employait réellement sa propre `8.0.1`. J'avais écrit « le parseur que jsdom emploie lui-même » dans
le fichier et dans deux annexes. C'était faux : deux versions majeures distinctes, et l'identité du
lecteur partagé dépendait de l'arbre de dépendances d'un générateur de site. Une mise à jour d'Astro
pouvait changer ou casser le lecteur sans qu'aucune ligne du dépôt ne bouge.

### Pourquoi je ne l'ai pas vu

Parce que ça marchait. L'import résolvait, les treize cas passaient, et j'ai pris la résolution pour
une déclaration. La méthode du projet dit *mesurer avant d'affirmer* ; j'ai affirmé l'identité d'un
parseur sans avoir tapé `npm ls`. C'est la même faute que les chiffres du press kit : une phrase qui
sonne juste et que personne n'a mesurée.

### Le correctif, tel que Codex l'a formulé

`parse5@8.0.1` déclarée en `devDependencies` à la racine, **épinglée** (`--save-exact`), et inscrite
au lockfile. L'import direct est conservé : il résout maintenant la même version majeure que jsdom.

```
npm ls parse5   (après)
+-- @mydogcanfly/ui → astro → … → parse5@7.3.0   (imbriquées, deux fois, sous hast-util-*)
+-- jsdom@30.0.1 → parse5@8.0.1 deduped
`-- parse5@8.0.1
```

Vérifié avant d'installer : la `8.0.1` est **ESM seule** (plus de build CommonJS), ce qui convient au
lecteur, et les trois points d'API qu'il emploie — `Parser.parse`, `defaultTreeAdapter.createElement`,
`adoptAttributes` — existent à l'identique et rendent les mêmes attributs sur le cas de collision et
le cas tardif.

Le lockfile bouge sur six entrées, toutes `parse5` ou sa dépendance `entities` : la `8.0.1` de jsdom
remonte à la racine avec son `entities@8.0.0`, les deux `7.3.0` d'Astro descendent sous
`hast-util-from-html` et `hast-util-raw` avec leur `entities@6.0.1`. Mesuré (`npm ls entities`) :
aucun autre paquet ne dépend d'`entities`, personne ne change de version sans l'avoir demandé.

Rejoué sur ce SHA : lecteur 13/13, `test:unit` intégral, contre-épreuves `--tout`, `build:prod` et
porte de lancement ; la CI rejoue le harnais navigateur.

## Annexe 20 — Le contre-test de `6dc1c56d` : trois surfaces où deux instruments disaient deux choses (08/09/2026)

### Le verdict de Codex

Préversion `6dc1c56d` (main à `dbf9efe`) : techniquement valide, **pas promue**. Les PDF de presse sont
bien absents. Trois défauts publics réels restent, et un point éditorial.

1. Les quatre HTML publics du press kit montrent encore l'ancien produit.
2. Le Finder portugais sert un paragraphe réglementaire **anglais** : Paris → New York, Golden
   Retriever, 30 kg, 15 octobre → « Dogs need a readable microchip… ».
3. Le Finder **contredit la fiche British Airways** : BA via LHR y est « Política a confirmar »,
   « nenhuma frase citada », la cabine sans « Não aceito » — la fiche, elle, montre le refus cabine,
   la citation et la date. L'accueil affirme aussi qu'aucun canal n'est confirmé par une source
   citée.

Slogan anglais « Can my dog fly? For sure. » sur l'accueil portugais : classé éditorial.

### 2. La règle anglaise — mesurée à la source

`rules.json` : 401 règles, `rationale` en anglais partout, `rationale_i18n` **fr 401 / es 48 / pt 8**.
Règles pays : 189, **pt 0 / 189**, es 40 / 189. Le moteur (`toFired`) faisait
`rationale_i18n[locale] ?? rationale` — repli sur l'anglais, muet — et `explain` imprimait le
résultat. `pagedata.locRules` faisait exactement la même chose pour les fiches. Le Worker appelé
localement en `locale: pt` rend `conditions[0].text = "Dogs need a readable microchip…"`.

Ce n'est pas un défaut portugais : l'espagnol a le même trou sur 353 règles sur 401. Codex n'a
testé que le portugais.

**Pourquoi pas traduire.** 189 règles pays en portugais et 149 en espagnol, à la machine, en trois
jours : c'est la voie qui a produit « verifiqueção » (annexe 12), et une règle d'entrée mal
traduite est pire qu'une règle renvoyée à sa source.

**Ce qui est fait.** Le repli reste (l'anglais est le seul texte qui existe) mais il est **nommé** :
`FiredRule.rationale_locale` dit la langue réellement servie. `explain` ne sort plus jamais un
texte hors de la langue de la page : quand la règle n'est pas traduite, `text` est une formulation
de renvoi dans la langue demandée (`cond.rule_untranslated`, quatre tables) et l'original voyage à
part (`text_original`, `text_original_locale`). Le Finder le montre **replié et étiqueté** « Texto
original (em inglês) », avec le lien vers la source officielle. Les fiches font de même
(`EntityPage`). En anglais et en français, rien ne change — c'est le témoin de
`test-langue-du-rapport.mjs`.

**Une correction dormante, nommée.** Mesuré sur le site construit après correction : la section
« règles » d'`EntityPage` n'est rendue sur **aucune page** des quatre langues (`ep__rationale` :
0 occurrence), et aucune page statique pt/es ne publie le texte anglais de la règle US. Le seul
canal public du repli anglais était le Finder. La correction de `locRules`/`EntityPage` ferme le
même piège à sa source pour le jour où cette section sera servie ; elle ne change rien de publié
aujourd'hui, et ce n'est pas elle qui répond à Codex.

**Choix argumenté, pour arbitrage.** Montrer l'original anglais replié plutôt que le retirer : un
visiteur qui lit l'anglais garde l'information, celui qui ne le lit pas voit une page portugaise
qui dit d'où vient la règle. Codex peut juger que même replié, l'anglais n'a pas sa place ; le
retrait est alors une ligne.

### 3. British Airways — deux instruments, une donnée

Le moteur, appelé localement sur la requête de Codex : `cabin: denied` **avec** source
(britishairways.com, vérifiée 2026-09-05), `hold` et `cargo` : `confirmation_required`, causes
`official_source_unquoted` / `rule_official_unquoted`. Le libellé de carte « Política a confirmar »
et la phrase « aucune phrase citée » étaient donc **vrais pour le fret** — et présentés comme un
jugement sur toute la compagnie, pendant que la cabine, refusée sur citation, n'avait qu'une
**rature CSS** (`text-decoration: line-through`) : rien pour un lecteur d'écran, rien pour l'œil.

La fiche lisait la même projection et écrivait « Non accepté », la citation, la date. Même donnée,
deux rendus. Un canal `denied` ne l'est que sur preuve décisive (`evaluate.ts` ne refuse jamais sur
une page non citée) : quand la décision porte sa source, la carte l'écrit désormais en toutes
lettres — « Cabine ✗ · não aceito — recusa documentada por fonte oficial citada — britishairways.com
· 2026-09-05 » — et chaque cause de confirmation **nomme ses canaux** (« Porão, Carga : uma página
oficial cobre este canal… »). Sur cette route, un seul refus `denied` : BA cabine.

### 3 bis. L'accueil — « confirmé » n'est pas « confirmé ouvert »

`home.rated.sub`, quatre langues : « Aucun canal de compagnie n'est encore confirmé par une source
officielle citée. » Mesuré sur la projection : **0 ouverture prouvée, 1 refus prouvé, 301 à
confirmer sur 302**. (Les fiches YAML portent 3 citations — BA cabine, Thai fret, Virgin Australia
cabine — mais la projection n'en tient qu'une pour un refus ; les deux autres restent « à
confirmer », et c'est la projection que le site publie.) La phrase est maintenant **calculée au
build** depuis ces deux nombres, avec deux formulations selon qu'une ouverture est prouvée ou non,
et `test-accueil-canaux-prouves.mjs` recompte de son côté puis relit l'accueil construit dans ses
cinq zones publiques.

### 1 et le slogan — décisions de Philippe

Les quatre HTML du press kit sont des brochures de l'ancien produit : « Decision Engine™ », « The
right decision in minutes », « Verified information — sourced from official documentation »,
« book with confidence », « aligned with IATA Live Animals Regulations », un exemple Air France
catégorique. Cinq passes de correction phrase par phrase ont chacune laissé une surface. Le press
kit dynamique, lui, est validé. Retirer les quatre HTML (404 propre, comme les PDF) ou les
réécrire est une décision de contenu ; je la demande, avec une recommandation.

Le slogan « Can my dog fly? For sure. » : anglais sur les pages non anglaises, et « For sure » est
une réponse catégorique là où le site répond « confirmé ou à vérifier ». Décision éditoriale.

### P1 de Codex : le registre portugais des deux phrases d'accueil

Mes deux nouvelles phrases disaient « registado » — portugais européen, recopié de l'ancienne
phrase — pour une locale `pt-BR`. Corrigé : « registrado », deux chaînes, rien d'autre. Mesuré au
passage et **nommé pour arbitrage, non corrigé** (hors de la demande) : la table portugaise est
mixte — 29 « cachorro » contre 7 « cão » — et trois chaînes préexistantes de la même section ou
voisines gardent le registre européen : `home.hero.title` (« O teu cão pode voar? »),
`home.rated.title` (« …para o teu cão »), `premium.channel_unproven` (« registado », « Confirma »).
Le lot précédent avait relu 66 chaînes du gabarit en registre brésilien ; `strings.json` n'y était
pas.

### Une CI rouge de ma main, nommée (run 34213137943)

`test-accueil-canaux-prouves.mjs` lisait un dist par défaut et vivait dans `test:unit`, qui tourne
en CI **avant** le build : « index.html absent du dist », quatre fois. Localement je l'avais joué
après un build, et j'ai pris mon ordre d'exécution pour celui de la CI — le harnais navigateur
m'avait déjà appris cette leçon (annexe 14 : « le harnais décrivait ma machine »). Le test suit
maintenant la convention de `test-etape3-dom` : `--dist=` obligatoire, refus sans lui, étape de CI
après le build sur le site complet. Une garde qui se saute faute d'artefact ne garde rien ; une
garde qui cherche un artefact avant qu'il existe ne garde rien non plus.

### Une seconde CI rouge de ma main, nommée (run 34213783836)

La jauge de dette Astro — `check-astro-debt.mjs`, jouée en CI après le typecheck — est montée de
165 à 169 : quatre `ts(7006)` dans `FlightFinder.astro`, les paramètres de mes deux fonctions
fléchées `nommer(fam, d)` et `ligne(fam, texte)` laissés implicitement `any`. J'avais joué le
typecheck, qui ne compte pas cette dette, et pas la jauge, qui la compte : deux instruments, et
je n'ai regardé que celui qui ne pouvait pas rougir. Paramètres typés, jauge rejouée à 165 avant
de pousser.

### Ce que je retiens

Deux instruments lisant une même donnée doivent rendre la même chose, et ce dossier le sait depuis
l'annexe 11. La carte du Finder et la fiche BA lisaient la même projection ; l'une écrivait le
refus, l'autre le barrait. Le repli `?? rationale` existait à deux endroits, écrit deux fois de la
même main, avec le même silence. Ce lot ne corrige pas trois défauts : il corrige deux fois la
même chose, et la nomme.

### Ordre de Philippe (08/09/2026) : les PDF de presse rétablis, sans modification

Les quatre PDF avaient été retirés (`14bd13c`, puis `414b7f3`) parce qu'ils portaient le tarif
« 400 € par trajet » et les promesses de l'ancien produit, et que personne ne savait les refaire.
Philippe ordonne leur rétablissement tel quel. Exécuté : les quatre binaires reviennent depuis
l'arbre d'avant leur second retrait, et sont **identiques à l'octet** à ceux d'avant le premier
(mêmes blobs Git : `ff44ea2b`, `a8ba76a6`, `a337cf04`, `7d626021`).

Ce que la garde §6 ne peut pas faire : lire un PDF. Ce qu'elle fait désormais : exiger leur
présence (dépôt et dist), exiger leur identité avec les originaux (SHA-256 figées — « sans
modification » est l'ordre, tout changement sera un mouvement nommé), et **annoncer à chaque
passage** que quatre documents sont publiés sans avoir été relus. Une erreur au passage, nommée :
ma première sentinelle figeait dix-sept caractères d'empreinte mal découpés (seize premiers et le
soixante-quatrième) et comparait aux dix-sept premiers — la garde a rougi sur des PDF identiques.
Les empreintes sont maintenant entières, calculées par le code qui les vérifie. Ma réserve, nommée une fois :
ces documents contredisent la frontière de confiance que le reste du site respecte, et Codex les
avait classés P0. La décision est celle de Philippe ; le dossier la porte.

### Décisions de Philippe (08/09/2026) : les quatre HTML et le slogan restent tels quels

À la question posée avec recommandation, Philippe garde les quatre HTML du press kit en l'état
(cohérent avec l'ordre sur les PDF : les huit documents restent publics) et garde le slogan
« Can my dog fly? For sure. » tel quel, en anglais partout. Les deux sont nommés : la garde §6
annonce désormais, à chaque passage, combien de phrases de l'ancien produit relevées par Codex
restent publiées dans les HTML sans être couvertes par ses motifs — un vert qui dit ce qu'il ne
regarde pas plutôt qu'un vert muet. Codex les relèvera sans doute encore ; l'arbitrage est celui de
Philippe et le dossier le porte.

## Annexe 21 — La bascule du 08/09/2026, et le titre qui passait sous l'emblème

### La bascule, consignée

| | |
|---|---|
| `main` | `f40aaef` (fusion de PR #38, parents `dbf9efe` · `826e041`), CI 34219180429 verte |
| préversion validée | `b6310a0e`, Worker `0899fc52`, manifeste `verified`, contrôle navigateur Codex |
| Worker de production | `e2bcece5` déployé par Philippe à 13:01 UTC ; retour : `feb7b25d` (10 août) |
| Pages production | `ef4557b6` par `npm run release` ; retour : `b3b682e5` (`922786e`, 10 août) |
| contrôles en ligne | 200 sur accueil/`fr`/Air France/`fr/countries/fr`, `robots.txt` ouvert, 4 sous-sitemaps (634 URL en fr), aucun `noindex`, 301 de l'ancien calculateur, 404 préservée de l'outil chaleur, `/v1/health` → `f40aaef` |
| Finder réel (Codex) | PT, Paris → New York, Golden 30 kg : règle US renvoyée, « 0 opções confirmadas · 27 pistas », BA « Cabine : não aceito » avec source et date |

**Deux corrections de procédure, trouvées en marchant.** L'ordre que j'avais donné mettait le
Worker *après* `release` : Codex a montré que c'était la fenêtre d'état mixte à éviter — le moteur
d'abord, le contrat n'ayant fait que s'élargir. Et `preflight-production.mjs` demandait
`/fr/countries/france/`, une URL qui n'a jamais existé (les pays sont adressés par code ISO) : la
404 venait de ma liste, pas du site. Ce script omet aussi l'étape Worker ; il sera corrigé dans un
lot à part, avec le §8 de la doc de déploiement.

### Le titre du hero passait sous l'emblème

Relevé par Philippe sur le site en ligne, dans les quatre langues : la ligne orange du hero filait
sous l'emblème. Cause mesurée : `.hero__title` et `.hero__q` en `white-space: nowrap`, l'emblème
posé en absolu à droite (`clamp(280px, 34vw, 460px)`). Correction sans toucher aux textes : le
titre reçoit la place qui reste avant l'emblème et peut se replier, `text-wrap: balance` équilibre
les lignes ; la contrainte tombe sous 720 px, où l'emblème est masqué.

**Le harnais mesure, il ne lit pas le CSS** : sur les quatre accueils à 1 280 px, le bord droit
du titre doit rester à gauche du bord gauche de l'emblème. Témoin joué ici avec Playwright, sur le
même dist, ancien CSS réinjecté : 1 342 / 1 142 / 1 540 / 1 057 px contre un emblème à 759 —
le contrôle mord ; CSS corrigé : 711.

**Une erreur au passage, nommée.** Ma première mesure lisait le rectangle du *bloc* : avec une
largeur maximale, il reste à 711 px même si un `nowrap` remis fait déborder le texte. La mesure
porte maintenant sur l'étendue peinte (un `Range` sur le contenu), et le témoin le prouve.

**Et le titre portugais était plus petit** — relevé par Philippe dans la foulée. Cause mesurée dans
le CSS : la taille agrandie du hero était donnée à `--fr`, `--en`, `--es`, et aucune règle `--pt`
n'existait ; le portugais retombait sur la taille de base (34 px au lieu de 49). Même oubli dans
la règle mobile. Les quatre langues partagent maintenant la même règle, et le harnais exige que
la taille de police calculée du titre soit identique sur les quatre accueils.

## Annexe 22 — Le quatrième état, le seuil « chien + contenant », et ce que le Finder doit dire quand rien n'est prouvé (08/09/2026)

### Ce qui a été demandé, et par qui

Le dossier de preuves de Codex (08/09/2026, deux versions le même jour) et le lot P0 global
qu'il a demandé, endossé par Philippe, avec trois P0 supplémentaires de Philippe. Deux arbitrages
de Philippe, rendus par question fermée avant toute écriture :

| question | réponse de Philippe |
|---|---|
| un plafond publié « chien + contenant » et un formulaire qui ne connaît que le chien | **« Refus sûr au-dessus, jamais d'accord absolu en dessous »** — nouveau champ « le seuil inclut le contenant » |
| une politique `offered` prouvée : « accepté » ou « accepté sous conditions » ? | **« Quatrième état dans le contrat moteur »** — statut distinct d'`allowed`, qui disparaît des réponses publiées |

### Ce qui a été fait, mesuré avant

**Mesure d'entrée (KB réelle, 302 politiques) :** 0 `allowed`, 1 `denied` (BA cabine), 301
`confirmation_required` ; 3 politiques citées (BA cabine, Thai fret, Virgin Australia cabine).
Registre rejouable produit par un agent : A 3 / B 125 / C 175 / D 3 — sur `mesures/preuves/inventaire-compagnies.json`,
avec sa garde `test-inventaire-preuves.mjs` (44 contrôles) ; les 257 URL de page d'accueil
fabriquées ne valent jamais B, elles sont un signal (`url_fabriquee`).

**Le contrat.** `PlacementStatus` gagne `accepted_with_conditions` ; `allowed` reste dans l'énumération
mais **rien ne le produit plus** (déviation nommée : le retirer du contrat casserait des lecteurs
qui ne sont pas de ce lot ; il sortira par un mouvement à part). `PlacementPolicyCommon` gagne
`weight_includes_carrier` ; la décision du moteur gagne `weight_limit_kg` sur la branche du
quatrième état, pour que la carte écrive le plafond sans le promettre.

**La projection** (`projectPlacementPolicy`) : `offered` + citation → `accepted_with_conditions`,
plus jamais `allowed`. `not_offered` + citation → `denied`, inchangé.

**Le moteur** (`evaluate`) : si la politique est au quatrième état, que `weight_includes_carrier`
vaut `true` et que le chien SEUL dépasse `max_weight_kg`, le canal est `denied` avec le motif
`weight_limit`, et la source citée de la politique. Sans le champ : jamais un refus au seuil. En
dessous du seuil : jamais `allowed`. Le libellé (`explain`) dit « sous conditions » canal par canal
(`air.cond.*`, sept clés × quatre langues) ; le verdict est « Oui — sous conditions » et jamais
« Oui » sec quand tous les canaux ouverts sont conditionnels.

**Les surfaces** : fiche compagnie (`premium.accepted_conditions`, verdict `premium.verdict_open_conditions`),
carte du Finder (ligne « ✓ canal : accepté sous conditions … · plafond chien + contenant · hôte · date »,
badge `✓*`), accueil (le compte des canaux prouvés inclut le nouvel état), calculateur de caisse et
pages races (le nouvel état est « ouvert »).

### Les mouvements nommés

Quatre attentes de tests attendaient `allowed` sur une politique citée. Elles rougissaient par
construction et ont été **avancées, pas abaissées**, chacune avec un commentaire daté :
`test-frontiere-confiance.mjs` §1 (avec un témoin ajouté : la projection n'émet jamais `allowed`,
sur les quatre disponibilités, citées ou non), `test-t0a-statut-cause.mjs` ×2,
`test-tristate-climat.mjs` ×2 (soute sous le seuil de température ; cabine 5 kg, dont le verdict
passe de « compatible sauf formalités » à « conditional », et le commentaire dit pourquoi).

Nouveau harnais `test-quatrieme-etat.mjs` (25 contrôles, dans `test:unit`) : projection, KB réelle
(sentinelle : **0** politique au quatrième état tant qu'aucune citation `offered` n'est importée),
Golden 32 kg CDG → ATH sur une KB synthétique où Air France cabine est citée à 8 kg chien +
contenant (refus, motif `weight_limit`, source de la politique citée, soute non contaminée),
Cavalier 6 kg (accepté sous conditions, plafond transporté, verdict `conditional`, libellé « sous
conditions », prouvé d'abord dans le tri), quatre langues résolues.

### Les erreurs commises dans ce lot, nommées

1. **La projection perdait `weight_includes_carrier`.** Ajouté au schéma et au moteur, pas à la
   liste des champs qui traversent `projectPlacementPolicy` : le moteur n'aurait jamais refusé au
   seuil. Attrapé en écrivant le témoin, pas en relisant.
2. **`tousConditionnels` lisait `placements` sur un `AirlineResult`** (qui n'en a pas) : TypeError
   attrapée par le harnais climat. Réécrit sur `cabin_status`/`hold_status`/`cargo_status`.
3. **J'attendais 2 politiques réelles au quatrième état** (Thai fret, Virgin Australia cabine, les
   deux `offered` citées d'après ma mémoire). Mesuré : 0. Thai fret est `undocumented` (la phrase
   dit « contactez Cargo » — jamais convertie en fret accepté) ; Virgin Australia cabine est
   `case_by_case`. La sentinelle est posée sur la mesure, pas sur le souvenir.
4. **Sans le champ, j'attendais « accepté sous conditions » pour le Golden 32 kg** ; le moteur
   dit « à confirmer », parce que deux règles de poids non citées (`rule_af_cabin_weight`,
   `rule_global_cabin_weight_cap`) demandent encore confirmation. C'est le comportement voulu par la
   frontière ; l'attente était la mienne. Le témoin garantit « jamais `denied` sans le champ ».
5. **`test:unit` a rougi sur `test-fiches-affirmations-retirees.mjs`** (`dist/airports/sgn` absent) :
   j'avais lancé un `build` pendant la série, qui vide `dist`. Contention de ma part, pas un défaut ;
   la série est rejouée après le build.

### Les trois P0 de Philippe

**(a) Carlin / Paris → Athènes / 8 kg / 15 juillet : retour à l'accueil sans verdict.** Reproduit
au navigateur : la date était **passée** (15 juillet 2026, saisie le 8 septembre) ; `#f-date` porte
`min`/`max`, et la validation native de Chromium arrêtait `submit` avant notre gestionnaire — zéro
requête, zéro message, la page défilait vers le champ. Le harnais jsdom ne pouvait pas le voir : il
émet `submit` lui-même. Correction : `novalidate` sur le formulaire, garde dans le gestionnaire,
message explicite qui nomme les deux bornes ISO du jour, `aria-invalid`, focus sans défilement.
Reproducteur : `test-lib/reproduire-date-hors-contrat.mjs` (imprime, ne conclut pas).

**(b) Cinq scénarios de non-régression** dans `test-apercu-navigateur.mjs` (« Six recherches en
français ») : Cavalier King Charles Spaniel 6 kg CDG → ATH cabine ; Golden 32 kg CDG → ATH ;
Golden 30 kg CDG → JFK ; Golden 32 kg CDG → LHR ; Carlin 8 kg CDG → ATH soute au prochain 15 juillet
(calculé, jamais écrit en dur) ; plus la date passée. Chacun exige : zone de résultat visible, une
requête partie avec la race **résolue** en `breed_id` et le poids annoncé, verdict visible, au moins
une carte ou un message explicite. Constat mesuré au passage : « Cavalier King Charles » seul n'est
pas dans la liste française (`Cavalier King Charles Spaniel` l'est) — la résolution compare le texte
entier ; le harnais l'imprime pour qu'un changement se voie.

Ce travail a été mené par un agent parallèle, annulé par une interruption sans rapport avec lui ;
son diff, complet et relu, a été reporté tel quel dans le dépôt principal.

**(c) « 0 option confirmée / 27 pistes » comme résultat principal** : en cours (voir « reste à faire »).

### Le bandeau formalités (point 4 de Codex)

Mesuré : la phrase « prévois un certificat vétérinaire dans chaque sens » n'avait qu'une source,
le corps de niveau « info » du bandeau aller-retour, sans donnée derrière ; le moteur, lui, listait
déjà pour Paris → Athènes : passeport européen, puce, vaccin antirabique (`rule_gr_import`). Le
bandeau ne nomme plus aucun document : il renvoie aux étapes listées en dessous quand le moteur en
a produit, à la page du pays sinon. Témoin jsdom sur les quatre langues (aucun mot de document ;
sans condition, renvoi à la page du pays). Le portugais passe de « no regresso » (PT-PT) à
« no retorno » (PT-BR). Les textes `partner.insurance.reason` / `partner.vet.reason` restent
génériques mais **ne sont pas rendus** par le Finder (seule la raison « caisse » l'est) : laissés
en l'état, nommés.

### Le dossier de Codex, seconde version : ce qui manque encore pour importer

Rien n'est déduit de l'absence des pièces ; Codex a annoncé un fichier consolidé unique (A → G).
Ce que le fichier devra régler pour qu'une ligne devienne une preuve au sens du contrat :

- les fichiers machine des cohortes B → F (`PREUVES_…_COHORTE_*.json`) ne sont pas joints ; seul le `.md` l'est ;
- plusieurs citations de la cohorte A ne sont pas **contiguës** (ellipses « … ») : KLM cabine, Lufthansa
  soute, Iberia cabine ×2, Qatar cabine ; Air France est un fragment de trois mots dont la « phrase
  complète » n'est pas reproduite. Le contrat exige la phrase telle quelle : une ellipse rend la
  relecture impossible à l'octet près ;
- les cohortes B, D, E sont des **paraphrases** sauf Finnair cabine, SAS cabine et Vueling soute ;
- **Ryanair est en contradiction interne** : cohorte C « refus global documenté, directement
  exploitable » avec deux phrases ; section « À ne pas décider actuellement » : « je n'ai pas encore
  une phrase officielle suffisamment explicite ». À trancher par Codex ;
- une question ouverte, à arbitrer : la décision du moteur transporte la projection COURTE de la
  source (URL, type, date, confiance — décision antérieure, `reduireSource`) ; la citation reste sur
  la politique et la fiche. Faire remonter la phrase jusqu'à la carte du Finder demanderait
  d'élargir `DecisionSource` (champs optionnels `quote`, `quote_language`, `locator`). Non fait dans ce lot.

### Reste à faire dans ce lot

Contrat d'affichage du Finder : prouvé d'abord, non prouvé en second niveau et jamais 27 pseudo-
résultats à plat, résumé par catégorie à la place du compteur « 0 options confirmées · 27 pistes »
(`test-flightfinder-harness.cjs` attend encore ce compteur : mouvement nommé à faire). Puis import
de la cohorte A dès le fichier consolidé, une compagnie à la fois, avec un scénario par import.

## Annexe 23 — L'import strict V3 : 26 faits, 25 citations, et tout ce qui a bougé en se nommant (08/09/2026)

### Ce qui a été importé, et d'où

Le paquet de Codex (`mesures/preuves/import-strict-v3-2026-09-08/`, onze JSON A → K, le dossier
et sa notice) avec son LISEZ_MOI, **qui prévaut** : seuls 26 faits sont autorisés — cohorte A
`facts[0..19]`, B `facts[0]` (Finnair cabine) et `facts[3]` (SAS cabine), C `facts[0..2]`
(Ryanair), F `facts[1]` (Vueling soute). Les 64 autres faits du paquet restent des pistes ;
ils sont conservés, jamais lus par l'importeur, et un témoin vérifie qu'aucun n'a de citation
dans la donnée.

Philippe a transmis la consigne de Codex : ne jamais transformer « sous conditions » en
acceptation catégorique ; la citation reste sur la fiche, la carte garde statut, lien et date,
sans élargir son contrat dans ce lot. C'est ce qui a été fait — `DecisionSource` est inchangée.

**L'importeur est rejouable et nominatif** (`packages/knowledge/scripts/importer-preuves-v3.mjs`,
`--check` pour simuler) : il écrit dans `policies:` de la fiche la source sous le contrat
existant (`T0bAuditSource`), `review_due` CALCULÉ par `reviewDueFrom` — 2026-09-08 + 90 jours =
2026-12-07 —, et le seuil `max_weight_kg` + `weight_includes_carrier: true` seulement quand la
phrase citée le porte (table `SEUILS` explicite : dix cabines à 8 kg, Vueling cabine non importée,
Air France soute 75 kg, Turkish soute 50 kg). Il refuse tout fait dont la recommandation ne
correspond pas à la disponibilité déjà écrite dans la fiche : **aucune disponibilité n'a changé**,
les 26 concordaient. British Airways cabine (preuve du 05/09) est conservée, non remplacée : 25
importés, 1 conservé, 0 refusé.

### Mesuré après ingestion

| | avant | après |
|---|---|---|
| politiques citées | 3 | **28** (26 décisives ; Thai fret et Virgin Australia cabine ne décident pas) |
| `accepted_with_conditions` | 0 | **18** |
| `denied` | 1 | **8** (BA cabine, easyJet ×2, Ryanair ×3, Qatar cabine, Vueling soute) |
| `allowed` | 0 | **0** |
| à confirmer | 301 | 276 (`legacy_unreviewed` 267 → 251, `official_source_unquoted` 32 → 23) |
| registre A / B / C / D | 3 / 125 / 175 / 3 | 28 / 108 / 167 / 3 |
| baseline t0a, cartes changées (par compagnie) | — | 504 / 1 560 ; 450 canaux → sous conditions, 32 → refusé, 0 → `allowed` ; 52 verdicts « pas encore établi » → « oui, sous conditions » |

**Paris → Athènes, Golden 32 kg** distingue désormais Aegean (cabine refusée au seuil, soute
sous conditions), Air France (soute sous conditions à 75 kg chien + contenant, cabine à confirmer
faute de phrase) et easyJet (cabine et soute refusées) — le critère d'acceptation du lot.
**Ryanair** est la première fiche à conclure au refus total, sur trois citations.

### Deux défauts trouvés en important, et corrigés

1. **La branche « politique préservée » de l'ingestion perdait le seuil.** Ma retouche du matin
   n'écrivait `max_weight_kg` / `weight_includes_carrier` que sur la branche dérivée ; sur une
   politique enrichie écrite à la main — Air France, KLM, Iberia, Lufthansa, Turkish, celles que
   le dossier cite —, le champ passait le schéma puis disparaissait. Même classe de défaut que
   la priorité de la source auditée (15/08). Corrigé : les champs ÉCRITS dans `policies:`
   l'emportent, et seulement eux (le poids déduit de la ligne tarifaire reste soumis à la
   préservation et à la détection de dérive).
2. **« Ton chien peut voyager en cabine »** (`why.transport_modes`) disait un oui sec dès qu'un
   canal était ouvert sous conditions. Réécrit ×4 : ce que les compagnies publient, sous leurs
   conditions, jamais une place garantie. De même sur les pages races : « Accepté en soute » →
   « Soute — sous conditions de la compagnie », et le plafond cabine dit « chien + contenant ».
3. **Un refus documenté n'était qu'un détail** : easyJet, cabine et soute refusées sur citation,
   affichait « Politique à confirmer » (vrai pour le fret). Le libellé nomme maintenant le refus en
   tête et ce qui reste à confirmer ensuite (`air.refused_then_confirm`, ×4).

### Les mouvements nommés (tous figés sur mesure)

`test-frontiere-confiance` §10 et §13 bis (28 citées nominativement, 26 décisives, 0/18/8/276,
Ryanair seule en refus total) · `test-t0b-legacy-unreviewed` (251, 23) · `test-t0a-baseline`
(table : `offered` cité → quatrième état ; répartition 0/18/8/276 ; causes 251/23/1/1 ; nouvelle
figée `import-strict-v3-apres.json`, chaîne continue depuis `entree-ternaire-apres.json`, preuve
permanente ci-dessus) · `test-t0a-carries-diff` (le témoin hérité redevient atteignable, 7 113
couples, refigé ; Ryanair seule perte, sur preuve) · `test-tristate-climat` (carlin : 51
confirmations, 46 de provenance, 38 de race, chacune expliquée — cinq n'ont plus de cause de
provenance parce que leur politique est prouvée) · `test-inventaire-preuves` (registre régénéré ;
témoins B et C re-fondés sur Air Canada soute et Aeromexico cabine, KLM soute et Aegean cabine
étant devenues A) · `test-faq-races` (172 races sur 172 ont des compagnies, sur des politiques
citées) · `test-quatrieme-etat` (sentinelle 0 → 18 ; Air France soute citée à 75 kg) ·
`test-ingest-check` (la contre-épreuve (b) retire le bloc cabine entier d'Aegean, qui porte
maintenant une preuve) · `test-contre-epreuves` (la mutation « un refus de race ne porte plus
son motif » suit la ligne d'`evaluate.ts` où `weightDeny` s'est ajouté — c'était la cause unique
des trois rouges de la CI sur `7ecbe94`).

Nouveau harnais `test-preuves-v3.mjs` (162 contrôles, dans `test:unit`) : étage 1, chaque fait
relu depuis le dossier est dans `objects.json` à l'octet près, avec sa révision calculée ;
étage 2, Paris → Athènes, Paris → Doha, Amsterdam → Málaga, Amsterdam → Lisbonne — grand chien
au-dessus du seuil, petit chien conditionnel, brachycéphale jamais accepté, refus cités,
Ryanair « animaux refusés », TAP soute sans seuil global (32/45 kg selon la route : portée
nommée) ; et ce que l'import n'a PAS fait (0 `allowed`, faits en attente sans citation).

### Ce que je n'ai pas fait, nommé

- Aucune disponibilité changée, aucun tarif, aucune liste de races, aucune règle sanitaire ou
  météo : le lot porte les 26 faits, rien d'autre.
- Les `channels[]` éditoriaux des fiches (« Autorisé ») n'ont pas été touchés ; ils ne décident
  pas (T0-B2). Si Codex veut les aligner sur « sous conditions », c'est un lot B.
- Iberia soute 45 kg, KLM soute 75 kg, Finnair soute 75/50 kg : seuils présents dans
  `condition_scope`, absents des phrases citées — non écrits.

## Annexe 24 — Lots 2 et 3 de l'import strict : 24 faits, trois réactivations, un plafond du chien seul, et Addis-Abeba qui disparaissait (08/09/2026, soir)

Philippe a demandé d'enchaîner les lots 2 et 3 après le lot 1 sans attendre d'ordre. Fait ; rien
n'est fusionné, promu ni déployé.

### Importé

Les deux paquets (`mesures/preuves/import-strict-lot-2-2026-09-08/`, `…-lot-3-…`), 12 faits
chacun, tous autorisés par leurs LISEZ_MOI, importés par le même importeur (`--lot=lot2`,
`--lot=lot3`). 24 importés, 0 refusé. **Trois lignes non revérifiées RÉACTIVÉES sur citation**
(Cathay Pacific, Air India, Ethiopian fret) : la seule situation où l'importeur écrit une
disponibilité, nommée « RÉACTIVÉ » dans son rapport et en commentaire dans la fiche. Les dix
canaux `intentionally_unset` restent sans citation (témoin).

Seuils écrits, tels que la phrase les porte : Air Transat cabine 8, Air India cabine 10, Avianca
cabine 10 et soute 70, Ethiopian cabine 8 et soute 45, Etihad cabine 8 (chien + contenant) ; **Air
Europa cabine 8, chien SEUL** (« The weight of the pet cannot exceed 8 kg », 10 kg sac compris).
Non écrits, nommés : Air India soute 32 kg (dans la phrase du fret, pas de la soute), Air Canada
soute 45 kg (portée seulement).

### Le modèle complété : `weight_includes_carrier: false`

Le champ ne connaissait que `true`. Explicite à `false`, il dit un plafond du chien seul : le
moteur refuse au-dessus dans les deux cas (`typeof === "boolean"`, jamais sur `undefined`), la
décision transporte `weight_limit_includes_carrier`, et chaque surface le dit — carte du Finder
(« Poids du chien seul jusqu'à 8 kg (contenant en plus) »), calculateur de caisse, pages races.
Témoins : `test-quatrieme-etat` (Golden 32 refusé, Cavalier 6 sous conditions avec le drapeau) et
`test-preuves-lots-2-3` (Air Europa : 9 kg refusé, 6 kg sous conditions).

### Mesuré

| | après lot 1 | après lots 2 et 3 |
|---|---|---|
| politiques citées | 28 | **52** (50 décisives) |
| sous conditions / refusées / à confirmer | 18 / 8 / 276 | **39 / 11 / 252** |
| `allowed` | 0 | **0** |
| causes legacy / officielle non citée | 251 / 23 | 230 / 20 |
| registre A / B / C / D | 28 / 108 / 167 / 3 | 52 / 102 / 149 / 3 |
| baseline t0a (par compagnie) | 504 cartes | 208 cartes, 12 compagnies, 248 → sous conditions, 32 → refusé, 0 verdict déplacé |
| témoin hérité `carries_pets` | 7 113 | 13 830 |
| limites cabine citées (calculateur) | 9 | 15, dont 1 chien seul |

### Ce qu'un compteur a trouvé : Addis-Abeba disparaissait

`test-frontiere-confiance` compte les destinations d'un American Bully XL de 50 kg depuis Paris :
139 → 138. Ethiopian, pour ce chien, avait cabine et soute REFUSÉES sur seuil cité (8 et 45 kg
contenant compris) et le fret accepté SOUS CONDITIONS — un statut que l'outil Destinations ne
connaissait pas : il ne comptait comme ouvert que `allowed`, que rien ne produit plus. La
destination n'avait donc ni canal « ouvert » ni canal « à confirmer », et sortait de la liste.
Corrigé : le quatrième état compte comme ouvert (`destinations.ts`), un champ
`placement_conditional` dit à l'interface qu'aucun `allowed` n'existe, et le libellé devient
« Vol direct — sous conditions des compagnies ». 139 destinations à nouveau ; témoin dans
`test-preuves-lots-2-3` (Addis-Abeba présente, ouverte sous conditions seulement, fret ouvert,
cabine et soute refusées ; aucune destination « ok » qui ne soit conditionnelle).

### Erreurs de ma part, nommées

1. Trois attentes fausses sur Air Canada, Delta et JetBlue cabine pour un Golden de 32 kg : la
   politique citée n'a pas de plafond, mais des RÈGLES de poids non citées demandent confirmation.
   Le moteur avait raison ; l'attente est corrigée sur mesure (à confirmer, jamais refusé).
2. `test-t0b-legacy-unreviewed` porte lui aussi la chaîne des baselines figées, et je l'avais
   rejoué au lot 1 AVANT de régénérer la baseline : il était resté sur « entrée ternaire ». Mis à
   jour ici sur la figée la plus récente (lots 2 et 3).
3. Le calculateur de caisse et les pages races portaient encore un « ✅ Éligible cabine » /
   « Accepté en soute » ; corrigés au lot 1, la contre-épreuve navigateur du lot 1 a en plus
   montré que la note /100 et « Accepté par la plupart » revenaient par effet de bord de la
   donnée — masqués par décision écrite (`NOTE_AFFICHABLE = false`), comme la jauge du Finder.

### Mouvements nommés

frontière §10 (0/39/11/252, 230/20, 52 citées nominativement, 50 décisives), legacy (230, 20,
chaîne), baseline (figée `import-strict-lots-2-3-apres`, chaîne, preuve permanente), carries
(13 830), registre (52/102/149/3, témoins re-fondés sur WestJet soute), quatrième état (39),
caisses (15 limites, 1 chien seul), entités (compte des contradictions, relu après build).

### Post-scriptum (23:00 UTC) — le registre de fraîcheur, et un message de commit faux

La CI « Vérifications » a rougi sur `5650715` : le registre de fraîcheur des sources est SCELLÉ,
et 49 sources de canal ont changé sans rescellement dans la même PR. C'est l'étape que j'avais
omise ; rescellée par `fraicheur/sceller-registre.mjs --ecrire` (`e4ea534`).

**Erreur nommée** : le message de ce commit dit « 51 sources … plus Air France soute et Etihad
cabine ». C'est faux. Mesuré après coup, entrée par entrée : **49 entrées changées, exactement
les 49 canaux importés** — Air France soute et Etihad cabine en font partie. Les 51 lignes du diff
sont les 49 empreintes de source plus les deux lignes d'empreinte globale. J'ai lu un `--stat` et
écrit une explication à sa place, sans mesurer ; l'historique poussé ne se réécrit pas, la
correction vit ici et dans le commit qui suit.

### Post-scriptum 2 (22:22 UTC, CI « Site entier » sur `75f7fba`) — le `101` qui n'était plus exercé

`test-etape3-dom.mjs` § 2 a rougi : « jamais exercée(s) : en/101, fr/101, es/101, pt/101 ». Ce
contrôle prouve la bijection combinaison → libellé des cartes multicanales sur une base
synthétique déclarée (quatre porteuses reçoivent des canaux `allowed`). Sa porteuse du `101` était
Lufthansa : cabine + fret ouverts, soute réelle « à confirmer ». L'import V3 a cité la soute
Lufthansa (`accepted_with_conditions`) — la même ouverture donne désormais `111`. Le contrôle
n'avait pas été rejoué localement sur ce lot : il vit dans « Site entier », pas dans `test:unit`,
et je l'avais omis. Erreur nommée.

Deux mouvements, tous deux mesurés :

1. **Porteuse re-fondée** : mesuré sur les 49 compagnies des trois trajets de contrôle, Austrian
   dessert les trois (BKK, JFK, LAX), sa soute réelle reste « à confirmer », cabine + fret ouverts
   donnent `101` sur chacun. Aucune exigence abaissée.
2. **Bijection à deux variantes** : depuis les lots, la base RÉELLE produit à nouveau des cartes
   multicanales — par le quatrième état, jamais par `allowed` — et le moteur les libelle
   « … : acceptés sous conditions de la compagnie ». La table du contrôle ne connaissait que le
   libellé catégorique ; elle aurait compté ces cartes en écart dès que la couverture aurait
   repassé. Ajout d'une seconde table, écrite en toutes lettres ×4 sans relire les traductions,
   et d'une sentinelle figée des combinaisons conditionnelles réelles par langue :
   `011` (Air India, Ethiopian — golden 30 kg, cabine refusée sur seuil cité), `110` (Turkish,
   Iberia, Air Canada, TAP), `111` (Air India, Ethiopian). Le `101` conditionnel n'existe pas en
   réalité et n'est pas exigé. Contre-épreuve 2quater : permuter deux libellés conditionnels sur
   la base réelle est vu.

## Annexe 25 — La bascule du 09/09/2026 : quatrième état et trois lots de preuves en production

### Fusions, sur ordre de Philippe

Feu vert de Codex sur `#39` (`0cf64ee`) et `#40` (`90fd22b`), puis feu vert de Philippe « pour
les 2 » (09/09, ~04:40 UTC). La phrase de Codex « Ordre de fusion : #39, puis #40 » a été lue comme
une séquence, pas comme un ordre : seul celui de Philippe a déclenché les fusions. Commits de
fusion, comme les précédents : `465a50f` (#39) puis `8d24c44` (#40). L'arbre de `8d24c44` est
identique à celui de `90fd22b` (`298c11f1`) : la CI sur `main` refait une preuve déjà faite, et
Philippe n'a pas eu à l'attendre — délai mesuré, pas subi.

### La bascule, consignée

| | |
|---|---|
| `main` | `8d24c44` (fusion de PR #40, parents `465a50f` · `90fd22b`) |
| Worker de production | `sha` `8d24c447…`, `worker_version_id` `4df711a0-8968-4542-b227-b192cdf1eedf`, lu sur `/v1/health` par Philippe ; retour : `e2bcece5` (08/09, annexe 21) |
| Pages production | déploiement `3e97d459` par `npm run release` (2 272 fichiers envoyés, 1 360 déjà présents, « build indexable et complet ») ; retour : `ef4557b6` (08/09) |
| contrôles en ligne (curl de Philippe, ~06:50 UTC) | 200 sur `/`, `/fr/`, `/airlines/air-france/`, `/fr/countries/fr/` ; `robots.txt` : `Allow: /`, seul `/lab/` fermé, sitemap annoncé ; 301 de l'ancien calculateur vers `/tools/crate/` ; 404 préservée de l'outil chaleur ; accueil FR « 39 canaux confirmés ; 11 refus documentés » ; fiche Air France : soute acceptée sous conditions avec citation, vérifiée le 08/09/2026, confiance 4/5, cabine et fret à confirmer |
| reste à relire | navigateur : Paris → Athènes, Golden 32 kg (Aegean, Air France, easyJet distinctes) ; Addis-Abeba dans Destinations ; relecture directe de Codex |

### Deux erreurs de procédure, nommées

1. **J'ai redonné `/fr/countries/france/` dans la liste de contrôles**, alors que l'annexe 21
   l'avait déjà écartée : les pays sont adressés par code ISO, l'URL juste est
   `/fr/countries/fr/`. La liste vivait dans `preflight-production.mjs`, non corrigé depuis le
   08/09, et je l'ai recopiée sans relire l'annexe. Le 404 qu'elle produirait viendrait de moi.
2. **Le pré-vol local a dit « NE PAS BASCULER » sur un dist de préversion** (noindex, robots
   fermé) : le script vérifie le dist présent, pas celui que `release` construira. Faux rouge,
   expliqué à Philippe, mais un signal qui crie pour rien use la confiance. À corriger avec le
   lot « préflight + §8 » déjà nommé (Worker absent du script, URL pays fausse).
3. **La commande `curl` à quatre adresses n'appliquait `-o /dev/null` qu'à la première** : les
   trois autres pages se sont affichées entières dans le terminal de Philippe. Sans conséquence,
   mais c'est ma commande, pas son terminal.

## Annexe 26 — Import strict, lot 4 : 23 faits, 22 importés, un refusé et porté à l'arbitrage (09/09/2026)

### Le lot

Quatrième paquet de Codex (`mesures/preuves/import-strict-lot-4-2026-09-09/`), lecture directe du
09/09/2026 : 10 compagnies, 23 faits, 7 non-décisions. Importé par le même importeur
(`--lot=lot4`), sans règle métier nouvelle : les trois recommandations du lot
(`deny_when_dog_weight_kg_gt_8`, `offered_with_conditions`, `not_offered_for_pet_dogs`) sont
celles du lot 1, sous l'arbitrage de Philippe du 08/09 — refus sûr au-dessus du plafond, jamais un
oui absolu en dessous.

| | |
|---|---|
| importés | 22 (Austrian ×2, American ×2, SWISS ×2, Emirates ×3, Qantas ×3, ITA ×2, Aer Lingus cabine, Brussels ×2, WestJet ×2, Alaska ×3) |
| réactivés sur citation | 4 : Emirates fret et Alaska fret (lignes du manifeste), Qantas soute et fret (anciens POLICY_STALE) |
| seuils écrits | Austrian, SWISS, Brussels cabine : 8 kg chien + contenant, en toutes lettres |
| seuil NON écrit | ITA cabine : 12 kg sur certains vols intérieurs italiens, 8 kg ailleurs — Codex refuse un seuil mondial, nous aussi |
| refusé | **Aer Lingus soute** (fait 15) — voir ci-dessous |
| non-décisions | 7, sans citation, toutes « à confirmer » (Austrian, SWISS, ITA, Aer Lingus, Brussels, WestJet fret ; American soute) |

### Aer Lingus soute : refusé, nommé, à arbitrer

La fiche dit `hold: not_offered`, sans bloc source. Le fait de Codex dit `offered_with_conditions`
sur la phrase « Pets must be booked to travel with a pet agent, and they will be carried in the
aircraft hold. » L'importeur refuse par contrat : il ne change jamais une disponibilité (« la
fiche dit not_offered, le fait suppose offered »). Je n'ai pas basculé la ligne à la main : un
passage par agent animalier « in the aircraft hold » ressemble autant au fret (animal non
accompagné) qu'à la soute accompagnée, et Codex laisse justement le fret d'Aer Lingus non
décidé. Ce n'est pas une affirmation manifestement non étayée à corriger seul : c'est une question
de vérité métier. **Question à Philippe et Codex** : la voie « agent animalier → aircraft hold »
est-elle la soute (`hold`) ou le fret (`cargo`) du contrat ? Selon la réponse, la ligne bascule
`offered` en soute avec la citation, ou la citation va au fret et la soute reste `not_offered`.
En attendant, la soute Aer Lingus est « à confirmer », sans citation — ni refus prouvé, ni oui.

### Mesuré après import

| | avant | après |
|---|---|---|
| politiques citées (registre A) | 52 | 74 |
| décisives | 50 | 72 |
| `allowed` / sous conditions / refusées / à confirmer | 0 / 39 / 11 / 252 | 0 / 58 / 14 / 230 |
| causes legacy / page officielle sans phrase | 230 / 20 | 212 / 16 |
| registre A / B / C / D | 52 / 102 / 149 / 3 | 74 / 90 / 139 / 3 |
| limites cabine citées (calculateur) | 15 | 18 |
| témoin hérité (carries) | 13 830 | 19 098 |
| canaux contradictoires (entités) | 285 | 282 |
| carlin, Amsterdam → Málaga | 51 confirmations, 46 de provenance | 50, 44 |
| baseline (72 scénarios) | figée `import-strict-lots-2-3-apres` | figée `import-strict-lot-4-apres` : 320 cartes / 1 560, 8 compagnies, 372 → sous conditions, 72 → refusé, aucun verdict déplacé |

Scénarios réels du harnais `test-preuves-lot-4.mjs` (127 contrôles) : Paris → Vienne, Zurich,
Bruxelles (trois plafonds de 8 kg) ; Paris → Dubaï, Londres → Sydney, Paris → Dublin (trois
cabines refusées pour tout chien) ; Paris → Rome (ITA sans plafond) ; New York, Londres et
Seattle → Los Angeles (American, WestJet, Alaska).

### Trouvé par la mesure

- **Brussels soute, Golden 32 kg : citée « sous conditions », mais « à confirmer » au moteur** —
  une règle de poids non citée (`rule_brussels_hold_weight`) demande confirmation, et le moteur la
  nomme. La citation ne couvre pas cette incertitude ; le harnais fige ce comportement.
- **Sentinelle re-fondée une troisième fois** : WestJet cabine est citée. Mesuré sur les 102 fiches,
  United cabine est la SEULE politique d'auteur `offered` restante dont la page officielle n'a
  aucune phrase citée et dont la fiche n'a aucun canal prouvé. Le prochain lot qui la citera devra
  le dire.
- **Deux anciens POLICY_STALE réactivés** (Qantas soute et fret) : la matrice T0-B2 les admet par
  identité avec preuve exigée, comme les lignes du manifeste ; les huit autres restent versés.

### Mouvements nommés

frontière (72 décisives, 0/58/14/230, 212/16, 74 nominativement), legacy (212, 16, liste des non
revues 10 → 8, chaîne → `import-strict-lot-4-apres`), baseline (chaîne, répartition, preuve
permanente lot 4), carries (19 098), quatrième état (58), tri-état (50/44), registre (74/90/139/3,
canaux, pistes 24/66/35, paires 74/24/139, écarts 65, niveaux 74/24/204, A nominatifs), caisses
(18 limites, 19 témoins), entités (282, sentinelle United), matrice (deux réactivations + deux
POLICY_STALE réactivés), V3 (Brussels cabine sort de la liste d'attente).

### Erreurs nommées

1. Mon script d'édition de `test-t0a-baseline.mjs` a calculé les modifications de chaîne et de
   répartition puis ne les a pas écrites (pas d'écriture en fin de bloc) ; un second passage a
   inséré la preuve permanente sur le fichier non modifié. Vu au premier passage des tests,
   corrigé, nommé.
2. La liste nominative des A de l'inventaire a d'abord été écrite triée alphabétiquement ; le
   contrôle compare dans l'ordre de l'inventaire (cabine, soute, fret par compagnie). Réordonnée.
3. Mon premier contrôle « Aer Lingus soute sans source » lisait `objects.json`, où l'ingestion
   DÉRIVE une source depuis la fiche (site de la compagnie, « derived from fiche ») ; la fiche,
   elle, n'a aucun bloc `source:`. Le contrôle lit désormais la fiche.

## Annexe 27 — Import strict, lot 5 : 19 faits, 18 importés, Virgin Australia cabine refusée par contrat (09/09/2026)

### Le lot

Cinquième paquet de Codex (`mesures/preuves/import-strict-lot-5-2026-09-09/`), lecture directe du
09/09/2026 : 10 compagnies, 19 faits, 11 non-décisions. Importé par le même importeur
(`--lot=lot5`), empilé sur le lot 4 dans la même PR, chaîne de baselines continue.

| | |
|---|---|
| importés | 18 (Korean Air ×2, China Airlines soute, Philippine ×2, Vietnam ×2, Malaysia ×2, Asiana ×2, China Eastern ×2, Air Mauritius ×3, Garuda fret, Virgin Australia fret) |
| réactivés sur citation | 4, tous en fret : Virgin Australia, Philippine, Air Mauritius, Garuda |
| refusé | **Virgin Australia cabine** : la fiche dit `case_by_case` (arbitrage du 28/08, option A-bis) et porte déjà la citation relue par Philippe le 28/08 (« …combined weight (pet + carrier) of no more than 8kg ») ; l'importeur ne change jamais une disponibilité, et la phrase de Codex n'est pas écrite. La ligne reste « à confirmer » (`airline_approval`) — c'est ce que Codex demande (« Virgin cabine hors de son essai restée conditionnelle »). Aucun arbitrage nouveau nécessaire. |
| citations en coréen | Korean Air cabine et soute, conservées à l'octet près, `quote_language: ko` |

### Déviation argumentée, nommée pour Codex : trois plafonds écrits

La règle 5 de Codex : « les plafonds de 7, 8 et 10 kg ne doivent devenir un refus moteur que si le
modèle porte toute leur portée géographique et leur poids combiné ». Le modèle porte le poids
combiné depuis le lot 1. Sur la portée : Korean Air 7 (cabine) et 45 (soute), Asiana 7 (cabine)
sont des conditions générales, sans restriction de route dans la phrase ni dans la portée nommée
— **écrits**, et le moteur refuse au-dessus (un carlin de 8 kg est refusé en cabine chez Korean
Air ; un Bully de 50 kg est refusé en soute). Virgin Australia 8 (essai sur certains vols
intérieurs) et Philippine 10 (FurPAL, vols intérieurs) ont une portée de route que le modèle ne
porte pas — **non écrits**. Si Codex lit sa règle autrement, retirer trois lignes de la table
`SEUILS` suffit.

### Mesuré après import

| | avant (lot 4) | après (lot 5) |
|---|---|---|
| politiques citées (décisives) | 74 (72) | 92 (90) |
| `allowed` / sous conditions / refusées / à confirmer | 0 / 58 / 14 / 230 | 0 / 73 / 17 / 212 |
| causes legacy / page officielle sans phrase | 212 / 16 | 194 / 16 |
| registre A / B / C / D | 74 / 90 / 139 / 3 | 92 / 84 / 127 / 3 |
| limites cabine citées | 18 | 20 |
| témoin hérité | 19 098 | 21 348 |
| canaux contradictoires | 282 | 279 |
| baseline | figée lot 4 | figée `import-strict-lot-5-apres` : 80 cartes / 1 560, 6 compagnies, 40 → sous conditions, 56 → refusé, aucun verdict déplacé |

### Trouvé par la mesure, nommé comme dette

**Philippine cabine** : citée (FurPAL, « available on all PAL DOMESTIC flights »), mais une règle
héritée non citée, `rule_philippine_cabin_deny`, la ferme — même sur Manille → Cebu. Le moteur
garde « à confirmer » et nomme la règle ; la citation n'efface pas une règle qu'elle contredit.
Les règles compagnies sont hors du périmètre des lots d'import : cette règle est à relire, sur
décision, dans un mouvement séparé.

### Mouvements nommés

frontière (90 décisives, 0/73/17/212, 194/16, 92 nominativement), legacy (194, chaîne → lot 5),
baseline (chaîne, répartition, preuve permanente lot 5), carries (21 348), quatrième état (73),
registre (92/84/127/3, canaux 43/16/43 · 36/48/18 · 13/20/66, pistes 24/60/33, paires 92/24/127,
écarts 59, niveaux 92/24/186), caisses (20 limites), entités (279), matrice (quatre réactivations
fret). Nouveau harnais `test-preuves-lot-5.mjs`.

### Post-scriptum — la 21e limite cabine, erreur nommée (09/09/2026, après import)

**Mesuré.** Le harnais des caisses, rejoué sur le dist du lot 5, a compté **21** limites cabine
« citées » au lieu des 20 attendues. La 21e était Philippine Airlines — dont le plafond FurPAL de
10 kg n'avait PAS été écrit (portée intérieure, ci-dessus). Le calculateur le tirait d'ailleurs.

**Provenance, mesurée.** `derivePolicy` (`ingest-airlines.mjs`) déduit le poids cabine de la ligne
tarifaire de la fiche (« Cabin (FurPAL, ≤ 10 kg, domestic) » → `max_weight_kg: 10`). Tant que la
cabine Philippine était « à confirmer », cette valeur était invisible ; citée par le lot 5, elle
devenait « accepté sous conditions », et le calculateur publiait « ≤ 10 kg » — exactement la règle
mondiale que Codex interdit. Le moteur, lui, ne refusait pas (pas de `weight_includes_carrier`),
mais l'écran, si. Sur les 35 politiques cabine portant un plafond, deux le tenaient de la grille
tarifaire sur un canal cité : Philippine (10) et Virgin Australia (8). Les 20 autres limites sont
écrites depuis leur phrase.

**Corrigé à la racine.** La dérivation tarifaire ne s'applique plus à un canal cabine cité : sur
un tel canal, un seuil n'existe que s'il est écrit dans `policies:` depuis la phrase citée. Rejoué :
seuls ces deux `max_weight_kg` disparaissent de `objects.json`, rien d'autre ne bouge.

**Effet de bord, nommé.** Le retrait faisait échouer `test-virgin-australia-cabine.mjs` (arbitrage
A-bis du 28/08 : la politique cabine doit porter 8 kg). La citation de **Philippe** du 28/08 dit
« combined weight (pet + carrier) of no more than 8kg » en toutes lettres : le seuil est désormais
**écrit** dans la fiche depuis cette citation, avec `weight_includes_carrier: true` — pas depuis la
phrase de Codex (lot 5), qui reste non écrite. Inerte pour le moteur et le calculateur :
`case_by_case` projette `confirmation_required`, et le refus au seuil n'existe que sur « accepté
sous conditions ». La règle 5 de Codex est respectée ; la ligne « Virgin 8 non écrit » du tableau
ci-dessus devient « écrit depuis la citation du 28/08, inerte ». Pour contre-revue.

**Erreur nommée.** Le témoin du harnais lot 5 lisait les FICHES (« plafond non écrit ») — vrai, et
insuffisant : la fuite vivait dans la donnée projetée. Deux témoins lisent désormais la politique
projetée (Philippine : sans plafond ; Virgin : 8, `true`, `confirmation_required`, citation du
28/08). Attrapé par le harnais des caisses, pas en relisant.

### Post-scriptum 2 — CI du lot 4 rouge sur l'étape 3, porteur du `101` re-fondé une deuxième fois (09/09/2026)

**Mesuré.** « Site entier » sur `0e7ed9b` (PR #41) : `test-etape3-dom` § 2, combinaison `101`
jamais exercée (en, fr, es, pt). Cause identique à l'annexe 24 : le lot 4 a cité la soute d'Austrian,
la porteuse re-fondée la veille ; cabine + fret ouverts donnent désormais `111`.

**Erreur nommée, récidive.** Ce contrôle vit dans « Site entier », pas dans `test:unit`, et je ne
l'ai pas rejoué localement avant de pousser le lot 4 — l'annexe 24 nommait déjà exactement cela.
Cette fois l'étape 3 est rejouée sur le dist local AVANT la poussée du lot 5.

**Re-fondé par mesure.** Sur les 11 compagnies communes aux trois trajets de contrôle, cabine +
fret ouverts : Finnair, SAS et LOT donnent `101` partout (soute réelle « à confirmer ») ; les huit
autres `111` (soute citée) ou `001` (BA, cabine refusée). LOT retenue : aucun de ses canaux n'est
cité, l'ouverture synthétique ne recouvre aucune preuve. Le témoin est re-fondé, pas abaissé ; les
combinaisons conditionnelles figées (`011`, `110`, `111`) ne bougent pas.

## Annexe 28 — Import strict, lot 6 : 22 faits, 21 importés, Air China cabine refusée par contrat, première réactivation en refus cité (09/09/2026)

Philippe a donné son feu vert pour enchaîner les lots sans attendre (« tu as mon feu vert ») ; ce
feu vert porte sur l'enchaînement des imports, pas sur une fusion. Sixième paquet de Codex
(`mesures/preuves/import-strict-lot-6-2026-09-09/`), lecture directe du 09/09/2026 : 10 compagnies,
22 faits, 8 non-décisions. Importé par le même importeur (`--lot=lot6`), sans règle métier nouvelle.

| | |
|---|---|
| importés | 21 (Aeromexico ×2, LATAM ×2, United cabine, South African ×3, Saudia ×2, EgyptAir ×2, Air China soute, Kenya ×3, Gulf Air ×3, Royal Jordanian ×2) |
| réactivés sur citation | 6 : South African soute et fret, Kenya fret, Gulf Air fret, Royal Jordanian cabine — et **Saudia cabine, première réactivation d'une ligne non revérifiée en REFUS cité** (`not_offered`) ; la matrice T0-B2 admet désormais `offered` ou `not_offered` cité pour une ligne réactivée, jamais sans phrase |
| refusé | **Air China cabine** : la fiche dit `not_offered` (sans phrase) ; Codex dit « sous conditions » (chiens et chats sur vols intérieurs, accord préalable). L'importeur ne change jamais une disponibilité. La ligne reste « à confirmer », avec sa règle héritée `rule_air_china_no_cabin` nommée. **Question à Philippe et Codex** : basculer la fiche à `offered` (l'importeur pourra alors écrire la phrase), ou garder le refus d'auteur ? |
| seuils écrits | Aeromexico cabine 9 et soute 45 (« Hasta 9 kg / 45 kg (Incluyendo transportadora) »), EgyptAir cabine 8 (« The total weight of animal and cage should not exceed 8 KG ») — chien + contenant, portée générale, même lecture de la règle 5 qu'au lot 5. Leurs anciens plafonds déduits de la grille tarifaire sont désormais ÉCRITS depuis la phrase |
| seuil non écrit | Royal Jordanian 7 : la phrase citée s'arrête à « subject to the following conditions: » et ne porte pas le chiffre ; portée Economy + vol ≤ 5 h |
| non-décisions | 8, toutes « à confirmer » : fret Aeromexico, LATAM, EgyptAir, Air China, Royal Jordanian, Saudia ; United soute et fret (rien n'est déduit de sa cabine) |

### À contre-revoir, nommé

- **Saudia, provenance** : l'URL relue par Codex est `booking-uat.dcloud.saudia.com` — un
  sous-domaine d'environnement de test de la compagnie. Le domaine est saudia.com, le contrat de
  provenance l'accepte, la citation est écrite telle quelle. Je ne réécris pas une URL ; je la
  signale : Codex peut confirmer sur le domaine public si la même phrase y figure.
- **Air China cabine** (ci-dessus).

### Sentinelle « politique d'auteur non prouvée » : la forme n'existe plus, re-fondée sous une autre

United cabine (dernière candidate, annexe 26) est citée par ce lot. Mesuré sur la base projetée :
aucune politique d'auteur `offered` à page officielle sans phrase ne subsiste sur une fiche sans
canal prouvé — les 15 « page officielle sans phrase citée » restantes vivent toutes à côté d'un
canal prouvé. Le rôle est re-fondé sur **United soute** (page officielle, aucune phrase, « à
confirmer » à côté d'une cabine citée), même slug, même statut attendu. Dit, pas abaissé.

### Mesuré après import

| | avant (lot 5) | après (lot 6) |
|---|---|---|
| politiques citées (décisives) | 92 (90) | 113 (111) |
| `allowed` / sous conditions / refusées / à confirmer | 0 / 73 / 17 / 212 | 0 / 88 / 23 / 191 |
| causes legacy / page officielle sans phrase | 194 / 16 | 174 / 15 (United cabine sort de la seconde) |
| registre A / B / C / D | 92 / 84 / 127 / 3 | 113 / 78 / 112 / 3 |
| B par piste politique / règle, gov.uk seul | 24 / 60, 33 | 23 / 55, 31 |
| limites cabine citées | 20 | 22 (Aeromexico 9, EgyptAir 8) |
| témoin hérité | 21 348 | 26 040 |
| baseline | figée lot 5 | figée `import-strict-lot-6-apres` : 136 cartes / 1 560, 9 compagnies (South African ne dessert aucun des 72 scénarios), 116 → sous conditions, 88 → refusé, aucun verdict déplacé |

### Trouvé par la mesure, nommé comme dette

- **United cabine** citée, mais un Golden de 32 kg reste « à confirmer » par des règles de poids
  héritées non citées (`rule_ua_cabin_weight`, `rule_united_cabin_weight`) ; **LATAM cabine**, même
  forme (`rule_latam_cabin_weight`). Le moteur nomme les règles ; elles sont hors du périmètre des
  lots d'import.
- **Témoin C de l'inventaire** re-fondé d'Aeromexico cabine (devenue A) sur Air Algérie cabine
  (provenance dérivée, sans phrase).
- **Témoin « carte sans canal sourcé »** du harnais des entités re-fondé d'Air China (soute
  désormais citée) sur China Southern, mesuré sur les 35 cartes de CDG→BKK (trois candidates à
  racine page d'accueil : Aircalin, China Southern, El Al).
- **Canaux contradictoires 279 → 274** : South African cabine, Kenya cabine et soute, Gulf Air
  cabine et soute — l'éditorial disait déjà « non », la citation le prouve. Saudia cabine reste
  contradictoire (éditorial « chats uniquement », canal refusé aux chiens sur citation).
- **Causes de race 412 → 406** (`test-t0b3a-moteur-race.mjs`), mesuré avant/après sur un worktree
  de HEAD : Gulf Air soute (4 cartes) et Kenya soute (2 cartes), refusées sur citation — un refus
  prouvé éteint la cause de race, mécanisme inverse de celui nommé les 04 et 05/09.

### Mouvements nommés

frontière (111 décisives, 0/88/23/191, 174/15, 113 nominativement, somme des causes 191), legacy
(174, 15, chaîne → lot 6), baseline (chaîne, répartition, preuve permanente lot 6), carries
(26 040), quatrième état (88), registre (113/78/112/3, canaux 52/14/36 · 45/44/13 · 16/20/63, pistes
23/55/31, paires 113/23/112, écarts 54, niveaux 113/23/166, A 113 en ordre d'inventaire), caisses
(22 limites, 23 témoins), matrice (six réactivations, dont un refus cité), sentinelles (United
soute). Nouveau harnais `test-preuves-lot-6.mjs` (124 contrôles), dans `test:unit`.

### Post-scriptum — CI du lot 5 rouge sur la rejouabilité de l'inventaire, erreur nommée (09/09/2026)

**Mesuré.** « Vérifications » sur `7350489` : `test-inventaire-preuves.mjs` (a), le fichier
`inventaire-compagnies.json` commité n'est pas identique à sa reconstruction — seule l'empreinte
SHA-256 des données brutes diffère (`a3dc9dfa…` commitée, `a5276393…` reconstruite). Reproduit à
l'identique sur un worktree exact de `7350489`.

**Cause, nommée.** J'ai régénéré l'inventaire du lot 5 AVANT les deux derniers changements de
données (retrait de la dérivation tarifaire sur une cabine citée, seuil Virgin Australia écrit),
et je n'ai pas rejoué ce contrôle après. Une empreinte figée trop tôt : même classe d'erreur que
« contrôle non rejoué avant la poussée », déjà nommée deux fois aujourd'hui.

**Corrigé par le lot 6.** L'inventaire de `cea12c1` a été régénéré après toutes les données du
lot ; le contrôle (a) passe sur un worktree exact de `cea12c1`. Aucun fichier de données ne change
ici : ce post-scriptum consigne l'erreur, la CI de `cea12c1` en est la preuve.

## Annexe 29 — Import strict, lot 7 : 23 faits, 23 importés, règle des seuils précisée (09/09/2026)

Paquet de Codex (`mesures/preuves/import-strict-lot-7-2026-09-09/`), lecture directe du 09/09 :
10 compagnies, 23 faits, 7 non-décisions. Importé sur la base du lot 6, sur une branche neuve
(`lot/import-strict-lots-7-8`) créée pendant l'attente de la fusion de #41.

| | |
|---|---|
| importés | 23 (Air Algérie ×2, Air Austral ×2, Air Caraïbes ×3, Air Tahiti Nui ×2, Aircalin ×3, Corsair ×3, French Bee ×2, Iberia Express ×2, La Compagnie ×2, Luxair ×2) |
| réactivés sur citation | 4, tous en fret : Air Caraïbes, Air Tahiti Nui, Aircalin, Corsair |
| refusés | 0 |
| non-décisions | 7, « à confirmer » ; Air Tahiti Nui soute reste ABSENTE de la fiche (aucune politique créée) |
| langues | français (Air Austral, Air Caraïbes, Air Tahiti Nui, Aircalin, Corsair, French Bee, La Compagnie), espagnol (Iberia Express), anglais (Air Algérie, Luxair) |

### Règle des seuils précisée, nommée pour Codex

Jusqu'ici : un seuil est écrit quand la phrase citée porte le chiffre. Précision : la phrase doit
porter le chiffre **et la base du poids** (animal + contenant), parce que le modèle exige
`weight_includes_carrier` pour refuser et que déduire cette base de la portée nommée serait une
inférence. Écrits : Air Austral 8 (« le poids de l'animal + son contenant doit être inférieur à
8 kg »), La Compagnie 8 (« jusqu'à 8kg, sac compris »). Non écrits : Air Algérie 6 (base absente :
« only small pets under 6 kg »), Corsair 8/50, Iberia Express 8/45, Luxair 8 (chiffre absent de la
phrase). Si Codex veut que la portée nommée suffise, les lignes s'ajoutent à `SEUILS`.

Air Algérie **perd** le 6 kg que l'ingestion déduisait de sa grille tarifaire : la cabine est
citée, et la dérivation tarifaire ne s'applique plus à un canal cité (erreur nommée à l'annexe 27).

### Mesuré après import

| | avant (lot 6) | après (lot 7) |
|---|---|---|
| politiques citées (décisives) | 113 (111) | 136 (134) |
| `allowed` / sous conditions / refusées / à confirmer | 0 / 88 / 23 / 191 | 0 / 108 / 26 / 168 |
| causes legacy / page officielle sans phrase | 174 / 15 | 151 / 15 |
| registre A / B / C / D | 113 / 78 / 112 / 3 | 136 / 70 / 97 / 3 |
| limites cabine citées | 22 | 24 (à vérifier sur le dist, construit une fois pour les lots 7 et 8) |
| témoin hérité | 26 040 | 26 868 |
| canaux contradictoires | 274 | 271 (Aircalin cabine et soute, La Compagnie soute) |
| causes de race (carlin) | 406 | 404 (Aircalin soute refusée sur citation, 2 cartes) |
| baseline | figée lot 6 | figée `import-strict-lot-7-apres` : 16 cartes / 1 560, 2 compagnies (Aircalin, Air Algérie), 8 → sous conditions, 16 → refusé, aucun verdict déplacé |

### Trouvé par la mesure, nommé comme dette

Des règles de poids héritées non citées gardent un Golden de 32 kg « à confirmer » en cabine chez
Air Algérie, Air Caraïbes, Air Tahiti Nui, Corsair, French Bee (`rule_*_cabin_weight`,
`rule_global_cabin_weight_cap`), et un Carlin de 8 kg chez Air Algérie. Le moteur nomme la règle ;
même dette qu'aux lots 5 et 6, hors du périmètre des lots d'import.

### Mouvements nommés

frontière, legacy (151, chaîne → lot 7), baseline (chaîne, répartition, preuve permanente lot 7),
carries (26 868), quatrième état (108), registre (136/70/97/3, canaux 62/14/26 · 54/36/12 ·
20/20/59, pistes 23/47, gov.uk 23, paires 136/23/97, écarts 46, niveaux 136/23/143), matrice
(quatre réactivations fret), race (404), entités (271), caisses (24). Témoin C de l'inventaire
re-fondé d'Air Algérie cabine (citée) sur Aerolíneas Argentinas cabine, hors des lots 7 et 8.
Nouveau harnais `test-preuves-lot-7.mjs` (123 contrôles), dans test:unit.

**Méthode, nommée** : le dist n'est construit qu'une fois, après le lot 8 ; les contrôles sur le site
construit (caisses, entités, accueil, étape 3, contre-épreuves) portent sur la tête des deux lots.

## Annexe 30 — Import strict, lot 8 : 23 faits, 22 importés, Thai Airways fret refusé par contrat, IndiGo deuxième refus total prouvé (09/09/2026)

Paquet de Codex (`mesures/preuves/import-strict-lot-8-2026-09-09/`), lecture directe du 09/09 :
10 compagnies, 23 faits, 7 non-décisions. Importé sur la base du lot 7, même branche.

| | |
|---|---|
| importés | 22 (Bangkok Airways fret, China Southern ×2, Copa ×3, IndiGo ×3, Thai Airways ×2, Tunisair ×2, SKY express ×2, KM Malta ×3, SunExpress ×2, Smartwings ×2) |
| réactivés sur citation | 5 : Bangkok Airways, Copa, KM Malta fret ; SKY express, SunExpress soute |
| refusé | **Thai Airways fret** : la fiche dit `undocumented` et porte la citation auditée du 13/08 (Claude+Codex : « (For cargo acceptance, please contact directly to Cargo Department) »). Codex cite la même phrase avec « sous conditions ». Sa propre règle — « ne jamais convertir “contactez Cargo” en fret accepté » — s'y oppose. L'importeur ne change jamais une disponibilité ; la ligne reste « à confirmer » (`policy_unpublished`). **Question à Philippe et Codex** : la règle tient-elle, ou le fret Thai devient-il « sous conditions » comme Air Mauritius (lot 5) ? |
| seuils écrits | Copa 10 (« maximum 10kg including container »), Tunisair 8 (« 08 kg y compris le contenant et la nourriture »), SunExpress 8 (« up to 8 kg (incl. container) ») |
| seuils non écrits | SKY express 8/25, KM Malta 10/32, Smartwings 8/32 (base du poids absente de la phrase) ; KM Malta et Smartwings perdent leur plafond déduit de la grille tarifaire |

### IndiGo : deuxième refus total prouvé

Trois canaux refusés sur une même page officielle (« does not permit the carriage of pets or
animals on its aircraft »). Trois témoins figés sur « Ryanair, et elle seule » avancent par
mouvement nommé : frontière (deux fiches au refus total), carries (deux compagnies perdent leur
transport sur preuve), caisses (deux compagnies « ni cabine ni soute »). Le calculateur affiche
pour IndiGo le message dédié « aucun animal », comme pour Ryanair.

### Signalé pour contre-revue de Codex, écrit tel quel

- **China Southern soute** : la phrase citée est « you can check it » — quatre mots, contigus, mais
  qui ne disent ni « chien » ni « soute » sans leur contexte. Importée (le contrat est respecté),
  signalée.
- **IndiGo fret** : « pets or animals on its aircraft » — fragment de la même phrase que la cabine
  et la soute ; importé, signalé.
- **Bangkok Airways fret** : cité sur des routes INTÉRIEURES listées (« …on the following routes: »),
  réactivé « sous conditions » pour tout le réseau — même classe que Philippine cabine (lot 5) : le
  modèle ne porte pas la portée de route. Nommé, pas converti.

### Mesuré après import

| | avant (lot 7) | après (lot 8) |
|---|---|---|
| politiques citées (décisives) | 136 (134) | 158 (156) |
| `allowed` / sous conditions / refusées / à confirmer | 0 / 108 / 26 / 168 | 0 / 124 / 32 / 146 |
| causes legacy / page officielle sans phrase | 151 / 15 | 129 / 15 |
| registre A / B / C / D | 136 / 70 / 97 / 3 | 158 / 58 / 87 / 3 |
| limites cabine citées | 24 | 27 (à vérifier sur le dist) |
| refus totaux prouvés | 1 (Ryanair) | 2 (Ryanair, IndiGo) |
| témoin hérité | 26 868 | 28 536 |
| canaux contradictoires | 271 | 265 (China Southern cabine, Copa soute, IndiGo ×3, Thai cabine) |
| causes de race (carlin) | 404 | 404 (mesuré avant/après : China Southern et Thai cabines n'en portaient aucune) |
| baseline | figée lot 7 | figée `import-strict-lot-8-apres` : 48 cartes / 1 560, 4 compagnies (Thai, China Southern, SunExpress, Smartwings), 40 → sous conditions, 32 → refusé, aucun verdict déplacé |

### Témoins re-fondés par mesure, jamais abaissés

- Sentinelle « non offerte, non prouvée » (cabine) : Thai Airways cabine est citée (refus prouvé).
  Re-fondée sur **Air China cabine** — la ligne même que le lot 6 a refusé d'importer, témoin exact
  de cette forme tant que l'arbitrage n'est pas rendu. Mesuré : 12 candidates.
- Harnais des entités, « carte sans canal sourcé » : China Southern citée → **El Al** (seule
  candidate à racine page d'accueil hors des lots 7 et 8, sur CDG→BKK).

### Trouvé par la mesure, nommé comme dette

Règles héritées non citées : KM Malta vers Londres (`rule_gb_no_cabin_pets`,
`rule_km_malta_gb_not_approved`) garde cabine et soute « à confirmer » — ici la restriction de
route reste opposable, ce que Codex demande ; Smartwings cabine, Golden 32 kg, « à confirmer » par
`rule_smartwings_cabin_weight`. Même classe qu'aux lots précédents.

### Mouvements nommés

frontière, legacy (129, chaîne → lot 8), baseline (chaîne, répartition, preuve permanente lot 8),
carries (28 536, deux pertes), quatrième état (124), registre (158/58/87/3, canaux 71/10/21 ·
63/29/10 · 24/19/56, pistes 23/35, gov.uk 19, paires 158/23/87, écarts 34, niveaux 158/23/121),
matrice (cinq réactivations), entités (265, témoin El Al), caisses (27, deux refus totaux),
sentinelle Air China cabine. Nouveau harnais `test-preuves-lot-8.mjs` (121 contrôles), dans test:unit.

### Post-scriptum — le cas fondateur n° 1 (La Compagnie, 32 kg) entre dans son quatrième état

`test-reference-cases.mjs` a rougi sur la suite complète (les suites unitaires rejouées
individuellement ne l'incluaient pas — méthode nommée : la suite complète est le seul juge). Le
cas affirmait depuis le 05/09 que les trois canaux de La Compagnie sont « à confirmer » pour un
chien de 32 kg, parce qu'aucune fermeture n'était prouvée. Le lot 7 cite deux phrases de la page
officielle : la cabine refuse au seuil cité (8 kg sac compris), la soute est refusée sur citation
(« le transport d'animaux en soute n'est pas proposé »). Le fret, sans politique dans la fiche,
reste « à confirmer » (`policy_absent`). Le cas est réécrit, pas abaissé : la propriété gardée est
« aucun refus sans phrase citée, et chaque incertitude nomme ce qui la produit ». La boucle du
tour 6 se referme : ce que le site affirmait sans preuve, il le prouve pour deux canaux sur trois.

### Post-scriptum — ce que le dist et la suite complète ont ajouté (lots 7 et 8)

- **Caisses** : 27 limites cabine citées (mesuré, conforme) ; les témoins « aucun animal » passent de
  deux à trois (synthétique, Ryanair, IndiGo), tous joués.
- **Entités** : 265 canaux contradictoires sur **100** fiches — IndiGo sort du registre, ses trois
  canaux étant prouvés, comme Ryanair au lot V3. Témoin « carte sans canal sourcé » El Al conforme.
- **Climat tri-état, carlin CDG→IST** : 50 → 47 confirmations, 44 → 35 de provenance (Air Algérie,
  KM Malta, SKY express, Tunisair cités sur ce trajet), 38 de race inchangé — et **une confirmation
  d'un troisième genre** : Air Algérie cabine, citée, où la règle héritée non citée
  `rule_air_algerie_cabin_weight` garde le carlin « à confirmer ». Le témoin croyait qu'une
  confirmation portait l'une de DEUX causes ; le moteur en nomme trois depuis le 05/09 (provenance,
  race, règle non citée). Le témoin la compte à part ; la propriété est reformulée, pas abaissée.
- Accueil, affirmations retirées, étape 3 DOM, dette Astro (165) : verts sur le dist.

## Annexe 31 — Import strict, lot 9 : 18 faits, 18 importés, clôture de l'examen des 102 compagnies (09/09/2026)

Paquet de Codex (`mesures/preuves/import-strict-lot-9-2026-09-09/`), lecture directe du 09/09 : les
9 dernières compagnies du référentiel, 18 faits, 9 non-décisions. Importé sur la base du lot 8, même
branche, même PR (#42, retitrée « lots 7, 8 et 9 »).

**Ce que la clôture veut dire, et ne veut pas dire** (Codex, repris tel quel) : les 102 compagnies
ont désormais une issue explicite pour chacun des trois canaux dans les artefacts stricts — fait
cité ou non-décision motivée. Couverture de l'**examen**, pas preuve sur les 306 canaux : 176
politiques citées sur 302, 126 restent sans phrase, et une absence de preuve reste une absence de
preuve.

| | |
|---|---|
| importés | 18 (Aerolíneas Argentinas ×3, Air Astana ×3, Batik Air Indonesia ×2, Croatia Airlines ×2, Edelweiss ×3, Neos ×2, TAROM ×3) |
| réactivés sur citation | 5 : Aerolíneas Argentinas, Air Astana, Edelweiss fret ; TAROM soute et fret |
| refusés | 0 |
| non-décisions | 9 : Batik Air Indonesia fret ; Batik Air Malaysia ×3 (aucun texte officiel exploitable — **rien n'est propagé** depuis Batik Air Indonesia) ; Croatia fret ; EL AL ×3 (la checklist de cage ne décide aucun canal) ; Neos fret |
| langues | russe (Air Astana ×3), espagnol (Aerolíneas Argentinas ×3), anglais |
| seuils écrits | Aerolíneas Argentinas 9 (« de máx. 9 kilos en el contenedor correspondiente »), Edelweiss 8 (« including the pet carrier »), TAROM 8 (« including the weight of the standard transportation cage ») |
| seuils non écrits | Air Astana 8, Neos 10 (chiffre absent de la phrase citée) |

### Nommé pour contre-revue de Codex

- **Croatia Airlines** : les deux sources sont des documents de première partie DATÉS (manuel
  d'exploitation au sol du 24.01.2023, politique de service d'octobre 2019). Importées par contrat
  (domaine officiel, phrase contiguë), échéance calculée par `reviewDueFrom` — jamais copiée. La
  priorité de relecture que Codex demande est **nommée ici** ; le dépôt n'a pas de mécanisme
  d'échéance anticipée, et en inventer un serait une règle métier nouvelle (arbitrage).
- **Air Astana fret** et **TAROM fret** : portées nommées (destinations où le bagage est interdit ;
  chiens de plus de 40 kg) que le modèle ne porte pas — même classe que Bangkok Airways et
  Philippine ; réactivés « sous conditions » réseau entier, nommés, pas convertis.
- **Aerolíneas Argentinas cabine et soute** : la source est un document interne rendu public
  (portail de formation « campus »), pas une page passager. Accepté par le contrat (domaine
  officiel), signalé.

### Mesuré après import

| | avant (lot 8) | après (lot 9) |
|---|---|---|
| politiques citées (décisives) | 158 (156) | 176 (174) |
| `allowed` / sous conditions / refusées / à confirmer | 0 / 124 / 32 / 146 | 0 / 140 / 34 / 128 |
| causes legacy / page officielle sans phrase | 129 / 15 | 111 / 15 |
| registre A / B / C / D | 158 / 58 / 87 / 3 | 176 / 53 / 74 / 3 |
| limites cabine citées | 27 | 30 (à vérifier sur le dist) |
| témoin hérité | 28 536 | 29 205 |
| canaux contradictoires | 265 / 100 fiches | 263 / 100 (Batik Air Indonesia cabine et soute) |
| causes de race (carlin) | 404 | 404 (mesuré avant/après : rien ne bouge) |
| climat tri-état, carlin CDG→IST | 47 (35 prov. / 38 race / 1 règle) | 45 (30 / 38 / 1) |
| baseline | figée lot 8 | figée `import-strict-lot-9-apres` : 8 cartes / 1 560, 1 compagnie (Neos), 12 → sous conditions, aucun refus, aucun verdict déplacé |

### Témoins re-fondés par mesure

Témoin C de l'inventaire : Aerolíneas Argentinas cabine citée → **Air Serbia cabine** (hors de tout
lot). Témoin « carte sans canal sourcé » : EL AL, inchangé — ses trois canaux restent non décidés par
la décision même de Codex. Sentinelle « non offerte, non prouvée » : Air China cabine, inchangée.

### Mouvements nommés

frontière, legacy (111, chaîne → lot 9), baseline (chaîne, répartition, preuve permanente lot 9),
carries (29 205), quatrième état (140), registre (176/53/74/3, canaux 78/10/14 · 70/24/8 ·
28/19/52, pistes 23/30, gov.uk 14, paires 176/23/74, écarts 29, niveaux 176/23/103), matrice (cinq
réactivations), entités (263), caisses (30), climat tri-état (45/30/38/1). Nouveau harnais
`test-preuves-lot-9.mjs` (103 contrôles), dans test:unit ; il vérifie aussi que la chaîne des
baselines figées est complète de l'import V3 au lot 9.

## Annexe 32 — Correctif d'arbitrages : six questions tranchées par Codex, relayées et tranchées par Philippe (09/09/2026)

Dossier : `mesures/preuves/correctif-arbitrages-2026-09-09/` (arbitrages détaillés + JSON `replace_facts`).
Ce n'est pas un lot : six preuves de lots déjà importés (4, 6, 8) sont remplacées, et trois
disponibilités changent **sur ordre** — ce que l'importeur ne fait jamais seul.

| Question | Arbitrage | Ce qui a été fait |
|---|---|---|
| Thai Airways fret (lot 8, refusé) | conservé « sous conditions », preuve remplacée par la page THAI Cargo | `undocumented` → `offered` à la main sur ordre ; ancienne citation auditée du 13/08 (« contactez Cargo ») retirée de la politique, consignée en commentaire de la fiche et dans le manifeste ; nouvelle preuve écrite par l'importeur (`--lot=correctif`) |
| China Southern soute (lot 8, fragment) | conservé, citation remplacée par la réponse complète | ancienne preuve retirée, nouvelle écrite par l'importeur |
| IndiGo fret (lot 8, fragment) | refus maintenu, prouvé par la FAQ CarGo | idem ; refus total prouvé maintenu |
| Bangkok Airways fret (lot 8, portée intérieure) | sous conditions **uniquement** sur les liaisons intérieures publiées (sauf Bangkok–Krabi, Chiang Mai–Krabi) ; hors périmètre, ne pas afficher le fret comme proposé | le modèle ne restreint pas par route : `offered` afficherait « sous conditions » sur un vol international. **Précédent Virgin A-bis appliqué** : `case_by_case` + citation du correctif (URL canonique) + conditions quadrilingues nommant Krabi → « à confirmer » partout. Nommé pour arbitrage si Codex préfère « sous conditions » réseau entier avec la portée en texte |
| Aer Lingus soute (lot 4, refusé) | arbitrage maintenu : soute via agent, Aer Lingus Regional exclue | `not_offered` → `offered` à la main sur ordre ; phrase du lot 4 écrite par l'importeur |
| Air China cabine (lot 6, refusé) | maintenu sous conditions sur les vols opérés par Air China ; « domestic dogs » = chiens domestiques | `not_offered` → `offered` à la main sur ordre ; phrase du lot 6, URL de l'accord de transport en cabine |

**Règle des seuils fixée par Codex** : chiffre, unité, borne et base pesée ; un plafond combiné
élimine un chien déjà trop lourd, il ne confirme jamais un chien plus léger. Le modèle la
respecte sur l'élimination (refus sûr au-dessus) et sur la non-confirmation (jamais `allowed`).
**Dette nommée** : pas de champ pour la borne — « inférieur à 8 kg » (Air Austral, exclusif) est
stocké comme un plafond inclusif : un chien de 8,0 kg exactement n'y est pas refusé alors qu'il
devrait l'être. Règle métier nouvelle : à arbitrer, pas corrigée ici. Témoin dans
`test-preuves-correctif.mjs`.

### Trouvé par la mesure, nommé comme dette

Aer Lingus soute et Air China cabine sont citées et « sous conditions » dans la politique, mais
des **règles héritées non citées** (`rule_aer_lingus_no_hold`, `rule_air_china_no_cabin`) gardent
les canaux « à confirmer » dans le Finder, en se nommant. Même dette que Philippine cabine ; les
règles compagnies restent hors du périmètre. Sans leur relecture, l'arbitrage n'atteint pas
l'écran du Finder pour ces deux canaux — la fiche, elle, dit bien « sous conditions ».

### Mesuré

| | avant (lot 9) | après (correctif) |
|---|---|---|
| politiques citées (décisives) | 176 (174) | 178 (176 : Thai fret devient une décision, Bangkok fret cesse d'en être une) |
| `allowed` / sous conditions / refusées / à confirmer | 0 / 140 / 34 / 128 | 0 / 142 / 34 / 126 |
| causes legacy / page officielle / non publiée / accord compagnie | 111 / 15 / 1 / 1 | 109 / 15 / **0** / **2** |
| registre A / B / C / D | 176 / 53 / 74 / 3 | 178 / 51 / 74 / 3 |
| témoin hérité | 29 205 | 29 190 |
| baseline | figée lot 9 | figée `correctif-arbitrages-apres` : 72 cartes / 1 560, 3 compagnies (Thai, Air China, Aer Lingus), 8 → sous conditions, aucun refus, aucun verdict déplacé |

### Témoins déplacés par mouvement nommé

- Sentinelle « non offerte, non prouvée » : Air China cabine citée → **Bangkok Airways cabine**
  (laissée non décidée par Codex).
- Manifeste T0-B2 : la décision auditée Thai fret (`undocumented`) est supersédée ; le manifeste
  la garde, la matrice admet la valeur arbitrée sur preuve, `test-t0b-legacy-unreviewed.mjs` § 7 bis
  compare désormais fiche, artefact et runtime à la source du correctif. Cause `policy_unpublished`
  : 1 → 0 dans le référentiel réel.
- Preuve permanente T0-B2-UI : l'URL AVIH de Thai, ajoutée alors comme source de canal, est
  supersédée par la page THAI Cargo — admise si sa remplaçante est une source de canal.
- Matrice : Bangkok fret, réactivé au lot 8, admis en `case_by_case` cité.
- Harnais des lots 4, 6, 8 et 9 réécrits à l'état arbitré, l'histoire gardée en commentaire.
  Nouveau harnais `test-preuves-correctif.mjs` (27 contrôles), dans test:unit.

**Importeur** : clé de faits configurable (`replace_facts`) ; le contrat ne change pas — il n'a
changé aucune disponibilité, les trois changements sont des lignes de fiche écrites à la main
avec l'arbitrage en commentaire.

### Post-scriptum — ce que le dist et la suite complète ont fait bouger (correctif)

- **Vocabulaire IATA** : la nouvelle citation Thai Cargo (« …the IATA's Live Animals Regulations… ») publie
  quatre jetons « IATA » (une page par langue) qu'aucune règle ni aucun scellé ne couvrait : l'étape 3 a
  rougi (1septies, 1undecies). C'est une citation officielle, licite par nature ; elle rejoint le scellé des
  tournures licites par le geste prévu (`test-etape3-dom.mjs --sceller-licites`, seul écrivain du scellé) —
  le coût voulu, payé par celui qui écrit la phrase.
- **Sentinelle « auditée · undocumented »** (Thai fret) : cette forme n'existe plus dans le référentiel réel
  (0 `policy_unpublished`) ; la même page porte désormais le témoin de la forme qui l'a remplacée — décision
  arbitrée sur ordre, citée, « accepté sous conditions ». Le harnais des entités relit la preuve de
  référence dans le correctif, plus dans le manifeste (lien, citation visible, date rendue, confiance).
- **Harnais de l'ingestion (l)** : la falsification de la source auditée visait la page passager AVIH
  (échéance 2026-11-11, « (For cargo… ») ; ces motifs ne trouvaient plus rien à falsifier. Re-fondée sur la
  preuve THAI Cargo — même contre-épreuve, même contrat.
- **Contre-épreuve du manifeste falsifié** : l'admission par arbitrage de Thai fret aveuglait la matrice
  quand la décision auditée était échangée avec Aegean. Erreur nommée, corrigée : l'admission ne vaut que
  si la ligne du manifeste porte encore la décision auditée d'origine ; un manifeste falsifié rougit.
- Caisses 56/56 (30 limites, 3 refus totaux), accueil, affirmations retirées, dette Astro 165 : verts.

## Annexe 34 — Micro-lot isolé « gabarit indicatif de cage » (09/09/2026, classement A/B)

Proposition de Codex, transmise et confirmée par Philippe (« transmets-lui le bloc tel quel »). Lot
séparé des politiques compagnies, branche `lot/gabarit-indicatif-cage` partie de `main` (`05f0f3d`).

### Trois informations distinctes dans le calculateur

| | source | présentation |
|---|---|---|
| `dimensions_minimales` | méthode de dimensionnement publiée, depuis les mesures RÉELLES saisies (inchangé) | gras, secondaires (bloc en pointillés, chiffres en gris) |
| `dimensions_conseillees` | minimales + marge MyDogCanFly de **3 cm** sur chaque dimension — la borne haute du conseil déjà affiché (« 2–3 cm »), NOTRE recommandation, dite comme telle | gras, dominantes parmi les dimensions |
| `gabarit_indicatif` | S, M, L, XL, XXL depuis les conseillées, par la table MyDogCanFly indicative | ≈ 4 × le texte courant (54 px sur 13,5), élément dominant de la carte |

Avertissement visible en bas de carte, quatre langues : « Les appellations varient selon les
fabricants. Vérifiez toujours les dimensions intérieures du modèle choisi. »

### La table n'est pas inventée

`packages/ui/src/lib/gabarit-indicatif.ts` porte le contrat (`nature: indicatif`, `auteur:
MyDogCanFly`, `version`, `classes[]` avec maxima intérieurs par gabarit) et une table **vide**,
version « 0 — table attendue (Codex prépare la correspondance et ses limites) ». Tant qu'elle est
vide, `gabaritPour` rend `null` et la carte dit « la table de correspondance MyDogCanFly n'est pas
encore publiée — utilisez les dimensions ci-dessous ». Remplir la table sera un mouvement nommé,
avec sa version. La sélection prend la plus petite classe, dans l'ordre S → XXL, dont les maxima
contiennent les conseillées, limite incluse ; au-delà de XXL, rien — jamais un gabarit par défaut ;
une classe mal formée invalide la table entière.

### Ce qui ne revient pas, vérifié

Aucun couple 100–700 / taille (garde `test-caisses-non-sourcees.mjs` inchangée, plus un témoin
dans `test-gabarit-indicatif.mjs`) ; aucune « cage approuvée/homologuée » ; aucune estimation depuis
la race seule (le module ne lit pas la race) ; aucun modèle commercial. Les phrases nouvelles
n'emploient pas le mot « IATA » (« méthode de dimensionnement publiée »), pour ne pas toucher au
registre des jetons de l'étape 3.

### Vérification proportionnée (A/B)

`test-gabarit-indicatif.mjs` (contrat, table vide, table synthétique aux limites, ce qui ne
revient pas), harnais des caisses relevant les deux blocs et le gabarit (conseillées = minimales + 3
dans les quatre langues, aucun gabarit tant que la table est vide, avertissement visible), table
portugaise des phrases en ligne complétée. Un seul build complet à la fin du lot.


### Erreurs nommées pendant le lot

- Le témoin « aucun couple 100–700 / taille » rougissait sur l'en-tête de commentaire du
  composant, qui NOMME l'ancien couple « 500 / XL » comme perte (annexe du 05/09). Le témoin mesure
  désormais le code et les phrases livrées, commentaires retirés, et s'auto-contrôle sur
  « 500 / XL » et « XL (500) » pour prouver qu'il mord encore. L'erreur nommée en commentaire
  n'est pas effacée.
- L'inventaire de l'étape 3 (`6ter`, contrat « zéro affirmation publique dans les surfaces
  applicatives ») a relevé le mot « homologuée » dans le commentaire d'en-tête du module, écrit
  pour dire ce qui ne revient pas. Même trajet que la ligne de `FlightFinder.astro` du 30/08 :
  le commentaire est reformulé sans le mot, le contrat reste à zéro, aucune exception de
  classement n'est ajoutée.
