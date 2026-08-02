# MyDogCanFly — Pipeline de rafraîchissement des routes aériennes

Met à jour **une fois par mois** le catalogue de routes des ~80 compagnies du site,
au **format exact de tes lots** (mêmes clés, mêmes arêtes), en préservant les trois
filtres qui font la valeur de la base :

- **métal propre** — on ne retient que le transporteur *opérant* (codeshares et vols
  régionaux exclus) ;
- **sans escale** — on lit des vols réels, pas des itinéraires ;
- **saisonnier marqué** — on échantillonne l'été *et* l'hiver pour distinguer
  année-pleine et saisonnier.

Puis il **compare à ta base actuelle** et sort un **rapport des changements à valider**,
pour que tu ne revérifies à la main que ce qui a bougé — pas les 80 compagnies.

> Le classement / scoring de ton site **ne change pas** : ce pipeline sort le même
> modèle de données. Tu changes le tuyau en amont, pas ce que ton moteur reçoit.

---

## 1. Installation (une fois)

1. **Python 3** installé, puis la seule dépendance :
   ```bash
   pip install requests
   ```
2. **Clé AeroDataBox** : crée un compte sur RapidAPI, abonne-toi à l'API
   *AeroDataBox* (tier gratuit 600 unités/mois pour tester, puis ~5–15 $/mois),
   et récupère ta **X-RapidAPI-Key**.
3. Mets la clé en variable d'environnement (elle n'est **jamais** écrite dans les fichiers) :
   ```bash
   export RAPIDAPI_KEY="ta_cle_rapidapi"
   ```

---

## 2. Utilisation mensuelle

**a) Règle les dates** dans `config.py` (`SUMMER_DATES`, `WINTER_DATES`) : mets des
jours futurs proches (un pic d'été, un creux d'hiver).

**b) Test peu coûteux d'abord** (balaye seulement les hubs) :
```bash
python refresh_routes.py --airports hubs
```
Regarde le nombre d'appels consommés affiché à la fin, et ton tableau de bord RapidAPI.

**c) Balayage complet** (les 249 aéroports) :
```bash
python refresh_routes.py --airports all
```
Le **cache disque** évite de re-payer : si ça coupe, relance simplement — les aéroports
déjà récupérés ne sont pas rappelés (`--resume` équivalent).

**d) Rapport des changements** contre ta base :
```bash
python diff_baseline.py
```

Sorties (dossier `output/`) :
- `routes_new.json` — toutes les compagnies, format lots (agrégé) ;
- `per_carrier/<CODE>.json` — un fichier par compagnie ;
- `changes_report.md` — **le rapport lisible** (routes ouvertes / fermées / bascules saison) ;
- `changes_report.json` — le même, machine.

**e)** Tu ouvres `changes_report.md`, tu **valides chaque changement** contre le site
officiel de la compagnie, puis tu appliques à ta base ce qui est confirmé.

---

## 3. Coût & volume

- Balayage complet ≈ **249 aéroports × (3 j été + 3 j hiver) × 2 fenêtres ≈ 3 000 appels**.
  À 1 req/s → ~1 h de traitement.
- L'endpoint horaires (FIDS) coûte **plusieurs unités par appel** : surveille ta
  consommation RapidAPI. Les tiers **15–30 $/mois** (24 k–60 k unités) sont la zone sûre
  pour un balayage complet mensuel. Le tier **gratuit (600)** suffit pour tester en `--airports hubs`
  avec 1 seule date par saison.
- Le garde-fou `MAX_CALLS` (config, défaut 3000) stoppe avant de dépasser.
- Pour **réduire le coût** : commence par `--airports hubs` (capte l'essentiel du
  hub-and-spoke), et/ou mets 1–2 dates par saison au lieu de 3.

---

## 4. À savoir (limites honnêtes)

- **Agrégateur = candidat, pas vérité.** AeroDataBox est plus bruité que le site
  officiel d'une compagnie. D'où le workflow : on ne fait confiance qu'au *diff*, et on
  valide les changements. Ne remplace **jamais** la base d'un coup par `routes_new.json`.
- **Échantillonnage.** Une route à basse fréquence (2 vols/sem.) peut tomber en dehors
  des jours échantillonnés et apparaître à tort en « disparue ». Remède : mets **plus de
  jours** par saison (ex. 5–7 étalés) — au prix de plus d'appels. Tout « removed » du
  rapport est à traiter comme *à vérifier*, pas *à supprimer*.
- **Métal propre par construction.** Les vols opérés par un régional (ex. Endeavor `9E`
  sous marque Delta) ou une autre compagnie ne sont **pas** attribués à la marque : leur
  code opérant n'est pas dans `CARRIERS`. C'est voulu — exactement ta règle. Si tu veux
  au contraire assimiler une filiale, ajoute-la dans `CODE_MERGE` (config).
- **Hubs-only rate le point-à-point.** Les LCC très maillées (Ryanair, Wizz, Vueling…)
  ont beaucoup de liaisons hors hubs : pour elles, préfère `--airports all`.
- **Transavia** : `HV` (Pays-Bas) est fusionné dans `TO` via `CODE_MERGE` (même politique).

---

## 5. Réglages (dans `config.py`)

| Réglage | Rôle |
|---|---|
| `AIRPORTS` | le périmètre des 249 aéroports (2 extrémités d'une arête doivent y être) |
| `HUBS` | sous-ensemble pour les tests peu coûteux |
| `CARRIERS` | les ~80 compagnies suivies (seul l'opérant dans cette liste est attribué) |
| `CODE_MERGE` | fusion d'AOC d'un même groupe (ex. `HV→TO`) |
| `SUMMER_DATES` / `WINTER_DATES` | jours d'échantillonnage saisonnier |
| `RATE_LIMIT_SLEEP` | pause entre appels (garde > 1 s sur les plans 1 req/s) |
| `MAX_CALLS` | plafond de sécurité |

---

## 6. Fichiers

```
mydogcanfly_routes/
├── config.py            # tous les réglages métier
├── refresh_routes.py    # balayage AeroDataBox -> routes_new.json (+ per_carrier/)
├── diff_baseline.py     # compare à la base -> changes_report.md/.json
├── baseline_routes.json # ta base actuelle (73 compagnies) = référence du diff
├── cache/               # (créé au 1er run) réponses API mises en cache
└── output/              # (créé au 1er run) résultats + rapports
```

Le jour où tu voudras couvrir aussi AF/KL/LH/SN/U2 depuis leur source officielle
plutôt que l'agrégateur, on branchera un connecteur dédié — le format de sortie
restera identique, donc le reste ne bouge pas.
