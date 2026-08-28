# Micro-lot Tarifs — conception, avant tout code

Arbitrage propriétaire du 28/08/2026, contre-revue de conception du même jour. Ce dossier est
soumis **avant** implémentation. Tout chiffre y est mesuré ; les mesures se rejouent par
`node mesures/tarifs-prelancement/outils/inventaire.mjs`.

---

## 1. Le défaut, mesuré dans le code et dans les données

**Le code.** `packages/engine/src/evaluate.ts:692` :

```js
const okPlacement = placementDecisions.find((x) => x.allowed)?.placement;
const fee = okPlacement ? (policy?.[okPlacement]?.fee ?? fees?.[okPlacement]) : undefined;
```

Trois fautes en deux lignes :

1. **le repli vers `fees`** — un champ libre hérité, sans structure ni source, alimente une carte ;
2. **un seul canal** — le premier accepté dans l'ordre cabine > soute > fret ; le montant est
   ensuite affiché *sans* dire de quel canal il vient ;
3. **aucune qualification** — `FlightFinder.astro:642` rend `a.fee` nu :
   `${a.fee ? `<div class="acard__fee">${esc(a.fee)}</div>` : ""}`.

Deux autres surfaces consomment le même champ, elles au moins attribuées à un canal :
`AirlinePremiumPage.astro:196` et `EntityPage.astro:365`.

**Le libellé multicanal.** `packages/engine/src/explain.ts:209` :

```js
const label = cabin ? L("air.cabin_ok") : hold ? L("air.hold_only") : cargo ? L("air.cargo_only") : …
```

Une cascade, pas une combinaison : soute **et** fret ouverts produisent « Soute uniquement ».
C'est exactement la contradiction relevée sur la capture.

**Les données** (recalculées, non recopiées) : 102 compagnies · 62 avec un tarif affichable ·
101 champs tarifaires, dont **91 viennent de l'ancien `fees`** et 10 seulement de
`premium.policy` · par canal : 45 cabine, 45 soute, 11 fret.

Classification retenue après arbitrage : **75** fourchettes simples · **12** montants fixes ·
**11** devis (au sens métier — `via Virgin Australia Cargo` compris, sans le mot « quote ») ·
**1** barème par route et date (Delta cabine : `$150 (US/Canada/PR/USVI) or $200 international,
for tickets issued on/after 8 Apr 2025`) · **1** grille externe (EVA Air : `excess-baggage rate`)
· **1** valeur vide non publiable (Virgin Australia soute : `A$—`).

---

## 2. La règle de lancement

> **Aucun montant n'est présenté comme le prix du trajet si le moteur ne peut pas le calculer
> exactement à partir des données saisies.**

Les 101 anciennes chaînes ne sont **ni auditées ni corrigées** dans ce lot : elles deviennent une
**dette non publiée**. On ne les supprime pas — on les rend non publiables par le moteur.

---

## 3. Les trois registres, et pourquoi ils vivent dans `packages/knowledge`

La contre-revue les nommait `tarifs/*.json` à la racine. **Déviation argumentée, avec sa mesure :**
l'empreinte de provenance (`packages/knowledge/scripts/lib/provenance.mjs`, constante `ENTREES`)
couvre `packages/ui`, `packages/knowledge`, `packages/engine`, `package.json`,
`package-lock.json` et `.nvmrc` — **et rien d'autre**. Un registre placé à la racine ne serait donc
pas dans l'empreinte : le poids d'une caisse pourrait changer sans que la carte d'identité de
l'artefact bouge, et la porte de lancement validerait un site construit sur d'autres données. Les
trois registres vivent donc dans `packages/knowledge/tarifs/`, où le paquet entier est déjà scellé.

### A. `packages/knowledge/tarifs/modeles-caisses.json` — les objets réels

Un modèle du commerce, tel que son fabricant le décrit.

```json
{
  "id": "ferplast_atlas_70",
  "fabricant": "Ferplast",
  "modele": "Atlas 70 Professional",
  "dimensions_exterieures_cm": { "l": 92, "w": 63, "h": 68 },
  "poids_a_vide_kg": 12.6,
  "type": "rigide",
  "materiau": "polypropylène",
  "source": { "url": "https://www.ferplast.com/products/atlas-professional-8311",
              "verifiee_le": "2026-08-28" },
  "affirmation_fabricant": {
    "texte": "conforme aux normes IATA pour le transport aérien",
    "attribution": "affirmation du fabricant, non vérifiée par MyDogCanFly"
  }
}
```

