# Micro-lot Tarifs — conception v2, avant tout code

Arbitrage propriétaire du 28/08/2026 ; deux contre-revues de conception le même jour. Tout chiffre
est mesuré ; les mesures se rejouent par `node mesures/tarifs-prelancement/outils/inventaire.mjs`.

**v1 → v2** — six P0 fermés, dont un qui est une faute de ma part et non un désaccord : le dossier
v1 attribuait à une caisse Ferplast des dimensions que **je n'ai pas mesurées et qui sont fausses**,
et mettait entre guillemets une phrase de fabricant que **j'ai reformulée**. Dans un dossier dont
l'objet est d'interdire les données inventées, c'était la faute exacte que le lot corrige. Les
exemples de ce dossier ne portent plus aucune valeur numérique non collectée.

---

## 1. Le défaut, mesuré dans le code et dans les données

**Le code.** `packages/engine/src/evaluate.ts:692` :

```js
const okPlacement = placementDecisions.find((x) => x.allowed)?.placement;
const fee = okPlacement ? (policy?.[okPlacement]?.fee ?? fees?.[okPlacement]) : undefined;
```

Trois fautes en deux lignes : **le repli vers `fees`** (champ libre hérité, sans structure ni
source) ; **un seul canal** retenu (le premier accepté, cabine > soute > fret) ; **aucune
qualification** — `FlightFinder.astro:642` rend `a.fee` nu. Deux autres surfaces le consomment, au
moins attribuées à un canal : `AirlinePremiumPage.astro:196`, `EntityPage.astro:365`.

**Le libellé multicanal**, `explain.ts:209`, est une cascade :

```js
const label = cabin ? L("air.cabin_ok") : hold ? L("air.hold_only") : cargo ? L("air.cargo_only") : …
```

Soute **et** fret ouverts produisent « Soute uniquement » — la contradiction de la capture.

**Les données** : 102 compagnies · 62 avec un tarif affichable · 101 champs, dont **91 de l'ancien
`fees`** et 10 de `premium.policy` · 45 cabine, 45 soute, 11 fret. Classification retenue :
75 fourchettes · 12 montants fixes · 11 devis · 1 barème par route et date (Delta cabine) ·
1 grille externe (EVA Air) · 1 valeur vide (`A$—`, Virgin Australia soute).

**La classification de l'inventaire est un outil de mesure. Elle ne devient jamais, par elle-même,
la donnée d'affichage.**

---

## 2. La règle de lancement, et sa conséquence stricte

> **Aucun montant n'est présenté comme le prix du trajet si le moteur ne peut pas le calculer
> exactement à partir des données saisies.**

**Aucune des 101 chaînes héritées n'est publiée dans ce lot.** (P0-3.) La v1 se contredisait : elle
les déclarait « dette non publiée » puis autorisait la fourchette KLM « avec qualification ». Une
chaîne non auditée ne redevient pas publiable parce qu'on lui accole un libellé. Elles restent dans
les données, non publiées, jusqu'à migration vers un contrat structuré et contre-vérifié.

Ce lot ne migre **aucun** tarif. Les statuts prudents suffisent à tenir la promesse ; la migration
structurée est un lot ultérieur, source par source.

---

## 3. Les trois registres — `packages/knowledge/tarifs/`

Emplacement approuvé, et la raison est mesurable : l'empreinte de provenance
(`provenance.mjs`, `ENTREES`) couvre `packages/ui`, `packages/knowledge`, `packages/engine`,
`package.json`, `package-lock.json`, `.nvmrc` — et rien d'autre. Un registre à la racine
échapperait au scellement.

**Publication d'un profil : deux à quatre modèles, dont au moins deux fabricants indépendants.**
Sans cette matière, le profil existe mais **ne produit aucun poids estimé** — il reste informatif.
Un champ de confiance ne remplace pas des observations manquantes.

### A. `modeles-caisses.json` — les objets réels

Chaque modèle porte le schéma **canonique** `Source` (`packages/knowledge/src/common.ts:119` :
`url`, `source_type`, `verified_date`, `review_due`, `confidence`, `reviewer`, `history`). Aucun
troisième modèle de provenance n'est créé. (P0-2.)

