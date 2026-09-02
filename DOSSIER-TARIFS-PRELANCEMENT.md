# Micro-lot Tarifs — conception v3, avant tout code

Arbitrage propriétaire du 28/08/2026 ; trois contre-revues de conception. Tout chiffre est mesuré ;
les mesures se rejouent par `node mesures/tarifs-prelancement/outils/inventaire.mjs`.

**Historique des versions, parce qu'il explique la forme actuelle.**

- **v1 → v2** — six P0. Dont une faute de ma part, pas un désaccord : la v1 attribuait à une caisse
  Ferplast des dimensions que je n'avais pas mesurées, et mettait entre guillemets une phrase de
  fabricant que j'avais reformulée. Dans un dossier dont l'objet est d'interdire les données
  inventées.
- **v2 → v3** — deux P0. La v2 croyait avoir refermé le trou en passant à des gabarits à zéro ;
  elle laissait en fait deux portes ouvertes : **une source ne prouve pas un chiffre** (elle prouve
  seulement d'où vient la page), et **des statuts d'affichage sans registre** — « Tarif variable
  selon le trajet et le poids total » pour Turkish — n'ont pas plus de fondement que les montants
  qu'ils remplacent.

---

## 1. Le défaut, mesuré dans le code et dans les données

**Le code.** `packages/engine/src/evaluate.ts:692` :

```js
const okPlacement = placementDecisions.find((x) => x.allowed)?.placement;
const fee = okPlacement ? (policy?.[okPlacement]?.fee ?? fees?.[okPlacement]) : undefined;
```

Trois fautes : **le repli vers `fees`** (champ libre hérité) ; **un seul canal** (le premier
accepté) ; **aucune qualification** — `FlightFinder.astro:642` rend `a.fee` nu. Deux autres surfaces
le consomment, au moins attribuées à un canal : `AirlinePremiumPage.astro:196`,
`EntityPage.astro:365`.

**Le libellé multicanal**, `explain.ts:209`, est une cascade — soute **et** fret ouverts produisent
« Soute uniquement ».

**Les données** : 102 compagnies · 62 avec un tarif affichable · 101 champs, dont **91 de l'ancien
`fees`** · 45 cabine, 45 soute, 11 fret. Classification : 75 fourchettes · 12 montants fixes ·
11 devis · 1 barème par route et date · 1 grille externe · 1 valeur vide.

**La classification de l'inventaire est un outil de mesure. Elle n'alimente ni un statut public, ni
un lien.**

---

## 2. La règle de lancement

> **Aucun montant n'est présenté comme le prix du trajet si le moteur ne peut pas le calculer
> exactement à partir des données saisies.**

**Aucune des 101 chaînes héritées n'est publiée dans ce lot.** Elles restent dans les données, non
publiées, jusqu'à migration vers un contrat structuré et contre-vérifié — qui est un lot ultérieur.

---

## 3. Ce que la carte affiche — le contrat minimal, et rien de plus

**P0-2 de la v2 : un statut d'affichage doit avoir une source de vérité.** La v2 prévoyait des
rendus particuliers (« Tarif variable selon le trajet et le poids total » pour Turkish) qu'aucun
contrat structuré ne portait. Un statut inventé n'est pas meilleur qu'un montant inventé — il est
seulement moins visible.

**Dans ce lot, le statut est donc DÉRIVÉ DU CANAL, et de rien d'autre :**

| canal | rendu, en quatre langues |
|---|---|
| cabine, soute | « Tarif à confirmer auprès de la compagnie » |
| fret | « Tarif à demander au service cargo » |

- **aucun montant**, quelle qu'en soit l'origine ;
- **aucun lien tarifaire particulier** — un lien officiel ne s'affiche que s'il est explicitement
  stocké dans un contrat structuré, ce qu'aucun n'est encore ;
- **aucun statut par compagnie** — Turkish n'obtient son rendu particulier qu'après migration
  sourcée, comme les autres.

Un registre `tarifs-compagnies.json` (statut par canal, lien officiel, preuve canonique) reste la
suite naturelle, mais il impose un audit compagnie par compagnie : hors de ce lot, et nommé comme
tel.

**Le libellé multicanal** cesse d'être une cascade : `cabine` · `soute` · `fret uniquement` ·
`soute, avec fret possible` · `plusieurs options disponibles`. Le fret n'est jamais présenté comme
un second canal équivalent à la soute.

Ce lot ferme donc le défaut visible — les prix trompeurs disparaissent — sans fournir de calcul
monétaire. « À confirmer » vaut mieux qu'un montant précis et faux.

---

## 4. Les trois registres — `packages/knowledge/tarifs/`

Emplacement approuvé : l'empreinte de provenance (`provenance.mjs`, `ENTREES`) couvre les trois
paquets et six fichiers racine, rien d'autre ; un registre à la racine échapperait au scellement.

**Publication d'un profil : deux à quatre modèles, dont au moins deux fabricants indépendants.**
Sans cette matière : `publiable: false`, aucun poids estimé, aucune estimation affichée. Un champ
de confiance ne remplace pas des observations manquantes.

### A. `modeles-caisses.json` — et la preuve porte sur les CHIFFRES

**P0-1 de la v2 : `Source` prouve d'où vient la page, pas que le chiffre y figure.** Chaque
spécification porte donc sa propre preuve.

```json
{
  "id": "ferplast_atlas_70",
  "fabricant": "Ferplast",
  "modele": "Atlas 70 Professional",
  "specifications": {
    "valeurs_originales": { "unite_longueur": "cm", "unite_masse": "kg",
                            "l": 101, "w": 68.5, "h": 75.5, "poids_a_vide": 12.6,
                            "champ_source": "poids net" },
    "normalisees_cm_kg": { "l": 101, "w": 68.5, "h": 75.5, "poids_a_vide_kg": 12.6,
                           "derive_de": "conversion mécanique depuis valeurs_originales" },
    "preuve": { "quote": "<la ligne exacte de la fiche technique, dans sa langue>",
                "quote_language": "it", "locator": "<section ou ligne du tableau>",
                "url": "…", "source_type": "official_website", "verified_date": "…",
                "review_due": "…", "confidence": 4, "reviewer": "…", "history": [] }
  },
  "declaration_fabricant": {
    "attribution": "déclaration du fabricant — MyDogCanFly ne l'a pas vérifiée",
    "condition": "<la condition que le fabricant y attache, citée>",
    "citation": { "quote": "…", "quote_language": "it", "locator": "…", "url": "…",
                  "source_type": "official_website", "verified_date": "…", "review_due": "…",
                  "confidence": 4, "reviewer": "…", "history": [] }
  }
}
```

Quatre contraintes, chacune éprouvée :

1. **valeurs originales dans leurs unités d'origine** — Petmate publie en pouces et livres,
   Ferplast en centimètres et kilogrammes. On ne convertit pas avant d'enregistrer ;
2. **`normalisees_cm_kg` est DÉRIVÉE**, jamais saisie ; une valeur qui ne correspond pas à la
   conversion de son originale fait rougir ;
3. **le poids vient du champ explicitement libellé « poids net »** — `champ_source` le nomme.
   Certaines pages exposent en parallèle un poids d'expédition ou un poids de plateforme
   marchande, différent du poids net : prendre le premier chiffre trouvé serait une erreur
   silencieuse ;
4. **nombres strictement positifs** — les gabarits à zéro sont **interdits dans les fichiers de
   production** ; ils n'existent que dans ce dossier, comme forme.

**`attribution` et `condition` vivent DANS L'ENVELOPPE, jamais dans la citation.** Mesuré à
l'exécution : `Source` accepte un champ inconnu ; `SourcedQuote` est `.strict()` et rejette
`attribution` avec `unrecognized_keys`. L'exemple de la v2 aurait donc été refusé par le schéma —
c'est le genre de faute qu'un document ne montre pas et qu'un `safeParse` montre en une seconde.

**Le champ `iata_approved` n'existe pas et ne doit jamais exister.** IATA publie des exigences
minimales de contenant et **déclare explicitement ne certifier, n'approuver ni ne recommander
aucune marque ni aucun modèle** ; l'acceptation finale appartient à l'opérateur.

### B. `profils-caisses.json` — le poids agrégé, et lui seul

```json
{ "id": "rigide_xl", "modeles": ["…", "…"], "fabricants_distincts": 2,
  "poids_kg": { "min": 0, "max": 0, "arrondi": [0, 0],
                "derive_de": "min/max des poids à vide normalisés des modèles cités" },
  "publiable": true }
```

**Aucune enveloppe de dimensions.** Prendre séparément les minima et maxima de longueur, largeur et
hauteur fabriquerait une caisse composite qui n'existe chez aucun fabricant. Les dimensions restent
**en triplets par modèle**, et l'adéquation du chien s'éprouve **contre chaque modèle réel**.
L'agrégat ne vaut que pour le **poids à vide**.

**À absorber** : la série de tailles est écrite deux fois — `CrateCalculator.astro:68` et
`breedTravel.ts:51` (« *mirrors CrateCalculator.astro* ») — sans aucun poids. Le registre devient
leur source unique, avec une garde `test:unit`.

### C. `caisses-par-race.json`

```json
{ "breed_id": "breed_labrador_retriever", "profils_probables": ["rigide_l", "rigide_xl"],
  "methode": "…", "confiance": 3 }
```

Deux profils adjacents valent mieux qu'une fausse précision. **Les dimensions réelles du chien
restent prioritaires** : la méthode IATA dimensionne la caisse sur les mesures de l'animal.

**Les trois registres sont figés OBJET PAR OBJET** — locators compris —, jamais par leurs seuls
effectifs ou intervalles agrégés : c'est la leçon du registre de routage.

---

## 5. Le vocabulaire « IATA » — les deux corrections restent dans ce lot

**Mesuré : 72 occurrences sur 10 fichiers de surface publique**, quatre langues. Trois natures :

1. **la méthode de dimensionnement** — réelle et publiée ; elle reste, et le calculateur dit déjà
   qu'il **estime** deux des quatre mesures ;
2. **« caisse homologuée / approuvée / conforme IATA »** — `HomeSections.astro:125,134,186,195,247,
   256,310,319` et ailleurs : **faux**, et démenti par IATA elle-même. Reformulé, ou attribué à la
   compagnie qui l'exige ;
3. **la série 100/200/300/400/500/700** — convention **commerciale indicative**, renommée comme
   telle, dimensions sourcées avant tout calcul. Les extraire vers un JSON ne répare pas leur
   absence de provenance.

---

## 6. L'ordre des données, et le calcul

**Poids du chien** : (1) **saisi** ; (2) sinon le poids de référence de la race — mais les 172
`breed.weight_kg` sont des valeurs ponctuelles sans la provenance qu'un calcul monétaire exige.

> **Toute estimation numérique exige le poids du chien SAISI.** Le poids de race sert d'aide
> indicative — pré-remplissage, ordre de grandeur, éligibilité prudente. Poids estimé + caisse
> estimée → **aucun montant**. Le rendu distingue « saisi » de « estimé d'après la race ».

**Poids de la caisse** : (1) **saisi** — champ facultatif « Poids de la caisse, si vous le
connaissez », qui **prime sur tout** ; (2) sinon l'intervalle du profil, s'il est publiable ;
(3) sinon aucun calcul.

```
total_min = poids_chien + caisse_min      total_max = poids_chien + caisse_max
```

- **une seule tranche couvre tout l'intervalle** → estimation autorisée, « estimation
  MyDogCanFly », hypothèse nommée ;
- **l'intervalle traverse un seuil** → aucun montant unique, aucun verdict certain ;
- **dimensions possiblement incompatibles** → condition séparée, éprouvée modèle par modèle.

L'intervalle ne détermine **que la tranche de poids**.

---

## 7. Les cas de contrôle

- **Turkish KIX → IST, Akita 38 kg, poids saisi** — l'intervalle traverse la limite de 50 kg →
  « soute à confirmer / fret possible » ; aucun montant ; pas de « soute uniquement » tant que le
  fret est affiché.
- **Labrador 30 kg saisi** — intervalle depuis ses profils documentés, sans figer « XL ».
- **Labrador sans poids saisi** — aucune estimation numérique.
- **Petite race en cabine** — l'ajout du sac peut faire traverser la limite de 8 kg.
- **Race sans profil**, **profil non publiable** — aucune estimation.
- **Turkish 5 kg · Emirates · ANA · KLM · Qantas / BA fret** — **aucun montant**, statut générique
  du canal.
- Quatre langues : **EN / FR / ES / PT**.

---

## 8. Les contre-épreuves bloquantes

**Tarifs** — rougir si : le repli vers `airline.fees` est réintroduit ; une valeur monétaire héritée
est publiée ; une valeur monétaire paraît sans statut structuré ; **un statut par compagnie apparaît
sans contrat sourcé** ; **un lien « officiel » est rendu sans être stocké au contrat** ; un tarif de
soute est affiché pour le fret ; une carte multicanal affiche un prix global ; Turkish affiche `$75`
ou `$150` ; le DOM contient un prix sans qualification ; le harnais manque de cartes ou de langues.

**Caisses** — rougir si : une taille commerciale est présentée comme « IATA officielle » ; **le
poids d'un modèle est modifié sans que sa citation et sa source changent** ; **une valeur normalisée
ne correspond pas à la conversion de sa valeur originale** ; **un poids est tiré d'un champ
commercial générique au lieu du champ « poids net »** ; **un champ supplémentaire est glissé dans
une `SourcedQuote`** ; un zéro subsiste dans un fichier de production ; un profil publie un poids
avec moins de deux fabricants distincts ; une race référence un profil inexistant ; un profil non
publiable produit une estimation ; un seul profil arbitraire remplace plusieurs profils plausibles ;
le poids de caisse saisi ne prime pas ; **l'adéquation dimensionnelle est testée contre une caisse
composite** ; un poids de chien estimé produit un montant ; une estimation franchissant une limite
rend un résultat certain ; **la modification du poids d'un modèle ne se propage pas au profil puis
au calcul**.

---

## 9. Séquence, et ce qui manque encore pour la collecte

1. Registres A, B, C **vides mais valides** — `publiable: false`, aucune estimation, **CI verte** :
   une branche honnêtement vide est verte ; une PR n'est jamais livrée avec une CI volontairement
   rouge.
2. Script de dérivation + gardes `test:unit` + les contre-épreuves du § 8.
3. Suppression du repli et du champ `fee` unique ; statuts génériques par canal.
4. Libellés multicanaux.
5. Calcul d'intervalle, champ de poids de caisse, distinction saisi/estimé.
6. Vocabulaire IATA : série requalifiée, allégations d'homologation reformulées.
7. `test:unit`, harnais tarifaire, build complet, contrôles du site.
8. PR indépendante ; fusion après CI verte et décision du propriétaire.
9. Préversion immuable reconstruite — elle remplacera celle de la porte SEO/GEO.

**Ce qui manque pour remplir les registres.** La collecte relayée du 29/08/2026 apporte les
**valeurs** (Petmate : six Sky Kennel en pouces et livres ; Ferplast : Atlas 40, 50, 60, 70 en
centimètres avec leur poids net ; et le démenti d'IATA sur la certification des modèles). Elle
n'apporte pas encore, pour chaque modèle, la **citation exacte et son locator** — or c'est
précisément ce que le § 4 A exige, et l'inscrire sans serait refaire la faute de la v1 d'un cran
plus loin. Les registres partent donc vides et gardés ; la collecte les remplit ligne à ligne,
chaque chiffre avec la phrase qui le porte.