**Le champ `iata_approved` n'existe pas et ne doit jamais exister.** IATA publie une réglementation
(LAR) ; elle ne certifie aucun modèle commercial. Une affirmation de conformité est une phrase du
fabricant, citée comme telle et attribuée — jamais un fait du site.

### B. `packages/knowledge/tarifs/profils-caisses.json` — les profils internes

Un profil regroupe les modèles qui jouent le même rôle. **Aucune valeur libre :** l'intervalle est
**dérivé** des modèles cités, par un script, et le fichier porte la dérivation pour que le diff la
montre.

```json
{
  "id": "rigide_xl",
  "modeles": ["ferplast_atlas_70", "petmate_sky_kennel_40"],
  "poids_kg": { "min": 12.6, "max": 13.8, "arrondi": [12, 14],
                "derive_de": "min/max des poids à vide des modèles, arrondi au kg inférieur/supérieur" },
  "dimensions_cm": { "l": [92, 102], "w": [63, 66], "h": [68, 76] }
}
```

Le « 12–14 kg » de l'exemple d'arbitrage est donc **une dérivation arrondie et documentée**, pas une
constante de moteur.

**Ce qui existe déjà et doit être absorbé :** la série de tailles est aujourd'hui écrite **deux
fois** — `packages/ui/src/components/CrateCalculator.astro:68` et
`packages/ui/src/lib/breedTravel.ts:51`, dont le commentaire dit « *mirrors CrateCalculator.astro* ».
Deux listes que rien ne confronte : la même faute que le routage. Elles portent des dimensions
intérieures et **aucun poids**. Le registre des profils devient leur source unique, et une garde
`test:unit` exige que les deux surfaces le lisent au lieu de le recopier.

### C. `packages/knowledge/tarifs/caisses-par-race.json` — la correspondance

```json
{
  "breed_id": "breed_labrador_retriever",
  "profils_probables": ["rigide_l", "rigide_xl"],
  "methode": "taille « large » et poids de référence 30 kg ; deux profils adjacents retenus faute de mesure morphologique",
  "confiance": 3
}
```

Deux profils adjacents valent mieux qu'une fausse précision : l'intervalle final agrège **tous** les
modèles de **tous** les profils plausibles. Un `surcharge_morphologique` facultatif permet de
corriger une race hors norme sans toucher au profil.

**Les dimensions réelles du chien restent prioritaires** : IATA dimensionne la caisse sur la
longueur, la hauteur et la largeur effectives de l'animal. Le profil n'est qu'un défaut quand ces
mesures manquent — c'est déjà la position du calculateur de caisse existant, qui dit en toutes
lettres que sa sortie est une estimation et non une exigence IATA exacte.

---

## 4. L'ordre des données, et le calcul

**Poids du chien** : (1) saisi par le visiteur ; (2) sinon le poids de référence de la race
(`weight_kg`, présent sur les 172 races).

**Poids de la caisse** : (1) **saisi par le visiteur** — un champ facultatif « Poids de la caisse,
si vous le connaissez » est ajouté et **prime sur tout** ; (2) sinon l'intervalle des profils de la
race ; (3) sinon **aucun calcul tarifaire** — « tarif à confirmer », sans estimation inventée.

```
total_min = poids_chien + caisse_min
total_max = poids_chien + caisse_max
```

- **une seule tranche couvre tout l'intervalle** → estimation autorisée, rendue comme
  « estimation MyDogCanFly », avec l'hypothèse nommée (le profil retenu et son intervalle) ;
- **l'intervalle traverse un seuil** (tarifaire ou d'acceptation) → **aucun montant unique, aucun
  verdict certain** — « à confirmer » ;
- **les dimensions peuvent être incompatibles** → condition **séparée**, levée même si le poids
  passe.

L'intervalle ne détermine **que la tranche de poids**. Il ne suffit jamais à calculer un tarif qui
dépend aussi de la route, des dimensions, du nombre de segments ou de la date d'émission du billet.

---

## 5. Ce que la carte affiche

Le champ `fee` unique disparaît du contrat moteur. Chaque **canal autorisé** porte son propre
**statut tarifaire** :

| statut | rendu |
|---|---|
| `a_confirmer` | « Tarif à confirmer auprès de la compagnie » |
| `variable_selon_trajet` | « Tarif variable selon le trajet » (Delta, Turkish) |
| `fourchette_publiee` | « Fourchette officielle, non calculée pour ce trajet » + la fourchette |
| `sur_devis` | « Sur devis » (fret) |
| `calculateur_externe` | « Calculer le tarif sur le site de la compagnie » |
| `estimation_mdcf` | « Estimation MyDogCanFly » + l'hypothèse de caisse, **jamais** « prix » |

