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
