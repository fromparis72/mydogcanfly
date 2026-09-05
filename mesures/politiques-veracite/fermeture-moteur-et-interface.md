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
