# Brief de passation — Solution AeroDataBox pour le rafraîchissement des routes MyDogCanFly

*À partager avec le Claude du projet MyDogCanFly pour réintégrer la solution dans le projet initial. Daté du 29 juillet 2026.*

---

## 1. La décision, en une phrase

Pour rafraîchir chaque mois le catalogue de routes des ~80 compagnies du site, on utilise **AeroDataBox** (via RapidAPI) comme source de données brutes, puis un pipeline maison qui **filtre, met au format des lots existants, et sort un rapport des seuls changements à valider** — sans jamais remplacer la base d'un coup.

Le **classement / scoring du site ne change pas** : le pipeline produit exactement le même modèle de données que les lots livrés (`direct_routes`, `seasonal_routes`, mêmes arêtes `airport_x|airport_y`). On change le tuyau en amont, pas ce que le moteur reçoit en aval. Aucune règle de la « Bible » à réécrire.

---

## 2. Abonnement retenu

Source : **AeroDataBox**, souscrit **via RapidAPI** (host `aerodatabox.p.rapidapi.com`).

Point clé de tarification : AeroDataBox facture en **unités**, pas en requêtes. L'endpoint « horaires par aéroport » (FIDS) qu'on utilise coûte **plusieurs unités par appel** (endpoint de tier élevé), il faut donc prévoir de la marge.

| Usage | Plan RapidAPI | Prix | Unités/mois | Suffisant pour |
|---|---|---|---|---|
| **Test** | Basic | Gratuit | 600 | Un balayage `--airports hubs` avec 1 seule date par saison |
| **Production mensuelle** | **Ultra** | **~30 $/mois** | **60 000** | **Un balayage complet des 249 aéroports (recommandé)** |
| Intermédiaire | Pro 2 (API.Market) / Pro | ~15 $/mois | 24 000 | Balayage complet léger (moins de dates) ou hubs seulement |

**Mesures réelles (sondage du 29/07/2026, tier gratuit) :**
- **1 appel FIDS = 2 unités** (mesuré via les en-têtes `X-RateLimit-API-Units`).
- **Les horaires remontent jusqu'à l'hiver** (janvier 2027 interrogé depuis juillet 2026 → données présentes). Donc **une seule salve** capture été + hiver — pas besoin de deux abonnements.

**Stratégie retenue — balayage définitif « une bonne fois pour toutes », puis résiliation :**
- Périmètre : les **249 aéroports**, **une semaine pleine d'été + une semaine pleine d'hiver** (capte toute route volant ≥ 1×/semaine).
- Volume : **≈ 6 970 appels ≈ 14 000 unités**.
- Tier : **Ultra (~32 $/mois, 60 000 unités)** — on n'en consomme qu'un quart, donc reprises et jours supplémentaires sont couverts. On prend **un seul mois**, on lance, on valide, **on résilie**.
- Le tier **~5 $ (6 000 unités)** suffirait seulement pour un balayage léger (3+3 jours ≈ 6 000 unités) — moins exhaustif, à réserver aux rafraîchissements mensuels ultérieurs.
- Le tier **gratuit (600 unités = ~300 appels)** ne sert qu'au sondage/test.

Garde-fou intégré : `MAX_CALLS = 8000` dans `config.py` (couvre le balayage définitif + marge) ; un **cache disque** évite de re-payer si on relance (`--resume`).

---

## 3. Pourquoi AeroDataBox et pas les autres

On avait trois candidats (Aviation-Edge, AeroDataBox, Aviationstack). AeroDataBox l'emporte pour **une** raison décisive et deux secondaires :

- **Décisive — le métal propre.** AeroDataBox distingue le transporteur *opérant* du *codeshare* (paramètre `withCodeshared=false`). C'est le cœur de la valeur de la base : la politique animaux est celle de la compagnie qui opère réellement le vol, pas de celle qui vend le billet. Les deux autres API mélangent codeshares et vols opérés.
- **Sans escale par construction.** On lit des **vols réels au départ d'un aéroport** (FIDS), pas des itinéraires reconstitués. Donc pas de faux « directs » assemblés à partir de correspondances.
- **Coût raisonnable et saisonnalité accessible.** On peut interroger des dates futures précises (été et hiver), ce qui permet de marquer les routes saisonnières proprement.

---

## 4. Comment le pipeline garantit les 3 filtres de la base

C'est ce qui fait qu'on peut faire confiance à la sortie. L'astuce d'architecture : **on interroge par AÉROPORT, pas par compagnie.**