Chaque message est **lié à la page tarifaire officielle** quand elle existe. Un montant exact ne
sera autorisé que plus tard, sous un contrat structuré prouvant : canal, route ou zone, devise,
poids combiné, dimensions si nécessaires, prix par segment/direction/contenant, date
d'applicabilité, source officielle datée.

**Turkish Airlines**, nommément : `≈ $75` (cabine) et `≈ $150` (soute) cessent d'être publiables —
ils viennent du tableau intercompagnies/transit, pas d'un vol direct. Rendu :
« Tarif variable selon le trajet et le poids total », lien vers le barème officiel, mention que les
catégories portent sur le poids **animal + caisse** ; fret : « Sur devis auprès de Turkish Cargo ».

**Le libellé multicanal** cesse d'être une cascade. Cinq états au minimum : `cabine` ·
`soute` · `fret uniquement` · `soute, avec fret possible` · `plusieurs options disponibles`.
Le fret n'est jamais présenté comme un second canal équivalent à la soute.

---

## 6. Les cas de contrôle

- **Turkish KIX → IST, Akita 38 kg** — profils de l'Akita → intervalle de caisse ; total
  **50–52 kg** ; la limite Turkish de 50 kg est **traversée** → « soute à confirmer / fret
  possible », aucun `$150`, et pas de « soute uniquement » tant que le fret reste affiché.
- **Labrador 30 kg** — l'intervalle se calcule depuis ses profils **documentés**, sans figer « XL »
  d'autorité ; si une tranche couvre tout l'intervalle, l'estimation est permise et nommée.
- **Turkish, chien de 5 kg** — aucun `$75` présenté comme prix du trajet.
- **Petite race en cabine** — vérifier que l'ajout du sac peut faire **traverser** la limite de 8 kg.
- **Race sans correspondance** — « tarif à confirmer », aucune estimation inventée.
- **Emirates** — aucune fourchette `$500–800` présentée comme prix personnalisé.
- **ANA** — aucun `$230–460` présenté comme résultat calculé.
- **KLM** — `70–500 €` visible seulement avec « fourchette publiée, non calculée ».
- **Qantas / British Airways fret** — « Sur devis », aucun montant.
- Les quatre langues : **EN / FR / ES / PT**.

---

## 7. Les contre-épreuves bloquantes

**Sur les tarifs** — faire rougir si : le repli vers `airline.fees` est réintroduit ; une valeur
monétaire brute paraît sur une carte sans statut structuré ; un tarif de soute est affiché pour le
fret ; une carte multicanal affiche un prix global ; Turkish affiche `$75` ou `$150` ; un tarif
dépendant du poids total est calculé avec le seul poids du chien ; le DOM construit contient un prix
sans qualification ou sans lien officiel ; le harnais manque de cartes ou de langues.

**Sur les caisses** — faire rougir si : une taille commerciale est présentée comme taille « IATA
officielle » ; le poids d'un profil n'est pas dérivé de modèles sourcés ; une race référence un
profil inexistant ; un profil vide produit quand même une estimation ; un seul profil arbitraire
remplace plusieurs profils plausibles ; le poids de caisse saisi ne prime pas ; une estimation
franchissant une limite rend un résultat certain ; **la modification du poids d'un modèle ne se
propage pas au profil puis au calcul** (la contre-épreuve de bout en bout).

---

## 8. Séquence

1. Registres A, B, C + le script de dérivation, avec leurs gardes `test:unit`.
2. Suppression du repli et du champ `fee` unique ; statuts tarifaires par canal.
3. Libellés multicanaux.
4. Calcul d'intervalle et champ facultatif de poids de caisse.
5. `test:unit`, harnais tarifaire, build complet, contrôles du site.
6. PR indépendante ; fusion après CI verte et décision du propriétaire.
7. Préversion immuable reconstruite — **elle remplacera celle de la porte SEO/GEO**.

---

## 9. Deux points soumis à arbitrage

1. **L'emplacement des registres** — `packages/knowledge/tarifs/` et non `tarifs/` à la racine,
   pour la raison de provenance mesurée au § 3. Si la racine est maintenue, il faut alors élargir
   `ENTREES` dans `provenance.mjs`, ce qui invalide toutes les cartes existantes : mouvement
   possible, mais qui doit être décidé, pas subi.
2. **Le nombre de modèles à sourcer pour le premier lot.** Deux modèles par profil suffisent à
   produire un intervalle honnête, mais un intervalle tiré de deux modèles n'est pas une
   distribution du marché. Je propose de viser deux à quatre modèles par profil et de porter la
   confiance au registre, plutôt que d'élargir artificiellement les bornes.
