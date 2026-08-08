# Note — collecte élargie (exploitation du quota Ultra)

*MyDogCanFly — 29/07/2026. Objectif : dépenser le quota mensuel restant pour récupérer
un maximum de données de routes réutilisables plus tard.*

---

## 1. Ce qui a été collecté

| Élément | Départ | **Après collecte élargie** |
|---|---|---|
| Aéroports scannés | 249 | **1073** (+824) |
| Compagnies suivies | 78 | **102** |
| Routes directes (année-pleine) | 6 334 | **14 141** |
| Routes saisonnières | 1 718 | **7 125** |
| Unités AeroDataBox | — | **quota épuisé** (arrêt automatique à ~3 unités de la limite) |

Méthode **inchangée** (donc comparable à la base existante) : transporteur opérant
(`withCodeshared=false`), sans escale, échantillonnage **semaine d'été (3–9 août 2026) +
semaine d'hiver (18–24 janvier 2027)**, 2 fenêtres de 12 h/jour. Vu été **et** hiver →
`direct_routes` ; une seule saison → `seasonal_routes`.

Format validé : **0 arête mal formée, 0 hors périmètre, 0 mal triée.**

---

## 2. Les 824 nouveaux aéroports (comment ils ont été choisis)

- **264 aéroports** = le réseau des 16 nouvelles compagnies demandées (leurs bases hors
  périmètre — Almaty, Koh Samui, bases UK de TUI, domestique Indonésie/Malaisie/Argentine —
  + leurs destinations).
- **560 aéroports** = les aéroports encore non couverts **les plus desservis par tes
  compagnies** (priorisés par nombre de compagnies suivies qui s'y posent). Ex. Mykonos
  (21 cies), Turin (18), Tromsø (18), Erevan (15), Hanovre (14), Pise, Nuremberg,
  Fort Lauderdale, Nashville… Ce sont eux qui **ferment le plus d'arêtes**.

Périmètre complet listé dans `perimetre_1073_aeroports.json`.

---

## 3. Compagnies

**24 compagnies ajoutées** aux 78 : les 10 du Tier 1 animaux (Pegasus, airBaltic, Neos,
Air Serbia, Luxair, Royal Jordanian, Croatia, Edelweiss, SunExpress, Sky Express) + les
14 nouvelles demandées (Kenya Airways KQ, South African SA, Gulf Air GF, Batik Indonésie ID,
Batik/Malindo Malaisie OD, TUI Airways BY, Air Astana KC, Aerolíneas AR, Asiana OZ,
Bangkok Airways PG, TAROM RO, Air Austral UU, Aircalin SB, La Compagnie B0).

**2 compagnies non collectables (limite de la source, signalées) :**

- **Hawaiian (HA)** — depuis le rachat par Alaska, AeroDataBox **fond Hawaiian dans Alaska (AS)** :
  0 vol « HA », 1 195 vols « AS » à Honolulu. Non séparable. ⚠️ Conséquence : **la donnée AS
  inclut désormais des routes Hawaii** — à garder en tête si tu exploites AS.
- **Iberia Express (I2)** — fondue dans Iberia (IB) par la source (3 vols « I2 » en tout).

Les deux sont **exclues** des fichiers stricts (ta fusion conservera leur donnée existante).

---

## 4. Fichiers livrés

| Fichier | Contenu |
|---|---|
| `routes_FULL_strict.json` | **101 compagnies**, format strict (`direct_routes`/`seasonal_routes`), périmètre 1073. Prêt pour ta fusion. |
| `routes_new.json` | Même chose en **format riche** (+ `candidate_airports`, `uncertain`, `verified_date`). |
| `routes_16airlines.json` | Les 16 compagnies demandées, format riche (997 arêtes). |
| `perimetre_1073_aeroports.json` | La liste des 1073 aéroports du périmètre étendu. |
| `config.py`, `refresh_routes.py` | Scripts à jour (périmètre + compagnies + garde-fou quota + mode `--cache-only`). |

---

## 5. Comment exploiter ça (important)

- **C'est un sur-ensemble.** Ta base « officielle » à 249 aéroports reste un sous-ensemble
  de ce fichier. Tu peux adopter les nouvelles données **au rythme du développement du site** :
  d'abord les 24 nouvelles compagnies + les routes entre tes aéroports actuels, puis, quand tu
  élargiras la liste d'aéroports du site, les arêtes vers les 824 nouveaux sont **déjà là**.
- **Agrégateur = candidat.** Comme toujours : valider contre les sites officiels avant mise en
  ligne, surtout les gros écarts. Le tout a été collecté une fois ; tu l'exploites quand tu veux.
- **Aucune unité restante** ce mois-ci : tu peux **résilier** l'abonnement, la donnée est acquise.
  Le cache local (dans mon environnement) permet de tout **reconstruire sans coût** via
  `python refresh_routes.py --airports all --cache-only` si besoin d'un reformat.
- **Régénère ta clé RapidAPI** (elle est passée à l'écran).