1. **Métal propre.** En lisant les départs d'un aéroport avec `withCodeshared=false`, on n'obtient que des vols *opérés*. On n'attribue une arête à une compagnie que si son code opérant figure dans notre liste `CARRIERS`. Un vol opéré par un régional (ex. Endeavor `9E` sous marque Delta) n'est donc **pas** attribué à Delta — exactement la règle voulue. Les filiales d'un même groupe qu'on veut au contraire fusionner sont dans `CODE_MERGE` (ex. `HV→TO` pour Transavia, easyJet Europe/Suisse → `U2`).
2. **Sans escale.** Chaque départ donne une destination directe → une arête `airport_x|airport_y`. Pas de correspondance possible.
3. **Saisonnier marqué.** On échantillonne **l'été ET l'hiver**. Une route présente aux deux saisons = `direct_routes` (année-pleine) ; présente à une seule = `seasonal_routes`. C'est ce qui évite le « clignotement » d'un mois à l'autre.

Périmètre : une arête n'est retenue que si **ses deux extrémités** font partie des **249 aéroports référencés** du site. Toute destination hors périmètre part en `candidate_airports`.

---

## 5. Le workflow mensuel (et pourquoi il est sûr)

Règle d'or : **on ne remplace jamais la base d'un coup.** Un agrégateur est plus bruité que le site officiel d'une compagnie. Donc :

1. `python refresh_routes.py --airports hubs` — test peu coûteux.
2. `python refresh_routes.py --airports all` — balayage complet.
3. `python diff_baseline.py` — compare à la base actuelle (`baseline_routes.json`, 73 compagnies, 5 752 arêtes) et sort un **rapport lisible** `changes_report.md` : uniquement ce qui a bougé (routes ouvertes / fermées / bascules de saison).
4. On **valide chaque changement** contre le site officiel de la compagnie, puis on n'applique que le confirmé.

Résultat : on ne revérifie à la main que les quelques routes qui ont changé, pas les 80 compagnies. Tout « removed » du rapport est à traiter comme **« à vérifier »**, jamais comme « à supprimer » (une route à basse fréquence peut tomber hors des jours échantillonnés).

---

## 6. Format de sortie (identique aux lots)

Pour chaque compagnie, le pipeline produit exactement :

```json
{
  "AF": {
    "direct_routes":      ["airport_cdg|airport_jfk", "..."],
    "seasonal_routes":    ["airport_cdg|airport_dbv", "..."],
    "candidate_airports": ["FUE — desservi depuis ORY", "..."],
    "uncertain":          [],
    "source_url":         "https://aerodatabox.com (airport schedules, operating carrier)",
    "verified_date":      "2026-08-19",
    "route_count":        123
  }
}
```

Arêtes : IATA en minuscules, préfixe `airport_`, paire triée alphabétiquement, jointe par `|`. **Rien à adapter côté site** pour ingérer ça.

---

## 7. Sécurité (important à transmettre)

- La clé RapidAPI se lit **uniquement** depuis la variable d'environnement `RAPIDAPI_KEY`. Elle n'est écrite dans **aucun** fichier du projet.
- **À faire côté Philippe** : régénérer / révoquer la clé et le secret Air France-KLM qui avaient été collés en clair dans un chat. Tout secret passé en clair est à renouveler.
- Si le chemin « Strong Client Credentials » d'AFKL est un jour utilisé, la **clé privée RSA ne doit jamais** transiter par un chat : elle reste sur la machine, dans un script local.

---

## 8. Points restés ouverts

- **Transavia (TO)** : dans la base, l'entrée `TO` est encore *provisoire* (reconstituée, source Wikipédia retirée car interdite par le brief). Pour la certifier : soit l'URL officielle des destinations `transavia.com`, soit l'activation de l'endpoint `network-and-schedule` sur le contrat AFKL (il renvoyait 404 → probablement hors contrat actuel).
- **AF / KL / LH / SN / U2** : aujourd'hui via l'agrégateur comme les autres. Si on veut à terme les passer sur leur **source officielle**, on branchera un connecteur dédié — le format de sortie restera identique, donc rien d'autre ne bouge.

---

## 9. Contenu du zip livré (`mydogcanfly_routes.zip`)

```
mydogcanfly_routes/
├── config.py            # réglages métier : 249 aéroports, 78 compagnies, dates, fusions de codes
├── refresh_routes.py    # balayage AeroDataBox -> routes_new.json (format lots) + per_carrier/
├── diff_baseline.py     # compare à la base -> changes_report.md / .json
├── baseline_routes.json # la base actuelle (73 compagnies, 5 752 arêtes) = référence du diff
├── README.md            # installation, usage, coûts, limites
└── BRIEF_AERODATABOX.md # ce document
```

Mise en route :

```bash
pip install requests
export RAPIDAPI_KEY="ta_cle_rapidapi"
python refresh_routes.py --airports hubs      # test
python refresh_routes.py --airports all        # balayage complet
python diff_baseline.py                        # rapport des changements à valider
```
