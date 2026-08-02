# Pipeline de rafraîchissement des routes — note d'intégration

Reçu le 29 juillet 2026 depuis le projet parallèle « MyDogCanFly Routes Database ».
Le fonctionnement du pipeline est décrit dans `README.md`, la décision d'architecture dans
`BRIEF_AERODATABOX.md`. Cette note dit ce qui a été vérifié et préparé côté dépôt principal.

## AeroDataBox fait autorité sur toutes les compagnies, sans exception

Décision du 29/07 : la source payante prime sur toute donnée constituée autrement.
Y compris sur **Air France, KLM, Lufthansa, Brussels et easyJet**, jusqu'ici renseignées
par un autre chemin (API KLM/Transavia) et volontairement préservées lors de la première
fusion.

Cette préservation n'a plus lieu d'être, et les données lui donnent tort :

| | Les 5 préservées | Compagnies issues du pipeline |
|---|---|---|
| Routes saisonnières distinguées | **0 sur les 5** | 8 à 47 par compagnie (SAS 47, BA 8…) |

**752 arêtes sont donc annoncées « toute l'année » sans qu'aucune n'ait jamais été testée
pour la saisonnalité.** C'est exactement la régression contre laquelle le script de fusion
met en garde dans son propre en-tête : annoncer en février un vol direct qui n'existe qu'en
juillet. Le pipeline, qui échantillonne été *et* hiver, corrige ça par construction.

Autre indice : KLM ne compte que 83 routes, au 20ᵉ rang sur 78 — derrière SAS (126) et
Saudia (111), pour un hub de la taille d'Amsterdam. À surveiller en priorité dans le
rapport de changements.

## Ce qui a été préparé

1. **`baseline_routes.json` régénéré depuis la production** : 73 → **78 compagnies**,
   6 504 arêtes. Sans ça, `diff_baseline.py` aurait présenté AF/KL/LH/SN/U2 comme
   entièrement nouvelles — 752 routes à valider à la main pour rien. Le rapport ne montrera
   désormais que les vrais écarts.
2. **Aucune modification de `merge-routes.mjs` nécessaire** : le script ne code en dur
   aucune préservation. Il conserve une compagnie *absente* du baseline ; dès lors que le
   pipeline produit les 78, les 5 sont remplacées naturellement.
3. Le pipeline couvre bien les 78 codes, `AF KL LH SN U2` compris (`config.py`, `CARRIERS`),
   avec la fusion des AOC (`HV→TO`, `EC/DS→U2`).

## Ce que je ne peux pas faire

Je n'exécute pas la collecte : elle demande une clé RapidAPI, et je ne manipule pas
d'identifiants. La clé se pose en variable d'environnement, jamais dans un fichier.

## Cycle — à lancer par toi

```bash
cd ~/Documents/GitHub/mydogcanfly/tools/routes-refresh
export RAPIDAPI_KEY="…"

python3 test_feasibility.py            # sonde quota et profondeur d'horaires
python3 refresh_routes.py --airports all   # balayage complet des 249 aéroports
python3 diff_baseline.py               # rapport des seuls changements à valider
```

Règle les dates dans `config.py` (`SUMMER_DATES`, `WINTER_DATES`) avant : un pic d'été et
un creux d'hiver, en jours futurs proches. Le brief mesure 1 appel FIDS = 2 unités et
recommande le plan Ultra (~30 $/mois, 60 000 unités) pour un balayage complet.

`diff_baseline.py` écrit `output/changes_report.md` — c'est le point d'arrêt : rien n'entre
dans le dépôt avant ta validation. Ensuite, envoie-moi le rapport et le fichier produit, et
je fais la fusion :

```bash
node packages/knowledge/scripts/merge-routes.mjs tools/routes-refresh/output/routes_new.json --dry
```

Le `--dry` d'abord, toujours : il montre ce qui changerait sans rien écrire.

## Réserve

Le pipeline n'a jamais tourné dans ce dépôt : il est intégré, pas éprouvé. Le premier
passage réel demandera probablement des ajustements de quota et de dates. Et tant qu'il n'a
pas tourné, la saisonnalité des 5 compagnies reste inconnue — le site continue d'annoncer
leurs 752 arêtes comme permanentes.