Une affirmation du fabricant emploie **`SourcedQuote`**
(`packages/knowledge/src/breed-restrictions.ts:533` = `Source` + `quote` verbatim + `quote_language`
BCP-47 + `locator`, en `.strict()`, avec refus de l'auto-citation) — **citation exacte, jamais une
reformulation entre guillemets**, et attribuée au fabricant.

```json
{
  "id": "<fabricant>_<modele>",
  "fabricant": "…",
  "modele": "…",
  "dimensions_exterieures_cm": { "l": 0, "w": 0, "h": 0 },
  "poids_a_vide_kg": 0,
  "type": "rigide",
  "materiau": "…",
  "source": { "url": "…", "source_type": "official_website", "verified_date": "…",
              "review_due": "…", "confidence": 3, "reviewer": "…", "history": [] },
  "affirmation_fabricant": {
    "quote": "<la phrase exacte de la page, dans sa langue>",
    "quote_language": "en",
    "locator": "<section ou ancre où la phrase se trouve>",
    "url": "…", "source_type": "official_website", "verified_date": "…",
    "review_due": "…", "confidence": 3, "reviewer": "…", "history": [],
    "attribution": "affirmation du fabricant, non vérifiée par MyDogCanFly"
  }
}
```

**Le champ `iata_approved` n'existe pas et ne doit jamais exister.** IATA publie une réglementation
(LAR) ; elle ne certifie aucun modèle commercial. Les valeurs ci-dessus sont des **zéros de
gabarit** : elles seront remplies par la collecte, chacune avec son locator. Aucune n'est inventée
ici — c'est précisément ce que la v1 avait fait.

### B. `profils-caisses.json` — les profils internes

L'intervalle de **poids à vide** est **dérivé** des modèles par script, et la dérivation est
inscrite pour que le diff la montre.

```json
{
  "id": "rigide_xl",
  "modeles": ["…", "…"],
  "fabricants_distincts": 2,
  "poids_kg": { "min": 0, "max": 0, "arrondi": [0, 0],
                "derive_de": "min/max des poids à vide des modèles cités, arrondi au kg inférieur/supérieur" },
  "publiable": true
}
```

**Aucune enveloppe de dimensions.** (P0-4.) Prendre séparément les minima et maxima de longueur,
largeur et hauteur produirait une **caisse composite qui n'existe chez aucun fabricant**. Les
dimensions restent donc **par modèle**, en triplets, et l'adéquation dimensionnelle du chien est
éprouvée **contre chaque modèle réel**, un par un. L'agrégat ne vaut que pour le **poids à vide**.

**Ce qui existe déjà et doit être absorbé** : la série de tailles est écrite **deux fois** —
`CrateCalculator.astro:68` et `breedTravel.ts:51`, dont le commentaire dit
« *mirrors CrateCalculator.astro* ». Deux listes que rien ne confronte, avec des dimensions
intérieures et **aucun poids**. Le registre devient leur source unique, avec une garde `test:unit`.

### C. `caisses-par-race.json` — la correspondance

```json
{ "breed_id": "breed_labrador_retriever",
  "profils_probables": ["rigide_l", "rigide_xl"],
  "methode": "…", "confiance": 3 }
```

Deux profils adjacents valent mieux qu'une fausse précision ; l'intervalle de poids agrège tous les
modèles de tous les profils plausibles. **Les dimensions réelles du chien restent prioritaires** :
la méthode IATA dimensionne la caisse sur les mesures effectives de l'animal.

---

## 4. Le vocabulaire « IATA » (P0-6)

**Mesuré : 72 occurrences d'« IATA » sur 10 fichiers de surface publique**, dans les quatre langues.
Trois natures s'y mélangent, et une seule est exacte :

1. **la méthode** — « Length = A + ½B, Width = C × 2, Height = D » : réelle, publiée par IATA, et le
   calculateur dit déjà honnêtement que sa sortie est une **estimation** parce qu'il estime B et C.
   Elle reste, en citant la méthode ;
2. **« caisse homologuée / approuvée / conforme IATA »** — `HomeSections.astro:125,134,186,195,247,
   256,310,319` et ailleurs : **faux**. IATA ne certifie pas les modèles. Reformulé en « caisse
   conforme aux exigences de transport aérien des compagnies », ou attribué à la compagnie qui
   l'exige ;
3. **la série 100/200/300/400/500/700** — convention **commerciale indicative**, pas une norme.
   Renommée « série commerciale indicative » ; ses dimensions doivent être **sourcées** avant
   d'entrer dans un calcul. Les extraire vers un JSON ne répare pas à soi seul leur absence de
   provenance.

**Périmètre soumis** : les points 2 et 3 entrent dans ce lot — le premier parce qu'il affirme une
homologation qui n'existe pas, le second parce qu'il alimente le calcul. Le volume (72 occurrences ×
4 langues) est signalé : si le lot doit rester court, le point 2 peut être scindé, mais il ne peut
pas rester tel quel au lancement.

---

## 5. L'ordre des données, et le calcul

**Poids du chien** : (1) **saisi par le visiteur** ; (2) sinon le poids de référence de la race.
**Mais** (P0-5) : les 172 `breed.weight_kg` sont des valeurs ponctuelles sans la provenance qu'un
calcul monétaire exige. Donc :

> **Une estimation tarifaire numérique exige le poids du chien SAISI.** Le poids de race sert d'aide
> indicative — pré-remplissage, ordre de grandeur, éligibilité prudente — jamais de poids tarifaire.
> Un poids de chien **estimé** combiné à une caisse **estimée** ne produit **aucun montant**.

Le rendu distingue explicitement « poids du chien saisi » et « poids du chien estimé d'après la
race ».

**Poids de la caisse** : (1) **saisi** — un champ facultatif « Poids de la caisse, si vous le
connaissez » est ajouté et **prime sur tout** ; (2) sinon l'intervalle du profil, s'il est
publiable ; (3) sinon **aucun calcul**.

```
total_min = poids_chien + caisse_min
total_max = poids_chien + caisse_max
```

- **une seule tranche couvre tout l'intervalle** → estimation autorisée, rendue « estimation
  MyDogCanFly », l'hypothèse nommée ;
- **l'intervalle traverse un seuil** → **aucun montant unique, aucun verdict certain** ;
- **dimensions possiblement incompatibles** → condition **séparée**, éprouvée modèle par modèle,
  levée même si le poids passe.

L'intervalle ne détermine **que la tranche de poids** — jamais un tarif qui dépend aussi de la
route, des dimensions, des segments ou de la date d'émission du billet.

---

## 6. Ce que la carte affiche — contrat minimal du premier lot

Le champ `fee` unique disparaît du contrat moteur. Chaque canal autorisé porte son statut :

| situation | rendu |
|---|---|
| ancien `fees` | **jamais publié** |
| cabine/soute sans tarif structuré | « Tarif à confirmer auprès de la compagnie » |
| tarif dépendant du trajet | « Tarif variable selon le trajet » |
| fret sans tarif structuré | « Sur devis » |
| grille externe | « Calculer le tarif sur le site de la compagnie » |

**Le lien officiel n'est affiché que s'il est explicitement stocké dans le nouveau contrat** — pas
déduit d'une source de fiche, pas emprunté à la racine du site de la compagnie.

**Aucun montant** tant qu'aucune table tarifaire structurée et sourcée ne permet de le calculer.

**Turkish Airlines** : `≈ $75` et `≈ $150` cessent d'être publiables. Rendu « Tarif variable selon
le trajet et le poids total » ; fret « Sur devis auprès de Turkish Cargo » ; le lien vers le barème
officiel n'apparaît qu'une fois stocké au contrat.

**Le libellé multicanal** cesse d'être une cascade : `cabine` · `soute` · `fret uniquement` ·
`soute, avec fret possible` · `plusieurs options disponibles`. Le fret n'est jamais présenté comme
un second canal équivalent à la soute.

---

## 7. Les cas de contrôle

- **Turkish KIX → IST, Akita 38 kg, poids SAISI** — intervalle total traversant la limite de 50 kg
  → « soute à confirmer / fret possible » ; aucun `$150` ; pas de « soute uniquement » tant que le
  fret est affiché.
- **Labrador 30 kg saisi** — intervalle depuis ses profils documentés, sans figer « XL ».
- **Labrador sans poids saisi** — aucune estimation numérique ; éligibilité prudente seulement.
- **Petite race en cabine** — l'ajout du sac peut faire traverser la limite de 8 kg.
- **Race sans correspondance de profil** — « tarif à confirmer », aucune estimation.
- **Profil non publiable** (moins de deux fabricants) — aucun poids estimé.
- **Turkish 5 kg** · **Emirates** · **ANA** · **KLM** · **Qantas / BA fret** — **aucun montant
  affiché**, statut prudent : les valeurs héritées ne sont pas publiées dans ce lot.
- Les quatre langues : **EN / FR / ES / PT**.

---

## 8. Les contre-épreuves bloquantes

**Tarifs** — rougir si : le repli vers `airline.fees` est réintroduit ; **une valeur monétaire
héritée est publiée** ; une valeur monétaire paraît sans statut structuré ; un tarif de soute est
affiché pour le fret ; une carte multicanal affiche un prix global ; Turkish affiche `$75` ou
`$150` ; un tarif dépendant du poids total est calculé avec le seul poids du chien ; un lien
« officiel » est rendu sans être stocké au contrat ; le DOM contient un prix sans qualification ;
le harnais manque de cartes ou de langues.

**Caisses** — rougir si : une taille commerciale est présentée comme « IATA officielle » ; le poids
d'un profil n'est pas dérivé de modèles sourcés ; un profil publie un poids avec moins de deux
fabricants distincts ; une race référence un profil inexistant ; un profil vide produit quand même
une estimation ; un seul profil arbitraire remplace plusieurs profils plausibles ; le poids de
caisse saisi ne prime pas ; **l'adéquation dimensionnelle est testée contre une caisse composite**
plutôt que modèle par modèle ; un poids de chien estimé produit un montant ; une estimation
franchissant une limite rend un résultat certain ; **la modification du poids d'un modèle ne se
propage pas au profil puis au calcul**.

---

## 9. Séquence

1. Registres A, B, C + script de dérivation + gardes `test:unit`.
2. Suppression du repli et du champ `fee` unique ; statuts par canal.
3. Libellés multicanaux.
4. Calcul d'intervalle, champ facultatif de poids de caisse, distinction saisi/estimé.
5. Vocabulaire IATA : série requalifiée, affirmations d'homologation reformulées.
6. `test:unit`, harnais tarifaire, build complet, contrôles du site.
7. PR indépendante ; fusion après CI verte et décision du propriétaire.
8. Préversion immuable reconstruite — elle remplacera celle de la porte SEO/GEO.
